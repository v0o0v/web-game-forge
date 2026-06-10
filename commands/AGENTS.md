<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# commands/

## Purpose
플러그인의 **명시적 슬래시 커맨드**를 정의한다. 자동 트리거 3계층 중 3차(명시적 호출) 경로로, 사용자가 `/web-game-builder:wgf-make-game <설명>`을 직접 입력해 게임 생성을 시작할 수 있게 한다.

## Key Files
| File | Description |
|------|-------------|
| `wgf-make-game.md` | `/web-game-builder:wgf-make-game` 커맨드. YAML frontmatter(`description`·`argument-hint`) + `web-game-builder` 스킬 워크플로 위임 본문. 인터뷰 게이트 → **서사 게이트(2.5)** → **아이템 게이트(2.6)** → 빌드 → 검증의 6단계 절차 명세 |

## For AI Agents

### Working In This Directory
- 커맨드 파일은 **스킬 워크플로의 진입점**일 뿐 — 실제 로직은 `skills/wgf-web-game-builder/SKILL.md`와 `reference/`에 있다. 둘이 어긋나지 않게 동기화한다.
- `wgf-make-game.md` 본문은 게임 제작 게이트(인터뷰·story-architect·item-architect 적용 여부 묻기)의 권위 있는 절차다. 게이트 순서/문구를 바꾸면 `web-game-builder` 스킬과 정합 유지.
- `$ARGUMENTS`는 사용자가 커맨드 뒤에 입력한 게임 설명으로 치환된다.
- frontmatter `description`·`argument-hint`는 한글.

### Testing Requirements
- `claude plugin validate ./ --strict`로 커맨드 등록 확인.
- 커맨드 본문이 참조하는 상대경로(`../skills/wgf-web-game-builder/reference/...`)가 실제로 존재하는지 확인.

### Common Patterns
- 커맨드 네임스페이스는 `plugin.json`의 `name`(`web-game-builder`)에서 유래 → `/web-game-builder:<command>`.

## Dependencies

### Internal
- `skills/wgf-web-game-builder/` (위임 대상 워크플로), `skills/wgf-story-architect/`·`skills/wgf-item-architect/` (게이트), `engine/` (생성 게임이 로드).

### External
- Claude Code 슬래시 커맨드 시스템.

<!-- MANUAL: -->
