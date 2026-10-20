// @vitest-environment node
/**
 * TAUTAN JADWAL SIDANG (20 Okt 2026) - sisi server.
 *
 * Tautan membuka Jadwal Sidang TANPA akun, dan tombol tunda | putus-nya
 * menulis ke SIPP. Maka yang dibuktikan di sini penjagaannya:
 *
 *   1. migrasi 0077 (idx 70): berkas = DDL schema.ts, jurnal tanpa lubang;
 *   2. rahasia tersimpan sebagai HASH, bukan teks asli; panjang dan acak;
 *   3. rahasia salah / dicabut / kedaluwarsa / dimatikan: ditolak;
 *   4. alamat di luar jaringan kantor ditolak (bahkan sebelum rahasia diperiksa);
 *   5. hanya rute di daftar izin; rute hakim/pimpinan, kasir, panggil, berkas: 403;
 *   6. tunda lewat tautan tercatat atas akun yang diwakili (bukan hakim/admin),
 *      dengan jejak sumber "tautan jadwal: <nama>", IP, perkara, aksi;
 *   7. batas laju 60 tindakan menulis per jam;
 *   8. pengelolaan hanya Super Admin/Admin; tautan tidak dapat mengelola tautan.
 * Semua nama dan nomor perkara karangan.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_TAUTAN_JADWAL } from "@/server/db/schema";

const keadaan = vi.hoisted(() => ({ db: null as unknown, tunda: [] as Array<Record<string, unknown>> }));

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => keadaan.db };
});
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return {
    ...modul,
    postGatewayTundaSidang: async (badan: Record<string, unknown>) => {
      keadaan.tunda.push(badan);
      return { ok: true, status: 200, data: { tercatat: true } };
    },
  };
});

import {
  BATAS_AKSI_PER_JAM,
  HEADER_TAUTAN_JADWAL,
  RUTE_TAUTAN,
  buatRahasia,
  buatTautan,
  cabutTautan,
  daftarTautan,
  hashRahasia,
  ipJaringanKantor,
  jejakTautan,
  kunciRuteTautan,
  periksaTautan,
  ruteTautanBoleh,
  setSaklarMati,
} from "@/server/modules/tautan-jadwal/service";
import { resolveActorUserId } from "@/server/shared/auth";

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const ADMIN = "usr-admin";
const SUPER = "usr-super";
const PANITERA = "usr-panitera"; // golongan panitera - boleh diwakili
const HAKIM = "usr-hakim"; // TIDAK boleh diwakili
const IP_KANTOR = "192.168.10.44";

function permintaan(jalur: string, opsi: { metode?: string; ip?: string | null; badan?: unknown; header?: Record<string, string> } = {}) {
  const header: Record<string, string> = { ...(opsi.header ?? {}) };
  if (opsi.ip !== null) header["x-forwarded-for"] = opsi.ip ?? IP_KANTOR;
  return new NextRequest(`http://portal.test/aleta${jalur}`, {
    method: opsi.metode ?? "GET",
    headers: header,
    ...(opsi.badan === undefined ? {} : { body: JSON.stringify(opsi.badan) }),
  });
}

let db: AletaDatabase;

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  keadaan.db = db;
}, 180_000);
afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  keadaan.tunda.length = 0;
  await db.run(`DELETE FROM aleta_tautan_jadwal_jejak`);
  await db.run(`DELETE FROM aleta_tautan_jadwal`);
  await db.run(`DELETE FROM aleta_tautan_jadwal_saklar`);
});

async function tautanBaru(nama = "Meja PP Ruang 1", wakil = PANITERA, berlakuSampai = "") {
  return buatTautan(db, ADMIN, { nama, bertindakSebagai: wakil, berlakuSampai });
}

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────
describe("migrasi 0077 - berkas = DDL schema.ts, jurnal tanpa lubang", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0077_aleta_tautan_jadwal.sql");

  it("jurnal: 0077 di idx 70 sekali, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0077_"))).toEqual([
      expect.objectContaining({ idx: 70, tag: "0077_aleta_tautan_jadwal" }),
    ]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_TAUTAN_JADWAL, berjalan di pg-mem, ikut cadangan mode ingatan", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual(
      [...DDL_TAUTAN_JADWAL.tabel, ...DDL_TAUTAN_JADWAL.indeks].map((s) => pernyataan(s)[0])
    );
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT id FROM aleta_tautan_jadwal")).toEqual([]);
    for (const t of ["aleta_tautan_jadwal", "aleta_tautan_jadwal_jejak", "aleta_tautan_jadwal_saklar"]) {
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
  });
});

// ─── 2. Rahasia dan hash ─────────────────────────────────────────────────────
describe("rahasia panjang acak, tersimpan sebagai hash", () => {
  it("rahasia >= 32 karakter, acak, sandi URL aman", () => {
    const a = buatRahasia();
    const b = buatRahasia();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
  });

  it("basis data hanya memuat hash sha256, tidak ada teks rahasia di mana pun", async () => {
    const t = await tautanBaru();
    expect(t.rahasia.length).toBeGreaterThanOrEqual(32);
    expect(t.alamat).toBe(`/jadwal/${t.rahasia}`);
    const baris = await db.queryAll<Record<string, unknown>>(`SELECT * FROM aleta_tautan_jadwal`);
    expect(baris).toHaveLength(1);
    expect(baris[0].hash_rahasia).toBe(hashRahasia(t.rahasia));
    expect(String(baris[0].hash_rahasia)).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(baris)).not.toContain(t.rahasia);
    // audit pembuatan tidak membawa rahasia
    const audit = await db.queryAll<Record<string, unknown>>(`SELECT payload_json FROM audit_logs WHERE action = 'TAUTAN_JADWAL_DIBUAT'`);
    expect(audit.length).toBe(1);
    expect(JSON.stringify(audit)).not.toContain(t.rahasia);
    // daftar untuk admin tidak memuat rahasia maupun hash utuh
    const daftar = await daftarTautan(db, ADMIN);
    expect(JSON.stringify(daftar)).not.toContain(t.rahasia);
    expect(JSON.stringify(daftar)).not.toContain(hashRahasia(t.rahasia));
    expect(daftar.tautan[0]).toMatchObject({ nama: "Meja PP Ruang 1", keadaan: "aktif", bertindakSebagaiId: PANITERA });
  });
});

// ─── 3-4. Penolakan ──────────────────────────────────────────────────────────
describe("pemeriksaan tautan", () => {
  it("rahasia sah dari jaringan kantor: diterima, mewakili akun yang dipilih", async () => {
    const t = await tautanBaru();
    const hasil = await periksaTautan(db, permintaan("/api/aleta-ecourt/sidang?dari=2026-10-20"), t.rahasia);
    expect(hasil.aktor.id).toBe(PANITERA);
    expect(hasil.tautan.nama).toBe("Meja PP Ruang 1");
    expect(hasil.ip).toBe(IP_KANTOR);
  });

  it("rahasia salah, terlalu pendek, atau kosong: 401", async () => {
    await tautanBaru();
    for (const salah of [buatRahasia(), "pendek", "", "x".repeat(43) + "!"]) {
      await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/sidang"), salah)).rejects.toMatchObject({ status: 401 });
    }
  });

  it("dicabut: ditolak segera; kedaluwarsa: ditolak", async () => {
    const a = await tautanBaru("A");
    const b = await tautanBaru("B");
    await cabutTautan(db, ADMIN, a.id);
    await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/sidang"), a.rahasia)).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("dicabut"),
    });
    await db.run(`UPDATE aleta_tautan_jadwal SET berlaku_sampai = ? WHERE id = ?`, [new Date(Date.now() - 60_000).toISOString(), b.id]);
    await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/sidang"), b.rahasia)).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("berakhir"),
    });
    expect((await daftarTautan(db, ADMIN)).tautan.map((x) => x.keadaan).sort()).toEqual(["dicabut", "kedaluwarsa"]);
  });

  it("masa berlaku yang sudah lewat tidak dapat dibuat; yang akan datang diterima", async () => {
    await expect(buatTautan(db, ADMIN, { nama: "X", bertindakSebagai: PANITERA, berlakuSampai: "2020-01-01" })).rejects.toMatchObject({ status: 400 });
    const depan = new Date(Date.now() + 5 * 86_400_000);
    const tanggal = `${depan.getFullYear()}-${String(depan.getMonth() + 1).padStart(2, "0")}-${String(depan.getDate()).padStart(2, "0")}`;
    const t = await buatTautan(db, ADMIN, { nama: "Sementara", bertindakSebagai: PANITERA, berlakuSampai: tanggal });
    await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/sidang"), t.rahasia)).resolves.toBeTruthy();
  });

  it("saklar matikan-semua: semua tautan ditolak; dinyalakan lagi pulih", async () => {
    const t = await tautanBaru();
    await setSaklarMati(db, ADMIN, true);
    await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/sidang"), t.rahasia)).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("dimatikan"),
    });
    expect((await daftarTautan(db, ADMIN)).mati).toBe(true);
    await setSaklarMati(db, ADMIN, false);
    await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/sidang"), t.rahasia)).resolves.toBeTruthy();
  });

  it("alamat di luar jaringan kantor ditolak - rahasia benar maupun salah dijawab SAMA", async () => {
    const t = await tautanBaru();
    for (const ip of ["8.8.8.8", "172.32.0.1", "172.15.9.9", "11.0.0.1", "192.169.1.1", "100.64.0.1"]) {
      const benar = await periksaTautan(db, permintaan("/api/aleta-ecourt/sidang", { ip }), t.rahasia).catch((e) => e);
      const salah = await periksaTautan(db, permintaan("/api/aleta-ecourt/sidang", { ip }), buatRahasia()).catch((e) => e);
      expect(benar).toMatchObject({ status: 403, message: "Tautan jadwal sidang hanya dapat dibuka dari jaringan kantor." });
      expect(salah.message).toBe(benar.message);
    }
    for (const ip of ["10.0.0.5", "10.255.255.254", "172.16.0.1", "172.31.255.1", "192.168.0.1"]) {
      await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/sidang", { ip }), t.rahasia)).resolves.toBeTruthy();
    }
  });

  it("entri X-Forwarded-For buatan peramban tidak menipu: yang dipakai entri TERAKHIR", async () => {
    const t = await tautanBaru();
    const palsu = permintaan("/api/aleta-ecourt/sidang", { ip: null, header: { "x-forwarded-for": "10.1.1.1, 8.8.8.8" } });
    await expect(periksaTautan(db, palsu, t.rahasia)).rejects.toMatchObject({ status: 403 });
  });

  it("ipJaringanKantor: batas rentang tepat", () => {
    expect(ipJaringanKantor("172.16.0.0")).toBe(true);
    expect(ipJaringanKantor("172.31.255.255")).toBe(true);
    expect(ipJaringanKantor("172.32.0.0")).toBe(false);
    expect(ipJaringanKantor("192.168.256.1")).toBe(false);
    expect(ipJaringanKantor("")).toBe(false);
    expect(ipJaringanKantor("::1")).toBe(false);
  });
});

// ─── 5. Daftar izin rute ─────────────────────────────────────────────────────
describe("hanya rute di daftar izin", () => {
  it("rute izin: tunda, putus, Court Calendar, mediator, tombol kanan, dan bacaan jadwal", () => {
    for (const [jalur, metode] of [
      ["/api/aleta-ecourt/sidang", "GET"],
      ["/aleta/api/aleta-ecourt/sidang-tunda", "POST"],
      ["/aleta/api/aleta-ecourt/sidang-putus", "POST"],
      ["/aleta/api/aleta-ecourt/sidang/court-calendar", "POST"],
      ["/aleta/api/aleta-ecourt/sidang/mediator", "POST"],
      ["/aleta/api/aleta-ecourt/sidang/selesai", "POST"],
      ["/aleta/api/aleta-ecourt/sidang/skors", "POST"],
      ["/aleta/api/aleta-ecourt/sidang/berjalan", "POST"],
      ["/aleta/api/aleta-ecourt/keterangan-perkara", "POST"],
      ["/aleta/api/aleta-ecourt/konseptor-sementara", "POST"],
      ["/aleta/api/aleta-ecourt/konseptor-langkah", "POST"],
      ["/aleta/api/jadwal-tautan/sesi", "GET"],
    ] as const) {
      expect(ruteTautanBoleh(jalur, metode), `${metode} ${jalur}`).toBe(true);
    }
  });

  it("rute di luar izin ditolak: antrian-ambil, panggil, kasir, penetapan, berkas, tte, relaas, pengaturan, hakim/pimpinan", () => {
    for (const [jalur, metode] of [
      ["/aleta/api/aleta-ecourt/antrian-ambil", "POST"],
      ["/aleta/api/aleta-ecourt/antrian/panggil", "POST"],
      ["/aleta/api/aleta-ecourt/panggil", "POST"],
      ["/aleta/api/aleta-ecourt/sidang/kasir", "POST"],
      ["/aleta/api/aleta-ecourt/penetapan-kembali", "POST"],
      ["/aleta/api/aleta-ecourt/ecourt-aksi/tte", "POST"],
      ["/aleta/api/aleta-ecourt/ecourt-aksi/verifikasi", "POST"],
      ["/aleta/api/aleta-ecourt/berkas", "GET"],
      ["/aleta/api/aleta-ecourt/relaas-massal", "GET"],
      ["/aleta/api/aleta-ecourt/tautan-jadwal", "GET"],
      ["/aleta/api/aleta-ecourt/tautan-jadwal", "POST"],
      ["/aleta/api/aleta-ecourt/ktp-pihak-pengaturan", "PUT"],
      ["/aleta/api/aleta-ecourt/sidang/tampilan-bawaan", "PUT"],
      ["/aleta/api/portal/session", "GET"],
      ["/aleta/api/admin/database", "GET"],
      ["/aleta/api/aleta-ecourt/sidang", "POST"], // bacaan saja
      ["/aleta/api/aleta-ecourt/sidang-tunda", "DELETE"],
      ["/aleta/api/aleta-ecourt/sidang-tunda/../antrian-ambil", "POST"],
    ] as const) {
      expect(ruteTautanBoleh(jalur, metode), `${metode} ${jalur}`).toBe(false);
    }
    // setiap kunci izin hanya GET/POST - tidak ada PUT/DELETE yang dibuka
    for (const metode of Object.values(RUTE_TAUTAN)) for (const m of metode) expect(["GET", "POST"]).toContain(m);
    expect(kunciRuteTautan("/aleta/api/aleta-ecourt/sidang/")).toBe("aleta-ecourt/sidang");
  });

  it("rute di luar izin dengan rahasia SAH: 403 (rahasia tidak membuka apa pun yang lain)", async () => {
    const t = await tautanBaru();
    await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/antrian-ambil", { metode: "POST", badan: {} }), t.rahasia)).rejects.toMatchObject({ status: 403 });
    await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/tautan-jadwal", { metode: "POST", badan: { aksi: "saklar", mati: true } }), t.rahasia)).rejects.toMatchObject({ status: 403 });
    // penolakan rute tidak meninggalkan jejak tindakan menulis
    expect((await db.queryAll(`SELECT id FROM aleta_tautan_jadwal_jejak`)).length).toBe(0);
  });
});

// ─── pemilihan akun yang diwakili ────────────────────────────────────────────
describe("akun yang diwakili tautan", () => {
  it("hakim, pimpinan, admin, dan super admin TIDAK dapat diwakili", async () => {
    for (const id of [HAKIM, ADMIN, SUPER, "usr-ketua"]) {
      await expect(buatTautan(db, ADMIN, { nama: "X", bertindakSebagai: id })).rejects.toMatchObject({ status: 400 });
    }
    await expect(buatTautan(db, ADMIN, { nama: "", bertindakSebagai: PANITERA })).rejects.toMatchObject({ status: 400 });
    await expect(buatTautan(db, ADMIN, { nama: "X", bertindakSebagai: "tidak-ada" })).rejects.toMatchObject({ status: 400 });
  });

  it("daftar calon hanya memuat panitera pengganti/panitera/panitera muda aktif", async () => {
    const { calon } = await daftarTautan(db, ADMIN);
    expect(calon.map((c) => c.id)).toContain(PANITERA);
    for (const c of calon) expect(["pp", "panitera", "panmud"]).toContain(c.golongan);
    expect(calon.map((c) => c.id)).not.toContain(HAKIM);
  });

  it("akun yang diwakili dinonaktifkan: tautan berhenti", async () => {
    const t = await tautanBaru();
    await db.run(`UPDATE users SET is_active = 0 WHERE id = ?`, [PANITERA]).catch(async () => {
      await db.run(`UPDATE users SET is_active = false WHERE id = ?`, [PANITERA]);
    });
    try {
      await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/sidang"), t.rahasia)).rejects.toMatchObject({ status: 403 });
    } finally {
      await db.run(`UPDATE users SET is_active = 1 WHERE id = ?`, [PANITERA]).catch(async () => {
        await db.run(`UPDATE users SET is_active = true WHERE id = ?`, [PANITERA]);
      });
    }
  });
});

// ─── pengelolaan ─────────────────────────────────────────────────────────────
describe("pengelolaan hanya Super Admin dan Admin", () => {
  it("hakim dan panitera tidak dapat membuat, mencabut, melihat, atau mematikan", async () => {
    const t = await tautanBaru();
    for (const id of [HAKIM, PANITERA]) {
      await expect(buatTautan(db, id, { nama: "X", bertindakSebagai: PANITERA })).rejects.toMatchObject({ status: 403 });
      await expect(cabutTautan(db, id, t.id)).rejects.toMatchObject({ status: 403 });
      await expect(daftarTautan(db, id)).rejects.toMatchObject({ status: 403 });
      await expect(setSaklarMati(db, id, true)).rejects.toMatchObject({ status: 403 });
      await expect(jejakTautan(db, id)).rejects.toMatchObject({ status: 403 });
    }
    await expect(daftarTautan(db, SUPER)).resolves.toBeTruthy();
    await expect(daftarTautan(db, null)).rejects.toMatchObject({ status: 401 });
  });
});

// ─── 6. resolveActorUserId + jejak + tunda atas PP ───────────────────────────
describe("lewat resolveActorUserId: tindakan tunda tercatat atas akun yang diwakili, dengan jejak sumber tautan", () => {
  it("header rahasia sah -> akun yang diwakili; header salah/jaringan luar -> galat (bukan tanpa-pengguna)", async () => {
    const t = await tautanBaru();
    const sah = permintaan("/api/aleta-ecourt/sidang", { header: { [HEADER_TAUTAN_JADWAL]: t.rahasia } });
    await expect(resolveActorUserId(sah)).resolves.toBe(PANITERA);
    const salah = permintaan("/api/aleta-ecourt/sidang", { header: { [HEADER_TAUTAN_JADWAL]: buatRahasia() } });
    await expect(resolveActorUserId(salah)).rejects.toMatchObject({ status: 401 });
    const luar = permintaan("/api/aleta-ecourt/sidang", { ip: "8.8.8.8", header: { [HEADER_TAUTAN_JADWAL]: t.rahasia } });
    await expect(resolveActorUserId(luar)).rejects.toMatchObject({ status: 403 });
  });

  it("POST sidang-tunda lewat tautan: dijalankan atas akun yang diwakili, jejak tertulis, SIPP tidak menerima nama pengguna", async () => {
    const t = await tautanBaru("Meja PP Ruang 1");
    const { POST } = await import("@/app/api/aleta-ecourt/sidang-tunda/route");
    const jawaban = await POST(
      permintaan("/api/aleta-ecourt/sidang-tunda", {
        metode: "POST",
        ip: "192.168.7.21",
        header: { [HEADER_TAUTAN_JADWAL]: t.rahasia, "content-type": "application/json" },
        badan: { jadwalId: "5001", perkaraId: "9001", nomorPerkara: "901/Pdt.G/2026/PA.Dgl", alasanTunda: "Menunggu jawaban", tanggalBerikut: "2099-01-05", kering: true },
      })
    );
    const isi = (await jawaban.json()) as { ok?: boolean; data?: Record<string, unknown>; error?: { message?: string } };
    expect(jawaban.status, JSON.stringify(isi)).toBe(200);
    // yang dikirim ke bot: operator = akun yang diwakili (panitera), IP kantor, tanpa nama pengguna SIPP buatan
    expect(keadaan.tunda).toHaveLength(1);
    expect(keadaan.tunda[0]).toMatchObject({ operator: PANITERA, ip: "192.168.7.21", kering: true });
    expect(keadaan.tunda[0]).not.toHaveProperty("olehUsername");
    // jejak jujur
    const jejak = await db.queryAll<Record<string, string>>(`SELECT * FROM aleta_tautan_jadwal_jejak`);
    expect(jejak).toHaveLength(1);
    expect(jejak[0]).toMatchObject({
      tautan_id: t.id,
      tautan_nama: "Meja PP Ruang 1",
      bertindak_sebagai: PANITERA,
      ip: "192.168.7.21",
      metode: "POST",
      jalur: "aleta-ecourt/sidang-tunda",
      aksi: "tunda sidang (uji kering)",
      perkara: "901/Pdt.G/2026/PA.Dgl",
    });
    expect(Date.parse(jejak[0].waktu)).toBeGreaterThan(Date.now() - 60_000);
    // audit ALETA: sumber "tautan jadwal: <nama>"
    const audit = await db.queryAll<{ payload_json: string; actor_user_id: string }>(
      `SELECT payload_json, actor_user_id FROM audit_logs WHERE action = 'TAUTAN_JADWAL_AKSI'`
    );
    expect(audit).toHaveLength(1);
    expect(JSON.parse(audit[0].payload_json)).toMatchObject({ sumber: "tautan jadwal: Meja PP Ruang 1", ip: "192.168.7.21", perkara: "901/Pdt.G/2026/PA.Dgl" });
    // bacaan tidak dicatat sebagai tindakan menulis
    await resolveActorUserId(permintaan("/api/aleta-ecourt/sidang", { header: { [HEADER_TAUTAN_JADWAL]: t.rahasia } }));
    expect((await db.queryAll(`SELECT id FROM aleta_tautan_jadwal_jejak`)).length).toBe(1);
    // admin melihat jejaknya
    expect((await jejakTautan(db, ADMIN, t.id)).length).toBe(1);
  });

  it("rute pengelolaan dengan rahasia tautan: 403 dari rutenya sendiri", async () => {
    const t = await tautanBaru();
    const { GET, POST } = await import("@/app/api/aleta-ecourt/tautan-jadwal/route");
    const g = await GET(permintaan("/api/aleta-ecourt/tautan-jadwal", { header: { [HEADER_TAUTAN_JADWAL]: t.rahasia } }));
    expect(g.status).toBe(403);
    const p = await POST(
      permintaan("/api/aleta-ecourt/tautan-jadwal", { metode: "POST", header: { [HEADER_TAUTAN_JADWAL]: t.rahasia }, badan: { aksi: "saklar", mati: true } })
    );
    expect(p.status).toBe(403);
    expect(JSON.stringify(await g.json())).not.toContain(t.rahasia);
  });

  it("rute sesi: rahasia sah -> nama + persona tanpa sandi/surel; salah/luar -> kalimat biasa tanpa jadwal", async () => {
    const t = await tautanBaru();
    const { GET } = await import("@/app/api/jadwal-tautan/sesi/route");
    const sah = await GET(permintaan("/api/jadwal-tautan/sesi", { header: { [HEADER_TAUTAN_JADWAL]: t.rahasia } }));
    expect(sah.status).toBe(200);
    const isi = (await sah.json()) as { data: { nama: string; pengguna: Record<string, unknown> } };
    expect(isi.data.nama).toBe("Meja PP Ruang 1");
    expect(isi.data.pengguna).toMatchObject({ id: PANITERA, roleId: "panitera" });
    expect(Object.keys(isi.data.pengguna).sort()).toEqual(["additionalRoleIds", "id", "isActive", "name", "positionId", "roleId"]);
    const baris = await db.queryOne<{ jumlah_pakai: number; terakhir_ip: string }>(`SELECT jumlah_pakai, terakhir_ip FROM aleta_tautan_jadwal WHERE id = ?`, [t.id]);
    expect(Number(baris?.jumlah_pakai)).toBe(1);
    expect(baris?.terakhir_ip).toBe(IP_KANTOR);

    const salah = await GET(permintaan("/api/jadwal-tautan/sesi", { header: { [HEADER_TAUTAN_JADWAL]: buatRahasia() } }));
    expect(salah.status).toBe(401);
    const luar = await GET(permintaan("/api/jadwal-tautan/sesi", { ip: "8.8.8.8", header: { [HEADER_TAUTAN_JADWAL]: t.rahasia } }));
    expect(luar.status).toBe(403);
    const tanpa = await GET(permintaan("/api/jadwal-tautan/sesi"));
    expect(tanpa.status).toBe(401);
  });
});

// ─── 7. Batas laju ───────────────────────────────────────────────────────────
describe("batas laju per tautan", () => {
  it(`tindakan menulis ke-${BATAS_AKSI_PER_JAM + 1} dalam sejam ditolak 429; tautan lain tidak ikut; bacaan tidak dihitung`, async () => {
    const t = await tautanBaru("Padat");
    const lain = await tautanBaru("Lain");
    for (let i = 0; i < BATAS_AKSI_PER_JAM; i += 1) {
      await periksaTautan(db, permintaan("/api/aleta-ecourt/sidang/selesai", { metode: "POST", badan: { nomorPerkara: `${i}/Pdt.G/2026/PA.Dgl` } }), t.rahasia);
    }
    await expect(
      periksaTautan(db, permintaan("/api/aleta-ecourt/sidang/selesai", { metode: "POST", badan: { nomorPerkara: "x" } }), t.rahasia)
    ).rejects.toMatchObject({ status: 429 });
    // bacaan tetap boleh, tautan lain tidak terpengaruh
    await expect(periksaTautan(db, permintaan("/api/aleta-ecourt/sidang"), t.rahasia)).resolves.toBeTruthy();
    await expect(
      periksaTautan(db, permintaan("/api/aleta-ecourt/sidang/selesai", { metode: "POST", badan: {} }), lain.rahasia)
    ).resolves.toBeTruthy();
    // jejak lebih dari sejam lalu tidak dihitung
    await db.run(`UPDATE aleta_tautan_jadwal_jejak SET waktu = ? WHERE tautan_id = ?`, [new Date(Date.now() - 2 * 3_600_000).toISOString(), t.id]);
    await expect(
      periksaTautan(db, permintaan("/api/aleta-ecourt/sidang/selesai", { metode: "POST", badan: {} }), t.rahasia)
    ).resolves.toBeTruthy();
  }, 120_000);
});

// ─── sumber ──────────────────────────────────────────────────────────────────
describe("keterkaitan sumber", () => {
  const baca = (rel: string) => readFileSync(path.join(process.cwd(), "src", rel), "utf8").replace(/\r\n/g, "\n");

  it("resolveActorUserId memeriksa tautan SEBELUM blok try yang menelan galat", () => {
    const auth = baca("server/shared/auth.ts");
    const hook = auth.indexOf("x-tautan-jadwal");
    const mulaiTry = auth.indexOf("try {", auth.indexOf("export async function resolveActorUserId"));
    expect(hook).toBeGreaterThan(-1);
    expect(hook).toBeLessThan(mulaiTry);
  });

  it("tidak ada kata ALETA yang dikirim ke SIPP lewat jejak tautan (hanya tabel ALETA)", () => {
    const layanan = baca("server/modules/tautan-jadwal/service.ts");
    expect(layanan).not.toMatch(/gateway|postGateway|sipp_/i);
  });
});
