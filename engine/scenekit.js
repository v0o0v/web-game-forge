/* ============================================================================
 * SceneKit — 선언형 씬 로직코어 (web-game-builder 엔진 / WGF Studio)
 * ----------------------------------------------------------------------------
 * "WGF Studio" 브라우저 에디터의 **심장**. 유니티식 씬·게임오브젝트를 선언형
 * scene.json 으로 표현하고, 그 씬을 **Phaser 비의존·결정론**으로 굴리는 순수
 * 로직코어다. abilitykit.js 의 검증된 패턴("헤드리스 순수 코어 + 얇은 Phaser
 * 어댑터 + 주입 dt 결정론")을 그대로 따른다.
 *
 * 설계 분리 (중요 — 단일 코어 원칙):
 *  - SceneKit(이 파일) = **로직코어**. 컴포넌트 레지스트리·결정적 step·자체 경량
 *    충돌·직렬화·커맨드 apply/undo·상태 해시. Phaser/DOM/시각함수 의존 0.
 *  - engine/scenekit-phaser.js = **어댑터**(브라우저 전용). 코어 상태를 Phaser
 *    스프라이트/그래픽으로 렌더, 기즈모·입력·사운드 배선. 이 파일은 그걸 모른다.
 *  - 편집 프리뷰·Play·내보낸 게임이 **동일 코어**로 t=0 를 만들고 같은 코어로
 *    step → 설계서 §3.2 "동형성 계약 H"가 구성적으로 성립.
 *
 * 결정론(RngForge·BehaviorKit 철학 정합):
 *  - 무작위는 주입된 RngForge 난수기(world.rng)로만. Math.random() 금지.
 *  - 시간은 step(world, dt) 주입 dt(초)로만. Date.now()/performance.now()/
 *    new Date() 금지. 같은 (씬·seed·dt 수열) → 항상 같은 상태(hashState 동일).
 *  - 충돌 해석은 엔티티 id 정렬 순으로 결정적. open-set 동점 무작위 없음.
 *
 * 컴포넌트 모델:
 *  - 컴포넌트는 worker-2 가 engine/scenekit-components.js 에서
 *    SceneKit.registerComponent(type, def) 로 등록한다. 코어는 등록된 것을
 *    step 에서 호출만 한다.
 *  - **코어 단독 동작 보장**: 컴포넌트가 하나도 등록되지 않아도 load/serialize/
 *    hashState/applyCommand/step(충돌만) 이 정상 동작한다(헤드리스 단위 테스트).
 *    미등록 타입의 컴포넌트는 데이터로만 보존되고 step 에서 조용히 건너뛴다.
 *
 * 공개 API (worker-2/worker-3 와의 계약):
 *   SceneKit.registerComponent(type, def)         // def: {schema?, init?, step?, inspectorFields?}
 *   SceneKit.load(sceneDoc, {mode:'edit'|'play'}) // → world. edit·play 모두 init 만(step 안 함).
 *   SceneKit.step(world, dt)                       // 컴포넌트 step + 충돌 해석, world.time += dt.
 *   SceneKit.serialize(world)                      // → sceneDoc(깊은 복제, 결정적 키 순서).
 *   SceneKit.hashState(world)                      // → string. 트랜스폼+핵심 컴포넌트 필드 결정적 해시.
 *   SceneKit.applyCommand(world, cmd)              // → undoDelta(역연산). cmd 종류는 §applyCommand.
 *   SceneKit.applyUndo(world, undoDelta)           // applyCommand 의 역연산 적용.
 *
 * ctx (컴포넌트 init/step 이 받는 컨텍스트):
 *   { entity, world, rng, getComponent(type) }    // rng = world.rng, getComponent = 같은 엔티티의 컴포넌트 조회.
 *
 * 사용(헤드리스):
 *   var SceneKit = require('./scenekit.js');
 *   var world = SceneKit.load(SCENE_DOC, { mode: 'play' });
 *   for (var i = 0; i < 120; i++) SceneKit.step(world, 1/60);
 *   var h = SceneKit.hashState(world);             // 결정적 — 2회 실행 동일.
 *
 * 주의:
 *  - 헤드리스(Node require) 가능 — 외부 상태(DOM/시각) 의존 0. 결정적 테스트에 사용.
 *  - world.rng 는 RngForge 난수기를 권장(없으면 load 가 RngForge.create 로 생성,
 *    RngForge 미로드 환경이면 결정적 폴백 난수기를 내장 생성).
 *  - 트랜스폼 필드 기본값: x=0,y=0,rotation=0,scaleX=1,scaleY=1,depth=0.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var KIT_VERSION = '1.0.0';
  var SCHEMA_ID = 'wgf-scene@1';

  // ── 안전 헬퍼(abilitykit 관례) ──────────────────────────────────────────────
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function isObj(v) { return v !== null && typeof v === 'object'; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // RngForge 핸들(브라우저 전역 또는 Node require). 미존재면 내장 폴백을 쓴다.
  function resolveRngForge() {
    if (global && global.RngForge) return global.RngForge;
    if (typeof require === 'function') {
      try { return require('./rngforge.js'); } catch (e) { /* 폴백 */ }
    }
    return null;
  }

  // 내장 폴백 난수기(mulberry32 — rngforge.js 와 비트 동일). RngForge 미로드 시에만.
  // RngForge 가 있으면 절대 쓰지 않는다(멀티스트림·state 등 정식 API 를 위해).
  function fallbackRng(seedInput) {
    var seed0 = (typeof seedInput === 'number' && isFinite(seedInput)) ? (seedInput | 0) : (0x9E3779B9 | 0);
    var a = seed0;
    function rng() {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    rng.next = rng;
    rng.seed = seed0;
    rng.int = function (min, max) { if (max === undefined) { max = min; min = 0; } return Math.floor(min + rng() * (max - min + 1)); };
    rng.float = function (min, max) { if (max === undefined) { max = min; min = 0; } return min + rng() * (max - min); };
    rng.bool = function (p) { return rng() < (p === undefined ? 0.5 : p); };
    rng.pick = function (a2) { return (a2 && a2.length) ? a2[Math.floor(rng() * a2.length)] : undefined; };
    rng.state = function () { return a; };
    rng.setState = function (s) { a = s | 0; return rng; };
    rng.stream = function () { return rng; };   // 폴백은 스트림 분리 미지원 — 자기 자신.
    return rng;
  }

  // ── 컴포넌트 레지스트리 ─────────────────────────────────────────────────────
  // 타입명 → { schema, init(ctx), step(ctx, dt), inspectorFields }.
  // worker-2(scenekit-components.js)가 registerComponent 로 채운다.
  var REGISTRY = {};

  function registerComponent(type, def) {
    if (typeof type !== 'string' || !type) throw new Error('registerComponent: type 은 비어 있지 않은 문자열이어야 함.');
    def = def || {};
    REGISTRY[type] = {
      type: type,
      schema: isObj(def.schema) ? def.schema : {},
      init: (typeof def.init === 'function') ? def.init : null,
      step: (typeof def.step === 'function') ? def.step : null,
      inspectorFields: arr(def.inspectorFields)
    };
    return REGISTRY[type];
  }
  function getComponentDef(type) { return REGISTRY[type] || null; }
  function hasComponentDef(type) { return has(REGISTRY, type); }

  // ── 트랜스폼/엔티티 정규화 ──────────────────────────────────────────────────
  // 모든 필드를 명시 기본값으로 채워 동형성(edit·play·export t=0 동일)을 보장.
  function normalizeTransform(t) {
    t = isObj(t) ? t : {};
    return {
      x: num(t.x, 0),
      y: num(t.y, 0),
      rotation: num(t.rotation, 0),
      scaleX: num(t.scaleX, 1),
      scaleY: num(t.scaleY, 1),
      depth: num(t.depth, 0)
    };
  }

  // 컴포넌트 1개 깊은 복제(type 보존 + 나머지 필드 그대로). 함수·undefined 는 버림(JSON 가능값만).
  function cloneComponent(c) {
    var out = {};
    if (!isObj(c)) return { type: '' };
    var keys = Object.keys(c);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      out[k] = deepCloneValue(c[k]);
    }
    if (typeof out.type !== 'string') out.type = '';
    return out;
  }

  // JSON 직렬화 가능 값만 깊은 복제(함수/undefined 제거). 결정적 — 키 순서 보존.
  function deepCloneValue(v) {
    if (Array.isArray(v)) {
      var a2 = [];
      for (var i = 0; i < v.length; i++) {
        var ev = deepCloneValue(v[i]);
        a2.push(ev === undefined ? null : ev);
      }
      return a2;
    }
    if (isObj(v)) {
      var o = {};
      var keys = Object.keys(v);
      for (var j = 0; j < keys.length; j++) {
        var cv = deepCloneValue(v[keys[j]]);
        if (cv !== undefined) o[keys[j]] = cv;
      }
      return o;
    }
    if (typeof v === 'function' || v === undefined) return undefined;
    if (typeof v === 'number' && !isFinite(v)) return 0;   // NaN/Infinity 차단(결정성·직렬화 안전)
    return v;
  }

  // 엔티티 정규화(load·addEntity 진입). id 는 호출자가 보장하거나 여기서 부여.
  function normalizeEntity(raw, world) {
    raw = isObj(raw) ? raw : {};
    var id = (raw.id != null) ? String(raw.id) : allocId(world);
    var ent = {
      id: id,
      name: (typeof raw.name === 'string') ? raw.name : id,
      transform: normalizeTransform(raw.transform),
      components: []
    };
    var comps = arr(raw.components);
    for (var i = 0; i < comps.length; i++) {
      ent.components.push(cloneComponent(comps[i]));
    }
    return ent;
  }

  // 결정적 id 발급 — world._idSeq 단조 증가(시각함수·무작위 미사용).
  function allocId(world) {
    if (!world._idSeq) world._idSeq = 0;
    world._idSeq += 1;
    return 'e' + world._idSeq;
  }

  // 기존 id 들을 보고 _idSeq 를 'eN' 최대값 이상으로 끌어올린다(load 후 충돌 방지).
  function bumpIdSeq(world) {
    var maxN = world._idSeq || 0;
    for (var i = 0; i < world.entities.length; i++) {
      var m = /^e(\d+)$/.exec(world.entities[i].id);
      if (m) { var n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
    }
    world._idSeq = maxN;
  }

  // 엔티티 조회(선형 — 씬 규모에서 충분, 결정적).
  function findEntity(world, id) {
    id = String(id);
    for (var i = 0; i < world.entities.length; i++) if (world.entities[i].id === id) return world.entities[i];
    return null;
  }
  function findEntityIndex(world, id) {
    id = String(id);
    for (var i = 0; i < world.entities.length; i++) if (world.entities[i].id === id) return i;
    return -1;
  }
  // 엔티티의 특정 타입 컴포넌트(첫 번째). 없으면 null.
  function getComponentOn(entity, type) {
    var comps = entity.components;
    for (var i = 0; i < comps.length; i++) if (comps[i].type === type) return comps[i];
    return null;
  }

  // ── ctx 빌더 — 컴포넌트 init/step 이 받는 컨텍스트 ───────────────────────────
  function makeCtx(entity, world) {
    return {
      entity: entity,
      world: world,
      rng: world.rng,
      getComponent: function (type) { return getComponentOn(entity, type); }
    };
  }

  // 한 엔티티의 등록된 컴포넌트들을 init(컴포넌트 선언 순서). 미등록 타입은 건너뜀.
  function initEntity(entity, world) {
    var comps = entity.components;
    for (var i = 0; i < comps.length; i++) {
      var def = REGISTRY[comps[i].type];
      if (def && def.init) {
        def.init(makeCtx(entity, world), comps[i]);
      }
    }
  }

  // 정식 wgf-scene@1 문서는 엔티티를 `scenes[]` 래퍼 안에 둔다(scenes[].entities).
  // 활성 씬 선택: opts.sceneId 와 id 가 일치하는 씬 > scenes[0]. scenes 가 없으면 null.
  function pickScene(sceneDoc, opts) {
    var scenes = arr(sceneDoc.scenes);
    if (!scenes.length) return null;
    if (opts && opts.sceneId != null) {
      for (var i = 0; i < scenes.length; i++) {
        if (isObj(scenes[i]) && String(scenes[i].id) === String(opts.sceneId)) return scenes[i];
      }
    }
    return isObj(scenes[0]) ? scenes[0] : null;
  }

  // ── load — sceneDoc → world ─────────────────────────────────────────────────
  // mode: 'edit'(기본) | 'play'. 둘 다 init 만 수행(step 안 함). t=0 단면을 만든다.
  //   - edit: 정적 t=0 표현(어댑터가 선택/기즈모를 얹음). 코어는 step 호출 안 됨.
  //   - play: 같은 t=0 에서 시작해 이후 SceneKit.step 으로 진행.
  // 입력 포맷(둘 다 지원):
  //   - 정식 wgf-scene@1: 엔티티가 `scenes[].entities`(활성 씬 = opts.sceneId|scenes[0]).
  //     walls 우선순위 = 활성 scene.walls > 최상위 sceneDoc.walls.
  //     meta = sceneDoc.meta(깊은 복제). 활성 scene.systems 가 있으면 meta.systems 에 보존.
  //   - raw 픽스처(하위호환): 최상위 `entities`/`walls`(scenes 미존재 시). 헤드리스 테스트용.
  // seed 우선순위: opts.seed > sceneDoc.meta.seed > 고정 기본.
  function load(sceneDoc, opts) {
    sceneDoc = isObj(sceneDoc) ? sceneDoc : {};
    opts = opts || {};
    var mode = (opts.mode === 'play') ? 'play' : 'edit';

    // 활성 씬 해석. scenes[] 가 있으면 그쪽, 없으면 최상위(raw 픽스처).
    var scene = pickScene(sceneDoc, opts);
    var srcEntities = scene ? arr(scene.entities) : arr(sceneDoc.entities);
    // walls: 활성 scene.walls 우선, 없으면 최상위 sceneDoc.walls.
    var srcWalls = (scene && scene.walls != null) ? arr(scene.walls) : arr(sceneDoc.walls);
    // assets: 활성 scene.assets 우선, 없으면 최상위 sceneDoc.assets(walls 패턴 동일).
    // P1 어댑터/컴포넌트가 ctx.world.assets 로 자산 def 에 접근(Sprite.init 등).
    var srcAssets = (scene && scene.assets != null) ? scene.assets : sceneDoc.assets;
    // meta: sceneDoc.meta(깊은 복제) + 활성 scene.systems 를 meta.systems 로 보존.
    var meta = isObj(sceneDoc.meta) ? deepCloneValue(sceneDoc.meta) : {};
    if (scene && isObj(scene.systems)) meta.systems = deepCloneValue(scene.systems);

    var seed = (opts.seed != null) ? opts.seed : (meta.seed != null ? meta.seed : 0x9E3779B9 | 0);

    // 난수기: 호출자 주입 > RngForge.create(seed) > 내장 폴백.
    var rng;
    if (opts.rng && typeof opts.rng === 'function') {
      rng = opts.rng;
    } else {
      var RF = resolveRngForge();
      rng = RF ? RF.create(seed) : fallbackRng(typeof seed === 'number' ? seed : 0x9E3779B9 | 0);
    }

    var world = {
      schema: SCHEMA_ID,
      mode: mode,
      sceneId: scene ? (scene.id != null ? String(scene.id) : null) : null,
      entities: [],
      walls: [],
      assets: isObj(srcAssets) ? deepCloneValue(srcAssets) : {},
      rng: rng,
      time: 0,
      meta: meta,
      _idSeq: 0
    };

    // 정적 벽(AABB 배열). {x,y,w,h} 정규화 — x,y=좌상단, w,h=폭/높이.
    for (var w = 0; w < srcWalls.length; w++) {
      var wl = isObj(srcWalls[w]) ? srcWalls[w] : {};
      world.walls.push({ x: num(wl.x, 0), y: num(wl.y, 0), w: Math.max(0, num(wl.w, 0)), h: Math.max(0, num(wl.h, 0)) });
    }

    // 엔티티.
    for (var e = 0; e < srcEntities.length; e++) {
      world.entities.push(normalizeEntity(srcEntities[e], world));
    }
    bumpIdSeq(world);

    // init — edit·play 둘 다 컴포넌트 init 만(step 은 별도 SceneKit.step).
    for (var i = 0; i < world.entities.length; i++) initEntity(world.entities[i], world);

    return world;
  }

  // ── step — 1프레임 진행(컴포넌트 step + 충돌 해석) ──────────────────────────
  // dt(초) 주입만 소비. dt 가드(BehaviorKit update-guard): 비유한·음수 → 0.
  function step(world, dt) {
    if (!isObj(world)) return;
    dt = num(dt, 0);
    if (!(dt >= 0) || !isFinite(dt)) dt = 0;    // NaN/Infinity/음수 가드

    // 1) 컴포넌트 step — 엔티티 배열 순서(결정적). 각 엔티티의 컴포넌트는 선언 순서.
    //    step 도중 엔티티가 추가/삭제될 수 있으나, 이번 프레임은 스냅샷 길이로 순회(결정성).
    var snapshot = world.entities.slice();
    for (var i = 0; i < snapshot.length; i++) {
      var ent = snapshot[i];
      // 이미 제거된 엔티티는 건너뜀(컴포넌트 step 이 removeEntity 했을 수 있음).
      if (findEntityIndex(world, ent.id) === -1) continue;
      var comps = ent.components;
      for (var c = 0; c < comps.length; c++) {
        var def = REGISTRY[comps[c].type];
        if (def && def.step) def.step(makeCtx(ent, world), dt, comps[c]);
      }
    }

    // 2) 충돌 해석 — 동적 바디 분리(코어 내장, Phaser 무관). id 정렬 순으로 결정적.
    resolveCollisions(world);

    // 3) 시간 누적.
    world.time = num(world.time, 0) + dt;
  }

  // ── 충돌 — Body 컴포넌트(동적) ↔ 동적/정적 벽 ──────────────────────────────
  // Body 규약(worker-2 Body 컴포넌트·SCHEMA.md 와 정합):
  //   { type:'Body', shape:'aabb'|'circle', w?,h?(aabb), radius?(circle),
  //     offsetX?,offsetY?(트랜스폼 기준 중심 오프셋), isStatic?:bool(true=고정,분리 안 됨) }
  // 정적 플래그 캐노니컬 = `isStatic`(엔진 관례 matterkit/Phaser Matter 정합). 구
  // `static` 은 하위호환 폴백으로만 읽는다(둘 다 없으면 동적).
  // 분리는 트랜스폼(x,y)을 직접 민다. 최소 침투축(MTV)으로 밀어낸다. 결정적 순서.
  function bodyOf(entity) {
    var b = getComponentOn(entity, 'Body');
    if (!b) return null;
    var shape = (b.shape === 'circle') ? 'circle' : 'aabb';
    var cx = num(entity.transform.x, 0) + num(b.offsetX, 0);
    var cy = num(entity.transform.y, 0) + num(b.offsetY, 0);
    var isStaticBody = (b.isStatic != null ? b.isStatic : b.static) === true;
    if (shape === 'circle') {
      return { kind: 'circle', cx: cx, cy: cy, r: Math.max(0, num(b.radius, 0)), isStatic: isStaticBody, ent: entity };
    }
    var hw = Math.max(0, num(b.w, 0)) / 2, hh = Math.max(0, num(b.h, 0)) / 2;
    return { kind: 'aabb', cx: cx, cy: cy, hw: hw, hh: hh, isStatic: isStaticBody, ent: entity };
  }

  // 동적 바디 목록(static=false 인 Body 보유 엔티티), id 사전식 정렬(결정적 해석 순서).
  function collectBodies(world) {
    var bodies = [];
    for (var i = 0; i < world.entities.length; i++) {
      var b = bodyOf(world.entities[i]);
      if (b) bodies.push(b);
    }
    bodies.sort(function (a, b2) { return a.ent.id < b2.ent.id ? -1 : (a.ent.id > b2.ent.id ? 1 : 0); });
    return bodies;
  }

  function resolveCollisions(world) {
    var bodies = collectBodies(world);

    // (a) 동적 ↔ 동적: 각 쌍을 id 정렬 순으로 1회 해석. 둘 다 동적이면 절반씩 분리.
    for (var i = 0; i < bodies.length; i++) {
      if (bodies[i].isStatic) continue;
      for (var j = i + 1; j < bodies.length; j++) {
        separatePair(bodies[i], bodies[j]);
      }
    }

    // (b) 동적 ↔ 정적 벽(world.walls AABB): 동적 바디만 밀려난다(엄폐·장애물).
    for (var k = 0; k < bodies.length; k++) {
      if (bodies[k].isStatic) continue;
      for (var w = 0; w < world.walls.length; w++) {
        separateFromWall(bodies[k], world.walls[w]);
      }
    }
  }

  // 두 바디 분리(MTV). 둘 다 동적이면 절반씩, 한쪽 정적이면 동적만 전부 밀려난다.
  // 분리 후 바디 캐시 좌표(cx,cy)도 갱신해 같은 프레임 후속 해석이 일관되게 한다.
  function separatePair(a, b) {
    var mtv = computeMTV(a, b);
    if (!mtv) return;
    var aDyn = !a.isStatic, bDyn = !b.isStatic;
    if (!aDyn && !bDyn) return;
    var share = (aDyn && bDyn) ? 0.5 : 1;
    if (aDyn) { moveBody(a, -mtv.x * (bDyn ? share : 1), -mtv.y * (bDyn ? share : 1)); }
    if (bDyn) { moveBody(b, mtv.x * (aDyn ? share : 1), mtv.y * (aDyn ? share : 1)); }
  }

  // 정적 벽 AABB 로부터 동적 바디를 밀어낸다.
  function separateFromWall(body, wall) {
    // 벽을 AABB 바디로 래핑(중심·half-extent).
    var wallBody = {
      kind: 'aabb',
      cx: num(wall.x, 0) + Math.max(0, num(wall.w, 0)) / 2,
      cy: num(wall.y, 0) + Math.max(0, num(wall.h, 0)) / 2,
      hw: Math.max(0, num(wall.w, 0)) / 2,
      hh: Math.max(0, num(wall.h, 0)) / 2,
      isStatic: true
    };
    var mtv = computeMTV(body, wallBody);
    if (!mtv) return;
    // body 가 wallBody 로부터 멀어지는 방향 = -mtv(MTV 는 a→b 분리 벡터).
    moveBody(body, -mtv.x, -mtv.y);
  }

  // 바디 이동 = 엔티티 트랜스폼 + 캐시 좌표 동시 갱신.
  function moveBody(body, dx, dy) {
    body.cx += dx; body.cy += dy;
    body.ent.transform.x = num(body.ent.transform.x, 0) + dx;
    body.ent.transform.y = num(body.ent.transform.y, 0) + dy;
  }

  // 최소 침투 벡터(MTV) — a 를 b 로부터 분리하는 최소 이동(a→b 방향). 미겹침이면 null.
  // 반환 {x,y}: a 에 이 벡터를 더하면 a 가 b 쪽으로 더 파고들고, 빼면 분리된다.
  function computeMTV(a, b) {
    if (a.kind === 'aabb' && b.kind === 'aabb') return mtvAABB(a, b);
    if (a.kind === 'circle' && b.kind === 'circle') return mtvCircle(a, b);
    // 혼합(원-AABB): 원을 AABB 로 근사하지 않고 정확 분리.
    if (a.kind === 'circle' && b.kind === 'aabb') { var m = mtvCircleAABB(a, b); return m; }
    if (a.kind === 'aabb' && b.kind === 'circle') {
      var m2 = mtvCircleAABB(b, a);                 // b(원) 기준 → 부호 반전해 a 기준으로.
      return m2 ? { x: -m2.x, y: -m2.y } : null;
    }
    return null;
  }

  // AABB-AABB MTV(축 분리). 작은 침투축으로 분리. 동점이면 x 우선(결정적).
  function mtvAABB(a, b) {
    var dx = b.cx - a.cx;
    var px = (a.hw + b.hw) - Math.abs(dx);
    if (px <= 0) return null;
    var dy = b.cy - a.cy;
    var py = (a.hh + b.hh) - Math.abs(dy);
    if (py <= 0) return null;
    if (px <= py) {                                  // x축 분리(동점 x 우선)
      var sx = dx < 0 ? -1 : 1;                       // dx=0 이면 +x(결정적)
      return { x: sx * px, y: 0 };
    }
    var sy = dy < 0 ? -1 : 1;
    return { x: 0, y: sy * py };
  }

  // 원-원 MTV. 중심 일치 시 +x 로 결정적 분리.
  function mtvCircle(a, b) {
    var dx = b.cx - a.cx, dy = b.cy - a.cy;
    var rsum = a.r + b.r;
    var d2 = dx * dx + dy * dy;
    if (d2 >= rsum * rsum) return null;
    var d = Math.sqrt(d2);
    if (d === 0) return { x: rsum, y: 0 };           // 완전 일치 → +x(결정적)
    var overlap = rsum - d;
    return { x: (dx / d) * overlap, y: (dy / d) * overlap };
  }

  // 원(c) - AABB(r) MTV. 반환은 c→r 방향(c 에 더하면 더 파고듦).
  function mtvCircleAABB(c, r) {
    // AABB 위 가장 가까운 점.
    var nx = clampNum(c.cx, r.cx - r.hw, r.cx + r.hw);
    var ny = clampNum(c.cy, r.cy - r.hh, r.cy + r.hh);
    var dx = nx - c.cx, dy = ny - c.cy;
    var d2 = dx * dx + dy * dy;
    if (d2 > c.r * c.r) return null;                 // 가장 가까운 점이 반지름 밖 → 미겹침
    if (d2 === 0) {
      // 원 중심이 AABB 내부 — 가장 가까운 변으로 밀어낸다(최소 관통축).
      var left = (c.cx - (r.cx - r.hw)), right = ((r.cx + r.hw) - c.cx);
      var top = (c.cy - (r.cy - r.hh)), bottom = ((r.cy + r.hh) - c.cy);
      var minX = Math.min(left, right), minY = Math.min(top, bottom);
      if (minX <= minY) {                            // x 우선(결정적)
        var sx = (left < right) ? -1 : 1;             // 더 가까운 변 쪽으로(c→r 는 반대)
        return { x: sx * (minX + c.r), y: 0 };
      }
      var sy = (top < bottom) ? -1 : 1;
      return { x: 0, y: sy * (minY + c.r) };
    }
    var d = Math.sqrt(d2);
    var overlap = c.r - d;
    return { x: (dx / d) * overlap, y: (dy / d) * overlap };
  }

  function clampNum(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // ── serialize — world → sceneDoc(깊은 복제, 결정적) ─────────────────────────
  function serialize(world) {
    if (!isObj(world)) return { schema: SCHEMA_ID, meta: {}, walls: [], entities: [] };
    var doc = {
      schema: SCHEMA_ID,
      meta: deepCloneValue(world.meta || {}),
      assets: isObj(world.assets) ? deepCloneValue(world.assets) : {},
      walls: [],
      entities: []
    };
    for (var w = 0; w < world.walls.length; w++) {
      var wl = world.walls[w];
      doc.walls.push({ x: num(wl.x, 0), y: num(wl.y, 0), w: num(wl.w, 0), h: num(wl.h, 0) });
    }
    for (var i = 0; i < world.entities.length; i++) {
      var ent = world.entities[i];
      var out = {
        id: ent.id,
        name: ent.name,
        transform: normalizeTransform(ent.transform),
        components: []
      };
      for (var c = 0; c < ent.components.length; c++) out.components.push(cloneComponent(ent.components[c]));
      doc.entities.push(out);
    }
    return doc;
  }

  // ── hashState — 결정적 상태 해시 ────────────────────────────────────────────
  // 트랜스폼 + 핵심 컴포넌트 필드를 결정적 키 순서로 직렬화 후 FNV-1a 해시.
  //   - 부동소수 트랜스폼은 라운딩(1e-6 그리드)해 미세 오차 누적이 해시를 흔들지 않게.
  //   - 컴포넌트는 type + (type 제외) 필드 키 정렬 순으로 안정 직렬화.
  // 같은 (씬·seed·dt 수열) → 같은 해시. replay-determinism 회귀의 기반.
  function hashState(world) {
    if (!isObj(world)) return fnv1a('null');
    // 엔티티를 id 정렬 순으로(배열 재배치에 불변).
    var ents = world.entities.slice().sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
    var parts = ['t', round6(world.time)];
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      var t = e.transform;
      parts.push(
        '|', e.id,
        ':', round6(num(t.x, 0)), round6(num(t.y, 0)), round6(num(t.rotation, 0)),
        round6(num(t.scaleX, 1)), round6(num(t.scaleY, 1)), round6(num(t.depth, 0))
      );
      // 컴포넌트 — 선언 순서 유지(같은 type 다중 컴포넌트 구분), 필드는 키 정렬.
      for (var c = 0; c < e.components.length; c++) {
        parts.push(';', stableComponent(e.components[c]));
      }
    }
    // rng 상태도 해시에 포함(난수 진행이 다르면 상태도 다름을 반영).
    if (world.rng && typeof world.rng.state === 'function') {
      var st = world.rng.state();
      parts.push('|rng:', (typeof st === 'number') ? (st >>> 0) : String(st));
    }
    return fnv1a(parts.join(','));
  }

  // 컴포넌트 안정 직렬화: type + 필드 키 정렬 + 값 정규화(부동소수 라운딩).
  function stableComponent(c) {
    var keys = Object.keys(c).sort();
    var s = '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      s += k + '=' + stableValue(c[k]) + '&';
    }
    return s;
  }
  function stableValue(v) {
    if (Array.isArray(v)) {
      var parts = [];
      for (var i = 0; i < v.length; i++) parts.push(stableValue(v[i]));
      return '[' + parts.join(',') + ']';
    }
    if (isObj(v)) {
      var keys = Object.keys(v).sort();
      var o = '';
      for (var j = 0; j < keys.length; j++) o += keys[j] + ':' + stableValue(v[keys[j]]) + ',';
      return '{' + o + '}';
    }
    if (typeof v === 'number') return round6(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v == null) return '~';
    return String(v);
  }

  // 부동소수 라운딩(1e-6 그리드) — 결정적 문자열화(-0 정규화 포함).
  function round6(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '0';
    var r = Math.round(n * 1e6) / 1e6;
    if (r === 0) r = 0;        // -0 → 0
    return String(r);
  }

  // FNV-1a 32-bit(rngforge.js 의 hashStr 과 동일 알고리즘) → 8자리 hex 문자열.
  function fnv1a(s) {
    var h = 2166136261 >>> 0;
    s = String(s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  // ── applyCommand / applyUndo — 커맨드 적용 + 역연산(Undo 델타) ───────────────
  // 지원 cmd:
  //   { type:'setTransform', id, transform:{...부분} }            // 부분 트랜스폼 갱신
  //   { type:'addComponent', id, component:{type,...} }            // 컴포넌트 추가(끝에)
  //   { type:'updateComponent', id, index|componentType, patch:{...} } // 컴포넌트 필드 패치
  //   { type:'removeComponent', id, index|componentType }          // 컴포넌트 제거
  //   { type:'addEntity', entity:{...} }                           // 엔티티 추가(끝에)
  //   { type:'removeEntity', id }                                  // 엔티티 제거
  // 반환 undoDelta = applyUndo 에 그대로 넘기면 정확히 역연산. (실패 시 {type:'noop'})
  function applyCommand(world, cmd) {
    if (!isObj(world) || !isObj(cmd)) return { type: 'noop' };
    switch (cmd.type) {
      case 'setTransform': return cmdSetTransform(world, cmd);
      case 'addComponent': return cmdAddComponent(world, cmd);
      case 'updateComponent': return cmdUpdateComponent(world, cmd);
      case 'removeComponent': return cmdRemoveComponent(world, cmd);
      case 'addEntity': return cmdAddEntity(world, cmd);
      case 'removeEntity': return cmdRemoveEntity(world, cmd);
      default: return { type: 'noop' };
    }
  }

  function cmdSetTransform(world, cmd) {
    var ent = findEntity(world, cmd.id);
    if (!ent) return { type: 'noop' };
    var patch = isObj(cmd.transform) ? cmd.transform : {};
    var before = {};
    var keys = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'depth'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (has(patch, k)) {
        before[k] = ent.transform[k];
        ent.transform[k] = num(patch[k], ent.transform[k]);
      }
    }
    return { type: 'setTransform', id: ent.id, transform: before };
  }

  function cmdAddComponent(world, cmd) {
    var ent = findEntity(world, cmd.id);
    if (!ent || !isObj(cmd.component)) return { type: 'noop' };
    var comp = cloneComponent(cmd.component);
    ent.components.push(comp);
    var idx = ent.components.length - 1;
    // init 호출(등록된 타입이면) — play 중 추가도 init 일관.
    var def = REGISTRY[comp.type];
    if (def && def.init) def.init(makeCtx(ent, world), comp);
    return { type: 'removeComponent', id: ent.id, index: idx };
  }

  // index 또는 componentType 으로 컴포넌트 1개 지목(index 우선).
  function resolveComponentIndex(ent, cmd) {
    if (typeof cmd.index === 'number' && cmd.index >= 0 && cmd.index < ent.components.length) return cmd.index;
    if (typeof cmd.componentType === 'string') {
      for (var i = 0; i < ent.components.length; i++) if (ent.components[i].type === cmd.componentType) return i;
    }
    return -1;
  }

  function cmdUpdateComponent(world, cmd) {
    var ent = findEntity(world, cmd.id);
    if (!ent) return { type: 'noop' };
    var idx = resolveComponentIndex(ent, cmd);
    if (idx < 0) return { type: 'noop' };
    var comp = ent.components[idx];
    var patch = isObj(cmd.patch) ? cmd.patch : {};
    var before = {};
    var pkeys = Object.keys(patch);
    for (var i = 0; i < pkeys.length; i++) {
      var k = pkeys[i];
      if (k === 'type') continue;                  // type 은 불변(컴포넌트 정체성)
      before[k] = has(comp, k) ? deepCloneValue(comp[k]) : undefined;
      var nv = deepCloneValue(patch[k]);
      if (nv === undefined) delete comp[k]; else comp[k] = nv;
    }
    // undo 패치: 이전 값 복원(없던 키는 __delete 마커로 제거 지시).
    var undoPatch = {};
    for (var b = 0; b < pkeys.length; b++) {
      var bk = pkeys[b];
      if (bk === 'type') continue;
      undoPatch[bk] = (before[bk] === undefined) ? { __delete: true } : before[bk];
    }
    return { type: 'updateComponent', id: ent.id, index: idx, patch: undoPatch, _restore: true };
  }

  function cmdRemoveComponent(world, cmd) {
    var ent = findEntity(world, cmd.id);
    if (!ent) return { type: 'noop' };
    var idx = resolveComponentIndex(ent, cmd);
    if (idx < 0) return { type: 'noop' };
    var removed = cloneComponent(ent.components[idx]);
    ent.components.splice(idx, 1);
    // undo: 같은 위치에 되돌려 넣는다(addComponentAt).
    return { type: '__insertComponentAt', id: ent.id, index: idx, component: removed };
  }

  function cmdAddEntity(world, cmd) {
    var ent = normalizeEntity(cmd.entity, world);
    // id 충돌 방지: 이미 있으면 새 id 발급.
    if (findEntity(world, ent.id)) ent.id = allocId(world);
    world.entities.push(ent);
    bumpIdSeq(world);
    initEntity(ent, world);
    return { type: 'removeEntity', id: ent.id };
  }

  function cmdRemoveEntity(world, cmd) {
    var idx = findEntityIndex(world, cmd.id);
    if (idx < 0) return { type: 'noop' };
    var removed = serializeEntity(world.entities[idx]);
    world.entities.splice(idx, 1);
    // undo: 같은 위치에 복원.
    return { type: '__insertEntityAt', index: idx, entity: removed };
  }

  // 엔티티 1개 깊은 복제(직렬화 형태).
  function serializeEntity(ent) {
    var out = { id: ent.id, name: ent.name, transform: normalizeTransform(ent.transform), components: [] };
    for (var c = 0; c < ent.components.length; c++) out.components.push(cloneComponent(ent.components[c]));
    return out;
  }

  // applyUndo — applyCommand 가 돌려준 undoDelta 를 적용(내부 마커 명령 포함).
  function applyUndo(world, undoDelta) {
    if (!isObj(world) || !isObj(undoDelta)) return;
    switch (undoDelta.type) {
      case 'noop': return;
      case '__insertComponentAt': {
        var ent = findEntity(world, undoDelta.id);
        if (ent) {
          var comp = cloneComponent(undoDelta.component);
          var idx = clampNum(undoDelta.index | 0, 0, ent.components.length);
          ent.components.splice(idx, 0, comp);
          var def = REGISTRY[comp.type];
          if (def && def.init) def.init(makeCtx(ent, world), comp);
        }
        return;
      }
      case '__insertEntityAt': {
        var ent2 = normalizeEntity(undoDelta.entity, world);
        var at = clampNum(undoDelta.index | 0, 0, world.entities.length);
        world.entities.splice(at, 0, ent2);
        bumpIdSeq(world);
        initEntity(ent2, world);
        return;
      }
      case 'updateComponent': {
        if (undoDelta._restore) { restoreComponent(world, undoDelta); return; }
        applyCommand(world, undoDelta);
        return;
      }
      default:
        // setTransform·addComponent·removeComponent·addEntity·removeEntity 역연산은
        // 그 자체가 정상 cmd 형태이므로 applyCommand 로 재적용.
        applyCommand(world, undoDelta);
    }
  }

  // updateComponent undo 복원: __delete 마커는 키 제거, 그 외는 값 복원.
  function restoreComponent(world, delta) {
    var ent = findEntity(world, delta.id);
    if (!ent) return;
    var idx = (typeof delta.index === 'number') ? delta.index : resolveComponentIndex(ent, delta);
    if (idx < 0 || idx >= ent.components.length) return;
    var comp = ent.components[idx];
    var patch = isObj(delta.patch) ? delta.patch : {};
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = patch[k];
      if (isObj(v) && v.__delete === true) { delete comp[k]; }
      else comp[k] = deepCloneValue(v);
    }
  }

  // ── reset — 씬 재시작(BehaviorKit reset 계약) ───────────────────────────────
  // sceneDoc 을 보관해 두면 같은 seed·문서로 t=0 재구성. 보관본 없으면 현 상태 직렬화→재로드.
  function reset(world, opts) {
    if (!isObj(world)) return world;
    var doc = serialize(world);
    var fresh = load(doc, { mode: world.mode, seed: (opts && opts.seed != null) ? opts.seed : undefined });
    // 제자리 갱신(참조 유지).
    world.entities = fresh.entities;
    world.walls = fresh.walls;
    world.time = 0;
    world._idSeq = fresh._idSeq;
    if (opts && opts.rng) world.rng = opts.rng; else world.rng = fresh.rng;
    return world;
  }

  // ── 네임스페이스 노출 ───────────────────────────────────────────────────────
  var SceneKit = {
    VERSION: KIT_VERSION,
    SCHEMA_ID: SCHEMA_ID,

    // 컴포넌트 레지스트리
    registerComponent: registerComponent,
    getComponentDef: getComponentDef,
    hasComponentDef: hasComponentDef,

    // 라이프사이클
    load: load,
    step: step,
    reset: reset,

    // 직렬화·해시
    serialize: serialize,
    hashState: hashState,

    // 커맨드
    applyCommand: applyCommand,
    applyUndo: applyUndo,

    // 조회 헬퍼(어댑터·테스트용)
    findEntity: findEntity,
    getComponentOn: getComponentOn
  };

  global.SceneKit = SceneKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = SceneKit;
})(typeof window !== 'undefined' ? window : this);
