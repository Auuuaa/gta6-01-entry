// Screenshot scenes behind ?shot=start|play|chase|mission. Each plays the real rules
// forward from a fresh world for a fixed number of steps, steered by the autopilot, so the
// frame is what a short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { autopilotInput } from './world.js';
import { ACT_ENTER } from './input.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

function runFor(world, seconds, autopilot) {
  for (let i = 0; i < seconds / SAMPLE; i++) {
    const input = autopilot ? autopilotInput(world, SAMPLE) : { up: false, down: false, left: false, right: false, run: false, brake: false, mouseClicked: false };
    const actions = input.enter ? ACT_ENTER : 0;
    const events = world.step(SAMPLE, input, actions);
    if (events & 1) break; // wasted
    if (events & 2) break; // busted
  }
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    world.startMission(0);
    runFor(world, 26, true);
    return { screen: SCREEN_PLAY, best: 0, endKind: null };
  }
  if (name === 'chase') {
    world.crime(3, 'Heat!');
    runFor(world, 16, true);
    return { screen: SCREEN_PLAY, best: 0, endKind: null };
  }
  if (name === 'mission') {
    world.startMission(0);
    runFor(world, 11, true);
    return { screen: SCREEN_PLAY, best: 0, endKind: null };
  }
  // start (default): a few seconds of ambient city life behind the title.
  runFor(world, 5, false);
  return { screen: SCREEN_TITLE, best: 0, endKind: null };
}
