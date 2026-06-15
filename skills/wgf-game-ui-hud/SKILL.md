---
name: wgf-game-ui-hud
description: "게임 HUD/메뉴/UI 화면을 구성합니다 — 점수·목숨·타임 HUD, 타이틀·일시정지·게임오버 화면, 버튼. HUD/UI/메뉴/점수판/화면 구성 요청 시 사용. HUD, UI, menu, score, title screen."
allowed-tools: Read, Write, Edit
---

# game-ui-hud — HUD·메뉴·UI 화면 구성

별도 UI Scene으로 HUD를 분리하고 retro 스타일 Text·스프라이트 아이콘으로 점수판을 만든다. web-game-builder의 전문 스킬. `engine/`를 사용한다.

## 언제 사용
- 점수·목숨·타이머 HUD를 추가하거나 레이아웃을 변경할 때
- 타이틀·일시정지·게임오버·클리어 화면을 구성할 때
- 모바일 안전영역(노치·홈바)을 고려한 UI 배치가 필요할 때

## 핵심 레시피

### 1) 별도 UI Scene (스크롤 X, 항상 최상단)
HUD는 Game 씬과 분리된 별도 Scene으로 관리한다. 카메라 스크롤에 영향받지 않는다.
```js
// game.js 씬 목록
scene: [BootScene, TitleScene, GameScene, UIScene]

// 게임 시작 시 함께 launch
this.scene.start('Game');
this.scene.launch('UI');       // Game 위에 올림
this.scene.launch('TouchControls');  // UI 위에 올림
```

### 2) retro Text 스타일
```js
var ST = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 4
};
var scoreTxt = this.add.text(96, 8, 'SCORE 000000', ST);
```

### 3) HUD 요소 배치 + 값 변경 시만 갱신 (성능)
```js
// UIScene.create()
create: function () {
  var ST = { fontFamily: 'monospace', fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 4 };

  // 코인 아이콘 (스프라이트) + 텍스트
  this.coinIcon = this.add.sprite(14, 14, 'coin').setScale(1.2);
  this.coinIcon.play('coin-spin');
  this.coinTxt = this.add.text(24, 8, 'x00', ST);

  // 점수
  this.scoreTxt = this.add.text(96, 8, 'SCORE 000000', ST);

  // 스테이지 + 타임 (우측 정렬)
  this.worldTxt = this.add.text(DESIGN_W - 8, 8,  'WORLD 1-1', ST).setOrigin(1, 0);
  this.timeTxt  = this.add.text(DESIGN_W - 8, 24, 'TIME  300', ST).setOrigin(1, 0);

  // 목숨 아이콘 + 텍스트
  this.livesIcon = this.add.sprite(10, 30, 'hero', 0).setOrigin(0, 0.5);
  this.livesTxt  = this.add.text(22, 24, 'x3', ST);

  // 배너 (처음엔 숨김)
  this.banner = this.add.text(DESIGN_W / 2, DESIGN_H / 2, '', {
    fontFamily: 'Arial Black, monospace', fontSize: '28px',
    color: '#ffd23f', stroke: '#7d3a17', strokeThickness: 6
  }).setOrigin(0.5).setAlpha(0);
},

// UIScene.update() — Game 씬 state를 폴링, 변화 감지 후 갱신
update: function () {
  var g = this.scene.get('Game');
  if (!g || !g.state) return;
  var s = g.state;
  this.coinTxt.setText('x' + String(s.coins).padStart(2, '0'));
  this.scoreTxt.setText('SCORE ' + String(s.score).padStart(6, '0'));
  this.timeTxt.setText('TIME ' + s.time);
  this.livesTxt.setText('x' + s.lives);
}
```

### 3-b) EventBus 기반 씬↔HUD 디커플 (권장 — 폴링 대안)

위 3)의 update() 폴링은 매 프레임 Game 씬 state 를 읽어 비교한다(`this.scene.get('Game')` 강결합). 값이 *바뀔 때만* 갱신하고 싶고 씬↔HUD 를 완전히 분리하려면 `engine/eventbus.js` 의 EventBus 로 발행-구독한다. 씬은 HUD 를 모른 채 사실만 `emit` 하고, HUD 는 `on` 으로 구독한다. **등록순 동기 디스패치 + 시각함수·무작위 0** 이라 game-qa 헤드리스 검증에서 이벤트 흐름이 그대로 재현된다.

```html
<!-- index.html — phaser 다음에 1줄 추가(외부 파일 0, 부담 거의 없음) -->
<script src="engine/eventbus.js"></script>
```

```js
// game.js — 버스를 registry 에 한 번 올려 모든 씬이 공유
var BootScene = {
  create: function () {
    this.registry.set('bus', new EventBus());   // 씬·HUD 가 같은 버스를 본다
    this.scene.start('Game'); this.scene.launch('UI');
  }
};

// GameScene — HUD 의 존재를 모르고 사실만 발행(직접 참조 0)
create: function () {
  this.bus = this.registry.get('bus');
  this.state = { score: 0, coins: 0, lives: 3, time: 300 };
},
addScore: function (d) { this.state.score += d; this.bus.emit('score', this.state.score); },
loseLife: function () {
  this.state.lives--; this.bus.emit('lives', this.state.lives);
  if (this.state.lives <= 0) this.bus.emit('gameover');
}

// UIScene — 씬을 폴링하지 않고 버스를 구독(값 변화 시에만 갱신)
create: function () {
  var ST = { fontFamily:'monospace', fontSize:'12px', color:'#fff', stroke:'#000', strokeThickness:4 };
  this.scoreTxt = this.add.text(96, 8, 'SCORE 000000', ST);
  this.livesTxt = this.add.text(22, 24, 'x3', ST);

  var bus = this.registry.get('bus');
  bus.on('score', function (v) { this.scoreTxt.setText('SCORE ' + String(v).padStart(6, '0')); }, this);
  bus.on('lives', function (v) { this.livesTxt.setText('x' + v); }, this);
  bus.once('gameover', function () { this.banner.setText('GAME OVER').setAlpha(1); }, this);

  // 씬 종료/재시작 시 누수 없이 해제
  this.events.once('shutdown', function () { bus.off('score'); bus.off('lives'); bus.off('gameover'); });
}
```

**언제 무엇을:** 폴링(3)은 씬 객체에 이미 있는 `state` 를 그대로 읽으니 작은 게임에 간단. EventBus(3-b)는 발행처가 많거나(여러 씬·시스템이 점수에 기여) HUD 를 씬에서 떼어내 단독 테스트하고 싶을 때. 둘은 공존 가능하다.

### 4) 배너 트윈 (클리어·게임오버 팝업)
```js
// Game 씬에서 이벤트 발행
this.events.emit('banner', 'STAGE CLEAR!');

// UIScene.create() 내 리스너
var self = this;
this.scene.get('Game').events.on('banner', function (msg) {
  self.banner.setText(msg).setAlpha(1).setScale(0.4);
  self.tweens.add({ targets: self.banner, scale: 1, duration: 400, ease: 'Back.out' });
});
```

### 5) 일시정지 화면 패턴
```js
// Game 씬 — ESC 또는 터치 버튼
this.input.keyboard.on('keydown-ESC', function () {
  this.scene.pause('Game');
  this.scene.launch('Pause');
}, this);

// PauseScene
var PauseScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function () { Phaser.Scene.call(this, { key: 'Pause' }); },
  create: function () {
    this.add.rectangle(DESIGN_W/2, DESIGN_H/2, 160, 80, 0x000000, 0.7);
    this.add.text(DESIGN_W/2, DESIGN_H/2 - 16, 'PAUSED', { fontFamily:'monospace', fontSize:'18px', color:'#fff' }).setOrigin(0.5);
    var self = this;
    this.input.once('pointerdown', function () {
      self.scene.resume('Game');
      self.scene.stop();
    });
  }
});
```

## 짧은 스니펫 — 하트 아이콘 목숨 표시

```js
// UIScene.create() 내 — 하트 스프라이트로 목숨 시각화
this.heartIcons = [];
for (var i = 0; i < 3; i++) {
  var h = this.add.sprite(8 + i * 18, 36, 'heart').setOrigin(0, 0.5).setScale(1.5);
  this.heartIcons.push(h);
}

// update() 내 — 목숨 수만큼 표시, 나머지 흐리게
var lives = g.state.lives;
this.heartIcons.forEach(function (h, i) {
  h.setAlpha(i < lives ? 1 : 0.25);
});
```

## 모바일 안전영역 고려
```js
// index.html CSS — 노치·홈바 회피
body { padding: env(safe-area-inset-top) env(safe-area-inset-right)
              env(safe-area-inset-bottom) env(safe-area-inset-left); }
// HUD 요소를 상단 8~10px 아래에 배치하면 대부분 안전
```

## 연계 / 원칙
- web-game-builder 워크플로의 일부. 엔진 API는 `reference/engine-api.md`. IP-safe(라이선스 안전·절차).
- UI Scene은 `setScrollFactor(0)`이 기본(카메라 독립) — 직접 설정 불필요.
- HUD는 update()에서 매 프레임 setText를 호출해도 동작하지만, 성능상 값 변화 감지 후 갱신 권장. 더 나아가 씬↔HUD 를 완전히 분리하려면 `engine/eventbus.js` 의 EventBus 로 발행-구독한다(레시피 3-b) — 씬이 HUD 를 직접 참조하지 않고 `emit('score', v)` 만, 등록순 동기 디스패치라 헤드리스 검증에서 재현된다.
- 아이콘은 `PixelForge.buildAll`이 등록한 스프라이트(coin, hero 등) 또는 커스텀 bake 스프라이트를 재활용.
- Phaser 4 API 참고: [text-and-bitmaptext](../wgf-web-game-builder/reference/phaser/text-and-bitmaptext.md), [scenes](../wgf-web-game-builder/reference/phaser/scenes.md), [scale-and-responsive](../wgf-web-game-builder/reference/phaser/scale-and-responsive.md). 전체 색인은 [reference/phaser/INDEX.md](../wgf-web-game-builder/reference/phaser/INDEX.md).
