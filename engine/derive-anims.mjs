/* ============================================================================
 * WGF — 애니메이션 도출 공통모듈 (deriveAnims + 의존 심볼) — ESM, zero-dep
 * ----------------------------------------------------------------------------
 * editor(`editor/server/sprite-library.mjs`)와 catalog(`skills/wgf-sprite-picker/
 * catalog/analyze-pack.mjs`) 두 소비자가 같은 애니 도출 로직을 공유하도록, 기존
 * `sprite-library.mjs:148` 의 `deriveAnims` 와 그 의존 심볼을 코어 영역(engine/)으로
 * *재배치*한 모듈이다. 시그니처·동작 100% 보존 — 신규 작성이 아님.
 *
 * 모듈 형식(반드시 `.mjs`):
 *   engine/ 의 기존 `.js` 는 전부 UMD/CommonJS(`module.exports`)이고 루트에
 *   `package.json` `type:module` 이 없어 Node 가 engine `.js` 를 CommonJS 로 해석한다.
 *   → `engine/derive-anims.js` 에 `export` 를 쓰면 `SyntaxError`. 따라서 `.mjs` 확장자로
 *   ESM 형식을 명시해 두 소비자(둘 다 ESM)가 `import` 로 직접 소비하고, 기존 engine `.js`
 *   CommonJS require 체인(scenekit 계열·test-scenekit createRequire)은 무영향이다.
 *
 * zero-dep: Node 빌트인조차 불필요(픽셀 디코드·alpha 스캔 의존 없음). 순수 함수.
 *
 * 노출 심볼:
 *   - deriveAnims(sheetMeta)          : 동작별 애니 도출(휴리스틱, 결정적).
 *   - sanitizeFrameConfig(fc)         : frameConfig 위생화(원래 export).
 *   - sanitizeFrames(frames)          : frames[] 위생화(원래 비-export → 노출).
 *   - MAX_SHEET_DIM / MAX_GRID_CELLS / MAX_FRAMES : OOM 방어 상수(원래 비-export → 노출).
 *     (`sanitizeFrames` 가 frames[] 경로에서 `MAX_FRAMES` 를 참조하므로 동반 필수.)
 * ==========================================================================*/

// 시트 한 변 최대 픽셀(그리드 cols/rows 계산 입력 상한 — 거대입력 OOM 방어).
export const MAX_SHEET_DIM = 16384;
// 그리드 셀(rows*cols) 최대 — 현실적 시트는 충분히 포함, 그 이상은 애니 시트로 비현실적(OOM 방어).
export const MAX_GRID_CELLS = 100000;
// frames[](명시 영역) 개수 상한 — 악성 대형 analysis.json/사이드카 자재화 거부(DoS).
export const MAX_FRAMES = 100000;

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
export function sanitizeFrames(frames) {
  if (!Array.isArray(frames)) return null;
  const out = [];
  // 개수 상한: 초과분은 잘라낸다(악성 대형 입력의 거대 배열 자재화·순회 방어).
  const capped = frames.length > MAX_FRAMES ? frames.slice(0, MAX_FRAMES) : frames;
  for (const f of capped) {
    if (!f || typeof f !== 'object') continue;
    if (typeof f.x !== 'number' || typeof f.y !== 'number') continue;
    if (typeof f.w !== 'number' || !(f.w > 0) || typeof f.h !== 'number' || !(f.h > 0)) continue;
    const item = { x: f.x | 0, y: f.y | 0, w: f.w | 0, h: f.h | 0 };
    if (typeof f.name === 'string') item.name = f.name.slice(0, 64);
    out.push(item);
  }
  return out.length ? out : null;
}

// ── deriveAnims(D1 — 동작별 의미 분석) ────────────────────────────────────────
// 가져온 시트를 "동작별 애니메이션"으로 분석한다(휴리스틱, zero-dep — 픽셀 디코드 없음).
//  입력 sheetMeta: { frameConfig?:{frameWidth,frameHeight,margin?,spacing?}, frames?:[{x,y,w,h,name?}],
//                    w?, h? }(w/h = 이미지 픽셀 크기 — 라이브러리 스캔이 보유하면 전달).
//  반환: { anims:[{key,frames:[셀idx],fps,loop}], rows?, cols? }.
//
//  ① 그리드(frameConfig + w/h): cols/rows 계산 → 행(row) 단위로 클립 1개.
//     - 각 클립 frames = 해당 행의 셀 인덱스(row-major: r*cols + c).
//     - 의미 라벨링: rows<=7 이면 행 순서대로 ['idle','walk','run','jump','attack','hurt','die'],
//       아니면 'row_0','row_1'... 1프레임뿐인 행은 loop:false + key 접미사 '_pose'.
//  ② frames[](비균일 영역, 그리드 없음): 영역명 prefix 로 그룹핑(같은 prefix → 한 클립),
//     prefix 가 전혀 없으면 전체를 단일 'all' 클립으로 묶는다.
//  ③ 그리드도 frames 도 없으면 best-effort 빈 배열.
const ANIM_VERBS = ['idle', 'walk', 'run', 'jump', 'attack', 'hurt', 'die'];
const DERIVE_DEFAULT_FPS = 8;

export function deriveAnims(sheetMeta) {
  const meta = (sheetMeta && typeof sheetMeta === 'object') ? sheetMeta : {};
  const fc = sanitizeFrameConfig(meta.frameConfig);
  const w = (typeof meta.w === 'number' && meta.w > 0) ? (meta.w | 0) : 0;
  const h = (typeof meta.h === 'number' && meta.h > 0) ? (meta.h | 0) : 0;

  // ① 그리드 경로 — frameConfig + 이미지 w/h 가 있어야 cols/rows 계산 가능.
  //    w/h 가 MAX_SHEET_DIM 이하일 때만 계산(거대입력 OOM 방어).
  if (fc && w > 0 && w <= MAX_SHEET_DIM && h > 0 && h <= MAX_SHEET_DIM) {
    const margin = fc.margin || 0;
    const spacing = fc.spacing || 0;
    // 어댑터(scenekit-phaser.js bakeSheetTexture, margin 1배)와 동일 공식으로 cols/rows 산출:
    //   cols = floor((w - margin + spacing) / (frameWidth + spacing)). 최소 1.
    // (어댑터의 실제 셀 격자와 frame 인덱스를 일치시키기 위함 — margin>0 에서도 어긋나지 않게.)
    const stepX = fc.frameWidth + spacing;
    const stepY = fc.frameHeight + spacing;
    const cols = (stepX > 0) ? Math.max(1, Math.floor((w - margin + spacing) / stepX)) : 1;
    const rows = (stepY > 0) ? Math.max(1, Math.floor((h - margin + spacing) / stepY)) : 1;
    // 셀 총수 상한 초과면 루프 없이 거부(자재화 거부 — nested loop OOM 방어).
    if (cols * rows > MAX_GRID_CELLS) {
      return { anims: [], cols, rows, truncated: true };
    }
    const anims = [];
    for (let r = 0; r < rows; r++) {
      const frames = [];
      for (let c = 0; c < cols; c++) frames.push(r * cols + c);
      // 의미 라벨: rows<=7 → 동작 어휘, 아니면 row_N.
      let key = (rows <= ANIM_VERBS.length) ? ANIM_VERBS[r] : ('row_' + r);
      const single = frames.length === 1;
      if (single) key = key + '_pose';
      anims.push({ key, frames, fps: DERIVE_DEFAULT_FPS, loop: !single });
    }
    return { anims, cols, rows };
  }

  // ② frames[] 경로 — 비균일 명시 영역. 영역명 prefix 로 그룹핑.
  const fr = sanitizeFrames(meta.frames);
  if (fr && fr.length > 0) {
    // prefix 추출: name 의 끝 숫자/구분자 제거(예: 'walk_0'→'walk', 'attack-2'→'attack').
    const groups = new Map();   // prefix -> [원본 인덱스...]
    let anyNamed = false;
    for (let i = 0; i < fr.length; i++) {
      const nm = (typeof fr[i].name === 'string') ? fr[i].name : '';
      let prefix = '';
      if (nm) {
        anyNamed = true;
        const m = nm.match(/^(.*?)[ _-]?\d+$/);
        prefix = (m ? m[1] : nm).replace(/[ _-]+$/, '');
      }
      const key = prefix || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    }
    // prefix 가 전혀 없으면(이름 없거나 전부 빈 prefix) 전체를 단일 'all' 클립으로.
    const keys = Array.from(groups.keys());
    const meaningful = anyNamed && keys.some((k) => k.length > 0);
    if (!meaningful) {
      const allFrames = fr.map((_, i) => i);
      const single = allFrames.length === 1;
      return { anims: [{ key: single ? 'all_pose' : 'all', frames: allFrames, fps: DERIVE_DEFAULT_FPS, loop: !single }] };
    }
    // 그룹별 클립(빈 prefix 그룹은 'misc' 로). 안정 정렬(prefix 사전순).
    const anims = [];
    const sortedKeys = keys.slice().sort();
    for (const k of sortedKeys) {
      const idxs = groups.get(k);
      const single = idxs.length === 1;
      let key = k || 'misc';
      if (single) key = key + '_pose';
      anims.push({ key, frames: idxs, fps: DERIVE_DEFAULT_FPS, loop: !single });
    }
    return { anims };
  }

  // ③ 그리드도 frames 도 없음 — best-effort 빈 결과.
  return { anims: [] };
}
