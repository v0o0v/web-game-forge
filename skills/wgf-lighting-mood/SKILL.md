---
name: wgf-lighting-mood
description: "동적 라이팅과 절차적 분위기로 호러·던전·밤 스테이지 무드를 입힌다. 어둠 속 광원(PointLight), Simplex Noise 안개, Gradient 밤하늘, 앰비언트 어둠. 라이팅, 조명, point light, 횃불, 낮밤, 안개, fog, 분위기, 어둠, 호러, 던전, atmosphere."
allowed-tools: Read, Write, Edit, Bash
---

# lighting-mood — 동적 라이팅·절차적 분위기

PointLight 가산 발광 + Simplex Noise 안개 + Gradient 밤하늘 + 앰비언트 어둠으로 어두운 스테이지의 무드를 코드로 입힌다. web-game-builder의 전문 스킬. `engine/lightingkit.js`를 사용한다.

## 언제 사용
- 호러·던전·밤 정원 등 어두운 스테이지에 광원 분위기를 더할 때
- 횃불·등불·구슬처럼 스프라이트를 따라다니는 발광 효과가 필요할 때
- 절차적 안개로 어둠 속 안개 효과를 깔 때
- 낮/밤 전환, 분위기 연출(bloom + 라이팅 연계)이 필요할 때

## 엔진 로드

`index.html`에 추가한다:

```html
<script src="../../engine/lightingkit.js"></script>
```

## 두 가지 라이팅 경로

| 경로 | API | 노멀맵 필요? | 용도 |
|---|---|---|---|
| **PointLight GO** (추천) | `LightingKit.light` / `LightingKit.attach` | 불필요 | 절차 텍스처, 구슬, 등불, 횃불 |
| **정식 노멀맵 라이팅** (고급) | `LightingKit.enableNormalLighting` | 필요 | 노멀맵 스프라이트 시트 보유 시만 |

web-game-builder의 절차 텍스처(`VectorForge.bake`)는 노멀맵이 없으므로 기본적으로 **PointLight 경로**를 사용한다.

## 핵심 API

### WebGL 지원 확인

```js
if (!LightingKit.supported(scene)) return; // Canvas 이면 광원 계열 null 반환
```

Canvas 렌더러에서는 `LightingKit.light/fog/nightSky`가 모두 `null`을 반환한다(graceful no-op). `ambient`는 Canvas에서도 동작(일반 rectangle).

---

### 1) 고정 점광원 — `LightingKit.light`

```js
// 기본 따뜻한 백열등 느낌
var lamp = LightingKit.light(scene, 200, 120, {
  color: 0xffdca8,    // 기본값. 따뜻한 주황
  radius: 90,          // 발광 반경(px). 기본 90
  intensity: 0.9,      // 밝기. 기본 0.9
  attenuation: 0.06,   // 감쇠. 낮을수록 부드럽게 퍼짐
  depth: 5
});

// 차갑고 파란 마법 구슬
var magicLight = LightingKit.light(scene, 300, 200, {
  color: 0x8fe9ff,
  radius: 78,
  intensity: 0.9
});
```

반환값: `Phaser.GameObjects.PointLight` (WebGL) 또는 `null` (Canvas).

---

### 2) 스프라이트를 따라다니는 점광원 — `LightingKit.attach`

```js
// orb 스프라이트/Matter 이미지에 부착
var orb = MatterKit.ball(scene, 80, 240, 'orb', { radius: 11 });
orb._light = LightingKit.attach(scene, orb, {
  color: 0x8fe9ff,
  radius: 78,
  intensity: 0.9,
  depth: 19,
  offset: { x: 0, y: -4 }  // 스프라이트 중심 기준 오프셋(선택)
});
```

- `scene.events.UPDATE`마다 `target.x/y`를 따라간다.
- `target.destroy()` 시 자동 핸들러 정리.
- 반환값: `Phaser.GameObjects.PointLight` 또는 `null`.

**Nocturne 데모 예시** — 등불 4개와 발사 구슬 전부 `attach` 사용:

```js
// 등불: PathKit 팔로워 + attach 조합
lan._light = LightingKit.attach(scene, lan, { color: 0xffc46a, radius: 64, intensity: 0.85, depth: 14 });

// 발사 구슬: Matter ball + attach 조합
orb._light = LightingKit.attach(scene, orb, { color: 0x8fe9ff, radius: 78, intensity: 0.9, depth: 19 });
```

등불 명중 시 광원 트윈으로 꺼주기:

```js
if (lan._light) {
  scene.tweens.add({ targets: lan._light, intensity: 0, duration: 300,
    onComplete: function () { lan._light.destroy(); } });
}
```

---

### 3) Simplex Noise 드리프팅 안개 — `LightingKit.fog`

```js
var fog = LightingKit.fog(scene, DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H, {
  alpha: 0.12,          // 농도. 기본 0.14
  blend: Phaser.BlendModes.SCREEN,  // SCREEN 블렌드로 빛 안개
  iterations: 3,        // 노이즈 detail. 기본 3
  warp: 0.4,            // 와류. 기본 0.4
  seed: 7,              // 시드
  speed: 0.00016,       // 드리프트 속도. 기본 0.00018
  depth: -80
});
```

- `scene.add.noiseSimplex2D` (Phaser 4 Noise GO)를 내부적으로 사용.
- 매 프레임 `noiseOffset`을 누적해 자동으로 흐른다.
- WebGL 전용. Canvas에서는 `null` 반환.

---

### 4) Gradient 밤하늘 — `LightingKit.nightSky`

```js
var sky = LightingKit.nightSky(scene, DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H, {
  // bands 미지정 시 짙은 남보라 밤하늘(기본값 내장)
  depth: -100
});
```

커스텀 `bands` 지정 시 Phaser 4 `Gradient` GO의 `ColorBand` 형식 사용:

```js
LightingKit.nightSky(scene, cx, cy, w, h, {
  bands: [
    { start: 0, end: 0.6, colorStart: 0x070a1c, colorEnd: 0x121838, colorSpace: 1, interpolation: 3 },
    { start: 0.6, end: 1,  colorStart: 0x121838, colorEnd: 0x281f46, colorSpace: 1, interpolation: 3 }
  ],
  shapeMode: 0,  // 0 = linear
  depth: -100
});
```

- Phaser 4 `scene.add.gradient`(Gradient GO) 래퍼.
- WebGL 전용.

---

### 5) 앰비언트 어둠 오버레이 — `LightingKit.ambient`

```js
LightingKit.ambient(scene, DESIGN_W / 2, DESIGN_H / 2, DESIGN_W, DESIGN_H,
  0x0a0e22,  // 어둠 색. 기본 0x0a0e1e
  0.35       // 불투명도. 기본 0.5
).setDepth(40).setScrollFactor(0);
```

- `Phaser.BlendModes.MULTIPLY`로 합성 → PointLight만 도드라져 보인다.
- 내부적으로 `scene.add.rectangle`을 사용하므로 Canvas에서도 동작(단, MULTIPLY는 WebGL에서만 의미 있음).

---

### 6) 정식 노멀맵 라이팅 (고급) — `LightingKit.enableNormalLighting`

노멀맵 텍스처가 있는 스프라이트에만 사용. 절차 텍스처에는 적용하지 않는다.

```js
LightingKit.enableNormalLighting(sprite, {
  enabled: true,
  penumbra: 0.5,               // 그림자 부드러움. 낮을수록 선명
  diffuseFlatThreshold: 1 / 3  // 확산광 임계값
});
// 내부적으로: sprite.setLighting(true) + sprite.setSelfShadow(...)
```

## 밤 무드 레시피 — Nocturne 데모 조합

`games/nocturne/game.js`가 검증한 조합이다. 어두운 밤 정원에서 광원이 가장 아름답게 보이는 설정:

```js
// 1) 어두운 배경 (VectorForge.gradientBackground 또는 직접)
//    #05060f ~ #241c44 계열 — 밝은 배경에서는 가산 광원이 보이지 않는다

// 2) Simplex Noise 안개 (LITE 모드 off 시만)
if (!LITE) {
  LightingKit.fog(scene, cx, cy, W, H, { alpha: 0.12, depth: -80, speed: 0.00016 });
}

// 3) 앰비언트 어둠 (LITE 모드 off 시만)
if (!LITE) {
  LightingKit.ambient(scene, cx, cy, W, H, 0x0a0e22, 0.35)
    .setDepth(40).setScrollFactor(0);
}

// 4) 스프라이트마다 attach로 점광원 부착
sprite._light = LightingKit.attach(scene, sprite, { color: 0xffc46a, radius: 64, intensity: 0.85 });

// 5) ScreenFX bloom — 광원이 블룸으로 번져 야경 완성
if (!LITE && ScreenFX.supported(cameras.main)) {
  ScreenFX.bloom(cameras.main, { threshold: 0.46, amount: 0.85, strength: 1.3 });
  ScreenFX.vignette(cameras.main, { radius: 0.62, strength: 0.5 });
}
```

PointLight(가산) + ambient(MULTIPLY) + bloom의 3중 조합이 핵심이다. bloom은 `screen-fx` 스킬 참고.

**`?lite=1` 쿼리스트링**: Nocturne 데모는 fog/ambient 같은 무거운 효과를 `LITE` 플래그로 끈다. 저사양 기기 대응에 동일 패턴을 사용한다:

```js
var LITE = /[?&]lite=1/.test(location.search);
```

## Phaser 4 레퍼런스

이 스킬과 직접 관련된 Phaser 4 문서:

- **Lighting 컴포넌트** (`setLighting`, `setSelfShadow`) →
  [`reference/phaser/game-object-components.md`](../wgf-web-game-builder/reference/phaser/game-object-components.md) (Lighting 섹션)
- **Noise GO** (`noiseSimplex2D` 등), **Gradient GO**, **SpriteGPULayer** →
  [`reference/phaser/v4-new-features.md`](../wgf-web-game-builder/reference/phaser/v4-new-features.md) (New Game Objects 섹션)
- 전체 색인 → [`reference/phaser/INDEX.md`](../wgf-web-game-builder/reference/phaser/INDEX.md)

## Gotcha

1. **PointLight/Noise/Gradient 모두 WebGL 전용** — `LightingKit.supported(scene)` 또는 반환값 null 체크로 guard한다.
2. **가산(ADD) 광원은 어두운 배경에서** — 밝은 배경 위 PointLight는 사실상 보이지 않는다. `ambient`나 어두운 스카이로 바탕을 어둡게 만든 뒤 광원을 켠다.
3. **라이팅은 배치(batch)를 깬다** — `setLighting(true)` 오브젝트가 많으면 드로콜이 증가한다. 라이팅 오브젝트끼리 depth 범위를 모아 그룹화하면 배치 효율이 올라간다.
4. **fog/ambient는 오버드로 비용** — 전체화면 SCREEN/MULTIPLY 레이어는 GPU fill rate 비용이 있다. 저사양 기기에서는 `?lite=1` 패턴으로 비활성화한다.
5. **attach 핸들러 자동 정리** — `LightingKit.attach` 반환 PointLight의 `destroy` 이벤트에 UPDATE 핸들러 해제가 등록되어 있다. `target.destroy()` 전에 `light.destroy()`를 명시적으로 호출해도 안전하다.
6. **`ambient`는 Canvas에서도 동작하지만 MULTIPLY는 WebGL만** — Canvas 렌더러에서 `BlendMode.MULTIPLY`는 무시되고 단순 사각형으로 표시된다.

## 연계 / 원칙

- web-game-builder 워크플로의 일부. IP-safe(절차 텍스처, CC0).
- 엔진 API 전체 색인: [`reference/engine-api.md`](../wgf-web-game-builder/reference/engine-api.md).
- bloom 연계: [`skills/wgf-screen-fx/SKILL.md`](../wgf-screen-fx/SKILL.md) — PointLight + bloom 조합이 야경의 핵심.
- 경로 팔로워 + 점광원 조합(등불 패턴): [`skills/wgf-path-motion/SKILL.md`](../wgf-path-motion/SKILL.md).
- Phaser 4 새 기능(Noise, Gradient): [`reference/phaser/v4-new-features.md`](../wgf-web-game-builder/reference/phaser/v4-new-features.md).
