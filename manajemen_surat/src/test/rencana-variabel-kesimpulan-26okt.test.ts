// @vitest-environment node
import crypto from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { kunciTanyaJawab, susunIsian, type Definisi } from "@/app/api/aleta-ecourt/blangko-derry/susun";

/**
 * Rencana variabel tanya-jawab kesimpulan (G2, disiapkan 26 Okt 2026; BELUM dipasang di ABT mana pun).
 * Menjaga: (1) nama variabel yang direncanakan terbaca ALETA sebagai penyunting kesimpulan (kunci portal = pola ekstensi),
 * (2) kode 4950-4959 tidak bentrok dengan kamus dan paket lain, (3) berkas paket konsisten, hanya menyentuh abt_variabel,
 * tidak menyentuh baris atau blangko lama, dan MD5SUMS tidak basi.
 */

const AKAR = path.join(process.cwd(), "..");
const PAKET = path.join(AKAR, "abt-paket", "y1-kesimpulan-tanya-jawab-26okt", "paket-satker");
const P = "abt-y1-kesimpulan-tanya-jawab-26okt-";
const baca = (n: string) => readFileSync(path.join(PAKET, n), "latin1");

const NAMA = {
  4950: "Kesimpulan Lisan #0046#",
  4951: "Kesimpulan Lisan #0047#",
  4952: "Keterangan Kesimpulan Lisan #0046#",
  4953: "Keterangan Kesimpulan Lisan #0047#",
} as const;

describe("nama variabel terbaca ALETA sebagai penyunting kesimpulan", () => {
  it("kunciTanyaJawab: penyunting = tanyajawab, tampil = keterangan, kunci sama dan cocok pola ekstensi", () => {
    const polaEkstensi = readFileSync(path.join(AKAR, "ekstensi-sipp", "blangko-derry-isian.js"), "utf8").match(/POLA_KUNCI_KESIMPULAN = (\/.+\/);/);
    expect(polaEkstensi).toBeTruthy();
    const pola = new RegExp((polaEkstensi as RegExpMatchArray)[1].slice(1, -1));
    for (const [pihak, edit, tampil] of [
      ["0046", 4950, 4952],
      ["0047", 4951, 4953],
    ] as const) {
      const e = kunciTanyaJawab(NAMA[edit]);
      const t = kunciTanyaJawab(NAMA[tampil]);
      expect(e).toMatchObject({ kunci: `kesimpulan lisan ${pihak}`, peran: "tanyajawab" });
      expect(t).toMatchObject({ kunci: `kesimpulan lisan ${pihak}`, peran: "keterangan" });
      expect(pola.exec(e.kunci)?.[1]).toBe(pihak);
    }
  });

  it("susunIsian: blangko yang memuat #4952# mendapat tombol penyunting 4950 (blangko tanpa penanda tidak mendapat apa pun)", () => {
    const D = (kode: string, nama: string): [string, Definisi] => [kode, { kode, nama, jenis: "tanya_jawab", sql: "", bawaan: "" }];
    const katalog = new Map<string, Definisi>([D("4950", NAMA[4950]), D("4951", NAMA[4951]), D("4952", NAMA[4952]), D("4953", NAMA[4953])]);
    const dengan = susunIsian(["4952", "4953"], katalog).isian.filter((b) => b.jenis === "tj");
    expect(dengan.map((b) => [b.kode, b.tj?.kodeSunting, b.tj?.kunci])).toEqual([
      ["4952", "4950", "kesimpulan lisan 0046"],
      ["4953", "4951", "kesimpulan lisan 0047"],
    ]);
    expect(susunIsian([], katalog).isian.filter((b) => b.jenis === "tj")).toEqual([]);
  });
});

describe("kode 4950-4959 tidak bentrok", () => {
  it("tidak ada di kamus awal dan tidak diklaim paket ABT lain", () => {
    const kamus = JSON.parse(readFileSync(path.join(process.cwd(), "src", "server", "modules", "aleta-ecourt", "kamus-variabel-awal.json"), "utf8")) as { variabel: Array<{ k: string }> };
    const dalamJatah = kamus.variabel.map((v) => Number(v.k)).filter((k) => k >= 4950 && k <= 4959);
    expect(dalamJatah).toEqual([]);

    const akarPaket = path.join(AKAR, "abt-paket");
    const sql: string[] = [];
    const telusur = (dir: string) => {
      for (const nama of readdirSync(dir)) {
        const p = path.join(dir, nama);
        const s = statSync(p);
        if (s.isDirectory()) {
          if (/^(rtf|timpa|data|hasil|sumber|asli-server|salinan-server|katalog|contoh|untuk-sesi-utama|alat)/.test(nama)) continue;
          telusur(p);
        } else if (/PASANG\.sql$/i.test(nama) && !p.includes("y1-kesimpulan-tanya-jawab-26okt")) sql.push(p);
      }
    };
    telusur(akarPaket);
    expect(sql.length).toBeGreaterThan(5);
    const bentrok: string[] = [];
    for (const f of sql) {
      const isi = readFileSync(f, "latin1");
      for (const m of isi.matchAll(/INSERT INTO abt_variabel[^V]*VALUES \((\d{4,5}),/g)) {
        const no = Number(m[1]);
        if (no >= 4950 && no <= 4959) bentrok.push(`${path.basename(f)}:${no}`);
      }
    }
    expect(bentrok).toEqual([]);
  });
});

describe("berkas paket", () => {
  it("PASANG: prasyarat keras, satu transaksi, tepat empat INSERT...SELECT dari saudara, hanya abt_variabel, tanpa UPDATE/DELETE", () => {
    const isi = baca(P + "PASANG.sql");
    expect(isi).toContain("PRASYARAT GAGAL");
    expect(isi).toContain("BETWEEN 4950 AND 4959");
    expect(isi.indexOf("START TRANSACTION;")).toBeGreaterThan(isi.indexOf("PRASYARAT COCOK"));
    expect(isi).toContain("COMMIT;");
    const inserts = isi.split("\n").filter((b) => /^INSERT INTO /.test(b));
    expect(inserts).toHaveLength(4);
    for (const baris of inserts) {
      expect(baris).toMatch(/^INSERT INTO abt_variabel \(/);
      expect(baris).toMatch(/FROM abt_variabel WHERE no_var = (6113|6112|2019|2018);$/);
    }
    for (const [no, nama] of Object.entries(NAMA)) expect(isi).toContain(`SELECT ${no}, '${nama}', data_type`);
    expect(isi).not.toMatch(/^\s*(UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/im);
    expect(isi).not.toMatch(/\bFROM\s+(?!abt_variabel\b)\w+/i);
    expect(isi.toLowerCase()).not.toContain("aleta");
  });

  it("PULIH hanya menghapus jatah 4950-4959; PERIKSA memeriksa empat baris dan berujung SEMUA COCOK", () => {
    const pulih = baca(P + "PULIH-HAPUS-BARU.sql");
    expect(pulih.match(/DELETE FROM abt_variabel WHERE no_var BETWEEN 4950 AND 4959;/g)).toHaveLength(1);
    expect(pulih.match(/DELETE/g)).toHaveLength(1);
    const periksa = baca(P + "PERIKSA.sql");
    for (const [no, nama] of Object.entries(NAMA)) {
      expect(periksa).toContain(`v.no_var = ${no}`);
      expect(periksa).toContain(crypto.createHash("md5").update(nama, "latin1").digest("hex"));
    }
    expect(periksa).toContain("'SEMUA COCOK'");
    expect(periksa).not.toMatch(/^\s*(INSERT|UPDATE|DELETE)\b/im);
  });

  it("skrip pasang: cadang dulu, berhenti bila jatah terpakai, memulihkan bila PERIKSA tidak cocok; tidak menyentuh blangko", () => {
    const sh = baca("pasang-satker.sh");
    expect(sh.indexOf("mysqldump")).toBeGreaterThan(sh.indexOf("jatah 4950-4959 sudah terpakai"));
    expect(sh.indexOf("PASANG.sql")).toBeGreaterThan(sh.indexOf("mysqldump"));
    expect(sh).toContain('!= "SEMUA COCOK"');
    expect(sh).toContain("PULIH-HAPUS-BARU.sql");
    expect(sh).not.toMatch(/_blangko_abt|\.rtf/i);
    expect(baca("pulih-satker.sh")).not.toMatch(/_blangko_abt|\.rtf/i);
  });

  it("MD5SUMS cocok dengan isi berkas (tidak basi) dan semua berkas tercantum", () => {
    const daftar = baca("MD5SUMS.txt").trim().split("\n");
    const tercantum = new Set<string>();
    for (const baris of daftar) {
      const m = baris.match(/^([0-9a-f]{32}) {2}(.+)$/);
      expect(m, baris).toBeTruthy();
      const [, md5, nama] = m as RegExpMatchArray;
      tercantum.add(nama);
      expect(crypto.createHash("md5").update(readFileSync(path.join(PAKET, nama))).digest("hex"), nama).toBe(md5);
    }
    const ada = readdirSync(PAKET).filter((n) => n !== "MD5SUMS.txt");
    expect([...tercantum].sort()).toEqual(ada.sort());
    expect(existsSync(path.join(PAKET, "..", "PASANG.md"))).toBe(true);
  });
});
