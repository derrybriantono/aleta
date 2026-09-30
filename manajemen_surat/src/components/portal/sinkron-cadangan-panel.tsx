"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  DatabaseBackup,
  Info,
  KeyRound,
  Laptop,
  Loader2,
  Play,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Square,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";

/**
 * Layar "Sinkron & cadangan" (butir 29 dan 30, 30 September 2026).
 *
 * Admin MELIHAT seluruhnya; hanya Super Admin yang mengubah dan menjalankan
 * (server menegakkannya - layar hanya menyesuaikan). Rahasia (kata sandi
 * arsip, client secret, kunci akun layanan) tidak pernah dikirim balik oleh
 * server: layar hanya tahu ADA atau TIDAK, dan isian rahasia selalu kosong.
 */

type Jadwal = { mode: "manual" | "harian" | "mingguan"; jam: string; hari: number };
type KunciDb = "aleta" | "sipp" | "abt" | "antrian" | "aleta_bot";

type Gambaran = {
  pengaturan: {
    cadangan: { aktif: boolean; jadwal: Jadwal; basisData: Record<KunciDb, boolean>; simpanDiServer: number };
    enkripsi: { sandiAda: boolean; sandiTerbaca: boolean; petunjuk: string; diubahPada: string };
    laptop: {
      aktif: boolean;
      token: Array<{ id: string; label: string; awalan: string; dibuatPada: string; dibuatOleh: string; terakhirDipakai: string; dicabutPada: string }>;
    };
    drive: {
      aktif: boolean;
      metode: "oauth-perangkat" | "akun-layanan";
      oauth: {
        clientId: string;
        clientSecretAda: boolean;
        tersambung: boolean;
        akun: string;
        menungguPersetujuan: { userCode: string; alamatVerifikasi: string; kedaluwarsa: string } | null;
      };
      akunLayanan: { ada: boolean; email: string };
      folderIndukId: string;
      folderDibuatId: string;
      cadangan: { aktif: boolean; simpan: number };
      berkasPerkara: {
        aktif: boolean;
        jadwal: Jadwal;
        tahunMulai: number;
        sertakanArsipFisik: boolean;
        perkaraPerJalan: number;
        ulangiSetelahHari: number;
        jedaMs: number;
        batasMbPerJalan: number;
      };
    };
    diubahPada: string;
    diubahOleh: string;
  };
  bolehUbah: boolean;
  keadaan: {
    berjalan: { tugas: string; mulai: string; oleh: string; kemajuan: string } | null;
    berjalanDiProses: string | null;
    terakhir: Record<string, { mulai: string; selesai: string; berhasil: boolean }>;
  };
  riwayat: Array<{
    id: string;
    tugas: string;
    pemicu: string;
    oleh: string;
    mulai: string;
    selesai: string;
    berhasil: boolean;
    byte: number;
    ringkasan: string;
    sebab: string;
    rincian: string[];
  }>;
  bundel: Array<{
    bundel: string;
    dibuat: string;
    tersandi: boolean;
    berkas: Array<{ nama: string; sumber: string; byte: number; sha256: string; keterangan: string }>;
    gagal: Array<{ sumber: string; sebab: string }>;
  }>;
  berkasPerkara: { diperiksa: number; berkas: number; byte: number; galat: Array<{ nomor: string; galat: string; diperiksa: string }>; daftarDiperbarui: string };
  lingkungan: { direktori: string; penjadwal: string };
};

const SEBUTAN_DB: Record<KunciDb, string> = {
  aleta: "ALETA (PostgreSQL portal)",
  sipp: "SIPP (MySQL server)",
  abt: "ABT (aps_badilag)",
  antrian: "Antrian sidang",
  aleta_bot: "ALETA Bot (MySQL)",
};

const SEBUTAN_TUGAS: Record<string, string> = {
  cadangan: "Cadangan basis data",
  "drive-cadangan": "Cadangan ke Google Drive",
  "drive-berkas": "Berkas perkara ke Google Drive",
};

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function ukuran(byte: number) {
  if (!byte || byte <= 0) return "0 B";
  const satuan = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(byte) / Math.log(1024)), satuan.length - 1);
  return `${(byte / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${satuan[i]}`;
}

function waktu(nilai: string | null | undefined) {
  if (!nilai) return "-";
  const t = new Date(nilai);
  if (!Number.isFinite(t.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" }).format(t);
}

async function panggil<T>(jalur: string, init?: RequestInit): Promise<T> {
  const jawab = await fetch(apiPath(jalur), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const isi = (await jawab.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
  if (!jawab.ok || !isi?.ok) throw new Error(isi?.error?.message || `Server menjawab HTTP ${jawab.status}.`);
  return isi.data as T;
}

function Baris({ label, children, ket }: { label: string; children: ReactNode; ket?: ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-start sm:gap-4">
      <div className="pt-2 text-sm font-medium text-foreground">{label}</div>
      <div className="space-y-1">
        {children}
        {ket ? <p className="text-xs leading-5 text-muted-foreground">{ket}</p> : null}
      </div>
    </div>
  );
}

function Pesan({ jenis, children }: { jenis: "info" | "awas" | "bahaya" | "baik"; children: ReactNode }) {
  const gaya = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100",
    awas: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
    bahaya: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100",
    baik: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
  }[jenis];
  const Ikon = jenis === "baik" ? CheckCircle2 : jenis === "info" ? Info : AlertTriangle;
  return (
    <div className={`flex gap-2 rounded-xl border px-3 py-2 text-sm leading-6 ${gaya}`}>
      <Ikon className="mt-1 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function PilihJadwal({ nilai, ubah, nonaktif }: { nilai: Jadwal; ubah: (j: Jadwal) => void; nonaktif: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        className="w-40"
        value={nilai.mode}
        disabled={nonaktif}
        onChange={(e) => ubah({ ...nilai, mode: e.target.value as Jadwal["mode"] })}
      >
        <option value="harian">Harian</option>
        <option value="mingguan">Mingguan</option>
        <option value="manual">Manual saja</option>
      </NativeSelect>
      {nilai.mode === "mingguan" ? (
        <NativeSelect className="w-36" value={nilai.hari} disabled={nonaktif} onChange={(e) => ubah({ ...nilai, hari: Number(e.target.value) })}>
          {HARI.map((h, i) => (
            <option key={h} value={i}>
              {h}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {nilai.mode !== "manual" ? (
        <Input className="w-32" type="time" value={nilai.jam} disabled={nonaktif} onChange={(e) => ubah({ ...nilai, jam: e.target.value })} />
      ) : null}
      {nilai.mode !== "manual" ? <span className="text-xs text-muted-foreground">WITA</span> : null}
    </div>
  );
}

export function SinkronCadanganPanel() {
  const [data, setData] = useState<Gambaran | null>(null);
  const [draf, setDraf] = useState<Gambaran["pengaturan"] | null>(null);
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState("");
  const [sandiBaru, setSandiBaru] = useState("");
  const [sandiUlang, setSandiUlang] = useState("");
  const [petunjuk, setPetunjuk] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [akunLayananJson, setAkunLayananJson] = useState("");
  const [labelToken, setLabelToken] = useState("");
  const [tokenBaru, setTokenBaru] = useState<{ label: string; token: string } | null>(null);
  const [hasilUji, setHasilUji] = useState<Record<string, any> | null>(null);
  const [kodePerangkat, setKodePerangkat] = useState<{ userCode: string; alamatVerifikasi: string; kedaluwarsa: string; jedaDetik: number } | null>(null);
  const [rincianTerbuka, setRincianTerbuka] = useState<string>("");
  const drafKotor = useRef(false);

  const muat = useCallback(async () => {
    try {
      const g = await panggil<Gambaran>("/api/admin/sinkron");
      setData(g);
      if (!drafKotor.current) setDraf(g.pengaturan);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const berjalan = data?.keadaan.berjalanDiProses || data?.keadaan.berjalan?.tugas || "";
  useEffect(() => {
    if (!berjalan) return;
    const t = setInterval(() => void muat(), 5000);
    return () => clearInterval(t);
  }, [berjalan, muat]);

  // Persetujuan perangkat Google: diperiksa berkala selama kodenya berlaku.
  useEffect(() => {
    if (!kodePerangkat) return;
    const t = setInterval(async () => {
      try {
        const h = await panggil<{ keadaan: string; akun?: string }>("/api/admin/sinkron/aksi", {
          method: "POST",
          body: JSON.stringify({ aksi: "oauth-periksa" }),
        });
        if (h.keadaan === "berhasil") {
          setKodePerangkat(null);
          setPesan([`Google Drive tersambung${h.akun ? ` sebagai ${h.akun}` : ""}.`]);
          void muat();
        } else if (h.keadaan === "ditolak" || h.keadaan === "kedaluwarsa") {
          setKodePerangkat(null);
          setError(h.keadaan === "ditolak" ? "Persetujuan ditolak di akun Google." : "Kode perangkat kedaluwarsa. Tekan Sambungkan lagi.");
          void muat();
        }
      } catch (e) {
        setKodePerangkat(null);
        setError((e as Error).message);
      }
    }, Math.max(5, kodePerangkat.jedaDetik) * 1000);
    return () => clearInterval(t);
  }, [kodePerangkat, muat]);

  const ubahDraf = (fn: (d: Gambaran["pengaturan"]) => Gambaran["pengaturan"]) => {
    drafKotor.current = true;
    setDraf((d) => (d ? fn(d) : d));
  };

  const aksi = async (nama: string, badan: Record<string, unknown> = {}) => {
    setSibuk(nama);
    setError("");
    try {
      return await panggil<any>("/api/admin/sinkron/aksi", { method: "POST", body: JSON.stringify({ aksi: nama, ...badan }) });
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSibuk("");
    }
  };

  const simpan = async () => {
    if (!draf) return;
    if (sandiBaru && sandiBaru !== sandiUlang) {
      setError("Kata sandi arsip dan ulangannya tidak sama.");
      return;
    }
    setSibuk("simpan");
    setError("");
    try {
      const g = await panggil<Gambaran & { catatan: string[] }>("/api/admin/sinkron", {
        method: "PUT",
        body: JSON.stringify({
          cadangan: draf.cadangan,
          laptop: { aktif: draf.laptop.aktif },
          drive: {
            aktif: draf.drive.aktif,
            metode: draf.drive.metode,
            oauth: { clientId: draf.drive.oauth.clientId },
            folderIndukId: draf.drive.folderIndukId,
            cadangan: draf.drive.cadangan,
            berkasPerkara: draf.drive.berkasPerkara,
          },
          ...(sandiBaru ? { sandiBaru, petunjukSandi: petunjuk } : petunjuk ? { petunjukSandi: petunjuk } : {}),
          ...(clientSecret ? { clientSecretBaru: clientSecret } : {}),
          ...(akunLayananJson ? { akunLayananJsonBaru: akunLayananJson } : {}),
        }),
      });
      drafKotor.current = false;
      setData(g);
      setDraf(g.pengaturan);
      setSandiBaru("");
      setSandiUlang("");
      setPetunjuk("");
      setClientSecret("");
      setAkunLayananJson("");
      setPesan(["Pengaturan tersimpan.", ...(g.catatan ?? [])]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSibuk("");
    }
  };

  if (!data || !draf) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Admin" title="Sinkron & cadangan" />
        {error ? <Pesan jenis="bahaya">{error}</Pesan> : <p className="text-sm text-muted-foreground">Memuat...</p>}
      </div>
    );
  }

  const boleh = data.bolehUbah;
  const nonaktif = !boleh || Boolean(sibuk);
  const p = draf;
  const d = p.drive;
  const tersambung = d.metode === "akun-layanan" ? data.pengaturan.drive.akunLayanan.ada : data.pengaturan.drive.oauth.tersambung;
  const tanpaSandiDenganDrive = d.aktif && d.cadangan.aktif && !data.pengaturan.enkripsi.sandiAda;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Admin"
        title="Sinkron & cadangan"
        description="Cadangan otomatis basis data ALETA, SIPP, ABT, dan antrian sidang di server - ditarik laptop dan diunggah ke Google Drive - serta berkas seluruh perkara ke Google Drive dalam susunan folder yang sama dengan tombol Unduh seluruh perkara di Status Perkara."
        actions={
          <>
            <Button variant="outline" onClick={() => void muat()} disabled={Boolean(sibuk)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Muat ulang
            </Button>
            <Button
              variant="outline"
              disabled={nonaktif}
              onClick={async () => {
                const h = await aksi("uji");
                if (h) setHasilUji(h);
              }}
            >
              {sibuk === "uji" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
              Uji sambungan
            </Button>
            {berjalan ? (
              <Button variant="destructive" disabled={!boleh} onClick={() => void aksi("hentikan").then(() => muat())}>
                <Square className="mr-2 h-4 w-4" /> Hentikan
              </Button>
            ) : (
              <Button
                disabled={nonaktif}
                onClick={async () => {
                  if (await aksi("jalankan", { tugas: "cadangan" })) {
                    setPesan(["Sinkron dimulai: cadangan basis data" + (d.aktif && d.cadangan.aktif ? ", lalu unggah ke Google Drive." : ".")]);
                    void muat();
                  }
                }}
              >
                <Play className="mr-2 h-4 w-4" /> Sinkron sekarang
              </Button>
            )}
          </>
        }
      />

      {!boleh ? <Pesan jenis="info">Anda melihat sebagai Admin. Hanya Super Admin yang dapat mengubah pengaturan dan menjalankan sinkron.</Pesan> : null}
      {error ? <Pesan jenis="bahaya">{error}</Pesan> : null}
      {pesan.length ? (
        <Pesan jenis="baik">
          {pesan.map((x) => (
            <div key={x}>{x}</div>
          ))}
        </Pesan>
      ) : null}

      {berjalan ? (
        <Pesan jenis="info">
          <strong>{SEBUTAN_TUGAS[berjalan] ?? berjalan}</strong> sedang berjalan sejak {waktu(data.keadaan.berjalan?.mulai)} -{" "}
          {data.keadaan.berjalan?.kemajuan || "mulai"}
        </Pesan>
      ) : null}

      {hasilUji ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hasil uji sambungan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-medium">Bot (MySQL SIPP, ABT, antrian)</div>
              {hasilUji.bot?.ok ? (
                <ul className="mt-1 space-y-1">
                  {(hasilUji.bot.sumber ?? []).map((s: any) => (
                    <li key={s.kunci} className="flex items-center gap-2">
                      {s.terjangkau ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
                      {s.sebutan}: {s.terjangkau ? `basis data ${s.namaDb}` : `tidak terjangkau (${s.error})`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-rose-700 dark:text-rose-300">{hasilUji.bot?.error}</p>
              )}
            </div>
            <div>
              <div className="font-medium">Google Drive</div>
              {hasilUji.drive?.ok ? (
                <p>
                  Tersambung sebagai {hasilUji.drive.akun || "(akun layanan)"}
                  {hasilUji.drive.kuotaByte ? ` - terpakai ${ukuran(hasilUji.drive.terpakaiByte)} dari ${ukuran(hasilUji.drive.kuotaByte)}` : ""}.
                </p>
              ) : (
                <p className="text-rose-700 dark:text-rose-300">{hasilUji.drive?.error}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ─── Cadangan basis data ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="h-5 w-5 text-cyan-600" /> Cadangan basis data di server
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Baris label="Otomatis">
            <Switch checked={p.cadangan.aktif} disabled={nonaktif} onCheckedChange={(v) => ubahDraf((x) => ({ ...x, cadangan: { ...x.cadangan, aktif: v } }))} />
          </Baris>
          <Baris label="Jadwal" ket="Sebaiknya malam hari: dump SIPP penuh membaca seluruh tabel perkara.">
            <PilihJadwal nilai={p.cadangan.jadwal} nonaktif={nonaktif} ubah={(j) => ubahDraf((x) => ({ ...x, cadangan: { ...x.cadangan, jadwal: j } }))} />
          </Baris>
          <Baris label="Basis data" ket="Nama basis data MySQL mengikuti konfigurasi bot di server (lihat Uji sambungan).">
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(SEBUTAN_DB) as KunciDb[]).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.cadangan.basisData[k]}
                    disabled={nonaktif}
                    onChange={(e) => ubahDraf((x) => ({ ...x, cadangan: { ...x.cadangan, basisData: { ...x.cadangan.basisData, [k]: e.target.checked } } }))}
                  />
                  {SEBUTAN_DB[k]}
                </label>
              ))}
            </div>
          </Baris>
          <Baris label="Salinan disimpan di server" ket="Yang lebih lama dihapus dari server sesudah cadangan baru berhasil.">
            <Input
              className="w-28"
              type="number"
              min={1}
              max={60}
              value={p.cadangan.simpanDiServer}
              disabled={nonaktif}
              onChange={(e) => ubahDraf((x) => ({ ...x, cadangan: { ...x.cadangan, simpanDiServer: Number(e.target.value) } }))}
            />
          </Baris>
          <p className="text-xs text-muted-foreground">
            Folder server: <code>{data.lingkungan.direktori}</code> · penjadwal: {data.lingkungan.penjadwal} · terakhir:{" "}
            {data.keadaan.terakhir.cadangan ? `${waktu(data.keadaan.terakhir.cadangan.mulai)} (${data.keadaan.terakhir.cadangan.berhasil ? "berhasil" : "gagal"})` : "belum pernah"}
          </p>
        </CardContent>
      </Card>

      {/* ─── Enkripsi ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Enkripsi arsip
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.pengaturan.enkripsi.sandiAda ? (
            data.pengaturan.enkripsi.sandiTerbaca ? (
              <Pesan jenis="baik">
                Arsip disandikan AES-256-GCM. Kata sandi diganti {waktu(data.pengaturan.enkripsi.diubahPada)}
                {data.pengaturan.enkripsi.petunjuk ? ` · petunjuk: ${data.pengaturan.enkripsi.petunjuk}` : ""}.
              </Pesan>
            ) : (
              <Pesan jenis="bahaya">Kata sandi tersimpan tetapi tidak dapat dibuka server (kunci server berganti). Isi ulang kata sandi arsip.</Pesan>
            )
          ) : (
            <Pesan jenis="awas">
              Belum ada kata sandi: arsip TIDAK tersandi. Arsip tanpa sandi tidak akan diunggah ke Google Drive, dan yang ditarik laptop melintasi jaringan kantor apa adanya.
            </Pesan>
          )}
          <Baris label="Kata sandi baru" ket="Minimal 12 aksara. Tidak dapat dipulihkan: tanpa kata sandi ini arsip tidak dapat dibuka siapa pun. Simpan di tempat aman di luar ALETA.">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input type="password" autoComplete="new-password" placeholder="Kata sandi arsip" value={sandiBaru} disabled={nonaktif} onChange={(e) => setSandiBaru(e.target.value)} />
              <Input type="password" autoComplete="new-password" placeholder="Ulangi" value={sandiUlang} disabled={nonaktif} onChange={(e) => setSandiUlang(e.target.value)} />
            </div>
          </Baris>
          <Baris label="Petunjuk (opsional)" ket="Tampil di layar dan di MANIFEST arsip - JANGAN tulis sandinya di sini.">
            <Input value={petunjuk} placeholder={data.pengaturan.enkripsi.petunjuk || "mis. disimpan di brankas Sekretaris"} disabled={nonaktif} onChange={(e) => setPetunjuk(e.target.value)} />
          </Baris>
          {data.pengaturan.enkripsi.sandiAda && boleh ? (
            <Button
              variant="outline"
              disabled={nonaktif}
              onClick={async () => {
                if (!window.confirm("Hapus kata sandi arsip? Arsip berikutnya TIDAK tersandi dan tidak diunggah ke Google Drive.")) return;
                try {
                  const g = await panggil<Gambaran & { catatan: string[] }>("/api/admin/sinkron", { method: "PUT", body: JSON.stringify({ hapusSandi: true }) });
                  setData(g);
                  setPesan(g.catatan ?? []);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Hapus kata sandi
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* ─── Laptop ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Laptop className="h-5 w-5 text-indigo-600" /> Sinkron ke laptop
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Pesan jenis="info">
            Server tidak dapat mengirim ke laptop; laptop yang MENARIK arsip terbaru lewat token di bawah, lalu (bila diatur) memulihkannya ke basis data
            laptop. Pasang alatnya dari folder <code>tools/sinkron-laptop</code> - langkahnya di README di folder itu. Basis data <code>sipp</code> di laptop
            tidak pernah disentuh alat itu.
          </Pesan>
          <Baris label="Izinkan laptop menarik">
            <Switch checked={p.laptop.aktif} disabled={nonaktif} onCheckedChange={(v) => ubahDraf((x) => ({ ...x, laptop: { ...x.laptop, aktif: v } }))} />
          </Baris>
          <Baris label="Token laptop" ket="Token diperlihatkan SEKALI saat dibuat; server hanya menyimpan sidiknya. Cabut token laptop yang hilang atau tidak dipakai.">
            <div className="space-y-2">
              {data.pengaturan.laptop.token.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada token.</p> : null}
              {data.pengaturan.laptop.token.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <strong>{t.label}</strong> <code className="text-xs">aletasnk_{t.awalan}…</code>
                    <div className="text-xs text-muted-foreground">
                      dibuat {waktu(t.dibuatPada)} oleh {t.dibuatOleh} · terakhir dipakai {waktu(t.terakhirDipakai)}
                      {t.dicabutPada ? ` · DICABUT ${waktu(t.dicabutPada)}` : ""}
                    </div>
                  </div>
                  {!t.dicabutPada && boleh ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={nonaktif}
                      onClick={async () => {
                        if (!window.confirm(`Cabut token "${t.label}"? Laptop itu tidak dapat menarik lagi.`)) return;
                        if (await aksi("token-cabut", { id: t.id })) void muat();
                      }}
                    >
                      Cabut
                    </Button>
                  ) : null}
                </div>
              ))}
              {boleh ? (
                <div className="flex flex-wrap gap-2">
                  <Input className="max-w-xs" placeholder="Nama laptop, mis. Laptop Derry" value={labelToken} disabled={nonaktif} onChange={(e) => setLabelToken(e.target.value)} />
                  <Button
                    variant="outline"
                    disabled={nonaktif}
                    onClick={async () => {
                      const h = await aksi("token-buat", { label: labelToken });
                      if (h) {
                        setTokenBaru({ label: h.label, token: h.token });
                        setLabelToken("");
                        void muat();
                      }
                    }}
                  >
                    <KeyRound className="mr-2 h-4 w-4" /> Buat token
                  </Button>
                </div>
              ) : null}
              {tokenBaru ? (
                <Pesan jenis="awas">
                  Token untuk <strong>{tokenBaru.label}</strong> - salin SEKARANG ke berkas konfigurasi laptop; tidak akan diperlihatkan lagi:
                  <code className="mt-1 block break-all rounded bg-card px-2 py-1 text-xs">{tokenBaru.token}</code>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(tokenBaru.token)}>
                      Salin
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setTokenBaru(null)}>
                      Sudah disalin, tutup
                    </Button>
                  </div>
                </Pesan>
              ) : null}
            </div>
          </Baris>
        </CardContent>
      </Card>

      {/* ─── Google Drive ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-5 w-5 text-sky-600" /> Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Baris label="Aktifkan Google Drive">
            <Switch checked={d.aktif} disabled={nonaktif} onCheckedChange={(v) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, aktif: v } }))} />
          </Baris>
          <Baris
            label="Cara menyambung"
            ket={
              d.metode === "oauth-perangkat"
                ? "Untuk akun Google biasa (Gmail). ALETA hanya dapat melihat berkas yang dibuatnya sendiri (cakupan drive.file)."
                : "Hanya untuk Shared Drive Google Workspace: akun layanan tidak punya kuota penyimpanan sendiri."
            }
          >
            <NativeSelect
              className="max-w-md"
              value={d.metode}
              disabled={nonaktif}
              onChange={(e) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, metode: e.target.value as typeof d.metode } }))}
            >
              <option value="oauth-perangkat">Akun Google (OAuth, kode perangkat)</option>
              <option value="akun-layanan">Akun layanan (Shared Drive)</option>
            </NativeSelect>
          </Baris>

          {d.metode === "oauth-perangkat" ? (
            <>
              <Baris label="Client ID" ket='Dari Google Cloud Console > Credentials > OAuth client ID, jenis "TVs and Limited Input devices".'>
                <Input
                  value={d.oauth.clientId}
                  disabled={nonaktif}
                  placeholder="xxxxxxxx.apps.googleusercontent.com"
                  onChange={(e) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, oauth: { ...x.drive.oauth, clientId: e.target.value } } }))}
                />
              </Baris>
              <Baris label="Client secret" ket={data.pengaturan.drive.oauth.clientSecretAda ? "Tersimpan (tidak ditampilkan). Isi hanya untuk mengganti." : "Belum tersimpan."}>
                <Input type="password" autoComplete="off" value={clientSecret} disabled={nonaktif} placeholder={data.pengaturan.drive.oauth.clientSecretAda ? "••••••••" : ""} onChange={(e) => setClientSecret(e.target.value)} />
              </Baris>
              <Baris label="Sambungan">
                <div className="space-y-2">
                  {data.pengaturan.drive.oauth.tersambung ? (
                    <Pesan jenis="baik">Tersambung{data.pengaturan.drive.oauth.akun ? ` sebagai ${data.pengaturan.drive.oauth.akun}` : ""}.</Pesan>
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum tersambung. Simpan Client ID dan secret lebih dulu, lalu tekan Sambungkan.</p>
                  )}
                  {kodePerangkat ? (
                    <Pesan jenis="info">
                      Buka <a className="font-semibold underline" href={kodePerangkat.alamatVerifikasi} target="_blank" rel="noreferrer">{kodePerangkat.alamatVerifikasi}</a> di perangkat mana pun, masuk dengan akun
                      Google satker, lalu masukkan kode <strong className="font-mono text-base">{kodePerangkat.userCode}</strong>. Layar ini memeriksa sendiri sampai
                      disetujui (berlaku sampai {waktu(kodePerangkat.kedaluwarsa)}).
                    </Pesan>
                  ) : null}
                  {boleh ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={nonaktif || drafKotor.current}
                        onClick={async () => {
                          const h = await aksi("oauth-mulai");
                          if (h) setKodePerangkat(h);
                        }}
                      >
                        {data.pengaturan.drive.oauth.tersambung ? "Sambungkan ulang" : "Sambungkan"}
                      </Button>
                      {data.pengaturan.drive.oauth.tersambung ? (
                        <Button
                          variant="outline"
                          disabled={nonaktif}
                          onClick={async () => {
                            if (!window.confirm("Putuskan Google Drive? Sinkron ke Drive berhenti sampai disambungkan lagi.")) return;
                            if (await aksi("oauth-putus")) void muat();
                          }}
                        >
                          Putuskan
                        </Button>
                      ) : null}
                      {drafKotor.current ? <span className="self-center text-xs text-muted-foreground">Simpan perubahan dulu sebelum menyambung.</span> : null}
                    </div>
                  ) : null}
                </div>
              </Baris>
            </>
          ) : (
            <Baris
              label="Kunci akun layanan (JSON)"
              ket={data.pengaturan.drive.akunLayanan.ada ? `Tersimpan: ${data.pengaturan.drive.akunLayanan.email}. Unggah hanya untuk mengganti.` : "Belum tersimpan. Yang disimpan hanya email dan kunci privatnya, tersandi."}
            >
              <input
                type="file"
                accept="application/json,.json"
                disabled={nonaktif}
                className="text-sm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setAkunLayananJson(await f.text());
                }}
              />
              {akunLayananJson ? <p className="text-xs text-emerald-700">Berkas terbaca - tekan Simpan pengaturan.</p> : null}
            </Baris>
          )}

          <Baris
            label="Folder tujuan (opsional)"
            ket={
              d.metode === "oauth-perangkat"
                ? `Kosongkan: ALETA membuat folder "ALETA Sinkron" di My Drive akun itu${data.pengaturan.drive.folderDibuatId ? ` (sudah dibuat: ${data.pengaturan.drive.folderDibuatId})` : ""}. Folder buatan orang lain tidak dapat dibuka dengan cakupan drive.file.`
                : "Wajib: ID atau tautan folder di Shared Drive yang anggotanya termasuk email akun layanan."
            }
          >
            <Input
              value={d.folderIndukId}
              disabled={nonaktif}
              placeholder="ID folder atau tautan https://drive.google.com/drive/folders/..."
              onChange={(e) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, folderIndukId: e.target.value } }))}
            />
          </Baris>

          <div className="rounded-xl border p-3">
            <div className="mb-3 font-medium">Cadangan basis data ke Drive (butir 29)</div>
            <div className="space-y-3">
              <Baris label="Unggah sesudah tiap cadangan" ket='Ke folder "Cadangan basis data/<tanggal jam>". Hanya arsip TERSANDI yang diunggah.'>
                <Switch checked={d.cadangan.aktif} disabled={nonaktif} onCheckedChange={(v) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, cadangan: { ...x.drive.cadangan, aktif: v } } }))} />
              </Baris>
              <Baris label="Salinan disimpan di Drive" ket="Folder cadangan yang lebih lama dipindah ke Sampah Drive (dapat dipulihkan 30 hari).">
                <Input
                  className="w-28"
                  type="number"
                  min={1}
                  max={120}
                  value={d.cadangan.simpan}
                  disabled={nonaktif}
                  onChange={(e) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, cadangan: { ...x.drive.cadangan, simpan: Number(e.target.value) } } }))}
                />
              </Baris>
              {tanpaSandiDenganDrive ? <Pesan jenis="bahaya">Isi kata sandi arsip lebih dulu - arsip tanpa sandi ditolak untuk Google Drive.</Pesan> : null}
              {boleh ? (
                <Button
                  variant="outline"
                  disabled={nonaktif || Boolean(berjalan) || !tersambung}
                  onClick={async () => {
                    if (await aksi("jalankan", { tugas: "drive-cadangan" })) {
                      setPesan(["Unggah cadangan terakhir ke Google Drive dimulai."]);
                      void muat();
                    }
                  }}
                >
                  Unggah cadangan terakhir sekarang
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="mb-3 font-medium">Berkas seluruh perkara ke Drive (butir 30)</div>
            <div className="space-y-3">
              <Pesan jenis="bahaya">
                Berkas perkara memuat DATA PRIBADI para pihak: identitas, alamat pada relaas dan resi pos, keterangan saksi, dan putusan yang belum dianonimkan.
                Berkas ini diunggah APA ADANYA (tidak tersandi) supaya dapat dibuka di Drive. Atur sendiri siapa yang dapat membuka folder Drive-nya, jangan
                bagikan tautannya, dan pakai akun Google milik satker - bukan akun pribadi. Tiap jalan tercatat di jejak audit.
              </Pesan>
              <Baris label="Otomatis">
                <Switch
                  checked={d.berkasPerkara.aktif}
                  disabled={nonaktif}
                  onCheckedChange={(v) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, berkasPerkara: { ...x.drive.berkasPerkara, aktif: v } } }))}
                />
              </Baris>
              <Baris label="Jadwal">
                <PilihJadwal
                  nilai={d.berkasPerkara.jadwal}
                  nonaktif={nonaktif}
                  ubah={(j) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, berkasPerkara: { ...x.drive.berkasPerkara, jadwal: j } } }))}
                />
              </Baris>
              <Baris label="Perkara sejak tahun" ket="Perkara didaftarkan tahun ini sampai sekarang. Folder Drive: Berkas perkara/<tahun>/perkara-<nomor>/ lalu 00 Data SIPP, 01 Gugatan, 02 Relaas, dst.">
                <Input
                  className="w-28"
                  type="number"
                  value={d.berkasPerkara.tahunMulai}
                  disabled={nonaktif}
                  onChange={(e) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, berkasPerkara: { ...x.drive.berkasPerkara, tahunMulai: Number(e.target.value) } } }))}
                />
              </Baris>
              <Baris label="Sertakan arsip fisik (pindaian)" ket="2-28 MB sebuah - sama dengan pilihan di tombol Status Perkara.">
                <Switch
                  checked={d.berkasPerkara.sertakanArsipFisik}
                  disabled={nonaktif}
                  onCheckedChange={(v) => ubahDraf((x) => ({ ...x, drive: { ...x.drive, berkasPerkara: { ...x.drive.berkasPerkara, sertakanArsipFisik: v } } }))}
                />
              </Baris>
              <Baris label="Batas per jalan" ket="Supaya server tidak terbebani: perkara per jalan, megabyte per jalan, jeda antarberkas (ms), dan perkara yang sudah diperiksa dilewati sampai sekian hari.">
                <div className="grid gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["perkaraPerJalan", "perkara"],
                      ["batasMbPerJalan", "MB"],
                      ["jedaMs", "ms jeda"],
                      ["ulangiSetelahHari", "hari ulang"],
                    ] as const
                  ).map(([kunci, sebut]) => (
                    <label key={kunci} className="text-xs text-muted-foreground">
                      <Input
                        type="number"
                        value={d.berkasPerkara[kunci]}
                        disabled={nonaktif}
                        onChange={(e) =>
                          ubahDraf((x) => ({ ...x, drive: { ...x.drive, berkasPerkara: { ...x.drive.berkasPerkara, [kunci]: Number(e.target.value) } } }))
                        }
                      />
                      {sebut}
                    </label>
                  ))}
                </div>
              </Baris>
              <p className="text-xs text-muted-foreground">
                Sudah diperiksa {data.berkasPerkara.diperiksa} perkara · {data.berkasPerkara.berkas} berkas · {ukuran(data.berkasPerkara.byte)} · terakhir{" "}
                {data.keadaan.terakhir["drive-berkas"] ? waktu(data.keadaan.terakhir["drive-berkas"].mulai) : "belum pernah"}
              </p>
              {data.berkasPerkara.galat.length ? (
                <details className="text-xs">
                  <summary className="cursor-pointer">{data.berkasPerkara.galat.length} perkara terakhir gagal</summary>
                  <ul className="mt-1 space-y-0.5">
                    {data.berkasPerkara.galat.map((g) => (
                      <li key={g.nomor}>
                        {g.nomor}: {g.galat}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {boleh ? (
                <Button
                  variant="outline"
                  disabled={nonaktif || Boolean(berjalan) || !tersambung}
                  onClick={async () => {
                    if (await aksi("jalankan", { tugas: "drive-berkas" })) {
                      setPesan(["Sinkron berkas perkara ke Google Drive dimulai."]);
                      void muat();
                    }
                  }}
                >
                  Sinkron berkas perkara sekarang
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {boleh ? (
        <div className="flex justify-end">
          <Button onClick={() => void simpan()} disabled={Boolean(sibuk)}>
            {sibuk === "simpan" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Simpan pengaturan
          </Button>
        </div>
      ) : null}

      {/* ─── Bundel di server ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadangan tersimpan di server</CardTitle>
        </CardHeader>
        <CardContent>
          {data.bundel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada cadangan.</p>
          ) : (
            <div className="space-y-2">
              {data.bundel.map((b) => (
                <div key={b.bundel} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{waktu(b.dibuat)}</strong>
                    <span className={b.tersandi ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>{b.tersandi ? "tersandi" : "TIDAK tersandi"}</span>
                    <span className="text-muted-foreground">{ukuran(b.berkas.reduce((s, x) => s + x.byte, 0))}</span>
                  </div>
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {b.berkas.map((x) => (
                      <li key={x.nama}>
                        {x.nama} - {ukuran(x.byte)}
                      </li>
                    ))}
                    {b.gagal.map((g) => (
                      <li key={g.sumber} className="text-rose-700 dark:text-rose-300">
                        {g.sumber}: error - {g.sebab}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Riwayat ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat sinkron</CardTitle>
        </CardHeader>
        <CardContent>
          {data.riwayat.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Waktu</th>
                    <th className="py-1 pr-3">Tugas</th>
                    <th className="py-1 pr-3">Hasil</th>
                    <th className="py-1 pr-3">Ukuran</th>
                    <th className="py-1">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.riwayat.map((r) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {waktu(r.mulai)}
                        <div className="text-xs text-muted-foreground">
                          {r.pemicu === "jadwal" ? "jadwal" : r.oleh}
                        </div>
                      </td>
                      <td className="py-1.5 pr-3">{SEBUTAN_TUGAS[r.tugas] ?? r.tugas}</td>
                      <td className="py-1.5 pr-3">
                        {r.berhasil ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" /> berhasil
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                            <XCircle className="h-4 w-4" /> gagal
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{ukuran(r.byte)}</td>
                      <td className="py-1.5">
                        <div>{r.ringkasan}</div>
                        {r.sebab ? <div className="text-xs text-rose-700 dark:text-rose-300">Sebab: {r.sebab}</div> : null}
                        {r.rincian.length ? (
                          <button type="button" className="text-xs underline" onClick={() => setRincianTerbuka(rincianTerbuka === r.id ? "" : r.id)}>
                            {rincianTerbuka === r.id ? "Tutup rincian" : `Rincian (${r.rincian.length})`}
                          </button>
                        ) : null}
                        {rincianTerbuka === r.id ? (
                          <ul className="mt-1 text-xs text-muted-foreground">
                            {r.rincian.map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
