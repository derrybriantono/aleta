// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAletaDatabase } from "@/server/db/client";
import { __setelUlangKaitUntukUji, langkahKeduaTerdaftar, laporkanKeKesehatan, verifikasiLuarKantorTerdaftar } from "@/server/modules/keamanan/kait";
import { aturSubnetAktif, tambahSubnetKantor } from "@/server/modules/keamanan/jaringan";
import { sambungkanKaitKeamanan } from "@/server/modules/keamanan/sambung-kait";
import {
  authenticatorUntukAksiTersedia,
  buatKodeCadangan,
  konfirmasiAuthenticator,
  mulaiPendaftaranAuthenticator,
  periksaKodeAuthenticatorAksi,
  putuskanMasuk,
} from "@/server/modules/verifikasi/layanan";
import { kosongkanSinggahVerifikasi, simpanPengaturanVerifikasi, sumberJaringanKantor } from "@/server/modules/verifikasi/pengaturan";
import { kodeTotp } from "@/server/modules/verifikasi/totp";

/**
 * ============================================================================
 * GABUNG RANTAI E + BAGIAN 6 (26 Okt 2026): kait keamanan dan satu daftar jaringan kantor
 * ============================================================================
 *
 *   1. satu sumber jaringan kantor: tanpa jaringan aktif di Pengaturan Keamanan = daftar verifikasi sendiri
 *      (+ loopback, persis seperti dulu); ada jaringan aktif = GABUNGAN (union) kedua daftar + loopback, bukan
 *      saling menggantikan (keputusan Derry 26 Okt 2026)
 *   2. langkah kedua pengaman aksi: authenticator/kode cadangan, tersedia hanya bila saklar authenticator menyala
 *      DAN akun sudah mendaftar; kode tidak bisa dipakai ulang
 *   3. laporan uji pulih: hanya yang GAGAL masuk Catatan error Pusat kesehatan
 *   4. luar kantor wajib verifikasi (6b) SENGAJA tidak tersambung; instrumentation memanggil penyambung
 */

const ctx = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/lib/auth", () => ({
  getAuth: async () => {
    throw new Error("tanpa Better Auth di uji");
  },
}));
process.env.BETTER_AUTH_SECRET = "rahasia-uji-gabung-bukan-rahasia-sungguhan";

const KINI = new Date("2026-10-26T01:00:00.000Z");
const PERANGKAT = "33333333-3333-4333-8333-333333333333";
const IP_192 = "192.168.10.25";
const IP_LUAR = "36.70.1.2";

type Db = Awaited<ReturnType<typeof createAletaDatabase>>;
const db = () => ctx.db as Db;

function kosongkanSinggahJaringan() {
  (globalThis as { __aletaJaringanCache?: unknown }).__aletaJaringanCache = undefined;
}

beforeAll(async () => {
  const d = await createAletaDatabase({ useInMemory: true, seed: false });
  const kini = KINI.toISOString();
  for (const r of ["hakim", "admin", "super-admin"]) await d.run(`INSERT INTO roles (id, name, description) VALUES (?, ?, '')`, [r, r]);
  await d.run(`INSERT INTO positions (id, name, unit_kerja, level_hierarchy, created_at, updated_at) VALUES ('pos-uji', 'Uji', 'Uji', 1, ?, ?)`, [kini, kini]);
  for (const [id, peran, wa] of [
    ["u-sa", "super-admin", "081200000001"],
    ["u-admin", "admin", "081200000002"],
    ["u-hakim", "hakim", "081200000004"],
  ]) {
    await d.run(
      `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, ?, ?, 'pos-uji', ?, ?)`,
      [id, id, `Nama ${id}`, `${id}@rekaan.test`, wa, peran, kini, kini]
    );
  }
  ctx.db = d;
}, 300_000);

beforeEach(async () => {
  for (const t of [
    "aleta_ekstensi_setelan",
    "aleta_verifikasi_authenticator",
    "aleta_verifikasi_tantangan",
    "aleta_verifikasi_lolos",
    "aleta_verifikasi_kode_cadangan",
    "aleta_subnet_kantor",
    "aleta_catatan_galat_kejadian",
    "aleta_catatan_galat",
    "audit_logs",
  ]) {
    await db().run(`DELETE FROM ${t}`);
  }
  kosongkanSinggahVerifikasi();
  kosongkanSinggahJaringan();
  __setelUlangKaitUntukUji();
});

// Bawaan aturan semua peran = "mati" (26 Okt 2026): uji ini memilih "luar-kantor" untuk hakim secara eksplisit.
const nyalakan = (p: Record<string, unknown>) => simpanPengaturanVerifikasi(db(), { aturanPeran: { hakim: "luar-kantor" }, ...p }, { id: "u-sa", nama: "SA" }, KINI);
async function pasangAuthenticator(userId: string) {
  const { rahasia } = await mulaiPendaftaranAuthenticator(db(), { id: userId, username: userId }, KINI);
  await konfirmasiAuthenticator(db(), userId, kodeTotp(rahasia, KINI), KINI);
  return rahasia;
}
const kodePada = (rahasia: string, detikTambah: number) => kodeTotp(rahasia, new Date(KINI.getTime() + detikTambah * 1000));

describe("satu sumber jaringan kantor", () => {
  it("tanpa jaringan aktif di Pengaturan Keamanan: daftar verifikasi sendiri, persis seperti dulu", async () => {
    await nyalakan({ authenticator: true });
    await pasangAuthenticator("u-hakim");
    const s = await sumberJaringanKantor(db(), { subnetKantor: ["192.168.10.0/24"] });
    expect(s.sumber).toBe("verifikasi");
    // hakim = aturan "luar-kantor" (dipilih Super Admin): di kantor tanpa kode, di luar kantor dengan kode.
    expect(await putuskanMasuk(db(), { userId: "u-hakim", perangkatId: PERANGKAT, ip: IP_192, kini: KINI })).toMatchObject({ perlu: false, sebab: "dalam-kantor" });
    expect(await putuskanMasuk(db(), { userId: "u-hakim", perangkatId: PERANGKAT, ip: IP_LUAR, kini: KINI })).toMatchObject({ perlu: true, sebab: "luar-kantor" });
  });

  it("ada jaringan aktif di Pengaturan Keamanan: digabung (union) dengan daftar verifikasi, tidak saling menggantikan; loopback ikut", async () => {
    await nyalakan({ authenticator: true, subnetKantor: ["192.168.10.0/24"] });
    await pasangAuthenticator("u-hakim");
    await tambahSubnetKantor(db(), { cidr: "36.70.0.0/16", label: "kantor baru" }, "u-sa", KINI);
    kosongkanSinggahJaringan();
    const s = await sumberJaringanKantor(db(), { subnetKantor: ["192.168.10.0/24"] });
    expect(s.sumber).toBe("gabungan");
    expect(s.daftar).toEqual(expect.arrayContaining(["192.168.10.0/24", "36.70.0.0/16", "127.0.0.1/32", "::1/128"]));
    expect(s.daftar.length).toBe(new Set(s.daftar).size);
    // kedua daftar berlaku: 36.70.x (Keamanan) dan 192.168.10.x (verifikasi) sama-sama di kantor, loopback juga
    const putus = (ip: string) => putuskanMasuk(db(), { userId: "u-hakim", perangkatId: PERANGKAT, ip, kini: KINI });
    expect(await putus(IP_LUAR)).toMatchObject({ perlu: false, sebab: "dalam-kantor" });
    expect(await putus(IP_192)).toMatchObject({ perlu: false, sebab: "dalam-kantor" });
    expect(await putus("127.0.0.1")).toMatchObject({ perlu: false, sebab: "dalam-kantor" });
    // di luar keduanya tetap diminta kode; alamat kosong tetap di luar
    expect(await putus("8.8.8.8")).toMatchObject({ perlu: true, sebab: "luar-kantor" });
    expect(await putus("")).toMatchObject({ perlu: true, sebab: "luar-kantor" });
  });

  it("loopback tetap di kantor walau dihapus dari daftar verifikasi dan tanpa jaringan Keamanan", async () => {
    await nyalakan({ authenticator: true, subnetKantor: ["192.168.10.0/24"] });
    await pasangAuthenticator("u-hakim");
    const s = await sumberJaringanKantor(db(), { subnetKantor: ["192.168.10.0/24"] });
    expect(s.sumber).toBe("verifikasi");
    expect(s.daftar).toEqual(["192.168.10.0/24", "127.0.0.1/32", "::1/128"]);
    expect(await putuskanMasuk(db(), { userId: "u-hakim", perangkatId: PERANGKAT, ip: "127.0.0.1", kini: KINI })).toMatchObject({ perlu: false, sebab: "dalam-kantor" });
  });

  it("jaringan yang dinonaktifkan tidak dihitung; alamat kosong tetap di luar kantor", async () => {
    await nyalakan({ authenticator: true });
    await pasangAuthenticator("u-hakim");
    const baris = await tambahSubnetKantor(db(), { cidr: "36.70.0.0/16" }, "u-sa", KINI);
    await aturSubnetAktif(db(), baris, false);
    kosongkanSinggahJaringan();
    expect((await sumberJaringanKantor(db(), { subnetKantor: ["192.168.10.0/24"] })).sumber).toBe("verifikasi");
    expect(await putuskanMasuk(db(), { userId: "u-hakim", perangkatId: PERANGKAT, ip: "", kini: KINI })).toMatchObject({ perlu: true, sebab: "luar-kantor" });
  });
});

describe("langkah kedua pengaman aksi admin dari authenticator", () => {
  it("tanpa pendaftar kait: tidak ada; sesudah disambung: terdaftar, dan 6b sengaja tidak", () => {
    expect(langkahKeduaTerdaftar()).toBeNull();
    sambungkanKaitKeamanan();
    expect(langkahKeduaTerdaftar()?.nama).toBe("verifikasi-dua-langkah");
    expect(verifikasiLuarKantorTerdaftar()).toBeNull();
  });

  it("saklar authenticator mati atau akun belum mendaftar: tidak tersedia (tidak ada yang terkunci)", async () => {
    expect(await authenticatorUntukAksiTersedia(db(), "u-admin")).toBe(false);
    await nyalakan({ authenticator: true });
    expect(await authenticatorUntukAksiTersedia(db(), "u-admin")).toBe(false); // belum mendaftar
    await pasangAuthenticator("u-admin");
    expect(await authenticatorUntukAksiTersedia(db(), "u-admin")).toBe(true);
    await nyalakan({ authenticator: false, otpWhatsapp: true });
    expect(await authenticatorUntukAksiTersedia(db(), "u-admin")).toBe(false); // OTP WhatsApp saja tidak cukup untuk kotak konfirmasi
  });

  it("kode benar diterima sekali; dipakai ulang atau salah ditolak; kode cadangan sekali pakai; tercatat di audit", async () => {
    await nyalakan({ authenticator: true });
    const rahasia = await pasangAuthenticator("u-admin");
    sambungkanKaitKeamanan();
    const kait = langkahKeduaTerdaftar();
    const aktor = { id: "u-admin" } as never;
    const kode1 = kodePada(rahasia, 30);
    expect(await kait!.periksa(db(), aktor, "000000")).toBe(false);
    expect(await periksaKodeAuthenticatorAksi(db(), "u-admin", kode1, new Date(KINI.getTime() + 30_000))).toBe(true);
    expect(await periksaKodeAuthenticatorAksi(db(), "u-admin", kode1, new Date(KINI.getTime() + 31_000))).toBe(false);
    const cadangan = await buatKodeCadangan(db(), "u-admin", "u-sa", KINI);
    expect(await periksaKodeAuthenticatorAksi(db(), "u-admin", cadangan[0], KINI)).toBe(true);
    expect(await periksaKodeAuthenticatorAksi(db(), "u-admin", cadangan[0], KINI)).toBe(false);
    const audit = await db().queryAll<{ action: string; payload: string }>("SELECT action, payload_json AS payload FROM audit_logs WHERE action IN ('VERIFIKASI_LOLOS','VERIFIKASI_GAGAL')");
    expect(audit.length).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(audit)).not.toContain(kode1);
  });

  it("saklar authenticator mati: kode yang benar pun ditolak", async () => {
    await nyalakan({ authenticator: true });
    const rahasia = await pasangAuthenticator("u-admin");
    await nyalakan({ authenticator: false });
    expect(await periksaKodeAuthenticatorAksi(db(), "u-admin", kodePada(rahasia, 60), new Date(KINI.getTime() + 60_000))).toBe(false);
  });
});

describe("laporan uji pulih ke Pusat kesehatan", () => {
  const laporan = (tingkat: "baik" | "peringatan" | "gagal") => ({
    sumber: "uji-pulih-cadangan",
    tingkat,
    judul: "Uji pulih cadangan",
    rincian: "Pemulihan gagal pada tahap membaca arsip.",
    waktu: KINI.toISOString(),
  });

  it("hanya yang gagal tercatat sebagai kelompok error; baik dan peringatan tidak", async () => {
    sambungkanKaitKeamanan();
    expect(await laporkanKeKesehatan(db(), laporan("baik"))).toBe(1);
    expect(await laporkanKeKesehatan(db(), laporan("peringatan"))).toBe(1);
    expect(await db().queryAll("SELECT * FROM aleta_catatan_galat")).toHaveLength(0);
    expect(await laporkanKeKesehatan(db(), laporan("gagal"))).toBe(1);
    const baris = await db().queryAll<{ jenis: string; pesan: string; jumlah: number | string }>("SELECT jenis, pesan, jumlah FROM aleta_catatan_galat");
    expect(baris).toHaveLength(1);
    expect(baris[0].jenis).toBe("uji-pulih-cadangan");
    expect(baris[0].pesan).toContain("Pemulihan gagal");
    // kambuh: kelompok sama, jumlah naik
    await laporkanKeKesehatan(db(), laporan("gagal"));
    const lagi = await db().queryAll<{ jumlah: number | string }>("SELECT jumlah FROM aleta_catatan_galat");
    expect(lagi).toHaveLength(1);
    expect(Number(lagi[0].jumlah)).toBe(2);
  });
});

describe("pemasangan", () => {
  it("instrumentation.ts memanggil penyambung kait keamanan sebelum uji pulih berdetak", () => {
    const teks = readFileSync(path.join(process.cwd(), "src/instrumentation.ts"), "utf8");
    const sambung = teks.indexOf("sambungkanKaitKeamananAman");
    const pulih = teks.indexOf("mulaiUjiPulihBerkala(getDatabase)");
    expect(sambung).toBeGreaterThan(0);
    expect(pulih).toBeGreaterThan(sambung);
  });
});
