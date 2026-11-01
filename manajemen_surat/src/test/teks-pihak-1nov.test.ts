import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import * as TS from "@/lib/deteksi-sisa-blangko";

/**
 * KEPUTUSAN 55 + 56 (Derry, 31 Okt malam; dikerjakan 1 Nov 2026).
 *
 *   55. SEMUA teks dari para pihak (gugatan/posita/petitum, jawaban, replik, duplik, rekonvensi, kesimpulan) disalin APA ADANYA di
 *       semua skenario BAS dan putusan: tidak diubah, dirapikan, atau dibetulkan salah ketiknya - KECUALI baris kosong/Enter.
 *       Deteksi sisa blangko tidak memerahkan teks salinan pihak (temuan di dalamnya hanya info di .txt).
 *   56. Dua berkas e-Court atau lebih untuk bagian yang sama: panel memberi tahu, petugas dapat melihat/memilih masing-masing; bawaan =
 *       yang terakhir diunggah. Satu berkas: tanpa klik tambahan.
 *
 * Fixture REKAAN (nama dan nomor dikarang). Salah ketik, ";", huruf kecil, dan "..." sengaja ditanam di dalam teks pihak.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const N: Apa = muat(path.join(AKAR, "aleta_bot/services/naskahJawabMenjawabService.js"));
const J: Apa = muat(path.join(AKAR, "aleta_bot/services/jawabMenjawabEcourtService.js"));
const TJ: Apa = muat(path.join(AKAR, "aleta_bot/services/tanyaJawabEcourtService.js"));
const KH: Apa = muat(path.join(AKAR, "aleta_bot/services/jawabKhususEcourtService.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const F: Apa = muat(path.join(AKAR, "manajemen_surat/src/test/fixtures/jawab-replik-31okt.cjs"));
const FT: Apa = muat(path.join(AKAR, "manajemen_surat/src/test/fixtures/tanya-jawab-bukti-ecourt.cjs"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const D: Apa = createRequire(path.join(AKAR, "ekstensi-sipp/x.js"))("./deteksi-sisa-blangko.js");

const CG = { lawan: "Penggugat", pelaku: "Tergugat" };
const CT = { lawan: "Pemohon", pelaku: "Termohon" };
const baris = (t: string) => String(t).split("\n");
const rapat = (t: string) => t.replace(/\s+/g, " ").trim();

function dok(judul: string, teks: string, jenis: string, pengunggah: string, diunggah: string, ekstra: Apa = {}) {
  return { judul, peran: "jawaban", teks, jenis, pengunggah, penuntutKode: /Penggugat/.test(pengunggah) ? "0046" : /Tergugat/.test(pengunggah) ? "0047" : "", diunggah, ...ekstra };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// 1. Naskah 12020-12028: salinan apa adanya
// ---------------------------------------------------------------------------------------------------------------------------------
/** Isi surat (setelah kop) dengan salah ketik, ";" di tengah, huruf kecil, "...", kata berulang, sebutan ganda, penanda janggal. */
const ISI_CACAT = [
  "DALAM POKOK PERKARA",
  "1 . bahwa tergugat tidak pernah meninggalkan penggugat; karena penggugat sendiri yang pergi dari rumah ... sejak bulan maret 2026;",
  "2.Bahwa Tergugat sudah memberi nafkah rutin tiap bulan kepada para Para pihak yang yang tidak benar adanya;",
  "3. Bahwa pembayarn nafkah dilakukan lewat rekening Tergugta sebesar Rp. ........ (........) setiap bulan; bahwa buktinya akan diajukan nanti...",
  "4. BAHWA SEMUA DALIL PENGGUGAT PADA ANGKA 5 TIDAK BENAR;",
  "5. Bahwa saya selaku Tergugat Rekonpensi menolak dalil Penggugat/Pemohon tentang kdrt [sic], karena tidak pernah terjadi;",
  "Berdasarkan hal tersebut, Tergugat mohon kepada Majelis Hakim:",
  "Menolak gugatan Penggugat/Pemohon seluruhnya;",
  "Menghukum Penggugat membayar biaya perkara.",
];
const SURAT_CACAT = F.pdf(["JAWABAN TERGUGAT", "Dengan hormat,", ...ISI_CACAT, "Demikian jawaban ini disampaikan.", "Hormat kami,", "Tergugat"], { lebar: 78, perHalaman: 14 });

describe("55 - naskah jawab-menjawab disalin apa adanya", () => {
  const h = N.naskahDariSurat(SURAT_CACAT, { sebutan: CG, penulis: "Tergugat" });

  it("tiap paragraf isi sama PERSIS dengan tulisan pihak: salah ketik, ';', huruf kecil, '...', kata berulang, penanda janggal, sebutan", () => {
    expect(baris(h.konvensi)).toEqual(ISI_CACAT);
    expect(h.rekonvensi).toBe("");
  });

  it("tidak ada perapian yang tersisa: ';' tengah, 'bahwa' kecil, '1 .', '2.Bahwa', 'Rekonpensi', 'Penggugat/Pemohon', 'saya', 'para Para', 'yang yang'", () => {
    const k = h.konvensi;
    expect(k).toContain("1 . bahwa tergugat tidak pernah meninggalkan penggugat; karena penggugat sendiri");
    expect(k).toContain("2.Bahwa Tergugat");
    expect(k).toContain("para Para pihak yang yang tidak");
    expect(k).toContain("Tergugta");
    expect(k).toContain("pembayarn");
    expect(k).toContain("sebesar Rp. ........ (........) setiap bulan; bahwa buktinya akan diajukan nanti...");
    expect(k).toContain("Rekonpensi");
    expect(k).toContain("Penggugat/Pemohon");
    expect(k).toContain("5. Bahwa saya selaku");
    expect(k).toContain("[sic]");
    expect(k).toContain("4. BAHWA SEMUA DALIL PENGGUGAT PADA ANGKA 5 TIDAK BENAR;");
    // Sebutan perkara cerai talak (Pemohon/Termohon) tidak memaksa penggantian kata pihak.
    const t = N.naskahDariSurat(SURAT_CACAT, { sebutan: CT, penulis: "Termohon" });
    expect(t.konvensi).toBe(h.konvensi);
  });

  it("satu-satunya yang berubah: baris kosong/Enter, spasi ganda, dan sambungan baris PDF", () => {
    const denganKosong = F.pdf(["JAWABAN TERGUGAT", "", "Dengan hormat,", "", ...ISI_CACAT.flatMap((p) => [p, ""]), "Demikian jawaban ini disampaikan.", "Hormat kami,", "Tergugat"], { lebar: 78, perHalaman: 14 });
    const g = N.naskahDariSurat(denganKosong, {});
    expect(baris(g.konvensi)).toEqual(ISI_CACAT);
    const spasiGanda = N.naskahDariSurat(SURAT_CACAT.replace("tidak pernah", "tidak   pernah"), {});
    expect(spasiGanda.konvensi).toContain("tidak pernah meninggalkan");
  });

  it("keputusan 55 berlaku pada fixture lain: setiap baris keluaran = satu paragraf sumber (tanpa nomor ditambah, tanpa ';' dipecah)", () => {
    for (const [par, surat, opsi] of [
      [F.PAR_JAWABAN_REKON, F.JAWABAN_REKON, { sebutan: CT, penulis: "Termohon" }],
      [F.PAR_JAWABAN_LENGKAP, F.JAWABAN_LENGKAP, { sebutan: CG, penulis: "Tergugat" }],
    ] as Array<[string[], string, Apa]>) {
      const h2 = N.naskahDariSurat(surat, opsi);
      const sumber = new Set(par.map(rapat));
      for (const l of baris(`${h2.konvensi}\n${h2.rekonvensi}`).filter(Boolean)) expect(sumber.has(rapat(l)), `bukan paragraf sumber: ${l}`).toBe(true);
    }
  });

  it("hanya huruf yang tak dapat disimpan ABT (kutip/garis lengkung, titik tiga) yang disesuaikan - dan dicatat", () => {
    const lengkung = F.pdf(["JAWABAN TERGUGAT", ...ISI_CACAT.slice(0, 1), "2. Bahwa Tergugat berkata “tidak benar” dan ‘ya’ – sebagaimana diketahui… sejak lama dan berulang kali di depan keluarga;", ...ISI_CACAT.slice(2)], { lebar: 90 });
    const g = N.naskahDariSurat(lengkung, {});
    expect(g.konvensi).toContain('2. Bahwa Tergugat berkata "tidak benar" dan \'ya\' - sebagaimana diketahui... sejak lama');
    expect(g.catatan.join(" ")).toMatch(/tidak dapat disimpan ABT/);
  });

  it("sub-judul persis seperti ditulis dan pemisahan rekonvensi tetap bekerja tanpa sub-judul tambahan", () => {
    const g = N.naskahDariSurat(F.JAWABAN_REKON, { sebutan: CT, penulis: "Termohon" });
    expect(g.konvensi.startsWith("DALAM KONVENSI\n")).toBe(true);
    expect(g.rekonvensi.startsWith("DALAM REKONVENSI\n")).toBe(true);
    const tanpaJudul = N.naskahDariSurat(F.pdf(F.PAR_JAWABAN_LENGKAP.filter((p: string) => !/^DALAM POKOK PERKARA$/i.test(p)), { lebar: 90 }), {});
    expect(tanpaJudul.konvensi).not.toMatch(/Dalam Konvensi/i);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// 2. Frasa/pokok yang dikutip dari teks pihak (8436/8437/9355/9491/9681/9164) dan baris tanya-jawab tertulis
// ---------------------------------------------------------------------------------------------------------------------------------
describe("55 - kutipan pokok dan kesimpulan juga apa adanya", () => {
  const kesimpulan = ["KESIMPULAN PENGGUGAT", "Bahwa dari persidangan terbukti Penggugat tetap pada gugatannya semula, sebab tergugat tidak pernah memberi nafkah selama berpisah rumah;", "Demikian kesimpulan ini.", "Hormat kami,"].join("\n");

  it("8436: 'gugatannya' tidak diubah jadi 'gugatan', huruf kecil 'tergugat' tidak dibetulkan", () => {
    const h = J.susunJawabMenjawab({ dokumen: [dok("Kesimpulan Penggugat", kesimpulan, "Kesimpulan", "Penggugat", "2026-08-27", { peran: "kesimpulan" })], sebutan: CG });
    const u = h.usulan.find((x: Apa) => x.kode === "8436");
    expect(u.nilai).toBe("tetap pada gugatannya semula, sebab tergugat tidak pernah memberi nafkah selama berpisah rumah");
    expect(J.klausaKesimpulan(J.bersihkanSurat(kesimpulan)).klausa).toMatch(/^tetap pada gugatannya semula/);
  });

  it("9355: pokok jawaban memuat 'saya', huruf besar, dan salah ketik apa adanya (hanya 'Bahwa' di depan dan tanda baca akhir yang dilepas)", () => {
    const jawab = ["JAWABAN", "Bahwa SAYA mengakui telah menikah dengan Pemohon pada tahun 2015 dan telah dikaruniai 2 orang anak yang yang tinggal bersama saya;", "Bahwa saya menolak dalil Pemohon angka 4 karena pembayarn nafkah selalu lancar;", "Demikian."].join("\n");
    const h = J.susunJawabMenjawab({ dokumen: [dok("Jawaban", jawab, "Jawaban", "Termohon", "2026-08-05")], sebutan: CT });
    const u = h.usulan.find((x: Apa) => x.kode === "9355");
    expect(u.nilai).toBe("SAYA mengakui telah menikah dengan Pemohon pada tahun 2015 dan telah dikaruniai 2 orang anak yang yang tinggal bersama saya");
    expect(h.dokumen[0].butir.join(" ")).toMatch(/pembayarn/);
    expect(h.dokumen[0].catatan.join(" ")).toMatch(/disalin apa adanya/);
  });

  it("9164: tanggapan atas sita - 'saya', huruf awal, dan sebutan tidak diganti", () => {
    const bersih = J.bersihkanSurat(["JAWABAN", "Bahwa saya keberatan atas permohonan sita jaminan karena Objek yang dimohonkan adalah harta pribadi saya sebelum menikah;", "Bahwa lain-lain tidak benar adanya menurut Penggugat/Pemohon;"].join("\n"));
    const t = KH.tanggapanSita(bersih, { sebutan: CG, penulis: "Tergugat" });
    expect(t.nilai).toBe("keberatan atas permohonan sita jaminan karena Objek yang dimohonkan adalah harta pribadi saya sebelum menikah");
    expect(t.orangPertama).toBe(true);
    const b2 = J.bersihkanSurat(FT.JAWABAN_SITA_HB);
    expect(KH.tanggapanSita(b2, { sebutan: CG, penulis: "Tergugat" }).nilai).toMatch(/^keberatan atas permohonan sita jaminan yang diajukan Penggugat/);
  });

  it("baris tanya-jawab tertulis: judul bagian persis; huruf awal, salah ketik, 'Penggugat/Pemohon' tidak diubah; 'saya' -> tidak ditulis otomatis", () => {
    const surat = ["JAWABAN TERGUGAT", "DALAM KONVENSI", "Bahwa tergugat membantah dalil penggugat pada angka 3 karena pembayarn nafkah selalu lancar dan tidak pernah terlambat sama sekali menurut Penggugat/Pemohon;", "Bahwa tergugat tidak pernah meninggalkan tempat kediaman bersama selama ini sebagaimana didalilkan dalam gugatan;", "Bahwa tergugat tetap pada jawaban dan menolak seluruh dalil gugatan yang tidak diakui secara tegas oleh tergugat sendiri;", "Demikian jawaban ini.", "Hormat kami,"].join("\n");
    const k = J.kenaliJenis({ jenis: "Jawaban", judul: "Jawaban", pengunggah: "Tergugat", penuntutKode: "0047", teks: surat });
    const h = TJ.tanyaJawabDariSurat({ teks: surat, k, sebutan: CG });
    const jawab = h.baris.filter((r: Apa) => r.jawab).map((r: Apa) => r.jawab);
    if (h.rapi) {
      expect(h.baris[0].tanya).toBe("DALAM KONVENSI:");
      expect(jawab[0]).toBe("tergugat membantah dalil penggugat pada angka 3 karena pembayarn nafkah selalu lancar dan tidak pernah terlambat sama sekali menurut Penggugat/Pemohon;");
    }
    const aku = surat.replace("Bahwa tergugat membantah", "Bahwa saya membantah");
    const h2 = TJ.tanyaJawabDariSurat({ teks: aku, k, sebutan: CG });
    expect(h2.rapi).toBe(false);
    expect(h2.baris).toEqual([]);
    expect(h2.alasan.join(" ")).toMatch(/kata ganti orang pertama/);
  });

  it("tidak ada lagi fungsi yang mengganti sebutan/kata ganti pada teks pihak", () => {
    expect(J.periksaOrangPertama("Bahwa saya setuju").teks).toBe("Bahwa saya setuju");
    expect(typeof J.samakanSebutan).toBe("undefined");
    expect(typeof N.samakanPihak).toBe("undefined");
    expect(typeof N.pecahTitikKoma).toBe("undefined");
    expect(typeof N.nomoriPetitum).toBe("undefined");
    expect(typeof N.gantiOrangPertama).toBe("undefined");
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// 3. Deteksi sisa blangko tidak memerahkan teks salinan pihak
// ---------------------------------------------------------------------------------------------------------------------------------
const rtf = (...par: string[]) => `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}{\\colortbl;\\red0\\green0\\blue0;}${par.map((p) => `\\pard ${p}\\par`).join("")}}`;
const SALINAN_PIHAK = [
  "3. Bahwa pembayarn nafkah dilakukan lewat rekening Tergugta sebesar Rp. ........ (........) setiap bulan; bahwa buktinya akan diajukan nanti...",
  "4. Bahwa saya bertemu para Para pihak yang yang tidak benar dan menulis [sic] di kolom [....] tanpa ujung",
];
const NASKAH_UJI = rtf("PUTUSAN", "Menimbang, bahwa Penggugat mendalilkan sebagai berikut:", SALINAN_PIHAK[0], SALINAN_PIHAK[1], "Menimbang, bahwa Tergugat bernama [nama tergugat] dan beralamat di ........ Palu;");

describe("55 - deteksi sisa blangko dan teks pihak", () => {
  it("tanpa teksPihak perilaku lama: sisa di salinan pihak ikut tertangkap (kontrol)", () => {
    const h = D.periksaRtf(NASKAH_UJI);
    expect(h.temuan.length).toBeGreaterThanOrEqual(4);
    expect(h.infoPihak).toBeUndefined();
  });

  it("dengan teksPihak: temuan di dalam salinan pihak hanya info; sisa blangko sungguhan tetap tertangkap", () => {
    const h = D.periksaRtf(NASKAH_UJI, { teksPihak: [SALINAN_PIHAK.join("\n")] });
    const cocok = h.temuan.map((t: Apa) => t.cocok);
    expect(cocok).toEqual(expect.arrayContaining(["[nama tergugat]"]));
    expect(h.temuan.some((t: Apa) => /Rp\. \.\.\.|\[sic\]|\[\.\.\.\.\]|yang yang|\.\.\.\.\.\.\.\./.test(t.cocok) && /pembayarn|bertemu/.test(`${t.sebelum}${t.sesudah}`))).toBe(false);
    expect(h.infoPihak.length).toBeGreaterThanOrEqual(3);
    expect(h.infoPihak.every((t: Apa) => /pembayarn|bertemu|Rp\.|sic|yang yang|\.\.\./.test(`${t.sebelum}${t.cocok}${t.sesudah}`))).toBe(true);
  });

  it("merahkanRtf: paragraf salinan pihak TIDAK diwarnai, sisa blangko sungguhan diwarnai", () => {
    const tanpa = D.merahkanRtf(NASKAH_UJI, { jenis: "putusan" });
    expect(tanpa.rtf).toMatch(/\\cf\d+ [^\\]*\.\.\.\./);
    const m = D.merahkanRtf(NASKAH_UJI, { jenis: "putusan", teksPihak: SALINAN_PIHAK });
    const bagianPihak = m.rtf.slice(m.rtf.indexOf(SALINAN_PIHAK[0].slice(0, 20)), m.rtf.indexOf("Menimbang, bahwa Tergugat bernama"));
    expect(bagianPihak).not.toMatch(/\\cf[1-9]/);
    expect(m.rtf).toMatch(/\\cf\d+ \[nama tergugat\]/);
    expect(m.jumlah).toBeGreaterThan(0);
  });

  it("pencocokan tahan beda spasi/huruf besar-kecil/kutip lengkung; teks terlalu pendek tidak ikut", () => {
    const pihak = [`${SALINAN_PIHAK[0].replace('"', "")}`.toUpperCase().replace(/ {1}/g, "  ")];
    const m = D.periksaRtf(NASKAH_UJI, { teksPihak: pihak });
    expect(m.infoPihak.length).toBeGreaterThanOrEqual(1);
    const pendek = D.periksaRtf(rtf("Rp. .......", "[nama]"), { teksPihak: ["Rp. ......."] });
    expect(pendek.temuan.length).toBeGreaterThanOrEqual(2);
  });

  it("salinan TS sama dengan JS (satu aturan, dua salinan) termasuk infoPihak dan daftar .txt", () => {
    const opsi = { teksPihak: [SALINAN_PIHAK.join("\n")] };
    const j = D.periksaRtf(NASKAH_UJI, opsi);
    const t = TS.periksaRtf(NASKAH_UJI, opsi);
    expect(t).toEqual(j);
    expect(TS.periksaRtf(NASKAH_UJI)).toEqual(D.periksaRtf(NASKAH_UJI));
    const txtJ = D.susunDaftarTxt(j.temuan, { nama: "putusan.rtf", jenis: "putusan", infoPihak: j.infoPihak });
    const txtT = TS.susunDaftarTxt(t.temuan, { nama: "putusan.rtf", jenis: "putusan", infoPihak: t.infoPihak });
    expect(txtT).toBe(txtJ);
    expect(txtJ).toMatch(/Info \(bukan masalah\): \d+ hal ada di dalam teks salinan dari para pihak/);
    expect(txtJ).toMatch(/tidak diwarnai merah, dan tidak perlu diperbaiki/);
    // Tanpa infoPihak daftar .txt sama dengan sebelumnya.
    expect(D.susunDaftarTxt(j.temuan, { nama: "a.rtf" })).not.toMatch(/Info \(bukan masalah\)/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// 4. Keputusan 56: dua berkas atau lebih
// ---------------------------------------------------------------------------------------------------------------------------------
describe("56 - beberapa berkas untuk bagian yang sama", () => {
  const dua = () => [
    dok("Jawaban Awal Tergugat", F.JAWABAN_LENGKAP, "Jawaban", "Tergugat", "2026-09-09"),
    dok("Jawaban Perbaikan Tergugat", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-09-15"),
  ];
  const u12020 = (dokumen: Apa[]) => S.susunIsiGugatan({ dokumen, sebutan: CG }).usulan.find((x: Apa) => x.kode === "12020");

  it("dua berkas: usulan = yang TERAKHIR diunggah (saran), semua berkas ikut di pilihan, terakhir paling atas", () => {
    const u = u12020(dua());
    expect(u.keyakinan).toBe("ragu");
    expect(u.dokumen).toBe("Jawaban Perbaikan Tergugat");
    expect(u.berkasBanyak).toBe(2);
    expect(u.pilihan).toHaveLength(2);
    expect(u.pilihan[0].keadaan).toMatch(/^Jawaban Perbaikan Tergugat, diunggah 15 September 2026 \(terakhir diunggah, bawaan\)$/);
    expect(u.pilihan[0].nilai).toBe(u.nilai);
    expect(u.pilihan[1].keadaan).toBe("Jawaban Awal Tergugat, diunggah 9 September 2026");
    expect(u.pilihan[1].nilai).toBe(N.naskahDariSurat(F.JAWABAN_LENGKAP, {}).konvensi);
    expect(u.pilihan[1].nilai).not.toBe(u.pilihan[0].nilai);
    expect(u.catatan).toMatch(/Ada 2 berkas jawaban di e-Court \("Jawaban Perbaikan Tergugat", 15 September 2026; "Jawaban Awal Tergugat", 9 September 2026\)/);
    expect(u.catatan).toMatch(/kotak pilihan berkas/);
  });

  it("urutan masukan terbalik tidak mengubah bawaan: tetap yang terakhir diunggah", () => {
    const u = u12020(dua().reverse());
    expect(u.dokumen).toBe("Jawaban Perbaikan Tergugat");
    expect(u.pilihan[0].keadaan).toMatch(/terakhir diunggah, bawaan/);
  });

  it("tiga berkas: semua tampil, urutan dari yang terbaru", () => {
    const u = u12020([...dua(), dok("Jawaban Ketiga", F.JAWABAN_REKON, "Jawaban", "Tergugat", "2026-09-20")]);
    expect(u.pilihan.map((p: Apa) => p.keadaan.split(",")[0])).toEqual(["Jawaban Ketiga", "Jawaban Perbaikan Tergugat", "Jawaban Awal Tergugat"]);
    expect(u.berkasBanyak).toBe(3);
  });

  it("bagian rekonvensi ikut: gugatan rekonvensi (12021) membawa pilihan berkas yang punya bagian rekonvensi", () => {
    const g = S.susunIsiGugatan({
      dokumen: [dok("Jawaban Lama", F.JAWABAN_REKON, "Jawaban", "Tergugat", "2026-07-27"), dok("Jawaban Baru", F.JAWABAN_REKON.replace("nafkah iddah selama 3", "nafkah iddah selama 4"), "Jawaban", "Tergugat", "2026-08-02")],
      sebutan: CT,
    });
    const r = g.usulan.find((x: Apa) => x.kode === "12021");
    expect(r.pilihan).toHaveLength(2);
    expect(r.pilihan[0].nilai).toMatch(/nafkah iddah selama 4/);
    expect(r.pilihan[1].nilai).toMatch(/nafkah iddah selama 3/);
    expect(r.pilihan[0].keadaan).toMatch(/Jawaban Baru.*terakhir diunggah/);
  });

  it("satu berkas: tanpa pilihan, tanpa catatan 'beberapa berkas', keyakinan cukup (ditulis sendiri tanpa klik tambahan)", () => {
    const u = u12020([dua()[1]]);
    expect(u.keyakinan).toBe("cukup");
    expect(u.pilihan).toBeUndefined();
    expect(u.berkasBanyak).toBeUndefined();
    expect(u.catatan).not.toMatch(/Ada \d+ berkas/);
  });

  it("peran lain tidak ikut: replik dan jawaban masing-masing berdiri sendiri", () => {
    const g = S.susunIsiGugatan({ dokumen: [...dua(), dok("Replik Penggugat", F.REPLIK_REKON, "Replik", "Penggugat", "2026-09-20", { peran: "replik" })], sebutan: CT });
    expect(g.usulan.find((x: Apa) => x.kode === "12022").pilihan).toBeUndefined();
    expect(g.usulan.find((x: Apa) => x.kode === "12020").pilihan).toHaveLength(2);
  });

  describe("mesin isi bersama di ekstensi", () => {
    const ctx: Apa = {};
    ctx.globalThis = ctx;
    vm.runInNewContext(readFileSync(path.join(AKAR, "ekstensi-sipp/isi-sipp-bersama.js"), "utf8"), ctx);
    const m = ctx.AletaIsiSipp;
    const katalog = (kode: string) => [{ kode, nama: "Uraian", jenis: "teks", kosong: true }];

    it("dua berkas: tidak ditulis sendiri (saran = yang terakhir), pilihan berkas lengkap untuk panel", () => {
      const usulan = S.susunIsiGugatan({ dokumen: dua(), sebutan: CG }).usulan;
      const peta = m.pilihPerKode([usulan], new Set(["12020"]));
      const r = m.rencanakan(peta, katalog("12020"), () => "", [usulan]);
      expect(r.tulis).toEqual([]);
      expect(r.saran).toHaveLength(1);
      expect(r.saran[0].nilai).toBe(u12020(dua()).nilai);
      const info = r.info["12020"];
      expect(info.golongan).toBe("saran");
      expect(info.pilihan).toHaveLength(2);
      expect(info.pilihan[0].keadaan).toMatch(/terakhir diunggah, bawaan/);
      expect(info.pilihan[0].nilai).toBe(r.saran[0].nilai);
      expect(info.catatan).toMatch(/Ada 2 berkas jawaban di e-Court/);
    });

    it("satu berkas: ditulis sendiri tanpa pilihan (tanpa klik tambahan)", () => {
      const usulan = S.susunIsiGugatan({ dokumen: [dua()[1]], sebutan: CG }).usulan;
      const peta = m.pilihPerKode([usulan], new Set(["12020"]));
      const r = m.rencanakan(peta, katalog("12020"), () => "", [usulan]);
      expect(r.tulis.map((x: Apa) => x.kode)).toEqual(["12020"]);
      expect((r.info["12020"] || {}).pilihan || []).toEqual([]);
    });

    it("dua berkas yang isinya sama persis: pilihan tidak digandakan", () => {
      const usulan = S.susunIsiGugatan({ dokumen: [dok("A", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-09-09"), dok("B", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-09-15")], sebutan: CG }).usulan;
      const peta = m.pilihPerKode([usulan], new Set(["12020"]));
      const r = m.rencanakan(peta, katalog("12020"), () => "", [usulan]);
      expect(r.info["12020"].pilihan).toHaveLength(1);
    });

    it("kode isian salinan pihak di ekstensi = di bot (satu daftar)", () => {
      expect([...m.KODE_TEKS_PIHAK]).toEqual([...N.KODE_TEKS_PIHAK_ISIAN]);
      for (const k of N.KODE_BERBARIS) expect(m.KODE_TEKS_PIHAK).toContain(k);
      for (const k of ["8436", "8437", "9355", "9491", "9681", "9164"]) expect(m.KODE_TEKS_PIHAK).toContain(k);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
// 5. Panel: penyimpanan isian salinan pihak tidak dirapikan
// ---------------------------------------------------------------------------------------------------------------------------------
describe("55 - panel menyimpan isian salinan pihak apa adanya (rapiSimpan)", () => {
  const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8");
  const awal = sumber.indexOf("  function rapiSimpan(kode, nilai) {");
  const akhir = sumber.indexOf("  async function simpanIsian(kode, nilai) {");
  expect(awal).toBeGreaterThan(0);
  expect(akhir).toBeGreaterThan(awal);
  const ctxMesin: Apa = {};
  ctxMesin.globalThis = ctxMesin;
  vm.runInNewContext(readFileSync(path.join(AKAR, "ekstensi-sipp/isi-sipp-bersama.js"), "utf8"), ctxMesin);
  const saksi = createRequire(path.join(AKAR, "ekstensi-sipp/x.js"))("./blangko-derry-saksi.js");
  const konteks = vm.createContext({ mesinIsi: () => ctxMesin.AletaIsiSipp, SK: () => saksi, isianBlangko: () => ({ jenis: "teks", khusus: "" }) });
  vm.runInContext(`${sumber.slice(awal, akhir)}\nthis.rapiSimpan = rapiSimpan;`, konteks);
  const rapiSimpan = (konteks as Apa).rapiSimpan as (k: string, n: string) => string;

  it("isian teks biasa tetap dirapikan (aturan 30 Okt): ';' tengah jadi ','", () => {
    expect(rapiSimpan("0007", "belum dikaruniai anak ; Penggugat ingin bercerai ;;")).toBe("belum dikaruniai anak, Penggugat ingin bercerai;");
  });

  it("kutipan teks pihak (8436/8437/9355/9491/9681/9164) disimpan persis: ';' tengah, spasi sebelum tanda baca, huruf kecil, '..'", () => {
    const t = "tetap pada gugatannya ; sebab tergugat tidak pernah  memberi nafkah ,karena pembayarn macet.. ;;";
    for (const k of ["8436", "8437", "9355", "9491", "9681", "9164"]) expect(rapiSimpan(k, t), k).toBe(t);
  });

  it("naskah 12020-12028: hanya baris kosong dan spasi ganda yang dirapikan; ';' tengah dan isi lain persis", () => {
    const t = "DALAM POKOK PERKARA  \r\n\r\n1 . bahwa tergugat tidak pernah ; karena penggugat pergi ...\n\n\n2.Bahwa para Para pihak yang yang;; benar";
    expect(rapiSimpan("12020", t)).toBe("DALAM POKOK PERKARA\n1 . bahwa tergugat tidak pernah ; karena penggugat pergi ...\n2.Bahwa para Para pihak yang yang;; benar");
    for (const k of N.KODE_BERBARIS) expect(rapiSimpan(k, "Satu ; dua\n\nTiga")).toBe("Satu ; dua\nTiga");
  });
});

describe("berkas sumber bersih", () => {
  it("tanpa karakter kendali tersembunyi (\\b salah ketik mematikan pola diam-diam)", () => {
    for (const rel of [
      "aleta_bot/services/jawabMenjawabEcourtService.js",
      "aleta_bot/services/naskahJawabMenjawabService.js",
      "aleta_bot/services/tanyaJawabEcourtService.js",
      "aleta_bot/services/jawabKhususEcourtService.js",
      "ekstensi-sipp/deteksi-sisa-blangko.js",
      "ekstensi-sipp/isi-sipp-bersama.js",
      "manajemen_surat/src/lib/deteksi-sisa-blangko.ts",
    ]) {
      expect(readFileSync(path.join(AKAR, rel), "utf8"), rel).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    }
  });
});
