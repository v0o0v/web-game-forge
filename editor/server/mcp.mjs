#!/usr/bin/env node
/* ============================================================================
 * WGF Studio — MCP 어댑터 (stdio JSON-RPC 2.0, zero-dep, 무상태 프록시) / P3
 * ----------------------------------------------------------------------------
 * 설계서 §3.1·§3.3·§4.6·§4.7·§5 P3·§6 구현.
 *
 * 역할:
 *  - Claude Code 가 루트 .mcp.json 으로 이 프로세스를 spawn 해 stdio 로 통신한다.
 *  - 전송 = newline-delimited JSON-RPC 2.0 (MCP 현행 stdio 스펙):
 *      한 줄당 JSON 메시지 1개, '\n' 구분, embedded newline 금지(JSON.stringify 는
 *      기본적으로 \n 을 넣지 않음). stdout 에는 MCP 메시지만, 로그는 stderr.
 *      (설계서 §3.3 은 Content-Length 라 적었으나 Claude Code MCP 클라이언트
 *       호환을 위해 newline-delimited 가 정답 — MCP 공식 transports 스펙 확인.)
 *  - 무상태(stateless): 자체 씬 상태 0. 모든 도구 호출을 브리지에 localhost HTTP 로
 *    프록시한다 → "브리지 = 단일 진실"이 프로세스 수준에서 성립(§3.1).
 *
 * 토큰 획득(같은 신뢰경계, §6):
 *  - 우선순위: 환경변수 WGF_BRIDGE_TOKEN + WGF_BRIDGE_PORT.
 *  - 없으면 브리지가 기동 시 쓴 엔드포인트 파일(.omc/wgf-editor/bridge-endpoint.json)
 *    에서 {port, token} 을 읽는다(매 도구 호출마다 재읽기 — 브리지 재기동에 강건).
 *
 * 필수 메서드: initialize · notifications/initialized · tools/list · tools/call.
 * 표준 JSON-RPC 에러코드: -32700(parse) / -32600(invalid) / -32601(method not found)
 *   / -32602(invalid params) / -32603(internal).
 *
 * 불변식:
 *  - zero-dep — Node 빌트인만(http/fs/path/url/readline). npm 의존 금지.
 *  - 무상태 — 씬 데이터 보유 금지. 브리지 HTTP 프록시만.
 *
 * 실행: node editor/server/mcp.mjs   (보통 Claude Code 가 .mcp.json 으로 spawn)
 * ==========================================================================*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));   // editor/server/
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');           // 리포 루트

const PROTOCOL_VERSION = '2025-06-18';   // MCP 협상 버전(최신 stdio 스펙).
const SERVER_INFO = { name: 'wgf-editor', version: '1.0.0' };

const ENDPOINT_FILE = process.env.WGF_BRIDGE_ENDPOINT_FILE ||
  path.resolve(REPO_ROOT, '.omc', 'wgf-editor', 'bridge-endpoint.json');

// ── 로깅(stderr 만 — stdout 은 MCP 메시지 전용) ───────────────────────────────
function log(...a) { process.stderr.write('[wgf-mcp] ' + a.join(' ') + '\n'); }

// ── 브리지 엔드포인트(port·token) 획득 ────────────────────────────────────────
// 매 호출마다 환경변수 → 파일 순으로 읽어 브리지 재기동(포트·토큰 변경)에 강건.
function resolveBridge() {
  const envPort = process.env.WGF_BRIDGE_PORT;
  const envToken = process.env.WGF_BRIDGE_TOKEN;
  if (envPort && envToken) {
    return { host: '127.0.0.1', port: parseInt(envPort, 10), token: envToken };
  }
  try {
    const data = JSON.parse(fs.readFileSync(ENDPOINT_FILE, 'utf8'));
    if (data && data.port && data.token) {
      return { host: data.host || '127.0.0.1', port: data.port, token: data.token };
    }
  } catch (e) { /* 파일 부재/손상 — 아래에서 null */ }
  return null;
}

// ── 브리지 HTTP 프록시 ────────────────────────────────────────────────────────
// method/path/body → {status, json}. 브리지 미기동 시 명확한 connect 에러를 throw.
function bridgeRequest(method, p, bodyObj, timeoutMs) {
  const bridge = resolveBridge();
  if (!bridge) {
    return Promise.reject(new BridgeError('브리지 미기동 — 엔드포인트(.omc/wgf-editor/bridge-endpoint.json) 없음. /wgf-editor 로 브리지를 먼저 기동하세요.'));
  }
  return new Promise((resolve, reject) => {
    const body = bodyObj != null ? JSON.stringify(bodyObj) : null;
    const headers = {
      'X-WGF-Token': bridge.token,
      'Origin': `http://127.0.0.1:${bridge.port}`
    };
    if (body != null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request({ host: bridge.host, port: bridge.port, path: p, method, headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch (e) { json = null; }
        resolve({ status: res.statusCode, json, raw: data });
      });
    });
    req.on('error', (e) => {
      reject(new BridgeError('브리지 연결 실패(' + bridge.host + ':' + bridge.port + ') — ' + String(e && e.message || e)));
    });
    const to = (typeof timeoutMs === 'number') ? timeoutMs : 30000;
    req.setTimeout(to, () => { req.destroy(new Error('타임아웃 ' + to + 'ms')); });
    if (body != null) req.write(body);
    req.end();
  });
}

// 브리지 관련 오류 — tools/call 결과로 구조화 에러(isError:true) 변환.
class BridgeError extends Error {}

// ── JSON-RPC 응답 헬퍼(newline-delimited 출력) ────────────────────────────────
function send(msg) {
  // JSON.stringify 는 제어문자를 이스케이프 → embedded newline 없음(stdio 스펙 만족).
  process.stdout.write(JSON.stringify(msg) + '\n');
}
function sendResult(id, result) { send({ jsonrpc: '2.0', id, result }); }
function sendError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  send({ jsonrpc: '2.0', id, error });
}

// tools/call 결과를 MCP content 형식으로. 구조화 데이터는 JSON 텍스트로 직렬화.
function toolText(obj) {
  return { content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] };
}
function toolError(message, detail) {
  const payload = detail !== undefined ? { ok: false, error: message, detail } : { ok: false, error: message };
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], isError: true };
}

// ── 도구 정의(tools/list 스키마 + tools/call 핸들러) ──────────────────────────
// 각 도구: { description, inputSchema, handler(args) → MCP content }.
// 핸들러는 무상태 — bridgeRequest 프록시만 사용한다.

const OBJ = (props, required) => ({ type: 'object', properties: props, required: required || [], additionalProperties: true });
const TRANSFORM_SCHEMA = OBJ({
  x: { type: 'number' }, y: { type: 'number' }, rotation: { type: 'number' },
  scaleX: { type: 'number' }, scaleY: { type: 'number' }, depth: { type: 'number' }
});

// 씬 스냅샷에서 첫 씬의 entities 배열 추출(무상태 — 받은 스냅샷만 가공).
function entitiesOf(snap) {
  const scenes = snap && snap.scene && Array.isArray(snap.scene.scenes) ? snap.scene.scenes : [];
  return (scenes[0] && Array.isArray(scenes[0].entities)) ? scenes[0].entities : [];
}

// addEntity/setTransform 등 씬 변경을 브리지에 프록시. 409(Play read-only) 명확 변환.
async function proxyCommand(command) {
  const r = await bridgeRequest('POST', '/api/command', { command });
  if (r.status === 409) return { rejected: true, status: 409, error: 'Play 모드 — 씬 read-only(§4.9)' };
  if (r.status !== 200 || !r.json || r.json.ok !== true) {
    return { rejected: true, status: r.status, error: (r.json && r.json.error) || ('브리지 오류 status=' + r.status) };
  }
  return { ok: true, seq: r.json.seq, newId: r.json.newId };
}

const TOOLS = {
  // ── 씬 조회 ────────────────────────────────────────────────────────────────
  scene_get: {
    description: '현재 씬 전체 스냅샷(엔티티·트랜스폼·컴포넌트·walls·meta)과 seq·연결 상태를 반환한다. 무상태 — 브리지 단일 진실에서 직접 읽음.',
    inputSchema: OBJ({}),
    async handler() {
      const r = await bridgeRequest('GET', '/api/scene');
      if (r.status !== 200 || !r.json) return toolError('씬 조회 실패', { status: r.status });
      return toolText({ ok: true, seq: r.json.seq, mode: r.json.mode, status: r.json.status, scene: r.json.scene });
    }
  },

  scene_query: {
    description: '씬 엔티티를 필터로 조회한다(무상태 — 스냅샷을 받아 가공). name(부분일치)·componentType(보유 컴포넌트 타입)·id 로 필터. 결과는 일치 엔티티 배열.',
    inputSchema: OBJ({
      name: { type: 'string', description: '이름 부분일치(대소문자 무시)' },
      componentType: { type: 'string', description: '이 타입 컴포넌트를 가진 엔티티만' },
      id: { type: 'string', description: '정확한 엔티티 id' }
    }),
    async handler(args) {
      const r = await bridgeRequest('GET', '/api/scene');
      if (r.status !== 200 || !r.json) return toolError('씬 조회 실패', { status: r.status });
      let ents = entitiesOf(r.json);
      const nameQ = args && typeof args.name === 'string' ? args.name.toLowerCase() : null;
      const ctQ = args && typeof args.componentType === 'string' ? args.componentType : null;
      const idQ = args && typeof args.id === 'string' ? args.id : null;
      if (idQ) ents = ents.filter((e) => e.id === idQ);
      if (nameQ) ents = ents.filter((e) => String(e.name || '').toLowerCase().includes(nameQ));
      if (ctQ) ents = ents.filter((e) => Array.isArray(e.components) && e.components.some((c) => c && c.type === ctQ));
      return toolText({ ok: true, count: ents.length, entities: ents });
    }
  },

  // ── 엔티티 CRUD ──────────────────────────────────────────────────────────────
  scene_add_entity: {
    description: '새 엔티티를 추가한다. name·transform·components 지정 가능. 반환에 브리지가 발급한 확정 id(newId)가 포함된다(이후 도구에서 이 id 사용).',
    inputSchema: OBJ({
      name: { type: 'string' },
      transform: TRANSFORM_SCHEMA,
      components: { type: 'array', items: { type: 'object' } }
    }),
    async handler(args) {
      const entity = {
        name: (args && args.name) || 'entity',
        transform: (args && args.transform) || {},
        components: (args && Array.isArray(args.components)) ? args.components : []
      };
      const r = await proxyCommand({ type: 'addEntity', entity });
      if (r.rejected) return toolError(r.error, { status: r.status });
      return toolText({ ok: true, id: r.newId, seq: r.seq });
    }
  },

  scene_update_entity: {
    description: '엔티티의 transform 을 패치한다(부분 갱신). id 필수. (name 변경·계층 변경은 미지원 — scene_set_transform 와 동등한 경로.)',
    inputSchema: OBJ({ id: { type: 'string' }, transform: TRANSFORM_SCHEMA }, ['id']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      if (!args.transform || typeof args.transform !== 'object') return toolError('transform 필수');
      const r = await proxyCommand({ type: 'setTransform', id: args.id, transform: args.transform });
      if (r.rejected) return toolError(r.error, { status: r.status });
      return toolText({ ok: true, seq: r.seq });
    }
  },

  scene_delete_entity: {
    description: '엔티티를 삭제한다. id 필수.',
    inputSchema: OBJ({ id: { type: 'string' } }, ['id']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      const r = await proxyCommand({ type: 'removeEntity', id: args.id });
      if (r.rejected) return toolError(r.error, { status: r.status });
      return toolText({ ok: true, seq: r.seq });
    }
  },

  scene_reparent: {
    description: '엔티티의 부모를 변경한다(계층 2A). parentId 생략/null = 루트로 승격. 자기참조·존재하지 않는 부모·사이클은 코어가 no-op 으로 거부(부모 불변). 부모-따라가기 시각합성은 어댑터 translate-only(코어 트랜스폼 불변·단일 진실). Play 모드면 409.',
    inputSchema: OBJ({ id: { type: 'string' }, parentId: { type: ['string', 'null'] } }, ['id']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      const parentId = (args.parentId == null) ? null : String(args.parentId);
      const r = await proxyCommand({ type: 'reparent', id: args.id, parentId });
      if (r.rejected) return toolError(r.error, { status: r.status });
      return toolText({ ok: true, seq: r.seq });
    }
  },

  // ── 컴포넌트 CRUD ────────────────────────────────────────────────────────────
  scene_add_component: {
    description: '엔티티에 컴포넌트를 추가한다. id·component(type 포함) 필수. 컴포넌트 타입은 SceneKit 화이트리스트 15종.',
    inputSchema: OBJ({ id: { type: 'string' }, component: OBJ({ type: { type: 'string' } }, ['type']) }, ['id', 'component']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      if (!args.component || typeof args.component.type !== 'string') return toolError('component.type 필수');
      const r = await proxyCommand({ type: 'addComponent', id: args.id, component: args.component });
      if (r.rejected) return toolError(r.error, { status: r.status });
      return toolText({ ok: true, seq: r.seq });
    }
  },

  scene_update_component: {
    description: '엔티티의 컴포넌트 필드를 패치한다. id·componentType·patch 필수.',
    inputSchema: OBJ({ id: { type: 'string' }, componentType: { type: 'string' }, patch: { type: 'object' } }, ['id', 'componentType', 'patch']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      if (typeof args.componentType !== 'string') return toolError('componentType 필수');
      if (!args.patch || typeof args.patch !== 'object') return toolError('patch 필수');
      const r = await proxyCommand({ type: 'updateComponent', id: args.id, componentType: args.componentType, patch: args.patch });
      if (r.rejected) return toolError(r.error, { status: r.status });
      return toolText({ ok: true, seq: r.seq });
    }
  },

  scene_remove_component: {
    description: '엔티티에서 컴포넌트를 제거한다. id·componentType 필수.',
    inputSchema: OBJ({ id: { type: 'string' }, componentType: { type: 'string' } }, ['id', 'componentType']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      if (typeof args.componentType !== 'string') return toolError('componentType 필수');
      const r = await proxyCommand({ type: 'removeComponent', id: args.id, componentType: args.componentType });
      if (r.rejected) return toolError(r.error, { status: r.status });
      return toolText({ ok: true, seq: r.seq });
    }
  },

  scene_set_transform: {
    description: '엔티티의 트랜스폼을 패치한다(x·y·rotation·scaleX·scaleY·depth 부분 갱신). id·transform 필수.',
    inputSchema: OBJ({ id: { type: 'string' }, transform: TRANSFORM_SCHEMA }, ['id', 'transform']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      if (!args.transform || typeof args.transform !== 'object') return toolError('transform 필수');
      const r = await proxyCommand({ type: 'setTransform', id: args.id, transform: args.transform });
      if (r.rejected) return toolError(r.error, { status: r.status });
      return toolText({ ok: true, seq: r.seq });
    }
  },

  scene_screenshot: {
    description: '에디터 뷰포트 스크린샷(PNG)을 캡처한다. 연결된 브라우저 뷰포트에 캡처를 요청해 canvas.toDataURL PNG 를 image content 로 반환한다. 브라우저 미오픈(헤드리스 편집) 시 "뷰포트 없음" 구조화 에러를 반환(편집은 계속 가능).',
    inputSchema: OBJ({}),
    async handler() {
      // 브리지가 연결된 브라우저 뷰포트에 SSE 로 캡처를 요청하고 PNG 회신을 기다린다(2B).
      //  프록시 타임아웃은 브리지 캡처 타임아웃(기본 4s)보다 길게 잡아 헤드리스 판정을 브리지에 위임.
      const r = await bridgeRequest('GET', '/api/screenshot/capture', null, 15000);
      if (r.status !== 200 || !r.json) return toolError('스크린샷 캡처 실패', { status: r.status });
      if (r.json.ok !== true) {
        // 헤드리스(브라우저 미오픈/타임아웃) — 구조화 에러. 편집은 계속 가능.
        return toolError('뷰포트 없음 — 브라우저 미오픈(헤드리스 편집). 브라우저(/wgf-editor)를 열면 PNG 를 캡처합니다.', { headless: true, reason: r.json.reason });
      }
      // PNG dataURL → MCP image content(base64). 헤드리스가 아니므로 실제 PNG 회신.
      const dataUrl = r.json.dataUrl || '';
      const m = dataUrl.match(/^data:(image\/png);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return toolError('스크린샷 응답 형식 오류', { detail: 'dataUrl' });
      return {
        content: [
          { type: 'image', data: m[2], mimeType: m[1] },
          { type: 'text', text: JSON.stringify({ ok: true, mimeType: m[1], bytes: r.json.bytes, width: r.json.width, height: r.json.height }) }
        ]
      };
    }
  },

  // ── E1 멀티 씬(목록/전환/추가/이름변경/삭제) — /api/scene/* 얇은 래퍼 ──────────
  //  baseDoc.scenes[] 가 권위. Claude 가 멀티씬 워크플로(레벨 추가·전환)를 구동.
  //  Play 모드 중 구조 변경(add/rename/remove/switch)은 브리지가 409 거부(§4.9 — 씬 read-only).
  //  ※ 인게임(play-runtime) SceneTrigger/requestScene 는 미구현(OQ4 결정론 계약은 open-questions 참조).
  scene_list: {
    description: '씬 목록을 반환한다 — scenes:[{id,name,entityCount}] + activeSceneId. read-only(권위 문서 무변이).',
    inputSchema: OBJ({}),
    async handler() {
      const r = await bridgeRequest('GET', '/api/scene/list');
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError('씬 목록 조회 실패', { status: r.status });
      return toolText({ ok: true, scenes: r.json.scenes, activeSceneId: r.json.activeSceneId, seq: r.json.seq });
    }
  },

  scene_switch: {
    description: '활성 씬을 전환한다. id 필수. 현재 씬 편집분은 보존(flush) 후 대상 씬을 로드한다. 이미 활성이면 멱등. Play 모드면 거부(§4.9).',
    inputSchema: OBJ({ id: { type: 'string' } }, ['id']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      const r = await bridgeRequest('POST', '/api/scene/switch', { id: args.id });
      if (r.status === 409) return toolError('Play 모드 — 씬 전환 불가(§4.9)', { status: 409 });
      if (r.status === 404) return toolError('씬 없음: ' + args.id, { status: 404 });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError('씬 전환 실패', { status: r.status });
      return toolText({ ok: true, activeSceneId: r.json.activeSceneId, seq: r.json.seq });
    }
  },

  scene_add: {
    description: '새 빈 씬을 추가한다(전환은 안 함). name 선택(기본 "Scene N"). Play 모드면 거부, 씬 수 상한(256) 초과 시 거부.',
    inputSchema: OBJ({ name: { type: ['string', 'null'] } }),
    async handler(args) {
      const body = (args && typeof args.name === 'string') ? { name: args.name } : {};
      const r = await bridgeRequest('POST', '/api/scene/add', body);
      if (r.status === 409) return toolError('Play 모드 — 씬 구조 read-only(§4.9)', { status: 409 });
      if (r.status === 400) return toolError((r.json && r.json.error) || '씬 추가 거부', { status: 400 });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError('씬 추가 실패', { status: r.status });
      return toolText({ ok: true, scene: r.json.scene, scenes: r.json.scenes, activeSceneId: r.json.activeSceneId, seq: r.json.seq });
    }
  },

  scene_rename: {
    description: '씬 이름을 변경한다. id·name 필수. Play 모드면 거부.',
    inputSchema: OBJ({ id: { type: 'string' }, name: { type: 'string' } }, ['id', 'name']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      if (typeof args.name !== 'string') return toolError('name 필수');
      const r = await bridgeRequest('POST', '/api/scene/rename', { id: args.id, name: args.name });
      if (r.status === 409) return toolError('Play 모드 — 씬 구조 read-only(§4.9)', { status: 409 });
      if (r.status === 404) return toolError('씬 없음: ' + args.id, { status: 404 });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError('씬 이름변경 실패', { status: r.status });
      return toolText({ ok: true, scenes: r.json.scenes, seq: r.json.seq });
    }
  },

  scene_remove: {
    description: '씬을 삭제한다. id 필수. 마지막 1개는 거부. 활성 씬 삭제 시 남은 첫 씬으로 전환. Play 모드면 거부.',
    inputSchema: OBJ({ id: { type: 'string' } }, ['id']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      const r = await bridgeRequest('POST', '/api/scene/remove', { id: args.id });
      if (r.status === 409) return toolError('Play 모드 — 씬 구조 read-only(§4.9)', { status: 409 });
      if (r.status === 404) return toolError('씬 없음: ' + args.id, { status: 404 });
      if (r.status === 400) return toolError((r.json && r.json.error) || '씬 삭제 거부(마지막 씬?)', { status: 400 });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError('씬 삭제 실패', { status: r.status });
      return toolText({ ok: true, scenes: r.json.scenes, activeSceneId: r.json.activeSceneId, seq: r.json.seq });
    }
  },

  // ── 역채널(에디터 챗) ────────────────────────────────────────────────────────
  editor_next_message: {
    description: '에디터에서 사용자가 보낸 미처리 메시지를 1건 가져온다(long-poll). 없으면 일정 시간 후 message:null 로 반환(재호출). 이 호출 자체가 Claude 루프 하트비트.',
    inputSchema: OBJ({}),
    async handler() {
      // 브리지 long-poll(최대 ~25s) — MCP 프록시 타임아웃을 그보다 길게(35s).
      const r = await bridgeRequest('GET', '/api/chat/next', null, 35000);
      if (r.status !== 200 || !r.json) return toolError('메시지 큐 조회 실패', { status: r.status });
      return toolText({ ok: true, message: r.json.message || null });
    }
  },

  editor_reply: {
    description: '에디터 챗에 Claude 응답을 표시한다(SSE 로 사용자에게 전달). text 필수, replyTo(처리한 메시지 id) 선택.',
    inputSchema: OBJ({ text: { type: 'string' }, replyTo: { type: ['number', 'string', 'null'] } }, ['text']),
    async handler(args) {
      if (!args || typeof args.text !== 'string') return toolError('text 필수');
      const r = await bridgeRequest('POST', '/api/chat/reply', { text: args.text, replyTo: (args.replyTo != null ? args.replyTo : null) });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError('응답 전송 실패', { status: r.status });
      return toolText({ ok: true, seq: r.json.seq });
    }
  },

  // ── Undo/Redo ────────────────────────────────────────────────────────────────
  undo: {
    description: '브리지 권위 Undo(직전 커맨드 되돌림). Play 모드면 거부.',
    inputSchema: OBJ({}),
    async handler() {
      const r = await bridgeRequest('POST', '/api/undo');
      if (r.status === 409) return toolError('Play 모드 — 씬 read-only(§4.9)', { status: 409 });
      if (r.status !== 200 || !r.json) return toolError('undo 실패', { status: r.status });
      return toolText({ ok: true, seq: r.json.seq, applied: r.json.applied });
    }
  },

  redo: {
    description: '브리지 권위 Redo. Play 모드면 거부.',
    inputSchema: OBJ({}),
    async handler() {
      const r = await bridgeRequest('POST', '/api/redo');
      if (r.status === 409) return toolError('Play 모드 — 씬 read-only(§4.9)', { status: 409 });
      if (r.status !== 200 || !r.json) return toolError('redo 실패', { status: r.status });
      return toolText({ ok: true, seq: r.json.seq, applied: r.json.applied });
    }
  },

  // ── 프로젝트 ──────────────────────────────────────────────────────────────────
  project_list: {
    description: 'games/ 하위의 프로젝트(scene.json 보유 slug) 목록을 반환한다.',
    inputSchema: OBJ({}),
    async handler() {
      const out = [];
      const roots = [path.resolve(REPO_ROOT, 'games'), path.resolve(REPO_ROOT, 'games', '_editor-samples')];
      for (const root of roots) {
        let entries;
        try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { continue; }
        for (const ent of entries) {
          if (!ent.isDirectory()) continue;
          const scenePath = path.join(root, ent.name, 'scene.json');
          if (fs.existsSync(scenePath)) {
            out.push({ slug: ent.name, scene: path.relative(REPO_ROOT, scenePath).split(path.sep).join('/') });
          }
        }
      }
      return toolText({ ok: true, count: out.length, projects: out });
    }
  },

  project_open: {
    description: '지정 프로젝트의 scene.json 으로 브리지가 보유한 씬을 교체한다. (v1: 브리지 재기동 없이 동적 교체는 미지원 — 현재 씬 정보와 안내를 반환. 다른 프로젝트는 WGF_BRIDGE_SCENE 로 브리지 기동.)',
    inputSchema: OBJ({ slug: { type: 'string' } }, ['slug']),
    async handler(args) {
      if (!args || typeof args.slug !== 'string') return toolError('slug 필수');
      // 무상태 프록시 — 동적 씬 교체 엔드포인트가 브리지에 없으므로 안내성 응답.
      const r = await bridgeRequest('GET', '/api/scene');
      const current = (r.json && r.json.scene && r.json.scene.slug) || null;
      return toolError('동적 project_open 미지원(v1) — WGF_BRIDGE_SCENE=games/' + args.slug + '/scene.json 로 브리지를 기동하세요.', { currentSlug: current });
    }
  },

  project_export: {
    description: '현재 씬을 무빌드 정적 게임(games/<slug>/{index.html,game.js})으로 내보낸다. slug 선택(기본 현재 씬 slug). (P3: 안내 — export.mjs CLI 로 실행. P4 에서 브리지 트리거 통합.)',
    inputSchema: OBJ({ slug: { type: 'string' } }),
    async handler() {
      return toolError('project_export 는 P4 에서 브리지 트리거 통합 예정 — 현재는 CLI: node editor/server/export.mjs <scene.json|slug>', { stub: true });
    }
  },

  // ── P4 결정형 스킬도구 실행(브리지 프록시 — 화이트리스트·인자스키마·execFile 은 브리지가 강제) ──
  skill_run_tool: {
    description: '결정형 검증 도구를 실행한다(화이트리스트: lint-scene·lint-rng·lint-juice·lint-kit-deps·qa-score). 브리지가 인자 스키마 검증 + execFile(배열 인자, 셸 미경유)로 안전 실행. file/target 에 "current" 를 주면 현재 씬을 임시 직렬화해 실행. 반환에 도구 exit·마지막 줄 JSON 포함. 화이트리스트 외 도구·인자 위반·경로 traversal 은 브리지가 거부.',
    inputSchema: OBJ({
      tool: { type: 'string', description: '도구명(lint-scene·lint-rng·lint-juice·lint-kit-deps·qa-score)' },
      args: { type: 'object', description: '도구별 인자(file·target·json·strict 등). file/target="current" → 현재 씬.' }
    }, ['tool']),
    async handler(args) {
      if (!args || typeof args.tool !== 'string') return toolError('tool 필수');
      const r = await bridgeRequest('POST', '/api/skill/run', { tool: args.tool, args: (args.args && typeof args.args === 'object') ? args.args : {} });
      if (r.status !== 200 || !r.json || r.json.ok !== true) {
        // 화이트리스트/인자 위반 등 4xx 거부 → 구조화 에러(도구 자체 실패와 구분).
        return toolError((r.json && r.json.error) || ('스킬 실행 거부 status=' + r.status), { status: r.status });
      }
      return toolText({ ok: true, tool: r.json.tool, exit: r.json.exit, json: r.json.json, stdout: r.json.stdout, stderr: r.json.stderr, timedOut: r.json.timedOut });
    }
  },

  // ── P4 에셋 ──────────────────────────────────────────────────────────────────
  asset_list: {
    description: '현재 씬의 assets.sprites(절차·CC0 스프라이트 def) 목록을 반환한다. 무상태 — 브리지 단일 진실에서 읽음.',
    inputSchema: OBJ({}),
    async handler() {
      const r = await bridgeRequest('GET', '/api/asset/list');
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError('에셋 조회 실패', { status: r.status });
      return toolText({ ok: true, assets: r.json.assets, seq: r.json.seq });
    }
  },

  asset_add_procedural: {
    description: '절차 스프라이트(PixelForge/VectorForge def 슬롯)를 assets.sprites 에 추가한다. id 필수(영숫자._- 1~64자). desc·w·h·def 선택. 추가 후 엔티티의 Sprite 컴포넌트에서 이 id 를 ref 할 수 있다.',
    inputSchema: OBJ({
      id: { type: 'string' }, desc: { type: 'string' },
      w: { type: 'number' }, h: { type: 'number' }, def: { type: 'object' }
    }, ['id']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      const asset = { id: args.id, desc: args.desc, w: args.w, h: args.h };
      if (args.def && typeof args.def === 'object') asset.def = args.def;
      const r = await bridgeRequest('POST', '/api/asset/add', { kind: 'procedural', asset });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError((r.json && r.json.error) || '에셋 추가 실패', { status: r.status });
      return toolText({ ok: true, asset: r.json.asset, seq: r.json.seq });
    }
  },

  asset_add_cc0: {
    description: 'CC0 라이브러리 스프라이트(url+license+credit)를 assets.sprites 에 추가한다. id·url 필수. license(기본 CC0-1.0)·credit·desc·w·h 선택. 스프라이트시트면 frameConfig{frameWidth,frameHeight,margin?,spacing?}+frame(셀 인덱스)으로 개별 프레임 1칸을 렌더한다. sprite-picker 가 고른 CC0 에셋을 여기로 주입한다.',
    inputSchema: OBJ({
      id: { type: 'string' }, url: { type: 'string' },
      license: { type: 'string' }, credit: { type: 'string' }, desc: { type: 'string' },
      w: { type: 'number' }, h: { type: 'number' },
      frameConfig: { type: 'object' }, frame: { type: 'number' }
    }, ['id', 'url']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      if (typeof args.url !== 'string') return toolError('url 필수');
      const asset = { id: args.id, url: args.url, license: args.license, credit: args.credit, desc: args.desc, w: args.w, h: args.h };
      if (args.frameConfig && typeof args.frameConfig === 'object') asset.frameConfig = args.frameConfig;
      if (typeof args.frame === 'number') asset.frame = args.frame;
      const r = await bridgeRequest('POST', '/api/asset/add', { kind: 'cc0', asset });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError((r.json && r.json.error) || '에셋 추가 실패', { status: r.status });
      return toolText({ ok: true, asset: r.json.asset, seq: r.json.seq });
    }
  },

  // ── 로컬 Unity 폴더 임포트(설계 §5) ─────────────────────────────────────────
  asset_scan_unity_folder: {
    description: '로컬 Unity 폴더를 스캔해 임포트 가능한 이미지·오디오와 각 라이선스 분류(allowed/warn/blocked)를 미리 보여준다(복사 안 함). folder 는 절대경로.',
    inputSchema: OBJ({ folder: { type: 'string' } }, ['folder']),
    async handler(args) {
      if (!args || typeof args.folder !== 'string') return toolError('folder 필수');
      const r = await bridgeRequest('POST', '/api/asset/unity-scan', { folder: args.folder });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError((r.json && r.json.error) || '스캔 실패', { status: r.status });
      return toolText({ ok: true, root: r.json.root, items: r.json.items, totals: r.json.totals, truncated: r.json.truncated });
    }
  },

  asset_import_unity: {
    description: '스캔 결과 중 selections 를 vendoring 임포트한다. warn 항목은 attested(owner+declaredLicense) 필수, blocked 는 거부. folder 는 절대경로, selections 는 [{relPath, id?, credit?, attested?:{owner,declaredLicense}}] 배열.',
    inputSchema: OBJ({
      folder: { type: 'string' },
      selections: { type: 'array', items: { type: 'object' } }
    }, ['folder', 'selections']),
    async handler(args) {
      if (!args || typeof args.folder !== 'string') return toolError('folder 필수');
      if (!Array.isArray(args.selections)) return toolError('selections 배열 필수');
      const r = await bridgeRequest('POST', '/api/asset/unity-import', { folder: args.folder, selections: args.selections });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError((r.json && r.json.error) || '임포트 실패', { status: r.status });
      return toolText({ ok: true, added: r.json.added, rejected: r.json.rejected, seq: r.json.seq });
    }
  },

  // ── 2D 프리팹(서브트리 깊은복제·id재발급·Variant금지, ADR-003) ──────────────────
  scene_duplicate: {
    description: '선택 엔티티의 서브트리(루트+자식 계층)를 즉석 복제한다(Ctrl+D 류). id 필수. 깊은복제 + 새 id 재발급 + 배치-내부 parentId 리맵을 한 원자 명령(단일 undo)으로 수행. parentId 미지정이면 루트의 현재 부모를 유지(같은 계층에 복제). 반환에 새 엔티티 id 목록(ids). Play 모드면 거부.',
    inputSchema: OBJ({ id: { type: 'string' }, parentId: { type: ['string', 'null'] } }, ['id']),
    async handler(args) {
      if (!args || typeof args.id !== 'string') return toolError('id 필수');
      const body = { id: args.id };
      if (args.parentId != null) body.parentId = String(args.parentId);
      const r = await bridgeRequest('POST', '/api/scene/duplicate', body);
      if (r.status === 409) return toolError('Play 모드 — 씬 read-only(§4.9)', { status: 409 });
      if (r.status === 404) return toolError('엔티티 없음: ' + args.id, { status: 404 });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError((r.json && r.json.error) || '복제 실패', { status: r.status });
      return toolText({ ok: true, ids: r.json.ids, seq: r.json.seq });
    }
  },

  scene_save_prefab: {
    description: '엔티티 서브트리를 명명 프리팹으로 디스크에 저장한다(games/<slug>/prefabs/<name>.json). rootId(루트 엔티티) 필수, name 선택(기본 rootId). 프리팹은 일회성 깊은복제 템플릿(Variant·라이브 연결 없음). 현재 씬이 games/<slug> 가 아니면 거부.',
    inputSchema: OBJ({ name: { type: 'string' }, rootId: { type: 'string' } }, ['rootId']),
    async handler(args) {
      if (!args || typeof args.rootId !== 'string') return toolError('rootId 필수');
      const body = { rootId: args.rootId };
      if (args.name != null) body.name = String(args.name);
      const r = await bridgeRequest('POST', '/api/prefab/save', body);
      if (r.status === 409) return toolError((r.json && r.json.error) || '프리팹 저장 대상 없음(games/<slug> 아님)', { status: 409 });
      if (r.status === 404) return toolError('엔티티 없음: ' + args.rootId, { status: 404 });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError((r.json && r.json.error) || '프리팹 저장 실패', { status: r.status });
      return toolText({ ok: true, name: r.json.name, root: r.json.root, count: r.json.count });
    }
  },

  scene_list_prefabs: {
    description: '현재 게임(games/<slug>)의 저장된 프리팹 목록을 반환한다 — prefabs:[{name, root, count}].',
    inputSchema: OBJ({}),
    async handler() {
      const r = await bridgeRequest('GET', '/api/prefab/list');
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError('프리팹 목록 조회 실패', { status: r.status });
      return toolText({ ok: true, prefabs: r.json.prefabs });
    }
  },

  scene_instantiate_prefab: {
    description: '저장된 프리팹을 현재 씬에 인스턴스화한다(서브트리 깊은복제 + id 재발급, 단일 undo). name 필수. x·y(루트 배치 좌표)·parentId(부모 컨테이너) 선택. 반환에 새 엔티티 id 목록. Play 모드면 거부.',
    inputSchema: OBJ({ name: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, parentId: { type: ['string', 'null'] } }, ['name']),
    async handler(args) {
      if (!args || typeof args.name !== 'string') return toolError('name 필수');
      const body = { name: args.name };
      if (typeof args.x === 'number') body.x = args.x;
      if (typeof args.y === 'number') body.y = args.y;
      if (args.parentId != null) body.parentId = String(args.parentId);
      const r = await bridgeRequest('POST', '/api/prefab/instantiate', body);
      if (r.status === 409) return toolError('Play 모드 — 씬 read-only(§4.9)', { status: 409 });
      if (r.status === 404) return toolError('프리팹 없음: ' + args.name, { status: 404 });
      if (r.status !== 200 || !r.json || r.json.ok !== true) return toolError((r.json && r.json.error) || '인스턴스화 실패', { status: r.status });
      return toolText({ ok: true, ids: r.json.ids, seq: r.json.seq, name: r.json.name });
    }
  }
};

// ── tools/list 스키마 배열 생성 ───────────────────────────────────────────────
function listTools() {
  return Object.keys(TOOLS).map((name) => ({
    name,
    description: TOOLS[name].description,
    inputSchema: TOOLS[name].inputSchema
  }));
}

// ── JSON-RPC 디스패치 ─────────────────────────────────────────────────────────
let initialized = false;

async function dispatch(msg) {
  // 알림(notification) — id 없음. 응답하지 않는다.
  const isNotification = (msg.id === undefined || msg.id === null);

  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    if (!isNotification) sendError(msg.id, -32600, 'Invalid Request — jsonrpc/method 필요');
    return;
  }

  switch (msg.method) {
    case 'initialize': {
      initialized = true;
      sendResult(msg.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO
      });
      return;
    }
    case 'notifications/initialized':
    case 'initialized':           // 일부 클라가 짧은 이름 사용 — 관용 처리.
      return;                     // 알림 — 무응답.
    case 'ping':
      if (!isNotification) sendResult(msg.id, {});
      return;
    case 'tools/list': {
      sendResult(msg.id, { tools: listTools() });
      return;
    }
    case 'tools/call': {
      const params = msg.params || {};
      const name = params.name;
      const args = params.arguments || {};
      const tool = TOOLS[name];
      if (!tool) { sendError(msg.id, -32602, 'Unknown tool: ' + name); return; }
      try {
        const result = await tool.handler(args);
        sendResult(msg.id, result);
      } catch (e) {
        if (e instanceof BridgeError) {
          // 브리지 연결류 오류 — tools/call 결과 isError 로(프로토콜 정상, 도구 실패).
          sendResult(msg.id, toolError(String(e.message || e)));
        } else {
          sendError(msg.id, -32603, 'Internal error: ' + String(e && e.message || e));
        }
      }
      return;
    }
    default:
      if (!isNotification) sendError(msg.id, -32601, 'Method not found: ' + msg.method);
      return;
  }
}

// ── stdin 라인 리더(newline-delimited JSON-RPC) ───────────────────────────────
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;     // 빈 줄 무시
  let msg;
  try { msg = JSON.parse(trimmed); } catch (e) {
    // parse 오류 — id 미상이므로 null id 로 -32700.
    sendError(null, -32700, 'Parse error');
    return;
  }
  // 배치(array) 지원: 각 메시지 개별 디스패치.
  if (Array.isArray(msg)) { for (const m of msg) dispatch(m); return; }
  dispatch(msg);
});

rl.on('close', () => process.exit(0));
log('MCP 어댑터 시작 — newline-delimited JSON-RPC, 엔드포인트 파일=' + ENDPOINT_FILE);
