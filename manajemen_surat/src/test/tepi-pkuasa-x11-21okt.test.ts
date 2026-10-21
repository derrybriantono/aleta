// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

/** 21 Okt 2026 (x11) - uji statis paket abt-paket/x11-tepi-pkuasa-21okt (siklus pasang-ulang-pulih dijalankan di ABT laptop oleh sumber/uji_lokal.sh). */
const require_ = createRequire(import.meta.url);
const dir = path.resolve(process.cwd(), "../abt-paket/x11-tepi-pkuasa-21okt");
const baca = (f: string) => readFileSync(path.join(dir, "paket-satker", f), "utf8");
const bangun = require_(path.join(dir, "sumber/bangun_paket.js")) as Record<string, () => string> & { N: string; RTF: string[][] };
const N = bangun.N;

describe("x11 - hapus penutup di perkara tanpa catatan Minutasi + BAS P (Kuasa)", () => {
  it("berkas paket sama persis dengan hasil bangun (tidak basi)", () => {
    for (const [f, fn] of [["PRASYARAT", "prasyaratSql"], ["HITUNG", "hitungSql"], ["DAFTAR", "daftarSql"], ["PERKARA", "perkaraSql"], ["HAPUS", "hapusSql"], ["PERIKSA", "periksaSql"]]) {
      expect(baca(`${N}-${f}.sql`)).toBe(bangun[fn]());
    }
  });

  it("sasaran: perkara ada di SIPP dan TANPA perkara_proses 220; hanya jawaban seluruhnya penutup (x6, ikut pertanyaan); satu DELETE dibatasi id", () => {
    for (const f of ["HITUNG", "DAFTAR", "HAPUS", "PERKARA"]) {
      const s = baca(`${N}-${f}.sql`);
      expect(s).toContain("NOT EXISTS (SELECT 1 FROM __SIPP__.perkara_proses pp WHERE pp.perkara_id = k.perkara_id AND pp.proses_id = 220)");
      expect(s).toContain("EXISTS (SELECT 1 FROM __SIPP__.perkara p WHERE p.perkara_id = k.perkara_id)");
      expect(s).toContain("aps_badilag.isian_rtf_penutup(CONVERT(CAST(k.jawaban AS BINARY) USING latin1), IFNULL(CONVERT(CAST(k.pertanyaan AS BINARY) USING latin1), '')) = 1");
    }
    const hapus = baca(`${N}-HAPUS.sql`);
    expect(hapus).toContain("k.id IN (__IDS__)");
    expect(hapus.match(/DELETE/g)?.length).toBe(1);
  });

  it("cadangan baris & berkas sebelum diubah; INSERT IGNORE; md5 RTF dikunci; hanya #0184# -> #0111#", () => {
    const pasang = baca("pasang-satker.sh");
    expect(pasang.indexOf("--insert-ignore")).toBeGreaterThan(0);
    expect(pasang.indexOf("baris-dihapus.sql")).toBeLessThan(pasang.indexOf(`$N-HAPUS.sql`));
    expect(pasang.indexOf(".sebelum-x11")).toBeLessThan(pasang.indexOf("s/#0184#/#0111#/"));
    expect(pasang).toMatch(/\[ "\$DIH" = "\$NID" \]/);
    expect(pasang).toContain("hasil sunting RTF tidak sama dengan yang dikunci");
    const pulih = baca("pulih-satker.sh");
    expect(pulih).toContain("PULIH COCOK");
    const kunci = baca("rtf-md5.txt").trim().split("\n");
    expect(kunci).toHaveLength(2);
    for (const [sebelum, sesudah] of bangun.RTF) expect(kunci).toContain(`${sebelum} ${sesudah}`);
    for (const f of ["PRASYARAT", "HITUNG", "DAFTAR", "PERKARA", "HAPUS", "PERIKSA"]) expect(baca(`${N}-${f}.sql`)).not.toMatch(/\bUPDATE\b|\bTRUNCATE\b|INSERT INTO abt_variabel/i);
  });

  it("ASCII dan tanpa kata merek di SQL; MD5SUMS cocok dengan isi", () => {
    for (const f of ["PRASYARAT", "HITUNG", "DAFTAR", "PERKARA", "HAPUS", "PERIKSA"]) {
      const s = baca(`${N}-${f}.sql`);
      expect(s).not.toMatch(/[^\x09\x0a\x20-\x7e]/);
      expect(s.toLowerCase()).not.toContain("aleta");
    }
    for (const baris of baca("MD5SUMS.txt").trim().split("\n")) {
      const [md5, nama] = baris.split(" *");
      expect(crypto.createHash("md5").update(readFileSync(path.join(dir, "paket-satker", nama))).digest("hex")).toBe(md5);
    }
  });
});
