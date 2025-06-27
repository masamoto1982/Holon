use std::collections::HashMap;
use crate::types::*;
use crate::tokenizer::*;
use crate::builtins;

// デバッグ用マクロ
#[cfg(target_arch = "wasm32")]
macro_rules! console_log {
    ($($t:tt)*) => {
        web_sys::console::log_1(&format!($($t)*).into());
    }
}

#[cfg(not(target_arch = "wasm32"))]
macro_rules! console_log {
    ($($t:tt)*) => {
        println!($($t)*);
    }
}

pub struct Interpreter {
    stack: Stack,
    register: Register,
    dictionary: HashMap<String, WordDefinition>,
}

pub struct WordDefinition {
    pub tokens: Vec<Token>,
    pub is_builtin: bool,
}

impl Interpreter {
    pub fn new() -> Self {
        let mut interpreter = Interpreter {
            stack: Vec::new(),
            register: None,
            dictionary: HashMap::new(),
        };
        
        // 組み込みワードを登録
        builtins::register_builtins(&mut interpreter.dictionary);
        
        interpreter
    }
    
    pub fn execute(&mut self, code: &str) -> Result<(), String> {
        console_log!("=== Execute: {}", code);
        let tokens = tokenize(code)?;
        console_log!("Tokens: {:?}", tokens);
        self.execute_tokens_with_context(&tokens, false)?;
        console_log!("Stack after execution: {:?}", self.stack);
        Ok(())
    }
    
    pub fn execute_tokens(&mut self, tokens: &[Token]) -> Result<(), String> {
        self.execute_tokens_with_context(tokens, false)
    }
    
    fn execute_tokens_with_context(&mut self, tokens: &[Token], in_vector: bool) -> Result<(), String> {
        let mut i = 0;
        console_log!("Execute tokens with context: in_vector={}, tokens={:?}", in_vector, tokens);
        
        while i < tokens.len() {
            console_log!("Processing token[{}]: {:?}, stack: {:?}", i, tokens[i], self.stack);
            
            match &tokens[i] {
                Token::Comment(_) => {
                    // コメントは無視
                },
                Token::Number(n) => {
                    self.stack.push(Value {
                        val_type: ValueType::Number(Fraction::new(*n, 1)),
                    });
                    console_log!("Pushed number: {}", n);
                },
                Token::String(s) => {
                    self.stack.push(Value {
                        val_type: ValueType::String(s.clone()),
                    });
                    console_log!("Pushed string: {}", s);
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
                    console_log!("Vector start");
                    let (vector_tokens, consumed) = self.collect_vector(&tokens[i..])?;
                    console_log!("Collected vector tokens: {:?}", vector_tokens);
                    let saved_stack = self.stack.clone();
                    self.stack.clear();
                    
                    // ベクトル内のトークンを実行（ベクトルコンテキストで）
                    self.execute_tokens_with_context(&vector_tokens, true)?;
                    
                    let vector_contents = self.stack.clone();
                    console_log!("Vector contents: {:?}", vector_contents);
                    self.stack = saved_stack;
                    
                    self.stack.push(Value {
                        val_type: ValueType::Vector(vector_contents),
                    });
                    
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
        if let Some(def) = self.dictionary.get(name) {
            if def.is_builtin {
                self.execute_builtin(name)?;
            } else {
                // カスタムワードの実行時は、in_vectorをfalseで実行
                // (カスタムワード内のトークンは通常のコンテキストで実行される)
                self.execute_tokens_with_context(&def.tokens.clone(), false)?;
            }
        } else {
            return Err(format!("Unknown word: {}", name));
        }
    }
},
                Token::Operator(op) => {
                    if in_vector {
                        // ベクトル内ではシンボルとしてスタックに積む
                        self.stack.push(Value {
                            val_type: ValueType::Symbol(op.clone()),
                        });
                        console_log!("Pushed operator as symbol in vector: {}", op);
                    } else {
                        // 通常のコンテキストでは実行
                        console_log!("Executing operator: {}", op);
                        self.execute_operator(op)?;
                    }
                },
                _ => {
                    return Err(format!("Unexpected token: {:?}", tokens[i]));
                }
            }
            i += 1;
        }
        
        Ok(())
    }
    
    // op_def関数も修正してデバッグログを追加
    fn op_def(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err(format!("Stack underflow for DEF. Stack has {} items", self.stack.len()));
        }
        
        let name_val = self.stack.pop().unwrap();
        let body_val = self.stack.pop().unwrap();
        
        // デバッグ情報をエラーとして返す（一時的）
        return Err(format!("DEBUG - DEF: name={:?}, body={:?}", name_val, body_val));
        
        console_log!("DEF: name_val = {:?}", name_val);
        console_log!("DEF: body_val = {:?}", body_val);
        
        match (&name_val.val_type, &body_val.val_type) {
            (ValueType::String(name), ValueType::Vector(body)) => {
                // ベクトルの内容をトークンに変換
                let mut tokens = Vec::new();
                for val in body {
                    console_log!("DEF: converting value to token: {:?}", val);
                    match &val.val_type {
                        ValueType::Number(n) => {
                            tokens.push(Token::Number(n.numerator));
                        },
                        ValueType::String(s) => {
                            tokens.push(Token::String(s.clone()));
                        },
                        ValueType::Boolean(b) => {
                            tokens.push(Token::Boolean(*b));
                        },
                        ValueType::Symbol(s) => {
                            // オペレーターかどうかチェック
                            if matches!(s.as_str(), "+" | "-" | "*" | "/" | ">" | ">=" | "=" | "<" | "<=") {
                                tokens.push(Token::Operator(s.clone()));
                                console_log!("DEF: {} is operator", s);
                            } else {
                                tokens.push(Token::Symbol(s.clone()));
                                console_log!("DEF: {} is symbol", s);
                            }
                        },
                        ValueType::Nil => {
                            tokens.push(Token::Nil);
                        },
                        _ => return Err("Unsupported value type in word definition".to_string()),
                    }
                }
                
                console_log!("DEF: definition tokens = {:?}", tokens);
                
                self.dictionary.insert(name.clone(), WordDefinition {
                    tokens,
                    is_builtin: false,
                });
                console_log!("DEF: defined word '{}'", name);
                Ok(())
            },
            _ => Err("Type error: DEF requires a vector and a string".to_string()),
        }
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
            "REVERSE" => self.op_reverse()?,
            "NTH" => self.op_nth()?,
            "WORDS" => self.op_words()?,
            "WORDS?" => self.op_words_filter()?,
            _ => return Err(format!("Unknown builtin: {}", name)),
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
    
    // 制御構造
    fn op_def(&mut self) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow for DEF".to_string());
        }
        
        let name_val = self.stack.pop().unwrap();
        let body_val = self.stack.pop().unwrap();
        
        match (&name_val.val_type, &body_val.val_type) {
            (ValueType::String(name), ValueType::Vector(body)) => {
                // ベクトルの内容をトークンに変換
                let mut tokens = Vec::new();
                for val in body {
                    match &val.val_type {
                        ValueType::Number(n) => {
                            tokens.push(Token::Number(n.numerator));
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
                        _ => return Err("Unsupported value type in word definition".to_string()),
                    }
                }
                
                self.dictionary.insert(name.clone(), WordDefinition {
                    tokens,
                    is_builtin: false,
                });
                Ok(())
            },
            _ => Err("Type error: DEF requires a vector and a string".to_string()),
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
            (ValueType::Boolean(cond), ValueType::Vector(then_tokens), ValueType::Vector(else_tokens)) => {
                let tokens_to_execute = if *cond { then_tokens } else { else_tokens };
                
                // ベクトルの内容を実行
                for val in tokens_to_execute {
                    self.stack.push(val.clone());
                }
                Ok(())
            },
            _ => Err("Type error: IF requires a boolean and two vectors".to_string()),
        }
    }
    
    // 辞書操作
    fn op_words(&mut self) -> Result<(), String> {
        let mut words: Vec<String> = self.dictionary.keys().cloned().collect();
        words.sort();
        
        for word in words {
            self.stack.push(Value {
                val_type: ValueType::String(word),
            });
        }
        Ok(())
    }
    
    fn op_words_filter(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            match val.val_type {
                ValueType::String(prefix) => {
                    let mut words: Vec<String> = self.dictionary
                        .keys()
                        .filter(|k| k.starts_with(&prefix))
                        .cloned()
                        .collect();
                    words.sort();
                    
                    for word in words {
                        self.stack.push(Value {
                            val_type: ValueType::String(word),
                        });
                    }
                    Ok(())
                },
                _ => Err("Type error: WORDS? requires a string".to_string()),
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
}
