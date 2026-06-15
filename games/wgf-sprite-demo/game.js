/* ============================================================================
 * wgf-sprite-demo — WGF Studio 로 내보낸 무빌드 정적 게임
 * ----------------------------------------------------------------------------
 * 이 파일은 editor/server/export.mjs 가 scene.json 으로부터 자동 생성한다.
 * 에디터 play 와 **동일한 SceneKit 로직코어 + scenekit-phaser 어댑터**로 t=0 를
 * 만들고 같은 코어로 step → 설계서 §3.2 동형성 계약 H 가 구성적으로 성립한다.
 *
 * 결정론(불변식):
 *  - 무작위는 RngForge 시드 스트림만(Math.random 금지).
 *  - 시간은 Phaser 주입 delta(어댑터 _update)만(Date.now/performance.now 금지).
 *  - ?seed=N 으로 RngForge 시드 고정(미지정 시 scene.meta.seed 또는 고정 기본).
 *
 * QA 가능성 계약(설계서 §4.8):
 *  - window.WgfSpriteDemo = { game, input: GAME_INPUT, audio, rng, scene, __bakeHash } 노출.
 *  - ?autostart=1 : 탭 없이 자동 play 루프 시작(헤드리스/QA 구동).
 *  - __bakeHash() : 베이크 자산 텍스처 픽셀 해시(외형 동형 H′ 검증 — 어댑터 위임).
 * ==========================================================================*/
(function () {
  'use strict';

  // 인라인 임베드된 씬 문서(단일 진실). 에디터 scene.json 과 동일.
  var SCENE_DOC = {
    "format": "wgf-scene@1",
    "slug": "wgf-sprite-demo",
    "meta": {
      "title": "스프라이트 데모 — Tiny Dungeon (CC0)",
      "genre": "topdown",
      "viewport": {
        "w": 320,
        "h": 240
      },
      "pixelArt": true,
      "systems": {}
    },
    "assets": {
      "sprites": [
        {
          "id": "td_player",
          "source": "local",
          "url": "assets/imported/tiny-dungeon.png",
          "license": "CC0-1.0",
          "credit": "Kenney — Tiny Dungeon (CC0-1.0)",
          "desc": "플레이어 — Tiny Dungeon 시트 프레임",
          "frameConfig": {
            "frameWidth": 16,
            "frameHeight": 16
          },
          "frame": 84,
          "w": 16,
          "h": 16
        },
        {
          "id": "td_enemy",
          "source": "local",
          "url": "assets/imported/tiny-dungeon.png",
          "license": "CC0-1.0",
          "credit": "Kenney — Tiny Dungeon (CC0-1.0)",
          "desc": "적 — Tiny Dungeon 시트 프레임",
          "frameConfig": {
            "frameWidth": 16,
            "frameHeight": 16
          },
          "frame": 108,
          "w": 16,
          "h": 16
        },
        {
          "id": "td_item",
          "source": "local",
          "url": "assets/imported/tiny-dungeon.png",
          "license": "CC0-1.0",
          "credit": "Kenney — Tiny Dungeon (CC0-1.0)",
          "desc": "아이템 — Tiny Dungeon 시트 프레임",
          "frameConfig": {
            "frameWidth": 16,
            "frameHeight": 16
          },
          "frame": 116,
          "w": 16,
          "h": 16
        },
        {
          "id": "td_floor",
          "source": "local",
          "url": "assets/imported/tiny-dungeon.png",
          "license": "CC0-1.0",
          "credit": "Kenney — Tiny Dungeon (CC0-1.0)",
          "desc": "바닥/벽 타일 — Tiny Dungeon 시트 프레임",
          "frameConfig": {
            "frameWidth": 16,
            "frameHeight": 16
          },
          "frame": 1,
          "w": 16,
          "h": 16
        }
      ]
    },
    "walls": [
      {
        "x": 0,
        "y": 0,
        "w": 320,
        "h": 8
      },
      {
        "x": 0,
        "y": 232,
        "w": 320,
        "h": 8
      },
      {
        "x": 0,
        "y": 0,
        "w": 8,
        "h": 240
      },
      {
        "x": 312,
        "y": 0,
        "w": 8,
        "h": 240
      }
    ],
    "scenes": [
      {
        "id": "main",
        "systems": {},
        "entities": [
          {
            "id": "player",
            "name": "플레이어",
            "transform": {
              "x": 80,
              "y": 120,
              "rotation": 0,
              "scaleX": 2,
              "scaleY": 2,
              "depth": 10
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "td_player"
              },
              {
                "type": "Body",
                "shape": "circle",
                "radius": 7,
                "isStatic": false
              },
              {
                "type": "TopDownController",
                "speed": 80,
                "input": "wasd"
              }
            ]
          },
          {
            "id": "enemy_01",
            "name": "적01",
            "transform": {
              "x": 220,
              "y": 120,
              "rotation": 0,
              "scaleX": 2,
              "scaleY": 2,
              "depth": 10
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "td_enemy"
              },
              {
                "type": "Body",
                "shape": "circle",
                "radius": 7,
                "isStatic": false
              }
            ]
          },
          {
            "id": "item_01",
            "name": "아이템01",
            "transform": {
              "x": 160,
              "y": 70,
              "rotation": 0,
              "scaleX": 2,
              "scaleY": 2,
              "depth": 5
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "td_item"
              },
              {
                "type": "Pickup",
                "kind": "coin",
                "amount": 1
              }
            ]
          },
          {
            "id": "tile_01",
            "name": "바닥타일",
            "transform": {
              "x": 160,
              "y": 175,
              "rotation": 0,
              "scaleX": 2,
              "scaleY": 2,
              "depth": 1
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "td_floor"
              }
            ]
          }
        ]
      }
    ],
    "dataLayers": {}
  };

  // 공유 입력 상태(키보드/조이스틱 → SceneKit TopDownController 가 읽음).
  // scenekit-phaser 어댑터가 매 프레임 이 객체를 갱신한다.
  if (!window.GAME_INPUT) window.GAME_INPUT = { up: false, down: false, left: false, right: false };
  var GAME_INPUT = window.GAME_INPUT;

  // 결정적 시드: ?seed=N > scene.meta.seed > 고정 기본.
  function parseSeed() {
    var m = /[?&]seed=(-?\d+)/.exec(location.search);
    if (m) return parseInt(m[1], 10);
    if (SCENE_DOC.meta && typeof SCENE_DOC.meta.seed === 'number') return SCENE_DOC.meta.seed;
    return 0x9E3779B9 | 0;
  }
  var SEED = parseSeed();

  // RngForge 시드 스트림(결정론 토대). 미로드 시 null(어댑터가 코어 폴백 사용).
  var RNG = (typeof RngForge !== 'undefined' && RngForge.create) ? RngForge.create(SEED) : null;

  // 오디오(ChipAudio — 8비트 절차 사운드). 어댑터가 audioEvents 를 drain 해 재생(후속).
  var GAME_AUDIO = (typeof ChipAudio !== 'undefined') ? new ChipAudio() : null;
  if (GAME_AUDIO) window.GAME_AUDIO = GAME_AUDIO;   // mobile.js 음소거 버튼 참조

  // ── 부트스트랩 ──────────────────────────────────────────────────────────────
  // scenekit-phaser 어댑터로 chrome:false(게임만) 렌더 + play step. 에디터 크롬 없음.
  var parent = document.getElementById('game') || document.body;
  var vp = (SCENE_DOC.meta && SCENE_DOC.meta.viewport) || {};

  var inst = SceneKitPhaser.create(parent, SCENE_DOC, {
    mode: 'edit',                 // 부트는 edit(t=0 정적) — autostart 면 즉시 play.
    chrome: false,                // 에디터 크롬(그리드·기즈모·아웃라인·마키·픽킹) 미장착.
    width: vp.w || undefined,
    height: vp.h || undefined,
    seed: SEED,
    rng: RNG || undefined,
    onReady: function () {
      // world 준비 완료 — QA API 갱신 + autostart 처리.
      WgfSpriteDemoApi.game = inst;
      WgfSpriteDemoApi.rng = (inst.getWorld && inst.getWorld()) ? inst.getWorld().rng : RNG;
      if (/[?&]autostart=1/.test(location.search)) start();
    }
  });

  // play 루프 시작(어댑터 setMode('play') → _update 가 주입 delta 로 코어 step).
  function start() {
    if (inst && inst.setMode) inst.setMode('play');
  }
  function stop() {
    if (inst && inst.setMode) inst.setMode('edit');
  }

  // ── QA 가능성 계약: window.WgfSpriteDemo 노출 ─────────────────────────────────────
  var WgfSpriteDemoApi = {
    game: inst,
    input: GAME_INPUT,
    audio: GAME_AUDIO,
    rng: RNG,
    scene: SCENE_DOC,
    seed: SEED,
    start: start,
    stop: stop,
    // 외형 동형(계약 H′) 검증 훅 — 어댑터 bakeHash 위임. 리드가 edit vs export 비교.
    __bakeHash: function () { return (inst && inst.bakeHash) ? inst.bakeHash() : null; }
  };
  window.WgfSpriteDemo = WgfSpriteDemoApi;
})();
