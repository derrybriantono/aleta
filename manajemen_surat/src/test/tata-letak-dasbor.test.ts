// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  BATAS_KUNCI_PER_ZONA,
  BATAS_ZONA,
  bacaTataLetak,
  bersihkanSusunan,
  hapusTataLetak,
  simpanTataLetak,
} from "@/server/modules/portal/tata-letak-dasbor";
import { pindahkan, terapkanUrutan } from "@/components/portal/susunan-geser";
import { createManagedUserInDb } from "@/server/modules/users/service";

/**
 * Susunan kartu dasbor per pengguna.
 *
 * Yang dijaga di sini bukan seretan itu sendiri - itu menuntut tata letak
 * sungguhan dan diuji di e2e/dasbor-susun-kartu.spec.ts - melainkan aturan yang
 * membuat susunan tersimpan tidak pernah MENGHILANGKAN kartu:
 *
 *   - kunci tersimpan yang kartunya tidak ada diabaikan,
 *   - kartu baru yang belum pernah disusun muncul di akhir,
 *   - susunan orang lain tidak dapat disentuh lewat rute mana pun.
 */
let db: AletaDatabase | null = null;
let urutan = 0;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function buatPegawai() {
  urutan += 1;
  return createManagedUserInDb(db!, "usr-super", {
    roleOverride: null,
    username: `penyusun${urutan}`,
    password: "rahasia123",
    email: `penyusun${urutan}@pa.go.id`,
    whatsappNumber: `62812399${String(1000 + urutan)}`,
    name: `Penyusun ${urutan}`,
    nip: `19940102201799${String(1000 + urutan)}`,
    positionId: "pos-hakim",
    isActive: true,
  });
}

describe("terapkanUrutan: susunan tersimpan tidak boleh menghilangkan kartu", () => {
  const kartu = (kunci: string) => ({ kunci });
  const kunciDari = (x: { kunci: string }) => x.kunci;

  it("menyusun menurut urutan tersimpan", () => {
    const hasil = terapkanUrutan([kartu("a"), kartu("b"), kartu("c")], kunciDari, ["c", "a", "b"]);
    expect(hasil.map(kunciDari)).toEqual(["c", "a", "b"]);
  });

  it("kartu baru yang belum pernah disusun muncul di AKHIR, bukan hilang", () => {
    // Tanpa aturan ini, setiap kartu yang ditambahkan kemudian akan tidak
    // terlihat oleh semua orang yang pernah menyusun dasbornya - yaitu justru
    // pengguna yang paling sering memakainya.
    const hasil = terapkanUrutan([kartu("a"), kartu("baru"), kartu("b")], kunciDari, ["b", "a"]);
    expect(hasil.map(kunciDari)).toEqual(["b", "a", "baru"]);
  });

  it("kunci tersimpan yang kartunya tidak ada diabaikan", () => {
    // Kartu dapat hilang karena kewenangan dicabut atau kodenya dihapus.
    const hasil = terapkanUrutan([kartu("a"), kartu("b")], kunciDari, ["b", "sudah-tiada", "a"]);
    expect(hasil.map(kunciDari)).toEqual(["b", "a"]);
  });

  it("urutan kosong berarti memakai bawaan apa adanya", () => {
    const bawaan = [kartu("a"), kartu("b")];
    expect(terapkanUrutan(bawaan, kunciDari, [])).toBe(bawaan);
    expect(terapkanUrutan(bawaan, kunciDari, undefined)).toBe(bawaan);
  });

  it("tidak pernah menggandakan maupun menjatuhkan kartu", () => {
    const daftar = ["a", "b", "c", "d", "e"].map(kartu);
    for (const urutanCoba of [["e", "e", "a"], ["c"], ["z", "y"], ["d", "c", "b", "a", "e"]]) {
      const hasil = terapkanUrutan(daftar, kunciDari, urutanCoba).map(kunciDari);
      expect([...hasil].sort(), JSON.stringify(urutanCoba)).toEqual(["a", "b", "c", "d", "e"]);
    }
  });
});

describe("pindahkan", () => {
  it("memindahkan satu unsur tanpa mengubah yang lain", () => {
    expect(pindahkan(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(pindahkan(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("kedudukan yang sama atau di luar batas mengembalikan daftar yang sama", () => {
    const daftar = ["a", "b", "c"];
    expect(pindahkan(daftar, 1, 1)).toBe(daftar);
    expect(pindahkan(daftar, -1, 1)).toBe(daftar);
    expect(pindahkan(daftar, 0, 9)).toBe(daftar);
  });
});

describe("bersihkanSusunan: masukan dari peramban tidak dipercaya", () => {
  it("menerima bentuk yang sah", () => {
    expect(bersihkanSusunan({ ringkasan: ["surat-masuk", "tugas-masuk"] })).toEqual({
      ringkasan: ["surat-masuk", "tugas-masuk"],
    });
  });

  it("membuang kunci ganda - urutan kembar menggambar kartunya dua kali", () => {
    expect(bersihkanSusunan({ ringkasan: ["a", "a", "b"] })).toEqual({ ringkasan: ["a", "b"] });
  });

  it("membuang kunci dan zona yang bentuknya tidak sah", () => {
    const hasil = bersihkanSusunan({
      ringkasan: ["sah", "TIDAK SAH", "<script>", "juga-sah"],
      "Zona Salah": ["a"],
      bukanLarik: "a",
    });
    expect(hasil).toEqual({ ringkasan: ["sah", "juga-sah"] });
  });

  it("membatasi jumlah zona dan kunci", () => {
    const banyakZona: Record<string, string[]> = {};
    for (let i = 0; i < BATAS_ZONA + 8; i += 1) banyakZona[`zona${i}`] = ["a" + i];
    expect(Object.keys(bersihkanSusunan(banyakZona)).length).toBeLessThanOrEqual(BATAS_ZONA);

    const banyakKunci = Array.from({ length: BATAS_KUNCI_PER_ZONA + 15 }, (_, i) => `kartu-${i}`);
    expect(bersihkanSusunan({ ringkasan: banyakKunci }).ringkasan).toHaveLength(BATAS_KUNCI_PER_ZONA);
  });

  it("bukan obyek berarti belum pernah disusun", () => {
    expect(bersihkanSusunan(null)).toEqual({});
    expect(bersihkanSusunan(["a"])).toEqual({});
    expect(bersihkanSusunan("ringkasan")).toEqual({});
  });
});

describe("penyimpanan susunan", () => {
  it("tersimpan dan terbaca kembali untuk orang yang sama", async () => {
    const orang = await buatPegawai();
    await simpanTataLetak(db!, orang.id, "manajemen-surat", {
      ringkasan: ["tugas-masuk", "surat-masuk"],
      panel: ["aktivitas-terbaru", "tugas-penting"],
    });

    expect(await bacaTataLetak(db!, orang.id, "manajemen-surat")).toEqual({
      ringkasan: ["tugas-masuk", "surat-masuk"],
      panel: ["aktivitas-terbaru", "tugas-penting"],
    });
  });

  it("susunan satu orang tidak terbaca oleh orang lain", async () => {
    const satu = await buatPegawai();
    const dua = await buatPegawai();
    await simpanTataLetak(db!, satu.id, "manajemen-surat", { ringkasan: ["tugas-masuk"] });

    expect(await bacaTataLetak(db!, dua.id, "manajemen-surat")).toEqual({});
  });

  it("halaman yang berbeda disimpan terpisah", async () => {
    const orang = await buatPegawai();
    await simpanTataLetak(db!, orang.id, "manajemen-surat", { ringkasan: ["a"] });
    await simpanTataLetak(db!, orang.id, "panitera", { ringkasan: ["b"] });

    expect(await bacaTataLetak(db!, orang.id, "manajemen-surat")).toEqual({ ringkasan: ["a"] });
    expect(await bacaTataLetak(db!, orang.id, "panitera")).toEqual({ ringkasan: ["b"] });
  });

  it("menyimpan dua kali menimpa, bukan menumpuk", async () => {
    const orang = await buatPegawai();
    await simpanTataLetak(db!, orang.id, "manajemen-surat", { ringkasan: ["a", "b"] });
    await simpanTataLetak(db!, orang.id, "manajemen-surat", { ringkasan: ["b", "a"] });

    expect(await bacaTataLetak(db!, orang.id, "manajemen-surat")).toEqual({ ringkasan: ["b", "a"] });
  });

  it("dikembalikan ke bawaan dengan MENGHAPUS barisnya, bukan menyimpan bawaan", async () => {
    // Bawaan berubah ketika kartu baru ditambahkan; baris yang memuat "bawaan
    // hari ini" akan membekukan dasbor orang itu pada bawaan lama selamanya.
    const orang = await buatPegawai();
    await simpanTataLetak(db!, orang.id, "manajemen-surat", { ringkasan: ["a"] });
    await hapusTataLetak(db!, orang.id, "manajemen-surat");

    expect(await bacaTataLetak(db!, orang.id, "manajemen-surat")).toEqual({});
    const baris = await db!
      .prepare("SELECT user_id FROM tata_letak_dasbor WHERE user_id = ?")
      .all<{ user_id: string }>(orang.id);
    expect(baris).toHaveLength(0);
  });

  it("nama halaman yang aneh ditolak", async () => {
    const orang = await buatPegawai();
    await expect(
      simpanTataLetak(db!, orang.id, "../../etc", { ringkasan: ["a"] })
    ).rejects.toThrow(/halaman/i);
  });

  it("menuntut sesi yang sah", async () => {
    await expect(
      simpanTataLetak(db!, null, "manajemen-surat", { ringkasan: ["a"] })
    ).rejects.toThrow();
  });

  it("baris yang rusak diperlakukan seperti belum pernah disusun", async () => {
    // Satu baris setelan tampilan tidak boleh mematikan seluruh dasbor.
    const orang = await buatPegawai();
    await db!
      .prepare(
        "INSERT INTO tata_letak_dasbor (user_id, halaman, susunan_json, updated_at) VALUES (?, ?, ?, ?)"
      )
      .run(orang.id, "manajemen-surat", "{bukan json", new Date().toISOString());

    expect(await bacaTataLetak(db!, orang.id, "manajemen-surat")).toEqual({});
  });
});
