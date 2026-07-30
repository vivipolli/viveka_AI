import { useTranslation } from "react-i18next";

interface Props {
  text: string;
}

/** Destaque visual para a sugestao de leitura do trecho original. */
export function ReadingSuggestion({ text }: Props) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 rounded-xl border border-solar-gold/40 bg-solar-warm/60 px-3 py-3">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-solar-orange">
        {t("chat.readingSuggestion")}
      </p>
      <p className="text-sm leading-relaxed text-solar-text">{text}</p>
    </div>
  );
}
