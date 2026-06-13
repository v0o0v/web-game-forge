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

  // ── 충격파(shockwave) — 화면공간 변위 링 ────────────────────────────────────
  // 폭발·착지·보스등장 순간 화면에 퍼지는 충격파 링. Phaser 4 전용 셰이더(GLSL)를
  // 직접 쓰지 않고, addDisplacement(texture,x,y) 에 **절차 생성한 radial 변위맵**을
  // 먹여 셰이더 작성을 회피한다. 변위맵은 R/G 채널에 변위 벡터를 인코딩한 텍스처:
  // 중립 회색(0.5,0.5)=변위 0, R>0.5=+X, G>0.5=+Y. 픽셀을 중심에서 바깥으로 밀어내
  // 동심원 링을 만든다(링 간격은 wavelength).
  //
  // 결정성: 시각함수(Date.now/performance.now)·Math.random 미사용. 변위맵은 파라미터로
  // 결정되고, 링 전파는 호출자가 주입한 dt(초)로만 진행된다. 같은 파라미터·같은 dt
  // 시퀀스 → 항상 같은 링 반경/강도 수열(헤드리스 검증 가능, 순수함수 분리).
  //
  // 사용:
  //   var sw = ScreenFX.shockwave(this.cameras.main, { center:{x:0.5,y:0.5}, speed:1.6, duration:0.6 });
  //   // 매 프레임:  if (sw) sw.update(delta/1000);   // delta=ms → 초
  //   // (juicekit 와 연계 시: 폭발 이벤트에서 호출, dt 는 게임 루프 델타 공유)

  // 변위맵 1픽셀 값(순수함수, Phaser 무관) — 정규화 거리 distNorm(0=중심,1=가장자리)
  // 에서의 radial 변위 크기를 반환한다. ringNorm 은 현재 링의 정규화 반경(전파 위치),
  // wavelength 는 링 두께 반폭(정규화). 링 중심(distNorm==ringNorm)에서 마루(=1)로 변위가
  // 최대, ±wavelength 경계에서 0 으로 매끄럽게 감쇠. 반환 ∈ [-1,1].
  //   - distNorm 이 [ringNorm-wavelength, ringNorm+wavelength] 밖이면 0(링 두께 밖).
  //   - 그 안에서는 cos( (distNorm-ringNorm)/wavelength · π/2 ) — d=0 마루 1, 경계 0.
  // 정확한 성질(테스트로 고정): f(ringNorm)=1, f(ringNorm±wavelength)=0, 두께 밖=0.
  ScreenFX.shockwaveDisplacement = function (distNorm, ringNorm, wavelength) {
    if (!(wavelength > 0)) return 0;
    var d = distNorm - ringNorm;          // 링 중심으로부터의 부호 있는 거리
    if (d < -wavelength || d > wavelength) return 0; // 링 두께(±wavelength) 밖
    // d ∈ [-wavelength,wavelength] → cos 인자 ∈ [-π/2,π/2] → 마루 1개(중심 1, 경계 0).
    return Math.cos((d / wavelength) * (Math.PI / 2));
  };

  // 시간 감쇠/전파 봉투(순수함수, Phaser 무관) — 경과시간 t(초)·총 지속 duration(초)
  // 에서의 { radius, strength } 를 반환한다. radius: 0→1 로 선형 확장(speed 배율),
  // strength: 1→0 로 감쇠(ease-out, 끝에서 0). t>=duration 이면 strength 0(소멸 완료).
  //   - progress = clamp(t/duration, 0, 1)
  //   - radius   = clamp(progress*speed, 0, 1)  (speed>1 이면 화면 밖까지 빠르게)
  //   - strength = (1-progress)^2               (ease-out, 끝에서 정확히 0)
  ScreenFX.shockwaveDecay = function (t, duration, speed) {
    duration = duration > 0 ? duration : 1;
    speed = speed == null ? 1 : speed;
    var progress = t / duration;
    if (progress < 0) progress = 0; else if (progress > 1) progress = 1;
    var radius = progress * speed;
    if (radius > 1) radius = 1; else if (radius < 0) radius = 0;
    var inv = 1 - progress;
    return { radius: radius, strength: inv * inv, progress: progress };
  };

  // 내부: radial 변위맵 캔버스를 절차 생성(Phaser 무관 — document.createElement). // kitdep-ok
  // size×size 픽셀. R/G 채널에 변위 벡터 인코딩(중립 0.5). ringNorm 위치에 링 1개.
  // 헤드리스(jsdom 없는 Node)에서는 document 미존재 → null(호출부가 가드).
  function buildDisplacementCanvas(size, ringNorm, wavelength) {
    if (typeof document === 'undefined' || !document.createElement) return null; // kitdep-ok
    var cv = document.createElement('canvas'); // kitdep-ok
    cv.width = size; cv.height = size;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(size, size);
    var data = img.data;
    var half = size / 2;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var dx = (x + 0.5 - half) / half;   // [-1,1]
        var dy = (y + 0.5 - half) / half;   // [-1,1]
        var dist = Math.sqrt(dx * dx + dy * dy);
        var amp = ScreenFX.shockwaveDisplacement(dist, ringNorm, wavelength);
        // radial 방향 단위벡터 × 진폭 → R/G(0.5 중립). dist=0 이면 방향 0.
        var nx = dist > 1e-6 ? dx / dist : 0;
        var ny = dist > 1e-6 ? dy / dist : 0;
        var r = 0.5 + nx * amp * 0.5;       // [0,1]
        var g = 0.5 + ny * amp * 0.5;
        var i = (y * size + x) * 4;
        data[i] = (r * 255) | 0;
        data[i + 1] = (g * 255) | 0;
        data[i + 2] = 128;                  // B 미사용(중립)
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  // ScreenFX.shockwave(cam, o): 화면공간 충격파 링을 건다. WebGL 아니면 null(가드).
  // o = { center:{x,y}(0..1, 기본 0.5,0.5), speed(반경 확장 배율, 기본 1.5),
  //       duration(초, 기본 0.6), wavelength(링 두께 0..1, 기본 0.12),
  //       amplitude(변위 강도, 기본 0.02 — addDisplacement 의 작은 float),
  //       size(변위맵 해상도 px, 기본 256) }
  // 반환: 핸들 { update(dt)→bool(살아있으면 true), strength, radius, t, destroy(), done }.
  //   - update(dt): 경과시간 누적 → 링 반경 확장 + strength 감쇠. 변위맵을 재생성해
  //     교체하고, addDisplacement 의 x/y(=amplitude*strength)를 갱신. 소멸 시 텍스처·
  //     필터를 정리하고 false 반환. dt 는 초 단위(NaN/음수 가드).
  //   - destroy(): 즉시 정리(중도 취소).
  ScreenFX.shockwave = function (cam, o) {
    o = o || {};
    if (!ScreenFX.supported(cam)) return null;
    var l = list(cam, o.external == null ? true : o.external); // 화면공간 → external 기본
    if (!l) return null;

    var scene = cam.scene || (cam.cameraManager && cam.cameraManager.scene);
    if (!scene || !scene.textures || !scene.sys) return null;

    var center = o.center || { x: 0.5, y: 0.5 };
    var speed = o.speed == null ? 1.5 : o.speed;
    var duration = o.duration == null ? 0.6 : o.duration;
    var wavelength = o.wavelength == null ? 0.12 : o.wavelength;
    var amplitude = o.amplitude == null ? 0.02 : o.amplitude;
    var size = o.size == null ? 256 : o.size;

    // 유일 텍스처 키(시각함수 없이 결정적 카운터로 생성 — Date.now 금지).
    var key = '__sfx_shock_' + (ScreenFX._shockSeq = (ScreenFX._shockSeq || 0) + 1);

    function bakeMap(ringNorm) {
      var cv = buildDisplacementCanvas(size, ringNorm, wavelength);
      if (!cv) return false;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addCanvas(key, cv);
      return true;
    }
    if (!bakeMap(0)) return null; // 헤드리스(document 없음) 등 → 안전 no-op

    // addDisplacement(texture, x, y) — texture=변위맵 키, x/y=변위 스케일(작은 float).
    var filter = l.addDisplacement(key, amplitude, amplitude);
    // center 를 displacement 필터에 반영(지원 시). Phaser 변위 필터는 텍스처 전체를
    // 화면에 매핑하므로 center 는 변위맵을 통해 표현됨 — 핸들에 보관만.

    var handle = {
      t: 0, strength: 1, radius: 0, done: false,
      _filter: filter, _key: key, center: center,
      destroy: function () {
        if (this.done) return;
        this.done = true;
        try {
          if (filter && l.remove) l.remove(filter);
          else if (filter && filter.destroy) filter.destroy();
        } catch (e) { /* graceful */ }
        if (scene.textures.exists(key)) scene.textures.remove(key);
      },
      update: function (dt) {
        if (this.done) return false;
        if (!(typeof dt === 'number') || dt !== dt || dt < 0 || dt === Infinity) dt = 0;
        this.t += dt;
        var env = ScreenFX.shockwaveDecay(this.t, duration, speed);
        this.radius = env.radius;
        this.strength = env.strength;
        if (env.progress >= 1) { this.destroy(); return false; }
        // 변위맵을 현재 반경으로 재생성 + 변위 스케일을 strength 로 감쇠.
        bakeMap(env.radius);
        if (filter) {
          var amp = amplitude * env.strength;
          if ('x' in filter) filter.x = amp;
          if ('y' in filter) filter.y = amp;
        }
        return true;
      }
    };
    return handle;
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
