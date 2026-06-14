#!/usr/bin/env node
/* ============================================================================
 * WGF Studio P5 데모 게이트 하니스 — 탑다운 데모 "절차 아레나" 수용 게이트
 * ----------------------------------------------------------------------------
 * 설계서 P5("탑다운 데모 제작 + 헤드리스 QA 게이트")의 측정 게이트를 강제한다.
 * 데모 씬(games/wgf-demo-arena/scene.json) + 그 export 산출물을 대상으로 다음을
 * 검증한다(zero-dep — Node 빌트인만, test-scenekit.mjs/test-export.mjs 스타일):
 *
 *   1. lint-scene 통과     — 데모 scene.json exit 0 + 마지막 줄 JSON ok:true
 *   2. export 산출 존재     — game.js·index.html·CREDITS.txt 디스크 존재
 *   3. lint-rng 통과        — 데모 game.js error 0(결정성 — Math.random/Date.now 0)
 *   4. 데모 코어 결정성      — SceneKit.load(scene,{mode:'play'}) 120프레임 동일 dt 2회
 *                             독립 실행 → hashState 일치(test-scenekit G1-A 패턴)
 *   5. seed 의존 sanity     — 다른 seed → 해시 상이(G1-B 패턴; rng state 포함)
 *   6. qa-score 통과        — 데모 게임 exit 0(임계 통과). VU 는 --frames 없으면
 *                             skipped(중립) 정상. --require 는 산출물에 실재하는 토큰만.
 *
 * 출력 계약: 사람용 라인들 먼저, 마지막 줄 단일 JSON
 *   { "ok":bool, "pass":n, "fail":n, "checks":[{name,ok,detail}...] }
 * 종료코드: 전부 통과 → 0, 하나라도 실패 → 1. (test-scenekit.mjs 형식 모방)
 *
 * 코어(scenekit.js·scenekit-components.js) 비수정 — 이 하니스는 require 만 한다.
 * 데모는 데이터(scene.json)만이며 이 게이트가 데이터의 유효성·결정성을 단언한다.
 * ==========================================================================*/

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));      // editor/server/
const root = resolve(here, '..', '..');                   // 리포 루트
const req = createRequire(import.meta.url);

// ── 데모 좌표 ─────────────────────────────────────────────────────────────────
const DEMO_SLUG = 'wgf-demo-arena';
const SCENE_REL = `games/${DEMO_SLUG}/scene.json`;
const SCENE_PATH = resolve(root, SCENE_REL);
const DEMO_DIR = resolve(root, 'games', DEMO_SLUG);
const GAME_JS_REL = `games/${DEMO_SLUG}/game.js`;

// ── 킷 로드(헤드리스 — Phaser 비의존) ─────────────────────────────────────────
const SceneKit = req(resolve(root, 'engine/scenekit.js'));
req(resolve(root, 'engine/scenekit-components.js'));   // 컴포넌트 등록(코어 로드 직후 필수)

// ── 체크 하니스(test-scenekit.mjs 형식 그대로) ────────────────────────────────
const checks = [];
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  const passed = !!cond;
  checks.push({ name, ok: passed, detail: detail || '' });
  if (passed) { pass++; console.log(`✓ ${name}`); }
  else        { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// 자식 프로세스 실행 후 마지막 줄 JSON 회수.
function runTool(args) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  const lines = (r.stdout || '').trim().split('\n');
  let json = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try { json = JSON.parse(lines[i]); break; } catch (_) { /* 계속 */ }
  }
  return { status: r.status, json, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. lint-scene — 데모 scene.json exit 0 + 마지막 줄 JSON ok:true
// ─────────────────────────────────────────────────────────────────────────────
{
  const lintScene = resolve(root, 'skills/wgf-editor/tools/lint-scene.mjs');
  const r = runTool([lintScene, '--file', SCENE_REL]);
  ok('1. lint-scene 데모 씬 exit 0',
    r.status === 0,
    `exit=${r.status}`);
  ok('1. lint-scene 데모 씬 ok:true · error 0',
    r.json && r.json.ok === true && r.json.counts && r.json.counts.error === 0,
    r.json ? `error=${r.json.counts.error} warn=${r.json.counts.warn}` : 'JSON 회수 실패');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. export 산출 존재 — game.js·index.html·CREDITS.txt 디스크 존재
// ─────────────────────────────────────────────────────────────────────────────
const gameJsPath = resolve(DEMO_DIR, 'game.js');
const indexHtmlPath = resolve(DEMO_DIR, 'index.html');
const creditsPath = resolve(DEMO_DIR, 'CREDITS.txt');
{
  ok('2. export 산출 game.js 존재', existsSync(gameJsPath), gameJsPath);
  ok('2. export 산출 index.html 존재', existsSync(indexHtmlPath), indexHtmlPath);
  ok('2. export 산출 CREDITS.txt 존재', existsSync(creditsPath), creditsPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. lint-rng — 데모 game.js error 0(결정성)
// ─────────────────────────────────────────────────────────────────────────────
{
  const lintRng = resolve(root, 'skills/wgf-game-qa/tools/lint-rng.mjs');
  const r = runTool([lintRng, GAME_JS_REL]);
  const errorCount = (r.json && r.json.counts) ? r.json.counts.error : -1;
  ok('3. lint-rng 데모 game.js error 0',
    errorCount === 0,
    r.json ? `error=${errorCount} warn=${r.json.counts.warn}` : `exit=${r.status} JSON 회수 실패`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 데모 코어 결정성 — 120프레임 동일 dt 2회 독립 실행 → hashState 일치(G1-A)
// ─────────────────────────────────────────────────────────────────────────────
const SCENE_DOC = JSON.parse(readFileSync(SCENE_PATH, 'utf8'));
function run120(world) {
  for (let i = 0; i < 120; i++) SceneKit.step(world, 1 / 60);
}
// 120프레임 동안 도달한 최대 엔티티 수를 추적(생성형 컴포넌트 동작의 결정적 증거).
//   발사체(Shooter)는 lifetime 후 소멸하므로 특정 단일 시점의 카운트는 변동적이다 —
//   "최대치"가 초기치를 넘었는지로 생성이 실제 일어났음을 안정적으로 단언한다.
function run120MaxCount(world) {
  let maxN = world.entities.length;
  for (let i = 0; i < 120; i++) {
    SceneKit.step(world, 1 / 60);
    if (world.entities.length > maxN) maxN = world.entities.length;
  }
  return maxN;
}
{
  const SEED = 73501;   // 데모 meta.seed 와 동일(결정성 고정점)

  // 4-0: load 단언 — scenes[] 래퍼를 못 읽어 0개로 trivially 통과하는 걸 막는다.
  const wProbe = SceneKit.load(SCENE_DOC, { mode: 'play', seed: SEED });
  ok('4-0. 데모 load 엔티티 개수 = 10(player·drone×2·turret·coin×3·medkit·pad·beacon)',
    wProbe.entities.length === 10,
    `actual=${wProbe.entities.length}`);

  // 4-A: 같은 seed 2회 독립 실행 → hashState 일치.
  const w1 = SceneKit.load(SCENE_DOC, { mode: 'play', seed: SEED });
  const maxN1 = run120MaxCount(w1);
  const h1 = SceneKit.hashState(w1);

  const w2 = SceneKit.load(SCENE_DOC, { mode: 'play', seed: SEED });
  const maxN2 = run120MaxCount(w2);
  const h2 = SceneKit.hashState(w2);

  ok('4-A. 데모 코어 동일 seed 120프레임 해시 일치(결정성)',
    h1 === h2, `h1=${h1} h2=${h2}`);

  // 4-B: 실제로 시뮬레이션이 진행됐는지(trivial pass 방지) — Shooter 가 발사체를
  //      생성해 120프레임 중 한 번이라도 엔티티 수가 초기치(10)를 넘었어야 한다.
  //      (발사체는 lifetime 후 소멸하므로 최종 단일 시점이 아니라 최대치로 단언.)
  ok('4-B. 데모 120프레임 중 엔티티 생성 발생(생성형 컴포넌트 동작 — 최대치>10)',
    maxN1 > 10 && maxN1 === maxN2, `maxN1=${maxN1} maxN2=${maxN2}`);

  // 5. seed 의존 sanity — 다른 seed → 해시 상이(G1-B; rng state 포함).
  const w3 = SceneKit.load(SCENE_DOC, { mode: 'play', seed: SEED + 1 });
  run120(w3);
  const h3 = SceneKit.hashState(w3);
  ok('5. 데모 코어 다른 seed → 해시 상이(seed 의존 sanity)',
    h1 !== h3, `h1=${h1} h3=${h3}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. qa-score — 데모 게임 exit 0(임계 통과). VU 는 --frames 없으면 skipped(중립).
//    --require 토큰은 game.js+index.html 텍스트에 실재하는 것만(SCENE_DOC 임베드 기준).
// ─────────────────────────────────────────────────────────────────────────────
{
  const qaScore = resolve(root, 'skills/wgf-game-qa/tools/qa-score.mjs');
  // 씬에 실제 등장하는 게임플레이 토큰(전부 game.js 인라인 SCENE_DOC 텍스트에 존재).
  const REQUIRE = 'player,drone,turret,bullet,coin,heal,dash,health,shooter,enemyai,pickup,spawner';
  const r = runTool([qaScore, `games/${DEMO_SLUG}`, '--require', REQUIRE]);
  ok('6. qa-score 데모 게임 exit 0(임계 통과)',
    r.status === 0 && r.json && r.json.ok === true,
    r.json ? `bh=${r.json.bh} vu=${r.json.vu} ia=${r.json.ia} exit=${r.status}` : `exit=${r.status}`);
  // VU skipped 중립 + IA 100 정합 확인(거짓 통과 방지 — 토큰이 실재해야 IA 만점).
  ok('6. qa-score IA 100(요구 토큰 전부 산출물에 실재)',
    r.json && r.json.ia === 100, r.json ? `ia=${r.json.ia}` : 'JSON 회수 실패');
  ok('6. qa-score VU skipped(--frames 미주입 시 중립 정상)',
    r.json && r.json.vuSkipped === true && r.json.vu === null,
    r.json ? `vuSkipped=${r.json.vuSkipped} vu=${r.json.vu}` : 'JSON 회수 실패');
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과 출력(test-scenekit.mjs 형식 그대로)
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n— pass ${pass} · fail ${fail} · total ${pass + fail}`);
const result = { ok: fail === 0, pass, fail, checks };
console.log(JSON.stringify(result));
process.exit(fail === 0 ? 0 : 1);
