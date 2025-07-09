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

#[derive(Clone)]
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
        
        builtins::register_builtins(&mut interpreter.dictionary);
        
        interpreter
    }
    
    pub fn execute(&mut self, code: &str) -> Result<(), String> {
        let tokens = tokenize(code)?;
        self.execute_tokens_with_context(&tokens)?;
        Ok(())
    }
    
    fn execute_tokens_with_context(&mut self, tokens: &[Token]) -> Result<(), String> {
        let mut i = 0;
        let mut pending_description: Option<String> = None;

        while i < tokens.len() {
            match &tokens[i] {
                Token::Description(text) => {
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
                    let (vector_body, consumed) = self.collect_vector(&tokens[i..])?;
                    
                    let mut temp_interpreter = Interpreter::new();
                    temp_interpreter.dictionary = self.dictionary.clone();
                    temp_interpreter.dependencies = self.dependencies.clone();

                    temp_interpreter.execute_tokens_with_context(&vector_body)?;
                    
                    self.stack.push(Value {
                        val_type: ValueType::Vector(temp_interpreter.stack),
                    });
                    
                    i += consumed - 1;
                },
                Token::Symbol(name) => {
                    // ★★ここを修正★★
                    // 1. 演算子かどうかを最優先でチェック
                    if matches!(name.as_str(), "+" | "-" | "*" | "/" | ">" | ">=" | "=" | "<" | "<=") {
                        self.execute_operator(name)?;
                    // 2. 次に、辞書に登録されたワード（組み込み or カスタム）かチェック
                    } else if let Some(def) = self.dictionary.get(name).cloned() {
                        if def.is_builtin {
                            if name == "DEF" {
                                let desc = pending_description.take();
                                self.op_def_with_comment(desc)?;
                            } else {
                                self.execute_builtin(name)?;
                            }
                        } else {
                            self.execute_tokens_with_context(&def.tokens)?;
                        }
                    // 3. 上記のいずれでもなければ、未知のワードとしてエラー
                    } else {
                        return Err(format!("Unknown word: {}", name));
                    }
                },
                // `collect_vector`が正しく機能していれば、トップレベルで VectorEnd が現れることはない
                Token::VectorEnd => return Err("Unexpected ']' found.".to_string()),
            }
            
            i += 1;
        }
        
        Ok(())
    }

    fn body_vector_to_tokens(
        &self,
        body: &[Value],
    ) -> Result<(Vec<Token>, HashSet<String>), String> {
        let mut tokens = Vec::new();
        let mut dependencies = HashSet::new();

        for val in body {
            self.value_to_tokens_recursive(val, &mut tokens, &mut dependencies)?;
        }

        Ok((tokens, dependencies))
    }

    fn value_to_tokens_recursive(
        &self,
        val: &Value,
        tokens: &mut Vec<Token>,
        dependencies: &mut HashSet<String>,
    ) -> Result<(), String> {
        match &val.val_type {
            ValueType::Number(n) => tokens.push(Token::Number(n.numerator, n.denominator)),
            ValueType::String(s) => tokens.push(Token::String(s.clone())),
            ValueType::Boolean(b) => tokens.push(Token::Boolean(*b)),
            ValueType::Nil => tokens.push(Token::Nil),
            ValueType::Symbol(s) => {
                tokens.push(Token::Symbol(s.clone()));
                if let Some(def) = self.dictionary.get(s) {
                    if !def.is_builtin {
                        dependencies.insert(s.clone());
                    }
                }
            }
            ValueType::Vector(v) => {
                tokens.push(Token::VectorStart);
                for item in v {
                    self.value_to_tokens_recursive(item, tokens, dependencies)?;
                }
                tokens.push(Token::VectorEnd);
            }
        }
        Ok(())
    }
    
    fn collect_vector(&self, tokens: &[Token]) -> Result<(Vec<Token>, usize), String> {
        let mut vector_tokens = Vec::new();
        let mut depth = 0;
        let mut i = 1; 
        
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
            "DUP" => self.op_dup(),
            "DROP" => self.op_drop(),
            "SWAP" => self.op_swap(),
            "OVER" => self.op_over(),
            "ROT" => self.op_rot(),
            ">R" => self.op_to_r(),
            "R>" => self.op_from_r(),
            "R@" => self.op_r_fetch(),
            "DEF" => self.op_def_with_comment(None),
            "IF" => self.op_if(),
            "LENGTH" => self.op_length(),
            "HEAD" => self.op_head(),
            "TAIL" => self.op_tail(),
            "CONS" => self.op_cons(),
            "APPEND" => self.op_append(),
            "REVERSE" => self.op_reverse(),
            "NTH" => self.op_nth(),
            "UNCONS" => self.op_uncons(),
            "EACH" => self.op_each(),
            "EMPTY?" => self.op_empty(),
            "DEL" => self.op_del(),
            "NOT" => self.op_not(),
            "MAP" => self.op_map(),
            "WHEN" => self.op_when(),
            "UNLESS" => self.op_unless(),
            "LOOP" => self.op_loop(),
            "CASE" => self.op_case(),
            _ => Err(format!("Unknown builtin: {}", name)),
        }
    }
    
    fn execute_operator(&mut self, op: &str) -> Result<(), String> {
        match op {
            "+" => self.op_add(),
            "-" => self.op_sub(),
            "*" => self.op_mul(),
            "/" => self.op_div(),
            ">" => self.op_gt(),
            ">=" => self.op_ge(),
            "=" => self.op_eq(),
            "<" => self.op_lt(),
            "<=" => self.op_le(),
            _ => Err(format!("Unknown operator: {}", op)),
        }
    }
    
    fn op_def_with_comment(&mut self, description: Option<String>) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow for DEF".to_string());
        }
    
        let name_val = self.stack.pop().unwrap();
        let body_val = self.stack.pop().unwrap();
    
        match (&name_val.val_type, &body_val.val_type) {
            (ValueType::String(name), ValueType::Vector(body)) => {
                let name = name.to_uppercase();
    
                if let Some(existing) = self.dictionary.get(&name) {
                    if existing.is_builtin {
                        return Err(format!("Cannot redefine builtin word: {}", name));
                    }
                }
    
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
    
                    if let Some(old_def) = self.dictionary.get(&name) {
                        let mut old_deps = HashSet::new();
                        for token in &old_def.tokens {
                           if let Token::Symbol(s) = token {
                               old_deps.insert(s.clone());
                           }
                        }

                        for dep in old_deps {
                            if let Some(deps) = self.dependencies.get_mut(&dep) {
                                deps.remove(&name);
                            }
                        }
                    }
                }
    
                let (new_tokens, new_dependencies) = self.body_vector_to_tokens(body)?;
    
                for dep_name in &new_dependencies {
                    self.dependencies
                        .entry(dep_name.clone())
                        .or_insert_with(HashSet::new)
                        .insert(name.clone());
                }
    
                self.dictionary.insert(name.clone(), WordDefinition {
                    tokens: new_tokens,
                    is_builtin: false,
                    description,
                });
    
                Ok(())
            }
            _ => Err("Type error: DEF requires a vector and a string".to_string()),
        }
    }

    pub fn delete_word(&mut self, name: &str) -> Result<(), String> {
        if let Some(def) = self.dictionary.get(name) {
            if def.is_builtin {
                return Err(format!("Cannot delete builtin word: {}", name));
            }
        } else {
            return Err(format!("Word not found: {}", name));
        }
        
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
        
        self.dictionary.remove(name);
        
        for (_, deps) in self.dependencies.iter_mut() {
            deps.remove(name);
        }
        
        self.dependencies.remove(name);
        
        Ok(())
    }
    
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
    
    fn op_add(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value { val_type: ValueType::Number(n1.add(n2)) });
                Ok(())
            },
            _ => Err("Type error: + requires two numbers".to_string()),
        }
    }
    
    fn op_sub(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value { val_type: ValueType::Number(n1.sub(n2)) });
                Ok(())
            },
            _ => Err("Type error: - requires two numbers".to_string()),
        }
    }
    
    fn op_mul(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value { val_type: ValueType::Number(n1.mul(n2)) });
                Ok(())
            },
            _ => Err("Type error: * requires two numbers".to_string()),
        }
    }
    
    fn op_div(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value { val_type: ValueType::Number(n1.div(n2)) });
                Ok(())
            },
            _ => Err("Type error: / requires two numbers".to_string()),
        }
    }
    
    fn op_gt(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value { val_type: ValueType::Boolean(n1.gt(n2)) });
                Ok(())
            },
            _ => Err("Type error: > requires two numbers".to_string()),
        }
    }
    
    fn op_ge(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value { val_type: ValueType::Boolean(n1.ge(n2)) });
                Ok(())
            },
            _ => Err("Type error: >= requires two numbers".to_string()),
        }
    }
    
    fn op_eq(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        let result = match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => n1.eq(n2),
            (ValueType::String(s1), ValueType::String(s2)) => s1 == s2,
            (ValueType::Boolean(b1), ValueType::Boolean(b2)) => b1 == b2,
            (ValueType::Symbol(s1), ValueType::Symbol(s2)) => s1 == s2,
            (ValueType::Nil, ValueType::Nil) => true,
            (ValueType::Vector(v1), ValueType::Vector(v2)) => v1 == v2,
            _ => false,
        };
        self.stack.push(Value { val_type: ValueType::Boolean(result) });
        Ok(())
    }
    
    fn op_lt(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value { val_type: ValueType::Boolean(n1.lt(n2)) });
                Ok(())
            },
            _ => Err("Type error: < requires two numbers".to_string()),
        }
    }
    
    fn op_le(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let b = self.stack.pop().unwrap();
        let a = self.stack.pop().unwrap();
        match (&a.val_type, &b.val_type) {
            (ValueType::Number(n1), ValueType::Number(n2)) => {
                self.stack.push(Value { val_type: ValueType::Boolean(n1.le(n2)) });
                Ok(())
            },
            _ => Err("Type error: <= requires two numbers".to_string()),
        }
    }
    
    fn op_length(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Vector(v) => {
                    self.stack.push(Value { val_type: ValueType::Number(Fraction::new(v.len() as i64, 1)) });
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
                        self.stack.push(Value { val_type: ValueType::Vector(tail) });
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
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let vec_val = self.stack.pop().unwrap();
        let elem = self.stack.pop().unwrap();
        match vec_val.val_type {
            ValueType::Vector(mut v) => {
                v.insert(0, elem);
                self.stack.push(Value { val_type: ValueType::Vector(v) });
                Ok(())
            },
            _ => Err("Type error: CONS requires an element and a vector".to_string()),
        }
    }

    fn op_append(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let elem = self.stack.pop().unwrap();
        let vec_val = self.stack.pop().unwrap();
        match vec_val.val_type {
            ValueType::Vector(mut v) => {
                v.push(elem);
                self.stack.push(Value { val_type: ValueType::Vector(v) });
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
                    self.stack.push(Value { val_type: ValueType::Vector(v) });
                    Ok(())
                },
                _ => Err("Type error: REVERSE requires a vector".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }

    fn op_nth(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 { return Err("Stack underflow".to_string()); }
        let vec_val = self.stack.pop().unwrap();
        let index_val = self.stack.pop().unwrap();
        match (&index_val.val_type, &vec_val.val_type) {
            (ValueType::Number(n), ValueType::Vector(v)) => {
                if n.denominator != 1 { return Err("NTH requires an integer index".to_string()); }
                let mut index = n.numerator;
                let len = v.len() as i64;
                if index < 0 { index = len + index; }
                if index < 0 || index >= len { return Err(format!("Index {} out of bounds for vector of length {}", n.numerator, len)); }
                self.stack.push(v[index as usize].clone());
                Ok(())
            },
            _ => Err("Type error: NTH requires a number and a vector".to_string()),
        }
    }
    
    fn op_uncons(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Vector(v) => {
                    if v.is_empty() { return Err("UNCONS of empty vector".to_string()); }
                    let mut v_mut = v;
                    let head = v_mut.remove(0);
                    self.stack.push(head);
                    self.stack.push(Value { val_type: ValueType::Vector(v_mut) });
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
                        // EACHはVectorの中身を評価せずにそのまま積む
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
                    self.stack.push(Value { val_type: ValueType::Boolean(v.is_empty()) });
                    Ok(())
                },
                _ => Err("Type error: EMPTY? requires a vector".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_if(&mut self) -> Result<(), String> {
        if self.stack.len() < 3 {
            return Err("Stack underflow for IF".to_string());
        }
        
        let else_branch = self.stack.pop().unwrap();
        let then_branch = self.stack.pop().unwrap();
        let condition = self.stack.pop().unwrap();
        
        match (&condition.val_type, &then_branch.val_type, &else_branch.val_type) {
            (ValueType::Boolean(cond), ValueType::Vector(then_vec), ValueType::Vector(else_vec)) => {
                let vec_to_execute = if *cond { then_vec } else { else_vec };
                
                let (tokens, _) = self.body_vector_to_tokens(vec_to_execute)?;
                
                self.execute_tokens_with_context(&tokens)?;
                Ok(())
            },
            _ => Err("Type error: IF requires a boolean and two vectors".to_string()),
        }
    }

    fn op_not(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::Boolean(b) => {
                    self.stack.push(Value { val_type: ValueType::Boolean(!b) });
                    Ok(())
                },
                _ => Err("Type error: NOT requires a boolean".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_del(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::String(name) => {
                    self.delete_word(&name.to_uppercase())
                },
                _ => Err("Type error: DEL requires a string".to_string()),
            }
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    // 新しい制御構造の実装
    
    fn op_map(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow for MAP".to_string());
        }
        
        let proc_val = self.stack.pop().unwrap();
        let vec_val = self.stack.pop().unwrap();
        
        match (&vec_val.val_type, &proc_val.val_type) {
            (ValueType::Vector(vec), ValueType::Vector(proc)) => {
                let mut result = Vec::new();
                
                // 各要素に対して処理を実行
                for item in vec {
                    // 要素をスタックに積む
                    self.stack.push(item.clone());
                    
                    // 処理を実行
                    let (tokens, _) = self.body_vector_to_tokens(proc)?;
                    self.execute_tokens_with_context(&tokens)?;
                    
                    // 結果を取得
                    if let Some(result_val) = self.stack.pop() {
                        result.push(result_val);
                    } else {
                        return Err("MAP: procedure produced no result".to_string());
                    }
                }
                
                self.stack.push(Value { val_type: ValueType::Vector(result) });
                Ok(())
            },
            _ => Err("Type error: MAP requires a vector and a procedure vector".to_string()),
        }
    }
    
    fn op_when(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow for WHEN".to_string());
        }
        
        let proc_val = self.stack.pop().unwrap();
        let cond_val = self.stack.pop().unwrap();
        
        match (&cond_val.val_type, &proc_val.val_type) {
            (ValueType::Boolean(cond), ValueType::Vector(proc)) => {
                if *cond {
                    let (tokens, _) = self.body_vector_to_tokens(proc)?;
                    self.execute_tokens_with_context(&tokens)?;
                }
                Ok(())
            },
            _ => Err("Type error: WHEN requires a boolean and a procedure vector".to_string()),
        }
    }
    
    fn op_unless(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow for UNLESS".to_string());
        }
        
        let proc_val = self.stack.pop().unwrap();
        let cond_val = self.stack.pop().unwrap();
        
        match (&cond_val.val_type, &proc_val.val_type) {
            (ValueType::Boolean(cond), ValueType::Vector(proc)) => {
                if !*cond {
                    let (tokens, _) = self.body_vector_to_tokens(proc)?;
                    self.execute_tokens_with_context(&tokens)?;
                }
                Ok(())
            },
            _ => Err("Type error: UNLESS requires a boolean and a procedure vector".to_string()),
        }
    }
    
    fn op_loop(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow for LOOP".to_string());
        }
        
        let body_val = self.stack.pop().unwrap();
        let cond_val = self.stack.pop().unwrap();
        
        match (&cond_val.val_type, &body_val.val_type) {
            (ValueType::Vector(cond), ValueType::Vector(body)) => {
                // 安全のため、無限ループ防止の上限を設定
                let mut iterations = 0;
                const MAX_ITERATIONS: usize = 10000;
                
                loop {
                    // 条件を評価
                    let (cond_tokens, _) = self.body_vector_to_tokens(cond)?;
                    self.execute_tokens_with_context(&cond_tokens)?;
                    
                    // 条件の結果を取得
                    if let Some(result) = self.stack.pop() {
                        match result.val_type {
                            ValueType::Boolean(false) => break,
                            ValueType::Boolean(true) => {
                                // 本体を実行
                                let (body_tokens, _) = self.body_vector_to_tokens(body)?;
                                self.execute_tokens_with_context(&body_tokens)?;
                                
                                iterations += 1;
                                if iterations > MAX_ITERATIONS {
                                    return Err("LOOP: Maximum iterations exceeded".to_string());
                                }
                            },
                            _ => return Err("LOOP: condition must produce a boolean".to_string()),
                        }
                    } else {
                        return Err("LOOP: condition produced no result".to_string());
                    }
                }
                
                Ok(())
            },
            _ => Err("Type error: LOOP requires two procedure vectors".to_string()),
        }
    }
    
    // rust/src/interpreter.rs の op_case 関数を修正

fn op_case(&mut self) -> Result<(), String> {
    if self.stack.len() < 2 {
        return Err("Stack underflow for CASE".to_string());
    }
    
    let cases_val = self.stack.pop().unwrap();
    let test_val = self.stack.pop().unwrap();
    
    match &cases_val.val_type {
        ValueType::Vector(cases) => {
            let mut matched = false; // ★ マッチしたかどうかのフラグを追加
            for case in cases {
                match &case.val_type {
                    ValueType::Vector(case_pair) => {
                        if case_pair.len() != 2 {
                            return Err("CASE: each case must be a pair [condition action]".to_string());
                        }
                        
                        // 条件部分を評価
                        match &case_pair[0].val_type {
                            ValueType::Vector(cond_proc) => {
                                // テスト値をスタックにプッシュ
                                self.stack.push(test_val.clone());
                                
                                // 条件を評価
                                let (cond_tokens, _) = self.body_vector_to_tokens(cond_proc)?;
                                self.execute_tokens_with_context(&cond_tokens)?;
                                
                                // 結果を取得
                                if let Some(result) = self.stack.pop() {
                                    match result.val_type {
                                        ValueType::Boolean(true) => {
                                            // アクション部分を実行
                                            match &case_pair[1].val_type {
                                                ValueType::Vector(action) => {
                                                    let (action_tokens, _) = self.body_vector_to_tokens(action)?;
                                                    self.execute_tokens_with_context(&action_tokens)?;
                                                    matched = true; // ★ マッチしたことを記録
                                                    return Ok(()); // ★ マッチしたら即座に終了
                                                },
                                                _ => return Err("CASE: action must be a vector".to_string()),
                                            }
                                        },
                                        ValueType::Boolean(false) => {
                                            // 次のケースへ
                                        },
                                        _ => return Err("CASE: condition must produce a boolean".to_string()),
                                    }
                                } else {
                                    return Err("CASE: condition produced no result".to_string());
                                }
                            },
                            _ => return Err("CASE: condition must be a vector".to_string()),
                        }
                    },
                    _ => return Err("CASE: each case must be a vector".to_string()),
                }
            }
            
            // ★★★ 修正箇所 ★★★
            // どのケースにもマッチしなかった場合、テスト値はスタックに残ってしまうので何もしない。
            // ユーザーがデフォルトケース `[ [ DROP true ] [ ... ] ]` を提供することで
            // 値を消費するかどうかを制御できるようにする。
            // この修正により、もしどのケースにもマッチしない場合、`test_val`はスタックに残り続けるが、
            // これはユーザーがデフォルトケースで `DROP` を使って制御すべき挙動となる。
            
            Ok(())
        },
        _ => Err("Type error: CASE requires a value and a vector of cases".to_string()),
    }
}
    
    pub fn get_stack(&self) -> &Stack { &self.stack }
    
    pub fn get_register(&self) -> &Register { &self.register }
    
    pub fn get_custom_words(&self) -> Vec<String> {
        let mut words: Vec<String> = self.dictionary
            .iter()
            .filter(|(_, def)| !def.is_builtin)
            .map(|(name, _)| name.clone())
            .collect();
        words.sort();
        words
    }
    
   pub fn get_custom_words_with_descriptions(&self) -> Vec<(String, Option<String>)> {
       let mut words: Vec<(String, Option<String>)> = self.dictionary
           .iter()
           .filter(|(_, def)| !def.is_builtin)
           .map(|(name, def)| (name.clone(), def.description.clone()))
           .collect();
       words.sort_by(|a, b| a.0.cmp(&b.0));
       words
   }
   
   pub fn get_custom_words_info(&self) -> Vec<(String, Option<String>, bool)> {
       let mut words: Vec<(String, Option<String>, bool)> = self.dictionary
           .iter()
           .filter(|(_, def)| !def.is_builtin)
           .map(|(name, def)| {
               let is_protected = self.dependencies.get(name)
                   .map_or(false, |deps| !deps.is_empty());
               (name.clone(), def.description.clone(), is_protected)
           })
           .collect();
       words.sort_by(|a, b| a.0.cmp(&b.0));
       words
   }
}
