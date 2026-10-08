# Engine Tyre Bouncer

A portrait-orientation mobile construction game. Start the engine, drive the big wheel, and time every
**RELEASE** in the green zone so the ladder worker can build the wall. Plain HTML5 canvas + ES modules
(no dependencies, no build step) and an installable PWA.

## Run

```
npm start      # serves http://localhost:8080 (open on a phone on the same network, or "Add to Home Screen")
npm test       # node:test unit tests for the game logic
```

To ship as a native app, wrap the folder with Capacitor (`npx cap init`, set `webDir` to `.`, `npx cap add android|ios`).

## How to play

1. Turn **FUEL** on, set the throttle to 15–60 %, **hold START** and let go while the meter is green.
2. Press **RELEASE** when the marker is in the green (centre = PERFECT). Yellow = weak, red = failed
   (engine damage, possible stall, the ladder worker tumbles).
3. Higher throttle = more power but a faster meter, more fuel use and more heat.
4. Complete the wall, earn coins and stars, and spend coins in the **Upgrades** garage.

## Layout

| File | Responsibility |
| --- | --- |
| `src/meter.js` | Red/yellow/green timing meter and grading |
| `src/engine.js` | RPM, fuel, temperature, health, stall, filter/belt wear |
| `src/levels.js` | Level/difficulty generator (20 levels) |
| `src/upgrades.js` | 12 upgrades and their gameplay stats |
| `src/workers.js` | Operator and ladder-worker state machines |
| `src/session.js` | One job: ties engine, meter, workers, scoring together |
| `src/scoring.js` | Score, coins, 1–3 star rating |
| `src/save.js` | localStorage persistence |
| `src/render.js`, `src/particles.js` | Canvas scene and pooled particles |
| `src/audio.js` | WebAudio RPM-reactive engine sound and effects |
| `src/main.js` | Screens, HUD and input wiring |
