import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * JJ2 (18 Okt 2026), keputusan 74: jawaban, replik, dan duplik tertulis dari e-Court ditulis OTOMATIS ke penyunting
 * tanya-jawab ABT per sidang BILA "rapi". Berkas e-Court sungguhan tidak ada di laptop: semua teks REKAAN
 * (fixtures/tanya-jawab-bukti-ecourt.cjs). Yang diuji:
 *   - ukuran rapi (tiap ukuran punya satu surat yang gagal sendirian) dan bentuk barisnya;
 *   - penulis di ekstensi (isiJawabMenjawabOtomatis): baris lama utuh, dua kali jalan tidak menggandakan, format kacau
 *     tidak ditulis, bacaan ABT gagal tidak menulis, isian ketikan menang, saklar mati tidak menulis;
 *   - sidang tujuan: agenda yang sesuai + tanggal unggah; tanpa kata "Aleta" dan tanpa kode #nnnn# pada teks yang ditulis.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const J: Apa = muat(path.join(AKAR, "aleta_bot/services/jawabMenjawabEcourtService.js"));
const TJ: Apa = muat(path.join(AKAR, "aleta_bot/services/tanyaJawabEcourtService.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const F: Apa = muat(path.join(AKAR, "manajemen_surat/src/test/fixtures/tanya-jawab-bukti-ecourt.cjs"));

const SEBUTAN = { lawan: "Penggugat", pelaku: "Tergugat" };
const hitung = (teks: string, jenis = "Jawaban", pengunggah = "Tergugat", kode = "0047", ekstra: Apa = {}) => {
  const k = J.kenaliJenis({ jenis, judul: jenis, pengunggah, penuntutKode: kode, teks });
  return TJ.tanyaJawabDariSurat({ teks, k, sebutan: SEBUTAN, ...ekstra });
};

describe("JJ2 - ukuran rapi tanya-jawab", () => {
  it("jawaban yang bersih: baris judul bagian + satu baris per dalil, tanpa 'Bahwa' di depan, berakhir titik koma", () => {
    const h = hitung(F.JAWABAN_PDF);
    expect(h).toMatchObject({ rapi: true, alasan: [], kode: "6112", rujukan: "2018", kunci: "jawaban lisan 0047", pihak: "0047" });
    expect(h.baris.map((r: Apa) => r.tanya)).toEqual([
      "Dalam Konvensi:",
      "Jawaban Tergugat (tertulis), butir 1:",
      "Jawaban Tergugat (tertulis), butir 2:",
      "Jawaban Tergugat (tertulis), butir 3:",
      "Dalam Rekonvensi:",
      "Jawaban Tergugat (tertulis), butir 4:",
    ]);
    const jawab = h.baris.map((r: Apa) => r.jawab).filter(Boolean);
    expect(jawab).toHaveLength(4);
    for (const j of jawab) {
      expect(j).not.toMatch(/^bahwa\b/i);
      expect(j).toMatch(/;$/);
      expect(j).toMatch(/^[A-Z]/);
    }
    // Kop, salam, identitas, penutup, tanda tangan, nomor halaman tidak ikut.
    const semua = h.baris.map((r: Apa) => `${r.tanya} ${r.jawab}`).join(" ");
    expect(semua).not.toMatch(/Assalamu|Hormat kami|Budi Santoso|NIK|Telp|kantor@|Kepada Yth|- 2 -|JAWABAN TERGUGAT PERKARA NOMOR/);
    // Kutipan pasal dan definisi "disebut Penggugat Rekonvensi" tidak dijadikan butir.
    expect(semua).not.toMatch(/Pasal 39|disebut Penggugat Rekonvensi/);
    expect(h.ukuran).toMatchObject({ butir: 4, judul: 2, terstrukturSemua: true, akhirTanda: 1 });
  });

  it("replik dan duplik memakai kolom 6113 / 6114 dengan pihaknya", () => {
    const r = hitung(F.REPLIK, "Replik", "Penggugat", "0046");
    expect(r).toMatchObject({ rapi: true, kode: "6113", rujukan: "2019", kunci: "replik lisan 0046", pihak: "0046" });
    expect(r.baris[0].tanya).toBe("Replik Penggugat (tertulis), butir 1:");
    const d = hitung(F.DUPLIK, "Duplik", "Tergugat", "0047");
    expect(d).toMatchObject({ rapi: true, kode: "6114", rujukan: "2020", kunci: "duplik lisan 0047" });
  });

  it("eksepsi dan pokok perkara: judul bagian jadi baris sendiri", () => {
    const h = hitung(F.JAWABAN_EKSEPSI_KEWENANGAN);
    expect(h.rapi).toBe(true);
    expect(h.baris.filter((r: Apa) => !r.jawab).map((r: Apa) => r.tanya)).toEqual(["Dalam Eksepsi:", "Dalam Pokok Perkara:"]);
  });

  it("ukuran 4a: terlalu sedikit butir dan terlalu pendek -> tidak rapi, tidak ada baris", () => {
    const h = hitung(F.JAWABAN_SATU_PARAGRAF);
    expect(h.rapi).toBe(false);
    expect(h.alasan.join(" ")).toMatch(/butir dalil terlalu sedikit/);
    expect(h.alasan.join(" ")).toMatch(/isi terlalu pendek/);
    expect(h.baris).toEqual([]);
  });

  it("ukuran 5: butir tanpa struktur dalil -> tidak rapi", () => {
    const h = hitung(F.JAWABAN_TANPA_STRUKTUR);
    expect(h.rapi).toBe(false);
    expect(h.alasan).toContain("ada butir yang tidak berbentuk dalil");
    expect(h.ukuran.terstrukturSemua).toBe(false);
  });

  it("ukuran 6: sisa kop, tanda tangan, surel -> tidak rapi", () => {
    const h = hitung(F.JAWABAN_SISA_TANDA_TANGAN);
    expect(h.rapi).toBe(false);
    expect(h.alasan.join(" ")).toMatch(/tanda tangan tersisa/);
    expect(h.alasan.join(" ")).toMatch(/surel/);
  });

  it("ukuran 7: karakter rusak dan huruf berserak (OCR) -> tidak rapi", () => {
    const rusak = hitung(F.JAWABAN_KARAKTER_RUSAK);
    expect(rusak.rapi).toBe(false);
    expect(rusak.alasan).toContain("ada karakter rusak");
    const berserak = hitung(F.JAWABAN_OCR_BERSERAK);
    expect(berserak.rapi).toBe(false);
    expect(berserak.alasan.join(" ")).toMatch(/huruf berserak/);
    // Mojibake dan karakter kendali ditangkap oleh pemeriksa karakter yang sama.
    expect(TJ.cacatKarakter("tidak benar karena Ã© dan lainnya")).toContain("ada huruf berantakan (salah sandi)");
    expect(TJ.cacatKarakter("tidak\u0007 benar")).toContain("ada karakter kendali");
    expect(TJ.cacatKarakter("Bahwa Tergugat membantah dalil Penggugat karena tidak benar dan tidak sesuai kenyataan.")).toEqual([]);
  });

  it("ukuran 9: huruf besar semua -> tidak rapi; kata ganti orang pertama yang harus diganti -> tidak rapi", () => {
    expect(hitung(F.JAWABAN_HURUF_BESAR).alasan).toContain("surat diketik huruf besar semua");
    const awam = hitung(F.JAWABAN_AWAM, "Jawaban", "Termohon", "0047");
    expect(awam.rapi).toBe(false);
    expect(awam.alasan.join(" ")).toMatch(/kata ganti orang pertama/);
  });

  it("ukuran 1-2: jenis ragu, Turut Tergugat, pengunggah salah kolom, OCR, rereplik, dua berkas peran sama -> tidak rapi", () => {
    expect(hitung(F.JAWABAN_PDF, "Jawaban", "Turut Tergugat", "0047").alasan.join(" ")).toMatch(/Turut/);
    expect(hitung(F.JAWABAN_PDF, "Jawaban", "Penggugat", "0046").alasan).toContain("pengunggah tidak cocok dengan kolom tanya-jawabnya");
    // Pengunggah kosong dan surat tidak menyebut pihaknya di kepala -> tidak dikenali (menyebut pihak di kepala surat cukup untuk mengenalinya).
    const tanpaPihak = F.JAWABAN_PDF.replace(/tergugat/gi, "Pihak");
    expect(hitung(tanpaPihak, "Jawaban", "", "").alasan).toContain("pengunggah tidak dikenali");
    expect(hitung(F.JAWABAN_PDF, "Jawaban", "Tergugat", "0047", { baca: "ocr" }).alasan).toContain("dibaca OCR");
    expect(hitung(F.JAWABAN_PDF, "Jawaban", "Tergugat", "0047", { banyakSePeran: 2 }).alasan.join(" ")).toMatch(/ada 2 berkas jawaban/);
    const rereplik = hitung(F.DUPLIK, "Rereplik", "Penggugat", "0046");
    expect(rereplik.rapi).toBe(false);
    expect(rereplik.alasan.join(" ")).toMatch(/rereplik/);
    // Kesimpulan dan daftar bukti tidak punya kolom tanya-jawab.
    expect(hitung(F.KESIMPULAN_PENGGUGAT, "Kesimpulan", "Penggugat", "0046").alasan).toContain("bukan jawaban, replik, atau duplik");
  });

  it("keluaran aman: tanpa kata Aleta dan tanpa kode #nnnn#, hanya huruf yang dapat disimpan ABT", () => {
    for (const h of [hitung(F.JAWABAN_PDF), hitung(F.REPLIK, "Replik", "Penggugat", "0046"), hitung(F.DUPLIK)]) {
      const semua = h.baris.map((r: Apa) => `${r.tanya} ${r.jawab}`).join(" ");
      expect(semua).not.toMatch(/aleta/i);
      expect(semua).not.toMatch(/#\d{3,5}#/);
      expect(semua).not.toMatch(/[^\u0009\u000A\u000D -~ -ÿ]/);
    }
  });
});

describe("JJ2 - lewat isiGugatanService: keluaran ke ekstensi", () => {
  const dok = (judul: string, peran: string, jenis: string, pengunggah: string, teks: string, penuntutKode: string, diunggah: string) => ({ judul, peran, jenis, pengunggah, teks, penuntutKode, diunggah, baca: "teks" });
  const hasil = S.susunIsiGugatan({
    sebutan: SEBUTAN,
    dokumen: [
      dok("Jawaban dari Tergugat", "jawaban", "Jawaban", "Tergugat", F.JAWABAN_PDF, "0047", "2026-07-01"),
      dok("Replik", "replik", "Replik", "Penggugat", F.REPLIK, "0046", "2026-07-08"),
      dok("Duplik", "duplik", "Duplik", "Tergugat", F.DUPLIK, "0047", "2026-07-15"),
      dok("Kesimpulan Tergugat", "kesimpulan", "Kesimpulan", "Tergugat", F.KESIMPULAN_TERGUGAT, "0047", "2026-08-01"),
    ],
  });

  it("tanyaJawab memuat tiga berkas rapi dengan kode 6112/6113/6114 dan tanggal unggah; kesimpulan tidak", () => {
    expect(hasil.tanyaJawab.map((t: Apa) => [t.peran, t.kode, t.rapi, t.diunggah])).toEqual([
      ["jawaban", "6112", true, "2026-07-01"],
      ["replik", "6113", true, "2026-07-08"],
      ["duplik", "6114", true, "2026-07-15"],
    ]);
    for (const t of hasil.tanyaJawab) expect(t.baris.length).toBeGreaterThanOrEqual(2);
  });

  it("jawab[] dan kalimat salin membawa keadaan format (rapi / tidak rapi) untuk panel", () => {
    expect(hasil.jawab.find((j: Apa) => j.peran === "jawaban").tanyaJawab).toMatchObject({ rapi: true, kode: "6112" });
    expect(hasil.kalimat.find((k: Apa) => k.kode === "jawab-tertulis-jawaban-0047").tanyaJawab).toMatchObject({ rapi: true, kode: "6112" });
    const buruk = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen: [dok("Jawaban", "jawaban", "Jawaban", "Tergugat", F.JAWABAN_SISA_TANDA_TANGAN, "0047", "2026-07-01")] });
    expect(buruk.tanyaJawab[0].rapi).toBe(false);
    expect(buruk.tanyaJawab[0].baris).toEqual([]);
    expect(buruk.kalimat.find((k: Apa) => k.kode === "jawab-tertulis-jawaban-0047").tanyaJawab.keterangan).toBe("Format berkas tidak rapi, silakan salin dan periksa.");
    expect(buruk.jawab[0].tanyaJawab.alasan.length).toBeGreaterThan(0);
  });

  it("dua jawaban untuk peran yang sama: tidak ada yang rapi (tidak jelas yang dipakai)", () => {
    const dua = S.susunIsiGugatan({
      sebutan: SEBUTAN,
      dokumen: [dok("Jawaban 1", "jawaban", "Jawaban", "Tergugat", F.JAWABAN_PDF, "0047", "2026-07-01"), dok("Jawaban 2", "jawaban", "Jawaban", "Tergugat", F.JAWABAN_PDF, "0047", "2026-07-02")],
    });
    expect(dua.tanyaJawab.map((t: Apa) => t.rapi)).toEqual([false, false]);
  });

  it("tidak ada kata Aleta dan tidak ada #nnnn# di baris yang akan ditulis", () => {
    const teks = JSON.stringify(hasil.tanyaJawab.map((t: Apa) => t.baris));
    expect(teks).not.toMatch(/aleta/i);
    expect(teks).not.toMatch(/#\d{3,5}#/);
  });
});

// ─── Penulis di ekstensi ─────────────────────────────────────────────────────

const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8").replace(/\r\n/g, "\n");
const a = sumber.indexOf("const TJ_JAWAB_MENJAWAB");
const b = sumber.indexOf("// F4.2: saran draf H-7", a);
const kode = sumber.slice(a, b);

type Opsi = {
  bolehTulis?: boolean;
  saklar?: boolean;
  sidang?: Apa[];
  dipilih?: Apa;
  kunci?: string;
  isian?: Apa[];
  tanyaJawab?: Apa[];
  kalimat?: Apa[];
  barisAbt?: Apa[] | null; // null = bacaan ABT gagal
  tersimpanSebelumnya?: boolean;
  berubah?: boolean;
  hurufAneh?: boolean;
};

const SIDANG = [
  { sidangId: "101", tanggal: "2026-06-24", urutan: 1, agenda: "Sidang pertama / mediasi" },
  { sidangId: "102", tanggal: "2026-07-01", urutan: 2, agenda: "Jawaban Tergugat" },
  { sidangId: "103", tanggal: "2026-07-08", urutan: 3, agenda: "Replik Penggugat" },
  { sidangId: "104", tanggal: "2026-07-15", urutan: 4, agenda: "Duplik Tergugat" },
];

function jalankan(opsi: Opsi = {}) {
  const dipilih = opsi.dipilih ?? SIDANG[1];
  const kunci = opsi.kunci ?? "jawaban lisan 0047";
  const kodeSunting = { "jawaban lisan 0047": "6112", "replik lisan 0046": "6113", "duplik lisan 0047": "6114" }[kunci];
  const isian = opsi.isian ?? [{ kode: "2018", jenis: "tj", tj: { kunci, sebutan: "Jawaban Lisan", kodeSunting } }];
  const d = { isian };
  const St: Apa = { pk: { sidang: opsi.sidang ?? SIDANG, sidangDipilih: dipilih, jenisPerkara: "Cerai Gugat" }, blangko: { a: "x", b: "y", jenis: "bas" }, susunan: d, nilai: {}, tj: {}, tjBuka: null, prat: { kotor: false } };
  const ditulis: Apa[] = [];
  const dibaca: Apa[] = [];
  const penyimpanan: Record<string, unknown> = opsi.tersimpanSebelumnya ? { "bdTjOto:77:6112:2": { saat: 1 } } : {};
  const tanyaJawab =
    opsi.tanyaJawab ?? [{ ...hasil("jawaban", "6112", "2026-07-01") }, { ...hasil("replik", "6113", "2026-07-08") }, { ...hasil("duplik", "6114", "2026-07-15") }];
  const kalimat = opsi.kalimat ?? [{ kode: "jawab-tertulis-jawaban-0047", teks: "- Tergugat mengakui" }];
  if (opsi.berubah) St.tj[kunci] = { berubah: true, dimuat: true, rows: [] };
  const toast: string[] = [];
  let portal = 0;
  const klien = {
    bacaTanyaJawab: async (x: Apa) => {
      dibaca.push(x);
      return opsi.barisAbt === null ? { ok: false } : { ok: true, baris: opsi.barisAbt ?? [] };
    },
    simpanTanyaJawab: async (x: Apa) => {
      ditulis.push(x);
      return { ok: true, tersimpan: true };
    },
  };
  const f = new Function(
    "S",
    "bolehTulis",
    "cfg",
    "sebutan",
    "nomorPerkara",
    "ambilPortal",
    "perkaraId",
    "sidangUrutan",
    "klienAbt",
    "bacaPenyimpanan",
    "tulisPenyimpanan",
    "hurufDiLuarAbt",
    "jamSekarang",
    "toast",
    "muatTj",
    "renderTj",
    "esc",
    `${kode}\nreturn { isiJawabMenjawabOtomatis, sidangTujuanJm, agendaMemuatPeran };`
  )(
    St,
    () => opsi.bolehTulis !== false,
    () => ({ tjJawab: opsi.saklar }),
    () => ({ P: "Penggugat", T: "Tergugat" }),
    () => "901/Pdt.G/2026/PA.Xyz",
    async () => {
      portal += 1;
      return { tanyaJawab, kalimat };
    },
    () => "77",
    () => String(dipilih.urutan),
    () => klien,
    async (k: string) => (k in penyimpanan ? { [k]: penyimpanan[k] } : {}),
    async (isi: Record<string, unknown>) => {
      Object.assign(penyimpanan, isi);
      return true;
    },
    (t: string) => (opsi.hurufAneh && /Ł/.test(t) ? ["Ł"] : []),
    () => "12.00",
    (t: string) => toast.push(t),
    async () => {},
    () => {},
    (t: string) => t
  );
  return { fungsi: f, S: St, d, ditulis, dibaca, penyimpanan, toast, portalDipanggil: () => portal };
}

function hasil(peran: string, kodeTj: string, diunggah: string, ubah: Apa = {}) {
  const k = { jawaban: F.JAWABAN_PDF, replik: F.REPLIK, duplik: F.DUPLIK }[peran as "jawaban"];
  const jenis = peran.charAt(0).toUpperCase() + peran.slice(1);
  const pengunggah = peran === "replik" ? "Penggugat" : "Tergugat";
  const h = hitung(k, jenis, pengunggah, peran === "replik" ? "0046" : "0047", { diunggah });
  return { peran, kode: kodeTj, pihak: peran === "replik" ? "0046" : "0047", rapi: h.rapi, alasan: h.alasan, baris: h.baris, diunggah, ...ubah };
}

describe("JJ2 - penulis tanya-jawab di ekstensi (isiJawabMenjawabOtomatis)", () => {
  it("sidang beragenda Jawaban + baris ABT kosong + berkas rapi -> ditulis ke 6112 sidang itu, penanda tersimpan", async () => {
    const t = jalankan({ barisAbt: [] });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toHaveLength(1);
    expect(t.ditulis[0]).toMatchObject({ kode: "6112", perkaraId: "77", sidang: "2", a: "x", b: "y" });
    expect(t.ditulis[0].baris.length).toBe(6);
    expect(t.ditulis[0].baris.map((r: Apa) => r.no)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(Object.keys(t.penyimpanan)).toEqual(["bdTjOto:77:6112:2"]);
    expect(t.S.tjOto["jawaban lisan 0047"].status).toBe("ditulis");
    expect(t.S.nilai["2018"]).toMatchObject({ status: "terisi" });
    expect(t.toast.join(" ")).toMatch(/ditulis otomatis/);
  });

  it("baris tanya-jawab yang sudah ada TIDAK disentuh (tanya atau jawab terisi)", async () => {
    for (const ada of [[{ no: "1", tanya: "Kepada Tergugat:", jawab: "" }], [{ no: "1", tanya: "", jawab: "Ya, saya siap" }]]) {
      const t = jalankan({ barisAbt: ada });
      await t.fungsi.isiJawabMenjawabOtomatis(t.d);
      expect(t.ditulis).toEqual([]);
      expect(t.dibaca).toHaveLength(1);
    }
  });

  it("dijalankan dua kali: tidak menggandakan (penanda + bacaan ABT)", async () => {
    const t = jalankan({ barisAbt: [] });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toHaveLength(1);
    // Sesudah muat ulang halaman (kunci memori hilang) penanda peramban masih mencegah penulisan ulang.
    const lagi = jalankan({ barisAbt: [], tersimpanSebelumnya: true });
    await lagi.fungsi.isiJawabMenjawabOtomatis(lagi.d);
    expect(lagi.ditulis).toEqual([]);
    // Dan bila barisnya kini terisi, ABT sendiri yang menghalangi.
    const terisi = jalankan({ barisAbt: [{ no: "1", tanya: "a", jawab: "b" }] });
    await terisi.fungsi.isiJawabMenjawabOtomatis(terisi.d);
    await terisi.fungsi.isiJawabMenjawabOtomatis(terisi.d);
    expect(terisi.ditulis).toEqual([]);
  });

  it("format tidak rapi -> tidak ditulis, penyunting memuat keterangan dan teks untuk Salin", async () => {
    const buruk = [{ ...hasil("jawaban", "6112", "2026-07-01"), rapi: false, baris: [], alasan: ["kop tersisa"] }];
    const t = jalankan({ barisAbt: [], tanyaJawab: buruk });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toEqual([]);
    expect(t.dibaca).toEqual([]);
    expect(t.S.tjOto["jawaban lisan 0047"]).toMatchObject({ status: "salin", pesan: "Format berkas tidak rapi, silakan salin dan periksa.", teks: "- Tergugat mengakui" });
  });

  it("bacaan ABT gagal -> tidak menulis (menyimpan menghapus dulu seluruh baris sidang itu)", async () => {
    const t = jalankan({ barisAbt: null });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toEqual([]);
    expect(t.penyimpanan).toEqual({});
  });

  it("isian ketikan petugas yang belum disimpan di penyunting menang", async () => {
    const t = jalankan({ barisAbt: [], berubah: true });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toEqual([]);
  });

  it("saklar dimatikan atau tanpa hak tulis -> tidak ada bacaan maupun tulisan", async () => {
    for (const opsi of [{ saklar: false }, { bolehTulis: false }]) {
      const t = jalankan({ barisAbt: [], ...opsi });
      await t.fungsi.isiJawabMenjawabOtomatis(t.d);
      expect(t.ditulis).toEqual([]);
      expect(t.dibaca).toEqual([]);
    }
    // Saklar tak pernah diubah (undefined) = menyala.
    const bawaan = jalankan({ barisAbt: [], saklar: undefined });
    await bawaan.fungsi.isiJawabMenjawabOtomatis(bawaan.d);
    expect(bawaan.ditulis).toHaveLength(1);
  });

  it("sidang yang dipilih bukan sidang tujuan (agenda lain / sebelum unggah) -> tidak ditulis", async () => {
    const salah = jalankan({ barisAbt: [], dipilih: SIDANG[0] });
    await salah.fungsi.isiJawabMenjawabOtomatis(salah.d);
    expect(salah.ditulis).toEqual([]);
    // Agenda sidang itu tidak menyebut jawaban/replik/duplik: berkas e-Court bahkan tidak dibaca dari portal.
    expect(salah.portalDipanggil()).toBe(0);
    // Replik pada sidang Jawaban tidak ditulis; replik pada sidang Replik ditulis ke 6113.
    const replik = jalankan({ barisAbt: [], kunci: "replik lisan 0046", dipilih: SIDANG[1] });
    await replik.fungsi.isiJawabMenjawabOtomatis(replik.d);
    expect(replik.ditulis).toEqual([]);
    const benar = jalankan({ barisAbt: [], kunci: "replik lisan 0046", dipilih: SIDANG[2] });
    await benar.fungsi.isiJawabMenjawabOtomatis(benar.d);
    expect(benar.ditulis[0]).toMatchObject({ kode: "6113", sidang: "3" });
  });

  it("huruf di luar yang dapat disimpan ABT -> tidak ditulis, diarahkan ke Salin", async () => {
    const aneh = [{ ...hasil("jawaban", "6112", "2026-07-01"), baris: [{ tanya: "Jawaban Tergugat:", jawab: "Tergugat menolak Łukasz;" }] }];
    const t = jalankan({ barisAbt: [], tanyaJawab: aneh, hurufAneh: true });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toEqual([]);
    expect(t.S.tjOto["jawaban lisan 0047"].status).toBe("salin");
  });

  it("dua berkas untuk peran yang sama -> tidak ditulis, diberi tahu pada sidang yang agendanya cocok", async () => {
    const dua = [hasil("jawaban", "6112", "2026-07-01"), hasil("jawaban", "6112", "2026-07-02")];
    const t = jalankan({ barisAbt: [], tanyaJawab: dua });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toEqual([]);
    expect(t.S.tjOto["jawaban lisan 0047"].pesan).toMatch(/lebih dari satu berkas/);
  });

  it("tanpa tanggal unggah hanya bila satu-satunya sidang beragenda itu", () => {
    const t = jalankan();
    const f = t.fungsi.sidangTujuanJm;
    expect(f("jawaban", "", SIDANG)).toMatchObject({ sidangId: "102" });
    expect(f("jawaban", "", [...SIDANG, { sidangId: "105", tanggal: "2026-07-22", urutan: 5, agenda: "Jawaban Tergugat" }])).toBeNull();
    // Dengan tanggal unggah: sidang pertama pada/sesudahnya.
    expect(f("jawaban", "2026-06-30", [...SIDANG, { sidangId: "105", tanggal: "2026-07-22", urutan: 5, agenda: "Jawaban Tergugat" }])).toMatchObject({ sidangId: "102" });
    expect(f("jawaban", "2026-07-02", [...SIDANG, { sidangId: "105", tanggal: "2026-07-22", urutan: 5, agenda: "Jawaban Tergugat" }])).toMatchObject({ sidangId: "105" });
    expect(f("jawaban", "2026-08-01", SIDANG)).toBeNull();
    // Agenda "jawab menjawab" berlaku untuk ketiganya.
    const jm = [{ sidangId: "9", tanggal: "2026-07-01", urutan: 2, agenda: "Jawab Menjawab" }];
    for (const p of ["jawaban", "replik", "duplik"]) expect(f(p, "2026-07-01", jm)).toMatchObject({ sidangId: "9" });
  });

  it("kabel: dipanggil sesudah susunan dimuat dan saat sidang diganti; saklar ada di widget, popup, dan penyimpanan akun", () => {
    expect(sumber).toContain("void isiJawabMenjawabOtomatis(d);");
    expect(sumber).toContain("if (S.susunan) void isiJawabMenjawabOtomatis(S.susunan);");
    expect(sumber).toContain('data-bd2="salinjm"');
    const baca = (n: string) => readFileSync(path.join(AKAR, "ekstensi-sipp", n), "utf8");
    expect(baca("blangko-derry.js")).toContain('tjJawab: "blangkoDerryTjJawab"');
    expect(baca("blangko-derry.js")).toContain("tjJawab: s[K.tjJawab] !== false");
    expect(baca("popup.js")).toContain('derryTjJawab: ["blangkoDerryTjJawab", true]');
    expect(baca("popup.html")).toContain('id="derryTjJawab" checked');
    expect(baca("latar.js")).toContain('"blangkoDerryTjJawab"');
  });

  it("teks yang ditulis ke ABT tidak memuat kata Aleta dan kode #nnnn#", async () => {
    const t = jalankan({ barisAbt: [] });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    const teks = JSON.stringify(t.ditulis);
    expect(teks).not.toMatch(/aleta/i);
    expect(teks).not.toMatch(/#\d{3,5}#/);
    expect(kode).not.toMatch(/simpanTanyaJawab\([^)]*aleta/i);
  });
});
