"use client";

import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const backgroundImage =
  "linear-gradient(rgba(8,27,43,0.48), rgba(8,27,43,0.68)), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80')";

function maskWhatsappNumber(value: string) {
  if (value.length <= 6) return value;
  return `${value.slice(0, 4)}xxxx${value.slice(-3)}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginNotice, setLoginNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [nip, setNip] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetState, setResetState] = useState<{
    userId: string;
    username: string;
    name: string;
    maskedWhatsapp: string;
  } | null>(null);

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
    if (!nip.trim()) {
      setError("NIP tidak boleh kosong.");
      return;
    }

    setIsRequestingOtp(true);
    setError("");

    try {
      const response = await fetch("/api/users/recovery/request", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          nip: nip.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: {
              recovery?: {
                userId: string;
                username: string;
                name: string;
                maskedWhatsapp: string;
              };
            };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.data?.recovery) {
        throw new Error(payload?.error?.message ?? "Permintaan OTP gagal diproses.");
      }

      setResetState(payload.data.recovery);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Permintaan OTP gagal diproses.");
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const confirmReset = async () => {
    if (!resetState) return;

    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setError("Password baru minimal 6 karakter.");
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
        headers: {
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userId: resetState.userId,
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

      setIdentifier(resetState.username);
      setPassword("");
      setMode("login");
      setNip("");
      setOtpInput("");
      setNewPassword("");
      setConfirmPassword("");
      setLoginNotice(`Password untuk akun ${resetState.username} berhasil direset di PostgreSQL. Silakan login ulang.`);
      setResetState(null);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Reset password gagal diproses.");
    } finally {
      setIsResetting(false);
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
          <section className="relative flex min-w-0 flex-col justify-between overflow-hidden bg-[linear-gradient(135deg,rgba(15,43,66,0.98),rgba(21,74,115,0.94))] p-8 text-white dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.98))] lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%)]" />
            <div className="relative space-y-6">
              <AletaLogo
                title="ALETA"
                subtitle="Akses Layanan Elektronik Terpadu Aksesibel"
                size="lg"
                className="[&_p]:text-white [&_p:last-child]:text-slate-200 [&>div:first-child]:border-white/15 [&>div:first-child]:bg-white/10"
              />
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-100">Gerbang Login ALETA</p>
                <h1 className="font-serif text-4xl leading-tight">Masuk ke ekosistem kerja digital Pengadilan Agama.</h1>
                <p className="max-w-xl text-sm leading-7 text-slate-200">
                  ALETA adalah induk aplikasi layanan elektronik terpadu. Dari gerbang ini pengguna masuk ke sub-modul
                  seperti Manajemen Surat, dengan dukungan tema gelap-terang dan reset password berbasis NIP serta OTP WhatsApp.
                </p>
              </div>
            </div>

            <div className="relative mt-10 grid gap-4">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/10 p-4">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-sky-100" />
                  <div>
                    <p className="font-semibold">Reset password via WhatsApp</p>
                    <p className="text-sm text-slate-200">Masukkan NIP, validasi akun, lalu reset dengan OTP.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-white/10 p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-sky-100" />
                  <div>
                    <p className="font-semibold">ALETA siap dark/light</p>
                    <p className="text-sm text-slate-200">Semua teks menggunakan palet yang tetap terbaca jelas pada kedua mode.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0 p-8 lg:p-10">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/35 p-1">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Login ALETA
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mode === "forgot" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
              >
                Lupa Password
              </button>
            </div>

            {mode === "login" ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="font-serif text-3xl text-foreground">Login ALETA</h2>
                  <p className="text-sm leading-7 text-muted-foreground">
                    Gunakan username, email, nomor WhatsApp, NIP, atau nama lengkap beserta password untuk membuka ALETA.
                  </p>
                </div>

                <div className="space-y-5">
                  <Field label="Username / Email / Nomor HP / NIP / Nama Lengkap">
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
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="font-serif text-3xl text-foreground">Reset password via OTP</h2>
                  <p className="text-sm leading-7 text-muted-foreground">
                    Masukkan NIP, validasi akun, lalu reset dengan OTP yang dikirim ke WhatsApp terdaftar.
                  </p>
                </div>

                {!resetState ? (
                  <div className="space-y-5">
                    <Field label="NIP Terdaftar">
                      <Input
                        value={nip}
                        onChange={(event) => setNip(event.target.value)}
                        placeholder="Masukkan NIP"
                        className="h-12 text-base"
                      />
                    </Field>
                    {error ? (
                      <div className="rounded-2xl border border-rose-300/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                        {error}
                      </div>
                    ) : null}
                    <Button type="button" className="w-full" size="lg" disabled={isRequestingOtp} onClick={() => void requestOtp()}>
                      <Smartphone className="h-4 w-4" />
                      {isRequestingOtp ? "Mengirim OTP..." : "Kirim OTP ke WhatsApp"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-[1.3rem] border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
                      OTP telah dikirim ke <strong className="text-foreground">{resetState.maskedWhatsapp}</strong> milik{" "}
                      <strong className="text-foreground">{resetState.name}</strong>.
                    </div>

                    <Field label="Kode OTP">
                      <Input
                        value={otpInput}
                        onChange={(event) => setOtpInput(event.target.value)}
                        placeholder="Masukkan 6 digit OTP"
                        className="h-12 text-base"
                      />
                    </Field>
                    <Field label="Password Baru">
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Masukkan password baru"
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
                      <Button type="button" size="lg" className="flex-1" disabled={isResetting} onClick={() => void confirmReset()}>
                        <KeyRound className="h-4 w-4" />
                        {isResetting ? "Menyimpan password..." : "Reset Password"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          setResetState(null);
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
                )}
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
