use std::collections::{HashMap, HashSet};
use crate::types::*;
use crate::tokenizer::*;
use crate::builtins;
use web_sys::console;

// デバッグ用マクロ
macro_rules! debug_log {
    ($($arg:tt)*) => {
        console::log_1(&format!($($arg)*).into());
    };
}

// ループコンテキスト
#[derive(Debug, Clone)]
struct LoopContext {
    start_position: usize,      // ループ開始位置
    tokens: Vec<Token>,         // ループ本体のトークン
    loop_type: LoopType,        // ループの種類
}

#[derive(Debug, Clone)]
enum LoopType {
    Do,                         // 基本的なDO-LOOPループ
    Begin,                      // BEGIN-AGAIN/UNTIL/WHILEループ
}

pub struct Interpreter {
    stack: Stack,
    register: Register,
    dictionary: HashMap<String, WordDefinition>,
    dependencies: HashMap<String, HashSet<String>>,
    loop_stack: Vec<LoopContext>,              // ループコンテキストスタック
    return_stack: Vec<Value>,                  // リターンスタック（ループカウンタ用）
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
            loop_stack: Vec::new(),
            return_stack: Vec::new(),
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
        self.execute_tokens_with_context(tokens, false)
    }
    
    fn execute_tokens_with_context(&mut self, tokens: &[Token], in_vector: bool) -> Result<(), String> {
        debug_log!("execute_tokens_with_context: in_vector={}, tokens={:?}", in_vector, tokens);
        
        let mut i = 0;
        let mut _pending_description: Option<String> = None;
        
        while i < tokens.len() {
            debug_log!("Processing token[{}]: {:?}", i, tokens[i]);
            
            match &tokens[i] {
                Token::Description(text) => {
                    _pending_description = Some(text.clone());
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
                    debug_log!("Found VectorStart");
                    let (vector_tokens, consumed) = self.collect_vector(&tokens[i..])?;
                    let saved_stack = self.stack.clone();
                    self.stack.clear();
                    
                    debug_log!("Executing vector tokens with in_vector=true");
                    self.execute_tokens_with_context(&vector_tokens, true)?;
                    
                    let vector_contents = self.stack.clone();
                    self.stack = saved_stack;
                    
                    let vec_len = vector_contents.len();
                    self.stack.push(Value {
                        val_type: ValueType::Vector(vector_contents),
                    });
                    
                    debug_log!("Created vector with {} elements", vec_len);
                    
                    i += consumed - 1;
                },
                Token::Symbol(name) => {
                    debug_log!("Found Symbol: {}, in_vector={}", name, in_vector);
                    if in_vector {
                        self.stack.push(Value {
                            val_type: ValueType::Symbol(name.clone()),
                        });
                        debug_log!("Pushed symbol {} to stack", name);
                    } else {
                        debug_log!("Executing symbol: {}", name);
                        
                        // ループ制御ワードの特別処理
                        match name.as_str() {
                            "DO" => {
                                let (loop_tokens, consumed) = self.collect_do_loop(&tokens[i+1..])?;
                                self.op_do(loop_tokens)?;
                                i += consumed;
                            },
                            "BEGIN" => {
                                let (loop_tokens, end_type, consumed) = self.collect_begin_loop(&tokens[i+1..])?;
                                match end_type.as_str() {
                                    "AGAIN" => self.op_begin_again(loop_tokens)?,
                                    "UNTIL" => self.op_begin_until(loop_tokens)?,
                                    "WHILE" => {
                                        let (while_tokens, repeat_consumed) = self.collect_while_repeat(&tokens[i+1+consumed..])?;
                                        self.op_begin_while_repeat(loop_tokens, while_tokens)?;
                                        i += repeat_consumed;
                                    },
                                    _ => return Err(format!("Unknown loop end type: {}", end_type)),
                                }
                                i += consumed;
                            },
                            _ => {
                                // 通常のワード実行
                                if matches!(name.as_str(), "+" | "-" | "*" | "/" | ">" | ">=" | "=" | "<" | "<=") {
                                    self.execute_operator(name)?;
                                } else if let Some(def) = self.dictionary.get(name) {
                                    if def.is_builtin {
                                        if name == "DEF" {
                                            let mut description = None;
                                            if i + 1 < tokens.len() {
                                                if let Token::Description(text) = &tokens[i + 1] {
                                                    description = Some(text.clone());
                                                    i += 1;
                                                }
                                            }
                                            if _pending_description.is_some() {
                                                description = _pending_description.take();
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
                        }
                    }
                },
                _ => {
                    return Err(format!("Unexpected token: {:?}", tokens[i]));
                }
            }
            
            if !matches!(&tokens[i], Token::Description(_)) {
                if let Token::Symbol(s) = &tokens[i] {
                    if s != "DEF" || i == 0 || !matches!(&tokens[i-1], Token::Description(_)) {
                        _pending_description = None;
                    }
                } else {
                    _pending_description = None;
                }
            }
            
            i += 1;
        }
        
        Ok(())
    }
    
    // DO-LOOPの本体を収集
    fn collect_do_loop(&self, tokens: &[Token]) -> Result<(Vec<Token>, usize), String> {
        let mut loop_tokens = Vec::new();
        let mut depth = 1;
        let mut i = 0;
        
        while i < tokens.len() && depth > 0 {
            match &tokens[i] {
                Token::Symbol(s) if s == "DO" => depth += 1,
                Token::Symbol(s) if s == "LOOP" || s == "+LOOP" => {
                    depth -= 1;
                    if depth == 0 {
                        return Ok((loop_tokens, i + 1));
                    }
                },
                _ => {},
            }
            if depth > 0 {
                loop_tokens.push(tokens[i].clone());
            }
            i += 1;
        }
        
        Err("Unclosed DO loop".to_string())
    }
    
    // BEGIN-END構造の本体を収集
    fn collect_begin_loop(&self, tokens: &[Token]) -> Result<(Vec<Token>, String, usize), String> {
        let mut loop_tokens = Vec::new();
        let mut depth = 1;
        let mut i = 0;
        
        while i < tokens.len() && depth > 0 {
            match &tokens[i] {
                Token::Symbol(s) if s == "BEGIN" => depth += 1,
                Token::Symbol(s) if matches!(s.as_str(), "AGAIN" | "UNTIL" | "WHILE") => {
                    depth -= 1;
                    if depth == 0 {
                        return Ok((loop_tokens, s.clone(), i + 1));
                    }
                },
                _ => {},
            }
            if depth > 0 {
                loop_tokens.push(tokens[i].clone());
            }
            i += 1;
        }
        
        Err("Unclosed BEGIN loop".to_string())
    }
    
    // WHILE-REPEATの本体を収集
    fn collect_while_repeat(&self, tokens: &[Token]) -> Result<(Vec<Token>, usize), String> {
        let mut while_tokens = Vec::new();
        let mut i = 0;
        
        while i < tokens.len() {
            if let Token::Symbol(s) = &tokens[i] {
                if s == "REPEAT" {
                    return Ok((while_tokens, i + 1));
                }
            }
            while_tokens.push(tokens[i].clone());
            i += 1;
        }
        
        Err("WHILE without REPEAT".to_string())
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
    
    fn value_to_tokens(&self, value: &Value) -> Result<Vec<Token>, String> {
        match &value.val_type {
            ValueType::Number(n) => {
                Ok(vec![Token::Number(n.numerator, n.denominator)])
            },
            ValueType::String(s) => {
                Ok(vec![Token::String(s.clone())])
            },
            ValueType::Boolean(b) => {
                Ok(vec![Token::Boolean(*b)])
            },
            ValueType::Symbol(s) => {
                Ok(vec![Token::Symbol(s.clone())])
            },
            ValueType::Nil => {
                Ok(vec![Token::Nil])
            },
            ValueType::Vector(v) => {
                let mut tokens = vec![Token::VectorStart];
                for elem in v {
                    let elem_tokens = self.value_to_tokens(elem)?;
                    tokens.extend(elem_tokens);
                }
                tokens.push(Token::VectorEnd);
                Ok(tokens)
            },
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
            "I" => self.op_i()?,
            "J" => self.op_j()?,
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
    
    // ループプリミティブ
    fn op_do(&mut self, loop_body: Vec<Token>) -> Result<(), String> {
        if self.stack.len() < 2 {
            return Err("Stack underflow for DO".to_string());
        }
        
        let limit = self.stack.pop().unwrap();
        let start = self.stack.pop().unwrap();
        
        match (&start.val_type, &limit.val_type) {
            (ValueType::Number(s), ValueType::Number(l)) => {
                if s.denominator != 1 || l.denominator != 1 {
                    return Err("DO requires integer bounds".to_string());
                }
                
                // リターンスタックに限界値と現在値をプッシュ
                self.return_stack.push(Value {
                    val_type: ValueType::Number(Fraction::new(l.numerator, 1)),
                });
                
                let mut index = s.numerator;
                while index < l.numerator {
                    // 現在のインデックスをリターンスタックに
                    self.return_stack.push(Value {
                        val_type: ValueType::Number(Fraction::new(index, 1)),
                    });
                    
                    // ループ本体を実行
                    self.execute_tokens(&loop_body)?;
                    
                    // インデックスをリターンスタックから取り出し
                    self.return_stack.pop();
                    index += 1;
                }
                
                // 限界値をリターンスタックから削除
                self.return_stack.pop();
                
                Ok(())
            },
            _ => Err("Type error: DO requires two numbers".to_string()),
        }
    }
    
    fn op_begin_again(&mut self, loop_body: Vec<Token>) -> Result<(), String> {
        // 無限ループ（実際には安全のため上限を設ける）
        let mut count = 0;
        const MAX_ITERATIONS: i32 = 100000;
        
        loop {
            self.execute_tokens(&loop_body)?;
            
            count += 1;
            if count > MAX_ITERATIONS {
                return Err("Loop exceeded maximum iterations".to_string());
            }
        }
    }
    
    fn op_begin_until(&mut self, loop_body: Vec<Token>) -> Result<(), String> {
        let mut count = 0;
        const MAX_ITERATIONS: i32 = 100000;
        
        loop {
            self.execute_tokens(&loop_body)?;
            
            if self.stack.is_empty() {
                return Err("UNTIL requires a boolean on the stack".to_string());
            }
            
            let condition = self.stack.pop().unwrap();
            match condition.val_type {
                ValueType::Boolean(true) => break,
                ValueType::Boolean(false) => {},
                _ => return Err("UNTIL requires a boolean".to_string()),
            }
            
            count += 1;
            if count > MAX_ITERATIONS {
                return Err("Loop exceeded maximum iterations".to_string());
            }
        }
        
        Ok(())
    }
    
    fn op_begin_while_repeat(&mut self, condition_body: Vec<Token>, loop_body: Vec<Token>) -> Result<(), String> {
        let mut count = 0;
        const MAX_ITERATIONS: i32 = 100000;
        
        loop {
            // 条件部を実行
            self.execute_tokens(&condition_body)?;
            
            if self.stack.is_empty() {
                return Err("WHILE requires a boolean on the stack".to_string());
            }
            
            let condition = self.stack.pop().unwrap();
            match condition.val_type {
                ValueType::Boolean(true) => {
                    // ループ本体を実行
                    self.execute_tokens(&loop_body)?;
                },
                ValueType::Boolean(false) => break,
                _ => return Err("WHILE requires a boolean".to_string()),
            }
            
            count += 1;
            if count > MAX_ITERATIONS {
                return Err("Loop exceeded maximum iterations".to_string());
            }
        }
        
        Ok(())
    }
    
    // ループインデックスアクセス
    fn op_i(&mut self) -> Result<(), String> {
        if self.return_stack.is_empty() {
            return Err("I used outside of loop".to_string());
        }
        
        let index = self.return_stack.last().unwrap().clone();
        self.stack.push(index);
        Ok(())
    }
    
    fn op_j(&mut self) -> Result<(), String> {
        if self.return_stack.len() < 3 {
            return Err("J used outside of nested loop".to_string());
        }
        
        let index = self.return_stack[self.return_stack.len() - 3].clone();
        self.stack.push(index);
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
    
    // ワードの削除
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
    
    // レジスタ操作（リターンスタックを使用）
    fn op_to_r(&mut self) -> Result<(), String> {
        if let Some(val) = self.stack.pop() {
            self.return_stack.push(val);
            Ok(())
        } else {
            Err("Stack underflow".to_string())
        }
    }
    
    fn op_from_r(&mut self) -> Result<(), String> {
        if let Some(val) = self.return_stack.pop() {
            self.stack.push(val);
            Ok(())
        } else {
            Err("Return stack underflow".to_string())
        }
    }
    
    fn op_r_fetch(&mut self) -> Result<(), String> {
        if let Some(val) = self.return_stack.last() {
            self.stack.push(val.clone());
            Ok(())
        } else {
            Err("Return stack is empty".to_string())
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
        
        let vector = self.stack.pop().unwrap();
        let elem = self.stack.pop().unwrap();
        
        match vector.val_type {
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
                    let old_def = self.dictionary.get(&name).unwrap();
                    let old_deps = Self::collect_dependencies(&old_def.tokens);
                    for dep in old_deps {
                        if let Some(deps) = self.dependencies.get_mut(&dep) {
                            deps.remove(&name);
                        }
                    }
                }
                
                let mut tokens = Vec::new();
                let mut used_words = HashSet::new();
                
                for val in body {
                    let val_tokens = self.value_to_tokens(val)?;
                    
                    for token in &val_tokens {
                        if let Token::Symbol(s) = token {
                            if self.dictionary.contains_key(s) && !self.dictionary.get(s).unwrap().is_builtin {
                                used_words.insert(s.clone());
                            }
                        }
                    }
                    
                    tokens.extend(val_tokens);
                }
                
                for used_word in &used_words {
                    self.dependencies
                        .entry(used_word.clone())
                        .or_insert_with(HashSet::new)
                        .insert(name.clone());
                }
                
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
   
    fn op_if(&mut self) -> Result<(), String> {
        if self.stack.len() < 3 {
            return Err("Stack underflow for IF".to_string());
        }
        
        let else_branch = self.stack.pop().unwrap();
        let then_branch = self.stack.pop().unwrap();
        let condition = self.stack.pop().unwrap();
        
        match (&condition.val_type, &then_branch.val_type, &else_branch.val_type) {
            (ValueType::Boolean(cond), ValueType::Vector(_), ValueType::Vector(_)) => {
                let branch = if *cond { then_branch } else { else_branch };
                
                let tokens = self.value_to_tokens(&branch)?;
                self.execute_tokens_with_context(&tokens, false)?;
                
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
                    let prefix = prefix.to_uppercase();
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
                    .map(|deps| !deps.is_empty())
                    .unwrap_or(false);
                
                (name.clone(), def.description.clone(), is_protected)
            })
            .collect();
        words.sort_by(|a, b| a.0.cmp(&b.0));
        words
    }
   
    pub fn get_dependencies(&self, word: &str) -> Vec<String> {
        if let Some(deps) = self.dependencies.get(word) {
            deps.iter().cloned().collect()
        } else {
            Vec::new()
        }
    }
}
