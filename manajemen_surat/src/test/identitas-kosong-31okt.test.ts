// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 31 Okt 2026 (keputusan sesi utama, pengguna tidur) - paket ABT abt-paket/identitas-kosong-31okt: identitas pihak yang datanya kosong
 * di SIPP tidak lagi tercetak "NIK , tempat dan tanggal lahir , 00 0000, agama , pekerjaan , pendidikan ," melainkan "NIK ...,
 * tempat dan tanggal lahir ..., agama Islam, pekerjaan ..., pendidikan ...," (label tetap, "..." satu kali, agama kosong = Islam).
 * 11 variabel identitas dibungkus fungsi baru isian_rtf_identitas_kosong; kueri lamanya tidak disunting. Ditambah peringatan pasif
 * di panel Blangko Derry bila isian Tgl Nikah memuat kata selain tanggal.
 * Fungsi diuji dengan penerjemah REPLACE-nya sendiri (urutan REPLACE persis dari FUNGSI.sql) atas contoh keluaran ABT nyata.
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/identitas-kosong-31okt");
const pk = (b: string) => path.join(dir, "paket-satker", b);
const N = "abt-identitas-kosong-31okt";
const baca = (b: string) => readFileSync(pk(b), "utf8").replace(/\r\n/g, "\n");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");
const md5l = (s: string) => md5(Buffer.from(s, "latin1"));
const NOMOR = ["3507", "3509", "3970", "3971", "7047", "7048", "7062", "9230", "9231", "11205", "11206"];

function updates(sql: string) {
  return [...sql.matchAll(/UPDATE abt_variabel SET sql_query = CONVERT\(UNHEX\('([0-9A-F]+)'\) USING latin1\)\s+WHERE no_var = (\d+) AND MD5\(REPLACE\(sql_query, CONCAT\(DATABASE\(\), '\.'\), 'aps_badilag\.'\)\) = '([0-9a-f]{32})';/g)].map(
    (m) => ({ no: m[2], teks: Buffer.from(m[1], "hex").toString("latin1"), syarat: m[3] })
  );
}
const pasang = updates(baca(`${N}-PASANG.sql`));
const pulih = updates(baca(`${N}-PULIH.sql`));
const lama = Object.fromEntries(pulih.map((u) => [u.no, u.teks]));
const baru = Object.fromEntries(pasang.map((u) => [u.no, u.teks]));

/** Jalankan fungsi SQL: urutan SET s = REPLACE(s, 'a', 'b') dari FUNGSI.sql, persis seperti MariaDB menjalankannya. */
const fungsi = baca(`${N}-FUNGSI.sql`);
const langkah = [...fungsi.matchAll(/SET s = REPLACE\(s, '((?:[^'\\]|'')*)', '((?:[^'\\]|'')*)'\);/g)].map((m) => [m[1].replace(/''/g, "'"), m[2].replace(/''/g, "'")] as const);
const rapi = (t: string) => (t === "" ? t : langkah.reduce((s, [a, b]) => s.split(a).join(b), t));

describe("paket ABT identitas-kosong-31okt", () => {
  it("MD5SUMS cocok dengan isi paket", () => {
    const baris = baca("MD5SUMS.txt").split("\n").filter(Boolean);
    expect(baris.length).toBe(10);
    for (const b of baris) {
      const [h, f] = b.split(/\s+\*?/);
      expect(md5(readFileSync(pk(f))), f).toBe(h);
    }
  });

  it("hanya 11 variabel identitas; kueri lama dibungkus utuh, md5 tersyarat", () => {
    expect(baca("nomor-variabel.txt").split("\n").filter((l) => l && !l.startsWith("#"))).toEqual(NOMOR);
    expect(pasang.map((u) => u.no)).toEqual(NOMOR);
    expect(baca("harap.txt").trim().split("\n")).toEqual(["11|0|0", "0|11|1"]);
    const pras = baca(`${N}-PRASYARAT.sql`);
    for (const no of NOMOR) {
      const inti = lama[no].replace(/\s*;?\s*$/, "").replace(/;\s*$/, "");
      expect(baru[no]).toBe(`SELECT aps_badilag.isian_rtf_identitas_kosong(x.data) AS data FROM (\n${inti.trimEnd()}\n) x`);
      expect(pasang.find((u) => u.no === no)!.syarat).toBe(md5l(lama[no]));
      expect(pulih.find((u) => u.no === no)!.syarat).toBe(md5l(baru[no]));
      expect(pras).toContain(md5l(lama[no]));
      expect(pras).toContain(md5l(baru[no]));
    }
    for (const f of ["PASANG", "PULIH"]) {
      const s = baca(`${N}-${f}.sql`).replace(/^--.*$/gm, "").trim();
      expect(s.startsWith("START TRANSACTION;") && s.endsWith("COMMIT;")).toBe(true);
      expect(s).not.toMatch(/\b(INSERT|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i);
    }
    expect(baca(`${N}-FUNGSI-PULIH.sql`)).toContain("DROP FUNCTION IF EXISTS aps_badilag.isian_rtf_identitas_kosong;");
  });

  it("fungsi: bagian kosong jadi '...', agama kosong = Islam, tanpa 00 0000/koma ganda/label kosong", () => {
    expect(langkah.length).toBeGreaterThanOrEqual(18);
    const kosong = "<strong>Zaitun binti Moh. Saleh</strong>, NIK , tempat dan tanggal lahir , 00 0000, agama , pekerjaan , pendidikan , tempat kediaman di Desa Walana, sebagai <strong>Tergugat I</strong>;";
    expect(rapi(kosong)).toBe("<strong>Zaitun binti Moh. Saleh</strong>, NIK ..., tempat dan tanggal lahir ..., agama Islam, pekerjaan ..., pendidikan ..., tempat kediaman di Desa Walana, sebagai <strong>Tergugat I</strong>;");
    expect(rapi("<strong>A</strong>, NIK 72, tempat dan tanggal lahir Tanah Mea, , agama Islam, pekerjaan X, pendidikan SLTA, tempat kediaman di Y;")).toBe(
      "<strong>A</strong>, NIK 72, tempat dan tanggal lahir Tanah Mea, ..., agama Islam, pekerjaan X, pendidikan SLTA, tempat kediaman di Y;"
    );
    expect(rapi("<strong>A</strong>, NIK 1, tempat dan tanggal lahir , 01 Juli 1972, umur tahun, agama Kristen, pekerjaan P, pendidikan S, tempat kediaman di Z;")).toBe(
      "<strong>A</strong>, NIK 1, tempat dan tanggal lahir ..., 01 Juli 1972, umur ... tahun, agama Kristen, pekerjaan P, pendidikan S, tempat kediaman di Z;"
    );
    // data lengkap: tidak berubah satu huruf pun; hasil rapi tidak berubah lagi bila dirapikan ulang
    const lengkap = "<strong>Sidik bin Laumala</strong>, NIK 7208010107720005, tempat dan tanggal lahir Marana, 01 Juli 1972, agama Islam, pekerjaan Petani, pendidikan SLTP, tempat kediaman di Desa X, sebagai <strong>Penggugat</strong>;";
    expect(rapi(lengkap)).toBe(lengkap);
    expect(rapi(rapi(kosong))).toBe(rapi(kosong));
    for (const t of [kosong, " , NIK , tempat dan tanggal lahir , , umur tahun, agama , pekerjaan , pendidikan , tempat kediaman di , sebagai Termohon ;"]) {
      const h = rapi(t);
      expect(h).not.toMatch(/00 0000|, ,|\b(NIK|lahir|agama|pekerjaan|pendidikan|di) [,;]|umur tahun/);
    }
  });

  it("tanpa kata nama aplikasi dan aman untuk MariaDB 5.5", () => {
    for (const f of ["PASANG", "PULIH", "PRASYARAT", "PERIKSA", "FUNGSI", "FUNGSI-PULIH"]) {
      const s = baca(`${N}-${f}.sql`);
      expect(s).not.toMatch(/aleta/i);
      expect(s).not.toMatch(/REGEXP_REPLACE|REGEXP_SUBSTR|JSON_[A-Z]+\(|ROW_NUMBER\(\)/i);
    }
    for (const t of Object.values(baru)) expect(t).not.toMatch(/aleta/i);
  });

  it("banding & render ABT asli tercatat: hanya perkara berdata kosong berubah, galat baru 0", () => {
    const f = path.join(dir, "hasil/banding-ringkas.json");
    expect(existsSync(f)).toBe(true);
    const r = JSON.parse(readFileSync(f, "utf8")) as { galatBaru: number; berubahTanpaKosong: number; berubah: number; perkara: number };
    expect(r.galatBaru).toBe(0);
    expect(r.berubahTanpaKosong).toBe(0);
    expect(r.berubah).toBeGreaterThan(0);
    const g = JSON.parse(readFileSync(path.join(dir, "hasil/render-ringkasan.json"), "utf8")) as Array<{ sebelum: string; sesudah: string; sama_selain: boolean }>;
    expect(g.some((x) => /NIK ,|00 0000|agama ,/.test(x.sebelum))).toBe(true);
    for (const x of g) {
      expect(x.sesudah).not.toMatch(/00 0000|NIK ,|agama ,|pekerjaan ,|pendidikan ,|, ,/);
      expect(x.sama_selain).toBe(true);
    }
  });
});

describe("panel Blangko Derry: peringatan isian Tgl Nikah", () => {
  const js = readFileSync(path.join(akar, "ekstensi-sipp/blangko-derry-isian.js"), "utf8").replace(/\r\n/g, "\n");
  const a = js.indexOf("  function peringatanTglNikah(teks) {");
  const b = js.indexOf("\n  }\n", a);
  const peringatan = new Function(`${js.slice(a, b + 4)}\nreturn peringatanTglNikah;`)() as (t: unknown) => string;

  it("tanggal saja tidak diperingatkan; kata lain atau tanda baca di ujung diperingatkan", () => {
    for (const ok of ["", "13 Januari 1975", "5 Mei 2001", "13-01-1975", "13/01/1975"]) expect(peringatan(ok), ok).toBe("");
    for (const salah of ["pada hari Sabtu, 18 Oktober 2025", "13 Januari 1975;", "Rabu 20 April 1994", "tanggal 10 Januari 2001,"]) {
      expect(peringatan(salah), salah).toMatch(/tanggalnya saja/);
    }
  });

  it("teks peringatan tanpa angka empat digit dan tanpa istilah teknis; kotaknya pasif (role alert, tersembunyi bila kosong)", () => {
    const t = peringatan("pada hari Sabtu");
    expect(t).not.toMatch(/\b\d{4}\b/);
    expect(t).not.toMatch(/variabel|server|peladen|borang|galat/i);
    expect(js).toMatch(/b\.kode === KODE_TGL_NIKAH \? \(\(\) => \{ const w = peringatanTglNikah\(v\); return `<span class="bd-peringatan" data-peringatan="\$\{KODE_TGL_NIKAH\}" role="alert" \$\{w \? "" : "hidden"\}>/);
    expect(js).toContain("if (k === KODE_TGL_NIKAH) perbaruiPeringatanTglNikah();");
  });
});
