use wasm_bindgen::prelude::*;

mod types;
mod tokenizer;
mod interpreter;
mod builtins;

use types::*;
use interpreter::*;

#[wasm_bindgen]
pub struct AjisaiInterpreter {
    interpreter: Interpreter,
}

#[wasm_bindgen]
impl AjisaiInterpreter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        AjisaiInterpreter {
            interpreter: Interpreter::new(),
        }
    }

    #[wasm_bindgen]
    pub fn get_custom_words_with_descriptions(&self) -> JsValue {
        let words = self.interpreter.get_custom_words_with_descriptions();
        let arr = js_sys::Array::new();
        
        for (name, desc) in words {
            let word_arr = js_sys::Array::new();
            word_arr.push(&JsValue::from_str(&name));
            word_arr.push(&desc.map(|d| JsValue::from_str(&d)).unwrap_or(JsValue::NULL));
            arr.push(&word_arr);
        }
        
        arr.into()
    }

    #[wasm_bindgen]
    pub fn execute(&mut self, code: &str) -> Result<String, String> {
        match self.interpreter.execute(code) {
            Ok(()) => Ok("OK".to_string()),
            Err(e) => Err(e.to_string()),
        }
    }

    #[wasm_bindgen]
    pub fn get_stack(&self) -> JsValue {
        let stack_values: Vec<JsValue> = self.interpreter
            .get_stack()
            .iter()
            .map(|v| value_to_js(v))
            .collect();
        
        let arr = js_sys::Array::new();
        for val in stack_values {
            arr.push(&val);
        }
        arr.into()
    }

    #[wasm_bindgen]
    pub fn get_register(&self) -> JsValue {
        match self.interpreter.get_register() {
            Some(v) => value_to_js(v),
            None => JsValue::NULL,
        }
    }

    #[wasm_bindgen]
    pub fn get_custom_words(&self) -> Vec<String> {
        self.interpreter.get_custom_words()
    }

    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.interpreter = Interpreter::new();
    }

    #[wasm_bindgen]
    pub fn get_custom_words_info(&self) -> JsValue {
        let words_info = self.interpreter.get_custom_words_info();
        let arr = js_sys::Array::new();
        
        for (name, desc, protected) in words_info {
            let word_arr = js_sys::Array::new();
            word_arr.push(&JsValue::from_str(&name));
            word_arr.push(&desc.map(|d| JsValue::from_str(&d)).unwrap_or(JsValue::NULL));
            word_arr.push(&JsValue::from_bool(protected));
            arr.push(&word_arr);
        }
        
        arr.into()
    }
}

fn value_to_js(value: &Value) -> JsValue {
    let obj = js_sys::Object::new();
    
    let type_str = match &value.val_type {
        ValueType::Number(_) => "number",
        ValueType::String(_) => "string",
        ValueType::Boolean(_) => "boolean",
        ValueType::Symbol(_) => "symbol",
        ValueType::Vector(_) => "vector",
        ValueType::Nil => "nil",
    };
    
    js_sys::Reflect::set(&obj, &"type".into(), &type_str.into()).unwrap();
    
    let val = match &value.val_type {
        ValueType::Number(n) => {
            if n.denominator == 1 {
                // i64をf64に変換してからJsValueに変換
                // JavaScriptの数値として安全に扱える範囲内であることを確認
                if n.numerator >= -(1i64 << 53) && n.numerator <= (1i64 << 53) {
                    JsValue::from_f64(n.numerator as f64)
                } else {
                    // 大きすぎる数値は文字列として返す
                    JsValue::from_str(&n.numerator.to_string())
                }
            } else {
                JsValue::from_str(&format!("{}/{}", n.numerator, n.denominator))
            }
        },
        ValueType::String(s) => JsValue::from_str(s),
        ValueType::Boolean(b) => JsValue::from_bool(*b),
        ValueType::Symbol(s) => JsValue::from_str(s),
        ValueType::Vector(v) => {
            let arr = js_sys::Array::new();
            for item in v.iter() {
                arr.push(&value_to_js(item));
            }
            arr.into()
        },
        ValueType::Nil => JsValue::NULL,
    };
    
    js_sys::Reflect::set(&obj, &"value".into(), &val).unwrap();
    
    obj.into()
}
