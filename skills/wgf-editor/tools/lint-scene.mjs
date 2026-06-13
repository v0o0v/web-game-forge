#!/usr/bin/env node
/* ============================================================================
 * lint-scene.mjs — wgf-scene@1 씬 문서 정적 검증 도구
 * ----------------------------------------------------------------------------
 * 의존성: Node.js 내장 모듈만(fs, path, url). 외부 패키지 금지.
 *
 * 사용:
 *   node lint-scene.mjs --file games/_editor-samples/topdown-min/scene.json
 *   node lint-scene.mjs --file scene.json --json
 *
 * 출력:
 *   사람용 라인(사전) + 마지막 줄 단일 JSON { ok, counts, findings, file }
 *   error 0 이면 exit 0, 아니면 exit 1.
 *
 * findings 항목: { level:'error'|'warn'|'info', code, message, path? }
 * ==========================================================================*/

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── P0a 허용 컴포넌트 화이트리스트 ──────────────────────────────────────────
// 구현 완료(P0a): 이 목록에 있고 IMPL_SET 에도 있어야 error 없이 통과.
// 전체 15종 계획 목록: 미구현은 'not-yet' warn 을 낸다.
const ALL_COMPONENTS = [
  // P0a 구현 완료
  'Sprite',
  'Body',
  'TopDownController',
  // P1+ 예정 — 미구현
  'Camera',
  'Script',
  'Tilemap',
  'Light',
  'ParticleEmitter',
  'AudioSource',
  'Animator',
  'PathFollower',
  'TriggerZone',
  'SpawnPoint',
  'UIText',
  'UIImage'
];

const IMPL_SET = new Set(['Sprite', 'Body', 'TopDownController']);

// ── 인자 파싱 ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { file: null, jsonOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file' && argv[i + 1]) {
      args.file = argv[++i];
    } else if (argv[i] === '--json') {
      args.jsonOnly = true;
    }
  }
  return args;
}

// ── 결과 누적 헬퍼 ───────────────────────────────────────────────────────────
function makeReport(filePath) {
  const findings = [];
  const add = (level, code, message, loc) => {
    findings.push({ level, code, message, ...(loc ? { path: loc } : {}) });
  };
  return { findings, add, filePath };
}

// ── 벽 AABB 충돌 체크 헬퍼 ──────────────────────────────────────────────────
// 점(x, y)이 AABB(wx, wy, ww, wh) 안에 완전히 들어있는지.
function pointInWall(px, py, wall) {
  return px >= wall.x && px <= wall.x + wall.w &&
         py >= wall.y && py <= wall.y + wall.h;
}

// ── 메인 검증 로직 ───────────────────────────────────────────────────────────
function lintScene(doc, report) {
  const { add } = report;

  // 1. format 검증
  if (doc.format !== 'wgf-scene@1') {
    add('error', 'INVALID_FORMAT',
      'format 이 "wgf-scene@1" 이어야 합니다. 실제값: ' + JSON.stringify(doc.format),
      'format');
  }

  // 2. 최상위 필수 필드 존재 확인
  for (const key of ['slug', 'meta', 'assets', 'walls', 'scenes']) {
    if (doc[key] === undefined || doc[key] === null) {
      add('error', 'MISSING_FIELD', '필수 필드 누락: ' + key, key);
    }
  }

  // 3. meta 필수 필드
  if (doc.meta && typeof doc.meta === 'object') {
    for (const key of ['title', 'genre', 'viewport']) {
      if (doc.meta[key] === undefined || doc.meta[key] === null) {
        add('error', 'MISSING_META_FIELD', 'meta.' + key + ' 필드 누락', 'meta.' + key);
      }
    }
    if (doc.meta.viewport && typeof doc.meta.viewport === 'object') {
      if (!(doc.meta.viewport.w > 0)) {
        add('error', 'INVALID_VIEWPORT', 'meta.viewport.w 는 양수여야 합니다', 'meta.viewport.w');
      }
      if (!(doc.meta.viewport.h > 0)) {
        add('error', 'INVALID_VIEWPORT', 'meta.viewport.h 는 양수여야 합니다', 'meta.viewport.h');
      }
    }
  }

  // 4. assets.sprites ID 집합 수집 (댕글링 ref 검사에 사용)
  const spriteIds = new Set();
  if (doc.assets && Array.isArray(doc.assets.sprites)) {
    for (let i = 0; i < doc.assets.sprites.length; i++) {
      const s = doc.assets.sprites[i];
      if (!s || !s.id) {
        add('error', 'MISSING_ASSET_ID', 'assets.sprites[' + i + '].id 가 없습니다',
          'assets.sprites[' + i + ']');
        continue;
      }
      if (spriteIds.has(s.id)) {
        add('error', 'DUPLICATE_ASSET_ID', '중복 sprite id: "' + s.id + '"',
          'assets.sprites[' + i + '].id');
      }
      spriteIds.add(s.id);
      // source 검증
      if (s.source !== 'procedural' && s.source !== 'cc0') {
        add('warn', 'UNKNOWN_ASSET_SOURCE',
          'sprite "' + s.id + '" 의 source 가 "procedural"|"cc0" 이 아닙니다: ' + JSON.stringify(s.source),
          'assets.sprites[' + i + '].source');
      }
    }
  }

  // 5. walls 기본 구조 검증
  if (doc.walls !== undefined) {
    if (!Array.isArray(doc.walls)) {
      add('error', 'INVALID_WALLS', 'walls 는 배열이어야 합니다', 'walls');
    } else {
      for (let i = 0; i < doc.walls.length; i++) {
        const w = doc.walls[i];
        if (!w || typeof w !== 'object') {
          add('error', 'INVALID_WALL', 'walls[' + i + '] 가 객체가 아닙니다', 'walls[' + i + ']');
          continue;
        }
        for (const k of ['x', 'y', 'w', 'h']) {
          if (typeof w[k] !== 'number') {
            add('error', 'INVALID_WALL_FIELD',
              'walls[' + i + '].' + k + ' 는 number 여야 합니다', 'walls[' + i + '].' + k);
          }
        }
      }
    }
  }

  // 6. scenes 검증
  if (!Array.isArray(doc.scenes) || doc.scenes.length === 0) {
    add('error', 'EMPTY_SCENES', 'scenes 는 최소 1개 이상의 항목을 포함해야 합니다', 'scenes');
    return; // 이하 검증 불가
  }

  const walls = Array.isArray(doc.walls) ? doc.walls : [];

  for (let si = 0; si < doc.scenes.length; si++) {
    const scene = doc.scenes[si];
    const sPath = 'scenes[' + si + ']';

    if (!scene || typeof scene !== 'object') {
      add('error', 'INVALID_SCENE', sPath + ' 가 객체가 아닙니다', sPath);
      continue;
    }
    if (!scene.id) {
      add('error', 'MISSING_SCENE_ID', sPath + '.id 가 없습니다', sPath + '.id');
    }
    if (!Array.isArray(scene.entities)) {
      add('error', 'MISSING_ENTITIES', sPath + '.entities 는 배열이어야 합니다', sPath + '.entities');
      continue;
    }

    const entityIds = new Set();

    for (let ei = 0; ei < scene.entities.length; ei++) {
      const entity = scene.entities[ei];
      const ePath = sPath + '.entities[' + ei + ']';

      if (!entity || typeof entity !== 'object') {
        add('error', 'INVALID_ENTITY', ePath + ' 가 객체가 아닙니다', ePath);
        continue;
      }

      // 엔티티 id 중복 검사
      if (!entity.id) {
        add('error', 'MISSING_ENTITY_ID', ePath + '.id 가 없습니다', ePath + '.id');
      } else {
        if (entityIds.has(entity.id)) {
          add('error', 'DUPLICATE_ENTITY_ID',
            '씬 내 중복 entity id: "' + entity.id + '"', ePath + '.id');
        }
        entityIds.add(entity.id);
      }

      // transform 존재 확인
      if (!entity.transform || typeof entity.transform !== 'object') {
        add('error', 'MISSING_TRANSFORM', ePath + '.transform 이 없습니다', ePath + '.transform');
      }

      // 컴포넌트 배열 확인
      if (!Array.isArray(entity.components)) {
        add('error', 'MISSING_COMPONENTS', ePath + '.components 는 배열이어야 합니다', ePath + '.components');
        continue;
      }

      // 컴포넌트 type 집합 수집
      const compTypes = new Set();
      for (let ci = 0; ci < entity.components.length; ci++) {
        const comp = entity.components[ci];
        const cPath = ePath + '.components[' + ci + ']';

        if (!comp || typeof comp !== 'object') {
          add('error', 'INVALID_COMPONENT', cPath + ' 가 객체가 아닙니다', cPath);
          continue;
        }
        if (!comp.type) {
          add('error', 'MISSING_COMPONENT_TYPE', cPath + '.type 이 없습니다', cPath + '.type');
          continue;
        }

        const isKnown   = ALL_COMPONENTS.includes(comp.type);
        const isImpl    = IMPL_SET.has(comp.type);

        if (!isKnown) {
          // 전체 목록에도 없는 완전 미지 타입 → error
          add('error', 'UNKNOWN_COMPONENT',
            'entity "' + (entity.id || '?') + '" 의 알 수 없는 컴포넌트 타입: "' + comp.type + '"',
            cPath + '.type');
        } else if (!isImpl) {
          // 알려진 계획 타입이지만 P0a 미구현 → not-yet warn
          add('warn', 'COMPONENT_NOT_YET',
            'entity "' + (entity.id || '?') + '" 의 컴포넌트 "' + comp.type +
            '" 은 아직 구현되지 않았습니다 (not-yet)',
            cPath + '.type');
        }

        // 컴포넌트 타입별 필드 검증 (구현 완료 컴포넌트만)
        if (comp.type === 'Sprite') {
          // 7. 댕글링 자산 ref 검사
          if (!comp.sprite) {
            add('error', 'MISSING_SPRITE_REF',
              'entity "' + (entity.id || '?') + '" Sprite.sprite 필드가 없습니다', cPath + '.sprite');
          } else if (!spriteIds.has(comp.sprite)) {
            add('error', 'DANGLING_SPRITE_REF',
              'entity "' + (entity.id || '?') + '" Sprite.sprite "' + comp.sprite +
              '" 이 assets.sprites 에 선언되지 않았습니다', cPath + '.sprite');
          }
        }

        if (comp.type === 'Body') {
          if (comp.shape !== 'aabb' && comp.shape !== 'circle') {
            add('error', 'INVALID_BODY_SHAPE',
              'entity "' + (entity.id || '?') + '" Body.shape 은 "aabb"|"circle" 이어야 합니다',
              cPath + '.shape');
          }
          if (comp.shape === 'aabb') {
            if (!(comp.w > 0)) {
              add('error', 'MISSING_BODY_DIMENSION',
                'entity "' + (entity.id || '?') + '" Body(aabb).w 는 양수여야 합니다', cPath + '.w');
            }
            if (!(comp.h > 0)) {
              add('error', 'MISSING_BODY_DIMENSION',
                'entity "' + (entity.id || '?') + '" Body(aabb).h 는 양수여야 합니다', cPath + '.h');
            }
          }
          if (comp.shape === 'circle' && !(comp.radius > 0)) {
            add('error', 'MISSING_BODY_DIMENSION',
              'entity "' + (entity.id || '?') + '" Body(circle).radius 는 양수여야 합니다', cPath + '.radius');
          }
        }

        if (comp.type === 'TopDownController') {
          if (!(comp.speed > 0)) {
            add('error', 'INVALID_CONTROLLER_SPEED',
              'entity "' + (entity.id || '?') + '" TopDownController.speed 는 양수여야 합니다', cPath + '.speed');
          }
          if (!['wasd', 'stick', 'both'].includes(comp.input)) {
            add('error', 'INVALID_CONTROLLER_INPUT',
              'entity "' + (entity.id || '?') + '" TopDownController.input 은 "wasd"|"stick"|"both" 이어야 합니다',
              cPath + '.input');
          }
        }

        compTypes.add(comp.type);
      }

      // 8. 필수 컴포넌트 조합 검사: Body 없이 TopDownController → warn
      if (compTypes.has('TopDownController') && !compTypes.has('Body')) {
        add('warn', 'MISSING_BODY_FOR_CONTROLLER',
          'entity "' + (entity.id || '?') + '" 에 TopDownController 가 있지만 Body 가 없습니다 — 충돌 분리 비활성',
          ePath);
      }

      // 9. 도달 불가 스폰 검사: transform 좌표가 벽 AABB 안에 완전히 들어있으면 경고
      if (entity.transform && walls.length > 0) {
        const tx = entity.transform.x;
        const ty = entity.transform.y;
        if (typeof tx === 'number' && typeof ty === 'number') {
          for (let wi = 0; wi < walls.length; wi++) {
            const wall = walls[wi];
            if (typeof wall.x === 'number' && typeof wall.y === 'number' &&
                typeof wall.w === 'number' && typeof wall.h === 'number') {
              if (pointInWall(tx, ty, wall)) {
                add('warn', 'SPAWN_INSIDE_WALL',
                  'entity "' + (entity.id || '?') + '" 스폰 위치(' + tx + ',' + ty +
                  ')가 walls[' + wi + '] 안에 있습니다 (도달 불가)',
                  ePath + '.transform');
                break; // 첫 번째 충돌 벽만 보고
              }
            }
          }
        }
      }
    }
  }
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);

  if (!args.file) {
    process.stderr.write('사용법: node lint-scene.mjs --file <scene.json> [--json]\n');
    process.exit(2);
  }

  // 파일 로드
  const absFile = path.resolve(process.cwd(), args.file);
  let raw;
  try {
    raw = fs.readFileSync(absFile, 'utf8');
  } catch (e) {
    const errResult = {
      ok: false,
      counts: { error: 1, warn: 0, info: 0 },
      findings: [{ level: 'error', code: 'FILE_NOT_FOUND', message: '파일을 읽을 수 없습니다: ' + absFile }],
      file: args.file
    };
    if (!args.jsonOnly) {
      process.stdout.write('[ERROR] FILE_NOT_FOUND 파일을 읽을 수 없습니다: ' + absFile + '\n');
    }
    process.stdout.write(JSON.stringify(errResult) + '\n');
    process.exit(1);
  }

  // JSON 파싱
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    const errResult = {
      ok: false,
      counts: { error: 1, warn: 0, info: 0 },
      findings: [{ level: 'error', code: 'INVALID_JSON', message: 'JSON 파싱 오류: ' + e.message }],
      file: args.file
    };
    if (!args.jsonOnly) {
      process.stdout.write('[ERROR] INVALID_JSON JSON 파싱 오류: ' + e.message + '\n');
    }
    process.stdout.write(JSON.stringify(errResult) + '\n');
    process.exit(1);
  }

  // 검증 실행
  const report = makeReport(args.file);
  lintScene(doc, report);

  const counts = { error: 0, warn: 0, info: 0 };
  for (const f of report.findings) {
    if (f.level === 'error') counts.error++;
    else if (f.level === 'warn') counts.warn++;
    else counts.info++;
  }

  const ok = counts.error === 0;

  // 사람용 출력 (--json 플래그 없을 때)
  if (!args.jsonOnly) {
    for (const f of report.findings) {
      const tag = f.level === 'error' ? '[ERROR]' :
                  f.level === 'warn'  ? '[WARN] ' : '[INFO] ';
      const loc = f.path ? ' (' + f.path + ')' : '';
      process.stdout.write(tag + ' ' + f.code + ' ' + f.message + loc + '\n');
    }
    if (report.findings.length === 0) {
      process.stdout.write('[OK] 검증 통과 — 문제 없음\n');
    }
    process.stdout.write(
      '결과: error=' + counts.error +
      ' warn=' + counts.warn +
      ' info=' + counts.info +
      ' file=' + args.file + '\n'
    );
  }

  // 마지막 줄 단일 JSON
  const result = { ok, counts, findings: report.findings, file: args.file };
  process.stdout.write(JSON.stringify(result) + '\n');

  process.exit(ok ? 0 : 1);
}

main();
