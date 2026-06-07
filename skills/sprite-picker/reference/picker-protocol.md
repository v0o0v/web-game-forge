# 피커 프로토콜 — 대상에 이미지를 배정받고 자동 회수

사용자가 **브라우저에서 적용 대상(슬롯)에 이미지를 직접 배정**하고, "선택 완료"를 누르면 Claude 가
그 선택을 **자동으로 가져온다**. 피커는 `skills/sprite-picker/picker/` 의 정적 페이지 + 컴패니언 서버.

## 전체 흐름

```
① 대상·후보 추림 → ② data.js 주입 → ③ 컴패니언 서버 서빙 → ④ 사용자 탐색·슬롯 배정 → ⑤ 선택 완료(자동 회수) → 적용
```

## 탐색 모델 (v3) — 하단 카테고리 탭

피커는 하단에 4개 카테고리 탭을 둔다:

| 탭 | 보여주는 것 | 비고 |
|----|-------------|------|
| **추천** | `targets`/`request` 와 매칭 점수 상위(전 그룹 혼합) | 피커가 **런타임 계산**(`scoreItem`). 상위 `recommendLimit` 개. |
| **전체** | `catalog` 를 **웹사이트별 아코디언 → 팩 카드** | `sourceId` 로 그룹핑. 팩 카드 "펼치기"로 대형 미리보기. |
| **다운로드** | `library`(받아 둔 것)를 **풀(전체)로** | 미리보기 아님. 시트는 프레임 분해(개별 선택). |
| **후보** | `candidate`(절차 제안·로컬) | |

- **미리보기 vs 풀뷰.** catalog/추천 카드는 *미리보기*(커밋 썸네일/원격/플레이스홀더). 다운로드 카드는
  *풀 렌더* — SVG/PNG 풀해상도, 스프라이트시트는 브라우저 canvas 로 프레임을 분해해 보여주고 **개별
  프레임을 골라** 슬롯에 배정한다(`frame` 인덱스가 선택에 포함됨).
- **추천 기준.** `targets[].tags/contentTypes/style`(+`request`)과 카드 메타를 매칭한 점수순. 슬롯이
  없으면 `request`, 그것도 없으면 cc0·다운로드분 우선. → 인터뷰에서 슬롯 메타를 정확히 채울수록 추천이 좋아진다.

### ① 대상(targets) + 후보(광범위) + 웹사이트(sources) 추림
- **targets** = 적용 대상 슬롯. 각 대상에 **이름 + 설명**(+추천용 `tags/contentTypes/style`)을 단다
  (예: `{id:"player", name:"플레이어", description:"주인공 — 걷기/점프", tags:["player","run"], contentTypes:["character"], style:"pixel"}`).
  사용자는 *순서를 외워 찍는 대신* 슬롯에 이미지를 배정한다. 대상은 인터뷰 SP3·SP6에서 도출.
- **sources** = 웹사이트 메타(`{id,name,url,safetyTier}`). '전체' 탭 아코디언 헤더. `catalog/sources.json` 에서 추린다.
- **후보는 광범위하게** — `catalog/packs.json`(각 카드에 **`sourceId` 필수**) + `assets-library` 를 **수십~수백 개**
  넣고 사용자가 웹사이트→팩, 또는 검색·필터로 좁히게 한다. 팩의 **`preview`**(커밋 썸네일) 또는 `previewUrl`을
  채워 시각 변별을 높인다(없으면 플레이스홀더 자동). 커밋 썸네일은 [`sprite-catalog-refresh`](../../sprite-catalog-refresh/SKILL.md)
  의 `catalog/prefetch.mjs` 가 미리 받아 둔다(실행 시 빠름).
- targets 를 생략하면 **프리 모드**(자유 다중 선택)로 동작한다(하위호환).

### ② `data.js` 주입 (경로/CORS 회피)
피커는 `window.SPRITE_PICKER_DATA` 를 우선 읽는다. 같은 폴더에 `data.js` 를 쓴다(`data.example.js` 템플릿).

```js
// picker/data.js
window.SPRITE_PICKER_DATA = {
  title: "스프라이트 피커 — <게임명>",
  request: "…요청 요약…",
  targets: [ {id, name, description}, … ],     // 적용 대상 슬롯
  tiers: { /* sources.json.tiers */ },
  catalog: [ /* 광범위 후보 카드 */ ],
  library: [ /* 이전 사용분 */ ],
  candidate: [ /* 절차 제안·로컬 파일 */ ]
};
```
> 카드/대상 필드는 [catalog-schema.md](./catalog-schema.md) "피커 주입 데이터" 참고. `data.js` 는 세션
> 산출물이라 커밋하지 않는다(`.gitignore`).

### ③ 컴패니언 서버로 서빙 (`serve.mjs`)
정적 `python -m http.server` 는 GET 만 되어 **자동 회수가 안 된다**(사용자 브라우저의 localStorage 는
Claude 가 못 읽음). 대신 POST 를 받는 컴패니언 서버를 띄운다:

```bash
node skills/sprite-picker/picker/serve.mjs
```
→ `http://127.0.0.1:8770/` (피커). 환경변수 `PORT`, `SPRITE_PICKER_OUT`(선택 저장 경로, 기본
`<cwd>/.sprite-picker-selection.json`), `SPRITE_PICKER_WS`(/ws/ 작업공간 루트, 기본 `<cwd>`),
`SPRITE_PICKER_NO_OPEN`(자동 오픈 비활성화). 이 서버는 피커를 서빙하고 `POST /__sprite_picker_submit` 을
받아 선택을 **파일로 저장**한다. (background 로 실행.) **준비되면 사용자 브라우저를 자동으로 연다.**
- **정적 마운트 3개:** `/`(피커 디렉터리), **`/catalog/`**(커밋 썸네일 등 `catalog/`), **`/ws/`**(작업공간
  루트 — 다운로드분 풀뷰용 `assets-library/`·`games/<slug>/assets/`…). `/ws/` 는 닷파일(.git 등)·traversal 차단.
- 정적 `python -m http.server` 도 가능하나 그땐 자동 회수·풀뷰(/ws/)·커밋 썸네일(/catalog/)이 안 되므로 폴백 전용.

### ④ 사용자 슬롯 배정
- **슬롯 클릭 → 활성화 → 갤러리 이미지 클릭** 하면 그 슬롯에 배정되고 다음 빈 슬롯으로 자동 이동.
- 또는 **이미지를 슬롯으로 드래그&드롭**.
- 슬롯의 ✕ 로 해제. 진행도(예: `4/6`)와 배정 미리보기가 보인다.
- 메모(`note`)에 색 보정 등 세부 요청을 남길 수 있다.

### ⑤ 선택 완료 — 자동 회수 (2-way)
사용자가 **"✓ 선택 완료"** 를 누르면:

**A. 자동(권장).** 피커가 `POST` (data.`submitUrl` 또는 `/__sprite_picker_submit`) → `serve.mjs` 가 선택 JSON 을
`SPRITE_PICKER_OUT`(기본 `.sprite-picker-selection.json`)에 저장 → **Claude 가 그 파일을 Read** 한다.
사용자에게는 **비차단 토스트**("✅ 전송됨")만 잠깐 뜨고 사라진다(화면을 막는 팝업 없음). 붙여넣기 불필요.
> `submitUrl` 을 컴패니언 서버 절대 URL(예: `http://127.0.0.1:8770/__sprite_picker_submit`)로 두면 정적
> 서버 탭에서 열려 있어도 제출이 컴패니언 서버로 가 회수된다(CORS 허용됨).

> 회수: 사용자가 "다 골랐어/선택 완료"라고 하면 `.sprite-picker-selection.json` 을 Read 한다(없으면
> 잠깐 대기 후 재시도, 또는 `GET /__sprite_picker_status` 로 저장 여부 확인). preview MCP 환경이면
> `window.__spritePickerSelection()` eval 로도 읽을 수 있다.

**B. 폴백.** POST 가 막히면 피커가 자동으로 선택 코드를 **클립보드에 복사**하고 토큰 박스를 펼치며
비차단 토스트("📋 붙여넣어 주세요")로 안내한다 → 사용자가 채팅에 붙여넣기. (막는 오버레이는 쓰지 않는다.)

> **갤러리 페이지네이션:** 후보가 `pageSize`(기본 24)보다 많으면 **"더 가져오기"** 버튼으로 더 로드한다.
> 후보를 광범위하게 넣어도 한 번에 다 렌더하지 않아 가볍다. 필터/탭/검색 변경 시 페이지는 처음으로 리셋된다.

선택 JSON (v3, 어사인 모드):
```json
{
  "version": 3,
  "request": "…",
  "note": "코인은 노란 톤으로",
  "assignments": [
    { "targetId": "player", "targetName": "플레이어",
      "image": { "id":"kenney-pixel-platformer", "name":"Pixel Platformer", "group":"catalog",
                 "license":"CC0-1.0", "safetyTier":"cc0", "sourceId":"kenney", "sourceName":"Kenney.nl",
                 "url":"…", "downloadUrl":"…", "style":"pixel", "contentTypes":["character","tileset"] } },
    { "targetId": "coin", "targetName": "코인",
      "image": { "id":"hero-sheet", "name":"히어로 시트", "group":"library",
                 "full":"assets-library/hero/sheet.png", "frameConfig":{"frameWidth":16,"frameHeight":16},
                 "frame": 25, "license":"CC0-1.0", "safetyTier":"cc0" } }
  ],
  "unassignedTargets": [ { "targetId":"enemy", "targetName":"적" } ]
}
```
- 다운로드분(`group:"library"`) 선택은 `full`(작업공간 루트 기준 경로)을 포함하고, **개별 프레임을 골랐으면
  `frame` 인덱스**가 붙는다(`frameConfig` 와 함께 `load.spritesheet` 후 그 프레임 사용).
- 프리 모드면 `assignments` 대신 `selected: [ …image… ]`.

## 적용
회수한 선택을 [sourcing.md](./sourcing.md) 절차로 처리한다 — **`assignments[].targetId` → 그 대상에
`image` 를 적용**(다운로드·벤더링·로드·매핑). `unassignedTargets` 가 있으면 절차 생성으로 채우거나
다시 묻는다. `note` 의 세부 요청을 반영하고 검증한다. 적용한 에셋은 `assets-library/` 에 누적.

## 주의
- `safetyTier` 가 `mixed-per-item`/`avoid` 인 이미지가 배정되면 적용 전 항목 라이선스 확인 또는 제외.
- 자동 회수 파일이 비었거나 0 배정이면 적용하지 말고 다시 묻는다.
- 사용자가 끝내 못 고르겠다고 하면 절차 생성(추천 기본값)으로 폴백 — 막다른 길을 만들지 않는다.
