// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 30-31 Okt 2026 - paket ABT abt-paket/variabel-sehat-30okt ("perbaiki semua variabel yang bermasalah; kalau tidak ada, tidak usah
 * diperbaiki"). Pindai luas 1.856 penanda blangko Derry x 169 perkara (alat/pindai_mesin.js + alat/analisa.py) lalu render ABT asli:
 * hanya 3 variabel yang terbukti salah karena RUMUSNYA (bukan data SIPP/isian) dan aman diperbaiki di variabelnya sendiri:
 *   4303 itsbat Pasal 7 ayat (3) KHI: isian Tgl Nikah "pada hari Sabtu, ..." / "13 Januari 1975;" tercetak "terjadi pada pada ..." /
 *        "1975; . Jika" -> awalan "pada " dan tanda baca di ujung isian dibuang di keempat tempatnya;
 *   9292/9293 alamat amplop relaas + kode pos: "Domisili Eletronik:" (salah ketik) tidak dikenali, kode pos tersisip sebelum email.
 * Uji tanpa DB: keutuhan paket, isi baru/lama yang ditulis paket = md5 PRASYARAT (tersyarat persis keadaan sesudah semua paket 29-30 Okt),
 * ubahan HANYA bagian yang dimaksud (selisih teks lama-baru dihitung ulang di sini), satu transaksi, tanpa INSERT/DELETE/DDL, tanpa kata
 * nama aplikasi, MariaDB 5.5, dan bukti render ABT asli sebelum/sesudah (hasil/render-ringkasan.json).
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/variabel-sehat-30okt");
const pk = (b: string) => path.join(dir, "paket-satker", b);
const N = "abt-variabel-sehat-30okt";
const baca = (b: string) => readFileSync(pk(b), "utf8").replace(/\r\n/g, "\n");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");
const md5l = (s: string) => md5(Buffer.from(s, "latin1"));

/** UPDATE ... UNHEX('..') ... WHERE no_var = N AND MD5(...) = 'x' -> {no, teks, syaratMd5} */
function updates(sql: string) {
  return [...sql.matchAll(/UPDATE abt_variabel SET sql_query = CONVERT\(UNHEX\('([0-9A-F]+)'\) USING latin1\)\s+WHERE no_var = (\d+) AND MD5\(REPLACE\(sql_query, CONCAT\(DATABASE\(\), '\.'\), 'aps_badilag\.'\)\) = '([0-9a-f]{32})';/g)].map(
    (m) => ({ no: m[2], teks: Buffer.from(m[1], "hex").toString("latin1"), syarat: m[3] })
  );
}
const pasang = updates(baca(`${N}-PASANG.sql`));
const pulih = updates(baca(`${N}-PULIH.sql`));
const lama = Object.fromEntries(pulih.map((u) => [u.no, u.teks]));
const baru = Object.fromEntries(pasang.map((u) => [u.no, u.teks]));

/** Selisih dua teks: awalan & akhiran yang sama dibuang berulang -> potongan [lama, baru] yang berbeda. */
function selisih(a: string, b: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let x = a;
  let y = b;
  for (let n = 0; n < 20 && x !== y; n++) {
    let i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) i++;
    let j = 0;
    while (j < x.length - i && j < y.length - i && x[x.length - 1 - j] === y[y.length - 1 - j]) j++;
    out.push([x.slice(i, x.length - j), y.slice(i, y.length - j)]);
    break;
  }
  return out;
}

describe("paket ABT variabel-sehat-30okt", () => {
  it("MD5SUMS cocok dengan isi paket", () => {
    const baris = baca("MD5SUMS.txt").split("\n").filter(Boolean);
    expect(baris.length).toBe(8);
    for (const b of baris) {
      const [h, f] = b.split(/\s+\*?/);
      expect(md5(readFileSync(pk(f))), f).toBe(h);
    }
  });

  it("hanya 4303, 9292, 9293 - tidak ada variabel baru, blok 11950-11999 tidak dipakai", () => {
    const nomor = baca("nomor-variabel.txt").split("\n").filter((l) => l && !l.startsWith("#"));
    expect(nomor).toEqual(["4303", "9292", "9293"]);
    expect(pasang.map((u) => u.no)).toEqual(nomor);
    expect(pulih.map((u) => u.no)).toEqual(nomor);
    expect(baca("harap.txt").trim().split("\n")).toEqual(["3|0", "0|3"]);
    for (const f of ["PASANG", "PULIH", "PRASYARAT", "PERIKSA"]) expect(baca(`${N}-${f}.sql`)).not.toMatch(/\b119[5-9]\d\b/);
  });

  it("tersyarat md5: PASANG hanya menimpa isi lama persis, PULIH hanya isi hasil paket; PRASYARAT menghitung keduanya", () => {
    const pras = baca(`${N}-PRASYARAT.sql`);
    for (const u of pasang) {
      expect(u.syarat).toBe(md5l(lama[u.no]));
      expect(pras).toContain(`'${md5l(lama[u.no])}'`);
      expect(pras).toContain(`'${md5l(baru[u.no])}'`);
    }
    for (const u of pulih) expect(u.syarat).toBe(md5l(baru[u.no]));
    // satu transaksi, hanya UPDATE abt_variabel bersyarat
    for (const f of ["PASANG", "PULIH"]) {
      const s = baca(`${N}-${f}.sql`).replace(/^--.*$/gm, "");
      expect(s.trim().startsWith("START TRANSACTION;")).toBe(true);
      expect(s.trim().endsWith("COMMIT;")).toBe(true);
      expect(s).not.toMatch(/\b(INSERT|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE INTO)\b/i);
      expect((s.match(/UPDATE abt_variabel/g) || []).length).toBe(3);
    }
  });

  it("4303: hanya keempat tempat isian Tgl Nikah yang berubah, kalimat lain persis", () => {
    const a = lama["4303"];
    const b = baru["4303"];
    expect((a.match(/#5197#/g) || []).length).toBe(4);
    // Kembalikan tiap CONCAT('..', E, '..') ke literal lama -> harus persis teks lama
    const E =
      "TRIM(TRAILING '.' FROM TRIM(TRAILING ';' FROM TRIM(TRAILING ',' FROM TRIM(TRAILING '.' FROM TRIM(TRAILING ';' FROM TRIM(IF(LOWER(LEFT(TRIM('#5197#'), 5)) = 'pada ', SUBSTRING(TRIM('#5197#'), 6), '#5197#')))))))";
    expect(b.split(E).length - 1).toBe(4);
    const balik = b.replace(/CONCAT\('((?:[^'\\]|\\.|'')*)', (TRIM\(TRAILING[^]*?'#5197#'\)\)\)\)\)\)\)), '((?:[^'\\]|\\.|'')*)'\)/g, (_u, x, e, y) => {
      expect(e).toBe(E);
      return `'${x}#5197#${y}'`;
    });
    expect(balik).toBe(a);
    expect(b).not.toContain("pada #5197#");
  });

  it("9292/9293: hanya batas domisili elektronik yang diperluas", () => {
    for (const no of ["9292", "9293"]) {
      expect(selisih(lama[no], baru[no])).toEqual([["ektronik", ""]]);
      expect(lama[no]).toContain("LOCATE('domisili elektronik', x.a)");
      expect(baru[no]).toContain("LOCATE('domisili el', x.a)");
    }
  });

  it("tanpa kata nama aplikasi dan aman untuk MariaDB 5.5", () => {
    for (const f of ["PASANG", "PULIH", "PRASYARAT", "PERIKSA"]) expect(baca(`${N}-${f}.sql`)).not.toMatch(/aleta/i);
    for (const t of [...Object.values(lama), ...Object.values(baru)]) {
      expect(t).not.toMatch(/aleta/i);
      expect(t).not.toMatch(/REGEXP_REPLACE|REGEXP_SUBSTR|JSON_[A-Z]+\(|\bWITH\s+\w+\s+AS\s*\(|ROW_NUMBER\(\)/i);
    }
  });

  it("render ABT asli: sebelum memuat cacat, sesudah tidak; kalimat di luar bagian itu sama", () => {
    const f = path.join(dir, "hasil/render-ringkasan.json");
    expect(existsSync(f)).toBe(true);
    const r = JSON.parse(readFileSync(f, "utf8")) as Array<{ perkara: string; blangko: string; sebelum: string; sesudah: string; sama_selain: boolean }>;
    const tsb = r.filter((x) => x.blangko.startsWith("IN"));
    const amp = r.filter((x) => x.blangko.startsWith("AMP"));
    expect(tsb.length).toBeGreaterThanOrEqual(3);
    expect(amp.length).toBeGreaterThanOrEqual(3);
    expect(tsb.some((x) => /pada pada|; \. Jika/.test(x.sebelum))).toBe(true);
    for (const x of tsb) expect(x.sesudah).not.toMatch(/terjadi pada pada|dilaksanakan pada pada|; \. Jika|;, yaitu/);
    expect(amp.some((x) => /:, Kode Pos|Domisili, Kode Pos/.test(x.sebelum))).toBe(true);
    for (const x of amp) expect(x.sesudah).not.toMatch(/:, Kode Pos|Domisili, Kode Pos/);
    for (const x of r) expect(x.sama_selain, `${x.perkara} ${x.blangko}`).toBe(true);
  });
});
