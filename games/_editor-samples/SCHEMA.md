# wgf-scene@1 스키마 문서

wgf-editor P0a 에서 사용하는 씬 문서 포맷 `wgf-scene@1` 의 전체 필드 명세.

---

## 최상위 구조

```jsonc
{
  "format":  "wgf-scene@1",   // 필수 — 포맷 식별자
  "slug":    "my-scene",      // 필수 — URL-safe 고유 식별자 (kebab-case)
  "meta":    { ... },         // 필수 — 씬 메타 정보
  "assets":  { ... },         // 필수 — 에셋 선언
  "walls":   [ ... ],         // 필수 — 정적 충돌 벽 목록
  "scenes":  [ ... ],         // 필수 — 씬 목록 (최소 1개)
  "dataLayers": { ... }       // 선택 — 확장 데이터 레이어
}
```

---

## meta

씬 전역 메타 정보.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `title` | string | 필수 | 씬 제목 (표시용) |
| `genre` | string | 필수 | 장르 식별자. P0a 허용값: `"topdown"` |
| `viewport` | object | 필수 | 렌더 해상도 — `{ w: number, h: number }` |
| `pixelArt` | boolean | 선택 | `true` 이면 nearest-neighbor 렌더링, 기본 `false` |

```jsonc
"meta": {
  "title": "최소 탑다운",
  "genre": "topdown",
  "viewport": { "w": 320, "h": 240 },
  "pixelArt": true
}
```

---

## assets

씬에서 참조하는 에셋을 선언한다.

### assets.sprites

스프라이트 에셋 배열. 엔티티의 `Sprite.sprite` 필드가 여기 선언된 `id` 를 참조한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | 필수 | 스프라이트 고유 ID (씬 내 유일) |
| `source` | string | 필수 | `"procedural"` 또는 `"cc0"` |
| `desc` | string | 선택 | 절차 생성 힌트 또는 에셋 설명 |
| `w` | number | 선택 | 기준 너비(px) |
| `h` | number | 선택 | 기준 높이(px) |
| `url` | string | 조건부 | `source:"cc0"` 일 때 원본 URL |
| `license` | string | 조건부 | `source:"cc0"` 일 때 라이선스 식별자 |

```jsonc
"assets": {
  "sprites": [
    { "id": "spr_player", "source": "procedural", "desc": "플레이어", "w": 16, "h": 16 },
    { "id": "spr_tile_wall", "source": "cc0", "url": "...", "license": "CC0-1.0" }
  ]
}
```

---

## walls

정적 충돌 벽 목록. SceneKit 충돌 코어가 AABB 분리에 직접 사용한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `x` | number | 필수 | 좌상단 x 좌표(px) |
| `y` | number | 필수 | 좌상단 y 좌표(px) |
| `w` | number | 필수 | 너비(px) |
| `h` | number | 필수 | 높이(px) |

```jsonc
"walls": [
  { "x": 0,   "y": 0,   "w": 320, "h": 8   },
  { "x": 0,   "y": 232, "w": 320, "h": 8   },
  { "x": 0,   "y": 0,   "w": 8,   "h": 240 },
  { "x": 312, "y": 0,   "w": 8,   "h": 240 }
]
```

---

## scenes

씬 배열. 최소 1개 이상 포함. `id:"main"` 이 기본 진입 씬.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | 필수 | 씬 고유 ID |
| `systems` | object | 선택 | 씬 전역 시스템 설정 (향후 확장) |
| `entities` | array | 필수 | 엔티티 목록 |

### entity (엔티티 오브젝트)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | 필수 | 엔티티 고유 ID (씬 내 유일) |
| `name` | string | 선택 | 표시용 이름 |
| `transform` | object | 필수 | 공간 변환 정보 |
| `components` | array | 필수 | 컴포넌트 목록 |

### transform

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `x` | number | 0 | 월드 x 좌표(px) |
| `y` | number | 0 | 월드 y 좌표(px) |
| `rotation` | number | 0 | 회전(라디안) |
| `scaleX` | number | 1 | x 스케일 |
| `scaleY` | number | 1 | y 스케일 |
| `depth` | number | 0 | 렌더 우선순위 (높을수록 앞에 그림) |

### component (컴포넌트 오브젝트)

`type` 필드 + 타입별 추가 필드.

**허용 컴포넌트 화이트리스트 — 정확히 15종**(설계서 §4.3). `lint-scene` 이 이 목록 밖(미등록·16번째) 타입에 `UNKNOWN_COMPONENT` error + exit 1 을 낸다.

| # | 타입 | 단계 | 요약 |
|---|------|------|------|
| 1 | `Sprite` | P0a | 정적 렌더 메타 |
| 2 | `Body` | P0a | 충돌 바디(aabb/circle) |
| 3 | `TopDownController` | P0a | 8방향 탑다운 이동 |
| 4 | `AnimatedSprite` | P0b | 프레임 애니메이션 메타(결정적 타이머) |
| 5 | `Shooter` | P0b | 주기 발사(Projectile 생성) |
| 6 | `Projectile` | P0b | 직선 이동 발사체(수명·데미지) |
| 7 | `EnemyAI` | P0b | 적 AI(chase/flee/patrol/shoot) |
| 8 | `Health` | P0b | 체력·무적·사망 처리 |
| 9 | `ContactDamage` | P0b | 접촉 데미지 |
| 10 | `Pickup` | P0b | 수집 아이템(heal/coin) |
| 11 | `Spawner` | P0b | 주기적 엔티티 생성 |
| 12 | `CameraFollow` | P0b | 카메라 추적 데이터 |
| 13 | `AbilityBinding` | P0b | 능력 쿨다운/발동 |
| 14 | `AudioEmitter` | P0b | 오디오 이벤트 누적 |
| 15 | `HUDBinding` | P0b | HUD 데이터 바인딩 |

> **결정론·Phaser 비의존 불변식**: 모든 컴포넌트는 무작위를 `ctx.rng`(RngForge 스트림)로만, 시간을 주입 `dt`(초)로만 다룬다. 렌더·오디오·카메라·HUD 는 코어에서 **데이터/메타만** 산출하고 실제 출력은 P1 어댑터 몫이다(예: `AudioEmitter` 는 `world.audioEvents` 에 이벤트만 누적, `CameraFollow` 는 `world.camera={x,y}` 만 갱신, `HUDBinding` 은 `world.hud` 만 채움). `_` 프리픽스 필드는 런타임 내부 상태(직렬화는 되지만 사용자 편집 대상 아님).

---

## P0a 허용 컴포넌트 상세

### Sprite

렌더 메타 전달용. 로직에는 영향을 주지 않는다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"Sprite"` | 필수 | 컴포넌트 타입 |
| `sprite` | string | 필수 | `assets.sprites[].id` 참조 |
| `anim` | string | 선택 | 재생할 애니메이션 키 |

```jsonc
{ "type": "Sprite", "sprite": "spr_player" }
```

### Body

충돌 바디. SceneKit 충돌 코어가 이 필드를 읽어 분리 벡터를 계산한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"Body"` | 필수 | 컴포넌트 타입 |
| `shape` | `"aabb"` \| `"circle"` | 필수 | 충돌 형태 |
| `w` | number | 조건부 | `shape:"aabb"` 일 때 너비(px) |
| `h` | number | 조건부 | `shape:"aabb"` 일 때 높이(px) |
| `radius` | number | 조건부 | `shape:"circle"` 일 때 반지름(px) |
| `isStatic` | boolean | 선택 | `true` 이면 고정 바디(이동 없음), 기본 `false` |

```jsonc
{ "type": "Body", "shape": "circle", "radius": 7, "isStatic": false }
```

### TopDownController

8방향 탑다운 이동 컨트롤러. `step` 마다 입력을 읽어 `transform` 을 적분한다.

입력 우선순위:
1. `GAME_INPUT` 전역 객체가 있으면 그 키 상태 사용
2. 없으면 `world.meta.inputProvider(entity)` 호출 → `{ ax, ay }` (헤드리스 주입)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"TopDownController"` | 필수 | 컴포넌트 타입 |
| `speed` | number | 필수 | 이동 속도 (px/s) |
| `input` | `"wasd"` \| `"stick"` \| `"both"` | 필수 | 입력 소스 |

```jsonc
{ "type": "TopDownController", "speed": 80, "input": "wasd" }
```

---

## P0b 허용 컴포넌트 상세

P0b 에서 추가된 12종. 런타임 내부 필드(`_frame`, `_cd`, `_cooldowns`, `dead` 등)는 init 에서 결정적 기본값으로 세팅되며 사용자가 직접 편집하지 않는다.

### AnimatedSprite

프레임 애니메이션 메타. 코어는 `_frame`/`_elapsed`/`_anim` 만 결정적으로 진행하고 실제 렌더는 어댑터 몫이다. **t=0 = 프레임0 고정**(계약 H′).

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"AnimatedSprite"` | 필수 | 컴포넌트 타입 |
| `sprite` | string | 필수 | `assets.sprites[].id` 참조 |
| `anims` | array | 선택 | `[{ key, frames:[..], fps, loop }]` 애니메이션 정의 |
| `play` | string | 선택 | 초기 재생 키(기본=첫 anim) |

```jsonc
{ "type": "AnimatedSprite", "sprite": "spr_player",
  "anims": [{ "key": "walk", "frames": [0,1,2,3], "fps": 8, "loop": true }], "play": "walk" }
```

### Shooter

주기적으로 `Projectile` 엔티티를 생성한다. `target` 방향으로 결정적 조준. `SceneKit.applyCommand(addEntity)` 로 가산 생성.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"Shooter"` | 필수 | 컴포넌트 타입 |
| `cooldown` | number | 필수 | 발사 간격(초) |
| `speed` | number | 선택 | 발사체 속도(px/s, 기본 120) |
| `target` | string | 선택 | 조준 대상(기본 `"player"`) |
| `auto` | boolean | 선택 | 자동 발사(기본 true) |
| `damage` | number | 선택 | 발사체 데미지(기본 1) |
| `projectileLifetime` | number | 선택 | 발사체 수명(초, 기본 2) |
| `projectileSprite` | string | 선택 | 발사체 스프라이트 id |

```jsonc
{ "type": "Shooter", "cooldown": 0.5, "speed": 120, "target": "player", "auto": true, "damage": 1 }
```

### Projectile

직선 이동 발사체. `vx`/`vy` 직접 지정 또는 `speed`+`angle`(라디안)으로 init 시 속도 계산. 수명 후 자기 소멸, `damage>0` 이면 `Health` 보유 엔티티 명중 시 데미지 + 소멸.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"Projectile"` | 필수 | 컴포넌트 타입 |
| `vx` | number | 조건부 | x 속도(px/s) |
| `vy` | number | 조건부 | y 속도(px/s) |
| `speed` | number | 조건부 | `angle` 와 함께 속도 크기(px/s) |
| `angle` | number | 조건부 | `speed` 와 함께 방향(라디안) |
| `lifetime` | number | 필수 | 수명(초) |
| `damage` | number | 선택 | 명중 데미지(>0 이면 충돌 판정) |
| `pierce` | boolean | 선택 | 관통(명중해도 소멸 안 함, 기본 false) |

```jsonc
{ "type": "Projectile", "speed": 120, "angle": 0, "lifetime": 2, "damage": 1 }
```

### EnemyAI

결정적 적 AI. `range` 밖이면 대기. `patrol` 진동은 origin 기준 결정적.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"EnemyAI"` | 필수 | 컴포넌트 타입 |
| `mode` | `"chase"` \| `"flee"` \| `"patrol"` \| `"shoot"` | 필수 | AI 모드 |
| `target` | string | 선택 | 대상(기본 `"player"`) |
| `speed` | number | 선택 | 이동 속도(px/s, 기본 50) |
| `range` | number | 선택 | 감지 거리(px, 0=무한) |
| `patrolAxis` | `"x"` \| `"y"` | 선택 | patrol 진동 축(기본 x) |
| `patrolRange` | number | 선택 | patrol 진폭(px, 기본 32) |

```jsonc
{ "type": "EnemyAI", "mode": "chase", "target": "player", "speed": 60, "range": 200 }
```

### Health

체력·무적·사망 처리. 다른 컴포넌트(`ContactDamage`/`Projectile`)가 `hp` 를 직접 깎는다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"Health"` | 필수 | 컴포넌트 타입 |
| `max` | number | 필수 | 최대 체력 |
| `hp` | number | 선택 | 현재 체력(기본=max) |
| `invuln` | number | 선택 | 피격 후 무적 시간(초) |
| `onDeath` | `"remove"` \| `"flag"` | 선택 | 사망 처리(기본 flag) |

```jsonc
{ "type": "Health", "max": 10, "hp": 10, "invuln": 0.5, "onDeath": "remove" }
```

### ContactDamage

자기 Body 와 겹친 `Health` 보유 엔티티에 데미지. 오버랩 판정은 컴포넌트 내부 헬퍼(코어 충돌 분리와 별개). 쿨다운/`oncePerTarget`/무적 존중.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"ContactDamage"` | 필수 | 컴포넌트 타입 |
| `damage` | number | 필수 | 접촉당 데미지 |
| `cooldown` | number | 선택 | 동일 대상 재타격 쿨다운(초) |
| `oncePerTarget` | boolean | 선택 | 대상당 1회만(기본 false) |

```jsonc
{ "type": "ContactDamage", "damage": 3, "cooldown": 0.5 }
```

### Pickup

수집자(`collector`)와 오버랩 시 효과 적용 + 자기 소멸. `kind:"heal"` 은 `Health.hp` 증가, 그 외(`coin` 등)는 `world.counters[kind]` 증가.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"Pickup"` | 필수 | 컴포넌트 타입 |
| `kind` | string | 선택 | `"heal"` \| `"coin"` \| 기타(기본 coin) |
| `amount` | number | 선택 | 효과량(기본 1) |
| `collector` | string | 선택 | 수집자(기본 `"player"`) |

```jsonc
{ "type": "Pickup", "kind": "coin", "amount": 10, "collector": "player" }
```

### Spawner

주기적으로 `template`(인라인 엔티티)을 생성. 위치 = 스포너 transform + 선택적 `ctx.rng` 오프셋(`jitter`). `max` 상한 존중.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"Spawner"` | 필수 | 컴포넌트 타입 |
| `template` | object | 필수 | 생성할 엔티티 템플릿(id 는 자동 발급) |
| `interval` | number | 필수 | 생성 간격(초) |
| `max` | number | 선택 | 최대 생성 수(0=무한) |
| `jitter` | number | 선택 | `ctx.rng` 위치 오프셋 범위(±px) |

```jsonc
{ "type": "Spawner", "interval": 1.5, "max": 10, "jitter": 8,
  "template": { "name": "졸개", "components": [{ "type": "Body", "shape": "aabb", "w": 8, "h": 8 }] } }
```

### CameraFollow

카메라 추적 데이터(`world.camera={x,y}`). t=0 = 타깃에 스냅. 실제 카메라는 어댑터.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"CameraFollow"` | 필수 | 컴포넌트 타입 |
| `target` | string | 선택 | 추적 대상(기본 `"self"`) |
| `lerp` | number | 선택 | 추적 보간(0..1, 1=즉시, 기본 1) |

```jsonc
{ "type": "CameraFollow", "target": "player", "lerp": 0.2 }
```

### AbilityBinding

능력 쿨다운/발동(결정적 타이머). 상태는 JSON 직렬화 가능 `_cooldowns` 에 보관. 발동 요청은 결정적 주입(`world.meta.abilityInput(entity) -> [abilityId,...]`), 발동 시 `world.abilityEvents` 에 이벤트 누적(VFX 는 어댑터). `bindings` 는 입력 키 매핑 메타.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"AbilityBinding"` | 필수 | 컴포넌트 타입 |
| `abilities` | array | 선택 | `[{ id, cooldown }]` 능력 목록 |
| `bindings` | object | 선택 | `{ 키: abilityId }` 입력 바인딩(어댑터용 메타) |

```jsonc
{ "type": "AbilityBinding", "abilities": [{ "id": "dash", "cooldown": 1.5 }], "bindings": { "Space": "dash" } }
```

### AudioEmitter

오디오 이벤트를 `world.audioEvents` 에 결정적으로 누적한다. **코어 step 에서 실제 재생(soundforge/chipaudio) 을 호출하지 않는다** — drain·재생은 어댑터 몫.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"AudioEmitter"` | 필수 | 컴포넌트 타입 |
| `sound` | string | 필수 | 사운드 키/정의 id |
| `trigger` | `"onSpawn"` \| `"onStep"` \| `"manual"` | 선택 | 발화 시점(기본 manual) |
| `cooldown` | number | 선택 | `onStep` 발화 간격(초) |

```jsonc
{ "type": "AudioEmitter", "sound": "sfx_hit", "trigger": "onStep", "cooldown": 0.3 }
```

### HUDBinding

HUD 데이터 바인딩(데이터만, 렌더는 어댑터). `source` 경로에서 결정적으로 값을 산출해 `_value` + `world.hud[element]` 에 미러.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `type` | `"HUDBinding"` | 필수 | 컴포넌트 타입 |
| `element` | string | 필수 | HUD 요소 id |
| `source` | string | 필수 | 값 경로 — `"Health.hp"`(같은 엔티티 컴포넌트) 또는 `"world.counters.coin"`(world 경로) |
| `format` | string | 선택 | 표시 포맷 힌트(어댑터 해석) |

```jsonc
{ "type": "HUDBinding", "element": "hpbar", "source": "Health.hp", "format": "HP: {v}" }
```

---

## dataLayers

확장 데이터 레이어. 모두 선택 필드. 미사용 시 빈 객체 `{}` 권장.

| 키 | 타입 | 설명 |
|----|------|------|
| `abilities` | object | AbilityKit `abilities.json` 인라인 데이터 |
| `items` | object | ItemKit `items.json` 인라인 데이터 |
| `style` | object | StyleKit `style.json` 인라인 데이터 |
| `audio` | object | SoundForge `audio.json` 인라인 데이터 |

---

## 유효성 규칙 요약

lint-scene.mjs 가 검사하는 주요 규칙:

1. `format` 이 `"wgf-scene@1"` 인지 확인
2. 최상위 필수 필드(`slug`, `meta`, `assets`, `walls`, `scenes`) 존재
3. `meta` 의 필수 필드(`title`, `genre`, `viewport`) 존재
4. `scenes` 가 최소 1개 이상
5. 각 엔티티의 `Sprite`/`AnimatedSprite.sprite` 가 `assets.sprites[].id` 에 실제로 존재(댕글링 레퍼런스 금지)
6. `Body` 없이 `TopDownController` 가 있으면 경고
7. 컴포넌트 타입이 **15종 화이트리스트** 밖(미등록·16번째)이면 `UNKNOWN_COMPONENT` error + exit 1
8. 엔티티 spawn 위치가 벽 AABB 와 완전히 겹치면 경고(도달 불가 스폰)
9. P0b 컴포넌트별 필수 필드·enum 검증(예: `Health.max>0`, `Projectile.lifetime>0`, `Shooter.cooldown>0`, `EnemyAI.mode` enum, `Spawner.template`/`interval`, `AudioEmitter.sound`, `HUDBinding.element`/`source` 등)
