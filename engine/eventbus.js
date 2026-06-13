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
 *   수집된 에러는 onError 콜백(있으면)으로 통지된다. onError 미지정 시 첫 에러를
 *   console.error(stderr)로 통지한다(테스트의 stdout JSON 계약과 분리돼 노이즈 없음).
 *   디버깅 위해 첫 에러를 그대로 다시 던지고 싶으면 new EventBus({ rethrow: true }) —
 *   이 경우 첫 throw 에서 즉시 중단된다.
 *
 * 주의:
 *   - 디스패치는 동기다. 핸들러 안에서 무거운 작업/무한 루프를 돌리지 말 것(프레임 블로킹).
 *   - 같은 (event, fn, ctx) 조합을 on 으로 두 번 등록하면 두 번 호출된다(중복 허용).
 *     off(event, fn) 은 그 fn 의 *모든* 등록을 제거한다(ctx 무관).
 *   - 재진입 가드: 핸들러 안에서 같은 이벤트를 emit 하면(재진입) 해당 emit 는 큐에
 *     적재되고 현재 루프 종료 후 순서대로 flush 된다(직렬화). 핸들러가 1회만 발화하고
 *     발화 순서가 결정적으로 보장된다.
 *   - 이벤트명 제한 없음: `constructor`, `__proto__`, `hasOwnProperty` 등 Object.prototype
 *     키도 이벤트명으로 안전하게 사용 가능(내부 맵이 null-prototype 객체이기 때문).
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
    // Object.create(null): null-prototype 맵 — constructor/hasOwnProperty/__proto__ 등
    // Object.prototype 키를 이벤트명으로 써도 충돌·크래시 없이 안전하게 동작한다.
    this._handlers = Object.create(null);      // event(string) → [ {fn, ctx, once} ]
    this.rethrow = !!opts.rethrow;             // 핸들러 throw 정책(기본 격리)
    this.onError = typeof opts.onError === 'function' ? opts.onError : null;
    // 재진입 가드 — emit 진행 중 같은 버스에 emit 하면 큐에 적재 후 flush(직렬화)
    this._emitting = false;
    this._queue = [];                          // [ {event, args} ] 재진입 대기 큐
  }

  // 내부: 이벤트의 핸들러 배열 확보(없으면 생성).
  EventBus.prototype._list = function (event) {
    var arr = this._handlers[event];
    if (!arr) { arr = []; this._handlers[event] = arr; }
    return arr;
  };

  // 내부: 핸들러 배열에서 특정 엔트리 객체 1개를 참조(===) 비교로 제거.
  // off(event, fn) 이 fn 기준으로 *모든* 등록을 제거하는 것과 달리,
  // _removeEntry 는 스냅샷에서 뽑아낸 그 레코드 객체 1개만 정확히 splice 한다.
  // 이를 통해 once 발화가 동일 fn 으로 등록된 영속 on() 핸들러를 건드리지 않는다.
  EventBus.prototype._removeEntry = function (event, entry) {
    var arr = this._handlers[event];
    if (!arr) return;
    var idx = arr.indexOf(entry);
    if (idx !== -1) arr.splice(idx, 1);
    if (arr.length === 0) delete this._handlers[event];
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
    if (event === undefined) {
      // Object.create(null) 로 교체해 null-prototype 보장을 유지한다.
      this._handlers = Object.create(null);
    } else {
      delete this._handlers[event];
    }
    return this;
  };

  // emit(event, ...args): 등록순으로 핸들러를 동기 디스패치.
  // 핵심 결정론: 호출 시점 핸들러 목록의 *사본*을 순회한다 → 디스패치 중 on/off/once/clear
  // 가 현재 루프를 오염시키지 않는다(변경은 다음 emit 부터 반영). once 핸들러는 호출 전 제거.
  // 재진입 가드: emit 진행 중 같은 버스에 emit 하면 큐에 적재 후 현재 루프 종료 시 flush(직렬화).
  // 반환: 스냅샷 기준 디스패치 시도 핸들러 수(에러/중단 무관). 미등록 이벤트면 0(no-op).
  EventBus.prototype.emit = function (event) {
    // args = 두 번째 인자부터(이벤트명 제외). apply 로 핸들러에 그대로 전달.
    var n = arguments.length, args = new Array(n - 1), ai;
    for (ai = 1; ai < n; ai++) args[ai - 1] = arguments[ai];

    // 재진입 가드: 현재 이 버스가 디스패치 중이면 큐에 적재하고 즉시 반환.
    // 큐에서 꺼낼 때 실제 핸들러 수를 알 수 없으므로 0 반환(재진입 emit 는 예약됨).
    if (this._emitting) {
      this._queue.push({ event: event, args: args });
      return 0;
    }

    var arr = this._handlers[event];
    if (!arr || !arr.length) {
      // 핸들러 없는 이벤트도 flush 는 일반 경로에서 처리해야 하므로 _emitting 플래그 없이 반환.
      return 0;
    }

    // 스냅샷: 현재 핸들러 목록의 얕은 사본을 순회(디스패치 중 변경 격리).
    var snapshot = arr.slice();
    var firstErr = null;

    this._emitting = true;
    try {
      for (var i = 0; i < snapshot.length; i++) {
        var h = snapshot[i];
        // once 는 호출 *전에* 엔트리 객체 참조로 제거(객체 식별) —
        // 동일 fn 이 on() 으로도 등록돼 있어도 이 once 레코드만 정확히 1개 제거된다.
        if (h.once) this._removeEntry(event, h);
        try {
          if (h.ctx !== undefined) h.fn.apply(h.ctx, args);
          else h.fn.apply(null, args);
        } catch (e) {
          if (this.rethrow) throw e;              // 디버깅: 첫 throw 에서 즉시 중단·재던짐
          if (firstErr === null) firstErr = e;
          if (this.onError) {
            try { this.onError(e, event, h.fn); } catch (e2) { /* onError 자체 throw 무시 */ }
          }
        }
      }
    } finally {
      // rethrow=true 로 throw 가 탈출해도 반드시 플래그를 해제하고 큐를 flush 한다.
      this._emitting = false;
      // 재진입 큐 flush — 적재 순서대로 직렬 처리(재귀 X, 루프).
      while (this._queue.length) {
        var pending = this._queue.shift();
        // emit 을 재귀 호출하지 않고 직접 dispatch 해 스택 무한 증가 방지.
        // _emitting 은 지금 false 이므로 정상 경로로 진입한다.
        this.emit.apply(this, [pending.event].concat(pending.args));
      }
    }

    // 격리 모드: 에러가 있었고 onError 가 없으면 첫 에러를 stderr(console.error)로 통지.
    // 이 통지는 stdout JSON 계약과 분리돼 테스트 파서에 노이즈를 주지 않는다.
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
