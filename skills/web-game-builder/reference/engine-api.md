# 엔진 API 레퍼런스

`engine/` 의 3개 라이브러리 API. 게임 `game.js` 는 이들 + vendored Phaser 3 만 쓴다.
로드 순서: `phaser.min.js` → `pixelforge.js` → `audio.js` → `mobile.js` → `game.js`.

---

## PixelForge — 절차적 픽셀아트 스프라이트 (`engine/pixelforge.js`)

문자 그리드를 Phaser CanvasTexture(가로 스트립)로 굽는다. 외부 이미지 0. CC0/IP-safe.

### `PixelForge.bake(scene, key, def)`
- `def.frames`: `["row","row",...]` 형태 프레임 배열. **행 길이를 맞출 필요 없음**(가장 긴 행
  기준으로 오른쪽이 투명으로 자동 패딩).
- `def.palette`(선택): `{ 문자: '#hex' }`. 생략 시 공유 팔레트 `PixelForge.PALETTE` 사용.
  `'.'` 와 `' '` 는 항상 투명.
- 반환: `{ key, frameWidth, frameHeight, frameCount }`.
- 같은 key 가 있으면 교체한다.

```js
PixelForge.bake(this, 'star', {
  palette: { '.': null, 'y': '#ffe23f', 'w': '#fff7c0' },
  frames: [
    [ "..y..", ".ywy.", "ywwwy", ".ywy.", "..y.." ],   // frame 0
    [ "..y..", "..y..", "yywyy", "..y..", "..y.." ]    // frame 1
  ]
});
this.add.sprite(x, y, 'star', 0);
```

### `PixelForge.buildAll(scene)`
내장 라이브러리 전체(hero, enemy, coin, ground, dirt, brick, qblock, pipeTop, pipeBody,
mushroom, flag, pole, cloud, hill, bush)를 등록하고 기본 애니메이션
(`hero-idle/run/jump`, `enemy-walk`, `coin-spin`, `qblock-pulse`)을 만든다.
반환: `{ key: {frameWidth,frameHeight,frameCount}, ... }` 매니페스트.

### `PixelForge.LIB`, `PixelForge.PALETTE`
내장 스프라이트 정의 / 공유 팔레트. 새 게임은 여기에 항목을 추가하거나 `bake` 로 별도 정의.

### 애니메이션 직접 정의
```js
scene.anims.create({
  key: 'star-spin',
  frames: [{ key: 'star', frame: 0 }, { key: 'star', frame: 1 }],
  frameRate: 8, repeat: -1
});
```

> 팁: 게임 config 에 `pixelArt: true, roundPixels: true` 를 켜면 확대 시 또렷한 픽셀.

---

## ChipAudio — 절차적 8비트 사운드 (`engine/audio.js`)

Web Audio 만으로 효과음 + BGM 합성. 오디오 파일 0. CC0/IP-safe. **BGM 은 오리지널 멜로디만.**

```js
var audio = new ChipAudio();
window.GAME_AUDIO = audio;        // mobile.js 음소거 버튼이 참조

// 첫 사용자 제스처(touchend/click/Tap to start)에서:
audio.unlock();                   // suspended 컨텍스트 resume + iOS 무음버퍼 언락
audio.startBgm();                 // 루프 BGM 시작

audio.sfx('jump');                // 효과음
audio.stopBgm();
audio.resume();                   // 백그라운드 복귀 시(visibilitychange) 재개
audio.toggleMute();               // 반환: 현재 muted 여부
```

내장 SFX 키: `jump, coin, stomp, bump, brick, powerup, sprout, die, flag, 1up`.
커스텀 톤: `audio.tone({ freq, dur, type:'square'|'triangle'|'sawtooth'|'sine', vol, to(슬라이드 목표 주파수), delay })`.

---

## MobileHarness — 모바일 웹뷰 대응 (`engine/mobile.js`)

### `MobileHarness.scaleConfig(width, height)`
Phaser `config.scale` 에 펼쳐 넣을 객체 반환(`Scale.FIT` + `CENTER_BOTH` + min/max).
```js
scale: Object.assign({ parent: 'game' }, MobileHarness.scaleConfig(384, 224))
```

### `MobileHarness.installDomGuards()`
iOS WKWebView 가 `user-scalable=no` 를 무시하는 것 대비: `gesturestart`/멀티터치/더블탭 줌/
러버밴드 스크롤(`touchmove`)을 `preventDefault`. Boot 에서 1회 호출.

### `MobileHarness.onResume(fn)`
`visibilitychange` 로 페이지 복귀 시 `fn` 호출(보통 `GAME_AUDIO.resume`).

### `MobileHarness.isTouch()`
터치 디바이스 여부(`ontouchstart` / `maxTouchPoints` / `?touch=1`). 데스크톱에선 컨트롤 숨김.

### `MobileHarness.TouchControlsClass(designW, designH, inputState)`
멀티터치 가상 D-패드(◀▶) + 점프(A) 버튼을 그리는 **별도 Scene 클래스**를 반환한다.
매 프레임 활성 포인터 위치로 버튼 상태를 재계산해 `inputState.{left,right,up}` 에 기록한다
(슬라이드/멀티터치에 견고). 항상 최상단 Scene 으로 launch.

```js
// Boot 에서:
var TC = MobileHarness.TouchControlsClass(DESIGN_W, DESIGN_H, GAME_INPUT);
this.scene.add('TouchControls', TC, false);
// 게임 시작 시:
this.scene.launch('TouchControls');
```

> `inputState`(예: `GAME_INPUT = {left,right,up}`)는 터치 전용. 키보드는 게임 씬에서
> `cursors`/`keys` 로 직접 읽어 OR 합친다. (TouchControls 가 매 프레임 inputState 를
> 포인터 기준으로 덮어쓰므로, 키보드 값을 inputState 에 넣지 말 것.)
