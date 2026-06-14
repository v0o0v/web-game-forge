/* ============================================================================
 * AssetBrowser — 에셋 브라우저 패널 (P4)
 * ----------------------------------------------------------------------------
 * 설계서 §1(에셋 소스: 절차 + CC0 sprite-picker)·§5 P4·§4.6.
 *
 *  - 현재 씬 assets.sprites 목록 표시(절차/CC0 배지).
 *  - 절차 스프라이트 디파이너: 간단 def 입력(id·desc·w·h) → controller.addProceduralAsset
 *    (브리지 POST /api/asset/add procedural). PixelForge/VectorForge 베이크 def 는 후속
 *    창작 트랙에서 채운다(여기선 슬롯·메타만).
 *  - CC0 sprite-picker 통합: "CC0 고르기" → 창작 디스패치로 Claude 에게 sprite-picker 실행을
 *    요청(controller.dispatchCreative). Claude 가 skills/wgf-sprite-picker 피커를 띄워 사용자가
 *    고른 선택분을 asset_add_cc0 로 주입한다. URL 직접 추가도 지원(빠른 경로).
 *  - 에셋을 엔티티에 드래그 배정: 에셋 카드를 Hierarchy 의 엔티티로 드래그(HTML5 DnD) 하거나,
 *    선택된 엔티티에 "선택 엔티티에 적용" 버튼 → controller.assignAssetToEntity
 *    (addComponent Sprite{sprite:id}) → scene.json 자산 ref 유효(lint-scene 통과).
 *
 * remote(브리지)에서만 활성. local(P1)에선 비활성 안내.
 * ========================================================================== */
import { useState, useEffect } from 'preact/hooks';

export function AssetBrowser({ controller, selection }) {
  const remote = controller.isRemote;
  const [assets, setAssets] = useState(controller.getAssets ? controller.getAssets() : { sprites: [] });
  const [showProc, setShowProc] = useState(false);
  const [showCc0, setShowCc0] = useState(false);
  const [showUnity, setShowUnity] = useState(false);
  const [msg, setMsg] = useState('');

  // 에셋 목록 변경 구독(브리지 onAsset 델타 → 미러 동기).
  useEffect(() => {
    if (!controller.onAssetChange) return;
    const off = controller.onAssetChange((a) => setAssets(a || { sprites: [] }));
    return off;
  }, []);
  // change 시에도 동기(엔티티 변경 등으로 재렌더될 때 최신 assets 반영).
  useEffect(() => {
    if (!controller.onChange) return;
    const off = controller.onChange(() => { if (controller.getAssets) setAssets(controller.getAssets()); });
    return off;
  }, []);

  function flash(t) { setMsg(t); setTimeout(() => setMsg(''), 2500); }

  async function assignToSelected(spriteId) {
    if (!selection || selection.length === 0) { flash('엔티티를 먼저 선택하세요'); return; }
    const id = selection[0];
    try { await controller.assignAssetToEntity(id, spriteId); flash(`"${spriteId}" → ${id} 적용 ✓`); }
    catch (e) { flash('적용 실패'); }
  }

  return (
    <div style={panel}>
      <div style={header}>에셋</div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 10px' }}>
        {!remote && (
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginBottom: '8px' }}>
            브리지 미연결(local) — 에셋 추가는 /wgf-editor 브리지에서만 동작합니다.
          </div>
        )}

        {/* 추가 버튼 */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          <button style={addBtn} disabled={!remote} onClick={() => { setShowProc(!showProc); setShowCc0(false); setShowUnity(false); }}>＋ 절차</button>
          <button style={addBtn} disabled={!remote} onClick={() => { setShowCc0(!showCc0); setShowProc(false); setShowUnity(false); }}>＋ CC0</button>
          <button style={addBtn} disabled={!remote} onClick={() => { setShowUnity(!showUnity); setShowProc(false); setShowCc0(false); }}>＋ Unity</button>
        </div>

        {showProc && <ProceduralDefiner controller={controller} onDone={(t) => { setShowProc(false); flash(t); }} />}
        {showCc0 && <Cc0Adder controller={controller} onDone={(t) => { setShowCc0(false); flash(t); }} />}
        {showUnity && <UnityFolderImporter controller={controller} onDone={(t) => { setShowUnity(false); flash(t); }} />}
        {msg && <div style={{ color: 'var(--accent2)', fontSize: '11px', margin: '4px 0' }}>{msg}</div>}

        {/* 에셋 목록 */}
        <div style={{ marginTop: '6px' }}>
          {assets.sprites.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>스프라이트 없음</div>}
          {assets.sprites.map((s) => (
            <AssetCard key={s.id} asset={s} onAssign={() => assignToSelected(s.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AssetCard({ asset, onAssign }) {
  const isCc0 = asset.source === 'cc0';
  const isLocal = asset.source === 'local';
  // HTML5 드래그: 에셋 id 를 dataTransfer 에 실어 Hierarchy 엔티티에 드롭하면 배정.
  function onDragStart(e) {
    try { e.dataTransfer.setData('application/wgf-asset', asset.id); e.dataTransfer.effectAllowed = 'copy'; } catch (err) {}
  }
  // 배지 색상: cc0=accent2(초록), local=accent(청록), 절차=accent(기본)
  const badgeBg = isCc0 ? 'var(--accent2)' : isLocal ? 'var(--accent)' : 'var(--accent)';
  const badgeLabel = isCc0 ? 'CC0' : isLocal ? 'Unity' : '절차';
  return (
    <div draggable onDragStart={onDragStart} title="엔티티로 드래그하거나 ↓ 버튼으로 선택 엔티티에 적용"
         style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '5px 7px', marginBottom: '5px',
                  display: 'flex', alignItems: 'center', gap: '6px', cursor: 'grab', background: 'var(--panel2)' }}>
      <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px',
        background: badgeBg, color: '#08121a' }}>{badgeLabel}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {asset.id}
          {isLocal && asset.attested && <span title="사용자 권리 보유 선언" style={{ marginLeft: '4px', fontSize: '9px' }}>⚠️</span>}
        </div>
        {asset.desc && <div style={{ fontSize: '10px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.desc}</div>}
        {isLocal && asset.license && <div style={{ fontSize: '9px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.license}</div>}
      </div>
      <button style={assignBtn} title="선택 엔티티에 Sprite 로 적용" onClick={onAssign}>↓</button>
    </div>
  );
}

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

function Cc0Adder({ controller, onDone }) {
  const [tab, setTab] = useState('picker');     // picker(sprite-picker 디스패치) | url(직접)
  const [id, setId] = useState('');
  const [url, setUrl] = useState('');
  const [credit, setCredit] = useState('');
  const [busy, setBusy] = useState(false);

  // sprite-picker 통합: Claude 에게 피커 실행을 요청(창작 디스패치). Claude 가 갤러리를 띄워
  // 사용자 선택분을 asset_add_cc0 로 주입한다(SKILL.md 워크플로 — serve.mjs + 선택 파일 회수).
  async function dispatchPicker() {
    setBusy(true);
    let r;
    try {
      r = await controller.dispatchCreative(
        'CC0 스프라이트를 골라줘 — skills/wgf-sprite-picker 갤러리를 띄워 내가 고르면 asset_add_cc0 로 현재 씬 에셋에 추가해줘.');
    } catch (e) { r = { ok: false, error: String(e) }; }
    setBusy(false);
    onDone(r && r.ok ? 'sprite-picker 요청 디스패치됨 — Claude 가 갤러리를 띄웁니다 ✓' : ('디스패치 실패: ' + (r && r.error || '')));
  }

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
      <div style={formTitle}>CC0 에셋</div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        <button style={tab === 'picker' ? tabOn : tabOff} onClick={() => setTab('picker')}>sprite-picker</button>
        <button style={tab === 'url' ? tabOn : tabOff} onClick={() => setTab('url')}>URL 직접</button>
      </div>
      {tab === 'picker' ? (
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>
            CC0 갤러리(Kenney 등)를 Claude 가 띄워 줍니다. 고른 에셋이 자동으로 현재 씬에 추가됩니다.
          </div>
          <button style={okBtn} disabled={busy} onClick={dispatchPicker}>CC0 갤러리 열기(Claude 디스패치)</button>
        </div>
      ) : (
        <div>
          <input style={finp} placeholder="id (예: spr_kenney_coin)" value={id} onInput={(e) => setId(e.target.value)} />
          <input style={finp} placeholder="CC0 이미지 URL" value={url} onInput={(e) => setUrl(e.target.value)} />
          <input style={finp} placeholder="출처(credit, 선택)" value={credit} onInput={(e) => setCredit(e.target.value)} />
          <button style={okBtn} disabled={busy || !id.trim() || !url.trim()} onClick={addUrl}>추가(CC0-1.0)</button>
        </div>
      )}
    </div>
  );
}

// ── Unity 폴더 임포트 위저드 ───────────────────────────────────────────────────
// Cc0Adder 패턴 재사용. 스텝1(스캔) → 스텝2(검토·선택·attestation) → 가져오기.
function UnityFolderImporter({ controller, onDone }) {
  const [folder, setFolder] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);   // {ok, items, truncated, ...}
  const [scanError, setScanError] = useState('');
  // 각 item 의 선택 상태. key=relPath → {checked, id, attested:{checked,owner,license}}
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

  // 선택된 항목 계산 + attestation 충족 여부 검사.
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
  const selectedCount = selections.length + warnUnmet; // warnUnmet 포함 체크된 수(버튼 비활성 판단용)
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
                  {/* 배지 + 체크박스 */}
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
                  {/* reason */}
                  {it.reason && <div style={{ fontSize: '9px', color: isBlocked ? '#e57373' : '#c8a000', marginLeft: '20px' }}>{it.reason}</div>}
                  {/* id 편집 */}
                  {!isBlocked && rs.checked && (
                    <input style={{ ...finp, fontSize: '10px', marginLeft: '20px', marginTop: '2px' }}
                      placeholder={'id: ' + (it.suggestedId || '')}
                      value={rs.id}
                      onInput={(e) => updateRow(it.relPath, { id: e.target.value })}
                    />
                  )}
                  {/* warn attestation 패널 */}
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

          {/* 가져오기 버튼 */}
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

const panel = { display: 'flex', flexDirection: 'column', height: '100%',
  background: 'var(--panel)', borderLeft: '1px solid var(--border)' };
const header = { padding: '8px 10px', fontWeight: 600, fontSize: '12px',
  color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' };
const addBtn = { flex: 1, background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '5px 8px', cursor: 'pointer', fontSize: '11px' };
const assignBtn = { background: 'var(--accent)', color: '#08121a', border: 'none', borderRadius: '3px',
  padding: '2px 7px', cursor: 'pointer', fontWeight: 700 };
const form = { border: '1px solid var(--border)', borderRadius: '4px', padding: '7px 8px', marginBottom: '8px',
  display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg)' };
const formTitle = { fontSize: '11px', fontWeight: 600, color: 'var(--accent)' };
const finp = { width: '100%', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '4px 6px', fontSize: '11px' };
const okBtn = { background: 'var(--accent)', color: '#08121a', border: 'none', borderRadius: '3px',
  padding: '5px 8px', cursor: 'pointer', fontWeight: 600, fontSize: '11px', marginTop: '2px' };
const tabOn = { flex: 1, background: 'var(--accent)', color: '#08121a', border: 'none', borderRadius: '3px', padding: '3px', cursor: 'pointer', fontSize: '10px' };
const tabOff = { flex: 1, background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', padding: '3px', cursor: 'pointer', fontSize: '10px' };
// Unity 임포트 위저드 전용 스타일
const itemList = { maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '3px',
  background: 'var(--bg)', padding: '4px' };
const itemRow = { borderBottom: '1px solid var(--border)', paddingBottom: '5px', marginBottom: '5px' };
const statusBadge = { fontSize: '9px', padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap', flexShrink: 0 };
const attestPanel = { marginLeft: '20px', marginTop: '3px', padding: '5px 6px', background: 'var(--panel2)',
  border: '1px solid var(--border)', borderRadius: '3px' };
const errTxt = { fontSize: '10px', color: '#e57373', padding: '2px 0' };
