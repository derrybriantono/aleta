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
 * Akar folder resources SIPP - tempat berkasnya benar-benar ditulis.
 *
 * Dari pengaturan, sebab letak SIPP berbeda antara peladen dan pemasangan
 * setempat. Tanpa itu, satu-satunya jalan adalah menebak - dan berkas yang
 * ditulis ke folder yang keliru tercatat di basis data sebagai ada padahal
 * tidak pernah dapat dibuka.
 */
function akarSipp(runtimeConfig = readRuntimeConfig()) {
  const dari = (runtimeConfig && runtimeConfig.blangkoPenetapan) || {};
  return String(dari.akarSipp || process.env.ALETA_SIPP_ROOT || "").trim();
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
  if (!(await sippSkemaService.tabelAda("perkara_dokumen_penetapan"))) {
    return { ok: false, alasan: "tabel_dokumen_penetapan_tidak_ada" };
  }

  const akar = akarSipp();
  if (!akar) return { ok: false, alasan: "akar_sipp_belum_disetel" };

  const relatif = jalurDokumen(nomorPerkara, kunci, saat);
  const penuh = path.join(akar, relatif);

  try {
    fs.mkdirSync(path.dirname(penuh), { recursive: true });
    fs.writeFileSync(penuh, pdf);
  } catch (galat) {
    return { ok: false, alasan: "berkas_tidak_dapat_ditulis", pesan: String(galat.message || galat).slice(0, 200) };
  }

  // Baris petugas yang ditunjuk perkara_penetapan_id - dibaca dari tabelnya
  // masing-masing, yang berbeda tiap jenis.
  const tabelPetugas = TABEL_PENETAPAN[kunci];
  const barisPetugas = await runQuery(
    `SELECT id FROM ${tabelPetugas} WHERE perkara_id = ? ORDER BY id DESC LIMIT 1`,
    [id]
  ).catch(() => []);
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
  BLANGKO_BAWAAN,
  pengaturanBlangko,
  nomorBersih,
  jalurDokumen,
  cariPosisiNama,
  sisipkanTandaTangan,
  ambilBlangko,
  akarSipp,
  simpanKeSipp,
  terbitkan,
};
