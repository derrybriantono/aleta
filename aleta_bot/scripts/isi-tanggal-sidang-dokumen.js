"use strict";

/**
 * ============================================================================
 * MENGISI TANGGAL SIDANG DOKUMEN e-COURT YANG SUDAH TERLANJUR KOSONG
 * ============================================================================
 *
 * Sejak sekarang tiap dokumen e-Court membawa tanggal sidangnya sendiri,
 * dibaca dari kepala blok agenda di halaman perkara ("Silahkan Mengupload
 * Berkas Persidangan Sebelum : <tanggal> Pukul : <jam>"). Dokumen yang
 * TERLANJUR tersimpan sebelum perbaikan itu tidak punya tanggal sama sekali,
 * dan tidak akan mendapatkannya sampai perkaranya ditarik ulang.
 *
 * Alat ini mengisi yang lama, dari SIPP, tanpa membuka e-Court lagi.
 *
 * ============================================================================
 * KENAPA HARUS BERHATI-HATI, DAN BUKAN SEKADAR MENCOCOKKAN KATA
 * ============================================================================
 *
 * Godaannya mencocokkan agenda dokumen dengan agenda baris sidang - "Jawaban"
 * ketemu "Jawaban Tergugat", selesai. Itu tidak aman, dan tidak amannya
 * TERUKUR: dari 1.947 pasangan (perkara, kata-tahapan) di sipp_donggala, 304
 * pasangan (15,6%) punya LEBIH DARI SATU baris sidang berkata sama. Perkara
 * 1396 punya tujuh baris beragenda "bukti"; perkara 614 punya lima baris
 * beragenda "jawaban".
 *
 * Menebak salah satunya berarti menempelkan berkas pada baris sidang yang
 * keliru - dan hakim yang membuka baris itu mengunduh berkas perkara yang
 * salah tanpa ada yang menyadarinya. Karena itu aturannya satu:
 *
 *   SATU CALON = diisi.  NOL atau LEBIH DARI SATU calon = DIBIARKAN KOSONG.
 *
 * Kolom yang kosong jujur. Kolom yang salah berbohong.
 *
 * ============================================================================
 * JALANKAN
 * ============================================================================
 *
 *   docker exec aleta-bot node scripts/isi-tanggal-sidang-dokumen.js
 *       -> hanya MELAPOR. Tidak satu baris pun diubah.
 *
 *   docker exec aleta-bot node scripts/isi-tanggal-sidang-dokumen.js --tulis
 *       -> mengisi yang yakin saja.
 *
 *   docker exec aleta-bot node scripts/isi-tanggal-sidang-dokumen.js --periksa
 *       -> tidak mengisi apa pun; memeriksa yang SUDAH terisi: adakah baris
 *          Jadwal Sidang di SIPP pada tanggal itu? Inilah pembuktian bahwa
 *          anggapan "tenggat unggah = hari sidang" berlaku umum, bukan hanya
 *          pada satu perkara yang kebetulan diuji.
 */

const botDb = require("../services/botDbService");
const sippJadwalSidangService = require("../services/sippJadwalSidangService");

const TULIS = process.argv.includes("--tulis");
const PERIKSA = process.argv.includes("--periksa");

/**
 * Kata tahapan yang dipakai untuk mencocokkan agenda dokumen ke baris sidang.
 *
 * Sengaja pendek dan sedikit. Daftar yang panjang menambah kecocokan PALSU,
 * bukan kecocokan benar - dan setiap kecocokan palsu di sini berujung pada
 * berkas yang menempel di sidang orang lain.
 */
const KATA_TAHAPAN = [
  "jawaban",
  "replik",
  "duplik",
  "kesimpulan",
  "bukti",
  "pembuktian",
  "saksi",
  "mediasi",
  "gugatan",
  "putusan",
];

function seragam(teks) {
  return String(teks || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Kata tahapan yang muncul pada sepotong teks, tanpa urutan. */
function kataTahapan(teks) {
  const rapi = seragam(teks);
  return KATA_TAHAPAN.filter((kata) => rapi.includes(kata));
}

function tanggalSaja(nilai) {
  if (!nilai) return "";
  const waktu = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(waktu.getTime())) return "";
  const bulan = String(waktu.getMonth() + 1).padStart(2, "0");
  const hari = String(waktu.getDate()).padStart(2, "0");
  return `${waktu.getFullYear()}-${bulan}-${hari}`;
}

/**
 * Satu baris sidang yang PASTI milik dokumen ini, atau null.
 *
 * Tiga saringan berurutan, dan ketiganya harus menyisakan tepat satu:
 *
 *   1. agenda baris sidang memuat kata tahapan yang sama dengan dokumennya;
 *   2. dokumen diunggah pada atau sebelum hari sidang itu - berkas jawaban
 *      tidak mungkin diunggah sesudah sidang jawabannya lewat;
 *   3. bila masih lebih dari satu, yang hari sidangnya PALING DEKAT sesudah
 *      hari unggah - tetapi hanya bila jaraknya jelas berbeda. Dua baris yang
 *      sama dekatnya dibiarkan tidak terputuskan.
 */
function calonSidang(dokumen, jadwal) {
  const kataDokumen = kataTahapan(`${dokumen.agenda || ""} ${dokumen.jenis_dokumen || ""} ${dokumen.judul_dokumen || ""}`);
  if (kataDokumen.length === 0) return { baris: null, sebab: "dokumen tanpa kata tahapan" };

  const seKata = jadwal.filter((sidang) => {
    const kataSidang = kataTahapan(sidang.agenda);
    return kataSidang.some((kata) => kataDokumen.includes(kata));
  });
  if (seKata.length === 0) return { baris: null, sebab: "tidak ada baris sidang berkata sama" };

  const hariUnggah = tanggalSaja(dokumen.diunggah_pada);
  const sebelum = hariUnggah ? seKata.filter((sidang) => sidang.tanggalSidang >= hariUnggah) : seKata;
  const tersisa = sebelum.length > 0 ? sebelum : seKata;
  if (tersisa.length === 1) return { baris: tersisa[0], sebab: "" };

  if (!hariUnggah) return { baris: null, sebab: `${tersisa.length} calon, tanggal unggah tidak diketahui` };

  const berjarak = tersisa
    .map((sidang) => ({
      sidang,
      jarak: Math.abs(
        (new Date(`${sidang.tanggalSidang}T00:00:00`).getTime() -
          new Date(`${hariUnggah}T00:00:00`).getTime()) /
          86400000
      ),
    }))
    .sort((a, b) => a.jarak - b.jarak);

  // Dua baris yang sama dekatnya tidak dapat dipisahkan, dan memilih salah
  // satunya berarti menebak.
  if (berjarak.length > 1 && berjarak[0].jarak === berjarak[1].jarak) {
    return { baris: null, sebab: `${tersisa.length} calon berjarak sama` };
  }
  return { baris: berjarak[0].sidang, sebab: "" };
}

async function utama() {
  await botDb.ensureSchema();

  if (PERIKSA) {
    await periksaYangSudahTerisi();
    return;
  }

  const baris = await botDb.query(
    `SELECT document_key, nomor_perkara, judul_dokumen, jenis_dokumen, agenda, diunggah_pada
       FROM aleta_bot_ecourt_documents
      WHERE tanggal_sidang IS NULL
      ORDER BY nomor_perkara, diunggah_pada`
  );

  console.log(`Dokumen tanpa tanggal sidang: ${baris.length}`);
  if (baris.length === 0) return;

  const perPerkara = new Map();
  for (const row of baris) {
    const nomor = String(row.nomor_perkara || "");
    if (!nomor) continue;
    perPerkara.set(nomor, [...(perPerkara.get(nomor) || []), row]);
  }
  console.log(`Perkara yang terlibat: ${perPerkara.size}`);

  let terisi = 0;
  let dibiarkan = 0;
  let tanpaJadwal = 0;
  const sebabDibiarkan = new Map();

  for (const [nomor, dokumen] of perPerkara) {
    let jadwal = [];
    try {
      jadwal = await sippJadwalSidangService.jadwalPerkara(nomor);
    } catch (galat) {
      console.log(`  ${nomor}: jadwal gagal dibaca (${galat.message})`);
    }
    if (!Array.isArray(jadwal) || jadwal.length === 0) {
      tanpaJadwal += dokumen.length;
      continue;
    }

    for (const row of dokumen) {
      const { baris: pilihan, sebab } = calonSidang(row, jadwal);
      if (!pilihan) {
        dibiarkan += 1;
        sebabDibiarkan.set(sebab, (sebabDibiarkan.get(sebab) || 0) + 1);
        continue;
      }
      terisi += 1;
      const waktu = `${pilihan.tanggalSidang} ${pilihan.jamSidang || "00:00"}:00`;
      if (TULIS) {
        await botDb.query(
          `UPDATE aleta_bot_ecourt_documents
              SET tanggal_sidang = ?
            WHERE document_key = ? AND tanggal_sidang IS NULL`,
          [waktu, row.document_key]
        );
      }
    }
  }

  console.log("");
  console.log(`  ${TULIS ? "Diisi" : "Dapat diisi"}          : ${terisi}`);
  console.log(`  Dibiarkan kosong      : ${dibiarkan}`);
  console.log(`  Perkaranya tanpa jadwal di SIPP: ${tanpaJadwal}`);
  for (const [sebab, jumlah] of [...sebabDibiarkan].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${jumlah.toString().padStart(4)} - ${sebab}`);
  }
  if (!TULIS) console.log("\n(tidak ada yang ditulis; tambahkan --tulis)");
}

/**
 * Pembuktian, bukan pengandaian.
 *
 * Anggapan "tenggat unggah = hari sidang" baru diuji atas SATU perkara (dua
 * blok agenda, dua dari dua cocok sampai ke jamnya). Kuat, tetapi bukan
 * seluruh arsip. Di bawah ~95% anggapan itu tidak berlaku umum, dan pengisian
 * dari SIPP harus jadi jalur utama - bukan cadangan.
 */
async function periksaYangSudahTerisi() {
  const baris = await botDb.query(
    `SELECT nomor_perkara, judul_dokumen, agenda, tanggal_sidang
       FROM aleta_bot_ecourt_documents
      WHERE tanggal_sidang IS NOT NULL
      ORDER BY nomor_perkara`
  );
  console.log(`Dokumen bertanggal sidang: ${baris.length}`);
  if (baris.length === 0) {
    console.log("(belum ada yang terisi - jalankan penarikan e-Court dulu)");
    return;
  }

  const jadwalPerPerkara = new Map();
  let cocok = 0;
  let meleset = 0;
  const contohMeleset = [];

  for (const row of baris) {
    const nomor = String(row.nomor_perkara || "");
    if (!jadwalPerPerkara.has(nomor)) {
      let jadwal = [];
      try {
        jadwal = await sippJadwalSidangService.jadwalPerkara(nomor);
      } catch {
        jadwal = [];
      }
      jadwalPerPerkara.set(nomor, jadwal);
    }
    const jadwal = jadwalPerPerkara.get(nomor) || [];
    const hari = tanggalSaja(row.tanggal_sidang);
    if (jadwal.some((sidang) => sidang.tanggalSidang === hari)) {
      cocok += 1;
    } else {
      meleset += 1;
      if (contohMeleset.length < 10) contohMeleset.push(`${nomor} ${hari} "${row.agenda || ""}"`);
    }
  }

  const persen = baris.length > 0 ? ((cocok / baris.length) * 100).toFixed(1) : "0.0";
  console.log(`  Ada baris sidang pada tanggal itu : ${cocok} (${persen}%)`);
  console.log(`  Tidak ada                         : ${meleset}`);
  for (const contoh of contohMeleset) console.log(`      ${contoh}`);
  if (Number(persen) < 95) {
    console.log("\nDI BAWAH 95% - anggapan 'tenggat unggah = hari sidang' TIDAK berlaku umum.");
    console.log("Pengisian dari SIPP harus jadi jalur utama, bukan cadangan.");
  }
}

utama()
  .then(() => process.exit(0))
  .catch((galat) => {
    console.error(galat);
    process.exit(1);
  });
