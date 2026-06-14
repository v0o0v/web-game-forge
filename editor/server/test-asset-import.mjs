#!/usr/bin/env node
/* ============================================================================
 * WGF Studio — asset-import.mjs 단위 테스트 하니스
 * ----------------------------------------------------------------------------
 * asset-import.mjs 의 순수 함수들을 임시 fixture 폴더로 직접 검증한다.
 * 브리지 기동 불필요(순수 Node fs 함수).
 *
 * 게이트:
 *   U-CLASSIFY  라이선스 분류: allowed/warn/blocked 정확성
 *   U-SHA256    sha256 · sha256 비어있지 않음
 *   U-IDFORMAT  suggestedId 형식(^[A-Za-z0-9._-]{1,64}$)
 *   U-SKIP      skip 목록: .cs/.fbx/Library/ 포함 확인
 *   U-TOTALS    totals/truncated 가드
 *   U-GUID      .meta 형제 GUID 채집
 *   U-IMPORT_LIC import-licenses.json 오버라이드 적용
 *   U-VENDOR    vendorFile 실제 복사·해시 검증
 *   U-AUXCAP    과대 보조 텍스트(LICENSE/README/.meta) read 상한 — DoS 가드(MED-1)
 *
 * 사용: node editor/server/test-asset-import.mjs
 * 출력: 사람용 줄 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
 * 종료코드: 전부 통과 0, 하나라도 실패 1.
 * ==========================================================================*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));

import {
  scanLocalFolder,
  detectLicense,
  licenseClassify,
  vendorFile,
  ipNameFlag,
  normalizeLicense,
  suggestIdFromPath,
  loadPolicy,
  IMAGE_EXT,
  AUDIO_EXT,
  MAX_FILE_BYTES,
  MAX_FILES,
  SKIP_DIRS,
  FORBIDDEN_IP_NAMES
} from './asset-import.mjs';

// ── ok 헬퍼 ─────────────────────────────────────────────────────────────────
const checks = [];
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  const passed = !!cond;
  checks.push({ name, ok: passed, detail: detail || '' });
  if (passed) { pass++; process.stdout.write(`✓ ${name}\n`); }
  else { fail++; process.stdout.write(`✗ ${name}${detail ? ' — ' + detail : ''}\n`); }
}

// ── 임시 디렉터리 생성 ────────────────────────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wgf-asset-import-test-'));
const FIXTURE = path.join(TMP, 'unity-project');
const DEST = path.join(TMP, 'vendored');

function cleanup() {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
}

// 더미 PNG 바이트(최소 유효 PNG 시그니처: 8바이트 헤더 + IHDR 척)
const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  // PNG sig
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  // IHDR length + type
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  // 1x1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  // 8-bit RGB
  0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  // IDAT
  0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  // IEND
  0x44, 0xAE, 0x42, 0x60, 0x82
]);

// ── fixture 폴더 구성 ────────────────────────────────────────────────────────
function buildFixture() {
  // sprites/ 폴더
  const spritesDir = path.join(FIXTURE, 'sprites');
  fs.mkdirSync(spritesDir, { recursive: true });

  // ① CC0 PNG + 형제 LICENSE(CC0 문구) → allowed
  fs.writeFileSync(path.join(spritesDir, 'coin.png'), TINY_PNG);
  fs.writeFileSync(path.join(spritesDir, 'LICENSE'), 'Creative Commons Zero v1.0 Universal\nCC0 1.0 Public Domain Dedication\n');

  // ② coin.png.meta — Unity 더미 meta, guid 포함
  fs.writeFileSync(path.join(spritesDir, 'coin.png.meta'), [
    'fileFormatVersion: 2',
    'guid: abc123def456abc123def456abc12345',
    'TextureImporter:',
    '  spritePivot: {x: 0.5, y: 0.5}',
    ''
  ].join('\n'));

  // ③ enemy.png — 라이선스 단서 없음 → warn(unknown)
  fs.writeFileSync(path.join(FIXTURE, 'enemy.png'), TINY_PNG);

  // ④ mario.png → blocked(IP)
  fs.writeFileSync(path.join(FIXTURE, 'mario.png'), TINY_PNG);

  // ⑤ huge.png — MAX_FILE_BYTES+1 크기 더미(반복 버퍼)
  //    실제로는 26MB를 쓰지 않고, 1바이트 더 큰 크기로 sparse 기법 사용
  const HUGE_SIZE = MAX_FILE_BYTES + 1;
  const hugeBuf = Buffer.alloc(Math.min(HUGE_SIZE, 64 * 1024)); // 앞부분만
  const hugeFd = fs.openSync(path.join(FIXTURE, 'huge.png'), 'w');
  fs.writeSync(hugeFd, hugeBuf, 0, hugeBuf.length, 0);
  // sparse: 마지막 바이트만 기록해 파일 크기를 HUGE_SIZE 로 만든다
  fs.writeSync(hugeFd, Buffer.from([0]), 0, 1, HUGE_SIZE - 1);
  fs.closeSync(hugeFd);

  // ⑥ script.cs → 스킵(확장자 외)
  fs.writeFileSync(path.join(FIXTURE, 'script.cs'), 'using UnityEngine;\npublic class Foo : MonoBehaviour {}\n');

  // ⑦ model.fbx → 스킵(확장자 외)
  fs.writeFileSync(path.join(FIXTURE, 'model.fbx'), '; FBX 7.4.0\n');

  // ⑧ Library/ 폴더 + 파일 → SKIP_DIRS
  const libDir = path.join(FIXTURE, 'Library');
  fs.mkdirSync(libDir, { recursive: true });
  fs.writeFileSync(path.join(libDir, 'cache.bin'), Buffer.alloc(128));

  // ⑨ import-licenses.json 오버라이드: enemy.png → MIT(→ allowed)
  //    별도 서브폴더에 배치해 오버라이드 테스트
  const overrideDir = path.join(TMP, 'unity-override');
  fs.mkdirSync(overrideDir, { recursive: true });
  fs.writeFileSync(path.join(overrideDir, 'override.png'), TINY_PNG);
  fs.writeFileSync(path.join(overrideDir, 'import-licenses.json'), JSON.stringify({
    'override.png': { license: 'MIT', attribution: 'Test Author', owner: 'Test Owner' }
  }));
}

// ── U-AUXCAP fixture: 과대 보조 텍스트(LICENSE) read 상한 검증용 ────────────────
// readHeadText 는 보조 텍스트(LICENSE/README/.meta/import-licenses.json)를 선두 64KB 만
// 읽고, 8MB(hardCap) 초과는 통째로 스킵한다(보안 MED-1 — 멀티-GB LICENSE 로 OOM 방지).
// 각 art 는 자기 폴더의 LICENSE 만 최근접으로 잡도록 서브폴더로 격리한다.
const AUXCAP = path.join(TMP, 'auxcap');
function buildAuxCapFixture() {
  // (a) big-in-cap: 70KB(>64KB head, <8MB) LICENSE — head 에 키워드 없음 → warn(완주 확인).
  const beyondDir = path.join(AUXCAP, 'beyond');
  fs.mkdirSync(beyondDir, { recursive: true });
  fs.writeFileSync(path.join(beyondDir, 'art_beyond.png'), TINY_PNG);
  {
    const filler = Buffer.alloc(70 * 1024, 0x2e);                       // '.' × 70KB (키워드 없음)
    const tail = Buffer.from('\nSPDX-License-Identifier: MIT\n', 'utf8'); // head 밖 마커(읽히면 안 됨)
    fs.writeFileSync(path.join(beyondDir, 'LICENSE'), Buffer.concat([filler, tail]));
  }
  // (b) in-head: CC0 마커를 선두에 + 2MB filler — head 읽기 동작 + 대용량 완주 → allowed.
  const inheadDir = path.join(AUXCAP, 'inhead');
  fs.mkdirSync(inheadDir, { recursive: true });
  fs.writeFileSync(path.join(inheadDir, 'art_inhead.png'), TINY_PNG);
  {
    const marker = Buffer.from('Creative Commons Zero v1.0 Universal\nCC0 1.0 Public Domain Dedication\n', 'utf8');
    const filler = Buffer.alloc(2 * 1024 * 1024, 0x2e);                 // 2MB '.'
    fs.writeFileSync(path.join(inheadDir, 'LICENSE'), Buffer.concat([marker, filler]));
  }
  // (c) too-big: 9MB(>8MB hardCap) sparse LICENSE — 선두에 CC0 가 있어도 통째 스킵 → warn.
  //     (전체를 읽었다면 선두 CC0 → allowed 가 됐을 것 — 비-타우톨로지 회귀 감지.)
  const toobigDir = path.join(AUXCAP, 'toobig');
  fs.mkdirSync(toobigDir, { recursive: true });
  fs.writeFileSync(path.join(toobigDir, 'art_toobig.png'), TINY_PNG);
  {
    const TOO_BIG = 9 * 1024 * 1024;                                    // > 8MB hardCap
    const head = Buffer.from('Creative Commons Zero v1.0 Universal\nCC0 1.0\n', 'utf8');
    const fd = fs.openSync(path.join(toobigDir, 'LICENSE'), 'w');
    fs.writeSync(fd, head, 0, head.length, 0);
    fs.writeSync(fd, Buffer.from([0x2e]), 0, 1, TOO_BIG - 1);           // sparse 확장(실제 9MB 안 씀)
    fs.closeSync(fd);
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  try {
    buildFixture();
  } catch (e) {
    ok('fixture 생성', false, String(e));
    finish();
    return;
  }
  ok('fixture 생성', true);

  // ── U-CLASSIFY: 분류 정확성 ─────────────────────────────────────────────────
  {
    const result = scanLocalFolder(FIXTURE, {});
    ok('U-CLASSIFY scanLocalFolder ok', result && result.ok === true, `ok=${result && result.ok}`);

    const byRel = new Map((result.items || []).map((i) => [i.relPath, i]));

    // coin.png → allowed(CC0)
    const coin = byRel.get('sprites/coin.png');
    ok('U-CLASSIFY sprites/coin.png allowed(CC0)',
      coin && coin.status === 'allowed',
      `status=${coin && coin.status} reason=${coin && coin.reason} license=${coin && coin.detected && coin.detected.license}`);

    // enemy.png → warn(unknown)
    const enemy = byRel.get('enemy.png');
    ok('U-CLASSIFY enemy.png warn(unknown)',
      enemy && enemy.status === 'warn',
      `status=${enemy && enemy.status} license=${enemy && enemy.detected && enemy.detected.license}`);

    // mario.png → blocked(IP)
    const mario = byRel.get('mario.png');
    ok('U-CLASSIFY mario.png blocked(IP)',
      mario && mario.status === 'blocked' && /IP|mario/i.test(mario.reason || ''),
      `status=${mario && mario.status} reason=${mario && mario.reason}`);

    // huge.png → blocked(과대)
    const huge = byRel.get('huge.png');
    ok('U-CLASSIFY huge.png blocked(과대)',
      huge && huge.status === 'blocked' && /과대/.test(huge.reason || ''),
      `status=${huge && huge.status} reason=${huge && huge.reason}`);

    // ── U-SHA256: sha256 비어있지 않음 ─────────────────────────────────────────
    ok('U-SHA256 coin.png sha256 비어있지 않음',
      coin && typeof coin.sha256 === 'string' && coin.sha256.length === 64,
      `sha256=${coin && coin.sha256 && coin.sha256.slice(0, 8)}...`);

    ok('U-SHA256 enemy.png sha256 비어있지 않음',
      enemy && typeof enemy.sha256 === 'string' && enemy.sha256.length === 64,
      `sha256=${enemy && enemy.sha256 && enemy.sha256.slice(0, 8)}...`);

    // huge.png blocked(과대) → sha256 없음(읽기 생략 — 메모리 보호)
    ok('U-SHA256 huge.png blocked 시 sha256 생략(메모리 보호)',
      huge && (huge.sha256 === '' || huge.sha256 == null),
      `sha256="${huge && huge.sha256}"`);

    // ── U-IDFORMAT: suggestedId 형식 ────────────────────────────────────────────
    const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
    const allIdOk = (result.items || []).every((i) => ID_RE.test(i.suggestedId));
    ok('U-IDFORMAT 모든 아이템 suggestedId 형식 정합',
      allIdOk,
      `failing=${(result.items || []).filter((i) => !ID_RE.test(i.suggestedId)).map((i) => i.suggestedId).join(',') || 'none'}`);

    // coin.png → suggestedId = 'coin' (영숫자 단순 stem)
    ok('U-IDFORMAT coin.png suggestedId=coin',
      coin && coin.suggestedId === 'coin',
      `suggestedId=${coin && coin.suggestedId}`);

    // ── U-SKIP: skip 목록 확인 ──────────────────────────────────────────────────
    // .cs/.fbx 는 item 에 없어야 함(확장자 외 → 조용히 통과)
    const hasCs = (result.items || []).some((i) => i.relPath.endsWith('.cs'));
    const hasFbx = (result.items || []).some((i) => i.relPath.endsWith('.fbx'));
    ok('U-SKIP script.cs item 에 없음', !hasCs, `hasCs=${hasCs}`);
    ok('U-SKIP model.fbx item 에 없음', !hasFbx, `hasFbx=${hasFbx}`);

    // Library/ 는 skipped 에 있어야 함
    const libSkipped = (result.skipped || []).some((s) => s.relPath && (s.relPath === 'Library' || s.relPath.startsWith('Library/')));
    ok('U-SKIP Library/ skipped 에 포함', libSkipped,
      `skipped=${JSON.stringify((result.skipped || []).map((s) => s.relPath).slice(0, 5))}`);

    // ── U-TOTALS: totals/truncated ────────────────────────────────────────────
    ok('U-TOTALS totals.count >= 1', result.totals && result.totals.count >= 1,
      `count=${result.totals && result.totals.count}`);
    ok('U-TOTALS totals.bytes >= 1', result.totals && result.totals.bytes >= 1,
      `bytes=${result.totals && result.totals.bytes}`);
    ok('U-TOTALS truncated=false(소규모 fixture)', result.truncated === false,
      `truncated=${result.truncated}`);

    // ── U-GUID: .meta 형제 GUID 채집 ────────────────────────────────────────────
    ok('U-GUID coin.png detected.guid 채집',
      coin && coin.detected && coin.detected.guid === 'abc123def456abc123def456abc12345',
      `guid=${coin && coin.detected && coin.detected.guid}`);
  }

  // ── U-IMPORT_LIC: import-licenses.json 오버라이드 ─────────────────────────────
  {
    const overrideDir = path.join(TMP, 'unity-override');
    const result2 = scanLocalFolder(overrideDir, {});
    ok('U-IMPORT_LIC override 폴더 스캔 ok', result2 && result2.ok === true);

    const overrideItem = (result2.items || []).find((i) => i.relPath === 'override.png');
    ok('U-IMPORT_LIC override.png allowed(MIT 오버라이드)',
      overrideItem && overrideItem.status === 'allowed',
      `status=${overrideItem && overrideItem.status} license=${overrideItem && overrideItem.detected && overrideItem.detected.license}`);
    ok('U-IMPORT_LIC override.png detected.source=import-licenses.json',
      overrideItem && overrideItem.detected && overrideItem.detected.source === 'import-licenses.json',
      `source=${overrideItem && overrideItem.detected && overrideItem.detected.source}`);
    ok('U-IMPORT_LIC override.png detected.license=MIT',
      overrideItem && overrideItem.detected && overrideItem.detected.license === 'MIT',
      `license=${overrideItem && overrideItem.detected && overrideItem.detected.license}`);
  }

  // ── U-VENDOR: vendorFile 실제 복사·해시 ───────────────────────────────────────
  {
    const spritesDir = path.join(FIXTURE, 'sprites');
    const srcFile = path.join(spritesDir, 'coin.png');
    fs.mkdirSync(DEST, { recursive: true });

    const vr = vendorFile(srcFile, DEST, 'coin_vendored.png', {});
    ok('U-VENDOR vendorFile ok', vr && vr.ok === true, `ok=${vr && vr.ok} error=${vr && vr.error}`);
    ok('U-VENDOR vendored 파일 실제 존재', vr && vr.absDest && fs.existsSync(vr.absDest),
      `absDest=${vr && vr.absDest}`);

    // 복사 후 원본 내용과 동일한지(sha256 대조)
    const expectedSha = crypto.createHash('sha256').update(TINY_PNG).digest('hex');
    ok('U-VENDOR sha256 정확(원본과 일치)',
      vr && vr.sha256 === expectedSha,
      `vr.sha256=${vr && vr.sha256} expected=${expectedSha}`);
    ok('U-VENDOR bytes 정확', vr && vr.bytes === TINY_PNG.length,
      `bytes=${vr && vr.bytes} expected=${TINY_PNG.length}`);

    // repoRoot 넘기면 relUrl 계산
    const vr2 = vendorFile(srcFile, DEST, 'coin_rel.png', { repoRoot: TMP });
    ok('U-VENDOR repoRoot 주면 relUrl 반환',
      vr2 && vr2.ok && typeof vr2.relUrl === 'string' && vr2.relUrl.length > 0,
      `relUrl=${vr2 && vr2.relUrl}`);
    ok('U-VENDOR relUrl 슬래시 정규화(백슬래시 없음)',
      vr2 && typeof vr2.relUrl === 'string' && !vr2.relUrl.includes('\\'),
      `relUrl=${vr2 && vr2.relUrl}`);

    // 과대 파일 → vendorFile 거부
    const hugeSrc = path.join(FIXTURE, 'huge.png');
    const vrHuge = vendorFile(hugeSrc, DEST, 'huge_vendored.png', {});
    ok('U-VENDOR 과대 파일 vendorFile 거부(ok=false)',
      vrHuge && vrHuge.ok === false && /과대/.test(vrHuge.error || ''),
      `ok=${vrHuge && vrHuge.ok} error=${vrHuge && vrHuge.error}`);

    // 심볼릭링크 소스 거부 — Windows에서는 심링크 생성 권한 없을 수 있으므로 조건부 테스트
    let symlinkPath = null;
    try {
      symlinkPath = path.join(TMP, 'link_coin.png');
      fs.symlinkSync(srcFile, symlinkPath);
      const vrSym = vendorFile(symlinkPath, DEST, 'sym_vendored.png', {});
      ok('U-VENDOR 심볼릭링크 소스 거부', vrSym && vrSym.ok === false && /심볼릭/.test(vrSym.error || ''),
        `ok=${vrSym && vrSym.ok} error=${vrSym && vrSym.error}`);
    } catch (e) {
      // 권한 부족 시 건너뜀(Windows non-admin)
      ok('U-VENDOR 심볼릭링크 소스 거부(권한 없어 생략)', true, '(symlink 생성 권한 없음 — 건너뜀)');
    }
  }

  // ── 보조 함수 단위 단언 ────────────────────────────────────────────────────
  {
    // ipNameFlag
    ok('ipNameFlag mario flagged', ipNameFlag('mario.png').flagged === true, `hit=${ipNameFlag('mario.png').hit}`);
    ok('ipNameFlag coin not flagged', ipNameFlag('coin.png').flagged === false);
    ok('ipNameFlag 대소문자 무관(MARIO)', ipNameFlag('MARIO_SPRITE.png').flagged === true);

    // normalizeLicense
    ok('normalizeLicense CC0-1.0 → CC0', normalizeLicense('CC0-1.0') === 'CC0', `got=${normalizeLicense('CC0-1.0')}`);
    ok('normalizeLicense public domain → CC0', normalizeLicense('Public Domain') === 'CC0');
    ok('normalizeLicense MIT → MIT', normalizeLicense('MIT') === 'MIT');
    ok('normalizeLicense ARR', normalizeLicense('All Rights Reserved') === 'ARR');
    ok('normalizeLicense empty → unknown', normalizeLicense('') === 'unknown');
    ok('normalizeLicense null → unknown', normalizeLicense(null) === 'unknown');

    // suggestIdFromPath
    ok('suggestIdFromPath coin.png → coin', suggestIdFromPath('coin.png') === 'coin');
    ok('suggestIdFromPath 경로 포함 → stem만', suggestIdFromPath('sprites/coin.png') === 'coin');
    ok('suggestIdFromPath 특수문자 치환', /^[A-Za-z0-9._-]+$/.test(suggestIdFromPath('my sprite!.png')));
    const taken = new Set(['coin']);
    ok('suggestIdFromPath 충돌 회피(-2)', suggestIdFromPath('coin.png', taken) === 'coin-2');

    // licenseClassify
    const pol = { allow: ['CC0', 'MIT'], denyAlways: ['ARR'], ccByRequiresAttribution: true };
    ok('licenseClassify CC0 → allowed', licenseClassify({ license: 'CC0' }, 'coin.png', pol, 100).status === 'allowed');
    ok('licenseClassify unknown → warn', licenseClassify({ license: 'unknown' }, 'enemy.png', pol, 100).status === 'warn');
    ok('licenseClassify mario → blocked(IP)', licenseClassify({ license: 'CC0' }, 'mario.png', pol, 100).status === 'blocked');
    ok('licenseClassify 과대 → blocked', licenseClassify({ license: 'CC0' }, 'coin.png', pol, MAX_FILE_BYTES + 1).status === 'blocked');
    ok('licenseClassify user-owned → allowed', licenseClassify({ license: 'user-owned' }, 'myart.png', pol, 100).status === 'allowed');
    ok('licenseClassify USER-OWNED → allowed', licenseClassify({ license: 'USER-OWNED' }, 'myart.png', pol, 100).status === 'allowed');
  }

  // ── U-AUXCAP: 과대 보조 텍스트 파일 read 상한(DoS 가드, 보안 MED-1) ─────────────
  // 보조 텍스트(LICENSE/README/.meta/import-licenses.json)는 readHeadText(선두 64KB,
  // 8MB 초과 스킵)로만 읽혀야 한다. "전체 파일을 읽지 않음" 을 두 각도로 비-타우톨로지 검증:
  //   (1) fs.readFileSync 스파이 — 보조파일이 무제한 readFileSync 로 읽히지 않음을 직접 확인.
  //   (2) 8MB 초과 LICENSE 통째 스킵(전체 read 였다면 선두 CC0 → allowed 가 됐을 것).
  {
    buildAuxCapFixture();

    // fs.readFileSync 스파이: 스캔 중 보조 텍스트 파일이 무제한 read 되는지 기록.
    // (정상 코드는 보조파일을 fs.readSync 로만 읽으므로 0 건이어야 한다. sha256/asset png 은
    //  여전히 readFileSync 를 쓰므로 totalCalls>0 으로 스파이가 실제 활성임을 함께 증명.)
    const AUX_RE = /(^|[\/\\])(LICENSE|COPYING|README)([.\-][^\/\\]*)?$|\.(meta|license)$|import-licenses\.json$/i;
    const realReadFileSync = fs.readFileSync;
    const auxReadWhole = [];
    let totalReadFileSync = 0;
    fs.readFileSync = function (p, ...rest) {
      totalReadFileSync++;
      try { if (typeof p === 'string' && AUX_RE.test(p)) auxReadWhole.push(p); } catch (e) { /* 무시 */ }
      return realReadFileSync.call(this, p, ...rest);
    };
    let auxResult = null, auxErr = null;
    try { auxResult = scanLocalFolder(AUXCAP, {}); }
    catch (e) { auxErr = e; }
    finally { fs.readFileSync = realReadFileSync; }  // 항상 원복(다른 코드 영향 차단)

    ok('U-AUXCAP 과대 LICENSE(9MB·2MB·70KB) 있어도 scan 완주(OOM/throw 없음)',
      !auxErr && auxResult && auxResult.ok === true,
      `err=${auxErr && auxErr.message} ok=${auxResult && auxResult.ok}`);

    // 스파이 활성 증명(asset png sha256 등으로 readFileSync 가 실제 호출됨).
    ok('U-AUXCAP readFileSync 스파이 활성(호출 관측됨)', totalReadFileSync > 0,
      `totalReadFileSync=${totalReadFileSync}`);
    // 핵심: 보조 텍스트 파일은 무제한 readFileSync 로 읽히지 않음(= 전체 파일 read 안 함).
    ok('U-AUXCAP 보조 텍스트 파일 무제한 readFileSync 0건(전체 read 안 함)',
      auxReadWhole.length === 0,
      `auxReadWhole=${auxReadWhole.map((p) => path.basename(p)).join(',') || '없음'}`);

    const auxByRel = new Map(((auxResult && auxResult.items) || []).map((i) => [i.relPath, i]));

    // (c) 8MB hardCap 초과 LICENSE 통째 스킵 → 선두 CC0 도 미탐지 → warn(비-타우톨로지).
    const toobig = auxByRel.get('toobig/art_toobig.png');
    ok('U-AUXCAP hardCap(8MB) 초과 LICENSE 전체 스킵(선두 CC0 미탐지 → warn)',
      toobig && toobig.status === 'warn',
      `status=${toobig && toobig.status} license=${toobig && toobig.detected && toobig.detected.license}`);

    // (b) in-head: 선두 CC0 마커는 정상 탐지 + 2MB 대용량 완주 → allowed.
    const inhead = auxByRel.get('inhead/art_inhead.png');
    ok('U-AUXCAP head 내 CC0 마커 탐지 + 2MB 대용량 완주 → allowed',
      inhead && inhead.status === 'allowed' && inhead.detected && inhead.detected.license === 'CC0',
      `status=${inhead && inhead.status} license=${inhead && inhead.detected && inhead.detected.license}`);
  }

  cleanup();
  finish();
}

function finish() {
  const result = { ok: fail === 0, pass, fail, checks };
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  ok('테스트 실행 예외', false, String(e && e.stack || e));
  cleanup();
  finish();
});
