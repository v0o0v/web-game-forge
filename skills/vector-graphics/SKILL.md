---
name: vector-graphics
description: "미려한 비-픽셀(스무스/벡터) 그래픽을 VectorForge로 코드 생성하거나 외부 HD CC0 아트를 로딩합니다. 그라데이션·글로우·소프트섀도우·글래스모피즘·곡선 캐릭터 등 매끄러운 그래픽 요청 시 사용 — 미려한, 예쁜, 부드러운, 벡터, 플랫, 네온, 글래스, smooth, vector, gradient, glow, flat, glassmorphism, HD."
allowed-tools: Read, Write, Edit, Bash
---

# vector-graphics — 미려한 스무스/벡터 그래픽

픽셀아트가 아닌 **부드럽고 미려한 그래픽**(그라데이션·글로우·소프트섀도우·글래스질·곡선 캐릭터)을
만든다. `engine/vectorforge.js`(VectorForge, 절차적·CC0)로 코드 생성하거나, 외부 HD CC0 아트를
라이선스 게이트로 로딩한다. web-game-builder의 전문 스킬.

## 언제 사용
- "미려하게", "예쁘게", "픽셀 말고 부드럽게", "벡터/플랫/네온/글래스 스타일로"
- 그라데이션·글로우·소프트섀도우·글래스모피즘·곡선 마스코트 캐릭터가 필요할 때
- HD 래스터/SVG CC0 아트를 쓰고 싶을 때

## ⚠ 렌더 스타일은 게임당 하나
픽셀 게임과 스무스 게임은 Phaser 렌더 설정이 다르다. **한 게임은 한 스타일**로 통일한다.

```js
// 스무스(VectorForge) 게임:
render: { pixelArt: false, antialias: true, roundPixels: false }
// 픽셀(PixelForge) 게임:  render: { pixelArt: true, roundPixels: true }
```

## 핵심 레시피 — VectorForge

### 1) 내장 라이브러리
```js
// Boot.create() 내
VectorForge.buildAll(this);   // vf-hero, vf-coin, vf-gem, vf-orb, vf-platform, vf-cloud, vf-hill,
                              // vf-glass, vf-button + 애니(vf-hero-run, vf-coin-spin, vf-orb-pulse)
this.add.sprite(x, y, 'vf-hero').play('vf-hero-run');
```

### 2) 커스텀 스프라이트 — drawFn 으로 그리기
`bake(scene, key, { w, h, ss?, draw|frames })`. drawFn 은 **논리 좌표 0..w, 0..h**로 그리고,
기본 3x 슈퍼샘플 후 고품질 다운샘플되어 매끄러운 안티앨리어스 텍스처가 된다.

```js
VectorForge.bake(this, 'orb', {
  w: 24, h: 24, ss: 3,
  draw: function (ctx, w, h, t, VF) {
    VF.glow(ctx, 'rgba(70,220,255,0.9)', 9, function () {     // 네온 글로우
      VF.circle(ctx, w/2, h/2, 8);
      ctx.fillStyle = VF.radial(ctx, w/2, h/2, 9, [[0,'#eaffff'],[0.4,'#66f0ff'],[1,'#2bb6e0']]);
      ctx.fill();
    });
  }
});
```

다중 프레임(애니): `frames: [fn0, fn1, ...]` 후 `scene.anims.create(...)`.

### 3) 헬퍼 툴킷 (drawFn 의 5번째 인자 `VF`)
- `VF.rr(ctx,x,y,w,h,r)` 둥근 사각형 · `VF.circle/ellipse/poly/blob/star`
- `VF.lin(ctx,x0,y0,x1,y1,stops)` 선형 · `VF.radial(ctx,cx,cy,r,stops)` 방사 그라데이션
- `VF.glow(ctx,color,blur,fn)` 발광 · `VF.shadow(ctx,opts,fn)` 소프트 드롭섀도우
- `VF.glass(ctx,x,y,w,h,r)` 글래스모피즘 패널
- `VectorForge.gradientBackground(scene,key,w,h,stops)` 전체 화면 그라데이션(하늘/오로라)

### 4) 4가지 스타일 가이드
- **플랫/머티리얼**: 단색 + `VF.shadow` 소프트섀도우 + 살짝 둥근 모서리(`VF.rr`).
- **그라데이션/글로우**: `VF.lin`/`VF.radial` + `VF.glow`로 네온·발광.
- **글래스모피즘**: `VF.glass` (반투명 + 라이트 보더 + 상단 하이라이트). 배경이 화려해야 비침.
- **카툰 벡터 캐릭터**: `VF.blob` 둥근 몸통 + 그라데이션 + 큰 눈(흰자+동공+하이라이트) + 소프트섀도우.

## 핵심 레시피 — 외부 HD CC0 아트 로딩

절차적으로 부족하면 **CC0 HD 아트**를 로딩한다. `assets.json` 라이선스 게이트로 **CC0만 허용**하고
`CREDITS.txt`에 출처를 남긴다(자세히는 `ip-license-guard`).

```js
// SVG → 임의 크기로 또렷이 래스터화(벡터, 크기 자유)
this.load.svg('hero', 'assets/hero.svg', { width: 128, height: 128 });
// HD 래스터 / 아틀라스
this.load.image('bg', 'assets/bg.png');
this.load.atlas('chars', 'assets/chars.png', 'assets/chars.json');
```

추천 CC0 소스(개별 라이선스 확인 필수): Kenney(벡터/UI 팩), SVGRepo(CC0 필터), OpenGameArt(CC0),
Game-icons.net(CC0). 외부 에셋은 `games/<slug>/assets/`에 벤더링하고 `assets.json`에 등록한다.

## 모바일/성능 주의
- 슈퍼샘플은 **bake 1회 비용**이고 런타임은 일반 스프라이트다. 단 고해상도 텍스처는 VRAM↑ →
  스프라이트 논리 크기를 과하게 키우지 말고, 모바일은 `ss: 2`도 고려.
- `pixelArt:false`라 확대 시 LINEAR 필터로 부드럽다. `image-rendering: pixelated` CSS는 쓰지 말 것.
- 글로우(`shadowBlur`)·대형 반투명 오버레이는 모바일 필레이트 부담 → 과용 금지(`perf-60fps` 참고).

## 연계 / 원칙
- 픽셀 스타일은 `sprite-forge`(PixelForge), 스무스/벡터는 이 스킬(VectorForge). 게임당 하나.
- 프리뷰: `games/style-preview/index.html` (4가지 스타일 쇼케이스).
- IP-safe: 절차적 또는 CC0만. 엔진 API는 `reference/engine-api.md`.
