/* ============================================================================
 * PathKit — 곡선·경로 + 경로추종 헬퍼 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * Phaser 4 의 Curves/Path/PathFollower 를 감싸, 스플라인 루프·패트롤 적·
 * 방사형 탄막 경로·경로 그리기를 쉽게. 타워디펜스 크립 경로, 슈팅 탄막 패턴,
 * 등불이 떠다니는 앰비언트 모션 등에 쓴다.
 *
 * 사용:
 *   var path = PathKit.loop(scene, [[40,60],[200,40],[420,90],[300,140]]);
 *   PathKit.draw(scene, path, { color:0x335, alpha:0.3 });
 *   var lantern = PathKit.follower(scene, path, 'lantern', { duration:9000 });
 *   PathKit.patrol(scene, [[60,200],[260,200]], 'enemy', { duration:2500, rotateToPath:true });
 *   PathKit.radialBurst(scene, 240, 160, 'bullet', { count:16, distance:240, curve:60 });
 *
 * ⚠ 주의(레퍼런스 curves-and-paths.md):
 *   - Path.getPoint(t) 는 호 길이 보정(전체 경로에서 균등). 개별 Curve 는 getPointAt 사용.
 *   - quadraticBezierTo(endX,endY, cpX,cpY) — 끝점이 먼저(숫자 인자일 때).
 *   - Spline 은 점 4개 이상에서 가장 매끄럽다.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var PathKit = {};
  function V2(x, y) { return new Phaser.Math.Vector2(x, y); }
  function toV(p) { return Array.isArray(p) ? V2(p[0], p[1]) : V2(p.x, p.y); }

  // 점 배열로 열린 스플라인 경로. pts = [[x,y],...] 또는 [{x,y},...]
  PathKit.spline = function (scene, pts, close) {
    var arr = pts.map(toV);
    var path = scene.add.path(arr[0].x, arr[0].y);
    path.splineTo(arr.slice(1));
    if (close) path.closePath();
    return path;
  };

  // 닫힌 루프 스플라인 (떠다니는 등불 등 주위 순환). 첫 점을 끝에 이어 매끄럽게.
  PathKit.loop = function (scene, pts) {
    var arr = pts.map(toV);
    var path = scene.add.path(arr[0].x, arr[0].y);
    path.splineTo(arr.slice(1).concat([arr[0]]));
    return path;
  };

  // 경로추종 스프라이트(PathFollower).
  PathKit.follower = function (scene, path, texKey, cfg) {
    cfg = cfg || {};
    var start = path.getStartPoint();
    var f = scene.add.follower(path, start.x, start.y, texKey, cfg.frame);
    f.startFollow({
      duration: cfg.duration == null ? 6000 : cfg.duration,
      repeat: cfg.repeat == null ? -1 : cfg.repeat,
      yoyo: !!cfg.yoyo,
      rotateToPath: !!cfg.rotateToPath,
      rotationOffset: cfg.rotationOffset == null ? 0 : cfg.rotationOffset,
      ease: cfg.ease || 'Sine.easeInOut',
      startAt: cfg.startAt == null ? 0 : cfg.startAt,
      onComplete: cfg.onComplete
    });
    return f;
  };

  // 패트롤: 점들 사이를 왕복(yoyo)하는 적/오브젝트.
  PathKit.patrol = function (scene, pts, texKey, cfg) {
    cfg = Object.assign({ yoyo: true }, cfg || {});
    var path = PathKit.spline(scene, pts);
    var f = PathKit.follower(scene, path, texKey, cfg);
    f._path = path;
    return f;
  };

  // 경로를 그래픽 라인으로 그림(앰비언트/디버그).
  PathKit.draw = function (scene, path, o) {
    o = o || {};
    var g = scene.add.graphics();
    g.lineStyle(o.width == null ? 2 : o.width, o.color == null ? 0xffffff : o.color, o.alpha == null ? 0.4 : o.alpha);
    path.draw(g, o.smooth == null ? 64 : o.smooth);
    if (o.depth != null) g.setDepth(o.depth);
    return g;
  };

  // 방사형 탄막: 원점에서 N 방향으로 (직선 또는 곡선) 경로 + 추종 탄.
  //  o: { count?, distance?, duration?, startAngle?(rad), curve?(휨), frame?, destroyOnEnd? }
  PathKit.radialBurst = function (scene, x, y, texKey, o) {
    o = o || {};
    var count = o.count == null ? 12 : o.count;
    var dist = o.distance == null ? 260 : o.distance;
    var dur = o.duration == null ? 1400 : o.duration;
    var a0 = o.startAngle == null ? 0 : o.startAngle;
    var curve = o.curve == null ? 0 : o.curve;
    var destroyOnEnd = o.destroyOnEnd !== false;
    var out = [];
    for (var i = 0; i < count; i++) {
      var a = a0 + (i / count) * Math.PI * 2;
      var ex = x + Math.cos(a) * dist, ey = y + Math.sin(a) * dist;
      var path = scene.add.path(x, y);
      if (curve) {
        // 진행축에 수직으로 제어점을 밀어 휘는 탄막
        var mx = x + Math.cos(a) * dist * 0.5 - Math.sin(a) * curve;
        var my = y + Math.sin(a) * dist * 0.5 + Math.cos(a) * curve;
        path.quadraticBezierTo(ex, ey, mx, my);
      } else {
        path.lineTo(ex, ey);
      }
      var f = scene.add.follower(path, x, y, texKey, o.frame);
      (function (follower) {
        follower.startFollow({
          duration: dur,
          onComplete: function () { if (destroyOnEnd) follower.destroy(); }
        });
      })(f);
      out.push(f);
    }
    return out;
  };

  global.PathKit = PathKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = PathKit;
})(typeof window !== 'undefined' ? window : this);
