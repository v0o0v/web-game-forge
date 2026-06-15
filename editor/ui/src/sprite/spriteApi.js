/* ============================================================================
 * spriteApi — 통합 스프라이트 브라우저용 /api/sprite/* 호출 래퍼 (Lane B)
 * ----------------------------------------------------------------------------
 * 계약 §2(브리지 API)·§3.1. getBridgeConfig() 의 토큰·base 로 직접 fetch 한다.
 * bridgeTransport 의 apiFetch 와 동일 규칙(X-WGF-Token 헤더, base 접두). UI 컴포넌트가
 * controller 만 받아도 동작하도록 self-contained(transport 미주입 가능).
 *
 * 메서드:
 *   catalog()              → { ok, packs:[...], sources:[...] }
 *   library()              → { ok, items:[...] }
 *   slice(relPath, patch)  → { ok, item }
 *   use(body)              → { ok, asset, reused, seq }   (409 = 빈 씬)
 *   download(packId)       → { ok, packId, stdout } | { ok:false, error }
 *   isRemote()             → 브리지 연결 여부(local 이면 안내 비활성)
 *   assetUrl(relPathOrUrl) → 절대경로/외부 URL 정규화(이미지 src 용)
 *
 * 브리지 미연결(local) 시 모든 호출은 { ok:false, error } 로 안전 반환.
 * ==========================================================================*/
import { getBridgeConfig } from '../bridgeTransport.js';

// 동시 요청 제한(썸네일/시트 폭주 방지) — 간단한 세마포어 큐.
function makeLimiter(max) {
  let active = 0;
  const queue = [];
  function next() {
    if (active >= max || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(
      (v) => { active--; resolve(v); next(); },
      (e) => { active--; reject(e); next(); }
    );
  }
  return function limit(fn) {
    return new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
  };
}

// 이미지 로드 동시성 제한(라이브러리 시트 분해 시 네트워크 폭주 방지).
const imageLimiter = makeLimiter(6);

function cfg() { return getBridgeConfig(); }

async function apiFetch(method, path, bodyObj) {
  const c = cfg();
  if (!c) return { status: 0, json: null, offline: true };
  const opts = { method, headers: { 'X-WGF-Token': c.token || '' } };
  if (bodyObj != null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(bodyObj);
  }
  let res;
  try { res = await fetch((c.base || '') + path, opts); }
  catch (e) { return { status: 0, json: null, error: String(e) }; }
  let json = null;
  try { json = await res.json(); } catch (e) { json = null; }
  return { status: res.status, json };
}

export const spriteApi = {
  isRemote() { return !!cfg(); },

  // 이미지/썸네일 절대경로 정규화. http(s)/data/blob 은 그대로, 상대는 base 접두.
  assetUrl(p) {
    if (!p) return '';
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    const c = cfg();
    const base = (c && c.base) || '';
    return base + (p[0] === '/' ? p : '/' + p);
  },

  async catalog() {
    const { status, json, offline } = await apiFetch('GET', '/api/sprite/catalog');
    if (offline) return { ok: false, error: '브리지 미연결(local 모드)', packs: [], sources: [] };
    if (status !== 200 || !json || json.ok !== true) {
      return { ok: false, error: (json && json.error) || ('카탈로그 조회 실패 status=' + status), packs: [], sources: [] };
    }
    return { ok: true, packs: json.packs || [], sources: json.sources || [] };
  },

  async library() {
    const { status, json, offline } = await apiFetch('GET', '/api/sprite/library');
    if (offline) return { ok: false, error: '브리지 미연결(local 모드)', items: [] };
    if (status !== 200 || !json || json.ok !== true) {
      return { ok: false, error: (json && json.error) || ('라이브러리 조회 실패 status=' + status), items: [] };
    }
    // truncated: 스캔 항목 상한 도달(L-1) — LibraryTab 이 "일부만 표시됨" 배너로 안내.
    return { ok: true, items: json.items || [], truncated: !!json.truncated };
  },

  async slice(relPath, patch) {
    const { status, json, offline } = await apiFetch('POST', '/api/sprite/slice', { relPath, patch: patch || {} });
    if (offline) return { ok: false, error: '브리지 미연결(local 모드)' };
    if (status !== 200 || !json || json.ok !== true) {
      return { ok: false, error: (json && json.error) || ('슬라이스 저장 실패 status=' + status) };
    }
    return { ok: true, item: json.item };
  },

  async use(body) {
    const { status, json, offline } = await apiFetch('POST', '/api/sprite/use', body || {});
    if (offline) return { ok: false, error: '브리지 미연결(local 모드)', status: 0 };
    if (status !== 200 || !json || json.ok !== true) {
      // 409 = 현재 게임 디렉터리 없음(빈 씬). 호출부가 안내 토스트.
      return { ok: false, error: (json && json.error) || ('적용 실패 status=' + status), status };
    }
    return { ok: true, asset: json.asset, reused: !!json.reused, seq: json.seq };
  },

  async download(packId) {
    const { status, json, offline } = await apiFetch('POST', '/api/sprite/download', { packId });
    if (offline) return { ok: false, error: '브리지 미연결(local 모드)', status: 0 };
    if (status !== 200 || !json || json.ok !== true) {
      return { ok: false, error: (json && json.error) || ('다운로드 실패 status=' + status), status };
    }
    return { ok: true, packId: json.packId, stdout: json.stdout };
  },

  // 이미지를 동시성 제한 하에 로드(시트 분해 canvas 용). 성공 시 HTMLImageElement.
  loadImage(src) {
    return imageLimiter(() => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('이미지 로드 실패: ' + src));
      img.src = src;
    }));
  }
};
