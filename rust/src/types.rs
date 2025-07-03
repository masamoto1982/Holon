use std::fmt;
use std::rc::Rc;
use std::cell::RefCell;

#[derive(Debug, Clone, PartialEq)]
pub struct Value {
    pub val_type: ValueType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ValueType {
    Number(Fraction),
    String(String),
    Boolean(bool),
    Symbol(String),
    Vector(Vec<Value>),
    Nil,
    Thunk(Rc<RefCell<Thunk>>),  // 遅延評価のためのサンク
}

#[derive(Debug, Clone, PartialEq)]
pub struct Thunk {
    pub computation: ThunkComputation,
    pub forced: bool,
    pub result: Option<Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ThunkComputation {
    Literal(Value),
    Symbol(String),
    Vector(Vec<Value>),
    // Tokensの代わりにVectorを使う（実行時に解釈）
    Expression(Vec<Value>),  // ベクトルとして保存
    Application {
        function: String,
        args: Vec<Value>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct Fraction {
    pub numerator: i64,
    pub denominator: i64,
}

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
            ValueType::Vector(v) => {
                write!(f, "[ ")?;
                for (i, item) in v.iter().enumerate() {
                    if i > 0 { write!(f, " ")?; }
                    write!(f, "{}", item)?;
                }
                write!(f, " ]")
            },
            ValueType::Nil => write!(f, "nil"),
            ValueType::Thunk(_) => write!(f, "<thunk>"),
        }
    }
}

pub type Stack = Vec<Value>;
pub type Register = Option<Value>;

// サンクを作成するヘルパー関数
impl Thunk {
    pub fn new(computation: ThunkComputation) -> Rc<RefCell<Self>> {
        Rc::new(RefCell::new(Thunk {
            computation,
            forced: false,
            result: None,
        }))
    }
}

impl Value {
    pub fn thunk(computation: ThunkComputation) -> Self {
        Value {
            val_type: ValueType::Thunk(Thunk::new(computation)),
        }
    }
}
