let wasmModule = null;

export async function initWasm() {
    if (wasmModule) return wasmModule;
    
    try {
        console.log('Attempting to load WASM module...');
        
        // 実際のファイルパスを確認
        const baseUrl = import.meta.url.substring(0, import.meta.url.lastIndexOf('/'));
        console.log('Base URL:', baseUrl);
        console.log('Expected module path:', baseUrl + '/pkg/ajisai_core.js');
        
        // GitHub Pages の場合 - 正しいモジュール名に修正
        const module = await import('./pkg/ajisai_core.js');
        console.log('Module loaded:', module);
        
        // init関数を呼び出す（wasm-bindgen 0.2.92以降の場合）
        if (module.default) {
            await module.default();
            console.log('WASM initialized via default export');
        } else if (module.init) {
            await module.init();
            console.log('WASM initialized via init function');
        }
        
        wasmModule = module;
        return module;
    } catch (error) {
        console.error('Failed to load WASM:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        
        // フォールバックとして直接wasmファイルをロードしてみる
        try {
            console.log('Trying fallback method...');
            const wasmPath = new URL('./pkg/ajisai_core_bg.wasm', import.meta.url);
            console.log('WASM path:', wasmPath.href);
            
            const response = await fetch(wasmPath);
            console.log('WASM fetch response:', response.status, response.statusText);
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
        
        return null;
    }
}
