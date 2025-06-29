#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Number(i64, i64),  // 分子, 分母
    String(String),
    Boolean(bool),
    Symbol(String),
    VectorStart,
    VectorEnd,
    Nil,
    Comment(String),
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
        
        // コメント処理
        if ch == '(' {
            chars.next();
            let mut comment = String::new();
            while let Some(&ch) = chars.peek() {
                chars.next();
                if ch == ')' {
                    break;
                }
                comment.push(ch);
            }
            tokens.push(Token::Comment(comment));
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
            if ch.is_whitespace() || ch == '(' || ch == '[' || ch == ']' || ch == '"' {
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
                _ => tokens.push(Token::Symbol(word)),
            }
        }
    }
    
    Ok(tokens)
}
