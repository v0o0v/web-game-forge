---
name: sound-architect
description: >
  게임의 전체 사운드(BGM·효과음·음향 정체성)를 설계하고 게임에 입힌다 — 8비트 칩튠을 넘어
  장르·무드에 어울리는 음악과 효과음을 절차적으로 합성하는 상위 스킬. Tone.js(vendored) 기반
  engine/soundforge.js 로 ADSR·필터·슈퍼소우·FM·노이즈 퍼커션·절차 리버브·적응형 레이어드 음악을
  코드 합성한다(오디오 파일 0개, 100% CC0). 현재 게임의 코어 동사·STORY.md 톤·장르·아트·플랫폼을
  먼저 분석하고, 의도가 모호하면 탑다운 1문1답으로 끈질기게 캐물어, 매 라운드 Claude가 먼저 귀에
  그려지는 구체적 사운드를 제안하며 사용자가 고르거나 비틀게 한다. **무드를 가장 먼저 못 박고**(무드가
  스케일·BPM·악기·이펙트를 프레이밍), 검증된 사운드 이론(무드→모드/BPM/진행 매핑 / 서브트랙티브·FM·
  노이즈 합성 / 트랜지언트·바디·테일 레이어드 SFX / 장르 음색 / 수직 레이어링 적응형 음악 / 모바일
  폴리포니 예산)으로 설계해 games/<slug>/AUDIO.md 바이블 + audio.json 데이터로 산출하고, SoundForge
  배선·인텐시티·섹션 전환으로 게임에 적용한다. 정량 데이터(스케일·BPM·레이어·보이스·믹스 dB)라
  tools/lint-audio.mjs validator로 무드불협·보이스폭발·레이어도달·믹스를 기계 검증한다. 게임 제작
  초반뿐 아니라 중반에도 사운드 수정·추가/삭제로 언제든 활용한다.
  사운드/음향/소리/사운드트랙/음악/배경음악/브금/BGM/효과음/효과/SFX/음소거/적응형음악/다이내믹뮤직/
  무드/분위기음악/점프음/타격음/획득음/폭발음/UI음을 만들·짜·넣·고치·추가·삭제·믹스·디자인 해 달라는 요청에 사용.
  English: design or revise a game's whole sound — BGM (background music) and SFX (sound effects) — beyond 8-bit
  chiptune. Procedurally synthesizes mood- and genre-appropriate music/SFX with Tone.js (engine/soundforge.js):
  ADSR, filters, supersaw, FM, noise percussion, procedural reverb, adaptive vertical-layered music. Zero audio
  files, 100% CC0. Locks mood first, interviews top-down, proposes concrete sounds, applies mood→mode/BPM/
  progression mapping + layered SFX + genre timbres + adaptive layering + mobile polyphony budget, outputs
  games/<slug>/AUDIO.md + audio.json, machine-validates with lint-audio.mjs. Usable at start or mid-development.
  Keywords: sound, audio, music, background music, BGM, soundtrack, SFX, sound effect, jump sound, hit sound,
  coin sound, explosion, UI sound, mute, mood music, adaptive music, dynamic music, synth, chiptune, synthwave,
  ambient, lo-fi, mix, sound design.
  레벨 난이도는 level-architect, 진행 맵은 world-map-architect, 톤·스토리는 story-architect, 아이템은 item-architect 소관 — 이 스킬은 그 위에 입히는 '소리'다. 8비트만 충분하면 chip-sound 경량 레인.
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, WebSearch, WebFetch
---

# sound-architect — 게임 사운드 디렉터 (BGM·효과음·음향 정체성)

게임에 **'어떤 소리가 나는가 — 어떤 감정을 귀로 전하는가'를 입히는** 상위 스킬. 8비트 칩튠 한 종을 넘어, **장르·무드에
어울리는 BGM과 효과음**(칩튠·신스웨이브·앰비언트·로파이·FM·아케이드·오케스트라풍)을 절차적으로 합성한다. 코드를 바로
짜지 않고 **① 현재 게임 분석 → ② 무드부터 의도를 인터뷰로 명확화 → ③ 검증된 사운드 이론 적용 → ④ AUDIO.md 바이블 +
audio.json 데이터로 산출 → ⑤ 게임 배선(SoundForge·인텐시티·전환) 또는 위임 → ⑥ 검수(validator + 청취, 작성과 분리)**한다.
web-game-builder 워크플로의 일부. `reference/sound-design/`(검증된 사운드 설계 통념을 광범위 웹 리서치로 모아 작은 2D
웹게임용으로 정리한 라이브러리)로 설계하고, 합성은 `engine/soundforge.js`(Tone.js v15 vendored 래퍼)에 위임한다.

> **역할 분리 (6계층).** 같은 게임을 여러 스킬이 다른 층에서 본다 — 반드시 구분한다.
> - **무엇을 플레이하나(재미·메카닉):** 재미요소 `FE-*` — [game-dna/fun-elements.md](../web-game-builder/reference/game-dna/fun-elements.md)
> - **개별 레벨의 내용·난이도:** `LD-*` — [`level-architect`](../level-architect/SKILL.md)
> - **스테이지를 잇는 진행 맵:** `MAP-*` — [`world-map-architect`](../world-map-architect/SKILL.md)
> - **톤·이야기·캐릭터·대사:** [`story-architect`](../story-architect/SKILL.md)
> - **습득·사용하는 모든 것:** [`item-architect`](../item-architect/SKILL.md)
> - **그 위에 입히는 소리(BGM·SFX·음향 정체성):** `MOOD SYNTH SFX TIMBRE ADAPT MIX-*` — **이 스킬** ([reference/sound-design/INDEX.md](./reference/sound-design/INDEX.md))
>
> **사운드 ≠ 무조건 풀 오케스트라.** 우리 게임은 작은 2D 웹게임이다. **디폴트는 한 무드·한 음색 패밀리(T1)** — 많은 게임은
> 그걸로 완결된다. 아주 작은/레트로 게임은 [`chip-sound`](../chip-sound/SKILL.md)(ChipAudio 8비트, T0)로 충분하다. 적응형
> 레이어드 음악(T3)은 *상태가 음악을 바꿔야* 할 때만. 모바일 동시 보이스 16 예산을 항상 지킨다.

## 언제 사용
- 새 게임에 **전체 사운드(무드·BGM·SFX)를 처음 설계**할 때(web-game-builder가 "사운드 설계할까요?"로 위임)
- **무드/분위기를 정해 몰입**을 만들고 싶을 때("긴박한 음악", "쓸쓸한 느낌", "경쾌한 칩튠", "신스웨이브로")
- **BGM·효과음을 추가/수정**하고 싶을 때("점프음 넣어줘", "폭발음 묵직하게", "보스 음악", "획득음 더 또렷하게")
- **적응형 음악**(전투 격화 시 음악이 격해지거나, 탐험→전투→보스 전환)을 원할 때
- **제작 중반에 사운드를 수정**하거나 무드를 바꿀 때(AUDIO.md/audio.json을 단일 진실로 갱신)
- 사운드가 "밋밋하다/8비트가 한계다/SFX가 BGM에 묻힌다/모바일에서 끊긴다"를 진단하고 **믹스 리뷰**를 할 때

## 핵심 원칙
1. **분석 먼저.** 진공에서 사운드를 발명하지 않는다 — 현재 game.js 의 **코어 동사·장르·기존 사운드(ChipAudio 호출)·STORY.md 톤·아트·플랫폼·세션 길이**를 찾아 *그 위에* 설계한다. 음악이 코어 동사·톤과 같은 말을 하게 한다(`MOOD-LUDO-HARMONY`).
2. **무드를 가장 먼저 못 박는다.** story-architect가 톤을, item-architect가 복잡도를 먼저 정하듯, 이 스킬은 **무드 토큰 1개 + 복잡도 티어(0~3)**를 먼저 확정한다(`MOOD-LOCK-FIRST`). 무드가 스케일·BPM·악기·진행·이펙트를 전부 프레이밍한다 — **단순/적응형을 사용자에게 적극 묻는다**.
3. **의도가 모호하면 끈질기게 묻고, Claude가 먼저 구체적 사운드를 제안한다.** 탑다운 1문1답 인터뷰([reference/sound-interview.md](./reference/sound-interview.md))로 약점 차원을 캔다. 빈 객관식 금지 — 매 라운드 *귀에 그려지는 한 컷*을 먼저 내고 의견을 밝힌다. 사용자는 고르거나 비틀거나 자유 입력.
4. **한 게임 한 음색 패밀리.** 칩튠과 오케스트라를 섞지 않는다(`TIMBRE-ONE-FAMILY`). 합성 스타일가이드(AUDIO.md §6)를 모든 트랙·SFX가 상속.
5. **SFX는 먼저 피드백.** 효과음의 1차 목적은 *게임 상태를 귀로 알리는 것*. 멋보다 명료성 — BGM에 묻히지 않게(`SFX-FEEDBACK-CLARITY`), 8비트 너머는 트랜지언트+바디+테일 레이어드로(`SFX-LAYER-3`).
6. **단일 진실 + 작성/검수 분리.** 모든 사운드는 `games/<slug>/AUDIO.md`(바이블) + `audio.json`(기계 데이터)을 **유일한 출처**로 생성한다(`AUDIO-SINGLE-SOURCE`). 설계(③④)와 **검수(⑥: `lint-audio.mjs` + 청취)는 반드시 다른 패스**로 분리한다.
7. **모바일 예산 + CC0.** 동시 16보이스·이펙트 재사용(`MIX-VOICE-BUDGET`). 멜로디는 스케일+모티프에서 절차 생성해 오리지널 보증, 시그니처 곡 인용 금지(`CC0-ORIGINAL`).

## 워크플로

### 0) 현재 게임 분석 (필수 · 설계 전)
대상 게임의 `game.js`(또는 게임 디렉터리)와 있으면 기존 `AUDIO.md`/`audio.json`·`STORY.md`를 Read 해서 파악한다:
- **코어 동사·장르·스캐폴드** — 플레이어가 매 순간 하는 행동(점프·쏘기·매치·달리기)과 장르. 무드·음색의 출발점(`MOOD-LUDO-HARMONY`/`TIMBRE-FIT`).
- **기존 사운드** — `ChipAudio`/`SoundForge` 호출, `GAME_AUDIO.sfx(...)` 이벤트, BGM 유무. *어디에 사운드를 얹을 자리*가 있는지.
- **서사·톤** — STORY.md가 있으면 톤·무드를 상속(`MOOD-LUDO-HARMONY`). 없으면 장르·아트에서 추론.
- **플랫폼·세션·아트** — 모바일/데스크톱, 한 판 길이, 픽셀(PixelForge) vs 스무스(VectorForge). 복잡도 티어·보이스 예산의 상한.

분석 결과를 **한 화면 요약**(코어 동사 · 장르/스캐폴드 · 기존 사운드 · 톤 · 플랫폼/세션 · 추정 무드·티어)으로 읽어준 뒤 1)로 간다.

### 1) 의도 분석 + 사운드 인터뷰 (무드 먼저, 모호하면 계속 질문)
요청이 한 줄·모호하거나 핵심 차원이 비면 **온디맨드로 [reference/sound-interview.md](./reference/sound-interview.md)를 Read** 해 탑다운 1문1답 인터뷰를 수행한다(`deep-interview` / story·item-interview 적응판):
- **탑다운 순서**(S1 **무드·복잡도 ★먼저** → S2 음색 패밀리 → S3 BGM 구조 → S4 SFX 팔레트 → S5 적응형 → S6 믹스·모바일), 약점 차원 하나씩 + "왜 지금".
- **S1에서 무드 토큰 + 복잡도 티어(0~3)를 못 박는다.** T0(chip)이면 인터뷰 대부분 건너뛰고 [`chip-sound`](../chip-sound/SKILL.md)로 — **단순해도 된다고 적극 안내**.
- **매 라운드 Claude가 먼저 귀에 그려지는 구체적 사운드를 제안**(백지 금지)하고 의견을 밝힌다. 추상적 답("멋진 음악")은 구체 무드/스케일/음색으로 되묻는다.
- **준비도 게이트**(S1 무드+티어 + S2 음색 + S3 BGM 뼈대) 충족 전엔 바이블을 확정하지 않는다.
- 사용자가 "알아서/그냥 만들어"면 분석 기반 추천 기본값으로 채워 진행한다.

### 2) 사운드 이론 적용 (설계 전 필수 Read)
[reference/sound-design/INDEX.md](./reference/sound-design/INDEX.md) 라우팅으로 **[principles.md](./reference/sound-design/principles.md)**(엔진 제약·복잡도 4티어·모바일 예산·캐논·안티패턴·장르처방) + **[mood-music-theory.md](./reference/sound-design/mood-music-theory.md)**(무드를 먼저) + 티어·장르에 맞는 도메인 파일 1~3개를 Read 하고, 설계 결정마다 원칙 code를 한 줄 근거로 단다:
- **무드→음악** → [mood-music-theory.md](./reference/sound-design/mood-music-theory.md) (`MOOD-*`). 항상 먼저. 스케일/모드·BPM·진행·절차 멜로디.
- **음색 합성** → [synthesis-recipes.md](./reference/sound-design/synthesis-recipes.md) (`SYNTH-*`). ADSR·서브트랙티브·슈퍼소우·FM·노이즈 퍼커션 — Tone.js 매핑.
- **효과음** → [sfx-design.md](./reference/sound-design/sfx-design.md) (`SFX-*`). 트랜지언트+바디+테일·피치 엔벨로프·피드백 명료성.
- **장르 음색** → [genre-timbres.md](./reference/sound-design/genre-timbres.md) (`TIMBRE-*`). 칩튠/신스웨이브/앰비언트/로파이/16비트FM/아케이드/오케스트라풍.
- **적응형** → [adaptive-music.md](./reference/sound-design/adaptive-music.md) (`ADAPT-*`). 수직 레이어링·수평 리시퀀싱·인텐시티·최소형(T3).
- **믹스·모바일** → [mix-mobile.md](./reference/sound-design/mix-mobile.md) (`MIX-*`). 마스터 체인·send·보이스 예산·언락/suspend·덕킹.
- **바이블/툴 스펙** → [consistency-tools.md](./reference/sound-design/consistency-tools.md). AUDIO.md/audio.json 스펙 + 린트 체크리스트(a~h) + 툴 매트릭스.
- **라이브 웹 리서치(WebSearch/WebFetch):** 내장 원칙은 광범위 웹 리서치(`.omc/research/sound-research-dossier.md`)를 작은 웹게임용으로 정리한 1차 라이브러리이니 **항상 먼저 적용**. 그 위에, 특정 장르·레퍼런스 작품의 *사운드 결*이 필요하면 그 장르 음향 관습·합성 기법을 능동 리서치해 보강한다. **IP 안전 가드**: 합성 기법·음악 구조만 차용, 특정 곡 멜로디/진행+멜로디 결합은 오리지널 재구성([`ip-license-guard`](../ip-license-guard/SKILL.md)).

### 3) AUDIO.md 바이블 + audio.json 산출 (games/<slug>/ · 단일 진실)
이론을 적용해 game.js 옆에 **`games/<slug>/AUDIO.md`(사람용 설계 바이블)** + **`games/<slug>/audio.json`(기계용 데이터 = SoundForge 로드 + 린터 입력)**을 만든다(스펙: [consistency-tools.md](./reference/sound-design/consistency-tools.md)). 복잡도 티어에 비례해 섹션을 켜고 끈다(T0~1은 §0·§1·§3만).
- AUDIO.md 섹션: §0 메타(티어·엔진·무드) · §1 무드·음악정체성 · §2 BGM 트랙&레이어 · §3 SFX 팔레트 · §4 적응형/전환 · §5 믹스&모바일예산 · §6 합성 스타일가이드(헤더 상수) · §7 검수 로그.
- **audio.json**: `meta`·`master`·`budget`·`bgm.tracks[].layers[]`·`sfx`·`balanceConfig`. preset/pattern/scale enum은 `SoundForge`와 1:1. `originalityNote` 명시(`CC0-ORIGINAL`).

### 4) 게임 적용 / 위임 (★SoundForge 배선)
audio.json을 SoundForge에 연결하고, 사운드 트리거를 게임 이벤트에 1:1로 적용하거나 web-game-builder로 위임한다:
- **엔진 로드(index.html):** `super-runner/index.html`의 스크립트 순서에 **`engine/tone.js` → `engine/soundforge.js`** 를 phaser 다음·game 이전에 추가(soundforge 는 tone 다음). T0(chip)이면 기존 `engine/audio.js` 그대로.
- **인스턴스·전역 등록(game.js):** `var GAME_AUDIO = new SoundForge(AUDIO_SPEC); window.GAME_AUDIO = GAME_AUDIO;`(mobile.js 음소거/가시성 가드가 참조). `AUDIO_SPEC`은 audio.json을 fetch 또는 인라인.
- **언락·BGM(Title 씬):** 첫 제스처에서 `GAME_AUDIO.unlock(); GAME_AUDIO.startBgm();`(`MIX-UNLOCK`).
- **SFX(게임 이벤트):** `GAME_AUDIO.sfx('jump'|'hit'|'coin'|'explosion'|...)`. audio.json `sfx` 키가 있으면 그걸, 없으면 내장 프리셋.
- **적응형(T3):** 게임 상태에서 `GAME_AUDIO.setIntensity(0..1)`(전투 격화)·`GAME_AUDIO.setSection('explore'|'combat'|'boss')`(섹션 전환).
- **연출 정합:** 획득/타격 연출은 [`juice-fx`](../juice-fx/SKILL.md)와, 무드 색은 [`vector-graphics`](../vector-graphics/SKILL.md)/PixelForge와, flavor·톤은 [`story-architect`](../story-architect/SKILL.md)와 교차.
- **중반 수정·추가/삭제:** AUDIO.md/audio.json을 단일 진실로 갱신한 뒤 영향받은 트리거만 재배선(바이블 → 코드 한 방향).

### 5) 검수 패스 + 오디오 린트 (작성과 분리 · 필수)
**별도 패스로** audio.json을 validator로 기계 검증하고 AUDIO.md §7에 결과를 적는다(체크리스트: [consistency-tools.md](./reference/sound-design/consistency-tools.md)):
```bash
node skills/sound-architect/tools/lint-audio.mjs games/<slug>/audio.json
```
- 검출: (a) 스키마/enum, (b) 무드↔스케일/BPM 정합, (c) 보이스 예산 초과, (d) 레이어 도달성/베드, (e) 프리셋↔패턴 정합, (f) 믹스 안전범위, (g) CC0 오리지널리티. 임계값은 audio.json `budget`/`balanceConfig`에서 읽는다.
- **청취 보강(h):** 로컬 서버(`python -m http.server 8766`)로 띄워 "무드가 게임과 같은 말을 하나? SFX가 BGM에 묻히나? 모바일에서 끊기나? 루프 이음새가 튀나?"를 *직접 듣고* 점검. 가능하면 chrome-devtools/preview MCP로 콘솔 에러·Tone 초기화 확인 후 [`game-qa`](../game-qa/SKILL.md)로 점검 → **근거와 함께 보고**.
- 위반은 **사람이 보게 리포트**하고 재생성한다.

## 사운드 자동 개입 (무드 일관성 · 빈 슬롯 채움)
게임 제작/수정 중 **사운드가 필요한 자리가 생기면 이 스킬이 능동 개입**해 채운다 — 단, 즉흥이 아니라 AUDIO.md를 참조해 일관되게.
- **개입 신호:** (a) game.js에 새 이벤트(보스 등장·아이템 획득·피격)가 생겼는데 `GAME_AUDIO.sfx(...)` 호출이 비어 있을 때, (b) BGM 무드가 정해지지 않았거나 placeholder일 때, (c) 사용자가 "여기 효과음/음악 넣어줘" 류를 말할 때, (d) story/item-architect가 새 연출·아이템을 추가하며 사운드를 요청할 때.
- **개입 절차:** ① 무드·음색 패밀리가 AUDIO.md에 있으면 그 스타일가이드(§6)를 컨텍스트로 SFX/트랙을 자동 작성. ② 없으면 **1~2문항 미니 인터뷰**로 무드·복잡도만 캐고 §0·§1에 등록한 뒤 작성(의도가 꼭 필요할 때만 질문, 아니면 코어 동사·STORY.md 톤에서 추론). ③ 생성된 모든 SFX/트랙은 **게이트**(무드 정합 + 보이스 예산 + 피드백 명료성 + ChipAudio 호환 키 + 모바일 언락)를 통과해야 출력 — 위반 시 재생성. 자세한 규칙: [sound-design/INDEX.md](./reference/sound-design/INDEX.md).

## make-game 적용 게이트 (반드시 묻는 항목)
- **make-game 적용:** web-game-builder/make-game 흐름에서 게임 청사진 인터뷰(+서사·아이템 게이트) 직후 **"이 게임에 sound-architect로 사운드(무드·BGM·효과음)를 설계해 적용할까요?"를 반드시 묻는다**. '네'면 이 워크플로로(무드부터), '아니요'면 장르 기본 사운드(ChipAudio 8비트 또는 SoundForge 기본 무드 1개)만, '나중에'면 게임부터 만들고 중반에 이 스킬로 추가(초·중반 어디서든 가능).
- **단순함 적극 안내:** 아주 작은/레트로 게임이면 "8비트 ChipAudio(T0)로도 충분합니다"를 먼저 제시한다 — 과설계를 권하지 않는다(`principles.md` §복잡도).

## 연계 / 라우팅
- **상위:** [`web-game-builder`](../web-game-builder/SKILL.md) 오케스트레이션의 사운드 설계 레인. 명시 호출은 [`commands/make-game.md`](../../commands/make-game.md), 게임 인터뷰 C5(사운드)는 [game-interview.md](../web-game-builder/reference/game-interview.md).
- **경량 레인:** [`chip-sound`](../chip-sound/SKILL.md) — 8비트 ChipAudio(T0). 아주 작은/레트로 게임이나 사운드가 부차적일 때. 이 스킬(sound-architect)이 디렉터, chip-sound가 8비트 구현 레인.
- **자매:** [`story-architect`](../story-architect/SKILL.md)(톤·무드 정합 — 무드는 톤에서 상속) · [`item-architect`](../item-architect/SKILL.md)(획득/사용 SFX) · [`level-architect`](../level-architect/SKILL.md)(구간별 강도↔적응형 인텐시티).
- **구현·연출:** [`juice-fx`](../juice-fx/SKILL.md)(SFX 동반 연출) · [`game-ui-hud`](../game-ui-hud/SKILL.md)(음소거 버튼 UI) · [`game-qa`](../game-qa/SKILL.md)(검증).
- **레퍼런스:** 색인 [reference/sound-design/INDEX.md](./reference/sound-design/INDEX.md) · 공통 원칙 [principles.md](./reference/sound-design/principles.md) · 인터뷰 [sound-interview.md](./reference/sound-interview.md) · 바이블/툴 스펙 [consistency-tools.md](./reference/sound-design/consistency-tools.md). 엔진 [engine/soundforge.js](../../engine/soundforge.js)(Tone.js v15) · 툴 [tools/lint-audio.mjs](./tools/lint-audio.mjs) · Phaser4 오디오 [audio-and-sound](../web-game-builder/reference/phaser/audio-and-sound.md).

## IP 안전
- 사운드 **합성 기법·음악 구조**(ADSR·필터·FM·스케일·모드·코드 진행 관용구·적응형 레이어링 등)는 저작권 대상이 아니므로 자유롭게 차용한다.
- 단, **특정 상용 게임/곡의 고유 멜로디·리프·시그니처(진행+멜로디+리듬 결합)**(마리오·테트리스·젤다 테마 등)를 그대로 코딩하지 않는다 — 기법·구조만 가져와 **오리지널로 재구성**한다(`CC0-ORIGINAL`). 멜로디는 스케일+모티프 변형으로 절차 생성.
- 모든 사운드는 **절차 합성**(오디오 파일 0개) → 음원 저작권·인접권 비해당, 100% CC0. vendored 라이브러리(Tone.js MIT)는 `engine/tone.LICENSE.txt`·`CREDITS.txt`에 명시. 상세는 [`ip-license-guard`](../ip-license-guard/SKILL.md).
