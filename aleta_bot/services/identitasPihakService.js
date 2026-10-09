"use strict";

/**
 * ============================================================================
 * IDENTITAS PARA PIHAK - DIBACA HANYA KETIKA DIMINTA
 * ============================================================================
 *
 * Nama para pihak sudah tampil di Status Perkara sejak lama. Yang tidak ada di
 * sana adalah SIAPA orang itu: umurnya, pekerjaannya, pendidikannya, dan dari
 * desa mana ia datang - keterangan yang tiap hari dicari ketika menyusun
 * penetapan, memeriksa relaas, atau menjawab pihak di meja PTSP, dan yang
 * selama ini menuntut petugas membuka SIPP di jendela lain.
 *
 * ============================================================================
 * TERPISAH DARI MUATAN STATUS PERKARA, DAN ITU DISENGAJA
 * ============================================================================
 *
 * Ini data pribadi. Layar Status Perkara dibuka di meja yang kerap terlihat
 * orang lain, dan pada 2.22.0 bagian para pihak justru DICIUTKAN karena itu.
 * Menempelkan identitas lengkap ke muatan status berarti ia ikut terkirim -
 * dan ikut tersimpan di singgahan peramban - pada setiap perkara yang dibuka
 * siapa pun, termasuk yang hanya ingin melihat jadwal sidang.
 *
 * Karena itu ia punya alamatnya sendiri dan baru dibaca ketika satu nama
 * diketuk. Yang tidak diketuk tidak pernah meninggalkan basis data.
 *
 * ============================================================================
 * YANG DISAMARKAN, DAN YANG SENGAJA TIDAK DIKIRIM
 * ============================================================================
 *
 * NIK dan nomor telepon disamarkan - bentuknya cukup untuk mencocokkan dengan
 * berkas di tangan, tidak cukup untuk disalin. Diukur pada 36.451 baris
 * `pihak` satker:
 *
 *     alamat          100%      NIK              35%
 *     jenis kelamin   100%      telepon          18%
 *     pekerjaan        99%      agama            16%
 *     tanggal lahir    96%      pendidikan       13%
 *     tempat lahir     67%      nama ayah         0%
 *
 * `nama_ayah` dan `nama_ibu` tidak dibaca sama sekali - nol dari 36.451, dan
 * kolom yang selalu kosong hanya menambah baris "—" pada layar.
 *
 * STATUS KAWIN disimpan sebagai ANGKA dan tidak punya tabel rujukan di basis
 * data - 26.115 baris berisi "1", 646 berisi "2", 249 berisi "4", 100 berisi
 * "3". Artinya tidak ditebak melainkan dibaca dari kode SIPP sendiri:
 *
 *     application/views/pengacara/pengacara_list(1).php
 *     <option value="1">Kawin</option>      <option value="3">Duda</option>
 *     <option value="2">Belum Kawin</option><option value="4">Janda</option>
 *
 * Sebarannya cocok dengan artinya - pihak di pengadilan agama memang hampir
 * seluruhnya berstatus kawin. Angka yang di luar keempatnya TIDAK diterjemahkan
 * dan tidak ditampilkan: status kawin yang salah pada berkas perkara
 * perceraian bukan kekeliruan kecil.
 *
 * ============================================================================
 * KODE WILAYAH BUKAN NAMA WILAYAH
 * ============================================================================
 *
 *     pihak.kelurahan   "72.10.02.2014"   bukan "Tanah Harapan"
 *
 * Sama persis dengan jebakan pada peta perkara. Kolom `alamat` sendiri sudah
 * memuat alamat terbaca, jadi kodenya diterjemahkan sebagai keterangan
 * BERJENJANG di sampingnya - berguna untuk mengetahui kecamatan mana tanpa
 * membaca satu kalimat panjang.
 */

const db = require("../db_config");

/** Jumlah cabang pihak pada SIPP - perkara_pihak1 sampai perkara_pihak5. */
const CABANG = [1, 2, 3, 4, 5];

/**
 * Arti angka status kawin - dibaca dari kode SIPP, bukan ditebak.
 * Lihat keterangan di kepala berkas beserta sumbernya.
 */
const STATUS_KAWIN = {
  1: "Kawin",
  2: "Belum kawin",
  3: "Duda",
  4: "Janda",
};

/**
 * Kedudukan menurut cabangnya.
 *
 * Diambil dari pemakaian SIPP sendiri: cabang 1 penggugat/pemohon, 2
 * tergugat/termohon, 3 turut tergugat, 4 pelawan, 5 saksi.
 */
// 6 Okt 2026 (butir 23-24): 3 dan 4 sempat tertukar ("Turut Tergugat" /
// "Pelawan"). Sumber SIPP sendiri (models: "3 AS pihakke, 'intervensi'",
// "4 AS pihakke, 'turut'", kolom jenis_intervensi_* hanya di perkara_pihak3)
// dan data satker (perkara_pihak4: 28 baris turut tergugat, perkara_pihak3: 0)
// menetapkan 3 = intervensi, 4 = turut tergugat.
const KEDUDUKAN = {
  1: "Penggugat / Pemohon",
  2: "Tergugat / Termohon",
  3: "Intervensi",
  4: "Turut Tergugat",
  5: "Saksi",
};

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

/**
 * Tanggal menjadi "YYYY-MM-DD", apa pun bentuk yang dipulangkan penggerak.
 *
 * Penggerak mysql memulangkan kolom DATE sebagai obyek Date. Menyisipkannya apa
 * adanya ke layar berbahasa Indonesia menghasilkan "Wed Nov 11 1981 00:00:00
 * GMT+0800" - dan itulah yang akan dibaca petugas sebagai tanggal lahir.
 */
function tanggalIso(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const b = String(nilai.getMonth() + 1).padStart(2, "0");
    const h = String(nilai.getDate()).padStart(2, "0");
    return `${nilai.getFullYear()}-${b}-${h}`;
  }
  const teks = String(nilai);
  return /^\d{4}-\d{2}-\d{2}/.test(teks) ? teks.slice(0, 10) : "";
}

/**
 * Umur pada hari ini, dari tanggal lahir.
 *
 * Dihitung di sini, bukan di layar: layar tidak tahu zona waktu peladen, dan
 * umur yang meleset satu tahun pada berkas perkara adalah kekeliruan yang
 * terbawa ke penetapan.
 */
function umurTahun(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const lahir = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(lahir.getTime())) return null;
  const kini = new Date();
  let tahun = kini.getFullYear() - lahir.getFullYear();
  const bulan = kini.getMonth() - lahir.getMonth();
  if (bulan < 0 || (bulan === 0 && kini.getDate() < lahir.getDate())) tahun -= 1;
  return tahun >= 0 && tahun < 130 ? tahun : null;
}

/**
 * Menyamarkan NIK - empat huruf pertama dan tiga terakhir.
 *
 * Cukup untuk mencocokkan dengan kartu di tangan; tidak cukup untuk disalin ke
 * tempat lain. Yang tidak cukup panjang disamarkan seluruhnya, bukan
 * ditampilkan apa adanya: NIK sepotong justru lebih mudah ditebak.
 */
function samarkan(nomor, depan = 4, belakang = 3) {
  const teks = bersih(nomor).replace(/\s+/g, "");
  if (!teks) return "";
  if (teks.length < depan + belakang + 2) return "*".repeat(teks.length);
  return `${teks.slice(0, depan)}${"*".repeat(teks.length - depan - belakang)}${teks.slice(-belakang)}`;
}

// urutan ikut dibaca (9 Okt 2026): "Tergugat I, II, ..." pada naskah hasil
// mediasi dan identitas berjenjang harus mengikuti urutan SIPP, bukan abjad.
// Terukur pada 490/Pdt.G/2026/PA.Dgl: urutan SIPP Zaitun (I) ... Nurlin (VI),
// sedangkan urut nama menjadikan Abd. Salam Tergugat I.
const CABANG_SQL = CABANG.map(
  (ke) => `SELECT perkara_id, pihak_id, ${ke} AS pihak_ke, urutan FROM perkara_pihak${ke}`
).join("\n      UNION ALL ");

/**
 * Kuasa hukum perkara (perkara_pengacara) - nama dan sisinya saja.
 *
 * Dibaca untuk naskah hasil mediasi (PERMA 1/2016 Pasal 27 ayat (3):
 * persetujuan tertulis pihak yang diwakili kuasa). Gagal-terbuka: kuasa yang
 * tidak terbaca dikirim null, BUKAN daftar kosong - "tanpa kuasa" adalah
 * pernyataan yang keliru bila sebenarnya belum terbaca.
 */
async function kuasaPerkara(nomor) {
  try {
    const baris = await kueri(
      `SELECT a.nama AS nama, a.pihak_ke AS pihakKe
         FROM perkara_pengacara a
         JOIN perkara c ON c.perkara_id = a.perkara_id
        WHERE c.nomor_perkara = ?
        ORDER BY a.pihak_ke, a.urutan, a.nama`,
      [nomor]
    );
    return (Array.isArray(baris) ? baris : [])
      .map((b) => ({ nama: bersih(b.nama), pihakKe: Number(b.pihakKe) || 0 }))
      .filter((b) => b.nama);
  } catch {
    return null;
  }
}

/**
 * Identitas para pihak satu perkara.
 *
 * @param {string} nomorPerkara nomor perkara lengkap
 * @returns {Promise<{ok: boolean, alasan?: string, pihak?: object[]}>}
 */
async function identitasPihak(nomorPerkara) {
  const nomor = bersih(nomorPerkara);
  if (!nomor) return { ok: false, alasan: "nomor_perkara_kosong" };

  let baris = [];
  try {
    baris = await kueri(
      `SELECT a.pihak_ke          AS pihakKe,
              b.id                AS pihakId,
              b.nama              AS nama,
              b.jenis_kelamin     AS kelamin,
              b.tempat_lahir      AS tempatLahir,
              b.tanggal_lahir     AS tanggalLahir,
              b.pekerjaan         AS pekerjaan,
              b.pendidikan        AS pendidikan,
              b.agama_nama        AS agama,
              b.status_kawin      AS statusKawin,
              b.warga_negara      AS wargaNegara,
              b.alamat            AS alamat,
              b.rtrw              AS rtrw,
              b.nomor_indentitas  AS nik,
              b.telepon           AS telepon,
              b.difabel           AS difabel,
              kl.kelurahan_nama   AS namaKelurahan,
              kc.kecamatan_nama   AS namaKecamatan,
              kb.kabupaten_nama   AS namaKabupaten,
              pr.provinsi_nama    AS namaProvinsi
         FROM (
              ${CABANG_SQL}
              ) a
         JOIN perkara c ON c.perkara_id = a.perkara_id
         JOIN pihak   b ON b.id = a.pihak_id
         LEFT JOIN ref_kelurahan_new kl ON kl.kelurahan_kode = b.kelurahan
         LEFT JOIN ref_kecamatan_new kc ON kc.kecamatan_kode = b.kecamatan
         LEFT JOIN ref_kabupaten_new kb ON kb.kabupaten_kode = b.kabupaten
         LEFT JOIN ref_provinsi_new  pr ON pr.provinsi_kode  = b.propinsi
        WHERE c.nomor_perkara = ?
        ORDER BY a.pihak_ke, a.urutan IS NULL, a.urutan, b.nama`,
      [nomor]
    );
  } catch (e) {
    return { ok: false, alasan: "gagal_membaca_sipp", pesan: String((e && e.message) || e) };
  }

  const kuasa = await kuasaPerkara(nomor);

  if (!Array.isArray(baris) || baris.length === 0) {
    return { ok: true, pihak: [], kuasa, catatan: "Identitas pihak tidak tercatat untuk perkara ini." };
  }

  const pihak = baris.map((b) => {
    const lahir = tanggalIso(b.tanggalLahir);
    // Wilayah disusun dari yang paling kecil ke yang paling besar, dan yang
    // kosong dilewati - bukan diisi tanda hubung. Deret "—, —, Kabupaten Sigi"
    // lebih sukar dibaca daripada "Kabupaten Sigi" saja.
    const wilayah = [b.namaKelurahan, b.namaKecamatan, b.namaKabupaten, b.namaProvinsi]
      .map((x) => bersih(x))
      .filter(Boolean);

    return {
      pihakId: Number(b.pihakId) || 0,
      pihakKe: Number(b.pihakKe) || 0,
      kedudukan: KEDUDUKAN[Number(b.pihakKe)] || "Pihak",
      nama: bersih(b.nama),
      kelamin:
        bersih(b.kelamin).toUpperCase() === "L"
          ? "Laki-laki"
          : bersih(b.kelamin).toUpperCase() === "P"
            ? "Perempuan"
            : "",
      tempatLahir: bersih(b.tempatLahir),
      tanggalLahir: lahir,
      umur: umurTahun(lahir),
      pekerjaan: bersih(b.pekerjaan),
      pendidikan: bersih(b.pendidikan),
      agama: bersih(b.agama),
      statusKawin: STATUS_KAWIN[Number(b.statusKawin)] || "",
      wargaNegara: bersih(b.wargaNegara),
      alamat: bersih(b.alamat),
      rtrw: bersih(b.rtrw),
      wilayah,
      // Keduanya disamarkan di PELADEN, bukan di layar. Yang disamarkan di
      // layar tetap melintasi jaringan dan tetap tersimpan di singgahan
      // peramban dalam bentuk utuhnya.
      nikSamar: samarkan(b.nik),
      adaNik: Boolean(bersih(b.nik)),
      teleponSamar: samarkan(b.telepon),
      adaTelepon: Boolean(bersih(b.telepon)),
      difabel: bersih(b.difabel).toUpperCase() === "Y",
    };
  });

  return { ok: true, pihak, kuasa };
}

module.exports = {
  KEDUDUKAN,
  STATUS_KAWIN,
  identitasPihak,
  // Diekspor untuk diuji satuan - keduanya aturan yang salahnya tidak berbunyi.
  samarkan,
  umurTahun,
  tanggalIso,
};
