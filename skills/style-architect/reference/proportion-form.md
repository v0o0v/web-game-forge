# 비율·폼 — 실루엣과 형태 언어 (`STY-FORM-*`)

> 색 다음으로 스타일을 정하는 건 *형태*다 — 캐릭터가 통통한 chibi 인지 길쭉한지, 외곽선이 있는지, 작은 화면에서
> 실루엣만으로 구분되는지. 여기서 비율·실루엣 우선·라인웨이트·아웃라인 규칙·폼 언어 일관을 정한다.
> style.json `proportions`·`line`. 인터뷰 S4. T1+(매체가 픽셀일 때 특히 중요).

---

## `STY-FORM-SILHOUETTE-FIRST` — 실루엣 먼저 (북극성)
캐릭터·적·픽업은 **색을 빼도 실루엣만으로 구분**돼야 한다. 작은 화면·색각·빠른 인지의 진실은 윤곽이다. 디테일보다 외곽 형태를 먼저 잡는다 — 플레이어는 둥글고, 적은 뾰족하고, 픽업은 작고 반짝이는 식으로 *형태가 역할을 말하게*. 이 슬롯이 생성 도구(`visual.silhouette`)로 전달된다([cohesion-tools.md](./cohesion-tools.md) 어댑터).

## `STY-FORM-PROPORTION` — 비율: head_to_body 로 톤을 정한다
캐릭터 비율이 게임 톤을 통째로 바꾼다 — chibi/cute(머리 크게, 1:1~1:1.5)는 귀엽고 친근, 리얼(1:6~1:8)은 진지. 작은 웹게임·픽셀은 보통 **chibi/cute**(작은 캔버스에서 표정·실루엣이 살아남). style.json:
```jsonc
"proportions": { "head_to_body": "1:1.2", "silhouette": "chunky-rounded", "min_feature_px": 2 }
```
한 게임 안에서 비율은 일관되게 — 플레이어가 chibi 면 적·NPC 도 같은 비율 언어(`STY-FORM-FORM-LANGUAGE`).

## `STY-FORM-MIN-FEATURE-PX` — 최소 피처 픽셀 (픽셀 매체)
픽셀 매체에서 *가장 작은 의미 있는 디테일*의 크기를 정한다(`min_feature_px`). 눈·단추·칼날이 1px 면 작은 화면에서 사라진다 — 보통 2px 이상. 이게 캐릭터의 최소 표시 크기(display_px)와 디테일 밀도를 정한다. 너무 작은 피처는 안 읽히고, 너무 크면 투박하다. 벡터 매체는 이 규칙 대신 곡률·획 굵기로.

## `STY-FORM-LINE-WEIGHT` — 라인웨이트 일관
아웃라인을 쓴다면 굵기(`line.weight_px`)를 게임 전체에서 일정하게 — 보통 픽셀 매체 1px. 캐릭터마다 외곽선 굵기가 다르면 응집이 깨진다. 굵은 라인(2px+)은 카툰·볼드한 톤, 얇은 라인(1px)은 섬세한 톤.

## `STY-FORM-OUTLINE-RULE` — 아웃라인 규칙: none / selective / full
외곽선 처리 방식을 하나로 고정한다(`line.outline`):
- **`none`:** 외곽선 없음. 색 경계로만 형태(매끈·소프트한 톤·벡터에 흔함).
- **`selective`(권장 디폴트):** 바깥 윤곽만, 내부 디테일은 색 경계로. 깔끔하면서 실루엣 강조. 대부분 픽셀 게임의 선택.
- **`full`:** 모든 형태에 외곽선(코믹·셀 애니 톤).
- **아웃라인 색(`line.outline_color`):** 순수 검정보다 *채워색의 더 어두운 버전*(`"darker-of-fill"`) 이나 중립 어두운 색이 자연스럽다(`STY-PAL-NEUTRALS`).

## `STY-FORM-FORM-LANGUAGE` — 폼 언어 일관 (한 게임 한 형태 어휘)
둥근 폼(친근·귀여움) vs 각진 폼(날카로움·위협)을 게임 톤에 맞춰 하나로 정하고, 모든 에셋이 그 어휘를 따른다(`STY-SCOPE-ONE-STYLE`). 단, *의미 대비*는 허용 — 플레이어는 둥글(아군), 적은 각지게(위협)처럼 형태로 역할을 부호화하면 가독에 도움(`STY-FORM-SILHOUETTE-FIRST`). 일관 ≠ 똑같음, 같은 어휘 안의 변주.

## `STY-FORM-DISPLAY-GRID` — display_px: 표시 크기 그리드
스프라이트·아이콘의 표준 표시 크기를 정한다(예: 캐릭터 16/24/32px, 아이콘 32/48px). 이게 그리드가 돼 모든 에셋이 정렬되고, 생성 도구 시드와 HUD 레이아웃이 안정된다. 픽셀 매체는 이 그리드의 정수배로 스케일(`render.roundPixels:true`)해야 픽셀이 뭉개지지 않는다(`STY-SCOPE-MEDIUM-RENDER-MATCH`).

## `STY-FORM-READABLE-SMALL` — 작은 크기에서 읽히게
모든 폼 결정의 검증 기준: *실제 게임 표시 크기로 줄였을 때 읽히는가*. 캐릭터를 32px 로 줄였을 때 머리·몸·역할이 구분되나, 아이콘을 24px 로 줄였을 때 무엇인지 아나. 큰 캔버스에서 예쁜 게 아니라 *게임 안 크기*에서 작동해야 한다 — 픽셀 미리보기는 실제 크기로.

---

## 안티패턴
- **실루엣 무시:** 디테일만 화려하고 윤곽으로 구분 안 됨(작은 화면·색각에서 붕괴).
- **비율 불일치:** 플레이어 chibi, 적은 리얼(폼 언어 깨짐).
- **라인 굵기 제각각:** 에셋마다 외곽선 굵기 다름.
- **순수 검정 아웃라인:** `#000` 외곽선이 거칠다(`STY-PAL-NEUTRALS` 위반).
- **min_feature 무시:** 1px 디테일이 게임 크기에서 사라짐.

## 출처
- 실루엣 우선·chibi 비율·라인웨이트·아웃라인 처리(2D 캐릭터 아트·도트 통념)를 작은 웹게임·생성 도구 핸드오프용으로 정리. 실루엣 우선·작은 크기 진실은 [ability-design/presentation-ux.md](../../ability-architect/reference/ability-design/presentation-ux.md) `UX-SILHOUETTE-FIRST`·item-architect visual 슬롯과 정합.
