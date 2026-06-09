/* ============================================================================
 * COZY CRYPT — style-architect 데모 (cozy-dungeon 무드 적용)
 * ----------------------------------------------------------------------------
 * 엔진: Phaser 4.1.0 (MIT) + PixelForge(절차적 스프라이트) + StyleKit(스타일 어댑터)
 *       + LightingKit/ScreenFX(WebGL 무드, Canvas 면 StyleKit 폴백).
 * 에셋: 100% 코드 생성 (CC0 / IP-safe). 어떤 상용 IP 에셋·이름·시그니처도 미사용.
 *
 * style-architect 계약 시연:
 *  - games/cozy-crypt-demo/style.json = 비주얼 단일 진실(여기 STYLE_SPEC 와 동일).
 *  - assets/palette.master.json = master_palette 상류 진실(스프라이트가 상속).
 *  - PixelForge 스프라이트를 StyleKit.palette(STYLE, MAP) 로 굽는다 → master_palette 색.
 *  - StyleKit.apply(scene, STYLE): WebGL 이면 따뜻한 앰비언트 어둠 + 포인트라이트 +
 *    포스트FX, Canvas 면 틴트 오버레이 폴백(R4).
 *
 * game-qa 호환: window.CozyCrypt = { game, STYLE, scene, verify } 노출 + ?autostart=1.
 *   verify.* 는 AC2 검증용(굽힌 CanvasTexture 픽셀 ↔ master_palette, 라이팅 오브젝트).
 * ==========================================================================*/
(function () {
  'use strict';

  var DESIGN_W = 384;   // 24 타일 (16px)
  var DESIGN_H = 224;   // 14 타일

  // --- 비주얼 단일 진실 -------------------------------------------------------
  // style.json 과 동일한 인라인 스펙(정적 페이지·오프라인 동작 보장). http 서빙 시
  // style.json 을 fetch 해 덮어쓸 수도 있으나, 데모는 결정적 동작을 위해 인라인 우선.
  var STYLE_SPEC = {
    slug: 'cozy-crypt-demo', schema_version: 1, medium: 'pixel', tier: 2, mood: 'cozy-dungeon',
    master_palette: {
      ramps: {
        stone:      ['#2a2438', '#3c3550', '#574a6e', '#7a6b94'],
        wood:       ['#3a2418', '#5a3a22', '#7a4a22', '#a06a34'],
        warm_light: ['#5a3a1a', '#a8631e', '#ffb347', '#ffe6a8'],
        moss:       ['#23351f', '#395a2e', '#56823f', '#7caa55'],
        flesh:      ['#7a4a52', '#c07a6e', '#ffce9e', '#ffe6c8']
      },
      neutrals: { black: '#120e1a', white: '#fff3e0' },
      background: '#171320'
    },
    role_colors: {
      player: '#7ad6ff', enemy: '#9a52c7', danger: '#e83b2e', pickup: '#ffd23f', ui_accent: '#ffb347'
    },
    proportions: { head_to_body: '1:1.2', silhouette: 'chunky-rounded', min_feature_px: 2 },
    line: { outline: 'selective', outline_color: 'darker-of-fill', weight_px: 1 },
    shading: { model: 'cell', light_dir: 'NW', ramp_steps: 3, hue_shift: 'warm-light-cool-shadow' },
    lighting: {
      ambient: { color: '#171320', alpha: 0.55 },
      point_lights: { color: '#ffd9a0', radius: 110, intensity: 0.9 },
      fog: { enabled: false }
    },
    postfx: {
      preset: 'warm-dungeon',
      bloom: { threshold: 0.6, amount: 0.4 },
      vignette: { radius: 0.7, strength: 0.45 },
      color_grade: { warm: 0.15 }
    },
    canvas_fallback: { ambient_overlay: '#171320cc', pre_shade_sprites: true },
    render: { pixelArt: true, antialias: false, roundPixels: true },
    lintConfig: { min_contrast_ratio: 3.0, max_palette_colors: 48,
      ip_redwords: ['gungeon', 'enter the gungeon', 'mario', 'zelda', 'isaac', 'metroid'] }
  };

  var STYLE = StyleKit.load(STYLE_SPEC);

  // --- char→색 매핑(master_palette 램프/역할에서) ----------------------------
  // PixelForge 문자 그리드를 style 색으로 칠한다. step 0=가장 어두움 … n=가장 밝음.
  var STONE_MAP = {
    'd': { ramp: 'stone', step: 0 }, 's': { ramp: 'stone', step: 1 },
    'm': { ramp: 'stone', step: 2 }, 'l': { ramp: 'stone', step: 3 },
    'o': '#120e1a'  // 외곽(검정)
  };
  var HERO_MAP = {
    'd': { ramp: 'flesh', step: 0 }, 's': { ramp: 'flesh', step: 2 }, 'l': { ramp: 'flesh', step: 3 },
    'c': { role: 'player' }, 'C': { ramp: 'stone', step: 1 },     // 망토=플레이어 역할색
    'o': '#120e1a', 'e': '#120e1a'
  };
  var TORCH_MAP = {
    'w': { ramp: 'wood', step: 1 }, 'W': { ramp: 'wood', step: 0 },
    'a': { ramp: 'warm_light', step: 1 }, 'b': { ramp: 'warm_light', step: 2 },
    'c': { ramp: 'warm_light', step: 3 }, 'o': '#120e1a'
  };
  var GEM_MAP = {
    'p': { role: 'pickup' }, 'P': { ramp: 'warm_light', step: 0 },
    'h': { ramp: 'warm_light', step: 3 }, 'o': '#120e1a'
  };

  // --- 스프라이트 정의(문자 그리드) ------------------------------------------
  var ART = {
    // 16x16 돌 벽돌 타일
    wall: { frames: [[
      'llllllllllllllll',
      'lmmmmmmmmmmmmmml',
      'lmsssssssssssml',
      'lmsdddsdddsddml',
      'lmsdssdsssdsdml',
      'lmsdssdsssdsdml',
      'lmsddddddddddml',
      'lmsssssssssssml',
      'lmsdddsdddsddml',
      'lmsdssdsssdsdml',
      'lmsdssdsssdsdml',
      'lmsddddddddddml',
      'lmsssssssssssml',
      'lmmmmmmmmmmmmmml',
      'loooooooooooool',
      '................'
    ]] },
    // 16x16 플로어 타일(돌, 약간 밝게)
    floor: { frames: [[
      'mmmmmmmmmmmmmmmm',
      'msssssssssssssm',
      'mslllsllllslllm',
      'mslslslslslslsm',
      'msllllsllllslsm',
      'mslslslslslslsm',
      'mslllslllllslsm',
      'mssssssssssssm',
      'mslllsllllslllm',
      'mslslslslslslsm',
      'msllllsllllslsm',
      'mslslslslslslsm',
      'mslllslllllslsm',
      'msssssssssssssm',
      'mmmmmmmmmmmmmmmm',
      'dddddddddddddddd'
    ]] },
    // 영웅(망토 두른 탐험가) idle 2프레임
    hero: { frames: [
      [
        '....oooo....',
        '...oCCCCo...',
        '...oCCCCo...',
        '...osssso...',
        '..osesseso..',
        '..ossssso...',
        '...osssso...',
        '..occccco...',
        '.occccccco..',
        '.occccccco..',
        '.occccccco..',
        '..occccco...',
        '..ods.sdo...',
        '..odo.odo...',
        '..oo...oo...',
        '............'
      ],
      [
        '....oooo....',
        '...oCCCCo...',
        '...oCCCCo...',
        '...osssso...',
        '..osesseso..',
        '..ossssso...',
        '...osssso...',
        '..occccco...',
        '.occccccco..',
        '.occccccco..',
        '.occccccco..',
        '..occccco...',
        '..ods.sdo...',
        '...odoodo...',
        '...oo..oo...',
        '............'
      ]
    ] },
    // 벽 횃불(불꽃 2프레임 깜빡)
    torch: { frames: [
      [
        '...aba..',
        '..abcba.',
        '..abcba.',
        '...aba..',
        '...WwW..',
        '...WwW..',
        '...WwW..',
        '...WWW..'
      ],
      [
        '..abca..',
        '..abcba.',
        '.abcbca.',
        '..abca..',
        '...WwW..',
        '...WwW..',
        '...WwW..',
        '...WWW..'
      ]
    ] },
    // 보물 보석(픽업)
    gem: { frames: [[
      '..ho..',
      '.hPpoh',
      'hPppPh',
      'oPppPo',
      '.oppo.',
      '..oo..'
    ]] }
  };

  // ===========================================================================
  // Crypt — 에셋 굽기 + 작은 던전 방 + 영웅 + 횃불 + 보석 + 스타일 무드 배선.
  //   단일 씬으로 둔다: 별도 Boot 씬에서 scene.start('Crypt') 하면 초기 멀티-씬 부팅
  //   사이클과 레이스가 나 Crypt 가 INIT 에서 멈춰 검은 화면이 났다. PixelForge 굽기는
  //   동기라 같은 create 안에서 굽고 바로 쓴다 → 씬 전환 자체를 제거.
  // ===========================================================================
  var CryptScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function CryptScene() { Phaser.Scene.call(this, { key: 'Crypt' }); },
    create: function () {
      var self = this;
      this.cameras.main.setBackgroundColor(STYLE.master_palette.background);

      // master_palette 에서 char→hex 팔레트를 만들어 PixelForge 로 굽는다(AC2). 동기 — 바로 아래에서 사용.
      PixelForge.bake(this, 'cc-wall',  { frames: ART.wall.frames,  palette: StyleKit.palette(STYLE, STONE_MAP) });
      PixelForge.bake(this, 'cc-floor', { frames: ART.floor.frames, palette: StyleKit.palette(STYLE, STONE_MAP) });
      PixelForge.bake(this, 'cc-hero',  { frames: ART.hero.frames,  palette: StyleKit.palette(STYLE, HERO_MAP) });
      PixelForge.bake(this, 'cc-torch', { frames: ART.torch.frames, palette: StyleKit.palette(STYLE, TORCH_MAP) });
      PixelForge.bake(this, 'cc-gem',   { frames: ART.gem.frames,   palette: StyleKit.palette(STYLE, GEM_MAP) });
      if (!this.anims.exists('cc-hero-idle'))
        this.anims.create({ key: 'cc-hero-idle', frames: [{ key: 'cc-hero', frame: 0 }, { key: 'cc-hero', frame: 1 }], frameRate: 2, repeat: -1 });
      if (!this.anims.exists('cc-torch-flicker'))
        this.anims.create({ key: 'cc-torch-flicker', frames: [{ key: 'cc-torch', frame: 0 }, { key: 'cc-torch', frame: 1 }], frameRate: 8, repeat: -1 });

      // 바닥 타일 깔기
      this.floors = [];
      for (var r = 0; r < DESIGN_H / 16; r++) {
        for (var c = 0; c < DESIGN_W / 16; c++) {
          var isWall = (r === 0 || r === (DESIGN_H / 16 - 1) || c === 0 || c === (DESIGN_W / 16 - 1));
          var key = isWall ? 'cc-wall' : 'cc-floor';
          this.add.image(c * 16 + 8, r * 16 + 8, key);
        }
      }

      // 횃불(좌우 벽) — 광원 위치의 닻
      this.torches = [];
      var torchSpots = [{ x: 40, y: 70 }, { x: DESIGN_W - 40, y: 70 }, { x: DESIGN_W / 2, y: 44 }];
      torchSpots.forEach(function (t) {
        var spr = self.add.sprite(t.x, t.y, 'cc-torch', 0).setScale(1.5);
        spr.play('cc-torch-flicker');
        self.torches.push(spr);
      });

      // 보석 픽업 몇 개
      this.gems = [];
      [{ x: 120, y: 150 }, { x: 264, y: 120 }, { x: 192, y: 170 }].forEach(function (g) {
        self.gems.push(self.add.sprite(g.x, g.y, 'cc-gem').setScale(1.5));
      });

      // 영웅
      this.hero = this.add.sprite(DESIGN_W / 2, DESIGN_H / 2 + 10, 'cc-hero', 0).setScale(1.5);
      this.hero.play('cc-hero-idle');

      // ── 스타일 무드 배선 ──────────────────────────────────────────────────
      // WebGL: 따뜻한 앰비언트 어둠 + 횃불 위치 포인트라이트 + 포스트FX.
      // Canvas: 틴트 오버레이 폴백(R4).
      this.styleResult = StyleKit.apply(this, STYLE, {
        lights: torchSpots.concat([{ x: this.hero.x, y: this.hero.y, color: STYLE.role_colors.player, radius: 80 }])
      });

      // game-qa 노출 — verify.* 로 AC2 검증.
      window.CozyCrypt.scene = this;
      window.CozyCrypt.styleResult = this.styleResult;
    }
  });

  // ===========================================================================
  // 게임 인스턴스 + game-qa 노출
  // ===========================================================================
  var config = {
    type: Phaser.AUTO,
    width: DESIGN_W, height: DESIGN_H,
    parent: 'game',
    backgroundColor: STYLE.master_palette.background,
    render: StyleKit.renderConfig(STYLE),   // D7: style.render 미러(pixelArt/antialias/roundPixels)
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [CryptScene]
  };

  var game = new Phaser.Game(config);

  // ── game-qa 검증 헬퍼(AC2) ──────────────────────────────────────────────
  // 굽힌 CanvasTexture 의 특정 픽셀 색을 읽어 master_palette 색과 일치하는지 확인.
  function texPixelHex(scene, key, x, y) {
    var tex = scene.textures.get(key);
    if (!tex) return null;
    var src = tex.getSourceImage();          // CanvasTexture → canvas 엘리먼트
    var ctx = src.getContext && src.getContext('2d');
    if (!ctx) return null;
    var d = ctx.getImageData(x, y, 1, 1).data;
    if (d[3] === 0) return null;             // 투명
    function h2(n) { var s = (n & 255).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + h2(d[0]) + h2(d[1]) + h2(d[2]);
  }

  window.CozyCrypt = {
    game: game,
    STYLE: STYLE,
    scene: null,         // Crypt create() 에서 채움
    styleResult: null,
    verify: {
      // 어떤 스프라이트의 (x,y) 픽셀 hex
      texPixel: function (key, x, y) {
        var s = window.CozyCrypt.scene; return s ? texPixelHex(s, key, x, y) : null;
      },
      // master_palette 램프 색이 굽힌 텍스처에 실제 등장하는지(GL 업로드 전 2D 캔버스).
      rampUsed: function (key, rampName) {
        var s = window.CozyCrypt.scene; if (!s) return false;
        var tex = s.textures.get(key); if (!tex) return false;
        var src = tex.getSourceImage();
        var ctx = src.getContext && src.getContext('2d'); if (!ctx) return false;
        var d = ctx.getImageData(0, 0, src.width, src.height).data;
        var want = StyleKit.rampOf(STYLE, rampName).map(function (h) { return StyleKit.parseRGBA(h); });
        for (var i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          for (var w = 0; w < want.length; w++) {
            if (d[i] === want[w].r && d[i + 1] === want[w].g && d[i + 2] === want[w].b) return true;
          }
        }
        return false;
      },
      // 라이팅 결과: WebGL 이면 lights/ambient 오브젝트, Canvas 면 폴백 오버레이.
      lighting: function () {
        var r = window.CozyCrypt.styleResult; if (!r) return null;
        if (r.mode === 'webgl') {
          return { mode: 'webgl',
            ambient: !!(r.lighting && r.lighting.ambient),
            pointLights: (r.lighting && r.lighting.lights) ? r.lighting.lights.length : 0,
            postfx: !!r.postfx };
        }
        return { mode: 'canvas', overlay: !!(r.fallback && r.fallback.overlay), preShade: !!(r.fallback && r.fallback.preShade) };
      }
    }
  };

  // ?autostart=1 — game-qa 헤드리스 진입(스플래시 없으므로 Boot 가 바로 Crypt 진입).
  // 명시 노출만 하면 충분(별도 스킵 불필요). 호환을 위해 플래그 기록.
  window.CozyCrypt.autostart = /[?&]autostart=1/.test(location.search);
})();
