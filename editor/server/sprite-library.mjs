/* ============================================================================
 * WGF Studio — 통합 스프라이트 브라우저 백엔드 코어 (순수 함수 모듈)
 * ----------------------------------------------------------------------------
 * 계약서(.omc/plans/sprite-browser-plan.md) §1·§2.1·§2.2·§2.3 의 백엔드 로직을
 * bridge.mjs 에서 분리한 순수 함수 모듈. Node 빌트인(fs·path·crypto)만 사용(zero-dep).
 *
 * 책임:
 *  - 카탈로그(skills/wgf-sprite-picker/catalog/packs.json + sources.json) 병합 읽기
 *    + preview 웹경로 변환 + downloaded(assets-library/<id>/) 판정(인메모리 mtime 캐시).
 *  - 로컬 스프라이트 소스 스캔(assets-library/** + 현재 게임 assets/**) → sheet/collection
 *    항목화(사이드카 wgf-slices.json 병합, zip·dotfile 제외, 상한 ~2000).
 *  - 슬라이스 사이드카(assets-library/wgf-slices.json) read/write 머지(frameConfig 위생화).
 *  - 경로검증 헬퍼(assets-library/ 또는 games/ 하위로 정규화, traversal·dotfile 차단).
 *
 * 보안 원칙(반드시 유지):
 *  - 모든 사용자 입력 경로는 resolveLibraryPath 로 assets-library/ 또는 games/ 안으로만
 *    정규화(../ traversal·절대경로 탈출·dotfile 세그먼트 거부). 쓰기는 사이드카 1개 파일뿐.
 *  - frameConfig 위생화는 bridge.sanitizeFrameMeta 와 동등(전부 정수 강제, 음수 거부).
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ── 상수 ─────────────────────────────────────────────────────────────────────
export const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
// 라이브러리 스캔 항목 상한(계약 §2.2 ~2000).
export const MAX_LIBRARY_ITEMS = 2000;
// 스캔 디렉터리 깊이 가드(DoS).
const MAX_SCAN_DEPTH = 12;
// 슬라이스 사이드카 경로(repo-상대). 키 = repo-상대 이미지 경로.
export const SLICES_REL = 'assets-library/wgf-slices.json';

// 카탈로그 디렉터리(웹 서빙 prefix 와 정합).
const CATALOG_DIR_REL = 'skills/wgf-sprite-picker/catalog';
const CATALOG_WEB_PREFIX = '/skills/wgf-sprite-picker/catalog';

// ── 경로검증 헬퍼 ──────────────────────────────────────────────────────────────
// 사용자 입력 repo-상대 경로를 assets-library/ 또는 games/ 하위로만 정규화해 절대경로 반환.
// 벗어나거나(traversal·절대경로 탈출) dotfile 세그먼트가 있으면 null(거부 신호).
// bridge.resolveScopedPath 와 동일한 가드 철학(dotfile·제어문자·범위 prefix 검사).
export function resolveLibraryPath(repoRoot, relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0 || relPath.length > 1024) return null;
  // NUL 등 제어문자 차단(charCodeAt 루프 — 정규식 리터럴에 제어문자 박힘 방지).
  for (let i = 0; i < relPath.length; i++) { if (relPath.charCodeAt(i) < 0x20) return null; }
  // dotfile 세그먼트 차단(.env·.git·.. 등) — '.' 자체는 허용.
  const segs = relPath.split(/[\/\\]/);
  if (segs.some((s) => s.startsWith('.') && s !== '.')) return null;
  const abs = path.resolve(repoRoot, relPath);
  const libRoot = path.resolve(repoRoot, 'assets-library');
  const gamesRoot = path.resolve(repoRoot, 'games');
  const inLib = (abs === libRoot) || abs.startsWith(libRoot + path.sep);
  const inGames = (abs === gamesRoot) || abs.startsWith(gamesRoot + path.sep);
  if (!inLib && !inGames) return null;
  return abs;
}

// repo 기준 상대경로(슬래시 정규화).
function relOf(repoRoot, abs) {
  return path.relative(repoRoot, abs).split(path.sep).join('/');
}

// 안정 id: relPath 를 영숫자._- 로 안전화(컴포넌트 id 가 아니라 UI 키이므로 길이 제약 느슨).
function stableId(relPath) {
  return String(relPath || '')
    .replace(/[^A-Za-z0-9._\-\/]+/g, '-')
    .replace(/[\/]/g, '__')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '') || 'sprite';
}

// ── frameConfig 위생화(bridge.sanitizeFrameMeta 동등) ─────────────────────────
// frameWidth/frameHeight 가 양수일 때만 채택, margin/spacing 은 음수 아닐 때만. 전부 정수 강제.
// 시트가 아니면(유효 frameConfig 없으면) null.
export function sanitizeFrameConfig(fc) {
  if (!fc || typeof fc !== 'object') return null;
  if (typeof fc.frameWidth !== 'number' || !(fc.frameWidth > 0)) return null;
  if (typeof fc.frameHeight !== 'number' || !(fc.frameHeight > 0)) return null;
  const out = { frameWidth: fc.frameWidth | 0, frameHeight: fc.frameHeight | 0 };
  if (typeof fc.margin === 'number' && fc.margin >= 0) out.margin = fc.margin | 0;
  if (typeof fc.spacing === 'number' && fc.spacing >= 0) out.spacing = fc.spacing | 0;
  return out;
}

// frames[](비균일 명시 영역) 위생화 — 각 {name?,x,y,w,h} 정수 강제, w/h 양수만.
function sanitizeFrames(frames) {
  if (!Array.isArray(frames)) return null;
  const out = [];
  for (const f of frames) {
    if (!f || typeof f !== 'object') continue;
    if (typeof f.x !== 'number' || typeof f.y !== 'number') continue;
    if (typeof f.w !== 'number' || !(f.w > 0) || typeof f.h !== 'number' || !(f.h > 0)) continue;
    const item = { x: f.x | 0, y: f.y | 0, w: f.w | 0, h: f.h | 0 };
    if (typeof f.name === 'string') item.name = f.name.slice(0, 64);
    out.push(item);
  }
  return out.length ? out : null;
}

// anims[] 위생화 — 각 {key,frames:[셀idx],fps,loop}. frames 는 0 이상 정수 인덱스만.
function sanitizeAnims(anims) {
  if (!Array.isArray(anims)) return null;
  const out = [];
  for (const a of anims) {
    if (!a || typeof a !== 'object') continue;
    if (typeof a.key !== 'string' || a.key.length === 0) continue;
    const frames = Array.isArray(a.frames)
      ? a.frames.filter((n) => typeof n === 'number' && n >= 0).map((n) => n | 0)
      : [];
    const anim = { key: a.key.slice(0, 64), frames };
    if (typeof a.fps === 'number' && a.fps > 0) anim.fps = a.fps | 0;
    anim.loop = a.loop !== false;
    out.push(anim);
  }
  return out.length ? out : null;
}

// excludedFrames 위생화 — 0 이상 정수 인덱스 배열.
function sanitizeExcluded(excluded) {
  if (!Array.isArray(excluded)) return null;
  const out = excluded.filter((n) => typeof n === 'number' && n >= 0).map((n) => n | 0);
  return out.length ? out : null;
}

// patch(부분) 를 위생화해 사이드카에 저장 가능한 항목으로 만든다. 키가 없으면 미설정(머지 시 보존).
// 반환: { name?, frameConfig?, frames?, anims?, excludedFrames? }(존재하는 키만).
export function sanitizeSlicePatch(patch) {
  const out = {};
  if (!patch || typeof patch !== 'object') return out;
  if (typeof patch.name === 'string') out.name = patch.name.slice(0, 128);
  if ('frameConfig' in patch) {
    const fc = sanitizeFrameConfig(patch.frameConfig);
    if (fc) out.frameConfig = fc;
  }
  if ('frames' in patch) {
    const fr = sanitizeFrames(patch.frames);
    if (fr) out.frames = fr;
  }
  if ('anims' in patch) {
    const an = sanitizeAnims(patch.anims);
    if (an) out.anims = an;
  }
  if ('excludedFrames' in patch) {
    const ex = sanitizeExcluded(patch.excludedFrames);
    if (ex) out.excludedFrames = ex;
  }
  return out;
}

// ── 인메모리 mtime 캐시(packs/sources/slices 재파싱 최소화, 계약 §2.6) ─────────
const _cache = new Map();   // absPath -> { mtimeMs, data }

// JSON 파일을 mtime 캐시로 읽는다. 부재/손상 시 fallback 반환(캐시 안 함).
function readJsonCached(absPath, fallback) {
  let st;
  try { st = fs.statSync(absPath); }
  catch (e) { return fallback; }
  const hit = _cache.get(absPath);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.data;
  let data;
  try { data = JSON.parse(fs.readFileSync(absPath, 'utf8')); }
  catch (e) { return fallback; }
  _cache.set(absPath, { mtimeMs: st.mtimeMs, data });
  return data;
}

// ── readCatalog(계약 §2.1) ─────────────────────────────────────────────────────
// packs.json + sources.json 병합. preview 를 웹경로로, downloaded 판정 추가.
// 반환: { packs:[...], sources:[...] }.
export function readCatalog(repoRoot) {
  const packsPath = path.resolve(repoRoot, CATALOG_DIR_REL, 'packs.json');
  const sourcesPath = path.resolve(repoRoot, CATALOG_DIR_REL, 'sources.json');
  const packsDoc = readJsonCached(packsPath, { packs: [] });
  const sourcesDoc = readJsonCached(sourcesPath, { sources: [] });

  const rawPacks = Array.isArray(packsDoc.packs) ? packsDoc.packs : [];
  const libRoot = path.resolve(repoRoot, 'assets-library');

  const packs = rawPacks.map((p) => {
    const id = typeof p.id === 'string' ? p.id : '';
    // preview(상대경로 thumbnails/x.png)를 웹경로로. 없으면 null.
    let preview = null;
    if (typeof p.preview === 'string' && p.preview.length > 0) {
      // 안전: 슬래시 정규화 + 선행 슬래시 제거 + '..' 세그먼트 제거(표시용 경로 가벼운 정리).
      const rel = p.preview.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\.(\/|$)/g, '');
      preview = CATALOG_WEB_PREFIX + '/' + rel;
    }
    // downloaded = assets-library/<id>/ 존재여부(디렉터리).
    let downloaded = false;
    if (id) {
      try { downloaded = fs.statSync(path.join(libRoot, id)).isDirectory(); }
      catch (e) { downloaded = false; }
    }
    return {
      id,
      sourceId: typeof p.sourceId === 'string' ? p.sourceId : '',
      name: typeof p.name === 'string' ? p.name : id,
      style: typeof p.style === 'string' ? p.style : '',
      contentTypes: Array.isArray(p.contentTypes) ? p.contentTypes.slice() : [],
      tags: Array.isArray(p.tags) ? p.tags.slice() : [],
      tileSize: (typeof p.tileSize === 'number' && p.tileSize > 0) ? (p.tileSize | 0) : null,
      safetyTier: typeof p.safetyTier === 'string' ? p.safetyTier : '',
      license: typeof p.license === 'string' ? p.license : '',
      preview,
      previewUrl: typeof p.previewUrl === 'string' ? p.previewUrl : '',
      downloadUrl: typeof p.downloadUrl === 'string' ? p.downloadUrl : '',
      notes: typeof p.notes === 'string' ? p.notes : '',
      downloaded
    };
  });

  const rawSources = Array.isArray(sourcesDoc.sources) ? sourcesDoc.sources : [];
  const sources = rawSources.map((s) => ({
    id: typeof s.id === 'string' ? s.id : '',
    name: typeof s.name === 'string' ? s.name : '',
    safetyTier: typeof s.safetyTier === 'string' ? s.safetyTier : ''
  }));

  return { packs, sources };
}

// ── readSlices / writeSlice(계약 §1.1·§2.3) ────────────────────────────────────
// 사이드카 assets-library/wgf-slices.json 전체 읽기(mtime 캐시). 부재 시 빈 구조.
export function readSlices(repoRoot) {
  const abs = path.resolve(repoRoot, SLICES_REL);
  const doc = readJsonCached(abs, { version: 1, sheets: {} });
  // 방어적 정규화.
  return {
    version: (doc && typeof doc.version === 'number') ? doc.version : 1,
    sheets: (doc && doc.sheets && typeof doc.sheets === 'object') ? doc.sheets : {}
  };
}

// 특정 relPath 의 슬라이스 메타를 patch 로 머지 저장(사이드카). frameConfig 등 위생화.
// 반환: { ok, item } 또는 { ok:false, code, error }. item = 머지 후 그 시트 항목(name 포함).
export function writeSlice(repoRoot, relPath, patch) {
  const abs = resolveLibraryPath(repoRoot, relPath);
  if (!abs) return { ok: false, code: 400, error: 'relPath 범위 밖/traversal 거부: ' + JSON.stringify(String(relPath).slice(0, 128)) };
  // 키는 정규화된 repo-상대 경로(슬래시).
  const key = relOf(repoRoot, abs);
  const clean = sanitizeSlicePatch(patch);

  const slicesAbs = path.resolve(repoRoot, SLICES_REL);
  // 최신 디스크 상태로 머지(캐시 무관 — 쓰기 정합). 부재/손상 시 빈 구조.
  let doc = { version: 1, sheets: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(slicesAbs, 'utf8'));
    if (parsed && typeof parsed === 'object') {
      doc.version = typeof parsed.version === 'number' ? parsed.version : 1;
      doc.sheets = (parsed.sheets && typeof parsed.sheets === 'object') ? parsed.sheets : {};
    }
  } catch (e) { /* 부재/손상 — 빈 구조로 시작 */ }

  const prev = (doc.sheets[key] && typeof doc.sheets[key] === 'object') ? doc.sheets[key] : {};
  // 머지: patch 에 있는 키만 덮어쓴다(없는 키는 기존 보존).
  const merged = Object.assign({}, prev, clean);
  doc.sheets[key] = merged;

  // 원자적 쓰기(tmp 후 rename) — 부분 쓰기 손상 방지.
  try {
    fs.mkdirSync(path.dirname(slicesAbs), { recursive: true });
    const tmp = slicesAbs + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf8');
    fs.renameSync(tmp, slicesAbs);
    // 방금 쓴 내용으로 캐시 갱신(다음 read 가 stale 안 되게).
    try { const st = fs.statSync(slicesAbs); _cache.set(slicesAbs, { mtimeMs: st.mtimeMs, data: doc }); } catch (e) {}
  } catch (e) {
    return { ok: false, code: 500, error: '사이드카 저장 실패: ' + String(e && e.message || e) };
  }

  return { ok: true, item: Object.assign({ relPath: key }, merged) };
}

// ── scanLibrary(계약 §2.2) ─────────────────────────────────────────────────────
// 한 디렉터리(절대)를 재귀 스캔해 이미지 파일을 수집한다(zip·dotfile·심볼릭링크 제외).
// 반환: [{abs, rel, dir, base, ext}]. budget 으로 전체 상한 공유.
function collectImages(repoRoot, absRoot, budget) {
  const out = [];
  const stack = [{ dir: absRoot, depth: 0 }];
  while (stack.length > 0) {
    if (out.length >= budget.limit) { budget.truncated = true; break; }
    const { dir, depth } = stack.pop();
    if (depth > MAX_SCAN_DEPTH) continue;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { continue; }
    for (const ent of entries) {
      if (out.length >= budget.limit) { budget.truncated = true; break; }
      const name = ent.name;
      if (name.startsWith('.')) continue;                 // dotfile/dotdir 제외
      const abs = path.join(dir, name);
      // 심볼릭링크 미추적(보안) — lstat 으로 확인.
      let lst;
      try { lst = fs.lstatSync(abs); }
      catch (e) { continue; }
      if (lst.isSymbolicLink()) continue;
      if (lst.isDirectory()) {
        stack.push({ dir: abs, depth: depth + 1 });
        continue;
      }
      if (!lst.isFile()) continue;
      const ext = path.extname(name).toLowerCase();
      if (ext === '.zip') continue;                        // zip 제외(계약 §2.2)
      if (!IMAGE_EXT.includes(ext)) continue;
      out.push({
        abs,
        rel: relOf(repoRoot, abs),
        dir: relOf(repoRoot, dir),
        base: name,
        ext
      });
    }
  }
  return out;
}

// 파일 base 에서 번호 접미어 추출(collection 판정용). 예: tile_0000.png → {prefix:'tile', num:0}.
// 끝의 연속 숫자(앞에 _/-/직접 붙음)를 분리. 번호 패턴 아니면 null.
function numberSuffix(base) {
  const stem = base.replace(/\.[^.]+$/, '');               // 확장자 제거
  const m = stem.match(/^(.*?)[ _-]?(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10) };
}

// 현재 게임 dir(절대) 의 assets/ + assets-library/** 를 스캔해 sheet/collection 항목 배열 반환.
// gameDir = currentGameDir() 결과(절대경로) 또는 null(빈 씬). 사이드카(1.1) 병합.
// 반환: { ok:true, items:[...], truncated }.
export function scanLibrary(repoRoot, gameDir) {
  const budget = { limit: MAX_LIBRARY_ITEMS, truncated: false };
  const libRoot = path.resolve(repoRoot, 'assets-library');

  // 1) 이미지 수집(assets-library/** + 현재 게임 assets/**).
  let images = [];
  try {
    if (fs.statSync(libRoot).isDirectory()) {
      images = images.concat(collectImages(repoRoot, libRoot, budget));
    }
  } catch (e) { /* assets-library 없음 — 스킵 */ }

  if (gameDir) {
    const gameAssets = path.join(gameDir, 'assets');
    try {
      if (fs.statSync(gameAssets).isDirectory()) {
        images = images.concat(collectImages(repoRoot, gameAssets, budget));
      }
    } catch (e) { /* assets 없음 — 스킵 */ }
  }

  // 2) 디렉터리별 그룹화 → collection vs sheet 판정.
  const byDir = new Map();   // dir -> [imgInfo...]
  for (const img of images) {
    if (!byDir.has(img.dir)) byDir.set(img.dir, []);
    byDir.get(img.dir).push(img);
  }

  const slices = readSlices(repoRoot).sheets;
  const items = [];

  for (const [dir, imgs] of byDir.entries()) {
    // collection 후보: 같은 prefix + 같은 확장자의 번호 접미어 이미지가 4개 이상.
    const byPrefix = new Map();
    const nonNumbered = [];
    for (const img of imgs) {
      const ns = numberSuffix(img.base);
      if (ns) {
        const k = ns.prefix + '|' + img.ext;
        if (!byPrefix.has(k)) byPrefix.set(k, []);
        byPrefix.get(k).push(img);
      } else {
        nonNumbered.push(img);
      }
    }

    // packId(표시용 상위 묶음명) = repo-상대 디렉터리의 의미있는 팩/슬러그 이름.
    const packId = packIdOf(dir);

    for (const [k, group] of byPrefix.entries()) {
      if (group.length >= 4) {
        // collection 으로 EMIT.
        group.sort((a, b) => {
          const na = numberSuffix(a.base), nb = numberSuffix(b.base);
          return (na.num - nb.num);
        });
        const prefix = k.split('|')[0];
        // files = 웹 URL(이미지 src 용, 선행 /). filesRel = repo-상대 경로(use 의 relPath 로 직접 사용,
        // 선행 / 없음) — files[i] 와 filesRel[i] 는 같은 정렬 순서로 1:1 대응(프레임 index i).
        const files = group.map((g) => '/' + g.rel);
        const filesRel = group.map((g) => g.rel);
        const id = stableId(dir + '/' + prefix + '-collection');
        items.push({
          kind: 'collection',
          id,
          name: (prefix ? prefix.replace(/[ _-]+$/, '') : path.basename(dir)) + ' (' + group.length + ')',
          packId,
          dir,
          files,
          filesRel,
          count: group.length,
          tileSize: null   // 서버가 모름 — 클라가 이미지 로드 후 확정(null 허용)
        });
        if (items.length >= budget.limit) { budget.truncated = true; }
      } else {
        // 4개 미만 번호 묶음은 개별 sheet 로 떨어뜨린다(아래 nonNumbered 와 동일 취급).
        for (const g of group) nonNumbered.push(g);
      }
    }

    // 단일 시트 이미지(번호묶음 아님 또는 묶음 미달).
    for (const img of nonNumbered) {
      if (items.length >= budget.limit) { budget.truncated = true; break; }
      const sc = slices[img.rel] && typeof slices[img.rel] === 'object' ? slices[img.rel] : null;
      items.push({
        kind: 'sheet',
        id: stableId(img.rel),
        name: (sc && typeof sc.name === 'string') ? sc.name : img.base,
        packId,
        url: '/' + img.rel,
        relPath: img.rel,
        w: null,
        h: null,
        frameConfig: (sc && sc.frameConfig) ? sanitizeFrameConfig(sc.frameConfig) : null,
        frames: (sc && sc.frames) ? sanitizeFrames(sc.frames) : null,
        anims: (sc && sc.anims) ? (sanitizeAnims(sc.anims) || []) : [],
        excludedFrames: (sc && sc.excludedFrames) ? (sanitizeExcluded(sc.excludedFrames) || []) : []
      });
    }
  }

  // 안정 정렬(경로순) — 결정적 출력.
  items.sort((a, b) => {
    const ka = a.relPath || a.dir || a.id;
    const kb = b.relPath || b.dir || b.id;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return { ok: true, items, truncated: budget.truncated };
}

// repo-상대 디렉터리 경로에서 packId(표시용 상위 묶음명) 추출.
// assets-library/<pack>/... → <pack>. games/<slug>/assets/... → <slug>. 그 외 첫 세그먼트.
function packIdOf(dirRel) {
  const segs = String(dirRel || '').split('/').filter(Boolean);
  if (segs[0] === 'assets-library' && segs[1]) return segs[1];
  if (segs[0] === 'games' && segs[1]) return segs[1];
  return segs[0] || '';
}

// ── sha256(파일) — use 재사용 판정용(bridge 가 호출) ───────────────────────────
// (vendorFile 이 sha 를 주지만, 복사 전 동일 sha 기존 asset 재사용 판정에 소스 sha 가 필요.)
export function sha256OfFile(absFile) {
  const buf = fs.readFileSync(absFile);
  return crypto.createHash('sha256').update(buf).digest('hex');
}
