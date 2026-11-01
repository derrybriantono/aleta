// @vitest-environment node
/**
 * 1 NOV 2026 - paket ABT abt-tanya-jawab-format-1nov (keputusan 85, 86, 89-B1): SEMUA tanya jawab tertulis tangan di blangko BAS/putusan Derry
 * dibentuk seperti keluaran ABT (kolom_kode_A4): pertanyaan kiri, jawaban di bawahnya kanan diawali "- ", lebar 4250/8500;
 * "Susunan majelis ... sama dengan sidang yang lalu;" (teks biasa) -> #5404#; #5404# diganti kueri RINGAN + variabel baru #12120#;
 * bagian Tergugat BAS ALUR 05 [3a] memakai sebutan #0047#.
 * Yang dijaga dari isi paket SUNGGUHAN (penulisan ke blangko dan variabel ABT, jadi ketat):
 *   - MD5SUMS cocok; md5 lama != baru; kode unik; tanpa folder terhapus; tanpa kata nama aplikasi;
 *   - perilaku: tiap potongan tabel diterapkan -> teks pertanyaan/jawaban SAMA, penanda #nnnn# SAMA, kurung seimbang, tanda "- " di tiap jawaban,
 *     seluruh sel 4250/8500, tanpa garis tabel, baris selang-seling irow0/irow1 (persis kode ABT);
 *   - potongan sebutan pihak HANYA menukar #0046#/#0047# di bagian Tergugat; potongan 5404 HANYA mengganti kalimat/inden paragraf itu;
 *   - SQL: #5404# hanya diubah bila md5 persis dasar, #12120# baru; kueri tanpa CURDATE(); kueri ringan memanggil #12120#; PULIH membalik.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const DIR = path.join(AKAR, "abt-paket/tanya-jawab-format-1nov/paket-satker");
const baca = (b: string) => readFileSync(path.join(DIR, b), "utf8");
const dekode = (b: string) => Buffer.from(b, "base64").toString("latin1");
const DAFTAR = baca("daftar-tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const TAMBAL = baca("tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
const per = new Map<string, { off: number; lama: string; baru: string }[]>();
for (const [kode, off, lama, baru] of TAMBAL) {
  const a = per.get(kode) ?? [];
  a.push({ off: Number(off), lama: dekode(lama), baru: dekode(baru) });
  per.set(kode, a);
}
const semuaPotongan = [...per.values()].flat();
const tabel = semuaPotongan.filter((p) => p.lama.includes("\\trowd") || p.baru.includes("\\trowd"));
const lima404 = semuaPotongan.filter((p) => p.baru.includes("#5404#"));
const pihak = semuaPotongan.filter((p) => /^#004[67]#$/.test(p.lama) && /^#004[67]#$/.test(p.baru));

/** Teks tampak kasar: buang kode kendali RTF dan kurung; "\cell" jadi pemisah. */
function teksSel(rtf: string): string[] {
  return rtf
    .split(/\\cell(?![a-zA-Z])/)
    .map((s) => s.replace(/\\trowd[^]*?\\row(?![a-z])/g, " ").replace(/\\par(?![a-z])/g, " ").replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/\\'[0-9a-f]{2}/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim())
    .filter((s) => s !== "");
}
const penanda = (s: string) => (s.match(/#\d{3,5}#/g) ?? []).sort();
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

describe("isi paket sungguhan - berkas", () => {
  it("MD5SUMS cocok; berkas ber-md5 lama != baru; kode unik; tanpa terhapus; skrip tanpa CRLF", () => {
    for (const baris of baca("MD5SUMS.txt").trim().split(/\r?\n/)) {
      const [md5, nama] = baris.split(/\s+\*?/);
      expect(createHash("md5").update(readFileSync(path.join(DIR, nama))).digest("hex"), nama).toBe(md5);
    }
    expect(DAFTAR.length).toBe(586);
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
  });

  it("jumlah potongan: 1475 tabel tanya jawab, 98 susunan majelis -> #5404#, 3 berkas sebutan pihak; tanpa nama aplikasi", () => {
    expect(tabel.length).toBe(1475);
    expect(lima404.length).toBe(98);
    expect(pihak.length).toBe(3 * 6);
    for (const p of semuaPotongan) expect(p.lama + p.baru).not.toMatch(/aleta/i);
  });
});

describe("isi paket sungguhan - perilaku potongan tabel", () => {
  it("tiap tabel baru: teks & penanda sama, kurung seimbang, lebar ABT 4250/8500, tanpa garis, selang-seling pertanyaan/jawaban, jawaban diawali '- '", () => {
    let jawab = 0;
    for (const p of tabel) {
      expect(seimbang(p.baru)).toBe(true);
      expect(penanda(p.baru)).toEqual(penanda(p.lama));
      // lebar: hanya 4250 dan 8500; tidak ada garis (trbrdr, clbrdr)
      const lebar = [...p.baru.matchAll(/\\cellx(\d+)/g)].map((m) => m[1]);
      expect(new Set(lebar)).toEqual(new Set(["4250", "8500"]));
      expect(p.baru).not.toMatch(/\\trbrdr|\\clbrdr|\\brdrs/);
      // baris persis kode ABT: pertanyaan = irow0 (boleh beberapa berturut-turut, mis. "Kepada ..." lalu pertanyaan), jawaban = irow1\lastrow selalu menyusul pertanyaan
      const urut = [...p.baru.matchAll(/\\irow(\d)(?:\\irowband\d)?(\\lastrow)?/g)].map((m) => m[1] + (m[2] ? "L" : ""));
      expect(urut.length).toBeGreaterThan(1);
      urut.forEach((u, i) => {
        expect(["0", "1L"]).toContain(u);
        if (u === "1L") expect(urut[i - 1], "jawaban harus didahului pertanyaan").toBe("0");
      });
      expect(urut[0]).toBe("0");
      // teks lama (tanpa tanda) == teks baru tanpa "- "
      const lamaT = teksSel(p.lama);
      const baruT = teksSel(p.baru).filter((t) => t !== "-");
      expect(baruT).toEqual(lamaT);
      // tiap baris jawaban punya sel kiri "- " rata kanan (\qr\ri100) diikuti sel kanan rata kanan-kiri (\qj)
      const jwb = [...p.baru.matchAll(/\\qr\\ri100\\sl360\\slmult1 \{[^{}]*- \}\\cell\\pard\\intbl\\widctlpar\\qj\\sl360\\slmult1 /g)];
      expect(jwb.length).toBe(urut.filter((u) => u === "1L").length);
      jawab += jwb.length;
    }
    expect(jawab).toBeGreaterThan(2000);
  });

  it("contoh bentuk blangko sungguhan (Kepada Penggugat / Apakah ada perubahan / Tidak ada perubahan): satu baris tanya, satu baris jawab", () => {
    const p = tabel.find((x) => teksSel(x.lama).join("|").startsWith("Kepada #0046#;|Apakah ada perubahan pada #0053# yang saudara ajukan?|Tidak ada perubahan"))!;
    expect(p).toBeTruthy();
    expect(teksSel(p.baru).filter((t) => t !== "-")).toEqual(["Kepada #0046#;", "Apakah ada perubahan pada #0053# yang saudara ajukan?", "Tidak ada perubahan, mohon dilanjutkan;"]);
    expect(p.baru.match(/\\irow0/g)?.length).toBe(2);
    expect(p.baru.match(/\\irow1\\irowband1\\lastrow/g)?.length).toBe(1);
  });
});

describe("isi paket sungguhan - susunan majelis dan sebutan pihak", () => {
  it("potongan #5404#: kalimat tetap diganti penanda (tanpa mengubah huruf lain) + paling banyak satu potongan inden paragraf (inden baris pertama positif, kiri 0)", () => {
    for (const p of lima404) {
      expect(p.lama.replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/[{}]/g, ""), "kalimat tetap").toBe("Susunan majelis yang bersidang sama dengan sidang yang lalu;");
      expect(p.baru).toMatch(/^(\{(\\[a-zA-Z]+-?\d* ?)*)?#5404#\}?$/);
    }
    for (const d of DAFTAR) {
      const ps = per.get(d[0])!;
      const inden = ps.filter((x) => /^\\pard/.test(x.lama) && !x.lama.includes("\\trowd"));
      expect(inden.length, d[1]).toBeLessThanOrEqual(1);
      if (ps.some((x) => x.baru.includes("#5404#"))) {
        for (const f of inden) {
          expect(f.lama).toMatch(/\\fi-?\d+/);
          expect(f.baru).not.toMatch(/\\fi-\d/);
          expect(f.baru).toMatch(/\\fi[1-9]\d*\s?\\li0/);
          expect(f.baru).not.toMatch(/[{}#]/);
        }
      }
    }
    expect(DAFTAR.filter((d) => per.get(d[0])!.some((x) => x.baru.includes("#5404#"))).length).toBe(98);
  });

  it("sebutan pihak ALUR 05 [3a]: 6 penukaran per berkas, hanya #0046# <-> #0047#", () => {
    const berkas = DAFTAR.filter((d) => /ALUR 05.*\[3a\]/.test(d[1]));
    expect(berkas.length).toBe(3);
    for (const d of berkas) {
      const p = per.get(d[0])!.filter((x) => /^#004[67]#$/.test(x.lama));
      expect(p.length, d[1]).toBe(6);
      for (const x of p) expect(x.baru).toBe(x.lama === "#0046#" ? "#0047#" : "#0046#");
      // urutan tukar: 47 (L58), 46 & 47 (L59 tukar), 47 (L60), 47 (L61), 47 (L77)
      expect(p.map((x) => x.baru.slice(3, 5)).join(",")).toBe("47,46,47,47,47,47");
    }
  });
});

describe("isi paket sungguhan - SQL variabel", () => {
  const sqlPasang = baca("abt-tanya-jawab-format-1nov-PASANG.sql");
  const sqlPulih = baca("abt-tanya-jawab-format-1nov-PULIH.sql");
  const sqlPras = baca("abt-tanya-jawab-format-1nov-PRASYARAT.sql");
  const sqlPeriksa = baca("abt-tanya-jawab-format-1nov-PERIKSA.sql");

  it("PASANG: satu transaksi, HANYA #5404# diubah dan hanya bila md5 persis dasar; PULIH membalik; tanpa variabel/menu baru; tanpa nama aplikasi", () => {
    expect(sqlPasang).toMatch(/START TRANSACTION;\s*UPDATE abt_variabel SET sql_query = 0x[0-9a-f]+ WHERE no_var = 5404 AND MD5\(IFNULL\(sql_query, ''\)\) = '[0-9a-f]{32}' AND MD5\(nama\) = '[0-9a-f]{32}';\s*COMMIT;/);
    expect(sqlPasang).not.toMatch(/INSERT INTO|DELETE FROM|CREATE|DROP/);
    expect(sqlPulih).toMatch(/UPDATE abt_variabel SET sql_query = 0x[0-9a-f]+ WHERE no_var = 5404 AND MD5/);
    expect(sqlPulih).not.toMatch(/INSERT INTO|DELETE FROM/);
    expect(sqlPras).toMatch(/no_var IN \('0033', '6034', '6091'\)/);
    expect(sqlPeriksa).toMatch(/SEMUA COCOK/);
    expect(baca("harap.txt").trim().split(/\r?\n/)).toEqual(["1|0|3", "0|1|3"]);
    expect(baca("nomor-diubah.txt")).toMatch(/\n5404\n/);
    for (const s of [sqlPasang, sqlPulih, sqlPras, sqlPeriksa]) expect(s).not.toMatch(/aleta/i);
  });

  it("kueri #5404#: KINERJA - tiap penanda #nnnn# SEKALI (ABT memecahkan tiap kemunculan), tanpa CURDATE()/tahun surat; rincian pergantian lengkap", () => {
    const q = [...sqlPasang.matchAll(/0x([0-9a-f]+)/g)].map((x) => Buffer.from(x[1], "hex").toString("latin1")).find((s) => s.includes("Susunan majelis sidang sebelumnya"))!;
    expect(q).toBeTruthy();
    // ABT: setiap kemunculan penanda angka diselesaikan satu per satu (pembacaan data + call perkara_jadwal_sidang_reorder untuk penanda sidang)
    const penandaAngka = q.match(/#[0-9]+#/g) ?? [];
    expect(penandaAngka.sort()).toEqual(["#0033#", "#6034#", "#6091#"]);
    expect(q).not.toMatch(/CURDATE\(\)/i);
    expect(q).not.toMatch(/YEAR\(b\.tanggal_surat\)/);
    expect(q).toContain("Susunan majelis yang bersidang sama dengan sidang yang lalu;");
    for (const kata of [
      "yang sebelumnya bertugas",
      "digantikan oleh",
      "berdasarkan ",
      "Majelis Hakim (PMH)",
      "Penunjukan Panitera Pengganti (PPP)",
      "Hakim Tunggal (PHT)",
      "sehingga susunan majelis bersidang menjadi sebagai berikut:",
      "-<li>",
      " dan dibantu",
      "tidak lagi bertugas",
      "terjadi perubahan susunan jabatan Majelis Hakim",
    ]) {
      expect(q, kata).toContain(kata);
    }
    // alasan kosong: tidak boleh tercetak "sedang ," - alasan hanya disisipkan lewat IF(... ='' , '', ...)
    expect(q).not.toMatch(/sedang #5407#|sedang #5405#/);
    expect(q).toMatch(/IF\(IFNULL\([^()]*(\([^()]*\))*[^()]*,''\)='','',/);
    // bagian berat hanya dihitung bila ada perubahan (IF(e.chg=1, ...)); kolom perbandingan cepat berbasis id
    expect(q).toMatch(/IF\(e\.chg=1,/);
    expect(q).toMatch(/AS chg/);
  });
});

describe("urutan pasang", () => {
  it("uji rantai memuat tanya-jawab-format-1nov paling akhir (ke-29) dan URUTAN-PASANG-1nov menyebutnya", () => {
    const rantai = readFileSync(path.join(AKAR, "abt-paket/uji-rantai-31okt/rantai.sh"), "utf8");
    const urut = /URUT="([^"]+)"/.exec(rantai)![1].split(/\s+/);
    expect(urut.length).toBeGreaterThanOrEqual(29); // paket ke-30 perbaikan-1nov menyusul sesudahnya
    expect(urut[28]).toBe("tanya-jawab-format-1nov");
    expect(urut[27]).toBe("bas-lanjutan-1nov");
    const pasang = readFileSync(path.join(AKAR, "abt-paket/URUTAN-PASANG-1nov.md"), "utf8");
    expect(pasang).toMatch(/tanya-jawab-format-1nov/);
  });
});
