/* ============================================================================
 * TiledForge — Tiled(.tmj) 맵 연동 엔진 (web-game-builder)
 * ----------------------------------------------------------------------------
 * WebGameForge의 "외부 파일 0 · 절차 생성 · CC0/IP-safe" 정체성을 유지한 채 Tiled
 * 맵 포맷(.tmj)을 들이는 런타임. 두 가지를 제공한다:
 *
 *   1) bakeTileset(scene, tileDefs, opts)
 *      PixelForge 문자 그리드(또는 draw 콜백)로 타일셋 아틀라스를 *한 장의* 캔버스
 *      텍스처로 굽는다. Phaser 타일맵은 단일 타일셋 이미지가 필수("Collection of
 *      Images" 미지원)인데, addTilesetImage(name, textureKey)가 텍스처 *키*를 받으므로
 *      절차 베이크한 캔버스를 그 키로 연결하면 PNG 없이 네이티브 타일맵이 돈다.
 *
 *   2) loadTiledMap(scene, key, opts)
 *      캐시의 .tmj → 타일 레이어 빌드 + setCollisionByProperty + 오브젝트 레이어를
 *      게임이 등록한 스포너(spawners[type])로 위임. 엔진은 게임 로직을 모른다.
 *
 * 설계: docs/tiled-연동-설계.md. 직교맵(orthogonal) 전용(플랫포머·탑다운 공용).
 * ==========================================================================*/
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 유틸: 타일셋 아틀라스 기하 계산 (순수 함수 — 베이커/문서가 공유하는 계약)
  //   tileDefs 순서대로 GID = index+1. columns 미지정 시 단일 행(columns=tilecount).
  // ---------------------------------------------------------------------------
  function tilesetGeometry(tileDefs, opts) {
    opts = opts || {};
    var tileSize = opts.tileSize || 16;
    var n = tileDefs.length;
    var columns = opts.columns || n; // 기본: 한 줄
    if (columns < 1) columns = 1;
    var rows = Math.ceil(n / columns);
    return {
      tileSize: tileSize,
      tilewidth: tileSize,
      tileheight: tileSize,
      columns: columns,
      tilecount: n,
      imagewidth: columns * tileSize,
      imageheight: rows * tileSize
    };
  }

  // ---------------------------------------------------------------------------
  // 1) bakeTileset — 타일셋 아틀라스를 절차 베이크해 텍스처로 등록
  //   tileDefs: [{ name, collides, frame?:["row",…], draw?:fn(ctx,x,y,w,h,VF) }]
  //   opts: { key, name?, tileSize=16, columns?, palette? }
  //   반환 meta: { key, name, tilewidth, tileheight, columns, tilecount,
  //               imagewidth, imageheight, collides:[bool], names:[string] }
  // ---------------------------------------------------------------------------
  function bakeTileset(scene, tileDefs, opts) {
    opts = opts || {};
    if (!tileDefs || !tileDefs.length) throw new Error('TiledForge.bakeTileset: tileDefs 비어있음');
    var key = opts.key || 'forge-tiles';
    var name = opts.name || 'forge';
    var palette = opts.palette || (global.PixelForge && global.PixelForge.PALETTE) || {};
    var geo = tilesetGeometry(tileDefs, opts);
    var ts = geo.tileSize;

    var canvas = document.createElement('canvas');
    canvas.width = geo.imagewidth;
    canvas.height = geo.imageheight;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    var collides = [], names = [];
    tileDefs.forEach(function (def, i) {
      var cx = (i % geo.columns) * ts;
      var cy = Math.floor(i / geo.columns) * ts;
      if (typeof def.draw === 'function') {
        // 스무스/벡터 타일: 콜백에 셀 원점·크기 전달
        ctx.save();
        def.draw(ctx, cx, cy, ts, ts, global.VectorForge);
        ctx.restore();
      } else if (def.frame) {
        // PixelForge 문자 그리드: 라가드 패딩(짧은 행은 그냥 비움)
        paintGrid(ctx, def.frame, palette, cx, cy);
      }
      collides.push(!!def.collides);
      names.push(def.name || ('tile' + (i + 1)));
    });

    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);

    return {
      key: key, name: name,
      tilewidth: geo.tilewidth, tileheight: geo.tileheight,
      columns: geo.columns, tilecount: geo.tilecount,
      imagewidth: geo.imagewidth, imageheight: geo.imageheight,
      collides: collides, names: names
    };
  }

  // 문자 그리드 한 프레임을 (ox,oy) 셀에 픽셀 단위로 칠한다(PixelForge와 동일 규약).
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
  // embedded tileset 블록 생성 (Node 변환기와 동일 출력 — 문서 §4 계약)
  //   런타임에 직접 .tmj를 만들 때도 사용 가능.
  // ---------------------------------------------------------------------------
  function buildTilesetBlock(tileDefs, opts) {
    var geo = tilesetGeometry(tileDefs, opts);
    var name = (opts && opts.name) || 'forge';
    var tiles = [];
    tileDefs.forEach(function (def, i) {
      if (def.collides) {
        tiles.push({ id: i, properties: [{ name: 'collides', type: 'bool', value: true }] });
      }
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
  //   데모는 level.tmj.js가 전역에 JSON을 노출 → file://·헤드리스에서 CORS 무관.
  // ---------------------------------------------------------------------------
  function injectMap(scene, key, json) {
    var Formats = global.Phaser && global.Phaser.Tilemaps && global.Phaser.Tilemaps.Formats;
    var fmt = Formats ? Formats.TILED_JSON : 1;
    if (scene.cache.tilemap.exists(key)) scene.cache.tilemap.remove(key);
    scene.cache.tilemap.add(key, { format: fmt, data: json });
  }

  // ---------------------------------------------------------------------------
  // 프로퍼티 평탄화: Phaser는 보통 {key:value}로 주지만 raw 배열도 흡수.
  // ---------------------------------------------------------------------------
  function flattenProps(p) {
    if (!p) return {};
    if (Array.isArray(p)) {
      var o = {};
      p.forEach(function (e) { if (e && e.name !== undefined) o[e.name] = e.value; });
      return o;
    }
    return p; // 이미 객체
  }

  // 오브젝트 type 결정 (Tiled 버전차: type ↔ class 흡수, 프로퍼티 폴백)
  function objType(obj, props) {
    return obj.type || obj.class || (props && props.type) || '';
  }

  // ---------------------------------------------------------------------------
  // 2) loadTiledMap — .tmj 로드 → 레이어/충돌 빌드 + 오브젝트 스폰 위임
  //   opts: {
  //     tilesetKey,                 // bakeTileset이 등록한 텍스처 키
  //     tilesetName?='forge',       // .tmj 안 tileset name
  //     spawners?: { type: fn(scene, o) },  // o={x,y,type,name,width,height,props,raw}
  //     solidLayers?: [name],       // 충돌 켤 타일 레이어명(미지정 시 전체)
  //     gpu?=false,
  //     layerOffset?: {x,y}
  //   }
  //   반환: { map, layers:{name:layer}, solids:[layer], objects:[o], spawned:[…] }
  // ---------------------------------------------------------------------------
  function loadTiledMap(scene, key, opts) {
    opts = opts || {};
    var tilesetName = opts.tilesetName || 'forge';
    var spawners = opts.spawners || {};
    var off = opts.layerOffset || { x: 0, y: 0 };

    var map = scene.make.tilemap({ key: key });
    var tileset = map.addTilesetImage(tilesetName, opts.tilesetKey);
    if (!tileset) {
      throw new Error('TiledForge.loadTiledMap: addTilesetImage 실패 — .tmj tileset name("' +
        tilesetName + '")과 인자가 일치하는지, bakeTileset 키("' + opts.tilesetKey + '")가 등록됐는지 확인');
    }

    // --- 타일 레이어 빌드 + 충돌 ---
    var layers = {};
    var solids = [];
    var wantSolid = opts.solidLayers || null;
    map.layers.forEach(function (ld) {
      var layer = map.createLayer(ld.name, tileset, off.x, off.y);
      if (!layer) return;
      layers[ld.name] = layer;
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

    return { map: map, layers: layers, solids: solids, tileset: tileset, objects: objects, spawned: spawned };
  }

  var TiledForge = {
    bakeTileset: bakeTileset,
    buildTilesetBlock: buildTilesetBlock,
    tilesetGeometry: tilesetGeometry,
    injectMap: injectMap,
    loadTiledMap: loadTiledMap,
    flattenProps: flattenProps
  };
  global.TiledForge = TiledForge;
  if (typeof module !== 'undefined' && module.exports) module.exports = TiledForge;
})(typeof window !== 'undefined' ? window : this);
