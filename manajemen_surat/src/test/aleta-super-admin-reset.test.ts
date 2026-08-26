// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { createManagedUserInDb, lookupUserForLoginInDb } from "@/server/modules/users/service";
import { hashSecret } from "@/server/shared/security";

/**
 * Kontrak yang diandalkan skrip pemulihan darurat super-admin
 * (scripts/aleta-reset-super-admin.sh).
 *
 * Skrip itu berjalan di host lewat psql, jadi tidak bisa dieksekusi di sini.
 * Yang diuji adalah PERJANJIANNYA dengan lapisan data: bila password akun
 * kredensial diisi hashSecret(passwordBaru) dan akun diaktifkan kembali, maka
 * super-admin yang tadinya terkunci bisa login lagi.
 *
 * Bila suatu saat cara hashing/verifikasi login diubah, uji ini akan gagal —
 * itu sinyal bahwa skrip pemulihan harus ikut disesuaikan, sebelum ada satker
 * yang benar-benar terkunci dan mendapati skripnya tidak lagi manjur.
 */
let db: AletaDatabase | null = null;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function buatSuperAdmin() {
  return createManagedUserInDb(db!, "usr-super", {
    username: "adminpulih",
    password: "PasswordLama123",
    email: "adminpulih@pa.go.id",
    whatsappNumber: "628123400001",
    name: "Admin Pemulihan",
    nip: "199001012020121001",
    positionId: "pos-ketua",
    roleOverride: "super-admin",
  });
}

async function bacaPasswordAkun(userId: string) {
  const row = await db!
    .prepare(`SELECT password FROM accounts WHERE provider_id = 'credential' AND user_id = ? LIMIT 1`)
    .get<{ password: string | null }>(userId);
  return row?.password ?? null;
}

/** Meniru efek data dari skrip pemulihan. */
async function terapkanPemulihan(userId: string, email: string, passwordBaru: string) {
  const hash = hashSecret(passwordBaru);
  const now = new Date().toISOString();

  await db!
    .prepare(`UPDATE accounts SET password = ?, updated_at = ? WHERE provider_id = 'credential' AND user_id = ?`)
    .run(hash, now, userId);

  // Bila belum ada akun kredensial, buatkan (sama seperti cabang INSERT skrip).
  const adaAkun = await bacaPasswordAkun(userId);
  if (adaAkun === null) {
    await db!
      .prepare(
        `INSERT INTO accounts (id, account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES (?, ?, 'credential', ?, ?, ?, ?)`
      )
      .run(`acc-pulih-${userId}`, email, userId, hash, now, now);
  }

  await db!.prepare(`UPDATE users SET password_hash = ?, is_active = 1, updated_at = ? WHERE id = ?`).run(hash, now, userId);
}

describe("pemulihan darurat super-admin", () => {
  it("super-admin yang diblokir bisa login lagi setelah pemulihan", async () => {
    const admin = await buatSuperAdmin();

    // Terkunci: diblokir.
    await db!.prepare(`UPDATE users SET is_active = 0 WHERE id = ?`).run(admin.id);
    await expect(lookupUserForLoginInDb(db!, { identifier: "adminpulih" })).resolves.toBeNull();
    await expect(requireActorUser(db!, admin.id)).rejects.toThrow(/nonaktif|tidak valid/i);

    // Pemulihan.
    await terapkanPemulihan(admin.id, admin.email, "PasswordBaru#2026");

    // Bisa ditemukan untuk login lagi, dan sesi diterima.
    const ditemukan = await lookupUserForLoginInDb(db!, { identifier: "adminpulih" });
    expect(ditemukan?.id).toBe(admin.id);
    await expect(requireActorUser(db!, admin.id)).resolves.toMatchObject({ id: admin.id });
  });

  it("password akun cocok dengan yang diperiksa login (hashSecret), password lama tak berlaku", async () => {
    const admin = await buatSuperAdmin();

    await terapkanPemulihan(admin.id, admin.email, "PasswordBaru#2026");

    const tersimpan = await bacaPasswordAkun(admin.id);
    // Login memverifikasi hashSecret(password) === accounts.password.
    expect(tersimpan).toBe(hashSecret("PasswordBaru#2026"));
    expect(tersimpan).not.toBe(hashSecret("PasswordLama123"));
  });

  it("membuat akun kredensial bila entah bagaimana belum ada", async () => {
    const admin = await buatSuperAdmin();

    // Hapus akun kredensialnya untuk mensimulasikan data yang tidak lengkap.
    await db!.prepare(`DELETE FROM accounts WHERE provider_id = 'credential' AND user_id = ?`).run(admin.id);
    expect(await bacaPasswordAkun(admin.id)).toBeNull();

    await terapkanPemulihan(admin.id, admin.email, "PasswordBaru#2026");

    expect(await bacaPasswordAkun(admin.id)).toBe(hashSecret("PasswordBaru#2026"));
  });
});
