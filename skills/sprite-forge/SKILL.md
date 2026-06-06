---
name: sprite-forge
description: "PixelForge로 스프라이트·타일·아이템과 프레임 애니메이션을 코드 생성(CC0/IP-safe)합니다. 캐릭터/스프라이트/픽셀아트/타일셋/애니메이션 제작·수정 요청 시 사용. sprite, pixel art, animation, tileset, character art."
allowed-tools: Read, Write, Edit
---

# sprite-forge — PixelForge 스프라이트·애니메이션 코드 생성

문자 그리드로 픽셀아트 스프라이트를 코드만으로 만든다. 외부 이미지 파일 없이 CC0/IP-safe 에셋을 즉석 생성한다. web-game-builder의 전문 스킬. `engine/pixelforge.js`를 사용한다.

> **이건 픽셀아트 전용.** 미려한 비-픽셀(스무스/벡터·그라데이션·글로우·글래스·곡선 캐릭터)
> 그래픽은 `vector-graphics` 스킬(VectorForge)을 쓴다. 렌더 스타일은 게임당 하나로 통일한다
> (픽셀 `pixelArt:true` ↔ 스무스 `pixelArt:false`).

## 언제 사용
- 새 캐릭터·적·아이템·타일을 추가하거나 기존 스프라이트를 수정할 때
- 프레임 애니메이션(걷기·점프·회전·깜박임)이 필요할 때
- 마리오 '느낌'의 오리지널 캐릭터를 IP-safe하게 만들 때

## 핵심 레시피

### 1) palette + frames 정의
```js
// palette: 문자 → '#rrggbb'. '.' 과 ' ' 는 항상 투명
// frames: [프레임0행배열, 프레임1행배열, ...]
// 라가드 행(길이 불일치)은 오른쪽이 투명으로 자동 패딩 → 폭 안 맞춰도 됨
var COIN_DEF = {
  palette: { 'y': '#ffe23f', 'w': '#fff7c0', 'o': '#c8a000' },
  frames: [
    ["..yy..", ".yooy.", "yoowy.", "yoowy.", ".yooy.", "..yy.."],  // frame 0 (정면)
    ["..ww..", "..wo..", "..wo..", "..wo..", "..ww..", "......"],  // frame 1 (측면)
  ]
};
```

### 2) Boot 씬에서 bake 호출
```js
// Boot.create() 내부
PixelForge.buildAll(this);           // 내장 라이브러리(hero/enemy/coin 등) 일괄 등록
PixelForge.bake(this, 'coin2', COIN_DEF);  // 커스텀 스프라이트 추가
```

### 3) 애니메이션 등록
```js
this.anims.create({
  key: 'coin2-spin',
  frames: [
    { key: 'coin2', frame: 0 },
    { key: 'coin2', frame: 1 },
    { key: 'coin2', frame: 0 },
  ],
  frameRate: 8,
  repeat: -1
});
```

### 4) 씬에서 사용
```js
var c = this.add.sprite(x, y, 'coin2');
c.play('coin2-spin');
```

### 5) _preview로 눈으로 확인·보정
Boot 씬 끝에 임시 라인을 추가해 스프라이트가 의도대로 보이는지 확인하고, 팔레트 문자를 교체해 색을 보정한다.
```js
// 임시 미리보기 (확인 후 삭제)
this.add.sprite(40, 40, 'coin2', 0).setScale(6);  // 크게 확대해서 확인
```

## 짧은 스니펫 — 별 스프라이트 bake + 트윈

```js
// Boot.create() 내
PixelForge.bake(this, 'star', {
  palette: { 'y': '#ffe23f', 'w': '#fff7c0', '.': null },
  frames: [
    ["..y..", ".ywy.", "ywwwy", ".ywy.", "..y.."],  // frame 0 (풀 별)
    ["..y..", "..y..", "yywyy", "..y..", "..y.."],  // frame 1 (날카로운 별)
  ]
});
this.anims.create({
  key: 'star-twinkle',
  frames: [{ key: 'star', frame: 0 }, { key: 'star', frame: 1 }],
  frameRate: 6, repeat: -1
});

// Game.create() 내 — 수집 아이템으로 배치
var star = this.physics.add.sprite(200, 80, 'star');
star.play('star-twinkle');
star.setScale(2);
// 둥실둥실 트윈
this.tweens.add({ targets: star, y: 72, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
```

## IP-safe 오리지널 캐릭터 가이드
- 색 단서 1개만 남기고 나머지를 바꾼다. 예: 빨간 모자는 유지, 멜빵·수염·직업·이탈리안 설정 제거.
- 보호된 이름('Mario', 'Link', 'Sonic' 등) 사용 금지.
- 형태가 겹쳐도 팔레트·외형·이름을 다르게 하면 메카닉은 자유롭게 구현 가능.

## 연계 / 원칙
- web-game-builder 워크플로의 일부. 엔진 API는 `reference/engine-api.md`. IP-safe(CC0/절차적).
- `PixelForge.buildAll` 내장 키: `hero`, `enemy`, `coin`, `ground`, `dirt`, `brick`, `qblock`, `pipeTop`, `pipeBody`, `mushroom`, `flag`, `pole`, `cloud`, `hill`, `bush`.
- config에 `pixelArt: true, roundPixels: true` 필수 — 확대 시 또렷한 픽셀.
- Phaser 4 API 참고: [sprites-and-images](../web-game-builder/reference/phaser/sprites-and-images.md), [animations](../web-game-builder/reference/phaser/animations.md), [loading-assets](../web-game-builder/reference/phaser/loading-assets.md). 전체 색인은 [reference/phaser/INDEX.md](../web-game-builder/reference/phaser/INDEX.md).
