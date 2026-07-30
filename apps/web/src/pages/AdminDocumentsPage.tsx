import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentMetadata } from "shared";
import { AdminShell } from "../components/admin/AdminShell.js";
import { useAdminAuth } from "../hooks/useAdminAuth.js";
import {
  adminDeleteDocument,
  adminDownloadPdf,
  adminFetchChunks,
  adminListDocuments,
  adminReindex,
  adminReprocess,
} from "../lib/api.js";

export function AdminDocumentsPage() {
  const { t } = useTranslation();
  const { password, authed, checking, LoginScreen, logout } = useAdminAuth();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<
    Record<string, { index: number; content: string }[]>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      setDocuments(await adminListDocuments(password));
    } finally {
      setLoading(false);
    }
  }, [authed, password]);

  useEffect(() => {
    if (authed) refresh();
  }, [authed, refresh]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-solar-muted">
        {t("admin.loading")}
      </div>
    );
  }

  if (!authed) return LoginScreen;

  const toggleDetails = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!chunks[id]) {
      const data = await adminFetchChunks(password, id);
      setChunks((prev) => ({ ...prev, [id]: data }));
    }
  };

  const handleDelete = async (doc: DocumentMetadata) => {
    if (!window.confirm(t("admin.deleteConfirm", { title: doc.title }))) return;
    setBusyId(doc.id);
    try {
      await adminDeleteDocument(password, doc.id);
      if (expandedId === doc.id) setExpandedId(null);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (doc: DocumentMetadata) => {
    setBusyId(doc.id);
    try {
      await adminDownloadPdf(password, doc.id, `${doc.title}.pdf`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell onLogout={logout}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-solar-text">
            {t("admin.documentsTitle")}
          </h2>
          <p className="text-sm text-solar-muted">
            {t("admin.documentsCount", { count: documents.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => adminReindex(password).then(refresh)}
          className="rounded-xl border border-solar-warm bg-white/70 px-4 py-2 text-sm font-semibold transition hover:bg-white"
        >
          {t("admin.reindex")}
        </button>
      </div>

      {loading ? (
        <p className="text-solar-muted">{t("admin.loading")}</p>
      ) : documents.length === 0 ? (
        <p className="rounded-2xl bg-white/70 p-6 text-solar-muted shadow backdrop-blur">
          {t("admin.noDocuments")}
        </p>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <article
              key={doc.id}
              className="rounded-2xl bg-white/70 p-4 shadow backdrop-blur"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-solar-text">{doc.title}</h3>
                  <p className="mt-1 text-xs text-solar-muted">
                    {t(`admin.types.${doc.type}`)} · {doc.language} ·{" "}
                    {doc.chunkCount ?? 0} {t("admin.chunkCount")} ·{" "}
                    <StatusBadge status={doc.status} />
                  </p>
                  <p className="mt-1 text-xs text-solar-muted">
                    {t("admin.importedAt", {
                      date: new Date(doc.createdAt).toLocaleString(),
                    })}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDetails(doc.id)}
                    className="rounded-lg border border-solar-warm bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white"
                  >
                    {expandedId === doc.id
                      ? t("admin.hideDetails")
                      : t("admin.viewDetails")}
                  </button>
                  {doc.type === "pdf" && doc.hasFile && (
                    <button
                      type="button"
                      disabled={busyId === doc.id}
                      onClick={() => handleDownload(doc)}
                      className="rounded-lg border border-solar-warm bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-50"
                    >
                      {t("admin.download")}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => {
                      setBusyId(doc.id);
                      adminReprocess(password, doc.id)
                        .then(refresh)
                        .finally(() => setBusyId(null));
                    }}
                    className="rounded-lg border border-solar-warm bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white disabled:opacity-50"
                  >
                    {t("admin.reprocess")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => handleDelete(doc)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </div>

              {expandedId === doc.id && (
                <div className="mt-4 space-y-4 border-t border-solar-warm pt-4">
                  <MetadataGrid doc={doc} />
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-solar-muted">
                      {t("admin.chunks")}
                    </p>
                    {chunks[doc.id]?.length ? (
                      <div className="space-y-2">
                        {chunks[doc.id].map((chunk) => (
                          <p
                            key={chunk.index}
                            className="rounded-lg bg-solar-cream px-3 py-2 text-xs text-solar-text"
                          >
                            {chunk.content.slice(0, 320)}
                            {chunk.content.length > 320 ? "..." : ""}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-solar-muted">
                        {t("admin.noChunks")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function MetadataGrid({ doc }: { doc: DocumentMetadata }) {
  const { t } = useTranslation();
  const items = [
    { label: t("admin.author"), value: doc.author },
    { label: t("admin.chapter"), value: doc.chapter },
    { label: t("admin.page"), value: doc.page?.toString() },
    { label: t("admin.year"), value: doc.year?.toString() },
    { label: t("admin.source"), value: doc.source },
  ].filter((item) => item.value);

  if (items.length === 0) {
    return (
      <p className="text-xs text-solar-muted">{t("admin.noMetadata")}</p>
    );
  }

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-solar-cream/60 px-3 py-2">
          <dt className="text-xs font-bold uppercase text-solar-muted">
            {item.label}
          </dt>
          <dd className="text-sm text-solar-text">{item.value}</dd>
        </div>
      ))}
    </dl>
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
