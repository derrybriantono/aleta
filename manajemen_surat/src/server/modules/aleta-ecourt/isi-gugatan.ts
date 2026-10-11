import { pilihDokumenGugatan, type DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";

/**
 * ============================================================================
 * B2 (10 Okt 2026, agen 3) - ISI DARI e-COURT KE ABT
 * ============================================================================
 *
 *   GET /aleta-ecourt/isi-gugatan?nomor=...&lawan=Pemohon&pelaku=Termohon
 *     -> { ada, tuntutan[], anak[], jawab[], usulan[], kalimat[], diabaikan[], dokumen[], catatan[] }
 *
 * Surat gugatan dan jawaban/replik/duplik/kesimpulan yang diunggah ke e-Court
 * sudah diarsipkan ALETA Bot (aleta_bot_ecourt_files - BUKAN kolom cermin
 * berkas_pdf/word yang basi). Modul ini memilih dokumennya, membaca teksnya
 * (PDF per HALAMAN supaya kutipan dapat menyebut "hal. n"; Word; OCR paling
 * banyak sekali per permintaan - pembaca yang sama dengan kuasa-gugatan dan
 * penanda jawaban), lalu menyerahkan teksnya ke bot (POST /abt/isi-gugatan)
 * yang menimbangnya dengan kamus deteksi (tuntutan.json, gugatan.json,
 * kalimat-hakim.json).
 *
 * Hanya membaca - penulis ABT tetap panel ekstensi sesudah petugas mencentang.
 */

export type PeranDokumen = "gugatan" | "jawaban" | "replik" | "duplik" | "kesimpulan";

export type DokumenTerbaca = {
  judul: string;
  peran: PeranDokumen;
  teks: string;
  baca: "teks" | "ocr";
  penuntutKode: "0046" | "0047" | "";
  halaman: number;
};

const POLA_JAWAB = /jawab|replik|duplik|kesimpulan|rekon[pv]ensi|eksepsi/i;

/** Jawaban/replik/duplik/kesimpulan (jenis dokumen e-Court atau judulnya), urut unggah. */
export function pilihDokumenJawab(dokumen: DokumenArsip[]): DokumenArsip[] {
  return dokumen
    .filter((d) => POLA_JAWAB.test(`${d.jenisDokumen || ""} ${d.judulDokumen || ""}`))
    .filter((d) => d.adaPdf || d.adaWord)
    .sort((a, b) => String(a.diunggahPada || "").localeCompare(String(b.diunggahPada || "")));
}

export function peranDokumen(d: DokumenArsip): PeranDokumen {
  const s = `${d.jenisDokumen || ""} ${d.judulDokumen || ""}`.toLowerCase();
  if (/kesimpulan/.test(s)) return "kesimpulan";
  if (/duplik/.test(s)) return "duplik";
  if (/replik/.test(s) && !/jawab/.test(s)) return "replik";
  if (POLA_JAWAB.test(s)) return "jawaban";
  return "gugatan";
}

/** Pengunggah -> pihak yang menuntut: Penggugat/Pemohon = 0046, Tergugat/Termohon = 0047. */
export function penuntutDari(d: DokumenArsip): "0046" | "0047" | "" {
  const p = String(d.peranPengunggah || "").toLowerCase();
  if (/tergugat|termohon/.test(p)) return "0047";
  if (/penggugat|pemohon/.test(p)) return "0046";
  return "";
}

/** Dokumen yang dibaca: satu surat gugatan (calon cadangan bila tak terbaca) + jawab-menjawab. */
export function rencanaBaca(dokumen: DokumenArsip[], batasJawab = 4) {
  // Perbaikan gugatan menggantikan gugatan asal - dibaca lebih dulu bila ada.
  const perbaikan = dokumen.filter((d) => /perbaikan\s+gugatan|perubahan\s+gugatan/i.test(d.judulDokumen || "") && (d.adaPdf || d.adaWord));
  const gugatan = [...perbaikan, ...pilihDokumenGugatan(dokumen)].slice(0, 3);
  return { gugatan, jawab: pilihDokumenJawab(dokumen).slice(0, batasJawab) };
}

export type DepsIsiGugatan = {
  rincian: (nomor: string) => Promise<{ ok: boolean; dokumen: DokumenArsip[] }>;
  ambilBerkas: (documentKey: string, format: "pdf" | "word") => Promise<Buffer | null>;
  /** PDF -> teks per halaman (lapisan teks saja); [] bila tidak terbaca. */
  halamanPdf: (data: Buffer) => Promise<string[]>;
  /** Berkas -> teks: lapisan teks, OCR bila diizinkan dan kosong. */
  bacaTeks: (data: Buffer, bolehOcr: boolean) => Promise<{ teks: string; sumber: "teks" | "ocr" | ""; sebab: string }>;
  kirimBot: (muatan: {
    nomorPerkara: string;
    sebutan: { lawan: string; pelaku: string };
    majelis?: string;
    dokumen: Array<Omit<DokumenTerbaca, "halaman">>;
  }) => Promise<Record<string, unknown> | null>;
};

const BATAS_PER_DOKUMEN = 120_000;
const BATAS_TOTAL = 300_000;

function terbaca(teks: string) {
  return (teks.match(/[A-Za-z]/g) || []).length >= 200;
}

/** Satu dokumen -> teks. PDF berlapis teks dipisah halaman dengan "\f". */
export async function bacaSatuDokumen(
  d: DokumenArsip,
  deps: Pick<DepsIsiGugatan, "ambilBerkas" | "halamanPdf" | "bacaTeks">,
  bolehOcr: boolean
): Promise<{ teks: string; baca: "teks" | "ocr"; halaman: number; sebab: string }> {
  if (d.adaPdf) {
    const pdf = await deps.ambilBerkas(d.documentKey, "pdf").catch(() => null);
    if (pdf) {
      const halaman = await deps.halamanPdf(pdf).catch(() => [] as string[]);
      const gabung = halaman.join("\f");
      if (terbaca(gabung)) return { teks: gabung.slice(0, BATAS_PER_DOKUMEN), baca: "teks", halaman: halaman.length, sebab: "" };
      if (!d.adaWord) {
        const t = await deps.bacaTeks(pdf, bolehOcr);
        if (t.teks && terbaca(t.teks)) return { teks: t.teks.slice(0, BATAS_PER_DOKUMEN), baca: t.sumber === "ocr" ? "ocr" : "teks", halaman: 0, sebab: "" };
        return { teks: "", baca: "teks", halaman: 0, sebab: t.sebab || "teks_kosong" };
      }
    }
  }
  if (d.adaWord) {
    const word = await deps.ambilBerkas(d.documentKey, "word").catch(() => null);
    if (!word) return { teks: "", baca: "teks", halaman: 0, sebab: "berkas_tidak_terambil" };
    const t = await deps.bacaTeks(word, bolehOcr);
    if (t.teks && terbaca(t.teks)) return { teks: t.teks.slice(0, BATAS_PER_DOKUMEN), baca: t.sumber === "ocr" ? "ocr" : "teks", halaman: 0, sebab: "" };
    return { teks: "", baca: "teks", halaman: 0, sebab: t.sebab || "teks_kosong" };
  }
  return { teks: "", baca: "teks", halaman: 0, sebab: "berkas_tidak_terambil" };
}

export type HasilIsiGugatan = {
  ada: boolean;
  tuntutan: unknown[];
  anak: unknown[];
  jawab: unknown[];
  usulan: unknown[];
  kalimat: unknown[];
  diabaikan: unknown[];
  dokumen: Array<{ judul: string; peran: PeranDokumen; baca: "teks" | "ocr"; halaman: number; terbaca: boolean; sebab: string }>;
  catatan: string[];
  /** KONTAK-EC 11 Okt: email/HP pihak & kuasa dari e-Court (bot kontakEcourtService) - null bila bot lama. */
  kontak?: Record<string, unknown> | null;
};

/** Baca berkas e-Court perkara -> usulan bot. OCR paling banyak sekali. */
export async function bacaIsiGugatan(
  nomor: string,
  sebutan: { lawan: string; pelaku: string },
  deps: DepsIsiGugatan,
  majelis?: string
): Promise<HasilIsiGugatan> {
  const catatan: string[] = [];
  const kosong = (c: string[]): HasilIsiGugatan => ({ ada: false, tuntutan: [], anak: [], jawab: [], usulan: [], kalimat: [], diabaikan: [], dokumen: [], catatan: c });
  const rincian = await deps.rincian(nomor).catch(() => ({ ok: false, dokumen: [] as DokumenArsip[] }));
  if (!rincian.ok) return kosong(["Arsip e-Court perkara ini tidak terbaca dari ALETA Bot."]);
  const rencana = rencanaBaca(rincian.dokumen || []);
  if (!rencana.gugatan.length && !rencana.jawab.length) return kosong(["Surat gugatan dan jawaban belum ada di arsip e-Court ALETA (perkara bukan e-Court, atau berkas belum ditarik)."]);

  let ocrDipakai = false;
  let sisa = BATAS_TOTAL;
  const terbacaDok: DokumenTerbaca[] = [];
  const daftar: HasilIsiGugatan["dokumen"] = [];
  // Gugatan: berhenti pada yang pertama terbaca.
  for (const d of rencana.gugatan) {
    const h = await bacaSatuDokumen(d, deps, !ocrDipakai);
    if (h.baca === "ocr") ocrDipakai = true;
    daftar.push({ judul: d.judulDokumen, peran: "gugatan", baca: h.baca, halaman: h.halaman, terbaca: Boolean(h.teks), sebab: h.sebab });
    if (h.teks) {
      const teks = h.teks.slice(0, sisa);
      sisa -= teks.length;
      terbacaDok.push({ judul: d.judulDokumen, peran: "gugatan", teks, baca: h.baca, penuntutKode: penuntutDari(d) || "0046", halaman: h.halaman });
      break;
    }
  }
  for (const d of rencana.jawab) {
    if (sisa <= 0) break;
    const h = await bacaSatuDokumen(d, deps, !ocrDipakai);
    if (h.baca === "ocr") ocrDipakai = true;
    const peran = peranDokumen(d);
    daftar.push({ judul: d.judulDokumen, peran, baca: h.baca, halaman: h.halaman, terbaca: Boolean(h.teks), sebab: h.sebab });
    if (!h.teks) continue;
    const teks = h.teks.slice(0, sisa);
    sisa -= teks.length;
    terbacaDok.push({ judul: d.judulDokumen, peran, teks, baca: h.baca, penuntutKode: penuntutDari(d), halaman: h.halaman });
  }
  for (const d of daftar) if (!d.terbaca) catatan.push(`${d.judul}: teks tidak terbaca (${d.sebab || "kosong"}).`);
  if (!terbacaDok.length) return { ...kosong(catatan), dokumen: daftar };

  const jawaban = await deps
    .kirimBot({
      nomorPerkara: nomor,
      sebutan,
      majelis,
      dokumen: terbacaDok.map(({ halaman: _h, ...x }) => x),
    })
    .catch(() => null);
  if (!jawaban || jawaban.ok === false) {
    return { ...kosong([...catatan, "ALETA Bot belum mengenal pembacaan isi gugatan (rute /abt/isi-gugatan) - bangun ulang bot."]), dokumen: daftar };
  }
  const larik = (k: string) => (Array.isArray(jawaban[k]) ? (jawaban[k] as unknown[]) : []);
  return {
    ada: Boolean(jawaban.ada),
    tuntutan: larik("tuntutan"),
    anak: larik("anak"),
    jawab: larik("jawab"),
    usulan: larik("usulan"),
    kalimat: larik("kalimat"),
    diabaikan: larik("diabaikan"),
    dokumen: daftar,
    catatan: [...catatan, ...larik("catatan").map(String)],
    // KONTAK-EC 11 Okt
    kontak: jawaban.kontak && typeof jawaban.kontak === "object" ? (jawaban.kontak as Record<string, unknown>) : null,
  };
}

/** Sebutan dari query: hanya kata sebutan pihak yang dikenal. */
export function sebutanAman(nilai: string | null, cadangan: string): string {
  const s = String(nilai || "").trim();
  return /^(?:Penggugat|Tergugat|Pemohon|Termohon|Pemohon I|Pemohon II|Para Pemohon)$/i.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : cadangan;
}
