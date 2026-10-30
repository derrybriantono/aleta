/**
 * ============================================================================
 * PUTUSAN DI SIPP vs DOKUMEN PUTUSAN YANG DIUNGGAH (G4 4.3, 30 Okt 2026)
 * ============================================================================
 *
 * Sesudah putus, amar dan tanggal putusan yang DIKETIK di SIPP (perkara_putusan
 * .amar_putusan / .tanggal_putusan) dicocokkan dengan dokumen putusan yang
 * diunggah ke e-Doc (amar_putusan_dok, PDF/RTF). Hanya membaca; beda = peringatan
 * pasif di panel dan Pusat Kesehatan.
 *
 * MURNI. Aturannya sengaja hemat peringatan palsu - yang diperingatkan hanya:
 *   1. TANGGAL: tanggal pertama sesudah "Demikian diputuskan/putusan ..." di
 *      dokumen berbeda dengan tanggal putusan SIPP;
 *   2. NOMINAL: angka rupiah di amar SIPP dan amar dokumen tidak sama (biaya
 *      perkara, nafkah, mut'ah - salah ketik nominal adalah kekeliruan amar yang
 *      paling mahal);
 *   3. ISI AMAR: kata-kata amar SIPP yang tidak ada di amar dokumen (atau
 *      sebaliknya) melewati batas - beda ejaan kecil ("shughra"/"sughra"),
 *      penomoran, huruf besar, tanda baca, dan judul "MENGADILI" tidak dihitung.
 * Dokumen tanpa bagian MENGADILI yang terbaca (pindaian, format lain) =
 * "tidak-terbaca", BUKAN beda.
 */

export type KeadaanCocok = "cocok" | "beda" | "tidak-terbaca" | "tanpa-dokumen" | "belum-putus";

export type BedaPutusan = { bagian: "tanggal" | "nominal" | "amar"; label: string; ringkas: string; sipp: string; dokumen: string };

export type HasilCocok = {
  keadaan: KeadaanCocok;
  beda: BedaPutusan[];
  /** Bagian kata amar SIPP yang ditemukan di amar dokumen (0..1); -1 bila tidak dihitung. */
  liputan: number;
  catatan: string;
};

const BULAN: Record<string, number> = {
  januari: 1, februari: 2, pebruari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8,
  september: 9, oktober: 10, nopember: 11, november: 11, desember: 12,
};
const NAMA_BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Batas: bagian kata amar yang boleh tidak ditemukan sebelum disebut beda. Diukur atas 7 putusan sungguhan 30 Okt (lihat uji). */
export const BATAS_LIPUTAN = 0.85;

const ENTITAS: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** HTML amar SIPP (CKEditor) -> teks polos. */
export function htmlKeTeksAmar(html: string): string {
  return String(html ?? "")
    .replace(/<\s*(br|\/p|\/li|\/div|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, k: string) => {
      const kk = k.toLowerCase();
      if (ENTITAS[kk] !== undefined) return ENTITAS[kk];
      if (kk.startsWith("#x")) return String.fromCharCode(parseInt(kk.slice(2), 16));
      if (kk.startsWith("#")) return String.fromCharCode(Number(kk.slice(1)));
      return m;
    })
    .replace(/�/g, " ");
}

/** Lipat ejaan yang lazim berbeda tanpa beda makna. */
function lipat(kata: string): string {
  return kata
    .replace(/^shu/, "su")
    .replace(/sh/g, "s")
    .replace(/dh/g, "d")
    .replace(/(.)\1+/g, "$1");
}

/** Kata-kata amar: huruf kecil, tanpa nomor butir, tanpa "mengadili", hanya kata >= 3 huruf atau angka. */
export function kataAmar(teks: string): string[] {
  const polos = String(teks ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/m\s*e\s*n\s*g\s*a\s*d\s*i\s*l\s*i/g, " ")
    .replace(/[’‘`´']/g, "")
    .replace(/rp\s*([\d.]+)(,\d+)?/g, " rp$1 ")
    .replace(/[^a-z0-9]+/g, " ");
  return polos
    .split(" ")
    .filter((k) => k && (k.length >= 3 || /^\d+$/.test(k)) && !/^\d{1,2}$/.test(k))
    .map(lipat);
}

/** Angka rupiah: "Rp258.500,00" -> 258500. */
export function nominalRupiah(teks: string): number[] {
  const hasil: number[] = [];
  for (const m of String(teks ?? "").matchAll(/Rp\.?\s*([\d.]+)(?:,(\d{1,2}))?/gi)) {
    const n = Number(m[1].replace(/\./g, ""));
    if (Number.isFinite(n) && n > 0) hasil.push(n);
  }
  return hasil;
}

function pola(kata: string) {
  // "MENGADILI" boleh ditulis berspasi "M E N G A D I L I".
  return new RegExp(kata.split("").join("\\s*"), "gi");
}

/**
 * Amar dari teks dokumen: sesudah MENGADILI TERAKHIR sampai "Demikian(lah) diputuskan/putusan".
 * Putusan sela/rekonvensi dapat memuat lebih dari satu "MENGADILI" - yang terakhir = amar putusan akhir.
 */
export function amarDariDokumen(teks: string): string {
  const t = String(teks ?? "");
  let akhir = -1;
  let panjang = 0;
  for (const m of t.matchAll(pola("MENGADILI"))) {
    akhir = m.index ?? -1;
    panjang = m[0].length;
  }
  if (akhir < 0) return "";
  const sisa = t.slice(akhir + panjang);
  // Tanpa penutup yang dikenal = tidak terbaca (bukan menebak sampai rincian biaya, yang angkanya bukan amar).
  const tutup = sisa.search(/Demikian(?:lah)?\s+(?:diputuskan|putusan|ditetapkan|penetapan|dijatuhkan)|Rincian\s+Biaya/i);
  return tutup >= 0 ? sisa.slice(0, tutup).trim() : "";
}

/** Tanggal putusan dari dokumen: tanggal Masehi pertama sesudah "Demikian diputuskan". -> "YYYY-MM-DD" | "" */
export function tanggalDariDokumen(teks: string): string {
  const t = String(teks ?? "");
  const i = t.search(/Demikian(?:lah)?\s+(?:diputuskan|putusan|ditetapkan|penetapan)/i);
  if (i < 0) return "";
  const potong = t.slice(i, i + 700);
  const m = potong.match(/\b(\d{1,2})\s+(Januari|Februari|Pebruari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|Nopember|November|Desember)\s+(\d{4})\b/i);
  if (!m) return "";
  const b = BULAN[m[2].toLowerCase()];
  return `${m[3]}-${String(b).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}

export function tanggalIndo(iso: string): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${NAMA_BULAN[Number(m[2])]} ${m[1]}` : String(iso ?? "");
}

/** Bagian kata `a` yang ada di `b` (multiset dipermudah: tiap kata dihitung sekali per kemunculan di a). */
function liputan(a: string[], b: string[]): number {
  if (!a.length) return 1;
  const ada = new Map<string, number>();
  for (const k of b) ada.set(k, (ada.get(k) ?? 0) + 1);
  let kena = 0;
  for (const k of a) {
    const n = ada.get(k) ?? 0;
    if (n > 0) {
      kena += 1;
      ada.set(k, n - 1);
    }
  }
  return kena / a.length;
}

function rupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")},00`;
}

export function cocokkanPutusan(masukan: {
  tanggalPutusanSipp: string;
  amarSippHtml: string;
  teksDokumen: string | null;
}): HasilCocok {
  const tglSipp = String(masukan.tanggalPutusanSipp ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tglSipp)) return { keadaan: "belum-putus", beda: [], liputan: -1, catatan: "" };
  if (masukan.teksDokumen === null) return { keadaan: "tanpa-dokumen", beda: [], liputan: -1, catatan: "Dokumen putusan belum diunggah." };
  const amarDok = amarDariDokumen(masukan.teksDokumen);
  if (!amarDok) return { keadaan: "tidak-terbaca", beda: [], liputan: -1, catatan: "Bagian amar (MENGADILI) tidak terbaca di dokumen." };
  const beda: BedaPutusan[] = [];

  const tglDok = tanggalDariDokumen(masukan.teksDokumen);
  if (tglDok && tglDok !== tglSipp) {
    beda.push({ bagian: "tanggal", label: "Tanggal putusan", ringkas: "tanggal putusan berbeda", sipp: tanggalIndo(tglSipp), dokumen: tanggalIndo(tglDok) });
  }

  const amarSipp = htmlKeTeksAmar(masukan.amarSippHtml);
  const kataSipp = kataAmar(amarSipp);
  if (!kataSipp.length) {
    beda.push({ bagian: "amar", label: "Amar", ringkas: "amar putusan di SIPP masih kosong", sipp: "(kosong)", dokumen: "ada" });
    return { keadaan: "beda", beda, liputan: 0, catatan: "" };
  }
  const nSipp = [...new Set(nominalRupiah(amarSipp))].sort((a, b) => a - b);
  const nDok = [...new Set(nominalRupiah(amarDok))].sort((a, b) => a - b);
  const hilang = nSipp.filter((n) => !nDok.includes(n));
  const lebih = nDok.filter((n) => !nSipp.includes(n));
  if (hilang.length || lebih.length) {
    beda.push({
      bagian: "nominal",
      label: "Nominal di amar",
      ringkas: "nominal rupiah di amar berbeda",
      sipp: nSipp.map(rupiah).join(", ") || "-",
      dokumen: nDok.map(rupiah).join(", ") || "-",
    });
  }
  const kataDok = kataAmar(amarDok);
  const maju = liputan(kataSipp, kataDok);
  const mundur = liputan(kataDok, kataSipp);
  const skor = Math.min(maju, mundur);
  if (skor < BATAS_LIPUTAN) {
    const setDok = new Set(kataDok);
    const setSipp = new Set(kataSipp);
    const tak = [...new Set(kataSipp.filter((k) => !setDok.has(k)))].slice(0, 8).join(", ");
    const tambah = [...new Set(kataDok.filter((k) => !setSipp.has(k)))].slice(0, 8).join(", ");
    beda.push({
      bagian: "amar",
      label: "Isi amar",
      ringkas: "isi amar berbeda",
      sipp: tak ? `hanya di SIPP: ${tak}` : "-",
      dokumen: tambah ? `hanya di dokumen: ${tambah}` : "-",
    });
  }
  return { keadaan: beda.length ? "beda" : "cocok", beda, liputan: Math.round(skor * 1000) / 1000, catatan: "" };
}
