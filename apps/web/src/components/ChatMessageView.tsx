import { useTranslation } from "react-i18next";
import type { ChatMessage } from "shared";
import { FeedbackButtons } from "./FeedbackButtons.js";
import { ReadingSuggestion } from "./ReadingSuggestion.js";
import { SourceCitation } from "./SourceCitation.js";

interface Props {
  message: ChatMessage;
  /** Pergunta associada (para feedback em mensagens do assistente). */
  question?: string;
  cached?: boolean;
}

export function ChatMessageView({ message, question, cached }: Props) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  return (
    <div
      className={`flex animate-fade-in-up ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${
          isUser
            ? "bg-gradient-to-br from-solar-orange to-solar-gold text-white"
            : "bg-white/80 text-solar-text backdrop-blur"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

        {!isUser && cached && (
          <p className="mt-2 text-xs italic text-solar-muted">
            {t("chat.cachedNote")}
          </p>
        )}

        {!isUser && message.readingSuggestion && (
          <ReadingSuggestion text={message.readingSuggestion} />
        )}

        {!isUser && message.sources && (
          <SourceCitation sources={message.sources} />
        )}

        {!isUser && question && <FeedbackButtons question={question} />}
      </div>
    </div>
  );
}
