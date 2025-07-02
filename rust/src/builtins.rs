use std::collections::HashMap;
use crate::interpreter::WordDefinition;

pub fn register_builtins(dictionary: &mut HashMap<String, WordDefinition>) {
    // スタック操作（遅延評価対応）
    register_builtin(dictionary, "DUP", "スタックトップを複製 ( a -- a a )");
    register_builtin(dictionary, "DROP", "スタックトップを削除 ( a -- )");
    register_builtin(dictionary, "SWAP", "上位2つを交換 ( a b -- b a )");
    register_builtin(dictionary, "OVER", "2番目をコピー ( a b -- a b a )");
    register_builtin(dictionary, "ROT", "3番目を最上位へ ( a b c -- b c a )");
    
    // レジスタ操作
    register_builtin(dictionary, ">R", "スタックからレジスタへ移動 ( a -- )");
    register_builtin(dictionary, "R>", "レジスタからスタックへ移動 ( -- a )");
    register_builtin(dictionary, "R@", "レジスタの値をコピー ( -- a )");
    
    // 遅延ベクトル操作
    register_builtin(dictionary, "LENGTH", "ベクトルの長さ（無限の場合はエラー） ( vec -- n )");
    register_builtin(dictionary, "HEAD", "最初の要素 ( vec -- elem )");
    register_builtin(dictionary, "TAIL", "最初以外の要素 ( vec -- vec' )");
    register_builtin(dictionary, "CONS", "要素を先頭に追加 ( elem vec -- vec' )");
    register_builtin(dictionary, "NTH", "N番目の要素を取得 ( n vec -- elem )");
    
    // 制御構造
    register_builtin(dictionary, "DEF", "新しいワードを定義 ( vec str -- )");
    register_builtin(dictionary, "IF", "条件分岐 ( bool vec vec -- ... )");
    
    // 辞書操作
    register_builtin(dictionary, "WORDS", "全ワードをスタックに積む ( -- str... )");
    register_builtin(dictionary, "WORDS?", "プレフィックスでフィルタ ( str -- str... )");
    register_builtin(dictionary, "DEL", "カスタムワードを削除 ( str -- )");
    
    // 算術演算子（遅延評価）
    register_builtin(dictionary, "+", "加算 ( a b -- a+b )");
    register_builtin(dictionary, "-", "減算 ( a b -- a-b )");
    register_builtin(dictionary, "*", "乗算 ( a b -- a*b )");
    register_builtin(dictionary, "/", "除算 ( a b -- a/b )");
    
    // 比較演算子（遅延評価）
    register_builtin(dictionary, ">", "より大きい ( a b -- bool )");
    register_builtin(dictionary, ">=", "以上 ( a b -- bool )");
    register_builtin(dictionary, "=", "等しい ( a b -- bool )");
    register_builtin(dictionary, "<", "より小さい ( a b -- bool )");
    register_builtin(dictionary, "<=", "以下 ( a b -- bool )");
    
    // 強制評価・遅延評価制御
    register_builtin(dictionary, "FORCE", "値を強制評価 ( thunk -- value )");
    register_builtin(dictionary, "LAZY", "計算を遅延化 ( vec -- thunk )");
    register_builtin(dictionary, "SEQ", "厳格評価（左を評価してから右を返す） ( a b -- b )");
    
    // 無限構造生成
    register_builtin(dictionary, "RANGE", "範囲生成（無限可能） ( start end -- lazy-vec )");
    register_builtin(dictionary, "CYCLE", "無限循環 ( vec -- lazy-vec )");
    register_builtin(dictionary, "REPEAT", "無限反復 ( value -- lazy-vec )");
    register_builtin(dictionary, "ITERATE", "関数の無限適用 ( vec value -- lazy-vec )");
    
    // リスト処理（遅延）
    register_builtin(dictionary, "TAKE", "先頭からN個取得 ( n lazy-vec -- vec )");
    register_builtin(dictionary, "DROP-LAZY", "先頭からN個スキップ ( n lazy-vec -- lazy-vec )");
    register_builtin(dictionary, "MAP", "関数を全要素に適用 ( vec lazy-vec -- lazy-vec )");
    register_builtin(dictionary, "FILTER", "条件にマッチする要素を抽出 ( vec lazy-vec -- lazy-vec )");
    register_builtin(dictionary, "FOLD", "畳み込み演算 ( vec init lazy-vec -- value )");
}

fn register_builtin(dictionary: &mut HashMap<String, WordDefinition>, name: &str, description: &str) {
    dictionary.insert(name.to_string(), WordDefinition {
        tokens: vec![],
        is_builtin: true,
        description: Some(description.to_string()),
    });
}
