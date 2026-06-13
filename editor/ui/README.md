# WGF Studio UI 셸 (editor/ui)

WGF Studio 브라우저 게임 에디터의 **UI 셸**이다(P1 단계). Preact + esbuild 로 빌드되며,
이 디렉터리에만 npm 의존이 격리된다 — 엔진(`engine/*.js`)·게임 산출물은 무빌드 `<script>` 로 유지된다(루트 무빌드 불변식).

## 구조

| 파일 | 역할 |
|------|------|
| `package.json` | esbuild·preact devDeps. `npm run build` 스크립트. |
| `build.mjs` | esbuild 빌드 스크립트(JSX → Preact, IIFE 번들 → `dist/bundle.js`). |
| `index.html` | 엔진 vendored `<script>` 로드(phaser→pixelforge→vectorforge→audio→mobile→rngforge→scenekit→scenekit-components→scenekit-phaser) 후 `dist/bundle.js`. |
| `src/main.jsx` | 앱 진입점. 레이아웃 조립 + `window.WGFEditor` API 노출. |
| `src/editorController.js` | scenekit-phaser 어댑터 래퍼. Undo/Redo 스택·Save/Load(localStorage + 다운로드). |
| `src/Viewport.jsx` | scenekit-phaser 어댑터를 마운트해 현재 씬 t=0 표시. |
| `src/Hierarchy.jsx` | 엔티티 트리(선택·다중선택). |
| `src/Inspector.jsx` | 선택 엔티티의 transform + 컴포넌트를 `inspectorFields` 로 자동 폼 생성. |
| `src/Toolbar.jsx` | 기즈모 토글·스냅·Undo/Redo·Save·엔티티 추가·Play/Edit. |

`node_modules/` 와 `dist/` 는 `.gitignore` 로 커밋 제외(재생성 가능).

## 빌드

프로젝트 루트가 아니라 **이 디렉터리에서** 실행한다.

```
cd editor/ui
```

의존 설치(최초 1회):

```
npm install
```

번들 빌드(`dist/bundle.js` 생성):

```
npm run build
```

변경 감지 재빌드(개발 중):

```
npm run watch
```

## 실행

빌드 후, **프로젝트 루트에서** dev 서버를 기동한다(zero-dep, 127.0.0.1 전용):

```
node editor/serve.mjs 5174
```

브라우저에서 다음 주소를 연다:

```
http://127.0.0.1:5174/editor/ui/
```

기본으로 `games/_editor-samples/topdown-min/scene.json` 이 자동 로드된다.

## window.WGFEditor 프로그래매틱 API (e2e 검증용)

브라우저 콘솔에서 다음으로 에디터를 조작할 수 있다(리드가 chrome-devtools 로 게이트 검증).

| 메서드 | 설명 |
|--------|------|
| `loadScene(doc)` | 씬 로드(어댑터 재마운트). |
| `serialize()` | 현재 scene.json(serialize 결과 + wgf-scene@1 래퍼) 반환. |
| `hash()` | `SceneKit.hashState(world)` 반환(라운드트립 비교용). |
| `addEntity(partial)` | 엔티티 추가(applyCommand addEntity), 새 id 반환. |
| `setTransform(id, patch)` | applyCommand setTransform. |
| `select(ids)` / `getSelection()` | 선택 교체/조회. |
| `undo()` / `redo()` / `undoDepth()` | Undo/Redo 스택 조작(최소 50단계, 기본 200). |
| `save()` | localStorage 저장 + 직렬화 반환(API 경유는 파일 다운로드 없음). |
| `reloadFromSaved()` | localStorage 에서 재로드(어댑터 재마운트). |
| `entityCount()` | 현재 엔티티 수. |

### 예: 10엔티티 라운드트립

```js
for (let i = 0; i < 10; i++) WGFEditor.addEntity({ name: 'e'+i, transform: { x: 20+i*10, y: 40 } });
WGFEditor.save();
const h1 = WGFEditor.hash();
WGFEditor.reloadFromSaved();
const h2 = WGFEditor.hash();
console.log('hash 동일?', h1 === h2, h1, h2);
```

### 예: Undo/Redo 10단계

```js
const h0 = WGFEditor.hash();
for (let i = 0; i < 10; i++) WGFEditor.addEntity({ name: 'u'+i });
const hN = WGFEditor.hash();
for (let i = 0; i < 10; i++) WGFEditor.undo();
console.log('undo 복원?', WGFEditor.hash() === h0);
for (let i = 0; i < 10; i++) WGFEditor.redo();
console.log('redo 일치?', WGFEditor.hash() === hN);
```

## 주의

- 셸은 `window.SceneKit` / `window.SceneKitPhaser` 전역만 참조한다(엔진 import 금지 — 무빌드 경계).
- 모든 씬 상태 변경은 어댑터의 `applyCommand`(= `SceneKit.applyCommand`)로만 이뤄진다(Undo 일관성).
- 디스크 파일 저장은 P2(브리지) 범위다. P1 Save 는 localStorage + 다운로드까지다.
