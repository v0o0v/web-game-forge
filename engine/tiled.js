/* ============================================================================
 * TiledForge — Tiled(.tmj) 맵 연동 엔진 (web-game-builder)
 * ----------------------------------------------------------------------------
 * WebGameForge의 "외부 파일 0 · 절차 생성 · CC0/IP-safe" 정체성을 유지한 채 Tiled
 * 맵 포맷(.tmj)을 들이는 런타임. 제공 기능:
 *
 *   1) bakeTileset(scene, tileDefs, opts)
 *      PixelForge 문자 그리드(또는 draw 콜백)로 타일셋 아틀라스를 *한 장의* 캔버스
 *      텍스처로 굽는다. 정적 타일은 1칸, **애니메이션 타일**은 프레임마다 연속 칸으로
 *      굽고 Tiled animation 배열을 메타로 반환한다(아래 §애니 계약).
 *
 *   2) loadTiledMap(scene, key, opts)
 *      캐시의 .tmj → 타일 레이어 빌드 + setCollisionByProperty + 오브젝트 레이어를
 *      게임이 등록한 스포너(spawners[type])로 위임. 직교(orthogonal)·등각(isometric)·
 *      육각(hexagonal)·스태거드(staggered) 전부 Phaser createLayer가 orientation으로
 *      자동 처리한다. opts.gpu=true면 TilemapGPULayer로 렌더(WebGL·직교 전용 — 가드).
 *
 *   3) assertPackLicense(policy, manifest)
 *      외부 CC0 Tiled 팩을 들일 때 루트 assets.json 의 정책으로 라이선스 게이트.
 *
 * ── 애니메이션 타일 GID 계약(베이커 ↔ 저작 도구 ↔ 문서 공유) ──────────────
 *   tileDefs를 순서대로 "칸(cell)"으로 펼친다. GID = 칸 index + 1(firstgid=1).
 *     · 정적 타일  { name, collides, frame|draw }            → 1칸
 *     · 애니 타일  { name, collides, animFrames:[...], animDuration|animDurations }
 *                                                            → animFrames.length 칸(연속)
 *   애니 타일의 GID는 첫 프레임 칸. embedded tileset 의 tiles[] 에 base 타일 id 로
 *   animation:[{tileid, duration}] 를 단다. Phaser 파서가 자동 재생(CPU·GPU 공통).
 *   → 저작 도구(ascii-to-tmj / bake-tiled-pack)도 **동일 펼침**으로 GID·animation 계산.
 *
 * 설계: docs/tiled-연동-설계.md.
 * ==========================================================================*/
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 타일 def 펼침 — GID 계약의 단일 소스(순수 함수).
  //   반환 { cells:[{frame?,draw?}], tiles:[{name,collides,baseCell,frameCount,
  //          animation?:[{tileid,duration}]}], nameToGid:{name:gid} }
  // ---------------------------------------------------------------------------
  function normalizeFrame(fr) {
    if (Array.isArray(fr)) return { frame: fr };                 // 문자 그리드 단축형
    if (fr && (fr.frame || fr.draw)) return { frame: fr.frame, draw: fr.draw };
    return { frame: fr };
  }
  function frameDurations(def, n) {
    var src = (def.animDurations && def.animDurations.length) ? def.animDurations
            : (def.anim && def.anim.durations && def.anim.durations.length) ? def.anim.durations
            : null;
    if (src) {
      var out = [];
      for (var i = 0; i < n; i++) out.push(src[i] != null ? src[i] : src[src.length - 1]);
      return out;
    }
    var d = def.animDuration || (def.anim && def.anim.duration) || 180;
    var arr = []; for (var j = 0; j < n; j++) arr.push(d); return arr;
  }
  // 애니 프레임 수: animFrames(아트) 우선, 없으면 anim.frames(개수만 — 저작 도구용).
  function animCountOf(def) {
    if (def.animFrames && def.animFrames.length) return def.animFrames.length;
    if (def.anim && def.anim.frames > 1) return def.anim.frames | 0;
    return 0;
  }
  function expandTileDefs(tileDefs) {
    var cells = [], tiles = [], nameToGid = {};
    (tileDefs || []).forEach(function (def) {
      var base = cells.length;
      var n = animCountOf(def);
      if (n > 1) {
        var durs = frameDurations(def, n);
        for (var k = 0; k < n; k++) cells.push(def.animFrames ? normalizeFrame(def.animFrames[k]) : {});
        var animation = [];
        for (var m = 0; m < n; m++) animation.push({ tileid: base + m, duration: durs[m] });
        tiles.push({ name: def.name, collides: !!def.collides, baseCell: base, frameCount: n, animation: animation });
      } else {
        cells.push({ frame: def.frame, draw: def.draw });
        tiles.push({ name: def.name, collides: !!def.collides, baseCell: base, frameCount: 1 });
      }
      nameToGid[def.name || ('tile' + (base + 1))] = base + 1;
    });
    return { cells: cells, tiles: tiles, nameToGid: nameToGid };
  }

  // ---------------------------------------------------------------------------
  // 유틸: 아틀라스 기하 (칸 개수 기반). columns 미지정 시 단일 행.
  // ---------------------------------------------------------------------------
  function geometryFor(cellCount, opts) {
    opts = opts || {};
    var tw = opts.tileWidth || opts.tileSize || 16;
    var th = opts.tileHeight || opts.tileSize || 16;
    var columns = opts.columns || cellCount || 1;
    if (columns < 1) columns = 1;
    var rows = Math.ceil(cellCount / columns);
    return {
      tileSize: tw, tileWidth: tw, tileHeight: th,
      tilewidth: tw, tileheight: th,
      columns: columns, tilecount: cellCount,
      imagewidth: columns * tw, imageheight: rows * th
    };
  }
  // 하위호환: 기존 시그니처(tileDefs, opts) 유지 — 펼친 칸 수로 계산.
  function tilesetGeometry(tileDefs, opts) {
    return geometryFor(expandTileDefs(tileDefs).cells.length, opts);
  }

  // ---------------------------------------------------------------------------
  // 1) bakeTileset — 타일셋 아틀라스를 절차 베이크해 텍스처로 등록
  //   tileDefs: [{ name, collides, frame?:["row",…], draw?:fn,
  //               animFrames?:[grid|{frame|draw}], animDuration?, animDurations? }]
  //   opts: { key, name?, tileSize=16, columns?, palette? }
  //   반환 meta: { key, name, tilewidth, tileheight, columns, tilecount,
  //               imagewidth, imageheight, collides:[bool/칸], names:[/칸],
  //               nameToGid:{}, animations:[{tileid,frames:[{tileid,duration}]}],
  //               tilesBlock:[{id,properties?,animation?}] }
  // ---------------------------------------------------------------------------
  function bakeTileset(scene, tileDefs, opts) {
    opts = opts || {};
    if (!tileDefs || !tileDefs.length) throw new Error('TiledForge.bakeTileset: tileDefs 비어있음');
    var key = opts.key || 'forge-tiles';
    var name = opts.name || 'forge';
    var palette = opts.palette || (global.PixelForge && global.PixelForge.PALETTE) || {};
    var ex = expandTileDefs(tileDefs);
    var geo = geometryFor(ex.cells.length, opts);
    var tw = geo.tileWidth, th = geo.tileHeight;

    var canvas = document.createElement('canvas');
    canvas.width = geo.imagewidth;
    canvas.height = geo.imageheight;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    var collides = [], names = [];
    // 칸 단위로 칠한다(정방형은 paintGrid, 비정방형/벡터 타일은 draw 콜백).
    ex.cells.forEach(function (cell, i) {
      var cx = (i % geo.columns) * tw;
      var cy = Math.floor(i / geo.columns) * th;
      if (typeof cell.draw === 'function') {
        ctx.save();
        cell.draw(ctx, cx, cy, tw, th, global.VectorForge);
        ctx.restore();
      } else if (cell.frame) {
        paintGrid(ctx, cell.frame, palette, cx, cy);
      }
    });
    // base 타일의 collides/animation 을 그 base 칸과 애니 프레임 칸 전체에 반영(렌더 무관, 메타용).
    var animations = [], tilesBlock = [];
    ex.tiles.forEach(function (t) {
      for (var k = 0; k < t.frameCount; k++) { collides[t.baseCell + k] = t.collides; names[t.baseCell + k] = t.name || ('tile' + (t.baseCell + k + 1)); }
      var entry = { id: t.baseCell };
      if (t.collides) entry.properties = [{ name: 'collides', type: 'bool', value: true }];
      if (t.animation) { entry.animation = t.animation; animations.push({ tileid: t.baseCell, frames: t.animation }); }
      if (entry.properties || entry.animation) tilesBlock.push(entry);
    });

    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);

    return {
      key: key, name: name,
      tilewidth: geo.tilewidth, tileheight: geo.tileheight,
      columns: geo.columns, tilecount: geo.tilecount,
      imagewidth: geo.imagewidth, imageheight: geo.imageheight,
      collides: collides, names: names, nameToGid: ex.nameToGid,
      animations: animations, tilesBlock: tilesBlock
    };
  }

  // 문자 그리드 한 프레임을 (ox,oy) 칸에 픽셀 단위로 칠한다(PixelForge와 동일 규약).
  function paintGrid(ctx, frame, palette, ox, oy) {
    for (var y = 0; y < frame.length; y++) {
      var row = frame[y];
      for (var x = 0; x < row.length; x++) {
        var col = palette[row.charAt(x)];
        if (!col) continue; // '.'/' '/미정의 = 투명
        ctx.fillStyle = col;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // embedded tileset 블록 생성 (Node 변환기와 동일 출력 — 문서 §4 계약).
  //   애니 타일 포함 시 tiles[] 에 animation 배열을 단다.
  // ---------------------------------------------------------------------------
  function buildTilesetBlock(tileDefs, opts) {
    opts = opts || {};
    var ex = expandTileDefs(tileDefs);
    var geo = geometryFor(ex.cells.length, opts);
    var name = opts.name || 'forge';
    var tiles = [];
    ex.tiles.forEach(function (t) {
      var entry = { id: t.baseCell };
      if (t.collides) entry.properties = [{ name: 'collides', type: 'bool', value: true }];
      if (t.animation) entry.animation = t.animation;
      if (entry.properties || entry.animation) tiles.push(entry);
    });
    return {
      firstgid: 1, name: name,
      tilewidth: geo.tilewidth, tileheight: geo.tileheight,
      tilecount: geo.tilecount, columns: geo.columns,
      margin: 0, spacing: 0,
      image: name + '-tileset.png',
      imagewidth: geo.imagewidth, imageheight: geo.imageheight,
      tiles: tiles
    };
  }

  // ---------------------------------------------------------------------------
  // 캐시 주입: 파싱된 Tiled JSON을 fetch 없이 tilemap 캐시에 넣는다.
  // ---------------------------------------------------------------------------
  function injectMap(scene, key, json) {
    var Formats = global.Phaser && global.Phaser.Tilemaps && global.Phaser.Tilemaps.Formats;
    var fmt = Formats ? Formats.TILED_JSON : 1;
    if (scene.cache.tilemap.exists(key)) scene.cache.tilemap.remove(key);
    scene.cache.tilemap.add(key, { format: fmt, data: json });
  }

  // ---------------------------------------------------------------------------
  // 프로퍼티 평탄화 / 오브젝트 type 결정.
  // ---------------------------------------------------------------------------
  // 외부(잠재적 비신뢰) .tmj 프로퍼티 평탄화 시 프로토타입 오염 방지 — 위험 키 차단.
  var UNSAFE_KEY = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };
  function flattenProps(p) {
    if (!p) return {};
    if (Array.isArray(p)) {
      var o = {};
      p.forEach(function (e) { if (e && e.name !== undefined && !UNSAFE_KEY[e.name]) o[e.name] = e.value; });
      return o;
    }
    return p;
  }
  function objType(obj, props) {
    return obj.type || obj.class || (props && props.type) || '';
  }

  // ---------------------------------------------------------------------------
  // WebGL 렌더러 여부(TilemapGPULayer 가드).
  // ---------------------------------------------------------------------------
  function isWebGL(scene) {
    var P = global.Phaser;
    var r = scene.sys && scene.sys.renderer;
    if (!r) return false;
    if (P && P.WEBGL !== undefined && r.type !== undefined) return r.type === P.WEBGL;
    // 폴백: WebGL 렌더러는 gl 컨텍스트를 가진다.
    return !!r.gl;
  }

  // Phaser 는 map.orientation 을 숫자 상수(Orientation enum)로 저장한다. 정규 문자열로 변환.
  function orientationName(map) {
    var o = map.orientation;
    if (typeof o === 'string') return o;
    var O = global.Phaser && global.Phaser.Tilemaps && global.Phaser.Tilemaps.Orientation;
    if (O) {
      if (o === O.ISOMETRIC) return 'isometric';
      if (o === O.STAGGERED) return 'staggered';
      if (o === O.HEXAGONAL) return 'hexagonal';
      return 'orthogonal';
    }
    return 'orthogonal'; // 폴백(상수 미가용)
  }

  // ---------------------------------------------------------------------------
  // 2) loadTiledMap — .tmj 로드 → 레이어/충돌 빌드 + 오브젝트 스폰 위임
  //   opts: {
  //     tilesetKey,                 // bakeTileset 텍스처 키 또는 외부 로드 이미지 키
  //     tilesetName?='forge',
  //     spawners?: { type: fn(scene, o) },
  //     solidLayers?: [name],
  //     gpu?=false,                 // TilemapGPULayer(WebGL·직교 전용; 위반 시 CPU 폴백)
  //     layerOffset?: {x,y},
  //     licenseGate?: { policy, manifest } // 외부 팩 라이선스 게이트(통과 못하면 throw)
  //   }
  //   반환: { map, layers, solids, tileset, objects, spawned, orientation, gpu, regenerate }
  // ---------------------------------------------------------------------------
  function loadTiledMap(scene, key, opts) {
    opts = opts || {};
    var tilesetName = opts.tilesetName || 'forge';
    var spawners = opts.spawners || {};
    var off = opts.layerOffset || { x: 0, y: 0 };

    // 외부 팩 라이선스 게이트 — 통과 못하면 로드 자체를 막는다.
    if (opts.licenseGate) {
      var g = assertPackLicense(opts.licenseGate.policy, opts.licenseGate.manifest);
      if (!g.allowed) throw new Error('TiledForge: 라이선스 게이트 거부 — ' + g.reason);
    }

    var map = scene.make.tilemap({ key: key });
    var tileset = map.addTilesetImage(tilesetName, opts.tilesetKey);
    if (!tileset) {
      throw new Error('TiledForge.loadTiledMap: addTilesetImage 실패 — .tmj tileset name("' +
        tilesetName + '")과 인자가 일치하는지, 타일셋 텍스처 키("' + opts.tilesetKey + '")가 등록됐는지 확인');
    }

    var orientation = orientationName(map);
    var wantGpu = !!opts.gpu;
    var useGpu = wantGpu;
    if (wantGpu) {
      if (orientation !== 'orthogonal') {
        useGpu = false;
        if (global.console) console.warn('TiledForge: TilemapGPULayer는 직교(orthogonal) 전용 — orientation="' + orientation + '"이라 CPU 레이어로 폴백.');
      } else if (!isWebGL(scene)) {
        useGpu = false;
        if (global.console) console.warn('TiledForge: TilemapGPULayer는 WebGL 전용 — Canvas 렌더러라 CPU 레이어로 폴백.');
      }
    }

    // --- 타일 레이어 빌드 + 충돌 ---
    var layers = {};
    var solids = [];
    var gpuLayers = [];
    var wantSolid = opts.solidLayers || null;
    map.layers.forEach(function (ld) {
      var layer = map.createLayer(ld.name, tileset, off.x, off.y, useGpu);
      if (!layer) return;
      layers[ld.name] = layer;
      if (useGpu) gpuLayers.push(layer);
      var makeSolid = wantSolid ? (wantSolid.indexOf(ld.name) >= 0) : true;
      if (makeSolid) {
        layer.setCollisionByProperty({ collides: true });
        solids.push(layer);
      }
    });

    // --- 오브젝트 레이어 → 스포너 위임 ---
    var objects = [], spawned = [];
    var objLayers = map.objects || [];
    objLayers.forEach(function (ol) {
      (ol.objects || []).forEach(function (raw) {
        var props = flattenProps(raw.properties);
        var type = objType(raw, props);
        var o = {
          x: raw.x, y: raw.y, type: type, name: raw.name || '',
          width: raw.width || 0, height: raw.height || 0,
          props: props, raw: raw, layer: ol.name
        };
        objects.push(o);
        var fn = spawners[type];
        if (typeof fn === 'function') {
          var r = fn(scene, o);
          if (r !== undefined && r !== null) spawned.push(r);
        } else if (type && opts.warnUnknown !== false && global.console) {
          console.warn('TiledForge: 스포너 미등록 type="' + type + '" (오브젝트 무시)');
        }
      });
    });

    // GPU 레이어 편집 후엔 데이터 텍스처 재생성 필요 — 헬퍼로 노출.
    function regenerate() {
      gpuLayers.forEach(function (l) { if (l.generateLayerDataTexture) l.generateLayerDataTexture(); });
    }

    return {
      map: map, layers: layers, solids: solids, tileset: tileset,
      objects: objects, spawned: spawned,
      orientation: orientation, gpu: useGpu, gpuLayers: gpuLayers, regenerate: regenerate
    };
  }

  // ---------------------------------------------------------------------------
  // 3) assertPackLicense — 외부 Tiled 팩 라이선스 게이트(assets.json 정책 단일 소스).
  //   policy: assets.json 의 policy 객체 { allow:[], denyAlways:[], ccByRequiresAttribution }
  //   manifest: { name, license, attribution? }
  //   반환 { allowed:bool, reason:string, requiresAttribution:bool }
  // ---------------------------------------------------------------------------
  function normalizeLicense(lic) {
    if (!lic) return 'unknown';
    var s = String(lic).toUpperCase().trim();
    // CC0-1.0 / CC0 → CC0, CC-BY-3.0 / CC-BY → CC-BY 류 정규화
    if (s.indexOf('CC0') === 0) return 'CC0';
    if (s.indexOf('CC-BY-SA') === 0 || s.indexOf('CC BY-SA') === 0) return 'CC-BY-SA';
    if (s.indexOf('CC-BY') === 0 || s.indexOf('CC BY') === 0) return 'CC-BY';
    return s;
  }
  function listHas(list, normLic, rawLic) {
    if (!list) return false;
    for (var i = 0; i < list.length; i++) {
      var n = normalizeLicense(list[i]);
      if (n === normLic) return true;
      if (String(list[i]).toUpperCase() === String(rawLic || '').toUpperCase()) return true;
    }
    return false;
  }
  function assertPackLicense(policy, manifest) {
    policy = policy || {};
    manifest = manifest || {};
    var raw = manifest.license;
    var lic = normalizeLicense(raw);
    var requiresAttribution = (lic === 'CC-BY' || lic === 'CC-BY-SA');

    if (listHas(policy.denyAlways, lic, raw) || lic === 'UNKNOWN') {
      return { allowed: false, reason: '거부 목록/미상 라이선스: "' + raw + '"', requiresAttribution: requiresAttribution };
    }
    if (!listHas(policy.allow, lic, raw)) {
      return { allowed: false, reason: '허용 목록에 없음: "' + raw + '" (allow=' + (policy.allow || []).join(',') + ')', requiresAttribution: requiresAttribution };
    }
    if (requiresAttribution && policy.ccByRequiresAttribution && !manifest.attribution) {
      return { allowed: false, reason: lic + ' 는 attribution 필수인데 manifest.attribution 누락', requiresAttribution: true };
    }
    return { allowed: true, reason: 'OK (' + lic + ')', requiresAttribution: requiresAttribution };
  }

  var TiledForge = {
    bakeTileset: bakeTileset,
    buildTilesetBlock: buildTilesetBlock,
    tilesetGeometry: tilesetGeometry,
    expandTileDefs: expandTileDefs,
    injectMap: injectMap,
    loadTiledMap: loadTiledMap,
    flattenProps: flattenProps,
    assertPackLicense: assertPackLicense,
    normalizeLicense: normalizeLicense
  };
  global.TiledForge = TiledForge;
  if (typeof module !== 'undefined' && module.exports) module.exports = TiledForge;
})(typeof window !== 'undefined' ? window : this);
