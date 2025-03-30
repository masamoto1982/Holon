// script.js - Pure Lambda-based Holon language with simplified syntax

// データ構造 - スタックとレジスタを削除
const state = {
    dictionary: {}, // ワード辞書（ラムダ式をマップに格納）
    output: "",
    logs: []
};

// デバッグログ機能
const log = message => {
    state.logs.push(`${new Date().toISOString().substr(11, 8)}: ${message}`);
    console.log(message);
};

// トークンを正規化（大文字に変換）する関数
const normalizeToken = token => token.toUpperCase();

// 分数クラス
class Fraction {
    constructor(numerator, denominator = 1) {
        if (denominator === 0) {
            throw new Error("Division by zero");
        }
        
        // 約分のためのGCD計算
        const gcd = this.gcd(Math.abs(numerator), Math.abs(denominator));
        
        // 符号の正規化: 分母は常に正
        const sign = (denominator < 0) ? -1 : 1;
        
        this.numerator = sign * Math.floor(numerator / gcd);
        this.denominator = Math.abs(Math.floor(denominator / gcd));
    }
    
    // 最大公約数を求める（ユークリッドの互除法）
    gcd(a, b) {
        while (b !== 0) {
            [a, b] = [b, a % b];
        }
        return a;
    }
    
    // 文字列表現
    toString() {
        return this.denominator === 1 ? `${this.numerator}` : `${this.numerator}/${this.denominator}`;
    }
    
    // 四則演算
    add(other) {
        const newNumerator = this.numerator * other.denominator + other.numerator * this.denominator;
        const newDenominator = this.denominator * other.denominator;
        return new Fraction(newNumerator, newDenominator);
    }
    
    subtract(other) {
        const newNumerator = this.numerator * other.denominator - other.numerator * this.denominator;
        const newDenominator = this.denominator * other.denominator;
        return new Fraction(newNumerator, newDenominator);
    }
    
    multiply(other) {
        return new Fraction(
            this.numerator * other.numerator,
            this.denominator * other.denominator
        );
    }
    
    divide(other) {
        if (other.numerator === 0) {
            throw new Error("Division by zero");
        }
        return new Fraction(
            this.numerator * other.denominator,
            this.denominator * other.numerator
        );
    }
    
    // 比較演算
    equals(other) {
        return this.numerator * other.denominator === other.numerator * this.denominator;
    }
    
    lessThan(other) {
        return this.numerator * other.denominator < other.numerator * this.denominator;
    }
    
    greaterThan(other) {
        return this.numerator * other.denominator > other.numerator * this.denominator;
    }
}

// 文字列クラス
class HolonString {
    constructor(value) {
        this.value = value;
    }
    
    toString() {
        return `"${this.value}"`;
    }
}

// ラムダ式クラス
class Lambda {
    constructor(params, body, meta = {}) {
        this.params = params;     // パラメータ名の配列
        this.body = body;         // 関数本体（トークン配列または関数）
        this.meta = meta;         // メタデータ（説明など）
    }
    
    toString() {
        if (typeof this.body === 'function') {
            return `λ[${this.params.join(' ')}] ( [native code] )`;
        }
        return `λ[${this.params.join(' ')}] ( ${this.body.length} tokens )`;
    }
    
    // ラムダ式の適用
    apply(args) {
        log(`Applying lambda with args: [${args.map(a => a?.toString() || 'null').join(', ')}]`);
        
        // 環境の準備 - 引数とパラメータのマッピング
        const env = {};
        for (let i = 0; i < this.params.length; i++) {
            env[this.params[i]] = i < args.length ? args[i] : null;
        }
        
        // 関数本体が JavaScript 関数の場合
        if (typeof this.body === 'function') {
            return this.body(env);
        }
        
        // 関数本体がトークン配列の場合
        return evaluate(this.body, env);
    }
}

// リストクラス
class HolonList {
    constructor(items = []) {
        this.items = items;
    }
    
    toString() {
        return `[${this.items.map(item => item.toString()).join(' ')}]`;
    }
    
    // リスト操作メソッド
    first() {
        return this.items.length > 0 ? this.items[0] : null;
    }
    
    rest() {
        return new HolonList(this.items.slice(1));
    }
    
    append(item) {
        return new HolonList([...this.items, item]);
    }
    
    length() {
        return new Fraction(this.items.length, 1);
    }
}

// 辞書操作ユーティリティ
const dictionaryOps = {
    // 辞書にワードを定義
    define: (name, value) => {
        const normalizedName = normalizeToken(name);
        state.dictionary[normalizedName] = value;
        log(`Defined word "${normalizedName}" in dictionary`);
        return value;
    },
    
    // 辞書からワードを取得
    lookup: (name) => {
        const normalizedName = normalizeToken(name);
        const value = state.dictionary[normalizedName];
        if (value === undefined) {
            log(`Word "${normalizedName}" not found in dictionary`);
            return null;
        }
        log(`Found word "${normalizedName}" in dictionary`);
        return value;
    },
    
    // 辞書からワードを削除
    remove: (name) => {
        const normalizedName = normalizeToken(name);
        if (state.dictionary[normalizedName] !== undefined) {
            delete state.dictionary[normalizedName];
            log(`Removed word "${normalizedName}" from dictionary`);
            return true;
        }
        log(`Word "${normalizedName}" not found for removal`);
        return false;
    },
    
    // 辞書の全ワードのリスト取得
    listWords: () => {
        return Object.keys(state.dictionary);
    }
};

// 組み込みのネイティブラムダ式を定義
const initializeBuiltins = () => {
    // 算術演算
    dictionaryOps.define("ADD", new Lambda(["a", "b"], (env) => {
        return env.a.add(env.b);
    }, { description: "Adds two numbers", isBuiltin: true }));
    
    dictionaryOps.define("SUB", new Lambda(["a", "b"], (env) => {
        return env.a.subtract(env.b);
    }, { description: "Subtracts second number from first", isBuiltin: true }));
    
    dictionaryOps.define("MUL", new Lambda(["a", "b"], (env) => {
        return env.a.multiply(env.b);
    }, { description: "Multiplies two numbers", isBuiltin: true }));
    
    dictionaryOps.define("DIV", new Lambda(["a", "b"], (env) => {
        return env.a.divide(env.b);
    }, { description: "Divides first number by second", isBuiltin: true }));
    
    // 比較演算
    dictionaryOps.define("EQ", new Lambda(["a", "b"], (env) => {
        return new Fraction(env.a.equals(env.b) ? 1 : 0, 1);
    }, { description: "Tests if values are equal", isBuiltin: true }));
    
    dictionaryOps.define("LT", new Lambda(["a", "b"], (env) => {
        return new Fraction(env.a.lessThan(env.b) ? 1 : 0, 1);
    }, { description: "Tests if first value is less than second", isBuiltin: true }));
    
    dictionaryOps.define("GT", new Lambda(["a", "b"], (env) => {
        return new Fraction(env.a.greaterThan(env.b) ? 1 : 0, 1);
    }, { description: "Tests if first value is greater than second", isBuiltin: true }));
    
    // 論理演算
    dictionaryOps.define("AND", new Lambda(["a", "b"], (env) => {
        const aValue = env.a instanceof Fraction ? env.a.numerator !== 0 : !!env.a;
        const bValue = env.b instanceof Fraction ? env.b.numerator !== 0 : !!env.b;
        return new Fraction(aValue && bValue ? 1 : 0, 1);
    }, { description: "Logical AND", isBuiltin: true }));
    
    dictionaryOps.define("OR", new Lambda(["a", "b"], (env) => {
        const aValue = env.a instanceof Fraction ? env.a.numerator !== 0 : !!env.a;
        const bValue = env.b instanceof Fraction ? env.b.numerator !== 0 : !!env.b;
        return new Fraction(aValue || bValue ? 1 : 0, 1);
    }, { description: "Logical OR", isBuiltin: true }));
    
    dictionaryOps.define("NOT", new Lambda(["a"], (env) => {
        const aValue = env.a instanceof Fraction ? env.a.numerator !== 0 : !!env.a;
        return new Fraction(aValue ? 0 : 1, 1);
    }, { description: "Logical NOT", isBuiltin: true }));
    
    // 条件分岐
    dictionaryOps.define("IF", new Lambda(["condition", "thenExpr", "elseExpr"], (env) => {
        const condValue = env.condition instanceof Fraction ? 
                           env.condition.numerator !== 0 : !!env.condition;
        
        if (condValue) {
            log("IF: Condition is true, executing then branch");
            return env.thenExpr instanceof Lambda ? 
                   env.thenExpr.apply([]) : env.thenExpr;
        } else {
            log("IF: Condition is false, executing else branch");
            return env.elseExpr instanceof Lambda ? 
                   env.elseExpr.apply([]) : env.elseExpr;
        }
    }, { description: "Conditional execution", isBuiltin: true }));
    
    // 辞書操作 - ここでDEFをネイティブ関数として実装
    dictionaryOps.define("DEF", new Lambda(["wordName", "params", "body"], (env) => {
        // DEF ADDER [ x y ] ( ADD x y ) 形式の処理
        if (typeof env.wordName !== 'string' && !(env.wordName instanceof HolonString)) {
            throw new Error("First argument must be a word name");
        }
        
        const name = env.wordName instanceof HolonString ? env.wordName.value : env.wordName;
        
        if (!(env.params instanceof HolonList)) {
            throw new Error("Second argument must be a parameter list");
        }
        
        // パラメータ名のリストを文字列配列に変換
        const paramNames = env.params.items.map(item => {
            if (typeof item === 'string') return item;
            if (item instanceof HolonString) return item.value;
            throw new Error("Parameters must be strings");
        });
        
        // ラムダ式を作成して辞書に登録
        const lambda = new Lambda(
            paramNames,
            env.body, // 本体は評価済みのボディか、未評価のトークン配列
            { description: `Custom word: ${name}`, isCustom: true }
        );
        
        dictionaryOps.define(name, lambda);
        return lambda;
    }, { description: "Defines a new word", isBuiltin: true }));
    
    dictionaryOps.define("UNDEF", new Lambda(["name"], (env) => {
        if (typeof env.name !== 'string' && !(env.name instanceof HolonString)) {
            throw new Error("Argument must be a name");
        }
        
        const wordName = env.name instanceof HolonString ? env.name.value : env.name;
        return dictionaryOps.remove(wordName);
    }, { description: "Removes a word from the dictionary", isBuiltin: true }));
    
    dictionaryOps.define("WORDS", new Lambda([], (env) => {
        const words = dictionaryOps.listWords();
        return new HolonString(words.join(" "));
    }, { description: "Lists all words in the dictionary", isBuiltin: true }));
    
    // 関数適用
    dictionaryOps.define("APPLY", new Lambda(["func", "args"], (env) => {
        if (!(env.func instanceof Lambda)) {
            throw new Error("First argument must be a lambda expression");
        }
        
        let args = [];
        if (env.args instanceof HolonList) {
            args = env.args.items;
        } else if (Array.isArray(env.args)) {
            args = env.args;
        } else {
            args = [env.args];
        }
        
        return env.func.apply(args);
    }, { description: "Applies a function to arguments", isBuiltin: true }));
    
    // 入出力
    dictionaryOps.define("PRINT", new Lambda(["value"], (env) => {
        let output;
        if (env.value instanceof HolonString) {
            output = env.value.value;
        } else {
            output = env.value ? env.value.toString() : "null";
        }
        
        state.output += output;
        log(`PRINT: ${output}`);
        return env.value;
    }, { description: "Prints a value", isBuiltin: true }));
    
    dictionaryOps.define("PRINTLN", new Lambda(["value"], (env) => {
        let output;
        if (env.value instanceof HolonString) {
            output = env.value.value;
        } else {
            output = env.value ? env.value.toString() : "null";
        }
        
        state.output += output + "\n";
        log(`PRINTLN: ${output}`);
        return env.value;
    }, { description: "Prints a value followed by a newline", isBuiltin: true }));
    
    dictionaryOps.define("CLEAR", new Lambda([], (env) => {
        state.output = "";
        log("CLEAR: Output cleared");
        return null;
    }, { description: "Clears the output", isBuiltin: true }));
};

// UI要素の取得
const elements = {
    output: document.querySelector('.output-box p'),
    input: document.querySelector('textarea'),
    builtinWords: document.querySelector('.builtin-words-area'),
    customWords: document.querySelector('.custom-words-area')
};

// UI更新関数
const updateUI = () => {
    // 出力エリア更新
    elements.output.textContent = state.output;
    
    // 辞書ワード表示更新
    renderDictionary();
};

// 辞書ワードボタンの生成
const renderDictionary = () => {
    // 組み込みワード表示
    elements.builtinWords.innerHTML = '<h3>Built-In Words</h3>';
    
    // 組み込みワードを取得
    const builtinWords = Object.entries(state.dictionary)
        .filter(([_, value]) => value.meta && value.meta.isBuiltin)
        .map(([name]) => name)
        .sort();
    
    builtinWords.forEach(word => {
        const wordInfo = state.dictionary[word];
        const meta = wordInfo.meta || {};
        
        const wordButton = document.createElement("button");
        wordButton.textContent = word;
        wordButton.title = meta.description || "";
        wordButton.className = "word-button";
        
        // クリックイベント - 空白を追加しない
        wordButton.addEventListener("click", () => {
            const cursorPos = elements.input.selectionStart;
            const textBefore = elements.input.value.substring(0, cursorPos);
            const textAfter = elements.input.value.substring(cursorPos);
            elements.input.value = textBefore + word + textAfter;
            
            // カーソル位置を更新
            elements.input.selectionStart = elements.input.selectionEnd = cursorPos + word.length;
            elements.input.focus();
        });
        
        elements.builtinWords.appendChild(wordButton);
    });
    
    // カスタムワード表示
    elements.customWords.innerHTML = '<h3>Custom Words</h3>';
    
    // カスタムワードを取得
    const customWords = Object.entries(state.dictionary)
        .filter(([_, value]) => value.meta && value.meta.isCustom)
        .map(([name]) => name)
        .sort();
    
    customWords.forEach(word => {
        const wordInfo = state.dictionary[word];
        const meta = wordInfo.meta || {};
        
        const wordButton = document.createElement("button");
        wordButton.textContent = word;
        
        // ホバー表示をコメントまたは本体に変更
        if (meta.comment) {
            wordButton.title = meta.comment;
        } else {
            const params = wordInfo.params.join(' ');
            const bodyPreview = wordInfo.body.slice(0, 10).join(' ') + (wordInfo.body.length > 10 ? "..." : "");
            wordButton.title = `[${params}] (${bodyPreview})`;
        }
        
        wordButton.className = "word-button";
        
        // クリックイベント - 空白を追加しない
        wordButton.addEventListener("click", () => {
            const cursorPos = elements.input.selectionStart;
            const textBefore = elements.input.value.substring(0, cursorPos);
            const textAfter = elements.input.value.substring(cursorPos);
            elements.input.value = textBefore + word + textAfter;
            
            // カーソル位置を更新
            elements.input.selectionStart = elements.input.selectionEnd = cursorPos + word.length;
            elements.input.focus();
        });
        
        elements.customWords.appendChild(wordButton);
    });
};

// トークン分割（文字列リテラル、コメントを考慮）
const tokenize = code => {
    log(`Tokenizing: "${code}"`);
    
    const tokens = [];
    let i = 0;
    let currentToken = '';
    let inString = false;
    let inComment = false;
    
    while (i < code.length) {
        const char = code[i];
        
        // コメント処理
        if (char === '#' && !inString) {
            // 行の終わりまでスキップ
            inComment = true;
            
            // 現在のトークンがあれば追加
            if (currentToken.length > 0) {
                tokens.push(currentToken);
                currentToken = '';
            }
            
            // コメント自体をトークンとして収集
            currentToken = '#';
        } else if (inComment) {
            // コメント内の文字を収集
            if (char === '\n') {
                // 改行でコメント終了
                if (currentToken.length > 0) {
                    tokens.push(currentToken);
                    currentToken = '';
                }
                inComment = false;
            } else {
                currentToken += char;
            }
        } else if (char === '"') {
            // 文字列リテラルの処理
            if (inString) {
                // 文字列の終了
                currentToken += char;
                tokens.push(currentToken);
                currentToken = '';
                inString = false;
            } else {
                // 文字列の開始
                if (currentToken.length > 0) {
                    tokens.push(currentToken);
                    currentToken = '';
                }
                currentToken = char;
                inString = true;
            }
        } else if (inString) {
            // 文字列内の文字
            currentToken += char;
        } else if (/\s/.test(char)) {
            // 空白文字（区切り）
            if (currentToken.length > 0) {
                tokens.push(currentToken);
                currentToken = '';
            }
        } else if ("[]()".includes(char)) {
            // 特殊文字（括弧）は独立したトークンとして扱う
            if (currentToken.length > 0) {
                tokens.push(currentToken);
                currentToken = '';
            }
            tokens.push(char);
        } else {
            // その他の文字
            currentToken += char;
        }
        
        i++;
    }
    
    // 最後のトークンがあれば追加
    if (currentToken.length > 0) {
        tokens.push(currentToken);
    }
    
    log(`Tokens: [${tokens.join(', ')}]`);
    return tokens;
};

// 値の解析（数値、文字列など）
const parseValue = token => {
    // 文字列リテラルの場合
    if (typeof token === 'string' && token.startsWith('"') && token.endsWith('"')) {
        const stringValue = token.slice(1, -1);
        log(`Parsed string: ${token} -> "${stringValue}"`);
        return new HolonString(stringValue);
    }
    
    // 分数表記 (a/b) の場合
    if (typeof token === 'string' && token.includes("/")) {
        const parts = token.split("/");
        if (parts.length !== 2) {
            log(`Invalid fraction format: ${token}`);
            throw new Error(`Invalid fraction format: ${token}`);
        }
        
        const numerator = parseInt(parts[0], 10);
        const denominator = parseInt(parts[1], 10);
        
        if (isNaN(numerator) || isNaN(denominator)) {
            log(`Invalid fraction: ${token}`);
            throw new Error(`Invalid fraction: ${token}`);
        }
        
        const fraction = new Fraction(numerator, denominator);
        log(`Parsed fraction: ${token} -> ${fraction.toString()}`);
        return fraction;
    }
    
    // 整数の場合
    if (typeof token === 'string') {
        const number = parseInt(token, 10);
        if (!isNaN(number)) {
            const fraction = new Fraction(number, 1);
            log(`Parsed integer: ${token} -> ${fraction.toString()}`);
            return fraction;
        }
    }
    
    // 辞書ワードの場合
    if (typeof token === 'string') {
        const normalizedToken = normalizeToken(token);
        const word = dictionaryOps.lookup(normalizedToken);
        if (word) {
            log(`Found word in dictionary: ${normalizedToken}`);
            return word;
        }
    }
    
    // 解析できない値はそのまま返す
    return token;
};

// パラメータリストの解析
const parseParamList = (tokens, startIndex) => {
    // [ で始まるか確認
    if (tokens[startIndex] !== '[') {
        throw new Error("Expected '[' to start parameter list");
    }
    
    const params = [];
    let i = startIndex + 1;
    
    // ] までパラメータを収集
    while (i < tokens.length && tokens[i] !== ']') {
        params.push(tokens[i]);
        i++;
    }
    
    if (i >= tokens.length || tokens[i] !== ']') {
        throw new Error("Unclosed parameter list");
    }
    
    return {
        params,
        endIndex: i
    };
};

// 関数本体の解析
const parseFunctionBody = (tokens, startIndex) => {
    // ( で始まるか確認
    if (tokens[startIndex] !== '(') {
        throw new Error("Expected '(' to start function body");
    }
    
    const body = [];
    let i = startIndex + 1;
    let depth = 1;
    
    // 対応する ) までトークンを収集
    while (i < tokens.length && depth > 0) {
        if (tokens[i] === '(') depth++;
        else if (tokens[i] === ')') depth--;
        
        if (depth > 0) {
            body.push(tokens[i]);
        }
        i++;
    }
    
    if (depth !== 0) {
        throw new Error("Unclosed function body");
    }
    
    return {
        body,
        endIndex: i - 1
    };
};

// 新しい構文でのワード定義の解析
const parseWordDefinition = (tokens, startIndex) => {
    // DEF で始まるか確認
    if (normalizeToken(tokens[startIndex]) !== 'DEF') {
        return null;
    }
    
    // ワード名
    if (startIndex + 1 >= tokens.length) {
        throw new Error("Expected word name after DEF");
    }
    const wordName = tokens[startIndex + 1];
    
    // パラメータリスト
    if (startIndex + 2 >= tokens.length || tokens[startIndex + 2] !== '[') {
        throw new Error("Expected parameter list after word name");
    }
    const { params, endIndex: paramsEndIndex } = parseParamList(tokens, startIndex + 2);
    
    // 関数本体
    if (paramsEndIndex + 1 >= tokens.length || tokens[paramsEndIndex + 1] !== '(') {
        throw new Error("Expected function body after parameter list");
    }
    const { body, endIndex: bodyEndIndex } = parseFunctionBody(tokens, paramsEndIndex + 1);
    
    // コメントを確認
    let comment = "";
    let endIndex = bodyEndIndex;
    
    // コメントを探す (#で始まる部分)
    for (let i = bodyEndIndex + 1; i < tokens.length; i++) {
        if (tokens[i].startsWith('#')) {
            comment = tokens[i].substring(1); // #を除いたコメント本文
            endIndex = i;
            break;
        }
    }
    
    // ラムダ式を作成して辞書に登録
    const lambda = new Lambda(
        params,
        body,
        { 
            description: comment || `Custom word: ${wordName}`, 
            isCustom: true,
            comment: comment 
        }
    );
    
    dictionaryOps.define(wordName, lambda);
    
    return {
        wordName,
        lambda,
        endIndex: endIndex
    };
};

// パーサー
const parse = tokens => {
    log(`Parsing ${tokens.length} tokens`);
    const program = [];
    let i = 0;
    
    while (i < tokens.length) {
        const token = tokens[i];
        log(`Parsing token ${i}: "${token}"`);
        
        // ワード定義の処理
        if (normalizeToken(token) === 'DEF') {
            const defResult = parseWordDefinition(tokens, i);
            if (defResult) {
                i = defResult.endIndex + 1;
                continue;
            }
        }
        
        // リストリテラルの処理
        if (token === '[') {
            const items = [];
            let j = i + 1;
            
            while (j < tokens.length && tokens[j] !== ']') {
                const value = parseValue(tokens[j]);
                items.push(value);
                j++;
            }
            
            if (j >= tokens.length) {
                throw new Error("Unclosed list literal");
            }
            
            program.push(new HolonList(items));
            i = j + 1;
            continue;
        }
        
        // 括弧トークンはスキップ（ワード定義では別途処理済み）
        if (token === '(' || token === ')' || token === ']') {
            i++;
            continue;
        }
        
        // コメントはスキップ
        if (token.startsWith('#')) {
            i++;
            continue;
        }
        
        // 通常のトークン処理
        const value = parseValue(token);
        program.push(value);
        i++;
    }
    
    log(`Parsed program: ${program.length} elements`);
    return program;
};

// 環境内の変数解決
const resolveVariable = (name, env) => {
    if (env && env[name] !== undefined) {
        return env[name];
    }
    
    // 辞書から探す
    return dictionaryOps.lookup(name);
};

// 評価関数
const evaluate = (program, env = {}) => {
    log(`Evaluating program with ${program.length} elements`);
    
    let result = null;
    let i = 0;
    
    while (i < program.length) {
        const token = program[i];
        log(`Evaluating element ${i}: ${token}`);
        
        try {
            // 値（数値、文字列、リスト）の場合
            if (token instanceof Fraction || token instanceof HolonString || 
                token instanceof HolonList) {
                result = token;
                i++;
                continue;
            }
            
            // ラムダ式の場合（直接値として使われる場合）
            // ラムダ式の場合（直接値として使われる場合）
            if (token instanceof Lambda) {
                result = token;
                i++;
                continue;
            }
            
            // 変数参照または辞書ワードの場合
            if (typeof token === 'string') {
                // 環境内に変数があるか確認
                const value = resolveVariable(token, env);
                
                if (value === null) {
                    throw new Error(`Unknown word or variable: ${token}`);
                }
                
                // ラムダ式の場合、適用が必要かチェック
                if (value instanceof Lambda) {
                    // ラムダ式の場合、必要な引数を集める
                    const argsNeeded = value.params.length;
                    const args = [];
                    
                    // 引数が足りない場合、エラー
                    if (i + argsNeeded >= program.length) {
                        throw new Error(`Not enough arguments for ${token}, expected ${argsNeeded}`);
                    }
                    
                    // 残りのトークンから引数を収集して評価
                    for (let j = 0; j < argsNeeded; j++) {
                        // 次のトークンを評価
                        const nextToken = program[i + j + 1];
                        
                        // 値として評価可能な場合
                        if (nextToken instanceof Fraction || 
                            nextToken instanceof HolonString || 
                            nextToken instanceof HolonList ||
                            nextToken instanceof Lambda) {
                            args.push(nextToken);
                        } else if (typeof nextToken === 'string') {
                            // 変数または辞書ワードを解決
                            const argValue = resolveVariable(nextToken, env);
                            if (argValue === null) {
                                throw new Error(`Unknown word or variable: ${nextToken}`);
                            }
                            args.push(argValue);
                        } else {
                            throw new Error(`Invalid argument: ${nextToken}`);
                        }
                    }
                    
                    // ラムダ式を適用
                    result = value.apply(args);
                    
                    // 処理した引数の分だけインデックスを進める
                    i += argsNeeded + 1;
                } else {
                    // 値の場合はそのまま
                    result = value;
                    i++;
                }
            } else {
                throw new Error(`Invalid token: ${token}`);
            }
        } catch (error) {
            log(`Error evaluating token: ${error.message}`);
            throw error;
        }
    }
    
    return result;
};

// 実行関数
const executeCode = code => {
    log(`==== Execution started ====`);
    try {
        log(`Input code: ${code}`);
        const tokens = tokenize(code);
        const program = parse(tokens);
        log(`Executing program`);
        const result = evaluate(program);
        log(`Result: ${result ? result.toString() : 'null'}`);
        
        // 結果を出力に追加（あれば）
        if (result && state.output.length > 0 && !state.output.endsWith('\n')) {
            state.output += '\n';
        }
        
        updateUI();
        
        // 実行に成功した場合のみ入力内容をクリア
        elements.input.value = "";
        log(`Input area cleared after successful execution`);
    } catch (error) {
        log(`Error: ${error.message}`);
        state.output += `Error: ${error.message}\n`;
        updateUI();
        // エラーの場合は入力をクリアしない
    }
    log(`==== Execution completed ====`);
};

// イベントリスナー
const initEventListeners = () => {
    // キー入力イベントを監視
    elements.input.addEventListener("keydown", event => {
        // Shift+Enterの処理
        if (event.key === "Enter" && event.shiftKey) {
            event.preventDefault(); // デフォルトの改行を防止
            log(`Shift+Enter pressed. Executing code.`);
            
            const code = elements.input.value;
            state.logs = [];   // ログをクリア
            executeCode(code);
        }
    });
};

// 初期化
const init = () => {
    log(`Initializing Pure Lambda-based Holon interpreter with simplified syntax`);
    
    // 組み込みワード（ラムダ式）の初期化
    initializeBuiltins();
    
    // イベントリスナーの設定
    initEventListeners();
    
    // UI更新
    updateUI();
    
    // ウェルカムメッセージ
    state.output = "Lambda-based Holon Interpreter\n" +
                  "Type code and press Shift+Enter to execute\n" +
                  "Example: DEF ADDER [ x y ] ( ADD x y )\n" +
                  "         3 5 ADDER\n";
    updateUI();
};

// アプリケーション起動
window.addEventListener("DOMContentLoaded", init);