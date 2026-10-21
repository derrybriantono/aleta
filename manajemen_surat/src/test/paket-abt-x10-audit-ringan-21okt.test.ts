// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 21 Okt 2026 (x10) - paket ABT abt-paket/x10-audit-ringan-21okt: temuan RINGAN audit variabel ABT (R2 R3 R4 R5 R6 R7 R8 R11).
 * Penjaga isi paket: berkas utuh (MD5SUMS), hanya UPDATE atas 26 baris abt_variabel (tanpa INSERT/DELETE/RTF), ASCII tanpa kata merek,
 * dan setiap perbaikan terpasang di SQL PASANG (dibaca sebagai teks hex kolom yang diubah).
 */
const dir = path.resolve(process.cwd(), "../abt-paket/x10-audit-ringan-21okt/paket-satker");
const baca = (f: string) => readFileSync(path.join(dir, f), "utf8");
const N = "abt-x10-audit-ringan-21okt";
const NOMOR_UBAH = [143, 212, 213, 228, 317, 328, 357, 1076, 1077, 1149, 3333, 6031, 6144, 6145, 6146, 6147, 6148, 6150, 6151, 7123, 7124, 7178, 7713, 8146, 8147, 18];

function hexKeTeks(h: string): string {
  return Buffer.from(h.replace(/^0x/i, ""), "hex").toString("latin1");
}

describe("x10 - paket ABT audit RINGAN", () => {
  it("MD5SUMS cocok dengan setiap berkas paket", () => {
    const baris = baca("MD5SUMS.txt").trim().split("\n");
    expect(baris.length).toBeGreaterThanOrEqual(9);
    for (const b of baris) {
      const [md5, nama] = b.split(/\s{2}/);
      const h = createHash("md5").update(readFileSync(path.join(dir, nama))).digest("hex");
      expect(h, nama).toBe(md5);
    }
  });

  it("nomor-ubah.txt = 26 baris yang diharapkan; tidak ada variabel baru", () => {
    expect(baca("nomor-ubah.txt").trim().split(",").map(Number).sort((a, b) => a - b)).toEqual([...NOMOR_UBAH].sort((a, b) => a - b));
    expect(baca("nomor-baru.txt").trim()).toBe("0");
  });

  it("PASANG: hanya UPDATE (26), tanpa INSERT/DELETE/DDL; hanya kolom sql_query/default_data; SQL hanya ASCII tanpa kata merek", () => {
    const pasang = baca(`${N}-PASANG.sql`);
    expect(pasang.match(/^UPDATE abt_variabel SET /gm)?.length).toBe(26);
    expect(pasang).not.toMatch(/^(INSERT|DELETE|DROP|ALTER|CREATE|REPLACE)\b/m);
    expect(pasang).not.toMatch(/SET (data_type|nama)\s*=/);
    for (const f of [`${N}-PASANG.sql`, `${N}-PRASYARAT.sql`, `${N}-PERIKSA.sql`, `${N}-PULIH.sql`, "uji-kueri.tsv"]) {
      const t = baca(f);
      expect(t, f).not.toMatch(/[^\x09\x0a\x20-\x7e]/);
      expect(t.toLowerCase(), f).not.toContain("aleta");
    }
    expect(baca(`${N}-PRASYARAT.sql`)).toContain('"0|0|26|0|14|0"');
  });

  it("isi baru tiap perbaikan terpasang (kolom diubah dibaca dari hex PASANG)", () => {
    const pasang = baca(`${N}-PASANG.sql`);
    const isi = new Map<number, string>();
    for (const m of pasang.matchAll(/^UPDATE abt_variabel SET (?:sql_query|default_data)=(0x[0-9A-Fa-f]+), modified='[^']+' WHERE \(no_var=(\d+) /gm)) {
      isi.set(Number(m[2]), hexKeTeks(m[1]));
    }
    expect(isi.size).toBe(26);
    // R3 total biaya: rujukan mati #0243# dibuang, komponen lain utuh
    expect(isi.get(143)).not.toContain("#0243#");
    expect(isi.get(143)).toContain("0#0242#");
    expect(isi.get(143)).toContain("0#0244#");
    // R5 tanpa view lambat v_pihak_perkara
    expect(isi.get(1076)).toContain("join perkara_pihak1 b");
    expect(isi.get(1077)).toContain("join perkara_pihak2 b");
    for (const n of [1076, 1077]) expect(isi.get(n)).not.toContain("v_pihak_perkara");
    // R4 hasil pasti
    for (const n of [18, 6031]) expect(isi.get(n)).toMatch(/order by a\.id\s+limit 1/);
    expect(isi.get(213)).toMatch(/order by id\s+limit 1/);
    expect(isi.get(212)).toMatch(/order by tanggal_penetapan desc, id\s+limit 1/);
    // R6 saksi keempat satu baris, saksi 1 T berurutan
    for (const n of [6144, 6145, 6146, 6147, 6148, 6151]) expect(isi.get(n)).toContain("limit 3,1");
    expect(isi.get(357)).toMatch(/order by a\.urutan\s+limit 0,1/);
    // R7 ejaan baku
    expect(isi.get(7178)).toContain("di luar batas antar");
    expect(isi.get(7178)).toContain("berada di tempat");
    expect(isi.get(228)).toContain("berada di luar kota");
    for (const n of [317, 328]) {
      expect(isi.get(n)).toContain("Undang-Undang Nomor 1 Tahun 1974");
      expect(isi.get(n)).not.toMatch(/Undang-undang|tahun 1974/);
    }
    // R8 tanpa nama pejabat/wilayah satker lain
    expect(isi.get(1149)).toBe("........");
    expect(isi.get(3333)).toBe("Kecamatan ..., Kabupaten ...");
    // R2 logika sama dengan #0046#/#0047# dan #7113#
    expect(isi.get(8146)).toContain("jenis_perkara_id=341");
    expect(isi.get(8147)).toContain("jenis_perkara_id=341");
    expect(isi.get(7713)).toContain("NOT LIKE '%Duplik Rekonvensi%'");
    // R11 #6150 sama dengan #8923#; 7123/7124 pakai agenda perbaikan berkurung
    expect(isi.get(6150)).toContain("saksi_pihak_ke=1 and perkara_id=#perkara_id# order by urutan limit 3,1");
    for (const n of [7123, 7124]) {
      expect(isi.get(n)).toContain("(rencana_agenda LIKE '%perbaikan%' AND rencana_agenda NOT LIKE '%rekonvensi%')");
      expect(isi.get(n)).not.toMatch(/OR\s+'%/);
    }
  });
});
