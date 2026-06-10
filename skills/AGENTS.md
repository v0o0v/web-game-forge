<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# skills/

## Purpose
WebGameForge의 **29종 스킬 체계**가 사는 곳. 메인 오케스트레이터 `web-game-builder`가 전체 흐름을 조율하고, 요청 성격에 따라 전문 스킬이 자동 발동한다. 협력 순서는 **장르로 스캐폴드 → 제작요소로 살붙이기 → 품질로 검증·최적화**. 각 스킬은 `SKILL.md`(YAML frontmatter `name`+`description` + 본문 지침)가 진실의 원천이며, 일부는 `reference/`(설계 이론·인터뷰 대본)와 `tools/`(무의존성 `.mjs` validator/베이커)를 동반한다. tight한 description으로 관련 요청에만 발동해 스킬 listing 예산(컨텍스트 ~1%, 개별 캡 1,536자)을 관리한다.

> **이 디렉터리의 AGENTS.md는 카탈로그/라우터다.** 각 스킬의 상세 동작은 그 스킬의 `SKILL.md`를 직접 읽어라. 복합 구조를 가진 두 허브 스킬은 자체 AGENTS.md를 둔다(`wgf-web-game-builder/`, `wgf-sprite-picker/`).

## Subdirectories (스킬 카탈로그)

### 메인 오케스트레이터
| Skill | 역할 |
|-------|------|
| `wgf-web-game-builder/` | 게임 제작 요청 감지·오케스트레이션. 거대 `reference/`(phaser 28종·game-dna·engine-api) 보유 (see `wgf-web-game-builder/AGENTS.md`) |

### 🎮 장르 스캐폴드 (5)
| Skill | 역할 |
|-------|------|
| `wgf-platformer-game/` | 옆스크롤 플랫포머(마리오류) — 플래그십 |
| `wgf-topdown-shooter/` | 탑다운/트윈스틱 슈팅 |
| `wgf-arcade-classic/` | 벽돌깨기·뱀·퐁·인베이더 |
| `wgf-puzzle-game/` | 테트리스·매치3·2048·뿌요뿌요 (퍼즐 신규 하위장르 포함) |
| `wgf-endless-runner/` | 무한 러너·플래피류 |

### 🛠 제작요소 (13)
| Skill | 역할 |
|-------|------|
| `wgf-sprite-picker/` | 실제 스프라이트/시트/애니를 브라우저 갤러리에서 시각 선택·적용 + 캐싱·로컬 라이브러리 (see `wgf-sprite-picker/AGENTS.md`) |
| `wgf-sprite-forge/` | PixelForge 픽셀아트 스프라이트·애니 절차 생성 |
| `wgf-vector-graphics/` | VectorForge 스무스/벡터 그래픽 + 외부 HD CC0 로딩 |
| `wgf-sound-architect/` | 무드·BGM·효과음·적응형 음악 사운드 **설계** + SoundForge(Tone.js)·`AUDIO.md`·`audio.json`·`lint-audio.mjs` (`reference/sound-design/`) |
| `wgf-chip-sound/` | ChipAudio 효과음·BGM 합성 |
| `wgf-world-map-architect/` | 스테이지를 잇는 진행 맵 위상 설계 + 맵 화면 빌드 (`reference/map-design/`) |
| `wgf-level-architect/` | 난이도 곡선·재미 극대화 레벨 **설계**(인터뷰) (`reference/level-design/`) |
| `wgf-story-architect/` | 톤·스토리·캐릭터·대사 서사 **설계** + `STORY.md` 바이블 (`reference/story-design/`) |
| `wgf-ability-architect/` | 캐릭터 능력/스킬 시스템 **설계**(Claude 스킬 아님 — 게임 캐릭터 능력) + `ABILITIES.md`·`abilities.json` + `engine/abilitykit.js` 런타임 + `tools/lint-abilities.mjs`·`sim-abilities.mjs` (`reference/ability-design/`) |
| `wgf-item-architect/` | 아이템 시스템 **설계** + `ITEMS.md`·`items.json` + `tools/lint-items.mjs` 밸런스 validator (`reference/item-design/`) |
| `wgf-level-designer/` | 레벨·타일맵 **빌드**(구현). `tools/`에 `.tmj` 저작/베이크 4종 (`reference/tiled/`) |
| `wgf-game-ui-hud/` | HUD·메뉴·UI 화면 |
| `wgf-juice-fx/` | 파티클·스크린셰이크·게임필 |

### 🧩 Phaser 고급 킷 (5) — `engine/*kit.js`와 1:1
| Skill | 역할 |
|-------|------|
| `wgf-matter-physics/` | Matter 강체 물리(슬링샷·쌓기·물리퍼즐·래그돌) → `engine/matterkit.js` |
| `wgf-screen-fx/` | 포스트FX 화면 룩(블룸·비네트·CRT·네온) → `engine/screenfx.js` |
| `wgf-lighting-mood/` | 동적 라이팅·분위기(PointLight·안개·밤하늘) → `engine/lightingkit.js` |
| `wgf-path-motion/` | 경로·모션(스플라인 패트롤·방사 탄막·크립) → `engine/pathkit.js` |
| `wgf-virtual-joystick/` | 가상 조이스틱(아날로그/트윈스틱) 터치 컨트롤. 디지털 D-패드와 공존 → `engine/joystickkit.js` |

### ✅ 품질·운영 (5)
| Skill | 역할 |
|-------|------|
| `wgf-mobile-webview-tune/` | 모바일 웹뷰 최적화·감사 |
| `wgf-game-qa/` | 헤드리스 step 하니스 동작 검증 |
| `wgf-ip-license-guard/` | 저작권·라이선스 안전 점검(최종 게이트) |
| `wgf-perf-60fps/` | 60fps 성능 최적화(풀링·배칭) |
| `wgf-sprite-catalog-refresh/` | sprite-picker의 CC0 소스 카탈로그 웹 재조사·갱신(명시 요청 시) |

## For AI Agents

### Working In This Directory
- **새 스킬 추가/수정 시 `SKILL.md`의 `description`을 tight하게 유지**(개별 캡 1,536자). description은 자동 발동 트리거이므로 한/영 고밀도 키워드를 넣되, 무관한 요청에 오발동하지 않게 좁힌다.
- 스킬은 **설계(architect) vs 빌드(designer/forge)** 역할을 분리한다 — 예: `level-architect`(설계·인터뷰) → `level-designer`(구현·타일맵). 이 경계를 흐리지 말 것.
- `tools/`의 `.mjs`는 **무의존성**(Node 표준 라이브러리만)으로 유지 — 게임/CI에서 `node skills/.../tool.mjs`로 직접 실행 가능해야 한다.
- 산출 문서·SKILL 본문은 한글(코드 식별자·태그 `FE-*`/`LD-*`/`MAP-*` 등은 영어 보존).

### Testing Requirements
- description 변경 후 자동 발동 회귀: 대표 한/영 프롬프트로 의도 트리거 확인(+ `scripts/detect-game-intent.js` 정규식과 정합).
- `tools/*.mjs` 변경: `node skills/wgf-item-architect/tools/lint-items.mjs <items.json>`, `node skills/wgf-level-designer/tools/*.mjs` 등 직접 실행 검증.

### Common Patterns
- 대부분 스킬은 `SKILL.md` + (선택)`reference/INDEX.md` 라우팅 + (선택)`tools/`. 인터뷰형 스킬(architect 계열)은 `reference/*-interview.md` 대본을 따른다.
- 게임 제작 게이트: 청사진 확인 → **서사 게이트(story-architect)** → **능력 게이트(ability-architect)** → **아이템 게이트(item-architect)** → **사운드 게이트(sound-architect)** → 빌드 (상세는 `commands/wgf-make-game.md`).

## Dependencies

### Internal
- 고급 킷 스킬 5종 ↔ `engine/*kit.js`(matter-physics·screen-fx·lighting-mood·path-motion·virtual-joystick).
- `sprite-picker`/`vector-graphics`/`sprite-forge`는 `assets.json`·`assets-library/library.json` 라이선스 게이트와 연동.
- `ip-license-guard`가 모든 에셋 경로의 최종 라이선스 게이트.

### External
- Phaser 4 정확도는 `wgf-web-game-builder/reference/phaser/`(공식 v4 스킬 벤더링, MIT)에서 가져온다.

<!-- MANUAL: -->
