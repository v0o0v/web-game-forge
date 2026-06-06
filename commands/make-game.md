---
description: 2D 웹 게임을 Phaser 4 기반으로 새로 생성합니다 (web-game-builder 스킬 명시 호출)
argument-hint: 만들 게임 설명 (예: 슈퍼마리오류 플랫포머, 벽돌깨기, 스네이크)
---

사용자가 명시적으로 웹 게임 생성을 요청했습니다.

요청 내용: $ARGUMENTS

`web-game-builder` 스킬을 호출해 그 워크플로를 그대로 따르세요:

1. 스킬의 `SKILL.md` 와 `reference/` 템플릿(Phaser 4 + 모바일 웹뷰 하니스 + PixelForge 절차적 에셋)을 로드하고, 정확한 Phaser 4 API 는 `reference/phaser/INDEX.md` 라우팅을 따른다.
2. **요청이 한 줄·모호하거나 코어 루프·재미·아트 스타일(픽셀 PixelForge / 미려한 스무스 VectorForge)·테마·분량이 명시돼 있지 않으면, 빌드 전에 [skills/web-game-builder/reference/game-interview.md](../skills/web-game-builder/reference/game-interview.md)의 깊은 1문1답 인터뷰를 수행한다** (web-game-builder '요청 명확화' 단계 = `deep-interview` 적응판). 추상적 객관식 1회로 끝내지 말 것 — **1문1답으로 약점 차원을 하나씩 깊게 캐고, 매 라운드 Claude가 game-dna 기반의 참신한 컨셉을 *먼저* 제안**하며 본인 의견을 밝힌다. 제안 컨셉의 출처는 `skills/web-game-builder/reference/game-dna/`(인기 2D 게임 35종 분석 + [fun-elements.md](../skills/web-game-builder/reference/game-dna/fun-elements.md)의 조합 설계법; 퍼즐이면 `game-dna/puzzle/`). 필수 3개(코어·재미·아트/테마)가 구체화되면 **청사진을 한 화면으로 읽어주고 최종 확인** 후 장르/메카닉/레벨 규모를 확정한다(현재 2D 전용). 요청이 이미 구체적이면 인터뷰를 건너뛰고 바로 빌드한다.
3. `games/<slug>/` 폴더에 `index.html` + `game.js` 를 생성하고, `engine/` 의 `phaser.min.js`·`pixelforge.js`·`mobile.js` 를 사용한다.
4. 스프라이트 애니메이션, HUD/UI, 모바일 터치 컨트롤, 오디오 언락(Tap to start)을 반드시 포함한다.
5. 라이선스: CC0 또는 절차적 생성 에셋만 사용하고, 저작권/상표(예: 닌텐도 마리오 에셋·이름·시그니처 조합)는 절대 사용하지 않는다.
6. 완성 후 로컬 서버로 띄워 부팅/동작을 검증하고 결과를 보고한다.
