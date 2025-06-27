// GUI管理
const GUI = {
    mode: 'input', // 'input' or 'execution'
    
    // 要素の参照
    elements: {
        workspacePanel: null,
        statePanel: null,
        inputArea: null,
        outputArea: null,
        memoryArea: null,
        dictionaryArea: null,
        codeInput: null,
        outputDisplay: null,
        stackDisplay: null,
        registerDisplay: null,
        builtinWordsDisplay: null,
        customWordsDisplay: null
    },
    
    // 初期化
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.updateMobileView();
        this.renderDictionary();
        
        // 初期状態でスタックとレジスタを空表示
        this.updateStackDisplay([]);
        this.updateRegisterDisplay(null);
    },
    
    // DOM要素をキャッシュ
    cacheElements() {
        this.elements = {
            workspacePanel: document.getElementById('workspace-panel'),
            statePanel: document.getElementById('state-panel'),
            inputArea: document.querySelector('.input-area'),
            outputArea: document.querySelector('.output-area'),
            memoryArea: document.querySelector('.memory-area'),
            dictionaryArea: document.querySelector('.dictionary-area'),
            codeInput: document.getElementById('code-input'),
            outputDisplay: document.getElementById('output-display'),
            stackDisplay: document.getElementById('stack-display'),
            registerDisplay: document.getElementById('register-display'),
            builtinWordsDisplay: document.getElementById('builtin-words-display'),
            customWordsDisplay: document.getElementById('custom-words-display')
        };
    },
    
    // イベントリスナーの設定
    setupEventListeners() {
        // Runボタン
        document.getElementById('run-btn').addEventListener('click', () => {
            this.executeCode();
        });
        
        // Clearボタン
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.elements.codeInput.value = '';
        });
        
        // Shift+Enterでの実行
        this.elements.codeInput.addEventListener('keydown', (event) => {
            if (event.shiftKey && event.key === 'Enter') {
                event.preventDefault(); // デフォルトの改行を防ぐ
                this.executeCode();
            }
        });
        
        // Memoryエリアのタッチで入力モードに戻る（モバイルのみ）
        this.elements.memoryArea.addEventListener('click', () => {
            if (this.isMobile() && this.mode === 'execution') {
                this.setMode('input');
            }
        });
        
        // ウィンドウリサイズ時の処理
        window.addEventListener('resize', () => {
            this.updateMobileView();
        });
    },
    
    // モバイル判定
    isMobile() {
        return window.innerWidth <= 768;
    },
    
    // モード切り替え
    setMode(mode) {
        this.mode = mode;
        this.updateMobileView();
    },
    
    // モバイルビューの更新
    updateMobileView() {
        if (!this.isMobile()) {
            // デスクトップモードでは全て表示
            this.elements.inputArea.style.display = 'block';
            this.elements.outputArea.style.display = 'block';
            this.elements.memoryArea.style.display = 'block';
            this.elements.dictionaryArea.style.display = 'block';
            return;
        }
        
        // モバイルモード
        if (this.mode === 'input') {
            // 入力モード
            this.elements.inputArea.style.display = 'block';
            this.elements.outputArea.style.display = 'none';
            this.elements.memoryArea.style.display = 'none';
            this.elements.dictionaryArea.style.display = 'block';
        } else {
            // 実行モード
            this.elements.inputArea.style.display = 'none';
            this.elements.outputArea.style.display = 'block';
            this.elements.memoryArea.style.display = 'block';
            this.elements.dictionaryArea.style.display = 'none';
        }
    },
    
    // 辞書の描画
    renderDictionary() {
    // 組み込みワード
    const builtinWords = [
        '+', '-', '*', '/', '=', '>', '>=', '<', '<=',
        'DUP', 'DROP', 'SWAP', 'OVER', 'ROT',
        '>R', 'R>', 'R@',
        'LENGTH', 'HEAD', 'TAIL', 'CONS', 'REVERSE', 'NTH',
        'DEF', 'IF', 'WORDS', 'WORDS?'
    ];
    this.renderWordButtons(this.elements.builtinWordsDisplay, builtinWords, false);
    
    // カスタムワードは初期状態では空
    this.renderWordButtons(this.elements.customWordsDisplay, [], true);
},
    
    // ワードボタンの描画
renderWordButtons(container, words, isCustom = false) {
    container.innerHTML = '';
    words.forEach(wordInfo => {
        // wordInfoは文字列またはオブジェクト
        const word = typeof wordInfo === 'string' ? wordInfo : wordInfo.name;
        const description = typeof wordInfo === 'object' ? wordInfo.description : null;
        const isProtected = typeof wordInfo === 'object' ? wordInfo.protected : false;
        
        const button = document.createElement('button');
        button.textContent = word;
        button.className = 'word-button';
        
        // スタイルクラスを追加
        if (!isCustom) {
            // 組み込みワード
            button.classList.add('builtin');
        } else if (isProtected) {
            // 依存されているカスタムワード
            button.classList.add('protected');
        } else {
            // 通常のカスタムワード
            button.classList.add('deletable');
        }
        
        // 説明がある場合はツールチップを設定
        if (description) {
            button.title = description;
        } else if (!isCustom) {
            button.title = "組み込みワード（削除・上書き不可）";
        } else if (isProtected) {
            button.title = "他のワードから使用されています（削除・上書き不可）";
        } else {
            button.title = "カスタムワード（削除・上書き可能）";
        }
        
        button.addEventListener('click', () => {
            this.insertWord(word, isCustom);
        });
        container.appendChild(button);
    });
},
    
    // ワードの挿入
    insertWord(word, isCustom = false) {
    const input = this.elements.codeInput;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;
    
    // カスタムワードの場合は symbol: プレフィックスを付ける
    const insertText = isCustom ? `symbol:${word}` : word;
    
    // カーソル位置に挿入
    input.value = text.substring(0, start) + insertText + text.substring(end);
    
    // カーソル位置を更新
    const newPos = start + insertText.length;
    input.selectionStart = newPos;
    input.selectionEnd = newPos;
    
    // フォーカスを維持
    input.focus();
},
    
    // executeCode関数の修正（カスタムワード情報の取得部分）
async executeCode() {
    const code = this.elements.codeInput.value.trim();
    if (!code) return;
    
    // WASMインタープリタが利用可能か確認
    if (!window.HolonWasm || !window.ajisaiInterpreter) {
        // WASMが利用できない場合は初期化を試みる
        if (window.HolonWasm) {
            window.ajisaiInterpreter = new window.HolonWasm.AjisaiInterpreter();
        } else {
            this.elements.outputDisplay.textContent = 'Error: WASM not loaded';
            return;
        }
    }
    
    try {
        // コードを実行
        const result = window.ajisaiInterpreter.execute(code);
        
        if (result === 'OK') {
            // 成功時
            this.elements.outputDisplay.textContent = 'OK';
            
            // スタックを取得して表示
            const stack = window.ajisaiInterpreter.get_stack();
            this.updateStackDisplay(this.convertWasmStack(stack));
            
            // レジスタを取得して表示
            const register = window.ajisaiInterpreter.get_register();
            this.updateRegisterDisplay(this.convertWasmValue(register));
            
            // カスタムワードを更新（説明と保護状態付き）
            const customWordsInfo = window.ajisaiInterpreter.get_custom_words_info();
            const customWordInfos = customWordsInfo.map(wordData => {
                // wordDataが配列の場合: [名前, 説明, 保護状態]
                if (Array.isArray(wordData)) {
                    return {
                        name: wordData[0],
                        description: wordData[1] || null,
                        protected: wordData[2] || false
                    };
                } else {
                    // 後方互換性のため
                    return wordData;
                }
            });
            this.renderWordButtons(this.elements.customWordsDisplay, customWordInfos, true);
            
            // 成功時はテキストエディタをクリア
            this.elements.codeInput.value = '';
            
            // モバイルでは実行モードに切り替え
            if (this.isMobile()) {
                this.setMode('execution');
            }
        } else {
            // エラー時
            this.elements.outputDisplay.textContent = result;
            // エラー時はテキストエディタの内容を保持
        }
    } catch (error) {
        this.elements.outputDisplay.textContent = `Error: ${error.message || error}`;
        // エラー時はテキストエディタの内容を保持
    }
},
    
    // WASMの値をJSの形式に変換
    convertWasmValue(wasmValue) {
        if (!wasmValue || wasmValue === null) return null;
        
        if (wasmValue.type === 'vector' && Array.isArray(wasmValue.value)) {
            return {
                type: Types.VECTOR,
                value: wasmValue.value.map(v => this.convertWasmValue(v))
            };
        }
        
        const typeMap = {
            'number': Types.NUMBER,
            'string': Types.STRING,
            'boolean': Types.BOOLEAN,
            'symbol': Types.SYMBOL,
            'nil': Types.NIL
        };
        
        return {
            type: typeMap[wasmValue.type] || wasmValue.type,
            value: wasmValue.value
        };
    },
    
    // WASMのスタックをJSの形式に変換
    convertWasmStack(wasmStack) {
        if (!Array.isArray(wasmStack)) return [];
        return wasmStack.map(v => this.convertWasmValue(v));
    },
    
    // スタック表示の更新
    updateStackDisplay(stack) {
        const display = this.elements.stackDisplay;
        display.innerHTML = '';
        
        if (stack.length === 0) {
            const emptySpan = document.createElement('span');
            emptySpan.textContent = '(empty)';
            emptySpan.style.color = '#ccc';
            display.appendChild(emptySpan);
            return;
        }
        
        // スタックを左詰めで表示（トップが右）
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap-reverse';
        container.style.justifyContent = 'flex-start';
        container.style.alignContent = 'flex-start';
        
        stack.forEach((item, index) => {
            const elem = document.createElement('span');
            elem.className = 'stack-item';
            elem.textContent = this.formatValue(item);
            
            // スタックトップは強調
            if (index === stack.length - 1) {
                elem.style.fontWeight = 'bold';
                elem.style.opacity = '1';
            } else {
                elem.style.opacity = '0.7';
            }
            
            elem.style.margin = '2px 4px';
            elem.style.padding = '2px 6px';
            elem.style.backgroundColor = '#e0e0e0';
            elem.style.borderRadius = '3px';
            
            container.appendChild(elem);
        });
        
        display.appendChild(container);
    },
    
    // レジスタ表示の更新
    updateRegisterDisplay(value) {
        const display = this.elements.registerDisplay;
        display.innerHTML = '';
        
        if (value === null) {
            const emptySpan = document.createElement('span');
            emptySpan.textContent = '(empty)';
            emptySpan.style.color = '#ccc';
            display.appendChild(emptySpan);
        } else {
            display.textContent = this.formatValue(value);
        }
    },
    
    // 値のフォーマット
    formatValue(item) {
        if (!item) return 'undefined';
        
        if (item.type === Types.NUMBER) {
            // 数値または分数文字列として表示
            if (typeof item.value === 'string') {
                return item.value; // 分数または大きな整数
            } else {
                return item.value.toString();
            }
        } else if (item.type === Types.STRING) {
            return `"${item.value}"`;
        } else if (item.type === Types.SYMBOL) {
            return item.value;
        } else if (item.type === Types.BOOLEAN) {
            return item.value ? 'true' : 'false';
        } else if (item.type === Types.VECTOR) {
            if (Array.isArray(item.value)) {
                const elements = item.value.map(v => this.formatValue(v)).join(' ');
                return `[ ${elements} ]`;
            } else {
                return '[ ]';
            }
        } else if (item.type === Types.NIL) {
            return 'nil';
        } else {
            return JSON.stringify(item.value);
        }
    }
};
