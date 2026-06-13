/* ============================================================================
 * Runeburst — 별무리 사가 (web-game-builder 데모)
 * ----------------------------------------------------------------------------
 * 코어: 매치3 스왑 캐스케이드 (Bejeweled/Candy Crush류 — 메카닉만 차용, IP-safe).
 * 재미 조합 (사용자 주도 청사진 + 캔디크러시 기믹 확장):
 *   - FE-COMBO   : 스왑→소거→낙하→리필→재매치 캐스케이드. 점수는 즉시 누적되고
 *                  캐스케이드가 깊을수록 칸당 점수가 ×깊이로 커진다(정산 기능 없음, 음 피치 스택).
 *   - FE-OVERLOAD : 과부하 셀(글로우)을 포함해 매치하면 그 수 점수 ×2 후 셀 재배치.
 *   - FE-CONSTRAINT+OPTIMIZE : 제한 이동 수 + (목표 4종) → 별 1~3 판정.
 *   - FE-PLANNING : 특수 타일 — 4매치=라인 블래스터, 5매치=컬러 코어, L/T자=포장,
 *                  특수+특수 스왑 조합 폭발(라인+라인=십자, 코어+코어=전체 등).
 *   - FE-JUST-ONE-MORE : 데일리 시드(오늘의 보드, 결과 이모지 공유) + localStorage 베스트.
 * 캔디크러시 기믹: 비정형 보드(셀 마스크) · 목표 4종(점수/성운 젤리/색 수집/별조각 내리기) ·
 *   장애물(성운 젤리 2겹 / 얼음 / 번식하는 암흑물질) · 과부하 셀(×2) · 아이템 4종 · 교착 자동 셔플.
 * 엔진: Phaser 4.1.0 + VectorForge(네온 글로우 룬) + ChipAudio(콤보 피치 스택) + MobileHarness.
 * 보드모델/렌더 분리: board[r][c]=tile|null 이 유일 상태원, spr[r][c] 컨테이너는 거울.
 *   셀 오버레이(mask/jelly/ice/overload)는 별도 2D 배열로 타일과 독립 관리.
 * IP 안전: 'Bejeweled'/'Candy Crush' 명칭·디자인·보이스 미사용 — 전부 절차생성 오리지널.
 * ==========================================================================*/
(function () {
  'use strict';

  var DESIGN_W = 540, DESIGN_H = 960;
  var COLS = 7, ROWS = 7;
  var TILE = 64;
  var BOARD_W = TILE * COLS;
  var BOARD_X = Math.round((DESIGN_W - BOARD_W) / 2);
  var BOARD_Y = 286;
  var ENT = 72;
  var HOT = 4;
  var MULT_CAP = 9;
  var MAX_SPREAD = 9;

  var SP_NONE = 0, SP_LINE_H = 1, SP_LINE_V = 2, SP_CORE = 3, SP_WRAP = 4;

  var audio = new ChipAudio();
  window.GAME_AUDIO = audio;

  var RUNES = [
    { g: ['#ff8aa6', '#e8345f'], glow: 'rgba(255,90,130,0.9)',  sym: 'star' },
    { g: ['#ffe08a', '#f0a01f'], glow: 'rgba(255,195,70,0.9)',  sym: 'diamond' },
    { g: ['#8af0b4', '#2fd07a'], glow: 'rgba(95,240,160,0.9)',  sym: 'triangle' },
    { g: ['#8ae8ff', '#2bb6e0'], glow: 'rgba(90,220,255,0.95)', sym: 'orb' },
    { g: ['#9fb0ff', '#4a5fee'], glow: 'rgba(120,140,255,0.9)', sym: 'hex' },
    { g: ['#cf9fff', '#7a3fd0'], glow: 'rgba(175,110,255,0.9)', sym: 'crescent' }
  ];
  var RUNE_NAMES = ['홍성', '금성', '녹성', '청성', '남성', '자성'];

  // --- 보드 모양 마스크 (X=유효 칸, .=구멍) -------------------------------
  var SHAPES = {
    square: ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX'],
    cross:  ['..XXX..', '..XXX..', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '..XXX..', '..XXX..'],
    diamond:['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    hourglass:['XXXXXXX', '.XXXXX.', '..XXX..', '...X...', '..XXX..', '.XXXXX.', 'XXXXXXX'],
    heart:  ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    star:   ['...X...', '..XXX..', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', 'XX...XX'],
    ring:   ['XXXXXXX', 'XXXXXXX', 'XX...XX', 'XX...XX', 'XX...XX', 'XXXXXXX', 'XXXXXXX']
  };

  // --- 레벨 데이터 (13레벨 — 기믹을 하나씩 가르치며 모양 분배) -------------
  var LEVELS = [
    { name: '첫 별빛',     shape: 'square',  colors: 5, moves: 20, goal: 1000, win: { type: 'score', target: 1000 }, seed: 1001 },
    { name: '연쇄의 맛',   shape: 'square',  colors: 5, moves: 18, goal: 1600, win: { type: 'score', target: 1600 }, seed: 1002 },
    { name: '라인 블래스터', shape: 'square', colors: 6, moves: 18, goal: 2200, win: { type: 'score', target: 2200 }, seed: 1003 },
    { name: '컬러 코어',   shape: 'square',  colors: 6, moves: 16, goal: 2800, win: { type: 'score', target: 2800 }, seed: 1004 },
    { name: '성운을 걷어라', shape: 'cross', colors: 6, moves: 22, goal: 2000, win: { type: 'jelly' }, jelly: 1, seed: 1005 },
    { name: '정산의 도박', shape: 'diamond', colors: 6, moves: 16, goal: 3200, win: { type: 'score', target: 3200 }, overload: true, seed: 1006 },
    { name: '얼어붙은 룬', shape: 'hourglass', colors: 6, moves: 20, goal: 2600, win: { type: 'score', target: 2600 }, ice: 8, seed: 1007 },
    { name: '별조각을 내려', shape: 'heart', colors: 6, moves: 24, goal: 2400, win: { type: 'ingredient', count: 3 }, ingredients: 3, seed: 1008 },
    { name: '암흑물질',    shape: 'ring',    colors: 6, moves: 24, goal: 2600, win: { type: 'jelly' }, jelly: 1, spreaders: 2, seed: 1009 },
    { name: '조합 폭발',   shape: 'star',    colors: 6, moves: 20, goal: 3600, win: { type: 'score', target: 3600 }, overload: true, seed: 1010 },
    { name: '색을 모아라', shape: 'cross',   colors: 6, moves: 18, goal: 2400, win: { type: 'collect', color: 0, count: 24 }, seed: 1011 },
    // 종합 시험(피날 앞): 미사용 jelly:2(2겹 성운) 첫 도입 + 기습득 ice 조합 — LD-4BEAT 비틀기 · LD-ONE-IDEA(새 개념 1개) · LD-FAIR(moves 넉넉)
    { name: '겹성운의 시련', shape: 'hourglass', colors: 6, moves: 26, goal: 3400, win: { type: 'jelly' }, jelly: 2, ice: 6, seed: 1013 },
    { name: '마지막 한 수', shape: 'diamond', colors: 6, moves: 22, goal: 4200, win: { type: 'score', target: 4200 }, overload: true, ice: 6, seed: 1012 }
  ];

  // 무작위는 RngForge(engine/rngforge.js)로 통일 — mulberry32 비트 동일, seed 로 결정적 재현.
  // (game-qa 헤드리스 step 하니스 + lint-rng.mjs 결정론 정책)
  function mulberry32(a) { return RngForge.create(a); }

  // ===========================================================================
  // 아트 베이크
  // ===========================================================================
  // 룬 심볼 — game-icons.net 젬 SVG path (CC-BY 3.0, CREDITS.txt 표기). sprite-picker 로 사용자가 선택.
  // 512 viewBox 좌표를 타일에 매핑. 6색 팔레트(RUNES[].g/glow)는 유지하고 '모양'만 실제 젬으로 교체.
  // idx→젬: 0 에메랄드 · 1 젬트리오 · 2 크리스털군집 · 3 샤인크리스털 · 4 플로팅크리스털 · 5 컷다이아몬드.
  var GEM_PATHS = {"0":["M310.375 16.75L89.405 75.72l58.126 50.905L282.563 90.28l2.032-.53 25.78-73zm17.063 7.844l-27.157 76.812 91.69 91.875 95.624-8.78L327.438 24.594zm-41.813 12.062l-8.594 33.657c-.28-15.516-38.03-17.018-107.56-4.376l116.155-29.28zm51.063 14.625l123.5 123.407-58.844 7.563c16.2-21.37-32.277-91.112-64.656-130.97zM74.75 87.72L15.594 308.405l79-31.47 37.28-139.155L74.75 87.72zm207.438 22l-133.032 35.81-35.72 133.376 97.25 97.53 133.064-35.81 35.72-133.376-97.283-97.53zm-201.72 5.686l32.844 30.5-30.156 118.97-39.03 15.812c50.817-30.543 65.667-130.132 36.343-165.282zm195.876 14.78L359 213.377l-30.156 113.81-44.688 11.97c119.527-107.872-34.816-238.375-131.5-140.875l9.875-37.405 113.814-30.688zM490.564 203l-92.877 8.53-35.968 134.19 71.342 71.842L490.563 203zm-17.283 13.875L444.03 333.03c6.73-68.874-.03-90.85-30.655-111.5l59.906-4.655zm-371.155 77.188L20.22 326.688l161.75 161.468 17.31-96.72-97.155-97.373zm.094 20l78.124 82.437-7.438 61.375c-5.23-44.565-28.34-85.92-70.687-143.813zm246.124 44.687l-130.53 35.125-17.564 98.188 221.688-59.157-73.594-74.156zm18.625 42.5l24.28 24.844-115.22 32.72c61.28-26.446 83.34-37.418 90.94-57.564z"],"1":["M303.2 19.338l-161.966 93.51 93.512 161.966 161.967-93.51-4.674-8.093-4.874-8.44-4.127-7.54-.188.07-79.65-137.962zm-20.62 33.486l-50.27 90.14c-19.184-7.687-37.887-17.28-56.165-28.69l106.435-61.45zm19.914 2.664l63.235 109.528c-40.568 2.1-78.993-3.29-115.658-15.536l52.422-93.992zm-251.61 25.68L23.032 167.99l74.302 51.123 27.854-86.822-5.723-3.936-68.578-47.186zm10.118 29.646l32.295 22.22-44.233 14.99 11.938-37.21zm385.836 22.33l-46.143 17.418 9.06 16.557 20.165-7.614 2.992 43.463-39.94 15.077-.878-12.748-18.016 10.4 1.977 28.71 76.457-28.865-5.674-82.402zm-270.55 3.045c31.896 18.617 65.316 32.12 100.267 39.964l-39.52 65.25L176.29 136.19zm-76.604 14.414l-12.467 38.863-33.73-23.207 46.197-15.656zm196.437 29.318c19.028 3.07 38.496 4.478 58.403 4.158l-93.675 54.084 35.273-58.242zM21.187 224.744l1.96 14.336 21.672 158.522 167.026 49.484-1.994-14.59-23.522-12.463L79.99 388.53l59.563-26.098 34.398-54.528 6.943 50.77 16.082-20.33-8.766-64.114-167.024-49.486zm22.435 26.14l121.497 35.997-38.314 60.733-66 28.92-17.182-125.65zm313.064 5.206l-88.914 23.824-1.916 2.395-89.266 111.594 197.365 102.963 118.662-187.66-135.93-53.117zm-13.6 22.988l31.3 55.317-86.09 22.673 2.505-63.978 52.284-14.012zm21.582.193l88.18 34.46-59.778 15.743-28.402-50.202zm-93.035 25.734l-2.232 57.04-54.978 14.48 57.21-71.52zm184.313 27.234l-73.545 116.31 13.94-100.61 59.605-15.7zm-79.185 20.856L362.762 454.11l-67.342-79.594 81.338-21.422zM275.402 379.79l67.532 79.817-124.325-64.86 56.792-14.958z"],"2":["M263.563 19.063l-53.875 59.562v90.063l-34.75-60.188-35.563-17.594-9.344 43.53 48.376 83.783-19.97-5.345-28.75 10.5 19.658 23.5 30.28 8.125-59.155 15.844-23.407 27.97 34.25 12.498 66.875-17.937-27.875 48.28 5.562 62.72 33.813-15.72v33.126l46.812 66.626 46.78-66.625v-72.81l21.626 68.092 35.875 27.344 13.564-43.03-32.688-102.97 42.875 11.5 26.876-13.78-17.78-20.22-64.595-17.312-.092-.25 82.25-22.03 21.125-24.064-31.97-16.406-73.656 19.75 39-67.594-3.562-55.25-58.844 18.97V78.624l-39.717-59.563zm-5.72 109.562l22.438 115.03 39.876 12.032-39.875 12.032-22.436 115.03-22.375-114.53-41.595-12.533 41.594-12.53 22.374-114.532z"],"3":["M258.396 21.375l-17.503 64.1c-1.133 2.452-1.782 5.172-1.782 8.05 0 10.634 8.62 19.256 19.255 19.256 10.634 0 19.256-8.62 19.256-19.255 0-.72-.045-1.426-.122-2.125h.022l-.05-.18c-.23-1.917-.737-3.746-1.488-5.45l-17.586-64.395zm118.21 31.494l-46.21 45.77c-6.03 3.254-10.126 9.626-10.126 16.956 0 10.633 8.622 19.254 19.255 19.254.668 0 1.327-.034 1.977-.1 7.608 5.175 14.85 11.125 21.6 17.875 57.872 57.872 57.87 151.418 0 209.29-6.75 6.747-13.99 12.694-21.594 17.868-.65-.066-1.308-.1-1.975-.1-10.634 0-19.256 8.623-19.256 19.256 0 7.006 3.757 13.12 9.352 16.49l46.694 46.252-18.545-70.55c6.468-4.81 12.67-10.137 18.536-16.003l6.608-6.61-.334-.332c3.252-3.637 6.305-7.388 9.183-11.23l71.057 18.68-51.63-52.126c6.54-15.08 10.757-30.926 12.636-46.996l70.61-19.282-70.56-19.267c-1.82-15.925-5.937-31.633-12.343-46.59l51.234-51.727-70.318 18.483c-4.842-6.536-10.22-12.8-16.144-18.723-5.794-5.794-11.916-11.063-18.298-15.824l18.587-70.717zm-236.307.005l17.112 65.107c.218 1.76.662 3.45 1.322 5.032l.153.582c-6.38 4.76-12.498 10.023-18.29 15.814-5.92 5.92-11.294 12.18-16.136 18.715L54.024 139.61l51.31 51.802c-6.41 14.945-10.535 30.64-12.376 46.553l-70.562 19.27L92.95 276.5c1.856 16.108 6.06 31.994 12.595 47.105l-51.574 52.07 70.952-18.648c4.722 6.312 9.94 12.368 15.676 18.102 5.815 5.814 11.96 11.102 18.367 15.876-1.004 2.215-1.613 4.646-1.707 7.213l-16.678 63.456 48.91-48.447-.037-.08c3.86-3.52 6.297-8.575 6.297-14.21 0-10.634-8.622-19.256-19.256-19.256-.395 0-.786.015-1.176.04-7.573-5.16-14.783-11.088-21.506-17.81-57.872-57.872-57.872-151.417 0-209.29 6.725-6.723 13.938-12.65 21.514-17.81.39.022.782.036 1.178.036 10.634 0 19.254-8.62 19.254-19.254 0-6.22-2.963-11.736-7.54-15.256L140.3 52.875zm127.436 89.87v49.02l33.602 19.292 46.18-25.045-79.782-43.268zm-18.69.312l-79.722 42.957 46.31 24.955 33.413-19.062v-48.85zM159.9 202.164v114.012l46.346-24.975v-64.063L159.9 202.164zm196.985.027l-46.342 25.134v63.7l46.342 25.136V202.19zm-98.367 5.83l-33.584 19.158v64.285l33.584 19.162 33.336-19.145v-64.318l-33.336-19.14zm43.082 99.416l-33.864 19.445v47.056l78.24-42.432-44.376-24.068zm-86.24.084l-44.495 23.976 78.182 42.127v-46.885L215.36 307.52zm43.005 94.234c-10.634 0-19.254 8.622-19.254 19.256 0 2.74.582 5.342 1.615 7.703l17.67 64.713 17.787-65.12c.57-1.39.965-2.86 1.197-4.388l.06-.23h-.026c.122-.878.207-1.767.207-2.678 0-10.634-8.62-19.256-19.255-19.256z"],"4":["M320.94 24.86v55.654l45.31 58.49v66.27l41.24-64.038L320.94 24.86zm-56.706 16.263l-76.77 94.758 87.09 27.778 64.58-29.146-24.81-32.024-50.09-61.365zm-143.074 88.5l-82.674 96.035 82.674 26.858V129.623zm226.403 21.588l-62.307 28.122v238.334l62.176-28.875V234.5l.13-.203V151.21zm-165.907 2.436v237.258l84.912 27.766V180.73l-84.912-27.084zM44.85 247.376l76.31 102.368v-77.58l-76.31-24.79zm331.31 4.413v154.415l82.752-13.533L376.16 251.79zm73.412 161.347L376.16 425.14v46.768l73.412-58.77zm-256.267 1.238l70.93 79.78 70.738-78.973-57.516 26.713-84.152-27.52z"],"5":["M92.906 94.813l60.438 79.75 78.125-79.75H92.905zm189.25 0L359.25 173.5l58.688-78.688H282.155zm-25.344.843l-84.718 86.47H341.53l-84.717-86.47zm177.907 7.906l-58.626 78.563H494.53l-59.81-78.563zm-358.064.75l-57.78 77.813h116.78l-59-77.813zm-58.5 96.5L226.562 429.22 143.344 200.81H18.156zm145.063 0l93.593 256.844 93.593-256.844H163.22zm207.06 0L287.064 429.22 495.469 200.81H370.28z"]};
  function drawGem(ctx, w, h, idx) {
    var ps = GEM_PATHS[idx];
    if (!ps || !ps.length || typeof Path2D === 'undefined') return;
    var s = w * 0.66 / 512;
    ctx.save();
    ctx.translate(w / 2 - 256 * s, h / 2 - 256 * s);
    ctx.scale(s, s);
    var grd = ctx.createLinearGradient(0, 96, 0, 430);
    grd.addColorStop(0, 'rgba(255,255,255,0.98)');
    grd.addColorStop(1, 'rgba(220,236,255,0.85)');
    ctx.fillStyle = grd;
    for (var i = 0; i < ps.length; i++) ctx.fill(new Path2D(ps[i]));
    ctx.restore();
  }

  function bakeArt(scene) {
    var VF = VectorForge.helpers;
    RUNES.forEach(function (R, idx) {
      VectorForge.bake(scene, 'rune-' + idx, { w: ENT, h: ENT, draw: function (ctx, w, h) {
        VF.glow(ctx, R.glow, 10, function () {
          VF.rr(ctx, w * 0.12, h * 0.12, w * 0.76, h * 0.76, w * 0.26);
          ctx.fillStyle = VF.lin(ctx, 0, h * 0.12, 0, h * 0.9, [[0, R.g[0]], [1, R.g[1]]]);
          ctx.fill();
        });
        ctx.save(); VF.rr(ctx, w * 0.12, h * 0.12, w * 0.76, h * 0.76, w * 0.26); ctx.clip();
        ctx.fillStyle = VF.lin(ctx, 0, h * 0.12, 0, h * 0.6, [[0, 'rgba(255,255,255,0.32)'], [1, 'rgba(255,255,255,0)']]);
        ctx.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.4);
        ctx.restore();
        drawGem(ctx, w, h, idx);
      } });
    });

    VectorForge.bake(scene, 'core', { w: ENT, h: ENT, draw: function (ctx, w, h) {
      var cx = w / 2, cy = h / 2;
      VF.glow(ctx, 'rgba(255,255,255,0.95)', 16, function () {
        VF.circle(ctx, cx, cy, w * 0.34);
        var g = ctx.createConicGradient ? ctx.createConicGradient(0, cx, cy) : null;
        if (g) { ['#ff5f8a', '#ffd34a', '#5ff0a0', '#5fd0ff', '#8a8aff', '#c66bff', '#ff5f8a'].forEach(function (c, i, a) { g.addColorStop(i / (a.length - 1), c); }); ctx.fillStyle = g; }
        else ctx.fillStyle = VF.radial(ctx, cx, cy, w * 0.34, [[0, '#ffffff'], [1, '#8a8aff']]);
        ctx.fill();
      });
      VF.circle(ctx, cx, cy, w * 0.14); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
    } });

    // 암흑물질 (번식 장애물) — 어두운 가시 블롭
    VectorForge.bake(scene, 'spreader', { w: ENT, h: ENT, draw: function (ctx, w, h) {
      var cx = w / 2, cy = h / 2;
      VF.glow(ctx, 'rgba(120,40,180,0.8)', 10, function () {
        VF.blob(ctx, cx, cy, w * 0.32, 9, 0.22, 2.0);
        ctx.fillStyle = VF.radial(ctx, cx, cy, w * 0.34, [[0, '#5a2a7a'], [0.6, '#33113f'], [1, '#1a0826']]);
        ctx.fill();
      });
      ctx.strokeStyle = 'rgba(190,120,255,0.6)'; ctx.lineWidth = w * 0.02;
      for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * w * 0.28, cy + Math.sin(a) * w * 0.28); ctx.stroke(); }
    } });

    // 별조각 (재료/인그리디언트) — 금색 별 결정
    VectorForge.bake(scene, 'ingredient', { w: ENT, h: ENT, draw: function (ctx, w, h) {
      var cx = w / 2, cy = h / 2;
      VF.glow(ctx, 'rgba(255,210,80,0.95)', 14, function () {
        VF.star(ctx, cx, cy, w * 0.36, w * 0.15, 5, -Math.PI / 2);
        ctx.fillStyle = VF.radial(ctx, cx, cy, w * 0.36, [[0, '#fff6d0'], [0.5, '#ffd34a'], [1, '#e09010']]);
        ctx.fill();
      });
      VF.circle(ctx, cx - w * 0.06, cy - w * 0.06, w * 0.06); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    } });

    VectorForge.gradientBackground(scene, 'space-bg', DESIGN_W, DESIGN_H, [[0, '#171339'], [0.45, '#0f0b2a'], [1, '#06051a']]);
  }

  // 스테이지(보드 모양)별 배경 성운 테마 — 그라데이션 + 별빛 색
  var BG_THEMES = {
    square:    { stops: [[0, '#1b1545'], [0.5, '#100b2c'], [1, '#06051a']], star: 0xcabfff, name: '보라 성운' },
    cross:     { stops: [[0, '#0d2b34'], [0.5, '#08202a'], [1, '#04121a']], star: 0x9ff0ff, name: '청록 심연' },
    diamond:   { stops: [[0, '#3a2a12'], [0.5, '#241a0c'], [1, '#140d05']], star: 0xffe6a0, name: '금빛 성단' },
    hourglass: { stops: [[0, '#3a2114'], [0.5, '#2a140c'], [1, '#160a05']], star: 0xffc090, name: '노을' },
    heart:     { stops: [[0, '#3a1426'], [0.5, '#260c18'], [1, '#16060e']], star: 0xffb0d0, name: '장미 성운' },
    star:      { stops: [[0, '#2a1450'], [0.5, '#1a0e40'], [1, '#0a0620']], star: 0xe0a0ff, name: '무지개 폭발' },
    ring:      { stops: [[0, '#0d2e2a'], [0.5, '#082420'], [1, '#041614']], star: 0x9fffe0, name: '도넛 은하' }
  };
  var BG_KEYS = ['square', 'cross', 'diamond', 'hourglass', 'heart', 'star', 'ring'];
  function bgThemeFor(cfg) {
    var key = cfg.shape;
    if (cfg.daily) { var h = Math.abs(cfg.seed) % BG_KEYS.length; key = BG_KEYS[h]; } // 데일리는 날짜로 회전
    var t = BG_THEMES[key] || BG_THEMES.square;
    return { stops: t.stops, star: t.star, name: t.name, key: key + (cfg.daily ? '-d' : '') };
  }

  function drawStarfield(scene, theme) {
    var key, starCol;
    if (theme) {
      key = 'bg-' + theme.key; starCol = theme.star;
      if (!scene.textures.exists(key)) VectorForge.gradientBackground(scene, key, DESIGN_W, DESIGN_H, theme.stops);
    } else { key = 'space-bg'; starCol = 0xffffff; }
    scene.add.image(DESIGN_W / 2, DESIGN_H / 2, key).setDepth(-10);
    var rng = mulberry32(777);
    for (var i = 0; i < 70; i++) {
      var x = rng() * DESIGN_W, y = rng() * DESIGN_H, r = 0.6 + rng() * 1.8;
      var s = scene.add.circle(x, y, r, starCol, 0.4 + rng() * 0.5).setDepth(-9);
      scene.tweens.add({ targets: s, alpha: 0.15, duration: 900 + rng() * 1600, yoyo: true, repeat: -1, delay: rng() * 1500 });
    }
  }

  // ===========================================================================
  // Boot / Title
  // ===========================================================================
  var Boot = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Boot() { Phaser.Scene.call(this, { key: 'Boot' }); },
    create: function () { MobileHarness.installDomGuards(); bakeArt(this); this.scene.start('Title'); }
  });

  var Title = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Title() { Phaser.Scene.call(this, { key: 'Title' }); },
    create: function () {
      drawStarfield(this);
      var cx = DESIGN_W / 2;
      this.add.text(cx, DESIGN_H * 0.18, 'RUNEBURST', { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '62px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setShadow(0, 0, '#8a6bff', 22, true, true);
      this.add.text(cx, DESIGN_H * 0.18 + 54, '별무리 사가 · 콤보를 쌓고 정산하라', { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '21px', color: '#b9a9ff' }).setOrigin(0.5);
      for (var i = 0; i < 6; i++) {
        var s = this.add.image(cx - 6 * 30 + i * 60 + 30, DESIGN_H * 0.37, 'rune-' + i).setDisplaySize(50, 50);
        this.tweens.add({ targets: s, y: s.y - 8, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      var self = this;
      this.bigButton(cx, DESIGN_H * 0.53, 300, 70, '모험 시작', '#6ea0ff', function () { audio.unlock(); audio.startBgm(); self.scene.start('Game', { mode: 'levels', level: loadProgress() }); });
      this.bigButton(cx, DESIGN_H * 0.53 + 92, 300, 62, '오늘의 도전 (데일리)', '#c66bff', function () { audio.unlock(); audio.startBgm(); self.scene.start('Game', { mode: 'daily' }); });
      this.add.text(cx, DESIGN_H * 0.80,
        '인접 룬을 스와이프해 같은 색 3개+ 매치\n4=라인 · 5=코어 · L/T=포장 · 특수끼리 스왑=대폭발\n성운·얼음·암흑물질·별조각 목표를 제한 수 안에! 정산으로 점수 확정',
        { fontFamily: 'Segoe UI, Arial', fontSize: '16px', color: '#8c7fc4', align: 'center', lineSpacing: 6 }).setOrigin(0.5);
      this.input.once('pointerdown', function () { audio.unlock(); });
    },
    bigButton: function (x, y, w, h, label, hex, fn) {
      var col = Phaser.Display.Color.HexStringToColor(hex).color;
      var g = this.add.graphics();
      g.fillStyle(col, 0.22); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      g.lineStyle(2, col, 0.9); g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      var t = this.add.text(x, y, label, { fontFamily: 'Segoe UI, Arial', fontSize: '25px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      var zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
      var self = this;
      zone.on('pointerdown', function () { self.tweens.add({ targets: t, scale: 0.94, duration: 80, yoyo: true }); fn(); });
      this.tweens.add({ targets: g, alpha: 0.7, duration: 1100, yoyo: true, repeat: -1 });
      return zone;
    }
  });

  // ===========================================================================
  // Game
  // ===========================================================================
  var Game = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function Game() { Phaser.Scene.call(this, { key: 'Game' }); },

    init: function (data) {
      data = data || {};
      this.mode = data.mode || 'levels';
      if (this.mode === 'daily') {
        var d = new Date(); // rng-ok 데일리 챌린지는 의도적으로 실제 날짜를 시드로 사용
        this.dateKey = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        this.cfg = { name: '데일리 ' + this.dateKey, shape: 'square', colors: 6, moves: 24, goal: 5000, win: { type: 'score', target: 5000 }, overload: true, daily: true, seed: parseInt(this.dateKey.replace(/-/g, ''), 10) };
        this.levelIndex = -1;
      } else {
        this.levelIndex = Math.min(data.level || 0, LEVELS.length - 1);
        this.cfg = LEVELS[this.levelIndex];
      }
      this.rng = mulberry32(this.cfg.seed);
      this.movesLeft = this.cfg.moves;
      this.score = 0;
      this.busy = false; this.over = false;
      this.collected = 0; this.delivered = 0;
      this.board = []; this.spr = [];
      this.mask = []; this.jelly = []; this.ice = []; this.overload = [];
      this.sel = null;
      this.realMove = true; this.itemMove = false;
      this.items = this.cfg.daily ? { hammer: 3, shuffle: 2, core: 2, swap: 3 } : { hammer: 2, shuffle: 2, core: 1, swap: 2 };
      this.armedItem = null; this.swapFirst = null;
    },

    create: function () {
      this.theme = bgThemeFor(this.cfg);
      drawStarfield(this, this.theme);
      this.buildMaskAndBoard();

      this.cellBgG = this.add.graphics().setDepth(0);
      this.drawCellBackgrounds();
      this.overlayG = this.add.graphics().setDepth(2);   // 젤리/얼음/과부하

      this.renderInit();
      this.renderOverlays();
      this.buildHUD();
      this.setupInput();
      this.buildItemBar();
      this.updateHUD();
      if (!this.hasMove()) this.shuffleBoard(true);

      var self = this;
      window.RUNEBURST = {
        scene: this, game: this.game,
        swipe: function (r, c, dir) { return self.inputSwipe(r, c, dir); },
        useItem: function (k, r, c) { return self.devUseItem(k, r, c); },
        hasMove: function () { return self.hasMove(); },
        state: function () { return { mode: self.mode, level: self.levelIndex, shape: self.cfg.shape, theme: self.theme.name, moves: self.movesLeft, score: self.score, goal: self.cfg.goal, win: self.cfg.win.type, objective: self.objectiveProgress(), items: self.items, hasMove: self.hasMove(), over: self.over, busy: self.busy }; },
        board: function () { return self.board.map(function (row, r) { return row.map(function (t, c) { return self.mask[r][c] ? (t ? (t.kind === 'rune' ? t.color : (t.kind === 'spreader' ? 'S' : 'I')) : '_') : '#'; }); }); },
        overlays: function () { return { jelly: self.jelly, ice: self.ice, overload: self.overload }; }
      };
    },

    valid: function (r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS && this.mask[r][c]; },
    cellX: function (c) { return BOARD_X + c * TILE + TILE / 2; },
    cellY: function (r) { return BOARD_Y + r * TILE + TILE / 2; },

    // --- 마스크 + 보드 + 오버레이 초기화 -----------------------------------
    buildMaskAndBoard: function () {
      var shp = SHAPES[this.cfg.shape] || SHAPES.square;
      var n = this.cfg.colors, r, c;
      for (r = 0; r < ROWS; r++) {
        this.mask[r] = []; this.board[r] = []; this.spr[r] = [];
        this.jelly[r] = []; this.ice[r] = []; this.overload[r] = [];
        for (c = 0; c < COLS; c++) {
          this.mask[r][c] = (shp[r] && shp[r][c] === 'X');
          this.board[r][c] = null; this.spr[r][c] = null;
          this.jelly[r][c] = 0; this.ice[r][c] = false; this.overload[r][c] = false;
        }
      }
      // 룬 채우기 (초기 매치 없도록)
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (!this.mask[r][c]) continue;
        var col, guard = 0;
        do {
          col = Math.floor(this.rng() * n); guard++;
        } while (guard < 40 && (
          (this.valid(r, c - 1) && this.valid(r, c - 2) && this.tcol(r, c - 1) === col && this.tcol(r, c - 2) === col) ||
          (this.valid(r - 1, c) && this.valid(r - 2, c) && this.tcol(r - 1, c) === col && this.tcol(r - 2, c) === col)
        ));
        this.board[r][c] = { color: col, special: SP_NONE, kind: 'rune' };
      }
      this.seedObjectivesAndObstacles();
    },
    tcol: function (r, c) { var t = this.board[r][c]; return t ? t.color : -9; },

    validCells: function () { var a = []; for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (this.mask[r][c]) a.push([r, c]); return a; },
    randValidCell: function (pred) {
      var a = this.validCells().filter(pred || function () { return true; });
      if (!a.length) return null;
      return a[Math.floor(this.rng() * a.length)];
    },

    seedObjectivesAndObstacles: function () {
      var self = this, cells = this.validCells();
      // 젤리 (성운) — 유효 칸 전체에 layer
      if (this.cfg.win.type === 'jelly' || this.cfg.jelly) {
        var layer = this.cfg.jelly || 1;
        cells.forEach(function (p) { self.jelly[p[0]][p[1]] = layer; });
      }
      // 얼음 — 무작위 N칸
      if (this.cfg.ice) {
        var pool = cells.slice(); shuffle(pool, this.rng);
        for (var i = 0; i < this.cfg.ice && i < pool.length; i++) self.ice[pool[i][0]][pool[i][1]] = true;
      }
      // 암흑물질 — 무작위 N개 (룬을 대체)
      if (this.cfg.spreaders) {
        for (var s = 0; s < this.cfg.spreaders; s++) {
          var p = this.randValidCell(function (q) { return self.board[q[0]][q[1]] && self.board[q[0]][q[1]].kind === 'rune'; });
          if (p) self.board[p[0]][p[1]] = { color: -2, special: SP_NONE, kind: 'spreader' };
        }
      }
      // 별조각 (재료) — 상단 유효 칸에 배치
      if (this.cfg.ingredients) {
        var topCells = cells.filter(function (p) { return p[0] <= 1; });
        shuffle(topCells, this.rng);
        for (var k = 0; k < this.cfg.ingredients && k < topCells.length; k++) {
          var q = topCells[k]; self.board[q[0]][q[1]] = { color: -2, special: SP_NONE, kind: 'ingredient' };
        }
      }
      // 과부하 셀
      if (this.cfg.overload) this.placeOverload();
    },

    placeOverload: function () {
      var self = this;
      var p = this.randValidCell(function (q) { return !self.overload[q[0]][q[1]] && self.board[q[0]][q[1]] && self.board[q[0]][q[1]].kind === 'rune'; });
      if (p) this.overload[p[0]][p[1]] = true;
    },

    // --- 렌더 ----------------------------------------------------------------
    drawCellBackgrounds: function () {
      var g = this.cellBgG; g.clear();
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        if (!this.mask[r][c]) continue;
        var x = BOARD_X + c * TILE, y = BOARD_Y + r * TILE;
        g.fillStyle(0x1a1640, 0.5); g.fillRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 10);
        g.lineStyle(1, 0x8a6bff, 0.18); g.strokeRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 10);
      }
    },

    renderOverlays: function () {
      var g = this.overlayG; g.clear();
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        if (!this.mask[r][c]) continue;
        var x = BOARD_X + c * TILE, y = BOARD_Y + r * TILE;
        if (this.jelly[r][c] > 0) {
          g.fillStyle(0x7a5fff, this.jelly[r][c] >= 2 ? 0.42 : 0.24);
          g.fillRoundedRect(x + 1, y + 1, TILE - 2, TILE - 2, 12);
        }
        if (this.overload[r][c]) {
          g.lineStyle(3, 0xffd34a, 0.95); g.strokeRoundedRect(x + 4, y + 4, TILE - 8, TILE - 8, 10);
          g.lineStyle(2, 0xff8a3a, 0.6); g.strokeRoundedRect(x + 7, y + 7, TILE - 14, TILE - 14, 8);
        }
        if (this.ice[r][c]) {
          g.fillStyle(0xbfe8ff, 0.32); g.fillRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 10);
          g.lineStyle(2, 0xffffff, 0.7); g.strokeRoundedRect(x + 3, y + 3, TILE - 6, TILE - 6, 9);
          g.lineStyle(1.5, 0xffffff, 0.55);
          g.lineBetween(x + 10, y + 10, x + TILE - 10, y + TILE - 10);
          g.lineBetween(x + TILE - 10, y + 10, x + 10, y + TILE - 10);
        }
      }
    },

    makeTile: function (r, c) {
      var t = this.board[r][c];
      if (!t) return null;
      var cont = this.add.container(this.cellX(c), this.cellY(r)).setDepth(4);
      var key;
      if (t.kind === 'spreader') key = 'spreader';
      else if (t.kind === 'ingredient') key = 'ingredient';
      else key = (t.special === SP_CORE) ? 'core' : 'rune-' + t.color;
      var img = this.add.image(0, 0, key).setDisplaySize(TILE * 0.92, TILE * 0.92);
      cont.add(img);
      if (t.special === SP_LINE_H || t.special === SP_LINE_V) {
        var bar = this.add.graphics(); bar.fillStyle(0xffffff, 0.92);
        if (t.special === SP_LINE_H) bar.fillRoundedRect(-TILE * 0.40, -3, TILE * 0.80, 6, 3);
        else bar.fillRoundedRect(-3, -TILE * 0.40, 6, TILE * 0.80, 3);
        cont.add(bar);
      } else if (t.special === SP_WRAP) {
        var box = this.add.graphics(); box.lineStyle(4, 0xffffff, 0.92); box.strokeRoundedRect(-TILE * 0.30, -TILE * 0.30, TILE * 0.60, TILE * 0.60, 6); cont.add(box);
      }
      if (t.special === SP_CORE) this.tweens.add({ targets: cont, angle: 360, duration: 4000, repeat: -1 });
      return cont;
    },

    renderInit: function () { for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) this.spr[r][c] = this.makeTile(r, c); },
    refreshTile: function (r, c) { if (this.spr[r][c]) { this.spr[r][c].destroy(); this.spr[r][c] = null; } this.spr[r][c] = this.makeTile(r, c); },

    // ===========================================================================
    // 입력
    // ===========================================================================
    setupInput: function () {
      var self = this;
      this.input.on('pointerdown', function (p) { if (self.busy || self.over) return; self._down = self.cellAt(p.x, p.y); self._dx = p.x; self._dy = p.y; });
      this.input.on('pointerup', function (p) {
        if (self.busy || self.over) { self._down = null; return; }
        if (self.armedItem) { self._down = null; var cc = self.cellAt(p.x, p.y); if (cc) self.applyArmed(cc.r, cc.c); return; }
        if (!self._down) { return; }
        var from = self._down; self._down = null;
        var dx = p.x - self._dx, dy = p.y - self._dy, TH = 16;
        if (Math.abs(dx) > TH || Math.abs(dy) > TH) { var dir = (Math.abs(dx) > Math.abs(dy)) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); self.clearSel(); self.inputSwipe(from.r, from.c, dir); }
        else self.tapCell(from.r, from.c);
      });
      var kb = this.input.keyboard;
      function arrow(dir) { if (self.sel) self.inputSwipe(self.sel.r, self.sel.c, dir); }
      kb.on('keydown-LEFT', function () { arrow('left'); }); kb.on('keydown-RIGHT', function () { arrow('right'); });
      kb.on('keydown-UP', function () { arrow('up'); }); kb.on('keydown-DOWN', function () { arrow('down'); });
    },
    cellAt: function (x, y) { var c = Math.floor((x - BOARD_X) / TILE), r = Math.floor((y - BOARD_Y) / TILE); return this.valid(r, c) ? { r: r, c: c } : null; },
    swappable: function (r, c) { var t = this.board[r][c]; return this.valid(r, c) && t && t.kind === 'rune' && !this.ice[r][c]; },

    tapCell: function (r, c) {
      if (!this.swappable(r, c)) { this.clearSel(); return; }
      if (this.sel && this.sel.r === r && this.sel.c === c) { this.clearSel(); return; }
      if (this.sel && Math.abs(this.sel.r - r) + Math.abs(this.sel.c - c) === 1) { var a = this.sel; this.clearSel(); this.trySwap(a.r, a.c, r, c); }
      else { this.clearSel(); this.sel = { r: r, c: c }; if (this.spr[r][c]) this.selTween = this.tweens.add({ targets: this.spr[r][c], scale: 1.12, duration: 300, yoyo: true, repeat: -1 }); }
    },
    clearSel: function () { if (this.selTween) { this.selTween.stop(); this.selTween = null; } if (this.sel && this.spr[this.sel.r] && this.spr[this.sel.r][this.sel.c]) this.spr[this.sel.r][this.sel.c].setScale(1); this.sel = null; },

    inputSwipe: function (r, c, dir) {
      var D = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir]; if (!D) return false;
      return this.trySwap(r, c, r + D[0], c + D[1]);
    },

    trySwap: function (r1, c1, r2, c2) {
      if (this.busy || this.over) return false;
      if (!this.swappable(r1, c1) || !this.valid(r2, c2)) return false;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
      var t2 = this.board[r2][c2];
      if (!t2 || t2.kind !== 'rune' || this.ice[r2][c2]) return false; // 대상도 스왑 가능해야
      this.busy = true;
      var self = this;
      this.swapCells(r1, c1, r2, c2);
      this.lastSwap = { r: r2, c: c2 };
      this.animSwap(r1, c1, r2, c2, function () {
        var a = self.board[r1][c1], b = self.board[r2][c2];
        var aSp = a && a.special, bSp = b && b.special;
        // 특수 + 특수 조합
        if (aSp && bSp) { self.consumeMove(); self.beginMove(); self.comboActivate(r1, c1, r2, c2); return; }
        // 코어 + 일반
        if (aSp === SP_CORE || bSp === SP_CORE) { self.consumeMove(); self.beginMove(); self.coreSwap(r1, c1, r2, c2); return; }
        var info = self.findMatches();
        if (info.matched.size === 0) {
          self.swapCells(r1, c1, r2, c2);
          self.animSwap(r1, c1, r2, c2, function () { self.busy = false; });
          audio.tone({ freq: 170, to: 110, dur: 0.09, vol: 0.18, type: 'sine' });
          self.cameras.main.shake(80, 0.003);
        } else { self.consumeMove(); self.beginMove(); self.resolveStep(); }
      });
      return true;
    },

    beginMove: function (isItem) { this.realMove = !isItem; this.itemMove = !!isItem; this.cascadeDepth = 0; this.clearedThisMove = 0; this.scoreBeforeMove = this.score; this.overloadHit = false; this.spreaderHit = false; },
    swapCells: function (r1, c1, r2, c2) { var tb = this.board[r1][c1]; this.board[r1][c1] = this.board[r2][c2]; this.board[r2][c2] = tb; var ts = this.spr[r1][c1]; this.spr[r1][c1] = this.spr[r2][c2]; this.spr[r2][c2] = ts; },
    animSwap: function (r1, c1, r2, c2, done) {
      var a = this.spr[r1][c1], b = this.spr[r2][c2], n = 0; function fin() { if (++n >= 2 && done) done(); }
      if (a) this.tweens.add({ targets: a, x: this.cellX(c1), y: this.cellY(r1), duration: 130, ease: 'Quad.out', onComplete: fin }); else fin();
      if (b) this.tweens.add({ targets: b, x: this.cellX(c2), y: this.cellY(r2), duration: 130, ease: 'Quad.out', onComplete: fin }); else fin();
    },
    consumeMove: function () { this.movesLeft--; this.updateHUD(); },

    // ===========================================================================
    // 매치 / 특수 생성 / 캐스케이드
    // ===========================================================================
    matchable: function (r, c) { var t = this.board[r][c]; return t && t.kind === 'rune' && t.special !== SP_CORE && t.color >= 0; },

    findMatches: function () {
      var matched = new Set(), hRuns = [], vRuns = [], r, c, k;
      for (r = 0; r < ROWS; r++) { c = 0; while (c < COLS) {
        if (!this.matchable(r, c)) { c++; continue; }
        var col = this.board[r][c].color; k = c + 1;
        while (k < COLS && this.matchable(r, k) && this.board[r][k].color === col) k++;
        if (k - c >= 3) { var cs = []; for (var i = c; i < k; i++) { matched.add(r + ',' + i); cs.push([r, i]); } hRuns.push(cs); }
        c = k;
      } }
      for (c = 0; c < COLS; c++) { r = 0; while (r < ROWS) {
        if (!this.matchable(r, c)) { r++; continue; }
        var col2 = this.board[r][c].color; k = r + 1;
        while (k < ROWS && this.matchable(k, c) && this.board[k][c].color === col2) k++;
        if (k - r >= 3) { var cv = []; for (var j = r; j < k; j++) { matched.add(j + ',' + c); cv.push([j, c]); } vRuns.push(cv); }
        r = k;
      } }
      return { matched: matched, hRuns: hRuns, vRuns: vRuns };
    },

    computeCreates: function (info) {
      var self = this, byCell = {}; // key -> {r,c,special,color,prio}  prio: core3>wrap2>line1
      function offer(cell, special, prio) {
        var k = cell[0] + ',' + cell[1]; var color = self.board[cell[0]][cell[1]] ? self.board[cell[0]][cell[1]].color : 0;
        if (byCell[k] && byCell[k].prio >= prio) return;
        byCell[k] = { r: cell[0], c: cell[1], special: special, color: color, prio: prio };
      }
      // 코어: 길이 5+ 런
      info.hRuns.concat(info.vRuns).forEach(function (run) { if (run.length >= 5) offer(self.pick(run), SP_CORE, 3); });
      // 포장(WRAP): H런과 V런 교차 셀 (L/T자)
      var hSet = {}; info.hRuns.forEach(function (run) { run.forEach(function (p) { hSet[p[0] + ',' + p[1]] = true; }); });
      info.vRuns.forEach(function (run) { run.forEach(function (p) { if (hSet[p[0] + ',' + p[1]]) offer([p[0], p[1]], SP_WRAP, 2); }); });
      // 라인: 길이 4 런
      info.hRuns.forEach(function (run) { if (run.length === 4) offer(self.pick(run), SP_LINE_H, 1); });
      info.vRuns.forEach(function (run) { if (run.length === 4) offer(self.pick(run), SP_LINE_V, 1); });
      return Object.keys(byCell).map(function (k) { return byCell[k]; });
    },
    pick: function (cells) {
      if (this.lastSwap) for (var i = 0; i < cells.length; i++) if (cells[i][0] === this.lastSwap.r && cells[i][1] === this.lastSwap.c) return cells[i];
      return cells[Math.floor(cells.length / 2)];
    },

    resolveStep: function () {
      var self = this;
      var info = this.findMatches();
      if (info.matched.size === 0) { this.afterMove(); return; }
      this.cascadeDepth++;
      var depth = this.cascadeDepth;

      var creates = this.computeCreates(info);
      var clear = new Set(info.matched);
      creates.forEach(function (cr) { clear.delete(cr.r + ',' + cr.c); });
      this.expandSpecials(clear);

      var pts = clear.size * 10 * depth;
      this.score += pts; this.clearedThisMove += clear.size; this.updateHUD();
      this.applyCellEffects(clear);

      this.comboTone(depth);
      if (clear.size >= 7 || depth >= 3) this.cameras.main.shake(140, Math.min(0.012, 0.004 + depth * 0.002));

      var spark = 6;
      clear.forEach(function (key) {
        var p = key.split(','), r = +p[0], c = +p[1], sp = self.spr[r][c];
        if (sp) { self.tweens.add({ targets: sp, scale: 0, alpha: 0, angle: 90, duration: 130, ease: 'Back.in', onComplete: function () { sp.destroy(); } }); self.spr[r][c] = null; }
        if (spark-- > 0 && self.board[r][c] && self.board[r][c].color >= 0) self.sparkle(self.cellX(c), self.cellY(r), self.board[r][c].color);
        self.board[r][c] = null;
      });

      creates.forEach(function (cr) {
        self.board[cr.r][cr.c] = { color: cr.color, special: cr.special, kind: 'rune' };
        self.refreshTile(cr.r, cr.c);
        var sp = self.spr[cr.r][cr.c]; if (sp) { sp.setScale(0.2); self.tweens.add({ targets: sp, scale: 1, duration: 200, ease: 'Back.out' }); }
        audio.sfx('powerup');
      });

      this.renderOverlays();
      this.time.delayedCall(150, function () {
        var maxFall = self.applyGravityAndRefill();
        self.time.delayedCall(120 + maxFall * 26, function () { self.resolveStep(); });
      });
    },

    // 소거 셀의 젤리/얼음/과부하/수집/번식인접 효과
    applyCellEffects: function (clear) {
      var self = this;
      clear.forEach(function (key) {
        var p = key.split(','), r = +p[0], c = +p[1];
        var t = self.board[r][c];
        if (t && t.kind === 'rune' && t.color >= 0) {
          if (self.cfg.win.type === 'collect' && t.color === self.cfg.win.color) self.collected++;
        }
        if (self.jelly[r][c] > 0) self.jelly[r][c]--;
        if (self.ice[r][c]) self.ice[r][c] = false;
        if (self.overload[r][c]) { self.overload[r][c] = false; self.overloadHit = true; }
        // 인접 암흑물질 표시 (이번 수에 1개라도 인접 소거 → 번식 차단)
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(function (q) {
          if (self.valid(q[0], q[1]) && self.board[q[0]][q[1]] && self.board[q[0]][q[1]].kind === 'spreader') self.spreaderHit = true;
        });
      });
    },

    expandSpecials: function (clear) {
      var queue = []; clear.forEach(function (k) { queue.push(k); });
      while (queue.length) {
        var key = queue.pop(), p = key.split(','), r = +p[0], c = +p[1], t = this.board[r][c];
        if (!t) continue;
        if (t.special === SP_LINE_H) this.addLine(clear, queue, r, -1);
        else if (t.special === SP_LINE_V) this.addLine(clear, queue, -1, c);
        else if (t.special === SP_WRAP) this.addBox(clear, queue, r, c, 1);
      }
    },
    addLine: function (clear, queue, row, col) {
      if (row >= 0) { for (var c = 0; c < COLS; c++) this.maybeAdd(clear, queue, row, c); }
      if (col >= 0) { for (var r = 0; r < ROWS; r++) this.maybeAdd(clear, queue, r, col); }
    },
    addBox: function (clear, queue, r, c, rad) { for (var dr = -rad; dr <= rad; dr++) for (var dc = -rad; dc <= rad; dc++) this.maybeAdd(clear, queue, r + dr, c + dc); },
    maybeAdd: function (clear, queue, r, c) {
      if (!this.valid(r, c) || !this.board[r][c]) return;
      var k = r + ',' + c; if (clear.has(k)) return;
      if (this.board[r][c].kind === 'ingredient') return; // 재료는 폭발로 안 사라짐(내려야 함)
      clear.add(k); queue.push(k);
    },

    // 코어 + 일반 스왑
    coreSwap: function (r1, c1, r2, c2) {
      var a = this.board[r1][c1], b = this.board[r2][c2], clear = new Set(), tc = -1;
      var other = (a && a.special === SP_CORE) ? { r: r2, c: c2 } : { r: r1, c: c1 };
      var core = (other.r === r2 && other.c === c2) ? { r: r1, c: c1 } : { r: r2, c: c2 };
      var ot = this.board[other.r][other.c];
      tc = (ot && ot.kind === 'rune') ? ot.color : -1;
      clear.add(core.r + ',' + core.c);
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var t = this.board[r][c]; if (t && t.kind === 'rune' && (t.color === tc || t.special === SP_CORE)) clear.add(r + ',' + c); }
      this.detonate(clear, 2, 14);
    },
    // 특수 + 특수 조합
    comboActivate: function (r1, c1, r2, c2) {
      var a = this.board[r1][c1], b = this.board[r2][c2], clear = new Set(), r, c;
      var both = [a.special, b.special];
      if (both.indexOf(SP_CORE) >= 0 && both[0] === both[1]) { // 코어+코어 = 전체
        for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) if (this.valid(r, c) && this.board[r][c]) clear.add(r + ',' + c);
      } else if (both.indexOf(SP_CORE) >= 0) { // 코어 + 라인/포장 = 코어쪽 색 전체를 라인화 효과(=그 색 전체 + 짝의 행/열/박스)
        var coreCell = a.special === SP_CORE ? { r: r1, c: c1 } : { r: r2, c: c2 };
        var partner = a.special === SP_CORE ? { r: r2, c: c2 } : { r: r1, c: c1 };
        var pt = this.board[partner.r][partner.c], pc = pt.color;
        clear.add(coreCell.r + ',' + coreCell.c);
        for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) if (this.matchable(r, c) && this.board[r][c].color === pc) clear.add(r + ',' + c);
        this.expandSpecials(clear); // 그 색 라인들이 연쇄
      } else { // 라인/포장 끼리
        // 두 좌표의 행/열 모두 + 박스 결합
        var cells = [{ r: r1, c: c1, s: a.special }, { r: r2, c: c2, s: b.special }];
        cells.forEach(function (cc) { clear.add(cc.r + ',' + cc.c); });
        var queue = []; clear.forEach(function (k) { queue.push(k); });
        // 강화: 라인이면 3줄, 포장이면 5x5
        var self = this;
        cells.forEach(function (cc) {
          if (cc.s === SP_WRAP) self.addBox(clear, queue, cc.r, cc.c, 2);
          else { self.addLine(clear, queue, cc.r, -1); self.addLine(clear, queue, -1, cc.c);
                 self.addLine(clear, queue, cc.r - 1, -1); self.addLine(clear, queue, cc.r + 1, -1);
                 self.addLine(clear, queue, -1, cc.c - 1); self.addLine(clear, queue, -1, cc.c + 1); }
        });
        this.expandSpecials(clear);
      }
      this.detonate(clear, 2, 12);
    },

    // 직접 소거 집합 처리(특수 발동) → 캐스케이드로 합류
    detonate: function (clear, depth, perTile) {
      var self = this;
      this.cascadeDepth = Math.max(this.cascadeDepth, depth);
      this.clearedThisMove += clear.size;
      this.score += clear.size * perTile; this.updateHUD();
      this.applyCellEffects(clear);
      this.comboTone(depth + 1);
      this.cameras.main.shake(220, 0.012);
      var spark = 8;
      clear.forEach(function (key) {
        var p = key.split(','), r = +p[0], c = +p[1], sp = self.spr[r][c];
        if (sp) { self.tweens.add({ targets: sp, scale: 0, alpha: 0, duration: 160, ease: 'Back.in', onComplete: function () { sp.destroy(); } }); self.spr[r][c] = null; }
        if (spark-- > 0 && self.board[r][c] && self.board[r][c].color >= 0) self.sparkle(self.cellX(c), self.cellY(r), self.board[r][c].color);
        self.board[r][c] = null;
      });
      this.renderOverlays();
      this.time.delayedCall(180, function () { var mf = self.applyGravityAndRefill(); self.time.delayedCall(140 + mf * 26, function () { self.resolveStep(); }); });
    },

    // 중력 + 리필 (마스크 유효 칸만, 재료 바닥 배달 포함)
    applyGravityAndRefill: function () {
      var n = this.cfg.colors, maxFall = 0, self = this;
      for (var c = 0; c < COLS; c++) {
        var validRows = []; for (var r = 0; r < ROWS; r++) if (this.mask[r][c]) validRows.push(r);
        if (!validRows.length) continue;
        // 컴팩트할 타일 모으기 (유효 칸 순서대로)
        var stack = [];
        for (var i = 0; i < validRows.length; i++) { var rr = validRows[i]; if (this.board[rr][c]) { stack.push({ tile: this.board[rr][c], spr: this.spr[rr][c] }); this.board[rr][c] = null; this.spr[rr][c] = null; } }
        // 바닥 도달 재료 배달 (스택 맨 끝이 재료면 제거)
        while (stack.length && stack[stack.length - 1].tile.kind === 'ingredient') {
          var del = stack.pop(); this.delivered++;
          (function (sp) { if (sp) self.tweens.add({ targets: sp, y: sp.y + TILE * 2, alpha: 0, duration: 280, onComplete: function () { sp.destroy(); } }); })(del.spr);
          audio.sfx('1up');
        }
        // 바닥부터 다시 배치
        var bottomIdx = validRows.length - 1;
        for (var s = stack.length - 1; s >= 0; s--) {
          var targetRow = validRows[bottomIdx]; bottomIdx--;
          var it = stack[s]; this.board[targetRow][c] = it.tile; this.spr[targetRow][c] = it.spr;
          if (it.spr) {
            var ny = this.cellY(targetRow);
            if (Math.abs(it.spr.y - ny) > 1) this.tweens.add({ targets: it.spr, y: ny, duration: 90 + Math.min(6, Math.abs(it.spr.y - ny) / TILE) * 26, ease: 'Quad.in' });
            it.spr.x = this.cellX(c);
          }
        }
        // 남은 상단 유효 칸 리필
        var emptyTop = bottomIdx + 1; // validRows[0..bottomIdx] 가 비어있음
        for (var e = bottomIdx; e >= 0; e--) {
          var rw = validRows[e];
          this.board[rw][c] = { color: Math.floor(this.rng() * n), special: SP_NONE, kind: 'rune' };
          var cont = this.makeTile(rw, c); this.spr[rw][c] = cont;
          if (cont) { cont.y = this.cellY(validRows[0]) - (emptyTop - e + 1) * TILE; this.tweens.add({ targets: cont, y: this.cellY(rw), duration: 130 + (emptyTop - e) * 30, ease: 'Quad.in' }); }
          if (emptyTop > maxFall) maxFall = emptyTop;
        }
      }
      return maxFall;
    },

    afterMove: function () {
      // 과부하 보너스: 이번 수에 얻은 점수만큼 추가(×2 효과) 후 재배치
      if (this.overloadHit) {
        var bonus = this.score - this.scoreBeforeMove;
        this.score += bonus;
        this.flashCenter('과부하 ×2!  +' + bonus, '#ffd34a'); audio.sfx('powerup'); this.placeOverload();
      }
      // 캐스케이드 콤보 연출
      if (this.cascadeDepth >= 2) this.flashCenter('콤보 ×' + this.cascadeDepth + '!', '#ffd34a');

      // 암흑물질 번식 (실제 수에서만, 이번 수에 인접 소거 없었으면 퍼짐)
      if (this.realMove) this.handleSpreaders();

      this.renderOverlays();
      this.updateHUD();
      this.checkEnd();
      if (!this.over) {
        this.busy = false;
        // 교착(가능한 수 없음) → 자동 셔플
        if (!this.hasMove()) this.shuffleBoard(false);
      }
    },

    handleSpreaders: function () {
      var self = this, list = [];
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (this.board[r][c] && this.board[r][c].kind === 'spreader') list.push([r, c]);
      if (!list.length) return;
      if (this.spreaderHit) {
        // 인접 소거됨 → 1개 정화
        var victim = list[0];
        this.board[victim[0]][victim[1]] = { color: Math.floor(this.rng() * this.cfg.colors), special: SP_NONE, kind: 'rune' };
        this.refreshTile(victim[0], victim[1]);
        this.flashCenter('암흑물질 정화', '#5ff0a0');
        return;
      }
      if (list.length >= MAX_SPREAD) return;
      // 번식: 한 암흑물질의 인접 룬 1칸을 감염
      shuffle(list, this.rng);
      for (var i = 0; i < list.length; i++) {
        var p = list[i], dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]; shuffle(dirs, this.rng);
        for (var d = 0; d < dirs.length; d++) {
          var nr = p[0] + dirs[d][0], nc = p[1] + dirs[d][1];
          if (this.valid(nr, nc) && this.board[nr][nc] && this.board[nr][nc].kind === 'rune' && this.board[nr][nc].special === SP_NONE && !this.ice[nr][nc]) {
            this.board[nr][nc] = { color: -2, special: SP_NONE, kind: 'spreader' }; this.refreshTile(nr, nc);
            return;
          }
        }
      }
    },

    // ===========================================================================
    // 교착 감지 + 자동 셔플
    // ===========================================================================
    hasMove: function () {
      var r, c;
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) { var t = this.board[r][c]; if (t && t.special === SP_CORE) return true; } // 코어는 언제나 발동 가능
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (!this.swappable(r, c)) continue;
        var nb = [[0, 1], [1, 0]];
        for (var d = 0; d < 2; d++) {
          var nr = r + nb[d][0], nc = c + nb[d][1];
          if (!this.valid(nr, nc)) continue;
          var u = this.board[nr][nc]; if (!u || u.kind !== 'rune' || this.ice[nr][nc]) continue;
          var tmp = this.board[r][c]; this.board[r][c] = this.board[nr][nc]; this.board[nr][nc] = tmp;
          var ok = this.findMatches().matched.size > 0;
          tmp = this.board[r][c]; this.board[r][c] = this.board[nr][nc]; this.board[nr][nc] = tmp;
          if (ok) return true;
        }
      }
      return false;
    },

    shuffleBoard: function (silent) {
      var self = this, cells = [], tiles = [];
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var t = this.board[r][c];
        if (this.mask[r][c] && t && t.kind === 'rune') { cells.push([r, c]); tiles.push(t); }
      }
      if (tiles.length < 3) return;
      var attempt = 0;
      do {
        shuffle(tiles, this.rng);
        for (var i = 0; i < cells.length; i++) this.board[cells[i][0]][cells[i][1]] = tiles[i];
        attempt++;
      } while (attempt < 40 && (this.findMatches().matched.size > 0 || !this.hasMove()));
      if (this.findMatches().matched.size > 0 || !this.hasMove()) this.regenRunes();
      cells.forEach(function (p) { self.refreshTile(p[0], p[1]); var sp = self.spr[p[0]][p[1]]; if (sp) { sp.setScale(0.4); self.tweens.add({ targets: sp, scale: 1, duration: 260, ease: 'Back.out' }); } });
      if (!silent) { this.flashCenter('셔플!', '#8ae8ff'); audio.sfx('powerup'); }
    },

    regenRunes: function () {
      var n = this.cfg.colors;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var t = this.board[r][c]; if (!this.mask[r][c] || !t || t.kind !== 'rune') continue;
        var col, guard = 0;
        do { col = Math.floor(this.rng() * n); guard++; } while (guard < 40 && (
          (this.valid(r, c - 1) && this.matchable(r, c - 1) && this.valid(r, c - 2) && this.matchable(r, c - 2) && this.board[r][c - 1].color === col && this.board[r][c - 2].color === col) ||
          (this.valid(r - 1, c) && this.matchable(r - 1, c) && this.valid(r - 2, c) && this.matchable(r - 2, c) && this.board[r - 1][c].color === col && this.board[r - 2][c].color === col)
        ));
        t.color = col; t.special = SP_NONE;
      }
    },

    // ===========================================================================
    // 아이템 (망치 · 셔플 · 컬러 코어 소환 · 자유 스왑)
    // ===========================================================================
    spendItem: function (k) { this.items[k] = Math.max(0, (this.items[k] || 0) - 1); this.updateItemBar(); },
    disarm: function () { this.armedItem = null; this.cancelSwapFirst(); if (this.hintText) this.hintText.setText('인접 룬을 스와이프 · 같은 색 3개로 매치').setColor('#7c70b8'); this.updateItemBar(); },

    handleItem: function (k) {
      if (this.busy || this.over) return;
      if (!this.items[k]) { this.flashCenter('아이템 없음', '#ff8a9a'); return; }
      if (k === 'shuffle') { this.disarm(); this.spendItem('shuffle'); this.shuffleBoard(false); return; }
      if (this.armedItem === k) { this.disarm(); return; }
      this.clearSel(); this.disarm(); this.armedItem = k; this.updateItemBar();
      var msg = k === 'hammer' ? '🔨 부술 룬을 탭 (다시 누르면 취소)' : (k === 'core' ? '💠 코어로 만들 룬을 탭' : '⇄ 교환할 인접 룬 두 개를 탭');
      this.hintText.setText(msg).setColor('#ffd34a');
    },

    applyArmed: function (r, c) {
      var k = this.armedItem;
      if (k === 'hammer') this.applyHammer(r, c);
      else if (k === 'core') this.applyCore(r, c);
      else if (k === 'swap') this.applyFreeSwapTarget(r, c);
    },

    applyHammer: function (r, c) {
      if (!this.valid(r, c) || !this.board[r][c]) return;
      this.spendItem('hammer'); this.disarm(); this.busy = true; this.beginMove(true);
      var clear = new Set(); clear.add(r + ',' + c); this.expandSpecials(clear); this.applyCellEffects(clear);
      this.clearedThisMove += clear.size;
      var self = this, spark = 6; this.cameras.main.shake(120, 0.006); audio.sfx('brick');
      clear.forEach(function (key) {
        var p = key.split(','), rr = +p[0], cc = +p[1], sp = self.spr[rr][cc];
        if (sp) { self.tweens.add({ targets: sp, scale: 0, alpha: 0, angle: 120, duration: 150, ease: 'Back.in', onComplete: function () { sp.destroy(); } }); self.spr[rr][cc] = null; }
        if (spark-- > 0 && self.board[rr][cc] && self.board[rr][cc].color >= 0) self.sparkle(self.cellX(cc), self.cellY(rr), self.board[rr][cc].color);
        self.board[rr][cc] = null;
      });
      this.renderOverlays();
      this.time.delayedCall(170, function () { var mf = self.applyGravityAndRefill(); self.time.delayedCall(140 + mf * 26, function () { self.resolveStep(); }); });
    },

    applyCore: function (r, c) {
      if (!this.swappable(r, c)) { this.flashCenter('자유로운 룬에만', '#ff8a9a'); return; }
      var t = this.board[r][c]; if (!t || t.kind !== 'rune') return;
      this.spendItem('core'); this.disarm();
      t.special = SP_CORE; this.refreshTile(r, c);
      var sp = this.spr[r][c]; if (sp) { sp.setScale(0.3); this.tweens.add({ targets: sp, scale: 1, duration: 260, ease: 'Back.out' }); }
      audio.sfx('powerup'); this.flashCenter('컬러 코어!', '#ffffff');
    },

    applyFreeSwapTarget: function (r, c) {
      if (!this.swappable(r, c)) { this.flashCenter('자유로운 룬에만', '#ff8a9a'); return; }
      if (!this.swapFirst) { this.swapFirst = { r: r, c: c }; var sp = this.spr[r][c]; if (sp) this.swapTween = this.tweens.add({ targets: sp, scale: 1.15, duration: 280, yoyo: true, repeat: -1 }); this.flashCenter('교환할 인접 룬 탭', '#8ae8ff'); return; }
      var a = this.swapFirst;
      if (a.r === r && a.c === c) { this.cancelSwapFirst(); return; }
      if (Math.abs(a.r - r) + Math.abs(a.c - c) !== 1) { this.cancelSwapFirst(); this.swapFirst = { r: r, c: c }; var sp2 = this.spr[r][c]; if (sp2) this.swapTween = this.tweens.add({ targets: sp2, scale: 1.15, duration: 280, yoyo: true, repeat: -1 }); return; }
      this.cancelSwapFirst(); this.spendItem('swap'); this.disarm();
      this.busy = true; var self = this;
      this.swapCells(a.r, a.c, r, c); this.lastSwap = { r: r, c: c };
      this.animSwap(a.r, a.c, r, c, function () {
        var info = self.findMatches();
        if (info.matched.size > 0) { self.beginMove(true); self.resolveStep(); }
        else { self.busy = false; if (!self.hasMove()) self.shuffleBoard(false); }
      });
    },
    cancelSwapFirst: function () { if (this.swapTween) { this.swapTween.stop(); this.swapTween = null; } if (this.swapFirst && this.spr[this.swapFirst.r] && this.spr[this.swapFirst.r][this.swapFirst.c]) this.spr[this.swapFirst.r][this.swapFirst.c].setScale(1); this.swapFirst = null; },

    devUseItem: function (k, r, c) { if (k === 'shuffle') { this.handleItem('shuffle'); return 'shuffled'; } this.armedItem = k; this.applyArmed(r, c); return 'used ' + k; },

    buildItemBar: function () {
      var meta = [{ k: 'hammer', icon: '🔨', name: '망치' }, { k: 'shuffle', icon: '🔀', name: '셔플' }, { k: 'core', icon: '💠', name: '코어' }, { k: 'swap', icon: '⇄', name: '스왑' }];
      var y = BOARD_Y + TILE * ROWS + 46, bw = 122, gap = 8;
      var total = meta.length * bw + (meta.length - 1) * gap, x0 = (DESIGN_W - total) / 2;
      this.itemBtns = {}; var self = this;
      meta.forEach(function (m, i) {
        var x = x0 + i * (bw + gap) + bw / 2;
        var cont = self.add.container(x, y);
        var g = self.add.graphics(); cont.add(g); cont.bg = g;
        cont.add(self.add.text(-bw / 2 + 22, 0, m.icon, { fontFamily: 'Segoe UI Emoji, Segoe UI, Arial', fontSize: '24px' }).setOrigin(0.5));
        cont.add(self.add.text(-bw / 2 + 42, -7, m.name, { fontFamily: 'Segoe UI, Arial', fontSize: '15px', color: '#ffffff' }).setOrigin(0, 0.5));
        var cnt = self.add.text(bw / 2 - 12, 0, '', { fontFamily: 'Segoe UI, Arial', fontSize: '16px', color: '#ffd34a', fontStyle: 'bold' }).setOrigin(1, 0.5); cont.add(cnt); cont.cnt = cnt;
        var zone = self.add.zone(x, y, bw, 44).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', function () { self.handleItem(m.k); });
        self.itemBtns[m.k] = cont;
      });
      this.updateItemBar();
    },
    updateItemBar: function () {
      if (!this.itemBtns) return; var self = this;
      Object.keys(this.itemBtns).forEach(function (k) {
        var cont = self.itemBtns[k], n = self.items[k] || 0, armed = self.armedItem === k, g = cont.bg; g.clear();
        var col = armed ? 0xffd34a : (n > 0 ? 0x6ea0ff : 0x555a70);
        g.fillStyle(armed ? 0xffd34a : 0x1a1640, armed ? 0.28 : 0.5); g.fillRoundedRect(-61, -22, 122, 44, 10);
        g.lineStyle(2, col, n > 0 ? 0.9 : 0.4); g.strokeRoundedRect(-61, -22, 122, 44, 10);
        cont.cnt.setText('×' + n).setAlpha(n > 0 ? 1 : 0.4);
        cont.setAlpha(n > 0 || armed ? 1 : 0.55);
      });
    },

    // --- 목표 / 종료 ---------------------------------------------------------
    jellyTotal: function () { var s = 0; for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) s += this.jelly[r][c]; return s; },
    objectiveProgress: function () {
      var w = this.cfg.win;
      if (w.type === 'jelly') return { left: this.jellyTotal() };
      if (w.type === 'collect') return { got: this.collected, need: w.count };
      if (w.type === 'ingredient') return { got: this.delivered, need: w.count };
      return { score: this.score, target: w.target };
    },
    isWin: function () {
      var w = this.cfg.win;
      if (w.type === 'jelly') return this.jellyTotal() === 0;
      if (w.type === 'collect') return this.collected >= w.count;
      if (w.type === 'ingredient') return this.delivered >= w.count;
      return this.score >= w.target;
    },

    checkEnd: function () {
      // 목표형은 달성 즉시 승리 (이동 아끼기)
      if (this.cfg.win.type !== 'score' && this.isWin()) { this.endGame(true); return; }
      if (this.movesLeft > 0) return;
      this.endGame(this.isWin());
    },
    endGame: function (win) {
      if (this.over) return;
      this.over = true; this.busy = true;
      this._win = win;
      this.time.delayedCall(420, this.showResult, [], this);
    },

    // ===========================================================================
    // 사운드 / 연출
    // ===========================================================================
    comboTone: function (depth) {
      var freq = 523.25 * Math.pow(2, Math.min(18, depth - 1) / 12);
      audio.tone({ freq: freq, dur: 0.10, vol: 0.22, type: 'square' });
      audio.tone({ freq: freq * 1.5, dur: 0.08, vol: 0.10, type: 'triangle', delay: 0.02 });
    },
    sparkle: function (x, y, colorIdx) {
      var hex = Phaser.Display.Color.HexStringToColor(RUNES[colorIdx] ? RUNES[colorIdx].g[0] : '#ffffff').color;
      for (var i = 0; i < 4; i++) {
        var a = (i / 4) * Math.PI * 2 + this.rng() * 0.8, d = 14 + this.rng() * 14;
        var dot = this.add.circle(x, y, 2 + this.rng() * 2, hex, 0.95).setDepth(20);
        this.tweens.add({ targets: dot, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: 300 + this.rng() * 160, ease: 'Quad.out', onComplete: function () { dot.destroy(); } });
      }
    },
    flashCenter: function (text, hex) {
      var t = this.add.text(DESIGN_W / 2, BOARD_Y + TILE * ROWS / 2, text, { fontFamily: 'Segoe UI, Arial', fontSize: '38px', color: hex, fontStyle: 'bold' }).setOrigin(0.5).setDepth(30).setShadow(0, 0, '#000000', 8, true, true);
      this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, scale: 1.3, duration: 800, ease: 'Quad.out', onComplete: function () { t.destroy(); } });
    },
    pulse: function (obj) { if (obj) this.tweens.add({ targets: obj, scale: 1.06, duration: 110, yoyo: true }); },

    // ===========================================================================
    // HUD
    // ===========================================================================
    buildHUD: function () {
      this.add.text(20, 16, (this.mode === 'daily' ? '데일리' : (this.levelIndex + 1) + ' / ' + LEVELS.length), { fontFamily: 'Segoe UI, Arial', fontSize: '18px', color: '#b9a9ff', fontStyle: 'bold' });
      this.add.text(DESIGN_W / 2, 22, this.cfg.name, { fontFamily: 'Segoe UI, Arial', fontSize: '23px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      var mute = this.add.text(DESIGN_W - 18, 14, '♪', { fontFamily: 'monospace', fontSize: '24px', color: '#b9a9ff' }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      mute.on('pointerdown', function () { var m = audio.toggleMute(); mute.setText(m ? '♪̸' : '♪').setAlpha(m ? 0.5 : 1); });

      // 목표 라인
      this.objText = this.add.text(DESIGN_W / 2, 58, '', { fontFamily: 'Segoe UI, Arial', fontSize: '18px', color: '#ffd34a', fontStyle: 'bold' }).setOrigin(0.5);
      // 점수 목표 바 (별점 기준)
      this.goalBarBg = this.add.graphics(); this.goalBarBg.fillStyle(0xffffff, 0.10); this.goalBarBg.fillRoundedRect(60, 84, DESIGN_W - 120, 14, 7);
      this.goalBarFill = this.add.graphics();

      // 이동 / 점수
      this.add.text(140, 130, '남은 이동', { fontFamily: 'Segoe UI, Arial', fontSize: '14px', color: '#9a8fd0' }).setOrigin(0.5);
      this.movesText = this.add.text(140, 162, '', { fontFamily: 'Segoe UI, Arial', fontSize: '40px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(400, 130, '점수', { fontFamily: 'Segoe UI, Arial', fontSize: '14px', color: '#9a8fd0' }).setOrigin(0.5);
      this.scoreBig = this.add.text(400, 162, '0', { fontFamily: 'Segoe UI, Arial', fontSize: '40px', color: '#ffd34a', fontStyle: 'bold' }).setOrigin(0.5).setShadow(0, 0, '#ff9a3a', 12, true, true);
      this.bestText = this.add.text(DESIGN_W / 2, 208, '', { fontFamily: 'Segoe UI, Arial', fontSize: '16px', color: '#b9a9ff' }).setOrigin(0.5);

      var by = BOARD_Y + TILE * ROWS + 96;
      this.hintText = this.add.text(DESIGN_W / 2, by, '인접 룬을 스와이프 · 같은 색 3개로 매치', { fontFamily: 'Segoe UI, Arial', fontSize: '14px', color: '#7c70b8', align: 'center' }).setOrigin(0.5);
    },

    objLabel: function () {
      var w = this.cfg.win;
      if (w.type === 'jelly') return '🌌 성운 ' + this.jellyTotal() + ' 남음';
      if (w.type === 'collect') return '🎯 ' + RUNE_NAMES[w.color] + ' ' + Math.min(this.collected, w.count) + ' / ' + w.count;
      if (w.type === 'ingredient') return '⭐ 별조각 ' + this.delivered + ' / ' + w.count + ' 내리기';
      return '🏁 목표 점수 ' + w.target;
    },

    updateHUD: function () {
      this.movesText.setText(String(Math.max(0, this.movesLeft)));
      this.scoreBig.setText(String(this.score));
      this.objText.setText(this.objLabel());
      this.bestText.setText(this.getBest() != null ? '베스트 ' + this.getBest() : '');
      var ratio = Math.max(0, Math.min(1, this.score / this.cfg.goal));
      this.goalBarFill.clear(); this.goalBarFill.fillStyle(ratio >= 1 ? 0x5ff0a0 : 0x8a6bff, 0.95); this.goalBarFill.fillRoundedRect(60, 84, Math.max(2, (DESIGN_W - 120) * ratio), 14, 7);
    },

    bestKey: function () { return this.mode === 'daily' ? 'rb-daily-' + this.dateKey : 'rb-best-' + this.levelIndex; },
    getBest: function () { try { var v = localStorage.getItem(this.bestKey()); return v == null ? null : parseInt(v, 10); } catch (e) { return null; } },
    setBest: function (s) { try { var b = this.getBest(); if (b == null || s > b) localStorage.setItem(this.bestKey(), String(s)); } catch (e) { } },
    starsFor: function (score, goal) { return score >= goal * 2.2 ? 3 : (score >= goal * 1.5 ? 2 : (score >= goal ? 1 : 0)); },

    showResult: function () {
      this.setBest(this.score);
      var win = this._win, stars = win ? Math.max(1, this.starsFor(this.score, this.cfg.goal)) : 0;
      if (win && this.mode === 'levels' && this.levelIndex >= loadProgress()) saveProgress(this.levelIndex + 1);
      audio.sfx(win ? 'flag' : 'die');
      var cx = DESIGN_W / 2;
      this.add.graphics().setDepth(40).fillStyle(0x05041a, 0.72).fillRect(0, 0, DESIGN_W, DESIGN_H);
      var panel = this.add.graphics().setDepth(41); panel.fillStyle(0x1a1640, 0.98); panel.fillRoundedRect(cx - 210, DESIGN_H * 0.28, 420, 360, 24); panel.lineStyle(2, 0x8a6bff, 0.8); panel.strokeRoundedRect(cx - 210, DESIGN_H * 0.28, 420, 360, 24);
      this.add.text(cx, DESIGN_H * 0.28 + 54, win ? '클리어!' : '아쉬워요', { fontFamily: 'Segoe UI, Arial', fontSize: '44px', color: win ? '#5ff0a0' : '#ff8a9a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(42);
      var starStr = ''; for (var i = 0; i < 3; i++) starStr += (i < stars ? '★' : '☆');
      this.add.text(cx, DESIGN_H * 0.28 + 122, starStr, { fontFamily: 'Arial', fontSize: '56px', color: '#ffd34a' }).setOrigin(0.5).setDepth(42);
      this.add.text(cx, DESIGN_H * 0.28 + 180, '점수 ' + this.score + '  /  목표 ' + this.cfg.goal, { fontFamily: 'Segoe UI, Arial', fontSize: '20px', color: '#cdbfff' }).setOrigin(0.5).setDepth(42);
      this.add.text(cx, DESIGN_H * 0.28 + 210, '베스트 ' + (this.getBest() != null ? this.getBest() : this.score), { fontFamily: 'Segoe UI, Arial', fontSize: '16px', color: '#9a8fd0' }).setOrigin(0.5).setDepth(42);
      var self = this;
      if (this.mode === 'daily') {
        this.resultButton(cx, DESIGN_H * 0.28 + 262, 360, 56, 0xc66bff, function () { self.copyShare(stars); }, '결과 복사 (공유)');
        this.resultButton(cx, DESIGN_H * 0.28 + 326, 360, 52, 0x6ea0ff, function () { self.scene.start('Title'); }, '타이틀로');
      } else {
        var last = this.levelIndex >= LEVELS.length - 1;
        if (win && !last) this.resultButton(cx, DESIGN_H * 0.28 + 268, 360, 60, 0x2fd07a, function () { self.scene.start('Game', { mode: 'levels', level: self.levelIndex + 1 }); }, '다음 레벨 →');
        else if (win && last) this.resultButton(cx, DESIGN_H * 0.28 + 268, 360, 60, 0x2fd07a, function () { self.scene.start('Title'); }, '🎉 전부 클리어! 타이틀로');
        else this.resultButton(cx, DESIGN_H * 0.28 + 268, 360, 60, 0x6ea0ff, function () { self.scene.start('Game', { mode: 'levels', level: self.levelIndex }); }, '다시 도전');
        this.resultButton(cx, DESIGN_H * 0.28 + 332, 360, 48, 0x5a5288, function () { self.scene.start('Title'); }, '타이틀로');
      }
    },
    resultButton: function (x, y, w, h, col, fn, label) {
      var g = this.add.graphics().setDepth(42); g.fillStyle(col, 0.25); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14); g.lineStyle(2, col, 0.9); g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
      this.add.text(x, y, label || '', { fontFamily: 'Segoe UI, Arial', fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(43);
      var zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }); zone.on('pointerdown', function () { fn(); }); return g;
    },
    copyShare: function (stars) {
      var starStr = ''; for (var i = 0; i < 3; i++) starStr += (i < stars ? '⭐' : '▫️');
      var text = 'Runeburst 데일리 ' + this.dateKey + '\n' + starStr + '  점수 ' + this.score + '\n#runeburst';
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text); } catch (e) { }
      this.flashCenter('복사됨!', '#5ff0a0');
    }
  });

  // ===========================================================================
  // 유틸
  // ===========================================================================
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function shuffle(a, rng) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function loadProgress() { try { var v = localStorage.getItem('rb-progress'); return v == null ? 0 : Math.min(LEVELS.length - 1, parseInt(v, 10)); } catch (e) { return 0; } }
  function saveProgress(i) { try { localStorage.setItem('rb-progress', String(Math.min(LEVELS.length - 1, i))); } catch (e) { } }

  window.__GAME = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#07061a',
    render: { pixelArt: false, antialias: true, roundPixels: false },
    scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(DESIGN_W, DESIGN_H)),
    scene: [Boot, Title, Game]
  });
})();
