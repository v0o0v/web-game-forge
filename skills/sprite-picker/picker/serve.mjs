#!/usr/bin/env node
/*
 * sprite-picker 컴패니언 서버 — 피커를 서빙하고 "선택 완료"를 파일로 받아낸다.
 *
 * 왜: 정적 `python -m http.server` 는 GET 만 되어 사용자가 자기 브라우저에서 고른 선택을
 * Claude 가 자동으로 가져올 수 없다(localStorage 는 브라우저별). 이 서버는 POST 를 받아
 * 선택 JSON 을 디스크에 저장하므로, 사용자가 "선택 완료"만 누르면 Claude 가 그 파일을 읽는다.
 *
 * 실행(프로젝트 루트에서):
 *   node skills/sprite-picker/picker/serve.mjs
 * 환경변수:
 *   PORT               기본 8770
 *   SPRITE_PICKER_OUT  선택 저장 경로 기본 <cwd>/.sprite-picker-selection.json
 *
 * 엔드포인트:
 *   GET  /                      → index.html (피커)
 *   GET  /<file>                → 피커 디렉터리 정적 파일(data.js 포함)
 *   POST /__sprite_picker_submit→ 본문(JSON)을 OUT 에 저장, {ok:true} 반환
 *   GET  /__sprite_picker_status→ 마지막 저장 여부/시각
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));     // 피커 디렉터리
const PORT = parseInt(process.env.PORT || '8770', 10);
const OUT = process.env.SPRITE_PICKER_OUT
  ? path.resolve(process.env.SPRITE_PICKER_OUT)
  : path.resolve(process.cwd(), '.sprite-picker-selection.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp'
};

let lastSavedAt = null;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  // CORS (사용자 브라우저가 다른 origin 이어도 안전하게)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && u.pathname === '/__sprite_picker_submit') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 5_000_000) req.destroy(); });
    req.on('end', () => {
      try {
        const obj = JSON.parse(body);
        fs.writeFileSync(OUT, JSON.stringify(obj, null, 2));
        lastSavedAt = new Date().toISOString();
        process.stderr.write(`[sprite-picker] 선택 저장됨 → ${OUT} (${lastSavedAt})\n`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, out: OUT, savedAt: lastSavedAt }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/__sprite_picker_status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, lastSavedAt, out: OUT }));
    return;
  }

  // 정적 서빙 (피커 디렉터리 내부로 제한)
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found: ' + rel); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  process.stderr.write(`[sprite-picker] http://127.0.0.1:${PORT}/  (선택 저장 경로: ${OUT})\n`);
});
