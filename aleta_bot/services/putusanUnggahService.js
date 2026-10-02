"use strict";

/**
 * ============================================================================
 * MENGUNGGAH PUTUSAN AKHIR DAN ANONIMISASINYA KE SIPP
 * ============================================================================
 *
 * Dua berkas yang selama ini diunggah satu per satu lewat tingkap "Kelola
 * Dokumen Elektronik (E-Doc)" SIPP: putusan akhir dan putusan anonimisasi.
 * Keduanya berasal dari naskah yang sama, dikerjakan pada menit yang sama, dan
 * mengisi kolom yang bersebelahan - tetapi menuntut dua kali buka tingkap,
 * dua kali pilih berkas, dua kali tunggu.
 *
 * ============================================================================
 * YANG DIKERJAKAN DI SINI MENIRU SIPP, BUKAN MENGARANG
 * ============================================================================
 *
 * Seluruh langkahnya disalin dari kode SIPP sendiri - dibaca, bukan ditebak:
 *
 *   controllers/fileupload_putusan_c.php   nama berkas dan letak foldernya
 *   helpers/convert_helper.php             _convert_insert_put
 *   models/api/dirput_model.php            convert_insert, insert_antrian_upload
 *   models/api/convert_insert_m.php        get_ref_dirput_putusan
 *
 * Itu sengaja. Baris yang ditulis dengan bentuk yang berbeda dari buatan SIPP
 * akan lolos hari ini dan gagal pada hari Direktori Putusan menyinkronkannya -
 * jauh sesudah tidak ada lagi yang ingat siapa yang menulisnya.
 *
 * ============================================================================
 * YANG SENGAJA TIDAK DITULIS: dirput_perkara
 * ============================================================================
 *
 * Tabel itu memuat putusan_id dan link_dirput - keduanya diberikan Direktori
 * Putusan Mahkamah Agung SESUDAH putusannya benar-benar terbit di sana, dan
 * keduanya berbentuk kunci buram ("zaf1a5d59aafb..."). SIPP sendiri tidak
 * menulisnya saat mengunggah; ia menunggu sinkronisasi.
 *
 * Mengarang kunci itu berarti menaruh pengenal palsu pada perkara yang kelak
 * benar-benar terbit, dan sinkronisasinya akan menautkannya ke putusan orang
 * lain. Yang ditulis di sini berhenti tepat di tempat SIPP berhenti: berkas,
 * kolom dokumennya, baris dirput_dokumen, dan antrean.
 *
 * ============================================================================
 * DUA BERKAS UNTUK SATU NASKAH - DAN ITULAH YANG DULU DICAMPUR
 * ============================================================================
 *
 * SIPP menyimpan DUA berkas dari satu unggahan, dan keduanya berbeda:
 *
 *   e-Doc              berkas ASLI apa adanya  -> kolom perkara_putusan
 *   Direktori Putusan  PDF hasil konversi      -> baris dirput_dokumen
 *
 * fileupload_putusan_c.php mengambil ekstensi ASLI lewat pathinfo dan
 * menyimpannya begitu saja - tanpa allowed_types, tanpa atribut accept pada
 * pemilih berkasnya. PDF-nya baru lahir kemudian, di convert_helper.php,
 * lewat soffice pada Linux atau COM Word pada Windows.
 *
 * Sampai 2.32.0 berkas ini menolak apa pun yang bukan PDF, dengan alasan
 * "ALETA tidak menjalankan pengubah itu". Kedua bagian alasan itu salah:
 *
 *   1. ALETA SUDAH punya pengubahnya sejak lama - abtCetakService, dengan
 *      folder sekali pakai, profil soffice tersendiri, batas 20 MB, batas 90
 *      detik, dan hasil yang diperiksa harus diawali "%PDF-".
 *
 *   2. Yang lazim dipakai satker justru BUKAN PDF. Diukur pada
 *      perkara_putusan.amar_putusan_dok, 9.903 nilai terisi:
 *
 *          .rtf   8.686  (87,7%)      .doc     442
 *          .docx    458               .pdf     315  (3,2%)
 *
 *      Sementara dirput_dokumen, 19.847 baris: .pdf 19.820 (99,86%).
 *      Ke-26 baris .rtf di sana adalah bekas konversi yang GAGAL, bukan pola.
 *
 * Jadi syarat PDF itu benar untuk Direktori Putusan dan salah untuk e-Doc -
 * dan menerapkannya pada keduanya menolak 96,8% naskah yang sah.
 *
 * ============================================================================
 * URUTANNYA: UBAH DULU, BARU TULIS
 * ============================================================================
 *
 * Ketakutan yang tertulis di catatan lama - "pengubahan yang gagal separuh
 * meninggalkan berkas rusak yang barisnya sudah terlanjur tercatat" - benar,
 * dan dijawab oleh URUTAN, bukan oleh penolakan.
 *
 * PDF-nya dibuat utuh di MEMORI lebih dulu. Baru sesudah ia terbukti diawali
 * "%PDF-", satu pun berkas ditulis ke cakram dan satu pun baris ditulis ke
 * basis data. Tidak ada keadaan separuh jalan.
 *
 * Bila soffice tidak ada di container, e-Doc TETAP tersimpan dan baris
 * Direktori Putusan DITUNDA beserta sebabnya - persis urutan SIPP, yang juga
 * menyimpan berkasnya lebih dulu dan mengubah kemudian. Menolak seluruh
 * unggahan karena pengubahnya belum terpasang berarti menahan pekerjaan yang
 * sebenarnya sudah dapat diselesaikan separuh.
 */

const fs = require("node:fs");
const path = require("node:path");

const db = require("../db_config");
const sippSkemaService = require("./sippSkemaService");
const dokumenPenetapanService = require("./dokumenPenetapanService");
// Pengubah RTF/DOC/DOCX menjadi PDF, beserta pengenal jenis dari bita
// berkasnya. Sudah dipakai dokumenPenetapanService sejak lama; lihat catatan
// di kepala berkas ini tentang mengapa unggah putusan baru memakainya.
const abtCetakService = require("./abtCetakService");

/** urutan pada dirput_dokumen_ref - 99 putusan akhir, 100 anonimisasi. */
const URUTAN_REF = { putusan: 99, anonimisasi: 100 };

/** Akhiran nama berkas, persis seperti yang ditulis SIPP. */
const AKHIRAN = { putusan: "putusan_akhir", anonimisasi: "putusan_anonimisasi" };

/** Folder di bawah resources/file. */
const FOLDER = { putusan: "doc", anonimisasi: "anonimisasi" };

/** Kolom perkara_putusan yang menyimpan jalurnya. */
const KOLOM_DOK = {
  putusan: "amar_putusan_dok",
  anonimisasi: "amar_putusan_anonimisasi_dok",
};

function runQuery(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

function duaAngka(n) {
  return String(n).padStart(2, "0");
}

function waktuMysql(saat = new Date()) {
  return (
    `${saat.getFullYear()}-${duaAngka(saat.getMonth() + 1)}-${duaAngka(saat.getDate())} ` +
    `${duaAngka(saat.getHours())}:${duaAngka(saat.getMinutes())}:${duaAngka(saat.getSeconds())}`
  );
}

/**
 * Nama berkas menurut aturan SIPP.
 *
 * fileupload_putusan_c.php memecah nomor perkara pada garis miring lalu
 * menyusunnya TERBALIK:
 *
 *   492/Pdt.G/2026/PA.Dgl  ->  PA.Dgl_2026_Pdt.G_492_putusan_akhir.pdf
 *
 * Spasi diganti garis bawah, sama seperti di sana. Nomor yang bagiannya tidak
 * genap empat ditolak - menyusun nama dari nomor yang bentuknya lain
 * menghasilkan berkas yang tidak akan pernah ditemukan Direktori Putusan.
 */
function namaBerkas(nomorPerkara, jenis, ekstensi = "pdf") {
  const bagian = String(nomorPerkara || "").split("/");
  if (bagian.length !== 4 || bagian.some((x) => !x.trim())) return "";
  const akhiran = AKHIRAN[jenis];
  if (!akhiran) return "";
  // Ekstensi dibatasi pada yang dikenali - nama berkas yang ekstensinya
  // datang apa adanya dari luar adalah jalan masuk bagi nama yang menembus
  // folder ("../"), dan yang ditulis di sini berada di dalam cakram SIPP.
  const ext = /^[a-z0-9]{1,5}$/i.test(String(ekstensi)) ? String(ekstensi).toLowerCase() : "pdf";
  return `${bagian[3]}_${bagian[2]}_${bagian[1]}_${bagian[0]}_${akhiran}.${ext}`.replace(/ /g, "_");
}

/**
 * Letak foldernya - dari TANGGAL PUTUSAN, bukan tanggal hari ini.
 *
 * SIPP memakai tanggal putusan (get_tgl_putusan), dan Direktori Putusan
 * mencari berkasnya di folder tahun/bulan putusan itu. Memakai tanggal hari
 * ini membuat putusan bulan lalu yang diunggah hari ini tersimpan di folder
 * yang salah - barisnya benar, berkasnya ada, dan tetap tidak ketemu.
 */
function jalurRelatif(nomorPerkara, jenis, tanggalPutusan, ekstensi = "pdf") {
  const berkas = namaBerkas(nomorPerkara, jenis, ekstensi);
  if (!berkas) return "";
  const tgl = String(tanggalPutusan || "").slice(0, 10).split("-");
  if (tgl.length < 2 || !tgl[0] || !tgl[1]) return "";
  return `resources/file/${FOLDER[jenis]}/${tgl[0]}/${tgl[1]}/${berkas}`;
}

/**
 * dokumen_ref_id untuk perkara ini.
 *
 * Bukan angka tetap: ia bergantung alur perkaranya. Pada perkara 492 nilainya
 * 89 untuk putusan akhir dan 79 untuk anonimisasi; pada alur lain berbeda.
 * Kueri ini disalin apa adanya dari convert_insert_m::get_ref_dirput_putusan.
 */
async function dokumenRefId(perkaraId, jenis) {
  const urutan = URUTAN_REF[jenis];
  if (!urutan) return 0;
  const baris = await runQuery(
    `SELECT b.dokumen_ref_id AS ref
       FROM perkara AS a
       LEFT JOIN dirput_dokumen_ref AS b ON a.alur_perkara_id = b.alur_perkara_id
      WHERE b.urutan = ? AND a.perkara_id = ?`,
    [urutan, perkaraId]
  ).catch(() => []);
  return Number((Array.isArray(baris) && baris[0] && baris[0].ref) || 0);
}

/**
 * ============================================================================
 * BARIS AUDIT SIPP: BENTUK SIPP SENDIRI, PELAKUNYA PETUGAS YANG LOGIN
 * ============================================================================
 *
 * Keputusan pengguna 2 Oktober 2026 (butir 14, kontrak K4) membalik keputusan
 * orkestrator 25 September: di SIPP/ABT/e-Court TIDAK BOLEH ada tanda ALETA -
 * baik di tampilan maupun di kolom audit/keterangan sistem mereka. Tindakan
 * dikerjakan atas perintah petugas yang sedang login SIPP, jadi yang tercatat
 * di sys_audittrail adalah PETUGAS ITU SENDIRI - bukan nama lain, bukan
 * tanggal karangan - dalam bentuk yang ditulis modul unggah e-Doc SIPP:
 *
 *   username     akun SIPP petugas yang memicu (lihat akunSippPemicu)
 *   datetime     jam dinding saat kolom itu ditulis - tidak digeser
 *   ipaddress    alamat peramban petugas (IPv4 sah, selain itu kosong)
 *   formname     "UPLOAD E-DOCS PUTUSAN AKHIR" / "... PUTUSAN ANONIMISASI"
 *   action       "UNGGAH"
 *   title        "Unggah Dokumen Putusan Akhir <br />dengan perkara_id [id=N]"
 *   description  tabel Nama Kolom / Nilai, seperti keteranganAudit penetapan
 *
 * Bentuk putusan akhir TERUKUR pada sys_audittrail satker (18 Sep 2026: baris
 * 500582 "perkara_putusan UNGGAH" oleh petugas yang sama, terpisah dari baris
 * "tambah"). Bentuk anonimisasi DISIMPULKAN dari judul tingkap SIPP
 * (fileupload_putusan_c.php: $title = 'PUTUSAN ANONIMISASI') - pastikan pada
 * satker sebelum dianggap pasti:
 *
 *   SELECT formname, action, title FROM sys_audittrail
 *    WHERE tablename = 'perkara_putusan' AND formname LIKE 'UPLOAD E-DOCS%'
 *    ORDER BY datetime DESC LIMIT 20;
 *
 * dirput_dokumen dan dirput_antrian TIDAK diberi baris audit SIPP - SIPP
 * sendiri tidak mengaudit keduanya saat mengunggah (insert_antrian_upload,
 * convert_insert). Tulisannya TIDAK hilang dari pertanggungjawaban: seluruh
 * tabel yang disentuh, akun SIPP, IP, waktu, dan "lewat ALETA" tercatat utuh
 * di aleta_bot_jejak_penetapan (jejakAletaService, layar Riwayat ALETA),
 * termasuk unggahan yang GAGAL.
 */
const BORANG_UNGGAH = {
  putusan: { formname: "UPLOAD E-DOCS PUTUSAN AKHIR", judul: "Unggah Dokumen Putusan Akhir" },
  anonimisasi: { formname: "UPLOAD E-DOCS PUTUSAN ANONIMISASI", judul: "Unggah Dokumen Putusan Anonimisasi" },
};
const AKSI_UNGGAH = "UNGGAH";

/**
 * Nilai di description di-escape: layar Audit Trail SIPP menampilkannya
 * sebagai HTML, dan jalurnya datang dari luar berkas ini.
 */
function lolosHtml(nilai) {
  return String(nilai === undefined || nilai === null ? "" : nilai)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Alamat untuk kolom ipaddress (varchar(15)): hanya IPv4 yang sah. Alamat lain
 * DIKOSONGKAN, bukan dipotong - IPv6 yang terpotong pada huruf ke-15 menjadi
 * alamat lain yang keliru.
 */
function ipAudit(ip) {
  const bersih = String(ip || "").trim().replace(/^::ffff:/, "");
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(bersih)) return "";
  return bersih.split(".").every((x) => Number(x) <= 255) ? bersih : "";
}

/** Kolom dan nilai yang ditulis - bentuk tabel audit SIPP, tanpa kalimat tambahan. */
function deskripsiAudit(rincian) {
  const baris = Object.entries(rincian || {})
    .map(([kolom, nilai]) => `<tr><td>${lolosHtml(kolom)}</td><td>${lolosHtml(nilai)}</td></tr>`)
    .join("");
  return (
    `<br><table style="vertical-align:top" cellspacing="0" cellpadding="1" border="1">` +
    `<tr><th>Nama Kolom</th><th>Nilai</th></tr>${baris}</table>`
  );
}

/** Satu baris sys_audittrail untuk satu kolom e-Doc pada perkara_putusan. */
function barisAudit({ username, jenis = "putusan", perkaraId, rincian, ip, saat }) {
  const borang = BORANG_UNGGAH[jenis] || BORANG_UNGGAH.putusan;
  const idPerkara = Number(perkaraId || 0);
  return {
    sql:
      "INSERT INTO sys_audittrail (datetime, ipaddress, username, tablename, formname, action, title, description) " +
      "VALUES (?,?,?,?,?,?,?,?)",
    params: [
      saat,
      ipAudit(ip),
      String(username || "").slice(0, 30),
      "perkara_putusan",
      borang.formname,
      AKSI_UNGGAH,
      `${borang.judul} <br />dengan perkara_id [id=${idPerkara}]`.slice(0, 250),
      deskripsiAudit(rincian),
    ],
  };
}

/**
 * Akun SIPP pemicunya - PETUGAS YANG LOGIN, dikenali di sys_users.
 *
 * Panel SIPP mengirim username SIPP; panel ABT mengirim nama lengkap sesi
 * ABT. Keduanya orang yang sama, dan yang ditulis ke kolom username SIPP
 * adalah username-nya bila ia terdaftar - persis yang ditulis SIPP bila orang
 * itu mengunggah sendiri. Bila tidak dikenali, teks aslinya dipakai apa
 * adanya (tidak pernah diganti nama lain), dan jejak ALETA mencatat bahwa
 * pemetaannya tidak terjadi.
 */
async function akunSippPemicu(olehUsername) {
  const teks = String(olehUsername || "").trim();
  if (!teks) return { username: "", terpetakan: false };
  const baris = await runQuery(
    `SELECT username FROM sys_users WHERE username = ? OR LOWER(fullname) = LOWER(?) ORDER BY username = ? DESC LIMIT 1`,
    [teks, teks, teks]
  ).catch(() => []);
  const ketemu = Array.isArray(baris) && baris[0] && String(baris[0].username || "").trim();
  return ketemu ? { username: ketemu, terpetakan: true } : { username: teks, terpetakan: false };
}

/**
 * Jejak ALETA - dimuat MALAS dan dapat ditiru uji: jejakAletaService membuka
 * sambungan ke basis data internal bot, yang tidak boleh tersentuh uji.
 */
function catatJejakBawaan(jejak) {
  // Uji (vitest) TIDAK PERNAH menulis ke basis data bot sungguhan - uji yang
  // memeriksa jejak meneruskan catatJejak tiruannya sendiri.
  if (process.env.VITEST) return Promise.resolve(false);
  try {
    return require("./jejakAletaService").catat(jejak);
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Konversi ke PDF yang DIMULAI SEKARANG dan ditunggu nanti.
 *
 * Putusan dan anonimisasinya diubah BERSAMAAN (profil soffice sudah terpisah
 * per folder sekali pakai), lalu ditulis berurutan menurut slotnya - putusan
 * dahulu - sehingga urutan hasil dan baris auditnya tetap. Waktu dinding dua
 * konversi menjadi yang terlama di antara keduanya, bukan jumlahnya.
 *
 * .catch() wajib: bila berkas pertama gagal ditulis, janji berkas kedua
 * ditinggalkan tanpa ditunggu, dan penolakan yang tak tertangani mematikan
 * proses Node. dokumenKePdf sendiri tidak melempar; ini penjaga bila kelak
 * berubah.
 */
function mulaiUbahKePdf(isi) {
  const bentuk = abtCetakService.kenaliDokumen(isi);
  if (!bentuk || bentuk === "pdf") return null;
  return abtCetakService.dokumenKePdf(isi).catch((galat) => ({
    ok: false,
    alasan: String((galat && galat.message) || galat).slice(0, 200),
  }));
}

/**
 * Mengunggah satu berkas.
 *
 * Urutannya sengaja: BERKAS DAHULU, baris sesudahnya. Baris yang menunjuk
 * berkas yang tidak ada membuat Direktori Putusan menarik berkas kosong;
 * berkas tanpa baris hanya menjadi berkas yang tidak terpakai, dan itu jauh
 * lebih ringan.
 */
async function unggahSatu({
  perkaraId,
  nomorPerkara,
  jenis,
  pdf,
  tanggalPutusan,
  olehUsername,
  ip,
  // Konversi yang sudah dimulai pemanggil bersamaan dengan berkas lainnya
  // (mulaiUbahKePdf). Tanpa itu konversinya dimulai di sini.
  ubahan = null,
  // Jam dinding. Dapat ditiru uji; di produksi selalu waktu sungguhan.
  jam = () => new Date(),
}) {
  const kolom = KOLOM_DOK[jenis];
  if (!kolom) return { jenis, ok: false, alasan: "jenis_tidak_didukung" };
  if (!pdf || !pdf.length) return { jenis, ok: false, alasan: "berkas_kosong" };

  // ==========================================================================
  // JENISNYA DIKENALI DARI BITANYA, BUKAN DARI NAMANYA
  // ==========================================================================
  //
  // Nama berkas dapat diubah siapa saja; kepala berkasnya tidak. Yang
  // diterima: PDF, RTF, DOC, DOCX - keempatnya yang sungguh dipakai satker,
  // dan RTF-lah yang terbanyak (87,7%). Lihat catatan di kepala berkas.
  const bentuk = abtCetakService.kenaliDokumen(pdf);
  if (!bentuk) {
    return {
      jenis,
      ok: false,
      alasan: "bentuk_tidak_dikenali",
      pesan: "Isinya bukan PDF, RTF, DOC, maupun DOCX - dikenali dari kepala berkasnya, bukan dari namanya.",
    };
  }

  // ==========================================================================
  // PDF DIBUAT UTUH DI MEMORI SEBELUM SATU BERKAS PUN DITULIS
  // ==========================================================================
  //
  // Inilah yang menjawab ketakutan yang dulu dijawab dengan penolakan:
  // "pengubahan yang gagal separuh meninggalkan berkas rusak yang barisnya
  // sudah terlanjur tercatat". Yang mencegahnya URUTAN, bukan penolakan -
  // tidak ada satu pun tulisan sebelum PDF-nya terbukti utuh.
  //
  // soffice yang tidak ada TIDAK membatalkan unggahan. e-Doc tetap tersimpan
  // dan baris Direktori Putusan ditunda beserta sebabnya - persis urutan
  // SIPP, yang juga menyimpan berkasnya lebih dulu dan mengubah kemudian.
  let pdfTerbit = bentuk === "pdf" ? pdf : null;
  let sebabTanpaPdf = "";
  if (!pdfTerbit) {
    const ubah = await (ubahan || abtCetakService.dokumenKePdf(pdf));
    if (ubah.ok && ubah.pdf) pdfTerbit = ubah.pdf;
    else sebabTanpaPdf = ubah.alasan || "Pengubahan ke PDF gagal tanpa keterangan.";
  }

  // Dua halangan yang berbeda, dan dulu keduanya bersembunyi di balik satu
  // kalimat. "Belum disetel" dapat diperbaiki lewat pengaturan; "hanya baca"
  // menuntut mount baru di docker-compose.yml dan container dijalankan ulang.
  // Petugas yang membaca layar tidak dapat membedakannya sendiri, jadi
  // pesannya yang harus membedakannya.
  // Folder tujuannya disebut, sebab akar SIPP memang tetap hanya-baca dan
  // yang dibuka untuk ditulis hanya folder putusan serta anonimisasinya.
  const keadaanAkar = dokumenPenetapanService.periksaAkarSipp(undefined, {
    relatif: `resources/file/${FOLDER[jenis] || "doc"}`,
  });
  if (!keadaanAkar.dapatDitulis) {
    return { jenis, ok: false, alasan: keadaanAkar.alasan, pesan: keadaanAkar.pesan };
  }
  const akar = keadaanAkar.akar;

  // ==========================================================================
  // DUA JALUR, BUKAN SATU - DAN DULU KEDUANYA DIISI JALUR YANG SAMA
  // ==========================================================================
  //
  //   relatifAsli   berkas apa adanya  -> kolom perkara_putusan (e-Doc)
  //   relatifPdf    hasil konversi     -> baris dirput_dokumen
  //
  // Diperiksa pada perkara September 2026 satker: perkara_id 10001 memegang
  // ..._putusan_akhir.RTF pada kolom e-Doc dan ..._putusan_akhir.PDF pada
  // dirput_dokumen. Mengisi keduanya dengan satu jalur membuat Direktori
  // Putusan menunjuk berkas yang tidak dapat dibacanya.
  const relatifAsli = jalurRelatif(nomorPerkara, jenis, tanggalPutusan, bentuk);
  const relatifPdf = jalurRelatif(nomorPerkara, jenis, tanggalPutusan, "pdf");
  if (!relatifAsli) return { jenis, ok: false, alasan: "nomor_atau_tanggal_putusan_tidak_sah" };

  const penuhAsli = path.join(akar, relatifAsli);
  const penuhPdf = path.join(akar, relatifPdf);
  try {
    fs.mkdirSync(path.dirname(penuhAsli), { recursive: true });
    fs.writeFileSync(penuhAsli, pdf);
    // Pemilik dan izinnya disamakan dengan berkas bikinan SIPP sendiri.
    // Tanpa itu berkasnya tercatat benar di basis data tetapi tidak terbaca
    // oleh proses SIPP - gejalanya sama persis dengan berkas yang tidak
    // pernah tertulis.
    dokumenPenetapanService.samakanPemilikSipp(penuhAsli, akar);
    // PDF ditulis hanya bila ia memang ada DAN bukan berkas yang sama.
    if (pdfTerbit && relatifPdf !== relatifAsli) {
      fs.writeFileSync(penuhPdf, pdfTerbit);
      dokumenPenetapanService.samakanPemilikSipp(penuhPdf, akar);
    }
  } catch (galat) {
    return {
      jenis,
      ok: false,
      alasan: "berkas_tidak_dapat_ditulis",
      pesan: String(galat.message || galat).slice(0, 200),
    };
  }

  // ==========================================================================
  // WAKTU AUDIT = WAKTU TULISAN ITU SUNGGUH TERJADI
  // ==========================================================================
  //
  // Dahulu satu 'saat' dibuat di awal permintaan dan dipakai semua tulisan,
  // padahal berkas kedua baru ditulis sesudah konversinya selesai - dapat
  // puluhan detik kemudian - sehingga cap waktunya menyatakan saat yang
  // keliru. Kini jam dibaca tepat sebelum tiap tulisan. Tidak digeser dan
  // tidak dikarang: bila dua tulisan terjadi pada detik yang sama, itulah yang
  // tercatat.
  const saat = jam();
  const waktu = waktuMysql(saat);
  const tabelDisentuh = [];

  // 1. Kolom dokumen pada perkara_putusan.
  // Jalur ASLI - inilah e-Doc, dan SIPP menyimpannya apa adanya.
  await runQuery(`UPDATE perkara_putusan SET ${kolom} = ? WHERE perkara_id = ?`, [relatifAsli, perkaraId]);
  tabelDisentuh.push("perkara_putusan");
  const audit = barisAudit({
    username: olehUsername,
    jenis,
    perkaraId,
    rincian: { [kolom]: relatifAsli },
    ip,
    saat: waktu,
  });
  await runQuery(audit.sql, audit.params);

  // ==========================================================================
  // 2. dirput_dokumen - HANYA PDF, DAN DITUNDA BILA PDF-NYA BELUM ADA
  // ==========================================================================
  //
  // Diukur pada dirput_dokumen satker, 19.847 baris: 19.820 (99,86%) .pdf.
  // Ke-26 baris .rtf di sana adalah bekas konversi yang GAGAL - salah satunya
  // bahkan published = 1, artinya berkas yang tidak dapat dibaca Direktori
  // Putusan terlanjur terbit. Itu keadaan yang harus dicegah, bukan ditiru.
  //
  // Karena itu: tanpa PDF, barisnya TIDAK ditulis. Yang sudah tersimpan tetap
  // tersimpan - e-Doc-nya ada di kolom perkara_putusan dan berkasnya ada di
  // cakram - dan sebabnya disebutkan supaya dapat ditindaklanjuti. Unggahan
  // yang separuh berhasil disebut separuh berhasil, bukan dibulatkan menjadi
  // gagal maupun menjadi berhasil.
  if (!pdfTerbit) {
    return {
      jenis,
      ok: true,
      sebagian: true,
      jalur: relatifAsli,
      bentuk,
      tabel: tabelDisentuh,
      alasan: "pdf_belum_dapat_dibuat",
      pesan:
        `E-Doc tersimpan sebagai ${bentuk.toUpperCase()}, tetapi baris Direktori Putusan belum ` +
        `ditulis: ${sebabTanpaPdf}`,
    };
  }

  // REPLACE, sama seperti SIPP - mengunggah ulang berkas yang sama tidak
  // boleh meninggalkan dua baris untuk satu dokumen.
  const ref = await dokumenRefId(perkaraId, jenis);
  if (!ref) {
    return {
      jenis,
      ok: false,
      alasan: "dokumen_ref_id_tidak_ketemu",
      pesan: "Alur perkara ini belum punya rujukan dokumen Direktori Putusan di dirput_dokumen_ref.",
      berkasTertulis: relatifAsli,
    };
  }

  // published: anonimisasi SELALU 1 - itulah yang terbit di Direktori Putusan.
  // Putusan akhir mengikuti pilihan petugas, dan bawaannya 0.
  const published = jenis === "anonimisasi" ? 1 : 0;

  const lama = await runQuery(
    `SELECT id FROM dirput_dokumen WHERE perkara_id = ? AND dokumen_ref_id = ? LIMIT 1`,
    [perkaraId, ref]
  ).catch(() => []);
  const idLama = Number((Array.isArray(lama) && lama[0] && lama[0].id) || 0);

  if (idLama) {
    await runQuery(
      `UPDATE dirput_dokumen
          SET filename = ?, path_filename = ?, updated_by = 'SYSTEM', updated_date = ?,
              pengajuan_id = 1, published = ?
        WHERE id = ?`,
      [path.basename(relatifPdf), relatifPdf, waktu.slice(0, 10), published, idLama]
    );
  } else {
    await runQuery(
      `INSERT INTO dirput_dokumen
         (perkara_id, dokumen_ref_id, filename, path_filename, created_by, created_date,
          updated_by, updated_date, pengajuan_id, published)
       VALUES (?,?,?,?, 'SYSTEM', ?, 'SYSTEM', ?, 1, ?)`,
      [perkaraId, ref, path.basename(relatifPdf), relatifPdf, waktu.slice(0, 10), waktu.slice(0, 10), published]
    );
  }
  tabelDisentuh.push("dirput_dokumen");
  // Baris Direktori Putusan TIDAK diberi baris sys_audittrail - SIPP sendiri
  // tidak mengauditnya (convert_insert). Tulisannya tercatat di jejak ALETA
  // lewat `tabel` yang dipulangkan (lihat unggahPutusan).

  // jalur = e-Doc yang tersimpan; jalurPdf = yang terbit di Direktori Putusan.
  return {
    jenis,
    ok: true,
    jalur: relatifAsli,
    jalurPdf: relatifPdf,
    bentuk,
    dokumenRefId: ref,
    published,
    tabel: tabelDisentuh,
  };
}

/**
 * Mengunggah putusan akhir, anonimisasinya, atau keduanya.
 *
 * Satu slot saja sah: anonimisasi sering baru siap sesudah putusannya
 * terunggah, dan berkas yang keliru cukup diganti satu tanpa mengirim ulang
 * pasangannya.
 *
 * Antrean Direktori Putusan ditulis SEKALI di akhir, bukan sekali per berkas:
 * insert_antrian_upload milik SIPP menaruh satu baris per unggahan, dan dua
 * baris untuk satu perkara membuat penyinkron mengerjakannya dua kali.
 */
async function unggahPutusan({
  perkaraId,
  nomorPerkara,
  pdfPutusan,
  pdfAnonimisasi,
  olehUsername,
  ip = "",
  // Pengguna ALETA yang menekan tombolnya (bila diteruskan) - hanya untuk
  // jejak ALETA, TIDAK PERNAH ditulis ke SIPP.
  operator = "",
  // Jam dinding, dibaca PER BERKAS saat berkas itu ditulis (lihat unggahSatu).
  jam = () => new Date(),
  // Pencatat jejak ALETA - ditiru uji.
  catatJejak = catatJejakBawaan,
}) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, alasan: "perkara_tidak_sah" };
  if (!pdfPutusan && !pdfAnonimisasi) return { ok: false, alasan: "tidak_ada_berkas" };

  // Pelaku di SIPP = petugas yang login (butir 14). Lihat akunSippPemicu.
  const akun = await akunSippPemicu(olehUsername);
  const jejakDasar = {
    aksi: "unggah",
    jenis: "edoc_putusan",
    perkaraId: id,
    nomorPerkara: String(nomorPerkara || ""),
    akunSipp: akun.username,
    operator: String(operator || "").slice(0, 120),
    ip: String(ip || ""),
    kering: false,
  };

  for (const tabel of ["perkara_putusan", "dirput_dokumen", "dirput_antrian", "dirput_dokumen_ref"]) {
    if (!(await sippSkemaService.tabelAda(tabel))) {
      return { ok: false, alasan: `tabel_${tabel}_tidak_ada` };
    }
  }

  // Tanggal putusan menentukan folder tahun/bulan - dan perkara yang belum
  // diputus tidak punya berkas putusan untuk diunggah sama sekali.
  const barisPutusan = await runQuery(
    `SELECT tanggal_putusan FROM perkara_putusan WHERE perkara_id = ? LIMIT 1`,
    [id]
  ).catch(() => []);
  const tanggalPutusan =
    (Array.isArray(barisPutusan) && barisPutusan[0] && barisPutusan[0].tanggal_putusan) || null;
  if (!tanggalPutusan) {
    await Promise.resolve(
      catatJejak({ ...jejakDasar, berhasil: false, alasan: "belum_ada_putusan", langkah: [] })
    ).catch(() => false);
    return {
      ok: false,
      alasan: "belum_ada_putusan",
      pesan: "Perkara ini belum punya baris putusan di SIPP. Simpan Putusan Akhir lebih dulu.",
    };
  }
  const tanggalIso =
    tanggalPutusan instanceof Date
      ? `${tanggalPutusan.getFullYear()}-${duaAngka(tanggalPutusan.getMonth() + 1)}-${duaAngka(
          tanggalPutusan.getDate()
        )}`
      : String(tanggalPutusan).slice(0, 10);

  // Kedua konversi dimulai SEKARANG, bersamaan; penulisannya tetap berurutan
  // (putusan dahulu). Lihat mulaiUbahKePdf.
  const ubahPutusan = pdfPutusan ? mulaiUbahKePdf(pdfPutusan) : null;
  const ubahAnonimisasi = pdfAnonimisasi ? mulaiUbahKePdf(pdfAnonimisasi) : null;

  const hasil = [];
  if (pdfPutusan) {
    hasil.push(
      await unggahSatu({
        perkaraId: id,
        nomorPerkara,
        jenis: "putusan",
        pdf: pdfPutusan,
        tanggalPutusan: tanggalIso,
        olehUsername: akun.username,
        ip,
        ubahan: ubahPutusan,
        jam,
      })
    );
  }
  if (pdfAnonimisasi) {
    hasil.push(
      await unggahSatu({
        perkaraId: id,
        nomorPerkara,
        jenis: "anonimisasi",
        pdf: pdfAnonimisasi,
        tanggalPutusan: tanggalIso,
        olehUsername: akun.username,
        ip,
        ubahan: ubahAnonimisasi,
        jam,
      })
    );
  }

  const berhasil = hasil.filter((x) => x.ok);
  let antrean = false;
  if (berhasil.length > 0) {
    // Antrean baru: status 0, keterangan kosong - persis insert_antrian_upload.
    // Yang sudah mengantre dan BELUM dikerjakan tidak digandakan.
    const menunggu = await runQuery(
      `SELECT id FROM dirput_antrian WHERE perkara_id = ? AND status = 0 LIMIT 1`,
      [id]
    ).catch(() => []);
    if (!(Array.isArray(menunggu) && menunggu.length > 0)) {
      // tgl_masuk = waktu baris ini ditulis, seperti insert_antrian_upload.
      const tglMasuk = waktuMysql(jam());
      await runQuery(
        `INSERT INTO dirput_antrian (perkara_id, status, keterangan, tgl_masuk) VALUES (?, 0, NULL, ?)`,
        [id, tglMasuk]
      );
      // Tanpa baris sys_audittrail, sama seperti insert_antrian_upload SIPP.
      antrean = true;
    }
  }

  // ==========================================================================
  // JEJAK JUJUR DI BASIS DATA ALETA - SIAPA, KAPAN, IP, LEWAT ALETA
  // ==========================================================================
  //
  // Satu baris untuk seluruh permintaan, dengan SETIAP tulisan sebagai
  // langkahnya - termasuk dirput_dokumen dan dirput_antrian yang tidak punya
  // baris sys_audittrail, dan berkas yang gagal beserta sebabnya.
  const langkah = [];
  for (const h of hasil) {
    for (const t of h.tabel || []) {
      langkah.push({
        tabel: t,
        aksi: t === "perkara_putusan" ? "UPDATE" : "TULIS",
        keterangan: `${h.jenis}: ${t === "perkara_putusan" ? h.jalur || "" : h.jalurPdf || ""}`,
      });
    }
    if (!h.ok) langkah.push({ tabel: "", aksi: "GAGAL", keterangan: `${h.jenis}: ${h.alasan || "gagal"}` });
  }
  if (antrean) langkah.push({ tabel: "dirput_antrian", aksi: "INSERT", keterangan: "antrean Direktori Putusan" });
  await Promise.resolve(
    catatJejak({
      ...jejakDasar,
      tanggalPenetapan: tanggalIso,
      berhasil: berhasil.length > 0,
      alasan:
        berhasil.length > 0
          ? akun.terpetakan || !akun.username
            ? ""
            : "akun_sipp_tidak_terpetakan"
          : (hasil[0] && hasil[0].alasan) || "gagal",
      langkah,
    })
  ).catch(() => false);

  return {
    ok: berhasil.length > 0,
    berkas: hasil,
    antrean,
    tanggalPutusan: tanggalIso,
    alasan: berhasil.length > 0 ? "" : (hasil[0] && hasil[0].alasan) || "gagal",
  };
}

module.exports = {
  namaBerkas,
  jalurRelatif,
  dokumenRefId,
  barisAudit,
  akunSippPemicu,
  BORANG_UNGGAH,
  unggahSatu,
  unggahPutusan,
};
