let wasmModule = null;

export async function initWasm() {
    if (wasmModule) return wasmModule;
    
    try {
        // GitHub Pages の場合 - 正しいモジュール名に修正
        const module = await import('./pkg/ajisai_core.js');
        await module.default();
        wasmModule = module;
        return module;
    } catch (error) {
        console.error('Failed to load WASM:', error);
        return null;
    }
}
