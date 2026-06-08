---
description: 2D 웹 게임을 Phaser 4 기반으로 새로 생성합니다 (web-game-builder 스킬 명시 호출)
argument-hint: 만들 게임 설명 (예: 슈퍼마리오류 플랫포머, 벽돌깨기, 스네이크)
---

사용자가 명시적으로 웹 게임 생성을 요청했습니다.

요청 내용: $ARGUMENTS

`web-game-builder` 스킬을 호출해 그 워크플로를 그대로 따르세요:

1. 스킬의 `SKILL.md` 와 `reference/` 템플릿(Phaser 4 + 모바일 웹뷰 하니스 + PixelForge 절차적 에셋)을 로드하고, 정확한 Phaser 4 API 는 `reference/phaser/INDEX.md` 라우팅을 따른다.
2. **요청이 한 줄·모호하거나 플랫폼·타깃 유저·코어 루프·재미 조합·아트(픽셀 PixelForge / 미려한 스무스 VectorForge)·사운드·분량이 명시돼 있지 않으면, 빌드 전에 [skills/web-game-builder/reference/game-interview.md](../skills/web-game-builder/reference/game-interview.md)의 탑다운·조합주도 1문1답 인터뷰를 수행한다** (web-game-builder '요청 명확화' = `deep-interview` 적응판). 추상적 객관식 1회로 끝내지 말 것 — 3대 정신: (a) **탑다운** — 넓은 맥락(C1 플랫폼·타깃 유저)부터 묻고 코어→재미조합→아트→사운드→승패·분량→조작으로 내려간다; (b) **재미 요소 조합은 사용자 주도** — 완성 아키타입을 강매하지 말고 `FE-*` 팔레트를 `AskUserQuestion` multiSelect로 펼쳐 사용자가 직접 2~4개 조합하게 하고, 받으면 **구체적 한 컷으로 반영 → 검증 → 본인의 다른 아이디어(대안) 제시**; (c) **모호성이 풀릴 때까지** 매 라운드 Claude가 game-dna 기반 참신한 컨셉을 *먼저* 제안하며 의견을 밝힌다. 제안·조합의 출처는 `skills/web-game-builder/reference/game-dna/`(인기 2D 게임 35종 분석 + [fun-elements.md](../skills/web-game-builder/reference/game-dna/fun-elements.md) §1 재미요소 사전·조합 설계법; 퍼즐이면 `game-dna/puzzle/`). 준비도 게이트(C1 확정 + C2 코어·C3 재미조합·C4 아트/테마 구체) 충족 시 **청사진을 한 화면으로 읽어주고 최종 확인** 후 장르/메카닉/레벨 규모를 확정한다(현재 2D 전용). 요청이 이미 구체적이면 인터뷰를 건너뛰고 바로 빌드한다.
2.5. **서사 적용 게이트 (반드시 묻기):** 청사진 확인 직후, 빌드 전에 **"이 게임에 `story-architect` 로 스토리·톤·캐릭터·대사를 설계해 적용할까요?"** 를 반드시 묻는다([skills/story-architect/SKILL.md](../skills/story-architect/SKILL.md)). '네'면 서사 인터뷰(톤→premise→**전형↔참신**→프레임워크→캐릭터→반전→대사→채널)로 `games/<slug>/STORY.md` 스토리 바이블을 만들고 인트로 카드·레벨 사이 막간·승패/엔딩 문구·환경 단서·NPC 대사로 적용한다. '아니요'면 `FE-NARRATIVE` 분위기 기본값만 적용하고, '나중에'면 게임부터 만들고 중반에 `story-architect` 로 스토리·캐릭터를 추가한다(초·중반 어디서든 가능). 대사 슬롯이 비거나 placeholder면 빌드 중에도 `story-architect` 가 자동 개입해 캐릭터 보이스에 맞춰 작성한다.
3. `games/<slug>/` 폴더에 `index.html` + `game.js` 를 생성하고, `engine/` 의 `phaser.min.js`·`pixelforge.js`·`mobile.js` 를 사용한다.
4. 스프라이트 애니메이션, HUD/UI, 모바일 터치 컨트롤, 오디오 언락(Tap to start)을 반드시 포함한다. **아트는
   출처를 먼저 가른다 — 사용자가 비주얼을 직접 고르고 싶어 하면 `sprite-picker` 스킬로 위임해 CC0 카탈로그·
   로컬 파일·이전 사용분을 브라우저 갤러리로 시각 선택하게 하고, 아니면 PixelForge/VectorForge 절차 생성으로 채운다.**
5. 라이선스: CC0 또는 절차적 생성 에셋만 사용하고, 저작권/상표(예: 닌텐도 마리오 에셋·이름·시그니처 조합)는 절대 사용하지 않는다.
6. 완성 후 로컬 서버로 띄워 부팅/동작을 검증하고 결과를 보고한다.
