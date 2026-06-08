<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# scripts/

## Purpose
게임 제작 의도를 **결정론적으로 감지**하는 스크립트 모음. `hooks/hooks.json`의 `UserPromptSubmit` 훅이 호출하며, 사용자 프롬프트에서 한/영 "게임 제작" 의도를 정규식으로 감지해 매치되면 스킬 발동을 넛지하는 `additionalContext`를 출력한다(매치 없으면 no-op).

## Key Files
| File | Description |
|------|-------------|
| `detect-game-intent.js` | **정본**(Node, 크로스플랫폼). 훅이 실제로 실행. stdin JSON `.prompt` 파싱 → 한/영 의도 정규식 → `hookSpecificOutput.additionalContext` 출력. `decision:block` 미사용(프롬프트 보존) |
| `detect-game-intent.ps1` | PowerShell 포팅(셸 직접 실행/참고용) |
| `detect-game-intent.sh` | POSIX 셸 포팅(셸 직접 실행/참고용) |

## For AI Agents

### Working In This Directory
- **`.js`가 정본**이다 — 훅(`hooks.json`)이 Node 버전만 호출한다. 감지 규칙(정규식·키워드)을 바꾸면 `.ps1`·`.sh` 포팅도 함께 갱신해 3종을 정합 유지한다.
- 감지 정규식은 한국어(게임 + 만들/제작/개발/코딩…)·영어(make/build/create … game/platformer…)·고유 장르명(클론 이름 단독)을 커버한다. `skills/web-game-builder/SKILL.md`의 description 키워드와 의미상 정합.
- 출력은 반드시 `additionalContext` 형식(넛지). 프롬프트를 차단·변형하지 않는다.
- 무의존성(Node 표준 라이브러리만) 유지.

### Testing Requirements
- `echo '{"prompt":"탑다운 슈팅 만들어줘"}' | node scripts/detect-game-intent.js` → 게임 관련 `additionalContext` 출력 확인.
- `echo '{"prompt":"오늘 날씨 어때"}' | node scripts/detect-game-intent.js` → 출력 없음(no-op) 확인.

### Common Patterns
- 입력: 훅 JSON(stdin). 파싱 실패 시 원문 전체로 폴백. 출력: 매치 시에만 JSON.

## Dependencies

### Internal
- `hooks/hooks.json`이 `detect-game-intent.js`를 등록·호출.

### External
- Node.js (정본 실행).

<!-- MANUAL: -->
