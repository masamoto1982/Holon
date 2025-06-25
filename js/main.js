// アプリケーションのエントリーポイント
document.addEventListener('DOMContentLoaded', () => {
    GUI.init();
});

// WASM初期化完了時にインタープリタを作成
window.addEventListener('wasmLoaded', () => {
    if (window.HolonWasm) {
        window.ajisaiInterpreter = new window.HolonWasm.AjisaiInterpreter();
        console.log('Ajisai interpreter initialized');
    }
});
