// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  ATURAN_BAWAAN,
  bacaAturanPenunjukan,
  bacaHariSidang,
  bacaPengaturanPenunjukan,
  simpanAturanPenunjukan,
  simpanHariSidang,
} from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import {
  URUTAN_PENGISIAN,
  bacaPetaMedan,
  borangSiap,
  catatPengisian,
  hapusMedanBorang,
  ringkasanPengisian,
  simpanMedanBorang,
  tandaiHasilPengisian,
} from "@/server/modules/aleta-ecourt/penunjukan-pengisian";
import { createManagedUserInDb } from "@/server/modules/users/service";

/**
 * Peta medan borang, aturan penunjukan, dan catatan pengisian.
 *
 * Yang dijaga di sini:
 *
 *   - urutan pengisian tidak dapat dibalik - SIPP menolak PPP dan PJS selama
 *     majelisnya belum ditetapkan,
 *   - borang yang petanya setengah jadi TIDAK dinyatakan siap,
 *   - simpan otomatis bawaannya mati, dan hanya "nyala" yang menyalakannya,
 *   - catatan pengisian menyimpan asal tiap nilai, sehingga pertanyaan
 *     "seberapa sering usulannya diubah" dapat dijawab dengan angka,
 *   - hanya Super Admin dan Admin yang boleh menyunting petanya.
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

/**
 * Membuat akun untuk satu jabatan.
 *
 * Aktornya super admin bawaan hasil penyemaian - pembuatan akun memang menuntut
 * aktor berwenang, dan itu bukan yang sedang diuji di sini. Peran manual hanya
 * sah untuk Super Admin dan Admin; peran lain datang dari jabatannya.
 */
async function buatPegawai(positionId: string, roleOverride?: "super-admin" | "admin") {
  urutan += 1;
  const hasil = await createManagedUserInDb(db as AletaDatabase, "usr-super", {
    roleOverride: roleOverride ?? null,
    username: `ujiisi${urutan}`,
    password: "rahasia123",
    email: `ujiisi${urutan}@pa.go.id`,
    whatsappNumber: `62812945${String(3000 + urutan)}`,
    name: `Pegawai Uji ${urutan}`,
    nip: `19940102201713${String(3000 + urutan)}`,
    positionId,
    isActive: true,
  });
  return hasil.id;
}

const buatAdmin = () => buatPegawai("pos-ketua", "admin");
const buatPanitera = () => buatPegawai("pos-panitera");

describe("urutan pengisian penunjukan", () => {
  it("PMH lebih dulu, PHS terakhir", () => {
    // Bukan pilihan yang lebih aman - ini urutan yang diterima SIPP sama
    // sekali. PPP dan PJS keduanya menunjuk ke majelis yang sudah ada.
    expect(URUTAN_PENGISIAN).toEqual(["pmh", "ppp", "pjs", "phs"]);
  });
});

describe("peta medan borang", () => {
  it("borang tanpa peta dinyatakan belum siap", async () => {
    const hasil = await borangSiap(db as AletaDatabase, "pmh");
    expect(hasil.siap).toBe(false);
    expect(hasil.alasan).toBe("peta_medan_belum_diisi");
  });

  it("borang yang medan wajibnya belum berpenunjuk juga belum siap", async () => {
    const admin = await buatAdmin();
    await simpanMedanBorang(db as AletaDatabase, {
      actorUserId: admin,
      borang: "pmh",
      medan: "hakim_ketua",
      penunjuk: "",
      jenis: "pilih",
      wajib: true,
    });

    const hasil = await borangSiap(db as AletaDatabase, "pmh");
    // Mengisi separuh borang lalu menyerahkan sisanya ke petugas menghasilkan
    // borang yang tidak jelas siapa yang mengisinya.
    expect(hasil.siap).toBe(false);
    expect(hasil.alasan).toContain("hakim_ketua");
  });

  it("borang yang lengkap dinyatakan siap", async () => {
    const admin = await buatAdmin();
    await simpanMedanBorang(db as AletaDatabase, {
      actorUserId: admin,
      borang: "pmh",
      medan: "hakim_ketua",
      penunjuk: "#hakim_ketua",
      jenis: "pilih",
      wajib: true,
    });

    const hasil = await borangSiap(db as AletaDatabase, "pmh");
    expect(hasil.siap).toBe(true);
    expect(hasil.medan).toHaveLength(1);
  });

  it("menolak borang dan jenis medan yang tidak dikenali", async () => {
    const admin = await buatAdmin();
    await expect(
      simpanMedanBorang(db as AletaDatabase, {
        actorUserId: admin,
        borang: "borang-karangan",
        medan: "x",
        penunjuk: "#x",
        jenis: "teks",
      })
    ).rejects.toThrow(/tidak dikenali/i);

    await expect(
      simpanMedanBorang(db as AletaDatabase, {
        actorUserId: admin,
        borang: "pmh",
        medan: "x",
        penunjuk: "#x",
        jenis: "jenis-karangan",
      })
    ).rejects.toThrow(/tidak dikenali/i);
  });

  it("hanya Super Admin dan Admin yang boleh menyunting petanya", async () => {
    const panitera = await buatPanitera();
    await expect(
      simpanMedanBorang(db as AletaDatabase, {
        actorUserId: panitera,
        borang: "pmh",
        medan: "hakim_ketua",
        penunjuk: "#x",
        jenis: "pilih",
      })
    ).rejects.toThrow(/Super Admin/i);
  });

  it("dapat menghapus satu penunjuk", async () => {
    const admin = await buatAdmin();
    await simpanMedanBorang(db as AletaDatabase, {
      actorUserId: admin,
      borang: "ppp",
      medan: "panitera",
      penunjuk: "#panitera",
      jenis: "pilih",
    });
    expect(await bacaPetaMedan(db as AletaDatabase, "ppp")).toHaveLength(1);

    await hapusMedanBorang(db as AletaDatabase, {
      actorUserId: admin,
      borang: "ppp",
      medan: "panitera",
    });
    expect(await bacaPetaMedan(db as AletaDatabase, "ppp")).toHaveLength(0);
  });
});

describe("aturan penunjukan", () => {
  it("memakai bawaan ketika belum pernah diatur", async () => {
    const aturan = await bacaAturanPenunjukan(db as AletaDatabase);
    expect(aturan.jedaMinimalHari).toBe(10);
    expect(aturan.ambangNilaiSengketa).toBe(500_000_000);
    expect(aturan.kolamHakimTunggal).toBe("hakim");
  });

  it("simpan otomatis bawaannya MATI", async () => {
    const aturan = await bacaAturanPenunjukan(db as AletaDatabase);
    expect(aturan.simpanOtomatis).toBe("mati");
    expect(ATURAN_BAWAAN.simpanOtomatis).toBe("mati");
  });

  it("hanya nilai persis \"nyala\" yang menyalakan simpan otomatis", async () => {
    const admin = await buatAdmin();

    for (const percobaan of ["Nyala", "NYALA", "ya", "true", "1", "aktif"]) {
      await simpanAturanPenunjukan(db as AletaDatabase, {
        actorUserId: admin,
        kunci: "simpanOtomatis",
        nilai: percobaan,
      });
      const aturan = await bacaAturanPenunjukan(db as AletaDatabase);
      // Setelan sepenting ini tidak boleh menyala karena kekeliruan mengetik.
      expect(aturan.simpanOtomatis).toBe("mati");
    }

    await simpanAturanPenunjukan(db as AletaDatabase, {
      actorUserId: admin,
      kunci: "simpanOtomatis",
      nilai: "nyala",
    });
    expect((await bacaAturanPenunjukan(db as AletaDatabase)).simpanOtomatis).toBe("nyala");
  });

  it("menolak nilai yang tidak masuk akal dan kembali ke bawaan", async () => {
    const admin = await buatAdmin();
    await simpanAturanPenunjukan(db as AletaDatabase, {
      actorUserId: admin,
      kunci: "jedaMinimalHari",
      nilai: "-5",
    });
    // Jeda minus hari menetapkan sidang sebelum perkaranya didaftarkan.
    expect((await bacaAturanPenunjukan(db as AletaDatabase)).jedaMinimalHari).toBe(10);
  });

  it("menolak aturan yang tidak dikenali", async () => {
    const admin = await buatAdmin();
    await expect(
      simpanAturanPenunjukan(db as AletaDatabase, {
        actorUserId: admin,
        kunci: "aturanKarangan",
        nilai: "1",
      })
    ).rejects.toThrow(/tidak dikenali/i);
  });
});

describe("hari sidang dan panitera majelis", () => {
  it("memakai SK sebagai nilai awal", async () => {
    const daftar = await bacaHariSidang(db as AletaDatabase);
    const majelisB = daftar.find((x) => x.majelisKode === "B");
    expect(majelisB?.hari).toBe(2); // Selasa
    expect(majelisB?.namaHari).toBe("Selasa");
    expect(majelisB?.paniteraKode).toContain("D1");
    expect(majelisB?.bawaan).toBe(true);
  });

  it("yang tersimpan mengalahkan bawaannya", async () => {
    const admin = await buatAdmin();
    await simpanHariSidang(db as AletaDatabase, {
      actorUserId: admin,
      majelisKode: "B",
      hari: 4,
      paniteraKode: "D9",
    });

    const daftar = await bacaHariSidang(db as AletaDatabase);
    const majelisB = daftar.find((x) => x.majelisKode === "B");
    expect(majelisB?.hari).toBe(4);
    expect(majelisB?.paniteraKode).toEqual(["D9"]);
    expect(majelisB?.bawaan).toBe(false);
  });

  it("menolak hari di luar 0..6", async () => {
    const admin = await buatAdmin();
    await expect(
      simpanHariSidang(db as AletaDatabase, { actorUserId: admin, majelisKode: "B", hari: 9 })
    ).rejects.toThrow(/0 \(Minggu\)/);
  });

  it("majelis yang ditambahkan lewat menu ikut tampil", async () => {
    const admin = await buatAdmin();
    await simpanHariSidang(db as AletaDatabase, {
      actorUserId: admin,
      majelisKode: "C2",
      hari: 5,
      paniteraKode: "D7",
    });
    const daftar = await bacaHariSidang(db as AletaDatabase);
    expect(daftar.map((x) => x.majelisKode)).toContain("C2");
  });

  it("menyusun bentuk yang dikirim ke bot", async () => {
    const kirim = await bacaPengaturanPenunjukan(db as AletaDatabase);
    expect(kirim.hariSidang.B).toBe(2);
    expect(kirim.paniteraMajelis.B).toContain("D1");
    expect(kirim.aturan.jedaMinimalHari).toBe(10);
  });
});

describe("catatan pengisian", () => {
  it("mencatat tiap medan beserta asalnya, dan menandainya belum mendarat", async () => {
    const panitera = await buatPanitera();
    const hasil = await catatPengisian(db as AletaDatabase, {
      actorUserId: panitera,
      perkaraId: "468",
      nomorPerkara: "468/Pdt.G/2026/PA.Dgl",
      akunSipp: "sri.susilowati",
      baris: [
        { jenis: "pjs", medan: "jurusita", nilai: "Syukri", asal: "otomatis" },
        { jenis: "pjs", medan: "tanggal_penetapan", nilai: "2026-07-28", asal: "manual" },
      ],
    });

    expect(hasil.dicatat).toHaveLength(2);

    const ringkas = await ringkasanPengisian(db as AletaDatabase);
    const pjs = ringkas.find((x) => x.jenis === "pjs");
    expect(pjs?.otomatis).toBe(1);
    expect(pjs?.manual).toBe(1);
    // Belum diperiksa ke SIPP, jadi belum ada yang dinyatakan mendarat.
    expect(pjs?.mendarat).toBe(0);
    expect(pjs?.persenDiubah).toBe(50);
  });

  it("menandai hasil pemeriksaan balik", async () => {
    const panitera = await buatPanitera();
    const hasil = await catatPengisian(db as AletaDatabase, {
      actorUserId: panitera,
      perkaraId: "468",
      nomorPerkara: "468/Pdt.G/2026/PA.Dgl",
      akunSipp: "sri",
      baris: [{ jenis: "pmh", medan: "hakim_ketua", nilai: "Sudarmin", asal: "otomatis" }],
    });

    await tandaiHasilPengisian(db as AletaDatabase, {
      idBaris: hasil.dicatat,
      mendarat: "ya",
      tercatat: "pmh=2026-07-28",
    });

    const ringkas = await ringkasanPengisian(db as AletaDatabase);
    expect(ringkas.find((x) => x.jenis === "pmh")?.mendarat).toBe(1);
  });

  it("menandai tanpa baris tidak melakukan apa-apa", async () => {
    const hasil = await tandaiHasilPengisian(db as AletaDatabase, {
      idBaris: [],
      mendarat: "ya",
    });
    expect(hasil.ditandai).toBe(0);
  });
});
