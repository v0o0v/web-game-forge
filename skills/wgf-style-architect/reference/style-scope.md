# 복잡도·범위 — 스타일은 얼마나 깊어야 하는가 (`STY-SCOPE-*`)

> 스타일 설계의 첫 결정은 "얼마나 자세히 정할 것인가"다. 작은 웹게임에 풀 스타일가이드는 과설계다 — 많은 게임은
> *제한 팔레트 하나*로 충분하다. 여기서 복잡도 티어(0~3)·매체(픽셀↔벡터)·팔레트 크기·무드 강도를 가장 먼저 가른다.
> 인터뷰 S1. 이게 어휘·범위·이후 모든 질문을 프레이밍한다 — 위가 흔들리면 아래를 물어도 소용없다.

---

## `STY-SCOPE-DEFAULT-MINIMAL` — 디폴트는 팔레트만 (북극성)
스타일은 *과설계가 가장 쉬운 영역*이다. 디폴트는 **T0(제한 팔레트 하나)** — 색만 고정하고 폼·셰이딩은 엔진 기본([`pixelforge`](../../wgf-sprite-forge/SKILL.md)·[`vectorforge`](../../wgf-vector-graphics/SKILL.md) 기본 셰이딩)에 맡긴다. 한 칸씩 정당화하며 올린다(`STY-SCOPE-LADDER`). "예쁘게 해줘"는 보통 *일관된 제한 팔레트 + 실루엣*만으로 80% 달성된다 — 라이팅/포스트FX(T3)는 무드가 게임의 정체성일 때만.

## `STY-SCOPE-ONE-STYLE` — 한 게임 한 스타일 (북극성)
한 게임 안에서 매체·팔레트·셰이딩 모델은 **하나로 고정**한다. 픽셀과 매끈 벡터를 한 화면에 섞거나, 셀 셰이딩과 소프트 셰이딩을 캐릭터마다 바꾸면 응집이 깨진다. style.json 의 `master_palette`·`shading.model`·`medium` 이 그 단일 진실이고, 모든 에셋이 거기서 상속한다(`STY-PAL-MASTER-SINGLE-SOURCE`). 예외는 *의도적 대비*(예: UI만 플랫) 일 때만, 그것도 규칙으로 명시.

## `STY-SCOPE-LADDER` — 복잡도 4티어 사다리
| 티어 | 무엇을 고정 | style.json 채우는 키 | STYLE.md |
|---|---|---|---|
| **T0 팔레트만** | 색 램프·역할색·배경 | `master_palette`·`role_colors`·`render` | 불필요 |
| **T1 +폼** | + 비율·라인·실루엣·display_px | + `proportions`·`line` | §0~§3 몇 줄 |
| **T2 +셰이딩** | + 셀/소프트 셰이딩·NW 광원·AO | + `shading` | + §4 |
| **T3 풀 가이드** | + 라이팅 무드·포스트FX·Canvas 폴백 | + `lighting`·`postfx`·`canvas_fallback` | 전 섹션 |

> 한 칸 올릴 때마다 "이 게임에 정말 필요한가"를 되묻는다. T3 라이팅/포스트FX는 던전·밤·호러처럼 *무드가 핵심 동사*일 때만(`STY-MOOD-NIGHT-HORROR-RECIPE`).

## `STY-SCOPE-MEDIUM-GATE` — 매체 게이트: 픽셀 vs 벡터 (먼저 가른다)
스타일의 두 번째 갈림길은 **매체**다 — `medium: "pixel"`(레트로·도트·해상도 제한) vs `medium: "vector"`(매끈·그라디언트·글로우·곡선). 이게 어떤 생성 도구로 라우팅될지(픽셀→[`sprite-forge`](../../wgf-sprite-forge/SKILL.md), 벡터→[`vector-graphics`](../../wgf-vector-graphics/SKILL.md))와 셰이딩 어휘를 통째로 바꾼다.
- **픽셀(디폴트):** 작은 웹게임의 기본. 제한 팔레트·hue-shift 램프·아웃라인·셀 셰이딩이 자연스럽다. min_feature_px 가 진실.
- **벡터:** 캐주얼·하이퍼·UI 중심·곡선 캐릭터. 그라디언트·소프트섀도우·글래스모피즘. 픽셀 규칙(min_feature_px·아웃라인 weight) 대신 곡률·글로우·재질 램프.
- **혼용 금지**(`STY-SCOPE-ONE-STYLE`) — 한 게임 한 매체.

## `STY-SCOPE-MEDIUM-RENDER-MATCH` — 매체는 game.js render와 1:1 (D7)
`style.json.medium` 은 게임 Phaser config 의 `render.pixelArt` 와 **반드시 일치**한다 — `pixel` ↔ `pixelArt:true`·`antialias:false`·`roundPixels:true`, `vector` ↔ `pixelArt:false`·`antialias:true`. 어긋나면 픽셀아트가 뭉개지거나 벡터가 계단진다. style.json `render` 블록이 game.js config 를 미러하고, lint-style.mjs 가 불일치를 검출한다.

## `STY-SCOPE-PALETTE-BUDGET` — 팔레트 크기 예산
제한 팔레트가 응집의 핵심이다(`STY-PAL-LIMITED`). 작은 웹게임 권장 총색 수:
- **T0~T1:** 16~24색(램프 3~4개 + 중립 + 역할색). 레트로 미감엔 8~16색.
- **T2~T3:** ~48색 상한(`lintConfig.max_palette_colors`). 그 이상이면 응집이 흐려지고 생성 도구 시드가 흔들린다.
- 색을 *늘리기*보다 *램프를 재사용*한다 — 돌·금속·그림자가 같은 cool 램프를 공유하면 통일감이 생긴다.

## `STY-SCOPE-MOOD-INTENSITY` — 무드 강도는 단계적
무드(어둠·안개·블룸·그레이딩)는 0(없음)→강(호러)까지 *연속*이다. 게임플레이 가독성을 해치지 않는 선에서 가장 약한 강도부터 올린다 — 어둠이 너무 짙으면 적·함정이 안 보이고(공정성 위반), 블룸이 과하면 HUD 가 번진다(`STY-MOOD-FX-RESTRAINT`). 무드는 *분위기*를 위한 것이지 *가독성을 희생*하는 게 아니다.

## `STY-SCOPE-GENRE-FIT` — 장르 정합 디폴트
장르 스캐폴드가 디폴트 매체·무드·티어를 제안한다(INDEX 빠른 처방 표). 예: 플랫포머→픽셀 밝은 야외 T1~T2, 던전/호러→픽셀 warm-dungeon/night T3, 캐주얼 퍼즐→벡터/픽셀 파스텔 T0~T1. 디폴트에서 출발해 게임 정체성으로 비튼다 — 장르를 *거스르는* 스타일(밝은 호러)은 의도가 분명할 때만.

---

## 안티패턴 (섞지 말 것)
- **과설계:** 한 판 1~3분 게임에 풀 스타일가이드 + 라이팅 + 포스트FX. T0/T1로 충분한지 먼저 묻기.
- **매체 혼용:** 픽셀 캐릭터 + 매끈 벡터 배경(의도된 대비가 아니면 응집 깨짐).
- **render 불일치:** medium=pixel 인데 game.js `pixelArt:false`(픽셀이 뭉개짐).
- **팔레트 폭발:** 48색 초과·램프 미재사용(통일감 상실).
- **가독성 희생 무드:** 적·함정이 안 보일 만큼 어둠·안개·블룸.

## 출처
- 제한 팔레트·매체 구분·복잡도 게이트(인디 2D 아트·도트 통념)를 작은 웹게임용으로 정리. [ability-design/scope-complexity.md](../../wgf-ability-architect/reference/ability-design/scope-complexity.md)의 복잡도 사다리·디폴트 최소·한 게임 한 핵심모델 패턴을 비주얼 스타일 도메인으로 적응.
