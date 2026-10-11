"use strict";

/**
 * ============================================================================
 * PEKERJAAN 11 Okt (agen 7) - KATEGORI PEKERJAAN PIHAK: PNS/TNI/POLRI/BUMN/BUMD
 * ============================================================================
 *
 * Permintaan pengguna: "tambahkan fitur untuk pembacaan PNS/POLRI/TNI/BUMN/BUMD
 * lainnya yang otomatis di abt buat lebih dinamis, kadang petugas mengisi
 * kerjaannya itu lainnya tetapi di isi PNS/POLRI/TNI/BUMN/BUMD ... (PPPK gabung
 * dengan PNS pertimbangan PNS)".
 *
 * SIPP Pengadilan Agama menyimpan pekerjaan sebagai TEKS BEBAS (pihak.pekerjaan,
 * borang pihak_list.php cabang jenis_pengadilan 3: satu input teks - pilihan
 * "PNS/BUMN/POLRI/TNI/Lain-Lain" hanya ada di cabang peradilan lain). Variabel
 * ABT lama (8510 duduk perkara, 8524 pertimbangan, 8533 BAS) membandingkan teks
 * itu PERSIS ('Pegawai Negeri Sipil', 'POLRI', ...), sehingga "PNS",
 * "Pegawai Negeri Sipil (Guru SDN 2)", "ASN", "PPPK (Dinas Pendidikan)" tidak
 * mendapat kalimat izin atasan.
 *
 * Satu aturan, dua pelaksana yang dijaga sama oleh uji:
 *   - klasifikasiPekerjaan (JS) - panel ABT & lajur SIPP;
 *   - sqlKategoriPekerjaan (SQL MariaDB 5.5, regexSql Spencer) - kueri ABT.
 * Pola = DATA di kamus-deteksi/awal/pekerjaan.json (dibaca lewat kamusDeteksi).
 *
 * Urutan: (1) 'pilihan' = teks baku yang dibandingkan kueri lama -> hasil lama
 * tidak berubah; (2) penyangkal kuat -> BUKAN; (3) PPPK -> PNS; (4) penyangkal
 * lemah -> BUKAN; (5) deteksi PNS, POLRI, TNI, BUMN, BUMD, DESA.
 */

const kamus = require("./kamusDeteksi");

const KELOMPOK = "pekerjaan";
const URUT_PERAN = ["pilihan", "penyangkal-kuat", "pppk", "penyangkal-lemah", "deteksi"];
const KATEGORI = Object.freeze(["PNS", "POLRI", "TNI", "BUMN", "BUMD", "DESA"]);

/** Teks baku SIPP yang diusulkan di blangko pihak (sama dengan cabang 'pilihan' kueri lama). DESA tidak diusulkan. */
const TEKS_BAKU = Object.freeze({
  PNS: "Pegawai Negeri Sipil",
  POLRI: "POLRI",
  TNI: "Tentara Nasional Indonesia",
  BUMN: "Pegawai BUMN/BUMD",
  BUMD: "Pegawai BUMN/BUMD",
});

const LABEL_KATEGORI = Object.freeze({
  PNS: "PNS",
  POLRI: "POLRI",
  TNI: "TNI",
  BUMN: "BUMN",
  BUMD: "BUMD",
  DESA: "Kepala/Perangkat Desa",
  BUKAN: "bukan PNS/TNI/POLRI/BUMN/BUMD",
  LAIN: "lainnya",
  KOSONG: "kosong",
});

function polaUrut() {
  return kamus
    .polaKelompok(KELOMPOK)
    .slice()
    .sort((a, b) => URUT_PERAN.indexOf(a.peran) - URUT_PERAN.indexOf(b.peran) || Number(a.urutan || 0) - Number(b.urutan || 0));
}

/** Pembanding '=' MySQL (latin1_swedish_ci, PAD SPACE): tanpa beda huruf besar, spasi di belakang diabaikan. */
function samaMysql(teks, baku) {
  return String(teks).replace(/ +$/, "").toLowerCase() === String(baku).replace(/ +$/, "").toLowerCase();
}

function cocok(p, teks) {
  if (p.peran === "pilihan" && Array.isArray(p.samaDengan)) return p.samaDengan.some((b) => samaMysql(teks, b));
  return p.re.test(teks);
}

/**
 * Kategori satu teks pekerjaan. Murni (selain membaca kamus).
 * @returns {{kunci: string, label: string, asal: string, kodePola: string, yakin: string,
 *   golongan: string, dasar: string, pilihanSipp: boolean, teksBaku: string}}
 */
function klasifikasiPekerjaan(teks) {
  const asli = String(teks == null ? "" : teks);
  const hasil = { kunci: "KOSONG", label: LABEL_KATEGORI.KOSONG, asal: "", kodePola: "", yakin: "", golongan: "", dasar: "", pilihanSipp: false, teksBaku: "" };
  if (!asli.trim()) return hasil;
  const pola = polaUrut();
  // Teks yang SUDAH baku (pembanding lama) - pilihan SIPP dianggap benar.
  for (const p of pola.filter((x) => x.peran === "pilihan")) {
    if (cocok(p, asli)) return { ...hasil, kunci: p.kunci, label: LABEL_KATEGORI[p.kunci] || p.kunci, asal: "pilihan", kodePola: p.kode, yakin: p.yakin || "ragu", pilihanSipp: true, teksBaku: TEKS_BAKU[p.kunci] || "" };
  }
  const t = asli.toLowerCase();
  const dasarDari = () => {
    // Kategori yang DISANGKAL (mis. "Pensiunan PNS" -> PNS) - hanya untuk keterangan, tidak pernah menjadi hasil.
    const d = pola.find((x) => (x.peran === "deteksi" || x.peran === "pppk") && x.kunci !== "BUKAN" && cocok(x, t));
    return d ? d.kunci : "";
  };
  for (const peran of ["penyangkal-kuat", "pppk", "penyangkal-lemah", "deteksi"]) {
    const p = pola.find((x) => x.peran === peran && cocok(x, t));
    if (!p) continue;
    if (p.kunci === "BUKAN") {
      return { ...hasil, kunci: "BUKAN", label: LABEL_KATEGORI.BUKAN, asal: peran, kodePola: p.kode, yakin: p.yakin || "ragu", golongan: p.golongan || "", dasar: p.golongan === "satpol" ? "" : dasarDari() };
    }
    return { ...hasil, kunci: p.kunci, label: LABEL_KATEGORI[p.kunci] || p.kunci, asal: peran === "pppk" ? "pppk" : "teks", kodePola: p.kode, yakin: p.yakin || "ragu", teksBaku: TEKS_BAKU[p.kunci] || "" };
  }
  return { ...hasil, kunci: "LAIN", label: LABEL_KATEGORI.LAIN };
}

/** Kalimat info untuk panel/lajur: "PNS (dari teks 'ASN Dinas Pendidikan')". Murni. */
function kalimatTerbaca(teks, k) {
  const x = k || klasifikasiPekerjaan(teks);
  const kutip = `'${String(teks || "").trim()}'`;
  if (x.kunci === "KOSONG") return "pekerjaan kosong di SIPP";
  if (x.asal === "pilihan") return `${x.label} (teks baku SIPP ${kutip})`;
  if (x.kunci === "BUKAN") {
    const g = { pensiunan: "pensiunan", mantan: "mantan", keluarga: "keluarga anggota", satpol: "Satpol PP", "non-pns": "bukan PNS", honorer: "honorer", kontrak: "kontrak/harian", swasta: "swasta" }[x.golongan] || x.golongan;
    return `${g}${x.dasar ? ` ${LABEL_KATEGORI[x.dasar] || x.dasar}` : ""} - tidak dibaca sebagai ${x.dasar ? LABEL_KATEGORI[x.dasar] || x.dasar : "PNS/TNI/POLRI/BUMN/BUMD"} (dari teks ${kutip})`;
  }
  if (x.kunci === "LAIN") return `lainnya (teks ${kutip})`;
  return `${x.label}${x.asal === "pppk" ? " (PPPK, digabung ke PNS)" : ""} (dari teks ${kutip})`;
}

// ---------------------------------------------------------------------------
// SQL (kueri ABT, MariaDB 5.5 satker)
// ---------------------------------------------------------------------------

function sqlTeks(s) {
  // Tanpa garis miring terbalik (Bash/ABT menyusutkannya) - dijaga juga di uji.
  if (/\\/.test(s)) throw new Error(`regexSql/samaDengan tidak boleh memuat garis miring terbalik: ${s}`);
  return `'${String(s).replace(/'/g, "''")}'`;
}

/**
 * Ekspresi CASE kategori pekerjaan (hasil: 'PNS','POLRI','TNI','BUMN','BUMD','DESA','BUKAN','LAIN','KOSONG').
 * @param {string} kolomAsli kolom pihak.pekerjaan apa adanya (pembanding '=' lama, latin1 ci)
 * @param {string} kolomTeks LOWER(CONVERT(... USING utf8)) yang sudah dihitung di tingkat dalam
 */
function sqlKategoriPekerjaan(kolomAsli, kolomTeks) {
  const pola = polaUrut();
  const baris = [`WHEN TRIM(IFNULL(${kolomAsli}, '')) = '' THEN 'KOSONG'`];
  for (const p of pola.filter((x) => x.peran === "pilihan")) {
    baris.push(`WHEN ${kolomAsli} IN (${p.samaDengan.map(sqlTeks).join(", ")}) THEN '${p.kunci}'`);
  }
  for (const peran of ["penyangkal-kuat", "pppk", "penyangkal-lemah", "deteksi"]) {
    for (const p of pola.filter((x) => x.peran === peran)) {
      if (!p.regexSql) throw new Error(`pola ${p.kode} tanpa regexSql`);
      baris.push(`WHEN ${kolomTeks} REGEXP ${sqlTeks(p.regexSql)} THEN '${p.kunci}'`);
    }
  }
  return `CASE ${baris.join(" ")} ELSE 'LAIN' END`;
}

// ---------------------------------------------------------------------------
// SIPP (baca saja)
// ---------------------------------------------------------------------------

let db = null;
function runQuery(sql, params) {
  if (!db) db = require("../db_config");
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (error, hasil) => (error ? reject(error) : resolve(hasil)));
  });
}

/**
 * Pekerjaan pihak pertama & kedua satu perkara + kategorinya. Baca saja.
 * @returns {Promise<Array<{pihakKe:number, urutan:number, nama:string, pekerjaan:string, kunci:string, label:string,
 *   asal:string, kodePola:string, yakin:string, golongan:string, dasar:string, pilihanSipp:boolean, teksBaku:string, kalimat:string}>>}
 */
async function bacaPekerjaanPihak(perkaraId, kueri = runQuery) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0) return [];
  const baris = await kueri(
    `SELECT 1 AS pihakKe, a.urutan, b.nama, b.pekerjaan FROM perkara_pihak1 a JOIN pihak b ON b.id = a.pihak_id WHERE a.perkara_id = ?
     UNION ALL
     SELECT 2 AS pihakKe, a.urutan, b.nama, b.pekerjaan FROM perkara_pihak2 a JOIN pihak b ON b.id = a.pihak_id WHERE a.perkara_id = ?
     ORDER BY pihakKe, urutan`,
    [id, id]
  );
  return (Array.isArray(baris) ? baris : []).map((r) => {
    const pekerjaan = String(r.pekerjaan || "").trim();
    const k = klasifikasiPekerjaan(r.pekerjaan);
    return { pihakKe: Number(r.pihakKe), urutan: Number(r.urutan) || 1, nama: String(r.nama || "").trim(), pekerjaan, ...k, kalimat: kalimatTerbaca(pekerjaan, k) };
  });
}

module.exports = {
  KELOMPOK,
  KATEGORI,
  TEKS_BAKU,
  LABEL_KATEGORI,
  klasifikasiPekerjaan,
  kalimatTerbaca,
  sqlKategoriPekerjaan,
  bacaPekerjaanPihak,
};
