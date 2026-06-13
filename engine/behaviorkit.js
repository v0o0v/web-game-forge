/* ============================================================================
 * BehaviorKit — 런타임 behavior 킷 공통 계약 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * 엔진의 "런타임 behavior 킷"(매 프레임 dt 로 상태를 굴리는 결정론 부품 —
 * JuiceKit·FSM·AbilityKit·BoardKit·EventBus 등)이 *암묵적으로* 따라 온 공통
 * 패턴을 **명시 계약**으로 성문화한다. 이미 일관된 관례가 있으므로 새 규칙을
 * 발명하지 않고, 그 관례를 (1) 정적 명세(BehaviorKit.CONTRACT)와 (2) 런타임
 * 검증기(BehaviorKit.assertContract)로 *고정*해 회귀를 막는 것이 목적이다.
 *
 * ▶ 계약 5개 항목(엔진 킷 실측에서 추출):
 *   1) 모듈 노출 규약  — 각 킷은 IIFE `(function(global){ 'use strict'; ... })(...)`
 *      안에서 `global.X = X` 로 전역 노출 + `module.exports = X`(Node require 가능).
 *      → 빌드 없는 브라우저 전역 스크립트 + 헤드리스 결정 검증 양립.
 *   2) 결정론(시드 무작위)— 무작위가 필요하면 주입된 RngForge 난수기로만.
 *      `Math.random()` 금지. 같은 시드 → 같은 수열(rngforge.js 철학).
 *   3) 결정론(시각함수 0)— `Date.now()`/`performance.now()`/`new Date()` 를
 *      로직에 쓰지 않는다. 시간은 `update(dt)` 주입 인자(초)로만.
 *   4) update(dt) 가드 — `update(dt)` 를 제공한다면 첫 줄에서
 *      `!Number.isFinite(dt) || dt < 0 → dt = 0`(JuiceKit 선례). NaN/Infinity/
 *      음수가 내부 상태를 오염시키지 않게 막는다.
 *   5) reset() 제공     — 씬 전환·시드 고정 재현·재시작용 상태 초기화 메서드.
 *      (rng/스트림은 보통 유지 — 별도 setRng/reseed 로 교체.)
 *
 *   ※ 모든 킷이 5개 전부를 갖는 것은 아니다(EventBus·BoardKit 은 dt 구동이
 *     아니라 update 가드 비적용, 무작위 미사용이라 rng 주입 비적용). 계약은
 *     "해당 능력을 제공한다면 이렇게" 라는 **조건부 준수**다 — assertContract 는
 *     존재하는 능력만 엄격 검사하고, 없는 능력은 'n/a' 로 통과시킨다.
 *
 * ▶ 정적 검증(코드 텍스트): skills/wgf-game-qa/tools/lint-kit-deps.mjs 가
 *   매니페스트(engine/manifest.json)와 함께 결정론 위반(Math.random·시각함수)을
 *   교차 점검한다. BehaviorKit 은 그 *런타임 짝꿍* — 실제 인스턴스가 계약을
 *   지키는지(가드 동작·reset 존재·노출 형태)를 검사한다.
 *
 * 사용(런타임 검증):
 *   var JuiceKit = require('./juicekit.js');           // 또는 브라우저 전역
 *   var jk = new JuiceKit(RngForge.create(1));
 *   var rep = BehaviorKit.assertContract(jk, { name: 'JuiceKit', ctor: JuiceKit });
 *   if (!rep.ok) throw new Error('계약 위반: ' + JSON.stringify(rep.violations));
 *
 * 사용(정적 명세 조회):
 *   BehaviorKit.CONTRACT.items;     // [{ id, title, rule }, ...]
 *   BehaviorKit.describe();         // 사람용 요약 문자열
 *
 * 주의:
 *   - assertContract 는 *던지지 않는다* — { ok, name, checks[], violations[] } 리포트를
 *     반환한다(호출자가 throw 여부 결정). 헤드리스 테스트·부팅 자가검진 양쪽에 적합.
 *   - update 가드 검사는 *행위적* 이다: kit.update(NaN)/update(-1) 호출 후 상태가
 *     오염되지 않았는지(파괴적 throw 없이 통과 + 상태 수치 유한) 확인한다. 깊은
 *     상태 동치까지는 보지 않는다(킷마다 상태 모양이 다름). 부작용이 우려되면
 *     opts.skipUpdateProbe:true 로 행위 프로브를 끄고 메서드 존재만 검사.
 *   - 헤드리스(Node require) 가능 — 외부 상태(DOM/시각) 의존 0.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  function isFn(f) { return typeof f === 'function'; }

  // ── 정적 계약 명세 ──────────────────────────────────────────────────────────
  // 각 항목: { id, title, rule, applies } — applies 는 사람용 적용 조건 설명.
  var CONTRACT = {
    VERSION: VERSION,
    items: [
      {
        id: 'module-exposure',
        title: '모듈 노출 규약',
        rule: "IIFE `(function(global){ 'use strict'; ... })(...)` 안에서 `global.X=X` 전역 노출 + `module.exports=X`(Node require 가능).",
        applies: '모든 킷'
      },
      {
        id: 'determinism-rng',
        title: '결정론 — 시드 무작위',
        rule: '무작위는 주입된 RngForge 난수기로만. Math.random() 금지(같은 시드 → 같은 수열).',
        applies: '무작위를 쓰는 킷(juicekit·fsm·audio 등)'
      },
      {
        id: 'determinism-noclock',
        title: '결정론 — 시각함수 0',
        rule: 'Date.now()/performance.now()/new Date() 를 로직에 쓰지 않는다. 시간은 update(dt) 주입 인자(초)로만.',
        applies: '모든 킷'
      },
      {
        id: 'update-guard',
        title: 'update(dt) NaN/음수 가드',
        rule: 'update(dt) 제공 시 첫 줄에서 !Number.isFinite(dt) || dt < 0 → dt = 0(JuiceKit 선례).',
        applies: 'dt 구동 update 를 가진 킷(juicekit·fsm·abilitykit)'
      },
      {
        id: 'reset',
        title: 'reset() 제공',
        rule: '씬 전환·시드 고정 재현·재시작용 상태 초기화 메서드(rng/스트림은 보통 유지).',
        applies: '내부 가변 상태를 누적하는 킷'
      }
    ]
  };

  // ── 런타임 검증기 ──────────────────────────────────────────────────────────
  // assertContract(kit, opts) → { ok, name, version, checks[], violations[] }
  //   kit  : 검사할 킷 인스턴스(또는 네임스페이스 객체). update/reset 은 인스턴스에서 검사.
  //   opts : {
  //     name           : string   // 리포트용 이름(없으면 ctor.name 추정)
  //     ctor           : Function  // 생성자(module.exports 가 생성자면 노출 검사에 사용)
  //     requireUpdate  : bool      // true 면 update 부재를 위반으로(기본 false — 조건부)
  //     requireReset   : bool      // true 면 reset 부재를 위반으로(기본 false — 조건부)
  //     skipUpdateProbe: bool      // true 면 update 가드 *행위* 프로브를 끄고 존재만 검사
  //     updateArgs     : Array     // update 정상 호출 인자(dt 외 ctx 등). 기본 [].
  //   }
  // 각 check: { id, ok, status:'pass'|'fail'|'n/a', detail }.
  // status 'n/a' 는 ok=true 로 집계(해당 능력을 제공하지 않는 킷).
  function assertContract(kit, opts) {
    opts = opts || {};
    var name = opts.name ||
      (opts.ctor && opts.ctor.name) ||
      (kit && kit.constructor && kit.constructor.name) ||
      'UnknownKit';

    var checks = [];
    function record(id, ok, status, detail) {
      checks.push({ id: id, ok: !!ok, status: status, detail: detail || '' });
    }

    // 1) module-exposure — 인스턴스/생성자의 형태로 간접 확인.
    //    Node 런타임에서 직접 module.exports 를 볼 수 없으므로, "검사 대상이 존재하고
    //    함수/객체로 노출돼 require/전역 접근이 성립함"을 확인한다(정적 텍스트 규약은 lint 가 담당).
    (function () {
      var exposed = isFn(opts.ctor) || (kit !== null && kit !== undefined && (typeof kit === 'object' || isFn(kit)));
      record('module-exposure', exposed, exposed ? 'pass' : 'fail',
        exposed ? '' : '킷 인스턴스/생성자가 노출되지 않음(require/전역 접근 불가).');
    })();

    // 2) determinism-rng — 인스턴스가 rng 를 들고 있다면 RngForge 형태(callable + .int/.pick)인지.
    //    rng 미보유(무작위 미사용) 킷은 'n/a'. Math.random 정적 검출은 lint 소관.
    (function () {
      var rng = kit && kit.rng;
      if (rng === undefined || rng === null) {
        record('determinism-rng', true, 'n/a', '무작위 미사용(rng 미주입) — 정적 Math.random 검사는 lint 소관.');
        return;
      }
      var looksRng = isFn(rng) && isFn(rng.int) && isFn(rng.pick);
      record('determinism-rng', looksRng, looksRng ? 'pass' : 'fail',
        looksRng ? 'RngForge 난수기 주입됨.' : 'rng 가 RngForge 난수기 형태가 아님(callable + int/pick 필요).');
    })();

    // 3) determinism-noclock — 런타임으로 직접 확인 불가(정적 텍스트 검사 = lint 소관).
    //    여기서는 항상 'n/a'(lint-kit-deps 의 결정론 룰이 본 항목을 강제).
    record('determinism-noclock', true, 'n/a', '시각함수 정적 검출은 lint-kit-deps(결정론 룰) 소관.');

    // 4) update-guard — update(dt) 가 있으면 NaN/음수 가드를 *행위적* 으로 검증.
    (function () {
      if (!isFn(kit && kit.update)) {
        var miss = !!opts.requireUpdate;
        record('update-guard', !miss, miss ? 'fail' : 'n/a',
          miss ? 'requireUpdate=true 인데 update(dt) 미제공.' : 'update(dt) 미제공 — dt 구동 킷 아님.');
        return;
      }
      if (opts.skipUpdateProbe) {
        record('update-guard', true, 'pass', 'update(dt) 존재(행위 프로브 생략).');
        return;
      }
      // 행위 프로브: 정상 dt 1회 → NaN → Infinity → 음수 순으로 호출해 throw 없이 통과하는지.
      // 그리고 흔한 수치 상태 필드가 유한값으로 남는지 가볍게 점검(오염 차단 확인).
      var extra = Array.isArray(opts.updateArgs) ? opts.updateArgs : [];
      var bad = null;
      try {
        kit.update.apply(kit, [1 / 60].concat(extra));
        kit.update.apply(kit, [NaN].concat(extra));
        kit.update.apply(kit, [Infinity].concat(extra));
        kit.update.apply(kit, [-1].concat(extra));
      } catch (e) {
        bad = 'update(dt) 가 비정상 dt 에서 throw: ' + (e && e.message);
      }
      if (!bad) {
        // 대표 수치 상태 필드(있을 때만) 유한성 점검 — 킷마다 다르므로 존재하는 것만.
        var probes = ['trauma', 'timeScale', '_totalTime', '_stateTime', '_phaseTime', 'time'];
        for (var i = 0; i < probes.length; i++) {
          var v = kit[probes[i]];
          if (typeof v === 'number' && !Number.isFinite(v)) {
            bad = '비정상 dt 후 상태 필드 ' + probes[i] + ' 가 오염됨(비유한값: ' + v + ').';
            break;
          }
        }
      }
      record('update-guard', !bad, bad ? 'fail' : 'pass',
        bad || 'update(NaN/Infinity/-1) 가 throw·오염 없이 0 으로 가드됨.');
    })();

    // 5) reset — reset() 제공 여부. 호출 가능하면 1회 호출해 throw 없는지 확인.
    (function () {
      if (!isFn(kit && kit.reset)) {
        var miss = !!opts.requireReset;
        record('reset', !miss, miss ? 'fail' : 'n/a',
          miss ? 'requireReset=true 인데 reset() 미제공.' : 'reset() 미제공.');
        return;
      }
      var bad = null;
      try { kit.reset(); } catch (e) { bad = 'reset() 호출 중 throw: ' + (e && e.message); }
      record('reset', !bad, bad ? 'fail' : 'pass', bad || 'reset() 호출 정상.');
    })();

    var violations = [];
    for (var j = 0; j < checks.length; j++) if (!checks[j].ok) violations.push(checks[j]);

    return {
      ok: violations.length === 0,
      name: name,
      version: VERSION,
      checks: checks,
      violations: violations
    };
  }

  // 사람용 계약 요약 문자열.
  function describe() {
    var lines = ['BehaviorKit 계약 v' + VERSION + ' — 런타임 behavior 킷 공통 규약:'];
    for (var i = 0; i < CONTRACT.items.length; i++) {
      var it = CONTRACT.items[i];
      lines.push('  ' + (i + 1) + ') [' + it.id + '] ' + it.title + ' — ' + it.rule + ' (적용: ' + it.applies + ')');
    }
    return lines.join('\n');
  }

  var BehaviorKit = {
    VERSION: VERSION,
    CONTRACT: CONTRACT,
    assertContract: assertContract,
    describe: describe
  };

  global.BehaviorKit = BehaviorKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = BehaviorKit;
})(typeof window !== 'undefined' ? window : this);
