import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  disabled: boolean;
  onSend: (question: string) => void;
}

export function ChatInput({ disabled, onSend }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const question = value.trim();
    if (!question || disabled) return;
    onSend(question);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 rounded-2xl border border-solar-warm bg-white/80 p-2 shadow-md backdrop-blur"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={t("chat.placeholder")}
        className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2 text-solar-text outline-none placeholder:text-solar-muted"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="rounded-xl bg-gradient-to-br from-solar-orange to-solar-gold px-5 py-3 font-bold text-white shadow transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("chat.send")}
      </button>
    </form>
  );
}
