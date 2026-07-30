import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { DocumentMetadata } from "shared";
import {
  adminDeleteDocument,
  adminFetchChunks,
  adminListDocuments,
  adminLogin,
  adminReindex,
  adminReprocess,
  adminUploadFile,
  adminUploadText,
} from "../lib/api.js";

const PASSWORD_KEY = "baba_admin_password";

export function AdminPage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState(
    () => sessionStorage.getItem(PASSWORD_KEY) ?? "",
  );
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);

  const refresh = useCallback(async () => {
    setDocuments(await adminListDocuments(password));
  }, [password]);

  useEffect(() => {
    const stored = sessionStorage.getItem(PASSWORD_KEY);
    if (stored) {
      adminLogin(stored).then((ok) => {
        setAuthed(ok);
        if (ok) refresh();
      });
    }
  }, [refresh]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await adminLogin(password);
    setAuthed(ok);
    setLoginError(!ok);
    if (ok) {
      sessionStorage.setItem(PASSWORD_KEY, password);
      refresh();
    }
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm space-y-4 rounded-2xl bg-white/80 p-6 shadow-lg backdrop-blur"
        >
          <h1 className="text-xl font-extrabold text-solar-text">
            {t("admin.title")}
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("admin.password")}
            className="w-full rounded-xl border border-solar-warm bg-white px-4 py-2.5 outline-none focus:border-solar-orange"
          />
          {loginError && (
            <p className="text-sm text-red-600">{t("admin.loginError")}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-br from-solar-orange to-solar-gold px-4 py-2.5 font-bold text-white shadow"
          >
            {t("admin.login")}
          </button>
          <Link
            to="/"
            className="block text-center text-sm text-solar-muted hover:text-solar-text"
          >
            {t("admin.backToChat")}
          </Link>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-solar-text">
          {t("admin.title")}
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => adminReindex(password).then(refresh)}
            className="rounded-xl border border-solar-warm bg-white/70 px-4 py-2 text-sm font-semibold transition hover:bg-white"
          >
            {t("admin.reindex")}
          </button>
          <Link to="/" className="text-sm text-solar-muted hover:text-solar-text">
            {t("admin.backToChat")}
          </Link>
        </div>
      </div>

      <UploadForm password={password} onDone={refresh} />

      <DocumentList
        documents={documents}
        password={password}
        onChanged={refresh}
      />
    </div>
  );
}

function UploadForm({
  password,
  onDone,
}: {
  password: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [fields, setFields] = useState({
    title: "",
    author: "",
    chapter: "",
    page: "",
    year: "",
    type: "book",
    language: "pt",
    source: "",
  });
  const [busy, setBusy] = useState(false);

  const setField = (key: keyof typeof fields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (file) {
        await adminUploadFile(password, file, fields);
      } else if (content.trim()) {
        await adminUploadText(password, {
          ...fields,
          page: fields.page ? Number(fields.page) : undefined,
          year: fields.year ? Number(fields.year) : undefined,
          content,
        });
      }
      setFile(null);
      setContent("");
      setFields({
        title: "",
        author: "",
        chapter: "",
        page: "",
        year: "",
        type: "book",
        language: "pt",
        source: "",
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mb-8 space-y-4 rounded-2xl bg-white/70 p-5 shadow backdrop-blur"
    >
      <h2 className="font-bold text-solar-text">{t("admin.upload")}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t("admin.docTitle")} value={fields.title} onChange={(v) => setField("title", v)} />
        <Input label={t("admin.author")} value={fields.author} onChange={(v) => setField("author", v)} />
        <Input label={t("admin.chapter")} value={fields.chapter} onChange={(v) => setField("chapter", v)} />
        <Input label={t("admin.page")} value={fields.page} onChange={(v) => setField("page", v)} type="number" />
        <Input label={t("admin.year")} value={fields.year} onChange={(v) => setField("year", v)} type="number" />
        <Input label={t("admin.source")} value={fields.source} onChange={(v) => setField("source", v)} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-solar-muted">{t("admin.type")}</span>
          <select
            value={fields.type}
            onChange={(e) => setField("type", e.target.value)}
            className="rounded-lg border border-solar-warm bg-white px-3 py-2 outline-none focus:border-solar-orange"
          >
            <option value="book">book</option>
            <option value="pdf">pdf</option>
            <option value="document">document</option>
            <option value="text">text</option>
            <option value="transcript">transcript</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-solar-muted">{t("admin.language")}</span>
          <select
            value={fields.language}
            onChange={(e) => setField("language", e.target.value)}
            className="rounded-lg border border-solar-warm bg-white px-3 py-2 outline-none focus:border-solar-orange"
          >
            <option value="pt">pt</option>
            <option value="en">en</option>
            <option value="es">es</option>
            <option value="bn">bn</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-solar-muted">{t("admin.uploadFile")}</span>
        <input
          type="file"
          accept=".pdf,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </label>

      {!file && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-solar-muted">{t("admin.content")}</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="rounded-lg border border-solar-warm bg-white px-3 py-2 outline-none focus:border-solar-orange"
          />
        </label>
      )}

      <button
        type="submit"
        disabled={busy || (!file && !content.trim()) || !fields.title}
        className="rounded-xl bg-gradient-to-br from-solar-orange to-solar-gold px-5 py-2.5 font-bold text-white shadow disabled:opacity-50"
      >
        {t("admin.submit")}
      </button>
    </form>
  );
}

function DocumentList({
  documents,
  password,
  onChanged,
}: {
  documents: DocumentMetadata[];
  password: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [chunks, setChunks] = useState<
    Record<string, { index: number; content: string }[]>
  >({});

  if (documents.length === 0) {
    return <p className="text-solar-muted">{t("admin.noDocuments")}</p>;
  }

  const toggleChunks = async (id: string) => {
    if (chunks[id]) {
      setChunks((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    const data = await adminFetchChunks(password, id);
    setChunks((prev) => ({ ...prev, [id]: data }));
  };

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-solar-text">{t("admin.documents")}</h2>
      {documents.map((doc) => (
        <div key={doc.id} className="rounded-2xl bg-white/70 p-4 shadow backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-solar-text">{doc.title}</p>
              <p className="text-xs text-solar-muted">
                {doc.type} · {doc.language} · {doc.chunkCount ?? 0}{" "}
                {t("admin.chunkCount")} ·{" "}
                <StatusBadge status={doc.status} />
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleChunks(doc.id)}
                className="rounded-lg border border-solar-warm bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white"
              >
                {t("admin.viewChunks")}
              </button>
              <button
                type="button"
                onClick={() => adminReprocess(password, doc.id).then(onChanged)}
                className="rounded-lg border border-solar-warm bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white"
              >
                {t("admin.reprocess")}
              </button>
              <button
                type="button"
                onClick={() => adminDeleteDocument(password, doc.id).then(onChanged)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                {t("admin.delete")}
              </button>
            </div>
          </div>

          {chunks[doc.id] && (
            <div className="mt-3 space-y-2 border-t border-solar-warm pt-3">
              <p className="text-xs font-bold uppercase text-solar-muted">
                {t("admin.chunks")}
              </p>
              {chunks[doc.id].map((chunk) => (
                <p
                  key={chunk.index}
                  className="rounded-lg bg-solar-cream px-3 py-2 text-xs text-solar-text"
                >
                  {chunk.content.slice(0, 240)}
                  {chunk.content.length > 240 ? "..." : ""}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentMetadata["status"] }) {
  const { t } = useTranslation();
  const color =
    status === "indexed"
      ? "text-green-700"
      : status === "error"
        ? "text-red-600"
        : "text-solar-muted";
  return <span className={color}>{t(`admin.status.${status}`)}</span>;
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-solar-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-solar-warm bg-white px-3 py-2 outline-none focus:border-solar-orange"
      />
    </label>
  );
}
