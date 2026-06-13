/* ============================================================================
 * RngForge — 결정론적 시드 난수 인프라 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * "월클럭 시각함수 미사용 결정론" QA 철학의 *나머지 절반*. game-qa 헤드리스 step
 * 하니스가 시간(time)은 통제하지만, 게임 코드가 `Math.random()` 을 한 줄만 써도
 * 재현성이 소리 없이 깨진다. RngForge 는 **시드(seed) 하나로부터 항상 같은 수열을
 * 만드는** 난수기를 엔진 1급 부품으로 제공해, 모든 무작위를 재현·검증 가능하게 한다.
 *
 * 핵심 3요소:
 *   1) 시드 결정론  — 같은 seed → 항상 같은 수열 (마인크래프트 시드와 동일 개념).
 *   2) 멀티스트림   — 용도별(전투·드랍·파티클)로 독립된 난수기를 분리해, 한 스트림을
 *                     더 굴려도 다른 스트림 결과가 밀리지 않는다(검증 안정성).
 *   3) 직렬화       — state()/setState() 로 난수기 상태를 저장·복원(스냅샷·세이브·리플레이).
 *
 * 알고리즘은 mulberry32(32-bit, 의존성 0). games/runeburst 의 인라인 mulberry32 와
 * **비트 동일** 출력이므로, 기존 게임은 무손실 이관된다. 외부 라이브러리 없음(IP-safe).
 *
 * 사용 예:
 *   var rng = RngForge.create(12345);          // 시드로 난수기 생성(숫자 또는 문자열)
 *   if (rng() < 0.3) dropCoin();               // rng() = Math.random() 드롭인 대체
 *   var dmg  = rng.int(8, 12);                 // 정수 [8,12]
 *   var loot = rng.pick(LOOT_TABLE);           // 배열에서 하나
 *   rng.shuffle(deck);                         // Fisher–Yates 제자리 셔플
 *
 *   // 멀티스트림 — 용도별 독립 난수기(이름으로 캐싱, 시드에서 결정적으로 파생)
 *   var combat = rng.stream('combat');
 *   var fx     = rng.stream('particles');      // fx 를 아무리 굴려도 combat 은 불변
 *
 *   // 직렬화 — 상태 스냅샷/복원(값-스냅샷 회귀, 세이브/로드, 리플레이)
 *   var snap = rng.state();  ...;  rng.setState(snap);   // 같은 지점부터 동일 재생
 *
 *   // QA 시드 주입 — ?seed=N 을 읽고, 없으면 기본값
 *   this.rng = RngForge.fromUrl(20260613);
 *
 * 주의:
 *   - **seed 를 항상 명시하라.** 안 주면 고정 기본 시드를 쓰며(재현은 되지만 매 게임 동일).
 *   - 게임 내 모든 무작위는 RngForge 로만 한다. `Math.random()` 은 금지
 *     (검증: skills/wgf-game-qa/tools/lint-rng.mjs).
 *   - 결정론을 위해 시각함수(Date.now/performance.now)를 게임 로직에 쓰지 말 것.
 *   - 헤드리스(Node require) 가능 — tick 처럼 외부 상태 없이 순수. 결정적 테스트에 사용.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var FORGE_VERSION = '1.0.0';
  var DEFAULT_SEED = 0x9E3779B9 | 0;   // seed 미지정 시 고정 기본(황금비 상수)
  var GOLDEN = 0x9E3779B1 | 0;         // 스트림 파생용 믹싱 상수

  // FNV-1a 32-bit — 문자열 → 32-bit 정수 시드(결정적).
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    s = String(s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h | 0;
  }

  // seed 정규화: 숫자→|0, 문자열→hashStr, 그 외→고정 기본.
  function normalizeSeed(seed) {
    if (typeof seed === 'number' && isFinite(seed)) return seed | 0;
    if (typeof seed === 'string' && seed.length) return hashStr(seed);
    return DEFAULT_SEED;
  }

  // mulberry32 코어 — runeburst 인라인판과 비트 동일. 상태는 32-bit 정수 a 하나.
  function makeRng(seedInput) {
    var seed0 = normalizeSeed(seedInput);   // 스트림 파생·clone 기준(불변 원본)
    var a = seed0;                           // 가변 내부 상태

    // rng() — float [0,1). Math.random() 드롭인 대체.
    function rng() {
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    rng.next = rng;                          // 별칭(명시적 호출용)
    rng.seed = seed0;                        // 원본 시드(디버그·파생용)

    // float [min,max) — 인자 1개면 [0,min).
    rng.float = function (min, max) {
      if (max === undefined) { max = min; min = 0; }
      return min + rng() * (max - min);
    };

    // int [min,max] 정수(양 끝 포함) — 인자 1개면 [0,min].
    rng.int = function (min, max) {
      if (max === undefined) { max = min; min = 0; }
      return Math.floor(min + rng() * (max - min + 1));
    };

    // bool — 확률 p(기본 0.5)로 true.
    rng.bool = function (p) { return rng() < (p === undefined ? 0.5 : p); };
    rng.chance = rng.bool;

    // -1 또는 1.
    rng.sign = function () { return rng() < 0.5 ? -1 : 1; };

    // 배열에서 하나(빈 배열이면 undefined).
    rng.pick = function (arr) {
      return (arr && arr.length) ? arr[Math.floor(rng() * arr.length)] : undefined;
    };

    // Fisher–Yates 제자리 셔플(같은 배열 반환).
    rng.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    };

    // 가중 선택 — weighted(items, weights[]) 또는 weighted([{value,weight}, ...]).
    rng.weighted = function (items, weights) {
      var vals, w, i, total = 0;
      if (weights === undefined) {
        vals = []; w = [];
        for (i = 0; i < items.length; i++) {
          vals.push(items[i] && items[i].value !== undefined ? items[i].value : items[i]);
          w.push(items[i] && items[i].weight || 0);
        }
      } else { vals = items; w = weights; }
      for (i = 0; i < w.length; i++) total += w[i];
      if (total <= 0) return undefined;
      var r = rng() * total, acc = 0;
      for (i = 0; i < w.length; i++) { acc += w[i]; if (r < acc) return vals[i]; }
      return vals[vals.length - 1];
    };

    // 멀티스트림 — 이름으로 캐싱된 독립 난수기. 원본 seed 에서 결정적으로 파생.
    // 같은 root·같은 name 이면 항상 같은 수열. 한 스트림 진행이 다른 스트림에 영향 0.
    rng.stream = function (name) {
      if (!rng._streams) rng._streams = {};
      if (!rng._streams[name]) {
        var childSeed = (seed0 ^ Math.imul(hashStr(name), GOLDEN)) | 0;
        rng._streams[name] = makeRng(childSeed);
      }
      return rng._streams[name];
    };

    // 직렬화 — 현재 상태(32-bit 정수)를 반환/복원. 수열 복원에 충분(상태=정수 a 하나).
    rng.state = function () { return a; };
    rng.setState = function (s) { a = s | 0; return rng; };

    // 새 시드로 리셋(스트림 캐시도 비움).
    rng.reseed = function (s) { seed0 = normalizeSeed(s); a = seed0; rng.seed = seed0; rng._streams = null; return rng; };

    // 현재 상태 그대로 독립 복제(이후 두 난수기는 동일 수열을 따로 생성).
    rng.clone = function () { var c = makeRng(seed0); c.setState(a); return c; };

    return rng;
  }

  var RngForge = {
    VERSION: FORGE_VERSION,

    // 난수기 생성. seed: 숫자 | 문자열 | (미지정 시 고정 기본).
    create: function (seed) { return makeRng(seed); },

    // 문자열 → 32-bit 정수 시드(날짜키·이름 등을 시드로 쓸 때).
    hashSeed: function (s) { return hashStr(s); },

    // URL ?seed= 파라미터를 읽어 생성(브라우저). 없으면 defaultSeed.
    // Node 등 location 없으면 defaultSeed 로 생성.
    fromUrl: function (defaultSeed, paramName) {
      var p = paramName || 'seed';
      try {
        if (typeof location !== 'undefined' && location.search) {
          var v = new URLSearchParams(location.search).get(p);
          if (v !== null && v !== '') {
            var n = Number(v);
            return makeRng(isFinite(n) && v.trim() !== '' ? (n | 0) : v);
          }
        }
      } catch (e) { /* location 접근 불가 → 기본값 폴백 */ }
      return makeRng(defaultSeed);
    }
  };

  global.RngForge = RngForge;
  if (typeof module !== 'undefined' && module.exports) module.exports = RngForge;
})(typeof window !== 'undefined' ? window : this);
