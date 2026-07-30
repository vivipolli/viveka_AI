import { useCallback, useState } from "react";
import type { ChatMessage } from "shared";
import { fetchMessages, streamChat } from "../lib/api.js";

interface UseChatResult {
  messages: ChatMessage[];
  conversationId?: string;
  isStreaming: boolean;
  cached: boolean;
  errorKey: string | null;
  sendMessage: (question: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  startNew: () => void;
}

export function useChat(
  sessionId: string | null,
  onConversationCreated: () => void,
): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [cached, setCached] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!sessionId || isStreaming) return;

      setErrorKey(null);
      setCached(false);

      const userMessage: ChatMessage = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
      };
      const assistantMessage: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const isNewConversation = !conversationId;

      await streamChat(
        { sessionId, conversationId, question },
        {
          onEvent: (event) => {
            switch (event.type) {
              case "meta":
                setConversationId(event.conversationId);
                break;
              case "token":
                setMessages((prev) =>
                  updateLast(prev, (m) => ({
                    ...m,
                    content: m.content + event.value,
                  })),
                );
                break;
              case "sources":
                setMessages((prev) =>
                  updateLast(prev, (m) => ({ ...m, sources: event.sources })),
                );
                break;
              case "readingSuggestion":
                setMessages((prev) =>
                  updateLast(prev, (m) => ({
                    ...m,
                    readingSuggestion: event.text,
                  })),
                );
                break;
              case "cached":
                setCached(true);
                break;
              case "done":
                setIsStreaming(false);
                if (isNewConversation) onConversationCreated();
                break;
              case "error":
                setErrorKey("chat.errors.generic");
                setIsStreaming(false);
                break;
            }
          },
          onError: (status) => {
            setErrorKey(
              status === 429 ? "chat.errors.rateLimit" : "chat.errors.generic",
            );
            setIsStreaming(false);
          },
        },
      );
    },
    [sessionId, conversationId, isStreaming, onConversationCreated],
  );

  const loadConversation = useCallback(
    async (id: string) => {
      if (!sessionId) return;
      setConversationId(id);
      setCached(false);
      setErrorKey(null);
      const loaded = await fetchMessages(id, sessionId);
      setMessages(loaded);
    },
    [sessionId],
  );

  const startNew = useCallback(() => {
    setConversationId(undefined);
    setMessages([]);
    setCached(false);
    setErrorKey(null);
  }, []);

  return {
    messages,
    conversationId,
    isStreaming,
    cached,
    errorKey,
    sendMessage,
    loadConversation,
    startNew,
  };
}

function updateLast(
  messages: ChatMessage[],
  updater: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  if (messages.length === 0) return messages;
  const copy = [...messages];
  copy[copy.length - 1] = updater(copy[copy.length - 1]);
  return copy;
}
