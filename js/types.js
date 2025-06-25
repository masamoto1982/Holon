// 型定義
const Types = {
    NUMBER: 'number',
    BOOLEAN: 'boolean',
    STRING: 'string',
    SYMBOL: 'symbol',
    VECTOR: 'vector',
    NIL: 'nil'
};

// 値の作成ヘルパー
const createValue = (value, type) => ({
    value: value,
    type: type
});
