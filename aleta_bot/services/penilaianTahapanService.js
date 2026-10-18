"use strict";

/**
 * ============================================================================
 * KETAATAN TAHAPAN - SATU POLA, BANYAK BUTIR
 * ============================================================================
 *
 * Bab 3 katalog memuat dua puluh butir ketaatan tahapan, dan sebagian besar
 * berbentuk pertanyaan yang sama persis:
 *
 *     "Sejak peristiwa A, apakah peristiwa B tercatat, dan dalam berapa hari?"
 *
 * Menulisnya dua puluh kali menghasilkan dua puluh kesempatan salah ketik nama
 * tabel, dua puluh tempat yang harus diperbaiki bila aturan hari kerja
 * berubah, dan dua puluh daftar bukti yang bentuknya sedikit berbeda-beda.
 *
 * Karena itu polanya ditulis SEKALI di sini, dan tiap butir menjadi DATA.
 *
 * ============================================================================
 * HANYA NAMA YANG SUDAH TERBUKTI
 * ============================================================================
 *
 * Tiap butir menyebut tabel dan ruas SIPP yang dibacanya. Seluruh nama itu
 * diambil dari kueri yang SUDAH berjalan di ALETA - bukan dari ingatan, bukan
 * dari tebakan atas nama yang "sepertinya begitu".
 *
 * Penjaga verify-ruas-terbukti memindai kueri lama untuk menyusun daftar nama
 * yang pernah benar-benar dipakai, lalu menolak butir yang menyebut nama di
 * luar daftar itu. Nama tabel yang keliru tidak menggagalkan uji mana pun -
 * ia baru ketahuan di server, saat seseorang menekan Hitung dan mendapat
 * galat SQL.
 *
 * ============================================================================
 * YANG BELUM TERCATAT BUKAN "TERLAMBAT"
 * ============================================================================
 *
 * Peristiwa yang tidak ada tanggalnya sama sekali dihitung TIDAK MEMENUHI,
 * dan barisnya menyebut sebabnya "belum tercatat" - berbeda dari "terlambat".
 * Menyamakan keduanya menyembunyikan perkara yang tahapannya benar-benar
 * belum dikerjakan di balik angka keterlambatan.
 */

const db = require("../db_config");

/**
 * Pembungkus baca. Bentuknya sama dengan yang dipakai layanan penilaian lain,
 * supaya penjaga baca-saja SIPP mengenalinya sebagai pembungkus.
 */
function runQuery(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => {
      if (galat) gagal(galat);
      else selesai(Array.isArray(hasil) ? hasil : []);
    });
  });
}
const periode = require("./periodePenilaianService");
const ambang = require("./ambangPenilaianService");
const kerangka = require("./kerangkaPenilaianService");

const BATAS_BARIS = 20000;

function teks(v) {
  return v === null || v === undefined ? "" : String(v);
}

function tanggalIso(v) {
  if (!v) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

/**
 * ============================================================================
 * DUA PULUH BUTIR SEBAGAI DATA
 * ============================================================================
 *
 *   kode        - butir katalog yang dipenuhinya
 *   acuanRuas   - tanggal peristiwa A pada tabel perkara
 *   tabel       - tabel yang memuat peristiwa B
 *   ruas        - ruas tanggal peristiwa B
 *   syarat      - syarat tambahan pada tabel B, bila ada
 *   batasHari   - berapa hari sejak A, B harus sudah tercatat
 *   hariKerja   - apakah batasnya dihitung dalam hari kerja
 *   ambangKunci - ambang bertanggal yang dipakai, bila ada
 *   dasar       - dasar hukum atau kebijakannya
 *   sertaJenis  - hanya berlaku untuk perkara berjenis tertentu, bila ada
 */
const TAHAPAN = [
  {
    kode: "KT01",
    kunci: "ketaatanInputPendaftaran",
    judul: "Ketaatan Penginputan Pendaftaran Perkara",
    keterangan:
      "Perkara yang didaftarkan memiliki tanggal pendaftaran yang tercatat pada SIPP. Tanpa itu, seluruh tenggang tahapan berikutnya tidak dapat dihitung.",
    tabel: "perkara",
    ruas: "tanggal_pendaftaran",
    mandiri: true,
    batasHari: 0,
    dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024",
  },
  {
    kode: "KT02",
    kunci: "ketaatanPenetapanMajelis",
    judul: "Ketaatan Penetapan Majelis Hakim",
    keterangan:
      "Penetapan Majelis Hakim ditetapkan paling lama tiga hari sejak perkara didaftarkan.",
    tabel: "perkara_hakim_pn",
    ruas: "tanggal_penetapan",
    batasHari: 3,
    hariKerja: true,
    dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024",
  },
  {
    kode: "KT03",
    kunci: "ketaatanPenunjukanPaniteraPengganti",
    judul: "Ketaatan Penunjukan Panitera Pengganti",
    keterangan:
      "Penunjukan Panitera Pengganti ditetapkan paling lama tiga hari sejak perkara didaftarkan.",
    tabel: "perkara_panitera_pn",
    ruas: "tanggal_penetapan",
    batasHari: 3,
    hariKerja: true,
    dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024",
  },
  {
    kode: "KT04",
    kunci: "ketaatanPenunjukanJurusita",
    judul: "Ketaatan Penunjukan Jurusita dan Jurusita Pengganti",
    keterangan:
      "Penunjukan Jurusita ditetapkan paling lama tiga hari sejak perkara didaftarkan, sebab tanpa itu pemanggilan tidak dapat dijalankan.",
    tabel: "perkara_jurusita",
    ruas: "tanggal_penetapan",
    batasHari: 3,
    hariKerja: true,
    dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024",
  },
  {
    kode: "KT05",
    kunci: "ketaatanPenetapanHariSidang",
    judul: "Ketaatan Penetapan Hari Sidang",
    keterangan:
      "Penetapan Hari Sidang ditetapkan paling lama tujuh hari sejak perkara didaftarkan.",
    tabel: "perkara_jadwal_sidang",
    ruas: "tanggal_sidang",
    batasHari: 7,
    hariKerja: true,
    dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024",
  },
  {
    kode: "KT11",
    kunci: "ketaatanInputPutusan",
    judul: "Ketaatan Penginputan Putusan",
    keterangan:
      "Perkara yang telah diputus memiliki tanggal putusan yang tercatat pada SIPP.",
    tabel: "perkara_putusan",
    ruas: "tanggal_putusan",
    batasHari: 150,
    dasar: "SEMA 2 Tahun 2014 - lima bulan sejak pendaftaran",
  },
  {
    kode: "KT12",
    kunci: "ketaatanMinutasiBerkas",
    judul: "Ketaatan Minutasi Berkas Perkara",
    keterangan:
      "Berkas perkara diminutasi paling lama empat belas hari sejak putusan diucapkan.",
    tabel: "perkara_putusan",
    ruas: "tanggal_minutasi",
    dariRuas: "tanggal_putusan",
    dariTabel: "perkara_putusan",
    batasHari: 14,
    ambangKunci: "minutasiBerkas",
    dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024",
  },
  {
    kode: "KT14",
    kunci: "ketaatanPenetapanBht",
    judul: "Ketaatan Penetapan Berkekuatan Hukum Tetap",
    keterangan:
      "Tanggal berkekuatan hukum tetap tercatat sesudah tenggang upaya hukum lewat.",
    tabel: "perkara_putusan",
    ruas: "tanggal_bht",
    dariRuas: "tanggal_putusan",
    dariTabel: "perkara_putusan",
    batasHari: 30,
    dasar: "Pasal 7 UU 20 Tahun 1947 - tenggang banding empat belas hari",
  },
  {
    kode: "KT15",
    kunci: "ketaatanPenerbitanAktaCerai",
    judul: "Ketaatan Penerbitan Akta Cerai",
    keterangan:
      "Akta cerai diterbitkan paling lama tujuh hari sejak putusan berkekuatan hukum tetap atau sejak ikrar talak diucapkan.",
    tabel: "perkara_akta_cerai",
    ruas: "tgl_akta_cerai",
    hanyaJenisMengandung: "erai",
    dariRuas: "tanggal_bht",
    dariTabel: "perkara_putusan",
    batasHari: 7,
    hariKerja: true,
    dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024",
  },
  {
    kode: "KT16",
    kunci: "ketaatanSidangIkrarTalak",
    judul: "Ketaatan Pelaksanaan Sidang Ikrar Talak",
    keterangan:
      "Sidang ikrar talak dilaksanakan dalam enam bulan sejak ditetapkan hari sidang ikrar; lewat dari itu, kekuatan penetapan gugur.",
    tabel: "perkara_ikrar_talak",
    ruas: "tgl_ikrar_talak",
    hanyaJenisMengandung: "Talak",
    // Keputusan pengguna no. 91 (18 Okt 2026): acuannya penetapan hari sidang ikrar (Pasal 70 ayat (6)),
    // BUKAN BHT - sama dengan hitungan butir Badilag sendiri. Perkara tanpa baris ikrar / tanpa
    // penetapan itu tidak punya acuan, jadi dikeluarkan dari penyebut (belum dapat dinilai).
    dariRuas: "tanggal_penetapan_sidang_ikrar",
    dariTabel: "perkara_ikrar_talak",
    // Mesin ini hanya mengenal hari: 180 hari lebih awal 1-4 hari daripada 6 bulan kalender (181-184 hari),
    // jadi sedikit lebih hati-hati; bukan pelanggaran Pasal 70 ayat (6) bila selisihnya hanya itu.
    batasHari: 180,
    dasar: "Pasal 70 ayat (6) UU 7 Tahun 1989",
  },
  {
    kode: "KT18",
    kunci: "ketaatanPengarsipanBerkas",
    judul: "Ketaatan Pengarsipan Berkas Perkara",
    keterangan:
      "Berkas perkara yang telah diminutasi diarsipkan paling lama tiga puluh hari sesudahnya.",
    tabel: "arsip",
    ruas: "tanggal",
    dariRuas: "tanggal_minutasi",
    dariTabel: "perkara_putusan",
    batasHari: 30,
    dasar: "SK Dirjen Badilag 048/DJA/SK.KP3.4.3/IV/2024",
  },
];

/**
 * Menyusun kueri satu butir.
 *
 * Bentuknya sengaja seragam: satu baris per perkara, membawa tanggal acuan dan
 * tanggal peristiwanya. Perkara yang peristiwanya belum tercatat TETAP muncul
 * sebagai baris - dengan tanggal peristiwa kosong - sebab justru merekalah
 * temuan yang paling perlu dilihat.
 */
function susunKueri(t) {
  const dariTabel = t.dariTabel || "perkara";
  const dariRuas = t.dariRuas || "tanggal_pendaftaran";

  // ==========================================================================
  // NAMA PETUGAS IKUT DIBAWA TIAP BARIS
  // ==========================================================================
  //
  // Tanpa ini, rapor per orang tidak mungkin disusun - dan rapor per orang
  // adalah separuh guna pengawasan. Yang dibawa tiga peran yang tercatat SIPP
  // pada tiap perkara, seluruhnya dari ruas yang sudah terbukti dipakai kueri
  // lain di ALETA.
  //
  // Dipakai MAX, bukan penyaringan "aktif". Ruas aktif ada pada tabelnya
  // tetapi tidak satu pun kueri di ALETA pernah memakainya sebagai saringan,
  // sehingga artinya belum terbukti. Memakainya berarti menebak - dan menebak
  // di sini berarti sebagian perkara kehilangan nama petugasnya tanpa suara.
  //
  // Perkara yang petugasnya belum tercatat tetap membawa baris, dengan nama
  // kosong. Penyusun rapor mengumpulkannya sebagai "(tidak tercatat)" -
  // terlihat, bukan hilang.
  const PETUGAS = `,
                 (SELECT MAX(hk.hakim_nama) FROM perkara_hakim_pn hk WHERE hk.perkara_id = p.perkara_id) AS hakim,
                 (SELECT MAX(pp.majelis_hakim_nama) FROM perkara_panitera_pn pp WHERE pp.perkara_id = p.perkara_id) AS majelis,
                 (SELECT MAX(pp.panitera_nama) FROM perkara_panitera_pn pp WHERE pp.perkara_id = p.perkara_id) AS paniteraPengganti,
                 (SELECT MAX(js.jurusita_nama) FROM perkara_jurusita js WHERE js.perkara_id = p.perkara_id) AS jurusita`;

  if (t.mandiri) {
    // Butir yang memeriksa keberadaan ruas pada tabel perkara itu sendiri.
    return {
      sql: `SELECT p.perkara_id AS perkaraId,
                   p.nomor_perkara AS nomorPerkara,
                   p.jenis_perkara_nama AS jenisPerkara,
                   p.${t.ruas} AS acuan,
                   p.${t.ruas} AS peristiwa${PETUGAS}
              FROM perkara p
             WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
             ORDER BY p.tanggal_pendaftaran ASC
             LIMIT ${BATAS_BARIS}`,
      acuanDari: "perkara",
    };
  }

  const sumberAcuan =
    dariTabel === "perkara"
      ? `p.${dariRuas}`
      : `(SELECT MIN(a.${dariRuas}) FROM ${dariTabel} a WHERE a.perkara_id = p.perkara_id)`;

  // ==========================================================================
  // BUTIR YANG HANYA BERLAKU BAGI SEBAGIAN JENIS PERKARA
  // ==========================================================================
  //
  // Akta cerai hanya terbit pada perkara perceraian; ikrar talak hanya pada
  // cerai talak. Tanpa saringan ini, SELURUH perkara lain - waris, dispensasi
  // kawin, isbat nikah - masuk ke penyebut dan terhitung GAGAL karena tidak
  // punya akta cerai. Angkanya lalu jatuh ke belasan persen dan menuduh
  // kepaniteraan atas sesuatu yang memang tidak seharusnya ada.
  //
  // Saringannya memakai LIKE, bukan daftar nama yang tepat. Nama jenis perkara
  // pada SIPP ditulis bermacam-macam - "Cerai Gugat", "Cerai Talak",
  // "Perceraian" - dan mencocokkan daftar tetap akan diam-diam mengeluarkan
  // yang ejaannya berbeda. Bila saringannya terlalu sempit, penyebutnya
  // mengecil dan pembatas dua puluh menahan nilainya; itu gagal yang berbunyi,
  // bukan gagal yang diam.
  const saringJenis = t.hanyaJenisMengandung
    ? `AND p.jenis_perkara_nama LIKE '%${t.hanyaJenisMengandung}%'`
    : "";

  return {
    sql: `SELECT p.perkara_id AS perkaraId,
                 p.nomor_perkara AS nomorPerkara,
                 p.jenis_perkara_nama AS jenisPerkara,
                 ${sumberAcuan} AS acuan,
                 (SELECT MIN(x.${t.ruas}) FROM ${t.tabel} x WHERE x.perkara_id = p.perkara_id) AS peristiwa${PETUGAS}
            FROM perkara p
           WHERE p.tanggal_pendaftaran >= ? AND p.tanggal_pendaftaran <= ?
             ${saringJenis}
           ORDER BY p.tanggal_pendaftaran ASC
           LIMIT ${BATAS_BARIS}`,
    acuanDari: dariTabel,
  };
}

/** Baris bukti satu butir. */
function pembangunBaris(t) {
  return async function baris(rentang) {
    const { sql } = susunKueri(t);
    const hasil = await runQuery(sql, [rentang.mulai, rentang.selesai]);

    const batasAmbang = t.ambangKunci ? ambang.ambangBerlaku(t.ambangKunci, rentang.selesai) : null;
    const batas = batasAmbang && batasAmbang.nilai !== null ? batasAmbang.nilai : t.batasHari;

    return hasil
      .map((r) => {
        const acuan = tanggalIso(r.acuan);
        const peristiwa = tanggalIso(r.peristiwa);

        // Perkara yang acuannya sendiri belum ada tidak dapat dinilai
        // tenggangnya - ia bukan "terlambat", melainkan belum sampai pada
        // tahapan itu. Dikeluarkan dari penyebut, bukan dihitung gagal.
        if (!acuan) return null;

        let jarak = null;
        let sebab = "";
        let mendahului = false;

        if (!peristiwa) {
          sebab = "belum tercatat";
        } else {
          // ================================================================
          // URUTANNYA DIPERIKSA DARI TANGGALNYA, BUKAN DARI HASIL HITUNGAN
          // ================================================================
          //
          // hariKerjaAntara memulangkan NOL untuk rentang terbalik, bukan
          // angka negatif - ia sekadar tidak menemukan hari kerja untuk
          // dihitung. Memeriksa tanda hasilnya karena itu tidak pernah
          // mengenali peristiwa yang mendahului acuannya, dan nol selalu
          // lebih kecil daripada batas berapa pun.
          //
          // Akibatnya penetapan yang bertanggal SEBELUM perkara didaftarkan
          // akan terhitung memenuhi - padahal justru itu temuan yang paling
          // perlu dilihat. Tanggal mundur biasanya berarti salah input, dan
          // kadang berarti sesuatu yang lebih dari salah input.
          mendahului = peristiwa < acuan;
          if (mendahului) {
            sebab = "peristiwa mendahului acuannya";
          }
          try {
            jarak = t.hariKerja
              ? periode.hariKerjaAntara(acuan, peristiwa)
              : periode.hariKalenderAntara(acuan, peristiwa);
          } catch (_) {
            sebab = sebab || "tanggalnya tidak dapat dihitung";
          }
        }

        const memenuhi = !mendahului && jarak !== null && jarak >= 0 && jarak <= batas;

        return {
          kunci: `${teks(r.nomorPerkara)}#${t.kode}`,
          nomorPerkara: teks(r.nomorPerkara),
          jenisPerkara: teks(r.jenisPerkara),
          hakim: teks(r.hakim),
          majelis: teks(r.majelis),
          paniteraPengganti: teks(r.paniteraPengganti),
          jurusita: teks(r.jurusita),
          tanggalAcuan: acuan,
          tanggalPeristiwa: peristiwa,
          jarakHari: jarak,
          mendahuluiAcuan: mendahului,
          batasHari: batas,
          memenuhi,
          sebabTidakMemenuhi: memenuhi ? "" : sebab || `melewati batas ${batas} hari`,
        };
      })
      .filter(Boolean);
  };
}

/** Mendaftarkan seluruh butir tahapan ke kerangka penilaian. */
/**
 * Penjaga pendaftaran ganda.
 *
 * Rute gerbang memanggil daftarkanSemua() pada TIAP permintaan, dan
 * kerangka menolak kunci yang sudah terdaftar - dengan sengaja, sebab dua
 * penilaian berkunci sama akan saling menimpa riwayatnya.
 *
 * Tanpa penjaga ini, permintaan KEDUA dan seterusnya selalu gagal dengan
 * pesan "sudah terdaftar", dan permintaan pertama sesudah bot dinyalakan
 * selalu berhasil. Bentuk kegagalan seperti itu hampir mustahil ditemukan
 * dari laporan pengguna: yang mencobanya sekali akan melihatnya jalan.
 */
let sudahDidaftar = false;
function daftarkanSemua() {
  if (sudahDidaftar) return;
  TAHAPAN.forEach((t) => {
    const dariTabel = t.dariTabel || "perkara";
    const dariRuas = t.dariRuas || "tanggal_pendaftaran";
    kerangka.daftarkan({
      kunci: t.kunci,
      judul: t.judul,
      keterangan: t.keterangan,
      lantai: "bulanan",
      versiRumus: `tahapan-v1${t.hariKerja ? "-hariKerja" : ""}`,
      ambangDipakai: t.ambangKunci ? [t.ambangKunci] : [],
      pakaiHariKerja: Boolean(t.hariKerja),
      caraHitung: {
        pembilang: t.mandiri
          ? `Perkara yang ruas ${t.ruas} pada tabel ${t.tabel} sudah terisi`
          : `Perkara yang ${t.ruas} pada ${t.tabel} tercatat paling lama ${t.batasHari} ${t.hariKerja ? "hari kerja" : "hari"} sesudah ${dariRuas}`,
        penyebut: `Seluruh perkara yang didaftarkan pada rentang ini dan sudah punya tanggal ${dariRuas}`,
        dikecualikan:
          `Perkara yang ${dariRuas} pada ${dariTabel} belum ada - perkara itu belum sampai pada tahapan ini, sehingga tenggangnya tidak dapat dinilai` +
          (t.hanyaJenisMengandung
            ? `. Juga dikecualikan seluruh perkara yang jenisnya tidak mengandung "${t.hanyaJenisMengandung}", sebab tahapan ini memang tidak berlaku baginya`
            : ""),
        tabelSumber: `perkara, ${t.tabel}${dariTabel !== "perkara" && dariTabel !== t.tabel ? `, ${dariTabel}` : ""}`,
        ruasSumber: `tanggal_pendaftaran, ${dariRuas}, ${t.ruas}`,
      },
      baris: pembangunBaris(t),
    });
  });
  sudahDidaftar = true;
}

/** Butir katalog yang dipenuhi berkas ini, untuk disambungkan pada katalog. */
function sambungan() {
  const peta = {};
  TAHAPAN.forEach((t) => {
    peta[t.kode] = t.kunci;
  });
  return peta;
}

/** Seluruh nama tabel dan ruas SIPP yang disebut berkas ini. */
function namaSippDipakai() {
  const tabel = new Set(["perkara", "perkara_hakim_pn", "perkara_panitera_pn", "perkara_jurusita"]);
  const ruas = new Set([
    "perkara_id",
    "nomor_perkara",
    "jenis_perkara_nama",
    "tanggal_pendaftaran",
    "hakim_nama",
    "majelis_hakim_nama",
    "panitera_nama",
    "jurusita_nama",
  ]);
  TAHAPAN.forEach((t) => {
    tabel.add(t.tabel);
    if (t.dariTabel) tabel.add(t.dariTabel);
    ruas.add(t.ruas);
    if (t.dariRuas) ruas.add(t.dariRuas);
  });
  return { tabel: [...tabel].sort(), ruas: [...ruas].sort() };
}

module.exports = { TAHAPAN, daftarkanSemua, sambungan, namaSippDipakai, susunKueri };
