import { type BuktiMasuk, type SaksiMasuk } from "@/lib/penilai-bukti";
import { jenisRekomendasi, rekomendasiPutusanDariBukti, type MasukanRekomendasiPutusan, type RekomendasiPutusan } from "@/lib/rekomendasi-putusan";
import { type AletaDatabase } from "@/server/db/client";
import { nilaiPembuktianPerkara, type DepsPenilai, type HasilPenilaianPerkara, type Sebutan } from "@/server/modules/aleta-ecourt/penilai-bukti";

/**
 * ============================================================================
 * R (2 Nov 2026, keputusan 124-125) - REKOMENDASI PUTUSAN: BAHAN DARI PANEL / ABT, PENILAIAN A2, SINGGAHAN
 * ============================================================================
 *
 * Satu pintu server untuk lib/rekomendasi-putusan.ts:
 *   - keterangan saksi & bukti: yang SEDANG tersusun di panel (bila dikirim) atau yang tersimpan di ABT (bot /abt/bahan-pembuktian, satu
 *     bacaan untuk penilai A2 dan rekomendasi); hubungan saksi (SIPP perkara_pihak5) selalu dari ABT/SIPP karena panel tidak memuatnya;
 *   - cerai gugatan (Pdt.G): penilaian pembuktian A2 dipakai bila matriks dalil ada - DIHITUNG SAJA (simpan: false), status tersimpan
 *     milik penilai tidak ditulis dari sini;
 *   - hasil disinggahkan per perkara menurut sidik bahan + kehadiran (2 menit): panel yang menggambar ulang tidak menghitung ulang.
 * TIDAK mencetak, menyimpan, atau menulis apa pun ke SIPP/ABT/e-Court.
 */

const SINGGAH_MS = 2 * 60 * 1000;

export type MasukanPanelRekomendasi = {
  jenisPerkara: string;
  jenisPerkaraId?: number | null;
  saksi?: SaksiMasuk[] | null;
  bukti?: BuktiMasuk[] | null;
  pihakBukti?: Array<"P" | "T">;
  kehadiran?: MasukanRekomendasiPutusan["kehadiran"];
  huruf?: string;
  acuan?: string;
  tanggalNikah?: string;
  formil?: MasukanRekomendasiPutusan["formil"];
};

export type HasilRekomendasiPerkara = {
  ada: boolean;
  nomorPerkara: string;
  rekomendasi: RekomendasiPutusan | null;
  /** Asal bahan: panel (sedang tersusun) | abt (tersimpan) | campuran. */
  sumberBahan: "panel" | "abt" | "campuran" | "";
  /** Penilaian pembuktian A2 ikut dipakai (cerai bermatriks dalil). */
  denganPenilaian: boolean;
  dariSinggahan: boolean;
  catatan: string[];
  ms: number;
};

const singgah = new Map<string, { kunci: string; sampai: number; nilai: HasilRekomendasiPerkara }>();
export function buangSinggahanRekomendasi() {
  singgah.clear();
}

function fnv(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** Hubungan saksi dari ABT/SIPP ditempel ke saksi panel (pihak + urutan sama); panel tidak memuat perkara_pihak5. */
export function tempelHubungan(panel: SaksiMasuk[], abt: SaksiMasuk[]): SaksiMasuk[] {
  const peta = new Map(abt.map((s) => [`${s.pihak}|${s.ke}`, s.hubungan || ""]));
  return panel.map((s) => (s.hubungan ? s : { ...s, hubungan: peta.get(`${s.pihak}|${s.ke}`) || "" }));
}

export async function rekomendasiPutusanPerkara(
  db: AletaDatabase,
  nomor: string,
  sebutan: Sebutan,
  m: MasukanPanelRekomendasi,
  deps: DepsPenilai,
  opsi: { kini?: Date } = {}
): Promise<HasilRekomendasiPerkara> {
  const mulai = Date.now();
  const jenis = jenisRekomendasi(m.jenisPerkara, nomor, m.jenisPerkaraId);
  if (!jenis) return { ada: false, nomorPerkara: nomor, rekomendasi: null, sumberBahan: "", denganPenilaian: false, dariSinggahan: false, catatan: ["Rekomendasi putusan baru tersedia untuk cerai, itsbat nikah, dan dispensasi kawin."], ms: 0 };
  const kunci = fnv(JSON.stringify([m.saksi || null, m.bukti || null, m.pihakBukti || null, m.kehadiran || null, m.huruf || "", m.acuan || "", m.tanggalNikah || "", m.formil || null, sebutan]));
  const s = singgah.get(nomor);
  if (s && s.kunci === kunci && s.sampai > Date.now()) return { ...s.nilai, dariSinggahan: true };

  const saksiPanel = m.saksi && m.saksi.length ? m.saksi : null;
  const pihakBukti = new Set(m.pihakBukti && m.pihakBukti.length ? m.pihakBukti : m.bukti ? ["P", "T"] : []);
  // ABT selalu dibaca sekali (hubungan saksi; bukti pihak yang belum dimuat panel).
  const abt = await deps.bahanAbt(nomor).catch(() => ({ ok: false, saksi: [] as SaksiMasuk[], bukti: [] as BuktiMasuk[] }));
  const saksi = saksiPanel ? tempelHubungan(saksiPanel, abt.saksi) : abt.saksi;
  const bukti = [...(m.bukti || []).filter((b) => !b.pihak || pihakBukti.has(b.pihak)), ...abt.bukti.filter((b) => !pihakBukti.has(b.pihak as "P" | "T"))];
  const sumberBahan: HasilRekomendasiPerkara["sumberBahan"] = saksiPanel && pihakBukti.size >= 2 ? "panel" : saksiPanel || pihakBukti.size ? "campuran" : "abt";

  let penilaian: HasilPenilaianPerkara | null = null;
  if ((jenis === "cerai-gugat" || jenis === "cerai-talak") && /\/pdt\.g\//i.test(nomor)) {
    penilaian = await nilaiPembuktianPerkara(db, nomor, sebutan, deps, { saksi, bukti, pihakBukti: ["P", "T"] }, { kini: opsi.kini, simpan: false }).catch(() => null);
  }
  const rekomendasi = rekomendasiPutusanDariBukti({
    jenisPerkara: m.jenisPerkara,
    nomorPerkara: nomor,
    jenisPerkaraId: m.jenisPerkaraId ?? null,
    sebutan: { P: sebutan.lawan, T: sebutan.pelaku },
    saksi,
    bukti,
    penilaian: penilaian && penilaian.ada && penilaian.hasil ? penilaian.hasil : null,
    kehadiran: m.kehadiran || null,
    huruf: m.huruf || "",
    acuan: m.acuan || (opsi.kini || new Date()).toISOString().slice(0, 10),
    tanggalNikah: m.tanggalNikah || "",
    formil: m.formil || null,
  });
  const catatan: string[] = [];
  if (!abt.ok && !saksiPanel) catatan.push("Keterangan saksi tersimpan belum terbaca dari ABT.");
  const nilai: HasilRekomendasiPerkara = {
    ada: Boolean(rekomendasi),
    nomorPerkara: nomor,
    rekomendasi,
    sumberBahan,
    denganPenilaian: Boolean(penilaian && penilaian.ada),
    dariSinggahan: false,
    catatan,
    ms: Date.now() - mulai,
  };
  singgah.set(nomor, { kunci, sampai: Date.now() + SINGGAH_MS, nilai });
  if (singgah.size > 300) for (const [k, v] of singgah) if (v.sampai <= Date.now()) singgah.delete(k);
  return nilai;
}
