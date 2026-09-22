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

/** Baris audit SIPP - tanpa satu kata pun tentang ALETA. Lihat penetapanTulisService. */
function barisAudit({ username, tabel, formulir, aksi, perkaraId, ip, saat }) {
  const idPerkara = Number(perkaraId || 0);
  const kunci = idPerkara > 0 ? ` dengan Primary Key [perkara_id=${idPerkara}]` : "";
  return {
    sql:
      "INSERT INTO sys_audittrail (datetime, ipaddress, username, tablename, formname, action, title, description) " +
      "VALUES (?,?,?,?,?,?,?,?)",
    params: [
      saat,
      String(ip || "").slice(0, 15),
      String(username || "").slice(0, 30),
      tabel,
      formulir,
      aksi,
      `${aksi} table <b>${tabel}</b> dari halaman <b>${formulir}</b>${kunci}`,
      `${aksi} table <b>${tabel}</b> dari halaman <b>${formulir}</b>${kunci}`,
    ],
  };
}

/**
 * Mengunggah satu berkas.
 *
 * Urutannya sengaja: BERKAS DAHULU, baris sesudahnya. Baris yang menunjuk
 * berkas yang tidak ada membuat Direktori Putusan menarik berkas kosong;
 * berkas tanpa baris hanya menjadi berkas yang tidak terpakai, dan itu jauh
 * lebih ringan.
 */
async function unggahSatu({ perkaraId, nomorPerkara, jenis, pdf, tanggalPutusan, olehUsername, ip, saat }) {
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
    const ubah = await abtCetakService.dokumenKePdf(pdf);
    if (ubah.ok && ubah.pdf) pdfTerbit = ubah.pdf;
    else sebabTanpaPdf = ubah.alasan || "Pengubahan ke PDF gagal tanpa keterangan.";
  }

  const akar = dokumenPenetapanService.akarSipp();
  if (!akar) return { jenis, ok: false, alasan: "akar_sipp_belum_disetel" };

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
    // PDF ditulis hanya bila ia memang ada DAN bukan berkas yang sama.
    if (pdfTerbit && relatifPdf !== relatifAsli) fs.writeFileSync(penuhPdf, pdfTerbit);
  } catch (galat) {
    return {
      jenis,
      ok: false,
      alasan: "berkas_tidak_dapat_ditulis",
      pesan: String(galat.message || galat).slice(0, 200),
    };
  }

  const waktu = waktuMysql(saat);
  const tabelDisentuh = [];

  // 1. Kolom dokumen pada perkara_putusan.
  // Jalur ASLI - inilah e-Doc, dan SIPP menyimpannya apa adanya.
  await runQuery(`UPDATE perkara_putusan SET ${kolom} = ? WHERE perkara_id = ?`, [relatifAsli, perkaraId]);
  tabelDisentuh.push("perkara_putusan");
  await runQuery(
    barisAudit({
      username: olehUsername,
      tabel: "perkara_putusan",
      formulir: "Kelola Dokumen Elektronik (E-Doc)",
      aksi: "UPDATE",
      perkaraId,
      ip,
      saat: waktu,
    }).sql,
    barisAudit({
      username: olehUsername,
      tabel: "perkara_putusan",
      formulir: "Kelola Dokumen Elektronik (E-Doc)",
      aksi: "UPDATE",
      perkaraId,
      ip,
      saat: waktu,
    }).params
  );

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
  const auditDirput = barisAudit({
    username: olehUsername,
    tabel: "dirput_dokumen",
    formulir: "Kelola Dokumen Elektronik (E-Doc)",
    aksi: idLama ? "UPDATE" : "INSERT",
    perkaraId,
    ip,
    saat: waktu,
  });
  await runQuery(auditDirput.sql, auditDirput.params);

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
 * Mengunggah putusan akhir dan anonimisasinya sekaligus.
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
  saat = new Date(),
}) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, alasan: "perkara_tidak_sah" };
  if (!pdfPutusan && !pdfAnonimisasi) return { ok: false, alasan: "tidak_ada_berkas" };

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

  const hasil = [];
  if (pdfPutusan) {
    hasil.push(
      await unggahSatu({
        perkaraId: id,
        nomorPerkara,
        jenis: "putusan",
        pdf: pdfPutusan,
        tanggalPutusan: tanggalIso,
        olehUsername,
        ip,
        saat,
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
        olehUsername,
        ip,
        saat,
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
      await runQuery(
        `INSERT INTO dirput_antrian (perkara_id, status, keterangan, tgl_masuk) VALUES (?, 0, NULL, ?)`,
        [id, waktuMysql(saat)]
      );
      const auditAntrean = barisAudit({
        username: olehUsername,
        tabel: "dirput_antrian",
        formulir: "Kelola Dokumen Elektronik (E-Doc)",
        aksi: "INSERT",
        perkaraId: id,
        ip,
        saat: waktuMysql(saat),
      });
      await runQuery(auditAntrean.sql, auditAntrean.params);
      antrean = true;
    }
  }

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
  unggahSatu,
  unggahPutusan,
};
