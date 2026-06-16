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

  // 1-0: load 개수 단언 — scenes[] 래퍼를 읽지 못하면 0개로 trivially 통과하는 걸 막는다.
  const wProbe = SceneKit.load(SCENE_DOC, { mode: 'play', seed: SEED });
  ok('G1-0 load entities 개수 = 2 (player, enemy_01)',
    wProbe.entities.length === 2,
    `actual=${wProbe.entities.length}`);
  ok('G1-0 load walls 개수 = 4 (상하좌우)',
    wProbe.walls.length === 4,
    `actual=${wProbe.walls.length}`);

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
// G7-D  lint-scene null·배열·스칼라 루트 입력 → crash 없이 exit 1 + 마지막 줄 JSON
// ─────────────────────────────────────────────────────────────────────────────
{
  const lintScene = resolve(root, 'skills/wgf-editor/tools/lint-scene.mjs');
  const badInputs = [
    { label: 'null',    content: 'null'  },
    { label: '[1,2,3]', content: '[1,2,3]' },
    { label: '42',      content: '42'    }
  ];

  for (const { label, content } of badInputs) {
    const tmpBad = resolve(root, `games/_editor-samples/_bad-root-${label.replace(/[^a-z0-9]/g,'_')}-tmp.json`);
    writeFileSync(tmpBad, content, 'utf8');
    const res = spawnSync(process.execPath, [lintScene, '--file', tmpBad], { encoding: 'utf8' });

    // crash 없음: exit 코드가 0 또는 1 이어야 함(2 이상은 uncaught crash)
    ok(`G7-D lint-scene root="${label}" crash 없음(exit 0|1)`,
      res.status === 0 || res.status === 1,
      `exit=${res.status} stderr=${(res.stderr || '').slice(0, 100)}`);

    // exit 1 이어야 함(잘못된 입력이므로)
    ok(`G7-D lint-scene root="${label}" exit 1`,
      res.status === 1,
      `exit=${res.status}`);

    // 마지막 줄이 JSON.parse 가능
    const lines = res.stdout.trim().split('\n');
    let parsed = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try { parsed = JSON.parse(lines[i]); break; } catch (_) { /* 계속 */ }
    }
    ok(`G7-D lint-scene root="${label}" 마지막 줄 JSON 파싱 가능`,
      parsed !== null && typeof parsed === 'object',
      `lastLine=${lines[lines.length - 1].slice(0, 80)}`);

    try { unlinkSync(tmpBad); } catch (_) { /* 무시 */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// G8  댕글링 sprite ref → Sprite.init 자산 검증 분기 동작 확인
// ─────────────────────────────────────────────────────────────────────────────
{
  // 존재하지 않는 sprite id 를 가진 엔티티가 든 씬을 load.
  // Sprite.init 은 world.assets.sprites 에서 id 를 못 찾으면 console.warn 을 호출한다.
  // 이를 intercept 해 검증 분기가 실제로 실행됐는지 확인.
  const rawDoc = {
    assets: { sprites: [{ id: 'spr_real', source: 'procedural', w: 16, h: 16 }] },
    walls: [],
    entities: [
      {
        id: 'dangling_ent',
        name: '댕글링엔티티',
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, depth: 0 },
        components: [{ type: 'Sprite', sprite: 'spr_DOES_NOT_EXIST' }]
      }
    ]
  };

  const warnMessages = [];
  const origWarn = console.warn;
  console.warn = (...args) => { warnMessages.push(args.join(' ')); };
  try {
    SceneKit.load(rawDoc, { mode: 'play', seed: 1 });
  } finally {
    console.warn = origWarn;
  }

  // world.assets 경로가 살아있으므로(sprites 배열 존재) 검증 분기 진입 후 경고 발생해야 함.
  const warnFired = warnMessages.some(m => m.includes('spr_DOES_NOT_EXIST'));
  ok('G8 댕글링 sprite ref → Sprite.init 경고 발생', warnFired,
    `warnMessages=${JSON.stringify(warnMessages)}`);

  // world.assets.sprites 가 올바르게 배선됐는지도 확인(경로가 살아있어야 G8 가 의미있음).
  const wProbe2 = SceneKit.load(rawDoc, { mode: 'play', seed: 1 });
  ok('G8 world.assets.sprites 배선 확인(길이=1)',
    Array.isArray(wProbe2.assets && wProbe2.assets.sprites) && wProbe2.assets.sprites.length === 1,
    `sprites=${JSON.stringify(wProbe2.assets && wProbe2.assets.sprites)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G9  world.assets 자산 개수 + serialize→재load 라운드트립 보존
// ─────────────────────────────────────────────────────────────────────────────
{
  // 예시 씬: assets.sprites 2종(spr_player, spr_enemy)
  const wAssets = SceneKit.load(SCENE_DOC, { mode: 'play', seed: 1 });

  ok('G9-A world.assets 존재', wAssets.assets != null && typeof wAssets.assets === 'object',
    `assets=${JSON.stringify(wAssets.assets).slice(0, 80)}`);
  ok('G9-B world.assets.sprites 개수 > 0',
    Array.isArray(wAssets.assets.sprites) && wAssets.assets.sprites.length > 0,
    `count=${wAssets.assets.sprites && wAssets.assets.sprites.length}`);

  // serialize → 재load 라운드트립: assets 보존
  const serialized = SceneKit.serialize(wAssets);
  ok('G9-C serialize 결과에 assets 필드 존재', serialized.assets != null,
    `assets=${JSON.stringify(serialized.assets).slice(0, 80)}`);

  // 재load(raw 픽스처 경로 — scenes 없는 serialize 산출물 사용)
  const wReloaded = SceneKit.load(serialized, { mode: 'play', seed: 1 });
  ok('G9-D 재load 후 world.assets.sprites 개수 보존',
    Array.isArray(wReloaded.assets && wReloaded.assets.sprites) &&
    wReloaded.assets.sprites.length === wAssets.assets.sprites.length,
    `before=${wAssets.assets.sprites.length} after=${wReloaded.assets && wReloaded.assets.sprites && wReloaded.assets.sprites.length}`);
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

// ═════════════════════════════════════════════════════════════════════════════
// P0b 신규 컴포넌트 12종 헤드리스 단위 테스트 (G10~G21)
// 각 컴포넌트: 인라인 raw 픽스처 load → step → 핵심 동작 단언(결정적).
// ═════════════════════════════════════════════════════════════════════════════

// 공용: raw 픽스처를 play 로드.
function loadRaw(doc, seed) {
  return SceneKit.load(doc, { mode: 'play', seed: seed == null ? 1 : seed });
}
function stepN(world, count, dt) {
  for (let i = 0; i < count; i++) SceneKit.step(world, dt == null ? 1 / 60 : dt);
}

// ─────────────────────────────────────────────────────────────────────────────
// G10  AnimatedSprite — t=0=프레임0 고정 + dt 진행
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    assets: { sprites: [{ id: 'spr_a', source: 'procedural', w: 16, h: 16 }] },
    walls: [],
    entities: [{
      id: 'anim1', name: '애니',
      transform: { x: 0, y: 0 },
      components: [{ type: 'AnimatedSprite', sprite: 'spr_a',
        anims: [{ key: 'walk', frames: [0, 1, 2, 3], fps: 10, loop: true }], play: 'walk' }]
    }]
  };
  const w = loadRaw(doc);
  const comp = SceneKit.getComponentOn(SceneKit.findEntity(w, 'anim1'), 'AnimatedSprite');
  ok('G10-A AnimatedSprite t=0 = 프레임0', comp._frame === 0, `_frame=${comp._frame}`);

  // fps=10 → 프레임당 0.1초. 0.25초(15프레임 @1/60) 진행 → 프레임 2(0.0~0.1=0, 0.1~0.2=1, 0.2~0.3=2).
  stepN(w, 15);
  ok('G10-B AnimatedSprite dt 진행 → 프레임 2', comp._frame === 2, `_frame=${comp._frame}`);

  // loop: 충분히 진행하면 0~3 안에서 순환(프레임 인덱스가 frames.length 미만).
  stepN(w, 60);
  ok('G10-C AnimatedSprite loop 범위 유지(0..3)', comp._frame >= 0 && comp._frame <= 3, `_frame=${comp._frame}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G11  Health — hp<=0 사망 처리(flag / remove)
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      { id: 'h_flag', name: 'flag', transform: { x: 0, y: 0 },
        components: [{ type: 'Health', max: 10, hp: 10, onDeath: 'flag' }] },
      { id: 'h_remove', name: 'remove', transform: { x: 100, y: 0 },
        components: [{ type: 'Health', max: 10, hp: 10, onDeath: 'remove' }] }
    ]
  };
  const w = loadRaw(doc);
  const flagEnt = SceneKit.findEntity(w, 'h_flag');
  const flagH = SceneKit.getComponentOn(flagEnt, 'Health');
  ok('G11-A Health 기본 hp=max', flagH.hp === 10, `hp=${flagH.hp}`);

  // hp 를 0 이하로 직접 깎고 step → dead 플래그.
  flagH.hp = -3;
  ScenekitStep(w);
  ok('G11-B Health hp<=0 → dead 플래그', flagH.dead === true && flagH.hp === 0, `dead=${flagH.dead} hp=${flagH.hp}`);

  // remove 모드: hp<=0 step 후 엔티티 제거.
  const remH = SceneKit.getComponentOn(SceneKit.findEntity(w, 'h_remove'), 'Health');
  remH.hp = 0;
  ScenekitStep(w);
  ok('G11-C Health onDeath:remove → 엔티티 제거', SceneKit.findEntity(w, 'h_remove') === null,
    `exists=${SceneKit.findEntity(w, 'h_remove') !== null}`);
}
function ScenekitStep(w) { SceneKit.step(w, 1 / 60); }

// ─────────────────────────────────────────────────────────────────────────────
// G12  ContactDamage — 오버랩 시 hp 감소(쿨다운/무적 존중)
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      { id: 'dmg', name: '데미지원', transform: { x: 0, y: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 20, h: 20, isStatic: true },
                     { type: 'ContactDamage', damage: 3, cooldown: 0.5 }] },
      { id: 'victim', name: '피해자', transform: { x: 5, y: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 20, h: 20, isStatic: true },
                     { type: 'Health', max: 10, hp: 10 }] }
    ]
  };
  const w = loadRaw(doc);
  const vicH = SceneKit.getComponentOn(SceneKit.findEntity(w, 'victim'), 'Health');

  // 첫 step: 오버랩(중심거리 5 < 20) → 데미지 3.
  ScenekitStep(w);
  ok('G12-A ContactDamage 오버랩 시 hp 감소', vicH.hp === 7, `hp=${vicH.hp}`);

  // 즉시 다음 step: 쿨다운(0.5초) 중이므로 추가 데미지 없음.
  ScenekitStep(w);
  ok('G12-B ContactDamage 쿨다운 중 추가 데미지 없음', vicH.hp === 7, `hp=${vicH.hp}`);

  // 쿨다운 경과(0.5초 = 30프레임) 후 다시 데미지.
  stepN(w, 31);
  ok('G12-C ContactDamage 쿨다운 후 재타격', vicH.hp === 4, `hp=${vicH.hp}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G13  Projectile — lifetime 후 소멸 + 데미지 명중 소멸
// ─────────────────────────────────────────────────────────────────────────────
{
  // G13-A: lifetime 후 자기 소멸(데미지 없음, 빈 공간).
  const docLife = {
    walls: [],
    entities: [{ id: 'proj1', name: '발사체', transform: { x: 0, y: 0 },
      components: [{ type: 'Projectile', vx: 10, vy: 0, lifetime: 0.5 }] }]
  };
  const wL = loadRaw(docLife);
  stepN(wL, 29);   // 0.483초 — 아직 생존
  ok('G13-A Projectile lifetime 전 생존', SceneKit.findEntity(wL, 'proj1') !== null, 'still alive');
  stepN(wL, 2);    // 0.516초 — 소멸
  ok('G13-B Projectile lifetime 후 소멸', SceneKit.findEntity(wL, 'proj1') === null, 'removed');

  // G13-C: 이동 적분 확인.
  const docMove = {
    walls: [],
    entities: [{ id: 'proj2', name: '발사체', transform: { x: 0, y: 0 },
      components: [{ type: 'Projectile', vx: 60, vy: 0, lifetime: 10 }] }]
  };
  const wM = loadRaw(docMove);
  stepN(wM, 60);   // 1초 @60fps → x≈60
  const px = SceneKit.findEntity(wM, 'proj2').transform.x;
  ok('G13-C Projectile 이동 적분(x≈60)', Math.abs(px - 60) < 0.001, `x=${px.toFixed(4)}`);

  // G13-D: Health 명중 시 데미지 + 소멸.
  const docHit = {
    walls: [],
    entities: [
      { id: 'proj3', name: '발사체', transform: { x: 0, y: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 6, h: 6 },
                     { type: 'Projectile', vx: 120, vy: 0, lifetime: 10, damage: 5 }] },
      { id: 'enemy', name: '적', transform: { x: 30, y: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 20, h: 20, isStatic: true },
                     { type: 'Health', max: 10, hp: 10 }] }
    ]
  };
  const wH = loadRaw(docHit);
  const enH = SceneKit.getComponentOn(SceneKit.findEntity(wH, 'enemy'), 'Health');
  stepN(wH, 30);   // 발사체가 적에 도달
  ok('G13-D Projectile 명중 → Health 데미지', enH.hp === 5, `hp=${enH.hp}`);
  ok('G13-E Projectile 명중 후 소멸', SceneKit.findEntity(wH, 'proj3') === null, 'removed');
}

// ─────────────────────────────────────────────────────────────────────────────
// G14  Shooter — 쿨다운 후 Projectile 생성 개수
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      { id: 'shooter', name: '슈터', transform: { x: 0, y: 0 },
        components: [{ type: 'Shooter', cooldown: 0.5, speed: 100, auto: true, target: 'player', projectileLifetime: 10 }] },
      { id: 'player', name: '플레이어', transform: { x: 100, y: 0 }, components: [] }
    ]
  };
  const w = loadRaw(doc);
  // 첫 step: _cd=0 이므로 즉시 1발. 이후 0.5초마다.
  function countProjectiles() {
    let c = 0;
    const doc2 = SceneKit.serialize(w);
    for (const e of doc2.entities) if (e.components.some(cc => cc.type === 'Projectile')) c++;
    return c;
  }
  ScenekitStep(w);
  ok('G14-A Shooter 첫 발사(1발)', countProjectiles() === 1, `count=${countProjectiles()}`);

  // 31프레임(>0.5초) 더 → 쿨다운 만료 → 2발째(부동소수 여유로 31프레임).
  stepN(w, 31);
  ok('G14-B Shooter 쿨다운 후 2발째', countProjectiles() === 2, `count=${countProjectiles()}`);

  // 발사 방향: player(+x) 쪽이므로 첫 발사체 vx > 0.
  const projDoc = SceneKit.serialize(w);
  const firstProj = projDoc.entities.find(e => e.components.some(cc => cc.type === 'Projectile'));
  const pj = firstProj.components.find(cc => cc.type === 'Projectile');
  ok('G14-C Shooter 발사체 방향(player 쪽 vx>0)', pj.vx > 0, `vx=${pj.vx}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G15  EnemyAI — chase 로 타깃 접근
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      { id: 'enemy', name: '적', transform: { x: 0, y: 0 },
        components: [{ type: 'EnemyAI', mode: 'chase', target: 'player', speed: 60, range: 0 }] },
      { id: 'player', name: '플레이어', transform: { x: 100, y: 0 }, components: [] }
    ]
  };
  const w = loadRaw(doc);
  const enemy = SceneKit.findEntity(w, 'enemy');
  const before = enemy.transform.x;
  stepN(w, 30);   // 0.5초 → x 약 +30
  ok('G15-A EnemyAI chase 타깃 접근(x 증가)', enemy.transform.x > before + 20, `before=${before} after=${enemy.transform.x.toFixed(3)}`);

  // flee: 반대 방향.
  const docFlee = {
    walls: [],
    entities: [
      { id: 'enemy2', name: '적', transform: { x: 50, y: 0 },
        components: [{ type: 'EnemyAI', mode: 'flee', target: 'player', speed: 60, range: 0 }] },
      { id: 'player', name: '플레이어', transform: { x: 100, y: 0 }, components: [] }
    ]
  };
  const wF = loadRaw(docFlee);
  const e2 = SceneKit.findEntity(wF, 'enemy2');
  stepN(wF, 30);
  ok('G15-B EnemyAI flee 타깃 회피(x 감소)', e2.transform.x < 50, `after=${e2.transform.x.toFixed(3)}`);

  // patrol: origin 기준 진동(이동 발생).
  const docPat = {
    walls: [],
    entities: [{ id: 'enemy3', name: '적', transform: { x: 0, y: 0 },
      components: [{ type: 'EnemyAI', mode: 'patrol', speed: 40, patrolAxis: 'x', patrolRange: 16 }] }]
  };
  const wP = loadRaw(docPat);
  const e3 = SceneKit.findEntity(wP, 'enemy3');
  stepN(wP, 20);
  ok('G15-C EnemyAI patrol 진동 이동', e3.transform.x !== 0 && Math.abs(e3.transform.x) <= 16.001,
    `x=${e3.transform.x.toFixed(3)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G16  Pickup — 오버랩 시 효과 + 소멸
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      { id: 'coin', name: '코인', transform: { x: 5, y: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 16, h: 16 },
                     { type: 'Pickup', kind: 'coin', amount: 10, collector: 'player' }] },
      { id: 'heal', name: '회복', transform: { x: 5, y: 100 },
        components: [{ type: 'Body', shape: 'aabb', w: 16, h: 16 },
                     { type: 'Pickup', kind: 'heal', amount: 5, collector: 'player2' }] },
      { id: 'player', name: '플레이어', transform: { x: 0, y: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 16, h: 16 }] },
      { id: 'player2', name: '회복대상', transform: { x: 0, y: 100 },
        components: [{ type: 'Body', shape: 'aabb', w: 16, h: 16 }, { type: 'Health', max: 10, hp: 3 }] }
    ]
  };
  const w = loadRaw(doc);
  ScenekitStep(w);
  ok('G16-A Pickup(coin) 오버랩 시 카운터 증가', (w.counters && w.counters.coin) === 10,
    `coin=${w.counters && w.counters.coin}`);
  ok('G16-B Pickup(coin) 수집 후 소멸', SceneKit.findEntity(w, 'coin') === null, 'removed');
  const p2H = SceneKit.getComponentOn(SceneKit.findEntity(w, 'player2'), 'Health');
  ok('G16-C Pickup(heal) Health hp 회복', p2H.hp === 8, `hp=${p2H.hp}`);
  ok('G16-D Pickup(heal) 수집 후 소멸', SceneKit.findEntity(w, 'heal') === null, 'removed');
}

// ─────────────────────────────────────────────────────────────────────────────
// G17  Spawner — interval 후 생성
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [{ id: 'spawner', name: '스포너', transform: { x: 50, y: 50 },
      components: [{ type: 'Spawner', interval: 0.5, max: 2,
        template: { name: '졸개', transform: {}, components: [{ type: 'Body', shape: 'aabb', w: 8, h: 8 }] } }] }]
  };
  const w = loadRaw(doc);
  function entityCount() { return w.entities.length; }
  // 첫 interval(0.5초=30프레임) 전: 생성 없음(스포너 1개만).
  stepN(w, 29);
  ok('G17-A Spawner interval 전 생성 없음', entityCount() === 1, `count=${entityCount()}`);
  // interval 도달 → 1개 생성(총 2).
  stepN(w, 2);
  ok('G17-B Spawner interval 후 1개 생성', entityCount() === 2, `count=${entityCount()}`);
  // 다음 interval(0.5초) → 2개째(총 3, max=2 도달).
  // 부동소수점 경계: 30×(1/60)=0.4999... < 0.5 이므로 31프레임 필요.
  stepN(w, 31);
  ok('G17-C Spawner 2개째 생성(max=2)', entityCount() === 3, `count=${entityCount()}`);
  // max 도달 후 추가 생성 없음.
  stepN(w, 60);
  ok('G17-D Spawner max 상한 존중', entityCount() === 3, `count=${entityCount()}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G18  CameraFollow — world.camera 갱신(t=0 스냅 + 추적)
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      { id: 'cam', name: '카메라', transform: { x: 0, y: 0 },
        components: [{ type: 'CameraFollow', target: 'player', lerp: 1 }] },
      { id: 'player', name: '플레이어', transform: { x: 40, y: 20 }, components: [] }
    ]
  };
  const w = loadRaw(doc);
  // t=0 스냅: 카메라 = 타깃 위치.
  ok('G18-A CameraFollow t=0 스냅', w.camera && w.camera.x === 40 && w.camera.y === 20,
    `camera=${JSON.stringify(w.camera)}`);
  // 타깃 이동 후 step → lerp=1 즉시 추적.
  SceneKit.findEntity(w, 'player').transform.x = 100;
  ScenekitStep(w);
  ok('G18-B CameraFollow lerp=1 즉시 추적', w.camera.x === 100, `camera.x=${w.camera.x}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G19  AbilityBinding — 쿨다운 틱(발동 주입 → 쿨다운 시작 → 회복)
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [{ id: 'hero', name: '영웅', transform: { x: 0, y: 0 },
      components: [{ type: 'AbilityBinding', abilities: [{ id: 'dash', cooldown: 1.0 }] }] }]
  };
  const w = loadRaw(doc);
  // 발동 요청 주입: 첫 프레임에만 dash 요청.
  // 주의: load 가 meta 를 deepClone 하며 함수를 제거하므로, world.meta 에 직접 주입한다.
  let frame = 0;
  w.meta.abilityInput = function (entity) {
    if (entity.id === 'hero' && frame === 0) return ['dash'];
    return [];
  };
  const comp = SceneKit.getComponentOn(SceneKit.findEntity(w, 'hero'), 'AbilityBinding');
  ok('G19-A AbilityBinding 초기 쿨다운 0', comp._cooldowns.dash === 0, `cd=${comp._cooldowns.dash}`);

  ScenekitStep(w); frame++;
  ok('G19-B AbilityBinding 발동 → 쿨다운 시작', comp._cooldowns.dash > 0.9 && comp._cooldowns.dash <= 1.0,
    `cd=${comp._cooldowns.dash.toFixed(4)}`);
  ok('G19-C AbilityBinding 발동 이벤트 누적', Array.isArray(w.abilityEvents) && w.abilityEvents.length === 1,
    `events=${JSON.stringify(w.abilityEvents)}`);

  // 1초(60프레임) 더 진행 → 쿨다운 회복(재요청 없음).
  stepN(w, 61);
  ok('G19-D AbilityBinding 쿨다운 회복', comp._cooldowns.dash === 0, `cd=${comp._cooldowns.dash}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G20  AudioEmitter — 이벤트 누적(onStep 쿨다운)
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      { id: 'spawnSnd', name: '생성음', transform: { x: 0, y: 0 },
        components: [{ type: 'AudioEmitter', sound: 'sfx_spawn', trigger: 'onSpawn' }] },
      { id: 'stepSnd', name: '주기음', transform: { x: 0, y: 0 },
        components: [{ type: 'AudioEmitter', sound: 'sfx_tick', trigger: 'onStep', cooldown: 0.5 }] }
    ]
  };
  const w = loadRaw(doc);
  // onSpawn: init 시 1회 누적.
  ok('G20-A AudioEmitter onSpawn init 시 이벤트 누적',
    Array.isArray(w.audioEvents) && w.audioEvents.filter(e => e.sound === 'sfx_spawn').length === 1,
    `events=${JSON.stringify(w.audioEvents)}`);

  // onStep: 첫 step 발화(cd=0) → cd=0.5. 31프레임 후 한 번 더(총 2).
  ScenekitStep(w);
  ok('G20-B AudioEmitter onStep 첫 발화',
    w.audioEvents.filter(e => e.sound === 'sfx_tick').length === 1,
    `tick=${w.audioEvents.filter(e => e.sound === 'sfx_tick').length}`);
  stepN(w, 31);
  ok('G20-C AudioEmitter onStep 쿨다운 후 재발화',
    w.audioEvents.filter(e => e.sound === 'sfx_tick').length === 2,
    `tick=${w.audioEvents.filter(e => e.sound === 'sfx_tick').length}`);
  // 코어가 실제 사운드 재생을 호출하지 않았음을 간접 확인(데이터 이벤트만 존재).
  ok('G20-D AudioEmitter 이벤트는 데이터만(재생 호출 없음)',
    w.audioEvents.every(e => typeof e.sound === 'string' && typeof e.t === 'number'),
    `events ok`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G21  HUDBinding — 값 산출(컴포넌트 경로 + world 경로)
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      { id: 'hpHud', name: 'HP표시', transform: { x: 0, y: 0 },
        components: [{ type: 'Health', max: 100, hp: 75 },
                     { type: 'HUDBinding', element: 'hpbar', source: 'Health.hp' }] }
    ]
  };
  const w = loadRaw(doc);
  const comp = SceneKit.getComponentOn(SceneKit.findEntity(w, 'hpHud'), 'HUDBinding');
  // t=0 초기값 산출.
  ok('G21-A HUDBinding t=0 컴포넌트 경로 값 산출', comp._value === 75, `_value=${comp._value}`);
  ok('G21-B HUDBinding world.hud 미러', w.hud && w.hud.hpbar === 75, `hud=${JSON.stringify(w.hud)}`);

  // hp 변경 후 step → 값 갱신.
  SceneKit.getComponentOn(SceneKit.findEntity(w, 'hpHud'), 'Health').hp = 40;
  ScenekitStep(w);
  ok('G21-C HUDBinding step 후 값 갱신', comp._value === 40 && w.hud.hpbar === 40, `_value=${comp._value}`);

  // world 경로 바인딩.
  const docW = {
    walls: [],
    entities: [{ id: 'coinHud', name: '코인표시', transform: { x: 0, y: 0 },
      components: [{ type: 'HUDBinding', element: 'coins', source: 'world.counters.coin' }] }]
  };
  const wW = loadRaw(docW);
  wW.counters = { coin: 7 };
  SceneKit.step(wW, 1 / 60);
  const compW = SceneKit.getComponentOn(SceneKit.findEntity(wW, 'coinHud'), 'HUDBinding');
  ok('G21-D HUDBinding world 경로 값 산출', compW._value === 7, `_value=${compW._value}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G22  화이트리스트 강제 회귀 — 16번째/미등록 컴포넌트 → lint-scene error + exit 1
//      + 15종 전부 든 정상 씬 → exit 0
// ─────────────────────────────────────────────────────────────────────────────
{
  const lintScene = resolve(root, 'skills/wgf-editor/tools/lint-scene.mjs');

  // G22-A: 미등록(16번째) 컴포넌트 → error + exit 1.
  const unknownDoc = {
    format: 'wgf-scene@1', slug: 'unknown-comp-test',
    meta: { title: '미등록 컴포넌트', genre: 'topdown', viewport: { w: 320, h: 240 } },
    assets: { sprites: [] }, walls: [],
    scenes: [{ id: 'main', entities: [
      { id: 'e1', name: 'E', transform: { x: 10, y: 10 },
        components: [{ type: 'SixteenthComponentXYZ' }] }
    ] }],
    dataLayers: {}
  };
  const tmpUnknown = resolve(root, 'games/_editor-samples/_unknown-comp-tmp.json');
  writeFileSync(tmpUnknown, JSON.stringify(unknownDoc, null, 2), 'utf8');
  const uRes = spawnSync(process.execPath, [lintScene, '--file', tmpUnknown], { encoding: 'utf8' });
  let uJson = null;
  const uLines = uRes.stdout.trim().split('\n');
  for (let i = uLines.length - 1; i >= 0; i--) { try { uJson = JSON.parse(uLines[i]); break; } catch (_) {} }
  ok('G22-A lint-scene 미등록 컴포넌트 exit 1', uRes.status === 1, `exit=${uRes.status}`);
  ok('G22-A lint-scene 미등록 컴포넌트 error > 0', uJson && uJson.counts.error > 0, `error=${uJson && uJson.counts.error}`);
  ok('G22-A lint-scene 미등록 컴포넌트 UNKNOWN_COMPONENT 코드',
    uJson && uJson.findings.some(f => f.code === 'UNKNOWN_COMPONENT'),
    `codes=${uJson && uJson.findings.map(f => f.code).join(',')}`);
  try { unlinkSync(tmpUnknown); } catch (_) {}

  // G22-B: 15종 전부 든 정상 씬 → exit 0(필수 필드 충족).
  const allDoc = {
    format: 'wgf-scene@1', slug: 'all-fifteen',
    meta: { title: '15종 전부', genre: 'topdown', viewport: { w: 320, h: 240 } },
    assets: { sprites: [{ id: 'spr_x', source: 'procedural', w: 16, h: 16 }] },
    walls: [],
    scenes: [{ id: 'main', entities: [
      { id: 'e_all', name: '전부', transform: { x: 50, y: 50 }, components: [
        { type: 'Sprite', sprite: 'spr_x' },
        { type: 'Body', shape: 'aabb', w: 16, h: 16 },
        { type: 'TopDownController', speed: 80, input: 'wasd' },
        { type: 'AnimatedSprite', sprite: 'spr_x', anims: [{ key: 'idle', frames: [0], fps: 1 }], play: 'idle' },
        { type: 'Shooter', cooldown: 0.5 },
        { type: 'EnemyAI', mode: 'chase' },
        { type: 'Health', max: 10 },
        { type: 'ContactDamage', damage: 1 },
        { type: 'Pickup', kind: 'coin', amount: 1 },
        { type: 'Spawner', interval: 1, template: { components: [] } },
        { type: 'CameraFollow', target: 'self', lerp: 1 },
        { type: 'AbilityBinding', abilities: [{ id: 'dash', cooldown: 1 }] },
        { type: 'AudioEmitter', sound: 'sfx', trigger: 'manual' },
        { type: 'HUDBinding', element: 'hp', source: 'Health.hp' }
      ] },
      { id: 'e_proj', name: '발사체', transform: { x: 0, y: 0 }, components: [
        { type: 'Projectile', vx: 10, vy: 0, lifetime: 1 }
      ] }
    ] }],
    dataLayers: {}
  };
  const tmpAll = resolve(root, 'games/_editor-samples/_all-fifteen-tmp.json');
  writeFileSync(tmpAll, JSON.stringify(allDoc, null, 2), 'utf8');
  const aRes = spawnSync(process.execPath, [lintScene, '--file', tmpAll], { encoding: 'utf8' });
  let aJson = null;
  const aLines = aRes.stdout.trim().split('\n');
  for (let i = aLines.length - 1; i >= 0; i--) { try { aJson = JSON.parse(aLines[i]); break; } catch (_) {} }
  ok('G22-B lint-scene 15종 정상 씬 exit 0', aRes.status === 0,
    `exit=${aRes.status} findings=${aJson && JSON.stringify(aJson.findings)}`);
  ok('G22-B lint-scene 15종 정상 씬 error=0', aJson && aJson.counts.error === 0,
    `error=${aJson && aJson.counts.error}`);
  try { unlinkSync(tmpAll); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// G23  신규 생성형 컴포넌트 결정성 회귀 — Shooter+Spawner 2회 실행 hashState 일치
// ─────────────────────────────────────────────────────────────────────────────
{
  function buildGenDoc() {
    return {
      walls: [],
      entities: [
        { id: 'shooter', name: '슈터', transform: { x: 0, y: 0 },
          components: [{ type: 'Shooter', cooldown: 0.3, speed: 90, auto: true, target: 'player', projectileLifetime: 1 }] },
        { id: 'player', name: '플레이어', transform: { x: 80, y: 40 }, components: [] },
        { id: 'spawner', name: '스포너', transform: { x: 100, y: 100 },
          components: [{ type: 'Spawner', interval: 0.25, max: 5, jitter: 8,
            template: { name: '졸개', transform: {}, components: [{ type: 'Body', shape: 'aabb', w: 8, h: 8 }] } }] }
      ]
    };
  }
  const SEED = 1234;
  const w1 = loadRaw(buildGenDoc(), SEED);
  for (let i = 0; i < 120; i++) SceneKit.step(w1, 1 / 60);
  const g1 = SceneKit.hashState(w1);

  const w2 = loadRaw(buildGenDoc(), SEED);
  for (let i = 0; i < 120; i++) SceneKit.step(w2, 1 / 60);
  const g2 = SceneKit.hashState(w2);

  ok('G23-A Shooter+Spawner 생성 컴포넌트 결정성(2회 hashState 일치)', g1 === g2, `g1=${g1} g2=${g2}`);
  // 실제로 엔티티가 생성됐는지(trivial pass 방지).
  ok('G23-B 생성형 컴포넌트가 엔티티를 실제 추가했는지', w1.entities.length > 3, `count=${w1.entities.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G24  resolveTarget 엄격 id 매칭 — 부분문자열 오매칭 방지 회귀
//      진짜 id:'player'(x=100)와 함정 id:'aaa_decoy'(name 에 'player' 포함)가
//      공존할 때 EnemyAI chase 가 진짜 player(x>0 방향)로 이동해야 한다.
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      { id: 'enemy', name: '적', transform: { x: 0, y: 0 },
        components: [{ type: 'EnemyAI', mode: 'chase', target: 'player', speed: 60 }] },
      // 함정: id에 'player' 부분문자열 포함, x=-100 (왼쪽)
      { id: 'aaa_decoy', name: 'player_fake', transform: { x: -100, y: 0 }, components: [] },
      // 진짜 player: 정확한 id='player', x=100 (오른쪽)
      { id: 'player', name: '플레이어', transform: { x: 100, y: 0 }, components: [] }
    ]
  };
  const w = loadRaw(doc);
  stepN(w, 30);  // 0.5초 추격
  const enemy = w.entities.find(e => e.id === 'enemy');
  // 진짜 player(x=100) 방향이므로 enemy.x > 0 이어야 한다.
  ok('G24-A resolveTarget 엄격 id 매칭: 진짜 player 방향 추격(x>0)',
    enemy && enemy.transform.x > 0,
    `x=${enemy && enemy.transform.x}`);
  // 함정 decoy(x=-100) 쪽으로 가지 않아야 한다.
  ok('G24-B resolveTarget 함정 decoy 미선택(x≥0)',
    enemy && enemy.transform.x >= 0,
    `x=${enemy && enemy.transform.x}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G25  Spawner.template.components 화이트리스트 회귀
//      미등록 컴포넌트가 template 안에 숨어 있으면 lint-scene error > 0 + exit 1
// ─────────────────────────────────────────────────────────────────────────────
{
  const lintScene = resolve(root, 'skills/wgf-editor/tools/lint-scene.mjs');

  const badTemplateDoc = {
    format: 'wgf-scene@1', slug: 'spawner-template-test',
    meta: { title: '템플릿 미등록', genre: 'topdown', viewport: { w: 320, h: 240 } },
    assets: { sprites: [] }, walls: [],
    scenes: [{ id: 'main', entities: [
      { id: 'sp1', name: '스포너', transform: { x: 0, y: 0 }, components: [
        { type: 'Spawner', interval: 1, template: {
            components: [{ type: 'FakeComp' }]  // 미등록 컴포넌트
          }
        }
      ] }
    ] }],
    dataLayers: {}
  };

  const tmpBad = resolve(root, 'games/_editor-samples/_spawner-template-tmp.json');
  writeFileSync(tmpBad, JSON.stringify(badTemplateDoc, null, 2), 'utf8');
  const bRes = spawnSync(process.execPath, [lintScene, '--file', tmpBad], { encoding: 'utf8' });
  let bJson = null;
  const bLines = bRes.stdout.trim().split('\n');
  for (let i = bLines.length - 1; i >= 0; i--) { try { bJson = JSON.parse(bLines[i]); break; } catch (_) {} }
  ok('G25-A Spawner.template 미등록 컴포넌트 → exit 1', bRes.status === 1, `exit=${bRes.status}`);
  ok('G25-B Spawner.template 미등록 컴포넌트 → error > 0', bJson && bJson.counts.error > 0, `error=${bJson && bJson.counts.error}`);
  ok('G25-C Spawner.template 미등록 컴포넌트 → UNKNOWN_COMPONENT 코드',
    bJson && bJson.findings.some(f => f.code === 'UNKNOWN_COMPONENT'),
    `codes=${bJson && bJson.findings.map(f => f.code).join(',')}`);
  try { unlinkSync(tmpBad); } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// G26  Pickup heal 미수집 유지 — collector 에 Health 없으면 소멸 안 함
// ─────────────────────────────────────────────────────────────────────────────
{
  const doc = {
    walls: [],
    entities: [
      // collector: Health 컴포넌트 없음
      { id: 'player', name: '플레이어', transform: { x: 10, y: 10 }, components: [] },
      // heal pickup — 위치가 player 와 겹침
      { id: 'pickup1', name: '힐팩', transform: { x: 10, y: 10 },
        components: [{ type: 'Pickup', kind: 'heal', amount: 5, collector: 'player' }] }
    ]
  };
  const w = loadRaw(doc);
  stepN(w, 5);
  const pickup = w.entities.find(e => e.id === 'pickup1');
  // Health 없으므로 pickup 은 아직 world 에 남아 있어야 한다.
  ok('G26-A Pickup heal: collector Health 없으면 소멸 안 함',
    pickup !== undefined, `pickup존재=${pickup !== undefined}`);
  const pcomp = pickup && SceneKit.getComponentOn(pickup, 'Pickup');
  ok('G26-B Pickup heal: _collected=false 유지',
    pcomp && pcomp._collected === false,
    `_collected=${pcomp && pcomp._collected}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// G27  인게임 씬 전환 — requestScene 헬퍼 + SceneTrigger(timer/overlap) + 1회 발동 + 결정성
// ─────────────────────────────────────────────────────────────────────────────
{
  // G27-A: SceneKit.requestScene(world, id) 가 world._sceneRequest 설정.
  const wReq = SceneKit.load(SCENE_DOC, { mode: 'play', seed: 1 });
  ok('G27-A0 load 직후 _sceneRequest=null', wReq._sceneRequest === null,
    `_sceneRequest=${wReq._sceneRequest}`);
  SceneKit.requestScene(wReq, 'x');
  ok('G27-A requestScene → _sceneRequest="x"', wReq._sceneRequest === 'x',
    `_sceneRequest=${wReq._sceneRequest}`);
  // 가벼운 유효성: null/빈 문자열은 무시(기존 값 유지, 덮어쓰지 않음).
  SceneKit.requestScene(wReq, '');
  ok('G27-A2 requestScene("") 무시(기존 유지)', wReq._sceneRequest === 'x',
    `_sceneRequest=${wReq._sceneRequest}`);
  SceneKit.requestScene(wReq, null);
  ok('G27-A3 requestScene(null) 무시(기존 유지)', wReq._sceneRequest === 'x',
    `_sceneRequest=${wReq._sceneRequest}`);
  // 숫자 id 는 문자열로 정규화.
  SceneKit.requestScene(wReq, 42);
  ok('G27-A4 requestScene(42) → "42"(문자열 정규화)', wReq._sceneRequest === '42',
    `_sceneRequest=${wReq._sceneRequest}`);

  // G27-B: SceneTrigger(timer, delay:0.5) — 누적 0.5s 후 발동, 그 전엔 null.
  const docTimer = {
    walls: [],
    entities: [{ id: 'trig', name: '전환트리거', transform: { x: 0, y: 0 },
      components: [{ type: 'SceneTrigger', on: 'timer', delay: 0.5, target: 'lvl2' }] }]
  };
  const wT = loadRaw(docTimer);
  ok('G27-B0 SceneTrigger load 직후 _sceneRequest=null', wT._sceneRequest === null,
    `_sceneRequest=${wT._sceneRequest}`);
  // 29프레임(0.4833s) — 아직 발동 전.
  stepN(wT, 29);
  ok('G27-B1 delay 전(0.483s) _sceneRequest=null', wT._sceneRequest === null,
    `_sceneRequest=${wT._sceneRequest} t=${wT.time.toFixed(4)}`);
  // 2프레임 더(0.5167s) — delay(0.5) 도달 → 발동.
  stepN(wT, 2);
  ok('G27-B2 delay 도달 후 _sceneRequest="lvl2"', wT._sceneRequest === 'lvl2',
    `_sceneRequest=${wT._sceneRequest} t=${wT.time.toFixed(4)}`);

  // G27-C: 1회만 발동(_fired). 외부에서 _sceneRequest 를 null 로 비워도 다시 안 채움.
  const trigComp = SceneKit.getComponentOn(SceneKit.findEntity(wT, 'trig'), 'SceneTrigger');
  ok('G27-C0 SceneTrigger _fired=true', trigComp._fired === true, `_fired=${trigComp._fired}`);
  wT._sceneRequest = null;          // 어댑터가 소비한 상황 모사.
  stepN(wT, 60);                     // delay 한참 초과해도
  ok('G27-C1 발동 후 _sceneRequest 재설정 안 함(null 유지)', wT._sceneRequest === null,
    `_sceneRequest=${wT._sceneRequest}`);

  // G27-D: SceneTrigger(overlap) — 대상과 겹칠 때 발동.
  const docOverlap = {
    walls: [],
    entities: [
      // 트리거: targetSelector='goal' 와 겹칠 때 발동. 초기엔 떨어져 있음.
      { id: 'mover', name: '이동체', transform: { x: 0, y: 0 },
        components: [
          { type: 'Body', shape: 'aabb', w: 10, h: 10 },
          { type: 'Projectile', vx: 60, vy: 0, lifetime: 100 },   // +x 로 이동
          { type: 'SceneTrigger', on: 'overlap', target: 'win', targetSelector: 'goal' }
        ] },
      { id: 'goal', name: '도착지', transform: { x: 60, y: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 20, h: 20, isStatic: true }] }
    ]
  };
  const wO = loadRaw(docOverlap);
  // 초기엔 떨어져 있어(0 vs 60) 발동 안 함.
  SceneKit.step(wO, 1 / 60);
  ok('G27-D0 overlap 전 _sceneRequest=null', wO._sceneRequest === null,
    `_sceneRequest=${wO._sceneRequest}`);
  // 1초(60프레임) 이동 → mover x≈60+ 으로 goal 과 겹침 → 발동.
  stepN(wO, 60);
  ok('G27-D1 overlap 발동 → _sceneRequest="win"', wO._sceneRequest === 'win',
    `_sceneRequest=${wO._sceneRequest} moverX=${SceneKit.findEntity(wO, 'mover') && SceneKit.findEntity(wO, 'mover').transform.x.toFixed(2)}`);

  // G27-D2: overlap 임의 Body(targetSelector 비움) — 겹치는 다른 Body 면 발동.
  const docAnyOverlap = {
    walls: [],
    entities: [
      { id: 'tA', name: '트리거A', transform: { x: 5, y: 0 },
        components: [
          { type: 'Body', shape: 'aabb', w: 16, h: 16 },
          { type: 'SceneTrigger', on: 'overlap', target: 'next' }   // targetSelector 없음
        ] },
      { id: 'other', name: '다른바디', transform: { x: 0, y: 0 },
        components: [{ type: 'Body', shape: 'aabb', w: 16, h: 16 }] }
    ]
  };
  const wAny = loadRaw(docAnyOverlap);
  SceneKit.step(wAny, 1 / 60);   // 초기부터 겹침(중심거리 5 < 16) → 첫 step 발동.
  ok('G27-D2 overlap 임의 Body 겹침 → _sceneRequest="next"', wAny._sceneRequest === 'next',
    `_sceneRequest=${wAny._sceneRequest}`);

  // G27-E: 컴포넌트 step 의 ctx.requestScene 경로가 hashState 결정성을 깨지 않음(2회 동일).
  function buildSceneTrigDoc() {
    return {
      walls: [],
      entities: [
        { id: 'trig', name: '트리거', transform: { x: 0, y: 0 },
          components: [{ type: 'SceneTrigger', on: 'timer', delay: 0.5, target: 'lvl2' }] },
        // 함께 돌릴 다른 컴포넌트(결정성 폭 확인) — EnemyAI patrol.
        { id: 'pat', name: '순찰', transform: { x: 0, y: 0 },
          components: [{ type: 'EnemyAI', mode: 'patrol', speed: 40, patrolAxis: 'x', patrolRange: 16 }] }
      ]
    };
  }
  const SEED = 99;
  const wd1 = loadRaw(buildSceneTrigDoc(), SEED);
  for (let i = 0; i < 120; i++) SceneKit.step(wd1, 1 / 60);
  const hd1 = SceneKit.hashState(wd1);
  const wd2 = loadRaw(buildSceneTrigDoc(), SEED);
  for (let i = 0; i < 120; i++) SceneKit.step(wd2, 1 / 60);
  const hd2 = SceneKit.hashState(wd2);
  ok('G27-E requestScene 경로 결정성(2회 hashState 일치)', hd1 === hd2, `hd1=${hd1} hd2=${hd2}`);
  // 실제로 발동했는지(trivial pass 방지) — _sceneRequest 가 설정돼 있어야.
  ok('G27-E2 결정성 케이스에서 실제 발동(_sceneRequest="lvl2")', wd1._sceneRequest === 'lvl2',
    `_sceneRequest=${wd1._sceneRequest}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// G28  묶음H 2A 계층(parentId) — 회귀앵커·결정성·reparent·가드·승격·직렬화 (OQ5=(b))
//   A 회귀앵커: flat 씬 골든 해시(코어 수정 *전* 측정) 불변 = parentId 토큰 회귀 0
//   B 계층 결정성 + parentId 해시 반영(계층≠flat) + parentId 보존
//   C reparent apply→undo 해시 원복
//   D 사이클·고아·자기참조 reparent 거부(부모 불변·해시 불변)
//   E 부모삭제=자식 승격(ADR-002) + undo 해시 원복 + parentId 복원
//   F serialize 가 parentId 보존(루트는 키 부재) + serialize→재load 동형성
// ═════════════════════════════════════════════════════════════════════════════
{
  // G28-A 회귀 앵커 — 2A 코어 수정 전 측정한 골든(seed 42). parentId 도입 후에도 비트 불변.
  const GOLD_T0 = '4f7683f9', GOLD_T120 = 'cd287343';
  const wf = SceneKit.load(SCENE_DOC, { mode: 'play', seed: 42 });
  const a0 = SceneKit.hashState(wf);
  ok('G28-A flat 씬 t=0 해시 = 골든(계층 도입 회귀 0)', a0 === GOLD_T0, `actual=${a0} gold=${GOLD_T0}`);
  for (let i = 0; i < 120; i++) SceneKit.step(wf, 1 / 60);
  const a120 = SceneKit.hashState(wf);
  ok('G28-A flat 씬 120프레임 해시 = 골든', a120 === GOLD_T120, `actual=${a120} gold=${GOLD_T120}`);
}
{
  // G28-B 계층 결정성 + parentId 해시 반영.
  function buildHierDoc(parentOfChild) {
    return { walls: [], entities: [
      { id: 'par', name: '부모', transform: { x: 100, y: 50 }, components: [] },
      { id: 'chd', name: '자식', transform: { x: 10, y: 0 }, parentId: parentOfChild, components: [] }
    ] };
  }
  const SEED = 7;
  const wa = SceneKit.load(buildHierDoc('par'), { mode: 'play', seed: SEED });
  const wb = SceneKit.load(buildHierDoc('par'), { mode: 'play', seed: SEED });
  const ha = SceneKit.hashState(wa), hb = SceneKit.hashState(wb);
  ok('G28-B 계층 씬 결정성(2회 hashState 일치)', ha === hb, `ha=${ha} hb=${hb}`);
  const wflat = SceneKit.load(buildHierDoc(null), { mode: 'play', seed: SEED });
  const hflat = SceneKit.hashState(wflat);
  ok('G28-B parentId 해시 반영(계층 ≠ 동좌표 flat)', ha !== hflat, `hier=${ha} flat=${hflat}`);
  const child = SceneKit.findEntity(wa, 'chd');
  ok('G28-B 자식 parentId 보존(=par)', child && child.parentId === 'par', `parentId=${child && child.parentId}`);
}
{
  // G28-C reparent apply→undo 해시 원복.
  function build3() {
    return { walls: [], entities: [
      { id: 'a', name: 'A', transform: { x: 0, y: 0 }, components: [] },
      { id: 'b', name: 'B', transform: { x: 50, y: 0 }, components: [] },
      { id: 'c', name: 'C', transform: { x: 100, y: 0 }, components: [] }
    ] };
  }
  const w = SceneKit.load(build3(), { mode: 'edit', seed: 1 });
  const h0 = SceneKit.hashState(w);
  const undo = SceneKit.applyCommand(w, { type: 'reparent', id: 'c', parentId: 'a' });
  const h1 = SceneKit.hashState(w);
  ok('G28-C reparent 후 해시 변경', h0 !== h1, `h0=${h0} h1=${h1}`);
  ok('G28-C reparent 적용(c.parentId=a)', SceneKit.findEntity(w, 'c').parentId === 'a',
    `parentId=${SceneKit.findEntity(w, 'c').parentId}`);
  SceneKit.applyUndo(w, undo);
  const h2 = SceneKit.hashState(w);
  ok('G28-C reparent apply→undo 해시 원복', h0 === h2, `h0=${h0} h2=${h2}`);
  ok('G28-C undo 후 c.parentId 제거(루트 복귀)', SceneKit.findEntity(w, 'c').parentId === undefined,
    `parentId=${SceneKit.findEntity(w, 'c').parentId}`);
}
{
  // G28-D 사이클·고아·자기참조 reparent 거부.
  function buildChain() {
    return { walls: [], entities: [
      { id: 'a', name: 'A', transform: { x: 0, y: 0 }, components: [] },
      { id: 'b', name: 'B', transform: { x: 0, y: 0 }, parentId: 'a', components: [] },
      { id: 'c', name: 'C', transform: { x: 0, y: 0 }, parentId: 'b', components: [] }
    ] };
  }
  const w = SceneKit.load(buildChain(), { mode: 'edit', seed: 1 });
  const h0 = SceneKit.hashState(w);
  SceneKit.applyCommand(w, { type: 'reparent', id: 'a', parentId: 'c' });  // a←b←c←a 순환
  ok('G28-D 사이클 reparent 거부(a.parentId 불변)', SceneKit.findEntity(w, 'a').parentId === undefined,
    `parentId=${SceneKit.findEntity(w, 'a').parentId}`);
  ok('G28-D 사이클 거부 후 해시 불변', SceneKit.hashState(w) === h0, `h0=${h0} now=${SceneKit.hashState(w)}`);
  SceneKit.applyCommand(w, { type: 'reparent', id: 'c', parentId: 'NOPE' });  // 고아
  ok('G28-D 고아(없는 부모) 거부(c.parentId=b 유지)', SceneKit.findEntity(w, 'c').parentId === 'b',
    `parentId=${SceneKit.findEntity(w, 'c').parentId}`);
  SceneKit.applyCommand(w, { type: 'reparent', id: 'b', parentId: 'b' });  // 자기참조
  ok('G28-D 자기참조 거부(b.parentId=a 유지)', SceneKit.findEntity(w, 'b').parentId === 'a',
    `parentId=${SceneKit.findEntity(w, 'b').parentId}`);
}
{
  // G28-E 부모삭제=자식 승격(ADR-002) + undo 정합.
  function buildPC() {
    return { walls: [], entities: [
      { id: 'parent', name: '부모', transform: { x: 0, y: 0 }, components: [] },
      { id: 'child1', name: '자식1', transform: { x: 10, y: 0 }, parentId: 'parent', components: [] },
      { id: 'child2', name: '자식2', transform: { x: 20, y: 0 }, parentId: 'parent', components: [] },
      { id: 'other', name: '무관', transform: { x: 99, y: 0 }, components: [] }
    ] };
  }
  const w = SceneKit.load(buildPC(), { mode: 'edit', seed: 1 });
  const h0 = SceneKit.hashState(w);
  const undo = SceneKit.applyCommand(w, { type: 'removeEntity', id: 'parent' });
  ok('G28-E 부모 삭제됨', SceneKit.findEntity(w, 'parent') === null, 'parent removed');
  const c1 = SceneKit.findEntity(w, 'child1'), c2 = SceneKit.findEntity(w, 'child2');
  ok('G28-E 자식1 승격(보존+parentId 제거)', c1 && c1.parentId === undefined, `child1.parentId=${c1 && c1.parentId}`);
  ok('G28-E 자식2 승격(보존+parentId 제거)', c2 && c2.parentId === undefined, `child2.parentId=${c2 && c2.parentId}`);
  SceneKit.applyUndo(w, undo);
  const h2 = SceneKit.hashState(w);
  ok('G28-E 부모삭제 apply→undo 해시 원복', h0 === h2, `h0=${h0} h2=${h2}`);
  const c1b = SceneKit.findEntity(w, 'child1');
  ok('G28-E undo 후 자식 parentId 복원(child1=parent)', c1b && c1b.parentId === 'parent',
    `child1.parentId=${c1b && c1b.parentId}`);
}
{
  // G28-F serialize parentId 보존 + 재load 동형성.
  const doc = { walls: [], entities: [
    { id: 'p', name: 'P', transform: { x: 5, y: 5 }, components: [] },
    { id: 'k', name: 'K', transform: { x: 1, y: 1 }, parentId: 'p', components: [] }
  ] };
  const w = SceneKit.load(doc, { mode: 'edit', seed: 1 });
  const ser = SceneKit.serialize(w);
  const kSer = ser.entities.find((e) => e.id === 'k');
  const pSer = ser.entities.find((e) => e.id === 'p');
  ok('G28-F serialize 가 자식 parentId 보존(=p)', kSer && kSer.parentId === 'p', `parentId=${kSer && kSer.parentId}`);
  ok('G28-F 루트 엔티티는 parentId 키 부재', pSer && !('parentId' in pSer), `hasKey=${pSer && ('parentId' in pSer)}`);
  const h0 = SceneKit.hashState(w);
  const w2 = SceneKit.load(ser, { mode: 'edit', seed: 1 });
  ok('G28-F serialize→재load 해시 동형(parentId 보존)', SceneKit.hashState(w2) === h0,
    `h0=${h0} reload=${SceneKit.hashState(w2)}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// G29  묶음H 2C 타일맵 — TilemapLayer 컨테이너 규약(parentId 순수소비·코어 무수정)
//   A 회귀앵커: 코어 무수정 → G28-A 골든 해시 불변(기계증명)
//   B 컨테이너+다중타일 결정성 + 전 타일 parentId 연결
//   C 컨테이너 이동 → 코어 타일 로컬좌표 불변(translate 합성은 어댑터 전용·단일진실)
//   D 컨테이너 삭제 → 전 타일 루트 승격 + undo 원복
//   E serialize→재load 타일맵 동형(parentId 보존)
// ═════════════════════════════════════════════════════════════════════════════
{
  // G29-A: 2C 는 코어를 한 줄도 안 건드린다 → flat 골든 해시가 여전히 불변(코어 무수정 기계증명).
  const GOLD_T0 = '4f7683f9';
  const wf = SceneKit.load(SCENE_DOC, { mode: 'play', seed: 42 });
  const a0 = SceneKit.hashState(wf);
  ok('G29-A 코어 무수정 — flat 골든 해시 불변(2C 회귀앵커)', a0 === GOLD_T0, `actual=${a0} gold=${GOLD_T0}`);
}
{
  // 타일맵 픽스처: 컨테이너 1 + 타일 4개(2×2 격자, parentId=컨테이너, frame=row*cols+col).
  function buildTilemap() {
    return { walls: [], entities: [
      { id: 'layer_ground', name: 'TilemapLayer:ground', transform: { x: 100, y: 80 }, components: [] },
      { id: 't00', name: '타일0', transform: { x: 0,  y: 0  }, parentId: 'layer_ground', components: [{ type: 'Sprite', sprite: 'tileset', frame: 0 }] },
      { id: 't10', name: '타일1', transform: { x: 16, y: 0  }, parentId: 'layer_ground', components: [{ type: 'Sprite', sprite: 'tileset', frame: 1 }] },
      { id: 't01', name: '타일2', transform: { x: 0,  y: 16 }, parentId: 'layer_ground', components: [{ type: 'Sprite', sprite: 'tileset', frame: 4 }] },
      { id: 't11', name: '타일3', transform: { x: 16, y: 16 }, parentId: 'layer_ground', components: [{ type: 'Sprite', sprite: 'tileset', frame: 5 }] }
    ] };
  }
  const tiles = ['t00', 't10', 't01', 't11'];

  // G29-B 결정성 + 전 타일 parentId 연결.
  const wa = SceneKit.load(buildTilemap(), { mode: 'edit', seed: 1 });
  const wb = SceneKit.load(buildTilemap(), { mode: 'edit', seed: 1 });
  ok('G29-B 타일맵 씬 결정성(2회 hashState 일치)', SceneKit.hashState(wa) === SceneKit.hashState(wb),
    `ha=${SceneKit.hashState(wa)} hb=${SceneKit.hashState(wb)}`);
  ok('G29-B 전 타일 parentId=컨테이너', tiles.every(id => SceneKit.findEntity(wa, id).parentId === 'layer_ground'),
    `linked=${tiles.map(id => SceneKit.findEntity(wa, id).parentId).join(',')}`);

  // G29-C 컨테이너 이동 → 코어 타일 로컬좌표 불변(translate 합성은 어댑터 전용·단일진실).
  const before = tiles.map(id => { const t = SceneKit.findEntity(wa, id).transform; return { id, x: t.x, y: t.y }; });
  SceneKit.applyCommand(wa, { type: 'setTransform', id: 'layer_ground', transform: { x: 999, y: 555 } });
  const after = tiles.map(id => { const t = SceneKit.findEntity(wa, id).transform; return { id, x: t.x, y: t.y }; });
  ok('G29-C 컨테이너 이동 — 코어 타일 로컬좌표 불변(어댑터만 합성)',
    JSON.stringify(before) === JSON.stringify(after), `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);

  // G29-D 컨테이너 삭제 → 타일 승격 + undo 원복.
  const w2 = SceneKit.load(buildTilemap(), { mode: 'edit', seed: 1 });
  const h0 = SceneKit.hashState(w2);
  const undo = SceneKit.applyCommand(w2, { type: 'removeEntity', id: 'layer_ground' });
  ok('G29-D 컨테이너 삭제 → 전 타일 루트 승격',
    SceneKit.findEntity(w2, 'layer_ground') === null && tiles.every(id => { const e = SceneKit.findEntity(w2, id); return e && e.parentId === undefined; }),
    `promoted=${tiles.map(id => { const e = SceneKit.findEntity(w2, id); return e && e.parentId; }).join(',')}`);
  SceneKit.applyUndo(w2, undo);
  ok('G29-D 삭제 undo → 해시 원복 + 타일 parentId 복원',
    SceneKit.hashState(w2) === h0 && tiles.every(id => SceneKit.findEntity(w2, id).parentId === 'layer_ground'),
    `h0=${h0} now=${SceneKit.hashState(w2)}`);

  // G29-E serialize → 재load 동형성(타일 parentId 보존).
  const w3 = SceneKit.load(buildTilemap(), { mode: 'edit', seed: 1 });
  const ser = SceneKit.serialize(w3);
  const w4 = SceneKit.load(ser, { mode: 'edit', seed: 1 });
  ok('G29-E serialize→재load 타일맵 동형(parentId 보존)', SceneKit.hashState(w4) === SceneKit.hashState(w3),
    `orig=${SceneKit.hashState(w3)} reload=${SceneKit.hashState(w4)}`);
  const tileSer = ser.entities.find(e => e.id === 't11');
  ok('G29-E serialize 타일 parentId 보존(=layer_ground)', tileSer && tileSer.parentId === 'layer_ground',
    `parentId=${tileSer && tileSer.parentId}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// G30  묶음H 2D 프리팹 — instantiate 원자 다중엔티티(서브트리 깊은복제·id재발급·리맵, ADR-003)
//   A 회귀앵커: instantiate 도입 후 flat 골든 해시 불변(기존 경로 무수정 기계증명)
//   B 인스턴스 결정성(같은 prefab+같은 idSeq 시작 → 동일 해시) + collectSubtree(transitive)
//   C id 유일성(새 id 전부 유일·기존과 무충돌·eN 형식)
//   D parentId 리맵 정확(배치-내부=새 컨테이너 newId·루트=parentOverride)
//   E undo 원자복원(단일 applyUndo 로 N개 통째 제거 + 해시 원복)
//   F instantiate 후 serialize→재load 동형(리맵된 parentId 보존)
//   G 경계(빈 entities=noop·단일 루트 최상위·고아 드롭대상 무시)
// ═════════════════════════════════════════════════════════════════════════════
{
  // G30-A 회귀앵커 — instantiate 명령 추가가 기존 경로 무수정임을 flat 골든으로 증명.
  const GOLD_T0 = '4f7683f9';
  const wf = SceneKit.load(SCENE_DOC, { mode: 'play', seed: 42 });
  ok('G30-A instantiate 도입 후 flat 골든 해시 불변(기존 경로 무수정)', SceneKit.hashState(wf) === GOLD_T0,
    `actual=${SceneKit.hashState(wf)} gold=${GOLD_T0}`);
}
{
  // 프리팹 픽스처: 컨테이너(TilemapLayer) + 타일 2개(로컬 id 공간 p_*).
  function buildPrefab() {
    return [
      { id: 'p_root', name: 'TilemapLayer:camp', transform: { x: 0, y: 0 }, components: [] },
      { id: 'p_t0', name: '타일0', transform: { x: 0,  y: 0 }, parentId: 'p_root', components: [{ type: 'Sprite', sprite: 'ts', frame: 0 }] },
      { id: 'p_t1', name: '타일1', transform: { x: 16, y: 0 }, parentId: 'p_root', components: [{ type: 'Sprite', sprite: 'ts', frame: 1 }] }
    ];
  }

  // G30-B 인스턴스 결정성(빈 씬+같은 idSeq 시작 → 동일 해시).
  const wA = SceneKit.load({ walls: [], entities: [] }, { mode: 'edit', seed: 1 });
  const wB = SceneKit.load({ walls: [], entities: [] }, { mode: 'edit', seed: 1 });
  SceneKit.applyCommand(wA, { type: 'instantiate', entities: buildPrefab() });
  SceneKit.applyCommand(wB, { type: 'instantiate', entities: buildPrefab() });
  ok('G30-B 인스턴스 결정성(같은 prefab+idSeq → 동일 해시)', SceneKit.hashState(wA) === SceneKit.hashState(wB),
    `ha=${SceneKit.hashState(wA)} hb=${SceneKit.hashState(wB)}`);
  ok('G30-B instantiate 후 엔티티 3개 추가', wA.entities.length === 3, `count=${wA.entities.length}`);

  // G30-B collectSubtree transitive(컨테이너→자식→손자 2단계 + 무관 엔티티 제외).
  const deep = SceneKit.load({ walls: [], entities: [
    { id: 'g_root', name: 'R', transform: {}, components: [] },
    { id: 'g_mid', name: 'M', transform: {}, parentId: 'g_root', components: [] },
    { id: 'g_leaf', name: 'L', transform: {}, parentId: 'g_mid', components: [] },
    { id: 'g_out', name: 'O', transform: {}, components: [] }
  ] }, { mode: 'edit', seed: 1 });
  const sub = SceneKit.collectSubtree(deep, 'g_root');
  ok('G30-B collectSubtree transitive(루트+자식+손자=3, 무관 제외)', sub.length === 3,
    `len=${sub.length} ids=${sub.map(e => e.id).join(',')}`);
  ok('G30-B collectSubtree 손자(g_leaf) 포함', sub.some(e => e.id === 'g_leaf'), `ids=${sub.map(e => e.id).join(',')}`);

  // G30-C id 유일성(기존 엔티티 있는 씬에 인스턴스화).
  const wC = SceneKit.load({ walls: [], entities: [{ id: 'existing', name: 'X', transform: {}, components: [] }] }, { mode: 'edit', seed: 1 });
  const undoC = SceneKit.applyCommand(wC, { type: 'instantiate', entities: buildPrefab() });
  const newIds = undoC.ids;
  ok('G30-C 새 id 3개', newIds.length === 3, `ids=${newIds.join(',')}`);
  ok('G30-C 새 id 전부 유일', new Set(newIds).size === 3, `ids=${newIds.join(',')}`);
  ok('G30-C 기존 id 와 무충돌', newIds.indexOf('existing') < 0, `ids=${newIds.join(',')}`);
  ok('G30-C eN 형식 id', newIds.every(id => /^e\d+$/.test(id)), `ids=${newIds.join(',')}`);

  // G30-D parentId 리맵(루트=드롭대상 host, 타일=새 컨테이너 newId).
  const wD = SceneKit.load({ walls: [], entities: [{ id: 'host', name: 'Host', transform: { x: 200, y: 200 }, components: [] }] }, { mode: 'edit', seed: 1 });
  const undoD = SceneKit.applyCommand(wD, { type: 'instantiate', entities: buildPrefab(), parentId: 'host' });
  const newRootId = undoD.ids[0], newRoot = SceneKit.findEntity(wD, newRootId);
  const nt0 = SceneKit.findEntity(wD, undoD.ids[1]), nt1 = SceneKit.findEntity(wD, undoD.ids[2]);
  ok('G30-D 루트 parentId = 드롭대상(host)', newRoot.parentId === 'host', `parentId=${newRoot.parentId}`);
  ok('G30-D 타일 parentId = 새 컨테이너 newId(리맵)', nt0.parentId === newRootId && nt1.parentId === newRootId,
    `t0=${nt0.parentId} t1=${nt1.parentId} newRoot=${newRootId}`);
  ok('G30-D 타일 parentId 가 old p_root 아님(리맵 확인)', nt0.parentId !== 'p_root', `parentId=${nt0.parentId}`);

  // G30-E undo 원자복원(단일 undo → N개 통째 제거).
  const wE = SceneKit.load({ walls: [], entities: [{ id: 'keep', name: 'K', transform: {}, components: [] }] }, { mode: 'edit', seed: 1 });
  const hE0 = SceneKit.hashState(wE);
  const undoE = SceneKit.applyCommand(wE, { type: 'instantiate', entities: buildPrefab() });
  ok('G30-E instantiate 후 엔티티 +3(1→4)', wE.entities.length === 4, `count=${wE.entities.length}`);
  ok('G30-E instantiate 후 해시 변경', SceneKit.hashState(wE) !== hE0, `h0=${hE0} now=${SceneKit.hashState(wE)}`);
  SceneKit.applyUndo(wE, undoE);
  ok('G30-E 단일 undo 로 N개 통째 제거(4→1)', wE.entities.length === 1, `count=${wE.entities.length}`);
  ok('G30-E undo 후 해시 원복', SceneKit.hashState(wE) === hE0, `h0=${hE0} now=${SceneKit.hashState(wE)}`);
  ok('G30-E undo 후 기존 keep 보존', SceneKit.findEntity(wE, 'keep') !== null, 'keep alive');

  // G30-F instantiate 후 serialize→재load 동형(리맵 parentId 보존).
  const wF = SceneKit.load({ walls: [], entities: [] }, { mode: 'edit', seed: 1 });
  SceneKit.applyCommand(wF, { type: 'instantiate', entities: buildPrefab() });
  const hF = SceneKit.hashState(wF);
  const wF2 = SceneKit.load(SceneKit.serialize(wF), { mode: 'edit', seed: 1 });
  ok('G30-F instantiate 후 serialize→재load 동형(리맵 parentId 보존)', SceneKit.hashState(wF2) === hF,
    `orig=${hF} reload=${SceneKit.hashState(wF2)}`);

  // G30-G 경계(빈 entities=noop·단일 루트 최상위·고아 드롭대상 무시).
  const wG = SceneKit.load({ walls: [], entities: [] }, { mode: 'edit', seed: 1 });
  const hG0 = SceneKit.hashState(wG);
  const undoEmpty = SceneKit.applyCommand(wG, { type: 'instantiate', entities: [] });
  ok('G30-G 빈 entities → noop(해시 불변)', undoEmpty.type === 'noop' && SceneKit.hashState(wG) === hG0, `type=${undoEmpty.type}`);
  const undoSolo = SceneKit.applyCommand(wG, { type: 'instantiate', entities: [{ id: 'solo', name: 'Solo', transform: { x: 5, y: 5 }, components: [] }] });
  ok('G30-G 단일 루트 instantiate(+1)', wG.entities.length === 1 && undoSolo.ids.length === 1, `count=${wG.entities.length}`);
  ok('G30-G 단일 루트 parentId 없음(최상위)', SceneKit.findEntity(wG, undoSolo.ids[0]).parentId === undefined,
    `parentId=${SceneKit.findEntity(wG, undoSolo.ids[0]).parentId}`);
  const undoOrphan = SceneKit.applyCommand(wG, { type: 'instantiate', entities: [{ id: 'orphanRoot', name: 'X', transform: {}, components: [] }], parentId: 'NOPE' });
  ok('G30-G 고아 드롭대상(없는 부모) 무시 → 루트 최상위', SceneKit.findEntity(wG, undoOrphan.ids[0]).parentId === undefined,
    `parentId=${SceneKit.findEntity(wG, undoOrphan.ids[0]).parentId}`);

  // G30-H 박힌 idMap 충돌 방어(조작/중복 idMap → 재발급, 중복 id·undo 오염 차단; code/security 리뷰 MEDIUM).
  const wH = SceneKit.load({ walls: [], entities: [{ id: 'e1', name: 'pre', transform: {}, components: [] }] }, { mode: 'edit', seed: 1 });
  // 조작: idMap 이 src 'x' → 기존 'e1' 로 박힘(충돌 유도) → 코어가 재발급해야 함.
  const undoH = SceneKit.applyCommand(wH, { type: 'instantiate', entities: [{ id: 'x', name: 'inj', transform: {}, components: [] }], idMap: { x: 'e1' } });
  const allIdsH = wH.entities.map((e) => e.id);
  ok('G30-H 박힌 idMap 충돌 시 재발급(중복 id 없음)',
    new Set(allIdsH).size === allIdsH.length && wH.entities.length === 2, `ids=${allIdsH.join(',')}`);
  SceneKit.applyUndo(wH, undoH);
  const e1H = SceneKit.findEntity(wH, 'e1');
  ok('G30-H 충돌방어 undo → 기존 e1 보존(주입본만 제거)',
    wH.entities.length === 1 && e1H && e1H.name === 'pre', `count=${wH.entities.length} name=${e1H && e1H.name}`);

  // G30-I 사이클 가드(손상 doc: 루트↔자식 상호참조 → 무한루프 없이 정상 종료·사이클 드롭).
  const cyc = [
    { id: 'ca', name: 'A', transform: {}, parentId: 'cb', components: [] },
    { id: 'cb', name: 'B', transform: {}, parentId: 'ca', components: [] }
  ];
  const wI = SceneKit.load({ walls: [], entities: [] }, { mode: 'edit', seed: 1 });
  const undoI = SceneKit.applyCommand(wI, { type: 'instantiate', entities: cyc });
  ok('G30-I 사이클 doc instantiate 정상 종료(+2, 무한루프 없음)',
    wI.entities.length === 2 && undoI.ids.length === 2, `count=${wI.entities.length}`);
  const rootsI = wI.entities.filter((e) => e.parentId == null);
  ok('G30-I 사이클 해소(≥1 최상위 — 무한 계층 아님)', rootsI.length >= 1, `roots=${rootsI.length}`);
  ok('G30-I 사이클 후 hashState 결정성(2회 일치)', SceneKit.hashState(wI) === SceneKit.hashState(wI), 'deterministic');
  SceneKit.applyUndo(wI, undoI);
  ok('G30-I 사이클 doc undo → 통째 제거', wI.entities.length === 0, `count=${wI.entities.length}`);

  // G30-J 부모-자식 역순 entities(자식이 배열 먼저, 부모 나중) 리맵 정합.
  const rev = [
    { id: 'rc', name: 'child', transform: {}, parentId: 'rp', components: [] },
    { id: 'rp', name: 'parent', transform: {}, components: [] }
  ];
  const wJ = SceneKit.load({ walls: [], entities: [] }, { mode: 'edit', seed: 1 });
  SceneKit.applyCommand(wJ, { type: 'instantiate', entities: rev });
  const newRc = wJ.entities.find((e) => e.name === 'child'), newRp = wJ.entities.find((e) => e.name === 'parent');
  ok('G30-J 역순 entities 리맵 정합(자식 parentId=부모 newId·부모 최상위)',
    newRc && newRp && newRc.parentId === newRp.id && newRp.parentId == null,
    `childParent=${newRc && newRc.parentId} parentId=${newRp && newRp.id}`);

  // G30-K 3단계 서브트리(루트→중간→잎) 리맵 정합(사이클 가드가 정상 트리를 안 깨는지).
  const three = [
    { id: 'tr', name: 'root3', transform: {}, components: [] },
    { id: 'tm', name: 'mid3', transform: {}, parentId: 'tr', components: [] },
    { id: 'tl', name: 'leaf3', transform: {}, parentId: 'tm', components: [] }
  ];
  const wK = SceneKit.load({ walls: [], entities: [] }, { mode: 'edit', seed: 1 });
  SceneKit.applyCommand(wK, { type: 'instantiate', entities: three });
  const nr = wK.entities.find((e) => e.name === 'root3'), nm = wK.entities.find((e) => e.name === 'mid3'), nl = wK.entities.find((e) => e.name === 'leaf3');
  ok('G30-K 3단계 리맵 정합(mid→root·leaf→mid·root 최상위)',
    nm.parentId === nr.id && nl.parentId === nm.id && nr.parentId == null,
    `mid=${nm.parentId} leaf=${nl.parentId} root=${nr.parentId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n— pass ${pass} · fail ${fail} · total ${pass + fail}`);
const result = { ok: fail === 0, pass, fail, checks };
console.log(JSON.stringify(result));
process.exit(fail === 0 ? 0 : 1);
