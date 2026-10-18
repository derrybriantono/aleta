import path from "node:path";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { bacaIsiGugatan, peranDokumen, penuntutDari, pilihJawabUntukDibaca, rencanaBaca } from "@/server/modules/aleta-ecourt/isi-gugatan";
import type { DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";

/**
 * JJ (18 Okt 2026): jawab-menjawab TERTULIS dari e-Court -> ABT. Berkas e-Court sungguhan tidak ada di laptop, jadi
 * semua teks di sini REKAAN (fixtures/jawab-menjawab-ecourt.cjs; tanpa data pribadi). Yang diuji: pengenalan jenis dokumen
 * (metadata + isi), pembersihan surat, pokok yang setia kata-kata surat, penanda rekonvensi yang ketat, isian petugas yang
 * selalu menang (jagaIsianLama), tanpa kata "Aleta" dan tanpa kode #nnnn# di teks tampil.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;
const J: Apa = muat(path.join(AKAR, "aleta_bot/services/jawabMenjawabEcourtService.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const F: Apa = muat(path.join(AKAR, "manajemen_surat/src/test/fixtures/jawab-menjawab-ecourt.cjs"));

const SEBUTAN = { lawan: "Penggugat", pelaku: "Tergugat" };

const dok = (judul: string, jenis: string, pengunggah: string, teks: string, penuntutKode = "") => ({
  judul,
  peran: /kesimpulan/i.test(jenis) ? "kesimpulan" : /duplik|rereplik/i.test(jenis) ? "duplik" : /replik/i.test(jenis) ? "replik" : "jawaban",
  jenis,
  pengunggah,
  penuntutKode,
  teks,
});

const SEMUA = [
  dok("Jawaban Tergugat", "Jawaban", "Tergugat", F.JAWABAN_PDF, "0047"),
  dok("Replik", "Replik", "Penggugat", F.REPLIK, "0046"),
  dok("Duplik", "Duplik", "Tergugat", F.DUPLIK, "0047"),
  dok("Kesimpulan Penggugat", "Kesimpulan", "Penggugat", F.KESIMPULAN_PENGGUGAT, "0046"),
  dok("Kesimpulan Tergugat", "Kesimpulan", "Tergugat", F.KESIMPULAN_TERGUGAT, "0047"),
];

const kata = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);

describe("JJ - pengenalan jenis dokumen (metadata + isi)", () => {
  it("jenis e-Court dipetakan; Rereplik = duplik rekonvensi; judul peran-ganda mengikuti kata pertama", () => {
    expect(J.kenaliJenis({ jenis: "Jawaban", judul: "Jawaban dari Tergugat", pengunggah: "Tergugat" })).toMatchObject({ peran: "jawaban", pihak: "0047", ragu: false });
    expect(J.kenaliJenis({ jenis: "Rereplik", judul: "Duplik Rekonvensi", pengunggah: "Penggugat" })).toMatchObject({ peran: "duplik", pihak: "0046", rekonvensiDuplik: true });
    expect(J.kenaliJenis({ jenis: "", judul: "Replik dan Jawaban Rekonvensi", pengunggah: "Penggugat" }).peran).toBe("replik");
    expect(J.kenaliJenis({ jenis: "", judul: "DUPLIK DAN REPLIK REKONVENSI", pengunggah: "Tergugat" }).peran).toBe("duplik");
    expect(J.kenaliJenis({ jenis: "Permohonan Pencabutan", judul: "Pencabutan", pengunggah: "Penggugat" }).peran).toBe("lain");
  });

  it("jenis dan judul bertentangan: ditandai ragu; Turut Tergugat bukan pihak utama", () => {
    // "Replik" berjudul "Jawaban dari penggugat" (kasus nyata di arsip): jenis menang, tetapi ragu.
    const r = J.kenaliJenis({ jenis: "Replik", judul: "Jawaban dari penggugat", pengunggah: "Penggugat", penuntutKode: "0046" });
    expect(r).toMatchObject({ peran: "replik", pihak: "0046", ragu: true });
    const turut = J.kenaliJenis({ jenis: "Jawaban", judul: "JAWABAN TURUT TERGUGAT", pengunggah: "Turut Tergugat", penuntutKode: "0047" });
    expect(turut).toMatchObject({ peran: "jawaban", turut: true, pihak: "" });
  });

  it("isi surat menimbang ulang: daftar bukti yang diunggah sebagai Kesimpulan bukan kesimpulan; judul isi menggantikan metadata yang salah", () => {
    const bukti = J.kenaliJenis({ jenis: "Kesimpulan", judul: "DAFTAR BUKTI SURAT", pengunggah: "Penggugat", teks: F.DAFTAR_BUKTI });
    expect(bukti).toMatchObject({ peran: "bukti", ragu: true });
    expect(bukti.catatan.join(" ")).toMatch(/berbeda dari jenis e-Court/);
    // "Rereplik" berjudul "Kesimpulan Penggugat" dan isinya memang kesimpulan.
    const kes = J.kenaliJenis({ jenis: "Rereplik", judul: "Kesimpulan Penggugat", pengunggah: "Penggugat", teks: F.KESIMPULAN_PENGGUGAT });
    expect(kes.peran).toBe("kesimpulan");
    // Isi sepakat dengan metadata: tanpa ragu.
    expect(J.kenaliJenis({ jenis: "Replik", judul: "Replik", pengunggah: "Penggugat", teks: F.REPLIK })).toMatchObject({ peran: "replik", ragu: false, dasar: "jenis+isi" });
  });

  it("pemanggil lama yang hanya menyebut peran tetap dikenali (peran rekonvensi = jawaban)", () => {
    expect(J.kenaliJenis({ judul: "Dokumen", peran: "jawaban", teks: "Bahwa benar." }).peran).toBe("jawaban");
    expect(J.kenaliJenis({ judul: "Dokumen", peran: "rekonvensi", teks: "Bahwa benar." }).peran).toBe("jawaban");
  });
});

describe("JJ - pembersihan surat", () => {
  it("kop, salam, identitas, penutup, tanda tangan, nomor halaman, dan kepala berulang dibuang", () => {
    const b = J.bersihkanSurat(F.JAWABAN_PDF);
    const semua = [...b.dalil, ...b.petitum].join(" ");
    for (const buang of ["Assalamu", "Wassalamu", "KANTOR HUKUM", "Selanjutnya disebut", "NIK", "Hormat kami", "Budi Santoso", "Kuasa Hukum", "Telp", "email", "Perihal", "- 2 -", "- 3 -", "PERKARA NOMOR 901"]) {
      expect(semua).not.toContain(buang);
    }
    expect(b.dibuang).toMatchObject({ nomorHalaman: 2, berulang: 3 });
    expect(b.yakin).toBe(true);
    // Petitum terpisah dari dalil.
    expect(b.petitum[0]).toMatch(/^Berdasarkan segala uraian di atas, Tergugat memohon/);
    expect(b.dalil.every((d: string) => /^Bahwa/.test(d))).toBe(true);
  });

  it("paragraf yang terpotong di ujung halaman tersambung", () => {
    const b = J.bersihkanSurat(F.JAWABAN_PDF);
    expect(b.dalil.some((d: string) => /hak asuh atas anak yang lahir dari perkawinan ini karena anak masih berusia di bawah 12 tahun/.test(d))).toBe(true);
  });

  it("surat orang awam tanpa kop: identitas dibuang, 'Demikian' dan tanda tangan tidak masuk dalil", () => {
    const b = J.bersihkanSurat(F.JAWABAN_AWAM);
    const semua = b.dalil.join(" ");
    expect(semua).not.toMatch(/Umur|Dusun|Demikian|Hormat saya/);
    expect(b.dalil).toHaveLength(3);
  });
});

describe("JJ - pokok surat setia pada kata-kata surat", () => {
  it("setiap butir hanya memakai kata yang ada di surat (selain sebutan pihak pengganti 'saya' dan akhiran -nya)", () => {
    const h = J.susunJawabMenjawab({ dokumen: SEMUA, sebutan: SEBUTAN });
    for (const d of h.dokumen.filter((x: Apa) => x.dipakai)) {
      const asli = new Set(kata(SEMUA[d.indeks].teks));
      for (const b of d.butir) {
        const tak = kata(b).filter((w) => !asli.has(w));
        expect(tak, `kata asing pada: ${b}`).toEqual([]);
      }
    }
  });

  it("jawaban awam: 'saya' diganti sebutan pihak dan ditandai ragu untuk diperiksa", () => {
    const h = J.susunJawabMenjawab({ dokumen: [dok("Jawaban Termohon", "Jawaban", "Termohon", F.JAWABAN_AWAM, "0047")], sebutan: { lawan: "Pemohon", pelaku: "Termohon" } });
    const d = h.dokumen[0];
    expect(d.butir[0]).toMatch(/^Bahwa Termohon mengakui telah menikah dengan Pemohon pada tahun 2015/);
    expect(d.butir.join(" ")).not.toMatch(/\bsaya\b/i);
    expect(d.ragu).toBe(true);
    expect(d.catatan.join(" ")).toMatch(/kata ganti orang pertama/);
  });

  it("gaya penulisan lain: butir bernomor, huruf besar semua, dan tanpa 'Bahwa' (tiap kalimat satu dalil)", () => {
    const olah = (jenis: string, pengunggah: string, teks: string) => J.susunJawabMenjawab({ dokumen: [dok("Surat", jenis, pengunggah, teks, pengunggah === "Penggugat" ? "0046" : "0047")], sebutan: SEBUTAN }).dokumen[0];
    const bernomor = olah("Jawaban", "Tergugat", ["JAWABAN TERGUGAT", "Dengan hormat,", "Saya yang bertanda tangan di bawah ini menyampaikan jawaban sebagai berikut:", "1. Bahwa benar Penggugat dan Tergugat telah menikah pada tanggal 5 Juni 2019 di Kecamatan Contoh.", "2. Bahwa tidak benar Tergugat pernah meninggalkan Penggugat selama berbulan-bulan, karena Tergugat bekerja di luar kota.", "Demikian jawaban ini saya buat dengan sebenar-benarnya.", "Hormat saya,", "ttd", "Rahmat"].join("\n"));
    expect(bernomor.butir).toEqual(["Bahwa benar Penggugat dan Tergugat telah menikah pada tanggal 5 Juni 2019 di Kecamatan Contoh", "Bahwa tidak benar Tergugat pernah meninggalkan Penggugat selama berbulan-bulan, karena Tergugat bekerja di luar kota"]);
    const besar = olah("Jawaban", "Tergugat", ["JAWABAN TERMOHON", "BAHWA TERMOHON MEMBANTAH DALIL PEMOHON PADA ANGKA 3 KARENA TIDAK BENAR;", "BAHWA TERMOHON TIDAK PERNAH MEMUKUL PEMOHON SEBAGAIMANA YANG DIDALILKAN;", "DEMIKIAN JAWABAN INI DISAMPAIKAN."].join("\n"));
    expect(besar.butir[0]).toBe("Bahwa Termohon membantah dalil Pemohon pada angka 3 karena tidak benar");
    expect(besar.ragu).toBe(true);
    expect(besar.catatan.join(" ")).toMatch(/huruf besar semua/);
    const tanpa = olah("Replik", "Penggugat", ["REPLIK", "Penggugat menolak seluruh dalil jawaban Tergugat dan tetap pada gugatan semula.", "Tergugat tidak pernah memberikan nafkah selama berpisah rumah dan tidak pernah menjenguk anak.", "Hormat kami"].join("\n"));
    expect(tanpa.butir).toHaveLength(2);
    expect(tanpa.ragu).toBe(true);
  });

  it("kutipan pasal tanpa sikap bukan pokok dalil; dalil panjang dipotong di batas klausa", () => {
    const h = J.susunJawabMenjawab({ dokumen: SEMUA.slice(0, 1), sebutan: SEBUTAN });
    expect(h.dokumen[0].butir.join(" ")).not.toMatch(/Pasal 39/);
    const panjang = "Bahwa Tergugat membantah dalil Penggugat karena " + "setiap bulan Tergugat menyerahkan penghasilan kepada Penggugat, ".repeat(8) + "sehingga dalil itu tidak benar;";
    const b = J.pokokSurat([panjang], { sebutan: SEBUTAN });
    expect(b.terpotong).toBe(true);
    expect(b.butir[0].length).toBeLessThanOrEqual(240);
    expect(b.butir[0]).not.toMatch(/[,;]$/);
  });
});

describe("JJ - penanda rekonvensi hanya bila jelas", () => {
  it("bagian 'Dalam Rekonvensi' + pasangan Penggugat/Tergugat Rekonvensi -> ada", () => {
    expect(J.deteksiRekonvensi(F.JAWABAN_PDF, J.bersihkanSurat(F.JAWABAN_PDF)).ada).toBe("ada");
  });
  it("negasi ('tidak mengajukan gugatan rekonvensi') dan jawaban biasa -> tidak", () => {
    expect(J.deteksiRekonvensi(F.JAWABAN_AWAM, J.bersihkanSurat(F.JAWABAN_AWAM)).ada).toBe("tidak");
    expect(J.deteksiRekonvensi(F.JAWABAN_EKSEPSI_KEWENANGAN, J.bersihkanSurat(F.JAWABAN_EKSEPSI_KEWENANGAN)).ada).toBe("tidak");
  });
  it("hak 'mengajukan rekonvensi kelak' di tengah dalil bukan gugatan balik", () => {
    const t = "JAWABAN TERGUGAT\nBahwa Tergugat berhak mengajukan gugatan rekonvensi pada waktunya bila diperlukan nanti dalam perkara ini;\nBahwa Tergugat membantah dalil Penggugat pada angka 3 karena tidak benar;";
    expect(J.deteksiRekonvensi(t, J.bersihkanSurat(t)).ada).toBe("tidak");
  });
  it("7084 hanya dari JAWABAN: replik yang menyebut 'jawaban rekonvensi' tidak memicunya", () => {
    const replik = dok("Replik Penggugat dan Jawaban Rekonvensi", "Replik", "Penggugat", "REPLIK DAN JAWABAN REKONVENSI\nDALAM REKONVENSI\nBahwa Penggugat Rekonvensi dan Tergugat Rekonvensi menolak dalil itu karena tidak benar sama sekali;", "0046");
    const h = J.susunJawabMenjawab({ dokumen: [replik], sebutan: SEBUTAN });
    expect(h.usulan.map((u: Apa) => u.kode)).not.toContain("7084");
    const dua = J.susunJawabMenjawab({ dokumen: SEMUA, sebutan: SEBUTAN });
    expect(dua.usulan.find((u: Apa) => u.kode === "7084")).toMatchObject({ nilai: "1", keyakinan: "ragu" });
  });
});

describe("JJ - usulan isian", () => {
  const h = J.susunJawabMenjawab({ dokumen: [...SEMUA, dok("DAFTAR BUKTI SURAT", "Kesimpulan", "Penggugat", F.DAFTAR_BUKTI, "0046")], sebutan: SEBUTAN });
  const per = Object.fromEntries(h.usulan.map((u: Apa) => [u.kode, u]));

  it("9881 tertulis (cukup); 8436/8437 kesimpulan kedua pihak ragu; tak ada yang pasti", () => {
    expect(per["9881"]).toMatchObject({ nilai: "tertulis", keyakinan: "cukup" });
    expect(per["8436"]).toMatchObject({ nilai: "tetap pada gugatan semula untuk bercerai dengan Tergugat", keyakinan: "ragu", kodePola: "kesimpulan-tetap-pada" });
    expect(per["8437"]).toMatchObject({ nilai: "tidak ingin bercerai dengan Penggugat karena masih ingin mempertahankan rumah tangga", keyakinan: "ragu" });
    for (const u of h.usulan) expect(u.keyakinan).not.toBe("pasti");
    expect(per["9881"].sumber[0].kalimat).not.toMatch(/DAFTAR BUKTI/);
  });

  it("isian petugas selalu menang: semua usulan membawa jagaIsianLama", () => {
    expect(h.usulan.length).toBeGreaterThanOrEqual(5);
    for (const u of h.usulan) expect(u.jagaIsianLama).toBe(true);
  });

  it("9355 pokok jawaban Tergugat; eksepsi arbitrase -> 9491, eksepsi kewenangan -> 9681", () => {
    expect(per["9355"].nilai).toMatch(/^Tergugat mengakui dalil Penggugat/);
    const eks = J.susunJawabMenjawab({ dokumen: [dok("Eksepsi dan Jawaban Tergugat", "Jawaban", "Tergugat", F.JAWABAN_EKSEPSI_KEWENANGAN, "0047")], sebutan: SEBUTAN });
    const k = Object.fromEntries(eks.usulan.map((u: Apa) => [u.kode, u]));
    expect(k["9491"]).toBeUndefined();
    expect(k["9681"].nilai).toMatch(/^pengadilan agama tidak berwenang memeriksa perkara ini/);
    expect(k["9681"].nilai).not.toMatch(/[.;]$/);
    const arb = "EKSEPSI DAN JAWABAN\nDALAM EKSEPSI\nBahwa sengketa ini harus diselesaikan melalui arbitrase sesuai klausula arbitrase dalam akad antara para pihak;\nDALAM POKOK PERKARA\nBahwa Tergugat menolak seluruh dalil Penggugat karena tidak benar;";
    const a = J.susunJawabMenjawab({ dokumen: [dok("Eksepsi", "Jawaban", "Tergugat", arb, "0047")], sebutan: SEBUTAN });
    expect(a.usulan.map((u: Apa) => u.kode)).toEqual(expect.arrayContaining(["9491"]));
  });

  it("tanpa dokumen jawab-menjawab (sidang lisan): tidak ada usulan sama sekali", () => {
    expect(J.susunJawabMenjawab({ dokumen: [], sebutan: SEBUTAN }).usulan).toEqual([]);
    const hanyaBukti = J.susunJawabMenjawab({ dokumen: [dok("DAFTAR BUKTI", "Kesimpulan", "Penggugat", F.DAFTAR_BUKTI, "0046")], sebutan: SEBUTAN });
    expect(hanyaBukti.usulan).toEqual([]);
    expect(hanyaBukti.catatan.join(" ")).toMatch(/daftar bukti/);
  });

  it("kesimpulan tanpa kalimat 'tetap pada' memakai permohonan putusan; tanpa keduanya, dalil pertama (ragu)", () => {
    const t = "KESIMPULAN TERGUGAT\nBahwa dari bukti yang diajukan tidak terbukti adanya perselisihan terus menerus;\nBerdasarkan hal tersebut, Tergugat memohon kepada Majelis Hakim untuk menolak gugatan Penggugat seluruhnya.";
    const r = J.susunJawabMenjawab({ dokumen: [dok("Kesimpulan Tergugat", "Kesimpulan", "Tergugat", t, "0047")], sebutan: SEBUTAN });
    expect(r.usulan.find((u: Apa) => u.kode === "8437")).toMatchObject({ kodePola: "kesimpulan-mohon-putusan", keyakinan: "ragu" });
    const tanpa = "KESIMPULAN TERGUGAT\nBahwa dari bukti yang diajukan tidak terbukti adanya perselisihan terus menerus dalam rumah tangga ini;";
    const r2 = J.susunJawabMenjawab({ dokumen: [dok("Kesimpulan Tergugat", "Kesimpulan", "Tergugat", tanpa, "0047")], sebutan: SEBUTAN });
    expect(r2.usulan.find((u: Apa) => u.kode === "8437")).toMatchObject({ kodePola: "kesimpulan-dalil-pertama", keyakinan: "ragu" });
  });

  it("tanpa kata 'Aleta' dan tanpa kode #nnnn# di teks tampil", () => {
    const teks = JSON.stringify({ usulan: h.usulan, kalimat: h.kalimat, catatan: h.catatan, dokumen: h.dokumen.map((d: Apa) => ({ ...d, dibuang: undefined })) });
    expect(teks).not.toMatch(/aleta/i);
    expect(teks).not.toMatch(/#\d{3,5}#/);
  });

  it("kalimat siap salin: butir jawaban/replik/duplik dan klausa kesimpulan; tanya-jawab 2018-2020 tidak ditulis otomatis", () => {
    const kode = h.kalimat.map((k: Apa) => k.kode);
    expect(kode).toEqual(expect.arrayContaining(["jawab-tertulis-jawaban-0047", "jawab-tertulis-replik-0046", "jawab-tertulis-duplik-0047", "jawab-tertulis-kesimpulan-0046", "jawab-tertulis-kesimpulan-0047"]));
    const jawaban = h.kalimat.find((k: Apa) => k.kode === "jawab-tertulis-jawaban-0047");
    expect(jawaban.teks.split("\n").every((b: string) => /^- Bahwa /.test(b))).toBe(true);
    // Tidak ada usulan variabel untuk tanya_jawab (kunci blangko 2018/2019/2020 dan 6112-6114).
    expect(h.usulan.map((u: Apa) => u.kode).filter((k: string) => /^(?:2018|2019|2020|6112|6113|6114)$/.test(k))).toEqual([]);
  });
});

describe("JJ - susunIsiGugatan menyatukan semuanya", () => {
  const gugatan = { judul: "Dokumen Gugatan", peran: "gugatan", jenis: "", pengunggah: "Penggugat", penuntutKode: "0046", teks: "GUGATAN CERAI\nBahwa Penggugat dan Tergugat menikah pada tanggal 10 Mei 2018 dan belum dikaruniai anak;\nPRIMAIR:\n1. Mengabulkan gugatan Penggugat;\n2. Menjatuhkan talak satu bain sughra Tergugat terhadap Penggugat;" };

  it("daftar bukti tidak dihitung jawab-menjawab; jawab memuat pokok bersih; usulan JJ ikut; kalimat salin ikut", () => {
    const hasil = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen: [gugatan, ...SEMUA, dok("DAFTAR BUKTI SURAT", "Kesimpulan", "Penggugat", F.DAFTAR_BUKTI, "0046")] });
    expect(hasil.jawab.map((j: Apa) => j.judul)).toEqual(["Jawaban Tergugat", "Replik", "Duplik", "Kesimpulan Penggugat", "Kesimpulan Tergugat"]);
    const jawaban = hasil.jawab[0];
    expect(jawaban).toMatchObject({ peran: "jawaban", rekonvensi: "ada", pihak: "0047" });
    expect(jawaban.ringkas).toMatch(/^Bahwa Tergugat mengakui dalil Penggugat/);
    expect(jawaban.ringkas).not.toMatch(/KANTOR HUKUM|Assalamu/);
    const kode = hasil.usulan.map((u: Apa) => u.kode);
    expect(kode).toEqual(expect.arrayContaining(["9881", "7084", "8436", "8437", "9355"]));
    expect(hasil.kalimat.map((k: Apa) => k.kode)).toContain("jawab-tertulis-replik-0046");
    expect(hasil.catatan.join(" ")).toMatch(/DAFTAR BUKTI SURAT: bukan jawab-menjawab/);
  });

  it("jawaban tanpa rekonvensi: 7084 tidak diusulkan; satu-satunya berkas 'jawaban' yang ternyata surat gugatan tidak memicu 9881", () => {
    const hasil = S.susunIsiGugatan({ sebutan: { lawan: "Pemohon", pelaku: "Termohon" }, dokumen: [gugatan, dok("Jawaban Termohon", "Jawaban", "Termohon", F.JAWABAN_AWAM, "0047")] });
    const kode = hasil.usulan.map((u: Apa) => u.kode);
    expect(kode).toContain("9881");
    expect(kode).not.toContain("7084");
    const salah = S.susunIsiGugatan({
      sebutan: SEBUTAN,
      dokumen: [gugatan, dok("Dokumen Gugatan", "Jawaban", "Tergugat", "GUGATAN CERAI\nBahwa Penggugat dan Tergugat menikah pada tahun 2018 dan sering bertengkar sejak lama;\nPRIMAIR:\n1. Mengabulkan gugatan Penggugat;\nSUBSIDAIR: mohon putusan yang seadil-adilnya;", "0047")],
    });
    expect(salah.usulan.map((u: Apa) => u.kode)).not.toContain("9881");
  });
});

describe("JJ - modul portal: pemilihan dan pengiriman berkas", () => {
  const baris = (documentKey: string, judulDokumen: string, jenisDokumen: string, peranPengunggah: string, diunggahPada: string): DokumenArsip => ({ documentKey, judulDokumen, jenisDokumen, peranPengunggah, diunggahPada, adaPdf: true, adaWord: true });

  it("peranDokumen: jenis e-Court menang atas judul; Rereplik = duplik; penuntutDari mengabaikan Turut Tergugat", () => {
    expect(peranDokumen(baris("a", "Jawaban dari penggugat", "Replik", "Penggugat", "2026-08-19"))).toBe("replik");
    expect(peranDokumen(baris("b", "Duplik Rekonvensi", "Rereplik", "Penggugat", "2026-08-20"))).toBe("duplik");
    expect(peranDokumen(baris("c", "Kesimpulan dari Termohon", "Kesimpulan", "Tergugat", "2026-08-21"))).toBe("kesimpulan");
    expect(peranDokumen(baris("d", "Eksepsi dan Jawaban Tergugat", "", "Tergugat", "2026-08-21"))).toBe("jawaban");
    expect(penuntutDari(baris("e", "JAWABAN TURUT TERGUGAT", "Jawaban", "Turut Tergugat", "2026-07-22"))).toBe("");
    expect(penuntutDari(baris("f", "Jawaban", "Jawaban", "Tergugat", "2026-07-22"))).toBe("0047");
  });

  it("perkara dengan 12 berkas jawab-menjawab: kesimpulan terakhir kedua pihak tetap terbaca", () => {
    const dokumen = [
      baris("g", "Dokumen Gugatan", "", "Penggugat", "2026-04-27"),
      baris("j1", "Jawaban dan gugatan Rekonvensi", "Jawaban", "Tergugat", "2026-05-29"),
      baris("j2", "Jawaban tambahan", "Jawaban", "Tergugat", "2026-05-30"),
      baris("r1", "replik dari Pemohon", "Replik", "Penggugat", "2026-06-02"),
      baris("r2", "replik lanjutan", "Replik", "Penggugat", "2026-06-03"),
      baris("d1", "Duplik", "Duplik", "Tergugat", "2026-06-05"),
      baris("d2", "Duplik lanjutan", "Duplik", "Tergugat", "2026-06-06"),
      baris("rr", "Duplik Rekonvensi", "Rereplik", "Penggugat", "2026-06-09"),
      baris("kp1", "Kesimpulan Pemohon (draf)", "Kesimpulan", "Penggugat", "2026-07-20"),
      baris("kp2", "Kesimpulan Pemohon", "Kesimpulan", "Penggugat", "2026-07-26"),
      baris("kt1", "Kesimpulan Termohon (draf)", "Kesimpulan", "Tergugat", "2026-07-21"),
      baris("kt2", "Kesimpulan Termohon", "Kesimpulan", "Tergugat", "2026-07-27"),
    ];
    const rencana = rencanaBaca(dokumen);
    const kunci = rencana.jawab.map((d) => d.documentKey);
    expect(rencana.jawab).toHaveLength(8);
    expect(kunci).toEqual(expect.arrayContaining(["kp2", "kt2", "j1", "r1", "d1", "rr"]));
    // Urut menurut waktu unggah.
    const waktu = (k: string) => String(dokumen.find((x) => x.documentKey === k)!.diunggahPada);
    expect(kunci).toEqual([...kunci].sort((a, b) => waktu(a).localeCompare(waktu(b))));
    // Di bawah batas: semua dibaca apa adanya.
    expect(pilihJawabUntukDibaca(dokumen.slice(1, 5))).toHaveLength(4);
  });

  it("jenis dan pengunggah e-Court ikut ke bot; daftar bukti berjenis Kesimpulan dikeluarkan dari hasil", async () => {
    const DOK = [
      baris("k-gugat", "Dokumen Gugatan", "", "Penggugat", "2026-07-01"),
      baris("k-jawab", "Jawaban Tergugat", "Jawaban", "Tergugat", "2026-07-20"),
      baris("k-bukti", "DAFTAR BUKTI SURAT", "Kesimpulan", "Penggugat", "2026-08-19"),
    ];
    const teks: Record<string, string> = {
      "k-gugat":
        "GUGATAN CERAI\nBahwa Penggugat dan Tergugat menikah pada tanggal 10 Mei 2018 dan belum dikaruniai anak;\nBahwa sejak awal tahun 2024 rumah tangga Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran yang disebabkan masalah ekonomi dan campur tangan keluarga;\nBahwa sejak bulan Januari 2025 Penggugat dan Tergugat telah berpisah tempat tinggal dan tidak lagi hidup bersama sebagai suami isteri;\nPRIMAIR:\n1. Mengabulkan gugatan Penggugat;\n2. Menjatuhkan talak satu bain sughra Tergugat terhadap Penggugat;",
      "k-jawab": F.JAWABAN_PDF,
      "k-bukti": F.DAFTAR_BUKTI,
    };
    const dikirim: Apa[] = [];
    const hasil = await bacaIsiGugatan("901/Pdt.G/2026/PA.Xyz", SEBUTAN, {
      rincian: async () => ({ ok: true, dokumen: DOK }),
      ambilBerkas: async (key) => Buffer.from(key),
      halamanPdf: async (data) => teks[data.toString()].split("\f"),
      bacaTeks: async () => ({ teks: "", sumber: "", sebab: "tidak dipakai" }),
      kirimBot: async (muatan) => {
        dikirim.push(muatan);
        return S.susunIsiGugatan(muatan);
      },
    });
    expect(dikirim[0].dokumen.map((d: Apa) => [d.judul, d.peran, d.jenis, d.pengunggah, d.penuntutKode])).toEqual([
      ["Dokumen Gugatan", "gugatan", undefined, undefined, "0046"],
      ["Jawaban Tergugat", "jawaban", "Jawaban", "Tergugat", "0047"],
      ["DAFTAR BUKTI SURAT", "kesimpulan", "Kesimpulan", "Penggugat", "0046"],
    ]);
    expect((hasil.jawab as Apa[]).map((j) => j.judul)).toEqual(["Jawaban Tergugat"]);
    expect((hasil.usulan as Apa[]).map((u) => u.kode)).toEqual(expect.arrayContaining(["9881", "7084"]));
  });
});
