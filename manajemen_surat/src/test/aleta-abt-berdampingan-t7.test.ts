// @vitest-environment node
/**
 * ============================================================================
 * BERDAMPINGAN DENGAN ABT (5 Nov 2026, Tahap 7) - DATA REKAAN
 * ============================================================================
 *   1. sidik dan ringkasan paragraf SAMA PERSIS dengan ekstensi (kode ekstensi dijalankan apa adanya, tidak diubah);
 *   2. hijau, kuning (beda yang sudah dijelaskan), merah (beda yang belum dijelaskan); spasi karena ABT dan titik-titik BAS tidak dihitung gagal;
 *   3. bawaan mati; pemicu tidak menunggu pembandingan; antrean pendek, tanpa ganda;
 *   4. yang belum dapat dibandingkan dicatat "belum diukur" dengan sebabnya, bukan lulus atau gagal;
 *   5. yang tersimpan hanya angka, nama blangko, dan jenis beda: tidak ada kalimat naskah, tidak ada nama pihak;
 *   6. ringkasan 30 cetak per jenis, hari tanpa merah, mingguan; jawaban pemilik atas beda merah.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import {
  SYARAT_CETAK,
  bandingRingkasan,
  golonganBedaPotongan,
  hasilBerlaku,
  jenisDariFolder,
  jenisDariNama,
  naskahDariFolder,
  ringkasAlinea,
  ringkasBerdampingan,
  sidikParagraf,
  type BarisBerdampingan,
} from "@/lib/aleta-abt-berdampingan";
import { alineaDariRtf, bandingAlinea } from "@/lib/aleta-abt-naskah";
import {
  bacaBarisBerdampingan,
  bacaBedaTerbaru,
  bacaSetelanBerdampingan,
  bandingkanCetakAbt,
  catatBandingManual,
  jawabBeda,
  picuBerdampingan,
  simpanSetelanBerdampingan,
  tungguAntreanBerdampingan,
  type DepsBanding,
} from "@/server/modules/aleta-abt-berdampingan/service";

const M = process.cwd();
const SQL_0133 = readFileSync(path.join(M, "drizzle/0133_aleta_abt_pustaka.sql"), "utf8");
const SQL_0137 = readFileSync(path.join(M, "drizzle/0137_aleta_abt_alur_berdampingan.sql"), "utf8");
const EKSTENSI = readFileSync(path.join(M, "../ekstensi-sipp/blangko-derry-beda-cetak.js"), "utf8");
const EKSPOR_ASLI = EKSTENSI;

// Menjalankan kode ekstensi apa adanya untuk membuktikan kesamaan sidik.
const ekstensi = (() => {
  const konteks: Record<string, unknown> = {};
  vm.createContext(konteks);
  vm.runInContext(EKSTENSI, konteks);
  return konteks.aletaBedaCetak as { sidik: (s: string) => string; ringkas: (teks: string) => Array<{ h: string; t: string }> };
})();

const rtf = (...paragraf: string[]) => `{\\rtf1\\ansi\\deff0 ${paragraf.map((p) => `\\pard ${p}\\par`).join("\r\n")}}`;
const NAMA_PIHAK = "BUDI SANTOSO REKAAN";

describe("kesamaan dengan ekstensi", () => {
  const contoh = ["Bahwa Penggugat  dan Tergugat menikah.", "  Ke-2 “tanda kutip” dan `miring`  ", "Pasal 39 ayat (2) UU Nomor 1 Tahun 1974", "ÉÈ unicode ß ü", "...", "Dengan Putusan Verstek"];
  it("sidikParagraf sama dengan sidik ekstensi", () => {
    for (const c of contoh) expect(sidikParagraf(c), c).toBe(ekstensi.sidik(c));
  });
  it("ringkasAlinea sama dengan ringkas ekstensi atas teks yang sama (pendek, tanpa huruf, dan panjang)", () => {
    const panjang = "Kalimat panjang ".repeat(30);
    const baris = [...contoh, "", "a", "x", panjang];
    const mereka = ekstensi.ringkas(baris.join("\n"));
    const kita = ringkasAlinea(baris);
    expect(kita).toEqual(mereka);
    expect(kita.some((b) => b.t.length === 160)).toBe(true);
  });
});

describe("banding ringkasan", () => {
  const aleta = (...p: string[]) => ringkasAlinea(p);
  const dasar = ["PUTUSAN", "Bahwa Penggugat dan Tergugat menikah.", "Mengadili:", "1. Mengabulkan gugatan."];

  it("semua sama: hijau", () => {
    const h = bandingRingkasan(aleta(...dasar), aleta(...dasar));
    expect(h).toMatchObject({ hasil: "hijau", total: 4, identik: 4, dijelaskan: 0, belumDijelaskan: 0 });
    expect(h.nomor).toEqual([]);
  });
  it("hanya spasi karena ABT menempelkan kata: kuning, dicatat tetapi tidak dihitung gagal", () => {
    const h = bandingRingkasan(aleta("PUTUSAN", "Bahwa sidang dilangsungkansecara terbuka.", "Mengadili:"), aleta("PUTUSAN", "Bahwa sidang dilangsungkan secara terbuka.", "Mengadili:"));
    expect(h.hasil).toBe("kuning");
    expect(h.perKelas["tata-letak"]).toBe(1);
    expect(h.dijelaskan).toBe(1);
    expect(h.belumDijelaskan).toBe(0);
    expect(h.nomor).toEqual([{ kelas: "tata-letak", abt: 2, aleta: 2 }]);
  });
  it("titik-titik isian kosong di BAS tetap dicetak ALETA ABT: kuning, bukan merah", () => {
    const h = bandingRingkasan(aleta("BERITA ACARA SIDANG", "Hakim Anggota 2 bernama ."), aleta("BERITA ACARA SIDANG", "Hakim Anggota 2 bernama ...."));
    expect(h.perKelas["tanda-kosong"]).toBe(1);
    expect(h.hasil).toBe("kuning");
  });
  it("isi berbeda: merah; alinea hanya di satu sisi: merah", () => {
    const isi = bandingRingkasan(aleta(...dasar), aleta("PUTUSAN", "Bahwa Penggugat dan Tergugat bercerai.", "Mengadili:", "1. Mengabulkan gugatan."));
    expect(isi.hasil).toBe("merah");
    expect(isi.perKelas.isi).toBe(1);
    const lebih = bandingRingkasan(aleta(...dasar), aleta(...dasar, "Alinea tambahan."));
    expect(lebih).toMatchObject({ hasil: "merah", belumDijelaskan: 1 });
    expect(lebih.perKelas["hanya-aleta"]).toBe(1);
    const kurang = bandingRingkasan(aleta(...dasar, "Alinea tambahan."), aleta(...dasar));
    expect(kurang.perKelas["hanya-abt"]).toBe(1);
  });
  it("paragraf panjang yang bedanya di luar 160 huruf yang terlihat: digolongkan isi (merah), tidak dianggap sudah dijelaskan", () => {
    const awal = "Kalimat yang sangat panjang ".repeat(8);
    const h = bandingRingkasan(aleta(`${awal}berakhir A.`), aleta(`${awal}berakhir B.`));
    expect(h.perKelas.isi).toBe(1);
    expect(h.hasil).toBe("merah");
  });
  it("paragraf panjang yang beda spasi di bagian terlihat: tata letak", () => {
    expect(golonganBedaPotongan("kata ".repeat(40) + "ujung", "kata ".repeat(39) + "kata  ujung")).toBe("isi");
    expect(golonganBedaPotongan("katakata ".repeat(30), "kata kata ".repeat(30))).toBe("tata-letak");
  });
  it("nomor beda dibatasi 50 dan hanya berisi angka dan kelas", () => {
    const a = Array.from({ length: 80 }, (_, i) => `Alinea nomor ${i} versi ABT`);
    const b = Array.from({ length: 80 }, (_, i) => `Alinea nomor ${i} versi ALETA berbeda`);
    const h = bandingRingkasan(aleta(...a), aleta(...b));
    expect(h.nomor.length).toBe(50);
    expect(h.total).toBe(80);
    for (const n of h.nomor) expect(Object.keys(n).sort()).toEqual(["abt", "aleta", "kelas"]);
  });
});

describe("pengelompokan", () => {
  it("jenis perkara dari nama jenis dan dari folder (folder alur = tidak diketahui)", () => {
    expect(jenisDariNama("Cerai Gugat")).toBe("cerai-gugat");
    expect(jenisDariNama("Cerai Talak")).toBe("cerai-talak");
    expect(jenisDariNama("Itsbat Nikah")).toBe("lain");
    expect(jenisDariNama("")).toBeNull();
    expect(jenisDariFolder("1 Perceraian CG")).toBe("cerai-gugat");
    expect(jenisDariFolder("1a Perceraian CT - BAS")).toBe("cerai-talak");
    expect(jenisDariFolder("ALUR 04 Cerai Kontra Tertulis (Mediasi s.d. Putusan)")).toBe("tidak-diketahui");
    expect(jenisDariFolder("2 Itsbat Nikah")).toBe("tidak-diketahui");
  });
  it("jenis naskah dari folder", () => {
    expect(naskahDariFolder("1 Perceraian CG")).toBe("putusan");
    expect(naskahDariFolder("1 Perceraian CG - BAS")).toBe("bas");
    expect(naskahDariFolder("ALUR 02 Cerai Verstek 2 Sidang")).toBe("bas");
    expect(naskahDariFolder("98 Relaas")).toBe("relaas");
    expect(naskahDariFolder("99 PTSP")).toBe("lain");
  });
});

// ─── layanan + pg-mem ───────────────────────────────────────────────────────────────────────────────────────────
async function siapkan() {
  const mem = newDb();
  mem.public.none(SQL_0133);
  mem.public.none(SQL_0137);
  mem.public.none("CREATE TABLE IF NOT EXISTS aleta_ekstensi_setelan (pengguna_id TEXT NOT NULL, kunci TEXT NOT NULL, nilai TEXT NOT NULL, diubah_pada TEXT NOT NULL, PRIMARY KEY (pengguna_id, kunci))");
  const { Client } = mem.adapters.createPg();
  const c = new Client();
  await c.connect();
  const ubah = (q: string) => {
    let n = 0;
    return q.replace(/\?/g, () => `$${++n}`);
  };
  const db = {
    queryAll: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows,
    queryOne: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows[0] ?? null,
    run: async (q: string, p: unknown[] = []) => {
      await c.query(ubah(q), p);
    },
  };
  const berkas = async (id: string, folder: string, nama: string, arsip = 0) =>
    db.run("INSERT INTO aleta_abt_berkas (id, folder, nama, arsip, dibuat_at, diubah_at) VALUES (?, ?, ?, ?, '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z')", [id, folder, nama, arsip]);
  return { db: db as never, berkas, baca: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows as Array<Record<string, unknown>> };
}

function susunTiruan(rtfIsi: string, hitung: { n: number } = { n: 0 }): NonNullable<DepsBanding["susun"]> {
  return async () => {
    hitung.n += 1;
    return { ok: true, nama: "x.rtf", rtf: Buffer.from(rtfIsi, "latin1"), kertas: { nama: "F4", lebarMm: 215, tinggiMm: 330 }, jumlahTerisi: 3, kosong: [], lolosCetak: true, mesinGalat: "", ringkasanKeyakinan: {}, jumlahKueri: 1, waktu: { botMs: 1, totalMs: 1 } } as never;
  };
}

const CETAK_ABT = (paragraf: string[], tambahan: Record<string, unknown> = {}) => ({
  perkaraId: "123",
  nomorPerkara: "1/Pdt.G/2026/PA.Uji",
  berkas: "[02] [Kabul] CG - F - (3 Saksi T).rtf",
  bagian: ringkasAlinea(paragraf),
  ...tambahan,
});

describe("saklar", () => {
  it("bawaan mati; dinyalakan Super Admin; dimatikan paksa lewat lingkungan", async () => {
    const { db } = await siapkan();
    expect((await bacaSetelanBerdampingan(db, {})).aktif).toBe(false);
    await simpanSetelanBerdampingan(db, { id: "u1", name: "Derry" }, true);
    expect(await bacaSetelanBerdampingan(db, {})).toMatchObject({ aktif: true, diubahOleh: "Derry" });
    expect((await bacaSetelanBerdampingan(db, { ALETA_ABT_BERDAMPINGAN: "0" })).aktif).toBe(false);
  });
});

describe("pemicu dari cetak ABT", () => {
  const paragraf = ["PUTUSAN", "Bahwa sidang terbuka untuk umum.", "Mengadili:"];

  it("mati: tidak menyusun naskah dan tidak mencatat apa pun", async () => {
    const { db, berkas, baca } = await siapkan();
    await berkas("b1", "1 Perceraian CG", "[02] [Kabul] CG - F - (3 Saksi T).rtf");
    const hitung = { n: 0 };
    expect(await picuBerdampingan(db, CETAK_ABT(paragraf), { susun: susunTiruan(rtf(...paragraf), hitung), env: {} })).toBe("mati");
    await tungguAntreanBerdampingan();
    expect(hitung.n).toBe(0);
    expect(await baca("SELECT id FROM aleta_abt_berdampingan")).toHaveLength(0);
  });

  it("menyala: pemicu kembali SEBELUM naskah disusun (tidak memperlambat cetak); hasil dicatat sebagai angka", async () => {
    const { db, berkas, baca } = await siapkan();
    await berkas("b1", "1 Perceraian CG", "[02] [Kabul] CG - F - (3 Saksi T).rtf");
    await simpanSetelanBerdampingan(db, { id: "u1", name: "Derry" }, true);
    const hitung = { n: 0 };
    const hasil = await picuBerdampingan(db, CETAK_ABT(paragraf), { susun: susunTiruan(rtf(...paragraf), hitung), env: {} });
    expect(hasil).toBe("antre");
    expect(hitung.n).toBe(0); // naskah belum disusun ketika janji pemicu selesai
    await tungguAntreanBerdampingan();
    expect(hitung.n).toBe(1);
    const baris = await baca("SELECT * FROM aleta_abt_berdampingan");
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ pemicu: "cetak-abt", jenis_perkara: "cerai-gugat", jenis_naskah: "putusan", hasil: "hijau", total_alinea: 3, identik: 3, perkara_id: "123", folder: "1 Perceraian CG" });
  });

  it("antrean: pekerjaan yang sama tidak berganda dan antrean yang penuh dibuang, bukan ditumpuk", async () => {
    const { db, berkas } = await siapkan();
    await berkas("b1", "1 Perceraian CG", "[02] [Kabul] CG - F - (3 Saksi T).rtf");
    await simpanSetelanBerdampingan(db, { id: "u1", name: "Derry" }, true);
    let lepas!: () => void;
    const tahan = new Promise<void>((r) => (lepas = r));
    const susunLambat: NonNullable<DepsBanding["susun"]> = async (...a) => {
      await tahan;
      return susunTiruan(rtf(...paragraf))(...a);
    };
    const hasil: string[] = [];
    hasil.push(await picuBerdampingan(db, CETAK_ABT(paragraf, { perkaraId: "1" }), { susun: susunLambat, env: {} }));
    hasil.push(await picuBerdampingan(db, CETAK_ABT(paragraf, { perkaraId: "1" }), { susun: susunLambat, env: {} }));
    await new Promise((r) => setTimeout(r, 5)); // pekerjaan pertama diambil dan menunggu
    for (let i = 2; i < 14; i += 1) hasil.push(await picuBerdampingan(db, CETAK_ABT(paragraf, { perkaraId: String(i) }), { susun: susunLambat, env: {} }));
    expect(hasil[0]).toBe("antre");
    expect(hasil[1]).toBe("ganda");
    expect(hasil.filter((x) => x === "antre").length).toBeLessThanOrEqual(10);
    expect(hasil).toContain("penuh");
    lepas();
    await tungguAntreanBerdampingan();
  });

  it("masukan tak sah ditolak tanpa menyentuh apa pun", async () => {
    const { db } = await siapkan();
    expect(await picuBerdampingan(db, { ...CETAK_ABT(paragraf), perkaraId: "abc" }, { env: {} })).toBe("tak-sah");
    expect(await picuBerdampingan(db, { ...CETAK_ABT(paragraf), bagian: [] }, { env: {} })).toBe("tak-sah");
    expect(await picuBerdampingan(db, { ...CETAK_ABT(paragraf), berkas: " " }, { env: {} })).toBe("tak-sah");
  });
});

describe("pembandingan: merah, kuning, belum diukur", () => {
  const paragraf = ["PUTUSAN", "Bahwa sidang terbuka untuk umum.", "Mengadili:"];

  it("naskah ALETA berbeda isi: merah dengan jenis beda dan nomor alinea", async () => {
    const { db, berkas, baca } = await siapkan();
    await berkas("b1", "1a Perceraian CT", "[02] Kabul CT.rtf");
    const c = await bandingkanCetakAbt(db, CETAK_ABT(paragraf, { berkas: "[02] Kabul CT.rtf" }), { susun: susunTiruan(rtf("PUTUSAN", "Bahwa sidang tertutup.", "Mengadili:")) });
    expect(c).toMatchObject({ hasil: "merah", jenisPerkara: "cerai-talak", belumDijelaskan: 1 });
    const baris = await baca("SELECT * FROM aleta_abt_berdampingan");
    expect(JSON.parse(String(baris[0].per_kelas))).toMatchObject({ isi: 1 });
    expect(JSON.parse(String(baris[0].nomor_beda))).toEqual([{ kelas: "isi", abt: 2, aleta: 2 }]);
  });

  it("BAS tanpa nomor sidang: belum diukur (bukan lulus, bukan gagal); dengan nomor sidang: diukur", async () => {
    const { db, berkas } = await siapkan();
    await berkas("b1", "1 Perceraian CG - BAS", "BAS ALUR 02 [1].rtf");
    const m = { berkas: "BAS ALUR 02 [1].rtf" };
    const tanpa = await bandingkanCetakAbt(db, CETAK_ABT(paragraf, m), { susun: susunTiruan(rtf(...paragraf)) });
    expect(tanpa).toMatchObject({ hasil: "belum-diukur", sebabBelum: "sidang-tidak-dikirim", jenisNaskah: "bas", jenisPerkara: "cerai-gugat" });
    const dengan = await bandingkanCetakAbt(db, CETAK_ABT(paragraf, { ...m, sidangKe: 2 }), { susun: susunTiruan(rtf(...paragraf)) });
    expect(dengan).toMatchObject({ hasil: "hijau", sidangKe: 2, jenisNaskah: "bas" });
  });

  it("folder alur: jenis perkara ditanyakan ke sumber lain (nama jenis SIPP)", async () => {
    const { db, berkas } = await siapkan();
    await berkas("b1", "ALUR 02 Cerai Verstek 2 Sidang", "BAS A.rtf");
    const c = await bandingkanCetakAbt(db, CETAK_ABT(paragraf, { berkas: "BAS A.rtf", sidangKe: 1 }), { susun: susunTiruan(rtf(...paragraf)), jenisDariBot: async () => "Cerai Talak" });
    expect(c.jenisPerkara).toBe("cerai-talak");
  });

  it("blangko tidak di pustaka, bernama ganda, jenis lain, dan naskah gagal disusun: belum diukur dengan sebab", async () => {
    const { db, berkas } = await siapkan();
    const susun = susunTiruan(rtf(...paragraf));
    expect((await bandingkanCetakAbt(db, CETAK_ABT(paragraf, { berkas: "tidak ada.rtf" }), { susun })).sebabBelum).toBe("blangko-tidak-di-pustaka");

    await berkas("g1", "1 Perceraian CG", "[01] Kembar.rtf");
    await berkas("g2", "1a Perceraian CT", "[01] Kembar.rtf");
    expect((await bandingkanCetakAbt(db, CETAK_ABT(paragraf, { berkas: "[01] Kembar.rtf" }), { susun })).sebabBelum).toBe("blangko-ganda");

    await berkas("r1", "98 Relaas", "[JS] 2. Relaas.rtf");
    const r = await bandingkanCetakAbt(db, CETAK_ABT(paragraf, { berkas: "[JS] 2. Relaas.rtf" }), { susun });
    expect(r).toMatchObject({ hasil: "belum-diukur", sebabBelum: "jenis-naskah-belum-dibandingkan", jenisNaskah: "relaas" });

    await berkas("p1", "1 Perceraian CG", "[05] Gagal.rtf");
    const gagal = await bandingkanCetakAbt(db, CETAK_ABT(paragraf, { berkas: "[05] Gagal.rtf" }), { susun: async () => ({ ok: false, status: 502, alasan: "bot mati" }) });
    expect(gagal).toMatchObject({ hasil: "belum-diukur", sebabBelum: "naskah-tidak-tersusun" });
  });

  it("galat tak terduga tidak keluar ke pemanggil dan dicatat sebagai belum diukur", async () => {
    const { db, berkas } = await siapkan();
    await berkas("b1", "1 Perceraian CG", "[02] Kabul.rtf");
    const c = await bandingkanCetakAbt(db, CETAK_ABT(paragraf, { berkas: "[02] Kabul.rtf" }), {
      susun: async () => {
        throw new Error("meledak");
      },
    });
    expect(c).toMatchObject({ hasil: "belum-diukur", sebabBelum: "galat-pembanding" });
  });
});

describe("hanya angka yang tersimpan", () => {
  it("tidak ada kalimat naskah dan tidak ada nama pihak di kolom mana pun", async () => {
    const { db, berkas, baca } = await siapkan();
    await berkas("b1", "1 Perceraian CG", "[02] Kabul.rtf");
    const abt = ["PUTUSAN", `Bahwa Penggugat ${NAMA_PIHAK} mengajukan gugatan cerai.`, "Mengadili:"];
    const aleta = ["PUTUSAN", `Bahwa Penggugat ${NAMA_PIHAK} mengajukan gugatan talak.`, "Mengadili:"];
    await bandingkanCetakAbt(db, CETAK_ABT(abt, { berkas: "[02] Kabul.rtf" }), { susun: susunTiruan(rtf(...aleta)) });
    const semua = JSON.stringify(await baca("SELECT * FROM aleta_abt_berdampingan"));
    expect(semua).not.toContain(NAMA_PIHAK);
    expect(semua).not.toContain("gugatan");
    expect(semua).not.toContain("Mengadili");
    expect(semua).not.toContain("terbuka");
  });
  it("catatan manual dari layar cetak membawa angka dan nomor alinea saja", async () => {
    const { db, berkas, baca } = await siapkan();
    await berkas("b1", "1 Perceraian CG", "[02] Kabul.rtf");
    const h = bandingAlinea([`Penggugat ${NAMA_PIHAK}`, "Sama.", "Beda ABT."], [`Penggugat ${NAMA_PIHAK}`, "Sama.", "Beda ALETA."]);
    const c = await catatBandingManual(db, { berkasId: "b1", perkaraId: "123", sidangKe: 0, jenisPerkara: "Cerai Talak", hasil: h, waktuMs: 5 });
    expect(c).toMatchObject({ hasil: "merah", jenisPerkara: "cerai-talak" }); // nama jenis dari layar menang atas folder
    const semua = JSON.stringify(await baca("SELECT * FROM aleta_abt_berdampingan"));
    expect(semua).not.toContain(NAMA_PIHAK);
    expect(semua).not.toContain("Beda ABT");
    expect((await baca("SELECT pemicu FROM aleta_abt_berdampingan"))[0].pemicu).toBe("pembanding");
    await expect(catatBandingManual(db, { berkasId: "tidak-ada", perkaraId: "1", sidangKe: 0, hasil: h, waktuMs: 1 })).rejects.toMatchObject({ status: 404 });
  });
});

describe("jawaban pemilik", () => {
  it("hanya beda merah yang dijawab, dengan pilihan baku; merah yang dijawab menjadi kuning", async () => {
    const { db, berkas, baca } = await siapkan();
    await berkas("b1", "1 Perceraian CG", "[02] Kabul.rtf");
    await bandingkanCetakAbt(db, CETAK_ABT(["a b", "c d"], { berkas: "[02] Kabul.rtf" }), { susun: susunTiruan(rtf("a b", "x y")) });
    await bandingkanCetakAbt(db, CETAK_ABT(["a b", "c d"], { berkas: "[02] Kabul.rtf" }), { susun: susunTiruan(rtf("a b", "c d")) });
    const [merah, hijau] = (await baca("SELECT id, hasil FROM aleta_abt_berdampingan ORDER BY hasil DESC")).map((x) => ({ id: String(x.id), hasil: String(x.hasil) }));
    expect(merah.hasil).toBe("merah");
    await expect(jawabBeda(db, { id: "u1", name: "Derry" }, merah.id, "bebas")).rejects.toMatchObject({ status: 400 });
    await expect(jawabBeda(db, { id: "u1", name: "Derry" }, hijau.id, "dijelaskan")).rejects.toMatchObject({ status: 422 });
    await expect(jawabBeda(db, { id: "u1", name: "Derry" }, "tidak-ada", "dijelaskan")).rejects.toMatchObject({ status: 404 });
    await jawabBeda(db, { id: "u1", name: "Derry" }, merah.id, "sudah-dibetulkan");
    const baris = await bacaBarisBerdampingan(db);
    expect(baris.map(hasilBerlaku).sort()).toEqual(["hijau", "kuning"]);
    const beda = await bacaBedaTerbaru(db);
    expect(beda).toHaveLength(1);
    expect(beda[0]).toMatchObject({ hasil: "merah", jawaban: "sudah-dibetulkan" });
  });
});

describe("ringkasan menuju syarat 30 cetak", () => {
  const SEHARI = 86_400_000;
  const kini = new Date("2026-11-20T08:00:00Z");
  const baris = (i: number, jenis: BarisBerdampingan["jenisPerkara"], hasil: BarisBerdampingan["hasil"], hariLalu: number, jawaban: BarisBerdampingan["jawaban"] = ""): BarisBerdampingan => ({
    id: `r${i}`,
    waktu: new Date(kini.getTime() - hariLalu * SEHARI).toISOString(),
    pemicu: "cetak-abt",
    berkasNama: "x.rtf",
    jenisPerkara: jenis,
    jenisNaskah: "putusan",
    perkaraId: String(i),
    hasil,
    sebabBelum: "",
    totalAlinea: 10,
    identik: 10,
    dijelaskanN: 0,
    belumDijelaskanN: 0,
    jawaban,
  });

  it("syarat terpenuhi: 30 cetak, tanpa merah, dua pekan", () => {
    const data = Array.from({ length: 30 }, (_, i) => baris(i, "cerai-gugat", "hijau", 15 + (i % 3)));
    const r = ringkasBerdampingan(data, kini);
    const gugat = r.perJenis.find((x) => x.jenis === "cerai-gugat")!;
    const talak = r.perJenis.find((x) => x.jenis === "cerai-talak")!;
    expect(gugat).toMatchObject({ cetak: 30, target: SYARAT_CETAK, merah: 0, memenuhiSyarat: true });
    expect(gugat.hariTanpaMerah).toBeGreaterThanOrEqual(14);
    expect(talak).toMatchObject({ cetak: 0, memenuhiSyarat: false, hariTanpaMerah: 0 });
  });
  it("satu merah membatalkan syarat dan mengembalikan hitungan hari; dijawab pemilik = kuning dan syarat dapat terpenuhi lagi", () => {
    const data = Array.from({ length: 30 }, (_, i) => baris(i, "cerai-talak", "hijau", 20));
    const dgMerah = [...data, baris(99, "cerai-talak", "merah", 3)];
    const a = ringkasBerdampingan(dgMerah, kini).perJenis.find((x) => x.jenis === "cerai-talak")!;
    expect(a).toMatchObject({ cetak: 31, merah: 1, hariTanpaMerah: 3, memenuhiSyarat: false });
    const dijawab = [...data, baris(99, "cerai-talak", "merah", 3, "dijelaskan")];
    const b = ringkasBerdampingan(dijawab, kini).perJenis.find((x) => x.jenis === "cerai-talak")!;
    expect(b).toMatchObject({ merah: 0, kuning: 1, memenuhiSyarat: true });
  });
  it("kurang dari 30 cetak, atau belum dua pekan: belum memenuhi; belum diukur tidak dihitung cetak", () => {
    const sedikit = Array.from({ length: 20 }, (_, i) => baris(i, "cerai-gugat", "hijau", 30));
    expect(ringkasBerdampingan(sedikit, kini).perJenis[0].memenuhiSyarat).toBe(false);
    const barusan = Array.from({ length: 30 }, (_, i) => baris(i, "cerai-gugat", "hijau", 5));
    expect(ringkasBerdampingan(barusan, kini).perJenis[0].memenuhiSyarat).toBe(false);
    const belum = [...sedikit, ...Array.from({ length: 20 }, (_, i) => baris(100 + i, "cerai-gugat", "belum-diukur", 30))];
    const r = ringkasBerdampingan(belum, kini).perJenis[0];
    expect(r).toMatchObject({ cetak: 20, belumDiukur: 20 });
  });
  it("jenis lain tidak menambah hitungan gugat atau talak; mingguan menghitung per pekan", () => {
    const data = [baris(1, "lain", "hijau", 1), baris(2, "tidak-diketahui", "hijau", 1), baris(3, "cerai-gugat", "merah", 1), baris(4, "cerai-gugat", "kuning", 8)];
    const r = ringkasBerdampingan(data, kini, 3);
    expect(r.perJenis[0].cetak).toBe(2);
    expect(r.mingguan).toHaveLength(3);
    expect(r.mingguan.reduce((n, p) => n + p.total, 0)).toBe(4);
    expect(r.merahBelumDijawab).toBe(1);
    expect(r.mingguan[0].mulai > r.mingguan[1].mulai).toBe(true);
  });
});

describe("kesamaan dengan pembanding layar cetak", () => {
  it("alinea dari RTF dan ringkasan menghasilkan putusan hijau yang sama untuk teks yang sama", () => {
    const naskah = rtf("PUTUSAN", "Bahwa sidang terbuka.", "Mengadili:");
    const h = bandingRingkasan(ringkasAlinea(alineaDariRtf(naskah)), ringkasAlinea(alineaDariRtf(naskah)));
    expect(h.hasil).toBe("hijau");
  });
});

describe("Berdampingan BAS: nomor sidang dikirim ekstensi saat cetak", () => {
  const paragrafBas = ["BERITA ACARA SIDANG", "Pada hari ini sidang dihadiri Penggugat.", "Sidang ditunda."];
  const BAS = "BAS ALUR 02 [1] BAS 1 P Hadir.rtf";

  it("ekstensi mengirim sidangKe bila ada, dan tidak menambah permintaan apa pun (satu POST yang sama)", async () => {
    const kirim: Array<{ url: string; body: Record<string, unknown> }> = [];
    const konteks: Record<string, unknown> = {
      fetch: async (url: string, init?: { method?: string; body?: string }) => {
        kirim.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
        return { ok: true, json: async () => ({ data: { dicetakPada: "2026-11-05T10:00:00.000Z" } }) };
      },
    };
    vm.createContext(konteks);
    vm.runInContext(EKSPOR_ASLI, konteks);
    const m = konteks.aletaBedaCetak as { simpan: (x: Record<string, unknown>) => Promise<unknown> };
    await m.simpan({ perkaraId: "123", nomorPerkara: "1/Pdt.G/2026/PA.Uji", berkas: BAS, teks: paragrafBas.join("\n"), sidangKe: 2 });
    await m.simpan({ perkaraId: "123", nomorPerkara: "1/Pdt.G/2026/PA.Uji", berkas: BAS, teks: paragrafBas.join("\n"), sidangKe: 0 });
    await m.simpan({ perkaraId: "123", nomorPerkara: "1/Pdt.G/2026/PA.Uji", berkas: BAS, teks: paragrafBas.join("\n") });
    expect(kirim).toHaveLength(3); // satu permintaan per cetak, seperti sebelumnya
    expect(kirim[0].body.sidangKe).toBe(2);
    expect("sidangKe" in kirim[1].body).toBe(false);
    expect("sidangKe" in kirim[2].body).toBe(false);
    expect(Object.keys(kirim[2].body).sort()).toEqual(["bagian", "berkas", "nomorPerkara", "perkaraId"]); // bentuk lama tidak berubah
  });

  it("panel hanya menambah satu ruas pada kiriman yang sudah ada: tidak ada fetch baru di jalur cetak", () => {
    const isian = readFileSync(path.join(M, "../ekstensi-sipp/blangko-derry-isian.js"), "utf8");
    const a = isian.indexOf("function catatCetakTerakhir");
    const fungsi = isian.slice(a, isian.indexOf("function catatLog", a));
    expect(fungsi).toContain("sidangKe: Number(sidangUrutan()) || 0");
    expect(fungsi).not.toMatch(/fetch\(/);
    expect(fungsi.match(/m\.simpan\(/g)).toHaveLength(1);
  });

  it("BAS dengan nomor sidang dibandingkan otomatis: susun menerima sidangKe, hasil dicatat sebagai angka", async () => {
    const { db, berkas, baca } = await siapkan();
    await berkas("b1", "1 Perceraian CG - BAS", BAS);
    await simpanSetelanBerdampingan(db, { id: "u1", name: "Derry" }, true);
    const diterima: number[] = [];
    const susun: NonNullable<DepsBanding["susun"]> = async (d, p) => {
      diterima.push(p.sidangKe);
      return susunTiruan(rtf(...paragrafBas))(d, p);
    };
    expect(await picuBerdampingan(db, CETAK_ABT(paragrafBas, { berkas: BAS, sidangKe: 2 }), { susun, env: {} })).toBe("antre");
    await tungguAntreanBerdampingan();
    expect(diterima).toEqual([2]);
    const baris = await baca("SELECT * FROM aleta_abt_berdampingan");
    expect(baris[0]).toMatchObject({ jenis_naskah: "bas", jenis_perkara: "cerai-gugat", sidang_ke: 2, hasil: "hijau", sebab_belum: "" });
  });

  it("BAS yang berbeda isi dibandingkan merah; spasi karena ABT kuning; titik-titik isian kosong kuning", async () => {
    const { db, berkas } = await siapkan();
    await berkas("b1", "1a Perceraian CT - BAS", BAS);
    const abt = ["BERITA ACARA SIDANG", "Pada hari ini sidangdihadiri Penggugat.", "Hakim Anggota bernama ."];
    const aleta = ["BERITA ACARA SIDANG", "Pada hari ini sidang dihadiri Penggugat.", "Hakim Anggota bernama ...."];
    const kuning = await bandingkanCetakAbt(db, CETAK_ABT(abt, { berkas: BAS, sidangKe: 1 }), { susun: susunTiruan(rtf(...aleta)) });
    expect(kuning).toMatchObject({ hasil: "kuning", jenisPerkara: "cerai-talak", jenisNaskah: "bas", belumDijelaskan: 0, dijelaskan: 2 });
    const merah = await bandingkanCetakAbt(db, CETAK_ABT(abt, { berkas: BAS, sidangKe: 1 }), { susun: susunTiruan(rtf("BERITA ACARA SIDANG", "Pada hari ini sidang dihadiri Tergugat.", "Hakim Anggota bernama ....")) });
    expect(merah.hasil).toBe("merah");
  });

  it("BAS tanpa nomor sidang (ekstensi lama) tetap dicatat belum diukur, tidak dihitung lulus", async () => {
    const { db, berkas } = await siapkan();
    await berkas("b1", "1 Perceraian CG - BAS", BAS);
    const c = await bandingkanCetakAbt(db, CETAK_ABT(paragrafBas, { berkas: BAS }), { susun: susunTiruan(rtf(...paragrafBas)) });
    expect(c).toMatchObject({ hasil: "belum-diukur", sebabBelum: "sidang-tidak-dikirim" });
  });

  it("BAS ikut hitungan 30 cetak per jenis", () => {
    const kini = new Date("2026-11-20T08:00:00Z");
    const data: BarisBerdampingan[] = Array.from({ length: 30 }, (_, i) => ({
      id: `r${i}`, waktu: new Date(kini.getTime() - (20 + (i % 3)) * 86_400_000).toISOString(), pemicu: "cetak-abt", berkasNama: BAS,
      jenisPerkara: "cerai-talak", jenisNaskah: "bas", perkaraId: String(i), hasil: "hijau", sebabBelum: "", totalAlinea: 5, identik: 5, dijelaskanN: 0, belumDijelaskanN: 0, jawaban: "",
    }));
    expect(ringkasBerdampingan(data, kini).perJenis.find((x) => x.jenis === "cerai-talak")).toMatchObject({ cetak: 30, memenuhiSyarat: true });
  });
});
