# Handoff: "Skyline" rework (branch `skyline-swing`)

Status notes for whoever (human or model) continues this. Update this file when you finish a chunk of work. `CLAUDE.md` explains the architecture; this file is only about where things stand.

## The request

The owner asked to replace the plane-and-islands site with a "hyper-realistic Spider-Man theme": click a section, the hero swings through the city to it, like the Insomniac game. Agreed scope after discussion:

- An **original** hero (Spider-Man himself is off limits; see CLAUDE.md), moving like a web-swinger.
- A city that reads as **New York**.
- Autopilot via section buttons is the main way around; optional drift / boost / free roam; a physics test suite.

Owner feedback on the first version (Nov 2026): "it looks nothing like Spider-Man" and "even New York doesn't look great". So the two quality bars that matter most are (1) the hero's look and movement and (2) the city's realism.

## Where `main` is

Skyline was merged to `main` and deployed to abhishekdp.com on 2026-11-11, at the owner's request ("push it, I want to view it on the live website"). Branch `skyline-swing` holds the same commits. Further pushes to `main` still need the owner's say-so.

## Done on this branch

- `src/sim/*`: city layout, route planner, swing physics, launch/landing curves, mid-trip re-routing, free roam. **12 tests pass** (`npm test`).
- `src/world/city.js`: New York pass. Brick / limestone / glass / modern facades drawn in one shader, setback towers, spires, water towers, roof plant, tree-lined sidewalks, a park, yellow cabs, street lamps, sun-down-the-cross-streets ground lighting, haze.
- `src/world/hero.js`: second-pass hero. Slim figure in a dark suit with amber gloves, boots, belt and yoke, one white visor band, thin white grapple line. Perches in a crouch on the ledge of each tower. Full trip state machine and per-phase cameras (behind the shoulder on roofs, chase cam in the streets, stand-off view for the pull-up).
- `src/main.js`: nav buttons -> autopilot, click-a-tower, Skip, Free roam, drift/boost input (mouse, keys, touch), panels (view slides left so the hero stays visible), HUD, audio events.
- Checked with headless screenshots at 1440x860 and 390x844: perch, launch, swing, release, pull-up, landing + panel, phone menu and bottom sheet. No console errors, no horizontal overflow on phone.
- Headless screenshot tooling in `scripts/dev/` (`steps-example.mjs`, `steps-trip.mjs`, `steps-phone.mjs`).
- Blog pages rebranded (no more paper plane); `README.md` rewritten for Skyline.

## Waiting on the owner

The owner approved the direction from screenshots ("yes, keep polishing") and asked for it to go live so they can try it on real hardware. Expect feedback on feel, speed and looks once they have used it. Their two standing complaints were the hero's look and the city's realism, so weigh feedback against those first.

## Second polish pass (done)

- Night and midday presets checked and fixed: bounce light so shaded walls are not black, warmer night windows, brighter glass reflections.
- Second mid-air trick (corkscrew) alongside the somersault.
- Automatic quality fallback in `main.js` (`watchFrameRate`): below ~40 fps it lowers pixel ratio to 0.75, then turns bloom off. `?noadapt` disables it (the dev steps files use that so screenshots stay full quality).
- Free roam, turning by drifting, picking a section mid-roam, and Skip verified end to end with `scripts/dev/steps-roam.mjs`.

## Known issues / next steps

1. **Real-hardware feel is unverified.** Everything so far was checked in a software renderer at a few fps. Speed (56 m/s cruise), camera distance, FOV kick and swing rhythm may need tuning once the owner has tried it: see `TUNING` in `src/sim/traverse.js` and `view()` in `src/world/hero.js`. Re-run `npm test` after changing `TUNING`.
2. **Hero polish.** Still built from primitives, so it reads as a stylised figure, not a realistic character. Possible upgrades: better hands and feet, a neck/shoulder blend, secondary motion (head look-at, spine twist), more swing pose variety. If the owner supplies a rigged GLB character they have rights to, `hero.js` could drive it instead (the state machine and `POSES` concept would stay; `buildRig()` and `applyPose()` would change).
3. **Glass towers** still show some flat lit panels up close; tune `lamp`, `blinds` and `litFrac` for `style == 2` in the building shader.
4. **Trees** are plain spheres; a two-blob crown or a noise-displaced crown would read better at street level.
5. localStorage keys are still `flightlog.*` (kept on purpose so earlier progress survives).

## Small follow-up: run tests in CI

`npm test` is not yet a step in `.github/workflows/deploy.yml`. Adding it is one line (`- run: npm test` before `- run: npm run build`), but it must be pushed over SSH or with a token that has the `workflow` scope: the GitHub CLI's HTTPS login is refused when a push edits a workflow file. On 2026-11-11 the owner's SSH agent (1Password) was not answering, so the site was pushed over HTTPS without that edit. Until then, run `npm test` locally before every push.

## Ideas not started

- Rooftop idle variety (look around, stretch), wall-run or point-launch moves.
- Pedestrians, traffic lights, steam vents, billboards, bridges/river at the city edge.
- A real shadow pass (would need the building shader to sample a shadow map).

## How to verify before asking the owner to look

```bash
npm test && npm run build && (npm run preview &) && sleep 2
node scripts/dev/shot.mjs scripts/dev/steps-example.mjs
```
Then read the JPEGs in `scripts/dev/shots/`. Show the owner screenshots (aerial, street, mid-swing, landed) and get an explicit yes before merging to `main`.
