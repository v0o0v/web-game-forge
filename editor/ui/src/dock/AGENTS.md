<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-15 | Updated: 2026-06-15 -->

# editor/ui/src/dock/

## Purpose
유니티식 **자유배치 도킹 레이아웃**. 패널(계층·뷰포트·속성·에셋·스킬·챗)을 스플릿·탭화·드래그 리다킹·리사이즈할 수 있고 배치는 localStorage(`wgf-studio-layout`)에 영속된다. dockview/golden-layout 같은 React 지향 라이브러리 대신, 우리 스택(Preact + 무빌드 + prop 구동)에 깔끔히 맞는 **커스텀 Preact-네이티브 도킹을 새 npm 의존 0으로 직접 구현**했다.

## Key Files
| File | Description |
|------|-------------|
| `dockModel.js` | 레이아웃 트리 모델(순수 함수) — split/tabs 노드, 정규화(`normalizeLayout`)·직렬화·패널 추가/제거·`isPanelVisible`. 패널 집합 불일치/손상 자동 흡수 |
| `DockLayout.jsx` | 트리 렌더 + 포인터 기반 드래그 리다킹·리사이저. 탭 전환은 **display 토글**(unmount 아님 — Phaser 캔버스/챗 스크롤 보존), DOM 부모 변경은 드래그 리다킹 때만 |

## For AI Agents

### Working In This Directory
- **드롭 대상은 경로가 아니라 마커(`__drop`)로 식별**한다 — 드래그 패널 제거로 형제 그룹이 붕괴/평탄화되면 인덱스가 시프트돼 경로 기반은 엉뚱한 그룹에 오도킹(코드리뷰 HIGH 교훈). 단일패널 그룹 자기드롭은 no-op.
- 패널 본문은 `main.jsx` 의 `panels` 레지스트리(매 렌더 최신 props 클로저)가 `render()` 로 제공 — DockLayout 은 배치만, 컴포넌트 생성은 레지스트리.
- 레이아웃 변경은 항상 `normalizeLayout` 거쳐 영속(손상/불일치 방어).

### Testing Requirements
- 브라우저 e2e 드래그: 합성 PointerEvent. **드롭 좌표를 뷰포트 중앙(Phaser 캔버스)으로 잡지 말 것** — 캔버스가 포인터를 흡수해 유령 엔티티 생성. 사이드 패널로 드롭. 탭 라벨엔 아이콘 프리픽스(`🖼 에셋`) 포함 → 매칭은 `includes`.
- 빌드 성공 + 배치 영속(localStorage) 라운드트립 확인.

### Common Patterns
- 미지원: 플로팅(분리 창). 패널 표시/숨김은 메뉴바 "보기"(`layoutApi.togglePanel`).

## Dependencies

### Internal
- `main.jsx`(panels 레지스트리·layoutApi), 영속 키 `wgf-studio-layout`.

### External
- **preact/hooks** 만.

<!-- MANUAL: -->
