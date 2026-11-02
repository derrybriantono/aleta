// @vitest-environment node
/**
 * 2 NOV 2026 - paket ABT bas-halaman-semua-2nov (keputusan pengguna 113: "seharusnya ada semua nomor halaman", jawaban atas keputusan 59), paket ke-33.
 * Paket ke-27 (bas-halaman-1nov) melewati berkas yang SATU kakinya sudah ber-PAGE dan hanya memeriksa folder berakhiran " - BAS"; paket ini memeriksa tiap BAGIAN
 * semua blangko BAS (kelompok BAS ekstensi: ^bas\b|^alur\s*\d|\bbas\b) dan menambah field PAGE di kaki yang belum bernomor / kaki baru di bagian tanpa kaki.
 *   A  isi paket SUNGGUHAN: MD5SUMS, daftar (folder BAS, bukan 98b/98c/terhapus), tiap potongan hanya menambah field PAGE rata kanan, tanpa nama aplikasi, skrip tanpa CRLF
 *   B  PERILAKU pembangun atas pohon blangko sintetis (bentuk BAS Mediasi 4 bagian, kaki kosong berkotak teks, satu bagian tanpa kaki, header berisi \pard): hasil tambal
 *      memberi nomor di SETIAP bagian, yang sudah bernomor tidak disentuh, folder bukan BAS dilewati, teks tampak tidak berubah, pasang ulang/pulih bekerja
 *   C  portal: nomor awal runut tetap bekerja di BAS yang kakinya ditambal (bagian pertama mulai N, bagian lain bersambung) - jalur sama dengan paket ke-27
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { pasangNomorAwal } from "@/server/modules/aleta-ecourt/bas-halaman/naskah";

const AKAR = path.resolve(process.cwd(), "..");
const PAKET = path.join(AKAR, "abt-paket/bas-halaman-semua-2nov");
const DIR = path.join(PAKET, "paket-satker");
const baca = (b: string) => readFileSync(path.join(DIR, b), "utf8");
const FIELD = /\{\\fs24 (?:\\f\d+ )?\{\\field\{\\\*\\fldinst \{ PAGE \\\\\* Arabic \}\}\{\\fldrslt \{1\}\}\}\}/;
const lat1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");

describe("A. isi paket sungguhan", () => {
  const ada = existsSync(DIR);
  it.skipIf(!ada)("MD5SUMS cocok; daftar hanya blangko BAS (bukan 98b/98c/terhapus), kode unik, md5 lama != baru, jumlah potongan cocok; skrip LF; tanpa nama aplikasi", () => {
    for (const baris of baca("MD5SUMS.txt").trim().split(/\r?\n/)) {
      const [md5, nama] = baris.split(/\s+\*?/);
      expect(createHash("md5").update(readFileSync(path.join(DIR, nama))).digest("hex"), nama).toBe(md5);
    }
    const daftar = baca("daftar-tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    const potong = baca("tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    expect(daftar.length).toBeGreaterThan(100);
    expect(new Set(daftar.map((d) => d[0])).size).toBe(daftar.length);
    expect(new Set(daftar.map((d) => d[1])).size).toBe(daftar.length);
    for (const d of daftar) {
      const m = /^derry_briantono\/([^/]+)\/[^/]+\.rtf$/.exec(d[1]);
      expect(m, d[1]).not.toBeNull();
      expect(m![1], d[1]).toMatch(/^bas\b|^alur\s*\d|\bbas\b/i);
      expect(["98b Berkas Perkara - BAS", "98c Court Calendar - BAS", "terhapus"]).not.toContain(m![1]);
      expect(d[2]).not.toBe(d[3]);
    }
    expect(potong.length).toBe(daftar.reduce((n, d) => n + Number(d[4]), 0));
    for (const sh of ["pasang-satker.sh", "pulih-satker.sh"]) {
      const t = baca(sh);
      expect(t).not.toMatch(/\r\n/);
      expect(t).not.toMatch(/aleta/i);
    }
    expect(baca("daftar-tambal.tsv")).not.toMatch(/aleta/i);
  });

  it.skipIf(!ada)("tiap potongan HANYA menambah field PAGE rata kanan (di kaki yang ada atau kaki baru); tanpa nama aplikasi; kurung tambahan seimbang", () => {
    const potong = baca("tambal.tsv").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
    let kakiBaru = 0;
    let kakiAda = 0;
    for (const [, , lama, baru] of potong) {
      const a = Buffer.from(lama, "base64").toString("latin1");
      const z = Buffer.from(baru, "base64").toString("latin1");
      expect(["\\par", "\\pard"]).toContain(a);
      expect(z.endsWith(a)).toBe(true);
      const tambah = z.slice(0, z.length - a.length);
      expect(tambah).not.toMatch(/aleta/i);
      expect((tambah.match(/\{\\field/g) ?? []).length).toBe(1);
      expect(tambah).toMatch(FIELD);
      expect(tambah).toMatch(/\\qr/);
      let d = 0;
      for (let i = 0; i < tambah.length; i += 1) {
        const c = tambah[i];
        if (c === "\\") i += 1;
        else if (c === "{") d += 1;
        else if (c === "}") d -= 1;
        expect(d).toBeGreaterThanOrEqual(0);
      }
      expect(d).toBe(0);
      if (a === "\\pard") {
        kakiBaru += 1;
        expect(tambah).toMatch(/^\{\\footer \\pard\\plain \\qr\\li0\\ri0\\sa0\\sl240\\slmult1 \{\\fs24 /);
        expect(tambah).toMatch(/\\par\}$/);
      } else {
        kakiAda += 1;
        expect(tambah).toMatch(/^\\qr \{\\fs24 /);
      }
    }
    expect(kakiBaru).toBeGreaterThan(0);
    expect(kakiAda).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// B. perilaku pembangun atas pohon sintetis
const BS = "\\";
const FLD = `{${BS}field{${BS}*${BS}fldinst { PAGE ${BS}${BS}* Arabic }}{${BS}fldrslt {1}}}`;
const KAKI_PAGE = `{${BS}footer ${BS}pard${BS}plain ${BS}qr ${FLD}${BS}par}`;
const KAKI_KOSONG_KOTAK = `{${BS}footer ${BS}pard${BS}plain {${BS}shp{${BS}*${BS}shpinst${BS}shpleft0 {${BS}sp{${BS}sn wzName}{${BS}sv Text Box 1}}{${BS}shptxt ${BS}pard${BS}plain ${BS}par}}}${BS}par}`;
const KEPALA = `{${BS}rtf1${BS}ansi${BS}deff0{${BS}fonttbl{${BS}f0 Arial;}{${BS}f4 Times;}}${BS}paperw12191${BS}paperh18711${BS}facingp0`;
const SEKSI = (mulai: number, tengah: string, badan: string) =>
  `${BS}sectd${BS}sbkpage${BS}pgnrestart${BS}pgnstarts${mulai}${BS}pgwsxn12191${BS}headery720${BS}footery720 ${BS}sectdefaultcl ${tengah}${BS}pard${BS}plain {${BS}f4 ${badan}}${BS}par\n`;
const HEADER = `{${BS}header ${BS}pard${BS}plain {${BS}fs6 #6001#}${BS}par}`;

/** (a) BAS Mediasi: 4 bagian - bagian 1 dan 3 tanpa kaki, bagian 2 dan 4 ber-PAGE (pola 122 berkas nyata) */
const MEDIASI = `${KEPALA}\n${SEKSI(1, HEADER, "BERITA ACARA SIDANG MEDIASI")}${BS}sect\n${SEKSI(13, KAKI_PAGE, "daftar bukti")}${BS}sect\n${SEKSI(1, "", "bagian tiga")}${BS}sect\n${SEKSI(15, KAKI_PAGE, "penutup")}}`;
/** (b) satu bagian, kaki ada tetapi kotak teks kosong (pola folder BAS lama) */
const KAKI_KOTAK = `${KEPALA}\n${SEKSI(1, `${KAKI_KOSONG_KOTAK}${HEADER}`, "BERITA ACARA SATU")}}`;
/** (c) satu bagian, TANPA kaki, header berisi \pard (titik sisip harus \pard badan, bukan \pard di dalam header) */
const TANPA_KAKI = `${KEPALA}\n${SEKSI(1, HEADER, "BERITA ACARA TANPA KAKI")}}`;
/** (d) sudah bernomor di semua bagian: tidak boleh disentuh */
const SUDAH = `${KEPALA}\n${SEKSI(1, KAKI_PAGE, "BERITA ACARA SUDAH")}${BS}sect\n${SEKSI(5, KAKI_PAGE, "dua")}}`;
/** (e) kaki bagian kedua kosong tanpa PAGE, bagian pertama ber-PAGE: hanya bagian kedua diisi */
const SEBAGIAN = `${KEPALA}\n${SEKSI(1, KAKI_PAGE, "BERITA ACARA SEBAGIAN")}${BS}sect\n${SEKSI(5, KAKI_KOSONG_KOTAK, "dua")}}`;

const bagianTanpaNomor = (rtf: string): number[] => {
  // setiap bagian harus menetapkan kaki yang memuat PAGE (aturan paket: tidak mengandalkan pewarisan)
  const bagian = rtf.split(/\\sectd(?![a-z])/).slice(1);
  return bagian.map((b, i) => ({ i, ok: /\{\\footer[\s\S]*PAGE/.test(b.split(/\\sect(?![a-z])/)[0]) })).filter((x) => !x.ok).map((x) => x.i);
};
const tampak = (s: string): string => s.replace(FIELD, "").replace(new RegExp(FLD.replace(/[\\{}*]/g, "\\$&"), "g"), "").replace(/\\'[0-9a-fA-F]{2}/g, "?").replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/[{}\s]+/g, "");

const PY = spawnSync("python", ["--version"], { encoding: "utf8" });
const adaPython = !PY.error && PY.status === 0;

describe("B. pembangun atas pohon sintetis", () => {
  const kerja = () => {
    const dasar = path.join(process.env.TMPDIR || process.env.TEMP || tmpdir(), "uji-bas-halaman-semua-");
    const t = mkdtempSync(dasar);
    const pohon = path.join(t, "pohon");
    const berkas: Record<string, string> = {
      "derry_briantono/1 Perceraian CG - BAS/BAS MEDIASI.rtf": MEDIASI,
      "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)/[2] BAS kotak.rtf": KAKI_KOTAK,
      "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS tanpa kaki.rtf": TANPA_KAKI,
      "derry_briantono/1 Perceraian CG - BAS/BAS SUDAH.rtf": SUDAH,
      "derry_briantono/2 Itsbat Nikah - BAS/BAS SEBAGIAN.rtf": SEBAGIAN,
      // bukan BAS: tidak boleh disentuh walau tanpa nomor
      "derry_briantono/98c Court Calendar - BAS/Court Calendar.rtf": TANPA_KAKI,
      "derry_briantono/98b Berkas Perkara - BAS/Daftar Isi.rtf": TANPA_KAKI,
      "derry_briantono/1 Perceraian CG/[01] Putusan.rtf": TANPA_KAKI,
      "derry_briantono/terhapus/BAS lama.rtf": TANPA_KAKI,
    };
    for (const [rel, isi] of Object.entries(berkas)) {
      const p = path.join(pohon, rel);
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, Buffer.from(isi, "latin1"));
    }
    return { t, pohon, berkas };
  };
  const bangun = (pohon: string, paket: string, hasil: string) =>
    spawnSync("python", [path.join(PAKET, "sumber/bangun_paket.py"), pohon, paket, hasil], { encoding: "utf8" });
  const tambal = (paket: string, pohon: string, cad: string, perintah: string) =>
    spawnSync("python", [path.join(paket, "tambal_rtf.py"), perintah, pohon, cad], { encoding: "utf8" });

  it.skipIf(!adaPython)("memberi nomor di SETIAP bagian; yang sudah bernomor dan yang bukan BAS tidak disentuh; teks tampak utuh; pasang ulang dan pulih bekerja", () => {
    const { t, pohon, berkas } = kerja();
    try {
      const paket = path.join(t, "paket");
      const hasil = path.join(t, "hasil");
      const b = bangun(pohon, paket, hasil);
      expect(b.status, b.stderr + b.stdout).toBe(0);
      expect(b.stdout).toMatch(/BAS DIPERIKSA=5 \| SUDAH BERNOMOR SEMUA BAGIAN=1 \| BERKAS DIUBAH=4 /);
      const daftar = readFileSync(path.join(paket, "daftar-tambal.tsv"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
      expect(daftar.map((d) => d[1]).sort()).toEqual([
        "derry_briantono/- BAS CONTRA PERCERAIAN -/[02] BAS tanpa kaki.rtf",
        "derry_briantono/1 Perceraian CG - BAS/BAS MEDIASI.rtf",
        "derry_briantono/2 Itsbat Nikah - BAS/BAS SEBAGIAN.rtf",
        "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)/[2] BAS kotak.rtf",
      ]);
      const cek = tambal(paket, pohon, path.join(t, "cad"), "cek");
      expect(cek.stdout.trim().split("\n").pop()).toBe("BERKAS SIAP");
      const ps = tambal(paket, pohon, path.join(t, "cad"), "pasang");
      expect(ps.status, ps.stderr + ps.stdout).toBe(0);
      for (const [rel, lama] of Object.entries(berkas)) {
        const baru = readFileSync(path.join(pohon, rel)).toString("latin1");
        if (daftar.some((d) => d[1] === rel)) {
          expect(bagianTanpaNomor(baru), `${rel}: bagian tanpa nomor`).toEqual([]);
          expect(tampak(baru), `${rel}: teks tampak berubah`).toBe(tampak(lama));
          expect(baru.split(/\\sect(?![a-z])/).length).toBe(lama.split(/\\sect(?![a-z])/).length);
        } else {
          expect(baru, `${rel} tidak boleh disentuh`).toBe(lama);
        }
      }
      // bentuk: kaki baru di bagian pertama mediasi muncul SEBELUM \pard badan, bukan di dalam {\header ...}; header utuh
      const med = readFileSync(path.join(pohon, "derry_briantono/1 Perceraian CG - BAS/BAS MEDIASI.rtf")).toString("latin1");
      expect(med).toContain(HEADER);
      const bagian1 = med.split(/\\sectd(?![a-z])/)[1];
      expect(bagian1.indexOf("{\\footer")).toBeGreaterThan(bagian1.indexOf(HEADER) + HEADER.length - 1);
      expect(bagian1.indexOf("{\\footer")).toBeLessThan(bagian1.indexOf("\\pard\\plain {\\f4 BERITA ACARA"));
      expect((med.match(/PAGE/g) ?? []).length).toBe(4);
      // kaki kotak teks kosong: field masuk tepat sebelum \par terakhir kaki (tanpa paragraf tambahan)
      const kotak = readFileSync(path.join(pohon, "derry_briantono/ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)/[2] BAS kotak.rtf")).toString("latin1");
      expect(kotak).toMatch(/\\qr \{\\fs24 (?:\\f\d+ )?\{\\field[^]*?\}\}\}\}\\par\}/);
      // pasang ulang: tidak ada yang berubah; pulih: pohon kembali persis
      const sidik = () => createHash("md5").update(Object.keys(berkas).sort().map((r) => readFileSync(path.join(pohon, r)).toString("latin1")).join("\u0000")).digest("hex");
      const sesudah = sidik();
      const ulang = tambal(paket, pohon, path.join(t, "cad"), "pasang");
      expect(ulang.status, ulang.stderr + ulang.stdout).toBe(0);
      expect(sidik()).toBe(sesudah);
      const pu = tambal(paket, pohon, path.join(t, "cad"), "pulih");
      expect(pu.stdout.trim().split("\n").pop()).toBe("BERKAS PULIH");
      for (const [rel, lama] of Object.entries(berkas)) expect(readFileSync(path.join(pohon, rel)).toString("latin1"), rel).toBe(lama);
      // pasang pada berkas yang disunting orang: ditolak tanpa mengubah apa pun
      const sunting = path.join(pohon, "derry_briantono/1 Perceraian CG - BAS/BAS MEDIASI.rtf");
      writeFileSync(sunting, readFileSync(sunting).toString("latin1") + " ", "latin1");
      const tolak = tambal(paket, pohon, path.join(t, "cad2"), "pasang");
      expect(tolak.status).not.toBe(0);
      expect(readFileSync(path.join(pohon, "derry_briantono/2 Itsbat Nikah - BAS/BAS SEBAGIAN.rtf")).toString("latin1")).toBe(SEBAGIAN);
    } finally {
      rmSync(t, { recursive: true, force: true });
    }
  });

  it.skipIf(!adaPython)("pohon tanpa BAS yang perlu ditambal: tidak ada potongan, bukan galat", () => {
    const t = mkdtempSync(path.join(process.env.TMPDIR || process.env.TEMP || tmpdir(), "uji-bas-halaman-semua-"));
    try {
      const p = path.join(t, "pohon/derry_briantono/1 Perceraian CG - BAS/BAS SUDAH.rtf");
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, Buffer.from(SUDAH, "latin1"));
      const b = bangun(path.join(t, "pohon"), path.join(t, "paket"), path.join(t, "hasil"));
      expect(b.status, b.stderr).toBe(0);
      expect(b.stdout).toMatch(/BERKAS DIUBAH=0 /);
      expect(readdirSync(path.join(t, "paket"))).toContain("daftar-tambal.tsv");
    } finally {
      rmSync(t, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// C. portal: nomor awal runut di BAS yang kakinya sudah ber-PAGE (bentuk sesudah paket)
describe("C. nomor awal runut di BAS berkaki lengkap", () => {
  it("bagian pertama mulai N, bagian lain yang bernomor tetap jadi bersambung, kaki ber-PAGE utuh", () => {
    const sesudah = `${KEPALA}\n${SEKSI(1, KAKI_PAGE + HEADER, "BERITA ACARA")}${BS}sect\n${SEKSI(13, KAKI_PAGE, "daftar bukti")}${BS}sect\n${SEKSI(1, KAKI_PAGE, "tiga")}${BS}sect\n${SEKSI(15, KAKI_PAGE, "penutup")}}`;
    const h = pasangNomorAwal(new Uint8Array(Buffer.from(sesudah, "latin1")), "rtf", 9);
    expect(h.dipasang).toBe(true);
    const t = lat1(h.bita);
    expect(t).toMatch(/\\pgnrestart\\pgnstarts9 /);
    expect((t.match(/\\pgncont/g) ?? []).length).toBe(3);
    expect(h.bagianDisambung).toBe(3);
    expect((t.match(/PAGE/g) ?? []).length).toBe(4);
    expect(t).not.toMatch(/\\pgnstarts(?:13|15)(?![0-9])/);
  });
});
