/* ============================================================================
 * EventBus — 씬↔HUD 디커플링용 결정론 이벤트 버스 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * 게임 씬(Game)이 점수/목숨/타임을 바꿀 때 HUD(UIScene)를 *직접 참조*하면 둘이
 * 단단히 결합돼 테스트·재구성이 어려워진다. EventBus 는 그 사이에 끼는 1급 부품 —
 * 씬은 `bus.emit('score', v)` 로 사실(fact)만 알리고, HUD 는 `bus.on('score', ...)`
 * 로 구독한다. 씬은 HUD 의 존재를 모른다(발행/구독 디커플).
 *
 * RngForge·JuiceKit 와 동일한 "월클럭 시각함수 미사용 결정론" 철학을 잇는다 —
 * game-qa 헤드리스 step 하니스에서 이벤트 흐름이 **항상 같은 순서로 재현**되도록,
 * 디스패치는 100% 동기·등록순이며 Math.random/Date.now/performance.now 를 쓰지 않는다.
 *
 * 결정론 3원칙:
 *   1) 등록순 동기 디스패치 — 같은 이벤트의 핸들러는 on() 호출 순서대로 즉시 실행.
 *      비동기(setTimeout/Promise) 없음 → emit 이 반환되면 모든 핸들러가 이미 끝나 있다.
 *   2) 스냅샷 격리 — emit 은 호출 시점 핸들러 목록의 *사본*을 순회한다. 디스패치 중
 *      on/off/once/clear 가 일어나도 현재 emit 루프는 오염되지 않고, 변경은 다음 emit 부터.
 *   3) 누수 없는 해제 — off 로 정확히 해제, clear 로 일괄 해제, once 는 1회 호출 후 자동 해제.
 *
 * 사용:
 *   var bus = new EventBus();
 *
 *   // HUD(UIScene): 씬을 직접 참조하지 않고 사실만 구독
 *   bus.on('score', function (v) { this.scoreTxt.setText('SCORE ' + v); }, uiScene);
 *   bus.once('gameover', function () { this.showBanner('GAME OVER'); }, uiScene);
 *
 *   // 씬(GameScene): HUD 의 존재를 모르고 사실만 발행
 *   bus.emit('score', 1200);          // 등록된 score 핸들러가 등록순 동기 실행
 *   bus.emit('gameover');             // once 핸들러는 1회 후 자동 해제
 *
 *   // 해제
 *   bus.off('score', fn);             // 특정 핸들러 1개
 *   bus.off('score');                 // score 의 모든 핸들러
 *   bus.clear('score');               // off('score') 와 동일(이벤트 1종 비움)
 *   bus.clear();                      // 전체 비움(씬 전환·재시작 시)
 *
 * 에러 격리:
 *   기본값(rethrow=false)에서 한 핸들러가 throw 해도 나머지 핸들러는 정상 디스패치되고,
 *   수집된 에러는 onError 콜백(있으면)으로 통지된다. 디버깅 위해 첫 에러를 그대로
 *   다시 던지고 싶으면 new EventBus({ rethrow: true }) — 이 경우 첫 throw 에서 즉시 중단된다.
 *
 * 주의:
 *   - 디스패치는 동기다. 핸들러 안에서 무거운 작업/무한 루프를 돌리지 말 것(프레임 블로킹).
 *   - 같은 (event, fn, ctx) 조합을 on 으로 두 번 등록하면 두 번 호출된다(중복 허용).
 *     off(event, fn) 은 그 fn 의 *모든* 등록을 제거한다(ctx 무관).
 *   - 시각함수·무작위 미사용 — 결정적 테스트에 사용. 헤드리스(Node require) 가능.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var BUS_VERSION = '1.0.0';

  // opts = { rethrow:bool, onError:function(err, event, fn) }
  //  - rethrow=false(기본): 핸들러 throw 를 격리. 나머지 핸들러는 계속 디스패치되고,
  //    각 에러는 onError(있으면)로 통지. emit 은 정상 반환.
  //  - rethrow=true: 첫 throw 에서 즉시 중단하고 그 에러를 호출자에게 다시 던진다(디버깅).
  function EventBus(opts) {
    opts = opts || {};
    this._handlers = {};                       // event(string) → [ {fn, ctx, once} ]
    this.rethrow = !!opts.rethrow;             // 핸들러 throw 정책(기본 격리)
    this.onError = typeof opts.onError === 'function' ? opts.onError : null;
  }

  // 내부: 이벤트의 핸들러 배열 확보(없으면 생성).
  EventBus.prototype._list = function (event) {
    var arr = this._handlers[event];
    if (!arr) { arr = []; this._handlers[event] = arr; }
    return arr;
  };

  // on(event, fn, ctx?): 핸들러를 등록순 끝에 추가. 같은 조합 중복 등록 허용.
  // ctx 가 있으면 디스패치 시 fn.call(ctx, ...args) 로 this 가 바인딩된다.
  EventBus.prototype.on = function (event, fn, ctx) {
    if (typeof fn !== 'function') return this;
    this._list(event).push({ fn: fn, ctx: ctx, once: false });
    return this;
  };

  // once(event, fn, ctx?): 1회만 호출되고 자동 해제되는 핸들러 등록.
  EventBus.prototype.once = function (event, fn, ctx) {
    if (typeof fn !== 'function') return this;
    this._list(event).push({ fn: fn, ctx: ctx, once: true });
    return this;
  };

  // off(event, fn?): 핸들러 해제.
  //  - fn 지정: 해당 event 에서 그 fn 의 *모든* 등록을 제거(ctx 무관).
  //  - fn 미지정: 해당 event 의 모든 핸들러 제거(clear(event) 와 동일).
  EventBus.prototype.off = function (event, fn) {
    var arr = this._handlers[event];
    if (!arr) return this;
    if (fn === undefined) { delete this._handlers[event]; return this; }
    // 사본이 아닌 원본을 제자리 압축 — 진행 중 emit 은 자기 스냅샷을 보므로 안전.
    var kept = [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].fn !== fn) kept.push(arr[i]);
    }
    if (kept.length) this._handlers[event] = kept;
    else delete this._handlers[event];
    return this;
  };

  // clear(event?): event 지정 시 그 이벤트만, 미지정 시 전체 핸들러 일괄 해제.
  // 씬 전환·게임 재시작에서 누수 없이 모든 구독을 끊을 때 쓴다.
  EventBus.prototype.clear = function (event) {
    if (event === undefined) this._handlers = {};
    else delete this._handlers[event];
    return this;
  };

  // emit(event, ...args): 등록순으로 핸들러를 동기 디스패치.
  // 핵심 결정론: 호출 시점 핸들러 목록의 *사본*을 순회한다 → 디스패치 중 on/off/once/clear
  // 가 현재 루프를 오염시키지 않는다(변경은 다음 emit 부터 반영). once 핸들러는 호출 후 제거.
  // 반환: 디스패치된 핸들러 수(미등록 이벤트면 0, no-op).
  EventBus.prototype.emit = function (event) {
    var arr = this._handlers[event];
    if (!arr || !arr.length) return 0;

    // args = 두 번째 인자부터(이벤트명 제외). apply 로 핸들러에 그대로 전달.
    var n = arguments.length, args = new Array(n - 1), ai;
    for (ai = 1; ai < n; ai++) args[ai - 1] = arguments[ai];

    // 스냅샷: 현재 핸들러 목록의 얕은 사본을 순회(디스패치 중 변경 격리).
    var snapshot = arr.slice();
    var firstErr = null, errored = 0;

    for (var i = 0; i < snapshot.length; i++) {
      var h = snapshot[i];
      // once 는 호출 *전에* 원본에서 제거 — 디스패치 중 같은 이벤트 재-emit 돼도 중복 호출 방지.
      if (h.once) this.off(event, h.fn);
      try {
        if (h.ctx !== undefined) h.fn.apply(h.ctx, args);
        else h.fn.apply(null, args);
      } catch (e) {
        errored++;
        if (this.rethrow) throw e;              // 디버깅: 첫 throw 에서 즉시 중단·재던짐
        if (firstErr === null) firstErr = e;
        if (this.onError) {
          try { this.onError(e, event, h.fn); } catch (e2) { /* onError 자체 throw 무시 */ }
        }
      }
    }

    // 격리 모드: 에러가 있었고 onError 가 없으면 첫 에러를 콘솔에만 통지(디스패치는 이미 완료).
    if (firstErr !== null && !this.onError && typeof console !== 'undefined' && console.error) {
      console.error('[EventBus] handler error on "' + event + '":', firstErr);
    }
    return snapshot.length;
  };

  // 진단용 — event 의 현재 핸들러 수(미등록이면 0).
  EventBus.prototype.listenerCount = function (event) {
    var arr = this._handlers[event];
    return arr ? arr.length : 0;
  };

  // 진단용 — 핸들러가 1개 이상 등록된 이벤트 이름 배열.
  EventBus.prototype.eventNames = function () {
    var names = [];
    for (var k in this._handlers) {
      if (Object.prototype.hasOwnProperty.call(this._handlers, k)) names.push(k);
    }
    return names;
  };

  EventBus.VERSION = BUS_VERSION;
  EventBus.prototype.VERSION = BUS_VERSION;

  global.EventBus = EventBus;
  if (typeof module !== 'undefined' && module.exports) module.exports = EventBus;
})(typeof window !== 'undefined' ? window : this);
