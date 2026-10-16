/**
 * ============================================================================
 * KEADAAN PUTUSAN - BAHAN PEMILIHAN BLANGKO PUTUSAN PER KEADAAN (Q3, 16 Okt 2026)
 * ============================================================================
 *
 * Peta perkara L3 (15 Okt) mengukur 2.497 perkara berputusan: ALETA memilih blangko yang tepat hanya untuk 84%, karena pilihannya
 * hanya mengenal jenis + status + verstek. Yang membedakan blangko Derry di dalam satu status ternyata keadaan perkaranya:
 *
 *   mediasi-sebagian                 hasil mediasi "S" (berhasil sebagian)       kabul   -> [02b] (CG 32+, CT 38 dari 45 kontradiktoir)
 *   t-tidak-hadir-setelah-mediasi    T hadir mediasi, putusan tanpa T            kabul   -> [01c] / [02a] (35 perkara)
 *   verstek-tanpa-bendera            T tak pernah hadir, tanpa mediasi, tetapi   kabul/tolak -> dianggap verstek (56 perkara kabul + 2 tolak;
 *                                    bendera verstek kosong (data tidak diisi)   anomali data)
 *   sesudah-mediasi                  ada mediasi                                 cabut   -> [98] [Cabut] 2 (CG 18, CT 3)
 *   sema-1-2022                      P hadir lalu dua sidang beruntun tak hadir  NO      -> [98] [NO] 4a / permohonan [99] NO SEMA (CG 10, CT 2, IN 5)
 *   p-tidak-hadir-t-hadir            T hadir, P tidak                            gugur   -> [98] [Gugur] 3a (CT 3)
 *   kontradiktoir                    T hadir pada sidang putusan                 HB/Waris kabul -> [01] kontradiktoir
 *   kontensius                       itsbat dengan nomor Pdt.G                   IN kontensius -> folder "2a Itsbat Nikah Kontensius"
 *
 * Fungsi ini MURNI (tanpa jaringan/basis data) dan dipanggil route jadwal sidang untuk tiap baris; kode-kodenya dikirim ke ekstensi
 * sebagai `keadaanPutusan` dan dipakai `alatPetaUntukPerkara` (ekstensi-sipp/panel-alat.js, argumen ke-6). Urutan kode = urutan
 * kekhususan: yang pertama yang punya baris peta yang dipakai.
 *
 * Konservatif: kehadiran yang belum dicatat SIPP (dihadiri_oleh kosong) atau mediasi yang gagal dibaca TIDAK ditebak - tidak ada kode.
 */

export type KodeKeadaanPutusan =
  | "mediasi-sebagian"
  | "t-tidak-hadir-setelah-mediasi"
  | "kontradiktoir"
  | "verstek-tanpa-bendera"
  | "sesudah-mediasi"
  | "sema-1-2022"
  | "p-tidak-hadir-t-hadir"
  | "kontensius";

export type MasukanKeadaanPutusan = {
  jenisPerkara?: unknown;
  nomorPerkara?: unknown;
  /** Bendera SIPP putusan_verstek = 'Y' (verstekPutusan pada baris jadwal). */
  verstekPutusan?: unknown;
  /** Sandi dihadiri_oleh sidang yang dilihat: 1 semua, 2 pihak pertama saja, 3 pihak kedua saja, 4 tidak ada. */
  dihadiriOleh?: unknown;
  panggilan?: {
    hadirSebelumnya?: unknown;
    tergugatPernahHadir?: unknown;
    penggugatPernahHadir?: unknown;
  } | null;
  /** Mediasi terakhir perkara ({hasil: "Y"|"Y1"|"Y2"|"S"|"T"|"D"|""}); null = tidak pernah bermediasi. */
  mediasi?: { hasil?: unknown } | null;
  /** false = kueri mediasi gagal; tanpa ini mediasi tak dapat dipastikan ada atau tidak. */
  mediasiTerbaca?: unknown;
};

const angka = (x: unknown): number | null => {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

const kecil = (x: unknown) => String(x ?? "").toLowerCase().replace(/\s+/g, " ").trim();

function jenisCerai(j: string) {
  return j.includes("cerai gugat") || j.includes("cerai talak");
}
function jenisItsbat(j: string) {
  return j.includes("istbat") || j.includes("itsbat") || j.includes("pengesahan perkawinan");
}

/** Kode keadaan putusan satu perkara menurut baris sidang yang dilihat, berurut dari yang paling khusus. */
export function keadaanPutusan(m: MasukanKeadaanPutusan): KodeKeadaanPutusan[] {
  const j = kecil(m.jenisPerkara);
  if (!j) return [];
  const hasil: KodeKeadaanPutusan[] = [];
  const hadir = angka(m.dihadiriOleh);
  const sebelumnya = angka(m.panggilan?.hadirSebelumnya);
  const tHadirKini = hadir === 1 || hadir === 3;
  const tPernah = m.panggilan?.tergugatPernahHadir === true || tHadirKini;
  const mediasiTerbaca = m.mediasiTerbaca !== false;
  const pernahMediasi = mediasiTerbaca && Boolean(m.mediasi);
  const hasilMediasi = kecil(m.mediasi?.hasil).toUpperCase();
  const verstekBendera = m.verstekPutusan === true;

  if (jenisCerai(j) || j.includes("harta bersama") || j.includes("kewarisan") || /\bwaris\b/.test(j) || j.includes("poligami")) {
    if (pernahMediasi && hasilMediasi === "S") hasil.push("mediasi-sebagian");
    if (pernahMediasi && tPernah && hadir === 2) hasil.push("t-tidak-hadir-setelah-mediasi");
    if (tHadirKini) hasil.push("kontradiktoir");
    // Bendera verstek kosong padahal T tak pernah hadir dan tak ada mediasi: dianggap verstek. Hanya bila kehadiran sidang ini
    // tercatat (pihak pertama saja) dan mediasi pasti terbaca tidak ada.
    if (!verstekBendera && mediasiTerbaca && !m.mediasi && !tPernah && hadir === 2) hasil.push("verstek-tanpa-bendera");
    if (pernahMediasi) hasil.push("sesudah-mediasi");
  }

  // P hadir sidang pertama lalu dua sidang beruntun tak hadir (SEMA 1/2022) - cerai dan permohonan.
  if (hadir === 4 && sebelumnya === 4 && m.panggilan?.penggugatPernahHadir === true) hasil.push("sema-1-2022");
  // Gugur di mana T hadir tetapi P tidak.
  if (hadir === 3 || sebelumnya === 3) hasil.push("p-tidak-hadir-t-hadir");

  if (jenisItsbat(j) && /\/pdt\.g\//i.test(String(m.nomorPerkara ?? ""))) hasil.push("kontensius");
  return hasil;
}
