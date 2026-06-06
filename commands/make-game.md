---
description: 2D 웹 게임을 Phaser 4 기반으로 새로 생성합니다 (web-game-builder 스킬 명시 호출)
argument-hint: 만들 게임 설명 (예: 슈퍼마리오류 플랫포머, 벽돌깨기, 스네이크)
---

사용자가 명시적으로 웹 게임 생성을 요청했습니다.

요청 내용: $ARGUMENTS

`web-game-builder` 스킬을 호출해 그 워크플로를 그대로 따르세요:

1. 스킬의 `SKILL.md` 와 `reference/` 템플릿(Phaser 4 + 모바일 웹뷰 하니스 + PixelForge 절차적 에셋)을 로드하고, 정확한 Phaser 4 API 는 `reference/phaser/INDEX.md` 라우팅을 따른다.
2. **아트 스타일(픽셀 PixelForge / 미려한 스무스 VectorForge)·장르·테마·분량이 위 요청에 명시돼 있지 않으면, 빌드 전에 `AskUserQuestion`으로 사용자에게 먼저 물어본다** (web-game-builder의 '요청 명확화' 단계). 그다음 장르/메카닉/레벨 규모를 정한다 (현재 2D 전용). 어떤 게임·재미요소를 조합할지 모호하면 `skills/web-game-builder/reference/game-dna/`(인기 2D 게임 35종 분석 + [fun-elements.md](../skills/web-game-builder/reference/game-dna/fun-elements.md)의 조합 설계법)로 템플릿 아키타입·재미요소를 제안해 좁힌다.
3. `games/<slug>/` 폴더에 `index.html` + `game.js` 를 생성하고, `engine/` 의 `phaser.min.js`·`pixelforge.js`·`mobile.js` 를 사용한다.
4. 스프라이트 애니메이션, HUD/UI, 모바일 터치 컨트롤, 오디오 언락(Tap to start)을 반드시 포함한다.
5. 라이선스: CC0 또는 절차적 생성 에셋만 사용하고, 저작권/상표(예: 닌텐도 마리오 에셋·이름·시그니처 조합)는 절대 사용하지 않는다.
6. 완성 후 로컬 서버로 띄워 부팅/동작을 검증하고 결과를 보고한다.
