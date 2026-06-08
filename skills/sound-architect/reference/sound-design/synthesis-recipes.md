# 합성 기법 레시피 (SYNTH-* · Tone.js 매핑)

> **목적:** SoundForge(`engine/soundforge.js`)가 사용하는 Tone.js v15 인스트루먼트·파라미터를 8개 코드화 원칙으로 정리한다.
> 음색을 새로 만들거나 기존 프리셋을 수정할 때 이 문서를 1차 레퍼런스로 삼는다.
>
> 상위: [INDEX.md](./INDEX.md) | [principles.md](./principles.md)
> 엔진: [../../../../engine/soundforge.js](../../../../engine/soundforge.js) (`_makeInstrument` / `_makeDrums` / `_sfxRack`)

---

### `SYNTH-ADSR` 풀 ADSR 포락선

**정의:** 음량(및 필터 컷오프)을 attack → decay → sustain → release 4단계로 형성한다.
지속음(패드·리드)과 타악음(드럼·플럭)을 **같은 envelope 인터페이스**로 표현한다.

**Tone.js 구현:** Tone의 모든 인스트루먼트는 `envelope` 옵션 객체를 받는다.
`attack`, `decay`, `sustain`(0~1 비율), `release`(초) 네 필드로 지정한다.

```js
// Tone.Synth 기본 envelope 형태
new Tone.Synth({
  envelope: {
    attack:  0.005,   // 0→peak 시간(s)
    decay:   0.1,     // peak→sustain 시간(s)
    sustain: 0.25,    // peak 대비 유지 레벨(0~1)
    release: 0.2      // 키 off 후 0까지 감쇠(s)
  }
});
// triggerAttackRelease(note, duration, time, velocity)
// — velocity(0~1)가 peak 음량을 스케일함
```

**SoundForge 프리셋:** 모든 `_makeInstrument` 프리셋(`square-lead`, `pulse-lead`, `triangle-bass`, `saw-bass`, `supersaw`, `fm-bell`, `fm-ep`, `pad`, `pluck`, `organ`)과 `_makeDrums`의 `MembraneSynth`·`NoiseSynth`가 이 구조를 쓴다.
타악음은 `sustain:0`·짧은 `decay`; 패드는 `attack:0.8`·`sustain:0.8`·`release:2.5`.

**흔한 실패:**
- `release` 시간보다 짧은 `duration`으로 `triggerAttackRelease`를 부르면 release가 잘린다 — `duration`을 `'8n'`처럼 음표 단위로 주면 Tone이 자동 계산.
- `sustain:0`인데 `decay`가 너무 짧으면(< 0.01s) 클릭 노이즈 발생 → 최소 0.04s 권장.

**연관:** `SYNTH-SUBTRACTIVE`(filterEnvelope), `SYNTH-FM`(modulationEnvelope), `MIX-VOICE-BUDGET`(긴 release = 보이스 점유 시간 증가)

---

### `SYNTH-SUBTRACTIVE` 서브트랙티브 합성

**정의:** 풍부한 파형(sawtooth·square)을 BiquadFilter로 깎고, **filterEnvelope**로 컷오프를 시간에 따라 움직여 살아있는 음색을 만든다.
신스의 가장 기본적인 구조: 오실레이터 → 필터 → 앰프.

**Tone.js 구현:** `Tone.MonoSynth`가 oscillator·filter·filterEnvelope·envelope를 한 번에 처리한다.

```js
new Tone.MonoSynth({
  oscillator:      { type: 'sawtooth' },
  filter:          { type: 'lowpass', Q: 2 },
  filterEnvelope:  {
    attack:        0.01,
    decay:         0.2,
    sustain:       0.3,
    release:       0.3,
    baseFrequency: 120,   // 닫힌 컷오프(Hz)
    octaves:       2.5    // attack 피크까지 열리는 폭(옥타브)
  },
  envelope:        { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 }
});
inst.triggerAttackRelease('C3', '8n', time, velocity);
```

**SoundForge 프리셋:**
- `saw-bass` — Q:2, baseFrequency:120, octaves:2.5 · 그루브 베이스 라인
- `supersaw` — type:'fatsawtooth', count:5, spread:28, Q:4, octaves:3 · 신스웨이브 리드

**흔한 실패:**
- `Q`를 20 이상으로 올리면 레조넌스 자기발진 → 쾅 소리. 모바일에서 피크 클리핑으로 이어짐.
- `baseFrequency`가 너무 낮으면(< 60Hz) 베이스에 저역 과다 → 마스터 컴프레서가 과부하.
- MonoSynth는 단일 보이스 — 폴리포니 필요 시 `PolySynth(Tone.MonoSynth, {...})`로 감쌈.

**연관:** `SYNTH-ADSR`(앰프 포락선), `SYNTH-SUPERSAW`(fat 오실레이터), `TIMBRE-SYNTHWAVE`, `TIMBRE-CHIPTUNE`

---

### `SYNTH-SUPERSAW` 멀티 오실레이터 유니즌

**정의:** 동일 음을 미세하게 어긋난 주파수로 N개 겹쳐("fat" 오실레이터) 두껍고 풍부한 음색을 만든다.
트랜스·신스웨이브 리드의 핵심. Tone.js에서는 `type:'fat<wave>'` + `count`·`spread`로 내장 지원한다.

**Tone.js 구현:** `fatsawtooth`, `fatsine`, `fatsquare` 등 `fat` 접두어 타입을 쓴다.

```js
// MonoSynth 내부 oscillator 지정(supersaw 프리셋 핵심 부분)
new Tone.MonoSynth({
  oscillator: {
    type:   'fatsawtooth',
    count:  5,     // 겹칠 오실레이터 수(3~7 권장)
    spread: 28     // 전체 detune 폭(cents). 넓을수록 와이더·두꺼움
  },
  // ...filterEnvelope, envelope 동일
});

// 패드(부드러운 유니즌 사인)
new Tone.PolySynth(Tone.Synth, {
  maxPolyphony: 6,
  oscillator: { type: 'fatsine', count: 3, spread: 20 },
  envelope:   { attack: 0.8, decay: 0.6, sustain: 0.8, release: 2.5 }
});
```

**SoundForge 프리셋:**
- `supersaw` — fatsawtooth, count:5, spread:28 · 신스웨이브 리드
- `pad` — fatsine, count:3, spread:20 · 앰비언트/따뜻한 패드
- `organ` — fatsquare, count:2, spread:10 · 오르간 근사

**흔한 실패:**
- `count:7` + `spread:50` 이상은 불협감·진흙탕 저역 → spread ≤ 30cents 유지.
- count가 늘어나면 CPU 비용도 비례 증가. 모바일에서 supersaw 레이어는 **1~2보이스** 상한(`MIX-VOICE-BUDGET`).
- `pad`의 긴 release(2.5s)는 보이스를 오래 점유 — 동시 코드 변환 빈도가 높으면 `maxPolyphony` 초과.

**연관:** `SYNTH-SUBTRACTIVE`(필터 결합), `TIMBRE-SYNTHWAVE`(four-floor + supersaw), `TIMBRE-AMBIENT`(pad), `MIX-VOICE-BUDGET`

---

### `SYNTH-FM` FM 합성

**정의:** 모듈레이터 오실레이터의 출력을 캐리어 주파수에 더해 복잡한 배음 스펙트럼을 생성한다.
`harmonicity`(주파수 비율)와 `modulationIndex`(깊이)로 벨·EP·금속음 등 다양한 음색을 소수의 파라미터로 제어한다.

**Tone.js 구현:** `Tone.FMSynth`가 carrier + modulator + 두 개의 포락선을 내장한다.

```js
// fm-bell 프리셋: harmonicity 정수비 → 조화로운 벨
new Tone.FMSynth({
  harmonicity:       3,     // modFreq = carrierFreq × 3
  modulationIndex:   12,    // 모듈레이션 깊이(클수록 풍부한 배음)
  envelope:          { attack: 0.002, decay: 0.6, sustain: 0,   release: 0.8 },
  modulation:        { type: 'sine' },
  modulationEnvelope:{ attack: 0.002, decay: 0.4, sustain: 0,   release: 0.4 }
});

// fm-ep 프리셋: harmonicity:1 → 일렉트릭 피아노 계열
new Tone.FMSynth({
  harmonicity:       1,
  modulationIndex:   6,
  envelope:          { attack: 0.005, decay: 0.4, sustain: 0.3, release: 0.6 },
  modulation:        { type: 'sine' },
  modulationEnvelope:{ attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.4 }
});

inst.triggerAttackRelease('A4', '4n', time, 0.7);
```

**SoundForge 프리셋:**
- `fm-bell` — harmonicity:3, modulationIndex:12 · 신비/장엄 씬 벨 소리
- `fm-ep` — harmonicity:1, modulationIndex:6 · 따뜻한 로파이 일렉 피아노
- SFX 랙 `_sfxRack.fm` — PolySynth(FMSynth), maxPolyphony:4 · 데이터주도 SFX용

**흔한 실패:**
- `harmonicity`를 무리수(예: 1.41)로 쓰면 비조화 배음 → 금속/불협음. 의도적 효과가 아니면 정수 또는 단순 분수비.
- `modulationIndex`가 너무 크면(> 20) 스펙트럼이 노이즈에 수렴 → 벨이 "삑" 소리.
- `modulationEnvelope.sustain:0`과 짧은 `decay`의 조합이 자연스러운 감쇠 벨을 만든다. sustain에 값을 주면 지속 FM → 음색이 변함.

**연관:** `SYNTH-ADSR`(두 개 포락선), `TIMBRE-FM16`(16비트 FM 장르), `TIMBRE-AMBIENT`(fm-bell + pad 조합)

---

### `SYNTH-WAVETABLE` 커스텀 파형 / 웨이브테이블

**정의:** 사인·사각·삼각·톱 외의 파형을 Tone oscillator의 `type` 문자열(pulse·fat 계열)이나
`PeriodicWave`(푸리에 계수 배열)로 정의해 오르간·풍부한 리드·NES 듀티 사이클 등을 표현한다.

**Tone.js 구현:** `type:'pulse'`는 `width` 파라미터로 듀티 사이클을 제어한다(0.5=사각형, 0.25=NES 25%).
`fatsquare`는 폭넓은 스펙트럼의 오르간 근사에 쓴다.

```js
// pulse-lead: NES 25% 듀티 사이클 근사
new Tone.Synth({
  oscillator: { type: 'pulse', width: 0.25 },
  envelope:   { attack: 0.004, decay: 0.08, sustain: 0.2, release: 0.18 }
});

// organ: fatsquare — 짝수 배음 강조 오르간풍
new Tone.PolySynth(Tone.Synth, {
  maxPolyphony: 6,
  oscillator: { type: 'fatsquare', count: 2, spread: 10 },
  envelope:   { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.4 }
});
```

**SoundForge 프리셋:**
- `pulse-lead` — type:'pulse', width:0.25 · NES/아케이드 리드
- `square-lead` — type:'square' · 칩튠 기본 리드
- `triangle-bass` — type:'triangle' · 칩튠/NES 베이스 채널
- `organ` — fatsquare, count:2, spread:10 · 오르간/교회 근사

**흔한 실패:**
- `width`를 0 또는 1로 설정하면 직류(DC offset) → 클리핑. 0.05~0.95 범위 사용.
- `PeriodicWave`는 파일이 없어 좋지만, 계수 배열이 크면 연산 비용 증가. 하모닉 수를 32 이내로 제한.
- `fatsquare`의 `sustain:0.9`는 오르간의 지속음 특성 — release가 너무 짧으면(< 0.2s) 음이 뚝 끊김.

**연관:** `SYNTH-SUPERSAW`(fat 계열 공통), `TIMBRE-CHIPTUNE`(square/triangle/pulse), `TIMBRE-ARCADE`(pulse-lead)

---

### `SYNTH-NOISE-PERC` 노이즈 기반 퍼커션

**정의:** 화이트·핑크 노이즈에 필터와 빠른 감쇠 포락선을 결합해 kick·snare·hihat을 합성한다.
kick은 `MembraneSynth`(피치 강하 sine), snare/hat은 `NoiseSynth`(필터드 노이즈), 금속음은 `MetalSynth`를 쓴다.

**Tone.js 구현:**

```js
// kick — MembraneSynth: 피치가 빠르게 강하하는 membrane 모델
new Tone.MembraneSynth({
  pitchDecay: 0.04,   // 피치 강하 속도(짧을수록 강한 "퍽")
  octaves:    6,      // 피치 강하 폭(옥타브)
  envelope:   { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 }
});
kick.triggerAttackRelease('C1', '8n', time, 0.9);

// snare — NoiseSynth + highpass Filter
var snare     = new Tone.NoiseSynth({ noise: { type: 'white' },
                  envelope: { attack: 0.001, decay: 0.16, sustain: 0 } });
var snareFilt = new Tone.Filter({ type: 'highpass', frequency: 1200 });
snare.connect(snareFilt); snareFilt.connect(out);
snare.triggerAttackRelease('16n', time, 0.7);

// hihat — NoiseSynth + 고역 highpass(7kHz)
var hat     = new Tone.NoiseSynth({ noise: { type: 'white' },
                envelope: { attack: 0.001, decay: 0.04, sustain: 0 } });
var hatFilt = new Tone.Filter({ type: 'highpass', frequency: 7000 });
hat.connect(hatFilt); hatFilt.connect(out);
```

**SoundForge 프리셋:**
- `kit` / `drums` 레이어 → `_makeDrums(vol)` 반환 `{ kick, snare, hat }` 세 인스트루먼트
- SFX 랙 `_sfxRack.boom` — MembraneSynth(pitchDecay:0.08, octaves:8) · 폭발/충격 SFX
- SFX 랙 `_sfxRack.metal` — MetalSynth(harmonicity:4.1, resonance:3500) · 금속 타격
- SFX 랙 `_sfxRack.noise` + `noiseFilt` — NoiseSynth + bandpass · 범용 노이즈 SFX

**흔한 실패:**
- NoiseSynth는 내부에서 매번 버퍼를 렌더하지 않고 Tone이 관리 — 단 `_makeDrums`를 **레이어 생성 시 1회만** 호출해야 함(루프마다 new 금지, `SYNTH-VOICE-REUSE`).
- `decay`가 너무 길면(> 0.5s) 같은 박자 반복 시 이전 보이스와 겹쳐 진흙탕 믹스.
- `highpass frequency`가 너무 낮으면 snare가 kick처럼 들림 — snare ≥ 800Hz, hat ≥ 5000Hz.

**연관:** `SYNTH-VOICE-REUSE`(드럼 랙 재사용), `TIMBRE-CHIPTUNE`·`TIMBRE-SYNTHWAVE`(four-floor 패턴), `MIX-VOICE-BUDGET`

---

### `SYNTH-PLUCK` 플럭 현 / Karplus-Strong 근사

**정의:** 짧은 어택 노이즈를 댐핑된 공명으로 순환시켜 현악기(하프·기타·플럭 리드)를 모델링한다.
`Tone.PluckSynth`가 Karplus-Strong 알고리즘을 내장 구현한다.

**Tone.js 구현:**

```js
new Tone.PluckSynth({
  attackNoise: 1,       // 초기 노이즈 버스트 길이(클수록 초기 잡음 강조)
  dampening:   4000,    // 댐핑 lowpass 컷오프(Hz). 낮을수록 빨리 어두워짐
  resonance:   0.9      // 피드백 계수(0~1). 클수록 긴 서스테인, 0.98+ 발산 주의
});
// PluckSynth는 triggerAttack만 있음(별도 release 없음 — 자연 감쇠)
inst.triggerAttack('A4', time, 0.7);
```

**SoundForge 프리셋:**
- `pluck` — attackNoise:1, dampening:4000, resonance:0.9 · 하프/기타/플럭 리드
- BGM `lead` 레이어에서 `arp` 패턴과 함께 사용 → 코드 아르페지오를 현악처럼 표현

**흔한 실패:**
- `resonance:0.98+`은 실질적으로 무한 지속 → 보이스가 점유 상태로 남아 폴리포니 초과.
- `dampening`이 8000Hz 이상이면 지나치게 밝고 날카로운 소리 — 자연스러운 현악은 3000~5000Hz.
- `triggerAttackRelease`가 없어 duration 제어 불가 — 짧은 arpegio에 적합, 지속 화음에는 `pad` 사용.

**연관:** `SYNTH-ADSR`(자연 감쇠로 ADSR 대체), `SYNTH-VOICE-REUSE`(BGM 레이어 인스트루먼트 1회 생성), `TIMBRE-AMBIENT`(pluck + pad 조합), `MOOD-*`(신비/평온 무드)

---

### `SYNTH-VOICE-REUSE` 인스트루먼트 / 이펙트 재사용

**정의:** 인스트루먼트와 이펙트 노드는 **1회 생성해 반복 호출**한다.
BGM 스텝마다, SFX 발음마다 `new Tone.Xxx()`를 호출하면 GC 압박과 CPU 스파이크가 발생해 모바일에서 오디오 끊김이 생긴다.

**Tone.js 구현:**

```js
// 올바른 패턴 — _build()에서 1회 구성
SoundForge.prototype._build = function () {
  // 레이어 인스트루먼트: 레이어당 1개
  this._layers['lead'] = { inst: this._makeInstrument('pluck'), vol: vol };

  // SFX 랙: 종류별 1개 공용 폴리 신스
  this._sfxRack.poly  = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 8 });
  this._sfxRack.fm    = new Tone.PolySynth(Tone.FMSynth, { maxPolyphony: 4 });
  this._sfxRack.noise = new Tone.NoiseSynth({ ... });
  this._sfxRack.boom  = new Tone.MembraneSynth({ ... });
  this._sfxRack.metal = new Tone.MetalSynth({ ... });

  // 이펙트 send: 리버브·딜레이 각 1개
  var reverb  = new Tone.Reverb({ decay: 2.2, wet: 1 });
  var revSend = new Tone.Gain(0.18);
  reverb.connect(master); revSend.connect(reverb);
};

// sfx() 호출 — 랙을 재사용, new 없음
SoundForge.prototype._playSfxLayer = function (L, t) {
  this._sfxRack.poly.triggerAttackRelease(L.freq, L.dur, t, L.vol);
};
```

**SoundForge 프리셋:** 엔진 전체 구조가 이 원칙으로 설계됨.
- `_sfxRack` — 5종(poly·fm·noise·boom·metal) 1회 구성
- `_nodes` — 마스터·컴프레서·리미터·리버브·딜레이 1회 구성
- `_layers` — BGM 레이어 인스트루먼트·Volume 버스 1회 구성

**흔한 실패:**
- SFX 함수 안에서 `new Tone.Synth().toDestination().triggerAttack(...)` 패턴 — GC 발생·노드 누수.
- `Tone.Reverb`를 매 보이스에 연결(send 버스 미사용) → ConvolverNode 수 × CPU 폭발.
- `maxPolyphony`를 초과하면 Tone이 오래된 보이스를 스틸(voice stealing) — BGM 음이 SFX에 잘릴 수 있음. SFX 랙과 BGM 레이어를 **분리 인스트루먼트**로 유지할 것(`_sfxRack` vs `_layers`).

**연관:** `MIX-VOICE-BUDGET`(16보이스 상한), `MIX-SEND-FX`(이펙트 1회 구성), 모든 SYNTH-* 원칙(구성 시점이 1회여야 함)

---

## 출처

합성 기법 · 포락선
- MDN — Advanced techniques (ADSR·노이즈·필터·PeriodicWave): https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques
- Dobrian — Building a Synthesizer (포락선·필터): https://dobrian.github.io/cmp/topics/building-a-synthesizer-with-web-audio-api/4.envelopes.html
- WolfSound — Envelopes in Sound Synthesis: https://thewolfsound.com/envelopes/

FM 합성
- greweb — FM with Web Audio API: https://greweb.me/2013/08/FM-audio-api

슈퍼소우 / 멀티 오실레이터
- noisehack — How to Build a Supersaw Synth with Web Audio API: https://noisehack.com/how-to-build-supersaw-synth-web-audio-api/

Karplus-Strong / 플럭
- Karplus-Strong in JavaScript (Nizhawan): https://nitinnizhawan.com/string/2013/11/17/karplus-strong-string-synthesis-in-javascript
- demofox — Synthesizing a Plucked String: https://blog.demofox.org/2016/06/16/synthesizing-a-pluked-string-sound-with-the-karplus-strong-algorithm/

Tone.js 공식 문서
- Tone.js FMSynth: https://tonejs.github.io/docs/14.7.39/FMOscillator.html
- Tone.js 전체 API (v15): https://tonejs.github.io/docs/

내부 리서치
- `.omc/research/sound-research-dossier.md` (합성 기법 레시피·FM·슈퍼소우·노이즈 퍼커션·Karplus-Strong 절)

---

*형제 파일:*
[mood-music-theory.md](./mood-music-theory.md) · [sfx-design.md](./sfx-design.md) · [genre-timbres.md](./genre-timbres.md) · [mix-mobile.md](./mix-mobile.md)
엔진: [../../../../engine/soundforge.js](../../../../engine/soundforge.js)
