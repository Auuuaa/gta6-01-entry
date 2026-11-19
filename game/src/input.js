// Keyboard + mouse input. Held keys steer; one-shot presses (enter car, punch, pause,
// confirm, start mission) are queued as flags and taken once by the loop.
export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_ENTER = 4;
export const ACT_PUNCH = 8;
export const ACT_MISSION = 16;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 640, mouseY = 360, mouseDown = false, mouseClicked = false;

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACT_CONFIRM;
    else if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACT_PAUSE;
    else if (e.code === 'KeyE') actions |= ACT_ENTER;
    else if (e.code === 'KeyF') actions |= ACT_PUNCH;
    else if (e.code === 'KeyM') actions |= ACT_MISSION;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); mouseX = e.clientX - r.left; mouseY = e.clientY - r.top; });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouseDown = true; mouseClicked = true; } });
  window.addEventListener('mouseup', () => { mouseDown = false; });

  return {
    held(code) { return keys.has(code); },
    state() {
      return {
        up: UP.has('KeyW') && keys.has('KeyW') || keys.has('ArrowUp'),
        down: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        brake: keys.has('Space'),
        mouseX, mouseY, mouseDown,
        mouseClicked: (() => { const c = mouseClicked; mouseClicked = false; return c; })(),
      };
    },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
