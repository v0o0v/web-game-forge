/* ============================================================================
 * SkillMenu — 2-트랙 스킬 메뉴 (P4)
 * ----------------------------------------------------------------------------
 * 설계서 §1(스킬 적용 2-트랙)·§5 P4.
 *
 *  - 결정형 트랙(에디터 직접): lint-scene·qa-score 등 버튼 → controller.runSkill
 *    → 브리지 POST /api/skill/run(화이트리스트·인자스키마·execFile) → 결과(exit·findings) 표시.
 *    현재 씬 대상 도구(lint-scene)는 file="current" 로 보내 브리지가 현재 씬을 임시
 *    직렬화해 실행한다.
 *  - 창작형 트랙(Claude 디스패치): "스토리 입혀줘"·"능력 추가" 등 → controller.dispatchCreative
 *    → 현재 씬 문맥을 포함한 챗 메시지를 P3 챗 큐로 enqueue(역채널). Claude /loop 가 받아 편집.
 *
 * remote(브리지)에서만 활성. local(P1)에선 비활성 안내.
 * ========================================================================== */
import { useState } from 'preact/hooks';

// 결정형 트랙 버튼 정의(화이트리스트 도구 — 브리지가 최종 강제).
//  - current=true 면 file="current"(현재 씬 임시 직렬화). 아니면 target/file 입력.
const DETERMINISTIC = [
  { tool: 'lint-scene', label: 'lint-scene', desc: '현재 씬 정적 검증(스키마·댕글링·화이트리스트)', current: true },
  { tool: 'lint-kit-deps', label: 'lint-kit-deps', desc: '엔진 킷 의존성 그래프 검증', args: { json: true } }
];

// 창작형 트랙 프리셋(Claude 디스패치 — 현재 씬 문맥 자동 동봉).
const CREATIVE = [
  { label: '스토리 입혀줘', prompt: '이 게임에 어울리는 스토리·분위기를 입혀줘.' },
  { label: '능력 추가', prompt: '플레이어에게 어울리는 능력(대시/발사 등)을 하나 추가해줘.' },
  { label: '적 다양화', prompt: '적의 종류·행동(추격/순찰/사격)을 다양하게 만들어줘.' }
];

export function SkillMenu({ controller }) {
  const remote = controller.isRemote;
  const [result, setResult] = useState(null);      // 결정형 실행 결과
  const [running, setRunning] = useState(false);
  const [creativeInput, setCreativeInput] = useState('');
  const [dispatchMsg, setDispatchMsg] = useState('');

  async function runDeterministic(entry) {
    if (running) return;
    setRunning(true); setResult(null);
    const args = Object.assign({}, entry.args || {});
    if (entry.current) args.file = 'current';
    if (args.json === undefined) args.json = true;
    let r;
    try { r = await controller.runSkill(entry.tool, args); }
    catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    setResult({ tool: entry.tool, ...r });
    setRunning(false);
  }

  async function dispatchCreative(prompt) {
    if (!prompt || !prompt.trim()) return;
    setDispatchMsg('');
    let r;
    try { r = await controller.dispatchCreative(prompt.trim()); }
    catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
    setDispatchMsg(r && r.ok ? '디스패치됨 — Claude 가 처리합니다 ✓' : ('실패: ' + (r && r.error || '')));
    setTimeout(() => setDispatchMsg(''), 3000);
  }

  return (
    <div style={panel}>
      <div style={header}>스킬</div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 10px' }}>
        {!remote && (
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginBottom: '8px' }}>
            브리지 미연결(local) — 스킬은 /wgf-editor 브리지에서만 동작합니다.
          </div>
        )}

        {/* ── 결정형 트랙 ── */}
        <div style={trackTitle}>결정형 (에디터 직접 실행)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {DETERMINISTIC.map((e) => (
            <button key={e.tool} style={detBtn} disabled={!remote || running}
                    title={e.desc} onClick={() => runDeterministic(e)}>
              {e.label}
            </button>
          ))}
        </div>
        {running && <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '6px' }}>실행 중…</div>}
        {result && <SkillResult result={result} />}

        {/* ── 창작형 트랙 ── */}
        <div style={{ ...trackTitle, marginTop: '14px' }}>창작형 (Claude 디스패치)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {CREATIVE.map((c) => (
            <button key={c.label} style={creBtn} disabled={!remote}
                    title={c.prompt} onClick={() => dispatchCreative(c.prompt)}>
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          <input style={inp} value={creativeInput} disabled={!remote}
                 placeholder="직접 요청(예: 보스 추가)…"
                 onInput={(e) => setCreativeInput(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') { dispatchCreative(creativeInput); setCreativeInput(''); } }} />
          <button style={creBtn} disabled={!remote || !creativeInput.trim()}
                  onClick={() => { dispatchCreative(creativeInput); setCreativeInput(''); }}>보내기</button>
        </div>
        {dispatchMsg && <div style={{ color: 'var(--accent2)', fontSize: '11px', marginTop: '4px' }}>{dispatchMsg}</div>}
      </div>
    </div>
  );
}

function SkillResult({ result }) {
  const ok = result.ok && result.exit === 0;
  const errors = result.json && result.json.counts ? result.json.counts.error : null;
  const findings = (result.json && Array.isArray(result.json.findings)) ? result.json.findings : [];
  return (
    <div style={{ marginTop: '8px', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600 }}>{result.tool}</span>
        <span style={{ color: ok ? 'var(--ok)' : 'var(--danger)' }}>
          {result.ok ? `exit ${result.exit}` : '실행 거부'}
        </span>
      </div>
      {!result.ok && <div style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '3px' }}>{result.error}</div>}
      {result.ok && errors != null && (
        <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '3px' }}>
          findings: error {errors}{result.json.counts.warn != null ? ` · warn ${result.json.counts.warn}` : ''}
        </div>
      )}
      {findings.slice(0, 8).map((f, i) => (
        <div key={i} style={{ fontSize: '10px', marginTop: '2px',
          color: f.level === 'error' ? 'var(--danger)' : 'var(--text-dim)' }}>
          [{f.level || f.code}] {f.message || f.code}
        </div>
      ))}
    </div>
  );
}

const panel = { display: 'flex', flexDirection: 'column', height: '100%',
  background: 'var(--panel)', borderLeft: '1px solid var(--border)' };
const header = { padding: '8px 10px', fontWeight: 600, fontSize: '12px',
  color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' };
const trackTitle = { fontSize: '11px', fontWeight: 600, color: 'var(--accent)', marginBottom: '5px' };
const detBtn = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '5px 8px', cursor: 'pointer', textAlign: 'left' };
const creBtn = { background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' };
const inp = { flex: 1, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: '3px', padding: '4px 6px', fontSize: '11px' };
