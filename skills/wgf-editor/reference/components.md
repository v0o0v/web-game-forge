# WGF Studio 컴포넌트 15종 레퍼런스

`wgf-scene@1` 의 엔티티 컴포넌트 화이트리스트(정확히 15종). 정식 스키마 원본은
[games/_editor-samples/SCHEMA.md](../../../games/_editor-samples/SCHEMA.md) — 이 문서는 그
요약·재구성이다. `lint-scene` 이 이 목록 밖(미등록·16번째) 타입에 `UNKNOWN_COMPONENT` error
+ exit 1 을 낸다.

---

## 엔티티 구조

```jsonc
{
  "id": "player",            // 필수 — 씬 내 유일
  "name": "플레이어",         // 선택 — 표시용
  "transform": { "x": 0, "y": 0, "rotation": 0, "scaleX": 1, "scaleY": 1, "depth": 0 },
  "components": [ ... ]      // 필수 — 아래 15종 화이트리스트
}
```

transform 필드: `x`·`y`(px), `rotation`(라디안), `scaleX`·`scaleY`(기본 1), `depth`(렌더
우선순위, 높을수록 앞).

---

## 결정론·Phaser 비의존 불변식

모든 컴포넌트는 무작위를 `ctx.rng`(RngForge 스트림)로만, 시간을 주입 `dt`(초)로만 다룬다.
렌더·오디오·카메라·HUD 는 코어에서 **데이터/메타만** 산출하고 실제 출력은 어댑터 몫이다.
`_` 프리픽스 필드(`_frame`·`_cd`·`_cooldowns`·`dead` 등)는 런타임 내부 상태(직렬화되지만
사용자 편집 대상 아님).

---

## P0a 컴포넌트 (3종)

### 1. Sprite
정적 렌더 메타. 로직에 영향 없음.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `sprite` | string | 필수 | `assets.sprites[].id` 참조 |
| `anim` | string | 선택 | 재생 애니메이션 키 |

```jsonc
{ "type": "Sprite", "sprite": "spr_player" }
```

### 2. Body
충돌 바디. SceneKit 충돌 코어가 분리 벡터 계산에 사용.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `shape` | `"aabb"`\|`"circle"` | 필수 | 충돌 형태 |
| `w`·`h` | number | 조건부 | `shape:"aabb"` 일 때 |
| `radius` | number | 조건부 | `shape:"circle"` 일 때 |
| `isStatic` | boolean | 선택 | `true`=고정 바디(기본 false) |

```jsonc
{ "type": "Body", "shape": "circle", "radius": 7, "isStatic": false }
```

### 3. TopDownController
8방향 탑다운 이동. 입력 우선순위: `GAME_INPUT` 전역 → `world.meta.inputProvider(entity)`.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `speed` | number | 필수 | 이동 속도(px/s) |
| `input` | `"wasd"`\|`"stick"`\|`"both"` | 필수 | 입력 소스 |

```jsonc
{ "type": "TopDownController", "speed": 80, "input": "wasd" }
```

---

## P0b 컴포넌트 (12종)

### 4. AnimatedSprite
프레임 애니메이션 메타(결정적 타이머). **t=0 = 프레임0 고정**(계약 H′).

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `sprite` | string | 필수 | `assets.sprites[].id` 참조 |
| `anims` | array | 선택 | `[{ key, frames:[..], fps, loop }]` |
| `play` | string | 선택 | 초기 재생 키(기본=첫 anim) |

```jsonc
{ "type": "AnimatedSprite", "sprite": "spr_beacon",
  "anims": [{ "key": "pulse", "frames": [0,1,2,3], "fps": 6, "loop": true }], "play": "pulse" }
```

### 5. Shooter
주기적으로 `Projectile` 엔티티 생성. `target` 방향 결정적 조준.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `cooldown` | number | 필수 | 발사 간격(초) |
| `speed` | number | 선택 | 발사체 속도(기본 120) |
| `target` | string | 선택 | 조준 대상(기본 `"player"`) |
| `auto` | boolean | 선택 | 자동 발사(기본 true) |
| `damage` | number | 선택 | 발사체 데미지(기본 1) |
| `projectileLifetime` | number | 선택 | 발사체 수명(기본 2) |
| `projectileSprite` | string | 선택 | 발사체 스프라이트 id |

```jsonc
{ "type": "Shooter", "cooldown": 0.5, "speed": 200, "target": "player", "damage": 1 }
```

### 6. Projectile
직선 이동 발사체. `vx`/`vy` 직접 또는 `speed`+`angle`(라디안). 수명 후 소멸, `damage>0` 이면
`Health` 명중 시 데미지+소멸. 비관통 명중 대상은 **결정적 id 사전식 순서**로 선택.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `vx`·`vy` | number | 조건부 | 속도(px/s) |
| `speed`·`angle` | number | 조건부 | 속도 크기 + 방향(라디안) |
| `lifetime` | number | 필수 | 수명(초) |
| `damage` | number | 선택 | 명중 데미지(>0 이면 충돌 판정) |
| `pierce` | boolean | 선택 | 관통(기본 false) |

```jsonc
{ "type": "Projectile", "speed": 120, "angle": 0, "lifetime": 2, "damage": 1 }
```

### 7. EnemyAI
결정적 적 AI. `range` 밖이면 대기. patrol 진동은 origin 기준 결정적.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `mode` | `"chase"`\|`"flee"`\|`"patrol"`\|`"shoot"` | 필수 | AI 모드 |
| `target` | string | 선택 | 대상(기본 `"player"`) |
| `speed` | number | 선택 | 이동 속도(기본 50) |
| `range` | number | 선택 | 감지 거리(0=무한) |
| `patrolAxis` | `"x"`\|`"y"` | 선택 | patrol 축(기본 x) |
| `patrolRange` | number | 선택 | patrol 진폭(기본 32) |

```jsonc
{ "type": "EnemyAI", "mode": "chase", "target": "player", "speed": 60, "range": 200 }
```

### 8. Health
체력·무적·사망 처리. 다른 컴포넌트가 `hp` 를 직접 깎는다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `max` | number | 필수 | 최대 체력 |
| `hp` | number | 선택 | 현재 체력(기본=max) |
| `invuln` | number | 선택 | 피격 후 무적 시간(초) |
| `onDeath` | `"remove"`\|`"flag"` | 선택 | 사망 처리(기본 flag) |

```jsonc
{ "type": "Health", "max": 10, "hp": 10, "invuln": 0.5, "onDeath": "remove" }
```

### 9. ContactDamage
자기 Body 와 겹친 `Health` 보유 엔티티에 데미지. 쿨다운/`oncePerTarget`/무적 존중.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `damage` | number | 필수 | 접촉당 데미지 |
| `cooldown` | number | 선택 | 동일 대상 재타격 쿨다운(초) |
| `oncePerTarget` | boolean | 선택 | 대상당 1회만(기본 false) |

```jsonc
{ "type": "ContactDamage", "damage": 3, "cooldown": 0.5 }
```

### 10. Pickup
`collector` 와 오버랩 시 효과 + 소멸. `kind:"heal"` 은 `Health.hp` 증가, 그 외는
`world.counters[kind]` 증가.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `kind` | string | 선택 | `"heal"`\|`"coin"`\|기타(기본 coin) |
| `amount` | number | 선택 | 효과량(기본 1) |
| `collector` | string | 선택 | 수집자(기본 `"player"`) |

```jsonc
{ "type": "Pickup", "kind": "coin", "amount": 1, "collector": "player" }
```

### 11. Spawner
주기적으로 `template`(인라인 엔티티) 생성. 위치=스포너 transform + 선택 `jitter`(rng 오프셋).
프레임당 1개만 생성(버스트 방지). `template.components` 도 lint-scene 화이트리스트 검증 대상.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `template` | object | 필수 | 생성 엔티티 템플릿(id 자동 발급) |
| `interval` | number | 필수 | 생성 간격(초) |
| `max` | number | 선택 | 최대 생성 수(0=무한) |
| `jitter` | number | 선택 | rng 위치 오프셋(±px) |

```jsonc
{ "type": "Spawner", "interval": 3, "max": 4, "jitter": 8,
  "template": { "name": "졸개", "components": [{ "type": "Body", "shape": "circle", "radius": 6 }] } }
```

### 12. CameraFollow
카메라 추적 데이터(`world.camera={x,y}`). t=0=타깃 스냅. 한 씬에 1개 권장(2개+ 이면 lint-scene warn).

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `target` | string | 선택 | 추적 대상(기본 `"self"`) |
| `lerp` | number | 선택 | 보간(0..1, 1=즉시, 기본 1) |

```jsonc
{ "type": "CameraFollow", "target": "player", "lerp": 0.2 }
```

### 13. AbilityBinding
능력 쿨다운/발동(결정적 타이머). 발동 요청은 `world.meta.abilityInput(entity)` 주입, 발동 시
`world.abilityEvents` 누적(VFX 는 어댑터).

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `abilities` | array | 선택 | `[{ id, cooldown }]` |
| `bindings` | object | 선택 | `{ 키: abilityId }` 입력 바인딩(어댑터용 메타) |

```jsonc
{ "type": "AbilityBinding", "abilities": [{ "id": "dash", "cooldown": 1.5 }], "bindings": { "Space": "dash" } }
```

### 14. AudioEmitter
오디오 이벤트를 `world.audioEvents` 에 결정적 누적. **코어 step 에서 실제 재생 호출 안 함**
(drain·재생은 어댑터).

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `sound` | string | 필수 | 사운드 키/정의 id |
| `trigger` | `"onSpawn"`\|`"onStep"`\|`"manual"` | 선택 | 발화 시점(기본 manual) |
| `cooldown` | number | 선택 | `onStep` 발화 간격(초) |

```jsonc
{ "type": "AudioEmitter", "sound": "sfx_hit", "trigger": "onStep", "cooldown": 0.3 }
```

### 15. HUDBinding
HUD 데이터 바인딩(데이터만, 렌더는 어댑터). `source` 경로에서 결정적 값 산출 → `_value` +
`world.hud[element]` 미러.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `element` | string | 필수 | HUD 요소 id |
| `source` | string | 필수 | 값 경로 — `"Health.hp"`(컴포넌트) 또는 `"world.counters.coin"`(world) |
| `format` | string | 선택 | 표시 포맷 힌트(어댑터 해석) |

```jsonc
{ "type": "HUDBinding", "element": "hpbar", "source": "Health.hp", "format": "HP: {v}" }
```

---

## lint-scene 유효성 규칙 요약

1. `format` == `"wgf-scene@1"`.
2. 최상위 필수 필드(`slug`·`meta`·`assets`·`walls`·`scenes`) 존재.
3. `meta` 필수 필드(`title`·`genre`·`viewport`) 존재.
4. `scenes` 최소 1개.
5. `Sprite`/`AnimatedSprite.sprite` 가 `assets.sprites[].id` 에 실재(댕글링 ref 금지).
6. `Body` 없는 `TopDownController` → 경고.
7. 컴포넌트 타입이 15종 밖 → `UNKNOWN_COMPONENT` error + exit 1.
8. 엔티티 spawn 위치가 벽 AABB 와 완전 겹침 → 경고(도달 불가).
9. P0b 컴포넌트별 필수 필드·enum 검증(`Health.max>0`·`Projectile.lifetime>0`·
   `Shooter.cooldown>0`·`EnemyAI.mode` enum·`Spawner.template`/`interval`·`AudioEmitter.sound`·
   `HUDBinding.element`/`source` 등).

---

## 데모 예시 — wgf-demo-arena

P5 에서 제작한 데모 [games/wgf-demo-arena/scene.json](../../../games/wgf-demo-arena/scene.json)
은 10 엔티티에 위 컴포넌트를 폭넓게 쓴다: 플레이어(Sprite·Body·TopDownController·Shooter·
Health·CameraFollow·AbilityBinding·HUDBinding×2·AudioEmitter), 추격 드론×2(EnemyAI chase·
ContactDamage), 정지 포탑(Shooter·Health), 코인×3·회복키트(Pickup), 소환 패드(Spawner),
신호 비콘(AnimatedSprite). `test-demo.mjs` 13 게이트가 lint-scene·export·결정성·생성형
동작·qa-score 를 검증한다.
