---
name: web-game-builder
description: >
  브라우저/웹뷰에서 잘 돌아가는 완성도 높은 2D 웹 게임을 Phaser 4 로 생성합니다.
  단순 바닐라 JS 가 아니라 스프라이트 애니메이션·HUD/UI·모바일 멀티터치 컨트롤·오디오
  언락까지 포함합니다. 사용자가 게임을 만들/제작/개발/코딩/클론 해 달라고 할 때 사용 —
  플랫포머(슈퍼마리오류), 러너, 슈팅, 탑다운, 퍼즐, 아케이드, 벽돌깨기/테트리스/스네이크/
  플래피 류, 또는 "2D 게임"·"웹 게임"·"미니게임" 전반. English: use when the user asks to
  make / build / create / code a browser game — a platformer (Super Mario-style), shooter,
  runner, puzzle, arcade, or a Breakout / Tetris / Snake / Flappy clone, or any "2d game" /
  "web game". 엔진 이름을 말하지 않아도 인터랙티브 브라우저 게임 제작 요청이면 항상 발동.
allowed-tools: Read, Write, Edit, Bash
---

# web-game-builder — 2D 웹 게임 빌더

브라우저/모바일 웹뷰에서 잘 돌아가는 **완성도 높은 2D 게임**을 만든다.
바닐라 JS 로 투박하게 만들지 말고, 반드시 이 플러그인의 **엔진(Phaser 4 + PixelForge +
ChipAudio + MobileHarness)** 과 템플릿 구조를 사용한다.

> 현재 범위: **2D 전용**. 플래그십 예제는 `games/super-runner/`(슈퍼마리오류 플랫포머).

## 전문 스킬 라우팅 (오케스트레이션)
이 스킬은 전체 흐름을 조율한다. 요청 성격에 따라 아래 전문 스킬이 자동 발동하거나 이 스킬이
위임한다. 새 게임: **장르 스킬로 스캐폴드 → 제작요소 스킬로 살붙이기 → 품질 스킬로 검증·최적화**.

> **어떤 게임을 만들지 정하고 재미 요소를 조합하는 설계 자료**는 `reference/game-dna/`를 쓴다 —
> 지난 10여 년 인기 2D 게임 35종 분석(장르별 6종) + 재미요소 사전·조합 플레이북([fun-elements.md](./reference/game-dna/fun-elements.md)) +
> 색인([INDEX.md](./reference/game-dna/INDEX.md)). 활용법은 아래 "**0) 요청 명확화**" 참고. (온디맨드 Read, 자동 트리거 아님.)

**장르 스캐폴드**
- 옆스크롤 플랫포머/마리오류 → `platformer-game`
- 탑다운/트윈스틱 슈팅 → `topdown-shooter`
- 벽돌깨기·뱀·퐁·인베이더 → `arcade-classic`
- 테트리스·매치3·2048 퍼즐 → `puzzle-game`
- 무한 러너·플래피류 → `endless-runner`

**제작 요소**
- 실제 스프라이트/시트/애니메이션을 **시각적으로 골라 적용**(CC0 카탈로그·로컬 파일·이전 사용분) → `sprite-picker`
  (아트를 어떻게 채울지 = **실제 에셋 소싱 vs 절차 생성** 결정 게이트. 카탈로그 갱신은 `sprite-catalog-refresh`)
- 스프라이트/타일/애니메이션 (픽셀아트, **절차 생성**) → `sprite-forge`
- 미려한 스무스/벡터 그래픽 (그라데이션·글로우·글래스·곡선 캐릭터, **절차 생성**) → `vector-graphics`
- 사운드 설계(무드·BGM·효과음·적응형 음악) → `sound-architect`
  (8비트를 넘는 **사운드 디렉터** 레인. `engine/soundforge.js`(Tone.js v15 vendored)로 ADSR·필터·슈퍼소우·FM·노이즈 퍼커션·절차 리버브·적응형 레이어드 음악을 절차 합성. 사운드 적용 여부는 아이템 게이트 직후 사용자에게 **반드시 묻는다** — **무드부터** 가르고, 아주 작은/레트로 게임은 chip-sound로 충분하다고 안내. `games/<slug>/AUDIO.md` 바이블 + `audio.json` 산출, `tools/lint-audio.mjs` 로 무드정합·보이스예산·믹스 검수. 초·중반 어디서든 사운드 추가/수정 가능, 빈 SFX 슬롯 자동 개입)
- 8비트(칩튠) 경량 효과음/BGM → `chip-sound`
  (아주 작은/레트로 게임이나 사운드가 부차적일 때의 경량 레인(T0, `engine/audio.js`). sound-architect가 디렉터, chip-sound가 8비트 구현 레인)
- 레벨 설계(게임 분석·의도 인터뷰·난이도 곡선·재미 극대화) → `level-architect`
- 게임 서사 설계(톤·스토리·목표·캐릭터·대사·반전) → `story-architect`
  (game-dna `FE-NARRATIVE` 의 본격 설계 레인. 스토리 적용 여부는 청사진 인터뷰 직후 사용자에게 **반드시 묻는다**. 초·중반 어디서든 스토리 수정·캐릭터 추가/삭제 가능. 빌드 중 인트로/막간/승패/대사 카피가 placeholder·빈 슬롯으로 남으면 `story-architect` 의 대사 자동 개입을 호출해 채운다)
- 캐릭터 능력/스킬 시스템 설계(액티브·패시브·이동기·궁극기·자원·쿨다운·콤보·스킬트리·시너지) → `ability-architect`
  (game-dna `FE-MASTERY`·`FE-BUILD`·`FE-COMBO`·`FE-POWER-FANTASY` 의 본격 설계 레인. **'스킬'은 게임 캐릭터의 능력 — Claude 스킬과 다름**. 능력 적용 여부는 서사 게이트 직후·아이템 게이트 전에 사용자에게 **반드시 묻는다**(능력은 코어 동사에 가장 가깝고 아이템이 능력을 부여하므로 먼저) — 단 **복잡도부터** 가르고 디폴트는 코어 동사 위 능력 0~1개라 작은 게임엔 과설계를 권하지 않는다. `games/<slug>/ABILITIES.md` 바이블 + `abilities.json` 산출, `engine/abilitykit.js`(쿨다운·자원·콤보·게이트 런타임) 배선, visual.* 슬롯으로 아이콘을 sprite 스킬에 핸드오프, `tools/lint-abilities.mjs` 로 죽은스킬·지배전략·곱연산폭발·무한콤보·게이트softlock 검수(복잡한 킷은 `tools/sim-abilities.mjs`). 초·중반 어디서든 추가/수정/삭제 가능)
- 아이템 시스템 설계(소모품·장비·특수기능·통화·시너지·획득) → `item-architect`
  (game-dna `FE-BUILD`·`FE-COLLECT`·`FE-RISK-REWARD` 의 본격 설계 레인. 아이템 적용 여부는 서사 게이트 직후 사용자에게 **반드시 묻는다** — 단 **복잡도부터** 가르고 디폴트는 아이템 0개라 작은 게임엔 과설계를 권하지 않는다. `games/<slug>/ITEMS.md` 바이블 + `items.json` 산출, 각 아이템의 visual.* 슬롯을 채워 아이콘을 sprite-forge/vector-graphics/sprite-picker로 핸드오프, `tools/lint-items.mjs` 로 밸런스(죽은아이템·지배전략·곱연산 폭발) 검수. 초·중반 어디서든 아이템 추가/수정/삭제 가능)
- 레벨/맵/타일맵 빌드(구현 패턴) → `level-designer`
- HUD/메뉴/UI → `game-ui-hud`
- 파티클/스크린셰이크/게임필 → `juice-fx`

**Phaser 고급·입력 5종**(필요한 게임만 — `index.html`에 해당 `engine/*.js` 킷을 phaser 다음·game 이전 추가)
- Matter 강체 물리(슬링샷·쌓기·물리퍼즐·래그돌 — Arcade 로 못 하는 회전·충격·무너짐) → `matter-physics`
- 포스트FX 화면 룩(블룸·비네트·CRT·네온·컬러그레이딩 — v4 Filter, 전 장르 폴리시) → `screen-fx`
- 동적 라이팅·분위기(점광원·Simplex Noise 안개·Gradient 밤하늘·앰비언트 — 호러·던전·밤) → `lighting-mood`
- 경로·모션(스플라인 패트롤·방사 탄막·타워디펜스 크립·앰비언트 드리프트) → `path-motion`
- 가상 조이스틱(아날로그/트윈스틱 — 360° 방향+세기·이동/조준 분리, 디지털 D-패드와 공존; 탑다운/슈터/러너) → `virtual-joystick`

**품질·운영**
- 모바일 웹뷰 최적화/감사 → `mobile-webview-tune`
- 동작 테스트/검증 → `game-qa`
- 저작권/라이선스 점검 → `ip-license-guard`
- 60fps 성능 최적화 → `perf-60fps`

## 핵심 원칙
1. **엔진:** Phaser 4 (vendored `engine/phaser.min.js`, **v4.1.0**, MIT). 물리는 Arcade.
   정확한 v4 API·패턴·Gotcha 는 `reference/phaser/INDEX.md`(공식 Phaser 4 스킬 28종 벤더링)에서
   관련 문서를 골라 읽고 적용한다. v3 관용구(`group.children.iterate`·`setTintFill`·`Geom.Point`·
   `roundPixels` 기본값 등)는 INDEX 의 'v3→v4 핵심 차이' 치트시트로 교정한다.
   **렌더 스타일은 게임당 하나** — 픽셀(`PixelForge` + `pixelArt:true`) 또는 미려한 스무스
   (`VectorForge` + `pixelArt:false, antialias:true`). 사용자 취향에 맞춰 택1, 섞지 않는다.
2. **에셋 = CC0 / IP-safe:** 외부 저작물(닌텐도 마리오 스프라이트·이름 'Mario'·시그니처
   조합 등) 절대 금지. 기본은 `PixelForge` 절차적 픽셀아트(코드 생성). CC0 팩(Kenney 등)을
   쓸 땐 `assets.json` 라이선스 게이트로 CC0 만 허용하고 `CREDITS.txt` 를 남긴다.
3. **모바일 웹뷰 필수 요소:** `MobileHarness` 의 Scale.FIT, 'Tap to start' 오디오 언락,
   멀티터치 가상 컨트롤, 뷰포트/CSS 리셋을 항상 포함.
4. **완성도:** 스프라이트 애니메이션, HUD/UI, 사운드, 적/아이템/골인까지 갖춘다.
5. **검증:** 만든 뒤 로컬 서버로 띄워 부팅/동작을 확인하고 보고한다.

## 빌드 워크플로

### 0) 요청 명확화 — 게임 청사진 인터뷰 (빌드 전 필수)
요청이 한 줄·모호하거나 아래 핵심 차원이 명시돼 있지 않으면, 코드를 짜기 전에 **[reference/game-interview.md](./reference/game-interview.md)
의 탑다운·조합주도 1문1답 인터뷰**를 수행한다(오케스트레이션 시작 시 **온디맨드 Read**). 이 인터뷰는 oh-my-claudecode `deep-interview`
방법론을 게임 설계에 적응시킨 것으로, **추상적 객관식 1회로 끝내지 말 것** — 3대 정신:
- **탑다운으로 내려간다.** 넓은 맥락(C1 플랫폼·타깃 유저)부터 묻고 → 코어 → 재미 조합 → 아트 → 사운드 → 승패·분량 → 조작으로 좁힌다.
- **재미 요소 조합은 사용자가 주도한다(1순위).** 완성 아키타입을 통째로 들이밀지 말고, `FE-*` 팔레트를 펼쳐(`AskUserQuestion` multiSelect)
  사용자가 **직접 2~4개를 조합**하게 한다. 조합을 받으면 **구체적 한 컷으로 반영 → "괜찮나요?" 검증 → 본인의 다른 아이디어(대안) 제시** 루프를 돈다.
- **모호성이 풀릴 때까지 끈질기게.** 1문1답으로 가장 약한 차원 하나씩, 매 라운드 Claude가 game-dna 기반 참신한 컨셉을 *먼저* 제안하고
  본인 의견을 밝힌다(백지 금지). 추상적 답은 구체 사례로, 안티패턴 충돌은 절충안으로 되묻는다.

준비도 게이트(C1 확정 + C2 코어·C3 재미조합·C4 아트/테마 구체화 + 나머지 기본값) 충족 시 **청사진을 한 화면으로 읽어주고 최종 확인**한 뒤에만 스캐폴딩한다.
사용자가 "알아서/그냥 만들어"라고 하면 추천 기본값으로 청사진을 완성해 진행한다.
특히 **아트 스타일**(픽셀 vs 미려한 스무스)은 결과물 인상을 가장 크게 좌우하므로 명시가 없으면 인터뷰에서 **반드시** 확정한다.
요청이 이미 구체적이면(플랫폼·코어·재미조합·아트·사운드·분량이 다 적혀 있으면) 인터뷰를 건너뛰고 바로 빌드한다.

**게임 DNA로 제안·조합 (인터뷰에서 Claude가 제안할 컨셉의 출처):** 지난 10여 년 인기 2D 게임 35종의
재미 요소를 분석한 `reference/game-dna/`를 활용한다. 요청이 모호하거나("재밌는 거 만들어줘")
사용자가 방향을 고민하면, [game-dna/INDEX.md](./reference/game-dna/INDEX.md)와
[game-dna/fun-elements.md](./reference/game-dna/fun-elements.md)의 **§4 조합 설계법** 4단계를 따른다:
1. **템플릿 아키타입 제시** — 검증된 조합 레시피(예: '리듬 정밀 러너', '불릿헤븐 러너', '점증 스택 타워',
   '규칙조작 그리드 퍼즐')에서 3~4개를 골라 `AskUserQuestion` 옵션으로 제시(첫 옵션 "(추천)", 설명은 한 문장 컨셉).
   요청에 이미 장르 단서가 있으면 그 코어 루프를 고정하고 이 단계는 생략.
2. **강조할 재미요소 선택** — 코어 루프에 잘 붙는 `FE-*` 재미요소 2~3개를 묻는다(옵션 라벨=한글명, 설명=정의 요약).
   이때 fun-elements.md의 **안티패턴(§3)**을 내부 가드로 적용 — 충돌 조합(예: 젠 분위기 + 극한 시간압박,
   사고형 퍼즐 + 실시간 가속)을 고르면 그대로 만들지 말고 "둘 다 살리려면 구간을 나눠야 하는데 어느 쪽을
   코어로 할까요?"로 되묻는다.
3. **조합 설계** — 코어 루프 1개 + 재미요소 2~3개로 신작 컨셉을 조립한다. 만들 게임과 가까운 **장르 파일
   1~2개를 Read**해 핵심 메카닉·우리 엔진 재현 노트·IP 안전 메모를 반영한다(예: 정밀 플랫포머 → platformers.md의 Celeste 항목).
4. **장르 스킬 라우팅** — 확정된 코어 루프를 아래 "전문 스킬 라우팅"으로, 선택된 재미요소별 `engine_impl`이
   가리키는 제작요소 스킬(juice-fx·chip-sound·game-ui-hud·level-designer 등)로 잇는다.

인터뷰에서 구체화할 차원 (game-interview.md §2; **탑다운 순서**로 캔다 — 이미 말한 건 다시 묻지 않는다):
1. **C1 플랫폼·타깃 유저** ★맨 먼저 — 모바일 웹뷰/데스크톱/둘 다·가로세로 + 타깃 유저층(캐주얼·키즈·코어 퍼즐러·레트로 팬 등). 난이도·아트·조작·세션을 프레이밍.
2. **C2 코어 루프/장르** ★필수 — 플레이어가 매 순간 하는 행동 한 문장(플랫포머·슈팅·아케이드·퍼즐·러너 등 코어 + game-dna 아키타입).
3. **C3 재미 요소 조합(`FE-*`)** ★★핵심·사용자 주도 — `FE-*` 팔레트를 펼쳐(multiSelect) 사용자가 직접 2~4개 조합. 받으면 **구체적 한 컷 반영 → 검증 → 대안 제시**.
4. **C4 아트 스타일·테마** ★필수 — 픽셀(`PixelForge`) vs 미려한 스무스/벡터(`VectorForge`) + 결(플랫·네온글로우·글래스·카툰) + 테마/마스코트.
5. **C5 사운드·음악 결** — 무드 토큰(유쾌/긴박/쓸쓸/평온…) + 음색 패밀리(칩튠/신스웨이브/앰비언트/로파이/아케이드) + SFX 톤. 결만 잡고 본격 설계는 `sound-architect`(SoundForge=Tone.js, 8비트 너머) 게이트로 위임. 아주 작은/레트로면 `ChipAudio` 8비트. BGM은 오리지널(절차 합성·CC0).
6. **C6 승패·진행·분량/난이도** — 승리/실패, 1레벨 vs 레벨팩, 난도 곡선, 점수·별점·베스트·시드 공유. 타깃 유저에서 기본값 도출.
7. **C7 조작** — 입력(키보드/스와이프/탭/드래그). 보통 C1에서 파생 → 자동 확정.

규칙 (자세한 진행은 [reference/game-interview.md](./reference/game-interview.md)):
- **탑다운·1문1답으로** C1부터 아래로, 가장 약한 차원을 깊게 캔다 — 4문항을 한 `AskUserQuestion`에 묶지 않는다(C3 조합만 multiSelect 한 질문 허용). 매 라운드 타깃 차원 + "왜 지금".
- **C3 재미 조합은 사용자가 주도** — 완성 아키타입 강매 금지. `FE-*` 팔레트(multiSelect)로 직접 조합하게 하고, 받으면 **구체적 한 컷으로 반영 + "괜찮나요?" 검증 + 본인의 다른 아이디어(대안) 제시**.
- **매 라운드 Claude가 game-dna 기반의 참신한 컨셉을 *먼저* 제안**하고 본인 추천·의견을 밝힌다(빈 객관식 금지). 사용자는 고르거나 자유 입력.
- 추상적 답은 구체 사례로 되묻고, 안티패턴 충돌(연역+실시간가속, 우아한해+강RNG 등)은 절충안으로 되묻는다.
- 준비도 게이트(C1 확정 + C2·C3·C4 구체 + 나머지 기본값) → **청사진을 한 화면으로 읽어주고 최종 확인** → **그 뒤에만** 스캐폴딩.
- 사용자가 "알아서/추천대로/아무거나/그냥 만들어"라고 하면 추천 기본값으로 청사진을 완성해 바로 진행한다.
- 멀티플레이어·서버 메타·3D·정밀 강체 물리가 섞인 레퍼런스를 차용할 땐, game-dna의 재현 노트대로
  단일플레이 축소(로컬 리더보드·고스트·시드 공유, 단순 임펄스 모델)로 만들 것임을 사용자에게 미리 알린다.

### 1) 요청 분석
- 명확화된 정보로 장르/메카닉/아트 스타일/캐릭터/레벨 규모/모바일 여부를 확정한다.
- 아트 스타일에 따라 렌더 설정과 에셋 스킬을 고른다: 픽셀 → `pixelArt:true` + `sprite-forge`,
  스무스 → `pixelArt:false, antialias:true` + `vector-graphics`.

### 1.5) Phaser 4 API 레퍼런스 선택 (코드 작성 전 필수)
엔진은 **Phaser 4.1.0**. 코드를 짜기 전에 `reference/phaser/INDEX.md` 의 라우팅 표에서 이번 작업과
관련된 Phaser 4 문서(예: 플랫포머 → `physics-arcade`·`sprites-and-images`·`animations`·`cameras`)를
골라 읽고, 거기 명시된 v4 API/패턴/Gotcha 대로 작성한다. 떠오르는 v3 관용구는 INDEX 의
'v3→v4 핵심 차이' 치트시트로 반드시 교정한다(우리 엔진 라이브러리는 v4 에서 동작 검증됨).

### 2) 폴더 스캐폴딩
`games/<slug>/` 에 `index.html` + `game.js` 를 만들고 `engine/` 를 공유 참조한다.
가장 빠른 길은 **`games/super-runner/` 를 복제 후 개조**하는 것이다.

```
games/<slug>/
├── index.html      # 모바일 하니스(뷰포트 meta + CSS 리셋) + 스크립트 로드
├── game.js         # Boot/Title/Game/UI 씬 + 레벨 + 메카닉
└── CREDITS.txt     # 사용 에셋/라이브러리 라이선스
```

`index.html` 은 `super-runner/index.html` 의 `<head>`(뷰포트 meta + CSS 리셋)와
스크립트 로드 순서(phaser → pixelforge → audio → mobile → game)를 그대로 따른다.
**Phaser 고급·입력 킷 5종**(`matterkit`·`screenfx`·`lightingkit`·`pathkit`·`joystickkit`)을 쓰는 게임은 그 킷의
`engine/*.js` 를 **phaser 다음·game 이전**에 추가한다(미사용 게임엔 넣지 않는다). 통합 예시는
`games/nocturne/index.html`(스무스/벡터 스타일, Matter+포스트FX+라이팅+경로) 참고.
입력 킷은 장르로 고른다 — 아날로그/트윈스틱은 `joystickkit`(데모 `tiled-topdown?stick=1`), 디지털 좌우+점프는 `mobile.js`의 D-패드.
**`sound-architect`(SoundForge) 사운드**를 쓰는 게임은 `engine/tone.js` → `engine/soundforge.js` 를
**phaser 다음·game 이전**(soundforge 는 tone 다음)에 추가한다. 8비트 ChipAudio(`engine/audio.js`)만
쓰는 게임엔 tone/soundforge 를 넣지 않는다(게임당 한 오디오 엔진).
**`ability-architect`(AbilityKit) 능력 시스템**(T2+)을 쓰는 게임은 `engine/abilitykit.js` 를 **phaser 다음·game 이전**에 추가한다(능력 1~2개 단순 게임은 game.js 직접 코딩, 미사용 게임엔 넣지 않는다).

### 3) 에셋 생성 / 소싱
- **먼저 아트 출처를 가른다(결정 게이트).** 비주얼은 재미의 핵심이므로, 인터뷰(C4)에서 **실제 에셋을
  골라 쓸지 / 절차 생성할지**를 사용자에게 묻는다. "실제 에셋·시각적으로 고르고 싶다"이거나 사용자가
  스프라이트를 *선택*하려는 기색이면 [`sprite-picker`](../sprite-picker/SKILL.md) 로 위임한다(CC0 카탈로그·
  로컬 파일·이전 사용분을 브라우저 갤러리로 시각 선택 → 다운로드·벤더링·로드). 절차 생성이면 아래로.
- 스프라이트는 문자 그리드로 정의한다. `PixelForge.LIB` 에 새 항목을 추가하거나 게임별로
  `PixelForge.bake(scene, key, def)` 를 직접 호출한다.
- `def = { frames: [ ["row","row",...], ... ], palette?: {char:hex} }`.
  라가드 행은 오른쪽이 투명으로 자동 패딩되므로 폭을 맞출 필요 없다.
- 애니메이션은 `scene.anims.create({ key, frames:[{key, frame}], frameRate, repeat })`.
- 자세한 API 는 `reference/engine-api.md` 참고.

### 4) 사운드 — 두 레인 (게임당 하나)
사운드는 **디렉터 스킬 [`sound-architect`](../sound-architect/SKILL.md) 가 무드 인터뷰로 설계**한다(make-game 사운드 게이트). 엔진은 둘 중 하나:

**A. SoundForge (8비트 너머 · `engine/soundforge.js` = Tone.js v15)** — 기본. 장르·무드 음악·적응형 레이어드·풍부한 SFX.
- 로드: `index.html` 에 `engine/tone.js` → `engine/soundforge.js`(phaser 다음·game 이전).
- `var GAME_AUDIO = new SoundForge(AUDIO_SPEC)` → 전역 `window.GAME_AUDIO = GAME_AUDIO`(음소거/가시성 가드가 참조). `AUDIO_SPEC` = `games/<slug>/audio.json`.
- 첫 제스처('Tap to start')에서 `GAME_AUDIO.unlock()` + `GAME_AUDIO.startBgm()`. 효과음 `GAME_AUDIO.sfx('jump'|'coin'|'hit'|'explosion'|...)`.
- 적응형: `GAME_AUDIO.setIntensity(0..1)`(전투 격화)·`GAME_AUDIO.setSection('explore'|'combat'|'boss')`(섹션 전환).
- 검수: `node skills/sound-architect/tools/lint-audio.mjs games/<slug>/audio.json`.

**B. ChipAudio (8비트 경량 · `engine/audio.js`)** — 아주 작은/레트로 게임(T0, [`chip-sound`](../chip-sound/SKILL.md)).
- `var audio = new ChipAudio()` → 전역 `window.GAME_AUDIO = audio`. 첫 제스처에서 `audio.unlock()` + `audio.startBgm()`. 효과음 `audio.sfx('jump'|'coin'|'stomp'|...)`.

두 엔진 모두 **인터페이스 동일**(`unlock/resume/suspend/toggleMute/startBgm/stopBgm/sfx`)이라 `mobile.js`(음소거·가시성 가드)가 무수정으로 동작한다.
- **BGM 멜로디·SFX 는 반드시 오리지널**(절차 합성, 기존 게임 음악 인용 금지 · 100% CC0).

### 5) 모바일 하니스 (`engine/mobile.js`)
- config.scale 에 `MobileHarness.scaleConfig(DESIGN_W, DESIGN_H)` 를 펼친다(FIT+CENTER).
- Boot 에서 `MobileHarness.installDomGuards()` + 터치 씬 등록:
  `var TC = MobileHarness.TouchControlsClass(DESIGN_W, DESIGN_H, GAME_INPUT);
   this.scene.add('TouchControls', TC, false);`
- 게임 시작 시 `Game`, `UI`, `TouchControls` 를 함께 launch.
- 키보드는 게임 씬에서 직접 읽고, 터치 상태는 공유 객체 `GAME_INPUT`(left/right/up)로 합친다.

### 6) 게임 구조 (`game.js`)
- 씬 분리: `Boot`(에셋 생성) → `Title`(Tap to start, 오디오 언락) → `Game`(플레이) →
  `UI`(HUD, 스크롤 X) + `TouchControls`(최상단).
- 플랫포머 메카닉 레시피는 `super-runner/game.js` 참고: 가변 점프(코요테/버퍼), 적 밟기,
  코인/블록/파워업, 카메라 추적, 구덩이/골인, 목숨/타임/점수.
- 디자인 해상도는 16:9 근처(예: 384x224, TILE 16). `pixelArt:true`.

### 7) 검증 (필수)
```bash
# 프로젝트 루트에서
python -m http.server 8766
```
- 브라우저로 `http://127.0.0.1:8766/games/<slug>/index.html` 을 열어 부팅/동작 확인.
- 가능하면 chrome-devtools/preview MCP 로 모바일 뷰포트 스크린샷 + 콘솔 에러 점검.
- 헤드리스 캡처는 `?autostart=1` + `window.SuperRunner.game.step(t,dt)` 로 프레임을 수동
  전진시킬 수 있다(WebGL preserveDrawingBuffer 한계로 라이브 캡처는 불안정할 수 있음).

## IP/라이선스 안전 체크리스트
- [ ] 닌텐도 등 타사 스프라이트/사운드/폰트/레벨 미사용 (전부 CC0 또는 절차적 생성).
- [ ] 보호된 이름('Mario' 등)·시그니처 조합(빨간모자+콧수염+파란멜빵+배관공+이탈리안) 미사용.
      마리오 '느낌'은 색 단서 1개만 남기고 나머지를 바꿔서 표현(예: 빨간 모자 + 다른 의상).
- [ ] 메카닉/장르(옆스크롤·점프·밟기·코인·깃발 골)는 자유롭게 구현 가능.
- [ ] Phaser(MIT) 등 라이브러리 라이선스를 `CREDITS.txt`/`LICENSES/` 에 명시.
