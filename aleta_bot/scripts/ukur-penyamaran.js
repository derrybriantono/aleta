#!/usr/bin/env node
/**
 * ============================================================================
 * MENGUKUR PENYAMARAN ATAS POSITA SUNGGUHAN
 * ============================================================================
 *
 * Tahap 1b menuntut satu hal yang tidak dapat dijawab dengan membaca kode:
 * apakah penyamarannya benar-benar bekerja atas kalimat yang ditulis petugas,
 * bukan atas contoh yang disusun sendiri agar lulus.
 *
 * Skrip ini mengambil N posita SUNGGUHAN dari SIPP setempat beserta daftar
 * pihaknya, menjalankan penyamaran, lalu melaporkan dua angka yang berbeda
 * artinya:
 *
 *   TERGANTI   berapa nama/nomor yang berhasil diganti - semakin banyak
 *              semakin baik, tetapi ini BUKAN bukti aman
 *   SISA       apa yang MASIH menyerupai data pribadi sesudah disamarkan -
 *              inilah angka yang menentukan
 *
 * TIDAK ADA SATU BITA PUN YANG DIKIRIM KE MANA-MANA. Skrip ini membaca basis
 * data setempat dan menulis ke berkas setempat. Itu disengaja: mengukur
 * kebocoran tidak boleh menjadi kebocoran.
 *
 * Keluaran ringkasnya ke layar; rinciannya - termasuk contoh yang lolos -
 * ke berkas di folder kerja, supaya dapat dibaca tanpa menempelkan isi
 * perkara ke percakapan mana pun.
 *
 * Pemakaian:
 *   node scripts/ukur-penyamaran.js [jumlah]     bawaan 20
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Sambungan SIPP dipinjam dari layanan bot sendiri, bukan dibuat baru: ia
// sudah memegang setelan, kata sandi, dan penjaga kuerinya. Satu jalan masuk
// ke basis data pengadilan sudah cukup.
const externalDb = require("../services/externalDbService");
const penyamaran = require("../services/penyamaranPerkaraService");

const SAMBUNGAN = process.env.ALETA_BOT_SAMBUNGAN_SIPP || "sipp_primary";
/**
 * Skema disebut TEGAS, bukan diwariskan dari sambungan.
 *
 * Di XAMPP setempat ada dua basis data SIPP berdampingan: `sipp` (salinan PA
 * Bungku) dan `sipp_donggala` (satker sendiri). Sambungan bawaan bot menunjuk
 * yang pertama. Mengukur penyamaran atas basis data satker LAIN tidak keliru
 * secara teknis, tetapi angkanya tidak berarti apa-apa bagi PA Donggala.
 */
const SKEMA = process.env.ALETA_SIPP_SKEMA || "sipp_donggala";

const FOLDER_KERJA = process.env.ALETA_FOLDER_KERJA || "D:/aleta-dev/kerja";

/**
 * Peran SIPP -> peran penyamaran.
 *
 * SIPP menyimpan jenis pihak sebagai teks bebas yang berbeda antar jenis
 * perkara ("Penggugat", "Pemohon I", "Tergugat/Termohon"). Dicocokkan dengan
 * kata kuncinya, bukan disamakan persis.
 */
/**
 * pihak_ke SIPP -> peran penyamaran.
 *
 * Angka-angka ini bukan tebakan; ia sudah diukur atas v_pihak_perkara PA
 * Donggala ketika jadwal sidang dibangun (lihat sippJadwalSidangService):
 *
 *   1  Pemohon / Penggugat      14.268
 *   2  Tergugat / Termohon       5.846
 *   4  TURUT TERGUGAT               27
 *   5  SAKSI                    16.480
 *
 * Yang di luar itu disebut "lain" - tetap disamarkan, hanya sebutannya umum.
 */
function peranDariPihakKe(pihakKe) {
  const n = Number(pihakKe);
  if (n === 1) return "penggugat";
  if (n === 2) return "tergugat";
  if (n === 4) return "turut_tergugat";
  if (n === 5) return "saksi";
  return "lain";
}

async function utama() {
  const jumlah = Math.max(1, Math.min(200, Number(process.argv[2]) || 20));

  // Posita disimpan di perkara_gugatan; yang kosong tidak ada gunanya diukur.
  // Posita ada di kolom perkara.posita - bukan tabel tersendiri.
  const baris = await externalDb.query(
    SAMBUNGAN,
    `SELECT p.perkara_id, p.nomor_perkara, p.posita
       FROM ${SKEMA}.perkara p
      WHERE p.posita IS NOT NULL AND CHAR_LENGTH(p.posita) > 200
      ORDER BY p.perkara_id DESC
      LIMIT ?`,
    [jumlah]
  );

  const laporan = [];
  let totalGanti = 0;
  let adaSisa = 0;
  const sisaPerJenis = new Map();

  for (const satu of baris) {
    const pihak = await externalDb.query(
      SAMBUNGAN,
      `SELECT nama, pihak_ke FROM ${SKEMA}.v_pihak_perkara WHERE perkara_id = ? ORDER BY pihak_ke ASC, urutan ASC`,
      [satu.perkara_id]
    );
    // ==========================================================================
    // ANAK IKUT KAMUS - DAN INI TEMUAN PENGUKURAN, BUKAN DUGAAN
    // ==========================================================================
    //
    // Pengukuran pertama atas 150 posita menyisakan enam nama orang sungguhan:
    // UWAIS ALQORNI, MUHAMMAD FATHIR, FATHIYAH LASYIRA, dan seterusnya.
    // Seluruhnya nama ANAK - disebut di posita ("telah dikaruniai anak
    // bernama ..."), tetapi anak bukan PIHAK, sehingga tidak ada di
    // v_pihak_perkara dan tidak pernah masuk kamus.
    //
    // Nama anak ada di perkara_anak_pihak, dan tabel itu memuat NIK-nya pula.
    // Anak adalah orang yang paling tidak punya pilihan atas datanya sendiri;
    // ia yang paling berhak disamarkan.
    const anak = await externalDb.query(
      SAMBUNGAN,
      `SELECT nama_anak AS nama FROM ${SKEMA}.perkara_anak_pihak WHERE perkara_id = ? AND nama_anak IS NOT NULL AND nama_anak <> ''`,
      [satu.perkara_id]
    );
    const daftarPihak = [
      ...pihak.map((x) => ({ nama: x.nama, peran: peranDariPihakKe(x.pihak_ke) })),
      ...anak.map((x) => ({ nama: x.nama, peran: "anak" })),
    ];

    const hasil = penyamaran.siapkanMuatan({
      teks: String(satu.posita || ""),
      pihak: daftarPihak,
      nomorPerkara: satu.nomor_perkara,
    });

    totalGanti += hasil.bukti.jumlahPenggantian;
    if (!hasil.bukti.bersih) {
      adaSisa += 1;
      for (const s of hasil.bukti.sisa) {
        sisaPerJenis.set(s.jenis, (sisaPerJenis.get(s.jenis) || 0) + s.jumlah);
      }
    }
    laporan.push({
      nomorPerkara: satu.nomor_perkara,
      jumlahPihak: daftarPihak.length,
      jumlahKamus: hasil.bukti.jumlahKamus,
      terganti: hasil.bukti.jumlahPenggantian,
      perKategori: hasil.bukti.perKategori,
      bersih: hasil.bukti.bersih,
      sisa: hasil.bukti.sisa,
      cuplikan: hasil.teks.slice(0, 400),
    });
  }

  fs.mkdirSync(FOLDER_KERJA, { recursive: true });
  const jalur = path.join(FOLDER_KERJA, `ukur-penyamaran-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(jalur, JSON.stringify(laporan, null, 1), "utf8");

  console.log(`Diukur atas ${laporan.length} posita sungguhan dari ${SKEMA} setempat.`);
  console.log(`  terganti    : ${totalGanti} (rata-rata ${(totalGanti / Math.max(1, laporan.length)).toFixed(1)} per posita)`);
  console.log(`  bersih      : ${laporan.length - adaSisa} dari ${laporan.length}`);
  if (sisaPerJenis.size > 0) {
    console.log("  SISA yang masih menyerupai data pribadi:");
    for (const [jenis, n] of [...sisaPerJenis].sort((a, b) => b[1] - a[1])) {
      console.log(`    - ${jenis}: ${n}`);
    }
  }
  console.log(`  rincian     : ${jalur}`);
  console.log("");
  console.log("Angka 'terganti' BUKAN bukti aman. Yang menentukan angka 'bersih' dan daftar SISA.");
  return adaSisa === 0 ? 0 : 2;
}

utama()
  .then((kode) => process.exit(kode))
  .catch((galat) => {
    console.error(`Gagal mengukur: ${galat && galat.message ? galat.message : galat}`);
    process.exit(1);
  });
