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
      "previewUrl": "https://…/preview.png",   // 원격 대표 미리보기 (라이브 탈출구)
      "thumbnail": "thumbnails/kenney-pixel-platformer.png", // 벤더링 오프라인 썸네일(있으면)
      "downloadUrl": "https://kenney.nl/...",  // 실제 다운로드 (온디맨드)
      "attributionRequired": false,
      "notes": "18px 타일. 캐릭터 4프레임 걷기."
    }
  ]
}
```

- `thumbnail` 이 없으면 피커가 **메타데이터로 플레이스홀더 타일을 즉석 렌더**한다(오프라인 동작 보장).
- `previewUrl` 은 카드의 "원본 ↗" 라이브 링크로도 쓰인다.

## 3) `assets-library/library.json` — 이전에 실제 사용한 스프라이트 (프로젝트 로컬·사용자 작성)

플러그인이 아니라 **게임 작업공간 루트**에 있다(설치처마다 다름). sprite-picker 가 에셋을 실제
적용할 때마다 여기에 누적한다. 피커의 "이전 사용" 탭이 이 파일을 읽는다. 상세는 [library.md](./library.md).

```jsonc
{
  "schemaVersion": 1,
  "note": "이 프로젝트에서 실제 사용한 스프라이트. sprite-picker 가 자동 갱신.",
  "items": [
    {
      "id": "kenney-pixel-hero",
      "name": "픽셀 러너",
      "sourceId": "kenney",              // 카탈로그 출처 id, 또는 "local" | "procedural"
      "license": "CC0-1.0",
      "safetyTier": "cc0",
      "style": "pixel",
      "contentTypes": ["character"],
      "tags": ["player","run"],
      "files": ["assets-library/kenney-pixel-hero/sheet.png"],
      "frameConfig": { "frameWidth": 18, "frameHeight": 18 },  // load.spritesheet 용
      "thumbnail": "assets-library/kenney-pixel-hero/thumb.png",
      "usedIn": ["games/super-runner"],
      "addedAt": "2026-06-07"
    }
  ]
}
```

---

## 피커 주입 데이터 (`picker/data.js`)

위 3개 파일에서 **이번 요청에 맞는 부분집합**을 골라 Claude 가 한 객체로 합쳐 주입한다. 형식은
[picker-protocol.md](./picker-protocol.md) 참고. 카드 정규화 필드는 `id,name,sourceName,license,
safetyTier,style,contentTypes[],tags[],thumbnail?,previewUrl?,url?,downloadUrl?,notes?` 이며
`group` 은 `catalog | library | candidate` 셋 중 하나로 배치된다.
