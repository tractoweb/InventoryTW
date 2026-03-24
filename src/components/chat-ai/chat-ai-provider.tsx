"use client";

import * as React from "react";

type ChatAIContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const ChatAIContext = React.createContext<ChatAIContextValue | null>(null);

export function ChatAIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);
  const toggle = React.useCallback(() => setIsOpen((v) => !v), []);

  return (
    <ChatAIContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </ChatAIContext.Provider>
  );
}

export function useChatAI(): ChatAIContextValue {
  const ctx = React.useContext(ChatAIContext);
  if (!ctx) throw new Error("useChatAI debe usarse dentro de <ChatAIProvider>");
  return ctx;
}
