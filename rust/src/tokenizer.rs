use crate::types::*;

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Number(i64),
    String(String),
    Boolean(bool),
    Symbol(String),
    Operator(String),
    VectorStart,
    VectorEnd,
    Nil,
    Comment(String),
}

pub fn tokenize(input: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let mut chars = input.chars().peekable();
    
    while let Some(&ch) = chars.peek() {
        if ch.is_whitespace() {
            chars.next();
            continue;
        }
        
        // コメント処理
        if ch == '(' {
            chars.next();
            let mut comment = String::new();
            while let Some(&ch) = chars.peek() {
                if ch == ')' {
                    chars.next();
                    break;
                }
                comment.push(ch);
                chars.next();
            }
            tokens.push(Token::Comment(comment));
            continue;
        }
        
        // 型プレフィックス付きトークン
        let mut word = String::new();
        while let Some(&ch) = chars.peek() {
            if ch.is_whitespace() || ch == '(' {
                break;
            }
            word.push(ch);
            chars.next();
        }
        
        if word.contains(':') {
            let parts: Vec<&str> = word.splitn(2, ':').collect();
            if parts.len() == 2 {
                let type_prefix = parts[0];
                let value = parts[1];
                
                match type_prefix {
                    "number" => {
                        if let Ok(n) = value.parse::<i64>() {
                            tokens.push(Token::Number(n));
                        } else {
                            return Err(format!("Invalid number: {}", value));
                        }
                    },
                    "string" => {
                        tokens.push(Token::String(value.to_string()));
                    },
                    "boolean" => {
                        match value {
                            "TRUE" | "true" => tokens.push(Token::Boolean(true)),
                            "FALSE" | "false" => tokens.push(Token::Boolean(false)),
                            _ => return Err(format!("Invalid boolean: {}", value)),
                        }
                    },
                    "symbol" => {
                        tokens.push(Token::Symbol(value.to_string()));
                    },
                    "operator" => {
                        tokens.push(Token::Operator(value.to_string()));
                    },
                    "vector" => {
                        match value {
                            "[" => tokens.push(Token::VectorStart),
                            "]" => tokens.push(Token::VectorEnd),
                            _ => return Err(format!("Invalid vector token: {}", value)),
                        }
                    },
                    "nil" => {
                        tokens.push(Token::Nil);
                    },
                    _ => {
                        return Err(format!("Unknown type prefix: {}", type_prefix));
                    }
                }
            } else {
                return Err(format!("Invalid token format: {}", word));
            }
        } else {
            return Err(format!("Token must have type prefix: {}", word));
        }
    }
    
    Ok(tokens)
}
