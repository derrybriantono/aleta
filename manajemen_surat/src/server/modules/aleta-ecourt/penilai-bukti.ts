import { type PembuktianDalil } from "@/lib/matriks-dalil";
import { nilaiPembuktian, ubahanPembuktian, type BuktiMasuk, type HasilPenilaian, type SaksiMasuk, type StatusPembuktian } from "@/lib/penilai-bukti";
import { type AletaDatabase } from "@/server/db/client";
import { postGatewayBahanPembuktian } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { aturPembuktian, type HasilMatriksDalil } from "@/server/modules/aleta-ecourt/matriks-dalil";

/**
 * ============================================================================
 * A2 (1 Nov 2026) - PENILAI PEMBUKTIAN: HITUNG, SIMPAN KE MATRIKS, API UNTUK A1
 * ============================================================================
 *
 * Satu-satunya pintu penilai aturan (lib/penilai-bukti.ts) di server:
 *   - bahan saksi/bukti dari PANEL (yang sedang tersusun, belum tentu tersimpan di ABT) atau, bila panel tidak mengirim, dari ABT
 *     lewat bot (/abt/bahan-pembuktian: sidang terakhir per saksi + isian 1214/9911/1262);
 *   - status per dalil disimpan ke kolom `pembuktian` matriks dalil (aturPembuktian, P2) supaya A1 (draf putusan) dan panel memakai
 *     hasil yang sama; status yang DITETAPKAN petugas/hakim (oleh selain "aturan") tidak pernah ditimpa;
 *   - hitungan disinggahkan per perkara menurut (sidik matriks + sidik bahan): bahan sama = tanpa hitung & tanpa tulis ulang.
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court.
 */

const SINGGAH_MS = 2 * 60 * 1000;
const BATAS_SAKSI = 20;
const BATAS_BARIS = 80;
const BATAS_BUKTI = 80;
const STATUS_SAH: readonly StatusPembuktian[] = ["terbukti", "belum-terbukti", "bertentangan", "tidak-perlu-dibuktikan"];

export type Sebutan = { lawan: string; pelaku: string };

export type DepsPenilai = {
  /** Matriks dalil perkara (pastikanMatriksDalil - dari simpanan bila berkas tidak berubah). */
  matriks: (nomor: string, sebutan: Sebutan) => Promise<HasilMatriksDalil>;
  /** Bahan tersimpan di ABT (bot). */
  bahanAbt: (nomor: string) => Promise<{ ok: boolean; saksi: SaksiMasuk[]; bukti: BuktiMasuk[] }>;
};

export type BarisTampil = HasilPenilaian["baris"][number] & {
  /** Status yang ditetapkan petugas/hakim (menang atas aturan saat ditampilkan & dipakai A1), bila ada. */
  ditetapkan: PembuktianDalil | null;
};

export type HasilPenilaianPerkara = {
  ada: boolean;
  nomorPerkara: string;
  /** Asal bahan saksi/bukti: panel (sedang tersusun) | abt (tersimpan) | campuran. */
  sumberBahan: "panel" | "abt" | "campuran" | "";
  hasil: (Omit<HasilPenilaian, "baris"> & { baris: BarisTampil[] }) | null;
  dihitungPada: string;
  /** Jumlah status yang berubah dan disimpan ke matriks pada panggilan ini. */
  disimpan: number;
  dariSinggahan: boolean;
  basi: boolean;
  catatan: string[];
};

const singgah = new Map<string, { kunci: string; sampai: number; nilai: HasilPenilaianPerkara }>();
export function buangSinggahanPenilai() {
  singgah.clear();
}

const teks = (v: unknown, n: number) => String(v == null ? "" : v).slice(0, n);
const pihakSah = (v: unknown): "P" | "T" | "" => (v === "P" || v === "T" ? v : "");

/** Bahan dari panel/bot dibatasi & dibersihkan (masukan dari luar). null = tidak dikirim. */
export function bersihSaksi(x: unknown): SaksiMasuk[] | null {
  if (!Array.isArray(x)) return null;
  return x.slice(0, BATAS_SAKSI).map((s, i) => {
    const o = (s || {}) as Record<string, unknown>;
    const baris = Array.isArray(o.baris) ? o.baris : [];
    return {
      id: teks(o.id || `s${i + 1}`, 40),
      pihak: pihakSah(o.pihak),
      ke: Number(o.ke) || 0,
      hubungan: teks(o.hubungan, 120),
      baris: baris.slice(0, BATAS_BARIS).map((r) => ({ tanya: teks((r as Record<string, unknown>)?.tanya, 600), jawab: teks((r as Record<string, unknown>)?.jawab, 2000) })),
    };
  });
}
export function bersihBukti(x: unknown): BuktiMasuk[] | null {
  if (!Array.isArray(x)) return null;
  return x.slice(0, BATAS_BUKTI).map((b) => {
    const o = (b || {}) as Record<string, unknown>;
    return { kode: teks(o.kode, 12), pihak: pihakSah(o.pihak), jenis: o.jenis === "elektronik" ? "elektronik" : "surat", teks: teks(o.teks, 1200) };
  });
}

export function depsPenilai(matriks: DepsPenilai["matriks"]): DepsPenilai {
  return {
    matriks,
    bahanAbt: async (nomor) => {
      const r = await postGatewayBahanPembuktian({ nomorPerkara: nomor });
      if (!r.ok || !r.data || r.data.ok === false) return { ok: false, saksi: [], bukti: [] };
      return { ok: true, saksi: bersihSaksi(r.data.saksi) || [], bukti: bersihBukti(r.data.bukti) || [] };
    },
  };
}

/**
 * Penilaian pembuktian satu perkara + simpan status ke matriks.
 * @param bahan saksi/bukti dari panel; yang tidak dikirim (null/undefined) dibaca dari ABT. Bukti per pihak: pihak yang tidak ada
 *              di kiriman panel diambil dari ABT (panel baru memuat daftar bukti pihak yang dibuka).
 */
export async function nilaiPembuktianPerkara(
  db: AletaDatabase,
  nomor: string,
  sebutan: Sebutan,
  deps: DepsPenilai,
  bahan: { saksi?: SaksiMasuk[] | null; bukti?: BuktiMasuk[] | null; pihakBukti?: Array<"P" | "T"> } = {},
  opsi: { kini?: Date; simpan?: boolean } = {}
): Promise<HasilPenilaianPerkara> {
  const kini = opsi.kini || new Date();
  const m = await deps.matriks(nomor, sebutan);
  if (!m.ada || !m.matriks) {
    return { ada: false, nomorPerkara: nomor, sumberBahan: "", hasil: null, dihitungPada: "", disimpan: 0, dariSinggahan: false, basi: m.basi, catatan: m.catatan.length ? m.catatan : ["Dalil para pihak belum terbaca."] };
  }
  const saksiPanel = bahan.saksi && bahan.saksi.length ? bahan.saksi : null;
  const pihakBukti = new Set(bahan.pihakBukti && bahan.pihakBukti.length ? bahan.pihakBukti : bahan.bukti ? ["P", "T"] : []);
  const perluAbt = !saksiPanel || pihakBukti.size < 2;
  const abt = perluAbt ? await deps.bahanAbt(nomor).catch(() => ({ ok: false, saksi: [] as SaksiMasuk[], bukti: [] as BuktiMasuk[] })) : null;
  const saksi = saksiPanel || (abt ? abt.saksi : []);
  const bukti = [...(bahan.bukti || []).filter((b) => !b.pihak || pihakBukti.has(b.pihak)), ...(abt ? abt.bukti.filter((b) => !pihakBukti.has(b.pihak as "P" | "T")) : [])];
  const sumberBahan: HasilPenilaianPerkara["sumberBahan"] = !perluAbt ? "panel" : saksiPanel || pihakBukti.size ? "campuran" : "abt";

  const sb = { P: sebutan.lawan || "Penggugat", T: sebutan.pelaku || "Tergugat" };
  const hasil = nilaiPembuktian(m.matriks, saksi, bukti, { sebutan: sb });
  const kunci = `${m.dihitungPada}|${hasil.sidik}|${m.matriks.dalil.length}`;
  const s = singgah.get(nomor);
  if (s && s.kunci === kunci && s.sampai > Date.now()) return { ...s.nilai, dariSinggahan: true, disimpan: 0 };

  // Status tersimpan (aturan & tetapan petugas) dari matriks yang sudah digabung (gabungPembuktian).
  const tersimpan: Record<string, PembuktianDalil> = {};
  for (const d of m.matriks.dalil) if (d.pembuktian) tersimpan[d.id] = d.pembuktian;
  const ubah = ubahanPembuktian(hasil, tersimpan, kini);
  let disimpan = 0;
  if (opsi.simpan !== false && Object.keys(ubah).length) {
    const ok = await aturPembuktian(db, nomor, ubah).catch(() => false);
    if (ok) disimpan = Object.keys(ubah).length;
  }
  const baris: BarisTampil[] = hasil.baris.map((r) => {
    const t = tersimpan[r.id];
    return { ...r, ditetapkan: t && t.oleh && t.oleh !== "aturan" && STATUS_SAH.includes(t.status as StatusPembuktian) ? t : null };
  });
  const nilai: HasilPenilaianPerkara = {
    ada: true,
    nomorPerkara: nomor,
    sumberBahan,
    hasil: { ...hasil, baris },
    dihitungPada: kini.toISOString(),
    disimpan,
    dariSinggahan: false,
    basi: m.basi,
    catatan: abt && !abt.ok && !saksiPanel ? ["Keterangan saksi tersimpan belum terbaca dari ABT."] : [],
  };
  singgah.set(nomor, { kunci, sampai: Date.now() + SINGGAH_MS, nilai });
  if (singgah.size > 300) for (const [k, v] of singgah) if (v.sampai <= Date.now()) singgah.delete(k);
  return nilai;
}

/**
 * Petugas/hakim menetapkan (atau menghapus = kembali ke aturan) status satu dalil. Disimpan dengan `oleh` = id akun, sehingga
 * hitungan aturan berikutnya tidak menimpanya.
 */
export async function tetapkanPembuktian(db: AletaDatabase, nomor: string, id: string, status: StatusPembuktian | null, oleh: string, catatan = "", kini = new Date()) {
  if (status !== null && !STATUS_SAH.includes(status)) return false;
  singgah.delete(nomor);
  return aturPembuktian(db, nomor, { [id]: status ? { status, catatan: teks(catatan, 500), oleh: teks(oleh || "petugas", 60), pada: kini.toISOString() } : null });
}

/**
 * API agen A1 (draf putusan otomatis, sisi server): penilaian terbaru satu perkara dari bahan ABT, status tersimpan ikut diperbarui.
 * Status tetapan petugas menang: `statusAkhir(baris)`.
 */
export function penilaianUntukA1(db: AletaDatabase, nomor: string, sebutan: Sebutan, deps: DepsPenilai) {
  return nilaiPembuktianPerkara(db, nomor, sebutan, deps, {});
}

/** Status yang berlaku untuk satu baris: tetapan petugas bila ada, selain itu hasil aturan. */
export function statusAkhir(b: BarisTampil): StatusPembuktian {
  return (b.ditetapkan && (b.ditetapkan.status as StatusPembuktian)) || b.status;
}
