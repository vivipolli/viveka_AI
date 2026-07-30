import { useTranslation } from "react-i18next";

const LANGUAGES = ["pt", "en", "es", "bn"] as const;

interface Props {
  variant?: "compact" | "menu";
}

export function LanguageSwitcher({ variant = "compact" }: Props) {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage ?? "pt";

  if (variant === "menu") {
    return (
      <div className="flex flex-col gap-2">
        {LANGUAGES.map((lng) => {
          const selected = current === lng;
          return (
            <button
              key={lng}
              type="button"
              onClick={() => i18n.changeLanguage(lng)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                selected
                  ? "border-solar-orange bg-solar-warm text-solar-text"
                  : "border-solar-warm bg-white text-solar-muted hover:border-solar-orange hover:bg-solar-cream hover:text-solar-text"
              }`}
            >
              <span>{t(`language.${lng}`)}</span>
              {selected && (
                <span className="text-xs font-bold uppercase text-solar-orange">
                  {lng}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-full bg-white/60 p-1 shadow-sm backdrop-blur">
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => i18n.changeLanguage(lng)}
          className={`rounded-full px-3 py-1 text-sm font-semibold uppercase transition ${
            current === lng
              ? "bg-solar-orange text-white shadow"
              : "text-solar-muted hover:text-solar-text"
          }`}
        >
          {lng}
        </button>
      ))}
    </div>
  );
}
