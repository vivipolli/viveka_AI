import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "shared";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { Logo } from "./Logo.js";

interface Props {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function MobileMenu({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
}: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const handleNew = () => {
    onNew();
    onClose();
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-solar-text/25 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(88vw,20rem)] flex-col border-r border-solar-warm/60 bg-white/95 shadow-xl backdrop-blur transition-transform duration-300 ease-out md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
        aria-label={t("menu.title")}
      >
        <div className="flex items-start justify-between gap-3 border-b border-solar-warm/40 px-4 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <Logo />
            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-tight text-solar-text">
                {t("app.title")}
              </p>
              <p className="mt-1 text-xs leading-snug text-solar-muted">
                {t("app.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-solar-muted transition hover:bg-solar-cream hover:text-solar-text"
            aria-label={t("menu.close")}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-4 py-4">
          <button
            type="button"
            onClick={handleNew}
            className="w-full rounded-xl bg-gradient-to-br from-solar-orange to-solar-gold px-4 py-3 font-bold text-white shadow transition hover:brightness-105"
          >
            + {t("chat.newConversation")}
          </button>

          <section>
            <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wide text-solar-muted">
              {t("chat.history")}
            </p>
            {conversations.length === 0 ? (
              <p className="px-1 text-sm text-solar-muted">{t("chat.emptyHistory")}</p>
            ) : (
              <ul className="max-h-52 space-y-2 overflow-y-auto">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(conversation.id)}
                      className={`w-full truncate rounded-lg px-3 py-3 text-left text-sm transition ${
                        activeId === conversation.id
                          ? "bg-solar-warm font-semibold text-solar-text"
                          : "text-solar-muted hover:bg-solar-cream"
                      }`}
                      title={conversation.title}
                    >
                      {conversation.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wide text-solar-muted">
              {t("language.label")}
            </p>
            <LanguageSwitcher variant="menu" />
          </section>
        </div>
      </aside>
    </>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
