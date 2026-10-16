"use strict";

/**
 * ============================================================================
 * KEADAAN PERKARA UNTUK CHECKLIST KONSEPTOR (F1.6, keputusan 17 Okt 2026
 * butir 35, 36, 38) - SELECT SAJA
 * ============================================================================
 *
 * Untuk banyak perkara sekaligus (satu daftar Jadwal Sidang), tanpa membaca
 * rincian per perkara:
 *
 *   eksepsi     penanda jawaban/duplik Tergugat di arsip e-Court ("ada") -
 *               SUMBER YANG SAMA dengan penanda kolom Agenda
 *               (penandaJawabanService.petaBanyakPerkara). SIPP tidak punya
 *               tabel eksepsi.
 *   rekonvensi  tabel perkara_rekonvensi ATAU penanda jawaban "ada".
 *   sela        tabel perkara_putusan_sela ATAU sidang beragenda "putusan
 *               sela" di perkara_jadwal_sidang.
 *   majelis     nama hakim AKTIF di perkara_hakim_pn - penjaga langkah
 *               "Dikoreksi majelis" (hanya ketua/anggota majelis).
 *   konseptor   pengguna tahapan putusan (perkara_proses tahapan 210) beserta
 *               namanya di sys_users - konseptor yang SUDAH tercatat di SIPP,
 *               supaya checklist tampil walau tanpa tunjukan sementara.
 *
 * Tiap bagian dibungkus sendiri: yang gagal dibaca disebut di `gagal`, bagian
 * lain tetap terkirim. Tidak terbaca BUKAN "tidak ada" - portal tidak
 * menyembunyikan langkah yang sudah pernah dicentang.
 */

const BATAS = 500;

const teks = (x) => String(x == null ? "" : x).trim();

function depsBawaan() {
  const sippDb = require("../db_config");
  const skema = require("./sippSkemaService");
  const tahapan = require("./sippTahapanService");
  return {
    kueri: (sql, params = []) => new Promise((ok, gagal) => sippDb.query(sql, params, (g, h) => (g ? gagal(g) : ok(h)))),
    tabelAda: (t) => skema.tabelAda(t),
    kolomTerpilih: () => skema.kolomTerpilih(),
    namaPengguna: (daftar) => tahapan.namaPengguna(daftar),
    tahapanPutusan: tahapan.TAHAPAN_PUTUSAN,
    penandaJawaban: (nomor) => require("./penandaJawabanService").petaBanyakPerkara(nomor),
  };
}

function buatLayanan(depsMasuk) {
  let cache = null;
  const deps = () => {
    if (!cache) cache = depsMasuk || depsBawaan();
    return cache;
  };

  /**
   * { ok:true, perkara: { <id>: { nomorPerkara, eksepsi, rekonvensi, sela, majelis[], konseptor[] } }, gagal[] }
   */
  async function keadaanBanyak(daftarId) {
    const d = deps();
    const id = [...new Set((Array.isArray(daftarId) ? daftarId : []).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, BATAS);
    if (id.length === 0) return { ok: true, perkara: {}, gagal: [] };
    const tanya = id.map(() => "?").join(",");
    const gagal = [];
    const coba = async (bagian, kerja, cadangan) => {
      try {
        return await kerja();
      } catch (e) {
        gagal.push({ bagian, sebab: String((e && (e.code || e.message)) || e).slice(0, 120) });
        return cadangan;
      }
    };

    const perkara = {};
    const baris = await d.kueri(`SELECT perkara_id, nomor_perkara FROM perkara WHERE perkara_id IN (${tanya})`, id);
    for (const r of baris || []) {
      perkara[String(r.perkara_id)] = { nomorPerkara: teks(r.nomor_perkara), eksepsi: false, rekonvensi: false, sela: false, majelis: [], konseptor: [] };
    }
    const ada = (pid) => perkara[String(pid)];

    await coba("rekonvensi", async () => {
      if (!(await d.tabelAda("perkara_rekonvensi"))) return;
      for (const r of await d.kueri(`SELECT DISTINCT perkara_id FROM perkara_rekonvensi WHERE perkara_id IN (${tanya})`, id)) {
        if (ada(r.perkara_id)) ada(r.perkara_id).rekonvensi = true;
      }
    });
    await coba("putusan sela", async () => {
      if (await d.tabelAda("perkara_putusan_sela")) {
        for (const r of await d.kueri(`SELECT DISTINCT perkara_id FROM perkara_putusan_sela WHERE perkara_id IN (${tanya})`, id)) {
          if (ada(r.perkara_id)) ada(r.perkara_id).sela = true;
        }
      }
      for (const r of await d.kueri(
        `SELECT DISTINCT perkara_id FROM perkara_jadwal_sidang WHERE perkara_id IN (${tanya}) AND LOWER(agenda) LIKE '%putusan sela%'`,
        id
      )) {
        if (ada(r.perkara_id)) ada(r.perkara_id).sela = true;
      }
    });
    await coba("majelis", async () => {
      for (const r of await d.kueri(
        `SELECT perkara_id, hakim_nama, jabatan_hakim_nama FROM perkara_hakim_pn WHERE perkara_id IN (${tanya}) AND aktif = 'Y' ORDER BY urutan`,
        id
      )) {
        const p = ada(r.perkara_id);
        if (p && teks(r.hakim_nama)) p.majelis.push({ nama: teks(r.hakim_nama), jabatan: teks(r.jabatan_hakim_nama) });
      }
    });
    await coba("konseptor SIPP", async () => {
      if (!(await d.tabelAda("perkara_proses"))) return;
      const k = await d.kolomTerpilih();
      if (!k || !k.prosesTahapanId || !k.prosesDiinputOleh) return;
      const rows = await d.kueri(
        `SELECT perkara_id, ${k.prosesDiinputOleh} AS pengguna FROM perkara_proses
          WHERE perkara_id IN (${tanya}) AND ${k.prosesTahapanId} = ?`,
        [...id, d.tahapanPutusan]
      );
      const nama = await d.namaPengguna((rows || []).map((r) => r.pengguna)).catch(() => ({}));
      for (const r of rows || []) {
        const p = ada(r.perkara_id);
        const pengguna = teks(r.pengguna);
        if (!p || !pengguna || p.konseptor.some((x) => x.pengguna === pengguna)) continue;
        p.konseptor.push({ pengguna, nama: (nama && nama[pengguna]) || pengguna });
      }
    });
    await coba("jawaban e-Court", async () => {
      const nomor = Object.values(perkara).map((p) => p.nomorPerkara).filter(Boolean);
      if (!nomor.length) return;
      const peta = (await d.penandaJawaban(nomor)) || {};
      for (const p of Object.values(perkara)) {
        const j = peta[p.nomorPerkara];
        if (!j) continue;
        if (j.eksepsi && j.eksepsi.keadaan === "ada") p.eksepsi = true;
        if (j.rekonvensi && j.rekonvensi.keadaan === "ada") p.rekonvensi = true;
      }
    });

    return { ok: true, perkara, gagal };
  }

  return { keadaanBanyak };
}

const bawaan = buatLayanan();

module.exports = {
  buatLayanan,
  keadaanBanyak: (...a) => bawaan.keadaanBanyak(...a),
};
