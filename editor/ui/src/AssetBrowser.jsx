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
          <button style={addBtn} disabled={!remote} onClick={() => { setShowProc(!showProc); setShowCc0(false); }}>＋ 절차</button>
          <button style={addBtn} disabled={!remote} onClick={() => { setShowCc0(!showCc0); setShowProc(false); }}>＋ CC0</button>
        </div>

        {showProc && <ProceduralDefiner controller={controller} onDone={(t) => { setShowProc(false); flash(t); }} />}
        {showCc0 && <Cc0Adder controller={controller} onDone={(t) => { setShowCc0(false); flash(t); }} />}
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
  // HTML5 드래그: 에셋 id 를 dataTransfer 에 실어 Hierarchy 엔티티에 드롭하면 배정.
  function onDragStart(e) {
    try { e.dataTransfer.setData('application/wgf-asset', asset.id); e.dataTransfer.effectAllowed = 'copy'; } catch (err) {}
  }
  return (
    <div draggable onDragStart={onDragStart} title="엔티티로 드래그하거나 ↓ 버튼으로 선택 엔티티에 적용"
         style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '5px 7px', marginBottom: '5px',
                  display: 'flex', alignItems: 'center', gap: '6px', cursor: 'grab', background: 'var(--panel2)' }}>
      <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px',
        background: isCc0 ? 'var(--accent2)' : 'var(--accent)', color: '#08121a' }}>{isCc0 ? 'CC0' : '절차'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.id}</div>
        {asset.desc && <div style={{ fontSize: '10px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.desc}</div>}
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
