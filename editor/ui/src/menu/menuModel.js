/* ============================================================================
 * menuModel — WGF Studio 메뉴 구조 빌더
 * ----------------------------------------------------------------------------
 * buildMenus({ controller, settings, layoutApi, selection, undoDepth,
 *              redoDepth, mode, panelIds }) → menus[]
 *
 * MenuBar 가 받는 menus 배열을 반환. 모든 플러그인 기능(컨트롤러·에셋·스킬·
 * 레이아웃·환경설정)을 메뉴 항목으로 배선한다.
 *
 * 설계 원칙:
 *  - controller 메서드 직접 호출 가능한 건 직접 호출.
 *  - 폼/다단계가 필요한 건 layoutApi.showPanel 로 패널을 띄운다.
 *  - 모든 action 은 try/catch 로 감싸 에러가 메뉴를 깨지 않게.
 *  - controller.isRemote 가 false 면 remote 전용 기능은 disabled.
 * ==========================================================================*/

/** 패널 id → 표시 라벨 */
const PANEL_LABELS = {
  hierarchy: '계층',
  viewport: '뷰포트',
  inspector: '속성',
  assets: '에셋',
  skills: '스킬',
  chat: '챗',
};

/** 컴포넌트 15종 */
const COMPONENT_TYPES = [
  'Sprite', 'Body', 'TopDownController', 'AnimatedSprite', 'Shooter',
  'Projectile', 'EnemyAI', 'Health', 'ContactDamage', 'Pickup',
  'Spawner', 'CameraFollow', 'AbilityBinding', 'AudioEmitter', 'HUDBinding',
];

/** 결정형 스킬 5종 */
const DETERMINISTIC_SKILLS = [
  { tool: 'lint-scene',    label: 'lint-scene',    args: { file: 'current', json: true } },
  { tool: 'lint-rng',      label: 'lint-rng',      args: { file: 'current', json: true } },
  { tool: 'lint-juice',    label: 'lint-juice',    args: { file: 'current', json: true } },
  { tool: 'lint-kit-deps', label: 'lint-kit-deps', args: { json: true } },
  { tool: 'qa-score',      label: 'qa-score',      args: { target: 'current', json: true } },
];

/** 창작형 프리셋 */
const CREATIVE_PRESETS = [
  { label: '스토리 입혀줘', prompt: '이 게임에 어울리는 스토리·분위기를 입혀줘.' },
  { label: '능력 추가',     prompt: '플레이어에게 어울리는 능력(대시/발사 등)을 하나 추가해줘.' },
  { label: '적 다양화',     prompt: '적의 종류·행동(추격/순찰/사격)을 다양하게 만들어줘.' },
];

/** 테마 강조색 프리셋 */
const ACCENT_PRESETS = [
  { label: '시안  #4fd0ff', value: '#4fd0ff' },
  { label: '노랑  #ffd23f', value: '#ffd23f' },
  { label: '연두  #9bff8f', value: '#9bff8f' },
  { label: '빨강  #ff6b6b', value: '#ff6b6b' },
];

/** action 래퍼 — 예외가 메뉴 UI 를 깨지 않도록 */
function safe(fn) {
  return () => { try { fn(); } catch (e) { console.error('[WGF Menu]', e); } };
}

// ── 메뉴 섹션 빌더들 ──────────────────────────────────────────────────────────

function buildFileMenu(controller) {
  return {
    label: '파일',
    items: [
      {
        label: '저장',
        shortcut: 'Ctrl+S',
        action: safe(() => controller.save(true)),
      },
      {
        label: '저장본 불러오기',
        shortcut: 'Ctrl+Shift+S',
        action: safe(() => controller.reloadFromSaved()),
      },
      { type: 'separator' },
      {
        label: 'Export…',
        action: safe(() => {
          if (controller.isRemote) {
            controller.dispatchCreative('씬을 export 해줘. node editor/server/export.mjs <slug> CLI 를 사용해서.');
          } else {
            window.alert(
              'Export 방법:\n  node editor/server/export.mjs <slug>\n\n브리지 모드에서는 Claude 에게 요청해 자동 실행됩니다.'
            );
          }
        }),
      },
      {
        label: '프로젝트 목록',
        disabled: !controller.isRemote,
        action: safe(() => {
          controller.dispatchCreative('현재 프로젝트 목록을 보여줘.');
        }),
      },
    ],
  };
}

function buildEditMenu(controller, settings, selection, undoDepth, redoDepth) {
  const remote = controller.isRemote;
  // remote 는 깊이 미상(-1) → 버튼 항상 활성
  const canUndo = remote ? true : undoDepth > 0;
  const canRedo = remote ? true : redoDepth > 0;
  const hasSelection = selection && selection.length > 0;

  const snap = settings.get().snapDefault;
  const gizmoMode = controller.getGizmoMode ? controller.getGizmoMode() : 'move';

  return {
    label: '편집',
    items: [
      {
        label: '실행 취소',
        shortcut: 'Ctrl+Z',
        disabled: !canUndo,
        action: safe(() => controller.undo()),
      },
      {
        label: '다시 실행',
        shortcut: 'Ctrl+Y',
        disabled: !canRedo,
        action: safe(() => controller.redo()),
      },
      { type: 'separator' },
      {
        label: '엔티티 추가',
        action: safe(() =>
          controller.addEntity({
            name: '새 엔티티',
            transform: { x: 160, y: 120 },
            components: [{ type: 'Body', shape: 'aabb', w: 16, h: 16 }],
          })
        ),
      },
      {
        label: '선택 삭제',
        disabled: !hasSelection,
        action: safe(() => {
          // 다중 선택 전부 삭제(선택 배열은 삭제 중 갱신되므로 사본 순회).
          (selection || []).slice().forEach((id) => controller.removeEntity(id));
        }),
      },
      { type: 'separator' },
      {
        label: '스냅 토글',
        type: 'checkbox',
        checked: snap,
        action: safe(() => {
          const next = !settings.get().snapDefault;
          settings.set({ snapDefault: next });
          if (controller.setSnap) controller.setSnap(next, settings.get().snapSize);
        }),
      },
      {
        label: '기즈모',
        type: 'submenu',
        items: [
          {
            label: '이동',
            type: 'checkbox',
            checked: gizmoMode === 'move',
            action: safe(() => controller.setGizmoMode('move')),
          },
          {
            label: '회전',
            type: 'checkbox',
            checked: gizmoMode === 'rotate',
            action: safe(() => controller.setGizmoMode('rotate')),
          },
          {
            label: '스케일',
            type: 'checkbox',
            checked: gizmoMode === 'scale',
            action: safe(() => controller.setGizmoMode('scale')),
          },
        ],
      },
    ],
  };
}

function buildGameObjectMenu(controller, selection) {
  const hasSelection = selection && selection.length > 0;

  return {
    label: '게임오브젝트',
    items: [
      {
        label: '엔티티 추가',
        action: safe(() =>
          controller.addEntity({
            name: '새 엔티티',
            transform: { x: 160, y: 120 },
            components: [{ type: 'Body', shape: 'aabb', w: 16, h: 16 }],
          })
        ),
      },
      {
        label: '컴포넌트 추가',
        type: 'submenu',
        disabled: !hasSelection,
        items: COMPONENT_TYPES.map((type) => ({
          label: type,
          disabled: !hasSelection,
          action: safe(() => {
            // 선택된 모든 엔티티에 컴포넌트 추가(다중 선택 대응).
            (selection || []).forEach((id) => controller.addComponent(id, { type }));
          }),
        })),
      },
    ],
  };
}

function buildAssetsMenu(layoutApi) {
  return {
    label: '에셋',
    items: [
      {
        label: '절차 스프라이트 추가…',
        action: safe(() => layoutApi.showPanel('assets')),
      },
      {
        label: 'CC0 에셋 추가…',
        action: safe(() => layoutApi.showPanel('assets')),
      },
      {
        label: 'Unity 폴더 임포트…',
        action: safe(() => layoutApi.showPanel('assets')),
      },
      { type: 'separator' },
      {
        label: '에셋 목록 새로고침',
        action: safe(() => layoutApi.showPanel('assets')),
      },
    ],
  };
}

function buildSkillsMenu(controller, layoutApi) {
  const remote = controller.isRemote;

  return {
    label: '스킬',
    items: [
      {
        label: '결정형',
        type: 'submenu',
        items: DETERMINISTIC_SKILLS.map((s) => ({
          label: s.tool,
          disabled: !remote,
          action: safe(() => controller.runSkill(s.tool, s.args)),
        })),
      },
      {
        label: '창작형',
        type: 'submenu',
        items: [
          ...CREATIVE_PRESETS.map((c) => ({
            label: c.label,
            disabled: !remote,
            action: safe(() => controller.dispatchCreative(c.prompt)),
          })),
          { type: 'separator' },
          {
            label: 'Claude 에게 요청…',
            disabled: !remote,
            action: safe(() => {
              layoutApi.showPanel('skills');
              layoutApi.showPanel('chat');
            }),
          },
        ],
      },
    ],
  };
}

function buildRunMenu(controller, mode) {
  const isPlay = mode === 'play';
  return {
    label: '실행',
    items: [
      {
        label: isPlay ? '⏹ Stop' : '▶ Play',
        action: safe(() => controller.setMode(isPlay ? 'edit' : 'play')),
      },
    ],
  };
}

function buildViewMenu(controller, settings, layoutApi, panelIds) {
  const s = settings.get();
  const ids = Array.isArray(panelIds)
    ? panelIds
    : ['hierarchy', 'viewport', 'inspector', 'assets', 'skills', 'chat'];

  // 패널 토글 체크박스 항목
  const panelItems = ids.map((id) => ({
    label: PANEL_LABELS[id] || id,
    type: 'checkbox',
    checked: layoutApi.isVisible(id),
    action: safe(() => layoutApi.togglePanel(id)),
  }));

  // 폰트 크기 서브메뉴
  const fontItems = [
    {
      label: '크게 (+)',
      shortcut: 'Ctrl++',
      action: safe(() => settings.increaseFont()),
    },
    {
      label: '작게 (−)',
      shortcut: 'Ctrl+-',
      action: safe(() => settings.decreaseFont()),
    },
    {
      label: '기본 (13px)',
      action: safe(() => settings.resetFont()),
    },
    { type: 'separator' },
    { label: '작게 11px',    action: safe(() => settings.set({ fontSize: 11 })) },
    { label: '보통 13px',    action: safe(() => settings.set({ fontSize: 13 })) },
    { label: '크게 16px',    action: safe(() => settings.set({ fontSize: 16 })) },
    { label: '매우 크게 20px', action: safe(() => settings.set({ fontSize: 20 })) },
  ];

  // 테마 강조색 서브메뉴
  const accentItems = ACCENT_PRESETS.map((p) => ({
    label: p.label,
    type: 'checkbox',
    checked: s.accent === p.value,
    action: safe(() => settings.set({ accent: p.value })),
  }));

  // 밀도 서브메뉴
  const densityItems = [
    {
      label: '편안함',
      type: 'checkbox',
      checked: s.density === 'comfortable',
      action: safe(() => settings.set({ density: 'comfortable' })),
    },
    {
      label: '조밀함',
      type: 'checkbox',
      checked: s.density === 'compact',
      action: safe(() => settings.set({ density: 'compact' })),
    },
  ];

  return {
    label: '보기',
    items: [
      ...panelItems,
      { type: 'separator' },
      {
        label: '레이아웃 리셋',
        action: safe(() => layoutApi.resetLayout()),
      },
      { type: 'separator' },
      {
        label: '폰트 크기',
        type: 'submenu',
        items: fontItems,
      },
      {
        label: '테마 강조색',
        type: 'submenu',
        items: accentItems,
      },
      {
        label: '밀도',
        type: 'submenu',
        items: densityItems,
      },
    ],
  };
}

function buildHelpMenu() {
  return {
    label: '도움말',
    items: [
      {
        label: 'WGF Studio 정보',
        action: safe(() =>
          window.alert(
            'WGF Studio — WebGameForge 브라우저 게임 에디터\n' +
            'Preact + SceneKit + Phaser 기반 선언형 씬 에디터.\n' +
            'GitHub: v0o0v/JSGameEngineForCC'
          )
        ),
      },
      {
        label: '단축키',
        action: safe(() =>
          window.alert(
            '주요 단축키\n' +
            '  Ctrl+S       저장\n' +
            '  Ctrl+Shift+S 저장본 불러오기\n' +
            '  Ctrl+Z       실행 취소\n' +
            '  Ctrl+Y       다시 실행\n' +
            '  Esc          메뉴 닫기\n' +
            '  Del          선택 엔티티 삭제(인스펙터)\n'
          )
        ),
      },
      {
        label: '문서',
        action: safe(() =>
          window.alert(
            '에디터 스킬 문서:\n  skills/wgf-editor/SKILL.md\n\n' +
            '브리지 실행:\n  node editor/server/bridge.mjs\n\n' +
            '빌드:\n  node editor/ui/build.mjs'
          )
        ),
      },
    ],
  };
}

// ── 메인 빌더 ─────────────────────────────────────────────────────────────────

/**
 * 에디터 메뉴 배열 빌드.
 *
 * @param {{
 *   controller: object,        // editorController 인스턴스
 *   settings: object,          // createEditorSettings() 반환값
 *   layoutApi: {               // 리드가 제공하는 레이아웃 API
 *     isVisible(id: string): boolean,
 *     showPanel(id: string): void,
 *     hidePanel(id: string): void,
 *     togglePanel(id: string): void,
 *     resetLayout(): void,
 *   },
 *   selection: string[],       // 현재 선택 엔티티 id 배열
 *   undoDepth: number,         // local Undo 깊이 (remote 는 -1)
 *   redoDepth: number,         // local Redo 깊이 (remote 는 -1)
 *   mode: 'edit'|'play',       // 현재 에디터 모드
 *   panelIds?: string[],       // 패널 id 목록 (기본: 6개)
 * }} params
 * @returns {Array<{label: string, items: MenuItem[]}>}
 */
export function buildMenus({
  controller,
  settings,
  layoutApi,
  selection,
  undoDepth,
  redoDepth,
  mode,
  panelIds,
}) {
  return [
    buildFileMenu(controller),
    buildEditMenu(controller, settings, selection, undoDepth, redoDepth),
    buildGameObjectMenu(controller, selection),
    buildAssetsMenu(layoutApi),
    buildSkillsMenu(controller, layoutApi),
    buildRunMenu(controller, mode),
    buildViewMenu(controller, settings, layoutApi, panelIds),
    buildHelpMenu(),
  ];
}
