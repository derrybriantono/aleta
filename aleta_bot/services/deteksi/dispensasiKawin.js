"use strict";

/**
 * Modul kerangka deteksi (deteksi/index.js) untuk DISPENSASI KAWIN. Aturannya
 * tinggal di services/deteksiDispensasiKawinService.js (dipakai rute
 * /abt/usulan sumber 'posita-lain'); berkas ini hanya menyajikannya dalam
 * bentuk kerangka: kunci, jenisPerkaraId, peta variabel -> sumber, deteksi().
 */

const dk = require("../deteksiDispensasiKawinService");

module.exports = {
  kunci: "dispensasi-kawin",
  jenisPerkaraId: [362],
  variabel: dk.PETA_SUMBER,
  deteksi(posita) {
    const { nilai } = dk.deteksiDk(posita);
    const hasil = {};
    for (const [kode, n] of Object.entries(nilai)) {
      hasil[kode] = { nilai: n.nilai, kalimat: n.kalimat, yakin: n.keyakinan === "cukup" ? "cukup" : "ragu", ...(n.catatan ? { catatan: n.catatan } : {}), kodePola: `dk-${kode}` };
    }
    return hasil;
  },
};
