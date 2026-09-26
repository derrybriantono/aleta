// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as portal from "@/lib/tipe-keluaran/pemilih-ragam";

/**
 * ============================================================================
 * PEMILIH RAGAM PORTAL = PEMILIH RAGAM BOT (K7b)
 * ============================================================================
 *
 * Dua salinan satu rumus: aleta_bot/services/pemilihRagam.js dan
 * src/lib/tipe-keluaran/pemilih-ragam.ts. Bila keduanya berselisih, pratinjau
 * di portal memperlihatkan bentuk yang tidak pernah disusun bot. Uji ini
 * MENJALANKAN keduanya atas 2.251 nomor berpola nomor perkara PA (bukan
 * fixture: nomornya dibangun, bukan disalin dari register) x 16 kunci x
 * n 3-6 x saksi 1..n, dan menuntut sama 100%. Ukuran atas 2.251 nomor
 * perkara SUNGGUHAN dijalankan di D:/aleta-dev/kerja/enam-butir/
 * t2-ragam-bas-bot/ukur-pemilih-cermin.cjs.
 */

type Bot = {
  fnv1a32: (t: string) => number;
  fmix32: (n: number) => number;
  angka01: (t: string) => number;
  kunciTanya: (t: string) => string;
  indeksVarian: (a: { nomorPerkara: string; kodeKumpulan: string; kunciTanya: string; n: number; ke: number }) => number;
  diragamkan: (a: { nomorPerkara: string; kunciTanya: string; peluang: number }) => boolean;
  kelompokTanya: (t: string) => { jenis: string; kelompok: string; kunci: string };
};
const require_ = createRequire(import.meta.url);
const bot = require_(path.resolve(process.cwd(), "../aleta_bot/services/pemilihRagam.js")) as Bot;

const JENIS = ["Pdt.G", "Pdt.P"];
const NOMOR = Array.from({ length: 2251 }, (_, i) => `${(i % 1100) + 1}/${JENIS[i % 2]}/${2022 + (i % 5)}/PA.Dgl`);
const TANYA = [
  "Apakah saksi kenal dengan Penggugat dan Tergugat?",
  "Apakah Saudara mengenal Pemohon I dan Pemohon II?",
  "Dimana #0046# dan #0047# bertempat tinggal setelah menikah?",
  "Bagaimana kehidupan rumah tangga Penggugat dan Tergugat?",
  "Apakah saksi tahu penyebab perselisihan dan pertengkaran Penggugat dan Tergugat?",
  "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?",
  "Berapa kali saksi melihat dan mendengar Penggugat dan Tergugat bertengkar?",
  "Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?",
  "Sudah berapa lama Penggugat dan Tergugat berpisah tempat tinggal?",
  "Pernahkah ada upaya untuk merukunkan Pemohon dan Termohon?",
  "Apakah selama pisah antara Penggugat dan Tergugat masih ada komunikasi?",
  "Apakah Termohon masih memberikan nafkah kepada Pemohon?",
  "Apakah masih ada yang ingin saudara sampaikan?",
  "Siapa yang meninggalkan tempat tinggal bersama?",
  "Apa sebabnya wali Pemohon tidak mau menjadi wali nikah dari Pemohon ?",
  "Pernahkah Saudara mendengar ada pihak lain yang keberatan atas pernikahan Pemohon I dengan Pemohon II?",
];

describe("pemilih portal = pemilih bot", () => {
  it("16 kunci pertanyaan dan kelompoknya sama", () => {
    expect(TANYA.map((t) => portal.kunciTanya(t))).toEqual(TANYA.map((t) => bot.kunciTanya(t)));
    expect(TANYA.map((t) => portal.kelompokTanya(t))).toEqual(TANYA.map((t) => bot.kelompokTanya(t)));
    expect(new Set(TANYA.map((t) => bot.kunciTanya(t))).size).toBe(16);
  });

  it("2.251 nomor x 16 kunci x n 3-6 x saksi 1..n: indeks dan keputusan ragam identik 100%", () => {
    let diperiksa = 0;
    let beda = 0;
    for (const nomorPerkara of NOMOR) {
      for (const t of TANYA) {
        const kunci = bot.kunciTanya(t);
        for (let n = 3; n <= 6; n++) {
          for (let ke = 1; ke <= n; ke++) {
            const a = { nomorPerkara, kodeKumpulan: "04", kunciTanya: kunci, n, ke };
            diperiksa++;
            if (bot.indeksVarian(a) !== portal.indeksVarian(a)) beda++;
          }
        }
        for (const peluang of [0, 0.07, 0.45, 1]) {
          const a = { nomorPerkara, kunciTanya: kunci, peluang };
          diperiksa++;
          if (bot.diragamkan(a) !== portal.diragamkan(a)) beda++;
        }
      }
    }
    expect(diperiksa).toBe(2251 * 16 * (3 + 4 + 5 + 6 + 4));
    expect(beda).toBe(0);
  });

  it("FNV-1a atas teks ber-aksen, emoji, dan separuh pasangan surrogate = TextEncoder", () => {
    const acuan = (t: string) => {
      let h = 0x811c9dc5;
      for (const b of new TextEncoder().encode(t)) {
        h ^= b;
        h = Math.imul(h, 0x01000193);
      }
      return h >>> 0;
    };
    for (const t of ["", "Pengadilan", "é ü ñ", "日本語", "😀", "a\ud800b", "\udc00"]) {
      expect(bot.fnv1a32(t), t).toBe(acuan(t));
      expect(portal.fnv1a32(t), t).toBe(acuan(t));
    }
  });
});

describe("rumus K7b sendiri", () => {
  it("dalam satu BAS, n >= banyak saksi -> tidak ada indeks berulang", () => {
    for (const nomorPerkara of NOMOR.slice(0, 500)) {
      for (let n = 2; n <= 7; n++) {
        const indeks = Array.from({ length: n }, (_, i) =>
          portal.indeksVarian({ nomorPerkara, kodeKumpulan: "A1", kunciTanya: "kenal", n, ke: i + 1 })
        );
        expect(new Set(indeks).size, `${nomorPerkara} n=${n}`).toBe(n);
      }
    }
  });

  it("indeks tersebar antar perkara, tidak menumpuk di satu bentuk", () => {
    const hitung = [0, 0, 0, 0, 0];
    for (const nomorPerkara of NOMOR) hitung[portal.indeksVarian({ nomorPerkara, kodeKumpulan: "04", kunciTanya: "kenal", n: 5, ke: 1 })]++;
    for (const h of hitung) expect(h).toBeGreaterThan(2251 / 5 / 2);
  });

  it("peluang ragam mengikuti angkanya", () => {
    const ya = NOMOR.filter((nomorPerkara) => portal.diragamkan({ nomorPerkara, kunciTanya: "komunikasi", peluang: 0.07 })).length;
    expect(ya / NOMOR.length).toBeGreaterThan(0.04);
    expect(ya / NOMOR.length).toBeLessThan(0.1);
  });
});
