#!/usr/bin/env node
/*
 * sprite-picker 팩 다운로드기 — CC0 팩 하나를 직접 받아 raw/ 로 푼다(무의존성).
 *
 * 왜: 피커의 "다운로드" 버튼은 직접 받지 않고 큐에만 적재한다(.sprite-picker-downloads.json).
 *     사용자가 채팅으로 돌아오면 Claude(리드)가 이 스크립트로 실제 원본을 받아 raw/ 에 풀고,
 *     이어서 analyze-pack.mjs 로 시트를 분석해 library.json 을 채운다.
 *
 * 안전:
 *   - **CC0 게이트.** packs.json 의 safetyTier 가 "cc0" 인 팩만 받는다(아니면 종료코드 2 + 사유).
 *   - **추측 다운로드 금지.** 페이지에서 직접 다운로드 링크를 못 찾으면 종료코드 3 + 사유.
 *   - 크기 가드(--max-mb, 기본 40), 매직바이트로 zip/이미지 확인, ZIP traversal 가드.
 *
 * 실행:
 *   node skills/sprite-picker/catalog/fetch-pack.mjs --pack <packId>
 *   node skills/sprite-picker/catalog/fetch-pack.mjs --pack kenney-tiny-dungeon --out assets-library
 *   node skills/sprite-picker/catalog/fetch-pack.mjs --pack <packId> --dry   # 해석만, 받지 않음
 *
 * stdout 마지막 줄은 항상 JSON 한 줄:
 *   { "ok":true, "packId":..., "rawDir":..., "files":[...] }   또는  { "ok":false, "error":... }
 *
 * 종료코드: 0 성공 / 1 사용법·내부오류 / 2 CC0 아님(게이트) / 3 다운로드 링크 해석 실패.
 *
 * 무의존성: Node 빌트인(fs/path/url/zlib)만. ZIP 해제는 zlib.inflateRawSync 직접 호출.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));        // catalog/
const PACKS = path.join(DIR, 'packs.json');

// ── 인자 파싱(prefetch.mjs 톤 유지) ───────────────────────────────────────────
const argv = process.argv.slice(2);
function flagVal(name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; }
const opt = {
  pack: flagVal('--pack'),
  id: flagVal('--id'),                 // 수동 모드: 카탈로그에 없는 팩의 슬러그(assets-library/<id>/)
  zip: flagVal('--zip'),               // 수동 모드: 로컬 ZIP/이미지 파일 경로
  url: flagVal('--url'),               // 수동 모드: 해석된 직접 파일 URL(itch 게이트 통과 후 등)
  out: flagVal('--out') || 'assets-library',
  dry: argv.includes('--dry'),
  maxMb: (function () { const v = flagVal('--max-mb'); return v ? parseInt(v, 10) : 40; })(),
  help: argv.includes('--help') || argv.includes('-h')
};
// 수동(off-catalog) 모드: --id 와 (--zip | --url) 가 주어지면 packs.json·리졸버를 건너뛴다.
opt.manual = !!(opt.id && (opt.zip || opt.url));

// stdout 마지막 줄에 JSON 한 줄을 보장하고 지정 코드로 종료.
function done(obj, code) {
  console.log(JSON.stringify(obj));
  process.exit(code == null ? (obj.ok ? 0 : 1) : code);
}

if (opt.help) {
  console.log('사용법:');
  console.log('  [카탈로그] node fetch-pack.mjs --pack <packId> [--out <dir=assets-library>] [--max-mb <n=40>] [--dry]');
  console.log('     packs.json 에서 CC0 팩을 찾아 직접 다운로드 링크를 해석하고 <out>/<packId>/raw/ 로 받아 ZIP 을 푼다.');
  console.log('  [수동]     node fetch-pack.mjs --id <slug> --zip <로컬ZIP경로>     # 로컬 파일을 raw/ 로 푼다');
  console.log('             node fetch-pack.mjs --id <slug> --url <직접파일URL>    # 해석된 직링크(itch 게이트 통과 후 등)를 받아 raw/ 로 푼다');
  console.log('     수동 모드는 카탈로그에 없는 off-catalog 팩용 — packs.json·리졸버·itch 차단을 건너뛴다.');
  console.log('     라이선스 게이트는 다음 단계(analyze-pack --license ...) 와 벤더링(assets.json) 에서 적용된다.');
  process.exit(0);
}
if (typeof fetch !== 'function') {
  done({ ok: false, error: '글로벌 fetch 필요(Node 18+). 현재: ' + process.version }, 1);
}
// 입력 검증: 카탈로그 모드(--pack) 또는 수동 모드(--id + --zip|--url) 중 하나여야 한다.
if (!opt.pack && !opt.manual) {
  if (opt.id && !opt.zip && !opt.url) {
    done({ ok: false, error: '수동 모드는 --zip <경로> 또는 --url <직접파일URL> 가 함께 필요합니다.' }, 1);
  }
  done({ ok: false, error: '--pack <packId> (카탈로그) 또는 --id <slug> --zip/--url (수동) 가 필요합니다.' }, 1);
}
if (opt.manual && opt.zip && opt.url) {
  done({ ok: false, error: '--zip 와 --url 은 동시에 쓸 수 없습니다(하나만).' }, 1);
}

const MAX_BYTES = opt.maxMb * 1024 * 1024;
const UA = 'sprite-picker-fetch/1.0';

// ── 매직바이트 판별 ────────────────────────────────────────────────────────────
function isZip(b) { return b.length > 4 && b[0] === 0x50 && b[1] === 0x4B && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07); }
function isImage(b) {
  if (b.length < 12) return false;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true;                       // PNG
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true;                                         // JPG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return true;                        // GIF
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42) return true; // WEBP
  return false;
}

// ── HTTP helper: 크기 가드와 함께 버퍼로 받기 ─────────────────────────────────
async function fetchBuf(url, { asText } = {}) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' — ' + url);
  // Content-Length 가 있으면 선검사(없어도 아래서 누적 검사).
  const cl = parseInt(res.headers.get('content-length') || '0', 10);
  if (cl && cl > MAX_BYTES) throw new Error('너무 큼(' + Math.round(cl / 1048576) + 'MB > ' + opt.maxMb + 'MB): ' + url);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('너무 큼(' + Math.round(buf.length / 1048576) + 'MB > ' + opt.maxMb + 'MB): ' + url);
  return asText ? buf.toString('utf8') : buf;
}

// ── URL 해석 도우미 ───────────────────────────────────────────────────────────
function absUrl(href, base) { try { return new URL(href, base).toString(); } catch (e) { return null; }
}
// HTML 에서 href/src 후보를 모두 뽑는다(따옴표·홑따옴표 모두).
function extractLinks(html, base) {
  const out = [];
  const re = /(?:href|src|data-href|content)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1] || m[2];
    const abs = absUrl(raw, base);
    if (abs) out.push(abs);
  }
  return out;
}
function isDirectFile(url) { return /\.(zip|png|jpe?g|gif|webp)(\?|#|$)/i.test(String(url).split('#')[0]); }
function fileExtOf(url) {
  const m = String(url).split('?')[0].split('#')[0].match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}
function baseName(url) {
  const clean = String(url).split('?')[0].split('#')[0];
  const seg = clean.split('/').filter(Boolean).pop() || 'download';
  return seg;
}

// ── 소스별 직접 URL 리졸버(함수 테이블) ──────────────────────────────────────
// 각 리졸버는 페이지 HTML 에서 다운로드 가능한 직접 링크 배열을 돌려준다(우선순위 순).
// 못 찾으면 빈 배열 → 호출부에서 종료코드 3.

// kenney.nl: 다운로드 버튼이 /media/.../*.zip 형태(또는 download.kenney.nl) 로 링크됨.
function resolveKenney(html, base) {
  const links = extractLinks(html, base);
  const zips = links.filter(function (u) { return /\.zip(\?|#|$)/i.test(u); });
  // kenney 특유 경로 우선(파일명에 kenney_ 가 들어가거나 /media/ 하위).
  const prio = zips.filter(function (u) { return /kenney_|\/media\//i.test(u); });
  return (prio.length ? prio : zips);
}
// gameart2d.com/freebies.html: 각 freebie 가 개별 zip 링크. packId 슬러그로 후보를 거른다.
function resolveGameart2d(html, base, pack) {
  const links = extractLinks(html, base).filter(function (u) { return /\.zip(\?|#|$)/i.test(u); });
  // packId 에서 sourceId 접두 제거한 슬러그 토큰으로 매칭(예: gameart2d-free-platformer → free, platformer).
  const slug = String(pack.id).replace(/^gameart2d-?/, '');
  const tokens = slug.split(/[-_]/).filter(function (t) { return t.length > 2; });
  const matched = links.filter(function (u) {
    const lu = u.toLowerCase();
    return tokens.some(function (t) { return lu.indexOf(t.toLowerCase()) !== -1; });
  });
  return (matched.length ? matched : links);   // 못 맞히면 전체 zip 후보(첫 항목 사용은 호출부 정책)
}
// opengameart.org: 첨부가 /sites/default/files/ 하위의 .zip / 직접 이미지.
function resolveOpengameart(html, base) {
  const links = extractLinks(html, base);
  const files = links.filter(function (u) { return /\/sites\/default\/files\//i.test(u) && isDirectFile(u); });
  const zips = files.filter(function (u) { return /\.zip(\?|#|$)/i.test(u); });
  const imgs = files.filter(function (u) { return /\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(u); });
  // zip 우선, 없으면 직접 이미지(여러 장이면 전부 반환 → 호출부에서 모두 받음).
  return zips.length ? zips : imgs;
}
// generic/기타: 페이지 내 .zip 우선, 없으면 직접 이미지 링크.
function resolveGeneric(html, base) {
  const links = extractLinks(html, base);
  const zips = links.filter(function (u) { return /\.zip(\?|#|$)/i.test(u); });
  if (zips.length) return zips;
  return links.filter(function (u) { return /\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(u); });
}

const RESOLVERS = {
  kenney: resolveKenney,
  gameart2d: resolveGameart2d,
  opengameart: resolveOpengameart
};

// itch.io 호스트는 정적 HTML 에 직접 다운로드 링크가 없다(업로드 API 경유). 명확히 사유를 남긴다.
function isItchHost(u) { return /\bitch\.(io|zone)\b/i.test(String(u)); }

// ── ZIP 해제(무의존성): 로컬 파일 헤더 순회 + central directory 보강 ──────────
//
// 한계/주석:
//   - 지원 압축: STORE(0), DEFLATE(8). 그 외 메서드는 스킵(사유 로그).
//   - ZIP64·암호화·스팬 아카이브 미지원. 일반 에셋 zip 은 대부분 STORE/DEFLATE.
//   - data descriptor(비트3) 로 크기가 0 인 경우 central directory 의 압축크기로 보정.
//   - traversal 가드: 엔트리 경로가 destDir 밖으로 나가면 거부.
function readU16(b, o) { return b[o] | (b[o + 1] << 8); }
function readU32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

// central directory 를 파싱해 파일별 압축크기/오프셋을 얻는다(local header 의 size 가 0 인 경우 대비).
function parseCentralDirectory(buf) {
  // EOCD(0x06054b50) 를 뒤에서 탐색.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (readU32(buf, i) === 0x06054b50) { eocd = i; break; }
  }
  const map = new Map();   // localHeaderOffset -> { compSize, uncompSize, method, name }
  if (eocd < 0) return map;
  const cdOffset = readU32(buf, eocd + 16);
  let p = cdOffset;
  while (p + 46 <= buf.length && readU32(buf, p) === 0x02014b50) {
    const method = readU16(buf, p + 10);
    const compSize = readU32(buf, p + 20);
    const uncompSize = readU32(buf, p + 24);
    const nameLen = readU16(buf, p + 28);
    const extraLen = readU16(buf, p + 30);
    const commentLen = readU16(buf, p + 32);
    const lho = readU32(buf, p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    map.set(lho, { compSize, uncompSize, method, name });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return map;
}

function unzip(buf, destDir) {
  const cd = parseCentralDirectory(buf);
  const written = [];
  const destRoot = path.resolve(destDir);
  let p = 0;
  while (p + 30 <= buf.length) {
    const sig = readU32(buf, p);
    if (sig !== 0x04034b50) break;     // 더 이상 로컬 파일 헤더 아님(central dir 시작 등)
    const localOffset = p;
    const gpFlag = readU16(buf, p + 6);
    const method = readU16(buf, p + 8);
    let compSize = readU32(buf, p + 18);
    const nameLen = readU16(buf, p + 26);
    const extraLen = readU16(buf, p + 28);
    const name = buf.slice(p + 30, p + 30 + nameLen).toString('utf8');
    const dataStart = p + 30 + nameLen + extraLen;
    // data descriptor(비트3) → local header 의 compSize 가 0. central directory 값으로 보정.
    if ((gpFlag & 0x08) || compSize === 0) {
      const meta = cd.get(localOffset);
      if (meta && meta.compSize) compSize = meta.compSize;
    }
    const dataEnd = dataStart + compSize;
    if (dataEnd > buf.length) break;   // 손상/잘림
    const data = buf.slice(dataStart, dataEnd);

    const isDir = /[\/\\]$/.test(name) || name === '';
    // traversal 가드: 정규화한 절대경로가 destRoot 안에 있어야 함.
    const target = path.resolve(destRoot, name.replace(/\\/g, '/'));
    if (target !== destRoot && !target.startsWith(destRoot + path.sep)) {
      // 밖으로 나가는 엔트리는 거부(경고만, 계속).
      console.warn('  ⚠ traversal 의심 엔트리 건너뜀:', name);
    } else if (isDir) {
      fs.mkdirSync(target, { recursive: true });
    } else {
      let out;
      if (method === 0) out = data;                         // STORE
      else if (method === 8) out = zlib.inflateRawSync(data); // DEFLATE
      else { console.warn('  ⚠ 미지원 압축 메서드 ' + method + ' — 건너뜀:', name); out = null; }
      if (out) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, out);
        written.push(path.relative(destRoot, target).replace(/\\/g, '/'));
      }
    }
    p = dataEnd;
  }
  return written;
}

// 버퍼 하나를 raw/ 에 materialize: zip 이면 원본 보존 + 해제, 이미지면 그대로 저장.
// 반환 { files:[저장한 최상위 파일명], unzipped:[해제된 엔트리 상대경로] }. zip/이미지 아니면 throw.
function materializeBuf(buf, srcName, rawDir) {
  const out = { files: [], unzipped: [] };
  if (isZip(buf)) {
    const zipName = baseName(srcName) || 'pack.zip';
    fs.writeFileSync(path.join(rawDir, zipName), buf);
    out.files.push(zipName);
    out.unzipped = unzip(buf, rawDir);
  } else if (isImage(buf)) {
    const imgName = baseName(srcName) || 'image';
    fs.writeFileSync(path.join(rawDir, imgName), buf);
    out.files.push(imgName);
  } else {
    throw new Error('zip/이미지 매직바이트 아님: ' + srcName);
  }
  return out;
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
(async function main() {
  // ── 수동(off-catalog) 모드: --id + (--zip | --url) ───────────────────────────
  // packs.json·리졸버·itch 차단을 건너뛴다. 사용자가 게이트를 통과해 받은 ZIP/직링크를 raw/ 로 푼다.
  if (opt.manual) {
    const rawDir = path.resolve(process.cwd(), opt.out, opt.id, 'raw');
    const src = opt.zip || opt.url;
    if (opt.dry) {
      done({ ok: true, dry: true, manual: true, id: opt.id, source: src, rawDir: rawDir }, 0);
    }
    let buf;
    if (opt.zip) {
      try {
        const stat = fs.statSync(opt.zip);
        if (stat.size > MAX_BYTES) done({ ok: false, error: '로컬 파일이 너무 큼(' + Math.round(stat.size / 1048576) + 'MB > ' + opt.maxMb + 'MB): ' + opt.zip, id: opt.id }, 1);
        buf = fs.readFileSync(opt.zip);
      } catch (e) { done({ ok: false, error: '로컬 ZIP 읽기 실패: ' + (e && e.message || e), id: opt.id }, 1); }
    } else {
      try { buf = await fetchBuf(opt.url); }
      catch (e) { done({ ok: false, error: '직링크 다운로드 실패: ' + (e && e.message || e), id: opt.id }, 3); }
    }
    fs.mkdirSync(rawDir, { recursive: true });
    let mat;
    try { mat = materializeBuf(buf, src, rawDir); }
    catch (e) { done({ ok: false, error: String(e && e.message || e), id: opt.id }, 3); }
    const allFiles = mat.files.concat(mat.unzipped.filter(function (f) { return mat.files.indexOf(f) === -1; }));
    console.log('받은 파일/엔트리:', allFiles.length, '개 →', rawDir);
    allFiles.slice(0, 40).forEach(function (f) { console.log('  ·', f); });
    if (allFiles.length > 40) console.log('  · ... (+' + (allFiles.length - 40) + ' more)');
    console.log('다음 단계(라이선스 필수): node skills/sprite-picker/catalog/analyze-pack.mjs --pack ' + opt.id + ' --license <CC0-1.0|CC-BY-4.0|...> --name "<표시명>" --source <itch|local|...>');
    done({ ok: true, manual: true, packId: opt.id, rawDir: rawDir, files: allFiles }, 0);
  }

  let doc;
  try { doc = JSON.parse(fs.readFileSync(PACKS, 'utf8')); }
  catch (e) { done({ ok: false, error: 'packs.json 읽기 실패: ' + e.message }, 1); }

  const pack = (doc.packs || []).find(function (p) { return p.id === opt.pack; });
  if (!pack) { done({ ok: false, error: '팩을 찾을 수 없음: ' + opt.pack }, 1); }

  // CC0 게이트.
  if (pack.safetyTier !== 'cc0') {
    done({ ok: false, error: 'CC0 아님(safetyTier=' + pack.safetyTier + ') — 다운로드 거부', packId: pack.id }, 2);
  }

  const rawDir = path.resolve(process.cwd(), opt.out, pack.id, 'raw');
  const pageUrl = pack.downloadUrl || pack.url;
  if (!pageUrl) { done({ ok: false, error: 'downloadUrl/url 없음', packId: pack.id }, 3); }

  // 1) downloadUrl 이 이미 직접 파일이면 그대로 받는다.
  let targets = [];
  if (isDirectFile(pageUrl)) {
    targets = [pageUrl];
  } else {
    // 2) itch.io 는 정적 HTML 에 직접 링크가 없다 → 추측 금지, 명확히 실패.
    if (isItchHost(pageUrl)) {
      done({ ok: false, error: 'itch.io 호스트는 정적 페이지에 직접 다운로드 링크가 없습니다(업로드 API 경유). 수동 다운로드 후 raw/ 에 배치 필요: ' + pageUrl, packId: pack.id }, 3);
    }
    // 3) 페이지 HTML 을 받아 소스별 리졸버로 직접 링크 추출.
    let html;
    try { html = await fetchBuf(pageUrl, { asText: true }); }
    catch (e) { done({ ok: false, error: '페이지 HTML 수신 실패: ' + e.message, packId: pack.id }, 3); }
    const resolver = RESOLVERS[pack.sourceId] || resolveGeneric;
    try { targets = resolver(html, pageUrl, pack) || []; }
    catch (e) { done({ ok: false, error: '리졸버 오류(' + pack.sourceId + '): ' + e.message, packId: pack.id }, 3); }
    // 중복 제거.
    targets = Array.from(new Set(targets));
    if (!targets.length) {
      done({ ok: false, error: '직접 다운로드 링크를 찾지 못함(' + pack.sourceId + '): ' + pageUrl + ' — 추측 다운로드 금지', packId: pack.id }, 3);
    }
  }

  // zip 후보가 있으면 첫 zip 하나만(보통 단일 팩 zip). 직접 이미지면 전부 받는다.
  const zipTargets = targets.filter(function (u) { return fileExtOf(u) === 'zip'; });
  const downloadList = zipTargets.length ? [zipTargets[0]] : targets;

  if (opt.dry) {
    done({ ok: true, dry: true, packId: pack.id, page: pageUrl, resolved: downloadList, rawDir: rawDir }, 0);
  }

  fs.mkdirSync(rawDir, { recursive: true });
  const files = [];
  let unzipped = [];
  for (const url of downloadList) {
    let buf;
    try { buf = await fetchBuf(url); }
    catch (e) { done({ ok: false, error: '다운로드 실패: ' + e.message, packId: pack.id }, 3); }

    if (isZip(buf) || isImage(buf)) {
      let mat;
      try { mat = materializeBuf(buf, url, rawDir); }     // raw/ 에 원본 보존 + ZIP 해제
      catch (e) { done({ ok: false, error: 'ZIP/이미지 처리 실패: ' + e.message, packId: pack.id }, 3); }
      mat.files.forEach(function (f) { files.push(f); });
      unzipped = unzipped.concat(mat.unzipped);
    } else {
      done({ ok: false, error: '받은 데이터가 zip/이미지 매직바이트 아님: ' + url, packId: pack.id }, 3);
    }
  }

  const allFiles = files.concat(unzipped.filter(function (f) { return files.indexOf(f) === -1; }));
  console.log('받은 파일/엔트리:', allFiles.length, '개 →', rawDir);
  allFiles.slice(0, 40).forEach(function (f) { console.log('  ·', f); });
  if (allFiles.length > 40) console.log('  · ... (+' + (allFiles.length - 40) + ' more)');
  console.log('다음 단계: node skills/sprite-picker/catalog/analyze-pack.mjs --pack ' + pack.id);
  done({ ok: true, packId: pack.id, rawDir: rawDir, files: allFiles }, 0);
})().catch(function (e) { done({ ok: false, error: '치명적 오류: ' + (e && e.message || e) }, 1); });
