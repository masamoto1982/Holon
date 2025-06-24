use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Fraction {
    numerator: i64,
    denominator: i64,
}

#[wasm_bindgen]
impl Fraction {
    #[wasm_bindgen(constructor)]
    pub fn new(numerator: i64, denominator: i64) -> Fraction {
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
    
    #[wasm_bindgen(getter)]
    pub fn numerator(&self) -> i64 {
        self.numerator
    }
    
    #[wasm_bindgen(getter)]
    pub fn denominator(&self) -> i64 {
        self.denominator
    }
}
