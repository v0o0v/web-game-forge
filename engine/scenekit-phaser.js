/* ============================================================================
 * SceneKitPhaser — SceneKit 로직코어의 Phaser 어댑터 (브라우저 전용 / WGF Studio)
 * ----------------------------------------------------------------------------
 * SceneKit(engine/scenekit.js) 로 만든 world 의 엔티티를 Phaser 스프라이트/
 * 그래픽으로 t=0 렌더하는 **얇은 어댑터**다. 설계서 §4.1 의 "헤드리스 순수
 * 코어 + 얇은 Phaser 어댑터" 분리를 그대로 따른다.
 *
 * 단일 코어 원칙(동형성 계약 H):
 *  - 어댑터는 SceneKit.load(sceneDoc, {mode:'edit'}) 로 동일 코어로 t=0 를 만든다.
 *  - edit 모드는 코어를 step 하지 않는다(정적 t=0 표현 + 선택/기즈모).
 *  - play 모드는 같은 코어를 주입 dt 로 step 한다. 별도 edit-전용 렌더 분기 없음.
 *
 * 상태 변경 규약(Undo 일관성):
 *  - 기즈모 드래그/입력 → 트랜스폼 직접 수정 금지. 반드시 SceneKit.applyCommand 로만.
 *  - 드래그는 프레임당 coalesce, 드롭 시 단일 setTransform 커맨드 1개 커밋(§7).
 *  - applyCommand 가 돌려준 undoDelta 는 셸(editor/ui)이 스택으로 관리(코어 미보관).
 *
 * 결정론:
 *  - 렌더 좌표 계산·자산 bake 입력에 Math.random 금지. 무작위는 world.rng(ctx.rng)만.
 *  - UI 애니메이션(requestAnimationFrame)은 허용하되 씬 코어 상태에 영향 0.
 *  - AnimatedSprite t=0 = 프레임0(계약 H′).
 *
 * 무빌드: IIFE + module.exports 양형. window 없으면(Node require) 본체 실행 안 하고
 *  정의만 노출(어댑터는 Phaser/DOM 의존이라 헤드리스 실행 불가 — 셸/테스트가 require
 *  해도 throw 안 나게 가드). createUnavailable() 가 명확한 에러 메서드를 돌려준다.
 *
 * 공개 API:
 *   SceneKitPhaser.create(parentEl, sceneDoc, opts) → inst
 *   inst.getWorld()                  // 현재 world
 *   inst.serialize()                 // SceneKit.serialize(world)
 *   inst.hashState()                 // SceneKit.hashState(world)
 *   inst.select(ids)                 // 선택 교체(배열)
 *   inst.getSelection()              // 선택 id 배열
 *   inst.onSelectionChange(cb)       // 선택 변경 구독 → unsubscribe()
 *   inst.applyCommand(cmd)           // SceneKit.applyCommand 위임 → undoDelta(렌더 갱신)
 *   inst.applyUndo(undoDelta)        // SceneKit.applyUndo 위임(렌더 갱신)
 *   inst.setSnap(bool, size)         // 그리드 스냅 토글/크기
 *   inst.setGizmoMode('move'|'rotate'|'scale')
 *   inst.setMode('edit'|'play')      // play 는 코어 step 시작, edit 는 정지
 *   inst.reload(sceneDoc)            // 새 씬으로 어댑터 재마운트(상태 초기화)
 *   inst.refresh()                   // 외부 커맨드 후 렌더 동기화
 *   inst.destroy()                   // Phaser game 파괴
 *
 * opts: { width, height, gridSize, snap, snapSize, gizmoMode, mode,
 *         backgroundColor, onCommand(cmd,undoDelta), onSelectionChange(ids) }
 * ==========================================================================*/
(function (global) {
  'use strict';

  // ── 헤드리스 가드 ───────────────────────────────────────────────────────────
  // window/Phaser 가 없으면(Node require) 본체를 실행하지 않고 정의만 노출한다.
  // 셸·테스트가 require 해도 throw 가 나지 않도록. 어댑터 본체는 브라우저에서만.
  var HAS_DOM = (typeof window !== 'undefined') && (typeof document !== 'undefined');

  // SceneKit 핸들 해석(브라우저 전역 또는 Node require).
  function resolveSceneKit() {
    if (global && global.SceneKit) return global.SceneKit;
    if (typeof require === 'function') {
      try { return require('./scenekit.js'); } catch (e) { /* 폴백 */ }
    }
    return null;
  }

  // ── 결정적 색상 — 자산 id → 색 (Math.random 금지) ───────────────────────────
  // FNV-1a 해시로 hue 를 정해 같은 id 는 항상 같은 색(결정적 플레이스홀더).
  function hashHue(s) {
    var h = 2166136261 >>> 0;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) % 360;
  }
  function hslToInt(hDeg, s, l) {
    // h:0..360, s:0..1, l:0..1 → 0xRRGGBB. 결정적.
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var hp = hDeg / 60;
    var x = c * (1 - Math.abs((hp % 2) - 1));
    var r = 0, g = 0, b = 0;
    if (hp >= 0 && hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    var m = l - c / 2;
    var R = Math.round((r + m) * 255), G = Math.round((g + m) * 255), B = Math.round((b + m) * 255);
    return (R << 16) | (G << 8) | B;
  }

  // ── 어댑터 본체(브라우저) ───────────────────────────────────────────────────
  // create(parentEl, sceneDoc, opts) → inst.
  function create(parentEl, sceneDoc, opts) {
    if (!HAS_DOM || typeof Phaser === 'undefined') {
      return createUnavailable('Phaser/DOM 미존재 — 어댑터는 브라우저에서만 동작합니다.');
    }
    var SceneKit = resolveSceneKit();
    if (!SceneKit) return createUnavailable('SceneKit 코어가 로드되지 않았습니다.');

    opts = opts || {};
    var initialMode = (opts.mode === 'play') ? 'play' : 'edit';

    // 상태 컨테이너(클로저). EditorScene 이 채운다.
    var state = {
      SceneKit: SceneKit,
      sceneDoc: sceneDoc,
      world: null,
      mode: initialMode,
      selection: [],                  // 선택된 엔티티 id 배열
      snap: opts.snap === true,
      snapSize: num(opts.snapSize, num(opts.gridSize, 16)),
      gridSize: num(opts.gridSize, 16),
      gizmoMode: validGizmo(opts.gizmoMode),
      onCommandCb: (typeof opts.onCommand === 'function') ? opts.onCommand : null,
      selectionListeners: []
    };
    if (typeof opts.onSelectionChange === 'function') state.selectionListeners.push(opts.onSelectionChange);

    var viewW = num(opts.width, metaViewportW(sceneDoc, 320));
    var viewH = num(opts.height, metaViewportH(sceneDoc, 240));
    var bg = (opts.backgroundColor != null) ? opts.backgroundColor : '#1b1f2a';

    var sceneRef = { scene: null };   // EditorScene 인스턴스(create 후 채워짐)

    var game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentEl,
      width: viewW,
      height: viewH,
      backgroundColor: bg,
      pixelArt: !!metaPixelArt(sceneDoc),
      scale: { mode: Phaser.Scale.NONE },
      scene: makeEditorScene(state, sceneRef, viewW, viewH)
    });

    // ── 인스턴스 API ──────────────────────────────────────────────────────────
    var inst = {
      _state: state,
      _game: game,
      getWorld: function () { return state.world; },
      serialize: function () { return state.world ? SceneKit.serialize(state.world) : null; },
      hashState: function () { return state.world ? SceneKit.hashState(state.world) : null; },
      getSelection: function () { return state.selection.slice(); },
      select: function (ids) {
        if (sceneRef.scene) sceneRef.scene.setSelection(ids);
        else state.selection = normIds(ids);
      },
      onSelectionChange: function (cb) {
        if (typeof cb !== 'function') return function () {};
        state.selectionListeners.push(cb);
        return function () {
          var i = state.selectionListeners.indexOf(cb);
          if (i >= 0) state.selectionListeners.splice(i, 1);
        };
      },
      applyCommand: function (cmd) {
        var undoDelta = SceneKit.applyCommand(state.world, cmd);
        if (sceneRef.scene) sceneRef.scene.syncFromWorld();
        emitCommand(state, cmd, undoDelta);
        return undoDelta;
      },
      applyUndo: function (undoDelta) {
        SceneKit.applyUndo(state.world, undoDelta);
        if (sceneRef.scene) sceneRef.scene.syncFromWorld();
      },
      setSnap: function (on, size) {
        state.snap = !!on;
        if (size != null) state.snapSize = Math.max(1, num(size, state.snapSize));
      },
      setGizmoMode: function (m) {
        state.gizmoMode = validGizmo(m);
        if (sceneRef.scene) sceneRef.scene.refreshGizmo();
      },
      getGizmoMode: function () { return state.gizmoMode; },
      setMode: function (m) {
        state.mode = (m === 'play') ? 'play' : 'edit';
        if (sceneRef.scene) sceneRef.scene.applyModeChange();
      },
      getMode: function () { return state.mode; },
      reload: function (newDoc) {
        if (sceneRef.scene) sceneRef.scene.reloadScene(newDoc);
      },
      refresh: function () {
        if (sceneRef.scene) sceneRef.scene.syncFromWorld();
      },
      destroy: function () {
        try { game.destroy(true); } catch (e) { /* 무시 */ }
        sceneRef.scene = null;
        state.world = null;
      }
    };
    return inst;
  }

  // ── 사용 불가 폴백 인스턴스(헤드리스/오류) ──────────────────────────────────
  function createUnavailable(reason) {
    function err() { throw new Error('[SceneKitPhaser] ' + reason); }
    return {
      _unavailable: true,
      _reason: reason,
      getWorld: function () { return null; },
      serialize: function () { return null; },
      hashState: function () { return null; },
      getSelection: function () { return []; },
      select: function () {}, onSelectionChange: function () { return function () {}; },
      applyCommand: err, applyUndo: err,
      setSnap: function () {}, setGizmoMode: function () {}, getGizmoMode: function () { return 'move'; },
      setMode: function () {}, getMode: function () { return 'edit'; },
      reload: function () {}, refresh: function () {}, destroy: function () {}
    };
  }

  // ── EditorScene 팩토리 ──────────────────────────────────────────────────────
  // Phaser 가 있을 때만 호출된다(create 가드 통과 후).
  function makeEditorScene(state, sceneRef, viewW, viewH) {
    var SceneKit = state.SceneKit;

    return {
      key: 'WGFEditorScene',

      create: function () {
        var scene = this;
        sceneRef.scene = bindSceneMethods(scene, state, SceneKit, viewW, viewH);
        scene._wgf = sceneRef.scene;
        sceneRef.scene._init();
      },

      update: function (_time, deltaMs) {
        if (scene_wgf(this)) scene_wgf(this)._update(deltaMs);
      }
    };
  }
  function scene_wgf(scene) { return scene._wgf; }

  // EditorScene 인스턴스에 메서드 묶음을 바인딩(클로저로 state 캡처).
  function bindSceneMethods(scene, state, SceneKit, viewW, viewH) {
    var api = {};

    // 렌더 객체 캐시.
    var spriteByEntity = {};        // entityId → Phaser GameObject(스프라이트/그래픽)
    var outlineByEntity = {};       // entityId → 선택 아웃라인 Graphics
    var gridGfx = null;             // 그리드 배경
    var wallGfx = null;             // 벽 표시
    var gizmoGfx = null;            // 기즈모 핸들
    var marqueeGfx = null;          // 마키(드래그 박스)
    var bakedTextures = {};         // 자산 id → 베이크된 텍스처 key(중복 방지)
    var placeholderKeys = {};       // 플레이스홀더 텍스처 key 캐시

    // 드래그 상태(coalesce — 드롭 시 단일 커맨드).
    var drag = null;                // { kind:'gizmo-move'|'gizmo-rotate'|'gizmo-scale'|'marquee', ... }

    // ── 초기화 ────────────────────────────────────────────────────────────────
    api._init = function () {
      // 씬 입력 활성.
      scene.input.mouse && scene.input.mouse.disableContextMenu && scene.input.mouse.disableContextMenu();

      gridGfx = scene.add.graphics().setDepth(-1000);
      wallGfx = scene.add.graphics().setDepth(-500);
      marqueeGfx = scene.add.graphics().setDepth(9000);
      gizmoGfx = scene.add.graphics().setDepth(10000);

      loadWorld(state.sceneDoc, state.mode);
      drawGrid();
      drawWalls();
      buildAllEntities();
      refreshGizmo();

      // 빈 영역 클릭 = 마키 시작 / 선택 해제.
      scene.input.on('pointerdown', onPointerDown);
      scene.input.on('pointermove', onPointerMove);
      scene.input.on('pointerup', onPointerUp);

      // GAME_INPUT 키보드 브리지(play 프리뷰 대비). edit 에선 step 안 하므로 무영향.
      installInputBridge();
    };

    // ── world 로드 ──────────────────────────────────────────────────────────────
    function loadWorld(doc, mode) {
      state.sceneDoc = doc;
      state.world = SceneKit.load(doc, { mode: mode });
    }

    // ── 좌표 변환 — 코어 좌표(씬 px)는 그대로 화면 px 로 매핑(1:1, 원점 좌상단) ──
    function toScreenX(x) { return x; }
    function toScreenY(y) { return y; }
    function toWorldX(sx) { return sx; }
    function toWorldY(sy) { return sy; }

    // ── 그리드 배경 ─────────────────────────────────────────────────────────────
    function drawGrid() {
      gridGfx.clear();
      var g = Math.max(2, state.gridSize | 0);
      gridGfx.lineStyle(1, 0x2a3242, 0.6);
      for (var x = 0; x <= viewW; x += g) gridGfx.lineBetween(x, 0, x, viewH);
      for (var y = 0; y <= viewH; y += g) gridGfx.lineBetween(0, y, viewW, y);
      // 원점 강조.
      gridGfx.lineStyle(1, 0x3d4a63, 0.9);
      gridGfx.lineBetween(0, 0, viewW, 0);
      gridGfx.lineBetween(0, 0, 0, viewH);
    }

    // ── 벽(정적 충돌) 표시 ──────────────────────────────────────────────────────
    function drawWalls() {
      wallGfx.clear();
      var walls = (state.world && state.world.walls) || [];
      wallGfx.fillStyle(0x39435c, 0.55);
      wallGfx.lineStyle(1, 0x5a6a8c, 0.9);
      for (var i = 0; i < walls.length; i++) {
        var w = walls[i];
        wallGfx.fillRect(toScreenX(w.x), toScreenY(w.y), Math.max(0, w.w), Math.max(0, w.h));
        wallGfx.strokeRect(toScreenX(w.x) + 0.5, toScreenY(w.y) + 0.5, Math.max(0, w.w) - 1, Math.max(0, w.h) - 1);
      }
    }

    // ── 자산 텍스처 baking — PixelForge/VectorForge, 없으면 결정적 플레이스홀더 ──
    // 같은 자산 id 는 1회만 bake(중복 방지). 반환 = 텍스처 key.
    function bakeAsset(spriteId) {
      if (spriteId == null) return placeholderTexture('__none', 16, 16);
      if (bakedTextures[spriteId]) return bakedTextures[spriteId];

      var def = findAssetDef(spriteId);
      var w = def && num(def.w, 0) > 0 ? num(def.w, 16) : 16;
      var h = def && num(def.h, 0) > 0 ? num(def.h, 16) : 16;
      var texKey = 'wgf_asset_' + spriteId;

      // 절차 자산: PixelForge/VectorForge 의 결정적 플레이스홀더 도형으로 bake.
      // (스프라이트 데이터(frames/그리드)는 아직 scene.json 에 없으므로 결정적 도형.)
      var baked = false;
      try {
        if (def && def.source === 'procedural') {
          baked = bakeProcedural(texKey, spriteId, w, h, !!metaPixelArt(state.sceneDoc));
        }
      } catch (e) { baked = false; }

      if (!baked) {
        texKey = placeholderTexture(spriteId, w, h);
      }
      bakedTextures[spriteId] = texKey;
      return texKey;
    }

    // 절차 자산 bake: pixelArt 면 PixelForge 패턴, 아니면 VectorForge 의 부드러운 도형.
    // 도형은 id 해시 색으로 결정적. 실패 시 false → 호출자가 플레이스홀더로 폴백.
    function bakeProcedural(texKey, spriteId, w, h, pixel) {
      if (scene.textures.exists(texKey)) return true;
      var hue = hashHue(spriteId);
      var fill = hslToInt(hue, 0.6, 0.55);
      var edge = hslToInt(hue, 0.65, 0.35);

      if (!pixel && typeof VectorForge !== 'undefined' && VectorForge.bake) {
        VectorForge.bake(scene, texKey, {
          w: w, h: h, ss: 2,
          draw: function (ctx, cw, ch) {
            ctx.fillStyle = hex(fill);
            ctx.strokeStyle = hex(edge);
            ctx.lineWidth = 1;
            // 둥근 도형(결정적). 자산 형태가 미정이라 통일 도형 + 색만 구분.
            var r = Math.min(cw, ch) * 0.3;
            roundRect(ctx, 1, 1, cw - 2, ch - 2, r);
            ctx.fill(); ctx.stroke();
          }
        });
        return scene.textures.exists(texKey);
      }

      // pixelArt 경로: Phaser graphics 로 결정적 사각/원 텍스처 생성(PixelForge 의
      // 문자그리드 데이터가 없으므로 직접 그린다 — 입력 고정 = 결정적).
      return drawShapeTexture(texKey, w, h, fill, edge, true);
    }

    // 플레이스홀더 텍스처: 자산 def 없음/비절차/bake 실패 시. 결정적 회색조 + id 색.
    function placeholderTexture(spriteId, w, h) {
      var texKey = 'wgf_ph_' + spriteId + '_' + w + 'x' + h;
      if (placeholderKeys[texKey]) return texKey;
      if (scene.textures.exists(texKey)) { placeholderKeys[texKey] = true; return texKey; }
      var hue = hashHue(spriteId);
      var fill = hslToInt(hue, 0.45, 0.5);
      var edge = 0xffffff;
      drawShapeTexture(texKey, w, h, fill, edge, false);
      placeholderKeys[texKey] = true;
      return texKey;
    }

    // Phaser Graphics → generateTexture 로 결정적 도형 텍스처 굽기.
    function drawShapeTexture(texKey, w, h, fill, edge, solid) {
      if (scene.textures.exists(texKey)) return true;
      var g = scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(fill, 1);
      g.fillRect(0, 0, w, h);
      g.lineStyle(1, edge, solid ? 1 : 0.85);
      g.strokeRect(0.5, 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
      // 식별용 대각선(결정적).
      g.lineStyle(1, edge, 0.35);
      g.lineBetween(0, 0, w, h);
      g.generateTexture(texKey, w, h);
      g.destroy();
      return scene.textures.exists(texKey);
    }

    // 자산 def 조회(world.assets.sprites 우선).
    function findAssetDef(spriteId) {
      var sprites = (state.world && state.world.assets && state.world.assets.sprites) || [];
      for (var i = 0; i < sprites.length; i++) if (sprites[i].id === spriteId) return sprites[i];
      return null;
    }

    // ── 엔티티 렌더 객체 생성/갱신 ──────────────────────────────────────────────
    function buildAllEntities() {
      // 기존 객체 파괴.
      var k;
      for (k in spriteByEntity) if (spriteByEntity[k]) spriteByEntity[k].destroy();
      for (k in outlineByEntity) if (outlineByEntity[k]) outlineByEntity[k].destroy();
      spriteByEntity = {};
      outlineByEntity = {};

      var ents = state.world.entities;
      for (var i = 0; i < ents.length; i++) buildEntity(ents[i]);
    }

    function buildEntity(ent) {
      var spriteComp = SceneKit.getComponentOn(ent, 'Sprite') || SceneKit.getComponentOn(ent, 'AnimatedSprite');
      var go;
      if (spriteComp && spriteComp.sprite) {
        var texKey = bakeAsset(spriteComp.sprite);
        // AnimatedSprite 는 t=0=프레임0. edit 에선 정적 프레임0 표시.
        go = scene.add.image(0, 0, texKey, 0);
      } else {
        // Sprite 없는 엔티티: Body 크기 또는 기본 점 마커.
        go = makeMarker(ent);
      }
      go.setData('entityId', ent.id);
      go.setInteractive({ useHandCursor: true });   // 드래그는 직접 포인터 이벤트로 처리.
      spriteByEntity[ent.id] = go;
      syncEntityTransform(ent);
    }

    // Sprite 없는 엔티티 마커(Body 윤곽 또는 작은 다이아몬드).
    function makeMarker(ent) {
      var body = SceneKit.getComponentOn(ent, 'Body');
      var key;
      if (body && body.shape === 'circle') {
        key = '__wgf_marker_circle_' + Math.max(2, num(body.radius, 8) | 0);
        if (!scene.textures.exists(key)) {
          var r = Math.max(2, num(body.radius, 8) | 0);
          var g = scene.make.graphics({ add: false });
          g.lineStyle(1, 0x8fb4ff, 0.9); g.strokeCircle(r, r, r - 0.5);
          g.generateTexture(key, r * 2, r * 2); g.destroy();
        }
      } else if (body) {
        var bw = Math.max(2, num(body.w, 16) | 0), bh = Math.max(2, num(body.h, 16) | 0);
        key = '__wgf_marker_box_' + bw + 'x' + bh;
        if (!scene.textures.exists(key)) {
          var g2 = scene.make.graphics({ add: false });
          g2.lineStyle(1, 0x8fb4ff, 0.9); g2.strokeRect(0.5, 0.5, bw - 1, bh - 1);
          g2.generateTexture(key, bw, bh); g2.destroy();
        }
      } else {
        key = '__wgf_marker_dot';
        if (!scene.textures.exists(key)) {
          var g3 = scene.make.graphics({ add: false });
          g3.fillStyle(0xffcc55, 1); g3.fillCircle(4, 4, 3);
          g3.generateTexture(key, 8, 8); g3.destroy();
        }
      }
      return scene.add.image(0, 0, key);
    }

    // 엔티티 트랜스폼 → 렌더 객체 적용(코어 → 뷰. 절대 역방향 금지).
    function syncEntityTransform(ent) {
      var go = spriteByEntity[ent.id];
      if (!go) return;
      var t = ent.transform;
      go.setPosition(toScreenX(num(t.x, 0)), toScreenY(num(t.y, 0)));
      go.setRotation(num(t.rotation, 0));
      go.setScale(num(t.scaleX, 1), num(t.scaleY, 1));
      go.setDepth(num(t.depth, 0));
      go.setOrigin(0.5, 0.5);
    }

    // ── world → 렌더 동기화(엔티티 추가/삭제/변경 반영) ──────────────────────────
    api.syncFromWorld = function () {
      var ents = state.world.entities;
      var liveIds = {};
      var i;
      for (i = 0; i < ents.length; i++) {
        var ent = ents[i];
        liveIds[ent.id] = true;
        if (!spriteByEntity[ent.id]) buildEntity(ent);
        else syncEntityTransform(ent);
      }
      // 사라진 엔티티 객체 제거.
      var k;
      for (k in spriteByEntity) {
        if (!liveIds[k]) {
          if (spriteByEntity[k]) spriteByEntity[k].destroy();
          delete spriteByEntity[k];
          if (outlineByEntity[k]) { outlineByEntity[k].destroy(); delete outlineByEntity[k]; }
        }
      }
      // 선택에서 사라진 id 정리.
      var keep = [];
      for (i = 0; i < state.selection.length; i++) if (liveIds[state.selection[i]]) keep.push(state.selection[i]);
      if (keep.length !== state.selection.length) setSelectionInternal(keep);
      drawWalls();
      refreshOutlines();
      refreshGizmo();
    };

    // ── 선택 ────────────────────────────────────────────────────────────────────
    api.setSelection = function (ids) { setSelectionInternal(normIds(ids)); };

    function setSelectionInternal(ids) {
      state.selection = ids.slice();
      refreshOutlines();
      refreshGizmo();
      notifySelection(state);
    }

    function refreshOutlines() {
      var k;
      for (k in outlineByEntity) { if (outlineByEntity[k]) outlineByEntity[k].destroy(); }
      outlineByEntity = {};
      for (var i = 0; i < state.selection.length; i++) {
        var id = state.selection[i];
        var go = spriteByEntity[id];
        if (!go) continue;
        var ol = scene.add.graphics().setDepth(8000);
        var bw = (go.displayWidth || 16), bh = (go.displayHeight || 16);
        ol.lineStyle(1.5, 0xffd23f, 1);
        ol.strokeRect(go.x - bw / 2 - 2, go.y - bh / 2 - 2, bw + 4, bh + 4);
        outlineByEntity[id] = ol;
      }
    }

    // ── 기즈모 ────────────────────────────────────────────────────────────────
    // 선택 중심에 기즈모 핸들 그림. move=십자 화살표, rotate=원, scale=각진 핸들.
    api.refreshGizmo = function () { refreshGizmo(); };
    function refreshGizmo() {
      gizmoGfx.clear();
      if (state.mode === 'play') return;
      if (state.selection.length === 0) return;
      var c = selectionCenter();
      if (!c) return;
      var mode = state.gizmoMode;
      if (mode === 'move') {
        gizmoGfx.lineStyle(2, 0x4fd0ff, 1);
        gizmoGfx.lineBetween(c.x, c.y, c.x + 26, c.y);     // +x
        gizmoGfx.lineBetween(c.x, c.y, c.x, c.y - 26);     // -y(위)
        gizmoGfx.fillStyle(0x4fd0ff, 1);
        gizmoGfx.fillTriangle(c.x + 26, c.y - 4, c.x + 26, c.y + 4, c.x + 34, c.y);
        gizmoGfx.fillTriangle(c.x - 4, c.y - 26, c.x + 4, c.y - 26, c.x, c.y - 34);
        gizmoGfx.fillStyle(0xffffff, 1);
        gizmoGfx.fillRect(c.x - 3, c.y - 3, 6, 6);          // 중심 핸들(자유 이동)
      } else if (mode === 'rotate') {
        gizmoGfx.lineStyle(2, 0x9bff8f, 1);
        gizmoGfx.strokeCircle(c.x, c.y, 28);
        gizmoGfx.fillStyle(0x9bff8f, 1);
        gizmoGfx.fillCircle(c.x + 28, c.y, 4);              // 회전 핸들
      } else { // scale
        gizmoGfx.lineStyle(2, 0xff9b6b, 1);
        gizmoGfx.strokeRect(c.x - 24, c.y - 24, 48, 48);
        gizmoGfx.fillStyle(0xff9b6b, 1);
        gizmoGfx.fillRect(c.x + 20, c.y + 20, 8, 8);        // 코너 스케일 핸들
      }
    }

    function selectionCenter() {
      if (state.selection.length === 0) return null;
      var sx = 0, sy = 0, n = 0;
      for (var i = 0; i < state.selection.length; i++) {
        var ent = SceneKit.findEntity(state.world, state.selection[i]);
        if (!ent) continue;
        sx += num(ent.transform.x, 0); sy += num(ent.transform.y, 0); n++;
      }
      if (n === 0) return null;
      return { x: toScreenX(sx / n), y: toScreenY(sy / n) };
    }

    // ── 입력: 포인터 드래그/마키/선택 ──────────────────────────────────────────
    function onPointerDown(pointer) {
      if (state.mode === 'play') return;     // play 중에는 편집 입력 무시.
      var wx = toWorldX(pointer.x), wy = toWorldY(pointer.y);
      var hit = pickEntity(pointer.x, pointer.y);

      // 기즈모 핸들 위 드래그 시작 판정(선택 중일 때).
      if (state.selection.length > 0) {
        var c = selectionCenter();
        if (c) {
          var gz = gizmoHitTest(pointer.x, pointer.y, c);
          if (gz) {
            beginGizmoDrag(gz, wx, wy);
            return;
          }
        }
      }

      if (hit) {
        // shift = 토글 추가, 아니면 단일 선택.
        var additive = pointer.event && (pointer.event.shiftKey || pointer.event.ctrlKey);
        if (additive) {
          var idx = state.selection.indexOf(hit);
          var next = state.selection.slice();
          if (idx >= 0) next.splice(idx, 1); else next.push(hit);
          setSelectionInternal(next);
        } else if (state.selection.indexOf(hit) < 0) {
          setSelectionInternal([hit]);
        }
        // 엔티티 본체 드래그 = 이동(기즈모 move 와 동일 의미).
        beginGizmoDrag({ kind: 'gizmo-move' }, wx, wy);
        return;
      }

      // 빈 영역 → 마키 시작.
      drag = { kind: 'marquee', x0: pointer.x, y0: pointer.y, x1: pointer.x, y1: pointer.y,
               additive: !!(pointer.event && (pointer.event.shiftKey || pointer.event.ctrlKey)) };
    }

    function beginGizmoDrag(gz, wx, wy) {
      // 선택 엔티티들의 시작 트랜스폼 스냅샷(드롭 시 단일 커맨드).
      var starts = {};
      var center = { x: 0, y: 0, n: 0 };
      for (var i = 0; i < state.selection.length; i++) {
        var ent = SceneKit.findEntity(state.world, state.selection[i]);
        if (!ent) continue;
        starts[ent.id] = {
          x: num(ent.transform.x, 0), y: num(ent.transform.y, 0),
          rotation: num(ent.transform.rotation, 0),
          scaleX: num(ent.transform.scaleX, 1), scaleY: num(ent.transform.scaleY, 1)
        };
        center.x += starts[ent.id].x; center.y += starts[ent.id].y; center.n++;
      }
      if (center.n > 0) { center.x /= center.n; center.y /= center.n; }
      drag = { kind: gz.kind, startWX: wx, startWY: wy, starts: starts, center: center, moved: false };
    }

    function onPointerMove(pointer) {
      if (!drag) return;
      if (drag.kind === 'marquee') {
        drag.x1 = pointer.x; drag.y1 = pointer.y;
        drawMarquee();
        return;
      }
      var wx = toWorldX(pointer.x), wy = toWorldY(pointer.y);
      var dx = wx - drag.startWX, dy = wy - drag.startWY;
      drag.moved = true;
      // 라이브 프리뷰: 코어를 직접 안 건드리고 렌더 객체만 미리 옮긴다(드롭 시 커맨드).
      previewDrag(dx, dy);
    }

    // 드래그 라이브 프리뷰(렌더만 — 코어 미변경). 드롭 시 단일 커맨드로 확정.
    function previewDrag(dx, dy) {
      for (var i = 0; i < state.selection.length; i++) {
        var id = state.selection[i];
        var st = drag.starts[id];
        var go = spriteByEntity[id];
        if (!st || !go) continue;
        if (drag.kind === 'gizmo-move') {
          var nx = st.x + dx, ny = st.y + dy;
          if (state.snap) { nx = snapTo(nx); ny = snapTo(ny); }
          go.setPosition(toScreenX(nx), toScreenY(ny));
        } else if (drag.kind === 'gizmo-rotate') {
          var a0 = Math.atan2(st.y - drag.center.y, st.x - drag.center.x);
          var aN = Math.atan2((drag.startWY + dy) - drag.center.y, (drag.startWX + dx) - drag.center.x);
          go.setRotation(st.rotation + (aN - a0));
        } else if (drag.kind === 'gizmo-scale') {
          var factor = 1 + (dx + dy) / 100;
          if (factor < 0.05) factor = 0.05;
          go.setScale(st.scaleX * factor, st.scaleY * factor);
        }
      }
      refreshOutlines();
      // 기즈모는 이동 중에는 중심 따라가게(move 만).
      if (drag.kind === 'gizmo-move') {
        gizmoGfx.clear();
        var c = { x: toScreenX(drag.center.x + dx), y: toScreenY(drag.center.y + dy) };
        gizmoGfx.lineStyle(2, 0x4fd0ff, 0.6);
        gizmoGfx.lineBetween(c.x, c.y, c.x + 26, c.y);
        gizmoGfx.lineBetween(c.x, c.y, c.x, c.y - 26);
      }
    }

    function onPointerUp(pointer) {
      if (!drag) return;
      if (drag.kind === 'marquee') {
        // 드롭 좌표로 박스 끝점 갱신(pointermove 누락/단발 드래그 견고성).
        drag.x1 = pointer.x; drag.y1 = pointer.y;
        commitMarquee();
        marqueeGfx.clear();
        drag = null;
        return;
      }
      // 기즈모 드롭 → 선택 엔티티마다 단일 setTransform 커맨드(coalesced).
      if (drag.moved) commitGizmoDrag(pointer);
      drag = null;
      api.syncFromWorld();      // 코어 기준으로 렌더 재동기(프리뷰 정합).
    }

    function commitGizmoDrag(pointer) {
      var wx = toWorldX(pointer.x), wy = toWorldY(pointer.y);
      var dx = wx - drag.startWX, dy = wy - drag.startWY;
      for (var i = 0; i < state.selection.length; i++) {
        var id = state.selection[i];
        var st = drag.starts[id];
        if (!st) continue;
        var patch = null;
        if (drag.kind === 'gizmo-move') {
          var nx = st.x + dx, ny = st.y + dy;
          if (state.snap) { nx = snapTo(nx); ny = snapTo(ny); }
          patch = { x: nx, y: ny };
        } else if (drag.kind === 'gizmo-rotate') {
          var a0 = Math.atan2(st.y - drag.center.y, st.x - drag.center.x);
          var aN = Math.atan2(wy - drag.center.y, wx - drag.center.x);
          patch = { rotation: st.rotation + (aN - a0) };
        } else if (drag.kind === 'gizmo-scale') {
          var factor = 1 + (dx + dy) / 100;
          if (factor < 0.05) factor = 0.05;
          patch = { scaleX: st.scaleX * factor, scaleY: st.scaleY * factor };
        }
        if (patch) {
          var cmd = { type: 'setTransform', id: id, transform: patch };
          var undoDelta = SceneKit.applyCommand(state.world, cmd);
          emitCommand(state, cmd, undoDelta);
        }
      }
    }

    function drawMarquee() {
      marqueeGfx.clear();
      var x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
      var w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
      marqueeGfx.fillStyle(0x4fd0ff, 0.12);
      marqueeGfx.fillRect(x, y, w, h);
      marqueeGfx.lineStyle(1, 0x4fd0ff, 0.9);
      marqueeGfx.strokeRect(x, y, w, h);
    }

    function commitMarquee() {
      var x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
      var w = Math.abs(drag.x1 - drag.x0), h = Math.abs(drag.y1 - drag.y0);
      // 클릭(거의 안 움직임)이면 선택 해제.
      if (w < 3 && h < 3) {
        if (!drag.additive) setSelectionInternal([]);
        return;
      }
      var inBox = [];
      var ents = state.world.entities;
      for (var i = 0; i < ents.length; i++) {
        var go = spriteByEntity[ents[i].id];
        if (!go) continue;
        if (go.x >= x && go.x <= x + w && go.y >= y && go.y <= y + h) inBox.push(ents[i].id);
      }
      if (drag.additive) {
        var merged = state.selection.slice();
        for (var j = 0; j < inBox.length; j++) if (merged.indexOf(inBox[j]) < 0) merged.push(inBox[j]);
        setSelectionInternal(merged);
      } else {
        setSelectionInternal(inBox);
      }
    }

    // 포인터 위치에서 엔티티 1개 픽(depth 큰 것 우선 = 위에 그린 것).
    function pickEntity(sx, sy) {
      var best = null, bestDepth = -Infinity;
      var ents = state.world.entities;
      for (var i = 0; i < ents.length; i++) {
        var go = spriteByEntity[ents[i].id];
        if (!go) continue;
        var hw = (go.displayWidth || 16) / 2 + 2, hh = (go.displayHeight || 16) / 2 + 2;
        if (Math.abs(sx - go.x) <= hw && Math.abs(sy - go.y) <= hh) {
          var d = go.depth;
          if (d >= bestDepth) { bestDepth = d; best = ents[i].id; }
        }
      }
      return best;
    }

    // 기즈모 핸들 히트테스트(중심 c 기준). 어떤 드래그 종류인지 반환.
    function gizmoHitTest(sx, sy, c) {
      var mode = state.gizmoMode;
      var d = Math.sqrt((sx - c.x) * (sx - c.x) + (sy - c.y) * (sy - c.y));
      if (mode === 'move') {
        // 중심 사각/축 화살표 근처면 이동.
        if (d <= 36) return { kind: 'gizmo-move' };
      } else if (mode === 'rotate') {
        if (d >= 22 && d <= 36) return { kind: 'gizmo-rotate' };
      } else { // scale
        if (Math.abs(sx - (c.x + 24)) <= 10 && Math.abs(sy - (c.y + 24)) <= 10) return { kind: 'gizmo-scale' };
        if (d <= 28) return { kind: 'gizmo-scale' };
      }
      return null;
    }

    function snapTo(v) {
      var s = Math.max(1, state.snapSize);
      return Math.round(v / s) * s;
    }

    // ── mode / reload ───────────────────────────────────────────────────────────
    api.applyModeChange = function () {
      // edit ↔ play 전환. play 진입 시 현재 직렬화로 play world 재로드(휘발 상태).
      // edit 복귀 시 보관된 sceneDoc 로 재로드(play 변경 폐기 — 유니티 모델 §4.9).
      if (state.mode === 'play') {
        state._editDoc = SceneKit.serialize(state.world);
        loadWorld(state._editDoc, 'play');
      } else {
        var doc = state._editDoc || state.sceneDoc;
        loadWorld(doc, 'edit');
      }
      buildAllEntities();
      refreshOutlines();
      refreshGizmo();
    };

    api.reloadScene = function (newDoc) {
      if (newDoc) state.sceneDoc = newDoc;
      state.selection = [];
      bakedTextures = {};   // 새 자산 셋 다시 bake.
      loadWorld(state.sceneDoc, state.mode);
      drawGrid();
      drawWalls();
      buildAllEntities();
      refreshOutlines();
      refreshGizmo();
      notifySelection(state);
    };

    // ── update(play 모드만 코어 step) ──────────────────────────────────────────
    api._update = function (deltaMs) {
      if (state.mode === 'play' && state.world) {
        var dt = deltaMs / 1000;
        if (dt > 0 && dt < 0.1) {           // dt 가드(탭 비활성 큰 점프 방지)
          SceneKit.step(state.world, dt);
          var ents = state.world.entities;
          for (var i = 0; i < ents.length; i++) {
            if (!spriteByEntity[ents[i].id]) buildEntity(ents[i]);
            else syncEntityTransform(ents[i]);
          }
          // play 중 사라진 엔티티 정리.
          var live = {};
          for (i = 0; i < ents.length; i++) live[ents[i].id] = true;
          for (var k in spriteByEntity) {
            if (!live[k]) { spriteByEntity[k].destroy(); delete spriteByEntity[k]; }
          }
        }
      }
    };

    // ── GAME_INPUT 키보드 브리지 ────────────────────────────────────────────────
    function installInputBridge() {
      if (typeof window === 'undefined') return;
      if (!window.GAME_INPUT) window.GAME_INPUT = { up: false, down: false, left: false, right: false };
      var GI = window.GAME_INPUT;
      var keys = scene.input.keyboard;
      if (!keys) return;
      var map = scene.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D,
        upArrow: Phaser.Input.Keyboard.KeyCodes.UP, downArrow: Phaser.Input.Keyboard.KeyCodes.DOWN,
        leftArrow: Phaser.Input.Keyboard.KeyCodes.LEFT, rightArrow: Phaser.Input.Keyboard.KeyCodes.RIGHT
      });
      scene.events.on('update', function () {
        // edit 모드에선 GAME_INPUT 을 false 로 유지(코어 step 안 하므로 무영향이지만 정합).
        GI.up = !!(map.up.isDown || map.upArrow.isDown) && state.mode === 'play';
        GI.down = !!(map.down.isDown || map.downArrow.isDown) && state.mode === 'play';
        GI.left = !!(map.left.isDown || map.leftArrow.isDown) && state.mode === 'play';
        GI.right = !!(map.right.isDown || map.rightArrow.isDown) && state.mode === 'play';
      });
    }

    return api;
  }

  // ── 공용 헬퍼 ───────────────────────────────────────────────────────────────
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function normIds(ids) {
    if (!Array.isArray(ids)) ids = (ids == null) ? [] : [ids];
    var out = [];
    for (var i = 0; i < ids.length; i++) { var s = String(ids[i]); if (out.indexOf(s) < 0) out.push(s); }
    return out;
  }
  function validGizmo(m) { return (m === 'rotate' || m === 'scale') ? m : 'move'; }
  function metaViewportW(doc, d) {
    return (doc && doc.meta && doc.meta.viewport && num(doc.meta.viewport.w, 0) > 0) ? num(doc.meta.viewport.w, d) : d;
  }
  function metaViewportH(doc, d) {
    return (doc && doc.meta && doc.meta.viewport && num(doc.meta.viewport.h, 0) > 0) ? num(doc.meta.viewport.h, d) : d;
  }
  function metaPixelArt(doc) { return !!(doc && doc.meta && doc.meta.pixelArt); }

  function emitCommand(state, cmd, undoDelta) {
    if (state.onCommandCb) {
      try { state.onCommandCb(cmd, undoDelta); } catch (e) { /* 셸 콜백 오류 격리 */ }
    }
  }
  function notifySelection(state) {
    var ids = state.selection.slice();
    for (var i = 0; i < state.selectionListeners.length; i++) {
      try { state.selectionListeners[i](ids); } catch (e) { /* 격리 */ }
    }
  }

  // canvas 2d 헬퍼(VectorForge draw 안에서 사용).
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function hex(n) {
    return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6);
  }

  // ── 네임스페이스 노출(양형) ─────────────────────────────────────────────────
  var SceneKitPhaser = {
    VERSION: '1.0.0',
    create: create,
    _hashHue: hashHue,        // 테스트용 순수 함수 노출
    _hslToInt: hslToInt
  };

  global.SceneKitPhaser = SceneKitPhaser;
  if (typeof module !== 'undefined' && module.exports) module.exports = SceneKitPhaser;
})(typeof window !== 'undefined' ? window : this);
