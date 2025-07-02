use std::fmt;
use crate::tokenizer::Token;

#[derive(Debug, Clone, PartialEq)]
pub struct Value {
    pub val_type: ValueType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ValueType {
    // 即値（遅延評価しない基本型）
    Number(Fraction),
    String(String),
    Boolean(bool),
    Nil,
    
    // 遅延評価される型
    Symbol(String),        // シンボルも遅延評価
    Vector(LazyVector),    // ベクトルは常に遅延評価
    Thunk(Thunk),          // 計算サンク
    Application(Box<Value>, Vec<Value>), // 関数適用も遅延
}

#[derive(Debug, Clone, PartialEq)]
pub struct Fraction {
    pub numerator: i64,
    pub denominator: i64,
}

// 遅延評価されるベクトル
#[derive(Debug, Clone, PartialEq)]
pub struct LazyVector {
    pub elements: Vec<Thunk>,
    pub is_infinite: bool,
    pub generator: Option<Box<Thunk>>, // 無限リスト用のジェネレータ
}

// 計算サンク（未評価の計算）
#[derive(Debug, Clone, PartialEq)]
pub struct Thunk {
    pub computation: Computation,
    pub environment: Option<Vec<Value>>,
    pub is_evaluated: bool,
    pub cached_result: Option<Box<Value>>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Computation {
    // 基本的な計算
    Literal(Value),                    // リテラル値
    TokenSequence(Vec<Token>),         // トークン列の実行
    BuiltinOp(String, Vec<Thunk>),     // 組み込み演算
    
    // 遅延ベクトル操作
    VectorConstruction(Vec<Thunk>),    // ベクトル構築
    VectorAccess(Box<Thunk>, Box<Thunk>), // インデックスアクセス
    
    // 制御フロー
    Conditional(Box<Thunk>, Box<Thunk>, Box<Thunk>), // 条件分岐
    
    // 無限構造
    InfiniteRange(i64, i64),           // 無限範囲
    InfiniteCycle(Vec<Value>),         // 無限循環
    InfiniteRepeat(Box<Value>),        // 無限反復
}

impl Thunk {
    pub fn new(computation: Computation) -> Self {
        Thunk {
            computation,
            environment: None,
            is_evaluated: false,
            cached_result: None,
        }
    }
    
    pub fn with_environment(computation: Computation, env: Vec<Value>) -> Self {
        Thunk {
            computation,
            environment: Some(env),
            is_evaluated: false,
            cached_result: None,
        }
    }
    
    pub fn literal(value: Value) -> Self {
        Thunk::new(Computation::Literal(value))
    }
}

impl LazyVector {
    pub fn new(elements: Vec<Thunk>) -> Self {
        LazyVector {
            elements,
            is_infinite: false,
            generator: None,
        }
    }
    
    pub fn infinite_range(start: i64, end: i64) -> Self {
        LazyVector {
            elements: Vec::new(),
            is_infinite: true,
            generator: Some(Box::new(Thunk::new(Computation::InfiniteRange(start, end)))),
        }
    }
    
    pub fn infinite_cycle(pattern: Vec<Value>) -> Self {
        LazyVector {
            elements: Vec::new(),
            is_infinite: true,
            generator: Some(Box::new(Thunk::new(Computation::InfiniteCycle(pattern)))),
        }
    }
}

// 残りのFractionの実装は同じ...
impl Fraction {
    pub fn new(numerator: i64, denominator: i64) -> Self {
        if denominator == 0 {
            panic!("Division by zero");
        }
        
        let gcd = Self::gcd(numerator.abs(), denominator.abs());
        let mut num = numerator / gcd;
        let mut den = denominator / gcd;
        
        if den < 0 {
            num = -num;
            den = -den;
        }
        
        Fraction {
            numerator: num,
            denominator: den,
        }
    }
    
    fn gcd(a: i64, b: i64) -> i64 {
        if b == 0 { a } else { Self::gcd(b, a % b) }
    }
    
    pub fn add(&self, other: &Fraction) -> Fraction {
        let num = self.numerator * other.denominator + other.numerator * self.denominator;
        let den = self.denominator * other.denominator;
        Fraction::new(num, den)
    }
    
    pub fn sub(&self, other: &Fraction) -> Fraction {
        let num = self.numerator * other.denominator - other.numerator * self.denominator;
        let den = self.denominator * other.denominator;
        Fraction::new(num, den)
    }
    
    pub fn mul(&self, other: &Fraction) -> Fraction {
        let num = self.numerator * other.numerator;
        let den = self.denominator * other.denominator;
        Fraction::new(num, den)
    }
    
    pub fn div(&self, other: &Fraction) -> Fraction {
        if other.numerator == 0 {
            panic!("Division by zero");
        }
        let num = self.numerator * other.denominator;
        let den = self.denominator * other.numerator;
        Fraction::new(num, den)
    }
    
    pub fn gt(&self, other: &Fraction) -> bool {
        self.numerator * other.denominator > other.numerator * self.denominator
    }
    
    pub fn ge(&self, other: &Fraction) -> bool {
        self.numerator * other.denominator >= other.numerator * self.denominator
    }
    
    pub fn eq(&self, other: &Fraction) -> bool {
        self.numerator * other.denominator == other.numerator * self.denominator
    }
    
    pub fn lt(&self, other: &Fraction) -> bool {
        self.numerator * other.denominator < other.numerator * self.denominator
    }
    
    pub fn le(&self, other: &Fraction) -> bool {
        self.numerator * other.denominator <= other.numerator * self.denominator
    }
}

impl fmt::Display for Value {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.val_type {
            ValueType::Number(n) => {
                if n.denominator == 1 {
                    write!(f, "{}", n.numerator)
                } else {
                    write!(f, "{}/{}", n.numerator, n.denominator)
                }
            },
            ValueType::String(s) => write!(f, "\"{}\"", s),
            ValueType::Boolean(b) => write!(f, "{}", b),
            ValueType::Symbol(s) => write!(f, "{}", s),
            ValueType::Vector(_) => write!(f, "<lazy-vector>"),
            ValueType::Nil => write!(f, "nil"),
            ValueType::Thunk(_) => write!(f, "<thunk>"),
            ValueType::Application(_, _) => write!(f, "<application>"),
        }
    }
}

pub type Stack = Vec<Value>;
pub type Register = Option<Value>;
