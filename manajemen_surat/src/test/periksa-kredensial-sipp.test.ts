// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  KEADAAN_KREDENSIAL,
  periksaKredensialSipp,
  upsertExternalCredentialsForUser,
} from "@/server/modules/external-apps/service";
import { createManagedUserInDb } from "@/server/modules/users/service";

/**
 * Uji sandi SIPP saat disimpan.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - tiap sebab kegagalan punya NAMANYA SENDIRI. Satu nama untuk banyak sebab
 *     adalah cara paling ampuh membuat orang mengetik ulang sandi yang
 *     sebenarnya sudah benar, berkali-kali, tanpa pernah berhasil,
 *
 *   - bot yang mati TIDAK dinyatakan sebagai sandi salah - dan tidak
 *     menggagalkan penyimpanan,
 *
 *   - vonis lama DIBATALKAN begitu sandinya diganti. Tanda hijau yang
 *     tertinggal dari sandi yang sudah tidak dipakai lebih menyesatkan
 *     daripada tidak ada tanda sama sekali.
 */
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: vi.fn(),
}));

const { callAletaBotSippBridge } = await import("@/server/modules/aleta-sipp/aleta-sipp-datasource");
const jembatan = vi.mocked(callAletaBotSippBridge);

let db: AletaDatabase | null = null;
let urutan = 0;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  jembatan.mockReset();
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function buatPegawai() {
  urutan += 1;
  const hasil = await createManagedUserInDb(db as AletaDatabase, "usr-super", {
    roleOverride: null,
    username: `ujiperiksa${urutan}`,
    password: "rahasia123",
    email: `ujiperiksa${urutan}@pa.go.id`,
    whatsappNumber: `62812966${String(4000 + urutan)}`,
    name: `Pegawai Periksa ${urutan}`,
    nip: `19940102201715${String(4000 + urutan)}`,
    positionId: "pos-hakim",
    isActive: true,
  });
  return hasil.id;
}

async function simpanKredensial(userId: string, sandi = "sandi-sipp") {
  return upsertExternalCredentialsForUser(db as AletaDatabase, {
    actor: { id: "usr-super" },
    userId,
    credentials: [{ appId: "sipp", username: "derry briantono", password: sandi, isEnabled: true }],
  });
}

function jawabanBot(data: Record<string, unknown>) {
  jembatan.mockResolvedValue({ ok: true, data, bridge: {} } as never);
}

async function keadaanTersimpan(userId: string) {
  return (db as AletaDatabase)
    .prepare(
      `SELECT last_verified_status, last_verified_at FROM external_app_credentials
       WHERE user_id = ? AND app_id = 'sipp' LIMIT 1`
    )
    .get<{ last_verified_status: string; last_verified_at: string | null }>(userId);
}

describe("tiap sebab kegagalan disebut dengan namanya sendiri", () => {
  it("sandi cocok -> sah", async () => {
    const pegawai = await buatPegawai();
    jawabanBot({ ditemukan: true, cocok: true, diblokir: false });

    const hasil = await simpanKredensial(pegawai);
    expect(hasil?.keadaan).toBe(KEADAAN_KREDENSIAL.SAH);
    expect((await keadaanTersimpan(pegawai))?.last_verified_status).toBe(KEADAAN_KREDENSIAL.SAH);
  });

  it("sandi tidak cocok -> sandi salah, bukan tidak terdaftar", async () => {
    const pegawai = await buatPegawai();
    jawabanBot({ ditemukan: true, cocok: false });

    const hasil = await simpanKredensial(pegawai);
    expect(hasil?.keadaan).toBe(KEADAAN_KREDENSIAL.SANDI_SALAH);
    expect(hasil?.keterangan).toMatch(/diganti pemiliknya/i);
  });

  it("username tidak ada di SIPP -> tidak terdaftar, bukan sandi salah", async () => {
    // Salah ketik username akan terus terlihat sebagai "sandi salah" bila
    // keduanya disamakan, dan sandinya akan diganti-ganti sia-sia.
    const pegawai = await buatPegawai();
    jawabanBot({ ditemukan: false, cocok: false });

    const hasil = await simpanKredensial(pegawai);
    expect(hasil?.keadaan).toBe(KEADAAN_KREDENSIAL.TIDAK_TERDAFTAR);
    expect(hasil?.keterangan).toContain("derry briantono");
  });

  it("akun diblokir -> disebut diblokir walau sandinya benar", async () => {
    const pegawai = await buatPegawai();
    jawabanBot({ ditemukan: true, cocok: true, diblokir: true });

    const hasil = await simpanKredensial(pegawai);
    expect(hasil?.keadaan).toBe(KEADAAN_KREDENSIAL.DIBLOKIR);
    expect(hasil?.keterangan).toMatch(/benar, tetapi/i);
  });
});

describe("bot yang mati", () => {
  it("TIDAK dinyatakan sebagai sandi salah", async () => {
    const pegawai = await buatPegawai();
    jembatan.mockResolvedValue({ ok: false, error: "bridge tidak merespons", bridge: {} } as never);

    const hasil = await simpanKredensial(pegawai);
    expect(hasil?.keadaan).toBe(KEADAAN_KREDENSIAL.TIDAK_TERJANGKAU);
    expect(hasil?.keadaan).not.toBe(KEADAAN_KREDENSIAL.SANDI_SALAH);
  });

  it("tidak meninggalkan jejak seolah sudah diperiksa", async () => {
    const pegawai = await buatPegawai();
    jembatan.mockResolvedValue({ ok: false, error: "mati", bridge: {} } as never);

    await simpanKredensial(pegawai);
    expect((await keadaanTersimpan(pegawai))?.last_verified_at).toBeFalsy();
  });

  it("TIDAK menggagalkan penyimpanan sandinya", async () => {
    // Inilah yang paling menentukan. Sandi yang benar harus tetap tersimpan
    // walaupun pemeriksaannya tidak dapat dilakukan sama sekali.
    const pegawai = await buatPegawai();
    jembatan.mockRejectedValue(new Error("jaringan putus"));

    await expect(simpanKredensial(pegawai)).resolves.toBeUndefined();

    const baris = await (db as AletaDatabase)
      .prepare(
        `SELECT external_username, encrypted_password FROM external_app_credentials
         WHERE user_id = ? AND app_id = 'sipp' LIMIT 1`
      )
      .get<{ external_username: string; encrypted_password: string }>(pegawai);
    expect(baris?.external_username).toBe("derry briantono");
    expect(baris?.encrypted_password).toBeTruthy();
  });
});

describe("vonis lama dibatalkan saat kredensialnya berubah", () => {
  it("mengganti sandi menghapus tanda sah yang lama", async () => {
    const pegawai = await buatPegawai();
    jawabanBot({ ditemukan: true, cocok: true, diblokir: false });
    await simpanKredensial(pegawai, "sandi-lama");
    expect((await keadaanTersimpan(pegawai))?.last_verified_status).toBe(KEADAAN_KREDENSIAL.SAH);

    // Sandi diganti, dan kali ini pemeriksaannya tidak dapat dilakukan.
    jembatan.mockResolvedValue({ ok: false, error: "mati", bridge: {} } as never);
    await simpanKredensial(pegawai, "sandi-baru");

    // Yang TIDAK boleh terjadi: tetap "verified" dari pemeriksaan atas sandi
    // lama yang sudah tidak dipakai.
    expect((await keadaanTersimpan(pegawai))?.last_verified_status).not.toBe(
      KEADAAN_KREDENSIAL.SAH
    );
  });
});

describe("kredensial yang belum lengkap", () => {
  it("tidak dianggap salah, hanya belum diuji", async () => {
    const pegawai = await buatPegawai();
    const hasil = await periksaKredensialSipp(db as AletaDatabase, pegawai);

    expect(hasil.keadaan).toBe(KEADAAN_KREDENSIAL.BELUM_DIUJI);
    expect(jembatan).not.toHaveBeenCalled();
  });
});
