/* ============================================================================
 * LightingKit — 동적 2D 라이팅 + 절차적 분위기 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * 어둠 속 광원(PointLight 게임오브젝트, 가산 발광)과 절차적 안개(Simplex Noise GO)·
 * 밤하늘(Gradient GO)을 만든다. 호러·던전·밤 스테이지의 무드를 코드로 입힌다.
 * 전부 WebGL 전용 → Canvas 면 graceful no-op(null).
 *
 * 사용:
 *   var lamp = LightingKit.light(scene, 200, 120, { color:0xffd9a0, radius:120 });
 *   LightingKit.attach(scene, orbSprite, { color:0x88e8ff, radius:90 }); // 스프라이트를 따라다님
 *   LightingKit.fog(scene, 240, 160, 480, 320, { alpha:0.14, depth:5 });
 *   LightingKit.ambient(scene, 240, 160, 480, 320, 0x0a0e1e, 0.45);      // 전체 어둡게
 *
 * ⚠ 주의:
 *   - PointLight 는 노멀맵 없이도 동작하는 "발광 블롭"(어두운 배경에서 가장 예쁨).
 *   - 정식 노멀맵 라이팅은 enableNormalLighting()(setLighting) — 노멀맵 텍스처 필요.
 *   - PointLight/Noise/Gradient 모두 WebGL 전용. blend=ADD 광원은 어두운 바탕에서.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var LightingKit = {};

  LightingKit.supported = function (scene) {
    var r = scene.sys && scene.sys.renderer;
    return !!(r && r.type === Phaser.WEBGL);
  };

  // 점광원(가산 발광). 어두운 배경 위 구슬/등불/횃불.
  LightingKit.light = function (scene, x, y, o) {
    if (!LightingKit.supported(scene)) return null;
    o = o || {};
    var l = scene.add.pointlight(x, y,
      o.color == null ? 0xffdca8 : o.color,
      o.radius == null ? 90 : o.radius,
      o.intensity == null ? 0.9 : o.intensity,
      o.attenuation == null ? 0.06 : o.attenuation);
    if (o.depth != null) l.setDepth(o.depth);
    return l;
  };

  // 타깃(스프라이트/Matter 이미지)을 매 프레임 따라다니는 점광원.
  LightingKit.attach = function (scene, target, o) {
    o = o || {};
    var l = LightingKit.light(scene, target.x, target.y, o);
    if (!l) return null;
    var ox = (o.offset && o.offset.x) || 0, oy = (o.offset && o.offset.y) || 0;
    var handler = function () {
      if (target && (target.active || target.body)) { l.x = target.x + ox; l.y = target.y + oy; }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, handler);
    l.once('destroy', function () { scene.events.off(Phaser.Scenes.Events.UPDATE, handler); });
    return l;
  };

  // 절차적 드리프팅 안개 (Simplex Noise GO). SCREEN 블렌드로 빛 안개를 깐다.
  LightingKit.fog = function (scene, x, y, w, h, o) {
    if (!LightingKit.supported(scene)) return null;
    o = o || {};
    var n;
    try {
      n = scene.add.noiseSimplex2D({
        noiseFlow: 0,
        noiseIterations: o.iterations == null ? 3 : o.iterations,
        noiseWarpAmount: o.warp == null ? 0.4 : o.warp,
        noiseSeed: o.seed == null ? 7 : o.seed
      }, x, y, w, h);
    } catch (e) { return null; }
    n.setAlpha(o.alpha == null ? 0.14 : o.alpha);
    n.setBlendMode(o.blend == null ? Phaser.BlendModes.SCREEN : o.blend);
    if (o.depth != null) n.setDepth(o.depth);
    var speed = o.speed == null ? 0.00018 : o.speed;
    var acc = 0;
    var handler = function (t, dt) {
      acc += speed * (dt || 16);
      try { n.noiseOffset = [acc, acc * 0.45]; } catch (e) { /* ignore */ }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, handler);
    n.once('destroy', function () { scene.events.off(Phaser.Scenes.Events.UPDATE, handler); });
    return n;
  };

  // 밤하늘/배경 그라데이션 (Gradient GO). bands 미지정 시 짙은 남보라 밤하늘.
  LightingKit.nightSky = function (scene, x, y, w, h, o) {
    if (!LightingKit.supported(scene)) return null;
    o = o || {};
    var bands = o.bands || [
      { start: 0, end: 0.6, colorStart: 0x070a1c, colorEnd: 0x121838, colorSpace: 1, interpolation: 3 },
      { start: 0.6, end: 1, colorStart: 0x121838, colorEnd: 0x281f46, colorSpace: 1, interpolation: 3 }
    ];
    var g;
    try {
      g = scene.add.gradient({ bands: bands, shapeMode: o.shapeMode == null ? 0 : o.shapeMode }, x, y, w, h);
    } catch (e) { return null; }
    if (o.depth != null) g.setDepth(o.depth);
    return g;
  };

  // 전체화면 어둠 오버레이(MULTIPLY) — 점광원만 도드라지게 그림자 깊이를 더한다.
  LightingKit.ambient = function (scene, x, y, w, h, color, alpha) {
    var rect = scene.add.rectangle(x, y, w, h, color == null ? 0x0a0e1e : color, 1);
    rect.setBlendMode(Phaser.BlendModes.MULTIPLY);
    rect.setAlpha(alpha == null ? 0.5 : alpha);
    return rect;
  };

  // 정식 노멀맵 라이팅(고급) — 노멀맵 텍스처가 있을 때. selfShadow 옵션.
  LightingKit.enableNormalLighting = function (obj, selfShadow) {
    if (!obj || !obj.setLighting) return obj;
    obj.setLighting(true);
    if (selfShadow && obj.setSelfShadow) {
      obj.setSelfShadow(selfShadow.enabled !== false,
        selfShadow.penumbra == null ? 0.5 : selfShadow.penumbra,
        selfShadow.diffuseFlatThreshold == null ? 1 / 3 : selfShadow.diffuseFlatThreshold);
    }
    return obj;
  };

  global.LightingKit = LightingKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = LightingKit;
})(typeof window !== 'undefined' ? window : this);
