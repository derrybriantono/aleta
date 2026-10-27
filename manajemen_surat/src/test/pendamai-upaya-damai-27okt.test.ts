// @vitest-environment node
/**
 * 27 OKT 2026 - 1268 UPAYA DAMAI: SIAPA YANG MENDAMAIKAN
 * Kalimat 1268 tetap; hanya pelakunya (keluarga / aparat / keduanya / lainnya) yang disesuaikan.
 * Tidak terbaca -> kalimat bawaan + empat pilihan manual.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type Pilihan = { keadaan: string; nilai: string };
type Usulan = { kode: string; nilai: string; catatan?: string; perukun?: { kategori: string; rincian: string[] }; pilihan?: Pilihan[] };
type Hasil = { usulan: Usulan[]; pendamaiGalat?: string };

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(process.cwd(), "../aleta_bot");
const layanan = require_(path.join(AKAR, "services/abtUsulanService.js")) as {
  dariKeteranganSaksi: (a: string, b: string, sidang?: string, pihak?: { pelaku?: string; lawan?: string }, posita?: string, opsi?: Record<string, unknown>) => Hasil;
};
const kamus = require_(path.join(AKAR, "services/kamusDeteksi.js")) as { aturLapisDatabase: (x: { pola?: unknown[] }) => void; lupakan: () => void };

const bas = (...b: string[]) => b.map((x) => `- Bahwa ${x};`).join("\n");
const damai = (s1: string, s2 = "", posita = "", pihak = { pelaku: "Tergugat", lawan: "Penggugat" }) => {
  const h = layanan.dariKeteranganSaksi(s1, s2, "", pihak, posita);
  expect(h.pendamaiGalat).toBeUndefined();
  return h.usulan.find((u) => u.kode === "1268")!;
};

afterEach(() => kamus.lupakan());

describe("1268 - pelaku upaya damai", () => {
  it("keluarga: kalimat bawaan tidak berubah", () => {
    const u = damai(bas("Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh keluarga namun tidak berhasil"));
    expect(u.nilai).toBe("pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil");
    expect(u.perukun!.kategori).toBe("keluarga");
    expect(u.pilihan).toBeUndefined();
  });

  it("aparat desa dan tokoh adat -> aparat", () => {
    const u = damai(bas("Penggugat dan Tergugat sudah pernah dirukunkan oleh Tua Adat dan aparat desa, namun tidak berhasil"));
    expect(u.perukun!.kategori).toBe("aparat");
    expect(u.nilai).toBe("aparat pemerintah desa dan tokoh adat telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil");
  });

  it("keluarga dan aparat -> keduanya; sebutan pihak ikut jenis perkara (Pemohon/Termohon)", () => {
    const u = damai(bas("Pemohon dan Termohon sudah pernah diupayakan untuk dirukunkan oleh keluarga dan Ketua RT, namun tidak berhasil"), "", "", { pelaku: "Termohon", lawan: "Pemohon" });
    expect(u.perukun!.kategori).toBe("keduanya");
    expect(u.nilai).toBe("pihak keluarga serta ketua RT/RW telah berusaha untuk mendamaikan Pemohon dan Termohon, namun tidak berhasil");
  });

  it("dua saksi menyebut pendamai berbeda -> semuanya dipakai", () => {
    const u = damai(bas("Penggugat dan Tergugat pernah didamaikan oleh keluarga namun tidak berhasil"), bas("Penggugat dan Tergugat pernah didamaikan oleh kepala desa namun tidak berhasil"));
    expect(u.perukun!.kategori).toBe("keduanya");
  });

  it("KUA / tokoh agama termasuk aparat; tetangga/teman = lainnya", () => {
    expect(damai(bas("Penggugat dan Tergugat pernah dinasihati di Kantor Urusan Agama namun tidak berhasil")).perukun!.kategori).toBe("aparat");
    const u = damai(bas("Penggugat dan Tergugat pernah didamaikan oleh tetangga namun tidak berhasil"));
    expect(u.perukun!.kategori).toBe("lainnya");
    expect(u.nilai).toContain("pihak lain telah berusaha untuk mendamaikan");
  });

  it("tidak terbaca siapa pendamainya: bunyi bawaan + empat pilihan manual", () => {
    const u = damai(bas("Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan namun tidak berhasil"));
    expect(u.perukun!.kategori).toBe("");
    expect(u.nilai).toContain("pihak keluarga telah berusaha");
    expect(u.pilihan).toHaveLength(4);
    expect(u.pilihan!.map((p) => p.keadaan)).toEqual([
      "didamaikan keluarga",
      "didamaikan aparat (pemerintah desa/kelurahan, tokoh agama/adat, KUA, RT/RW)",
      "didamaikan keluarga dan aparat",
      "didamaikan pihak lain",
    ]);
    expect(u.pilihan![0].nilai).toBe("pihak keluarga telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil");
    expect(u.pilihan![3].nilai).toContain("pihak lain telah berusaha");
    expect(u.catatan).toContain("tidak disebut");
  });

  it("belum pernah ada upaya: tidak diisi sendiri, tidak diberi pelaku", () => {
    const u = damai(bas("belum pernah ada upaya untuk merukunkan Penggugat dan Tergugat"));
    expect(u.nilai).toBe("");
    expect(u.perukun).toBeUndefined();
  });

  it("dari posita bila kedua saksi diam", () => {
    const u = damai("", "", "Bahwa Penggugat dan Tergugat sudah pernah diupayakan rukun oleh tokoh adat setempat, namun tidak berhasil.");
    expect(u.nilai).toContain("tokoh adat telah berusaha");
  });

  it("pola pendamai dapat ditambah lewat lapis database (pola baru dikenali tanpa rilis)", () => {
    const sebelum = damai(bas("Penggugat dan Tergugat pernah didamaikan oleh Pak Dusun namun tidak berhasil"));
    expect(sebelum.perukun!.kategori).toBe("");
    kamus.aturLapisDatabase({
      pola: [{ kode: "perukun-uji-dusun", kelompok: "perukun", label: "uji", kunci: "dusun", regex: "pak\\s+dusun", flags: "i", status: "aktif", yakin: "ragu", contohBenar: [], contohSalah: [], ukur: { n: 0, tepat: 0, salahTangkap: 0 }, kategori: "aparat", teks: "kepala dusun", urut: 20 }],
    });
    const sesudah = damai(bas("Penggugat dan Tergugat pernah didamaikan oleh Pak Dusun namun tidak berhasil"));
    expect(sesudah.nilai).toBe("kepala dusun telah berusaha untuk mendamaikan Penggugat dan Tergugat, namun tidak berhasil");
  });
});
