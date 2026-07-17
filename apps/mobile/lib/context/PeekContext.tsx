import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import PeekOverlay from '@/components/peek/PeekOverlay';
import { PeekSession } from '@/components/peek/types';

interface PeekActionsContextType {
  beginPeek: (session: PeekSession) => void;
  endPeek: () => void;
}

interface PeekStateContextType {
  isPeeking: boolean;
  activeSession: PeekSession | null;
}

const PeekActionsContext = createContext<PeekActionsContextType>({
  beginPeek: () => {},
  endPeek: () => {},
});

const PeekStateContext = createContext<PeekStateContextType>({
  isPeeking: false,
  activeSession: null,
});

export const PeekProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPeeking, setIsPeeking] = useState(false);
  const [activeSession, setActiveSession] = useState<PeekSession | null>(null);
  const isActiveRef = useRef(false);

  const beginPeek = useCallback((session: PeekSession) => {
    isActiveRef.current = true;
    setActiveSession(session);
    setIsPeeking(true);
  }, []);

  const endPeek = useCallback(() => {
    isActiveRef.current = false;
    setIsPeeking(false);
    setActiveSession(null);
  }, []);

  const actions = useMemo(() => ({ beginPeek, endPeek }), [beginPeek, endPeek]);
  const state = useMemo(() => ({ isPeeking, activeSession }), [isPeeking, activeSession]);

  return (
    <PeekActionsContext.Provider value={actions}>
      <PeekStateContext.Provider value={state}>
        {children}
        <PeekOverlay activeSession={activeSession} isPeeking={isPeeking} />
      </PeekStateContext.Provider>
    </PeekActionsContext.Provider>
  );
};

export const usePeekActions = () => useContext(PeekActionsContext);

export const usePeekState = () => useContext(PeekStateContext);

export const usePeek = () => {
  const actions = useContext(PeekActionsContext);
  const state = useContext(PeekStateContext);
  return { ...actions, ...state };
};
