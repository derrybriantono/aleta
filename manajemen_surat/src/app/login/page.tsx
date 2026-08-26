"use client";

import { useRouter } from "next/navigation";
import {
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  Landmark,
  MessageCircle,
  Scale,
  ScrollText,
  Smartphone,
  Timer,
  UploadCloud,
  UserCog,
  WalletCards,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { apiPath } from "@/lib/base-path";
import { APP_VERSION } from "@/lib/patch-notes";

const loginBackgroundImageUrl =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Mahkamah_Agung_RI_%2830437101575%29_%28cropped%29.jpg/1280px-Mahkamah_Agung_RI_%2830437101575%29_%28cropped%29.jpg";
const backgroundImage = `url('${loginBackgroundImageUrl}')`;
const COPYRIGHT_URL = "https://www.instagram.com/derrybriantono?igsh=M2VtOGljMGJkOXBt";
const DEFAULT_LOGIN_INSTITUTION_NAME = "Pengadilan Digital";
const REMEMBER_ACCOUNT_STORAGE_KEY = "aleta:remembered-login-identifier";
const authInputClass =
  "h-12 border-input/90 bg-card/80 text-base text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-primary/40 dark:border-white/15 dark:bg-white/[0.07] dark:text-slate-100 dark:placeholder:text-slate-400";
const authPanelClass =
  "border-border/80 bg-card/70 text-foreground shadow-none dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100";
const activeAuthTabClass =
  "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(20,93,137,0.2)] dark:shadow-[0_10px_24px_rgba(56,189,248,0.22)]";
const inactiveAuthTabClass =
  "text-muted-foreground hover:bg-accent/75 hover:text-accent-foreground dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white";
const primaryActionClass = "w-full bg-primary text-primary-foreground hover:bg-primary/90";

function getAuthErrorMessage(error: unknown) {
  const authError = error as { message?: string; status?: number; statusCode?: number; code?: string } | null;
  const status = Number(authError?.status ?? authError?.statusCode ?? 0);
  const code = String(authError?.code ?? "");

  if (status >= 500 || code.includes("INTERNAL")) {
    return "Layanan login sedang bermasalah. Muat ulang halaman atau restart server lokal, lalu coba lagi.";
  }

  return authError?.message || "Password tidak sesuai dengan akun ALETA.";
}

type AuthMode = "login" | "forgot" | "public";
type RecoveryPath = "otp" | "admin-help";

type OtpResetState = {
  userId: string;
  username: string;
  name: string;
  maskedWhatsapp: string;
};

type AdminHelpDoneState = {
  requestId: string;
  name: string;
};

type LoginInstitutionBranding = {
  courtName?: string;
  courtShortName?: string;
  logoUrl?: string;
  mobilePhone?: string;
  csWhatsappNumber?: string;
  botWhatsappNumber?: string;
};

const publicServiceLinks = [
  { href: "/public/e-kepegawaian/cuti", label: "Cuti", icon: CalendarCheck2 },
  { href: "/public/e-kepegawaian/upload-pck", label: "PCK", icon: UploadCloud },
  { href: "/public/e-kepegawaian/upload-skp", label: "SKP", icon: FileCheck2 },
  { href: "/public/e-kepegawaian/wfa", label: "WFA", icon: ClipboardCheck },
  { href: "/public/e-kepegawaian/lambat-datang", label: "Lambat Datang", icon: Clock3 },
  { href: "/public/e-kepegawaian/cepat-pulang", label: "Pulang Cepat", icon: Clock3 },
  { href: "/public/e-kepegawaian/cek-status", label: "Cek Status", icon: CheckCircle2 },
  { href: "/public/e-kepegawaian/agenda-rapat", label: "Agenda Rapat", icon: ScrollText },
];

function normalizeWhatsappNumber(value = "") {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const [mode, setMode] = useState<AuthMode>("login");
  const [institutionBranding, setInstitutionBranding] = useState<LoginInstitutionBranding>({});

  // Login state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginNotice, setLoginNotice] = useState("");

  // Shared error
  const [error, setError] = useState("");

  // Recovery shared fields
  const [recoveryPath, setRecoveryPath] = useState<RecoveryPath>("otp");
  const [recoveryIdentifier, setRecoveryIdentifier] = useState("");

  // OTP path state
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [otpResetState, setOtpResetState] = useState<OtpResetState | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Admin-help path state
  const [isSubmittingAdminHelp, setIsSubmittingAdminHelp] = useState(false);
  const [adminHelpDone, setAdminHelpDone] = useState<AdminHelpDoneState | null>(null);
  const loginInstitutionName = institutionBranding.courtName?.trim() || DEFAULT_LOGIN_INSTITUTION_NAME;
  const publicWhatsappNumber = normalizeWhatsappNumber(
    institutionBranding.botWhatsappNumber || institutionBranding.csWhatsappNumber || institutionBranding.mobilePhone || ""
  );
  const publicWhatsappHref = publicWhatsappNumber
    ? `https://wa.me/${publicWhatsappNumber}?text=${encodeURIComponent("Assalamu'alaikum. Saya ingin menggunakan layanan E-Kepegawaian ALETA tanpa login. Mohon tautan form publik dan panduan aman.")}`
    : "";

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleLogin();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const rememberedIdentifier = readRememberedLoginIdentifier();
      if (rememberedIdentifier) {
        setIdentifier(rememberedIdentifier);
        setRememberAccount(true);
      }

      setIsClientReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isClientReady && !isSubmitting && session?.user) {
      router.replace("/portal");
    }
  }, [isClientReady, isSubmitting, router, session?.user]);

  useEffect(() => {
    const controller = new AbortController();

    void fetch(apiPath("/api/public/institution"), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: LoginInstitutionBranding }
          | null;

        if (response.ok && payload?.ok && payload.data) {
          setInstitutionBranding(payload.data);
        }
      })
      .catch((fetchError) => {
        if ((fetchError as { name?: string })?.name !== "AbortError") {
          setInstitutionBranding({});
        }
      });

    return () => controller.abort();
  }, []);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
    setLoginNotice("");
    setRecoveryIdentifier("");
    setOtpResetState(null);
    setAdminHelpDone(null);
    setOtpInput("");
    setNewPassword("");
    setConfirmPassword("");
    setRecoveryPath("otp");
  }

  const handleLogin = async () => {
    if (!isClientReady || isSubmitting) {
      return;
    }

    const normalizedIdentifier = identifier.trim();
    const normalizedPassword = password.trim();
    if (!normalizedIdentifier || !normalizedPassword) {
      setError("Masukkan identitas akun dan password.");
      setLoginNotice("");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setLoginNotice("");

    try {
      const lookupResponse = await fetch(apiPath(`/api/users/lookup?identifier=${encodeURIComponent(normalizedIdentifier)}`), {
        credentials: "include",
        cache: "no-store",
      });
      const lookupPayload = (await lookupResponse.json().catch(() => null)) as
        | { ok?: boolean; data?: { user?: { id: string; email: string } }; error?: { message?: string } }
        | null;

      if (!lookupResponse.ok || !lookupPayload?.ok || !lookupPayload.data?.user) {
        throw new Error(lookupPayload?.error?.message ?? "Akun tidak ditemukan atau sudah tidak aktif.");
      }

      const user = lookupPayload.data.user;
      const { error: authError } = await authClient.signIn.email({
        email: user.email,
        password: normalizedPassword,
        rememberMe: rememberAccount,
      });

      if (authError) {
        throw new Error(getAuthErrorMessage(authError));
      }

      if (rememberAccount) {
        rememberLoginIdentifier(normalizedIdentifier);
      } else {
        clearRememberedLoginIdentifier();
      }

      setLoginNotice("Login berhasil. Menyiapkan Portal ALETA...");
      await refetchSession().catch(() => undefined);
      router.replace("/portal");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login belum berhasil. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestOtp = async () => {
    if (!recoveryIdentifier.trim()) {
      setError("Masukkan identitas akun terlebih dahulu.");
      return;
    }

    setIsRequestingOtp(true);
    setError("");

    try {
      const response = await fetch(apiPath("/api/users/recovery/request"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: recoveryIdentifier.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: {
              whatsappReady: boolean;
              recovery?: OtpResetState | null;
            };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "Permintaan OTP gagal diproses.");
      }

      if (!payload.data?.whatsappReady || !payload.data.recovery) {
        // WhatsApp not ready, suggest admin help.
        setError(
          "Layanan WhatsApp belum aktif, sehingga OTP belum dapat dikirim. Gunakan Bantuan Admin untuk melanjutkan."
        );
        return;
      }

      setOtpResetState(payload.data.recovery);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Permintaan OTP gagal diproses.");
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const confirmReset = async () => {
    if (!otpResetState) return;

    if (!newPassword.trim() || newPassword.trim().length < 8) {
      setError("Password baru minimal 8 karakter.");
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Password baru harus mengandung huruf dan angka.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password belum cocok.");
      return;
    }

    setIsResetting(true);
    setError("");

    try {
      const response = await fetch(apiPath("/api/users/recovery/confirm"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: otpResetState.userId,
          otp: otpInput.trim(),
          password: newPassword.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "Reset password gagal diproses.");
      }

      setIdentifier(otpResetState.username);
      setPassword("");
      setMode("login");
      setRecoveryIdentifier("");
      setOtpInput("");
      setNewPassword("");
      setConfirmPassword("");
      setLoginNotice(`Password akun ${otpResetState.username} berhasil direset. Silakan login ulang.`);
      setOtpResetState(null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Reset password gagal diproses.");
    } finally {
      setIsResetting(false);
    }
  };

  const submitAdminHelp = async () => {
    if (!recoveryIdentifier.trim()) {
      setError("Masukkan identitas akun terlebih dahulu.");
      return;
    }

    setIsSubmittingAdminHelp(true);
    setError("");

    try {
      const response = await fetch(apiPath("/api/users/recovery/admin-request"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: recoveryIdentifier.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { requestId: string; name: string; message: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.error?.message ?? "Pengajuan bantuan admin gagal diproses.");
      }

      setAdminHelpDone({ requestId: payload.data.requestId, name: payload.data.name });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Pengajuan bantuan admin gagal diproses.");
    } finally {
      setIsSubmittingAdminHelp(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground"
      style={{
        backgroundImage,
        backgroundPosition: "center top",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,164,65,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(20,93,137,0.18),transparent_30%),linear-gradient(135deg,rgba(245,249,252,0.82),rgba(226,235,241,0.7))] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.2),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.74),rgba(8,25,41,0.72))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-600/25 to-transparent dark:via-amber-200/40" />
      <div className="pointer-events-none absolute -left-14 bottom-8 hidden h-80 w-80 rounded-full border border-amber-600/10 dark:border-amber-200/10 lg:block" />
      <div className="pointer-events-none absolute right-10 top-20 hidden text-slate-700/10 dark:text-amber-100/10 lg:block">
        <Scale className="h-44 w-44" strokeWidth={1} />
      </div>

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <Card className="relative w-full max-w-[880px] overflow-hidden rounded-[1.35rem] border-border/80 bg-card/[0.92] text-foreground shadow-[0_26px_78px_rgba(12,38,58,0.16)] backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/[0.92] dark:text-slate-100 dark:shadow-[0_26px_78px_rgba(0,0,0,0.42)]">
        <CardContent className="grid p-0 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="relative flex min-w-0 flex-col justify-between overflow-hidden border-b border-white/15 bg-[linear-gradient(135deg,rgba(21,69,103,0.96),rgba(32,98,139,0.88))] p-6 text-white lg:min-h-[470px] lg:border-b-0 lg:border-r lg:p-8 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(8,31,49,0.98),rgba(15,63,96,0.92))]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_34%),linear-gradient(135deg,rgba(251,191,36,0.13),transparent_36%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_34%),linear-gradient(135deg,rgba(251,191,36,0.1),transparent_36%)]" />
            <div className="absolute -right-12 bottom-8 text-amber-50/10 dark:text-amber-100/10">
              <Scale className="h-52 w-52" strokeWidth={1.1} />
            </div>
            <div className="absolute left-8 top-8 flex gap-3 opacity-25">
              {[0, 1, 2].map((item) => (
                <span key={item} className="h-28 w-3 rounded-full bg-gradient-to-b from-amber-100/70 via-white/40 to-transparent" />
              ))}
            </div>
            <div className="relative space-y-8">
              <AletaLogo
                title="ALETA"
                subtitle="Akses Layanan Elektronik Terpadu Aksesibel"
                size="lg"
                logoUrl={institutionBranding.logoUrl}
                className="[&_p]:text-white [&_p:last-child]:text-slate-200"
              />
              <div className="space-y-4">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-left text-xs font-semibold tracking-[0.08em] text-amber-100 sm:tracking-[0.12em]">
                  <Landmark className="h-4 w-4" />
                  <span className="min-w-0 truncate">{loginInstitutionName}</span>
                </div>
                <h1 className="max-w-full whitespace-nowrap font-serif text-[clamp(1.1rem,1.75vw,1.45rem)] leading-tight text-white">
                  Portal Layanan Elektronik Terpadu
                </h1>
                <p className="max-w-sm text-sm leading-6 text-slate-200">
                  <span className="block">SSO (Single Sign On)</span>
                  <span className="block">Portal Aplikasi {loginInstitutionName}</span>
                </p>
              </div>
            </div>
            <div className="relative mt-10 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-200">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                  <ScrollText className="mb-2 h-4 w-4 text-amber-200" />
                  Sederhana
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                  <Timer className="mb-2 h-4 w-4 text-amber-200" />
                  Cepat
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                  <WalletCards className="mb-2 h-4 w-4 text-amber-200" />
                  Biaya Ringan
                </div>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-300">
                Patch Notes v{APP_VERSION}
              </p>
            </div>
          </section>

          <section className="relative min-w-0 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--muted)/0.58))] p-6 text-foreground lg:p-7 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.94))] dark:text-slate-100">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-600/25 to-transparent dark:via-amber-200/40" />
            <div className="mb-5 grid w-full grid-cols-[0.95fr_1fr_1.15fr] gap-1 rounded-2xl border border-border/80 bg-muted/60 p-1 dark:border-white/15 dark:bg-white/[0.06]">
              <button
                type="button"
                className={`whitespace-nowrap rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition sm:px-2 sm:text-xs ${mode === "login" ? activeAuthTabClass : inactiveAuthTabClass}`}
                onClick={() => switchMode("login")}
              >
                Login ALETA
              </button>
              <button
                type="button"
                className={`whitespace-nowrap rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition sm:px-2 sm:text-xs ${mode === "forgot" ? activeAuthTabClass : inactiveAuthTabClass}`}
                onClick={() => switchMode("forgot")}
              >
                Lupa Password
              </button>
              <button
                type="button"
                className={`whitespace-nowrap rounded-xl px-1.5 py-1.5 text-[11px] font-semibold transition sm:px-2 sm:text-xs ${mode === "public" ? activeAuthTabClass : inactiveAuthTabClass}`}
                onClick={() => switchMode("public")}
              >
                E-Kepegawaian
              </button>
            </div>

            {mode === "login" ? (
              <form className="space-y-5" noValidate onSubmit={handleLoginSubmit}>
                <Field label="Identitas">
                  <Input
                    id="identifier"
                    data-testid="login-identifier"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="Username ALETA/SIPP, email, NIP, atau nomor HP"
                    autoComplete="username email"
                    disabled={!isClientReady || isSubmitting}
                    className={authInputClass}
                  />
                </Field>

                <Field label="Password">
                  <div className="relative">
                    <Input
                      id="password"
                      data-testid="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Masukkan password"
                      autoComplete="current-password"
                      disabled={!isClientReady || isSubmitting}
                      className={`${authInputClass} pr-12`}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-white/10"
                      onClick={() => setShowLoginPassword((visible) => !visible)}
                      disabled={!isClientReady || isSubmitting}
                      aria-label={showLoginPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/75 bg-card/70 px-4 py-3 text-sm text-muted-foreground transition hover:bg-card dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:bg-white/[0.075]">
                  <input
                    type="checkbox"
                    checked={rememberAccount}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setRememberAccount(checked);
                      if (!checked) {
                        clearRememberedLoginIdentifier();
                      }
                    }}
                    disabled={!isClientReady || isSubmitting}
                    className="mt-1 h-4 w-4 rounded border-input accent-primary dark:border-white/20"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground dark:text-slate-100">Simpan login akun</span>
                    <span className="block text-xs leading-5 text-slate-500 dark:text-slate-400">
                      Simpan sesi akun. Tanpa password.
                    </span>
                  </span>
                </label>

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-300/40 dark:bg-rose-500/10 dark:text-rose-100">
                    {error}
                  </div>
                ) : null}

                {loginNotice ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-300/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                    {loginNotice}
                  </div>
                ) : null}

                <Button
                  data-testid="login-submit"
                  type="submit"
                  className={primaryActionClass}
                  size="lg"
                  disabled={!isClientReady || isSubmitting}
                  aria-busy={isSubmitting}
                >
                  {!isClientReady ? "Menyiapkan login..." : isSubmitting ? "Memverifikasi akun..." : "Login"}
                </Button>

                <div className="text-center text-[11px] leading-5 text-muted-foreground dark:text-slate-400">
                  <a
                    href={COPYRIGHT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline-offset-4 transition hover:text-primary hover:underline dark:hover:text-sky-200"
                  >
                    Copyright &copy; 2025 Derry Briantono
                  </a>
                </div>
              </form>
            ) : mode === "public" ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/80 bg-card/70 p-4 dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="text-sm font-semibold text-foreground dark:text-slate-100">E-Kepegawaian publik</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground dark:text-slate-400">
                    Pegawai bisa mengirim permohonan atau setoran melalui URL langsung, tab ini, atau WhatsApp resmi. Semua tetap masuk workflow E-Kepegawaian.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {publicServiceLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.href}
                        href={apiPath(item.href)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/75 bg-background/55 px-3 py-2 text-left text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-200 dark:hover:text-sky-200"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0">{item.label}</span>
                      </a>
                    );
                  })}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <a
                    href={apiPath("/public/e-kepegawaian")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary transition hover:bg-primary/15 dark:text-sky-200"
                  >
                    <ScrollText className="h-4 w-4" />
                    Semua Layanan
                  </a>
                  {publicWhatsappHref ? (
                    <a
                      href={publicWhatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/50 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-300/25 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-500/15"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  ) : (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
                      Nomor WhatsApp publik belum diatur.
                    </p>
                  )}
                </div>

                <p className="text-xs leading-5 text-muted-foreground dark:text-slate-400">
                  Hindari mengirim password, NIP/NIK lengkap, atau dokumen sensitif melalui chat. Gunakan halaman publik ALETA untuk pengisian data.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2 rounded-[1.2rem] border border-border/80 bg-muted/60 p-1 dark:border-white/10 dark:bg-white/[0.05]">
                  <button
                    type="button"
                    className={`rounded-[0.9rem] px-3 py-2.5 text-sm font-semibold transition ${
                      recoveryPath === "otp"
                        ? "bg-card text-foreground shadow-sm dark:bg-white/[0.12] dark:text-white"
                        : "text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-white"
                    }`}
                    onClick={() => {
                      setRecoveryPath("otp");
                      setError("");
                      setAdminHelpDone(null);
                    }}
                  >
                    <Smartphone className="mb-0.5 inline h-4 w-4" /> OTP WhatsApp
                  </button>
                  <button
                    type="button"
                    className={`rounded-[0.9rem] px-3 py-2.5 text-sm font-semibold transition ${
                      recoveryPath === "admin-help"
                        ? "bg-card text-foreground shadow-sm dark:bg-white/[0.12] dark:text-white"
                        : "text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-white"
                    }`}
                    onClick={() => {
                      setRecoveryPath("admin-help");
                      setError("");
                      setOtpResetState(null);
                    }}
                  >
                    <UserCog className="mb-0.5 inline h-4 w-4" /> Bantuan Admin
                  </button>
                </div>

                {recoveryPath === "otp" ? (
                  !otpResetState ? (
                    <div className="space-y-4">
                      <Field label="Identitas Akun">
                        <Input
                          value={recoveryIdentifier}
                          onChange={(event) => setRecoveryIdentifier(event.target.value)}
                          placeholder="Username, NIP, email, atau nomor WA"
                          className={authInputClass}
                        />
                      </Field>
                      {error ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-300/40 dark:bg-rose-500/10 dark:text-rose-100">
                          {error}
                          {error.includes("Bantuan Admin") ? (
                            <button
                              type="button"
                              className="ml-2 font-semibold underline"
                              onClick={() => {
                                setRecoveryPath("admin-help");
                                setError("");
                              }}
                            >
                              Pindah ke Bantuan Admin
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        className={primaryActionClass}
                        size="lg"
                        disabled={isRequestingOtp}
                        onClick={() => void requestOtp()}
                      >
                        <Smartphone className="h-4 w-4" />
                        {isRequestingOtp ? "Mengirim OTP..." : "Kirim OTP ke WhatsApp"}
                      </Button>
                      <p className="text-center text-xs text-slate-500 dark:text-slate-400">OTP berlaku 10 menit setelah dikirim ke nomor WhatsApp terdaftar.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-[1.3rem] border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-300/40 dark:bg-emerald-500/10">
                        <p className="font-semibold text-emerald-800 dark:text-emerald-100">OTP telah dikirim ke WhatsApp</p>
                        <p className="mt-1 text-emerald-700 dark:text-emerald-200">
                          Nomor: <strong>{otpResetState.maskedWhatsapp}</strong> - a/n <strong>{otpResetState.name}</strong>
                        </p>
                      </div>

                      <Field label="Kode OTP (6 digit)">
                        <Input
                          value={otpInput}
                          onChange={(event) => setOtpInput(event.target.value)}
                          placeholder="Masukkan 6 digit OTP dari WhatsApp"
                          className={authInputClass}
                          maxLength={6}
                        />
                      </Field>
                      <Field label="Password Baru">
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          placeholder="Min. 8 karakter, mengandung huruf dan angka"
                          className={authInputClass}
                        />
                      </Field>
                      <Field label="Konfirmasi Password Baru">
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Ulangi password baru"
                          className={authInputClass}
                        />
                      </Field>

                      {error ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-300/40 dark:bg-rose-500/10 dark:text-rose-100">
                          {error}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          size="lg"
                          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                          disabled={isResetting}
                          onClick={() => void confirmReset()}
                        >
                          <KeyRound className="h-4 w-4" />
                          {isResetting ? "Menyimpan password..." : "Atur Ulang Password"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className={authPanelClass}
                          onClick={() => {
                            setOtpResetState(null);
                            setOtpInput("");
                            setNewPassword("");
                            setConfirmPassword("");
                            setError("");
                          }}
                        >
                          Ulangi
                        </Button>
                      </div>
                    </div>
                  )
                ) : null}

                {recoveryPath === "admin-help" ? (
                  !adminHelpDone ? (
                    <div className="space-y-4">
                      <Field label="Identitas Akun">
                        <Input
                          value={recoveryIdentifier}
                          onChange={(event) => setRecoveryIdentifier(event.target.value)}
                          placeholder="Username, NIP, email, atau nomor WA"
                          className={authInputClass}
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">Admin akan memverifikasi dan memberikan password sementara secara langsung.</p>
                      </Field>
                      {error ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-300/40 dark:bg-rose-500/10 dark:text-rose-100">
                          {error}
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        className={primaryActionClass}
                        size="lg"
                        disabled={isSubmittingAdminHelp}
                        onClick={() => void submitAdminHelp()}
                      >
                        <UserCog className="h-4 w-4" />
                        {isSubmittingAdminHelp ? "Mengirim permintaan..." : "Ajukan Bantuan Reset ke Admin"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-[1.3rem] border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-300/40 dark:bg-emerald-500/10">
                        <p className="font-semibold text-emerald-800 dark:text-emerald-100">Permintaan berhasil dikirim</p>
                        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-200">
                          Permintaan reset password untuk akun <strong>{adminHelpDone.name}</strong> telah dicatat.
                          Admin atau Super Admin akan segera memproses dan menyampaikan password sementara secara langsung.
                        </p>
                        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">
                          ID Permintaan: {adminHelpDone.requestId}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full ${authPanelClass}`}
                        onClick={() => {
                          setAdminHelpDone(null);
                          setRecoveryIdentifier("");
                          setError("");
                        }}
                      >
                        Ajukan Permintaan Baru
                      </Button>
                      <Button
                        type="button"
                        className={primaryActionClass}
                        onClick={() => switchMode("login")}
                      >
                        Kembali ke Login
                      </Button>
                    </div>
                  )
                ) : null}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </main>
  );
}

function readRememberedLoginIdentifier() {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(REMEMBER_ACCOUNT_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function rememberLoginIdentifier(identifier: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(REMEMBER_ACCOUNT_STORAGE_KEY, identifier);
  } catch {
    // Browser storage may be unavailable; login should continue normally.
  }
}

function clearRememberedLoginIdentifier() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(REMEMBER_ACCOUNT_STORAGE_KEY);
  } catch {
    // Browser storage may be unavailable; login should continue normally.
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground dark:text-slate-100">{label}</label>
      {children}
    </div>
  );
}

