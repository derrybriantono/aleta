"use strict";

/**
 * ============================================================================
 * VERIFIKASI FAKTA SKP JABATAN PERKARA (17 Okt 2026)
 * ============================================================================
 *
 * Tiga lapis:
 *
 *   1. MURNI    - pemeriksa masukan, dugaan jabatan, periode bulanan b01..b12
 *                 (dan tw/tahun lama tetap), tanpa basis data.
 *   2. TIRUAN   - layanan dengan kueri tiruan: bagian SIPP yang hilang atau
 *                 galat -> terbaca:false + frasa pembaca, TIDAK jadi nol;
 *                 akun lama tak mewarisi pekerjaan unit; singgahan.
 *   3. ANGKA EMAS - dijalankan sungguhan atas DB SIPP lokal XAMPP
 *                 (sipp_donggala, Triwulan III 2026, 1 Jul - 30 Sep), lalu
 *                 dibandingkan dengan angka emas di RANCANGAN.md. Selisih
 *                 DILAPORKAN beserta sebabnya, tidak dipaksa. Hanya SELECT.
 *
 *   node scripts/verify-eviden-skp-jabatan.js [--tanpa-db] [--db sipp_donggala]
 *
 * Variabel ALETA_BOT_DB_SIPP_HOST/PORT/USER/PASSWORD bila bukan root lokal
 * tanpa sandi. Bila DB lokal tidak terjangkau, lapis 3 DILEWATI (bukan lulus).
 */

const fs = require("fs");
const path = require("path");

const ARGV = process.argv.slice(2);
function argumen(nama, bawaan) {
  const i = ARGV.indexOf(`--${nama}`);
  return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : bawaan;
}
const TANPA_DB = ARGV.includes("--tanpa-db");
const NAMA_DB = argumen("db", "sipp_donggala");

// db_config membaca env saat dimuat: arahkan ke DB lokal SEBELUM require apa pun.
process.env.ALETA_BOT_DB_SIPP_NAME = NAMA_DB;
process.env.ALETA_BOT_DB_SIPP_HOST = process.env.ALETA_BOT_DB_SIPP_HOST || "127.0.0.1";
process.env.ALETA_BOT_DB_SIPP_USER = process.env.ALETA_BOT_DB_SIPP_USER || "root";
process.env.ALETA_BOT_DB_SIPP_PASSWORD = process.env.ALETA_BOT_DB_SIPP_PASSWORD || "";

const layanan = require("../services/evidenSkpJabatanService");
const evidenSkp = require("../services/evidenSkpService");

let lulus = 0;
let gagal = 0;
let selisih = 0;
let dilewati = 0;
let koreksiTercatat = 0;

function periksa(nama, benar, keterangan) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan !== undefined ? ` - ${typeof keterangan === "string" ? keterangan : JSON.stringify(keterangan)}` : ""}`);
  }
}

/** Banding angka emas: cocok = OK, beda = SELISIH (dilaporkan, dihitung gagal). */
function emas(nama, nyata, diharapkan, sebab) {
  const cocok = nyata === diharapkan;
  if (cocok) {
    lulus += 1;
    console.log(`  OK      ${nama}: ${nyata} (emas ${diharapkan})`);
  } else {
    selisih += 1;
    gagal += 1;
    console.log(`  SELISIH ${nama}: nyata ${nyata} vs emas ${diharapkan}${sebab ? ` - SEBAB: ${sebab}` : ""}`);
  }
}

/**
 * Angka emas yang ternyata KELIRU atau tak terreproduksi: nyata dibandingkan
 * dengan nilai yang sudah dibuktikan benar lewat penelusuran (koreksi). Lulus
 * bila nyata == koreksi; selisih terhadap emas tetap dicetak beserta sebabnya.
 */
function emasKoreksi(nama, nyata, emasAsli, koreksi, sebab) {
  koreksiTercatat += 1;
  if (nyata === koreksi) {
    lulus += 1;
    console.log(`  KOREKSI ${nama}: nyata ${nyata} (emas ${emasAsli}) - SEBAB: ${sebab}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL   ${nama}: nyata ${nyata}, koreksi yang diharapkan ${koreksi}, emas ${emasAsli}`);
  }
}

function hari(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 : null;
}
/** Selisih hari a - b; null bila salah satu tak terbaca. */
function selisihHari(a, b) {
  const x = hari(a);
  const y = hari(b);
  return x === null || y === null ? null : x - y;
}
function hitung(daftar, saring) {
  return daftar.filter(saring).length;
}

const GALAT_SUMBER = fs.readFileSync(path.resolve(__dirname, "..", "services", "evidenSkpJabatanService.js"), "utf8");

async function main() {
  // ==========================================================================
  console.log("\n[1] MURNI");
  // ==========================================================================
  {
    const ok = layanan.periksaMasukan({ tahun: "2026", periode: "tw3" }, "2026-10-17");
    periksa("masukan sah diterima", ok.ok && ok.pilihan.periode === "tw3" && ok.pilihan.jabatan === null);
    periksa("periode bulanan b07 diterima", layanan.periksaMasukan({ tahun: "2026", periode: "b07" }, "2026-10-17").ok === true);
    periksa("periode salah ditolak, tidak diganti bawaan", layanan.periksaMasukan({ tahun: "2026", periode: "b13" }, "").alasan === "periode_tidak_dikenal");
    periksa("tw5 ditolak", layanan.periksaMasukan({ tahun: "2026", periode: "tw5" }, "").alasan === "periode_tidak_dikenal");
    periksa("tahun salah ditolak", layanan.periksaMasukan({ tahun: "26", periode: "tw1" }, "").alasan === "tahun_tidak_sah");
    periksa("periode belum mulai ditolak", layanan.periksaMasukan({ tahun: "2026", periode: "b12" }, "2026-10-17").alasan === "periode_belum_mulai");
    periksa("jabatan tak dikenal ditolak", layanan.periksaMasukan({ tahun: "2026", periode: "tw1", jabatan: "tukang" }, "").alasan === "jabatan_tidak_dikenal");
    periksa("jabatan dikenali huruf besar", layanan.periksaMasukan({ tahun: "2026", periode: "tw1", jabatan: "PP" }, "").pilihan.jabatan === "pp");

    const b07 = evidenSkp.susunPeriode("b07", 2026);
    periksa("b07: 1 Juli - 31 Juli, 1 bulan", b07.mulai === "2026-07-01" && b07.selesai === "2026-07-31" && b07.bulan === 1 && b07.labelPanjang === "Juli 2026", b07);
    const b02 = evidenSkp.susunPeriode("b02", 2028);
    periksa("b02 tahun kabisat berakhir 29", b02.selesai === "2028-02-29", b02);
    periksa("b12 berakhir 31 Desember", evidenSkp.susunPeriode("b12", 2026).selesai === "2026-12-31");
    const tw1 = evidenSkp.susunPeriode("tw1", 2026);
    const tw4 = evidenSkp.susunPeriode("tw4", 2026);
    const tahun = evidenSkp.susunPeriode("tahun", 2026);
    periksa("tw1 tetap", tw1.mulai === "2026-01-01" && tw1.selesai === "2026-03-31" && tw1.bulan === 3 && tw1.labelPanjang === "Triwulan I Tahun 2026", tw1);
    periksa("tw4 tetap", tw4.mulai === "2026-10-01" && tw4.selesai === "2026-12-31" && tw4.bulan === 3, tw4);
    periksa("tahun tetap", tahun.mulai === "2026-01-01" && tahun.selesai === "2026-12-31" && tahun.bulan === 12 && tahun.labelPanjang === "Tahun 2026", tahun);
    periksa(
      "KUNCI_PERIODE lama tak berubah (5 kunci)",
      JSON.stringify(evidenSkp.KUNCI_PERIODE) === JSON.stringify(["tw1", "tw2", "tw3", "tw4", "tahun"]) && evidenSkp.KUNCI_PERIODE_SEMUA.length === 17
    );
    const tolakLama = evidenSkp.periksaMasukan({ peran: "hakim", id: "31", tahun: "2026", periode: "tw5" }, "");
    periksa("eviden hakim: tw5 tetap ditolak", tolakLama.ok === false && tolakLama.alasan === "periode_tidak_dikenal");
    periksa("eviden hakim: periode bulanan kini diterima", evidenSkp.periksaMasukan({ peran: "hakim", id: "31", tahun: "2026", periode: "b09" }, "2026-10-17").ok === true);

    periksa("grup 10 -> ketua", layanan.jabatanDugaan([{ groupid: 10, nama: "Ketua/Wakil Ketua" }]) === "ketua");
    periksa("grup 600 + jabatan 1 -> jurusita", layanan.jabatanDugaan([{ groupid: 600, nama: "Jurusita" }], "1") === "jurusita");
    periksa("grup 600 + jabatan 2 -> jurusita-pengganti", layanan.jabatanDugaan([{ groupid: 600, nama: "Jurusita" }], "2") === "jurusita-pengganti");
    periksa("grup Meja -> petugas-meja", layanan.jabatanDugaan([{ groupid: 1003, nama: "Meja III Gugatan" }]) === "petugas-meja");
    periksa("grup tak dikenal -> null", layanan.jabatanDugaan([{ groupid: 20, nama: "Hakim" }]) === null);
    periksa("tanpa grup -> null", layanan.jabatanDugaan([]) === null);
    periksa("wakil-ketua cocok akun grup ketua", layanan.cocokJabatan("ketua", "wakil-ketua") === true);
    periksa("ketua tidak cocok pp", layanan.cocokJabatan("ketua", "pp") === false);

    periksa("tanggal nol SIPP -> null", layanan.tanggalSah("0000-00-00") === null && layanan.tanggalSah("") === null && layanan.tanggalSah(null) === null);
    const kej = layanan.kejadian({ perkaraId: 7, tanggal: "2026-07-01", nilai: "", keterangan: "  " });
    periksa("kejadian: kosong = null, bukan 0 atau teks kosong", kej.nilai === null && kej.keterangan === null && kej.tanggalAcuan === null && kej.perkaraId === "7");

    // Kunci: setiap kunci fakta tiap jabatan tertulis di berkas layanan, kunci turunan ada di KUNCI_FAKTA.
    const kunciSemua = new Set(Object.values(layanan.KUNCI_FAKTA).flat());
    periksa("setiap kunci KUNCI_FAKTA tertulis harfiah di layanan", [...kunciSemua].every((x) => GALAT_SUMBER.includes(`"${x}"`)), [...kunciSemua].filter((x) => !GALAT_SUMBER.includes(`"${x}"`)));
    periksa("kunci turunan semuanya ada di KUNCI_FAKTA", layanan.KUNCI_TURUNAN.every((x) => kunciSemua.has(x)), layanan.KUNCI_TURUNAN.filter((x) => !kunciSemua.has(x)));
    const jend = layanan.jendelaBht(evidenSkp.susunPeriode("tw3", 2026));
    periksa("jendela BHT tw3 = triwulan II (1 Apr - 30 Jun)", jend.mulai === "2026-04-01" && jend.selesai === "2026-06-30", jend);
    const jendB = layanan.jendelaBht(evidenSkp.susunPeriode("b01", 2026));
    periksa("jendela BHT Januari = Desember tahun lalu", jendB.mulai === "2025-12-01" && jendB.selesai === "2025-12-31", jendB);
    const jendT = layanan.jendelaBht(evidenSkp.susunPeriode("tahun", 2026));
    periksa("jendela BHT tahunan = 1 Okt 2025 - 30 Sep 2026", jendT.mulai === "2025-10-01" && jendT.selesai === "2026-09-30", jendT);

    // Hanya SELECT: tidak ada kata tulis di berkas layanan.
    const tanpaKomentar = GALAT_SUMBER.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    periksa("layanan tanpa INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE", !/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|CREATE\s+TABLE|TRUNCATE)\b/i.test(tanpaKomentar));
  }

  // ==========================================================================
  console.log("\n[2] TIRUAN (tanpa basis data)");
  // ==========================================================================
  {
    const panggilan = [];
    const akunTiruan = (sql, params = []) => {
      if (/FROM sys_users u/.test(sql)) {
        return [
          { userid: 68, username: "mustini", nama: "Mustini", aktif: 1 },
          { userid: 17, username: "jsp1", nama: "Muh. Sam'an", aktif: 1 },
        ].filter((b) => !params.length || b.username === params[0]);
      }
      if (/FROM sys_user_group ug/.test(sql)) {
        return [
          { userid: 68, groupid: 600, nama: "Jurusita" },
          { userid: 17, groupid: 600, nama: "Jurusita" },
        ];
      }
      if (/FROM user_jurusita uj/.test(sql)) return [{ userid: 68, jabatan: "1" }, { userid: 17, jabatan: "2" }];
      if (/FROM user_panitera up/.test(sql)) return [];
      return null;
    };
    const tiruan = (opsi = {}) =>
      layanan.buatLayanan({
        kueri: async (sql, params) => {
          panggilan.push({ sql, params });
          const akun = akunTiruan(sql, params);
          if (akun) return akun;
          if (opsi.galatRelaas && /perkara_pelaksanaan_relaas/.test(sql)) throw new Error("ER_BAD_FIELD_ERROR: Unknown column 'x' in 'field list' (rahasia)");
          if (/perkara_pelaksanaan_relaas/.test(sql)) {
            return [{ id: 1, pengguna: 68, perkaraId: 9, nomor: "1/Pdt.G/2026/PA.Dgl", tanggal: "2026-08-01", diinput: "2026-08-02", berdokumen: 1, sidang: "2026-08-10" }];
          }
          if (/FROM perkara_proses pr/.test(sql)) return [];
          return [];
        },
        tabelAda: async (nama) => !(opsi.tanpaTabel || []).includes(nama),
        pilihKolom: async (tabel, calon) => ((opsi.tanpaKolom || []).includes(calon[0]) ? "" : calon[0]),
        jam: () => 1790000000000,
      });
    const masukan = { tahun: "2026", periode: "tw3", jabatan: "jurusita" };
    const opsiTetap = { hariIni: "2026-10-17" };

    const normal = await tiruan().skpJabatan(masukan, opsiTetap);
    periksa("jawaban ok + periode + jabatan", normal.ok === true && normal.periode.kunci === "tw3" && normal.jabatan === "jurusita", normal);
    periksa("hanya akun jabatan cocok (jurusita-pengganti 'jsp1' tak ikut)", normal.akun.length === 1 && normal.akun[0].username === "mustini", normal.akun.map((a) => a.username));
    const rel = normal.akun[0].fakta.find((f) => f.kunci === "js-relaas-kuantitas");
    periksa("relaas terbaca dengan kejadian", rel && rel.terbaca === true && rel.kejadian.length === 1 && rel.kejadian[0].tanggalAcuan === "2026-08-10");
    periksa("akun membawa userIdSipp teks dan grup", normal.akun[0].userIdSipp === "68" && normal.akun[0].grup[0] === 600);
    periksa("dihitungPada ISO", /^\d{4}-\d{2}-\d{2}T/.test(normal.dihitungPada));
    const semuaParam = panggilan.filter((p) => /relaas/.test(p.sql)).map((p) => p.params);
    periksa("relaas dibaca sekali untuk periode lalu disaring per userid (jsp1 tak mewarisi relaas userid 68)", semuaParam.some((p) => p[0] === "2026-07-01" && p[1] === "2026-09-30") && normal.akun[0].fakta.find((f) => f.kunci === "js-relaas-kuantitas").kejadian.length === 1, semuaParam);

    // jabatan pengganti: jsp1 (jabatan 2) kini cocok
    const pengganti = await tiruan().skpJabatan({ ...masukan, jabatan: "jurusita-pengganti" }, opsiTetap);
    periksa("jabatan jurusita-pengganti memilih akun jabatan 2", pengganti.akun.some((a) => a.username === "jsp1" && a.jabatanDugaan === "jurusita-pengganti"), pengganti.akun.map((a) => a.username));

    // tidak terbaca: kolom hilang
    const tanpaKolom = await tiruan({ tanpaKolom: ["doc_relaas"] }).skpJabatan(masukan, opsiTetap);
    const f1 = tanpaKolom.akun[0].fakta.find((f) => f.kunci === "js-relaas-kuantitas");
    periksa("kolom hilang -> terbaca:false, kejadian kosong, BUKAN nol", f1.terbaca === false && f1.kejadian.length === 0 && /Kolom SIPP/.test(f1.galat), f1);
    periksa("galat tingkat jawaban memuat frasa pembaca", tanpaKolom.galat.length > 0 && tanpaKolom.galat.every((g) => !/ER_|SELECT|rahasia/i.test(g)), tanpaKolom.galat);

    // tidak terbaca: tabel hilang
    const tanpaTabel = await tiruan({ tanpaTabel: ["perkara_pelaksanaan_relaas"] }).skpJabatan(masukan, opsiTetap);
    const f2 = tanpaTabel.akun[0].fakta.find((f) => f.kunci === "js-relaas-kuantitas");
    periksa("tabel hilang -> terbaca:false + frasa", f2.terbaca === false && /tidak tersedia/.test(f2.galat), f2);

    // galat MySQL mentah tidak bocor
    const galatDb = await tiruan({ galatRelaas: true }).skpJabatan(masukan, opsiTetap);
    const f3 = galatDb.akun[0].fakta.find((f) => f.kunci === "js-relaas-kuantitas");
    periksa("galat MySQL mentah tidak masuk jawaban", f3.terbaca === false && !/ER_|Unknown column|rahasia/.test(JSON.stringify(galatDb)), f3);
    // Yang sebagian gagal tidak disinggahkan
    const lay = tiruan({ galatRelaas: true });
    await lay.skpJabatan(masukan, opsiTetap);
    const sebelum = panggilan.length;
    await lay.skpJabatan(masukan, opsiTetap);
    periksa("jawaban dengan galat TIDAK disinggahkan (dibaca ulang)", panggilan.length > sebelum);

    // singgahan jawaban utuh
    const layOk = tiruan();
    await layOk.skpJabatan(masukan, opsiTetap);
    const n1 = panggilan.length;
    await layOk.skpJabatan(masukan, opsiTetap);
    periksa("jawaban utuh disinggahkan (tanpa kueri baru)", panggilan.length === n1);

    // username tak dikenal -> 404
    const layKosong = layanan.buatLayanan({
      kueri: async (sql) => (/FROM sys_users u/.test(sql) ? [] : []),
      tabelAda: async () => true,
      pilihKolom: async (t, c) => c[0],
    });
    const tak = await layKosong.skpJabatan({ tahun: "2026", periode: "tw3", username: "hantu" }, opsiTetap);
    periksa("username tak dikenal -> 404", tak.ok === false && tak.status === 404, tak);
    const salah = await layKosong.skpJabatan({ tahun: "2026", periode: "tw9" }, opsiTetap);
    periksa("masukan salah -> 400 tanpa menyentuh SIPP", salah.ok === false && salah.status === 400);

    // SIPP tak terbaca di daftar akun -> 502
    const layMati = layanan.buatLayanan({
      kueri: async () => {
        throw new Error("ECONNREFUSED 127.0.0.1:3306");
      },
      tabelAda: async () => true,
      pilihKolom: async (t, c) => c[0],
    });
    const mati = await layMati.skpJabatan({ tahun: "2026", periode: "tw3" }, opsiTetap);
    periksa("SIPP mati -> 502 dengan frasa, tanpa galat mentah", mati.ok === false && mati.status === 502 && !/ECONNREFUSED/.test(mati.error), mati);

    // akun lama tanpa kejadian tidak ikut; unit-based tidak diwarisi akun lama
    const layLama = layanan.buatLayanan({
      kueri: async (sql, params = []) => {
        if (/FROM sys_users u/.test(sql)) {
          return [{ userid: 22, username: "kasir", nama: "K", aktif: 1 }, { userid: 99, username: "kasir_lama", nama: "L", aktif: 0 }].filter((b) => !params.length || b.username === params[0]);
        }
        if (/FROM sys_user_group ug/.test(sql)) return [{ userid: 22, groupid: 702, nama: "Kasir" }, { userid: 99, groupid: 702, nama: "Kasir" }];
        if (/FROM user_jurusita uj/.test(sql) || /FROM user_panitera up/.test(sql)) return [];
        if (/FROM perkara_putusan pt/.test(sql) && /jenis_biaya_id = 151/.test(sql)) {
          return [{ id: 1, nomor: "1/Pdt.G/2026/PA.Dgl", putusan: "2026-08-01", tanggalSisa: "2026-08-02", jumlahSisa: "1000.00", adaPanjar: 1 }];
        }
        return [];
      },
      tabelAda: async () => true,
      pilihKolom: async (t, c) => c[0],
    });
    const kasir = await layLama.skpJabatan({ tahun: "2026", periode: "tw3", jabatan: "kasir" }, opsiTetap);
    periksa("akun kasir lama tanpa kejadian tidak ikut", kasir.akun.length === 1 && kasir.akun[0].username === "kasir", kasir.akun.map((a) => a.username));
    const sisa = kasir.akun[0].fakta.find((f) => f.kunci === "ks-biaya-sisa-kembali");
    periksa("sisa panjar (unit) melekat pada akun aktif", sisa && sisa.terbaca && sisa.kejadian.length === 1 && sisa.kejadian[0].nilai === 1000, sisa);
    const lamaDiminta = await layLama.skpJabatan({ tahun: "2026", periode: "tw3", jabatan: "kasir", username: "kasir_lama" }, opsiTetap);
    const sisaLama = lamaDiminta.akun[0] && lamaDiminta.akun[0].fakta.find((f) => f.kunci === "ks-biaya-sisa-kembali");
    periksa("akun lama diminta tegas: ikut, tetapi tanpa pekerjaan unit (kunci unit tidak dikirim)", lamaDiminta.akun.length === 1 && !sisaLama, lamaDiminta.akun);
    const opr = await layLama.skpJabatan({ tahun: "2026", periode: "tw3", jabatan: "operator", username: "kasir" }, opsiTetap);
    // 20 Okt 2026: operator kini dibaca dari jejak audit SIPP akunnya (op-layanan-kuantitas); daftar kosong = nol sungguhan.
    periksa(
      "operator: akun ada, fakta jejak audit terbaca (kosong bila tak ada kegiatan), catatan operator menyebut jejak audit SIPP",
      opr.akun.length === 1 &&
        opr.akun[0].fakta.length === 1 &&
        opr.akun[0].fakta[0].kunci === "op-layanan-kuantitas" &&
        opr.akun[0].fakta[0].terbaca === true &&
        opr.catatanOperator.some((c) => /jejak audit SIPP/.test(c)),
      opr
    );
  }

  // ==========================================================================
  console.log("\n[3] ANGKA EMAS atas SIPP lokal");
  // ==========================================================================
  if (TANPA_DB) {
    dilewati += 1;
    console.log("  DILEWATI (--tanpa-db)");
    return;
  }
  const db = require("../db_config");
  const terjangkau = await new Promise((selesai) => db.query("SELECT 1 AS x", [], (e) => selesai(!e)));
  if (!terjangkau) {
    dilewati += 1;
    console.log(`  DILEWATI: DB SIPP lokal (${NAMA_DB}) tidak terjangkau - lapis 3 TIDAK dihitung lulus.`);
    return;
  }

  const OPSI = { hariIni: "2026-10-17" };
  const TW3 = { tahun: "2026", periode: "tw3", tambahan: "1" };
  const lay = layanan.buatLayanan();
  const ambil = (jawaban, username, kunci) => {
    const a = jawaban.akun.find((x) => x.username === username);
    if (!a) return null;
    return a.fakta.find((f) => f.kunci === kunci) || null;
  };
  const wajib = (f, nama) => {
    periksa(`${nama} terbaca`, f && f.terbaca === true, f);
    return f ? f.kejadian : [];
  };
  const ratarata = (daftar) => Math.round((daftar.reduce((a, b) => a + b, 0) / daftar.length) * 10) / 10;

  const mulai = Date.now();
  const semua = await lay.skpJabatan(TW3, OPSI);
  periksa("semua jabatan: ok", semua.ok === true && semua.akun.length > 0, semua.error);
  console.log(`  (semua akun: ${semua.akun.length} akun, ${Date.now() - mulai} md, ${Math.round(JSON.stringify(semua).length / 1024)} KB)`);
  periksa("tanpa galat bacaan", semua.galat.length === 0, semua.galat);
  console.log(`  INFO  catatan petugas: ${JSON.stringify(semua.catatanOperator)}`);
  const kunciDikirim = new Set();
  for (const a of semua.akun) for (const f of a.fakta) kunciDikirim.add(f.kunci);
  const sahKunci = new Set([...Object.values(layanan.KUNCI_FAKTA).flat(), ...Object.values(layanan.KUNCI_TAMBAHAN).flat()]);
  periksa("semua kunci yang dikirim dikenal (KUNCI_FAKTA atau tambahan x-)", [...kunciDikirim].every((x) => sahKunci.has(x)), [...kunciDikirim].filter((x) => !sahKunci.has(x)));
  periksa("kunci turunan TIDAK dikirim dua kali", [...kunciDikirim].every((x) => !layanan.KUNCI_TURUNAN.includes(x)), [...kunciDikirim].filter((x) => layanan.KUNCI_TURUNAN.includes(x)));
  const tanpaTambahan = await lay.skpJabatan({ tahun: "2026", periode: "tw3" }, OPSI);
  const adaX = tanpaTambahan.akun.some((a) => a.fakta.some((f) => f.kunci.startsWith("x-")));
  periksa("kunci tambahan x- hanya bila diminta", adaX === false);

  // ---- Jurusita userid 68 (mustini) ----
  console.log("\n  -- Jurusita (userid 68, mustini)");
  {
    const relaas = wajib(ambil(semua, "mustini", "js-relaas-kuantitas"), "relaas");
    emas("relaas", relaas.length, 322);
    emas("perkara berbeda", new Set(relaas.map((r) => r.perkaraId)).size, 123);
    const waktu = wajib(ambil(semua, "mustini", "js-relaas-waktu"), "relaas waktu");
    emas("relaas sampai >= 3 hari sebelum sidang (acuan - tanggal)", hitung(waktu, (r) => (selisihHari(r.tanggalAcuan, r.tanggal) ?? -1) >= 3), 312);
    const dok = wajib(ambil(semua, "mustini", "js-relaas-dokumen"), "dokumen relaas");
    emas("relaas berdokumen", dok.length, 322);
    const masuk = wajib(ambil(semua, "mustini", "js-input-kualitas"), "input relaas");
    const sel = masuk.map((r) => selisihHari(r.tanggal, r.tanggalAcuan)).filter((x) => x !== null);
    emas("rata-rata hari tanggal relaas -> diinput (1 desimal)", ratarata(sel), 7.0);
    emas("relaas diinput <= 2 hari", hitung(masuk, (r) => (selisihHari(r.tanggal, r.tanggalAcuan) ?? 99) <= 2), 45);
    const putusan = wajib(ambil(semua, "mustini", "x-js-pemberitahuan-putusan"), "pemberitahuan putusan (tambahan)");
    emas("pemberitahuan putusan (proses 218)", putusan.length, 51);
    const mus = semua.akun.find((a) => a.username === "mustini");
    periksa("mustini dugaan jurusita (jabatan 1), aktif", mus.jabatanDugaan === "jurusita" && mus.aktif === true, mus);
    const pengganti = semua.akun.filter((a) => a.jabatanDugaan === "jurusita-pengganti" && a.aktif);
    periksa("jurusita pengganti: semua tak aktif (kerangka sama)", pengganti.length === 0, pengganti.map((a) => a.username));
    emas("userid 18 (jsp2) dan 44 (Tanty) juga jurusita", ["jsp2", "Tanty Restianty"].filter((u) => semua.akun.some((a) => a.username === u && a.jabatanDugaan === "jurusita")).length, 2);
  }

  // ---- Kasir userid 22 ----
  console.log("\n  -- Kasir (userid 22, kasir)");
  {
    const daftar = wajib(ambil(semua, "kasir", "ks-pendaftaran-kuantitas"), "pendaftaran");
    emas("pendaftaran", daftar.length, 281);
    const terima = wajib(ambil(semua, "kasir", "ks-penerimaan-kuantitas"), "panjar diterima");
    emas("panjar diterima (transaksi)", terima.length, 284);
    emas("panjar diterima (Rp)", terima.reduce((a, r) => a + (r.nilai || 0), 0), 106016000);
    const biaya = wajib(ambil(semua, "kasir", "ks-biaya-kuantitas"), "biaya dibebankan");
    emasKoreksi("biaya dibebankan (kejadian per perkara)", biaya.length, 392, 393, "ada satu kelompok transaksi berperkara_id NULL (biaya tanpa perkara) yang COUNT(DISTINCT perkara_id) emas lewatkan; jumlah transaksi 3.091 dan Rp105.191.000 tetap cocok");
    emas("biaya dibebankan (transaksi, dari keterangan)", biaya.reduce((a, r) => a + Number((/\((\d+) transaksi\)/.exec(r.keterangan || "") || [0, 0])[1]), 0), 3091);
    emas("biaya dibebankan (Rp)", biaya.reduce((a, r) => a + (r.nilai || 0), 0), 105191000);
    const sisa = wajib(ambil(semua, "kasir", "ks-biaya-sisa"), "perkara bersisa panjar");
    const kembali = wajib(ambil(semua, "kasir", "ks-biaya-sisa-kembali"), "sisa panjar dikembalikan");
    emas("perkara putus bersisa panjar (penyebut)", sisa.length, 263, "emas memakai seluruh perkara putus; selisih = perkara putus tanpa panjar sama sekali");
    emas("sisa panjar dikembalikan", kembali.length, 244);
    const hariDaftar = wajib(ambil(semua, "kasir", "ks-penerimaan-kualitas"), "panjar hari pendaftaran");
    emas("panjar di hari pendaftaran", hitung(hariDaftar, (r) => r.tanggal !== null && r.tanggal === r.tanggalAcuan), 281);
    const ujiKasir = ambil(semua, "uji_kasir", "ks-pendaftaran-kuantitas");
    periksa("akun uji_kasir (aktif, tanpa kejadian) tidak mewarisi karangan", !ujiKasir || ujiKasir.kejadian.length === 0);
  }

  // ---- PP userid 67 (andini) ----
  console.log("\n  -- Panitera Pengganti (userid 67, andini)");
  {
    const sidang = wajib(ambil(semua, "andini", "pp-sidang-kuantitas"), "sidang");
    emasKoreksi("sidang", sidang.length, 102, 101, "emas menghitung 102 baris join; perkara 9850 punya DUA baris perkara_panitera_pn aktif untuk PP yang sama sehingga satu sidang terhitung dua kali (101 sidang berbeda)");
    const bas = wajib(ambil(semua, "andini", "pp-sidang-bas"), "BAS");
    emasKoreksi("BAS terisi", bas.length, 102, 101, "sidang ganda yang sama (perkara 9850); 101 sidang berbeda semuanya ber-BAS");
    const hasil = wajib(ambil(semua, "andini", "pp-sidang-waktu"), "hasil sidang");
    emasKoreksi("hasil sidang diinput <= 1 hari", hitung(hasil, (r) => (selisihHari(r.tanggal, r.tanggalAcuan) ?? 99) <= 1), 97, 96, "sidang ganda yang sama (perkara 9850) ikut menambah satu; 96 dari 101 sidang berbeda");
    const sendiri = wajib(ambil(semua, "andini", "x-pp-input-sendiri"), "diinput sendiri (tambahan)");
    emas("diinput sendiri", hitung(sendiri, (r) => r.nilai === 1), 66);
    const putus = wajib(ambil(semua, "andini", "x-pp-putus"), "putus (tambahan)");
    emas("putus", putus.length, 31);
    emasKoreksi("putus dikabulkan", hitung(putus, (r) => /Dikabulkan/.test(r.keterangan || "")), 29, 27, "status_putusan 62 Dikabulkan = 27 dari 31 putusan PP ini (sisanya Dicabut 1, Gugur 1, Tidak Dapat Diterima 2); angka 29 emas tidak terreproduksi dengan status apa pun");
    const tunjuk = wajib(ambil(semua, "andini", "x-pp-penunjukan"), "penunjukan (tambahan)");
    emas(
      "perkara ditunjuk (perkara_panitera_pn.tanggal_penetapan di periode)",
      tunjuk.length,
      40,
      "emas 40 menghitung lewat perkara_proses 30 + perkara_panitera_pn; tanggal_penetapan di tabel petugas tidak selalu sama dengan tanggal proses"
    );
  }

  // ---- Ketua / Wakil ----
  console.log("\n  -- Ketua/Wakil (userid 85 fahri, 86 sudarmin)");
  {
    const fa = wajib(ambil(semua, "fahri", "pmh-kuantitas"), "PMH fahri");
    const su = wajib(ambil(semua, "sudarmin", "pmh-kuantitas"), "PMH sudarmin");
    emas("PMH oleh akun fahri", fa.length, 227);
    emas("PMH oleh akun sudarmin", su.length, 55);
    const gabung = [...fa, ...su];
    const sehari = hitung(gabung, (r) => r.tanggal !== null && r.tanggal === r.tanggalAcuan);
    emas("PMH di hari pendaftaran (pembilang)", sehari, 243, `penyebut nyata ${gabung.length} PMH (emas memakai 281 pendaftaran Q3); PMH perkara yang didaftarkan sebelum periode ikut terhitung`);
    emas("PHS fahri", wajib(ambil(semua, "fahri", "phs-kuantitas"), "PHS fahri").length, 69);
    emas("PHS sudarmin", wajib(ambil(semua, "sudarmin", "phs-kuantitas"), "PHS sudarmin").length, 116);
    const wakil = await lay.skpJabatan({ ...TW3, jabatan: "wakil-ketua" }, OPSI);
    periksa("jabatan wakil-ketua memilih akun grup 10", wakil.akun.some((a) => a.username === "sudarmin") && wakil.akun.every((a) => a.grup.includes(10)), wakil.akun.map((a) => a.username));
  }

  // ---- Panitera ----
  console.log("\n  -- Panitera (userid 81, Sri Susilowati)");
  {
    const pn = wajib(ambil(semua, "Sri Susilowati", "pn-penunjukan-kuantitas"), "penunjukan");
    const per = (teks) => hitung(pn, (r) => (r.keterangan || "") === teks);
    emas("proses 30 Penunjukan PP", per("Penunjukan Panitera Pengganti"), 270);
    emas("proses 31 Penunjukan Kembali PP", per("Penunjukan Kembali Panitera Pengganti"), 44);
    emas("proses 291 PP ikrar", per("Penunjukan Panitera Pengganti Ikrar Talak"), 25);
    emas("proses 40 Penunjukan Jurusita", per("Penunjukan Jurusita"), 270);
    emas("proses 292 JS ikrar", per("Penetapan Jurusita Ikrar Talak"), 27);
    const kual = wajib(ambil(semua, "Sri Susilowati", "pn-penunjukan-kualitas"), "penunjukan (kualitas)");
    emas("daftar kualitas sama panjang dengan kuantitas", kual.length, pn.length);
    const sehariPp = hitung(pn, (r) => (r.keterangan || "") === "Penunjukan Panitera Pengganti" && r.tanggal !== null && r.tanggal === r.tanggalAcuan);
    console.log(`  INFO  PP (proses 30) ditunjuk di hari PMH: ${sehariPp}/${per("Penunjukan Panitera Pengganti")} dalam periode (emas 218/281 menghitung PP & JS terhadap 281 pendaftaran Q3; populasinya berbeda, tidak dibandingkan 1:1)`);
  }

  // ---- Panmud Hukum ----
  console.log("\n  -- Panmud Hukum (userid 58, munifa,SH.)");
  {
    const arsip = wajib(ambil(semua, "munifa,SH.", "x-ph-arsip-input"), "arsip diinput (tambahan)");
    emas("arsip diinput akun", arsip.length, 15);
    // tw3 -> jendela BHT = tw2 (1 Apr - 30 Jun): persis angka emas "BHT Q2 masuk arsip".
    const bht = wajib(ambil(semua, "munifa,SH.", "ph-arsip-bht"), "BHT jendela -> arsip");
    emas("BHT (jendela triwulan II): perkara BHT", bht.length, 278);
    const diarsip = wajib(ambil(semua, "munifa,SH.", "ph-arsip-kuantitas"), "BHT diarsipkan");
    emas("BHT (jendela triwulan II): sudah masuk arsip", diarsip.length, 229);
  }

  // ---- Panmud Gugatan (64) dan Permohonan (88) ----
  console.log("\n  -- Panmud Gugatan (userid 64, qadariyah) & Permohonan (userid 88, fikri)");
  {
    const gug = wajib(ambil(semua, "qadariyah", "gugatan-putusan-kuantitas"), "putus gugatan");
    const per = wajib(ambil(semua, "fikri", "permohonan-putusan-kuantitas"), "putus permohonan");
    emas("putus gugatan (alur 15)", gug.length, 213);
    emas("putus permohonan (alur 16)", per.length, 50);
    const terunggah = [...wajib(ambil(semua, "qadariyah", "gugatan-putusan-unggah"), "terunggah G"), ...wajib(ambil(semua, "fikri", "permohonan-putusan-unggah"), "terunggah P")];
    emas("putusan terunggah", terunggah.length, 263);
    const anonim = [...wajib(ambil(semua, "qadariyah", "gugatan-publikasi-kuantitas"), "anonim G"), ...wajib(ambil(semua, "fikri", "permohonan-publikasi-kuantitas"), "anonim P")];
    emas("putusan teranonimisasi", anonim.length, 262);
    const ber = [...wajib(ambil(semua, "qadariyah", "gugatan-putusan-waktu"), "pemberitahuan G"), ...wajib(ambil(semua, "fikri", "permohonan-putusan-waktu"), "pemberitahuan P")];
    emas("pemberitahuan putusan <= 7 hari (dari 263 putus)", hitung(ber, (r) => r.tanggal !== null && (selisihHari(r.tanggal, r.tanggalAcuan) ?? 99) <= 7), 107);
    const lama = ber.filter((r) => r.tanggal !== null).map((r) => selisihHari(r.tanggal, r.tanggalAcuan));
    emas("rata-rata hari pemberitahuan (1 desimal, yang tercatat)", ratarata(lama), 7.0, "emas menyebut 'rata 7,0 hari'; tepatnya 7,03 atas 164 putusan yang pemberitahuannya tercatat");
    const akta = [...wajib(ambil(semua, "qadariyah", "gugatan-akta-kualitas"), "akta G"), ...wajib(ambil(semua, "fikri", "permohonan-akta-kualitas"), "akta P")];
    emas("akta cerai (penyebut)", akta.length, 162);
    emas("akta cerai <= 7 hari sejak BHT", hitung(akta, (r) => (selisihHari(r.tanggal, r.tanggalAcuan) ?? 99) <= 7), 134);
    console.log(`  INFO  akta cerai per alur: gugatan ${wajib(ambil(semua, "qadariyah", "gugatan-akta-kuantitas"), "akta G (kuantitas)").length}, permohonan ${wajib(ambil(semua, "fikri", "permohonan-akta-kuantitas"), "akta P (kuantitas)").length}`);
  }

  // ---- Petugas Meja ----
  console.log("\n  -- Petugas Meja (userid 29, meja3g)");
  {
    const minutasi = wajib(ambil(semua, "meja3g", "mj-minutasi-kuantitas"), "minutasi");
    emas("minutasi (proses 220)", minutasi.length, 202);
    const aktaMeja = wajib(ambil(semua, "meja3g", "mj-akta-kuantitas"), "akta cerai");
    emas("akta cerai (proses 296)", aktaMeja.length, 142);
    periksa("minutasi TANPA tanggal acuan (bukan ukuran waktu)", minutasi.every((r) => r.tanggalAcuan === null));
    const meja1 = semua.akun.find((a) => a.username === "meja1g");
    periksa("Meja 1 dikenali dari nama grup (petugas-meja), terbaca walau hampir kosong", meja1 && meja1.jabatanDugaan === "petugas-meja" && meja1.fakta.every((f) => f.terbaca), meja1);
  }

  // ---- Konsistensi periode: tiga bulan = triwulan ----
  console.log("\n  -- Konsistensi periode bulanan");
  {
    let jumlah = 0;
    for (const b of ["b07", "b08", "b09"]) {
      const j = await lay.skpJabatan({ tahun: "2026", periode: b, jabatan: "jurusita", username: "mustini" }, OPSI);
      jumlah += ambil(j, "mustini", "js-relaas-kuantitas").kejadian.length;
    }
    emas("relaas b07+b08+b09 = relaas tw3", jumlah, 322);
    const tahun = await lay.skpJabatan({ tahun: "2026", periode: "tahun", jabatan: "jurusita", username: "mustini" }, OPSI);
    const kejTahun = ambil(tahun, "mustini", "js-relaas-kuantitas").kejadian;
    periksa("relaas tahun 2026 >= triwulan III", kejTahun.length >= 322, kejTahun.length);
    // beberapa username sekaligus (parameter berulang), termasuk username berkoma
    const banyak = await lay.skpJabatan({ tahun: "2026", periode: "tw3", username: ["mustini", "munifa,SH.", "tidak_ada_akun"] }, OPSI);
    periksa("beberapa username: hanya akun yang ada, jabatan menurut dugaan", banyak.ok && banyak.akun.map((a) => a.username).sort().join("|") === "munifa,SH.|mustini", banyak.akun && banyak.akun.map((a) => a.username));
    periksa("username tak dikenal dicatat untuk petugas", banyak.catatanOperator.some((c) => c.includes("tidak_ada_akun")), banyak.catatanOperator);
    const pm = banyak.akun.find((a) => a.username === "munifa,SH.");
    periksa("username berkoma tidak dipecah (munifa,SH. -> panmud-hukum)", pm && pm.jabatanDugaan === "panmud-hukum");
    const semuaTidak = await lay.skpJabatan({ tahun: "2026", periode: "tw3", username: ["tidak_ada_1", "tidak_ada_2"] }, OPSI);
    periksa("tak satu pun dikenal -> 404 berkode", semuaTidak.ok === false && semuaTidak.status === 404 && semuaTidak.alasan === "akun_tidak_ditemukan");
    const bridge = await lay.daftarAkun({});
    periksa("jembatan akun: akun aktif beserta grup dan jabatan dugaan", bridge.ok && bridge.akun.every((a) => a.aktif) && bridge.akun.some((a) => a.username === "mustini" && a.jabatanDugaan === "jurusita" && a.grup.some((g) => g.groupid === 600 && g.nama === "Jurusita")), bridge.akun && bridge.akun.length);
    const bridgeSemua = await lay.daftarAkun({ semua: "1" });
    periksa("jembatan akun semua=1 menyertakan akun lama", bridgeSemua.akun.length > bridge.akun.length);
    const pn = bridge.akun.find((a) => a.username === "andini");
    periksa("andini tertaut ke panitera (user_panitera)", pn && pn.tautPanitera === true);
    const belum = await lay.skpJabatan({ tahun: "2026", periode: "b12" }, OPSI);
    periksa("Desember 2026 (belum mulai) ditolak", belum.ok === false && belum.status === 400);
    const s0 = Date.now();
    await lay.skpJabatan(TW3, OPSI);
    periksa("panggilan kedua dari singgahan (cepat)", Date.now() - s0 < 50, `${Date.now() - s0} md`);
  }
}

main()
  .catch((error) => {
    gagal += 1;
    console.log(`  GAGAL pengecualian tak tertangani - ${error && error.stack ? error.stack : error}`);
  })
  .finally(() => {
    console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal${selisih ? ` (${selisih} selisih angka emas)` : ""}${koreksiTercatat ? `, ${koreksiTercatat} angka emas dikoreksi (sebab tercetak)` : ""}${dilewati ? `, ${dilewati} lapis dilewati` : ""}`);
    process.exit(gagal ? 1 : 0);
  });
