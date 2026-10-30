// @vitest-environment node
/**
 * 31 OKT 2026 - BUTIR 25: paket ABT abt-tanggal-agenda-31okt (tanggal jawaban/replik/duplik/kesimpulan/pembuktian dari jadwal sidang
 * SIPP bila Court Calendar tidak memuat agendanya). Yang dijaga dari isi paket SUNGGUHAN:
 *   - cabang Court Calendar lama disalin UTUH di depan (hasil perkara ber-Court Calendar tidak berubah - banding 1.917 perkara: 0 berubah);
 *   - PULIH = isi lama persis; md5 berkas paket cocok; tanpa kata terlarang di berkas yang ditulis ke ABT;
 *   - REGEXP hanya bentuk POSIX (MariaDB 5.5 server) dan aturan agendanya dijalankan atas agenda SIPP nyata (sipp_2810).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(process.cwd(), "../abt-paket/tanggal-agenda-31okt/paket-satker");
const N = "abt-tanggal-agenda-31okt";
const baca = (b: string) => readFileSync(path.join(DIR, b), "utf8");
const isi = (sql: string) =>
  new Map([...sql.matchAll(/UNHEX\('([0-9A-F]+)'\) USING latin1\)\n WHERE no_var = (\d+)/g)].map((m) => [m[2], Buffer.from(m[1], "hex").toString("latin1")]));
/** Kueri ABT lama ber-CRLF; paket mempertahankan akhir baris itu. Pembacaan syarat agenda di uji memakai LF. */
const lf = (t: string) => t.replace(/\r\n/g, "\n");
const BARU = isi(baca(`${N}-PASANG.sql`));
const LAMA = isi(baca(`${N}-PULIH.sql`));

/** Syarat agenda jadwal sidang di kueri baru, dijalankan di JS atas agenda (LIKE -> includes, REGEXP POSIX -> RegExp). */
function cocokAgenda(sql: string, agenda: string): boolean {
  const m = /FROM\n {2}perkara_jadwal_sidang j\nWHERE\n {2}j\.perkara_id = #perkara_id#\n {2}AND (.*)\n/.exec(lf(sql));
  if (!m) throw new Error("syarat agenda tidak ditemukan");
  const a = agenda.toLowerCase();
  const js = m[1]
    .replace(/LOWER\(j\.agenda\) NOT LIKE '%([^%]*)%'/g, (_, k) => `!a.includes(${JSON.stringify(k)})`)
    .replace(/LOWER\(j\.agenda\) LIKE '%([^%]*)%'/g, (_, k) => `a.includes(${JSON.stringify(k)})`)
    .replace(/NOT LOWER\(j\.agenda\) REGEXP '([^']*)'/g, (_, r) => `!new RegExp(${JSON.stringify(r)}).test(a)`)
    .replace(/LOWER\(j\.agenda\) REGEXP '([^']*)'/g, (_, r) => `new RegExp(${JSON.stringify(r)}).test(a)`)
    .replace(/\bAND\b/g, "&&")
    .replace(/\bOR\b/g, "||");
  return new Function("a", `return (${js});`)(a) as boolean;
}

describe("isi paket", () => {
  it("14 variabel; cabang Court Calendar lama utuh di depan; PULIH = isi lama", () => {
    expect([...BARU.keys()].sort()).toEqual(["2111", "2112", "7111", "7112", "7113", "7114", "7115", "7116", "7117", "7118", "7119", "7121", "7122", "8438"]);
    for (const [no, baru] of BARU) {
      const lama = LAMA.get(no)!;
      const cc = lama.split(/\r?\n\s*UNION ALL\s*\r?\n/)[0].trimEnd();
      // Cabang Court Calendar PERSIS (byte demi byte, termasuk CRLF aslinya), dan tidak ada akhir baris campuran.
      expect(baru.startsWith(cc)).toBe(true);
      expect(/\r\r|[^\r]\n/.test(baru)).toBe(lama.includes("\r\n") ? false : /[^\r]\n/.test(baru));
      expect(baru).toContain("perkara_jadwal_sidang j");
      expect(lf(baru)).toMatch(/ORDER BY j\.tanggal_sidang, j\.id\nLIMIT 1\)/);
      expect(lama).not.toContain("perkara_jadwal_sidang");
    }
  });
  it("md5 berkas paket cocok; tanpa kata terlarang; REGEXP tanpa bentuk PCRE", () => {
    for (const baris of baca("MD5SUMS.txt").trim().split("\n")) {
      const [h, b] = baris.split(/\s+\*?/);
      expect(createHash("md5").update(readFileSync(path.join(DIR, b))).digest("hex")).toBe(h);
    }
    for (const b of ["PASANG", "PULIH", "PRASYARAT", "PERIKSA"]) expect(baca(`${N}-${b}.sql`)).not.toMatch(/aleta/i);
    for (const sql of BARU.values()) {
      expect(sql).not.toMatch(/\\[bdsw]|\(\?|\*\?|\+\?/);
      expect(sql).not.toMatch(/aleta/i);
    }
  });
});

describe("aturan agenda atas agenda SIPP nyata", () => {
  const ya = (no: string, agenda: string) => cocokAgenda(BARU.get(no)!, agenda);
  it("jawaban/replik/duplik: konvensi saja", () => {
    for (const a of ["Jawaban Tergugat", "jawaban termohon secara elitigasi", "Jawab menjawab", "jawaban tertulis tergugat"]) expect(ya("7111", a)).toBe(true);
    expect(ya("7111", "jawaban rekonvensi")).toBe(false);
    expect(ya("7112", "untuk replik Pemohon")).toBe(true);
    expect(ya("7112", "duplik konvensi/replik rekonvensi")).toBe(false);
    expect(ya("7113", "duplik konvensi/replik rekonvensi")).toBe(true);
    expect(ya("7113", "duplik rekonvensi")).toBe(false);
    expect(ya("7114", "duplik rekonvensi")).toBe(true);
    expect(ya("8438", "Pemeriksaan, kesimpulan, musyawarah majelis, pembacaan putusan")).toBe(true);
  });
  it("pembuktian #0046#: tanpa sebutan pihak = pihak pertama; khusus Tergugat bukan", () => {
    for (const a of ["Pembuktian", "pembuktian lanjutan", "Pembuktian Penggugat", "Sidang Kedua : Pembacaan Surat Gugatan, Pembuktian", "pembuktian dan panggil tergugat", "Pembuktian Penggugat dan Tergugat", "mengajukan saksi-saksi"]) {
      expect(ya("2111", a)).toBe(true);
    }
    for (const a of ["pembuktian Tergugat", "Pembuktian lanjutan termohon", "Jawaban Tergugat", "Kesimpulan"]) expect(ya("2111", a)).toBe(false);
  });
  it("pembuktian #0047#: hanya bila Tergugat/Termohon disebut sesudah bukti/saksi", () => {
    for (const a of ["pembuktian Tergugat", "Pembuktian lanjutan termohon", "Pembuktian Pemohon dan Termohon", "saksi tergugat"]) expect(ya("2112", a)).toBe(true);
    for (const a of ["Pembuktian", "pembuktian dan panggil tergugat", "Pembuktian Penggugat", "Jawaban Tergugat"]) expect(ya("2112", a)).toBe(false);
  });
  it("hari mengikuti aturan yang sama dengan tanggalnya", () => {
    for (const [hari, tgl] of [["7115", "7111"], ["7116", "7112"], ["7117", "7113"], ["7118", "7114"], ["7122", "8438"], ["7119", "2111"], ["7121", "2112"]]) {
      for (const a of ["Pembuktian", "pembuktian Tergugat", "Jawaban Tergugat", "duplik rekonvensi", "kesimpulan"]) expect(ya(hari, a)).toBe(ya(tgl, a));
    }
  });
});
