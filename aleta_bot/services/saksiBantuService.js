"use strict";

/**
 * ============================================================================
 * BANTU DATA SAKSI - KONTEKS PERKARA DAN SAKSI GANDA (1.189.x BUTIR 10-12)
 * ============================================================================
 *
 * Dua bacaan untuk blangko saksi SIPP (pihak_ke 13 di views/pihak/
 * pihak_pertama.php, data orangnya di "Tambah Referensi Data Pihak"
 * views/pihak/pihak_list.php). SELECT saja - tidak ada satu baris pun yang
 * ditulis ke SIPP dari berkas ini. Yang menyimpan tetap petugas, lewat tombol
 * Simpan SIPP sendiri.
 *
 *   konteksSaksi   sebutan para pihak MENURUT JENIS PERKARA (satu sumber:
 *                  sebutanPihakService - nomor alur/jenis, bukan kata), daftar
 *                  pihak pertama/kedua (nama + alamat, untuk usulan "alamat sama
 *                  dengan Penggugat" dan sebutan "Pemohon I/II"), dan saksi yang
 *                  sudah tercatat di perkara ini.
 *
 *   cariGanda      orang yang SUDAH ADA di tabel `pihak` SIPP dan cocok dengan
 *                  isian baru: NIK sama, atau nama sama + tanggal lahir sama.
 *
 * ============================================================================
 * UKURAN (sipp_donggala, dump 9 Okt 2026, 16.643 baris saksi)
 * ============================================================================
 *
 *   - 736 saksi punya KEMBARAN di tabel pihak (nama + tanggal lahir sama, id
 *     lain): orang yang sama diketik ulang sebagai referensi baru. 934
 *     kelompok kembaran di seluruh 36.865 pihak; 811 NIK dipakai lebih dari
 *     satu baris pihak.
 *   - 812 orang dipakai ulang sebagai saksi di lebih dari satu perkara (2.428
 *     baris) - memakai data yang ada memang jalan yang lazim.
 *   - Yang menghadirkan: pihak pertama 98,5% (16.402 dari 16.643). Sebutan di
 *     keterangan sejalan dengan yang menghadirkan pada 99,0% (2.918/2.948).
 *   - 153 keterangan memakai sebutan yang SALAH untuk jenis perkaranya - 112 di
 *     antaranya "Penggugat/Tergugat" pada Cerai Talak/Izin Poligami (jebakan
 *     /Pdt.G/ yang beralur permohonan).
 *
 * ============================================================================
 * YANG TIDAK PERNAH KELUAR DARI BERKAS INI
 * ============================================================================
 *
 * NIK. Pencocokannya di sini; yang dikirim hanya DASARNYA ("NIK sama") dan
 * apakah NIK terisi - sama dengan riwayatPihakService. Tanggal lahir dan
 * alamat dikirim karena memang tampil di daftar referensi pihak SIPP sendiri
 * (kolom Tempat/Tanggal Lahir dan Alamat) - petugas yang sama sudah dapat
 * melihatnya.
 */

const db = require("../db_config");
const { sebutanPihakPerkara } = require("./sebutanPihakService");
const { bakuNama, nikSah } = require("./riwayatPihakService");

function kueri(sql, nilai = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, nilai, (galat, hasil) => (galat ? gagal(galat) : selesai(Array.isArray(hasil) ? hasil : [])));
  });
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).replace(/\s+/g, " ").trim();
}

/** "YYYY-MM-DD" dari Date/teks SIPP, "" untuk kosong dan tanggal nol. */
function tanggalIso(nilai) {
  if (!nilai) return "";
  let teks = "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    teks = `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(nilai.getDate()).padStart(2, "0")}`;
  } else {
    const t = String(nilai).trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) teks = `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
    if (m) teks = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return teks > "1900-01-01" ? teks : "";
}

/** Tanggal untuk layar: "12-03-1975". */
function tanggalLayar(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

const NOMOR_PERKARA = /^\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6}\.?$/;

async function bacaPerkara(nomorPerkara) {
  const nomor = bersih(nomorPerkara).replace(/\.$/, "");
  if (!NOMOR_PERKARA.test(nomor)) return { ok: false, kode: "masukan_tidak_sah", alasan: "Nomor perkara tidak sah." };
  const baris = await kueri(
    "SELECT perkara_id, nomor_perkara, alur_perkara_id, jenis_perkara_id, jenis_perkara_nama FROM perkara WHERE nomor_perkara IN (?, ?) LIMIT 1",
    [nomor, `${nomor}.`]
  );
  if (!baris[0]) return { ok: false, kode: "perkara_tidak_ada", alasan: "Perkara tidak ditemukan di SIPP." };
  return { ok: true, perkara: baris[0] };
}

async function pihakPerkara(tabel, perkaraId) {
  const baris = await kueri(
    `SELECT pp.urutan, COALESCE(p.nama, pp.nama) AS nama, COALESCE(p.alamat, pp.alamat) AS alamat
       FROM ${tabel} pp LEFT JOIN pihak p ON p.id = pp.pihak_id
      WHERE pp.perkara_id = ? AND (pp.urutan IS NULL OR pp.urutan > 0)
      ORDER BY pp.urutan`,
    [perkaraId]
  );
  return baris.map((b, i) => ({ urutan: Number(b.urutan) || i + 1, nama: bersih(b.nama), alamat: bersih(b.alamat) }));
}

/** Sebutan, para pihak, dan saksi yang sudah ada pada satu perkara. */
async function konteksSaksi(masukan = {}) {
  const baca = await bacaPerkara(masukan.nomorPerkara);
  if (!baca.ok) return baca;
  const p = baca.perkara;
  const sebutan = sebutanPihakPerkara({
    alurPerkaraId: p.alur_perkara_id,
    jenisPerkaraId: p.jenis_perkara_id,
    jenisPerkaraNama: p.jenis_perkara_nama,
    nomorPerkara: p.nomor_perkara,
  });
  const [pertama, kedua, saksiBaris] = await Promise.all([
    pihakPerkara("perkara_pihak1", p.perkara_id),
    pihakPerkara("perkara_pihak2", p.perkara_id),
    kueri(
      `SELECT p5.urutan, p5.pihak_id, p5.saksi_pihak_ke, p5.keterangan, COALESCE(p.nama, p5.nama) AS nama, p.tanggal_lahir
         FROM perkara_pihak5 p5 LEFT JOIN pihak p ON p.id = p5.pihak_id
        WHERE p5.perkara_id = ? AND p5.urutan > 0 ORDER BY p5.urutan`,
      [p.perkara_id]
    ),
  ]);
  return {
    ok: true,
    perkara: {
      nomor: bersih(p.nomor_perkara),
      jenis: bersih(p.jenis_perkara_nama),
      alurPerkaraId: Number(p.alur_perkara_id) || null,
      jenisPerkaraId: Number(p.jenis_perkara_id) || null,
    },
    sebutan: { satu: sebutan.satu, dua: sebutan.dua, sumber: sebutan.sumber },
    pihakPertama: pertama,
    pihakKedua: kedua,
    saksi: saksiBaris.map((s) => ({
      urutan: Number(s.urutan) || null,
      pihakId: s.pihak_id ? String(s.pihak_id) : "",
      nama: bersih(s.nama),
      tanggalLahir: tanggalLayar(tanggalIso(s.tanggal_lahir)),
      yangMenghadirkan: Number(s.saksi_pihak_ke) || 1,
      keterangan: bersih(s.keterangan),
    })),
  };
}

/**
 * Medan yang kosong pada satu baris pihak - yang WAJIB menurut SIPP lebih
 * dulu. Daftar wajibnya dari pilih() di pihak_list.php: tanpa jenis pihak,
 * nama, warga negara, alamat, atau pekerjaan SIPP menolak memilihnya ("Data
 * Pihak Tidak Lengkap ... Klik Edit").
 */
function medanKurang(b) {
  const kosong = (v) => bersih(v) === "" || v === null || v === undefined;
  const kurang = [];
  const wajib = [];
  if (kosong(b.jenis_pihak_id)) wajib.push("Jenis pihak");
  if (kosong(b.warga_negara_id) && kosong(b.warga_negara)) wajib.push("Warga negara");
  if (kosong(b.alamat)) wajib.push("Alamat");
  if (kosong(b.pekerjaan)) wajib.push("Pekerjaan");
  if (kosong(b.tempat_lahir)) kurang.push("Tempat lahir");
  if (!tanggalIso(b.tanggal_lahir)) kurang.push("Tanggal lahir");
  if (kosong(b.jenis_kelamin)) kurang.push("Jenis kelamin");
  if (kosong(b.agama_id) && kosong(b.agama_nama)) kurang.push("Agama");
  if (kosong(b.pendidikan_id) && kosong(b.pendidikan)) kurang.push("Pendidikan");
  if (kosong(b.status_kawin)) kurang.push("Status kawin");
  if (!nikSah(b.nomor_indentitas)) kurang.push("NIK");
  return { wajib, kurang };
}

/**
 * Tingkat kecocokan - MURNI, diuji tanpa basis data.
 *
 *   pasti   NIK sama dan nama sama; atau nama sama dan tanggal lahir sama
 *   nik     NIK sama tetapi nama berbeda - NIK-nya sudah dipakai orang lain
 *           (atau salah ketik di salah satunya)
 *   mungkin nama sama, tanggal lahir salah satu kosong
 *   null    nama sama tetapi tanggal lahir keduanya terisi dan BERBEDA -
 *           orang lain yang senama, tidak diperingatkan
 */
function tingkatGanda(isian, calon) {
  const namaA = bakuNama(isian.nama).kunci;
  const namaB = bakuNama(calon.nama).kunci;
  const namaSama = Boolean(namaA) && namaA === namaB;
  const nikA = nikSah(isian.nik);
  const nikB = nikSah(calon.nik);
  const nikSama = Boolean(nikA) && nikA === nikB;
  const lahirA = tanggalIso(isian.tanggalLahir);
  const lahirB = tanggalIso(calon.tanggalLahir);
  if (nikSama && namaSama) return "pasti";
  if (namaSama && lahirA && lahirA === lahirB) return "pasti";
  if (nikSama) return "nik";
  if (namaSama && (!lahirA || !lahirB)) return "mungkin";
  return null;
}

const URUTAN_TINGKAT = { pasti: 0, nik: 1, mungkin: 2 };

/** Pola LIKE berindeks dari nama: "EFENDI BIN TAHIR" -> "EFENDI%BIN%TAHIR%". */
function polaNama(nama) {
  const kata = bakuNama(nama).kata;
  if (!kata.length) return "";
  return `${kata.join("%")}%`;
}

/**
 * Orang di tabel pihak SIPP yang cocok dengan isian baru.
 *
 * Dua kueri: nama lewat indeks `nama` (awalan LIKE), dan NIK (kolomnya tidak
 * berindeks - terukur ratusan milidetik atas 36 ribu baris, seperti di
 * riwayatPihakService). Hasil paling banyak 8 orang, yang paling pasti dulu.
 */
async function cariGanda(masukan = {}) {
  const nama = bersih(masukan.nama).slice(0, 200);
  const nik = nikSah(masukan.nik);
  const pola = polaNama(nama);
  if (!pola && !nik) return { ok: true, calon: [] };
  if (bakuNama(nama).kunci.length < 3 && !nik) return { ok: true, calon: [] };

  const kolom = `id, nama, tempat_lahir, tanggal_lahir, jenis_kelamin, alamat, pekerjaan, agama_id, agama_nama,
                 pendidikan_id, pendidikan, status_kawin, warga_negara_id, warga_negara, jenis_pihak_id, nomor_indentitas`;
  const [dariNama, dariNik] = await Promise.all([
    pola ? kueri(`SELECT ${kolom} FROM pihak WHERE nama LIKE ? LIMIT 300`, [pola]) : Promise.resolve([]),
    nik ? kueri(`SELECT ${kolom} FROM pihak WHERE nomor_indentitas = ? LIMIT 20`, [nik]) : Promise.resolve([]),
  ]);
  const kecuali = bersih(masukan.kecualiPihakId);
  const peta = new Map();
  for (const b of [...dariNik, ...dariNama]) {
    const id = String(b.id);
    if (peta.has(id) || id === kecuali) continue;
    const tingkat = tingkatGanda(
      { nama, nik, tanggalLahir: masukan.tanggalLahir },
      { nama: b.nama, nik: b.nomor_indentitas, tanggalLahir: b.tanggal_lahir }
    );
    if (tingkat) peta.set(id, { b, tingkat });
  }
  const terpilih = [...peta.values()]
    .sort((x, y) => URUTAN_TINGKAT[x.tingkat] - URUTAN_TINGKAT[y.tingkat] || Number(y.b.id) - Number(x.b.id))
    .slice(0, 8);
  if (!terpilih.length) return { ok: true, calon: [] };

  const ids = terpilih.map((x) => x.b.id);
  let perkaraIdIni = null;
  if (bersih(masukan.nomorPerkara)) {
    const baca = await bacaPerkara(masukan.nomorPerkara);
    if (baca.ok) perkaraIdIni = baca.perkara.perkara_id;
  }
  const pakai = await kueri(
    `SELECT pihak_id, COUNT(DISTINCT perkara_id) AS jumlah, MAX(perkara_id = ?) AS di_sini, MAX(CASE WHEN perkara_id = ? THEN urutan END) AS urutan_sini
       FROM perkara_pihak5 WHERE pihak_id IN (?) AND urutan > 0 GROUP BY pihak_id`,
    [perkaraIdIni || 0, perkaraIdIni || 0, ids]
  );
  const petaPakai = new Map(pakai.map((x) => [String(x.pihak_id), x]));

  return {
    ok: true,
    calon: terpilih.map(({ b, tingkat }) => {
      const p = petaPakai.get(String(b.id));
      const kurang = medanKurang(b);
      const lahir = tanggalIso(b.tanggal_lahir);
      return {
        pihakId: String(b.id),
        tingkat,
        dasar:
          tingkat === "pasti"
            ? nik && nikSah(b.nomor_indentitas) === nik
              ? "NIK dan nama sama"
              : "nama dan tanggal lahir sama"
            : tingkat === "nik"
              ? "NIK sama, nama berbeda"
              : "nama sama, tanggal lahir belum terisi di salah satunya",
        nama: bersih(b.nama),
        tempatLahir: bersih(b.tempat_lahir),
        tanggalLahir: tanggalLayar(lahir),
        jenisKelamin: b.jenis_kelamin === "L" ? "Laki-laki" : b.jenis_kelamin === "P" ? "Perempuan" : "",
        alamat: bersih(b.alamat),
        pekerjaan: bersih(b.pekerjaan),
        nikTerisi: Boolean(nikSah(b.nomor_indentitas)),
        jumlahPerkaraSaksi: p ? Number(p.jumlah) || 0 : 0,
        saksiDiPerkaraIni: p ? Number(p.di_sini) === 1 : false,
        urutanDiPerkaraIni: p && p.urutan_sini ? Number(p.urutan_sini) : null,
        kurangWajib: kurang.wajib,
        kurang: kurang.kurang,
      };
    }),
  };
}

/* === P5P6 10 Okt === */
/**
 * Identitas tiap saksi satu perkara untuk paragraf keterangan saksi (P6) -
 * SELECT saja, sumber dan urutannya SAMA dengan variabel ABT 1197-1202/1241
 * (P) dan 6100-6105/1251 (T): perkara_pihak5 urut `urutan` per saksi_pihak_ke,
 * nama & alamat dari perkara_pihak5, umur = get_umur(tanggal_lahir,
 * diinput_tanggal), agama lewat agama_id, pendidikan = kode tingkat_pendidikan.
 * Hasil: [{ pihak 'P'|'T', urutPihak, nama, umur, agama, pendidikan,
 * pekerjaan, alamat, keterangan }]. NIK tidak dibaca.
 */
async function identitasSaksiPerkara(nomorPerkara) {
  const baca = await bacaPerkara(nomorPerkara);
  if (!baca.ok) return [];
  const baris = await kueri(
    `SELECT p5.saksi_pihak_ke, p5.urutan, p5.nama, p5.alamat, p5.keterangan, p5.diinput_tanggal,
            p.tanggal_lahir, p.pekerjaan, a.nama AS agama, tp.kode AS pendidikan
       FROM perkara_pihak5 p5
       LEFT JOIN pihak p ON p.id = p5.pihak_id
       LEFT JOIN agama a ON a.id = p.agama_id
       LEFT JOIN tingkat_pendidikan tp ON tp.id = p.pendidikan_id
      WHERE p5.perkara_id = ? AND p5.urutan > 0
      ORDER BY p5.saksi_pihak_ke, p5.urutan`,
    [baca.perkara.perkara_id]
  );
  const { umurPada } = require("./deteksiSaksiService");
  const hitung = { P: 0, T: 0 };
  return baris.map((b) => {
    const pihak = Number(b.saksi_pihak_ke) === 2 ? "T" : "P";
    hitung[pihak] += 1;
    return {
      pihak,
      urutPihak: hitung[pihak],
      nama: bersih(b.nama),
      umur: umurPada(b.tanggal_lahir, b.diinput_tanggal),
      agama: bersih(b.agama),
      pendidikan: bersih(b.pendidikan),
      pekerjaan: bersih(b.pekerjaan),
      alamat: bersih(b.alamat),
      keterangan: bersih(b.keterangan),
    };
  });
}

/**
 * identitasSaksiPerkara dengan batas waktu: null bila gagal atau lewat batas -
 * keterangan saksi tidak boleh tertahan karena SIPP lambat (seperti mediasiPerkara).
 */
function identitasSaksiBerbatas(nomorPerkara, batasMs = 2500) {
  let pewaktu = null;
  const batas = new Promise((selesai) => {
    pewaktu = setTimeout(() => selesai(null), batasMs);
  });
  const kerja = identitasSaksiPerkara(nomorPerkara).catch(() => null);
  return Promise.race([kerja, batas]).finally(() => clearTimeout(pewaktu));
}

/** Ringkasan kamus hubungan (dasar, golongan, jenis kelamin) - memperkaya tebakan ekstensi. */
function kamusHubunganUntukEkstensi() {
  try {
    return require("./deteksiSaksiService").kamusHubunganRingkas();
  } catch (_) {
    return [];
  }
}
/* === AKHIR P5P6 === */

async function jawabKonteks(query = {}) {
  try {
    const hasil = await konteksSaksi({ nomorPerkara: query.nomorPerkara });
    // P5P6 10 Okt: kamus hubungan ikut konteks (diteruskan utuh oleh portal).
    if (hasil.ok) hasil.kamusHubungan = kamusHubunganUntukEkstensi();
    if (hasil.ok) return { status: 200, body: hasil };
    return { status: hasil.kode === "perkara_tidak_ada" ? 404 : 400, body: hasil };
  } catch (galat) {
    return { status: 500, body: { ok: false, kode: "gagal_membaca_sipp", alasan: String((galat && galat.message) || galat).slice(0, 300) } };
  }
}

async function jawabGanda(badan = {}) {
  try {
    const hasil = await cariGanda({
      nama: badan.nama,
      nik: badan.nik,
      tanggalLahir: badan.tanggalLahir,
      nomorPerkara: badan.nomorPerkara,
      kecualiPihakId: badan.kecualiPihakId,
    });
    return { status: 200, body: hasil };
  } catch (galat) {
    return { status: 500, body: { ok: false, kode: "gagal_membaca_sipp", alasan: String((galat && galat.message) || galat).slice(0, 300) } };
  }
}

module.exports = {
  konteksSaksi,
  cariGanda,
  jawabKonteks,
  jawabGanda,
  // P5P6 10 Okt - identitas saksi untuk paragraf keterangan saksi.
  identitasSaksiPerkara,
  identitasSaksiBerbatas,
  kamusHubunganUntukEkstensi,
  // Aturan murni - diekspor untuk diuji.
  tingkatGanda,
  medanKurang,
  polaNama,
  tanggalIso,
};
