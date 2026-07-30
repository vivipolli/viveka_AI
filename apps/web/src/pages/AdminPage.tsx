import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { DocumentType } from "shared";
import { DOCUMENT_TYPES } from "shared";
import { AdminShell } from "../components/admin/AdminShell.js";
import { useAdminAuth } from "../hooks/useAdminAuth.js";
import { adminUploadFile, adminUploadText } from "../lib/api.js";

const OPTIONAL_METADATA_TYPES: DocumentType[] = [
  "story",
  "citation",
  "transcript",
];

const DEFAULT_FIELDS = {
  title: "",
  author: "",
  chapter: "",
  page: "",
  year: "",
  type: "pdf" as DocumentType,
  language: "pt",
  source: "",
};

export function AdminPage() {
  const { t } = useTranslation();
  const { authed, checking, password, LoginScreen, logout } = useAdminAuth();

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-solar-muted">
        {t("admin.loading")}
      </div>
    );
  }

  if (!authed) return LoginScreen;

  return (
    <AdminShell onLogout={logout}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-solar-text">
            {t("admin.uploadTitle")}
          </h2>
          <p className="text-sm text-solar-muted">{t("admin.uploadSubtitle")}</p>
        </div>
        <Link
          to="/admin/documents"
          className="rounded-xl border border-solar-warm bg-white/70 px-4 py-2 text-sm font-semibold transition hover:bg-white"
        >
          {t("admin.viewAllDocuments")}
        </Link>
      </div>

      <UploadForm password={password} />
    </AdminShell>
  );
}

function UploadForm({ password }: { password: string }) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [fields, setFields] = useState({ ...DEFAULT_FIELDS });
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const optionalMetadata = OPTIONAL_METADATA_TYPES.includes(fields.type);

  const fieldLabel = (key: string) =>
    optionalMetadata ? `${t(key)} (${t("admin.optional")})` : t(key);

  const setField = (key: keyof typeof fields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSuccess(false);
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
      setFields({ ...DEFAULT_FIELDS });
      setSuccess(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl bg-white/70 p-5 shadow backdrop-blur"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-solar-muted">{t("admin.type")}</span>
        <select
          value={fields.type}
          onChange={(e) => setField("type", e.target.value)}
          className="rounded-lg border border-solar-warm bg-white px-3 py-2 outline-none focus:border-solar-orange"
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`admin.types.${type}`)}
            </option>
          ))}
        </select>
        {optionalMetadata && (
          <span className="text-xs text-solar-muted">
            {t("admin.optionalMetadataHint")}
          </span>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
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

        <Input label={t("admin.docTitle")} value={fields.title} onChange={(v) => setField("title", v)} />
        <Input label={fieldLabel("admin.author")} value={fields.author} onChange={(v) => setField("author", v)} />
        <Input label={fieldLabel("admin.chapter")} value={fields.chapter} onChange={(v) => setField("chapter", v)} />
        <Input label={fieldLabel("admin.page")} value={fields.page} onChange={(v) => setField("page", v)} type="number" />
        <Input label={fieldLabel("admin.year")} value={fields.year} onChange={(v) => setField("year", v)} type="number" />
        <Input label={t("admin.source")} value={fields.source} onChange={(v) => setField("source", v)} />
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

      {success && (
        <p className="text-sm text-green-700">{t("admin.uploadSuccess")}</p>
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
