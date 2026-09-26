import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const Ctx = createContext(() => {});

/** toast(message, 'ok' | 'err') */
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const toast = useCallback((message, kind = 'ok') => {
    const id = nextId.current++;
    setItems((list) => [...list, { id, message, kind }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);

  const value = useMemo(() => toast, [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.message}</div>)}
      </div>
    </Ctx.Provider>
  );
}
