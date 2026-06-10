<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# wgf-web-game-builder/ (메인 오케스트레이터 스킬)

## Purpose
플러그인의 **메인 스킬**. "게임 만들어줘" 류 요청을 감지해 전체 제작 흐름을 조율한다 — 요청 명확화 인터뷰 → 청사진 확인 → 서사/아이템 게이트 → 장르 스캐폴드 → 제작요소 → 품질 검증. 단순 바닐라 JS가 아니라 스프라이트 애니메이션·HUD·모바일 터치·오디오 언락까지 포함한 Phaser 4 게임을 산출한다. 정확한 Phaser 4 API 사용과 인기 게임의 재미요소 조합을 위해 거대한 `reference/` 지식 라이브러리를 동반한다.

## Key Files
| File | Description |
|------|-------------|
| `SKILL.md` | 스킬 진입점 — 자동 발동 description(한/영 고밀도) + 오케스트레이션 워크플로 본문 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `reference/` | 게임 제작 지식 라이브러리(아래 분해) |
| `reference/phaser/` | **Phaser 공식 v4 에이전트 스킬 문서 28종 + INDEX.md** (MIT 벤더링). 씬·물리·스케일·입력·파티클·필터·v3→v4 마이그레이션. 라우팅은 `phaser/INDEX.md` |
| `reference/game-dna/` | 인기 2D 게임 35종 재미요소 분석(장르별 6파일) + `fun-elements.md`(재미요소 사전 21종·조합 레시피·안티패턴) + `INDEX.md` |
| `reference/game-dna/puzzle/` | 퍼즐 심화 — 20종 분석(낙하·매치병합·논리연역·공간물리 4하위장르 ×5) + 퍼즐 전용 재미요소 사전 + `INDEX.md` |

| Reference File | Description |
|----------------|-------------|
| `reference/engine-api.md` | `engine/` 모듈(PixelForge·VectorForge·ChipAudio·MobileHarness·TiledForge·킷 4종) API 계약 |
| `reference/mobile-webview.md` | 모바일 웹뷰 베스트프랙티스(스케일·DOM 가드·터치·오디오 언락) |
| `reference/game-interview.md` | 요청 명확화 인터뷰 대본(`deep-interview` 적응판 — 탑다운·조합주도·모호성 게이트) |

## For AI Agents

### Working In This Directory
- **이 스킬은 "조율"이 본업이다 — 세부 구현은 전문 스킬에 위임**한다(장르/제작요소/품질). 여기서 모든 걸 직접 하지 말 것.
- **Phaser 코드 생성 시 항상 `reference/phaser/`를 참조**해 v4 정확도를 확보한다. v3 API 혼용(코드생성 오류의 주원인)을 금지 — `phaser/INDEX.md`로 해당 토픽 파일을 라우팅.
- `reference/game-dna/`는 **메카닉·재미만** 차용한다(이름·캐릭터·스프라이트·음악 등 저작물 금지, IP-safe). 명확화 단계에서 "어떤 게임 만들지" 제안·조합에 사용.
- 인터뷰는 추상 객관식 1회로 끝내지 않는다 — `game-interview.md`의 탑다운·조합주도·모호성 해소까지 반복. 청사진을 한 화면으로 읽어주고 최종 확인 후 빌드.
- **서사 게이트·아이템 게이트를 반드시 묻는다**(story-architect / item-architect). 단, 작은 게임은 아이템 디폴트 0개를 먼저 안내(과설계 금지).
- `reference/` 벤더링 파일(특히 phaser/)은 **출처가 Phaser 공식**이므로 임의 개작보다 갱신/추가 위주로 다룬다.

### Testing Requirements
- 생성 게임은 부팅 콘솔 에러 0 + `game-qa` 헤드리스 검증.
- description/인터뷰 변경 시 한/영 대표 프롬프트로 자동 발동·게이트 흐름 회귀.

### Common Patterns
- 흐름: 의도 감지 → 인터뷰(필요 시) → 청사진 → 서사 게이트 → 아이템 게이트 → `games/<slug>/`에 빌드 → 검증.
- 빌드 산출: `games/<slug>/index.html` + `game.js`, `engine/`의 phaser·pixelforge·mobile 등 로드.

## Dependencies

### Internal
- 전 스킬(장르·제작요소·품질·킷), `engine/`(런타임), `commands/wgf-make-game.md`(명시 진입점), `scripts/detect-game-intent.js`(넛지).

### External
- Phaser 4.1.0. `reference/phaser/`는 Phaser 공식 v4 스킬(MIT) 벤더링.

<!-- MANUAL: -->
