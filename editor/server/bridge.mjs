#!/usr/bin/env node
/* ============================================================================
 * WGF Studio 브리지 서버 — 라이브 씬 상태 = 단일 진실 (P2)
 * ----------------------------------------------------------------------------
 * 설계서 §3.1·§3.3·§4.5·§4.9·§5 P2·§6·§7·§8 위험8 구현.
 *
 * 책임:
 *  - SceneKit world(authoritative)를 보유 — 모든 변경은 커맨드 → 직렬 apply 큐
 *    (전순서) → 델타 SSE 브로드캐스트(§7 동시편집 직렬화).
 *  - 서버측 커맨드 로그 + Undo/Redo(applyCommand 의 undoDelta 스택, 상한 §7).
 *  - editor/·games/·engine/ 정적 서빙(127.0.0.1 전용, traversal 가드 — serve.mjs 동등).
 *  - SSE 델타 스트림(id:=seq, Last-Event-ID 무손실 복구, 백프레셔 resync §8 위험8).
 *  - Play 권위(§4.9): mode='play' 동안 씬 문서 read-only — edit 커맨드 409 거부.
 *
 * 불변식:
 *  - zero-dep — Node 빌트인만(http/crypto/fs/path/url/module). npm 의존 금지.
 *  - 결정론 — 상태 변경은 SceneKit.applyCommand/applyUndo 로만. 토큰용
 *    crypto.randomBytes 는 보안 예외(씬 상태 무관).
 *
 * 실행(프로젝트 루트에서):
 *   node editor/server/bridge.mjs [port]          # 기본 5180
 *   WGF_BRIDGE_PORT=5200 node editor/server/bridge.mjs
 *   WGF_BRIDGE_SCENE=games/<slug>/scene.json node editor/server/bridge.mjs
 *   WGF_BRIDGE_PORT=0 ...                           # 임의 빈 포트(테스트 하니스) — 자동열기 생략
 *   WGF_NO_OPEN=1 ...                               # 브라우저 자동 실행 끄기(명시 옵트아웃)
 * 기동 완료 시 기본 브라우저로 http://127.0.0.1:<port>/editor/ui/ 를 자동으로 연다.
 *
 * 보안(설계서 §6):
 *   - 127.0.0.1 전용 바인딩(0.0.0.0 금지 — LAN 비노출).
 *   - 기동 시 무작위 토큰(crypto.randomBytes) 발급. /api/* 는 토큰 + Origin 검사.
 *   - 모든 파일 경로를 리포 루트로 정규화 후 prefix 검사, ../ traversal 거부, dotfile 차단.
 * ==========================================================================*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as AssetImport from './asset-import.mjs';
import * as SpriteLibrary from './sprite-library.mjs';

const require = createRequire(import.meta.url);

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));    // editor/server/
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');            // 리포 루트(서빙 루트)

// ── 설정 ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.argv[2] || process.env.WGF_BRIDGE_PORT || '5180', 10);
const HOST = '127.0.0.1';
const UNDO_LIMIT = 200;            // Undo/Redo·커맨드 로그 상한(설계서 §7)
// 구독자별 송신 버퍼 상한(백프레셔, §8 위험8). 초과 → resync.
//  - SSE_BUFFER_LIMIT: 백프레셔 진입 후 누적 프레임 수 상한.
//  - SSE_BYTES_LIMIT: Node 스트림 내부 버퍼(res.writableLength) 바이트 상한.
//    writableLength 는 클라가 안 읽으면 OS 소켓이 아니라 Node 스트림에 쌓이므로 결정적으로
//    증가 → 테스트가 WGF_BRIDGE_SSE_LIMIT 만 낮춰도 resync 경로를 OS 의존 없이 트리거.
const SSE_BUFFER_LIMIT = parseInt(process.env.WGF_BRIDGE_SSE_LIMIT || '1000', 10);
const SSE_BYTES_LIMIT = parseInt(process.env.WGF_BRIDGE_SSE_BYTES || String(256 * 1024), 10);
// 테스트 전용: localhost loopback 송신 버퍼가 수 MB라 실제 소켓으로는 백프레셔를 결정적
// 으로 트리거하기 어렵다. 이 플래그가 켜지면 매 write 후 강제로 backpressured 로 간주해
// resync 경로를 실제로 실행 검증한다(프로덕션 기본 off — OS 신호/writableLength 만 사용).
const SSE_FORCE_BP = process.env.WGF_BRIDGE_SSE_FORCE_BP === '1';
const DEFAULT_SCENE = 'games/_editor-samples/topdown-min/scene.json';

// ── P3 역채널 설정 ─────────────────────────────────────────────────────────────
// 챗 큐 영속 경로(games/ 밖 — .gitignore 의 .omc/ 로 런타임 상태 격리, traversal 안전).
// 테스트는 WGF_BRIDGE_CHAT_FILE 로 임시 경로를 지정해 재진입 무손실을 검증한다.
const CHAT_FILE = process.env.WGF_BRIDGE_CHAT_FILE ||
  path.resolve(REPO_ROOT, '.omc', 'wgf-editor', 'chat-queue.json');
// 하트비트 임계(ms) — 마지막 하트비트로부터 이 시간 초과면 disconnected(설계서 §4.7).
// 기본 5000ms(§5 P3 게이트 "5초 내 끊김 표시"). 테스트는 단축해 임계 로직만 검증 가능.
const HEARTBEAT_TIMEOUT_MS = parseInt(process.env.WGF_BRIDGE_HEARTBEAT_MS || '5000', 10);
// editor_next_message long-poll 타임아웃(ms) — 미처리 메시지 없으면 이 시간 후 빈 응답.
const CHAT_POLL_TIMEOUT_MS = parseInt(process.env.WGF_BRIDGE_CHAT_POLL_MS || '25000', 10);
// 브리지↔MCP 토큰 공유 파일(같은 신뢰경계). 브리지가 기동 시 {port,token} 을 쓰고,
// mcp.mjs 가 읽어 localhost HTTP 프록시에 사용. games/ 밖(.omc/ 격리). 환경변수
// WGF_BRIDGE_TOKEN/WGF_BRIDGE_PORT 가 있으면 mcp.mjs 가 파일보다 우선 사용.
const ENDPOINT_FILE = process.env.WGF_BRIDGE_ENDPOINT_FILE ||
  path.resolve(REPO_ROOT, '.omc', 'wgf-editor', 'bridge-endpoint.json');

// scene_screenshot 캡처 왕복 타임아웃(ms) — `GET /api/screenshot/capture` 가 연결된
//  브라우저 뷰포트의 `POST /api/screenshot` 회신을 이 시간까지 기다린다. 초과하거나
//  애초에 구독자(브라우저)가 없으면 "뷰포트 없음" 구조화 에러로 응답(헤드리스 편집 계속).
//  기본 4000ms — 브라우저 toDataURL 왕복에 충분하되 헤드리스에서 과대 대기 안 함.
//  테스트는 단축/연장해 캡처·타임아웃 경로를 모두 검증한다.
const SCREENSHOT_TIMEOUT_MS = parseInt(process.env.WGF_BRIDGE_SCREENSHOT_MS || '4000', 10);
// 회신 PNG dataURL 본문 상한(바이트) — 과대 페이로드 거부(메모리 보호). 기본 16MB.
const SCREENSHOT_MAX_BYTES = parseInt(process.env.WGF_BRIDGE_SCREENSHOT_BYTES || String(16 * 1024 * 1024), 10);

// ── 토큰(보안 §6) ─────────────────────────────────────────────────────────────
const TOKEN = crypto.randomBytes(24).toString('hex');

// ── P4 결정형 스킬도구 화이트리스트 + 인자 스키마 (보안 §6) ─────────────────────
// `POST /api/skill/run` 은 아래 화이트리스트의 결정형 도구만 execFile(배열 인자)로
// 실행한다. 셸을 거치지 않으므로 셸 보간(`;`·`&&`·`$()` 등)은 무력화된다 — 어떤
// 인자도 "파일명/문자열"로만 취급된다(인자 메타문자 무해).
//
// 각 도구 정의:
//  - path  : 리포 내 고정 절대경로(절대 사용자 입력으로 결정하지 않음 — traversal 차단).
//  - args  : 허용 인자 스펙 배열. 각 스펙은 cli(고정 플래그 또는 위치 인자)를 어떻게
//            구성하는지 + 값 검증 규칙을 정의한다.
//      { name, kind:'flag'|'positional'|'boolflag', required?, type, enumVals?,
//        pathScope? }
//      - kind 'flag'      : 값을 받아 `--name <value>` 2토큰으로 push.
//      - kind 'positional': 값을 받아 그대로 1토큰으로 push(선두 위치 인자).
//      - kind 'boolflag'  : 값 true 면 `--name` 1토큰만 push(값 없음).
//      - type 'path'      : 경로 — pathScope(REPO_ROOT 또는 games/) 내로 정규화,
//                           벗어나면 거부(`../` traversal·절대경로 탈출 차단).
//      - type 'enum'      : enumVals 중 하나여야 함.
//      - type 'slug'      : [A-Za-z0-9._-] 만(경로 구분자·메타문자 불가).
//      - type 'string'    : 길이 상한만(메타문자는 execFile 라 무해하나 과대 방지).
// 화이트리스트에 없는 도구명, 스펙에 없는 인자, 타입 위반, traversal → 4xx 구조화 거부.
const SKILL_TOOLS = {
  // scene.json 정적 검증(현재 씬을 임시 직렬화해 그 경로로 실행).
  'lint-scene': {
    path: path.resolve(REPO_ROOT, 'skills/wgf-editor/tools/lint-scene.mjs'),
    args: [
      { name: 'file', kind: 'flag', required: true, type: 'path', pathScope: 'repo' },
      { name: 'json', kind: 'boolflag', type: 'bool' }
    ]
  },
  // game.js 결정론(RngForge·Math.random 금지) 정적 검증 — 위치 인자 파일.
  'lint-rng': {
    path: path.resolve(REPO_ROOT, 'skills/wgf-game-qa/tools/lint-rng.mjs'),
    args: [
      { name: 'file', kind: 'positional', required: true, type: 'path', pathScope: 'repo' },
      { name: 'json', kind: 'boolflag', type: 'bool' },
      { name: 'strict', kind: 'boolflag', type: 'bool' }
    ]
  },
  // juice(game feel) 정적 린트 — 위치 인자 파일.
  'lint-juice': {
    path: path.resolve(REPO_ROOT, 'skills/wgf-game-qa/tools/lint-juice.mjs'),
    args: [
      { name: 'file', kind: 'positional', required: true, type: 'path', pathScope: 'repo' },
      { name: 'json', kind: 'boolflag', type: 'bool' },
      { name: 'strict', kind: 'boolflag', type: 'bool' }
    ]
  },
  // 엔진 킷 의존성 그래프 검증(기본 engine/manifest.json — 인자 없이도 실행).
  'lint-kit-deps': {
    path: path.resolve(REPO_ROOT, 'skills/wgf-game-qa/tools/lint-kit-deps.mjs'),
    args: [
      { name: 'file', kind: 'positional', required: false, type: 'path', pathScope: 'repo' },
      { name: 'json', kind: 'boolflag', type: 'bool' },
      { name: 'strict', kind: 'boolflag', type: 'bool' }
    ]
  },
  // 종합 QA 점수(BH/VU/IA) — 위치 인자 slug 또는 games/ 내 디렉터리.
  'qa-score': {
    path: path.resolve(REPO_ROOT, 'skills/wgf-game-qa/tools/qa-score.mjs'),
    args: [
      { name: 'target', kind: 'positional', required: true, type: 'slug' },
      { name: 'json', kind: 'boolflag', type: 'bool' }
    ]
  }
};

// 경로 인자를 스코프(repo/games) 내로 정규화. 벗어나면 null(거부 신호).
function resolveScopedPath(value, scope) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024) return null;
  // NUL 등 제어문자 차단.
  if (/[\u0000-\u001f]/.test(value)) return null;
  // dotfile 세그먼트 차단(.env·.git 등) — serveStatic 정합.
  // 분리자(/ 또는 \)\uB85C 분할한 각 세그먼트가 '.' 으로 시작하면 거부('.' 자체는 ok).
  const segs = value.split(/[\/\\]/);
  if (segs.some((s) => s.startsWith('.') && s !== '.')) return null;
  const root = (scope === 'games') ? path.resolve(REPO_ROOT, 'games') : REPO_ROOT;
  // 상대경로는 REPO_ROOT 기준 해석(절대경로도 정규화 후 prefix 검사로 탈출 차단).
  const abs = path.resolve(REPO_ROOT, value);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

// 외부(소스) 폴더 검증 — Unity 프로젝트 폴더는 repo 밖일 수 있음(사용자 개시·본인 머신).
// 절대경로만 허용, length<=1024, 제어문자 차단, 실제 디렉터리 확인. 실패 시 null.
// 보안: 이 폴더는 *읽기 전용 소스*로만 쓰이며, 쓰기는 절대 여기로 하지 않는다
// (쓰기는 항상 resolveScopedPath('games') 로 이중검증된 games/<slug>/assets/imported/).
function resolveExternalFolder(folder) {
  if (typeof folder !== 'string' || folder.length === 0 || folder.length > 1024) return null;
  // NUL 등 제어문자 차단.
  for (let i = 0; i < folder.length; i++) { if (folder.charCodeAt(i) < 0x20) return null; }
  // 절대경로만(상대경로는 REPO_ROOT 기준 해석돼 의도 불명확 — 명시적 절대경로 요구).
  if (!path.isAbsolute(folder)) return null;
  const abs = path.resolve(folder);
  try {
    const st = fs.statSync(abs);
    if (!st.isDirectory()) return null;
  } catch (e) {
    return null;
  }
  return abs;
}

// 현재 편집 중 게임 디렉터리(절대경로) = scene.json 의 직계 부모.
// SCENE_REL(예: games/<slug>/scene.json)에서 부모 디렉터리를 도출한다 — export 의
// outDir/슬러그 기준(scene 부모)과 일치시켜 vendoring 위치·url 재작성을 정합시킨다.
// 중첩 경로(games/_editor-samples/topdown-min/scene.json)도 실제 부모를 정확히 반환(보안 LOW-1).
// (baseDoc.slug 는 'empty'/'scene' fallback 일 수 있어 경로가 더 신뢰됨.)
// games/ 직속(게임 폴더 없음)·games/ 밖(빈 씬 폴백)이면 null — 임포트 비활성.
function currentGameDir() {
  const absScene = path.resolve(REPO_ROOT, SCENE_REL);
  const gamesRoot = path.resolve(REPO_ROOT, 'games');
  const dir = path.dirname(absScene);
  if (dir === gamesRoot || !dir.startsWith(gamesRoot + path.sep)) return null;
  return dir;
}

// {tool, args} 검증 → execFile 인자 배열 생성. 위반 시 {error} 반환.
// 반환 {ok:true, toolPath, argv} 또는 {ok:false, code, error}.
function buildSkillCommand(tool, argsIn) {
  if (typeof tool !== 'string' || !Object.prototype.hasOwnProperty.call(SKILL_TOOLS, tool)) {
    return { ok: false, code: 403, error: '화이트리스트 외 도구 거부: ' + JSON.stringify(tool) };
  }
  const spec = SKILL_TOOLS[tool];
  const args = (argsIn && typeof argsIn === 'object' && !Array.isArray(argsIn)) ? argsIn : {};
  // 스펙에 없는 인자 키 거부(인자 스키마 위반).
  const allowed = new Set(spec.args.map((a) => a.name));
  for (const k of Object.keys(args)) {
    if (!allowed.has(k)) return { ok: false, code: 400, error: '허용되지 않은 인자: ' + JSON.stringify(k) };
  }
  const positional = [];
  const flags = [];
  for (const a of spec.args) {
    const v = args[a.name];
    if (v === undefined || v === null) {
      if (a.required) return { ok: false, code: 400, error: '필수 인자 누락: ' + a.name };
      continue;
    }
    if (a.kind === 'boolflag') {
      if (typeof v !== 'boolean') return { ok: false, code: 400, error: a.name + ' 는 boolean 이어야 함' };
      if (v) flags.push('--' + a.name);
      continue;
    }
    // 값 검증(타입별).
    if (a.type === 'path') {
      const abs = resolveScopedPath(v, a.pathScope);
      if (!abs) return { ok: false, code: 400, error: a.name + ' 경로 거부(범위 밖/traversal): ' + JSON.stringify(v) };
      pushArg(a, abs, positional, flags);
    } else if (a.type === 'slug') {
      // slug: 영숫자._-/ 만, '..' 금지, 선행 /·\·드라이브문자(:) 금지(절대경로 우회 차단).
      // games/<slug> 스코프로 이중검사 — path.resolve 결과가 gamesRoot+sep 안에 있어야 통과.
      if (typeof v !== 'string' || !/^[A-Za-z0-9._\-\/]{1,128}$/.test(v) || v.includes('..') ||
          v.startsWith('/') || v.startsWith('\\') || v.includes(':')) {
        return { ok: false, code: 400, error: a.name + ' slug 형식 위반(영숫자._-/ 만, ..|절대경로 금지): ' + JSON.stringify(v) };
      }
      // games/ 스코프 정규화 이중검사.
      const gamesRoot = path.resolve(REPO_ROOT, 'games');
      const absSlug = path.resolve(gamesRoot, v);
      if (absSlug !== gamesRoot && !absSlug.startsWith(gamesRoot + path.sep)) {
        return { ok: false, code: 400, error: a.name + ' slug games/ 범위 밖 거부: ' + JSON.stringify(v) };
      }
      pushArg(a, v, positional, flags);
    } else if (a.type === 'enum') {
      if (!Array.isArray(a.enumVals) || !a.enumVals.includes(v)) {
        return { ok: false, code: 400, error: a.name + ' 허용값 위반' };
      }
      pushArg(a, v, positional, flags);
    } else if (a.type === 'string') {
      if (typeof v !== 'string' || v.length > 256) return { ok: false, code: 400, error: a.name + ' 문자열 위반' };
      pushArg(a, v, positional, flags);
    } else {
      return { ok: false, code: 400, error: a.name + ' 알 수 없는 타입' };
    }
  }
  // argv = [toolPath, ...positional(선두), ...flags]. positional 우선(qa-score/lint-rng 위치 인자).
  const argv = [spec.path, ...positional, ...flags];
  return { ok: true, toolPath: spec.path, argv };
}

function pushArg(spec, value, positional, flags) {
  if (spec.kind === 'positional') positional.push(String(value));
  else flags.push('--' + spec.name, String(value));   // kind 'flag'
}

// ── SceneKit 코어 로드(authoritative world) ──────────────────────────────────
// 브라우저 외부(Node)에서도 동일 코어로 t=0 를 만든다 — §4.1 단일 코어 원칙.
const SceneKit = require(path.resolve(REPO_ROOT, 'engine/scenekit.js'));
require(path.resolve(REPO_ROOT, 'engine/scenekit-components.js'));  // 컴포넌트 등록(필수)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

// ── 씬 문서 로드(단일 진실 부트스트랩) ────────────────────────────────────────
const SCENE_REL = process.env.WGF_BRIDGE_SCENE || DEFAULT_SCENE;
let sceneDoc;
try {
  sceneDoc = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, SCENE_REL), 'utf8'));
} catch (e) {
  process.stderr.write(`[wgf-bridge] 씬 로드 실패(${SCENE_REL}) — 빈 씬으로 시작: ${String(e)}\n`);
  sceneDoc = {
    format: 'wgf-scene@1', slug: 'empty',
    meta: { title: '빈 씬', genre: 'topdown', viewport: { w: 320, h: 240 }, pixelArt: true },
    assets: {}, walls: [], scenes: [{ id: 'main', systems: {}, entities: [] }], dataLayers: {}
  };
}

// ── 멀티 씬 정규화(E1) ─────────────────────────────────────────────────────────
// baseDoc.scenes[] 가 모든 씬의 권위 저장소다. 부트 시 최소 1개 씬을 보장하고,
// 각 씬 id 를 위생화·유니크화한다(이후 add/rename 과 동일 규칙). raw 픽스처(scenes 미존재,
// 최상위 entities)도 단일 'main' 씬으로 승격해 멀티씬 경로로 일원화한다.
const SCENE_NAME_MAX = 128;            // 씬 name 길이 상한
const MAX_SCENES = 256;                // 씬 개수 상한(과다 생성 DoS 방어)

// 씬 id 위생화: 영숫자._- 만 남기고 64자 상한. 비면 fallback.
function sanitizeSceneId(raw, fallback) {
  const s = String(raw == null ? '' : raw).replace(/[^A-Za-z0-9._\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  return s.length ? s : fallback;
}
// 씬 name 위생화: 제어문자(C0 + DEL) 제거 + 길이 상한. 비면 fallback.
//  공백/하이픈 등 일반 문자는 보존(표시용 이름) — 제어문자만 제거(인젝션 표면 0).
function sanitizeSceneName(raw, fallback) {
  const src = String(raw == null ? '' : raw);
  let s = '';
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) continue;   // C0 제어문자 + DEL 제거
    s += src[i];
  }
  s = s.slice(0, SCENE_NAME_MAX).trim();
  return s.length ? s : fallback;
}
// 중복 방지 유니크 id 발급(used Set 기준 -2,-3 접미).
function uniqueSceneId(base, used) {
  let id = base;
  let n = 2;
  while (used.has(id)) { id = base + '-' + n; n++; }
  return id;
}

// baseDoc 을 멀티씬 권위 형태로 정규화(scenes[] 보장 + id/name 위생화). 반환 baseDoc(동일 참조 변형).
function normalizeBaseDoc(doc) {
  const d = (doc && typeof doc === 'object') ? doc : {};
  let scenes = Array.isArray(d.scenes) ? d.scenes.filter((s) => s && typeof s === 'object') : [];
  if (scenes.length === 0) {
    // raw 픽스처/빈 문서 — 최상위 entities/walls 를 단일 'main' 씬으로 승격.
    scenes = [{
      id: 'main',
      systems: (d.systems && typeof d.systems === 'object') ? d.systems : {},
      entities: Array.isArray(d.entities) ? d.entities : []
    }];
  }
  const used = new Set();
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const base = sanitizeSceneId(sc.id, 'scene-' + (i + 1));
    const id = uniqueSceneId(base, used);
    used.add(id);
    sc.id = id;
    sc.name = sanitizeSceneName(sc.name, '씬 ' + (i + 1));
    if (!Array.isArray(sc.entities)) sc.entities = [];
  }
  d.scenes = scenes;
  return d;
}

sceneDoc = normalizeBaseDoc(sceneDoc);

// ── 라이브 상태(단일 진실) ────────────────────────────────────────────────────
const state = {
  baseDoc: sceneDoc,             // wgf-scene@1 래퍼 + 모든 scenes[] 권위 저장소(E1)
  activeSceneId: sceneDoc.scenes[0].id,   // 활성 씬 id(state.world 가 로드한 씬)
  world: SceneKit.load(sceneDoc, { mode: 'edit', sceneId: sceneDoc.scenes[0].id }),
  mode: 'edit',                  // 'edit' | 'play' (권위 모드, §4.9)
  seq: 0,                        // 현재 시퀀스(마지막으로 적용된 델타의 id)
  log: [],                       // 커맨드 로그 [{seq, kind, command, undoDelta}] — SSE 복구용
  undoStack: [],                 // [{cmd, undoDelta}]
  redoStack: []
};

// 활성 씬 슬롯(baseDoc.scenes 중 activeSceneId) 반환. 없으면 첫 씬으로 폴백.
function activeSceneSlot() {
  const scenes = state.baseDoc.scenes;
  for (let i = 0; i < scenes.length; i++) {
    if (String(scenes[i].id) === String(state.activeSceneId)) return scenes[i];
  }
  return scenes[0];
}

// 현재 live world 의 serialize 결과(entities/walls/assets)를 활성 씬 슬롯에 써넣는다.
// 다른 씬 슬롯은 그대로 보존(멀티씬 권위 유지). 커맨드 적용·스냅샷·씬전환 직전 동기화 지점.
//  - entities/walls 는 활성 씬에, assets 는 최상위 baseDoc.assets 에 보존(현 구조: 최상위 공유 우선).
//  - scene.systems 는 보존(live world.meta.systems 가 있으면 갱신, 없으면 기존 슬롯 값 유지).
function flushWorldToActiveScene() {
  const serialized = SceneKit.serialize(state.world);
  const slot = activeSceneSlot();
  slot.entities = serialized.entities || [];
  if (serialized.walls && serialized.walls.length) slot.walls = serialized.walls;
  else if ('walls' in slot) delete slot.walls;
  // systems: world.meta.systems(load 시 scene.systems 를 meta.systems 로 보존) 우선.
  if (state.world.meta && state.world.meta.systems && typeof state.world.meta.systems === 'object') {
    slot.systems = state.world.meta.systems;
  }
  // assets 는 최상위 공유 슬롯에 보존(scene.assets 보다 우선 — 기존 동작 유지).
  if (serialized.assets && typeof serialized.assets === 'object') state.baseDoc.assets = serialized.assets;
  // meta 도 최상위에 보존(viewport 등 — 활성 씬 편집 중 갱신분 반영).
  if (serialized.meta && Object.keys(serialized.meta).length) {
    // systems 키는 scene 단위라 최상위 meta 에서 제외(슬롯에 이미 반영).
    const m = Object.assign({}, serialized.meta);
    delete m.systems;
    state.baseDoc.meta = m;
  }
}

// 활성 씬을 SceneKit.load 로 다시 적재(state.world 교체). 씬전환·삭제 후 호출.
//  undo/redo 스택은 씬 경계를 넘지 않으므로 초기화(문서화된 동작).
function reloadActiveWorld() {
  state.world = SceneKit.load(state.baseDoc, { mode: state.mode, sceneId: state.activeSceneId });
  state.undoStack.length = 0;
  state.redoStack.length = 0;
}

// 씬 목록 요약 [{id,name,entityCount}] — 활성 씬은 라이브 world, 비활성은 baseDoc 슬롯 기준.
function sceneSummaries() {
  return state.baseDoc.scenes.map((s) => {
    const isActive = String(s.id) === String(state.activeSceneId);
    const entityCount = isActive
      ? state.world.entities.length
      : (Array.isArray(s.entities) ? s.entities.length : 0);
    return { id: String(s.id), name: typeof s.name === 'string' ? s.name : String(s.id), entityCount };
  });
}

// 'scene' 델타 발행(씬 목록/활성 변경) — seq 부여 + 로그 적재 + SSE 브로드캐스트.
//  씬 커맨드(엔티티 적용)가 아니라 구조 변경 신호이므로 'scene' 타입으로 따로 보낸다.
//  에디터는 이 델타를 받으면 /api/scene·/api/scene/list 를 재요청해 동기화한다.
function broadcastScene(op, payload) {
  state.seq += 1;
  const command = Object.assign({ op }, payload || {});
  const entry = { seq: state.seq, kind: 'scene', command, undoDelta: null };
  state.log.push(entry);
  if (state.log.length > UNDO_LIMIT) state.log.shift();
  broadcast(Object.assign({ type: 'scene', seq: state.seq }, command));
  return state.seq;
}

// ── SSE 구독자 ────────────────────────────────────────────────────────────────
// 각 구독자: {res, buffer:[], alive}. buffer 는 백프레셔 상한 초과 시 비우고 resync 발행.
const subscribers = new Set();

// ── scene_screenshot 캡처 대기(브라우저 뷰포트 왕복, 2B) ───────────────────────
// `GET /api/screenshot/capture` 가 requestId 를 만들어 SSE `screenshot-request` 이벤트로
// 연결된 브라우저(에디터 뷰포트)에 캡처를 요청하고, 여기에 {resolve,timer} 를 등록한다.
// 브라우저가 `POST /api/screenshot {requestId,dataUrl}` 로 PNG 를 회신하면 그 entry 를
// resolve 해 도구 응답으로 돌려준다. 타임아웃/무구독자면 "뷰포트 없음" 헤드리스 에러.
//  - 키 = requestId(crypto.randomUUID 또는 randomBytes hex — 추측 불가).
//  - 보안: requestId 는 서버가 발급하므로 임의 POST 가 pending 을 가로채려면 정확히
//    일치하는 id 를 알아야 한다(+토큰·Origin 가드는 /api/ 전 구간 동일 적용).
const pendingScreenshots = new Map();   // requestId → { resolve, timer }

// ── P3 역채널 상태(영속 챗 큐 + 하트비트) ─────────────────────────────────────
// chat: 에디터 → Claude 역방향. messages = 미처리 사용자 메시지 큐(FIFO, 파일 영속).
//   재기동 후 CHAT_FILE 에서 복원 → 미처리 메시지 무손실(§5 P3 게이트).
//   nextId = 메시지 id 단조 증가(영속). pollers = editor_next_message long-poll 대기자.
//   lastHeartbeat = Claude 루프의 마지막 하트비트 시각(ms, 0=아직 없음).
const chat = {
  messages: [],          // [{id, text, at}] — 미처리(디큐 전)만 보관
  nextId: 1,
  pollers: [],           // [{res, timer}] — editor_next_message long-poll 대기 응답
  lastHeartbeat: 0       // Date.now() 기준 — 토큰·씬 상태와 무관(시각 측정 예외)
};

// 챗 큐 파일에서 복원(재기동 무손실). 손상/부재 시 빈 큐로 시작.
function loadChatQueue() {
  try {
    const raw = fs.readFileSync(CHAT_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.messages)) {
      chat.messages = data.messages.filter((m) => m && typeof m.text === 'string');
      chat.nextId = (typeof data.nextId === 'number' && data.nextId > 0)
        ? data.nextId
        : (chat.messages.reduce((mx, m) => Math.max(mx, m.id || 0), 0) + 1);
    }
  } catch (e) { /* 부재/손상 — 빈 큐로 시작 */ }
}

// 챗 큐를 파일에 영속(원자적 쓰기 — tmp 후 rename, 부분 쓰기로 인한 손상 방지).
// 챗 큐는 사용자 메시지(잠재적 민감 텍스트)를 담으므로 0o600(소유자 rw only) 으로 격리한다.
// tmp 부터 0o600 으로 쓰고, rename 후에도 명시적 chmod 로 권한 보장(rename 은 권한 보존하나
// 안전망). Windows 등 POSIX 외에서 chmod 는 read-only 비트만 반영돼 무해 → 실패 무시(보안 §6).
function persistChatQueue() {
  try {
    // 보관 디렉터리도 소유자 전용(0o700) — 다른 로컬 사용자의 traverse·메타데이터 열람 차단(보안 리뷰 MED-1).
    fs.mkdirSync(path.dirname(CHAT_FILE), { recursive: true, mode: 0o700 });
    try { fs.chmodSync(path.dirname(CHAT_FILE), 0o700); } catch (e) { /* POSIX 외 무시 */ }
    const tmp = CHAT_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ messages: chat.messages, nextId: chat.nextId }), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, CHAT_FILE);
    try { fs.chmodSync(CHAT_FILE, 0o600); } catch (e) { /* POSIX 외 무시 */ }
  } catch (e) {
    process.stderr.write(`[wgf-bridge] 챗 큐 영속 실패: ${String(e)}\n`);
  }
}

// 사용자 메시지 enqueue(에디터 → Claude). 영속 후, 대기 중 poller 가 있으면 즉시 디큐 전달.
function enqueueChat(text) {
  const msg = { id: chat.nextId++, text: String(text), at: Date.now() };
  chat.messages.push(msg);
  persistChatQueue();
  drainPollers();
  return msg;
}

// 대기 중 long-poll 응답에 미처리 메시지를 전달(있으면 디큐). FIFO 1건씩.
function drainPollers() {
  while (chat.pollers.length > 0 && chat.messages.length > 0) {
    const poller = chat.pollers.shift();
    if (poller.timer) clearTimeout(poller.timer);
    const msg = dequeueChat();
    try { sendJSON(poller.res, 200, { ok: true, message: msg }); } catch (e) {}
  }
}

// 미처리 메시지 1건 디큐(영속 반영) — editor_next_message 가 소비.
function dequeueChat() {
  if (chat.messages.length === 0) return null;
  const msg = chat.messages.shift();
  persistChatQueue();
  return msg;
}

// 하트비트 기록(Claude 루프가 살아있음). editor_next_message 호출 자체도 하트비트로 간주.
function recordHeartbeat() {
  chat.lastHeartbeat = Date.now();
}

// 현재 연결 상태(설계서 §4.7): disconnected/waiting/connected.
//  - lastHeartbeat=0(아직 한 번도 없음) 또는 임계 초과 → disconnected.
//  - 임계 내 + 미처리 메시지 있음 → waiting(Claude 가 아직 안 가져감).
//  - 임계 내 + 미처리 없음 → connected.
function connectionStatus() {
  const now = Date.now();
  if (chat.lastHeartbeat === 0 || (now - chat.lastHeartbeat) > HEARTBEAT_TIMEOUT_MS) {
    return 'disconnected';
  }
  return chat.messages.length > 0 ? 'waiting' : 'connected';
}

loadChatQueue();

// ── 커맨드 적용(직렬 apply 큐 — 전순서, §7) ──────────────────────────────────
// Node 단일 스레드 + 동기 applyCommand 이므로 호출 자체가 전순서. 시퀀스 부여 후 브로드캐스트.
function applyAndBroadcast(kind, command, undoDelta) {
  state.seq += 1;
  const entry = { seq: state.seq, kind, command, undoDelta };
  state.log.push(entry);
  if (state.log.length > UNDO_LIMIT) state.log.shift();   // 로그 상한(§7)
  broadcast({ type: kind, seq: state.seq, command });
  return state.seq;
}

// edit 커맨드(GUI/Claude). Play 모드면 거부 호출자가 처리. undoDelta 를 Undo 스택에 적재.
// 반환 {seq, newId} — addEntity 면 newId = 브리지가 발급한 확정 id(remote 클라가 즉시 회수).
function pushCommand(command) {
  const undoDelta = SceneKit.applyCommand(state.world, command);
  // addEntity 의 새 id 를 커맨드에 박아 redo/미러 재적용 시 같은 id 가 나오게(§ editorController 패턴).
  let stored = command;
  let newId = null;
  if (command.type === 'addEntity' && undoDelta && undoDelta.type === 'removeEntity' && undoDelta.id != null) {
    newId = undoDelta.id;
    const ent = Object.assign({}, command.entity, { id: newId });
    stored = Object.assign({}, command, { entity: ent });
  }
  state.undoStack.push({ cmd: stored, undoDelta });
  if (state.undoStack.length > UNDO_LIMIT) state.undoStack.shift();
  state.redoStack.length = 0;
  // 미러 동기는 stored(확정 id 포함) 를 브로드캐스트해야 클라가 같은 id 로 applyCommand.
  const seq = applyAndBroadcast('command', stored, undoDelta);
  return { seq, newId };
}

function doUndo() {
  if (state.undoStack.length === 0) return null;
  const entry = state.undoStack.pop();
  SceneKit.applyUndo(state.world, entry.undoDelta);
  state.redoStack.push(entry);
  if (state.redoStack.length > UNDO_LIMIT) state.redoStack.shift();
  // 미러도 같은 undoDelta 를 applyUndo 해야 동일 결과 → 델타에 undoDelta 동봉.
  state.seq += 1;
  const logEntry = { seq: state.seq, kind: 'undo', command: null, undoDelta: entry.undoDelta };
  state.log.push(logEntry);
  if (state.log.length > UNDO_LIMIT) state.log.shift();
  broadcast({ type: 'undo', seq: state.seq, undoDelta: entry.undoDelta });
  return state.seq;
}

function doRedo() {
  if (state.redoStack.length === 0) return null;
  const entry = state.redoStack.pop();
  const newUndo = SceneKit.applyCommand(state.world, entry.cmd);
  state.undoStack.push({ cmd: entry.cmd, undoDelta: newUndo });
  if (state.undoStack.length > UNDO_LIMIT) state.undoStack.shift();
  // 미러는 원래 커맨드 재적용 → command 델타로 동봉(미러가 applyCommand).
  return applyAndBroadcast('command', entry.cmd, newUndo);
}

// ── SSE 브로드캐스트 + 백프레셔 ───────────────────────────────────────────────
function formatEvent(evt) {
  // 일반 델타: id:=seq + data. resync 는 event: resync 로 따로.
  return `id: ${evt.seq}\ndata: ${JSON.stringify(evt)}\n\n`;
}

function broadcast(evt) {
  const frame = formatEvent(evt);
  for (const sub of subscribers) {
    if (!sub.alive) continue;
    sendToSub(sub, frame);
  }
}

// 구독자에게 1프레임 전송. 백프레셔 모델:
//  - res.write() 가 false 를 반환하면 소켓 송신 버퍼가 highWaterMark 초과(느린 소비자 신호).
//    그 시점부터 "backpressured" 상태로, drain 이벤트가 오기 전까지 보내려는 프레임을 모두
//    pending 으로 누적한다(Node 가 내부 버퍼에 쌓으므로 — 무한 적체 위험).
//  - pending 이 SSE_BUFFER_LIMIT 를 넘으면 적체를 멈추고(이후 프레임 드롭) resync 1회 발행.
//    클라는 resync 를 받으면 /api/scene 으로 재동기(무손실 — 스냅샷이 최신 진실).
function sendToSub(sub, frame) {
  if (sub.resyncing) return;             // 이미 resync 발행 후 — /api/scene 재요청 대기(추가 프레임 드롭)
  // 백프레셔 신호 = write() false 반환(OS 소켓) 또는 Node 스트림 내부 버퍼 바이트 누적.
  // 둘 중 하나라도 상한 초과면 적체로 간주(writableLength 는 클라 미수신 시 결정적 증가).
  const buffered = (typeof sub.res.writableLength === 'number') ? sub.res.writableLength : 0;
  if (sub.backpressured) {
    sub.pending += 1;
    if (sub.pending > SSE_BUFFER_LIMIT || buffered > SSE_BYTES_LIMIT) { triggerResync(sub); return; }
    try { sub.res.write(frame); } catch (e) { sub.alive = false; }
    return;
  }
  let flushed;
  try { flushed = sub.res.write(frame); }
  catch (e) { sub.alive = false; return; }
  const bufferedAfter = (typeof sub.res.writableLength === 'number') ? sub.res.writableLength : 0;
  if (!flushed || bufferedAfter > SSE_BYTES_LIMIT || SSE_FORCE_BP) {
    // 백프레셔 진입(이 프레임은 이미 내부 버퍼에 들어갔다 — pending=1 로 카운트).
    sub.backpressured = true;
    sub.pending = 1;
  }
}

function triggerResync(sub) {
  if (sub.resyncing) return;
  sub.resyncing = true;
  sub.backpressured = false;
  sub.pending = 0;
  try {
    // resync 이벤트(id 없음 — 시퀀스에서 빼지 않음). 클라가 받으면 /api/scene 재요청.
    sub.res.write(`event: resync\ndata: ${JSON.stringify({ type: 'resync', seq: state.seq })}\n\n`);
  } catch (e) { sub.alive = false; }
}

// drain 시 백프레셔 해제(소비자 따라잡음). resync 후에도 drain 되면 정상 복귀.
function attachDrain(sub) {
  sub.res.on('drain', () => {
    sub.backpressured = false;
    sub.pending = 0;
    sub.resyncing = false;
  });
}

// 현재 살아있는 SSE 구독자 수(브라우저 뷰포트 연결 추정 — scene_screenshot 헤드리스 판정).
function liveSubscriberCount() {
  let n = 0;
  for (const sub of subscribers) { if (sub.alive) n += 1; }
  return n;
}

// ── scene_screenshot 캡처 요청(브라우저 뷰포트 왕복, 2B) ───────────────────────
// requestId 발급 → 모든 SSE 구독자에 `event: screenshot-request` 명시 이벤트 전송
//  (seq 미소비 — resync 와 동일하게 시퀀스에서 빼지 않는다, 씬 델타 아님) →
//  pendingScreenshots 에 {resolve,timer} 등록. 브라우저가 toDataURL PNG 를 회신하면
//  resolveScreenshot 이 resolve, 미회신이면 timer 가 {ok:false,headless:true} 로 resolve.
//  반환은 Promise(첫 회신/타임아웃 중 먼저). 구독자 0 이면 즉시 헤드리스(대기 없음).
function requestScreenshot() {
  if (liveSubscriberCount() === 0) {
    return Promise.resolve({ ok: false, headless: true, reason: 'no-subscriber' });
  }
  const requestId = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (pendingScreenshots.has(requestId)) {
        pendingScreenshots.delete(requestId);
        resolve({ ok: false, headless: true, reason: 'timeout' });
      }
    }, SCREENSHOT_TIMEOUT_MS);
    pendingScreenshots.set(requestId, { resolve, timer });
    // 명시 이벤트(event: screenshot-request) — onmessage 가 아니라 addEventListener 로 받음.
    //  id 없음(시퀀스 미소비). 데이터에 requestId.
    const frame = `event: screenshot-request\ndata: ${JSON.stringify({ type: 'screenshot-request', requestId })}\n\n`;
    let delivered = false;
    for (const sub of subscribers) {
      if (!sub.alive) continue;
      try { sub.res.write(frame); delivered = true; } catch (e) { sub.alive = false; }
    }
    // 쓰기 직전 모든 구독자가 죽어 전송 0건이면 즉시 헤드리스(타임아웃 대기 없이 정리).
    if (!delivered) {
      clearTimeout(timer);
      pendingScreenshots.delete(requestId);
      resolve({ ok: false, headless: true, reason: 'no-subscriber' });
    }
  });
}

// 브라우저 회신 PNG 를 해당 pending 캡처에 연결해 resolve. 매칭 없으면 false.
function resolveScreenshot(requestId, payload) {
  const entry = pendingScreenshots.get(requestId);
  if (!entry) return false;
  pendingScreenshots.delete(requestId);
  clearTimeout(entry.timer);
  entry.resolve(Object.assign({ ok: true }, payload));
  return true;
}

// Last-Event-ID 이후 누락 델타 재전송(무손실 복구, §8 위험8).
// [수정] 로그 상한(UNDO_LIMIT) 에 의해 이미 잘린 구간을 요청받으면 resync 발행.
//  - since+1 < oldest: 로그에 없는 seq 를 요청 → 갭 있음 → resync.
//  - since === state.seq: 갭 없음(완전 최신) → 재전송 0건이 정상, resync 불필요.
//  - off-by-one 주의: since+1 < oldest 만 resync(since+1 === oldest 는 갭 없이 연속).
function replayMissed(sub, lastId) {
  const since = parseInt(lastId, 10);
  if (!isFinite(since)) return;
  // 갭 검사: 로그에 보관된 가장 오래된 seq 보다 since+1 이 앞서면 복구 불가 → resync.
  const oldest = state.log.length ? state.log[0].seq : (state.seq + 1);
  if (since + 1 < oldest) {
    triggerResync(sub);
    return;
  }
  for (const entry of state.log) {
    if (entry.seq <= since) continue;
    let evt;
    if (entry.kind === 'undo') {
      evt = { type: 'undo', seq: entry.seq, undoDelta: entry.undoDelta };
    } else if (entry.kind === 'chat') {
      // [P3] 챗 델타는 'chat' 타입으로 재전송 — 라이브 브로드캐스트와 동일(씬 커맨드 아님).
      const c = entry.command || {};
      evt = { type: 'chat', seq: entry.seq, role: c.role, id: c.id, text: c.text, replyTo: c.replyTo, at: c.at };
    } else if (entry.kind === 'mode') {
      // [수정] mode 델타는 'mode' 타입으로 재전송 — 라이브 브로드캐스트(§4.9)와 동일.
      //  재연결 클라가 applyCommand({mode:'play'}) 대신 올바른 mode 이벤트로 처리하게.
      evt = { type: 'mode', seq: entry.seq, mode: entry.command.mode };
    } else if (entry.kind === 'asset') {
      // [P4] 에셋 델타는 'asset' 타입으로 재전송 — 라이브 브로드캐스트와 동일(씬 커맨드 아님).
      const c = entry.command || {};
      evt = { type: 'asset', seq: entry.seq, op: c.op, asset: c.asset };
    } else if (entry.kind === 'scene') {
      // [E1] 씬 구조 델타(add/rename/remove/switch)는 'scene' 타입으로 재전송 — 라이브와 동일.
      //  에디터는 이 델타를 받으면 /api/scene·/api/scene/list 를 재요청해 동기화한다.
      evt = Object.assign({ type: 'scene', seq: entry.seq }, entry.command || {});
    } else {
      evt = { type: 'command', seq: entry.seq, command: entry.command };
    }
    sendToSub(sub, formatEvent(evt));
  }
}

// ── 보안 헬퍼 ─────────────────────────────────────────────────────────────────
// 상수시간 토큰 비교(타이밍 사이드채널 차단, 보안 §6).
//  - 단순 `a === TOKEN` 은 첫 불일치 바이트에서 조기 반환하므로 비교 시간이 일치 길이에
//    비례한다 → 공격자가 응답 지연으로 토큰을 한 바이트씩 추측 가능. crypto.timingSafeEqual
//    은 길이가 같은 두 Buffer 를 항상 끝까지 비교해 시간 차로 정보가 새지 않게 한다.
//  - timingSafeEqual 은 길이가 다르면 throw 하므로, 먼저 Buffer 길이를 비교해 다르면 즉시
//    false(throw 금지 — 잘못된 길이의 토큰이 와도 브리지가 죽지 않아야 함).
//  - a 가 비문자열(undefined 헤더·미존재 쿼리 등)이면 안전하게 false.
function safeEqual(a, TOKEN) {
  if (typeof a !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(TOKEN);
  if (x.length !== y.length) return false;   // 길이 불일치 — 즉시 false(timingSafeEqual throw 회피)
  return crypto.timingSafeEqual(x, y);
}

// /api/* 토큰 검사. EventSource 는 헤더 못 넣으므로 ?token= 쿼리도 허용.
// 헤더·쿼리 중 하나라도 TOKEN 과 상수시간 일치하면 통과(safeEqual 로 타이밍 사이드채널 차단).
function checkToken(req, u) {
  const hdr = req.headers['x-wgf-token'];
  const q = u.searchParams.get('token');
  return safeEqual(hdr, TOKEN) || safeEqual(q, TOKEN);
}

// Origin 검사 — 동일 호스트(127.0.0.1/localhost) origin 만 허용. Origin 없으면(same-origin
// fetch·서버측 클라) 허용(브라우저는 cross-origin 시 항상 Origin 부착).
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const o = new URL(origin);
    return (o.hostname === '127.0.0.1' || o.hostname === 'localhost');
  } catch (e) { return false; }
}

// 정적 서빙(traversal 가드 — serve.mjs 동등). rel = URL 경로(REPO_ROOT 기준).
function serveStatic(res, rel) {
  if (rel === '' || rel === '/') rel = '/editor/ui/index.html';
  let decoded;
  try { decoded = decodeURIComponent(rel); }
  catch { res.writeHead(400); res.end('bad request'); return; }

  const segs = decoded.split(/[\\/]+/).filter(Boolean);
  if (segs.some((s) => s.startsWith('.'))) {   // .git·.env·.. 차단
    res.writeHead(403); res.end('forbidden'); return;
  }

  let filePath = path.normalize(path.join(REPO_ROOT, decoded));
  if (filePath !== REPO_ROOT && !filePath.startsWith(REPO_ROOT + path.sep)) {
    res.writeHead(403); res.end('forbidden'); return;
  }

  fs.stat(filePath, (statErr, st) => {
    if (statErr) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found: ' + rel); return; }
    if (st.isDirectory()) filePath = path.join(filePath, 'index.html');
    // editor/ui/index.html 은 토큰 주입(브리지 부트스트랩) 위해 가공해 서빙.
    if (filePath === path.join(REPO_ROOT, 'editor', 'ui', 'index.html')) {
      serveIndexWithToken(res, filePath);
      return;
    }
    fs.readFile(filePath, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found: ' + rel); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    });
  });
}

// index.html 에 window.__WGF_BRIDGE__ 스크립트를 <head> 직후 삽입해 토큰·base 주입.
// 이게 있으면 UI 가 remote transport 로 동작(없으면 local 폴백).
function serveIndexWithToken(res, filePath) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const inject = `<script>window.__WGF_BRIDGE__=${JSON.stringify({ token: TOKEN, base: '' })};</script>`;
    let out;
    if (html.includes('</head>')) out = html.replace('</head>', inject + '\n</head>');
    else out = inject + '\n' + html;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(out);
  });
}

// JSON 응답 헬퍼.
function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

// POST 본문 수집(상한 가드).
function readBody(req, cb) {
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 5_000_000) req.destroy(); });
  req.on('end', () => cb(body));
}

// 현재 스냅샷(serialize + 단일 진실 시퀀스). wgf-scene@1 래퍼로 감싸 라운드트립 정합.
function sceneSnapshot() {
  const serialized = SceneKit.serialize(state.world);
  return { scene: wrapForSnapshot(serialized), seq: state.seq, mode: state.mode };
}

// 스냅샷 래핑(E1 멀티씬): baseDoc 의 모든 scenes[] 를 보존하고, 활성 씬 슬롯만 live world
// 의 serialize 결과로 갱신한다. 비활성 씬은 baseDoc 의 기존 내용(entities/systems/walls) 그대로.
//  - 활성 씬 슬롯 = activeSceneId 와 id 일치 슬롯(없으면 첫 슬롯).
//  - 활성 슬롯 entities/walls/systems 는 serialized(라이브) 기준으로 갱신, 비활성은 보존.
//  - assets 는 최상위 공유(scene.assets 보다 우선) — 기존 동작 보존.
//  - 최상위 activeSceneId 필드 포함(에디터 UI 가 읽음).
//  - 단일 씬이면 기존과 동일 모양(scenes:[{id,systems,entities}]) 유지 → export/round-trip 호환.
function wrapForSnapshot(serialized) {
  const base = (state.baseDoc && typeof state.baseDoc === 'object') ? state.baseDoc : {};
  const baseScenes = Array.isArray(base.scenes) && base.scenes.length ? base.scenes : [{ id: 'main', systems: {}, entities: [] }];
  const activeId = String(state.activeSceneId != null ? state.activeSceneId : (baseScenes[0] && baseScenes[0].id));

  const scenes = baseScenes.map((sc) => {
    const s = (sc && typeof sc === 'object') ? sc : {};
    const isActive = String(s.id) === activeId;
    const out = {
      id: s.id != null ? String(s.id) : 'main',
      // systems: 활성 씬은 live world.meta.systems 우선(편집 중 갱신분), 비활성은 보존.
      systems: isActive
        ? ((state.world.meta && state.world.meta.systems && typeof state.world.meta.systems === 'object')
            ? state.world.meta.systems
            : (s.systems || {}))
        : (s.systems || {}),
      // entities: 활성 씬은 live serialized, 비활성은 baseDoc 보존.
      entities: isActive ? (serialized.entities || []) : (Array.isArray(s.entities) ? s.entities : [])
    };
    // walls: 활성 씬은 live(있을 때만), 비활성은 보존(있을 때만).
    if (isActive) {
      if (serialized.walls && serialized.walls.length) out.walls = serialized.walls;
    } else if (Array.isArray(s.walls) && s.walls.length) {
      out.walls = s.walls;
    }
    return out;
  });

  return {
    format: base.format || 'wgf-scene@1',
    slug: base.slug || 'scene',
    activeSceneId: activeId,
    meta: serialized.meta && Object.keys(serialized.meta).length ? serialized.meta : (base.meta || {}),
    assets: serialized.assets || base.assets || {},
    walls: base.walls || [],
    scenes,
    dataLayers: base.dataLayers || {}
  };
}

// ── P4 에셋(assets.sprites) — 추가/조회 ───────────────────────────────────────
// world.assets 는 SceneKit.load 가 노출하는 mutable 객체이며 serialize 가 보존한다.
// 에셋 추가는 씬 트랜스폼/엔티티가 아니라 자산 def 슬롯이므로 applyCommand(엔티티 전용)
// 대상이 아니다 → world.assets.sprites 를 직접 갱신하고 'asset' 델타로 브로드캐스트한다.
// (결정론 불변식: 자산 추가는 엔티티 상태 해시에 영향이 없고, 엔티티가 그 id 를 ref 할 때
//  비로소 Sprite 컴포넌트로 들어가며 그 경로는 applyCommand 를 거친다.)
function listAssets() {
  const a = (state.world && state.world.assets && typeof state.world.assets === 'object') ? state.world.assets : {};
  return { sprites: Array.isArray(a.sprites) ? a.sprites : [] };
}

// 비균일 명시 영역(frames[]) 위생화 — 슬라이서 free-mode 산출물({name?,x,y,w,h}).
//  각 원소가 정수 x/y≥0, w/h>0 일 때만 채택. 전부 | 0 정수강제(인젝션 표면 0). 길이 상한 1024.
//  유효 항목이 하나도 없으면 null(미설정). frameConfig 와 공존 가능 — 렌더는 frames 우선.
const MAX_SHEET_FRAMES = 1024;
function sanitizeFramesArray(frames) {
  if (!Array.isArray(frames)) return null;
  const out = [];
  for (const f of frames) {
    if (out.length >= MAX_SHEET_FRAMES) break;
    if (!f || typeof f !== 'object') continue;
    if (typeof f.x !== 'number' || !(f.x >= 0) || typeof f.y !== 'number' || !(f.y >= 0)) continue;
    if (typeof f.w !== 'number' || !(f.w > 0) || typeof f.h !== 'number' || !(f.h > 0)) continue;
    const item = { x: f.x | 0, y: f.y | 0, w: f.w | 0, h: f.h | 0 };
    if (typeof f.name === 'string') item.name = f.name.slice(0, 64);
    out.push(item);
  }
  return out.length ? out : null;
}

// 스프라이트시트 프레임 메타(frameConfig/frames/frame) 위생화 — cc0·local 에셋에만 적용.
//  frameWidth/frameHeight 가 양수일 때만 frameConfig 채택, margin/spacing 은 음수 아닐 때만.
//  frames[] 는 비균일 명시 영역(free-mode) — 있으면 저장(렌더는 frames 우선). frame 은 0 이상 정수만.
//  전부 정수로 강제(| 0) → 인젝션 표면 0. 시트가 아니면 미설정(전체 이미지).
function sanitizeFrameMeta(asset, raw) {
  const fc = raw && raw.frameConfig;
  if (fc && typeof fc === 'object' &&
      typeof fc.frameWidth === 'number' && fc.frameWidth > 0 &&
      typeof fc.frameHeight === 'number' && fc.frameHeight > 0) {
    const out = { frameWidth: fc.frameWidth | 0, frameHeight: fc.frameHeight | 0 };
    if (typeof fc.margin === 'number' && fc.margin >= 0) out.margin = fc.margin | 0;
    if (typeof fc.spacing === 'number' && fc.spacing >= 0) out.spacing = fc.spacing | 0;
    asset.frameConfig = out;
  }
  const fr = sanitizeFramesArray(raw && raw.frames);
  if (fr) asset.frames = fr;
  if (typeof raw.frame === 'number' && raw.frame >= 0) asset.frame = raw.frame | 0;
}

// 에셋 1건 추가. kind: 'procedural'|'cc0'|'local'. 검증 후 sprites 에 push.
// 반환 {ok, asset} 또는 {ok:false, code, error}.
function addAsset(kind, raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, code: 400, error: 'asset 객체 필요' };
  const id = raw.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9._\-]{1,64}$/.test(id)) {
    return { ok: false, code: 400, error: 'asset.id 형식 위반(영숫자._- 1~64자): ' + JSON.stringify(id) };
  }
  if (!state.world.assets || typeof state.world.assets !== 'object') state.world.assets = {};
  if (!Array.isArray(state.world.assets.sprites)) state.world.assets.sprites = [];
  const sprites = state.world.assets.sprites;
  if (sprites.some((s) => s && s.id === id)) {
    return { ok: false, code: 409, error: '중복 asset id: ' + id };
  }
  let asset;
  if (kind === 'procedural') {
    asset = {
      id,
      source: 'procedural',
      desc: typeof raw.desc === 'string' ? raw.desc.slice(0, 512) : '',
      w: (typeof raw.w === 'number' && raw.w > 0) ? (raw.w | 0) : 16,
      h: (typeof raw.h === 'number' && raw.h > 0) ? (raw.h | 0) : 16
    };
    // PixelForge/VectorForge def 슬롯(선택) — 있으면 보존(베이크는 어댑터/export 책임).
    if (raw.def && typeof raw.def === 'object') asset.def = raw.def;
  } else if (kind === 'cc0') {
    if (typeof raw.url !== 'string' || raw.url.length === 0) {
      return { ok: false, code: 400, error: 'cc0 asset 은 url 필수' };
    }
    // 위험 스탬(javascript:·data:·file:·vbscript:) 차단 — 저장형 XSS/로컬 참조 방지.
    // http(s): 또는 상대경로만 허용.
    {
      const urlLower = raw.url.trimStart().toLowerCase();
      const dangerSchemes = ['javascript:', 'data:', 'file:', 'vbscript:'];
      if (dangerSchemes.some((s) => urlLower.startsWith(s))) {
        return { ok: false, code: 400, error: 'cc0 url 위험 스탬 거부(http(s)·상대경로만 허용): ' + JSON.stringify(raw.url.slice(0, 64)) };
      }
    }
    asset = {
      id,
      source: 'cc0',
      url: raw.url.slice(0, 2048),
      license: typeof raw.license === 'string' ? raw.license.slice(0, 128) : 'CC0-1.0',
      credit: typeof raw.credit === 'string' ? raw.credit.slice(0, 256) : '',
      desc: typeof raw.desc === 'string' ? raw.desc.slice(0, 512) : ''
    };
    if (typeof raw.w === 'number' && raw.w > 0) asset.w = raw.w | 0;
    if (typeof raw.h === 'number' && raw.h > 0) asset.h = raw.h | 0;
    sanitizeFrameMeta(asset, raw);
  } else if (kind === 'local') {
    // 로컬 vendored 에셋(설계 §2). url 은 repo-root 상대경로(games/ 하위)만 허용.
    // resolveScopedPath('games') 로 이중검증 + 실제 파일 존재 확인.
    if (typeof raw.url !== 'string' || raw.url.length === 0) {
      return { ok: false, code: 400, error: 'local asset 은 url 필수' };
    }
    // 절대경로·위험스킴·http(s) 거부 — 상대경로만.
    {
      const urlLower = raw.url.trimStart().toLowerCase();
      const dangerSchemes = ['javascript:', 'data:', 'file:', 'vbscript:', 'http:', 'https:'];
      if (dangerSchemes.some((s) => urlLower.startsWith(s))) {
        return { ok: false, code: 400, error: 'local url 위험/외부 스킴 거부(games/ 상대경로만): ' + JSON.stringify(raw.url.slice(0, 64)) };
      }
    }
    const absUrl = resolveScopedPath(raw.url, 'games');
    if (!absUrl) {
      return { ok: false, code: 400, error: 'local url games/ 범위 밖/traversal 거부: ' + JSON.stringify(raw.url.slice(0, 128)) };
    }
    let exists = false;
    try { exists = fs.statSync(absUrl).isFile(); } catch (e) { exists = false; }
    if (!exists) {
      return { ok: false, code: 400, error: 'local url 파일 없음: ' + JSON.stringify(raw.url.slice(0, 128)) };
    }
    asset = {
      id,
      source: 'local',
      url: raw.url.slice(0, 2048),
      license: typeof raw.license === 'string' ? raw.license.slice(0, 128) : 'unknown',
      credit: typeof raw.credit === 'string' ? raw.credit.slice(0, 256) : '',
      attribution: typeof raw.attribution === 'string' ? raw.attribution.slice(0, 256) : '',
      desc: typeof raw.desc === 'string' ? raw.desc.slice(0, 512) : ''
    };
    if (typeof raw.w === 'number' && raw.w > 0) asset.w = raw.w | 0;
    if (typeof raw.h === 'number' && raw.h > 0) asset.h = raw.h | 0;
    sanitizeFrameMeta(asset, raw);
    if (typeof raw.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(raw.sha256)) asset.sha256 = raw.sha256.toLowerCase();
    // origin: 원본 Unity 폴더(절대경로 표시용) + 폴더내 상대경로(메타데이터, 표시 전용).
    if (raw.origin && typeof raw.origin === 'object') {
      const o = {};
      if (typeof raw.origin.folder === 'string') o.folder = raw.origin.folder.slice(0, 1024);
      if (typeof raw.origin.relPath === 'string') o.relPath = raw.origin.relPath.slice(0, 1024);
      if (Object.keys(o).length) asset.origin = o;
    }
    // attested: warn 항목을 사용자가 통과시킨 경우에만(권리 보유 선언 감사 기록).
    if (raw.attested && typeof raw.attested === 'object' &&
        typeof raw.attested.owner === 'string' && raw.attested.owner.length > 0) {
      asset.attested = {
        owner: raw.attested.owner.slice(0, 256),
        declaredLicense: typeof raw.attested.declaredLicense === 'string' ? raw.attested.declaredLicense.slice(0, 128) : '',
        at: typeof raw.attested.at === 'string' ? raw.attested.at.slice(0, 64) : new Date().toISOString()
      };
    }
  } else {
    return { ok: false, code: 400, error: 'kind 는 procedural|cc0|local 만 허용' };
  }
  sprites.push(asset);
  // 'asset' 델타 브로드캐스트(seq 부여 — 구독자 미러가 assets 동기).
  state.seq += 1;
  const entry = { seq: state.seq, kind: 'asset', command: { op: 'add', asset }, undoDelta: null };
  state.log.push(entry);
  if (state.log.length > UNDO_LIMIT) state.log.shift();
  broadcast({ type: 'asset', seq: state.seq, op: 'add', asset });
  return { ok: true, asset, seq: state.seq };
}

// ── P4 결정형 스킬도구 실행(execFile, 배열 인자 — 셸 미경유) ───────────────────
// 현재 씬을 임시 파일로 직렬화해 그 경로로 lint-scene 등을 실행할 수 있게 한다.
// 임시 파일은 games/_editor-samples/ 아래 _wgf-tmp 로 써서 pathScope(repo) 안에 둔다.
// dotfile 이 아닌 이름 — resolveScopedPath 의 dotfile 세그먼트 거부(사용자 인자 보호용)가
// 내부 임시 경로 자신을 막지 않도록 한다.
function writeTempScene() {
  const dir = path.resolve(REPO_ROOT, 'games', '_editor-samples', '_wgf-tmp');
  fs.mkdirSync(dir, { recursive: true });
  // 호출별 고유 파일명(레이스 방지) — seq + 6바이트 hex 접미어.
  const uniq = crypto.randomBytes(6).toString('hex');
  const file = path.join(dir, `current-scene-${state.seq}-${uniq}.json`);
  const snap = sceneSnapshot();
  fs.writeFileSync(file, JSON.stringify(snap.scene, null, 2), 'utf8');
  return file;
}

// {tool, args} → execFile 실행. 'current' 가 args.file/target 에 들어오면 현재 씬 임시
// 직렬화 경로로 치환(에디터 직접 트랙 — 사용자가 경로를 손으로 넣지 않게).
// 콜백(result) — result = {ok, exit, json, stdout, stderr} 또는 {ok:false, code, error}.
function runSkillTool(tool, argsIn, cb) {
  const args = (argsIn && typeof argsIn === 'object' && !Array.isArray(argsIn)) ? Object.assign({}, argsIn) : {};
  // 'current' 토큰 → 현재 씬 임시 직렬화 경로(에디터 결정형 트랙 편의).
  // 호출별 고유 파일명이므로 콜백 후 삭제(미정리 누적 방지).
  let tmpSceneFile = null;
  try {
    for (const key of ['file', 'target']) {
      if (args[key] === 'current') {
        const absFile = writeTempScene();
        tmpSceneFile = absFile;
        args[key] = path.relative(REPO_ROOT, absFile).split(path.sep).join('/');
      }
    }
  } catch (e) {
    cb({ ok: false, code: 500, error: '현재 씬 임시 직렬화 실패: ' + String(e && e.message || e) });
    return;
  }
  const built = buildSkillCommand(tool, args);
  if (!built.ok) { cb(built); return; }
  // execFile — 셸 미경유. 배열 인자라 메타문자가 셸로 해석되지 않는다(인자=문자열).
  execFile(process.execPath, built.argv, {
    cwd: REPO_ROOT, timeout: 30000, maxBuffer: 4 * 1024 * 1024, windowsHide: true
  }, (err, stdout, stderr) => {
    const out = String(stdout || '');
    // 마지막 비어있지 않은 줄을 JSON 으로 파싱(도구 계약: 마지막 줄 단일 JSON).
    let json = null;
    const lines = out.trim().split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const t = lines[i].trim();
      if (!t) continue;
      try { json = JSON.parse(t); break; } catch (e) { /* 마지막 줄이 JSON 아니면 null */ break; }
    }
    const exit = err && typeof err.code === 'number' ? err.code : (err ? 1 : 0);
    // 임시 씬 파일 정리(있을 때만 — 콜백 완료 후 비동기 삭제, 실패 무시).
    if (tmpSceneFile) fs.rm(tmpSceneFile, { force: true }, () => {});
    cb({
      ok: true, tool, exit, json,
      stdout: out.slice(-4096),
      stderr: String(stderr || '').slice(-2048),
      timedOut: !!(err && err.killed)
    });
  });
}

// ── HTTP 서버 ─────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = u.pathname;

  // ── API 라우트(토큰 + Origin 검사) ────────────────────────────────────────
  if (p.startsWith('/api/')) {
    if (!checkToken(req, u)) { sendJSON(res, 401, { ok: false, error: '토큰 누락/오류' }); return; }
    if (!checkOrigin(req)) { sendJSON(res, 403, { ok: false, error: 'Origin 거부' }); return; }
    return handleApi(req, res, u, p);
  }

  // ── 정적 서빙 ──────────────────────────────────────────────────────────────
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('method not allowed');
    return;
  }
  serveStatic(res, p);
});

function handleApi(req, res, u, p) {
  // GET /api/bootstrap — 토큰·base(클라가 fetch 로 받을 수도 있는 보조 경로).
  if (req.method === 'GET' && p === '/api/bootstrap') {
    sendJSON(res, 200, { ok: true, token: TOKEN, base: '', seq: state.seq, mode: state.mode });
    return;
  }

  // GET /api/scene — 현재 스냅샷 + seq(초기 동기·resync 재요청) + Claude 연결 상태.
  //  ETag(계약 §2.6): "wgf-<state.seq>" — 스냅샷은 seq 와 1:1. If-None-Match 일치 시 304
  //  (본문 생략 — resync 폭주 시 재직렬화 절감). seq 가 바뀌면 ETag 도 바뀌어 캐시 무효화.
  if (req.method === 'GET' && p === '/api/scene') {
    const etag = '"wgf-' + state.seq + '"';
    const inm = req.headers['if-none-match'];
    if (inm && inm === etag) {
      res.writeHead(304, { 'ETag': etag, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'ETag': etag
    });
    res.end(JSON.stringify(Object.assign({ ok: true, status: connectionStatus() }, sceneSnapshot())));
    return;
  }

  // GET /api/status — Claude 연결 상태만(하트비트 인디케이터 폴링용, 경량).
  if (req.method === 'GET' && p === '/api/status') {
    sendJSON(res, 200, { ok: true, status: connectionStatus(), seq: state.seq, mode: state.mode });
    return;
  }

  // POST /api/command {command} — applyCommand → seq++ → SSE 델타. Play 모드면 409.
  if (req.method === 'POST' && p === '/api/command') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const command = parsed && parsed.command;
      if (!command || typeof command !== 'object') { sendJSON(res, 400, { ok: false, error: 'command 누락' }); return; }
      if (state.mode === 'play') { sendJSON(res, 409, { ok: false, error: 'Play 모드 — 씬 read-only(§4.9)' }); return; }
      const r = pushCommand(command);
      sendJSON(res, 200, { ok: true, seq: r.seq, newId: r.newId });
    });
    return;
  }

  // POST /api/undo · /api/redo — 서버측 undo/redo + 델타. Play 모드 거부.
  if (req.method === 'POST' && (p === '/api/undo' || p === '/api/redo')) {
    if (state.mode === 'play') { sendJSON(res, 409, { ok: false, error: 'Play 모드 — 씬 read-only(§4.9)' }); return; }
    const seq = (p === '/api/undo') ? doUndo() : doRedo();
    sendJSON(res, 200, { ok: true, seq, applied: seq != null });
    return;
  }

  // POST /api/mode {mode} — 권위 모드 전환(edit↔play).
  if (req.method === 'POST' && p === '/api/mode') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const mode = (parsed && parsed.mode === 'play') ? 'play' : 'edit';
      state.mode = mode;
      // 모드 전환도 델타로 알려 미러·UI 가 동기(권위 read-only 상태 표시).
      state.seq += 1;
      const entry = { seq: state.seq, kind: 'mode', command: { mode }, undoDelta: null };
      state.log.push(entry);
      if (state.log.length > UNDO_LIMIT) state.log.shift();
      broadcast({ type: 'mode', seq: state.seq, mode });
      sendJSON(res, 200, { ok: true, mode, seq: state.seq });
    });
    return;
  }

  // ── E1 멀티 씬(추가/전환/삭제/이름변경) ──────────────────────────────────────
  //  baseDoc.scenes[] 가 권위 저장소. 활성 씬만 state.world 로 로드돼 커맨드가 적용된다.

  // GET /api/scene/list — 모든 씬 요약 {id,name,entityCount} + activeSceneId + seq.
  //  read-only: 권위 문서를 변이하지 않는다. sceneSummaries() 가 활성 씬은 라이브 world,
  //  비활성 씬은 baseDoc 슬롯 entities 길이로 entityCount 를 계산하므로 flush 불필요.
  //  (특히 Play 중 list 호출이 play world 를 슬롯에 flush 하는 부작용을 제거.)
  if (req.method === 'GET' && p === '/api/scene/list') {
    sendJSON(res, 200, { ok: true, scenes: sceneSummaries(), activeSceneId: state.activeSceneId, seq: state.seq });
    return;
  }

  // POST /api/scene/add {name?} — 새 빈 씬 생성(고유 id·기본 name "Scene N"). 전환은 안 함.
  //  Play 중엔 씬 구조 read-only(§4.9 불변식). 씬 개수 상한(MAX_SCENES) 초과 시 400.
  if (req.method === 'POST' && p === '/api/scene/add') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      if (state.mode === 'play') { sendJSON(res, 409, { ok: false, error: 'Play 모드 — 씬 구조 read-only(§4.9)' }); return; }
      if (state.baseDoc.scenes.length >= MAX_SCENES) { sendJSON(res, 400, { ok: false, error: '씬 수 상한 초과(최대 256)' }); return; }
      const used = new Set(state.baseDoc.scenes.map((s) => String(s.id)));
      const n = state.baseDoc.scenes.length + 1;
      const id = uniqueSceneId(sanitizeSceneId('scene-' + n, 'scene-' + n), used);
      const name = sanitizeSceneName(parsed && parsed.name, 'Scene ' + n);
      const scene = { id, name, systems: {}, entities: [] };
      state.baseDoc.scenes.push(scene);
      // 'scene' 델타 발행(목록 변경 — 에디터가 list 재요청). 씬 추가는 활성 씬 상태 무변경.
      const seq = broadcastScene('add', { id, name });
      sendJSON(res, 200, { ok: true, scene: { id, name }, scenes: sceneSummaries(), activeSceneId: state.activeSceneId, seq });
    });
    return;
  }

  // POST /api/scene/rename {id, name} — 위생화된 name 설정. Play 중엔 씬 구조 read-only(§4.9).
  if (req.method === 'POST' && p === '/api/scene/rename') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      if (state.mode === 'play') { sendJSON(res, 409, { ok: false, error: 'Play 모드 — 씬 구조 read-only(§4.9)' }); return; }
      const id = String((parsed && parsed.id) != null ? parsed.id : '');
      const slot = state.baseDoc.scenes.find((s) => String(s.id) === id);
      if (!slot) { sendJSON(res, 404, { ok: false, error: '씬 없음: ' + id }); return; }
      slot.name = sanitizeSceneName(parsed && parsed.name, slot.name || id);
      const seq = broadcastScene('rename', { id, name: slot.name });
      sendJSON(res, 200, { ok: true, scenes: sceneSummaries(), seq });
    });
    return;
  }

  // POST /api/scene/remove {id} — 씬 제거. 마지막 1개는 거부(400). 활성 씬 제거 시
  //  activeSceneId 를 남은 첫 씬으로 이동 + world 재로드. Play 모드 중엔 거부(409).
  if (req.method === 'POST' && p === '/api/scene/remove') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      if (state.mode === 'play') { sendJSON(res, 409, { ok: false, error: 'Play 모드 — 씬 구조 read-only(§4.9)' }); return; }
      const id = String((parsed && parsed.id) != null ? parsed.id : '');
      const idx = state.baseDoc.scenes.findIndex((s) => String(s.id) === id);
      if (idx < 0) { sendJSON(res, 404, { ok: false, error: '씬 없음: ' + id }); return; }
      if (state.baseDoc.scenes.length <= 1) { sendJSON(res, 400, { ok: false, error: '마지막 씬은 삭제할 수 없습니다.' }); return; }
      const wasActive = (String(state.activeSceneId) === id);
      // 활성 씬을 지우는 경우, 지우기 전에 라이브 상태를 슬롯에 flush 할 필요 없음(어차피 제거).
      state.baseDoc.scenes.splice(idx, 1);
      if (wasActive) {
        // 활성 씬 제거 → 남은 첫 씬으로 이동 + world 재로드.
        state.activeSceneId = state.baseDoc.scenes[0].id;
        reloadActiveWorld();
      }
      const seq = broadcastScene('remove', { id, activeSceneId: state.activeSceneId });
      sendJSON(res, 200, { ok: true, scenes: sceneSummaries(), activeSceneId: state.activeSceneId, seq });
    });
    return;
  }

  // POST /api/scene/switch {id} — 활성 씬 전환. flushWorldToActiveScene() 후
  //  activeSceneId=id, state.world=SceneKit.load(baseDoc,{mode,sceneId:id}). seq 증가.
  //  SSE 로 'scene' 델타(op=switch) 발행 → 에디터가 /api/scene 재요청. Play 모드 중엔 거부(409).
  if (req.method === 'POST' && p === '/api/scene/switch') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      if (state.mode === 'play') { sendJSON(res, 409, { ok: false, error: 'Play 모드 — 씬 전환 불가(§4.9)' }); return; }
      const id = String((parsed && parsed.id) != null ? parsed.id : '');
      const slot = state.baseDoc.scenes.find((s) => String(s.id) === id);
      if (!slot) { sendJSON(res, 404, { ok: false, error: '씬 없음: ' + id }); return; }
      if (String(state.activeSceneId) === id) {
        // 이미 활성 — 무변경(멱등). seq 증가 없이 현재 상태 반환.
        sendJSON(res, 200, { ok: true, activeSceneId: state.activeSceneId, seq: state.seq });
        return;
      }
      // 현재 활성 씬의 라이브 상태를 슬롯에 flush(편집분 보존) 후 대상 씬 로드.
      flushWorldToActiveScene();
      state.activeSceneId = id;
      reloadActiveWorld();
      // 'scene' 델타(op=switch) 발행 — 에디터가 스냅샷 재요청(world 전체 교체이므로 resync 의미).
      const seq = broadcastScene('switch', { activeSceneId: id });
      sendJSON(res, 200, { ok: true, activeSceneId: state.activeSceneId, seq });
    });
    return;
  }

  // GET /api/events — SSE 델타 스트림.
  if (req.method === 'GET' && p === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    const sub = { res, pending: 0, alive: true, resyncing: false, backpressured: false };
    subscribers.add(sub);
    attachDrain(sub);
    // 초기 코멘트(연결 확인 — 일부 클라가 첫 바이트 대기).
    res.write(`: connected seq=${state.seq}\n\n`);
    // Last-Event-ID(헤더 또는 ?lastEventId=) → 누락 델타 재전송(무손실 복구).
    const lastId = req.headers['last-event-id'] || u.searchParams.get('lastEventId');
    if (lastId != null) replayMissed(sub, lastId);
    req.on('close', () => { sub.alive = false; subscribers.delete(sub); });
    return;
  }

  // ── P3 역채널: 챗 큐 + 하트비트 ──────────────────────────────────────────────

  // POST /api/chat {text} — 에디터 → Claude. 사용자 메시지 enqueue(영속) → SSE 로 에코.
  if (req.method === 'POST' && p === '/api/chat') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const text = parsed && parsed.text;
      if (typeof text !== 'string' || text.length === 0) { sendJSON(res, 400, { ok: false, error: 'text 누락' }); return; }
      if (text.length > 100_000) { sendJSON(res, 413, { ok: false, error: 'text 과대' }); return; }
      const msg = enqueueChat(text);
      // 에디터 UI 가 자기 메시지를 채팅창에 즉시 표시하도록 SSE 로 에코(role=user).
      state.seq += 1;
      const entry = { seq: state.seq, kind: 'chat', command: { role: 'user', id: msg.id, text: msg.text, at: msg.at }, undoDelta: null };
      state.log.push(entry);
      if (state.log.length > UNDO_LIMIT) state.log.shift();
      broadcast({ type: 'chat', seq: state.seq, role: 'user', id: msg.id, text: msg.text, at: msg.at });
      sendJSON(res, 200, { ok: true, id: msg.id, queued: chat.messages.length });
    });
    return;
  }

  // GET /api/chat/next — MCP editor_next_message 가 미처리 메시지 디큐(long-poll).
  //  미처리 있으면 즉시 1건, 없으면 long-poll 후 타임아웃 시 빈 응답(message:null).
  //  이 호출 자체를 하트비트로 간주(Claude 루프 생존 신호, §4.7).
  if (req.method === 'GET' && p === '/api/chat/next') {
    recordHeartbeat();
    const msg = dequeueChat();
    if (msg) { sendJSON(res, 200, { ok: true, message: msg }); return; }
    // 미처리 없음 → long-poll 대기. 타임아웃 시 빈 응답 + 재호출 유도.
    const poller = { res, timer: null };
    poller.timer = setTimeout(() => {
      const i = chat.pollers.indexOf(poller);
      if (i >= 0) chat.pollers.splice(i, 1);
      try { sendJSON(res, 200, { ok: true, message: null }); } catch (e) {}
    }, CHAT_POLL_TIMEOUT_MS);
    chat.pollers.push(poller);
    // 클라가 끊으면 poller 정리(누수 방지).
    req.on('close', () => {
      const i = chat.pollers.indexOf(poller);
      if (i >= 0) { chat.pollers.splice(i, 1); if (poller.timer) clearTimeout(poller.timer); }
    });
    return;
  }

  // POST /api/chat/reply {text, replyTo?} — MCP editor_reply 가 응답을 에디터에 SSE 표시.
  //  Claude 가 메시지를 처리했음을 의미하므로 하트비트도 갱신.
  if (req.method === 'POST' && p === '/api/chat/reply') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const text = parsed && parsed.text;
      if (typeof text !== 'string') { sendJSON(res, 400, { ok: false, error: 'text 누락' }); return; }
      recordHeartbeat();
      state.seq += 1;
      const replyTo = (parsed && parsed.replyTo != null) ? parsed.replyTo : null;
      const entry = { seq: state.seq, kind: 'chat', command: { role: 'assistant', text, replyTo, at: Date.now() }, undoDelta: null };
      state.log.push(entry);
      if (state.log.length > UNDO_LIMIT) state.log.shift();
      broadcast({ type: 'chat', seq: state.seq, role: 'assistant', text, replyTo, at: entry.command.at });
      sendJSON(res, 200, { ok: true, seq: state.seq });
    });
    return;
  }

  // POST /api/heartbeat — Claude 루프가 주기적으로 호출(연결 생존). status=connected/waiting 유지.
  if (req.method === 'POST' && p === '/api/heartbeat') {
    recordHeartbeat();
    sendJSON(res, 200, { ok: true, status: connectionStatus(), at: chat.lastHeartbeat });
    return;
  }

  // ── P4 결정형 스킬도구 실행(보안 §6) ────────────────────────────────────────
  // POST /api/skill/run {tool, args} — 화이트리스트 + 인자 스키마 검증 후 execFile
  //  (배열 인자, 셸 미경유). 화이트리스트 외/인자 위반/traversal → 4xx 구조화 거부.
  if (req.method === 'POST' && p === '/api/skill/run') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const tool = parsed && parsed.tool;
      const args = (parsed && parsed.args) || {};
      runSkillTool(tool, args, (r) => {
        if (!r.ok) { sendJSON(res, r.code || 400, { ok: false, error: r.error }); return; }
        // 도구 실행 자체는 성공(프로토콜 200) — 도구 종료코드/findings 는 페이로드로.
        sendJSON(res, 200, { ok: true, tool: r.tool, exit: r.exit, json: r.json, stdout: r.stdout, stderr: r.stderr, timedOut: r.timedOut });
      });
    });
    return;
  }

  // ── P4 에셋 ──────────────────────────────────────────────────────────────────
  // GET /api/asset/list — 현재 씬 assets.sprites 목록.
  if (req.method === 'GET' && p === '/api/asset/list') {
    sendJSON(res, 200, { ok: true, assets: listAssets(), seq: state.seq });
    return;
  }

  // POST /api/asset/add {kind, asset} — procedural|cc0|local 자산을 assets.sprites 에 추가.
  if (req.method === 'POST' && p === '/api/asset/add') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const kind = parsed && parsed.kind;
      const asset = parsed && parsed.asset;
      const r = addAsset(kind, asset);
      if (!r.ok) { sendJSON(res, r.code || 400, { ok: false, error: r.error }); return; }
      sendJSON(res, 200, { ok: true, asset: r.asset, seq: r.seq });
    });
    return;
  }

  // ── 로컬 Unity 폴더 임포트(설계 §4) ──────────────────────────────────────────
  // POST /api/asset/unity-scan {folder} — 외부 폴더를 스캔해 임포트 후보·라이선스 분류를
  //  미리 보여준다(복사 없음). resolveExternalFolder 로 절대경로·디렉터리 검증.
  if (req.method === 'POST' && p === '/api/asset/unity-scan') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const abs = resolveExternalFolder(parsed && parsed.folder);
      if (!abs) { sendJSON(res, 400, { ok: false, error: '폴더 거부(절대경로·실존 디렉터리만)' }); return; }
      let result;
      try { result = AssetImport.scanLocalFolder(abs, { repoRoot: REPO_ROOT }); }
      catch (e) { sendJSON(res, 500, { ok: false, error: '스캔 실패: ' + String(e && e.message || e) }); return; }
      sendJSON(res, 200, Object.assign({ ok: true }, result));
    });
    return;
  }

  // POST /api/asset/unity-import {folder, selections:[...]} — 선택분을 vendoring 임포트.
  //  selection: {relPath, id?, license?, credit?, attested?:{owner,declaredLicense}}.
  //  blocked → reject. warn 인데 attested(owner+declaredLicense) 없으면 reject.
  //  통과: games/<slug>/assets/imported/ 로 복사 후 addAsset('local'). attested 는 감사로그 append.
  if (req.method === 'POST' && p === '/api/asset/unity-import') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const abs = resolveExternalFolder(parsed && parsed.folder);
      if (!abs) { sendJSON(res, 400, { ok: false, error: '폴더 거부(절대경로·실존 디렉터리만)' }); return; }
      const selections = (parsed && Array.isArray(parsed.selections)) ? parsed.selections : null;
      if (!selections || selections.length === 0) { sendJSON(res, 400, { ok: false, error: 'selections 배열 필요' }); return; }
      if (selections.length > AssetImport.MAX_FILES) { sendJSON(res, 400, { ok: false, error: 'selections 과다' }); return; }

      // 현재 편집 게임 디렉터리(쓰기 대상). games/ 밖(빈 씬 폴백)이면 임포트 불가.
      const gameDir = currentGameDir();
      if (!gameDir) { sendJSON(res, 409, { ok: false, error: '현재 씬이 games/<slug> 아님 — 임포트 대상 없음' }); return; }
      // 쓰기 대상 디렉터리: <gameDir>/assets/imported/ — gameDir 의 repo-상대 전체경로로
      // 구성(중첩 게임 경로도 정확) 후 resolveScopedPath('games') 로 games/ 안 이중검증.
      const importedRel = path.relative(REPO_ROOT, path.join(gameDir, 'assets', 'imported')).split(path.sep).join('/');
      const importedAbs = resolveScopedPath(importedRel, 'games');
      if (!importedAbs) { sendJSON(res, 500, { ok: false, error: '임포트 대상 경로 검증 실패' }); return; }

      // 폴더 전체를 1회 스캔해 신뢰 가능한 재분류 맵 구성(클라 입력 신뢰 안 함).
      let scan;
      try { scan = AssetImport.scanLocalFolder(abs, { repoRoot: REPO_ROOT }); }
      catch (e) { sendJSON(res, 500, { ok: false, error: '재스캔 실패: ' + String(e && e.message || e) }); return; }
      const scanByRel = new Map();
      for (const it of scan.items) scanByRel.set(it.relPath, it);

      const added = [];
      const rejected = [];
      const attestations = [];
      const usedIds = new Set((listAssets().sprites || []).map((s) => s && s.id).filter(Boolean));

      for (const sel of selections) {
        const relPath = sel && typeof sel.relPath === 'string' ? sel.relPath : null;
        if (!relPath) { rejected.push({ relPath: String(relPath), reason: 'relPath 누락' }); continue; }
        // traversal 차단: scan 결과에 존재하는 relPath 만 허용(서버가 enumerate 한 안전 경로).
        const item = scanByRel.get(relPath);
        if (!item) { rejected.push({ relPath, reason: '스캔 결과 외 경로(거부)' }); continue; }
        // 서버 재분류 기준(클라 status 신뢰 안 함).
        if (item.status === 'blocked') { rejected.push({ relPath, reason: '차단됨: ' + item.reason }); continue; }

        const attested = sel && sel.attested && typeof sel.attested === 'object' ? sel.attested : null;
        const hasAttest = attested && typeof attested.owner === 'string' && attested.owner.length > 0 &&
          typeof attested.declaredLicense === 'string' && attested.declaredLicense.length > 0;
        if (item.status === 'warn' && !hasAttest) {
          rejected.push({ relPath, reason: 'attestation 필요(owner+declaredLicense)' });
          continue;
        }

        // 안전한 vendoring 파일명: id(요청) 또는 suggestedId → 안전화 + 충돌회피 + 확장자.
        const reqId = (sel && typeof sel.id === 'string') ? sel.id : item.suggestedId;
        const safeId = AssetImport.suggestIdFromPath(reqId, usedIds);
        // 확장자는 스캔에서 검증된 allowlist 확장자만 사용(임의 확장자 금지).
        const safeName = safeId + item.ext;

        // 산출 소스 절대경로가 스캔 root 밖이면 거부(이중 traversal 가드).
        const absSrc = path.join(abs, relPath.split('/').join(path.sep));
        const absSrcResolved = path.resolve(absSrc);
        if (absSrcResolved !== abs && !absSrcResolved.startsWith(abs + path.sep)) {
          rejected.push({ relPath, reason: 'root 밖 경로 거부' });
          continue;
        }

        const v = AssetImport.vendorFile(absSrcResolved, importedAbs, safeName, { repoRoot: REPO_ROOT });
        if (!v.ok) { rejected.push({ relPath, reason: '복사 실패: ' + v.error }); continue; }

        // addAsset('local') 레코드 구성.
        const at = new Date().toISOString();
        const isWarn = (item.status === 'warn');
        const declared = isWarn ? (attested.declaredLicense) : null;
        const record = {
          id: safeId,
          url: v.relUrl,
          license: isWarn ? AssetImport.normalizeLicense(declared) : (item.detected.license || 'unknown'),
          credit: (sel && typeof sel.credit === 'string') ? sel.credit : (item.detected.attribution || ''),
          attribution: item.detected.attribution || '',
          desc: '원본: ' + relPath,
          sha256: v.sha256,
          origin: { folder: abs, relPath }
        };
        if (isWarn) {
          record.attested = { owner: attested.owner, declaredLicense: declared, at };
        }
        const r = addAsset('local', record);
        if (!r.ok) { rejected.push({ relPath, reason: r.error }); continue; }
        usedIds.add(safeId);
        added.push(r.asset);
        if (isWarn) attestations.push({ id: safeId, url: v.relUrl, owner: attested.owner, declaredLicense: declared, origin: { folder: abs, relPath }, at });
      }

      // 부수효과: attested 항목을 games/<slug>/IMPORT_ATTESTATIONS.json 에 append(감사 로그).
      if (attestations.length > 0) {
        try {
          const logPath = path.join(gameDir, 'IMPORT_ATTESTATIONS.json');
          let arr = [];
          try {
            const prev = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            if (Array.isArray(prev)) arr = prev;
          } catch (e) {
            // 파싱 실패(손상). 기존 감사 로그를 덮어써 유실하지 않도록 .corrupt 백업 후 새로 시작(보안 LOW-2).
            try { if (fs.existsSync(logPath)) fs.renameSync(logPath, logPath + '.corrupt-' + Date.now()); } catch (e2) { /* 무시 */ }
          }
          for (const a of attestations) arr.push(a);
          fs.writeFileSync(logPath, JSON.stringify(arr, null, 2), 'utf8');
        } catch (e) {
          process.stderr.write('[wgf-bridge] attestation 로그 기록 실패: ' + String(e && e.message || e) + '\n');
        }
      }

      sendJSON(res, 200, { ok: true, added, rejected, seq: state.seq });
    });
    return;
  }

  // ── 통합 스프라이트 브라우저(계약 §2) ────────────────────────────────────────
  // GET /api/sprite/catalog — packs.json+sources.json 병합(preview 웹경로·downloaded·mtime 캐시).
  if (req.method === 'GET' && p === '/api/sprite/catalog') {
    let cat;
    try { cat = SpriteLibrary.readCatalog(REPO_ROOT); }
    catch (e) { sendJSON(res, 500, { ok: false, error: '카탈로그 읽기 실패: ' + String(e && e.message || e) }); return; }
    sendJSON(res, 200, { ok: true, packs: cat.packs, sources: cat.sources });
    return;
  }

  // GET /api/sprite/library — assets-library/** + 현재 게임 assets/** 스캔(사이드카 병합).
  if (req.method === 'GET' && p === '/api/sprite/library') {
    let lib;
    try { lib = SpriteLibrary.scanLibrary(REPO_ROOT, currentGameDir()); }
    catch (e) { sendJSON(res, 500, { ok: false, error: '라이브러리 스캔 실패: ' + String(e && e.message || e) }); return; }
    sendJSON(res, 200, { ok: true, items: lib.items, truncated: lib.truncated });
    return;
  }

  // POST /api/sprite/slice {relPath, patch} — 슬라이스 사이드카 머지 저장(frameConfig 위생화).
  if (req.method === 'POST' && p === '/api/sprite/slice') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const relPath = parsed && parsed.relPath;
      const patch = parsed && parsed.patch;
      let r;
      try { r = SpriteLibrary.writeSlice(REPO_ROOT, relPath, patch); }
      catch (e) { sendJSON(res, 500, { ok: false, error: '슬라이스 저장 실패: ' + String(e && e.message || e) }); return; }
      if (!r.ok) { sendJSON(res, r.code || 400, { ok: false, error: r.error }); return; }
      sendJSON(res, 200, { ok: true, item: r.item });
    });
    return;
  }

  // POST /api/sprite/analyze {relPath, w?, h?, frameConfig?} —
  //  가져온 시트를 "동작별 애니메이션"으로 분석(D1). 저장은 안 함(프론트가 검토 후 /api/sprite/slice).
  //  - 서버는 사이드카·analysis.json 에서 frameConfig/frames 를 조회(getSheetMeta).
  //  - 클라가 frameConfig·w·h 를 보내면 그걸 우선(프론트가 이미지 로드 후 픽셀 크기를 안다 — grid 분석).
  //  - deriveAnims 로 행 단위 의미 클립 도출. 반환 { ok, frames, frameConfig, anims }.
  //  경로 가드: getSheetMeta 가 resolveLibraryPath 로 traversal/dotfile/범위밖 거부(4xx).
  if (req.method === 'POST' && p === '/api/sprite/analyze') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const relPath = parsed && parsed.relPath;
      let meta;
      try { meta = SpriteLibrary.getSheetMeta(REPO_ROOT, relPath); }
      catch (e) { sendJSON(res, 500, { ok: false, error: '시트 조회 실패: ' + String(e && e.message || e) }); return; }
      if (!meta.ok) { sendJSON(res, meta.code || 400, { ok: false, error: meta.error }); return; }

      // 클라 override: frameConfig·w·h(프론트가 이미지 로드 후 안다). 위생화 후 우선 채택.
      const clientFc = SpriteLibrary.sanitizeFrameConfig(parsed && parsed.frameConfig);
      const frameConfig = clientFc || meta.frameConfig || null;
      const frames = meta.frames || null;
      const w = (typeof (parsed && parsed.w) === 'number' && parsed.w > 0) ? (parsed.w | 0) : undefined;
      const h = (typeof (parsed && parsed.h) === 'number' && parsed.h > 0) ? (parsed.h | 0) : undefined;

      const derived = SpriteLibrary.deriveAnims({ frameConfig, frames, w, h });
      sendJSON(res, 200, { ok: true, relPath: meta.relPath, frames: frames || null, frameConfig: frameConfig || null, anims: derived.anims });
    });
    return;
  }

  // POST /api/sprite/use {relPath, id?, frameConfig?, frame?, license?, credit?} —
  //  선택 시트/프레임을 현재 게임에 vendoring + local 에셋 등록(컴포넌트 부착은 안 함, 단일 책임).
  //  동일 sha 가 이미 vendored(기존 local 에셋) 면 재사용 → reused:true 로 기존 asset 반환.
  if (req.method === 'POST' && p === '/api/sprite/use') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }

      // 현재 편집 게임 디렉터리(쓰기 대상). 빈 씬(games/ 밖)이면 409.
      const gameDir = currentGameDir();
      if (!gameDir) { sendJSON(res, 409, { ok: false, error: '현재 씬이 games/<slug> 아님 — 적용 대상 없음' }); return; }

      // relPath 검증(assets-library/ 또는 games/ 하위) + 실제 이미지 파일 확인.
      const relPath = parsed && parsed.relPath;
      const absSrc = SpriteLibrary.resolveLibraryPath(REPO_ROOT, relPath);
      if (!absSrc) { sendJSON(res, 400, { ok: false, error: 'relPath 범위 밖/traversal 거부: ' + JSON.stringify(String(relPath).slice(0, 128)) }); return; }
      let srcStat;
      try { srcStat = fs.lstatSync(absSrc); }
      catch (e) { sendJSON(res, 400, { ok: false, error: '원본 파일 없음: ' + JSON.stringify(String(relPath).slice(0, 128)) }); return; }
      if (srcStat.isSymbolicLink() || !srcStat.isFile()) { sendJSON(res, 400, { ok: false, error: '원본이 일반 파일 아님(심볼릭링크/디렉터리 거부)' }); return; }

      // frameConfig/frames/frame 위생화(addAsset 의 sanitizeFrameMeta 가 최종 위생화하나 여기서도 정규화).
      //  frames[] = 비균일 명시 영역(슬라이서 free-mode) — sanitizeFramesArray 동등 위생화(M-1).
      const frameConfig = SpriteLibrary.sanitizeFrameConfig(parsed && parsed.frameConfig);
      const frames = sanitizeFramesArray(parsed && parsed.frames);
      const frame = (typeof (parsed && parsed.frame) === 'number' && parsed.frame >= 0) ? (parsed.frame | 0) : undefined;
      const license = (typeof (parsed && parsed.license) === 'string') ? parsed.license : '';
      const credit = (typeof (parsed && parsed.credit) === 'string') ? parsed.credit : '';

      // 소스 sha256 — 동일 sha 기존 local 에셋 재사용 판정.
      let srcSha;
      try { srcSha = SpriteLibrary.sha256OfFile(absSrc); }
      catch (e) { sendJSON(res, 500, { ok: false, error: 'sha256 계산 실패: ' + String(e && e.message || e) }); return; }

      // 재사용 키 = sha256 + frameConfig + frames(M-5). 동일 sha 라도 슬라이스 메타가 다르면
      //  다른 에셋이므로 재사용하지 않는다(frameConfig/frames 만 다른 두 번 적용을 별 id 로 분리).
      //  비교는 위생화된 형태의 결정적 JSON(키 순서·정수 강제가 양쪽 동일) — frame(표시 셀)은 키 제외
      //  (같은 텍스처를 가리키되 표시 프레임만 다른 경우는 컴포넌트 frame 으로 처리 가능).
      const reqFcKey = JSON.stringify(frameConfig || null);
      const reqFrKey = JSON.stringify(frames || null);
      const existingSprites = (listAssets().sprites || []);
      const reusedAsset = existingSprites.find((s) =>
        s && s.source === 'local' && s.sha256 === srcSha &&
        JSON.stringify(s.frameConfig || null) === reqFcKey &&
        JSON.stringify(s.frames || null) === reqFrKey);
      if (reusedAsset) {
        // 이미 vendored — 컴포넌트가 참조할 기존 asset 을 그대로 반환(추가 복사·등록 없음).
        sendJSON(res, 200, { ok: true, asset: reusedAsset, reused: true, seq: state.seq });
        return;
      }

      // vendoring 대상 디렉터리: <gameDir>/assets/imported/ — games/ 안으로 이중검증.
      const importedRel = path.relative(REPO_ROOT, path.join(gameDir, 'assets', 'imported')).split(path.sep).join('/');
      const importedAbs = resolveScopedPath(importedRel, 'games');
      if (!importedAbs) { sendJSON(res, 500, { ok: false, error: '적용 대상 경로 검증 실패' }); return; }

      // 안전 asset id: 요청 id 또는 relPath basename → 안전화 + 충돌회피.
      const usedIds = new Set(existingSprites.map((s) => s && s.id).filter(Boolean));
      const reqId = (parsed && typeof parsed.id === 'string') ? parsed.id : AssetImport.suggestIdFromPath(relPath);
      const safeId = AssetImport.suggestIdFromPath(reqId, usedIds);
      // 확장자는 원본 확장자(검증된 이미지 확장자) 그대로.
      const ext = path.extname(absSrc).toLowerCase();
      const safeName = safeId + ext;

      // vendorFile 로 복사(심볼릭링크·과대 거부는 vendorFile 내부).
      const v = AssetImport.vendorFile(absSrc, importedAbs, safeName, { repoRoot: REPO_ROOT });
      if (!v.ok) { sendJSON(res, 400, { ok: false, error: '복사 실패: ' + v.error }); return; }

      // addAsset('local') 레코드. url 은 games/ 상대(vendorFile relUrl), frameConfig/frame 포함.
      const record = {
        id: safeId,
        url: v.relUrl,
        license: license || 'unknown',
        credit: credit,
        desc: '원본: ' + (parsed && typeof parsed.relPath === 'string' ? parsed.relPath : ''),
        sha256: v.sha256
      };
      if (frameConfig) record.frameConfig = frameConfig;
      if (frames) record.frames = frames;
      if (frame !== undefined) record.frame = frame;
      const r = addAsset('local', record);
      if (!r.ok) { sendJSON(res, r.code || 400, { ok: false, error: r.error }); return; }
      sendJSON(res, 200, { ok: true, asset: r.asset, reused: false, seq: r.seq });
    });
    return;
  }

  // POST /api/sprite/download {packId} — CC0 카탈로그 팩을 에디터 안에서 다운로드(방어적).
  //  packs.json safetyTier==='cc0' 만 허용. fetch-pack.mjs → analyze-pack.mjs 순차 execFile
  //  (배열 인자·셸 미경유, cwd=REPO_ROOT, timeout 120s). 네트워크 실패는 비치명({ok:false,error}).
  if (req.method === 'POST' && p === '/api/sprite/download') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const packId = parsed && parsed.packId;
      // packId slug 형식 검증(영숫자._- 만 — execFile 인자라 메타문자 무해하나 카탈로그 키 형식 강제).
      if (typeof packId !== 'string' || !/^[A-Za-z0-9._\-]{1,128}$/.test(packId)) {
        sendJSON(res, 400, { ok: false, error: 'packId 형식 위반(영숫자._- 1~128자)' });
        return;
      }
      // CC0 게이트: 카탈로그에서 safetyTier 확인. cc0 아니면 403.
      let cat;
      try { cat = SpriteLibrary.readCatalog(REPO_ROOT); }
      catch (e) { sendJSON(res, 500, { ok: false, error: '카탈로그 읽기 실패' }); return; }
      const pack = cat.packs.find((x) => x.id === packId);
      if (!pack) { sendJSON(res, 404, { ok: false, error: '카탈로그에 없는 packId: ' + packId }); return; }
      if (pack.safetyTier !== 'cc0') {
        sendJSON(res, 403, { ok: false, error: 'CC0 아님(safetyTier=' + pack.safetyTier + ') — 다운로드 거부' });
        return;
      }

      const fetchScript = path.resolve(REPO_ROOT, 'skills/wgf-sprite-picker/catalog/fetch-pack.mjs');
      const analyzeScript = path.resolve(REPO_ROOT, 'skills/wgf-sprite-picker/catalog/analyze-pack.mjs');
      const execOpts = { cwd: REPO_ROOT, timeout: 120000, maxBuffer: 8 * 1024 * 1024, windowsHide: true };

      // 1) fetch-pack.mjs --pack <packId>.
      execFile(process.execPath, [fetchScript, '--pack', packId], execOpts, (fErr, fOut, fStderr) => {
        if (fErr) {
          sendJSON(res, 200, { ok: false, error: 'fetch 실패: ' + String((fErr && fErr.message) || fErr), stdout: String(fOut || '').slice(-2048), stderr: String(fStderr || '').slice(-1024) });
          return;
        }
        // 2) analyze-pack.mjs --pack <packId>.
        execFile(process.execPath, [analyzeScript, '--pack', packId], execOpts, (aErr, aOut, aStderr) => {
          if (aErr) {
            sendJSON(res, 200, { ok: false, error: 'analyze 실패: ' + String((aErr && aErr.message) || aErr), stdout: String(aOut || '').slice(-2048), stderr: String(aStderr || '').slice(-1024) });
            return;
          }
          sendJSON(res, 200, { ok: true, packId, stdout: (String(fOut || '') + String(aOut || '')).slice(-2048) });
        });
      });
    });
    return;
  }

  // ── scene_screenshot 브라우저 캡처 왕복(2B) ─────────────────────────────────
  // GET /api/screenshot/capture — MCP scene_screenshot 가 호출. 연결된 브라우저 뷰포트에
  //  SSE 로 캡처를 요청하고 PNG 회신을 기다린다. 회신 시 {ok,mimeType,bytes,dataUrl},
  //  무구독자/타임아웃이면 {ok:false,headless:true} 구조화 응답(편집은 계속 가능).
  //  토큰·Origin 가드는 /api/ 전 구간(handleApi 진입 전)에서 이미 적용됨.
  if (req.method === 'GET' && p === '/api/screenshot/capture') {
    requestScreenshot().then((r) => {
      if (r && r.ok) {
        sendJSON(res, 200, { ok: true, mimeType: r.mimeType, bytes: r.bytes, dataUrl: r.dataUrl, width: r.width, height: r.height });
      } else {
        // 헤드리스(브라우저 미오픈) — 200 + ok:false(헤드리스는 정상 경로, HTTP 오류 아님).
        sendJSON(res, 200, { ok: false, headless: true, reason: (r && r.reason) || 'headless' });
      }
    }).catch((e) => {
      sendJSON(res, 500, { ok: false, error: '스크린샷 캡처 실패: ' + String(e && e.message || e) });
    });
    return;
  }

  // POST /api/screenshot {requestId, dataUrl} — 브라우저 뷰포트가 toDataURL PNG 를 회신.
  //  requestId 가 pending 캡처에 매칭되고 dataUrl 이 data:image/png;base64 형식이어야 한다.
  //  토큰·Origin 가드 동일 적용(/api/ 전 구간). 본문 상한은 readBody(5MB) 외에 별도 검사.
  if (req.method === 'POST' && p === '/api/screenshot') {
    readBody(req, (body) => {
      let parsed;
      try { parsed = JSON.parse(body || '{}'); } catch (e) { sendJSON(res, 400, { ok: false, error: 'JSON 파싱 실패' }); return; }
      const requestId = parsed && parsed.requestId;
      const dataUrl = parsed && parsed.dataUrl;
      if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > 64) {
        sendJSON(res, 400, { ok: false, error: 'requestId 누락/형식 오류' }); return;
      }
      // dataUrl 형식 검증: data:image/png;base64,<...>. PNG 만 허용(임의 스킴/타입 차단).
      const m = (typeof dataUrl === 'string') ? dataUrl.match(/^data:(image\/png);base64,([A-Za-z0-9+/=]+)$/) : null;
      if (!m) { sendJSON(res, 400, { ok: false, error: 'dataUrl 형식 오류(data:image/png;base64 만 허용)' }); return; }
      const base64 = m[2];
      // 디코드 바이트 추정(base64 길이 → 바이트). 상한 초과 거부(메모리 보호).
      const bytes = Math.floor(base64.length * 3 / 4);
      if (bytes > SCREENSHOT_MAX_BYTES) { sendJSON(res, 413, { ok: false, error: 'PNG 과대(상한 초과)' }); return; }
      // PNG 매직넘버 검증(디코드 첫 8바이트가 PNG 시그니처) — 위장 페이로드 차단.
      let buf;
      try { buf = Buffer.from(base64, 'base64'); } catch (e) { sendJSON(res, 400, { ok: false, error: 'base64 디코드 실패' }); return; }
      const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) {
        sendJSON(res, 400, { ok: false, error: 'PNG 시그니처 불일치' }); return;
      }
      const width = (parsed && typeof parsed.width === 'number' && parsed.width > 0) ? (parsed.width | 0) : undefined;
      const height = (parsed && typeof parsed.height === 'number' && parsed.height > 0) ? (parsed.height | 0) : undefined;
      const matched = resolveScreenshot(requestId, { mimeType: m[1], bytes: buf.length, dataUrl, width, height });
      if (!matched) { sendJSON(res, 404, { ok: false, error: '매칭되는 캡처 요청 없음(만료/미요청)' }); return; }
      sendJSON(res, 200, { ok: true });
    });
    return;
  }

  sendJSON(res, 404, { ok: false, error: 'unknown api' });
}

// 브리지 엔드포인트(port·token)를 토큰 공유 파일에 기록 — mcp.mjs 프록시가 읽는다.
// 토큰이 담기므로 0o600(소유자 rw only) 으로 써서 같은 머신의 다른 로컬 사용자에게 노출 방지.
// (POSIX 에서 완전 적용. Windows 에서 mode 는 read-only 비트만 반영돼 무해 — 보안 §6.)
function writeEndpointFile(port) {
  try {
    // 보관 디렉터리도 소유자 전용(0o700) — 토큰 파일이 든 디렉터리의 traverse 차단(보안 리뷰 MED-1).
    fs.mkdirSync(path.dirname(ENDPOINT_FILE), { recursive: true, mode: 0o700 });
    try { fs.chmodSync(path.dirname(ENDPOINT_FILE), 0o700); } catch (e) { /* POSIX 외 무시 */ }
    fs.writeFileSync(ENDPOINT_FILE, JSON.stringify({ port, token: TOKEN, host: HOST, pid: process.pid }), { encoding: 'utf8', mode: 0o600 });
    // 파일이 이미 존재했다면 writeFileSync 의 mode 는 무시되므로 명시적 chmod 로 권한 보장.
    // Windows/일부 FS 에서 chmod 실패는 무해(무시) — 토큰 노출 방지 best-effort.
    try { fs.chmodSync(ENDPOINT_FILE, 0o600); } catch (e) { /* POSIX 외 무시 */ }
  } catch (e) {
    process.stderr.write(`[wgf-bridge] 엔드포인트 파일 기록 실패: ${String(e)}\n`);
  }
}
function removeEndpointFile() {
  try { fs.unlinkSync(ENDPOINT_FILE); } catch (e) { /* 이미 없음 */ }
}
process.on('exit', removeEndpointFile);
process.on('SIGINT', () => { removeEndpointFile(); process.exit(0); });
process.on('SIGTERM', () => { removeEndpointFile(); process.exit(0); });

// ── 브라우저 자동 실행 ─────────────────────────────────────────────────────────
// 기동 완료 시 기본 브라우저로 에디터 URL 을 연다. execFile(배열 인자, 셸 미경유)라
// URL 의 메타문자가 셸로 해석되지 않는다. 생략 조건:
//   - WGF_NO_OPEN 설정         : 명시 옵트아웃
//   - WGF_BRIDGE_PORT=0        : 테스트 하니스/임의 포트(모든 test-*.mjs 가 쓰는 신호)
// 실패는 비치명적 — 브라우저가 없거나 헤드리스여도 서버는 계속 뜬다.
function maybeOpenBrowser(url) {
  if (process.env.WGF_NO_OPEN) return;
  if (process.env.WGF_BRIDGE_PORT === '0') return;
  let cmd, args;
  if (process.platform === 'win32')       { cmd = process.env.ComSpec || 'cmd.exe'; args = ['/c', 'start', '', url]; }
  else if (process.platform === 'darwin') { cmd = 'open';                            args = [url]; }
  else                                    { cmd = 'xdg-open';                        args = [url]; }
  try {
    execFile(cmd, args, { windowsHide: true }, (err) => {
      if (err) process.stderr.write(`[wgf-bridge] 브라우저 자동 실행 실패(무시) — 수동으로 ${url} 여세요\n`);
    });
  } catch (e) {
    process.stderr.write(`[wgf-bridge] 브라우저 자동 실행 예외(무시): ${String(e)}\n`);
  }
}

server.listen(PORT, HOST, () => {
  const actual = server.address().port;
  const url = `http://${HOST}:${actual}/editor/ui/`;
  writeEndpointFile(actual);
  // 첫 줄: 테스트 하니스가 파싱하는 구조화 라인(포트·토큰).
  process.stderr.write(`[wgf-bridge] READY ${JSON.stringify({ port: actual, token: TOKEN, host: HOST })}\n`);
  process.stderr.write(`[wgf-bridge] 브리지 기동 → ${url}\n`);
  process.stderr.write(`[wgf-bridge] 서빙 루트: ${REPO_ROOT}\n`);
  process.stderr.write(`[wgf-bridge] 씬: ${SCENE_REL}  entities=${state.world.entities.length}\n`);
  maybeOpenBrowser(url);
});

server.on('error', (e) => {
  process.stderr.write(`[wgf-bridge] 서버 오류: ${String(e)}\n`);
  process.exit(1);
});
