"use strict";

/**
 * Jawaban penadah SIPP untuk kueri butir 17 (13 Okt 2026) - dipakai bukti
 * luring verify-penetapan-*.js dan verify-bongkar-rantai.js.
 *
 * Sejak butir 17 penetapan dicatat atas akun SIPP PEJABAT, yang dipastikan
 * lewat user_hakim/user_panitera, majelis perkara (perkara_hakim_pn), akun
 * tercatat pada Riwayat Perkara, dan jam SIPP (UTC_TIMESTAMP). Penadah lama
 * menjawab kosong untuk kueri itu, sehingga setiap akun terbaca "bukan
 * pejabat". Fungsi ini menjawabnya; selain itu memulangkan undefined.
 *
 * @param {string} teks kueri
 * @param {{ username: string, punyaMajelis?: () => boolean, utc?: string }} o
 */
function jawabPejabat(teks, o) {
  const username = String(o.username);
  if (/FROM user_hakim WHERE userid/.test(teks)) return [{ jabatan: "hakim", id: 11 }];
  if (/FROM user_hakim uh JOIN sys_users/.test(teks)) {
    return [{ userid: 1, username, fullname: username, block: 0, kedaluwarsa: null }];
  }
  if (/FROM perkara_hakim_pn\s+WHERE/.test(teks) && /^\s*SELECT/i.test(teks)) {
    const ada = typeof o.punyaMajelis === "function" ? o.punyaMajelis() : true;
    return ada ? [{ hakimId: 11, jabatanId: 1 }, { hakimId: 12, jabatanId: 2 }, { hakimId: 13, jabatanId: 2 }] : [];
  }
  if (/SELECT diinput_oleh AS oleh FROM perkara_proses/.test(teks)) return [{ oleh: username }];
  if (/UTC_TIMESTAMP/.test(teks)) return [{ utc: o.utc || "2026-09-15 03:00:00" }];
  return undefined;
}

module.exports = { jawabPejabat };
