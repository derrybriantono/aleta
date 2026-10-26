// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { kalimatUsulanBuktiSaksi, petakanBuktiSaksi, POKOK_BUKTI } from "@/lib/bukti-saksi";
import { SETELAN_BERKAS_BAWAAN, bersihkanSetelanBerkas } from "@/server/modules/aleta-ecourt/berkas-otomatis";

/**
 * ============================================================================
 * G2 (25 Okt 2026) - KESIMPULAN, DAFTAR ALAT BUKTI, PEMBERSIH TATA LETAK, PEMETAAN BUKTI-SAKSI
 * ============================================================================
 *
 * Semua teks REKAAN (tidak ada berkas e-Court sungguhan di laptop; skrip ukur atas berkas asli disiapkan terpisah). Yang diuji:
 *   1. pembersih tata letak replik/duplik: nomor butir berdiri sendiri, glif butir, kata terpenggal, kepala nomor perkara, blok TTD;
 *   2. kesimpulan -> tanya-jawab (hanya saat diminta) dan penulisnya di ekstensi (kode ABT dari data blangko, bukan ditebak);
 *   3. daftar alat bukti "rapi" -> usulan "cukup" + baris penyunting bukti (hanya saat saklar menyala; tidak rapi = usulan "ragu" + Salin);
 *   4. pemetaan bukti <-> keterangan saksi (usulan);
 *   5. saklar MATI bawaan = keluaran seperti sebelum G2.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type Apa = any;
const J: Apa = muat(path.join(AKAR, "aleta_bot/services/jawabMenjawabEcourtService.js"));
const TJ: Apa = muat(path.join(AKAR, "aleta_bot/services/tanyaJawabEcourtService.js"));
const B: Apa = muat(path.join(AKAR, "aleta_bot/services/buktiEcourtService.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const F: Apa = muat(path.join(AKAR, "manajemen_surat/src/test/fixtures/tanya-jawab-bukti-ecourt.cjs"));
const SEBUTAN = { lawan: "Penggugat", pelaku: "Tergugat" };

const dok = (judul: string, peran: string, jenis: string, pengunggah: string, teks: string, penuntutKode = "", baca = "teks", diunggah = "") => ({ judul, peran, jenis, pengunggah, teks, penuntutKode, baca, diunggah });

const hitung = (teks: string, jenis: string, pengunggah: string, kode: string, ekstra: Apa = {}) => {
  const k = J.kenaliJenis({ jenis, judul: jenis, pengunggah, penuntutKode: kode, teks });
  return TJ.tanyaJawabDariSurat({ teks, k, sebutan: SEBUTAN, ...ekstra });
};

// ─── Fixture rekaan ──────────────────────────────────────────────────────────

const KALIMAT_1 = "Bahwa Penggugat tetap pada dalil gugatannya karena Tergugat meninggalkan tempat kediaman bersama sejak Januari 2026;";
const KALIMAT_2 = "Penggugat menolak dalil jawaban Tergugat pada butir 3 karena tidak sesuai dengan kenyataan yang sebenarnya terjadi;";
const KALIMAT_3 = "Bahwa Tergugat mengakui telah meninggalkan rumah sebagaimana diterangkan dalam jawabannya sendiri pada butir 5;";

const REPLIK_NOMOR_SENDIRI = [
  "REPLIK PENGGUGAT",
  "PERKARA NOMOR 123/Pdt.G/2026/PA.Rkn",
  "",
  "Kepada Yth. Majelis Hakim Pengadilan Agama Rekaan",
  "",
  "DALAM KONVENSI",
  "1.",
  KALIMAT_1,
  "2.",
  KALIMAT_2,
  "3.",
  KALIMAT_3,
  "",
  "Demikian replik ini kami sampaikan.",
  "Rekaan, 5 Okt 2026",
  "Kuasa Hukum Penggugat",
  "(Budi Santoso, S.H.)",
].join("\n");

const REPLIK_TANPA_PENUTUP = [
  "REPLIK PENGGUGAT",
  "",
  "DALAM KONVENSI",
  `1. ${KALIMAT_1}`,
  `2. ${KALIMAT_2}`,
  `3. ${KALIMAT_3}`,
  "",
  "Kuasa Hukum Penggugat",
  "(Budi Santoso, S.H.)",
].join("\n");

const REPLIK_GLIF = [
  "REPLIK PENGGUGAT",
  "",
  "DALAM KONVENSI",
  ` ${KALIMAT_1}`,
  ` ${KALIMAT_2}`,
  `● ${KALIMAT_3}`,
].join("\n");

const REPLIK_TERPENGGAL = [
  "DALAM KONVENSI",
  "1. Bahwa Tergugat tidak pernah memberikan nafkah kepada Penggugat sejak Februari 2026 dan tidak pernah memberikan pem-",
  "bayaran biaya kebutuhan sehari-hari rumah tangga sebagaimana kewajibannya sebagai suami;",
  `2. ${KALIMAT_2}`,
].join("\n");

const REPLIK_DUA_HALAMAN = [
  "REPLIK PENGGUGAT PERKARA NOMOR 123/Pdt.G/2026/PA.Rkn",
  "",
  "DALAM KONVENSI",
  `1. ${KALIMAT_1}`,
  `2. ${KALIMAT_2}`,
  "\f",
  "REPLIK PENGGUGAT PERKARA NOMOR 123/Pdt.G/2026/PA.Rkn",
  `3. ${KALIMAT_3}`,
  "4. Bahwa Penggugat dan Tergugat telah bercerai berdasarkan Putusan Pengadilan Agama Rekaan",
  "Nomor 55/Pdt.G/2020/PA.Rkn",
  "tanggal 5 Mei 2020 yang telah berkekuatan hukum tetap;",
].join("\n");

const KESIMPULAN_P = [
  "KESIMPULAN PENGGUGAT",
  "",
  "Kepada Yth. Majelis Hakim Pengadilan Agama Rekaan",
  "",
  "DALAM KONVENSI",
  "1. Bahwa berdasarkan pemeriksaan alat bukti surat P.1 sampai P.3 dan keterangan dua orang saksi di persidangan terbukti rumah tangga Penggugat dan Tergugat sudah tidak harmonis sejak Januari 2026;",
  "2. Bahwa para saksi menerangkan Penggugat dan Tergugat telah pisah rumah selama lebih dari enam bulan dan tidak ada harapan untuk rukun kembali;",
  "3. Bahwa Penggugat tetap pada gugatannya dan memohon agar Majelis Hakim mengabulkan gugatan Penggugat seluruhnya;",
  "",
  "Demikian kesimpulan ini kami sampaikan.",
].join("\n");

const KESIMPULAN_T = KESIMPULAN_P.replace(/PENGGUGAT/g, "TERGUGAT").replace(/Penggugat/g, "Tergugat");

const DAFTAR_SURAT_P = [
  "DAFTAR BUKTI SURAT PENGGUGAT",
  "P.1 Fotokopi Kartu Tanda Penduduk Elektronik atas nama Rahmi binti Hasan, NIK 7201000000000009",
  "P.2 Fotokopi Kutipan Akta Nikah Nomor 123/45/V/2018 tanggal 10 Mei 2018, yang dikeluarkan oleh Kantor Urusan Agama",
  "Kecamatan Contoh",
  "P.3 Fotokopi Kartu Keluarga atas nama kepala keluarga Rahmat bin Sulaiman, Nomor 7201010101010001",
].join("\n");

// ─── 1. Pembersih tata letak ─────────────────────────────────────────────────

describe("G2 - pembersih replik/duplik: tata letak yang dulu membuat 'tidak rapi'", () => {
  it("nomor butir yang terbaca berdiri sendiri disatukan dengan isinya: tiga butir, bukan tiga butir yang menempel", () => {
    const b = J.bersihkanSurat(REPLIK_NOMOR_SENDIRI);
    expect(b.dalil).toHaveLength(3);
    expect(b.dalil[0]).toMatch(/^1\. Bahwa Penggugat tetap pada dalil/);
    // butir 2 tidak diawali "Bahwa": dulu menempel ke butir 1 sebagai kalimat sambungan
    expect(b.dalil[1]).toMatch(/^2\. Penggugat menolak dalil jawaban/);
    expect(b.dalil[2]).toMatch(/^3\. Bahwa Tergugat mengakui/);
    // kepala "PERKARA NOMOR ..." dan tempat-tanggal berbunyi "5 Okt 2026" tidak ikut
    expect(b.dalil.join(" ")).not.toMatch(/Pdt\.G\/2026\/PA\.Rkn|5 Okt 2026|Kuasa Hukum/);
  });

  it("replik itu rapi untuk tanya-jawab (dulu butir 2 menempel dan satu butir 'tidak berbentuk dalil')", () => {
    const h = hitung(REPLIK_NOMOR_SENDIRI, "Replik", "Penggugat", "0046");
    expect(h.alasan).toEqual([]);
    expect(h.rapi).toBe(true);
    expect(h.ukuran.butir).toBe(3);
    const jawab = h.baris.map((r: Apa) => r.jawab).filter(Boolean);
    expect(jawab[1]).toMatch(/^Penggugat menolak dalil jawaban/);
    expect(jawab[1]).not.toMatch(/Bahwa Penggugat tetap/);
  });

  it("blok tanda tangan di ujung tanpa kata 'Demikian' dilepas dari isi", () => {
    const b = J.bersihkanSurat(REPLIK_TANPA_PENUTUP);
    expect(b.dalil).toHaveLength(3);
    expect(b.dalil.join(" ")).not.toMatch(/Kuasa Hukum|Budi Santoso/);
    expect(b.dibuang.penutup).toBeGreaterThanOrEqual(1);
    expect(hitung(REPLIK_TANPA_PENUTUP, "Replik", "Penggugat", "0046").rapi).toBe(true);
  });

  it("paragraf dalil yang kebetulan menyebut 'Penggugat,' atau 'Kuasa Hukum' di tengah kalimat TIDAK dianggap blok tanda tangan", () => {
    const teks = ["DALAM KONVENSI", `1. ${KALIMAT_1}`, `2. ${KALIMAT_2}`, "3. Bahwa Kuasa Hukum Penggugat telah menyampaikan seluruh bukti surat pada persidangan yang lalu dan seluruhnya telah dicocokkan dengan aslinya;"].join("\n");
    expect(J.bersihkanSurat(teks).dalil).toHaveLength(3);
  });

  it("glif penanda butir hasil ekstraksi PDF (bulatan/kotak) menjadi butir sendiri", () => {
    const b = J.bersihkanSurat(REPLIK_GLIF);
    expect(b.dalil).toHaveLength(3);
    expect(b.dalil[1]).toMatch(/^Penggugat menolak dalil jawaban|^- Penggugat menolak/);
  });

  it("kata yang dipenggal tanda hubung di ujung baris panjang disambung", () => {
    const b = J.bersihkanSurat(REPLIK_TERPENGGAL);
    expect(b.dalil[0]).toContain("pembayaran biaya kebutuhan");
    expect(b.dalil[0]).not.toContain("pem- ");
    // tanda hubung biasa (kata majemuk) tidak disentuh
    expect(J.rapikanBarisHalaman(["kebutuhan sehari-hari rumah tangga dan sebagainya selama ini", "sehari-hari"])).toEqual(["kebutuhan sehari-hari rumah tangga dan sebagainya selama ini", "sehari-hari"]);
    expect(J.rapikanBarisHalaman(["Bahwa Penggugat dan Tergugat menikah di desa tanpa wali-", "Wali Hakim hadir"])).toEqual(["Bahwa Penggugat dan Tergugat menikah di desa tanpa wali-", "Wali Hakim hadir"]);
  });

  it("kepala bernomor perkara pada surat dua halaman dibuang; baris sambungan dalil yang berbunyi 'Nomor 55/...' dipertahankan", () => {
    const b = J.bersihkanSurat(REPLIK_DUA_HALAMAN);
    expect(b.dibuang.kepalaPerkara).toBeGreaterThanOrEqual(1);
    expect(b.judulBagian.map((j: Apa) => j.teks).join("|")).not.toMatch(/PERKARA NOMOR 123/);
    expect(b.dalil).toHaveLength(4);
    expect(b.dalil[3]).toContain("Putusan Pengadilan Agama Rekaan Nomor 55/Pdt.G/2020/PA.Rkn tanggal 5 Mei 2020");
    const h = hitung(REPLIK_DUA_HALAMAN, "Replik", "Penggugat", "0046");
    expect(h.baris.map((r: Apa) => r.tanya).join("|")).not.toMatch(/Perkara Nomor/i);
  });

  it("tempat-tanggal dengan singkatan bulan dikenali sebagai penutup", () => {
    for (const t of ["Palu, 5 Okt 2026", "Donggala, 12 Agustus 2026.", "Rekaan, 3 Des 2026", "Rekaan, 21 Sept 2026"]) expect(J.RE_TANGGAL_TEMPAT.test(t)).toBe(true);
    expect(J.RE_TANGGAL_TEMPAT.test("Bahwa pada 5 Okt 2026 terjadi pertengkaran")).toBe(false);
  });

  it("surat yang sudah rapi tetap rapi dan keluarannya tidak berubah (fixture JJ2: jawaban, replik, duplik)", () => {
    for (const [teks, jenis, pengunggah, kode] of [
      [F.JAWABAN_PDF, "Jawaban", "Tergugat", "0047"],
      [F.REPLIK, "Replik", "Penggugat", "0046"],
      [F.DUPLIK, "Duplik", "Tergugat", "0047"],
    ] as const) {
      expect(hitung(teks, jenis, pengunggah, kode).rapi).toBe(true);
    }
  });
});

// ─── 2. Kesimpulan ───────────────────────────────────────────────────────────

describe("G2 - kesimpulan: tanya-jawab hanya bila diminta", () => {
  it("tanpa permintaan, kesimpulan tetap 'bukan jawaban, replik, atau duplik' (perilaku lama persis)", () => {
    const h = hitung(KESIMPULAN_P, "Kesimpulan", "Penggugat", "0046");
    expect(h.rapi).toBe(false);
    expect(h.alasan).toContain("bukan jawaban, replik, atau duplik");
    expect(h.baris).toEqual([]);
  });

  it("dengan permintaan: kesimpulan Penggugat dan Tergugat masing-masing punya kunci sendiri, tanpa kode tetap", () => {
    const p = hitung(KESIMPULAN_P, "Kesimpulan", "Penggugat", "0046", { denganKesimpulan: true });
    expect(p).toMatchObject({ rapi: true, alasan: [], peran: "kesimpulan", kode: "", rujukan: "", kunci: "kesimpulan lisan 0046", pihak: "0046" });
    expect(p.baris.map((r: Apa) => r.tanya)).toEqual(["Dalam Konvensi:", "Kesimpulan Penggugat (tertulis), butir 1:", "Kesimpulan Penggugat (tertulis), butir 2:", "Kesimpulan Penggugat (tertulis), butir 3:"]);
    const t = hitung(KESIMPULAN_T, "Kesimpulan", "Tergugat", "0047", { denganKesimpulan: true });
    expect(t).toMatchObject({ rapi: true, kunci: "kesimpulan lisan 0047", pihak: "0047" });
    expect(t.baris[1].tanya).toBe("Kesimpulan Tergugat (tertulis), butir 1:");
  });

  it("kesimpulan yang tidak rapi (pengunggah tak dikenali, Turut Tergugat, OCR, terpotong) tidak ditulis", () => {
    const tanpaPihak = KESIMPULAN_P.replace(/PENGGUGAT|Penggugat|Tergugat/g, "Pihak");
    expect(hitung(tanpaPihak, "Kesimpulan", "", "", { denganKesimpulan: true }).alasan).toContain("pengunggah tidak dikenali");
    expect(hitung(KESIMPULAN_P, "Kesimpulan", "Turut Tergugat", "0047", { denganKesimpulan: true }).rapi).toBe(false);
    expect(hitung(KESIMPULAN_P, "Kesimpulan", "Penggugat", "0046", { denganKesimpulan: true, baca: "ocr" }).alasan).toContain("dibaca OCR");
    const tanpaStruktur = ["KESIMPULAN PENGGUGAT", "DALAM KONVENSI", "1. Kami menyimpulkan perkara ini sudah cukup jelas bagi Majelis", "2. Terima kasih"].join("\n");
    expect(hitung(tanpaStruktur, "Kesimpulan", "Penggugat", "0046", { denganKesimpulan: true }).rapi).toBe(false);
  });

  it("susunIsiGugatan: saklar MATI -> kesimpulan TIDAK masuk tanyaJawab; MENYALA -> masuk dengan izinOtomatis dan kunci per pihak", () => {
    const dokumen = [dok("Kesimpulan Penggugat", "kesimpulan", "Kesimpulan", "Penggugat", KESIMPULAN_P, "0046", "teks", "2026-09-01"), dok("Kesimpulan Tergugat", "kesimpulan", "Kesimpulan", "Tergugat", KESIMPULAN_T, "0047", "teks", "2026-09-01")];
    const mati = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen });
    expect(mati.tanyaJawab).toEqual([]);
    expect(mati.otomatis).toEqual({ bukti: false, kesimpulan: false });
    const mati2 = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen, otomatis: { bukti: false, kesimpulan: false } });
    expect(mati2.tanyaJawab).toEqual([]);
    const hidup = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen, otomatis: { bukti: false, kesimpulan: true } });
    expect(hidup.tanyaJawab.map((t: Apa) => [t.peran, t.pihak, t.kunci, t.kode, t.rapi, t.izinOtomatis])).toEqual([
      ["kesimpulan", "0046", "kesimpulan lisan 0046", "", true, true],
      ["kesimpulan", "0047", "kesimpulan lisan 0047", "", true, true],
    ]);
    // dua kesimpulan dari dua pihak BUKAN "dua berkas peran sama"
    expect(hidup.tanyaJawab.every((t: Apa) => !t.alasan.some((a: string) => /ada 2 berkas/.test(a)))).toBe(true);
    // ringkasan 8436/8437 tidak berubah oleh saklar
    expect(hidup.usulan.map((u: Apa) => u.kode).sort()).toEqual(mati.usulan.map((u: Apa) => u.kode).sort());
  });

  it("jawaban/replik/duplik (6112-6114) tidak terpengaruh saklar kesimpulan", () => {
    const dokumen = [dok("Jawaban", "jawaban", "Jawaban", "Tergugat", F.JAWABAN_PDF, "0047", "teks", "2026-07-01"), dok("Replik", "replik", "Replik", "Penggugat", F.REPLIK, "0046", "teks", "2026-07-08")];
    const a = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen });
    const b = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen, otomatis: { bukti: true, kesimpulan: true } });
    expect(b.tanyaJawab.map((t: Apa) => [t.peran, t.kode, t.rapi])).toEqual(a.tanyaJawab.map((t: Apa) => [t.peran, t.kode, t.rapi]));
    expect(b.tanyaJawab.every((t: Apa) => t.izinOtomatis === true)).toBe(true);
  });
});

// ─── Penulis kesimpulan di ekstensi ──────────────────────────────────────────

const sumberEkstensi = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8").replace(/\r\n/g, "\n");
const potong = (awal: string, akhir: string) => {
  const a = sumberEkstensi.indexOf(awal);
  const z = sumberEkstensi.indexOf(akhir, a);
  if (a < 0 || z < 0) throw new Error(`penanda tidak ditemukan: ${awal} / ${akhir}`);
  return sumberEkstensi.slice(a, z);
};
const kodeJm = potong("const kunciJawabMenjawab", "// F4.2: saran draf H-7");

const SIDANG = [
  { sidangId: "101", tanggal: "2026-06-24", urutan: 1, agenda: "Sidang pertama / mediasi" },
  { sidangId: "102", tanggal: "2026-08-26", urutan: 2, agenda: "Pembuktian" },
  { sidangId: "103", tanggal: "2026-09-02", urutan: 3, agenda: "Kesimpulan" },
];

function jalankanKesimpulan(opsi: { dipilih?: Apa; izin?: boolean; ada?: boolean; barisAbt?: Apa[]; kunci?: string; kode?: string } = {}) {
  const dipilih = opsi.dipilih ?? SIDANG[2];
  const kunci = opsi.kunci ?? "kesimpulan lisan 0046";
  const isian = opsi.ada === false ? [] : [{ kode: "2099", jenis: "tj", tj: { kunci, sebutan: "Kesimpulan Lisan", kodeSunting: opsi.kode ?? "6115" } }];
  const d = { isian };
  const St: Apa = { pk: { sidang: SIDANG, sidangDipilih: dipilih, jenisPerkara: "Cerai Gugat" }, blangko: { a: "x", b: "y", jenis: "putusan" }, susunan: d, nilai: {}, tj: {}, tjBuka: null, prat: { kotor: false } };
  const ditulis: Apa[] = [];
  const penyimpanan: Record<string, unknown> = {};
  const hasil = S.susunIsiGugatan({
    sebutan: SEBUTAN,
    dokumen: [dok("Kesimpulan Penggugat", "kesimpulan", "Kesimpulan", "Penggugat", KESIMPULAN_P, "0046", "teks", "2026-09-01")],
    otomatis: { bukti: false, kesimpulan: opsi.izin !== false },
  });
  const klien = {
    bacaTanyaJawab: async () => ({ ok: true, baris: opsi.barisAbt ?? [] }),
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
    `${kodeJm}\nreturn { isiJawabMenjawabOtomatis, agendaMemuatPeran, infoTjJm };`
  )(
    St,
    () => true,
    () => ({ tjJawab: undefined }),
    () => ({ P: "Penggugat", T: "Tergugat" }),
    () => "901/Pdt.G/2026/PA.Xyz",
    async () => ({ tanyaJawab: hasil.tanyaJawab, kalimat: hasil.kalimat }),
    () => "77",
    () => String(dipilih.urutan),
    () => klien,
    async (k: string) => (k in penyimpanan ? { [k]: penyimpanan[k] } : {}),
    async (isi: Record<string, unknown>) => {
      Object.assign(penyimpanan, isi);
      return true;
    },
    () => [],
    () => "12.00",
    () => {},
    async () => {},
    () => {},
    (t: string) => t
  );
  return { fungsi: f, S: St, d, ditulis, penyimpanan };
}

describe("G2 - penulis kesimpulan di ekstensi", () => {
  it("variabel tanya-jawab kesimpulan ada di blangko + sidang beragenda Kesimpulan + baris kosong + saklar menyala -> ditulis ke kode DARI DATA BLANGKO", async () => {
    const t = jalankanKesimpulan();
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toHaveLength(1);
    expect(t.ditulis[0]).toMatchObject({ kode: "6115", perkaraId: "77", sidang: "3" });
    expect(t.ditulis[0].baris.length).toBe(4);
    expect(Object.keys(t.penyimpanan)).toEqual(["bdTjOto:77:6115:3"]);
    expect(t.S.tjOto["kesimpulan lisan 0046"].status).toBe("ditulis");
    // kode lain di blangko lain -> ikut kode itu (tidak ada angka tetap di ekstensi)
    const lain = jalankanKesimpulan({ kode: "7001" });
    await lain.fungsi.isiJawabMenjawabOtomatis(lain.d);
    expect(lain.ditulis[0].kode).toBe("7001");
  });

  it("saklar server MATI: bot tidak membawa kesimpulan -> tidak ada yang ditulis", async () => {
    const t = jalankanKesimpulan({ izin: false });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toEqual([]);
    expect(t.S.tjOto).toEqual({});
  });

  it("blangko tanpa variabel tanya-jawab kesimpulan: tidak menulis apa pun", async () => {
    const t = jalankanKesimpulan({ ada: false });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toEqual([]);
  });

  it("sidang yang dipilih bukan sidang kesimpulan ('Pembuktian', 'Jawab menjawab'): tidak menulis", async () => {
    const t = jalankanKesimpulan({ dipilih: SIDANG[1] });
    await t.fungsi.isiJawabMenjawabOtomatis(t.d);
    expect(t.ditulis).toEqual([]);
    const fungsi = t.fungsi;
    expect(fungsi.agendaMemuatPeran("kesimpulan", "Jawab menjawab")).toBe(false);
    expect(fungsi.agendaMemuatPeran("kesimpulan", "Kesimpulan para pihak")).toBe(true);
    // aturan lama tetap: jawab menjawab = jawaban/replik/duplik
    expect(fungsi.agendaMemuatPeran("jawaban", "Jawab menjawab")).toBe(true);
  });

  it("baris ABT yang sudah ada tidak disentuh; pihak lain (0047) tidak tertukar", async () => {
    const ada = jalankanKesimpulan({ barisAbt: [{ no: "1", tanya: "Kepada Penggugat:", jawab: "" }] });
    await ada.fungsi.isiJawabMenjawabOtomatis(ada.d);
    expect(ada.ditulis).toEqual([]);
    // variabel milik Tergugat (kunci ...0047) tidak diisi dari kesimpulan Penggugat
    const lain = jalankanKesimpulan({ kunci: "kesimpulan lisan 0047" });
    await lain.fungsi.isiJawabMenjawabOtomatis(lain.d);
    expect(lain.ditulis).toEqual([]);
  });

  it("infoTjJm: enam variabel tetap hanya cocok dengan kodenya; kunci kesimpulan butuh kode penyunting", () => {
    const t = jalankanKesimpulan();
    expect(t.fungsi.infoTjJm({ jenis: "tj", tj: { kunci: "jawaban lisan 0047", kodeSunting: "6112" } })).toMatchObject({ peran: "jawaban", kode: "6112" });
    expect(t.fungsi.infoTjJm({ jenis: "tj", tj: { kunci: "jawaban lisan 0047", kodeSunting: "9999" } })).toBeNull();
    expect(t.fungsi.infoTjJm({ jenis: "tj", tj: { kunci: "kesimpulan lisan 0047", kodeSunting: "" } })).toBeNull();
    expect(t.fungsi.infoTjJm({ jenis: "tj", tj: { kunci: "saksi 1 p", kodeSunting: "5001" } })).toBeNull();
  });
});

// ─── 3. Daftar alat bukti rapi ───────────────────────────────────────────────

describe("G2 - daftar alat bukti: rapi -> otomatis, tidak rapi -> usulan + Salin", () => {
  const susun = (teks: string, ekstra: Apa = {}, otomatis = true) =>
    B.susunBukti({ daftar: [{ judul: "Daftar Bukti Penggugat", teks, baca: "teks", pengunggah: "Penggugat", penuntutKode: "0046", ...ekstra }], berkasBukti: [], posita: "", sebutan: SEBUTAN, otomatis });

  it("daftar surat rapi: P.1-P.3 berurutan, satu berkas -> rapi, baris untuk penyunting bukti, usulan 'cukup' saat saklar menyala", () => {
    const h = susun(DAFTAR_SURAT_P);
    expect(h.otomatis).toMatchObject({ aktif: true, P: { rapi: true, alasan: [] } });
    expect(h.otomatis.P.baris.map((r: Apa) => r.kode)).toEqual(["P.1", "P.2", "P.3"]);
    expect(h.otomatis.P.baris[1].nm).toContain("Kutipan Akta Nikah Nomor 123/45/V/2018");
    expect(h.otomatis.P.baris[1].nm).toContain("Kecamatan Contoh");
    const u = h.usulan.filter((x: Apa) => B.KODE.suratP.includes(x.kode));
    expect(u.length).toBe(B.KODE.suratP.length);
    for (const x of u) expect(x).toMatchObject({ keyakinan: "cukup", jagaIsianLama: true, kodePola: "bukti-daftar-ecourt" });
    expect(u[0].catatan).toContain("Daftar rapi: ditulis otomatis ke isian yang masih kosong.");
    expect(h.otomatis.T).toMatchObject({ rapi: false, baris: [] });
  });

  it("saklar MATI: daftar rapi tetap hanya usulan 'ragu' (perilaku lama), baris tidak diberikan sebagai izin", () => {
    const h = susun(DAFTAR_SURAT_P, {}, false);
    expect(h.otomatis.aktif).toBe(false);
    const u = h.usulan.filter((x: Apa) => B.KODE.suratP.includes(x.kode));
    for (const x of u) expect(x.keyakinan).toBe("ragu");
    expect(u[0].catatan).toContain("isi otomatis belum dinyalakan");
  });

  it("tiap ukuran punya contoh yang gagal sendirian -> tidak rapi, tetap usulan 'ragu' + tombol Salin", () => {
    const celah = DAFTAR_SURAT_P.replace("P.2 ", "P.4 ");
    const kasus: Array<[string, Apa, RegExp]> = [
      ["nomor tidak berurutan", susun(celah), /tidak berurutan dari 1/],
      ["nomor dari urutan baris", susun(F.DAFTAR_BUKTI_URUTAN), /diambil dari urutan butir/],
      ["dibaca OCR", susun(DAFTAR_SURAT_P, { baca: "ocr" }), /dibaca OCR/],
      ["karakter rusak", susun(DAFTAR_SURAT_P.replace("Rahmi", "Rah�mi")), /karakter rusak/],
      ["sisa tanda tangan", susun(`${DAFTAR_SURAT_P}\nP.4 Fotokopi surat pernyataan, Kuasa Hukum Penggugat (Budi Santoso, S.H.)`), /tanda tangan|kop/],
      ["uraian terlalu pendek", susun(DAFTAR_SURAT_P.replace("Fotokopi Kartu Keluarga atas nama kepala keluarga Rahmat bin Sulaiman, Nomor 7201010101010001", "Surat KK")), /terlalu pendek/],
    ];
    for (const [nama, h, re] of kasus) {
      expect(h.otomatis.P.rapi, nama).toBe(false);
      expect(h.otomatis.P.alasan.join("; "), nama).toMatch(re);
      expect(h.otomatis.P.baris, nama).toEqual([]);
    }
    // gagal rapi -> usulan tidak naik ke "cukup" walau saklar menyala, dan label Salin memuat keterangan
    const gagal = susun(celah);
    const u = gagal.usulan.filter((x: Apa) => B.KODE.suratP.includes(x.kode));
    for (const x of u) expect(x.keyakinan).toBe("ragu");
    expect(u[0].catatan).toContain("silakan salin dan periksa");
    expect(gagal.kalimat[0].label).toContain("format tidak rapi, silakan salin dan periksa");
  });

  it("dua berkas daftar untuk satu pihak, atau kode yang tertulis berbeda di dua berkas -> tidak rapi", () => {
    const h = B.susunBukti({
      daftar: [
        { judul: "Daftar Bukti 1", teks: "DAFTAR BUKTI SURAT PENGGUGAT\nP.1 Fotokopi Kartu Tanda Penduduk atas nama Rahmi binti Hasan NIK 7201000000000009", baca: "teks", pengunggah: "Penggugat", penuntutKode: "0046" },
        { judul: "Daftar Bukti 2", teks: "DAFTAR BUKTI SURAT PENGGUGAT\nP.2 Fotokopi Kutipan Akta Nikah Nomor 123/45/V/2018 tanggal 10 Mei 2018", baca: "teks", pengunggah: "Penggugat", penuntutKode: "0046" },
      ],
      berkasBukti: [],
      posita: "",
      sebutan: SEBUTAN,
      otomatis: true,
    });
    expect(h.otomatis.P.rapi).toBe(false);
    expect(h.otomatis.P.alasan.join(" ")).toMatch(/lebih dari satu berkas/);
    const beda = B.susunBukti({
      daftar: [
        { judul: "A", teks: "DAFTAR BUKTI SURAT PENGGUGAT\nP.1 Fotokopi Kartu Tanda Penduduk atas nama Rahmi binti Hasan", baca: "teks", pengunggah: "Penggugat", penuntutKode: "0046" },
        { judul: "B", teks: "DAFTAR BUKTI SURAT PENGGUGAT\nP.1 Fotokopi Kartu Keluarga atas nama kepala keluarga Rahmat", baca: "teks", pengunggah: "Penggugat", penuntutKode: "0046" },
      ],
      berkasBukti: [],
      posita: "",
      sebutan: SEBUTAN,
      otomatis: true,
    });
    expect(beda.otomatis.P.rapi).toBe(false);
    expect(beda.otomatis.P.alasan.join(" ")).toMatch(/tertulis berbeda/);
  });

  it("daftar yang memuat bukti elektronik: usulan variabel lain boleh 'cukup', tetapi penyunting bukti surat TIDAK diberi baris (nomor akan bergeser)", () => {
    const h = susun(F.DAFTAR_BUKTI_P);
    expect(h.otomatis.P.rapi).toBe(false);
    expect(h.otomatis.P.alasan.join(" ")).toMatch(/bukti elektronik/);
    expect(h.otomatis.P.baris).toEqual([]);
    const u9951 = h.usulan.find((x: Apa) => x.kode === "9951");
    expect(u9951.keyakinan).toBe("cukup");
    expect(u9951.nilai).toContain("diberi tanda P.4");
  });

  it("susunIsiGugatan meneruskan saklar: buktiOtomatis dan otomatis ikut keluaran; saklar mati = tak satu usulan naik jadi 'cukup'", () => {
    const dokumen = [dok("Daftar Bukti Penggugat", "bukti", "", "Penggugat", DAFTAR_SURAT_P, "0046")];
    const hidup = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen, otomatis: { bukti: true, kesimpulan: false } });
    expect(hidup.otomatis).toEqual({ bukti: true, kesimpulan: false });
    expect(hidup.buktiOtomatis.P.rapi).toBe(true);
    expect(hidup.usulan.find((u: Apa) => u.kode === "9470").keyakinan).toBe("cukup");
    const mati = S.susunIsiGugatan({ sebutan: SEBUTAN, dokumen });
    expect(mati.usulan.find((u: Apa) => u.kode === "9470").keyakinan).toBe("ragu");
    expect(mati.buktiOtomatis.aktif).toBe(false);
  });

  it("tanpa kata Aleta dan tanpa kode #nnnn# pada baris dan usulan yang akan ditulis", () => {
    const h = susun(DAFTAR_SURAT_P);
    const teks = JSON.stringify([h.otomatis, h.usulan.map((u: Apa) => u.nilai)]);
    expect(teks).not.toMatch(/aleta/i);
    expect(teks).not.toMatch(/#\d{3,5}#/);
  });
});

// ─── Penulis daftar bukti di ekstensi ────────────────────────────────────────

const kodeBukti = potong("const buangNomorAwal", "async function siapkanBukti");

function jalankanBukti(opsi: { aktif?: boolean; rapi?: boolean; baris?: Apa[]; bolehTulis?: boolean; sudah?: boolean; huruf?: boolean; kalimat?: Apa[]; alasan?: string[] } = {}) {
  const St: Apa = { pk: { sidang: SIDANG }, bukti: { P: null, T: null }, buktiOto: {} };
  const penyimpanan: Record<string, unknown> = opsi.sudah ? { "bdBuktiOto:77:P": { saat: 1 } } : {};
  const baris = opsi.baris ?? [
    { kode: "P.1", nm: "Fotokopi Kartu Tanda Penduduk Elektronik atas nama Rahmi binti Hasan, NIK 7201000000000009" },
    { kode: "P.2", nm: "Fotokopi Kutipan Akta Nikah Nomor 123/45/V/2018 tanggal 10 Mei 2018" },
  ];
  let panggilan = 0;
  const f = new Function(
    "S",
    "bolehTulis",
    "perkaraId",
    "bacaPenyimpanan",
    "tulisPenyimpanan",
    "sebutan",
    "nomorPerkara",
    "ambilPortal",
    "hurufDiLuarAbt",
    "jamSekarang",
    "tglIndo",
    "API_ISI_GUGATAN_JM",
    "esc",
    `${kodeBukti}\nreturn { barisBuktiEcourt, kalimatBukti, susunKalimatBukti, buktiBaru };`
  )(
    St,
    () => opsi.bolehTulis !== false,
    () => "77",
    async (k: string) => (k in penyimpanan ? { [k]: penyimpanan[k] } : {}),
    async (isi: Record<string, unknown>) => {
      Object.assign(penyimpanan, isi);
      return true;
    },
    () => ({ P: "Penggugat", T: "Tergugat" }),
    () => "901/Pdt.G/2026/PA.Xyz",
    async () => {
      panggilan += 1;
      return {
        buktiOtomatis: { aktif: opsi.aktif !== false, P: { rapi: opsi.rapi !== false, alasan: opsi.alasan ?? [], baris }, T: { rapi: false, alasan: [], baris: [] } },
        kalimat: opsi.kalimat ?? [{ kode: "bukti-surat-0046", teks: "1. Fotokopi KTP, lalu diberi tanda P.1;" }],
      };
    },
    (t: string) => (opsi.huruf && /Ł/.test(t) ? ["Ł"] : []),
    () => "12.00",
    (iso: string) => iso,
    "/aleta/api/aleta-ecourt/isi-gugatan",
    (t: string) => t
  );
  return { fungsi: f, S: St, penyimpanan, panggilan: () => panggilan };
}

describe("G2 - penulis daftar bukti di ekstensi (barisBuktiEcourt)", () => {
  it("saklar menyala + rapi + isian ABT kosong -> baris penyunting dari e-Court, penanda tersimpan, keterangan 'ditulis otomatis'", async () => {
    const t = jalankanBukti();
    const rows = await t.fungsi.barisBuktiEcourt("P");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ nm: expect.stringContaining("Kartu Tanda Penduduk Elektronik"), an: "", no: "", tgl: "", manual: null });
    expect(Object.keys(t.penyimpanan)).toEqual(["bdBuktiOto:77:P"]);
    expect(t.S.buktiOto.P.status).toBe("ditulis");
    expect(t.S.buktiOto.P.pesan).toMatch(/ditulis otomatis dari berkas e-Court \(2 butir\)/);
    // kalimat ABT yang akan tersimpan memakai kode urutan P.1, P.2
    expect(t.fungsi.susunKalimatBukti(rows, "P")).toMatch(/lalu diberi tanda P\.1 [^\n]*\n[^\n]*lalu diberi tanda P\.2 /);
  });

  it("sekali per (perkara, pihak): jalan kedua / sesudah muat ulang tidak menulis lagi dan tidak memanggil portal", async () => {
    const t = jalankanBukti({ sudah: true });
    expect(await t.fungsi.barisBuktiEcourt("P")).toBeNull();
    expect(t.panggilan()).toBe(0);
  });

  it("saklar server MATI, tidak boleh menulis, atau daftar tidak rapi -> tidak ada baris", async () => {
    expect(await jalankanBukti({ aktif: false }).fungsi.barisBuktiEcourt("P")).toBeNull();
    expect(await jalankanBukti({ bolehTulis: false }).fungsi.barisBuktiEcourt("P")).toBeNull();
    const buruk = jalankanBukti({ rapi: false, baris: [], alasan: ["nomor bukti tidak berurutan dari 1"] });
    expect(await buruk.fungsi.barisBuktiEcourt("P")).toBeNull();
    expect(buruk.S.buktiOto.P).toMatchObject({ status: "salin", teks: expect.stringContaining("P.1") });
    expect(buruk.S.buktiOto.P.pesan).toBe("Format daftar bukti di e-Court tidak rapi, silakan salin dan periksa.");
    expect(Object.keys(buruk.penyimpanan)).toEqual([]);
  });

  it("huruf yang tidak dapat disimpan ABT -> tidak ditulis, diarahkan ke Salin", async () => {
    const t = jalankanBukti({ huruf: true, baris: [{ kode: "P.1", nm: "Fotokopi surat Łukasz" }] });
    expect(await t.fungsi.barisBuktiEcourt("P")).toBeNull();
    expect(t.S.buktiOto.P.status).toBe("salin");
    expect(Object.keys(t.penyimpanan)).toEqual([]);
  });

  it("pihak T dengan daftar tidak rapi dari bot tidak mengisi apa pun (keadaan per pihak)", async () => {
    const t = jalankanBukti();
    expect(await t.fungsi.barisBuktiEcourt("T")).toBeNull();
  });
});

// ─── 4. Pemetaan bukti <-> saksi ─────────────────────────────────────────────

describe("G2 - pemetaan bukti <-> keterangan saksi (usulan)", () => {
  const bukti = [
    { kode: "P.1", pihak: "P", jenis: "Kartu Tanda Penduduk Elektronik (KTP-el)", uraian: "Fotokopi Kartu Tanda Penduduk Elektronik atas nama Rahmi binti Hasan" },
    { kode: "P.2", pihak: "P", jenis: "Kutipan Akta Nikah", uraian: "Fotokopi Kutipan Akta Nikah Nomor 123/45/V/2018" },
    { kode: "P.4", pihak: "P", jenis: "Bukti Elektronik", uraian: "Tangkapan layar percakapan WhatsApp antara Penggugat dan Tergugat tanggal 3 Maret 2026", elektronik: true },
    { kode: "P.5", pihak: "P", jenis: "Bukti Pembayaran", uraian: "Kuitansi pembayaran biaya sekolah anak" },
  ];
  const saksi = [
    {
      label: "Saksi 1 Penggugat",
      jawaban: ["Penggugat dan Tergugat menikah pada tahun 2018 di rumah orang tua Penggugat.", "Sejak Januari 2026 mereka sering bertengkar dan saling mengirim pesan yang kasar.", "Saya melihat bukti P.4 itu dan benar itu percakapan mereka."],
    },
    { label: "Saksi 2 Penggugat", jawaban: ["Setahu saya mereka sudah pisah rumah sejak Maret 2026.", "Tergugat jarang memberi uang belanja."] },
  ];

  it("saksi yang menyebut kode bukti didahulukan; sisanya dugaan sepokok; semuanya 'ragu'", () => {
    const u = petakanBuktiSaksi(bukti, saksi);
    const per = Object.fromEntries(u.map((x) => [x.kodeBukti, x]));
    expect(u.every((x) => x.keyakinan === "ragu")).toBe(true);
    expect(per["P.4"]?.tautan[0]).toMatchObject({ saksi: "Saksi 1 Penggugat", dasar: "disebut-langsung" });
    expect(per["P.4"]?.tautan[0]?.kutipan).toContain("bukti P.4");
    expect(per["P.4"]?.catatan).toMatch(/menyebut kode bukti/);
    expect(per["P.4"]?.tautan.map((t) => t.saksi)).toEqual(["Saksi 1 Penggugat"]);
    // akta nikah <-> keterangan tentang pernikahan (bukan disebut langsung)
    expect(per["P.2"]?.tautan[0]).toMatchObject({ saksi: "Saksi 1 Penggugat", dasar: "pernikahan" });
    expect(per["P.2"]?.catatan).toMatch(/Dugaan dari pokok pembicaraan/);
    // kuitansi <-> uang belanja/nafkah, dari saksi 2
    expect(per["P.5"]?.tautan[0]).toMatchObject({ saksi: "Saksi 2 Penggugat", dasar: "nafkah" });
    // KTP: tidak ada saksi yang membicarakan alamat/identitas -> tidak diusulkan
    expect(per["P.1"]).toBeUndefined();
  });

  it("kode yang mirip tidak salah sebut: 'P.1' tidak cocok dengan 'P.12', dan 'P.4' tidak cocok dengan 'P.45'", () => {
    const u = petakanBuktiSaksi([{ kode: "P.1", uraian: "Fotokopi Kartu Keluarga", jenis: "Kartu Keluarga" }], [{ label: "Saksi 1", jawaban: ["Itu bukti P.12 yang diperlihatkan"] }]);
    expect(u).toEqual([]);
    const u2 = petakanBuktiSaksi([{ kode: "P.4", uraian: "Foto", jenis: "Bukti Elektronik" }], [{ label: "Saksi 1", jawaban: ["Lihat P-4 ini", "dan P.45"] }]);
    expect(u2[0]?.tautan[0]?.dasar).toBe("disebut-langsung");
  });

  it("paling banyak tiga saksi per bukti; kutipan dipotong di batas kalimat; kalimat usulan tidak mengarang isi keterangan", () => {
    const banyak = Array.from({ length: 6 }, (_, i) => ({ label: `Saksi ${i + 1}`, jawaban: [`Mereka menikah ${"sekali dengan sangat meriah ".repeat(20)}pada tahun 2018. Lalu pindah.`] }));
    const u = petakanBuktiSaksi([bukti[1]!], banyak);
    expect(u[0]?.tautan).toHaveLength(3);
    expect(u[0]?.tautan[0]?.kutipan.length).toBeLessThanOrEqual(230);
    const k = kalimatUsulanBuktiSaksi({ ...u[0]!, tautan: [{ saksi: "Saksi 1 Penggugat", kutipan: "x", dasar: "pernikahan" }, { saksi: "Saksi 2 Penggugat", kutipan: "y", dasar: "pernikahan" }] });
    expect(k).toBe("Bukti P.2 (Fotokopi Kutipan Akta Nikah Nomor 123/45/V/2018) berkaitan dengan keterangan Saksi 1 Penggugat dan Saksi 2 Penggugat.");
  });

  it("tanpa saksi atau tanpa bukti -> tidak ada usulan; daftar pokok berisi regex sah", () => {
    expect(petakanBuktiSaksi([], saksi)).toEqual([]);
    expect(petakanBuktiSaksi(bukti, [])).toEqual([]);
    expect(POKOK_BUKTI.length).toBeGreaterThanOrEqual(8);
  });
});

// ─── 5. Saklar dan rute ──────────────────────────────────────────────────────

describe("G2 - saklar Super Admin: semua MATI bawaan", () => {
  it("bawaan mati; nilai sampah jatuh ke mati", () => {
    expect(SETELAN_BERKAS_BAWAAN).toMatchObject({ bukti: false, kesimpulan: false, buktiSaksi: false });
    expect(bersihkanSetelanBerkas({ bukti: "ya", kesimpulan: 1, buktiSaksi: null })).toMatchObject({ bukti: false, kesimpulan: false, buktiSaksi: false });
    expect(bersihkanSetelanBerkas({ bukti: true, kesimpulan: false, buktiSaksi: true })).toMatchObject({ bukti: true, kesimpulan: false, buktiSaksi: true });
  });

  it("rute berkas-otomatis hanya membaca (saklar diubah di Fitur Satker); rute bukti-saksi mati -> tidak membaca berkas apa pun", () => {
    const rute = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/berkas-otomatis/route.ts"), "utf8");
    expect(rute).not.toContain("export async function POST");
    const fitur = readFileSync(path.join(process.cwd(), "src/server/modules/satker/fitur.ts"), "utf8");
    expect(fitur).toContain("buangSinggahanIsiGugatan()");
    const peta = readFileSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/bukti-saksi/route.ts"), "utf8");
    const iMati = peta.indexOf("if (!setelan.buktiSaksi)");
    const iBaca = peta.indexOf("bacaGugatanSinggah(");
    expect(iMati).toBeGreaterThan(0);
    expect(iBaca).toBeGreaterThan(iMati);
    expect(existsSync(path.join(process.cwd(), "src/app/api/aleta-ecourt/isi-gugatan/route.ts"))).toBe(true);
  });
});
