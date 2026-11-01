// @vitest-environment node
/**
 * ============================================================================
 * 1 NOV 2026 (N1) - AGEN KELENGKAPAN HARI SIDANG
 * ============================================================================
 * Yang dijaga (perilaku, bukan pencocokan teks kode):
 *   1. aturan murni: tiap butir (relaas, BAS lalu, saksi, e-Court, panjar, mediasi, kuasa) menyala PADA keadaan yang benar dan
 *      DIAM pada keadaan yang aman; tingkat sidang = butir terburuk; butir "info" tidak mengubah lencana dan tidak dikirim;
 *   2. penanggung jawab: pesan hanya ke petugas yang NAMANYA tercantum pada peran itu di perkaranya; Kasir menerima butir kasir;
 *      juru sita tidak membaca angka panjar;
 *   3. pembaca fakta bot (kueri tiruan): sidang yang ditandai, BAS lalu yang belum jatuh tempo tidak ditagih, kuasa tanpa register,
 *      panjar lewat Kasir yang ada, batas waktu panjar, sumber yang gagal disebut (bukan dianggap aman);
 *   4. agen atas pg-mem dengan sumber tiruan: jadwal menyala + WA mati = hasil tersimpan tanpa pesan; WA menyala = satu pesan per
 *      petugas per hari, jalan kedua tidak mengirim ulang; gagal baca bot = bukan hari bersih, dicoba lagi; hari libur diam;
 *      lonceng hanya milik sendiri.
 * Nama dan nomor perkara rekaan. Hari acuan: Senin 2 Nov 2026 (besok = Selasa 3 Nov).
 */
import { createRequire } from "node:module";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { namaAdaDi } from "@/lib/perkara-sendiri";
import {
  butirUntukPetugas,
  kalimatSebabTenggang,
  keteranganKesiapan,
  nilaiSidang,
  ringkasKesiapan,
  ringkasLoncengKelengkapan,
  saringUntukGolongan,
  susunPesanKelengkapan,
  tanggalPeriksa,
  type FaktaSidangKelengkapan,
} from "@/lib/kelengkapan-sidang";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  bacaCatatanKelengkapan,
  bacaKesiapan,
  bacaSetelanKelengkapan,
  bersihkanAgenKelengkapan,
  detakKelengkapan,
  jalankanKelengkapan,
  pemberitahuanKelengkapan,
  simpanSetelanKelengkapan,
  type AkunPetugas,
  type SumberKelengkapan,
} from "@/server/modules/aleta-ecourt/agen-kelengkapan";
import type { PortalWhatsappSendResult } from "@/server/modules/whatsapp/portal-whatsapp-sender";

const req = createRequire(import.meta.url);
const bot = req(path.resolve(process.cwd(), "../aleta_bot/services/kelengkapanSidangService.js"));

const HARI = "2026-11-02";
const BESOK = "2026-11-03";

function F(x: Partial<FaktaSidangKelengkapan> = {}): FaktaSidangKelengkapan {
  return {
    sidangId: "s1",
    perkaraId: "1",
    nomorPerkara: "101/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    tanggalSidang: HARI,
    jamSidang: "09:00",
    agenda: "Pemeriksaan pokok perkara",
    majelisNama: "Hakim Satu, S.H., Hakim Dua, M.H.",
    paniteraNama: "Citra Lestari, S.H.",
    jurusitaNama: "Juru Sita Satu",
    saksiPihak1: 0,
    saksiPihak2: 0,
    panggilan: { wajibDipanggil: [2], belumDipanggil: 0, sisiBelumDipanggil: [], retur: 0, returSebab: [], tenggangMepet: false, tenggangTersempit: { sisi: 2, dinilai: true, patut: true, selisih: 5, ambang: 3, alasan: "" } },
    basLalu: { terbaca: true, tanggal: "2026-10-26", ada: true, jatuhTempo: true },
    panjar: { terbaca: true, prodeo: false, saldo: 100000, kurang: 0, panggilTerakhir: 29500 },
    ...x,
  };
}

const nilai = (x: Partial<FaktaSidangKelengkapan> = {}, bahan = {}) => nilaiSidang(F(x), { hariIni: HARI, ...bahan });
const kunci = (p: ReturnType<typeof nilaiSidang>) => p.butir.map((b) => `${b.kunci}:${b.tingkat}`);

// ─── 1. Aturan murni ─────────────────────────────────────────────────────────

describe("aturan murni - keadaan aman tidak menyalakan apa pun", () => {
  it("panggilan patut, BAS lalu ada, panjar cukup = siap (hijau) tanpa butir", () => {
    const p = nilai();
    expect(p.tingkat).toBe("siap");
    expect(p.butir).toEqual([]);
    expect(ringkasKesiapan(p)).toMatchObject({ tingkat: "siap", teks: "Siap sidang", jumlah: 0 });
  });

  it("sidang yang semua pihak hadir sebelumnya (tidak ada yang wajib dipanggil) dan tanpa tenggang = siap", () => {
    expect(nilai({ panggilan: { wajibDipanggil: [], belumDipanggil: 0, retur: 0, tenggangMepet: false, tenggangTersempit: null } }).tingkat).toBe("siap");
  });
});

describe("relaas panggilan", () => {
  it("relaas belum ada -> merah, penanggung jurusita dan PP, menyebut pihaknya menurut jenis perkara", () => {
    const p = nilai({ panggilan: { wajibDipanggil: [2], belumDipanggil: 1, sisiBelumDipanggil: [2], retur: 0, tenggangMepet: true, tenggangTersempit: { sisi: 2, dinilai: false, patut: false, selisih: null, alasan: "belum_dipanggil_sidang_sudah_dekat", ambang: 3 } } });
    expect(p.tingkat).toBe("tidak-siap");
    const b = p.butir.find((x) => x.kunci === "relaas")!;
    expect(b.tingkat).toBe("merah");
    expect(b.judul).toContain("Tergugat");
    expect(b.peran).toEqual(expect.arrayContaining(["jurusita", "pp"]));
    // cerai talak / permohonan memakai Termohon
    const t = nilai({ jenisPerkara: "Cerai Talak", alurPerkaraId: 16, panggilan: { wajibDipanggil: [2], belumDipanggil: 1, sisiBelumDipanggil: [2] } });
    expect(t.butir.find((x) => x.kunci === "relaas")!.judul).toContain("Termohon");
  });

  it("surat kembali (retur) -> merah dengan sebabnya", () => {
    const p = nilai({ panggilan: { wajibDipanggil: [2], belumDipanggil: 0, retur: 1, returSebab: ["Retur - alamat tidak ditemukan"], tenggangTersempit: { sisi: 2, dinilai: true, patut: null, selisih: 15, ambang: 3, alasan: "belum_diterima" } } });
    const b = p.butir.filter((x) => x.kunci === "relaas");
    expect(b[0].tingkat).toBe("merah");
    expect(b[0].judul).toContain("alamat tidak ditemukan");
    // "belum diterima" untuk relaas yang sama tidak menggandakan butir retur
    expect(b).toHaveLength(1);
  });

  it("satuan yang BENAR: surat tercatat diterima diukur hari kerja dengan ambang terima (3), bukan ambang kirim (6)", () => {
    const p = nilai({ panggilan: { wajibDipanggil: [2], belumDipanggil: 0, retur: 0, tenggangTersempit: { sisi: 2, dinilai: true, patut: false, selisih: 1, ambang: 6, alasan: "diterima_kurang_dari_ambang", jalur: "surat_tercatat", ambangTerima: 3, terimaHariKerja: true, hariKerja: false } } });
    expect(p.butir[0].judul).toBe("Panggilan Tergugat belum patut: diterima 1 hari kerja sebelum sidang (paling sedikit 3)");
    const k = nilai({ panggilan: { wajibDipanggil: [2], belumDipanggil: 0, retur: 0, tenggangTersempit: { sisi: 2, dinilai: true, patut: false, selisih: 4, ambang: 6, alasan: "tenggang_kurang_dari_ambang", ambangTerima: 3, hariKerja: false } } });
    expect(k.butir[0].judul).toContain("dikirim 4 hari sebelum sidang (paling sedikit 6)");
  });

  it("tenggang tidak patut (diterima kurang dari ambang) -> merah dengan kalimat, bukan kode", () => {
    const p = nilai({ panggilan: { wajibDipanggil: [2], belumDipanggil: 0, retur: 0, tenggangMepet: true, tenggangTersempit: { sisi: 2, dinilai: true, patut: false, selisih: 2, ambang: 3, alasan: "diterima_kurang_dari_ambang" } } });
    const b = p.butir.find((x) => x.kunci === "relaas")!;
    expect(b.tingkat).toBe("merah");
    expect(b.judul).toContain("diterima 2 hari sebelum sidang (paling sedikit 3)");
    expect(b.judul + b.uraian).not.toMatch(/diterima_kurang_dari_ambang/);
  });

  it("surat tercatat yang bukti penerimaannya belum ada -> kuning (bukan merah); tenggang mepet saja -> kuning", () => {
    const p = nilai({ panggilan: { wajibDipanggil: [2], belumDipanggil: 0, retur: 0, tenggangTersempit: { sisi: 2, dinilai: true, patut: null, selisih: 8, ambang: 6, alasan: "penerimaan_belum_terbukti" } } });
    expect(kunci(p)).toEqual(["relaas:kuning"]);
    const m = nilai({ panggilan: { wajibDipanggil: [2], belumDipanggil: 0, retur: 0, tenggangMepet: true, tenggangTersempit: { sisi: 2, dinilai: true, patut: true, selisih: 3, ambang: 3, alasan: "" } } });
    expect(kunci(m)).toEqual(["relaas:kuning"]);
  });

  it("kalimat sebab untuk tiap alasan mesin panggilan", () => {
    const k = (alasan: string, selisih: number | null = 2, ambang: number | null = 3) => kalimatSebabTenggang({ alasan, selisih, ambang });
    expect(k("dikirim_setelah_hari_sidang")).toBe("dikirim setelah hari sidang");
    expect(k("tenggang_kurang_dari_ambang")).toContain("dikirim 2 hari sebelum sidang");
    expect(k("belum_diterima")).toContain("belum diterima");
    expect(k("penerimaan_belum_terbukti")).toContain("bukti penerimaan");
    expect(k("alasan-baru-tak-dikenal")).toBe("tidak memenuhi tenggang");
  });
});

describe("BAS sidang lalu", () => {
  it("belum diunggah dan sudah jatuh tempo -> kuning untuk PP", () => {
    const p = nilai({ basLalu: { terbaca: true, tanggal: "2026-10-26", ada: false, jatuhTempo: true, agenda: "Jawaban Tergugat" } });
    expect(kunci(p)).toEqual(["bas:kuning"]);
    expect(p.butir[0].peran).toEqual(["pp"]);
    expect(p.butir[0].judul).toContain("belum diunggah");
  });
  it("sidang lalu berlangsung HARI INI (BAS belum waktunya), tidak terbaca, atau tidak ada sidang lalu = diam", () => {
    expect(nilai({ basLalu: { terbaca: true, tanggal: HARI, ada: false, jatuhTempo: false } }).butir).toEqual([]);
    expect(nilai({ basLalu: { terbaca: false } }).butir).toEqual([]);
    expect(nilai({ basLalu: null }).butir).toEqual([]);
  });
});

describe("saksi", () => {
  it("pembuktian tanpa saksi tercatat -> kuning; saksi tercatat tetapi tanya jawab kurang -> kuning dengan jumlah; lengkap = diam", () => {
    expect(kunci(nilai({ agenda: "Pembuktian Penggugat" }))).toEqual(["saksi:kuning"]);
    const kurang = nilai({ agenda: "Pembuktian", saksiPihak1: 2 }, { saksiBertanyaJawab: 1 });
    expect(kurang.butir[0].judul).toBe("1 saksi belum punya tanya jawab");
    expect(nilai({ agenda: "Pembuktian", saksiPihak1: 2 }, { saksiBertanyaJawab: 2 }).butir).toEqual([]);
    // tanya jawab tidak terbaca = tidak menuduh
    expect(nilai({ agenda: "Pembuktian", saksiPihak1: 2 }, { saksiBertanyaJawab: null }).butir).toEqual([]);
  });
  it("agenda lain tidak menuntut saksi", () => {
    expect(nilai({ agenda: "Jawaban Tergugat" }).butir).toEqual([]);
  });
});

describe("dokumen e-Court", () => {
  const ec = (keadaan: string, tambah = {}) => ({ keadaan, menunggu: 0, dokumen: 0, jenisDituntut: ["jawaban"], sidangLalu: "2026-10-19", ...tambah });
  it("belum upload: MERAH bila sidangnya hari ini, kuning bila besok", () => {
    expect(kunci(nilai({ agenda: "Jawaban Tergugat", ecourt: ec("belum-upload") }))).toEqual(["ecourt:merah"]);
    expect(kunci(nilai({ agenda: "Jawaban Tergugat", tanggalSidang: BESOK, ecourt: ec("belum-upload") }))).toEqual(["ecourt:kuning"]);
  });
  it("menunggu verifikasi majelis -> kuning untuk hakim; sudah / tidak tersambung = diam", () => {
    const p = nilai({ ecourt: ec("belum", { menunggu: 2 }) });
    expect(p.butir[0]).toMatchObject({ kunci: "ecourt", tingkat: "kuning", peran: ["hakim"] });
    expect(nilai({ ecourt: ec("sudah") }).butir).toEqual([]);
    expect(nilai({ ecourt: ec("tidak-konek") }).butir).toEqual([]);
  });
});

describe("panjar (Kasir yang ada)", () => {
  it("Tambahan Panjar ditawarkan / saldo minus -> kuning untuk Kasir; prodeo, hari putus, tidak terbaca = diam", () => {
    const k = nilai({ panjar: { terbaca: true, prodeo: false, saldo: -5000, kurang: 15000, panggilTerakhir: 29500 } });
    expect(k.butir[0]).toMatchObject({ kunci: "panjar", tingkat: "kuning", peran: ["kasir"] });
    expect(k.butir[0].judul).toContain("15.000");
    expect(nilai({ panjar: { terbaca: true, prodeo: true, saldo: -1, kurang: 5000 } }).butir).toEqual([]);
    expect(nilai({ agenda: "Pembacaan putusan", panjar: { terbaca: true, saldo: -1, kurang: 5000 } }).butir).toEqual([]);
    expect(nilai({ panjar: { terbaca: false } }).butir).toEqual([]);
  });
  it("saldo nol PERSIS tidak diperingatkan; sisa positif kurang dari satu panggilan hanya CATATAN (tidak mengubah lencana, tidak dikirim)", () => {
    expect(nilai({ panjar: { terbaca: true, saldo: 0, kurang: 0, panggilTerakhir: 29500 } }).butir).toEqual([]);
    const p = nilai({ panjar: { terbaca: true, saldo: 14500, kurang: 0, panggilTerakhir: 29500 } });
    expect(p.butir.map((b) => b.tingkat)).toEqual(["info"]);
    expect(p.tingkat).toBe("siap");
    expect(ringkasKesiapan(p).jumlah).toBe(0);
    const baris = butirUntukPetugas([p], { nama: "Kasir Satu", golongan: ["kasir"] }, namaAdaDi);
    expect(baris).toEqual([]);
  });
});

describe("mediasi dan kuasa", () => {
  it("agenda mediasi tanpa mediator -> merah untuk hakim; dengan mediator = diam", () => {
    const p = nilai({ agenda: "Proses Mediasi", panggilan: null, mediasi: null });
    expect(p.butir[0]).toMatchObject({ kunci: "mediasi", tingkat: "merah", peran: ["hakim"] });
    expect(nilai({ agenda: "Proses Mediasi", panggilan: null, mediasi: { mediator: "Mediator Satu", ditunjuk: "2026-10-20" } }).butir).toEqual([]);
  });
  it("agenda laporan hasil mediasi tanpa laporan/hasil -> kuning; hasil terisi = diam; mediasi tak terbaca = diam", () => {
    const l = nilai({ agenda: "Mendengarkan Laporan Hasil Mediasi", panggilan: null, mediasi: { mediator: "Mediator Satu" } });
    expect(l.butir[0]).toMatchObject({ kunci: "mediasi", tingkat: "kuning" });
    expect(nilai({ agenda: "Mendengarkan Laporan Hasil Mediasi", panggilan: null, mediasi: { mediator: "M", hasil: "T" } }).butir).toEqual([]);
    expect(nilai({ agenda: "Proses Mediasi", panggilan: null, mediasi: null, mediasiTerbaca: false }).butir).toEqual([]);
  });
  it("kuasa tanpa register -> kuning (nama dipotong dua + 'dan N lainnya'); kuasa terdaftar = diam", () => {
    const p = nilai({ kuasa: { terbaca: true, jumlah: 4, tanpaRegister: [{ pihakKe: 1, nama: "A, S.H." }, { pihakKe: 1, nama: "B, S.H." }, { pihakKe: 2, nama: "C, S.H." }] } });
    expect(p.butir[0]).toMatchObject({ kunci: "kuasa", tingkat: "kuning" });
    expect(p.butir[0].judul).toContain("A, S.H., B, S.H. dan 1 lainnya");
    expect(nilai({ kuasa: { terbaca: true, jumlah: 2, tanpaRegister: [] } }).butir).toEqual([]);
  });
});

describe("tingkat sidang, urutan butir, keterangan", () => {
  it("tingkat = terburuk; merah di atas kuning; keterangan tidak memuat kode alasan", () => {
    const p = nilai({
      agenda: "Jawaban Tergugat",
      basLalu: { terbaca: true, tanggal: "2026-10-26", ada: false, jatuhTempo: true },
      panggilan: { wajibDipanggil: [2], belumDipanggil: 0, retur: 1, returSebab: ["Retur"] },
    });
    expect(p.tingkat).toBe("tidak-siap");
    expect(p.butir[0].tingkat).toBe("merah");
    expect(ringkasKesiapan(p).teks).toBe("Belum siap (2)");
    const ket = keteranganKesiapan(p);
    expect(ket).not.toMatch(/[a-z]+_[a-z]+_[a-z]+/);
    expect(ket).not.toMatch(/aleta/i);
  });
  it("kuning saja = 'Perlu dilengkapi'", () => {
    expect(ringkasKesiapan(nilai({ basLalu: { terbaca: true, tanggal: "2026-10-26", ada: false, jatuhTempo: true } })).teks).toBe("Perlu dilengkapi (1)");
  });
  it("tanggalPeriksa: hari ini + hari kerja berikutnya, tanpa ganda", () => {
    expect(tanggalPeriksa(HARI, BESOK)).toEqual([HARI, BESOK]);
    expect(tanggalPeriksa(HARI, HARI)).toEqual([HARI]);
    expect(tanggalPeriksa(HARI, "")).toEqual([HARI]);
  });
});

// ─── 2. Penanggung jawab, pesan, lonceng ─────────────────────────────────────

describe("penanggung jawab dan pesan", () => {
  const sidang = [
    nilai({ perkaraId: "1", nomorPerkara: "101/Pdt.G/2026/PA.Dgl", panggilan: { wajibDipanggil: [2], belumDipanggil: 1, sisiBelumDipanggil: [2] }, basLalu: { terbaca: true, tanggal: "2026-10-26", ada: false, jatuhTempo: true }, panjar: { terbaca: true, saldo: -1, kurang: 10000 } }),
    nilai({ perkaraId: "2", nomorPerkara: "102/Pdt.G/2026/PA.Dgl", tanggalSidang: BESOK, paniteraNama: "Dewi Anggraini", jurusitaNama: "Juru Sita Dua", majelisNama: "Hakim Tiga", basLalu: { terbaca: true, tanggal: "2026-10-27", ada: false, jatuhTempo: true } }),
  ];
  const cocok = namaAdaDi;

  it("PP menerima BAS/relaas perkaranya saja; jurusita relaas; hakim butir hakim; Kasir butir kasir seluruh satker", () => {
    const pp = butirUntukPetugas(sidang, { nama: "Citra Lestari", golongan: ["pp"] }, cocok);
    expect(pp.map((b) => b.penilaian.perkaraId)).toEqual(["1"]);
    expect(pp[0].butir.map((b) => b.kunci).sort()).toEqual(["bas", "relaas"]);

    const js = butirUntukPetugas(sidang, { nama: "Juru Sita Satu", golongan: ["jurusita"] }, cocok);
    expect(js.map((b) => b.penilaian.perkaraId)).toEqual(["1"]);
    expect(js[0].butir.map((b) => b.kunci)).toEqual(["relaas"]);

    const kasir = butirUntukPetugas(sidang, { nama: "Kasir Satu", golongan: ["kasir"] }, cocok);
    expect(kasir.map((b) => b.penilaian.perkaraId)).toEqual(["1"]);
    expect(kasir[0].butir.map((b) => b.kunci)).toEqual(["panjar"]);

    expect(butirUntukPetugas(sidang, { nama: "Orang Lain", golongan: ["pp"] }, cocok)).toEqual([]);
    // nama kosong tidak pernah cocok
    expect(butirUntukPetugas(sidang, { nama: "", golongan: [] }, cocok)).toEqual([]);
  });

  it("juru sita tidak membaca angka panjar; lencananya dihitung ulang tanpa butir itu", () => {
    const p = saringUntukGolongan(sidang[0], ["jurusita"]);
    expect(p.butir.some((b) => b.kunci === "panjar")).toBe(false);
    expect(JSON.stringify(p)).not.toMatch(/10\.000/);
    const hanyaPanjar = nilai({ panjar: { terbaca: true, saldo: -1, kurang: 10000 } });
    expect(hanyaPanjar.tingkat).toBe("perhatian");
    expect(saringUntukGolongan(hanyaPanjar, ["jurusita"]).tingkat).toBe("siap");
    expect(saringUntukGolongan(hanyaPanjar, ["kasir"]).tingkat).toBe("perhatian");
  });

  it("pesan: satu pesan, hari ini dahulu, satu baris per butir, ringkas jumlah, tanpa kata teknis; tanpa baris = kosong", () => {
    const baris = butirUntukPetugas(sidang, { nama: "Citra Lestari", golongan: ["pp"] }, cocok);
    const pesan = susunPesanKelengkapan({ nama: "Citra Lestari", hariIni: HARI, baris, satker: "PA Contoh" });
    expect(pesan).toContain("KESIAPAN SIDANG - PA Contoh");
    expect(pesan).toContain("HARI INI");
    expect(pesan).toContain("101/Pdt.G/2026");
    expect(pesan).toContain("[!] Relaas panggilan Tergugat belum ada");
    expect(pesan).toContain("[ ] BAS sidang");
    expect(pesan).toMatch(/1 butir belum siap, 1 perlu dilengkapi\./);
    expect(pesan).not.toMatch(/aleta|JSON|null|undefined/i);
    expect(susunPesanKelengkapan({ nama: "X", hariIni: HARI, baris: [] })).toBe("");
  });

  it("pesan panjang dipotong di batas baris dengan penutup", () => {
    const banyak = Array.from({ length: 80 }, (_, i) => nilai({ perkaraId: String(i + 10), nomorPerkara: `${i + 200}/Pdt.G/2026/PA.Dgl`, basLalu: { terbaca: true, tanggal: "2026-10-26", ada: false, jatuhTempo: true, agenda: "Sidang dengan agenda yang cukup panjang untuk memenuhi pesan" } }));
    const baris = butirUntukPetugas(banyak, { nama: "Citra Lestari", golongan: ["pp"] }, cocok);
    const pesan = susunPesanKelengkapan({ nama: "Citra Lestari", hariIni: HARI, baris });
    expect(pesan.length).toBeLessThanOrEqual(3200);
    expect(pesan).toContain("selengkapnya di layar Jadwal Sidang");
  });

  it("lonceng: hari bersih / hanya catatan = tidak ada; ada merah = penting; admin satu ringkasan satker", () => {
    expect(ringkasLoncengKelengkapan([nilai()], HARI, true)).toBeNull();
    const r = ringkasLoncengKelengkapan(sidang, HARI, true)!;
    expect(r.id).toBe(`kelengkapan:${HARI}:semua`);
    expect(r.penting).toBe(true);
    expect(r.judul).toContain("1 perkara belum siap");
    expect(r.judul).toContain("1 perlu dilengkapi");
    expect(ringkasLoncengKelengkapan([sidang[1]], HARI, false)!.penting).toBe(false);
  });
});

// ─── 3. Pembaca fakta bot ────────────────────────────────────────────────────

describe("pembaca fakta bot (kueri tiruan)", () => {
  type Baris = Record<string, unknown>;
  function jadwalBaris(x: Baris = {}): Baris {
    return {
      sidangId: "11", perkaraId: "1", nomorPerkara: "101/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, tanggalSidang: HARI, jamSidang: "09:00:00",
      urutanSidang: 3, agenda: "Pemeriksaan pokok perkara", ditunda: false, sudahPutus: false, sidangIkrarTalak: false, lewatEcourt: false,
      majelisNama: "Hakim Satu", paniteraNama: "Citra Lestari", jurusitaNama: "Juru Sita Satu", saksiPihak1: 0, saksiPihak2: 0, adaKuasa: false,
      panggilan: { wajibDipanggil: [2], belumDipanggil: 0, retur: 0, tenggangMepet: false, tenggangTersempit: { sisi: 2, dinilai: true, patut: true, selisih: 5, ambang: 3, alasan: "" }, sisaHariKeSidang: 0 },
      mediasi: null, mediasiTerbaca: true,
      ...x,
    };
  }

  function sumberPalsu(o: { jadwal?: Baris[]; kueri?: (sql: string, nilai: unknown[]) => Baris[]; kasir?: (id: string) => unknown; lambatKasirMs?: number } = {}) {
    let jam = 1_000_000;
    const kueri = vi.fn(async (sql: string, nilai: unknown[]) => (o.kueri ? o.kueri(sql, nilai) : []));
    const kasir = vi.fn(async (id: string) => {
      jam += o.lambatKasirMs ?? 0;
      return o.kasir ? o.kasir(id) : { ok: true, pembiayaan: 1, saldo: 50000, usulan: [], jurnal: [] };
    });
    return {
      kueri,
      kasir,
      sumber: {
        jalankan: kueri,
        tabelAda: async () => true,
        jadwal: async () => ({ sidang: o.jadwal ?? [jadwalBaris()] }),
        ecourtHari: vi.fn(async () => ({ ok: true, perkara: {} })),
        kasir,
        JB: () => ({ PANGGIL_PENGGUGAT: 12, PANGGIL_PEMOHON: 13, PANGGIL_TERGUGAT: 14, PANGGIL_TERMOHON: 15, PEMBERITAHUAN: 29 }),
        JB_TAMBAH_PANJAR: () => 224,
        sekarang: () => jam,
      },
    };
  }

  it("hanya sidang pada tanggal sasaran, satu per perkara-tanggal; putus SEBELUM sidang ini disaring, putusan sesudahnya tidak", async () => {
    const { sumber } = sumberPalsu({
      jadwal: [
        jadwalBaris(),
        jadwalBaris({ sidangId: "12" }), // ganda perkara+tanggal
        jadwalBaris({ sidangId: "13", perkaraId: "2", tanggalSidang: "2026-11-05" }), // di luar sasaran
        jadwalBaris({ sidangId: "14", perkaraId: "3", sudahPutus: true, tanggalPutusan: "2026-10-20" }), // putus sebelum sidang ini
        jadwalBaris({ sidangId: "15", perkaraId: "4", sudahPutus: true, tanggalPutusan: HARI }), // diputus pada sidang ini (data lampau)
        jadwalBaris({ sidangId: "16", perkaraId: "5", sudahPutus: true, tanggalPutusan: "2026-10-20", sidangIkrarTalak: true }), // sidang ikrar tetap diperiksa
        jadwalBaris({ sidangId: "17", perkaraId: "" }),
      ],
    });
    const h = await bot.bacaFakta({ hariIni: HARI, tanggal: [HARI, BESOK] }, sumber);
    expect(h.ok).toBe(true);
    expect(h.sidang.map((s: { perkaraId: string }) => s.perkaraId).sort()).toEqual(["1", "4", "5"]);
  });

  it("BAS lalu: sidang lalu < hari ini jatuh tempo; sidang lalu = hari ini tidak ditagih; ada bila salah satu baris berBAS", async () => {
    const { sumber } = sumberPalsu({
      jadwal: [jadwalBaris({ perkaraId: "1" }), jadwalBaris({ sidangId: "22", perkaraId: "2", tanggalSidang: BESOK })],
      kueri: (sql, nilai) => {
        if (/FROM perkara_jadwal_sidang/.test(sql) && nilai[nilai.length - 1] === HARI) return [{ perkaraId: 1, tanggal: "2026-10-26", agenda: "Jawaban", edocBas: "", dihadiriOleh: 2, ditunda: "Y" }];
        if (/FROM perkara_jadwal_sidang/.test(sql) && nilai[nilai.length - 1] === BESOK)
          return [
            { perkaraId: 2, tanggal: HARI, agenda: "Pembuktian", edocBas: "", dihadiriOleh: null, ditunda: "T" },
          ];
        return [];
      },
    });
    const h = await bot.bacaFakta({ hariIni: HARI, tanggal: [HARI, BESOK] }, sumber);
    const s1 = h.sidang.find((s: { perkaraId: string }) => s.perkaraId === "1");
    const s2 = h.sidang.find((s: { perkaraId: string }) => s.perkaraId === "2");
    expect(s1.basLalu).toMatchObject({ tanggal: "2026-10-26", ada: false, jatuhTempo: true });
    expect(s2.basLalu).toMatchObject({ tanggal: HARI, ada: false, jatuhTempo: false });
    // dan aturan portal: yang pertama menyala, yang kedua diam
    expect(nilaiSidang(s1, { hariIni: HARI }).butir.some((b) => b.kunci === "bas")).toBe(true);
    expect(nilaiSidang(s2, { hariIni: HARI }).butir.some((b) => b.kunci === "bas")).toBe(false);
  });

  it("kuasa tanpa nomor DAN tanggal register dilaporkan; yang berregister tidak", async () => {
    const { sumber } = sumberPalsu({
      kueri: (sql) =>
        /perkara_pengacara/.test(sql)
          ? [
              { perkaraId: 1, pihakKe: 1, nama: "Adv A", nomorKuasa: "", tanggalKuasa: null },
              { perkaraId: 1, pihakKe: 2, nama: "Adv B", nomorKuasa: "12/K/2026", tanggalKuasa: null },
              { perkaraId: 1, pihakKe: 2, nama: "Adv C", nomorKuasa: "", tanggalKuasa: "2026-10-01" },
            ]
          : [],
    });
    const h = await bot.bacaFakta({ hariIni: HARI, tanggal: [HARI] }, sumber);
    expect(h.sidang[0].kuasa).toMatchObject({ jumlah: 3, tanpaRegister: [{ pihakKe: 1, nama: "Adv A" }] });
  });

  it("kuasa per SISI: satu kuasa berregister di sisi itu cukup (baris kuasa lain tidak dituduh); nama ganda dilipat", async () => {
    const { sumber } = sumberPalsu({
      kueri: (sql) =>
        /perkara_pengacara/.test(sql)
          ? [
              { perkaraId: 1, pihakKe: 1, nama: "Adv A", nomorKuasa: "", tanggalKuasa: null },
              { perkaraId: 1, pihakKe: 1, nama: "Adv Berregister", nomorKuasa: "72/SK/IX/2026", tanggalKuasa: "2026-09-08" },
              { perkaraId: 1, pihakKe: 2, nama: "Adv D", nomorKuasa: "", tanggalKuasa: "0000-00-00" },
              { perkaraId: 1, pihakKe: 2, nama: "Adv D", nomorKuasa: null, tanggalKuasa: null },
            ]
          : [],
    });
    const h = await bot.bacaFakta({ hariIni: HARI, tanggal: [HARI] }, sumber);
    expect(h.sidang[0].kuasa.tanpaRegister).toEqual([{ pihakKe: 2, nama: "Adv D" }]);
  });

  it("panjar lewat Kasir yang ada: Tambahan Panjar ditawarkan = kurang; prodeo dibaca; agenda putus dilewati; gagal Kasir disebut", async () => {
    const { sumber, kasir } = sumberPalsu({
      jadwal: [jadwalBaris({ perkaraId: "1" }), jadwalBaris({ sidangId: "12", perkaraId: "2", agenda: "Pembacaan putusan" }), jadwalBaris({ sidangId: "13", perkaraId: "3" })],
      kasir: (id) =>
        id === "1"
          ? { ok: true, pembiayaan: 1, saldo: -5000, usulan: [{ jenisBiayaId: 224, jumlah: 15000 }], jurnal: [{ jenisBiayaId: 14, jenisTransaksi: -1, jumlah: 29500 }, { jenisBiayaId: 14, jenisTransaksi: -1, jumlah: 14500 }] }
          : { ok: false, alasan: "Tabel perkara_biaya tidak ada pada SIPP versi ini." },
    });
    const h = await bot.bacaFakta({ hariIni: HARI, tanggal: [HARI] }, sumber);
    expect(kasir).toHaveBeenCalledTimes(2); // perkara putusan tidak dibaca
    const p1 = h.sidang.find((s: { perkaraId: string }) => s.perkaraId === "1").panjar;
    expect(p1).toEqual({ terbaca: true, prodeo: false, saldo: -5000, kurang: 15000, panggilTerakhir: 29500 });
    expect(h.sidang.find((s: { perkaraId: string }) => s.perkaraId === "2").panjar).toBeNull();
    expect(h.sidang.find((s: { perkaraId: string }) => s.perkaraId === "3").panjar.terbaca).toBe(false);
  });

  it("batas waktu panjar: yang tidak sempat dibaca tidak dianggap aman dan disebut di 'gagal'", async () => {
    const jadwal = Array.from({ length: 6 }, (_, i) => jadwalBaris({ sidangId: String(30 + i), perkaraId: String(100 + i) }));
    const { sumber, kasir } = sumberPalsu({ jadwal, lambatKasirMs: 10_000 });
    const h = await bot.bacaFakta({ hariIni: HARI, tanggal: [HARI] }, sumber);
    expect(kasir.mock.calls.length).toBeLessThan(6);
    expect(h.gagal.panjar).toMatch(/Batas waktu/);
    const tanpa = h.sidang.filter((s: { panjar: unknown }) => s.panjar === null);
    expect(tanpa.length).toBeGreaterThan(0);
    for (const s of tanpa) expect(nilaiSidang(s, { hariIni: HARI }).butir.some((b) => b.kunci === "panjar")).toBe(false);
  });

  it("satu kueri BAS per tanggal dan satu kueri kuasa (tanpa N+1)", async () => {
    const jadwal = Array.from({ length: 20 }, (_, i) => jadwalBaris({ sidangId: String(40 + i), perkaraId: String(200 + i), tanggalSidang: i % 2 ? BESOK : HARI }));
    const { sumber, kueri } = sumberPalsu({ jadwal });
    await bot.bacaFakta({ hariIni: HARI, tanggal: [HARI, BESOK] }, sumber);
    expect(kueri).toHaveBeenCalledTimes(3);
  });

  it("jadwal gagal = tidak ok (bukan hari bersih); tanggal tidak sah ditolak", async () => {
    const s = { ...sumberPalsu().sumber, jadwal: async () => { throw new Error("SIPP mati"); } };
    const h = await bot.bacaFakta({ hariIni: HARI, tanggal: [HARI] }, s);
    expect(h.ok).toBe(false);
    expect(h.gagal.jadwal).toContain("SIPP mati");
    expect((await bot.bacaFakta({ hariIni: HARI, tanggal: ["bukan-tanggal"] }, sumberPalsu().sumber)).ok).toBe(false);
  });

  it("tidak ada satu pun INSERT/UPDATE/DELETE di pembaca (hanya SELECT)", async () => {
    const { sumber, kueri } = sumberPalsu();
    await bot.bacaFakta({ hariIni: HARI, tanggal: [HARI, BESOK] }, sumber);
    for (const [sql] of kueri.mock.calls) expect(String(sql).trim()).toMatch(/^SELECT/i);
  });
});

// ─── 4. Agen atas pg-mem ─────────────────────────────────────────────────────

describe("agen: jadwal pagi, hasil tersimpan, kabar WhatsApp, lonceng", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  }, 180000);
  afterAll(async () => {
    await db?.close();
  });

  // Senin 2 Nov 2026 08:00 WITA = 00:00 UTC; 06:00 WITA = Minggu 22:00 UTC; Sabtu 31 Okt 08:00 WITA
  const SENIN_0800 = new Date("2026-11-02T00:00:00Z");
  const SENIN_0600 = new Date("2026-11-01T22:00:00Z");
  const SABTU_0800 = new Date("2026-10-31T00:00:00Z");

  const AKUN: AkunPetugas[] = [
    { id: "u-citra", nama: "Citra Lestari", nomorWa: "081234567802", golongan: ["pp"] },
    { id: "u-js", nama: "Juru Sita Satu", nomorWa: "081234567803", golongan: ["jurusita"] },
    { id: "u-hakim", nama: "Hakim Satu", nomorWa: "tidak-sah", golongan: ["hakim"] },
    { id: "u-kasir", nama: "Kasir Satu", nomorWa: "081234567805", golongan: ["kasir"] },
    { id: "u-lain", nama: "Orang Lain", nomorWa: "081234567806", golongan: ["pp"] },
  ];

  const SIDANG: FaktaSidangKelengkapan[] = [
    F({ perkaraId: "1", panggilan: { wajibDipanggil: [2], belumDipanggil: 1, sisiBelumDipanggil: [2] }, basLalu: { terbaca: true, tanggal: "2026-10-26", ada: false, jatuhTempo: true }, panjar: { terbaca: true, saldo: -1, kurang: 10000 }, ecourt: { keadaan: "belum-upload", jenisDituntut: ["jawaban"], sidangLalu: "2026-10-26" } }),
    F({ perkaraId: "2", nomorPerkara: "102/Pdt.G/2026/PA.Dgl", tanggalSidang: BESOK, paniteraNama: "Dewi Anggraini", jurusitaNama: "Juru Sita Dua", majelisNama: "Hakim Tiga" }),
  ];

  function sumberUji(o: { gagalBaca?: boolean } = {}) {
    const fungsi = {
      fakta: vi.fn(async (hariIni: string, tanggal: string[]) =>
        o.gagalBaca ? { ok: false, sidang: [], gagal: {}, ms: {}, terpotong: false, galat: "ALETA Bot tidak menjawab." } : { ok: true, sidang: SIDANG, gagal: {}, ms: { jadwal: 5 }, terpotong: false, galat: "", hariIni, tanggal }
      ),
      tanyaJawab: vi.fn(async () => []),
      penerima: vi.fn(async () => AKUN),
      kirim: vi.fn(async (_m: unknown): Promise<PortalWhatsappSendResult> => ({ ok: true, status: "enqueued", queueId: 7, message: "Antre." })),
    };
    return { sumber: fungsi as unknown as SumberKelengkapan, fungsi };
  }
  const pesanKe = (fungsi: ReturnType<typeof sumberUji>["fungsi"], nomor: string) =>
    fungsi.kirim.mock.calls.map((c) => c[0] as { recipientNumber: string; message: string; entityId: string }).filter((p) => p.recipientNumber === nomor);

  beforeEach(async () => {
    bersihkanAgenKelengkapan();
    await db.run("DELETE FROM aleta_tenggat_kirim");
    await db.run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = '*sistem*' AND kunci LIKE 'sistem:agen-kelengkapan%'");
  });

  it("bawaan: jadwal MENYALA, WhatsApp MATI, jam 07.00; jam tak sah kembali ke bawaan", async () => {
    expect(await bacaSetelanKelengkapan(db)).toMatchObject({ jadwal: true, pengingatWa: false, jam: "07:00" });
    const s = await simpanSetelanKelengkapan(db, { id: "sa", name: "Super Admin Uji" }, { jam: "25:99", pengingatWa: true });
    expect(s).toMatchObject({ jam: "07:00", pengingatWa: true, diubahOleh: "Super Admin Uji" });
  });

  it("jadwal pagi: sebelum jamnya diam; sesudahnya sekali; hasil tersimpan; WA mati = tidak ada pesan, tabel kirim kosong", async () => {
    const { sumber, fungsi } = sumberUji();
    expect(await detakKelengkapan(db, { kini: SENIN_0600, sumber })).toBeNull();
    expect(fungsi.fakta).not.toHaveBeenCalled();
    const c = await detakKelengkapan(db, { kini: SENIN_0800, sumber });
    expect(c?.jalan?.pemicu).toBe("jadwal");
    expect(fungsi.fakta).toHaveBeenCalledWith(HARI, [HARI, BESOK]);
    expect(c?.penilaian.map((p) => `${p.perkaraId}:${p.tingkat}`)).toEqual(["1:tidak-siap", "2:siap"]);
    expect(c?.jalan?.ms.total).toBeGreaterThanOrEqual(0);
    expect(fungsi.kirim).not.toHaveBeenCalled();
    expect(await db.queryAll("SELECT * FROM aleta_tenggat_kirim")).toEqual([]);
    // sekali per tanggal
    expect(await detakKelengkapan(db, { kini: new Date("2026-11-02T03:00:00Z"), sumber })).toBeNull();
    expect(fungsi.fakta).toHaveBeenCalledTimes(1);
    // dibaca ulang dari basis data
    expect((await bacaCatatanKelengkapan(db, HARI)).penilaian).toHaveLength(2);
  });

  it("hari libur (Sabtu), saklar jadwal mati, dan ALETA_AGEN_KELENGKAPAN=0: tidak membaca SIPP sama sekali", async () => {
    const { sumber, fungsi } = sumberUji();
    expect(await detakKelengkapan(db, { kini: SABTU_0800, sumber })).toBeNull();
    await simpanSetelanKelengkapan(db, { id: "sa", name: "SA" }, { jadwal: false });
    expect(await detakKelengkapan(db, { kini: SENIN_0800, sumber })).toBeNull();
    await simpanSetelanKelengkapan(db, { id: "sa", name: "SA" }, { jadwal: true });
    expect(await detakKelengkapan(db, { kini: SENIN_0800, sumber, env: { ALETA_AGEN_KELENGKAPAN: "0" } })).toBeNull();
    expect(fungsi.fakta).not.toHaveBeenCalled();
    expect(await pemberitahuanKelengkapan(db, { nama: "Citra Lestari", golongan: ["pp"], lihatSemua: false, kini: SENIN_0800 })).toEqual([]);
  });

  it("WA menyala: satu pesan per petugas per hari ke yang berhak; jalan kedua tidak mengirim ulang; nomor tak sah dilewati; orang lain tidak dikirimi", async () => {
    await simpanSetelanKelengkapan(db, { id: "sa", name: "SA" }, { pengingatWa: true });
    const { sumber, fungsi } = sumberUji();
    const c = await jalankanKelengkapan(db, { pemicu: "jadwal", kini: SENIN_0800, sumber, satker: "PA Contoh" });
    expect(c.wa).toMatchObject({ terkirim: 3, dilewati: 1, gagal: 0 });
    expect(pesanKe(fungsi, "081234567802")).toHaveLength(1); // PP
    expect(pesanKe(fungsi, "081234567803")).toHaveLength(1); // jurusita
    expect(pesanKe(fungsi, "081234567805")).toHaveLength(1); // kasir
    expect(pesanKe(fungsi, "081234567806")).toHaveLength(0); // PP lain: tanpa perkara
    expect(pesanKe(fungsi, "081234567802")[0].message).toContain("BAS sidang");
    expect(pesanKe(fungsi, "081234567802")[0].message).not.toContain("Panjar"); // PP tidak diberi butir kasir
    expect(pesanKe(fungsi, "081234567805")[0].message).toContain("Panjar kurang");
    expect(pesanKe(fungsi, "081234567803")[0].message).not.toContain("Panjar");
    // jalan manual kedua pada hari yang sama: tidak ada pesan baru
    const kedua = await jalankanKelengkapan(db, { pemicu: "tangan", kini: SENIN_0800, sumber });
    expect(kedua.wa?.terkirim).toBe(0);
    expect(fungsi.kirim).toHaveBeenCalledTimes(3);
    const baris = await db.queryAll<{ id: string; status: string }>("SELECT id, status FROM aleta_tenggat_kirim ORDER BY id");
    expect(baris.map((b) => b.id)).toEqual(["kelengkapan:2026-11-02:u-citra", "kelengkapan:2026-11-02:u-hakim", "kelengkapan:2026-11-02:u-js", "kelengkapan:2026-11-02:u-kasir"]);
    expect(baris.find((b) => b.id.endsWith("u-hakim"))?.status).toBe("dilewati");
  });

  it("pesan yang gagal dapat diulang HANYA bila diminta; yang terkirim tidak pernah ganda", async () => {
    await simpanSetelanKelengkapan(db, { id: "sa", name: "SA" }, { pengingatWa: true });
    const { sumber, fungsi } = sumberUji();
    fungsi.kirim.mockResolvedValueOnce({ ok: false, status: "error", message: "Bot mati" } as PortalWhatsappSendResult);
    const c = await jalankanKelengkapan(db, { pemicu: "jadwal", kini: SENIN_0800, sumber });
    expect(c.wa?.gagal).toBe(1);
    const tanpaUlang = await jalankanKelengkapan(db, { pemicu: "tangan", kini: SENIN_0800, sumber });
    expect(tanpaUlang.wa?.terkirim).toBe(0);
    const ulang = await jalankanKelengkapan(db, { pemicu: "tangan", kini: SENIN_0800, sumber, ulangiGagal: true });
    expect(ulang.wa?.terkirim).toBe(1);
  });

  it("gagal membaca bot BUKAN hari bersih: tanpa hasil, tanpa lonceng, dicoba lagi pada detak berikutnya", async () => {
    const mati = sumberUji({ gagalBaca: true });
    const c = await detakKelengkapan(db, { kini: SENIN_0800, sumber: mati.sumber });
    expect(c?.jalan?.galat).toContain("tidak menjawab");
    expect(c?.penilaian).toEqual([]);
    expect(await pemberitahuanKelengkapan(db, { nama: "Admin", golongan: ["admin"], lihatSemua: true, kini: SENIN_0800 })).toEqual([]);
    const hidup = sumberUji();
    const lagi = await detakKelengkapan(db, { kini: new Date("2026-11-02T00:05:00Z"), sumber: hidup.sumber });
    expect(lagi?.jalan?.galat).toBe("");
    expect(lagi?.penilaian).toHaveLength(2);
    expect(lagi?.percobaan).toBe(0);
  });

  it("lonceng: admin satu ringkasan satker; PP hanya miliknya; orang tanpa perkara tidak mendapat apa pun", async () => {
    const { sumber } = sumberUji();
    await jalankanKelengkapan(db, { pemicu: "jadwal", kini: SENIN_0800, sumber });
    const admin = await pemberitahuanKelengkapan(db, { nama: "Admin", golongan: ["admin"], lihatSemua: true, kini: SENIN_0800 });
    expect(admin).toHaveLength(1);
    expect(admin[0]).toMatchObject({ id: `kelengkapan:${HARI}:semua`, penting: true });
    const pp = await pemberitahuanKelengkapan(db, { nama: "Citra Lestari", golongan: ["pp"], lihatSemua: false, kini: SENIN_0800 });
    expect(pp[0].id).toBe(`kelengkapan:${HARI}:saya`);
    expect(pp[0].judul).toContain("Anda");
    expect(await pemberitahuanKelengkapan(db, { nama: "Orang Lain", golongan: ["pp"], lihatSemua: false, kini: SENIN_0800 })).toEqual([]);
    // juru sita: hanya butir relaas (merah), tidak membaca panjar
    const js = await pemberitahuanKelengkapan(db, { nama: "Juru Sita Satu", golongan: ["jurusita"], lihatSemua: false, kini: SENIN_0800 });
    expect(js[0].judul).toContain("1 perkara belum siap");
  });

  it("pembaca lencana: hanya perkara diminta, sidang terdekat, tanpa membaca SIPP; saklar mati = kosong", async () => {
    const { sumber } = sumberUji();
    await jalankanKelengkapan(db, { pemicu: "jadwal", kini: SENIN_0800, sumber });
    const k = await bacaKesiapan(db, ["1", "999"], { kini: SENIN_0800 });
    expect(Object.keys(k.peta)).toEqual(["1"]);
    expect(k.peta["1"].tingkat).toBe("tidak-siap");
    expect(k.menyala).toBe(true);
    await simpanSetelanKelengkapan(db, { id: "sa", name: "SA" }, { jadwal: false });
    expect((await bacaKesiapan(db, ["1"], { kini: SENIN_0800 })).peta).toEqual({});
  });

  it("hasil lebih dari 7 hari dibuang saat jalan berikutnya", async () => {
    await db.run("INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES ('*sistem*', 'sistem:agen-kelengkapan:hari:2026-10-10', '{}', '2026-10-10')");
    const { sumber } = sumberUji();
    await jalankanKelengkapan(db, { pemicu: "jadwal", kini: SENIN_0800, sumber });
    const sisa = await db.queryAll<{ kunci: string }>("SELECT kunci FROM aleta_ekstensi_setelan WHERE pengguna_id = '*sistem*' AND kunci LIKE 'sistem:agen-kelengkapan:hari:%'");
    expect(sisa.map((x) => x.kunci)).toEqual(["sistem:agen-kelengkapan:hari:2026-11-02"]);
  });
});
