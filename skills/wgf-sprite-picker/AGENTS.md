<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# wgf-sprite-picker/ (시각적 스프라이트 선택 스킬)

## Purpose
화면 비주얼은 재미의 핵심이라, 게임에 쓸 스프라이트/스프라이트시트/애니메이션을 **사용자가 브라우저 갤러리에서 직접 골라 적용**하게 하는 스킬. 출처 3가지(① 큐레이션된 CC0 카탈로그(Kenney·OpenGameArt 등) ② 사용자 로컬 파일 ③ `assets-library/`의 이전 사용분) 또는 ④ 설명을 받아 `sprite-forge`/`vector-graphics`로 절차 생성에 위임한다. 카탈로그는 미리 조사·검증·캐싱되어 매번 웹을 뒤지지 않으며, 컴패니언 서버가 사용자의 선택을 파일로 저장해 Claude가 자동 회수한다.

## Key Files
| File | Description |
|------|-------------|
| `SKILL.md` | 스킬 진입점 — '실제 에셋 소싱 vs 절차 생성'을 먼저 묻고, 모호하면 끈질긴 1문1답 인터뷰 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `catalog/` | 검증된 CC0 소스 캐시 + 캐시 빌드 도구(아래) |
| `picker/` | 브라우저 갤러리 UI + 선택 회수 컴패니언 서버 |
| `reference/` | 인터뷰·소싱·프로토콜·스키마·라이브러리 문서 |
| `catalog/thumbnails/` | 카탈로그 팩 썸네일 이미지(50여 종, 이미지 전용) |

| File | Description |
|------|-------------|
| `catalog/sources.json` | CC0 소스 사이트 목록(안전 티어 포함) |
| `catalog/packs.json` | 검증된 CC0 팩 카탈로그 |
| `catalog/prefetch.mjs` · `fetch-pack.mjs` · `analyze-pack.mjs` | 카탈로그 캐시 빌드/분석 도구(무의존성 `.mjs`) |
| `picker/serve.mjs` | 컴패니언 서버 — '✓ 선택 완료' 시 선택을 파일로 저장(Claude가 자동 회수, 붙여넣기는 폴백) |
| `picker/index.html` · `picker.js` · `picker.css` | 브라우저 갤러리 — 슬롯에 클릭/드래그 배정, 검색·필터 |
| `picker/data.example.js` | 피커 데이터 형식 예시 |
| `reference/catalog-schema.md` | 카탈로그·로컬 라이브러리 스키마(§3이 `assets-library/library.json` 스키마) |
| `reference/picker-protocol.md` | 피커↔Claude 선택 회수 프로토콜 |
| `reference/sourcing.md` · `library.md` · `sprite-interview.md` | 소싱 정책·라이브러리·인터뷰 대본 |

## For AI Agents

### Working In This Directory
- **카탈로그는 캐싱 우선**이다. 평소 이 스킬은 `catalog/`만 읽어 웹을 뒤지지 않는다. 외부 재조사·갱신은 별도 스킬 `sprite-catalog-refresh`가 명시 요청 시에만 한다 — 여기서 임의로 네트워크 재조사를 하지 말 것.
- **라이선스 적대적 검증 + 안전 티어**(`cc0`/`permissive-attribution`/`mixed-per-item`/`avoid`)를 모든 카탈로그 항목에 부여한다. 닌텐도 등 상용 IP 리핑 소스는 카탈로그에 넣지 않는다. 최종 게이트는 `ip-license-guard`·루트 `assets.json`.
- `catalog/*.mjs`·`picker/serve.mjs`는 **무의존성**(Node 표준 라이브러리)으로 유지 — `node`로 직접 실행.
- 에셋 적용 시 `assets-library/library.json`을 자동 갱신(스키마는 `reference/catalog-schema.md` §3)하고, CC-BY는 게임 `CREDITS.txt` + `assets.json` 등록과 정합.
- 게임 생성 시 "실제 에셋 vs 절차 생성"을 먼저 묻고, 절차 생성이면 `sprite-forge`/`vector-graphics`로 위임.

### Testing Requirements
- 피커 UI: `node skills/wgf-sprite-picker/picker/serve.mjs` → 브라우저로 갤러리·선택 회수 동작 확인.
- 카탈로그 도구: `node skills/wgf-sprite-picker/catalog/prefetch.mjs` 등 직접 실행 + `sources.json`/`packs.json` JSON 유효성.

### Common Patterns
- 흐름: 소싱 방식 결정 → (카탈로그/로컬/이전 사용분) 갤러리 표시 → 슬롯 배정 → 선택 완료 → 파일 회수 → 게임에 적용 + 라이브러리 갱신.

## Dependencies

### Internal
- `sprite-forge`·`vector-graphics`(절차 생성 위임), `sprite-catalog-refresh`(카탈로그 갱신), `ip-license-guard`(최종 게이트), `assets-library/library.json`·루트 `assets.json`(라이선스/라이브러리).

### External
- Node.js(`.mjs` 도구·컴패니언 서버), CC0/CC-BY 에셋 소스(Kenney·OpenGameArt·game-icons.net 등).

<!-- MANUAL: -->
