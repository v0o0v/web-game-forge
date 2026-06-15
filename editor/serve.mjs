#!/usr/bin/env node
/* ============================================================================
 * WGF Studio dev 서버 — zero-dep Node http 정적 서빙 (P1)
 * ----------------------------------------------------------------------------
 * skills/wgf-sprite-picker/picker/serve.mjs 패턴을 따른다(127.0.0.1 전용 바인딩,
 * path.resolve 후 prefix 검사로 ../ traversal 거부). P2 브리지의 정적 서빙 전신.
 *
 * 리포 루트 기준으로 editor/·engine/·games/ 를 서빙한다. 에디터 셸은
 * editor/ui/dist/bundle.js + editor/ui/index.html 을, 뷰포트는 ../../engine/*.js 와
 * ../../games/_editor-samples/.../scene.json 을 상대 경로로 로드하므로 루트 기준
 * 한 origin 에서 전부 접근 가능해야 한다.
 *
 * 실행(프로젝트 루트에서):
 *   node editor/serve.mjs [port]      # 기본 5174
 *   PORT=5200 node editor/serve.mjs
 *   WGF_NO_OPEN=1 node editor/serve.mjs   # 브라우저 자동 실행 끄기
 * 기동 완료 시 기본 브라우저로 http://127.0.0.1:<port>/editor/ui/ 를 자동으로 연다.
 *
 * 보안(설계서 §6):
 *   - 127.0.0.1 전용 바인딩(0.0.0.0 금지 — LAN 비노출).
 *   - 모든 파일 경로를 리포 루트로 정규화 후 prefix 검사, ../ traversal 거부.
 *   - 닷파일/닷디렉터리(.git/.env 등) 차단.
 * ==========================================================================*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVE_DIR = path.dirname(fileURLToPath(import.meta.url));   // editor/
const REPO_ROOT = path.resolve(SERVE_DIR, '..');                 // 리포 루트(서빙 루트)
const PORT = parseInt(process.argv[2] || process.env.PORT || '5174', 10);
const HOST = '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

// 리포 루트 안에서만 서빙(traversal 가드). rel = URL 경로(루트 기준).
function serveStatic(res, rel) {
  if (rel === '' || rel === '/') rel = '/editor/ui/index.html';
  let decoded;
  try { decoded = decodeURIComponent(rel); }
  catch { res.writeHead(400); res.end('bad request'); return; }

  // 닷세그먼트(.git·.env 등) 차단 — '..' 도 여기서 1차 차단.
  const segs = decoded.split(/[\\/]+/).filter(Boolean);
  if (segs.some((s) => s.startsWith('.'))) {
    res.writeHead(403); res.end('forbidden'); return;
  }

  let filePath = path.normalize(path.join(REPO_ROOT, decoded));
  // prefix 검사: 루트 자신이거나 루트 + path.sep 하위만 허용.
  if (filePath !== REPO_ROOT && !filePath.startsWith(REPO_ROOT + path.sep)) {
    res.writeHead(403); res.end('forbidden'); return;
  }

  fs.stat(filePath, (statErr, st) => {
    if (statErr) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found: ' + rel); return; }
    // 디렉터리 요청 → index.html 폴백.
    if (st.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found: ' + rel); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    });
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('method not allowed');
    return;
  }
  serveStatic(res, u.pathname);
});

// 기동 완료 시 기본 브라우저로 에디터 URL 을 연다(execFile, 셸 미경유). 생략 조건:
//   - WGF_NO_OPEN 설정 : 명시 옵트아웃
//   - PORT=0           : 임의 포트(자동화/스크립트)
// 실패는 비치명적 — 브라우저가 없거나 헤드리스여도 서버는 계속 뜬다.
function maybeOpenBrowser(url) {
  if (process.env.WGF_NO_OPEN) return;
  if (String(process.argv[2] || process.env.PORT) === '0') return;
  let cmd, args;
  if (process.platform === 'win32')       { cmd = process.env.ComSpec || 'cmd.exe'; args = ['/c', 'start', '', url]; }
  else if (process.platform === 'darwin') { cmd = 'open';                            args = [url]; }
  else                                    { cmd = 'xdg-open';                        args = [url]; }
  try {
    execFile(cmd, args, { windowsHide: true }, (err) => {
      if (err) process.stderr.write(`[wgf-editor] 브라우저 자동 실행 실패(무시) — 수동으로 ${url} 여세요\n`);
    });
  } catch (e) {
    process.stderr.write(`[wgf-editor] 브라우저 자동 실행 예외(무시): ${String(e)}\n`);
  }
}

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/editor/ui/`;
  process.stderr.write(`[wgf-editor] dev 서버 기동 → ${url}\n`);
  process.stderr.write(`[wgf-editor] 서빙 루트: ${REPO_ROOT}\n`);
  maybeOpenBrowser(url);
});

server.on('error', (e) => {
  process.stderr.write(`[wgf-editor] 서버 오류: ${String(e)}\n`);
  process.exit(1);
});
