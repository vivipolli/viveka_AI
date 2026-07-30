import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "shared";
import { ChatInput } from "../components/ChatInput.js";
import { ChatMessageView } from "../components/ChatMessageView.js";
import { FooterCredit } from "../components/FooterCredit.js";
import { Logo } from "../components/Logo.js";
import { MobileMenu } from "../components/MobileMenu.js";
import { Sidebar } from "../components/Sidebar.js";
import { SunRays } from "../components/SunRays.js";
import { TypingIndicator } from "../components/TypingIndicator.js";
import { useChat } from "../hooks/useChat.js";
import { useSession } from "../hooks/useSession.js";
import { fetchConversations } from "../lib/api.js";

export function ChatPage() {
  const { t } = useTranslation();
  const sessionId = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(() => {
    if (!sessionId) return;
    fetchConversations(sessionId).then(setConversations);
  }, [sessionId]);

  const chat = useChat(sessionId, refreshConversations);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat.messages]);

  const questionByAssistantIndex = useMemo(() => {
    const map = new Map<number, string>();
    chat.messages.forEach((message, index) => {
      if (message.role === "assistant" && index > 0) {
        const prev = chat.messages[index - 1];
        if (prev.role === "user") map.set(index, prev.content);
      }
    });
    return map;
  }, [chat.messages]);

  const hasMessages = chat.messages.length > 0;
  const lastMessage = chat.messages[chat.messages.length - 1];
  const showTyping =
    chat.isStreaming &&
    lastMessage?.role === "assistant" &&
    lastMessage.content.length === 0;

  return (
    <div className="relative flex h-dvh">
      <SunRays />

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        conversations={conversations}
        activeId={chat.conversationId}
        onSelect={chat.loadConversation}
        onNew={chat.startNew}
      />

      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="hidden md:flex h-full shrink-0">
          <Sidebar
            conversations={conversations}
            activeId={chat.conversationId}
            onSelect={chat.loadConversation}
            onNew={chat.startNew}
          />
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-solar-warm/50 bg-white/75 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-solar-text transition hover:bg-solar-cream"
            aria-label={t("menu.open")}
          >
            <MenuIcon />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Logo className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold text-solar-text">
                {t("app.title")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={chat.startNew}
            className="rounded-full bg-gradient-to-br from-solar-orange to-solar-gold p-2.5 text-white shadow transition hover:brightness-105"
            aria-label={t("chat.newConversation")}
          >
            <PlusIcon />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
            {!hasMessages && <WelcomePanel onExample={chat.sendMessage} />}

            {chat.messages.map((message, index) => (
              <ChatMessageView
                key={message.id}
                message={message}
                question={questionByAssistantIndex.get(index)}
                cached={
                  chat.cached && index === chat.messages.length - 1 ? true : undefined
                }
              />
            ))}

            {showTyping && (
              <div className="animate-fade-in-up">
                <TypingIndicator />
              </div>
            )}

            {chat.errorKey && (
              <p className="rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700">
                {t(chat.errorKey)}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-solar-warm/50 bg-white/75 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl">
            <ChatInput disabled={chat.isStreaming} onSend={chat.sendMessage} />
            <FooterCredit />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function WelcomePanel({ onExample }: { onExample: (q: string) => void }) {
  const { t } = useTranslation();
  const examples = [
    t("chat.examples.one"),
    t("chat.examples.two"),
    t("chat.examples.three"),
  ];

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 py-8 text-center">
      <Logo className="h-20 w-20" />
      <h2 className="text-2xl font-extrabold text-solar-text">
        {t("chat.welcomeTitle")}
      </h2>
      <p className="max-w-md text-solar-muted">{t("chat.welcomeText")}</p>
      <p className="max-w-md text-sm font-medium text-solar-orange">
        {t("chat.philosophy")}
      </p>

      <div className="mt-4 w-full max-w-md">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-solar-muted">
          {t("chat.examples.title")}
        </p>
        <div className="flex flex-col gap-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onExample(example)}
              className="rounded-xl border border-solar-warm bg-white/70 px-4 py-2.5 text-center text-sm text-solar-text transition hover:border-solar-orange hover:bg-white"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
