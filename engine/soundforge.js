/* ============================================================================
 * SoundForge — Tone.js 기반 절차적 사운드 엔진 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * ChipAudio(8비트 단일 오실레이터)의 한계를 넘는 "게임에 어울리는" BGM/SFX 엔진.
 * Tone.js(v15, MIT, vendored engine/tone.js)를 감싸 다음을 코드로 합성한다 — 오디오 파일 0개:
 *   - 장르 음색 프리셋(칩튠/신스웨이브/앰비언트/로파이/FM/아케이드/오케스트라풍)
 *   - 데이터주도 적응형 BGM(스케일·코드진행·레이어, 인텐시티별 수직 레이어 크로스페이드)
 *   - 레이어드 SFX(트랜지언트+바디+테일, 피치 엔벨로프) — 8비트 너머의 임팩트
 *   - 마스터 버스(Volume→Compressor→Limiter)·절차 IR 리버브/딜레이 send
 *   - Tone.Transport 샘플정확 스케줄러(= setInterval 박자 지터 제거)
 *
 * ★ ChipAudio 드롭인 호환: unlock()/resume()/suspend()/toggleMute()/startBgm()/stopBgm()/sfx()
 *   를 동일 시그니처로 제공한다 → mobile.js(window.GAME_AUDIO 참조)를 수정 없이 그대로 쓴다.
 *
 * 사용:
 *   <script src="../../engine/tone.js"></script>        <!-- phaser 다음, soundforge 이전 -->
 *   <script src="../../engine/soundforge.js"></script>
 *   var GAME_AUDIO = new SoundForge(AUDIO_SPEC);  // AUDIO_SPEC = audio.json(없으면 기본 트랙)
 *   window.GAME_AUDIO = GAME_AUDIO;               // mobile.js 음소거/가시성 가드가 참조
 *   // 첫 제스처(Tap to start)에서:
 *   GAME_AUDIO.unlock(); GAME_AUDIO.startBgm();
 *   // 플레이 중:
 *   GAME_AUDIO.sfx('jump');  GAME_AUDIO.setIntensity(0.7);  GAME_AUDIO.setSection('combat');
 *
 * ⚠ 주의:
 *   - Tone 미로드/구형 브라우저면 graceful no-op(모든 메서드 안전 무시). 게임은 계속 동작.
 *   - 컨텍스트는 첫 unlock()(사용자 제스처)에서 비로소 생성/resume — 모바일 자동재생 정책 준수.
 *   - BGM 멜로디는 스케일·진행에서 절차 생성(오리지널, 100% CC0) — 기존 곡 인용 금지.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var Tone = global.Tone || null;

  // ── 음악 이론 헬퍼 (스케일 인터벌·코드 빌더) ─────────────────────────────────
  // 모드/스케일 = 루트로부터 반음 간격(옥타브 내). MOOD-* 매핑의 코드화 대상.
  var SCALES = {
    'major':            [0, 2, 4, 5, 7, 9, 11],   // ionian — 밝음/희망
    'ionian':           [0, 2, 4, 5, 7, 9, 11],
    'minor':            [0, 2, 3, 5, 7, 8, 10],   // aeolian — 멜랑콜리
    'aeolian':          [0, 2, 3, 5, 7, 8, 10],
    'dorian':           [0, 2, 3, 5, 7, 9, 10],   // 어둡지만 그라운디드
    'phrygian':         [0, 1, 3, 5, 7, 8, 10],   // 이국·긴장
    'lydian':           [0, 2, 4, 6, 7, 9, 11],   // 부유·몽환
    'mixolydian':       [0, 2, 4, 5, 7, 9, 10],   // 블루지·밝음
    'locrian':          [0, 1, 3, 5, 6, 8, 10],   // 불안
    'harmonic-minor':   [0, 2, 3, 5, 7, 8, 11],   // 긴박·드라마
    'major-pentatonic': [0, 2, 4, 7, 9],          // 평온·동요 없음
    'minor-pentatonic': [0, 3, 5, 7, 10],         // 블루스·차분
    'whole-tone':       [0, 2, 4, 6, 8, 10]       // 불안·부유
  };
  // 음이름 → 루트 반음(C=0). 'A','C#','Bb' 등.
  var NOTE_BASE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  // 로마 숫자(진행) → 스케일 도수(1~7). 대소문자 무시(코드 quality 는 스케일에서 다이어토닉 파생).
  var ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 };

  function rootSemitone(key) {
    if (key == null) return 9; // 기본 A
    key = ('' + key).trim();
    if (NOTE_BASE[key] != null) return NOTE_BASE[key];
    var two = key.slice(0, 2), one = key.slice(0, 1);
    if (NOTE_BASE[two] != null) return NOTE_BASE[two];
    if (NOTE_BASE[one] != null) return NOTE_BASE[one];
    return 9;
  }
  // MIDI 번호 → 주파수(Hz). 69 = A4 = 440Hz.
  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // 스케일 도수(1-base) + 옥타브 → MIDI. degree 가 스케일 길이를 넘으면 옥타브 래핑.
  function degreeToMidi(scaleIv, rootSemi, octave, degree1) {
    var n = scaleIv.length;
    var idx = (degree1 - 1) % n;
    var oct = octave + Math.floor((degree1 - 1) / n);
    return 12 * (oct + 1) + rootSemi + scaleIv[idx]; // C-1=0 → octave+1
  }

  // 진행 토큰(roman 'i'/'bVII' 또는 정수 도수) → 다이어토닉 트라이어드 MIDI 배열.
  function chordMidis(token, scaleIv, rootSemi, octave) {
    var degree = 1, flat = 0;
    if (typeof token === 'number') { degree = ((token - 1) % 7) + 1; }
    else {
      var t = ('' + token).trim();
      if (t.charAt(0) === 'b' || t.charAt(0) === '♭') { flat = 1; t = t.slice(1); }
      var key = t.toLowerCase();
      degree = ROMAN[key] || parseInt(t, 10) || 1;
    }
    // 다이어토닉 3화음 = 도수 + 3도 + 5도(스케일 위 한 칸 건너뛰기)
    var root = degreeToMidi(scaleIv, rootSemi, octave, degree) - flat;
    var third = degreeToMidi(scaleIv, rootSemi, octave, degree + 2) - flat;
    var fifth = degreeToMidi(scaleIv, rootSemi, octave, degree + 4) - flat;
    return [root, third, fifth];
  }

  // ── 기본 트랙(스펙 없을 때) — 차분한 미니멀 적응형 BGM ───────────────────────
  var DEFAULT_TRACK = {
    mood: 'calm', scale: 'minor-pentatonic', key: 'A', bpm: 104,
    progression: ['i', 'VI', 'III', 'VII'],
    layers: [
      { id: 'pad', preset: 'pad', pattern: 'chords', minIntensity: 0, vol: -16 },
      { id: 'bass', preset: 'triangle-bass', pattern: 'root8', minIntensity: 0.25, vol: -12 },
      { id: 'drums', preset: 'kit', pattern: 'backbeat', minIntensity: 0.45, vol: -12 },
      { id: 'lead', preset: 'pluck', pattern: 'arp', minIntensity: 0.7, vol: -14 }
    ]
  };

  // ============================================================================
  // SoundForge 생성자 — spec = audio.json 객체(또는 null)
  // ============================================================================
  function SoundForge(spec) {
    this.spec = spec || {};
    this.ready = false;       // _build 완료
    this.muted = false;
    this._bgmWanted = false;  // startBgm 의도(가시성 변화로 멈춰도 유지 → resume 자동 재가동, ChipAudio 패턴 계승)
    this._bgmOn = false;
    this.intensity = (this.spec.bgm && this.spec.defaultIntensity) || 0.5;
    this.section = 'main';
    this._step = 0;
    this._repeatId = null;
    this._nodes = {};         // 마스터/센드
    this._layers = {};        // BGM 레이어 { vol, inst }
    this._sfxRack = {};       // 공용 SFX 신스
    this._curTrackId = null;
    this._enabled = !!Tone;   // Tone 없으면 no-op
    this.maxVoices = (this.spec.budget && this.spec.budget.maxVoices) || 16;
  }

  // ── graceful 가드: Tone 없거나 미빌드면 안전 무시 ────────────────────────────
  SoundForge.prototype._ok = function () { return this._enabled && Tone; };

  // ── 마스터 버스 + send 이펙트 구성(1회) ──────────────────────────────────────
  SoundForge.prototype._buildBus = function () {
    var m = this.spec.master || {};
    var master = new Tone.Volume(m.volume == null ? -6 : m.volume);
    var comp = new Tone.Compressor({ threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 30 });
    var limiter = new Tone.Limiter(m.limiter == null ? -1 : m.limiter);
    master.chain(comp, limiter, Tone.getDestination());
    // send 이펙트: 절차 IR 리버브 + 피드백 딜레이(보이스마다 새로 만들지 않고 1회 — 모바일 핵심)
    var reverb = new Tone.Reverb({ decay: (m.reverb && m.reverb.decay) || 2.2, wet: 1 });
    var revSend = new Tone.Gain((m.reverb && m.reverb.send) == null ? 0.18 : m.reverb.send);
    reverb.connect(master); revSend.connect(reverb);
    var delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.32, wet: 1 });
    var delSend = new Tone.Gain((m.delay && m.delay.send) == null ? 0.12 : m.delay.send);
    delay.connect(master); delSend.connect(delay);
    this._nodes = { master: master, comp: comp, limiter: limiter, reverb: reverb, revSend: revSend, delay: delay, delSend: delSend };
  };

  // ── 악기 프리셋 팩토리 (장르 음색 → Tone 인스트루먼트) ──────────────────────
  // TIMBRE-*/SYNTH-* 레퍼런스의 코드화. 새 프리셋은 여기 한 곳에 추가.
  SoundForge.prototype._makeInstrument = function (preset) {
    var P = preset || 'square-lead';
    switch (P) {
      case 'square-lead':   // 칩튠/아케이드 리드
        return new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.25, release: 0.2 } });
      case 'pulse-lead':    // 듀티 사이클 펄스(NES 느낌)
        return new Tone.Synth({ oscillator: { type: 'pulse', width: 0.25 }, envelope: { attack: 0.004, decay: 0.08, sustain: 0.2, release: 0.18 } });
      case 'triangle-bass': // 칩튠 베이스
        return new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.006, decay: 0.18, sustain: 0.5, release: 0.25 } });
      case 'saw-bass':
        return new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, filter: { type: 'lowpass', Q: 2 }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3, baseFrequency: 120, octaves: 2.5 }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 } });
      case 'supersaw':      // 신스웨이브 리드(슈퍼소우 = fat 오실레이터 detune)
        return new Tone.MonoSynth({ oscillator: { type: 'fatsawtooth', count: 5, spread: 28 }, filter: { type: 'lowpass', Q: 4 }, filterEnvelope: { attack: 0.02, decay: 0.25, sustain: 0.45, release: 0.4, baseFrequency: 300, octaves: 3 }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.4 } });
      case 'fm-bell':       // FM 벨(신비/장엄)
        return new Tone.FMSynth({ harmonicity: 3, modulationIndex: 12, envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.8 }, modulation: { type: 'sine' }, modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 } });
      case 'fm-ep':         // FM 일렉트릭 피아노(따뜻/로파이)
        return new Tone.FMSynth({ harmonicity: 1, modulationIndex: 6, envelope: { attack: 0.005, decay: 0.4, sustain: 0.3, release: 0.6 }, modulation: { type: 'sine' }, modulationEnvelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.4 } });
      case 'pad':           // 패드(앰비언트/따뜻) — 폴리 + 긴 ADSR
        return new Tone.PolySynth(Tone.Synth, { maxPolyphony: 6, oscillator: { type: 'fatsine', count: 3, spread: 20 }, envelope: { attack: 0.8, decay: 0.6, sustain: 0.8, release: 2.5 }, volume: -4 });
      case 'pluck':         // 플럭 현(하프/기타 근사)
        return new Tone.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.9 });
      case 'organ':
        return new Tone.PolySynth(Tone.Synth, { maxPolyphony: 6, oscillator: { type: 'fatsquare', count: 2, spread: 10 }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.4 } });
      default:
        return new Tone.Synth();
    }
  };

  // ── 드럼 랙(kit 레이어용) ────────────────────────────────────────────────────
  SoundForge.prototype._makeDrums = function (out) {
    var kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 } });
    var snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } });
    var snareFilt = new Tone.Filter({ type: 'highpass', frequency: 1200 });
    var hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } });
    var hatFilt = new Tone.Filter({ type: 'highpass', frequency: 7000 });
    kick.connect(out);
    snare.connect(snareFilt); snareFilt.connect(out);
    hat.connect(hatFilt); hatFilt.connect(out);
    return { kick: kick, snare: snare, hat: hat, _snareFilt: snareFilt, _hatFilt: hatFilt };
  };

  // 레이어 인스트루먼트 + 인텐시티용 Volume 버스 구성(트랙별). 시작은 묵음 → _applyIntensity 가 활성 레이어를 올림.
  SoundForge.prototype._buildLayers = function (track) {
    var self = this;
    (track.layers || DEFAULT_TRACK.layers).forEach(function (L) {
      var vol = new Tone.Volume(-60);
      vol.connect(self._nodes.master);
      if (L.preset === 'pad' || L.preset === 'pluck' || L.preset === 'fm-bell') vol.connect(self._nodes.revSend);
      var inst;
      if (L.preset === 'kit' || L.preset === 'drums') inst = self._makeDrums(vol);
      else { inst = self._makeInstrument(L.preset); inst.connect(vol); }
      self._layers[L.id] = { def: L, vol: vol, inst: inst, on: false };
    });
  };

  // 레이어 정리(트랙 전환 시) — Tone 노드 dispose(드럼 서브신스·필터 포함).
  SoundForge.prototype._disposeLayers = function () {
    var self = this;
    Object.keys(this._layers).forEach(function (id) {
      var L = self._layers[id];
      try {
        if (L.inst && L.inst.dispose) L.inst.dispose();
        else if (L.inst) Object.keys(L.inst).forEach(function (k) { var n = L.inst[k]; if (n && n.dispose) n.dispose(); });
        if (L.vol && L.vol.dispose) L.vol.dispose();
      } catch (e) { /* noop */ }
    });
    this._layers = {};
  };

  // 수평 리시퀀싱 — 트랙 전환(레이어 로스터 재구성 + BPM 램프). 같은 트랙이면 무시.
  SoundForge.prototype._switchTrack = function (trackId, track) {
    this._curTrackId = trackId;
    this._track = track;
    if (!this._ok() || !this.ready) return;
    this._disposeLayers();
    this._buildLayers(track);
    this._applyIntensity(0.3);
    try { Tone.getTransport().bpm.rampTo(track.bpm || 110, 0.5); } catch (e) { /* noop */ }
  };

  // ── 그래프 빌드(첫 unlock 에서 1회) ──────────────────────────────────────────
  SoundForge.prototype._build = function () {
    if (this.ready || !this._ok()) return;
    this._buildBus();
    var bgm = this.spec.bgm || {};
    // 트랙 선택: defaultTrack 또는 첫 트랙, 없으면 내장 DEFAULT_TRACK
    var trackIds = Object.keys(bgm.tracks || {});
    var track;
    if (bgm.tracks && trackIds.length) {
      this._curTrackId = bgm.defaultTrack && bgm.tracks[bgm.defaultTrack] ? bgm.defaultTrack : trackIds[0];
      track = bgm.tracks[this._curTrackId];
    } else {
      this._curTrackId = 'default';
      track = DEFAULT_TRACK;
    }
    this._track = track;
    this._buildLayers(track);
    // SFX 공용 랙(폴리 + 노이즈 + 멤브레인 + 메탈) — BGM 과 분리해 노트스틸 충돌 회피
    this._sfxRack.poly = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 8 });
    this._sfxRack.poly.connect(this._nodes.master);
    this._sfxRack.poly.connect(this._nodes.delSend);
    this._sfxRack.fm = new Tone.PolySynth(Tone.FMSynth, { maxPolyphony: 4 });
    this._sfxRack.fm.connect(this._nodes.master);
    this._sfxRack.noise = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.2, sustain: 0 } });
    this._sfxRack.noiseFilt = new Tone.Filter({ type: 'bandpass', frequency: 1800, Q: 0.8 });
    this._sfxRack.noise.connect(this._sfxRack.noiseFilt); this._sfxRack.noiseFilt.connect(this._nodes.master);
    this._sfxRack.boom = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 8 });
    this._sfxRack.boom.connect(this._nodes.master); this._sfxRack.boom.connect(this._nodes.revSend);
    this._sfxRack.metal = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.25, release: 0.1 }, harmonicity: 4.1, resonance: 3500 });
    this._sfxRack.metal.connect(this._nodes.master);
    // 마스터 음소거 상태 반영
    Tone.getDestination().mute = this.muted;
    this.ready = true;
    this._applyIntensity(0); // 초기 레이어 게이트(즉시)
  };

  // ── 스케줄러(Transport) — 16분음표 스텝마다 활성 레이어 패턴 발음 ─────────────
  SoundForge.prototype._scheduleTransport = function () {
    if (this._repeatId != null) return;
    var self = this;
    var tr = Tone.getTransport();
    tr.bpm.value = this._track.bpm || 110;
    this._step = 0;
    this._repeatId = tr.scheduleRepeat(function (time) {
      self._onStep(self._step, time);
      self._step++;
    }, '16n');
    if (tr.state !== 'started') tr.start();
  };

  // 한 16분 스텝: 활성(인텐시티 게이트 통과) 레이어의 패턴이 자기 보이스를 예약.
  SoundForge.prototype._onStep = function (step, time) {
    if (this.muted) return;
    var track = this._track;
    var scaleIv = SCALES[track.scale] || SCALES['minor-pentatonic'];
    var rootSemi = rootSemitone(track.key);
    var prog = track.progression || ['i'];
    var barLen = 16;                       // 1마디 = 16스텝(4/4 16분)
    var bar = Math.floor(step / barLen) % prog.length;
    var inBar = step % barLen;
    var chord = chordMidis(prog[bar], scaleIv, rootSemi, 3); // 옥타브3 기준
    var self = this;
    Object.keys(this._layers).forEach(function (id) {
      var L = self._layers[id];
      if (!L.on) return;
      self._playPattern(L, inBar, chord, scaleIv, rootSemi, time);
    });
  };

  // 패턴 → 발음. 패턴은 데이터(layer.pattern) 기반. 새 패턴은 여기 추가.
  SoundForge.prototype._playPattern = function (L, inBar, chord, scaleIv, rootSemi, time) {
    var pat = L.def.pattern || 'chords';
    var inst = L.inst;
    var v = 0.8;
    switch (pat) {
      case 'chords': // 마디 머리에 코드 전체를 길게(패드)
        if (inBar === 0) {
          var freqs = chord.map(function (m) { return midiToFreq(m); });
          if (inst.triggerAttackRelease) inst.triggerAttackRelease(freqs, '1m', time, 0.6);
        }
        break;
      case 'root8': // 8분음표마다 루트 베이스
        if (inBar % 2 === 0) inst.triggerAttackRelease(midiToFreq(chord[0] - 12), '8n', time, 0.8);
        break;
      case 'pulse': // 4분음표마다 루트
        if (inBar % 4 === 0) inst.triggerAttackRelease(midiToFreq(chord[0] - 12), '4n', time, 0.7);
        break;
      case 'arp': { // 코드를 16분으로 아르페지오(절차 멜로디 — 오리지널)
        var note = chord[inBar % chord.length] + (inBar >= 8 ? 12 : 0);
        if (inBar % 2 === 0) inst.triggerAttackRelease(midiToFreq(note), '8n', time, 0.55);
        break;
      }
      case 'offbeat': // 오프비트 스탭(8분 뒷박)
        if (inBar % 4 === 2) {
          var fs = chord.map(function (m) { return midiToFreq(m); });
          inst.triggerAttackRelease(fs, '16n', time, 0.45);
        }
        break;
      case 'backbeat': // 드럼 킷: kick 0/8, snare 4/12, hat 매 8분
        if (inst.kick && (inBar === 0 || inBar === 8)) inst.kick.triggerAttackRelease('C1', '8n', time, 0.9);
        if (inst.snare && (inBar === 4 || inBar === 12)) inst.snare.triggerAttackRelease('16n', time, 0.7);
        if (inst.hat && inBar % 2 === 0) inst.hat.triggerAttackRelease('32n', time, inBar % 4 === 0 ? 0.5 : 0.3);
        break;
      case 'four-floor': // 4-on-the-floor(신스웨이브/EDM)
        if (inst.kick && inBar % 4 === 0) inst.kick.triggerAttackRelease('C1', '8n', time, 0.95);
        if (inst.hat && inBar % 2 === 1) inst.hat.triggerAttackRelease('32n', time, 0.35);
        if (inst.snare && (inBar === 4 || inBar === 12)) inst.snare.triggerAttackRelease('16n', time, 0.65);
        break;
      default:
        if (inBar === 0 && inst.triggerAttackRelease) inst.triggerAttackRelease(midiToFreq(chord[0]), '4n', time, 0.5);
    }
  };

  // ── 인텐시티 → 수직 레이어 크로스페이드(ADAPT-*) ─────────────────────────────
  SoundForge.prototype._applyIntensity = function (ramp) {
    if (!this.ready) return;
    var self = this;
    var t = ramp == null ? 0.5 : ramp;
    Object.keys(this._layers).forEach(function (id) {
      var L = self._layers[id];
      var active = self.intensity >= (L.def.minIntensity || 0);
      L.on = active;
      var target = active ? (L.def.vol == null ? -12 : L.def.vol) : -60;
      try { L.vol.volume.rampTo(target, t); } catch (e) { L.vol.volume.value = target; }
    });
  };

  // ============================================================================
  // 공개 API — ChipAudio 드롭인 호환 + 확장
  // ============================================================================

  // 첫 사용자 제스처에서 호출 → Tone.start()(컨텍스트 resume) + 그래프 빌드
  SoundForge.prototype.unlock = function () {
    if (!this._ok()) return;
    try { Tone.start(); } catch (e) { /* noop */ }
    this._build();
  };

  // 백그라운드 복귀 — 컨텍스트 resume + BGM 의도 보존 시 재가동
  SoundForge.prototype.resume = function () {
    if (!this._ok()) return;
    try {
      var ctx = Tone.getContext().rawContext;
      if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
    } catch (e) { /* noop */ }
    if (this._bgmWanted && !this._bgmOn) this.startBgm(this._curTrackId);
  };

  // 화면 가림(백그라운드/잠금) — Transport 정지 + 컨텍스트 suspend. _bgmWanted 는 유지.
  SoundForge.prototype.suspend = function () {
    if (!this._ok()) return;
    try {
      var tr = Tone.getTransport();
      tr.pause();
      if (this._repeatId != null) { tr.clear(this._repeatId); this._repeatId = null; }
    } catch (e) { /* noop */ }
    this._bgmOn = false; // _bgmWanted 유지 → resume 자동 재가동
    try {
      var ctx = Tone.getContext().rawContext;
      if (ctx && ctx.state === 'running' && ctx.suspend) ctx.suspend();
    } catch (e) { /* noop */ }
  };

  SoundForge.prototype.toggleMute = function () {
    this.muted = !this.muted;
    if (this._ok()) { try { Tone.getDestination().mute = this.muted; } catch (e) { /* noop */ } }
    return this.muted;
  };

  SoundForge.prototype.setVolume = function (db) {
    if (this._ok() && this._nodes.master) this._nodes.master.volume.value = db;
  };

  // BGM 시작(적응형). trackId 생략 시 현재/기본 트랙.
  SoundForge.prototype.startBgm = function (trackId) {
    this._bgmWanted = true;
    if (!this._ok()) return;
    if (!this.ready) this._build();
    if (trackId && this.spec.bgm && this.spec.bgm.tracks && this.spec.bgm.tracks[trackId] && trackId !== this._curTrackId) {
      this._switchTrack(trackId, this.spec.bgm.tracks[trackId]);
    }
    if (this._bgmOn) return;
    this._bgmOn = true;
    this._applyIntensity(0.01);
    this._scheduleTransport();
  };

  SoundForge.prototype.stopBgm = function () {
    this._bgmWanted = false;
    this._bgmOn = false;
    if (!this._ok()) return;
    try {
      var tr = Tone.getTransport();
      if (this._repeatId != null) { tr.clear(this._repeatId); this._repeatId = null; }
      tr.stop();
    } catch (e) { /* noop */ }
  };

  // 게임 인텐시티(0..1) 갱신 → 수직 레이어 크로스페이드(전투 격화 등)
  SoundForge.prototype.setIntensity = function (v, ramp) {
    this.intensity = Math.max(0, Math.min(1, v));
    this._applyIntensity(ramp);
  };

  // 수평 리시퀀싱 — 섹션(트랙) 전환(탐험→전투→보스). 마디 경계 크로스페이드.
  SoundForge.prototype.setSection = function (name) {
    this.section = name;
    if (!this._ok() || !this.spec.bgm || !this.spec.bgm.sections) return;
    var trackId = this.spec.bgm.sections[name];
    if (trackId && this.spec.bgm.tracks && this.spec.bgm.tracks[trackId] && trackId !== this._curTrackId) {
      this._switchTrack(trackId, this.spec.bgm.tracks[trackId]);
    }
  };

  // ── SFX (데이터주도 + 내장 프리셋) ───────────────────────────────────────────
  // 내장 키는 ChipAudio 와 호환(jump/coin/stomp/...) + 확장. audio.json sfx 가 있으면 우선.
  SoundForge.prototype.sfx = function (name) {
    if (!this._ok() || this.muted) return;
    if (!this.ready) this._build();
    var specSfx = this.spec.sfx && this.spec.sfx[name];
    if (specSfx) { this._playSpecSfx(specSfx); return; }
    this._playBuiltinSfx(name);
  };

  // 인라인 스펙 SFX 재생(레이어 배열). 각 레이어 = {kind, ...}
  SoundForge.prototype._playSpecSfx = function (s) {
    var self = this;
    var t = Tone.now();
    var layers = s.layers || [s];
    layers.forEach(function (L) { self._playSfxLayer(L, t + (L.delay || 0)); });
  };

  // 한 SFX 레이어 → 랙으로 발음. kind: tone|fm|noise|boom|metal
  SoundForge.prototype._playSfxLayer = function (L, t) {
    var R = this._sfxRack;
    var dur = L.dur || 0.12;
    var vel = L.vol == null ? 0.6 : L.vol;
    try {
      switch (L.kind) {
        case 'fm':
          if (L.harmonicity != null) R.fm.set({ harmonicity: L.harmonicity, modulationIndex: L.modIndex || 8 });
          R.fm.triggerAttackRelease(L.freq || 440, dur, t, vel);
          break;
        case 'noise':
          if (L.filter) R.noiseFilt.frequency.setValueAtTime(L.filter, t);
          R.noise.triggerAttackRelease(dur, t, vel);
          break;
        case 'boom':
          R.boom.triggerAttackRelease(L.freq || 'C2', dur, t, vel);
          break;
        case 'metal':
          R.metal.triggerAttackRelease(L.freq || 200, dur, t, vel);
          break;
        case 'tone':
        default:
          R.poly.set({ oscillator: { type: L.wave || 'square' } });
          // 피치 슬라이드는 두 음 빠른 연속으로 근사(슬라이드 표현)
          R.poly.triggerAttackRelease(L.freq || 440, dur, t, vel);
          if (L.to) R.poly.triggerAttackRelease(L.to, dur, t + dur * 0.5, vel * 0.7);
      }
    } catch (e) { /* noop */ }
  };

  // 내장 SFX — ChipAudio 호환 키 + 8비트 너머 레이어드 버전
  SoundForge.prototype._playBuiltinSfx = function (name) {
    var R = this._sfxRack, t = Tone.now();
    function pol(wave, freq, dur, vel, when) { try { R.poly.set({ oscillator: { type: wave } }); R.poly.triggerAttackRelease(freq, dur, (when || t), vel); } catch (e) {} }
    function arp(wave, freqs, step, dur, vel) { freqs.forEach(function (f, i) { pol(wave, f, dur, vel, t + i * step); }); }
    switch (name) {
      case 'jump':    pol('square', 300, 0.16, 0.5); pol('square', 720, 0.12, 0.4, t + 0.05); break;
      case 'coin':    pol('square', 988, 0.06, 0.5); pol('square', 1319, 0.13, 0.5, t + 0.06); break;
      case 'stomp':   try { R.boom.triggerAttackRelease('A1', 0.16, t, 0.8); } catch (e) {} pol('triangle', 220, 0.1, 0.3); break;
      case 'bump':    pol('square', 160, 0.09, 0.5); break;
      case 'brick':   try { R.noiseFilt.frequency.setValueAtTime(2400, t); R.noise.triggerAttackRelease(0.1, t, 0.5); } catch (e) {} pol('sawtooth', 200, 0.1, 0.35); break;
      case 'hit':     try { R.noiseFilt.frequency.setValueAtTime(1200, t); R.noise.triggerAttackRelease(0.12, t, 0.6); } catch (e) {} pol('square', 180, 0.12, 0.4); break;
      case 'powerup': arp('square', [523, 659, 784, 1047, 1319], 0.07, 0.1, 0.45); break;
      case 'sprout':  pol('triangle', 400, 0.4, 0.4); pol('triangle', 900, 0.3, 0.3, t + 0.1); break;
      case 'die':     arp('triangle', [392, 330, 262, 175], 0.13, 0.2, 0.5); break;
      case 'flag':    arp('square', [523, 587, 659, 784, 1047, 1319], 0.1, 0.12, 0.45); break;
      case '1up':     arp('square', [659, 784, 988, 1319], 0.07, 0.1, 0.45); break;
      case 'laser':   pol('sawtooth', 1200, 0.18, 0.4); pol('sawtooth', 300, 0.18, 0.3, t + 0.02); break;
      case 'explosion': // 3겹 레이어드(트랜지언트+바디+테일)
        try { R.noiseFilt.frequency.setValueAtTime(6000, t); R.noise.triggerAttackRelease(0.05, t, 0.7); } catch (e) {}
        try { R.boom.triggerAttackRelease('C2', 0.4, t + 0.01, 0.9); } catch (e) {}
        try { R.noiseFilt.frequency.setValueAtTime(800, t + 0.04); R.noise.triggerAttackRelease(0.3, t + 0.04, 0.5); } catch (e) {}
        break;
      case 'select':  pol('square', 660, 0.05, 0.4); break;
      case 'confirm': pol('square', 660, 0.06, 0.4); pol('square', 990, 0.08, 0.4, t + 0.06); break;
      default: break;
    }
  };

  global.SoundForge = SoundForge;
  if (typeof module !== 'undefined' && module.exports) module.exports = SoundForge;
})(typeof window !== 'undefined' ? window : this);
