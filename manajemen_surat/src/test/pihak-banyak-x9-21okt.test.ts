// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 21 Okt 2026 (x9) - identitas pihak banyak. Kueri ABT 7047/7097 (Pemohon/Penggugat; batas lama 4 dan 5), 7048/7098 (Termohon/Tergugat; batas lama 5),
 * 8710 (Turut Tergugat; 10) dan 7054 (pihak intervensi; 5) berhenti diam-diam ("ELSE ''"), padahal perkara nyata punya sampai 32 Pemohon, 25 Tergugat
 * dan 26 Turut Tergugat. Paket abt-paket/x9-pihak-banyak-21okt menambah enam fungsi isian_rtf_* dan sepuluh variabel (3507-3516), dan hanya
 * MENYISIPKAN satu cabang di kueri lama sehingga keluaran untuk pihak <= batas lama tidak berubah. Uji ini menjaga paket di repo (tanpa DB).
 */
const dir = path.resolve(process.cwd(), "../abt-paket/x9-pihak-banyak-21okt");
const pk = (b: string) => path.join(dir, "paket-satker", b);
const N = "abt-x9-pihak-banyak-21okt";
const baca = (b: string) => readFileSync(pk(b), "utf8");

function hexTerurai(sql: string): string[] {
  return [...sql.matchAll(/0x([0-9a-f]+)/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1"));
}
function updateSql(pasang: string, no: number): string {
  const m = pasang.match(new RegExp(`UPDATE abt_variabel SET sql_query=0x([0-9a-f]+), modified='[^']*' WHERE \\(no_var=${no} `));
  expect(m, `UPDATE ${no}`).not.toBeNull();
  return Buffer.from(m![1], "hex").toString("latin1");
}

describe("x9 - berkas paket utuh", () => {
  it("MD5SUMS.txt cocok dengan isi paket-satker", () => {
    const baris = baca("MD5SUMS.txt").trim().split("\n");
    expect(baris.length).toBeGreaterThanOrEqual(10);
    for (const b of baris) {
      const [md5, nama] = b.split(/\s+/);
      expect(createHash("md5").update(readFileSync(pk(nama))).digest("hex"), nama).toBe(md5);
    }
  });

  it("FUNGSI.sql di paket = sumber/templat-fungsi.sql; ASCII; tanpa kata merek; enam fungsi bertanda X9", () => {
    const fungsi = baca(`${N}-FUNGSI.sql`);
    expect(fungsi).toBe(readFileSync(path.join(dir, "sumber/templat-fungsi.sql"), "utf8"));
    expect(fungsi).not.toMatch(/[^\x09\x0a\x20-\x7e]/);
    expect(fungsi.toLowerCase()).not.toContain("aleta");
    const nama = baca("nama-fungsi.txt").trim().split(/\s+/);
    expect(nama).toHaveLength(6);
    for (const f of nama) {
      expect(fungsi).toContain(`DROP FUNCTION IF EXISTS ${f}$$`);
      expect(fungsi).toMatch(new RegExp(`CREATE FUNCTION ${f}\\([^]*?COMMENT 'X9: `));
    }
    expect(fungsi).toContain("SIPP.perkara_pihak1");
    expect(fungsi).toContain("SIPP.perkara_pihak2");
    expect(fungsi).toContain("SIPP.perkara_pihak4");
    expect(fungsi).not.toMatch(/PREPARE|EXECUTE|REGEXP_REPLACE/i); // MariaDB 5.5: tanpa SQL dinamis di fungsi
  });

  it("semua SQL paket ASCII dan, termasuk literal heksadesimal, tanpa kata merek", () => {
    for (const b of ["PRASYARAT", "PASANG", "PERIKSA", "PULIH"]) {
      const sql = baca(`${N}-${b}.sql`);
      expect(sql).not.toMatch(/[^\x09\x0a\x0d\x20-\x7e]/);
      expect(sql.toLowerCase()).not.toContain("aleta");
      for (const t of hexTerurai(sql)) expect(t.toLowerCase()).not.toContain("aleta");
    }
  });

  it("angka PRASYARAT harapan di pasang-satker.sh = yang tertulis di PRASYARAT.sql", () => {
    const sh = baca("pasang-satker.sh");
    const harap = sh.match(/^HARAP='([^']+)'/m)![1];
    const ulang = sh.match(/^ULANG='([^']+)'/m)![1];
    const pra = baca(`${N}-PRASYARAT.sql`);
    expect(pra).toContain(`"${harap}" (pertama) atau "${ulang}" (pasang ulang)`);
    expect(harap).toMatch(/^0\|0\|6\|0\|0\|\d+\|0$/);
    expect(ulang).toMatch(/^0\|10\|0\|6\|6\|\d+\|0$/);
  });
});

describe("x9 - variabel baru dan cabang sisipan", () => {
  const pasang = baca(`${N}-PASANG.sql`);
  const baru = [...pasang.matchAll(/SELECT (\d+), 0x([0-9a-f]+), 'data_sql'[^;]*?, 0x([0-9a-f]+), NULL, NULL, 0, 'admin'/g)].map((m) => ({
    no: Number(m[1]),
    nama: Buffer.from(m[2], "hex").toString("latin1"),
    sql: Buffer.from(m[3], "hex").toString("latin1"),
  }));

  it("sepuluh variabel baru di jatah 3500-3549, tanpa nomor yang sudah dipakai ABT lama (3502-3506), nama <= 200 huruf", () => {
    expect(baru.map((b) => b.no)).toEqual([3507, 3508, 3509, 3510, 3511, 3512, 3513, 3514, 3515, 3516]);
    expect(baca("nomor-baru.txt").trim()).toBe(baru.map((b) => b.no).join(","));
    for (const b of baru) {
      expect(b.no).toBeGreaterThanOrEqual(3500);
      expect(b.no).toBeLessThanOrEqual(3549);
      expect(b.nama.length).toBeLessThanOrEqual(200);
      expect(b.sql).toMatch(/^SELECT aps_badilag\.isian_rtf_pihak_(utama|nama|urutan)\(#perkara_id#, [12], /);
    }
  });

  it("nama variabel baru tidak merujuk variabel lain selain #0046#/#0047# (ABT menyulih nama; rujukan ke 7047 dst membuat rekursi tak berujung)", () => {
    for (const b of baru) {
      const rujukan = [...b.nama.matchAll(/#(\d+)#/g)].map((m) => m[1]);
      for (const r of rujukan) expect(["0046", "0047"], `${b.no}: #${r}#`).toContain(r);
    }
  });

  it("tiap panggilan fungsi memakai fungsi yang dibuat paket dengan jumlah argumen yang benar", () => {
    const argumen: Record<string, number> = { utama: 5, nama: 4, urutan: 3 };
    for (const b of baru) {
      const m = b.sql.match(/isian_rtf_pihak_(utama|nama|urutan)\((.*)\) AS data$/)!;
      expect(m, String(b.no)).not.toBeNull();
      // pisah argumen di luar tanda kutip ganda
      const arg = m[2].match(/"[^"]*"|[^,\s][^,]*/g)!.map((s) => s.trim());
      expect(arg.length, String(b.no)).toBe(argumen[m[1]]);
    }
  });

  it("7047/7048/7097/7098: cabang baru ditaruh sebelum ELSE terakhir dan memanggil variabel baru; ELSE tetap kosong", () => {
    const peta: Record<number, { cabang: RegExp; panggil: string[] }> = {
      7047: { cabang: /WHEN p1\.urutan >= 5 THEN/, panggil: ["#3507#", "#3508#", "#8540#"] },
      7048: { cabang: /WHEN COALESCE\(p1\.urutan, 0\) >= 6 THEN/, panggil: ["#3509#", "#3510#", "#8541#"] },
      7097: { cabang: /WHEN p1\.urutan >= 6 THEN/, panggil: ["#3511#"] },
      7098: { cabang: /WHEN p1\.urutan >= 6 THEN/, panggil: ["#3512#"] },
    };
    for (const [no, p] of Object.entries(peta)) {
      const q = updateSql(pasang, Number(no));
      expect(q).toMatch(p.cabang);
      for (const t of p.panggil) expect(q).toContain(t);
      const iCabang = q.search(p.cabang);
      const iElse = q.search(/\n[ \t]*ELSE[ \t]*(?:""|'')[ \t]*\r?\n[ \t]*END AS data/);
      expect(iCabang).toBeGreaterThan(0);
      expect(iElse).toBeGreaterThan(iCabang);
      expect(q.match(/>= [56] THEN/g)).toHaveLength(1);
      expect(q).not.toContain("#7064#");
    }
  });

  it("dua salah cetak lama diperbaiki: koma kalimat kuasa 4 Pemohon (7047) dan 7097 dengan 2-3 Pemohon + kuasa", () => {
    const q47 = updateSql(pasang, 7047);
    expect(q47).toContain("Dalam hal ini #0046# I, #0046# II, #0046# III dan #0046# IV #8540#");
    expect(q47).not.toContain("#0046# I #0046# II");
    const q97 = updateSql(pasang, 7097);
    const i2 = q97.indexOf("WHEN p1.urutan = 2 THEN");
    const i3 = q97.indexOf("WHEN p1.urutan = 3 THEN");
    const i4 = q97.indexOf("WHEN p1.urutan = 4 THEN");
    const b2 = q97.slice(i2, i3);
    const b3 = q97.slice(i3, i4);
    expect(b2).not.toContain("#1033#</strong>");
    expect(b2).not.toMatch(/#0046# II;"/); // <strong> II tanpa penutup
    expect((b2.match(/#1033#, sebagai <strong>#0046# II<\/strong>;"/g) ?? []).length).toBe(2);
    // 3 Pemohon: kedua cabang (dengan dan tanpa kuasa) mencetak I, II dan III
    expect((b3.match(/#3111#, sebagai <strong>#0046# III<\/strong>;"/g) ?? []).length).toBe(2);
  });

  it("8710 dan 7054 kini memanggil fungsi tambahan (Turut Tergugat = perkara_pihak4, intervensi = perkara_pihak3)", () => {
    expect(updateSql(pasang, 8710)).toBe("SELECT aps_badilag.isian_rtf_pihak_tambahan(#perkara_id#, 4) AS data");
    expect(updateSql(pasang, 7054)).toBe("SELECT aps_badilag.isian_rtf_pihak_tambahan(#perkara_id#, 3) AS data");
  });

  it("PULIH menghapus nomor baru berpagar isi paket dan mengembalikan enam baris dari tabel x9_lama", () => {
    const pulih = baca(`${N}-PULIH.sql`);
    expect((pulih.match(/^DELETE FROM abt_variabel WHERE/gm) ?? []).length).toBe(10);
    expect((pulih.match(/^UPDATE abt_variabel a JOIN x9_lama l/gm) ?? []).length).toBe(6);
    expect(baca("nomor-ubah.txt").trim()).toBe("7047,7048,7054,7097,7098,8710");
  });
});
