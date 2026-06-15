/* ============================================================================
 * AssetBrowser — 에셋 패널(통합 스프라이트 브라우저 진입점)
 * ----------------------------------------------------------------------------
 * 본문은 SpriteBrowser(탭 3개: 라이브러리/카탈로그/씬에셋)로 교체됐다.
 * export 이름 AssetBrowser 는 유지(main.jsx panels.assets 가 그대로 렌더).
 *
 * 기존 절차/CC0-URL/Unity 임포트 어더(ProceduralDefiner·Cc0Adder·UnityFolderImporter)는
 * "씬에셋" 탭에 보존하기 위해 SpriteBrowser 에 importers prop 으로 주입한다.
 * (기존 "CC0 갤러리 열기(Claude 디스패치)" 버튼은 제거 — SpriteBrowser 가 "카탈로그에서
 *  찾기"로 대체. Cc0Adder 는 URL 직접 추가만 남긴다.)
 *
 * remote(브리지)에서만 활성. local(P1)에선 비활성 안내(SpriteBrowser 내부 처리).
 * ========================================================================== */
import { useState } from 'preact/hooks';
import { SpriteBrowser } from './sprite/SpriteBrowser.jsx';

export function AssetBrowser({ controller, selection }) {
  // 씬에셋 탭에 주입할 기존 어더들.
  return (
    <SpriteBrowser
      controller={controller}
      selection={selection}
      importers={{ ProceduralDefiner, Cc0Adder, UnityFolderImporter }}
    />
  );
}

// ── 절차 스프라이트 디파이너(기존 보존) ────────────────────────────────────────
function ProceduralDefiner({ controller, onDone }) {
  const [id, setId] = useState('');
  const [desc, setDesc] = useState('');
  const [w, setW] = useState(16);
  const [h, setH] = useState(16);
  const [busy, setBusy] = useState(false);

  async function add() {
    const sid = id.trim();
    if (!sid) return;
    setBusy(true);
    let r;
    try { r = await controller.addProceduralAsset({ id: sid, desc: desc.trim(), w: +w, h: +h }); }
    catch (e) { r = { ok: false, error: String(e) }; }
    setBusy(false);
    onDone(r && r.ok ? `절차 스프라이트 "${sid}" 추가됨 ✓` : ('추가 실패: ' + (r && r.error || '')));
  }

  return (
    <div style={form}>
      <div style={formTitle}>절차 스프라이트 디파이너</div>
      <input style={finp} placeholder="id (예: spr_hero)" value={id} onInput={(e) => setId(e.target.value)} />
      <input style={finp} placeholder="설명(스프라이트 묘사 — 베이크 힌트)" value={desc} onInput={(e) => setDesc(e.target.value)} />
      <div style={{ display: 'flex', gap: '4px' }}>
        <input style={finp} type="number" min="1" value={w} onInput={(e) => setW(e.target.value)} title="너비" />
        <input style={finp} type="number" min="1" value={h} onInput={(e) => setH(e.target.value)} title="높이" />
      </div>
      <button style={okBtn} disabled={busy || !id.trim()} onClick={add}>추가</button>
    </div>
  );
}

// ── CC0 URL 직접 추가(기존 Cc0Adder 의 URL 탭만 보존) ──────────────────────────
function Cc0Adder({ controller, onDone }) {
  const [id, setId] = useState('');
  const [url, setUrl] = useState('');
  const [credit, setCredit] = useState('');
  const [busy, setBusy] = useState(false);

  async function addUrl() {
    const sid = id.trim(); const u = url.trim();
    if (!sid || !u) return;
    setBusy(true);
    let r;
    try { r = await controller.addCc0Asset({ id: sid, url: u, license: 'CC0-1.0', credit: credit.trim() }); }
    catch (e) { r = { ok: false, error: String(e) }; }
    setBusy(false);
    onDone(r && r.ok ? `CC0 스프라이트 "${sid}" 추가됨 ✓` : ('추가 실패: ' + (r && r.error || '')));
  }

  return (
    <div style={form}>
      <div style={formTitle}>CC0 URL 직접 추가</div>
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>
        CC0 이미지 URL 을 직접 등록합니다. 팩 탐색·다운로드는 "카탈로그" 탭을 사용하세요.
      </div>
      <input style={finp} placeholder="id (예: spr_kenney_coin)" value={id} onInput={(e) => setId(e.target.value)} />
      <input style={finp} placeholder="CC0 이미지 URL" value={url} onInput={(e) => setUrl(e.target.value)} />
      <input style={finp} placeholder="출처(credit, 선택)" value={credit} onInput={(e) => setCredit(e.target.value)} />
      <button style={okBtn} disabled={busy || !id.trim() || !url.trim()} onClick={addUrl}>추가(CC0-1.0)</button>
    </div>
  );
}

// ── Unity 폴더 임포트 위저드(기존 보존) ────────────────────────────────────────
// 스텝1(스캔) → 스텝2(검토·선택·attestation) → 가져오기.
function UnityFolderImporter({ controller, onDone }) {
  const [folder, setFolder] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);   // {ok, items, truncated, ...}
  const [scanError, setScanError] = useState('');
  const [rowState, setRowState] = useState({});
  const [importing, setImporting] = useState(false);

  function initRowState(items) {
    const s = {};
    for (const it of items) {
      s[it.relPath] = {
        checked: it.status !== 'blocked',
        id: it.suggestedId || '',
        attested: { checked: false, owner: '', license: 'user-owned' }
      };
    }
    setRowState(s);
  }

  async function doScan() {
    const f = folder.trim();
    if (!f) return;
    setScanning(true);
    setScanError('');
    setScanResult(null);
    let r;
    try { r = await controller.scanUnityFolder(f); }
    catch (e) { r = { ok: false, error: String(e) }; }
    setScanning(false);
    if (!r || !r.ok) { setScanError(r && r.error ? r.error : '스캔 실패'); return; }
    setScanResult(r);
    initRowState(r.items || []);
  }

  function updateRow(relPath, patch) {
    setRowState(prev => ({ ...prev, [relPath]: { ...prev[relPath], ...patch } }));
  }
  function updateAttested(relPath, patch) {
    setRowState(prev => ({
      ...prev,
      [relPath]: { ...prev[relPath], attested: { ...prev[relPath].attested, ...patch } }
    }));
  }

  function computeSelections() {
    if (!scanResult) return { selections: [], warnUnmet: 0 };
    const selections = [];
    let warnUnmet = 0;
    for (const it of scanResult.items) {
      const rs = rowState[it.relPath];
      if (!rs || !rs.checked) continue;
      if (it.status === 'blocked') continue;
      if (it.status === 'warn') {
        const a = rs.attested;
        if (!a.checked || !a.owner.trim() || !a.license) { warnUnmet++; continue; }
        selections.push({ relPath: it.relPath, id: rs.id || it.suggestedId,
          attested: { owner: a.owner.trim(), declaredLicense: a.license } });
      } else {
        selections.push({ relPath: it.relPath, id: rs.id || it.suggestedId });
      }
    }
    return { selections, warnUnmet };
  }

  async function doImport() {
    const { selections, warnUnmet } = computeSelections();
    if (warnUnmet > 0 || selections.length === 0) return;
    setImporting(true);
    let r;
    try { r = await controller.importUnityAssets(folder.trim(), selections); }
    catch (e) { r = { ok: false, error: String(e) }; }
    setImporting(false);
    if (!r || !r.ok) { onDone('임포트 실패: ' + (r && r.error || '')); return; }
    const addedN = (r.added || []).length;
    const rejN = (r.rejected || []).length;
    let msg = addedN + '개 추가';
    if (rejN > 0) {
      const reasons = (r.rejected || []).slice(0, 3).map(x => x.relPath + ': ' + x.reason).join(' / ');
      msg += ' / ' + rejN + '개 거부(' + reasons + (rejN > 3 ? '…' : '') + ')';
    }
    onDone(msg + ' ✓');
  }

  const { selections, warnUnmet } = computeSelections();
  const checkedCount = !scanResult ? 0 : (scanResult.items || []).filter(it => {
    const rs = rowState[it.relPath];
    return rs && rs.checked && it.status !== 'blocked';
  }).length;

  function fmtBytes(b) {
    if (b == null) return '';
    if (b < 1024) return b + 'B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + 'KB';
    return (b / 1024 / 1024).toFixed(1) + 'MB';
  }

  return (
    <div style={form}>
      <div style={formTitle}>Unity 폴더 임포트</div>

      {/* 스텝1: 폴더 경로 입력 */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <input style={{ ...finp, flex: 1 }}
          placeholder="예: D:\\MyUnityGame\\Assets"
          value={folder}
          onInput={(e) => { setFolder(e.target.value); setScanResult(null); setScanError(''); }}
          disabled={scanning}
        />
        <button style={{ ...okBtn, marginTop: 0, whiteSpace: 'nowrap' }}
          disabled={scanning || !folder.trim()}
          onClick={doScan}>
          {scanning ? '스캔 중…' : '스캔'}
        </button>
      </div>

      {scanError && <div style={errTxt}>{scanError}</div>}

      {/* 스텝2: 결과 목록 */}
      {scanResult && (
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>
            {scanResult.totals && scanResult.totals.count}개 항목 발견
            {scanResult.truncated && ' (일부만 표시 — 2000개 한도)'}
          </div>
          <div style={itemList}>
            {(scanResult.items || []).map((it) => {
              const rs = rowState[it.relPath] || { checked: false, id: '', attested: { checked: false, owner: '', license: 'user-owned' } };
              const isBlocked = it.status === 'blocked';
              const isWarn = it.status === 'warn';
              return (
                <div key={it.relPath} style={{ ...itemRow, opacity: isBlocked ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="checkbox"
                      disabled={isBlocked}
                      checked={!isBlocked && rs.checked}
                      onChange={(e) => updateRow(it.relPath, { checked: e.target.checked })}
                    />
                    <span style={{ ...statusBadge, background: isBlocked ? '#c0392b' : isWarn ? '#b8860b' : '#1a6e3c', color: '#fff' }}>
                      {isBlocked ? '⛔차단' : isWarn ? '⚠️확인' : '✅허용'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={it.relPath}>{it.relPath}</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{it.kind} {fmtBytes(it.bytes)}</span>
                  </div>
                  {it.reason && <div style={{ fontSize: '9px', color: isBlocked ? '#e57373' : '#c8a000', marginLeft: '20px' }}>{it.reason}</div>}
                  {!isBlocked && rs.checked && (
                    <input style={{ ...finp, fontSize: '10px', marginLeft: '20px', marginTop: '2px' }}
                      placeholder={'id: ' + (it.suggestedId || '')}
                      value={rs.id}
                      onInput={(e) => updateRow(it.relPath, { id: e.target.value })}
                    />
                  )}
                  {isWarn && !isBlocked && rs.checked && (
                    <div style={attestPanel}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer' }}>
                        <input type="checkbox"
                          checked={rs.attested.checked}
                          onChange={(e) => updateAttested(it.relPath, { checked: e.target.checked })}
                        />
                        내가 이 파일의 권리를 보유합니다
                      </label>
                      {rs.attested.checked && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                          <input style={{ ...finp, fontSize: '10px' }}
                            placeholder="권리 보유 주체(이름/조직)"
                            value={rs.attested.owner}
                            onInput={(e) => updateAttested(it.relPath, { owner: e.target.value })}
                          />
                          <select style={{ ...finp, fontSize: '10px' }}
                            value={rs.attested.license}
                            onChange={(e) => updateAttested(it.relPath, { license: e.target.value })}>
                            <option value="user-owned">user-owned (자체 제작)</option>
                            <option value="CC0-1.0">CC0-1.0</option>
                            <option value="MIT">MIT</option>
                            <option value="CC-BY-4.0">CC-BY-4.0</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '6px' }}>
            {warnUnmet > 0 && (
              <div style={{ fontSize: '9px', color: '#c8a000', marginBottom: '3px' }}>
                ⚠️ 확인 필요 {warnUnmet}개 — attestation(권리 보유 + 라이선스)을 완성해야 가져올 수 있습니다.
              </div>
            )}
            <button style={{ ...okBtn, width: '100%', opacity: (checkedCount === 0 || warnUnmet > 0 || importing) ? 0.5 : 1 }}
              disabled={checkedCount === 0 || warnUnmet > 0 || importing}
              onClick={doImport}>
              {importing ? '가져오는 중…' : '가져오기(' + selections.length + ')'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 어더 전용 스타일(기존 보존) ────────────────────────────────────────────────
const form = { border: '1px solid var(--border)', borderRadius: '4px', padding: '7px 8px', marginBottom: '8px',
  display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg)' };
const formTitle = { fontSize: '11px', fontWeight: 600, color: 'var(--accent)' };
const finp = { width: '100%', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '4px 6px', fontSize: '11px' };
const okBtn = { background: 'var(--accent)', color: '#08121a', border: 'none', borderRadius: '3px',
  padding: '5px 8px', cursor: 'pointer', fontWeight: 600, fontSize: '11px', marginTop: '2px' };
const itemList = { maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '3px',
  background: 'var(--bg)', padding: '4px' };
const itemRow = { borderBottom: '1px solid var(--border)', paddingBottom: '5px', marginBottom: '5px' };
const statusBadge = { fontSize: '9px', padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap', flexShrink: 0 };
const attestPanel = { marginLeft: '20px', marginTop: '3px', padding: '5px 6px', background: 'var(--panel2)',
  border: '1px solid var(--border)', borderRadius: '3px' };
const errTxt = { fontSize: '10px', color: '#e57373', padding: '2px 0' };
