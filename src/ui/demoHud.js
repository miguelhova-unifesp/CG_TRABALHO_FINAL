// HUD do modo debug: lista as teclas (DEBUG_VIEW.keys) e o estado atual de cada modo (so le o estado).
import { DEBUG_VIEW } from '../config/tuning.js';

const STYLE = [
  'position:fixed', 'left:12px', 'top:12px', 'padding:10px 12px', 'border-radius:6px',
  'background:rgba(10,14,20,0.72)', 'color:#f2f4f7', 'font:13px/1.45 ui-monospace,monospace',
  'pointer-events:none', 'white-space:pre', 'z-index:10',
].join(';');

/** event.code -> rotulo curto ('KeyT' -> 'T', 'Digit1' -> '1', 'Backquote' -> '`'). */
export function keyLabel(code) {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { Backquote: '`', Slash: '/', Backslash: '\\', Semicolon: ';' }[code] ?? code;
}

/**
 * @param {HTMLElement} [parent]
 * @returns {{ update: (state: import('../render/demoMode.js').DemoState, targetName: string) => void,
 *   dispose: () => void }}
 */
export function createDemoHud(parent = document.body) {
  const el = document.createElement('div');
  el.style.cssText = STYLE;
  parent.appendChild(el);

  const k = (name) => keyLabel(DEBUG_VIEW.keys[name]).padEnd(2);
  const onOff = (v) => (v ? 'ligado' : 'desligado');
  const DRIVE = 'W A S D / setas  dirigir     Espaco  drift     R  voltar ao grid';

  return {
    update(state, targetName) {
      if (!state.enabled) {
        el.style.display = 'block';
        el.textContent = `${DRIVE}\n${k('toggle')} modo debug (texturas/luz/UV)`;
        return;
      }
      el.style.display = state.hud ? 'block' : 'none';
      el.textContent = [
        DRIVE,
        `${k('toggle')} sair do modo debug`,
        `${k('checker')} xadrez de UV            [${onOff(state.checker)}]`,
        `${k('textures')} texturas (com luz)      [${onOff(!state.untextured)}]`,
        `${k('unlit')} so textura, sem luz     [${onOff(state.unlit)}]`,
        `${k('hemiLight')} luz hemisferica         [${onOff(state.hemiLight)}]`,
        `${k('sunLight')} sol + sombra            [${onOff(state.sunLight)}]`,
        `${k('uvLayouts')} layouts UV (baixar PNG) [${onOff(state.uvLayouts)}]`,
        `${k('inspect')} camera de inspecao      [${onOff(state.inspect)}]`,
        `${k('nextTarget')} alvo da inspecao        [${targetName}]`,
        `${k('hud')} esconder este painel`,
        state.inspect ? 'mouse: arrastar = orbitar, roda = zoom, botao dir. = mover' : '',
      ].filter(Boolean).join('\n');
    },
    dispose() {
      el.remove();
    },
  };
}
