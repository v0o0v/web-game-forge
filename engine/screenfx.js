/* ============================================================================
 * ScreenFX — Phaser 4 Filters(포스트-프로세싱) 헬퍼 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * v4 의 간판 기능인 Filter 체계를 한 줄 API 로 감싼다. 카메라/오브젝트에
 * 블룸·비네트·글로우·컬러그레이딩·픽셀레이트·CRT 룩을 입혀 전 장르의 "완성도"를
 * 끌어올린다. Filters 는 WebGL 전용 → Canvas 면 graceful no-op(null 반환).
 *
 * 사용:
 *   ScreenFX.preset(this.cameras.main, 'night');     // 밤 무드 한 방
 *   ScreenFX.bloom(this.cameras.main, { threshold:0.5, amount:0.8 });
 *   ScreenFX.vignette(this.cameras.main, { radius:0.6, strength:0.55 });
 *   ScreenFX.glow(orbSprite, { color:0x66f0ff, outer:6 });   // 오브젝트엔 자동 enableFilters
 *
 * ⚠ v4 주의(레퍼런스 filters-and-postfx.md):
 *   - 전용 Bloom 필터 없음 → ParallelFilters(Threshold→Blur)+ADD 로 합성한다.
 *   - 오브젝트는 enableFilters() 선행 필요(카메라는 기본 보유).
 *   - internal=오브젝트/카메라 로컬(싸다), external=스크린 공간(전체화면, 비쌈).
 * ==========================================================================*/
(function (global) {
  'use strict';

  var ScreenFX = {};

  function rendererOf(target) {
    var scene = target.scene || (target.cameraManager && target.cameraManager.scene);
    return scene && scene.sys && scene.sys.renderer;
  }
  ScreenFX.supported = function (target) {
    var r = rendererOf(target);
    return !!(r && r.type === Phaser.WEBGL);
  };
  // 필터 리스트 확보(오브젝트면 enableFilters). WebGL 아니면 null.
  function list(target, external) {
    if (!ScreenFX.supported(target)) return null;
    if (!target.filters && target.enableFilters) target.enableFilters();
    if (!target.filters) return null;
    return external ? target.filters.external : target.filters.internal;
  }

  // 블룸 = ParallelFilters( 밝은 부분 Threshold → Blur ) 를 ADD 로 합성.
  ScreenFX.bloom = function (target, o) {
    o = o || {};
    var l = list(target, o.external);
    if (!l) return null;
    var pf = l.addParallelFilters();
    pf.top.addThreshold(o.threshold == null ? 0.55 : o.threshold, o.knee == null ? 1 : o.knee);
    pf.top.addBlur(o.quality == null ? 1 : o.quality,
      o.x == null ? 2 : o.x, o.y == null ? 2 : o.y, o.strength == null ? 1.2 : o.strength);
    pf.blend.blendMode = Phaser.BlendModes.ADD;
    pf.blend.amount = o.amount == null ? 0.7 : o.amount;
    return pf;
  };

  // 비네트(가장자리 어둡게) — 보통 external(스크린 공간).
  ScreenFX.vignette = function (cam, o) {
    o = o || {};
    var l = list(cam, o.external == null ? true : o.external);
    if (!l) return null;
    return l.addVignette(
      o.x == null ? 0.5 : o.x, o.y == null ? 0.5 : o.y,
      o.radius == null ? 0.5 : o.radius, o.strength == null ? 0.5 : o.strength);
  };

  // 글로우(발광 외곽선). 오브젝트엔 internal 권장.
  ScreenFX.glow = function (obj, o) {
    o = o || {};
    var l = list(obj, o.external);
    if (!l) return null;
    return l.addGlow(o.color == null ? 0xffffff : o.color,
      o.outer == null ? 4 : o.outer, o.inner == null ? 0 : o.inner, o.scale == null ? 1 : o.scale);
  };

  // 컬러 그레이딩 — preset 이름(문자열) 또는 fn(colorMatrix) 콜백.
  //  내장 프리셋: sepia/grayscale/night/brown/vintagePinhole/kodachrome/... (레퍼런스 참조)
  //  ⚠ 콜백 안에서 둘째 연산부터는 multiply=true 로 합성할 것 — 아니면 ColorMatrix 가
  //    행렬을 리셋·대체한다. brightness(v) 는 RGB×v 스케일(1=원본, 0=검정).
  ScreenFX.colorGrade = function (cam, preset) {
    var l = list(cam, false);
    if (!l) return null;
    var cm = l.addColorMatrix();
    if (typeof preset === 'function') preset(cm.colorMatrix);
    else if (preset && typeof cm.colorMatrix[preset] === 'function') cm.colorMatrix[preset]();
    return cm;
  };

  ScreenFX.pixelate = function (cam, amount) {
    var l = list(cam, false);
    if (!l) return null;
    return l.addPixelate(amount == null ? 4 : amount);
  };

  // 레트로 CRT 근사: 배럴 왜곡 + (옵션)픽셀레이트 + 비네트.
  ScreenFX.crt = function (cam, o) {
    o = o || {};
    var li = list(cam, false), le = list(cam, true);
    if (!li || !le) return null;
    var out = {};
    out.barrel = li.addBarrel(o.barrel == null ? 1.06 : o.barrel);
    if (o.pixelate) out.pixelate = li.addPixelate(o.pixelate);
    out.vignette = le.addVignette(0.5, 0.5, o.radius == null ? 0.55 : o.radius, o.strength == null ? 0.7 : o.strength);
    return out;
  };

  // 프리셋 룩 한 방: 'night' | 'neon' | 'retro' | 'dream'
  ScreenFX.preset = function (cam, name) {
    if (!ScreenFX.supported(cam)) return null;
    var r = {};
    if (name === 'night') {
      r.grade = ScreenFX.colorGrade(cam, function (m) { m.night(0.45); m.brightness(1.03, true); });
      r.bloom = ScreenFX.bloom(cam, { threshold: 0.5, amount: 0.72 });
      r.vignette = ScreenFX.vignette(cam, { radius: 0.62, strength: 0.55 });
    } else if (name === 'neon') {
      r.bloom = ScreenFX.bloom(cam, { threshold: 0.4, amount: 0.95, strength: 1.5 });
      r.vignette = ScreenFX.vignette(cam, { radius: 0.7, strength: 0.4 });
    } else if (name === 'retro') {
      r.crt = ScreenFX.crt(cam, { pixelate: 2 });
    } else if (name === 'dream') {
      r.bloom = ScreenFX.bloom(cam, { threshold: 0.3, amount: 0.5, x: 3, y: 3 });
      r.grade = ScreenFX.colorGrade(cam, function (m) { m.saturate(0.15); m.brightness(1.05, true); });
    }
    return r;
  };

  global.ScreenFX = ScreenFX;
  if (typeof module !== 'undefined' && module.exports) module.exports = ScreenFX;
})(typeof window !== 'undefined' ? window : this);
