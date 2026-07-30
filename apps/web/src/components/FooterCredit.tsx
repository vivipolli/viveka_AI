import { useTranslation } from "react-i18next";

export function FooterCredit() {
  const { t } = useTranslation();

  return (
    <p className="mt-3 text-center text-xs text-solar-muted">
      {t("footer.creditBefore")}
      <span className="mx-1 text-solar-orange" aria-hidden>♥</span>
      {t("footer.creditAfter")}
    </p>
  );
}
