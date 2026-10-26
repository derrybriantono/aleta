// @vitest-environment node
/**
 * Paket ABT y5-pengumuman-kedua-26okt (26 Okt 2026): variabel 7063 "WAKTU PANGGILAN RADIO OTOMATIS" membaca tanggal pengumuman ke-2
 * yang dicatat pada sidang berikutnya (322/Pdt.G/2026/PA.Dgl: "10 Agustus 2026 dan ..." -> "... dan 13 Oktober 2026").
 * Uji ini menjaga berkas paket tidak basi (MD5SUMS, hex di PASANG/PULIH = sumber), penjaga MD5 isi lama, dan bentuk query baru.
 * Query diukur BACA SAJA di server dengan alat/uji_server.py (61 perkara tetap sama, 6 berubah dari "..." menjadi terisi).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PAKET = path.resolve(__dirname, "../../../abt-paket/y5-pengumuman-kedua-26okt");
const baca = (...p: string[]) => readFileSync(path.join(PAKET, ...p));
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const N = "abt-y5-pengumuman-kedua-26okt";

describe("paket ABT y5-pengumuman-kedua-26okt", () => {
  const lama = baca("sumber", "7063-lama-server-26okt.sql");
  const baru = baca("sumber", "7063-baru.sql");
  const pasang = baca("paket-satker", `${N}-PASANG.sql`).toString("latin1");
  const pulih = baca("paket-satker", `${N}-PULIH.sql`).toString("latin1");
  const periksa = baca("paket-satker", `${N}-PERIKSA.sql`).toString("latin1");

  it("MD5SUMS cocok dengan isi paket-satker", () => {
    const daftar = baca("paket-satker", "MD5SUMS.txt").toString("latin1").trim().split("\n");
    expect(daftar.length).toBe(5);
    for (const baris of daftar) {
      const [hash, nama] = baris.split(/\s{2}/);
      expect(md5(baca("paket-satker", nama)), nama).toBe(hash);
    }
  });

  it("isi lama = yang diukur di server (md5 66657b95...), PASANG menjaga md5 itu dan memuat isi baru persis", () => {
    expect(md5(lama)).toBe("66657b95ba227dbee045fbef8ab01c6e");
    expect(pasang).toContain(`MD5(sql_query) = '${md5(lama)}'`);
    expect(pasang).toContain(`sql_query = 0x${baru.toString("hex")}`);
    expect(pasang).toMatch(/WHERE no_var = 7063 AND data_type = 'data_sql'/);
    expect(periksa).toContain(`MD5(sql_query) = '${md5(baru)}'`);
    expect(periksa).toContain(`LENGTH(sql_query) = ${baru.length}`);
  });

  it("PULIH mengembalikan isi lama dengan penjaga md5 isi baru", () => {
    expect(pulih).toContain(`sql_query = 0x${lama.toString("hex")}`);
    expect(pulih).toContain(`MD5(sql_query) = '${md5(baru)}'`);
  });

  it("query baru: ASCII, tanpa CR, tanpa kata nama aplikasi, satu-satunya perubahan d2 + komentar", () => {
    const t = baru.toString("latin1");
    expect([...baru].every((c) => c < 128)).toBe(true);
    expect(t).not.toContain("\r");
    expect(t).not.toMatch(/aleta/i);
    expect(t).toContain("COALESCE((SELECT DISTINCT r.tanggal_relaas");
    // cadangan: sidang mana pun, bukan sidang ikrar, tidak sesudah putusan, pihak kedua saja
    expect(t).toMatch(/ORDER BY r2\.tanggal_relaas LIMIT 1, 1\)\) AS d2/);
    expect(t).toContain("IFNULL(j2.ikrar_talak, 'T') <> 'Y'");
    expect(t).toContain("r2.tanggal_relaas <= IFNULL((SELECT MAX(pu2.tanggal_putusan)");
    // bagian d1 dan penentu sidang tidak berubah
    const buangBagian = (s: string) => s.split("\n").filter((l) => !/r2\.|j2\.|pu2\.|p3\.|COALESCE|LIMIT 1, 1\)|^--/.test(l));
    expect(buangBagian(t).join("\n").replace(/\s+/g, " ")).toContain("LIMIT 0, 1) AS d1");
    expect(t).toContain("ORDER BY r.tanggal_relaas, r.id LIMIT 1) AS sid");
  });

  it("skrip pasang menolak isi yang bukan hasil ukur dan tidak menulis blangko", () => {
    const sh = baca("paket-satker", "pasang-satker.sh").toString("latin1");
    expect(sh).toContain(`MD5(sql_query) = '${md5(lama)}'`);
    expect(sh).toContain("md5sum -c MD5SUMS.txt");
    expect(sh).toContain("abt_variabel-7063-sebelum.sql");
    expect(sh).not.toMatch(/\.rtf|_blangko_abt/i);
  });
});
