# gta6-01-entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Auuuaa/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Auuuaa/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Harbor** — an original open-world crime game in the spirit of GTA 6, playable offline in a desktop browser from static files. Kai Reyes is back in Port Solano with nothing but a borrowed jacket and a fixer named Mara Voss who always has one more job. Drive a sunset-neon grid city on foot and by car, steal cars, dodge Harbor PD, run four story jobs, and survive the night.

Everything is original: the city, characters, vehicles, story, art, sound and names — no Rockstar names, logos, characters, maps or assets.

## What is in the game

- **A living city**: a 3200×3200 grid city with roads, sidewalks, buildings, parks, a marina and a beach, drawn in plain Canvas 2D with a golden-hour sunset that slides into night, headlights and neon.
- **On foot and by car**: walk, run, enter/exit cars, drive with acceleration, steering and handbrake, skid marks and crash particles.
- **Traffic and pedestrians**: AI cars drive the road network and turn at intersections; pedestrians walk the sidewalks and flee from speeding cars and gunfire.
- **Stealing cars**: press E near any parked or traffic car to jack it — the law notices.
- **Wanted system and police**: wanted stars rise on theft, assault and attacks on police; police cars chase, ram and try to bust you. Hide to lose the heat, or get WASTED / BUSTED.
- **Missions and a story**: four jobs from Mara Voss — a taxi fare, a timed harbor delivery, a getaway under a 2-star wanted level, and a night-watch fight with street enforcers — with dialogue, markers, timers and cash rewards.
- **Combat**: punch (F) or aim and shoot with the mouse; health, ammo and cash/health/ammo pickups scattered around the city.
- **HUD with a live minimap**: cash, health, ammo, wanted stars, clock, mission objective, speed, and a minimap showing you, traffic, police and the mission marker.
- **Start screen and save**: title screen, pause, WASTED/BUSTED screens, and a localStorage save (cash, job progress, position) plus best cash.
- **Sound**: fully synthesized WebAudio — engine hum, sirens, gunshots, crashes, pickup chimes and a bass loop. No audio assets, no network requests.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step, no dependencies.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Walk or drive |
| E | Enter / exit a car (steal it) |
| F | Punch |
| Mouse + click | Aim and shoot |
| Shift | Run |
| Space | Handbrake |
| M | Start the next story job |
| P / Esc | Pause |

Deterministic screenshot scenes: `?shot=start|play|chase|mission&seed=1` plays the real rules forward from a fresh world with a seeded autopilot.

---

<sub>Entered on [make.fun](https://make.fun/?ref=j8zsssgk&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
