// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { type MatriksDalil } from "@/lib/matriks-dalil";
import { DASAR_NAFKAH_12, TANDA_NAFKAH_12, bulanNafkahTeks, nilaiPembuktian, ubahanPembuktian, type SaksiMasuk } from "@/lib/penilai-bukti";

/**
 * ============================================================================
 * 2 NOV 2026 (agen S, keputusan 111 & 116) - WALI MENIKAHKAN SENDIRI, SYARAT NAFKAH 12 BULAN, USULAN SAKSI TERSISA
 * ============================================================================
 *
 * Semua nama dan nomor REKAAN; bentuk kalimat meniru posita PA yang sungguh ada (diukur atas sipp_2810, laporan agen S).
 *   1. yang menikahkan = wali sendiri (ayah/kerabat) dibaca dari posita: bot (isian 8087/1217) DAN keadaan katalog (ekstensi);
 *      imam/penghulu tetap imam; "Bapak X (Imam ...)" adalah sapaan, bukan ayah; "Tidak diketahui" tidak diisi;
 *   2. katalog itsbat: butir "wali sendiri" menggantikan butir imam/penghulu hanya bila keadaannya wali sendiri; butir lama utuh;
 *   3. nafkah 12 bulan (SEMA 1/2022 angka 1 huruf b poin 1): lama dari gugatan & saksi, tanda "belum memenuhi 12 bulan" tanpa
 *      mengubah status; dasar hukum tersedia; butir saksi "sejak kapan tidak dinafkahi" muncul hanya bila nafkah didalilkan;
 *   4. butir baru (anak & biaya, puncak & akibat, nafkah anak tanpa hak asuh, harta bersama pewaris) hanya pada keadaannya.
 */

type Apa = any;
const REPO = path.resolve(__dirname, "../../..");
const EKS = path.join(REPO, "ekstensi-sipp");
const SVC = path.join(REPO, "aleta_bot/services");
const req = createRequire(import.meta.url);
const nikah: Apa = req(path.join(SVC, "isiJawabanSaksiPositaNikah.js"));
const posita: Apa = req(path.join(SVC, "isiJawabanSaksiPosita.js"));
const usulan: Apa = req(path.join(SVC, "abtUsulanService.js"));
const nafkah: Apa = req(path.join(SVC, "nafkahPosita.js"));
const KP: Apa = req(path.join(EKS, "blangko-derry-keadaan-posita.js"));

const semua = readdirSync(path.join(EKS, "saksi-katalog"))
  .filter((n) => n.endsWith(".json"))
  .map((n) => JSON.parse(readFileSync(path.join(EKS, "saksi-katalog", n), "utf8")));
(globalThis as Apa).ALETA_SAKSI_KATALOG_DATA = semua;
const Mesin: Apa = req(path.join(EKS, "saksi-katalog.js"));
const Bd: Apa = req(path.join(EKS, "blangko-derry-katalog.js"));
const kat = (k: string) => semua.find((x: Apa) => x.kunci === k);

function susun(k: Apa, keadaan: Record<string, unknown>, variabel: Record<string, string> = {}, saksi?: Apa[]) {
  const h = Bd.susun({
    kat: k,
    sebutan: { P: "Pemohon", T: "Termohon" },
    benih: "uji/Pdt.P/2026/PA.Dgl",
    keadaan: Bd.lengkapiBawaan(k, keadaan),
    saksi: saksi || [{ kunci: "saksi 1 p", pihak: "P" }, { kunci: "saksi 2 p", pihak: "P" }],
    variabel: (x: string) => variabel[x],
  });
  expect(h.ada).toBe(true);
  return h;
}
const idBaris = (h: Apa, ke = 0) => h.saksi[ke].baris.map((b: Apa) => b.butir) as string[];
const peran = (k: string) => nikah.peranNikah([k]);

describe("1. yang menikahkan = wali sendiri (keputusan 111)", () => {
  const KASUS: Array<[string, string, string]> = [
    ["Pernikahan dilangsungkan dengan wali nikah dan yang menikahkan adalah Xxxa (Ayah Kandung Pemohon II) dan dihadiri saksi nikah bernama Xxxc dan Xxxd", "ayah kandung Pemohon II bernama Xxxa", "Xxxa"],
    ["Pernikahan dilangsungkan dengan wali nikah sekaligus yang menikahkan yaitu Xxxa (Saudara Kandung Pemohon II) dan dihadiri 2 (dua) orang saksi nikah", "saudara kandung Pemohon II bernama Xxxa", "Xxxa"],
    ["Pernikahan dilangsungkan dengan wali nikah yaitu Xxxa (Ayah Kandung Pemohon II) dan yang menikahkan adalah Xxxa (Ayah Kandung Pemohon II), dan dihadiri saksi nikah bernama Xxxc dan Xxxd", "ayah kandung Pemohon II bernama Xxxa", "Xxxa"],
    ["Pernikahan dilangsungkan dengan wali nikah yaitu Xxxa (Ayah kandung Pemohon II) dan yang menikahkan adalah Wali nikah Pemohon II dan dihadiri saksi nikah bernama Xxxc dan Xxxd", "ayah kandung Pemohon II bernama Xxxa", "Xxxa"],
    ["Pernikahan dilangsungkan dengan wali nikah yaitu Xxxa (Ayah kandung Pemohon II) dan yang menikahkan adalah Ayah Kandung Pemohon II dan dihadiri saksi nikah bernama Xxxc dan Xxxd", "ayah kandung Pemohon II bernama Xxxa", "Xxxa"],
    ["dan yang menikahkan antara Pemohon I dengan Pemohon II dan sekaligus wali nikah adalah ayah kandung Pemohon II bernama Xxxa sedangkan yang menjadi saksi nikah adalah Xxxc dan Xxxd", "ayah kandung Pemohon II bernama Xxxa", "Xxxa"],
    ["pernikahan dilangsungkan dengan wali nikah ayah kandung Pemohon II yang bernama Xxxa dan dinikahkan langsung oleh ayah kandung Pemohon II yang bernama Xxxa dan dihadiri saksi nikah bernama Xxxc dan Xxxd", "ayah kandung Pemohon II bernama Xxxa", "Xxxa"],
  ];
  for (const [kalimat, penikah, wali] of KASUS) {
    it(`bot: ${kalimat.slice(0, 70)}...`, () => {
      const r = peran(kalimat);
      expect(r.penikahWali).toBe(true);
      expect(r.penikah).toBe(penikah);
      expect(r.waliNama).toBe(wali);
      expect(KP.turunkan("itsbat-nikah", { posita: `Bahwa ${kalimat};`, alurId: "16", jumlahPemohon: 2 }).penikah).toBe("wali-sendiri");
    });
  }

  it("wali hakim yang sekaligus menikahkan tetap 'wali hakim bernama ...' dan bertanda wali sendiri", () => {
    const r = peran("pernikahan dilangsungkan dengan wali hakim yang bernama H. Xxxa dan sekaligus menikahkan Pemohon II karena ayah kandung beragama lain dan dihadiri saksi nikah bernama Xxxc dan Xxxd");
    expect(r).toMatchObject({ penikah: "wali hakim bernama H. Xxxa", penikahWali: true });
  });

  it("kerabat yang menikahkan tanpa kalimat wali: dianggap wali (ragu), wali ikut terisi bertanda ragu", () => {
    const f = nikah.faktaNikahDariPosita(["pernikahan dilangsungkan secara Syariat Islam yang menikahkan adalah ayah kandung bernama Xxxa dan dihadiri 2 orang saksi masing-masing bernama : Xxxc dan Xxxd"]);
    expect(f.find((x: Apa) => x.kunci === "penikah")).toMatchObject({ nilai: "ayah kandung bernama Xxxa", yakin: "ragu" });
    expect(f.find((x: Apa) => x.kunci === "waliNama")).toMatchObject({ nilai: "Xxxa", yakin: "ragu" });
  });

  it("imam/penghulu tetap yang menikahkan (bukan wali sendiri); 'Bapak X (Imam ...)' sapaan, bukan ayah; P3N dan wakil imam dikenali", () => {
    const imam = "Pernikahan dilangsungkan dengan wali nikah yaitu Bapak Xxxa (Ayah Kandung Pemohon II) dan yang menikahkan adalah Bapak Xxxb (Imam Masjid Desa Yyya) dan dihadiri saksi nikah bernama Xxxc dan Xxxd";
    const r = peran(imam);
    expect(r).toMatchObject({ penikah: "Imam Masjid Desa Yyya bernama Xxxb", waliNama: "Xxxa", waliHubungan: "ayah kandung Pemohon II" });
    expect(r.penikahWali).toBeUndefined();
    expect(KP.turunkan("itsbat-nikah", { posita: `Bahwa ${imam};`, alurId: "16", jumlahPemohon: 2 }).penikah).toBeUndefined();
    expect(peran("dengan wali nikah yaitu Xxxa (Ayah kandung Pemohon II) dan yang menikahkan adalah Xxxb (Pegawai PPPN), dan dihadiri saksi nikah bernama Xxxc dan Xxxd").penikah).toBe("Pegawai PPPN bernama Xxxb");
    expect(peran("dengan wali nikah yaitu Xxxa (Ayah kandung Pemohon II) dan yang menikahkan adalah Xxxb (Wakil imam), dan dihadiri saksi nikah bernama Xxxc dan Xxxd").penikah).toBe("Wakil imam bernama Xxxb");
    // kerabat lain (bukan walinya) yang menikahkan: hubungan ikut, bukan wali sendiri
    const lain = peran("dengan wali nikah yaitu Xxxa (Ayah kandung Pemohon II) dan yang menikahkan adalah Xxxe (Saudara Kandung Pemohon II) dan dihadiri saksi nikah bernama Xxxc dan Xxxd");
    expect(lain.penikah).toBe("saudara kandung Pemohon II bernama Xxxe");
    expect(lain.penikahWali).toBeUndefined();
  });

  it("'yang menikahkan Tidak diketahui' tidak diisi; penanda di dalam kurung keterangan tidak memotong peran; nama 'Hakimin' bukan wali hakim", () => {
    expect(peran("dengan wali nikah yaitu Xxxa (Ayah Kandung Pemohon II) dan yang menikahkan Tidak diketahui dan dihadiri saksi nikah bernama Xxxc").penikah).toBeUndefined();
    const k = peran("dengan wali nikah yaitu Xxxa ( Kakak Kandung Pemohon II karena Ayah Kandung Pemohon II berada di luar daerah sehingga diwakilkan kepada Kakak Kandung Pemohon II) dan yang menikahkan adalah Xxxb (Imam Mesjid Desa Yyya), dan dihadiri saksi nikah bernama Xxxc dan Xxxd");
    expect(k.penikah).toBe("Imam Mesjid Desa Yyya bernama Xxxb");
    expect(k.penikahWali).toBeUndefined();
    expect(peran("dengan wali nikah yaitu Xxxa (Keluarga Pemohon II) dan yang menikahkan adalah Hakimin (Imam Mesjid Yyya), dan dihadiri saksi nikah bernama Xxxc dan Xxxd").penikah).toBe("Imam Mesjid Yyya bernama Hakimin");
  });

  it("jalur ABT (8087/1217) sama dengan fakta saksi", () => {
    const P =
      "Bahwa pada tanggal 07 Mei 2017 telah terjadi pernikahan di Desa Yyyz; Bahwa pada saat pernikahan tersebut Pemohon I berstatus Jejaka dalam usia 20 tahun dan Pemohon II berstatus Perawan dalam usia 19 tahun, Pernikahan dilangsungkan dengan wali nikah dan yang menikahkan adalah Xxxa (Ayah Kandung Pemohon II) dan dihadiri saksi nikah bernama Xxxc dan Xxxd dengan mas kawin uang Rp 110.000";
    const u = usulan.dariPositaItsbat(P, { pemohon: "Pemohon I", pemohon2: "Pemohon II" }).usulan;
    expect(u.find((x: Apa) => x.kode === "8087").nilai).toBe("ayah kandung Pemohon II bernama Xxxa");
    expect(u.find((x: Apa) => x.kode === "1217").nilai).toBe("Xxxa");
  });
});

describe("2. katalog itsbat: butir wali sendiri menggantikan butir imam hanya pada keadaannya", () => {
  const IN = kat("itsbat-nikah");
  const VAR = { "1046": "ayah kandung Pemohon II", "1217": "Xxxa", "8087": "Imam Desa Yyya bernama Xxxb" };
  it("bawaan (imam/penghulu): butir lama, tanpa butir wali sendiri", () => {
    const ids = idBaris(susun(IN, { bentuk: "permohonan-berdua" }, VAR));
    expect(ids).toContain("q-in-menikahkan-pb");
    expect(ids).not.toContain("q-in-menikahkan-wali-pb");
  });
  it("wali sendiri: butir baru menggantikan, jawaban menyebut wali (bukan 8087), jumlah butir sama", () => {
    const lama = susun(IN, { bentuk: "permohonan-berdua" }, VAR);
    const h = susun(IN, { bentuk: "permohonan-berdua", penikah: "wali-sendiri" }, VAR);
    const ids = idBaris(h);
    expect(ids).toContain("q-in-menikahkan-wali-pb");
    expect(ids).not.toContain("q-in-menikahkan-pb");
    expect(ids.length).toBe(idBaris(lama).length);
    const b = h.saksi[0].baris.find((x: Apa) => x.butir === "q-in-menikahkan-wali-pb");
    expect(JSON.stringify(b)).toMatch(/ayah kandung Pemohon II bernama Xxxa/);
    expect(JSON.stringify(b)).not.toMatch(/Imam Desa Yyya/);
  });
  it("gugatan dan satu pemohon punya padanan; kumulasi itsbat di cerai juga", () => {
    expect(idBaris(susun(IN, { bentuk: "gugatan", penikah: "wali-sendiri" }, VAR))).toContain("q-in-menikahkan-wali-lw");
    expect(idBaris(susun(IN, { bentuk: "permohonan-sendiri", penikah: "wali-sendiri" }, VAR))).toContain("q-in-menikahkan-wali-pm");
    expect(kat("cerai-kumulasi-itsbat").pertanyaan.some((q: Apa) => q.id === "q-in-menikahkan-wali-km" && q.menggantikan[0] === "q-in-menikahkan-km")).toBe(true);
  });
  it("katalog yang disentuh lolos pemeriksa mesin", () => {
    for (const k of ["itsbat-nikah", "cerai-kumulasi-itsbat", "cerai-gugat", "cerai-talak", "cerai-kumulasi", "penetapan-ahli-waris"]) {
      expect(Mesin.periksaKatalog(kat(k)).galat, k).toEqual([]);
    }
  });
});

describe("3. syarat nafkah 12 bulan (keputusan 116 butir 15)", () => {
  const acuan = new Date(2026, 10, 2);
  it("pembaca gugatan: sejak bulan/tahun dihitung sampai acuan, lama tertulis, nafkah anak saja tidak", () => {
    const n = nafkah.nafkahDariPosita(["Tergugat tidak lagi memberi nafkah kepada Penggugat sejak bulan Maret 2026 sampai sekarang"], { acuan });
    expect(n).toMatchObject({ ada: true, sejak: "bulan Maret 2026", bulan: 8, lama: "8 bulan" });
    expect(nafkah.nafkahDariPosita(["Tergugat tidak pernah lagi memberi nafkah lahir maupun batin kepada Penggugat ± 2 tahun 2 bulan"], { acuan }).bulan).toBe(26);
    expect(nafkah.nafkahDariPosita(["sejak Maret 2024 sampai dengan sekarang Tergugat tidak pernah memberikan nafkah terhadap anak"], { acuan }).ada).toBe(false);
    expect(nafkah.nafkahDariPosita(["Tergugat masih memberikan nafkah walaupun sedikit"], { acuan }).ada).toBe(false);
    const tanpa = nafkah.nafkahDariPosita(["Tergugat selama tidak rukun dengan Penggugat tidak pernah memberikan nafkah"], { acuan });
    expect(tanpa).toMatchObject({ ada: true, bulan: null });
  });

  it("fakta saksi dari gugatan: nafkahSejak dan lamaNafkah bertanda bukan ucapan saksi", () => {
    const f = posita.positaTambahan("Bahwa Tergugat sudah tidak menafkahi Penggugat sejak bulan Januari 2025;", "cg");
    expect(f.find((x: Apa) => x.kunci === "nafkahSejak")).toMatchObject({ nilai: "bulan Januari 2025" });
    expect(f.find((x: Apa) => x.kunci === "nafkahSejak").ket).toMatch(/gugatan/);
    expect(f.find((x: Apa) => x.kunci === "lamaNafkah")).toBeTruthy();
  });

  it("lama dari jawaban saksi: angka di sekitar kata nafkah saja", () => {
    expect(bulanNafkahTeks("sejak bulan maret 2026 tergugat tidak lagi memberi nafkah kepada penggugat", acuan)).toBe(8);
    expect(bulanNafkahTeks("sudah 2 tahun tergugat tidak menafkahi penggugat", acuan)).toBe(24);
    expect(bulanNafkahTeks("mereka telah menikah selama 5 tahun dan tergugat tidak memberi nafkah", acuan)).toBe(null);
  });

  const POSITA = [
    "<p>1. Bahwa pada tanggal 08 November 2021 Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Contoh;</p>",
    "<p>2. Bahwa sejak pertengahan tahun 2025 rumah tangga Penggugat dan Tergugat mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran;</p>",
    "<p>3. Bahwa Tergugat tidak lagi memberikan nafkah kepada Penggugat sejak bulan Maret 2026;</p>",
  ].join("");
  const MD: Apa = createRequire(path.join(REPO, "aleta_bot/package.json"))(path.join(SVC, "matriksDalilService.js"));
  const matriks = (): MatriksDalil => MD.susunMatriksDalil({ dokumen: [], sebutan: { lawan: "Penggugat", pelaku: "Tergugat" }, sipp: { posita: POSITA, petitum: "" } });
  const saksi = (id: string, ke: number, jawab: string): SaksiMasuk => ({ id, pihak: "P", ke, baris: [{ tanya: "Apakah Tergugat masih memberi nafkah kepada Penggugat?", jawab }] });
  const dalilNafkah = (h: Apa) => h.baris.find((r: Apa) => /nafkah/.test(r.ringkas));

  it("< 12 bulan menurut kedua saksi: ditandai 'belum memenuhi 12 bulan' + catatan SEMA; status TIDAK diubah oleh tanda", () => {
    const s = [saksi("p1", 1, "Saya melihat sendiri Tergugat tidak lagi memberi nafkah kepada Penggugat sejak bulan Maret 2026;"), saksi("p2", 2, "Saya tahu sendiri Tergugat sudah 8 bulan tidak menafkahi Penggugat;")];
    const h = nilaiPembuktian(matriks(), s, [], { sebutan: { P: "Penggugat", T: "Tergugat" }, acuan });
    const r = dalilNafkah(h);
    expect(r.tanda).toEqual([TANDA_NAFKAH_12]);
    expect(r.nafkah).toMatchObject({ bulanSaksi: 8, bulanDalil: 8, memenuhi: false });
    expect(r.catatan.join(" ")).toMatch(/SEMA Nomor 1 Tahun 2022/);
    expect(r.status).toBe("terbukti");
    expect(h.kesimpulan.dasarNafkah).toBe(DASAR_NAFKAH_12);
    expect(h.kesimpulan.catatan.join(" ")).toMatch(/belum memenuhi 12 bulan/);
    // tanda ikut tersimpan ke matriks (peta dalil menampilkannya)
    const ubah = ubahanPembuktian(h, {});
    expect(ubah[r.id]?.tanda).toEqual([TANDA_NAFKAH_12]);
  });

  it(">= 12 bulan menurut dua saksi: tanpa tanda; lamanya tidak disebut saksi: ditandai", () => {
    const ok = nilaiPembuktian(matriks(), [saksi("p1", 1, "Saya melihat sendiri sudah 2 tahun Tergugat tidak memberi nafkah kepada Penggugat;"), saksi("p2", 2, "Saya tahu sendiri sejak bulan Januari 2024 Tergugat tidak menafkahi Penggugat;")], [], { sebutan: { P: "Penggugat", T: "Tergugat" }, acuan });
    expect(dalilNafkah(ok).tanda).toBeUndefined();
    expect(dalilNafkah(ok).nafkah.memenuhi).toBe(true);
    const tanpa = nilaiPembuktian(matriks(), [saksi("p1", 1, "Saya melihat sendiri Tergugat tidak memberi nafkah kepada Penggugat;")], [], { sebutan: { P: "Penggugat", T: "Tergugat" }, acuan });
    expect(dalilNafkah(tanpa).tanda).toEqual([TANDA_NAFKAH_12]);
    expect(dalilNafkah(tanpa).catatan.join(" ")).toMatch(/belum diterangkan saksi/);
  });

  it("katalog cerai gugat: butir 'sejak kapan tidak dinafkahi' hanya bila nafkah didalilkan; keadaan diturunkan dari gugatan", () => {
    const CG = kat("cerai-gugat");
    expect(CG.dasarHukum.some((d: Apa) => d.id === "dh-sema-1-2022-nafkah" && /minimal 12 \(dua belas\) bulan/.test(d.uraian))).toBe(true);
    const k = KP.turunkan("cerai-gugat", { posita: POSITA, alurId: "15", jumlahPemohon: 1 });
    expect(k.sebabF).toEqual(["ekonomi-nafkah"]);
    const sb = { P: "Penggugat", T: "Tergugat" };
    const tanpa = Bd.susun({ kat: CG, sebutan: sb, benih: "x", keadaan: Bd.lengkapiBawaan(CG, {}), saksi: [{ kunci: "saksi 1 p", pihak: "P" }], variabel: () => undefined });
    const dengan = Bd.susun({ kat: CG, sebutan: sb, benih: "x", keadaan: Bd.lengkapiBawaan(CG, { sebabF: ["ekonomi-nafkah"] }), saksi: [{ kunci: "saksi 1 p", pihak: "P" }], variabel: () => undefined });
    expect(idBaris(tanpa)).not.toContain("q-nafkah-sejak");
    expect(idBaris(dengan)).toContain("q-nafkah-sejak");
    expect(KP.turunkan("cerai-gugat", { posita: "<p>Bahwa Tergugat masih memberi nafkah;</p>", alurId: "15", jumlahPemohon: 1 }).sebabF).toBeUndefined();
  });
});

describe("4. usulan saksi tersisa (keputusan 116 butir 16): muncul hanya bila relevan", () => {
  const sb = { P: "Penggugat", T: "Tergugat" };
  const ids = (k: Apa, keadaan: Record<string, unknown>) =>
    idBaris(Bd.susun({ kat: k, sebutan: sb, benih: "x", keadaan: Bd.lengkapiBawaan(k, keadaan), saksi: [{ kunci: "saksi 1 p", pihak: "P" }], variabel: () => undefined }));
  it("anak tinggal bersama & biaya anak: hanya bila ada anak dan anak diasuh Penggugat; pengasuh diturunkan dari gugatan", () => {
    const CG = kat("cerai-gugat");
    expect(ids(CG, { anak: "ada", pengasuhAnak: "pengaju" })).toContain("q-anak-biaya");
    expect(ids(CG, { anak: "tidak" })).not.toContain("q-anak-biaya");
    expect(ids(CG, { anak: "ada", pengasuhAnak: "lawan" })).not.toContain("q-anak-biaya");
    expect(KP.turunkan("cerai-gugat", { posita: "<p>Bahwa dikaruniai 1 orang anak, kini anak tersebut tinggal dan diasuh oleh Tergugat;</p>", alurId: "15" }).pengasuhAnak).toBe("lawan");
    expect(KP.turunkan("cerai-gugat", { posita: "<p>Bahwa Penggugat khawatir jika anak diasuh oleh Tergugat;</p>", alurId: "15" }).pengasuhAnak).toBeUndefined();
  });
  it("puncak perselisihan & akibatnya: hanya bila sudah pisah (cerai gugat dan talak)", () => {
    for (const k of ["cerai-gugat", "cerai-talak"]) {
      expect(ids(kat(k), { pisahRumah: "sudah-pisah" })).toContain("q-puncak-akibat");
      expect(ids(kat(k), { pisahRumah: "masih-serumah" })).not.toContain("q-puncak-akibat");
    }
  });
  it("nafkah anak tanpa hak asuh: anak tinggal bersama siapa; harta bersama pewaris: separuh untuk pasangan yang masih hidup", () => {
    const km = kat("cerai-kumulasi").pertanyaan.find((q: Apa) => q.id === "q-na-anak-tinggal");
    expect(Mesin.cocokKeadaan(km.keadaan, { kumulasi: ["nafkah-anak"] })).toBe(true);
    expect(Mesin.cocokKeadaan(km.keadaan, { kumulasi: ["nafkah-anak", "hak-asuh"] })).toBe(false);
    const paw = kat("penetapan-ahli-waris");
    expect(ids(paw, { asalHarta: "selama-perkawinan" })).toContain("q-paw-harta-bersama-dipisah");
    expect(ids(paw, {})).not.toContain("q-paw-harta-bersama-dipisah");
    expect(ids(paw, { asalHarta: "selama-perkawinan", statusPasangan: "meninggal-lebih-dahulu" })).not.toContain("q-paw-harta-bersama-dipisah");
  });
});

describe("kinerja", () => {
  it("300 kalimat nikah + 300 posita cerai < 2 detik", () => {
    const k = "Pernikahan dilangsungkan dengan wali nikah yaitu Xxxa (Ayah Kandung Pemohon II) dan yang menikahkan adalah Xxxa (Ayah Kandung Pemohon II), dan dihadiri saksi nikah bernama Xxxc dan Xxxd";
    const t = Date.now();
    for (let i = 0; i < 300; i++) {
      nikah.peranNikah([`${k} ${i}`]);
      KP.turunkan("cerai-gugat", { posita: `<p>Bahwa Tergugat tidak lagi memberikan nafkah sejak bulan Maret 2026 ${i};</p>`, alurId: "15" });
    }
    expect(Date.now() - t).toBeLessThan(2000);
  });
});
