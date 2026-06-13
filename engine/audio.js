/* ============================================================================
 * ChipAudio — 절차적 8비트 사운드 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * - Web Audio API 만으로 효과음 + BGM 을 코드로 합성한다. 오디오 파일 0개.
 * - 따라서 100% CC0 / IP-safe. BGM 멜로디는 오리지널(어떤 곡도 인용하지 않음).
 * - 모바일 웹뷰 오디오 언락 대응: unlock() 을 첫 사용자 제스처(touchend/click)에서 호출.
 *
 * ── 파라미터-데이터 SFX (ZzFX식 콤팩트 배열) ─────────────────────────────────
 * 효과음을 코드 하드코딩 대신 **숫자 파라미터 배열 하나**로 정의·합성한다. 개념은
 * ZzFX(Frank Force, MIT/CC0)의 "데이터 주도 절차 합성"을 차용했고, 합성 코드는 본
 * 엔진의 오리지널 구현(샘플 단위 직접 합성)이다 → 결과물 CC0/오리지널, IP-safe.
 *
 *   var a = new ChipAudio(); a.unlock();
 *   a.playParams([ , , 320, , , .16, 1, 1.8 ]);  // 점프음(콤팩트 배열)
 *   a.zzfx('coin');                              // 데이터 테이블의 이름으로 재생
 *
 * 파라미터 순서(ZzFX 인덱스 배치와 호환. 생략/undefined 는 기본값):
 *   [0]  volume         음량(0..1, 기본 .5)
 *   [1]  randomness     주파수 무작위 흔들림(0..1, 기본 .05)
 *   [2]  frequency      기본 주파수 Hz(기본 220)
 *   [3]  attack         어택(초, 기본 0)
 *   [4]  sustain        서스테인(초, 기본 0)
 *   [5]  release        릴리스(초, 기본 .1)
 *   [6]  shape          파형 0:sine 1:triangle 2:saw 3:tan 4:noise(기본 0)
 *   [7]  shapeCurve     파형 곡률(기본 1)
 *   [8]  slide          주파수 슬라이드(기본 0) ★본 엔진 고유 스케일(ZzFX 원본과 값 범위 다름)
 *   [9]  deltaSlide     슬라이드 가속(기본 0)   ★본 엔진 고유 스케일
 *   [10] pitchJump      피치 점프 양 Hz(기본 0)
 *   [11] pitchJumpTime  피치 점프 시점(초, 기본 0)
 *   [12] repeatTime     반복 주기(초, 기본 0)
 *   [13] noise          파형에 섞을 노이즈량(기본 0)
 *   [14] modulation     FM 변조 깊이(기본 0)    ★본 엔진 고유 스케일
 *   [15] bitCrush       비트크러시 양자화 계단(기본 0)
 *   [16] delay          선행 무음 길이(초, 기본 0) — PCM 앞에 무음 샘플로 반영
 *   [17] sustainVolume  서스테인 구간 음량 배율(기본 1)
 *   [18] decay          디케이(초, 기본 0)
 *   [19] tremolo        트레몰로 깊이(0..1, 기본 0)
 *
 * ★ 인덱스 배치는 ZzFX 와 호환이나 slide/deltaSlide/modulation 의 값 스케일은
 *   본 엔진 고유다. ZzFX 원본 파라미터 값을 그대로 복사하면 의도와 다른 결과가 나올 수 있다.
 *
 * randomness 결정화: opts.seed(숫자/문자열) 를 주면 RngForge 로 결정론적 흔들림을
 * 적용한다(같은 seed → 항상 같은 파형). seed 미지정 시 Math.random 대신 *무흔들림*(0)
 * 으로 합성해 헤드리스에서도 결정적이게 한다 → Math.random 미사용(엔진 규칙 준수).
 * zzfx(name) 은 seed 미지정 시 SFX 이름에서 결정론적 기본 seed 를 자동 주입해 noise/
 * randomness 를 지닌 SFX(explosion 등)도 가청으로 재생한다.
 * ==========================================================================*/
(function (global) {
  'use strict';

  // RngForge 참조(있으면 randomness 결정화에 사용). Node/브라우저 양쪽 graceful.
  var RngForge = (global && global.RngForge) || null;
  if (!RngForge && typeof require !== 'undefined') {
    try { RngForge = require('./rngforge.js'); } catch (e) { /* 선택 의존 — 없으면 무흔들림 */ }
  }

  var SAMPLE_RATE = 44100; // 합성 샘플레이트(헤드리스 합성·AudioBuffer 공통 기준)

  function ChipAudio() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._bgmOn = false;
    this._bgmWanted = false; // startBgm 의도. 가시성 변화로 일시정지돼도 유지 → resume 시 자동 재가동
  }

  ChipAudio.prototype.init = function () {
    if (this.ctx) return;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
  };

  // 첫 제스처에서 호출 → suspended 컨텍스트 resume + iOS WebKit 무음버퍼 언락
  ChipAudio.prototype.unlock = function () {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    try {
      var b = this.ctx.createBuffer(1, 1, 22050);
      var s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.ctx.destination); s.start(0);
    } catch (e) { /* noop */ }
  };

  // 백그라운드 복귀 시 재-resume (웹뷰는 백그라운드에서 오디오를 정지시킴)
  ChipAudio.prototype.resume = function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this._bgmWanted && !this._bgmOn) this.startBgm(); // suspend 로 멈췄던 BGM 재가동
  };

  // 화면이 가려질 때(백그라운드 탭·홈 이동·화면 잠금 등) 모든 사운드를 멈춘다.
  // BGM 타이머를 정지하고 AudioContext 를 suspend → 탭/서버를 닫지 않아도 소리가 끊긴다.
  ChipAudio.prototype.suspend = function () {
    if (this._bgmTimer) { clearInterval(this._bgmTimer); this._bgmTimer = null; }
    this._bgmOn = false; // _bgmWanted 는 유지 → 복귀(resume) 시 자동 재가동
    if (this.ctx && this.ctx.state === 'running' && this.ctx.suspend) {
      try { this.ctx.suspend(); } catch (e) { /* noop */ }
    }
  };

  ChipAudio.prototype.toggleMute = function () {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  };

  // 단일 톤 (포락선 포함)
  ChipAudio.prototype.tone = function (opt) {
    if (!this.ctx || this.muted) return;
    var t0 = this.ctx.currentTime + (opt.delay || 0);
    var dur = opt.dur || 0.1;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = opt.type || 'square';
    o.frequency.setValueAtTime(opt.freq, t0);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t0 + dur);
    var vol = (opt.vol == null ? 0.5 : opt.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  };

  // 효과음 모음
  ChipAudio.prototype.sfx = function (name) {
    if (!this.ctx || this.muted) return;
    var i;
    switch (name) {
      case 'jump':    this.tone({ freq: 320, to: 760, dur: 0.16, vol: 0.35 }); break;
      case 'coin':    this.tone({ freq: 988, dur: 0.06, vol: 0.35 });
                      this.tone({ freq: 1319, dur: 0.13, vol: 0.35, delay: 0.06 }); break;
      case 'stomp':   this.tone({ freq: 220, to: 70, dur: 0.14, vol: 0.45 }); break;
      case 'bump':    this.tone({ freq: 170, to: 110, dur: 0.09, vol: 0.4 }); break;
      case 'brick':   this.tone({ freq: 240, to: 90, dur: 0.12, vol: 0.45, type: 'sawtooth' }); break;
      case 'powerup': [523, 659, 784, 1047, 1319].forEach(function (f, k) {
                        this.tone({ freq: f, dur: 0.1, vol: 0.35, delay: k * 0.07 }); }, this); break;
      case 'sprout':  this.tone({ freq: 400, to: 900, dur: 0.4, vol: 0.3, type: 'triangle' }); break;
      case 'die':     [392, 330, 262, 175].forEach(function (f, k) {
                        this.tone({ freq: f, dur: 0.2, vol: 0.4, type: 'triangle', delay: k * 0.13 }); }, this); break;
      case 'flag':    [523, 587, 659, 784, 1047, 1319].forEach(function (f, k) {
                        this.tone({ freq: f, dur: 0.12, vol: 0.35, delay: k * 0.1 }); }, this); break;
      case '1up':     [659, 784, 988, 1319].forEach(function (f, k) {
                        this.tone({ freq: f, dur: 0.1, vol: 0.35, delay: k * 0.07 }); }, this); break;
      default: break;
    }
  };

  // 파라미터-데이터 SFX 재생(Web Audio). params = 콤팩트 배열 또는 객체.
  // opts.seed: randomness 결정화. opts.vol: 추가 음량 배율. 컨텍스트/뮤트 가드는 tone() 과 동일.
  ChipAudio.prototype.playParams = function (params, opts) {
    if (!this.ctx || this.muted) return;
    opts = opts || {};
    var pcm = synthZzfx(params, { seed: opts.seed, sampleRate: this.ctx.sampleRate });
    if (!pcm.length) return;
    var buf = this.ctx.createBuffer(1, pcm.length, this.ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    var src = this.ctx.createBufferSource();
    src.buffer = buf;
    var t0 = this.ctx.currentTime + (opts.delay || 0);
    if (opts.vol != null && opts.vol !== 1) {
      var g = this.ctx.createGain();
      g.gain.value = opts.vol;
      src.connect(g); g.connect(this.master);
    } else {
      src.connect(this.master);
    }
    src.start(t0);
  };

  // 데이터 테이블의 이름으로 SFX 재생(ZzFX 합성 경로). 없는 이름이면 무시.
  // 기존 sfx() 와 독립 — 게임은 둘 중 원하는 경로를 선택한다(하위호환 유지).
  // seed 미지정 시 이름에서 결정론적 기본 seed 를 자동 주입 → noise/randomness SFX(explosion 등)
  // 도 항상 가청으로 재생된다. 명시된 opts.seed 가 있으면 그것을 우선한다.
  ChipAudio.prototype.zzfx = function (name, opts) {
    var p = ZZFX_SFX[name];
    if (!p) return;
    opts = opts || {};
    // seed 미지정이고 RngForge 사용 가능 → 이름에서 결정론적 기본 seed 주입.
    // explosion 등 noise/randomness SFX 가 항상 가청이 되게 한다.
    // 명시된 opts.seed 가 있으면 그것을 그대로 존중한다.
    if (opts.seed === undefined && RngForge) {
      opts = { seed: RngForge.hashSeed(name), vol: opts.vol, delay: opts.delay };
    }
    this.playParams(p, opts);
  };

  // ── 파라미터-데이터 SFX 합성 ────────────────────────────────────────────────
  // ZzFX식 콤팩트 파라미터 배열 → PCM 샘플(Float32Array). 브라우저 의존 0(순수 함수).
  // AudioContext 없이 Node 헤드리스에서도 동일 결과 → 결정론 검증 가능.
  //
  // params: 숫자 배열(위 헤더의 인덱스 순서) 또는 { ... } 객체(같은 키 이름).
  // opts.seed: randomness 결정화용 시드(숫자/문자열). 미지정 시 무흔들림(결정적).
  // opts.sampleRate: 합성 샘플레이트(기본 44100).
  function paramsToObject(p) {
    if (p && !Array.isArray(p) && typeof p === 'object') {
      return {
        volume: p.volume, randomness: p.randomness, frequency: p.frequency,
        attack: p.attack, sustain: p.sustain, release: p.release,
        shape: p.shape, shapeCurve: p.shapeCurve, slide: p.slide,
        deltaSlide: p.deltaSlide, pitchJump: p.pitchJump, pitchJumpTime: p.pitchJumpTime,
        repeatTime: p.repeatTime, noise: p.noise, modulation: p.modulation,
        bitCrush: p.bitCrush, delay: p.delay, sustainVolume: p.sustainVolume,
        decay: p.decay, tremolo: p.tremolo
      };
    }
    p = p || [];
    return {
      volume: p[0], randomness: p[1], frequency: p[2], attack: p[3], sustain: p[4],
      release: p[5], shape: p[6], shapeCurve: p[7], slide: p[8], deltaSlide: p[9],
      pitchJump: p[10], pitchJumpTime: p[11], repeatTime: p[12], noise: p[13],
      modulation: p[14], bitCrush: p[15], delay: p[16], sustainVolume: p[17],
      decay: p[18], tremolo: p[19]
    };
  }

  function num(v, dflt) { return (typeof v === 'number' && isFinite(v)) ? v : dflt; }

  // ── 합성 스케일 상수 (본 엔진 고유; ZzFX 원본과 값 범위가 다름) ─────────────
  // slide 값을 사이클/샘플² 로 변환하는 배율. 작은 정수(예: 8)가 가청 슬라이드를 만든다.
  var SLIDE_SCALE = 50;
  // deltaSlide 누적분을 주파수에 더하는 배율. 미세 가속/감속 표현.
  var DELTA_SLIDE_SCALE = 0.0001;
  // modulation 값을 FM 변조 깊이(사이클/샘플)로 변환하는 배율.
  var MOD_DEPTH_SCALE = 0.0002;
  // 트레몰로 LFO 주파수(Hz). 9Hz = 표준 비브라토 대역의 빠른 떨림.
  var TREMOLO_HZ = 9;

  // 순수 합성: 파라미터 → Float32Array PCM. 어디서도 Math.random 미사용.
  function synthZzfx(params, opts) {
    opts = opts || {};
    var sr = num(opts.sampleRate, SAMPLE_RATE);
    var P = paramsToObject(params);

    var volume      = num(P.volume, 0.5);
    var randomness  = num(P.randomness, 0.05);
    var frequency   = num(P.frequency, 220);
    var attack      = num(P.attack, 0);
    var sustain     = num(P.sustain, 0);
    var release     = num(P.release, 0.1);
    var shape       = num(P.shape, 0) | 0;
    var shapeCurve  = num(P.shapeCurve, 1);
    var slide       = num(P.slide, 0);
    var deltaSlide  = num(P.deltaSlide, 0);
    var pitchJump   = num(P.pitchJump, 0);
    var pitchJumpT  = num(P.pitchJumpTime, 0);
    var repeatTime  = num(P.repeatTime, 0);
    var noise       = num(P.noise, 0);
    var modulation  = num(P.modulation, 0);
    var bitCrush    = num(P.bitCrush, 0);
    var delay       = num(P.delay, 0);
    var sustainVol  = num(P.sustainVolume, 1);
    var decay       = num(P.decay, 0);
    var tremolo     = num(P.tremolo, 0);

    // randomness 흔들림: seed 있으면 결정론(RngForge), 없으면 0(무흔들림 — Math.random 금지).
    var hasSeed = opts.seed !== undefined && opts.seed !== null;
    var jitter = 0;
    if (randomness && hasSeed && RngForge) {
      var rng = RngForge.create(opts.seed);
      jitter = (rng() * 2 - 1) * randomness; // [-randomness, +randomness)
    }
    frequency *= 1 + jitter;
    // 노이즈/모듈레이션도 같은 스트림에서 결정론적으로 — 시드 있을 때만 활성, 없으면 0.
    var nrng = null;
    if (hasSeed && RngForge) nrng = RngForge.create(opts.seed).stream('noise');

    var two_pi = 2 * Math.PI;
    var startSlide = slide;
    var deltaSlideStep = deltaSlide / sr;
    var freq = frequency / sr;          // 사이클/샘플
    var slidePerSample = (startSlide * SLIDE_SCALE) / (sr * sr);
    // delay: 선행 무음 샘플 수. PCM 앞부분에 반영해 데이터 일관성 보장.
    var delayS = Math.round(delay * sr);
    // 각 구간 샘플 수를 먼저 정수로 산출 → 합으로 총길이(float 합 ceil 의 ±1 지터 회피).
    var attackS  = Math.round(attack * sr);
    var decayS   = Math.round(decay * sr);
    var sustainS = Math.round(sustain * sr);
    var releaseS = Math.round(release * sr);
    var soundSamples = Math.max(1, attackS + decayS + sustainS + releaseS);
    var totalSamples = delayS + soundSamples;
    var pitchJumpSample = pitchJumpT * sr;
    var repeatSamples = repeatTime ? Math.ceil(repeatTime * sr) : 0;
    var modPerSample = modulation ? (modulation / sr) : 0;

    var out = new Float32Array(totalSamples);
    var phase = 0, modPhase = 0, jumped = false, crushHold = 0, crushCount = 0;

    // delayS 샘플은 0(무음)으로 초기화된 채로 유지; soundSamples 구간만 합성한다.
    for (var i = 0; i < soundSamples; i++) {
      var ri = repeatSamples ? (i % repeatSamples) : i; // 반복 구간 인덱스

      // 주파수 슬라이드 진행
      slide += deltaSlideStep;
      var f = freq + slidePerSample * i + (slide - startSlide) * DELTA_SLIDE_SCALE;
      if (f < 0) f = 0;

      // 피치 점프(특정 시점 이후 주파수 가산)
      if (!jumped && pitchJump && i >= pitchJumpSample) { jumped = true; }
      var fEff = f + (jumped ? (pitchJump / sr) : 0);

      // FM 변조
      if (modPerSample) { modPhase += modPerSample; fEff += (modulation * MOD_DEPTH_SCALE / sr) * Math.sin(modPhase * two_pi); }

      phase += fEff;
      var t = phase % 1; // [0,1) 한 사이클 위상
      var w;
      switch (shape) {
        case 1: w = 1 - 4 * Math.abs(Math.round(t) - t); break;          // triangle
        case 2: w = 2 * t - 1; break;                                     // sawtooth
        case 3: w = Math.tan(Math.min(1.57, t * two_pi)) * 0.2; if (w > 1) w = 1; if (w < -1) w = -1; break; // tan-ish
        case 4: w = nrng ? (nrng() * 2 - 1) : 0; break;                  // noise(시드 없으면 무음=0)
        default: w = Math.sin(t * two_pi);                                // sine
      }
      // shapeCurve: 비대칭/하모닉 (부호 보존 거듭제곱)
      if (shapeCurve !== 1 && shape !== 4) w = (w < 0 ? -1 : 1) * Math.pow(Math.abs(w), shapeCurve);
      // 노이즈 믹스
      if (noise && nrng) w = w * (1 - noise) + (nrng() * 2 - 1) * noise;

      // ADSR 포락선(반복 구간 기준)
      var env;
      if (ri < attackS) env = attackS ? ri / attackS : 1;
      else if (ri < attackS + decayS) env = decayS ? 1 - (1 - sustainVol) * ((ri - attackS) / decayS) : sustainVol;
      else if (ri < attackS + decayS + sustainS) env = sustainVol;
      else { var rp = releaseS ? (ri - attackS - decayS - sustainS) / releaseS : 1; env = sustainVol * (1 - Math.min(1, Math.max(0, rp))); }

      // 트레몰로(진폭 LFO — TREMOLO_HZ 로 떨림 속도 결정)
      if (tremolo) env *= 1 - tremolo * 0.5 * (1 - Math.cos(two_pi * TREMOLO_HZ * i / sr));

      var s = w * env * volume;

      // 비트크러시(샘플·홀드 양자화)
      if (bitCrush > 0) {
        if (crushCount <= 0) { crushHold = s; crushCount = Math.max(1, bitCrush | 0); }
        crushCount--; s = crushHold;
      }

      if (s > 1) s = 1; else if (s < -1) s = -1;
      out[delayS + i] = s; // delay 오프셋 적용
    }
    return out;
  }

  // 내장 SFX 데이터 테이블 — 효과음을 *데이터*(ZzFX식 콤팩트 배열)로 정의.
  // 기존 sfx() 의 tone() 시퀀스와 의미상 대응하는 8비트 경량 사운드(오리지널, CC0).
  // 인덱스 순서는 위 헤더 참고. 생략 슬롯은 기본값.
  var ZZFX_SFX = {
    //          vol  rnd  freq  atk  sus   rel   shape curve slide
    jump:     [ 0.35, .04, 320,  0,   0,   .16,  1,    1,    8 ],
    coin:     [ 0.35, .02, 988,  0,   .02, .11,  0,    1,    0,  0, 331, .03 ],
    stomp:    [ 0.45, .05, 220,  0,   0,   .14,  2,    1,   -10 ],
    bump:     [ 0.4,  .05, 170,  0,   0,   .09,  1,    1,   -3 ],
    brick:    [ 0.45, .08, 240,  0,   0,   .12,  2,    1,   -6,  0, 0,  0,  0,  .3 ],
    powerup:  [ 0.35, .02, 523,  0,   .04, .12,  0,    1,    0,  0, 524, .05, .07 ],
    sprout:   [ 0.3,  .03, 400,  .02, .12, .28,  1,    1,    18 ],
    die:      [ 0.4,  .03, 392,  0,   .04, .2,   1,    1,   -8,  -2 ],
    flag:     [ 0.35, .02, 523,  0,   .04, .12,  0,    1,    14, 0,  524, .06, .1 ],
    '1up':    [ 0.35, .02, 659,  0,   .03, .1,   0,    1,    0,  0,  330, .04, .07 ],
    laser:    [ 0.4,  .04, 900,  0,   0,   .18,  2,    1,   -40 ],
    blip:     [ 0.3,  .01, 660,  0,   0,   .05,  1,    1 ],
    explosion:[ 0.5,  .3,  120,  0,   .05, .3,   4,    1,    0,  0,  0,  0,  0,  .9 ]
  };

  // --- BGM: 오리지널 경쾌한 루프 (장조 아르페지오 + 베이스) -----------------
  // 음이름→주파수 (간단 표). 0 = 쉼표.
  var NOTE = {
    0: 0,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
    C3: 130.81, E3: 164.81, G3: 196.00, A3: 220.00, F3: 174.61, D3: 146.83
  };
  // 16스텝 × 4마디 = 원곡 루프 (마리오 테마 아님)
  var LEAD = [
    'C5','E5','G5','E5', 'A4','C5','E5','C5', 'F4','A4','C5','A4', 'G4','B4','D5','G4',
    'C5','E5','G5','E5', 'A4','C5','E5','C5', 'D5','F5','A5','F5', 'G4','C5','E5','G5'
  ];
  var BASS = [
    'C3',0,'G3',0, 'A3',0,'E3',0, 'F3',0,'C3',0, 'G3',0,'D3',0,
    'C3',0,'G3',0, 'A3',0,'E3',0, 'D3',0,'A3',0, 'G3',0,'G3',0
  ];

  ChipAudio.prototype.startBgm = function () {
    this._bgmWanted = true;
    if (!this.ctx || this._bgmOn) return;
    this._bgmOn = true;
    this._bgmStep = 0;
    var self = this;
    var stepDur = 0.16; // 초/스텝
    this._bgmTimer = setInterval(function () {
      if (self.muted) return;
      var s = self._bgmStep % LEAD.length;
      var lead = NOTE[LEAD[s]];
      var bass = NOTE[BASS[s]];
      if (lead) self.tone({ freq: lead, dur: stepDur * 0.9, vol: 0.16, type: 'square' });
      if (bass) self.tone({ freq: bass, dur: stepDur * 1.4, vol: 0.14, type: 'triangle' });
      self._bgmStep++;
    }, stepDur * 1000);
  };

  ChipAudio.prototype.stopBgm = function () {
    this._bgmWanted = false;
    this._bgmOn = false;
    if (this._bgmTimer) { clearInterval(this._bgmTimer); this._bgmTimer = null; }
  };

  // 순수 합성 코어 + 데이터 테이블을 static 으로 노출(헤드리스 검증·커스텀 SFX 정의용).
  ChipAudio.synth = synthZzfx;   // (params, opts) → Float32Array PCM (AudioContext 불필요)
  ChipAudio.SFX = ZZFX_SFX;      // 내장 데이터 테이블(읽기/확장)
  ChipAudio.SAMPLE_RATE = SAMPLE_RATE;

  global.ChipAudio = ChipAudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = ChipAudio;
})(typeof window !== 'undefined' ? window : this);
