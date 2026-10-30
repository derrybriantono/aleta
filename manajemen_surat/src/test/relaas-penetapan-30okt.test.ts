// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/**
 * 30 Okt 2026 - paket ABT abt-paket/relaas-penetapan-30okt (blangko Derry 98 Relaas dan 99 PTSP):
 *  relaas/pemberitahuan: koma tunggal di bawah tanda tangan, "2026yang didaftarkan", "Nama NIK" tanpa koma, agama Tergugat tertulis
 *  mati "Islam", Penggugat "dapat mengajukan perlawanan (verzet)" + dasar Pasal 153 RBg untuk banding, tanggal relaas e-Court =
 *  tanggal penunjukan jurusita, relaas kepada kuasa tidak terbaca, panggilan ikrar "atas perintah ... tanggal PHS pokok", PA tujuan
 *  delegasi dari potongan alamat; penetapan hari sidang "membaca Penetapan Ketua Majelis" (PMH = Ketua Pengadilan).
 * Uji tanpa DB: keutuhan paket, tar = daftar-timpa, SQL hanya INSERT/DELETE bersyarat atas blok 11200-11219 (tidak ada variabel lama
 * yang diubah), tanpa kata nama aplikasi, tanpa nama satker tertulis mati, MariaDB 5.5 (tanpa REGEXP_REPLACE). Render php56 dan
 * siklus pasang/pulih: PASANG.md paket.
 */
const akar = path.resolve(process.cwd(), "..");
const dir = path.join(akar, "abt-paket/relaas-penetapan-30okt");
const pk = (b: string) => path.join(dir, "paket-satker", b);
const N = "abt-relaas-penetapan-30okt";
const baca = (b: string) => readFileSync(pk(b), "latin1");
const md5 = (s: string | Buffer) => createHash("md5").update(s).digest("hex");
const isi = JSON.parse(readFileSync(path.join(dir, "hasil/isi-paket.json"), "utf8")) as {
  variabel_baru: Record<string, { nama: string; md5: string }>;
  variabel_asal_md5: Record<string, string>;
  dirujuk: number[];
  timpa: { folder: string; berkas: string; md5_lama: string; md5_baru: string; aturan: string }[];
};
const nomorBaru = baca("nomor-baru.txt").split("\n").filter((l) => l && !l.startsWith("#")).map(Number);

const tanpaNul = (b: Buffer) => b.toString("latin1").split("\0")[0];

/** Isi berkas tar ustar -> nama -> isi. */
function bacaTar(b: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let i = 0;
  while (i + 512 <= b.length) {
    const h = b.subarray(i, i + 512);
    if (h.every((x) => x === 0)) break;
    const nama0 = tanpaNul(h.subarray(0, 100));
    const awalan = tanpaNul(h.subarray(345, 500));
    const ukuran = parseInt(tanpaNul(h.subarray(124, 136)).trim() || "0", 8);
    const data = b.subarray(i + 512, i + 512 + ukuran);
    i += 512 + Math.ceil(ukuran / 512) * 512;
    out.set(awalan ? `${awalan}/${nama0}` : nama0, Buffer.from(data));
  }
  return out;
}

/** Teks tampak kasar RTF (cukup untuk mencari penanda dan kalimat). */
const tampak = (rtf: string) =>
  rtf
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(par|line|cell|row)\b ?/g, "\n")
    .replace(/\\tab\b ?/g, "\t")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "");

const daftar = baca("daftar-timpa.tsv")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.split("\t"));
const tar = bacaTar(gunzipSync(readFileSync(pk("timpa.tgz"))));
const berkas = (sub: string) => {
  const k = [...tar.keys()].find((x) => x.includes(sub));
  expect(k, sub).toBeTruthy();
  return tampak(tar.get(k as string)!.toString("latin1"));
};

describe("paket ABT relaas-penetapan-30okt", () => {
  it("MD5SUMS cocok dengan isi paket", () => {
    const baris = baca("MD5SUMS.txt").split("\n").filter(Boolean);
    expect(baris.length).toBeGreaterThanOrEqual(12);
    for (const b of baris) {
      const [h, f] = b.split(/\s+\*?/);
      expect(md5(readFileSync(pk(f))), f).toBe(h);
    }
  });

  it("timpa.tgz = daftar-timpa.tsv (md5 baru), hanya 98 Relaas / 99 PTSP derry_briantono, tidak menyentuh daftar paket lain", () => {
    expect(daftar.length).toBe(isi.timpa.length);
    expect(tar.size).toBe(daftar.length);
    for (const [folder, b, lama, baru] of daftar) {
      expect(folder).toMatch(/^derry_briantono\/(98 Relaas|99 PTSP)$/);
      const data = tar.get(`timpa/${folder}/${b}`);
      expect(data, b).toBeTruthy();
      expect(md5(data as Buffer)).toBe(baru);
      expect(lama).not.toBe(baru);
    }
  });

  it("SQL hanya INSERT/DELETE bersyarat atas blok 11200-11219; tidak ada UPDATE variabel lama", () => {
    expect(nomorBaru.length).toBe(15);
    expect(nomorBaru.every((n) => n >= 11200 && n <= 11219)).toBe(true);
    const pasang = baca(`${N}-PASANG.sql`);
    expect(pasang).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bDROP\b|\bALTER\b/i);
    expect(pasang.match(/^INSERT INTO aps_badilag\.abt_variabel/gm)?.length).toBe(15);
    for (const n of nomorBaru) expect(pasang).toContain(`WHERE NOT EXISTS (SELECT 1 FROM aps_badilag.abt_variabel WHERE no_var = ${n})`);
    const pulih = baca(`${N}-PULIH.sql`);
    expect(pulih).not.toMatch(/\bUPDATE\b|\bINSERT\b|\bDROP\b/i);
    for (const n of nomorBaru) expect(pulih).toMatch(new RegExp(`DELETE FROM aps_badilag\\.abt_variabel WHERE no_var = ${n} AND MD5\\(`));
    expect(baca(`${N}-PRASYARAT.sql`)).toContain(`"0|0|${isi.dirujuk.length}|7"`);
    expect(baca(`${N}-PERIKSA.sql`)).toContain("SEMUA COCOK");
  });

  it("isi variabel baru (heksadesimal) tanpa kata aplikasi, tanpa satker tertulis mati, MariaDB 5.5", () => {
    const pasang = baca(`${N}-PASANG.sql`);
    const hex = [...pasang.matchAll(/0x([0-9a-f]+)/g)].map((m) => Buffer.from(m[1], "hex").toString("latin1"));
    expect(hex.length).toBe(30);
    const semua = hex.join("\n");
    expect(semua).not.toMatch(/aleta/i);
    expect(semua).not.toMatch(/donggala|bungku|morowali/i);
    expect(semua).not.toMatch(/REGEXP_REPLACE|ROW_NUMBER|\bWITH\s+\w+\s+AS\s*\(/i);
    for (const nama of Object.values(isi.variabel_baru).map((v) => v.nama)) expect(nama.length).toBeLessThanOrEqual(200);
    // perilaku yang diperbaiki
    expect(semua).toContain('CONCAT(IF("#1064#" = "", "...", "#1064#"), " yang didaftarkan secara elektronik');
    expect(semua).toContain('CONCAT(IF("#1099#" = "", "...", "#1099#"), " yang didaftarkan secara elektronik');
    expect(semua).toContain('"<strong>#0098#</strong>, NIK #0335#');
    expect(semua).toContain('umur #0103# tahun, agama ", IF("#0020#" = "", "...", "#0020#"), ",');
    expect(semua).not.toContain("agama Islam,");
    expect(semua).toContain("#0046# dapat mengajukan banding");
    expect(semua).not.toMatch(/#0046# dapat mengajukan #7007#/);
    expect(semua).toContain('IF(LOCATE(\'verzet\', "#7007#") > 0, "Pasal 153 ayat (1) RBg", "Pasal 199 ayat (1) RBg")');
    expect(semua).toContain("k.pengacara_id FROM perkara_pengacara k");
    expect(semua).toContain("FROM delegasi_keluar d");
  });

  it("blangko: penanda lama dialihkan, koma tunggal hilang, tanggal relaas/PHS ikrar/PMH benar", () => {
    const ptsp = berkas("@ 2 - PHS.rtf");
    expect(ptsp).toContain("membaca Penetapan #7051# #8008# Nomor");
    expect(ptsp).not.toContain("membaca Penetapan #0668#");
    const p0 = berkas("0. Relaas Panggilan Sidang Pertama P.rtf");
    expect(p0).toContain("#11205#");
    expect(p0).toContain("#11209#");
    expect(p0).not.toMatch(/#7078#,/);
    const t2 = berkas("2. Relaas Pemberitahuan Putusan T.rtf");
    expect(t2).toContain("#11208#");
    expect(t2).toContain("Tanggal #11204#");
    expect(t2).not.toMatch(/#7110#,|#7006#|#7100#/);
    const ikrar = berkas("4. Relaas Panggilan Ikrar Talak P dan T.rtf");
    expect(ikrar.match(/Tanggal #1099#/g)?.length).toBe(1);
    expect(ikrar).toContain("Tanggal #11214#");
    expect(ikrar).not.toContain("Tanggal #1064#");
    expect(berkas("5.1. Relaas Panggilan Sidang P (e-Court).rtf")).toContain("#8011#, #11200#");
    expect(berkas("7. Relaas Panggilan Ikrar Talak (e-Court).rtf")).toContain("#8011#, #11201#");
    const v62 = berkas("6.2. Relaas Pemberitahuan Putusan Verstek T (e-Court).rtf");
    expect(v62).toContain("umur #0103# tahun,");
    expect(v62).toContain("tanggal #1069# dalam");
    expect(v62).not.toMatch(/Melawan|kediaman Termohon;|#1278#/);
    const del = berkas("3.a. Permohonan Bantuan Panggilan Delegasi.rtf");
    expect(del).toContain("Ketua #11202#");
    expect(del).not.toContain("#1066#");
  });

  it("tidak ada blangko di daftar paket bas-tanya-jawab/prodeo yang disentuh, tanpa kata aplikasi di blangko", () => {
    for (const [, data] of tar) {
      const t = tampak(data.toString("latin1"));
      expect(t).not.toMatch(/aleta/i);
    }
    for (const t of isi.timpa) expect(t.folder).not.toMatch(/BAS|^1|^2|^3|^4|^5|^6|^7|^8|^9[0-7]/);
  });
});
