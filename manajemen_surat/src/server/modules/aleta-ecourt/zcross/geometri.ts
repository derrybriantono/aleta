/**
 * Z CROSS OTOMATIS - GEOMETRI MURNI (tanpa mesin, tanpa berkas) supaya aturannya dapat diuji sendiri.
 *
 * Satuan: poin PDF (1 cm = 28,3465 pt), titik asal KIRI-ATAS halaman. RTF memakai twip (1 pt = 20 twip), DOCX memakai EMU (1 pt = 12700 EMU).
 *
 * Aturan Derry (31 Okt 2026):
 *   - garis ATAS Z selalu mulai di samping kata terakhir paragraf "...berikut:" / "...berupa:" pada baris yang SAMA sampai batas kanan
 *     (tidak pernah di baris bawah paragraf); ruang < 3 cm = kalimatnya DIRAPATKAN (jarak huruf), bukan garisnya dipindah;
 *   - diagonal ke kiri bawah; garis BAWAH +-3 cm di atas batas bawah halaman;
 *   - 2 Nov 2026 (keputusan Derry): bila margin bawah naskah diketahui, garis BAWAH ditarik sampai dekat batas bawah AREA TEKS (bukan
 *     ujung kertas, tidak masuk kaki halaman/nomor halaman) dan kotak tanggal tepat di bawahnya, masih di dalam area teks;
 *   - tanggal tepat di bawah garis, tidak menempel tepi kertas;
 *   - ganti halaman; nomor halaman bagian berikutnya = halaman Z + jumlah halaman bukti (dikonfirmasi: melompat).
 */

export const CM = 72 / 2.54;
export const TWIP_PER_PT = 20;
export const EMU_PER_PT = 12700;

/** Ruang minimal di samping kata terakhir untuk garis atas; kurang dari ini kalimat dirapatkan. */
export const RUANG_MIN_GARIS_ATAS = 3 * CM;
/** Garis bawah Z berjarak segini di atas batas bawah halaman (tepi kertas). */
export const JARAK_BAWAH_HALAMAN = 3 * CM;
/** Garis atas tidak boleh lebih pendek dari ini (kata terakhir hampir menyentuh batas kanan). */
export const PANJANG_MIN_GARIS_ATAS = 0.8 * CM;
/** Ruang tanggal: tinggi satu baris tanggal dan sisa tepi kertas yang tidak boleh dilanggar. */
export const SISA_TEPI_TANGGAL = 1.2 * CM;
export const TINGGI_BARIS_TANGGAL = 15;
/** Ruang kotak tanggal di bawah garis bawah (dua baris: tanda "SC Z 1x" + tanggal, 12 pt) bila garis ditarik ke batas area teks. */
export const RUANG_TANGGAL_AREA_TEKS = 2 * TINGGI_BARIS_TANGGAL + 4;

/** Letak kata terakhir paragraf jangkar, hasil pembacaan PDF. */
export type LetakJangkar = {
  /** Halaman PDF (urutan fisik, mulai 1). */
  halaman: number;
  lebarHalaman: number;
  tinggiHalaman: number;
  /** Ujung kanan kata terakhir. */
  xAkhir: number;
  /** Garis dasar huruf (dari atas halaman) dan ukuran hurufnya. */
  yDasar: number;
  ukuranHuruf: number;
  teksBaris: string;
};

/** kiri/kanan = batas teks (pt dari tepi kiri kertas); bawah = margin bawah halaman (pt), bila diketahui dari naskah. */
export type Tepi = { kiri: number; kanan: number; bawah?: number };

export type TemuanZ = { tingkat: "info" | "peringatan"; pesan: string };

export type RencanaZ = {
  halaman: number;
  tinggiHalaman: number;
  /** Garis atas: dari (x1,y) ke (x2,y). */
  atas: { x1: number; x2: number; y: number };
  /** Diagonal dari ujung kanan garis atas ke ujung kiri garis bawah. */
  diagonal: { x1: number; y1: number; x2: number; y2: number };
  bawah: { x1: number; x2: number; y: number };
  tanggal: { x: number; y: number; lebar: number; tinggi: number };
  /** Kekurangan ruang (pt) yang harus ditutup dengan merapatkan kalimat; 0 = cukup. */
  kurangRuang: number;
  temuan: TemuanZ[];
};

/** Tinggi tengah huruf kecil di atas garis dasar: garis atas Z ditarik setinggi ini supaya tampak "menyambung" dari kata terakhir. */
const NAIK_DARI_DASAR = 0.3;

export function ruangDiSampingKata(j: LetakJangkar, tepi: Tepi): number {
  return tepi.kanan - j.xAkhir;
}

/**
 * Rencana Z untuk satu jangkar. `kurangRuang` > 0 berarti kalimat harus dirapatkan dulu (pemanggil mengukur ulang); rencana tetap
 * dikembalikan dengan jarak garis dari kata dipersempit supaya tidak pernah pindah baris.
 */
export function rencanaZ(j: LetakJangkar, tepi: Tepi): RencanaZ {
  const temuan: TemuanZ[] = [];
  const y = j.yDasar - NAIK_DARI_DASAR * j.ukuranHuruf;
  const sisa = ruangDiSampingKata(j, tepi);
  const kurangRuang = Math.max(0, RUANG_MIN_GARIS_ATAS - sisa);
  const rapat = sisa < RUANG_MIN_GARIS_ATAS;
  const jarak = rapat ? 1.5 : 4;
  const x1 = j.xAkhir + jarak;
  if (tepi.kanan - x1 < PANJANG_MIN_GARIS_ATAS) {
    temuan.push({ tingkat: "peringatan", pesan: "Garis atas Z sangat pendek (kurang dari 0,8 cm): kata terakhir hampir menyentuh batas kanan; periksa tampilannya." });
  }

  const batasAreaTeks = typeof tepi.bawah === "number" && Number.isFinite(tepi.bawah) && tepi.bawah > 0 ? j.tinggiHalaman - tepi.bawah : null;
  let yBawah = batasAreaTeks != null ? batasAreaTeks - RUANG_TANGGAL_AREA_TEKS : j.tinggiHalaman - JARAK_BAWAH_HALAMAN;
  const terendah = j.tinggiHalaman - SISA_TEPI_TANGGAL - TINGGI_BARIS_TANGGAL - 2;
  const terdekat = j.yDasar + 1 * CM;
  if (yBawah < terdekat) {
    yBawah = terdekat;
    temuan.push({ tingkat: "info", pesan: "Kata terakhir dekat dasar halaman: garis bawah Z diturunkan dari 3 cm di atas tepi bawah." });
  }
  if (yBawah > terendah) {
    yBawah = terendah;
    temuan.push({ tingkat: "peringatan", pesan: "Ruang di bawah kata terakhir kurang dari 1 cm: Z dipadatkan, periksa tampilannya." });
  }
  return {
    halaman: j.halaman,
    tinggiHalaman: j.tinggiHalaman,
    atas: { x1, x2: tepi.kanan, y },
    diagonal: { x1: tepi.kanan, y1: y, x2: tepi.kiri, y2: yBawah },
    bawah: { x1: tepi.kiri, x2: tepi.kanan, y: yBawah },
    tanggal: { x: tepi.kiri, y: yBawah + 3, lebar: Math.min(tepi.kanan - tepi.kiri, 9 * CM), tinggi: 1.7 * CM },
    kurangRuang,
    temuan,
  };
}

/**
 * Nomor halaman bagian berikutnya = halaman Z (nomor TAMPIL) + jumlah halaman bukti + 1 (keputusan Derry 1 Nov: bukti menempati halaman
 * sesudah Z). Contoh: Z di halaman 3, 4 halaman bukti menempati 4-7, bagian berikutnya bernomor 8.
 */
export const TAMBAH_NOMOR_BAWAAN = 1;
export const nomorBagianBerikutnya = (halamanZTampil: number, jumlahHalamanBukti: number, tambah = TAMBAH_NOMOR_BAWAAN): number =>
  Math.max(1, Math.round(halamanZTampil + jumlahHalamanBukti + tambah));

/** Jumlah halaman bukti: dari PDF tiap bukti bila diketahui, selainnya 1 per bukti (bawaan = true supaya pemanggil memberi tahu). */
export function jumlahHalamanBukti(p: { jumlahBukti: number; halamanPerBukti?: ReadonlyArray<number | null | undefined> }): { jumlah: number; bawaan: boolean; terukur: number } {
  const daftar = p.halamanPerBukti ?? [];
  let jumlah = 0;
  let bawaan = false;
  let terukur = 0;
  const n = Math.max(p.jumlahBukti, daftar.length);
  for (let i = 0; i < n; i += 1) {
    const h = daftar[i];
    if (typeof h === "number" && Number.isFinite(h) && h >= 1) {
      jumlah += Math.floor(h);
      terukur += 1;
    } else {
      jumlah += 1;
      bawaan = true;
    }
  }
  return { jumlah, bawaan, terukur };
}

export const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "31 Oktober 2026" menurut tanggal di zona Asia/Makassar (WITA). */
export function tanggalIndonesia(d: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .split("-")
    .map(Number);
  return `${p[2]} ${BULAN_ID[p[1] - 1]} ${p[0]}`;
}

export const keTwip = (pt: number): number => Math.round(pt * TWIP_PER_PT);
export const keEmu = (pt: number): number => Math.round(pt * EMU_PER_PT);
