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
      anim:   { type: 'string', required: false, desc: '재생할 애니메이션 키 (선택)' },
      frame:  { type: 'number', required: false, desc: '스프라이트시트 프레임 인덱스(정적)' }
    },

    /** @param {{ entity, world, rng, getComponent }} ctx */
    init: function (ctx) {
      var comp = ctx.getComponent('Sprite');
      if (!comp) return;

      // frame 보정(결정적): 유한한 숫자면 음수는 0 으로 클램프 + 정수 내림(시트 프레임은 정수),
      // 그 외(undefined/null/NaN/문자열 등)는 미지정으로 키 제거.
      if (typeof comp.frame === 'number' && isFinite(comp.frame)) {
        comp.frame = Math.max(0, Math.floor(comp.frame));
      } else if ('frame' in comp) {
        delete comp.frame;
      }

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
      },
      {
        key:   'frame',
        label: '프레임',
        type:  'number',
        placeholder: '0'
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

  /* ════════════════════════════════════════════════════════════════════════
   * 공용 결정적 헬퍼 (P0b 컴포넌트 공유)
   * ----------------------------------------------------------------------------
   * 무작위·시간·DOM 의존 0. 오버랩 판정은 코어 충돌 분리(scenekit.js)와 별개의
   * "쿼리 전용" 헬퍼다(트랜스폼을 밀지 않는다 — 데미지/픽업 등 판정에만 사용).
   * ════════════════════════════════════════════════════════════════════════ */
  function n(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function isObj(v) { return v !== null && typeof v === 'object'; }
  function arr(v) { return Array.isArray(v) ? v : []; }

  // 엔티티의 충돌 영역(Body 우선, 없으면 트랜스폼 점)을 AABB 로 근사 반환.
  //   { cx, cy, hw, hh } — 중심 + half-extent. 원은 외접 정사각형으로 근사(판정 전용).
  function aabbOf(entity) {
    var tx = n(entity.transform.x, 0), ty = n(entity.transform.y, 0);
    var b = SK.getComponentOn(entity, 'Body');
    if (b) {
      var ox = n(b.offsetX, 0), oy = n(b.offsetY, 0);
      if (b.shape === 'circle') {
        var r = Math.max(0, n(b.radius, 0));
        return { cx: tx + ox, cy: ty + oy, hw: r, hh: r };
      }
      return { cx: tx + ox, cy: ty + oy, hw: Math.max(0, n(b.w, 0)) / 2, hh: Math.max(0, n(b.h, 0)) / 2 };
    }
    return { cx: tx, cy: ty, hw: 0, hh: 0 };
  }

  // 두 엔티티 AABB 가 겹치는가(경계 접촉 포함). 결정적·부작용 없음.
  function overlaps(a, b) {
    var A = aabbOf(a), B = aabbOf(b);
    return Math.abs(A.cx - B.cx) <= (A.hw + B.hw) &&
           Math.abs(A.cy - B.cy) <= (A.hh + B.hh);
  }

  // 같은 타입 컴포넌트를 가진 다른 엔티티들을 id 사전식 정렬 순으로 반환(결정적 순회).
  function entitiesWithComponent(world, type, excludeId) {
    var out = [];
    for (var i = 0; i < world.entities.length; i++) {
      var e = world.entities[i];
      if (excludeId != null && e.id === excludeId) continue;
      if (SK.getComponentOn(e, type)) out.push(e);
    }
    out.sort(function (x, y) { return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0); });
    return out;
  }

  // id 또는 'player' 같은 의미 키로 타깃 엔티티 1개 해석(결정적).
  //   - 'self'        → 자기 자신
  //   - 그 외 문자열  → ① 정확한 id 매칭 → ② 정확한 name 매칭(id 사전식 중 첫)
  //                     'player' 키일 때 ③ name==='플레이어' 까지만 폴백
  //                     (부분문자열 폴백은 오매칭 위험으로 제거)
  // 동점(name 동일) 시 id 사전식 최솟값을 반환 — 결정성 보장.
  function resolveTarget(world, selfEntity, key) {
    if (key == null || key === 'self') return selfEntity;
    var k = String(key);
    var cands = world.entities.slice().sort(function (x, y) { return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0); });
    // ① 정확한 id 매칭(최우선)
    for (var i = 0; i < cands.length; i++) {
      if (cands[i].id === k) return cands[i];
    }
    // ② 정확한 name 매칭
    for (var j = 0; j < cands.length; j++) {
      if (cands[j].name === k) return cands[j];
    }
    // ③ 'player' 전용: 한글 명칭 '플레이어' 폴백(부분문자열 없음)
    if (k === 'player') {
      for (var p = 0; p < cands.length; p++) {
        if (cands[p].name === '플레이어') return cands[p];
      }
    }
    return null;
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * 4. AnimatedSprite — 프레임 애니메이션 메타(결정적 타이머)
   *
   * 실제 렌더는 P1 어댑터 몫. 코어는 _frame/_elapsed/_anim 만 결정적으로 진행.
   * 불변식: t=0 = 프레임0 고정(init 에서 _frame=0,_elapsed=0).
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('AnimatedSprite', {
    schema: {
      sprite: { type: 'string', required: true,  desc: 'assets.sprites[].id 참조' },
      anims:  { type: 'array',  required: false, desc: '[{key,frames:[..],fps,loop}] 애니메이션 정의' },
      play:   { type: 'string', required: false, desc: '초기 재생 애니메이션 키' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('AnimatedSprite');
      if (!comp) return;
      comp.anims = arr(comp.anims);
      // 초기 애니메이션 키: play > 첫 anim.key > null.
      var initialKey = (typeof comp.play === 'string') ? comp.play
        : (comp.anims.length && comp.anims[0] ? comp.anims[0].key : null);
      comp._anim = (initialKey != null) ? String(initialKey) : null;
      comp._frame = 0;       // t=0 = 프레임0 고정(계약 H′)
      comp._elapsed = 0;
    },

    step: function (ctx, dt) {
      if (!(dt > 0)) return;
      var comp = ctx.getComponent('AnimatedSprite');
      if (!comp || comp._anim == null) return;

      var def = null, anims = arr(comp.anims);
      for (var i = 0; i < anims.length; i++) {
        if (anims[i] && anims[i].key === comp._anim) { def = anims[i]; break; }
      }
      if (!def) return;

      var frames = arr(def.frames);
      if (frames.length === 0) return;
      var fps = n(def.fps, 0);
      if (fps <= 0) return;                  // fps 0 이하면 정지(프레임0 유지)
      var loop = (def.loop !== false);       // 기본 loop=true

      comp._elapsed += dt;
      var frameDur = 1 / fps;
      // 누적 시간으로 프레임 인덱스 결정(결정적). O(1) — 폭주 상한 없음.
      var advance = Math.floor(comp._elapsed / frameDur);
      comp._elapsed = comp._elapsed % frameDur;
      comp._frame += advance;
      if (comp._frame >= frames.length) {
        if (loop) {
          comp._frame = comp._frame % frames.length;
        } else {
          comp._frame = frames.length - 1;   // 마지막 프레임에서 정지
          comp._elapsed = 0;
        }
      }
    },

    inspectorFields: [
      { key: 'sprite', label: '스프라이트 ID', type: 'asset-ref', assetType: 'sprites', required: true },
      { key: 'anims',  label: '애니메이션 목록', type: 'json',   placeholder: '[{"key":"walk","frames":[0,1,2,3],"fps":8,"loop":true}]' },
      { key: 'play',   label: '초기 재생 키',   type: 'string', placeholder: '(첫 애니메이션)' }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 5. Health — 체력/무적시간/사망 처리
   *
   * 다른 컴포넌트(ContactDamage/Projectile)가 comp.hp 를 직접 깎는다.
   * step: 무적 타이머 감소. hp<=0 → onDeath('remove'|'flag') 에 따라 처리.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('Health', {
    schema: {
      max:     { type: 'number',  required: true,  desc: '최대 체력' },
      hp:      { type: 'number',  required: false, desc: '현재 체력(기본=max)' },
      invuln:  { type: 'number',  required: false, desc: '피격 후 무적 시간(초)' },
      onDeath: { type: 'enum',    values: ['remove', 'flag'], required: false, desc: '사망 처리: remove=엔티티 제거, flag=dead 플래그' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('Health');
      if (!comp) return;
      if (!(comp.max > 0)) comp.max = 1;
      if (typeof comp.hp !== 'number' || !isFinite(comp.hp)) comp.hp = comp.max;
      comp.hp = Math.min(comp.hp, comp.max);
      if (typeof comp.onDeath !== 'string' || (comp.onDeath !== 'remove' && comp.onDeath !== 'flag')) {
        comp.onDeath = 'flag';
      }
      comp.dead = false;
      comp._invulnT = 0;     // 남은 무적 시간(초)
    },

    step: function (ctx, dt) {
      var comp = ctx.getComponent('Health');
      if (!comp) return;
      if (dt > 0 && comp._invulnT > 0) {
        comp._invulnT = Math.max(0, comp._invulnT - dt);
      }
      if (comp.hp <= 0 && !comp.dead) {
        comp.dead = true;
        comp.hp = 0;
        if (comp.onDeath === 'remove') {
          SK.applyCommand(ctx.world, { type: 'removeEntity', id: ctx.entity.id });
        }
      }
    },

    inspectorFields: [
      { key: 'max',    label: '최대 체력', type: 'number', min: 1, required: true },
      { key: 'hp',     label: '현재 체력', type: 'number', min: 0 },
      { key: 'invuln', label: '무적 시간(초)', type: 'number', min: 0, default: 0 },
      { key: 'onDeath', label: '사망 처리', type: 'enum',
        options: [ { value: 'flag', label: 'dead 플래그' }, { value: 'remove', label: '엔티티 제거' } ],
        default: 'flag' }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 6. ContactDamage — 접촉 데미지(자기 Body 와 겹친 Health 보유 엔티티에 데미지)
   *
   * step: Health 보유 엔티티를 id 정렬 순으로 순회, 오버랩 시 hp 감소.
   * cooldown(초)·oncePerTarget 존중. 무적 중인 대상은 건너뜀. 결정적.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('ContactDamage', {
    schema: {
      damage:        { type: 'number',  required: true,  desc: '접촉당 데미지' },
      cooldown:      { type: 'number',  required: false, desc: '동일 대상 재타격 쿨다운(초)' },
      oncePerTarget: { type: 'boolean', required: false, desc: 'true 면 대상당 1회만' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('ContactDamage');
      if (!comp) return;
      if (typeof comp.damage !== 'number' || !isFinite(comp.damage)) comp.damage = 1;
      if (typeof comp.oncePerTarget !== 'boolean') comp.oncePerTarget = false;
      comp._cooldowns = {};   // targetId → 남은 쿨다운(초)
      comp._hit = {};         // targetId → true(oncePerTarget 용)
    },

    step: function (ctx, dt) {
      var comp = ctx.getComponent('ContactDamage');
      if (!comp) return;

      // 쿨다운 감소 + 소멸 엔티티 키 정리(결정적, O(누적) 방지).
      if (dt > 0) {
        var liveIds = {};
        for (var li = 0; li < ctx.world.entities.length; li++) liveIds[ctx.world.entities[li].id] = true;
        var keys = Object.keys(comp._cooldowns);
        for (var k = 0; k < keys.length; k++) {
          var remaining = Math.max(0, comp._cooldowns[keys[k]] - dt);
          if (remaining === 0 && !liveIds[keys[k]]) {
            delete comp._cooldowns[keys[k]];  // 소멸 엔티티 + 쿨다운 만료 → 제거
            delete comp._hit[keys[k]];
          } else {
            comp._cooldowns[keys[k]] = remaining;
          }
        }
      }

      var targets = entitiesWithComponent(ctx.world, 'Health', ctx.entity.id);
      for (var i = 0; i < targets.length; i++) {
        var tgt = targets[i];
        if (comp.oncePerTarget && comp._hit[tgt.id]) continue;
        if ((comp._cooldowns[tgt.id] || 0) > 0) continue;
        if (!overlaps(ctx.entity, tgt)) continue;

        var hcomp = SK.getComponentOn(tgt, 'Health');
        if (!hcomp || hcomp.dead) continue;
        if ((hcomp._invulnT || 0) > 0) continue;   // 무적 중

        hcomp.hp -= comp.damage;
        if ((hcomp.invuln || 0) > 0) hcomp._invulnT = hcomp.invuln;
        comp._hit[tgt.id] = true;
        if ((comp.cooldown || 0) > 0) comp._cooldowns[tgt.id] = comp.cooldown;
      }
    },

    inspectorFields: [
      { key: 'damage',        label: '데미지',        type: 'number', min: 0, required: true },
      { key: 'cooldown',      label: '재타격 쿨다운(초)', type: 'number', min: 0, default: 0 },
      { key: 'oncePerTarget', label: '대상당 1회만',  type: 'boolean', default: false }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 7. Projectile — 직선 이동 발사체(수명·데미지)
   *
   * step: transform 을 속도*dt 적분, lifetime 감소. <=0 시 자기 removeEntity.
   * damage>0 이면 Health 보유 엔티티와 오버랩 시 데미지 + 자기 소멸. 결정적.
   * 속도: vx/vy 직접 지정, 또는 speed+angle(라디안)에서 init 시 계산.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('Projectile', {
    schema: {
      vx:       { type: 'number', required: false, desc: 'x 속도(px/s)' },
      vy:       { type: 'number', required: false, desc: 'y 속도(px/s)' },
      speed:    { type: 'number', required: false, desc: 'angle 와 함께 속도 크기(px/s)' },
      angle:    { type: 'number', required: false, desc: 'speed 와 함께 방향(라디안)' },
      lifetime: { type: 'number', required: true,  desc: '수명(초)' },
      damage:   { type: 'number', required: false, desc: '명중 데미지(>0 이면 Health 와 충돌 시 적용)' },
      pierce:   { type: 'boolean', required: false, desc: 'true 면 관통(명중해도 소멸 안 함)' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('Projectile');
      if (!comp) return;
      // speed+angle 우선 계산(둘 다 있으면 vx/vy 덮어씀). 없으면 vx/vy 사용.
      if (typeof comp.speed === 'number' && typeof comp.angle === 'number') {
        comp.vx = comp.speed * Math.cos(comp.angle);
        comp.vy = comp.speed * Math.sin(comp.angle);
      }
      if (typeof comp.vx !== 'number' || !isFinite(comp.vx)) comp.vx = 0;
      if (typeof comp.vy !== 'number' || !isFinite(comp.vy)) comp.vy = 0;
      if (!(comp.lifetime > 0)) comp.lifetime = 1;
      if (typeof comp.damage !== 'number' || !isFinite(comp.damage)) comp.damage = 0;
      if (typeof comp.pierce !== 'boolean') comp.pierce = false;
      comp._life = comp.lifetime;
      comp._dead = false;
    },

    step: function (ctx, dt) {
      var comp = ctx.getComponent('Projectile');
      if (!comp || comp._dead) return;
      if (!(dt > 0)) return;

      // 1) 이동 적분.
      ctx.entity.transform.x = n(ctx.entity.transform.x, 0) + comp.vx * dt;
      ctx.entity.transform.y = n(ctx.entity.transform.y, 0) + comp.vy * dt;

      // 2) 데미지(>0 일 때만): Health 보유 엔티티와 오버랩 검사(id 정렬 순).
      if (comp.damage > 0) {
        var targets = entitiesWithComponent(ctx.world, 'Health', ctx.entity.id);
        for (var i = 0; i < targets.length; i++) {
          if (!overlaps(ctx.entity, targets[i])) continue;
          var hcomp = SK.getComponentOn(targets[i], 'Health');
          if (!hcomp || hcomp.dead) continue;
          if ((hcomp._invulnT || 0) > 0) continue;
          hcomp.hp -= comp.damage;
          if ((hcomp.invuln || 0) > 0) hcomp._invulnT = hcomp.invuln;
          if (!comp.pierce) { comp._dead = true; SK.applyCommand(ctx.world, { type: 'removeEntity', id: ctx.entity.id }); return; }
        }
      }

      // 3) 수명 감소 → 소멸.
      comp._life -= dt;
      if (comp._life <= 0) {
        comp._dead = true;
        SK.applyCommand(ctx.world, { type: 'removeEntity', id: ctx.entity.id });
      }
    },

    inspectorFields: [
      { key: 'vx',       label: 'x 속도(px/s)', type: 'number' },
      { key: 'vy',       label: 'y 속도(px/s)', type: 'number' },
      { key: 'speed',    label: '속도 크기(px/s)', type: 'number' },
      { key: 'angle',    label: '방향(라디안)',   type: 'number' },
      { key: 'lifetime', label: '수명(초)', type: 'number', min: 0.01, required: true },
      { key: 'damage',   label: '명중 데미지', type: 'number', min: 0, default: 0 },
      { key: 'pierce',   label: '관통',       type: 'boolean', default: false }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 8. Shooter — 주기 발사(Projectile 엔티티 생성)
   *
   * step: _cd 감소, auto·발사가능 시 target 방향으로 Projectile 엔티티 spawn.
   * SK.applyCommand(addEntity)로 가산적 생성. dt 쿨다운. 결정적.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('Shooter', {
    schema: {
      cooldown:    { type: 'number',  required: true,  desc: '발사 간격(초)' },
      speed:       { type: 'number',  required: false, desc: '발사체 속도(px/s)' },
      target:      { type: 'string',  required: false, desc: '조준 대상(기본 "player")' },
      auto:        { type: 'boolean', required: false, desc: 'true 면 자동 발사' },
      damage:      { type: 'number',  required: false, desc: '발사체 데미지' },
      projectileLifetime: { type: 'number', required: false, desc: '발사체 수명(초)' },
      projectileSprite:   { type: 'string', required: false, desc: '발사체 스프라이트 id' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('Shooter');
      if (!comp) return;
      if (!(comp.cooldown > 0)) comp.cooldown = 1;
      if (!(comp.speed > 0)) comp.speed = 120;
      if (typeof comp.target !== 'string') comp.target = 'player';
      if (typeof comp.auto !== 'boolean') comp.auto = true;
      if (typeof comp.damage !== 'number' || !isFinite(comp.damage)) comp.damage = 1;
      if (!(comp.projectileLifetime > 0)) comp.projectileLifetime = 2;
      comp._cd = 0;          // 0 이면 즉시 발사 가능
      comp._fireRequested = false;   // manual 발사 요청 플래그(어댑터/입력이 세팅)
    },

    step: function (ctx, dt) {
      var comp = ctx.getComponent('Shooter');
      if (!comp) return;

      if (dt > 0 && comp._cd > 0) comp._cd = Math.max(0, comp._cd - dt);

      var wantFire = comp.auto || comp._fireRequested;
      if (!wantFire || comp._cd > 0) return;

      // 조준: target 위치로 방향 결정(없으면 +x). 결정적.
      var sx = n(ctx.entity.transform.x, 0), sy = n(ctx.entity.transform.y, 0);
      var ang = 0;
      var tgt = resolveTarget(ctx.world, ctx.entity, comp.target);
      if (tgt && tgt !== ctx.entity) {
        var dx = n(tgt.transform.x, 0) - sx, dy = n(tgt.transform.y, 0) - sy;
        if (dx !== 0 || dy !== 0) ang = Math.atan2(dy, dx);
      }

      var projComps = [
        { type: 'Projectile', speed: comp.speed, angle: ang,
          lifetime: comp.projectileLifetime, damage: comp.damage }
      ];
      if (typeof comp.projectileSprite === 'string') {
        projComps.unshift({ type: 'Sprite', sprite: comp.projectileSprite });
      }
      SK.applyCommand(ctx.world, { type: 'addEntity', entity: {
        name: 'projectile',
        transform: { x: sx, y: sy },
        components: projComps
      }});

      comp._cd = comp.cooldown;
      comp._fireRequested = false;
    },

    inspectorFields: [
      { key: 'cooldown', label: '발사 간격(초)', type: 'number', min: 0.01, required: true },
      { key: 'speed',    label: '발사체 속도(px/s)', type: 'number', min: 1, default: 120 },
      { key: 'target',   label: '조준 대상',  type: 'string', default: 'player' },
      { key: 'auto',     label: '자동 발사',  type: 'boolean', default: true },
      { key: 'damage',   label: '발사체 데미지', type: 'number', min: 0, default: 1 },
      { key: 'projectileLifetime', label: '발사체 수명(초)', type: 'number', min: 0.01, default: 2 },
      { key: 'projectileSprite',   label: '발사체 스프라이트', type: 'asset-ref', assetType: 'sprites' }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 9. EnemyAI — 결정적 적 AI(chase/flee/patrol/shoot)
   *
   * step: 모드별 의도 속도 계산 후 transform 적분. patrol 흔들림은 ctx.rng 만.
   * range 밖이면 idle(이동 없음). 결정적.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('EnemyAI', {
    schema: {
      mode:   { type: 'enum',   values: ['chase', 'flee', 'patrol', 'shoot'], required: true },
      target: { type: 'string', required: false, desc: '대상(기본 "player")' },
      speed:  { type: 'number', required: false, desc: '이동 속도(px/s)' },
      range:  { type: 'number', required: false, desc: '감지 거리(px, 0=무한)' },
      patrolAxis: { type: 'enum', values: ['x', 'y'], required: false, desc: 'patrol 진동 축' },
      patrolRange: { type: 'number', required: false, desc: 'patrol 진폭(px)' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('EnemyAI');
      if (!comp) return;
      var validModes = { chase: 1, flee: 1, patrol: 1, shoot: 1 };
      if (!validModes[comp.mode]) comp.mode = 'chase';
      if (typeof comp.target !== 'string') comp.target = 'player';
      if (!(comp.speed > 0)) comp.speed = 50;
      if (typeof comp.range !== 'number' || !isFinite(comp.range) || comp.range < 0) comp.range = 0;
      if (comp.patrolAxis !== 'x' && comp.patrolAxis !== 'y') comp.patrolAxis = 'x';
      if (!(comp.patrolRange > 0)) comp.patrolRange = 32;
      comp._origin = { x: n(ctx.entity.transform.x, 0), y: n(ctx.entity.transform.y, 0) };
      comp._patrolDir = 1;   // patrol 진행 방향(+1/-1)
    },

    step: function (ctx, dt) {
      if (!(dt > 0)) return;
      var comp = ctx.getComponent('EnemyAI');
      if (!comp) return;

      var ex = n(ctx.entity.transform.x, 0), ey = n(ctx.entity.transform.y, 0);

      if (comp.mode === 'patrol') {
        // origin 기준 patrolAxis 로 진동(결정적). 경계 도달 시 방향 반전.
        var axis = comp.patrolAxis;
        var cur = (axis === 'x') ? ex : ey;
        var origin = (axis === 'x') ? comp._origin.x : comp._origin.y;
        var nextPos = cur + comp._patrolDir * comp.speed * dt;
        if (nextPos > origin + comp.patrolRange) { nextPos = origin + comp.patrolRange; comp._patrolDir = -1; }
        else if (nextPos < origin - comp.patrolRange) { nextPos = origin - comp.patrolRange; comp._patrolDir = 1; }
        if (axis === 'x') ctx.entity.transform.x = nextPos; else ctx.entity.transform.y = nextPos;
        return;
      }

      // chase/flee/shoot: 대상이 필요.
      var tgt = resolveTarget(ctx.world, ctx.entity, comp.target);
      if (!tgt || tgt === ctx.entity) return;
      var dx = n(tgt.transform.x, 0) - ex, dy = n(tgt.transform.y, 0) - ey;
      var dist = Math.sqrt(dx * dx + dy * dy);

      // range 밖이면 대기(0=무한 감지).
      if (comp.range > 0 && dist > comp.range) return;
      if (dist === 0) return;

      var ux = dx / dist, uy = dy / dist;
      if (comp.mode === 'flee') { ux = -ux; uy = -uy; }
      // shoot 모드는 이동 없이 제자리 조준(발사는 Shooter 컴포넌트 담당). idle 유지.
      if (comp.mode === 'shoot') return;

      ctx.entity.transform.x = ex + ux * comp.speed * dt;
      ctx.entity.transform.y = ey + uy * comp.speed * dt;
    },

    inspectorFields: [
      { key: 'mode', label: 'AI 모드', type: 'enum',
        options: [ { value: 'chase', label: '추격' }, { value: 'flee', label: '도주' },
                   { value: 'patrol', label: '순찰' }, { value: 'shoot', label: '조준' } ], required: true },
      { key: 'target',      label: '대상',     type: 'string', default: 'player' },
      { key: 'speed',       label: '이동 속도(px/s)', type: 'number', min: 1, default: 50 },
      { key: 'range',       label: '감지 거리(px, 0=무한)', type: 'number', min: 0, default: 0 },
      { key: 'patrolAxis',  label: '순찰 축', type: 'enum', options: ['x', 'y'], default: 'x',
        showWhen: { field: 'mode', value: 'patrol' } },
      { key: 'patrolRange', label: '순찰 진폭(px)', type: 'number', min: 1, default: 32,
        showWhen: { field: 'mode', value: 'patrol' } }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 10. Pickup — 수집 아이템(collector 와 오버랩 시 효과 + 소멸)
   *
   * kind: 'heal'(Health.hp 증가) | 'coin'(world 카운터 증가) | 그 외(world 카운터).
   * step: collector 와 오버랩 시 효과 적용 + 자기 removeEntity. 결정적.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('Pickup', {
    schema: {
      kind:      { type: 'string', required: false, desc: "'heal'|'coin'|기타" },
      amount:    { type: 'number', required: false, desc: '효과량(heal=회복량, coin=증가량)' },
      collector: { type: 'string', required: false, desc: '수집자(기본 "player")' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('Pickup');
      if (!comp) return;
      if (typeof comp.kind !== 'string') comp.kind = 'coin';
      if (typeof comp.amount !== 'number' || !isFinite(comp.amount)) comp.amount = 1;
      if (typeof comp.collector !== 'string') comp.collector = 'player';
      comp._collected = false;
    },

    step: function (ctx) {
      var comp = ctx.getComponent('Pickup');
      if (!comp || comp._collected) return;

      var collector = resolveTarget(ctx.world, ctx.entity, comp.collector);
      if (!collector || collector === ctx.entity) return;
      if (!overlaps(ctx.entity, collector)) return;

      // 효과 적용(결정적).
      if (comp.kind === 'heal') {
        var hcomp = SK.getComponentOn(collector, 'Health');
        // collector 에 Health 가 없으면 heal 불가 → 소멸하지 않고 미수집 유지.
        if (!hcomp) return;
        hcomp.hp = Math.min(n(hcomp.max, hcomp.hp), n(hcomp.hp, 0) + comp.amount);
      } else {
        // 'coin' 등: world 카운터 누적(어댑터/HUD 가 읽음).
        if (!isObj(ctx.world.counters)) ctx.world.counters = {};
        var key = comp.kind || 'coin';
        ctx.world.counters[key] = n(ctx.world.counters[key], 0) + comp.amount;
      }

      comp._collected = true;
      SK.applyCommand(ctx.world, { type: 'removeEntity', id: ctx.entity.id });
    },

    inspectorFields: [
      { key: 'kind',      label: '종류', type: 'string', placeholder: 'coin / heal / ...' },
      { key: 'amount',    label: '효과량', type: 'number', default: 1 },
      { key: 'collector', label: '수집자', type: 'string', default: 'player' }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 11. Spawner — 주기적 엔티티 생성(template 인라인 엔티티)
   *
   * step: _t 감소, 0 이하 + 생성수<max 면 template 으로 spawn(addEntity).
   * 위치 = 스포너 transform + 선택적 ctx.rng 오프셋. dt 인터벌. 결정적.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('Spawner', {
    schema: {
      template: { type: 'object', required: true,  desc: '생성할 엔티티 템플릿' },
      interval: { type: 'number', required: true,  desc: '생성 간격(초)' },
      max:      { type: 'number', required: false, desc: '최대 생성 수(기본 무한)' },
      jitter:   { type: 'number', required: false, desc: 'ctx.rng 위치 오프셋 범위(±px)' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('Spawner');
      if (!comp) return;
      if (!isObj(comp.template)) comp.template = { components: [] };
      if (!(comp.interval > 0)) comp.interval = 1;
      if (typeof comp.max !== 'number' || !isFinite(comp.max) || comp.max < 0) comp.max = 0; // 0=무한
      if (typeof comp.jitter !== 'number' || !isFinite(comp.jitter) || comp.jitter < 0) comp.jitter = 0;
      comp._t = comp.interval;   // 첫 생성까지 interval 대기
      comp._count = 0;
    },

    step: function (ctx, dt) {
      if (!(dt > 0)) return;
      var comp = ctx.getComponent('Spawner');
      if (!comp) return;

      comp._t -= dt;
      if (comp._t > 0) return;
      // 인터벌 도달 — 버스트 방지: 큰 dt 로 _t 가 크게 음수가 됐어도 1프레임 1개만 생성.
      // 잔여 음수는 버리고 다음 인터벌부터 새로 카운트한다(의도적 단순화).
      comp._t = comp.interval;

      if (comp.max > 0 && comp._count >= comp.max) return;

      var sx = n(ctx.entity.transform.x, 0), sy = n(ctx.entity.transform.y, 0);
      // jitter: ctx.rng 만 사용(결정적).
      if (comp.jitter > 0 && ctx.rng && typeof ctx.rng.float === 'function') {
        sx += ctx.rng.float(-comp.jitter, comp.jitter);
        sy += ctx.rng.float(-comp.jitter, comp.jitter);
      }

      // template 깊은 복제 + 위치 주입(id 는 코어가 발급).
      var ent = JSON.parse(JSON.stringify(comp.template));
      if (!isObj(ent)) ent = { components: [] };
      delete ent.id;   // 새 id 강제 발급(중복 방지)
      ent.transform = isObj(ent.transform) ? ent.transform : {};
      ent.transform.x = sx;
      ent.transform.y = sy;

      SK.applyCommand(ctx.world, { type: 'addEntity', entity: ent });
      comp._count += 1;
    },

    inspectorFields: [
      { key: 'template', label: '생성 템플릿', type: 'json', required: true },
      { key: 'interval', label: '생성 간격(초)', type: 'number', min: 0.01, required: true },
      { key: 'max',      label: '최대 생성 수(0=무한)', type: 'number', min: 0, default: 0 },
      { key: 'jitter',   label: '위치 흔들림(±px)', type: 'number', min: 0, default: 0 }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 12. CameraFollow — 카메라 추적(데이터만, 실제 카메라는 어댑터)
   *
   * step: ctx.world.camera = {x,y} 결정적 갱신. t=0 = 타깃에 스냅.
   * lerp(0..1): 1=즉시 추적, <1=감속 추적(결정적 보간).
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('CameraFollow', {
    schema: {
      target: { type: 'string', required: false, desc: '추적 대상(기본 "self")' },
      lerp:   { type: 'number', required: false, desc: '추적 보간(0..1, 1=즉시)' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('CameraFollow');
      if (!comp) return;
      if (typeof comp.target !== 'string') comp.target = 'self';
      if (typeof comp.lerp !== 'number' || !isFinite(comp.lerp)) comp.lerp = 1;
      comp.lerp = Math.max(0, Math.min(1, comp.lerp));
      // t=0 스냅: 타깃 위치로 카메라 즉시 설정.
      var tgt = resolveTarget(ctx.world, ctx.entity, comp.target);
      if (tgt) {
        ctx.world.camera = { x: n(tgt.transform.x, 0), y: n(tgt.transform.y, 0) };
      }
    },

    step: function (ctx, dt) {
      var comp = ctx.getComponent('CameraFollow');
      if (!comp) return;
      var tgt = resolveTarget(ctx.world, ctx.entity, comp.target);
      if (!tgt) return;
      var tx = n(tgt.transform.x, 0), ty = n(tgt.transform.y, 0);
      if (!isObj(ctx.world.camera)) { ctx.world.camera = { x: tx, y: ty }; return; }
      var cam = ctx.world.camera;
      if (!(dt > 0) || comp.lerp >= 1) {
        cam.x = tx; cam.y = ty;
      } else {
        cam.x = n(cam.x, tx) + (tx - n(cam.x, tx)) * comp.lerp;
        cam.y = n(cam.y, ty) + (ty - n(cam.y, ty)) * comp.lerp;
      }
    },

    inspectorFields: [
      { key: 'target', label: '추적 대상', type: 'string', default: 'self' },
      { key: 'lerp',   label: '추적 보간(0..1)', type: 'number', min: 0, max: 1, default: 1 }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 13. AbilityBinding — 능력 쿨다운/발동(결정적 타이머)
   *
   * abilitykit.js 의 쿨다운 의미를 따르되 상태를 JSON 직렬화 가능 _ 필드로 보관
   * (hashState 결정성·라이브 인스턴스 비직렬화 회피). 실제 VFX 는 어댑터 몫.
   * 입력은 결정적 주입: world.meta.abilityInput(entity) -> [abilityId,...] 발동 요청.
   * step: _cooldowns 감소, 발동 요청 중 준비된 능력 사용 → 쿨다운 시작 + 이벤트 누적.
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('AbilityBinding', {
    schema: {
      abilities: { type: 'array',  required: false, desc: '[{id,cooldown}] 능력 목록' },
      bindings:  { type: 'object', required: false, desc: '{ 키: abilityId } 입력 바인딩(어댑터용 메타)' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('AbilityBinding');
      if (!comp) return;
      comp.abilities = arr(comp.abilities);
      comp._cooldowns = {};   // abilityId → 남은 쿨다운(초)
      for (var i = 0; i < comp.abilities.length; i++) {
        var ab = comp.abilities[i];
        if (ab && ab.id != null) comp._cooldowns[String(ab.id)] = 0;
      }
    },

    step: function (ctx, dt) {
      var comp = ctx.getComponent('AbilityBinding');
      if (!comp) return;

      // 쿨다운 감소(결정적).
      if (dt > 0) {
        var keys = Object.keys(comp._cooldowns);
        for (var k = 0; k < keys.length; k++) {
          if (comp._cooldowns[keys[k]] > 0) comp._cooldowns[keys[k]] = Math.max(0, comp._cooldowns[keys[k]] - dt);
        }
      }

      // 발동 요청(결정적 주입): world.meta.abilityInput(entity) -> [id,...].
      var requested = null;
      if (ctx.world.meta && typeof ctx.world.meta.abilityInput === 'function') {
        requested = ctx.world.meta.abilityInput(ctx.entity);
      }
      if (!Array.isArray(requested) || requested.length === 0) return;

      // 능력 cooldown 조회 맵.
      var cdOf = {};
      for (var a = 0; a < comp.abilities.length; a++) {
        var ab2 = comp.abilities[a];
        if (ab2 && ab2.id != null) cdOf[String(ab2.id)] = n(ab2.cooldown, 0);
      }

      for (var r = 0; r < requested.length; r++) {
        var id = String(requested[r]);
        if (!(id in comp._cooldowns)) continue;       // 미등록 능력 무시
        if (comp._cooldowns[id] > 0) continue;         // 쿨다운 중
        comp._cooldowns[id] = cdOf[id] || 0;           // 쿨다운 시작
        // 발동 이벤트 누적(어댑터가 drain). 결정적 데이터만.
        if (!Array.isArray(ctx.world.abilityEvents)) ctx.world.abilityEvents = [];
        ctx.world.abilityEvents.push({ entity: ctx.entity.id, ability: id, t: n(ctx.world.time, 0) });
      }
    },

    inspectorFields: [
      { key: 'abilities', label: '능력 목록', type: 'json', placeholder: '[{"id":"dash","cooldown":1.5}]' },
      { key: 'bindings',  label: '입력 바인딩', type: 'json', placeholder: '{"Space":"dash"}' }
    ]
  });

  /* ──────────────────────────────────────────────────────────────────────────
   * 14. AudioEmitter — 오디오 이벤트 누적(재생은 어댑터 몫)
   *
   * 불변식: 코어 step 에서 soundforge/chipaudio 재생 호출 금지(Web Audio=브라우저).
   * 대신 ctx.world.audioEvents 에 결정적으로 이벤트 누적 → 어댑터가 drain.
   * trigger: 'onSpawn'(init 1회) | 'onStep'(쿨다운마다) | 'manual'(_pending 플래그).
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('AudioEmitter', {
    schema: {
      sound:    { type: 'string', required: true,  desc: '재생할 사운드 키/정의 id' },
      trigger:  { type: 'enum',   values: ['onSpawn', 'onStep', 'manual'], required: false },
      cooldown: { type: 'number', required: false, desc: 'onStep 발화 간격(초)' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('AudioEmitter');
      if (!comp) return;
      if (typeof comp.sound !== 'string') comp.sound = '';
      var valid = { onSpawn: 1, onStep: 1, manual: 1 };
      if (!valid[comp.trigger]) comp.trigger = 'manual';
      if (typeof comp.cooldown !== 'number' || !isFinite(comp.cooldown) || comp.cooldown < 0) comp.cooldown = 0;
      comp._cd = 0;
      comp._pending = false;   // manual 발화 요청(어댑터/입력이 세팅)
      // onSpawn: init 시 1회 누적.
      if (comp.trigger === 'onSpawn' && comp.sound) emitAudio(ctx, comp.sound);
    },

    step: function (ctx, dt) {
      var comp = ctx.getComponent('AudioEmitter');
      if (!comp || !comp.sound) return;

      if (dt > 0 && comp._cd > 0) comp._cd = Math.max(0, comp._cd - dt);

      if (comp.trigger === 'onStep') {
        if (comp._cd > 0) return;
        emitAudio(ctx, comp.sound);
        comp._cd = comp.cooldown;
      } else if (comp.trigger === 'manual' && comp._pending) {
        if (comp._cd > 0) { comp._pending = false; return; }
        emitAudio(ctx, comp.sound);
        comp._cd = comp.cooldown;
        comp._pending = false;
      }
    },

    inspectorFields: [
      { key: 'sound',    label: '사운드 키', type: 'string', required: true },
      { key: 'trigger',  label: '발화 시점', type: 'enum',
        options: [ { value: 'manual', label: '수동' }, { value: 'onSpawn', label: '생성 시' }, { value: 'onStep', label: '주기적' } ],
        default: 'manual' },
      { key: 'cooldown', label: '발화 간격(초)', type: 'number', min: 0, default: 0 }
    ]
  });

  // 오디오 이벤트 누적(재생 X, 데이터만). 결정적.
  function emitAudio(ctx, sound) {
    if (!Array.isArray(ctx.world.audioEvents)) ctx.world.audioEvents = [];
    ctx.world.audioEvents.push({ entity: ctx.entity.id, sound: sound, t: n(ctx.world.time, 0) });
  }

  /* ──────────────────────────────────────────────────────────────────────────
   * 15. HUDBinding — HUD 데이터 바인딩(데이터만, 렌더는 어댑터)
   *
   * source: 같은 엔티티의 'Component.field' 경로(예 'Health.hp') 또는
   *         'world.counters.coin' 같은 world 경로. step 에서 결정적으로 값 산출.
   * 산출값은 comp._value 에 보관 + ctx.world.hud[element] 에 미러(어댑터가 읽음).
   * ──────────────────────────────────────────────────────────────────────── */
  SK.registerComponent('HUDBinding', {
    schema: {
      element: { type: 'string', required: true,  desc: 'HUD 요소 id' },
      source:  { type: 'string', required: true,  desc: "값 경로 예 'Health.hp' 또는 'world.counters.coin'" },
      format:  { type: 'string', required: false, desc: '표시 포맷 힌트(어댑터 해석)' }
    },

    init: function (ctx) {
      var comp = ctx.getComponent('HUDBinding');
      if (!comp) return;
      if (typeof comp.element !== 'string') comp.element = '';
      if (typeof comp.source !== 'string') comp.source = '';
      comp._value = null;
      computeHud(ctx, comp);   // t=0 초기값 산출.
    },

    step: function (ctx) {
      var comp = ctx.getComponent('HUDBinding');
      if (!comp) return;
      computeHud(ctx, comp);
    },

    inspectorFields: [
      { key: 'element', label: 'HUD 요소 id', type: 'string', required: true },
      { key: 'source',  label: '값 경로', type: 'string', required: true, placeholder: 'Health.hp' },
      { key: 'format',  label: '포맷 힌트', type: 'string', placeholder: 'HP: {v}' }
    ]
  });

  // source 경로에서 결정적으로 값 산출 → comp._value + world.hud 미러.
  function computeHud(ctx, comp) {
    var val = null;
    var src = comp.source || '';
    if (src.indexOf('world.') === 0) {
      // world 경로: 'world.counters.coin' → ctx.world.counters.coin
      var parts = src.split('.').slice(1);
      var cur = ctx.world;
      for (var i = 0; i < parts.length && cur != null; i++) cur = cur[parts[i]];
      val = (typeof cur === 'number' || typeof cur === 'string') ? cur : null;
    } else if (src.indexOf('.') > 0) {
      // 'Component.field' 경로: 같은 엔티티의 컴포넌트 필드.
      var seg = src.split('.');
      var compName = seg[0], field = seg[1];
      var c = ctx.getComponent(compName);
      if (c && (typeof c[field] === 'number' || typeof c[field] === 'string')) val = c[field];
    }
    comp._value = val;
    if (!isObj(ctx.world.hud)) ctx.world.hud = {};
    if (comp.element) ctx.world.hud[comp.element] = val;
  }

  // Node 환경에서는 SceneKit 을 다시 export (체이닝 편의).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SK;
  }

})(typeof window !== 'undefined' ? window : this);
