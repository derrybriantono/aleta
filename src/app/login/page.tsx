"use client";

import { useRouter } from "next/navigation";
import { KeyRound, Smartphone, UserCog } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const backgroundImage =
  "linear-gradient(rgba(8,27,43,0.48), rgba(8,27,43,0.68)), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80')";

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

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<"login" | "forgot">("login");

  // Login state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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

  const handleLoginKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void handleLogin();
  };

  useEffect(() => {
    if (session?.user) {
      router.replace("/portal");
      router.refresh();
    }
  }, [router, session]);

  function switchMode(next: "login" | "forgot") {
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
    const normalizedIdentifier = identifier.trim();
    const normalizedPassword = password.trim();
    if (!normalizedIdentifier || !normalizedPassword) {
      setError("Identitas login atau password tidak valid.");
      setLoginNotice("");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setLoginNotice("");

    try {
      const lookupResponse = await fetch(`/api/users/lookup?identifier=${encodeURIComponent(normalizedIdentifier)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const lookupPayload = (await lookupResponse.json().catch(() => null)) as
        | { ok?: boolean; data?: { user?: { id: string; email: string } }; error?: { message?: string } }
        | null;

      if (!lookupResponse.ok || !lookupPayload?.ok || !lookupPayload.data?.user) {
        throw new Error(lookupPayload?.error?.message ?? "Akun backend tidak ditemukan.");
      }

      const user = lookupPayload.data.user;
      const { error: authError } = await authClient.signIn.email({
        email: user.email,
        password: normalizedPassword,
        rememberMe: true,
      });

      if (authError) {
        throw new Error(authError.message || "Password tidak cocok dengan akun backend ALETA.");
      }

      setLoginNotice("Login berhasil. Menyiapkan dashboard ALETA...");
      router.replace("/portal");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login ALETA gagal diproses.");
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
      const response = await fetch("/api/users/recovery/request", {
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
        // WhatsApp not ready — suggest admin help
        setError(
          "WhatsApp gateway tidak aktif saat ini, OTP tidak dapat dikirim. Gunakan jalur Bantuan Admin di bawah untuk melanjutkan."
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
      const response = await fetch("/api/users/recovery/confirm", {
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
      const response = await fetch("/api/users/recovery/admin-request", {
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
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(15,43,66,0.18),rgba(15,43,66,0.52))] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.42),rgba(15,23,42,0.66))]" />

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <Card className="relative w-full max-w-[1100px] overflow-hidden border-border/80 bg-card/95 shadow-[0_30px_80px_rgba(0,0,0,0.22)]">
        <CardContent className="grid p-0 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
          <section className="relative flex min-w-0 flex-col justify-center overflow-hidden bg-[linear-gradient(135deg,rgba(15,43,66,0.98),rgba(21,74,115,0.94))] p-8 text-white dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.98))] lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%)]" />
            <div className="relative space-y-8">
              <AletaLogo
                title="ALETA"
                subtitle="Akses Layanan Elektronik Terpadu Aksesibel"
                size="lg"
                className="[&_p]:text-white [&_p:last-child]:text-slate-200 [&>div:first-child]:border-white/15 [&>div:first-child]:bg-white/10"
              />
              <h1 className="font-serif text-4xl leading-tight text-white">Portal layanan elektronik terpadu</h1>
            </div>
          </section>

          <section className="min-w-0 p-8 lg:p-10">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/35 p-1">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => switchMode("login")}
              >
                Login ALETA
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "forgot" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => switchMode("forgot")}
              >
                Lupa Password
              </button>
            </div>

            {mode === "login" ? (
              <div className="space-y-5">
                <Field label="Identitas">
                    <Input
                      id="identifier"
                      data-testid="login-identifier"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      onKeyDown={handleLoginKeyDown}
                      placeholder="Masukkan username, email, nomor HP, NIP, atau nama lengkap"
                      autoComplete="username email"
                      className="h-12 text-base"
                    />
                  </Field>

                  <Field label="Password">
                    <Input
                      id="password"
                      data-testid="login-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={handleLoginKeyDown}
                      placeholder="Masukkan password"
                      autoComplete="current-password"
                      className="h-12 text-base"
                    />
                  </Field>

                  {error ? (
                    <div className="rounded-2xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                      {error}
                    </div>
                  ) : null}

                  {loginNotice ? (
                    <div className="rounded-2xl border border-emerald-300/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                      {loginNotice}
                    </div>
                  ) : null}

                  <Button
                    data-testid="login-submit"
                    type="button"
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting}
                    onClick={() => void handleLogin()}
                  >
                    {isSubmitting ? "Memverifikasi akun..." : "Login"}
                  </Button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Pilihan jalur */}
                <div className="grid grid-cols-2 gap-2 rounded-[1.2rem] border border-border bg-muted/30 p-1">
                  <button
                    type="button"
                    className={`rounded-[0.9rem] px-3 py-2.5 text-sm font-semibold transition ${
                      recoveryPath === "otp"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
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
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
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

                {/* ── Jalur OTP WhatsApp ── */}
                {recoveryPath === "otp" ? (
                  !otpResetState ? (
                    <div className="space-y-4">
                      <Field label="Identitas Akun">
                        <Input
                          value={recoveryIdentifier}
                          onChange={(event) => setRecoveryIdentifier(event.target.value)}
                          placeholder="Username, NIP, email, nomor WA, atau nama lengkap"
                          className="h-12 text-base"
                        />
                      </Field>
                      {error ? (
                        <div className="rounded-2xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
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
                              Pindah ke Bantuan Admin →
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        className="w-full"
                        size="lg"
                        disabled={isRequestingOtp}
                        onClick={() => void requestOtp()}
                      >
                        <Smartphone className="h-4 w-4" />
                        {isRequestingOtp ? "Mengirim OTP..." : "Kirim OTP ke WhatsApp"}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">OTP berlaku 10 menit setelah dikirim ke nomor WhatsApp terdaftar.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-[1.3rem] border border-emerald-300/60 bg-emerald-50 p-4 text-sm dark:bg-emerald-950/30">
                        <p className="font-semibold text-emerald-800 dark:text-emerald-200">OTP telah dikirim ke WhatsApp</p>
                        <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                          Nomor: <strong>{otpResetState.maskedWhatsapp}</strong> &mdash; a/n <strong>{otpResetState.name}</strong>
                        </p>
                      </div>

                      <Field label="Kode OTP (6 digit)">
                        <Input
                          value={otpInput}
                          onChange={(event) => setOtpInput(event.target.value)}
                          placeholder="Masukkan 6 digit OTP dari WhatsApp"
                          className="h-12 text-base"
                          maxLength={6}
                        />
                      </Field>
                      <Field label="Password Baru">
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          placeholder="Min. 8 karakter, mengandung huruf dan angka"
                          className="h-12 text-base"
                        />
                      </Field>
                      <Field label="Konfirmasi Password Baru">
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Ulangi password baru"
                          className="h-12 text-base"
                        />
                      </Field>

                      {error ? (
                        <div className="rounded-2xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                          {error}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          size="lg"
                          className="flex-1"
                          disabled={isResetting}
                          onClick={() => void confirmReset()}
                        >
                          <KeyRound className="h-4 w-4" />
                          {isResetting ? "Menyimpan password..." : "Reset Password"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
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

                {/* ── Jalur Bantuan Admin ── */}
                {recoveryPath === "admin-help" ? (
                  !adminHelpDone ? (
                    <div className="space-y-4">
                      <Field label="Identitas Akun">
                        <Input
                          value={recoveryIdentifier}
                          onChange={(event) => setRecoveryIdentifier(event.target.value)}
                          placeholder="Username, NIP, email, nomor WA, atau nama lengkap"
                          className="h-12 text-base"
                        />
                        <p className="text-xs text-muted-foreground">Admin akan memverifikasi dan memberikan password sementara secara langsung.</p>
                      </Field>
                      {error ? (
                        <div className="rounded-2xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                          {error}
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        className="w-full"
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
                      <div className="rounded-[1.3rem] border border-emerald-300/60 bg-emerald-50 p-4 dark:bg-emerald-950/30">
                        <p className="font-semibold text-emerald-800 dark:text-emerald-200">Permintaan berhasil dikirim</p>
                        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                          Permintaan reset password untuk akun <strong>{adminHelpDone.name}</strong> telah dicatat.
                          Admin atau Super Admin akan segera memproses dan menyampaikan password sementara secara langsung.
                        </p>
                        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                          ID Permintaan: {adminHelpDone.requestId}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
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
                        className="w-full"
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
