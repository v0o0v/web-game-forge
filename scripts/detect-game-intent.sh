#!/usr/bin/env bash
# web-game-builder — UserPromptSubmit 의도 감지 훅 (bash 변형, macOS/Linux/Git-Bash)
# hooks.json 에서 Node 버전 대신 이걸 쓰려면:
#   "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/detect-game-intent.sh\""
# 동작 계약은 detect-game-intent.js 와 동일하다.
set -euo pipefail
input="$(cat)"

if command -v jq >/dev/null 2>&1; then
  prompt="$(printf '%s' "$input" | jq -r '.prompt // empty')"
else
  prompt="$(printf '%s' "$input" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')"
fi

pattern='(게임).*(만들|제작|개발|짜|구현|코딩|클론)|(만들|제작|개발|코딩|구현).*(게임)|(make|build|create|code|develop|implement|clone).*(game|platformer|shooter|rpg|puzzle|arcade|runner|phaser|html5|canvas)|(슈퍼마리오|마리오|플랫포머|벽돌깨기|테트리스|스네이크|뱀게임|플래피|점프게임|러너게임)|(tetris|breakout|flappy|snake|pong|asteroids)'

if printf '%s' "$prompt" | grep -Eiq "$pattern"; then
  ctx='사용자가 브라우저/웹 게임 제작을 요청하고 있습니다. 응답 전에 web-game-builder 스킬을 호출하고 그 워크플로(Phaser 3 + 모바일 웹뷰 하니스 + CC0/절차적 에셋)를 따르세요. (The user is requesting a browser/web game — invoke the web-game-builder skill.)'
  if command -v python3 >/dev/null 2>&1; then
    esc="$(printf '%s' "$ctx" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
  else
    esc="\"$ctx\""
  fi
  printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":%s},"suppressOutput":true}\n' "$esc"
fi
exit 0
