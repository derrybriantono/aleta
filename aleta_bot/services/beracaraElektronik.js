"use strict";

/**
 * ============================================================================
 * BERACARA ELEKTRONIK PER PERKARA - PADANAN BOT (keputusan 144, 3 Nov 2026)
 * ============================================================================
 *
 * PADANAN tentukanBeracaraElektronik di portal (manajemen_surat/src/lib/
 * beracara-elektronik.ts) dan tentukanBeracara di ekstensi (isi-sipp-bersama.js).
 * Kasus ujinya SAMA: manajemen_surat/src/test/fixtures/beracara-elektronik-kasus.json.
 *
 *   bukan perkara e-Court                                -> null
 *   Tergugat TIDAK PERNAH hadir (termasuk verstek)        -> "tergugat-tidak-hadir"
 *   SEMUA Tergugat punya WhatsApp DAN email DAN setuju    -> "e-litigasi"
 *   selain itu                                            -> "hybrid"
 *   daftar Tergugat kosong (kontak belum terbaca)         -> null
 *
 * Dipakai Kasir (kasirJurnalService.susunUsulan, juga lewat Kasir otomatis):
 * panggilan ulang Tergugat e-litigasi lewat e-Court tanpa biaya panggilan.
 */

/** Sandi dihadiri_oleh SIPP yang menyertakan Tergugat/Termohon (sama dengan portal & kontakEcourtService). */
const SANDI_TERGUGAT_HADIR = Object.freeze([1, 3, 8, 9, 11, 15]);

const LABEL = Object.freeze({
  "e-litigasi": "E-Litigasi",
  hybrid: "Hybrid",
  "tergugat-tidak-hadir": "Tergugat tidak pernah hadir",
});

function teks(nilai) {
  return nilai === null || nilai === undefined ? "" : String(nilai);
}

/**
 * @param {{ eCourt: boolean, tergugat: Array<{nama?, email?, wa?, setujuElektronik?: boolean|null}>, tergugatPernahHadir: boolean|null }} masukan
 * @returns {{ jenis: string, label: string, alasan: string } | null}
 */
function tentukanBeracara(masukan) {
  const m = masukan || {};
  if (m.eCourt !== true) return null;
  if (m.tergugatPernahHadir === false) {
    return {
      jenis: "tergugat-tidak-hadir",
      label: LABEL["tergugat-tidak-hadir"],
      alasan: "Tergugat tidak pernah hadir di persidangan (termasuk verstek) - tidak dinilai sebagai e-litigasi maupun hybrid.",
    };
  }
  const daftar = Array.isArray(m.tergugat) ? m.tergugat : [];
  if (!daftar.length) return null;
  const per = daftar.map((t, i) => {
    const x = t || {};
    const adaEmail = Boolean(teks(x.email).trim());
    const adaWa = Boolean(teks(x.wa).trim());
    const setuju = x.setujuElektronik === true;
    const bagian = [
      adaEmail ? "email ada" : "email belum ada",
      adaWa ? "WA ada" : "WA belum ada",
      setuju ? "setuju" : x.setujuElektronik === false ? "tidak setuju" : "belum menyetujui",
    ];
    return { nama: teks(x.nama).trim() || `Tergugat ${i + 1}`, memenuhi: adaEmail && adaWa && setuju, alasan: bagian.join(", ") };
  });
  const semua = per.every((p) => p.memenuhi);
  const jenis = semua ? "e-litigasi" : "hybrid";
  const alasan = per.length > 1 ? per.map((p) => `${p.nama}: ${p.alasan}`).join("; ") : per[0].alasan.replace(/^./, (c) => c.toUpperCase());
  return { jenis, label: LABEL[jenis], alasan };
}

/**
 * Masukan dari jawaban kontakEcourtService.kontakParaPihak (Tergugat = pihak kedua,
 * jenis "pihak"; WA hanya nomor HP). TANPA nilai kontak: email/WA menjadi "ada"
 * atau null - keadaan Kasir dikirim ke portal, alamat pihak tidak ikut.
 * Jawaban yang tidak dikenali -> null (tidak terbaca; jangan ditebak).
 */
function masukanDariKontakPara(data) {
  if (!data || data.ok === false || data.ada === false || !Array.isArray(data.orang)) return null;
  const tergugat = data.orang
    .filter((x) => x && x.jenis === "pihak" && Number(x.pihakKe) === 2)
    .map((x) => {
      const st = x.elitigasi && x.elitigasi.status;
      return {
        nama: teks(x.nama),
        email: teks(x.email && x.email.nilai).trim() ? "ada" : null,
        wa: x.hp && x.hp.bisaWhatsApp && teks(x.hp.nilai).trim() ? "ada" : null,
        setujuElektronik: st === "ya" ? true : st === "tidak" ? false : null,
      };
    });
  return { eCourt: data.lewatEcourt === true, ecourtTerbaca: data.ecourtTerbaca !== false, tergugat };
}

module.exports = { SANDI_TERGUGAT_HADIR, LABEL, tentukanBeracara, masukanDariKontakPara };
