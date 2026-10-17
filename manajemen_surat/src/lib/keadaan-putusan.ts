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
 *   hak-asuh / hak-asuh-verstek      "Lain-Lain" bernomor Pdt.G (gugatan hak     hak asuh anak (F21 17 Okt) -> folder "6a Hak Asuh Anak (Hadhanah)";
 *                                    asuh PA Donggala terdaftar 369)             "-verstek" didahulukan bila putusan verstek / verstek tanpa bendera
 *   hak-asuh-t-ibu                   hak asuh, Tergugat perempuan (bot: pihak.jenis_kelamin) bukan verstek -> tolak = [03a] Hadhanah ditetapkan kepada T (I7 17 Okt)
 *   rekonvensi-dikabulkan            harta bersama, amar memuat rekonvensi yang dikabulkan                   kabul   -> [01a] HB Rekonvensi Dikabulkan (I7 17 Okt)
 *   es-biasa(-verstek|-setelah-mediasi|-sema-1-2022)
 *                                    ekonomi syariah bernomor Pdt.G (acara biasa; Pdt.G.S = gugatan           folder "10a Ekonomi Syariah Biasa" (F22 17 Okt); akhiran
 *                                    sederhana tetap "10 Ekonomi Syariah")                                    menggandeng keadaan umum karena baris peta hanya memuat satu kode
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
  | "kontensius"
  | "hak-asuh"
  | "hak-asuh-verstek"
  | "hak-asuh-t-ibu"
  | "rekonvensi-dikabulkan"
  | "es-biasa"
  | "es-biasa-verstek"
  | "es-biasa-setelah-mediasi"
  | "es-biasa-sema-1-2022";

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
  /** I7 17 Okt: Tergugat perempuan (pihak.jenis_kelamin = P) pada gugatan hak asuh; true/false, null/kosong = tidak diketahui (tidak ditebak). */
  tergugatPerempuan?: unknown;
  /** I7 17 Okt: amar putusan SIPP (perkara_putusan.amar_putusan) bila sudah ada - dasar deteksi rekonvensi yang dikabulkan. */
  amarPutusan?: unknown;
  /** I7 17 Okt: penanda tegas dari konseptor/hakim bahwa rekonvensi dikabulkan (saklar); menang atas amar. */
  rekonvensiDikabulkan?: unknown;
  /** I7 17 Okt: potongan amar dari bot (mulai "Dalam Rekonvensi") - sama artinya dengan amarPutusan. */
  amarRekonvensi?: unknown;
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

/** F21 17 Okt: hak asuh anak (349 Penguasaan Anak), pembatalan perkawinan, ekonomi syariah - gugatan yang mengenal mediasi dan verstek seperti cerai. */
function jenisGugatanBaru(j: string) {
  return j.includes("penguasaan anak") || j.includes("hak asuh") || j.includes("pembatalan perkawinan") || j.includes("ekonomi syariah");
}
/** Gugatan hak asuh anak yang didaftarkan sebagai "Lain-Lain" (369) bernomor Pdt.G; pengangkatan anak (Pdt.P) bukan. */
function hakAsuhTerdaftarLainLain(j: string, nomor: unknown) {
  return j.includes("lain-lain") && /\/pdt\.g\//i.test(String(nomor ?? ""));
}

/** F22 17 Okt: ekonomi syariah ACARA BIASA = nomor Pdt.G (gugatan sederhana Pdt.G.S tetap "10 Ekonomi Syariah"); nomor belum diketahui tidak ditebak. */
function esAcaraBiasa(j: string, nomor: unknown) {
  return j.includes("ekonomi syariah") && /\/pdt\.g\//i.test(String(nomor ?? ""));
}

/** F22 17 Okt: wasiat (jenis 365) - gugatan yang mengenal mediasi dan verstek seperti cerai. */
function jenisWasiat(j: string) {
  return /\bwasiat\b/.test(j);
}

/**
 * I7 17 Okt: rekonvensi dikabulkan pada gugatan harta bersama. SIPP tidak menyimpan amar rekonvensi sebagai ruas tersendiri: penanda tegas
 * (saklar konseptor/hakim) didahulukan, selain itu amar putusan yang memuat "Dalam Rekonvensi" lalu "Mengabulkan" (bukan "Menolak") sesudahnya.
 */
export function rekonvensiDikabulkanDariAmar(amar: unknown): boolean {
  const t = String(amar ?? "").replace(/\s+/g, " ");
  const i = t.search(/dalam\s+rekonvensi/i);
  if (i < 0) return false;
  const bagian = t.slice(i).replace(/dalam\s+rekonvensi/i, "");
  const berhenti = bagian.search(/dalam\s+(?:konvensi|pokok\s+perkara)/i);
  const isi = berhenti >= 0 ? bagian.slice(0, berhenti) : bagian;
  const kabul = isi.search(/mengabulkan/i);
  if (kabul < 0) return false;
  const tolak = isi.search(/menolak\s+gugatan\s+rekonvensi|menolak\s+gugatan\s+penggugat\s+rekonvensi/i);
  return tolak < 0 || kabul < tolak;
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

  if (jenisCerai(j) || j.includes("harta bersama") || j.includes("kewarisan") || /\bwaris\b/.test(j) || j.includes("poligami") || jenisGugatanBaru(j) || jenisWasiat(j) || hakAsuhTerdaftarLainLain(j, m.nomorPerkara)) {
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
  const hakAsuh = hakAsuhTerdaftarLainLain(j, m.nomorPerkara);
  const verstekAkhir = verstekBendera || hasil.includes("verstek-tanpa-bendera");
  // I7 17 Okt: hak asuh yang gugatannya ditolak sementara Tergugat adalah ibu -> [03a] (hanya bila jelas perempuan dan bukan verstek).
  if ((hakAsuh || j.includes("penguasaan anak") || j.includes("hak asuh")) && m.tergugatPerempuan === true && !verstekAkhir) hasil.push("hak-asuh-t-ibu");
  if (hakAsuh) {
    if (verstekAkhir) hasil.push("hak-asuh-verstek");
    hasil.push("hak-asuh");
  }
  // I7 17 Okt: HB dengan rekonvensi dikabulkan didahulukan atas "kontradiktoir".
  if (j.includes("harta bersama")) {
    const tegas = m.rekonvensiDikabulkan === true || (m.rekonvensiDikabulkan === undefined && rekonvensiDikabulkanDariAmar(m.amarPutusan || m.amarRekonvensi));
    if (tegas) hasil.unshift("rekonvensi-dikabulkan");
  }
  // F22 17 Okt: ES acara biasa. Kode gabungan (satu kode per baris peta) didahulukan, "es-biasa" paling akhir di antara mereka.
  if (esAcaraBiasa(j, m.nomorPerkara)) {
    const gabung: KodeKeadaanPutusan[] = [];
    if (verstekAkhir) gabung.push("es-biasa-verstek");
    if (hasil.includes("t-tidak-hadir-setelah-mediasi")) gabung.push("es-biasa-setelah-mediasi");
    if (hasil.includes("sema-1-2022")) gabung.push("es-biasa-sema-1-2022");
    gabung.push("es-biasa");
    hasil.unshift(...gabung);
  }
  return hasil;
}
