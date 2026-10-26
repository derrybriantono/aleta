// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase } from "@/server/db/client";
import { DDL_VERIFIKASI_DUA_LANGKAH } from "@/server/db/schema";
import { KODE_VERIFIKASI_DIPERLUKAN, tegakkanVerifikasi } from "@/server/modules/verifikasi/kait-masuk";
import {
  MAKS_PERCOBAAN,
  adaLolos,
  authenticatorAktif,
  buatKodeCadangan,
  cabutPerangkatTepercaya,
  catatLolos,
  hapusAuthenticator,
  hapusAuthenticatorSendiri,
  infoTantangan,
  kirimKodeWhatsapp,
  kodeKeduaTersedia,
  konfirmasiAuthenticator,
  mintaKodeKedua,
  mulaiPendaftaranAuthenticator,
  periksaKodeKedua,
  periksaTantangan,
  putuskanMasuk,
  selesaikanTantangan,
  sisaKodeCadangan,
  terbitkanTantangan,
} from "@/server/modules/verifikasi/layanan";
import {
  PENGATURAN_VERIFIKASI_BAWAAN,
  aturanBawaanPeran,
  bacaPengaturanVerifikasi,
  bersihkanPengaturanVerifikasi,
  cidrSah,
  ipDalamCidr,
  ipDiKantor,
  kosongkanSinggahVerifikasi,
  passkeyTersedia,
  periksaMasukanVerifikasi,
  simpanPengaturanVerifikasi,
} from "@/server/modules/verifikasi/pengaturan";
import { dekripsiRahasia, enkripsiRahasia } from "@/server/modules/verifikasi/rahasia";
import { base32Dekode, base32Enkode, kodeTotp, kodeTotpLangkah, periksaKodeTotp, uriOtpauth } from "@/server/modules/verifikasi/totp";

/**
 * ============================================================================
 * VERIFIKASI DUA LANGKAH: OTP WHATSAPP + AUTHENTICATOR (E5, 25 Okt 2026)
 * ============================================================================
 *
 *   1. TOTP: vektor uji RFC 6238, anti pakai ulang, jendela +-1 langkah
 *   2. pengaturan: MATI bawaan, CIDR, aturan bawaan per peran, validasi
 *   3. migrasi 0095 = DDL_VERIFIKASI_DUA_LANGKAH, ikut cadangan, jurnal berurutan
 *   4. keputusan masuk: saklar mati = tidak ada yang dimintai kode (semua peran),
 *      lalu matriks wajib / luar-kantor / opsional / tepercaya / lolos-sekali
 *   5. tiket dan kode: WhatsApp (jeda, batas, kedaluwarsa), authenticator,
 *      kode cadangan sekali pakai, lima salah = terkunci, percayai perangkat
 *   6. kait masuk: melempar 403 + tiket, gagal terbuka, saklar mati diam
 *   7. rute: masuk tanpa sesi, bantuan admin (Admin tidak boleh membantu Admin)
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

process.env.BETTER_AUTH_SECRET = "rahasia-uji-verifikasi-bukan-rahasia-sungguhan";

const KINI = new Date("2026-10-26T01:00:00.000Z");
const menit = (m: number) => new Date(KINI.getTime() + m * 60_000);
const PERANGKAT = "11111111-1111-4111-8111-111111111111";
const PERANGKAT_2 = "22222222-2222-4222-8222-222222222222";
const DI_KANTOR = "192.168.10.25";
const DI_LUAR = "36.70.1.2";
const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${url}`, init);

type Db = Awaited<ReturnType<typeof createAletaDatabase>>;
const db = () => ctx.db as Db;

beforeAll(async () => {
  const d = await createAletaDatabase({ useInMemory: true, seed: false });
  const kini = KINI.toISOString();
  for (const r of ["hakim", "admin", "super-admin", "pelaksana"]) await d.run(`INSERT INTO roles (id, name, description) VALUES (?, ?, '')`, [r, r]);
  await d.run(`INSERT INTO positions (id, name, unit_kerja, level_hierarchy, created_at, updated_at) VALUES ('pos-uji', 'Uji', 'Uji', 1, ?, ?)`, [kini, kini]);
  for (const [id, peran, wa] of [
    ["u-sa", "super-admin", "081200000001"],
    ["u-admin", "admin", "081200000002"],
    ["u-admin2", "admin", "081200000003"],
    ["u-hakim", "hakim", "081200000004"],
    ["u-staf", "pelaksana", "081200000005"],
    ["u-tanpa-wa", "pelaksana", ""],
  ]) {
    await d.run(
      `INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, ?, ?, 'pos-uji', ?, ?)`,
      [id, id, `Nama ${id}`, `${id}@rekaan.test`, wa, peran, kini, kini]
    );
  }
  ctx.db = d;
}, 300_000);

beforeEach(async () => {
  for (const t of ["aleta_ekstensi_setelan", "aleta_verifikasi_authenticator", "aleta_verifikasi_tantangan", "aleta_verifikasi_lolos", "aleta_verifikasi_kode_cadangan", "audit_logs"]) {
    await db().run(`DELETE FROM ${t}`);
  }
  kosongkanSinggahVerifikasi();
});

// Bawaan aturan semua peran = "mati" (keputusan Derry 26 Okt 2026); uji matriks memilih aturan per peran
// secara eksplisit, seperti yang nanti dilakukan Super Admin.
const ATURAN_PILIHAN: Record<string, string> = { "super-admin": "wajib", admin: "wajib", hakim: "luar-kantor", pelaksana: "opsional" };
const nyalakanTanpaAturan = (p: Record<string, unknown> = { otpWhatsapp: true, authenticator: true }) => simpanPengaturanVerifikasi(db(), p, { id: "u-sa", nama: "SA" }, KINI);
const nyalakan = (p: Record<string, unknown> = { otpWhatsapp: true, authenticator: true }) =>
  nyalakanTanpaAturan({ ...p, aturanPeran: { ...ATURAN_PILIHAN, ...((p.aturanPeran as Record<string, string> | undefined) ?? {}) } });

/** Memasang authenticator aktif untuk akun; mengembalikan rahasianya. */
async function pasangAuthenticator(userId: string) {
  const { rahasia } = await mulaiPendaftaranAuthenticator(db(), { id: userId, username: userId }, KINI);
  await konfirmasiAuthenticator(db(), userId, kodeTotp(rahasia, KINI), KINI);
  return rahasia;
}

// ─── 1. TOTP ────────────────────────────────────────────────────────────────

describe("TOTP (RFC 6238)", () => {
  const RAHASIA_RFC = base32Enkode(Buffer.from("12345678901234567890"));

  it("vektor uji resmi RFC 6238 (SHA-1, 8 angka) dan turunannya 6 angka", () => {
    expect(RAHASIA_RFC).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    const langkah = (detik: number) => Math.floor(detik / 30);
    expect(kodeTotpLangkah(RAHASIA_RFC, langkah(59), 8)).toBe("94287082");
    expect(kodeTotpLangkah(RAHASIA_RFC, langkah(1111111109), 8)).toBe("07081804");
    expect(kodeTotpLangkah(RAHASIA_RFC, langkah(1234567890), 8)).toBe("89005924");
    expect(kodeTotpLangkah(RAHASIA_RFC, langkah(59))).toBe("287082");
  });

  it("base32 bolak-balik, tahan spasi dan huruf kecil; rahasia salah ditolak", () => {
    expect(base32Dekode("gezd gnbv-GY3T").equals(base32Dekode("GEZDGNBVGY3T"))).toBe(true);
    expect(base32Dekode(RAHASIA_RFC).toString()).toBe("12345678901234567890");
    expect(() => base32Dekode("0189")).toThrow();
  });

  it("jendela +-1 langkah diterima, di luarnya ditolak, kode tidak boleh dipakai ulang", () => {
    const t = new Date(1_700_000_000_000);
    const langkahT = Math.floor(t.getTime() / 30_000);
    const kode = (l: number) => kodeTotpLangkah(RAHASIA_RFC, l);
    expect(periksaKodeTotp(RAHASIA_RFC, kode(langkahT), t)).toBe(langkahT);
    expect(periksaKodeTotp(RAHASIA_RFC, kode(langkahT - 1), t)).toBe(langkahT - 1);
    expect(periksaKodeTotp(RAHASIA_RFC, kode(langkahT + 1), t)).toBe(langkahT + 1);
    expect(periksaKodeTotp(RAHASIA_RFC, kode(langkahT + 2), t)).toBeNull();
    expect(periksaKodeTotp(RAHASIA_RFC, kode(langkahT - 2), t)).toBeNull();
    // langkah yang sudah terpakai (atau lebih lama) ditolak
    expect(periksaKodeTotp(RAHASIA_RFC, kode(langkahT), t, langkahT)).toBeNull();
    expect(periksaKodeTotp(RAHASIA_RFC, kode(langkahT - 1), t, langkahT)).toBeNull();
    // bukan 6 angka
    expect(periksaKodeTotp(RAHASIA_RFC, "12345", t)).toBeNull();
    expect(periksaKodeTotp(RAHASIA_RFC, "abcdef", t)).toBeNull();
    expect(periksaKodeTotp(RAHASIA_RFC, ` ${kode(langkahT).slice(0, 3)} ${kode(langkahT).slice(3)} `, t)).toBe(langkahT);
  });

  it("URI otpauth memuat rahasia, penerbit, 6 angka, 30 detik", () => {
    const u = new URL(uriOtpauth("ABCDEFGH", "derry@pa.test"));
    expect(u.protocol).toBe("otpauth:");
    expect(u.searchParams.get("secret")).toBe("ABCDEFGH");
    expect(u.searchParams.get("digits")).toBe("6");
    expect(u.searchParams.get("period")).toBe("30");
    expect(decodeURIComponent(u.pathname)).toContain("derry@pa.test");
  });

  it("rahasia tersimpan terenkripsi (bukan teks asli) dan dapat dibuka; data rusak ditolak", () => {
    const e = enkripsiRahasia("JBSWY3DPEHPK3PXP");
    expect(e).not.toContain("JBSWY3DPEHPK3PXP");
    expect(dekripsiRahasia(e)).toBe("JBSWY3DPEHPK3PXP");
    expect(enkripsiRahasia("JBSWY3DPEHPK3PXP")).not.toBe(e);
    const rusak = e.slice(0, -3) + (e.endsWith("AAA") ? "BBB" : "AAA");
    expect(() => dekripsiRahasia(rusak)).toThrow();
  });
});

// ─── 2. Pengaturan ──────────────────────────────────────────────────────────

describe("pengaturan", () => {
  it("MATI bawaan: kedua saklar mati, aturan bawaan SEMUA peran = mati (termasuk Super Admin dan Admin), jaringan kantor terisi", () => {
    expect(PENGATURAN_VERIFIKASI_BAWAAN).toMatchObject({ otpWhatsapp: false, authenticator: false, masaTepercayaHari: 30 });
    for (const peran of ["super-admin", "admin", "hakim", "ketua", "panitera", "pelaksana", "peran-baru"]) expect(aturanBawaanPeran(peran), peran).toBe("mati");
    expect(PENGATURAN_VERIFIKASI_BAWAAN.subnetKantor).toContain("192.168.10.0/24");
  });

  it("CIDR: cocok persis pada batas, di luar tidak cocok, IP kosong = luar kantor, IPv6 hanya persis", () => {
    expect(ipDalamCidr("192.168.10.0", "192.168.10.0/24")).toBe(true);
    expect(ipDalamCidr("192.168.10.255", "192.168.10.0/24")).toBe(true);
    expect(ipDalamCidr("192.168.11.1", "192.168.10.0/24")).toBe(false);
    expect(ipDalamCidr("10.1.2.3", "0.0.0.0/0")).toBe(true);
    expect(ipDalamCidr("10.1.2.3", "10.1.2.3")).toBe(true);
    expect(ipDiKantor("", ["0.0.0.0/0"])).toBe(false);
    expect(ipDiKantor("::1", ["::1/128"])).toBe(true);
    expect(cidrSah("192.168.10.0/24")).toBe(true);
    expect(cidrSah("192.168.10.0/33")).toBe(false);
    expect(cidrSah("300.1.1.1/8")).toBe(false);
    expect(cidrSah("bukan-ip")).toBe(false);
  });

  it("bersihkan: aturan tak dikenal dibuang, subnet salah dibuang, masa tepercaya di luar 1-90 kembali 30", () => {
    const p = bersihkanPengaturanVerifikasi({ otpWhatsapp: true, aturanPeran: { hakim: "wajib", staf: "gaib", "aneh peran": "mati" }, subnetKantor: ["10.0.0.0/8", "salah"], masaTepercayaHari: 500 });
    expect(p.aturanPeran).toEqual({ hakim: "wajib" });
    expect(p.subnetKantor).toEqual(["10.0.0.0/8"]);
    expect(p.masaTepercayaHari).toBe(30);
    expect(p.otpWhatsapp).toBe(true);
    expect(p.authenticator).toBe(false);
  });

  it("validasi simpan menolak (bukan membuang diam-diam)", () => {
    expect(() => periksaMasukanVerifikasi({ subnetKantor: ["192.168.1.0/99"] })).toThrow(/tidak sah/);
    expect(() => periksaMasukanVerifikasi({ aturanPeran: { hakim: "gaib" } })).toThrow(/tidak sah/);
    expect(() => periksaMasukanVerifikasi({ masaTepercayaHari: 0 })).toThrow(/hari/);
    expect(() => periksaMasukanVerifikasi(null)).toThrow();
    expect(() => periksaMasukanVerifikasi({ otpWhatsapp: true })).not.toThrow();
  });

  it("passkey hanya HTTPS atau localhost; http biasa tidak", () => {
    expect(passkeyTersedia("http://192.168.10.10")).toBe(false);
    expect(passkeyTersedia("https://aleta.pa-donggala.test")).toBe(true);
    expect(passkeyTersedia("http://localhost:3000")).toBe(true);
    expect(passkeyTersedia("")).toBe(false);
  });
});

// ─── 3. Migrasi ─────────────────────────────────────────────────────────────

describe("migrasi 0095", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0095_aleta_verifikasi_dua_langkah.sql");
  const pernyataan = (s: string) =>
    s
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean);

  it("jurnal: 0095 tepat sekali, idx = urutan, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0095_"))).toEqual([expect.objectContaining({ tag: "0095_aleta_verifikasi_dua_langkah" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
  });

  it("pernyataan berkas = DDL, berjalan di pg-mem, semua tabelnya ikut cadangan", () => {
    const isiSql = readFileSync(SQL, "utf8");
    expect(pernyataan(isiSql)).toEqual([...DDL_VERIFIKASI_DUA_LANGKAH.tabel, ...DDL_VERIFIKASI_DUA_LANGKAH.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(isiSql);
    for (const t of ["aleta_verifikasi_authenticator", "aleta_verifikasi_tantangan", "aleta_verifikasi_lolos", "aleta_verifikasi_kode_cadangan"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
  });
});

// ─── 4. Keputusan masuk ─────────────────────────────────────────────────────

describe("keputusan masuk", () => {
  const putus = (userId: string, ip: string, perangkatId = PERANGKAT, konsumsi = false) => putuskanMasuk(db(), { userId, perangkatId, ip, kini: KINI, konsumsi });

  it("MATI bawaan: tidak ada peran yang dimintai kode, di kantor maupun luar, perangkat baru maupun lama", async () => {
    await pasangAuthenticator("u-sa");
    for (const u of ["u-sa", "u-admin", "u-hakim", "u-staf", "u-tanpa-wa"]) {
      for (const ip of [DI_KANTOR, DI_LUAR, ""]) {
        expect(await putus(u, ip), `${u} / ${ip}`).toEqual({ perlu: false, sebab: "saklar-mati" });
      }
    }
  });

  it("saklar menyala TANPA memilih aturan peran: tidak ada peran yang dimintai kode (Super Admin akan memilih sendiri)", async () => {
    await pasangAuthenticator("u-sa");
    await nyalakanTanpaAturan({ otpWhatsapp: true, authenticator: true });
    for (const u of ["u-sa", "u-admin", "u-hakim", "u-staf"]) {
      for (const ip of [DI_KANTOR, DI_LUAR, ""]) expect(await putus(u, ip), `${u} / ${ip}`).toEqual({ perlu: false, sebab: "aturan-mati" });
    }
  });

  it("menyala: Super Admin/Admin (wajib) diminta di perangkat baru walau di kantor; metode sesuai sarana akun", async () => {
    await nyalakan();
    expect(await putus("u-sa", DI_KANTOR)).toEqual({ perlu: true, sebab: "perangkat-baru", metode: ["whatsapp"] });
    await pasangAuthenticator("u-sa");
    expect(await putus("u-sa", DI_LUAR)).toMatchObject({ perlu: true, sebab: "luar-kantor", metode: ["authenticator", "whatsapp"] });
    await buatKodeCadangan(db(), "u-sa", "u-sa", KINI);
    expect((await putus("u-sa", DI_LUAR)) as { metode: string[] }).toMatchObject({ metode: ["authenticator", "whatsapp", "cadangan"] });
  });

  it("hakim (luar-kantor): di kantor tidak diminta, dari luar diminta", async () => {
    await nyalakan();
    expect(await putus("u-hakim", DI_KANTOR)).toEqual({ perlu: false, sebab: "dalam-kantor" });
    expect(await putus("u-hakim", DI_LUAR)).toMatchObject({ perlu: true, sebab: "luar-kantor" });
    expect(await putus("u-hakim", "")).toMatchObject({ perlu: true });
  });

  it("peran opsional: diminta hanya bila orangnya sudah mendaftarkan authenticator", async () => {
    await nyalakan();
    expect(await putus("u-staf", DI_LUAR)).toEqual({ perlu: false, sebab: "tidak-didaftarkan" });
    await pasangAuthenticator("u-staf");
    expect(await putus("u-staf", DI_LUAR)).toMatchObject({ perlu: true });
    expect(await putus("u-staf", DI_KANTOR)).toMatchObject({ perlu: true, sebab: "perangkat-baru" });
  });

  it("aturan per peran dapat diganti Super Admin: mati menggugurkan, wajib memaksa", async () => {
    await nyalakan({ otpWhatsapp: true, aturanPeran: { admin: "mati", pelaksana: "wajib" } });
    expect(await putus("u-admin", DI_LUAR)).toEqual({ perlu: false, sebab: "aturan-mati" });
    expect(await putus("u-staf", DI_LUAR)).toMatchObject({ perlu: true });
  });

  it("saklar terpisah: hanya authenticator menyala -> WhatsApp tidak ditawarkan; hanya WhatsApp -> authenticator tidak", async () => {
    await pasangAuthenticator("u-sa");
    await nyalakan({ otpWhatsapp: false, authenticator: true });
    expect(await putus("u-sa", DI_LUAR)).toMatchObject({ perlu: true, metode: ["authenticator"] });
    await nyalakan({ otpWhatsapp: true, authenticator: false });
    expect(await putus("u-sa", DI_LUAR)).toMatchObject({ perlu: true, metode: ["whatsapp"] });
  });

  it("akun tanpa sarana (tanpa WhatsApp dan tanpa authenticator): TIDAK dikunci, dicatat sebagai tanpa-metode", async () => {
    await nyalakan({ otpWhatsapp: true, aturanPeran: { pelaksana: "wajib" } });
    expect(await putus("u-tanpa-wa", DI_LUAR)).toEqual({ perlu: false, sebab: "tanpa-metode" });
  });

  it("perangkat tepercaya melewati kode sampai kedaluwarsa; perangkat lain tetap diminta; cabut membatalkan", async () => {
    await nyalakan();
    await catatLolos(db(), { userId: "u-sa", perangkatId: PERANGKAT, jenis: "tepercaya", metode: "whatsapp", sampai: menit(60), kini: KINI });
    expect(await putus("u-sa", DI_LUAR)).toEqual({ perlu: false, sebab: "tepercaya" });
    expect(await putus("u-sa", DI_LUAR, PERANGKAT_2)).toMatchObject({ perlu: true });
    expect(await putuskanMasuk(db(), { userId: "u-sa", perangkatId: PERANGKAT, ip: DI_LUAR, kini: menit(61) })).toMatchObject({ perlu: true });
    expect(await cabutPerangkatTepercaya(db(), "u-sa", PERANGKAT)).toBe(1);
    expect(await putus("u-sa", DI_LUAR)).toMatchObject({ perlu: true });
  });

  it("lolos 'sekali' hanya satu kali dikonsumsi kait masuk, dan hanya untuk perangkat yang sama", async () => {
    await nyalakan();
    await catatLolos(db(), { userId: "u-sa", perangkatId: PERANGKAT, jenis: "sekali", metode: "whatsapp", sampai: menit(5), kini: KINI });
    expect(await putus("u-sa", DI_LUAR, PERANGKAT_2, true)).toMatchObject({ perlu: true });
    expect(await putus("u-sa", DI_LUAR, PERANGKAT, false)).toEqual({ perlu: false, sebab: "lolos-sekali" });
    expect(await putus("u-sa", DI_LUAR, PERANGKAT, false)).toEqual({ perlu: false, sebab: "lolos-sekali" });
    expect(await putus("u-sa", DI_LUAR, PERANGKAT, true)).toEqual({ perlu: false, sebab: "lolos-sekali" });
    expect(await putus("u-sa", DI_LUAR, PERANGKAT, true)).toMatchObject({ perlu: true });
  });

  it("akun tak dikenal tidak membuat galat", async () => {
    await nyalakan();
    expect(await putus("u-gaib", DI_LUAR)).toEqual({ perlu: false, sebab: "akun-tak-dikenal" });
  });
});

// ─── 5. Tiket dan kode ──────────────────────────────────────────────────────

describe("tiket dan kode", () => {
  const kirimTertangkap = () => {
    const kiriman: Array<{ nomor: string; pesan: string }> = [];
    return { kiriman, kirim: async (m: { nomor: string; pesan: string }) => void kiriman.push({ nomor: m.nomor, pesan: m.pesan }) };
  };
  const kodeDariPesan = (pesan: string) => pesan.match(/\*(\d{6})\*/)?.[1] ?? "";

  async function tiketBaru(userId = "u-sa", perangkatId = PERANGKAT, kini = KINI) {
    const tiket = await terbitkanTantangan(db(), { userId, perangkatId, jalur: "email", kini });
    const t = await periksaTantangan(db(), tiket, perangkatId, kini);
    if (!t.sah) throw new Error("tiket tidak sah");
    return { tiket, baris: t.baris };
  }

  it("tiket: terikat perangkat, 10 menit, tidak dikenal ditolak; info memuat nomor tersamar", async () => {
    await nyalakan();
    const { tiket } = await tiketBaru();
    expect((await periksaTantangan(db(), tiket, PERANGKAT_2, KINI))).toEqual({ sah: false, sebab: "perangkat-lain" });
    expect((await periksaTantangan(db(), "ngawur", PERANGKAT, KINI))).toEqual({ sah: false, sebab: "tidak-dikenal" });
    expect((await periksaTantangan(db(), tiket, PERANGKAT, menit(10)))).toEqual({ sah: false, sebab: "kedaluwarsa" });
    const info = await infoTantangan(db(), tiket, PERANGKAT, KINI);
    expect(info.metode).toEqual(["whatsapp"]);
    expect(info.nomor).toMatch(/^0812\*+001$/);
    expect(info.nomor).not.toContain("081200000001");
  });

  it("kode WhatsApp: terkirim ke nomor akun, hanya hash tersimpan, benar -> lolos + masuk ulang berhasil sekali", async () => {
    await nyalakan();
    const { tiket, baris } = await tiketBaru();
    const w = kirimTertangkap();
    await kirimKodeWhatsapp(db(), baris, { kirim: w.kirim, kini: KINI });
    expect(w.kiriman).toHaveLength(1);
    expect(w.kiriman[0].nomor).toBe("081200000001");
    const kode = kodeDariPesan(w.kiriman[0].pesan);
    expect(kode).toMatch(/^\d{6}$/);
    expect(JSON.stringify(await db().queryAll("SELECT * FROM aleta_verifikasi_tantangan"))).not.toContain(kode + '"');
    const hasil = await selesaikanTantangan(db(), { tiket, perangkatId: PERANGKAT, metode: "whatsapp", kode, percayai: false, kini: menit(1) });
    expect(hasil).toEqual({ lolos: true, tepercayaSampai: "" });
    // masuk ulang: kait mengonsumsi lolos-sekali, lalu permintaan berikutnya diminta lagi
    expect(await putuskanMasuk(db(), { userId: "u-sa", perangkatId: PERANGKAT, ip: DI_LUAR, kini: menit(2), konsumsi: true })).toEqual({ perlu: false, sebab: "lolos-sekali" });
    expect(await putuskanMasuk(db(), { userId: "u-sa", perangkatId: PERANGKAT, ip: DI_LUAR, kini: menit(2), konsumsi: true })).toMatchObject({ perlu: true });
    // tiket sudah selesai: tidak bisa dipakai lagi
    await expect(selesaikanTantangan(db(), { tiket, perangkatId: PERANGKAT, metode: "whatsapp", kode, percayai: false, kini: menit(2) })).rejects.toThrow(/sudah selesai/);
  });

  it("percayai perangkat: sesudah lolos perangkat tidak diminta lagi selama masa tepercaya (30 hari)", async () => {
    await nyalakan();
    const { tiket, baris } = await tiketBaru();
    const w = kirimTertangkap();
    await kirimKodeWhatsapp(db(), baris, { kirim: w.kirim, kini: KINI });
    const h = await selesaikanTantangan(db(), { tiket, perangkatId: PERANGKAT, metode: "whatsapp", kode: kodeDariPesan(w.kiriman[0].pesan), percayai: true, kini: KINI });
    expect(Date.parse(h.tepercayaSampai) - KINI.getTime()).toBe(30 * 86_400_000);
    expect(await adaLolos(db(), "u-sa", PERANGKAT, "tepercaya", menit(60 * 24 * 29))).toBe(true);
    expect(await adaLolos(db(), "u-sa", PERANGKAT, "tepercaya", menit(60 * 24 * 31))).toBe(false);
    expect(await putuskanMasuk(db(), { userId: "u-sa", perangkatId: PERANGKAT, ip: DI_LUAR, kini: menit(5) })).toEqual({ perlu: false, sebab: "tepercaya" });
  });

  it("kode WhatsApp: jeda 60 detik, paling banyak 5 kali, kedaluwarsa 5 menit, gagal kirim membatalkan kode", async () => {
    await nyalakan();
    const { baris } = await tiketBaru();
    const w = kirimTertangkap();
    await kirimKodeWhatsapp(db(), baris, { kirim: w.kirim, kini: KINI });
    const lagi = async (m: number) => {
      const t = await db().queryOne<never>("SELECT * FROM aleta_verifikasi_tantangan WHERE id = ?", [baris.id]);
      return kirimKodeWhatsapp(db(), t, { kirim: w.kirim, kini: menit(m) });
    };
    await expect(lagi(0.5)).rejects.toThrow(/Tunggu 60 detik/);
    for (let i = 1; i < 5; i += 1) await lagi(i * 2);
    expect(w.kiriman).toHaveLength(5);
    await expect(lagi(20)).rejects.toThrow(/terlalu sering/);

    const baru = await tiketBaru("u-hakim", PERANGKAT_2);
    await expect(kirimKodeWhatsapp(db(), baru.baris, { kirim: async () => Promise.reject(new Error("bot mati")), kini: KINI })).rejects.toThrow(/belum dapat mengirim/);
    const sisa = await db().queryOne<{ kode_wa_hash: string }>("SELECT kode_wa_hash FROM aleta_verifikasi_tantangan WHERE id = ?", [baru.baris.id]);
    expect(sisa?.kode_wa_hash).toBe("");
  });

  it("kode WhatsApp kedaluwarsa setelah 5 menit; saklar WhatsApp mati menolak pengiriman", async () => {
    await nyalakan();
    const { tiket, baris } = await tiketBaru();
    const w = kirimTertangkap();
    await kirimKodeWhatsapp(db(), baris, { kirim: w.kirim, kini: KINI });
    const kode = kodeDariPesan(w.kiriman[0].pesan);
    await expect(selesaikanTantangan(db(), { tiket, perangkatId: PERANGKAT, metode: "whatsapp", kode, percayai: false, kini: menit(5) })).rejects.toThrow(/salah atau sudah tidak berlaku/);
    await nyalakan({ otpWhatsapp: false, authenticator: true });
    await expect(kirimKodeWhatsapp(db(), baris, { kirim: w.kirim, kini: menit(9) })).rejects.toThrow(/tidak dipakai/);
  });

  it("lima kode salah menghanguskan tiket, termasuk kode yang akhirnya benar", async () => {
    await nyalakan();
    const { tiket, baris } = await tiketBaru();
    const w = kirimTertangkap();
    await kirimKodeWhatsapp(db(), baris, { kirim: w.kirim, kini: KINI });
    const benar = kodeDariPesan(w.kiriman[0].pesan);
    const salah = benar === "000000" ? "111111" : "000000";
    for (let i = 0; i < MAKS_PERCOBAAN; i += 1) {
      await expect(selesaikanTantangan(db(), { tiket, perangkatId: PERANGKAT, metode: "whatsapp", kode: salah, percayai: false, kini: menit(1) })).rejects.toThrow();
    }
    await expect(selesaikanTantangan(db(), { tiket, perangkatId: PERANGKAT, metode: "whatsapp", kode: benar, percayai: false, kini: menit(1) })).rejects.toThrow(/Terlalu banyak kode yang salah/);
    expect(await adaLolos(db(), "u-sa", PERANGKAT, "sekali", menit(1))).toBe(false);
  });

  it("authenticator: pendaftaran harus dikonfirmasi kode; kode yang sama tidak dapat dipakai dua kali; kode lama ditolak", async () => {
    await nyalakan({ otpWhatsapp: false, authenticator: true });
    const { rahasia } = await mulaiPendaftaranAuthenticator(db(), { id: "u-sa", username: "sa" }, KINI);
    expect(await authenticatorAktif(db(), "u-sa")).toBe(false);
    const simpanan = await db().queryOne<{ rahasia_enc: string }>("SELECT rahasia_enc FROM aleta_verifikasi_authenticator WHERE user_id = 'u-sa'");
    expect(simpanan?.rahasia_enc).not.toContain(rahasia);
    await expect(konfirmasiAuthenticator(db(), "u-sa", "000000", KINI)).rejects.toThrow(/Kode salah/);
    await konfirmasiAuthenticator(db(), "u-sa", kodeTotp(rahasia, KINI), KINI);
    expect(await authenticatorAktif(db(), "u-sa")).toBe(true);
    await expect(mulaiPendaftaranAuthenticator(db(), { id: "u-sa" }, KINI)).rejects.toThrow(/sudah terpasang/);

    // kode di langkah KINI sudah dipakai konfirmasi -> tidak berlaku sebagai kode masuk
    const tiket1 = await tiketBaru();
    await expect(selesaikanTantangan(db(), { tiket: tiket1.tiket, perangkatId: PERANGKAT, metode: "authenticator", kode: kodeTotp(rahasia, KINI), percayai: false, kini: KINI })).rejects.toThrow(/salah/);
    // langkah berikutnya berlaku sekali
    const berikut = menit(1);
    const kode = kodeTotp(rahasia, berikut);
    const t2 = await tiketBaru("u-sa", PERANGKAT, berikut);
    await selesaikanTantangan(db(), { tiket: t2.tiket, perangkatId: PERANGKAT, metode: "authenticator", kode, percayai: false, kini: berikut });
    const t3 = await tiketBaru("u-sa", PERANGKAT_2, berikut);
    await expect(selesaikanTantangan(db(), { tiket: t3.tiket, perangkatId: PERANGKAT_2, metode: "authenticator", kode, percayai: false, kini: berikut })).rejects.toThrow(/salah/);
  });

  it("authenticator yang saklarnya mati tidak diterima walau kodenya benar", async () => {
    const rahasia = await pasangAuthenticator("u-sa");
    await nyalakan({ otpWhatsapp: true, authenticator: false });
    const t = await tiketBaru("u-sa", PERANGKAT, menit(1));
    await expect(selesaikanTantangan(db(), { tiket: t.tiket, perangkatId: PERANGKAT, metode: "authenticator", kode: kodeTotp(rahasia, menit(1)), percayai: false, kini: menit(1) })).rejects.toThrow(/salah/);
  });

  it("hapus authenticator sendiri menuntut kode yang berlaku; admin/reset menghapus tanpa kode dan mencabut perangkat tepercaya", async () => {
    await nyalakan({ otpWhatsapp: false, authenticator: true });
    const rahasia = await pasangAuthenticator("u-staf");
    await catatLolos(db(), { userId: "u-staf", perangkatId: PERANGKAT, jenis: "tepercaya", metode: "authenticator", sampai: menit(60), kini: KINI });
    await expect(hapusAuthenticatorSendiri(db(), "u-staf", "000000", menit(1))).rejects.toThrow(/Masukkan kode/);
    expect(await authenticatorAktif(db(), "u-staf")).toBe(true);
    await hapusAuthenticatorSendiri(db(), "u-staf", kodeTotp(rahasia, menit(1)), menit(1));
    expect(await authenticatorAktif(db(), "u-staf")).toBe(false);

    await pasangAuthenticator("u-hakim");
    await hapusAuthenticator(db(), "u-hakim", "u-admin");
    expect(await authenticatorAktif(db(), "u-hakim")).toBe(false);
  });

  it("kode cadangan: 8 kode, hanya hash tersimpan, sekali pakai, membuat ulang menghanguskan yang lama", async () => {
    await nyalakan();
    const kode = await buatKodeCadangan(db(), "u-sa", "u-admin", KINI);
    expect(kode).toHaveLength(8);
    expect(new Set(kode).size).toBe(8);
    expect(kode[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(JSON.stringify(await db().queryAll("SELECT * FROM aleta_verifikasi_kode_cadangan"))).not.toContain(kode[0].replace("-", ""));
    expect(await sisaKodeCadangan(db(), "u-sa")).toBe(8);

    const a = await tiketBaru();
    await selesaikanTantangan(db(), { tiket: a.tiket, perangkatId: PERANGKAT, metode: "cadangan", kode: kode[0].toLowerCase(), percayai: false, kini: KINI });
    expect(await sisaKodeCadangan(db(), "u-sa")).toBe(7);
    const b = await tiketBaru("u-sa", PERANGKAT_2);
    await expect(selesaikanTantangan(db(), { tiket: b.tiket, perangkatId: PERANGKAT_2, metode: "cadangan", kode: kode[0], percayai: false, kini: KINI })).rejects.toThrow(/salah/);

    const baru = await buatKodeCadangan(db(), "u-sa", "u-sa", KINI);
    expect(await sisaKodeCadangan(db(), "u-sa")).toBe(8);
    const c = await tiketBaru("u-sa", PERANGKAT_2);
    await expect(selesaikanTantangan(db(), { tiket: c.tiket, perangkatId: PERANGKAT_2, metode: "cadangan", kode: kode[1], percayai: false, kini: KINI })).rejects.toThrow(/salah/);
    await selesaikanTantangan(db(), { tiket: c.tiket, perangkatId: PERANGKAT_2, metode: "cadangan", kode: baru[0], percayai: false, kini: KINI });
  });

  it("kode cadangan tidak berlaku selama kedua saklar mati", async () => {
    const kode = await buatKodeCadangan(db(), "u-sa", "u-admin", KINI);
    const a = await tiketBaru();
    await expect(selesaikanTantangan(db(), { tiket: a.tiket, perangkatId: PERANGKAT, metode: "cadangan", kode: kode[0], percayai: false, kini: KINI })).rejects.toThrow(/salah/);
  });

  it("kejadian tercatat di audit: lolos, gagal, authenticator aktif, kode cadangan (tanpa isi kode)", async () => {
    await nyalakan();
    const kode = await buatKodeCadangan(db(), "u-sa", "u-admin", KINI);
    const a = await tiketBaru();
    await expect(selesaikanTantangan(db(), { tiket: a.tiket, perangkatId: PERANGKAT, metode: "cadangan", kode: "SALAHSALAH", percayai: false, kini: KINI })).rejects.toThrow();
    await selesaikanTantangan(db(), { tiket: a.tiket, perangkatId: PERANGKAT, metode: "cadangan", kode: kode[2], percayai: false, kini: KINI });
    const aksi = (await db().queryAll<{ action: string; payload_json?: string }>("SELECT action FROM audit_logs ORDER BY action")).map((x) => x.action);
    expect(aksi).toEqual(expect.arrayContaining(["KODE_CADANGAN_DIBUAT", "VERIFIKASI_GAGAL", "VERIFIKASI_LOLOS"]));
    expect(JSON.stringify(await db().queryAll("SELECT * FROM audit_logs"))).not.toContain(kode[2]);
  });
});

// ─── 6. Kait masuk ──────────────────────────────────────────────────────────

describe("kait masuk", () => {
  it("saklar mati: tidak melempar apa pun dan tidak menerbitkan tiket", async () => {
    await tegakkanVerifikasi(db(), { userId: "u-sa", perangkatId: PERANGKAT, ip: DI_LUAR, jalur: "email" });
    expect(await db().queryAll("SELECT * FROM aleta_verifikasi_tantangan")).toEqual([]);
  });

  it("menyala: melempar 403 VERIFIKASI_DIPERLUKAN + tiket + metode; password salah/benar tidak mengubah tiket lama", async () => {
    await nyalakan();
    let galat = null as { statusCode?: number; status?: string; body?: Record<string, unknown> } | null;
    try {
      await tegakkanVerifikasi(db(), { userId: "u-sa", perangkatId: PERANGKAT, ip: DI_LUAR, jalur: "email" });
    } catch (e) {
      galat = e as typeof galat;
    }
    expect(galat).not.toBeNull();
    const badan = (galat?.body ?? galat) as { code?: string; tiket?: string; metode?: string[] };
    expect(badan.code).toBe(KODE_VERIFIKASI_DIPERLUKAN);
    expect(typeof badan.tiket).toBe("string");
    expect(badan.metode).toEqual(["whatsapp"]);
    const t = await periksaTantangan(db(), String(badan.tiket), PERANGKAT, new Date());
    expect(t.sah).toBe(true);
  });

  it("sesudah lolos, kait mengizinkan sekali; perangkat tepercaya tidak menerbitkan tiket", async () => {
    await nyalakan();
    await catatLolos(db(), { userId: "u-sa", perangkatId: PERANGKAT, jenis: "sekali", metode: "whatsapp", sampai: new Date(Date.now() + 60_000) });
    await tegakkanVerifikasi(db(), { userId: "u-sa", perangkatId: PERANGKAT, ip: DI_LUAR, jalur: "email" });
    await expect(tegakkanVerifikasi(db(), { userId: "u-sa", perangkatId: PERANGKAT, ip: DI_LUAR, jalur: "email" })).rejects.toBeTruthy();
    await catatLolos(db(), { userId: "u-hakim", perangkatId: PERANGKAT, jenis: "tepercaya", metode: "whatsapp", sampai: new Date(Date.now() + 60_000) });
    await tegakkanVerifikasi(db(), { userId: "u-hakim", perangkatId: PERANGKAT, ip: DI_LUAR, jalur: "email" });
  });

  it("gagal terbuka: basis data bermasalah tidak mengunci siapa pun", async () => {
    await nyalakan();
    const rusak = { ...db(), queryOne: async () => Promise.reject(new Error("db mati")), queryAll: async () => Promise.reject(new Error("db mati")), run: async () => Promise.reject(new Error("db mati")) } as unknown as Db;
    await bacaPengaturanVerifikasi(db()); // mengisi singgahan: pengaturan terbaca, akunnya yang tidak
    await expect(tegakkanVerifikasi(rusak, { userId: "u-sa", perangkatId: PERANGKAT, ip: DI_LUAR, jalur: "email" })).resolves.toBeUndefined();
  });
});

// ─── 7. Kait aksi (untuk pengaman aksi admin) ───────────────────────────────

describe("kait aksi admin", () => {
  it("selama saklar mati: tidak ada kode kedua", async () => {
    expect(await kodeKeduaTersedia(db(), "u-sa")).toBe(false);
    await expect(mintaKodeKedua(db(), "u-sa")).rejects.toThrow(/belum dinyalakan/);
  });

  it("menyala: minta kode (WhatsApp), periksa benar sekali pakai, salah naik hitungan, akun lain tidak bisa memakai tiketnya", async () => {
    await nyalakan();
    expect(await kodeKeduaTersedia(db(), "u-sa")).toBe(true);
    const kiriman: string[] = [];
    const m = await mintaKodeKedua(db(), "u-sa", { kirimWhatsapp: true, kini: KINI, kirim: async (x) => void kiriman.push(x.pesan) });
    expect(m.metode).toEqual(["whatsapp"]);
    expect(m.nomor).toMatch(/\*/);
    const kode = kiriman[0].match(/\*(\d{6})\*/)?.[1] ?? "";
    await expect(periksaKodeKedua(db(), { userId: "u-sa", tiket: m.tiket, metode: "whatsapp", kode: kode === "000000" ? "111111" : "000000", kini: KINI })).rejects.toThrow(/salah/);
    await expect(periksaKodeKedua(db(), { userId: "u-admin", tiket: m.tiket, metode: "whatsapp", kode, kini: KINI })).rejects.toThrow(/tidak sah/);
    await expect(periksaKodeKedua(db(), { userId: "u-sa", tiket: m.tiket, metode: "whatsapp", kode, kini: KINI })).resolves.toBe(true);
    await expect(periksaKodeKedua(db(), { userId: "u-sa", tiket: m.tiket, metode: "whatsapp", kode, kini: KINI })).rejects.toThrow(/tidak sah|habis/);
  });
});

// ─── 8. Rute ────────────────────────────────────────────────────────────────

describe("rute", () => {
  const dari = (id: string, metode: string, badan?: unknown, ekstra: Record<string, string> = {}) => ({
    method: metode,
    headers: { "x-aleta-user-id": id, "content-type": "application/json", ...ekstra },
    body: badan === undefined ? undefined : JSON.stringify(badan),
  });

  it("pengaturan: hanya Super Admin; menyalakan memercayai perangkat penyalanya dan tercatat di audit", async () => {
    const rute = await import("@/app/api/admin/verifikasi/route");
    const url = "/api/admin/verifikasi";
    expect((await rute.GET(req(url, dari("u-admin", "GET")))).status).toBe(403);
    expect((await rute.POST(req(url, dari("u-hakim", "POST", { otpWhatsapp: true })))).status).toBe(403);
    expect((await rute.POST(req(url, dari("u-sa", "POST", { subnetKantor: ["salah"] })))).status).toBe(400);

    const res = await rute.POST(req(url, dari("u-sa", "POST", { otpWhatsapp: true }, { cookie: `aleta_perangkat=${PERANGKAT}` })));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: { pengaturan: { otpWhatsapp: boolean; authenticator: boolean }; peran: Array<{ id: string; bawaan: string }> } };
    expect(j.data.pengaturan).toMatchObject({ otpWhatsapp: true, authenticator: false });
    expect(j.data.peran.find((p) => p.id === "hakim")?.bawaan).toBe("mati");
    expect(j.data.peran.find((p) => p.id === "super-admin")?.bawaan).toBe("mati");
    expect(await adaLolos(db(), "u-sa", PERANGKAT, "tepercaya", new Date())).toBe(true);
    const audit = await db().queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action = 'UPDATE_VERIFIKASI_DUA_LANGKAH'");
    expect(audit).toHaveLength(1);
  });

  it("masuk tanpa sesi: info -> kirim -> periksa; tiket perangkat lain ditolak; aksi asing ditolak", async () => {
    await nyalakan();
    const tiket = await terbitkanTantangan(db(), { userId: "u-sa", perangkatId: PERANGKAT, jalur: "email" });
    const rute = await import("@/app/api/portal/verifikasi/masuk/route");
    const kirim = (badan: unknown, perangkat = PERANGKAT) =>
      rute.POST(req("/api/portal/verifikasi/masuk", { method: "POST", headers: { "content-type": "application/json", cookie: `aleta_perangkat=${perangkat}` }, body: JSON.stringify(badan) }));

    const info = await kirim({ aksi: "info", tiket });
    expect(info.status).toBe(200);
    expect(((await info.json()) as { data: { metode: string[] } }).data.metode).toEqual(["whatsapp"]);
    expect((await kirim({ aksi: "info", tiket }, PERANGKAT_2)).status).toBe(400);
    expect((await kirim({ aksi: "gaib", tiket })).status).toBe(400);
    expect((await kirim({ aksi: "periksa", tiket, metode: "whatsapp", kode: "123456" })).status).toBe(400);
  });

  it("bantuan admin: Admin boleh membantu pengguna biasa tetapi tidak Admin lain/Super Admin; tidak untuk diri sendiri; Super Admin boleh semua", async () => {
    const rute = await import("@/app/api/admin/verifikasi/bantuan/route");
    const kirim = (id: string, badan: unknown) => rute.POST(req("/api/admin/verifikasi/bantuan", dari(id, "POST", badan)));

    expect((await kirim("u-hakim", { userId: "u-staf", aksi: "kode-cadangan" })).status).toBe(403);
    expect((await kirim("u-admin", { userId: "u-admin", aksi: "kode-cadangan" })).status).toBe(400);
    expect((await kirim("u-admin", { userId: "u-sa", aksi: "kode-cadangan" })).status).toBe(403);
    expect((await kirim("u-admin", { userId: "u-admin2", aksi: "reset" })).status).toBe(403);
    expect(await sisaKodeCadangan(db(), "u-sa")).toBe(0);

    const ok = await kirim("u-admin", { userId: "u-staf", aksi: "kode-cadangan" });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { data: { kode: string[] } }).data.kode).toHaveLength(8);
    expect(await sisaKodeCadangan(db(), "u-staf")).toBe(8);

    await pasangAuthenticator("u-staf");
    expect((await kirim("u-admin", { userId: "u-staf", aksi: "reset" })).status).toBe(200);
    expect(await authenticatorAktif(db(), "u-staf")).toBe(false);
    expect((await kirim("u-sa", { userId: "u-admin2", aksi: "kode-cadangan" })).status).toBe(200);
    expect((await kirim("u-sa", { userId: "gaib", aksi: "reset" })).status).toBe(404);
  });

  it("authenticator sendiri lewat rute: mulai memberi QR, konfirmasi mengaktifkan, status mencerminkan; tanpa sesi 401", async () => {
    const rute = await import("@/app/api/portal/verifikasi/authenticator/route");
    const status = await import("@/app/api/portal/verifikasi/route");
    const kirim = (id: string | null, badan: unknown) =>
      rute.POST(req("/api/portal/verifikasi/authenticator", id ? dari(id, "POST", badan) : { method: "POST", body: JSON.stringify(badan) }));

    expect((await kirim(null, { aksi: "mulai" })).status).toBe(401);
    const mulai = (await (await kirim("u-staf", { aksi: "mulai" })).json()) as { data: { rahasia: string; qr: string; uri: string } };
    expect(mulai.data.qr).toMatch(/^data:image\/png;base64,/);
    expect(mulai.data.uri).toContain(mulai.data.rahasia);
    expect((await kirim("u-staf", { aksi: "konfirmasi", kode: "000000" })).status).toBe(400);
    expect((await kirim("u-staf", { aksi: "konfirmasi", kode: kodeTotp(mulai.data.rahasia, new Date()) })).status).toBe(200);
    const st = (await (await status.GET(req("/api/portal/verifikasi", dari("u-staf", "GET")))).json()) as { data: { authenticatorAktif: boolean; saklar: { otpWhatsapp: boolean }; passkey: boolean } };
    expect(st.data).toMatchObject({ authenticatorAktif: true, passkey: true });
    expect(st.data.saklar.otpWhatsapp).toBe(false);
  });
});
