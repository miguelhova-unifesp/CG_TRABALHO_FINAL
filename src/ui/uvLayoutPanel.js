// Painel do modo debug com os layouts UV (canvas) e um botao "baixar PNG" para cada um.
// Os canvases sao desenhados na primeira abertura (build) e reaproveitados depois.

const STYLE = [
  'position:fixed', 'right:12px', 'top:12px', 'width:300px', 'max-height:calc(100vh - 24px)',
  'overflow-y:auto', 'padding:10px 12px', 'border-radius:6px', 'background:rgba(10,14,20,0.85)',
  'color:#f2f4f7', 'font:13px/1.4 ui-monospace,monospace', 'z-index:11', 'display:none',
].join(';');
const BUTTON = 'margin:4px 0 12px;padding:4px 10px;font:inherit;cursor:pointer';

/** Baixa o canvas como PNG (blob + link temporario). */
function download(canvas, name) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

/**
 * @param {{
 *   build: () => Array<{ name: string, title: string, canvas: HTMLCanvasElement }>,
 *   closeHint: string,
 *   onClose: () => void,
 *   parent?: HTMLElement,
 * }} options
 */
export function createUvLayoutPanel({ build, closeHint, onClose, parent = document.body }) {
  const el = document.createElement('div');
  el.style.cssText = STYLE;
  parent.appendChild(el);
  let built = false;

  function fill() {
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';
    const title = document.createElement('b');
    title.textContent = `Layouts UV (${closeHint} fecha)`;
    const close = document.createElement('button');
    close.textContent = 'x';
    close.style.cssText = 'font:inherit;cursor:pointer';
    close.addEventListener('click', onClose);
    header.append(title, close);
    el.appendChild(header);

    for (const { name, title: label, canvas } of build()) {
      const caption = document.createElement('div');
      caption.textContent = label;
      canvas.style.cssText = 'display:block;width:100%;height:auto;margin-top:4px;background:#222';
      const button = document.createElement('button');
      button.textContent = `baixar ${name}.png (${canvas.width}x${canvas.height})`;
      button.style.cssText = BUTTON;
      button.addEventListener('click', () => download(canvas, name));
      el.append(caption, canvas, button);
    }
  }

  return {
    /** @param {boolean} open */
    setOpen(open) {
      if (open && !built) {
        fill();
        built = true;
      }
      el.style.display = open ? 'block' : 'none';
    },
    dispose() {
      el.remove();
    },
  };
}
