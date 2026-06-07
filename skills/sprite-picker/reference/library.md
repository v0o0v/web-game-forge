# 로컬 스프라이트 라이브러리 — 이전 사용분 보관·재사용

사용자가 한 번 쓴 스프라이트는 **로컬에 보관해 언제든 다시 고를 수 있게** 한다. 피커의
**"이전 사용"** 탭이 이 라이브러리를 보여준다.

## 위치 — 작업공간 루트의 `assets-library/`

```
<작업공간 루트>/assets-library/
├── library.json                 # 레지스트리 (스키마: catalog-schema.md §3)
├── <packId>/                    # 팩 다운로드 후 생성 (fetch-pack + analyze-pack)
│   ├── raw/                     # fetch-pack.mjs 가 받은 원본(압축 해제 결과). 분석에만 쓰고 커밋 안 함.
│   ├── <sheetSlug>.png          # 분석이 채택한 시트(원본 복사 또는 그대로). 커밋됨.
│   ├── <sheetSlug>.thumb.png    # 피커용 썸네일. 커밋됨.
│   ├── <sheetSlug>.atlas.json   # 동봉/생성 아틀라스(있으면). 커밋됨.
│   ├── analysis.json            # 이 팩의 분석 메타. 커밋됨. (스키마: catalog-schema.md §4)
│   └── README.md                # (선택) 팩 출처 노트. 커밋됨.
└── …
```

- **플러그인이 아니라 게임 작업공간에 둔다** — 설치처마다 다르고, 사용자 자산이 쌓이는 곳.
  이 저장소(WebGameForge 자체)에서는 루트의 `assets-library/` 가 그 자리다.
- 카탈로그(`skills/sprite-picker/catalog/`, 플러그인 동봉·캐싱)와 **역할이 다르다**: 카탈로그는
  "고를 수 있는 후보 목록", 라이브러리는 "이미 내가 쓴 것".
- `raw/` 와 바이너리(`.png`, `.jpg`, `.thumb.png` 등)는 `.gitignore` 로 커밋 제외.
  `library.json`, `analysis.json`, `README.md` 는 커밋 유지(메타데이터).

## 팩 다운로드→분석→편집→영속 플로우

피커에서 "다운로드" 버튼을 클릭하면 다음 순서로 처리된다:

```
1. 다운로드 버튼 클릭
   → POST /__sprite_picker_download_request (safetyTier cc0 게이트)
   → .sprite-picker-downloads.json 에 status:"queued" 로 적재

2. 사용자가 채팅으로 돌아오면 Claude(리드)가 큐를 읽고:
   node skills/sprite-picker/catalog/fetch-pack.mjs --pack <packId>
   → assets-library/<packId>/raw/ 에 원본 다운로드 + ZIP 해제

3. 분석 실행:
   node skills/sprite-picker/catalog/analyze-pack.mjs --pack <packId>
   → 분석 방법 결정(atlas > grid > alpha > single)
   → assets-library/<packId>/<sheetSlug>.png + .thumb.png 생성
   → library.json 에 항목 upsert (analysisVersion:2, sourcePackId 포함)
   → assets-library/<packId>/analysis.json 기록
   → .sprite-picker-downloads.json 의 status → "done"

4. 편집기 모달(브라우저)에서 항목 수동 조정:
   - frameConfig(frameWidth/height/margin/spacing) 수정
   - frames[] 자유 영역 추가/삭제/이름 지정
   - excludedFrames 토글(빈 그리드 칸 제외)
   - anims[] 애니메이션 정의
   - 항목 name 변경
   → POST /__sprite_picker_library_edit {id, patch}
   → library.json + analysis.json 에 반영(analysisVersion:2 유지)

5. 영속:
   - library.json / analysis.json 커밋(메타데이터, 재생성 가능한 상태로 보존)
   - raw/ 및 바이너리는 커밋 제외(.gitignore)
```

**한 팩 = 라이브러리 항목 N개.** 한 팩에서 여러 시트/이미지 그룹이 나올 수 있다.
그 경우 시트마다 항목 1개가 생성되고, 모두 같은 `sourcePackId` 를 공유한다.

**편집기에서 바꿀 수 있는 필드:**
- `frameConfig.frameWidth` / `frameHeight` / `margin` / `spacing` — 균일 그리드 조정
- `frames[]` — 자유 영역 추가·삭제·이름 지정·리사이즈·병합
- `excludedFrames[]` — 그리드 모드에서 빈/제외 프레임 인덱스 토글
- `anims[]` — 애니메이션 정의(이름, 프레임 목록, frameRate, repeat)
- `name` — 항목 이름 변경

## 누적 시점
경로 A/B/C 로 에셋을 **실제 적용할 때마다** `library.json` 에 항목을 추가/갱신한다([sourcing.md](./sourcing.md)).
- 새 에셋(팩 다운로드): `<packId>/` 폴더에 파일 생성 + 항목 추가(`analysisVersion:2`).
- 새 에셋(직접 소싱): `<item-id>/` 폴더에 파일 복사 + 항목 추가.
- 이미 있던 에셋: `usedIn` 에 이번 게임 슬러그만 추가(중복 저장 안 함).

## 항목 필드 (요약)
`id, name, sourceId(카탈로그 id|"local"|"procedural"), sourcePackId(★신규, 팩 id),
license, safetyTier, style, contentTypes[], tags[], files[], full(★신규, 대표 경로),
frameConfig{frameWidth,frameHeight,margin,spacing}, frames[](★신규, 비균일 영역),
anims[](★신규), excludedFrames[](★신규), thumbnail, usedIn[], downloaded(★신규),
analysisVersion(★신규), addedAt`. 전체는 [catalog-schema.md](./catalog-schema.md) §3.

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
