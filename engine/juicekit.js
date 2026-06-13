/* ============================================================================
 * JuiceKit — 게임필(juice) 런타임: trauma 셰이크·파티클·히트스톱·트윈 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * "타격감"을 만드는 4대 부품을 한 곳에서 결정론적으로 굴린다. ScreenFX 가 *카메라
 * 포스트FX(블룸·CRT)* 라면, JuiceKit 은 *게임필 상태 머신* — 화면 흔들림 오프셋,
 * 단명 파티클, 시간 정지(히트스톱), 트윈 진행을 update(dt) 한 진입점으로 굴리고,
 * getShake()/시각 조회로 렌더러(어떤 엔진이든)가 값을 읽어 적용한다. 역할이 겹치지
 * 않게 ScreenFX(포스트FX) 와 분리: JuiceKit 은 *값을 계산*만 하고 그리지 않는다.
 *
 * 핵심 4요소:
 *   1) trauma 스크린셰이크 — Squirrel Eiserloh 기법. addTrauma(amount) 로 누적,
 *      흔들림 강도 = trauma^2(비선형). offset/rotation 은 rngforge 노이즈로 샘플.
 *      update 에서 trauma 가 decayRate*dt 로 자연 감쇠. trauma 는 [0,1] clamp.
 *   2) 파티클 버스트   — burst(x,y,opts): 개수·속도·수명·중력·색. 무작위는 모두 rngforge.
 *   3) 히트스톱        — freeze(frames): N 프레임 timeScale 0 → 자동 복원. 타격 순간 정지.
 *   4) 트윈/이징       — tween(from,to,dur,ease): 표준 이징(easeOutQuad/easeInOutCubic/
 *      easeOutBack/...) 로 값 보간. onUpdate/onComplete 콜백.
 *
 * 결정론: 모든 무작위는 주입된 RngForge 난수기로만(Math.random 금지). 시각함수 미사용.
 * 같은 시드 + 같은 dt 시퀀스 → 항상 같은 셰이크/파티클 수열(헤드리스 검증 가능).
 *
 * 사용:
 *   var jk = new JuiceKit(RngForge.create(12345));   // 또는 new JuiceKit() 후 setRng()
 *   jk.addTrauma(0.6);                                // 적 피격
 *   jk.freeze(4);                                     // 4프레임 히트스톱
 *   jk.burst(120, 80, { count: 14, color: 0xffe23f }); // 코인 파편
 *   var t = jk.tween(0, 1, 0.4, 'easeOutBack', { onUpdate: function (v) { banner.scale = v; } });
 *   // 매 프레임:
 *   jk.update(dt);                                    // dt = 초 단위 델타
 *   var s = jk.getShake();                            // { x, y, rotation }
 *   cam.x = baseX + s.x; cam.y = baseY + s.y; cam.rotation = s.rotation;
 *   jk.forEachParticle(function (p) { draw(p.x, p.y, p.color, p.alpha, p.size); });
 *
 * 주의:
 *   - update(dt) 의 dt 는 **초 단위**(예: 1/60 ≈ 0.0167). frames 인자(freeze)는 프레임 수.
 *   - 셰이크 적용 시 timeScale 은 trauma decay/트윈/파티클에만 영향 — freeze 중에는 dt 가
 *     0 으로 스케일돼 모든 진행이 멈춘다(히트스톱). 셰이크 오프셋은 freeze 중에도 갱신된다
 *     (정지된 화면이 떨리는 타격 연출).
 *   - 렌더링은 하지 않는다. getShake()/forEachParticle() 로 값을 읽어 게임이 그린다.
 *   - 헤드리스(Node require) 가능 — 외부 상태(DOM/시각) 의존 0. 결정적 테스트에 사용.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var TWO_PI = Math.PI * 2;

  // ── 표준 이징 함수 모음 (t ∈ [0,1] → 보간 계수) ──────────────────────────
  // 이름은 css/tween 관용을 따른다. tween(ease) 인자로 이름(문자열) 또는 함수 전달.
  var EASING = {
    linear:         function (t) { return t; },
    easeInQuad:     function (t) { return t * t; },
    easeOutQuad:    function (t) { return t * (2 - t); },
    easeInOutQuad:  function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    easeInCubic:    function (t) { return t * t * t; },
    easeOutCubic:   function (t) { var u = t - 1; return u * u * u + 1; },
    easeInOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },
    easeInQuart:    function (t) { return t * t * t * t; },
    easeOutQuart:   function (t) { var u = t - 1; return 1 - u * u * u * u; },
    easeInSine:     function (t) { return 1 - Math.cos((t * Math.PI) / 2); },
    easeOutSine:    function (t) { return Math.sin((t * Math.PI) / 2); },
    easeInOutSine:  function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    easeOutBack:    function (t) { var c1 = 1.70158, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; },
    easeInBack:     function (t) { var c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
    easeOutElastic: function (t) {
      var c4 = TWO_PI / 3;
      if (t === 0) return 0;
      if (t === 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    easeOutBounce: function (t) {
      var n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
      if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
      t -= 2.625 / d1; return n1 * t * t + 0.984375;
    }
  };

  function resolveEase(ease) {
    if (typeof ease === 'function') return ease;
    if (typeof ease === 'string' && EASING[ease]) return EASING[ease];
    return EASING.easeOutQuad; // 기본
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  // ── 생성자 ────────────────────────────────────────────────────────────────
  // rng: RngForge.create(seed) 로 만든 난수기(callable). 미주입 시 기본 시드로 자동 생성.
  // 내부적으로 용도별 스트림을 분리(_shakeRng/_fxRng)해 셰이크·파티클 수열이 서로 영향을
  // 주지 않는다(등록 순서·호출 수 무관 결정론 보장).
  function JuiceKit(rng) {
    // 무작위 소스 — 주입 우선, 없으면 전역 RngForge 의 기본 시드, 그래도 없으면 null.
    this.rng = rng || (global.RngForge ? global.RngForge.create('juicekit') : null);

    // 용도별 스트림 분리. RngForge 주입 시 stream() 으로 독립 파생, 없으면 rng 그대로.
    // stream 없는 폴백(rng 미주입·비-RngForge 주입)에서도 기존 동작(0 폴백) 을 유지한다.
    this._shakeRng = (this.rng && this.rng.stream) ? this.rng.stream('jk:shake') : this.rng;
    this._fxRng    = (this.rng && this.rng.stream) ? this.rng.stream('jk:fx')    : this.rng;

    // trauma 셰이크
    this.trauma = 0;            // [0,1] 누적 충격량
    this.decayRate = 1.2;       // trauma 자연 감쇠 속도(초당). update 에서 trauma -= decayRate*dt
    this.maxOffset = 24;        // trauma=1 일 때 최대 픽셀 오프셋
    this.maxRotation = 0.08;    // trauma=1 일 때 최대 회전(rad)
    this._shake = { x: 0, y: 0, rotation: 0 };

    // 파티클
    this.particles = [];        // 활성 파티클 풀
    this.defaultGravity = 320;  // burst opts.gravity 미지정 시 기본 중력(px/s^2)
    this.presets = {};          // 이름→burst opts 프리셋(loadPresets 로 적재, burstPreset 로 발사)

    // 히트스톱
    this.timeScale = 1;         // update(dt) 에 곱해지는 시간 배율(freeze 중 0)
    this._freezeRemaining = 0;  // 남은 히트스톱 시간(프레임 단위)
    this._frameDur = 1 / 60;    // 1프레임의 초 환산(freeze 시간 카운트다운에 사용)

    // 트윈
    this.tweens = [];           // 활성 트윈
  }

  // 난수기 교체(테스트·리시드용). 스트림도 새 rng 에서 파생해 재설정한다.
  JuiceKit.prototype.setRng = function (rng) {
    this.rng = rng;
    this._shakeRng = (rng && rng.stream) ? rng.stream('jk:shake') : rng;
    this._fxRng    = (rng && rng.stream) ? rng.stream('jk:fx')    : rng;
    return this;
  };

  // 내부: [-1,1) 결정적 노이즈 1샘플 — 전용 셰이크 스트림 사용. rng 없으면 0(graceful).
  JuiceKit.prototype._noise = function () {
    return this._shakeRng ? (this._shakeRng() * 2 - 1) : 0;
  };

  // ── 1) trauma 스크린셰이크 ─────────────────────────────────────────────────
  // addTrauma(amount): 충격 누적. trauma 는 [0,1] clamp.
  JuiceKit.prototype.addTrauma = function (amount) {
    this.trauma = clamp01(this.trauma + (amount || 0));
    return this.trauma;
  };

  // 현재 셰이크 오프셋/회전 조회 — { x, y, rotation }.
  JuiceKit.prototype.getShake = function () { return this._shake; };
  JuiceKit.prototype.getTrauma = function () { return this.trauma; };

  // 내부: 현재 trauma 로 셰이크 오프셋 갱신. 강도 = trauma^2(비선형, Eiserloh).
  // offset/rotation 은 rngforge 노이즈로 샘플 → 같은 시드·같은 호출수면 동일.
  JuiceKit.prototype._updateShake = function () {
    var shakeAmount = this.trauma * this.trauma; // 비선형 강도
    this._shake.x = this.maxOffset * shakeAmount * this._noise();
    this._shake.y = this.maxOffset * shakeAmount * this._noise();
    this._shake.rotation = this.maxRotation * shakeAmount * this._noise();
    return this._shake;
  };

  // ── 2) 파티클 버스트 ───────────────────────────────────────────────────────
  // burst(x, y, opts): opts = { count, speed:[min,max], spread, life:[min,max],
  //                              gravity, color, size:[min,max], angle, fade }
  // 모든 무작위는 주입된 rng. emitter 를 만들지 않고 순수 데이터 파티클만 생성한다.
  JuiceKit.prototype.burst = function (x, y, opts) {
    opts = opts || {};
    var count = opts.count == null ? 12 : opts.count;
    var speedMin = 40, speedMax = 160;
    if (opts.speed != null) {
      if (typeof opts.speed === 'number') { speedMin = 0; speedMax = opts.speed; }
      else { speedMin = opts.speed[0]; speedMax = opts.speed[1]; }
    }
    var lifeMin = 0.3, lifeMax = 0.6;
    if (opts.life != null) {
      if (typeof opts.life === 'number') { lifeMin = lifeMax = opts.life; }
      else { lifeMin = opts.life[0]; lifeMax = opts.life[1]; }
    }
    var sizeMin = 2, sizeMax = 4;
    if (opts.size != null) {
      if (typeof opts.size === 'number') { sizeMin = sizeMax = opts.size; }
      else { sizeMin = opts.size[0]; sizeMax = opts.size[1]; }
    }
    var gravity = opts.gravity == null ? this.defaultGravity : opts.gravity;
    var color = opts.color == null ? 0xffffff : opts.color;
    var fade = opts.fade === false ? false : true;
    // angle: 발사 중심각(rad), spread: 좌우 퍼짐 폭(rad). 미지정 시 전방위(0..2π).
    var hasAngle = opts.angle != null;
    var centerAngle = hasAngle ? opts.angle : 0;
    var spread = opts.spread == null ? (hasAngle ? 0.6 : TWO_PI) : opts.spread;

    var created = [];
    for (var i = 0; i < count; i++) {
      var r = this._fxRng;
      var u = r ? r() : 0.5;
      var v = r ? r() : 0.5;
      var w = r ? r() : 0.5;
      var s = r ? r() : 0.5;
      var ang = hasAngle
        ? (centerAngle + (u - 0.5) * spread)
        : (u * spread);                       // 전방위면 [0, spread)
      var speed = speedMin + v * (speedMax - speedMin);
      var p = {
        x: x, y: y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: lifeMin + w * (lifeMax - lifeMin),
        maxLife: 0,
        gravity: gravity,
        color: color,
        size: sizeMin + s * (sizeMax - sizeMin),
        alpha: 1,
        fade: fade,
        dead: false
      };
      p.maxLife = p.life;
      this.particles.push(p);
      created.push(p);
    }
    return created;
  };

  // ── 2-b) 파티클 프리셋 ──────────────────────────────────────────────────────
  // 재사용 파티클 프리셋(particles.json)을 데이터로 적재해 이름으로 발사한다.
  // burst() 는 그대로 — burstPreset 은 프리셋 opts 를 병합 후 동일 burst() 를 호출하므로,
  // 같은 시드·같은 opts 면 직접 burst() 호출과 **비트 동일**한 결과(결정론 보존).

  // 내부: color 정규화 — '#rrggbb' / 'rrggbb' 6자리 hex 문자열이면 0xRRGGBB 정수로 변환.
  // lint-particles.checkColor 와 동일한 강도: 정확히 6자리 hex여야 통과, 그 외는 0xffffff 폴백.
  // 정수 입력은 & 0xffffff 마스킹(오버플로 방지). undefined/null 은 그대로(burst 기본값에 위임).
  function normalizeColor(c) {
    if (typeof c === 'string') {
      var h = c.charAt(0) === '#' ? c.slice(1) : c;
      return /^[0-9a-fA-F]{6}$/.test(h) ? parseInt(h, 16) : 0xffffff;  // 6자리 정확 검증
    }
    if (typeof c === 'number') return (c & 0xffffff) >>> 0;             // 오버플로 마스킹
    return c;                                                             // undefined 등 → burst 기본값
  }

  // loadPresets(json): particles.json 형태({ presets: { name: opts } }) 또는 평면
  // ({ name: opts }) 맵을 적재. 기존 프리셋에 병합(merge=false 면 교체). color 는 적재 시
  // 1회 정수 정규화해 burst() 가 기대하는 형식과 일치(직접 burst 와 동일 결과 보장).
  JuiceKit.prototype.loadPresets = function (json, merge) {
    if (!json) return this;
    var src = json.presets || json; // 래퍼({presets}) 또는 평면 맵 모두 허용
    if (merge === false) this.presets = {};
    for (var name in src) {
      if (!Object.prototype.hasOwnProperty.call(src, name)) continue;
      var raw = src[name];
      if (!raw || typeof raw !== 'object') continue;
      var opts = {};
      for (var k in raw) {
        if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
        if (k === 'desc') continue;               // 메타(설명)는 burst opts 아님 — 제외
        opts[k] = (k === 'color') ? normalizeColor(raw[k]) : raw[k];
      }
      this.presets[name] = opts;
    }
    return this;
  };

  // 프리셋 1개 조회(정규화된 opts **얕은 사본** 반환, 없으면 null).
  // 주석대로 사본을 반환해 호출자가 반환값을 변형해도 내부 presets 가 오염되지 않는다.
  JuiceKit.prototype.getPreset = function (name) {
    var p = this.presets[name];
    if (!p) return null;
    var copy = {};
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) copy[k] = p[k];
    return copy;
  };

  // burst() 가 인식하는 opts 필드 화이트리스트. burstPreset overrides 필터링에 사용.
  // desc 등 메타 필드 + 미지 키(오타)가 burst 로 새어드는 것을 막는다.
  var BURST_KNOWN_KEYS = { count:1, speed:1, spread:1, angle:1, life:1, gravity:1, color:1, size:1, fade:1 };

  // burstPreset(name, x, y, overrides?): 적재된 프리셋을 좌표(x,y)에서 발사한다.
  // overrides 로 프리셋 필드를 부분 덮어쓰기(color 는 문자열도 정규화). 미등록 이름이면
  // 경고 없이 빈 배열 반환(graceful). 내부적으로 burst() 를 호출 → 동일 opts 면 결정론 동일.
  // overrides 의 미지 키(desc, 오타 등)는 BURST_KNOWN_KEYS 화이트리스트로 걸러 burst 로 새지 않는다.
  JuiceKit.prototype.burstPreset = function (name, x, y, overrides) {
    var base = this.presets[name];
    if (!base) return [];
    var opts = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) opts[k] = base[k];
    if (overrides) {
      for (var o in overrides) {
        if (!Object.prototype.hasOwnProperty.call(overrides, o)) continue;
        if (!BURST_KNOWN_KEYS[o]) continue;  // 미지 키 필터링(desc·오타 등 차단)
        opts[o] = (o === 'color') ? normalizeColor(overrides[o]) : overrides[o];
      }
    }
    return this.burst(x, y, opts);
  };

  // 활성 파티클 순회(렌더용). dead 는 제외. 콜백(p) 호출.
  JuiceKit.prototype.forEachParticle = function (cb) {
    for (var i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].dead) cb(this.particles[i], i);
    }
    return this;
  };

  JuiceKit.prototype.particleCount = function () {
    var n = 0;
    for (var i = 0; i < this.particles.length; i++) if (!this.particles[i].dead) n++;
    return n;
  };

  // 내부: 파티클 물리 진행 + 수명 만료 처리. dt 는 (스케일 적용된) 초 델타.
  JuiceKit.prototype._updateParticles = function (dt) {
    var alive = [];
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      if (p.dead) continue;
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.fade && p.maxLife > 0) p.alpha = clamp01(p.life / p.maxLife);
      alive.push(p);
    }
    this.particles = alive; // 죽은 파티클 GC(배열 압축)
  };

  // ── 3) 히트스톱 ────────────────────────────────────────────────────────────
  // freeze(frames): N 프레임 동안 timeScale 0 (시간 정지) → 자동 복원. 누적은 max.
  JuiceKit.prototype.freeze = function (frames) {
    frames = frames == null ? 3 : frames;
    if (frames > this._freezeRemaining) this._freezeRemaining = frames;
    return this;
  };

  JuiceKit.prototype.isFrozen = function () { return this._freezeRemaining > 0; };

  // ── 4) 트윈/이징 ───────────────────────────────────────────────────────────
  // tween(from, to, dur, ease, opts): dur 초 동안 from→to 보간. ease=이름|함수.
  // opts = { onUpdate(value, t), onComplete(), delay }. 반환 핸들에 .cancel()/.value.
  JuiceKit.prototype.tween = function (from, to, dur, ease, opts) {
    opts = opts || {};
    var tw = {
      from: from, to: to,
      dur: dur == null ? 0.3 : dur,
      ease: resolveEase(ease),
      elapsed: 0,
      delay: opts.delay || 0,
      onUpdate: opts.onUpdate || null,
      onComplete: opts.onComplete || null,
      value: from,
      done: false,
      _cancelled: false
    };
    var self = this;
    tw.cancel = function () { tw._cancelled = true; tw.done = true; self._reapTweens(); return tw; };
    this.tweens.push(tw);
    return tw;
  };

  // 표준 이징 테이블 노출(외부에서 직접 참조·확장 가능).
  JuiceKit.prototype.easing = EASING;
  JuiceKit.EASING = EASING;

  JuiceKit.prototype._reapTweens = function () {
    var alive = [];
    for (var i = 0; i < this.tweens.length; i++) if (!this.tweens[i].done) alive.push(this.tweens[i]);
    this.tweens = alive;
  };

  // 내부: 트윈 진행. dt 는 (스케일 적용된) 초 델타.
  // step: 트윈-로컬 진행량. 공용 루프 변수 dt 를 덮어쓰지 않아 등록 순서 무관 결정론 보장.
  JuiceKit.prototype._updateTweens = function (dt) {
    var anyDone = false;
    for (var i = 0; i < this.tweens.length; i++) {
      var tw = this.tweens[i];
      if (tw.done) { anyDone = true; continue; }
      var step = dt;
      if (tw.delay > 0) {
        tw.delay -= dt;
        if (tw.delay > 0) continue;
        step = -tw.delay;      // 지연을 다 쓰고 남은 시간만큼만 진행(트윈-로컬)
        tw.delay = 0;
      }
      tw.elapsed += step;
      var t = tw.dur > 0 ? clamp01(tw.elapsed / tw.dur) : 1;
      var k = tw.ease(t);
      tw.value = tw.from + (tw.to - tw.from) * k;
      if (tw.onUpdate) tw.onUpdate(tw.value, t);
      if (t >= 1) {
        tw.value = tw.to;
        tw.done = true;
        anyDone = true;
        if (tw.onComplete) tw.onComplete();
      }
    }
    if (anyDone) this._reapTweens();
  };

  // ── update(dt) — 단일 진입점 ───────────────────────────────────────────────
  // dt: 초 단위 프레임 델타. trauma decay·파티클·히트스톱·트윈을 한 번에 진행한다.
  // 히트스톱 중에는 scaledDt=0 → trauma/파티클/트윈 정지. 단 셰이크 오프셋은 매 프레임
  // 갱신(정지된 화면이 떨리는 타격 연출). freeze 카운트다운은 실시간 dt 로 줄어든다.
  // NaN·Infinity 는 0 으로 처리(오염 방지). dt < 0 도 0 처리.
  JuiceKit.prototype.update = function (dt) {
    if (!Number.isFinite(dt) || dt < 0) dt = 0;

    // 히트스톱: timeScale 결정 + freeze 카운트다운(실시간).
    // freeze 해제 프레임의 초과분(overflow)은 scaledDt 로 환원해 잔여 시간만큼 정상 진행.
    var scaledDt;
    if (this._freezeRemaining > 0) {
      this.timeScale = 0;
      var frames = dt / this._frameDur;            // dt(초) → 프레임 환산
      this._freezeRemaining -= frames;
      if (this._freezeRemaining <= 0) {
        // 해제 프레임: 초과분(-_freezeRemaining 프레임)을 초로 환산해 정상 진행
        var overflow = -this._freezeRemaining * this._frameDur;
        this._freezeRemaining = 0;
        this.timeScale = 1;
        scaledDt = overflow > 0 ? overflow : 0;   // 잔여 시간만큼만 진행
      } else {
        scaledDt = 0;
      }
    } else {
      this.timeScale = 1;
      scaledDt = dt;
    }

    // trauma 자연 감쇠(스케일된 시간 — 히트스톱 중 멈춤).
    if (this.trauma > 0) {
      this.trauma = clamp01(this.trauma - this.decayRate * scaledDt);
    }
    // 셰이크 오프셋은 실시간 갱신(히트스톱 중에도 떨림).
    this._updateShake();

    // 파티클·트윈은 스케일된 시간으로(히트스톱 중 정지).
    this._updateParticles(scaledDt);
    this._updateTweens(scaledDt);

    return this;
  };

  // 전부 초기화(씬 전환·재시작용). rng/스트림은 유지(별도 setRng/reseed 로 교체).
  JuiceKit.prototype.reset = function () {
    this.trauma = 0;
    this._shake.x = this._shake.y = this._shake.rotation = 0;
    this.particles.length = 0;
    this.tweens.length = 0;
    this.timeScale = 1;
    this._freezeRemaining = 0;
    return this;
  };

  global.JuiceKit = JuiceKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = JuiceKit;
})(typeof window !== 'undefined' ? window : this);
