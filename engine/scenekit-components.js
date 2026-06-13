/* ============================================================================
 * SceneKit Components — P0a 내장 컴포넌트 3종 등록 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * SceneKit.registerComponent(type, def) 로 Sprite / Body / TopDownController
 * 세 컴포넌트를 등록한다. SceneKit 코어(engine/scenekit.js)가 로드된 뒤에
 * 이 파일을 로드해야 한다.
 *
 * 결정론 정책: Math.random / Date.now / performance.now 절대 금지.
 *   무작위가 필요하면 ctx.rng(RngForge 스트림)만 사용.
 *   시간 진행은 주입 dt(초)만 사용.
 *
 * 헤드리스(Node require) 가능:
 *   const SceneKit = require('./scenekit.js');
 *   require('./scenekit-components.js');  // window 없이도 동작
 *
 * 전역 입력 인터페이스 (브라우저):
 *   TopDownController 는 GAME_INPUT 전역 객체를 우선 사용한다.
 *   GAME_INPUT = { up:bool, down:bool, left:bool, right:bool }
 *   없으면 world.meta.inputProvider(entity) -> { ax, ay } 로 폴백(헤드리스 주입).
 * ==========================================================================*/
(function (global) {
  'use strict';

  // SceneKit 코어가 로드되지 않은 경우 경고 후 종료 (개발 편의).
  var SK = (typeof module !== 'undefined' && module.exports)
    ? require('./scenekit.js')
    : (global.SceneKit);

  if (!SK || typeof SK.registerComponent !== 'function') {
    var msg = '[scenekit-components] SceneKit 코어가 먼저 로드되어야 합니다.';
    if (typeof console !== 'undefined') console.error(msg);
    if (typeof module !== 'undefined' && module.exports) throw new Error(msg);
    return;
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * 1. Sprite — 렌더 메타 컴포넌트
   *
   * 로직에 영향을 주지 않는다. init 에서 assets 참조 검증만 수행한다.
   * 실제 렌더링은 Phaser 어댑터(P1) 또는 외부 렌더러가 이 필드를 읽어 처리.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('Sprite', {
    schema: {
      sprite: { type: 'string', required: true,  desc: 'assets.sprites[].id 참조' },
      anim:   { type: 'string', required: false, desc: '재생할 애니메이션 키 (선택)' }
    },

    /** @param {{ entity, world, rng, getComponent }} ctx */
    init: function (ctx) {
      var comp = ctx.getComponent('Sprite');
      if (!comp) return;

      // assets.sprites 에 해당 id 가 선언돼 있는지 검증(경고만, 실행 차단 안 함).
      // world.assets (SceneKit.load 가 문서 최상위 assets 를 노출) 우선,
      // 폴백으로 world.meta.assets (구형 경로) 도 수용한다.
      var sprites = (ctx.world.assets && ctx.world.assets.sprites) ||
                    (ctx.world.meta && ctx.world.meta.assets && ctx.world.meta.assets.sprites);
      if (sprites) {
        var found = false;
        for (var i = 0; i < sprites.length; i++) {
          if (sprites[i].id === comp.sprite) { found = true; break; }
        }
        if (!found && typeof console !== 'undefined') {
          console.warn('[Sprite] 알 수 없는 sprite id "' + comp.sprite +
            '" — 엔티티: ' + (ctx.entity.id || '?'));
        }
      }
    },

    /** 렌더 전용 — step 로직 없음 */
    step: function (_ctx, _dt) { /* 의도적 no-op */ },

    inspectorFields: [
      {
        key:     'sprite',
        label:   '스프라이트 ID',
        type:    'asset-ref',
        assetType: 'sprites',
        required: true
      },
      {
        key:   'anim',
        label: '애니메이션 키',
        type:  'string',
        placeholder: '(없음)'
      }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 2. Body — 충돌 바디 컴포넌트
   *
   * SceneKit 충돌 코어가 이 컴포넌트의 shape/w/h/radius/isStatic 필드를
   * 직접 읽어 AABB·원-원 오버랩 분리를 계산한다.
   * init 에서 필드 유효성을 검사해 잘못된 값을 보정한다.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('Body', {
    schema: {
      shape:    { type: 'enum',    values: ['aabb', 'circle'], required: true  },
      w:        { type: 'number',  required: false, desc: 'shape:aabb 너비(px)'    },
      h:        { type: 'number',  required: false, desc: 'shape:aabb 높이(px)'    },
      radius:   { type: 'number',  required: false, desc: 'shape:circle 반지름(px)' },
      isStatic: { type: 'boolean', required: false, default: false }
    },

    /** @param {{ entity, world, rng, getComponent }} ctx */
    init: function (ctx) {
      var comp = ctx.getComponent('Body');
      if (!comp) return;

      // shape 정규화: 허용값이 아니면 'aabb' 로 보정.
      if (comp.shape !== 'aabb' && comp.shape !== 'circle') {
        if (typeof console !== 'undefined') {
          console.warn('[Body] 알 수 없는 shape "' + comp.shape +
            '" — "aabb" 로 보정. 엔티티: ' + (ctx.entity.id || '?'));
        }
        comp.shape = 'aabb';
      }

      // isStatic 기본값 보장.
      if (typeof comp.isStatic !== 'boolean') comp.isStatic = false;

      // shape 별 치수 검증/보정.
      if (comp.shape === 'aabb') {
        if (!(comp.w > 0)) {
          if (typeof console !== 'undefined') {
            console.warn('[Body] aabb 에 w 미지정 — 16 으로 기본값 적용. 엔티티: ' + (ctx.entity.id || '?'));
          }
          comp.w = 16;
        }
        if (!(comp.h > 0)) {
          if (typeof console !== 'undefined') {
            console.warn('[Body] aabb 에 h 미지정 — 16 으로 기본값 적용. 엔티티: ' + (ctx.entity.id || '?'));
          }
          comp.h = 16;
        }
      } else { // circle
        if (!(comp.radius > 0)) {
          if (typeof console !== 'undefined') {
            console.warn('[Body] circle 에 radius 미지정 — 8 으로 기본값 적용. 엔티티: ' + (ctx.entity.id || '?'));
          }
          comp.radius = 8;
        }
      }
    },

    /** 충돌 해석은 SceneKit 코어 step 이 담당 — 여기선 no-op */
    step: function (_ctx, _dt) { /* 의도적 no-op */ },

    inspectorFields: [
      {
        key:     'shape',
        label:   '충돌 형태',
        type:    'enum',
        options: ['aabb', 'circle'],
        required: true
      },
      {
        key:   'w',
        label: '너비(px)',
        type:  'number',
        min:   1,
        showWhen: { field: 'shape', value: 'aabb' }
      },
      {
        key:   'h',
        label: '높이(px)',
        type:  'number',
        min:   1,
        showWhen: { field: 'shape', value: 'aabb' }
      },
      {
        key:   'radius',
        label: '반지름(px)',
        type:  'number',
        min:   1,
        showWhen: { field: 'shape', value: 'circle' }
      },
      {
        key:     'isStatic',
        label:   '고정 바디',
        type:    'boolean',
        default: false
      }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 3. TopDownController — 8방향 탑다운 이동 컨트롤러
   *
   * step 마다 입력을 읽어 transform.x / transform.y 를 dt(초) 단위로 적분.
   *
   * 입력 우선순위:
   *   1) 전역 GAME_INPUT = { up, down, left, right } (Phaser 브라우저 환경)
   *   2) world.meta.inputProvider(entity) -> { ax, ay }  (헤드리스 주입)
   *   — ax/ay 범위: [-1, 1]. 대각선은 정규화 후 적용.
   *
   * Body 컴포넌트가 없으면 경고(충돌 분리가 작동하지 않음).
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('TopDownController', {
    schema: {
      speed: { type: 'number', required: true,  desc: '이동 속도 (px/s)' },
      input: { type: 'enum',   values: ['wasd', 'stick', 'both'], required: true }
    },

    /** @param {{ entity, world, rng, getComponent }} ctx */
    init: function (ctx) {
      var comp = ctx.getComponent('TopDownController');
      if (!comp) return;

      // speed 보정.
      if (!(comp.speed > 0)) {
        if (typeof console !== 'undefined') {
          console.warn('[TopDownController] speed 미지정 또는 0 이하 — 60 으로 기본값 적용. 엔티티: ' + (ctx.entity.id || '?'));
        }
        comp.speed = 60;
      }

      // input 기본값 보정.
      var validInput = { wasd: true, stick: true, both: true };
      if (!validInput[comp.input]) {
        if (typeof console !== 'undefined') {
          console.warn('[TopDownController] 알 수 없는 input "' + comp.input +
            '" — "wasd" 로 보정. 엔티티: ' + (ctx.entity.id || '?'));
        }
        comp.input = 'wasd';
      }

      // Body 없음 경고.
      var body = ctx.getComponent('Body');
      if (!body && typeof console !== 'undefined') {
        console.warn('[TopDownController] Body 컴포넌트가 없습니다 — 충돌 분리가 작동하지 않습니다. 엔티티: ' + (ctx.entity.id || '?'));
      }
    },

    /**
     * @param {{ entity, world, rng, getComponent }} ctx
     * @param {number} dt 초 단위 경과 시간
     */
    step: function (ctx, dt) {
      if (!(dt > 0)) return;

      var comp = ctx.getComponent('TopDownController');
      if (!comp) return;

      var ax = 0, ay = 0;

      // ── 입력 소스 결정 ──────────────────────────────────────────────────
      // 1순위: 전역 GAME_INPUT (브라우저, Phaser 키보드 결과를 게임이 매 프레임 기록)
      var gi = (typeof GAME_INPUT !== 'undefined') ? GAME_INPUT : null; // eslint-disable-line no-undef
      var useGameInput = gi && (comp.input === 'wasd' || comp.input === 'both');

      if (useGameInput) {
        if (gi.left)  ax -= 1;
        if (gi.right) ax += 1;
        if (gi.up)    ay -= 1;
        if (gi.down)  ay += 1;
      }

      // 2순위: world.meta.inputProvider (헤드리스 주입 또는 stick 전용)
      if ((ax === 0 && ay === 0) &&
          ctx.world.meta && typeof ctx.world.meta.inputProvider === 'function') {
        var provided = ctx.world.meta.inputProvider(ctx.entity);
        if (provided) {
          ax = (typeof provided.ax === 'number') ? provided.ax : 0;
          ay = (typeof provided.ay === 'number') ? provided.ay : 0;
        }
      }

      // 입력 없으면 이동 없음.
      if (ax === 0 && ay === 0) return;

      // ── 대각선 정규화 (8방향 동일 속도) ──────────────────────────────────
      var len = Math.sqrt(ax * ax + ay * ay);
      if (len > 1) { ax /= len; ay /= len; }

      // ── transform 적분 ───────────────────────────────────────────────────
      var speed = comp.speed;
      ctx.entity.transform.x += ax * speed * dt;
      ctx.entity.transform.y += ay * speed * dt;
    },

    inspectorFields: [
      {
        key:      'speed',
        label:    '이동 속도 (px/s)',
        type:     'number',
        min:      1,
        max:      1000,
        default:  80,
        required: true
      },
      {
        key:     'input',
        label:   '입력 소스',
        type:    'enum',
        options: [
          { value: 'wasd',  label: 'WASD 키보드' },
          { value: 'stick', label: '조이스틱' },
          { value: 'both',  label: '키보드 + 조이스틱' }
        ],
        default:  'wasd',
        required: true
      }
    ]
  });

  // Node 환경에서는 SceneKit 을 다시 export (체이닝 편의).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SK;
  }

})(typeof window !== 'undefined' ? window : this);
