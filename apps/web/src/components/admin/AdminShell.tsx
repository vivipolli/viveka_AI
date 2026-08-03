import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface Props {
  children: React.ReactNode;
  onLogout?: () => void;
}

export function AdminShell({ children, onLogout }: Props) {
  const { t } = useTranslation();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition max-[500px]:w-full max-[500px]:text-center ${
      isActive
        ? "bg-solar-warm text-solar-text"
        : "text-solar-muted hover:bg-solar-cream hover:text-solar-text"
    }`;

  return (
    <div className="mx-auto min-h-screen max-w-5xl overflow-x-hidden px-4 py-8 pb-[max(3rem,env(safe-area-inset-bottom))] max-[500px]:px-3 max-[500px]:py-4">
      <header className="mb-8 space-y-4 max-[500px]:mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 max-[500px]:flex-col max-[500px]:items-stretch">
          <h1 className="text-2xl font-extrabold text-solar-text max-[500px]:text-xl">
            {t("admin.title")}
          </h1>
          <div className="flex flex-wrap items-center gap-2 max-[500px]:justify-between">
            <NavLink to="/" className="text-sm text-solar-muted hover:text-solar-text">
              {t("admin.backToChat")}
            </NavLink>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg border border-solar-warm bg-white/70 px-3 py-1.5 text-sm font-semibold text-solar-muted transition hover:bg-white hover:text-solar-text"
              >
                {t("admin.logout")}
              </button>
            )}
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 rounded-2xl bg-white/60 p-2 shadow backdrop-blur max-[500px]:flex-col">
          <NavLink to="/admin" end className={linkClass}>
            {t("admin.nav.upload")}
          </NavLink>
          <NavLink to="/admin/documents" className={linkClass}>
            {t("admin.nav.documents")}
          </NavLink>
        </nav>
      </header>

      {children}
    </div>
  );
}
