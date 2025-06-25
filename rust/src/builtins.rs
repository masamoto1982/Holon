use std::collections::HashMap;
use crate::interpreter::WordDefinition;

pub fn register_builtins(dictionary: &mut HashMap<String, WordDefinition>) {
    // スタック操作
    register_builtin(dictionary, "DUP");
    register_builtin(dictionary, "DROP");
    register_builtin(dictionary, "SWAP");
    register_builtin(dictionary, "OVER");
    register_builtin(dictionary, "ROT");
    
    // レジスタ操作
    register_builtin(dictionary, ">R");
    register_builtin(dictionary, "R>");
    register_builtin(dictionary, "R@");
    
    // ベクトル操作
    register_builtin(dictionary, "LENGTH");
    register_builtin(dictionary, "HEAD");
    register_builtin(dictionary, "TAIL");
    register_builtin(dictionary, "CONS");
    register_builtin(dictionary, "REVERSE");
    register_builtin(dictionary, "NTH");
    
    // 制御構造
    register_builtin(dictionary, "DEF");
    register_builtin(dictionary, "IF");
    
    // 辞書操作
    register_builtin(dictionary, "WORDS");
    register_builtin(dictionary, "WORDS?");
}

fn register_builtin(dictionary: &mut HashMap<String, WordDefinition>, name: &str) {
    dictionary.insert(name.to_string(), WordDefinition {
        tokens: vec![],
        is_builtin: true,
    });
}
