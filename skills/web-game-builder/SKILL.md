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
- 스프라이트/타일/애니메이션 (픽셀아트) → `sprite-forge`
- 미려한 스무스/벡터 그래픽 (그라데이션·글로우·글래스·곡선 캐릭터) → `vector-graphics`
- 효과음/BGM → `chip-sound`
- 레벨/맵/타일맵 → `level-designer`
- HUD/메뉴/UI → `game-ui-hud`
- 파티클/스크린셰이크/게임필 → `juice-fx`

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

### 0) 요청 명확화 (빌드 전 필수)
요청에 아래 항목이 **명시되어 있지 않으면, 코드를 짜기 전에 `AskUserQuestion`으로 사용자에게
최대한 물어본다**(추천 기본값을 첫 옵션에 "(추천)"으로 제시). 특히 **아트 스타일**은 결과물 인상을
가장 크게 좌우하므로 명시가 없으면 **반드시** 묻는다.

**게임 DNA로 제안·조합 (어떤 게임을 만들지 정하는 핵심 도구):** 지난 10여 년 인기 2D 게임 35종의
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

확인할 항목 (명시 안 된 것만; 이미 말한 건 다시 묻지 않는다):
1. **아트 스타일** ★필수 — 픽셀아트(`PixelForge`) vs 미려한 스무스/벡터(`VectorForge`).
   스무스를 고르면 결도: 플랫/머티리얼 · 그라데이션/글로우 · 글래스모피즘 · 카툰 벡터.
2. **장르/메카닉·재미 조합** — 코어 루프(플랫포머·슈팅·아케이드·퍼즐·러너 등) + 강조할 재미요소.
   불명확하면 위 '게임 DNA로 제안·조합'의 아키타입·재미요소 선택으로 함께 좁힌다.
3. **테마/캐릭터** — 분위기·주인공 컨셉(예: 동물 마스코트, 우주, 숲, 네온 도시).
4. **분량/난이도** — 코어 1레벨 vs 멀티레벨, 쉬움/보통/어려움.
5. **타깃** — 모바일 웹뷰 포함 여부(기본 포함)·가로/세로.

규칙:
- **답을 받은 뒤에만** 스캐폴딩을 시작한다.
- 한 번에 너무 많이 묻지 말고 `AskUserQuestion` 1회(최대 4문항)로 핵심만 묶어 묻는다.
  아트 스타일은 항상 포함, 나머지는 명시 안 된 것 위주. 게임 DNA 아키타입/재미요소도 이 1회 질문에 함께 녹인다.
- 사용자가 "알아서/추천대로/아무거나"라고 하면 추천 아키타입 + 추천 아트 스타일로 바로 진행한다.
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

### 3) 에셋 생성 (`engine/pixelforge.js`)
- 스프라이트는 문자 그리드로 정의한다. `PixelForge.LIB` 에 새 항목을 추가하거나 게임별로
  `PixelForge.bake(scene, key, def)` 를 직접 호출한다.
- `def = { frames: [ ["row","row",...], ... ], palette?: {char:hex} }`.
  라가드 행은 오른쪽이 투명으로 자동 패딩되므로 폭을 맞출 필요 없다.
- 애니메이션은 `scene.anims.create({ key, frames:[{key, frame}], frameRate, repeat })`.
- 자세한 API 는 `reference/engine-api.md` 참고.

### 4) 사운드 (`engine/audio.js`)
- `var audio = new ChipAudio()` → 전역 `window.GAME_AUDIO = audio`(음소거 버튼이 참조).
- 첫 사용자 제스처('Tap to start')에서 `audio.unlock()` + `audio.startBgm()`.
- 효과음 `audio.sfx('jump'|'coin'|'stomp'|'powerup'|'die'|'flag'|...)`.
- **BGM 멜로디는 반드시 오리지널**(기존 게임 음악 인용 금지).

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
