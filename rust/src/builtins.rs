use std::collections::HashMap;
use crate::interpreter::WordDefinition;

pub fn register_builtins(dictionary: &mut HashMap<String, WordDefinition>) {
   // スタック操作
   register_builtin(dictionary, "DUP", "スタックトップを複製 ( a -- a a )");
   register_builtin(dictionary, "DROP", "スタックトップを削除 ( a -- )");
   register_builtin(dictionary, "SWAP", "上位2つを交換 ( a b -- b a )");
   register_builtin(dictionary, "OVER", "2番目をコピー ( a b -- a b a )");
   register_builtin(dictionary, "ROT", "3番目を最上位へ ( a b c -- b c a )");
   
   // レジスタ操作
   register_builtin(dictionary, ">R", "スタックからレジスタへ移動 ( a -- )");
   register_builtin(dictionary, "R>", "レジスタからスタックへ移動 ( -- a )");
   register_builtin(dictionary, "R@", "レジスタの値をコピー ( -- a )");
   
   // ベクトル操作
   register_builtin(dictionary, "LENGTH", "ベクトルの長さ ( vec -- n )");
   register_builtin(dictionary, "HEAD", "最初の要素 ( vec -- elem )");
   register_builtin(dictionary, "TAIL", "最初以外の要素 ( vec -- vec' )");
   register_builtin(dictionary, "CONS", "要素を先頭に追加 ( elem vec -- vec' )");
   register_builtin(dictionary, "REVERSE", "ベクトルを逆順に ( vec -- vec' )");
   register_builtin(dictionary, "NTH", "N番目の要素を取得（負数は末尾から） ( n vec -- elem )");
   
   // 制御構造
   register_builtin(dictionary, "DEF", "新しいワードを定義 ( vec str -- )");
   register_builtin(dictionary, "IF", "条件分岐 ( bool vec vec -- ... )");
   
   // 辞書操作
   register_builtin(dictionary, "WORDS", "全ワードをスタックに積む ( -- str... )");
   register_builtin(dictionary, "WORDS?", "プレフィックスでフィルタ ( str -- str... )");
   register_builtin(dictionary, "DEL", "カスタムワードを削除 ( str -- )");
   
   // 算術演算子
   register_builtin(dictionary, "+", "加算 ( a b -- a+b )");
   register_builtin(dictionary, "-", "減算 ( a b -- a-b )");
   register_builtin(dictionary, "*", "乗算 ( a b -- a*b )");
   register_builtin(dictionary, "/", "除算 ( a b -- a/b )");
   
   // 比較演算子
   register_builtin(dictionary, ">", "より大きい ( a b -- bool )");
   register_builtin(dictionary, ">=", "以上 ( a b -- bool )");
   register_builtin(dictionary, "=", "等しい ( a b -- bool )");
   register_builtin(dictionary, "<", "より小さい ( a b -- bool )");
   register_builtin(dictionary, "<=", "以下 ( a b -- bool )");
   
   // 遅延評価関連
   register_builtin(dictionary, "DEFER", "遅延評価サンクを作成 ( sym -- thunk )");
   register_builtin(dictionary, "FORCE", "サンクを強制評価 ( thunk -- value )");
   
   // 再帰サポート
   register_builtin(dictionary, "REC", "再帰的定義 ( vec str -- )");
}

fn register_builtin(dictionary: &mut HashMap<String, WordDefinition>, name: &str, description: &str) {
   dictionary.insert(name.to_string(), WordDefinition {
       tokens: vec![],
       is_builtin: true,
       description: Some(description.to_string()),
   });
}
