"use strict";

/**
 * ============================================================================
 * BAHAN TUNDA OTOMATIS 16.30 - SATU SIDANG, SATU PANGGILAN, HANYA MEMBACA
 * ============================================================================
 *
 * Aturannya di portal (src/lib/tunda-otomatis.ts, fungsi murni). Berkas ini
 * mengumpulkan bahannya dari pembaca yang SUDAH ADA - tidak ada kueri tulis:
 *
 *   keadaan, riwayat, antrian, atasNama  sidangHasilAlur.keadaanHasilSidang
 *                                        (sama dengan borang tunda)
 *   kalender                             sidangHasilService.kalenderPerkara
 *   kontak (ada/tidaknya email)          sidangKontakService.kontakPerkara
 *   kunci                                penetapanKunciService.lihat
 *   kelilingBerikut                      sidangHasilService.tanggalKelilingLokasi
 *
 * Tiap bagian gagal sendiri-sendiri dan dilaporkan null (= tidak terbaca),
 * bukan kosong - portal tidak menebak dari bahan yang tidak terbaca.
 */

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function depsBawaan() {
  return {
    alur: require("./sidangHasilAlur"),
    hasil: require("./sidangHasilService"),
    kontak: require("./sidangKontakService"),
    kunci: () => require("./penetapanKunciService").layanan(),
  };
}

async function bahanSidang(jadwalId, deps = depsBawaan()) {
  const id = Number(jadwalId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "jadwal_tidak_sah" };
  const { status, body } = await deps.alur.keadaanHasilSidang(id);
  if (status !== 200 || !body || !body.ok) return { ok: false, alasan: (body && body.alasan) || "jadwal_tidak_ketemu" };
  const keadaan = body.keadaan;
  const keliling = bersih(keadaan.sidangKeliling) === "Y";
  const [kalender, kontak, kunci, kelilingBerikut, panggilanTergugat] = await Promise.all([
    deps.hasil.kalenderPerkara(keadaan.perkaraId).catch(() => null),
    deps.kontak
      .kontakPerkara(keadaan.perkaraId)
      .then((k) => (k && k.ok ? k.kontak : null))
      .catch(() => null),
    Promise.resolve()
      .then(() => deps.kunci().lihat(keadaan.perkaraId))
      .catch(() => ({ aktif: false, tidakTerbaca: true })),
    keliling ? deps.hasil.tanggalKelilingLokasi(keadaan.ruangan, keadaan.tanggalSidang).catch(() => null) : Promise.resolve(null),
    // Aturan 4 (keputusan 22 Okt): cara panggil Tergugat terakhir - elektronik = 7 hari.
    typeof deps.hasil.caraPanggilTergugatTerakhir === "function"
      ? deps.hasil.caraPanggilTergugatTerakhir(keadaan.perkaraId, keadaan.jadwalId).catch(() => null)
      : Promise.resolve(null),
  ]);
  return {
    ok: true,
    keadaan,
    riwayat: body.riwayat || null,
    antrian: body.antrian || null,
    atasNama: body.atasNama || null,
    kalender,
    kontak,
    kunci: { aktif: Boolean(kunci && kunci.aktif), tidakTerbaca: Boolean(kunci && kunci.tidakTerbaca), oleh: bersih(kunci && kunci.oleh) },
    kelilingBerikut,
    panggilanTergugat,
  };
}

module.exports = { bahanSidang };
