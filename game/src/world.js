// The world: a seeded grid city, the player on foot or in a car, traffic, pedestrians,
// police and the wanted system, four story missions, combat, pickups and particles.
// No drawing here; render.js paints state. step() takes a plain input object so the
// screenshot autopilot can drive the same rules as a human.
import { CITY, ROAD_GAP, ROAD_W, PALETTE, CAR_COLORS, PED_COLORS } from './config.js';
import { pick, range } from './random.js';
import { ACT_ENTER, ACT_MISSION, ACT_PUNCH } from './input.js';

export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION = 4;
export const EVENT_CRIME = 8;

export const ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
const ROOFS = ['#4a4560', '#5b5470', '#3d3a52', '#6b5a7a', '#46586e', '#7a5a4a', '#54486e'];
const PARK = 0.16;

function onRoad(x, y) {
  for (const r of ROADS) {
    if (Math.abs(x - r) < ROAD_W / 2 || Math.abs(y - r) < ROAD_W / 2) return true;
  }
  return false;
}
function circleHitsBuilding(x, y, r, buildings) {
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}
function resolveCircle(x, y, r, buildings) {
  const b = circleHitsBuilding(x, y, r, buildings);
  if (!b) return [x, y];
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  let dx = x - cx, dy = y - cy;
  let d = Math.hypot(dx, dy);
  if (d < 0.01) { dx = 0; dy = -1; d = 1; }
  const push = r - d + 0.5;
  return [x + (dx / d) * push, y + (dy / d) * push];
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export const MISSIONS = [
  { name: 'First Fare', giver: 'Mara Voss', intro: 'Mara: "Kai, my cabbie bailed. Pick up the client at Palm Row and get them to the Coral Motel. Drive like you care."', pickup: { x: 1000, y: 600, label: 'Pick up the client' }, drop: { x: 2200, y: 1800, label: 'Coral Motel' }, reward: 250, timer: 0 },
  { name: 'Harbor Run', giver: 'Mara Voss', intro: 'Mara: "A crate at the docks needs to reach the north depot. Ninety seconds, no questions, no cops."', pickup: { x: 2600, y: 2600, label: 'Collect the crate' }, drop: { x: 600, y: 2200, label: 'North Depot' }, reward: 400, timer: 90 },
  { name: 'The Getaway', giver: 'Mara Voss', intro: 'Mara: "The crew tripped an alarm. Meet me at the plaza, then lose the heat and reach the hideout. Do not get busted."', pickup: { x: 1400, y: 1400, label: 'Meet Mara' }, drop: { x: 300, y: 2600, label: 'Hideout' }, reward: 600, timer: 120 },
  { name: 'Night Watch', giver: 'Mara Voss', intro: 'Mara: "Three street enforcers are shaking down my drivers near the arena. Send them packing — fists or otherwise."', pickup: { x: 1800, y: 1000, label: 'Confront the enforcers' }, drop: null, reward: 800, timer: 0 },
];

export function createWorld(random, audio) {
  const buildings = [];
  const parks = [];
  // Blocks between neighbouring roads; a few are parks, the rest hold 1-3 buildings.
  for (let bx = 0; bx < ROADS.length - 1; bx++) {
    for (let by = 0; by < ROADS.length - 1; by++) {
      const x0 = ROADS[bx] + ROAD_W / 2 + 14, x1 = ROADS[bx + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS[by] + ROAD_W / 2 + 14, y1 = ROADS[by + 1] - ROAD_W / 2 - 14;
      if (random() < PARK) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: Math.floor(range(random, 4, 9)) }); continue; }
      const n = 1 + Math.floor(random() * 3);
      for (let i = 0; i < n; i++) {
        const w = range(random, 90, 170), h = range(random, 90, 170);
        const x = range(random, x0, Math.max(x0 + 1, x1 - w));
        const y = range(random, y0, Math.max(y0 + 1, y1 - h));
        buildings.push({ x, y, w, h, color: pick(random, ROOFS), shade: range(random, 0.85, 1.15) });
      }
    }
  }
  // Marina water along the south and east edges, with a sand strip.
  const water = [{ x: 0, y: 3060, w: CITY, h: 140 }, { x: 3060, y: 0, w: 140, h: 3060 }];

  const state = {
    rng: random, buildings, parks, water,
    elapsed: 0, clock: 17.4, // golden hour: sunset neon look
    player: { x: 600, y: 560, angle: -Math.PI / 2, health: 100, cash: 0, ammo: 24, wanted: 0, inCar: null, onFootSpeed: 0, heat: 0, bustedTimer: 0, invuln: 0 },
    cars: [], peds: [], police: [], thugs: [], bullets: [], particles: [], skids: [], pickups: [], floats: [],
    missionIndex: 0, mission: null, dialogue: '', dialogueUntil: 0,
    storyDone: false, kills: 0, carsStolen: 0, fares: 0,
  };

  function spawnCar(kind, x, y, angle) {
    const car = { x, y, angle, speed: 0, color: pick(random, CAR_COLORS), kind, axis: random() < 0.5 ? 'v' : 'h', dir: random() < 0.5 ? 1 : -1, lane: 18, targetSpeed: range(random, 130, 200), owned: false, hp: 100 };
    state.cars.push(car);
    return car;
  }
  function reset() {
    state.cars.length = 0; state.peds.length = 0; state.police.length = 0; state.thugs.length = 0;
    state.bullets.length = 0; state.particles.length = 0; state.skids.length = 0; state.pickups.length = 0; state.floats.length = 0;
    state.elapsed = 0; state.clock = 17.4;
    const p = state.player;
    p.x = 600; p.y = 560; p.angle = -Math.PI / 2; p.health = 100; p.cash = 0; p.ammo = 24; p.wanted = 0; p.inCar = null; p.heat = 0; p.bustedTimer = 0; p.invuln = 0;
    state.missionIndex = 0; state.mission = null; state.dialogue = ''; state.storyDone = false; state.kills = 0; state.carsStolen = 0; state.fares = 0;
    // Parked cars near the start and scattered on roads.
    spawnCar('parked', 660, 600, 0); spawnCar('parked', 1000, 660, Math.PI / 2);
    spawnCar('parked', 1800, 1400, 0); spawnCar('parked', 2200, 1000, -Math.PI / 2);
    spawnCar('parked', 1400, 2200, Math.PI); spawnCar('parked', 2600, 1800, 0);
    spawnCar('parked', 600, 1800, Math.PI / 2); spawnCar('parked', 3000, 2200, -Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const road = pick(random, ROADS);
      const along = range(random, 150, 3050);
      const c = spawnCar('traffic', 0, 0, 0);
      if (c.axis === 'v') { c.x = road + (c.dir > 0 ? 18 : -18); c.y = along; c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { c.y = road + (c.dir > 0 ? 18 : -18); c.x = along; c.angle = c.dir > 0 ? 0 : Math.PI; }
      c.speed = c.targetSpeed;
    }
    for (let i = 0; i < 22; i++) spawnPed();
    for (let i = 0; i < 10; i++) spawnPickup();
  }
  function spawnPed(x, y) {
    const road = pick(random, ROADS);
    const along = range(random, 120, 3080);
    const vertical = random() < 0.5;
    const px = x ?? (vertical ? road + (random() < 0.5 ? 52 : -52) : along);
    const py = y ?? (vertical ? along : road + (random() < 0.5 ? 52 : -52));
    state.peds.push({ x: px, y: py, angle: range(random, 0, Math.PI * 2), speed: range(random, 40, 70), color: pick(random, PED_COLORS), flee: 0, down: 0, walkPhase: random() * 6 });
  }
  function spawnPickup() {
    const road = pick(random, ROADS);
    const type = pick(random, ['cash', 'cash', 'health', 'ammo']);
    const along = range(random, 200, 3000);
    state.pickups.push({ x: random() < 0.5 ? road : along, y: random() < 0.5 ? along : road, type, respawn: 0, bob: random() * 6 });
  }
  function addFloat(x, y, text, color) { state.floats.push({ x, y, text, color: color || '#f2c94c', life: 1.4 }); }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = random() * Math.PI * 2, s = range(random, 20, speed || 160);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(random, 0.3, 0.8), color, size: range(random, 2, 5) });
    }
  }
  function crime(stars, why) {
    const p = state.player;
    p.wanted = Math.min(5, p.wanted + stars);
    p.heat = 12;
    if (why) addFloat(p.x, p.y - 30, why, '#ef4444');
    return EVENT_CRIME;
  }
  function startMission(index) {
    const def = MISSIONS[index];
    state.mission = { def, stage: 'pickup', target: def.pickup, timer: def.timer, passenger: false, thugsLeft: 0 };
    state.dialogue = def.intro;
    state.dialogueUntil = state.elapsed + 6;
    if (index === 3) {
      for (let i = 0; i < 3; i++) {
        state.thugs.push({ x: 1800 + (i - 1) * 90 + range(random, -30, 30), y: 1000 + range(random, -40, 40), angle: 0, hp: 60, speed: 90, shootTimer: range(random, 1, 2), color: '#7f1d1d' });
      }
      state.mission.thugsLeft = 3;
    }
    if (audio) audio.mission();
  }
  function completeMission() {
    const m = state.mission;
    state.player.cash += m.def.reward;
    state.fares++;
    addFloat(state.player.x, state.player.y - 40, `+$${m.def.reward}  ${m.def.name} complete!`, '#3ddc84');
    state.dialogue = `Mara: "Clean work, Kai. $${m.def.reward} is yours."`;
    state.dialogueUntil = state.elapsed + 5;
    state.mission = null;
    state.missionIndex++;
    if (state.missionIndex >= MISSIONS.length) {
      state.storyDone = true;
      state.dialogue = 'Mara: "That\'s the whole board, Kai. Neon Harbor is yours now."';
      state.dialogueUntil = state.elapsed + 8;
    }
    if (audio) audio.cash();
    return EVENT_MISSION;
  }
  function spawnPolice() {
    const p = state.player;
    const a = random() * Math.PI * 2;
    const x = Math.max(120, Math.min(3080, p.x + Math.cos(a) * 750));
    const y = Math.max(120, Math.min(3080, p.y + Math.sin(a) * 750));
    const car = spawnCar('police', x, y, a);
    car.color = '#1e40af'; car.targetSpeed = 260; car.speed = 200;
    state.police.push(car);
    return car;
  }
  function nearestCar(x, y, maxD, kind) {
    let best = null, bd = maxD;
    for (const c of state.cars) {
      if (kind && c.kind !== kind) continue;
      const d = dist({ x, y }, c);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.inCar) {
      const car = p.inCar;
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      const accel = (input.up ? 1 : 0) - (input.down ? 0.55 : 0);
      const maxSpeed = 540;
      car.speed += accel * 430 * dt;
      car.speed -= car.speed * (input.brake ? 2.2 : 0.45) * dt;
      if (Math.abs(car.speed) > maxSpeed) car.speed = Math.sign(car.speed) * maxSpeed;
      if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;
      car.angle += steer * (0.35 + 0.65 * Math.abs(car.speed) / maxSpeed) * 2.3 * dt * (car.speed >= 0 ? 1 : -1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const [rx, ry] = resolveCircle(nx, ny, 20, state.buildings);
      if ((rx !== nx || ry !== ny) && Math.abs(car.speed) > 120) { if (audio) audio.crash(); burst(car.x, car.y, '#fbbf24', 8, 120); car.speed *= 0.4; }
      car.x = Math.max(40, Math.min(CITY - 40, rx));
      car.y = Math.max(40, Math.min(CITY - 40, ry));
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      if (Math.abs(car.speed) > 260 || (input.brake && Math.abs(car.speed) > 120)) {
        state.skids.push({ x: car.x - Math.cos(car.angle) * 16, y: car.y - Math.sin(car.angle) * 16, angle: car.angle, life: 2.5 });
        if (state.skids.length > 220) state.skids.shift();
        if (Math.random() < 0.3) burst(car.x - Math.cos(car.angle) * 16, car.y - Math.sin(car.angle) * 16, '#9ca3af', 1, 40);
      }
      if (audio) audio.setEngine(Math.abs(car.speed) / maxSpeed, true);
      return;
    }
    if (audio) audio.setEngine(0, false);
    const sp = input.run ? 340 : 200;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; p.angle = Math.atan2(my, mx); p.onFootSpeed = sp; }
    else p.onFootSpeed = 0;
    let nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt;
    [nx, ny] = resolveCircle(nx, ny, 13, state.buildings);
    p.x = Math.max(30, Math.min(CITY - 30, nx));
    p.y = Math.max(30, Math.min(CITY - 30, ny));
  }

  function stepTraffic(dt) {
    for (const c of state.cars) {
      if (c.kind !== 'traffic') continue;
      // At an intersection, sometimes turn onto the cross street.
      const nearX = ROADS.some((r) => Math.abs(c.x - r) < 24);
      const nearY = ROADS.some((r) => Math.abs(c.y - r) < 24);
      if (nearX && nearY && random() < 0.012) {
        if (c.axis === 'v') { c.axis = 'h'; c.dir = random() < 0.5 ? 1 : -1; c.y = ROADS.reduce((a, b) => Math.abs(b - c.y) < Math.abs(a - c.y) ? b : a) + (c.dir > 0 ? 18 : -18); c.angle = c.dir > 0 ? 0 : Math.PI; }
        else { c.axis = 'v'; c.dir = random() < 0.5 ? 1 : -1; c.x = ROADS.reduce((a, b) => Math.abs(b - c.x) < Math.abs(a - c.x) ? b : a) + (c.dir > 0 ? 18 : -18); c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      }
      c.speed += (c.targetSpeed - c.speed) * dt * 0.5;
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      if (c.x < 100 || c.x > 3100 || c.y < 100 || c.y > 3100) { c.angle += Math.PI; c.dir *= -1; c.x = Math.max(120, Math.min(3080, c.x)); c.y = Math.max(120, Math.min(3080, c.y)); }
      const [rx, ry] = resolveCircle(c.x, c.y, 18, state.buildings);
      c.x = rx; c.y = ry;
    }
  }
  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.down > 0) { ped.down -= dt; continue; }
      const d = dist(ped, p);
      const danger = (p.inCar && Math.abs(p.inCar.speed) > 220 && d < 160) || state.bullets.length > 0;
      let sp = ped.speed;
      if (d < 130 && (danger || ped.flee > 0)) {
        ped.flee = 1.2; sp = 190;
        ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
      } else if (ped.flee > 0) { ped.flee -= dt; }
      else {
        // Keep walking along the sidewalk; pick a new heading at intersections.
        const nearX = ROADS.some((r) => Math.abs(ped.x - r) < 60);
        const nearY = ROADS.some((r) => Math.abs(ped.y - r) < 60);
        if (nearX && nearY && random() < 0.01) ped.angle = pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
      ped.x += Math.cos(ped.angle) * sp * dt;
      ped.y += Math.sin(ped.angle) * sp * dt;
      ped.x = Math.max(30, Math.min(CITY - 30, ped.x));
      ped.y = Math.max(30, Math.min(CITY - 30, ped.y));
      ped.walkPhase += dt * sp * 0.05;
    }
  }
  function stepPolice(dt) {
    const p = state.player;
    const want = Math.min(5, p.wanted);
    while (state.police.length < want) spawnPolice();
    while (state.police.length > want) { const c = state.police.pop(); const i = state.cars.indexOf(c); if (i >= 0) state.cars.splice(i, 1); }
    for (const car of state.police) {
      const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
      let diff = targetAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
      // After a ram the cop recovers slowly, giving the player a real escape window.
      if (car.recover > 0) { car.recover -= dt; car.targetSpeed = 70; }
      else car.targetSpeed = 260;
      car.speed += (car.targetSpeed - car.speed) * dt * 0.8;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const [rx, ry] = resolveCircle(car.x, car.y, 20, state.buildings);
      car.x = rx; car.y = ry;
      // Ram the player: one hit per cooldown, with a bounce so the cop cannot grind HP.
      const d = dist(car, p);
      if (d < 44) {
        car.ramCd = (car.ramCd || 0) - dt;
        if (p.inCar) {
          if (Math.abs(car.speed) > 60 && car.ramCd <= 0) {
            car.ramCd = 1.5; car.recover = 3; p.health -= 2; car.speed *= 0.2;
            // Bounce the cop well clear so it must re-approach for the next hit.
            const nx = (car.x - p.x) / (d || 1), ny = (car.y - p.y) / (d || 1);
            car.x += nx * 70; car.y += ny * 70;
            if (audio) audio.crash(); burst(p.x, p.y, '#f87171', 4, 100);
          }
        } else if (p.invuln <= 0) {
          p.bustedTimer += dt;
          p.health -= 2 * dt;
        }
      } else if (car.ramCd > 0) car.ramCd -= dt;
      // Siren + flashing lights handled by the renderer via state.
    }
    if (audio) audio.sirenTick(dt);
    if (audio) audio.setSiren(state.police.length > 0);
  }
  function stepThugs(dt) {
    const p = state.player;
    for (const t of state.thugs) {
      if (t.hp <= 0) continue;
      const d = dist(t, p);
      t.angle = Math.atan2(p.y - t.y, p.x - t.x);
      if (d > 260) { t.x += Math.cos(t.angle) * t.speed * dt; t.y += Math.sin(t.angle) * t.speed * dt; }
      else if (d < 120) { t.x -= Math.cos(t.angle) * t.speed * 0.5 * dt; t.y -= Math.sin(t.angle) * t.speed * 0.5 * dt; }
      t.shootTimer -= dt;
      if (t.shootTimer <= 0 && d < 420 && p.invuln <= 0) {
        t.shootTimer = range(random, 1.2, 2.2);
        state.bullets.push({ x: t.x, y: t.y, vx: Math.cos(t.angle) * 520, vy: Math.sin(t.angle) * 520, life: 1.2, fromPlayer: false });
        if (audio) audio.shoot();
      }
      const [rx, ry] = resolveCircle(t.x, t.y, 14, state.buildings);
      t.x = rx; t.y = ry;
    }
  }
  function stepBullets(dt) {
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (circleHitsBuilding(b.x, b.y, 2, state.buildings)) { b.life = 0; burst(b.x, b.y, '#d6d3d1', 4, 80); continue; }
      if (b.fromPlayer) {
        for (const t of state.thugs) {
          if (t.hp > 0 && dist(b, t) < 18) { t.hp -= 34; b.life = 0; burst(t.x, t.y, '#ef4444', 8, 140); if (t.hp <= 0) { state.kills++; addFloat(t.x, t.y - 24, 'Enforcer down!', '#3ddc84'); if (state.mission) state.mission.thugsLeft--; } break; }
        }
        if (b.life <= 0) continue;
        for (const ped of state.peds) {
          if (ped.down <= 0 && dist(b, ped) < 15) { ped.down = 999; b.life = 0; burst(ped.x, ped.y, '#ef4444', 8, 120); crime(1, 'Assault!'); break; }
        }
        if (b.life <= 0) continue;
        for (const c of state.police) {
          if (dist(b, c) < 22) { b.life = 0; burst(c.x, c.y, '#fbbf24', 6, 120); crime(1, 'Attacking police!'); break; }
        }
      } else if (dist(b, p) < 16 && p.invuln <= 0) {
        b.life = 0; p.health -= 9; p.invuln = 0.4; burst(p.x, p.y, '#ef4444', 6, 120);
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < CITY && b.y > 0 && b.y < CITY);
  }
  function stepCollisions(dt) {
    const p = state.player;
    // Player car vs traffic / parked cars.
    if (p.inCar) {
      const car = p.inCar;
      for (const c of state.cars) {
        if (c === car) continue;
        const d = dist(car, c);
        if (d < 40 && d > 0.01) {
          const push = (40 - d);
          const nx = (car.x - c.x) / d, ny = (car.y - c.y) / d;
          // The player keeps the road; the other car takes most of the shove.
          car.x += nx * push * 0.25; car.y += ny * push * 0.25;
          if (c.kind === 'traffic' || c.kind === 'parked') { c.x -= nx * push * 0.75; c.y -= ny * push * 0.75; c.speed *= 0.5; }
          if (Math.abs(car.speed) > 200) { car.speed *= 0.55; if (audio) audio.crash(); burst(car.x, car.y, '#fbbf24', 6, 120); }
        }
      }
      // Running over pedestrians is a crime.
      for (const ped of state.peds) {
        if (ped.down <= 0 && dist(car, ped) < 34 && Math.abs(car.speed) > 60) {
          ped.down = 999; burst(ped.x, ped.y, '#ef4444', 10, 160); crime(1, 'Hit a pedestrian!');
        }
      }
    } else {
      // On foot: bumped by traffic.
      for (const c of state.cars) {
        if (c.kind === 'traffic' && dist(p, c) < 34 && Math.abs(c.speed) > 80) {
          p.health -= 12; p.invuln = 1; burst(p.x, p.y, '#ef4444', 8, 140);
          p.x += (p.x - c.x) * 0.5; p.y += (p.y - c.y) * 0.5;
        }
      }
    }
    // Pickups.
    for (const pk of state.pickups) {
      if (pk.respawn > 0) { pk.respawn -= dt; continue; }
      if (dist(p, pk) < 34) {
        pk.respawn = 20;
        if (pk.type === 'cash') { p.cash += 50; addFloat(pk.x, pk.y - 20, '+$50', '#f2c94c'); }
        else if (pk.type === 'health') { p.health = Math.min(100, p.health + 30); addFloat(pk.x, pk.y - 20, '+30 HP', '#3ddc84'); }
        else { p.ammo += 12; addFloat(pk.x, pk.y - 20, '+12 ammo', '#22d3ee'); }
        if (audio) audio.pickup();
      }
    }
  }
  function stepMission(dt, input) {
    const m = state.mission;
    const p = state.player;
    if (!m) return 0;
    if (m.timer > 0) {
      m.timer -= dt;
      if (m.timer <= 0) {
        state.dialogue = 'Mara: "Too slow. The job is dead — come back when you\'re ready."';
        state.dialogueUntil = state.elapsed + 5;
        state.mission = null;
        return 0;
      }
    }
    if (m.def.name === 'Night Watch') {
      if (m.thugsLeft <= 0) return completeMission();
      return 0;
    }
    const t = m.target;
    if (dist(p, t) < 70) {
      if (m.stage === 'pickup') {
        if (m.def.name === 'The Getaway') { crime(2, 'Alarm tripped!'); }
        m.stage = 'drop'; m.target = m.def.drop; m.timer = m.def.timer;
        state.dialogue = m.def.name === 'First Fare' ? 'Client: "Coral Motel, and step on it." ' : m.def.name === 'Harbor Run' ? 'Package secured. North Depot, fast.' : 'Mara: "They\'re on us! Hideout, now!"';
        state.dialogueUntil = state.elapsed + 5;
        if (audio) audio.mission();
      } else if (m.stage === 'drop') {
        return completeMission();
      }
    }
    return 0;
  }
  function stepWanted(dt) {
    const p = state.player;
    if (p.heat > 0) p.heat -= dt;
    if (p.wanted > 0 && p.heat <= 0) {
      const nearCop = state.police.some((c) => dist(c, p) < 600);
      if (!nearCop) {
        p.wanted -= dt / 12;
        if (p.wanted < 0.5) { p.wanted = 0; state.police.forEach((c) => { const i = state.cars.indexOf(c); if (i >= 0) state.cars.splice(i, 1); }); state.police.length = 0; addFloat(p.x, p.y - 30, 'You lost the heat.', '#22d3ee'); }
      }
    }
  }

  function step(dt, input, actions) {
    let events = 0;
    state.elapsed += dt;
    state.clock = (17.4 + state.elapsed * 0.004) % 24;
    const p = state.player;

    // One-shot actions (bitmask: ACT_ENTER / ACT_PUNCH / ACT_MISSION from input.js).
    if (actions) {
      if (actions & ACT_ENTER) {
        if (p.inCar) {
          const car = p.inCar;
          car.kind = 'parked'; car.owned = true; car.speed = 0;
          p.inCar = null;
          p.x = car.x - Math.cos(car.angle) * 0 + 30; p.y = car.y + 30;
          [p.x, p.y] = resolveCircle(p.x, p.y, 13, state.buildings);
        } else {
          const car = nearestCar(p.x, p.y, 70);
          if (car) {
            if (!car.owned && car.kind !== 'police') { state.carsStolen++; events |= crime(1, 'Car stolen!'); }
            if (car.kind === 'police') { events |= crime(2, 'Stole a police car!'); }
            car.kind = 'player'; car.owned = true;
            p.inCar = car;
          }
        }
      }
      if (actions & ACT_PUNCH && !p.inCar) {
        let hit = false;
        for (const t of state.thugs) {
          if (t.hp > 0 && dist(p, t) < 52) { t.hp -= 25; hit = true; burst(t.x, t.y, '#ef4444', 6, 120); if (t.hp <= 0) { state.kills++; if (state.mission) state.mission.thugsLeft--; addFloat(t.x, t.y - 24, 'Enforcer down!', '#3ddc84'); } break; }
        }
        if (!hit) for (const ped of state.peds) {
          if (ped.down <= 0 && dist(p, ped) < 48) { ped.down = 999; hit = true; burst(ped.x, ped.y, '#ef4444', 6, 120); events |= crime(1, 'Assault!'); break; }
        }
        if (audio) audio.punch();
      }
      if (actions & ACT_MISSION && !state.mission && state.missionIndex < MISSIONS.length) startMission(state.missionIndex);
    }
    // Shooting (mouse click, on foot only; driving uses the horn of justice: no).
    if (input.mouseClicked && !p.inCar && p.ammo > 0) {
      p.ammo--;
      const wx = input.mouseWorldX ?? p.x, wy = input.mouseWorldY ?? p.y;
      const a = Math.atan2(wy - p.y, wx - p.x);
      p.angle = a;
      state.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.9, fromPlayer: true });
      burst(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24, '#fde68a', 4, 90);
      if (audio) audio.shoot();
      if (p.wanted === 0 && random() < 0.5) events |= crime(1, 'Shots fired!');
    }

    stepPlayer(dt, input);
    stepTraffic(dt);
    stepPeds(dt);
    if (p.wanted > 0 || state.police.length > 0) stepPolice(dt);
    stepThugs(dt);
    stepBullets(dt);
    stepCollisions(dt);
    events |= stepMission(dt, input);
    stepWanted(dt);

    // Particles / floats / skids decay.
    for (const pt of state.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const f of state.floats) { f.y -= 24 * dt; f.life -= dt; }
    state.floats = state.floats.filter((f) => f.life > 0);
    for (const s of state.skids) s.life -= dt;
    state.skids = state.skids.filter((s) => s.life > 0);

    if (p.health <= 0) return events | EVENT_WASTED;
    if (p.bustedTimer > 1.4 && !p.inCar) return events | EVENT_BUSTED;
    if (p.bustedTimer > 3 && p.inCar && p.inCar.speed < 30) return events | EVENT_BUSTED;
    if (p.inCar) p.bustedTimer = Math.max(0, p.bustedTimer - dt * 0.5);
    return events;
  }

  function respawn(kind) {
    const p = state.player;
    p.health = 100; p.wanted = 0; p.bustedTimer = 0; p.invuln = 2;
    p.cash = Math.max(0, p.cash - 100);
    p.inCar = null;
    if (kind === 'wasted') { p.x = 600; p.y = 1000; state.dialogue = 'You woke up at Solano General. The hospital kept $100.'; }
    else { p.x = 1000; p.y = 1400; state.dialogue = 'Busted. The Harbor PD let you off with a $100 fine.'; }
    state.dialogueUntil = state.elapsed + 5;
    state.police.forEach((c) => { const i = state.cars.indexOf(c); if (i >= 0) state.cars.splice(i, 1); });
    state.police.length = 0;
    if (audio) audio.busted();
  }

  reset();
  return { state, reset, step, startMission, respawn, nearestCar, crime, onRoad, MISSIONS };
}

// Autopilot for screenshot scenes: drives the real rules toward the current objective,
// steals a nearby car when on foot, and fires at thugs when in range.
export function autopilotInput(world, dt) {
  const s = world.state, p = s.player;
  const input = { up: false, down: false, left: false, right: false, run: false, brake: false, mouseClicked: false, mouseWorldX: p.x, mouseWorldY: p.y };
  let target = null;
  if (s.mission) target = s.mission.target;
  else if (s.thugs.some((t) => t.hp > 0)) target = s.thugs.find((t) => t.hp > 0);
  else {
    // Cruise the city: pick a new random intersection when the last one is reached.
    if (!world.cruiseTarget || Math.hypot(world.cruiseTarget.x - p.x, world.cruiseTarget.y - p.y) < 120) {
      world.cruiseTarget = { x: ROADS[Math.floor(s.rng() * ROADS.length)], y: ROADS[Math.floor(s.rng() * ROADS.length)] };
    }
    target = world.cruiseTarget;
  }
  const dx = target.x - p.x, dy = target.y - p.y;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (p.inCar) {
    // Road-following autopilot: travel along the road the car is already on, switching
    // roads only at intersections (L-shaped route on the grid). Off-road, head for the
    // nearest road point first. All mission targets sit on roads.
    const nearestRoad = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const vx = nearestRoad(p.x), hy = nearestRoad(p.y);
    const vxt = nearestRoad(target.x), hyt = nearestRoad(target.y);
    const onV = Math.abs(p.x - vx), onH = Math.abs(p.y - hy);
    let wp;
    if (onH <= 36 && onV > 36) {
      // On a horizontal road: stay on it; turn at the vertical road nearest the target.
      wp = (hyt === hy) ? { x: target.x, y: hy } : { x: vxt, y: hy };
    } else if (onV <= 36 && onH > 36) {
      // On a vertical road: stay on it; turn at the horizontal road nearest the target.
      wp = (vxt === vx) ? { x: vx, y: target.y } : { x: vx, y: hyt };
    } else if (onV <= 36 && onH <= 36) {
      // At an intersection: pick the axis that gets closer to the target.
      wp = (Math.abs(target.x - p.x) > Math.abs(target.y - p.y)) ? { x: target.x, y: hy } : { x: vx, y: target.y };
    } else {
      // Off-road: head for the nearer road, axis-aligned.
      wp = (onV < onH) ? { x: vx, y: p.y } : { x: p.x, y: hy };
    }
    const wa = Math.atan2(wp.y - p.y, wp.x - p.x);
    let wd = wa - p.angle;
    while (wd > Math.PI) wd -= Math.PI * 2;
    while (wd < -Math.PI) wd += Math.PI * 2;
    const wdist = Math.hypot(wp.x - p.x, wp.y - p.y);
    // Forward only: brake and turn when the waypoint is behind us, never reverse.
    input.up = Math.abs(wd) < 0.9 && wdist > 24;
    if (wd > 0.25) input.right = true;
    else if (wd < -0.25) input.left = true;
    if (wdist < 160 && Math.abs(p.inCar.speed) > wdist * 0.9) input.brake = true;
    if (Math.abs(wd) > 1.2 && Math.abs(p.inCar.speed) > 120) input.brake = true;
  } else {
    const near = world.nearestCar(p.x, p.y, 70, 'parked');
    if (near) return { ...input, enter: true };
    // Walk toward the nearest parked car first, then the target.
    const car = s.cars.find((c) => c.kind === 'parked');
    const goal = car && Math.hypot(target.x - p.x, target.y - p.y) > 300 ? car : target;
    const gx = goal.x - p.x, gy = goal.y - p.y;
    const ga = Math.atan2(gy, gx);
    let gd = ga - p.angle;
    while (gd > Math.PI) gd -= Math.PI * 2;
    while (gd < -Math.PI) gd += Math.PI * 2;
    // On foot, movement is screen-relative in world axes: use direct axis keys.
    input.up = gy < -20; input.down = gy > 20; input.left = gx < -20; input.right = gx > 20;
    input.run = true;
    const thug = s.thugs.find((t) => t.hp > 0 && Math.hypot(t.x - p.x, t.y - p.y) < 380);
    if (thug && p.ammo > 0) { input.mouseClicked = true; input.mouseWorldX = thug.x; input.mouseWorldY = thug.y; }
  }
  return input;
}
