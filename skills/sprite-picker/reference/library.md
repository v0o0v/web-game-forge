# 로컬 스프라이트 라이브러리 — 이전 사용분 보관·재사용

사용자가 한 번 쓴 스프라이트는 **로컬에 보관해 언제든 다시 고를 수 있게** 한다. 피커의
**"이전 사용"** 탭이 이 라이브러리를 보여준다.

## 위치 — 작업공간 루트의 `assets-library/`

```
<작업공간 루트>/assets-library/
├── library.json                 # 레지스트리 (스키마: catalog-schema.md §3)
├── <item-id>/
│   ├── sheet.png                # 실제 스프라이트시트/이미지(벤더링)
│   ├── sheet.json               # 아틀라스 JSON(있으면)
│   └── thumb.png                # 피커용 썸네일(있으면; 없으면 플레이스홀더 자동)
└── …
```

- **플러그인이 아니라 게임 작업공간에 둔다** — 설치처마다 다르고, 사용자 자산이 쌓이는 곳.
  이 저장소(WebGameForge 자체)에서는 루트의 `assets-library/` 가 그 자리다.
- 카탈로그(`skills/sprite-picker/catalog/`, 플러그인 동봉·캐싱)와 **역할이 다르다**: 카탈로그는
  "고를 수 있는 후보 목록", 라이브러리는 "이미 내가 쓴 것".

## 누적 시점
경로 A/B/C 로 에셋을 **실제 적용할 때마다** `library.json` 에 항목을 추가/갱신한다([sourcing.md](./sourcing.md)).
- 새 에셋: `<item-id>/` 폴더에 파일 복사 + 항목 추가.
- 이미 있던 에셋: `usedIn` 에 이번 게임 슬러그만 추가(중복 저장 안 함).

## 항목 필드 (요약)
`id, name, sourceId(카탈로그 id|"local"|"procedural"), license, safetyTier, style, contentTypes[],
tags[], files[], frameConfig{frameWidth,frameHeight}, thumbnail, usedIn[], addedAt`. 전체는
[catalog-schema.md](./catalog-schema.md) §3.

## 피커에 태우기
"이전 사용" 탭은 `library.json` 의 items 를 `group:"library"` 카드로 받는다. data.js 생성 시:
```js
library: libraryJson.items
  .filter(it => /* 이번 요청 스타일/타입에 맞는 것 */)
  .map(it => ({
    id: it.id, name: it.name, sourceName: it.sourceId, license: it.license,
    safetyTier: it.safetyTier, style: it.style, contentTypes: it.contentTypes,
    tags: it.tags, thumbnail: it.thumbnail || ""    // 없으면 플레이스홀더 자동
  }))
```

## 재사용 흐름
1. SP1(출처)에서 사용자가 "이전 쓰던 거"를 고르거나, 인터뷰 중 "예전 그 캐릭터"를 언급하면 이 탭을 연다.
2. 라이브러리가 비어 있으면(첫 사용) 피커가 안내 문구를 보여주고 카탈로그/절차 생성으로 유도한다.
3. 선택 → 경로 C 로 적용(다운로드 없이 즉시).

## 정리·이식
- 라이브러리는 사용자 자산이므로 함부로 지우지 않는다. 사용자가 "정리해줘" 할 때만 미사용 항목을 제안.
- 다른 프로젝트로 옮기려면 `assets-library/` 폴더째 복사하면 된다(자기완결적).
