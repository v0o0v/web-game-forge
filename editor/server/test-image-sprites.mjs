#!/usr/bin/env node
/*
 * test-image-sprites — 비트맵 스프라이트시트 프레임 렌더 기능의 헤드리스 수용 게이트.
 *
 * 렌더러 자체(scenekit-phaser bakeAsset 의 이미지 로드·crop)는 DOM/Phaser 전용이라
 * 헤드리스로 못 돈다 — 그건 브라우저 스크린샷으로 검증한다(설계 §5). 이 하니스는 헤드리스로
 * 검증 가능한 계약만 본다:
 *   1) lint-scene 이 source:'local' 과 frameConfig/frame 를 받아들이고, 잘못된 frameConfig/
 *      frame 은 error 로 잡는지.
 *   2) export 가 local 이미지 파일을 산출 게임 폴더로 벤더링(복사)하고, frameConfig/frame 을
 *      보존하며, url 을 game-root 상대로 재작성하는지(--out 다른 slug = cross-slug 복사 경로).
 *
 * 마지막 줄은 단일 JSON {"ok":bool,"pass":n,"fail":n}. 통과 시 exit 0.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));      // editor/server/
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');
const LINT = path.join(REPO_ROOT, 'skills', 'wgf-editor', 'tools', 'lint-scene.mjs');
const EXPORT = path.join(SERVER_DIR, 'export.mjs');
const DEMO_SCENE = path.join(REPO_ROOT, 'games', 'wgf-sprite-demo', 'scene.json');

const checks = [];
function check(name, ok, detail) { checks.push({ name, ok: !!ok, detail: detail || '' }); }

// lint-scene 을 임의 파일에 실행 → {exit, json}.
function runLint(file) {
  let out = '', exit = 0;
  try { out = execFileSync('node', [LINT, '--file', file], { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); exit = e.status == null ? 1 : e.status; }
  let json = null;
  const lines = out.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) { try { json = JSON.parse(lines[i]); break; } catch (_) {} }
  return { exit, json, out };
}

function tmpScene(obj) {
  const p = path.join(os.tmpdir(), 'wgf-imgspr-' + Math.abs(hash(JSON.stringify(obj))) + '.json');
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
}
function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }

const baseScene = (sprite) => ({
  format: 'wgf-scene@1', slug: 'imgspr-fixture',
  meta: { title: 'fixture', genre: 'topdown', viewport: { w: 320, h: 240 }, pixelArt: true, systems: {} },
  assets: { sprites: [sprite] },
  walls: [],
  scenes: [{ id: 'main', systems: {}, entities: [
    { id: 'e1', name: 'e1', transform: { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1, depth: 1 },
      components: [{ type: 'Sprite', sprite: sprite.id }] }
  ] }],
  dataLayers: {}
});

// ── 1. lint: local + frameConfig 수용 ────────────────────────────────────────
{
  const f = tmpScene(baseScene({
    id: 'spr_sheet', source: 'local', url: 'games/wgf-sprite-demo/assets/imported/tiny-dungeon.png',
    license: 'CC0-1.0', frameConfig: { frameWidth: 16, frameHeight: 16 }, frame: 5
  }));
  const r = runLint(f);
  check('lint: local+frameConfig exit 0', r.exit === 0, 'exit=' + r.exit);
  check('lint: local+frameConfig error 0', r.json && r.json.counts && r.json.counts.error === 0, 'error=' + (r.json && r.json.counts && r.json.counts.error));
  check('lint: local source UNKNOWN_ASSET_SOURCE warn 없음', r.json && r.json.counts && r.json.counts.warn === 0, 'warn=' + (r.json && r.json.counts && r.json.counts.warn));
  try { fs.unlinkSync(f); } catch (_) {}
}

// ── 2. lint: 잘못된 frameConfig(frameWidth<=0) → error ───────────────────────
{
  const f = tmpScene(baseScene({
    id: 'spr_bad', source: 'local', url: 'games/wgf-sprite-demo/assets/imported/tiny-dungeon.png',
    frameConfig: { frameWidth: 0, frameHeight: 16 }, frame: 0
  }));
  const r = runLint(f);
  const codes = (r.json && r.json.findings || []).map((x) => x.code);
  check('lint: frameWidth<=0 exit 1', r.exit === 1, 'exit=' + r.exit);
  check('lint: frameWidth<=0 INVALID_FRAME_CONFIG', codes.indexOf('INVALID_FRAME_CONFIG') !== -1, 'codes=' + codes.join(','));
  try { fs.unlinkSync(f); } catch (_) {}
}

// ── 3. lint: 음수 frame → INVALID_FRAME_INDEX ────────────────────────────────
{
  const f = tmpScene(baseScene({
    id: 'spr_negf', source: 'local', url: 'games/wgf-sprite-demo/assets/imported/tiny-dungeon.png',
    frameConfig: { frameWidth: 16, frameHeight: 16 }, frame: -3
  }));
  const r = runLint(f);
  const codes = (r.json && r.json.findings || []).map((x) => x.code);
  check('lint: 음수 frame INVALID_FRAME_INDEX', codes.indexOf('INVALID_FRAME_INDEX') !== -1, 'codes=' + codes.join(','));
  try { fs.unlinkSync(f); } catch (_) {}
}

// ── 4. export --out(cross-slug): 이미지 복사 + frameConfig 보존 + url 재작성 ──
{
  const outSlug = 'imgspr-export-test';
  const outDir = path.join(REPO_ROOT, 'games', outSlug);
  // 깨끗한 시작.
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) {}
  let exit = 0, out = '';
  if (!fs.existsSync(DEMO_SCENE)) {
    check('export: 데모 씬 존재(games/wgf-sprite-demo/scene.json)', false, 'missing');
  } else {
    try { out = execFileSync('node', [EXPORT, 'games/wgf-sprite-demo/scene.json', '--out', outSlug], { encoding: 'utf8', cwd: REPO_ROOT }); }
    catch (e) { out = (e.stdout || '') + (e.stderr || ''); exit = e.status == null ? 1 : e.status; }
    check('export: --out cross-slug exit 0', exit === 0, 'exit=' + exit);
    const imgCopied = fs.existsSync(path.join(outDir, 'assets', 'imported', 'tiny-dungeon.png'));
    check('export: local 이미지 파일이 산출 폴더로 복사됨', imgCopied, 'games/' + outSlug + '/assets/imported/tiny-dungeon.png=' + imgCopied);
    let gameJs = '';
    try { gameJs = fs.readFileSync(path.join(outDir, 'game.js'), 'utf8'); } catch (_) {}
    check('export: game.js 에 frameConfig 보존', /"frameConfig"\s*:/.test(gameJs), 'has=' + /"frameConfig"/.test(gameJs));
    check('export: game.js 에 frame 인덱스 보존', /"frame"\s*:/.test(gameJs), 'has=' + /"frame"/.test(gameJs));
    check('export: url 이 game-root 상대로 재작성("assets/imported/...")', /"assets\/imported\/tiny-dungeon\.png"/.test(gameJs), 'rewritten=' + /"assets\/imported\/tiny-dungeon\.png"/.test(gameJs));
    check('export: url 에서 games/<slug>/ 접두 제거됨', !/"games\/wgf-sprite-demo\/assets/.test(gameJs), 'noPrefix=' + !/"games\/wgf-sprite-demo\/assets/.test(gameJs));
  }
  // 정리(산출 임시 게임 폴더 삭제 — 커밋 오염 방지).
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (_) {}
}

// ── 5. AnimatedSprite: 코어가 데모 씬의 anim 프레임을 진행(렌더러가 읽는 셀 값) ──
// 렌더러(어댑터)는 DOM 전용이라 헤드리스 불가지만, 어댑터가 매 프레임 읽는 값 = 코어
// AnimatedSprite._frame → def.frames[_frame] 이므로 그 코어 진행을 헤드리스로 검증한다.
{
  const req = createRequire(import.meta.url);
  let SceneKit = null;
  try {
    SceneKit = req(path.join(REPO_ROOT, 'engine', 'scenekit.js'));
    req(path.join(REPO_ROOT, 'engine', 'scenekit-components.js'));
  } catch (e) { check('anim: SceneKit 코어 로드', false, String(e)); }
  if (SceneKit && fs.existsSync(DEMO_SCENE)) {
    const doc = JSON.parse(fs.readFileSync(DEMO_SCENE, 'utf8'));
    const world = SceneKit.load(doc, { mode: 'play', seed: 1 });
    const findAnim = () => {
      for (const e of world.entities) {
        const c = SceneKit.getComponentOn(e, 'AnimatedSprite');
        if (c) return { e, c };
      }
      return null;
    };
    const a0 = findAnim();
    check('anim: 데모에 AnimatedSprite 엔티티 존재', !!a0, a0 ? a0.e.id : 'none');
    if (a0) {
      const def = (a0.c.anims || []).find((x) => x.key === a0.c._anim);
      check('anim: t=0 _frame=0(계약 H′)', a0.c._frame === 0, '_frame=' + a0.c._frame);
      check('anim: anim def 유효(frames 보유)', !!(def && def.frames && def.frames.length), 'frames=' + JSON.stringify(def && def.frames));
      let sawNonZero = false;
      const cellsSeen = new Set();
      for (let i = 0; i < 45; i++) {           // ~1.5초(fps 3 → 여러 프레임 진행)
        SceneKit.step(world, 1 / 30);
        const a = findAnim();
        if (a) {
          if ((a.c._frame | 0) !== 0) sawNonZero = true;
          const d = (a.c.anims || []).find((x) => x.key === a.c._anim);
          if (d && d.frames) cellsSeen.add(d.frames[a.c._frame | 0]);
        }
      }
      check('anim: step 후 _frame 진행(0 벗어남)', sawNonZero, 'sawNonZero=' + sawNonZero);
      check('anim: 표시 셀이 모두 anim.frames 집합 내', def && def.frames && [...cellsSeen].every((c) => def.frames.indexOf(c) !== -1), 'cells=' + [...cellsSeen].join(','));
    }
  }
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
const pass = checks.filter((c) => c.ok).length;
const fail = checks.length - pass;
for (const c of checks) console.log((c.ok ? '  ✓' : '  ✗') + ' ' + c.name + (c.detail ? '  — ' + c.detail : ''));
console.log(JSON.stringify({ ok: fail === 0, pass, fail, checks }));
process.exit(fail === 0 ? 0 : 1);
