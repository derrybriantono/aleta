// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * MASUK DENGAN AKUN SIPP - PERBAIKAN AUDIT U5 (9 Okt 2026)
 * ============================================================================
 *
 * Tiap uji di sini MERAH sebelum perbaikannya:
 *
 *   1. /sign-in/email (jalur lama) meloloskan akun yang akun SIPP-nya
 *      diblokir/kedaluwarsa - aturan "AKUN SIPP NONAKTIF = ALETA TERTUTUP"
 *      hanya dijaga /sign-in/sipp.
 *   2. password yang SALAH pada akun SIPP diblokir sudah dijawab 403
 *      "diblokir" - penebak mengetahui keadaan akun orang.
 *   4. bot menyimpan daftar kolom KOSONG selamanya sesudah satu kegagalan
 *      MySQL; verifikasiSandi lalu menjawab "tidak ditemukan" sampai bot
 *      dinyalakan ulang.
 *   5. audit_logs mencatat lewat "sipp" untuk percobaan yang ditolak.
 *   6. username SIPP yang disimpan dua akun ALETA membuat PEMILIKNYA sendiri
 *      "tidak ditemukan", walau aturan pemilik (tentukanPemilikSipp) jelas.
 *   7. pengecualian akun ABT "supervisor" peka huruf besar.
 *
 * (3 - titipan basi di ekstensi - ada di masuk-akun-sipp-u5-9okt.test.tsx.)
 * Seluruh password PALSU.
 */

const SANDI_ALETA = "Aleta-Palsu-U5-9okt";
const SANDI_SIPP = "Sipp-Palsu-U5-9okt";

const keadaan = vi.hoisted(() => ({
  db: null as unknown,
  bot: { ok: true, diblokir: false, kedaluwarsa: false } as { ok: boolean; diblokir: boolean; kedaluwarsa: boolean },
  panggilBot: 0,
  sandiAletaHash: new Map<string, string>(),
  handlerDipanggil: 0,
}));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => keadaan.db,
}));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-sipp/aleta-sipp-datasource")>()),
  callAletaBotSippBridge: async (_op: string, p: { sandi: string }) => {
    keadaan.panggilBot += 1;
    if (!keadaan.bot.ok) return { ok: false, error: "ALETA Bot bridge tidak merespons." };
    return {
      ok: true,
      data: {
        ditemukan: true,
        cocok: p.sandi === SANDI_SIPP,
        diblokir: keadaan.bot.diblokir,
        kedaluwarsa: keadaan.bot.kedaluwarsa,
        sippUserId: "77",
      },
    };
  },
}));
// Better Auth ditiru: pemeriksa password ALETA + handler yang "membuat sesi".
vi.mock("@/lib/auth", () => ({
  getAuth: async () => ({
    $context: Promise.resolve({
      internalAdapter: {
        findAccounts: async (userId: string) =>
          keadaan.sandiAletaHash.has(userId) ? [{ providerId: "credential", password: keadaan.sandiAletaHash.get(userId) }] : [],
      },
      password: { verify: async ({ hash, password }: { hash: string; password: string }) => hash === `h:${password}` },
    }),
    handler: async () => {
      keadaan.handlerDipanggil += 1;
      return new Response(JSON.stringify({ token: "sesi" }), { status: 200, headers: { "content-type": "application/json" } });
    },
  }),
}));

const { createAletaDatabase } = await import("@/server/db/client");
const { createManagedUserInDb, lookupUserForLoginInDb } = await import("@/server/modules/users/service");
const { encryptCredentialSecret, hashMd5 } = await import("@/server/shared/security");
const { POST } = await import("@/app/api/auth/[...all]/route");
const { putuskanMasukSipp, kosongkanBatasMasukSipp } = await import("@/server/modules/portal/masuk-sipp");
const { catatJejakMasuk } = await import("@/server/modules/portal/masuk-sipp-plugin");

type Db = Awaited<ReturnType<typeof createAletaDatabase>>;
let db: Db;
let urutan = 0;

async function buatPegawai(username: string) {
  urutan += 1;
  return createManagedUserInDb(db, "usr-super", {
    username,
    password: "rahasia123",
    email: `${username}@pa.go.id`,
    whatsappNumber: `62812399${String(1000 + urutan)}`,
    name: `Pegawai ${username}`,
    nip: `1994010220171210${String(10 + urutan).padStart(2, "0")}`,
    positionId: "pos-ketua",
  });
}

async function pasangSipp(userId: string, username: string, opsi: { aktif?: boolean; keadaan?: string } = {}) {
  urutan += 1;
  const waktu = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO external_app_credentials (
        id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
        is_enabled, last_verified_status, password_updated_at, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, 'sipp', ?, ?, ?, ?, ?, ?, 'usr-super', 'usr-super', ?, ?)`
    )
    .run(
      `eac-u5-${urutan}`,
      userId,
      username,
      encryptCredentialSecret("sipp-rahasia"),
      hashMd5("sipp-rahasia"),
      opsi.aktif === false ? 0 : 1,
      opsi.keadaan ?? "not_tested",
      waktu,
      waktu,
      waktu
    );
}

function masukLama(email: string, password: string) {
  urutan += 1;
  return POST(
    new NextRequest("http://127.0.0.1:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.95.0.${urutan % 250}` },
      body: JSON.stringify({ email, password, rememberMe: false }),
    })
  );
}

// SATU basis data untuk seluruh berkas: membangunnya per uji makan 2 menit
// ketika mesin sedang sibuk. Tiap uji memakai nama akun SIPP sendiri.
beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  keadaan.db = db;
}, 600_000);

afterAll(async () => {
  await db?.close();
});

beforeEach(() => {
  keadaan.bot = { ok: true, diblokir: false, kedaluwarsa: false };
  keadaan.panggilBot = 0;
  keadaan.handlerDipanggil = 0;
  keadaan.sandiAletaHash.clear();
  kosongkanBatasMasukSipp();
});


// ============================================================================
// 1. JALUR LAMA IKUT TERTUTUP
// ============================================================================
describe("1. /sign-in/email bagi akun bertautan SIPP yang akun SIPP-nya nonaktif", () => {
  async function pegawaiBertautan() {
    urutan += 1;
    const nama = `pp.u5.${urutan}`;
    const p = await buatPegawai(nama);
    await pasangSipp(p.id, nama);
    keadaan.sandiAletaHash.set(p.id, `h:${SANDI_ALETA}`);
    return p;
  }

  it("diblokir + password ALETA benar: 403 dengan kalimat SIPP, sesi TIDAK dibuat, jejak tertulis", async () => {
    keadaan.bot.diblokir = true;
    const p = await pegawaiBertautan();
    const r = await masukLama(p.email, SANDI_ALETA);
    expect(r.status).toBe(403);
    const isi = await r.json();
    expect(isi.message).toContain("Akun SIPP Anda sedang diblokir");
    expect(isi.code).toBe("SIPP_NONAKTIF");
    expect(keadaan.handlerDipanggil).toBe(0);
    const jejak = await db.prepare("SELECT * FROM aleta_masuk_jejak WHERE aleta_user_id = ?").all<Record<string, string>>(p.id);
    expect(jejak).toHaveLength(1);
    expect(jejak[0]).toMatchObject({ aleta_user_id: p.id, lewat: "aleta", hasil: "ditolak", alasan: "sipp_diblokir_jalur_lama" });
    expect(JSON.stringify(jejak)).not.toContain(SANDI_ALETA);
  });

  it("kedaluwarsa: 403 juga", async () => {
    keadaan.bot.kedaluwarsa = true;
    const p = await pegawaiBertautan();
    const r = await masukLama(p.email, SANDI_ALETA);
    expect(r.status).toBe(403);
    expect((await r.json()).message).toContain("Masa berlaku akun SIPP");
  });

  it("diblokir + password SALAH: diteruskan ke Better Auth (yang menolaknya) - keadaan blokir tidak dibocorkan", async () => {
    keadaan.bot.diblokir = true;
    const p = await pegawaiBertautan();
    await masukLama(p.email, "tebakan-salah");
    expect(keadaan.handlerDipanggil).toBe(1);
  });

  it("akun SIPP aktif, bot mati, atau akun tanpa tautan SIPP: jalur lama berjalan seperti dulu", async () => {
    const p = await pegawaiBertautan();
    expect((await masukLama(p.email, SANDI_ALETA)).status).toBe(200);
    keadaan.bot = { ok: false, diblokir: true, kedaluwarsa: false };
    expect((await masukLama(p.email, SANDI_ALETA)).status).toBe(200);
    const tanpa = await buatPegawai(`tanpa.sipp.${urutan}`);
    keadaan.sandiAletaHash.set(tanpa.id, `h:${SANDI_ALETA}`);
    const sebelum = keadaan.panggilBot;
    expect((await masukLama(tanpa.email, SANDI_ALETA)).status).toBe(200);
    expect(keadaan.panggilBot).toBe(sebelum);
    expect(keadaan.handlerDipanggil).toBe(3);
  });

  it("Super Admin dengan akun SIPP diblokir tetap masuk lewat password ALETA (keputusan 7 Okt)", async () => {
    keadaan.bot.diblokir = true;
    const sa = await db.prepare("SELECT id, email FROM users WHERE id = 'usr-super'").get<{ id: string; email: string }>();
    expect(sa).toBeTruthy();
    await pasangSipp(sa!.id, "admin.sipp");
    keadaan.sandiAletaHash.set(sa!.id, `h:${SANDI_ALETA}`);
    expect((await masukLama(sa!.email, SANDI_ALETA)).status).toBe(200);
    expect(keadaan.handlerDipanggil).toBe(1);
  });
});

// ============================================================================
// 2. KEADAAN "NONAKTIF" TIDAK DIBOCORKAN KEPADA PENEBAK
// ============================================================================
describe("2. /sign-in/sipp: password salah pada akun SIPP diblokir", () => {
  const deps = (diblokir: boolean, roleId = "panitera-pengganti") => ({
    cariPengguna: async () => ({ id: "usr-pp", roleId }),
    akunSippMilik: async () => ["pp.budi"],
    verifikasiSipp: async (_u: string, s: string) => ({
      ok: true as const,
      data: { ditemukan: true, cocok: s === SANDI_SIPP, diblokir, kedaluwarsa: false, sippUserId: "77" },
    }),
    verifikasiSandiAleta: async (_id: string, s: string) => s === SANDI_ALETA,
    catatJejak: async () => undefined,
  });
  const konteks = () => {
    urutan += 1;
    return { headers: new Headers({ "x-forwarded-for": `10.94.0.${urutan % 250}` }) };
  };

  it("password salah: 401 'password salah', bukan 403 'diblokir'", async () => {
    const hasil = await putuskanMasukSipp(deps(true), { identitas: "pp.budi", sandi: "tebakan" }, konteks(), {});
    expect(hasil).toMatchObject({ jenis: "tolak", status: 401, kode: "SANDI_SALAH" });
    expect((hasil as { pesan: string }).pesan).not.toContain("diblokir");
  });

  it("password SIPP atau ALETA benar: 403 diblokir (tetap); Super Admin dengan password ALETA tetap masuk", async () => {
    for (const sandi of [SANDI_SIPP, SANDI_ALETA]) {
      expect(await putuskanMasukSipp(deps(true), { identitas: "pp.budi", sandi }, konteks(), {})).toMatchObject({ status: 403 });
    }
    expect(await putuskanMasukSipp(deps(true, "super-admin"), { identitas: "sa", sandi: SANDI_ALETA }, konteks(), {})).toMatchObject({
      jenis: "masuk",
      lewat: "aleta",
    });
  });
});

// ============================================================================
// 4. BOT: KEGAGALAN MYSQL SESAAT TIDAK DISIMPAN
// ============================================================================
describe("4. bot: cache kolom sys_users", () => {
  it("kegagalan sesaat = ok:false (portal menempuh 'SIPP tak terjangkau'); sesudah MySQL pulih akunnya terbaca lagi", async () => {
    const AKAR_BOT = path.resolve(process.cwd(), "..", "aleta_bot");
    const muat = createRequire(path.join(AKAR_BOT, "services", "x.js"));
    const tiru = (nama: string, ekspor: unknown) => {
      const berkas = muat.resolve(`./${nama}`);
      (muat.cache as Record<string, unknown>)[berkas] = { id: berkas, filename: berkas, loaded: true, exports: ekspor, children: [], paths: [] };
    };
    let mysqlHidup = false;
    tiru("externalDbService", {
      query: async (_k: string, sql: string) => {
        if (!mysqlHidup) throw new Error("connect ECONNREFUSED");
        if (/^SHOW COLUMNS/i.test(sql.trim())) {
          return ["userid", "username", "password", "code_activation", "block", "user_expired"].map((Field) => ({ Field }));
        }
        return [{ sandi_tersimpan: "x", kode_aktivasi: "k", diblokir: 0, kedaluwarsa_pada: null, sipp_user_id: 7 }];
      },
      sanitizeError: (e: Error) => e.message,
    });
    tiru("botDbService", {});
    tiru("logService", { logSystemEvent: async () => undefined, logSecurityEvent: async () => undefined });
    const layanan = muat("./sippReadOnlyBridgeService") as {
      safeHandleBridgeOperation: (op: string, p: Record<string, unknown>) => Promise<{ ok: boolean; data?: any }>;
    };

    const pertama = await layanan.safeHandleBridgeOperation("user.verifikasiSandi", { username: "pp.budi", sandi: "apa" });
    expect(pertama.ok).toBe(false);

    mysqlHidup = true;
    const kedua = await layanan.safeHandleBridgeOperation("user.verifikasiSandi", { username: "pp.budi", sandi: "apa" });
    expect(kedua.ok).toBe(true);
    expect(kedua.data?.ditemukan).toBe(true);
  });
});

// ============================================================================
// 5. AUDIT: PENOLAKAN TIDAK DICATAT "LEWAT SIPP"
// ============================================================================
describe("5. catatJejakMasuk: lewat di audit_logs", () => {
  it("percobaan yang ditolak tidak dicatat lewat 'sipp'", async () => {
    const pemilik = await buatPegawai("audit.u5");
    const dasar = { identitas: "pp.budi", usernameSipp: "pp.budi", sippUserId: "77", alamatIp: "10.0.0.5", agenPeramban: "Uji" };
    await catatJejakMasuk(db, { ...dasar, aletaUserId: pemilik.id, lewat: "", hasil: "ditolak", alasan: "sandi_salah" });
    await catatJejakMasuk(db, { ...dasar, aletaUserId: pemilik.id, lewat: "aleta", hasil: "berhasil", alasan: "sandi_aleta" });
    const audit = await db
      .prepare("SELECT action, payload_json FROM audit_logs WHERE entity_type = 'auth' AND entity_id = ? ORDER BY action")
      .all<{ action: string; payload_json: string }>(pemilik.id);
    const lewat = Object.fromEntries(audit.map((a) => [a.action, JSON.parse(a.payload_json).lewat]));
    expect(lewat.LOGIN_FAILED).not.toBe("sipp");
    expect(lewat.LOGIN_SUCCESS).toBe("aleta");
  });
});

// ============================================================================
// 6. USERNAME SIPP SEBAGAI IDENTITAS: ATURAN PEMILIK BERLAKU
// ============================================================================
describe("6. masuk dengan username SIPP yang disimpan dua akun ALETA", () => {
  it("pemiliknya (uji password terkuat) ditemukan; yang terbukti salah tidak menghalangi", async () => {
    const a = await buatPegawai("pemilik.u5");
    const b = await buatPegawai("lain.u5");
    await pasangSipp(a.id, "pp.sama", { keadaan: "verified" });
    await pasangSipp(b.id, "PP.Sama ", { keadaan: "wrong_password" });
    expect((await lookupUserForLoginInDb(db, { identifier: "pp.sama" }))?.id).toBe(a.id);
  });

  it("kredensial yang dinonaktifkan akun lain tidak menghalangi pemilik", async () => {
    const a = await buatPegawai("pemilik2.u5");
    const b = await buatPegawai("lain2.u5");
    await pasangSipp(a.id, "pp.dua");
    await pasangSipp(b.id, "pp.dua", { aktif: false });
    expect((await lookupUserForLoginInDb(db, { identifier: "pp.dua" }))?.id).toBe(a.id);
  });

  it("setara (tidak ada pemilik): tetap ditolak seperti dulu - lebih baik gagal daripada salah akun", async () => {
    const a = await buatPegawai("setara1.u5");
    const b = await buatPegawai("setara2.u5");
    await pasangSipp(a.id, "pp.setara");
    await pasangSipp(b.id, "pp.setara");
    await expect(lookupUserForLoginInDb(db, { identifier: "pp.setara" })).resolves.toBeNull();
  });

  it("satu-satunya penyimpan yang menonaktifkan kredensialnya tetap ditemukan (fitur lama tidak dikurangi)", async () => {
    const a = await buatPegawai("sendiri.u5");
    await pasangSipp(a.id, "pp.sendiri", { aktif: false });
    expect((await lookupUserForLoginInDb(db, { identifier: "pp.sendiri" }))?.id).toBe(a.id);
  });
});

// ============================================================================
// 7. EKSTENSI: "SUPERVISOR" TANPA PEKA HURUF BESAR
// ============================================================================
describe("7. panel-alat.js: pengecualian akun ABT supervisor", () => {
  const ASAL_ABT = "http://127.0.0.1:8056";
  const BLANGKO_ABT =
    `<form action="${ASAL_ABT}/aps_badilag/login/signin" method="post">` +
    `<input type="text" name="userName" required><input type="password" name="password" required>` +
    `<button class="btn btn-primary submit-btn btn-block">Login</button></form>`;

  async function bukaAbt(username: string) {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>${BLANGKO_ABT}</body></html>`, {
      url: `${ASAL_ABT}/aps_badilag/login`,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    } as ConstructorParameters<typeof JSDOM>[1]);
    const w = dom.window as any;
    const dikirim: Array<Record<string, string>> = [];
    w.document.addEventListener("submit", (e: any) => {
      e.preventDefault();
      dikirim.push(Object.fromEntries(new w.FormData(e.target)));
    });
    w.chrome = {
      runtime: {
        id: "aleta-uji",
        lastError: undefined,
        getManifest: () => ({ version: "9.9.9" }),
        getURL: (p: string) => `chrome-extension://aleta-uji/${p}`,
        sendMessage: (p: any, balik?: (x: unknown) => void) => {
          const j = p && typeof p.jenis === "string" && p.jenis.startsWith("masuk-") ? { ok: true, username, sandi: SANDI_SIPP } : { ok: true };
          if (balik) setTimeout(() => balik(j), 0);
        },
      },
      storage: {
        local: { get: async () => ({}), set: async () => undefined, remove: async () => undefined },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener: () => {} },
      },
    };
    w.fetch = async () => new Response("{}", { status: 404 });
    w.console.warn = () => {};
    w.eval(readFileSync(path.resolve(process.cwd(), "..", "ekstensi-sipp", "panel-alat.js"), "utf8"));
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
    dom.window.close();
    return dikirim;
  }

  it("'Supervisor' / ' SUPERVISOR ' tidak diisi (MySQL ABT tidak membedakan huruf besar)", async () => {
    for (const nama of ["Supervisor", " SUPERVISOR "]) {
      expect(await bukaAbt(nama), nama).toEqual([]);
    }
    // Pembanding: akun biasa tetap diisi.
    expect(await bukaAbt("pp.budi")).toEqual([{ userName: "pp.budi", password: SANDI_SIPP }]);
  });
});
