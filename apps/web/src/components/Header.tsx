import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { Logo } from "./Logo.js";

export function Header() {
  const { t } = useTranslation();

  return (
    <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <Logo />
        <div>
          <h1 className="text-xl font-extrabold leading-tight text-solar-text">
            {t("app.title")}
          </h1>
          <p className="text-sm text-solar-muted">{t("app.subtitle")}</p>
        </div>
      </div>
      <LanguageSwitcher />
    </header>
  );
}
