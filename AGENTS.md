<!-- Generated: 2026-06-08 | Updated: 2026-06-15 -->

# WebGameForge (plugin id: `web-game-builder`)

## Purpose
**WebGameForge**는 "슈퍼마리오 게임 만들어줘" 같은 자연어 한 줄로 모바일 웹뷰에서 잘 도는 완성도 높은 2D 웹 게임을 자동 생성하는 **Claude Code 플러그인**이다. 검증된 엔진 스택(Phaser 4.1.0 + 절차적 에셋/사운드 + 모바일 하니스)과 27종의 전문 스킬을 조합해, 게임 제작 의도를 자동 감지하고 스프라이트 애니메이션·HUD·터치 컨트롤(디지털 D-패드+아날로그 가상조이스틱)·8비트 사운드까지 갖춘 게임을 벼려낸다. 에셋은 라이선스가 안전한 외부 에셋(CC0·표기형·허용 라이선스)을 적극 받아들이거나 절차적으로 생성하며, 상용 IP(닌텐도 등)는 쓰지 않는다.

> **WebGameForge** = 프로젝트/저장소 브랜드명. `web-game-builder` = 슬래시 커맨드·스킬 네임스페이스에 쓰는 플러그인 내부 식별자. 둘은 같은 것을 가리킨다.

## Key Files
| File | Description |
|------|-------------|
| `README.md` | 프로젝트 전체 소개·기능·스킬 카탈로그·검증 결과 (한글, 사실상의 메인 문서) |
| `assets.json` | 라이선스 게이트 매니페스트 — `policy.allow`/`denyAlways`로 에셋 라이선스를 기계 검증 + sprite-picker 카탈로그 포인터 |
| `LICENSE` | MIT |
| `.gitignore` | 무시 규칙 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `.claude-plugin/` | 플러그인·마켓플레이스 매니페스트 (see `.claude-plugin/AGENTS.md`) |
| `commands/` | 슬래시 커맨드 `/web-game-builder:wgf-make-game` (see `commands/AGENTS.md`) |
| `hooks/` | `UserPromptSubmit` 의도 감지 훅 등록 (see `hooks/AGENTS.md`) |
| `scripts/` | 한/영 게임 의도 감지 스크립트 3종 (see `scripts/AGENTS.md`) |
| `engine/` | 재사용 엔진 라이브러리 + vendored Phaser/Tone.js (see `engine/AGENTS.md`) |
| `editor/` | WGF Studio 비주얼 게임 에디터 — 브리지(단일 진실)+Preact UI+MCP+무빌드 export (see `editor/AGENTS.md`) |
| `skills/` | 30종 스킬 체계 — 장르·제작요소·품질·고급 킷 (see `skills/AGENTS.md`) |
| `games/` | 데모 게임 10종 + 에디터 트랙(scene.json) (see `games/AGENTS.md`) |
| `assets-library/` | 이전 사용 스프라이트 로컬 보관 (사용자 자산) (see `assets-library/AGENTS.md`) |
| `docs/` | 아키텍처 설계 명세 + 스크린샷 (see `docs/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **이 저장소는 "실행 가능한 게임 코드"가 아니라 "게임을 만드는 플러그인"이다.** 변경 시 항상 두 청중을 구분하라: (a) 플러그인을 쓰는 Claude(스킬·엔진·레퍼런스), (b) 생성된 게임의 최종 사용자(`games/`).
- **IP-safe가 1급 제약.** 닌텐도 등 상용 IP의 스프라이트·사운드·이름('Mario')·시그니처 조합(빨간모자+콧수염+멜빵+배관공)을 절대 코드/문서/에셋에 넣지 않는다. 메카닉·장르(옆스크롤·점프·코인)는 자유.
- **라이선스 안전 우선 원칙.** 라이선스가 안전한 외부 에셋은 적극 받아들인다 — CC0는 자유롭게, 표기형(CC-BY·OFL 등)은 `CREDITS.txt` 표기 시, MIT/BSD/Apache/Zlib 등 허용 라이선스는 `assets.json` 게이트(`policy.allow`)로 통과시킨다. `engine/`의 절차 생성기(PixelForge·VectorForge·ChipAudio)도 동등한 1급 옵션이다(매치되는 에셋이 없거나 빠르게 만들 때). ARR·정체불명·상용 IP(닌텐도 등)는 항상 차단(`policy.denyAlways`).
- 산출 문서는 한글 본문(코드 식별자·경로·라이브러리명은 영어 보존).
- 플러그인 매니페스트(`version`)를 바꿀 땐 `.claude-plugin/plugin.json`과 README 배지를 함께 갱신.

### Testing Requirements
- 플러그인 유효성: `claude plugin validate ./ --strict`
- 데모 실행: `python -m http.server 8766` → `http://127.0.0.1:8766/games/<slug>/index.html`
- 게임 동작 검증은 `game-qa` 스킬의 헤드리스 step 하니스로 결정적 검증(이동·충돌·메카닉).

### Common Patterns
- 게임 제작 흐름: **장르 스킬로 스캐폴드 → 제작요소 스킬로 살붙이기 → 품질 스킬로 검증·최적화**.
- 자동 트리거 3계층: ① SKILL.md description(의미 기반) → ② `UserPromptSubmit` 훅(결정론적 넛지) → ③ 슬래시 커맨드(명시적).
- 게임은 `games/<slug>/`에 `index.html` + `game.js`로 생성하고 `engine/`의 모듈을 `<script>`로 로드.

## Dependencies

### External
- **Phaser 4.1.0** (MIT, vendored `engine/phaser.min.js`) — 게임 엔진
- **Matter.js** — Phaser 4에 번들된 강체 물리(MatterKit이 래핑)
- **Node.js** — `scripts/detect-game-intent.js`(훅), `*.mjs` 도구 실행에 필요
- **Python** (선택) — 데모용 로컬 정적 서버

<!-- MANUAL: 수동 메모는 이 줄 아래에 추가하면 재생성 시 보존됩니다. -->
