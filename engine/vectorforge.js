/* ============================================================================
 * VectorForge — 절차적 스무스/벡터 그래픽 생성기 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * PixelForge 의 비-픽셀 짝꿍. 그라데이션·글로우·소프트섀도우·글래스질·곡선 캐릭터 같은
 * "미려한" 그래픽을 코드로 생성한다. 외부 다운로드 0 → 100% CC0 / IP-safe.
 *
 * 핵심: drawFn(ctx, w, h, frameIndex, VF) 를 supersample(기본 3x) 캔버스에 그린 뒤
 *       논리 크기로 고품질 다운샘플 → 부드러운 안티앨리어스 텍스처를 만든다.
 *       (drawFn 은 논리 좌표 0..w, 0..h 로 그린다.)
 *
 * 사용:
 *   // 게임 config 는 스무스 모드로: render:{ pixelArt:false, antialias:true, roundPixels:false }
 *   VectorForge.buildAll(scene);                 // 내장 라이브러리 + 애니 등록
 *   scene.add.sprite(x, y, 'vf-hero', 0).play('vf-hero-run');
 *   // 커스텀:
 *   VectorForge.bake(scene, 'orb', { w:24, h:24, draw:function(ctx,w,h,t,VF){ ... } });
 *
 * ⚠ 픽셀 게임은 pixelArt:true, 스무스 게임은 pixelArt:false 로 한 게임당 하나의 스타일을 택한다.
 * ==========================================================================*/
(function (global) {
  'use strict';

  // --- 드로잉 헬퍼 툴킷 (drawFn 에 VF 로 전달) ------------------------------
  var VF = {
    // 둥근 사각형 경로
    rr: function (ctx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    // 선형 그라데이션. stops = [[0,'#..'],[1,'#..']]
    lin: function (ctx, x0, y0, x1, y1, stops) {
      var g = ctx.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
      return g;
    },
    // 방사형 그라데이션 (cx,cy 중심, 반지름 r)
    radial: function (ctx, cx, cy, r, stops, ix, iy, ir) {
      var g = ctx.createRadialGradient(
        ix == null ? cx : ix, iy == null ? cy : iy, ir == null ? 0 : ir, cx, cy, r);
      stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
      return g;
    },
    circle: function (ctx, cx, cy, r) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    },
    ellipse: function (ctx, cx, cy, rx, ry) {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.closePath();
    },
    poly: function (ctx, pts) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    },
    // 유기적 블롭 (n 꼭짓점 + 사인 변형). seed 로 모양 고정.
    blob: function (ctx, cx, cy, r, n, wobble, seed) {
      n = n || 8; wobble = wobble == null ? 0.12 : wobble; seed = seed || 0;
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var a = (i / n) * Math.PI * 2;
        var rr = r * (1 + wobble * Math.sin(a * 3 + seed) * Math.cos(a * 2 + seed));
        var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    },
    // 별
    star: function (ctx, cx, cy, outer, inner, points, rot) {
      points = points || 5; rot = rot || -Math.PI / 2;
      ctx.beginPath();
      for (var i = 0; i < points * 2; i++) {
        var rr = (i % 2 === 0) ? outer : inner;
        var a = rot + (i / (points * 2)) * Math.PI * 2;
        var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    },
    // 글로우 효과로 fn 실행 (네온/발광)
    glow: function (ctx, color, blur, fn) {
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur;
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; fn(); ctx.restore();
    },
    // 소프트 드롭섀도우로 fn 실행
    shadow: function (ctx, opts, fn) {
      opts = opts || {};
      ctx.save();
      ctx.shadowColor = opts.color || 'rgba(20,24,40,0.28)';
      ctx.shadowBlur = opts.blur == null ? 4 : opts.blur;
      ctx.shadowOffsetX = opts.x || 0; ctx.shadowOffsetY = opts.y == null ? 2 : opts.y;
      fn(); ctx.restore();
    },
    // 글래스모피즘 패널 (반투명 + 라이트 보더 + 상단 하이라이트)
    glass: function (ctx, x, y, w, h, r, tint) {
      VF.rr(ctx, x, y, w, h, r);
      ctx.fillStyle = tint || 'rgba(255,255,255,0.16)';
      ctx.fill();
      ctx.save(); VF.rr(ctx, x, y, w, h, r); ctx.clip();
      ctx.fillStyle = VF.lin(ctx, x, y, x, y + h, [[0, 'rgba(255,255,255,0.45)'], [0.5, 'rgba(255,255,255,0.05)'], [1, 'rgba(255,255,255,0.0)']]);
      ctx.fillRect(x, y, w, h * 0.55);
      ctx.restore();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      VF.rr(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, r); ctx.stroke();
    }
  };

  // --- 핵심: drawFn → 슈퍼샘플 AA 텍스처 -----------------------------------
  function bake(scene, key, def) {
    var ss = def.ss || 3;
    var w = def.w, h = def.h;
    var frames = def.frames || [def.draw];

    var strip = document.createElement('canvas');
    strip.width = w * frames.length; strip.height = h;
    var sctx = strip.getContext('2d');
    sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';

    frames.forEach(function (fn, fi) {
      var tmp = document.createElement('canvas');
      tmp.width = w * ss; tmp.height = h * ss;
      var tctx = tmp.getContext('2d');
      tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';
      tctx.save(); tctx.scale(ss, ss);
      fn(tctx, w, h, fi, VF);              // 논리 좌표로 그림
      tctx.restore();
      sctx.drawImage(tmp, 0, 0, w * ss, h * ss, fi * w, 0, w, h);  // 고품질 다운샘플
    });

    if (scene.textures.exists(key)) scene.textures.remove(key);
    var tex = scene.textures.addCanvas(key, strip);
    for (var i = 0; i < frames.length; i++) tex.add(i, 0, i * w, 0, w, h);
    return { key: key, frameWidth: w, frameHeight: h, frameCount: frames.length };
  }

  // 전체 화면 그라데이션 배경 텍스처 (예: 오로라/석양 하늘)
  function gradientBackground(scene, key, w, h, stops) {
    return bake(scene, key, {
      w: w, h: h, ss: 1, draw: function (ctx) {
        ctx.fillStyle = VF.lin(ctx, 0, 0, 0, h, stops);
        ctx.fillRect(0, 0, w, h);
      }
    });
  }

  // ===========================================================================
  // 내장 라이브러리 (4가지 스타일 쇼케이스)
  // ===========================================================================
  var LIB = {};

  // [카툰 벡터] 마스코트 캐릭터 — 둥근 그라데이션 블롭 + 큰 눈. 4프레임.
  function drawHero(ctx, w, h, t, VF) {
    var cx = w / 2;
    // 발 위치 (프레임별)
    var footPhase = [[ -5, 0, 5, 0], [-7, 2, 6, -2], [-3, -2, 8, 2], [-4, -3, 4, -3]][t];
    var bodyBob = [0, -1, 0, -3][t];
    // 그림자
    VF.shadow(ctx, { blur: 3, y: 2, color: 'rgba(20,24,40,0.25)' }, function () {
      VF.ellipse(ctx, cx, h - 3, 11, 3); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
    });
    // 발
    ctx.fillStyle = '#1b6f86';
    VF.ellipse(ctx, cx + footPhase[0], h - 4 + footPhase[1], 4, 3); ctx.fill();
    VF.ellipse(ctx, cx + footPhase[2], h - 4 + footPhase[3], 4, 3); ctx.fill();
    // 몸통 (둥근 블롭 + 세로 그라데이션)
    var by = 7 + bodyBob;
    ctx.save();
    VF.blob(ctx, cx, by + 9, 11, 10, 0.06, 1.2);
    ctx.fillStyle = VF.lin(ctx, cx, by - 2, cx, by + 20, [[0, '#5ef0d6'], [0.55, '#2fd0bc'], [1, '#1b9e98']]);
    ctx.fill();
    // 배 하이라이트
    VF.ellipse(ctx, cx, by + 12, 6.5, 7.5); ctx.fillStyle = 'rgba(233,255,250,0.55)'; ctx.fill();
    ctx.restore();
    // 광택 하이라이트(좌상단)
    VF.ellipse(ctx, cx - 4, by + 4, 3, 4.5); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    // 눈
    var ex = 3.6;
    [[-ex, by + 6], [ex, by + 6]].forEach(function (e) {
      VF.circle(ctx, cx + e[0], e[1], 3); ctx.fillStyle = '#ffffff'; ctx.fill();
      VF.circle(ctx, cx + e[0] + 0.6, e[1] + 0.4, 1.6); ctx.fillStyle = '#1a2233'; ctx.fill();
      VF.circle(ctx, cx + e[0] + 1.2, e[1] - 0.4, 0.6); ctx.fillStyle = '#ffffff'; ctx.fill();
    });
    // 미소
    ctx.beginPath(); ctx.arc(cx, by + 9.5, 2.4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 1; ctx.strokeStyle = '#13635f'; ctx.stroke();
    // 점프 시 팔 들기
    if (t === 3) {
      ctx.fillStyle = '#2fd0bc';
      VF.ellipse(ctx, cx - 11, by + 4, 2.4, 4); ctx.fill();
      VF.ellipse(ctx, cx + 11, by + 4, 2.4, 4); ctx.fill();
    }
  }
  LIB.vfHero = { key: 'vf-hero', w: 32, h: 34, frames: [function (c, w, h) { drawHero(c, w, h, 0, VF); }, function (c, w, h) { drawHero(c, w, h, 1, VF); }, function (c, w, h) { drawHero(c, w, h, 2, VF); }, function (c, w, h) { drawHero(c, w, h, 3, VF); }] };

  // [그라데이션/글로우] 글로시 코인 — 금색 방사 그라데이션 + 광택, 회전 4프레임
  LIB.vfCoin = {
    key: 'vf-coin', w: 22, h: 22,
    frames: [0, 1, 2, 3].map(function (t) {
      return function (ctx, w, h, _t, VF) {
        var cx = w / 2, cy = h / 2;
        var rx = [9, 6, 2.2, 6][t]; // 회전 폭
        VF.glow(ctx, 'rgba(255,200,60,0.7)', 6, function () {
          VF.ellipse(ctx, cx, cy, rx, 9);
          ctx.fillStyle = VF.radial(ctx, cx, cy, 10, [[0, '#fff6c0'], [0.5, '#ffcf3a'], [1, '#d98a1f']], cx - 3, cy - 3, 0);
          ctx.fill();
        });
        // 안쪽 링
        if (rx > 3) {
          VF.ellipse(ctx, cx, cy, rx - 2.2, 6.6);
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,245,180,0.8)'; ctx.stroke();
        }
        // 광택
        VF.ellipse(ctx, cx - rx * 0.35, cy - 3, Math.max(0.6, rx * 0.25), 2.4);
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
      };
    })
  };

  // [그라데이션/글로우] 보석 — 패싯 + 글로우
  LIB.vfGem = {
    key: 'vf-gem', w: 22, h: 24, draw: function (ctx, w, h, t, VF) {
      var cx = w / 2;
      VF.glow(ctx, 'rgba(150,90,255,0.7)', 7, function () {
        VF.poly(ctx, [[cx, 2], [w - 3, 9], [cx, h - 2], [3, 9]]);
        ctx.fillStyle = VF.lin(ctx, 0, 0, 0, h, [[0, '#c69bff'], [1, '#6a2fd0']]);
        ctx.fill();
      });
      // 윗 패싯
      VF.poly(ctx, [[cx, 2], [w - 3, 9], [cx, 11], [3, 9]]);
      ctx.fillStyle = VF.lin(ctx, 0, 2, 0, 11, [[0, '#eadcff'], [1, '#9a6be0']]); ctx.fill();
      // 좌우 하단 패싯 음영
      VF.poly(ctx, [[3, 9], [cx, 11], [cx, h - 2]]); ctx.fillStyle = 'rgba(40,12,80,0.35)'; ctx.fill();
      // 반짝임
      VF.star(ctx, cx + 2, 7, 2.2, 0.7, 4, 0); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    }
  };

  // [그라데이션/글로우] 네온 글로우 오브 — 펄스 2프레임
  LIB.vfOrb = {
    key: 'vf-orb', w: 26, h: 26,
    frames: [0, 1].map(function (t) {
      return function (ctx, w, h, _t, VF) {
        var cx = w / 2, cy = h / 2, blur = t ? 11 : 7, r = t ? 7.5 : 7;
        VF.glow(ctx, 'rgba(70,220,255,0.9)', blur, function () {
          VF.circle(ctx, cx, cy, r);
          ctx.fillStyle = VF.radial(ctx, cx, cy, r, [[0, '#eaffff'], [0.4, '#66f0ff'], [1, '#2bb6e0']]);
          ctx.fill();
        });
        VF.circle(ctx, cx - 2, cy - 2, 1.8); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
      };
    })
  };

  // [플랫/머티리얼] 플랫폼 타일 — 둥근 윗면 + 소프트섀도우
  LIB.vfPlatform = {
    key: 'vf-platform', w: 48, h: 24, draw: function (ctx, w, h, t, VF) {
      VF.shadow(ctx, { blur: 5, y: 3, color: 'rgba(20,40,24,0.3)' }, function () {
        VF.rr(ctx, 2, 2, w - 4, h - 5, 7);
        ctx.fillStyle = VF.lin(ctx, 0, 2, 0, h, [[0, '#7be07b'], [0.35, '#5cc85c'], [1, '#3aa84f']]);
        ctx.fill();
      });
      // 윗면 잔디 하이라이트
      VF.rr(ctx, 4, 3, w - 8, 6, 4); ctx.fillStyle = 'rgba(220,255,210,0.5)'; ctx.fill();
    }
  };

  // [플랫/머티리얼] 소프트 구름
  LIB.vfCloud = {
    key: 'vf-cloud', w: 56, h: 30, draw: function (ctx, w, h, t, VF) {
      VF.shadow(ctx, { blur: 6, y: 3, color: 'rgba(120,150,200,0.25)' }, function () {
        ctx.fillStyle = VF.lin(ctx, 0, 0, 0, h, [[0, '#ffffff'], [1, '#e7f1ff']]);
        VF.circle(ctx, 16, 18, 11); ctx.fill();
        VF.circle(ctx, 30, 13, 13); ctx.fill();
        VF.circle(ctx, 42, 18, 10); ctx.fill();
        VF.rr(ctx, 10, 18, 38, 10, 6); ctx.fill();
      });
    }
  };

  // [플랫/머티리얼] 그라데이션 언덕
  LIB.vfHill = {
    key: 'vf-hill', w: 80, h: 40, draw: function (ctx, w, h, t, VF) {
      ctx.beginPath(); ctx.moveTo(0, h);
      ctx.quadraticCurveTo(w / 2, -6, w, h); ctx.closePath();
      ctx.fillStyle = VF.lin(ctx, 0, 0, 0, h, [[0, '#8ee88e'], [1, '#4aa84a']]); ctx.fill();
      // 햇빛 면
      ctx.beginPath(); ctx.moveTo(w / 2, 2);
      ctx.quadraticCurveTo(w * 0.72, h * 0.5, w * 0.62, h);
      ctx.quadraticCurveTo(w / 2, h * 0.4, w / 2, 2); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
    }
  };

  // [글래스모피즘] UI 패널
  LIB.vfGlass = {
    key: 'vf-glass', w: 64, h: 36, draw: function (ctx, w, h, t, VF) {
      VF.glass(ctx, 2, 2, w - 4, h - 4, 10);
    }
  };

  // [글래스모피즘/머티리얼] 글로시 버튼
  LIB.vfButton = {
    key: 'vf-button', w: 60, h: 28, draw: function (ctx, w, h, t, VF) {
      VF.shadow(ctx, { blur: 5, y: 3, color: 'rgba(30,50,120,0.4)' }, function () {
        VF.rr(ctx, 3, 2, w - 6, h - 6, 9);
        ctx.fillStyle = VF.lin(ctx, 0, 2, 0, h, [[0, '#6ea0ff'], [0.5, '#4a72ee'], [1, '#3a5fd0']]); ctx.fill();
      });
      ctx.save(); VF.rr(ctx, 3, 2, w - 6, h - 6, 9); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(3, 2, w - 6, (h - 6) * 0.45);
      ctx.restore();
    }
  };

  function buildAll(scene) {
    var manifest = {};
    Object.keys(LIB).forEach(function (k) {
      var d = LIB[k];
      manifest[d.key] = bake(scene, d.key, d);
    });
    function anim(key, frameKey, frames, rate, repeat) {
      if (scene.anims.exists(key)) return;
      scene.anims.create({ key: key, frames: frames.map(function (f) { return { key: frameKey, frame: f }; }), frameRate: rate, repeat: repeat == null ? -1 : repeat });
    }
    anim('vf-hero-idle', 'vf-hero', [0], 1);
    anim('vf-hero-run', 'vf-hero', [1, 2], 9);
    anim('vf-hero-jump', 'vf-hero', [3], 1, 0);
    anim('vf-coin-spin', 'vf-coin', [0, 1, 2, 3], 10);
    anim('vf-orb-pulse', 'vf-orb', [0, 1], 3);
    return manifest;
  }

  var VectorForge = { bake: bake, buildAll: buildAll, gradientBackground: gradientBackground, LIB: LIB, helpers: VF };
  global.VectorForge = VectorForge;
  if (typeof module !== 'undefined' && module.exports) module.exports = VectorForge;
})(typeof window !== 'undefined' ? window : this);
