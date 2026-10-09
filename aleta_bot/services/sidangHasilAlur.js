"use strict";

/**
 * ============================================================================
 * ALUR TOMBOL TUNDA / PUTUSAN JADWAL SIDANG - SATU TEMPAT, DAPAT DIUJI
 * ============================================================================
 *
 * Dipindah dari internalGatewayRoutes.js (7 Okt 2026, kasus 273) supaya
 * urutannya dapat diuji tanpa menyalakan seluruh gerbang:
 *
 *   1. rencana disusun (TIDAK menulis) - ditolak = 400 + kalimat sebabnya;
 *   2. jeda seperti manusia (hanya bila menulis sungguhan), lalu jam basis
 *      data diambil SESUDAH jeda - waktu yang tercatat waktu sebenarnya;
 *   3. rencana dijalankan dalam SATU transaksi (jalankanRencanaUtuh): gagal di
 *      tengah = seluruhnya dibatalkan, tidak ada lagi "ditunda tanpa sidang
 *      berikutnya";
 *   4. antrian SIPP ditandai selesai hanya bila tulisannya utuh;
 *   5. jejak JUJUR di aleta_bot_jejak_penetapan: siapa yang MENEKAN (akun
 *      ALETA + akun SIPP miliknya), atas nama siapa ditulis ke SIPP (PP),
 *      berhasil/gagal, dan sebab teknisnya - termasuk yang ditolak.
 *
 * Penginput di SIPP = panitera sidang (PP) perkara itu - keputusan pengguna
 * 7 Okt 2026, lihat sidangHasilService.pilihPaniteraSidang.
 */

const { pesanHasilSidang } = require("./pesanHasilSidang");

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).trim();
}

function layananBawaan() {
  return {
    layanan: require("./sidangHasilService"),
    jejak: require("./jejakAletaService"),
    jeda: require("./jedaManusiaService"),
    penetapan: require("./penetapanTulisService"),
  };
}

/**
 * Penekan tombol untuk jejak ALETA (kolom operator, 120 huruf): nama + id
 * akun ALETA + akun SIPP miliknya. Bukan yang tercatat di SIPP.
 */
function operatorJejak(badan = {}) {
  const id = bersih(badan.operator);
  const nama = bersih(badan.operatorNama);
  const sipp = bersih(badan.operatorAkunSipp);
  const siapa = nama && nama !== id ? `${nama} [${id}]` : id;
  return `${siapa} · SIPP: ${sipp || "belum tertaut"}`.slice(0, 120);
}

/** Alasan jejak: kode + nasib langkah yang sudah tertulis + sebab teknis. */
function alasanJejak(hasil) {
  const h = hasil || {};
  if (h.ok === true) return "";
  const kode = bersih(h.alasan) || "gagal";
  const nasib = h.dipulihkan === false ? " (TIDAK dipulihkan)" : h.dipulihkan === true ? " (dibatalkan utuh)" : "";
  const pada = h.pada && typeof h.pada === "object" ? ` ${bersih(h.pada.tabel)} ${bersih(h.pada.aksi)}` : "";
  const teknis = bersih(h.pesan);
  return `${kode}${nasib}${pada}${teknis ? `: ${teknis}` : ""}`.slice(0, 160);
}

function rencanaTerbaca(rencana, kering) {
  if (!kering) return undefined;
  return rencana.langkah.map((x) => ({
    tabel: x.tabel,
    aksi: x.aksi,
    keterangan: x.keterangan,
    sql: String(x.sql).replace(/\s+/g, " ").trim(),
    nilai: x.params,
  }));
}

/**
 * @param {"tunda"|"putus"} jalan
 * @param {object} badan  badan permintaan dari portal
 * @param {{ip?: string}} konteks
 * @returns {Promise<{status: number, body: object}>}
 */
async function jalankanHasilSidang(jalan, badan = {}, konteks = {}, deps = layananBawaan()) {
  const { layanan, jejak, jeda } = deps;
  const ip = bersih(konteks.ip);
  const operatorId = bersih(badan.operator);
  const kering = badan.kering !== false;
  const jenis = jalan === "tunda" ? "penundaan" : "putus-sidang";
  const aksi = jalan === "tunda" ? "tunda" : "putus";

  if (!operatorId) {
    const tolak = { ok: false, alasan: "operator_tidak_disebut" };
    return { status: 400, body: { ...tolak, kode: tolak.alasan, error: pesanHasilSidang(tolak, jalan) } };
  }
  const operator = operatorJejak(badan);

  // Jeda seperti manusia SEBELUM rencana disusun: jam audit (waktuBasisData di
  // dalam penyusun) dengan begitu diambil sesudah jeda, bukan sebelumnya.
  if (!kering && jeda && typeof jeda.jeda === "function") await jeda.jeda("simpan", { kering });

  const rencana =
    jalan === "tunda"
      ? await layanan.susunRencanaTunda({
          jadwalId: badan.jadwalId,
          alasanTunda: String(badan.alasanTunda || ""),
          tanggalBerikut: String(badan.tanggalBerikut || ""),
          jamBerikut: String(badan.jamBerikut || ""),
          jamSekarang: String(badan.jamSekarang || ""),
          agendaBerikut: String(badan.agendaBerikut || ""),
          jenisPengadilan: badan.jenisPengadilan,
          dihadiriOleh: badan.dihadiriOleh,
          ruanganIdBerikut: badan.ruanganIdBerikut,
          sidangKelilingBerikut:
            typeof badan.sidangKelilingBerikut === "boolean" ? badan.sidangKelilingBerikut : undefined,
          operator,
          ip,
        })
      : await layanan.susunRencanaPutus({
          jadwalId: badan.jadwalId,
          statusPutusanId: badan.statusPutusanId,
          tanggalPutus: String(badan.tanggalPutus || ""),
          verstek: String(badan.verstek || ""),
          jamSekarang: String(badan.jamSekarang || ""),
          dihadiriOleh: badan.dihadiriOleh,
          tulisPutusan: badan.tulisPutusan === true,
          ruanganIdSidang: badan.ruanganIdSidang,
          sidangKelilingSidang:
            typeof badan.sidangKelilingSidang === "boolean" ? badan.sidangKelilingSidang : undefined,
          operator,
          ip,
        });

  if (!rencana || !rencana.ok) {
    const tolak = rencana || { ok: false, alasan: "ditolak" };
    // Yang DITOLAK ikut tercatat - di sys_audittrail percobaan yang gagal tidak
    // meninggalkan jejak, dan justru itu yang dicari ketika petugas bertanya
    // kenapa tombolnya tidak jadi.
    void jejak.catat({
      aksi,
      jenis,
      perkaraId: badan.perkaraId,
      akunSipp: "",
      operator,
      ip,
      berhasil: false,
      kering,
      alasan: alasanJejak(tolak),
      langkah: [],
    });
    return { status: 400, body: { ...tolak, kode: tolak.alasan, error: pesanHasilSidang(tolak, jalan) } };
  }

  const hasil = await layanan.jalankanRencanaUtuh(rencana, { kering });

  // Antrian SIPP digerakkan HANYA bila tulisannya utuh; gagalnya tidak
  // membatalkan hasil sidang yang sudah benar.
  let antrian = null;
  if (hasil.ok) {
    antrian = await layanan.setelAntrian({
      perkaraId: rencana.perkara && rencana.perkara.perkaraId,
      // Antrian sidang dikunci pada tanggal SIDANG - juga untuk putus: tanggal
      // putusan yang diketik di blangko boleh berbeda (uji rilis 9 Okt 2026).
      tanggalSidang:
        (rencana.sidangSekarang && rencana.sidangSekarang.tanggal) ||
        (jalan === "putus" && rencana.putusan ? rencana.putusan.tanggalPutus : ""),
      ruangId: badan.ruangId,
      keadaan: layanan.ANTRIAN_SELESAI,
      kering,
    });
  }

  void jejak.catat({
    aksi,
    jenis,
    perkaraId: rencana.perkara && rencana.perkara.perkaraId,
    nomorPerkara: (rencana.perkara && rencana.perkara.nomorPerkara) || "",
    tanggalPenetapan: jalan === "putus" ? rencana.putusan && rencana.putusan.tanggalPutus : undefined,
    // Atas nama siapa ditulis ke SIPP (PP) - terpisah dari penekannya (operator).
    akunSipp: (rencana.atasNama && rencana.atasNama.username) || "",
    namaPejabat: (rencana.atasNama && rencana.atasNama.namaLengkap) || "",
    operator,
    ip,
    berhasil: hasil.ok === true,
    kering,
    alasan: alasanJejak(hasil),
    langkah: rencana.langkah,
  });

  const body = {
    ...hasil,
    jenis: rencana.jenis,
    hanyaJadwal: jalan === "putus" ? rencana.hanyaJadwal === true : undefined,
    perkara: rencana.perkara,
    atasNama: rencana.atasNama,
    operator,
    sidangSekarang: rencana.sidangSekarang,
    sidangBerikutnya: rencana.sidangBerikutnya,
    putusan: rencana.putusan,
    antrianSidang: rencana.antrian || null,
    andaian: rencana.andaian || [],
    antrian,
    rencana: rencanaTerbaca(rencana, kering),
  };
  if (!hasil.ok) {
    body.kode = hasil.alasan;
    body.error = pesanHasilSidang(hasil, jalan);
  }
  return { status: hasil.ok ? 200 : 409, body };
}

/**
 * Keadaan satu jadwal untuk blangko: baris SIPP + riwayat + ruangan + antrian
 * sidang + ATAS NAMA SIAPA tombolnya akan menulis (PP), supaya blangko dapat
 * berkata "Akan tercatat di SIPP atas nama ..." SEBELUM apa pun ditulis.
 */
async function keadaanHasilSidang(jadwalId, deps = layananBawaan()) {
  const { layanan, penetapan } = deps;
  const keadaan = await layanan.keadaanJadwal(jadwalId);
  if (!keadaan) return { status: 404, body: { ok: false, alasan: "jadwal_tidak_ketemu" } };
  const [riwayat, ruangan, antrian, pp] = await Promise.all([
    layanan.riwayatSidangPerkara(keadaan.perkaraId, keadaan.tanggalSidang).catch(() => null),
    penetapan.daftarRuangan().catch(() => []),
    layanan.antrianSidangUntuk(keadaan).catch(() => null),
    layanan.paniteraSidang(keadaan.perkaraId, keadaan.tanggalSidang).catch(() => ({
      ok: false,
      alasan: "panitera_sidang_tidak_terbaca",
    })),
  ]);
  const atasNama = pp.ok
    ? { ok: true, username: pp.akun.username, namaLengkap: pp.akun.fullname, peran: "panitera sidang" }
    : { ok: false, kode: pp.alasan, pesan: pesanHasilSidang(pp, "tunda"), nama: pp.nama || [] };
  return { status: 200, body: { ok: true, keadaan, riwayat, ruangan, antrian, atasNama } };
}

module.exports = { jalankanHasilSidang, keadaanHasilSidang, operatorJejak, alasanJejak };
