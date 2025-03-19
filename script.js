// script.js - Holon language implementation

// データ構造
const state = {
    stack: [],
    register: null,
    output: "",
    customWords: {},
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

// 文字列クラス（Holonでの文字列表現）
class HolonString {
    constructor(value) {
        this.value = value;
    }
    
    toString() {
        return `"${this.value}"`;
    }
}

// 組み込みワード定義
const builtinWords = {
    // スタック操作
    "DUP": {
        execute: () => {
            if (state.stack.length < 1) throw new Error("Stack underflow");
            const top = state.stack[state.stack.length - 1];
            state.stack.push(top);
            log(`DUP: ${top} -> Stack: ${state.stack.map(i => i.toString()).join(' ')}`);
        },
        stackEffect: "( a -- a a )",
        description: "Duplicates the top stack item"
    },
    "DROP": {
        execute: () => {
            if (state.stack.length < 1) throw new Error("Stack underflow");
            const dropped = state.stack.pop();
            log(`DROP: ${dropped} -> Stack: ${state.stack.map(i => i.toString()).join(' ')}`);
        },
        stackEffect: "( a -- )",
        description: "Removes the top stack item"
    },
    "SWAP": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const a = state.stack.pop();
            const b = state.stack.pop();
            state.stack.push(a, b);
            log(`SWAP: ${a} ${b} -> Stack: ${state.stack.map(i => i.toString()).join(' ')}`);
        },
        stackEffect: "( a b -- b a )",
        description: "Swaps the top two stack items"
    },
    "ROT": {
        execute: () => {
            if (state.stack.length < 3) throw new Error("Stack underflow");
            const [c, b, a] = [state.stack.pop(), state.stack.pop(), state.stack.pop()];
            state.stack.push(b, c, a);
            log(`ROT: ${a} ${b} ${c} -> Stack: ${state.stack.map(i => i.toString()).join(' ')}`);
        },
        stackEffect: "( a b c -- b c a )",
        description: "Rotates the top three stack items"
    },
    "CLEAR": {
        execute: () => {
            log(`CLEAR: Stack cleared from [${state.stack.map(i => i.toString()).join(' ')}]`);
            state.stack = [];
        },
        stackEffect: "( ... -- )",
        description: "Clears the entire stack"
    },
    
    // レジスタ操作
    ">R": {
        execute: () => {
            if (state.stack.length < 1) throw new Error("Stack underflow");
            state.register = state.stack.pop();
            log(`>R: Register set to ${state.register}`);
        },
        stackEffect: "( a -- )",
        description: "Stores top stack item to register"
    },
    "R>": {
        execute: () => {
            if (state.register === null) throw new Error("Register is empty");
            state.stack.push(state.register);
            log(`R>: Register ${state.register} pushed to stack`);
        },
        stackEffect: "( -- a )",
        description: "Loads register value to stack"
    },
	
	"RESET": {
        execute: () => {
        log(`RESET: レジスタを空にする`);
        state.register = null;
        },
    stackEffect: "( -- )",
    description: "レジスタを初期化（null に設定）"
    },
	
	"FOLK": {
        execute: () => {
        if (state.register === null) {
            log("FOLK: レジスタが無のためカスタムワード全体をスキップ");
            throw new Error("SKIP_WORD"); // 特殊なエラーを投げてスキップを指示
        }
        log("FOLK: レジスタが有のため処理を継続");
        },
    stackEffect: "( -- )",
    description: "レジスタが無でなければ、カスタムワードの処理を実行する"
    },
	
	"LOOP": {
        execute: () => {
        if (state.register === null) {
            log("LOOP: レジスタが無のためループを終了");
            return;
        }

        log("LOOP: レジスタが有のためループを開始");

        // 現在実行中のカスタムワードを取得
        const currentWord = Object.entries(state.customWords).find(([name, word]) => {
            return word.body.includes("LOOP");
        });

        if (!currentWord) {
            throw new Error("LOOP: 現在のカスタムワードが見つかりません");
        }

        const [wordName, wordData] = currentWord;
        log(`LOOP: ${wordName} を繰り返し実行`);

        // レジスタが `0` になったら `null` に変換
        while (state.register !== null && !(state.register instanceof Fraction && state.register.numerator === 0)) {
            interpret(wordData.body);
        }

        // ループ終了後、レジスタを `null` にする
        if (state.register instanceof Fraction && state.register.numerator === 0) {
            log("LOOP: レジスタが 0 のため、レジスタをクリア");
            state.register = null;
        }
        },
    stackEffect: "( -- )",
    description: "レジスタが `null` でなく、0 でない間カスタムワードの処理を繰り返す"
    },
    
    // 数値操作
    "+": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const b = state.stack.pop();
            const a = state.stack.pop();
            const result = a.add(b);
            state.stack.push(result);
            log(`+: ${a} + ${b} = ${result}`);
        },
        stackEffect: "( a b -- a+b )",
        description: "Adds two numbers"
    },
    "-": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const b = state.stack.pop();
            const a = state.stack.pop();
            const result = a.subtract(b);
            state.stack.push(result);
            log(`-: ${a} - ${b} = ${result}`);
        },
        stackEffect: "( a b -- a-b )",
        description: "Subtracts two numbers"
    },
    "*": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const b = state.stack.pop();
            const a = state.stack.pop();
            const result = a.multiply(b);
            state.stack.push(result);
            log(`*: ${a} * ${b} = ${result}`);
        },
        stackEffect: "( a b -- a*b )",
        description: "Multiplies two numbers"
    },
    "/": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const b = state.stack.pop();
            const a = state.stack.pop();
            const result = a.divide(b);
            state.stack.push(result);
            log(`/: ${a} / ${b} = ${result}`);
        },
        stackEffect: "( a b -- a/b )",
        description: "Divides two numbers"
    },
    
    // ワード定義
    "DEF": {
        execute: () => {
            // この実装は実際の実行時には使用されない
            // パーサーが特別に処理する
            log("DEF: Word definition (handled by parser)");
        },
        stackEffect: "( -- )",
        description: "Defines a new word"
    },
    "DEL": {
        execute: () => {
            // この実装は実際の実行時には使用されない
            // パーサーが特別に処理する
            log("DEL: Word deletion (handled by parser)");
        },
        stackEffect: "( -- )",
        description: "Deletes a custom word"
    },
    
    // 比較演算
    "=": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const b = state.stack.pop();
            const a = state.stack.pop();
            const result = new Fraction(a.equals(b) ? 1 : 0, 1);
            state.stack.push(result);
            log(`=: ${a} = ${b} ? ${result}`);
        },
        stackEffect: "( a b -- flag )",
        description: "Tests if a equals b"
    },
    "<": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const b = state.stack.pop();
            const a = state.stack.pop();
            const result = new Fraction(a.lessThan(b) ? 1 : 0, 1);
            state.stack.push(result);
            log(`<: ${a} < ${b} ? ${result}`);
        },
        stackEffect: "( a b -- flag )",
        description: "Tests if a is less than b"
    },
    ">": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const b = state.stack.pop();
            const a = state.stack.pop();
            const result = new Fraction(a.greaterThan(b) ? 1 : 0, 1);
            state.stack.push(result);
            log(`>: ${a} > ${b} ? ${result}`);
        },
        stackEffect: "( a b -- flag )",
        description: "Tests if a is greater than b"
    },
    ">=": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const b = state.stack.pop();
            const a = state.stack.pop();
            const result = new Fraction(a.greaterThan(b) || a.equals(b) ? 1 : 0, 1);
            state.stack.push(result);
            log(`>=: ${a} >= ${b} ? ${result}`);
        },
        stackEffect: "( a b -- flag )",
        description: "Tests if a is greater than or equal to b"
    },
    "<=": {
        execute: () => {
            if (state.stack.length < 2) throw new Error("Stack underflow");
            const b = state.stack.pop();
            const a = state.stack.pop();
            const result = new Fraction(a.lessThan(b) || a.equals(b) ? 1 : 0, 1);
            state.stack.push(result);
            log(`<=: ${a} <= ${b} ? ${result}`);
        },
        stackEffect: "( a b -- flag )",
        description: "Tests if a is less than or equal to b"
    },
    
    // 特殊文字
    "{": {
        execute: () => {
            // 実行時には処理されない
            // パーサーが特別に処理する
            log("{: Block start (handled by parser)");
        },
        stackEffect: "( -- )",
        description: "Start of a word definition block"
    },
    "}": {
        execute: () => {
            // 実行時には処理されない
            // パーサーが特別に処理する
            log("}: Block end (handled by parser)");
        },
        stackEffect: "( -- )",
        description: "End of a word definition block"
    },
    " ": {
        execute: () => {
            // 空白文字は実行時には何もしない
            log(" : Space (token separator)");
        },
        stackEffect: "( -- )",
        description: "Token separator"
    }
};

// UI要素の取得
const elements = {
    output: document.getElementById("output"),
    stack: document.getElementById("stack"),
    register: document.getElementById("register"),
    input: document.getElementById("input"),
    builtinWordsContainer: document.getElementById("builtin-words"),
    customWordsContainer: document.getElementById("custom-words")
};

// 依存関係を分析する関数
const analyzeDependencies = () => {
    const referencedBy = {}; // wordA: [wordB, wordC] - wordAはwordBとwordCから参照されている
    const references = {};   // wordA: [wordB, wordC] - wordAはwordBとwordCを参照している
    
    // 初期化
    Object.keys(state.customWords).forEach(word => {
        referencedBy[word] = [];
        references[word] = [];
    });
    
    // 依存関係を解析
    Object.keys(state.customWords).forEach(wordName => {
        const body = state.customWords[wordName].body;
        body.forEach(token => {
            const normalizedToken = normalizeToken(token);
            if (state.customWords[normalizedToken]) {
                // 依存関係を記録
                if (!references[wordName].includes(normalizedToken)) {
                    references[wordName].push(normalizedToken);
                }
                if (!referencedBy[normalizedToken].includes(wordName)) {
                    referencedBy[normalizedToken].push(wordName);
                }
            }
        });
    });
    
    return { referencedBy, references };
};

// カスタムワードが他のワードから参照されているかチェックする関数
const isWordReferencedByOthers = wordName => {
    const normalizedWordName = normalizeToken(wordName);
    const { referencedBy } = analyzeDependencies();
    return referencedBy[normalizedWordName]?.length > 0;
};

// UI更新関数
const updateUI = () => {
    // 出力エリア更新
    elements.output.textContent = state.output;
    
    // スタック更新（横並びで表示）
    elements.stack.textContent = state.stack.map(item => item.toString()).join(" ");
    
    // レジスタ更新
    elements.register.textContent = state.register ? state.register.toString() : "";
    
    // カスタムワードエリア更新
    renderCustomWords();
};

// 組み込みワードボタンの生成
// 組み込みワードボタンの生成
const initBuiltinWords = () => {
    elements.builtinWordsContainer.innerHTML = "";
    
    Object.entries(builtinWords).forEach(([word, wordInfo]) => {
        const wordButton = document.createElement("button");
        // 組み込みワードは末尾に鍵マークを追加
        wordButton.textContent = word + " 🔒";
        wordButton.className = "word-button";
        wordButton.title = `${wordInfo.stackEffect} ${wordInfo.description}`;
        
        wordButton.addEventListener("click", () => {
            // クリック時は鍵マークなしのワードを挿入
            const cursorPos = elements.input.selectionStart;
            const textBefore = elements.input.value.substring(0, cursorPos);
            const textAfter = elements.input.value.substring(cursorPos);
            elements.input.value = textBefore + word + textAfter;
            
            // カーソル位置を更新
            elements.input.selectionStart = elements.input.selectionEnd = cursorPos + word.length;
            elements.input.focus();
        });
        
        elements.builtinWordsContainer.appendChild(wordButton);
    });
};

// カスタムワードボタンの生成
const renderCustomWords = () => {
    elements.customWordsContainer.innerHTML = "";
    
    // 依存関係を分析
    const { referencedBy } = analyzeDependencies();
    
    Object.entries(state.customWords).forEach(([word, wordInfo]) => {
        const wordButton = document.createElement("button");
        
        // 他のワードから参照されているかチェック
        const isReferenced = referencedBy[word]?.length > 0;
        
        // 参照されているワードには末尾に鍵マークを追加
        wordButton.textContent = isReferenced ? word + " 🔒" : word;
        wordButton.className = "word-button";
        wordButton.dataset.word = word; // データ属性にワード名を保存
        
        // ツールチップ情報
        let tooltip = wordInfo.stackEffect || "";
        if (isReferenced) {
            tooltip += `\nReferenced by: ${referencedBy[word].join(", ")}`;
            tooltip += "\n(Cannot be deleted or modified)";
        }
        
        wordButton.title = tooltip;
        
        // クリックイベント
        wordButton.addEventListener("click", () => {
            // クリック時は鍵マークなしのワードを挿入
            const cursorPos = elements.input.selectionStart;
            const textBefore = elements.input.value.substring(0, cursorPos);
            const textAfter = elements.input.value.substring(cursorPos);
            elements.input.value = textBefore + word + textAfter;
            
            // カーソル位置を更新
            elements.input.selectionStart = elements.input.selectionEnd = cursorPos + word.length;
            elements.input.focus();
        });
        
        elements.customWordsContainer.appendChild(wordButton);
    });
};

// トークン分割（文字列リテラルを考慮）
const tokenize = code => {
    log(`Tokenizing: "${code}"`);
    
    const tokens = [];
    let i = 0;
    let currentToken = '';
    let inString = false;
    
    while (i < code.length) {
        const char = code[i];
        
        // 文字列リテラルの処理
        if (char === '"') {
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

// パーサー
// パーサー関数の修正部分
const parse = tokens => {
    log(`Parsing ${tokens.length} tokens`);
    const program = [];
    let i = 0;
    
    while (i < tokens.length) {
        const token = tokens[i];
        log(`Parsing token ${i}: "${token}"`);
        
        // ワード定義の処理
        if (normalizeToken(token) === "{") {
            // ワード名は前のトークン
            if (i <= 0) {
                log(`Error: No word name before block start`);
                throw new Error("No word name before block start");
            }
            
            const wordName = tokens[i - 1];
            log(`Found word definition start for "${wordName}"`);
            
            // ここで前のトークン（ワード名）をプログラムから削除
            // これがないと定義対象のワードもプログラムに含まれ実行されてしまう
            if (program.length > 0 && program[program.length - 1] === wordName) {
                program.pop();
            }
            
            const bodyStart = i + 1;
            let depth = 1;
            let j = bodyStart;
            
            // 対応する閉じカッコを探す
            while (j < tokens.length && depth > 0) {
                if (normalizeToken(tokens[j]) === "{") depth++;
                if (normalizeToken(tokens[j]) === "}") depth--;
                j++;
            }
            
            if (depth !== 0) {
                log(`Error: Unclosed block for "${wordName}"`);
                throw new Error("Unclosed block");
            }
            
            const bodyEnd = j - 1;
            const bodyTokens = tokens.slice(bodyStart, bodyEnd);
            log(`Word body: [${bodyTokens.join(', ')}]`);
            
            // スタック効果コメントの確認
            let stackEffect = "";
            let defIndex = -1;
            
            for (let k = j; k < tokens.length; k++) {
                if (normalizeToken(tokens[k]) === "DEF" || normalizeToken(tokens[k]) === "DEL") {
                    defIndex = k;
                    log(`Found ${tokens[k]} at position ${k}`);
                    break;
                } else if (tokens[k] === "(" && k < tokens.length - 1) {
                    // スタック効果コメントを探す
                    let l = k + 1;
                    let commentTokens = [];
                    
                    while (l < tokens.length && tokens[l] !== ")") {
                        commentTokens.push(tokens[l]);
                        l++;
                    }
                    
                    if (l < tokens.length && tokens[l] === ")") {
                        stackEffect = commentTokens.join(" ");
                        log(`Found stack effect: "${stackEffect}"`);
                        k = l;
                    }
                }
            }
            
            if (defIndex !== -1) {
                const normalizedWordName = normalizeToken(wordName);
                const isDefine = normalizeToken(tokens[defIndex]) === "DEF";
                
                if (isDefine) {
                    // ワード再定義時、他のワードから参照されているか確認
                    if (state.customWords[normalizedWordName] && isWordReferencedByOthers(normalizedWordName)) {
                        log(`Cannot redefine word "${normalizedWordName}": referenced by other words`);
                        state.output += `Error: Cannot redefine "${normalizedWordName}" as it is referenced by other words\n`;
                    } else {
                        // カスタムワード定義
                        state.customWords[normalizedWordName] = {
                            body: bodyTokens,
                            stackEffect
                        };
                        log(`Defined custom word "${normalizedWordName}" with body [${bodyTokens.join(', ')}] and stack effect "${stackEffect}"`);
                    }
                } else {
                    // カスタムワード削除前に使用されているか確認
                    if (isWordReferencedByOthers(normalizedWordName)) {
                        log(`Cannot delete word "${normalizedWordName}": referenced by other words`);
                        state.output += `Error: Cannot delete "${normalizedWordName}" as it is referenced by other words\n`;
                    } else {
                        // カスタムワード削除
                        log(`Deleted custom word "${normalizedWordName}"`);
                        delete state.customWords[normalizedWordName];
                    }
                }
                
                i = defIndex + 1;
                continue;
            }
        }
        
        // DEL単体で使用された場合（短縮形）
        if (normalizeToken(token) === "DEL" && i > 0) {
            const wordName = normalizeToken(tokens[i - 1]);
            if (state.customWords[wordName]) {
                // 他のカスタムワードで使用されているかチェック
                if (isWordReferencedByOthers(wordName)) {
                    log(`Cannot delete word "${wordName}": used in other custom words`);
                    state.output += `Error: Cannot delete "${wordName}" as it is used by other words\n`;
                } else {
                    log(`Deleted custom word "${wordName}" (short form)`);
                    delete state.customWords[wordName];
                }
                i += 1;
                continue;
            }
        }
        
        // 通常のトークン処理
        if (token !== "(" && token !== ")") {
            program.push(token);
            log(`Added token to program: "${token}"`);
        } else {
            log(`Skipped token: "${token}" (comment delimiter)`);
        }
        
        i++;
    }
    
    log(`Parsed program: [${program.join(', ')}]`);
    return program;
};

// 数値トークンまたは文字列リテラルの処理
const parseToken = token => {
    // 正規化したトークンで組み込みワードを検索
    const normalizedToken = normalizeToken(token);
    if (builtinWords[normalizedToken]) {
        return null;
    }
    
    // 文字列リテラルの場合
    if (token.startsWith('"') && token.endsWith('"')) {
        const stringValue = token.slice(1, -1);
        log(`Parsed string: ${token} -> "${stringValue}"`);
        return new HolonString(stringValue);
    }
    
    // 分数表記 (a/b) の場合
    if (token.includes("/")) {
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
    const number = parseInt(token, 10);
    if (isNaN(number)) {
        log(`Not a number or string: ${token}`);
        return null; // 数値でも文字列でもない場合はnullを返す
    }
    
    const fraction = new Fraction(number, 1);
    log(`Parsed integer: ${token} -> ${fraction.toString()}`);
    return fraction;
};

// インタプリタ
const interpret = program => {
    log(`Interpreting program with ${program.length} tokens`);

    // `LOOP` を含むワードなら、最初にレジスタをチェック
    if (program.includes("LOOP") && state.register === null) {
        log("LOOP: レジスタが無のため、ワード全体をスキップ");
        return; // ワード全体をスキップ
    }

    let i = 0;
    try {
        while (i < program.length) {
            const token = program[i];
            log(`Executing token ${i}: "${token}"`);

            // 数値または文字列の場合はスタックにプッシュ
            const parsedValue = parseToken(token);
            if (parsedValue !== null) {
                state.stack.push(parsedValue);
                log(`Pushed value to stack: ${parsedValue.toString()}`);
                i++;
                continue;
            }

            // 組み込みワードの場合
            const normalizedToken = normalizeToken(token);
            if (builtinWords[normalizedToken]) {
                log(`Executing builtin word: "${normalizedToken}"`);
                builtinWords[normalizedToken].execute();
                i++;
                continue;
            }

            // カスタムワードの場合
            if (state.customWords[normalizedToken]) {
                log(`Executing custom word: "${normalizedToken}"`);
                const customBody = state.customWords[normalizedToken].body;
                log(`Custom word body: [${customBody.join(', ')}]`);
                
                // `LOOP` の場合はレジスタの状態をチェックしながら実行
                if (customBody.includes("LOOP")) {
                    while (state.register !== null) {
                        interpret(customBody);
                    }
                } else {
                    interpret(customBody);
                }
                i++;
                continue;
            }

            // 未知のワード
            log(`Unknown word: "${token}"`);
            throw new Error(`Unknown word: ${token}`);
        }
    } catch (e) {
        log(`Error: ${e.message}`);
    }

    log(`Program execution completed`);
};



// 実行関数
const executeCode = code => {
    log(`==== Execution started ====`);
    try {
        log(`Input code: ${code}`);
        const tokens = tokenize(code);
        const program = parse(tokens);
        log(`Executing program`);
        interpret(program);
        log(`Final stack: [${state.stack.map(i => i.toString()).join(' ')}]`);
        updateUI();
        // 実行後に入力内容をクリア
        elements.input.value = "";
        log(`Input area cleared`);
    } catch (error) {
        log(`Error: ${error.message}`);
        state.output += `Error: ${error.message}\n`;
        // エラー時にはログも出力エリアに表示
        state.output += `\n===== Debug Logs =====\n${state.logs.join('\n')}\n`;
        updateUI();
    }
    log(`==== Execution completed ====`);
};

// 出力関数
const outputStackTop = () => {
    log(`==== Output started ====`);
    try {
        if (state.stack.length < 1) throw new Error("Stack underflow");
        const top = state.stack.pop();
        let output;
        
        // 文字列オブジェクトの場合は引用符なしで出力
        if (top instanceof HolonString) {
            output = top.value;
        } else {
            output = top.toString();
        }
        
        state.output += output + "\n";
        log(`Output: ${output}`);
        updateUI();
        // 実行後に入力内容をクリア
        elements.input.value = "";
        log(`Input area cleared after output`);
    } catch (error) {
        log(`Error: ${error.message}`);
        state.output += `Error: ${error.message}\n`;
        updateUI();
    }
    log(`==== Output completed ====`);
};

// イベントリスナー
const initEventListeners = () => {
    // キー入力イベントを監視
    elements.input.addEventListener("keydown", event => {
        // Shift+Enterの処理（実行のみ）
        if (event.key === "Enter" && event.shiftKey && !event.ctrlKey) {
            event.preventDefault(); // デフォルトの改行を防止
            log(`Shift+Enter pressed. Execute only.`);
            
            const code = elements.input.value;
            state.logs = [];   // ログをクリア
            executeCode(code);
        }
        
        // Ctrl+Enterの処理（出力のみ）
        else if (event.key === "Enter" && !event.shiftKey && event.ctrlKey) {
            event.preventDefault(); // デフォルトの改行を防止
            log(`Ctrl+Enter pressed. Output only.`);
            
            state.logs = [];   // ログをクリア
            outputStackTop();
        }
        
        // Shift+Ctrl+Enterの処理（実行して出力）
        else if (event.key === "Enter" && event.shiftKey && event.ctrlKey) {
            event.preventDefault(); // デフォルトの改行を防止
            log(`Shift+Ctrl+Enter pressed. Execute and output.`);
            
            const code = elements.input.value;
            state.logs = [];   // ログをクリア
            executeCode(code);
            outputStackTop();
        }
        
        // 通常のEnterキーは改行として処理
        // else if (event.key === "Enter") {
        //    改行は標準動作に任せる
        // }
    });
};

// 初期化
const init = () => {
    log(`Initializing Holon interpreter`);
    initBuiltinWords();
    initEventListeners();
    updateUI();
    log(`Initialization completed`);
};

// アプリケーション起動
window.addEventListener("DOMContentLoaded", init);