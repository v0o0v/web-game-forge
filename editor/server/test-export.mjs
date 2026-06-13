#!/usr/bin/env node
/* ============================================================================
 * WGF Studio 내보내기 게이트 하니스 — P2.5 수용 게이트
 * ----------------------------------------------------------------------------
 * 설계서 §5 P2.5·§3.2(동형성 H·H′)·§8 위험1·7·9 의 측정 게이트를 강제한다.
 * 샘플(topdown-min)을 임시 slug(games/_export-smoke/)로 export 한 뒤 다음을 검증:
 *
 *  (1) 동형성 H(트랜스폼): SceneKit.load(scene,{mode:'edit'}) t=0 트랜스폼 ==
 *      mode:'play' 0프레임 == **export game.js 가 부트하는 SCENE_DOC** 0프레임.
 *      세 경로 hashState **diff 0**. (export 가 같은 load 를 쓰므로 구성적 성립 —
 *      회귀로 단언. SCENE_DOC 은 game.js 에서 실제 추출해 진실성 확보.)
 *  (2) QA 가능성: 생성 game.js 에 window.<Slug>·autostart·seed·SceneKitPhaser.create·
 *      chrome:false·__bakeHash 패턴이 실제로 있는지 정적 검사. index.html 로드순서 정확성.
 *  (3) lint-rng: 산출 game.js error 0(자식 프로세스).
 *  (4) replay-determinism(동등): SceneKit 코어로 동일 (씬·seed·입력) 2회 헤드리스 step
 *      해시 일치를 **직접** 검증(replay-determinism.mjs 는 합성 미니게임 전용이라 임의
 *      slug 인자 불가 — 도구의 결정성 모델과 동형인 코어 직접검증으로 대체. 도구 자체의
 *      메타 통과도 별도 확인).
 *  (5) qa-score: 산출 게임 exit 0(임계 통과, 자식 프로세스).
 *
 * 브라우저 전용(리드 검증): 콘솔 에러 0 · 외형 H′ 베이크 골든 이미지 픽셀 diff 0 ·
 *   qa-score 의 VU(--frames) 는 chrome-devtools 로 리드가 검증한다. 이 하니스는
 *   __bakeHash 훅이 game.js·어댑터에 노출됐는지(정적)까지만 단언한다.
 *
 * 출력 계약: 사람용 라인들 먼저, 마지막 줄 단일 JSON { ok, pass, fail, gates:{...}, cases:[..] }.
 * 종료코드: 전부 통과 → 0, 하나라도 실패 → 1.
 *
 * 임시 산출물(games/_export-smoke/)은 테스트 끝에 정리한다(KEEP=1 이면 보존).
 * ==========================================================================*/
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));         // editor/server/
const REPO_ROOT = resolve(here, '..', '..');
const require = createRequire(import.meta.url);

const SAMPLE_SCENE = 'games/_editor-samples/topdown-min/scene.json';
const SMOKE_SLUG = '_export-smoke';
const SMOKE_DIR = resolve(REPO_ROOT, 'games', SMOKE_SLUG);
const KEEP = process.env.KEEP === '1';

// ── 결과 누적 ────────────────────────────────────────────────────────────────
const cases = [];
let pass = 0, fail = 0;
function check(name, ok, detail) {
  cases.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  if (ok) { pass++; console.log(`✓ ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// 게이트별 통과 집계(요약용).
const gates = { H: null, qaable: null, lintRng: null, replay: null, qaScore: null, bakeHook: null };

function finish() {
  // 임시 산출물 정리(KEEP=1 면 보존).
  if (!KEEP) { try { rmSync(SMOKE_DIR, { recursive: true, force: true }); } catch { /* 무시 */ } }
  const ok = fail === 0;
  console.log(`— pass ${pass} · fail ${fail}`);
  console.log(JSON.stringify({ ok, pass, fail, gates, cases }));
  process.exit(ok ? 0 : 1);
}

// 자식 프로세스 실행 후 마지막 줄 JSON 회수.
function runTool(args) {
  const r = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  const lines = (r.stdout || '').trim().split('\n');
  const last = lines[lines.length - 1] || '';
  let json = null;
  try { json = JSON.parse(last); } catch { /* 파싱 실패 */ }
  return { status: r.status, json, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// ── 0) export 실행 ────────────────────────────────────────────────────────────
const exp = runTool([resolve(here, 'export.mjs'), SAMPLE_SCENE, '--out', SMOKE_SLUG, '--json']);
if (!exp.json || exp.json.ok !== true) {
  check('0. export 실행 성공', false, `exit=${exp.status} stderr=${exp.stderr.slice(0, 200)}`);
  finish();
}
const Slug = exp.json.Slug;
check('0. export 실행 성공', true, `slug=${exp.json.slug} Slug=${Slug} files=${exp.json.files.length}`);

const gameJsPath = resolve(SMOKE_DIR, 'game.js');
const indexHtmlPath = resolve(SMOKE_DIR, 'index.html');
const creditsPath = resolve(SMOKE_DIR, 'CREDITS.txt');
check('0. 산출 파일 존재(game.js·index.html·CREDITS.txt)',
  existsSync(gameJsPath) && existsSync(indexHtmlPath) && existsSync(creditsPath));

const gameJs = existsSync(gameJsPath) ? readFileSync(gameJsPath, 'utf8') : '';
const indexHtml = existsSync(indexHtmlPath) ? readFileSync(indexHtmlPath, 'utf8') : '';

// ── 엔진 코어 로드(헤드리스 — Phaser 비의존) ──────────────────────────────────
const SceneKit = require(resolve(REPO_ROOT, 'engine/scenekit.js'));
require(resolve(REPO_ROOT, 'engine/scenekit-components.js'));
const sampleDoc = JSON.parse(readFileSync(resolve(REPO_ROOT, SAMPLE_SCENE), 'utf8'));

// ── game.js 에서 실제 부트되는 SCENE_DOC 추출(진실성) ─────────────────────────
// game.js 를 vm 샌드박스에서 평가. SceneKitPhaser.create 를 스텁해 전달된 sceneDoc 를
// 가로채고, window.<Slug>.scene 도 함께 회수한다(둘이 같아야 함). DOM/RngForge/ChipAudio
// 는 최소 스텁. autostart 없는 기본 search 라 play 루프는 시작 안 함(t=0 만).
function extractExportedScene(src) {
  let captured = { fromCreate: null, fromApi: null };
  const win = {};
  const sandbox = {
    window: win,
    document: {
      getElementById: () => ({}),
      body: {}
    },
    location: { search: '' },
    RngForge: { create: (seed) => makeStubRng(seed) },
    SceneKitPhaser: {
      create: (parentEl, sceneDoc, opts) => {
        captured.fromCreate = sceneDoc;
        // onReady 를 동기 호출해 window.<Slug> 가 채워지게(QA API 회수).
        const inst = {
          getWorld: () => ({ rng: opts && opts.rng }),
          setMode: () => {},
          bakeHash: () => 'stubbakehash'
        };
        if (opts && typeof opts.onReady === 'function') { try { opts.onReady(); } catch { /* 격리 */ } }
        return inst;
      }
    },
    console: { log: () => {}, warn: () => {}, error: () => {} }
  };
  win.GAME_INPUT = undefined;
  try {
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { timeout: 3000 });
    captured.fromApi = (win[Slug] && win[Slug].scene) || null;
  } catch (e) {
    return { error: e.message, captured };
  }
  return { error: null, captured, win };
}

function makeStubRng(seed) {
  let a = (typeof seed === 'number' ? seed : 0) | 0;
  const rng = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  rng.state = () => a; rng.float = (lo, hi) => lo + rng() * (hi - lo); rng.int = (lo, hi) => Math.floor(lo + rng() * (hi - lo + 1));
  rng.bool = (p) => rng() < (p == null ? 0.5 : p); rng.pick = (arr) => arr[Math.floor(rng() * arr.length)]; rng.stream = () => rng;
  return rng;
}

const ext = extractExportedScene(gameJs);
const exportedDoc = ext.captured.fromCreate;
check('0. game.js 평가 + SCENE_DOC 추출(SceneKitPhaser.create 인자)',
  !ext.error && exportedDoc && typeof exportedDoc === 'object',
  ext.error ? ('eval 오류: ' + ext.error) : 'ok');
check('0. window.<Slug>.scene == create 에 전달된 SCENE_DOC(단일 진실)',
  ext.captured.fromApi != null && JSON.stringify(ext.captured.fromApi) === JSON.stringify(exportedDoc),
  ext.captured.fromApi ? 'identical' : 'window API scene 누락');

// ════════════════════════════════════════════════════════════════════════════
// 게이트 (1) 동형성 H — edit t=0 = play 0프레임 = export 부트 0프레임 트랜스폼 diff 0
// ════════════════════════════════════════════════════════════════════════════
// 세 경로 모두 같은 seed 로 load 해 hashState 비교. play 는 step 0회(=0프레임)면
// edit 와 동일 t=0(둘 다 init 만). export 는 추출한 SCENE_DOC 로 동일 load.
const SEED = 12345;
function loadHash(doc, mode) {
  const w = SceneKit.load(doc, { mode, seed: SEED });
  return SceneKit.hashState(w);
}
const hEdit = loadHash(sampleDoc, 'edit');
const hPlay0 = loadHash(sampleDoc, 'play');          // 0프레임(step 안 함)
const hExport0 = exportedDoc ? loadHash(exportedDoc, 'play') : null;

const hOk = (hEdit === hPlay0) && (hPlay0 === hExport0);
gates.H = hOk;
check('1-H. edit t=0 트랜스폼 == play 0프레임', hEdit === hPlay0, `edit=${hEdit} play0=${hPlay0}`);
check('1-H. play 0프레임 == export 부트 0프레임(diff 0)', hPlay0 === hExport0, `play0=${hPlay0} export0=${hExport0}`);

// 추가: 트랜스폼 스냅샷 diff 0(엔티티별 좌표) — hashState 외 직접 비교로 이중 단언.
function transformSnap(doc, mode) {
  const w = SceneKit.load(doc, { mode, seed: SEED });
  return w.entities
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => ({ id: e.id, x: e.transform.x, y: e.transform.y, r: e.transform.rotation, sx: e.transform.scaleX, sy: e.transform.scaleY, d: e.transform.depth }));
}
const snapEdit = JSON.stringify(transformSnap(sampleDoc, 'edit'));
const snapExport = exportedDoc ? JSON.stringify(transformSnap(exportedDoc, 'play')) : null;
check('1-H. 트랜스폼 스냅샷 diff 0(edit vs export 부트)', snapEdit === snapExport,
  snapEdit === snapExport ? `entities=${transformSnap(sampleDoc, 'edit').length}` : 'snapshot mismatch');

// ════════════════════════════════════════════════════════════════════════════
// 게이트 (2) QA 가능성 — game.js 정적 패턴 + index.html 로드순서
// ════════════════════════════════════════════════════════════════════════════
const qaPatterns = [
  { name: `window.${Slug} 노출`, re: new RegExp('window\\.' + Slug + '\\s*=') },
  { name: 'input: GAME_INPUT', re: /input:\s*GAME_INPUT/ },
  { name: 'audio 노출', re: /audio:\s*GAME_AUDIO/ },
  { name: 'rng 노출', re: /\brng:/ },
  { name: '?autostart=1 지원', re: /autostart=1/ },
  { name: '?seed=N 지원', re: /seed=/ },
  { name: 'SceneKit 코어 부트(SceneKitPhaser.create)', re: /SceneKitPhaser\.create/ },
  { name: 'chrome:false(에디터 크롬 억제)', re: /chrome:\s*false/ },
  { name: '__bakeHash 훅(외형 H′)', re: /__bakeHash/ }
];
let qaableAll = true;
for (const p of qaPatterns) {
  const ok = p.re.test(gameJs);
  if (!ok) qaableAll = false;
  check('2-QA. ' + p.name, ok);
}

// index.html 로드순서 정확성: 엔진 9종 + game.js 가 정확한 순서로 등장.
const EXPECTED_ORDER = [
  'phaser.min.js', 'pixelforge.js', 'vectorforge.js', 'audio.js', 'mobile.js',
  'joystickkit.js', 'scenekit.js', 'scenekit-components.js', 'scenekit-phaser.js', 'game.js'
];
const scriptSrcs = [];
const reScript = /<script\s+src="([^"]+)"><\/script>/g;
let m;
while ((m = reScript.exec(indexHtml)) !== null) {
  scriptSrcs.push(m[1].replace(/^\.\.\/\.\.\/engine\//, ''));
}
const orderOk = JSON.stringify(scriptSrcs) === JSON.stringify(EXPECTED_ORDER);
if (!orderOk) qaableAll = false;
check('2-QA. index.html 로드순서 정확(엔진 9종 + game.js)', orderOk,
  orderOk ? scriptSrcs.join(' → ') : `실제=[${scriptSrcs.join(', ')}]`);

// 엔진 상대경로(../../engine/) 사용 확인(무빌드 vendoring).
check('2-QA. 엔진 상대경로 ../../engine/ 참조(무빌드)',
  /<script\s+src="\.\.\/\.\.\/engine\/phaser\.min\.js"><\/script>/.test(indexHtml));
gates.qaable = qaableAll;

// bakeHash 훅이 game.js + 어댑터 양쪽에 노출됐는지(외형 H′ 정적 단언).
const adapterSrc = readFileSync(resolve(REPO_ROOT, 'engine/scenekit-phaser.js'), 'utf8');
const bakeHookOk = /__bakeHash/.test(gameJs) && /bakeHash:\s*function/.test(adapterSrc);
gates.bakeHook = bakeHookOk;
check('2-QA. __bakeHash 훅 game.js+어댑터 노출(외형 H′ 검증 경로)', bakeHookOk);

// ════════════════════════════════════════════════════════════════════════════
// 게이트 (3) lint-rng — 산출 game.js error 0
// ════════════════════════════════════════════════════════════════════════════
const lr = runTool([resolve(REPO_ROOT, 'skills/wgf-game-qa/tools/lint-rng.mjs'), `games/${SMOKE_SLUG}/game.js`]);
const lintOk = lr.json && lr.json.ok === true && lr.json.counts && lr.json.counts.error === 0;
gates.lintRng = !!lintOk;
check('3-lint-rng. 산출 game.js error 0', lintOk,
  lr.json ? `error=${lr.json.counts.error} warn=${lr.json.counts.warn}` : `exit=${lr.status}`);

// ════════════════════════════════════════════════════════════════════════════
// 게이트 (4) replay-determinism — 헤드리스 2회 step 해시 일치(코어 직접 + 도구 메타)
// ════════════════════════════════════════════════════════════════════════════
// (4a) 코어 직접: export 부트 SCENE_DOC 로 같은 seed·같은 입력 타임라인 2회 독립 재생.
//   입력은 결정적 inputProvider(헤드리스 주입)로 TopDownController 를 구동. 두 회차의
//   프레임별 hashState 시퀀스가 동일해야 통과(내보낸 게임의 결정성 = 동형성 H 의 t>0 보장).
function playSteps(doc, seed, frames) {
  const w = SceneKit.load(doc, { mode: 'play', seed });
  // 결정적 입력: 프레임 인덱스로 방향을 정한다(시각·무작위 미사용).
  w.meta = w.meta || {};
  let f = 0;
  w.meta.inputProvider = () => {
    const ax = ((f % 4) < 2) ? 1 : -1;
    const ay = ((f % 8) < 4) ? 1 : -1;
    return { ax, ay };
  };
  const seq = [];
  for (let i = 0; i < frames; i++) { f = i; SceneKit.step(w, 1 / 60); seq.push(SceneKit.hashState(w)); }
  return seq.join('|');
}
const replayDoc = exportedDoc || sampleDoc;
const seqA = playSteps(replayDoc, 7777, 120);
const seqB = playSteps(replayDoc, 7777, 120);
const replayCoreOk = seqA === seqB;
check('4-replay. 내보낸 게임 코어 2회 재생 해시 일치(120프레임)', replayCoreOk,
  replayCoreOk ? 'deterministic' : `divergent`);
// 다른 seed 면 달라야(결정성 모델 sanity — rng 가 진짜 시드 의존).
const seqC = playSteps(replayDoc, 9999, 120);
check('4-replay. 다른 seed → 해시 상이(시드 의존 sanity)', seqA !== seqC);

// (4b) replay-determinism.mjs 도구 자체 메타 통과(결정성·음성 fixture 검출).
const rd = runTool([resolve(REPO_ROOT, 'skills/wgf-game-qa/tools/replay-determinism.mjs')]);
const rdOk = rd.json && rd.json.ok === true;
check('4-replay. replay-determinism.mjs 도구 ok:true(결정성 모델 메타)', rdOk,
  rd.json ? `pass=${rd.json.pass} fail=${rd.json.fail}` : `exit=${rd.status}`);
gates.replay = replayCoreOk && (seqA !== seqC) && !!rdOk;

// ════════════════════════════════════════════════════════════════════════════
// 게이트 (5) qa-score — 산출 게임 exit 0(임계 통과)
// ════════════════════════════════════════════════════════════════════════════
const qs = runTool([resolve(REPO_ROOT, 'skills/wgf-game-qa/tools/qa-score.mjs'), `games/${SMOKE_SLUG}`]);
const qaScoreOk = qs.status === 0 && qs.json && qs.json.ok === true;
gates.qaScore = !!qaScoreOk;
check('5-qa-score. 산출 게임 exit 0(임계 통과)', qaScoreOk,
  qs.json ? `bh=${qs.json.bh} vu=${qs.json.vu} ia=${qs.json.ia} exit=${qs.status}` : `exit=${qs.status}`);

finish();
