---
name: sprite-catalog-refresh
description: >
  sprite-picker 의 CC0 스프라이트 소스 카탈로그를 웹에서 다시 조사·검증해 캐시(catalog/sources.json·
  packs.json·thumbnails)를 갱신한다. 평소 sprite-picker 는 이 캐시만 읽어 매번 웹을 뒤지지 않으며,
  '스프라이트/에셋 소스를 업데이트/새로고침/추가해줘', '카탈로그 갱신', '새 CC0 사이트 조사' 같은 요청이
  올 때만 이 스킬이 발동해 네트워크 재조사를 한다. 라이선스를 적대적으로 검증해 안전 티어를 다시 매긴다.
  English: refresh the cached CC0 sprite-source catalog used by sprite-picker by re-researching the web and
  adversarially re-verifying licenses. Trigger only on explicit requests to update/refresh/add sprite asset
  sources or rebuild the catalog. Keywords: 카탈로그 갱신, 에셋 소스 업데이트, 스프라이트 소스 새로고침,
  CC0 사이트 추가, refresh sprite catalog, update asset sources, add sprite source, rebuild catalog.
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch
---

# sprite-catalog-refresh — 스프라이트 카탈로그 웹 재조사·갱신

[`sprite-picker`](../sprite-picker/SKILL.md) 가 읽는 **CC0 스프라이트 소스 캐시**를 다시 만든다. 이건
**네트워크 무거운·사용자 명시 요청 전용** 작업이다 — 평상시 피커는 캐시만 읽어 빠르고 결정론적으로
동작하고, 라이선스가 바뀌거나 새 소스를 넣고 싶을 때만 이 스킬로 갱신한다.

## 언제 사용
- "스프라이트/에셋 소스 업데이트/새로고침/추가해줘", "카탈로그 갱신", "새 CC0 사이트 조사해줘"
- 카탈로그 항목의 `verifiedAt`/`generatedAt` 이 오래됐을 때(라이선스는 시간이 지나면 바뀔 수 있음)
- ❌ 평범한 스프라이트 선택/적용은 이 스킬이 아니라 [`sprite-picker`](../sprite-picker/SKILL.md).

## 산출물 (덮어쓰기 대상)
- `skills/sprite-picker/catalog/sources.json` — 소스 목록 + 안전 티어
- `skills/sprite-picker/catalog/packs.json` — 팩 인덱스 + 태그·미리보기
- `skills/sprite-picker/catalog/thumbnails/` — 오프라인 썸네일(가능한 항목)
- 스키마: [../sprite-picker/reference/catalog-schema.md](../sprite-picker/reference/catalog-schema.md).

## 방법 — 조사 → 적대적 검증 → 합성 (3단계)

라이선스 정확성이 플러그인의 생명선이므로 **조사와 검증을 분리**하고, 검증은 적대적으로 한다. 규모가
크면 Workflow 로 팬아웃해도 좋다(클러스터별 조사 → 소스별 라이선스 검증 → 합성·티어링).

### 1) 조사 (클러스터별 웹 검색)
아래 영역별로 `WebSearch`+`WebFetch` 로 라이선스-안전 소스를 광범위하게 모은다. **기억에 의존하지 말고
실제 사이트·라이선스 페이지를 연다.**
- 픽셀 플랫포머(캐릭터 시트·타일셋·아이템), 탑다운/RPG/던전, UI·아이콘, 벡터/HD/스무스,
  CC0 종합 마켓(OpenGameArt·itch CC0 태그·Kenney), 애니메이션·이펙트 시트.
- 각 소스: `id,name,url,license,licenseUrl,safetyTier,contentTypes[],style[],attributionRequired,
  redistribution,hotlinkOk,termsNotes,confidence,packs[]`.

### 2) 적대적 라이선스 검증 (소스마다)
각 소스를 **회의적으로** 재검증한다 — "이 에셋을 게임에 번들해 배포해도 되는가?"
- `WebFetch` 로 실제 라이선스/약관을 확인하고 핵심 문구를 `evidence` 로 남긴다.
- **보수적 판정:** 확신 없으면 등급을 내린다. CC0/퍼블릭도메인만 `cc0`. CC-BY·OFL 등 표기 필요는
  `permissive-attribution`. **사이트 전체가 아니라 항목별** 라이선스면 `mixed-per-item`. ARR·불명·재배포
  제한은 `avoid` → 카탈로그에서 제외(또는 명시 경고).
- 닌텐도 등 상용 IP 리핑 소스는 절대 넣지 않는다.

### 3) 합성·티어링·썸네일
- 중복 병합(소스 `id` 기준), 안전 티어로 정렬, `generatedAt`/`verifiedAt` 을 오늘 날짜로 기록.
- 가능한 팩은 대표 미리보기를 받아 `thumbnails/<pack-id>.png` 로 벤더링(없으면 피커가 플레이스홀더 자동 렌더).
  벤더링하는 미리보기도 **CC0 인 것만** 받는다.
- 누락 점검(잘 알려진 CC0 소스가 빠졌는지) 후 JSON 2개를 덮어쓴다.

## 검증
- 두 JSON 이 [catalog-schema.md](../sprite-picker/reference/catalog-schema.md) 스키마에 맞는지(파싱·필수 필드).
- `safetyTier` 가 `cc0`/`permissive-attribution` 이 아닌 항목이 `assets.json` 정책과 모순되지 않는지.
- 피커로 띄워 카드가 정상 렌더되는지 점검 후, 갱신 요약(추가/변경/강등된 소스)을 보고.

## 연계
- 소비자: [`sprite-picker`](../sprite-picker/SKILL.md). 라이선스 게이트: [`ip-license-guard`](../ip-license-guard/SKILL.md) · 루트 `assets.json`.
