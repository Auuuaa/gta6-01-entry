// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window; the camera follows the player through the city.
import { FIELD, FONT, PALETTE, CITY, ROAD_W } from './config.js';
import { ROADS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const MM = 210; // minimap size

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: 1280, h: 720 };
  const fonts = new Map();
  function font(size, bold) { const k = size + (bold ? 'b' : ''); if (!fonts.has(k)) fonts.set(k, `${bold ? '700 ' : ''}${size}px ${FONT}`); return fonts.get(k); }
  function text(v, x, y, size, color, align, bold) {
    ctx.font = font(size, bold); ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(v, x, y);
  }
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio), h = Math.round(window.innerHeight * ratio);
    canvas.width = w; canvas.height = h;
    view.scale = Math.min(w / FIELD.width, h / FIELD.height);
    view.x = (w - FIELD.width * view.scale) / 2;
    view.y = (h - FIELD.height * view.scale) / 2;
    view.w = w; view.h = h;
  }
  window.addEventListener('resize', resize);
  resize();

  function darkness(clock) {
    if (clock >= 19 || clock < 6) return 0.42;
    if (clock >= 18) return 0.22;
    if (clock >= 17) return 0.08;
    return 0;
  }
  function clockLabel(clock) {
    const h = Math.floor(clock), m = Math.floor((clock - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function drawCar(x, y, angle, color, opts) {
    opts = opts || {};
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-19, -11, 40, 26);
    ctx.fillStyle = color;
    roundRect(-20, -11, 40, 22, 5); ctx.fill();
    ctx.fillStyle = '#101828';
    roundRect(-8, -9, 12, 18, 2); ctx.fill(); // cabin
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(8, -9, 3, 18);
    if (opts.police) {
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(-14, -11, 10, 22);
      const blink = Math.floor(performance.now() / 180) % 2 === 0;
      ctx.fillStyle = blink ? '#ef4444' : '#3b82f6';
      ctx.beginPath(); ctx.arc(-2, -8, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blink ? '#3b82f6' : '#ef4444';
      ctx.beginPath(); ctx.arc(-2, 8, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    if (opts.headlights) {
      ctx.fillStyle = 'rgba(255,244,180,0.85)';
      ctx.beginPath(); ctx.arc(21, -7, 3, 0, Math.PI * 2); ctx.arc(21, 7, 3, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(24, 0, 4, 60, 0, 70);
      g.addColorStop(0, 'rgba(255,240,170,0.20)'); g.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(95, -26); ctx.lineTo(95, 26); ctx.lineTo(20, 8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.closePath();
  }

  function drawWorld(state, camX, camY) {
    const s = state;
    // Ground.
    ctx.fillStyle = PALETTE.ground; ctx.fillRect(camX - 700, camY - 400, FIELD.width + 1400, FIELD.height + 1400);
    // Parks.
    for (const pk of s.parks) {
      if (pk.x > camX + 700 || pk.x + pk.w < camX - 700 || pk.y > camY + 400 || pk.y + pk.h < camY - 400) continue;
      ctx.fillStyle = PALETTE.park; ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      ctx.fillStyle = '#2f7a4a';
      for (let i = 0; i < pk.trees; i++) {
        const tx = pk.x + 30 + ((i * 97) % Math.max(1, pk.w - 60)), ty = pk.y + 30 + ((i * 53) % Math.max(1, pk.h - 60));
        ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Water + sand (marina, south and east edges).
    for (const w of s.water) {
      ctx.fillStyle = PALETTE.water; ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 24; i++) { const wx = (i * 137) % w.w + w.x, wy = w.y + ((i * 61) % Math.max(1, w.h - 10)); ctx.fillRect(wx, wy, 40, 2); }
    }
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(0, 3030, CITY, 30); ctx.fillRect(3030, 0, 30, 3030);
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const r of ROADS) { ctx.fillRect(r - ROAD_W / 2, 0, ROAD_W, CITY); ctx.fillRect(0, r - ROAD_W / 2, CITY, ROAD_W); }
    // Sidewalk edges.
    ctx.strokeStyle = PALETTE.sidewalk; ctx.lineWidth = 4;
    for (const r of ROADS) {
      ctx.beginPath(); ctx.moveTo(r - ROAD_W / 2 - 2, 0); ctx.lineTo(r - ROAD_W / 2 - 2, CITY); ctx.moveTo(r + ROAD_W / 2 + 2, 0); ctx.lineTo(r + ROAD_W / 2 + 2, CITY);
      ctx.moveTo(0, r - ROAD_W / 2 - 2); ctx.lineTo(CITY, r - ROAD_W / 2 - 2); ctx.moveTo(0, r + ROAD_W / 2 + 2); ctx.lineTo(CITY, r + ROAD_W / 2 + 2); ctx.stroke();
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const r of ROADS) {
      for (let d = 60; d < CITY; d += 90) { ctx.fillRect(r - 2, d, 4, 34); ctx.fillRect(d, r - 2, 34, 4); }
    }
    // Skid marks.
    ctx.strokeStyle = 'rgba(10,10,14,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const sk of s.skids) {
      ctx.globalAlpha = Math.min(1, sk.life);
      ctx.beginPath(); ctx.moveTo(sk.x, sk.y); ctx.lineTo(sk.x - Math.cos(sk.angle) * 14, sk.y - Math.sin(sk.angle) * 14); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Buildings.
    for (const b of s.buildings) {
      if (b.x > camX + 700 || b.x + b.w < camX - 700 || b.y > camY + 400 || b.y + b.h < camY - 400) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + Math.floor(b.x)) % 3 === 0) ctx.fillStyle = 'rgba(255,214,120,0.55)';
        else ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(b.x + 8 + i * 34, b.y + 10 + j * 34, 16, 12);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 3);
    }
    // Pickups.
    for (const pk of s.pickups) {
      if (pk.respawn > 0) continue;
      const bob = Math.sin(state.elapsed * 3 + pk.bob) * 3;
      ctx.save(); ctx.translate(pk.x, pk.y + bob);
      if (pk.type === 'cash') { ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#14532d'; ctx.font = font(14, true); ctx.textAlign = 'center'; ctx.fillText('$', 0, 5); }
      else if (pk.type === 'health') { ctx.fillStyle = '#ef4444'; ctx.fillRect(-4, -10, 8, 20); ctx.fillRect(-10, -4, 20, 8); }
      else { ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#083344'; ctx.font = font(11, true); ctx.textAlign = 'center'; ctx.fillText('AMMO', 0, 4); }
      ctx.restore();
    }
    // Mission marker.
    if (s.mission) {
      const t = s.mission.target;
      const pulse = 1 + Math.sin(state.elapsed * 5) * 0.15;
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Guiding line from the player to the marker (faint).
      ctx.strokeStyle = 'rgba(242,201,76,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([14, 12]);
      ctx.beginPath(); ctx.moveTo(s.player.x, s.player.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.setLineDash([]);
      // Beacon column.
      const bg = ctx.createLinearGradient(t.x, t.y - 260, t.x, t.y);
      bg.addColorStop(0, 'rgba(242,201,76,0)'); bg.addColorStop(1, 'rgba(242,201,76,0.35)');
      ctx.fillStyle = bg; ctx.fillRect(t.x - 14, t.y - 260, 28, 260);
    }
    // Thugs.
    for (const t of s.thugs) {
      if (t.hp <= 0) continue;
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle);
      ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.arc(8, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#111827'; ctx.fillRect(t.x - 16, t.y - 26, 32, 5);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(t.x - 16, t.y - 26, 32 * Math.max(0, t.hp / 60), 5);
    }
    // Pedestrians.
    for (const ped of s.peds) {
      if (ped.down > 0) {
        ctx.save(); ctx.translate(ped.x, ped.y); ctx.rotate(1.2);
        ctx.fillStyle = ped.color; ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      const bob = Math.sin(ped.walkPhase) * 2;
      ctx.save(); ctx.translate(ped.x, ped.y + bob * 0.3); ctx.rotate(ped.angle);
      ctx.fillStyle = ped.color; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5d0a9'; ctx.beginPath(); ctx.arc(4, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Cars (traffic, parked, police, player).
    const dark = darkness(state.clock) > 0.15;
    for (const c of s.cars) {
      const isPolice = c.kind === 'police';
      drawCar(c.x, c.y, c.angle, c.color, { police: isPolice, headlights: dark && (c.kind === 'traffic' || c.kind === 'player' || isPolice) });
      if (isPolice) {
        ctx.fillStyle = 'rgba(59,130,246,0.25)';
        ctx.beginPath(); ctx.arc(c.x, c.y, 34 + Math.sin(state.elapsed * 10) * 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Player on foot.
    const p = s.player;
    if (!p.inCar) {
      const blink = p.invuln > 0 && Math.floor(state.elapsed * 12) % 2 === 0;
      if (!blink) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff2e88'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f5d0a9'; ctx.beginPath(); ctx.arc(5, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#22d3ee'; ctx.fillRect(10, -3, 10, 6); // gun / fist direction
        ctx.restore();
      }
      // Aim line.
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 46, p.y + Math.sin(p.angle) * 46); ctx.stroke();
    }
    // Bullets.
    ctx.fillStyle = '#fde68a';
    for (const b of s.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
    // Particles.
    for (const pt of s.particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color; ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    // Floating texts.
    for (const f of s.floats) {
      ctx.globalAlpha = Math.min(1, f.life);
      text(f.text, f.x, f.y, 16, f.color, 'center', true);
    }
    ctx.globalAlpha = 1;
    // Sunset / night tint over the whole scene.
    const d = darkness(state.clock);
    if (d > 0) { ctx.fillStyle = `rgba(8,10,38,${d})`; ctx.fillRect(camX - 700, camY - 400, FIELD.width + 1400, FIELD.height + 1400); }
    if (state.clock >= 17 && state.clock < 19) {
      ctx.fillStyle = 'rgba(255,120,60,0.06)'; ctx.fillRect(camX - 700, camY - 400, FIELD.width + 1400, FIELD.height + 1400);
    }
  }

  function drawMinimap(state) {
    const x0 = FIELD.width - MM - 16, y0 = 16;
    const k = MM / CITY;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,24,0.85)'; roundRect(x0 - 6, y0 - 6, MM + 12, MM + 12, 8); ctx.fill();
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.rect(x0, y0, MM, MM); ctx.clip();
    ctx.fillStyle = '#23202e'; ctx.fillRect(x0, y0, MM, MM);
    ctx.fillStyle = '#0e3a5c'; ctx.fillRect(x0, y0 + 3060 * k, MM, 140 * k); ctx.fillRect(x0 + 3060 * k, y0, 140 * k, MM);
    ctx.strokeStyle = '#17151f'; ctx.lineWidth = 3;
    for (const r of ROADS) {
      ctx.beginPath(); ctx.moveTo(x0 + r * k, y0); ctx.lineTo(x0 + r * k, y0 + MM); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0 + r * k); ctx.lineTo(x0 + MM, y0 + r * k); ctx.stroke();
    }
    if (state.mission) {
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath(); ctx.arc(x0 + state.mission.target.x * k, y0 + state.mission.target.y * k, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#e5e7eb';
    for (const c of state.cars) { if (c.kind === 'traffic' || c.kind === 'parked') { ctx.fillRect(x0 + c.x * k - 1.5, y0 + c.y * k - 1.5, 3, 3); } }
    ctx.fillStyle = '#3b82f6';
    for (const c of state.police) { ctx.beginPath(); ctx.arc(x0 + c.x * k, y0 + c.y * k, 3.5, 0, Math.PI * 2); ctx.fill(); }
    // Player arrow.
    const p = state.player;
    ctx.save(); ctx.translate(x0 + p.x * k, y0 + p.y * k); ctx.rotate(p.angle);
    ctx.fillStyle = '#ff2e88'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    text('NEON HARBOR', x0 + MM / 2, y0 + MM + 22, 11, PALETTE.muted, 'center', true);
  }

  function drawHUD(state, best) {
    const p = state.player;
    // Top-left: cash, health, ammo, wanted.
    ctx.fillStyle = 'rgba(10,12,24,0.78)'; roundRect(12, 12, 250, 108, 10); ctx.fill();
    text(`$${p.cash.toLocaleString('en-US')}`, 26, 44, 26, '#f2c94c', 'left', true);
    text('CASH', 26, 62, 11, PALETTE.muted, 'left', true);
    // Health bar.
    ctx.fillStyle = '#111827'; roundRect(26, 72, 150, 12, 6); ctx.fill();
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.danger; roundRect(26, 72, 150 * Math.max(0, p.health / 100), 12, 6); ctx.fill();
    text(`HP ${Math.ceil(p.health)}`, 184, 84, 12, PALETTE.text, 'left', true);
    text(`AMMO ${p.ammo}`, 26, 106, 13, '#22d3ee', 'left', true);
    text(clockLabel(state.clock), 200, 106, 13, PALETTE.muted, 'left', true);
    // Wanted stars.
    const stars = Math.round(p.wanted);
    for (let i = 0; i < 5; i++) {
      text('★', 280 + i * 30, 48, 30, i < stars ? '#fbbf24' : 'rgba(255,255,255,0.22)', 'left', true);
    }
    if (stars > 0) text('WANTED', 280, 68, 11, '#ef4444', 'left', true);
    // Speed when driving.
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
      text(`${kmh}`, FIELD.width - MM - 40, FIELD.height - 30, 44, PALETTE.text, 'right', true);
      text('km/h', FIELD.width - MM - 34, FIELD.height - 30, 14, PALETTE.muted, 'left', true);
    }
    // Mission objective.
    if (state.mission) {
      const m = state.mission;
      ctx.fillStyle = 'rgba(10,12,24,0.78)'; roundRect(12, 132, 330, 64, 10); ctx.fill();
      ctx.fillStyle = '#f2c94c'; ctx.fillRect(12, 132, 5, 64);
      text(m.def.name.toUpperCase(), 30, 156, 13, '#f2c94c', 'left', true);
      text(m.stage === 'pickup' ? m.target.label : 'Drop off at ' + m.target.label, 30, 178, 14, PALETTE.text, 'left');
      if (m.timer > 0) text(`${Math.ceil(m.timer)}s`, 322, 156, 16, m.timer < 15 ? '#ef4444' : PALETTE.text, 'right', true);
    } else if (!state.storyDone) {
      ctx.fillStyle = 'rgba(10,12,24,0.6)'; roundRect(12, 132, 330, 40, 10); ctx.fill();
      text('Press M to start the next job', 30, 158, 14, PALETTE.muted, 'left');
    } else {
      ctx.fillStyle = 'rgba(10,12,24,0.78)'; roundRect(12, 132, 330, 40, 10); ctx.fill();
      text('★ STORY COMPLETE — Neon Harbor is yours', 30, 158, 14, '#3ddc84', 'left', true);
    }
    // Missions progress.
    text(`Jobs ${Math.min(state.missionIndex, 4)}/4   •   Cars stolen ${state.carsStolen}   •   Best $${best.toLocaleString('en-US')}`, 16, FIELD.height - 16, 13, PALETTE.muted, 'left');
    // Dialogue banner.
    if (state.dialogue && state.elapsed < state.dialogueUntil) {
      ctx.fillStyle = 'rgba(10,12,24,0.85)'; roundRect(240, FIELD.height - 118, 800, 56, 10); ctx.fill();
      ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 2; ctx.stroke();
      text(state.dialogue, 640, FIELD.height - 82, 16, PALETTE.text, 'center');
    }
    // Controls hint.
    text('WASD drive / walk • E enter car • F punch • Click shoot • Shift run • Space brake • P pause • M job', 640, FIELD.height - 40, 12, 'rgba(242,237,228,0.55)', 'center');
    drawMinimap(state);
  }

  function panel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(5,6,16,0.72)'; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const w = 640, h = 150 + lines.length * 30;
    const x = (FIELD.width - w) / 2, y = (FIELD.height - h) / 2;
    ctx.fillStyle = '#141828'; roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = accent || '#ff2e88'; ctx.lineWidth = 3; ctx.stroke();
    text(title, FIELD.width / 2, y + 58, 40, accent || '#ff2e88', 'center', true);
    lines.forEach((ln, i) => text(ln, FIELD.width / 2, y + 104 + i * 30, 17, PALETTE.text, 'center'));
    if (prompt) text(prompt, FIELD.width / 2, y + h - 26, 15, PALETTE.muted, 'center');
  }

  function drawTitle(state, best) {
    drawWorld(state, state.player.x - FIELD.width / 2, state.player.y - FIELD.height / 2);
    ctx.fillStyle = 'rgba(5,6,16,0.55)'; ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = '#ff2e88'; ctx.fillRect(0, 150, FIELD.width, 4);
    ctx.fillStyle = '#22d3ee'; ctx.fillRect(0, 158, FIELD.width, 2);
    text('NEON HARBOR', FIELD.width / 2, 138, 84, '#f2ede4', 'center', true);
    text('an open-world crime story  •  drive it, steal it, survive it', FIELD.width / 2, 196, 20, '#22d3ee', 'center');
    text('Kai Reyes is back in Port Solano with nothing but a borrowed jacket', FIELD.width / 2, 258, 16, PALETTE.muted, 'center');
    text('and a fixer named Mara Voss who always has one more job.', FIELD.width / 2, 282, 16, PALETTE.muted, 'center');
    text('4 story jobs  •  traffic & pedestrians  •  police & wanted stars  •  combat  •  minimap  •  save', FIELD.width / 2, 330, 15, PALETTE.text, 'center');
    text('WASD move / drive   •   E enter & steal cars   •   F punch   •   Mouse aim, click to shoot', FIELD.width / 2, 366, 15, PALETTE.text, 'center');
    text('Shift run   •   Space handbrake   •   M start a job   •   P pause', FIELD.width / 2, 392, 15, PALETTE.text, 'center');
    const pulse = 0.7 + Math.sin(state.elapsed * 4) * 0.3;
    ctx.globalAlpha = pulse;
    text('PRESS ENTER OR CLICK TO START', FIELD.width / 2, 470, 24, '#ff2e88', 'center', true);
    ctx.globalAlpha = 1;
    if (best > 0) text(`Best cash: $${best.toLocaleString('en-US')}`, FIELD.width / 2, 516, 16, '#f2c94c', 'center', true);
    text('Original game — no Rockstar names, logos, characters, maps or assets. Runs offline.', FIELD.width / 2, FIELD.height - 24, 12, PALETTE.muted, 'center');
  }

  function draw(state, screen, best, endKind) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop; ctx.fillRect(0, 0, view.w, view.h);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const p = state.player;
    if (screen === SCREEN_TITLE) { drawTitle(state, best); return; }
    const camX = Math.max(0, Math.min(CITY - FIELD.width, p.x - FIELD.width / 2));
    const camY = Math.max(0, Math.min(CITY - FIELD.height, p.y - FIELD.height / 2));
    ctx.save();
    ctx.translate(-camX, -camY);
    drawWorld(state, camX, camY);
    ctx.restore();
    drawHUD(state, best);
    if (screen === SCREEN_PAUSED) {
      panel('PAUSED', ['The city waits. Your wanted level does not grow while paused.', `Cash $${p.cash}  •  Jobs ${Math.min(state.missionIndex, 4)}/4`], 'Press P or Enter to keep playing', '#22d3ee');
    } else if (screen === SCREEN_OVER) {
      panel('WASTED', [`Kai went down in the streets of Port Solano.`, `Cash $${p.cash}  •  Jobs done ${Math.min(state.missionIndex, 4)}/4  •  Best $${best}`], 'Press Enter to try again', '#ef4444');
    } else if (screen === SCREEN_BUSTED) {
      panel('BUSTED', ['Harbor PD hauled Kai in. The fine stings, the record sticks.', `Cash $${p.cash}  •  Jobs done ${Math.min(state.missionIndex, 4)}/4  •  Best $${best}`], 'Press Enter to get back out there', '#3b82f6');
    }
  }
  return { draw, resize };
}
