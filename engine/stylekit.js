/* ============================================================================
 * StyleKit — 비주얼 아트 디렉션 어댑터 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * `style-architect` 디렉터 스킬이 산출한 games/<slug>/style.json(+ assets/
 * palette.master.json)을 로드해, **하나의 style 객체에서** 게임의 모든 비주얼
 * 서브시스템을 일관되게 배선하는 *얇은 어댑터*다. 새 무거운 런타임을 만들지 않고
 * 기존 엔진(PixelForge·VectorForge·LightingKit·ScreenFX·TiledForge)을 호출만 한다.
 *
 * 설계 분리 (중요):
 *  - StyleKit = **스타일 단일 진실 → 기존 엔진 호출**만 한다(색 생성/렌더는 안 함).
 *  - master_palette(assets/palette.master.json)가 상류 진실 → 스프라이트·아이템·
 *    능력·HUD·juice 가 같은 색을 상속한다. role_colors 는 의미색(player/enemy/...).
 *
 * 엔진 무관 코어 + 얇은 Phaser 어댑터:
 *  - 코어(load·normalize·palette·rampOf·roleColor·tilePalette)는 window/Phaser
 *    없이 Node 에서 그대로 돈다(require 로 결정적 테스트 — game-qa 호환). Date.now 미사용.
 *  - applyLighting/applyPostFX/applyCanvasFallback 은 scene/camera 를 받는 Phaser
 *    어댑터. LightingKit·ScreenFX 처럼 WebGL 전용 — Canvas 면 graceful no-op 후
 *    applyCanvasFallback 으로 룩을 근사 유지(R4).
 *
 * style.json 계약(요약 — 정식 스펙은 skills/wgf-style-architect/reference/cohesion-tools.md):
 *   { slug, schema_version, medium:"pixel"|"vector", tier:0..3, mood,
 *     master_palette:{ ramps:{<material>:[dark..light]}, neutrals:{black,white}, background },
 *     role_colors:{ player,enemy,danger,pickup,ui_accent, ... },
 *     proportions{}, line{}, shading{},
 *     lighting:{ ambient:{color,alpha}, point_lights:{color,radius,intensity}, fog:{enabled} },
 *     postfx:{ preset, bloom{}, vignette{}, color_grade{} },
 *     canvas_fallback:{ ambient_overlay, pre_shade_sprites },
 *     render:{ pixelArt, antialias, roundPixels }, lintConfig{} }
 *
 * 사용(브라우저):
 *   // index.html: phaser·forge·lightingkit·screenfx 다음, game 이전:
 *   //   <script src="../../engine/stylekit.js"></script>
 *   // 빌드 단계(STYLE_SPEC = 파싱된 style.json):
 *   var STYLE = StyleKit.load(STYLE_SPEC);
 *   // PixelForge 굽기 전 팔레트 오버라이드:
 *   PixelForge.bake(this, 'hero', { frames: HERO, palette: StyleKit.palette(STYLE) });
 *   // 씬 create() 끝에서 무드 배선(WebGL 이면 라이팅·포스트FX, 아니면 폴백):
 *   StyleKit.apply(this, STYLE);
 *   // 역할색(HUD·juice·아이템 등):
 *   var hpColor = StyleKit.roleColor(STYLE, 'danger');
 *
 * ⚠ lighting/postfx 는 WebGL 전용. Canvas 렌더러에선 apply() 가 자동으로
 *   applyCanvasFallback 만 수행한다(틴트 오버레이/사전셰이딩 플래그).
 * 100% CC0 / IP-safe — 색·무드만 다루며 어떤 상용 IP 에셋/이름도 쓰지 않는다.
 * ==========================================================================*/
(function (global) {
  'use strict';

  // 라이팅 레이어 기본 depth(caller 가 안 정할 때): 씬(0~수십) < 어둠(MULTIPLY) < 가산광(ADD).
  // 이 순서를 어기면 어둠이 광원을 뭉개 화면이 검게 된다. style.json 의 ambient.depth /
  // 라이트별 depth 로 오버라이드 가능.
  var AMBIENT_DEPTH = 900;
  var LIGHT_DEPTH = 1000;

  // ── 작은 유틸(엔진 무관) ──────────────────────────────────────────────────
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  // '#rrggbb' / '#rgb' / '#rrggbbaa' → 0xRRGGBB 정수(알파 무시). 잘못된 값이면 def.
  function hexToInt(hex, def) {
    if (typeof hex === 'number' && isFinite(hex)) return hex;
    if (typeof hex !== 'string') return def;
    var s = hex.trim().replace(/^#/, '');
    if (s.length === 3) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    if (s.length === 8) s = s.slice(0, 6);          // #rrggbbaa → rgb
    if (s.length !== 6 || /[^0-9a-fA-F]/.test(s)) return def;
    return parseInt(s, 16);
  }

  // 0xRRGGBB(또는 '#hex') → '#rrggbb'(소문자). PixelForge 팔레트는 문자열 hex 를 받는다.
  function toHexString(c) {
    if (typeof c === 'string') {
      var t = c.trim();
      return t.charAt(0) === '#' ? t.toLowerCase() : '#' + t.toLowerCase();
    }
    var n = (num(c, 0) >>> 0) & 0xffffff;
    var h = n.toString(16);
    while (h.length < 6) h = '0' + h;
    return '#' + h;
  }

  // hex(#rrggbb[aa]) → {r,g,b,a(0..1)}
  function parseRGBA(hex) {
    if (typeof hex !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
    var s = hex.trim().replace(/^#/, '');
    if (s.length === 3) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    var a = 1;
    if (s.length === 8) { a = parseInt(s.slice(6, 8), 16) / 255; s = s.slice(0, 6); }
    if (s.length !== 6 || /[^0-9a-fA-F]/.test(s)) return { r: 0, g: 0, b: 0, a: 1 };
    return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a: a };
  }

  // ── 정규화 ────────────────────────────────────────────────────────────────
  // style.json(부분/누락 허용) → 안전한 기본을 채운 정규 style 객체.
  // 외부 입력이므로 결측에 보수적 기본을 준다(런타임이 절대 throw 하지 않게).
  function normalize(spec) {
    spec = isObj(spec) ? spec : {};
    var mp = isObj(spec.master_palette) ? spec.master_palette : {};
    var neutrals = isObj(mp.neutrals) ? mp.neutrals : {};
    var ramps = isObj(mp.ramps) ? mp.ramps : {};
    var lighting = isObj(spec.lighting) ? spec.lighting : {};
    var postfx = isObj(spec.postfx) ? spec.postfx : {};
    var cf = isObj(spec.canvas_fallback) ? spec.canvas_fallback : {};
    var render = isObj(spec.render) ? spec.render : {};

    var medium = (spec.medium === 'vector') ? 'vector' : 'pixel';
    var background = typeof mp.background === 'string' ? mp.background : '#171320';

    return {
      slug: spec.slug || '',
      schema_version: num(spec.schema_version, 1),
      medium: medium,
      tier: num(spec.tier, 1),
      mood: spec.mood || 'custom',
      master_palette: {
        ramps: ramps,
        neutrals: {
          black: typeof neutrals.black === 'string' ? neutrals.black : '#120e1a',
          white: typeof neutrals.white === 'string' ? neutrals.white : '#fff3e0'
        },
        background: background
      },
      role_colors: isObj(spec.role_colors) ? spec.role_colors : {},
      proportions: isObj(spec.proportions) ? spec.proportions : {},
      line: isObj(spec.line) ? spec.line : {},
      shading: isObj(spec.shading) ? spec.shading : {},
      lighting: {
        ambient: {
          color: (isObj(lighting.ambient) && lighting.ambient.color) || background,
          alpha: num(isObj(lighting.ambient) ? lighting.ambient.alpha : null, 0.5)
        },
        point_lights: {
          color: (isObj(lighting.point_lights) && lighting.point_lights.color) || '#ffd9a0',
          radius: num(isObj(lighting.point_lights) ? lighting.point_lights.radius : null, 110),
          intensity: num(isObj(lighting.point_lights) ? lighting.point_lights.intensity : null, 0.9)
        },
        fog: { enabled: !!(isObj(lighting.fog) && lighting.fog.enabled),
               color: (isObj(lighting.fog) && lighting.fog.color) || '#b9c6e0',
               alpha: num(isObj(lighting.fog) ? lighting.fog.alpha : null, 0.14) }
      },
      postfx: {
        preset: typeof postfx.preset === 'string' ? postfx.preset : null,
        bloom: isObj(postfx.bloom) ? postfx.bloom : null,
        vignette: isObj(postfx.vignette) ? postfx.vignette : null,
        color_grade: isObj(postfx.color_grade) ? postfx.color_grade : null
      },
      canvas_fallback: {
        ambient_overlay: typeof cf.ambient_overlay === 'string' ? cf.ambient_overlay : null,
        pre_shade_sprites: cf.pre_shade_sprites !== false
      },
      render: {
        pixelArt: render.pixelArt !== undefined ? !!render.pixelArt : (medium === 'pixel'),
        antialias: render.antialias !== undefined ? !!render.antialias : (medium === 'vector'),
        roundPixels: render.roundPixels !== undefined ? !!render.roundPixels : (medium === 'pixel')
      },
      lintConfig: isObj(spec.lintConfig) ? spec.lintConfig : {},
      _raw: spec
    };
  }

  // StyleKit.load(json|style) → 정규 style. 이미 정규면(_raw 보유) 그대로 통과.
  function load(json) {
    if (isObj(json) && json._raw) return json;     // 이미 normalize 됨(멱등)
    return normalize(json);
  }

  // ── 팔레트(master_palette) ────────────────────────────────────────────────
  // 한 램프의 dark→light 배열 조회. 없으면 [] (호출부가 폴백).
  function rampOf(style, name) {
    var s = load(style);
    var r = s.master_palette.ramps[name];
    return Array.isArray(r) ? r : [];
  }
  // 램프에서 step 인덱스 색(범위 밖이면 양끝 클램프). 0=가장 어두움.
  function rampColor(style, name, step) {
    var r = rampOf(style, name);
    if (!r.length) return null;
    var i = step | 0;
    if (i < 0) i = 0; if (i >= r.length) i = r.length - 1;
    return r[i];
  }

  /* StyleKit.palette(style[, mapping]) → PixelForge 호환 P(char→hex).
   *  PixelForge.bake(scene, key, { frames, palette }) 의 palette 로 바로 넣는다.
   *  - 기본: 단일 문자 키('.'/' '=투명)를 master_palette 램프에서 dark→light 로 깐다.
   *    각 램프 R 은 R0(dark)..Rn(light) → 첫 글자 소문자(어두움)·대문자(밝음) 관례를
   *    따르되, 충돌을 피해 ramp 별 4단(예: stone=k/K + 보조)으로 매핑한다.
   *  - mapping(선택): { 'x': '#hex' | {ramp:'stone', step:2} } 로 명시 오버라이드/추가.
   *    PixelForge 의 char 그리드를 style 색으로 칠하고 싶을 때 게임이 직접 키를 정한다.
   *  멱등·순수(전역 P 를 변형하지 않고 새 객체 반환).
   */
  function palette(style, mapping) {
    var s = load(style);
    var P = { '.': null, ' ': null };
    // 명시 매핑이 단일 진실: 게임이 char→색 또는 char→{ramp,step} 으로 정확히 지정.
    if (isObj(mapping)) {
      Object.keys(mapping).forEach(function (ch) {
        var v = mapping[ch];
        if (v == null) { P[ch] = null; return; }
        if (typeof v === 'string') { P[ch] = toHexString(v); return; }
        if (isObj(v) && v.ramp) {
          var c = rampColor(s, v.ramp, num(v.step, 0));
          P[ch] = c ? toHexString(c) : null;
          return;
        }
        if (isObj(v) && v.role) { var rc = roleColor(s, v.role); P[ch] = rc ? toHexString(rc) : null; }
      });
    }
    // 항상 제공되는 편의 키(중립/배경) — 매핑이 덮어쓰지 않은 경우만.
    var n = s.master_palette.neutrals;
    if (P['o'] === undefined) P['o'] = toHexString(n.black);     // outline/검정
    if (P['#'] === undefined) P['#'] = toHexString(n.white);     // 흰 하이라이트
    if (P['_'] === undefined) P['_'] = toHexString(s.master_palette.background);
    return P;
  }

  // ── 역할색(role_colors) ───────────────────────────────────────────────────
  // HUD(game-ui-hud)·juice 파티클·능력·아이템이 의미색을 상속한다.
  function roleColor(style, role) {
    var s = load(style);
    var c = s.role_colors[role];
    return typeof c === 'string' ? c : null;
  }
  // 0xRRGGBB 정수로(Phaser tint/pointlight color 인자용).
  function roleColorInt(style, role, def) {
    return hexToInt(roleColor(style, role), def == null ? 0xffffff : def);
  }

  // ── 타일 팔레트(TiledForge.bakeTileset 용) ─────────────────────────────────
  // tiled.bakeTileset(scene, defs, { palette }) 에 넣을 char→hex 맵.
  function tilePalette(style, mapping) {
    return palette(style, mapping);    // 타일도 PixelForge 와 동일 char 그리드 규약.
  }

  // ── 라이팅(WebGL 전용) ─────────────────────────────────────────────────────
  function webglSupported(scene) {
    return !!(global.LightingKit && global.LightingKit.supported && global.LightingKit.supported(scene));
  }

  /* StyleKit.applyLighting(scene, style[, opts]) → { ambient, lights:[] } | null
   *  WebGL 이면 LightingKit 으로 앰비언트 어둠 + 포인트라이트를 배선. Canvas 면 null.
   *  opts: { x,y,w,h(앰비언트 영역, 기본 카메라 전체), lights:[{x,y}](포인트 위치들) }
   */
  function applyLighting(scene, style, opts) {
    var s = load(style);
    if (!webglSupported(scene)) return null;
    opts = opts || {};
    var cam = scene.cameras && scene.cameras.main;
    var w = num(opts.w, cam ? cam.width : 800);
    var h = num(opts.h, cam ? cam.height : 600);
    var x = num(opts.x, w / 2);
    var y = num(opts.y, h / 2);

    // ★ 레이어 순서가 핵심: 씬(타일·스프라이트, 보통 depth 0~수십) 위에 어둠(MULTIPLY)을
    //   덮고, 그 *위*에 가산광(ADD)을 올려야 따뜻한 광원 풀이 어둠을 뚫는다. depth 를 안 주면
    //   ambient·light 가 모두 depth 0 으로 떨어져 어둠이 광원을 뭉개 화면이 거의 검게 된다.
    //   그래서 caller 가 안 정하면 ambient < light 로 강제한다(style.json 으로 오버라이드 가능).
    var amb = s.lighting.ambient;
    var ambient = global.LightingKit.ambient(scene, x, y, w, h,
      hexToInt(amb.color, 0x171320), num(amb.alpha, 0.5));
    if (ambient && ambient.setDepth) ambient.setDepth(num(amb.depth, AMBIENT_DEPTH));

    var lights = [];
    var lp = s.lighting.point_lights;
    var positions = Array.isArray(opts.lights) ? opts.lights : [];
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i] || {};
      var l = global.LightingKit.light(scene, num(p.x, x), num(p.y, y), {
        color: hexToInt(p.color || lp.color, 0xffd9a0),
        radius: num(p.radius, lp.radius),
        intensity: num(p.intensity, lp.intensity),
        depth: (p.depth != null ? p.depth : LIGHT_DEPTH)
      });
      if (l) lights.push(l);
    }

    var fog = null;
    if (s.lighting.fog.enabled && global.LightingKit.fog) {
      fog = global.LightingKit.fog(scene, x, y, w, h, {
        alpha: num(s.lighting.fog.alpha, 0.14)
      });
    }
    return { ambient: ambient, lights: lights, fog: fog };
  }

  /* StyleKit.light(scene, style, x, y[, over]) → 단일 포인트라이트(스타일 기본값).
   *  횃불·등불·플레이어 글로우를 스타일 일관 색/반경으로 한 줄에. WebGL 아니면 null.
   */
  function light(scene, style, x, y, over) {
    var s = load(style);
    if (!webglSupported(scene)) return null;
    var lp = s.lighting.point_lights;
    over = over || {};
    return global.LightingKit.light(scene, x, y, {
      color: hexToInt(over.color || lp.color, 0xffd9a0),
      radius: num(over.radius, lp.radius),
      intensity: num(over.intensity, lp.intensity),
      depth: (over.depth != null ? over.depth : LIGHT_DEPTH)
    });
  }

  // ── 포스트FX(WebGL 전용) ───────────────────────────────────────────────────
  function postfxSupported(camera) {
    return !!(global.ScreenFX && global.ScreenFX.supported && global.ScreenFX.supported(camera));
  }

  /* StyleKit.applyPostFX(camera, style) → { preset?, bloom?, vignette?, grade? } | null
   *  ScreenFX 로 블룸·비네트·컬러그레이드를 배선. Canvas 면 null.
   *  preset 이 ScreenFX.preset 이름(night/neon/retro/dream)이면 그걸 먼저 적용.
   */
  function applyPostFX(camera, style) {
    var s = load(style);
    if (!postfxSupported(camera)) return null;
    var out = {};
    var pf = s.postfx;

    // ScreenFX 내장 프리셋 이름이면 한 방으로 깔고, 그 위에 세부 오버라이드.
    var known = { night: 1, neon: 1, retro: 1, dream: 1 };
    if (pf.preset && known[pf.preset]) out.preset = global.ScreenFX.preset(camera, pf.preset);

    if (pf.bloom) {
      out.bloom = global.ScreenFX.bloom(camera, {
        threshold: num(pf.bloom.threshold, 0.55),
        amount: num(pf.bloom.amount, 0.7),
        strength: num(pf.bloom.strength, 1.2)
      });
    }
    if (pf.vignette) {
      out.vignette = global.ScreenFX.vignette(camera, {
        radius: num(pf.vignette.radius, 0.5),
        strength: num(pf.vignette.strength, 0.5)
      });
    }
    // color_grade.warm(0..1) → 따뜻한 컬러매트릭스(채도/밝기 미세 보정).
    // ⚠ ColorMatrix 풋건: 각 연산은 multiply=true 가 아니면 행렬을 리셋·대체하고,
    //   brightness(v) 는 "+v 밝기"가 아니라 RGB×v 스케일(1=원본, 0=검정)이다.
    //   brightness(warm*0.08) 처럼 쓰면 화면 전체가 ~1% 밝기 → 검은 화면이 된다.
    if (pf.color_grade && typeof pf.color_grade.warm === 'number') {
      var warm = pf.color_grade.warm;
      out.grade = global.ScreenFX.colorGrade(camera, function (m) {
        if (m.saturate) m.saturate(warm * 0.4);
        if (m.brightness) m.brightness(1 + warm * 0.08, true);
      });
    }
    return out;
  }

  // ── Canvas 폴백(R4) ────────────────────────────────────────────────────────
  /* StyleKit.applyCanvasFallback(scene, style) → { overlay } | null
   *  WebGL 라이팅/포스트FX 가 안 되는 Canvas 렌더러에서 무드를 근사 유지한다.
   *  - ambient_overlay(#rrggbbaa): 화면 전체에 반투명 틴트 사각형(앰비언트 어둠 근사).
   *  - pre_shade_sprites: 플래그만 반환(스프라이트 굽기 단계에서 게임/포지가 참조).
   *  WebGL 이어도 호출 가능(그땐 보통 apply() 가 라이팅을 택해 호출 안 함).
   */
  function applyCanvasFallback(scene, style) {
    var s = load(style);
    var cf = s.canvas_fallback;
    var tint = cf.ambient_overlay;
    if (!tint) {
      // ambient_overlay 미지정 시 lighting.ambient 로 합성(color + alpha→aa).
      var amb = s.lighting.ambient;
      var a = Math.round(Math.max(0, Math.min(1, num(amb.alpha, 0.5))) * 255);
      var aa = a.toString(16); if (aa.length < 2) aa = '0' + aa;
      tint = toHexString(amb.color) + aa;
    }
    var cam = scene.cameras && scene.cameras.main;
    var w = cam ? cam.width : 800, h = cam ? cam.height : 600;
    var rgba = parseRGBA(tint);
    if (!scene.add || !scene.add.rectangle) return { overlay: null, preShade: cf.pre_shade_sprites };
    var rect = scene.add.rectangle(w / 2, h / 2, w, h,
      (rgba.r << 16) | (rgba.g << 8) | rgba.b, rgba.a);
    if (rect.setScrollFactor) rect.setScrollFactor(0);
    if (rect.setDepth) rect.setDepth(num(cf.depth, 9990));
    return { overlay: rect, preShade: cf.pre_shade_sprites };
  }

  /* StyleKit.apply(scene, style[, opts]) → { mode, lighting?, postfx?, fallback? }
   *  무드 배선 한 방: WebGL 이면 라이팅+포스트FX, Canvas 면 폴백 오버레이.
   *  씬 create() 끝에서 호출. opts 는 applyLighting 으로 전달(라이트 위치 등).
   */
  function apply(scene, style, opts) {
    var s = load(style);
    var cam = scene.cameras && scene.cameras.main;
    if (webglSupported(scene)) {
      return { mode: 'webgl',
        lighting: applyLighting(scene, s, opts),
        postfx: cam ? applyPostFX(cam, s) : null };
    }
    return { mode: 'canvas', fallback: applyCanvasFallback(scene, s) };
  }

  // ── 게임 config 헬퍼 ───────────────────────────────────────────────────────
  // style.render → Phaser.Game config 의 render 블록(D7: pixelArt/antialias/roundPixels).
  function renderConfig(style) {
    var s = load(style);
    return { pixelArt: s.render.pixelArt, antialias: s.render.antialias, roundPixels: s.render.roundPixels };
  }

  var StyleKit = {
    load: load,
    normalize: normalize,
    palette: palette,
    tilePalette: tilePalette,
    rampOf: rampOf,
    rampColor: rampColor,
    roleColor: roleColor,
    roleColorInt: roleColorInt,
    applyLighting: applyLighting,
    light: light,
    applyPostFX: applyPostFX,
    applyCanvasFallback: applyCanvasFallback,
    apply: apply,
    renderConfig: renderConfig,
    // 색 유틸(테스트·게임 코드 공유)
    hexToInt: hexToInt,
    toHexString: toHexString,
    parseRGBA: parseRGBA
  };

  global.StyleKit = StyleKit;
  if (typeof module !== 'undefined' && module.exports) module.exports = StyleKit;
})(typeof window !== 'undefined' ? window : this);
