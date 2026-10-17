// @vitest-environment node
import { describe, expect, it } from "vitest";

import { periksaKueriVariabel } from "@/lib/pengaturan-abt";

/** Audit 17 Okt 2026 (portal): kasus ini GAGAL atas a2e3618 dan hijau sesudah perbaikannya. */

describe("kueri variabel ABT - kutip di dalam komentar tidak menyelundupkan perintah", () => {
  // Dulu kutipan dibuang lebih dulu, baru komentar: tanda kutip di dalam
  // komentar "menelan" kode di antaranya, dan /*! ... */ (yang DIJALANKAN
  // MySQL) dibuang sebagai komentar biasa.
  const SELUNDUP = [
    "SELECT 1 /*!, SLEEP(5)*/ AS data",
    "SELECT 1 /*!50000 INTO OUTFILE '/tmp/x' */",
    "SELECT 1 /*M!, SLEEP(5)*/ AS data",
    "SELECT 1 /* ' */, LOAD_FILE('/etc/passwd') /* ' */ AS data",
    "SELECT 1 /* ' */ INTO OUTFILE '/var/www/x.php' /* ' */",
    "SELECT 1 # '\n, BENCHMARK(1e9,MD5(1)) -- '\nAS data",
    "SELECT 1 /* ' */; UPDATE sys_user SET password='x'; /* ' */",
    "SELECT 1 AS data#'\n, SLEEP(3) -- '",
  ];
  it.each(SELUNDUP)("ditolak: %s", (q) => {
    expect(periksaKueriVariabel(q)).not.toBe("");
  });

  it("kueri sah tetap lolos: komentar biasa, kutip berisi kata terlarang, #penanda#, aritmetika 1--1", () => {
    for (const q of [
      "SELECT nama AS data FROM perkara WHERE perkara_id = #perkara_id# /* catatan */",
      "SELECT 'update; sleep(1) -- x' AS data FROM t -- akhir\n",
      "SELECT CONCAT(a, '#', b) AS data FROM t WHERE id = #1214#",
      "SELECT 1--1 AS data",
      "SELECT `kolom 'aneh'` AS data FROM t",
    ]) {
      expect(periksaKueriVariabel(q), q).toBe("");
    }
  });
});
