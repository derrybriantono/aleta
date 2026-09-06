"use strict";

/**
 * ============================================================================
 * D15 - SASARAN KINERJA, DAN D06 - KETERGANTUNGAN ANTAR PENILAIAN
 * ============================================================================
 *
 * ============================================================================
 * D15 - NILAI 86 ITU BAIK ATAU BURUK?
 * ============================================================================
 *
 * Pertanyaan itu tidak dapat dijawab tanpa sasaran. Tanpa sasaran tercetak,
 * setiap orang memakai patokan sendiri: yang satu menganggap 86 sudah baik
 * karena naik dari 81, yang lain menganggapnya buruk karena sasarannya 95.
 * Pembicaraan semacam itu tidak pernah selesai, dan yang menang biasanya yang
 * paling keras suaranya.
 *
 * Sasaran berasal dari Perjanjian Kinerja dan Indikator Kinerja Utama - dokumen
 * yang sudah ditandatangani, bukan angka yang disepakati di ruang rapat.
 * Karena itu ia bertahun: sasaran 2026 tidak dipakai menilai 2025.
 *
 * ============================================================================
 * D06 - NILAI HILIR TIDAK BOLEH TAMPAK LEBIH MEYAKINKAN DARIPADA HULUNYA
 * ============================================================================
 *
 * Seluruh penilaian ketaatan waktu berdiri di atas tanggal penginputan. Selama
 * 7.062 suntingan sesudah minutasi belum ditelaah, tanggal itu belum dapat
 * dipercaya sepenuhnya - dan nilai yang dibangun di atasnya mewarisi keraguan
 * itu, mau atau tidak.
 *
 * Yang berbahaya bukan keraguannya, melainkan menyembunyikannya. Nilai hilir
 * yang tampil bersih di atas hulu yang keruh membuat orang mengambil keputusan
 * dengan keyakinan yang tidak dimilikinya.
 *
 * Aturannya satu kalimat, dan dipaksakan di sini.
 */

const POLA_TAHUN = /^\d{4}$/;

/**
 * Sasaran per penilaian per tahun.
 *
 * Kosong pada 7 September 2026, dan itu keadaan yang jujur: Perjanjian Kinerja
 * pengadilan belum dibaca ke dalam aplikasi ini. Mengisinya dengan angka
 * karangan akan membuat seluruh layar menampilkan "kurang 8 poin dari sasaran"
 * yang tidak berdasar dokumen apa pun.
 */
const SASARAN = Object.create(null);

/** Mendaftarkan sasaran. Dipakai pemuat setelan, bukan ditulis di sini. */
function tetapkanSasaran(penilaian, tahun, nilai, sumber) {
  const p = String(penilaian || "").trim();
  const t = String(tahun || "").trim();
  const n = Number(nilai);
  const s = String(sumber || "").trim();
  if (!p) throw new Error("penilaian kosong");
  if (!POLA_TAHUN.test(t)) throw new Error(`tahun harus empat angka, dapat: ${tahun}`);
  if (!Number.isFinite(n) || n <= 0 || n > 100) throw new Error(`sasaran harus antara 1 dan 100, dapat: ${nilai}`);
  if (!s || s.length < 8) throw new Error("sumber sasaran wajib disebut - sasaran tanpa dokumen dasarnya adalah angka karangan");

  if (!SASARAN[p]) SASARAN[p] = Object.create(null);
  SASARAN[p][t] = { nilai: n, sumber: s };
  return { penilaian: p, tahun: t, nilai: n, sumber: s };
}

function lupakanSasaran() {
  Object.keys(SASARAN).forEach((k) => delete SASARAN[k]);
}

/**
 * Sasaran yang berlaku untuk sebuah penilaian pada sebuah tahun.
 *
 * Memulangkan null bila belum ditetapkan - dan layar harus mengatakan
 * "sasarannya belum ditetapkan", bukan diam-diam memakai seratus.
 */
function sasaranBerlaku(penilaian, tahun) {
  const p = String(penilaian || "").trim();
  const t = String(tahun || "").trim();
  const perPenilaian = Object.prototype.hasOwnProperty.call(SASARAN, p) ? SASARAN[p] : null;
  if (!perPenilaian) return { ada: false, nilai: null, sebab: "sasaran penilaian ini belum ditetapkan" };
  const butir = Object.prototype.hasOwnProperty.call(perPenilaian, t) ? perPenilaian[t] : null;
  if (!butir) return { ada: false, nilai: null, sebab: `sasaran tahun ${t} belum ditetapkan` };
  return { ada: true, nilai: butir.nilai, sumber: butir.sumber, tahun: t };
}

/**
 * Membandingkan capaian dengan sasarannya.
 *
 * Nilai null - penyebutnya belum cukup - TIDAK dibandingkan. Mengatakan
 * "belum tercapai" atas nilai yang memang belum dapat dihitung adalah menuduh
 * tanpa mengukur.
 */
function terhadapSasaran(nilai, penilaian, tahun) {
  const s = sasaranBerlaku(penilaian, tahun);
  if (!s.ada) return { ...s, capaian: nilai, keadaan: "tanpa sasaran" };
  if (nilai === null || nilai === undefined) {
    return {
      ada: true,
      nilai: s.nilai,
      sumber: s.sumber,
      capaian: null,
      keadaan: "belum dapat dinilai",
      sebab: "penyebutnya belum cukup, sehingga capaiannya belum ada untuk dibandingkan",
    };
  }
  const selisih = +(Number(nilai) - s.nilai).toFixed(1);
  return {
    ada: true,
    nilai: s.nilai,
    sumber: s.sumber,
    capaian: Number(nilai),
    selisih,
    keadaan: selisih >= 0 ? "tercapai" : "belum tercapai",
  };
}

/* ==========================================================================
 * D06 - ketergantungan
 * ========================================================================== */

/** Keadaan sebuah sumber data hulu. */
const KEADAAN_HULU = Object.assign(Object.create(null), {
  bersih: { peringkat: 0, sebutan: "bersih" },
  bersyarat: { peringkat: 1, sebutan: "bersyarat" },
  belumBersih: { peringkat: 2, sebutan: "belum bersih" },
  tidakAda: { peringkat: 3, sebutan: "tidak ada" },
});

const HULU = Object.create(null);
const GANTUNG = Object.create(null);

function tetapkanHulu(kunci, keadaan, keterangan) {
  const k = String(kunci || "").trim();
  const ke = String(keadaan || "").trim();
  if (!k) throw new Error("kunci hulu kosong");
  if (!Object.prototype.hasOwnProperty.call(KEADAAN_HULU, ke)) {
    throw new Error(`keadaan hulu "${keadaan}" tidak dikenali; yang sah: ${Object.keys(KEADAAN_HULU).join(", ")}`);
  }
  if (!String(keterangan || "").trim()) throw new Error("keterangan hulu wajib - tanpa itu, lencananya tidak berarti apa pun");
  HULU[k] = { kunci: k, keadaan: ke, keterangan: String(keterangan).trim() };
  return HULU[k];
}

function gantungkan(penilaian, daftarHulu) {
  const p = String(penilaian || "").trim();
  if (!p) throw new Error("penilaian kosong");
  const daftar = Array.isArray(daftarHulu) ? daftarHulu.map((x) => String(x).trim()) : [];
  daftar.forEach((h) => {
    if (!Object.prototype.hasOwnProperty.call(HULU, h)) {
      throw new Error(`hulu "${h}" belum ditetapkan - menggantungkan penilaian pada hulu yang tidak ada membuat lencananya berbohong`);
    }
  });
  GANTUNG[p] = daftar;
  return daftar;
}

function lupakanKetergantungan() {
  Object.keys(HULU).forEach((k) => delete HULU[k]);
  Object.keys(GANTUNG).forEach((k) => delete GANTUNG[k]);
}

/**
 * Keadaan sebuah penilaian menurut hulunya.
 *
 * Yang dipulangkan keadaan hulu TERBURUK - bukan rata-ratanya. Nilai yang
 * berdiri di atas lima sumber bersih dan satu sumber keruh tetap berdiri di
 * atas sumber yang keruh.
 */
function keadaanMenurutHulu(penilaian) {
  const p = String(penilaian || "").trim();
  const daftar = Object.prototype.hasOwnProperty.call(GANTUNG, p) ? GANTUNG[p] : [];
  if (!daftar.length) {
    return { bergantung: false, keadaan: "bersih", hulu: [], kalimat: "" };
  }
  const hulu = daftar.map((h) => HULU[h]);
  const terburuk = hulu.reduce((a, b) =>
    KEADAAN_HULU[b.keadaan].peringkat > KEADAAN_HULU[a.keadaan].peringkat ? b : a
  );
  const perlu = KEADAAN_HULU[terburuk.keadaan].peringkat > 0;
  return {
    bergantung: true,
    keadaan: terburuk.keadaan,
    hulu,
    perluLencana: perlu,
    kalimat: perlu
      ? `Nilai ini bertumpu pada ${terburuk.keterangan} Selama itu belum beres, angka pada layar ini harus dibaca bersyarat.`
      : "",
  };
}

module.exports = {
  SASARAN,
  tetapkanSasaran,
  lupakanSasaran,
  sasaranBerlaku,
  terhadapSasaran,
  KEADAAN_HULU,
  tetapkanHulu,
  gantungkan,
  lupakanKetergantungan,
  keadaanMenurutHulu,
};
