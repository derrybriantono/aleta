import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { afterEach, describe, expect, it } from "vitest";

import { bacaIsiGugatan, peranDokumen, penuntutDari, rencanaBaca, sebutanAman } from "@/server/modules/aleta-ecourt/isi-gugatan";
import type { DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";

/**
 * P4 + P7 + B2 (10 Okt 2026, agen 3): deteksi tuntutan accessoir, kalimat
 * hakim, dan isi dari e-Court ke ABT. Menguji PERILAKU layanan bot yang
 * sungguhan (createRequire), modul portal dengan bot sungguhan sebagai
 * "gateway", dan blok panel ABT (abt.js) di jsdom.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const T: Apa = muat(path.join(AKAR, "aleta_bot/services/tuntutanDeteksiService.js"));
const K: Apa = muat(path.join(AKAR, "aleta_bot/services/kalimatHakimService.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const kamus: Apa = muat(path.join(AKAR, "aleta_bot/services/kamusDeteksi.js"));

afterEach(() => {
  kamus.aturLapisDatabase({ pola: [], templat: [] });
});

// Jawaban + gugatan rekonvensi cerai talak - bentuk berkas e-Court sungguhan
// (perkara 324/Pdt.G/2026, nama diganti). Baris petitum dipisah ganti baris.
const JAWABAN_REKONVENSI = [
  "JAWABAN TERMOHON DAN GUGATAN REKONVENSI",
  "DALAM KONVENSI;",
  "Bahwa benar dalil Pemohon Pada Poin 1 dalam Permohonannya, bahwa benar Pemohon dan Termohon menikah pada tanggal 17 Juni 2020;",
  "Bahwa benar dalil Pemohon Pada Poin 3 selama pernikahan telah di karunia anak 2 (dua) orang anak bernama: ",
  "SITI AMINAH binti BUDI (perempuan), Umur 5 tahun 3 bulan, sekarang dalam pengasuhan Termohon;",
  "AHMAD FAUZI bin BUDI (Laki-laki), Umur 1 tahun 5 bulan, sekarang dalam pengasuhan Termohon;",
  "Bahwa tidak benar dalil Pemohon angka 4 tentang penyebab pertengkaran;",
  "DALAM REKONVENSI;",
  "Bahwa apabila permohonan Pemohon dikabulkan maka Penggugat Rekonvensi akan meminta hak-haknya;",
  "Berdasarkan segala apa yang telah teruraikan diatas, Termohon/Penggugat Rekonvensi memohon dengan hormat agar kiranya majelis Hakim yang memeriksa Perkara ini memutuskan;",
  "I.  DALAM KONVENSI",
  "1. Menerima Permohonan Pemohon;",
  "II. DALAM REKONVENSI",
  "Mengabulkan Gugatan Penggugat Rekonvensi untuk seluruhnya;",
  "Menetapkan Hak asuh terhadap kedua anak kepada Penggugat Rekonvensi;",
  "Menghukum Tergugat Rekonvensi (Pemohon) membayar kepada Penggugat Rekonvensi (SITI RAHMAH Binti AMIR) berupa :",
  "Nafkah Lampau sebesar Rp. 10.000.000,- (Sepuluh Juta Rupiah);",
  "Nafkah iddah sebesar Rp. 3.000.000,- (Tiga Juta rupiah):",
  "Mut’ah berupa sebesar Rp. 2.000.000,- (Dua Juta Rupiah);",
  "Nafkah anak-anak sejumlah Rp. 3.000.000,- (Tiga Juta rupiah) untuk 2 (dua) orang anak Perbulanya",
  "Membebankan biaya perkara menurut hukum.",
  "SUBSIDAIR:",
  "Apabila Majelis Hakim berpendapat lain mohon putusan yang seadil-adilnya (ex aequo et bono);",
].join("\n");

// Surat gugatan cerai gugat dua halaman PDF (dipisah \f).
const GUGATAN_DUA_HALAMAN =
  "GUGATAN CERAI\nBahwa Penggugat dan Tergugat menikah pada tanggal 12 Mei 2015 dan telah dikaruniai 1 (satu) orang anak bernama NUR ALIYA binti RUSLAN, umur 7 tahun, sekarang tinggal bersama Penggugat;\n" +
  "Bahwa sejak bulan Maret 2023 sering terjadi perselisihan karena Tergugat tidak memberi nafkah dan suka bermain judi;\nBahwa Tergugat tidak pernah memberikan nafkah kepada anak;\n" +
  "Bahwa sejak bulan Januari 2024 Tergugat pergi meninggalkan Penggugat hingga sekarang;\n\f" +
  "Bahwa Penggugat menuntut agar Tergugat dihukum membayar nafkah anak sebesar Rp1.500.000,00 (satu juta lima ratus ribu rupiah) setiap bulan;\n" +
  "Maka Penggugat mohon kepada Ketua Pengadilan Agama Donggala agar memeriksa dan mengadili serta menjatuhkan putusan:\nPRIMAIR:\n1. Mengabulkan gugatan Penggugat;\n2. Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat;\n" +
  "3. Menetapkan anak bernama NUR ALIYA binti RUSLAN berada dalam pengasuhan Penggugat;\n4. Menghukum Tergugat membayar nafkah anak sebesar Rp1.500.000,00 (satu juta lima ratus ribu rupiah) setiap bulan sampai anak dewasa;\n5. Membebankan biaya perkara menurut hukum;\nSUBSIDAIR:\nmohon putusan yang seadil-adilnya.";

describe("P4 - nominal (angka dan terbilang)", () => {
  it("terbilang menjadi angka, termasuk se-, salah ketik satu huruf, dan kata ganda", () => {
    expect(T.angkaDariTerbilang("dua puluh satu juta lima ratus ribu rupiah")).toBe(21_500_000);
    expect(T.angkaDariTerbilang("seratus sembilan puluh sembilan ribu lima ratus")).toBe(199_500);
    expect(T.angkaDariTerbilang("tuju ratus lima puluh ribu")).toBe(750_000);
    expect(T.angkaDariTerbilang("tiga jiuta")).toBe(3_000_000);
    expect(T.angkaDariTerbilang("dua ratus enam belas ribu ribu")).toBe(216_000);
    expect(T.angkaDariTerbilang("bukan bilangan")).toBeNull();
    expect(T.terbilang(21_500_000)).toBe("dua puluh satu juta lima ratus ribu");
    expect(T.rupiahTerbilang(1_500_000)).toBe("Rp1.500.000,00 (satu juta lima ratus ribu rupiah)");
  });

  it("nominal berbentuk berkas pihak: Rp. 10.000.000,- (..), Rp.\\n1.500.000, -, 2.000.000/bulan, Rp 5 juta", () => {
    const n = T.nominalDari("Lampau sebesar Rp. 10.000.000,- (Sepuluh Juta Rupiah); lalu Rp. 1.500.000, - (satu juta lima ratus ribu rupiah) dan 2.000.000/ bulan, juga Rp 5 juta");
    expect(n.map((x: Apa) => x.nilai)).toEqual([10_000_000, 1_500_000, 2_000_000, 5_000_000]);
    expect(n[0].cocok).toBe(true);
    // terbilang di dalam kurung tidak dihitung dua kali
    expect(n.filter((x: Apa) => x.nilai === 10_000_000)).toHaveLength(1);
  });

  it("angka dan terbilang yang berbeda ditandai, angka tetap dipakai", () => {
    const [n] = T.nominalDari("Membayar Mut'ah sebesar Rp.15.000.000,- (lima juta rupiah)");
    expect(n.nilai).toBe(15_000_000);
    expect(n.nilaiTerbilang).toBe(5_000_000);
    expect(n.cocok).toBe(false);
  });
});

describe("P4 - deteksi tuntutan", () => {
  it("rekonvensi: jenis, nominal, penuntut Termohon (0047), dibebani Pemohon (0046) lewat 'Tergugat Rekonvensi'", () => {
    const h = T.deteksiTuntutan(JAWABAN_REKONVENSI, { peran: "jawaban", sebutan: { lawan: "Pemohon", pelaku: "Termohon" } });
    const per = Object.fromEntries(h.tuntutan.map((t: Apa) => [t.jenis, t]));
    expect(Object.keys(per).sort()).toEqual(["hadhanah", "iddah", "madliyah", "mutah", "nafkah-anak"]);
    expect(per.madliyah.nominal.nilai).toBe(10_000_000);
    expect(per.iddah.nominal.nilai).toBe(3_000_000);
    expect(per.mutah.nominal.nilai).toBe(2_000_000);
    expect(per["nafkah-anak"].nominal.nilai).toBe(3_000_000);
    for (const t of h.tuntutan) {
      expect(t.penuntutKode).toBe("0047");
      expect(t.rekonvensi).toBe(true);
      expect(t.diPetitum).toBe(true);
    }
    expect(per.mutah.dibebaniKode).toBe("0046");
  });

  it("dalil alasan di posita ('Tergugat tidak pernah memberikan nafkah kepada anak') BUKAN tuntutan - salah tangkap terbanyak pada ukuran 10 Okt", () => {
    const h = T.deteksiTuntutan("Bahwa sejak berpisah Tergugat tidak pernah memberikan nafkah lahir batin pada Penggugat dan tidak memberi nafkah untuk anak Penggugat;", { peran: "gugatan" });
    expect(h.tuntutan).toEqual([]);
  });

  it("kesanggupan Pemohon dan penolakan disebut tersendiri, bukan tuntutan", () => {
    const h = T.deteksiTuntutan(
      "Bahwa Termohon wajib menjalani masa iddah, karenanya Pemohon bersedia memberi nafkah kepada Termohon selama masa iddah;\nBahwa Pemohon menolak membayar mut'ah yang diminta Termohon;",
      { peran: "gugatan" }
    );
    expect(h.tuntutan).toEqual([]);
    expect(h.diabaikan.map((x: Apa) => x.sebab)).toEqual(["kesanggupan", "penolakan"]);
  });

  it("amar: pembebanan dibawa ke butir anak diktum, mut'ah berupa benda, iddah per bulan dikali tiga", () => {
    const h = T.deteksiTuntutan(
      "Menghukum Pemohon untuk membayar kepada Termohon sebelum ikrar talak diucapkan, berupa: Mut'ah berupa cincin emas 2 (dua) gram 23 karat; Nafkah iddah sejumlah Rp5.000.000,00 (lima juta rupiah) setiap bulan dikali 3 (tiga) bulan dengan jumlah Rp15.000.000,00 (lima belas juta rupiah); Membebankan kepada Pemohon untuk membayar biaya perkara.",
      { peran: "amar" }
    );
    const mutah = h.tuntutan.find((t: Apa) => t.jenis === "mutah");
    const iddah = h.tuntutan.find((t: Apa) => t.jenis === "iddah");
    expect(mutah.nominal).toBeNull();
    expect(mutah.benda).toMatch(/^cincin emas 2 \(dua\) gram/);
    expect(mutah.dibebaniKode).toBe("0046");
    expect(iddah.nominal.perBulan).toBe(5_000_000);
    expect(iddah.nominal.kali).toBe(3);
    expect(iddah.nominal.total).toBe(15_000_000);
    expect(iddah.dibebaniKode).toBe("0046");
  });

  it("anak dari berkas: nama + umur, nama pihak dalam kurung sesudah sebutannya tidak dihitung anak", () => {
    const anak = T.anakDari(JAWABAN_REKONVENSI);
    expect(anak.map((a: Apa) => [a.nama, a.umur])).toEqual([
      ["Siti Aminah binti Budi", "5 tahun 3 bulan"],
      ["Ahmad Fauzi bin Budi", "1 tahun 5 bulan"],
    ]);
  });

  it("pola dibaca lewat kamus: lapis database menonaktifkan pola benih mut'ah", () => {
    expect(T.deteksiTuntutan("Menghukum Pemohon membayar mut'ah sejumlah Rp1.000.000,00 (satu juta rupiah);", { peran: "amar" }).tuntutan).toHaveLength(1);
    kamus.aturLapisDatabase({ pola: [{ kelompok: "tuntutan", kode: "tuntutan-mutah", status: "nonaktif" }], templat: [] });
    expect(T.deteksiTuntutan("Menghukum Pemohon membayar mut'ah sejumlah Rp1.000.000,00 (satu juta rupiah);", { peran: "amar" }).tuntutan).toHaveLength(0);
  });

  it("tidak satu pun pola tuntutan berkeyakinan 'pasti' (ukuran 10 Okt di bawah 95%)", () => {
    for (const p of kamus.polaKelompok("tuntutan")) expect(p.yakin).not.toBe("pasti");
    for (const p of kamus.polaKelompok("gugatan")) expect(p.yakin).not.toBe("pasti");
  });
});

describe("P7 - rangkaian kata hakim", () => {
  it("5227: tiga bunyi templat dari ciri, pelaku di depan, akibat hanya pada bunyi yang memuatnya", () => {
    const { varian } = K.varian5227(["tidak memberi nafkah", "judi", "perselisihan terus-menerus"], { pelaku: "Tergugat", lawan: "Penggugat" });
    const per = Object.fromEntries(varian.map((v: Apa) => [v.kode, v.nilai]));
    expect(per["hakim-5227-ringkas"]).toBe("Tergugat melalaikan kewajiban nafkah lahir serta menjadi penjudi");
    expect(per["hakim-5227-baku"]).toBe("Tergugat melalaikan kewajiban nafkah lahir serta menjadi penjudi yang memicu perselisihan terus-menerus dengan Penggugat");
    expect(per["hakim-5227-sehingga"]).toMatch(/, sehingga antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran$/);
  });

  it("bunyi isian ABT per jenis meniru isian petugas satker", () => {
    const iddah = { jenis: "iddah", nominal: { nilai: 5_000_000, perBulan: 5_000_000, kali: 3, total: 15_000_000, periode: "bulan" } };
    expect(K.nilaiAbtTuntutan(iddah)).toBe(
      "Rp5.000.000,00 (lima juta rupiah) setiap bulan dikali 3 (tiga) bulan dengan jumlah Rp15.000.000,00 (lima belas juta rupiah) selama masa iddah"
    );
    expect(K.nilaiAbtTuntutan({ jenis: "mutah", nominal: { nilai: 1_000_000 } })).toBe("berupa uang tunai sebesar Rp1.000.000,00 (satu juta rupiah)");
    expect(K.nilaiAbtTuntutan({ jenis: "mutah", nominal: null, benda: "cincin emas seberat 2 gram" })).toBe("berupa cincin emas seberat 2 gram");
    expect(K.nilaiAbtTuntutan({ jenis: "nafkah-anak", nominal: { nilai: 1_000_000, periode: "bulan", perBulan: 1_000_000 } })).toBe("sebesar Rp1.000.000,00 (satu juta rupiah) setiap bulan");
  });

  it("kalimat pertimbangan rekonvensi menyebut Penggugat/Tergugat Rekonvensi dan nominalnya; penanda yang tak diketahui disebut", () => {
    const { tuntutan } = T.deteksiTuntutan(JAWABAN_REKONVENSI, { peran: "jawaban", sebutan: { lawan: "Pemohon", pelaku: "Termohon" } });
    const kalimat = K.kalimatTuntutan(tuntutan, { sebutan: { lawan: "Pemohon", pelaku: "Termohon" }, majelis: "Hakim" });
    const pokok = kalimat.find((k: Apa) => k.kode === "hakim-tuntutan-pokok-rekonvensi");
    expect(pokok.teks).toMatch(/^Menimbang, bahwa dalam gugatan rekonvensinya yang pada pokoknya Penggugat Rekonvensi menuntut/);
    expect(pokok.teks).toContain("mut'ah berupa uang tunai sebesar Rp2.000.000,00 (dua juta rupiah)");
    expect(pokok.teks).toMatch(/kepada Tergugat Rekonvensi;$/);
    const faktaMutah = kalimat.find((k: Apa) => k.kode === "hakim-fakta-mutah");
    expect(faktaMutah.teks).toContain("Hakim berpendapat nominal mut'ah yang wajib diberikan oleh Tergugat Rekonvensi kepada Penggugat Rekonvensi adalah berupa uang tunai sebesar Rp2.000.000,00");
    const madliyah = kalimat.find((k: Apa) => k.kode === "hakim-sengketa-madliyah");
    expect(madliyah.kosong).toEqual(["kali"]);
  });

  it("kalimat saksi saling bersesuaian untuk dalil dan untuk bantahan", () => {
    const [dalil] = K.kalimatBersesuaian({ lawan: "Penggugat", pelaku: "Tergugat" }, "lawan");
    const [bantah] = K.kalimatBersesuaian({ lawan: "Penggugat", pelaku: "Tergugat" }, "pelaku");
    expect(dalil.teks).toContain("relevan dengan dalil yang harus dibuktikan oleh Penggugat, maka dari itu keterangan para saksi Penggugat");
    expect(bantah.teks).toContain("relevan dengan bantahan yang harus dibuktikan oleh Tergugat");
  });
});

describe("B2 - isi dari e-Court ke ABT (layanan bot)", () => {
  it("usulan kartu: sumber gugatan-ecourt + 'hal. n', nominal ragu, 9881 cukup, tidak pernah pasti", () => {
    const h = S.susunIsiGugatan({
      sebutan: { lawan: "Penggugat", pelaku: "Tergugat" },
      dokumen: [
        { judul: "Dokumen Gugatan", peran: "gugatan", teks: GUGATAN_DUA_HALAMAN },
        { judul: "Jawaban dari Tergugat", peran: "jawaban", teks: "Bahwa benar dalil Penggugat angka 1 tentang pernikahan;\nBahwa tidak benar dalil Penggugat angka 2, Tergugat selalu memberi nafkah;" },
      ],
    });
    const per = Object.fromEntries(h.usulan.map((u: Apa) => [u.kode, u]));
    expect(per["6071"].nilai).toBe("sebesar Rp1.500.000,00 (satu juta lima ratus ribu rupiah) setiap bulan");
    expect(per["6071"].keyakinan).toBe("ragu");
    expect(per["6071"].sumber[0].asal).toBe("gugatan-ecourt");
    expect(per["6071"].sumber[0].kalimat).toMatch(/^e-Court: Dokumen Gugatan hal\. 2 - "/);
    expect(per["7778"].nilai).toBe("1");
    expect(per["5110"].nilai).toBe("Nur Aliya binti Ruslan");
    expect(per["5111"].nilai).toBe("7 tahun");
    expect(per["0007"].nilai).toBe("telah dikaruniai seorang anak");
    expect(per["2004"].nilai).toBe("Penggugat");
    expect(per["9881"]).toMatchObject({ nilai: "tertulis", keyakinan: "cukup" });
    expect(per["5227"].nilai).toBe("");
    expect(per["5227"].pilihan.length).toBeGreaterThanOrEqual(2);
    expect(per["5227"].pilihan[0].nilai).toMatch(/^Tergugat melalaikan kewajiban nafkah lahir serta menjadi penjudi/);
    for (const u of h.usulan) expect(u.keyakinan).not.toBe("pasti");
    // Jejak koreksi (D2): usulan dari pola/templat kamus membawa kodePola-nya.
    expect(per["6071"].kodePola).toBe("tuntutan-nafkah-anak");
    expect(per["7778"].kodePola).toBe("tuntutan-hadhanah");
    expect(per["5110"].kodePola).toBe("gugatan-anak-wilayah");
    expect(per["5227"].pilihan.map((x: Apa) => x.kodePola)).toEqual(per["5227"].kodePola.split(","));
    expect(per["5227"].pilihan[0].kodePola).toMatch(/^hakim-5227-/);
    // Dalil "tidak pernah memberikan nafkah kepada anak" (hal. 1) bukan tuntutan;
    // yang terpilih tuntutan di PETITUM.
    const anak = h.tuntutan.find((t: Apa) => t.jenis === "nafkah-anak");
    expect(anak.sumber).toBe("e-Court: Dokumen Gugatan hal. 2");
    expect(anak.kutipan).toMatch(/^Menghukum Tergugat membayar nafkah anak sebesar/);
    expect(h.jawab[0]).toMatchObject({ judul: "Jawaban dari Tergugat", rekonvensi: "tidak" });
    expect(h.jawab[0].diakui).toHaveLength(1);
    expect(h.jawab[0].dibantah).toHaveLength(1);
  });

  it("cerai talak tanpa tuntutan mut'ah/iddah: kalimat ex officio ditawarkan", () => {
    const h = S.susunIsiGugatan({
      sebutan: { lawan: "Pemohon", pelaku: "Termohon" },
      dokumen: [{ judul: "Dokumen Permohonan", peran: "gugatan", teks: "Bahwa Pemohon dan Termohon menikah dan belum dikaruniai anak;\nBahwa sejak 2024 sering bertengkar karena Termohon cemburu berlebihan;\nPRIMAIR:\n1. Mengabulkan permohonan Pemohon;\n2. Memberi izin kepada Pemohon untuk menjatuhkan talak satu raj'i;" }],
    });
    const ex = h.kalimat.find((k: Apa) => k.kode === "hakim-tuntutan-tidak-ada");
    expect(ex.teks).toBe("Menimbang, bahwa meskipun Termohon tidak menuntut mut'ah dan nafkah iddah, Majelis Hakim secara ex officio akan mempertimbangkannya sebagai berikut;");
    expect(h.usulan.find((u: Apa) => u.kode === "0007").nilai).toBe("belum dikaruniai anak");
  });
});

describe("B2 - modul portal (bot sungguhan sebagai gateway)", () => {
  const DOK: DokumenArsip[] = [
    { documentKey: "k-gugat", judulDokumen: "Dokumen Gugatan", jenisDokumen: "", peranPengunggah: "Penggugat", diunggahPada: "2026-07-01", adaPdf: true, adaWord: false },
    { documentKey: "k-kuasa", judulDokumen: "Surat Kuasa Khusus", jenisDokumen: "", peranPengunggah: "Penggugat", diunggahPada: "2026-07-01", adaPdf: true, adaWord: false },
    { documentKey: "k-jawab", judulDokumen: "Jawaban dan Gugatan Rekonvensi", jenisDokumen: "Jawaban", peranPengunggah: "Termohon", diunggahPada: "2026-07-20", adaPdf: true, adaWord: true },
    { documentKey: "k-duplik", judulDokumen: "Duplik Termohon", jenisDokumen: "Duplik", peranPengunggah: "Termohon", diunggahPada: "2026-07-27", adaPdf: true, adaWord: false },
  ];

  it("memilih dokumen, membaca PDF per halaman, OCR paling banyak sekali, dan meneruskan teksnya ke bot", async () => {
    expect(rencanaBaca(DOK).gugatan.map((d) => d.documentKey)).toEqual(["k-gugat"]);
    expect(rencanaBaca(DOK).jawab.map((d) => d.documentKey)).toEqual(["k-jawab", "k-duplik"]);
    expect(peranDokumen(DOK[3])).toBe("duplik");
    expect(penuntutDari(DOK[2])).toBe("0047");

    const ocr: string[] = [];
    const dikirim: Apa[] = [];
    const hasil = await bacaIsiGugatan(
      "324/Pdt.G/2026/PA.Dgl",
      { lawan: "Pemohon", pelaku: "Termohon" },
      {
        rincian: async () => ({ ok: true, dokumen: DOK }),
        ambilBerkas: async (key) => Buffer.from(key),
        // Gugatan: dua halaman berlapis teks. Jawaban & duplik: pindaian (halaman kosong).
        halamanPdf: async (data) => (data.toString() === "k-gugat" ? GUGATAN_DUA_HALAMAN.split("\f") : ["", ""]),
        bacaTeks: async (data, bolehOcr) => {
          const key = data.toString();
          if (key === "k-jawab") return { teks: JAWABAN_REKONVENSI, sumber: "teks", sebab: "" }; // Word
          if (bolehOcr) {
            ocr.push(key);
            return { teks: "Bahwa Termohon tetap pada jawabannya dan menolak dalil Pemohon angka 4 karena tidak benar; " + "x".repeat(10) + " Termohon tetap menuntut hak-haknya sebagaimana dalam gugatan rekonvensi yang telah diajukan sebelumnya dalam persidangan ini dengan sungguh-sungguh.", sumber: "ocr", sebab: "" };
          }
          return { teks: "", sumber: "", sebab: "pindaian_ocr_belum_tersedia" };
        },
        kirimBot: async (muatan) => {
          dikirim.push(muatan);
          return S.susunIsiGugatan(muatan);
        },
      }
    );
    expect(ocr).toEqual(["k-duplik"]);
    expect(dikirim[0].dokumen.map((d: Apa) => [d.judul, d.peran, d.baca, d.penuntutKode])).toEqual([
      ["Dokumen Gugatan", "gugatan", "teks", "0046"],
      ["Jawaban dan Gugatan Rekonvensi", "jawaban", "teks", "0047"],
      ["Duplik Termohon", "duplik", "ocr", "0047"],
    ]);
    expect(dikirim[0].dokumen[0].teks).toContain("\f");
    expect(hasil.dokumen.map((d) => [d.judul, d.halaman])).toEqual([
      ["Dokumen Gugatan", 2],
      ["Jawaban dan Gugatan Rekonvensi", 0],
      ["Duplik Termohon", 0],
    ]);
    const kode = (hasil.usulan as Apa[]).map((u) => u.kode);
    expect(kode).toEqual(expect.arrayContaining(["6055", "6054", "7120", "7084", "9881"]));
    expect(hasil.catatan.join(" ")).toMatch(/Duplik Termohon: dibaca OCR/);
  });

  it("tanpa arsip e-Court: diam dengan catatan, tanpa memanggil bot", async () => {
    let dipanggil = false;
    const hasil = await bacaIsiGugatan("1/Pdt.G/2026/PA.Dgl", { lawan: "Penggugat", pelaku: "Tergugat" }, {
      rincian: async () => ({ ok: true, dokumen: [] }),
      ambilBerkas: async () => null,
      halamanPdf: async () => [],
      bacaTeks: async () => ({ teks: "", sumber: "", sebab: "" }),
      kirimBot: async () => {
        dipanggil = true;
        return null;
      },
    });
    expect(hasil.ada).toBe(false);
    expect(dipanggil).toBe(false);
    expect(hasil.catatan[0]).toMatch(/belum ada di arsip e-Court/);
  });

  it("sebutan dari query hanya kata sebutan pihak", () => {
    expect(sebutanAman("Termohon", "Tergugat")).toBe("Termohon");
    expect(sebutanAman("<script>", "Tergugat")).toBe("Tergugat");
  });
});

describe("B2 - panel ABT (blok p4 di abt.js)", () => {
  const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");
  const awal = sumber.indexOf("const P4_VAR_ECOURT");
  const akhir = sumber.indexOf("/* === AKHIR P4P7B2 === */", awal);
  const blok = sumber.slice(awal, akhir);

  function pasang(peta: Map<string, { nilai: string }>, fetchPalsu: (url: string) => Promise<Apa>) {
    const buatElemen = (tag: string, kelas: string, teks?: string) => {
      const el = document.createElement(tag);
      if (kelas) el.className = kelas;
      if (teks !== undefined && teks !== null) el.textContent = teks;
      return el;
    };
    const f = new Function(
      "buatElemen",
      "barisVariabel",
      "nilaiVariabel",
      "nomorPerkaraAbt",
      "sorePesan",
      "VAR_PIHAK_LAWAN",
      "VAR_PIHAK_PELAKU",
      "fetch",
      `${blok}\nreturn { p4BacaGugatan, p4GabungPilihan, p4GambarEcourt };`
    );
    return f(
      buatElemen,
      () => peta,
      (k: string) => (peta.get(k) || { nilai: "" }).nilai,
      () => "324/Pdt.G/2026/PA.Dgl",
      (g: Apa) => String((g && g.message) || g),
      "0046",
      "0047",
      fetchPalsu
    );
  }

  it("membaca rute portal dengan sebutan halaman, membuang usulan variabel yang tidak ada di blangko, menggabung bunyi 5227 ke kartu yang ada", async () => {
    const peta = new Map([
      ["0046", { nilai: "Pemohon" }],
      ["0047", { nilai: "Termohon" }],
      ["6055", { nilai: "" }],
      ["5227", { nilai: "" }],
    ]);
    const diminta: string[] = [];
    const bot = S.susunIsiGugatan({ sebutan: { lawan: "Pemohon", pelaku: "Termohon" }, dokumen: [{ judul: "Jawaban dan Gugatan Rekonvensi", peran: "jawaban", teks: JAWABAN_REKONVENSI }] });
    bot.usulan.push({ kode: "5227", nama: "Alasan", nilai: "", keyakinan: "ragu", pilihan: [{ keadaan: "templat hakim - ringkas", nilai: "Termohon bersikap cemburu berlebihan" }], sumber: [{ asal: "gugatan-ecourt", kalimat: "e-Court: x" }] });
    const p = pasang(peta, async (url: string) => {
      diminta.push(url);
      return { ok: true, status: 200, json: async () => ({ data: { ...bot, catatan: ["catatan uji"] } }) };
    });
    const data: Apa = { catatan: [] };
    await p.p4BacaGugatan(data);
    expect(diminta[0]).toBe("/aleta/api/aleta-ecourt/isi-gugatan?nomor=324%2FPdt.G%2F2026%2FPA.Dgl&lawan=Pemohon&pelaku=Termohon");
    expect(data.gugatan.usulan.map((u: Apa) => u.kode).sort()).toEqual(["5227", "6055"]);
    expect(data.catatan).toEqual(["Berkas e-Court: catatan uji"]);

    const kartuS5 = { kode: "5227", nama: "Alasan-Alasan Cerai", nilai: "Termohon bersikap cemburu berlebihan yang memicu perselisihan terus-menerus dengan Pemohon", keyakinan: "ragu", sumber: [{ saksi: 1, kalimat: "saksi" }] };
    const [gabung] = p.p4GabungPilihan([kartuS5], data);
    expect(gabung.nilai).toBe(kartuS5.nilai);
    expect(gabung.pilihan[0].nilai).toBe("Termohon bersikap cemburu berlebihan");
    expect(gabung.sumber.map((s: Apa) => s.asal || "saksi")).toEqual(["saksi", "gugatan-ecourt"]);
  });

  it("server lama tanpa rute (404): diam, tanpa catatan", async () => {
    const p = pasang(new Map([["6055", { nilai: "" }]]), async () => ({ ok: false, status: 404, json: async () => ({}) }));
    const data: Apa = { catatan: [] };
    await p.p4BacaGugatan(data);
    expect(data.gugatan).toBeUndefined();
    expect(data.catatan).toEqual([]);
  });

  it("lipatan 'Dari berkas e-Court' menggambar tuntutan, anak, jawab-menjawab, dan kalimat hakim yang dapat disalin", () => {
    const p = pasang(new Map(), async () => null);
    const bot = S.susunIsiGugatan({ sebutan: { lawan: "Pemohon", pelaku: "Termohon" }, dokumen: [{ judul: "Jawaban dan Gugatan Rekonvensi", peran: "jawaban", teks: JAWABAN_REKONVENSI }] });
    const wadah = document.createElement("div");
    p.p4GambarEcourt(wadah, { gugatan: { ...bot, dokumen: [{ judul: "Jawaban dan Gugatan Rekonvensi", terbaca: true, baca: "teks", halaman: 0 }] } });
    const teks = wadah.textContent || "";
    expect(teks).toMatch(/Dari berkas e-Court: 5 tuntutan · 2 anak · 1 jawab-menjawab · \d+ kalimat hakim/);
    expect(teks).toContain("Rp10.000.000 · dituntut Termohon (rekonvensi) kepada Pemohon");
    expect(teks).toContain("Siti Aminah binti Budi, umur 5 tahun 3 bulan");
    const kotak = Array.from(wadah.querySelectorAll("textarea")) as HTMLTextAreaElement[];
    expect(kotak.some((t) => t.value.startsWith("Menimbang, bahwa dalam gugatan rekonvensinya"))).toBe(true);
    expect(wadah.querySelectorAll("button").length).toBe(kotak.length);
  });
});
