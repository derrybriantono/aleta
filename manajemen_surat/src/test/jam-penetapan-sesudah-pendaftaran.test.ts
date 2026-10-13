// @vitest-environment node
/**
 * ============================================================================
 * JAM PENETAPAN TIDAK PERNAH MENDAHULUI PENDAFTARAN PERKARANYA
 * ============================================================================
 *
 * Dijalankan, bukan dibaca. Diukur pada basis data server, 825 perkara 2026:
 * PMH selalu sesudah kasir, nol yang mendahului. Perkara 571 pernah tercatat
 * penetapannya pukul 08.27.40 padahal didaftarkan 09.34 - tab Riwayat Perkara
 * SIPP mengurut menurut tanggal, sehingga baris Penetapan duduk DI ATAS baris
 * Pendaftaran Perkara.
 *
 * Sejak butir 17 (13 Okt 2026) mesinnya jamRangkaianManusia (menggantikan
 * waktuLangkah/rangkaianDetik/waktuBongkar): jam SIPP disusun seperti orang
 * bekerja, berakhir <= jam SIPP sekarang, dan dimulai SESUDAH kejadian
 * terakhir perkara itu (lantaiKejadianPerkara - pendaftaran termasuk).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const sumber = readFileSync(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js"), "utf8").replace(/\r\n/g, "\n");

type Jam = (p: { urutan: string[]; sekarang: string; lantai?: string; acak?: () => number }) => {
  jam: Record<string, string>;
  catatan: string[];
};

function muat(): Jam {
  const jalurDb = require_.resolve(path.join(AKAR, "aleta_bot/db_config.js"));
  require_.cache[jalurDb] = { id: jalurDb, filename: jalurDb, loaded: true, exports: { query() {} } } as unknown as NodeJS.Module;
  const jalur = require_.resolve(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js"));
  delete require_.cache[jalur];
  return (require_(jalur) as { jamRangkaianManusia: Jam }).jamRangkaianManusia;
}

function acak(benih: number) {
  let x = Math.imul((benih ^ 0x9e3779b9) >>> 0, 2654435761) >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

const URUT = ["pmh", "ppp", "pjs", "phs"];
const rangkaian = (sekarang: string, lantai: string, benih = 1) => {
  const h = muat()({ urutan: URUT, sekarang, lantai, acak: acak(benih) });
  return URUT.map((j) => h.jam[j]);
};

describe("lantai jam penetapan", () => {
  it("perkara 571: tidak satu pun mendahului pendaftaran 09.34", () => {
    const w = rangkaian("2026-09-16 13:46:00", "2026-09-16 09:34:00");
    for (const satu of w) expect(satu > "2026-09-16 09:34:00", w.join(" ")).toBe(true);
  });

  it("didaftarkan sore hari: di antara pendaftaran dan sekarang", () => {
    const w = rangkaian("2026-09-16 16:20:00", "2026-09-16 15:30:00");
    for (const satu of w) {
      expect(satu > "2026-09-16 15:30:00", w.join(" ")).toBe(true);
      expect(satu <= "2026-09-16 16:20:00", w.join(" ")).toBe(true);
    }
  });

  it("sela tiga menit: dirapatkan, tetap menaik, tidak melampaui sekarang", () => {
    const w = rangkaian("2026-09-16 10:03:00", "2026-09-16 10:00:00");
    for (const satu of w) {
      expect(satu > "2026-09-16 10:00:00", w.join(" ")).toBe(true);
      expect(satu <= "2026-09-16 10:03:00", w.join(" ")).toBe(true);
    }
    for (let i = 1; i < w.length; i += 1) expect(w[i] > w[i - 1], w.join(" ")).toBe(true);
  });

  it("didaftarkan kemarin: hanya jam kerja hari ini yang menahan (07.00)", () => {
    const w = rangkaian("2026-09-16 07:40:00", "2026-09-15 14:00:00");
    expect(w[0] >= "2026-09-16 07:00:00", w.join(" ")).toBe(true);
    expect(w[3] <= "2026-09-16 07:40:00", w.join(" ")).toBe(true);
  });

  it("250 rangkaian: nol yang mendahului pendaftarannya, nol yang mundur, nol di masa depan", () => {
    let melanggar = 0;
    for (const pukul of ["07:15:00", "09:34:00", "11:05:00", "13:32:33", "15:30:00"]) {
      for (let i = 0; i < 50; i += 1) {
        const w = rangkaian("2026-09-16 16:45:00", `2026-09-16 ${pukul}`, i + 1);
        if (w.some((x) => x <= `2026-09-16 ${pukul}`)) melanggar += 1;
        if (w.some((x, k) => k > 0 && x <= w[k - 1])) melanggar += 1;
        if (w.some((x) => x > "2026-09-16 16:45:00")) melanggar += 1;
      }
    }
    expect(melanggar).toBe(0);
  });
});

describe("penjaga sumbernya", () => {
  it("mesin lama dibuang - satu mesin jam saja", () => {
    expect(sumber).not.toContain("function waktuLangkah(");
    expect(sumber).not.toContain("function rangkaianDetik(");
    expect(sumber).not.toContain("async function waktuBongkar(");
    expect(sumber).toContain("function jamRangkaianManusia(");
  });

  it("penulis penetapan dan pembongkar memakai jam SIPP yang disusun, bukan NOW() basis data", () => {
    const tulis = sumber.slice(sumber.indexOf("async function susunRencanaTulis("), sumber.indexOf("async function susunRencanaHapus("));
    expect(tulis).toContain("(await jadwalJamSipp(perkara.perkaraId, [jenis])).jam[jenis]");
    expect(tulis).toContain('alasan: "tanggal_penetapan_sebelum_pendaftaran"');
    const hapus = sumber.slice(sumber.indexOf("async function susunRencanaHapus("));
    expect(hapus).toContain("(await jadwalJamSipp(perkara.perkaraId, [jenis])).jam[jenis]");
  });
});
