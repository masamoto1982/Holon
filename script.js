// script.js - Holon language with FORTH inspired stack-based logic

// データ構造 - スタック、レジスタ、辞書とログの管理
const state = {
  stack: [],          // メインスタック
  registers: {},      // レジスタ（名前付き変数）
  dictionary: {},     // ワード辞書
  output: "",         // 出力バッファ
  logs: [],           // デバッグログ
};

// デバッグログ機能
const log = message => {
  state.logs.push(`${new Date().toISOString().substr(11, 8)}: ${message}`);
  console.log(message);
};

// トークンを正規化（大文字に変換）する関数
const normalizeToken = token => token.toUpperCase();

// 分数クラス（既存のコードから流用）
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

// スタック操作ユーティリティ
const stackOps = {
  // スタックにプッシュ
  push: (value) => {
    state.stack.push(value);
    log(`Pushed to stack: ${value}`);
    return value;
  },

  // スタックからポップ
  pop: () => {
    if (state.stack.length === 0) {
      throw new Error("Stack underflow");
    }
    const value = state.stack.pop();
    log(`Popped from stack: ${value}`);
    return value;
  },

  // スタックの先頭要素を覗く（削除せず）
  peek: () => {
    if (state.stack.length === 0) {
      return null;
    }
    return state.stack[state.stack.length - 1];
  },

  // スタックをクリア
  clear: () => {
    state.stack = [];
    log("Stack cleared");
  },

  // スタックのサイズを取得
  size: () => {
    return state.stack.length;
  }
};

// レジスタ操作ユーティリティ
const registerOps = {
  // レジスタに値を設定
  set: (name, value) => {
    const normalizedName = normalizeToken(name);
    state.registers[normalizedName] = value;
    log(`Register ${normalizedName} set to: ${value}`);
    return value;
  },

  // レジスタから値を取得
  get: (name) => {
    const normalizedName = normalizeToken(name);
    const value = state.registers[normalizedName];
    if (value === undefined) {
      log(`Register ${normalizedName} not found`);
      return null;
    }
    log(`Retrieved register ${normalizedName}: ${value}`);
    return value;
  },

  // レジスタを削除
  remove: (name) => {
    const normalizedName = normalizeToken(name);
    if (state.registers[normalizedName] !== undefined) {
      delete state.registers[normalizedName];
      log(`Removed register ${normalizedName}`);
      return true;
    }
    log(`Register ${normalizedName} not found for removal`);
    return false;
  },

  // すべてのレジスタを取得
  getAll: () => {
    return { ...state.registers };
  }
};

// 辞書操作ユーティリティ
const dictionaryOps = {
  // 辞書にワードを定義
  define: (name, func, isBuiltin = false, description = '') => {
    const normalizedName = normalizeToken(name);
    state.dictionary[normalizedName] = {
      func: func,
      isBuiltin: isBuiltin,
      description: description
    };
    log(`Defined word "${normalizedName}" in dictionary`);
    return func;
  },

  // 辞書からワードを取得
  lookup: (name) => {
    const normalizedName = normalizeToken(name);
    const entry = state.dictionary[normalizedName];
    if (entry === undefined) {
      log(`Word "${normalizedName}" not found in dictionary`);
      return null;
    }
    log(`Found word "${normalizedName}" in dictionary`);
    return entry.func;
  },

  // 辞書からワードのメタデータを取得
  getMetadata: (name) => {
    const normalizedName = normalizeToken(name);
    const entry = state.dictionary[normalizedName];
    if (entry === undefined) {
      return null;
    }
    return {
      isBuiltin: entry.isBuiltin,
      description: entry.description
    };
  },

  // 辞書からワードを削除
  remove: (name) => {
    const normalizedName = normalizeToken(name);
    if (state.dictionary[normalizedName] !== undefined) {
      if (state.dictionary[normalizedName].isBuiltin) {
        log(`Cannot remove built-in word "${normalizedName}"`);
        return false;
      }
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
  },
  
  // 組み込みワードのリスト取得
  listBuiltinWords: () => {
    return Object.entries(state.dictionary)
      .filter(([_, entry]) => entry.isBuiltin)
      .map(([name]) => name);
  },
  
  // カスタムワードのリスト取得
  listCustomWords: () => {
    return Object.entries(state.dictionary)
      .filter(([_, entry]) => !entry.isBuiltin)
      .map(([name]) => name);
  }
};

// 各ドットに割り当てる値 (2の累乗)
const dotValues = [
  1, 2, 4, 8, 16,
  32, 64, 128, 256, 512,
  1024, 2048, 4096, 8192, 16384,
  32768, 65536, 131072, 262144, 524288,
  1048576, 2097152, 4194304, 8388608, 16777216
];

// 文字認識のためのパターン定義（合計値→文字のマッピング）
const letterPatterns = {
  17836036: 'A',
  28611899: 'B',
  32539711: 'C',
  1224985: 'D',
  32567296: 'E',
  1113151: 'F',
  33092671: 'G',
  18415153: 'H',
  32641183: 'I',
  7475359: 'J',
  17990833: 'K',
  32539681: 'L',
  18405233: 'M',
  18667121: 'N',
  33080895: 'O',
  1113663: 'P',
  33347135: 'Q',
  18153023: 'R',
  33061951: 'S',
  4329631: 'T',
  33080881: 'U',
  4204561: 'V',
  18732593: 'W',
  18157905: 'X',
  4329809: 'Y',
  32575775: 'Z',
};

// ドットとワードのマッピング
const dotWordMapping = {
  // 数字ドット（1-9）は長押しで数値入力
  
  // 組み込みワードをドットに割り当て
  '128': '+',       // ワード +
  '131072': '-',    // ワード -
  '2048': '*',      // ワード *
  '8192': '/',      // ワード /
  
  '32': 'DUP',      // ワード DUP
  '512': 'DROP',    // ワード DROP
  '1024': 'SWAP',   // ワード SWAP
  '8388608': 'OVER', // ワード OVER
  '16384': 'ROT',    // ワード ROT
  '256': 'PRINTLN',  // ワード PRINTLN
  '64': 'DEF',      // ワード DEF
  '16': 'IF',       // ワード IF
};

// モバイルかどうかを検出する関数
const isMobileDevice = () => {
  return window.innerWidth <= 768;
};

// なぞり書きの状態を追跡（複数ストローク対応）
const drawState = {
  isActive: false,
  detectedDots: new Set(),
  totalValue: 0,
  lastStrokeTime: 0,        // 最後のストロークの時間
  multiStrokeTimeout: 2000  // 複数ストローク許容時間（ミリ秒）
};

// 基本機能ワードの初期化
const initializeBuiltins = () => {
  // スタック操作
  dictionaryOps.define("DUP", () => {
    if (state.stack.length < 1) throw new Error("DUP requires at least one item on the stack");
    const value = stackOps.peek();
    stackOps.push(value);
  }, true, 'スタックの最上位の値を複製します');

  dictionaryOps.define("DROP", () => {
    if (state.stack.length < 1) throw new Error("DROP requires at least one item on the stack");
    stackOps.pop();
  }, true, 'スタックの最上位の値を捨てます');

  dictionaryOps.define("SWAP", () => {
    if (state.stack.length < 2) throw new Error("SWAP requires at least two items on the stack");
    const a = stackOps.pop();
    const b = stackOps.pop();
    stackOps.push(a);
    stackOps.push(b);
  }, true, 'スタックの上位2つの値を入れ替えます');

  dictionaryOps.define("OVER", () => {
    if (state.stack.length < 2) throw new Error("OVER requires at least two items on the stack");
    const a = stackOps.pop();
    const b = stackOps.peek();
    stackOps.push(a);
    stackOps.push(b);
  }, true, '2番目の値のコピーをスタックの最上位に置きます');

  dictionaryOps.define("ROT", () => {
    if (state.stack.length < 3) throw new Error("ROT requires at least three items on the stack");
    const c = stackOps.pop();
    const b = stackOps.pop();
    const a = stackOps.pop();
    stackOps.push(b);
    stackOps.push(c);
    stackOps.push(a);
  }, true, '上位3つの値をローテーションします (a b c -> b c a)');

  // 算術演算
  dictionaryOps.define("+", () => {
    if (state.stack.length < 2) throw new Error("+ requires two numbers on the stack");
    const b = stackOps.pop();
    const a = stackOps.pop();
    
    if (a instanceof Fraction && b instanceof Fraction) {
      stackOps.push(a.add(b));
    } else {
      throw new Error("+ requires numeric arguments");
    }
  }, true, 'スタックの上位2つの値を加算します');

  dictionaryOps.define("-", () => {
    if (state.stack.length < 2) throw new Error("- requires two numbers on the stack");
    const b = stackOps.pop();
    const a = stackOps.pop();
    
    if (a instanceof Fraction && b instanceof Fraction) {
      stackOps.push(a.subtract(b));
    } else {
      throw new Error("- requires numeric arguments");
    }
  }, true, 'スタックの上位2つの値を減算します (a b -> a-b)');

  dictionaryOps.define("*", () => {
    if (state.stack.length < 2) throw new Error("* requires two numbers on the stack");
    const b = stackOps.pop();
    const a = stackOps.pop();
    
    if (a instanceof Fraction && b instanceof Fraction) {
      stackOps.push(a.multiply(b));
    } else {
      throw new Error("* requires numeric arguments");
    }
  }, true, 'スタックの上位2つの値を乗算します');

  dictionaryOps.define("/", () => {
    if (state.stack.length < 2) throw new Error("/ requires two numbers on the stack");
    const b = stackOps.pop();
    const a = stackOps.pop();
    
    if (a instanceof Fraction && b instanceof Fraction) {
      if (b.numerator === 0) {
        throw new Error("Division by zero");
      }
      stackOps.push(a.divide(b));
    } else {
      throw new Error("/ requires numeric arguments");
    }
  }, true, 'スタックの上位2つの値を除算します (a b -> a/b)');

  // 条件分岐
  dictionaryOps.define("IF", () => {
    if (state.stack.length < 3) throw new Error("IF requires three items on the stack");
    const falseCase = stackOps.pop();
    const trueCase = stackOps.pop();
    const condition = stackOps.pop();
    
    // 条件が0でなければtrue、0ならfalse
    if (condition instanceof Fraction && condition.numerator !== 0) {
      stackOps.push(trueCase);
    } else {
      stackOps.push(falseCase);
    }
  }, true, '条件分岐を行います');

  // ワード定義
  dictionaryOps.define("DEF", () => {
    // 実際の実装はトークン処理時に行う
  }, true, '新しいワードを定義します');

  // ワード削除
  dictionaryOps.define("DEL", () => {
    // 実際の実装はトークン処理時に行う
  }, true, 'ワードを削除します');
  
  // 出力ワード
  dictionaryOps.define("PRINTLN", () => {
    if (state.stack.length < 1) throw new Error("PRINTLN requires at least one item on the stack");
    const value = stackOps.pop();
    if (value instanceof HolonString) {
      state.output += value.value + "\n";
    } else {
      state.output += value.toString() + "\n";
    }
  }, true, 'スタックの最上位の値を出力します');
  
  // スタッククリア
  dictionaryOps.define("CLEAR", () => {
    stackOps.clear();
  }, true, 'スタックをクリアします');
  
  // レジスタ操作
  dictionaryOps.define(">R", () => {
    if (state.stack.length < 1) throw new Error(">R requires at least one item on the stack");
    const value = stackOps.pop();
    registerOps.set("R", value);
  }, true, 'スタックの最上位の値をRレジスタに格納します');
  
  dictionaryOps.define("R>", () => {
    const value = registerOps.get("R");
    if (value === null) throw new Error("R register is empty");
    stackOps.push(value);
  }, true, 'Rレジスタの値をスタックにプッシュします');
  
  // 比較演算
  dictionaryOps.define("<", () => {
    if (state.stack.length < 2) throw new Error("< requires two numbers on the stack");
    const b = stackOps.pop();
    const a = stackOps.pop();
    
    if (a instanceof Fraction && b instanceof Fraction) {
      stackOps.push(new Fraction(a.lessThan(b) ? 1 : 0, 1));
    } else {
      throw new Error("< requires numeric arguments");
    }
  }, true, '比較演算 a < b を行います (a b -> bool)');
  
  dictionaryOps.define("=", () => {
    if (state.stack.length < 2) throw new Error("= requires two items on the stack");
    const b = stackOps.pop();
    const a = stackOps.pop();
    
    if (a instanceof Fraction && b instanceof Fraction) {
      stackOps.push(new Fraction(a.equals(b) ? 1 : 0, 1));
    } else {
      stackOps.push(new Fraction(a === b ? 1 : 0, 1));
    }
  }, true, '等価比較を行います (a b -> bool)');
};

// UI要素の取得
const elements = {
  output: null,
  input: null,
  builtinWords: null,
  customWords: null
};

// ドットの設定と構成
const setupFunctionsSection = () => {
  const container = elements.builtinWords;
  if (!container) {
    console.error("Built-in words container not found!");
    return;
  }
  
  // モバイルモードかどうかを確認
  const mobile = isMobileDevice();
  
  container.innerHTML = `
    <h3 title="XXX">Built-In Words</h3>
    <div id="dot-grid" class="${mobile ? 'dot-grid' : 'word-group'}"></div>
  `;
  
  // モバイルモードとデスクトップモード両方で同じ関数を使用
  setupDotGrid(mobile);
};

// ドットグリッド設定 - モバイルモードとデスクトップモード両方で使用
const setupDotGrid = (isMobile) => {
  const dotGrid = document.getElementById('dot-grid');
  if (!dotGrid) return;
  
  // ドットグリッドをクリア
  dotGrid.innerHTML = '';
  
  if (isMobile) {
    // モバイルモード: 5x5グリッドレイアウト
    // Flexboxを使ったレイアウト
    for (let row = 0; row < 5; row++) {
      const rowContainer = document.createElement('div');
      rowContainer.className = 'dot-row';
      
      // 各行に5つのドットを配置
      for (let col = 0; col < 5; col++) {
        const index = row * 5 + col;
        const value = dotValues[index];
        
        // ドットを作成
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.dataset.index = index;
        dot.dataset.value = value;
        
        // 数字ドットの位置を特定
        const numericPositions = {
          0: { digit: '1' },
          2: { digit: '2' },
          4: { digit: '3' },
          10: { digit: '4' },
          12: { digit: '5' },
          14: { digit: '6' },
          20: { digit: '7' },
          22: { digit: '8' },
          24: { digit: '9' }
        };
        
        // ワードドットの位置
        const wordPositions = {
          1: { word: 'DEF' },
          3: { word: 'DEL' },
          5: { word: 'DUP' },
          6: { word: 'DROP' },
          7: { word: 'SWAP' },
          8: { word: 'OVER' },
          9: { word: 'ROT' },
          11: { word: '>R' },
          13: { word: 'R>' },
          15: { word: 'CLEAR' },
          16: { word: '+' },
          17: { word: '-' },
          18: { word: '*' },
          19: { word: '/' },
          21: { word: '<' },
          23: { word: '=' },
        };
        
        // 数字ドットの場合
        if (numericPositions[index]) {
          dot.classList.add('numeric');
          const config = numericPositions[index];
          dot.dataset.digit = config.digit;
          
          // 数字を表示
          const digitElement = document.createElement('div');
          digitElement.className = 'digit';
          digitElement.textContent = config.digit;
          dot.appendChild(digitElement);
        }
        // ワードドットの場合
        else if (wordPositions[index]) {
          const config = wordPositions[index];
          dot.classList.add('word-dot');
          dot.dataset.word = config.word;
          dot.setAttribute('title', config.word);
          
          const wordElement = document.createElement('div');
          wordElement.className = 'word';
          wordElement.textContent = config.word;
          dot.appendChild(wordElement);
        }
        
        rowContainer.appendChild(dot);
      }
      
      dotGrid.appendChild(rowContainer);
    }
    
    
    
    // 特殊ボタン行を追加（*、0、#）
    const specialRow = document.createElement('div');
    specialRow.className = 'special-row';
    
    // * ボタン - DELETEとして機能
    const deleteButton = document.createElement('div');
    deleteButton.className = 'special-button delete';
    deleteButton.textContent = '*';
    deleteButton.dataset.action = 'delete';
    deleteButton.setAttribute('title', '削除');
    specialRow.appendChild(deleteButton);
    
    // 0 ボタン - 長押しで0を入力
    const zeroButton = document.createElement('div');
    zeroButton.className = 'dot numeric';
    
    const zeroDigit = document.createElement('div');
    zeroDigit.className = 'digit';
    zeroDigit.textContent = '0';
    zeroButton.appendChild(zeroDigit);
    
    zeroButton.dataset.digit = '0';
    specialRow.appendChild(zeroButton);
    
    // # ボタン - 空白入力として機能
    const spaceButton = document.createElement('div');
    spaceButton.className = 'special-button space';
    spaceButton.textContent = '#';
    spaceButton.dataset.action = 'space';
    spaceButton.setAttribute('title', '空白');
    specialRow.appendChild(spaceButton);
    
    dotGrid.appendChild(specialRow);
    
    // 線描画用のキャンバス
    const canvas = document.createElement('canvas');
    canvas.id = 'line-canvas';
    canvas.width = dotGrid.offsetWidth;
    canvas.height = dotGrid.offsetHeight;
    dotGrid.appendChild(canvas);
    
    // 各ドットにイベントリスナーを設定
    setupDotEventListeners();
    
    // 特殊ボタンのイベントリスナーを設定
    setupSpecialButtonListeners();
  } else {
    // デスクトップモード: 組み込みワードと数字キーを表示
    
    // 通常のワードボタン部分
    const wordContainer = document.createElement('div');
    wordContainer.className = 'word-container';
    
    // すべての組み込みワードを取得
    const builtinWords = dictionaryOps.listBuiltinWords().sort();
    
    // 各ワードのボタンを作成
    builtinWords.forEach(word => {
      const wordButton = document.createElement('button');
      wordButton.className = 'word-button';
      wordButton.textContent = word;
      
      // ワードの説明をツールチップに設定
      const metadata = dictionaryOps.getMetadata(word);
      if (metadata && metadata.description) {
        wordButton.title = metadata.description;
      }
      
      // クリックイベント - ワードを入力エリアに挿入
      wordButton.addEventListener('click', () => {
        insertAtCursor(word);
      });
      
      wordContainer.appendChild(wordButton);
    });
    
    dotGrid.appendChild(wordContainer);
    
    // 数字キー部分の追加
    const numericContainer = document.createElement('div');
    numericContainer.className = 'numeric-container';
    
    // 数字キー (1-9)
    for (let i = 1; i <= 9; i++) {
      const numButton = document.createElement('button');
      numButton.className = 'num-button';
      numButton.textContent = i;
      
      // クリックイベント
      numButton.addEventListener('click', () => {
        insertAtCursor(i.toString());
      });
      
      numericContainer.appendChild(numButton);
    }
    
    // 特殊キー行 (*, 0, #)
    const specialKeysContainer = document.createElement('div');
    specialKeysContainer.className = 'special-keys-container';
    
    // * キー (削除)
    const deleteButton = document.createElement('button');
    deleteButton.className = 'special-button delete';
    deleteButton.textContent = '*';
    deleteButton.title = '削除';
    deleteButton.addEventListener('click', () => {
      // テキストエリアの文字を削除
      const textarea = elements.input;
      const cursorPos = textarea.selectionStart;
      
      if (cursorPos > 0) {
        const textBefore = textarea.value.substring(0, cursorPos - 1);
        const textAfter = textarea.value.substring(cursorPos);
        
        textarea.value = textBefore + textAfter;
        textarea.selectionStart = textarea.selectionEnd = cursorPos - 1;
      }
      
      textarea.focus();
    });
    specialKeysContainer.appendChild(deleteButton);
    
    // 0 キー
    const zeroButton = document.createElement('button');
    zeroButton.className = 'num-button';
    zeroButton.textContent = '0';
    zeroButton.addEventListener('click', () => {
      insertAtCursor('0');
    });
    specialKeysContainer.appendChild(zeroButton);
    
    // # キー (空白)
    const spaceButton = document.createElement('button');
    spaceButton.className = 'special-button space';
    spaceButton.textContent = '#';
    spaceButton.title = '空白';
    spaceButton.addEventListener('click', () => {
      insertAtCursor(' ');
    });
    specialKeysContainer.appendChild(spaceButton);
    
    numericContainer.appendChild(specialKeysContainer);
    dotGrid.appendChild(numericContainer);
  }
};

// ドットイベントリスナーの設定（モバイルモード用）
// ドットイベントリスナーの設定（モバイルモード用）
const setupDotEventListeners = () => {
  const dots = document.querySelectorAll('.dot');
  
  dots.forEach(dot => {
    let longPressTimer;
    let moveDetected = false;
    
    // タッチ/マウス開始
    dot.addEventListener('mousedown', e => {
      e.preventDefault();
      moveDetected = false;
      handleDotStart(dot, e);
    });
    
    dot.addEventListener('touchstart', e => {
      e.preventDefault();
      moveDetected = false;
      handleDotStart(dot, e);
    });
    
    // タッチ/マウス終了 - 長押しタイマーをクリア
    dot.addEventListener('mouseup', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });
    
    dot.addEventListener('touchend', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });
  });
  
  // 移動検出用イベント
  document.addEventListener('mousemove', e => {
    if (drawState.isActive) {
      detectDot(e);
    }
  });
  
  document.addEventListener('touchmove', e => {
    if (drawState.isActive) {
      detectDot(e);
    }
  });
  
  // 終了イベント
  document.addEventListener('mouseup', () => {
    endDrawing();
  });
  
  document.addEventListener('touchend', () => {
    endDrawing();
  });
  
  // ドットの開始処理
  function handleDotStart(dot, e) {
    const digit = dot.dataset.digit;
    const word = dot.dataset.word;
    
    // 数字ドットの場合、長押しとなぞり書きを両方セットアップ
    if (digit) {
      // 長押しタイマーをセット
      longPressTimer = setTimeout(() => {
        // 移動が検出されていなければ数字入力
        if (!moveDetected) {
          insertAtCursor(digit);
        }
        longPressTimer = null;
      }, 500);
      
      // 数字ドットならなぞり書き開始
      if (digit >= '1' && digit <= '9') {
        startDrawing(dot);
        moveDetected = true; // なぞり書き開始したことを記録
      }
    } 
    // ワードドットの場合は長押しのみ
    else if (word) {
      longPressTimer = setTimeout(() => {
        insertAtCursor(word);
        longPressTimer = null;
      }, 500);
    }
  }
};

// 特殊ボタンのイベントリスナー設定
const setupSpecialButtonListeners = () => {
  // 削除ボタン (*)
  const deleteButton = document.querySelector('.special-button[data-action="delete"]');
  if (deleteButton) {
    deleteButton.addEventListener('click', () => {
      // テキストエリアの文字を削除（DELETEキーの挙動）
      const textarea = elements.input;
      const cursorPos = textarea.selectionStart;
      
      // カーソル位置が0より大きい場合のみ削除
      if (cursorPos > 0) {
        const textBefore = textarea.value.substring(0, cursorPos - 1);
        const textAfter = textarea.value.substring(cursorPos);
        
        textarea.value = textBefore + textAfter;
        textarea.selectionStart = textarea.selectionEnd = cursorPos - 1;
      }
      
      textarea.focus();
    });
  }
  
  // 空白ボタン (#)
  const spaceButton = document.querySelector('.special-button[data-action="space"]');
  if (spaceButton) {
    spaceButton.addEventListener('click', () => {
      // 空白文字を挿入
      insertAtCursor(' ');
    });
  }
  
  // 0ボタン - 長押しで0を入力
  const zeroButton = document.querySelector('.dot[data-digit="0"]');
  if (zeroButton) {
    let longPressTimer;
    
    zeroButton.addEventListener('mousedown', () => {
      longPressTimer = setTimeout(() => {
        insertAtCursor('0');
        longPressTimer = null;
      }, 500);
    });
    
    zeroButton.addEventListener('mouseup', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });
    
    zeroButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      longPressTimer = setTimeout(() => {
        insertAtCursor('0');
        longPressTimer = null;
      }, 500);
    });
    
    zeroButton.addEventListener('touchend', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });
  }
};

// なぞり書き開始
const startDrawing = (dot) => {
  // モバイルモードでない場合は何もしない
  if (!isMobileDevice()) return;
  
  // 始点がドットでない場合や特殊ボタンの場合はスキップ
  if (!dot || dot.classList.contains('special-button') || !dot.dataset.value) return;
  
  const now = new Date().getTime();
  
  // 新しい描画開始かストローク継続かを判断
  if (!drawState.isActive || now - drawState.lastStrokeTime > drawState.multiStrokeTimeout) {
    // 新しい描画開始
    drawState.isActive = true;
    drawState.detectedDots = new Set();
    drawState.totalValue = 0;
    clearCanvas();
    document.querySelectorAll('.dot.detected').forEach(d => {
      d.classList.remove('detected');
    });
  }
  
  // 最初のドットを追加
  addDetectedDot(dot);
  log(`Started drawing/continued with dot ${dot.dataset.index}`);
};

// なぞり書き終了
const endDrawing = () => {
  if (!drawState.isActive) return;
  
  const now = new Date().getTime();
  drawState.lastStrokeTime = now;
  
  // 複数ストローク用のタイマーをセット
  setTimeout(() => {
    // タイマー完了時に現在時刻を確認
    const currentTime = new Date().getTime();
    // 最後のストロークから十分な時間が経過した場合のみ文字認識実行
    if (currentTime - drawState.lastStrokeTime >= drawState.multiStrokeTimeout - 100) {
      if (drawState.detectedDots.size > 1) {
        const detectedLetter = recognizeLetter(drawState.totalValue);
        if (detectedLetter) {
          log(`Recognized letter: ${detectedLetter}`);
          insertAtCursor(detectedLetter);
        }
      }
      
      // 視覚効果をクリア
      clearCanvas();
      document.querySelectorAll('.dot.detected').forEach(d => {
        d.classList.remove('detected');
      });
      
      drawState.isActive = false;
      drawState.detectedDots = new Set();
      drawState.totalValue = 0;
      log(`Complete drawing recognition, reset state`);
    }
  }, drawState.multiStrokeTimeout);
  
  // なぞり書きの状態は維持し、新しいストロークを許可
  log(`Ended stroke, total value so far: ${drawState.totalValue}`);
};

// ドット検出
const detectDot = (e) => {
  if (!drawState.isActive) return;
  
  const point = e.type.includes('touch') ? e.touches[0] : e;
  const x = point.clientX;
  const y = point.clientY;
  
  // すべてのドットをチェック
  document.querySelectorAll('.dot').forEach(dot => {
    // 特殊ボタンまたは既に検出されたドットはスキップ
    if (dot.classList.contains('special-button') || drawState.detectedDots.has(dot)) return;
    
    const rect = dot.getBoundingClientRect();
    // ポインターがドット上にあるか
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      addDetectedDot(dot);
    }
  });
  
  // キャンバスの線を更新
  updateCanvas();
};

// 検出されたドットを追加
const addDetectedDot = (dot) => {
  // すでに検出済みならスキップ
  if (drawState.detectedDots.has(dot)) return;
  
  dot.classList.add('detected');
  drawState.detectedDots.add(dot);
  
  // 2の累乗値を追加（合計値を計算）
  if (dot.dataset.value) {
    drawState.totalValue += parseInt(dot.dataset.value, 10);
  }
  
  log(`Detected dot ${dot.dataset.index}, value: ${dot.dataset.value}, current total: ${drawState.totalValue}`);
};

// 合計値から文字を認識
const recognizeLetter = (totalValue) => {
  log(`Recognizing letter for total value: ${totalValue}`);
  
  // 合計値が既知のパターンに一致するか確認
  const letter = letterPatterns[totalValue];
  
  if (letter) {
    log(`Recognized letter: ${letter}`);
    return letter;
  }
  
  // 最も近い値を見つける（許容範囲内）
  const tolerance = 1000; // 許容誤差
  let closestDiff = Infinity;
  let closestLetter = null;
  
  for (const [value, l] of Object.entries(letterPatterns)) {
    const numValue = parseInt(value, 10);
    const diff = Math.abs(numValue - totalValue);
    
    if (diff < tolerance && diff < closestDiff) {
      closestDiff = diff;
      closestLetter = l;
    }
  }
  
  if (closestLetter) {
    log(`Found closest letter: ${closestLetter} (diff: ${closestDiff})`);
    return closestLetter;
  }
  
  log('No matching letter found');
  return null;
};

// キャンバスを更新
const updateCanvas = () => {
  const canvas = document.getElementById('line-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const dotGrid = document.getElementById('dot-grid');
  const dotGridRect = dotGrid.getBoundingClientRect();
  
  canvas.width = dotGridRect.width;
  canvas.height = dotGridRect.height;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  
  // 検出されたドットの中心点を通る線を描画
  let isFirst = true;
  drawState.detectedDots.forEach(dot => {
    const rect = dot.getBoundingClientRect();
    const x = rect.left - dotGridRect.left + rect.width / 2;
    const y = rect.top - dotGridRect.top + rect.height / 2;
    
    if (isFirst) {
      ctx.moveTo(x, y);
      isFirst = false;
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  ctx.stroke();
};

// キャンバスをクリア
const clearCanvas = () => {
  const canvas = document.getElementById('line-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// カーソル位置にテキストを挿入する関数
const insertAtCursor = (text) => {
  const textarea = elements.input;
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);
  const textAfter = textarea.value.substring(cursorPos);
  
  textarea.value = textBefore + text + textAfter;
  textarea.selectionStart = textarea.selectionEnd = cursorPos + text.length;
  textarea.focus();
};

// メモリ表示領域の初期化と更新部分を修正
const initializeMemoryDisplays = () => {
  // スタック表示領域の初期化
  const stackArea = document.querySelector('.stack-area');
  if (stackArea && !stackArea.querySelector('.stack-display')) {
    const stackDisplay = document.createElement('div');
    stackDisplay.className = 'stack-display';
    stackArea.appendChild(stackDisplay);
  }
  
  // レジスタ表示領域の初期化
  const registerArea = document.querySelector('.register-area');
  if (registerArea && !registerArea.querySelector('.register-display')) {
    const registerDisplay = document.createElement('div');
    registerDisplay.className = 'register-display';
    registerArea.appendChild(registerDisplay);
  }
};

// スタック表示を更新
const updateStackDisplay = () => {
  const stackArea = document.querySelector('.stack-area');
  if (!stackArea) return;
  
  stackArea.innerHTML = '<h3 title="XXX">Stack</h3>';
  
  // スタック表示エリアを作成
  const stackDisplay = document.createElement('div');
  stackDisplay.className = 'stack-display';
  
  // スタックの内容を表示
  if (state.stack.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'Stack is empty';
    stackDisplay.appendChild(emptyMessage);
  } else {
    // スタックの内容を横並びで表示（左詰め）
    const stackContent = document.createElement('div');
    stackContent.className = 'memory-content';
    
    // スタックの内容を空白区切りで表示
    stackContent.textContent = state.stack.map(item => item.toString()).join(' ');
    
    stackDisplay.appendChild(stackContent);
  }
  
  stackArea.appendChild(stackDisplay);
};

// レジスタ表示を更新
const updateRegisterDisplay = () => {
  const registerArea = document.querySelector('.register-area');
  if (!registerArea) return;
  
  registerArea.innerHTML = '<h3 title="XXX">Registers</h3>';
  
  // レジスタ表示エリアを作成
  const registerDisplay = document.createElement('div');
  registerDisplay.className = 'register-display';
  
  // レジスタの内容を表示
  const registers = registerOps.getAll();
  const keys = Object.keys(registers);
  
  if (keys.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No registers defined';
    registerDisplay.appendChild(emptyMessage);
  } else {
    // レジスタの内容を横並びで表示
    const registerContent = document.createElement('div');
    registerContent.className = 'memory-content';
    
    // 各レジスタを「名前:値」の形式で表示
    registerContent.textContent = keys.map(key => 
      `${key}:${registers[key].toString()}`
    ).join(' ');
    
    registerDisplay.appendChild(registerContent);
  }
  
  registerArea.appendChild(registerDisplay);
};

// カスタムワード表示を更新
const updateCustomWordsDisplay = () => {
  const customWordsArea = elements.customWords;
  if (!customWordsArea) return;
  
  customWordsArea.innerHTML = '<h3 title="XXX">Custom Words</h3>';
  
  // カスタムワードのリストを取得
  const customWords = dictionaryOps.listCustomWords().sort();
  
  if (customWords.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No custom words defined';
    customWordsArea.appendChild(emptyMessage);
    return;
  }
  
  // ワードグループを作成
  const wordGroup = document.createElement('div');
  wordGroup.className = 'word-group';
  
  // 各カスタムワードのボタンを作成
  customWords.forEach(word => {
    const wordButton = document.createElement('button');
    wordButton.className = 'word-button custom-word';
    wordButton.textContent = word;
    wordButton.title = 'Click to insert this word';
    
    // クリックイベント - ワードを入力エリアに挿入
    wordButton.addEventListener('click', () => {
      insertAtCursor(word);
    });
    
    wordGroup.appendChild(wordButton);
  });
  
  customWordsArea.appendChild(wordGroup);
};

// トークン分割
const tokenize = code => {
  log(`Tokenizing: "${code}"`);

  const tokens = [];
  let i = 0;
  let currentToken = '';
  let inString = false;
  let inComment = false;
  let inDefinition = false;
  let definitionBody = '';

  while (i < code.length) {
    const char = code[i];

    // DEF ワード定義の特別処理
    if (inDefinition) {
      if (char === '}') {
        // 定義本体の終了
        tokens.push(definitionBody.trim());
        inDefinition = false;
        definitionBody = '';
      } else {
        // 定義本体を収集
        definitionBody += char;
      }
    }
    // コメント処理
    else if (char === '#' && !inString) {
      inComment = true;
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else if (inComment) {
      if (char === '\n') {
        inComment = false;
      }
    }
    // 文字列リテラル処理
    else if (char === '"') {
      if (inString) {
        currentToken += char;
        tokens.push(currentToken);
        currentToken = '';
        inString = false;
      } else {
        if (currentToken.length > 0) {
          tokens.push(currentToken);
          currentToken = '';
        }
        currentToken = char;
        inString = true;
      }
    } else if (inString) {
      currentToken += char;
    }
    // DEF定義の開始
    else if (currentToken.toUpperCase() === 'DEF' && char === '{') {
      inDefinition = true;
      tokens.push(currentToken);
      currentToken = '';
    }
    // 空白処理
    else if (/\s/.test(char)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }

    i++;
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  log(`Tokens: [${tokens.join(', ')}]`);
  return tokens;
};

// 式の評価
const evaluate = tokens => {
  log(`Evaluating ${tokens.length} tokens: ${tokens.join(' ')}`);

  try {
    // DEF処理 (例: DEF NAME { code... } #comment)
    if (tokens.length >= 3 && normalizeToken(tokens[0]) === "DEF") {
      const name = tokens[1];
      const body = tokens[2]; // 本体コードは既にtokenizeで抽出済み
      
      // カスタムワードを辞書に定義
      dictionaryOps.define(name, body, false, 'Custom word');
      state.output += `Defined: ${name}\n`;
      updateUI();
      return true;
    }
    
    // DEL処理
    if (tokens.length >= 2 && normalizeToken(tokens[0]) === "DEL") {
      const name = tokens[1];
      const success = dictionaryOps.remove(name);
      
      if (success) {
        state.output += `Removed: ${name}\n`;
      } else {
        state.output += `Word not found or cannot be removed: ${name}\n`;
      }
      
      updateUI();
      return true;
    }

    // 各トークンを評価
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // 数値リテラル
      if (/^-?\d+(\.\d+)?$/.test(token)) {
        // 整数
        stackOps.push(new Fraction(parseInt(token, 10), 1));
        continue;
      }
      
      // 分数リテラル
      if (token.includes('/')) {
        const [num, denom] = token.split('/');
        stackOps.push(new Fraction(parseInt(num, 10), parseInt(denom, 10)));
        continue;
      }
      
      // 文字列リテラル
      if (token.startsWith('"') && token.endsWith('"')) {
        stackOps.push(new HolonString(token.slice(1, -1)));
        continue;
      }
      
      // 辞書ワード
      const word = dictionaryOps.lookup(normalizeToken(token));
      if (word !== null) {
        // カスタムワードの場合
        if (typeof word === 'string') {
          // カスタムワードの本体を再帰的に評価
          const customTokens = tokenize(word);
          evaluate(customTokens);
        } 
        // 組み込みワード（関数）の場合
        else if (typeof word === 'function') {
          // 関数を実行
          word();
        } else {
          throw new Error(`Unknown word type: ${token}`);
        }
        continue;
      }
      
      // 未知のトークン
      throw new Error(`Unknown token: ${token}`);
    }
    
    return true;
  } catch (error) {
    log(`Evaluation error: ${error.message}`);
    state.output += `Error: ${error.message}\n`;
    updateUI();
    return false;
  }
};

// UI更新関数
const updateUI = () => {
  // 出力領域を更新
  if (elements.output) {
    elements.output.textContent = state.output;
    // 最新の出力が見えるようにスクロール
    elements.output.scrollTop = elements.output.scrollHeight;
  }
  
  // スタック表示を更新
  updateStackDisplay();
  
  // レジスタ表示を更新
  updateRegisterDisplay();
  
  // カスタムワード表示を更新
  updateCustomWordsDisplay();
};

// 実行関数
const executeCode = code => {
  log(`==== Execution started ====`);
  try {
    log(`Input code: ${code}`);
    
    // ウェルカムメッセージかどうかを確認するフラグ
    const isFirstExecution = state.output.includes("Holon FORTH-Based") && 
                            state.output.includes("Example: 2 3 +");
    
    // ウェルカムメッセージの場合はクリア
    if (isFirstExecution) {
      state.output = "";
    }
    
    const tokens = tokenize(code);
    
    // トークンを評価
    evaluate(tokens);
    
    // UI更新
    updateUI();
    elements.input.value = "";
    log(`Execution successful`);
  } catch (error) {
    // エラー時もウェルカムメッセージをクリア
    if (state.output.includes("Holon FORTH-Based")) {
      state.output = "";
    }
    
    log(`Error: ${error.message}`);
    state.output += `Error: ${error.message}\n`;
    updateUI();
  }
  log(`==== Execution completed ====`);
};

// イベントリスナー
const initEventListeners = () => {
  // キー入力イベントを監視
  elements.input.addEventListener("keydown", event => {
    // Shift+Enterの処理
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      log(`Shift+Enter pressed. Executing code.`);

      const code = elements.input.value;
      state.logs = [];
      executeCode(code);
    }
  });
  
  // ウィンドウリサイズ時にモバイル/デスクトップの切り替えを検出
  window.addEventListener('resize', () => {
    // レイアウトの再構築
    setupFunctionsSection();
  });
};

// HTML用のスタイル修正
const addCSSStyles = () => {
  // 既存のスタイルに追加するスタイル
  const additionalStyles = `
    /* Memory sections styling */
    .memory-section {
      display: flex;
      flex-direction: column; /* デフォルトで縦並び (デスクトップ向け) */
    }
    
    .stack-area, .register-area {
      width: 100%; /* 縦並びの場合は幅いっぱいに */
    }
    
    .stack-display, .register-display {
      background: linear-gradient(-45deg, var(--background-dark), var(--background-light));
      padding: 0.5em;
      font-family: var(--font-monospace);
      border: 1px solid var(--border-color);
      width: 100%;
      height: 80px;
      white-space: nowrap;
    }
    
    .memory-content {
      display: inline-block;
      text-align: left;
    }
    
    .empty-message {
      color: var(--text-color-gray);
      text-align: reft;
      padding: 5px;
    }
    
    /* Mobile layout */
    @media (max-width: 768px) {
      .memory-section {
        flex-direction: row; /* モバイルでは横並びに変更 */
        flex-wrap: wrap; /* 要素が収まらない場合は折り返し */
      }
      
      .memory-section > h2 {
        width: 100%;
        flex-basis: 100%;
      }
      
      .stack-area, .register-area {
        flex: 1; /* 横並びの場合は均等に幅を分ける */
      }
      
      .stack-area h3, .register-area h3 {
        font-size: 14px; /* 見出しを小さくする */
        margin: 5px 0;
      }
    }
    
    /* Flexbox layout for dot grid */
    .dot-grid {
      display: flex;
      flex-direction: column;
      margin-bottom: 15px;
      position: relative;
    }
    
    .dot-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    
    .dot {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #e0e0e0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    
    .dot.numeric {
      background-color: #ffffff;
    }
    
    .dot.word-dot {
      background-color: #ffcc99;
    }
    
    .dot .digit {
      font-weight: bold;
      font-size: 18px;
    }
    
    .dot .word {
      font-size: 8px;
      margin-top: 2px;
    }
    
    .dot.detected {
      background-color: #ff9999;
    }
    
  
    .special-row {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
    }
    
    .special-button {
      height: 40px;
      width: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #e0e0e0;
      border-radius: 10px;
      cursor: pointer;
      font-weight: bold;
    }
    
    .special-button.delete {
      background-color: #ffaaaa;
    }
    
    .special-button.space {
      background-color: #aaffaa;
    }
    
    .special-row .dot.numeric {
      background-color: #ffffff;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex: 0 0 auto;
    }
    
    #line-canvas {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
      width: 100%;
      height: 100%;
    }
    
    /* Button styling for desktop */
    .word-button {
      margin: 5px;
      padding: 5px 10px;
      background-color: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-family: var(--font-monospace);
      font-size: 14px;
      transition: background-color 0.2s;
    }
    
    .word-button:hover {
      background-color: #e0e0e0;
    }
    
    .word-container {
      display: flex;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .numeric-container {
      display: flex;
      flex-direction: column;
      margin-top: 10px;
      border-top: 1px solid #ddd;
      padding-top: 10px;
    }

    .special-keys-container {
      display: flex;
      justify-content: center;
      margin-top: 5px;
    }

    .num-button {
      margin: 5px;
      padding: 5px 10px;
      background-color: #ffffff;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-family: var(--font-monospace);
      font-size: 14px;
      transition: background-color 0.2s;
      width: 30px;
      height: 30px;
      text-align: center;
    }

    .num-button:hover {
      background-color: #f0f0f0;
    }

    /* デスクトップの数字キーを横並びにする */
    @media (min-width: 769px) {
      .numeric-container {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
      }
      
      .special-keys-container {
        width: 100%;
        justify-content: center;
        margin-top: 5px;
      }
    }
  `;
  
  // スタイルタグを作成して追加
  const styleElement = document.createElement('style');
  styleElement.textContent = additionalStyles;
  document.head.appendChild(styleElement);
};

// 初期化
const init = () => {
  log(`Initializing Holon with FORTH-based stack logic`);

  // UI要素の取得
  elements.output = document.querySelector('.output-box');
  elements.input = document.querySelector('textarea');
  elements.builtinWords = document.querySelector('.builtin-words-area');
  elements.customWords = document.querySelector('.custom-words-area');
  
  // スタックとレジスタ表示領域の初期化
  initializeMemoryDisplays();
  
  // スタイルシートのチェックと修正
  addCSSStyles();

  // 組み込みワードの初期化
  initializeBuiltins();
  
  // Functions Section の設定（モバイル/デスクトップモードに応じて）
  setupFunctionsSection();

  // イベントリスナーの設定
  initEventListeners();

  // UI更新
  updateUI();

  // ウェルカムメッセージ
  state.output = "Holon FORTH-Based Stack Language\n" +
    "Example: 2 3 + PRINTLN\n" +
    "Define custom word: DEF DOUBLE { DUP + }\n";
  updateUI();
};

// アプリケーション起動
window.addEventListener("DOMContentLoaded", init);