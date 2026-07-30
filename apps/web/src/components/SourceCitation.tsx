import { useTranslation } from "react-i18next";
import type { SourceReference } from "shared";

interface Props {
  sources: SourceReference[];
}

/**
 * Lista de fontes citadas. A estrutura ja carrega os dados necessarios
 * para tornar cada referencia clicavel futuramente.
 */
export function SourceCitation({ sources }: Props) {
  const { t } = useTranslation();
  if (sources.length === 0) return null;

  return (
    <div className="mt-4 border-t border-solar-warm pt-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-solar-muted">
        {t("chat.sources")}
      </p>
      <ul className="space-y-1.5">
        {sources.map((source, i) => (
          <li key={`${source.documentId}-${i}`} className="text-sm text-solar-text">
            <span className="font-semibold">{source.title}</span>
            {source.chapter && <span> — {source.chapter}</span>}
            {source.page != null && <span> — p. {source.page}</span>}
            {source.year != null && <span> ({source.year})</span>}
            <p className="text-xs italic text-solar-muted">"{source.excerpt}"</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
