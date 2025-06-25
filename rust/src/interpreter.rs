use std::collections::HashMap;
use std::rc::Rc;
use crate::types::*;
use crate::tokenizer::*;
use crate::builtins;

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
        let tokens = tokenize(code)?;
        self.execute_tokens(&tokens)?;
        Ok(())
    }
    
    pub fn execute_tokens(&mut self, tokens: &[Token]) -> Result<(), String> {
        let mut i = 0;
        
        while i < tokens.len() {
            match &tokens[i] {
                Token::Comment(_) => {
                    // コメントは無視
                },
                Token::Number(n) => {
                    self.stack.push(Value {
                        val_type: ValueType::Number(Fraction::new(*n, 1)),
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
                    let mut saved_stack = self.stack.clone();
                    self.stack.clear();
                    
                    self.execute_tokens(&vector_tokens)?;
                    
                    let vector_contents = self.stack.clone();
                    self.stack = saved_stack;
                    
                    self.stack.push(Value {
                        val_type: ValueType::Vector(vector_contents),
                    });
                    
                    i += consumed - 1;
                },
                Token::Symbol(name) => {
                    if let Some(def) = self.dictionary.get(name) {
                        if def.is_builtin {
                            self.execute_builtin(name)?;
                        } else {
                            self.execute_tokens(&def.tokens.clone())?;
                        }
                    } else {
                        return Err(format!("Unknown word: {}", name));
                    }
                },
                Token::Operator(op) => {
                    self.execute_operator(op)?;
                },
                _ => {
                    return Err(format!("Unexpected token: {:?}", tokens[i]));
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
            "REVERSE" => self.op_reverse()?,
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
                
                self.dictionary.insert(name
