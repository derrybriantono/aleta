// @vitest-environment node
/**
 * 1 NOV 2026 - paket ABT abt-identitas-pihak-1nov (keputusan 101 dan 102, agen V, paket ke-31): format identitas pihak putusan/penetapan = blangko acuan
 * "[01] [Kabul Verstek] Cerai (Format Lengkap)": baris pertama menjorok 1,25 cm, baris lanjutan menjorok gantung 4,5 cm, rata kanan-kiri, nama dan sebutan tebal,
 * "(N tahun)" sesudah tanggal lahir, urutan agama-pendidikan-pekerjaan, kalimat kuasa tanpa koma sebelum "yang telah didaftarkan".
 * Yang dijaga dari isi paket SUNGGUHAN (penulisan ke blangko dan variabel ABT, jadi ketat):
 *   - MD5SUMS cocok; md5 lama != baru; kode unik; tanpa folder terhapus; tanpa kata nama aplikasi; skrip tanpa CRLF;
 *   - perilaku potongan: golongan A/C hanya mengganti tiga angka menjorok (selebihnya persis), golongan B mengganti paragraf identitas tertulis tangan dengan
 *     #7047#/#7048# (tanpa tulisan "(umur)"), pasangan Pemohon II dibuang hanya sesudah Pemohon I yang diganti; kurung seimbang;
 *   - SQL: 7047/7048 diubah hanya bila md5 persis dasar, kueri baru satu jalan lewat fungsi identitas (penanda hanya sebutan dan kalimat kuasa), PULIH membalik;
 *   - fungsi: umur dalam kurung, pendidikan sebelum pekerjaan, kalimat kuasa tanpa koma, tanpa komentar -- di badan, definisi lama = keadaan server.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const DIR = path.join(AKAR, "abt-paket/identitas-pihak-1nov/paket-satker");
const baca = (b: string) => readFileSync(path.join(DIR, b), "utf8");
const bacaL = (b: string) => readFileSync(path.join(DIR, b)).toString("latin1");
const dekode = (b: string) => Buffer.from(b, "base64").toString("latin1");
const DAFTAR = baca("daftar-tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const TAMBAL = baca("tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
type Potong = { kode: string; off: number; lama: string; baru: string };
const potong: Potong[] = TAMBAL.map(([kode, off, lama, baru]) => ({ kode, off: Number(off), lama: dekode(lama), baru: dekode(baru) }));
const per = new Map<string, Potong[]>();
for (const p of potong) per.set(p.kode, [...(per.get(p.kode) ?? []), p]);

/** teks polos paragraf (sama dengan rtf_identitas.teks di pembangun). */
function teks(seg: string): string {
  return seg
    .replace(/\{\\listtext[^]*?\}/g, "")
    .replace(/\\'[0-9a-fA-F]{2}/g, "?")
    .replace(/\\tab/g, " ")
    .replace(/\\par(?![a-z])/g, " ")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const seimbang = (s: string) => {
  let d = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === "\\") i += 1;
    else if (s[i] === "{") d += 1;
    else if (s[i] === "}") {
      d -= 1;
      if (d < 0) return false;
    }
  }
  return d === 0;
};
const angkaMenjorok = (s: string) => s.replace(/\\fi-?\d+(?![0-9a-z])/, "\\fiN").replace(/\\lin\d+(?![0-9a-z])/, "\\linN").replace(/\\li\d+(?![0-9a-z])/, "\\liN");

const golA = potong.filter((p) => !p.lama.includes("{") && p.baru !== "");
const golB = potong.filter((p) => p.lama.includes("{") && p.baru !== "");
const hapus = potong.filter((p) => p.baru === "");

describe("isi paket sungguhan - berkas", () => {
  it("MD5SUMS cocok; berkas ber-md5 lama != baru; kode unik; tanpa terhapus; skrip tanpa CRLF; tanpa nama aplikasi", () => {
    for (const baris of baca("MD5SUMS.txt").trim().split(/\r?\n/)) {
      const [md5, nama] = baris.split(/\s+\*?/);
      expect(createHash("md5").update(readFileSync(path.join(DIR, nama))).digest("hex"), nama).toBe(md5);
    }
    expect(DAFTAR.length).toBeGreaterThan(500);
    expect(new Set(DAFTAR.map((d) => d[0])).size).toBe(DAFTAR.length);
    for (const d of DAFTAR) {
      expect(d[1]).toMatch(/^derry_briantono\/.+\.rtf$/);
      expect(d[1]).not.toMatch(/terhapus/);
      expect(d[2]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[3]).toMatch(/^[0-9a-f]{32}$/);
      expect(d[2]).not.toBe(d[3]);
      expect(per.get(d[0])?.length, d[1]).toBe(Number(d[4]));
    }
    expect(TAMBAL.length).toBe(DAFTAR.reduce((n, d) => n + Number(d[4]), 0));
    for (const sh of ["pasang-satker.sh", "pulih-satker.sh"]) expect(baca(sh)).not.toMatch(/\r\n/);
    for (const p of potong) expect(p.lama + p.baru).not.toMatch(/aleta/i);
    for (const b of ["abt-identitas-pihak-1nov-FUNGSI.sql", "abt-identitas-pihak-1nov-PASANG.sql", "abt-identitas-pihak-1nov-PULIH.sql", "abt-identitas-pihak-1nov-PERIKSA.sql"]) expect(baca(b)).not.toMatch(/aleta/i);
  });

  it("jumlah potongan per golongan: A (menjorok), B (tertulis tangan -> variabel), pasangan Pemohon II dibuang", () => {
    expect(golA.length).toBeGreaterThan(900);
    expect(golB.length).toBe(120);
    expect(hapus.length).toBe(22);
  });
});

describe("isi paket sungguhan - perilaku potongan blangko", () => {
  it("golongan A dan C: hanya tiga angka menjorok yang berubah; hasilnya persis acuan (\\fi-1843 \\li2552 \\lin2552), rata kanan-kiri, jarak 1,5", () => {
    for (const p of golA) {
      expect(p.lama.startsWith("\\pard")).toBe(true);
      expect(angkaMenjorok(p.baru)).toBe(angkaMenjorok(p.lama));
      expect(p.baru).toMatch(/\\fi-1843(?![0-9])/);
      expect(p.baru).toMatch(/\\li2552(?![0-9])/);
      expect(p.baru).toMatch(/\\lin2552(?![0-9])/);
      expect(p.baru).toMatch(/\\qj(?![a-z])/);
      expect(p.baru).toMatch(/\\sl360 ?\\slmult1/);
      expect(p.lama).not.toMatch(/\\fi-1843(?![0-9])[^]*\\li2552(?![0-9])[^]*\\lin2552(?![0-9])/);
    }
  });

  it("golongan B: paragraf tertulis tangan (nama, NIK, 'tempat dan tanggal lahir (umur)', ...) diganti SATU penanda #7047#/#7048# dengan properti acuan; kurung seimbang", () => {
    for (const p of golB) {
      const lamaT = teks(p.lama);
      expect(lamaT, "teks lama harus identitas tertulis tangan").toMatch(/^#\d{4}#, NIK #03\d\d#, tempat dan tanggal lahir \(umur\) .*, sebagai #0046# ?(I|II)?;$|^#\d{4}#, NIK #03\d\d#, tempat dan tanggal lahir \(umur\) .*, sebagai #0047#;$/);
      expect(teks(p.baru)).toMatch(/^#(7047|7048)#$/);
      expect(p.baru).not.toMatch(/\(umur\)/);
      expect(p.baru).toMatch(/\\fi-1843(?![0-9])/);
      expect(p.baru).toMatch(/\\li2552(?![0-9])/);
      expect(p.baru).toMatch(/\\par/);
      expect(seimbang(p.lama)).toBe(true);
      expect(seimbang(p.baru)).toBe(true);
      // sisi Tergugat memakai 7048, sisi Penggugat/Pemohon 7047
      expect(lamaT.includes("sebagai #0047#") ? "#7048#" : "#7047#").toBe(teks(p.baru));
    }
  });

  it("pasangan Pemohon II dibuang HANYA bila tepat sesudah paragraf Pemohon I yang diganti #7047# (dispensasi kawin)", () => {
    for (const h of hapus) {
      expect(teks(h.lama)).toMatch(/^#1033#, NIK #0336#, tempat dan tanggal lahir \(umur\) #0342#, #0346# \(#1034# tahun\), .*sebagai #0046# II;$/);
      const sama = per.get(h.kode)!;
      const sebelum = sama.find((x) => x.off + x.lama.length === h.off);
      expect(sebelum, "paragraf Pemohon I berimpit tepat di depannya").toBeTruthy();
      expect(teks(sebelum!.lama)).toMatch(/sebagai #0046# I;$/);
      expect(teks(sebelum!.baru)).toBe("#7047#");
    }
  });

  it("tiap berkas: potongan tidak bertumpuk, neraca kurung tidak berubah", () => {
    for (const [kode, ps] of per) {
      const urut = [...ps].sort((a, b) => a.off - b.off);
      urut.forEach((p, i) => {
        if (i > 0) expect(urut[i - 1].off + urut[i - 1].lama.length, kode).toBeLessThanOrEqual(p.off);
      });
      for (const p of urut) expect(seimbang(p.baru) === seimbang(p.lama), kode).toBe(true);
    }
  });
});

describe("isi paket sungguhan - SQL variabel", () => {
  const pra = baca("abt-identitas-pihak-1nov-PRASYARAT.sql");
  const pasang = baca("abt-identitas-pihak-1nov-PASANG.sql");
  const pulih = baca("abt-identitas-pihak-1nov-PULIH.sql");
  const harap = baca("harap.txt").trim().split("\n");

  it("PRASYARAT: harapan pertama 2|0|2|0|0|6, ulang 0|2|0|2|0|6; hanya 7047 dan 7048 diubah", () => {
    expect(harap).toEqual(["2|0|2|0|0|6", "0|2|0|2|0|6"]);
    expect(baca("nomor-diubah.txt").trim()).toBe("7047,7048");
    expect(pra).toMatch(/no_var=7047/);
    expect(pra).toMatch(/no_var=7048/);
    expect(pra).not.toMatch(/no_var=(8540|8541|9230|9231)/);
  });

  it("PASANG: dua UPDATE, tiap-tiapnya hanya bila md5 lama persis; kueri baru satu jalan lewat fungsi identitas, tanpa penanda data pihak", () => {
    const upd = pasang.split("\n").filter((l) => l.startsWith("UPDATE abt_variabel"));
    expect(upd.length).toBe(2);
    for (const u of upd) {
      expect(u).toMatch(/WHERE \(no_var=70(47|48) AND MD5\(nama\)='[0-9a-f]{32}' AND data_type='data_sql' AND MD5\(sql_query\)='[0-9a-f]{32}'\)/);
      const hex = /sql_query=0x([0-9a-f]+),/.exec(u)![1];
      const q = Buffer.from(hex, "hex").toString("latin1");
      expect(createHash("md5").update(Buffer.from(hex, "hex")).digest("hex")).toMatch(/^[0-9a-f]{32}$/);
      expect(q).toMatch(/aps_badilag\.isian_rtf_identitas_kosong\(x\.data\)/);
      expect(q).toMatch(/aps_badilag\.isian_rtf_pihak_identitas\(#perkara_id#, [12], "#004[67]#", "tempat kediaman di"/);
      const penandaAngka = [...new Set((q.match(/#\d{3,5}#/g) ?? []))].sort();
      expect(penandaAngka).toEqual(q.includes("#0046#") ? ["#0046#", "#8540#"] : ["#0047#", "#8541#"]);
      expect(q).not.toMatch(/CURDATE|NOW\(\)/i);
      expect(q).not.toMatch(/CASE|\(umur\)/);
    }
    expect(pasang).toMatch(/START TRANSACTION;[^]*COMMIT;/);
  });

  it("PULIH: variabel dikembalikan hanya bila masih isi baru dan cadangan masih isi lama", () => {
    const upd = pulih.split("\n").filter((l) => l.startsWith("UPDATE abt_variabel a JOIN pu_lama l"));
    expect(upd.length).toBe(2);
    for (const u of upd) expect(u).toMatch(/WHERE \(a\.no_var=70(47|48) [^]*\) AND \(l\.no_var=70(47|48) /);
  });
});

describe("isi paket sungguhan - fungsi", () => {
  const fungsi = bacaL("abt-identitas-pihak-1nov-FUNGSI.sql");
  const lama = bacaL("abt-identitas-pihak-1nov-FUNGSI-LAMA.sql");
  const blok = (t: string, nama: string) => new RegExp(`CREATE FUNCTION ${nama}\\([^]*?\\nEND\\$\\$`).exec(t)![0];
  const identitas = blok(fungsi, "isian_rtf_pihak_identitas");
  const tambahan = blok(fungsi, "isian_rtf_pihak_tambahan");

  it("isian_rtf_pihak_identitas: umur dalam kurung sesudah tanggal lahir, agama-pendidikan-pekerjaan, kuasa tanpa koma; tanpa komentar -- di badan", () => {
    expect(identitas).toMatch(/isian_rtf_tanggal\(v_tgl\), v_umur,\n\s+', agama ', IFNULL\(v_agama, ''\), ', pendidikan ', IFNULL\(v_pendidikan, ''\), ', pekerjaan ', IFNULL\(v_pekerjaan, ''\)/);
    expect(identitas).toMatch(/' \(', YEAR\(v_daftar\) - YEAR\(v_tgl\) - \(DATE_FORMAT\(v_daftar, '%m%d'\) < DATE_FORMAT\(v_tgl, '%m%d'\)\), ' tahun\)'/);
    expect(identitas).toMatch(/REPLACE\(TRIM\(IFNULL\(p_kuasa, ''\)\), ', yang telah didaftarkan', ' yang telah didaftarkan'\)/);
    expect(identitas).not.toMatch(/\n\s*--/);
    expect(identitas).toMatch(/FROM SIPP\.perkara WHERE perkara_id = p_perkara LIMIT 1/);
  });

  it("isian_rtf_pihak_tambahan: umur dan pendidikan ikut (bagian kosong tetap dilewati); definisi lama tersimpan utuh di -FUNGSI-LAMA", () => {
    expect(tambahan).toMatch(/isian_rtf_tanggal\(v_tgl\), v_umur\)\)/);
    expect(tambahan).toMatch(/CONCAT\(', pendidikan ', TRIM\(v_pend\)\)/);
    expect(tambahan.indexOf("', pendidikan '")).toBeLessThan(tambahan.indexOf("', pekerjaan '"));
    expect(tambahan).not.toMatch(/\n\s*--/);
    expect(lama).toMatch(/', pekerjaan ', IFNULL\(v_pekerjaan, ''\), ', pendidikan ', IFNULL\(v_pendidikan, ''\)/);
    expect(lama).not.toMatch(/v_umur/);
    expect(lama).toMatch(/CREATE FUNCTION isian_rtf_pihak_identitas/);
    expect(lama).toMatch(/CREATE FUNCTION isian_rtf_pihak_tambahan/);
  });
});
