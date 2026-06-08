# 사운드 설계 레퍼런스 라이브러리 — 색인 (INDEX)

> [`sound-architect`](../../SKILL.md)가 게임에 **어울리는 BGM·SFX(소리의 정체성)**를 입힐 때 쓰는 코드화 설계 자료다.
> 검증된 사운드 설계 통념(Web Audio 합성·적응형 음악·게임 오디오·음악이론 무드 매핑·ZzFX/jsfxr SFX·모바일 오디오)을
> **작은 2D 웹게임**(단일플레이·무서버·CC0·모바일 짧은세션·Tone.js 합성)에 맞게 적응시켜 약 50개 코드화 원칙으로 정리했다.
> 핵심 목적: 인터뷰에서 *게임에 맞는 무드·음색을 제안*하고, 그것을 *모바일에서 안 깨지게* AUDIO.md + audio.json 으로 산출하는 것.

## 이 라이브러리를 쓰는 법 (중요)

- 이 문서들은 **자동 트리거 스킬이 아니다.** YAML frontmatter 없는 순수 레퍼런스라 스킬 listing 예산(컨텍스트 ~1%)을 먹지 않는다 — `reference/phaser/`·`story-design/`·`item-design/`과 같은 **온디맨드 Read** 방식. 필요할 때만 해당 파일을 읽는다.
- **사운드 설계 단계**(`sound-architect/SKILL.md`의 2단계 "사운드 이론 적용", 인터뷰 [sound-interview.md](../sound-interview.md))에서 의사결정 도구로 쓴다.
- **먼저 [principles.md](./principles.md)를 Read**(엔진 제약·복잡도 4티어 게이트·모바일 예산·공통 캐논·안티패턴·장르→음색 빠른 처방) → 그다음 **항상 [mood-music-theory.md](./mood-music-theory.md)** (무드를 가장 먼저 못 박는다) → 복잡도 티어·장르에 맞는 도메인 파일 1~3개. 설계 결정마다 원칙 code(예: `MOOD-LOCK-FIRST`)를 한 줄 근거로 단다.

## 복잡도 티어 → 읽을 파일 처방

| 복잡도 티어 | 무엇 | 엔진 | 읽을 파일 |
|---|---|---|---|
| **T0 칩 기본** | ChipAudio 8비트 그대로(아주 작은 게임) | `chip` | principles.md(§1)만 — AUDIO.md 사실상 불필요 |
| **T1 단일 무드** | 한 무드 BGM(고정 레이어) + SFX 팔레트 | `soundforge` | + [mood-music-theory.md](./mood-music-theory.md)·[sfx-design.md](./sfx-design.md) |
| **T2 다장르·레이어드** | 장르 음색 + 레이어드 BGM + 레이어드 SFX | `soundforge` | + [synthesis-recipes.md](./synthesis-recipes.md)·[genre-timbres.md](./genre-timbres.md)·[mix-mobile.md](./mix-mobile.md) |
| **T3 적응형** | 인텐시티 수직 레이어 + 섹션 전환 + 풀 믹스 | `soundforge` | + [adaptive-music.md](./adaptive-music.md)·[consistency-tools.md](./consistency-tools.md) 전부 |

## 도메인 파일 라우팅

| 파일 | prefix | 무엇 (언제 Read) |
|---|---|---|
| **[principles.md](./principles.md)** | (공통) | ★항상 먼저. 엔진 제약(SoundForge/Tone.js)·복잡도 4티어 게이트·모바일 보이스 예산·공통 캐논·'섞지 말 것' 안티패턴·장르→음색 빠른 처방. |
| **[mood-music-theory.md](./mood-music-theory.md)** | `MOOD-*` | ★인터뷰 최우선. 무드 토큰→스케일/모드·BPM·코드 진행 매핑·절차 멜로디 생성·ludo/톤 정합. 무드를 정할 때. |
| [synthesis-recipes.md](./synthesis-recipes.md) | `SYNTH-*` | ADSR·서브트랙티브·슈퍼소우·FM·노이즈 퍼커션·플럭·보이스 재사용 — Tone.js 인스트루먼트 매핑. 음색을 만들 때. |
| [sfx-design.md](./sfx-design.md) | `SFX-*` | 트랜지언트+바디+테일 3겹·피치 엔벨로프·노이즈 텍스처·이벤트 분류·데이터주도·피드백 명료성. 효과음을 설계할 때. |
| [genre-timbres.md](./genre-timbres.md) | `TIMBRE-*` | 칩튠/신스웨이브/앰비언트/로파이/16비트FM/아케이드/오케스트라풍 → 프리셋 팔레트·한 게임 한 음색. 장르 음색을 고를 때. |
| [adaptive-music.md](./adaptive-music.md) | `ADAPT-*` | 수직 레이어링·수평 리시퀀싱·인텐시티 게이트·비트 동기 전환·작은 게임용 최소형. 적응형을 둘 때(T3). |
| [mix-mobile.md](./mix-mobile.md) | `MIX-*` | 마스터 체인·send 이펙트·동시 보이스 예산·헤드룸·언락/suspend·덕킹·음소거. 믹스·모바일을 정할 때. |
| [consistency-tools.md](./consistency-tools.md) | (스펙) | **AUDIO.md/audio.json 섹션 스펙 + 레이어/SFX 레코드 필드 + 오디오 린트 체크리스트(a~h) + 툴 결정 매트릭스**. 바이블을 산출·검수할 때. |

## 빠른 처방 (장르 스캐폴드 → 음색·무드) — 자세히는 [genre-timbres.md](./genre-timbres.md)

| 장르 스캐폴드 | 디폴트 무드 | 디폴트 음색(프리셋) | 기본 티어 |
|---|---|---|---|
| platformer-game | cheerful / heroic | square-lead + triangle-bass + kit(칩튠/아케이드) | T1~T2 |
| topdown-shooter | tense | supersaw + saw-bass + kit(신스웨이브) | T2~T3 |
| arcade-classic | cheerful | pulse-lead + 빠른 arp + noise(아케이드) | T1 |
| puzzle-game | calm / mystic | pad + pluck + fm-bell(앰비언트/명상) | T1~T2 |
| endless-runner | tense / heroic | supersaw + kit four-floor(신스웨이브 추진) | T2~T3 |

> 항상 **무드를 가장 먼저**(`MOOD-LOCK-FIRST`), **한 게임 한 음색 패밀리**(`TIMBRE-ONE-FAMILY`), **모바일 보이스 예산 안에서**(`MIX-VOICE-BUDGET`).

## 코드 빠른 색인 (prefix별 — 정식 정의는 각 도메인 파일)

- **`MOOD-*` 무드·음악이론(7):** LOCK-FIRST · SCALE-MAP · TEMPO · PROGRESSION · LUDO-HARMONY · CONTRAST · ORIGINAL-MELODY
- **`SYNTH-*` 합성 기법(8):** ADSR · SUBTRACTIVE · SUPERSAW · FM · WAVETABLE · NOISE-PERC · PLUCK · VOICE-REUSE
- **`SFX-*` 효과음(8):** LAYER-3 · PITCH-ENV · NOISE-TEXTURE · CATEGORY · DATA-DRIVEN · FEEDBACK-CLARITY · DUCK · COMPAT
- **`TIMBRE-*` 장르 음색(9):** FIT · CHIPTUNE · SYNTHWAVE · AMBIENT · LOFI · FM16 · ARCADE · ORCHESTRAL · ONE-FAMILY
- **`ADAPT-*` 적응형(7):** VERTICAL · HORIZONTAL · INTENSITY · LAYER-GATE · BEAT-SYNC · TRANSITION · MINIMAL
- **`MIX-*` 믹스·모바일(8):** MASTER-CHAIN · SEND-FX · VOICE-BUDGET · HEADROOM · UNLOCK · LIFECYCLE · DUCK · MUTE
- **(공통) 캐논:** `AUDIO-SINGLE-SOURCE` · `CC0-ORIGINAL` (정의는 [principles.md](./principles.md)·[consistency-tools.md](./consistency-tools.md))

## 산출물

사운드 설계의 산출물은 **`games/<slug>/AUDIO.md`(사람용 설계 바이블) + `games/<slug>/audio.json`(기계용 데이터 = `SoundForge`가 로드 + 린터 입력)**이다.
섹션 스펙·레이어/SFX 레코드 필드·오디오 린트 체크리스트·툴 결정 매트릭스는 [consistency-tools.md](./consistency-tools.md). 이 라이브러리는 그 바이블을 *설계*하는 자료다.
검수 도구는 [`tools/lint-audio.mjs`](../../tools/lint-audio.mjs)(무의존성 validator). 합성 엔진은 [`engine/soundforge.js`](../../../../engine/soundforge.js)(Tone.js v15 래퍼).

## 출처 · 원칙

- 본 자료는 공개된 사운드 설계 통념(Web Audio 합성·ADSR·필터·FM·노이즈 퍼커션·룩어헤드 스케줄링·절차 IR 리버브·적응형 수직 레이어링/수평 리시퀀싱·모드별 정서·코드 진행·ZzFX/jsfxr SFX·모바일 오디오 언락)을 작은 웹게임용으로 정리한 것이다(각 파일 ## 출처 참고).
- **IP 안전 원칙:** 합성 기법·음악 구조(스케일·진행·기법)는 저작권 대상이 아니므로 자유롭게 차용한다. 단, 특정 상용 곡의 고유 멜로디/리프/시그니처 진행+멜로디 결합은 복제하지 않고 오리지널로 재구성한다(`CC0-ORIGINAL`). 모든 사운드는 절차 합성(오디오 파일 0). 상세는 [`ip-license-guard`](../../../ip-license-guard/SKILL.md).
