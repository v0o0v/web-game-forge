#!/usr/bin/env node
/* ============================================================================
 * WGF Studio 내보내기 — scene.json → 무빌드 정적 게임 (P2.5)
 * ----------------------------------------------------------------------------
 * 설계서 §4.8·§5 P2.5·§3.2(동형성 H·H′)·§8 위험1·7·9 구현.
 *
 * 책임:
 *  - 입력 scene.json(경로 또는 slug) → 출력 games/<slug>/{index.html, game.js,
 *    CREDITS.txt} (+ 필요 자산). **무빌드 정적** 게임(<script> vendoring 만).
 *  - 산출 게임은 본질적으로 SceneKit.load(SCENE_DOC, {mode:'play'}) 부트스트랩 →
 *    에디터 play 와 **동일 SceneKit 코어**로 t=0 생성 → 동형성 H 구성적 성립.
 *  - QA 가능성 계약(필수): window.<Slug> = { game, input, audio, rng, scene,
 *    __bakeHash } 노출 + ?autostart=1(자동 play 루프) + ?seed=N(RngForge 시드).
 *    이 패턴이 빠지면 export 가 실패한다(정적 검사로도 회귀 — test-export.mjs).
 *
 * 불변식:
 *  - zero-dep — Node 빌트인만(fs/path/url). npm 의존·번들러 금지.
 *  - 무빌드 — 산출 게임은 0 빌드. 엔진은 상대경로 ../../engine/*.js 참조(기존 게임 관례).
 *  - 결정론 — 산출 game.js 는 Math.random/Date.now 금지. 무작위는 RngForge 만(lint-rng 0).
 *  - 코어(scenekit.js·scenekit-components.js) 비수정 — 이 도구는 코어를 require 만 한다.
 *
 * 사용:
 *   node editor/server/export.mjs <scene.json 경로 또는 slug> [--out <slug>]
 *   node editor/server/export.mjs games/_editor-samples/topdown-min/scene.json
 *   node editor/server/export.mjs topdown-min --out my-game
 *   node editor/server/export.mjs <scene> --json     # 사람용 라인 생략
 *
 * 출력 계약: 사람용 라인들 먼저, 마지막 줄 단일 JSON:
 *   {"ok":bool,"slug":..,"outDir":..,"files":[..],"warnings":[..]}
 * 종료코드: ok 면 0, 아니면 1.
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));  // editor/server/
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');          // 리포 루트

// 산출 game.js 가 <script> 로 로드하는 엔진 파일 순서(설계서 §4.8).
// phaser → pixelforge → vectorforge → audio → (soundforge 선택) → mobile →
// joystick → scenekit → scenekit-components → scenekit-phaser → game.js.
// 엔진은 상대경로 ../../engine/<file> 로 참조(games/<slug>/ 기준).
const ENGINE_ORDER = [
  'phaser.min.js',
  'pixelforge.js',
  'vectorforge.js',
  'audio.js',
  'mobile.js',
  'joystickkit.js',
  'scenekit.js',
  'scenekit-components.js',
  'scenekit-phaser.js'
];

// ── 인자 파싱 ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { input: null, out: null, jsonOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--json') args.jsonOnly = true;
    else if (!a.startsWith('--')) args.input = a;
  }
  return args;
}

// ── slug → PascalCase(window.<Slug>) ──────────────────────────────────────────
// "topdown-min" → "TopdownMin", "my_game 2" → "MyGame2". JS 식별자로 안전.
function toPascal(slug) {
  const parts = String(slug || 'game').split(/[^A-Za-z0-9]+/).filter(Boolean);
  let out = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  if (!out) out = 'Game';
  if (/^[0-9]/.test(out)) out = 'G' + out;        // 숫자 시작 금지(식별자 규칙)
  return out;
}

// 경로가 REPO_ROOT 안인지(traversal 가드).
function isInsideRepo(abs) {
  return abs === REPO_ROOT || abs.startsWith(REPO_ROOT + path.sep);
}

// ── 입력 해석: scene.json 경로 또는 slug ──────────────────────────────────────
// slug 면 games/<slug>/scene.json 또는 games/_editor-samples/<slug>/scene.json 탐색.
function resolveSceneFile(input) {
  if (!input) return null;
  const direct = path.resolve(REPO_ROOT, input);
  try { if (fs.statSync(direct).isFile()) return direct; } catch { /* 다음 */ }
  // slug 후보(경로 끝이 .json 이 아니면)
  const candidates = [
    path.resolve(REPO_ROOT, 'games', input, 'scene.json'),
    path.resolve(REPO_ROOT, 'games', '_editor-samples', input, 'scene.json')
  ];
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch { /* 다음 */ }
  }
  return null;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));
  const say = (...a) => { if (!args.jsonOnly) console.log(...a); };
  const warnings = [];

  function bail(message) {
    say(`✗ ${message}`);
    console.log(JSON.stringify({ ok: false, error: message }));
    process.exit(1);
  }

  if (!args.input) bail('입력이 없습니다. 사용: node export.mjs <scene.json 경로 또는 slug> [--out <slug>]');

  const sceneFile = resolveSceneFile(args.input);
  if (!sceneFile) bail(`scene.json 을 찾을 수 없습니다: ${args.input}`);
  if (!isInsideRepo(sceneFile)) bail(`scene.json 이 리포 밖입니다(traversal 거부): ${sceneFile}`);

  let raw, doc;
  try { raw = fs.readFileSync(sceneFile, 'utf8'); }
  catch (e) { bail(`scene.json 읽기 실패: ${e.message}`); }
  try { doc = JSON.parse(raw); }
  catch (e) { bail(`scene.json JSON 파싱 실패: ${e.message}`); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) bail('scene.json 루트가 객체가 아닙니다.');

  // slug: --out > doc.slug > 입력 파일 부모 디렉터리명.
  const slug = sanitizeSlug(args.out || doc.slug || path.basename(path.dirname(sceneFile)), (m) => warnings.push(m));
  if (!slug) bail('유효한 slug 를 결정할 수 없습니다(--out 으로 지정하세요).');
  const Slug = toPascal(slug);

  // 출력 디렉터리(games/<slug>/) — games/ 루트 하위로 강제(방어심화, 보안 §6).
  //  sanitizeSlug 가 경로 구분자·'.' 를 제거하므로 정상 slug 는 항상 games/<slug> 안이지만,
  //  단일 진실 방어로 outDir 가 games/ 루트(또는 그 하위)인지 명시 검사한다 — isInsideRepo
  //  (리포 루트 기준)보다 좁혀 games/ 밖 어떤 디렉터리에도 쓰지 못하게 한다.
  const gamesRoot = path.resolve(REPO_ROOT, 'games');
  const outDir = path.resolve(REPO_ROOT, 'games', slug);
  if (outDir !== gamesRoot && !outDir.startsWith(gamesRoot + path.sep)) {
    bail(`출력 디렉터리가 games/ 밖입니다(traversal 거부): ${outDir}`);
  }

  // 엔진 파일 존재 확인(무빌드 vendoring 전제).
  for (const f of ENGINE_ORDER) {
    const p = path.resolve(REPO_ROOT, 'engine', f);
    try { fs.statSync(p); } catch { warnings.push(`엔진 파일 누락(런타임 로드 실패 가능): engine/${f}`); }
  }

  // 자산: cc0·local url 참조는 CREDITS 에 기록.
  const externalAssets = collectExternalAssets(doc);
  for (const a of externalAssets) {
    if (!a.url) warnings.push(`${a.source} 자산 "${a.id}" 에 url 이 없습니다(CREDITS 출처 불완전).`);
    if (!a.license) warnings.push(`${a.source} 자산 "${a.id}" 에 license 가 없습니다(라이선스 미상).`);
    // CC-BY 류 attribution 누락 경고.
    if (a.license && /^CC-BY/i.test(a.license) && !a.attribution && !a.credit) {
      warnings.push(`${a.source} 자산 "${a.id}" 는 CC-BY 류이나 attribution 이 없습니다.`);
    }
  }

  // ── 산출물 생성 ──────────────────────────────────────────────────────────────
  fs.mkdirSync(outDir, { recursive: true });

  // local 자산 url 재작성: repo-root 상대("games/<slug>/assets/imported/x.png") →
  // game-root 상대("assets/imported/x.png"). index.html 이 games/<slug>/ 에 위치하므로
  // 런타임 로더가 game-root 기준 상대경로로 해석한다. 원본 doc 은 건드리지 않고 복사본만 수정.
  const gamePrefix = 'games/' + slug + '/';
  const docForExport = rewriteLocalUrls(doc, gamePrefix);

  const sceneTitle = (doc.meta && doc.meta.title) || slug;
  const indexHtml = buildIndexHtml({ title: sceneTitle, meta: doc.meta || {} });
  const gameJs = buildGameJs({ slug, Slug, sceneJson: stableJson(docForExport) });
  const credits = buildCredits({ slug, title: sceneTitle, externalAssets });

  const files = [];
  writeFile(path.join(outDir, 'index.html'), indexHtml, files, outDir);
  writeFile(path.join(outDir, 'game.js'), gameJs, files, outDir);
  writeFile(path.join(outDir, 'CREDITS.txt'), credits, files, outDir);

  // ── 요약 ─────────────────────────────────────────────────────────────────────
  say(`✓ export 완료 — games/${slug}/`);
  say(`  window.${Slug} 노출 · ?autostart=1 · ?seed=N`);
  for (const f of files) say(`  + ${f}`);
  for (const w of warnings) say(`  ⚠ ${w}`);

  console.log(JSON.stringify({
    ok: true,
    slug,
    Slug,
    outDir: path.relative(REPO_ROOT, outDir).split(path.sep).join('/'),
    sceneFile: path.relative(REPO_ROOT, sceneFile).split(path.sep).join('/'),
    files,
    warnings,
    externalCount: externalAssets.length
  }));
  process.exit(0);
}

// slug 정규화: 소문자·영숫자·하이픈만(URL-safe). 경로 조작 문자 제거.
// 원본에 '/' '..' 등 경로 조작 문자가 포함된 경우 stderr 경고(거부까진 하지 않음 — games/ 밖
// 쓰기는 isInsideRepo 로 이미 차단. 의도치 않은 slug 왜곡만 알림).
function sanitizeSlug(s, warnFn) {
  const raw = String(s || '').trim();
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (warnFn && raw !== raw.toLowerCase().slice(0, 64) && /[/\\.]/.test(raw)) {
    warnFn(`slug 에 경로 조작 문자(/, \\, .)가 포함되어 정규화했습니다: "${raw}" → "${normalized}"`);
  }
  return normalized;
}

// 결정적 JSON 직렬화(들여쓰기 2). 키 순서는 입력 보존(JSON.parse→stringify).
// U+2028(행 구분자)/U+2029(단락 구분자) 이스케이프 — 구엔진 <script> 내 JS 호환.
function stableJson(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// 외부 자산 수집(assets.sprites + scenes[].assets.sprites 등 source:'cc0'|'local').
// 반환 항목: {id, url, license, credit, attribution, desc, source, origin?, attested?}.
function collectExternalAssets(doc) {
  const out = [];
  const seen = new Set();
  const scanAssets = (assets) => {
    if (!assets || typeof assets !== 'object') return;
    const sprites = Array.isArray(assets.sprites) ? assets.sprites : [];
    for (const s of sprites) {
      if (s && (s.source === 'cc0' || s.source === 'local') && s.id && !seen.has(s.id)) {
        seen.add(s.id);
        out.push({
          id: s.id,
          url: s.url || null,
          license: s.license || null,
          credit: s.credit || null,
          attribution: s.attribution || null,
          desc: s.desc || null,
          source: s.source,
          origin: s.origin || null,
          attested: s.attested || null
        });
      }
    }
  };
  scanAssets(doc.assets);
  if (Array.isArray(doc.scenes)) for (const sc of doc.scenes) if (sc) scanAssets(sc.assets);
  return out;
}

// 파일 쓰기 + 상대경로 기록(traversal 가드).
function writeFile(absPath, content, filesArr, outDir) {
  if (!absPath.startsWith(outDir + path.sep) && absPath !== outDir) {
    throw new Error(`출력 경로가 디렉터리 밖입니다(traversal 거부): ${absPath}`);
  }
  fs.writeFileSync(absPath, content, 'utf8');
  filesArr.push(path.relative(REPO_ROOT, absPath).split(path.sep).join('/'));
}

// ── index.html 빌더(무빌드 vendoring, 엔진 로드순서 보존) ─────────────────────
function buildIndexHtml({ title, meta }) {
  const pixelArt = !!(meta && meta.pixelArt);
  const themeColor = '#0a0e24';
  const imageRendering = pixelArt ? 'pixelated' : 'auto';
  const scripts = ENGINE_ORDER
    .map((f) => `<script src="../../engine/${f}"></script>`)
    .join('\n');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<!-- 모바일 웹뷰 대응: 노치 영역까지 확장 + 핀치/더블탭 줌 차단 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="${themeColor}">
<!-- 빈 favicon — 브라우저 자동 /favicon.ico 요청에 의한 무해한 404 콘솔 에러 억제(QA 콘솔 0 보장). -->
<link rel="icon" href="data:,">
<title>${esc(title)}</title>
<style>
  /* 모바일 웹뷰 CSS 리셋 (러버밴드/스크롤/탭하이라이트/롱프레스 메뉴 차단) */
  html, body {
    margin: 0; padding: 0;
    width: 100%; height: 100%;
    overflow: hidden;
    position: fixed; inset: 0;
    background: #000;
    overscroll-behavior: none;
    -webkit-user-select: none; user-select: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    touch-action: none;
  }
  #game { width: 100%; height: 100dvh; height: 100svh; }
  #game canvas { display: block; touch-action: none; image-rendering: ${imageRendering}; }
</style>
</head>
<body>
<div id="game"></div>
<!-- WGF Studio export — 무빌드 정적 게임(vendored Phaser + 엔진 라이브러리, 전부 로컬).
     엔진 로드순서 보존: phaser→pixelforge→vectorforge→audio→mobile→joystick→
     scenekit→scenekit-components→scenekit-phaser→game.js (설계서 §4.8). -->
${scripts}
<script src="game.js"></script>
</body>
</html>
`;
}

// ── game.js 빌더(QA 가능성 계약 — window.<Slug>·autostart·seed) ───────────────
// 산출 game.js 는 scene.json 을 인라인 임베드(SCENE_DOC)하고, 에디터 play 와 동일한
// SceneKit 코어 + scenekit-phaser 어댑터(chrome:false)로 부트스트랩한다 → 동형성 H.
function buildGameJs({ slug, Slug, sceneJson }) {
  return `/* ============================================================================
 * ${slug} — WGF Studio 로 내보낸 무빌드 정적 게임
 * ----------------------------------------------------------------------------
 * 이 파일은 editor/server/export.mjs 가 scene.json 으로부터 자동 생성한다.
 * 에디터 play 와 **동일한 SceneKit 로직코어 + scenekit-phaser 어댑터**로 t=0 를
 * 만들고 같은 코어로 step → 설계서 §3.2 동형성 계약 H 가 구성적으로 성립한다.
 *
 * 결정론(불변식):
 *  - 무작위는 RngForge 시드 스트림만(Math.random 금지).
 *  - 시간은 Phaser 주입 delta(어댑터 _update)만(Date.now/performance.now 금지).
 *  - ?seed=N 으로 RngForge 시드 고정(미지정 시 scene.meta.seed 또는 고정 기본).
 *
 * QA 가능성 계약(설계서 §4.8):
 *  - window.${Slug} = { game, input: GAME_INPUT, audio, rng, scene, __bakeHash } 노출.
 *  - ?autostart=1 : 탭 없이 자동 play 루프 시작(헤드리스/QA 구동).
 *  - __bakeHash() : 베이크 자산 텍스처 픽셀 해시(외형 동형 H′ 검증 — 어댑터 위임).
 * ==========================================================================*/
(function () {
  'use strict';

  // 인라인 임베드된 씬 문서(단일 진실). 에디터 scene.json 과 동일.
  var SCENE_DOC = ${indent(sceneJson, 2)};

  // 공유 입력 상태(키보드/조이스틱 → SceneKit TopDownController 가 읽음).
  // scenekit-phaser 어댑터가 매 프레임 이 객체를 갱신한다.
  if (!window.GAME_INPUT) window.GAME_INPUT = { up: false, down: false, left: false, right: false };
  var GAME_INPUT = window.GAME_INPUT;

  // 결정적 시드: ?seed=N > scene.meta.seed > 고정 기본.
  function parseSeed() {
    var m = /[?&]seed=(-?\\d+)/.exec(location.search);
    if (m) return parseInt(m[1], 10);
    if (SCENE_DOC.meta && typeof SCENE_DOC.meta.seed === 'number') return SCENE_DOC.meta.seed;
    return 0x9E3779B9 | 0;
  }
  var SEED = parseSeed();

  // RngForge 시드 스트림(결정론 토대). 미로드 시 null(어댑터가 코어 폴백 사용).
  var RNG = (typeof RngForge !== 'undefined' && RngForge.create) ? RngForge.create(SEED) : null;

  // 오디오(ChipAudio — 8비트 절차 사운드). 어댑터가 audioEvents 를 drain 해 재생(후속).
  var GAME_AUDIO = (typeof ChipAudio !== 'undefined') ? new ChipAudio() : null;
  if (GAME_AUDIO) window.GAME_AUDIO = GAME_AUDIO;   // mobile.js 음소거 버튼 참조

  // ── 부트스트랩 ──────────────────────────────────────────────────────────────
  // scenekit-phaser 어댑터로 chrome:false(게임만) 렌더 + play step. 에디터 크롬 없음.
  var parent = document.getElementById('game') || document.body;
  var vp = (SCENE_DOC.meta && SCENE_DOC.meta.viewport) || {};

  var inst = SceneKitPhaser.create(parent, SCENE_DOC, {
    mode: 'edit',                 // 부트는 edit(t=0 정적) — autostart 면 즉시 play.
    chrome: false,                // 에디터 크롬(그리드·기즈모·아웃라인·마키·픽킹) 미장착.
    width: vp.w || undefined,
    height: vp.h || undefined,
    seed: SEED,
    rng: RNG || undefined,
    onReady: function () {
      // world 준비 완료 — QA API 갱신 + autostart 처리.
      ${Slug}Api.game = inst;
      ${Slug}Api.rng = (inst.getWorld && inst.getWorld()) ? inst.getWorld().rng : RNG;
      if (/[?&]autostart=1/.test(location.search)) start();
    }
  });

  // play 루프 시작(어댑터 setMode('play') → _update 가 주입 delta 로 코어 step).
  function start() {
    if (inst && inst.setMode) inst.setMode('play');
  }
  function stop() {
    if (inst && inst.setMode) inst.setMode('edit');
  }

  // ── QA 가능성 계약: window.${Slug} 노출 ─────────────────────────────────────
  var ${Slug}Api = {
    game: inst,
    input: GAME_INPUT,
    audio: GAME_AUDIO,
    rng: RNG,
    scene: SCENE_DOC,
    seed: SEED,
    start: start,
    stop: stop,
    // 외형 동형(계약 H′) 검증 훅 — 어댑터 bakeHash 위임. 리드가 edit vs export 비교.
    __bakeHash: function () { return (inst && inst.bakeHash) ? inst.bakeHash() : null; }
  };
  window.${Slug} = ${Slug}Api;
})();
`;
}

// 다중행 문자열을 n칸 들여쓰기(첫 줄 제외 — 첫 줄은 호출부 위치).
function indent(s, n) {
  const pad = ' '.repeat(n);
  return String(s).split('\n').map((line, i) => (i === 0 ? line : pad + line)).join('\n');
}

// local 자산 url 재작성: repo-root 상대("games/<slug>/assets/...") →
// game-root 상대("assets/..."). 원본 doc 을 깊은 복사 후 sprites 의 url 만 변경.
// gamePrefix 예: "games/my-game/" (trailing slash 포함).
function rewriteLocalUrls(doc, gamePrefix) {
  // 얕은 구조 복사(스프라이트 배열만 새 배열로 — 엔티티 등 나머지는 참조 공유 OK,
  // stableJson 이 직렬화 시점에 스냅샷을 찍으므로 레이스 없음).
  const rewriteSprites = (sprites) => {
    if (!Array.isArray(sprites)) return sprites;
    return sprites.map((s) => {
      if (!s || s.source !== 'local' || typeof s.url !== 'string') return s;
      let url = s.url;
      if (url.startsWith(gamePrefix)) {
        url = url.slice(gamePrefix.length);  // "assets/imported/x.png"
      }
      return Object.assign({}, s, { url });
    });
  };
  const rewriteAssets = (assets) => {
    if (!assets || typeof assets !== 'object') return assets;
    return Object.assign({}, assets, { sprites: rewriteSprites(assets.sprites) });
  };
  const out = Object.assign({}, doc, { assets: rewriteAssets(doc.assets) });
  if (Array.isArray(doc.scenes)) {
    out.scenes = doc.scenes.map((sc) => {
      if (!sc) return sc;
      return Object.assign({}, sc, { assets: rewriteAssets(sc.assets) });
    });
  }
  return out;
}

// ── CREDITS.txt 빌더 ──────────────────────────────────────────────────────────
function buildCredits({ slug, title, externalAssets, warnings }) {
  const lines = [];
  lines.push(`${title} (${slug}) — 크레딧`);
  lines.push('='.repeat(48));
  lines.push('');
  lines.push('이 게임은 WGF Studio(WebGameForge) 에디터로 제작·내보낸 무빌드 정적 게임입니다.');
  lines.push('엔진: Phaser 4 (MIT) + WebGameForge 엔진 킷(전부 로컬 vendoring, 오프라인 동작).');
  lines.push('');
  lines.push('## 자산 출처·라이선스');
  lines.push('');

  const cc0List = (externalAssets || []).filter((a) => a.source === 'cc0');
  const localList = (externalAssets || []).filter((a) => a.source === 'local');

  if (cc0List.length === 0 && localList.length === 0) {
    lines.push('- 모든 그래픽 자산은 PixelForge/VectorForge 로 **코드 절차 생성**(CC0, 오리지널).');
    lines.push('- 외부 IP(닌텐도 등) 스프라이트·이름·시그니처 미사용.');
  } else {
    if (cc0List.length > 0) {
      lines.push('- 일부 자산은 외부 CC0 라이브러리 참조입니다(아래). 나머지는 절차 생성(CC0).');
      lines.push('');
      for (const a of cc0List) {
        lines.push(`- ${a.id}`);
        lines.push(`    출처(url): ${a.url || '(미상 — 출처 확인 필요)'}`);
        lines.push(`    라이선스: ${a.license || '(미상 — 라이선스 확인 필요)'}`);
        if (a.credit) lines.push(`    크레딧: ${a.credit}`);
        if (a.desc) lines.push(`    설명: ${a.desc}`);
      }
    }
    if (localList.length > 0) {
      if (cc0List.length > 0) lines.push('');
      lines.push('## 임포트 자산(로컬/Unity)');
      lines.push('');
      for (const a of localList) {
        lines.push(`- ${a.id}`);
        lines.push(`    라이선스: ${a.license || '(미상 — 라이선스 확인 필요)'}`);
        if (a.credit) lines.push(`    크레딧: ${a.credit}`);
        if (a.attribution) lines.push(`    저작자 표기: ${a.attribution}`);
        if (a.desc) lines.push(`    설명: ${a.desc}`);
        if (a.attested) {
          lines.push(`    사용자 권리 보유 선언: ${a.attested.owner} (선언 라이선스 ${a.attested.declaredLicense}, ${a.attested.at})`);
        }
        if (a.origin && a.origin.relPath) lines.push(`    원본 경로: ${a.origin.relPath}`);
      }
    }
  }

  lines.push('');
  lines.push('## 사운드');
  lines.push('');
  lines.push('- ChipAudio(8비트 절차 합성, CC0) 또는 무음. 외부 음원 미사용(별도 표기 없으면).');
  lines.push('');
  return lines.join('\n') + '\n';
}

main();
