import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { adminLogin } from "../lib/api.js";

export const ADMIN_PASSWORD_KEY = "baba_admin_password";

export function useAdminAuth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState(
    () => sessionStorage.getItem(ADMIN_PASSWORD_KEY) ?? "",
  );
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [checking, setChecking] = useState(true);

  const verify = useCallback(async (value: string) => {
    const ok = await adminLogin(value);
    setAuthed(ok);
    return ok;
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_PASSWORD_KEY);
    if (!stored) {
      setChecking(false);
      return;
    }
    verify(stored).finally(() => setChecking(false));
  }, [verify]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await verify(password);
    setLoginError(!ok);
    if (ok) {
      sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(ADMIN_PASSWORD_KEY);
    setAuthed(false);
    setPassword("");
    navigate("/admin");
  };

  const LoginScreen = (
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

  return {
    password,
    authed,
    checking,
    LoginScreen,
    logout,
  };
}
