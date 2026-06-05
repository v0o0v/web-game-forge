/* ============================================================================
 * ChipAudio — 절차적 8비트 사운드 (web-game-builder 엔진)
 * ----------------------------------------------------------------------------
 * - Web Audio API 만으로 효과음 + BGM 을 코드로 합성한다. 오디오 파일 0개.
 * - 따라서 100% CC0 / IP-safe. BGM 멜로디는 오리지널(어떤 곡도 인용하지 않음).
 * - 모바일 웹뷰 오디오 언락 대응: unlock() 을 첫 사용자 제스처(touchend/click)에서 호출.
 * ==========================================================================*/
(function (global) {
  'use strict';

  function ChipAudio() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._bgmTimer = null;
    this._bgmStep = 0;
    this._bgmOn = false;
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
    this._bgmOn = false;
    if (this._bgmTimer) { clearInterval(this._bgmTimer); this._bgmTimer = null; }
  };

  global.ChipAudio = ChipAudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = ChipAudio;
})(typeof window !== 'undefined' ? window : this);
