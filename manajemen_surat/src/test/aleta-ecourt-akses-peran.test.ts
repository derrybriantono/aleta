// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  KAPABILITAS_EKSTENSI,
  bacaAksesEkstensi,
  kapabilitasPeran,
  pastikanKapabilitas,
  simpanAksesEkstensi,
} from "@/server/modules/aleta-ecourt/akses";
import { createManagedUserInDb } from "@/server/modules/users/service";

/**
 * Akses ekstensi ALETA E-Court per peran.
 *
 * Yang dijaga di sini:
 *
 *   - Super Admin dan Admin selalu berkemampuan penuh, dan tidak dapat
 *     dibatasi lewat jalur mana pun,
 *   - peran lain benar-benar ditolak ketika kemampuannya dimatikan,
 *   - hanya Super Admin dan Admin yang boleh mengubah pengaturannya,
 *   - pengaturan yang sudah disunting tidak pernah dikembalikan ke bawaan.
 *
 * Yang TIDAK boleh terjadi: pemasangan baru yang tabelnya masih kosong menolak
 * semua orang. Ekstensi yang mati total sampai ada yang membuka halaman
 * pengaturan akan terbaca sebagai aplikasi rusak, bukan sebagai penjagaan.
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
 * Membuat akun untuk satu peran.
 *
 * Peran manual hanya diizinkan untuk Super Admin dan Admin - peran lain harus
 * datang dari jabatannya. Karena itu hakim dibuat lewat pos-hakim, bukan lewat
 * roleOverride, dan perannya diperiksa supaya uji ini tidak diam-diam menguji
 * peran yang keliru bila pemetaan jabatan berubah.
 */
async function buatPegawai(positionId: string, roleOverride?: "super-admin" | "admin") {
  urutan += 1;
  // Aktornya super admin bawaan hasil penyemaian - pembuatan akun memang
  // menuntut aktor berwenang, dan itu bukan yang sedang diuji di sini.
  return createManagedUserInDb(db!, "usr-super", {
    roleOverride: roleOverride ?? null,
    username: `pengguna${urutan}`,
    password: "rahasia123",
    email: `pengguna${urutan}@pa.go.id`,
    whatsappNumber: `62812345${String(2000 + urutan)}`,
    name: `Pegawai ${urutan}`,
    nip: `19940102201712${String(2000 + urutan)}`,
    positionId,
    isActive: true,
  });
}

const buatSuperAdmin = () => buatPegawai("pos-ketua", "super-admin");
const buatAdmin = () => buatPegawai("pos-ketua", "admin");
const buatHakim = () => buatPegawai("pos-hakim");

describe("akses ekstensi ALETA E-Court", () => {
  it("Super Admin dan Admin selalu berkemampuan penuh", async () => {
    for (const roleId of ["super-admin", "admin"] as const) {
      const kemampuan = await kapabilitasPeran(db!, roleId);
      for (const kapabilitas of KAPABILITAS_EKSTENSI) {
        expect(kemampuan[kapabilitas]).toBe(true);
      }
    }
  });

  it("menolak upaya membatasi Super Admin maupun Admin", async () => {
    const superAdmin = await buatSuperAdmin();

    for (const roleId of ["super-admin", "admin"] as const) {
      await expect(
        simpanAksesEkstensi(db!, {
          actorUserId: superAdmin.id,
          roleId,
          kapabilitas: "berkas",
          aktif: false,
        })
      ).rejects.toThrow();

      // Ditolak di titik penyimpanan berarti kemampuannya juga tidak berubah.
      const kemampuan = await kapabilitasPeran(db!, roleId);
      expect(kemampuan.berkas).toBe(true);
    }
  });

  it("memberi kemampuan bawaan walau tabelnya masih kosong", async () => {
    // Pemasangan baru: belum ada yang membuka halaman pengaturan sama sekali.
    const hakim = await kapabilitasPeran(db!, "hakim");
    expect(hakim.panel).toBe(true);
    expect(hakim.berkas).toBe(true);

    // Peran yang tidak memegang perkara tetap melihat panel - sebelum
    // pembaruan ini mereka memang sudah bisa - tetapi tidak mengunduh berkas.
    const staf = await kapabilitasPeran(db!, "staf");
    expect(staf.panel).toBe(true);
    expect(staf.berkas).toBe(false);
  });

  it("menolak peran yang kemampuannya dimatikan", async () => {
    const admin = await buatAdmin();
    const hakim = await buatHakim();
    expect(hakim.roleId).toBe("hakim");

    // Sebelum dimatikan: boleh.
    await expect(pastikanKapabilitas(db!, hakim.id, "berkas")).resolves.toBeTruthy();

    await simpanAksesEkstensi(db!, {
      actorUserId: admin.id,
      roleId: "hakim",
      kapabilitas: "berkas",
      aktif: false,
    });

    await expect(pastikanKapabilitas(db!, hakim.id, "berkas")).rejects.toThrow();

    // Kemampuan LAIN tidak ikut mati - mematikan unduhan tidak boleh diam-diam
    // mencabut panelnya juga.
    await expect(pastikanKapabilitas(db!, hakim.id, "panel")).resolves.toBeTruthy();
  });

  it("tetap meloloskan Super Admin walau perannya dimatikan di tabel", async () => {
    const superAdmin = await buatSuperAdmin();

    // Menulis langsung ke tabel, melewati penjagaan simpanAksesEkstensi -
    // meniru baris yang tertulis keliru, bukan lewat antarmuka.
    await db!
      .prepare(
        "INSERT INTO ecourt_extension_access (role_id, capability, enabled, updated_at) " +
          "VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(role_id, capability) DO UPDATE SET enabled = excluded.enabled"
      )
      .run("super-admin", "berkas", 0, new Date().toISOString());

    // Inilah sebab kewenangan admin tidak dibaca dari database: satu baris
    // keliru tidak boleh mengunci administrasi keluar dari pengaturannya.
    await expect(pastikanKapabilitas(db!, superAdmin.id, "berkas")).resolves.toBeTruthy();
  });

  it("hanya Super Admin dan Admin yang boleh mengubah pengaturan", async () => {
    const hakim = await buatHakim();

    await expect(
      simpanAksesEkstensi(db!, {
        actorUserId: hakim.id,
        roleId: "staf",
        kapabilitas: "berkas",
        aktif: true,
      })
    ).rejects.toThrow();
  });

  it("menolak kemampuan yang tidak dikenali", async () => {
    const admin = await buatAdmin();

    await expect(
      simpanAksesEkstensi(db!, {
        actorUserId: admin.id,
        roleId: "hakim",
        kapabilitas: "hapus-segalanya",
        aktif: true,
      })
    ).rejects.toThrow();
  });

  it("tidak mengembalikan pengaturan yang sudah disunting ke bawaan", async () => {
    const admin = await buatAdmin();

    await simpanAksesEkstensi(db!, {
      actorUserId: admin.id,
      roleId: "hakim",
      kapabilitas: "berkas",
      aktif: false,
    });

    // Membaca ulang menjalankan penyemaian lagi. Bila penyemaian menimpa,
    // pengalihan yang sengaja dimatikan akan menyala kembali tanpa ada yang
    // menyalakannya.
    await bacaAksesEkstensi(db!);
    await bacaAksesEkstensi(db!);

    const kemampuan = await kapabilitasPeran(db!, "hakim");
    expect(kemampuan.berkas).toBe(false);
  });

  it("menandai peran yang selalu penuh pada matriks pengaturan", async () => {
    const matriks = await bacaAksesEkstensi(db!);

    const superAdmin = matriks.find((baris) => baris.roleId === "super-admin");
    expect(superAdmin?.selaluPenuh).toBe(true);

    const hakim = matriks.find((baris) => baris.roleId === "hakim");
    expect(hakim?.selaluPenuh).toBe(false);
  });
});
