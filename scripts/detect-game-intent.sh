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

gamePattern='(게임).*(만들|제작|개발|짜|구현|코딩|클론)|(만들|제작|개발|코딩|구현).*(게임)|(make|build|create|code|develop|implement|clone).*(game|platformer|shooter|rpg|puzzle|arcade|runner|phaser|html5|canvas)|(슈퍼마리오|마리오|플랫포머|벽돌깨기|테트리스|스네이크|뱀게임|플래피|점프게임|러너게임)|(tetris|breakout|flappy|snake|pong|asteroids)'
assetPattern='스프라이트시트|스프라이트|타일셋|(에셋|애셋).*(골라|고르|선택|적용|바꿔|교체|찾아|추가|넣어|쓰)|(골라|고르|선택|적용|바꿔|교체).*(에셋|애셋|스프라이트|아이콘|타일)|kenney|opengameart|game-?icons|svgrepo|(sprite ?sheet|spritesheet|sprite|tileset)|(pick|choose|select|apply|swap|browse).*(asset|sprite|tileset|icon|character)'

ctx=''
if printf '%s' "$prompt" | grep -Eiq "$gamePattern"; then
  ctx='사용자가 브라우저/웹 게임 제작을 요청하고 있습니다. 응답 전에 web-game-builder 스킬을 호출하고 그 워크플로(Phaser 4 + 모바일 웹뷰 하니스 + CC0/절차적 에셋)를 따르세요. (The user is requesting a browser/web game — invoke the web-game-builder skill.)'
fi
if printf '%s' "$prompt" | grep -Eiq "$assetPattern"; then
  asset_ctx='사용자가 게임 스프라이트/스프라이트시트/에셋을 고르거나 적용·교체하려 합니다. 응답 전에 sprite-picker 스킬을 호출해 먼저 "실제 에셋 소싱 vs 절차 생성"을 묻고, 캐싱된 CC0 카탈로그·로컬 파일·이전 사용분을 브라우저 갤러리 피커로 시각 선택하게 하세요(절차 생성은 sprite-forge/vector-graphics 위임). (The user wants to choose/apply game sprite assets — invoke the sprite-picker skill.)'
  if [ -n "$ctx" ]; then ctx="$ctx $asset_ctx"; else ctx="$asset_ctx"; fi
fi

if [ -n "$ctx" ]; then
  if command -v python3 >/dev/null 2>&1; then
    esc="$(printf '%s' "$ctx" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
  else
    esc="\"$ctx\""
  fi
  printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":%s},"suppressOutput":true}\n' "$esc"
fi
exit 0
