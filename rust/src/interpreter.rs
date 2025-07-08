use std::collections::{HashMap, HashSet};
use crate::types::*;
use crate::tokenizer::*;
use crate::builtins;

pub struct Interpreter {
    stack: Stack,
    register: Register,
    dictionary: HashMap<String, WordDefinition>,
    dependencies: HashMap<String, HashSet<String>>, // word -> それを使用しているワードのセット
}

pub struct WordDefinition {
    pub tokens: Vec<Token>,
    pub is_builtin: bool,
    pub description: Option<String>,
}

impl Interpreter {
    pub fn new() -> Self {
        let mut interpreter = Interpreter {
            stack: Vec::new(),
            register: None,
            dictionary: HashMap::new(),
            dependencies: HashMap::new(),
        };
        
        // 組み込みワードを登録
        builtins::register_builtins(&mut interpreter.dictionary);
        
        interpreter
    }
    
    pub fn execute(&mut self, code: &str) -> Result<(), String> {
        let tokens = tokenize(code)?;
        self.execute_tokens_with_context(&tokens, false)?;
        Ok(())
    }
    
    pub fn execute_tokens(&mut self, tokens: &[Token]) -> Result<(), String> {
        self.execute_tokens_with_context(tokens, false)
    }
    
    fn execute_tokens_with_context(&mut self, tokens: &[Token], in_vector: bool) -> Result<(), String> {
    let mut i = 0;
    let mut pending_description: Option<String> = None;
    
    while i < tokens.len() {
        match &tokens[i] {
            Token::Description(text) => {
                // DEFの後の説明文として保持
                pending_description = Some(text.clone());
            },
            Token::Number(num, den) => {
                self.stack.push(Value {
                    val_type: ValueType::Number(Fraction::new(*num, *den)),
                });
            },
            Token::String(s) => {
                self.stack.push(Value {
                    val_type: ValueType::String(s.clone()),
                });
            },
            Token::Boolean(b) => {
                self.stack.push(Value {
                    val_type: ValueType::Boolean(*b),
                });
            },
            Token::Nil => {
                self.stack.push(Value {
                    val_type: ValueType::Nil,
                });
            },
            Token::VectorStart => {
                let (vector_tokens, consumed) = self.collect_vector(&tokens[i..])?;
                
                if in_vector {
                    // ネストされたベクトル内でのベクトル作成
                    let saved_stack = self.stack.clone();
                    let saved_register = self.register.clone();
                    self.stack.clear();
                    
                    self.execute_tokens_with_context(&vector_tokens, true)?;
                    
                    let vector_contents = self.stack.clone();
                    self.stack = saved_stack;
                    self.register = saved_register;
                    
                    self.stack.push(Value {
                        val_type: ValueType::Vector(vector_contents),
                    });
                } else {
                    // トップレベルでのベクトル作成
                    let saved_stack = self.stack.clone();
                    self.stack.clear();
                    
                    self.execute_tokens_with_context(&vector_tokens, true)?;
                    
                    let vector_contents = self.stack.clone();
                    self.stack = saved_stack;
                    
                    self.stack.push(Value {
                        val_type: ValueType::Vector(vector_contents),
                    });
                }
                
                i += consumed - 1;
            },
            Token::Symbol(name) => {
                if in_vector {
                    // ベクトル内ではシンボルとしてスタックに積む
                    self.stack.push(Value {
                        val_type: ValueType::Symbol(name.clone()),
                    });
                } else {
                    // 通常のコンテキストでは実行
                    // まず演算子として扱えるかチェック
                    if matches!(name.as_str(), "+" | "-" | "*" | "/" | ">" | ">=" | "=" | "<" | "<=") {
                        self.execute_operator(name)?;
                    } else if let Some(def) = self.dictionary.get(name) {
                        if def.is_builtin {
                            if name == "DEF" {
                                // DEFの場合、次のトークンが説明文かチェック
                                let mut description = None;
                                if i + 1 < tokens.len() {
                                    if let Token::Description(text) = &tokens[i + 1] {
                                        description = Some(text.clone());
                                        i += 1; // 説明文トークンをスキップ
                                    }
                                }
                                // pending_descriptionがあればそれを優先
                                if pending_description.is_some() {
                                    description = pending_description.take();
                                }
                                self.execute_builtin_with_comment(name, description)?;
                            } else {
                                self.execute_builtin(name)?;
                            }
                        } else {
                            self.execute_tokens_with_context(&def.tokens.clone(), false)?;
                        }
                    } else {
                        return Err(format!("Unknown word: {}", name));
                    }
                }
            },
            _ => {
                return Err(format!("Unexpected token: {:?}", tokens[i]));
            }
        }
        
        // Descriptionトークンとそれを使用したDEF以外で説明文をクリア
        if !matches!(&tokens[i], Token::Description(_)) {
            if let Token::Symbol(s) = &tokens[i] {
                if s != "DEF" || i == 0 || !matches!(&tokens[i-1], Token::Description(_)) {
                    pending_description = None;
                }
            } else {
                pending_description = None;
            }
        }
        
        i += 1;
    }
    
    Ok(())
}
    
    fn collect_vector(&self, tokens: &[Token]) -> Result<(Vec<Token>, usize), String> {
        let mut vector_tokens = Vec::new();
        let mut depth = 0;
        let mut i = 1; // Skip the opening [
        
        while i < tokens.len() {
            match &tokens[i] {
                Token::VectorStart => {
                    depth += 1;
                    vector_tokens.push(tokens[i].clone());
                },
                Token::VectorEnd => {
                    if depth == 0 {
                        return Ok((vector_tokens, i + 1));
                    }
                    depth -= 1;
                    vector_tokens.push(tokens[i].clone());
                },
                _ => {
                    vector_tokens.push(tokens[i].clone());
                }
            }
            i += 1;
        }
        
        Err("Unclosed vector".to_string())
    }
    
    fn execute_builtin(&mut self, name: &str) -> Result<(), String> {
        match name {
            "DUP" => self.op_dup()?,
            "DROP" => self.op_drop()?,
            "SWAP" => self.op_swap()?,
            "OVER" => self.op_over()?,
            "ROT" => self.op_rot()?,
            ">R" => self.op_to_r()?,
            "R>" => self.op_from_r()?,
            "R@" => self.op_r_fetch()?,
            "DEF" => self.op_def()?,
            "IF" => self.op_if()?,
            "LENGTH" => self.op_length()?,
            "HEAD" => self.op_head()?,
            "TAIL" => self.op_tail()?,
            "CONS" => self.op_cons()?,
            "APPEND" => self.op_append()?,
            "REVERSE" => self.op_reverse()?,
            "NTH" => self.op_nth()?,
            "UNCONS" => self.op_uncons()?,
            "EACH" => self.op_each()?,
            "EMPTY?" => self.op_empty()?,
            "DEL" => self.op_del()?,
            _ => return Err(format!("Unknown builtin: {}", name)),
        }
        Ok(())
    }
    
    fn execute_builtin_with_comment(&mut self, name: &str, comment: Option<String>) -> Result<(), String> {
        match name {
            "DEF" => self.op_def_with_comment(comment)?,
            _ => self.execute_builtin(name)?,
        }
        Ok(())
    }
    
    fn execute_operator(&mut self, op: &str) -> Result<(), String> {
        match op {
            "+" => self.op_add()?,
            "-" => self.op_sub()?,
            "*" => self.op_mul()?,
            "/" => self.op_div()?,
            ">" => self.op_gt()?,
            ">=" => self.op_ge()?,
            "=" => self.op_eq()?,
            "<" => self.op_lt()?,
            "<=" => self.op_le()?,
            _ => return Err(format!("Unknown operator: {}", op)),
        }
        Ok(())
    }
    
    // ワードの依存関係を収集
    fn collect_dependencies(tokens: &[Token]) -> HashSet<String> {
        let mut deps = HashSet::new();
        for token in tokens {
            if let Token::Symbol(name) = token {
                deps.insert(name.clone());
            }
        }
        deps
    }
    
    // ワードの削除（DEL命令用）
    pub fn delete_word(&mut self, name: &str) -> Result<(), String> {
        // 組み込みワードは削除不可
        if let Some(def) = self.dictionary.get(name) {
            if def.is_builtin {
                return Err(format!("Cannot delete builtin word: {}", name));
            }
        } else {
            return Err(format!("Word not found: {}", name));
        }
        
        // 依存関係チェック
        if let Some(dependents) = self.dependencies.get(name) {
            if !dependents.is_empty() {
                let dependent_list: Vec<String> = dependents.iter().cloned().collect();
                return Err(format!(
                    "Cannot delete '{}' because it is used by: {}", 
                    name, 
                    dependent_list.join(", ")
                ));
            }
        }
        
        // ワードを削除
        self.dictionary.remove(name);
        
        // このワードが依存していた他のワードから、依存関係を削除
        for (_, deps) in self.dependencies.iter_mut() {
            deps.remove(name);
        }
        
        // 依存関係エントリ自体も削除
        self.dependencies.remove(name);
        
        Ok(())
    }
    
    // スタック操作
    fn op_dup(&mut self) -> Result<(), String> {
        if let Some(top) = self.stack.last() {
            self.stack.push(top.clone());
            Ok(())
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_drop(&mut self) -> Result<(), String> {
        if self.stack.pop().is_none() {
            Err("Stack underflow".to_string())
        } else {
            Ok(())
        }
    }
    
    fn op_swap(&mut self) -> Result<(), String> {
        let len = self.stack.len();
        if len < 2 {
            Err("Stack underflow".to_string())
        } else {
            self.stack.swap(len - 1, len - 2);
            Ok(())
        }
    }
    
    fn op_over(&mut self) -> Result<(), String> {
        let len = self.stack.len();
        if len < 2 {
            Err("Stack underflow".to_string())
        } else {
            let item = self.stack[len - 2].clone();
            self.stack.push(item);
            Ok(())
        }
    }
    
    fn op_rot(&mut self) -> Result<(), String> {
        let len = self.stack.len();
        if len < 3 {
            Err("Stack underflow".to_string())
        } else {
            let third = self.stack.remove(len - 3);
            self.stack.push(third);
            Ok(())
        }
    }
    
    // レジスタ操作
    fn op_to_r(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            self.register = Some(val);
            Ok(())
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_from_r(&mut self) -> Result<(), String> {
        if let Some(val) = self.register.take() {
            self.stack.push(val);
            Ok(())
        } else {
            Err("Register is empty".to_string())
        }
    }
    
    fn op_r_fetch(&mut self) -> Result<(), String> {
        if let Some(val) = &self.register {
            self.stack.push(val.clone());
            Ok(())
        } else {
            Err("Register is empty".to_string())
        }
    }
    
    // 算術演算
    fn op_add(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value {
                    val_type: ValueType::Number(n1.add(n2)),
                });
                Ok(())
            },
            _ => Err("Type error: + requires two numbers".to_string()),
        }
    }
    
    fn op_sub(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value {
                    val_type: ValueType::Number(n1.sub(n2)),
                });
                Ok(())
            },
            _ => Err("Type error: - requires two numbers".to_string()),
        }
    }
    
    fn op_mul(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value {
                    val_type: ValueType::Number(n1.mul(n2)),
                });
                Ok(())
            },
            _ => Err("Type error: * requires two numbers".to_string()),
        }
    }
    
    fn op_div(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value {
                    val_type: ValueType::Number(n1.div(n2)),
                });
                Ok(())
            },
            _ => Err("Type error: / requires two numbers".to_string()),
        }
    }
    
    // 比較演算
    fn op_gt(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value {
                    val_type: ValueType::Boolean(n1.gt(n2)),
                });
                Ok(())
            },
            _ => Err("Type error: > requires two numbers".to_string()),
        }
    }
    
    fn op_ge(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value {
                    val_type: ValueType::Boolean(n1.ge(n2)),
                });
                Ok(())
            },
            _ => Err("Type error: >= requires two numbers".to_string()),
        }
    }
    
    fn op_eq(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        
        let result = match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => n1.eq(n2),
            (ValueType::String(s1), ValueType::String(s2)) => s1 == s2,
            (ValueType::Boolean(b1), ValueType::Boolean(b2)) => b1 == b2,
            (ValueType::Symbol(s1), ValueType::Symbol(s2)) => s1 == s2,
            (ValueType::Nil, ValueType::Nil) => true,
            _ => false,
        };
        
        self.stack.push(Value {
            val_type: ValueType::Boolean(result),
        });
        Ok(())
    }
    
    fn op_lt(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value {
                    val_type: ValueType::Boolean(n2.gt(n1)),
                });
                Ok(())
            },
            _ => Err("Type error: < requires two numbers".to_string()),
        }
    }
    
    fn op_le(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value {
                    val_type: ValueType::Boolean(n2.ge(n1)),
                });
                Ok(())
            },
            _ => Err("Type error: <= requires two numbers".to_string()),
        }
    }
    
    // ベクトル操作
    fn op_length(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Vector(v) => {
                    self.stack.push(Value {
                        val_type: ValueType::Number(Fraction::new(v.len() as i64, 1)),
                    });
                    Ok(())
                },
                _ => Err("Type error: LENGTH requires a vector".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_head(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Vector(v) => {
                    if let Some(first) = v.first() {
                        self.stack.push(first.clone());
                        Ok(())
                    } else {
                        Err("HEAD of empty vector".to_string())
                    }
                },
                _ => Err("Type error: HEAD requires a vector".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_tail(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Vector(v) => {
                    if v.is_empty() {
                        Err("TAIL of empty vector".to_string())
                    } else {
                        let tail: Vec<Value> = v.into_iter().skip(1).collect();
                        self.stack.push(Value {
                            val_type: ValueType::Vector(tail),
                        });
                        Ok(())
                    }
                },
                _ => Err("Type error: TAIL requires a vector".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_cons(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let vec = self.stack.pop().unwrap();
        let elem = self.stack.pop().unwrap();
        
        match vec.val_type {
            ValueType::Vector(mut v) => {
                v.insert(0, elem);
                self.stack.push(Value {
                    val_type: ValueType::Vector(v),
                });
                Ok(())
            },
            _ => Err("Type error: CONS requires an element and a vector".to_string()),
        }
    }

    fn op_append(&mut self) -> Result<(), String> {
    if self.stack.len() < 2 {
        return Err("Stack underflow".to_string());
    }
    
    let elem = self.stack.pop().unwrap();
    let vec = self.stack.pop().unwrap();
    
    match vec.val_type {
        ValueType::Vector(mut v) => {
            v.push(elem);
            self.stack.push(Value {
                val_type: ValueType::Vector(v),
            });
            Ok(())
        },
        _ => Err("Type error: APPEND requires a vector and an element".to_string()),
    }
}
    
    fn op_reverse(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Vector(mut v) => {
                    v.reverse();
                    self.stack.push(Value {
                        val_type: ValueType::Vector(v),
                    });
                    Ok(())
                },
                _ => Err("Type error: REVERSE requires a vector".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }

    // ベクトルのインデックスアクセス（負のインデックスサポート）
    fn op_nth(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow".to_string());
        }
        
        let vec_val = self.stack.pop().unwrap();
        let index_val = self.stack.pop().unwrap();
        
        match (&index_val.val_type, &vec_val.val_type) {
            (ValueType::Number(n), ValueType::Vector(v)) => {
                if n.denominator != 1 {
                    return Err("NTH requires an integer index".to_string());
                }
                
                let mut index = n.numerator;
                let len = v.len() as i64;
                
                // 負のインデックスの処理
                if index < 0 {
                    index = len + index;
                }
                
                if index < 0 || index >= len {
                    return Err(format!("Index {} out of bounds for vector of length {}", n.numerator, len));
                }
                
                self.stack.push(v[index as usize].clone());
                Ok(())
            },
            _ => Err("Type error: NTH requires a number and a vector".to_string()),
        }
    }
    
    // スタックベース反復サポート
    fn op_uncons(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Vector(v) => {
                    if v.is_empty() {
                        return Err("UNCONS of empty vector".to_string());
                    }
                    let mut v = v;
                    let head = v.remove(0);
                    self.stack.push(head);
                    self.stack.push(Value {
                        val_type: ValueType::Vector(v),
                    });
                    Ok(())
                },
                _ => Err("Type error: UNCONS requires a vector".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_each(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Vector(v) => {
                    for item in v {
                        self.stack.push(item);
                    }
                    Ok(())
                },
                _ => Err("Type error: EACH requires a vector".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_empty(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Vector(v) => {
                    self.stack.push(Value {
                        val_type: ValueType::Boolean(v.is_empty()),
                    });
                    Ok(())
                },
                _ => Err("Type error: EMPTY? requires a vector".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    // 制御構造
    fn op_def(&mut self) -> Result<(), String> {
        self.op_def_with_comment(None)
    }
    
    fn op_def_with_comment(&mut self, description: Option<String>) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow for DEF".to_string());
        }
        
        let name_val = self.stack.pop().unwrap();
        let body_val = self.stack.pop().unwrap();
        
        match (&name_val.val_type, &body_val.val_type) {
            (ValueType::String(name), ValueType::Vector(body)) => {
                // ワード名を大文字に正規化
                let name = name.to_uppercase();
                
                // 組み込みワードの再定義を防ぐ
                if let Some(existing) = self.dictionary.get(&name) {
                    if existing.is_builtin {
                        return Err(format!("Cannot redefine builtin word: {}", name));
                    }
                }
                
                // 既存のカスタムワードを再定義する場合、依存関係をチェック
                if self.dictionary.contains_key(&name) {
                    if let Some(dependents) = self.dependencies.get(&name) {
                        if !dependents.is_empty() {
                            let dependent_list: Vec<String> = dependents.iter().cloned().collect();
                            return Err(format!(
                                "Cannot redefine '{}' because it is used by: {}", 
                                name, 
                                dependent_list.join(", ")
                            ));
                        }
                    }
                    // 依存関係がなければ、古い定義の依存関係を削除
                    let old_def = self.dictionary.get(&name).unwrap();
                    let old_deps = Self::collect_dependencies(&old_def.tokens);
                    for dep in old_deps {
                        if let Some(deps) = self.dependencies.get_mut(&dep) {
                            deps.remove(&name);
                        }
                    }
                }
                
                // ベクトルの内容をトークンに変換
                let mut tokens = Vec::new();
                let mut used_words = HashSet::new();
                
                // ベクトルの内容をトークンに変換する補助関数
                fn value_to_tokens(val: &Value, tokens: &mut Vec<Token>, used_words: &mut HashSet<String>, dictionary: &HashMap<String, WordDefinition>) -> Result<(), String> {
                    match &val.val_type {
                        ValueType::Number(n) => {
                            tokens.push(Token::Number(n.numerator, n.denominator));
                        },
                        ValueType::String(s) => {
                            tokens.push(Token::String(s.clone()));
                        },
                        ValueType::Boolean(b) => {
                            tokens.push(Token::Boolean(*b));
                        },
                        ValueType::Symbol(s) => {
                            tokens.push(Token::Symbol(s.clone()));
                            // カスタムワードの使用を記録
                            if dictionary.contains_key(s) && !dictionary.get(s).unwrap().is_builtin {
                                used_words.insert(s.clone());
                            }
                        },
                        ValueType::Nil => {
                            tokens.push(Token::Nil);
                        },
                        ValueType::Vector(v) => {
                            // ネストされたベクトルをサポート
                            tokens.push(Token::VectorStart);
                            for item in v {
                                value_to_tokens(item, tokens, used_words, dictionary)?;
                            }
                            tokens.push(Token::VectorEnd);
                        }
                    }
                    Ok(())
                }
                
                for val in body {
                    value_to_tokens(val, &mut tokens, &mut used_words, &self.dictionary)?;
                }
                
                // 新しい依存関係を追加
                for used_word in &used_words {
                    self.dependencies
                        .entry(used_word.clone())
                        .or_insert_with(HashSet::new)
                        .insert(name.clone());
                }
                
                // ワードを定義（新規または上書き）
                self.dictionary.insert(name.clone(), WordDefinition {
                    tokens,
                    is_builtin: false,
                    description,
                });
                
                Ok(())
            },
            _ => Err("Type error: DEF requires a vector and a string".to_string()),
        }
    }
    
    // rust/src/interpreter.rs の op_if 関数を修正
fn op_if(&mut self) -> Result<(), String> {
    if self.stack.len() < 3 {
        return Err("Stack underflow for IF".to_string());
    }
    
    let else_branch = self.stack.pop().unwrap();
    let then_branch = self.stack.pop().unwrap();
    let condition = self.stack.pop().unwrap();
    
    match (&condition.val_type, &then_branch.val_type, &else_branch.val_type) {
        (ValueType::Boolean(cond), ValueType::Vector(then_tokens), ValueType::Vector(else_tokens)) => {
            let tokens_to_execute = if *cond { then_tokens } else { else_tokens };
            
            // ベクトルの内容をトークンに変換して実行
            let mut tokens = Vec::new();
            for val in tokens_to_execute {
                self.value_to_token(val, &mut tokens)?;
            }
            
            // トークンを実行
            self.execute_tokens_with_context(&tokens, false)?;
            Ok(())
        },
        _ => Err("Type error: IF requires a boolean and two vectors".to_string()),
    }
}

// 値をトークンに変換するヘルパー関数を追加
fn value_to_token(&self, val: &Value, tokens: &mut Vec<Token>) -> Result<(), String> {
    match &val.val_type {
        ValueType::Number(n) => {
            tokens.push(Token::Number(n.numerator, n.denominator));
        },
        ValueType::String(s) => {
            tokens.push(Token::String(s.clone()));
        },
        ValueType::Boolean(b) => {
            tokens.push(Token::Boolean(*b));
        },
        ValueType::Symbol(s) => {
            tokens.push(Token::Symbol(s.clone()));
        },
        ValueType::Nil => {
            tokens.push(Token::Nil);
        },
        ValueType::Vector(v) => {
            tokens.push(Token::VectorStart);
            for item in v {
                self.value_to_token(item, tokens)?;
            }
            tokens.push(Token::VectorEnd);
        }
    }
    Ok(())
}
    
    // 論理演算子
fn op_not(&mut self) -> Result<(), String> {
    if let Some(val) = self.stack.pop() {
        match val.val_type {
            ValueType::Boolean(b) => {
                self.stack.push(Value {
                    val_type: ValueType::Boolean(!b),
                });
                Ok(())
            },
            _ => Err("Type error: NOT requires a boolean".to_string()),
        }
    } else {
        Err("Stack underflow".to_string())
    }
}
    
    
    // DEL命令の実装
    fn op_del(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::String(name) => {
                    // ワード名を大文字に正規化
                    self.delete_word(&name.to_uppercase())
                },
                _ => Err("Type error: DEL requires a string".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    // Public methods for WASM interface
    pub fn get_stack(&self) -> &Stack {
        &self.stack
    }
    
    pub fn get_register(&self) -> &Register {
        &self.register
    }
    
    pub fn get_custom_words(&self) -> Vec<String> {
        let mut words: Vec<String> = self.dictionary
            .iter()
            .filter(|(_, def)| !def.is_builtin)
            .map(|(name, _)| name.clone())
            .collect();
        words.sort();
        words
    }
    
    // カスタムワードを説明付きで取得
   pub fn get_custom_words_with_descriptions(&self) -> Vec<(String, Option<String>)> {
       let mut words: Vec<(String, Option<String>)> = self.dictionary
           .iter()
           .filter(|(_, def)| !def.is_builtin)
           .map(|(name, def)| (name.clone(), def.description.clone()))
           .collect();
       words.sort_by(|a, b| a.0.cmp(&b.0));
       words
   }
   
   // カスタムワードの情報を取得（保護状態を含む）
   pub fn get_custom_words_info(&self) -> Vec<(String, Option<String>, bool)> {
       let mut words: Vec<(String, Option<String>, bool)> = self.dictionary
           .iter()
           .filter(|(_, def)| !def.is_builtin)
           .map(|(name, def)| {
               // このワードが他のワードから依存されているかチェック
               let is_protected = self.dependencies.get(name)
                   .map(|deps| !deps.is_empty())
                   .unwrap_or(false);
               
               (name.clone(), def.description.clone(), is_protected)
           })
           .collect();
       words.sort_by(|a, b| a.0.cmp(&b.0));
       words
   }
   
   // 依存関係情報を取得
   pub fn get_dependencies(&self, word: &str) -> Vec<String> {
       if let Some(deps) = self.dependencies.get(word) {
           deps.iter().cloned().collect()
       } else {
           Vec::new()
       }
   }
}
