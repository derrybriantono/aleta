"use strict";

/**
 * ============================================================================
 * MENERBITKAN DOKUMEN PENETAPAN DAN MENCATATKANNYA KE SIPP
 * ============================================================================
 *
 * Empat langkah, dan tiga di antaranya sudah ada sejak sebelum berkas ini:
 *
 *   1. BLANGKO diambil dari ABT - form PTSP pada blangko satker, dengan
 *      penanda @PMH, @PPP, @PJS, dan @PHS. Alamatnya DAPAT DISUNTING (lihat
 *      pengaturan), sebab ABT hanya ada di peladen dan alamatnya berbeda
 *      antar pemasangan.
 *   2. TANDA TANGAN dibubuhkan di atas nama penandatangannya - diambil dari
 *      tandaTanganService, dan HANYA yang sudah disahkan manusia.
 *   3. PDF diterbitkan dengan soffice - mesin yang sama yang sudah dipakai
 *      menerbitkan putusan dari ABT (abtCetakService).
 *   4. BERKASNYA disimpan ke folder resources SIPP, dan barisnya dicatat di
 *      perkara_dokumen_penetapan - tabel yang memang dibaca SIPP ketika
 *      petugas menekan ikon Cetak Dokumen pada tab Penetapan.
 *
 * ============================================================================
 * BENTUK BARIS SIPP DIBACA DARI BARIS SIPP SENDIRI
 * ============================================================================
 *
 * Diukur atas 3.336 baris yang sudah ada di basis data satker:
 *
 *   jenis_dokumen_id     1 PMH, 2 PPP, 3 PJS, 4 PHS - penomoran tabel ini
 *                        sendiri, tidak ada hubungannya dengan tabel
 *                        jenis_dokumen yang dipakai kepailitan
 *   perkara_penetapan_id menunjuk baris petugasnya, berbeda tabel tiap jenis:
 *                        PMH perkara_hakim_pn, PPP perkara_panitera_pn,
 *                        PJS perkara_jurusita, PHS perkara_penetapan_hari_sidang
 *   dokumen              resources/file/doc/YYYY/MM/<nomor>/<nomor>_Dokumen_<JENIS>_<epoch>.pdf
 *
 * Seluruh 3.336 berkasnya .pdf - tidak ada satu pun .rtf di sana, dan itu
 * sebabnya langkah ketiga tidak dapat dilewati.
 */

const fs = require("node:fs");
const path = require("node:path");

const db = require("../db_config");
const { readRuntimeConfig } = require("../config/runtime-config");
const abtCetakService = require("./abtCetakService");
const tandaTanganService = require("./tandaTanganService");
const sippSkemaService = require("./sippSkemaService");

/** Penomoran jenis dokumen milik perkara_dokumen_penetapan sendiri. */
const JENIS_DOKUMEN_ID = { pmh: 1, ppp: 2, pjs: 3, phs: 4 };

/** Tabel yang ditunjuk perkara_penetapan_id, berbeda tiap jenis. */
const TABEL_PENETAPAN = {
  pmh: "perkara_hakim_pn",
  ppp: "perkara_panitera_pn",
  pjs: "perkara_jurusita",
  phs: "perkara_penetapan_hari_sidang",
};

/**
 * Baris petugas yang ditunjuk perkara_penetapan_id - SEPERTI UNGGAHAN MANUAL
 * PETUGAS DI SIPP, diukur 6 Okt 2026 atas sipp_donggala:
 *
 *   PMH  baris perkara_hakim_pn ber-URUTAN 1 (ketua majelis / hakim tunggal):
 *        200 dari 200 unggahan terakhir menunjuk baris urutan 1; "id
 *        terbesar" (bentuk sebelum 6 Okt) hanya cocok 144 dari 902, sebab
 *        id terbesar adalah hakim anggota kedua.
 *   PPP, PJS, PHS  baris terbaru perkara itu (771/866, 771/784, 783/784 -
 *        sisanya baris yang diganti sesudah dokumennya diunggah).
 */
const KUERI_BARIS_PETUGAS = {
  pmh: "SELECT id FROM perkara_hakim_pn WHERE perkara_id = ? ORDER BY (urutan = 1) DESC, (aktif = 'Y') DESC, id DESC LIMIT 1",
  ppp: "SELECT id FROM perkara_panitera_pn WHERE perkara_id = ? ORDER BY id DESC LIMIT 1",
  pjs: "SELECT id FROM perkara_jurusita WHERE perkara_id = ? ORDER BY id DESC LIMIT 1",
  phs: "SELECT id FROM perkara_penetapan_hari_sidang WHERE perkara_id = ? ORDER BY id DESC LIMIT 1",
};

/** Bawaan alamat blangko ABT - dikosongkan, sebab ABT hanya ada di peladen. */
const BLANGKO_BAWAAN = {
  aktif: false,
  // {nomor} diganti nomor perkara, {nomorBersih} diganti bentuk tanpa tanda
  // baca. Dibiarkan kosong sampai disetel: alamat tebakan yang salah akan
  // memulangkan halaman galat ABT, dan halaman galat yang disimpan sebagai
  // penetapan jauh lebih buruk daripada penetapan yang tidak terbit.
  pmh: "",
  ppp: "",
  pjs: "",
  phs: "",
};

function pengaturanBlangko(runtimeConfig = readRuntimeConfig()) {
  const dari = (runtimeConfig && runtimeConfig.blangkoPenetapan) || {};
  const alamat = (kunci) => String(dari[kunci] ?? BLANGKO_BAWAAN[kunci] ?? "").trim();
  return {
    aktif: dari.aktif === true,
    pmh: alamat("pmh"),
    ppp: alamat("ppp"),
    pjs: alamat("pjs"),
    phs: alamat("phs"),
  };
}

function runQuery(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

/** "225/Pdt.P/2026/PA.Dgl" menjadi "225_PdtP_2026_PADgl", seperti SIPP menuliskannya. */
function nomorBersih(nomorPerkara) {
  return String(nomorPerkara || "")
    .replace(/\./g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dua(n) {
  return String(n).padStart(2, "0");
}

function waktuMysqlSekarang(saat = new Date()) {
  return (
    `${saat.getFullYear()}-${dua(saat.getMonth() + 1)}-${dua(saat.getDate())} ` +
    `${dua(saat.getHours())}:${dua(saat.getMinutes())}:${dua(saat.getSeconds())}`
  );
}

/**
 * Jalur berkas seperti yang ditulis SIPP sendiri.
 *
 * Tahun dan bulannya dari SAAT PENERBITAN, bukan dari tanggal penetapannya -
 * itu yang terbaca pada seluruh baris yang sudah ada, dan folder yang berbeda
 * dari kebiasaan SIPP akan membuat berkasnya tidak ketemu oleh alat lain yang
 * menyapu folder itu.
 */
function jalurDokumen(nomorPerkara, jenis, saat = new Date()) {
  const bersih = nomorBersih(nomorPerkara);
  const epoch = Math.floor(saat.getTime() / 1000);
  const berkas = `${bersih}_Dokumen_${jenis.toUpperCase()}_${epoch}.pdf`;
  return `resources/file/doc/${saat.getFullYear()}/${dua(saat.getMonth() + 1)}/${bersih}/${berkas}`;
}

/**
 * ============================================================================
 * MEMBUBUHKAN TANDA TANGAN KE DALAM RTF
 * ============================================================================
 *
 * Gambar RTF ditulis sebagai kelompok {\pict ...} berisi heksadesimal isinya.
 * Yang dikerjakan di sini menyisipkan kelompok itu tepat SEBELUM baris nama
 * penandatangan - di situlah ruang tanda tangan pada seluruh blangko penetapan.
 *
 * Namanya dicari sesudah dibakukan huruf dan angkanya saja: blangko ABT
 * menuliskan nama dengan huruf besar seluruhnya pada sebagian tempat dan
 * dengan gelar bertitik pada tempat lain, sedangkan SIPP menuliskannya lagi
 * dengan cara ketiga.
 *
 * Bila namanya TIDAK ketemu, tanda tangannya tidak dibubuhkan dan sebabnya
 * dipulangkan. Membubuhkannya di tempat lain - di akhir berkas, misalnya -
 * menghasilkan penetapan yang tanda tangannya melayang entah di mana, dan itu
 * lebih buruk daripada penetapan tanpa tanda tangan yang dapat ditandatangani
 * dengan tangan.
 */
function sisipkanTandaTangan(rtf, { isi, jenis, namaPejabat, lebarTwip = 1700, tinggiTwip = 800 }) {
  const teks = String(rtf || "");
  if (!isi || !isi.length) return { ok: false, alasan: "gambar_kosong" };

  const cariBaku = tandaTanganService.bakuNama(namaPejabat);
  if (!cariBaku) return { ok: false, alasan: "nama_pejabat_kosong" };

  // Nama di dalam RTF terpotong-potong oleh kendali gaya. Yang disapu karena
  // itu bukan untainya, melainkan posisi tiap huruf namanya berurutan.
  const posisi = cariPosisiNama(teks, cariBaku);
  if (posisi < 0) return { ok: false, alasan: "nama_pejabat_tidak_ada_di_blangko" };

  // Paragraf tempat namanya berada - disisipkan di pembukanya.
  const pembuka = teks.lastIndexOf("\\par", posisi);
  const titikSisip = pembuka >= 0 ? pembuka : posisi;

  const jenisRtf = String(jenis).toLowerCase() === "jpg" ? "jpegblip" : "pngblip";
  const gambar =
    `{\\pict\\${jenisRtf}\\picwgoal${Math.round(lebarTwip)}\\pichgoal${Math.round(tinggiTwip)} ` +
    `${Buffer.from(isi).toString("hex")}}\\par `;

  return { ok: true, rtf: `${teks.slice(0, titikSisip)}${gambar}${teks.slice(titikSisip)}` };
}

/**
 * Posisi huruf pertama nama di dalam RTF, mengabaikan kendali di antaranya.
 *
 * Dikerjakan begini karena RTF memotong kata kapan saja: "Abdul Salam" dapat
 * tertulis "Abdul Sa{\b1 lam}" tanpa mengubah tampilannya sedikit pun, dan
 * pencarian untai biasa tidak akan pernah menemukannya.
 */
function cariPosisiNama(rtf, namaBaku) {
  if (!namaBaku) return -1;

  const huruf = [];
  let i = 0;
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === "\\") {
      const m = /^\\[a-zA-Z]+-?\d* ?/.exec(rtf.slice(i));
      i += m ? m[0].length : 2;
      continue;
    }
    if (c === "{" || c === "}") {
      i += 1;
      continue;
    }
    if (/[A-Za-z0-9]/.test(c)) huruf.push({ c: c.toLowerCase(), di: i });
    i += 1;
  }

  const untai = huruf.map((x) => x.c).join("");
  const ketemu = untai.indexOf(namaBaku);
  return ketemu < 0 ? -1 : huruf[ketemu].di;
}

/**
 * Mengambil blangko penetapan dari ABT.
 *
 * Alamatnya dari pengaturan, dan {nomor} serta {nomorBersih} di dalamnya
 * diganti nomor perkaranya. Yang dipulangkan RTF apa adanya - ABT yang
 * menyusun isinya, dan ALETA tidak menulis satu kalimat pun penetapan.
 */
async function ambilBlangko(jenis, nomorPerkara, { batasMs = 30000 } = {}) {
  const atur = pengaturanBlangko();
  if (!atur.aktif) return { ok: false, alasan: "blangko_belum_dinyalakan" };

  const pola = atur[String(jenis).toLowerCase()] || "";
  if (!pola) return { ok: false, alasan: `alamat_blangko_${jenis}_belum_disetel` };

  const alamat = pola
    .replace(/\{nomor\}/g, encodeURIComponent(String(nomorPerkara || "")))
    .replace(/\{nomorBersih\}/g, encodeURIComponent(nomorBersih(nomorPerkara)));

  const pembatal = new AbortController();
  const jam = setTimeout(() => pembatal.abort(), batasMs);
  try {
    const jawab = await fetch(alamat, { signal: pembatal.signal });
    if (!jawab.ok) return { ok: false, alasan: `abt_menjawab_${jawab.status}`, alamat };

    const isi = Buffer.from(await jawab.arrayBuffer());

    // ABT menjawab HTML ketika sesinya habis atau blangkonya tidak ketemu, dan
    // halaman galat yang disimpan sebagai penetapan jauh lebih buruk daripada
    // penetapan yang tidak terbit.
    const awal = isi.subarray(0, 16).toString("latin1");
    if (!awal.startsWith("{\\rtf")) {
      return { ok: false, alasan: "jawaban_abt_bukan_rtf", alamat, awal: awal.slice(0, 16) };
    }
    return { ok: true, rtf: isi.toString("latin1"), alamat, ukuran: isi.length };
  } catch (galat) {
    return { ok: false, alasan: "abt_tidak_terjangkau", pesan: String((galat && galat.message) || galat).slice(0, 200) };
  } finally {
    clearTimeout(jam);
  }
}

/**
 * Folder SIPP yang dicoba bila pengaturannya kosong.
 *
 * Nilainya sengaja SAMA dengan ALETA_BOT_SIPP_DOCUMENT_ROOTS (sippDocumentService
 * b.17-24): folder yang dipakai membaca gugatan adalah folder yang sama dengan
 * yang dipakai menulis putusan, dan menyebutnya dua kali dengan nilai berbeda
 * hanya menunggu salah satunya basi.
 */
const AKAR_SIPP_CADANGAN = String(
  process.env.ALETA_BOT_SIPP_DOCUMENT_ROOTS ||
    process.env.ALETA_BOT_SIPP_DOCUMENT_ROOT ||
    "/var/www/html/SIPP,/usr/src/app/SIPP"
)
  .split(/[;,]/)
  .map((x) => x.trim())
  .filter(Boolean);

/**
 * Akar folder resources SIPP - tempat berkasnya benar-benar ditulis.
 *
 * Dari pengaturan, sebab letak SIPP berbeda antara peladen dan pemasangan
 * setempat. Tanpa itu, satu-satunya jalan adalah menebak - dan berkas yang
 * ditulis ke folder yang keliru tercatat di basis data sebagai ada padahal
 * tidak pernah dapat dibuka.
 */
function akarSipp(runtimeConfig = readRuntimeConfig()) {
  const dari = (runtimeConfig && runtimeConfig.blangkoPenetapan) || {};
  const disetel = String(dari.akarSipp || process.env.ALETA_SIPP_ROOT || "").trim();
  if (disetel) return disetel;

  // ==========================================================================
  // CADANGAN: FOLDER YANG MEMANG SUDAH TERPASANG
  // ==========================================================================
  //
  // Sampai 23 September 2026 tidak ada cadangan sama sekali, dan akibatnya
  // terukur: pada peladen satker blangkoPenetapan bernilai null, sehingga
  // seluruh unggahan putusan berhenti pada kalimat "akar_sipp_belum_disetel"
  // - satu pengaturan yang tidak pernah muncul di layar mana pun, dan yang
  // tidak seorang pun tahu harus diisi.
  //
  // Padahal folder SIPP-nya SUDAH terpasang di container, dan alamatnya sudah
  // disebut oleh pengaturan yang lain: ALETA_BOT_SIPP_DOCUMENT_ROOTS. Yang
  // dipakai untuk membaca gugatan adalah folder yang sama dengan yang dipakai
  // untuk menulis putusan.
  //
  // Cadangannya TIDAK menebak: hanya folder yang benar-benar ada yang
  // dipulangkan. Folder yang tidak ada tetap menghasilkan "belum disetel",
  // sebab menulis ke folder yang keliru mencatat berkas sebagai ada padahal
  // tidak pernah dapat dibuka - persis yang dihindari keterangan di atas.
  for (const calon of AKAR_SIPP_CADANGAN) {
    try {
      if (fs.existsSync(calon) && fs.statSync(calon).isDirectory()) return calon;
    } catch {
      // Folder yang tidak dapat diperiksa dilewati, bukan dipakai.
    }
  }
  return "";
}

/**
 * Keadaan akar SIPP: ada atau tidak, dan DAPAT DITULIS atau tidak.
 *
 * Dipisahkan dari akarSipp supaya kegagalan dapat menyebut sebab yang
 * sesungguhnya. Tanpa ini, folder yang terpasang read-only menghasilkan
 * "berkas_tidak_dapat_ditulis - EROFS" di layar petugas: benar secara teknis,
 * dan tidak berguna sama sekali bagi orang yang harus memperbaikinya.
 *
 * Mount read-only itu bukan kekeliruan, melainkan keputusan yang tercatat di
 * docker-compose.yml: bot hanya MEMBACA SIPP. Unggah putusan mengubah
 * keputusan itu untuk dua folder saja - resources/file/doc dan
 * resources/file/anonimisasi - dan pesan di sini yang menyebutkannya.
 */
function periksaAkarSipp(runtimeConfig = readRuntimeConfig(), { relatif = "" } = {}) {
  const akar = akarSipp(runtimeConfig);
  if (!akar) {
    return {
      akar: "",
      ada: false,
      dapatDitulis: false,
      alasan: "akar_sipp_belum_disetel",
      pesan:
        "Folder SIPP belum diketahui. Setel blangkoPenetapan.akarSipp di pengaturan ALETA, " +
        "atau pasang folder SIPP ke container (ALETA_BOT_SIPP_DOCUMENT_ROOTS).",
    };
  }

  let ada = false;
  try {
    ada = fs.existsSync(akar) && fs.statSync(akar).isDirectory();
  } catch {
    ada = false;
  }
  if (!ada) {
    return {
      akar,
      ada: false,
      dapatDitulis: false,
      alasan: "akar_sipp_tidak_ada",
      pesan: `Folder SIPP "${akar}" tidak ada dari dalam container. Periksa mount-nya di docker-compose.yml.`,
    };
  }

  // ==========================================================================
  // YANG DIPERIKSA FOLDER TUJUANNYA, BUKAN AKARNYA
  // ==========================================================================
  //
  // Akar SIPP memang terpasang HANYA-BACA, dan memang seharusnya begitu:
  // membuka seluruh pohon SIPP untuk ditulis berarti satu kekeliruan kode
  // dapat menyentuh basis berkas perkara yang tidak ada hubungannya dengan
  // putusan. Yang dibuka untuk ditulis hanya dua folder - resources/file/doc
  // dan resources/file/anonimisasi.
  //
  // Memeriksa W_OK pada AKARNYA karena itu selalu gagal, dan unggahan akan
  // berhenti pada "hanya baca" selama-lamanya - walau folder tujuannya justru
  // sudah dapat ditulis. Dibuktikan di container peladen:
  //
  //     [ -w /usr/src/app/SIPP ] -> HANYA BACA        (memang disengaja)
  //     [ -w /usr/src/app/SIPP/resources/file/doc ]   (inilah yang menentukan)
  //
  // Yang diperiksa: leluhur TERDEKAT yang sudah ada dari jalur tujuannya.
  // Folder tahun dan bulan memang belum ada sebelum berkas pertama ditulis,
  // dan ketiadaannya bukan keadaan yang salah - ia dibuat mkdirSync.
  const jalurUji = relatif ? path.join(akar, relatif) : akar;
  let leluhur = jalurUji;
  while (leluhur && leluhur !== path.dirname(leluhur) && !fs.existsSync(leluhur)) {
    leluhur = path.dirname(leluhur);
  }
  let dapatDitulis = false;
  try {
    fs.accessSync(leluhur, fs.constants.W_OK);
    dapatDitulis = true;
  } catch {
    dapatDitulis = false;
  }
  if (!dapatDitulis) {
    return {
      akar,
      ada: true,
      dapatDitulis: false,
      alasan: "akar_sipp_hanya_baca",
      pesan:
        `Folder SIPP "${leluhur}" terpasang hanya-baca, jadi berkasnya tidak dapat ditulis. ` +
        "Pada docker-compose.yml, tambahkan mount yang dapat ditulis untuk " +
        "resources/file/doc dan resources/file/anonimisasi (tanpa :ro), lalu jalankan ulang container bot.",
    };
  }

  return { akar, ada: true, dapatDitulis: true, alasan: "", pesan: "" };
}

/**
 * Menyamakan pemilik dan izin berkas dengan yang dibuat SIPP sendiri.
 *
 * Bot berjalan sebagai root, sedangkan seluruh isi resources/file milik uid 48
 * (apache) dengan izin 0750. Berkas bikinan root akan tercatat benar di basis
 * data tetapi tidak dapat dibaca proses SIPP-nya - dan gejalanya persis sama
 * dengan berkas yang tidak pernah tertulis: tombol cetak yang berujung galat.
 *
 * Sengaja SEBISANYA: kegagalannya tidak membatalkan unggahan, sebab pada
 * pemasangan yang tidak memakai uid 48 berkasnya memang sudah benar apa adanya.
 */
function samakanPemilikSipp(jalurPenuh, akar) {
  try {
    // Ditiru dari folder yang MEMUATNYA, bukan dari akar SIPP. Akar dan
    // resources/file dapat berbeda pemilik pada pemasangan yang folder
    // putusannya dipasang terpisah - dan justru pemasangan seperti itulah
    // yang dipakai peladen ini.
    const induk = fs.statSync(path.dirname(jalurPenuh));
    fs.chownSync(jalurPenuh, induk.uid, induk.gid);
    // Izin berkas ditiru dari foldernya, dikurangi bit "dapat dijalankan" -
    // berkas putusan bukan program. Mengunci ke satu angka tetap membuat
    // pemasangan yang folder resources/file-nya lebih longgar tidak dapat
    // membaca berkas bikinan ALETA, dan gejalanya sama persis dengan berkas
    // yang tidak pernah tertulis.
    fs.chmodSync(jalurPenuh, induk.mode & 0o666);
  } catch {
    // Tidak menggagalkan apa pun.
  }
}

/**
 * Menyimpan berkasnya dan mencatat barisnya di SIPP.
 *
 * Berkas DAHULU, baris sesudahnya. Baris yang menunjuk berkas yang tidak ada
 * membuat SIPP menawarkan tombol cetak yang berujung galat; berkas tanpa baris
 * hanya menjadi berkas yang tidak terpakai, dan itu jauh lebih ringan.
 */
async function simpanKeSipp({ perkaraId, nomorPerkara, jenis, pdf, olehUsername, saat = new Date() }) {
  const kunci = String(jenis || "").toLowerCase();
  const jenisId = JENIS_DOKUMEN_ID[kunci];
  if (!jenisId) return { ok: false, alasan: "jenis_tidak_didukung" };

  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, alasan: "perkara_tidak_sah" };
  if (!pdf || !pdf.length) return { ok: false, alasan: "pdf_kosong" };
  // Penetapan PMH/PPP/PJS/PHS SELALU PDF (pengguna 6 Okt 2026: "penetapan
  // pmh, ppp, pjs dan phs harus pdf"). Satu-satunya pintu tulis ke e-Doc
  // penetapan SIPP menolak apa pun yang kepalanya bukan %PDF- - RTF/DOCX yang
  // lolos ke sini akan tersimpan berakhiran .pdf dan tidak dapat dibuka SIPP.
  if (!Buffer.from(pdf).subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
    return { ok: false, alasan: "bukan_pdf" };
  }
  if (!(await sippSkemaService.tabelAda("perkara_dokumen_penetapan"))) {
    return { ok: false, alasan: "tabel_dokumen_penetapan_tidak_ada" };
  }

  const keadaanAkar = periksaAkarSipp(undefined, { relatif: "resources/file/doc" });
  if (!keadaanAkar.dapatDitulis) {
    return { ok: false, alasan: keadaanAkar.alasan, pesan: keadaanAkar.pesan };
  }
  const akar = keadaanAkar.akar;

  const relatif = jalurDokumen(nomorPerkara, kunci, saat);
  const penuh = path.join(akar, relatif);

  try {
    fs.mkdirSync(path.dirname(penuh), { recursive: true });
    fs.writeFileSync(penuh, pdf);
  } catch (galat) {
    return { ok: false, alasan: "berkas_tidak_dapat_ditulis", pesan: String(galat.message || galat).slice(0, 200) };
  }

  // Baris petugas yang ditunjuk perkara_penetapan_id - dibaca dari tabelnya
  // masing-masing, yang berbeda tiap jenis (KUERI_BARIS_PETUGAS).
  const barisPetugas = await runQuery(KUERI_BARIS_PETUGAS[kunci], [id]).catch(() => []);
  const penetapanId = Number((Array.isArray(barisPetugas) && barisPetugas[0] && barisPetugas[0].id) || 0);
  if (!penetapanId) return { ok: false, alasan: `baris_${kunci}_belum_ada_di_sipp` };

  await runQuery(
    `INSERT INTO perkara_dokumen_penetapan
       (perkara_id, perkara_penetapan_id, is_penetapan_kembali, jenis_dokumen_id,
        nama_dokumen, dokumen, diinput_oleh, diinput_tanggal)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      penetapanId,
      1,
      jenisId,
      kunci.toUpperCase(),
      relatif,
      String(olehUsername || "").slice(0, 30),
      waktuMysqlSekarang(saat),
    ]
  );

  return { ok: true, jalur: relatif, jalurPenuh: penuh, perkaraPenetapanId: penetapanId, ukuran: pdf.length };
}

/**
 * Seluruh rantainya untuk satu penetapan.
 *
 * KERING sebagai bawaan, sama seperti menulis penetapan: yang lupa menyebut
 * { kering: false } menerima laporan langkahnya - blangko terbaca berapa bita,
 * tanda tangan siapa yang akan dibubuhkan - tanpa satu berkas pun ditulis.
 */
async function terbitkan({ perkaraId, nomorPerkara, jenis, namaPenandatangan, olehUsername, kering = true }) {
  const kunci = String(jenis || "").toLowerCase();
  if (!JENIS_DOKUMEN_ID[kunci]) return { ok: false, alasan: "jenis_tidak_didukung" };

  const blangko = await ambilBlangko(kunci, nomorPerkara);
  if (!blangko.ok) return { ...blangko, langkah: "blangko" };

  const ttd = await tandaTanganService.untukPejabat(namaPenandatangan);
  if (!ttd) {
    // Disebut TEGAS, bukan diterbitkan tanpa tanda tangan diam-diam: yang
    // membaca penetapan tanpa tanda tangan akan menyangka berkasnya rusak.
    return {
      ok: false,
      langkah: "tanda_tangan",
      alasan: "tanda_tangan_belum_disahkan",
      namaPenandatangan,
    };
  }

  const dibubuhi = sisipkanTandaTangan(blangko.rtf, {
    isi: ttd.isi,
    jenis: ttd.jenis,
    namaPejabat: ttd.namaPejabat,
  });
  if (!dibubuhi.ok) return { ...dibubuhi, langkah: "tanda_tangan" };

  if (kering) {
    return {
      ok: true,
      kering: true,
      langkah: "kering",
      blangko: { alamat: blangko.alamat, ukuran: blangko.ukuran },
      tandaTangan: { id: ttd.id, namaPejabat: ttd.namaPejabat },
      ukuranRtf: dibubuhi.rtf.length,
      jalurDirencanakan: jalurDokumen(nomorPerkara, kunci),
    };
  }

  const pdf = await abtCetakService.rtfKePdf(Buffer.from(dibubuhi.rtf, "latin1"));
  if (!pdf.ok) return { ok: false, langkah: "pdf", alasan: pdf.alasan };

  const simpan = await simpanKeSipp({
    perkaraId,
    nomorPerkara,
    jenis: kunci,
    pdf: pdf.pdf,
    olehUsername,
  });
  if (!simpan.ok) return { ...simpan, langkah: "simpan" };

  return {
    ok: true,
    langkah: "selesai",
    jalur: simpan.jalur,
    perkaraPenetapanId: simpan.perkaraPenetapanId,
    tandaTangan: { id: ttd.id, namaPejabat: ttd.namaPejabat },
    ukuran: simpan.ukuran,
  };
}

module.exports = {
  JENIS_DOKUMEN_ID,
  TABEL_PENETAPAN,
  KUERI_BARIS_PETUGAS,
  BLANGKO_BAWAAN,
  pengaturanBlangko,
  nomorBersih,
  jalurDokumen,
  cariPosisiNama,
  sisipkanTandaTangan,
  ambilBlangko,
  akarSipp,
  periksaAkarSipp,
  samakanPemilikSipp,
  simpanKeSipp,
  terbitkan,
};
