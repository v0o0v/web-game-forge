#!/usr/bin/env node
/* ============================================================================
 * verify-tiled-pack — 외부 CC0 Tiled 팩 라이선스 게이트 검증기 (무의존성 Node)
 * ----------------------------------------------------------------------------
 * 외부 Tiled 팩(타일셋 이미지 + .tmj + pack.json 매니페스트)을 게임에 들이기 전,
 * 루트 assets.json 의 정책으로 라이선스를 게이트한다. 정책 위반이면 exit 1.
 *
 * 게이트 규칙(assets.json.policy 단일 소스, engine/tiled.js assertPackLicense 공유):
 *   - license ∈ policy.allow         → 허용 (CC0/MIT/BSD/Apache/Zlib …)
 *   - license ∈ policy.denyAlways    → 거부 (ARR/Nintendo/unknown)
 *   - CC-BY 류 + ccByRequiresAttribution=true → manifest.attribution 있어야 허용
 *
 * 사용:
 *   node verify-tiled-pack.mjs <pack.json> [assets.json]
 *   node verify-tiled-pack.mjs <pack.json> --register   # 통과 시 assets.json entries 에 등록
 *
 * pack.json 매니페스트 형식:
 *   {
 *     "name": "forge-gpu-pack",
 *     "license": "CC0-1.0",
 *     "attribution": "WebGameForge 절차 생성 (CC0)",   // CC-BY 류면 필수
 *     "source": "WebGameForge bake-tiled-pack.mjs",
 *     "tileset": "tileset.png",   // 팩 폴더 기준 상대경로
 *     "map": "level.tmj",
 *     "tilesetName": "forge",
 *     "usedIn": "games/tiled-pack"
 *   }
 * ==========================================================================*/
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const TiledForge = require('../../../engine/tiled.js');

const ROOT = path.resolve(import.meta.dirname, '../../..');

async function readJson(p) { return JSON.parse(await readFile(p, 'utf8')); }

export async function verifyPack(packPath, assetsPath) {
  const manifest = await readJson(packPath);
  const assets = await readJson(assetsPath);
  const policy = assets.policy || {};
  const verdict = TiledForge.assertPackLicense(policy, manifest);
  return { manifest, assets, assetsPath, verdict };
}

async function registerEntry({ manifest, assets, assetsPath }, packPath) {
  const packDir = path.relative(ROOT, path.dirname(path.resolve(packPath))).replace(/\\/g, '/');
  const url = manifest.tileset ? `${packDir}/${manifest.tileset}` : packDir;
  assets.entries = assets.entries || [];
  const existing = assets.entries.find(e => e.name === manifest.name);
  const entry = {
    name: manifest.name,
    type: 'tiled-pack',
    source: manifest.source || 'external',
    license: manifest.license,
    url,
    usedIn: manifest.usedIn || ''
  };
  if (manifest.attribution) entry.attribution = manifest.attribution;
  if (existing) Object.assign(existing, entry);
  else assets.entries.push(entry);
  await writeFile(assetsPath, JSON.stringify(assets, null, 2) + '\n', 'utf8');
  return entry;
}

async function main() {
  const args = process.argv.slice(2);
  const packPath = args[0];
  const register = args.includes('--register');
  const assetsArg = args.find((a, i) => i > 0 && !a.startsWith('--'));
  if (!packPath) {
    console.error('사용: node verify-tiled-pack.mjs <pack.json> [assets.json] [--register]');
    process.exit(2);
  }
  const assetsPath = assetsArg ? path.resolve(assetsArg) : path.join(ROOT, 'assets.json');
  const ctx = await verifyPack(path.resolve(packPath), assetsPath);
  const { manifest, verdict } = ctx;

  console.log(`팩: ${manifest.name}  라이선스: ${manifest.license}`);
  if (!verdict.allowed) {
    console.error(`✗ 게이트 거부 — ${verdict.reason}`);
    process.exit(1);
  }
  console.log(`✓ 게이트 통과 — ${verdict.reason}` + (verdict.requiresAttribution ? `  (attribution: ${manifest.attribution})` : ''));
  if (register) {
    const entry = await registerEntry(ctx, path.resolve(packPath));
    console.log(`✓ assets.json 등록 — ${entry.name} → ${entry.url}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
