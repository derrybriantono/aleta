"use strict";

/**
 * ============================================================================
 * BIAYA & PRODEO UNTUK USULAN AMAR PUTUSAN (G2B 2.5 lanjutan, 30 Okt 2026)
 * ============================================================================
 * Usulan amar Putusan Akhir SIPP (portal lib/amar-dari-petitum.ts) memerlukan tiga hal yang SAMA dengan blangko putusan Derry:
 *   - prodeo   perkara.prodeo = 1 - penanda yang SAMA dengan amar/duduk perkara/pertimbangan ABT (#8505#, #8507#, #8527#, paket
 *              prodeo-panggilan-29okt); persetujuan prodeo e-Court sengaja tidak dipakai agar amar SIPP = amar blangko.
 *   - tahun    YEAR(perkara.tanggal_pendaftaran) (= #0191#) - "DIPA Pengadilan Agama <satker> Tahun <tahun daftar>".
 *   - satker   sys_config NamaPN (= #8008#), lewat ikrarTalakService.namaPengadilanSatker (satu sumber dengan amar ikrar).
 *   - biaya    variabel ABT #0143# (Total Biaya Perkara = jumlah rincian biaya putusan: pendaftaran, proses, panggilan, PNBP, sumpah,
 *              redaksi, meterai, sita, pemeriksaan setempat) dan #0155# (terbilang), dihitung MESIN VARIABEL ABT lewat jembatan baca-saja
 *              abt.nilaiPenanda. #8504# (= FORMAT(#0143#)) hanya cadangan: tanpa paket prodeo-panggilan ia memotong "170.000" menjadi
 *              "170" (terukur 30 Okt pada 150 putusan sipp_2810: 8504 salah pada perkara Pdt.P, 0143 utuh). Tidak terbaca / bukan
 *              angka = null (amar bertitik-titik, tidak dikarang).
 * Hanya membaca.
 */
const db = require("../db_config");
const ikrar = require("./ikrarTalakService");

function kueri(sql, params = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, params, (galat, hasil) => (galat ? gagal(galat) : selesai(hasil)));
  });
}
const bersih = (x) => String(x === null || x === undefined ? "" : x).replace(/\s+/g, " ").trim();

/**
 * Keluaran abt.nilaiPenanda ({noVar: {status, teks}}) -> { angka: "199.000", jumlah: 199000, terbilang: "seratus ..." } | null. Murni.
 * Jumlah 0 dipulangkan (pemanggil: tanpa "sejumlah"); terbilang yang memuat selain huruf dibuang (bukan dikarang).
 */
function bacaBiayaPutusan(nilai) {
  const sah = (v) => Boolean(v && v.status === "terisi" && /^\d{1,3}(\.\d{3})*$/.test(bersih(v.teks)));
  const a = nilai && (sah(nilai["0143"]) ? nilai["0143"] : sah(nilai["8504"]) ? nilai["8504"] : null);
  if (!a) return null;
  const angka = bersih(a.teks);
  const jumlah = Number(angka.replace(/\./g, ""));
  if (!Number.isFinite(jumlah)) return null;
  if (jumlah === 0) return { angka: "0", jumlah: 0, terbilang: "" };
  const t = nilai["0155"];
  const terbilang = t && t.status === "terisi" ? bersih(t.teks).toLowerCase() : "";
  return { angka, jumlah, terbilang: /^[a-z ]+$/.test(terbilang) ? terbilang : "" };
}

/** { perkaraId, prodeo, tahunDaftar, namaPengadilan, biaya } untuk satu perkara; galat baca = ruasnya kosong/null. */
async function biayaAmarPutusan(perkaraId, deps = {}) {
  const id = Number(perkaraId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, alasan: "perkaraId tidak sah" };
  const q = deps.kueri || kueri;
  const baris = await q("SELECT p.prodeo AS prodeo, YEAR(p.tanggal_pendaftaran) AS tahunDaftar FROM perkara p WHERE p.perkara_id = ? LIMIT 1", [id]).catch(() => []);
  const b = Array.isArray(baris) && baris[0] ? baris[0] : null;
  if (!b) return { ok: false, alasan: "perkara tidak ditemukan" };
  const prodeo = Number(b.prodeo) === 1;
  const namaPengadilan = await (deps.namaPengadilan || ikrar.namaPengadilanSatker)().catch(() => "");
  let biaya = null;
  if (!prodeo) {
    try {
      const nilai = deps.nilaiPenanda
        ? await deps.nilaiPenanda(id)
        : (await require("./sippReadOnlyBridgeService").handleBridgeOperation("abt.nilaiPenanda", { perkaraId: id, sidangKe: 0, penanda: ["0143", "8504", "0155"] })).nilai;
      biaya = bacaBiayaPutusan(nilai);
    } catch {
      biaya = null;
    }
  }
  return { ok: true, perkaraId: id, prodeo, tahunDaftar: Number(b.tahunDaftar) || null, namaPengadilan: bersih(namaPengadilan), biaya };
}

module.exports = { bacaBiayaPutusan, biayaAmarPutusan };
