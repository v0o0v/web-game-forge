/* ============================================================================
 * WGF Studio — 로컬 Unity 폴더 에셋 임포트 코어 (순수 함수 모듈)
 * ----------------------------------------------------------------------------
 * 설계 계약서 §3 구현. Node 빌트인(fs·path·crypto)만 사용(zero-dep).
 *
 * 책임:
 *  - 로컬 디스크의 Unity 프로젝트 폴더를 스캔해 우리 엔진이 쓸 수 있는 원시 에셋
 *    (이미지·오디오)만 추출하고, 각 항목의 라이선스를 탐지·분류한다(미리보기, 복사 X).
 *  - 선택된 항목을 games/<slug>/assets/imported/ 로 복사(vendoring)한다.
 *
 * 보안 원칙(반드시 유지):
 *  - 이 모듈은 repo 밖(소스)에서 "읽고" repo 안(games/<slug>/assets/imported)에만 "쓴다".
 *  - enumerate 시 심볼릭링크를 따라가지 않는다(lstat). 산출 절대경로가 스캔 root 밖이면 스킵.
 *  - 개수·바이트·깊이 가드(DoS). 과대 파일은 vendoring 거부.
 *  - 소스 경로(외부 절대경로) 검증은 호출측(bridge.resolveExternalFolder)이 담당.
 * ==========================================================================*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ── 상수 ─────────────────────────────────────────────────────────────────────
export const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
export const AUDIO_EXT = ['.wav', '.mp3', '.ogg', '.m4a'];

export const MAX_FILES = 2000;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;            // 25MB — 단일 파일 상한
export const MAX_TOTAL_SCAN_BYTES = 500 * 1024 * 1024;     // 500MB — 누적 스캔 바이트 상한
export const MAX_DEPTH = 12;

// Unity 빌드/캐시/VCS 디렉터리는 스캔 제외(노이즈·DoS).
export const SKIP_DIRS = new Set([
  'Library', 'Temp', 'obj', 'Logs', '.git', 'node_modules', '.vs', 'UserSettings'
]);

// IP 의심 이름(소문자 부분일치). skills/wgf-ip-license-guard 금칙 목록 기반.
export const FORBIDDEN_IP_NAMES = [
  'mario', 'luigi', 'peach', 'bowser', 'yoshi', 'toad', 'wario', 'waluigi',
  'link', 'zelda', 'ganon', 'hyrule',
  'pikachu', 'charizard', 'pokemon', 'pokémon', 'bulbasaur', 'squirtle',
  'sonic', 'tails', 'knuckles', 'eggman',
  'kirby', 'samus', 'metroid', 'megaman', 'pacman', 'pac-man',
  'sephiroth', 'cloud strife', 'kratos', 'master chief', 'lara croft',
  'donkey kong', 'crash bandicoot', 'spyro', 'sora', 'cuphead'
];

// 안전 기본 정책(assets.json 로드 실패 시 폴백).
const DEFAULT_POLICY = {
  allow: ['CC0', 'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'Zlib', 'CC-BY', 'CC-BY-SA'],
  denyAlways: ['ARR', 'unknown', 'nintendo'],
  ccByRequiresAttribution: true
};

// ── 라이선스 정규화(engine/tiled.js 의 normalizeLicense 와 정합) ───────────────
export function normalizeLicense(lic) {
  if (!lic) return 'unknown';
  const s = String(lic).toUpperCase().trim();
  if (s.indexOf('CC0') === 0 || s === 'CC-0' || s.indexOf('PUBLIC DOMAIN') === 0 || s === 'PD') return 'CC0';
  if (s.indexOf('CC-BY-SA') === 0 || s.indexOf('CC BY-SA') === 0) return 'CC-BY-SA';
  if (s.indexOf('CC-BY') === 0 || s.indexOf('CC BY') === 0) return 'CC-BY';
  if (s === 'USER-OWNED' || s === 'USER OWNED' || s === 'OWNED') return 'USER-OWNED';
  if (s === 'ARR' || s.indexOf('ALL RIGHTS RESERVED') === 0) return 'ARR';
  if (s === 'UNKNOWN' || s === '') return 'unknown';
  return s;
}

// list 안에 normLic/rawLic 와 매칭되는 항목이 있는지(대소문자 무관, 정규화 비교).
function listHas(list, normLic, rawLic) {
  if (!Array.isArray(list)) return false;
  for (let i = 0; i < list.length; i++) {
    const n = normalizeLicense(list[i]);
    if (n === normLic) return true;
    if (String(list[i]).toUpperCase() === String(rawLic || '').toUpperCase()) return true;
  }
  return false;
}

// ── IP 금칙어 플래그 ──────────────────────────────────────────────────────────
// name(파일명/suggestedId 등)에 금칙 IP 이름이 부분일치하면 hit 반환.
export function ipNameFlag(name) {
  const lower = String(name || '').toLowerCase();
  for (const ip of FORBIDDEN_IP_NAMES) {
    if (lower.includes(ip)) return { flagged: true, hit: ip };
  }
  return { flagged: false, hit: null };
}

// ── suggestedId 생성 ──────────────────────────────────────────────────────────
// relPath 의 basename(확장자 제거)을 영숫자._- 로 안전화. 1~64자. 충돌 시 접미어.
// taken: 이미 사용된 id Set(선택) — 충돌 회피.
export function suggestIdFromPath(relPath, taken) {
  const base = String(relPath || '').split(/[\/\\]/).pop() || 'asset';
  const dot = base.lastIndexOf('.');
  let stem = (dot > 0) ? base.slice(0, dot) : base;
  // 허용 외 문자는 '-' 로 치환, 연속 '-' 축약, 양끝 정리.
  let id = stem.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  if (id.length === 0) id = 'asset';
  if (id.length > 64) id = id.slice(0, 64).replace(/[-.]+$/, '');
  if (id.length === 0) id = 'asset';
  if (!(taken instanceof Set)) return id;
  if (!taken.has(id)) return id;
  // 충돌 회피: -2, -3 ... (64자 상한 유지)
  for (let n = 2; n < 100000; n++) {
    const suffix = '-' + n;
    const head = id.slice(0, Math.max(1, 64 - suffix.length)).replace(/[-.]+$/, '');
    const cand = head + suffix;
    if (!taken.has(cand)) return cand;
  }
  return id + '-' + crypto.randomBytes(3).toString('hex');
}

// ── 정책 로드(assets.json) ────────────────────────────────────────────────────
// repoRoot 기준 assets.json 의 policy 를 읽어 반환. 실패 시 안전 기본값.
export function loadPolicy(repoRoot) {
  try {
    const p = path.resolve(repoRoot, 'assets.json');
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
    const pol = doc && doc.policy && typeof doc.policy === 'object' ? doc.policy : null;
    if (!pol) return Object.assign({}, DEFAULT_POLICY);
    return {
      allow: Array.isArray(pol.allow) ? pol.allow.slice() : DEFAULT_POLICY.allow.slice(),
      denyAlways: Array.isArray(pol.denyAlways) ? pol.denyAlways.slice() : DEFAULT_POLICY.denyAlways.slice(),
      ccByRequiresAttribution: pol.ccByRequiresAttribution !== false
    };
  } catch (e) {
    return Object.assign({}, DEFAULT_POLICY);
  }
}

// ── sha256(파일) ──────────────────────────────────────────────────────────────
function sha256File(absFile) {
  const buf = fs.readFileSync(absFile);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ── 라이선스 텍스트에서 SPDX/CC 패턴 추출 ─────────────────────────────────────
// 텍스트 본문에서 라이선스 식별자를 찾아 정규화 문자열 반환(없으면 null).
function sniffLicenseText(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const head = text.slice(0, 8192); // 앞부분만(LICENSE/README 상단에 통상 존재)
  const upper = head.toUpperCase();
  // SPDX-License-Identifier: XXX
  const spdx = head.match(/SPDX-License-Identifier:\s*([A-Za-z0-9.\-+]+)/i);
  if (spdx) return normalizeLicense(spdx[1]);
  if (/\bCC0\b/i.test(head) || upper.includes('CREATIVE COMMONS ZERO') || upper.includes('PUBLIC DOMAIN')) return 'CC0';
  if (/\bCC[\s-]?BY[\s-]?SA\b/i.test(head)) return 'CC-BY-SA';
  if (/\bCC[\s-]?BY\b/i.test(head)) return 'CC-BY';
  if (/\bMIT\b/i.test(head) && /permission is hereby granted/i.test(head)) return 'MIT';
  if (/\bMIT License\b/i.test(head)) return 'MIT';
  if (/\bApache License\b/i.test(head) || /Apache-2\.0/i.test(head)) return 'Apache-2.0';
  if (/\bBSD\b/i.test(head) && /redistribution and use/i.test(head)) {
    if (/neither the name/i.test(head)) return 'BSD-3-Clause';
    return 'BSD-2-Clause';
  }
  if (/\bzlib\b/i.test(head) && /this software is provided ['"]?as-?is['"]?/i.test(head)) return 'Zlib';
  if (upper.includes('ALL RIGHTS RESERVED')) return 'ARR';
  return null;
}

// ── 보조 텍스트 파일 안전 read(크기 상한) ─────────────────────────────────────
// LICENSE/README/.meta/import-licenses.json 같은 라이선스 단서 파일을 선두 max 바이트만
// 읽는다. 사고·악의로 멀티-GB 파일이 끼어도 단일 거대 할당(OOM)으로 번지지 않게 한다
// (이미지·오디오 item 은 MAX_FILE_BYTES 로 보호되지만 보조 텍스트는 별도 가드 필요 — 보안 MED-1).
function readHeadText(absFile, max = 64 * 1024, hardCap = 8 * 1024 * 1024) {
  let fd = null;
  try {
    const st = fs.statSync(absFile);
    if (!st.isFile() || st.size > hardCap) return null;
    const len = Math.min(st.size, max);
    if (len === 0) return '';
    const buf = Buffer.allocUnsafe(len);
    fd = fs.openSync(absFile, 'r');
    const n = fs.readSync(fd, buf, 0, len, 0);
    return buf.subarray(0, n).toString('utf8');
  } catch (e) {
    return null;
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (e) { /* 무시 */ } }
  }
}

// ── .meta 형제 힌트 채집 ──────────────────────────────────────────────────────
// Unity .meta(YAML) 에서 guid 와(드물게) license 힌트만 가볍게 추출. 파서 미사용(정규식).
function readMetaHint(absMetaFile) {
  const hint = { guid: null, license: null };
  try {
    const txt = readHeadText(absMetaFile);
    if (txt == null) return hint;
    const g = txt.match(/^\s*guid:\s*([0-9a-fA-F]+)\s*$/m);
    if (g) hint.guid = g[1];
    // 우리 규약/일부 임포터가 넣는 license 힌트(있으면).
    const l = txt.match(/license:\s*["']?([A-Za-z0-9.\-+ ]+)["']?/i);
    if (l) hint.license = normalizeLicense(l[1].trim());
  } catch (e) { /* 무시 */ }
  return hint;
}

// ── import-licenses.json 로드(우리 규약) ──────────────────────────────────────
// { "<relPath>": {license, attribution?, owner?} } — 폴더/상위에 캐시(중복 IO 회피).
function findImportLicensesMap(absRoot) {
  // 스캔 root 1곳만 확인(상위 traverse 는 외부폴더라 생략 — 명세 ①은 root 의 규약 파일).
  try {
    const p = path.join(absRoot, 'import-licenses.json');
    if (fs.existsSync(p)) {
      // 규약 파일도 크기 상한(1MB) — 과대 파일은 무시(DoS 가드, 보안 MED-1).
      const txt = readHeadText(p, 1024 * 1024, 1024 * 1024);
      const doc = txt == null ? null : JSON.parse(txt);
      if (doc && typeof doc === 'object') return doc;
    }
  } catch (e) { /* 무시 */ }
  return null;
}

// 가장 가까운 LICENSE/COPYING/README/*.license 를 위로 올라가며(root 까지) 탐색.
function findNearestLicenseText(absFile, absRoot) {
  let dir = path.dirname(absFile);
  const rootNorm = path.resolve(absRoot);
  const names = ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'COPYING', 'COPYING.txt', 'README', 'README.md', 'README.txt'];
  for (let depth = 0; depth <= MAX_DEPTH; depth++) {
    for (const n of names) {
      const cand = path.join(dir, n);
      try {
        const st = fs.lstatSync(cand);
        if (st.isFile() && !st.isSymbolicLink()) {
          const lic = sniffLicenseText(readHeadText(cand));
          if (lic) return { license: lic, evidence: path.relative(absRoot, cand).split(path.sep).join('/') };
        }
      } catch (e) { /* 없음 */ }
    }
    // *.license 글롭(같은 폴더)
    try {
      for (const f of fs.readdirSync(dir)) {
        if (/\.license$/i.test(f)) {
          const cand = path.join(dir, f);
          const lic = sniffLicenseText(readHeadText(cand));
          if (lic) return { license: lic, evidence: path.relative(absRoot, cand).split(path.sep).join('/') };
        }
      }
    } catch (e) { /* 무시 */ }
    if (path.resolve(dir) === rootNorm) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ── detectLicense ─────────────────────────────────────────────────────────────
// 우선순위: ① import-licenses.json → ② .meta 힌트 → ③ 최근접 LICENSE/README SPDX
//           → ④ unknown.
// 반환 {license, source, attribution, evidence, guid?}.
export function detectLicense(absFile, root, ctx) {
  const absRoot = path.resolve(root);
  const relPath = path.relative(absRoot, absFile).split(path.sep).join('/');
  ctx = ctx || {};
  // ① import-licenses.json
  const licMap = (ctx.importLicenses !== undefined)
    ? ctx.importLicenses
    : findImportLicensesMap(absRoot);
  if (licMap && Object.prototype.hasOwnProperty.call(licMap, relPath)) {
    const e = licMap[relPath] || {};
    return {
      license: normalizeLicense(e.license),
      source: 'import-licenses.json',
      attribution: typeof e.attribution === 'string' ? e.attribution : '',
      owner: typeof e.owner === 'string' ? e.owner : '',
      evidence: 'import-licenses.json:' + relPath
    };
  }
  // ② .meta 형제 힌트
  let guid = null;
  try {
    const metaPath = absFile + '.meta';
    if (fs.existsSync(metaPath)) {
      const hint = readMetaHint(metaPath);
      guid = hint.guid;
      if (hint.license) {
        return {
          license: hint.license, source: '.meta', attribution: '',
          evidence: relPath + '.meta', guid
        };
      }
    }
  } catch (e) { /* 무시 */ }
  // ③ 최근접 LICENSE/README
  const near = findNearestLicenseText(absFile, absRoot);
  if (near) {
    return { license: near.license, source: 'license-file', attribution: '', evidence: near.evidence, guid };
  }
  // ④ unknown
  return { license: 'unknown', source: 'none', attribution: '', evidence: '', guid };
}

// ── licenseClassify ──────────────────────────────────────────────────────────
// detected + name + policy → {status:'allowed'|'warn'|'blocked', reason}.
//  - IP 금칙어(name) → blocked.
//  - bytes > MAX_FILE_BYTES → blocked(과대).
//  - license ∈ allow 또는 user-owned → allowed.
//  - denyAlways/unknown/그 외 → warn.
export function licenseClassify(detected, name, policy, bytes) {
  // 1) IP 금칙어 — 최우선 차단.
  const flag = ipNameFlag(name);
  if (flag.flagged) {
    return { status: 'blocked', reason: 'IP 의심: ' + flag.hit };
  }
  // 2) 과대 파일 차단(vendoring 거부).
  if (typeof bytes === 'number' && bytes > MAX_FILE_BYTES) {
    return { status: 'blocked', reason: '파일 과대(' + bytes + ' > ' + MAX_FILE_BYTES + ')' };
  }
  const pol = policy || DEFAULT_POLICY;
  const raw = (detected && detected.license) || 'unknown';
  const lic = normalizeLicense(raw);
  // 3) user-owned → allowed.
  if (lic === 'USER-OWNED') {
    return { status: 'allowed', reason: 'user-owned' };
  }
  // 4) allow 정책 매칭 → allowed.
  if (listHas(pol.allow, lic, raw)) {
    return { status: 'allowed', reason: '허용 라이선스: ' + lic };
  }
  // 5) 그 외(ARR/unknown/denyAlways) → warn.
  return { status: 'warn', reason: '라이선스 확인 필요: ' + lic };
}

// ── 확장자 → kind ────────────────────────────────────────────────────────────
function extKind(ext) {
  const e = ext.toLowerCase();
  if (IMAGE_EXT.includes(e)) return 'image';
  if (AUDIO_EXT.includes(e)) return 'audio';
  return null;
}

// ── scanLocalFolder ──────────────────────────────────────────────────────────
// absRoot 를 재귀 enumerate 해 임포트 가능한 이미지·오디오 항목과 분류를 반환(복사 X).
// opts: { policy?, repoRoot? } — policy 미지정 시 repoRoot 의 assets.json 에서 로드.
// 반환:
//   { ok, root, items:[Item], skipped:[{relPath,reason}], totals:{count,bytes}, truncated }
//   Item: { relPath, ext, kind, bytes, sha256, suggestedId,
//           detected:{license,source,attribution,evidence,guid?}, status, reason }
export function scanLocalFolder(absRoot, opts) {
  opts = opts || {};
  const root = path.resolve(absRoot);
  const policy = opts.policy || loadPolicy(opts.repoRoot || path.resolve(root, '..'));
  const importLicenses = findImportLicensesMap(root); // 1회 로드 후 재사용
  const items = [];
  const skipped = [];
  const takenIds = new Set();
  let totalBytes = 0;
  let fileCount = 0;
  let truncated = false;

  // 디렉터리 큐(BFS-ish, 깊이 추적). 심볼릭링크 디렉터리는 큐에 넣지 않음.
  const stack = [{ dir: root, depth: 0 }];

  while (stack.length > 0) {
    if (truncated) break;
    const { dir, depth } = stack.pop();
    if (depth > MAX_DEPTH) { skipped.push({ relPath: relOf(root, dir), reason: '깊이 초과' }); continue; }

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      skipped.push({ relPath: relOf(root, dir), reason: '읽기 실패: ' + String(e && e.code || e) });
      continue;
    }

    for (const ent of entries) {
      if (truncated) break;
      const name = ent.name;
      const abs = path.join(dir, name);

      // lstat 으로 심볼릭링크 미추적(보안 불변식).
      let lst;
      try { lst = fs.lstatSync(abs); }
      catch (e) { skipped.push({ relPath: relOf(root, abs), reason: 'lstat 실패' }); continue; }

      if (lst.isSymbolicLink()) {
        skipped.push({ relPath: relOf(root, abs), reason: '심볼릭링크 스킵' });
        continue;
      }

      // 산출 절대경로가 스캔 root 밖이면 스킵(이중 안전).
      const absResolved = path.resolve(abs);
      if (absResolved !== root && !absResolved.startsWith(root + path.sep)) {
        skipped.push({ relPath: name, reason: 'root 밖 경로 스킵' });
        continue;
      }

      if (lst.isDirectory()) {
        // dotdir·SKIP_DIRS 스킵.
        if (name.startsWith('.')) { skipped.push({ relPath: relOf(root, abs), reason: 'dotdir 스킵' }); continue; }
        if (SKIP_DIRS.has(name)) { skipped.push({ relPath: relOf(root, abs), reason: 'SKIP_DIRS' }); continue; }
        if (depth + 1 > MAX_DEPTH) { skipped.push({ relPath: relOf(root, abs), reason: '깊이 초과' }); continue; }
        stack.push({ dir: abs, depth: depth + 1 });
        continue;
      }

      if (!lst.isFile()) continue; // FIFO/소켓 등 스킵

      const ext = path.extname(name).toLowerCase();
      const kind = extKind(ext);
      // .meta·LICENSE 등은 item 이 아님(형제 힌트로만 사용) — 조용히 스킵.
      if (!kind) {
        // 확장자 외는 명시적 skipped 기록은 노이즈라 생략(스캔 노이즈 방지).
        continue;
      }

      // 개수·바이트 가드(이 파일을 추가하면 초과하는지 선검사).
      if (fileCount + 1 > MAX_FILES) { truncated = true; break; }
      const bytes = lst.size;
      if (totalBytes + bytes > MAX_TOTAL_SCAN_BYTES) { truncated = true; break; }

      fileCount += 1;
      totalBytes += bytes;

      const relPath = relOf(root, abs);
      const suggestedId = suggestIdFromPath(relPath, takenIds);
      takenIds.add(suggestedId);

      // sha256(과대 파일은 해시 생략 — 읽지 않음. blocked 처리).
      let sha256 = '';
      const detected = detectLicense(abs, root, { importLicenses });
      const cls = licenseClassify(detected, relPath, policy, bytes);
      if (cls.status !== 'blocked' || cls.reason.indexOf('과대') < 0) {
        // 과대 차단이 아니면 해시 계산(무결성·중복검출). 과대면 읽지 않음(메모리 보호).
        try { sha256 = sha256File(abs); }
        catch (e) { sha256 = ''; }
      }

      items.push({
        relPath, ext, kind, bytes, sha256, suggestedId,
        detected, status: cls.status, reason: cls.reason
      });
    }
  }

  return {
    ok: true, root, items, skipped,
    totals: { count: fileCount, bytes: totalBytes }, truncated
  };
}

// root 기준 상대경로(슬래시 정규화).
function relOf(root, abs) {
  const r = path.relative(root, abs);
  return r.split(path.sep).join('/');
}

// ── vendorFile ────────────────────────────────────────────────────────────────
// absSrc 를 destDir/safeName 으로 복사. 복사 전 크기 재확인(MAX_FILE_BYTES).
// 반환 {ok, relUrl?, absDest?, sha256?, bytes?, error?}.
//  relUrl 은 repoRoot 기준 상대(슬래시) — 호출측이 repoRoot 를 넘기면 계산, 아니면 absDest 만.
export function vendorFile(absSrc, destDir, safeName, opts) {
  opts = opts || {};
  let st;
  try { st = fs.lstatSync(absSrc); }
  catch (e) { return { ok: false, error: '소스 stat 실패: ' + String(e && e.code || e) }; }
  if (st.isSymbolicLink()) return { ok: false, error: '심볼릭링크 소스 거부' };
  if (!st.isFile()) return { ok: false, error: '일반 파일 아님' };
  if (st.size > MAX_FILE_BYTES) return { ok: false, error: '파일 과대(' + st.size + ' > ' + MAX_FILE_BYTES + ')' };

  try { fs.mkdirSync(destDir, { recursive: true }); }
  catch (e) { return { ok: false, error: 'destDir 생성 실패: ' + String(e && e.message || e) }; }

  const absDest = path.join(destDir, safeName);
  try {
    const buf = fs.readFileSync(absSrc);
    if (buf.length > MAX_FILE_BYTES) return { ok: false, error: '파일 과대(읽기 후)' };
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    fs.writeFileSync(absDest, buf);
    const out = { ok: true, absDest, sha256, bytes: buf.length };
    if (typeof opts.repoRoot === 'string') {
      out.relUrl = path.relative(opts.repoRoot, absDest).split(path.sep).join('/');
    }
    return out;
  } catch (e) {
    return { ok: false, error: '복사 실패: ' + String(e && e.message || e) };
  }
}
