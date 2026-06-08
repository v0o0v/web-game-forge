<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# hooks/

## Purpose
플러그인의 **훅 등록**을 정의한다. 자동 트리거 3계층 중 2차(결정론적)로, `UserPromptSubmit` 시점에 게임 제작 의도 감지 스크립트를 돌려, 매치되면 `<system-reminder>`로 스킬 발동을 넛지한다.

## Key Files
| File | Description |
|------|-------------|
| `hooks.json` | `UserPromptSubmit` 훅 등록 — `node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-game-intent.js"` 실행(timeout 10s) |

## For AI Agents

### Working In This Directory
- `hooks.json`은 **얇은 등록 파일**이다. 실제 감지 로직은 `scripts/detect-game-intent.js`에 있다(크로스플랫폼 Node).
- 훅은 **넛지(nudge)만 한다** — `decision:block`을 쓰지 않는다(그건 사용자 프롬프트 자체를 지움). `additionalContext`로 스킬을 켜라고 살짝 밀어주는 것이 목적.
- `${CLAUDE_PLUGIN_ROOT}`는 Claude Code가 주입하는 플러그인 루트 경로 변수 — 하드코딩하지 않는다.
- 새 훅 이벤트를 추가할 땐 timeout과 크로스플랫폼(Node 실행) 일관성을 유지한다.

### Testing Requirements
- `claude plugin validate ./ --strict`로 훅 등록 확인.
- 감지 동작은 `scripts/`에서 검증: `echo '{"prompt":"슈퍼마리오 만들어줘"}' | node scripts/detect-game-intent.js` → `additionalContext` 출력 확인.

### Common Patterns
- 단일 `UserPromptSubmit` 훅 → 단일 Node 스크립트. 셸 의존(.ps1/.sh)이 아니라 Node로 크로스플랫폼 보장.

## Dependencies

### Internal
- `scripts/detect-game-intent.js` (실제 감지 로직).

### External
- Node.js (훅 실행), Claude Code 훅 시스템(`UserPromptSubmit`, `hookSpecificOutput.additionalContext`).

<!-- MANUAL: -->
