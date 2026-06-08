# 장르 음색 레퍼런스 — SoundForge 프리셋 팔레트 (TIMBRE-*)

> [`sound-architect`](../../SKILL.md) · 색인 [INDEX.md](./INDEX.md)
> 장르 스캐폴드를 `engine/soundforge.js` 프리셋 팔레트로 근사하는 9개 원칙.
> **T2 다장르·레이어드 이상**에서 읽는 파일. 항상 [principles.md](./principles.md)(§5 장르 처방)와 [mood-music-theory.md](./mood-music-theory.md)를 먼저 읽고 무드를 못 박은 뒤 여기서 음색을 고른다.
> 크로스링크: [synthesis-recipes.md](./synthesis-recipes.md) · [mood-music-theory.md](./mood-music-theory.md) · [adaptive-music.md](./adaptive-music.md) · [mix-mobile.md](./mix-mobile.md)

---

## 장르→음색 레시피 표

| 장르 | 무드 | SoundForge 프리셋 레이어 구성 | 패턴 | 이펙트 | 적합도 |
|---|---|---|---|---|---|
| **칩튠(NES)** | cheerful / heroic | square-lead(리드) + pulse-lead(화음) + triangle-bass(베이스) + kit(노이즈 퍼커션) | arp / root8 / backbeat | 이펙트 없음~짧은 딜레이 | 채택 |
| **신스웨이브** | tense / heroic | supersaw(리드) + saw-bass(베이스) + pad(코드 베드) + kit(four-floor) | arp / root8 / chords / four-floor | 큰 리버브 + 핑퐁 딜레이 + 사이드체인 덕킹 | 채택 |
| **앰비언트/드론** | calm / mystic | pad(폴리 코드) + 드론 sine(저음 pad) + fm-bell(악센트) | chords / pulse | 매우 긴 리버브(decay ≥ 3s) + 긴 딜레이 | 채택 |
| **로파이 힙합** | warm / calm | fm-ep(멜로디) + saw-bass(베이스) + pad(코드) + kit(backbeat) | arp / root8 / chords / backbeat | 비트크러셔(근사) + 짧은 리버브 | 일부차용 |
| **16비트 FM(Genesis)** | heroic / tense | fm-bell + fm-ep(멜로디·화음) + saw-bass(베이스) + kit | arp / root8 / backbeat | 짧은 리버브 | 일부차용 |
| **아케이드** | cheerful | pulse-lead(리드) + triangle-bass(베이스) + kit(noise) | arp / root8 / pulse | 짧은 딜레이 | 채택 |
| **오케스트라풍** | heroic / solemn | supersaw(스트링 근사) + organ(브라스 근사) + pad(현 베드) + kit(팀파니 kick) | chords / root8 / four-floor | 홀 리버브(decay ≥ 2.5s) + 와이드 패닝 | 근사한계 |

---

## 원칙 정의

### `TIMBRE-FIT` — 장르(스캐폴드) → 음색 팔레트 정합

**정의.** 장르 스캐폴드(platformer-game·topdown-shooter·arcade-classic·puzzle-game·endless-runner)가 곧 디폴트 음색 패밀리를 결정한다. 코어 동사(점프·쏘기·달리기·매치)와 STORY.md 톤이 같은 말을 해야 한다(`MOOD-LUDO-HARMONY`). 음색을 고르기 전에 [principles.md](./principles.md) §5 빠른 처방 표를 먼저 확인한다.

**출처.** principles.md §5 장르 스캐폴드 표; dossier "무드 → 음악 매핑 표".

**우리 엔진 구현.** `audio.json` `bgm.track.layers[]`에서 `preset` 필드가 음색 팔레트를 결정한다. 허용 preset: `square-lead` / `pulse-lead` / `triangle-bass` / `saw-bass` / `supersaw` / `fm-bell` / `fm-ep` / `pad` / `pluck` / `organ` / `kit`. 허용 pattern: `chords` / `root8` / `pulse` / `arp` / `offbeat` / `backbeat` / `four-floor`.

**흔한 실패.** 장르를 먼저 고르고 음색을 나중에 결정하면 칩튠+오케스트라 잡탕(`TIMBRE-ONE-FAMILY` 위반)이 된다. 항상 무드 → 장르 처방 → 팔레트 순서를 지킨다.

**연관.** `TIMBRE-ONE-FAMILY` · `MOOD-LUDO-HARMONY` · [INDEX.md 빠른 처방 표](./INDEX.md)

---

### `TIMBRE-CHIPTUNE` — 칩튠(NES 모델): square + pulse + triangle-bass + kit(노이즈)

**정의.** NES APU 4채널을 SoundForge로 근사한다: ① `square-lead`(pulse 1 — 리드 멜로디, duty 50%) + ② `pulse-lead`(pulse 2 — 화음·카운터멜로디, duty 12.5%) + ③ `triangle-bass`(triangle 채널 — 베이스, 필터 없음) + ④ `kit`(노이즈 채널 근사 — LFSR 드럼). BPM 120~160, 스케일 장조/장조 펜타토닉.

**출처.** NESdev Wiki — APU (pulse/triangle/noise 채널); dossier "장르별 음색 레시피 표" 칩튠(NES) 항목.

**우리 엔진 구현.**
```json
{ "layers": [
  { "id": "lead",   "preset": "square-lead",   "pattern": "arp",      "minIntensity": 0,    "vol": -10 },
  { "id": "harm",   "preset": "pulse-lead",    "pattern": "pulse",    "minIntensity": 0.3,  "vol": -13 },
  { "id": "bass",   "preset": "triangle-bass", "pattern": "root8",    "minIntensity": 0,    "vol": -11 },
  { "id": "drums",  "preset": "kit",           "pattern": "backbeat", "minIntensity": 0.2,  "vol": -12 }
]}
```

**흔한 실패.** `supersaw`나 `pad`를 칩튠 스타일에 추가하면 음색 잡탕이 된다. NES 4채널 제약을 의도적으로 존중한다. 리버브도 최소화(NES는 공간감 없음).

**연관.** `TIMBRE-ARCADE` · `TIMBRE-ONE-FAMILY` · [synthesis-recipes.md](./synthesis-recipes.md)

---

### `TIMBRE-SYNTHWAVE` — supersaw 리드 + saw-bass + 큰 리버브 + kit four-floor + 사이드체인 덕킹

**정의.** 신스웨이브의 핵심은 ① `supersaw`(fat detune 리드 — 5~7 oscillator unison, spread ±18 cents) + ② `saw-bass`(굵은 베이스) + ③ `pad`(코드 베드, minIntensity 낮게) + ④ `kit`(four-floor kick + 게이티드 리버브 snare). 필수 이펙트: 큰 리버브(decay 2~3s) + 핑퐁 딜레이 + `MIX-DUCK` 사이드체인 펌핑(kick 타이밍에 BGM 버스 gain 덕킹). BPM 90~120, 스케일 minor/aeolian.

**출처.** dossier "장르별 음색 레시피 표" 신스웨이브/레트로웨이브; noisehack — Supersaw Synth with Web Audio API.

**우리 엔진 구현.**
```json
{ "bpm": 110, "scale": "aeolian", "key": "A",
  "progression": ["i", "VI", "III", "VII"],
  "layers": [
  { "id": "pad",    "preset": "pad",      "pattern": "chords",     "minIntensity": 0,    "vol": -18 },
  { "id": "bass",   "preset": "saw-bass", "pattern": "root8",      "minIntensity": 0,    "vol": -12 },
  { "id": "drums",  "preset": "kit",      "pattern": "four-floor", "minIntensity": 0.25, "vol": -11 },
  { "id": "lead",   "preset": "supersaw", "pattern": "arp",        "minIntensity": 0.7,  "vol": -13 }
]}
```
`SoundForge`에서 `supersaw` 프리셋은 Tone.js FatOscillator(count 5, spread 18)로 구현됨. `pad`는 자동으로 revSend(리버브 send)에 연결된다(soundforge.js L.212).

**흔한 실패.** `supersaw` 레이어를 여러 겹 쌓으면 동시 보이스 예산(16보이스) 초과 → 모바일 끊김(`MIX-VOICE-BUDGET`). supersaw 1~2 레이어로 제한.

**연관.** `TIMBRE-AMBIENT` · `MIX-DUCK` · [mix-mobile.md](./mix-mobile.md) · [adaptive-music.md](./adaptive-music.md)

---

### `TIMBRE-AMBIENT` — pad(긴 ADSR) + 드론 + 긴 리버브, 리듬 최소

**정의.** 앰비언트/드론은 ① `pad`(폴리 코드, attack 1~2s, release 3~5s — 긴 ADSR) + ② 저음 드론(`pad` 또는 sine, 루트음 지속) + ③ `fm-bell`(악센트 벨, 간헐적). 리듬 레이어(`kit`)는 없거나 최소(pattern: `pulse` 수준). 이펙트는 decay ≥ 3s 리버브 + 긴 딜레이(0.4~0.5s). BPM 50~80, 스케일 Lydian/major-pentatonic. pattern은 `chords`(마디 머리 코드 유지).

**출처.** dossier "장르별 음색 레시피 표" 앰비언트/드론; dossier "무드 → 음악 매핑 표" 평온/명상 행.

**우리 엔진 구현.**
```json
{ "bpm": 65, "scale": "lydian", "key": "C",
  "layers": [
  { "id": "drone", "preset": "pad",      "pattern": "chords", "minIntensity": 0,   "vol": -20 },
  { "id": "bed",   "preset": "pad",      "pattern": "chords", "minIntensity": 0,   "vol": -17 },
  { "id": "bell",  "preset": "fm-bell",  "pattern": "arp",    "minIntensity": 0.4, "vol": -16 }
]}
```
`pad`와 `fm-bell`은 soundforge.js L.212에서 자동으로 revSend에 연결 — 긴 리버브 자동 적용.

**흔한 실패.** `kit`(four-floor)를 추가하는 순간 앰비언트 정체성이 깨진다. 리듬 레이어가 필요하면 `TIMBRE-SYNTHWAVE`로 방향을 바꾼다. decay 4s+ ConvolverNode를 여러 send에 걸면 CPU 과부하(`MIX-SEND-FX` — send 1개, decay ≤ 3s).

**연관.** `TIMBRE-LOFI` · `MIX-SEND-FX` · [synthesis-recipes.md](./synthesis-recipes.md)

---

### `TIMBRE-LOFI` — fm-ep + 어두운 lowpass + 비트크러셔 텍스처 + 부드러운 kit, 70~90 BPM

**정의.** 로파이 힙합은 ① `fm-ep`(일렉트릭 피아노 — FM harmonicity 1, 따뜻한 어택) + ② `saw-bass`(베이스, lowpass 어둡게) + ③ `pad`(코드 베드) + ④ `kit`(backbeat — 부드러운 kick/snare, 스윙 16분). 텍스처: 비트크러셔(bit 6~8, 다운샘플 2~4) + 짧은 리버브(decay 1s 이하). 7th·9th 코드 보이싱(Dorian/minor). BPM 70~90, 반드시 스윙(`Tone.Transport.swing` 0.5).

**출처.** dossier "장르별 음색 레시피 표" 로파이 힙합; dossier "이펙트 레시피" D) 비트크러셔.

**우리 엔진 구현.**
```json
{ "bpm": 82, "scale": "dorian", "key": "D",
  "progression": ["i", "IV", "VII", "III"],
  "layers": [
  { "id": "pad",   "preset": "pad",     "pattern": "chords",   "minIntensity": 0,   "vol": -18 },
  { "id": "ep",    "preset": "fm-ep",   "pattern": "arp",      "minIntensity": 0,   "vol": -13 },
  { "id": "bass",  "preset": "saw-bass","pattern": "root8",    "minIntensity": 0,   "vol": -12 },
  { "id": "drums", "preset": "kit",     "pattern": "backbeat", "minIntensity": 0.2, "vol": -13 }
]}
```
비트크러셔는 `audio.json` `fx.bitcrush` 파라미터로 지정(SoundForge WaveShaper 근사 또는 옵션 비활성).

**흔한 실패.** 비트크러셔를 과하게(bit ≤ 4)하면 청각 피로가 크다. 70~90 BPM을 벗어나거나 스윙 없이 쓰면 로파이 정체성이 사라진다.

**연관.** `TIMBRE-FM16` · `TIMBRE-AMBIENT` · [synthesis-recipes.md](./synthesis-recipes.md)

---

### `TIMBRE-FM16` — 16비트 FM(Genesis/YM2612): fm-bell + fm-ep 조합, harmonicity 정수비

**정의.** Sega Genesis/YM2612는 4 오퍼레이터 FM. SoundForge에서 ① `fm-bell`(밝은 금속성 리드 — harmonicity 2 또는 3, 정수비) + ② `fm-ep`(부드러운 보이스/코드 — harmonicity 1) + ③ `saw-bass`(FM 베이스 근사) + ④ `kit`(FM 드럼/노이즈 backbeat). harmonicity가 무리수(예: 1.41)이면 불협 금속음 → 정수비(1·2·3·4)만 사용. modulation index는 ADSR decay와 함께 줄여 "땡~" 자연 감쇠.

**출처.** dossier "장르별 음색 레시피 표" 16비트 FM; dossier "합성 기법 레시피" §4 FM 합성.

**우리 엔진 구현.** `fm-bell`과 `fm-ep` 모두 soundforge.js에서 `Tone.FMSynth`(harmonicity, modulationIndex 파라미터)로 구현. `audio.json`에서 `presetParams.harmonicity` 정수값 지정 가능.
```json
{ "layers": [
  { "id": "lead",  "preset": "fm-bell", "pattern": "arp",      "minIntensity": 0,    "vol": -11 },
  { "id": "chord", "preset": "fm-ep",   "pattern": "chords",   "minIntensity": 0,    "vol": -14 },
  { "id": "bass",  "preset": "saw-bass","pattern": "root8",    "minIntensity": 0,    "vol": -12 },
  { "id": "drums", "preset": "kit",     "pattern": "backbeat", "minIntensity": 0.25, "vol": -12 }
]}
```

**흔한 실패.** harmonicity에 무리수를 쓰면 Genesis 느낌이 아니라 불협 SFX가 된다. `supersaw`를 추가하면 FM 16비트 정체성이 깨진다(`TIMBRE-ONE-FAMILY`).

**연관.** `TIMBRE-CHIPTUNE` · [synthesis-recipes.md](./synthesis-recipes.md) SYNTH-FM

---

### `TIMBRE-ARCADE` — pulse-lead + 빠른 arp 패턴 + noise explosion SFX, 빠른 BPM

**정의.** 아케이드(클래식 캐비닛 스타일)는 ① `pulse-lead`(duty 25% 펄스 — 또렷한 블립) + ② `triangle-bass`(베이스) + ③ `kit`(noise burst — SFX explosion 근사). arp 패턴을 빠르게(BPM 140~180, 16분 아르페지오). 이펙트는 짧은 딜레이(0.12~0.15s)만. 음색이 밝고 단락적(attack 짧음, release 짧음). bandpass 필터로 중역 강조.

**출처.** dossier "장르별 음색 레시피 표" 아케이드; jsfxr 프리셋 카테고리(pickup/laser/blip).

**우리 엔진 구현.**
```json
{ "bpm": 160, "scale": "major", "key": "C",
  "progression": ["I", "V", "vi", "IV"],
  "layers": [
  { "id": "lead",  "preset": "pulse-lead",    "pattern": "arp",      "minIntensity": 0,    "vol": -10 },
  { "id": "bass",  "preset": "triangle-bass", "pattern": "root8",    "minIntensity": 0,    "vol": -11 },
  { "id": "drums", "preset": "kit",           "pattern": "backbeat", "minIntensity": 0.2,  "vol": -13 }
]}
```
SFX에서 noise explosion은 `sfx()` 호출로 별도 처리(`SFX-NOISE-TEXTURE`).

**흔한 실패.** `supersaw`나 `pad`를 추가하면 아케이드의 날카로운 정체성이 묻힌다. BPM 140 미만이면 긴박감이 없다.

**연관.** `TIMBRE-CHIPTUNE` · [sfx-design.md](./sfx-design.md) SFX-NOISE-TEXTURE

---

### `TIMBRE-ORCHESTRAL` — supersaw 스트링 근사 + organ 브라스 근사 + 팀파니(kick) + 홀 리버브 (근사 한계 명시)

**정의.** 오케스트라풍은 SoundForge로 "느낌"만 근사 가능(실제 오케스트라가 아님을 명시). ① `supersaw`(스트링 섹션 근사 — 길고 부드러운 attack, detune 작게) + ② `organ`(브라스/팀파니 근사 — 하모닉 배음) + ③ `pad`(현 베드 지속음) + ④ `kit`(팀파니 = 피치 하강 kick). 홀 리버브(decay ≥ 2.5s) + 와이드 스테레오 패닝. `audio.json` `originalityNote`에 "오케스트라 근사(합성), 실제 샘플 0"을 명시.

**출처.** dossier "장르별 음색 레시피 표" 오케스트라풍 패드 "일부차용(근사 한계)".

**근사 한계.** `supersaw`는 사운드폰트 스트링과 전혀 다름. 풍성한 오케스트라 질감이 필요하면 외부 CC0 SoundFont(assets.json 라이선스 게이트)를 검토하되, 기본은 절차 합성 근사로 충분한지 무드·게임 규모를 먼저 확인한다.

**우리 엔진 구현.**
```json
{ "bpm": 108, "scale": "major", "key": "G",
  "progression": ["I", "V", "vi", "IV"],
  "layers": [
  { "id": "strings","preset": "supersaw","pattern": "chords",     "minIntensity": 0,   "vol": -15 },
  { "id": "brass",  "preset": "organ",   "pattern": "pulse",      "minIntensity": 0.4, "vol": -14 },
  { "id": "pad",    "preset": "pad",     "pattern": "chords",     "minIntensity": 0,   "vol": -20 },
  { "id": "drums",  "preset": "kit",     "pattern": "four-floor", "minIntensity": 0.5, "vol": -14 }
]}
```

**흔한 실패.** `supersaw` + `organ` + `pad` 동시 재생은 보이스 예산을 빠르게 소진한다. `minIntensity` 게이트를 활용해 저강도 구간에서는 레이어 수를 줄인다(`ADAPT-LAYER-GATE`).

**연관.** `TIMBRE-SYNTHWAVE` · `MIX-VOICE-BUDGET` · [adaptive-music.md](./adaptive-music.md)

---

### `TIMBRE-ONE-FAMILY` — 한 게임 한 음색 패밀리 (칩튠+오케스트라 잡탕 금지)

**정의.** 하나의 게임에서 BGM·SFX 전체가 하나의 음색 스타일가이드를 상속한다. 칩튠 BGM + 오케스트라 SFX, 신스웨이브 BGM + 로파이 SFX처럼 장르를 혼합하면 청각 정체성이 붕괴된다. AUDIO.md §6 스타일가이드에 "이 게임의 음색 패밀리: [장르 하나]"를 명시하고, 모든 트랙·SFX가 이를 상속한다.

**출처.** principles.md §3 공통 캐논 `TIMBRE-ONE-FAMILY`; dossier "CC0 / IP-safe 가이드" §6 레퍼런스 분리.

**우리 엔진 구현.** `audio.json` 최상위 `timbreFamily` 필드로 선언. lint-audio.mjs가 모든 레이어 preset이 해당 패밀리 허용 목록 내에 있는지 검사.
```json
{ "timbreFamily": "chiptune",
  "allowedPresets": ["square-lead","pulse-lead","triangle-bass","kit"] }
```

**흔한 실패.** "이건 보스 전용 오케스트라"처럼 섹션별 예외를 만드는 순간 잡탕 시작. 보스 긴박함은 `ADAPT-LAYER-GATE`로 기존 패밀리 안에서 레이어를 더 쌓아 표현한다.

**연관.** `TIMBRE-FIT` · `ADAPT-LAYER-GATE` · [consistency-tools.md](./consistency-tools.md) · [adaptive-music.md](./adaptive-music.md)

---

## 출처

- **NES APU 채널 구조(칩튠):** [NESdev Wiki — APU](https://www.nesdev.org/wiki/APU)
- **8비트 음악 제작 가이드(칩튠):** [How to make 8-bit Music — Ozzed](https://ozzed.net/how-to-make-8-bit-music.shtml)
- **신스웨이브 코드 진행·음색:** [eMastered — Synthwave Chord Progressions](https://emastered.com/blog/synthwave-chord-progressions)
- **슈퍼소우 Web Audio 구현:** [noisehack — Supersaw Synth with Web Audio API](https://noisehack.com/how-to-build-supersaw-synth-web-audio-api/)
- **로파이 힙합 코드 진행:** [guitarbased — Lo-Fi Chord Progressions](https://www.guitarbased.com/lo-fi-chord-progressions/)
- **16비트 FM 합성(Genesis/YM2612):** [greweb — FM with Web Audio API](https://greweb.me/2013/08/FM-audio-api)
- **jsfxr/sfxr 아케이드 SFX 카테고리:** MIT/공개도메인, ZzFX 파라미터 모델 참조
- **장르별 음색 레시피 표 원본:** `.omc/research/sound-research-dossier.md` §장르별 음색 레시피 표
- **오케스트라 근사 한계·CC0 보증:** dossier "CC0 / IP-safe 가이드" §6; principles.md `CC0-ORIGINAL`
