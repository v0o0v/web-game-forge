# 피커 프로토콜 — 시각적 선택을 주고받는 법

사용자가 **브라우저에서 스프라이트를 눈으로 구분해 클릭 선택**하게 하고, 그 선택을 Claude 가
다시 읽어 게임에 적용하는 왕복 절차. 피커는 `skills/sprite-picker/picker/` 의 정적 페이지다.

## 전체 흐름 (5단계)

```
① 후보 추림 → ② data.js 주입 → ③ 로컬 서빙 → ④ 사용자 클릭 선택 → ⑤ 선택 회수 → 적용
```

### ① 후보 추림
인터뷰([sprite-interview.md](./sprite-interview.md))로 좁힌 조건(스타일·콘텐츠 타입·라이선스)으로
`catalog/packs.json` + `assets-library/library.json` 에서 보여줄 항목을 고른다. 절차 생성 제안이나
사용자가 준 로컬 파일은 `candidate` 그룹으로 넣는다. **항상 한 화면에 다 보여주려 하지 말고**
요청에 맞게 20~40개로 추려 시각적 변별이 쉽게 한다.

### ② `data.js` 주입 (경로/CORS 문제 회피)
피커는 `window.SPRITE_PICKER_DATA` 를 우선 읽는다. 같은 폴더에 `data.js` 를 써서 주입한다
(`picker/data.example.js` 가 템플릿). fetch 가 아니라 전역 주입이라 `file://`·`http://` 모두 안전.

```js
// picker/data.js  (Claude 가 매 세션 생성)
window.SPRITE_PICKER_DATA = {
  title: "스프라이트 피커 — <게임명>",
  subtitle: "플레이어·적·코인 후보입니다. 쓰고 싶은 걸 클릭하세요.",
  request: "슈퍼마리오류 픽셀 플랫포머. 플레이어/슬라임 적/코인 필요.",
  tiers: { /* sources.json 의 tiers 그대로 */ },
  catalog: [ /* packs.json 부분집합 (정규화 카드) */ ],
  library: [ /* library.json items 중 관련분 */ ],
  candidate: [ /* 절차 생성 제안 또는 사용자가 준 로컬 파일 */ ]
};
```

> ⚠ `data.js` 는 **세션 산출물**이라 보통 커밋하지 않는다(`.gitignore` 의 `skills/sprite-picker/picker/data.js`).
> 항목 카드 필드는 [catalog-schema.md](./catalog-schema.md) "피커 주입 데이터" 참고.

### ③ 로컬 서빙
정적 fetch 가 필요 없으므로 `file://` 로 바로 열어도 되지만, 선택 회수(⑤)에 preview MCP 를 쓰려면
서버로 띄우는 편이 안정적이다.

```bash
# 프로젝트 루트에서
python -m http.server 8766
```
→ `http://127.0.0.1:8766/skills/sprite-picker/picker/index.html`

또는 preview MCP: `preview_start` 로 위 경로를 띄운다.

### ④ 사용자 클릭 선택
사용자가 카드를 클릭하면 선택 토글, 하단 트레이에 모인다. 선택은 **매번
`localStorage['spritePickerSelection']` 에 자동 저장**되고, 메모 textarea 에 적용 지시를 남길 수 있다.
사용자가 "다 골랐어요"라고 하면 ⑤로.

### ⑤ 선택 회수 (2-way: MCP 우선, 붙여넣기 폴백)

**A. preview MCP 로 직접 읽기(권장).** 페이지가 노출한 전역 훅을 eval:
```
preview_eval:  window.__spritePickerSelection()
```
반환값은 아래 JSON 문자열. `preview_snapshot` 으로 선택 트레이의 토큰 textarea 를 읽어도 된다.

**B. 복사-붙여넣기 폴백.** MCP 로 못 읽으면 사용자에게 트레이의 **"선택 코드 복사"** 버튼을 눌러
채팅창에 붙여넣어 달라고 한다.

선택 JSON:
```json
{
  "version": 1,
  "request": "슈퍼마리오류 …",
  "note": "첫 줄 캐릭터를 플레이어로, 코인은 노란색으로 톤 맞춰줘.",
  "selected": [
    { "id": "kenney-pixel-platformer", "name": "Pixel Platformer", "group": "catalog",
      "license": "CC0-1.0", "safetyTier": "cc0", "sourceName": "Kenney.nl",
      "url": "https://kenney.nl/assets/pixel-platformer",
      "downloadUrl": "https://kenney.nl/...", "style": "pixel", "contentTypes": ["tileset","character"] }
  ]
}
```

## 적용
회수한 선택을 [sourcing.md](./sourcing.md) 절차로 처리한다:
- `catalog`/`candidate(웹)` → 온디맨드 다운로드 → `games/<slug>/assets/` 벤더링 → `assets.json` 등록
  → `this.load.spritesheet/atlas/image` 로 로드 → `assets-library/` 에 누적.
- `library` → 이미 로컬에 있으니 바로 참조/복사.
- `candidate(절차)` → [`sprite-forge`](../../sprite-forge/SKILL.md) / [`vector-graphics`](../../vector-graphics/SKILL.md) 로 위임.
- `note` 의 적용 지시(어느 스프라이트를 어느 게임 객체에, 색 보정 등)를 반영하고 검증한다.

## 주의
- 선택이 0개면 적용하지 말고 다시 묻는다(빈 선택은 회수 실패일 수 있음).
- `safetyTier` 가 `mixed-per-item`/`avoid` 인 선택이 섞이면 적용 전에 항목 라이선스를 확인하거나 제외한다.
- 사용자가 끝내 못 고르겠다고 하면 절차 생성(추천 기본값)으로 폴백한다 — 막다른 길을 만들지 않는다.
