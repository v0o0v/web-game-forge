# 오디오 일관성 도구 + AUDIO.md/audio.json 스펙 + 결정 매트릭스 (TOOL-*)

> [`sound-architect`](../../SKILL.md)가 사운드를 **산출물로 굳히고 검수할 때** 참조하는 스펙 문서. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> 작은 웹게임의 BGM/SFX를 모순 없이 유지하는 경량 자산(AUDIO.md 설계 바이블·audio.json 데이터·오디오 린트)과 도구 채택 결정 매트릭스. story-design의 STORY.md·item-design의 ITEMS.md 모델을 *사운드*에 적응시켰다.

story-design의 STORY.md 바이블·연속성 린트가 *서사*를, item-design의 ITEMS.md+items.json+lint-items.mjs가 *아이템*을 single source of truth로 묶듯, sound-architect는 **AUDIO.md(사람용 설계 바이블) + audio.json(기계용 데이터 = `SoundForge`가 로드 + 린터 입력) + lint-audio.mjs(검수 패스)** 로 *사운드*를 묶는다. **핵심 통찰: 사운드도 정량 데이터(스케일·BPM·레이어·보이스 예산·믹스 dB)를 가져 기계 검증의 한계효용이 실재한다** — 그래서 validator(`lint-audio.mjs`)를 strong으로 채택한다(item-architect와 동형).

이 파일은 AUDIO.md 섹션 스펙 → audio.json 스키마 → 레이어/SFX 레코드 필드 → 오디오 린트 체크리스트 → 툴 결정 매트릭스 → 출처 순으로 정식화한다.

---

## 프레임워크 요약

| 구분 | 모델(차용) | 핵심 | 작은 웹게임 차용 |
| --- | --- | --- | --- |
| AUDIO.md 설계 바이블 | story-design STORY.md + item-design ITEMS.md | 무드·합성 스타일가이드·음악 정체성을 1곳에 압축한 사람용 진실 | 고정 섹션(§0~§7)을 **복잡도 티어에 비례해 켜고 끔**. T0은 §0만. |
| audio.json 데이터 | item-design items.json + ZzFXM 트래커 발상 | `SoundForge`가 로드 + 린터 입력의 단일 평면 JSON | `master`·`budget`·`bgm.tracks`·`sfx`·`balanceConfig`를 한 파일에. |
| 오디오 린트 | item-design lint-items.mjs 계약 | 정량 결함(스키마·무드정합·보이스예산·믹스)을 자동 검출 | `lint-audio.mjs`가 a~g 자동화, 사람이 (h) 청취만 보강. |
| 도구 적합도 | item-design 도구 도시에 | 도구 가치는 규모·정량성에 비례 | validator=★기본, 청취 하니스=조건부, 외부 라이브러리=비권장(Tone.js 외 의존성 추가 금지). |

---

## 0. 단일 진실 + 작성/검수 분리 (`AUDIO-SINGLE-SOURCE`)

- **정의:** 한 게임의 모든 사운드 정의(무드·BGM 트랙/레이어·SFX·믹스)는 `games/<slug>/AUDIO.md`(사람용)와 `games/<slug>/audio.json`(기계용) 두 산출물에서만 정의한다. 설계(작성 패스)와 검수(`lint-audio.mjs` + 청취 = 검수 패스)는 **다른 패스**로 분리한다(자기검수 금지).
- **우리 엔진 구현:** AUDIO.md = 설계 의도·합성 스타일가이드(§6)·무드/서사 정합(STORY.md 상속)·왜 이 사운드인가; audio.json = `SoundForge`가 로드하고 `lint-audio.mjs`가 읽는 평면 데이터. **수치를 game.js에 하드코딩하지 않고 audio.json만 읽는다**(`new SoundForge(AUDIO_SPEC)`). 동기화 규칙: **audio.json이 기계 진실, AUDIO.md가 의도 진실** — 둘이 갈리면 린트 (a)가 미스매치를 잡고 AUDIO.md를 기준으로 audio.json을 고친다. 워크플로: ①무드 인터뷰→②AUDIO.md 작성→③audio.json 생성→④`lint-audio.mjs`(검수 패스)→⑤청취 점검→⑥§7 로그.
- **흔한 실패:** SFX 파라미터를 게임 코드 여러 곳에 하드코딩 → 한쪽만 고쳐 모순. 작성과 검수를 한 호흡에 self-approve → 무드 불협·보이스 폭발·진동 마스킹을 놓침.

---

## (A) AUDIO.md 섹션 스펙

`games/<slug>/AUDIO.md`는 **게임당 단일 진실**이며, 복잡도 티어(0~3, [principles.md](./principles.md) §복잡도)에 비례해 섹션을 켜고 끈다.

### ## 0. 메타 — *항상*
slug · 장르/스캐폴드 · 코어 동사 · 렌더 스타일(픽셀/스무스) · **복잡도 티어(0~3)** · **엔진(`soundforge`|`chip`)** · 무드 토큰 1개 · `STORY.md` 링크. T0(chip)이면 여기까지만(ChipAudio 경량 경로 — AUDIO.md 사실상 불필요).

### ## 1. 무드 · 음악 정체성 — *항상(T≥1)*
무드 토큰 1개(`MOOD-LOCK-FIRST`) · 스케일/모드 · 키 · BPM · 코드 진행(관용구) · **왜 이 무드인가**(코어 동사·STORY.md 톤과 같은 말 — `MOOD-LUDO-HARMONY`). 무드↔스케일/BPM은 [mood-music-theory.md](./mood-music-theory.md) 표를 근거로 단다.

### ## 2. BGM 트랙 & 레이어 — *T≥1*
트랙 목록(T1은 1개) + 각 트랙의 레이어 표(id·preset·role·pattern·minIntensity·vol). 적응형이면(T≥2) 인텐시티별 레이어 게이트 계획(`ADAPT-LAYER-GATE`). preset은 [genre-timbres.md](./genre-timbres.md)/[synthesis-recipes.md](./synthesis-recipes.md)의 프리셋 enum에서.

### ## 3. SFX 팔레트 — *항상(T≥1)*
게임 이벤트 → SFX 표(이벤트·키·레이어드 설계(트랜지언트/바디/테일)·피치 방향). 공통 이벤트(jump/hit/coin/pickup/explosion/ui...) 커버. 레이어드 원칙은 [sfx-design.md](./sfx-design.md)(`SFX-LAYER-3`·`SFX-PITCH-ENV`). ChipAudio 호환 키 유지(`SFX-COMPAT`).

### ## 4. 적응형 / 전환 — *T≥2 (적응형 있을 때)*
인텐시티 매핑(게임 상태→0..1) · 섹션 전환(탐험/전투/보스 → 트랙) · 비트 동기 크로스페이드 · 덕킹(`ADAPT-*`·`MIX-DUCK`).

### ## 5. 믹스 & 모바일 예산 — *T≥1*
마스터 체인(Volume→Compressor→Limiter) · send 이펙트(리버브 decay·딜레이) · **동시 보이스 캡(maxVoices, 모바일 16)** · 언락/suspend·resume 라이프사이클(`MIX-*`). [mix-mobile.md](./mix-mobile.md).

### ## 6. 합성 스타일가이드(헤더 상수) — *T≥1*
전역 1회 선언, 트랙/레이어가 상속: 음색 패밀리(`TIMBRE-ONE-FAMILY`) · 사용 프리셋 목록 · 이펙트 파라미터(리버브/딜레이/펌핑) · 마스터 dB. 일관성 근거.

### ## 7. 검수 로그 — *T≥1*
검수 패스(`AUDIO-SINGLE-SOURCE`)의 기록. `lint-audio.mjs` 결과(스키마·무드정합·보이스예산·레이어도달·믹스·CC0) · 청취 점검("무드가 게임과 같은 말을 하나? SFX가 BGM에 묻히나? 모바일에서 끊기나?") · 해소 기록. 각 항목: 위반 코드(아래 a~h) · 위치 · 조치 · 재린트 여부.

---

## (B) audio.json 스키마 (SoundForge 로드 + 린터 입력)

평면 JSON 한 파일. `SoundForge` 생성자가 그대로 소비하고 `lint-audio.mjs`가 읽는다. 아래는 **T2 신스웨이브 러너 실제 예시**다.

```json
{
  "version": 1,
  "meta": {
    "slug": "neon-dash", "tier": 2, "mood": "tense", "genre": "endless-runner",
    "renderStyle": "smooth", "engine": "soundforge",
    "originalityNote": "전 트랙 절차 합성 오리지널 — 어떤 곡의 멜로디/진행도 인용하지 않음"
  },
  "master": { "volume": -6, "limiter": -1, "reverb": { "decay": 2.4, "send": 0.2 }, "delay": { "send": 0.14 } },
  "budget": { "maxVoices": 16 },
  "bgm": {
    "defaultTrack": "run", "defaultIntensity": 0.5,
    "tracks": {
      "run": {
        "mood": "tense", "scale": "phrygian", "key": "E", "bpm": 148,
        "progression": ["i", "bII", "i", "VII"],
        "layers": [
          { "id": "pad",   "preset": "pad",          "pattern": "chords",   "minIntensity": 0,    "vol": -16 },
          { "id": "bass",  "preset": "saw-bass",      "pattern": "root8",    "minIntensity": 0.2,  "vol": -11 },
          { "id": "drums", "preset": "kit",           "pattern": "four-floor","minIntensity": 0.4, "vol": -10 },
          { "id": "lead",  "preset": "supersaw",      "pattern": "arp",      "minIntensity": 0.7,  "vol": -13 }
        ]
      },
      "boss": {
        "mood": "tense", "scale": "harmonic-minor", "key": "E", "bpm": 160,
        "progression": ["i", "VI", "V", "i"],
        "layers": [
          { "id": "pad",   "preset": "pad",      "pattern": "chords",    "minIntensity": 0,   "vol": -14 },
          { "id": "bass",  "preset": "saw-bass", "pattern": "pulse",     "minIntensity": 0,   "vol": -10 },
          { "id": "drums", "preset": "kit",      "pattern": "four-floor","minIntensity": 0,   "vol": -9 },
          { "id": "lead",  "preset": "supersaw", "pattern": "arp",       "minIntensity": 0.3, "vol": -12 }
        ]
      }
    },
    "sections": { "run": "run", "boss": "boss" }
  },
  "sfx": {
    "jump":      { "layers": [ { "kind": "tone", "wave": "square", "freq": 320, "to": 760, "dur": 0.14, "vol": 0.5 } ] },
    "coin":      { "layers": [ { "kind": "tone", "wave": "square", "freq": 988, "dur": 0.06, "vol": 0.5 },
                               { "kind": "tone", "wave": "square", "freq": 1319, "dur": 0.12, "vol": 0.5, "delay": 0.06 } ] },
    "hit":       { "layers": [ { "kind": "noise", "filter": 1200, "dur": 0.12, "vol": 0.6 },
                               { "kind": "tone", "wave": "square", "freq": 180, "dur": 0.1, "vol": 0.4 } ] },
    "explosion": { "layers": [ { "kind": "noise", "filter": 6000, "dur": 0.05, "vol": 0.7 },
                               { "kind": "boom", "freq": "C2", "dur": 0.4, "vol": 0.9, "delay": 0.01 },
                               { "kind": "noise", "filter": 800, "dur": 0.3, "vol": 0.5, "delay": 0.04 } ] }
  },
  "balanceConfig": { "maxReverbDecay": 4, "bpmTolerance": 12 }
}
```

대응하는 **AUDIO.md §2 레이어 표 예시**(같은 `run` 트랙, 사람용 의도 진실):

| layer | preset | role | pattern | minIntensity | vol(dB) | 의도 |
| --- | --- | --- | --- | --- | --- | --- |
| pad | pad | bed | chords | 0 | -16 | 항상 깔리는 분위기 베드(불안한 phrygian 패드) |
| bass | saw-bass | foundation | root8 | 0.2 | -11 | 속도감 베이스 — 달리기 시작하면 진입 |
| drums | kit | drive | four-floor | 0.4 | -10 | 추진력 — 중간 강도부터 4-on-floor |
| lead | supersaw | hook | arp | 0.7 | -13 | 고강도(추격 절정)에서만 터지는 슈퍼소우 훅 |

> 인텐시티가 0→1로 오르며 pad→bass→drums→lead가 순차로 페이드 인(`ADAPT-LAYER-GATE`). 베드(pad, minIntensity 0)가 있어 어떤 강도에서도 무음이 아니다.

---

## (C) 레이어 / SFX 레코드 필드 스펙

**BGM 레이어 필드** (`bgm.tracks[id].layers[]` 한 객체 = AUDIO.md §2 한 행)

| 필드 | 형 | 설명 |
| --- | --- | --- |
| `id` | string | 레이어 키(kebab). 트랙 내 고유. |
| `preset` | enum | 악기 프리셋. `square-lead\|pulse-lead\|triangle-bass\|saw-bass\|supersaw\|fm-bell\|fm-ep\|pad\|pluck\|organ\|kit\|drums`. `SoundForge._makeInstrument`와 1:1. |
| `pattern` | enum | 발음 패턴. `chords\|root8\|pulse\|arp\|offbeat\|backbeat\|four-floor`. 드럼 프리셋은 `backbeat\|four-floor`. |
| `minIntensity` | 0..1 | 이 강도 이상에서 레이어 audible(`ADAPT-LAYER-GATE`). 베드는 0. |
| `vol` | number(dB) | 레이어 기준 음량(보통 -16~-9). 헤드룸 고려(`MIX-HEADROOM`). |
| `role` | string | (AUDIO.md 전용, 선택) bed/foundation/drive/hook 등 의도 라벨. |

**SFX 레이어 필드** (`sfx[event].layers[]`)

| 필드 | 형 | 설명 |
| --- | --- | --- |
| `kind` | enum | `tone\|fm\|noise\|boom\|metal`. SoundForge SFX 랙 디스패치 키. |
| `freq` | number\|note | 기본 음고(Hz 또는 'C2'). |
| `to` | number | (tone) 피치 슬라이드 목표(`SFX-PITCH-ENV`). |
| `dur` | number(초) | 길이. |
| `vol` | 0..1 | velocity. |
| `wave` | string | (tone) square/triangle/sawtooth/sine. |
| `harmonicity`/`modIndex` | number | (fm) 음색. |
| `filter` | number(Hz) | (noise) bandpass 중심. |
| `delay` | number(초) | 레이어 시작 지연 — 트랜지언트/바디/테일을 시간차로 겹침(`SFX-LAYER-3`). |

> SFX는 **레이어 배열로 8비트 너머의 임팩트**를 만든다(`SFX-LAYER-3`): ① 트랜지언트(짧은 noise burst) + ② 바디(메인 톤/boom) + ③ 테일(잔향/저역 노이즈). 단일 레이어면 `{layers:[{...}]}` 또는 `{...}` 직접도 허용.

---

## (D) 오디오 린트 체크리스트 (a~h)

작성과 **분리된 검수 패스**다(`AUDIO-SINGLE-SOURCE`). `lint-audio.mjs`가 audio.json을 읽어 (a)~(g)를 자동 검사하고, (h)는 사람이 청취로 보강한다. 위반은 §7 점검 로그에 적고 **재린트**한다. self-approve 금지.

| 코드 | 점검 항목 | 무엇을 대조하나 | 자동/수동 | 근거 원칙 |
| --- | --- | --- | --- | --- |
| (a) schema | version·engine·tier·필수필드·enum(scale/preset/pattern/sfx.kind)·중복 id·티어 정합 | audio.json ↔ SoundForge 계약 | **자동** | SoundForge 계약 |
| (b) mood-scale | 무드↔스케일/BPM 정합(무드 권장 스케일·BPM 범위 이탈) | track.mood ↔ 무드 매핑표 | **자동** | `MOOD-SCALE-MAP`/`MOOD-TEMPO` |
| (c) voice-budget | 추정 피크 동시 보이스 > maxVoices(모바일 폴리포니) | 레이어 프리셋 보이스 합 + SFX ↔ budget | **자동** | `MIX-VOICE-BUDGET` |
| (d) layer-reach | 베드 레이어(minIntensity≤0) 존재·minIntensity 범위·도달 가능성 | 레이어 minIntensity 분포 | **자동** | `ADAPT-LAYER-GATE` |
| (e) preset-pat | 드럼 프리셋↔드럼 패턴 / 멜로딕↔멜로딕 정합 | layer.preset ↔ layer.pattern | **자동** | `TIMBRE-FIT` |
| (f) mix-sanity | master volume/limiter/reverb decay 안전 범위·헤드룸 | master ↔ balanceConfig | **자동** | `MIX-HEADROOM` |
| (g) cc0 | 오리지널리티 affirmation + 상용곡 인용 의심 문자열 | meta.originalityNote·전체 blob | **자동** | `CC0-ORIGINAL` |
| (h) 청취 점검 | "무드가 게임과 같은 말? SFX가 BGM에 묻히나? 모바일에서 끊기나? 루프 이음새 튀나?" | 자가 청취(로컬 서버) | **수동** | `SFX-FEEDBACK-CLARITY`/`MIX-*` |

> (a)~(g)는 정량이라 결정론 스크립트로 옮길 수 있지만, (h)는 "린트는 *소리*를 못 듣는다"는 한계 때문에 사람 청취 패스로 남는다. T0(chip)은 (a)만 의미 있고 나머지는 적용 대상이 적다.

---

## (E) 도구 채택 결정 매트릭스

스킬은 외부 의존성을 권하려는 유혹을 **명시적으로 억제**한다. 합성 라이브러리는 **vendored Tone.js 단 하나**(사용자 결정)이며, 그 외 npm 의존성·뷰어 라이브러리는 비권장이다. 무의존성 `.mjs` 검수 도구가 컨벤션.

| 도구 | 무엇 | 비용 | 이득 | 권고 |
| --- | --- | --- | --- | --- |
| **`lint-audio.mjs`** (오디오 validator) | audio.json 읽어 a~g 자동 린트, stdout 마지막 줄 단일 JSON(`{ok,counts,findings}`) 계약 | 낮음(무의존성 단일 `.mjs`) | 스키마·무드정합·보이스예산·레이어도달·믹스·CC0 자동 포착 | **★강추(기본·온디맨드)** |
| 청취 하니스(로컬 서버 + 테스트 페이지) | `?autostart=1`로 트랙/SFX 자동 트리거, 콘솔 에러·Tone 초기화 확인 | 낮음(정적 페이지) | 모바일 뷰포트 청취·콘솔 점검 | **조건부**(브라우저 검증 시) |
| **vendored Tone.js** | 합성/스케줄러/이펙트 백본(v15, MIT) | 중(~350KB, 1회 vendoring) | 전문급 합성·Transport·이펙트 | **채택(사용자 결정)** — phaser 다음 로드 |
| 추가 오디오 라이브러리(Howler/Pizzicato/사운드폰트) | 파일 재생/추가 합성 | 높음(의존성·zero-file 위반) | — | **비권장**(Tone.js로 충분, 파일 자산 0 원칙) |

기본 결정: **`lint-audio.mjs` = 강추**(검수 1단계), 청취 하니스 = 조건부, Tone.js 외 라이브러리 = 비권장. 임계값(`maxVoices`·`maxReverbDecay`·`bpmTolerance`)은 게임마다 다르므로 audio.json `budget`/`balanceConfig`에 두고 린터가 읽는다 — **하드코딩 금지**. `lint-audio.mjs`의 룰 그룹은 reference 원칙 코드(`MOOD-*`·`ADAPT-*`·`MIX-*`·`TIMBRE-*`)와 1:1 매핑한다.

---

## 출처

- 본 스펙은 story-design `TL-CANON-SINGLE-SOURCE`/`TL-AUTHOR-VS-REVIEW` 와 item-design `ITEMS-SINGLE-SOURCE`/lint-items.mjs 계약을 *사운드*에 적응시킨 것이다.
- 사운드 설계 통념·합성 레시피·무드 매핑의 1차 출처는 [`.omc/research/sound-research-dossier.md`](../../../../README.md) 리서치(Web Audio·Tone.js·적응형 음악·음악이론·ZzFX) — 각 도메인 파일 ## 출처 참고.
- **CC0/IP 안전:** 절차 합성은 오디오 파일 자산 0 → 음원 저작권 비해당. 남는 위험(작곡 표절)은 `CC0-ORIGINAL`(시그니처 모티프 회피 + 절차 멜로디 생성)로 코드 레벨 차단. 상세는 [`ip-license-guard`](../../../wgf-ip-license-guard/SKILL.md).
