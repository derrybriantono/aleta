"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Lock, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { getEffectiveRoleId } from "@/lib/permissions";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { AMBANG_UKUR, DAFTAR_TIPE, adalahKunciDaftar } from "@/lib/tipe-keluaran/kontrak";
import { nilaiHasilUkur, validasiEntri } from "@/lib/tipe-keluaran/validasi";
import { type UserPersona } from "@/lib/types";

/**
 * Pengaturan tipe keluaran ekstensi, BAS, dan putusan (K4, K13).
 *
 * ============================================================================
 * BAWAAN TERKUNCI, TAMBAHAN BERJEJAK
 * ============================================================================
 *
 * Bawaan adalah kalimat dan penunjuk yang tertanam di kode. Di layar ini ia
 * TIDAK DAPAT DISUNTING - hanya dimatikan atau dinyalakan (dengan alasan),
 * atau diusulkan penggantinya. Tambahan masuk sebagai usulan dan baru berlaku
 * sesudah disahkan Super Admin atas perintah seseorang yang disebut; kalimat
 * BAS dan kalimat putusan atas perintah ketua, wakil ketua, atau hakim.
 * Tidak ada tombol hapus: pertanyaan "sejak kapan kalimat ini berbunyi
 * begini, dan atas perintah siapa" harus tetap terjawab.
 *
 * Daftar berjenis 'deteksi' (kata pemicu, sebutan sumber hukum, padanan jenis)
 * baru dapat disahkan sesudah LULUS GERBANG UKUR atas data SIPP sungguhan
 * (tombol "Ukur"): aturan deteksi hasil tebakan sudah tiga kali salah di repo
 * ini. Untuk kata pemicu, pengesah membaca 20 contoh kalimat yang tertangkap
 * dan menandai yang salah; paling banyak 10% boleh salah.
 *
 * Daftar BAS yang dipakai penyusun saksi bot punya tombol "Pratinjau": keluaran
 * penyusun bot sungguhan seandainya usulan itu disahkan, berdampingan untuk
 * 2-4 saksi. Panitera tetap memilih dan memeriksa sebelum menyimpan BAS -
 * pratinjau ini hanya menunjukkan apa yang akan ditawarkan.
 *
 * Tombol sahkan disembunyikan untuk selain Super Admin supaya layar tidak
 * menawarkan tindakan yang pasti ditolak - tetapi penjagaannya tetap di
 * peladen (tipe-keluaran.ts), bukan di sini.
 */

/** Peran yang boleh menjadi pemberi perintah kalimat BAS/putusan - sama dengan PERAN_PENGACC (bas-acc.ts). */
export const PERAN_PEMBERI_PERINTAH = ["ketua", "wakil-ketua", "hakim"] as const;

type Riwayat = {
  id: string;
  tindakan: string;
  alasan: string;
  oleh: string;
  pada: string;
};

export type ButirLayar = {
  id: string;
  daftar: string;
  kunci: string;
  nilai: string;
  data: Record<string, unknown>;
  asal: "bawaan" | "tambahan";
  keadaan: string;
  aktif: boolean;
  urutan: number;
  versi: number;
  alasan: string;
  /** Hasil gerbang ukur (daftar deteksi) - null bila belum diukur. */
  hasilUkur?: unknown;
  dibuatOleh: string;
  disahkanOleh: string | null;
  atasPerintah: string | null;
  menggantikanId: string | null;
  digantiOleh: string | null;
  yatim: boolean;
  berlaku: boolean;
  riwayat: Riwayat[];
};

export type DaftarLayar = {
  daftar: string;
  golongan: string;
  jenis: "tulis" | "deteksi";
  judul: string;
  bentukKunci: string;
  bentukNilai: string;
  dapatDitambah: boolean;
  bercermin: boolean;
  butuhUkur: boolean;
  butir: ButirLayar[];
};

type Tab = "bas" | "putusan";

/** Golongan yang dimuat tiap tab. 'bersama' dipakai BAS dan putusan, jadi tampil di keduanya. */
const GOLONGAN_TAB: Record<Tab, string[]> = {
  bas: ["bas", "bersama"],
  putusan: ["putusan", "bersama"],
};

type Aksi = { id: string; tindakan: "sahkan" | "tolak" | "matikan" | "nyalakan" };

function bolehMemerintah(u: UserPersona): boolean {
  if (!u.isActive) return false;
  const peran = new Set<string>([String(u.roleId ?? ""), String(getEffectiveRoleId(u) ?? ""), ...(u.additionalRoleIds ?? [])]);
  return PERAN_PEMBERI_PERINTAH.some((p) => peran.has(p));
}

function tanggalJam(iso: string) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function uraiData(teks: string): { ok: true; data: unknown } | { ok: false; sebab: string } {
  const bersih = teks.trim();
  if (!bersih) return { ok: true, data: {} };
  try {
    return { ok: true, data: JSON.parse(bersih) };
  } catch {
    return { ok: false, sebab: "Data harus JSON yang sah, misalnya {} atau {\"penunjuk\":\"select[name=...]\"}." };
  }
}

function labelKeadaan(b: ButirLayar): { teks: string; varian: "default" | "success" | "warning" | "danger" | "muted" } {
  if (b.yatim) return { teks: "yatim - tidak ada lagi di kode", varian: "danger" };
  if (b.keadaan === "usulan") return { teks: "usulan", varian: "warning" };
  if (b.keadaan === "ditolak") return { teks: "ditolak", varian: "muted" };
  if (b.keadaan === "diganti") return { teks: "diganti", varian: "muted" };
  if (b.keadaan === "disahkan" && !b.aktif) return { teks: "dimatikan", varian: "muted" };
  return { teks: b.berlaku ? "berlaku" : "disahkan", varian: b.berlaku ? "success" : "default" };
}

/** Isi satu tab: golongannya dimuat berurutan, daftar 'bersama' tidak diulang. Galat dilempar. */
async function ambilTab(t: Tab): Promise<DaftarLayar[]> {
  const semua: DaftarLayar[] = [];
  const terlihat = new Set<string>();
  for (const golongan of GOLONGAN_TAB[t]) {
    const jawaban = await fetch(apiPath(`/api/aleta-ecourt/tipe-keluaran?golongan=${golongan}`), { cache: "no-store" });
    const badan = (await jawaban.json().catch(() => null)) as { ok?: boolean; daftar?: DaftarLayar[] } | null;
    if (!jawaban.ok || !badan?.ok || !Array.isArray(badan.daftar)) {
      throw new Error(pesanGalatPortal(badan, `Tipe keluaran golongan ${golongan} tidak dapat dimuat (${jawaban.status}).`));
    }
    for (const d of badan.daftar) {
      if (terlihat.has(d.daftar)) continue;
      terlihat.add(d.daftar);
      semua.push(d);
    }
  }
  return semua;
}

async function kirimTindakan(badan: Record<string, unknown>): Promise<{ ok: boolean; pesan: string }> {
  const jawaban = await fetch(apiPath("/api/aleta-ecourt/tipe-keluaran"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(badan),
  });
  const isi = (await jawaban.json().catch(() => null)) as { ok?: boolean; alasan?: unknown } | null;
  if (jawaban.ok && isi?.ok) return { ok: true, pesan: "" };
  if (Array.isArray(isi?.alasan)) return { ok: false, pesan: isi.alasan.map(String).join(" ") };
  return { ok: false, pesan: pesanGalatPortal(isi, `Tindakan gagal (${jawaban.status}).`) };
}

// ============================================================================
// FORMULIR USUL / GANTI - divalidasi langsung dengan validasi.ts
// ============================================================================

function FormulirEntri({
  daftar,
  pengganti,
  onSelesai,
  onBatal,
}: {
  daftar: DaftarLayar;
  /** Bila ada: mengusulkan pengganti butir ini (kunci terkunci). */
  pengganti?: ButirLayar;
  onSelesai: (pesan: string) => void;
  onBatal: () => void;
}) {
  const [kunci, setKunci] = useState(pengganti?.kunci ?? "");
  const [nilai, setNilai] = useState(pengganti?.nilai ?? "");
  const [dataTeks, setDataTeks] = useState(pengganti ? JSON.stringify(pengganti.data ?? {}) : "{}");
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const periksa = useMemo(() => {
    const data = uraiData(dataTeks);
    if (!data.ok) return [data.sebab];
    if (!adalahKunciDaftar(daftar.daftar)) return [`Daftar ${daftar.daftar} tidak terdaftar.`];
    const hasil = validasiEntri(daftar.daftar, { kunci, nilai, data: data.data });
    return hasil.ok ? [] : hasil.alasan;
  }, [daftar.daftar, kunci, nilai, dataTeks]);

  const kirim = async () => {
    const data = uraiData(dataTeks);
    if (!data.ok || periksa.length) return;
    setSibuk(true);
    setGalat("");
    try {
      const hasil = await kirimTindakan(
        pengganti
          ? { tindakan: "ganti", id: pengganti.id, kunci, nilai, data: data.data, alasan }
          : { tindakan: "usul", daftar: daftar.daftar, kunci, nilai, data: data.data, alasan }
      );
      if (hasil.ok) onSelesai(pengganti ? "Pengganti diusulkan; yang lama tetap berlaku sampai pengganti disahkan." : "Usulan tersimpan.");
      else setGalat(hasil.pesan);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3" data-testid="formulir-entri">
      <p className="text-sm font-medium">{pengganti ? `Usulkan pengganti (versi ${pengganti.versi + 1})` : "Usulkan tambahan"}</p>
      <label className="block text-xs text-muted-foreground">
        Kunci &mdash; {daftar.bentukKunci}
        <Input value={kunci} disabled={Boolean(pengganti)} onChange={(e) => setKunci(e.target.value)} aria-label="Kunci" />
      </label>
      <label className="block text-xs text-muted-foreground">
        Nilai &mdash; {daftar.bentukNilai}
        <Textarea value={nilai} onChange={(e) => setNilai(e.target.value)} aria-label="Nilai" rows={2} />
      </label>
      <label className="block text-xs text-muted-foreground">
        Data (JSON)
        <Textarea value={dataTeks} onChange={(e) => setDataTeks(e.target.value)} aria-label="Data" rows={2} className="font-mono text-xs" />
      </label>
      <label className="block text-xs text-muted-foreground">
        Alasan
        <Input value={alasan} onChange={(e) => setAlasan(e.target.value)} aria-label="Alasan usulan" />
      </label>
      {periksa.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-destructive" aria-label="Pemeriksaan isian">
          {periksa.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {galat && <p className="text-xs text-destructive">{galat}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={sibuk || periksa.length > 0} onClick={() => void kirim()}>
          {pengganti ? "Usulkan pengganti" : "Usulkan"}
        </Button>
        <Button size="sm" variant="outline" disabled={sibuk} onClick={onBatal}>
          Batal
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// SATU TINDAKAN BERALASAN (sahkan / tolak / matikan / nyalakan)
// ============================================================================

function PanelAksi({
  daftar,
  aksi,
  pemberiPerintah,
  onSelesai,
  onBatal,
}: {
  daftar: DaftarLayar;
  aksi: Aksi;
  pemberiPerintah: UserPersona[];
  onSelesai: (pesan: string) => void;
  onBatal: () => void;
}) {
  const [alasan, setAlasan] = useState("");
  const [atasPerintah, setAtasPerintah] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const alasanWajib = aksi.tindakan !== "sahkan";
  const siap = aksi.tindakan === "sahkan" ? Boolean(atasPerintah) : Boolean(alasan.trim());

  const kirim = async () => {
    if (!siap) return;
    setSibuk(true);
    setGalat("");
    try {
      const hasil = await kirimTindakan({ tindakan: aksi.tindakan, id: aksi.id, alasan, atasPerintah });
      if (hasil.ok) onSelesai(`Butir ${aksi.tindakan === "sahkan" ? "disahkan" : aksi.tindakan === "tolak" ? "ditolak" : aksi.tindakan === "matikan" ? "dimatikan" : "dinyalakan"}.`);
      else setGalat(hasil.pesan);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk(false);
    }
  };

  const perintahHakim = adalahKunciDaftar(daftar.daftar) && DAFTAR_TIPE[daftar.daftar].perintahHakim;

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3" data-testid="panel-aksi">
      {aksi.tindakan === "sahkan" && (
        <label className="block text-xs text-muted-foreground">
          Atas perintah {perintahHakim ? "(ketua, wakil ketua, atau hakim)" : ""}
          <NativeSelect value={atasPerintah} onChange={(e) => setAtasPerintah(e.target.value)} aria-label="Atas perintah">
            <option value="">Pilih pemberi perintah</option>
            {pemberiPerintah.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      <label className="block text-xs text-muted-foreground">
        Alasan {alasanWajib ? "(wajib)" : "(pilihan)"}
        <Input value={alasan} onChange={(e) => setAlasan(e.target.value)} aria-label={`Alasan ${aksi.tindakan}`} />
      </label>
      {galat && <p className="text-xs text-destructive">{galat}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={sibuk || !siap} onClick={() => void kirim()}>
          Kirim {aksi.tindakan}
        </Button>
        <Button size="sm" variant="outline" disabled={sibuk} onClick={onBatal}>
          Batal
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// GERBANG UKUR (daftar deteksi) DAN PRATINJAU (daftar BAS) - Tahap 3
// ============================================================================

/**
 * Daftar BAS yang dipakai penyusun keterangan saksi bot. Sama dengan
 * DAFTAR_PRATINJAU di tipe-keluaran-ukur.ts (peladen); ujinya membandingkan.
 */
export const DAFTAR_DAPAT_PRATINJAU = [
  "bas.saksi.pembuka",
  "bas.saksi.ragam-kata",
  "bas.saksi.jawaban-modus",
  "bas.saksi.bentuk",
  "bas.saksi.profil",
  "bersama.alasan.frasa",
] as const;

type ContohCiri = { id: string; perkaraId: string; kalimat: string; baru: boolean };

type JawabanUkur = {
  ok?: boolean;
  tahap?: "periksa" | "tersimpan";
  penilaian?: { lulus: boolean; sebab: string };
  ukur?: Record<string, unknown> & { contoh?: ContohCiri[] };
  alasan?: unknown;
};

async function kirimUkur(badan: Record<string, unknown>): Promise<{ ok: true; isi: JawabanUkur } | { ok: false; pesan: string }> {
  const jawaban = await fetch(apiPath("/api/aleta-ecourt/tipe-keluaran"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(badan),
  });
  const isi = (await jawaban.json().catch(() => null)) as JawabanUkur | null;
  if (jawaban.ok && isi?.ok) return { ok: true, isi };
  return { ok: false, pesan: pesanGalatPortal(isi, `Tindakan gagal (${jawaban.status}).`) };
}

/** Ringkasan hasil ukur tersimpan - dipakai baris butir. */
function ringkasHasilUkur(daftar: string, hasil: unknown): { teks: string; lulus: boolean } | null {
  if (!hasil || typeof hasil !== "object" || !adalahKunciDaftar(daftar)) return null;
  const h = hasil as Record<string, unknown>;
  const nilai = nilaiHasilUkur(daftar, hasil);
  let teks = "";
  if (h.jenis === "ciri") {
    teks = `${String(h.salah)} dari ${String(h.contoh)} contoh ditandai salah; tangkapan baru ${String(h.tangkapanBaru ?? "-")} dari ${String(h.n ?? "-")} posita`;
  } else if (h.jenis === "sebutan") {
    teks = `sama persis ${String(h.samaSebelum)} -> ${String(h.samaSesudah)} dari ${String(h.sampel)}; salah tambahan ${String(h.salahTambahan)}`;
  } else if (h.jenis === "padanan") {
    teks = h.adaDiSipp === true ? `ada di SIPP (${String(h.jumlahPerkara ?? 0)} perkara)` : "tidak ada di jenis perkara SIPP";
  }
  return { teks: nilai.lulus ? `Lulus ukur: ${teks}` : `Tidak lulus ukur: ${teks}. ${nilai.sebab}`, lulus: nilai.lulus };
}

function PanelUkur({ daftar, butir, onSelesai, onBatal }: { daftar: DaftarLayar; butir: ButirLayar; onSelesai: (pesan: string) => void; onBatal: () => void }) {
  const jenisUkur = adalahKunciDaftar(daftar.daftar) ? DAFTAR_TIPE[daftar.daftar].ukur : null;
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [periksa, setPeriksa] = useState<JawabanUkur["ukur"] | null>(null);
  const [salah, setSalah] = useState<Set<string>>(new Set());

  const jalankan = async (tandaSalah?: string[]) => {
    setSibuk(true);
    setGalat("");
    try {
      const hasil = await kirimUkur({ tindakan: "ukur", id: butir.id, ...(tandaSalah ? { tandaSalah } : {}) });
      if (!hasil.ok) {
        setGalat(hasil.pesan);
        return;
      }
      if (hasil.isi.tahap === "periksa") {
        setPeriksa(hasil.isi.ukur ?? null);
        setSalah(new Set());
        return;
      }
      const p = hasil.isi.penilaian;
      onSelesai(p?.lulus ? "Hasil ukur tersimpan: lulus - usulan dapat disahkan." : `Hasil ukur tersimpan: tidak lulus. ${p?.sebab ?? ""}`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk(false);
    }
  };

  const contoh = periksa?.contoh ?? [];
  const batasSalah = Math.floor(contoh.length * AMBANG_UKUR.ciri.maksimumSalah);

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3" data-testid="panel-ukur">
      <p className="text-xs text-muted-foreground">
        {jenisUkur === "ciri"
          ? `Kata pemicu dijalankan atas posita cerai SIPP 2024+ tanpa dan dengan usulan ini. Baca ${AMBANG_UKUR.ciri.minimumContoh} contoh kalimat yang tertangkap dan tandai yang SALAH tertangkap; paling banyak ${AMBANG_UKUR.ciri.maksimumSalah * 100}% boleh salah.`
          : jenisUkur === "sebutan"
            ? `Usulan Sumber Hukum dibandingkan dengan isian petugas atas ${AMBANG_UKUR.sebutan.minimumSampel} putusan terbaru, tanpa dan dengan sebutan ini. Sama persis tidak boleh turun; salah tambahan paling banyak ${AMBANG_UKUR.sebutan.maksimumSalahTambahan * 100}%.`
            : "Nama lain ini harus benar-benar tertulis di jenis perkara SIPP."}
      </p>
      {periksa && (
        <div className="space-y-2" data-testid="periksa-ciri">
          <p className="text-xs">
            {String(periksa.n)} posita; tertangkap usulan {String(periksa.tangkapanCalon)}; tertangkap BARU {String(periksa.tangkapanBaru)}; kalimat cocok {String(periksa.kalimatCocok)}. Contoh di bawah
            mendahulukan tangkapan baru: {String(periksa.contohBaru ?? 0)} dari {String(contoh.length)} contoh adalah tangkapan baru.
          </p>
          {contoh.length < AMBANG_UKUR.ciri.minimumContoh && (
            <p className="text-xs text-destructive">
              Hanya {contoh.length} kalimat yang tertangkap - kurang dari {AMBANG_UKUR.ciri.minimumContoh}; usulan ini tidak dapat lulus.
            </p>
          )}
          <ol className="space-y-1 pl-4 text-xs">
            {contoh.map((c) => (
              <li key={c.id} className="list-decimal">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Salah tertangkap ${c.id}`}
                    checked={salah.has(c.id)}
                    onChange={(e) =>
                      setSalah((lama) => {
                        const baru = new Set(lama);
                        if (e.target.checked) baru.add(c.id);
                        else baru.delete(c.id);
                        return baru;
                      })
                    }
                  />
                  <span className={salah.has(c.id) ? "line-through" : ""}>
                    {c.kalimat}
                    {c.baru ? <Badge variant="info" className="ml-1">baru</Badge> : null}
                  </span>
                </label>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Ditandai salah {salah.size} dari {contoh.length} (batas lulus {batasSalah}).
          </p>
        </div>
      )}
      {galat && <p className="text-xs text-destructive">{galat}</p>}
      <div className="flex gap-2">
        {jenisUkur === "ciri" && periksa ? (
          <Button size="sm" disabled={sibuk} onClick={() => void jalankan([...salah])}>
            Simpan hasil periksa
          </Button>
        ) : (
          <Button size="sm" disabled={sibuk} onClick={() => void jalankan()}>
            {sibuk ? "Mengukur..." : "Jalankan ukur"}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={sibuk} onClick={onBatal}>
          Tutup
        </Button>
      </div>
    </div>
  );
}

type BarisPratinjau = {
  no: string;
  tanya: string;
  saksi: Array<{ ke: number; jawab: string; jawabTanpa: string; putusan: string; berubah: boolean }>;
};
type JawabanPratinjau = {
  jumlahSaksi: number;
  diterimaBot: boolean;
  calonDitolak: Array<{ alasan: string }>;
  berubah: number;
  identikAntarPerkara: number;
  pembandingAntarPerkara: number;
  perkara: Array<{ nomorPerkara: string; baris: BarisPratinjau[]; identikDalamBas: number; pasanganIdentik: number; pasanganTotal: number }>;
};

function PanelPratinjau({ butir, onBatal }: { butir: ButirLayar; onBatal: () => void }) {
  const [jumlahSaksi, setJumlahSaksi] = useState("2");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [hasil, setHasil] = useState<JawabanPratinjau | null>(null);

  const jalankan = async () => {
    setSibuk(true);
    setGalat("");
    try {
      const j = await kirimUkur({ tindakan: "pratinjau", id: butir.id, jumlahSaksi: Number(jumlahSaksi) });
      if (j.ok) setHasil(j.isi as unknown as JawabanPratinjau);
      else setGalat(j.pesan);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3" data-testid="panel-pratinjau">
      <p className="text-xs text-muted-foreground">
        Keluaran penyusun saksi bot seandainya usulan ini disahkan, atas templat A1a dan dua posita contoh. Panitera tetap
        memilih dan memeriksa jawaban sebelum menyimpan BAS; makna jawaban tidak boleh bergeser.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Jumlah saksi
          <NativeSelect value={jumlahSaksi} onChange={(e) => setJumlahSaksi(e.target.value)} aria-label="Jumlah saksi pratinjau">
            {["2", "3", "4"].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button size="sm" disabled={sibuk} onClick={() => void jalankan()}>
          {sibuk ? "Menyusun..." : "Susun pratinjau"}
        </Button>
        <Button size="sm" variant="outline" disabled={sibuk} onClick={onBatal}>
          Tutup
        </Button>
      </div>
      {galat && <p className="text-xs text-destructive">{galat}</p>}
      {hasil && (
        <div className="space-y-3" data-testid="hasil-pratinjau">
          {!hasil.diterimaBot && <p className="text-xs text-destructive">Bot tidak menerima pengaturan tipe keluaran; yang tampil kalimat tertanam.</p>}
          {hasil.calonDitolak.length > 0 && (
            <p className="text-xs text-destructive">Usulan ini ditolak penyaring bot: {hasil.calonDitolak.map((x) => x.alasan).join(", ")}.</p>
          )}
          <p className="text-xs">
            Jawaban yang berubah karena usulan: {hasil.berubah}. Kembar antar perkara: {hasil.identikAntarPerkara} dari {hasil.pembandingAntarPerkara}.
          </p>
          {hasil.perkara.map((p) => (
            <div key={p.nomorPerkara} className="overflow-x-auto">
              <p className="text-xs font-medium">
                {p.nomorPerkara} - pertanyaan dengan jawaban kembar dalam satu BAS: {p.identikDalamBas}; pasangan kembar {p.pasanganIdentik} dari {p.pasanganTotal}
              </p>
              <table className="w-full min-w-[640px] border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="border border-border/60 p-1 text-left">Pertanyaan</th>
                    {p.baris[0]?.saksi.map((s) => (
                      <th key={s.ke} className="border border-border/60 p-1 text-left">
                        Saksi {s.ke}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.baris.map((b) => (
                    <tr key={b.no}>
                      <td className="border border-border/60 p-1 align-top">{b.tanya}</td>
                      {b.saksi.map((s) => (
                        <td key={s.ke} className={`border border-border/60 p-1 align-top ${s.berubah ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}>
                          <span>{s.jawab}</span>
                          <span className="mt-1 block text-muted-foreground">Di putusan: {s.putusan}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SATU DAFTAR
// ============================================================================

function KartuDaftar({
  daftar,
  superAdmin,
  pemberiPerintah,
  semuaPengguna,
  namaPengguna,
  onBerubah,
}: {
  daftar: DaftarLayar;
  superAdmin: boolean;
  pemberiPerintah: UserPersona[];
  semuaPengguna: UserPersona[];
  namaPengguna: (id: string | null) => string;
  onBerubah: (pesan: string) => void;
}) {
  const [aksi, setAksi] = useState<Aksi | null>(null);
  const [formulir, setFormulir] = useState<"usul" | string | null>(null);
  const [alat, setAlat] = useState<{ id: string; jenis: "ukur" | "pratinjau" } | null>(null);
  const dapatPratinjau = (DAFTAR_DAPAT_PRATINJAU as readonly string[]).includes(daftar.daftar);

  const bawaan = daftar.butir.filter((b) => b.asal === "bawaan");
  const tambahan = daftar.butir.filter((b) => b.asal === "tambahan");
  const perintahHakim = adalahKunciDaftar(daftar.daftar) && DAFTAR_TIPE[daftar.daftar].perintahHakim;
  const calonPerintah = perintahHakim ? pemberiPerintah : semuaPengguna.filter((u) => u.isActive);

  const selesai = (pesan: string) => {
    setAksi(null);
    setFormulir(null);
    setAlat(null);
    onBerubah(pesan);
  };

  const baris = (b: ButirLayar) => {
    const k = labelKeadaan(b);
    const sah = b.keadaan === "disahkan";
    const dapatNyala = !b.yatim && ((sah && !b.aktif) || b.keadaan === "diganti");
    const ukur = daftar.butuhUkur ? ringkasHasilUkur(daftar.daftar, b.hasilUkur) : null;
    const sahTerkunci = daftar.butuhUkur && !ukur?.lulus;
    return (
      <li key={b.id} className="border-b border-border/50 py-2 last:border-0" data-testid={`butir-${b.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {b.asal === "bawaan" ? (
                <Badge variant="outline" className="gap-1" title="Bawaan tertanam di kode - tidak dapat disunting">
                  <Lock className="size-3" aria-hidden /> bawaan terkunci
                </Badge>
              ) : (
                <Badge variant="info">tambahan v{b.versi}</Badge>
              )}
              <Badge variant={k.varian}>{k.teks}</Badge>
              {b.kunci && <code className="text-xs text-muted-foreground">{b.kunci}</code>}
            </div>
            <p className="break-words text-sm">{b.nilai || <span className="italic text-muted-foreground">(kosong)</span>}</p>
            {Object.keys(b.data ?? {}).length > 0 && (
              <p className="break-all font-mono text-[11px] text-muted-foreground">{JSON.stringify(b.data)}</p>
            )}
            {b.asal === "tambahan" && (
              <p className="text-xs text-muted-foreground">
                Diusulkan {namaPengguna(b.dibuatOleh)}
                {b.disahkanOleh ? ` - disahkan ${namaPengguna(b.disahkanOleh)} atas perintah ${namaPengguna(b.atasPerintah)}` : ""}
                {b.menggantikanId ? ` - menggantikan ${b.menggantikanId}` : ""}
              </p>
            )}
            {b.digantiOleh && <p className="text-xs text-muted-foreground">Digantikan {b.digantiOleh}.</p>}
            {b.alasan && <p className="text-xs text-muted-foreground">Alasan: {b.alasan}</p>}
            {daftar.butuhUkur && b.keadaan === "usulan" && (
              <p className={`text-xs ${ukur?.lulus ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`} data-testid="hasil-ukur">
                {ukur ? ukur.teks : "Belum diukur."}
              </p>
            )}
            {b.riwayat.length > 0 && (
              <details className="text-xs">
                <summary className="flex cursor-pointer items-center gap-1 text-muted-foreground">
                  <History className="size-3" aria-hidden /> Riwayat ({b.riwayat.length})
                </summary>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {b.riwayat.map((r) => (
                    <li key={r.id}>
                      {tanggalJam(r.pada)} - {r.tindakan} oleh {namaPengguna(r.oleh)}
                      {r.alasan ? `: ${r.alasan}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {b.keadaan === "usulan" && superAdmin && (
              <Button
                size="sm"
                disabled={sahTerkunci}
                title={sahTerkunci ? "Daftar deteksi butuh hasil ukur yang lulus - jalankan Ukur lebih dulu" : undefined}
                onClick={() => setAksi({ id: b.id, tindakan: "sahkan" })}
              >
                Sahkan
              </Button>
            )}
            {b.keadaan === "usulan" && daftar.butuhUkur && (
              <Button size="sm" variant="outline" onClick={() => setAlat({ id: b.id, jenis: "ukur" })}>
                Ukur
              </Button>
            )}
            {b.keadaan === "usulan" && dapatPratinjau && (
              <Button size="sm" variant="outline" onClick={() => setAlat({ id: b.id, jenis: "pratinjau" })}>
                Pratinjau
              </Button>
            )}
            {b.keadaan === "usulan" && (
              <Button size="sm" variant="outline" onClick={() => setAksi({ id: b.id, tindakan: "tolak" })}>
                Tolak
              </Button>
            )}
            {sah && b.aktif && !b.yatim && (
              <Button size="sm" variant="outline" onClick={() => setAksi({ id: b.id, tindakan: "matikan" })}>
                Matikan
              </Button>
            )}
            {dapatNyala && (
              <Button size="sm" variant="outline" onClick={() => setAksi({ id: b.id, tindakan: "nyalakan" })}>
                Nyalakan
              </Button>
            )}
            {sah && !b.yatim && daftar.dapatDitambah && (
              <Button size="sm" variant="ghost" onClick={() => setFormulir(b.id)}>
                Ganti
              </Button>
            )}
          </div>
        </div>
        {aksi?.id === b.id && (
          <PanelAksi daftar={daftar} aksi={aksi} pemberiPerintah={calonPerintah} onSelesai={selesai} onBatal={() => setAksi(null)} />
        )}
        {alat?.id === b.id && alat.jenis === "ukur" && (
          <PanelUkur daftar={daftar} butir={b} onSelesai={selesai} onBatal={() => setAlat(null)} />
        )}
        {alat?.id === b.id && alat.jenis === "pratinjau" && <PanelPratinjau butir={b} onBatal={() => setAlat(null)} />}
        {formulir === b.id && <FormulirEntri daftar={daftar} pengganti={b} onSelesai={selesai} onBatal={() => setFormulir(null)} />}
      </li>
    );
  };

  return (
    <Card data-testid={`daftar-${daftar.daftar}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{daftar.judul}</CardTitle>
          <code className="text-xs text-muted-foreground">{daftar.daftar}</code>
          {daftar.golongan === "bersama" && <Badge variant="outline">dipakai BAS dan putusan</Badge>}
          {daftar.butuhUkur && <Badge variant="warning">butuh ukur</Badge>}
        </div>
        <CardDescription>
          {daftar.bentukNilai}
          {daftar.butuhUkur
            ? " - Daftar deteksi: usulan baru dapat disahkan sesudah lulus gerbang ukur atas data SIPP sungguhan (tombol Ukur)."
            : ""}
          {!daftar.bercermin ? " - Bawaan daftar ini belum dirangkai; tambahan belum dapat diterima." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bawaan.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Bawaan ({bawaan.length})</p>
            <ul>{bawaan.map(baris)}</ul>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground">Tambahan ({tambahan.length})</p>
          {tambahan.length ? <ul>{tambahan.map(baris)}</ul> : <p className="text-xs text-muted-foreground">Belum ada tambahan.</p>}
        </div>
        {daftar.dapatDitambah &&
          (formulir === "usul" ? (
            <FormulirEntri daftar={daftar} onSelesai={selesai} onBatal={() => setFormulir(null)} />
          ) : (
            <Button size="sm" variant="outline" onClick={() => setFormulir("usul")}>
              <Plus className="size-4" /> Usulkan tambahan
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LAYAR
// ============================================================================

export function AletaEcourtTipeKeluaran() {
  const { currentUser, users } = usePortal();
  const superAdmin = getEffectiveRoleId(currentUser) === "super-admin";
  const [tab, setTab] = useState<Tab>("bas");
  const [isi, setIsi] = useState<Partial<Record<Tab, DaftarLayar[]>>>({});
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");

  const pemberiPerintah = useMemo(() => users.filter(bolehMemerintah), [users]);
  const namaPengguna = useCallback(
    (id: string | null) => {
      if (!id) return "-";
      if (id === "benih") return "benih kode";
      return users.find((u) => u.id === id)?.name ?? id;
    },
    [users]
  );

  // Muat ulang lewat putaran, bukan dengan memanggil setState di badan efek:
  // setState hanya terjadi sesudah jawaban datang, dan jawaban yang datang
  // sesudah tab berganti dibuang (batal).
  const [putaran, setPutaran] = useState(0);
  useEffect(() => {
    let batal = false;
    ambilTab(tab).then(
      (semua) => {
        if (batal) return;
        setIsi((lama) => ({ ...lama, [tab]: semua }));
        setGalat("");
      },
      (e: unknown) => {
        if (!batal) setGalat(e instanceof Error ? e.message : String(e));
      }
    );
    return () => {
      batal = true;
    };
  }, [tab, putaran]);

  const berubah = useCallback((p: string) => {
    setPesan(p);
    setPutaran((n) => n + 1);
  }, []);

  const tampil = (t: Tab) => {
    const daftar = isi[t];
    if (!daftar) return galat ? null : <p className="text-sm text-muted-foreground">Memuat...</p>;
    return (
      <div className="space-y-4">
        {daftar.map((d) => (
          <KartuDaftar
            key={d.daftar}
            daftar={d}
            superAdmin={superAdmin}
            pemberiPerintah={pemberiPerintah}
            semuaPengguna={users}
            namaPengguna={namaPengguna}
            onBerubah={berubah}
          />
        ))}
      </div>
    );
  };

  return (
    <Card id="tipe-keluaran" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Tipe keluaran ekstensi, BAS, dan putusan</CardTitle>
        <CardDescription>
          Kalimat dan penunjuk yang dipakai ekstensi, bot, dan portal. Bawaan tertanam di kode dan terkunci; yang dapat
          dilakukan hanya mematikan, menyalakan, atau mengusulkan pengganti. Tambahan berlaku sesudah disahkan Super
          Admin atas perintah yang disebut. Tidak ada yang dihapus - setiap tindakan tercatat di riwayat dan audit.
          {superAdmin ? "" : " Pengesahan hanya dapat dilakukan Super Admin."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pesan && <p className="text-sm text-emerald-700 dark:text-emerald-400">{pesan}</p>}
        {galat && (
          <p className="text-sm text-destructive" role="alert">
            {galat}
          </p>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(v === "putusan" ? "putusan" : "bas")}>
          <TabsList>
            <TabsTrigger value="bas">Berita Acara Sidang</TabsTrigger>
            <TabsTrigger value="putusan">Putusan</TabsTrigger>
          </TabsList>
          <TabsContent value="bas">{tampil("bas")}</TabsContent>
          <TabsContent value="putusan">{tampil("putusan")}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
