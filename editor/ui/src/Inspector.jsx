/* ============================================================================
 * Inspector — 선택 엔티티의 transform + 컴포넌트를 inspectorFields 로 자동 생성.
 * ----------------------------------------------------------------------------
 * 각 컴포넌트의 inspectorFields(scenekit-components.js)로 입력 위젯을 만든다.
 * 필드 편집 → controller.setTransform / updateComponent (= applyCommand).
 * showWhen 조건 필드, enum(문자열/객체 옵션), asset-ref, json, boolean 지원.
 * ==========================================================================*/
export function Inspector({ controller, world, selection }) {
  if (!world || selection.length === 0) {
    return (
      <div style={panel}>
        <div style={header}>속성 (Inspector)</div>
        <div style={empty}>엔티티를 선택하세요</div>
      </div>
    );
  }
  // 다중 선택 시 첫 엔티티만 편집(P1 단순화 — 멀티 편집은 후속).
  const ent = world.entities.find((e) => e.id === selection[0]);
  if (!ent) {
    return <div style={panel}><div style={header}>속성 (Inspector)</div><div style={empty}>엔티티 없음</div></div>;
  }

  const multi = selection.length > 1;

  return (
    <div style={panel}>
      <div style={header}>속성 (Inspector)</div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 10px' }}>
        {multi && <div style={{ color: 'var(--accent2)', marginBottom: '6px' }}>
          {selection.length}개 선택 — 첫 엔티티 편집</div>}

        <Field label="이름" >
          <input style={inp} value={ent.name || ''}
                 onInput={(e) => {/* name 편집은 P1 미지원(커맨드 없음) — 표시만 */}}
                 readOnly />
        </Field>
        <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginBottom: '8px' }}>id: {ent.id}</div>

        {/* ── Transform ── */}
        <Section title="Transform" />
        <TransformEditor controller={controller} ent={ent} />

        {/* ── 컴포넌트들 ── */}
        {ent.components.map((comp, idx) => (
          <ComponentEditor key={idx} controller={controller} ent={ent} comp={comp} index={idx} />
        ))}
      </div>
    </div>
  );
}

function TransformEditor({ controller, ent }) {
  const t = ent.transform;
  const fields = [
    { key: 'x', label: 'x' }, { key: 'y', label: 'y' },
    { key: 'rotation', label: 'rotation(rad)' },
    { key: 'scaleX', label: 'scaleX' }, { key: 'scaleY', label: 'scaleY' },
    { key: 'depth', label: 'depth' }
  ];
  return (
    <div>
      {fields.map((f) => (
        <Field key={f.key} label={f.label}>
          <input type="number" step="any" style={inp}
                 value={numVal(t[f.key])}
                 onChange={(e) => {
                   const v = parseFloat(e.target.value);
                   if (isFinite(v)) controller.setTransform(ent.id, { [f.key]: v });
                 }} />
        </Field>
      ))}
    </div>
  );
}

function ComponentEditor({ controller, ent, comp, index }) {
  const def = controller.getComponentDef(comp.type);
  const fields = (def && def.inspectorFields) ? def.inspectorFields : [];

  function patch(key, value) {
    controller.updateComponent(ent.id, index, { [key]: value });
  }

  function visible(field) {
    if (!field.showWhen) return true;
    return comp[field.showWhen.field] === field.showWhen.value;
  }

  return (
    <div style={{ marginTop: '10px', border: '1px solid var(--border)', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 8px', background: 'var(--panel2)', borderRadius: '4px 4px 0 0' }}>
        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{comp.type}</span>
        <button style={delBtn} title="컴포넌트 제거"
                onClick={() => controller.removeComponent(ent.id, index)}>✕</button>
      </div>
      <div style={{ padding: '6px 8px' }}>
        {fields.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>편집 가능한 필드 없음</div>}
        {fields.filter(visible).map((field) => (
          <FieldWidget key={field.key} field={field} value={comp[field.key]}
                       onChange={(v) => patch(field.key, v)} />
        ))}
      </div>
    </div>
  );
}

// inspectorField → 입력 위젯. type: number/string/boolean/enum/asset-ref/json.
function FieldWidget({ field, value, onChange }) {
  const label = field.label || field.key;

  if (field.type === 'boolean') {
    return (
      <Field label={label}>
        <input type="checkbox" checked={!!value}
               onChange={(e) => onChange(e.target.checked)} />
      </Field>
    );
  }

  if (field.type === 'enum') {
    const options = normEnumOptions(field.options || field.values || []);
    return (
      <Field label={label}>
        <select style={inp} value={value == null ? '' : String(value)}
                onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
    );
  }

  if (field.type === 'number') {
    return (
      <Field label={label}>
        <input type="number" step="any" style={inp}
               value={numVal(value)}
               placeholder={field.placeholder || ''}
               onChange={(e) => {
                 const v = parseFloat(e.target.value);
                 if (isFinite(v)) onChange(v);
               }} />
      </Field>
    );
  }

  if (field.type === 'json') {
    return (
      <Field label={label} stacked>
        <textarea style={{ ...inp, minHeight: '48px', fontFamily: 'monospace', fontSize: '11px' }}
                  value={jsonVal(value)}
                  placeholder={field.placeholder || ''}
                  onBlur={(e) => {
                    const txt = e.target.value.trim();
                    if (!txt) { onChange(undefined); return; }
                    try { onChange(JSON.parse(txt)); }
                    catch (err) { /* 잘못된 JSON 은 무시(커밋 안 함) */ }
                  }} />
      </Field>
    );
  }

  // asset-ref · string (기본 텍스트 입력)
  return (
    <Field label={label}>
      <input type="text" style={inp}
             value={value == null ? '' : String(value)}
             placeholder={field.placeholder || (field.type === 'asset-ref' ? '(자산 id)' : '')}
             onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

// ── 소품 ──────────────────────────────────────────────────────────────────────
function Field({ label, children, stacked }) {
  return (
    <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row',
                  alignItems: stacked ? 'stretch' : 'center', marginBottom: '5px', gap: '6px' }}>
      <label style={{ color: 'var(--text-dim)', fontSize: '11px', width: stacked ? 'auto' : '92px', flexShrink: 0 }}>{label}</label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
function Section({ title }) {
  return <div style={{ marginTop: '8px', marginBottom: '4px', fontWeight: 600,
    color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px' }}>{title}</div>;
}

function normEnumOptions(opts) {
  return opts.map((o) => (typeof o === 'object' && o !== null)
    ? { value: String(o.value), label: o.label || String(o.value) }
    : { value: String(o), label: String(o) });
}
function numVal(v) { return (typeof v === 'number' && isFinite(v)) ? v : (v == null ? '' : v); }
function jsonVal(v) { if (v == null) return ''; try { return JSON.stringify(v); } catch (e) { return ''; } }

const panel = { display: 'flex', flexDirection: 'column', height: '100%',
  background: 'var(--panel)', borderLeft: '1px solid var(--border)' };
const header = { padding: '8px 10px', fontWeight: 600, fontSize: '12px',
  color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' };
const empty = { padding: '12px 10px', color: 'var(--text-dim)' };
const inp = { width: '100%', background: 'var(--bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: '3px', padding: '3px 6px' };
const delBtn = { background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer', fontSize: '12px' };
