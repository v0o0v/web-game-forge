---
name: chip-sound
description: "ChipAudio로 8비트 효과음과 BGM을 코드 합성(CC0, 오리지널)합니다. 게임 사운드/효과음/배경음악 추가·수정 요청 시 사용. sound, SFX, BGM, music, audio, 점프음, 효과음."
allowed-tools: Read, Write, Edit
---

# chip-sound — ChipAudio 효과음·BGM 코드 합성

Web Audio만으로 8비트 효과음과 BGM을 합성한다. 오디오 파일 없이 CC0/오리지널 사운드만 생성한다. web-game-builder의 전문 스킬. `engine/audio.js`를 사용한다.

## 언제 사용
- 점프·코인·타격 등 효과음을 추가하거나 커스텀 톤으로 새 SFX를 만들 때
- 오리지널 BGM 루프를 새로 제작하거나 기존 멜로디를 수정할 때
- 모바일 웹뷰에서 오디오가 재생되지 않는 문제를 해결할 때

## 핵심 레시피

### 1) 인스턴스 생성 · 전역 등록 (game.js 최상단)
```js
var GAME_AUDIO = new ChipAudio();
window.GAME_AUDIO = GAME_AUDIO;  // mobile.js 음소거 버튼이 이 전역 참조
```

### 2) 첫 제스처에서 unlock (모바일 필수)
iOS/Android 웹뷰는 사용자 제스처 없이 AudioContext를 재생할 수 없다.
Title 씬의 'Tap to start' 핸들러에서 반드시 호출한다.
```js
// TitleScene — 첫 pointerdown / keydown 콜백
GAME_AUDIO.unlock();      // suspended 컨텍스트 resume + iOS 무음버퍼 언락
GAME_AUDIO.startBgm();    // 언락 직후 BGM 시작
```

### 3) 내장 SFX 사용
```js
// 내장 키: jump, coin, stomp, bump, brick, powerup, sprout, die, flag, 1up
GAME_AUDIO.sfx('jump');
GAME_AUDIO.sfx('coin');
GAME_AUDIO.sfx('stomp');
```

### 4) 커스텀 톤으로 새 효과음 합성
`tone()`으로 주파수 슬라이드·포락선을 조합해 독특한 SFX를 만든다.
```js
// 레이저 발사음: 고음 → 저음 슬라이드
GAME_AUDIO.tone({ freq: 880, to: 220, dur: 0.18, type: 'square', vol: 0.25 });

// 폭발음: 낮은 노이즈 느낌 (sawtooth 저음)
GAME_AUDIO.tone({ freq: 80, dur: 0.3, type: 'sawtooth', vol: 0.35 });

// 아이템 획득: 상승 글리산도
GAME_AUDIO.tone({ freq: 440, to: 880, dur: 0.12, type: 'triangle', vol: 0.3 });
// delay로 화음처럼 겹치기
GAME_AUDIO.tone({ freq: 550, to: 1100, dur: 0.12, type: 'triangle', vol: 0.2, delay: 0.05 });
```

### 5) 오리지널 BGM — 스텝 시퀀서 패턴
ChipAudio 내부 BGM은 음표 배열(주파수 + 박자)로 구성된 스텝 시퀀서다.
`audio.js` 내 `BGM_MELODY` 배열을 교체해 오리지널 멜로디를 만든다.
```js
// audio.js 내 BGM_MELODY 수정 예시 (Hz, 박자(초))
// 완전히 오리지널 멜로디만 — 기존 게임 음악 절대 인용 금지
var BGM_MELODY = [
  [330, 0.12], [392, 0.12], [440, 0.12], [494, 0.25],
  [440, 0.12], [392, 0.12], [330, 0.25], [0, 0.12],
  [294, 0.12], [330, 0.12], [370, 0.12], [392, 0.25],
  [330, 0.12], [294, 0.12], [262, 0.5],  [0, 0.12],
];
```

## 짧은 스니펫 — 커스텀 파워업 SFX 시퀀스

```js
// 3음 상승 아르페지오 파워업 효과음
function sfxPowerupCustom() {
  var notes = [330, 440, 554];
  notes.forEach(function (freq, i) {
    GAME_AUDIO.tone({
      freq: freq,
      to: freq * 1.05,
      dur: 0.1,
      type: 'triangle',
      vol: 0.28,
      delay: i * 0.08
    });
  });
}

// 적 처치 - 짧은 드롭 톤
function sfxDefeat() {
  GAME_AUDIO.tone({ freq: 440, to: 110, dur: 0.25, type: 'square', vol: 0.3 });
}

// 게임오버 - 느린 하강 멜로디
function sfxGameOver() {
  [[494, 0], [440, 0.18], [370, 0.36], [294, 0.54]].forEach(function (n) {
    GAME_AUDIO.tone({ freq: n[0], dur: 0.3, type: 'square', vol: 0.25, delay: n[1] });
  });
}
```

## 연계 / 원칙
- web-game-builder 워크플로의 일부. 엔진 API는 `reference/engine-api.md`. IP-safe(CC0/절차적).
- **BGM은 반드시 오리지널**. 닌텐도·세가 등 기존 게임 음악의 멜로디·화음 진행 인용 금지.
- 백그라운드 복귀 시 `GAME_AUDIO.resume()` 호출: `MobileHarness.onResume(function() { GAME_AUDIO.resume(); })`.
- 음소거 버튼은 `window.GAME_AUDIO.toggleMute()`로 토글.
