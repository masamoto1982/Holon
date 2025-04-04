// script.js - Holon language with Lazy K inspired combinatory logic

// データ構造 - 辞書とログの管理
const state = {
  dictionary: {}, // ワード辞書（コンビネータをマップに格納）
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

// コンビネータ（関数）クラス
class Combinator {
  constructor(apply, meta = {}) {
    this.apply = apply; // 関数適用関数
    this.meta = meta; // メタデータ（説明など）
  }

  toString() {
    const name = this.meta.name || "anonymous";
    return `<${name}>`;
  }
}

// 式クラス - 適用可能な式を表現
class Expression {
  constructor(operator, operands = []) {
    this.operator = operator; // 演算子（関数）
    this.operands = operands; // オペランド（引数）
  }

  // 式の評価 - 遅延評価を行う
  evaluate() {
    log(`Evaluating expression: ${this.toString()}`);

    // オペレータが特殊値の場合
    if (this.operator instanceof Fraction ||
      this.operator instanceof HolonString) {
      return this.operator;
    }

    // 各オペランドを評価
    const evaluatedOperands = this.operands.map(op =>
      op instanceof Expression ? op.evaluate() : op
    );

    // オペレータがコンビネータの場合
    if (this.operator instanceof Combinator) {
      log(`Applying combinator: ${this.operator.meta.name || 'anonymous'}`);
      return this.operator.apply(evaluatedOperands);
    }

    // オペレータが式の場合、まず評価する
    if (this.operator instanceof Expression) {
      log(`Evaluating operator expression first`);
      const evaluatedOperator = this.operator.evaluate();

      // 評価結果を処理
      if (evaluatedOperator instanceof Combinator) {
        // コンビネータなら適用
        log(`Evaluated operator is a combinator, applying`);
        return evaluatedOperator.apply(evaluatedOperands);
      } else if (evaluatedOperator instanceof Expression) {
        // 式ならさらに評価
        log(`Evaluated operator is an expression, evaluating again`);
        return new Expression(evaluatedOperator, evaluatedOperands).evaluate();
      } else {
        // その他の値なら新しい式として評価
        log(`Evaluated operator is a value: ${evaluatedOperator}`);
        return evaluatedOperator;
      }
    }

    throw new Error(`Cannot evaluate expression with operator: ${this.operator}`);
  }

  toString() {
    const opStr = this.operator ? this.operator.toString() : 'null';
    const argsStr = this.operands.map(o => o ? o.toString() : 'null').join(' ');
    return `(${opStr} ${argsStr})`;
  }
}

// 辞書操作ユーティリティ
const dictionaryOps = {
  // 辞書にワードを定義
  define: (name, value) => {
    const normalizedName = normalizeToken(name);
    state.dictionary[normalizedName] = value;
    log(`Defined word "${normalizedName}" in dictionary: ${value.toString()}`);
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
    log(`Found word "${normalizedName}" in dictionary: ${value.toString()}`);
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

// 基本コンビネータの初期化
const initializeBuiltins = () => {
  // 直接適用の関数を定義
  const directApply = (func) => {
    return (operands) => {
      log(`Direct application with ${operands.length} operands`);
      if (operands.length === 0) return null;

      // 最初の引数を関数に適用
      const result = func(operands[0]);

      // 残りの引数があれば、結果に適用する
      if (operands.length > 1) {
        if (result instanceof Combinator) {
          return result.apply(operands.slice(1));
        } else {
          // 関数でない場合は直接返す
          return result;
        }
      } else {
        return result;
      }
    };
  };

  // 恒等関数 I コンビネータ: I x = x
  dictionaryOps.define("I", new Combinator(
    directApply(x => x), {
      name: "I",
      description: "Identity: I x = x",
      isBuiltin: true
    }
  ));

  // K コンビネータ: K x y = x (定数関数)
  dictionaryOps.define("K", new Combinator(
    (operands) => {
      log(`K combinator called with ${operands.length} operands`);

      // 完全適用
      if (operands.length >= 2) {
        return operands[0];
      }

      // 部分適用
      if (operands.length === 1) {
        const x = operands[0];
        return new Combinator(
          directApply(_ => x), {
            name: "K-partial",
            description: "K x - returns x regardless of argument"
          }
        );
      }

      // 引数なし
      return new Combinator(
        (newOperands) => {
          if (newOperands.length === 0) return null;
          const x = newOperands[0];
          return new Combinator(
            directApply(_ => x), {
              name: "K-partial",
              description: "K x - returns x regardless of argument"
            }
          );
        }, {
          name: "K",
          description: "Constant function constructor",
          isBuiltin: true
        }
      );
    }, {
      name: "K",
      description: "Constant: K x y = x",
      isBuiltin: true
    }
  ));

  // S コンビネータ: S x y z = x z (y z)
  dictionaryOps.define("S", new Combinator(
    (operands) => {
      log(`S combinator called with ${operands.length} operands`);

      // 完全適用
      if (operands.length >= 3) {
        const [x, y, z] = operands;

        log(`S: applying x=${x} to z=${z}`);
        // x z を適用
        let xzResult;
        if (x instanceof Combinator) {
          xzResult = x.apply([z]);
        } else if (x instanceof Expression) {
          xzResult = new Expression(x, [z]).evaluate();
        } else {
          xzResult = x; // x が値の場合
        }
        log(`S: x z = ${xzResult}`);

        log(`S: applying y=${y} to z=${z}`);
        // y z を適用
        let yzResult;
        if (y instanceof Combinator) {
          yzResult = y.apply([z]);
        } else if (y instanceof Expression) {
          yzResult = new Expression(y, [z]).evaluate();
        } else {
          yzResult = y; // y が値の場合
        }
        log(`S: y z = ${yzResult}`);

        log(`S: applying xz=${xzResult} to yz=${yzResult}`);
        // (x z) (y z) を適用
        if (xzResult instanceof Combinator) {
          return xzResult.apply([yzResult]);
        } else if (xzResult instanceof Expression) {
          return new Expression(xzResult, [yzResult]).evaluate();
        } else {
          return xzResult; // xz が値の場合
        }
      }

      // 部分適用
      if (operands.length === 2) {
        const [x, y] = operands;
        return new Combinator(
          (newOperands) => {
            if (newOperands.length === 0) return null;

            const z = newOperands[0];

            log(`S-partial: applying x=${x} to z=${z}`);
            // x z を適用
            let xzResult;
            if (x instanceof Combinator) {
              xzResult = x.apply([z]);
            } else if (x instanceof Expression) {
              xzResult = new Expression(x, [z]).evaluate();
            } else {
              xzResult = x;
            }
            log(`S-partial: x z = ${xzResult}`);

            log(`S-partial: applying y=${y} to z=${z}`);
            // y z を適用
            let yzResult;
            if (y instanceof Combinator) {
              yzResult = y.apply([z]);
            } else if (y instanceof Expression) {
              yzResult = new Expression(y, [z]).evaluate();
            } else {
              yzResult = y;
            }
            log(`S-partial: y z = ${yzResult}`);

            log(`S-partial: applying xz=${xzResult} to yz=${yzResult}`);
            // (x z) (y z) を適用
            if (xzResult instanceof Combinator) {
              return xzResult.apply([yzResult]);
            } else if (xzResult instanceof Expression) {
              return new Expression(xzResult, [yzResult]).evaluate();
            } else {
              return xzResult;
            }
          }, {
            name: "S-partial-xy",
            description: "S x y - waits for z"
          }
        );
      }

      if (operands.length === 1) {
        const x = operands[0];
        return new Combinator(
          (newOperands) => {
            if (newOperands.length === 0) return null;

            if (newOperands.length === 1) {
              const y = newOperands[0];
              return new Combinator(
                (finalOperands) => {
                  if (finalOperands.length === 0) return null;

                  const z = finalOperands[0];

                  log(`S-partial-x: applying x=${x} to z=${z}`);
                  // x z を適用
                  let xzResult;
                  if (x instanceof Combinator) {
                    xzResult = x.apply([z]);
                  } else if (x instanceof Expression) {
                    xzResult = new Expression(x, [z]).evaluate();
                  } else {
                    xzResult = x;
                  }
                  log(`S-partial-x: x z = ${xzResult}`);

                  log(`S-partial-x: applying y=${y} to z=${z}`);
                  // y z を適用
                  let yzResult;
                  if (y instanceof Combinator) {
                    yzResult = y.apply([z]);
                  } else if (y instanceof Expression) {
                    yzResult = new Expression(y, [z]).evaluate();
                  } else {
                    yzResult = y;
                  }
                  log(`S-partial-x: y z = ${yzResult}`);

                  log(`S-partial-x: applying xz=${xzResult} to yz=${yzResult}`);
                  // (x z) (y z) を適用
                  if (xzResult instanceof Combinator) {
                    return xzResult.apply([yzResult]);
                  } else if (xzResult instanceof Expression) {
                    return new Expression(xzResult, [yzResult]).evaluate();
                  } else {
                    return xzResult;
                  }
                }, {
                  name: "S-partial-xy",
                  description: "S x y - waits for z"
                }
              );
            } else if (newOperands.length >= 2) {
              const [y, z, ...rest] = newOperands;

              log(`S-partial-x: applying x=${x} to z=${z}`);
              // x z を適用
              let xzResult;
              if (x instanceof Combinator) {
                xzResult = x.apply([z]);
              } else if (x instanceof Expression) {
                xzResult = new Expression(x, [z]).evaluate();
              } else {
                xzResult = x;
              }
              log(`S-partial-x: x z = ${xzResult}`);

              log(`S-partial-x: applying y=${y} to z=${z}`);
              // y z を適用
              let yzResult;
              if (y instanceof Combinator) {
                yzResult = y.apply([z]);
              } else if (y instanceof Expression) {
                yzResult = new Expression(y, [z]).evaluate();
              } else {
                yzResult = y;
              }
              log(`S-partial-x: y z = ${yzResult}`);

              log(`S-partial-x: applying xz=${xzResult} to yz=${yzResult}`);
              // (x z) (y z) を適用
              let result;
              if (xzResult instanceof Combinator) {
                result = xzResult.apply([yzResult]);
              } else if (xzResult instanceof Expression) {
                result = new Expression(xzResult, [yzResult]).evaluate();
              } else {
                result = xzResult;
              }

              // 残りの引数があれば続けて適用
              if (rest.length > 0) {
                if (result instanceof Combinator) {
                  return result.apply(rest);
                } else if (result instanceof Expression) {
                  return rest.reduce(
                    (acc, arg) => new Expression(acc, [arg]).evaluate(),
                    result
                  );
                } else {
                  return result;
                }
              }

              return result;
            }
          }, {
            name: "S-partial-x",
            description: "S x - waits for y and z"
          }
        );
      }

      // 引数なし
      return new Combinator(
        (newOperands) => {
          const s = dictionaryOps.lookup("S");
          return s.apply(newOperands);
        }, {
          name: "S",
          description: "Combinator S",
          isBuiltin: true
        }
      );
    }, {
      name: "S",
      description: "Substitution: S x y z = x z (y z)",
      isBuiltin: true
    }
  ));

  // 算術演算
  dictionaryOps.define("ADD", new Combinator(
    (operands) => {
      log(`ADD called with operands: ${operands.map(o => o?.toString()).join(', ')}`);

      if (operands.length >= 2) {
        const a = operands[0];
        const b = operands[1];

        if (a instanceof Fraction && b instanceof Fraction) {
          return a.add(b);
        } else {
          throw new Error("ADD requires two numbers");
        }
      } else if (operands.length === 1) {
        const a = operands[0];
        if (a instanceof Fraction) {
          return new Combinator(
            (newOperands) => {
              if (newOperands.length === 0) return a;

              const b = newOperands[0];
              if (b instanceof Fraction) {
                return a.add(b);
              } else {
                throw new Error("ADD requires two numbers");
              }
            }, {
              name: "ADD-partial",
              description: "Partially applied ADD"
            }
          );
        } else {
          throw new Error("ADD requires a number as first argument");
        }
      } else {
        return new Combinator(
          (newOperands) => {
            const add = dictionaryOps.lookup("ADD");
            return add.apply(newOperands);
          }, {
            name: "ADD",
            description: "Addition operator",
            isBuiltin: true
          }
        );
      }
    }, {
      name: "ADD",
      description: "Adds two numbers",
      isBuiltin: true
    }
  ));

  dictionaryOps.define("SUB", new Combinator(
    (operands) => {
      if (operands.length >= 2) {
        const a = operands[0];
        const b = operands[1];

        if (a instanceof Fraction && b instanceof Fraction) {
          return a.subtract(b);
        } else {
          throw new Error("SUB requires two numbers");
        }
      } else if (operands.length === 1) {
        const a = operands[0];
        if (a instanceof Fraction) {
          return new Combinator(
            (newOperands) => {
              if (newOperands.length === 0) return a;

              const b = newOperands[0];
              if (b instanceof Fraction) {
                return a.subtract(b);
              } else {
                throw new Error("SUB requires two numbers");
              }
            }, {
              name: "SUB-partial",
              description: "Partially applied SUB"
            }
          );
        } else {
          throw new Error("SUB requires a number as first argument");
        }
      } else {
        return new Combinator(
          (newOperands) => {
            const sub = dictionaryOps.lookup("SUB");
            return sub.apply(newOperands);
          }, {
            name: "SUB",
            description: "Subtraction operator",
            isBuiltin: true
          }
        );
      }
    }, {
      name: "SUB",
      description: "Subtracts second number from first",
      isBuiltin: true
    }
  ));

  dictionaryOps.define("MUL", new Combinator(
    (operands) => {
      if (operands.length >= 2) {
        const a = operands[0];
        const b = operands[1];

        if (a instanceof Fraction && b instanceof Fraction) {
          return a.multiply(b);
        } else {
          throw new Error("MUL requires two numbers");
        }
      } else if (operands.length === 1) {
        const a = operands[0];
        if (a instanceof Fraction) {
          return new Combinator(
            (newOperands) => {
              if (newOperands.length === 0) return a;

              const b = newOperands[0];
              if (b instanceof Fraction) {
                return a.multiply(b);
              } else {
                throw new Error("MUL requires two numbers");
              }
            }, {
              name: "MUL-partial",
              description: "Partially applied MUL"
            }
          );
        } else {
          throw new Error("MUL requires a number as first argument");
        }
      } else {
        return new Combinator(
          (newOperands) => {
            const mul = dictionaryOps.lookup("MUL");
            return mul.apply(newOperands);
          }, {
            name: "MUL",
            description: "Multiplication operator",
            isBuiltin: true
          }
        );
      }
    }, {
      name: "MUL",
      description: "Multiplies two numbers",
      isBuiltin: true
    }
  ));

  dictionaryOps.define("DIV", new Combinator(
    (operands) => {
      if (operands.length >= 2) {
        const a = operands[0];
        const b = operands[1];

        if (a instanceof Fraction && b instanceof Fraction) {
          return a.divide(b);
        } else {
          throw new Error("DIV requires two numbers");
        }
      } else if (operands.length === 1) {
        const a = operands[0];
        if (a instanceof Fraction) {
          return new Combinator(
            (newOperands) => {
              if (newOperands.length === 0) return a;

              const b = newOperands[0];
              if (b instanceof Fraction) {
                return a.divide(b);
              } else {
                throw new Error("DIV requires two numbers");
              }
            }, {
              name: "DIV-partial",
              description: "Partially applied DIV"
            }
          );
        } else {
          throw new Error("DIV requires a number as first argument");
        }
      } else {
        return new Combinator(
          (newOperands) => {
            const div = dictionaryOps.lookup("DIV");
            return div.apply(newOperands);
          }, {
            name: "DIV",
            description: "Division operator",
            isBuiltin: true
          }
        );
      }
    }, {
      name: "DIV",
      description: "Divides first number by second",
      isBuiltin: true
    }
  ));

  // 比較演算
  // 等価比較演算子 (EQ)
  dictionaryOps.define("EQ", new Combinator(
    (operands) => {
      // 完全適用の場合
      if (operands.length >= 2) {
        const a = operands[0];
        const b = operands[1];

        // 引数を評価
        const aVal = a instanceof Expression ? a.evaluate() :
          (a instanceof Combinator ? a.apply([]) : a);
        const bVal = b instanceof Expression ? b.evaluate() :
          (b instanceof Combinator ? b.apply([]) : b);

        if (!(aVal instanceof Fraction) || !(bVal instanceof Fraction)) {
          throw new Error("EQ requires numeric arguments");
        }

        return new Fraction(aVal.equals(bVal) ? 1 : 0, 1);
      }
      // 部分適用の場合
      else if (operands.length === 1) {
        const a = operands[0];

        return new Combinator(
          (newOperands) => {
            if (newOperands.length === 0) return a;

            const b = newOperands[0];

            // a と b を評価
            const aVal = a instanceof Expression ? a.evaluate() :
              (a instanceof Combinator ? a.apply([]) : a);
            const bVal = b instanceof Expression ? b.evaluate() :
              (b instanceof Combinator ? b.apply([]) : b);

            if (!(aVal instanceof Fraction) || !(bVal instanceof Fraction)) {
              throw new Error("EQ requires numeric arguments");
            }

            return new Fraction(aVal.equals(bVal) ? 1 : 0, 1);
          }, {
            name: "EQ-partial",
            description: "Partially applied EQ"
          }
        );
      }
      // 引数なしの場合
      else {
        return new Combinator(
          (newOperands) => {
            const eq = dictionaryOps.lookup("EQ");
            return eq.apply(newOperands);
          }, {
            name: "EQ",
            description: "Equal comparison"
          }
        );
      }
    }, {
      name: "EQ",
      description: "Tests if values are equal",
      isBuiltin: true
    }
  ));

  // 小なり比較演算子 (LT)
  dictionaryOps.define("LT", new Combinator(
    (operands) => {
      // 完全適用の場合
      if (operands.length >= 2) {
        const a = operands[0];
        const b = operands[1];

        // 引数を評価
        const aVal = a instanceof Expression ? a.evaluate() :
          (a instanceof Combinator ? a.apply([]) : a);
        const bVal = b instanceof Expression ? b.evaluate() :
          (b instanceof Combinator ? b.apply([]) : b);

        if (!(aVal instanceof Fraction) || !(bVal instanceof Fraction)) {
          throw new Error("LT requires numeric arguments");
        }

        return new Fraction(aVal.lessThan(bVal) ? 1 : 0, 1);
      }
      // 部分適用の場合
      else if (operands.length === 1) {
        const a = operands[0];

        return new Combinator(
          (newOperands) => {
            if (newOperands.length === 0) return a;

            const b = newOperands[0];

            // a と b を評価
            const aVal = a instanceof Expression ? a.evaluate() :
              (a instanceof Combinator ? a.apply([]) : a);
            const bVal = b instanceof Expression ? b.evaluate() :
              (b instanceof Combinator ? b.apply([]) : b);

            if (!(aVal instanceof Fraction) || !(bVal instanceof Fraction)) {
              throw new Error("LT requires numeric arguments");
            }

            return new Fraction(aVal.lessThan(bVal) ? 1 : 0, 1);
          }, {
            name: "LT-partial",
            description: "Partially applied LT"
          }
        );
      }
      // 引数なしの場合
      else {
        return new Combinator(
          (newOperands) => {
            const lt = dictionaryOps.lookup("LT");
            return lt.apply(newOperands);
          }, {
            name: "LT",
            description: "Less than comparison"
          }
        );
      }
    }, {
      name: "LT",
      description: "Tests if first value is less than second",
      isBuiltin: true
    }
  ));

  // 大なり比較演算子 (GT)
  dictionaryOps.define("GT", new Combinator(
    (operands) => {
      // 完全適用の場合
      if (operands.length >= 2) {
        const a = operands[0];
        const b = operands[1];

        // 引数を評価
        const aVal = a instanceof Expression ? a.evaluate() :
          (a instanceof Combinator ? a.apply([]) : a);
        const bVal = b instanceof Expression ? b.evaluate() :
          (b instanceof Combinator ? b.apply([]) : b);

        if (!(aVal instanceof Fraction) || !(bVal instanceof Fraction)) {
          throw new Error("GT requires numeric arguments");
        }

        return new Fraction(aVal.greaterThan(bVal) ? 1 : 0, 1);
      }
      // 部分適用の場合
      else if (operands.length === 1) {
        const a = operands[0];

        return new Combinator(
          (newOperands) => {
            if (newOperands.length === 0) return a;

            const b = newOperands[0];

            // a と b を評価
            const aVal = a instanceof Expression ? a.evaluate() :
              (a instanceof Combinator ? a.apply([]) : a);
            const bVal = b instanceof Expression ? b.evaluate() :
              (b instanceof Combinator ? b.apply([]) : b);

            if (!(aVal instanceof Fraction) || !(bVal instanceof Fraction)) {
              throw new Error("GT requires numeric arguments");
            }

            return new Fraction(aVal.greaterThan(bVal) ? 1 : 0, 1);
          }, {
            name: "GT-partial",
            description: "Partially applied GT"
          }
        );
      }
      // 引数なしの場合
      else {
        return new Combinator(
          (newOperands) => {
            const gt = dictionaryOps.lookup("GT");
            return gt.apply(newOperands);
          }, {
            name: "GT",
            description: "Greater than comparison"
          }
        );
      }
    }, {
      name: "GT",
      description: "Tests if first value is greater than second",
      isBuiltin: true
    }
  ));

  // 出力
  dictionaryOps.define("PRINT", new Combinator(
    (operands) => {
      if (operands.length < 1) throw new Error("PRINT requires one argument");
      const value = operands[0];

      if (value instanceof HolonString) {
        state.output += value.value;
      } else {
        state.output += value.toString();
      }

      return value;
    }, {
      name: "PRINT",
      description: "Prints a value",
      isBuiltin: true
    }
  ));

  dictionaryOps.define("PRINTLN", new Combinator(
    (operands) => {
      if (operands.length < 1) throw new Error("PRINTLN requires one argument");
      const value = operands[0];

      if (value instanceof HolonString) {
        state.output += value.value + "\n";
      } else {
        state.output += value.toString() + "\n";
      }

      return value;
    }, {
      name: "PRINTLN",
      description: "Prints a value followed by a newline",
      isBuiltin: true
    }
  ));

  // 条件分岐用のコンビネータ TRUE, FALSE
  dictionaryOps.define("TRUE", new Combinator(
    (operands) => {
      if (operands.length < 2) throw new Error("TRUE requires two arguments");
      return operands[0];
    }, {
      name: "TRUE",
      description: "TRUE x y = x",
      isBuiltin: true
    }
  ));

  dictionaryOps.define("FALSE", new Combinator(
    (operands) => {
      if (operands.length < 2) throw new Error("FALSE requires two arguments");
      return operands[1];
    }, {
      name: "FALSE",
      description: "FALSE x y = y",
      isBuiltin: true
    }
  ));

  // 条件分岐 (IF cond then else)
  dictionaryOps.define("IF", new Combinator(
    (operands) => {
      if (operands.length < 3) throw new Error("IF requires three arguments");
      const condition = operands[0];

      // 条件が Fraction で 0 以外なら真
      if (condition instanceof Fraction && condition.numerator !== 0) {
        return operands[1];
      } else {
        return operands[2];
      }
    }, {
      name: "IF",
      description: "Conditional: IF cond then else",
      isBuiltin: true
    }
  ));

  // Y コンビネータ（再帰用）: Y f = f (Y f)
  dictionaryOps.define("Y", new Combinator(
    (operands) => {
      if (operands.length < 1) throw new Error("Y requires one argument");
      const f = operands[0];

      // 再帰呼び出しを可能にするための特殊処理
      const recursion = new Combinator(
        (innerOperands) => {
          const yf = new Expression(f, [recursion]);
          return yf.evaluate();
        }, {
          name: "Y-recursion",
          description: "Recursion helper"
        }
      );

      return recursion;
    }, {
      name: "Y",
      description: "Y-combinator for recursion: Y f = f (Y f)",
      isBuiltin: true
    }
  ));
// シンボル演算子 - 四則演算
  dictionaryOps.define("+", dictionaryOps.lookup("ADD"));
  dictionaryOps.define("-", dictionaryOps.lookup("SUB"));
  dictionaryOps.define("*", dictionaryOps.lookup("MUL"));
  dictionaryOps.define("/", dictionaryOps.lookup("DIV"));
  
  // シンボル演算子 - 比較
  dictionaryOps.define("==", dictionaryOps.lookup("EQ"));
  dictionaryOps.define("<", dictionaryOps.lookup("LT"));
  dictionaryOps.define(">", dictionaryOps.lookup("GT"));
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
// 辞書ワードボタンの生成 - 修正版
const renderDictionary = () => {
  // 組み込みワード表示
  elements.builtinWords.innerHTML = '<h3>Built-In Words</h3>';

  // 組み込みワードのグループ分け
  // renderDictionary 関数内の builtinGroups を更新
  const builtinGroups = {
    // コンビネータ
    combinators: ["I", "K", "S", "Y"],
    // 四則演算
    arithmetic: ["+", "-", "*", "/"],
    // 比較演算
    comparison: ["==", "<", ">"],
    // 論理演算
    logic: ["TRUE", "FALSE", "IF", "AND", "OR", "NOT"],
    // ワード定義操作
    wordOps: ["DEF", "DEL"],
    // 出力
    output: ["PRINT", "PRINTLN"]
  };

  // 各グループごとにボタンを生成
  Object.entries(builtinGroups).forEach(([groupName, words]) => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "word-group";

    words.forEach(word => {
      // 辞書に登録されているワードのみ表示
      if (dictionaryOps.lookup(word)) {
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

        groupDiv.appendChild(wordButton);
      }
    });

    // グループに少なくとも1つのボタンがある場合のみ追加
    if (groupDiv.children.length > 0) {
      elements.builtinWords.appendChild(groupDiv);
    }
  });

  // カスタムワード表示
  elements.customWords.innerHTML = '<h3>Custom Words</h3>';

  // カスタムワードを取得
  const customWords = Object.entries(state.dictionary)
    .filter(([_, value]) => value instanceof Expression || (value instanceof Combinator && !value.meta.isBuiltin))
    .map(([name]) => name)
    .sort();

  customWords.forEach(word => {
    const wordInfo = state.dictionary[word];

    const wordButton = document.createElement("button");
    wordButton.textContent = word;
    wordButton.title = wordInfo.toString();
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

// トークン分割
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
      inComment = true;
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else if (inComment) {
      if (char === '\n') {
        inComment = false;
      }
    } else if (char === '"') {
      // 文字列リテラルの処理
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
    } else if (/\s/.test(char)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else if ("()".includes(char)) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
      tokens.push(char);
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

// 式の解析
const parseExpression = (tokens, startIndex) => {
  // 現在のトークンがリテラルまたは名前の場合
  if (tokens[startIndex] !== '(') {
    const token = tokens[startIndex];

    // 数値リテラル
    if (/^-?\d+(\.\d+)?$/.test(token)) {
      return {
        expr: new Fraction(parseInt(token, 10), 1),
        endIndex: startIndex
      };
    }

    // 分数リテラル
    if (token.includes('/')) {
      const [num, denom] = token.split('/');
      return {
        expr: new Fraction(parseInt(num, 10), parseInt(denom, 10)),
        endIndex: startIndex
      };
    }

    // 文字列リテラル
    if (token.startsWith('"') && token.endsWith('"')) {
      return {
        expr: new HolonString(token.slice(1, -1)),
        endIndex: startIndex
      };
    }

    // 名前（辞書ワード）
    const word = dictionaryOps.lookup(normalizeToken(token));
    if (word !== null) {
      return {
        expr: word,
        endIndex: startIndex
      };
    }

    throw new Error(`Unknown token: ${token}`);
  }

  // 括弧で始まる式の処理
  let i = startIndex + 1;
  if (i >= tokens.length) {
    throw new Error("Unexpected end of input");
  }

  // オペレータを解析
  const {
    expr: operator,
    endIndex: operatorEndIndex
  } = parseExpression(tokens, i);

  // オペランドを収集
  const operands = [];
  i = operatorEndIndex + 1;

  while (i < tokens.length && tokens[i] !== ')') {
    const {
      expr: operand,
      endIndex: operandEndIndex
    } = parseExpression(tokens, i);
    operands.push(operand);
    i = operandEndIndex + 1;
  }

  if (i >= tokens.length || tokens[i] !== ')') {
    throw new Error("Unclosed expression");
  }

  return {
    expr: new Expression(operator, operands),
    endIndex: i
  };
};

// 定義文の解析
const parseDefinition = (tokens) => {
  if (tokens.length < 4 || normalizeToken(tokens[0]) !== 'DEF') {
    return null;
  }

  const name = tokens[1];

  // 式を解析
  let expressionTokens = tokens.slice(2);
  if (expressionTokens[0] === '(') {
    const {
      expr
    } = parseExpression(expressionTokens, 0);

    // 辞書に登録
    dictionaryOps.define(name, expr);

    return {
      name,
      expr
    };
  } else {
    throw new Error("Expected an expression after word name in DEF");
  }
};

// 削除文の解析関数を追加
const parseDeleteCommand = (tokens) => {
  if (tokens.length < 2 || normalizeToken(tokens[0]) !== 'DEL') {
    return null;
  }

  const wordName = tokens[1];
  const normalizedName = normalizeToken(wordName);

  // 辞書から削除
  const success = dictionaryOps.remove(normalizedName);

  return {
    name: wordName,
    success
  };
};

// パーサー
const parse = tokens => {
  log(`Parsing ${tokens.length} tokens: ${tokens.join(' ')}`);

  // 定義文かどうかをチェック
  if (tokens.length > 0 && normalizeToken(tokens[0]) === 'DEF') {
    return parseDefinition(tokens);
  }

  // 削除文かどうかをチェック
  if (tokens.length > 0 && normalizeToken(tokens[0]) === 'DEL') {
    return parseDeleteCommand(tokens);
  }

  // 通常の式を解析
  try {
    // 単一のワード実行
    if (tokens.length === 1) {
      const token = tokens[0];

      // 数値や文字列を評価
      if (/^-?\d+(\.\d+)?$/.test(token)) {
        return new Fraction(parseInt(token, 10), 1);
      }

      if (token.includes('/')) {
        const [num, denom] = token.split('/');
        return new Fraction(parseInt(num, 10), parseInt(denom, 10));
      }

      if (token.startsWith('"') && token.endsWith('"')) {
        return new HolonString(token.slice(1, -1));
      }

      // 辞書ワード
      const word = dictionaryOps.lookup(normalizeToken(token));
      if (word !== null) {
        return word;
      }

      throw new Error(`Unknown word: ${token}`);
    }

    // 複数のワード（関数適用）
    if (tokens.length >= 2) {
      // 最初のトークンが辞書ワードで、他のトークンが引数の場合
      const funcName = normalizeToken(tokens[0]);
      const func = dictionaryOps.lookup(funcName);

      if (func !== null) {
        // 残りのトークンを引数として評価
        const args = [];
        for (let i = 1; i < tokens.length; i++) {
          const arg = parse([tokens[i]]);
          args.push(arg);
        }

        // 関数を適用
        if (func instanceof Combinator) {
          return func.apply(args);
        } else if (func instanceof Expression) {
          // 引数ごとに式に適用
          let result = func;
          for (const arg of args) {
            result = new Expression(result, [arg]).evaluate();
          }
          return result;
        } else {
          return func; // 関数でない場合はそのまま返す
        }
      }
    }

    // 括弧で囲まれた式
    if (tokens[0] === '(' && tokens[tokens.length - 1] === ')') {
      const {
        expr
      } = parseExpression(tokens, 0);
      return expr;
    } else {
      const {
        expr
      } = parseExpression(['(', ...tokens, ')'], 0);
      return expr;
    }
  } catch (error) {
    log(`Parse error: ${error.message}`);
    throw error;
  }
};

// 実行関数
const executeCode = code => {
  log(`==== Execution started ====`);
  try {
    log(`Input code: ${code}`);
    const tokens = tokenize(code);

    // 定義文かどうかをチェック
    if (tokens.length > 0 && normalizeToken(tokens[0]) === 'DEF') {
      const definition = parse(tokens);
      if (definition) {
        state.output += `Defined: ${definition.name}\n`;
        updateUI();
        elements.input.value = "";
        log(`Definition successful: ${definition.name}`);
        return;
      }
    }

    // 削除文かどうかをチェック
    if (tokens.length > 0 && normalizeToken(tokens[0]) === 'DEL') {
      const deleteResult = parse(tokens);
      if (deleteResult) {
        if (deleteResult.success) {
          state.output += `Removed: ${deleteResult.name}\n`;
        } else {
          state.output += `Word not found: ${deleteResult.name}\n`;
        }
        updateUI();
        elements.input.value = "";
        log(`Delete command executed for: ${deleteResult.name}`);
        return;
      }
    }

    // 通常の式を評価
    const result = parse(tokens);
    log(`Parsed expression result: ${result}`);

    // 最終結果の評価
    let finalResult;
    if (result instanceof Expression) {
      finalResult = result.evaluate();
    } else if (result instanceof Combinator) {
      // コンビネータは引数がないとそのまま返す
      finalResult = result;
    } else {
      finalResult = result;
    }

    log(`Final result: ${finalResult}`);

    // 結果を出力
    if (state.output.length > 0 && !state.output.endsWith('\n')) {
      state.output += '\n';
    }
    state.output += finalResult.toString();

    updateUI();
    elements.input.value = "";
    log(`Execution successful`);
  } catch (error) {
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

// 初期化
const init = () => {
  log(`Initializing Holon with combinatory logic`);

  // 組み込みコンビネータの初期化
  initializeBuiltins();

  // イベントリスナーの設定
  initEventListeners();

  // UI更新
  updateUI();

  // ウェルカムメッセージ
  state.output = "Holon Combinatory Logic\n" +
    "Example: DEF ADDER (S (K ADD) I)\n" +
    "         ADDER 3 5\n";
  updateUI();
};

// アプリケーション起動
window.addEventListener("DOMContentLoaded", init);