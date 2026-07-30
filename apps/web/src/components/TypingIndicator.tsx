import { useTranslation } from "react-i18next";

export function TypingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-solar-muted">
      <span className="flex gap-1">
        <span className="typing-dot h-2 w-2 rounded-full bg-solar-orange" />
        <span
          className="typing-dot h-2 w-2 rounded-full bg-solar-orange"
          style={{ animationDelay: "0.2s" }}
        />
        <span
          className="typing-dot h-2 w-2 rounded-full bg-solar-orange"
          style={{ animationDelay: "0.4s" }}
        />
      </span>
      <span className="text-sm">{t("chat.thinking")}</span>
    </div>
  );
}
