import { useState } from "react";
import { useTranslation } from "react-i18next";
import { sendFeedback } from "../lib/api.js";

interface Props {
  question: string;
}

export function FeedbackButtons({ question }: Props) {
  const { t } = useTranslation();
  const [sent, setSent] = useState<null | 1 | -1>(null);

  const handle = async (rating: 1 | -1) => {
    if (sent) return;
    setSent(rating);
    await sendFeedback(question, rating);
  };

  if (sent) {
    return <p className="mt-2 text-xs text-solar-muted">{t("feedback.thanks")}</p>;
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={() => handle(1)}
        aria-label={t("feedback.useful")}
        className="rounded-full border border-solar-warm bg-white/70 px-3 py-1 text-sm transition hover:border-solar-orange hover:bg-white"
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => handle(-1)}
        aria-label={t("feedback.notUseful")}
        className="rounded-full border border-solar-warm bg-white/70 px-3 py-1 text-sm transition hover:border-solar-orange hover:bg-white"
      >
        👎
      </button>
    </div>
  );
}
