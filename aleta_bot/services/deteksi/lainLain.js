"use strict";

/**
 * ============================================================================
 * DETEKSI "LAIN-LAIN" (jenis_perkara_id 369) - DIPILAH MENURUT ISINYA
 * ============================================================================
 *
 * SIPP PA Donggala mendaftar 19 perkara "Lain-Lain" (11 Pdt.P, 8 Pdt.G).
 * Isinya terukur (petitum, sipp_donggala 9 Okt 2026):
 *   6 pengangkatan anak, 6 hak asuh anak (Pdt.G), 4 perwalian/wali pengampu,
 *   2 penetapan ahli waris, 1 penetapan kematian.
 * Blangko Derry "9a Lain-Lain (Pengangkatan Anak)" hanya untuk yang pertama;
 * selebihnya memakai blangko jenisnya. Modul ini memilah menurut kata kunci
 * posita+petitum lalu menyerahkan ke modul jenis itu. Penetapan ahli waris
 * diserahkan ke modul agen X bila terdaftar di deteksi/index.js (kunci
 * "penetapan-ahli-waris"); bila tidak, kosong. Penetapan kematian saja: kosong.
 */

const B = require("./bantuAnak");
const perwalian = require("./perwalian");
const pengangkatanAnak = require("./pengangkatanAnak");
const hadhanah = require("./hadhanah");

/** Sub-jenis isi perkara Lain-Lain: "pengangkatan-anak" | "hadhanah" | "perwalian" | "ahli-waris" | "". */
function pilahTeks(teks, gugatan) {
  if (pengangkatanAnak.cocokTeks(teks)) return "pengangkatan-anak";
  if (gugatan && hadhanah.cocokTeks(teks)) return "hadhanah";
  if (/\bMenetapkan\s+ahli\s+waris\b/i.test(teks)) return "ahli-waris";
  if (/\bperwalian\b|\bsebagai\s+wali\b|\bwali\s+pengampu\b/i.test(teks)) return "perwalian";
  if (/\bahli\s+waris\b/i.test(teks)) return "ahli-waris";
  return "";
}

/**
 * Petitum lebih dulu (yang DIMINTA), posita cadangan: 343/Pdt.G/2019 berposita menyebut perwalian
 * tetapi petitumnya "Menetapkan ahli waris".
 */
function pilahIsi(posita, opsi = {}) {
  const pet = B.polos(opsi.petitum || "");
  const pos = B.polos(posita);
  const gugatan = String(opsi.alur || "") === "15" || /\bPenggugat\b/.test(`${pos} ${pet}`);
  return (pet && pilahTeks(pet, gugatan)) || pilahTeks(pos, gugatan);
}

function deteksi(posita, opsi = {}) {
  const isi = pilahIsi(posita, opsi);
  if (isi === "pengangkatan-anak") return pengangkatanAnak.deteksi(posita, opsi);
  if (isi === "hadhanah") return hadhanah.deteksi(posita, opsi);
  if (isi === "perwalian") return perwalian.deteksi(posita, opsi);
  if (isi === "ahli-waris") {
    // Modul waris milik agen lain (bila ada) - dimuat lambat supaya tidak melingkar.
    const m = require("./index").modulUntuk("penetapan-ahli-waris");
    return m && m !== module.exports ? m.deteksi(posita, opsi) : {};
  }
  return {};
}

const variabel = Object.freeze([...pengangkatanAnak.variabel, ...hadhanah.variabel.filter((v) => v.kode !== "8603"), ...perwalian.variabel]);

module.exports = { kunci: "lain-lain", jenisPerkaraId: [369], variabel, deteksi, pilahIsi };
