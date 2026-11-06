// @vitest-environment jsdom
/**
 * Pertimbangan dari alat bukti untuk itsbat nikah (IN) dan dispensasi kawin (DK), 6 Nov 2026. Data rekaan: tanpa NIK, tanpa nama pihak nyata.
 * Bunyi kartu harus berasal dari bahan blangko (docs/arahan/awan-f46-bahan-itsbat-dk.json); jenis tanpa bunyi masuk belumAdaBunyi.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BuktiAletaAbt } from "@/components/portal/bukti-aleta-abt";
import type { BarisBukti } from "@/lib/bukti-tertulis";
import { kalimatBaris } from "@/lib/bukti-tertulis";
import {
  bacaKeadaan,
  gabungKodeRentang,
  jenisPerkaraBukti,
  KARTU_PERTIMBANGAN,
  susunParagrafBukti,
  type BuktiMasuk,
  type JenisPerkaraBukti,
  type KonteksPerkara,
  type MasukanPertimbangan,
} from "@/lib/sinkron-pertimbangan-bukti";

const bar = (nm: string, o: Partial<BarisBukti> = {}): BarisBukti => ({ nm, an: "", no: "", tgl: "", oleh: "", meterai: 0, cocok: 0, manual: null, ...o });
const masuk = (daftar: BarisBukti[], sisi: "P" | "T" = "P"): BuktiMasuk[] => daftar.map((baris, i) => ({ sisi, nomor: i + 1, baris }));
const KTP = () => bar("Kartu Tanda Penduduk", { an: "Fulan bin Fulin" });
const KK = () => bar("Kartu Keluarga", { an: "Fulan" });
const NIKAH = () => bar("Kutipan Akta Nikah", { an: "Fulan", tgl: "2010-06-01" });

const dasar = (jenisPerkara: JenisPerkaraBukti, bukti: BuktiMasuk[], o: Partial<MasukanPertimbangan> = {}): MasukanPertimbangan => ({
  jenisPerkara,
  status: "Dikabulkan",
  verstek: false,
  lawanHadir: false,
  lawanMembantah: false,
  agendaPembuktianKe: 1,
  bukti,
  ...o,
});
const teks = (m: MasukanPertimbangan) => susunParagrafBukti(m).paragraf.map((p) => p.bunyi).join("\n");
const tanpaPenandaMentah = (t: string) => expect(t).not.toMatch(/#\d+#|\{\w+\}|\[\[|\{\{|\.{3,}/);

/** Satu set bukti dispensasi kawin menurut urutan blangko: P.1-P.2 KTP orang tua, P.3 KK, P.4 nikah, P.5 KIA, P.6 akta lahir, P.7 ijazah, P.8 KTP calon, P.10 penolakan KUA, P.11 hamil. */
const buktiDk = (): BuktiMasuk[] => [
  { sisi: "P", nomor: 1, baris: bar("Kartu Tanda Penduduk", { an: "Ayah Uji" }) },
  { sisi: "P", nomor: 2, baris: bar("Kartu Tanda Penduduk", { an: "Ibu Uji" }) },
  { sisi: "P", nomor: 3, baris: KK() },
  { sisi: "P", nomor: 4, baris: NIKAH() },
  { sisi: "P", nomor: 5, baris: bar("Kartu Identitas Anak", { an: "Fulanah Uji" }) },
  { sisi: "P", nomor: 6, baris: bar("Kutipan Akta Kelahiran", { an: "Fulanah Uji", tgl: "2008-05-14" }) },
  { sisi: "P", nomor: 7, baris: bar("Ijazah SMP", { an: "Fulanah Uji", tgl: "2023-06-10" }) },
  { sisi: "P", nomor: 8, baris: bar("Kartu Tanda Penduduk", { an: "Calon Uji" }) },
  { sisi: "P", nomor: 10, baris: bar("Surat Penolakan Perkawinan dari KUA", { oleh: "KUA Kecamatan Contoh" }) },
  { sisi: "P", nomor: 11, baris: bar("Surat Keterangan Hamil", { an: "Fulanah Uji", oleh: "UPT Puskesmas Contoh" }) },
];

describe("jenis perkara dan keadaan permohonan", () => {
  it("membaca jenis perkara dari teks SIPP; kontensius dan jenis lain tidak punya bunyi", () => {
    expect(jenisPerkaraBukti("Cerai Gugat")).toBe("CG");
    expect(jenisPerkaraBukti("Cerai Talak")).toBe("CT");
    expect(jenisPerkaraBukti("Dispensasi Kawin")).toBe("DK");
    expect(jenisPerkaraBukti("Itsbat Nikah")).toBe("IN");
    expect(jenisPerkaraBukti("Pengesahan Perkawinan/Istbat Nikah")).toBe("IN");
    expect(jenisPerkaraBukti("Itsbat Nikah Kontensius")).toBeNull();
    expect(jenisPerkaraBukti("Wasiat")).toBeNull();
    expect(jenisPerkaraBukti("Hibah")).toBeNull();
    expect(jenisPerkaraBukti("")).toBeNull();
  });
  it("permohonan tidak menyebut lawan atau verstek", () => {
    expect(bacaKeadaan("Dikabulkan", true, true)).toEqual({ kunci: "kabul", teks: "Dikabulkan" });
    expect(bacaKeadaan("Ditolak", true, true)).toEqual({ kunci: "tolak", teks: "Ditolak" });
    expect(bacaKeadaan("Tidak Dapat Diterima", false, true).kunci).toBe("tdt");
    expect(bacaKeadaan("Dikabulkan", true, false).kunci).toBe("kabul-verstek");
  });
  it("rentang kode seperti blangko dispensasi", () => {
    const k = (n: number[]) => n.map((nomor) => ({ sisi: "P" as const, nomor, baris: bar("x") }));
    expect(gabungKodeRentang(k([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toBe("P.1 sampai P.9");
    expect(gabungKodeRentang(k([10, 11]))).toBe("P.10 dan P.11");
    expect(gabungKodeRentang(k([1, 2, 4]))).toBe("P.1, P.2 dan P.4");
    expect(gabungKodeRentang(k([1, 2, 3, 5]))).toBe("P.1 sampai P.3 dan P.5");
  });
});

describe("itsbat nikah, dikabulkan", () => {
  const dua = () => masuk([KTP(), KTP()]);
  it("menulis bunyi blangko untuk dua KTP Pemohon dengan sebutan para Pemohon", () => {
    const h = susunParagrafBukti(dasar("IN", dua()));
    expect(h.keadaan).toBe("Dikabulkan");
    expect(h.paragraf.every((p) => p.cara === "otomatis" && p.kode === "P.1 dan P.2")).toBe(true);
    const t = h.paragraf.map((p) => p.bunyi).join("\n");
    expect(t).toContain("Bahwa bukti P.1 dan P.2 yang diajukan para Pemohon telah diberi meterai cukup dan telah dinazegelen");
    expect(t).toContain("Bahwa bukti P.1 dan P.2 adalah fotokopi yang telah dicocokkan dengan aslinya yang ternyata sesuai");
    expect(t).toContain("Bahwa bukti P.1 dan P.2 merupakan akta autentik yang dibuat oleh pejabat yang berwenang");
    expect(t).toContain("meneguhkan kedudukan hukum (legal standing) para Pemohon sebagai subjek hukum");
    expect(t).toContain("untuk mengajukan permohonan pengesahan nikah ini");
    expect(t).not.toMatch(/Penggugat|Tergugat|Termohon|tidak dibantah/);
    expect(t).toContain("Pasal 285 RBg/Pasal 165 HIR jo. Pasal 1870");
    tanpaPenandaMentah(t);
  });
  it("satu Pemohon: kata para hilang, bunyi lain sama", () => {
    const t = teks(dasar("IN", dua(), { konteks: { jumlahPemohon: 1 } }));
    expect(t).toContain("yang diajukan Pemohon telah diberi meterai");
    expect(t).toContain("kedudukan hukum (legal standing) Pemohon sebagai");
    expect(t).not.toContain("para Pemohon");
  });
  it("verstek diabaikan karena permohonan tidak punya lawan", () => {
    expect(teks(dasar("IN", dua(), { verstek: true }))).toBe(teks(dasar("IN", dua())));
  });
  it("bukti selain KTP menjadi usulan, jenis tanpa bunyi dicatat", () => {
    const b = masuk([KTP(), KTP(), KK(), bar("Surat Keterangan KUA tentang nikah tidak tercatat")]);
    const h = susunParagrafBukti(dasar("IN", b));
    const usulan = h.paragraf.filter((p) => p.cara === "usulan");
    expect(usulan.length).toBeGreaterThan(0);
    expect(usulan.map((p) => p.kode).sort()).toEqual(["P.3", "P.3 dan P.4", "P.3 dan P.4"]);
    expect(h.paragraf.filter((p) => p.cara === "otomatis").every((p) => p.kode === "P.1 dan P.2")).toBe(true);
    expect(h.belumAdaBunyi.map((x) => x.kode)).toEqual(["P.3", "P.4"]);
    expect(h.belumAdaBunyi[0].alasan).toBe("Blangko tidak memuat bunyi untuk jenis bukti ini.");
  });
  it("bukti disunting atau dihapus mengubah paragraf; tanpa asli dan isian ganjil tidak dikarang", () => {
    expect(teks(dasar("IN", masuk([KTP()])))).toContain("Bahwa bukti P.1 yang diajukan para Pemohon");
    const b = masuk([KTP(), KTP()]);
    b[1].baris.cocok = 1;
    const t = teks(dasar("IN", b));
    expect(t).toContain("Bahwa bukti P.2 adalah fotokopi yang tidak dapat dicocokkan dengan aslinya;");
    expect(t).toContain("Bahwa bukti P.1 adalah fotokopi yang telah dicocokkan dengan aslinya");
    const c = masuk([KTP(), KTP()]);
    c[0].baris.meterai = 1;
    const h = susunParagrafBukti(dasar("IN", c));
    expect(h.belumAdaBunyi.map((x) => x.kode)).toContain("P.1");
    expect(h.paragraf.map((p) => p.bunyi).join(" ")).not.toContain("tidak dinazegelen");
  });
});

describe("itsbat nikah, ditolak dan tidak dapat diterima", () => {
  const dua = () => masuk([KTP(), KTP()]);
  it("ditolak: bunyi KTP dan wilayah butuh alamat; tanpa alamat dicatat, tanpa kalimat kedudukan hukum", () => {
    const h = susunParagrafBukti(dasar("IN", dua(), { status: "Ditolak" }));
    expect(h.paragraf.map((p) => p.bunyi).join(" ")).not.toContain("kedudukan hukum");
    expect(h.belumAdaBunyi.map((x) => x.alasan).join(" ")).toContain("Lengkapi dulu: alamat Pemohon.");
    expect(h.catatan.join(" ")).toContain("tanpa menyimpulkan");
    const k: KonteksPerkara = { isian: { alamat: "Desa Contoh, Kecamatan Uji" } };
    const t = teks(dasar("IN", dua(), { status: "Ditolak", konteks: k }));
    expect(t).toContain("Bahwa berdasarkan bukti P.1 dan P.2 berupa fotokopi Kartu Tanda Penduduk para Pemohon, terbukti bahwa para Pemohon saat ini bertempat tinggal di wilayah Desa Contoh, Kecamatan Uji;");
    expect(t).toContain("telah diberi meterai cukup");
  });
  it("tidak dapat diterima memakai bunyi blangko NO", () => {
    const k: KonteksPerkara = { isian: { alamat: "Desa Contoh" } };
    const h = susunParagrafBukti(dasar("IN", dua(), { status: "Tidak Dapat Diterima", konteks: k }));
    expect(h.keadaan).toBe("Permohonan tidak dapat diterima");
    expect(h.paragraf.length).toBeGreaterThanOrEqual(4);
    expect(h.paragraf.map((p) => p.asal).join(" ")).toMatch(/\[NO\]/);
    expect(h.paragraf.some((p) => p.cara === "otomatis" && p.bunyi.includes("saat ini bertempat tinggal di wilayah Desa Contoh"))).toBe(true);
  });
  it("gugur, digugurkan, perdamaian: kosong", () => {
    for (const status of ["Gugur", "Digugurkan", "Perdamaian"]) {
      const h = susunParagrafBukti(dasar("IN", dua(), { status }));
      expect(h.paragraf).toEqual([]);
      expect(h.belumAdaBunyi).toEqual([]);
    }
  });
  it("dicabut menurut agenda: sebelum dan pada pembuktian pertama kosong, pada kedua bukti agenda lama menjadi usulan", () => {
    const b: BuktiMasuk[] = [
      { sisi: "P", nomor: 1, baris: KTP(), agendaKe: 1 },
      { sisi: "P", nomor: 2, baris: KTP(), agendaKe: 1 },
      { sisi: "P", nomor: 3, baris: KTP(), agendaKe: 2 },
    ];
    expect(susunParagrafBukti(dasar("IN", b, { status: "Dicabut", agendaPembuktianKe: 0 })).paragraf).toEqual([]);
    expect(susunParagrafBukti(dasar("IN", b, { status: "Dicabut", agendaPembuktianKe: 1 })).paragraf).toEqual([]);
    const h = susunParagrafBukti(dasar("IN", b, { status: "Dicabut", agendaPembuktianKe: 2 }));
    expect(h.paragraf.length).toBeGreaterThan(0);
    expect(h.paragraf.every((p) => p.cara === "usulan" && p.kode === "P.1 dan P.2")).toBe(true);
  });
});

describe("dispensasi kawin, dikabulkan", () => {
  it("tiap jenis bukti yang punya bunyi di blangko ditulis otomatis dari isian barisnya", () => {
    const k: KonteksPerkara = { isian: { calon: "Calon Uji", alamat: "Desa Contoh", usiaAnak: "17 tahun", tglLahirAnak: "2008-05-14" } };
    const h = susunParagrafBukti(dasar("DK", buktiDk(), { konteks: k }));
    const t = h.paragraf.map((p) => p.bunyi).join("\n");
    const otomatis = h.paragraf.filter((p) => p.cara === "otomatis").map((p) => p.kode);
    expect(otomatis).toEqual(expect.arrayContaining(["P.1 dan P.2", "P.5", "P.6", "P.7", "P.10", "P.11"]));
    expect(t).toContain("Menimbang, bahwa bukti bertanda P.1 sampai P.8 berupa fotokopi dan bukti bertanda P.10 dan P.11 merupakan surat asli");
    expect(t).toContain("diajukan oleh para Pemohon tersebut memenuhi syarat formil");
    expect(t).toContain("alat bukti P.1 dan P.2 merupakan Kartu Tanda Penduduk atas nama Pemohon I dan Pemohon II yang memberi bukti bahwa para Pemohon bertempat tinggal di Desa Contoh yang merupakan wilayah hukum Pengadilan ini");
    expect(t).toContain("identitas kependudukan anak para Pemohon bernama Fulanah Uji yang membuktikan bahwa Fulanah Uji saat ini berusia 17 tahun dan beragama Islam;");
    expect(t).toContain("bukti P.6 dihubungkan dengan bukti P.3 dan P.4 telah menjelaskan bahwa Fulanah Uji adalah anak kandung dari pasangan suami istri yang lahir pada tanggal 14 Mei 2008, sehingga berdasarkan Pasal 6 ayat (1)");
    expect(t).toContain("bukti P.7 membuktikan bahwa anak para Pemohon bernama Fulanah Uji telah menyelesaikan pendidikan sampai tingkat SMP pada tanggal 10 Juni 2023;");
    expect(t).toContain("dari bukti P.10 terbukti permohonan para Pemohon untuk menikahkan anaknya bernama Fulanah Uji dengan Calon Uji telah ditolak oleh KUA Kecamatan Contoh karena anak para Pemohon belum berumur 19 tahun");
    expect(t).toContain("kecuali persyaratan usia minimal bagi calon pengantin perempuan;");
    expect(t).toContain("bukti P.11 merupakan akta otentik berupa Surat Keterangan atas nama Fulanah Uji yang dikeluarkan oleh UPT Puskesmas Contoh, yang melakukan pemeriksaan kesehatan dan menerangkan bahwa Anak Para Pemohon yang bernama Fulanah Uji dalam kondisi hamil;");
    expect(t).not.toMatch(/Penggugat|Tergugat|tidak dibantah/);
    tanpaPenandaMentah(t);
  });
  it("isian kosong menghapus anak kalimat, bukan menebak; kalimat yang wajib punya isian dicatat", () => {
    const b = buktiDk().filter((x) => x.nomor !== 6);
    const h = susunParagrafBukti(dasar("DK", b));
    const t = h.paragraf.map((p) => p.bunyi).join("\n");
    expect(t).toContain("Kartu Tanda Penduduk atas nama Pemohon I dan Pemohon II;");
    expect(t).toContain("identitas kependudukan anak para Pemohon bernama Fulanah Uji;");
    expect(t).not.toContain("saat ini berusia");
    expect(h.belumAdaBunyi.find((x) => x.kode === "P.10")?.alasan).toBe("Lengkapi dulu: nama calon pasangan anak.");
    const tanpaNama = buktiDk().map((x) => (x.nomor >= 5 && x.nomor <= 7 ? { ...x, baris: { ...x.baris, an: "" } } : x));
    const h2 = susunParagrafBukti(dasar("DK", tanpaNama, { konteks: { isian: { calon: "Calon Uji" } } }));
    expect(h2.paragraf.some((p) => p.kode === "P.10")).toBe(false);
    expect(h2.belumAdaBunyi.find((x) => x.kode === "P.10")?.alasan).toContain("nama anak");
  });
  it("nama anak boleh dari isian bila akta kelahiran belum diisi", () => {
    const b = buktiDk().filter((x) => x.nomor === 10);
    const t = teks(dasar("DK", b, { konteks: { isian: { anak: "Fulanah Isian", calon: "Calon Uji" } } }));
    expect(t).toContain("anaknya bernama Fulanah Isian dengan Calon Uji telah ditolak oleh KUA Kecamatan Contoh");
  });
  it("KK dan kutipan nikah masuk rentang fotokopi blangko; jenis lain hanya usulan dan dicatat tanpa bunyi", () => {
    const b = [...buktiDk(), { sisi: "P" as const, nomor: 12, baris: bar("Akta Cerai", { an: "Fulan" }) }];
    const h = susunParagrafBukti(dasar("DK", b, { konteks: { isian: { calon: "Calon Uji" } } }));
    expect(h.paragraf.find((p) => p.cara === "otomatis" && p.bunyi.startsWith("Menimbang, bahwa bukti bertanda"))?.bunyi).toContain("bukti bertanda P.1 sampai P.8 berupa fotokopi");
    expect(h.belumAdaBunyi).toEqual([{ kode: "P.12", kunci: "cerai", nama: "Akta Cerai", alasan: "Blangko tidak memuat bunyi untuk jenis bukti ini." }]);
    const usulan = h.paragraf.filter((p) => p.cara === "usulan");
    expect(usulan.map((p) => p.kode)).toEqual(["P.12"]);
    expect(usulan[0].bunyi).toContain("bukti bertanda P.12 berupa fotokopi");
    expect(usulan[0].bunyi).not.toContain("merupakan surat asli");
  });
  it("anak laki-laki memakai bunyi calon istri hamil", () => {
    const h = susunParagrafBukti(dasar("DK", buktiDk(), { konteks: { anak: "L", isian: { calon: "Calon Uji" } } }));
    const hamil = h.paragraf.find((p) => p.kode === "P.11");
    expect(hamil?.bunyi).toContain("Surat Keterangan atas nama Fulanah Uji");
    expect(hamil?.asal).toContain("Cowok");
  });
  it("satu Pemohon: blangko dispensasi hanya ditulis untuk dua Pemohon", () => {
    const h = susunParagrafBukti(dasar("DK", buktiDk(), { konteks: { jumlahPemohon: 1 } }));
    expect(h.paragraf).toEqual([]);
    expect(h.belumAdaBunyi).toHaveLength(buktiDk().length);
    expect(h.belumAdaBunyi[0].alasan).toContain("dua Pemohon");
  });
  it("bukti tanpa asli, bukti disunting, bukti dihapus", () => {
    const b = buktiDk();
    b[1].baris.cocok = 1;
    const t = teks(dasar("DK", b));
    expect(t).toContain("Bahwa bukti P.2 adalah fotokopi yang tidak dapat dicocokkan dengan aslinya;");
    expect(t).toContain("bukti bertanda P.1 dan P.3 sampai P.8");
    const c = buktiDk();
    c[4].baris.an = "Nama Disunting";
    expect(teks(dasar("DK", c))).toContain("bernama Nama Disunting");
    expect(teks(dasar("DK", buktiDk().filter((x) => x.nomor !== 11)))).not.toContain("kondisi hamil");
  });
});

describe("dispensasi kawin, ditolak, tidak dapat diterima, gugur, dicabut", () => {
  it("ditolak: bunyi blangko Tolak, pasal acara ikut hukum acara, tanpa kalimat hamil", () => {
    const k: KonteksPerkara = { majelis: "Majelis Hakim", hukumAcara: "RBg", isian: { calon: "Calon Uji", alamat: "Desa Contoh" } };
    const h = susunParagrafBukti(dasar("DK", buktiDk(), { status: "Ditolak", konteks: k }));
    const t = h.paragraf.map((p) => p.bunyi).join("\n");
    expect(h.keadaan).toBe("Ditolak");
    expect(t).toContain("Pasal 3 Ayat (1) huruf b");
    expect(t).toContain("Pasal 285 RBg mempunyai nilai kekuatan pembuktian sempurna");
    expect(t).toContain("dari segi kewenangan relatif Majelis Hakim berpendapat Pengadilan ini berwewenang");
    expect(t).toContain("Pasal 6 Ayat (1) Peraturan Mahkamah Agung");
    expect(t).toContain("kecuali persyaratan usia minimal bagi calon pengantin perempuan;");
    expect(t).not.toContain("kondisi hamil");
    expect(h.paragraf.some((p) => p.kode === "P.11")).toBe(false);
    expect(h.paragraf[0].asal).toMatch(/\[Tolak\]/);
    expect(h.catatan.join(" ")).toContain("tanpa menyimpulkan");
    tanpaPenandaMentah(t);
  });
  it("ditolak, anak laki-laki: bunyi ijazah dan pasangan laki-laki dari blangko Cowok", () => {
    const k: KonteksPerkara = { anak: "L", isian: { calon: "Calon Uji" } };
    const t = teks(dasar("DK", buktiDk(), { status: "Ditolak", konteks: k }));
    expect(t).toContain("bukti P.7 membuktikan tingkat pendidikan anak para Pemohon bernama Fulanah Uji;");
    expect(t).toContain("kecuali persyaratan usia minimal bagi calon pengantin laki-laki;");
    expect(t).not.toContain("telah menyelesaikan pendidikan");
  });
  it("tidak dapat diterima: tidak ada bunyi di blangko, semua bukti dicatat", () => {
    const h = susunParagrafBukti(dasar("DK", buktiDk(), { status: "Tidak Dapat Diterima" }));
    expect(h.paragraf).toEqual([]);
    expect(h.belumAdaBunyi).toHaveLength(buktiDk().length);
    expect(h.belumAdaBunyi[0].alasan).toBe("Blangko Tidak Dapat Diterima tidak memuat bunyi per alat bukti.");
  });
  it("gugur kosong; dicabut menurut agenda", () => {
    expect(susunParagrafBukti(dasar("DK", buktiDk(), { status: "Gugur" })).paragraf).toEqual([]);
    const b = buktiDk().map((x) => ({ ...x, agendaKe: x.nomor === 11 ? 2 : 1 }));
    expect(susunParagrafBukti(dasar("DK", b, { status: "Dicabut", agendaPembuktianKe: 1 })).paragraf).toEqual([]);
    const h = susunParagrafBukti(dasar("DK", b, { status: "Dicabut", agendaPembuktianKe: 2, konteks: { isian: { calon: "Calon Uji" } } }));
    expect(h.paragraf.length).toBeGreaterThan(0);
    expect(h.paragraf.every((p) => p.cara === "usulan")).toBe(true);
    expect(h.paragraf.some((p) => p.kode === "P.11")).toBe(false);
  });
});

describe("cerai tidak berubah oleh kartu baru", () => {
  it("kartu itsbat dan dispensasi tidak pernah dipakai untuk cerai, dan sebaliknya", () => {
    const b = masuk([KTP(), bar("Kutipan Akta Nikah", { an: "Fulan" })]);
    const cg = susunParagrafBukti(dasar("CG", b));
    expect(cg.paragraf.map((p) => p.asal).join(" ")).not.toMatch(/Itsbat|Dispensasi/);
    expect(cg.paragraf.map((p) => p.bunyi).join(" ")).toContain("Penggugat");
    const inn = susunParagrafBukti(dasar("IN", b));
    expect(inn.paragraf.map((p) => p.asal).join(" ")).not.toMatch(/Perceraian/);
  });
});

/* ---------------------------------------------------------------- kepatuhan: bunyi kartu berasal dari bahan */
type Bahan = { sumber: string; blangko: Array<{ folder: string; berkas: string; alineaBukti: string[] }>; variabel: Record<string, { nama: string; rumus: string; bawaan: string }> };
const berkasBahan = path.resolve(__dirname, "../../../docs/arahan/awan-f46-bahan-itsbat-dk.json");
const mentahBahan = readFileSync(berkasBahan, "utf8");
const bahan = JSON.parse(mentahBahan) as Bahan;
const KARTU_BARU = KARTU_PERTIMBANGAN.filter((k) => k.perkara.some((j) => j === "IN" || j === "DK"));

const KODE_RE = /[PT]\.\d+(?:,? (?:[PT]\.\d+,? )*(?:dan|sampai dengan|sampai) [PT]\.\d+)?/g;
/** Bentuk pembanding teks blangko: penanda #nnnn# diganti nama kolom, nomor bukti diseragamkan, "para" dilepas. Pemetaan ini berdiri sendiri dari yang dipakai saat kartu dibuat. */
function bentukBlangko(t: string, berkas: string): string {
  const cowok = /\(Anak P Cowok\)/.test(berkas);
  let x = t.replace(/\s+/g, " ").trim().replace(KODE_RE, "§").replace(/#4424#/g, "§");
  x = x.replace(/\bpara (?:#0046#|Pemohon)/g, "{pihak}").replace(/#0046#/g, "{pihak}");
  x = x
    .replace(/#0053#/g, "{perkara}")
    .replace(/#8554#/g, "{majelis}")
    .replace(/#8008#/g, "{satker}")
    .replace(/Pasal #11886# #11851#/g, "{pasalAkta}")
    .replace(/#5197#/g, "{tglNikah}")
    .replace(/#3517#/g, "{alamat}")
    .replace(/#5178#|#0997#/g, "{oleh}")
    .replace(/#8812#/g, "{tglIjazah}")
    .replace(/#0349#/g, "{tglLahirAnak}");
  x = cowok
    ? x.replace(/#0600#/g, "{anak}").replace(/#0601#/g, "{usiaAnak}").replace(/#0603#/g, "{pendidikan}").replace(/#0606#/g, "{calon}")
    : x.replace(/#0606#/g, "{anak}").replace(/#0607#/g, "{usiaAnak}").replace(/#0609#/g, "{pendidikan}").replace(/#0600#/g, "{calon}");
  return x.replace(/ ;/g, ";");
}
const bentukKartu = (bunyi: string) =>
  bunyi
    .replace(/\[\[([\s\S]*?)\]\]/g, "$1")
    .replace(/\{(?:kode|fotokopi|asli|berkaitan|kodeKeluarga)\}/g, "§")
    .replace(/\{para\}/g, "")
    .replace(/ ;/g, ";");
const keadaanBerkas = (b: string) => (/\[Kabul/.test(b) ? "kabul" : /\[Tolak/.test(b) ? "tolak" : /\[NO\]/.test(b) ? "tdt" : "");

describe("kepatuhan: bunyi kartu itsbat dan dispensasi berasal dari bahan blangko", () => {
  it("ada kartu untuk tiap keadaan yang bunyinya ada di blangko", () => {
    const ada = (j: JenisPerkaraBukti, k: string) => KARTU_BARU.some((x) => x.perkara.includes(j) && x.keadaan.some((e) => e === k));
    for (const k of ["kabul", "tolak", "tdt"]) expect(ada("IN", k), `IN ${k}`).toBe(true);
    for (const k of ["kabul", "tolak"]) expect(ada("DK", k), `DK ${k}`).toBe(true);
    expect(ada("DK", "tdt")).toBe(false);
    expect(KARTU_BARU.every((x) => x.perkara.length === 1 && !x.keadaan.some((e) => e.endsWith("verstek")))).toBe(true);
  });
  it("setiap rujukan menunjuk alinea nyata yang sama dengan bunyi kartu, di folder dan keadaan yang benar", () => {
    for (const k of KARTU_BARU) {
      for (const a of k.asal) {
        const blangko = bahan.blangko.find((b) => b.folder === a.folder && b.berkas === a.berkas);
        expect(blangko, `${k.id}: blangko ${a.berkas}`).toBeTruthy();
        const alinea = blangko!.alineaBukti[a.alinea];
        expect(alinea, `${k.id}: alinea ${a.alinea}`).toBeTruthy();
        expect(bentukKartu(k.bunyi), `${k.id} <- ${a.berkas}`).toBe(bentukBlangko(alinea, a.berkas));
        expect(a.folder.startsWith(k.perkara[0] === "IN" ? "2 Itsbat Nikah" : "3 Dispensasi Kawin")).toBe(true);
        const keadaan = keadaanBerkas(a.berkas);
        if (keadaan) expect(k.keadaan as string[], `${k.id} <- ${a.berkas}`).toContain(keadaan);
      }
    }
  });
  it("kartu tanpa rujukan hanya yang disahkan keputusan pemilik (bukti tanpa asli)", () => {
    const tanpa = KARTU_BARU.filter((x) => x.asal.length === 0);
    expect(tanpa.length).toBeGreaterThan(0);
    for (const k of tanpa) {
      expect(k.sumberKhusus).toContain("Keputusan pemilik");
      expect(k.bunyi).toBe("- Bahwa bukti {kode} adalah fotokopi yang tidak dapat dicocokkan dengan aslinya;");
    }
  });
  it("tidak ada kata Aleta, penanda mentah, atau data perkara pada bunyi dan bahan", () => {
    for (const k of KARTU_BARU) {
      expect(k.bunyi).not.toMatch(/aleta/i);
      expect(k.bunyi).not.toMatch(/#\d+#/);
      expect(k.bunyi).not.toMatch(/\b\d{16}\b/);
      expect(`${k.catatan ?? ""}${k.sumberKhusus ?? ""}`).not.toMatch(/aleta/i);
    }
    expect(mentahBahan.match(/\b\d{16}\b/g)).toBeNull();
    expect(mentahBahan.match(/aleta/gi)).toBeNull();
    expect(mentahBahan.match(/password|api[_-]?key|sk-ant|BEGIN (?:RSA|PRIVATE)/gi)).toBeNull();
    expect(mentahBahan.match(/(?:rekening|norek)[^"]{0,20}\d{8,}/gi)).toBeNull();
    expect(mentahBahan.match(/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g)).toBeNull();
  });
  it("jenis bukti tiap kartu ada dalam katalog", () => {
    const katalog = new Set(["ktp", "kk", "kia", "nikah", "lahir", "ijazah", "tolak", "hamil", "bidan"]);
    for (const k of KARTU_BARU) if (k.kunci !== "*") for (const j of k.kunci) expect(katalog.has(j), `${k.id}: ${j}`).toBe(true);
  });
});

/* ---------------------------------------------------------------- layar */
const BAHAN_LAYAR = (jumlah: number) => ({
  P: Array.from({ length: jumlah }, () => ({ nama: "Pemohon Uji", nikSamar: "", nikSidik: "" })),
  T: [],
  nikah: null,
  dokumen: [],
});
const naskahBukti = (nm: string, an: string) => [{ teks: `${kalimatBaris(bar(nm, { an }), "P", 0)}` }];

describe("layar Pertimbangan dari alat bukti", () => {
  afterEach(() => vi.unstubAllGlobals());
  const pasang = (jenisPerkara: string, jumlah = 2) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ ok: true, data: BAHAN_LAYAR(jumlah) }) })));
    return render(createElement(BuktiAletaAbt, { alinea: naskahBukti("Kartu Tanda Penduduk", "Fulan"), perkaraId: "1", nomor: "1/Pdt.P/2026/PA.Uji", jenisPerkara }));
  };
  it("dispensasi kawin: ada pilihan jumlah Pemohon, anak, isian; tidak ada saklar verstek", async () => {
    pasang("Dispensasi Kawin");
    expect(await screen.findByText("Pertimbangan dari alat bukti")).toBeTruthy();
    expect(screen.getByText("Jumlah Pemohon")).toBeTruthy();
    expect(screen.getByText("Anak Pemohon")).toBeTruthy();
    expect(screen.getByText(/Nama calon pasangan anak/)).toBeTruthy();
    expect(screen.queryByText("Lawan tidak hadir (verstek)")).toBeNull();
    await waitFor(() => expect(screen.getByText("Terbaca 2 Pemohon dari SIPP.")).toBeTruthy());
  });
  it("itsbat nikah: hanya isian alamat; jumlah Pemohon dibaca dari SIPP", async () => {
    pasang("Pengesahan Perkawinan/Istbat Nikah", 1);
    await screen.findByText("Pertimbangan dari alat bukti");
    await waitFor(() => expect(screen.getByText("Terbaca 1 Pemohon dari SIPP.")).toBeTruthy());
    expect(screen.getByText(/Alamat Pemohon/)).toBeTruthy();
    expect(screen.queryByText(/Nama calon pasangan anak/)).toBeNull();
    expect(screen.queryByText("Anak Pemohon")).toBeNull();
  });
  it("cerai gugat tetap punya saklar verstek", async () => {
    pasang("Cerai Gugat");
    expect(await screen.findByText("Lawan tidak hadir (verstek)")).toBeTruthy();
    expect(screen.queryByText("Jumlah Pemohon")).toBeNull();
  });
  it("jenis lain: kosong dengan keterangan", async () => {
    pasang("Wasiat");
    expect(await screen.findByText("Pertimbangan dari alat bukti")).toBeTruthy();
    expect(screen.getByText(/belum punya bunyi pertimbangan alat bukti di blangko/)).toBeTruthy();
    expect(screen.queryByText("Keadaan putusan")).toBeNull();
  });
  it("memilih Dikabulkan pada itsbat menyusun paragraf dari blangko", async () => {
    const { container } = pasang("Itsbat Nikah");
    await screen.findByText("Keadaan putusan");
    expect(container).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Keadaan putusan/), { target: { value: "Dikabulkan" } });
    await waitFor(() => expect(screen.getByText(/telah diberi meterai cukup dan telah dinazegelen/)).toBeTruthy());
    expect(screen.getAllByText(/Dari 2 Itsbat Nikah/).length).toBeGreaterThan(0);
  });
});
