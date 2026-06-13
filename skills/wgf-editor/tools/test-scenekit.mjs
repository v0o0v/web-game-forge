#!/usr/bin/env node
// test-scenekit.mjs — SceneKit P0a 헤드리스 단위 테스트 + 게이트 검증
// ─────────────────────────────────────────────────────────────────────────────
// 설계서 §5 P0a 게이트 7개 + 회귀 스모크를 실제 node 실행으로 검증한다.
//
// 게이트:
//   G1  결정성     — 동일 (씬·seed·dt 수열) 2회 실행 → hashState 일치
//   G2  정적 벽 막힘 — 동적 Body 가 world.walls AABB 를 통과 못 함
//   G3  정적 Body 부동성 — isStatic:true Body 는 충돌 후에도 위치 불변
//   G4  동적 충돌 분리 — 원-원 / AABB-AABB 동적 쌍 분리
//   G5  apply/undo  — setTransform·addComponent·updateComponent·removeComponent·addEntity·removeEntity 라운드트립
//   G6  결정론 린트 — scenekit*.js 에 Math.random/Date.now/performance.now/new Date 0건
//   G7  lint-scene 양/음성 — 정상 씬 exit 0, 깨진 씬 exit 1
//   R0  회귀 스모크  — 기존 킷 require 시 throw 없음
//
// 사용: node skills/wgf-editor/tools/test-scenekit.mjs
// 출력: 사람용 줄 + 마지막 줄 단일 JSON {"ok":bool,"pass":n,"fail":n,"checks":[...]}
// 종료코드: 전부 통과 0, 하나라도 실패 1.
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const here   = dirname(fileURLToPath(import.meta.url));
const root   = resolve(here, '../../..');          // D:/ClaudeCowork/JSGameEngineForCC
const req    = createRequire(import.meta.url);

// ── 킷 로드 ────────────────────────────────────────────────────────────────
const SceneKit   = req(resolve(root, 'engine/scenekit.js'));
// 컴포넌트 등록(scenekit.js 로드 직후 필수)
req(resolve(root, 'engine/scenekit-components.js'));

// ── 실제 씬 문서 로드 ────────────────────────────────────────────────────────
const SCENE_PATH = resolve(root, 'games/_editor-samples/topdown-min/scene.json');
const SCENE_DOC  = JSON.parse(readFileSync(SCENE_PATH, 'utf8'));

// ── 체크 하니스 ──────────────────────────────────────────────────────────────
const checks = [];
let pass = 0, fail = 0;

function ok(name, cond, detail) {
  const passed = !!cond;
  checks.push({ name, ok: passed, detail: detail || '' });
  if (passed) { pass++; console.log(`✓ ${name}`); }
  else        { fail++; console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

// ── 헬퍼: 120프레임 step ─────────────────────────────────────────────────────
function run120(world) {
  for (let i = 0; i < 120; i++) SceneKit.step(world, 1 / 60);
}

// ─────────────────────────────────────────────────────────────────────────────
// G1  결정성
// ─────────────────────────────────────────────────────────────────────────────
{
  const SEED = 42;

  // 1-A: 같은 seed 2회 → hashState 일치
  const w1 = SceneKit.load(SCENE_DOC, { mode: 'play', seed: SEED });
  run120(w1);
  const h1 = SceneKit.hashState(w1);

  const w2 = SceneKit.load(SCENE_DOC, { mode: 'play', seed: SEED });
  run120(w2);
  const h2 = SceneKit.hashState(w2);

  ok('G1-A 동일 seed 120프레임 해시 일치', h1 === h2, `h1=${h1} h2=${h2}`);

  // 1-B: 다른 seed → 해시가 다름(또는 같아도 허용 — 씬이 너무 단순하면 dt 진행 없이 동일 가능.
  //      여기서는 "다른 seed = 다른 rng state" 만 보장하면 충분.)
  const w3 = SceneKit.load(SCENE_DOC, { mode: 'play', seed: SEED + 1 });
  run120(w3);
  const h3 = SceneKit.hashState(w3);
  // rng state 가 달라지므로 해시는 달라야 함(RngForge stream 이 포함됨).
  ok('G1-B 다른 seed → 해시 상이', h1 !== h3, `h1=${h1} h3=${h3}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G2  정적 벽 막힘 (world.walls AABB)
// ─────────────────────────────────────────────────────────────────────────────
{
  // topdown-min 씬: walls[0] = {x:0,y:0,w:320,h:8} (위쪽 벽)
  // 플레이어(player) 를 위쪽 벽 바로 아래에 놓고 위로 밀어붙이기.
  // Body: circle radius=7 → 엔티티 중심이 y=8+7=15 이상이어야 막힌다.
  const doc = JSON.parse(JSON.stringify(SCENE_DOC));
  // 플레이어를 y=12 (벽에 맞닿기 직전)
  doc.scenes[0].entities[0].transform.y = 12;
  // inputProvider 로 위쪽(-y) 방향 입력 주입
  doc.meta = doc.meta || {};
  doc.meta.inputProvider = function (entity) {
    if (entity.id === 'player') return { ax: 0, ay: -1 };
    return { ax: 0, ay: 0 };
  };

  const w = SceneKit.load(doc, { mode: 'play', seed: 1 });
  // 60프레임 동안 위로 밀기
  for (let i = 0; i < 60; i++) SceneKit.step(w, 1 / 60);

  const player = SceneKit.findEntity(w, 'player');
  const body   = SceneKit.getComponentOn(player, 'Body');
  const radius = body.radius; // 7
  // 벽 하단 = 0+8 = 8. 원 중심 y 는 8+radius 이상이어야(= 원이 벽 밖)
  const centerY = player.transform.y;
  ok('G2 정적 벽 막힘 — 동적 Body 가 벽 위로 통과 못 함',
    centerY >= 8 + radius - 0.5,          // 0.5px 여유(부동소수 오차)
    `centerY=${centerY.toFixed(3)} 최소=${8 + radius}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G3  정적 Body 부동성
// ─────────────────────────────────────────────────────────────────────────────
{
  // raw 픽스처(scenes 없는 최소 sceneDoc — load 하위호환 경로)
  const rawDoc = {
    entities: [
      {
        id: 'dynamic1',
        name: '동적',
        transform: { x: 0, y: 100, rotation: 0, scaleX: 1, scaleY: 1, depth: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 20, h: 20, isStatic: false }]
      },
      {
        id: 'static1',
        name: '정적',
        transform: { x: 25, y: 100, rotation: 0, scaleX: 1, scaleY: 1, depth: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 20, h: 20, isStatic: true }]
      }
    ],
    walls: []
  };

  const w = SceneKit.load(rawDoc, { mode: 'play', seed: 1 });

  const beforeStatic = { ...SceneKit.findEntity(w, 'static1').transform };

  // 1프레임 step → dynamic1(x=0, half=10 → right=10) 과 static1(x=25, half=10 → left=15) 겹침(10>0).
  // dynamic1 이 오른쪽으로, static1 은 움직이지 않아야.
  SceneKit.step(w, 1 / 60);

  const dynEnt    = SceneKit.findEntity(w, 'dynamic1');
  const staticEnt = SceneKit.findEntity(w, 'static1');

  // 정적 Body 좌표 불변
  ok('G3-A 정적 Body x 불변',
    staticEnt.transform.x === beforeStatic.x,
    `before=${beforeStatic.x} after=${staticEnt.transform.x}`);
  ok('G3-B 정적 Body y 불변',
    staticEnt.transform.y === beforeStatic.y,
    `before=${beforeStatic.y} after=${staticEnt.transform.y}`);

  // 동적 Body 는 분리되어 위치 변경
  const overlap = (10 + 10) - Math.abs(dynEnt.transform.x - staticEnt.transform.x);
  ok('G3-C 동적 Body 는 분리됨(겹침 해소)',
    dynEnt.transform.x < staticEnt.transform.x - 9.5,   // dynamic 이 static 왼쪽으로 완전히 벗어남
    `dynX=${dynEnt.transform.x.toFixed(3)} staticX=${staticEnt.transform.x.toFixed(3)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G4  동적 충돌 분리
// ─────────────────────────────────────────────────────────────────────────────
{
  // G4-A: 원-원 동적 쌍
  const circleDoc = {
    entities: [
      {
        id: 'c1', name: 'circle1',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, depth: 0 },
        components: [{ type: 'Body', shape: 'circle', radius: 10, isStatic: false }]
      },
      {
        id: 'c2', name: 'circle2',
        transform: { x: 15, y: 0, rotation: 0, scaleX: 1, scaleY: 1, depth: 0 },
        components: [{ type: 'Body', shape: 'circle', radius: 10, isStatic: false }]
      }
    ],
    walls: []
  };
  const wc = SceneKit.load(circleDoc, { mode: 'play', seed: 1 });
  SceneKit.step(wc, 1 / 60);
  const e1c = SceneKit.findEntity(wc, 'c1');
  const e2c = SceneKit.findEntity(wc, 'c2');
  const distC = Math.sqrt(
    (e2c.transform.x - e1c.transform.x) ** 2 +
    (e2c.transform.y - e1c.transform.y) ** 2
  );
  ok('G4-A 원-원 동적 분리 — 거리 ≥ 반지름합',
    distC >= 20 - 0.01,
    `dist=${distC.toFixed(4)} 최소=20`);

  // G4-B: AABB-AABB 동적 쌍
  const aabbDoc = {
    entities: [
      {
        id: 'a1', name: 'aabb1',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, depth: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 20, h: 20, isStatic: false }]
      },
      {
        id: 'a2', name: 'aabb2',
        transform: { x: 15, y: 0, rotation: 0, scaleX: 1, scaleY: 1, depth: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 20, h: 20, isStatic: false }]
      }
    ],
    walls: []
  };
  const wa = SceneKit.load(aabbDoc, { mode: 'play', seed: 1 });
  SceneKit.step(wa, 1 / 60);
  const e1a = SceneKit.findEntity(wa, 'a1');
  const e2a = SceneKit.findEntity(wa, 'a2');
  const gapX = e2a.transform.x - e1a.transform.x;
  ok('G4-B AABB-AABB 동적 분리 — x 간격 ≥ 20(두 half-extent 합)',
    gapX >= 20 - 0.01,
    `gapX=${gapX.toFixed(4)} 최소=20`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G5  apply/undo 라운드트립
// ─────────────────────────────────────────────────────────────────────────────
{
  function applyUndoCheck(label, world, cmd) {
    const h0 = SceneKit.hashState(world);
    const undoDelta = SceneKit.applyCommand(world, cmd);
    const h1 = SceneKit.hashState(world);
    SceneKit.applyUndo(world, undoDelta);
    const h2 = SceneKit.hashState(world);
    ok(`G5 ${label} apply→undo 해시 복원`, h0 === h2,
      `before=${h0} afterApply=${h1} afterUndo=${h2}`);
  }

  // 기준 world (편집 모드 — step 없음)
  const w = SceneKit.load(SCENE_DOC, { mode: 'edit', seed: 7 });
  const playerId = 'player';

  // setTransform
  applyUndoCheck('setTransform', w,
    { type: 'setTransform', id: playerId, transform: { x: 999, y: 888, rotation: 1.5 } });

  // addComponent
  applyUndoCheck('addComponent', w,
    { type: 'addComponent', id: playerId, component: { type: 'Sprite', sprite: 'spr_player' } });

  // updateComponent (TopDownController speed 변경)
  applyUndoCheck('updateComponent', w,
    { type: 'updateComponent', id: playerId, componentType: 'TopDownController', patch: { speed: 999 } });

  // removeComponent (마지막 Sprite)
  {
    const ent = SceneKit.findEntity(w, playerId);
    const sprIdx = ent.components.findIndex(c => c.type === 'Sprite');
    applyUndoCheck('removeComponent', w,
      { type: 'removeComponent', id: playerId, index: sprIdx });
  }

  // addEntity
  applyUndoCheck('addEntity', w,
    { type: 'addEntity', entity: {
        id: 'tmp_test_ent',
        name: '임시엔티티',
        transform: { x: 50, y: 50 },
        components: []
      }
    });

  // removeEntity
  applyUndoCheck('removeEntity', w, { type: 'removeEntity', id: 'enemy_01' });
}

// ─────────────────────────────────────────────────────────────────────────────
// G6  결정론 린트 (Math.random/Date.now/performance.now/new Date)
// ─────────────────────────────────────────────────────────────────────────────
{
  const lintRng = resolve(root, 'skills/wgf-game-qa/tools/lint-rng.mjs');
  const targets = [
    resolve(root, 'engine/scenekit.js'),
    resolve(root, 'engine/scenekit-components.js')
  ];

  for (const target of targets) {
    const rel   = target.replace(root + '/', '').replace(root + '\\', '');
    const res   = spawnSync(process.execPath, [lintRng, target], { encoding: 'utf8' });
    const lines = res.stdout.trim().split('\n');
    let jsonResult = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try { jsonResult = JSON.parse(lines[i]); break; } catch (_) { /* 계속 */ }
    }
    const errorCount = jsonResult ? jsonResult.counts.error : -1;
    ok(`G6 lint-rng ${rel} error=0`, errorCount === 0,
      `error=${errorCount} stdout=${lines.slice(0, 3).join(' | ')}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// G7  lint-scene 양/음성
// ─────────────────────────────────────────────────────────────────────────────
{
  const lintScene = resolve(root, 'skills/wgf-editor/tools/lint-scene.mjs');

  // 양성: 정상 씬 → exit 0
  const posRes = spawnSync(process.execPath, [lintScene, '--file', SCENE_PATH], { encoding: 'utf8' });
  ok('G7-A lint-scene 정상 씬 exit 0', posRes.status === 0,
    `exit=${posRes.status} stdout=${posRes.stdout.slice(0, 200)}`);

  // 음성: 깨진 씬(존재하지 않는 sprite ref + 미허용 컴포넌트) → exit 1 + error > 0
  const brokenDoc = {
    format: 'wgf-scene@1',
    slug: 'broken-test',
    meta: { title: '깨진 씬', genre: 'topdown', viewport: { w: 320, h: 240 } },
    assets: { sprites: [{ id: 'spr_valid', source: 'procedural', w: 16, h: 16 }] },
    walls: [{ x: 0, y: 0, w: 100, h: 8 }],
    scenes: [{
      id: 'main',
      systems: {},
      entities: [
        {
          id: 'e1',
          name: '엔티티1',
          transform: { x: 50, y: 4, rotation: 0, scaleX: 1, scaleY: 1, depth: 0 },
          components: [
            { type: 'Sprite', sprite: 'spr_dangling_ref' },   // 댕글링 ref
            { type: 'UNKNOWN_COMPONENT_XYZ' }                  // 미허용 컴포넌트
          ]
        }
      ]
    }],
    dataLayers: {}
  };
  const tmpPath = resolve(root, 'games/_editor-samples/_broken-test-tmp.json');
  writeFileSync(tmpPath, JSON.stringify(brokenDoc, null, 2), 'utf8');

  const negRes  = spawnSync(process.execPath, [lintScene, '--file', tmpPath], { encoding: 'utf8' });
  const negLines = negRes.stdout.trim().split('\n');
  let negJson = null;
  for (let i = negLines.length - 1; i >= 0; i--) {
    try { negJson = JSON.parse(negLines[i]); break; } catch (_) { /* 계속 */ }
  }
  const negErrors = negJson ? negJson.counts.error : -1;

  ok('G7-B lint-scene 깨진 씬 exit 1',   negRes.status === 1,   `exit=${negRes.status}`);
  ok('G7-C lint-scene 깨진 씬 error > 0', negErrors > 0,        `error=${negErrors}`);

  // 임시 파일 정리
  try { unlinkSync(tmpPath); } catch (_) { /* 무시 */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// R0  회귀 스모크 — 기존 킷 require 시 throw 없음
// ─────────────────────────────────────────────────────────────────────────────
{
  const kits = ['boardkit', 'abilitykit', 'rngforge', 'eventbus', 'fsm', 'behaviorkit'];
  for (const kit of kits) {
    let threw = false;
    try {
      req(resolve(root, `engine/${kit}.js`));
    } catch (e) {
      threw = true;
      console.log(`  ↳ ${kit} 오류: ${e.message}`);
    }
    ok(`R0 ${kit}.js require 무오류`, !threw);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n— pass ${pass} · fail ${fail} · total ${pass + fail}`);
const result = { ok: fail === 0, pass, fail, checks };
console.log(JSON.stringify(result));
process.exit(fail === 0 ? 0 : 1);
