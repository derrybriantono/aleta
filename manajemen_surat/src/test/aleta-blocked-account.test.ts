// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { buildExternalAppLaunchHtml } from "@/server/modules/external-apps/service";
import {
  requireActorUser,
  resolveTargetRecipientFromDb,
  getUsersByEffectivePositionFromDb,
} from "@/server/modules/organization/service";
import { createManagedUserInDb, listUsersFromDb, lookupUserForLoginInDb } from "@/server/modules/users/service";
import { encryptCredentialSecret, hashMd5 } from "@/server/shared/security";

/**
 * Akun yang DIBLOKIR harus benar-benar putus dari seluruh ALETA, bukan sekadar
 * gagal login. Yang dijaga di sini:
 *
 *   - sesi berjalan ikut ditolak, bukan cuma pintu masuk,
 *   - namanya tidak lagi terbawa ke Manajemen Surat maupun jadi tujuan disposisi,
 *   - jembatan SSO ke SIPP/APS menolak,
 *   - namanya masuk daftar blokir yang dikirim ke ALETA Bot, supaya notifikasi
 *     yang mengambil nama dari SIPP tetap tidak mengirimi dia WhatsApp.
 *
 * Yang TIDAK boleh ikut hilang: akun yang diblokir tetap terlihat oleh admin di
 * Manajemen Akun - kalau tidak, tidak ada cara membuka blokirnya lagi.
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

async function buatPegawai(nama: string, aktif = true) {
  urutan += 1;
  const pegawai = await createManagedUserInDb(db!, "usr-super", {
    username: `pegawai${urutan}`,
    password: "rahasia123",
    email: `pegawai${urutan}@pa.go.id`,
    whatsappNumber: `62812345${String(1000 + urutan)}`,
    name: nama,
    nip: `19940102201712${String(1000 + urutan)}`,
    positionId: "pos-ketua",
    isActive: aktif,
  });
  return pegawai;
}

async function blokir(userId: string) {
  await db!.prepare(`UPDATE users SET is_active = 0 WHERE id = ?`).run(userId);
}

describe("akun diblokir kehilangan akses portal", () => {
  it("sesi yang sedang berjalan ikut ditolak, bukan hanya pintu login", async () => {
    const pegawai = await buatPegawai("Budi Santoso");
    await expect(requireActorUser(db!, pegawai.id)).resolves.toMatchObject({ id: pegawai.id });

    await blokir(pegawai.id);

    // Inti perbaikan: token yang sudah dipegang tidak boleh terus berlaku.
    await expect(requireActorUser(db!, pegawai.id)).rejects.toThrow(/nonaktif|tidak valid/i);
  });

  it("tidak bisa lagi masuk lewat pencarian identitas", async () => {
    const pegawai = await buatPegawai("Budi Santoso");
    await blokir(pegawai.id);

    await expect(lookupUserForLoginInDb(db!, { identifier: pegawai.username })).resolves.toBeNull();
  });

  it("jembatan SSO ke SIPP menolak akun yang diblokir", async () => {
    const pegawai = await buatPegawai("Budi Santoso");
    const waktu = new Date().toISOString();
    await db!.prepare(
      `INSERT INTO external_app_credentials (
        id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
        is_enabled, last_verified_status, password_updated_at, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, 'sipp', 'budi', ?, ?, 1, 'not_tested', ?, 'usr-super', 'usr-super', ?, ?)`
    ).run(`eac-blk-${urutan}`, pegawai.id, encryptCredentialSecret("x"), hashMd5("x"), waktu, waktu, waktu);

    await expect(
      buildExternalAppLaunchHtml(db!, {
        actor: { id: pegawai.id, name: pegawai.name, isActive: false },
        appId: "sipp",
      })
    ).rejects.toThrow(/tidak aktif/i);
  });
});

describe("akun diblokir hilang dari Manajemen Surat", () => {
  it("tidak bisa dipilih sebagai tujuan disposisi", async () => {
    const pegawai = await buatPegawai("Budi Santoso");
    await blokir(pegawai.id);

    // Ditunjuk langsung pun harus dialihkan, bukan diterima.
    const hasil = await resolveTargetRecipientFromDb(db!, {
      targetPositionId: "pos-ketua",
      targetUserId: pegawai.id,
    }).catch(() => null);

    expect(hasil?.id).not.toBe(pegawai.id);
  });

  it("tidak ikut terdaftar pada jabatannya", async () => {
    const pegawai = await buatPegawai("Budi Santoso");
    const sebelum = await getUsersByEffectivePositionFromDb(db!, "pos-ketua");
    expect(sebelum.some((item) => item.id === pegawai.id)).toBe(true);

    await blokir(pegawai.id);

    const sesudah = await getUsersByEffectivePositionFromDb(db!, "pos-ketua");
    expect(sesudah.some((item) => item.id === pegawai.id)).toBe(false);
  });

  it("tidak terlihat oleh pengguna biasa, tetapi TETAP terlihat admin", async () => {
    const pegawai = await buatPegawai("Budi Santoso");
    await blokir(pegawai.id);

    // Admin wajib tetap melihatnya, kalau tidak blokirnya tidak bisa dibuka lagi.
    const dilihatSuper = await listUsersFromDb(db!, "usr-super");
    expect(dilihatSuper.some((item) => item.id === pegawai.id)).toBe(true);

    const penglihat = await buatPegawai("Penglihat Biasa");
    const dilihatBiasa = await listUsersFromDb(db!, penglihat.id);
    expect(dilihatBiasa.some((item) => item.id === pegawai.id)).toBe(false);
  });
});

describe("daftar blokir yang dikirim ke ALETA Bot", () => {
  async function bacaKonfigurasiRuntime() {
    const { default: fs } = await import("fs/promises");
    const path = await import("path");
    const { syncAletaBotRuntimeConfigFromDb } = await import("@/server/modules/aleta-bot/service");
    await syncAletaBotRuntimeConfigFromDb(db!);
    const berkas = path.join(process.cwd(), "data", "aleta-bot-runtime.json");
    return JSON.parse(await fs.readFile(berkas, "utf8")) as {
      blockedRecipients?: { numbers: string[]; names: string[] };
    };
  }

  it("memuat nomor dan nama akun yang diblokir", async () => {
    const pegawai = await buatPegawai("DERRY BRIANTONO, S.H.");
    await blokir(pegawai.id);

    const konfigurasi = await bacaKonfigurasiRuntime();
    const blokir2 = konfigurasi.blockedRecipients;

    expect(blokir2?.numbers).toContain(pegawai.whatsappNumber);
    // Gelar dibuang supaya nama dari SIPP tetap cocok.
    expect(blokir2?.names).toContain("derry briantono");
  });

  it("tidak memuat pegawai yang masih aktif", async () => {
    const aktif = await buatPegawai("Budi Santoso");

    const konfigurasi = await bacaKonfigurasiRuntime();
    expect(konfigurasi.blockedRecipients?.numbers ?? []).not.toContain(aktif.whatsappNumber);
    expect(konfigurasi.blockedRecipients?.names ?? []).not.toContain("budi santoso");
  });
});
