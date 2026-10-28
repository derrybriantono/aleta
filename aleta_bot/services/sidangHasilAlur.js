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

/**
 * e-Doc penetapan ikrar (ikrarEdocService) SESUDAH form ikrar terisi. Terpisah dari
 * transaksi form (berkas tidak ikut transaksi basis data) dan tidak pernah membatalkan
 * form yang sudah benar: gagalnya dilaporkan di `edocIkrar`, bukan sebagai galat alur.
 */
async function unggahEdocIkrar(deps, p) {
  try {
    const edoc = (deps && deps.edocIkrar) || require("./ikrarEdocService");
    return await edoc.unggahPenetapanIkrar(p);
  } catch (galat) {
    return { ok: false, alasan: "galat_edoc_ikrar", pesan: bersih(galat && galat.message).slice(0, 160) };
  }
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
  // Putus sidang ikrar (18 Okt; tiga status 28 Okt 2026): konfirmasi "ikrar dilaksanakan" (status 1)
  // ATAU pilihan status 2/3 - jenis jejak "putus-ikrar" (status 1, nama lama) / "putus-ikrar-2|3".
  const statusIkrar = Number(badan.statusIkrar) || 0;
  const putusIkrar = jalan === "putus" && (badan.ikrarDilaksanakan === true || badan.putusIkrar === true || statusIkrar > 0);
  const jenis =
    jalan === "tunda"
      ? "penundaan"
      : putusIkrar
        ? statusIkrar === 2 || statusIkrar === 3
          ? `putus-ikrar-${statusIkrar}`
          : "putus-ikrar"
        : "putus-sidang";
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
          // Tunda otomatis 16.30: penjaga keadaan dibaca ulang saat menulis (penjagaTundaOtomatis).
          otomatis: badan.otomatis === true,
          tanggalSidangHarap: String(badan.tanggalSidangHarap || ""),
          operator,
          ip,
        })
      : putusIkrar
        ? await layanan.susunRencanaPutusIkrar({
            jadwalId: badan.jadwalId,
            ikrarDilaksanakan: badan.ikrarDilaksanakan === true,
            statusIkrar: statusIkrar || undefined,
            konfirmasiStatus: badan.konfirmasiStatus === true,
            jamSekarang: String(badan.jamSekarang || ""),
            dihadiriOleh: badan.dihadiriOleh,
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
          // Putus otomatis gugur/NO (22 Okt): penjaga baca-ulang sebelum menulis.
          otomatis: badan.otomatis === true,
          tanggalSidangHarap: String(badan.tanggalSidangHarap || ""),
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

  // Putus ikrar: form ikrar sudah tertulis (satu transaksi) -> penetapan ikrar diunggah sebagai e-Doc.
  let edocIkrar;
  if (rencana.jenis === "putus-ikrar" && rencana.formIkrar && rencana.formIkrar.ok === true) {
    edocIkrar = kering
      ? { ok: true, kering: true, catatan: "Penetapan ikrar diunggah sebagai e-Doc sesudah form ikrar terisi." }
      : hasil.ok
        ? await unggahEdocIkrar(deps, {
            jadwalId: badan.jadwalId,
            perkaraId: rencana.perkara && rencana.perkara.perkaraId,
            statusIkrar: rencana.statusIkrar,
            // P5b: cap kantor + ukuran dari portal; tanda tangan sah dibaca bot sendiri.
            cap: badan.capIkrar,
            atur: badan.aturTtdIkrar,
            operator,
            ip,
            kering: false,
          })
        : undefined;
  }

  const body = {
    ...hasil,
    jenis: rencana.jenis,
    hanyaJadwal: jalan === "putus" ? rencana.hanyaJadwal === true : undefined,
    formIkrar: rencana.formIkrar,
    edocIkrar,
    statusIkrar: rencana.statusIkrar,
    namaStatus: rencana.namaStatus,
    jadwalSudahTercatat: rencana.jadwalSudahTercatat,
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
 * Mengisi form ikrar talak SIPP untuk sidang ikrar yang keterangannya sudah
 * menyatakan ikrar terlaksana (diisi lewat SIPP atau tombol sebelumnya). Alur
 * yang sama: rencana -> jeda -> SATU transaksi -> jejak jujur. Atas nama
 * ketua majelis ikrar; penekan sebenarnya hanya di jejak.
 */
async function jalankanIsiIkrar(badan = {}, konteks = {}, deps = layananBawaan()) {
  const { layanan, jejak, jeda } = deps;
  const ikrarLayanan = deps.ikrar || require("./ikrarTalakService");
  const ip = bersih(konteks.ip);
  const kering = badan.kering !== false;
  if (!bersih(badan.operator)) {
    const tolak = { ok: false, alasan: "operator_tidak_disebut" };
    return { status: 400, body: { ...tolak, kode: tolak.alasan, error: pesanHasilSidang(tolak, "putus") } };
  }
  const operator = operatorJejak(badan);
  if (!kering && jeda && typeof jeda.jeda === "function") await jeda.jeda("simpan", { kering });

  const rencana = await ikrarLayanan.susunRencanaIsiIkrar({ jadwalId: badan.jadwalId, ip });
  if (rencana && rencana.ok === false && rencana.alasan === "form_ikrar_sudah_terisi") {
    // Form sudah terisi (mis. oleh petugas di SIPP): yang tersisa hanya e-Doc penetapan ikrar.
    const edocIkrar = await unggahEdocIkrar(deps, {
      jadwalId: badan.jadwalId,
      perkaraId: badan.perkaraId,
      cap: badan.capIkrar,
      atur: badan.aturTtdIkrar,
      operator,
      ip,
      kering,
    });
    const body = {
      ok: edocIkrar.ok === true,
      jenis: "edoc-ikrar",
      formSudahTerisi: true,
      edocIkrar,
      andaian: [],
    };
    if (!body.ok) {
      body.kode = edocIkrar.alasan;
      body.error = edocIkrar.pesan || "e-Doc penetapan ikrar tidak dapat diunggah.";
    }
    return { status: body.ok ? 200 : 409, body };
  }
  if (!rencana || !rencana.ok) {
    const tolak = rencana || { ok: false, alasan: "ditolak" };
    void jejak.catat({
      aksi: "isi",
      jenis: "isi-ikrar",
      perkaraId: badan.perkaraId,
      akunSipp: "",
      operator,
      ip,
      berhasil: false,
      kering,
      alasan: alasanJejak(tolak),
      langkah: [],
    });
    return { status: 400, body: { ...tolak, kode: tolak.alasan, error: pesanHasilSidang(tolak, "putus") } };
  }

  const hasil = await layanan.jalankanRencanaUtuh(rencana, { kering });
  void jejak.catat({
    aksi: "isi",
    jenis: "isi-ikrar",
    perkaraId: rencana.perkara && rencana.perkara.perkaraId,
    nomorPerkara: (rencana.perkara && rencana.perkara.nomorPerkara) || "",
    tanggalPenetapan: rencana.tanggalIkrar,
    akunSipp: (rencana.atasNama && rencana.atasNama.username) || "",
    namaPejabat: (rencana.atasNama && rencana.atasNama.namaLengkap) || "",
    operator,
    ip,
    berhasil: hasil.ok === true,
    kering,
    alasan: alasanJejak(hasil),
    langkah: rencana.langkah,
  });
  const edocIkrar = hasil.ok
    ? kering
      ? { ok: true, kering: true, catatan: "Penetapan ikrar diunggah sebagai e-Doc sesudah form ikrar terisi." }
      : await unggahEdocIkrar(deps, {
          jadwalId: badan.jadwalId,
          perkaraId: rencana.perkara && rencana.perkara.perkaraId,
          cap: badan.capIkrar,
          atur: badan.aturTtdIkrar,
          operator,
          ip,
          kering: false,
        })
    : undefined;
  const body = {
    ...hasil,
    jenis: rencana.jenis,
    perkara: rencana.perkara,
    atasNama: rencana.atasNama,
    edocIkrar,
    tanggalIkrar: rencana.tanggalIkrar,
    batasEnamBulan: rencana.batasEnamBulan,
    andaian: rencana.andaian || [],
    rencana: rencanaTerbaca(rencana, kering),
  };
  if (!hasil.ok) {
    body.kode = hasil.alasan;
    body.error = pesanHasilSidang(hasil, "putus");
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
    // Sidang ikrar talak: PP IKRAR (28 Okt 2026) - sama dengan yang dipakai tombolnya.
    (typeof layanan.paniteraUntukJadwal === "function"
      ? layanan.paniteraUntukJadwal(keadaan)
      : layanan.paniteraSidang(keadaan.perkaraId, keadaan.tanggalSidang)
    ).catch(() => ({
      ok: false,
      alasan: "panitera_sidang_tidak_terbaca",
    })),
  ]);
  const atasNama = pp.ok
    ? { ok: true, username: pp.akun.username, namaLengkap: pp.akun.fullname, peran: "panitera sidang" }
    : { ok: false, kode: pp.alasan, pesan: pesanHasilSidang(pp, "tunda"), nama: pp.nama || [] };
  // Sidang ikrar talak (28 Okt 2026): penetapan ikrar tercatat atas nama ketua majelis ikrar -
  // pratinjau "atas nama" kedua di blangko Putus.
  let atasNamaPenetapan;
  if (String(keadaan.ikrarTalak || "").toUpperCase() === "Y") {
    const ikrarLayanan = deps.ikrar || require("./ikrarTalakService");
    const ketua = await Promise.resolve(ikrarLayanan.ketuaMajelisIkrar(keadaan.perkaraId)).catch(() => ({
      ok: false,
      alasan: "ketua_majelis_ikrar_tidak_ada",
    }));
    atasNamaPenetapan = ketua && ketua.ok
      ? { ok: true, username: ketua.username, namaLengkap: ketua.fullname, peran: "ketua majelis ikrar talak" }
      : { ok: false, kode: ketua && ketua.alasan, pesan: pesanHasilSidang(ketua || {}, "putus"), nama: (ketua && ketua.calon) || [] };
  }
  return { status: 200, body: { ok: true, keadaan, riwayat, ruangan, antrian, atasNama, atasNamaPenetapan } };
}

module.exports = { jalankanHasilSidang, jalankanIsiIkrar, keadaanHasilSidang, operatorJejak, alasanJejak };
