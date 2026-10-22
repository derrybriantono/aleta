"use strict";

const { relaasRetur, sqlRetur } = require("./returRelaas");

const { sqlDariSetempat } = require("../utils/waktuUtc");

/**
 * ============================================================================
 * CHECKLIST MILESTONE - PEMBACA FAKTANYA
 * ============================================================================
 *
 * Berkas ini HANYA MEMBACA SIPP (dan dua tabel milik bot). Tidak ada satu pun
 * INSERT, UPDATE, atau DELETE di sini.
 *
 * Pembagiannya sama dengan penjaga tenggat: bot menyusun FAKTA, portal yang
 * MEMUTUSKAN - apakah suatu perkara menjadi butir checklist, kapan
 * tenggatnya, dan apakah pekerjaannya sudah selesai. Aturannya hidup di
 * manajemen_surat/src/lib/checklist-milestone.ts, tempat ia dapat diuji
 * seribu kali tanpa menyentuh SIPP.
 *
 * ============================================================================
 * DIBATASI PADA PERKARA MILIK PENGGUNA
 * ============================================================================
 *
 * Peran perorangan (hakim, panitera pengganti, juru sita) hanya membaca
 * perkara yang menyebut id pejabatnya pada tabel penghubung SIPP yang AKTIF:
 * perkara_hakim_pn, perkara_panitera_pn, perkara_jurusita. Id itu dibaca
 * portal dari user_hakim/user_panitera/user_jurusita (pemetaan-jabatan.ts) -
 * bukan dari kemiripan nama. Id yang kosong berarti TIDAK ADA baris yang
 * dibaca, bukan seluruh satker.
 *
 * Peran satker (panitera, ketua, PTSP, operator) membaca seluruh satker,
 * tetapi selalu dalam jendela tanggal yang sempit.
 *
 * ============================================================================
 * TIAP KOLEKSI GAGAL SENDIRI-SENDIRI
 * ============================================================================
 *
 * Satu kueri yang gagal hanya mengosongkan koleksinya sendiri, dan namanya
 * dicatat di `gagal`. Portal membaca `gagal` itu dan TIDAK menyimpulkan
 * "tidak ada pekerjaan" dari koleksi yang gagal - kekosongan karena gagal
 * dan kekosongan karena beres harus tetap dapat dibedakan.
 *
 * Tidak ada v_pihak_perkara di sini (8,5 detik untuk 20 perkara), dan tidak
 * ada nama pihak yang dipulangkan: checklist menyebut nomor perkara, bukan
 * orang yang berperkara.
 */

const db = require("../db_config");
const botDb = require("./botDbService");
const sippJadwalSidangService = require("./sippJadwalSidangService");
const penjagaTenggatService = require("./penjagaTenggatService");
const ecourtSchedulerService = require("./ecourtSchedulerService");
const { AMBANG_PANJAR_TIPIS } = require("./penandaSippService");
const { AMBANG_SISA_RUPIAH } = require("./penilaianSisaPanjarService");

/** Status putusan SIPP untuk perceraian yang dikabulkan (sama dengan penjaga tenggat). */
const STATUS_DIKABULKAN = penjagaTenggatService.STATUS_DIKABULKAN;

/**
 * Batas baris tiap koleksi - penjaga, bukan saringan. Kueri meminta satu
 * baris lebih supaya "tepat sebanyak batas" dapat dibedakan dari "terpotong",
 * dan yang terpotong DISEBUT di `catatan` (potongBatas). Urutannya dipilih
 * supaya yang terbuang adalah yang paling tidak mendesak: yang terbaru untuk
 * jendela ke belakang, yang terdekat ke hari acuan untuk jendela sidang.
 */
const BATAS_BARIS = 1500;

/** Batas koleksi yang lebih kecil (500) - urutannya sudah yang paling mendesak lebih dulu. */
const BATAS_SEDANG = 500;

/**
 * Fungsi peta sippJadwalSidangService (putusan, ikrar, petugas, panggilan)
 * membaca paling banyak 500 id per panggilan dan diam-diam membuang sisanya.
 * Jendela satker dapat memuat lebih dari itu, jadi idnya dikirim bertahap.
 */
const POTONGAN_PETA = 500;

/** Pelapor bawaan untuk pemanggilan langsung (uji, pengukuran) di luar bacaFakta. */
const ALAT_DIAM = { lapor() {}, terpotong() {} };

function pesanGalat(galat) {
  return String((galat && galat.message) || galat).slice(0, 200);
}

/** Baris di atas batas dibuang - dan disebut lewat alat.terpotong, bukan diam-diam. */
function potongBatas(baris, batas, alat, keterangan) {
  if (baris.length <= batas) return baris;
  (alat || ALAT_DIAM).terpotong(batas, keterangan);
  return baris.slice(0, batas);
}

/** Urut naik menurut kunci [teks|angka, ...] - mengembalikan urutan lama sesudah kueri berurut turun. */
function urutNaik(baris, kunci) {
  return [...baris].sort((a, b) => {
    const ka = kunci(a);
    const kb = kunci(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
}

/** Peta per id, dibaca POTONGAN_PETA id sekali. null bila salah satu bagian menjawab null (tabel/kolom tidak ada). */
async function petaBertahap(daftar, baca) {
  const hasil = {};
  for (let i = 0; i < daftar.length; i += POTONGAN_PETA) {
    const bagian = await baca(daftar.slice(i, i + POTONGAN_PETA));
    if (bagian === null) return null;
    Object.assign(hasil, bagian || {});
  }
  return hasil;
}

/** Sidang ikrar talak - penciri yang sama dengan sidangIkrar di portal (lib/keadaan-sidang.ts). */
function adalahSidangIkrar(baris) {
  const bendera = baris.sidangIkrarTalak === true || teks(baris.ikrarTalak).toUpperCase() === "Y";
  return bendera || /\bikrar\b/i.test(teks(baris.agenda));
}

const PERAN_SAH = ["hakim", "panitera-pengganti", "jurusita", "panitera", "ketua", "ptsp", "operator"];

function jalankan(sql, nilai = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, nilai, (galat, baris) => (galat ? gagal(galat) : selesai(Array.isArray(baris) ? baris : [])));
  });
}

/** yyyy-mm-dd dari Date atau teks (Date dibaca menurut jam lokal peladen, sama dengan penjaga tenggat). */
function isoTanggal(nilai) {
  return penjagaTenggatService.isoTanggal(nilai);
}

/** yyyy-mm-dd HH:MM:SS dari DATETIME SIPP, tanpa menggeser zona. */
function waktuTeks(nilai) {
  if (!nilai) return "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    const d = (x) => String(x).padStart(2, "0");
    return `${isoTanggal(nilai)} ${d(nilai.getHours())}:${d(nilai.getMinutes())}:${d(nilai.getSeconds())}`;
  }
  const cocok = String(nilai).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return cocok ? `${cocok[1]} ${cocok[2]}` : isoTanggal(nilai);
}

function teks(nilai) {
  return String(nilai == null ? "" : nilai).trim();
}

function terisi(nilai) {
  const t = teks(nilai);
  return t !== "" && t !== "-" && t !== "0";
}

/** Tanggal acuan digeser sekian hari (boleh negatif). */
function geser(acuanIso, hari) {
  const t = new Date(`${acuanIso}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + hari);
  return t.toISOString().slice(0, 10);
}

/** Daftar id bilangan bulat positif, unik, paling banyak 50. */
function daftarId(mentah) {
  const hasil = [];
  for (const x of String(mentah == null ? "" : mentah).split(",")) {
    const n = Number(String(x).trim());
    if (Number.isInteger(n) && n > 0 && !hasil.includes(n)) hasil.push(n);
  }
  return hasil.slice(0, 50);
}

/* ========================================================================== */
/* LINGKUP                                                                    */
/* ========================================================================== */

/**
 * Syarat SQL "perkara ini milik pengguna" untuk alias tabel perkara tertentu.
 *
 * Nilainya dipulangkan bersama syaratnya supaya urutan tanda tanya tidak
 * pernah bergeser dari urutan nilainya - kekeliruan yang tidak berbunyi apa
 * pun, hanya menghasilkan perkara orang lain.
 */
function syaratLingkup(lingkup, kolomPerkara) {
  if (lingkup.jenis === "satker") return { sql: "1 = 1", nilai: [] };
  const tanya = lingkup.id.map(() => "?").join(", ");
  if (lingkup.jenis === "hakim") {
    return {
      sql: `EXISTS (SELECT 1 FROM perkara_hakim_pn lh
                     WHERE lh.perkara_id = ${kolomPerkara} AND lh.aktif = 'Y' AND lh.hakim_id IN (${tanya}))`,
      nilai: [...lingkup.id],
    };
  }
  if (lingkup.jenis === "panitera") {
    return {
      sql: `EXISTS (SELECT 1 FROM perkara_panitera_pn lp
                     WHERE lp.perkara_id = ${kolomPerkara} AND lp.aktif = 'Y' AND lp.panitera_id IN (${tanya}))`,
      nilai: [...lingkup.id],
    };
  }
  return {
    sql: `EXISTS (SELECT 1 FROM perkara_jurusita lj
                   WHERE lj.perkara_id = ${kolomPerkara} AND lj.aktif = 'Y' AND lj.jurusita_id IN (${tanya}))`,
    nilai: [...lingkup.id],
  };
}

/**
 * Jabatan hakim pengguna pada perkara itu (1 ketua, 2 anggota, 3 tunggal) -
 * dipakai aturan yang hanya menagih ketua majelis atau hakim tunggal.
 * NULL untuk lingkup selain hakim.
 */
function kolomJabatan(lingkup, kolomPerkara) {
  // Tanpa id: NULL, BUKAN "IN ()". Terjadi pada perkara tambahan (konseptor
  // sementara, titipan PHS) milik hakim yang belum tertaut ke akun SIPP -
  // ditemukan uji ujung-ke-ujung sebagai ER_PARSE_ERROR yang mengosongkan
  // seluruh koleksi perkaraTertentu.
  if (lingkup.jenis !== "hakim" || lingkup.id.length === 0) return { sql: "NULL AS jabatanSaya", nilai: [] };
  const tanya = lingkup.id.map(() => "?").join(", ");
  return {
    sql: `(SELECT MIN(jh.jabatan_hakim_id) FROM perkara_hakim_pn jh
            WHERE jh.perkara_id = ${kolomPerkara} AND jh.aktif = 'Y' AND jh.hakim_id IN (${tanya})) AS jabatanSaya`,
    nilai: [...lingkup.id],
  };
}

function lingkupKosong(lingkup) {
  return lingkup.jenis !== "satker" && lingkup.id.length === 0;
}

/* ========================================================================== */
/* KOLEKSI                                                                    */
/* ========================================================================== */

/**
 * Sidang dalam satu jendela, beserta keterangan yang dibutuhkan aturan hasil
 * sidang, BAS, dan panggilan.
 *
 * Ruasnya SENGAJA sama dengan baris daftarSidang (sippJadwalSidangService):
 * aturan "hasil sidang belum dicatat" di portal (lib/keadaan-sidang.ts)
 * dipakai ulang apa adanya, dan aturan itu hanya benar bila masukannya
 * dibentuk dengan cara yang sama - termasuk putusanTerbaca/ikrarTerbaca yang
 * membuatnya diam bila peta putusan atau ikrar gagal dibaca.
 */
async function koleksiSidang(lingkup, { dari, sampai, acuan, panggilan = false, petugas = false, alat = ALAT_DIAM }) {
  if (lingkupKosong(lingkup)) return [];
  const syarat = syaratLingkup(lingkup, "j.perkara_id");
  const jabatan = kolomJabatan(lingkup, "j.perkara_id");

  // Diurutkan menurut JARAK ke hari acuan: bila jendelanya memuat lebih dari
  // BATAS_BARIS sidang, yang terbuang adalah yang terjauh - bukan sidang hari
  // ini (urutan tanggal naik membuang yang terbaru). Urutan lamanya
  // dikembalikan sesudah dipotong.
  const mentah = await jalankan(
    `SELECT j.id AS sidangId, j.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, p.alur_perkara_id AS alurPerkaraId,
            j.tanggal_sidang AS tanggalSidang, j.jam_sidang AS jamSidang, j.agenda AS agenda,
            j.urutan AS urutan, j.ditunda AS ditunda, j.alasan_ditunda AS alasanDitunda,
            j.dihadiri_oleh AS dihadiriOleh, j.edoc_bas AS edocBas, j.ikrar_talak AS ikrarTalak,
            ${jabatan.sql}
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
      WHERE j.tanggal_sidang BETWEEN ? AND ?
        AND ${syarat.sql}
      ORDER BY ABS(DATEDIFF(j.tanggal_sidang, ?)) ASC, j.tanggal_sidang ASC, j.id ASC
      LIMIT ${BATAS_BARIS + 1}`,
    [...jabatan.nilai, dari, sampai, ...syarat.nilai, acuan || sampai]
  );
  const baris = urutNaik(potongBatas(mentah, BATAS_BARIS, alat, "sidang yang tanggalnya paling dekat dengan hari ini"), (b) => [
    isoTanggal(b.tanggalSidang),
    teks(b.jamSidang),
    Number(b.sidangId) || 0,
  ]);
  if (baris.length === 0) return [];

  const idPerkara = [...new Set(baris.map((b) => Number(b.perkaraId)).filter(Boolean))];

  // Peta pelengkap, gagal sendiri-sendiri - lihat catatan pada daftarSidang.
  // Kegagalannya ditandai per baris (putusanTerbaca dan kawan-kawan) DAN
  // dilaporkan ke `gagal` tingkat atas lewat alat.lapor, supaya portal dapat
  // menyebutnya di galat, bukan hanya diam.
  const gagal = new Set();
  const aman = async (kerja, nama) => {
    try {
      const hasil = await kerja();
      if (hasil === null) {
        gagal.add(nama);
        alat.lapor(nama, "tabel atau kolomnya tidak ada di SIPP ini");
        return {};
      }
      return hasil || {};
    } catch (galat) {
      gagal.add(nama);
      alat.lapor(nama, galat);
      return {};
    }
  };

  const [petaPutusan, petaIkrar, petaBerikut, petaPetugas] = await Promise.all([
    aman(() => petaBertahap(idPerkara, sippJadwalSidangService.putusanBanyakPerkara), "putusan"),
    aman(() => petaBertahap(idPerkara, sippJadwalSidangService.ikrarBanyakPerkara), "ikrar"),
    aman(() => sidangBerikutBanyak(idPerkara), "berikut"),
    petugas
      ? aman(() => petaBertahap(idPerkara, sippJadwalSidangService.petugasBanyakPerkara), "petugas")
      : Promise.resolve({}),
  ]);

  const rapi = baris.map((b) => {
    const kunciPerkara = String(b.perkaraId);
    const putusan = petaPutusan[kunciPerkara] || {};
    const berikut = petaBerikut[String(b.sidangId)] || null;
    const petugasPerkara = petaPetugas[kunciPerkara] || {};
    return {
      sidangId: String(b.sidangId),
      perkaraId: kunciPerkara,
      nomorPerkara: teks(b.nomorPerkara),
      jenisPerkara: teks(b.jenisPerkara),
      alurPerkaraId: Number(b.alurPerkaraId) || 0,
      tanggalSidang: isoTanggal(b.tanggalSidang),
      jamSidang: teks(b.jamSidang).slice(0, 5),
      agenda: teks(b.agenda),
      urutan: Number(b.urutan) || 0,
      ditunda: teks(b.ditunda).toUpperCase() === "Y",
      alasanDitunda: teks(b.alasanDitunda),
      dihadiriOleh: b.dihadiriOleh === null || b.dihadiriOleh === undefined ? null : Number(b.dihadiriOleh),
      adaBas: terisi(b.edocBas),
      sidangIkrarTalak: teks(b.ikrarTalak).toUpperCase() === "Y",
      ikrarTercatat: Boolean(petaIkrar[kunciPerkara]) && petaIkrar[kunciPerkara] === isoTanggal(b.tanggalSidang),
      putusanTerbaca: !gagal.has("putusan"),
      ikrarTerbaca: !gagal.has("ikrar"),
      berikutTerbaca: !gagal.has("berikut"),
      sudahPutus: Boolean(putusan.tanggalPutusan),
      tanggalPutusan: putusan.tanggalPutusan || "",
      tanggalSidangBerikut: berikut ? berikut.tanggal : "",
      sidangBerikutId: berikut ? berikut.sidangId : "",
      sidangBerikutIkrar: berikut ? berikut.ikrar === true : false,
      jabatanSaya: b.jabatanSaya === null || b.jabatanSaya === undefined ? null : Number(b.jabatanSaya),
      majelisKode: teks(petugasPerkara.majelisKode),
      jurusitaNama: teks(petugasPerkara.jurusitaNama),
      paniteraNama: teks(petugasPerkara.paniteraNama),
      panggilan: null,
      panggilanBerikut: null,
    };
  });

  if (panggilan) {
    // Keadaan panggilan dihitung oleh fungsi yang SAMA dengan Antrian Sidang
    // (keadaanPanggilanSidang): siapa wajib dipanggil menurut kehadiran sidang
    // sebelumnya, siapa belum punya relaas, dan berapa yang retur. Dihitung
    // untuk sidang yang belum lewat dan untuk sidang lanjutan dari sidang
    // yang ditunda - itulah sidang yang panggilannya masih dapat dikerjakan.
    //
    // Sidang ikrar talak ditandai wajibSemuaSisi: suami DAN istri dipanggil
    // (Pasal 70 ayat (3) UU 7/1989), walau keduanya hadir saat putusan -
    // tanpa penanda itu keadaanPanggilanSidang menjawab "tidak ada yang wajib
    // dipanggil" dan sidang ikrarnya tidak pernah ditagih.
    const sasaran = [];
    for (const s of rapi) {
      if (s.tanggalSidang >= acuan) {
        sasaran.push({ sidangId: s.sidangId, perkaraId: s.perkaraId, wajibSemuaSisi: adalahSidangIkrar(s) });
      }
      if (s.sidangBerikutId) {
        sasaran.push({ sidangId: s.sidangBerikutId, perkaraId: s.perkaraId, wajibSemuaSisi: s.sidangBerikutIkrar });
      }
    }
    const unik = [...new Map(sasaran.map((x) => [x.sidangId, x])).values()];
    let petaPanggilan = {};
    try {
      // keadaanPanggilanSidang membaca paling banyak 500 sidang sekali.
      for (let i = 0; i < unik.length; i += POTONGAN_PETA) {
        Object.assign(petaPanggilan, await sippJadwalSidangService.keadaanPanggilanSidang(unik.slice(i, i + POTONGAN_PETA)));
      }
    } catch (galat) {
      gagal.add("panggilan");
      alat.lapor("panggilan", galat);
      petaPanggilan = {};
    }
    const ringkas = (p) =>
      p
        ? {
            wajibDipanggil: Array.isArray(p.wajibDipanggil) ? p.wajibDipanggil : [],
            sisiBelumDipanggil: Array.isArray(p.sisiBelumDipanggil) ? p.sisiBelumDipanggil : [],
            belumDipanggil: Number(p.belumDipanggil) || 0,
            retur: Number(p.retur) || 0,
          }
        : null;
    for (const s of rapi) {
      s.panggilanTerbaca = !gagal.has("panggilan");
      s.panggilan = ringkas(petaPanggilan[s.sidangId]);
      s.panggilanBerikut = s.sidangBerikutId ? ringkas(petaPanggilan[s.sidangBerikutId]) : null;
    }
  }

  return rapi;
}

/**
 * Sidang berikutnya (id DAN tanggal) untuk tiap sidang perkara-perkara ini.
 *
 * Urutannya sama dengan sippJadwalSidangService.sidangBerikutnya (tanggal,
 * lalu id); yang itu hanya memulangkan tanggal, sedangkan panggilan untuk
 * sidang lanjutan perlu tahu id sidangnya.
 */
async function sidangBerikutBanyak(idPerkara) {
  const hasil = {};
  // Bertahap per POTONGAN_PETA perkara - sebelumnya perkara ke-501 dan
  // seterusnya tidak punya sidang lanjutan, dan sidangnya dituduh belum
  // berhasil. Satu perkara tidak pernah terbelah di dua tahap.
  for (let awal = 0; awal < idPerkara.length; awal += POTONGAN_PETA) {
    const id = idPerkara.slice(awal, awal + POTONGAN_PETA);
    const baris = await jalankan(
      `SELECT j.id AS sidangId, j.perkara_id AS perkaraId, j.tanggal_sidang AS tanggalSidang,
              j.ikrar_talak AS ikrarTalak, j.agenda AS agenda
         FROM perkara_jadwal_sidang j
        WHERE j.perkara_id IN (${id.map(() => "?").join(", ")})
        ORDER BY j.perkara_id ASC, j.tanggal_sidang ASC, j.id ASC`,
      id
    );
    const perPerkara = {};
    for (const b of baris) {
      const k = String(b.perkaraId);
      if (!perPerkara[k]) perPerkara[k] = [];
      perPerkara[k].push({ sidangId: String(b.sidangId), tanggal: isoTanggal(b.tanggalSidang), ikrar: adalahSidangIkrar(b) });
    }
    for (const daftar of Object.values(perPerkara)) {
      for (let i = 0; i < daftar.length - 1; i += 1) hasil[daftar[i].sidangId] = daftar[i + 1];
    }
  }
  return hasil;
}

/**
 * Putusan dalam satu jendela, dengan kehadiran pada sidang putusnya dan
 * pemberitahuan putusan per sisi.
 *
 * sisi pihak pada perkara_putusan_pemberitahuan_putusan: 1 pihak pertama,
 * 2 pihak kedua (diukur: 12.071 baris sisi 1, 5.281 sisi 2, 6 sisi 4).
 */
async function koleksiPutusan(lingkup, { dari, sampai, alat = ALAT_DIAM }) {
  if (lingkupKosong(lingkup)) return [];
  const syarat = syaratLingkup(lingkup, "pu.perkara_id");
  const jabatan = kolomJabatan(lingkup, "pu.perkara_id");

  // Terbaru lebih dulu: panitera membaca 12 bulan seluruh satker (1.004
  // putusan di sipp_donggala), dan bila batasnya terlampaui yang terbuang
  // harus putusan tertua - bukan putusan minggu ini.
  const mentah = await jalankan(
    `SELECT pu.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, p.alur_perkara_id AS alurPerkaraId,
            pu.tanggal_putusan AS tanggalPutusan, pu.putusan_verstek AS verstek,
            pu.status_putusan_id AS statusPutusanId, pu.tanggal_bht AS tanggalBht,
            pu.diinput_tanggal AS diinputTanggal,
            CASE WHEN pu.amar_putusan_dok IS NOT NULL AND TRIM(pu.amar_putusan_dok) <> '' THEN 1 ELSE 0 END AS adaDok,
            CASE WHEN pu.amar_putusan_anonimisasi_dok IS NOT NULL
                  AND TRIM(pu.amar_putusan_anonimisasi_dok) <> '' THEN 1 ELSE 0 END AS adaAnonim,
            (SELECT j.dihadiri_oleh FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = pu.perkara_id AND j.tanggal_sidang = pu.tanggal_putusan
              ORDER BY j.id DESC LIMIT 1) AS dihadiriSaatPutus,
            (SELECT MAX(b.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan b
              WHERE b.perkara_id = pu.perkara_id AND b.pihak = 1) AS pbtPihak1,
            (SELECT MAX(b.tanggal_pemberitahuan_putusan) FROM perkara_putusan_pemberitahuan_putusan b
              WHERE b.perkara_id = pu.perkara_id AND b.pihak = 2) AS pbtPihak2,
            EXISTS (SELECT 1 FROM perkara_pihak2 x WHERE x.perkara_id = pu.perkara_id) AS adaPihak2,
            (SELECT MIN(bd.permohonan_banding) FROM perkara_banding bd
              WHERE bd.perkara_id = pu.perkara_id) AS tanggalBanding,
            ${jabatan.sql}
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
      WHERE pu.tanggal_putusan BETWEEN ? AND ?
        AND ${syarat.sql}
      ORDER BY pu.tanggal_putusan DESC, pu.perkara_id DESC
      LIMIT ${BATAS_BARIS + 1}`,
    [...jabatan.nilai, dari, sampai, ...syarat.nilai]
  );
  const baris = urutNaik(potongBatas(mentah, BATAS_BARIS, alat, "putusan terbaru"), (b) => [
    isoTanggal(b.tanggalPutusan),
    Number(b.perkaraId) || 0,
  ]);

  return baris.map((b) => ({
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    jenisPerkara: teks(b.jenisPerkara),
    alurPerkaraId: Number(b.alurPerkaraId) || 0,
    tanggalPutusan: isoTanggal(b.tanggalPutusan),
    diinputTanggal: isoTanggal(b.diinputTanggal),
    verstek: teks(b.verstek).toUpperCase() === "Y",
    statusPutusanId: b.statusPutusanId === null || b.statusPutusanId === undefined ? null : Number(b.statusPutusanId),
    tanggalBht: isoTanggal(b.tanggalBht),
    adaDok: Number(b.adaDok) === 1,
    adaAnonim: Number(b.adaAnonim) === 1,
    dihadiriSaatPutus:
      b.dihadiriSaatPutus === null || b.dihadiriSaatPutus === undefined ? null : Number(b.dihadiriSaatPutus),
    pbtPihak1: isoTanggal(b.pbtPihak1),
    pbtPihak2: isoTanggal(b.pbtPihak2),
    adaPihak2: Number(b.adaPihak2) === 1,
    tanggalBanding: isoTanggal(b.tanggalBanding),
    jabatanSaya: b.jabatanSaya === null || b.jabatanSaya === undefined ? null : Number(b.jabatanSaya),
  }));
}

/**
 * Sidang yang hasilnya tercatat PUTUS tetapi perkara_putusan belum berisi
 * tanggal putusan - borang Putusan Akhir SIPP belum diisi.
 *
 * "Putus" dibaca dari alasan_ditunda pada sidang yang tidak ditunda, dengan
 * pola yang sama dengan hasilSidangPutusan di portal (lib/hasil-sidang.ts);
 * portal memeriksanya sekali lagi dengan fungsi itu sendiri.
 */
async function koleksiPutusTanpaPutusan(lingkup, { dari, sampai, alat = ALAT_DIAM }) {
  if (lingkupKosong(lingkup)) return [];
  const syarat = syaratLingkup(lingkup, "j.perkara_id");
  const mentah = await jalankan(
    `SELECT j.id AS sidangId, j.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            j.tanggal_sidang AS tanggalSidang, j.ditunda AS ditunda, j.alasan_ditunda AS alasanDitunda,
            pu.tanggal_putusan AS tanggalPutusan, pu.diinput_tanggal AS diinputPutusan
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = j.perkara_id
      WHERE j.tanggal_sidang BETWEEN ? AND ?
        AND j.ditunda <> 'Y'
        AND j.alasan_ditunda LIKE '%putus%'
        AND ${syarat.sql}
      ORDER BY j.tanggal_sidang DESC, j.id DESC
      LIMIT ${BATAS_BARIS + 1}`,
    [dari, sampai, ...syarat.nilai]
  );
  const baris = urutNaik(potongBatas(mentah, BATAS_BARIS, alat, "sidang terbaru"), (b) => [
    isoTanggal(b.tanggalSidang),
    Number(b.sidangId) || 0,
  ]);
  return baris.map((b) => ({
    sidangId: String(b.sidangId),
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    tanggalSidang: isoTanggal(b.tanggalSidang),
    ditunda: teks(b.ditunda).toUpperCase() === "Y",
    alasanDitunda: teks(b.alasanDitunda),
    tanggalPutusan: isoTanggal(b.tanggalPutusan),
    diinputPutusan: isoTanggal(b.diinputPutusan),
  }));
}

/**
 * Perkara yang belum putus, beserta umurnya menurut durasiBanyakPerkara -
 * fungsi yang sama dengan penanda umur di Antrian Sidang (hari mediasi
 * dikeluarkan, PERMA 1/2016 Pasal 24).
 *
 * Yang dipulangkan tanggal daftar dan hari mediasinya, bukan sisa hari:
 * durasiBanyakPerkara menghitung sampai JAM PELADEN, sedangkan portal
 * menghitung terhadap tanggal acuannya sendiri.
 */
async function koleksiBerjalan(lingkup, { acuan, alat = ALAT_DIAM }) {
  if (lingkupKosong(lingkup)) return [];
  const syarat = syaratLingkup(lingkup, "p.perkara_id");
  const jabatan = kolomJabatan(lingkup, "p.perkara_id");
  // Terlama lebih dulu SENGAJA: perkara terlama yang paling dekat dengan
  // batas lima bulan, jadi bila batasnya terlampaui yang terbuang yang paling
  // muda - dan itu disebut.
  const mentah = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, p.tanggal_pendaftaran AS tanggalDaftar,
            ${jabatan.sql}
       FROM perkara p
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE pu.tanggal_putusan IS NULL
        AND p.tanggal_pendaftaran BETWEEN ? AND ?
        AND ${syarat.sql}
      ORDER BY p.tanggal_pendaftaran ASC
      LIMIT ${BATAS_SEDANG + 1}`,
    [...jabatan.nilai, penjagaTenggatService.mundurBulan(acuan, 24), acuan, ...syarat.nilai]
  );
  const baris = potongBatas(mentah, BATAS_SEDANG, alat, "perkara terlama (paling dekat dengan batas lima bulan)");
  if (baris.length === 0) return [];

  // durasiBanyakPerkara menelan kegagalannya sendiri (pemakai lain memang
  // membutuhkannya begitu). Di sini kegagalan itu HARUS terbaca: tanpa hari
  // mediasi, hari ke-150 jatuh lebih awal dan majelis dituduh lewat batas;
  // tanpa baris perkaranya, seluruh daftar lima bulan kosong diam-diam.
  // Karena itu bagian mana pun yang gagal membuat SELURUH umur tak terbaca.
  let durasiGagal = "";
  let petaDurasi = {};
  try {
    petaDurasi = await sippJadwalSidangService.durasiBanyakPerkara(
      baris.map((b) => b.perkaraId),
      { catatGagal: (bagian, galat) => (durasiGagal = durasiGagal || `${bagian}: ${pesanGalat(galat)}`) }
    );
  } catch (galat) {
    durasiGagal = pesanGalat(galat);
  }
  if (durasiGagal) alat.lapor("durasi", durasiGagal);
  const petaPetugas =
    lingkup.jenis === "satker"
      ? await petaBertahap(
          baris.map((b) => b.perkaraId),
          sippJadwalSidangService.petugasBanyakPerkara
        ).catch((galat) => {
          alat.lapor("petugas", galat);
          return {};
        })
      : {};

  return baris.map((b) => {
    const durasi = petaDurasi[String(b.perkaraId)] || {};
    return {
      perkaraId: String(b.perkaraId),
      nomorPerkara: teks(b.nomorPerkara),
      jenisPerkara: teks(b.jenisPerkara),
      tanggalDaftar: isoTanggal(b.tanggalDaftar),
      hariMediasi: Number(durasi.hariMediasi) || 0,
      durasiTerbaca: !durasiGagal && Boolean(petaDurasi[String(b.perkaraId)]),
      jabatanSaya: b.jabatanSaya === null || b.jabatanSaya === undefined ? null : Number(b.jabatanSaya),
      majelisKode: teks((petaPetugas[String(b.perkaraId)] || {}).majelisKode),
    };
  });
}

/**
 * Mediasi yang dipegang hakim pengguna sebagai mediator.
 *
 * perkara_mediasi.mediator_id menunjuk tabel mediator, BUKAN hakim_id -
 * diukur: Himawan bermediator_id 25 tetapi hakim_id 26. Karena itu disambung
 * lewat mediator.hakim_id. Tenggatnya dihitung dengan rumus yang sama dengan
 * daftarJadwalMediasi: penetapan mediator + BATAS_MEDIASI_HARI, dan selesai
 * saat laporan mediator masuk.
 */
async function koleksiMediasi(hakimId, { acuan, alat = ALAT_DIAM }) {
  if (hakimId.length === 0) return [];
  const tanya = hakimId.map(() => "?").join(", ");
  const mentah = await jalankan(
    `SELECT m.mediasi_id AS mediasiId, m.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            m.penetapan_penunjukan_mediator AS penetapanMediator,
            m.dimulai_mediasi AS dimulaiMediasi, m.tgl_laporan_mediator AS laporanMediator
       FROM perkara_mediasi m
       JOIN mediator md ON md.id = m.mediator_id
       JOIN perkara p ON p.perkara_id = m.perkara_id
      WHERE md.hakim_id IN (${tanya})
        AND m.penetapan_penunjukan_mediator BETWEEN ? AND ?
      ORDER BY m.penetapan_penunjukan_mediator ASC
      LIMIT ${BATAS_SEDANG + 1}`,
    [...hakimId, geser(acuan, -120), acuan]
  );
  const baris = potongBatas(mentah, BATAS_SEDANG, alat, "penetapan mediator terlama (paling lewat tenggat)");
  return baris.map((b) => {
    const penetapan = isoTanggal(b.penetapanMediator);
    return {
      mediasiId: String(b.mediasiId),
      perkaraId: String(b.perkaraId),
      nomorPerkara: teks(b.nomorPerkara),
      penetapanMediator: penetapan,
      dimulaiMediasi: isoTanggal(b.dimulaiMediasi),
      laporanMediator: isoTanggal(b.laporanMediator),
      tenggatPerma: penetapan ? sippJadwalSidangService.geserHari(penetapan, sippJadwalSidangService.BATAS_MEDIASI_HARI) : "",
    };
  });
}

/**
 * Cerai talak yang dikabulkan, sudah BHT, dan ikrarnya belum diucapkan -
 * beserta yang ikrarnya baru saja diucapkan (untuk "selesai hari ini").
 *
 * Diukur di sipp_donggala (BHT sejak September 2025): 89 perkara; penetapan
 * hari sidang ikrar rata-rata 2,4 hari sesudah BHT (0 sampai 15 hari); 2
 * perkara tanpa penetapan sidang ikrar, 10 sudah ditetapkan tetapi ikrarnya
 * belum tercatat.
 */
async function koleksiIkrar(lingkup, { acuan, alat = ALAT_DIAM }) {
  if (lingkupKosong(lingkup)) return [];
  const syarat = syaratLingkup(lingkup, "pu.perkara_id");
  const jabatan = kolomJabatan(lingkup, "pu.perkara_id");
  const mentah = await jalankan(
    `SELECT pu.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            pu.tanggal_bht AS tanggalBht, pu.status_putusan_id AS statusPutusanId,
            it.tanggal_penetapan_sidang_ikrar AS penetapanSidangIkrar,
            it.tgl_ikrar_talak AS tanggalIkrar,
            (SELECT MIN(j.tanggal_sidang) FROM perkara_jadwal_sidang j
              WHERE j.perkara_id = pu.perkara_id AND j.ikrar_talak = 'Y' AND j.tanggal_sidang >= ?) AS sidangIkrarBerikut,
            ${jabatan.sql}
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
       LEFT JOIN perkara_ikrar_talak it ON it.perkara_id = pu.perkara_id
      WHERE p.jenis_perkara_nama = 'Cerai Talak'
        AND pu.status_putusan_id = ?
        AND pu.tanggal_bht IS NOT NULL
        AND pu.tanggal_bht BETWEEN ? AND ?
        AND (it.tgl_ikrar_talak IS NULL OR it.tgl_ikrar_talak >= ?)
        AND ${syarat.sql}
      ORDER BY (it.tanggal_penetapan_sidang_ikrar IS NULL) DESC, it.tanggal_penetapan_sidang_ikrar ASC, pu.tanggal_bht ASC
      LIMIT ${BATAS_SEDANG + 1}`,
    [
      acuan,
      ...jabatan.nilai,
      STATUS_DIKABULKAN,
      penjagaTenggatService.mundurBulan(acuan, 24),
      acuan,
      geser(acuan, -7),
      ...syarat.nilai,
    ]
  );
  const baris = potongBatas(mentah, BATAS_SEDANG, alat, "penetapan hari sidang ikrar terlama (paling dekat dengan batas 6 bulan)");
  return baris.map((b) => ({
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    tanggalBht: isoTanggal(b.tanggalBht),
    statusPutusanId: b.statusPutusanId === null || b.statusPutusanId === undefined ? null : Number(b.statusPutusanId),
    penetapanSidangIkrar: isoTanggal(b.penetapanSidangIkrar),
    tanggalIkrar: isoTanggal(b.tanggalIkrar),
    sidangIkrarBerikut: isoTanggal(b.sidangIkrarBerikut),
    jabatanSaya: b.jabatanSaya === null || b.jabatanSaya === undefined ? null : Number(b.jabatanSaya),
  }));
}

/**
 * Keadaan sejumlah perkara tertentu - dipakai untuk perkara yang ditunjuk
 * lewat ALETA (konseptor sementara, antrean PHS): sudah putus atau belum,
 * sidang mendatangnya, dan jabatan hakim pengguna di sana.
 */
async function koleksiPerkaraTertentu(lingkup, idPerkara, { acuan }) {
  const id = idPerkara.slice(0, 300);
  if (id.length === 0) return [];
  const jabatan = kolomJabatan(lingkup, "p.perkara_id");
  const tanya = id.map(() => "?").join(", ");
  const [baris, sidang] = await Promise.all([
    jalankan(
      `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
              p.jenis_perkara_nama AS jenisPerkara,
              pu.tanggal_putusan AS tanggalPutusan, pu.diinput_tanggal AS diinputPutusan,
              ${jabatan.sql}
         FROM perkara p
         LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
        WHERE p.perkara_id IN (${tanya})`,
      [...jabatan.nilai, ...id]
    ),
    jalankan(
      `SELECT j.perkara_id AS perkaraId, j.tanggal_sidang AS tanggalSidang, j.agenda AS agenda
         FROM perkara_jadwal_sidang j
        WHERE j.perkara_id IN (${tanya}) AND j.tanggal_sidang >= ?
        ORDER BY j.tanggal_sidang ASC, j.id ASC`,
      [...id, acuan]
    ),
  ]);
  const mendatang = {};
  for (const s of sidang) {
    const k = String(s.perkaraId);
    if (!mendatang[k]) mendatang[k] = [];
    if (mendatang[k].length < 5) mendatang[k].push({ tanggal: isoTanggal(s.tanggalSidang), agenda: teks(s.agenda) });
  }
  return baris.map((b) => ({
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    jenisPerkara: teks(b.jenisPerkara),
    tanggalPutusan: isoTanggal(b.tanggalPutusan),
    diinputPutusan: isoTanggal(b.diinputPutusan),
    sidangMendatang: mendatang[String(b.perkaraId)] || [],
    jabatanSaya: b.jabatanSaya === null || b.jabatanSaya === undefined ? null : Number(b.jabatanSaya),
  }));
}

/**
 * Saksi yang diinput pada perkara pengguna dalam jendela - hanya KELENGKAPAN
 * isiannya yang dipulangkan (SK 048/2024 Tabel 2 I.12: jenis identitas,
 * nomor identitas, telepon), bukan nama atau nomornya.
 *
 * SIPP mengeja kolomnya "indentitas".
 */
async function koleksiSaksi(lingkup, { dari, sampai, alat = ALAT_DIAM }) {
  if (lingkupKosong(lingkup)) return [];
  const syarat = syaratLingkup(lingkup, "s.perkara_id");
  const mentah = await jalankan(
    `SELECT s.id AS saksiId, s.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            s.saksi_pihak_ke AS sisi, s.urutan AS urutan, s.diinput_tanggal AS diinputTanggal,
            x.diperbaharui_tanggal AS pihakDiperbarui,
            CASE WHEN x.jenis_indentitas IS NOT NULL AND TRIM(x.jenis_indentitas) NOT IN ('', '0', '-') THEN 1 ELSE 0 END AS adaJenisIdentitas,
            CASE WHEN x.nomor_indentitas IS NOT NULL AND TRIM(x.nomor_indentitas) NOT IN ('', '0', '-') THEN 1 ELSE 0 END AS adaNomorIdentitas,
            CASE WHEN x.telepon IS NOT NULL AND TRIM(x.telepon) NOT IN ('', '0', '-') THEN 1 ELSE 0 END AS adaTelepon
       FROM perkara_pihak5 s
       JOIN perkara p ON p.perkara_id = s.perkara_id
       LEFT JOIN pihak x ON x.id = s.pihak_id
      WHERE s.diinput_tanggal >= ? AND s.diinput_tanggal < DATE_ADD(?, INTERVAL 1 DAY)
        AND ${syarat.sql}
      ORDER BY s.diinput_tanggal DESC, s.id DESC
      LIMIT ${BATAS_BARIS + 1}`,
    [dari, sampai, ...syarat.nilai]
  );
  const baris = urutNaik(potongBatas(mentah, BATAS_BARIS, alat, "saksi terbaru"), (b) => [
    waktuTeks(b.diinputTanggal),
    Number(b.saksiId) || 0,
  ]);
  return baris.map((b) => ({
    saksiId: String(b.saksiId),
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    sisi: Number(b.sisi) || 0,
    urutan: Number(b.urutan) || 0,
    diinputTanggal: isoTanggal(b.diinputTanggal),
    pihakDiperbarui: isoTanggal(b.pihakDiperbarui),
    adaJenisIdentitas: Number(b.adaJenisIdentitas) === 1,
    adaNomorIdentitas: Number(b.adaNomorIdentitas) === 1,
    adaTelepon: Number(b.adaTelepon) === 1,
  }));
}

/**
 * Relaas yang RETUR (status_pos = 2) pada perkara pengguna, dan apakah sudah
 * ada relaas susulan untuk pihak yang sama sesudahnya.
 *
 * Diukur (kinerja-ide, 2026): 87 retur; 51 punya susulan, 36 tidak.
 */
async function koleksiRetur(lingkup, { acuan, alat = ALAT_DIAM }) {
  if (lingkupKosong(lingkup)) return [];
  const syarat = syaratLingkup(lingkup, "r.perkara_id");
  const mentah = await jalankan(
    `SELECT r.id AS relaasId, r.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            r.sidang_id AS sidangId, j.tanggal_sidang AS tanggalSidang, r.tanggal_relaas AS tanggalRelaas,
            pu.tanggal_putusan AS tanggalPutusan,
            (SELECT MIN(j2.tanggal_sidang) FROM perkara_jadwal_sidang j2
              WHERE j2.perkara_id = r.perkara_id AND j2.tanggal_sidang >= ?) AS sidangBerikut,
            (SELECT MAX(r2.diinput_tanggal) FROM perkara_pelaksanaan_relaas r2
              WHERE r2.perkara_id = r.perkara_id AND r2.pihak_id = r.pihak_id AND r2.id > r.id
                AND NOT ${sqlRetur("r2")}) AS susulanDiinput
       FROM perkara_pelaksanaan_relaas r
       JOIN perkara_jadwal_sidang j ON j.id = r.sidang_id
       JOIN perkara p ON p.perkara_id = r.perkara_id
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = r.perkara_id
      WHERE ${sqlRetur("r")}
        AND j.tanggal_sidang >= ?
        AND ${syarat.sql}
      ORDER BY j.tanggal_sidang ASC
      LIMIT ${BATAS_SEDANG + 1}`,
    [acuan, geser(acuan, -30), ...syarat.nilai]
  );
  const baris = potongBatas(mentah, BATAS_SEDANG, alat, "retur terlama");
  return baris.map((b) => ({
    relaasId: String(b.relaasId),
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    sidangId: String(b.sidangId),
    tanggalSidang: isoTanggal(b.tanggalSidang),
    tanggalRelaas: isoTanggal(b.tanggalRelaas),
    tanggalPutusan: isoTanggal(b.tanggalPutusan),
    sidangBerikut: isoTanggal(b.sidangBerikut),
    adaSusulan: Boolean(b.susulanDiinput),
    susulanDiinput: isoTanggal(b.susulanDiinput),
  }));
}

/**
 * Perkara terdaftar dalam jendela beserta PMH pertamanya - bahan "PMH hari
 * ini". Dibandingkan dengan MIN(tanggal_penetapan) seperti unsur
 * penetapanMajelis di penilaianSippService.
 */
async function koleksiPmh({ dari, sampai, alat = ALAT_DIAM }) {
  const mentah = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            p.jenis_perkara_nama AS jenisPerkara, p.tanggal_pendaftaran AS tanggalDaftar,
            (SELECT MIN(h.tanggal_penetapan) FROM perkara_hakim_pn h WHERE h.perkara_id = p.perkara_id) AS tanggalPmh,
            (SELECT MIN(h.diinput_tanggal) FROM perkara_hakim_pn h WHERE h.perkara_id = p.perkara_id) AS diinputPmh
       FROM perkara p
      WHERE p.tanggal_pendaftaran BETWEEN ? AND ?
      ORDER BY p.tanggal_pendaftaran DESC, p.perkara_id DESC
      LIMIT ${BATAS_BARIS + 1}`,
    [dari, sampai]
  );
  const baris = urutNaik(potongBatas(mentah, BATAS_BARIS, alat, "pendaftaran terbaru"), (b) => [
    isoTanggal(b.tanggalDaftar),
    Number(b.perkaraId) || 0,
  ]);
  return baris.map((b) => ({
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    jenisPerkara: teks(b.jenisPerkara),
    tanggalDaftar: isoTanggal(b.tanggalDaftar),
    tanggalPmh: isoTanggal(b.tanggalPmh),
    diinputPmh: isoTanggal(b.diinputPmh),
  }));
}

/**
 * Pendaftaran e-Court yang sudah dibayar dalam jendela, terdaftar atau
 * belum. Hanya nomor register e-Court dan jenis perkara - tanpa nama.
 *
 * Jendelanya sengaja pendek: status 8 "Menunggu Pendaftaran" berisi baris
 * basi sejak Mei 2025 (diukur, kinerja-ide PTSP), dan baris basi bukan
 * pekerjaan hari ini.
 */
async function koleksiEfiling({ dari, sampai, alat = ALAT_DIAM }) {
  const mentah = await jalankan(
    `SELECT e.efiling_id AS efilingId, e.nomor_register AS nomorRegister,
            e.jenis_perkara_nama AS jenisPerkara, e.tanggal_bayar AS tanggalBayar,
            e.nomor_perkara AS nomorPerkara, e.tgl_pendaftaran_perkara AS tanggalDaftar,
            e.status_pendaftaran_text AS status,
            (SELECT p.perkara_id FROM perkara p WHERE p.nomor_perkara = e.nomor_perkara LIMIT 1) AS perkaraId
       FROM perkara_efiling e
      WHERE e.tanggal_bayar BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY e.tanggal_bayar ASC
      LIMIT ${BATAS_SEDANG + 1}`,
    [dari, sampai]
  );
  const baris = potongBatas(mentah, BATAS_SEDANG, alat, "pembayaran terlama (paling lama belum didaftar)");
  return baris.map((b) => ({
    efilingId: String(b.efilingId),
    nomorRegister: teks(b.nomorRegister),
    jenisPerkara: teks(b.jenisPerkara),
    tanggalBayar: isoTanggal(b.tanggalBayar),
    nomorPerkara: teks(b.nomorPerkara),
    perkaraId: b.perkaraId === null || b.perkaraId === undefined ? "" : String(b.perkaraId),
    tanggalDaftar: isoTanggal(b.tanggalDaftar),
    status: teks(b.status),
  }));
}

/**
 * Saldo panjar perkara yang belum putus dan bersidang dalam jendela.
 * Rumus saldonya sama dengan penandaSippService.sisaPanjar:
 * SUM(jumlah * jenis_transaksi). Perkara prodeo tidak berpanjar.
 */
async function koleksiPanjar({ dari, sampai, alat = ALAT_DIAM }) {
  const mentah = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara,
            MIN(j.tanggal_sidang) AS sidangBerikut,
            (SELECT ROUND(SUM(b.jumlah * b.jenis_transaksi)) FROM perkara_biaya b WHERE b.perkara_id = p.perkara_id) AS saldo,
            (SELECT COUNT(*) FROM perkara_biaya b WHERE b.perkara_id = p.perkara_id) AS transaksi,
            (SELECT MAX(b.diinput_tanggal) FROM perkara_biaya b
              WHERE b.perkara_id = p.perkara_id AND b.jenis_transaksi = 1) AS terakhirMasuk
       FROM perkara_jadwal_sidang j
       JOIN perkara p ON p.perkara_id = j.perkara_id
       LEFT JOIN perkara_putusan pu ON pu.perkara_id = p.perkara_id
      WHERE j.tanggal_sidang BETWEEN ? AND ?
        AND pu.tanggal_putusan IS NULL
        AND (p.prodeo IS NULL OR p.prodeo <> 1)
      GROUP BY p.perkara_id, p.nomor_perkara
      ORDER BY sidangBerikut ASC
      LIMIT ${BATAS_SEDANG + 1}`,
    [dari, sampai]
  );
  const baris = potongBatas(mentah, BATAS_SEDANG, alat, "sidang terdekat");
  return baris.map((b) => ({
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    sidangBerikut: isoTanggal(b.sidangBerikut),
    saldo: b.saldo === null || b.saldo === undefined ? null : Number(b.saldo),
    transaksi: Number(b.transaksi) || 0,
    terakhirMasuk: isoTanggal(b.terakhirMasuk),
    ambang: AMBANG_PANJAR_TIPIS,
  }));
}

/**
 * Perkara yang sudah putus dalam jendela dan masih bersaldo panjar lebih
 * dari AMBANG_SISA_RUPIAH (penilaianSisaPanjarService), ditambah yang
 * saldonya habis oleh transaksi keluar yang diinput pada tanggal acuan -
 * yang kedua itulah "selesai hari ini".
 */
async function koleksiSisaPanjar({ dari, sampai, acuan, alat = ALAT_DIAM }) {
  const mentah = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, pu.tanggal_putusan AS tanggalPutusan,
            x.saldo AS saldo, x.keluarTerakhir AS keluarTerakhir
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
       JOIN (SELECT b.perkara_id, ROUND(SUM(b.jumlah * b.jenis_transaksi)) AS saldo,
                    MAX(CASE WHEN b.jenis_transaksi = -1 THEN b.diinput_tanggal END) AS keluarTerakhir
               FROM perkara_biaya b
              WHERE b.perkara_id IN (SELECT pu2.perkara_id FROM perkara_putusan pu2
                                      WHERE pu2.tanggal_putusan BETWEEN ? AND ?)
              GROUP BY b.perkara_id) x ON x.perkara_id = pu.perkara_id
      WHERE pu.tanggal_putusan BETWEEN ? AND ?
        AND (x.saldo > ? OR DATE(x.keluarTerakhir) = ?)
      ORDER BY pu.tanggal_putusan ASC
      LIMIT ${BATAS_SEDANG + 1}`,
    [dari, sampai, dari, sampai, AMBANG_SISA_RUPIAH, acuan]
  );
  const baris = potongBatas(mentah, BATAS_SEDANG, alat, "putusan terlama");
  return baris.map((b) => ({
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    tanggalPutusan: isoTanggal(b.tanggalPutusan),
    saldo: Number(b.saldo) || 0,
    keluarTerakhir: isoTanggal(b.keluarTerakhir),
    ambang: AMBANG_SISA_RUPIAH,
  }));
}

/**
 * Telepon pihak pertama pada perkara yang baru terdaftar - hanya ada
 * tidaknya, bukan nomornya. Pihak kedua tidak dituntut: nomor tergugat
 * lazim tidak diketahui saat mendaftar (diukur 2026: 386 dari 602 kosong).
 */
async function koleksiTelepon({ dari, sampai, alat = ALAT_DIAM }) {
  const mentah = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, p.tanggal_pendaftaran AS tanggalDaftar,
            MIN(CASE WHEN x.telepon IS NOT NULL AND TRIM(x.telepon) NOT IN ('', '0', '-') THEN 1 ELSE 0 END) AS semuaAda,
            MAX(x.diperbaharui_tanggal) AS pihakDiperbarui
       FROM perkara p
       JOIN perkara_pihak1 pp ON pp.perkara_id = p.perkara_id
       LEFT JOIN pihak x ON x.id = pp.pihak_id
      WHERE p.tanggal_pendaftaran BETWEEN ? AND ?
      GROUP BY p.perkara_id, p.nomor_perkara, p.tanggal_pendaftaran
      ORDER BY p.tanggal_pendaftaran ASC
      LIMIT ${BATAS_SEDANG + 1}`,
    [dari, sampai]
  );
  const baris = potongBatas(mentah, BATAS_SEDANG, alat, "pendaftaran terlama");
  return baris.map((b) => ({
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    tanggalDaftar: isoTanggal(b.tanggalDaftar),
    teleponLengkap: Number(b.semuaAda) === 1,
    pihakDiperbarui: isoTanggal(b.pihakDiperbarui),
  }));
}

/** Akta cerai yang terbit dalam jendela, dan ada tidaknya dokumen aktanya. */
async function koleksiAkta({ dari, sampai, alat = ALAT_DIAM }) {
  const mentah = await jalankan(
    `SELECT ac.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, ac.tgl_akta_cerai AS tanggalAkta,
            CASE WHEN ac.akta_cerai_dok IS NOT NULL AND TRIM(ac.akta_cerai_dok) <> '' THEN 1 ELSE 0 END AS adaDok,
            ac.diperbaharui_tanggal AS diperbarui
       FROM perkara_akta_cerai ac
       JOIN perkara p ON p.perkara_id = ac.perkara_id
      WHERE ac.tgl_akta_cerai BETWEEN ? AND ?
      ORDER BY ac.tgl_akta_cerai ASC
      LIMIT ${BATAS_SEDANG + 1}`,
    [dari, sampai]
  );
  const baris = potongBatas(mentah, BATAS_SEDANG, alat, "akta terlama");
  return baris.map((b) => ({
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    tanggalAkta: isoTanggal(b.tanggalAkta),
    adaDok: Number(b.adaDok) === 1,
    diperbarui: isoTanggal(b.diperbarui),
  }));
}

/**
 * Perkara ber-BHT dalam jendela dan kapan arsipnya diinput.
 *
 * perkara_id pada tabel arsip bernilai 0 dan nomornya kerap berekor titik;
 * penautannya lewat TRIM(TRAILING '.' FROM nomor_perkara) - lihat catatan
 * "arsip tertaut lewat nomor". Tabel turunan dibentuk SEKALI, bukan
 * subkueri per baris.
 */
async function koleksiArsip({ dari, sampai, alat = ALAT_DIAM }) {
  const mentah = await jalankan(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, pu.tanggal_bht AS tanggalBht,
            ar.diinput AS arsipDiinput
       FROM perkara_putusan pu
       JOIN perkara p ON p.perkara_id = pu.perkara_id
       LEFT JOIN (SELECT CONVERT(TRIM(TRAILING '.' FROM a.nomor_perkara) USING utf8) AS nomor,
                         MIN(a.diinput_tanggal) AS diinput
                    FROM arsip a
                   GROUP BY CONVERT(TRIM(TRAILING '.' FROM a.nomor_perkara) USING utf8)) ar
              ON ar.nomor = CONVERT(p.nomor_perkara USING utf8)
      WHERE pu.tanggal_bht BETWEEN ? AND ?
      ORDER BY pu.tanggal_bht DESC, p.perkara_id DESC
      LIMIT ${BATAS_BARIS + 1}`,
    [dari, sampai]
  );
  const baris = urutNaik(potongBatas(mentah, BATAS_BARIS, alat, "BHT terbaru"), (b) => [
    isoTanggal(b.tanggalBht),
    Number(b.perkaraId) || 0,
  ]);
  return baris.map((b) => ({
    perkaraId: String(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    tanggalBht: isoTanggal(b.tanggalBht),
    arsipDiinput: isoTanggal(b.arsipDiinput),
  }));
}

/**
 * Fakta penjaga tenggat, dibaca lewat pembacanya sendiri - bukan disalin.
 * Aturan batas harinya pun dibaca portal dari ATURAN_TENGGAT yang sama.
 */
async function koleksiPenjaga(kode, acuan) {
  const baca = penjagaTenggatService.pembaca[kode];
  if (!baca) throw new Error(`pembaca_penjaga_tidak_ada:${kode}`);
  return baca(acuan);
}

/**
 * Dokumen e-Court yang menunggu verifikasi majelis pada perkara tertentu.
 * Definisinya sama dengan ecourtVerificationService.listPendingForJudge:
 * status_verifikasi 'belum' dan belum ada keputusan tersimpan.
 *
 * Kesegarannya dipulangkan bersama: status yang dibaca dari tarikan kemarin
 * bukan status hari ini, dan portal menolak menagih atas data yang basi.
 */
async function koleksiEcourtDokumen(nomorPerkara, alat = ALAT_DIAM) {
  const nomor = [...new Set(nomorPerkara.filter(Boolean))].slice(0, 500);
  const segar = await kesegaranEcourt();
  if (nomor.length === 0) return { segar, dokumen: [] };
  const mentah = await botDb.query(
    `SELECT d.document_key AS kunci, d.nomor_perkara AS nomorPerkara, d.perkara_id AS perkaraId,
            d.jenis_dokumen AS jenisDokumen, d.agenda AS agenda, d.tanggal_sidang AS tanggalSidang,
            d.diunggah_pada AS diunggahPada, d.sumber_url AS sumberUrl
       FROM aleta_bot_ecourt_documents d
       LEFT JOIN aleta_bot_ecourt_verifications v ON v.document_key = d.document_key
      WHERE d.status_verifikasi = 'belum'
        AND v.id IS NULL
        AND d.nomor_perkara IN (${nomor.map(() => "?").join(", ")})
      ORDER BY d.diunggah_pada ASC
      LIMIT 301`,
    nomor
  );
  const baris = potongBatas(Array.isArray(mentah) ? mentah : [], 300, alat, "unggahan terlama");
  return {
    segar,
    dokumen: (Array.isArray(baris) ? baris : []).map((b) => ({
      kunci: teks(b.kunci),
      nomorPerkara: teks(b.nomorPerkara),
      perkaraId: teks(b.perkaraId),
      jenisDokumen: teks(b.jenisDokumen),
      agenda: teks(b.agenda),
      tanggalSidang: isoTanggal(b.tanggalSidang),
      diunggahPada: waktuTeks(b.diunggahPada),
      sumberUrl: teks(b.sumberUrl).slice(0, 500),
    })),
  };
}

/** Tarikan e-Court berhasil terakhir (status 'selesai', lihat finishSyncRun) dan pengaturan penjadwalnya. */
async function kesegaranEcourt() {
  const baris = await botDb.query(
    `SELECT MAX(CASE WHEN status = 'selesai' THEN selesai_pada END) AS terakhirBerhasil,
            MAX(dimulai_pada) AS terakhirDicoba
       FROM aleta_bot_ecourt_sync_runs`
  );
  const satu = (Array.isArray(baris) && baris[0]) || {};
  // selesai_pada ditulis toMysqlDate - dalam UTC. fromMysqlDate membacanya
  // kembali sebagai UTC; new Date() biasa akan menggesernya sebesar zona
  // peladen (tujuh jam di WIB) tanpa satu pun galat.
  const berhasil = botDb.fromMysqlDate(satu.terakhirBerhasil);
  const dicoba = botDb.fromMysqlDate(satu.terakhirDicoba);
  let jadwal = { aktif: false, jarakJam: 2, jamMulai: 0, jamSelesai: 24 };
  try {
    jadwal = ecourtSchedulerService.getSettings();
  } catch {
    /* pengaturan tak terbaca: bawaan dipakai, dan itu disebut lewat aktif:false */
  }
  return {
    terakhirBerhasil: berhasil ? berhasil.toISOString() : "",
    terakhirDicoba: dicoba ? dicoba.toISOString() : "",
    jadwalAktif: jadwal.aktif === true,
    jarakJam: Number(jadwal.jarakJam) || 2,
    jamMulai: Number(jadwal.jamMulai) || 0,
    jamSelesai: Number(jadwal.jamSelesai) || 24,
  };
}

/**
 * Tulisan penetapan ALETA yang GAGAL dalam beberapa hari terakhir, dan
 * apakah sesudahnya sudah ada tulisan yang berhasil untuk perkara dan jenis
 * yang sama. Baris kering (uji) tidak dihitung.
 */
async function koleksiPenetapanGagal({ dari, alat = ALAT_DIAM }) {
  const mentah = await botDb.query(
    `SELECT g.id AS id, g.waktu AS waktu, g.jenis AS jenis, g.perkara_id AS perkaraId,
            g.nomor_perkara AS nomorPerkara, g.alasan AS alasan,
            (SELECT MIN(s.waktu) FROM aleta_bot_jejak_penetapan s
              WHERE s.perkara_id = g.perkara_id AND s.jenis = g.jenis
                AND s.berhasil = 1 AND s.kering = 0 AND s.waktu > g.waktu) AS berhasilSesudah
       FROM aleta_bot_jejak_penetapan g
      WHERE g.berhasil = 0 AND g.kering = 0 AND g.waktu >= ${sqlDariSetempat("?")}
      ORDER BY g.waktu ASC
      LIMIT 301`,
    [`${dari} 00:00:00`]
  );
  const baris = potongBatas(Array.isArray(mentah) ? mentah : [], 300, alat, "kegagalan terlama");
  // waktu jejak disimpan UTC (sejak 17 Okt 2026; isi lama dipindah oleh
  // botDbService.pastikanUtc) dan driver bertimezone "Z" membacanya sebagai
  // saat yang benar - Date-nya langsung diubah ke ISO. Batas "dari" adalah
  // tanggal SETEMPAT, karena itu diubah ke UTC di SQL.
  const iso = (x) => (x instanceof Date && !Number.isNaN(x.getTime()) ? x.toISOString() : waktuTeks(x));
  return (Array.isArray(baris) ? baris : []).map((b) => ({
    id: String(b.id),
    waktu: iso(b.waktu),
    jenis: teks(b.jenis),
    perkaraId: teks(b.perkaraId),
    nomorPerkara: teks(b.nomorPerkara),
    alasan: teks(b.alasan).slice(0, 200),
    berhasilSesudah: b.berhasilSesudah ? iso(b.berhasilSesudah) : "",
  }));
}

/* ========================================================================== */
/* SUSUNAN PER PERAN                                                          */
/* ========================================================================== */

/**
 * Koleksi yang dibaca tiap peran. Jendela tanggalnya ditulis di sini supaya
 * satu tempat menjawab "seberapa jauh ke belakang peran ini melihat".
 */
function rencanaPeran(peran, acuan, id, tambahan) {
  const hakim = { jenis: "hakim", id: id.hakim };
  const panitera = { jenis: "panitera", id: id.panitera };
  const jurusita = { jenis: "jurusita", id: id.jurusita };
  const satker = { jenis: "satker", id: [] };

  // Tiap koleksi menerima `alat` dari bacaFakta: pelapor peta pelengkap yang
  // gagal (masuk `gagal` bernama "<koleksi>.<peta>") dan pelapor pemotongan
  // (masuk `catatan`).
  switch (peran) {
    case "hakim":
      return {
        sidang: (alat) => koleksiSidang(hakim, { dari: geser(acuan, -30), sampai: geser(acuan, 7), acuan, alat }),
        putusan: (alat) => koleksiPutusan(hakim, { dari: geser(acuan, -7), sampai: acuan, alat }),
        berjalan: (alat) => koleksiBerjalan(hakim, { acuan, alat }),
        mediasi: (alat) => koleksiMediasi(id.hakim, { acuan, alat }),
        ikrar: (alat) => koleksiIkrar(hakim, { acuan, alat }),
        perkaraTertentu: () => koleksiPerkaraTertentu(hakim, tambahan.perkara, { acuan }),
      };
    case "panitera-pengganti":
      return {
        sidang: (alat) => koleksiSidang(panitera, { dari: geser(acuan, -60), sampai: acuan, acuan, alat }),
        putusan: (alat) => koleksiPutusan(panitera, { dari: geser(acuan, -60), sampai: acuan, alat }),
        putusTanpaPutusan: (alat) =>
          koleksiPutusTanpaPutusan(panitera, { dari: geser(acuan, -60), sampai: acuan, alat }),
        saksi: (alat) => koleksiSaksi(panitera, { dari: geser(acuan, -14), sampai: acuan, alat }),
      };
    case "jurusita":
      return {
        sidang: (alat) =>
          koleksiSidang(jurusita, { dari: geser(acuan, -7), sampai: geser(acuan, 14), acuan, panggilan: true, alat }),
        putusan: (alat) =>
          koleksiPutusan(jurusita, { dari: penjagaTenggatService.mundurBulan(acuan, 12), sampai: acuan, alat }),
        retur: (alat) => koleksiRetur(jurusita, { acuan, alat }),
      };
    case "panitera":
      return {
        putusan: (alat) =>
          koleksiPutusan(satker, { dari: penjagaTenggatService.mundurBulan(acuan, 12), sampai: acuan, alat }),
        arsip: (alat) => koleksiArsip({ dari: penjagaTenggatService.mundurBulan(acuan, 12), sampai: acuan, alat }),
        aktaHariIni: (alat) => koleksiAkta({ dari: acuan, sampai: acuan, alat }),
        sidangPanggilan: (alat) =>
          koleksiSidang(satker, { dari: acuan, sampai: geser(acuan, 3), acuan, panggilan: true, petugas: true, alat }),
        "penjaga:dirput-gagal": () => koleksiPenjaga("dirput-gagal", acuan),
        "penjaga:anonimisasi-hilang": () => koleksiPenjaga("anonimisasi-hilang", acuan),
        "penjaga:akta-cerai-gugat": () => koleksiPenjaga("akta-cerai-gugat", acuan),
        "penjaga:akta-cerai-talak": () => koleksiPenjaga("akta-cerai-talak", acuan),
      };
    case "ketua":
      return {
        pmh: (alat) => koleksiPmh({ dari: geser(acuan, -30), sampai: acuan, alat }),
        berjalan: (alat) => koleksiBerjalan(satker, { acuan, alat }),
        sidang: (alat) => koleksiSidang(satker, { dari: geser(acuan, -14), sampai: acuan, acuan, petugas: true, alat }),
        sidangPanggilan: (alat) =>
          koleksiSidang(satker, { dari: acuan, sampai: geser(acuan, 3), acuan, panggilan: true, petugas: true, alat }),
        ikrar: (alat) => koleksiIkrar(satker, { acuan, alat }),
        aktaHariIni: (alat) => koleksiAkta({ dari: acuan, sampai: acuan, alat }),
        "penjaga:akta-cerai-gugat": () => koleksiPenjaga("akta-cerai-gugat", acuan),
        "penjaga:akta-cerai-talak": () => koleksiPenjaga("akta-cerai-talak", acuan),
      };
    case "ptsp":
      return {
        efiling: (alat) => koleksiEfiling({ dari: geser(acuan, -30), sampai: acuan, alat }),
        panjar: (alat) => koleksiPanjar({ dari: acuan, sampai: geser(acuan, 7), alat }),
        sisaPanjar: (alat) =>
          koleksiSisaPanjar({ dari: penjagaTenggatService.mundurBulan(acuan, 12), sampai: acuan, acuan, alat }),
        telepon: (alat) => koleksiTelepon({ dari: geser(acuan, -14), sampai: acuan, alat }),
        akta: (alat) => koleksiAkta({ dari: geser(acuan, -60), sampai: acuan, alat }),
      };
    case "operator":
      return {
        ecourt: () => kesegaranEcourt(),
        penetapanGagal: (alat) => koleksiPenetapanGagal({ dari: geser(acuan, -3), alat }),
        "penjaga:dirput-gagal": () => koleksiPenjaga("dirput-gagal", acuan),
      };
    default:
      return {};
  }
}

/**
 * Fakta checklist untuk satu peran pada satu tanggal acuan.
 *
 * Jawabannya: `fakta` per koleksi; `gagal` untuk koleksi yang gagal dibaca
 * (nama koleksi) DAN untuk peta pelengkap yang gagal di dalamnya
 * ("<koleksi>.<peta>", misalnya "sidang.panggilan" atau "berjalan.durasi");
 * `catatan` untuk koleksi yang terpotong batas barisnya.
 *
 * @param {object} masukan
 * @param {string} masukan.peran    kunci peran (lihat PERAN_SAH)
 * @param {string} masukan.acuan    yyyy-mm-dd menurut WITA (dari portal)
 * @param {string} masukan.hakim    id hakim_pn pengguna, dipisah koma
 * @param {string} masukan.panitera id panitera_pn pengguna, dipisah koma
 * @param {string} masukan.jurusita id jurusita pengguna, dipisah koma
 * @param {string} masukan.perkara  id perkara tambahan (konseptor sementara, antrean PHS)
 */
async function bacaFakta(masukan = {}) {
  const peran = teks(masukan.peran);
  if (!PERAN_SAH.includes(peran)) {
    return { ok: false, error: `peran_tidak_dikenal:${peran}` };
  }
  const acuan = isoTanggal(masukan.acuan) || isoTanggal(new Date());
  const id = {
    hakim: daftarId(masukan.hakim),
    panitera: daftarId(masukan.panitera),
    jurusita: daftarId(masukan.jurusita),
  };
  const tambahan = { perkara: daftarIdPanjang(masukan.perkara) };

  const rencana = rencanaPeran(peran, acuan, id, tambahan);
  const fakta = {};
  const gagal = {};
  const catatan = [];
  const alatUntuk = (nama) => ({
    lapor: (bagian, galat) => {
      gagal[`${nama}.${bagian}`] = pesanGalat(galat);
    },
    terpotong: (batas, keterangan) => {
      catatan.push(
        `Koleksi ${nama} melebihi ${batas} baris; hanya ${batas} ${keterangan} yang dinilai, sisanya tidak tampil di checklist.`
      );
    },
  });

  // Hakim: dokumen e-Court butuh nomor perkara berjalan, jadi dibaca sesudah
  // koleksi "berjalan" - bukan kueri SIPP kedua.
  await Promise.all(
    Object.entries(rencana).map(async ([nama, baca]) => {
      try {
        fakta[nama] = await baca(alatUntuk(nama));
      } catch (galat) {
        fakta[nama] = nama === "ecourt" ? null : [];
        gagal[nama] = pesanGalat(galat);
      }
    })
  );

  if (peran === "hakim") {
    try {
      const nomor = (fakta.berjalan || []).map((x) => x.nomorPerkara);
      fakta.ecourtDokumen = await koleksiEcourtDokumen(nomor, alatUntuk("ecourtDokumen"));
    } catch (galat) {
      fakta.ecourtDokumen = null;
      gagal.ecourtDokumen = pesanGalat(galat);
    }
  }

  return { ok: true, acuan, peran, id, fakta, gagal, catatan };
}

/** Id perkara tambahan boleh lebih dari 50 (konseptor sementara satu hakim), tetapi tetap berbatas. */
function daftarIdPanjang(mentah) {
  const hasil = [];
  for (const x of String(mentah == null ? "" : mentah).split(",")) {
    const n = Number(String(x).trim());
    if (Number.isInteger(n) && n > 0 && !hasil.includes(n)) hasil.push(n);
    if (hasil.length >= 300) break;
  }
  return hasil;
}

module.exports = {
  PERAN_SAH,
  bacaFakta,
  // Dibuka satu per satu supaya tiap koleksi dapat diukur sendiri.
  koleksi: {
    koleksiSidang,
    koleksiPutusan,
    koleksiPutusTanpaPutusan,
    koleksiBerjalan,
    koleksiMediasi,
    koleksiIkrar,
    koleksiPerkaraTertentu,
    koleksiSaksi,
    koleksiRetur,
    koleksiPmh,
    koleksiEfiling,
    koleksiPanjar,
    koleksiSisaPanjar,
    koleksiTelepon,
    koleksiAkta,
    koleksiArsip,
    koleksiEcourtDokumen,
    koleksiPenetapanGagal,
    kesegaranEcourt,
  },
  _uji: { syaratLingkup, kolomJabatan, daftarId, geser },
};
