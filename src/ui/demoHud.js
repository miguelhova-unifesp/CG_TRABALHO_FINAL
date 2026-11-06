// HUD do modo de demonstracao: lista as teclas e o estado atual de cada modo (so le o estado).

const STYLE = [
  'position:fixed', 'left:12px', 'top:12px', 'padding:10px 12px', 'border-radius:6px',
  'background:rgba(10,14,20,0.72)', 'color:#f2f4f7', 'font:13px/1.45 ui-monospace,monospace',
  'pointer-events:none', 'white-space:pre', 'z-index:10',
].join(';');

/**
 * @param {HTMLElement} [parent]
 * @returns {{ update: (state: import('../render/demoMode.js').DemoState, targetName: string) => void,
 *   dispose: () => void }}
 */
export function createDemoHud(parent = document.body) {
  const el = document.createElement('div');
  el.style.cssText = STYLE;
  parent.appendChild(el);

  const onOff = (v) => (v ? 'ligado' : 'desligado');

  return {
    update(state, targetName) {
      el.style.display = state.hud ? 'block' : 'none';
      el.textContent = [
        'W A S D / setas  dirigir     R  voltar ao grid',
        `T  UV checker           [${onOff(state.checker)}]`,
        `L  so textura (sem luz) [${onOff(state.unlit)}]`,
        `C  camera de inspecao   [${onOff(state.inspect)}]`,
        `V  alvo da inspecao     [${targetName}]`,
        'H  esconder este painel',
        state.inspect ? 'mouse: arrastar = orbitar, roda = zoom, botao dir. = mover' : '',
      ].filter(Boolean).join('\n');
    },
    dispose() {
      el.remove();
    },
  };
}
