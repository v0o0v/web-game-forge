# 카탈로그·라이브러리 데이터 스키마

sprite-picker 가 쓰는 3개 데이터 파일의 형식. 모두 JSON. **카탈로그는 플러그인에 캐싱(커밋)되어
스킬이 매번 웹을 뒤지지 않게 한다.** 카탈로그 갱신은 [`sprite-catalog-refresh`](../../sprite-catalog-refresh/SKILL.md)
가 담당한다(사용자가 명시적으로 요청할 때만 웹 재조사).

## 안전 티어 (`safetyTier`) — 모든 항목 공통

| 티어 | 의미 | 기본 정책 |
|------|------|-----------|
| `cc0` | CC0/퍼블릭도메인 | ✅ 표기 불필요, 자유 사용·번들·재배포 |
| `permissive-attribution` | CC-BY·OFL 등 표기 필요 | ⚠️ `CREDITS.txt` 표기 시 허용 |
| `mixed-per-item` | 사이트 전체가 아닌 **항목별** 라이선스 | ⚠️ 항목마다 라이선스 직접 확인 후에만 |
| `avoid` | ARR·불명·재배포 제한 | ❌ 사용 금지 |

> `assets.json`(루트)의 `policy.allow` 와 정합: 기본 허용은 `cc0`. `permissive-attribution` 은
> attribution 기록 시 허용. `mixed-per-item`·`avoid` 는 게이트에서 막힌다. 최종 판정은
> [`ip-license-guard`](../../ip-license-guard/SKILL.md).

---

## 1) `catalog/sources.json` — 큐레이션된 소스 목록 (캐싱·커밋)

```jsonc
{
  "schemaVersion": 1,
  "generatedBy": "sprite-catalog-refresh",
  "generatedAt": "2026-06-07",          // 마지막 갱신일 (사람이 읽는 ISO 날짜)
  "tiers": { "cc0": "…", "permissive-attribution": "…", "mixed-per-item": "…", "avoid": "…" },
  "sources": [
    {
      "id": "kenney",                    // 안정적 kebab-case 키
      "name": "Kenney.nl",
      "url": "https://kenney.nl/assets",
      "license": "CC0-1.0",
      "licenseUrl": "https://kenney.nl/...",
      "safetyTier": "cc0",
      "contentTypes": ["character","tileset","ui","spritesheet"],
      "style": ["pixel","vector","flat"],
      "attributionRequired": false,
      "redistribution": "allowed",       // allowed | allowed-with-attribution | restricted | unknown
      "hotlinkOk": false,                // 외부 직접 로드 가능 여부 (대부분 false → 벤더링)
      "termsNotes": "재판매 금지 등 주의점",
      "verifiedAt": "2026-06-07",
      "confidence": "high",              // high | medium | low
      "packs": ["kenney-pixel-platformer","kenney-ui-pack"]  // packs.json 의 id 참조
    }
  ]
}
```

## 2) `catalog/packs.json` — 팩(에셋 묶음) 인덱스 (캐싱·커밋)

```jsonc
{
  "schemaVersion": 1,
  "packs": [
    {
      "id": "kenney-pixel-platformer",
      "sourceId": "kenney",              // sources.json 의 id
      "name": "Pixel Platformer",
      "url": "https://kenney.nl/assets/pixel-platformer",
      "license": "CC0-1.0",
      "safetyTier": "cc0",
      "contentTypes": ["tileset","character","spritesheet"],
      "style": "pixel",                  // 단일 값
      "tags": ["platformer","character","tiles","animation"],
      "tileSize": 18,                    // 픽셀 타일/프레임 크기(있으면)
      "preview": "thumbnails/kenney-pixel-platformer.png", // 커밋된 오프라인 커버(prefetch.mjs 가 채움). /catalog/ 로 서빙.
      "previewUrl": "https://…/preview.png",   // 원격 대표 미리보기 (라이브 탈출구 + "원본 ↗")
      "downloadUrl": "https://kenney.nl/...",  // 실제 다운로드 (온디맨드)
      "attributionRequired": false,
      "notes": "18px 타일. 캐릭터 4프레임 걷기."
    }
  ]
}
```

- **`preview`** 는 [`sprite-catalog-refresh`](../../sprite-catalog-refresh/SKILL.md) 의 `catalog/prefetch.mjs`
  가 CC0 팩의 커버를 받아 `catalog/thumbnails/<pack-id>.png` 로 벤더링한 **오프라인 썸네일**이다(실행 시 빠름).
  `safetyTier:"cc0"` 인 팩만 커밋하고, `mixed-per-item`/`avoid` 는 커밋하지 않고 `previewUrl` 라이브 링크만 둔다.
- `preview` 도 `previewUrl` 도 없으면 피커가 **메타데이터로 플레이스홀더 타일을 즉석 렌더**한다(오프라인 동작 보장).
- `previewUrl` 은 카드의 "원본 ↗" 라이브 링크로도 쓰인다.

## 3) `assets-library/library.json` — 이전에 실제 사용한 스프라이트 (프로젝트 로컬·사용자 작성)

플러그인이 아니라 **게임 작업공간 루트**에 있다(설치처마다 다름). sprite-picker 가 에셋을 실제
적용할 때마다 여기에 누적한다. 피커의 "이전 사용" 탭이 이 파일을 읽는다. 상세는 [library.md](./library.md).

**analysisVersion 2** 로 확장된 항목 스키마(팩 다운로드·분석 후 자동 생성):

```jsonc
{
  "schemaVersion": 1,
  "note": "이 프로젝트에서 실제 사용한 스프라이트. sprite-picker 가 자동 갱신.",
  "items": [
    {
      "id": "kenney-pixel-platformer__tilemap",   // 팩 항목 고유 id. 규칙: "<packId>__<sheetSlug>"
      "name": "Pixel Platformer — tilemap",
      "sourceId": "kenney",              // 카탈로그 출처 id, 또는 "local" | "procedural"
      "sourcePackId": "kenney-pixel-platformer",  // ★신규: 이 항목이 나온 packs.json 의 팩 id. 한 팩에서 나온 항목들이 이 값을 공유.
      "license": "CC0-1.0",
      "safetyTier": "cc0",
      "style": "pixel",
      "contentTypes": ["tileset"],
      "tags": ["platformer","tiles"],
      "files": ["assets-library/kenney-pixel-platformer/tilemap.png"],
      "full": "assets-library/kenney-pixel-platformer/tilemap.png",  // ★신규: 대표 렌더 경로(=files[0]). /ws/ 로 서빙.
      "frameConfig": { "frameWidth": 18, "frameHeight": 18, "margin": 0, "spacing": 0 },  // 균일 그리드. null 이면 비균일
      "frames": [                        // ★신규: 비균일/아틀라스/수동 영역. null 또는 생략이면 frameConfig 그리드 사용. 있으면 우선.
        { "name": "tile_0", "x": 0, "y": 0, "w": 18, "h": 18 }
      ],
      "anims": [                         // ★신규: 명명 애니메이션. frames 인덱스 또는 frames[].name 참조.
        { "name": "run", "frames": [0,1,2,3], "frameRate": 10, "repeat": -1 }
      ],
      "excludedFrames": [12, 13],        // ★신규: 그리드 모드에서 비어 있거나 제외할 프레임 인덱스
      "thumbnail": "assets-library/kenney-pixel-platformer/tilemap.thumb.png",
      "usedIn": ["games/super-runner"],
      "downloaded": true,                // ★신규: fetch-pack + analyze-pack 을 거쳐 로컬에 있음
      "analysisVersion": 2,              // ★신규: 분석 버전. 이 스키마는 version 2.
      "addedAt": "2026-06-08"
    }
  ]
}
```

**frames vs frameConfig 우선순위:**
- `frames[]` 가 있으면 피커는 그 영역을 개별 프레임으로 렌더한다.
- `frames[]` 가 없고 `frameConfig` 가 있으면 균일 그리드로 처리한다.
- 둘 다 없으면 단일 이미지로 취급한다.

**한 팩 = 라이브러리 항목 N개:**
한 카탈로그 팩(`packs.json` 항목)에서 여러 시트/이미지 그룹이 나올 수 있다. 그 경우 시트마다
항목 1개가 생성되고, 모두 같은 `sourcePackId` 를 공유한다.

---

## 4) `assets-library/<packId>/analysis.json` — 팩 분석 메타

`analyze-pack.mjs` 가 생성한다. `library.json` 항목과 정합을 유지하며, 편집기에서 항목을 수정하면
해당 sheet 의 분석 메타도 함께 갱신된다. **커밋 유지 대상**(메타데이터).

```jsonc
{
  "packId": "kenney-pixel-platformer",
  "analyzedAt": "2026-06-08T12:00:00Z",
  "sheets": [
    {
      "id": "kenney-pixel-platformer__tilemap",
      "file": "tilemap.png",
      "method": "atlas",                 // atlas | grid | alpha | single
      "frameConfig": { "frameWidth": 18, "frameHeight": 18 } ,  // null 이면 비균일
      "frames": [ { "name": "tile_0", "x": 0, "y": 0, "w": 18, "h": 18 } ],  // null 이면 frameConfig 그리드
      "anims": [ { "name": "run", "frames": [0,1,2,3], "frameRate": 10, "repeat": -1 } ]
    }
  ]
}
```

---

## 5) 다운로드 큐 `.sprite-picker-downloads.json` (런타임, gitignore)

피커의 "다운로드" 버튼을 클릭하면 서버에 적재되는 큐 파일. Claude 가 채팅으로 돌아올 때 이 파일을
읽고 `fetch-pack.mjs` + `analyze-pack.mjs` 를 실행한다. 완료 후 해당 항목의 `status` 를 `"done"` 으로 갱신.

```jsonc
{
  "version": 1,
  "requests": [
    {
      "packId": "kenney-pixel-platformer",
      "name": "Pixel Platformer",
      "sourceId": "kenney",
      "safetyTier": "cc0",
      "downloadUrl": "https://kenney.nl/assets/pixel-platformer",
      "url": "https://kenney.nl/assets/pixel-platformer",
      "status": "queued",               // queued | downloading | analyzing | done | failed
      "requestedAt": "2026-06-08T12:00:00Z",
      "note": ""
    }
  ]
}
```

- 같은 `packId` 가 이미 `queued`/`downloading`/`analyzing`/`done` 상태면 중복 적재 금지(상태만 반환).
- CC0 아닌 팩은 서버가 `{ ok:false, error:"cc0 아님" }` 으로 막는다.

---

## 피커 주입 데이터 (`picker/data.js`)

위 3개 파일에서 **이번 요청에 맞는 부분집합**을 골라 Claude 가 한 객체로 합쳐 주입한다(`window.SPRITE_PICKER_DATA`).
형식·왕복은 [picker-protocol.md](./picker-protocol.md).

```jsonc
{
  "title": "…", "subtitle": "…", "request": "…",
  "pageSize": 24, "recommendLimit": 24,
  "submitUrl": "http://127.0.0.1:8770/__sprite_picker_submit",
  "tiers": { /* sources.json.tiers */ },
  "targets": [                          // 있으면 "어사인 모드"(슬롯에 배정). 없으면 "프리 모드"(다중 선택)
    { "id": "player", "name": "플레이어", "description": "주인공 — 걷기/점프", "hint": "",
      "tags": ["player","run"], "contentTypes": ["character"], "style": "pixel" }  // ← 추천 점수 기준(있으면)
  ],
  "sources": [                          // '전체' 탭 웹사이트 아코디언 헤더. sources.json 에서 추림.
    { "id": "kenney", "name": "Kenney.nl", "url": "https://kenney.nl/assets", "safetyTier": "cc0" }
  ],
  "catalog":  [ /* 광범위 후보 카드(수십~수백). 각 카드 sourceId 필수 */ ],
  "library":  [ /* 다운로드분 — 풀로 렌더 */ ],
  "candidate":[ /* 절차 제안·로컬 파일 */ ]
}
```

- **탐색 모델(v3):** 하단 카테고리 탭 = **추천 · 전체 · 다운로드 · 후보**.
  - **추천:** 피커가 `targets`(또는 `request`)와 카드 메타(`tags/contentTypes/style`)를 매칭해 **런타임 점수
    정렬**, 상위 `recommendLimit` 개 노출. 별도 주입 불필요 — `targets` 에 `tags/contentTypes/style` 을 정확히 채울수록 추천 정확도가 올라간다.
  - **전체:** `sources` 웹사이트별 아코디언 → 그 안의 팩 카드(`sourceId` 로 그룹핑). 팩 카드 "펼치기"로 대형 미리보기.
  - **다운로드:** `library` 를 **풀(전체)로 렌더**(미리보기 아님).
  - **후보:** `candidate`.
- **카드 정규화 필드(catalog/candidate):** `id, name, sourceId, sourceName, license, safetyTier, style,
  contentTypes[], tags[], preview?, previewUrl?, animated?, url?, downloadUrl?, notes?`.
  - `preview`: catalog 면 `thumbnails/<id>.png`(→ `/catalog/`). 없으면 `previewUrl`(원격) → 없으면 플레이스홀더.
  - `animated: true` 면 preview/previewUrl(SMIL/CSS 애니 SVG)을 `<object>` 로 렌더해 **움직이는 미리보기**.
  - **`sourceId` 는 catalog 카드 필수** — '전체' 탭 웹사이트 그룹핑에 쓰인다.
- **library 카드(다운로드분, 풀뷰) 필드:** 위 + `downloaded: true, full, frameConfig?{frameWidth,frameHeight}, thumbnail?`.
  - `full`/`thumbnail` 은 **작업공간 루트 기준 경로**(→ `/ws/` 로 서빙). assets-library/ 든 games/<slug>/assets/ 든 무관.
  - SVG/단일 이미지는 풀해상도로 인라인 렌더. `frameConfig` 가 있으면 시트를 **canvas 로 프레임 분해**해
    개별 프레임을 보여주고 어사인 모드에서 **개별 프레임 선택**이 가능하다.
- **빈 탭 자동 회피:** 항목이 없는 카테고리 탭은 비활성/안내 표시.
- **targets 필드:** `id`(고유), `name`(표시), `description`(슬롯 설명), `hint?`, 그리고 추천용 `tags?/contentTypes?/style?`.

### 선택 출력 (`.sprite-picker-selection.json` / 토큰 / `window.__spritePickerSelection()`)

```jsonc
// 어사인 모드
{ "version": 2, "request": "…", "note": "…",
  "assignments": [ { "targetId": "player", "targetName": "플레이어", "image": { …카드 slim… } } ],
  "unassignedTargets": [ { "targetId": "enemy", "targetName": "적" } ] }
// 프리 모드
{ "version": 2, "request": "…", "note": "…", "selected": [ { …카드 slim… } ] }
```
`image`/`selected[]` 의 slim 필드: `id, name, group, license, safetyTier, sourceName, url, downloadUrl,
style, contentTypes`.
