// script.js - Holon language with FORTH inspired stack-based logic

// データ構造 - スタック、レジスタ、辞書とログの管理
const state = {
  stack: [],          // メインスタック
  registers: {},      // レジスタ（名前付き変数）
  dictionary: {},     // ワード辞書
  output: "",         // 出力バッファ
  logs: []            // デバッグログ
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

// ポケベル信号の定義
const pagerTones = {
  // 各数字に対応するポケベル信号の周波数と長さ
  '1': [{ freq: 1400, duration: 100 }, { freq: 1000, duration: 100 }],
  '2': [{ freq: 1400, duration: 100 }, { freq: 1100, duration: 100 }],
  '3': [{ freq: 1400, duration: 100 }, { freq: 1200, duration: 100 }],
  '4': [{ freq: 1400, duration: 100 }, { freq: 1300, duration: 100 }],
  '5': [{ freq: 1400, duration: 100 }, { freq: 1400, duration: 100 }],
  '6': [{ freq: 1500, duration: 100 }, { freq: 1000, duration: 100 }],
  '7': [{ freq: 1500, duration: 100 }, { freq: 1100, duration: 100 }],
  '8': [{ freq: 1500, duration: 100 }, { freq: 1200, duration: 100 }],
  '9': [{ freq: 1500, duration: 100 }, { freq: 1300, duration: 100 }],
  '0': [{ freq: 1500, duration: 100 }, { freq: 1400, duration: 100 }],
  '*': [{ freq: 1600, duration: 100 }, { freq: 1000, duration: 100 }],
  '#': [{ freq: 1600, duration: 100 }, { freq: 1100, duration: 100 }]
};

// ポケベル信号を再生する関数
const playPagerTone = (digit) => {
  // AudioContextがサポートされているか確認
  if (!window.AudioContext && !window.webkitAudioContext) {
    log("AudioContext is not supported in this browser");
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  
  // 指定された数字のポケベル信号を取得
  const tones = pagerTones[digit];
  if (!tones) {
    log(`No tone defined for digit: ${digit}`);
    return;
  }
  
  // 各音を順番に再生
  let startTime = audioCtx.currentTime;
  
  tones.forEach(tone => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = tone.freq;
    
    gainNode.gain.value = 0.5;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + tone.duration / 1000);
    
    startTime += tone.duration / 1000;
  });
};

// 基本機能ワードの初期化
const initializeBuiltins = () => {
  // 基本的なFORTHワードのマッピング
  const forthWords = [
    { digit: '1', word: 'DUP', description: 'スタックの最上位の値を複製します' },
    { digit: '2', word: 'DROP', description: 'スタックの最上位の値を捨てます' },
    { digit: '3', word: 'SWAP', description: 'スタックの上位2つの値を入れ替えます' },
    { digit: '4', word: 'OVER', description: '2番目の値のコピーをスタックの最上位に置きます' },
    { digit: '5', word: 'ROT', description: '上位3つの値をローテーションします (a b c -> b c a)' },
    { digit: '6', word: '+', description: 'スタックの上位2つの値を加算します' },
    { digit: '7', word: '-', description: 'スタックの上位2つの値を減算します (a b -> a-b)' },
    { digit: '8', word: '*', description: 'スタックの上位2つの値を乗算します' },
    { digit: '9', word: '/', description: 'スタックの上位2つの値を除算します (a b -> a/b)' },
    { digit: '0', word: 'IF', description: '条件分岐を行います' },
    { digit: '*', word: 'DEF', description: '新しいワードを定義します' },
    { digit: '#', word: 'DEL', description: 'ワードを削除します' }
  ];

  // ワードと数字のマッピングを保存
  state.wordDigitMap = {};
  forthWords.forEach(item => {
    state.wordDigitMap[item.digit] = item.word;
  });

  // 各ワードを定義
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
};

// 文字入力マッピング（スワイプ時に使用）
const charMap = {
  '1': {'0': 'A', '45': 'B', '90': 'C', '135': 'D', '180': 'E', '-135': 'F', '-90': 'G', '-45': 'H'},
  '2': {'0': 'I', '45': 'J', '90': 'K', '135': 'L', '180': 'M', '-135': 'N', '-90': 'O', '-45': 'P'},
  '3': {'0': 'Q', '45': 'R', '90': 'S', '135': 'T', '180': 'U', '-135': 'V', '-90': 'W', '-45': 'X'},
  '4': {'0': 'Y', '45': 'Z', '90': '.', '135': ',', '180': ';', '-135': ':', '-90': '(', '-45': ')'},
  '5': {'0': '+', '45': '-', '90': '*', '135': '/', '180': '=', '-135': '<', '-90': '>', '-45': '!'},
  '6': {'0': '{', '45': '}', '90': '[', '135': ']', '180': '|', '-135': '\\', '-90': '/', '-45': '?'},
  '7': {'0': '~', '45': '`', '90': '@', '135': '#', '180': '$', '-135': '%', '-90': '^', '-45': '&'},
  '8': {'0': '_', '45': '"', '90': '\'', '135': ' ', '180': '\n', '-135': '\t', '-90': '0', '-45': '1'},
  '9': {'0': '2', '45': '3', '90': '4', '135': '5', '180': '6', '-135': '7', '-90': '8', '-45': '9'},
};

// UI要素の取得
const elements = {
  output: null,
  input: null,
  stack: null,
  registers: null,
  builtinWords: null,
  customWords: null
};

// 組み込みワードエリアのカンバスボタンを描画する関数
const drawWordButtons = () => {
  console.log("Drawing word buttons...");
  const container = elements.builtinWords;
  if (!container) {
    console.error("Built-in words container not found!");
    return;
  }
  
  container.innerHTML = '<h3 title="XXX">Built-In Words</h3>';
  
  // 組み込みワードとして登録された数字とワードのマッピングを使用
  const wordDigitMap = state.wordDigitMap || {};
  console.log("Word-digit map:", wordDigitMap);
  
  if (Object.keys(wordDigitMap).length === 0) {
    console.warn("No word-digit mappings found!");
    // マッピングがなければデフォルト値を使用
    Object.assign(wordDigitMap, {
      '1': 'DUP', '2': 'DROP', '3': 'SWAP',
      '4': 'OVER', '5': 'ROT', '6': '+',
      '7': '-', '8': '*', '9': '/',
      '*': 'DEF', '0': 'IF', '#': 'DEL'
    });
  }
  
  // カンバスボタンを格納するグループdivを作成
  const groupDiv = document.createElement('div');
  groupDiv.className = 'word-group canvas-buttons';
  
  // 数字ボタンを作成（ポケベルの数字キーパッドレイアウト）
  const layout = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];
  
  layout.forEach(row => {
    row.forEach(digit => {
      const word = wordDigitMap[digit] || '';
      
      // カンバス要素を作成
      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 80;
      canvas.className = 'word-button';
      canvas.dataset.digit = digit;
      canvas.dataset.word = word;
      
      // ポケベル信号のボタンを描画
      drawPagerButton(canvas, digit, word);
      
      // イベントリスナーを設定
      setupButtonListeners(canvas);
      
      groupDiv.appendChild(canvas);
    });
  });
  
  container.appendChild(groupDiv);
  console.log("Word buttons drawn:", groupDiv.children.length);
};

// ポケベルボタンを描画する関数
const drawPagerButton = (canvas, digit, word) => {
  if (!canvas) {
    console.error("Canvas is null or undefined!");
    return;
  }
  
  console.log(`Drawing pager button: ${digit} - ${word}`);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error("Could not get canvas context!");
    return;
  }
  
  const width = canvas.width;
  const height = canvas.height;
  
  // 背景をクリア
  ctx.clearRect(0, 0, width, height);
  
  // 円を描画
  ctx.beginPath();
  ctx.arc(width/2, height/2, width/2 - 5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // 数字を描画
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#333333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(digit, width/2, height/2 - 5);
  
  // ワード名を描画
  ctx.font = '12px sans-serif';
  ctx.fillText(word, width/2, height/2 + 15);
};

// ボタンのイベントリスナーを設定
const setupButtonListeners = (canvas) => {
  const digit = canvas.dataset.digit;
  const word = canvas.dataset.word;
  
  let longPressTimer;
  let touchStartX, touchStartY;
  let isSwiping = false;
  
  // クリック（タップ）イベント - 数字を入力
  canvas.addEventListener('click', (e) => {
    // 長押しまたはスワイプ中は処理しない
    if (longPressTimer || isSwiping) return;
    
    // ポケベル信号を再生
    playPagerTone(digit);
    
    // 数字を入力エリアに挿入
    insertAtCursor(digit);
  });
  
  // マウスダウン/タッチスタート - 長押し検出開始
  const startHandler = (e) => {
    // タッチイベントの場合は座標を記録
    if (e.type === 'touchstart') {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
    
    // 長押し検出用タイマーを設定
    longPressTimer = setTimeout(() => {
      // ポケベル信号を再生
      playPagerTone(digit);
      
      // ワードを入力エリアに挿入
      insertAtCursor(word + ' ');
      
      // ボタンの見た目を一時的に変更
      canvas.classList.add('pressed');
      setTimeout(() => {
        canvas.classList.remove('pressed');
      }, 200);
      
      longPressTimer = null;
    }, 500); // 500ms以上の長押しで発動
  };
  
  // マウスアップ/タッチエンド - タイマークリア
  const endHandler = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    isSwiping = false;
  };
  
  // タッチムーブ - スワイプ検出
  const moveHandler = (e) => {
    if (!e.touches || isSwiping || !longPressTimer) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    
    // スワイプの距離を計算
    const distX = touchX - touchStartX;
    const distY = touchY - touchStartY;
    const distance = Math.sqrt(distX * distX + distY * distY);
    
    // スワイプ検出（一定距離以上移動した場合）
    if (distance > 20) {
      // タイマーをクリア
      clearTimeout(longPressTimer);
      longPressTimer = null;
      isSwiping = true;
      
      // スワイプの角度を計算
      const angle = Math.atan2(distY, distX) * 180 / Math.PI;
      
      // 8方向に量子化
      const directions = [0, 45, 90, 135, 180, -135, -90, -45];
      const closestDirection = directions.reduce((prev, curr) => 
        Math.abs(curr - angle) < Math.abs(prev - angle) ? curr : prev
      );
      
      // 対応する文字を取得
      const map = charMap[digit] || {};
      const char = map[closestDirection] || '';
      
      if (char) {
        // ポケベル信号を再生
        playPagerTone(digit);
        
        // 文字を入力エリアに挿入
        insertAtCursor(char);
      }
    }
  };
  
  // イベントリスナーを登録
  canvas.addEventListener('mousedown', startHandler);
  canvas.addEventListener('touchstart', startHandler);
  
  canvas.addEventListener('mouseup', endHandler);
  canvas.addEventListener('touchend', endHandler);
  canvas.addEventListener('touchcancel', endHandler);
  
  canvas.addEventListener('touchmove', moveHandler);
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

// メモリ表示領域の初期化
const initializeMemoryDisplays = () => {
  // スタック表示領域の初期化
  const stackArea = document.querySelector('.stack-area');
  if (!stackArea.querySelector('.stack-display')) {
    const stackDisplay = document.createElement('div');
    stackDisplay.className = 'stack-display';
    stackArea.appendChild(stackDisplay);
  }
  
  // レジスタ表示領域の初期化
  const registerArea = document.querySelector('.register-area');
  if (!registerArea.querySelector('.register-display')) {
    const registerDisplay = document.createElement('div');
    registerDisplay.className = 'register-display';
    registerArea.appendChild(registerDisplay);
  }
};

// UI更新関数
// UI更新関数の続き
const updateUI = () => {
  // 出力エリア更新
  elements.output.textContent = state.output;
  
  // スタックエリア更新
  updateStackDisplay();
  
  // レジスタエリア更新
  updateRegisterDisplay();
  
  // 辞書ワード表示更新
  updateWordDisplay();
};

// スタック表示を更新
const updateStackDisplay = () => {
  const stackArea = document.querySelector('.stack-area');
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
    // 逆順に表示（最上位が一番下）
    [...state.stack].reverse().forEach((item, index) => {
      const stackItem = document.createElement('div');
      stackItem.className = 'stack-item';
      
      // インデックス（深さ）を表示
      const depth = state.stack.length - index - 1;
      stackItem.textContent = `${depth}: ${item.toString()}`;
      
      stackDisplay.appendChild(stackItem);
    });
  }
  
  stackArea.appendChild(stackDisplay);
};

// レジスタ表示を更新
const updateRegisterDisplay = () => {
  const registerArea = document.querySelector('.register-area');
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
    keys.forEach(key => {
      const registerItem = document.createElement('div');
      registerItem.className = 'register-item';
      registerItem.textContent = `${key}: ${registers[key].toString()}`;
      registerDisplay.appendChild(registerItem);
    });
  }
  
  registerArea.appendChild(registerDisplay);
};

// ワード表示を更新
const updateWordDisplay = () => {
  // 組み込みワード（ポケベルボタン）を描画
  drawWordButtons();
  
  // カスタムワード表示を更新
  updateCustomWordsDisplay();
};

// カスタムワード表示を更新
const updateCustomWordsDisplay = () => {
  const customWordsArea = elements.customWords;
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
      insertAtCursor(word + ' ');
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
};

// HTML用のスタイル修正
const addCSSStyles = () => {
  // 既存のスタイルに追加するスタイル
  const additionalStyles = `
    .stack-display, .register-display {
      background: linear-gradient(-45deg, var(--background-dark), var(--background-light));
      padding: 10px;
      margin-bottom: 10px;
      font-family: var(--font-monospace);
      border: 1px solid var(--border-color);
      width: 100%;
      box-sizing: border-box;
    }
    
    .stack-display {
      height: 150px;
      overflow-y: auto;
    }
    
    .register-display {
      min-height: 60px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 5px;
    }
    
    .stack-item, .register-item {
      padding: 5px;
      margin-bottom: 5px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 3px;
    }
    
    .stack-item {
      border-left: 3px solid #888;
    }
    
    .register-item {
      text-align: center;
    }
    
    .empty-message {
      color: var(--text-color-gray);
      text-align: center;
      font-style: italic;
      padding: 10px;
    }
    
    .canvas-buttons {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      width: 100%;
    }
    
    .word-button {
      cursor: pointer;
      transition: all 0.2s;
    }
    
    canvas.word-button {
      width: 100%;
      height: auto;
      aspect-ratio: 1/1;
      border-radius: 50%;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    
    .word-button.pressed {
      transform: scale(0.95);
      box-shadow: inset 0 0 5px rgba(0,0,0,0.2);
    }
    
    @media (max-width: 768px) {
      .canvas-buttons {
        gap: 15px;
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

  // イベントリスナーの設定
  initEventListeners();

  // UI更新
  updateUI();

  // ウェルカムメッセージ
  state.output = "Holon FORTH-Based Stack Language\n" +
    "Example: 2 3 + PRINTLN\n" +
    "Define custom word: DEF DOUBLE { DUP + }\n";
  updateUI();
  
  // 問題のデバッグ用
  console.log("Built-in words area:", elements.builtinWords);
  console.log("Word-digit map:", state.wordDigitMap);
};

// アプリケーション起動
window.addEventListener("DOMContentLoaded", init);