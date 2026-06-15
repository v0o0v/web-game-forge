<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-15 | Updated: 2026-06-15 -->

# editor/ui/src/menu/

## Purpose
에디터 상단 **메뉴바**. 일반 에디터 기능(폰트 크기·테마·밀도·레이아웃 리셋)과 플러그인 기능(스킬 2트랙·에셋·컴포넌트·Play/Export·보기/도움말)을 모두 노출한다. 메뉴는 순수 빌더라 매 렌더 최신 상태(selection·mode·undo·settings)를 반영한다.

## Key Files
| File | Description |
|------|-------------|
| `menuModel.js` | `buildMenus({controller, settings, layoutApi, selection, undoDepth, redoDepth, mode, panelIds})` — 파일/편집/게임오브젝트/에셋/스킬/실행/보기/도움말 메뉴를 데이터로 빌드(순수). 단축키 라벨 포함 |
| `MenuBar.jsx` | 메뉴 데이터 렌더 + 드롭다운 상호작용 |

## For AI Agents

### Working In This Directory
- **`menuModel.js` 는 순수 빌더로 유지**(부수효과는 항목 `onClick` 에서 controller/settings/layoutApi 호출). 매 렌더 재호출되므로 무거운 계산 금지.
- 단축키를 메뉴에 표기하면 `main.jsx` 전역 키 핸들러와 **실제 바인딩이 일치**해야 한다(표기만 하고 미바인딩 금지).
- 새 기능 노출은 적절한 메뉴 그룹에 항목 추가 + 비활성 조건(예: selection 없음) 반영.

### Testing Requirements
- 빌드 성공 + 브라우저에서 각 메뉴 항목 동작(특히 보기=패널 토글, 편집=undo/redo, 실행=Play/Export).

### Common Patterns
- 항목: `{ label, shortcut?, disabled?, onClick }`. 체크 상태(테마/밀도/스냅/패널 표시)는 settings/layout 미러에서 파생.

## Dependencies

### Internal
- `editorController.js`·`editorSettings.js`·`dock/`(layoutApi). 단축키는 `main.jsx` 전역 핸들러와 짝.

### External
- **preact/hooks** 만.

<!-- MANUAL: -->
