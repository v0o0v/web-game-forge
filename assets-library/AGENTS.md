<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# assets-library/

## Purpose
이 프로젝트에서 **실제로 사용한 스프라이트의 로컬 라이브러리**. `sprite-picker` 스킬이 에셋을 적용할 때마다 자동 갱신하며, 피커의 '이전 사용' 탭이 이 인덱스를 읽어 한 번 쓴 에셋을 매번 웹을 뒤지지 않고 다시 고를 수 있게 한다(캐싱 우선 원칙). 사용자 자산 성격.

## Key Files
| File | Description |
|------|-------------|
| `library.json` | 사용 에셋 인덱스(`schemaVersion:1`). 각 항목: `id`·`name`·`sourceId`·`license`·`safetyTier`·`style`·`contentTypes`·`tags`·`files`·`usedIn`·`addedAt`. 현재 runeburst 룬 젬 SVG 6종(game-icons.net, CC-BY-3.0) |
| `README.md` | 라이브러리 용도·스키마 안내 |

## For AI Agents

### Working In This Directory
- **`library.json`은 주로 `sprite-picker`가 자동 갱신**한다. 수동 편집 시 스키마(`skills/wgf-sprite-picker/reference/catalog-schema.md` §3)를 준수한다.
- 모든 항목은 라이선스·`safetyTier`(`cc0`/`permissive-attribution`/`mixed-per-item`/`avoid`)를 정확히 기록한다 — `ip-license-guard`의 게이트 대상.
- `files[]`는 실제 벤더링된 에셋 경로(보통 `games/<slug>/assets/...`)를 가리킨다. CC-BY 항목은 게임 `CREDITS.txt` + 루트 `assets.json` 등록과 정합 유지.
- 실제 에셋 파일은 보통 게임 폴더에 벤더링되고, 이 디렉터리는 인덱스를 보관한다.

### Testing Requirements
- `library.json` 편집 후 JSON 유효성 + `files[]` 경로 존재 확인.
- 라이선스 정합: `assets.json` `entries[]`·게임 `CREDITS.txt`와 교차 확인.

### Common Patterns
- 항목 추가는 sprite-picker 적용 시 자동. `usedIn[]`으로 어느 게임이 썼는지 역추적.

## Dependencies

### Internal
- `skills/wgf-sprite-picker/` (자동 갱신 주체, '이전 사용' 탭 소비자), 루트 `assets.json`(`spritePickerCatalog.localLibrary` 포인터), `ip-license-guard`.

### External
- 외부 CC0/CC-BY 에셋 소스(game-icons.net 등) — 항목별 라이선스 기록.

<!-- MANUAL: -->
