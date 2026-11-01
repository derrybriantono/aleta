// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dalilPerluBukti, sidikBerkas, type MatriksDalil } from "@/lib/matriks-dalil";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_MATRIKS_DALIL } from "@/server/db/schema";
import { type HasilIsiGugatan } from "@/server/modules/aleta-ecourt/isi-gugatan";
import { type DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";
import {
  aturPembuktian,
  buangSinggahanMatriks,
  pastikanMatriksDalil,
  simpanDariIsiGugatan,
  type DepsMatriksDalil,
} from "@/server/modules/aleta-ecourt/matriks-dalil";

/**
 * P2 (1 Nov 2026) - MATRIKS DALIL SATU SUMBER. Dalil gugatan/jawaban/replik/duplik dipecah per butir sekali (bot
 * matriksDalilService), disimpan portal per perkara (aleta_matriks_dalil, 0126), dan dibaca panel Peta dalil.
 *
 * Berkas e-Court sungguhan tidak ada di laptop: surat gugatan REKAAN berbentuk keluaran pembaca PDF + fixture rekaan jawab-replik
 * 31 Okt (fixtures/jawab-replik-31okt.cjs, nama dan nomor dikarang). Posita SIPP diukur terpisah atas sipp_2810 (laporan P2).
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;
const MD: Apa = muat(path.join(AKAR, "aleta_bot/services/matriksDalilService.js"));
const NJ: Apa = muat(path.join(AKAR, "aleta_bot/services/naskahJawabMenjawabService.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const F: Apa = muat(path.join(AKAR, "manajemen_surat/src/test/fixtures/jawab-replik-31okt.cjs"));
const PD: Apa = muat(path.join(AKAR, "ekstensi-sipp/blangko-derry-peta-dalil.js"));

const CT = { lawan: "Pemohon", pelaku: "Termohon" };

/** Surat permohonan cerai talak REKAAN seperti keluaran pembaca PDF: kop, identitas, baris terpotong, "\f", nomor halaman, salah ketik sengaja. */
const PERMOHONAN = [
  "PERMOHONAN CERAI TALAK",
  "Kepada Yth. Ketua Pengadilan Agama Xyz",
  "Dengan hormat,",
  "Yang bertanda tangan di bawah ini: Ahmad bin Lamusu, umur 35 tahun, selanjutnya disebut Pemohon;",
  "1. Bahwa Pemohon dan Termohon telah menikah pada tanggal 17 Juni 2020 yang dicatat oleh Pegawai Pencatat",
  "Nikah Kantor Urusan Agama Kecamatan Contoh;",
  "2. Bahwa setelah menikah Pemohon dan Termohon tinggal di rumah orang tua Termohon di Desa Contoh selama 3 tahun;",
  "3. Bahwa dari pernikahan tersebut telah dikarunia 2 (dua) orang anak;",
  "4. Bahwa sejak awal tahun 2025 rumah tangga Pemohon dan Termohon mulai tidak harmonis karena sering terjadi",
  "perselisihan dan pertengkaran yang disebabkan:",
  "a. Termohon sering keluar rumah tanpa izin Pemohon;",
  "b. Termohon tidak menghargai Pemohon sebagai kepala rumah tangga;",
  "- 1 -\f5. Bahwa puncaknya terjadi pada bulan Maret 2026, Termohon pergi meninggalkan rumah kediaman bersama dan",
  "sejak itu Pemohon dan Termohon telah berpisah rumah;",
  "6. Bahwa berdasarkan hal tersebut permohonan Pemohon telah memenuhi Pasal 19 huruf f Peraturan Pemerintah Nomor 9",
  "Tahun 1975 jo Pasal 116 huruf f Kompilasi Hukum Islam;",
  "Berdasarkan alasan-alasan tersebut di atas, Pemohon mohon kepada Ketua Pengadilan Agama Xyz memutuskan:",
  "1. Mengabulkan permohonan Pemohon;",
  "2. Memberi izin kepada Pemohon untuk menjatuhkan talak satu raj'i terhadap Termohon;",
  "3. Membebankan biaya perkara sesuai dengan peraturan yang berlaku;",
  "Hormat Pemohon,",
  "- 2 -",
].join("\n");

const dok = (judul: string, peran: string, teks: string, jenis: string, pengunggah: string, diunggah: string) => ({
  judul,
  peran,
  teks,
  jenis,
  pengunggah,
  penuntutKode: /Penggugat/.test(pengunggah) ? "0046" : /Tergugat/.test(pengunggah) ? "0047" : "",
  diunggah,
});
const GUGATAN = dok("Permohonan Cerai Talak", "gugatan", PERMOHONAN, "", "Penggugat", "2026-07-01");
const JAWABAN = dok("Jawaban Konvensi dan Gugatan Rekonvensi", "jawaban", F.JAWABAN_REKON, "Jawaban", "Tergugat", "2026-07-27");
const REPLIK = dok("Replik Pemohon", "replik", F.REPLIK_REKON, "Replik", "Penggugat", "2026-08-02");
const DUPLIK = dok("Duplik Konvensi dan Replik Rekonvensi", "duplik", F.DUPLIK_REKON, "Duplik", "Tergugat", "2026-08-05");

const susun = (dokumen: Apa[], sipp?: Apa) => MD.susunMatriksDalil({ dokumen, sebutan: CT, ...(sipp ? { sipp } : {}) });
const cari = (m: Apa, sumber: string, nomor: string, jenis = "posita-fakta") => m.dalil.find((d: Apa) => d.sumber === sumber && d.nomor === nomor && d.jenis === jenis);

describe("pemecahan butir", () => {
  const m = susun([GUGATAN, JAWABAN, REPLIK, DUPLIK]);

  it("nomor butir asli, sub-butir a./b. bertaut ke induknya, kop/identitas/penutup tidak ikut", () => {
    const pokok = m.dalil.filter((d: Apa) => d.sumber === "gugatan" && d.jenis !== "petitum");
    expect(pokok.map((d: Apa) => d.nomor)).toEqual(["1", "2", "3", "4", "4.a", "4.b", "5", "6"]);
    const empat = cari(m, "gugatan", "4");
    expect(cari(m, "gugatan", "4.a").induk).toBe(empat.id);
    expect(cari(m, "gugatan", "4.b").induk).toBe(empat.id);
    const semua = m.dalil.map((d: Apa) => d.teks).join("\n");
    expect(semua).not.toMatch(/Kepada Yth|Dengan hormat|Yang bertanda tangan|Hormat Pemohon|- 1 -|- 2 -|Assalamu|NIK :/);
  });

  it("jenis: posita fakta, alasan hukum (pasal), petitum (sesudah 'mohon ... memutuskan')", () => {
    expect(cari(m, "gugatan", "1").jenis).toBe("posita-fakta");
    expect(cari(m, "gugatan", "6", "alasan-hukum")).toBeTruthy();
    const petitum = m.dalil.filter((d: Apa) => d.sumber === "gugatan" && d.jenis === "petitum").map((d: Apa) => d.nomor);
    expect(petitum).toEqual(["", "1", "2", "3"]);
    expect(m.dalil.find((d: Apa) => d.sumber === "gugatan" && d.pembuka).ringkas).toMatch(/^Berdasarkan alasan-alasan/);
  });

  it("bagian rekonvensi jawaban menjadi sumber 'rekonvensi' milik Termohon; pihak dan sebutan benar", () => {
    const rekon = m.dalil.filter((d: Apa) => d.sumber === "rekonvensi");
    expect(rekon.length).toBeGreaterThanOrEqual(3);
    expect(new Set(rekon.map((d: Apa) => d.pihak))).toEqual(new Set(["0047"]));
    expect(rekon.every((d: Apa) => d.sebutan === "Termohon" && d.bagian === "rekonvensi")).toBe(true);
    expect(m.dalil.filter((d: Apa) => d.sumber === "replik").every((d: Apa) => d.pihak === "0046")).toBe(true);
  });

  it("ringkasan aturan: tanpa nomor dan 'Bahwa', paling panjang 160 huruf", () => {
    expect(cari(m, "gugatan", "1").ringkas).toMatch(/^Pemohon dan Termohon telah menikah pada tanggal 17 Juni 2020/);
    for (const d of m.dalil) expect(d.ringkas.length).toBeLessThanOrEqual(164);
    expect(MD.ringkasDalil(`1. Bahwa ${"kata ".repeat(60)}`)).toMatch(/ \.\.\.$/);
  });

  it("huruf alasan dari kamus rincian alasan: perselisihan (F) pada butir 4", () => {
    expect(cari(m, "gugatan", "4").huruf).toContain("F");
    expect(m.ringkas.huruf).toContain("F");
  });

  it("posita tanpa nomor ('Bahwa ...' saja) diberi nomor urut dan ditandai", () => {
    const h = MD.dalilDariParagraf(
      [{ teks: "Bahwa Penggugat dan Tergugat menikah pada tahun 2015;", judul: null }, { teks: "Bahwa sejak 2020 sering bertengkar karena Tergugat tidak memberi nafkah;", judul: null }],
      { sumber: "gugatan", pihak: "0046", sebutan: "Penggugat", asal: "sipp", dokumen: "", diunggah: "", ocr: false, indeks: -1 }
    );
    expect(h.map((d: Apa) => [d.nomor, Boolean(d.nomorDariUrutan)])).toEqual([["1", true], ["2", true]]);
  });
});

describe("teks pihak utuh (keputusan 55)", () => {
  const m = susun([GUGATAN, JAWABAN, REPLIK, DUPLIK]);

  it("teks dalil jawaban = paragraf naskah 12020/12021 apa adanya (pemotong naskah yang sama)", () => {
    const n = NJ.naskahDariSurat(F.JAWABAN_REKON, { pisahRekonvensi: true });
    const paragraf = new Set(`${n.konvensi}\n${n.rekonvensi}`.split("\n"));
    const dariJawaban = m.dalil.filter((d: Apa) => d.berkas === 1);
    expect(dariJawaban.length).toBeGreaterThan(8);
    for (const d of dariJawaban) expect(paragraf.has(d.teks)).toBe(true);
  });

  it("salah ketik, huruf besar, nomor dan 'Bahwa' tidak diubah; baris PDF terpotong disambung", () => {
    expect(cari(m, "gugatan", "3").teks).toBe("3. Bahwa dari pernikahan tersebut telah dikarunia 2 (dua) orang anak;");
    expect(cari(m, "gugatan", "1").teks).toBe("1. Bahwa Pemohon dan Termohon telah menikah pada tanggal 17 Juni 2020 yang dicatat oleh Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Contoh;");
    expect(cari(m, "gugatan", "5").teks).toMatch(/^5\. Bahwa puncaknya .* telah berpisah rumah;$/);
  });

  it("posita SIPP (HTML): entitas dikembalikan ke hurufnya, satu baris HTML = satu dalil", () => {
    const h = susun([], {
      posita: "<p>1. Bahwa Penggugat &amp; Tergugat menikah di KUA &quot;Banawa&quot;;<br />2. Bahwa Tergugatt sering mabuk;</p>",
      petitum: "<div>1. Mengabulkan gugatan Penggugat;</div><div>2. Menjatuhkan talak satu ba&#39;in sughra Tergugat;</div>",
    });
    expect(h.sumberGugatan).toBe("sipp");
    expect(h.dalil.map((d: Apa) => d.teks)).toEqual([
      '1. Bahwa Penggugat & Tergugat menikah di KUA "Banawa";',
      "2. Bahwa Tergugatt sering mabuk;",
      "1. Mengabulkan gugatan Penggugat;",
      "2. Menjatuhkan talak satu ba'in sughra Tergugat;",
    ]);
    expect(h.dalil.map((d: Apa) => d.jenis)).toEqual(["posita-fakta", "posita-fakta", "petitum", "petitum"]);
  });

  // Bentuk-bentuk yang ditemukan saat mengukur 4.810 posita Pdt.G sipp_2810 (1 Nov 2026).
  it("posita SIPP berupa surat lengkap (kop, identitas, petitum, tanda tangan): hanya dalil; petitum dari kolom petitum", () => {
    const h = susun([], {
      posita:
        "<p>Donggala, 03 Desember 2018</p><p>Kepada Yth. Ketua Pengadilan Agama Donggala</p><p>Assalamu'alaikum wr. wb.</p>" +
        "<p>Dengan hormat, perkenankanlah saya yang bertanda tangan di bawah ini:</p><p>Sumiati binti Zainuddin, umur 33 tahun, agama Islam</p>" +
        "<p>Adapun alasan/dalil - dalil gugatan Penggugat sebagai berikut :</p><ol><li>Bahwa pada tanggal 23 Nopember 2005 Penggugat dengan Tergugat menikah;</li>" +
        "<li>Bahwa Tergugat suka mabuk-mabukan;</li></ol><p>Berdasarkan alasan-alasan tersebut di atas, Penggugat mohon kepada Ketua Pengadilan Agama Donggala memutuskan:</p>" +
        "<p>Mengabulkan gugatan Penggugat ;</p><p>Demikian atas terkabulnya gugatan ini, penggugat menyampaikan terima kasih.</p><p>Sumiati binti Zainuddin</p>",
      petitum: "<ol><li>Mengabulkan gugatan Penggugat ;</li><li>Membebankan biaya perkara menurut hukum ;</li></ol>",
    });
    expect(h.dalil.map((d: Apa) => [d.nomor, d.jenis, d.teks.slice(0, 24)])).toEqual([
      ["1", "posita-fakta", "Bahwa pada tanggal 23 No"],
      ["2", "posita-fakta", "Bahwa Tergugat suka mabu"],
      ["1", "petitum", "Mengabulkan gugatan Peng"],
      ["2", "petitum", "Membebankan biaya perkar"],
    ]);
    expect(h.dalil.filter((d: Apa) => d.nomorDariUrutan).length).toBe(4);
  });

  it("nomor bertingkat '3.1'/'4.1.' dan daftar '(3)' kutipan pasal = anak butir; butir 'Bahwa' sebelum nomor pertama diberi urutan", () => {
    const h = susun([], {
      posita:
        "<p>Bahwa Penggugat dan Tergugat menikah tahun 2010;</p><p>Bahwa setelah menikah tinggal di Desa Sipi;</p><p>3. Bahwa telah dikaruniai anak:</p>" +
        "<p>3.1 SADAM bin RUSNO, 8 tahun</p><p>4. Bahwa sejak 2020 sering bertengkar karena:</p><p>4.1. Tergugat mengonsumsi sabu;</p>" +
        "<p>5. Bahwa Pasal 34 Undang-Undang Perkawinan berbunyi:</p><p>(3) Jika suami atau isteri melalaikan kewajibannya</p><p>6. Bahwa keluarga sudah menasihati;</p>",
      petitum: "",
    });
    expect(h.dalil.map((d: Apa) => d.nomor)).toEqual(["1", "2", "3", "3.1", "4", "4.1", "5", "5.3", "6"]);
    expect(cari(h, "gugatan", "4.1").induk).toBe(cari(h, "gugatan", "4").id);
    expect(cari(h, "gugatan", "5", "alasan-hukum")).toBeTruthy();
  });

  it("'7. Bahwa berdasarkan dalil di atas ... mohon' di posita tetap posita (bukan petitum)", () => {
    const h = susun([], {
      posita: "<p>1. Bahwa Penggugat dan Tergugat menikah;</p><p>2. Bahwa Tergugat pergi sejak 2021;</p><p>3. Bahwa berdasarkan dalil-dalil di atas, cukup alasan bagi Penggugat untuk mengajukan gugatan dan untuk itu mohon diputus;</p><p>4. Bahwa Penggugat sanggup membayar biaya perkara;</p>",
      petitum: "<p>Mengabulkan gugatan Penggugat;</p>",
    });
    expect(h.dalil.filter((d: Apa) => d.jenis !== "petitum").map((d: Apa) => d.nomor)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("tanggapan pihak lawan", () => {
  const m = susun([GUGATAN, JAWABAN, REPLIK, DUPLIK]);
  const t = (sumber: string, nomor: string) => cari(m, sumber, nomor).tanggapan;

  it("rujukan nomor: 'membenarkan dalil ... angka 1' / 'angka 3' = diakui; 'menolak dalil angka 4 dan angka 5' = dibantah", () => {
    expect(t("gugatan", "1")).toMatchObject({ status: "diakui", ragu: false, cara: "rujukan" });
    expect(t("gugatan", "3")).toMatchObject({ status: "diakui", ragu: false });
    expect(t("gugatan", "4")).toMatchObject({ status: "dibantah", ragu: false, cara: "rujukan" });
    expect(t("gugatan", "5")).toMatchObject({ status: "dibantah", ragu: false });
    expect(t("gugatan", "4.a")).toMatchObject({ status: "dibantah", cara: "rujukan-induk" });
    expect(t("gugatan", "1").rincian[0]).toMatchObject({ sumber: "jawaban", nomor: "1" });
  });

  it("dalil yang tidak disebut jawaban = tidak ditanggapi; petitum 'menolak seluruhnya' hanya menandai periksa", () => {
    expect(t("gugatan", "2")).toMatchObject({ status: "tidak-ditanggapi", ragu: true, cara: "umum-petitum" });
  });

  it("bantahan umum duplik atas REPLIK tidak berlaku untuk dalil gugatan; replik membantah jawaban lewat isi yang mirip", () => {
    expect(t("gugatan", "2").rincian.every((r: Apa) => r.sumber !== "duplik")).toBe(true);
    expect(t("jawaban", "3.a")).toMatchObject({ status: "dibantah", cara: "kemiripan" });
    // "menolak dalil-dalil jawaban Termohon, kecuali yang diakui" -> sisa dalil jawaban dibantah (umum, periksa)
    expect(t("jawaban", "4")).toMatchObject({ status: "dibantah", ragu: true, cara: "umum" });
  });

  it("kesanggupan dalam replik rekonvensi ('bersedia memberikan ...') = diakui sebagian", () => {
    const rekon = m.dalil.filter((d: Apa) => d.sumber === "rekonvensi" && d.jenis === "posita-fakta" && d.tanggapan.status === "diakui-sebagian");
    expect(rekon.length).toBeGreaterThanOrEqual(1);
    expect(rekon.every((d: Apa) => d.tanggapan.ragu)).toBe(true);
  });

  it("belum ada jawaban tertulis = belum-dijawab; petitum & kesimpulan tanpa tanggapan", () => {
    const g = susun([GUGATAN]);
    expect(cari(g, "gugatan", "1").tanggapan.status).toBe("belum-dijawab");
    expect(g.dalil.filter((d: Apa) => d.jenis === "petitum").every((d: Apa) => d.tanggapan === null)).toBe(true);
  });

  it("rujukan: daftar, rentang, sasaran; nomor undang-undang/perkara bukan rujukan", () => {
    expect(MD.nomorRujukan("1", " s/d 3")).toEqual([1, 2, 3]);
    expect(MD.nomorRujukan("2", ", 4 dan angka 6")).toEqual([2, 4, 6]);
    const r = MD.rujukanDi("Bahwa Tergugat membenarkan dalil gugatan angka 1 sampai dengan 3, namun membantah dalil angka 5;");
    expect(r.map((x: Apa) => [x.nomor, x.sikap])).toEqual([[[1, 2, 3], "diakui"], [[5], "dibantah"]]);
    expect(MD.rujukanDi("Bahwa sesuai Undang-Undang Nomor 1 Tahun 1974 perkawinan itu sah, dalam perkara Nomor 901/Pdt.G/2026")).toEqual([]);
    expect(MD.rujukanDi("Bahwa dalil replik angka 2 tidak benar")[0]).toMatchObject({ sasaran: "replik", sikap: "dibantah" });
  });

  it("jawaban kuasa dengan eksepsi: eksepsi = alasan hukum; 'membantah dalil Penggugat angka 4/5' = dibantah", () => {
    const g = dok(
      "Surat Gugatan",
      "gugatan",
      [
        "1. Bahwa Penggugat dan Tergugat menikah pada tanggal 2 Februari 2019;",
        "2. Bahwa setelah menikah tinggal di rumah orang tua Tergugat;",
        "3. Bahwa sejak 2024 sering terjadi perselisihan dan pertengkaran;",
        "4. Bahwa Tergugat tidak memberi nafkah lahir sejak Januari 2025;",
        "5. Bahwa Penggugat dan Tergugat pisah rumah sejak tahun 2025;",
        "Berdasarkan hal tersebut, Penggugat mohon memutuskan:",
        "1. Mengabulkan gugatan Penggugat;",
      ].join("\n"),
      "",
      "Penggugat",
      "2026-07-01"
    );
    const m = MD.susunMatriksDalil({ dokumen: [g, dok("Jawaban", "jawaban", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-08-05")], sebutan: { lawan: "Penggugat", pelaku: "Tergugat" } });
    const eksepsi = m.dalil.filter((d: Apa) => d.bagian === "eksepsi" && d.jenis !== "petitum");
    expect(eksepsi.length).toBe(2);
    // petitum "DALAM EKSEPSI: Menerima eksepsi Tergugat" tetap petitum, bagian eksepsi
    expect(m.dalil.filter((d: Apa) => d.bagian === "eksepsi" && d.jenis === "petitum").map((d: Apa) => d.ringkas)).toEqual(["Menerima eksepsi Tergugat", "Menyatakan gugatan Penggugat tidak dapat diterima"]);
    expect(eksepsi.every((d: Apa) => d.jenis === "alasan-hukum" && d.sumber === "jawaban")).toBe(true);
    expect(cari(m, "gugatan", "4").tanggapan).toMatchObject({ status: "dibantah", cara: "rujukan", ragu: false });
    expect(cari(m, "gugatan", "5").tanggapan).toMatchObject({ status: "dibantah", cara: "rujukan" });
    expect(cari(m, "gugatan", "1").tanggapan.status).toBe("tidak-ditanggapi");
  });

  it("jawaban tanpa nomor rujukan: bantahan umum + kemiripan isi ('benar ... menikah' diakui, 'tidak benar ... meninggalkan' dibantah)", () => {
    const g = dok(
      "Surat Gugatan",
      "gugatan",
      [
        "1. Bahwa Penggugat dan Tergugat menikah pada tanggal 10 Mei 2018 dan telah dikaruniai 1 (satu) orang anak;",
        "2. Bahwa sejak tahun 2025 Tergugat sering marah tanpa sebab;",
        "3. Bahwa pada bulan Maret 2026 Tergugat meninggalkan tempat kediaman bersama tanpa izin;",
        "Berdasarkan hal tersebut, Penggugat mohon memutuskan:",
        "1. Mengabulkan gugatan Penggugat;",
      ].join("\n"),
      "",
      "Penggugat",
      "2026-07-01"
    );
    const m = MD.susunMatriksDalil({ dokumen: [g, dok("Jawaban", "jawaban", F.JAWABAN_LENGKAP, "Jawaban", "Tergugat", "2026-08-10")], sebutan: { lawan: "Penggugat", pelaku: "Tergugat" } });
    expect(cari(m, "gugatan", "1").tanggapan).toMatchObject({ status: "diakui", cara: "kemiripan" });
    expect(cari(m, "gugatan", "3").tanggapan).toMatchObject({ status: "dibantah", cara: "kemiripan" });
    expect(cari(m, "gugatan", "2").tanggapan).toMatchObject({ status: "dibantah", cara: "umum", ragu: true });
    // identitas kuasa bernomor ("1. Rahmat Hidayat, S.H., Advokat ...") bukan dalil
    expect(m.dalil.some((d: Apa) => /Advokat|Tembusan|Arsip/.test(d.teks))).toBe(false);
  });

  it("sikap: 'tidak membantah' = diakui, 'tidak benar' = dibantah, keduanya = diakui sebagian", () => {
    expect(MD.sikapKlausa("Termohon tidak membantah dalil tersebut")).toBe("diakui");
    expect(MD.sikapKlausa("adalah tidak benar Termohon pergi")).toBe("dibantah");
    expect(MD.sikapKlausa("benar bahwa Termohon pergi, akan tetapi tidak benar tanpa izin")).toBe("diakui-sebagian");
  });
});

describe("id stabil", () => {
  it("id sama untuk teks sama; berkas baru (replik) tidak mengubah id dalil gugatan dan jawaban", () => {
    const a = susun([GUGATAN, JAWABAN]);
    const b = susun([GUGATAN, JAWABAN, REPLIK, DUPLIK]);
    const idA = a.dalil.filter((d: Apa) => d.sumber !== "replik").map((d: Apa) => d.id);
    const idB = new Set(b.dalil.map((d: Apa) => d.id));
    for (const id of idA) expect(idB.has(id)).toBe(true);
    expect(new Set(b.dalil.map((d: Apa) => d.id)).size).toBe(b.dalil.length);
    expect(a.dalil[0].id).toMatch(/^G-[0-9a-f]{10}$/);
  });
});

describe("isi gugatan memakai matriks yang sama (satu sumber)", () => {
  it("susunIsiGugatan mengembalikan matriksDalil; rincian alasan 5227 menunjuk dalil asalnya", () => {
    const h = S.susunIsiGugatan({ sebutan: CT, dokumen: [GUGATAN, JAWABAN] });
    expect(h.matriksDalil && h.matriksDalil.dalil.length).toBeGreaterThan(10);
    const k5227 = h.usulan.find((u: Apa) => u.kode === "5227");
    const ids = new Set(h.matriksDalil.dalil.map((d: Apa) => d.id));
    if (k5227 && Array.isArray(k5227.rincian) && k5227.rincian.length) {
      const bertaut = k5227.rincian.filter((r: Apa) => r.dalilId);
      expect(bertaut.length).toBeGreaterThan(0);
      for (const r of bertaut) expect(ids.has(r.dalilId)).toBe(true);
    }
    expect(MD.cariDalil(h.matriksDalil, "Termohon sering keluar rumah tanpa izin Pemohon")).toMatchObject({ sumber: "gugatan", nomor: "4.a" });
  });
});

// ─── Portal: simpan, baca, pembaruan otomatis ────────────────────────────────

function arsip(n: number): DokumenArsip[] {
  const semua: DokumenArsip[] = [
    { documentKey: "k-gugatan", judulDokumen: "Permohonan", jenisDokumen: "", peranPengunggah: "Penggugat", diunggahPada: "2026-07-01 10:00:00", adaPdf: true, adaWord: false },
    { documentKey: "k-jawaban", judulDokumen: "Jawaban", jenisDokumen: "Jawaban", peranPengunggah: "Tergugat", diunggahPada: "2026-07-27 09:00:00", adaPdf: true, adaWord: false },
    { documentKey: "k-replik", judulDokumen: "Replik", jenisDokumen: "Replik", peranPengunggah: "Penggugat", diunggahPada: "2026-08-02 09:00:00", adaPdf: true, adaWord: false },
  ];
  return semua.slice(0, n);
}

function depsUji(keadaan: { berkas: number; lambatMs?: number }) {
  const catat = { rincian: 0, ecourt: 0, ulang: [] as boolean[], sipp: 0 };
  const deps: DepsMatriksDalil = {
    rincian: async () => {
      catat.rincian += 1;
      return { ok: true, dokumen: arsip(keadaan.berkas) };
    },
    bacaEcourt: async (_n, sebutan, ulang) => {
      catat.ecourt += 1;
      catat.ulang.push(ulang);
      if (keadaan.lambatMs) await new Promise((r) => setTimeout(r, keadaan.lambatMs));
      const dokumen = [GUGATAN, JAWABAN, REPLIK].slice(0, keadaan.berkas);
      const matriks = MD.susunMatriksDalil({ dokumen, sebutan });
      return { ada: true, matriksDalil: matriks, sidikBerkas: sidikBerkas(arsip(keadaan.berkas)), dokumen: [], catatan: [] } as unknown as HasilIsiGugatan;
    },
    bacaSipp: async (_n, sebutan) => {
      catat.sipp += 1;
      return { matriks: MD.susunMatriksDalil({ dokumen: [], sebutan, sipp: { posita: "<p>1. Bahwa Penggugat dan Tergugat menikah tahun 2015;<br>2. Bahwa sejak 2020 sering bertengkar;</p>", petitum: "" } }) as MatriksDalil, sidik: "abc" };
    },
  };
  return { deps, catat };
}

describe("simpan per perkara & pembaruan otomatis (portal)", () => {
  let db: AletaDatabase | null = null;
  beforeEach(async () => {
    buangSinggahanMatriks();
    db = await createAletaDatabase({ useInMemory: true, seed: true });
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });
  const NOMOR = "901/Pdt.G/2026/PA.Xyz";

  it("hitung sekali lalu dibaca dari simpanan selama berkas e-Court tidak berubah", async () => {
    const k = { berkas: 2 };
    const { deps, catat } = depsUji(k);
    const a = await pastikanMatriksDalil(db!, NOMOR, CT, deps);
    expect(a).toMatchObject({ ada: true, dariSimpanan: false, sumber: "ecourt" });
    const b = await pastikanMatriksDalil(db!, NOMOR, CT, deps);
    expect(b.dariSimpanan).toBe(true);
    expect(catat.ecourt).toBe(1);
    expect(b.matriks!.dalil.map((d) => d.id)).toEqual(a.matriks!.dalil.map((d) => d.id));
  });

  it("berkas baru masuk (replik) -> dihitung ulang sendiri tanpa tombol, singgahan pembaca dilewati", async () => {
    const k = { berkas: 2 };
    const { deps, catat } = depsUji(k);
    await pastikanMatriksDalil(db!, NOMOR, CT, deps);
    k.berkas = 3;
    buangSinggahanMatriks(); // singgahan daftar berkas 60 detik habis
    const c = await pastikanMatriksDalil(db!, NOMOR, CT, deps);
    expect(c.dariSimpanan).toBe(false);
    expect(catat.ecourt).toBe(2);
    expect(catat.ulang).toEqual([false, true]);
    expect(c.matriks!.dalil.some((d) => d.sumber === "replik")).toBe(true);
  });

  it("status pembuktian (agen A2) tidak hilang saat matriks dihitung ulang", async () => {
    const k = { berkas: 2 };
    const { deps } = depsUji(k);
    const a = await pastikanMatriksDalil(db!, NOMOR, CT, deps);
    const id = a.matriks!.dalil.find((d) => d.sumber === "gugatan" && d.nomor === "4")!.id;
    expect(await aturPembuktian(db!, NOMOR, { [id]: { status: "terbukti", oleh: "A2" }, "bukan id": { status: "terbukti" } })).toBe(true);
    k.berkas = 3;
    buangSinggahanMatriks();
    const c = await pastikanMatriksDalil(db!, NOMOR, CT, deps);
    expect(c.matriks!.dalil.find((d) => d.id === id)!.pembuktian).toMatchObject({ status: "terbukti" });
    expect(c.matriks!.dalil.filter((d) => d.pembuktian).length).toBe(1);
    expect(dalilPerluBukti(c.matriks!).some((d) => d.nomor === "1" && d.sumber === "gugatan")).toBe(false); // diakui tegas
  });

  it("rute isi-gugatan menyimpan matriks dari pembacaan yang sama (tanpa pembaca kedua)", async () => {
    const { deps, catat } = depsUji({ berkas: 2 });
    const h = await deps.bacaEcourt(NOMOR, CT, false);
    expect(await simpanDariIsiGugatan(db!, NOMOR, h)).toBe(true);
    const b = await pastikanMatriksDalil(db!, NOMOR, CT, deps);
    expect(b.dariSimpanan).toBe(true);
    expect(catat.ecourt).toBe(1); // hanya panggilan di atas
  });

  it("perkara tanpa berkas e-Court: posita SIPP; dibaca ulang paling cepat 6 jam", async () => {
    const { deps, catat } = depsUji({ berkas: 0 });
    const a = await pastikanMatriksDalil(db!, "12/Pdt.G/2026/PA.Xyz", { lawan: "Penggugat", pelaku: "Tergugat" }, deps);
    expect(a).toMatchObject({ ada: true, sumber: "sipp" });
    await pastikanMatriksDalil(db!, "12/Pdt.G/2026/PA.Xyz", { lawan: "Penggugat", pelaku: "Tergugat" }, deps);
    expect(catat.sipp).toBe(1);
    await pastikanMatriksDalil(db!, "12/Pdt.G/2026/PA.Xyz", { lawan: "Penggugat", pelaku: "Tergugat" }, deps, { kini: new Date(Date.now() + 7 * 3600_000) });
    expect(catat.sipp).toBe(2);
  });

  it("permintaan tidak ditahan: hitung ulang lambat -> matriks lama (basi) segera, hasil baru tersimpan di latar", async () => {
    const k = { berkas: 2, lambatMs: 0 };
    const { deps } = depsUji(k);
    await pastikanMatriksDalil(db!, NOMOR, CT, deps);
    k.berkas = 3;
    k.lambatMs = 400;
    buangSinggahanMatriks();
    const t0 = Date.now();
    const c = await pastikanMatriksDalil(db!, NOMOR, CT, deps, { batasMs: 50 });
    expect(Date.now() - t0).toBeLessThan(350);
    expect(c).toMatchObject({ basi: true, dariSimpanan: true });
    expect(c.matriks!.dalil.some((d) => d.sumber === "replik")).toBe(false);
    await new Promise((r) => setTimeout(r, 500));
    const d = await pastikanMatriksDalil(db!, NOMOR, CT, deps);
    expect(d.matriks!.dalil.some((x) => x.sumber === "replik")).toBe(true);
  });

  it("sidik berkas: urutan tidak berpengaruh, berkas baru mengubahnya", () => {
    expect(sidikBerkas(arsip(2))).toBe(sidikBerkas(arsip(2).reverse()));
    expect(sidikBerkas(arsip(3))).not.toBe(sidikBerkas(arsip(2)));
    expect(sidikBerkas([])).toBe("");
  });
});

describe("kinerja", () => {
  it("perkara besar (60 butir gugatan + jawab-menjawab) disusun < 250 ms sesudah kamus termuat; membaca simpanan < 50 ms", async () => {
    susun([GUGATAN, JAWABAN]); // pemanasan kamus (sekali per proses bot)
    const butir = Array.from({ length: 60 }, (_, i) => `${i + 1}. Bahwa pada tahun ${2000 + (i % 25)} Termohon ${["pergi ke rumah orang tuanya", "tidak memberi kabar", "marah karena masalah ekonomi", "meninggalkan rumah tanpa izin"][i % 4]} dan kejadian ke-${i + 1} itu disaksikan keluarga Pemohon;`);
    const besar = { ...GUGATAN, teks: ["PERMOHONAN", ...butir, "Berdasarkan hal tersebut, Pemohon mohon memutuskan:", "1. Mengabulkan permohonan Pemohon;"].join("\n") };
    const t0 = performance.now();
    const m = susun([besar, JAWABAN, REPLIK, DUPLIK]);
    const lama = performance.now() - t0;
    expect(m.dalil.filter((d: Apa) => d.sumber === "gugatan" && d.jenis === "posita-fakta").length).toBe(60);
    expect(lama).toBeLessThan(250);

    const db = await createAletaDatabase({ useInMemory: true, seed: true });
    try {
      buangSinggahanMatriks();
      const { deps } = depsUji({ berkas: 2 });
      await pastikanMatriksDalil(db, "1/Pdt.G/2026/PA.Xyz", CT, deps);
      const t1 = performance.now();
      const b = await pastikanMatriksDalil(db, "1/Pdt.G/2026/PA.Xyz", CT, deps);
      expect(b.dariSimpanan).toBe(true);
      expect(performance.now() - t1).toBeLessThan(50);
    } finally {
      await db.close();
    }
  });
});

describe("migrasi 0126", () => {
  it("DDL = cermin schema.ts; terdaftar di jurnal (idx 110) dan urutan simpan pg-mem", () => {
    const M = path.resolve(process.cwd());
    const sql = readFileSync(path.join(M, "drizzle/0126_aleta_matriks_dalil.sql"), "utf8");
    const rapat = (t: string) => t.replace(/--.*$/gm, "").replace(/;/g, " ").replace(/\s+/g, " ").trim();
    expect(rapat(sql)).toBe(rapat([...DDL_MATRIKS_DALIL.tabel, ...DDL_MATRIKS_DALIL.indeks].join(" ")));
    const jurnal = JSON.parse(readFileSync(path.join(M, "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const ini = jurnal.entries.filter((e) => e.tag === "0126_aleta_matriks_dalil");
    expect(ini.map((e) => e.idx)).toEqual([110]);
    expect(ini[0]!.when).toBeGreaterThan(1792337400001); // sesudah 0124 (J1) - when terbesar cabang lain
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_matriks_dalil");
  });
});

describe("ekstensi: Peta dalil", () => {
  const m = susun([GUGATAN, JAWABAN, REPLIK, DUPLIK]);
  const data = { ada: true, dalil: m.dalil, sumber: "ecourt" };
  const SB = { P: "Pemohon", T: "Termohon" };

  it("tabel dalil x tanggapan lawan; teks lengkap di title, karakter HTML di-escape", () => {
    const h = PD.htmlPeta(data, SB, false);
    expect(h).toContain("<caption>Permohonan Pemohon</caption>");
    expect(h).toContain("Tanggapan Termohon");
    expect(h).toContain('class="bd-tanda hijau"');
    expect(h).toContain('class="bd-tanda merah"');
    expect(h).not.toMatch(/<script/);
    const jahat = PD.htmlPeta({ ada: true, dalil: [{ ...m.dalil[0], ringkas: "<img src=x onerror=alert(1)>" }] }, SB, false);
    expect(jahat).toContain("&lt;img");
  });

  it("ringkasan satu baris dan batas baris (DOM ringan)", () => {
    expect(PD.ringkasPeta(data, SB)).toMatch(/^8 dalil permohonan · \d+ diakui · \d+ dibantah/);
    const banyak = { ada: true, dalil: Array.from({ length: 70 }, (_, i) => ({ ...m.dalil[0], id: `G-${i}`, nomor: String(i + 1) })) };
    const h = PD.htmlPeta(banyak, SB, false);
    expect((h.match(/<tr>/g) || []).length - 1).toBe(PD.BATAS_BARIS); // satu baris kepala
    expect(h).toContain("Tampilkan 30 dalil lainnya");
    expect(PD.htmlBungkus("901/Pdt.G/2026/PA.Xyz", SB)).toMatch(/^<details class="bd-tambahan bd-petadalil" id="bd-petadalil"><summary>Peta dalil/);
  });

  it("lencana asal untuk keterangan saksi: dari gugatan / dari jawaban", () => {
    expect(PD.lencanaDalil("saksi tahu Termohon sering keluar rumah tanpa izin Pemohon", data)).toMatchObject({ label: "dari gugatan", sumber: "gugatan" });
    expect(PD.lencanaDalil("Pemohon sering pulang larut malam tanpa alasan yang jelas", data)).toMatchObject({ label: "dari jawaban" });
    expect(PD.lencanaDalil("cuaca cerah", data)).toBeNull();
  });

  it("didaftarkan di manifest dan susun-ekstensi sebelum blangko-derry-isian.js; panel hanya membacanya saat dibuka", () => {
    const manifest = readFileSync(path.join(AKAR, "ekstensi-sipp/manifest.json"), "utf8");
    const susunEks = readFileSync(path.join(AKAR, "manajemen_surat/scripts/susun-ekstensi.mjs"), "utf8");
    for (const t of [manifest, susunEks]) {
      expect(t.indexOf('"blangko-derry-peta-dalil.js"')).toBeGreaterThan(0);
      expect(t.indexOf('"blangko-derry-peta-dalil.js"')).toBeLessThan(t.indexOf('"blangko-derry-isian.js"'));
    }
  });
});
