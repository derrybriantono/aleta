// @vitest-environment node
/**
 * ============================================================================
 * AGEN U3 (20 Okt 2026) - PAKET ABT "abt-u3-itsbat-aua", DETEKSI, DAN PENANDA ISIAN
 * ============================================================================
 *
 * Dijaga:
 *   1. SQL paket sah dan konsisten: 14 variabel 4300-4315, PASANG/PERIKSA/PULIH saling cocok (md5), prasyarat menolak pasang ganda,
 *      kueri variabel data_sql hanya SELECT, tidak ada kata ALETA, MD5SUMS cocok dengan isi;
 *   2. RTF baru utuh (kurung seimbang), memakai variabel baru, dan varian satu Pemohon tidak menyisakan sebutan dua Pemohon;
 *   3. kueri variabel dijalankan SUNGGUHAN (baca saja) di SIPP lokal bila MariaDB lokal tersedia;
 *   4. deteksi posita: tempat/tanggal lahir anak tunggal, penetapan itsbat, alasan wali (ayah berada jauh);
 *   5. penanda isian manual/opsional untuk kode baru.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ISIAN_MANUAL, ISIAN_OPSIONAL } from "@/app/api/aleta-ecourt/blangko-derry/isian-metadata";

const REPO = path.resolve(process.cwd(), "..");
const PAKET = path.join(REPO, "abt-paket/u3-itsbat-aua/paket-satker");
const req = createRequire(import.meta.url);
const baca = (n: string) => readFileSync(path.join(PAKET, n), "utf8");
const md5 = (b: Buffer | string) => createHash("md5").update(b).digest("hex");
const hexKeTeks = (h: string) => Buffer.from(h.replace(/^0x/, ""), "hex").toString("latin1");

const PASANG = baca("abt-u3-itsbat-aua-PASANG.sql");
const PERIKSA = baca("abt-u3-itsbat-aua-PERIKSA.sql");
const PULIH = baca("abt-u3-itsbat-aua-PULIH.sql");
const PRASYARAT = baca("abt-u3-itsbat-aua-PRASYARAT.sql");

type Baris = { no: number; nama: string; tipe: string; sql: string | null; def: string | null };
function barisPasang(): Baris[] {
  const hasil: Baris[] = [];
  for (const l of PASANG.split("\n").filter((x) => x.startsWith("INSERT INTO abt_variabel"))) {
    const m = /VALUES \((\d+), (0x[0-9a-f]+), '(\w+)', NULL, NULL, NULL, NULL, (0x[0-9a-f]+|NULL), (0x[0-9a-f]+|NULL), NULL, 0, 'admin'\);$/.exec(l);
    if (!m) throw new Error(`INSERT tidak dikenal: ${l.slice(0, 120)}`);
    hasil.push({ no: Number(m[1]), nama: hexKeTeks(m[2]), tipe: m[3], sql: m[4] === "NULL" ? null : hexKeTeks(m[4]), def: m[5] === "NULL" ? null : hexKeTeks(m[5]) });
  }
  return hasil;
}
const B = barisPasang();

describe("SQL paket", () => {
  it("14 variabel baru di rentang klaim 4300-4399, tanpa baris lama disentuh", () => {
    expect(B.map((x) => x.no)).toEqual([4300, 4301, 4302, 4303, 4305, 4306, 4307, 4308, 4310, 4311, 4312, 4313, 4314, 4315]);
    for (const x of B) expect(x.no).toBeGreaterThanOrEqual(4300);
    expect(PASANG).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE)\b/i);
    expect(PASANG).toMatch(/START TRANSACTION;[\s\S]*COMMIT;/);
  });
  it("kueri data_sql hanya SELECT, nama tidak melebihi 200 huruf, tanpa kata ALETA", () => {
    for (const x of B) {
      expect(x.nama.length, `${x.no}`).toBeLessThanOrEqual(200);
      if (x.tipe === "data_sql") {
        expect(x.sql, `${x.no}`).toMatch(/^SELECT /);
        expect(x.sql, `${x.no}`).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REPLACE\s+INTO)\b/i);
        expect(x.sql, `${x.no}`).toContain(" AS data");
        expect(x.sql, `${x.no}`).not.toContain("\\");
      } else {
        expect(x.tipe).toBe("data_teks");
        expect(x.sql).toBeNull();
      }
      expect(`${x.nama} ${x.sql ?? ""} ${x.def ?? ""}`, `${x.no}`).not.toMatch(/aleta/i);
    }
    for (const x of B.filter((y) => [4300, 4305, 4314, 4315].includes(y.no))) expect((x.def ?? "").split("\r\n").length, `${x.no}`).toBeGreaterThanOrEqual(2);
  });
  it("PERIKSA dan PULIH memuat md5 yang sama dengan isi PASANG (pulih hanya menghapus baris yang masih persis paket)", () => {
    for (const x of B) {
      const md5Nama = md5(Buffer.from(x.nama, "latin1"));
      expect(PERIKSA, `${x.no}`).toContain(`MD5(nama)='${md5Nama}'`);
      expect(PULIH, `${x.no}`).toContain(`no_var=${x.no} AND MD5(nama)='${md5Nama}'`);
      if (x.sql) {
        const m = md5(Buffer.from(x.sql, "latin1"));
        expect(PERIKSA).toContain(`MD5(sql_query)='${m}'`);
        expect(PULIH).toContain(`MD5(sql_query)='${m}'`);
      }
    }
    expect(PULIH.match(/^DELETE FROM abt_variabel/gm)?.length).toBe(B.length);
    expect(PERIKSA.trim().split("\n").slice(-1)[0]).toContain("'SEMUA COCOK'");
    expect(PULIH).toContain("'PULIH COCOK'");
  });
  it("prasyarat menolak pasang ganda: rentang 4300-4399 harus kosong, jawaban harapan tertulis di berkas", () => {
    expect(PRASYARAT).toContain("BETWEEN 4300 AND 4399");
    expect(PRASYARAT).toMatch(/harus menjawab 0\|\d+\|5/);
    const sh = baca("pasang-satker.sh");
    expect(sh).toContain('[ "$p" = "$HARAP" ]');
    expect(sh).toContain("PULIH");
    // kata ALETA dilarang pada isi ABT (variabel, kueri, blangko); skrip pemasang hanya menyebut nama kontainer docker
    for (const s of [PASANG, PERIKSA, PULIH, PRASYARAT, baca("uji-kueri.tsv")]) expect(s).not.toMatch(/aleta/i);
  });
  it("uji-kueri.tsv memuat tepat kueri data_sql; MD5SUMS cocok dengan isi paket", () => {
    const baris = baca("uji-kueri.tsv").split("\n").filter((l) => l && !l.startsWith("#"));
    expect(baris.map((l) => Number(l.split("\t")[0]))).toEqual(B.filter((x) => x.tipe === "data_sql").map((x) => x.no));
    for (const l of baca("MD5SUMS.txt").split("\n").filter(Boolean)) {
      const [h, nama] = [l.slice(0, 32), l.slice(34)];
      expect(md5(readFileSync(path.join(PAKET, nama))), nama).toBe(h);
    }
  });
});

function semuaRtf(dir = path.join(PAKET, "rtf")): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? semuaRtf(p) : n.endsWith(".rtf") ? [p] : [];
  });
}
const teksRtf = (p: string) => readFileSync(p).toString("latin1");
const seimbang = (r: string) => {
  const s = r.replace(/\\\\/g, "").replace(/\\\{/g, "").replace(/\\\}/g, "");
  return s.split("{").length - s.split("}").length;
};

describe("RTF baru", () => {
  const berkas = semuaRtf();
  it("delapan berkas baru, kurung RTF seimbang, tanpa kata ALETA, terdaftar di daftar-rtf.tsv dengan md5 yang benar", () => {
    expect(berkas.length).toBe(8);
    const daftar = baca("daftar-rtf.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    expect(daftar.length).toBe(8);
    for (const [folder, nama, h] of daftar) expect(md5(readFileSync(path.join(PAKET, "rtf", folder, nama))), nama).toBe(h);
    for (const p of berkas) {
      const r = teksRtf(p);
      expect(seimbang(r), p).toBe(0);
      expect(r, p).not.toMatch(/aleta/i);
    }
  });
  it("[01d] memakai variabel dasar Pasal 7(3), kedudukan hukum, usia, dan wali; teks (e) tetap tidak tertanam", () => {
    const p = berkas.find((x) => x.includes("[01d]"))!;
    const r = teksRtf(p);
    for (const k of ["#4303#", "#4306#", "#4307#", "#4308#", "#4300#", "#4305#"]) expect(r, k).toContain(k);
    expect(r).not.toContain("patut dikabulkan karena telah memenuhi unsur yang terkandung dalam Pasal 7 ayat (3) huruf e");
    expect(r).toContain("Pasal 24 dan Pasal 25 Kompilasi Hukum Islam");
    expect(r).toContain("Pasal 27 Kompilasi Hukum Islam");
  });
  it("[01e] satu Pemohon: tanpa 'para #0046#' dan tanpa '#0046# II', memuat pasangan yang meninggal", () => {
    const r = teksRtf(berkas.find((x) => x.includes("[01e]"))!);
    expect(r).not.toMatch(/para #0046#|#0046# II|#0046# I\b/);
    expect(r).toContain("#2026# #1025#");
    expect(r).toContain("secara voluntair");
  });
  it("asal usul anak [01a][01b][01c] dan BAS: variabel baru terpasang, tanya jawab tabel diganti variabel katalog", () => {
    const a = teksRtf(berkas.find((x) => x.includes("[01a] [Kabul] AUA"))!);
    expect(a).toContain("#4313#");
    expect(a).toContain("Pasal 14 Kompilasi Hukum Islam");
    expect(teksRtf(berkas.find((x) => x.includes("[01b] [Kabul] AUA"))!)).toMatch(/#4311#[\s\S]*#4314#|#4314#[\s\S]*#4311#/);
    expect(teksRtf(berkas.find((x) => x.includes("[01c] [Kabul] AUA"))!)).toContain("#4315#");
    for (const p of berkas.filter((x) => /BAS ALUR/.test(x))) {
      const r = teksRtf(p);
      expect(r, p).toContain("#5058#");
      expect(r, p).toContain("#5059#");
      expect(r, p).not.toContain("Apakah saksi kenal dengan");
    }
  });
});

// ---- kueri nyata (baca saja) bila MariaDB lokal tersedia --------------------------------------------------------------------
const MYSQL = "D:/satker asal/website pa bungku/xampp/mysql/bin/mysql.exe";
function tanya(sql: string): string | null {
  try {
    return execFileSync(MYSQL, ["-h", "127.0.0.1", "-u", "root", "--default-character-set=latin1", "-N", "-B", "sipp_donggala", "-e", sql], { encoding: "latin1", timeout: 60000 }).trim();
  } catch {
    return null;
  }
}
const adaDb = existsSync(MYSQL) && tanya("SELECT 1") === "1" && tanya("SELECT COUNT(*) FROM perkara WHERE perkara_id=10041") === "1";
describe.skipIf(!adaDb)("kueri variabel dijalankan di SIPP lokal (baca saja)", () => {
  const q = (no: number, pid: number) => tanya(B.find((x) => x.no === no)!.sql!.replace(/#perkara_id#/g, String(pid)));
  it("4308: wali hakim bila status wali memuat 'hakim'; alasan dari isian 1357 tanpa koma depan", () => {
    const h = q(4308, 10041)!;
    expect(h).toContain("wali hakim");
    expect(h).toContain("Pasal 23 ayat (1)");
    expect(h).toMatch(/tidak menikahkan karena/);
  });
  it("4308: ayah kandung = wali nasab kelompok pertama (Pasal 21 ayat (1) dan Pasal 20 ayat (1) KHI)", () => {
    const h = q(4308, 10090)!;
    expect(h).toContain("kelompok kerabat laki-laki garis lurus ke atas");
    expect(h).toContain("Pasal 20 ayat (1)");
  });
  it("4303: bawaan huruf e untuk nikah sesudah 1974, tiga paragraf, kutipan Pasal 7 ayat (3) huruf e", () => {
    const h = q(4303, 10041)!;
    expect(h.split("<br>").length).toBeGreaterThanOrEqual(3);
    expect(h).toContain('yakni "Perkawinan yang dilakukan oleh mereka yang tidak mempunyai halangan perkawinan');
  });
  it("4306: dua Pemohon memakai 'para'; 4307: batas usia hanya bila umur dan tahun nikah memungkinkan", () => {
    expect(q(4306, 10041)!).toContain("para #0046# adalah suami istri");
    expect(q(4307, 10041)!).toBe("");
    expect(q(4307, 10090)!).toContain("sembilan belas tahun");
  });
  it("4312: nama anak dan tanggal lahir dari SIPP, beberapa anak dirangkai dengan 'dan'; 4313: jarak akad dengan kelahiran", () => {
    expect(q(4312, 10090)!).toBe("Al Fitrah bin Suryadi (lahir pada tanggal 21 Februari 2008), Nurul Amnah binti Suryadi (lahir pada tanggal 14 Desember 2009) dan Halifah binti Suryadi (lahir pada tanggal 1 Mei 2014)");
    expect(q(4313, 8866)!).toBe(", yaitu lebih dari enam bulan setelah akad nikah");
    expect(q(4313, 10090)!).toBe("");
  });
});

// ---- deteksi posita -----------------------------------------------------------------------------------------------------------
describe("deteksi posita asal usul anak dan itsbat", () => {
  const AU = req(path.join(REPO, "aleta_bot/services/deteksi/asalUsul.js"));
  it("9709: tempat dan tanggal lahir anak tunggal; beberapa anak tidak ditebak", () => {
    expect(AU.lahirAnak(["telah dikaruniai seorang anak yang bernama Iki Rafael bin Amir yang lahir di Tibo, pada hari Senin, tanggal 18 Agustus 2019"]).nilai).toBe("di Tibo pada tanggal 18 Agustus 2019");
    expect(AU.lahirAnak(["anak yang lahir pada tanggal 5 Mei 2020"]).nilai).toBe("pada tanggal 5 Mei 2020");
    expect(AU.lahirAnak(["a. Al Fitrah yang lahir di Donggala, pada tanggal 21 Februari 2008", "b. Nurul yang lahir di Donggala, pada tanggal 14 Desember 2009"])).toBeNull();
    expect(AU.lahirAnak(["pernikahan tanggal 28 Desember 2018"])).toBeNull();
  });
  it("9709 terbaca dari posita nyata 127/Pdt.P/2026 dan 150/Pdt.P/2026 lewat deteksi() (tanggal tertulis, tempat dari posita)", () => {
    const posita = "<p>4. Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun dan telah dikaruniai seorang anak yang bernama Iki Rafael bin Amir yang lahir di Tibo, pada hari Senin, tanggal 18 Agustus 2019;</p>";
    const h = AU.deteksi(posita, { petitum: "" });
    expect(h["9709"].nilai).toBe("di Tibo pada tanggal 18 Agustus 2019");
    expect(h["9709"].yakin).toBe("cukup");
  });
  it("4310: penetapan itsbat orang tua hanya dengan nomor perkara yang utuh dan berstatus 'ragu'", () => {
    expect(AU.penetapanItsbat(["pernikahan telah diitsbatkan berdasarkan Penetapan Pengadilan Agama Donggala Nomor 12/Pdt.P/2025/PA.Dgl tanggal 3 Maret 2025"]).nilai).toBe("Nomor 12/Pdt.P/2025/PA.Dgl tanggal 3 Maret 2025");
    expect(AU.penetapanItsbat(["pernikahan telah diitsbatkan oleh Pengadilan"])).toBeNull();
    const h = AU.deteksi("Bahwa pernikahan telah diitsbatkan berdasarkan Penetapan Pengadilan Agama Donggala Nomor 12/Pdt.P/2025/PA.Dgl tanggal 3 Maret 2025;", { petitum: "" });
    expect(h["4310"].yakin).toBe("ragu");
  });
  it("1357: ayah berada jauh/sakit/tidak diketahui keberadaannya terbaca dari posita itsbat nyata, ayah sebagai wali tidak", () => {
    const U = req(path.join(REPO, "aleta_bot/services/abtUsulanService.js"));
    const L = req(path.join(REPO, "aleta_bot/services/abtUsulanLainService.js"));
    const D = req(path.join(REPO, "aleta_bot/services/deteksiJenisPerkaraService.js"));
    const usul = (posita: string) => D.tambahUsulanJenis(L.saringUsulanItsbat(U.dariPositaItsbat(posita, { pemohon: "Pemohon", pemohon2: "" }), ""), posita, { jenisPerkara: "360" }).usulan.find((u: any) => u.kode === "1357");
    const p = (wali: string) =>
      `<p>1. Bahwa pada tanggal 3 Maret 2020 Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam di Desa Labuan, di wilayah hukum Kantor Urusan Agama Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah;</p><p>2. Bahwa pada saat pernikahan tersebut Pemohon I berstatus Perjaka dalam usia 21 tahun, dan Pemohon II berstatus Perawan dalam usia 19 tahun Pernikahan dilangsungkan dengan wali nikah yaitu ${wali} dan yang menikahkan adalah Hasan (Paman kandung Pemohon II), dan dihadiri saksi nikah bernama Sahlil dan Achmad Bahar , dengan mas kawin berupa uang Rp 110.000 dibayar tunai ;</p>`;
    expect(usul(p("Hasan (Paman kandung Pemohon II karena ayah kandung Pemohon II berada jauh sehingga menyerahkannya kepada Paman Pemohon II)"))?.nilai).toMatch(/^, karena ayah kandung Pemohon II berada jauh/);
    expect(usul(p("Samsul (Ayah Kandung Pemohon II)"))).toBeUndefined();
  });
});

describe("penanda isian manual dan opsional kode baru", () => {
  it("pilihan majelis wajib = manual; pilihan bernilai bawaan dan isian khusus keadaan = opsional; tidak tumpang tindih", () => {
    for (const k of ["4311", "4314", "4315"]) expect(ISIAN_MANUAL[k], k).toBeTruthy();
    for (const k of ["4300", "4301", "4302", "4305", "4310"]) expect(ISIAN_OPSIONAL[k], k).toBeTruthy();
    for (const k of Object.keys(ISIAN_OPSIONAL)) expect(ISIAN_MANUAL[k], k).toBeUndefined();
    for (const k of ["4311", "4314", "4315", "4300", "4301", "4302", "4305", "4310"]) expect(`${ISIAN_MANUAL[k] ?? ""}${ISIAN_OPSIONAL[k] ?? ""}`).not.toMatch(/aleta/i);
  });
});
