"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, Loader2, Save, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ambil, kirimJson } from "@/lib/aleta-ai/klien";
import { LABEL_MODE, formatRupiah, type PengaturanAi } from "@/lib/aleta-ai/kontrak";
import { apiPath } from "@/lib/base-path";

import { MatriksKemampuanAi } from "./matriks-kemampuan";

/**
 * Pengaturan ALETA Ai - hanya Super Admin. Satu-satunya layar yang menyebut
 * nama model; pengguna biasa hanya melihat label mode.
 */

export type PenggunaPilihan = { id: string; name: string; jabatan?: string };

type Kurs = { kurs?: number; kursPakai?: number; tanggal?: string; sumber?: string };
type ModulProyek = { nama: string; versi?: string };
type Proyek = { versi?: string; diperbarui?: string; modul?: ModulProyek[]; riwayat?: { versi: string; tanggal?: string; oleh?: string }[] };
type BarisLaporan = { nama?: string; kunci?: string; giliran?: number; pendapatanRp?: number; biayaApiRp?: number; biayaMdrRp?: number; labaRp?: number };
type Laporan = {
  bulan?: string;
  pendapatanRp: number;
  biayaApiRp: number;
  biayaMdrRp?: number;
  labaRp: number;
  perPengguna?: BarisLaporan[];
  perPeran?: BarisLaporan[];
  perKelompok?: BarisLaporan[];
  perModel?: BarisLaporan[];
  perBulan?: BarisLaporan[];
};
type KuotaPeran = { peranId: string; kuotaBulananRp: number };
type Rekonsiliasi = { tanggal: string; status: string; olehId?: string; dijalankanAt?: string; jumlahSelisih: number; tahananMenggantung: number; pendapatanGiliranRp: number; potongMutasiRp: number };

const LABEL_REKONSILIASI: Record<string, string> = { seimbang: "Cocok", selisih: "Ada selisih", menggantung: "Tahanan menggantung" };

const angkaAtau = (n: unknown, cadangan = 0) => (typeof n === "number" && Number.isFinite(n) ? n : cadangan);

/**
 * Server menjawab {pengaturan:{...}, tarif:[{masukPerJuta...}], rute, kurs}; layar memakai bentuk datar
 * (PengaturanAi di kontrak.ts, tarif {masuk, keluar, cacheTulis, cacheBaca}). Kedua bentuk diterima;
 * medan lain dari server (ambang tarif, perkiraan keluaran rute, dst.) tetap dibawa agar tersimpan utuh.
 */
function keLayar(data: unknown): PengaturanAi | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const datar = (d.pengaturan && typeof d.pengaturan === "object" ? { ...(d.pengaturan as Record<string, unknown>) } : { ...d }) as Record<string, unknown>;
  const tarif = (Array.isArray(d.tarif) ? d.tarif : []).map((t: Record<string, unknown>) => ({
    ...t,
    model: String(t.model ?? ""),
    masuk: angkaAtau(t.masuk, angkaAtau(t.masukPerJuta)),
    keluar: angkaAtau(t.keluar, angkaAtau(t.keluarPerJuta)),
    cacheTulis: angkaAtau(t.cacheTulis, angkaAtau(t.cacheTulisPerJuta)),
    cacheBaca: angkaAtau(t.cacheBaca, angkaAtau(t.cacheBacaPerJuta)),
  }));
  const rute = (Array.isArray(d.rute) ? d.rute : []) as PengaturanAi["rute"];
  return {
    ...(datar as Partial<PengaturanAi>),
    margin: angkaAtau(datar.margin, angkaAtau(datar.marginPersen)),
    penyanggaKurs: angkaAtau(datar.penyanggaKurs, angkaAtau(datar.penyanggaKursPersen)),
    minimumRp: angkaAtau(datar.minimumRp),
    pembulatanRp: angkaAtau(datar.pembulatanRp),
    batasHarianRp: angkaAtau(datar.batasHarianRp),
    aktif: datar.aktif !== false,
    tarif,
    rute,
  };
}

/** Badan PUT: bentuk server (pengaturan/tarif/rute) beserta bentuk datar lama. */
function keServer(form: PengaturanAi) {
  const { tarif, rute, ...datar } = form;
  return {
    ...form,
    pengaturan: {
      aktif: datar.aktif,
      margin: datar.margin,
      penyanggaKurs: datar.penyanggaKurs,
      minimumRp: datar.minimumRp,
      pembulatanRp: datar.pembulatanRp,
      batasHarianRp: datar.batasHarianRp,
      ...(datar.mdrPersen != null ? { mdrPersen: datar.mdrPersen } : {}),
      ...(datar.batasSatkerBulananRp != null ? { batasSatkerBulananRp: datar.batasSatkerBulananRp } : {}),
      ...(datar.ambangSaldoMenipisRp != null ? { ambangSaldoMenipisRp: datar.ambangSaldoMenipisRp } : {}),
      ...(datar.rekonsiliasiOtomatis != null ? { rekonsiliasiOtomatis: datar.rekonsiliasiOtomatis } : {}),
      ...(datar.jamRekonsiliasi != null ? { jamRekonsiliasi: datar.jamRekonsiliasi } : {}),
    },
    tarif: tarif.map((t) => ({ ...t, masukPerJuta: t.masuk, keluarPerJuta: t.keluar, cacheTulisPerJuta: t.cacheTulis, cacheBacaPerJuta: t.cacheBaca })),
    rute,
  };
}

const EFFORT = ["low", "medium", "high", "max"];

function Bagian({ judul, deskripsi, children, id }: { judul: string; deskripsi?: string; children: React.ReactNode; id?: string }) {
  return (
    <Card className="border-border/80" id={id}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{judul}</CardTitle>
        {deskripsi ? <CardDescription>{deskripsi}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Medan({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Pesan({ teks, baik }: { teks: string; baik?: boolean }) {
  if (!teks) return null;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 break-words rounded-md border px-3 py-2 text-sm ${
        baik ? "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-amber-300/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      }`}
    >
      {baik ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0">{teks}</span>
    </p>
  );
}

function angka(nilai: string): number {
  const n = Number(nilai.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function TabelLaporan({ judul, baris }: { judul: string; baris?: BarisLaporan[] }) {
  if (!baris?.length) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-sm font-semibold">{judul}</h4>
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Nama</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Giliran</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Pendapatan</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Biaya API</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">MDR</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Laba</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <tr key={`${b.kunci ?? b.nama}-${i}`} className="border-t border-border/50">
                <td className="px-3 py-2">{b.nama ?? b.kunci ?? "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{b.giliran ?? "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(b.pendapatanRp)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(b.biayaApiRp)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(b.biayaMdrRp ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(b.labaRp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function kunciBaru(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function bulanIni() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

export function AletaAiPengaturan({ pengguna }: { pengguna: PenggunaPilihan[] }) {
  const [form, setForm] = useState<PengaturanAi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [pesanSimpan, setPesanSimpan] = useState<{ teks: string; baik: boolean }>({ teks: "", baik: true });
  const [kurs, setKurs] = useState<Kurs | null>(null);
  const [proyek, setProyek] = useState<Proyek | null>(null);
  const [pesanProyek, setPesanProyek] = useState<{ teks: string; baik: boolean }>({ teks: "", baik: true });
  const [mengunggah, setMengunggah] = useState(false);
  const [cariPengguna, setCariPengguna] = useState("");
  const [penggunaId, setPenggunaId] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [catatan, setCatatan] = useState("");
  const [pesanSaldo, setPesanSaldo] = useState<{ teks: string; baik: boolean }>({ teks: "", baik: true });
  const [jumlahKoreksi, setJumlahKoreksi] = useState("");
  const [alasanKoreksi, setAlasanKoreksi] = useState("");
  // Satu kunci per pengisian formulir: klik ganda/kirim ulang tidak menggandakan koreksi.
  const [kunciKoreksi, setKunciKoreksi] = useState(() => kunciBaru());
  const [pesanKoreksi, setPesanKoreksi] = useState<{ teks: string; baik: boolean }>({ teks: "", baik: true });
  const [bulan, setBulan] = useState(bulanIni());
  const [sampai, setSampai] = useState(bulanIni());
  const [kuota, setKuota] = useState<KuotaPeran[]>([]);
  const [pesanKuota, setPesanKuota] = useState<{ teks: string; baik: boolean }>({ teks: "", baik: true });
  const [rekon, setRekon] = useState<Rekonsiliasi[]>([]);
  const [pesanRekon, setPesanRekon] = useState<{ teks: string; baik: boolean }>({ teks: "", baik: true });
  const [laporan, setLaporan] = useState<Laporan | null>(null);
  const [kunciClaude, setKunciClaude] = useState<{ sumber?: string; namaKoneksi?: string } | null>(null);
  const [pesanLaporan, setPesanLaporan] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    const [p, k, pr, ku, re] = await Promise.all([
      ambil<unknown>("/api/aleta-ai/pengaturan"),
      ambil<Kurs>("/api/aleta-ai/kurs"),
      ambil<Proyek>("/api/aleta-ai/proyek"),
      ambil<unknown>("/api/aleta-ai/kuota"),
      ambil<unknown>("/api/aleta-ai/rekonsiliasi"),
    ]);
    if (p.ok) {
      setForm(keLayar(p.data));
      const kc = (p.data as { kunciClaude?: { sumber?: string; namaKoneksi?: string } } | null)?.kunciClaude;
      setKunciClaude(kc && typeof kc === "object" ? kc : null);
    } else setGalat(p.galat);
    if (ku.ok && Array.isArray(ku.data)) setKuota(ku.data as KuotaPeran[]);
    if (re.ok && Array.isArray(re.data)) setRekon(re.data as Rekonsiliasi[]);
    if (k.ok) setKurs(k.data);
    if (pr.ok) setProyek(pr.data);
    setMemuat(false);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const hasilCari = useMemo(() => {
    const kata = cariPengguna.trim().toLowerCase();
    if (!kata) return [];
    return pengguna.filter((p) => p.name.toLowerCase().includes(kata) || (p.jabatan ?? "").toLowerCase().includes(kata)).slice(0, 8);
  }, [pengguna, cariPengguna]);
  const penggunaTerpilih = pengguna.find((p) => p.id === penggunaId) ?? null;

  function ubah<K extends keyof PengaturanAi>(kunci: K, nilai: PengaturanAi[K]) {
    setForm((f) => (f ? { ...f, [kunci]: nilai } : f));
    setPesanSimpan({ teks: "", baik: true });
  }

  async function simpan() {
    if (!form) return;
    setMenyimpan(true);
    setPesanSimpan({ teks: "", baik: true });
    const r = await kirimJson<unknown>("/api/aleta-ai/pengaturan", "PUT", keServer(form));
    setMenyimpan(false);
    if (!r.ok) {
      setPesanSimpan({ teks: r.galat, baik: false });
      return;
    }
    if (r.data && typeof r.data === "object" && "tarif" in r.data) setForm(keLayar(r.data));
    setPesanSimpan({ teks: "Pengaturan tersimpan.", baik: true });
  }

  async function unggahProyek(berkas: File | null) {
    if (!berkas) return;
    setMengunggah(true);
    setPesanProyek({ teks: "", baik: true });
    const data = new FormData();
    data.append("berkas", berkas);
    const r = await ambil<Proyek>("/api/aleta-ai/proyek", { method: "POST", body: data });
    setMengunggah(false);
    if (!r.ok) {
      setPesanProyek({ teks: r.galat, baik: false });
      return;
    }
    setPesanProyek({ teks: "Proyek V4.5 berhasil diunggah.", baik: true });
    const baru = await ambil<Proyek>("/api/aleta-ai/proyek");
    if (baru.ok) setProyek(baru.data);
    else if (r.data) setProyek(r.data);
  }

  async function isiSaldo() {
    const jumlahRp = Math.round(angka(jumlah));
    if (!penggunaId) return setPesanSaldo({ teks: "Pilih pengguna dulu.", baik: false });
    if (jumlahRp === 0) return setPesanSaldo({ teks: "Isi jumlah rupiah yang akan ditambahkan.", baik: false });
    if (jumlahRp < 0) return setPesanSaldo({ teks: "Isi saldo hanya menambah. Untuk mengurangi, pakai Koreksi saldo di bawah dengan alasannya.", baik: false });
    const r = await kirimJson<{ saldoRp?: number }>("/api/aleta-ai/saldo/isi", "POST", { penggunaId, jumlahRp, catatan: catatan.trim() });
    if (!r.ok) return setPesanSaldo({ teks: r.galat, baik: false });
    setPesanSaldo({
      teks: `Saldo ${penggunaTerpilih?.name ?? "pengguna"} bertambah ${formatRupiah(jumlahRp)}${r.data?.saldoRp != null ? `; saldo kini ${formatRupiah(r.data.saldoRp)}` : ""}.`,
      baik: true,
    });
    setJumlah("");
    setCatatan("");
  }

  async function koreksi() {
    const jumlahRp = Math.round(angka(jumlahKoreksi));
    if (!penggunaId) return setPesanKoreksi({ teks: "Pilih pengguna dulu.", baik: false });
    if (jumlahRp === 0) return setPesanKoreksi({ teks: "Isi jumlah koreksi (minus untuk mengurangi).", baik: false });
    if (alasanKoreksi.trim().length < 5) return setPesanKoreksi({ teks: "Alasan koreksi wajib diisi (minimal 5 huruf).", baik: false });
    const r = await kirimJson<{ saldoRp?: number }>("/api/aleta-ai/saldo/koreksi", "POST", { penggunaId, jumlahRp, alasan: alasanKoreksi.trim(), kunci: kunciKoreksi });
    if (!r.ok) return setPesanKoreksi({ teks: r.galat, baik: false });
    setPesanKoreksi({
      teks: `Saldo ${penggunaTerpilih?.name ?? "pengguna"} dikoreksi ${jumlahRp > 0 ? "+" : "-"}${formatRupiah(Math.abs(jumlahRp))}${r.data?.saldoRp != null ? `; saldo kini ${formatRupiah(r.data.saldoRp)}` : ""}.`,
      baik: true,
    });
    setJumlahKoreksi("");
    setAlasanKoreksi("");
    setKunciKoreksi(kunciBaru());
  }

  async function simpanKuota() {
    const r = await kirimJson<unknown>("/api/aleta-ai/kuota", "PUT", { kuota });
    if (!r.ok) return setPesanKuota({ teks: r.galat, baik: false });
    if (Array.isArray(r.data)) setKuota(r.data as KuotaPeran[]);
    setPesanKuota({ teks: "Kuota per peran tersimpan.", baik: true });
  }

  async function berikanKuota() {
    const r = await kirimJson<{ penerima?: number; totalRp?: number }>("/api/aleta-ai/kuota", "POST");
    if (!r.ok) return setPesanKuota({ teks: r.galat, baik: false });
    setPesanKuota({ teks: `Kuota bulan ini diberikan kepada ${r.data?.penerima ?? 0} pengguna (${formatRupiah(r.data?.totalRp ?? 0)}).`, baik: true });
  }

  async function jalankanRekonsiliasi() {
    const r = await kirimJson<Rekonsiliasi>("/api/aleta-ai/rekonsiliasi", "POST", {});
    if (!r.ok) return setPesanRekon({ teks: r.galat, baik: false });
    setPesanRekon({ teks: `Rekonsiliasi ${r.data.tanggal}: ${LABEL_REKONSILIASI[r.data.status] ?? r.data.status}.`, baik: r.data.status === "seimbang" });
    const daftar = await ambil<unknown>("/api/aleta-ai/rekonsiliasi");
    if (daftar.ok && Array.isArray(daftar.data)) setRekon(daftar.data as Rekonsiliasi[]);
  }

  const kueriLaporan = `dari=${encodeURIComponent(bulan)}&sampai=${encodeURIComponent(sampai < bulan ? bulan : sampai)}`;

  async function muatLaporan() {
    setPesanLaporan("");
    const r = await ambil<Laporan>(`/api/aleta-ai/laporan?bulan=${encodeURIComponent(bulan)}&${kueriLaporan}`);
    if (!r.ok) {
      setLaporan(null);
      setPesanLaporan(r.galat);
      return;
    }
    setLaporan(r.data);
  }

  if (memuat) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat pengaturan...
      </p>
    );
  }

  if (!form) {
    return (
      <div className="space-y-3">
        <Pesan teks={galat || "Pengaturan belum dapat dimuat."} />
        <Button variant="outline" onClick={() => void muat()}>
          Coba lagi
        </Button>
      </div>
    );
  }

  const daftarModel = Array.from(new Set(form.tarif.map((t) => t.model)));

  return (
    <div className="space-y-6" data-testid="aleta-ai-pengaturan">
      <Bagian judul="Layanan" deskripsi="Saklar darurat: bila dimatikan, ALETA Ai tidak dapat dipakai siapa pun.">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
          <div>
            <p className="font-medium" id="label-aktif">ALETA Ai aktif</p>
            <p className="text-sm text-muted-foreground">{form.aktif ? "Pengguna yang berhak dapat memakainya." : "Layanan sedang dimatikan."}</p>
          </div>
          <Switch checked={form.aktif} onCheckedChange={(v) => ubah("aktif", v)} aria-labelledby="label-aktif" />
        </div>
        <p className="text-sm text-muted-foreground" data-testid="status-kunci-claude">
          Kunci Claude:{" "}
          <strong className="text-foreground">
            {kunciClaude?.sumber === "pengaturan-ai"
              ? `dari Pengaturan AI (${kunciClaude.namaKoneksi ?? "koneksi Claude"})`
              : kunciClaude?.sumber === "env"
                ? "dari pengaturan server"
                : "belum ada"}
          </strong>{" "}
          - <a className="underline underline-offset-2" href={apiPath("/admin/pengaturan-ai")}>atur di Pengaturan AI</a>
        </p>
      </Bagian>

      <Bagian judul="Harga dan batas" deskripsi="Harga satu giliran = biaya API x kurs x (1 + margin) + MDR QRIS, dibulatkan ke atas, tidak kurang dari minimum.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Medan label="Margin (%)" htmlFor="ai-margin" hint="Keuntungan pengelola di atas biaya.">
            <Input id="ai-margin" type="number" inputMode="decimal" min={0} step="0.5" value={form.margin} onChange={(e) => ubah("margin", angka(e.target.value))} />
          </Medan>
          <Medan label="Penyangga kurs (%)" htmlFor="ai-penyangga" hint="Ditambahkan ke kurs harian karena kurs bergerak.">
            <Input id="ai-penyangga" type="number" inputMode="decimal" min={0} step="0.5" value={form.penyanggaKurs} onChange={(e) => ubah("penyanggaKurs", angka(e.target.value))} />
          </Medan>
          <Medan label="Minimum per giliran (Rp)" htmlFor="ai-minimum">
            <Input id="ai-minimum" type="number" inputMode="numeric" min={0} step="100" value={form.minimumRp} onChange={(e) => ubah("minimumRp", angka(e.target.value))} />
          </Medan>
          <Medan label="Pembulatan ke atas (Rp)" htmlFor="ai-pembulatan">
            <Input id="ai-pembulatan" type="number" inputMode="numeric" min={0} step="100" value={form.pembulatanRp} onChange={(e) => ubah("pembulatanRp", angka(e.target.value))} />
          </Medan>
          <Medan label="Batas harian per pengguna (Rp)" htmlFor="ai-harian">
            <Input id="ai-harian" type="number" inputMode="numeric" min={0} step="1000" value={form.batasHarianRp} onChange={(e) => ubah("batasHarianRp", angka(e.target.value))} />
          </Medan>
          {form.mdrPersen != null ? (
            <Medan label="MDR QRIS (%)" htmlFor="ai-mdr" hint="Biaya pembayaran yang ditambahkan ke harga.">
              <Input id="ai-mdr" type="number" inputMode="decimal" min={0} max={5} step="0.1" value={form.mdrPersen} onChange={(e) => ubah("mdrPersen", angka(e.target.value))} />
            </Medan>
          ) : null}
          {form.batasSatkerBulananRp != null ? (
            <Medan label="Batas satker per bulan (Rp)" htmlFor="ai-satker" hint="Biaya API seluruh pengguna sebulan. 0 = tanpa batas.">
              <Input id="ai-satker" type="number" inputMode="numeric" min={0} step="100000" value={form.batasSatkerBulananRp} onChange={(e) => ubah("batasSatkerBulananRp", angka(e.target.value))} />
            </Medan>
          ) : null}
          {form.ambangSaldoMenipisRp != null ? (
            <Medan label="Ambang saldo menipis (Rp)" htmlFor="ai-menipis" hint="Di bawah angka ini pengguna diberi tahu.">
              <Input id="ai-menipis" type="number" inputMode="numeric" min={0} step="1000" value={form.ambangSaldoMenipisRp} onChange={(e) => ubah("ambangSaldoMenipisRp", angka(e.target.value))} />
            </Medan>
          ) : null}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm" data-testid="kurs-terakhir">
          <p className="font-medium">Kurs terakhir</p>
          {kurs && (kurs.kurs || kurs.kursPakai) ? (
            <p className="text-muted-foreground">
              USD 1 = {formatRupiah(kurs.kurs ?? kurs.kursPakai)}
              {kurs.tanggal ? ` pada ${kurs.tanggal}` : ""}
              {kurs.sumber ? `, sumber ${kurs.sumber}` : ""}. Diambil otomatis tiap hari; bila gagal, kurs terakhir dipakai.
            </p>
          ) : (
            <p className="text-muted-foreground">Belum ada kurs tersimpan.</p>
          )}
        </div>
      </Bagian>

      <Bagian judul="Tarif per model" deskripsi="Dalam dolar per juta token. Diisi mengikuti tarif resmi penyedia.">
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Model</th>
                <th scope="col" className="px-3 py-2 font-semibold">Masuk</th>
                <th scope="col" className="px-3 py-2 font-semibold">Keluar</th>
                <th scope="col" className="px-3 py-2 font-semibold">Simpan cache</th>
                <th scope="col" className="px-3 py-2 font-semibold">Baca cache</th>
              </tr>
            </thead>
            <tbody>
              {form.tarif.map((t, i) => (
                <tr key={t.model} className="border-t border-border/50">
                  <th scope="row" className="px-3 py-2 font-medium">{t.model}</th>
                  {(["masuk", "keluar", "cacheTulis", "cacheBaca"] as const).map((k) => (
                    <td key={k} className="px-2 py-1.5">
                      <Input
                        aria-label={`${k === "masuk" ? "Tarif masuk" : k === "keluar" ? "Tarif keluar" : k === "cacheTulis" ? "Tarif simpan cache" : "Tarif baca cache"} ${t.model}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        className="h-9 min-w-[5.5rem]"
                        value={t[k]}
                        onChange={(e) => ubah("tarif", form.tarif.map((x, j) => (j === i ? { ...x, [k]: angka(e.target.value) } : x)))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bagian>

      <Bagian judul="Rute model" deskripsi="Setiap jenis permintaan dipetakan ke model dan tingkat ketelitian. Pengguna hanya melihat label mode, tidak pernah nama model.">
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Kelompok</th>
                <th scope="col" className="px-3 py-2 font-semibold">Model</th>
                <th scope="col" className="px-3 py-2 font-semibold">Ketelitian</th>
                <th scope="col" className="px-3 py-2 font-semibold">Label</th>
                <th scope="col" className="px-3 py-2 font-semibold">Peran yang boleh</th>
              </tr>
            </thead>
            <tbody>
              {form.rute.map((r, i) => {
                const ganti = (patch: Partial<typeof r>) => ubah("rute", form.rute.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={`${r.kelompok}-${i}`} className="border-t border-border/50 align-top">
                    <th scope="row" className="px-3 py-2 font-medium">{r.kelompok}</th>
                    <td className="px-2 py-1.5">
                      <NativeSelect aria-label={`Model untuk ${r.kelompok}`} className="h-9" value={r.model} onChange={(e) => ganti({ model: e.target.value })}>
                        {Array.from(new Set([...daftarModel, r.model])).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-2 py-1.5">
                      <NativeSelect aria-label={`Ketelitian untuk ${r.kelompok}`} className="h-9" value={r.effort} onChange={(e) => ganti({ effort: e.target.value })}>
                        {Array.from(new Set([...EFFORT, r.effort])).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-2 py-1.5">
                      <NativeSelect aria-label={`Label untuk ${r.kelompok}`} className="h-9" value={r.label} onChange={(e) => ganti({ label: e.target.value })}>
                        {Array.from(new Set([...Object.values(LABEL_MODE), r.label])).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </NativeSelect>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Peran untuk ${r.kelompok}`}
                        className="h-9 min-w-[10rem]"
                        value={r.peran.join(", ")}
                        placeholder="semua peran"
                        onChange={(e) => ganti({ peran: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Bagian>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-card/95 px-4 py-3 shadow-panel backdrop-blur">
        <Button onClick={() => void simpan()} disabled={menyimpan}>
          {menyimpan ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />} Simpan pengaturan
        </Button>
        <Pesan teks={pesanSimpan.teks} baik={pesanSimpan.baik} />
      </div>

      <Bagian judul="Kemampuan per peran" deskripsi="Apa yang boleh dibuat ALETA Ai untuk tiap peran. Berlaku di server pada setiap permintaan, juga lewat ekstensi.">
        <MatriksKemampuanAi />
      </Bagian>

      <Bagian judul="Proyek ALETA AI PA V4.5" deskripsi="Satu sumber pengetahuan (Core Prompt dan modul). Unggah berkas ZIP versi baru bila ada pembaruan.">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Versi aktif: {proyek?.versi ?? "belum ada"}</Badge>
          {proyek?.diperbarui ? <span className="text-sm text-muted-foreground">diperbarui {proyek.diperbarui}</span> : null}
        </div>
        <Medan label="Unggah berkas ZIP proyek" htmlFor="ai-proyek-zip">
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="ai-proyek-zip"
              type="file"
              accept=".zip,application/zip"
              disabled={mengunggah}
              onChange={(e) => void unggahProyek(e.target.files?.[0] ?? null)}
              className="block max-w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            {mengunggah ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4 text-muted-foreground" aria-hidden="true" />}
          </div>
        </Medan>
        <Pesan teks={pesanProyek.teks} baik={pesanProyek.baik} />
        {proyek?.modul?.length ? (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Modul</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Versi</th>
                </tr>
              </thead>
              <tbody>
                {proyek.modul.map((m) => (
                  <tr key={m.nama} className="border-t border-border/50">
                    <td className="px-3 py-2">{m.nama}</td>
                    <td className="px-3 py-2 tabular-nums">{m.versi ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada modul yang dimuat.</p>
        )}
        {proyek?.riwayat?.length ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {proyek.riwayat.map((r) => (
              <li key={r.versi}>
                Versi {r.versi}
                {r.tanggal ? `, ${r.tanggal}` : ""}
                {r.oleh ? `, oleh ${r.oleh}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </Bagian>

      <Bagian judul="Isi saldo pengguna" deskripsi="Menambah saldo pengguna. Untuk mengurangi atau membetulkan saldo, pakai Koreksi saldo (alasan wajib). Setiap perubahan tercatat sebagai mutasi.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Medan label="Cari pengguna" htmlFor="ai-cari-pengguna">
              <Input
                id="ai-cari-pengguna"
                value={penggunaTerpilih ? penggunaTerpilih.name : cariPengguna}
                placeholder="Ketik nama atau jabatan"
                onChange={(e) => {
                  setPenggunaId("");
                  setCariPengguna(e.target.value);
                }}
              />
            </Medan>
            {!penggunaTerpilih && hasilCari.length ? (
              <ul className="max-h-48 overflow-y-auto rounded-xl border border-border/70 bg-card" aria-label="Hasil pencarian pengguna">
                {hasilCari.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPenggunaId(p.id);
                        setCariPengguna("");
                      }}
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.jabatan ? <span className="text-xs text-muted-foreground">{p.jabatan}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="space-y-4">
            <Medan label="Jumlah (Rp)" htmlFor="ai-jumlah-saldo">
              <Input id="ai-jumlah-saldo" type="number" inputMode="numeric" step="1000" value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
            </Medan>
            <Medan label="Catatan" htmlFor="ai-catatan-saldo">
              <Input id="ai-catatan-saldo" value={catatan} maxLength={200} placeholder="Mis. setoran tunai 20 Okt" onChange={(e) => setCatatan(e.target.value)} />
            </Medan>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void isiSaldo()}>Isi saldo</Button>
          <Pesan teks={pesanSaldo.teks} baik={pesanSaldo.baik} />
        </div>
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3" data-testid="koreksi-saldo">
          <p className="text-sm font-medium">Koreksi saldo (pengguna yang dipilih di atas)</p>
          <p className="text-sm text-muted-foreground">
            Angka plus menambah, minus mengurangi. Saldo tidak boleh menjadi negatif. Pengguna melihatnya di mutasi sebagai &quot;Koreksi oleh admin: alasan&quot;.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Medan label="Jumlah koreksi (Rp)" htmlFor="ai-jumlah-koreksi">
              <Input id="ai-jumlah-koreksi" type="number" inputMode="numeric" step="1000" value={jumlahKoreksi} onChange={(e) => setJumlahKoreksi(e.target.value)} />
            </Medan>
            <Medan label="Alasan koreksi (wajib)" htmlFor="ai-alasan-koreksi">
              <Input id="ai-alasan-koreksi" value={alasanKoreksi} maxLength={200} placeholder="Mis. salah ketik isi saldo 20 Okt" onChange={(e) => setAlasanKoreksi(e.target.value)} />
            </Medan>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void koreksi()}>
              Koreksi saldo
            </Button>
            <Pesan teks={pesanKoreksi.teks} baik={pesanKoreksi.baik} />
          </div>
        </div>
      </Bagian>

      <Bagian judul="Kuota hibah per peran" deskripsi="Opsional. Rupiah per bulan untuk setiap pengguna peran itu; tercatat sebagai mutasi kuota, diberikan sekali sebulan. 0 = tanpa kuota.">
        <div className="space-y-2" data-testid="kuota-peran">
          {kuota.map((k, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <Medan label="Peran" htmlFor={`ai-kuota-peran-${i}`}>
                <Input id={`ai-kuota-peran-${i}`} value={k.peranId} placeholder="mis. hakim" className="w-48" onChange={(e) => setKuota(kuota.map((x, j) => (j === i ? { ...x, peranId: e.target.value.trim() } : x)))} />
              </Medan>
              <Medan label="Kuota per bulan (Rp)" htmlFor={`ai-kuota-rp-${i}`}>
                <Input id={`ai-kuota-rp-${i}`} type="number" inputMode="numeric" min={0} step="1000" value={k.kuotaBulananRp} className="w-48" onChange={(e) => setKuota(kuota.map((x, j) => (j === i ? { ...x, kuotaBulananRp: angka(e.target.value) } : x)))} />
              </Medan>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setKuota([...kuota, { peranId: "", kuotaBulananRp: 0 }])}>
            Tambah peran
          </Button>
          <Button onClick={() => void simpanKuota()}>Simpan kuota</Button>
          <Button variant="outline" onClick={() => void berikanKuota()}>
            Berikan kuota bulan ini
          </Button>
          <Pesan teks={pesanKuota.teks} baik={pesanKuota.baik} />
        </div>
      </Bagian>

      <Bagian
        id="rekonsiliasi"
        judul="Rekonsiliasi harian"
        deskripsi="Tiap hari, data kemarin diperiksa otomatis: saldo setiap pengguna dicocokkan dengan jumlah mutasinya, pendapatan giliran dengan potongan saldo, dan tahanan dana yang lebih dari 24 jam belum ditutup ditandai. Bila tidak cocok, Super Admin diberi tahu di lonceng. Tidak ada saldo yang diubah otomatis."
      >
        {form.rekonsiliasiOtomatis != null ? (
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <Switch checked={form.rekonsiliasiOtomatis} onCheckedChange={(v) => ubah("rekonsiliasiOtomatis", v)} aria-labelledby="label-rekon-otomatis" />
              <p className="text-sm font-medium" id="label-rekon-otomatis">
                Rekonsiliasi otomatis {form.rekonsiliasiOtomatis ? "menyala" : "mati"}
              </p>
            </div>
            <Medan label="Jam pemeriksaan (WITA, 0-23)" htmlFor="ai-jam-rekon" hint="Simpan dengan tombol Simpan pengaturan.">
              <Input id="ai-jam-rekon" type="number" inputMode="numeric" min={0} max={23} step={1} className="w-32" value={form.jamRekonsiliasi ?? 1} onChange={(e) => ubah("jamRekonsiliasi", angka(e.target.value))} />
            </Medan>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void jalankanRekonsiliasi()}>
            Jalankan rekonsiliasi hari ini
          </Button>
          <Pesan teks={pesanRekon.teks} baik={pesanRekon.baik} />
        </div>
        {rekon.length ? (
          <ul className="space-y-1 text-sm" data-testid="daftar-rekonsiliasi">
            {rekon.slice(0, 14).map((r) => (
              <li key={r.tanggal} className={r.status === "seimbang" ? "text-muted-foreground" : "font-medium text-amber-700 dark:text-amber-300"}>
                {r.tanggal}: {LABEL_REKONSILIASI[r.status] ?? r.status}
                {r.olehId === "sistem:jadwal" ? " (otomatis)" : r.olehId ? " (manual)" : ""}
                {r.jumlahSelisih ? `, ${r.jumlahSelisih} selisih` : ""}
                {r.tahananMenggantung ? `, ${r.tahananMenggantung} tahanan menggantung` : ""}; pendapatan {formatRupiah(r.pendapatanGiliranRp)}, potongan {formatRupiah(r.potongMutasiRp)}
              </li>
            ))}
          </ul>
        ) : null}
      </Bagian>

      <Bagian judul="Laporan bulanan" deskripsi="Laba = pendapatan - biaya API - biaya pembayaran.">
        <div className="flex flex-wrap items-end gap-3">
          <Medan label="Bulan" htmlFor="ai-bulan">
            <Input id="ai-bulan" type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="w-48" />
          </Medan>
          <Medan label="Sampai bulan" htmlFor="ai-sampai">
            <Input id="ai-sampai" type="month" value={sampai} onChange={(e) => setSampai(e.target.value)} className="w-48" />
          </Medan>
          <Button variant="outline" onClick={() => void muatLaporan()}>
            Tampilkan laporan
          </Button>
          <a
            href={apiPath(`/api/aleta-ai/laporan/ekspor?format=xlsx&${kueriLaporan}`)}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Unduh XLSX
          </a>
          <a
            href={apiPath(`/api/aleta-ai/laporan/ekspor?format=csv&${kueriLaporan}`)}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Unduh CSV
          </a>
        </div>
        <Pesan teks={pesanLaporan} />
        {laporan ? (
          <div className="space-y-4" data-testid="laporan-bulan">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Pendapatan", nilai: laporan.pendapatanRp },
                { label: "Biaya API", nilai: laporan.biayaApiRp },
                ...(laporan.biayaMdrRp != null ? [{ label: "Biaya pembayaran", nilai: laporan.biayaMdrRp }] : []),
                { label: "Laba", nilai: laporan.labaRp },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                  <div className="text-xl font-semibold tabular-nums">{formatRupiah(k.nilai)}</div>
                  <div className="text-xs text-muted-foreground">{k.label}</div>
                </div>
              ))}
            </div>
            <TabelLaporan judul="Per bulan" baris={laporan.perBulan} />
            <TabelLaporan judul="Per pengguna" baris={laporan.perPengguna} />
            <TabelLaporan judul="Per peran" baris={laporan.perPeran} />
            <TabelLaporan judul="Per kelompok permintaan" baris={laporan.perKelompok} />
            <TabelLaporan judul="Per model" baris={laporan.perModel} />
          </div>
        ) : null}
      </Bagian>
    </div>
  );
}
