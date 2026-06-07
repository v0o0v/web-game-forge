# 피커 프로토콜 — 대상에 이미지를 배정받고 자동 회수

사용자가 **브라우저에서 적용 대상(슬롯)에 이미지를 직접 배정**하고, "선택 완료"를 누르면 Claude 가
그 선택을 **자동으로 가져온다**. 피커는 `skills/sprite-picker/picker/` 의 정적 페이지 + 컴패니언 서버.

## 전체 흐름

```
① 대상·후보 추림 → ② data.js 주입 → ③ 컴패니언 서버 서빙 → ④ 사용자 슬롯 배정 → ⑤ 선택 완료(자동 회수) → 적용
```

### ① 대상(targets) + 후보(광범위) 추림
- **targets** = 적용 대상 슬롯. 각 대상에 **이름 + 설명**을 단다(예: `{id:"player", name:"플레이어",
  description:"주인공 — 걷기/점프"}`). 사용자는 *순서를 외워 찍는 대신* 슬롯에 이미지를 배정한다.
  대상은 인터뷰 SP3(에셋 목록)·SP6(적용 매핑)에서 도출한다.
- **후보는 광범위하게** 보여준다 — `catalog/packs.json` + `assets-library` + 후보를 **수십~수백 개**
  넣고, 사용자가 검색·필터(스타일/타입/라이선스)로 좁히게 한다. 너무 적게 주지 않는다. 실제 이미지
  썸네일(`thumbnail` URL)을 최대한 채워 시각 변별을 높인다(없으면 플레이스홀더 자동).
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
`<cwd>/.sprite-picker-selection.json`), `SPRITE_PICKER_NO_OPEN`(자동 오픈 비활성화). 이 서버는 피커를
서빙하고 `POST /__sprite_picker_submit` 을 받아 선택을 **파일로 저장**한다. (background 로 실행.)
**준비되면 사용자 브라우저를 자동으로 연다** — 별도로 URL 을 열어달라고 하지 않아도 된다.

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

선택 JSON (v2, 어사인 모드):
```json
{
  "version": 2,
  "request": "…",
  "note": "코인은 노란 톤으로",
  "assignments": [
    { "targetId": "player", "targetName": "플레이어",
      "image": { "id":"kenney-pixel-platformer", "name":"Pixel Platformer", "license":"CC0-1.0",
                 "safetyTier":"cc0", "sourceName":"Kenney.nl", "url":"…", "downloadUrl":"…",
                 "style":"pixel", "contentTypes":["character","tileset"] } }
  ],
  "unassignedTargets": [ { "targetId":"enemy", "targetName":"적" } ]
}
```
프리 모드면 `assignments` 대신 `selected: [ …image… ]`.

## 적용
회수한 선택을 [sourcing.md](./sourcing.md) 절차로 처리한다 — **`assignments[].targetId` → 그 대상에
`image` 를 적용**(다운로드·벤더링·로드·매핑). `unassignedTargets` 가 있으면 절차 생성으로 채우거나
다시 묻는다. `note` 의 세부 요청을 반영하고 검증한다. 적용한 에셋은 `assets-library/` 에 누적.

## 주의
- `safetyTier` 가 `mixed-per-item`/`avoid` 인 이미지가 배정되면 적용 전 항목 라이선스 확인 또는 제외.
- 자동 회수 파일이 비었거나 0 배정이면 적용하지 말고 다시 묻는다.
- 사용자가 끝내 못 고르겠다고 하면 절차 생성(추천 기본값)으로 폴백 — 막다른 길을 만들지 않는다.
