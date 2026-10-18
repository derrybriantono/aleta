import path from "node:path";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { bacaIsiGugatan, pilihDokumenBukti, rencanaBaca } from "@/server/modules/aleta-ecourt/isi-gugatan";
import type { DokumenArsip } from "@/server/modules/aleta-ecourt/kuasa-gugatan";

/**
 * JJ2 (18 Okt 2026), keputusan 75 dan 71, atas teks REKAAN (fixtures/tanya-jawab-bukti-ecourt.cjs; tidak ada berkas e-Court
 * sungguhan di laptop). Yang diuji:
 *   75a  daftar bukti P.n / T.n -> 9470/9488/9492 (surat P), 9489/9493 (surat T), 9951/9952 (elektronik);
 *   75b  9164 tanggapan atas sita;  75c  9283 objek harta bersama rekonvensi;
 *   71   No./Tgl. Surat Keterangan KUA (0654/0655): posita > daftar bukti > isi berkas; yang bertentangan tidak dipakai;
 *   semua usulan isi surat "ragu" dan menjaga isian petugas; tanpa kata Aleta dan tanpa kode #nnnn# di teks yang akan ditulis.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const B: Apa = muat(path.join(AKAR, "aleta_bot/services/buktiEcourtService.js"));
const KH: Apa = muat(path.join(AKAR, "aleta_bot/services/jawabKhususEcourtService.js"));
const J: Apa = muat(path.join(AKAR, "aleta_bot/services/jawabMenjawabEcourtService.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const F: Apa = muat(path.join(AKAR, "manajemen_surat/src/test/fixtures/tanya-jawab-bukti-ecourt.cjs"));
const SEBUTAN = { lawan: "Penggugat", pelaku: "Tergugat" };

const dok = (judul: string, peran: string, jenis: string, pengunggah: string, teks: string, penuntutKode = "", baca = "teks") => ({ judul, peran, jenis, pengunggah, teks, penuntutKode, baca });
const per = (usulan: Apa[]) => Object.fromEntries(usulan.map((u) => [u.kode, u]));

describe("75a - daftar bukti P.n / T.n", () => {
  it("butir bertanda P.n, T-n, atau berbentuk '1. ... P-1' diurai: kode, jenis, nama, nomor, tanggal", () => {
    const p = B.uraiDaftarBukti(F.DAFTAR_BUKTI_P, "Penggugat").butir;
    expect(p.map((x: Apa) => x.kode)).toEqual(["P.1", "P.2", "P.3", "P.4", "P.5"]);
    expect(p[0]).toMatchObject({ jenis: "Kartu Tanda Penduduk Elektronik (KTP-el)", nama: "Rahmi binti Hasan", elektronik: false });
    expect(p[1]).toMatchObject({ jenis: "Kutipan Akta Nikah", nomor: "123/45/V/2018", tanggal: { tampil: "10/05/2018", iso: "2018-05-10" } });
    expect(p[2]).toMatchObject({ jenis: "Surat Keterangan Nikah Tidak Tercatat", nomor: "B-045/Kua.19.04.2/PW.01/06/2026", tanggal: { tampil: "05/06/2026" } });
    expect(p[3]).toMatchObject({ elektronik: true, jenis: "Bukti Elektronik" });
    const t = B.uraiDaftarBukti(F.DAFTAR_BUKTI_T, "Tergugat").butir;
    expect(t.map((x: Apa) => x.kode)).toEqual(["T.1", "T.2", "T.3"]);
    expect(t.map((x: Apa) => x.elektronik)).toEqual([false, true, true]);
    const akhir = B.uraiDaftarBukti("DAFTAR BUKTI PENGGUGAT\n1. Fotokopi Kartu Keluarga atas nama Rahmat (diberi tanda P-1)\n2. Fotokopi Akta Kelahiran anak (bukti P-2)", "").butir;
    expect(akhir.map((x: Apa) => [x.kode, x.kodeDariUrutan])).toEqual([["P.1", false], ["P.2", false]]);
  });

  it("butir tanpa kode memakai pihak dari judul dan ditandai kodeDariUrutan", () => {
    const u = B.uraiDaftarBukti(F.DAFTAR_BUKTI_URUTAN, "").butir;
    expect(u.map((x: Apa) => [x.kode, x.kodeDariUrutan])).toEqual([["P.1", true], ["P.2", true]]);
  });

  it("tanggal: nama bulan, singkatan, dd-mm-yyyy; tanggal mustahil ditolak", () => {
    expect(B.uraiTanggal("5 Juni 2026")).toMatchObject({ iso: "2026-06-05", tampil: "05/06/2026", indo: "5 Juni 2026" });
    expect(B.uraiTanggal("12 Agt 2026").iso).toBe("2026-08-12");
    expect(B.uraiTanggal("3-4-2025").iso).toBe("2025-04-03");
    expect(B.uraiTanggal("31 Februari 2026")).toBeNull();
    expect(B.uraiTanggal("32/01/2026")).toBeNull();
    expect(B.uraiTanggal("kemarin")).toBeNull();
  });

  const hasil = B.susunBukti({
    daftar: [
      { judul: "Daftar Bukti Penggugat", teks: F.DAFTAR_BUKTI_P, pengunggah: "Penggugat" },
      { judul: "Daftar Bukti Tergugat", teks: F.DAFTAR_BUKTI_T, pengunggah: "Tergugat" },
    ],
    berkasBukti: [],
    posita: "",
    sebutan: SEBUTAN,
  });
  const usulan = per(hasil.usulan);

  it("usulan: surat P ke 9470/9488/9492 bunyi bawaan variabel, surat T ke 9489/9493, elektronik ke 9951/9952", () => {
    for (const k of ["9470", "9488", "9492"]) {
      expect(usulan[k].nilai).toMatch(/^1\. Fotokopi Kartu Tanda Penduduk Elektronik atas nama Rahmi binti Hasan/);
      expect(usulan[k].nilai).toContain("lalu diberi tanda P.1;<br>2. Fotokopi Kutipan Akta Nikah Nomor 123/45/V/2018 tanggal 10 Mei 2018");
      expect(usulan[k].nilai).toContain("bukti surat tersebut telah diberi meterai cukup, di-nazegelen, serta telah dicocokkan dengan aslinya yang ternyata sesuai");
      // Bukti elektronik P.4 tidak masuk daftar surat; P.5 tetap bertanda P.5 (tanda bukan nomor urut).
      expect(usulan[k].nilai).not.toContain("WhatsApp");
      expect(usulan[k].nilai).toContain("lalu diberi tanda P.5;");
    }
    for (const k of ["9489", "9493"]) expect(usulan[k].nilai).toMatch(/^1\. Fotokopi Kartu Keluarga.*lalu diberi tanda T\.1;$/);
    expect(usulan["9951"].nilai).toBe("Tangkapan layar percakapan WhatsApp antara Penggugat dan Tergugat tanggal 3 Maret 2026, diberi tanda P.4");
    expect(usulan["9952"].nilai).toBe("Foto rumah tempat tinggal bersama, diberi tanda T.2;<br>Rekaman video kunjungan Tergugat ke rumah orang tua Penggugat, diberi tanda T.3");
  });

  it("semua ragu, menjaga isian petugas, bersumber berkas e-Court; tanpa kata Aleta dan kode #nnnn#", () => {
    for (const u of hasil.usulan) {
      expect(u.keyakinan).toBe("ragu");
      expect(u.jagaIsianLama).toBe(true);
      expect(u.sumber[0].asal).toBe("gugatan-ecourt");
    }
    const teks = JSON.stringify(hasil.usulan);
    expect(teks).not.toMatch(/aleta/i);
    expect(teks).not.toMatch(/#\d{3,5}#/);
  });

  it("kode ganda di dua berkas: yang pertama dipakai, selisih dicatat", () => {
    const h = B.susunBukti({
      daftar: [
        { judul: "Daftar 1", teks: "DAFTAR BUKTI PENGGUGAT\nP.1 Fotokopi Kartu Keluarga atas nama Rahmat\nP.2 Fotokopi Akta Nikah", pengunggah: "Penggugat" },
        { judul: "Daftar 2", teks: "DAFTAR BUKTI PENGGUGAT\nP.1 Fotokopi Ijazah atas nama Rahmi\nP.3 Fotokopi Akta Kelahiran", pengunggah: "Penggugat" },
      ],
    });
    expect(h.butir.map((b: Apa) => b.kode)).toEqual(["P.1", "P.2", "P.3"]);
    expect(h.butir[0].uraian).toContain("Kartu Keluarga");
    expect(h.catatan.join(" ")).toMatch(/P\.1 tertulis berbeda/);
  });

  it("berkas bukti yang judulnya bertanda P/T (satu berkas satu bukti) menjadi butir bila tidak ada daftar", () => {
    expect(B.butirDariJudul("Bukti P-3 Akta Nikah")).toMatchObject({ kode: "P.3", jenis: "Kutipan Akta Nikah" });
    expect(B.butirDariJudul("T.2 Foto rumah tinggal bersama")).toMatchObject({ kode: "T.2", elektronik: true });
    expect(B.butirDariJudul("Dokumen Bukti")).toBeNull();
    expect(B.butirDariJudul("Pernikahan lama")).toBeNull();
    expect(B.butirDariJudul("P-1")).toBeNull();
    const h = B.susunBukti({
      daftar: [],
      berkasBukti: [
        { judul: "Bukti P-1 Kartu Keluarga atas nama Rahmat", teks: "x" },
        { judul: "Bukti P-2 Akta Nikah Nomor 55/10/II/2015 tanggal 3 Februari 2015", teks: "x" },
        { judul: "Dokumen Bukti", teks: "x" },
      ],
    });
    expect(h.butir.map((b: Apa) => b.kode)).toEqual(["P.1", "P.2"]);
    expect(per(h.usulan)["9470"].nilai).toMatch(/^1\. Fotokopi Kartu Keluarga atas nama Rahmat.*tanda P\.1;<br>2\. Fotokopi Akta Nikah Nomor 55\/10\/II\/2015 tanggal 3 Februari 2015.*tanda P\.2;$/);
    // Butir daftar bukti yang sudah ada tidak digantikan oleh judul berkas.
    const dua = B.susunBukti({ daftar: [{ judul: "Daftar Bukti", teks: F.DAFTAR_BUKTI_P, pengunggah: "Penggugat" }], berkasBukti: [{ judul: "Bukti P-1 Ijazah", teks: "x" }] });
    expect(dua.butir.find((b: Apa) => b.kode === "P.1").uraian).toContain("Kartu Tanda Penduduk");
  });

  it("tanpa daftar bukti: tidak ada usulan bukti (nomor tidak dikarang)", () => {
    const h = B.susunBukti({ daftar: [], berkasBukti: [{ judul: "Dokumen Bukti", teks: F.BERKAS_KTP }], posita: "" });
    expect(h.usulan).toEqual([]);
  });
});

describe("71 - bukti P.3 itsbat: No. dan Tgl. Surat Keterangan KUA (0654, 0655)", () => {
  it("posita memuat nomor dan tanggal dalam satu kalimat suratnya -> jelas", () => {
    const o = B.suratKuaDariPosita(F.GUGATAN_ITSBAT_JELAS);
    expect(o).toMatchObject({ nomor: "B-045/Kua.19.04.2/PW.01/06/2026", jelas: true, bertentangan: false });
    expect(o.tanggal.tampil).toBe("05/06/2026");
  });

  it("posita tanpa nomor, atau dengan dua surat berbeda -> tidak dipakai", () => {
    expect(B.suratKuaDariPosita(F.GUGATAN_ITSBAT_TANPA_NOMOR)).toBeNull();
    const dua = B.suratKuaDariPosita(F.GUGATAN_ITSBAT_DUA_SURAT);
    expect(dua).toMatchObject({ nomor: "", tanggal: null, jelas: false, bertentangan: true });
    expect(B.suratKuaDariPosita("Bahwa Pemohon tidak memiliki surat keterangan dari Kantor Urusan Agama Nomor 12 tanggal 3 Mei 2026")).toBeNull();
  });

  it("urutan sumber: posita, lalu daftar bukti, lalu isi berkas bukti (OCR paling akhir)", () => {
    const daftar = [{ judul: "Daftar Bukti", teks: F.DAFTAR_BUKTI_P, pengunggah: "Penggugat" }];
    const dariPosita = B.susunBukti({ daftar, berkasBukti: [{ judul: "Dokumen Bukti", teks: F.BERKAS_KUA, baca: "ocr" }], posita: F.GUGATAN_ITSBAT_JELAS });
    expect(dariPosita.kua).toMatchObject({ nomor: "B-045/Kua.19.04.2/PW.01/06/2026", asal: "posita" });
    const dariDaftar = B.susunBukti({ daftar, berkasBukti: [{ judul: "Dokumen Bukti", teks: F.BERKAS_KUA, baca: "ocr" }], posita: F.GUGATAN_ITSBAT_TANPA_NOMOR });
    expect(dariDaftar.kua).toMatchObject({ nomor: "B-045/Kua.19.04.2/PW.01/06/2026", asal: "daftar-bukti" });
    const dariOcr = B.susunBukti({ daftar: [], berkasBukti: [{ judul: "Dokumen Bukti", teks: F.BERKAS_KUA, baca: "ocr" }], posita: F.GUGATAN_ITSBAT_TANPA_NOMOR });
    expect(dariOcr.kua).toMatchObject({ nomor: "B-078/Kua.19.04.2/PW.01/07/2026", asal: "ocr" });
    expect(dariOcr.kua.tanggal.tampil).toBe("14/07/2026");
    const p = per(dariOcr.usulan);
    expect(p["0654"]).toMatchObject({ nilai: "B-078/Kua.19.04.2/PW.01/07/2026", keyakinan: "ragu", jagaIsianLama: true, kodePola: "kua-ocr" });
    expect(p["0655"]).toMatchObject({ nilai: "14/07/2026", keyakinan: "ragu" });
    expect(p["0654"].sumber[0].kalimat).toContain("(dibaca OCR)");
    expect(p["0654"].catatan).toMatch(/ejaan nomor dan angka tanggal lebih mungkin meleset/);
  });

  it("gagal semua -> tidak ada usulan (dibiarkan kosong untuk diisi manual); KTP bukan surat keterangan", () => {
    const h = B.susunBukti({ daftar: [], berkasBukti: [{ judul: "KTP", teks: F.BERKAS_KTP }], posita: F.GUGATAN_ITSBAT_TANPA_NOMOR });
    expect(h.kua).toBeNull();
    expect(h.usulan.filter((u: Apa) => ["0654", "0655"].includes(u.kode))).toEqual([]);
  });

  it("dari posita pun tetap ragu sampai diukur atas berkas sungguhan (rencana Senin), tanpa kata Aleta", () => {
    const h = B.susunBukti({ daftar: [], berkasBukti: [], posita: F.GUGATAN_ITSBAT_JELAS });
    const p = per(h.usulan);
    expect(p["0654"]).toMatchObject({ keyakinan: "ragu", kodePola: "kua-posita", jelas: true });
    expect(p["0655"].nilai).toBe("05/06/2026");
    expect(JSON.stringify(h.usulan)).not.toMatch(/aleta/i);
  });
});

describe("75b - 9164 tanggapan atas sita; 75c - 9283 harta bersama rekonvensi", () => {
  it("9164: dalil jawaban yang subjeknya Tergugat dan bersikap tegas tentang sita, apa adanya", () => {
    const o = KH.tanggapanSita(J.bersihkanSurat(F.JAWABAN_SITA_HB), { sebutan: SEBUTAN, penulis: "Tergugat" });
    expect(o.nilai).toBe("keberatan atas permohonan sita jaminan yang diajukan Penggugat karena objek yang dimohonkan sita adalah harta pribadi Tergugat yang diperoleh sebelum menikah");
    // Kutipan pasal tentang sita tidak dipakai sebagai tanggapan.
    expect(o.nilai).not.toMatch(/Pasal 190/);
  });

  it("9164: dalil tentang sita yang subjeknya bukan Tergugat tidak dipakai; surat tanpa sita -> null", () => {
    expect(KH.tanggapanSita(J.bersihkanSurat(F.JAWABAN_SITA_BUKAN_TERGUGAT), { sebutan: SEBUTAN, penulis: "Tergugat" })).toBeNull();
    expect(KH.tanggapanSita(J.bersihkanSurat(F.JAWABAN_EKSEPSI_KEWENANGAN), { sebutan: SEBUTAN, penulis: "Tergugat" })).toBeNull();
  });

  it("9283: butir objek sesudah kalimat pengantar harta bersama di bagian rekonvensi, satu objek per baris", () => {
    const o = KH.objekHartaBersamaRekonvensi(J.bersihkanSurat(F.JAWABAN_SITA_HB));
    expect(o.objek).toEqual(["Sebidang tanah seluas 400 m2 yang terletak di Desa Contoh", "Sebuah rumah permanen di atas tanah tersebut", "Satu unit sepeda motor Honda tahun 2019"]);
    expect(o.nilai.split("\n")).toHaveLength(3);
  });

  it("9283: tanpa bagian rekonvensi atau tanpa daftar objek -> null", () => {
    expect(KH.objekHartaBersamaRekonvensi(J.bersihkanSurat(F.JAWABAN_PDF))).toBeNull();
    expect(KH.objekHartaBersamaRekonvensi(J.bersihkanSurat(F.JAWABAN_EKSEPSI_KEWENANGAN))).toBeNull();
  });

  it("lewat isiGugatanService: 9164 dan 9283 ragu, jagaIsianLama, bersumber jawaban", () => {
    const h = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen: [dok("Jawaban dari Tergugat", "jawaban", "Jawaban", "Tergugat", F.JAWABAN_SITA_HB, "0047")] });
    const p = per(h.usulan);
    expect(p["9164"]).toMatchObject({ keyakinan: "ragu", jagaIsianLama: true, kodePola: "jawaban-tanggapan-sita" });
    expect(p["9283"]).toMatchObject({ keyakinan: "ragu", jagaIsianLama: true, kodePola: "jawaban-rekonvensi-harta-bersama" });
    expect(p["9283"].nilai).toContain("sepeda motor Honda");
    expect(JSON.stringify([p["9164"], p["9283"]])).not.toMatch(/aleta|#\d{3,5}#/i);
  });
});

describe("lewat isiGugatanService: bukti, KUA, dan tanpa mengganggu deteksi lain", () => {
  const semua = S.susunIsiGugatan({
    sebutan: { lawan: "Pemohon", pelaku: "Termohon" },
    dokumen: [
      dok("Permohonan Itsbat", "gugatan", "", "Pemohon", F.GUGATAN_ITSBAT_JELAS, "0046"),
      dok("Daftar Bukti Pemohon", "bukti", "", "Pemohon", F.DAFTAR_BUKTI_P, "0046"),
      dok("Dokumen Bukti", "bukti", "", "", F.BERKAS_KUA, "", "ocr"),
      dok("Dokumen Bukti", "bukti", "", "", F.BERKAS_KTP),
    ],
  });

  it("daftar bukti dikenali walau berjudul bebas; berkas bukti lain masuk sumber KUA saja", () => {
    const p = per(semua.usulan);
    expect(p["9470"].nilai).toContain("diberi tanda P.3");
    expect(semua.bukti.map((b: Apa) => b.kode)).toEqual(["P.1", "P.2", "P.3", "P.4", "P.5"]);
    expect(semua.suratKua).toMatchObject({ nomor: "B-045/Kua.19.04.2/PW.01/06/2026", tanggal: "05/06/2026", asal: "posita", jelas: true });
    expect(p["0654"].nilai).toBe("B-045/Kua.19.04.2/PW.01/06/2026");
  });

  it("daftar bukti yang diunggah sebagai Kesimpulan (JJ) ikut dipakai sebagai daftar bukti", () => {
    const h = S.susunIsiGugatan({
      sebutan: SEBUTAN,
      dokumen: [dok("DAFTAR BUKTI SURAT", "kesimpulan", "Kesimpulan", "Penggugat", F.DAFTAR_BUKTI, "0046")],
    });
    const p = per(h.usulan);
    expect(p["9470"].nilai).toContain("lalu diberi tanda P.6;");
    // Tetap bukan kesimpulan: 8436 tidak diusulkan dari daftar bukti.
    expect(p["8436"]).toBeUndefined();
  });

  it("isian lain tidak berubah: tanpa berkas bukti tidak ada kunci bukti/suratKua berisi", () => {
    const h = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen: [dok("Jawaban", "jawaban", "Jawaban", "Tergugat", F.JAWABAN_PDF, "0047")] });
    expect(h.bukti).toEqual([]);
    expect(h.suratKua).toBeNull();
    expect(h.usulan.some((u: Apa) => /^(?:9470|9488|9489|9492|9493|9951|9952|0654|0655)$/.test(u.kode))).toBe(false);
  });
});

// ─── Portal: memilih dan membaca berkas bukti ────────────────────────────────

const arsip = (judul: string, jenis = "", ekstra: Partial<DokumenArsip> = {}): DokumenArsip => ({ documentKey: `k-${judul}`, judulDokumen: judul, jenisDokumen: jenis, peranPengunggah: "", diunggahPada: "2026-07-20", adaPdf: true, adaWord: false, ...ekstra });

describe("portal - memilih berkas bukti", () => {
  it("daftar/alat bukti dan surat keterangan dipilih; KTP, kartu anggota, kuasa, gugatan, dan jawab-menjawab tidak", () => {
    const pilih = pilihDokumenBukti([
      arsip("KTP"),
      arsip("Kartu Tanda Anggota"),
      arsip("Surat Kuasa Khusus"),
      arsip("Dokumen Gugatan"),
      arsip("Bukti Nurlina", "Replik"),
      arsip("Dokumen Bukti"),
      arsip("Alat Bukti Surat", "", { diunggahPada: "2026-07-25" }),
      arsip("Surat Keterangan Nikah Tidak Tercatat"),
      arsip("DAFTAR BUKTI SURAT", "Kesimpulan"),
    ]);
    expect(pilih.map((d) => d.judulDokumen)).toEqual(["Alat Bukti Surat", "Dokumen Bukti", "Surat Keterangan Nikah Tidak Tercatat"]);
  });

  it("rencanaBaca membawa bukti paling banyak enam berkas", () => {
    const banyak = Array.from({ length: 9 }, (_, i) => arsip(`Dokumen Bukti ${i}`));
    expect(rencanaBaca([arsip("Dokumen Gugatan"), ...banyak]).bukti).toHaveLength(6);
  });
});

describe("portal - bacaIsiGugatan dengan dan tanpa bukti", () => {
  const berkas: DokumenArsip[] = [arsip("Dokumen Gugatan"), arsip("Daftar Bukti Pemohon"), arsip("Dokumen Bukti")];
  const bangun = (kirim: (m: Apa) => void) => ({
    rincian: async () => ({ ok: true, dokumen: berkas }),
    ambilBerkas: async (kunci: string) => Buffer.from(kunci),
    halamanPdf: async (data: Buffer) => [String(data) === "k-Dokumen Gugatan" ? F.GUGATAN_ITSBAT_JELAS : String(data) === "k-Daftar Bukti Pemohon" ? F.DAFTAR_BUKTI_P : F.BERKAS_KUA],
    bacaTeks: async () => ({ teks: "", sumber: "" as const, sebab: "kosong" }),
    kirimBot: async (muatan: Apa) => {
      kirim(muatan);
      return { ok: true, ada: true, tanyaJawab: [{ kode: "6112" }], bukti: [{ kode: "P.1" }], suratKua: { nomor: "B-1" }, usulan: [], jawab: [] };
    },
  });

  it("tanpa bukti=1 berkas bukti tidak dibaca; dengan bukti=1 dikirim ke bot sebagai peran bukti beserta tanggal unggah", async () => {
    const tanpa: Apa[] = [];
    await bacaIsiGugatan("901/Pdt.P/2026/PA.Xyz", { lawan: "Pemohon", pelaku: "Termohon" }, bangun((m) => tanpa.push(m)));
    expect(tanpa[0].dokumen.map((d: Apa) => d.peran)).toEqual(["gugatan"]);
    const dengan: Apa[] = [];
    const h = await bacaIsiGugatan("901/Pdt.P/2026/PA.Xyz", { lawan: "Pemohon", pelaku: "Termohon" }, bangun((m) => dengan.push(m)), undefined, { denganBukti: true });
    expect(dengan[0].dokumen.map((d: Apa) => d.peran)).toEqual(["gugatan", "bukti", "bukti"]);
    expect(dengan[0].dokumen[1].diunggah).toBe("2026-07-20");
    expect(h.tanyaJawab).toEqual([{ kode: "6112" }]);
    expect(h.bukti).toEqual([{ kode: "P.1" }]);
    expect(h.suratKua).toEqual({ nomor: "B-1" });
  });
});
