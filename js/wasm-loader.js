let wasmModule = null;

export async function initWasm() {
    if (wasmModule) return wasmModule;
    
    try {
        // GitHub Pages の場合
        const module = await import('./pkg/holon_core.js');
        await module.default();
        wasmModule = module;
        return module;
    } catch (error) {
        console.error('Failed to load WASM:', error);
        return null;
    }
}
