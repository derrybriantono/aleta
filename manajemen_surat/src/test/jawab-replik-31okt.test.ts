import path from "node:path";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * JAWAB-REPLIK (31 Okt 2026): naskah utuh jawaban (+ gugatan rekonvensi), replik (+ jawaban rekonvensi), duplik (+ replik
 * rekonvensi), duplik rekonvensi, kesimpulan kedua pihak untuk isian Blangko Derry 12020-12028 - teks berparagraf yang
 * dirapikan dari dokumen e-Court. Dokumen sungguhan tidak ada di laptop: fixture REKAAN berbentuk keluaran pembaca PDF
 * (fixtures/jawab-replik-31okt.cjs). Yang diuji: bentuk (paragraf, penomoran, sub-judul, petitum, titik koma, sebutan),
 * pemisahan rekonvensi, pembuangan kop/penutup, dan aturan keyakinan usulan (ditulis sendiri vs saran).
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const N: Apa = muat(path.join(AKAR, "aleta_bot/services/naskahJawabMenjawabService.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const F: Apa = muat(path.join(AKAR, "manajemen_surat/src/test/fixtures/jawab-replik-31okt.cjs"));

const CT = { lawan: "Pemohon", pelaku: "Termohon" };
const CG = { lawan: "Penggugat", pelaku: "Tergugat" };
const baris = (t: string) => String(t).split("\n");
const RE_LATIN1 = /^[\u0009\u000A\u000D -~ -ÿ]*$/;

function dok(judul: string, teks: string, jenis: string, pengunggah: string, diunggah: string, ekstra: Apa = {}) {
  return { judul, peran: "jawaban", teks, jenis, pengunggah, penuntutKode: /Penggugat/.test(pengunggah) ? "0046" : /Tergugat/.test(pengunggah) ? "0047" : "", diunggah, ...ekstra };
}
const PERKARA_REKON = () => [
  dok("Jawaban Konvensi dan Gugatan Rekonvensi", F.JAWABAN_REKON, "Jawaban", "Tergugat", "2026-07-27"),
  dok("Replik Pemohon dan Jawab Rekonvensi Tergugat Rekonvensi", F.REPLIK_REKON, "Replik", "Penggugat", "2026-08-02", { peran: "replik" }),
  dok("Duplik Konvensi dan Replik Rekonvensi", F.DUPLIK_REKON, "Duplik", "Tergugat", "2026-08-05", { peran: "duplik" }),
  dok("Duplik Rekonvensi", F.REREPLIK, "Rereplik", "Penggugat", "2026-08-06", { peran: "duplik" }),
  dok("Kesimpulan Pemohon", F.KESIMPULAN_P, "Kesimpulan", "Penggugat", "2026-08-27", { peran: "kesimpulan" }),
  dok("KESIMPULAN TERMOHON", F.KESIMPULAN_T, "Kesimpulan", "Tergugat", "2026-08-27", { peran: "kesimpulan" }),
];

describe("bentuk naskah - jawaban bernomor dengan gugatan rekonvensi (PDF berhalaman)", () => {
  const h = N.naskahDariSurat(F.JAWABAN_REKON, { sebutan: CT, penulis: "Termohon" });

  it("rapi dan yakin; kop, salam, identitas, nomor halaman, kepala berulang, penutup, tanda tangan dibuang", () => {
    expect(h.yakin).toBe(true);
    const semua = `${h.konvensi}\n${h.rekonvensi}`;
    expect(semua).not.toMatch(/Kepada Yth|Assalamu|Dengan hormat|Yang bertanda tangan|NIK|Nama :|Wassalam|Hormat saya|Demikian|- \d+ -|Perkara Nomor 901|Xyz, 27 Juli|Siti Rahmah/);
    expect(h.dibuang.nomorHalaman).toBeGreaterThanOrEqual(2);
  });

  it("satu paragraf per baris: baris PDF yang terpotong disambung, tanpa spasi ganda, tanpa baris kosong", () => {
    for (const l of baris(`${h.konvensi}\n${h.rekonvensi}`)) {
      expect(l).toBe(l.trim());
      expect(l).not.toMatch(/\s{2}/);
      expect(l.length).toBeGreaterThan(0);
    }
    // Butir 4 jawaban (dipatahkan 3 baris di PDF) utuh dalam satu baris.
    expect(baris(h.konvensi)).toContain(
      "4. Bahwa Termohon pada dasarnya tidak keberatan untuk bercerai dengan Pemohon, asalkan hak-hak Termohon dan anak-anak dipenuhi oleh Pemohon sebagaimana diuraikan dalam gugatan rekonvensi di bawah ini;"
    );
  });

  it("penomoran dipertahankan (1. 2. 3. dan rincian a. b. c.), sub-judul baku berdiri sendiri", () => {
    const k = baris(h.konvensi);
    expect(k[0]).toBe("Dalam Konvensi");
    expect(k.filter((l) => /^\d\. Bahwa/.test(l)).map((l) => l.slice(0, 2))).toEqual(["1.", "2.", "3.", "4."]);
    expect(k.filter((l) => /^[a-c]\. /.test(l)).map((l) => l.slice(0, 2))).toEqual(["a.", "b.", "c."]);
    expect(baris(h.rekonvensi)[0]).toBe("Dalam Rekonvensi");
    expect(baris(h.rekonvensi)).toContain("Dalam Konvensi dan Rekonvensi");
  });

  it("titik koma di tengah butir: '; bahwa' menjadi butir '- Bahwa' di bawah butir bernomor", () => {
    const k = baris(h.konvensi);
    const i = k.findIndex((l) => l.startsWith("2. Bahwa Termohon membenarkan dalil angka 3"));
    expect(k[i]).toMatch(/pengasuhan Termohon;$/);
    expect(k[i + 1]).toBe("- Bahwa selama ini anak-anak tersebut tidak pernah diberi nafkah oleh Pemohon sejak bulan Januari 2026;");
    for (const l of baris(`${h.konvensi}\n${h.rekonvensi}`)) expect(l.replace(/;$/, "")).not.toMatch(/;/);
  });

  it("rekonvensi dipisah ke isiannya sendiri: dalil rekonvensi dan seluruh petitum, urutan surat tetap", () => {
    expect(h.konvensi).not.toMatch(/Rekonvensi menuntut|Mengabulkan gugatan/);
    expect(h.rekonvensi).toMatch(/^Dalam Rekonvensi\n1\. Bahwa apa yang telah diuraikan dalam konvensi/);
    expect(h.rekonvensi).toMatch(/Berdasarkan alasan-alasan tersebut di atas, Termohon mohon/);
    // Isi surat tidak hilang: tiap dalil/petitum sumber ada di salah satu bagian.
    for (const p of ["nafkah iddah selama 3 (tiga) bulan", "kenaikan 10% setiap tahun", "ex aequo et bono"]) expect(`${h.konvensi}\n${h.rekonvensi}`).toContain(p);
  });

  it("petitum: butir amar tanpa nomor diberi nomor per sub-judul; rincian sebaris ': a. ...; b. ...' dipecah per baris", () => {
    const r = baris(h.rekonvensi);
    const i = r.indexOf("Dalam Konvensi");
    expect(r[i + 1]).toBe("1. Menolak permohonan Pemohon untuk seluruhnya;");
    const j = r.findIndex((l) => l.startsWith("2. Menghukum Tergugat Rekonvensi untuk membayar kepada Penggugat Rekonvensi:"));
    expect(r[j]).toMatch(/Rekonvensi:$/);
    expect(r[j + 1]).toBe("a. Nafkah iddah sejumlah Rp3.000.000,00 (tiga juta rupiah);");
    expect(r[j + 2]).toBe("b. Mut'ah berupa uang sejumlah Rp5.000.000,00 (lima juta rupiah);");
    expect(r[r.indexOf("Dalam Konvensi dan Rekonvensi") + 1]).toBe("1. Membebankan biaya perkara sesuai ketentuan yang berlaku;");
    expect(r[r.length - 1]).toBe("Atau apabila Majelis Hakim berpendapat lain, mohon putusan yang seadil-adilnya (ex aequo et bono).");
  });

  it("sebutan: 'saya' -> Termohon, 'Rekonpensi' -> Rekonvensi; kata pihak rekonvensi tidak diganti", () => {
    expect(h.konvensi).not.toMatch(/\bsaya\b/i);
    expect(h.konvensi).toMatch(/^1\. Bahwa Termohon membenarkan/m);
    expect(`${h.konvensi}${h.rekonvensi}`).not.toMatch(/Rekonpensi/);
    expect(h.rekonvensi).toMatch(/Termohon Konvensi disebut Penggugat Rekonvensi dan Pemohon Konvensi disebut Tergugat Rekonvensi/);
  });
});

describe("bentuk naskah - eksepsi + pokok perkara oleh kuasa (sub-judul Romawi, PRIMAIR/SUBSIDAIR)", () => {
  const h = N.naskahDariSurat(F.JAWABAN_EKSEPSI, { sebutan: CG, penulis: "Tergugat" });
  const b = baris(h.konvensi);

  it("kop kantor advokat, telepon, surel, perihal, tanda tangan kuasa dibuang", () => {
    expect(h.konvensi).not.toMatch(/KANTOR ADVOKAT|Telp|kantor@|Perihal|Hormat kami|Kuasa Hukum Tergugat|Andi Lawalata/);
    expect(h.rekonvensi).toBe("");
  });

  it("'I. DALAM EKSEPSI' / 'II. DALAM POKOK PERKARA' -> sub-judul baku; nomor butir per bagian tetap", () => {
    expect(b[0]).toBe("Dalam Eksepsi");
    expect(b).toContain("Dalam Pokok Perkara");
    expect(b.slice(1, 3).map((l) => l.slice(0, 3))).toEqual(["1. ", "2. "]);
  });

  it("PRIMAIR/SUBSIDAIR menjadi 'Primair:'/'Subsidair:', amar tanpa nomor diberi nomor per sub-judul", () => {
    const p = b.indexOf("Primair:");
    expect(b.slice(p, p + 4)).toEqual(["Primair:", "Dalam Eksepsi", "1. Menerima eksepsi Tergugat;", "2. Menyatakan gugatan Penggugat tidak dapat diterima;"]);
    expect(b[b.indexOf("Subsidair:") + 1]).toMatch(/^Apabila Majelis Hakim berpendapat lain/);
  });

  it("'klien kami' -> Tergugat", () => {
    expect(h.konvensi).toMatch(/karena Tergugat selalu mengirimkan uang/);
    expect(h.konvensi).not.toMatch(/klien kami/);
  });
});

describe("bentuk naskah - replik gaya 'Bahwa' tanpa nomor + jawaban rekonvensi", () => {
  const h = N.naskahDariSurat(F.REPLIK_REKON, { sebutan: CT, penulis: "Pemohon" });
  it("tiap 'Bahwa' satu paragraf; '; bahwa' menjadi paragraf 'Bahwa' baru (bukan butir '-')", () => {
    const k = baris(h.konvensi);
    expect(k[0]).toBe("Dalam Konvensi");
    expect(k.slice(1).every((l) => /^Bahwa /.test(l))).toBe(true);
    expect(k).toContain("Bahwa hal itu telah diketahui Termohon sejak sebelum menikah;");
  });
  it("jawaban rekonvensi terpisah, berawal sub-judul, petitum bernomor", () => {
    expect(baris(h.rekonvensi)[0]).toBe("Dalam Rekonvensi");
    expect(h.rekonvensi).toMatch(/\n1\. Mengabulkan permohonan Pemohon;\n2\. Memberi izin kepada Pemohon untuk menjatuhkan talak satu raj'i/);
  });
});

describe("bentuk naskah - PDF terpotong keras (duplik + replik rekonvensi)", () => {
  const h = N.naskahDariSurat(F.DUPLIK_REKON, { sebutan: CT, penulis: "Termohon" });
  it("nomor butir yang berdiri sendiri disatukan, kata terpenggal di batas halaman disambung, bulatan font -> '-'", () => {
    const k = baris(h.konvensi);
    expect(k[1]).toBe("1. Bahwa Termohon tetap pada dalil-dalil jawaban semula dan menolak dalil-dalil replik Pemohon, kecuali yang diakui secara tegas kebenarannya oleh Termohon;");
    expect(k[2]).toMatch(/sehingga kebutuhan sehari-hari ditanggung orang tua Termohon;$/);
    const r = baris(h.rekonvensi);
    expect(r.filter((l) => l.startsWith("- Bahwa Penggugat Rekonvensi"))).toHaveLength(2);
    expect(`${h.konvensi}${h.rekonvensi}`).not.toMatch(/|Duplik Termohon Perkara Nomor|- [123] -/);
  });
});

describe("arahan pengguna 31 Okt: hanya dalil (posita) dan petitum yang diambil", () => {
  const h = N.naskahDariSurat(F.JAWABAN_LENGKAP, { sebutan: CG, penulis: "Tergugat" });
  it("surat lengkap menyisakan PERSIS sub-judul + dalil + petitum, berurutan", () => {
    expect(h.yakin).toBe(true);
    expect(baris(h.konvensi)).toEqual([
      "Dalam Pokok Perkara",
      "1. Bahwa Tergugat menolak seluruh dalil gugatan Penggugat, kecuali yang secara tegas diakui kebenarannya oleh Tergugat;",
      "2. Bahwa benar Penggugat dan Tergugat menikah pada tanggal 10 Mei 2018 dan telah dikaruniai 1 (satu) orang anak;",
      "3. Bahwa tidak benar Tergugat meninggalkan tempat kediaman bersama, karena yang meninggalkan rumah adalah Penggugat sejak bulan Maret 2026;",
      "Berdasarkan alasan-alasan tersebut di atas, Tergugat mohon kepada Majelis Hakim untuk memutus:",
      "1. Menolak gugatan Penggugat untuk seluruhnya;",
      "2. Membebankan biaya perkara kepada Penggugat;",
      "Atau apabila Majelis Hakim berpendapat lain, mohon putusan yang seadil-adilnya (ex aequo et bono).",
    ]);
  });
  it("tiap bagian bukan-isi tidak tersisa satu kata pun", () => {
    for (const sisa of [/KANTOR HUKUM/, /Advokat/, /081200000000|surel/, /Nomor : 12/, /Lampiran/, /Perihal/, /Xyz, 10 Agustus/, /Kepada Yth/, /Cq\./, /Assalamu/, /Dengan hormat/, /bertanda tangan/, /Surat Kuasa Khusus/, /Budi Santoso/, /Selanjutnya disebut/, /Dengan ini mengajukan/, /Perkenankanlah/, /Demikian/, /terima kasih/, /Wassalam/, /Hormat kami/, /Kuasa Hukum/, /Rahmat Hidayat|Nurul Aini/, /Tembusan|Arsip/, /- \d+ -/, /Perkara Nomor 903/]) {
      expect(h.konvensi, String(sisa)).not.toMatch(sisa);
    }
  });
  it("dalil yang menyebut 'dalam hal ini bertindak' tetap dalil (penjaga hanya untuk kalimat bukan 'Bahwa')", () => {
    const t = F.pdf(["JAWABAN", "Bahwa Tergugat dalam hal ini bertindak sebagai kepala keluarga yang selalu memberi nafkah kepada Penggugat setiap bulan;", "Bahwa Tergugat menolak dalil Penggugat tentang pisah rumah karena keduanya masih tinggal serumah sampai sekarang;"]);
    const g = N.naskahDariSurat(t, { sebutan: CG, penulis: "Tergugat" });
    expect(baris(g.konvensi)[0]).toMatch(/^Bahwa Tergugat dalam hal ini bertindak sebagai kepala keluarga/);
  });
});

describe("bentuk naskah - surat yang tidak dapat dipastikan", () => {
  it("tanpa 'Bahwa', nomor, atau sub-judul: tidak yakin (hanya saran)", () => {
    const h = N.naskahDariSurat(F.JAWABAN_TANPA_PENANDA, { sebutan: CT, penulis: "Termohon" });
    expect(h.yakin).toBe(false);
    expect(h.alasan.join(" ")).toMatch(/awal isi surat tidak terpisah jelas/);
  });
  it("karakter rusak menolak keyakinan", () => {
    const rusak = F.pdf(F.PAR_JAWABAN_REKON.map((p: string) => p.replace("Kecamatan Contoh;", "Kecamatan Contoh��;")), { kepala: F.KEPALA_JAWAB, perHalaman: 24 });
    expect(rusak).toContain("�");
    const h = N.naskahDariSurat(rusak, { sebutan: CT, penulis: "Termohon" });
    expect(h.yakin).toBe(false);
    expect(h.alasan.join(" ")).toMatch(/karakter rusak/);
  });
});

describe("usulan isian 12020-12028 lewat susunIsiGugatan", () => {
  const h = S.susunIsiGugatan({ dokumen: PERKARA_REKON(), sebutan: CT });
  const u = (kode: string) => h.usulan.filter((x: Apa) => x.kode === kode);

  it("tiap bagian jawab-menjawab mendapat isiannya sendiri, berkeyakinan cukup (ditulis sendiri bila kosong), isian lama dijaga", () => {
    for (const kode of ["12020", "12021", "12022", "12023", "12024", "12025", "12026", "12027", "12028"]) {
      expect(u(kode), kode).toHaveLength(1);
      expect(u(kode)[0]).toMatchObject({ keyakinan: "cukup", jagaIsianLama: true });
      expect(u(kode)[0].nilai.length).toBeGreaterThan(80);
    }
    expect(u("12021")[0].nilai).toMatch(/^Dalam Rekonvensi/);
    expect(u("12026")[0].nilai).toMatch(/^Bahwa Tergugat Rekonvensi tetap pada jawaban rekonvensi semula/);
    expect(u("12027")[0].nilai).toMatch(/^1\. Bahwa Pemohon tetap pada dalil-dalil permohonan semula/);
  });

  it("keterangan sumber menyebut judul dokumen, pihak, dan tanggal unggah; tanpa nomor variabel dan kata 'Aleta'", () => {
    expect(u("12020")[0].catatan).toMatch(/dokumen e-Court "Jawaban Konvensi dan Gugatan Rekonvensi" \(Termohon, diunggah 27 Juli 2026\)/);
    for (const x of h.usulan.filter((y: Apa) => /^120/.test(y.kode))) {
      expect(`${x.nilai} ${x.catatan} ${x.nama}`).not.toMatch(/aleta/i);
      expect(x.nilai).not.toMatch(/#\d{4,5}#/);
      expect(RE_LATIN1.test(x.nilai)).toBe(true);
    }
  });

  it("frasa kesimpulan 'tetap pada ...' (8436/8437) ikut ditulis sendiri dan mengalahkan saran lama", () => {
    const k = u("8436").find((x: Apa) => x.keyakinan === "cukup");
    expect(k.nilai).toBe("tetap pada dalil-dalil permohonan semula untuk bercerai dengan Termohon");
    expect(u("8437").find((x: Apa) => x.keyakinan === "cukup").nilai).toBe("tetap pada jawaban dan duplik semula");
  });

  it("tanpa rekonvensi: hanya isian konvensi, tanpa sub-judul 'Dalam Konvensi' tambahan", () => {
    const g = S.susunIsiGugatan({ dokumen: [dok("Jawaban Tergugat", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-08-05")], sebutan: CG });
    expect(g.usulan.filter((x: Apa) => x.kode === "12021")).toHaveLength(0);
    const j = g.usulan.find((x: Apa) => x.kode === "12020");
    expect(j.nilai).toMatch(/^Dalam Eksepsi\n/);
  });

  it("saran saja (ragu) bila: dua berkas untuk bagian yang sama, dibaca OCR, jenis/isi bertentangan; Turut Tergugat tidak diisi", () => {
    const dua = S.susunIsiGugatan({ dokumen: [dok("Jawaban dari Tergugat", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-09-09"), dok("Eksepsi dan Jawaban Tergugat", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-09-15")], sebutan: CG });
    const j = dua.usulan.find((x: Apa) => x.kode === "12020");
    expect(j.keyakinan).toBe("ragu");
    expect(j.catatan).toMatch(/ada 2 berkas jawaban - dipakai yang terakhir diunggah/);
    expect(j.dokumen).toBe("Eksepsi dan Jawaban Tergugat");
    const ocr = S.susunIsiGugatan({ dokumen: [dok("Jawaban", F.JAWABAN_EKSEPSI, "Jawaban", "Tergugat", "2026-08-05", { baca: "ocr" })], sebutan: CG });
    expect(ocr.usulan.find((x: Apa) => x.kode === "12020").keyakinan).toBe("ragu");
    const turut = S.susunIsiGugatan({ dokumen: [dok("JAWABAN TURUT TERGUGAT", F.JAWABAN_EKSEPSI, "Jawaban", "Turut Tergugat", "2026-07-22")], sebutan: CG });
    expect(turut.usulan.filter((x: Apa) => /^120/.test(x.kode))).toHaveLength(0);
    // Daftar bukti yang diunggah sebagai "Kesimpulan" bukan kesimpulan.
    const bukti = S.susunIsiGugatan({ dokumen: [dok("DAFTAR BUKTI SURAT", "DAFTAR BUKTI SURAT PENGGUGAT\nP.1 Fotokopi KTP Penggugat atas nama Rahmi binti Hasan yang dikeluarkan Dinas Kependudukan\nP.2 Fotokopi Kutipan Akta Nikah Nomor 123/45/V/2018 tanggal 10 Mei 2018", "Kesimpulan", "Penggugat", "2026-08-19", { peran: "kesimpulan" })], sebutan: CG });
    expect(bukti.usulan.filter((x: Apa) => x.kode === "12027")).toHaveLength(0);
  });

  it("duplik yang diunggah Penggugat/Pemohon (bukan Rereplik) tetap duplik rekonvensi", () => {
    const g = S.susunIsiGugatan({ dokumen: [dok("Duplik Rekonvensi Pemohon", F.REREPLIK, "Duplik", "Penggugat", "2026-07-22", { peran: "duplik" })], sebutan: CT });
    expect(g.usulan.filter((x: Apa) => x.kode === "12026")).toHaveLength(1);
    expect(g.usulan.filter((x: Apa) => x.kode === "12024")).toHaveLength(0);
  });
});

describe("simpan suntingan isian berparagraf", () => {
  it("rapikanSimpanan: Enter tetap pemisah paragraf, spasi ganda dan baris kosong dibuang, isi tidak diubah", () => {
    expect(N.rapikanSimpanan("Dalam Konvensi  \r\n\r\n1.  Bahwa   Tergugat menolak;\n\n  2. Bahwa ...  ")).toBe("Dalam Konvensi\n1. Bahwa Tergugat menolak;\n2. Bahwa ...");
    expect(N.KODE_BERBARIS).toEqual(["12020", "12021", "12022", "12023", "12024", "12025", "12026", "12027", "12028"]);
  });
});
