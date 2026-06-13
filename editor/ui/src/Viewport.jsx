/* Viewport — scenekit-phaser 어댑터를 마운트해 현재 씬을 t=0 표시. */
import { useEffect, useRef } from 'preact/hooks';

export function Viewport({ controller, sceneDoc }) {
  const hostRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!hostRef.current || mountedRef.current) return;
    mountedRef.current = true;
    controller.mount(hostRef.current, sceneDoc, {});
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#0e1016', overflow: 'auto', padding: '12px' }}>
      <div ref={hostRef} id="wgf-viewport"
           style={{ boxShadow: '0 0 0 1px #2c3346', lineHeight: 0 }} />
    </div>
  );
}
