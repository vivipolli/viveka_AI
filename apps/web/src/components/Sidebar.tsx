import { useTranslation } from "react-i18next";
import type { Conversation } from "shared";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { Logo } from "./Logo.js";

interface Props {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function Sidebar({ conversations, activeId, onSelect, onNew }: Props) {
  const { t } = useTranslation();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-solar-warm/60 bg-white/55 backdrop-blur md:w-72">
      <div className="flex items-start gap-3 border-b border-solar-warm/40 px-4 py-5 md:px-5 md:py-6">
        <Logo />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold leading-tight text-solar-text">
            {t("app.title")}
          </p>
          <p className="mt-1 text-xs leading-snug text-solar-muted">
            {t("app.subtitle")}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 md:px-5 md:py-5">
        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-xl bg-gradient-to-br from-solar-orange to-solar-gold px-4 py-2.5 font-bold text-white shadow transition hover:brightness-105"
        >
          + {t("chat.newConversation")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-5 md:pb-5">
        <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wide text-solar-muted md:mb-4">
          {t("chat.history")}
        </p>
        {conversations.length === 0 ? (
          <p className="px-1 text-sm text-solar-muted">{t("chat.emptyHistory")}</p>
        ) : (
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={`w-full truncate rounded-lg px-3 py-2.5 text-left text-sm transition md:py-3 ${
                    activeId === c.id
                      ? "bg-solar-warm font-semibold text-solar-text"
                      : "text-solar-muted hover:bg-solar-cream"
                  }`}
                  title={c.title}
                >
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-solar-warm/40 px-4 py-4 md:px-5 md:py-5">
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
