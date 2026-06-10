# SFX 설계 원칙 — 레이어드 합성 · 피치 엔벨로프 · 피드백 명료성 (SFX-*)

> [`sound-architect`](../../SKILL.md) SFX 설계의 도메인 레퍼런스. 색인 [INDEX.md](./INDEX.md), 공통 원칙 [principles.md](./principles.md).
> **8비트 ChipAudio 너머**의 임팩트를 내는 SFX 레이어드 합성 원칙 8종을 코드화한다.
> 엔진 구현의 단일 진실: [`engine/soundforge.js`](../../../../engine/soundforge.js)(`_playSpecSfx`/`_playSfxLayer`/`_playBuiltinSfx`).
> SFX 레코드 필드 스펙: [consistency-tools.md](./consistency-tools.md) §(C).

---

## 원칙 목록 (prefix `SFX-*`, 8종)

| 코드 | 한줄 요약 |
|---|---|
| `SFX-LAYER-3` | 트랜지언트+바디+테일 3겹을 시간차로 쌓아 임팩트 |
| `SFX-PITCH-ENV` | 피치 방향 = 의미(상승=긍정, 하강=임팩트) |
| `SFX-NOISE-TEXTURE` | 필터드 노이즈로 폭발·회복 질감 |
| `SFX-CATEGORY` | jsfxr 표준 이벤트 카테고리 + 이벤트→SFX 매핑 표 |
| `SFX-DATA-DRIVEN` | audio.json `sfx`가 단일 진실, game.js 하드코딩 금지 |
| `SFX-FEEDBACK-CLARITY` | SFX 1차 목적 = 게임 상태를 귀로 알리는 것 |
| `SFX-DUCK` | 중요 SFX 시 BGM 버스 일시 덕킹(사이드체인 근사) |
| `SFX-COMPAT` | ChipAudio 호환 키 유지 — 기존 게임 무수정 전환 |

---

### `SFX-LAYER-3`

**정의:** 한 SFX를 트랜지언트(짧은 noise burst → 어택감) + 바디(메인 톤/boom → 정체성) + 테일(잔향/저역 noise → 공간) 3겹으로 쌓되, 각 레이어를 `delay` 오프셋으로 미세하게 시간차 발음한다. 8비트 단음보다 훨씬 두터운 임팩트를 낸다.

**출처:** dossier §"8비트 너머 SFX 디자인 원칙" — "① 트랜지언트(짧고 밝은 클릭/노이즈 burst) + ② 바디(메인 톤/필터드 노이즈) + ③ 테일(리버브/딜레이 잔향) 세 레이어를 약간의 시간차로 겹쳐 한 SFX로."

**우리 엔진 구현 (SoundForge + audio.json):**
- `_playSpecSfx`가 `sfx[event].layers[]` 배열을 순회, 각 레이어를 `Tone.now() + (L.delay || 0)` 시각으로 `_playSfxLayer`에 넘긴다.
- `_playSfxLayer`의 `kind` enum: `tone | fm | noise | boom | metal`.
- `delay` 필드(초)가 레이어 시작을 시간차로 어긋내는 핵심. 트랜지언트 `delay: 0`, 바디 `delay: 0.01~0.04`, 테일 `delay: 0.04~0.10`.

**audio.json 예시 — explosion (3겹):**
```json
"explosion": {
  "layers": [
    { "kind": "noise",  "filter": 6000, "dur": 0.05, "vol": 0.7, "delay": 0 },
    { "kind": "boom",   "freq": "C2",   "dur": 0.40, "vol": 0.9, "delay": 0.01 },
    { "kind": "noise",  "filter": 800,  "dur": 0.30, "vol": 0.5, "delay": 0.04 }
  ]
}
```
트랜지언트: noise highpass burst(filter 6000 Hz, dur 0.05s) → 즉각적인 "펑" 어택.
바디: boom(MembraneSynth, C2, 0.4s) → 두터운 저음 바디. delay 10ms로 트랜지언트 뒤에 붙음.
테일: noise lowpass(filter 800 Hz, 0.3s) → 먼지 날리는 잔향. delay 40ms로 자연 감쇠.

**흔한 실패:** 단일 `noise`만 쓰면 "쉬익" 질감만 남고 임팩트가 없다. `boom` 하나만 쓰면 저음 둔중함뿐, 날카로운 어택이 빠진다. 3겹을 같은 `delay: 0`으로 주면 마스킹이 심해진다 — `delay` 시간차가 층을 분리한다.

**연관:** `SFX-NOISE-TEXTURE`(noise 레이어 상세), `SFX-PITCH-ENV`(바디 톤 피치 방향), `SFX-FEEDBACK-CLARITY`(임팩트가 BGM에 묻히지 않게).

---

### `SFX-PITCH-ENV`

**정의:** SFX 바디 레이어의 피치 방향이 의미를 전달한다. **상승(freq → to, to > freq) = 긍정/획득/도약**, **하강(to < freq) = 임팩트/충격/소멸**. SoundForge `tone` kind의 `freq`(시작) → `to`(끝) 슬라이드로 구현.

**출처:** dossier §"8비트 너머 SFX 디자인 원칙" — "피치 엔벨로프: 임팩트는 피치 하강(stomp/explosion), 상승은 긍정(coin/jump/powerup)." ZzFX `slide/pitchJump` 파라미터 모델의 발상 차용.

**우리 엔진 구현:**
- `_playSfxLayer` case `'tone'`: `freq`로 발음한 뒤 `L.to`가 있으면 `dur * 0.5` 후 `L.to`를 추가 발음해 슬라이드를 2음 빠른 연속으로 근사한다.
- `tone` 레이어에서 `freq`와 `to`만 지정하면 된다.

**audio.json 예시 — coin (2겹, 상승) / jump (1겹, 상승):**
```json
"coin": {
  "layers": [
    { "kind": "tone", "wave": "square", "freq": 988,  "dur": 0.06, "vol": 0.5 },
    { "kind": "tone", "wave": "square", "freq": 1319, "dur": 0.12, "vol": 0.5, "delay": 0.06 }
  ]
},
"jump": {
  "layers": [
    { "kind": "tone", "wave": "square", "freq": 320, "to": 760, "dur": 0.14, "vol": 0.5 }
  ]
}
```
coin: 낮은 음 → 0.06s 후 높은 음(명시적 2단 상승 아르페지오). 간결하고 긍정적.
jump: 320 Hz → 760 Hz 슬라이드. 도약 느낌을 피치 상승으로 직결.

**내장 `_playBuiltinSfx` 대응:**
- `jump`: 300 Hz + 0.05s 후 720 Hz. 상승 패턴.
- `coin`: 988 Hz + 0.06s 후 1319 Hz. 상승 아르페지오.
- `stomp`: boom A1(하강 pitch decay) + triangle 220 Hz. 하강·충격.
- `explosion`: boom C2(pitchDecay 0.08, octaves 8 — 내려가며 떨어짐).
- `laser`: sawtooth 1200→300(하강, 2음 연속).

**흔한 실패:** jump를 하강 피치로 설계하면 "떨어지는" 느낌이라 게임 피드백과 역방향. `freq`·`to` 방향을 카테고리 표(`SFX-CATEGORY`)에서 먼저 확인한다.

**연관:** `SFX-CATEGORY`(카테고리별 피치 방향 기본값), `SFX-LAYER-3`(바디 레이어에서 쓴다).

---

### `SFX-NOISE-TEXTURE`

**정의:** 필터드 노이즈(SoundForge `noise` kind + `filter` Hz)로 "디지털 삑" 너머의 질감을 부여한다. **폭발/충격 = 높은 필터(트랜지언트, ~6000 Hz)에서 낮은 필터(테일, ~400~800 Hz)로 스윕 내려가는 노이즈 2회 발음. 회복/획득 = 노이즈 + 상승 톤 조합.**

**출처:** dossier §"8비트 너머 SFX 디자인 원칙" — "노이즈 텍스처: 필터드 노이즈를 바디에 섞어 질감(폭발=노이즈 lowpass sweep down, 회복=노이즈+상승 톤)."

**우리 엔진 구현:**
- SFX 랙: `_sfxRack.noise`(NoiseSynth) + `_sfxRack.noiseFilt`(BiquadFilter, type='bandpass', Q=0.8).
- `noise` kind: `L.filter`로 `noiseFilt.frequency`를 `t` 시각에 setValueAtTime. 그 직후 noise를 `dur`만큼 트리거.
- 폭발 패턴: 동일 `noise`를 두 번 발음 — 첫 번째 `filter: 6000`·`dur: 0.05`(트랜지언트), 두 번째 `filter: 800`·`dur: 0.3`·`delay: 0.04`(테일). bandpass Q가 낮아 각 중심 주파수 대역이 자연스럽게 이어진다.
- `hit` 내장: `noiseFilt` 1200 Hz + `noise` 0.12s + square 180 Hz 바디.
- `brick` 내장: `noiseFilt` 2400 Hz(날카로운 물성) + `noise` 0.1s.

**audio.json 예시 — hit (noise + tone 2겹):**
```json
"hit": {
  "layers": [
    { "kind": "noise", "filter": 1200, "dur": 0.12, "vol": 0.6 },
    { "kind": "tone",  "wave": "square", "freq": 180, "dur": 0.10, "vol": 0.4 }
  ]
}
```
noise 1200 Hz(mid-high 타격감) + square 180 Hz 저음 바디. 두 레이어가 "쿵탁" 복합 타격음을 만든다.

**흔한 실패:** `filter` 없이 `noise`만 쓰면 화이트 노이즈 전 대역 = "쏴아" 하는 잡음. `filter`로 대역을 잡아야 의도한 음색이 나온다. filter를 매번 같은 값으로만 쓰면 모든 SFX가 동일 질감 — 이벤트별로 Hz를 달리 한다.

**연관:** `SFX-LAYER-3`(noise를 트랜지언트 또는 테일 레이어로 사용), `SFX-FEEDBACK-CLARITY`(노이즈 대역이 BGM 중역과 겹치지 않도록).

---

### `SFX-CATEGORY`

**정의:** 게임 이벤트를 jsfxr 표준 카테고리로 분류하고, 카테고리별 피치 방향·레이어 구성·SoundForge kind를 아래 표로 못 박는다. 이벤트 → SFX 설계의 출발점.

**출처:** dossier §"ZzFX/jsfxr 분석" — "jsfxr 프리셋 카테고리(pickup/laser/explosion/powerup/hit/jump/blip)가 게임 SFX 분류의 표준."

**이벤트 → SFX 설계 표:**

| 게임 이벤트 | jsfxr 카테고리 | 피치 방향 | 트랜지언트 | 바디 | 테일 | SoundForge kind |
|---|---|---|---|---|---|---|
| 아이템 획득·동전 | pickup / coin | **상승** | — | tone(상승 아르페지오) | — | `tone` |
| 점프·도약 | jump | **상승** | — | tone(freq→to 슬라이드↑) | — | `tone` |
| 레이저·발사 | laser / shoot | **하강** | — | tone(sawtooth, 하강) | — | `tone` |
| 폭발 | explosion | **하강** | noise(고역) | boom(C2 피치다운) | noise(저역) | `noise` + `boom` + `noise` |
| 피격·충돌 | hit / hurt | **하강/중립** | noise | tone(저역 바디) | — | `noise` + `tone` |
| 파워업 | powerup | **상승** | — | tone(상승 아르페지오 연속) | — | `tone` |
| UI 선택·확인 | blip / select | **중립/약상승** | — | tone(짧은 단음) | — | `tone` |
| 발판·충돌 | stomp / bump | **하강** | — | boom(저음) + tone | — | `boom` + `tone` |
| 사망·실패 | die | **하강** | — | tone(하강 아르페지오) | — | `tone` |
| 달성·클리어 | flag / 1up | **상승** | — | tone(상승 아르페지오 긴) | — | `tone` |
| 금속·메탈 충돌 | hit(metal) | **중립** | metal | — | — | `metal` |
| FM 벨·특수음 | pickup(special) | — | — | fm | — | `fm` |

**우리 ChipAudio 호환 키 → 카테고리 대응:**
jump(jump) · coin(pickup/coin) · stomp(stomp) · bump(stomp) · brick(hit) · hit(hit/hurt) · powerup(powerup) · sprout(powerup) · die(die) · flag(flag) · 1up(1up) · laser(laser) · explosion(explosion) · select(blip)

**흔한 실패:** 카테고리를 무시하고 모든 SFX를 같은 tone+noise 조합으로 만들면 게임 이벤트가 귀로 구분 안 된다. 카테고리 표를 먼저 보고 피치 방향·kind를 결정한 뒤 세부 파라미터를 조정한다.

**연관:** `SFX-LAYER-3`(레이어 구성), `SFX-PITCH-ENV`(피치 방향 상세), `SFX-COMPAT`(호환 키 목록).

---

### `SFX-DATA-DRIVEN`

**정의:** 모든 SFX 파라미터는 `games/<slug>/audio.json`의 `sfx` 섹션이 **단일 진실**이다. `game.js`·`scene.js` 등 게임 코드에 주파수·dur·vol 수치를 하드코딩하지 않는다. 게임 코드는 `GAME_AUDIO.sfx('name')`만 호출한다.

**출처:** [consistency-tools.md](./consistency-tools.md) §(A) `AUDIO-SINGLE-SOURCE` — "수치를 game.js에 하드코딩하지 않고 audio.json만 읽는다(`new SoundForge(AUDIO_SPEC)`)."

**우리 엔진 구현:**
- `SoundForge.sfx(name)`: `this.spec.sfx && this.spec.sfx[name]`가 있으면 `_playSpecSfx`(데이터 주도), 없으면 `_playBuiltinSfx`(내장 폴백) 호출.
- 즉 audio.json `sfx[name]`가 정의된 순간 내장 프리셋을 덮어쓴다 — **게임별 커스텀이 가장 쉬운 방법**.
- audio.json `sfx` 레코드: `{ "layers": [...] }` 배열로 표현. 필드 스펙은 [consistency-tools.md](./consistency-tools.md) §(C) "SFX 레이어 필드".

**audio.json `sfx` 예시 위치:**
```json
"sfx": {
  "jump":      { "layers": [ { "kind": "tone", ... } ] },
  "explosion": { "layers": [ { "kind": "noise", ... }, { "kind": "boom", ... }, ... ] }
}
```

**게임 코드 올바른 호출:**
```js
// ✅ 올바름
GAME_AUDIO.sfx('jump');
GAME_AUDIO.sfx('explosion');

// ❌ 금지 — 수치 하드코딩
Tone.PolySynth.triggerAttackRelease(440, 0.1);
```

**흔한 실패:** scene마다 `R.poly.triggerAttackRelease(...)` 직접 호출 → audio.json 수정이 게임에 반영 안 됨. `sfx` 배열이 없는 이벤트키를 호출하면 내장 프리셋 폴백 — audio.json에 항상 명시해 의도를 선언한다. 린트 (a) schema 검사가 unknown kind를 잡는다.

**연관:** `AUDIO-SINGLE-SOURCE`(단일 진실 원칙), `SFX-COMPAT`(내장 폴백 키 목록), [consistency-tools.md](./consistency-tools.md).

---

### `SFX-FEEDBACK-CLARITY`

**정의:** SFX의 **1차 목적은 게임 상태를 귀로 알리는 것**이다. 점프했는지, 맞았는지, 획득했는지를 플레이어가 즉각 소리로 인지해야 한다. BGM에 묻히지 않도록 SFX 주파수 대역·타이밍을 BGM 레이어와 분리하고, 동시 다발 SFX 간 마스킹을 회피한다.

**출처:** dossier §"TL;DR 권고 5" — "SFX 생성: ZzFX 파라미터 모델 이식 + 레이어드 합성 도입." principles.md 공통 캐논 `SFX-FEEDBACK-CLARITY` — "SFX의 1차 목적은 게임 상태를 귀로 알리는 것."

**설계 가이드라인:**

| 상황 | 조치 |
|---|---|
| SFX가 BGM 중역(200~2000 Hz)과 겹침 | SFX를 고역(2000+ Hz) 또는 저역(80~200 Hz)으로 이동, 또는 BGM 덕킹(`SFX-DUCK`) |
| 동시에 여러 SFX 발음(폭발+피격+아이템) | 중요도 순위: 피격>획득>환경. 낮은 우선순위 SFX를 약간 지연(`delay: 0.02~0.05`) |
| 짧은 SFX(blip, coin)가 들리지 않음 | `vol` 0.5~0.7, `dur` 최소 0.05s. BGM 전체 볼륨을 -6~-10 dB로 낮춰 SFX 여유 확보 |
| 모든 SFX가 동일 음색 | `SFX-CATEGORY` 카테고리별 kind·필터·피치 방향 다양화 |
| BGM 마스터 dB 과도 | audio.json `master.volume: -6~-8`로 헤드룸 확보(`MIX-HEADROOM`) |

**SoundForge 믹스 구조:** SFX 랙(`_sfxRack.*`)은 BGM 레이어 버스와 **독립 경로**로 `_nodes.master`에 연결 — BGM과 SFX를 별도 gain으로 조절 가능. `GAME_AUDIO.sfxVol(v)`로 SFX 버스만 조정.

**흔한 실패:** BGM 볼륨이 너무 높아(-3 dB 이하) SFX가 묻힘 → BGM을 -8~-12 dB로, SFX를 상대적으로 크게. 폭발 SFX와 BGM 베이스가 동일 저역대 겹침 → explosion 바디에 `boom`(매우 저음 C2)을 쓰되 BGM 베이스가 E/A를 쓴다면 겹침 최소. 린트 (h) 청취 점검 항목: "SFX가 BGM에 묻히나?".

**연관:** `SFX-DUCK`(BGM 덕킹으로 SFX 명료성 강화), `MIX-HEADROOM`(믹스 헤드룸), `SFX-LAYER-3`(레이어 구성으로 주파수 층 분리).

---

### `SFX-DUCK`

**정의:** 중요 SFX(피격·획득 등 게임 상태 변화 이벤트) 발음 시 **BGM 마스터 버스(또는 BGM 전용 send)를 잠깐 gain ramp down → ramp up** 해 SFX를 전면에 부각한다. 하드웨어 사이드체인 컴프레서의 소프트웨어 근사.

**출처:** dossier §"F. 마스터 버스 / 컴프레션 / 사이드체인" — "kick 타이밍에 음악 버스 gain을 LFO/ramp로 잠깐 덕킹(`bus.gain` setValueAtTime↓ → ramp↑)."

**우리 엔진 구현:**
- `SoundForge.duck(duration)`: BGM 레이어 전체가 연결된 `_nodes.master`(또는 별도 bgmBus Gain)의 `.gain`을 `setValueAtTime(currentGain) → linearRampToValueAtTime(duckGain, +rampDown) → linearRampToValueAtTime(originalGain, +duration)`으로 예약.
- 덕킹 파라미터 권장: ramp down 0.01~0.02s, 덕 유지 0.1~0.2s, ramp up 0.15~0.3s. 덕 gain 비율 -4~-8 dB.
- `game.js` 호출 패턴: `GAME_AUDIO.sfx('hit'); GAME_AUDIO.duck(0.3);` — SFX 발음과 동시에 덕킹 트리거.

**audio.json 덕킹 설정 (balanceConfig):**
```json
"balanceConfig": {
  "duckGain": 0.35,
  "duckRampDown": 0.015,
  "duckDuration": 0.18,
  "duckRampUp": 0.22
}
```

**흔한 실패:** BGM과 SFX가 동시에 풀 볼륨 = 최악의 마스킹. 덕킹을 너무 빠르게 걸면(ramp down < 0.005s) 클릭 노이즈 발생 — 항상 최소 10ms 이상의 ramp. 모든 SFX마다 덕킹하면 BGM이 끊기는 느낌 → **중요 이벤트**(피격·보스 사망·레벨업)에만 적용, blip·hihat 같은 경량 SFX는 덕킹 없이.

**연관:** `SFX-FEEDBACK-CLARITY`(덕킹으로 SFX 명료성 확보), `MIX-DUCK`([mix-mobile.md](./mix-mobile.md) 동일 개념 믹스 레벨 정의), `ADAPT-TRANSITION`(섹션 전환 시 크로스페이드와 덕킹 구분).

---

### `SFX-COMPAT`

**정의:** ChipAudio(`engine/audio.js`)의 내장 SFX 키(jump · coin · stomp · bump · brick · powerup · sprout · die · flag · 1up)를 SoundForge에서 동일 키로 지원한다. `GAME_AUDIO.sfx('jump')`처럼 게임 코드를 **무수정**으로 SoundForge가 더 풍부하게 재현한다.

**출처:** [`engine/soundforge.js`](../../../../engine/soundforge.js) 주석 "내장 키는 ChipAudio와 호환(jump/coin/stomp/...) + 확장. audio.json sfx가 있으면 우선." dossier §"SFX 생성: ZzFX 파라미터 모델 이식."

**ChipAudio 호환 키 + SoundForge 내장 구현:**

| 키 | ChipAudio 원래 | SoundForge `_playBuiltinSfx` 레이어드 구현 | 더 풍부한 점 |
|---|---|---|---|
| `jump` | tone 단음 | square 300 Hz + 0.05s 후 720 Hz | 2단 상승으로 도약감 강화 |
| `coin` | tone 단음 | square 988→1319 Hz 0.06s 간격 | 명확한 2음 아르페지오 |
| `stomp` | tone 단음 | boom A1 + triangle 220 Hz | 저음 충격 + 톤 복합 |
| `bump` | tone | square 160 Hz | 동일(경량 유지) |
| `brick` | tone | noise 2400 Hz + sawtooth 200 Hz | 노이즈 텍스처 추가 |
| `hit` | tone | noise 1200 Hz + square 180 Hz | 타격 질감 강화 |
| `powerup` | tone 단음 | square 5음 상승 아르페지오 | 달성감 풍부 |
| `sprout` | tone | triangle 400 + 900 Hz | 동일(부드러운 등장) |
| `die` | tone 단음 | triangle 4음 하강 아르페지오 | 명확한 실패 감 |
| `flag` | tone | square 6음 상승 아르페지오 | 클리어 팡파레 |
| `1up` | tone | square 4음 상승 아르페지오 | 짧은 환희 |

**SoundForge 확장 키 (ChipAudio 미포함):** `laser` · `explosion` · `select` — 이 키를 쓰는 게임은 SoundForge 전용.

**폴백 순서:** audio.json `sfx[name]` 정의 있음 → `_playSpecSfx`(최우선). 없음 → `_playBuiltinSfx`(내장 폴백). 둘 다 없음 → 무음(no-op). 즉 ChipAudio 게임이 SoundForge로 엔진만 교체해도 모든 sfx('키') 호출이 작동한다.

**흔한 실패:** audio.json `sfx` 섹션에 키를 오타(`"jupm"`)로 정의 → `_playBuiltinSfx`로 폴백되어 쿠스텀이 반영 안 됨. 린트 (a) schema가 알 수 없는 kind enum을 잡지만 오타 키는 못 잡음 → 직접 청취 확인 필요.

**연관:** `SFX-DATA-DRIVEN`(audio.json 우선 원칙), `SFX-CATEGORY`(이벤트 → 키 매핑), [consistency-tools.md](./consistency-tools.md) §(C).

---

## ZzFX 파라미터 모델 → 우리 레이어 설계로 흡수

ZzFX(MIT, <1KB)는 코드를 이식하지 않고 **발상만 차용**한다(dossier §"초경량 SFX/음악 생성기" — "파라미터 모델을 우리 `voice()`에 흡수"). 아래는 ZzFX 핵심 파라미터가 우리 audio.json SFX 레이어 설계에 어떻게 녹아있는지 매핑이다.

| ZzFX 파라미터 | 우리 레이어 대응 | 설계 원칙 |
|---|---|---|
| `frequency` / `slide` / `deltaSlide` | `tone` kind의 `freq`→`to` 슬라이드 2음 연속 | `SFX-PITCH-ENV` |
| `pitchJump` / `pitchJumpTime` | `tone` 2겹을 `delay`로 시간차 발음(아르페지오 상승) | `SFX-PITCH-ENV` / `SFX-LAYER-3` |
| `noise` (혼합량) | `noise` kind 레이어를 별도 추가(`SFX-LAYER-3` 트랜지언트/테일) | `SFX-NOISE-TEXTURE` |
| `attack/sustain/release` | `dur`(= sustain+release 합산 근사) — SoundForge `_playSfxLayer`가 ADSR 내부 처리 | `SFX-LAYER-3` |
| `tremolo` | fm kind의 `modIndex` 변조, 또는 반복 tone 아르페지오 | `SFX-CATEGORY` |
| `bitCrush` | 현재 미구현(모바일 AudioWorklet 비용). 레트로 로파이 필요 시 `tone` square 단음으로 근사 | (확장 여지) |
| `repeatTime` | 동일 레이어를 여러 `delay`로 반복 정의(머신건 SFX) | `SFX-LAYER-3` |
| `modulation` (비브라토) | `fm` kind의 `harmonicity`·`modIndex` 조정 | `SFX-CATEGORY` |

핵심: ZzFX는 **샘플 버퍼 사전생성 방식**이라 일회성 짧은 SFX에 적합하지만, 우리는 **실시간 Tone.js 노드 그래프** 기반이라 지속음·BGM 레이어와 같은 엔진을 공유한다. ZzFX의 표현력(피치 점프·노이즈 혼합·슬라이드)은 `tone`+`noise`+`boom` 레이어 조합으로 충분히 재현 가능하다.

---

## 출처

- ZzFX(KilledByAPixel, MIT): https://github.com/KilledByAPixel/ZzFX — 파라미터 모델(slide/pitchJump/noise/tremolo/bitCrush) 발상 차용
- ZzFXM(Keith Clark, MIT): https://github.com/keithclark/ZzFXM — BGM 데이터 포맷 참고 모델
- jsfxr / sfxr(MIT/공개도메인 계열): 8비트 SFX 카테고리(pickup/jump/laser/explosion/hit/powerup/blip) 표준
- dossier §"초경량 SFX/음악 생성기 분석 + 차용 전략" · §"8비트 너머 SFX 디자인 원칙": `.omc/research/sound-research-dossier.md`
- SoundForge 엔진 구현: [`engine/soundforge.js`](../../../../engine/soundforge.js) `_playSpecSfx`/`_playSfxLayer`/`_playBuiltinSfx`
- SFX 레이어 필드 스펙: [consistency-tools.md](./consistency-tools.md) §(C)
- 크로스링크: [synthesis-recipes.md](./synthesis-recipes.md) · [mix-mobile.md](./mix-mobile.md) · [mood-music-theory.md](./mood-music-theory.md)
