import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

/** Dialog. Closes on backdrop click, the x button and Escape. */
export function Modal({ title, onClose, wide = false, footer, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-back open" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-hdr">
          <div className="modal-ttl">{title}</div>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

const ConfirmCtx = createContext(async () => false);

/** const confirm = useConfirm();  if (await confirm({ message, confirmLabel })) ... */
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const [pending, setPending] = useState(null);

  const confirm = useCallback((opts) => new Promise((resolve) => setPending({ ...opts, resolve })), []);
  const settle = (value) => { pending?.resolve(value); setPending(null); };
  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      {pending && (
        <Modal
          title={pending.title || 'Are you sure?'}
          onClose={() => settle(false)}
          footer={(
            <>
              <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => settle(true)}>{pending.confirmLabel || 'Delete'}</button>
            </>
          )}
        >
          <p className="confirm-msg">{pending.message}</p>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
