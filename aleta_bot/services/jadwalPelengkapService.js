"use strict";

/**
 * Pelengkap Jadwal Sidang untuk layar yang membaca CERMIN (A4, 25 Okt 2026).
 *
 * ============================================================================
 * KENAPA ADA
 * ============================================================================
 *
 * Rute lama /sipp/jadwal-sidang menjawab dua hal sekaligus: daftar sidang
 * (±40 kueri SIPP, kini disalin ke cermin) DAN keterangan langsung yang tidak
 * boleh basi - peta antrian, waktu antrian berdetik, dan kehadiran rinci per
 * orang. Layar yang membaca cermin tetap membutuhkan bagian kedua itu, dengan
 * bentuk yang SAMA PERSIS dengan jawaban rute lama (`antrian`, `antrian.kehadiran`,
 * `waktuAntrian`), tetapi tanpa menanyai SIPP untuk daftar sidangnya.
 *
 * Berkas ini menyusunnya dari layanan yang sama dengan rute lama
 * (antrianSidangService, antrianWaktuService, kehadiranAntrianService). Rute
 * lama TIDAK diubah (ia dijaga uji sumber-teks); kesamaan bentuknya dijaga
 * src/test/cermin-jadwal-sidang-25okt.test.ts dengan menjalankan KEDUANYA atas
 * layanan palsu yang sama.
 *
 * Hanya membaca: peta antrian dari basis data aplikasi antrian, waktu antrian
 * dan kehadiran dari basis data ALETA bot. Tidak menyentuh SIPP perkara dan
 * tidak menulis apa pun.
 */

const antrianSidangService = require("./antrianSidangService");
const antrianWaktuService = require("./antrianWaktuService");
const kehadiranAntrianService = require("./kehadiranAntrianService");

function bersihId(daftar) {
  return [...new Set((daftar || []).map((x) => String(x || "").trim()).filter(Boolean))];
}

/**
 * @param {{ baris: Array<{ perkaraId: string|number, tanggalSidang: string }>, waktu?: boolean }} masukan
 *   baris = sidang yang ditampilkan layar (dari cermin); waktu = layar Jadwal Sidang (?waktu=1)
 * @param {object} [deps] layanan untuk uji
 */
async function pelengkapJadwal(masukan = {}, deps = {}) {
  const antrianService = deps.antrianSidangService || antrianSidangService;
  const waktuService = deps.antrianWaktuService || antrianWaktuService;
  const kehadiranService = deps.kehadiranAntrianService || kehadiranAntrianService;
  const baris = Array.isArray(masukan.baris) ? masukan.baris : [];
  const idPerkara = baris.map((b) => b.perkaraId);

  // Peta antrian dibaca PENUH sekali; gagalnya ditelan seperti rute lama (jadwal tetap tampil).
  const petaPenuh = await Promise.resolve()
    .then(() => antrianService.petaAntrian())
    .catch((galat) => ({
      terbaca: false,
      alasan: String((galat && galat.message) || galat).slice(0, 200),
      peta: {},
      tanggal: [],
    }));
  const antrian = antrianService.saringUntukPerkara(petaPenuh, idPerkara);

  if (masukan.waktu !== true) return { ok: true, antrian };

  const janjiWaktuAntrian = Promise.resolve()
    .then(() =>
      waktuService.waktuUntukJadwal({
        tanggal: baris.map((b) => b.tanggalSidang),
        petaNomor: petaPenuh && petaPenuh.terbaca ? petaPenuh.peta : null,
      })
    )
    .catch((galat) => ({
      terbaca: false,
      alasan: String((galat && galat.message) || galat).slice(0, 200),
      sekarang: "",
      hariIni: "",
      langsungTerbaca: false,
      rekamanTerbaca: false,
      baris: [],
    }));

  // Dikunci "perkaraId|tanggal": perkara yang sama dapat bersidang lagi pada tanggal lain.
  const kehadiranRinci = {};
  try {
    const perTanggal = new Map();
    for (const b of baris) {
      const hari = String(b.tanggalSidang || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(hari)) continue;
      if (!perTanggal.has(hari)) perTanggal.set(hari, new Set());
      perTanggal.get(hari).add(String(b.perkaraId || ""));
    }
    const daftarHari = [...perTanggal.entries()];
    const hasilHari = await Promise.allSettled(daftarHari.map(([hari, kumpulan]) => kehadiranService.daftarKehadiran([...kumpulan], hari)));
    daftarHari.forEach(([hari], i) => {
      const satu = hasilHari[i];
      if (satu.status !== "fulfilled") return;
      for (const [perkaraId, isi] of Object.entries(satu.value || {})) kehadiranRinci[`${perkaraId}|${hari}`] = isi;
    });
  } catch {
    // Tabel kehadiran tidak terbaca: kolom antrian tetap seperti semula.
  }
  const waktuAntrian = await janjiWaktuAntrian;
  return { ok: true, antrian: { ...antrian, kehadiran: kehadiranRinci }, waktuAntrian };
}

module.exports = { pelengkapJadwal, _bersihId: bersihId };
