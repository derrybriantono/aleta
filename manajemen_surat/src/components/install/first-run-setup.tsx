"use client";

import {
  Bot,
  CheckCircle2,
  CircleAlert,
  CopyCheck,
  Database,
  KeyRound,
  Landmark,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type { InstallStatus } from "@/server/modules/install/service";

type SetupForm = {
  postgresHost: string;
  postgresPort: string;
  postgresDatabase: string;
  postgresUser: string;
  postgresPassword: string;
  appUrl: string;
  authSecret: string;
  botBaseUrl: string;
  botInternalToken: string;
  botRuntimeMode: string;
  botTimeoutMs: string;
  sippHost: string;
  sippPort: string;
  sippDatabase: string;
  sippUser: string;
  sippPassword: string;
  antrianHost: string;
  antrianPort: string;
  antrianDatabase: string;
  antrianUser: string;
  antrianPassword: string;
  apsHost: string;
  apsPort: string;
  apsDatabase: string;
  apsUser: string;
  apsPassword: string;
  extraDatabases: ExtraSqlDatabase[];
  aiProvider: string;
  aiModel: string;
  openAiApiKey: string;
  publicQaAiEnabled: boolean;
  courtName: string;
  courtShortName: string;
  courtWebsite: string;
  courtEmail: string;
  csWhatsappNumber: string;
  botWhatsappNumber: string;
  overwriteEnvFile: boolean;
};

type ExtraSqlDatabase = {
  id: string;
  key: string;
  name: string;
  description: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  sslEnabled: boolean;
  timeoutMs: string;
};

type SaveState = "idle" | "checking" | "saving" | "success" | "error";

type FirstRunSetupProps = {
  initialStatus: InstallStatus;
  previewMode?: boolean;
};

const initialForm: SetupForm = {
  postgresHost: "127.0.0.1",
  postgresPort: "5432",
  postgresDatabase: "aleta",
  postgresUser: "postgres",
  postgresPassword: "",
  appUrl: "http://127.0.0.1:3000",
  authSecret: "",
  botBaseUrl: "http://127.0.0.1:3003",
  botInternalToken: "",
  botRuntimeMode: "aleta_bot",
  botTimeoutMs: "8000",
  sippHost: "127.0.0.1",
  sippPort: "3306",
  sippDatabase: "SIPP",
  sippUser: "root",
  sippPassword: "",
  antrianHost: "127.0.0.1",
  antrianPort: "3306",
  antrianDatabase: "sipp_turunan_antrian",
  antrianUser: "root",
  antrianPassword: "",
  apsHost: "127.0.0.1",
  apsPort: "3306",
  apsDatabase: "aps_badilag",
  apsUser: "root",
  apsPassword: "",
  extraDatabases: [],
  aiProvider: "gemini",
  aiModel: "gemini-1.5-flash",
  openAiApiKey: "",
  publicQaAiEnabled: false,
  courtName: "",
  courtShortName: "",
  courtWebsite: "",
  courtEmail: "",
  csWhatsappNumber: "",
  botWhatsappNumber: "",
  overwriteEnvFile: false,
};

function randomSecret() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomId() {
  return window.crypto.randomUUID ? window.crypto.randomUUID() : `sql-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createExtraDatabase(index: number): ExtraSqlDatabase {
  return {
    id: randomId(),
    key: `sql_tambahan_${index}`,
    name: `SQL Tambahan ${index}`,
    description: "Database SQL tambahan untuk sumber data ALETA Bot.",
    host: "127.0.0.1",
    port: "3306",
    database: "",
    user: "root",
    password: "",
    sslEnabled: false,
    timeoutMs: "5000",
  };
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
        {required ? <span className="ml-1 text-sky-300">*</span> : null}
      </span>
      <Input
        value={value}
        type={type}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 border-white/10 bg-slate-950/55 text-slate-50 placeholder:text-slate-500 focus-visible:border-sky-300/60 focus-visible:ring-sky-300/25"
      />
    </label>
  );
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Database;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/58 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/10 text-sky-200">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        ok
          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
          : "border-amber-300/30 bg-amber-300/10 text-amber-100"
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export function FirstRunSetup({ initialStatus, previewMode = false }: FirstRunSetupProps) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState<InstallStatus>(initialStatus);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState("");
  const [envPreview, setEnvPreview] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setForm((current) => ({
        ...current,
        appUrl: window.location.origin,
        authSecret: current.authSecret || randomSecret(),
        botInternalToken: current.botInternalToken || randomSecret(),
      }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const payload = useMemo(
    () => ({
      postgres: {
        host: form.postgresHost,
        port: form.postgresPort,
        database: form.postgresDatabase,
        user: form.postgresUser,
        password: form.postgresPassword,
      },
      auth: {
        appUrl: form.appUrl,
        secret: form.authSecret,
      },
      bot: {
        baseUrl: form.botBaseUrl,
        internalToken: form.botInternalToken,
        runtimeMode: form.botRuntimeMode,
        timeoutMs: form.botTimeoutMs,
      },
      sipp: {
        host: form.sippHost,
        port: form.sippPort,
        database: form.sippDatabase,
        user: form.sippUser,
        password: form.sippPassword,
      },
      antrian: {
        host: form.antrianHost,
        port: form.antrianPort,
        database: form.antrianDatabase,
        user: form.antrianUser,
        password: form.antrianPassword,
      },
      aps: {
        host: form.apsHost,
        port: form.apsPort,
        database: form.apsDatabase,
        user: form.apsUser,
        password: form.apsPassword,
      },
      extraDatabases: form.extraDatabases.map((database) => ({
        key: database.key,
        name: database.name,
        description: database.description,
        host: database.host,
        port: database.port,
        database: database.database,
        user: database.user,
        password: database.password,
        sslEnabled: database.sslEnabled,
        timeoutMs: database.timeoutMs,
      })),
      ai: {
        provider: form.aiProvider,
        model: form.aiModel,
        openAiApiKey: form.openAiApiKey,
        publicQaAiEnabled: form.publicQaAiEnabled,
      },
      institution: {
        courtName: form.courtName,
        courtShortName: form.courtShortName,
        website: form.courtWebsite,
        email: form.courtEmail,
        csWhatsappNumber: form.csWhatsappNumber,
        botWhatsappNumber: form.botWhatsappNumber,
      },
      overwriteEnvFile: form.overwriteEnvFile,
    }),
    [form]
  );

  function update<Key extends keyof SetupForm>(key: Key, value: SetupForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addExtraDatabase() {
    setForm((current) => ({
      ...current,
      extraDatabases: [...current.extraDatabases, createExtraDatabase(current.extraDatabases.length + 1)],
    }));
  }

  function updateExtraDatabase(id: string, next: Partial<ExtraSqlDatabase>) {
    setForm((current) => ({
      ...current,
      extraDatabases: current.extraDatabases.map((database) =>
        database.id === id ? { ...database, ...next } : database
      ),
    }));
  }

  function removeExtraDatabase(id: string) {
    setForm((current) => ({
      ...current,
      extraDatabases: current.extraDatabases.filter((database) => database.id !== id),
    }));
  }

  async function refreshStatus() {
    const response = await fetch(apiPath("/api/install"), { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; data?: InstallStatus } | null;
    if (response.ok && body?.ok && body.data) {
      setStatus(body.data);
    }
  }

  async function testConfig() {
    setSaveState("checking");
    setNotice("");
    setEnvPreview("");

    try {
      const response = await fetch(apiPath("/api/install"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ ...payload, dryRun: true }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { envPreview?: string }; error?: { message?: string } }
        | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error?.message || "Uji konfigurasi gagal.");
      setEnvPreview(body.data?.envPreview || "");
      setSaveState("success");
      setNotice("Format konfigurasi valid. Periksa preview lalu simpan jika sudah sesuai.");
    } catch (error) {
      setSaveState("error");
      setNotice(error instanceof Error ? error.message : "Uji konfigurasi gagal.");
    }
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (previewMode) {
      await testConfig();
      return;
    }

    setSaveState("saving");
    setNotice("");

    try {
      const response = await fetch(apiPath("/api/install"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error?.message || "Konfigurasi gagal disimpan.");
      setSaveState("success");
      setNotice("Konfigurasi berhasil disimpan. Restart service/container agar environment baru terbaca.");
      await refreshStatus();
    } catch (error) {
      setSaveState("error");
      setNotice(error instanceof Error ? error.message : "Konfigurasi gagal disimpan.");
    }
  }

  const busy = saveState === "checking" || saveState === "saving";

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(20,184,166,0.08)_42%,rgba(15,23,42,0.9)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_22%_12%,rgba(125,211,252,0.22),transparent_35%),radial-gradient(circle_at_82%_8%,rgba(52,211,153,0.14),transparent_32%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3">
              <AletaLogo size="md" title="Instalasi Pertama" className="[&>div:last-child]:hidden" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">Instalasi Pertama</p>
                <h1 className="font-serif text-4xl font-semibold text-white sm:text-5xl">Siapkan ALETA</h1>
              </div>
            </div>
            <p className="max-w-2xl text-base leading-7 text-slate-300">
              Isi konfigurasi inti secara manual. Setelah tersimpan, halaman ini tidak muncul lagi dan aplikasi meminta restart service agar config baru terbaca.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill ok={!status.setupRequired} label={status.setupRequired ? "Perlu setup" : "Config terdeteksi"} />
            <StatusPill ok={status.envFileExists} label={status.envFileExists ? ".env.local ada" : ".env.local belum ada"} />
            {previewMode ? <StatusPill ok label="Mode preview" /> : null}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/48 p-5 lg:sticky lg:top-6 lg:h-fit">
            <div className="flex items-center gap-3 text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
              <h2 className="font-semibold">Status config</h2>
            </div>
            <div className="space-y-3">
              {status.sections.map((item) => (
                <div key={item.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                    {item.configured ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    ) : (
                      <CircleAlert className="h-4 w-4 shrink-0 text-amber-300" />
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.message}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-sky-300/20 bg-sky-300/10 p-3 text-xs leading-5 text-sky-100">
              Password dan token hanya ditulis ke file env. Ringkasan status tidak menampilkan nilai rahasia.
            </div>
          </aside>

          <form className="space-y-6" onSubmit={saveConfig}>
            <Section
              icon={Database}
              title="Database Utama ALETA"
              description="Dipakai untuk login, surat, disposisi, audit trail, pengaturan panel, dan data aplikasi."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Field required label="Host" value={form.postgresHost} onChange={(value) => update("postgresHost", value)} />
                <Field required label="Port" value={form.postgresPort} onChange={(value) => update("postgresPort", value)} />
                <Field required label="Database" value={form.postgresDatabase} onChange={(value) => update("postgresDatabase", value)} />
                <Field required label="User" value={form.postgresUser} onChange={(value) => update("postgresUser", value)} />
                <Field label="Password" type="password" value={form.postgresPassword} onChange={(value) => update("postgresPassword", value)} />
              </div>
            </Section>

            <Section
              icon={LockKeyhole}
              title="Login dan Keamanan"
              description="URL aplikasi dan secret dipakai sistem autentikasi. Gunakan secret panjang dan unik."
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr_auto]">
                <Field required label="URL aplikasi" value={form.appUrl} onChange={(value) => update("appUrl", value)} />
                <Field required label="Secret login" type="password" value={form.authSecret} onChange={(value) => update("authSecret", value)} />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 self-end border-sky-300/30 bg-sky-300/10 text-sky-100 hover:bg-sky-300/15"
                  onClick={() => update("authSecret", randomSecret())}
                >
                  <RefreshCw className="h-4 w-4" />
                  Buat Secret
                </Button>
              </div>
            </Section>

            <Section
              icon={Bot}
              title="ALETA Bot dan WhatsApp"
              description="Alamat runtime bot, token internal, dan mode WhatsApp. Token harus sama dengan runtime aleta_bot."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Runtime URL" value={form.botBaseUrl} onChange={(value) => update("botBaseUrl", value)} />
                <Field label="Token internal" type="password" value={form.botInternalToken} onChange={(value) => update("botInternalToken", value)} />
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Runtime Mode</span>
                  <select
                    value={form.botRuntimeMode}
                    onChange={(event) => update("botRuntimeMode", event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/55 px-3 text-sm text-slate-50 outline-none focus:border-sky-300/60"
                  >
                    <option value="aleta_bot">aleta_bot</option>
                    <option value="legacy_portal">legacy_portal</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>
                <Field label="Timeout ms" value={form.botTimeoutMs} onChange={(value) => update("botTimeoutMs", value)} />
              </div>
            </Section>

            <Section
              icon={ServerCog}
              title="Database Eksternal SIPP dan Turunan"
              description="Dipakai sumber data ALETA Bot, notifikasi perkara, antrian online, dan monitoring pegawai."
            >
              <div className="space-y-5">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-sky-100">SIPP utama</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <Field label="Host" value={form.sippHost} onChange={(value) => update("sippHost", value)} />
                    <Field label="Port" value={form.sippPort} onChange={(value) => update("sippPort", value)} />
                    <Field label="Database" value={form.sippDatabase} onChange={(value) => update("sippDatabase", value)} />
                    <Field label="User" value={form.sippUser} onChange={(value) => update("sippUser", value)} />
                    <Field label="Password" type="password" value={form.sippPassword} onChange={(value) => update("sippPassword", value)} />
                  </div>
                </div>
                <div className="grid gap-5 xl:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-emerald-100">Antrian online</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Host" value={form.antrianHost} onChange={(value) => update("antrianHost", value)} />
                      <Field label="Port" value={form.antrianPort} onChange={(value) => update("antrianPort", value)} />
                      <Field label="Database" value={form.antrianDatabase} onChange={(value) => update("antrianDatabase", value)} />
                      <Field label="User" value={form.antrianUser} onChange={(value) => update("antrianUser", value)} />
                      <Field label="Password" type="password" value={form.antrianPassword} onChange={(value) => update("antrianPassword", value)} />
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-amber-100">APS/pendukung</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Host" value={form.apsHost} onChange={(value) => update("apsHost", value)} />
                      <Field label="Port" value={form.apsPort} onChange={(value) => update("apsPort", value)} />
                      <Field label="Database" value={form.apsDatabase} onChange={(value) => update("apsDatabase", value)} />
                      <Field label="User" value={form.apsUser} onChange={(value) => update("apsUser", value)} />
                      <Field label="Password" type="password" value={form.apsPassword} onChange={(value) => update("apsPassword", value)} />
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-cyan-100">SQL tambahan dinamis</h3>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                        Tiga koneksi di atas adalah bawaan. Jika di satker ada database lain, misalnya total 5 SQL,
                        tambahkan 2 koneksi di sini agar bisa dipakai sebagai sumber data ALETA Bot.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15"
                      onClick={addExtraDatabase}
                    >
                      <Plus className="h-4 w-4" />
                      Tambah SQL
                    </Button>
                  </div>

                  {form.extraDatabases.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-slate-950/35 p-4 text-sm leading-6 text-slate-400">
                      Belum ada SQL tambahan. Biarkan kosong jika hanya memakai SIPP, Antrian, dan APS.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {form.extraDatabases.map((database, index) => (
                        <div key={database.id} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
                          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">SQL tambahan {index + 1}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-400">
                                Key dipakai sebagai pilihan koneksi pada tab Sumber Data ALETA Bot.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="border-red-300/25 bg-red-300/10 text-red-100 hover:bg-red-300/15"
                              onClick={() => removeExtraDatabase(database.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Hapus
                            </Button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <Field
                              required
                              label="Key koneksi"
                              value={database.key}
                              placeholder="contoh: sipp_arsip"
                              onChange={(value) => updateExtraDatabase(database.id, { key: value })}
                            />
                            <Field
                              required
                              label="Nama tampil"
                              value={database.name}
                              placeholder="SIPP Arsip"
                              onChange={(value) => updateExtraDatabase(database.id, { name: value })}
                            />
                            <Field
                              label="Keterangan"
                              value={database.description}
                              placeholder="Dipakai untuk data arsip perkara"
                              onChange={(value) => updateExtraDatabase(database.id, { description: value })}
                            />
                            <Field
                              label="Timeout ms"
                              value={database.timeoutMs}
                              onChange={(value) => updateExtraDatabase(database.id, { timeoutMs: value })}
                            />
                            <Field
                              required
                              label="Host"
                              value={database.host}
                              onChange={(value) => updateExtraDatabase(database.id, { host: value })}
                            />
                            <Field
                              label="Port"
                              value={database.port}
                              onChange={(value) => updateExtraDatabase(database.id, { port: value })}
                            />
                            <Field
                              required
                              label="Database"
                              value={database.database}
                              onChange={(value) => updateExtraDatabase(database.id, { database: value })}
                            />
                            <Field
                              required
                              label="User"
                              value={database.user}
                              onChange={(value) => updateExtraDatabase(database.id, { user: value })}
                            />
                            <Field
                              label="Password"
                              type="password"
                              value={database.password}
                              onChange={(value) => updateExtraDatabase(database.id, { password: value })}
                            />
                            <label className="flex h-11 items-center gap-3 self-end rounded-xl border border-white/10 bg-slate-950/55 px-4 text-sm text-slate-200">
                              <input
                                type="checkbox"
                                checked={database.sslEnabled}
                                onChange={(event) => updateExtraDatabase(database.id, { sslEnabled: event.target.checked })}
                                className="h-4 w-4 accent-cyan-300"
                              />
                              Gunakan SSL
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>

            <Section
              icon={Landmark}
              title="Identitas Instansi"
              description="Data awal untuk tampilan publik, login, footer, dan arahan layanan WhatsApp."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Nama instansi" value={form.courtName} onChange={(value) => update("courtName", value)} />
                <Field label="Nama singkat" value={form.courtShortName} onChange={(value) => update("courtShortName", value)} />
                <Field label="Website resmi" value={form.courtWebsite} onChange={(value) => update("courtWebsite", value)} />
                <Field label="Email" value={form.courtEmail} onChange={(value) => update("courtEmail", value)} />
                <Field label="CS WA resmi" value={form.csWhatsappNumber} onChange={(value) => update("csWhatsappNumber", value)} />
                <Field label="Nomor WA bot" value={form.botWhatsappNumber} onChange={(value) => update("botWhatsappNumber", value)} />
              </div>
            </Section>

            <Section
              icon={Sparkles}
              title="AI dan Public Q&A"
              description="Opsional. Dapat diisi sekarang atau nanti melalui Pengaturan AI setelah login."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.5fr_auto]">
                <Field label="Provider" value={form.aiProvider} onChange={(value) => update("aiProvider", value)} />
                <Field label="Model" value={form.aiModel} onChange={(value) => update("aiModel", value)} />
                <Field label="OpenAI API key" type="password" value={form.openAiApiKey} onChange={(value) => update("openAiApiKey", value)} />
                <label className="flex h-11 items-center gap-3 self-end rounded-xl border border-white/10 bg-slate-950/55 px-4 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.publicQaAiEnabled}
                    onChange={(event) => update("publicQaAiEnabled", event.target.checked)}
                    className="h-4 w-4 accent-sky-300"
                  />
                  Aktifkan AI Q&A
                </label>
              </div>
            </Section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/72 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <KeyRound className="h-5 w-5 text-sky-200" />
                    Simpan konfigurasi
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    File `.env.local` dan marker `data/install-state.json` dibuat setelah disimpan. Restart aplikasi setelah selesai.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    className="border-white/15 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
                    onClick={() => void testConfig()}
                  >
                    {saveState === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyCheck className="h-4 w-4" />}
                    Uji Tanpa Simpan
                  </Button>
                  <Button type="submit" disabled={busy} className="bg-sky-300 text-slate-950 hover:bg-sky-200">
                    {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {previewMode ? "Preview Validasi" : "Simpan Setup"}
                  </Button>
                </div>
              </div>

              {status.envFileExists ? (
                <label className="mt-4 flex items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-50">
                  <input
                    type="checkbox"
                    checked={form.overwriteEnvFile}
                    onChange={(event) => update("overwriteEnvFile", event.target.checked)}
                    className="h-4 w-4 accent-amber-300"
                  />
                  Timpa `.env.local` yang sudah ada.
                </label>
              ) : null}

              {notice ? (
                <div
                  className={cn(
                    "mt-4 flex items-start gap-3 rounded-xl border p-4 text-sm leading-6",
                    saveState === "error"
                      ? "border-red-300/25 bg-red-300/10 text-red-100"
                      : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                  )}
                >
                  {saveState === "error" ? <CircleAlert className="mt-0.5 h-5 w-5" /> : <CheckCircle2 className="mt-0.5 h-5 w-5" />}
                  <p>{notice}</p>
                </div>
              ) : null}

              {envPreview ? (
                <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/35 p-4 text-xs leading-6 text-slate-200">
                  {envPreview}
                </pre>
              ) : null}
            </section>
          </form>
        </div>
      </div>
    </main>
  );
}
