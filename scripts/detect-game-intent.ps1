# web-game-builder — UserPromptSubmit 의도 감지 훅 (PowerShell 변형, Windows 호스트용)
# hooks.json 에서 Node 버전 대신 이걸 쓰려면:
#   "command": "pwsh -NoProfile -File \"${CLAUDE_PLUGIN_ROOT}/scripts/detect-game-intent.ps1\""
# 동작 계약은 detect-game-intent.js 와 동일하다.
$ErrorActionPreference = 'Stop'
$raw = [Console]::In.ReadToEnd()
try { $prompt = ($raw | ConvertFrom-Json).prompt } catch { $prompt = $raw }
if (-not $prompt) { exit 0 }

$gamePattern = '(게임)[\s\S]*(만들|제작|개발|짜|구현|코딩|클론)|(만들|제작|개발|코딩|구현)[\s\S]*(게임)|\b(make|build|create|code|develop|implement|clone)\b[\s\S]*\b(game|platformer|shooter|rpg|puzzle|arcade|runner|phaser|html5|canvas)\b|(슈퍼마리오|마리오|플랫포머|벽돌깨기|테트리스|스네이크|뱀게임|플래피|점프게임|러너게임)|\b(tetris|breakout|flappy|snake|pong|asteroids)\b'
$assetPattern = '스프라이트\s*시트|스프라이트시트|스프라이트|타일셋|(에셋|애셋)[\s\S]*(골라|고르|선택|적용|바꿔|교체|찾아|추가|넣어|쓰)|(골라|고르|선택|적용|바꿔|교체)[\s\S]*(에셋|애셋|스프라이트|캐릭터\s*이미지|아이콘|타일)|kenney|opengameart|game-?icons|svgrepo|\b(sprite ?sheet|spritesheet|sprite|tileset)\b|\b(pick|choose|select|apply|swap|browse)\b[\s\S]*\b(asset|sprites?|tileset|icon|character)\b'
$stylePattern = '아트\s*스타일|아트\s*디렉션|비주얼\s*톤|스타일\s*가이드|색\s*팔레트|컬러\s*팔레트|팔레트\s*(통일|정해|잡아|만들)|(룩|무드|분위기|톤|컬러)[\s\S]*(잡아|정해|통일|맞춰|입혀|바꿔|만들)|(카툰|픽셀|픽셀아트|플랫|벡터)\s*(룩|풍|느낌|스타일)|(셀\s*셰이딩|셰이딩|라인아트|아웃라인|리스킨|컬러\s*그레이딩)|\b(art ?style|art ?direction|visual ?tone|style ?guide|colou?r ?palette|color ?ramp|mood ?board|reskin|cell ?shading|cohesive ?look)\b|\b(cartoon|pixel|flat|vector)\b[\s\S]*\b(look|style|aesthetic)\b'

$parts = @()
if ($prompt -imatch $gamePattern) {
  $parts += '사용자가 브라우저/웹 게임 제작을 요청하고 있습니다. 응답 전에 web-game-builder 스킬을 호출하고 그 워크플로(Phaser 4 + 모바일 웹뷰 하니스 + CC0/절차적 에셋)를 따르세요. 단순 바닐라 JS 가 아니라 스킬 reference 템플릿으로 스프라이트 애니메이션·HUD·터치 컨트롤·오디오 언락까지 포함해 완성도 높게 만드세요. (The user is requesting a browser/web game — invoke the web-game-builder skill.)'
}
if ($prompt -imatch $assetPattern) {
  $parts += '사용자가 게임 스프라이트/스프라이트시트/에셋을 고르거나 적용·교체하려 합니다. 응답 전에 sprite-picker 스킬을 호출해 먼저 "실제 에셋 소싱 vs 절차 생성"을 묻고, 캐싱된 CC0 카탈로그·로컬 파일·이전 사용분을 브라우저 갤러리 피커로 시각 선택하게 하세요(절차 생성은 sprite-forge/vector-graphics 위임). (The user wants to choose/apply game sprite assets — invoke the sprite-picker skill.)'
}
if ($prompt -imatch $stylePattern) {
  $parts += '사용자가 게임 전체의 아트 스타일/룩/무드/팔레트를 정의·통일하려 합니다. 응답 전에 style-architect 스킬을 호출해 먼저 매체(픽셀↔벡터)·복잡도를 가르고 룩·무드·master_palette를 정의하세요(이 스킬은 이미지를 직접 생성하지 않습니다 — 스프라이트·아이콘 생성은 sprite-forge/vector-graphics/sprite-picker, style-architect는 그 위에서 시각 스타일을 정의·강제하는 디렉션 권위입니다). (The user wants to define/unify the game''s overall art style/look/mood/palette — invoke the style-architect skill, the visual-direction authority that does NOT generate images.)'
}

if ($parts.Count -gt 0) {
  $payload = @{
    hookSpecificOutput = @{
      hookEventName     = 'UserPromptSubmit'
      additionalContext = ($parts -join ' ')
    }
    suppressOutput = $true
  }
  $payload | ConvertTo-Json -Compress -Depth 5 | Write-Output
}
exit 0
