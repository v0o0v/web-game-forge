<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# docs/

## Purpose
프로젝트의 **아키텍처 설계 명세**와 README용 스크린샷이 사는 곳. 기술 선택의 근거(엔진 비교·물리 선택)와 Tiled 연동 설계 같은 의사결정 기록을 담아, 왜 이렇게 만들었는지를 추적할 수 있게 한다.

## Key Files
| File | Description |
|------|-------------|
| `설계.md` | `web-game-builder` 설계 명세 — 목표·범위(2D 전용), 기술 선택 근거(Phaser 4 vs 후보 7종, Arcade vs Matter), 아키텍처 |
| `tiled-연동-설계.md` | Tiled `.tmj` 연동 설계 — 의사결정 기록(저작 업그레이드 우선·절차 베이커·데모 전략), 단일 타일셋 PNG 제약 해법 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `img/` | README/문서용 스크린샷(`title.png`·`gameplay.png`·`vectorforge.png`). 이미지 전용 |

## For AI Agents

### Working In This Directory
- **설계 문서는 의사결정 기록(ADR 성격)이다 — 구현이 바뀌면 근거 섹션을 갱신**한다(예: 엔진 버전, 물리 선택, Tiled 전략).
- README와 중복되는 사실(스킬 수·기능)은 README가 사용자용 요약, `docs/`가 상세·근거. 둘이 모순되지 않게 한다.
- 문서는 한글 본문(코드 식별자·라이브러리명 영어 보존).
- `img/`는 이미지 전용이라 별도 AGENTS.md를 두지 않는다 — 스크린샷 갱신 시 README 참조 경로 확인.

### Testing Requirements
- 문서 내 상대 링크(`skills/...`, `engine/...`)가 실제 경로를 가리키는지 확인.

### Common Patterns
- 의사결정 표(결정·선택·근거)로 트레이드오프를 기록하는 형식.

## Dependencies

### Internal
- README.md(루트)가 `docs/설계.md`를 "자세한 아키텍처"로 링크.
- `tiled-연동-설계.md` ↔ `engine/tiled.js`·`skills/wgf-level-designer/reference/tiled/authoring.md`.

### External
- 없음(순수 문서).

<!-- MANUAL: -->
