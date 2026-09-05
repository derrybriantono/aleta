// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const panggil = vi.fn();

vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: (operasi: string, params: Record<string, unknown>) => panggil(operasi, params),
}));

const { rakitBerkasPerkara } = await import("@/server/modules/aleta-ecourt/berkas-perkara");

/**
 * Berkas perkara terpadu.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Dua perilaku yang paling mudah rusak diam-diam, dan paling mahal bila rusak:
 *
 *   - SATU SUMBER MATI TIDAK MENJATUHKAN SISANYA. Petugas yang membuka perkara
 *     saat ABT mati tetap harus melihat data SIPP-nya. Halaman kosong yang
 *     tidak menjelaskan apa-apa jauh lebih buruk daripada halaman terisi
 *     sebagian yang menyebutkan bagian mana yang tidak terbaca.
 *
 *   - SELISIH ANTAR SUMBER DISEBUTKAN, BUKAN DILEBUR. Bila ABT memuat
 *     pemeriksaan lima saksi sementara SIPP mencatat tiga, itu temuan - bukan
 *     kotoran yang perlu dibersihkan dengan memilih salah satu.
 */

function jawab(peta: Record<string, unknown>) {
  panggil.mockImplementation(async (operasi: string) => {
    if (operasi in peta) {
      const nilai = peta[operasi];
      if (nilai instanceof Error) return { ok: false, error: nilai.message };
      return { ok: true, data: nilai };
    }
    return { ok: true, data: null };
  });
}

const TIGA_SAKSI = [{ name: "A" }, { name: "B" }, { name: "C" }];

beforeEach(() => {
  panggil.mockReset();
});

describe("merakit berkas perkara", () => {
  it("mengambil seluruh bagian bersamaan, bukan berurutan", async () => {
    jawab({ "case.detail": { nomorPerkara: "545/Pdt.G/2026/PA.Dgl" } });
    await rakitBerkasPerkara("10096");
    // Sebelas bagian, satu panggilan masing-masing - bila kelak ada yang
    // menambah pembacaan berantai, jumlahnya berubah dan uji ini bersuara.
    // Angka ini pernah 10 dan naik saat dokumen e-Court masuk ke daftar
    // penarik: itulah gunanya diperiksa, bukan sekadar dicocokkan ulang.
    expect(panggil).toHaveBeenCalledTimes(11);
    expect(panggil.mock.calls.map((c) => c[0])).toContain("ecourt.dokumenPerkara");
    expect(panggil.mock.calls.every((c) => c[1].perkaraId === "10096")).toBe(true);
  });

  it("perkara_id kosong ditolak sebelum satu pun sumber dihubungi", async () => {
    const berkas = await rakitBerkasPerkara("");
    expect(berkas.ok).toBe(false);
    expect(panggil).not.toHaveBeenCalled();
    expect(berkas.halangan.join(" ")).toMatch(/tidak dikenali/i);
  });
});

describe("satu sumber mati tidak menjatuhkan sisanya", () => {
  it("ABT mati: data SIPP tetap terbaca, halangannya disebutkan dengan nama sistemnya", async () => {
    jawab({
      "case.detail": { nomorPerkara: "545/Pdt.G/2026/PA.Dgl" },
      "case.parties": [{ nama: "Penggugat" }],
      "case.pemeriksaanSaksi": new Error("Basis data APS Badilag tidak ditemukan di server ini."),
    });

    const berkas = await rakitBerkasPerkara("10096");

    expect(berkas.identitas.ada).toBe(true);
    expect(berkas.paraPihak.ada).toBe(true);
    expect(berkas.pemeriksaanSaksi.ada).toBe(false);
    // Halangannya menyebut sistem dan tabelnya - "gagal" saja membuat petugas
    // berhenti dan bertanya, padahal pekerjaannya masih dapat diteruskan.
    expect(berkas.halangan.join(" ")).toContain("APS Badilag");
    expect(berkas.halangan.join(" ")).toContain("abt_keterangan_saksi");
  });

  it("tiap bagian membawa asal-usulnya, termasuk yang gagal", async () => {
    jawab({ "case.detail": { nomorPerkara: "545" } });
    const berkas = await rakitBerkasPerkara("10096");

    expect(berkas.pertimbangan.asal.sistem).toBe("SIPP");
    expect(berkas.pertimbangan.asal.sumber).toBe("perkara_pertimbangan_hukum");
    expect(berkas.pemeriksaanSaksi.asal.sistem).toBe("APS Badilag");
    expect(berkas.pemeriksaanSaksi.asal.diambil).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("selisih antar sumber", () => {
  it("ABT memeriksa lebih banyak saksi daripada yang tercatat SIPP", async () => {
    jawab({
      "case.detail": { nomorPerkara: "545" },
      "case.witnesses": TIGA_SAKSI,
      "case.pemeriksaanSaksi": { ada: true, jumlahSaksi: 5, jumlahTanyaJawab: 121, saksi: [] },
    });

    const berkas = await rakitBerkasPerkara("10096");
    const selisih = berkas.selisih.find((x) => x.hal === "Jumlah saksi");

    expect(selisih).toBeDefined();
    expect(selisih?.menurut).toEqual([
      { sistem: "SIPP", nilai: "3 orang tercatat" },
      { sistem: "APS Badilag", nilai: "5 orang diperiksa" },
    ]);
    expect(selisih?.keterangan).toMatch(/belum tercatat di SIPP/i);
  });

  it("arah selisih yang berlawanan dijelaskan berbeda", async () => {
    jawab({
      "case.detail": { nomorPerkara: "545" },
      "case.witnesses": TIGA_SAKSI,
      "case.pemeriksaanSaksi": { ada: true, jumlahSaksi: 1, saksi: [] },
    });

    const berkas = await rakitBerkasPerkara("10096");
    expect(berkas.selisih[0]?.keterangan).toMatch(/belum terekam di ABT/i);
  });

  it("jumlah yang sama tidak dilaporkan sebagai selisih", async () => {
    jawab({
      "case.detail": { nomorPerkara: "545" },
      "case.witnesses": TIGA_SAKSI,
      "case.pemeriksaanSaksi": { ada: true, jumlahSaksi: 3, saksi: [] },
    });

    const berkas = await rakitBerkasPerkara("10096");
    expect(berkas.selisih.find((x) => x.hal === "Jumlah saksi")).toBeUndefined();
  });

  it("putusan tanpa pertimbangan disebutkan", async () => {
    jawab({
      "case.detail": { nomorPerkara: "545" },
      "case.decision": { amar: "Mengabulkan gugatan Penggugat" },
      "case.pertimbangan": null,
    });

    const berkas = await rakitBerkasPerkara("10096");
    expect(berkas.selisih.find((x) => x.hal === "Pertimbangan hukum")).toBeDefined();
  });

  it("tidak ada saksi di kedua sistem bukan selisih", async () => {
    jawab({ "case.detail": { nomorPerkara: "545" } });
    const berkas = await rakitBerkasPerkara("10096");
    expect(berkas.selisih).toHaveLength(0);
  });
});

/**
 * Pembanding antar sumber - A3.
 *
 * Yang dijaga: selisih yang TERLEWAT, bukan selisih yang muncul. Selisih yang
 * tidak terlihat justru berbahaya pada saat ia paling perlu dilihat - naskah
 * resmi akan memakai satu sumber sementara petugas membaca yang lain.
 */
describe("membandingkan antar sumber", () => {
  it("nama pihak yang tidak muncul pada ringkasan perkara dilaporkan", async () => {
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail")
        return { ok: true, data: { nomorPerkara: "551/Pdt.G/2026/PA.Dgl", paraPihak: "Penggugat:<br />Reka" } };
      if (operasi === "case.parties")
        return { ok: true, data: [{ role: "Penggugat", name: "Reka" }, { role: "Tergugat", name: "Ahmad Pajri" }] };
      return { ok: true, data: [] };
    });

    const berkas = await rakitBerkasPerkara("10102");
    const selisih = berkas.selisih.find((item) => item.hal === "Nama para pihak");
    expect(selisih?.keterangan).toMatch(/daftar pihak/i);
    expect(selisih?.menurut.map((m) => m.nilai).join(" ")).toContain("Ahmad Pajri");
  });

  it("majelis tanpa Hakim Ketua dilaporkan", async () => {
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail") return { ok: true, data: { nomorPerkara: "551/Pdt.G/2026/PA.Dgl" } };
      if (operasi === "case.judges")
        return { ok: true, data: [{ jabatan: "Hakim Anggota", name: "A" }, { jabatan: "Hakim Anggota", name: "B" }] };
      return { ok: true, data: [] };
    });

    const berkas = await rakitBerkasPerkara("10102");
    expect(berkas.selisih.some((item) => item.hal === "Ketua majelis")).toBe(true);
  });

  it("majelis yang punya ketua tidak dilaporkan", async () => {
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail") return { ok: true, data: { nomorPerkara: "551/Pdt.G/2026/PA.Dgl" } };
      if (operasi === "case.judges") return { ok: true, data: [{ jabatan: "Hakim Ketua", name: "A" }] };
      if (operasi === "case.panitera") return { ok: true, data: [{ name: "PP" }] };
      return { ok: true, data: [] };
    });

    const berkas = await rakitBerkasPerkara("10102");
    expect(berkas.selisih.some((item) => item.hal === "Ketua majelis")).toBe(false);
    expect(berkas.selisih.some((item) => item.hal === "Panitera pengganti")).toBe(false);
  });

  it("nomor sidang yang melompat dilaporkan", async () => {
    // BAS untuk sidang yang nomornya tidak ada tidak akan menemukan tanggalnya.
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail") return { ok: true, data: { nomorPerkara: "551/Pdt.G/2026/PA.Dgl" } };
      if (operasi === "case.schedule") return { ok: true, data: [{ sidangKe: 1 }, { sidangKe: 3 }] };
      return { ok: true, data: [] };
    });

    const berkas = await rakitBerkasPerkara("10102");
    const selisih = berkas.selisih.find((item) => item.hal === "Rangkaian sidang");
    expect(selisih?.menurut.map((m) => m.nilai).join(" ")).toContain("2");
  });

  it("rangkaian sidang yang utuh tidak dilaporkan", async () => {
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail") return { ok: true, data: { nomorPerkara: "551/Pdt.G/2026/PA.Dgl" } };
      if (operasi === "case.schedule") return { ok: true, data: [{ sidangKe: 2 }, { sidangKe: 1 }] };
      return { ok: true, data: [] };
    });

    const berkas = await rakitBerkasPerkara("10102");
    expect(berkas.selisih.some((item) => item.hal === "Rangkaian sidang")).toBe(false);
  });

  it("keterangan saksi yang menyebut sebutan peran TIDAK dicurigai tersalin", async () => {
    // Banyak keterangan menulis "Penggugat" dan "Tergugat", bukan namanya - dan
    // itu wajar. Melaporkannya sebagai mencurigakan membuat peringatan ini
    // muncul pada hampir seluruh perkara, lalu berhenti dibaca.
    const panjang = "Saya mengenal Penggugat karena saya tantenya. ".repeat(8);
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail") return { ok: true, data: { nomorPerkara: "551/Pdt.G/2026/PA.Dgl" } };
      if (operasi === "case.parties") return { ok: true, data: [{ role: "Penggugat", name: "Reka" }] };
      if (operasi === "case.pemeriksaanSaksi")
        return { ok: true, data: { jumlahSaksi: 1, saksi: [{ tanyaJawab: [{ pertanyaan: "T", jawaban: panjang }] }] } };
      return { ok: true, data: [] };
    });

    const berkas = await rakitBerkasPerkara("10102");
    expect(berkas.selisih.some((item) => item.hal === "Keterangan saksi")).toBe(false);
  });

  it("keterangan saksi yang tidak menyebut pihak maupun peran dicurigai tersalin", async () => {
    const panjang = "Saksi menerangkan hal-hal yang berhubungan dengan tanah warisan keluarga besar. ".repeat(5);
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail") return { ok: true, data: { nomorPerkara: "551/Pdt.G/2026/PA.Dgl" } };
      if (operasi === "case.parties") return { ok: true, data: [{ role: "Penggugat", name: "Reka" }] };
      if (operasi === "case.pemeriksaanSaksi")
        return { ok: true, data: { jumlahSaksi: 1, saksi: [{ tanyaJawab: [{ pertanyaan: "T", jawaban: panjang }] }] } };
      return { ok: true, data: [] };
    });

    const berkas = await rakitBerkasPerkara("10102");
    expect(berkas.selisih.some((item) => item.hal === "Keterangan saksi")).toBe(true);
  });
});
