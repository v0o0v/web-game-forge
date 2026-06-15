<div align="right">

[🇰🇷 한국어](README.md) · **🌐 English**

</div>

# 🎮 WebGameForge

> **"Make me a Super Mario game"** — that one sentence is all it takes.
> A **Claude Code plugin** that forges polished 2D web games that run smoothly even in mobile webviews.

![License](https://img.shields.io/badge/license-MIT-green)
![Phaser](https://img.shields.io/badge/engine-Phaser%204.1-blueviolet)
![Skills](https://img.shields.io/badge/skills-31-orange)
![Assets](https://img.shields.io/badge/assets-CC0%20%2F%20IP--safe-success)
![Mobile](https://img.shields.io/badge/mobile--webview-ready-success)

<p align="center">
  <img src="docs/img/title.png" width="49%" alt="Title screen">
  <img src="docs/img/gameplay.png" width="49%" alt="Gameplay">
</p>

---

## 👋 New here?

**WebGameForge is a plugin that turns "make me a game" into a real, playable 2D web game — just by telling Claude Code what you want.**

You don't need to know how to code. You don't need to learn a game engine. Just describe — in English (or Korean) — *what kind of game you want*, and WebGameForge will:

- 🎨 **Generate** graphics **in code** or bring in license-safe external assets (copyright-safe)
- 🔊 **Synthesize** sound effects and background music
- 📱 Attach **mobile touch controls**
- ✅ Actually run it and **fix the bugs** before handing you a finished product.

> 💡 Ask plain Claude Code to "make a web game" and you'll get crude vanilla-JS output.
> WebGameForge **auto-detects** your intent to build a game and delivers a tier-up result using
> a battle-tested engine stack and 31 specialized skills.

---

## 🚀 Get started in 3 minutes

### 1️⃣ Install (inside Claude Code)

Register the marketplace:

```
/plugin marketplace add v0o0v/web-game-forge
```

Install the plugin:

```
/plugin install web-game-builder@web-game-builder-marketplace
```

### 2️⃣ Make a game (just say it)

Once installed, talk to Claude Code in natural language as usual:

```
make a Super Mario-style platformer
```

Korean works too:

```
슈퍼마리오류 플랫포머 게임 만들어줘
```

No commands to memorize. WebGameForge detects "they want to build a game" and automatically
turns on the relevant specialist skills. The generated game lands in `games/<game-name>/`.

### 3️⃣ Play it in your browser

Start a local server at the project root:

```
python -m http.server 8766
```

Open it in your browser (use the actual game name):

```
http://127.0.0.1:8766/games/super-runner/index.html
```

🎉 That's it! Play right away with arrow keys + jump, and open it on a phone to get touch controls.

---

## 🕹 Want to see a demo first?

A ready-to-play demo, `super-runner`, ships with the plugin. It's a Super Mario-style platformer
with graphics and sound all procedurally generated — 100% copyright-safe (CC0) assets.

Start the local server as in step 3️⃣ above, then open:

```
http://127.0.0.1:8766/games/super-runner/index.html
```

| Input | Action |
|------|------|
| ← / → | Move left/right |
| ↑ / A / Space | Jump (hold longer to jump higher) |
| Touch screen | Mobile virtual D-pad + jump button |

Coins (+100), enemy stomps, question blocks, mushroom power-ups, lives/game-over — small,
but it instantly conveys the feel of a "real game."

---

## 🎯 What can you build?

Just ask in natural language and the matching genre scaffold kicks in automatically. Try saying:

| What you want | Just say |
|------|------|
| 🏃 **Platformer** (Mario-like) | `"make a side-scrolling jump game"` |
| 🔫 **Top-down / twin-stick shooter** | `"make a top-down shooter with waves of enemies"` |
| 🧱 **Classic arcade** | `"make a Breakout game"` (Snake, Pong, Invaders too) |
| 🧩 **Puzzle** | `"make a Tetris game"` (Match-3, 2048 too) |
| ♾️ **Endless runner** | `"make a Flappy Bird-style runner"` |

After the game exists, keep making detailed requests in natural language:

```
add sound effects
```

```
add one more level
```

```
optimize for 60fps on mobile
```

The right specialist skill picks up each request.

---

## ✨ Why WebGameForge?

<table>
<tr>
<td width="50%">

**🪄 No commands to memorize**
Natural language like "make a Super Mario game" auto-triggers the relevant skills.

**🎮 Battle-tested engine stack**
Built on Phaser 4 (v4.1.0, MIT). Physics, tilemaps, animation, cameras, HUD are all first-class APIs.

**📱 Mobile webview ready**
iOS WKWebView, KakaoTalk/Instagram in-app browsers covered. Screen-fit, audio unlock, and touch controls built in.

</td>
<td width="50%">

**🎨 Graphics generated in code**
Both pixel art (`PixelForge`) and smooth vectors (`VectorForge`) are generated in code; license-safe external assets are welcome too.

**🔊 Sound beyond 8-bit**
From chiptune to synthwave, ambient, and adaptive music — all code-synthesized. Zero audio files.

**⚖️ Copyright-safe (IP-safe)**
Assets are license-safe external works (CC0, attribution, permissive) or procedurally generated. No Nintendo or commercial-IP sprites, names, or signatures.

</td>
</tr>
</table>

> **✅ It doesn't just look right — it actually runs.** A headless step harness deterministically
> verifies movement, collisions, and mechanics. The `super-runner` demo passed 600 consecutive
> frames of play with zero console errors.

---

## 🖥 Prefer a GUI? — WGF Studio editor

Beyond code, a **browser-based game editor** is included. Edit scenes and game objects directly
through a Unity-style GUI, collaborate with Claude inside the editor, hit Play to check, then
export to a static game with no build step.

```
open the WGF Studio editor
```

---

## 📚 Dig deeper

> The sections below are reference material for those who want to go further.
> If you're just starting out, "Get started in 3 minutes" above is enough — expand these later.

<details>
<summary><b>🧩 Skill catalog (31 skills)</b> — which specialists collaborate?</summary>

<br>

> Every skill's invocation name carries the `wgf-` prefix (matching its directory). The plugin
> namespace itself is `web-game-builder`, and the slash command is `/web-game-builder:wgf-make-game`.

The main `wgf-web-game-builder` orchestrates the whole flow, and specialist skills auto-trigger
based on the request. They collaborate in the order **scaffold by genre → flesh out with
features → verify & optimize for quality**.

| Category | Skill | Role |
|------|------|------|
| Main | `wgf-web-game-builder` | Detects game-build requests, orchestration |
| 🖥 Editor | `wgf-editor` | **WGF Studio** browser game editor — Unity-style scene editing, Claude collaboration, no-build export |
| 🎮 Genre | `wgf-platformer-game` | Side-scrolling platformer (Mario-like) |
| | `wgf-topdown-shooter` | Top-down / twin-stick shooter |
| | `wgf-arcade-classic` | Breakout, Snake, Pong, Invaders |
| | `wgf-puzzle-game` | Tetris, Match-3, 2048 + puzzle board games |
| | `wgf-endless-runner` | Endless runner / Flappy-like |
| 🎨 Visual | `wgf-style-architect` | Defines & **enforces whole-game art direction** (palette, shading, mood) — single visual language |
| | `wgf-sprite-picker` | Pick real CC0 sprites/sheets/anims **visually from a browser gallery** and apply them |
| | `wgf-sprite-forge` | PixelForge pixel-art sprites & animation (procedural) |
| | `wgf-vector-graphics` | VectorForge smooth/vector graphics + external HD CC0 loading |
| 🔊 Sound | `wgf-sound-architect` | Mood, BGM, SFX, **adaptive music** sound design (beyond 8-bit, Tone.js v15) |
| | `wgf-chip-sound` | ChipAudio 8-bit (chiptune) lightweight SFX/BGM |
| 📐 Design | `wgf-world-map-architect` | **Progression map topology** linking stages + map-screen build |
| | `wgf-level-architect` | Difficulty curves & fun-maximizing level **design** |
| | `wgf-level-designer` | Level/map (tilemap) **build** (implementation) |
| | `wgf-story-architect` | Tone, story, characters, dialogue, twists **narrative design** (`STORY.md` bible) |
| | `wgf-ability-architect` | Actives, passives, mobility, ultimates, combos, skill trees **character ability system design** |
| | `wgf-item-architect` | Consumables, equipment, currency, synergy **item design** (`ITEMS.md` + `items.json`) |
| 🛠 Polish | `wgf-game-ui-hud` | HUD, menus, UI screens |
| | `wgf-juice-fx` | Particles, screen shake, game feel |
| 🧩 Phaser advanced | `wgf-matter-physics` | Matter rigid-body physics (slingshot, stacking, ragdoll) |
| | `wgf-screen-fx` | Post-FX screen looks (bloom, vignette, CRT, neon) |
| | `wgf-lighting-mood` | Dynamic lighting & mood (point lights, fog, night sky) |
| | `wgf-path-motion` | Paths & motion (spline patrols, radial bullets) |
| | `wgf-virtual-joystick` | Virtual joystick (analog / twin-stick) touch controls |
| ✅ Quality & ops | `wgf-mobile-webview-tune` | Mobile webview optimization & audit |
| | `wgf-game-qa` | Headless step-harness behavior verification |
| | `wgf-ip-license-guard` | Copyright/license safety check |
| | `wgf-perf-60fps` | 60fps performance optimization |
| | `wgf-sprite-catalog-refresh` | Re-survey & refresh wgf-sprite-picker's CC0 source catalog |

Each specialist skill has a tight description so it only triggers on relevant requests, keeping
the skill-listing budget (~1% of context) under control.

</details>

<details>
<summary><b>⚙️ Engine library (<code>engine/</code>)</b> — the reusable modules under the hood</summary>

<br>

Games add only the modules they need to `index.html` as scripts. Zero cost for games that don't use them.

| Module | Role |
|------|------|
| **PixelForge** (`pixelforge.js`) | Procedural pixel-art generator that bakes char-grid sprites into Phaser textures |
| **VectorForge** (`vectorforge.js`) | Code-generates smooth graphics — gradients, glow, soft shadows, curved characters |
| **SoundForge** (`soundforge.js` + `tone.js`) | Beyond-8-bit sound engine — ADSR, filters, FM, adaptive layered BGM (Tone.js v15) |
| **ChipAudio** (`audio.js`) | Synthesizes 8-bit chiptune SFX/BGM with just the Web Audio API (lightweight lane) |
| **MobileHarness** (`mobile.js`) | Screen-fit, iOS zoom/scroll guards, multitouch D-pad + jump button |
| **JoystickKit** (`joystickkit.js`) | Virtual joystick (analog / twin-stick) — 360° direction+magnitude, move/aim split |
| **RngForge** (`rngforge.js`) | Seeded deterministic RNG — same seed → same sequence (reproducible & verifiable) |
| **TiledForge** (`tiled.js`) | Tiled map format (.tmj) with no external PNGs + animated/iso-hex/GPU layers |
| **AbilityKit** (`abilitykit.js`) | Character ability runtime — data-driven cooldowns, resources, combos, skill-tree unlocks |
| **MatterKit / ScreenFX / LightingKit / PathKit** | Phaser 4 advanced features (rigid physics, post-FX, lighting, paths) as one-line APIs |
| **StyleKit** (`stylekit.js`) | Wires the whole-game visual language defined by `wgf-style-architect` into the engine |
| **SceneKit** (`scenekit*.js`) | WGF Studio editor's declarative scene (scene.json) logic core + Phaser adapter |

e.g. bake a pixel-art star sprite in one call:

```js
PixelForge.bake(this, 'star', {
  palette: { 'y': '#ffe23f', 'w': '#fff7c0' },
  frames: [ ["..y..", ".ywy.", "ywwwy", ".ywy.", "..y.."] ]
});
```

> Full API: [skills/wgf-web-game-builder/reference/engine-api.md](skills/wgf-web-game-builder/reference/engine-api.md)

</details>

<details>
<summary><b>🎨 Art styles — pixel vs vector</b></summary>

<br>

Each game picks one render style — both are code-generated (CC0/IP-safe), and license-safe external assets can be used alongside.

- **Pixel art** (`PixelForge`, `pixelArt:true`) — NES-style retro. Demo: `games/super-runner/`.
- **Smooth / vector** (`VectorForge`, `pixelArt:false`) — gradients, glow, soft shadows,
  glassmorphism, curved characters. Showcase: `games/style-preview/`.

![VectorForge smooth graphics showcase](docs/img/vectorforge.png)

**🖼 Pick sprites yourself** — on-screen visuals matter a lot for fun, so the `wgf-sprite-picker`
skill lets you **pick license-safe (CC0) sprites by clicking in a browser gallery** and assign
them to slots (player, enemy, coin…). Sources: ① curated CC0 catalog ② local files ③ previously
used ④ procedural generation. Once-used sprites are kept in `assets-library/`. The whole-game look
(palette, shading, mood) is defined and enforced once by `wgf-style-architect`.

</details>

<details>
<summary><b>🔌 How does auto-triggering work?</b></summary>

<br>

On a game-build request, one (or more) of three layers fires:

1. **Layer 1 — SKILL.md description (semantic)** — Korean/English high-density keywords let Claude
   understand the request's intent and pick the skill automatically.
2. **Layer 2 — UserPromptSubmit hook (deterministic)** — `scripts/detect-game-intent.js` detects
   intent via regex and injects `additionalContext` as a `<system-reminder>` (a nudge). Your
   prompt is preserved.
3. **Layer 3 — Slash command (explicit)** — `/web-game-builder:wgf-make-game <description>`.

</details>

<details>
<summary><b>🧬 Game DNA & Phaser 4 reference library</b></summary>

<br>

**📚 Phaser 4 API reference** — `skills/wgf-web-game-builder/reference/phaser/` vendors 28 official
Phaser v4 agent skill docs + INDEX. Our skills reference these during generation to eliminate
v3/v4 mix-up errors at the source (source: official Phaser skills, MIT).

**🧬 Game DNA reference** — `skills/wgf-web-game-builder/reference/game-dna/` holds fun-factor
analyses of popular 2D games. Platformers, runners, arcade, puzzle, shooters, and physics games
are decomposed into a **core loop · fun elements (`FE-*` tags) · mechanics · difficulty curve ·
our-engine reproducibility** template. With a 35-title puzzle deep-dive (`game-dna/puzzle/`) and a
100-title board-game atlas (`game-dna/board/`), a total of **164 titles** become combination
material for the "what game should we make?" clarification step. **Only mechanics and fun are
analyzed** — names, characters, sprites, music and other copyrighted works are never used.

</details>

<details>
<summary><b>📁 Project structure</b></summary>

<br>

```
web-game-forge/
├── .claude-plugin/  plugin.json · marketplace.json   # Plugin manifests
├── skills/                                            # 31 skills (main + specialists, all wgf- prefixed)
│   ├── wgf-web-game-builder/   (+ reference/engine-api · phaser/ 28 · game-dna/ 164-title analysis)
│   ├── wgf-editor/             (WGF Studio browser editor)
│   ├── wgf-platformer-game/  wgf-topdown-shooter/  wgf-arcade-classic/  wgf-puzzle-game/  wgf-endless-runner/
│   ├── wgf-style-architect/  wgf-sprite-picker/  wgf-sprite-forge/  wgf-vector-graphics/
│   ├── wgf-sound-architect/  wgf-chip-sound/
│   ├── wgf-world-map-architect/  wgf-level-architect/  wgf-level-designer/
│   ├── wgf-story-architect/  wgf-ability-architect/  wgf-item-architect/
│   ├── wgf-game-ui-hud/  wgf-juice-fx/
│   ├── wgf-matter-physics/  wgf-screen-fx/  wgf-lighting-mood/  wgf-path-motion/  wgf-virtual-joystick/
│   └── wgf-mobile-webview-tune/  wgf-game-qa/  wgf-ip-license-guard/  wgf-perf-60fps/  wgf-sprite-catalog-refresh/
├── engine/                                            # Reusable engine (PixelForge·VectorForge·SoundForge·SceneKit…)
├── editor/                                            # WGF Studio editor runtime · UI
├── hooks/hooks.json                                   # UserPromptSubmit intent detection registration
├── scripts/detect-game-intent.{js,ps1,sh}            # KR/EN game intent detection (cross-platform)
├── commands/wgf-make-game.md                          # /web-game-builder:wgf-make-game
├── games/                                             # super-runner · nocturne · tiled-* · style-preview demos
├── assets-library/ · assets.json                      # Previously-used sprites · CC0 license gate
├── docs/  설계.md · img/                              # Architecture spec · screenshots
└── README.md · README.en.md · LICENSE
```

</details>

<details>
<summary><b>🔍 Verification results</b></summary>

<br>

Verified by actually running with chrome-devtools MCP (super-runner):
- Title/game/HUD render fine; movement, variable jump, coyote, buffer, camera, animation all fine
- Coin (+100), enemy stomp (+100), question-block coin pop (+200) mechanics pass deterministic checks
- 600 consecutive frames of play with **zero console errors** (2 real bugs found & fixed during verification)

Verified by actually running with chrome-devtools MCP (nocturne — 4-in-1 Phaser advanced demo, **WebGL**):
- One Matter slingshot shot topples 7 boxes (deterministic step check); 4/4 spline-lantern hits
- Point lights + Simplex fog + bloom/vignette render correctly in WebGL

</details>

---

## ⚖️ License & IP-safety policy

- **Code**: MIT (`LICENSE`)
- **Phaser 4.1.0** · **Tone.js v15**: MIT (vendored)
- **Assets**: license-safe external works (CC0, attribution, permissive) or procedurally generated (no commercial IP)
- **No-Nintendo principle**: never uses Mario sprites/sound, the name 'Mario', or the signature
  combo (red cap + mustache + blue overalls + plumber + Italian).
- **Genres & mechanics are free**: side-scrolling, jumping, stomping, coins, etc. are not copyrightable.

> The plugin's internal identifier is `web-game-builder` (used for slash commands & skill namespace).
> Individual skill invocation names carry the `wgf-` prefix (e.g. `wgf-platformer-game`).
> **WebGameForge** is the project/repository brand name.

---

## 🙋 Contributing / Contact

- Author: v0o0v (v0o0v2@gmail.com) · License: MIT
- Detailed architecture: [docs/설계.md](docs/설계.md)

🤖 Built & verified with [Claude Code](https://claude.com/claude-code).
