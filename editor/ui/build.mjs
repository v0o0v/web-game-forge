#!/usr/bin/env node
/* ============================================================================
 * WGF Studio UI 빌드 (esbuild) — P1
 * ----------------------------------------------------------------------------
 * editor/ui/src/main.jsx 를 dist/bundle.js 로 번들. JSX 는 esbuild 가 Preact
 * pragma(h/Fragment)로 트랜스폼한다. 이 빌드는 **editor/ui 셸에만** 닿고
 * 엔진(engine/*.js)·게임 산출물은 무빌드 <script> 로 유지된다(설계서 §3.3).
 *
 *   node build.mjs            # 1회 빌드
 *   node build.mjs --watch    # 변경 감지 재빌드
 * ==========================================================================*/
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(ROOT, 'src', 'main.jsx')],
  bundle: true,
  outfile: path.join(ROOT, 'dist', 'bundle.js'),
  format: 'iife',
  target: ['es2018'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  // prod(1회 빌드)=minify 켜고 sourcemap 끔(번들 경량). watch(개발)=minify 끄고 sourcemap 유지(디버깅).
  minify: !watch,
  sourcemap: watch,
  logLevel: 'info',
  // SceneKit·SceneKitPhaser·Phaser 는 index.html 의 <script> 전역으로 로드되므로
  // 번들에 포함하지 않는다(무빌드 엔진 경계 보존). 셸은 window.* 로 접근.
  // (esbuild 는 import 가 없으면 external 지정 불요 — 셸은 전역 참조만 한다.)
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  process.stderr.write('[wgf-ui] watch 모드 — 변경 감지 중\n');
} else {
  await esbuild.build(options);
  process.stderr.write('[wgf-ui] 빌드 완료 → dist/bundle.js\n');
}
