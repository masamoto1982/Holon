// GUI管理
const GUI = {
    mode: 'input', // 'input' or 'execution'
    stepMode: false, // ステップ実行モード
    
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
        
        // Shift+Enterで通常実行、Ctrl+Enterでステップ実行
        this.elements.codeInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                if (event.shiftKey) {
                    event.preventDefault();
                    this.executeCode();
                } else if (event.ctrlKey) {
                    event.preventDefault();
                    if (!this.stepMode) {
                        this.startStepExecution();
                    } else {
                        this.continueStepExecution();
                    }
                }
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
    
    // ステップ実行の開始
    async startStepExecution() {
        const code = this.elements.codeInput.value.trim();
        if (!code) return;
        
        // WASMインタープリタが利用可能か確認
        if (!window.HolonWasm || !window.ajisaiInterpreter) {
            if (window.HolonWasm) {
                window.ajisaiInterpreter = new window.HolonWasm.AjisaiInterpreter();
            } else {
                this.elements.outputDisplay.textContent = 'Error: WASM not loaded';
                return;
            }
        }
        
        try {
            // ステップ実行を初期化
            const result = window.ajisaiInterpreter.init_step(code);
            
            if (result === 'OK') {
                this.stepMode = true;
                this.elements.outputDisplay.textContent = 'Step mode: Press Ctrl+Enter to continue...';
                
                // 初回のステップ実行
                this.continueStepExecution();
            } else {
                this.elements.outputDisplay.textContent = result;
            }
        } catch (error) {
            this.elements.outputDisplay.textContent = `Error: ${error.message || error}`;
        }
    },
    
    // ステップ実行の継続
    async continueStepExecution() {
        if (!this.stepMode) return;
        
        try {
            const stepResult = window.ajisaiInterpreter.step();
            
            // スタックとレジスタを更新
            const stack = window.ajisaiInterpreter.get_stack();
            this.updateStackDisplay(this.convertWasmStack(stack));
            
            const register = window.ajisaiInterpreter.get_register();
            this.updateRegisterDisplay(this.convertWasmValue(register));
            
            // カスタムワードを更新
            const customWordsInfo = window.ajisaiInterpreter.get_custom_words_info();
            const customWordInfos = customWordsInfo.map(wordData => {
                if (Array.isArray(wordData)) {
                    return {
                        name: wordData[0],
                        description: wordData[1] || null,
                        protected: wordData[2] || false
                    };
                } else {
                    return wordData;
                }
            });
            this.renderWordButtons(this.elements.customWordsDisplay, customWordInfos, true);
            
            // 出力があれば追加表示
            if (stepResult.output) {
                const currentOutput = this.elements.outputDisplay.textContent;
                // ステップ情報と出力を両方表示
                if (stepResult.hasMore) {
                    const position = stepResult.position || 0;
                    const total = stepResult.total || 0;
                    this.elements.outputDisplay.textContent = 
                        stepResult.output + `\nStep ${position}/${total}: Press Ctrl+Enter to continue...`;
                } else {
                    // 実行完了時は出力のみ
                    this.elements.outputDisplay.textContent = stepResult.output || 'OK (Step execution completed)';
                }
            } else {
                // ステップ情報を表示
                if (stepResult.hasMore) {
                    const position = stepResult.position || 0;
                    const total = stepResult.total || 0;
                    this.elements.outputDisplay.textContent = 
                        `Step ${position}/${total}: Press Ctrl+Enter to continue...`;
                } else {
                    // 実行完了
                    this.elements.outputDisplay.textContent = 'OK (Step execution completed)';
                }
            }
            
            if (!stepResult.hasMore) {
                // 実行完了
                this.stepMode = false;
                this.elements.codeInput.value = '';
                
                // モバイルでは実行モードに切り替え
                if (this.isMobile()) {
                    this.setMode('execution');
                }
            }
        } catch (error) {
            this.stepMode = false;
            this.elements.outputDisplay.textContent = `Error: ${error.message || error}`;
        }
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
        // 組み込みワード（説明付き）
        const builtinWords = [
            { name: '+', description: '加算 - 暗黙の反復対応 ( a b -- a+b )' },
            { name: '-', description: '減算 - 暗黙の反復対応 ( a b -- a-b )' },
            { name: '*', description: '乗算 - 暗黙の反復対応 ( a b -- a*b )' },
            { name: '/', description: '除算 - 暗黙の反復対応 ( a b -- a/b )' },
            { name: '=', description: '等しい ( a b -- bool )' },
            { name: '>', description: 'より大きい - 暗黙の反復対応 ( a b -- bool )' },
            { name: '>=', description: '以上 - 暗黙の反復対応 ( a b -- bool )' },
            { name: '<', description: 'より小さい - 暗黙の反復対応 ( a b -- bool )' },
            { name: '<=', description: '以下 - 暗黙の反復対応 ( a b -- bool )' },
            { name: 'NOT', description: '論理否定 - 暗黙の反復対応 ( bool -- bool )' },
            { name: 'DUP', description: 'スタックトップを複製 ( a -- a a )' },
            { name: 'DROP', description: 'スタックトップを削除 ( a -- )' },
            { name: 'SWAP', description: '上位2つを交換 ( a b -- b a )' },
            { name: 'OVER', description: '2番目をコピー ( a b -- a b a )' },
            { name: 'ROT', description: '3番目を最上位へ ( a b c -- b c a )' },
            { name: 'NIP', description: '2番目を削除 ( a b -- b )' },
            { name: '>R', description: 'スタックからレジスタへ移動 ( a -- )' },
            { name: 'R>', description: 'レジスタからスタックへ移動 ( -- a )' },
            { name: 'R@', description: 'レジスタの値をコピー ( -- a )' },
            { name: 'LENGTH', description: 'ベクトルの長さ ( vec -- n )' },
            { name: 'HEAD', description: '最初の要素 ( vec -- elem )' },
            { name: 'TAIL', description: '最初以外の要素 ( vec -- vec\' )' },
            { name: 'CONS', description: '要素を先頭に追加 ( elem vec -- vec\' )' },
            { name: 'APPEND', description: '要素を末尾に追加 ( vec elem -- vec\' )' },
            { name: 'REVERSE', description: 'ベクトルを逆順に ( vec -- vec\' )' },
            { name: 'NTH', description: 'N番目の要素を取得（負数は末尾から） ( n vec -- elem )' },
            { name: 'UNCONS', description: 'ベクトルを先頭要素と残りに分解 ( vec -- elem vec\' )' },
            { name: 'EMPTY?', description: 'ベクトルが空かチェック ( vec -- bool )' },
            { name: 'DEF', description: '新しいワードを定義 ( vec str -- )' },
            { name: 'IF', description: '条件分岐 ( bool vec vec -- ... )' },
            { name: 'DEL', description: 'カスタムワードを削除 ( str -- )' },
            // 出力ワード
            { name: '.', description: '値を出力してドロップ ( a -- )' },
            { name: 'PRINT', description: '値を出力（ドロップしない） ( a -- a )' },
            { name: 'CR', description: '改行を出力 ( -- )' },
            { name: 'SPACE', description: 'スペースを出力 ( -- )' },
            { name: 'SPACES', description: 'N個のスペースを出力 ( n -- )' },
            { name: 'EMIT', description: '文字コードを文字として出力 ( n -- )' }
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
            
            // 説明がある場合はそれを表示、なければワード名のみ
            button.title = description || word;
            
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
        
        // カーソル位置に挿入
        input.value = text.substring(0, start) + word + text.substring(end);
        
        // カーソル位置を更新
        const newPos = start + word.length;
        input.selectionStart = newPos;
        input.selectionEnd = newPos;
        
        // フォーカスを維持
        input.focus();
    },
    
    // executeCode関数の修正（カスタムワード情報の取得部分）
    async executeCode() {
        const code = this.elements.codeInput.value.trim();
        if (!code) return;
        
        // ステップモードを終了
        this.stepMode = false;
        
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
            
            if (result.status === 'OK') {
                // 出力がある場合は表示、なければ'OK'
                const output = result.output || '';
                this.elements.outputDisplay.textContent = output || 'OK';
                
                // スタックを取得して表示
                const stack = window.ajisaiInterpreter.get_stack();
                this.updateStackDisplay(this.convertWasmStack(stack));
                
                // レジスタを取得して表示
                const register = window.ajisaiInterpreter.get_register();
                this.updateRegisterDisplay(this.convertWasmValue(register));
                
                // カスタムワードを更新（説明と保護状態付き）
                const customWordsInfo = window.ajisaiInterpreter.get_custom_words_info();
                console.log('Custom words info:', customWordsInfo);
                console.log('First word data:', customWordsInfo[0]); // 最初の要素を詳しく見る

                const customWordInfos = customWordsInfo.map(wordData => {
                    // wordDataが配列の場合: [名前, 説明, 保護状態]
                    if (Array.isArray(wordData)) {
                        console.log('Word data array:', wordData); // 配列の中身を表示
                        const info = {
                            name: wordData[0],
                            description: wordData[1] || null,
                            protected: wordData[2] || false
                        };
                        console.log('Processed info:', info);
                        return info;
                    } else {
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
                // エラー時（文字列が返ってきた場合）
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
