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

`type` 필드 + 타입별 추가 필드. P0a 허용 타입: `Sprite`, `Body`, `TopDownController`.

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
5. 각 엔티티의 `Sprite.sprite` 가 `assets.sprites[].id` 에 실제로 존재(댕글링 레퍼런스 금지)
6. `Body` 없이 `TopDownController` 가 있으면 경고
7. 컴포넌트 타입이 P0a 화이트리스트(`Sprite`, `Body`, `TopDownController`) 이외면 `not-yet` 경고
8. 엔티티 spawn 위치가 벽 AABB 와 완전히 겹치면 경고(도달 불가 스폰)
