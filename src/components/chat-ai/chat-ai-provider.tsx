"use client";

import * as React from "react";

type ChatAIContextValue = {
  isOpen: boolean;
  showHint: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  dismissHint: () => void;
};

const ChatAIContext = React.createContext<ChatAIContextValue | null>(null);

export function ChatAIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showHint, setShowHint] = React.useState(false);

  React.useEffect(() => {
    try {
      const seen = window.localStorage.getItem("chat-ai-hint-seen") === "1";
      setShowHint(!seen);
    } catch {
      setShowHint(false);
    }
  }, []);

  const dismissHint = React.useCallback(() => {
    setShowHint(false);
    try {
      window.localStorage.setItem("chat-ai-hint-seen", "1");
    } catch {}
  }, []);

  const open = React.useCallback(() => {
    setIsOpen(true);
    dismissHint();
  }, [dismissHint]);
  const close = React.useCallback(() => setIsOpen(false), []);
  const toggle = React.useCallback(() => {
    setIsOpen((v) => {
      const next = !v;
      if (next) dismissHint();
      return next;
    });
  }, [dismissHint]);

  return (
    <ChatAIContext.Provider value={{ isOpen, showHint, open, close, toggle, dismissHint }}>
      {children}
    </ChatAIContext.Provider>
  );
}

export function useChatAI(): ChatAIContextValue {
  const ctx = React.useContext(ChatAIContext);
  if (!ctx) throw new Error("useChatAI debe usarse dentro de <ChatAIProvider>");
  return ctx;
}
