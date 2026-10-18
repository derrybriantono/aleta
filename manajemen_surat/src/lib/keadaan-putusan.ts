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
 *   sesudah-jawaban                  gugatan dicabut sesudah Tergugat/Termohon menjawab (perlu persetujuannya) -> cabut [98b] (I17 18 Okt);
 *                                    bahan: saklar `sesudahJawaban` atau penandaJawaban bot (jawaban Tergugat di arsip e-Court terbaca)
 *   cacat-formil / kurang-pihak      NO kontradiktoir karena gugatan kabur / kurang pihak -> [99a] / [99b] (I17); SIPP tidak menyimpan alasannya
 *                                    terstruktur, jadi HANYA muncul bila ditandai tegas (saklar `cacatFormil` / `kurangPihak`); selainnya varian pilih manual
 *   kumulasi-itsbat / kumulasi-hak-asuh
 *                                    cerai dengan kumulasi itsbat nikah / hak asuh anak (daftar kumulasi bot) - penanda; blangkonya dipilih lewat baris
 *                                    berkunci "<cerai>+<kumulasi>|<status>|<keadaan>" (folder 1c / 1d), bukan lewat kode ini
 *   alamat-t-tidak-diketahui         Tergugat ghaib / alamat tidak diketahui (penandaPerkara.ghaib atau saklar) -> NO [99c] (I17)
 *   itsbat-kabul-cerai-ditolak       cerai kumulasi itsbat: itsbat dikabulkan, cerai ditolak -> [03] folder 1c (I17); dari saklar atau amar yang menyebutnya
 *   kontensius-verstek               itsbat kontensius, putusan verstek -> [01b] / [03b] (I17), didahulukan atas "kontensius"
 *   cabut-ditolak-t                  Penggugat mencabut sesudah jawaban tetapi Tergugat/Termohon MENOLAK -> perkara dilanjutkan dan diputus kabul [02c]/[01c] (I19 18 Okt);
 *                                    pilihan hakim dari BAS (saklar `cabutDitolakT`), tidak ada di SIPP
 *   eksepsi-(absolut|relatif)-dikabulkan
 *                                    eksepsi kewenangan absolut / relatif dikabulkan -> NO [99c] / [99d] (I19); saklar `eksepsiKewenangan` ("absolut"|"relatif"), SIPP tidak menyimpannya
 *   eksepsi-(absolut|relatif)-ditolak-putusan-sela
 *                                    eksepsi kewenangan ditolak dalam PUTUSAN SELA -> [98e] / [98f] (I19); saklar `eksepsiKewenangan` + `putusanSela`; bukan status akhir SIPP,
 *                                    baris petanya berstatus "Putusan Sela"
 *   dikabulkan-sebagian              putusan dikabulkan UNTUK SEBAGIAN (amar "untuk sebagian" / "selain dan selebihnya", atau saklar `dikabulkanSebagian`) -> baris petanya
 *                                    "<jenis>|dikabulkan sebagian" (penguasaan anak [02]/[02b], nafkah anak [02]/[02b]); status SIPP tetap "Dikabulkan" (I20 18 Okt)
 *   dialihkan                        penguasaan anak dialihkan (pemindahan hak asuh) -> [01d]; hanya dari saklar `penguasaanDialihkan` (pilih manual) (I20)
 *   susunan-ahli-waris               penetapan ahli waris kabul dengan susunan ahli waris dinamis (pasangan, anak, ayah, ibu) -> [01b] (I22 18 Okt); saklar `susunanAhliWaris`, pilih manual
 *   pencairan-dana                   itsbat kontensius yang petitumnya juga memohon pencairan dana (BPJS, Taspen, bank, tabungan) -> [01c] (I22); bahan: `pencairanDana`
 *                                    (bot membaca petitum) atau saklar
 *   anak-sah-perkawinan-tercatat     asal usul anak kabul, anak sah dari perkawinan tercatat yang belum punya akta kelahiran -> [01] baru (I22); saklar, pilih manual
 *   kumulasi-nafkah-istri(-verstek)  cerai gugat yang petitumnya memuat nafkah madliyah / iddah / mut'ah -> [02c] kontradiktoir / [01d] verstek (I22); bahan: `kumulasiNafkahIstri`
 *   plus-nafkah-anak(-verstek|-setelah-mediasi)
 *                                    gugatan hak asuh (Lain-Lain Pdt.G) yang petitumnya juga memuat nafkah anak -> [02] / [02b] / [02a] folder 6a (I23 18 Okt); bahan: `plusNafkahAnak`
 *                                    (bot membaca petitum) atau kumulasi "nafkah-anak"; nafkah anak pasca perceraian (jenis 743) = folder 6c, jenisnya sendiri
 *   nikah-sesudah-2019-tidak-dicatat / poligami-sirri-atau-terikat / terikat-perkawinan-lain
 *                                    itsbat nikah (Pdt.P): NO [99d] / NO [99c] / tolak alternatif [03c] (I19; saklar `alasanItsbat`, pilih manual)
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
  | "es-biasa-sema-1-2022"
  // I17 18 Okt (paket abt-putusan-celah-*): lihat daftar di kepala berkas.
  | "sesudah-jawaban"
  | "cacat-formil"
  | "kurang-pihak"
  | "kumulasi-itsbat"
  | "kumulasi-hak-asuh"
  | "alamat-t-tidak-diketahui"
  | "itsbat-kabul-cerai-ditolak"
  | "kontensius-verstek"
  // I19 18 Okt (paket abt-putusan-eksepsi-cabut/-sela-eksepsi/-itsbat-tolak): lihat daftar di kepala berkas.
  | "cabut-ditolak-t"
  | "eksepsi-absolut-dikabulkan"
  | "eksepsi-relatif-dikabulkan"
  | "eksepsi-absolut-ditolak-putusan-sela"
  | "eksepsi-relatif-ditolak-putusan-sela"
  | "nikah-sesudah-2019-tidak-dicatat"
  | "poligami-sirri-atau-terikat"
  | "terikat-perkawinan-lain"
  // I20 18 Okt (penguasaan anak 6b revisi, nafkah anak 6c): lihat daftar di kepala berkas.
  | "dikabulkan-sebagian"
  | "dialihkan"
  // I22 18 Okt (paket abt-putusan-jawaban-b/-b2-derry): lihat daftar di kepala berkas.
  | "susunan-ahli-waris"
  | "pencairan-dana"
  | "anak-sah-perkawinan-tercatat"
  | "kumulasi-nafkah-istri"
  | "kumulasi-nafkah-istri-verstek"
  // I23 18 Okt (paket abt-nafkah-anak-derry): hak asuh + nafkah anak di folder 6a.
  | "plus-nafkah-anak"
  | "plus-nafkah-anak-verstek"
  | "plus-nafkah-anak-setelah-mediasi";

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
  /** I17 18 Okt: Tergugat sudah menjawab (saklar tegas). Selain itu dibaca dari penandaJawaban bot (jawaban Tergugat di arsip e-Court). */
  sesudahJawaban?: unknown;
  /** Penanda jawaban Tergugat dari bot ({berkas: jumlah berkas jawaban/duplik e-Court}); null = tidak ada / tidak terbaca (tidak ditebak). */
  penandaJawaban?: { berkas?: unknown } | null;
  /** I17: NO karena gugatan kabur / cacat formil, dan kurang pihak - hanya dari penanda tegas hakim/konseptor (tidak dideteksi). */
  cacatFormil?: unknown;
  kurangPihak?: unknown;
  /** I17: daftar kumulasi perkara dari bot ({daftar:[{kode}]} atau larik kode: "itsbat-nikah", "hak-asuh-anak", "nafkah-anak"). */
  kumulasi?: unknown;
  /** I17: penandaPerkara bot ({ghaib}) dan saklar tegas bahwa alamat Tergugat tidak diketahui. */
  penandaPerkara?: { ghaib?: unknown } | null;
  alamatTergugatTidakDiketahui?: unknown;
  /** I17: cerai kumulasi itsbat, itsbat dikabulkan dan cerai ditolak (saklar tegas; selain itu dari amarPutusan bila memuatnya). */
  itsbatKabulCeraiDitolak?: unknown;
  /** I19 18 Okt: Penggugat mencabut sesudah jawaban tetapi Tergugat menolak (saklar tegas hakim/konseptor; SIPP tidak menyimpannya). */
  cabutDitolakT?: unknown;
  /** I19: eksepsi kewenangan yang diajukan Tergugat dalam jawaban - "absolut" | "relatif" (saklar tegas; SIPP tidak menyimpannya). */
  eksepsiKewenangan?: unknown;
  /** I19: eksepsi kewenangan diputus dalam PUTUSAN SELA (ditolak, perkara dilanjutkan); tanpa ini eksepsi dianggap dikabulkan (NO). */
  putusanSela?: unknown;
  /** I19: itsbat nikah (Pdt.P) - "nikah-sesudah-2019-tidak-dicatat" | "poligami-sirri-atau-terikat" | "terikat-perkawinan-lain" (saklar tegas, pilih manual). */
  alasanItsbat?: unknown;
  /** I20 18 Okt: putusan dikabulkan untuk sebagian - saklar tegas, atau dari amarPutusan ("untuk sebagian" / "selebihnya ditolak"). */
  dikabulkanSebagian?: unknown;
  /** I20: penguasaan anak dialihkan ([01d]) - saklar tegas (pilih manual). */
  penguasaanDialihkan?: unknown;
  /** I22 18 Okt: PAW dengan susunan ahli waris dinamis (saklar), AUA anak sah dari perkawinan tercatat (saklar). */
  susunanAhliWaris?: unknown;
  anakSahPerkawinanTercatat?: unknown;
  /** I22: petitum memohon pencairan dana (BPJS, Taspen, bank, tabungan) dan petitum cerai gugat memuat nafkah madliyah / iddah / mut'ah - bot membaca petitum; saklar boleh menimpa. */
  pencairanDana?: unknown;
  kumulasiNafkahIstri?: unknown;
  /** I23 18 Okt: gugatan hak asuh yang petitumnya juga memuat nafkah anak (bot membaca petitum; saklar menang; selain itu dari kumulasi "nafkah-anak"). */
  plusNafkahAnak?: unknown;
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
  // I23 18 Okt: "Nafkah Anak Pasca Perceraian" (jenis 743, folder 6c) - gugatan yang mengenal mediasi, verstek, dan cabut sesudah jawaban seperti penguasaan anak.
  return j.includes("penguasaan anak") || j.includes("hak asuh") || j.includes("pembatalan perkawinan") || j.includes("ekonomi syariah") || j.includes("nafkah anak");
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

/**
 * I20 18 Okt: amar putusan yang mengabulkan UNTUK SEBAGIAN. Konservatif: harus ada "mengabulkan" dan salah satu dari "untuk sebagian" atau "menolak ... selain dan selebihnya /
 * selebihnya"; amar yang tidak memuatnya tidak ditebak. SIPP tidak menyimpan "kabul sebagian" sebagai status.
 */
export function kabulSebagianDariAmar(amar: unknown): boolean {
  const t = String(amar ?? "").replace(/\s+/g, " ");
  if (!/mengabulkan/i.test(t)) return false;
  return /untuk\s+sebagian/i.test(t) || /menolak[^;]{0,200}?(?:selain\s+dan\s+selebihnya|selebihnya)/i.test(t);
}

/** I17 18 Okt: kode kumulasi dari bot - larik kode atau {daftar:[{kode}|kode]}; hanya yang berbentuk kode. */
function kodeKumulasiKeadaan(kumulasi: unknown): string[] {
  const daftar: unknown[] = Array.isArray(kumulasi) ? kumulasi : kumulasi && typeof kumulasi === "object" && Array.isArray((kumulasi as { daftar?: unknown }).daftar) ? (kumulasi as { daftar: unknown[] }).daftar : [];
  return [
    ...new Set(
      daftar
        .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && typeof (x as { kode?: unknown }).kode === "string" ? (x as { kode: string }).kode : ""))
        .map((x) => x.trim().toLowerCase())
        .filter((x) => /^[a-z0-9-]{2,40}$/.test(x))
    ),
  ];
}

/**
 * I17 18 Okt: amar putusan yang mengabulkan itsbat nikah tetapi menolak perceraian. Konservatif: harus ada "mengabulkan ... itsbat/isbat/pengesahan ... nikah"
 * DAN "menolak ... (gugatan/permohonan) ... cerai/talak/perceraian" - keduanya; amar yang tidak memuatnya tidak ditebak.
 */
export function itsbatKabulCeraiDitolakDariAmar(amar: unknown): boolean {
  const t = String(amar ?? "").replace(/\s+/g, " ");
  if (!t) return false;
  const kabulItsbat = /mengabulkan[^;]{0,200}?(?:itsbat|isbat|istbat|pengesahan)\s+(?:nikah|perkawinan)/i.test(t);
  const tolakCerai = /menolak[^;]{0,200}?(?:cerai|talak|perceraian)/i.test(t);
  return kabulItsbat && tolakCerai;
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
  // I17 18 Okt: itsbat kontensius yang diputus verstek didahulukan atas "kontensius" ([01b] / [03b] folder 2a).
  if (hasil.includes("kontensius") && verstekAkhir) hasil.splice(hasil.indexOf("kontensius"), 0, "kontensius-verstek");
  // I22 18 Okt: itsbat kontensius dengan petitum pencairan dana -> [01c]; sesudah "kontensius-verstek" (verstek memakai [01b]) dan sebelum "kontensius".
  if (hasil.includes("kontensius") && m.pencairanDana === true) hasil.splice(hasil.indexOf("kontensius"), 0, "pencairan-dana");
  // I17 18 Okt: keadaan gugatan (cabut sesudah jawaban, NO formil, alamat T tidak diketahui, kumulasi). Hanya untuk gugatan: cerai, HB, waris, hak asuh
  // (369 Pdt.G / 349), pembatalan, wasiat, itsbat kontensius - permohonan (Pdt.P) tidak punya jawaban Tergugat.
  const kumulasiKode = kodeKumulasiKeadaan(m.kumulasi);
  const gugatan =
    jenisCerai(j) || j.includes("harta bersama") || j.includes("kewarisan") || jenisGugatanBaru(j) || jenisWasiat(j) || hakAsuh || (jenisItsbat(j) && /\/pdt\.g\//i.test(String(m.nomorPerkara ?? "")));
  const awalan: KodeKeadaanPutusan[] = [];
  if (gugatan) {
    // I19 18 Okt: eksepsi kewenangan (absolut / relatif) - dikabulkan (NO) atau ditolak dalam putusan sela; saklar tegas, tidak ditebak.
    const eksepsi = kecil(m.eksepsiKewenangan);
    if (eksepsi === "absolut" || eksepsi === "relatif") awalan.push(m.putusanSela === true ? `eksepsi-${eksepsi}-ditolak-putusan-sela` : `eksepsi-${eksepsi}-dikabulkan`);
    // Penanda tegas hakim/konseptor menang atas semua dugaan.
    if (m.kurangPihak === true) awalan.push("kurang-pihak");
    if (m.cacatFormil === true) awalan.push("cacat-formil");
    if (jenisCerai(j) && kumulasiKode.includes("itsbat-nikah") && (m.itsbatKabulCeraiDitolak === true || (m.itsbatKabulCeraiDitolak === undefined && itsbatKabulCeraiDitolakDariAmar(m.amarPutusan)))) {
      awalan.push("itsbat-kabul-cerai-ditolak");
    }
    // I19: pencabutan yang ditolak Tergugat sesudah jawaban - perkara diputus kabul; didahulukan atas "sesudah-jawaban".
    if (m.cabutDitolakT === true) awalan.push("cabut-ditolak-t");
    if (m.sesudahJawaban === true || m.cabutDitolakT === true || (m.sesudahJawaban === undefined && Number(m.penandaJawaban?.berkas) > 0)) awalan.push("sesudah-jawaban");
  }
  // I19: itsbat nikah permohonan (Pdt.P) - alasan NO / tolak alternatif; hanya dari saklar tegas.
  // I20: kabul sebagian dan penguasaan anak dialihkan - hanya gugatan penguasaan anak / hak asuh / nafkah anak (jenis lain tidak punya baris petanya).
  if (gugatan) {
    if (m.dikabulkanSebagian === true || (m.dikabulkanSebagian === undefined && kabulSebagianDariAmar(m.amarPutusan))) awalan.push("dikabulkan-sebagian");
  }
  if (j.includes("penguasaan anak") && m.penguasaanDialihkan === true) awalan.push("dialihkan");
  // I23 18 Okt: hak asuh (Lain-Lain Pdt.G) + nafkah anak: kode gabungan per kehadiran (satu kode per baris peta), didahulukan atas "hak-asuh*".
  if (hakAsuh && (m.plusNafkahAnak === true || (m.plusNafkahAnak === undefined && kumulasiKode.includes("nafkah-anak")))) {
    awalan.push(verstekAkhir ? "plus-nafkah-anak-verstek" : hasil.includes("t-tidak-hadir-setelah-mediasi") ? "plus-nafkah-anak-setelah-mediasi" : "plus-nafkah-anak");
  }
  // I22 18 Okt: PAW susunan dinamis, AUA anak sah perkawinan tercatat, cerai gugat kumulasi nafkah istri; hanya dari penanda (bot membaca petitum / saklar).
  if ((j.includes("ahli waris") || j.includes("p3hp")) && m.susunanAhliWaris === true) awalan.push("susunan-ahli-waris");
  if ((j.includes("asal usul") || j.includes("asal-usul")) && m.anakSahPerkawinanTercatat === true) awalan.push("anak-sah-perkawinan-tercatat");
  if (j.includes("cerai gugat") && m.kumulasiNafkahIstri === true) awalan.push(verstekAkhir ? "kumulasi-nafkah-istri-verstek" : "kumulasi-nafkah-istri");
  if (jenisItsbat(j) && !hasil.includes("kontensius")) {
    const alasan = kecil(m.alasanItsbat);
    if (alasan === "nikah-sesudah-2019-tidak-dicatat" || alasan === "poligami-sirri-atau-terikat" || alasan === "terikat-perkawinan-lain") awalan.push(alasan);
  }
  hasil.unshift(...awalan);
  if (gugatan && (m.alamatTergugatTidakDiketahui === true || m.penandaPerkara?.ghaib === true)) {
    // sesudah SEMA 1/2022 (kehadiran tercatat lebih tegas), sebelum keadaan jenis.
    const i = hasil.indexOf("sema-1-2022");
    hasil.splice(i >= 0 ? i + 1 : awalan.length, 0, "alamat-t-tidak-diketahui");
  }
  if (jenisCerai(j) && kumulasiKode.includes("itsbat-nikah")) hasil.push("kumulasi-itsbat");
  if (jenisCerai(j) && kumulasiKode.includes("hak-asuh-anak")) hasil.push("kumulasi-hak-asuh");
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
