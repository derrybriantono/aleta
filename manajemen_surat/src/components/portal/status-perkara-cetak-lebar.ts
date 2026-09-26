/**
 * Lebar kolom dan ukuran huruf lembar cetak hasil Status Perkara - DIUKUR dari
 * teks yang akan dicetak, bukan ditebak dari banyaknya kolom.
 *
 * ============================================================================
 * SEBABNYA
 * ============================================================================
 *
 * Lembar cetak memakai table-layout: fixed selebar kertas supaya tidak pernah
 * terpotong di kanan, dan kata yang lebih lebar dari kolomnya dipatahkan di
 * dalam selnya. Dengan lebar kolom menurut BOBOT tetap, terukur di Chromium 26
 * September 2026 atas 100 hasil sungguhan pada "Semua kolom" (22 kolom, 6 pt,
 * A4 mendatar): 350 dari 2.222 sel memuat kata yang dipatahkan di tengah -
 * termasuk SELURUH nomor perkara ("574/Pdt.G/2026/PA.Dgl" 83 px di ruang
 * 63 px), "Tida|k" di kolom e-Court, "Penetapa|n", dan kepala "Umu|r".
 *
 * Bobot tetap tidak dapat benar untuk segala pilihan kolom dan segala isi.
 * Karena itu lebarnya disusun dari KATA TERPANJANG tiap kolom:
 *
 *   1. Tiap kolom sekurangnya selebar kata terpanjangnya (kepala dan isinya)
 *      ditambah ruang selnya. Bila jumlahnya muat di bidang cetak, sisanya
 *      dibagi menurut bobot - tidak satu kata pun dipatahkan.
 *   2. Bila tidak muat, huruf diperkecil setengah poin demi setengah poin
 *      sampai UKURAN_TERKECIL_PT.
 *   3. Bila pada huruf terkecil pun tidak muat, kolom yang isinya tidak boleh
 *      patah (nomor perkara, tanggal, angka, e-Court, status, akta cerai -
 *      `utuh`) mendapat lebar minimumnya lebih dahulu; kolom teks (nama,
 *      tahapan, jenis, keterangan) berbagi sisanya, dan HANYA di sanalah kata
 *      panjang dapat dipatahkan. Kolom mana yang terkena disebutkan
 *      (`kolomPatah`) - layar memperingatkannya sebelum mencetak.
 *
 * Tanpa pengukur (jsdom dalam uji, atau peramban tanpa kanvas) lebarnya
 * kembali menurut bobot saja - bentuk sebelum pengukuran ini ada.
 *
 * Berkas ini tidak mengimpor apa pun: fungsinya murni, dapat diuji dengan
 * pengukur buatan, dan dapat dijalankan utuh di peramban sungguhan untuk
 * diukur.
 */

/** Lebar teks dalam px pada huruf 10 pt; `tebal` untuk kepala kolom. */
export type PengukurTeks = (teks: string, tebal: boolean) => number;

/** Bidang cetak A4 mendatar dikurangi tepi 10 mm kiri-kanan: 277 mm pada 96 px per inci. */
export const LEBAR_BIDANG_CETAK_PX = (277 / 25.4) * 96;

/** Huruf terkecil yang masih dipakai sebelum kata dibiarkan patah. */
export const UKURAN_TERKECIL_PT = 5.5;

/** Cadangan per kolom untuk pembulatan subpiksel dan pengisyaratan huruf saat dicetak. */
export const CADANGAN_PX = 2;

/** Bobot kolom "No" - cukup untuk tiga angka pada huruf terkecil. */
export const BOBOT_NOMOR_URUT = 1;

/** Ukuran huruf AWAL menurut banyaknya kolom (termasuk "No"). */
export function ukuranHurufCetak(jumlahKolom: number): string {
  if (jumlahKolom > 16) return "6pt";
  if (jumlahKolom > 12) return "7pt";
  if (jumlahKolom > 8) return "7.5pt";
  return "8.5pt";
}

/**
 * Padding sel menurut banyaknya kolom (termasuk "No"). Tabel yang padat
 * dirapatkan: 22 kolom kehilangan 44 px lebar isi hanya untuk padding lebar.
 */
export function paddingSelCetak(jumlahKolom: number): { atas: number; samping: number } {
  return jumlahKolom > 12 ? { atas: 2, samping: 3 } : { atas: 3, samping: 4 };
}

/** Ruang yang tidak diisi teks pada tiap sel: padding kiri-kanan dan garis. */
export function ruangSelCetak(jumlahKolom: number): number {
  return paddingSelCetak(jumlahKolom).samping * 2 + 1;
}

/** Lebar tiap kolom dalam persen menurut BOBOT saja, kolom "No" di depan; jumlahnya 100. */
export function lebarKolomCetak(jumlahKolom: number, bobot?: number[]): string[] {
  const daftar = bobotPenuh(jumlahKolom, bobot);
  const total = daftar.reduce((a, b) => a + b, 0);
  return daftar.map((b) => `${((b / total) * 100).toFixed(3)}%`);
}

function bobotPenuh(jumlahKolom: number, bobot?: number[]): number[] {
  return [
    BOBOT_NOMOR_URUT,
    ...Array.from({ length: jumlahKolom }, (_, i) => {
      const b = bobot?.[i];
      return typeof b === "number" && Number.isFinite(b) && b > 0 ? b : 2;
    }),
  ];
}

export type TataLetakCetak = {
  /** Ukuran huruf tabel dalam pt. */
  ukuranPt: number;
  /** Lebar tiap kolom dalam persen, kolom "No" di depan; jumlahnya 100. */
  lebarPersen: string[];
  /**
   * Indeks kolom (0 = "No", 1 = kepala[0], ...) yang kata terpanjangnya
   * TETAP lebih lebar dari kolomnya - kata itu akan dipatahkan.
   */
  kolomPatah: number[];
  /** false bila tidak ada pengukur - lebar menurut bobot saja, tidak diketahui apa yang patah. */
  terukur: boolean;
  padding: { atas: number; samping: number };
};

/** Kata-kata satu sel: dipisah spasi - di situlah peramban boleh membungkus. */
function pecahKata(teks: string): string[] {
  return String(teks ?? "")
    .split(/\s+/)
    .filter(Boolean);
}

export function susunTataLetakCetak(p: {
  /** Kepala kolom, TANPA "No". */
  kepala: string[];
  /** Teks tiap sel, baris demi baris, TANPA nomor urut. */
  baris: string[][];
  bobot?: number[];
  /** Kolom yang katanya tidak boleh dipatahkan - sejajar dengan `kepala`. */
  utuh?: boolean[];
  ukur: PengukurTeks | null | undefined;
  lebarBidangPx?: number;
}): TataLetakCetak {
  const n = p.kepala.length;
  const jumlahKolom = n + 1;
  const padding = paddingSelCetak(jumlahKolom);
  const ukuranAwal = parseFloat(ukuranHurufCetak(jumlahKolom));
  const bobot = bobotPenuh(n, p.bobot);
  const totalBobot = bobot.reduce((a, b) => a + b, 0);
  const ukur = p.ukur;
  if (!ukur || n === 0) {
    return { ukuranPt: ukuranAwal, lebarPersen: lebarKolomCetak(n, p.bobot), kolomPatah: [], terukur: false, padding };
  }

  const L = p.lebarBidangPx ?? LEBAR_BIDANG_CETAK_PX;
  const ruang = ruangSelCetak(jumlahKolom) + CADANGAN_PX;
  const utuh = [true, ...Array.from({ length: n }, (_, i) => Boolean(p.utuh?.[i]))];

  // Kata terpanjang tiap kolom pada 10 pt. Tiap kata unik diukur sekali per
  // kolom - lima ratus baris nama yang sama tidak diukur lima ratus kali.
  const kata10 = new Array<number>(jumlahKolom).fill(0);
  const sudah = Array.from({ length: jumlahKolom }, () => new Set<string>());
  const catat = (j: number, teks: string, tebal: boolean) => {
    for (const kata of pecahKata(teks)) {
      const kunci = (tebal ? "b|" : "n|") + kata;
      if (sudah[j].has(kunci)) continue;
      sudah[j].add(kunci);
      const w = ukur(kata, tebal);
      if (Number.isFinite(w) && w > kata10[j]) kata10[j] = w;
    }
  };
  catat(0, "No", true);
  catat(0, String(p.baris.length), false);
  p.kepala.forEach((judul, i) => catat(i + 1, judul, true));
  for (const sel of p.baris) {
    for (let i = 0; i < n; i += 1) catat(i + 1, sel[i] ?? "", false);
  }

  const minimum = (pt: number) => kata10.map((w) => (w * pt) / 10 + ruang);
  const persen = (lebar: number[]) => {
    const total = lebar.reduce((a, b) => a + b, 0);
    return lebar.map((w) => `${((w / total) * 100).toFixed(3)}%`);
  };

  // 1-2. Muat utuh pada huruf awal, atau pada huruf yang diperkecil.
  for (let pt = ukuranAwal; pt >= UKURAN_TERKECIL_PT - 1e-9; pt = Math.round((pt - 0.5) * 10) / 10) {
    const min = minimum(pt);
    const jumlah = min.reduce((a, b) => a + b, 0);
    if (jumlah <= L) {
      const sisa = L - jumlah;
      const lebar = min.map((m, j) => m + (sisa * bobot[j]) / totalBobot);
      return { ukuranPt: pt, lebarPersen: persen(lebar), kolomPatah: [], terukur: true, padding };
    }
  }

  // 3. Tidak muat pada huruf terkecil.
  const pt = UKURAN_TERKECIL_PT;
  const min = minimum(pt);
  const lebar = min.slice();
  const indeksUtuh = min.map((_, j) => j).filter((j) => utuh[j]);
  const jumlahUtuh = indeksUtuh.reduce((a, j) => a + min[j], 0);
  const teks = min.map((_, j) => j).filter((j) => !utuh[j]);

  if (jumlahUtuh < L && teks.length > 0) {
    // Kolom utuh mendapat minimumnya; kolom teks berbagi sisanya menurut
    // bobot. Kolom teks yang jatahnya melebihi minimumnya cukup diberi
    // minimumnya, dan lebihannya dibagi ulang - supaya sesedikit mungkin
    // kolom yang katanya patah.
    let sisa = L - jumlahUtuh;
    let aktif = teks.slice();
    while (aktif.length > 0) {
      const b = aktif.reduce((a, j) => a + bobot[j], 0);
      const jatah = new Map(aktif.map((j) => [j, (sisa * bobot[j]) / b]));
      const cukup = aktif.filter((j) => (jatah.get(j) ?? 0) >= min[j]);
      if (cukup.length === 0) {
        for (const j of aktif) lebar[j] = jatah.get(j) ?? 0;
        break;
      }
      for (const j of cukup) {
        lebar[j] = min[j];
        sisa -= min[j];
      }
      aktif = aktif.filter((j) => !cukup.includes(j));
    }
  } else {
    // Bahkan kolom utuh tidak muat: seluruh kolom menyusut sebanding dengan
    // minimumnya. Kertasnya memang terlalu sempit untuk pilihan kolom ini.
    const jumlah = min.reduce((a, b) => a + b, 0);
    for (let j = 0; j < lebar.length; j += 1) lebar[j] = (min[j] * L) / jumlah;
  }

  const kolomPatah = lebar.map((w, j) => (w + 0.01 < min[j] ? j : -1)).filter((j) => j >= 0);
  return { ukuranPt: pt, lebarPersen: persen(lebar), kolomPatah, terukur: true, padding };
}

/**
 * Pengukur teks dari kanvas peramban, dengan huruf yang sama dengan tabel
 * cetak (sans-serif). null bila tidak ada kanvas.
 *
 * jsdom (lingkungan uji) dikenali lebih dahulu: kanvasnya tidak
 * diimplementasikan, dan memanggilnya hanya mencetak "Not implemented" ke
 * konsol tanpa hasil.
 */
export function pengukurKanvas(): PengukurTeks | null {
  if (typeof document === "undefined" || typeof navigator === "undefined") return null;
  if (/jsdom/i.test(navigator.userAgent || "")) return null;
  let konteks: CanvasRenderingContext2D | null = null;
  try {
    konteks = document.createElement("canvas").getContext("2d");
  } catch (galat) {
    // Tidak ditelan diam-diam: lembar tetap tercetak menurut bobot, dan panel
    // pilih kolom menyebut bahwa lebarnya tidak dapat diukur.
    console.warn("[cetak hasil] kanvas tidak dapat dibuat - lebar kolom menurut bobot saja:", galat);
    return null;
  }
  if (!konteks || typeof konteks.measureText !== "function") return null;
  const kanvas = konteks;
  const simpan = new Map<string, number>();
  return (teks, tebal) => {
    const kunci = (tebal ? "b|" : "n|") + teks;
    const ada = simpan.get(kunci);
    if (ada !== undefined) return ada;
    kanvas.font = `${tebal ? "700 " : ""}10pt sans-serif`;
    const w = kanvas.measureText(teks).width;
    simpan.set(kunci, w);
    return w;
  };
}
