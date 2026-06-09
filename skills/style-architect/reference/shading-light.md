# 셰이딩·광원 — 입체감을 만드는 빛 (`STY-SHADE-*`)

> 같은 팔레트라도 셰이딩이 평면 룩과 입체 룩을 가른다. 여기서 셀/소프트 셰이딩 모델·램프 단계·NW 광원 관습·
> AO 근사·하이라이트 절제·림라이트를 정한다. style.json `shading`. 인터뷰 S5. T2+.
> 광원은 *에셋 셰이딩*(여기)과 *씬 라이팅*(런타임 PointLight — [mood-grade.md](./mood-grade.md))으로 나뉘며, 둘의
> 광원 방향이 일치해야 자연스럽다(`STY-SHADE-LUDO-LIGHT-MATCH`).

---

## `STY-SHADE-MODEL-PICK-ONE` — 셰이딩 모델 하나만 (북극성)
한 게임의 셰이딩 모델은 하나로 고정한다(`shading.model`, `STY-SCOPE-ONE-STYLE`):
- **`cell`(셀/하드 셰이딩, 권장 디폴트):** 명암 경계가 또렷한 단계(2~3단). 픽셀·셀 애니 톤. 작은 화면에 깔끔하고 생성이 쉽다.
- **`soft`(소프트 셰이딩):** 부드러운 그라데이션. 벡터·매끈한 톤·고해상도. 픽셀에선 dithering 없이는 어렵다.
- **`flat`(플랫):** 셰이딩 없음, 단색 채움. 미니멀·하이퍼캐주얼·UI. 실루엣·색 대비로만 형태(`STY-FORM-SILHOUETTE-FIRST` 의존).

## `STY-SHADE-RAMP-STEPS` — 램프 단계 수
셰이딩은 재질 램프(`STY-PAL-RAMP`) 위에서 몇 단을 쓸지 정한다(`shading.ramp_steps`, 보통 3):
- **2단(base+shadow):** 가장 단순·레트로. 미니멀.
- **3단(shadow+base+highlight, 권장):** 입체감과 단순함의 균형. 대부분 픽셀 게임.
- **4단+:** 디테일하지만 작은 화면엔 과함·생성 불안정. T3 고해상도일 때만.

> 적은 단계가 응집과 가독에 유리. 명도만 바꾸지 말고 hue-shift(`STY-PAL-HUE-SHIFT`)로 단계를 만든다.

## `STY-SHADE-LIGHT-DIR-NW` — 광원 방향 NW 관습 (북극성)
2D 게임 아트의 강한 관습: **광원은 좌상단(NW)** 에서 온다. 하이라이트가 좌상, 그림자가 우하. 모든 에셋이 같은 방향을 따라야 한곳에서 빛이 오는 한 세계로 보인다(`shading.light_dir: "NW"`). 한 캐릭터는 위에서, 다른 건 옆에서 빛 받으면 붕 뜬다. 이 방향이 `visual.lighting` 슬롯으로 생성 도구에 전달되고, 씬 라이팅 PointLight 배치와도 정합해야 한다(`STY-SHADE-LUDO-LIGHT-MATCH`).

## `STY-SHADE-AO-GROUND` — AO 근사: 접지 그림자
캐릭터·오브젝트가 *공중에 떠 보이지 않게* 바닥에 접지 그림자(앰비언트 오클루전 근사)를 둔다 — 발밑 어두운 타원/반그림자. 간단하지만 입체감과 "여기 서 있다"는 느낌을 크게 준다. 픽셀은 1~2px 어두운 띠, 벡터는 소프트 타원 그림자. 떠다니는 오브젝트는 그림자를 *아래 멀리* 둬서 높이를 표현.

## `STY-SHADE-HIGHLIGHT-RESTRAINT` — 하이라이트 절제
하이라이트(램프 밝은 끝)는 *형태를 말하는 곳*에만 — 가장자리·돌출부·광택 재질. 전체에 하이라이트를 뿌리면 형태가 평평해지고 눈이 피곤하다. 작은 점·짧은 선으로 빛이 닿는 핵심만. 금속·물·보석 같은 광택 재질만 강한 스펙큘러.

## `STY-SHADE-RIMLIGHT` — 림라이트로 배경에서 띄우기
어두운 배경(T3 무드)에서 캐릭터가 묻히면, 실루엣 반대쪽 가장자리에 따뜻하거나 밝은 림라이트 한 줄을 둔다 — 배경에서 분리되고 극적이다. 호러·밤·던전 무드에서 특히 가독을 살린다(`STY-PAL-CONTRAST-ACCESS`). 과하면 모든 게 빛나니 주역에만.

## `STY-SHADE-LUDO-LIGHT-MATCH` — 에셋 셰이딩 ↔ 씬 라이팅 정합
에셋에 그려 넣은 셰이딩 광원 방향(`shading.light_dir`)과 런타임 씬 라이팅(PointLight·앰비언트 — [mood-grade.md](./mood-grade.md))이 *같은 빛*을 말해야 한다. 횃불(따뜻한 PointLight)이 오른쪽에 있는데 스프라이트는 좌상 하이라이트면 모순된다. T3 라이팅을 쓰면 주요 광원 방향·색을 셰이딩과 맞추거나, 동적 라이팅이 주도하면 스프라이트는 *중립 셰이딩*(약한 방향성)으로 그려 라이팅이 입체를 만들게 한다.

## `STY-SHADE-PRE-SHADE` — Canvas 폴백 대비 사전 셰이딩
WebGL 동적 라이팅(T3)이 Canvas 렌더러에서 no-op 일 수 있다(`STY-MOOD-CANVAS-FALLBACK`). 이 경우에도 룩이 무너지지 않게 **스프라이트에 셰이딩을 미리 구워둔다**(pre-shade) — 라이팅이 *덤*이지 *유일한 입체 소스*가 아니게. style.json `canvas_fallback.pre_shade_sprites:true` 가 이 의도를 명시. 동적 라이팅은 분위기를 더하고, 기본 입체는 스프라이트가 갖는다.

---

## 안티패턴
- **모델 혼용:** 캐릭터마다 cell/soft 다름(`STY-SHADE-MODEL-PICK-ONE` 위반).
- **광원 방향 제각각:** 에셋마다 빛 방향 다름(세계가 붕 뜸, `STY-SHADE-LIGHT-DIR-NW` 위반).
- **명도만 셰이딩:** hue-shift 없이 검정만 섞어 칙칙(`STY-PAL-HUE-SHIFT` 위반).
- **하이라이트 폭발:** 전체에 하이라이트로 형태 평평.
- **라이팅 의존:** 동적 라이팅 꺼지면(Canvas) 입체 사라짐(`STY-SHADE-PRE-SHADE` 미적용).

## 출처
- 셀/소프트 셰이딩·NW 광원·AO 접지·림라이트(2D 게임 아트·도트 셰이딩 통념)를 작은 웹게임용으로 정리. 씬 라이팅 정합·Canvas 폴백은 [lighting-mood](../../lighting-mood/SKILL.md)(engine/lightingkit.js) WebGL 게이트와 [mood-grade.md](./mood-grade.md) 로 연결.
