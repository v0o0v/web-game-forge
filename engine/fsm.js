/* ============================================================================
 * FSM — 결정론 유한상태머신 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * 게임 로직의 *상태*(idle/walk/attack, 적 AI patrol/chase, cast→active→recovery
 * 능력 페이즈)를 한 곳에서 결정론적으로 굴린다. JuiceKit 이 *게임필 상태 머신*,
 * AbilityKit 이 *능력 타이밍·자원* 이라면, FSM 은 *범용 상태 전이 엔진* — 상태마다
 * enter/update/exit 콜백을 달고 update(dt) 한 진입점으로 진행하며, 명시 전이 to(name)
 * 와 규칙 기반 자동 전이를 모두 지원한다.
 *
 * 핵심 4요소:
 *   1) 범용 상태   — addState(name, {enter,update,exit}). enter/exit 는 전이 경계,
 *      update(ctx,dt) 는 매 프레임. update 콜백이 문자열(상태명)을 반환하면 그 상태로 전이.
 *   2) 전이        — to(name): 명시 전이(exit→enter). when(from,to,cond): 규칙 기반 자동
 *      전이(update 중 조건 만족 시 전이). 같은 dt·같은 입력 → 항상 같은 전이.
 *   3) 결정론      — dt 구동. 무작위가 필요하면 주입된 RngForge 난수기로만(Math.random
 *      금지, 시각함수 미사용). 같은 시드 + 같은 dt 시퀀스 → 동일 상태 궤적.
 *   4) 능력 페이즈 — FSM.forAbility(ability[,opts]): cast(선딜)→active(발동)→
 *      recovery(후딜)→idle 를 지속시간(초)으로 자동 진행하는 타임드 머신을 구성한다.
 *      각 페이즈 enter/exit 콜백, 캔슬(cast 중 입력으로 중단) 지원.
 *
 * AbilityKit 페이즈 소비(1급 유스케이스):
 *   abilities.json 의 ability.cast/active/recovery 는 **초 단위 지속시간**이다
 *   (activation-feel.md: 선딜→발동→후딜, 예 cast:0, active:0.12, recovery:0.18).
 *   AbilityKit.use() 는 즉발(쿨다운·자원만 굴림)이라 이 페이즈를 시간으로 소비하지
 *   않는다. FSM.forAbility(ability) 가 그 *시간 소비*를 맡는다 — use() 성공 시
 *   startAbility() 로 시동하면 dt 구동으로 cast→active→recovery→idle 을 진행하고,
 *   각 페이즈 경계에서 onCast/onActive/onRecovery/onIdle 콜백을 호출한다.
 *
 * 결정론: dt 구동(time/performance 미사용). 무작위는 주입 RngForge 만. 같은 시드 +
 * 같은 dt 시퀀스 → 항상 같은 상태 궤적(헤드리스 검증 가능).
 *
 * 사용(범용):
 *   var fsm = new FSM({ initial: 'idle', rng: RngForge.create(123) });
 *   fsm.addState('idle', { enter: function (ctx) {}, update: function (ctx, dt) {
 *     if (ctx.wantMove) return 'walk';            // 반환값 = 전이할 상태
 *   } });
 *   fsm.addState('walk', { update: function (ctx, dt) { if (!ctx.wantMove) return 'idle'; } });
 *   fsm.when('idle', 'hurt', function (ctx) { return ctx.hp < ctx.lastHp; });  // 규칙 전이
 *   fsm.start();                                  // initial 상태 enter
 *   // 매 프레임:
 *   fsm.update(dt, ctx);                          // dt = 초 단위 델타, ctx = 게임이 주는 컨텍스트
 *   if (fsm.current() === 'walk') { ... }
 *
 * 사용(AbilityKit 페이즈):
 *   var dashFsm = FSM.forAbility(KIT.get('dash'), {
 *     onCast:     function (ctx) { showWindup(); },
 *     onActive:   function (ctx) { doDash(ctx.dir); },   // 실제 효과는 발동 페이즈에서
 *     onRecovery: function (ctx) { lockInput(); },
 *     onIdle:     function (ctx) { unlockInput(); },
 *     rng: RngForge.create(7)
 *   });
 *   // 입력에서 능력 시동(AbilityKit.use 가 성공한 뒤):
 *   if (KIT.use('dash', { dir: facing }).ok) dashFsm.startAbility({ dir: facing });
 *   // 매 프레임: dashFsm.update(dt, ctx);
 *   // 캔슬(예: 피격으로 선딜 중단): dashFsm.cancel();   // cast 중에만 'idle' 로 복귀
 *
 * 주의:
 *   - update(dt, ctx) 의 dt 는 **초 단위**(예: 1/60 ≈ 0.0167). cast/active/recovery 도 초.
 *   - update 의 NaN/Infinity 가드(JuiceKit 선례): !Number.isFinite(dt)||dt<0 → 0.
 *   - 콜백·전이는 동기. enter 안에서 즉시 전이가 필요하면 update 가 상태명을 반환하게 한다.
 *   - 헤드리스(Node require) 가능 — 외부 상태(DOM/시각) 의존 0. 결정적 테스트에 사용.
 * ==========================================================================*/
(function (global) {
  'use strict';

  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function isFn(f) { return typeof f === 'function'; }

  /* FSM(opts)
   *  opts : {
   *    initial : string        // 시작 상태명(start() 호출 시 enter)
   *    rng     : rngForge       // 결정론 무작위 소스(전이에 무작위 필요 시). Math.random 금지.
   *    onTransition(from, to, ctx)   // 모든 전이 시(디버그·연출 훅)
   *  }
   */
  function FSM(opts) {
    if (!(this instanceof FSM)) return new FSM(opts);
    opts = opts || {};
    this.states = {};            // name -> { enter, update, exit }
    this.rules = {};             // fromName -> [ { to, cond } ]  규칙 기반 자동 전이
    this._cur = null;            // 현재 상태명(미시작이면 null)
    this._initial = opts.initial != null ? opts.initial : null;
    this._stateTime = 0;         // 현재 상태 진입 후 누적 시간(초) — update 콜백·페이즈에 유용
    this._totalTime = 0;         // FSM 누적 시간(초, 결정론 기준)
    this._started = false;

    // 무작위 소스 — 주입 우선, 없으면 전역 RngForge 기본 시드, 그래도 없으면 null.
    this.rng = opts.rng || (global.RngForge ? global.RngForge.create('fsm') : null);

    this._onTransition = isFn(opts.onTransition) ? opts.onTransition : null;
  }

  // ── 상태/규칙 정의 ────────────────────────────────────────────────────────
  // addState(name, { enter?, update?, exit? })
  //   enter(ctx)        — 상태 진입 시 1회
  //   update(ctx, dt)   — 매 프레임. 문자열(상태명) 반환 시 그 상태로 전이.
  //   exit(ctx)         — 상태 이탈 시 1회
  FSM.prototype.addState = function (name, def) {
    def = def || {};
    this.states[name] = {
      enter: isFn(def.enter) ? def.enter : null,
      update: isFn(def.update) ? def.update : null,
      exit: isFn(def.exit) ? def.exit : null
    };
    if (this._initial == null) this._initial = name;   // 첫 등록 상태를 기본 initial 로
    return this;
  };

  // when(from, to, cond) — from 상태 update 중 cond(ctx) 가 참이면 to 로 자동 전이.
  // from = '*' 이면 모든 상태에서 검사(전역 규칙). 같은 from 에 여러 규칙 가능(등록 순서대로 평가).
  FSM.prototype.when = function (from, to, cond) {
    if (!this.rules[from]) this.rules[from] = [];
    this.rules[from].push({ to: to, cond: isFn(cond) ? cond : function () { return false; } });
    return this;
  };

  // ── 조회 ──────────────────────────────────────────────────────────────────
  FSM.prototype.current = function () { return this._cur; };
  FSM.prototype.is = function (name) { return this._cur === name; };
  FSM.prototype.has = function (name) { return !!this.states[name]; };
  FSM.prototype.stateTime = function () { return this._stateTime; };   // 현재 상태 누적 시간(초)
  FSM.prototype.totalTime = function () { return this._totalTime; };

  // ── 시작/전이 ──────────────────────────────────────────────────────────────
  // start([ctx]) — initial 상태로 진입(enter 호출). 이미 시작했으면 무시.
  FSM.prototype.start = function (ctx) {
    if (this._started) return this;
    this._started = true;
    if (this._initial != null) this._enter(this._initial, ctx);
    return this;
  };

  // to(name[, ctx]) — 명시 전이. 현재 상태 exit → name 상태 enter. 같은 상태면 재진입(re-enter).
  // 미정의 상태로의 전이는 무시(안전). 시작 전 호출 시 자동 start 처리.
  FSM.prototype.to = function (name, ctx) {
    if (!this.states[name]) return false;
    this._started = true;
    this._exit(ctx);
    this._enter(name, ctx);
    return true;
  };

  FSM.prototype._enter = function (name, ctx) {
    var from = this._cur;
    this._cur = name;
    this._stateTime = 0;
    if (this._onTransition) this._onTransition(from, name, ctx);
    var st = this.states[name];
    if (st && st.enter) st.enter(ctx);
  };

  FSM.prototype._exit = function (ctx) {
    var st = this._cur != null ? this.states[this._cur] : null;
    if (st && st.exit) st.exit(ctx);
  };

  // ── 매 프레임 진행(초 단위 dt) ───────────────────────────────────────────
  // update(dt, ctx)
  //   1) 현재 상태 update(ctx, dt) 호출 — 반환값이 상태명이면 그 상태로 전이.
  //   2) 전이 안 했으면 규칙(when) 평가 — from='현재' 또는 '*' 규칙 중 첫 참인 to 로 전이.
  // 전이가 일어나면 이번 프레임은 한 번만 전이(연쇄 전이 방지 — 결정론·무한루프 회피).
  FSM.prototype.update = function (dt, ctx) {
    if (!Number.isFinite(dt) || dt < 0) dt = 0;   // NaN/Infinity/음수 가드(JuiceKit 선례)
    if (!this._started) this.start(ctx);
    if (this._cur == null) return this;

    this._totalTime += dt;
    this._stateTime += dt;

    var st = this.states[this._cur];

    // 1) 상태 update 콜백 — 문자열 반환 시 전이
    if (st && st.update) {
      var next = st.update(ctx, dt);
      if (typeof next === 'string' && next !== this._cur && this.states[next]) {
        this.to(next, ctx);
        return this;
      }
    }

    // 2) 규칙 기반 자동 전이(현재 상태 규칙 + 전역 '*' 규칙)
    var fired = this._evalRules(this._cur, ctx);
    if (!fired) this._evalRules('*', ctx);
    return this;
  };

  // 규칙 평가 — from 의 규칙들을 순서대로 보고 첫 참인 to 로 전이. 전이했으면 true.
  FSM.prototype._evalRules = function (from, ctx) {
    var rules = this.rules[from];
    if (!rules) return false;
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.to !== this._cur && this.states[r.to] && r.cond(ctx)) {
        this.to(r.to, ctx);
        return true;
      }
    }
    return false;
  };

  // ── 리셋 ────────────────────────────────────────────────────────────────
  // reset([ctx]) — 미시작 상태로(현재 상태 exit 없이 초기화). 시드 고정 재현·재시작용.
  FSM.prototype.reset = function () {
    this._cur = null;
    this._started = false;
    this._stateTime = 0;
    this._totalTime = 0;
    return this;
  };

  /* ──────────────────────────────────────────────────────────────────────────
   * AbilityKit 페이즈 머신 — FSM.forAbility(ability, opts)
   * ----------------------------------------------------------------------------
   * abilities.json 의 ability.{cast,active,recovery}(초) 를 읽어
   * cast → active → recovery → idle 을 dt 로 자동 진행하는 타임드 FSM 을 만든다.
   *   - 지속시간 0(또는 미지정)인 페이즈는 건너뛴다(즉발 능력 = 전부 0 → cast 시동 즉시 idle).
   *   - 각 페이즈 경계에서 onCast/onActive/onRecovery/onIdle 콜백(ctx 전달).
   *   - startAbility(ctx): 'idle'(또는 미시작)에서만 시동. 이미 진행 중이면 무시(중복 시동 방지).
   *   - cancel(ctx): cast 페이즈 중에만 즉시 'idle' 로 복귀(선딜 캔슬). active/recovery 는
   *     커밋된 것으로 보아 캔슬 불가(설계자 의도 — cancelable:true 면 recovery 도 캔슬 허용).
   *   - phase(): 현재 페이즈명('idle'|'cast'|'active'|'recovery').
   *   - isBusy(): idle 이 아니면 true(능력 진행 중).
   *
   * opts: {
   *   onCast, onActive, onRecovery, onIdle  // 각 페이즈 진입 콜백(ctx)
   *   onPhase(phase, ctx)                   // 모든 페이즈 진입 시(통합 훅)
   *   cancelable : bool                     // true 면 recovery 중에도 cancel() 허용(기본 false)
   *   rng        : rngForge                  // 결정론(보통 페이즈 머신엔 무작위 불필요)
   * }
   * ────────────────────────────────────────────────────────────────────────── */
  FSM.forAbility = function (ability, opts) {
    ability = ability || {};
    opts = opts || {};
    var castDur = num(ability.cast, 0);
    var activeDur = num(ability.active, 0);
    var recoveryDur = num(ability.recovery, 0);

    var fsm = new FSM({ initial: 'idle', rng: opts.rng, onTransition: opts.onTransition });
    fsm.ability = ability;
    fsm.durations = { cast: castDur, active: activeDur, recovery: recoveryDur };
    fsm._cancelable = !!opts.cancelable;

    // 페이즈 진입 콜백 디스패치(개별 + 통합 onPhase)
    function fire(phase, ctx) {
      if (isFn(opts.onPhase)) opts.onPhase(phase, ctx);
      var k = 'on' + phase.charAt(0).toUpperCase() + phase.slice(1);
      if (isFn(opts[k])) opts[k](ctx);
    }

    // idle — 대기. 능력 시동은 startAbility() 가 'cast'(또는 첫 비-0 페이즈)로 보낸다.
    fsm.addState('idle', { enter: function (ctx) { fire('idle', ctx); } });

    // cast(선딜) — castDur 초 경과 후 active 로. 0 이면 즉시 active.
    fsm.addState('cast', {
      enter: function (ctx) { fire('cast', ctx); },
      update: function (ctx, dt) { if (fsm._stateTime >= castDur) return _afterCast(); }
    });

    // active(발동) — activeDur 초 경과 후 recovery 로. 실제 효과는 보통 여기 enter 에서.
    fsm.addState('active', {
      enter: function (ctx) { fire('active', ctx); },
      update: function (ctx, dt) { if (fsm._stateTime >= activeDur) return _afterActive(); }
    });

    // recovery(후딜) — recoveryDur 초 경과 후 idle 로.
    fsm.addState('recovery', {
      enter: function (ctx) { fire('recovery', ctx); },
      update: function (ctx, dt) { if (fsm._stateTime >= recoveryDur) return 'idle'; }
    });

    // 0-지속 페이즈 스킵 헬퍼 — 다음 비-0 페이즈명을 반환(update 반환값으로 전이).
    function _afterCast() { return activeDur > 0 ? 'active' : (recoveryDur > 0 ? 'recovery' : 'idle'); }
    function _afterActive() { return recoveryDur > 0 ? 'recovery' : 'idle'; }

    // startAbility(ctx) — 능력 시동. idle 에서만(중복 방지). 첫 비-0 페이즈로 진입.
    //   AbilityKit.use() 가 ok 일 때 호출하는 것을 권장(use 는 쿨다운·자원, 이건 페이즈 시간).
    fsm.startAbility = function (ctx) {
      if (!this._started) this.start(ctx);
      if (this._cur !== 'idle') return false;   // 진행 중이면 무시
      var first = castDur > 0 ? 'cast' : (activeDur > 0 ? 'active' : (recoveryDur > 0 ? 'recovery' : 'idle'));
      // 전부 0(즉발)이면 cast→active→recovery 를 한 프레임에 흘려 idle 재진입
      if (first === 'idle') { this.to('cast', ctx); }  // cast enter→다음 update 에서 즉시 idle 로
      else this.to(first, ctx);
      return true;
    };

    // cancel(ctx) — 선딜(cast) 중 중단 → idle. cancelable 면 recovery 도 허용.
    fsm.cancel = function (ctx) {
      if (this._cur === 'cast' || (this._cancelable && this._cur === 'recovery')) {
        this.to('idle', ctx);
        return true;
      }
      return false;
    };

    // phase() — 현재 페이즈명. isBusy() — idle 이 아니면 진행 중.
    fsm.phase = function () { return this._cur; };
    fsm.isBusy = function () { return this._cur != null && this._cur !== 'idle'; };

    fsm.start();   // idle 진입 — startAbility 전부터 phase()='idle' 로 보고
    return fsm;
  };

  global.FSM = FSM;
  if (typeof module !== 'undefined' && module.exports) module.exports = FSM;
})(typeof window !== 'undefined' ? window : this);
