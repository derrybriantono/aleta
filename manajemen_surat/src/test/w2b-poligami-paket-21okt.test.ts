// @vitest-environment node
/**
 * AGEN W2b-A (21 Okt 2026) - PAKET ABT keluarga perkawinan (variabel 4850-4864, blangko izin poligami)
 * Paket dibangun ulang dari sumber (sumber/bangun_paket.py) lalu diperiksa: jatah nomor, kueri hanya SELECT tanpa kata aplikasi,
 * RTF utuh, penanda tidak terpecah, penanda baru hanya milik paket, MD5SUMS cocok, daftar timpa bermd5 benar.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "../../..");
const AKAR = path.join(REPO, "abt-paket", "w2b-keluarga-lain");
const PAKET = path.join(AKAR, "paket-satker");
const NAMA = "abt-w2b-keluarga-lain";
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const semua = (akar: string): string[] => fs.readdirSync(akar, { withFileTypes: true }).flatMap((n) => (n.isDirectory() ? semua(path.join(akar, n.name)) : [path.join(akar, n.name)]));

const bangun = spawnSync("python", ["sumber/bangun_paket.py"], { cwd: AKAR, encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
const kueri = (sql: string, no: number) => {
  const m = new RegExp(`INSERT INTO abt_variabel \\(.*?\\) SELECT ${no}, 0x([0-9a-f]+), '(\\w+)', NULL, NULL, NULL, NULL, (NULL|0x[0-9a-f]+),`).exec(sql);
  return m ? { nama: Buffer.from(m[1], "hex").toString("latin1"), tipe: m[2], sql: m[3] === "NULL" ? "" : Buffer.from(m[3].slice(2), "hex").toString("latin1") } : null;
};
const seimbang = (raw: string) => {
  let d = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "\\") i += 1;
    else if (raw[i] === "{") d += 1;
    else if (raw[i] === "}" && --d < 0) return false;
  }
  return d === 0;
};

describe("paket keluarga perkawinan", () => {
  it("paket terbangun dari sumber", () => {
    expect(bangun.status, bangun.stderr).toBe(0);
    expect(fs.existsSync(path.join(PAKET, `${NAMA}-PASANG.sql`))).toBe(true);
  });
  it("MD5SUMS cocok dengan isi paket", () => {
    const baris = fs.readFileSync(path.join(PAKET, "MD5SUMS.txt"), "utf8").trim().split("\n");
    expect(baris.length).toBeGreaterThan(8);
    for (const b of baris) {
      const [h, p] = b.split("  ");
      expect(md5(fs.readFileSync(path.join(PAKET, p))), p).toBe(h);
    }
  });
  it("variabel keluarga A di jatah 4850-4879; kueri hanya SELECT; tanpa kata aplikasi dan tanpa garis miring terbalik", () => {
    const pasang = fs.readFileSync(path.join(PAKET, `${NAMA}-PASANG.sql`), "latin1");
    const dipakai = [4850, 4851, 4852, 4853, 4854, 4855, 4856, 4857, 4858, 4860, 4861, 4862, 4863, 4864];
    for (const no of dipakai) {
      const v = kueri(pasang, no);
      expect(v, String(no)).toBeTruthy();
      expect(v!.nama + v!.sql, String(no)).not.toMatch(/aleta/i);
      expect(v!.sql.includes("\\"), String(no)).toBe(false);
      if (v!.tipe === "data_sql") {
        expect(v!.sql, String(no)).toMatch(/^SELECT /);
        expect(v!.sql, String(no)).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i);
        expect(v!.sql, String(no)).not.toMatch(/\b(REGEXP_SUBSTR|JSON_|WITH )/i);
      } else expect(v!.tipe).toBe("data_teks");
    }
    for (const m of pasang.matchAll(/SELECT (\d+), 0x/g)) {
      const n = Number(m[1]);
      if (n >= 4850 && n <= 4879) expect(dipakai).toContain(n);
    }
  });
  it("blangko baru dan timpa: RTF utuh, penanda tidak terpecah, penanda baru hanya variabel milik paket, tanpa sisa isian mentah", () => {
    const berkas = semua(path.join(PAKET, "rtf")).concat(semua(path.join(PAKET, "timpa"))).filter((p) => p.endsWith(".rtf"));
    expect(berkas.length).toBe(5);
    for (const p of berkas) {
      const raw = fs.readFileSync(p, "latin1");
      expect(seimbang(raw), p).toBe(true);
      expect(raw, p).not.toMatch(/aleta/i);
      const teks = raw.replace(/\\'([0-9a-f]{2})/gi, "").replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/[{}]/g, "");
      const utuh = (raw.match(/#\d{4}#/g) || []).length;
      const tampak = (teks.match(/#\d{4}#/g) || []).length;
      expect(utuh, `penanda terpecah di ${p}`).toBeGreaterThanOrEqual(0);
      expect(tampak, `penanda terpecah di ${p}`).toBeLessThanOrEqual(utuh);
      for (const t of new Set(raw.match(/#4\d{3}#/g) || [])) {
        const n = Number(t.slice(1, 5));
        expect(n >= 4850 && n <= 4879, `${t} di ${p}`).toBe(true);
      }
    }
  });
  it("blangko baru memuat bagian yang dituju: verstek, Pasal 59 KHI, dan pertimbangan calon istri pada [01]", () => {
    const baca = (p: string) => fs.readFileSync(path.join(PAKET, p), "latin1");
    const dir = "rtf/derry_briantono/5 Izin Poligami";
    const a = baca(`${dir}/[01a] [Kabul Verstek] Izin Poligami - Termohon Tidak Hadir.rtf`);
    expect(a).toContain("#4863#");
    expect(a).toContain("secara verstek");
    expect(a).toContain("Pasal 149 ayat (1) RBg");
    const b = baca(`${dir}/[01b] [Kabul] Izin Poligami - Termohon Keberatan (Pasal 59 KHI).rtf`);
    expect(b).toContain("#4864#");
    expect(b).toContain("Pasal 59 Kompilasi Hukum Islam");
    const lama = baca("timpa/derry_briantono/5 Izin Poligami/[01] [Kabul] Izin Poligami.rtf");
    expect(lama).toContain("#4860#");
    expect(lama).toContain("#4861#");
    expect(lama).toContain("#4857#");
  });
  it("daftar timpa: md5 baru sama dengan berkas timpa, md5 lama = md5 server yang dicatat", () => {
    const baris = fs.readFileSync(path.join(PAKET, "daftar-timpa.tsv"), "utf8").split("\n").filter((b) => b && !b.startsWith("#"));
    expect(baris.length).toBe(1);
    const [folder, berkas, lama, baru] = baris[0].split("\t");
    expect(folder).toBe("derry_briantono/5 Izin Poligami");
    expect(md5(fs.readFileSync(path.join(PAKET, "timpa", folder, berkas)))).toBe(baru);
    expect(lama).toBe("6d8655b3110fb38cb267b71f6a60e638");
    expect(lama).not.toBe(baru);
  });
});
