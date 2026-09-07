// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const panggil = vi.fn();

vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: (operasi: string, params: Record<string, unknown>) => panggil(operasi, params),
}));

const { createAletaDatabase } = await import("@/server/db/client");
type AletaDatabase = Awaited<ReturnType<typeof createAletaDatabase>>;

const {
  bacaSumber,
  korpusSiap,
  pelajariKorpus,
  pergeseranBelumDiputus,
  putuskanPergeseran,
  statistikKorpus,
  tarikSeluruhBlangko,
} = await import("@/server/modules/aleta-ecourt/korpus-blangko");

/**
 * Korpus blangko (Tahap 1).
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - korpus yang tidak dapat menyusun ulang sumbernya sendiri TIDAK DISIMPAN;
 *   - pergeseran tidak pernah digabung mesin, dan keputusan manusia atasnya
 *     BERTAHAN walau korpus dipelajari ulang;
 *   - membaca korpus tidak menyentuh ABT sama sekali - itulah kemandiriannya.
 */

let db: AletaDatabase | null = null;

async function basisData() {
  db = await createAletaDatabase({ useInMemory: true, seed: false, runMigrations: false });
  return db;
}

afterEach(async () => {
  await db?.close?.();
  db = null;
});

beforeEach(() => panggil.mockReset());

const BERKAS = [
  {
    jalur: "berita_acara_sidang/1 BAS Pertama Standar/04-a. BAS Pertama P Hadir _ T Tidak Hadir - Tunda Panggil T.PA.Mj.rtf",
    alinea: [
      "BERITA ACARA SIDANG",
      "Selanjutnya Ketua Majelis memeriksa identitas #0046#, yang ternyata identitas #0046# sesuai dengan surat #0053#;",
      "Kemudian Ketua Majelis berusaha mendamaikan dengan cara menasehati #0046#, namun tidak berhasil;",
    ],
    penanda: ["0046", "0053"],
    besarByte: 1000,
  },
  {
    jalur: "berita_acara_sidang/1 BAS Pertama Standar/05-a. BAS Pertama P Tidak Hadir _ T Hadir - Tunda Panggi P.PAmj.rtf",
    alinea: [
      "BERITA ACARA SIDANG",
      "Selanjutnya Ketua Majelis memeriksa identitas #0047#, yang ternyata identitas #0047# sesuai dengan surat #0053#;",
      "Oleh karena #4046# tidak hadir, maka Ketua Majelis menunda sidang untuk memanggil #0046#;",
    ],
    penanda: ["0046", "0047", "0053", "4046"],
    besarByte: 1100,
  },
  {
    jalur: "RELAAS PA DONGGALA/RELASS ECOURT PENGGUGAT - PEMOHON.rtf",
    alinea: [
      "RELAAS PANGGILAN SIDANG",
      "Pada hari ini #0032# tanggal #0033# saya, #6032# pada Pengadilan Agama Donggala, telah memanggil #0046#;",
    ],
    penanda: ["0032", "0033", "0046", "6032"],
    besarByte: 700,
  },
];

describe("mempelajari korpus", () => {
  it("menyimpan blok, susunan, dan dimensi", async () => {
    const basis = await basisData();
    const hasil = await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });

    expect(hasil.ok).toBe(true);
    expect(hasil.jumlahBerkas).toBe(3);
    expect(hasil.jumlahGagalSusun).toBe(0);

    const statistik = await statistikKorpus(basis);
    expect(statistik.jumlahBerkas).toBe(3);
    expect(statistik.perJenis.find((x) => x.jenis === "bas")?.jumlah).toBe(2);
    expect(statistik.perJenis.find((x) => x.jenis === "relaas")?.jumlah).toBe(1);
  });

  it("alinea yang sama di dua blangko disimpan sebagai satu blok", async () => {
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });

    const baris = await basis.queryOne<Record<string, unknown>>(
      `SELECT jumlah_pakai FROM aleta_blok_kalimat WHERE teks = ?`,
      ["BERITA ACARA SIDANG"]
    );
    expect(Number(baris?.jumlah_pakai)).toBe(2);
  });

  it("tiap blangko dapat disusun kembali persis dari korpus", async () => {
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });

    for (const b of BERKAS) {
      const sumber = await bacaSumber(basis, b.jalur);
      expect(sumber?.utuh, b.jalur).toBe(true);
      expect(sumber?.naskah, b.jalur).toEqual(b.alinea);
    }
  });

  it("dimensi keadaan tersimpan beserta kuncinya", async () => {
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });

    const sumber = await bacaSumber(basis, BERKAS[0].jalur);
    expect(sumber?.dimensi.kehadiranPihak1).toBe("hadir");
    expect(sumber?.dimensi.kehadiranPihak2).toBe("tidak-hadir");
    expect(sumber?.dimensi.akibat).toBe("tunda-panggil-pihak2");
  });

  it("dua blangko berdimensi beda menempati sel matriks yang beda", async () => {
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });
    expect((await statistikKorpus(basis)).selMatriks).toBe(3);
  });
});

describe("korpus yang cacat tidak disimpan", () => {
  it("tanpa satu pun blangko terbaca, pembelajaran dibatalkan", async () => {
    const basis = await basisData();
    const hasil = await pelajariKorpus(basis, { berkas: [], oleh: "admin" });

    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toMatch(/tidak satu pun/i);
    expect((await statistikKorpus(basis)).jumlahBerkas).toBe(0);
    expect((await statistikKorpus(basis)).pembelajaranTerakhir?.keadaan).toBe("gagal");
  });

  it("blangko yang gagal dibaca jembatan tidak ikut dipelajari", async () => {
    const basis = await basisData();
    const hasil = await pelajariKorpus(basis, {
      berkas: [...BERKAS, { jalur: "rusak.rtf", alinea: [], ada: false, sebab: "Blangko tidak terbaca." }],
      oleh: "admin",
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.jumlahBerkas).toBe(3);
  });

  it("korpus lama diganti, tidak bercampur dengan yang baru", async () => {
    // Korpus yang bercampur akan menyusun blangko dari dua kenyataan sekaligus.
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });
    await pelajariKorpus(basis, { berkas: [BERKAS[2]], oleh: "admin" });

    const statistik = await statistikKorpus(basis);
    expect(statistik.jumlahBerkas).toBe(1);
    expect(await bacaSumber(basis, BERKAS[0].jalur)).toBeNull();
  });
});

describe("pergeseran", () => {
  it("terdeteksi dan menunggu diputus, tidak digabung sendiri", async () => {
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });

    const daftar = await pergeseranBelumDiputus(basis);
    const geser = daftar.find((g) => g.bentuk.includes("memeriksa identitas"));
    expect(geser).toBeDefined();
    expect(geser?.varian.length).toBe(2);
    // Kedua bunyinya tetap ada sebagai blok terpisah.
    for (const v of geser?.varian ?? []) {
      const ada = await basis.queryOne(`SELECT sidik FROM aleta_blok_kalimat WHERE sidik = ?`, [v.sidik]);
      expect(ada).toBeTruthy();
    }
  });

  it("keputusan menuntut penyebutan siapa yang mengambilnya", async () => {
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });
    const geser = (await pergeseranBelumDiputus(basis))[0];

    const tanpaNama = await putuskanPergeseran(basis, {
      id: geser.id,
      blokTerpilih: geser.varian[0].sidik,
      alasan: "",
      oleh: "",
    });
    expect(tanpaNama.ok).toBe(false);
    expect(tanpaNama.sebab).toMatch(/siapa yang mengambilnya/i);
  });

  it("blok di luar varian ditolak", async () => {
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });
    const geser = (await pergeseranBelumDiputus(basis))[0];

    const salah = await putuskanPergeseran(basis, {
      id: geser.id,
      blokTerpilih: "sidik-yang-bukan-varian",
      alasan: "",
      oleh: "Ketua",
    });
    expect(salah.ok).toBe(false);
    expect(salah.sebab).toMatch(/bukan salah satu varian/i);
  });

  it("keputusan BERTAHAN walau korpus dipelajari ulang", async () => {
    // Keputusan tentang bunyi kalimat hukum tidak boleh hilang hanya karena
    // korpusnya disusun ulang dari sumber yang sama.
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });
    const geser = (await pergeseranBelumDiputus(basis))[0];

    const putus = await putuskanPergeseran(basis, {
      id: geser.id,
      blokTerpilih: geser.varian[0].sidik,
      alasan: "Bunyi yang dipakai putusan terakhir.",
      oleh: "Ketua Majelis",
    });
    expect(putus.ok).toBe(true);

    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });

    const sesudah = await basis.queryOne<Record<string, unknown>>(
      `SELECT keadaan, diputus_oleh, alasan FROM aleta_blok_geser WHERE id = ?`,
      [geser.id]
    );
    expect(String(sesudah?.keadaan)).toBe("diputus");
    expect(String(sesudah?.diputus_oleh)).toBe("Ketua Majelis");
    expect(String(sesudah?.alasan)).toContain("putusan terakhir");
  });
});

describe("membaca korpus tidak menyentuh ABT", () => {
  it("sesudah dipelajari, pembacaan tidak memanggil jembatan sama sekali", async () => {
    const basis = await basisData();
    await pelajariKorpus(basis, { berkas: BERKAS, oleh: "admin" });

    panggil.mockReset();
    panggil.mockImplementation(async () => ({ ok: true, data: null }));

    expect((await bacaSumber(basis, BERKAS[0].jalur))?.utuh).toBe(true);
    expect((await statistikKorpus(basis)).jumlahBerkas).toBe(3);
    expect((await korpusSiap(basis)).siap).toBe(true);
    expect(panggil).not.toHaveBeenCalled();
  });

  it("korpus yang belum dipelajari menyatakan dirinya belum siap", async () => {
    const basis = await basisData();
    const keadaan = await korpusSiap(basis);
    expect(keadaan.siap).toBe(false);
    expect(keadaan.sebab).toMatch(/belum pernah dipelajari/i);
  });
});

describe("menarik seluruh blangko dari jembatan", () => {
  it("menelusuri pohon lalu mengambil alinea per kelompok", async () => {
    panggil.mockImplementation(async (operasi: string, params: Record<string, unknown>) => {
      if (operasi === "blangko.pohon") {
        return { ok: true, data: { ada: true, berkas: [{ jalur: "a.rtf" }, { jalur: "b.rtf" }] } };
      }
      if (operasi === "blangko.alinea") {
        const jalur = (params.jalur as string[]) ?? [];
        return { ok: true, data: { ada: true, berkas: jalur.map((j) => ({ jalur: j, ada: true, alinea: ["satu"], penanda: [] })) } };
      }
      return { ok: true, data: null };
    });

    const hasil = await tarikSeluruhBlangko();
    expect(hasil.ok).toBe(true);
    expect(hasil.berkas).toHaveLength(2);
  });

  it("pohon kosong dianggap gagal, bukan berhasil dengan nol berkas", async () => {
    // Nol berkas dari folder berisi 807 blangko berarti ada yang salah pada
    // sambungannya. Menganggapnya berhasil akan mengosongkan korpus yang benar.
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "blangko.pohon") return { ok: true, data: { ada: true, berkas: [] } };
      return { ok: true, data: null };
    });

    const hasil = await tarikSeluruhBlangko();
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toMatch(/kosong/i);
  });

  it("kelompok yang gagal menghentikan penarikan, bukan dilewati", async () => {
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "blangko.pohon") return { ok: true, data: { ada: true, berkas: [{ jalur: "a.rtf" }] } };
      if (operasi === "blangko.alinea") return { ok: true, data: { ada: false, sebab: "Jembatan putus." } };
      return { ok: true, data: null };
    });

    const hasil = await tarikSeluruhBlangko();
    expect(hasil.ok).toBe(false);
    expect(hasil.sebab).toMatch(/Jembatan putus/i);
  });
});
