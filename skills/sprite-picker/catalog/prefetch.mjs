#!/usr/bin/env node
/*
 * sprite-picker 카탈로그 프리페치 — CC0 팩의 대표 커버 이미지를 미리 받아 벤더링한다.
 *
 * 왜: 피커가 실행될 때 매번 원격 이미지를 끌어오면 느리고 오프라인에서 깨진다. CC0 팩의 커버를
 *     미리 catalog/thumbnails/<pack-id>.<ext> 로 받아 두고 packs.json 의 `preview` 에 그 경로를
 *     기록하면, 피커는 /catalog/ 로 로컬 썸네일을 즉시 보여준다(실행 시 빠름).
 *
 * 안전: **safetyTier 가 cc0 인 팩만** 커버를 커밋한다. mixed-per-item/avoid/permissive 는 커밋하지
 *       않고 previewUrl 라이브 링크만 둔다(라이선스·표기 리스크 회피).
 *
 * 실행(어디서든):
 *   node skills/sprite-picker/catalog/prefetch.mjs            # cc0 + previewUrl 보유 팩 전부
 *   node skills/sprite-picker/catalog/prefetch.mjs --only kenney
 *   node skills/sprite-picker/catalog/prefetch.mjs --limit 8  # 대표 subset 만
 *   node skills/sprite-picker/catalog/prefetch.mjs --force    # 이미 받은 것도 다시
 *   node skills/sprite-picker/catalog/prefetch.mjs --dry      # 받지 않고 대상만 출력
 *
 * 산출물: catalog/thumbnails/<pack-id>.<ext> + packs.json 의 각 팩 `preview` 갱신.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));     // catalog/
const PACKS = path.join(DIR, 'packs.json');
const THUMBS = path.join(DIR, 'thumbnails');

const argv = process.argv.slice(2);
const opt = {
  force: argv.includes('--force'),
  dry: argv.includes('--dry'),
  only: (function () { var i = argv.indexOf('--only'); return i >= 0 ? argv[i + 1] : null; })(),
  limit: (function () { var i = argv.indexOf('--limit'); return i >= 0 ? parseInt(argv[i + 1], 10) : Infinity; })(),
  maxKb: (function () { var i = argv.indexOf('--max-kb'); return i >= 0 ? parseInt(argv[i + 1], 10) : 800; })(),
  concurrency: 4
};
const MIN_BYTES = 256;                       // 이보다 작으면 깨진/에러 응답으로 간주
const MAX_BYTES = opt.maxKb * 1024;          // 썸네일 취지 — 너무 크면 커밋 안 함(라이브 링크 유지)

if (typeof fetch !== 'function') {
  console.error('이 스크립트는 글로벌 fetch 가 필요합니다 (Node 18+). 현재 Node 버전:', process.version);
  process.exit(1);
}

const EXT_BY_TYPE = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' };
function extFor(url, contentType) {
  if (contentType) { var ct = contentType.split(';')[0].trim().toLowerCase(); if (EXT_BY_TYPE[ct]) return EXT_BY_TYPE[ct]; }
  var m = String(url).split('?')[0].match(/\.(png|jpe?g|webp|gif|svg)$/i);
  return m ? '.' + m[1].toLowerCase().replace('jpeg', 'jpg') : '.png';
}
function existingThumb(packId) {
  if (!fs.existsSync(THUMBS)) return null;
  var hit = fs.readdirSync(THUMBS).find(function (f) { return f.replace(/\.[^.]+$/, '') === packId; });
  return hit ? hit : null;
}
// 매직 바이트로 진짜 이미지인지 검증(content-type 오기재·HTML 에러페이지 방어).
function looksLikeImage(b) {
  if (b.length < 8) return false;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return true;                       // PNG
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return true;                                         // JPG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return true;                        // GIF
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42) return true; // RIFF/WEBP
  var head = b.slice(0, 256).toString('utf8').trim().toLowerCase();
  return head.indexOf('<svg') !== -1 || head.indexOf('<?xml') !== -1;                                       // SVG
}
// 받았던 커밋 썸네일 파일을 지운다(실패/거부 시). preview 값은 reconcile 단계에서 파일 유무로 다시 맞춘다.
function clearStale(pack) {
  var old = existingThumb(pack.id); if (old) { try { fs.unlinkSync(path.join(THUMBS, old)); } catch (e) {} }
}
// packs.json 텍스트에서 특정 팩의 preview 값을 설정(포맷·배열 스타일 보존 — JSON 재직렬화 안 함).
function setPreviewValue(text, id, val) {
  var idIdx = text.indexOf('"id": "' + id + '"');
  if (idIdx < 0) return text;
  var re = /"preview":\s*"(?:[^"\\]|\\.)*"/g; re.lastIndex = idIdx;
  var m = re.exec(text);
  if (!m) return text;                      // 해당 팩에 preview 필드 없음(이론상 전부 보유)
  return text.slice(0, m.index) + '"preview": "' + val + '"' + text.slice(m.index + m[0].length);
}

async function downloadOne(pack) {
  const res = await fetch(pack.previewUrl, { redirect: 'follow', headers: { 'User-Agent': 'sprite-picker-prefetch/1.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const ct = res.headers.get('content-type') || '';
  if (!/^image\//i.test(ct) && !/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(pack.previewUrl)) {
    throw new Error('이미지 아님 (content-type: ' + ct + ')');
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MIN_BYTES) throw new Error('너무 작음 (' + buf.length + 'B) — 깨진 응답 의심');
  if (buf.length > MAX_BYTES) throw new Error('너무 큼 (' + Math.round(buf.length / 1024) + 'KB > ' + opt.maxKb + 'KB) — 라이브 링크 유지');
  if (!looksLikeImage(buf)) throw new Error('이미지 시그니처 아님 — 라이브 링크 유지');
  const ext = extFor(pack.previewUrl, ct);
  const file = pack.id + ext;
  fs.mkdirSync(THUMBS, { recursive: true });
  // 같은 id 의 다른 확장자 잔여물 정리
  (existingThumb(pack.id) ? [existingThumb(pack.id)] : []).forEach(function (old) { if (old !== file) { try { fs.unlinkSync(path.join(THUMBS, old)); } catch (e) {} } });
  fs.writeFileSync(path.join(THUMBS, file), buf);
  return { file, bytes: buf.length };
}

async function runPool(tasks, n) {
  const results = []; let i = 0;
  async function worker() { while (i < tasks.length) { const idx = i++; results[idx] = await tasks[idx](); } }
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, worker));
  return results;
}

(async function main() {
  const rawText = fs.readFileSync(PACKS, 'utf8');
  const doc = JSON.parse(rawText);
  const packs = doc.packs || [];

  // 대상 선별: cc0 + previewUrl 보유 + (강제거나 아직 파일 없음).
  let eligible = packs.filter(function (p) {
    if (p.safetyTier !== 'cc0') return false;
    if (!p.previewUrl) return false;
    if (opt.only && p.sourceId !== opt.only) return false;
    if (!opt.force && existingThumb(p.id)) return false;   // 이미 받은 파일 있음 → skip
    return true;
  });
  eligible = eligible.slice(0, opt.limit);

  const skippedNoPreview = packs.filter(function (p) { return p.safetyTier === 'cc0' && !p.previewUrl; }).length;
  const skippedTier = packs.filter(function (p) { return p.safetyTier !== 'cc0' && p.previewUrl; }).length;

  console.log('대상 팩(cc0 + previewUrl + 미커밋):', eligible.length);
  console.log('  · cc0 인데 previewUrl 없음(플레이스홀더 유지):', skippedNoPreview);
  console.log('  · previewUrl 있으나 cc0 아님(커밋 안 함, 라이브 링크만):', skippedTier);
  if (opt.dry) { eligible.forEach(function (p) { console.log('  →', p.id, p.previewUrl); }); return; }
  if (!eligible.length) console.log('받을 새 대상 없음 — 기존 파일로 packs.json 만 reconcile 합니다.');

  let ok = 0, fail = 0;
  const tasks = eligible.map(function (p) {
    return async function () {
      try {
        const r = await downloadOne(p);
        ok++; console.log('  ✓', p.id, '→ thumbnails/' + r.file + ' (' + Math.round(r.bytes / 1024) + 'KB)');
      } catch (e) {
        fail++; clearStale(p); console.warn('  ✗', p.id, '—', String(e && e.message || e));
      }
    };
  });
  await runPool(tasks, opt.concurrency);

  // packs.json 갱신(포맷 보존): thumbnail→preview 필드명 통일 + 각 팩 preview 를 실제 파일 유무로 reconcile.
  let text = rawText.replace(/"thumbnail":/g, '"preview":');
  packs.forEach(function (p) { var f = existingThumb(p.id); text = setPreviewValue(text, p.id, f ? 'thumbnails/' + f : ''); });
  fs.writeFileSync(PACKS, text);
  const committed = packs.filter(function (p) { return existingThumb(p.id); }).length;
  console.log('\n완료: 이번 성공 ' + ok + ' / 실패 ' + fail + '. 커밋 썸네일 보유 팩 ' + committed + '개. packs.json 갱신됨.');
  if (fail) console.log('실패분은 previewUrl 라이브 링크/플레이스홀더로 동작합니다(피커는 오프라인 폴백 보유).');
})().catch(function (e) { console.error('치명적 오류:', e); process.exit(1); });
