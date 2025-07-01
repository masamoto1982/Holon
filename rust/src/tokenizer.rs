#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Number(i64, i64),  // 分子, 分母
    String(String),
    Boolean(bool),
    Symbol(String),
    VectorStart,
    VectorEnd,
    Nil,
    Description(String),
}

pub fn tokenize(input: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let mut chars = input.chars().peekable();
    
    while let Some(&ch) = chars.peek() {
        // 空白をスキップ
        if ch.is_whitespace() {
            chars.next();
            continue;
        }
        
        // 行コメント処理（#から行末まで）
        if ch == '#' {
            chars.next();
            while let Some(&ch) = chars.peek() {
                chars.next();
                if ch == '\n' {
                    break;
                }
            }
            continue;
        }
        
        // 説明文処理（DEF用）
        if ch == '(' {
            chars.next();
            let mut description = String::new();
            while let Some(&ch) = chars.peek() {
                chars.next();
                if ch == ')' {
                    break;
                }
                description.push(ch);
            }
            tokens.push(Token::Description(description.trim().to_string()));
            continue;
        }
        
        // 文字列リテラル
        if ch == '"' {
            chars.next();
            let mut string = String::new();
            let mut escaped = false;
            
            while let Some(&ch) = chars.peek() {
                chars.next();
                if escaped {
                    string.push(ch);
                    escaped = false;
                } else if ch == '\\' {
                    escaped = true;
                } else if ch == '"' {
                    break;
                } else {
                    string.push(ch);
                }
            }
            tokens.push(Token::String(string));
            continue;
        }
        
        // ベクトル開始/終了
        if ch == '[' {
            chars.next();
            tokens.push(Token::VectorStart);
            continue;
        }
        
        if ch == ']' {
            chars.next();
            tokens.push(Token::VectorEnd);
            continue;
        }
        
        // その他のトークン（数値、真偽値、NIL、シンボル）
        let mut word = String::new();
        while let Some(&ch) = chars.peek() {
            if ch.is_whitespace() || ch == '(' || ch == '[' || ch == ']' || ch == '"' || ch == '#' {
                break;
            }
            word.push(ch);
            chars.next();
        }
        
        if word.is_empty() {
            continue;
        }
        
        // 数値の判定（整数と小数）
        if let Ok(num) = word.parse::<i64>() {
            tokens.push(Token::Number(num, 1));
        } else if word.contains('.') {
            // 小数点を含む場合、分数に変換
            let parts: Vec<&str> = word.split('.').collect();
            if parts.len() == 2 {
                if let (Ok(integer), Ok(decimal)) = (parts[0].parse::<i64>(), parts[1].parse::<i64>()) {
                    let decimal_places = parts[1].len() as u32;
                    let denominator = 10_i64.pow(decimal_places);
                    let numerator = integer * denominator + decimal;
                    tokens.push(Token::Number(numerator, denominator));
                } else {
                    return Err(format!("Invalid number: {}", word));
                }
            } else {
                return Err(format!("Invalid number: {}", word));
            }
        } else {
            // その他のトークン
            match word.as_str() {
                "true" => tokens.push(Token::Boolean(true)),
                "false" => tokens.push(Token::Boolean(false)),
                "NIL" => tokens.push(Token::Nil),
                _ => {
                    // シンボルは大文字に正規化
                    tokens.push(Token::Symbol(word.to_uppercase()))
                },
            }
        }
    }
    
    Ok(tokens)
}
