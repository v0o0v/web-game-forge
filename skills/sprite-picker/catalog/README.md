# catalog — 큐레이션된 CC0 스프라이트 소스 캐시

`sprite-picker` 가 **매번 웹을 뒤지지 않도록** 라이선스-안전 스프라이트 소스를 미리 조사·검증해
캐싱한 데이터. 플러그인에 동봉(커밋)된다.

- [`sources.json`](./sources.json) — 소스(사이트) 목록 + 안전 티어.
- [`packs.json`](./packs.json) — 팩(에셋 묶음) 인덱스 + 태그·미리보기.
- [`thumbnails/`](./thumbnails/) — 오프라인 피커용 벤더링 썸네일(없으면 피커가 플레이스홀더 자동 렌더).
- [`fetch-pack.mjs`](./fetch-pack.mjs) — CC0 팩을 `packs.json` 에서 찾아 `assets-library/<packId>/raw/` 에 다운로드·ZIP 해제하는 스크립트(`node fetch-pack.mjs --pack <packId>`).
- [`analyze-pack.mjs`](./analyze-pack.mjs) — `raw/` 이미지를 분석(atlas/grid/alpha)해 시트·썸네일을 생성하고 `library.json` 에 항목을 upsert하는 스크립트(`node analyze-pack.mjs --pack <packId>`).

스키마: [../reference/catalog-schema.md](../reference/catalog-schema.md).

## 갱신
이 캐시는 [`sprite-catalog-refresh`](../../sprite-catalog-refresh/SKILL.md) 스킬이 **사용자가
명시적으로 요청할 때만** 웹을 재조사해 다시 만든다. 라이선스는 시간이 지나면 바뀔 수 있으므로
각 항목의 `verifiedAt`/`generatedAt` 날짜를 신뢰 기준으로 삼는다.

> ⚠ 라이선스 안전은 이 플러그인의 생명선이다. `safetyTier` 가 `cc0`/`permissive-attribution` 이
> 아닌 항목은 적용 전 반드시 항목별 확인을 거친다. 최종 게이트는
> [`ip-license-guard`](../../ip-license-guard/SKILL.md).
