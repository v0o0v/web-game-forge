/* ============================================================================
 * wgf-demo-arena — WGF Studio 로 내보낸 무빌드 정적 게임
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
 *  - window.WgfDemoArena = { game, input: GAME_INPUT, audio, rng, scene, __bakeHash } 노출.
 *  - ?autostart=1 : 탭 없이 자동 play 루프 시작(헤드리스/QA 구동).
 *  - __bakeHash() : 베이크 자산 텍스처 픽셀 해시(외형 동형 H′ 검증 — 어댑터 위임).
 * ==========================================================================*/
(function () {
  'use strict';

  // 인라인 임베드된 씬 문서(단일 진실). 에디터 scene.json 과 동일.
  var SCENE_DOC = {
    "format": "wgf-scene@1",
    "slug": "wgf-demo-arena",
    "meta": {
      "title": "절차 아레나",
      "genre": "topdown",
      "viewport": {
        "w": 480,
        "h": 320
      },
      "pixelArt": true,
      "seed": 73501
    },
    "assets": {
      "sprites": [
        {
          "id": "spr_player",
          "source": "procedural",
          "desc": "주인공 — 청록 원형 탐사대원, 흰 바이저",
          "w": 16,
          "h": 16
        },
        {
          "id": "spr_drone",
          "source": "procedural",
          "desc": "추격 드론 — 자홍 마름모, 붉은 센서 눈",
          "w": 14,
          "h": 14
        },
        {
          "id": "spr_turret",
          "source": "procedural",
          "desc": "정지 포탑 — 강철 회색 사각, 노란 포구",
          "w": 14,
          "h": 14
        },
        {
          "id": "spr_bullet",
          "source": "procedural",
          "desc": "발사체 — 작은 하늘색 광탄",
          "w": 6,
          "h": 6
        },
        {
          "id": "spr_coin",
          "source": "procedural",
          "desc": "금빛 동전 — 반짝이는 노란 원반",
          "w": 10,
          "h": 10
        },
        {
          "id": "spr_medkit",
          "source": "procedural",
          "desc": "회복 키트 — 흰 상자에 초록 십자",
          "w": 12,
          "h": 12
        },
        {
          "id": "spr_beacon",
          "source": "procedural",
          "desc": "신호 비콘 — 점멸하는 보라 등대(장식)",
          "w": 12,
          "h": 16
        },
        {
          "id": "spr_pad",
          "source": "procedural",
          "desc": "소환 패드 — 청록 테두리의 발광 타일",
          "w": 16,
          "h": 16
        }
      ]
    },
    "walls": [
      {
        "x": 0,
        "y": 0,
        "w": 480,
        "h": 12
      },
      {
        "x": 0,
        "y": 308,
        "w": 480,
        "h": 12
      },
      {
        "x": 0,
        "y": 0,
        "w": 12,
        "h": 320
      },
      {
        "x": 468,
        "y": 0,
        "w": 12,
        "h": 320
      },
      {
        "x": 150,
        "y": 120,
        "w": 40,
        "h": 16
      },
      {
        "x": 300,
        "y": 180,
        "w": 16,
        "h": 56
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
              "x": 240,
              "y": 250,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 20
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "spr_player"
              },
              {
                "type": "Body",
                "shape": "circle",
                "radius": 7,
                "isStatic": false
              },
              {
                "type": "TopDownController",
                "speed": 90,
                "input": "both"
              },
              {
                "type": "Shooter",
                "cooldown": 0.4,
                "speed": 200,
                "target": "turret_01",
                "auto": true,
                "damage": 1,
                "projectileLifetime": 1.2,
                "projectileSprite": "spr_bullet"
              },
              {
                "type": "Health",
                "max": 20,
                "hp": 20,
                "invuln": 0.4,
                "onDeath": "flag"
              },
              {
                "type": "CameraFollow",
                "target": "player",
                "lerp": 0.2
              },
              {
                "type": "AbilityBinding",
                "abilities": [
                  {
                    "id": "dash",
                    "cooldown": 1.5
                  }
                ],
                "bindings": {
                  "Space": "dash"
                }
              },
              {
                "type": "HUDBinding",
                "element": "hpbar",
                "source": "Health.hp",
                "format": "HP {v}"
              },
              {
                "type": "HUDBinding",
                "element": "coins",
                "source": "world.counters.coin",
                "format": "코인 {v}"
              },
              {
                "type": "AudioEmitter",
                "sound": "sfx_step",
                "trigger": "onStep",
                "cooldown": 0.5
              }
            ]
          },
          {
            "id": "drone_01",
            "name": "추격드론01",
            "transform": {
              "x": 80,
              "y": 70,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 15
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "spr_drone"
              },
              {
                "type": "Body",
                "shape": "circle",
                "radius": 6,
                "isStatic": false
              },
              {
                "type": "EnemyAI",
                "mode": "chase",
                "target": "player",
                "speed": 55,
                "range": 220
              },
              {
                "type": "Health",
                "max": 6,
                "hp": 6,
                "onDeath": "remove"
              },
              {
                "type": "ContactDamage",
                "damage": 2,
                "cooldown": 0.6
              }
            ]
          },
          {
            "id": "drone_02",
            "name": "추격드론02",
            "transform": {
              "x": 400,
              "y": 70,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 15
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "spr_drone"
              },
              {
                "type": "Body",
                "shape": "circle",
                "radius": 6,
                "isStatic": false
              },
              {
                "type": "EnemyAI",
                "mode": "chase",
                "target": "player",
                "speed": 55,
                "range": 220
              },
              {
                "type": "Health",
                "max": 6,
                "hp": 6,
                "onDeath": "remove"
              },
              {
                "type": "ContactDamage",
                "damage": 2,
                "cooldown": 0.6
              }
            ]
          },
          {
            "id": "turret_01",
            "name": "포탑01",
            "transform": {
              "x": 240,
              "y": 60,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 15
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "spr_turret"
              },
              {
                "type": "Body",
                "shape": "aabb",
                "w": 14,
                "h": 14,
                "isStatic": true
              },
              {
                "type": "Shooter",
                "cooldown": 1.2,
                "speed": 140,
                "target": "player",
                "auto": true,
                "damage": 1,
                "projectileLifetime": 2,
                "projectileSprite": "spr_bullet"
              },
              {
                "type": "Health",
                "max": 10,
                "hp": 10,
                "onDeath": "remove"
              }
            ]
          },
          {
            "id": "coin_01",
            "name": "코인01",
            "transform": {
              "x": 60,
              "y": 160,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 5
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "spr_coin"
              },
              {
                "type": "Body",
                "shape": "circle",
                "radius": 5,
                "isStatic": false
              },
              {
                "type": "Pickup",
                "kind": "coin",
                "amount": 1,
                "collector": "player"
              }
            ]
          },
          {
            "id": "coin_02",
            "name": "코인02",
            "transform": {
              "x": 240,
              "y": 160,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 5
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "spr_coin"
              },
              {
                "type": "Body",
                "shape": "circle",
                "radius": 5,
                "isStatic": false
              },
              {
                "type": "Pickup",
                "kind": "coin",
                "amount": 1,
                "collector": "player"
              }
            ]
          },
          {
            "id": "coin_03",
            "name": "코인03",
            "transform": {
              "x": 420,
              "y": 160,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 5
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "spr_coin"
              },
              {
                "type": "Body",
                "shape": "circle",
                "radius": 5,
                "isStatic": false
              },
              {
                "type": "Pickup",
                "kind": "coin",
                "amount": 1,
                "collector": "player"
              }
            ]
          },
          {
            "id": "medkit_01",
            "name": "회복키트01",
            "transform": {
              "x": 240,
              "y": 110,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 5
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "spr_medkit"
              },
              {
                "type": "Body",
                "shape": "circle",
                "radius": 5,
                "isStatic": false
              },
              {
                "type": "Pickup",
                "kind": "heal",
                "amount": 5,
                "collector": "player"
              }
            ]
          },
          {
            "id": "spawner_pad",
            "name": "소환패드",
            "transform": {
              "x": 80,
              "y": 250,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 2
            },
            "components": [
              {
                "type": "Sprite",
                "sprite": "spr_pad"
              },
              {
                "type": "Body",
                "shape": "aabb",
                "w": 16,
                "h": 16,
                "isStatic": true
              },
              {
                "type": "Spawner",
                "interval": 3,
                "max": 4,
                "jitter": 8,
                "template": {
                  "name": "졸개드론",
                  "components": [
                    {
                      "type": "Sprite",
                      "sprite": "spr_drone"
                    },
                    {
                      "type": "Body",
                      "shape": "circle",
                      "radius": 6,
                      "isStatic": false
                    },
                    {
                      "type": "EnemyAI",
                      "mode": "chase",
                      "target": "player",
                      "speed": 50,
                      "range": 200
                    },
                    {
                      "type": "Health",
                      "max": 5,
                      "hp": 5,
                      "onDeath": "remove"
                    },
                    {
                      "type": "ContactDamage",
                      "damage": 2,
                      "cooldown": 0.6
                    }
                  ]
                }
              }
            ]
          },
          {
            "id": "beacon_01",
            "name": "신호비콘",
            "transform": {
              "x": 400,
              "y": 250,
              "rotation": 0,
              "scaleX": 1,
              "scaleY": 1,
              "depth": 3
            },
            "components": [
              {
                "type": "AnimatedSprite",
                "sprite": "spr_beacon",
                "anims": [
                  {
                    "key": "pulse",
                    "frames": [
                      0,
                      1,
                      2,
                      3
                    ],
                    "fps": 6,
                    "loop": true
                  }
                ],
                "play": "pulse"
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
      WgfDemoArenaApi.game = inst;
      WgfDemoArenaApi.rng = (inst.getWorld && inst.getWorld()) ? inst.getWorld().rng : RNG;
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

  // ── QA 가능성 계약: window.WgfDemoArena 노출 ─────────────────────────────────────
  var WgfDemoArenaApi = {
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
  window.WgfDemoArena = WgfDemoArenaApi;
})();
