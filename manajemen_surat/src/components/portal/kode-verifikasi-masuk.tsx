"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import type { InfoVerifikasi } from "@/lib/masuk-sipp-klien";

/**
 * Layar kode verifikasi saat masuk (E5, 25 Okt 2026): password sudah terbukti
 * benar, server memberi tiket 10 menit. Pengguna memilih cara (authenticator,
 * WhatsApp, atau kode cadangan dari admin); sesudah berhasil, onLanjut()
 * mengulang masuk (password diperiksa lagi, kini kodenya sudah tercatat).
 * Tidak pernah tampil selama Super Admin belum menyalakan verifikasi.
 */
type Metode = InfoVerifikasi["metode"][number];

const NAMA_METODE: Record<Metode, string> = {
  authenticator: "Aplikasi authenticator",
  whatsapp: "Kode WhatsApp",
  cadangan: "Kode cadangan dari admin",
};

export function KodeVerifikasiMasuk({
  info,
  onLanjut,
  onBatal,
  ambil = fetch,
}: {
  info: InfoVerifikasi;
  onLanjut: () => void;
  onBatal: () => void;
  ambil?: typeof fetch;
}) {
  const tersedia: Metode[] = info.metode.length ? info.metode : ["authenticator", "whatsapp", "cadangan"];
  const [metode, setMetode] = useState<Metode>(tersedia[0]);
  const [kode, setKode] = useState("");
  const [percayai, setPercayai] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [info2, setInfo2] = useState("");

  const kirimKeServer = async (badan: Record<string, unknown>) => {
    const r = await ambil(apiPath("/api/portal/verifikasi/masuk"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tiket: info.tiket, ...badan }),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: { nomor?: string; berlakuMenit?: number }; error?: { message?: string } } | null;
    if (!r.ok || !j?.ok) throw new Error(j?.error?.message ?? "Permintaan belum berhasil.");
    return j.data ?? {};
  };

  const kirimWa = async () => {
    setSibuk(true);
    setGalat("");
    try {
      const d = await kirimKeServer({ aksi: "kirim" });
      setInfo2(`Kode dikirim ke WhatsApp ${d.nomor ?? ""}. Berlaku ${d.berlakuMenit ?? 5} menit.`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Kode belum dapat dikirim.");
    } finally {
      setSibuk(false);
    }
  };

  const periksa = async () => {
    setSibuk(true);
    setGalat("");
    try {
      await kirimKeServer({ aksi: "periksa", metode, kode, percayai });
      onLanjut();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Kode belum dapat diperiksa.");
      setSibuk(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-300/40 dark:bg-sky-500/10 dark:text-sky-100" data-kode-verifikasi>
      <p className="flex items-center gap-2 font-medium">
        <ShieldCheck className="h-4 w-4" aria-hidden /> {info.pesan || "Masukkan kode verifikasi untuk melanjutkan masuk."}
      </p>
      {tersedia.length > 1 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cara verifikasi">
          {tersedia.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={metode === m}
              onClick={() => {
                setMetode(m);
                setKode("");
                setGalat("");
              }}
              className={`rounded-full border px-3 py-1 text-xs ${metode === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
            >
              {NAMA_METODE[m]}
            </button>
          ))}
        </div>
      )}
      {metode === "whatsapp" && (
        <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void kirimWa()}>
          Kirim kode ke WhatsApp saya
        </Button>
      )}
      {metode === "authenticator" && <p className="text-xs">Buka aplikasi authenticator di HP Anda dan masukkan 6 angka untuk ALETA.</p>}
      {metode === "cadangan" && <p className="text-xs">Masukkan salah satu kode cadangan yang diberikan admin (sekali pakai).</p>}
      <Input
        value={kode}
        inputMode={metode === "cadangan" ? "text" : "numeric"}
        autoComplete="one-time-code"
        maxLength={metode === "cadangan" ? 12 : 8}
        aria-label="Kode verifikasi"
        placeholder={metode === "cadangan" ? "XXXXX-XXXXX" : "6 angka"}
        onChange={(e) => setKode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && kode.trim()) {
            e.preventDefault();
            void periksa();
          }
        }}
      />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={percayai} onChange={(e) => setPercayai(e.target.checked)} className="h-4 w-4" />
        Percayai perangkat ini (kode tidak diminta lagi di perangkat ini)
      </label>
      {info2 && <p className="text-xs">{info2}</p>}
      {galat && <p className="text-rose-700 dark:text-rose-200">{galat}</p>}
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={sibuk || !kode.trim()} onClick={() => void periksa()}>
          {sibuk ? "Memeriksa..." : "Lanjutkan masuk"}
        </Button>
        <button type="button" className="text-xs underline" onClick={onBatal}>
          Batal
        </button>
      </div>
    </div>
  );
}
