// Boot and the one loop: input every frame, the world advances in fixed 1/60 s steps,
// the renderer paints what is there. Screens: title, play, paused, wasted, busted.
// ?seed=N fixes the city. ?shot=start|play|chase|mission stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, CITY, FIELD, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { ACT_CONFIRM, ACT_ENTER, ACT_MISSION, ACT_PAUSE, ACT_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
window.__neon = { world }; // debug hook: live state for testing
const renderer = createRenderer(canvas);

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(v) { try { window.localStorage.setItem(BEST_KEY, String(v)); } catch { /* private mode */ } }
function readSave() {
  try { const raw = window.localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeSave() {
  try {
    const p = world.state.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: p.cash, missionIndex: world.state.missionIndex, x: p.x, y: p.y, best: readBest() }));
  } catch { /* ignore */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.endKind);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  function announce(msg) { status.textContent = msg; }

  function startGame() {
    audio.unlock(); audio.startMusic();
    world.reset();
    if (save) {
      world.state.player.cash = save.cash || 0;
      world.state.missionIndex = Math.min(save.missionIndex || 0, 3);
      if (save.x) { world.state.player.x = save.x; world.state.player.y = save.y; }
      world.state.dialogue = save.missionIndex > 0 ? 'Mara: "Welcome back, Kai. The next job is waiting — press M."' : '';
      world.state.dialogueUntil = world.state.elapsed + 5;
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Neon Harbor. Press M to start a job, E to enter a car.');
  }

  function endGame(kind) {
    screen = kind === 'busted' ? SCREEN_BUSTED : SCREEN_OVER;
    if (world.state.player.cash > best) { best = world.state.player.cash; saveBest(best); }
    writeSave();
    announce(kind === 'busted' ? 'Busted by the Harbor PD.' : 'Wasted. Game over.');
  }

  function screenToWorld(sx, sy) {
    const w = window.innerWidth, h = window.innerHeight;
    const scale = Math.min(w / FIELD.width, h / FIELD.height);
    const ox = (w - FIELD.width * scale) / 2, oy = (h - FIELD.height * scale) / 2;
    const lx = (sx - ox) / scale, ly = (sy - oy) / scale;
    const p = world.state.player;
    const camX = Math.max(0, Math.min(CITY - FIELD.width, p.x - FIELD.width / 2));
    const camY = Math.max(0, Math.min(CITY - FIELD.height, p.y - FIELD.height / 2));
    return { x: lx + camX, y: ly + camY };
  }

  // One-shot presses are latched in `pending` until a simulation step consumes them,
  // so a press that lands on a frame with no step is never silently dropped.
  let pending = 0;

  function handleActions() {
    pending |= input.takeActions();
    if (pending & ACT_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED)) {
      pending = 0;
      startGame();
    } else if (pending & ACT_PAUSE && screen === SCREEN_PLAY) {
      pending = 0;
      screen = SCREEN_PAUSED; announce('Paused.');
    } else if (pending & (ACT_PAUSE | ACT_CONFIRM) && screen === SCREEN_PAUSED) {
      pending = 0;
      screen = SCREEN_PLAY; announce('Playing.');
    }
    return pending;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) { world.step(STEP, { up: false, down: false, left: false, right: false, run: false, brake: false, mouseClicked: false }, 0); return; }
    const raw = input.state();
    const mw = screenToWorld(raw.mouseX, raw.mouseY);
    const events = world.step(STEP, { ...raw, mouseWorldX: mw.x, mouseWorldY: mw.y }, actions);
    if (events & EVENT_WASTED) { world.respawn('wasted'); endGame('wasted'); }
    else if (events & EVENT_BUSTED) { world.respawn('busted'); endGame('busted'); }
    saveTimer += STEP;
    if (saveTimer > 5) { saveTimer = 0; writeSave(); if (world.state.player.cash > best) { best = world.state.player.cash; saveBest(best); } }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        if (first) pending = 0;
        first = false;
        accumulator -= STEP;
      }
    } else accumulator = 0;
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Neon Harbor. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
