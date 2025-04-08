// script.js - Holon language with FORTH inspired stack-based logic

// データ構造 - スタック、レジスタ、辞書とログの管理
const state = {
  stack: [],          // メインスタック
  registers: {},      // レジスタ（名前付き変数）
  dictionary: {},     // ワード辞書
  output: "",         // 出力バッファ
  logs: [],           // デバッグログ
  buffer: ""          // 入力バッファ
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

// バッファー操作ユーティリティ
const bufferOps = {
  // バッファーに追加
  add: (text) => {
    state.buffer += text;
    updateBufferDisplay();
    log(`Added to buffer: ${text}, now buffer is: ${state.buffer}`);
  },
  
  // 末尾削除
  backspace: () => {
    state.buffer = state.buffer.slice(0, -1);
    updateBufferDisplay();
    log(`Backspace buffer, now buffer is: ${state.buffer}`);
  },
  
  // バッファーをクリア
  clear: () => {
    state.buffer = '';
    updateBufferDisplay();
    log(`Cleared buffer`);
  },
  
  // バッファーの内容を取得して入力エリアに送信
  submit: () => {
    if (state.buffer) {
      insertAtCursor(state.buffer + ' ');
      log(`Submitted buffer: ${state.buffer}`);
      bufferOps.clear();
    }
  }
};

// バッファー表示を更新
const updateBufferDisplay = () => {
  const bufferContent = document.querySelector('.buffer-content');
  if (bufferContent) {
    bufferContent.textContent = state.buffer;
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
  18405233: 'M',  // 指定された例
  33080895: 'O',  // 指定された例
  1113663: 'P',   // 指定された例
  // 他の文字のパターンはプロジェクトの進行に合わせて追加
};

// ドット配置とワードマッピングの定義
const dotConfig = [
  // 位置, 数値, ワード
  [0, '1', 'DUP'],    // 左上
  [2, '2', 'SWAP'],   // 上中央
  [4, '3', 'ROT'],    // 右上
  [10, '4', '+'],     // 中段左
  [12, '5', '*'],     // 中央
  [14, '6', '/'],     // 中段右
  [20, '7', 'DEF'],   // 左下
  [22, '8', 'IF'],    // 下中央
  [24, '9', 'DEL']    // 右下
];

// 特殊ドットの定義
const specialDots = [
  { value: '0', word: 'DROP' },
  { value: '*', word: 'OVER' },
  { value: '#', word: 'PRINTLN' }
];

// 基本機能ワードの初期化
const initializeBuiltins = () => {
  // 基本的なFORTHワードのマッピング
  const forthWords = [
    { digit: '1', word: 'DUP', description: 'スタックの最上位の値を複製します' },
    { digit: '2', word: 'SWAP', description: 'スタックの上位2つの値を入れ替えます' },
    { digit: '3', word: 'ROT', description: '上位3つの値をローテーションします (a b c -> b c a)' },
    { digit: '4', word: '+', description: 'スタックの上位2つの値を加算します' },
    { digit: '5', word: '*', description: 'スタックの上位2つの値を乗算します' },
    { digit: '6', word: '/', description: 'スタックの上位2つの値を除算します (a b -> a/b)' },
    { digit: '7', word: 'DEF', description: '新しいワードを定義します' },
    { digit: '8', word: 'IF', description: '条件分岐を行います' },
    { digit: '9', word: 'DEL', description: 'ワードを削除します' },
    { digit: '0', word: 'DROP', description: 'スタックの最上位の値を捨てます' },
    { digit: '*', word: 'OVER', description: '2番目の値のコピーをスタックの最上位に置きます' },
    { digit: '#', word: 'PRINTLN', description: 'スタックの最上位の値を出力します' }
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
};

// UI要素の取得
const elements = {
  output: null,
  input: null,
  builtinWords: null,
  customWords: null
};

// なぞり書きの状態を追跡
const drawState = {
  isActive: false,
  detectedDots: new Set(),
  totalValue: 0
};

// ドットグリッドの設定
const setupDotGrid = () => {
  const container = elements.builtinWords;
  if (!container) {
    console.error("Built-in words container not found!");
    return;
  }
  
  container.innerHTML = `
    <h3 title="XXX">Built-In Words</h3>
    <div class="buffer-display">
      <div class="buffer-content"></div>
    </div>
    <div id="dot-grid" class="dot-grid"></div>
    <div class="action-buttons">
      <button id="clear-buffer">削除</button>
      <button id="submit-buffer">確定</button>
    </div>
  `;
  
  const dotGrid = document.getElementById('dot-grid');
  if (!dotGrid) return;
  
  // 5x5のグリッドを作成
  for (let i = 0; i < 25; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.dataset.index = i;
    dot.dataset.value = dotValues[i];
    
    // 特定のポジションにワードと数字を割り当て
    const config = dotConfig.find(c => c[0] === i);
    if (config) {
      dot.textContent = config[1];
      dot.dataset.digit = config[1];
      dot.dataset.word = config[2];
      dot.setAttribute('title', config[2]);
    }
    
    dotGrid.appendChild(dot);
  }
  
  // 特殊ドットを追加 (0, *, #)
  specialDots.forEach(spec => {
    const dot = document.createElement('div');
    dot.className = 'dot special-dot';
    dot.textContent = spec.value;
    dot.dataset.digit = spec.value;
    dot.dataset.word = spec.word;
    dot.setAttribute('title', spec.word);
    dotGrid.appendChild(dot);
  });
  
  // 線描画用のキャンバス
  const canvas = document.createElement('canvas');
  canvas.id = 'line-canvas';
  canvas.width = dotGrid.offsetWidth;
  canvas.height = dotGrid.offsetHeight;
  dotGrid.appendChild(canvas);
  
  // 各ドットにイベントリスナーを設定
  setupDotEventListeners();
  
  // アクションボタンのイベントリスナーを設定
  setupActionButtons();
};

// ドットイベントリスナーの設定
const setupDotEventListeners = () => {
  const dots = document.querySelectorAll('.dot');
  
  dots.forEach(dot => {
    let longPressTimer;
    
    // タッチ/マウス開始
    dot.addEventListener('mousedown', e => {
      e.preventDefault();
      handleDotStart(dot, e);
    });
    
    dot.addEventListener('touchstart', e => {
      e.preventDefault();
      handleDotStart(dot, e);
    });
    
    // 単純クリック（数字入力）
    dot.addEventListener('click', e => {
      // 長押しやなぞり書き中でない場合のみ処理
      if (!longPressTimer && !drawState.isActive) {
        const digit = dot.dataset.digit;
        if (digit) {
          playPagerTone(digit);
          bufferOps.add(digit);
        }
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
    
    // 数字キーの場合は長押し検出開始
    if (digit) {
      longPressTimer = setTimeout(() => {
        playPagerTone(digit);
        if (word) {
          bufferOps.add(word + ' ');
        }
        longPressTimer = null;
      }, 500);
    }
    
    // なぞり書き開始
    startDrawing(dot);
  }
};

// アクションボタンの設定
const setupActionButtons = () => {
  const clearButton = document.getElementById('clear-buffer');
  const submitButton = document.getElementById('submit-buffer');
  
  if (clearButton) {
    // ダブルタップで全消去、シングルタップで1文字削除
    let tapCount = 0;
    clearButton.addEventListener('click', () => {
      tapCount++;
      setTimeout(() => {
        if (tapCount === 1) {
          bufferOps.backspace();
        } else if (tapCount >= 2) {
          bufferOps.clear();
        }
        tapCount = 0;
      }, 300);
    });
  }
  
  if (submitButton) {
    submitButton.addEventListener('click', () => {
      bufferOps.submit();
    });
  }
};

// なぞり書き開始
const startDrawing = (dot) => {
  // 始点がドットでない場合や特殊ドットの場合はスキップ
  if (!dot || !dot.dataset.value) return;
  
  drawState.isActive = true;
  drawState.detectedDots = new Set();
  drawState.totalValue = 0;
  
  // 最初のドットを追加
  addDetectedDot(dot);
  log(`Started drawing with dot ${dot.dataset.index}`);
};

// なぞり書き終了
const endDrawing = () => {
  if (!drawState.isActive) return;
  
  // 長押しタイマーがあればクリア
  document.querySelectorAll('.dot').forEach(dot => {
    if (dot.longPressTimer) {
      clearTimeout(dot.longPressTimer);
      dot.longPressTimer = null;
    }
  });
  
  // 文字認識
  if (drawState.detectedDots.size > 1) {
    const detectedLetter = recognizeLetter(drawState.totalValue);
    if (detectedLetter) {
      log(`Recognized letter: ${detectedLetter}`);
      bufferOps.add(detectedLetter);
    }
  }
  
  // 視覚効果をクリア
  setTimeout(() => {
    clearCanvas();
    document.querySelectorAll('.dot.detected').forEach(d => {
      d.classList.remove('detected');
    });
  }, 500);
  
  drawState.isActive = false;
  log(`Ended drawing, total value: ${drawState.totalValue}`);
};

// ドット検出
const detectDot = (e) => {
  if (!drawState.isActive) return;
  
  const point = e.type.includes('touch') ? e.touches[0] : e;
  const x = point.clientX;
  const y = point.clientY;
  
  // すべてのドットをチェック
 // すべてのドットをチェック
  document.querySelectorAll('.dot').forEach(dot => {
    // 特殊ドットまたは既に検出されたドットはスキップ
    if (dot.classList.contains('special-dot') || drawState.detectedDots.has(dot)) return;
    
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
const updateUI = () => {
  // 出力エリア更新
  elements.output.textContent = state.output;
  
  // スタックエリア更新
  updateStackDisplay();
  
  // レジスタエリア更新
  updateRegisterDisplay();
  
  // バッファーの更新
  updateBufferDisplay();
  
  // カスタムワード表示を更新
  updateCustomWordsDisplay();
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
    
    .buffer-display {
      width: 100%;
      height: 40px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      margin-bottom: 10px;
      padding: 5px;
      box-sizing: border-box;
      overflow: hidden;
      white-space: nowrap;
      position: relative;
    }
    
    .buffer-content {
      font-family: var(--font-monospace);
      font-size: 16px;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
    }
    
    .dot-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 15px;
      position: relative;
    }
    
    .dot {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      cursor: pointer;
      position: relative;
    }
    
    .dot.detected {
      background-color: #ff9999;
    }
    
    .dot.special-dot {
      background-color: #ffcc99;
    }
    
    #line-canvas {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
    }
    
    .action-buttons {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
    }
    
    .action-buttons button {
      flex: 1;
      padding: 8px;
      margin: 0 5px;
      background-color: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
    }
    
    @media (max-width: 768px) {
      .dot-grid {
        gap: 15px;
      }
      
      .dot {
        width: 35px;
        height: 35px;
        font-size: 12px;
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
  
  // ドットグリッドを設定
  setupDotGrid();

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