---
name: wgf-screen-fx
description: "포스트FX로 화면 룩을 완성합니다 — 블룸, 비네트, CRT 레트로, 네온 글로우, 컬러 그레이딩, 픽셀레이트 전환. 화면 효과·post-processing·filter·bloom·비네트·vignette·CRT·컬러 그레이딩·color grading·네온·픽셀아트 전환 요청 시 사용."
allowed-tools: Read, Write, Edit, Bash
---

# screen-fx — 포스트FX·GPU 필터로 화면 룩 완성

v4의 간판 기능인 Filter 체계를 한 줄 API로 감싼 `ScreenFX` 헬퍼. 카메라·오브젝트에 블룸·비네트·글로우·컬러 그레이딩·픽셀레이트·CRT 왜곡을 올려 전 장르의 "완성도"를 끌어올린다. web-game-builder 엔진의 `engine/screenfx.js`를 사용한다.

## 언제 사용

- 야간·공포·네온 배경 등 무드를 GPU 필터로 강조할 때
- 피격·데미지 시 비네트 플래시, 클리어 시 블룸 강화 연출
- CRT 레트로 룩 또는 픽셀레이트 씬 전환이 필요할 때
- 오브젝트(보스, 마법 구슬, 등불)에 발광 외곽선이 필요할 때
- `juice-fx`(파티클·셰이크·트윈)로 게임필을 올린 뒤 화면 전체 룩을 마무리할 때

## 엔진 로드

```html
<!-- index.html — Phaser 4 다음에 추가 -->
<script src="../../engine/screenfx.js"></script>
```

`ScreenFX`는 전역 변수로 노출된다. Canvas 렌더러면 모든 메서드가 `null`을 반환하므로(graceful no-op) 별도 분기 없이 `if (ScreenFX.supported(cam))` 한 줄이면 충분하다.

## WebGL 지원 체크

```js
// 카메라 또는 오브젝트 모두 동일하게 체크
if (!ScreenFX.supported(this.cameras.main)) return; // Canvas면 조용히 종료

// 또는 반환값 null 체크
var bloom = ScreenFX.bloom(cam, { threshold: 0.5, amount: 0.8 });
if (!bloom) return; // Canvas 환경
```

## 핵심 API

### `ScreenFX.bloom(target, o)` — 블룸

v4에는 전용 Bloom 필터가 없다. `ScreenFX`는 내부적으로 `ParallelFilters(Threshold → Blur) + ADD` 합성으로 구현한다.

```js
// 기본 블룸 (카메라)
ScreenFX.bloom(this.cameras.main, { threshold: 0.55, amount: 0.7 });

// 네온 느낌 — 임계값 낮추고 강도 높이기
ScreenFX.bloom(this.cameras.main, { threshold: 0.4, amount: 0.95, strength: 1.5 });

// 꿈결 느낌 — 넓은 흐림
ScreenFX.bloom(this.cameras.main, { threshold: 0.3, amount: 0.5, x: 3, y: 3 });
```

옵션: `threshold`(0.55), `knee`(1), `quality`(1), `x`/`y` 흐림 범위(2), `strength`(1.2), `amount`(0.7), `external`(false).

---

### `ScreenFX.vignette(cam, o)` — 비네트

가장자리를 어둡게 해 화면 집중도를 높인다. 기본 `external`(스크린 공간) 적용.

```js
// 야간 무드
ScreenFX.vignette(this.cameras.main, { radius: 0.62, strength: 0.55 });

// 피격 연출 — 강한 비네트 후 제거
var vig = ScreenFX.vignette(this.cameras.main, { radius: 0.5, strength: 0.9 });
this.time.delayedCall(300, function () {
  this.cameras.main.filters.external.remove(vig);
}, [], this);
```

옵션: `x`/`y` 중심(0.5), `radius`(0.5), `strength`(0.5), `external`(true).

---

### `ScreenFX.glow(obj, o)` — 오브젝트 글로우

스프라이트·이미지에 발광 외곽선을 추가한다. `enableFilters()`를 자동 호출하므로 별도 선행 불필요.

```js
// 마법 오브 발광
ScreenFX.glow(orbSprite, { color: 0x66f0ff, outer: 6 });

// 보스 피격 시 빨간 플래시 글로우
var g = ScreenFX.glow(bossSprite, { color: 0xff2020, outer: 8 });
this.time.delayedCall(200, function () { bossSprite.filters.internal.remove(g); });
```

옵션: `color`(0xffffff), `outer`(4), `inner`(0), `scale`(1), `external`(false — internal 권장).

---

### `ScreenFX.colorGrade(cam, preset)` — 컬러 그레이딩

내장 프리셋 문자열 또는 `fn(colorMatrix)` 콜백으로 자유롭게 조합한다.

```js
// 내장 프리셋 문자열
ScreenFX.colorGrade(this.cameras.main, 'sepia');
ScreenFX.colorGrade(this.cameras.main, 'night');      // 기본 night 적용

// 콜백으로 복합 그레이딩
ScreenFX.colorGrade(this.cameras.main, function (m) {
  m.night(0.45);        // 블루 시프트
  m.brightness(0.03);   // 미세 밝기 보정
});

// 수중 분위기
ScreenFX.colorGrade(this.cameras.main, function (m) {
  m.hue(180);
  m.saturate(0.2);
});
```

내장 프리셋 목록: `sepia` / `grayscale` / `night` / `brown` / `kodachrome` / `technicolor` / `vintagePinhole` / `brightness(v)` / `saturate(v)` / `contrast(v)` / `hue(deg)` / `negative` / `desaturate` / `lsd` / `polaroid`.

---

### `ScreenFX.pixelate(cam, amount)` — 픽셀레이트

```js
// 씬 전환 시 픽셀레이트 → 복원
var px = ScreenFX.pixelate(this.cameras.main, 6);
this.tweens.add({
  targets: px, amount: 0, duration: 600, ease: 'Quad.in',
  onComplete: function () { this.cameras.main.filters.internal.remove(px); }
});
```

---

### `ScreenFX.crt(cam, o)` — CRT 레트로

배럴 왜곡 + (옵션)픽셀레이트 + 비네트를 한 번에 적용. 레트로 장르 전용 룩.

```js
// 기본 CRT
ScreenFX.crt(this.cameras.main);

// 강한 픽셀레이트 포함
ScreenFX.crt(this.cameras.main, { barrel: 1.1, pixelate: 3, radius: 0.6, strength: 0.75 });
```

옵션: `barrel`(1.06), `pixelate`(undefined — 생략 시 미적용), `radius`(0.55), `strength`(0.7).

---

### `ScreenFX.preset(cam, name)` — 한 방 프리셋

| 프리셋 | 구성 | 장르 추천 |
|---|---|---|
| `'night'` | colorGrade(night+brightness) + bloom + vignette | 야간, 공포, 스텔스 |
| `'neon'` | bloom(강) + vignette | 사이버펑크, 아케이드 |
| `'retro'` | crt(pixelate:2) | 레트로, 클래식 |
| `'dream'` | bloom(넓은 흐림) + colorGrade(saturate+brightness) | RPG, 판타지 |

```js
// 씬 create() 에서 한 줄
if (ScreenFX.supported(this.cameras.main)) {
  ScreenFX.preset(this.cameras.main, 'night');
}
```

## 실전 예제 — Nocturne 데모 (`games/nocturne/game.js`)

야간 물리 슬링볼 데모에서 카메라 블룸·비네트·컬러 그레이딩을 조합한 실제 코드:

```js
// GameScene.create() — line 208-211
if (!LITE && ScreenFX.supported(this.cameras.main)) {
  ScreenFX.bloom(this.cameras.main, { threshold: 0.46, amount: 0.85, strength: 1.3 });
  ScreenFX.vignette(this.cameras.main, { radius: 0.62, strength: 0.5 });
  ScreenFX.colorGrade(this.cameras.main, function (m) { m.brightness(0.02); m.saturate(0.1); });
}

// TitleScene.create() — 타이틀 화면에도 동일 패턴 (line 108-111)
if (!LITE && ScreenFX.supported(this.cameras.main)) {
  ScreenFX.bloom(this.cameras.main, { threshold: 0.5, amount: 0.7 });
  ScreenFX.vignette(this.cameras.main, { radius: 0.7, strength: 0.45 });
}
```

**`?lite=1` 가드 패턴** — 저사양 기기에서 FX를 전부 끄는 표준 관용구. Nocturne 데모가 이를 사용한다.

```js
var LITE = /[?&]lite=1/.test(location.search);

// create() 에서
if (!LITE && ScreenFX.supported(this.cameras.main)) {
  ScreenFX.preset(this.cameras.main, 'neon');
}
```

## 프리셋 룩 레시피

### 야간 정원 (Nocturne 스타일)
```js
ScreenFX.bloom(cam, { threshold: 0.46, amount: 0.85, strength: 1.3 });
ScreenFX.vignette(cam, { radius: 0.62, strength: 0.5 });
ScreenFX.colorGrade(cam, function (m) { m.brightness(0.02); m.saturate(0.1); });
```

### 사이버펑크 네온
```js
ScreenFX.bloom(cam, { threshold: 0.38, amount: 1.0, strength: 1.8 });
ScreenFX.vignette(cam, { radius: 0.72, strength: 0.38 });
ScreenFX.colorGrade(cam, function (m) { m.saturate(0.3); m.hue(200); });
```

### CRT 레트로 아케이드
```js
ScreenFX.crt(cam, { barrel: 1.08, pixelate: 2, strength: 0.7 });
ScreenFX.colorGrade(cam, 'vintagePinhole');
```

### 수중 왜곡
```js
ScreenFX.colorGrade(cam, function (m) { m.hue(185); m.saturate(0.25); m.brightness(-0.04); });
ScreenFX.bloom(cam, { threshold: 0.6, amount: 0.4, x: 1, y: 3 });
```

### 피격 비네트 플래시
```js
function hitFlash(scene) {
  var vig = ScreenFX.vignette(scene.cameras.main, { radius: 0.45, strength: 0.95 });
  if (!vig) return;
  scene.time.delayedCall(250, function () {
    scene.cameras.main.filters.external.remove(vig);
  });
}
```

## Gotcha — 반드시 알아야 할 사항

**1. WebGL 전용**
Canvas 렌더러에서 `enableFilters()`는 조용히 무시되고 ScreenFX는 `null`을 반환한다. `ScreenFX.supported(cam)` 체크 또는 반환값 null 체크로 항상 보호한다.

**2. 오브젝트는 `enableFilters()` 선행 필요 — ScreenFX 가 자동 처리**
카메라는 기본적으로 필터를 보유하지만 스프라이트·이미지는 수동 `enableFilters()` 호출이 필요하다. `ScreenFX.glow()` 등은 이를 자동으로 처리한다.

**3. internal vs external — 비용 차이**
- `internal` = 오브젝트/카메라 로컬 공간. 렌더 영역 크기만 처리. 저렴.
- `external` = 스크린 공간 전체 처리. 비쌈. 비네트·화면 전체 왜곡에만 사용.
- 가능하면 `internal` 우선. `ScreenFX.vignette()`는 기본 `external`이나 나머지는 `internal`.

**4. 필터 순서 = 리스트 순서**
앞 필터의 출력이 뒤 필터의 입력이 된다. `colorGrade` → `bloom` → `vignette` 순이 일반적으로 자연스럽다.

**5. v4에는 전용 Bloom 필터가 없다**
`ScreenFX.bloom()`은 내부적으로 `ParallelFilters(Threshold → Blur) + ADD`로 합성한다. v3의 `FX.addBloom()`과 직접 대응하지 않는다.

**6. 과용 금지 — 모바일은 일찍 테스트**
필터마다 추가 드로우콜이 발생한다. 카메라 1개에 3개 이하로 유지하고, 모바일에서는 `?lite=1` 패턴으로 FX를 끌 수 있게 준비한다.

**7. Glow의 `quality`·`distance`는 생성 후 불변**
변경이 필요하면 기존 필터를 제거하고 새로 추가해야 한다.

## Phaser 4 레퍼런스 라우팅

더 깊은 Filter API가 필요하면:
- [filters-and-postfx](../wgf-web-game-builder/reference/phaser/filters-and-postfx.md) — 전체 필터 목록, FilterList API, ParallelFilters, Mask, Wipe 전환 상세
- [cameras](../wgf-web-game-builder/reference/phaser/cameras.md) — 카메라 기반 필터 설정
- 전체 색인: [reference/phaser/INDEX.md](../wgf-web-game-builder/reference/phaser/INDEX.md)

## juice-fx 와의 역할 분담

| | juice-fx | screen-fx |
|---|---|---|
| **레이어** | 게임 오브젝트 이벤트 | GPU 포스트프로세싱 |
| **주역** | 파티클, 스크린셰이크, 트윈 이징, 히트스톱 | 블룸, 비네트, 컬러 그레이딩, CRT |
| **타이밍** | 즉각적 피드백(타격, 코인, 점프) | 씬 전체 무드 + 피격 순간 강조 |
| **비용** | CPU 위주 | GPU 드로우콜 |
| **조합** | 셰이크 + 히트스톱으로 타격감 | 비네트 플래시로 화면 강조 |

두 스킬은 보완 관계. `juice-fx`로 타격감을 올리고 `screen-fx`로 세계관 룩을 완성한다. Nocturne 데모가 두 스킬을 동시에 사용하는 실전 참고 예시다.

## web-game-builder 연결

web-game-builder 워크플로의 일부. 외부 이미지 없이 VectorForge 절차 텍스처와 조합 가능. IP-safe(CC0/절차적).
- 엔진 전체 API: `reference/engine-api.md`
- 데모: `games/nocturne/` — 야간 씬에 bloom + vignette + colorGrade 실전 적용
