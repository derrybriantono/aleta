import { bacaSatuDokumen, peranDokumen, penuntutDari, rencanaBaca, type DepsIsiGugatan } from "@/server/modules/aleta-ecourt/isi-gugatan";
import type { DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";

/**
 * ============================================================================
 * KONTAK-EC (11 Okt 2026, agen 5) - EMAIL & HP/WA PIHAK DAN KUASA DARI e-COURT
 * ============================================================================
 *
 *   GET /aleta-ecourt/kontak-pihak?nomor=...[&nama=...][&teks=1]
 *     -> { ada, perkaraId, nomorPerkara, orang[], domisili{1,2}, tanpaPemilik[], dokumen[], catatan[] }
 *
 * Dipakai panel SIPP (blangko Data Pihak / Pengacara): bot membaca isian SIPP,
 * akun e-Court (persetujuan pihak, surel pengunggah) dan - bila teks=1 - teks
 * surat gugatan, surat kuasa, dan jawab-menjawab yang dibaca di sini dari
 * arsip e-Court ALETA (tanpa OCR: blangko SIPP harus cepat). Tidak menulis
 * SIPP; petugas yang mengisi dan menekan Simpan.
 */

const POLA_KUASA = /surat\s+kuasa|kuasa\s+khusus/i;
const BATAS_TOTAL = 300_000;

export type DepsKontakEcourt = Pick<DepsIsiGugatan, "rincian" | "ambilBerkas" | "halamanPdf" | "bacaTeks"> & {
  kirimBot: (muatan: {
    nomorPerkara?: string;
    nama?: string;
    dokumen: Array<{ judul: string; peran: string; teks: string; penuntutKode: string }>;
  }) => Promise<Record<string, unknown> | null>;
};

export type HasilKontakEcourt = {
  ada: boolean;
  perkaraId?: number;
  nomorPerkara?: string;
  orang: unknown[];
  domisili: Record<string, unknown>;
  tanpaPemilik: unknown[];
  dokumen: Array<{ judul: string; peran: string; terbaca: boolean }>;
  catatan: string[];
};

/** Dokumen yang dibaca untuk kontak: satu surat gugatan, surat kuasa, lalu jawab-menjawab. */
export function rencanaBacaKontak(dokumen: DokumenArsip[]): DokumenArsip[] {
  const r = rencanaBaca(dokumen, 3);
  const kuasa = dokumen.filter((d) => POLA_KUASA.test(d.judulDokumen || "") && (d.adaPdf || d.adaWord)).slice(0, 2);
  const urut = [...r.gugatan.slice(0, 1), ...kuasa, ...r.jawab];
  return urut.filter((d, i) => urut.findIndex((x) => x.documentKey === d.documentKey) === i);
}

export async function bacaKontakEcourt(
  masukan: { nomor?: string; nama?: string; teks?: boolean },
  deps: DepsKontakEcourt
): Promise<HasilKontakEcourt> {
  const catatan: string[] = [];
  const nomor = String(masukan.nomor || "").trim();
  const nama = String(masukan.nama || "").trim();
  const dibaca: HasilKontakEcourt["dokumen"] = [];
  const dokumen: Array<{ judul: string; peran: string; teks: string; penuntutKode: string }> = [];
  if (nomor && masukan.teks) {
    const rincian = await deps.rincian(nomor).catch(() => ({ ok: false, dokumen: [] as DokumenArsip[] }));
    if (!rincian.ok) catatan.push("Arsip e-Court perkara ini tidak terbaca dari ALETA Bot - kontak dari SIPP dan akun e-Court saja.");
    let sisa = BATAS_TOTAL;
    for (const d of rencanaBacaKontak(rincian.dokumen || [])) {
      if (sisa <= 0) break;
      const h = await bacaSatuDokumen(d, deps, false);
      const peran = POLA_KUASA.test(d.judulDokumen || "") ? "kuasa" : peranDokumen(d);
      dibaca.push({ judul: d.judulDokumen, peran, terbaca: Boolean(h.teks) });
      if (!h.teks) continue;
      const teks = h.teks.slice(0, sisa);
      sisa -= teks.length;
      dokumen.push({ judul: d.judulDokumen, peran, teks, penuntutKode: penuntutDari(d) });
    }
  }
  if (!nomor && !nama) return { ada: false, orang: [], domisili: {}, tanpaPemilik: [], dokumen: [], catatan: ["Nomor perkara dan nama kosong."] };
  const jawaban = await deps.kirimBot({ nomorPerkara: nomor || undefined, nama: nama || undefined, dokumen }).catch(() => null);
  if (!jawaban || jawaban.ok === false) {
    return { ada: false, orang: [], domisili: {}, tanpaPemilik: [], dokumen: dibaca, catatan: [...catatan, "ALETA Bot belum mengenal kontak e-Court (rute /abt/kontak-ecourt) - bangun ulang bot."] };
  }
  const larik = (k: string) => (Array.isArray(jawaban[k]) ? (jawaban[k] as unknown[]) : []);
  if (!jawaban.ada) {
    const sebab = String(jawaban.sebab || "");
    catatan.push(
      sebab === "tidak_ada_perkara_ecourt"
        ? "Nama ini tidak ditemukan pada perkara e-Court mana pun."
        : sebab === "nama_kosong"
          ? "Nama pihak belum terisi di blangko."
          : "Perkara tidak ditemukan di SIPP."
    );
  }
  return {
    ada: Boolean(jawaban.ada),
    perkaraId: typeof jawaban.perkaraId === "number" ? jawaban.perkaraId : undefined,
    nomorPerkara: typeof jawaban.nomorPerkara === "string" ? jawaban.nomorPerkara : undefined,
    orang: larik("orang"),
    domisili: jawaban.domisili && typeof jawaban.domisili === "object" ? (jawaban.domisili as Record<string, unknown>) : {},
    tanpaPemilik: larik("tanpaPemilik"),
    dokumen: dibaca,
    catatan,
  };
}
