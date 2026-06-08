<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# .claude-plugin/

## Purpose
Claude Code 플러그인 매니페스트 디렉터리. 플러그인의 정체성(이름·버전·설명·키워드)과 마켓플레이스 등록 정보를 정의해, `/plugin marketplace add`·`/plugin install`로 설치 가능하게 한다.

## Key Files
| File | Description |
|------|-------------|
| `plugin.json` | 플러그인 매니페스트 — `name: "web-game-builder"`, `version`, `description`, `keywords`, `defaultEnabled:true`. JSON Schema: `claude-code-plugin-manifest.json` |
| `marketplace.json` | 마켓플레이스 정의 — `web-game-builder-marketplace`, 플러그인 소스 `"./"` 등록 |

## For AI Agents

### Working In This Directory
- **`version` 범프 시 README 배지·`docs/설계.md`와 동기화**한다. 릴리스 단위로 의미 있게 올린다.
- `name`(`web-game-builder`)은 슬래시 커맨드·스킬 네임스페이스의 루트다. 변경하면 `commands/`·스킬 호출 경로·문서가 전부 깨지니 함부로 바꾸지 않는다.
- `description`은 한글 본문(설치 UI에 노출). 키워드는 영어 식별자 유지.
- 훅/커맨드/스킬은 이 매니페스트가 아니라 각각 `hooks/hooks.json`·`commands/`·`skills/`에서 자동 발견된다(매니페스트에 일일이 나열하지 않음).

### Testing Requirements
- `claude plugin validate ./ --strict` 로 매니페스트 유효성 검사.

### Common Patterns
- `plugin.json`의 `name`과 `marketplace.json`의 `plugins[].name`은 항상 일치(`web-game-builder`).

## Dependencies

### Internal
- 이 매니페스트가 루트의 `hooks/`·`commands/`·`skills/`를 플러그인으로 묶는다.

### External
- Claude Code 플러그인 시스템(`/plugin` 커맨드, marketplace 프로토콜).

<!-- MANUAL: -->
