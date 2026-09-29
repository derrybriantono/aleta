// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAFTAR_FITUR_EKSTENSI } from "@/lib/daftar-fitur-ekstensi";
import {
  BATAS_TANDA_CHECKLIST,
  KUNCI_PENGATURAN_SINKRON,
  KUNCI_SETELAN,
  GalatSetelan,
  bersihkanFitur,
  normalkanSetelan,
  pecahkanTampilan,
  type PenerapanTampilan,
} from "@/lib/tampilan-ekstensi";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * TAMPILAN EKSTENSI YANG DITERAPKAN (TAHAP 5) - ATURAN, SETELAN, DAN RUTE
 * ============================================================================
 *
 * Yang dijaga:
 *   - pengguna > peran (utama, lalu tambahan menurut urutan) > semua > bawaan
 *     "lama"; paket tidak digabung antarperan;
 *   - kode fitur asing dibuang, "lama" selalu tanpa fitur, dan yang
 *     diterapkan membawa diterapkan: true (bukan mode coba);
 *   - setelan pribadi hanya kunci daftar putih, ukurannya dibatasi, dan tidak
 *     pernah menyentuh setelan orang lain;
 *   - rute: tanpa sesi 401, pegawai biasa 403 di halaman admin, Admin membaca
 *     tetapi tidak menerapkan, Super Admin menerapkan dan menghapus dengan
 *     jejak audit.
 */

const PADA = "2026-09-29T01:00:00.000Z";
const K1 = DAFTAR_FITUR_EKSTENSI[0].kode;
const K2 = DAFTAR_FITUR_EKSTENSI[1].kode;
const K3 = DAFTAR_FITUR_EKSTENSI[DAFTAR_FITUR_EKSTENSI.length - 1].kode;

function p(ubah: Partial<PenerapanTampilan> & Pick<PenerapanTampilan, "lingkup" | "sasaran" | "mode">): PenerapanTampilan {
  return { fitur: {}, catatan: "", diubahOleh: "usr-super", diubahPada: PADA, ...ubah };
}

// ============================================================================
describe("pecahkanTampilan - urutan yang berlaku", () => {
  const hakim = { id: "usr-h", roleId: "hakim", additionalRoleIds: [] as string[] };

  it("tanpa penerapan: bawaan Lama, tidak diterapkan, tanpa fitur", () => {
    expect(pecahkanTampilan([], hakim)).toEqual({
      mode: "lama",
      fitur: {},
      sumber: "bawaan",
      sasaranSumber: "",
      diterapkan: false,
      diubahPada: null,
    });
  });

  it("pengguna > peran > semua, tanpa melihat mana yang lebih baru", () => {
    const semua = p({ lingkup: "semua", sasaran: "", mode: "baru", diubahPada: "2026-09-30T00:00:00.000Z" });
    const peran = p({ lingkup: "peran", sasaran: "hakim", mode: "ui", fitur: { [K1]: true } });
    const orang = p({ lingkup: "pengguna", sasaran: "usr-h", mode: "lama" });

    expect(pecahkanTampilan([semua], hakim)).toMatchObject({ mode: "baru", sumber: "semua", diterapkan: true });
    expect(pecahkanTampilan([semua, peran], hakim)).toMatchObject({
      mode: "ui",
      sumber: "peran",
      sasaranSumber: "hakim",
      fitur: { [K1]: true },
      diterapkan: true,
    });
    // Penerapan orang ke "lama" tetap menang atas UI Baru perannya - dan tetap
    // "diterapkan": admin sengaja mengembalikan orang ini ke Lama.
    expect(pecahkanTampilan([orang, semua, peran], hakim)).toMatchObject({
      mode: "lama",
      sumber: "pengguna",
      sasaranSumber: "usr-h",
      diterapkan: true,
      fitur: {},
    });
  });

  it("penerapan orang/peran lain tidak berlaku", () => {
    const lain = [
      p({ lingkup: "pengguna", sasaran: "usr-lain", mode: "ui" }),
      p({ lingkup: "peran", sasaran: "panitera", mode: "ui" }),
    ];
    expect(pecahkanTampilan(lain, hakim).sumber).toBe("bawaan");
  });

  it("beberapa peran: peran utama menang; bila tidak ada, peran tambahan menurut urutan tercatat; paket TIDAK digabung", () => {
    const daftar = [
      p({ lingkup: "peran", sasaran: "operator", mode: "baru", fitur: { [K1]: true } }),
      p({ lingkup: "peran", sasaran: "jurusita", mode: "ui", fitur: { [K2]: true } }),
    ];
    // Peran utama (hakim) tidak punya penerapan -> tambahan pertama yang punya.
    expect(pecahkanTampilan(daftar, { id: "u", roleId: "hakim", additionalRoleIds: ["jurusita", "operator"] })).toMatchObject({
      mode: "ui",
      sasaranSumber: "jurusita",
      fitur: { [K2]: true },
    });
    expect(pecahkanTampilan(daftar, { id: "u", roleId: "hakim", additionalRoleIds: ["operator", "jurusita"] })).toMatchObject({
      mode: "baru",
      sasaranSumber: "operator",
      fitur: { [K1]: true },
    });
    // Peran utama punya penerapan -> tambahan diabaikan seluruhnya.
    const denganUtama = [...daftar, p({ lingkup: "peran", sasaran: "hakim", mode: "baru", fitur: { [K3]: true } })];
    const hasil = pecahkanTampilan(denganUtama, { id: "u", roleId: "hakim", additionalRoleIds: ["jurusita"] });
    expect(hasil).toMatchObject({ mode: "baru", sasaranSumber: "hakim" });
    expect(hasil.fitur).toEqual({ [K3]: true });
  });

  it("kode fitur asing dibuang, dan Lama selalu tanpa fitur", () => {
    const daftar = [p({ lingkup: "semua", sasaran: "", mode: "ui", fitur: { [K1]: true, "sipp-999": true } as never })];
    expect(pecahkanTampilan(daftar, hakim).fitur).toEqual({ [K1]: true });
    const lama = [p({ lingkup: "semua", sasaran: "", mode: "lama", fitur: { [K1]: true } })];
    expect(pecahkanTampilan(lama, hakim).fitur).toEqual({});
  });
});

describe("bersihkanFitur", () => {
  it("hanya kode dikenal yang bernilai tepat true", () => {
    expect(bersihkanFitur({ [K1]: true, [K2]: false, [K3]: "true", "abt-0": true, x: 1 })).toEqual({ [K1]: true });
    expect(bersihkanFitur(null)).toEqual({});
    expect(bersihkanFitur([K1])).toEqual({});
  });
});

// ============================================================================
describe("normalkanSetelan - daftar putih dan bentuk", () => {
  const kini = new Date(PADA);

  it("kunci di luar daftar putih ditolak, termasuk yang berbau kredensial", () => {
    for (const k of ["token", "sesi", "ujiTampilan", "pengaturan", "", null]) {
      expect(() => normalkanSetelan(k, {}, kini)).toThrow(GalatSetelan);
    }
  });

  it("daftar putih tidak memuat kunci kredensial, sesi, posisi, atau keadaan percobaan", () => {
    const semua = [...KUNCI_SETELAN, ...KUNCI_PENGATURAN_SINKRON].join(" ");
    expect(semua).not.toMatch(/token|sandi|password|sesi|session|cookie|kredensial|secret|posisi|uji|kering|asalPortal/i);
  });

  it("checklist.tanda: selesai/tunda, tunda wajib bertanggal, pada diisi bila kosong", () => {
    const hasil = normalkanSetelan(
      "checklist.tanda",
      {
        "sidang:1": { keadaan: "selesai", sampai: "2026-10-01", pada: "2026-09-28T02:00:00Z" },
        "sidang:2": { keadaan: "tunda", sampai: "2026-09-30T00:00:00.000Z" },
      },
      kini
    );
    expect(hasil.nilai).toEqual({
      "sidang:1": { keadaan: "selesai", sampai: null, pada: "2026-09-28T02:00:00.000Z" },
      "sidang:2": { keadaan: "tunda", sampai: "2026-09-30T00:00:00.000Z", pada: PADA },
    });
    expect(() => normalkanSetelan("checklist.tanda", { a: { keadaan: "tunda" } }, kini)).toThrow(/sampai/);
    expect(() => normalkanSetelan("checklist.tanda", { a: { keadaan: "hapus" } }, kini)).toThrow(GalatSetelan);
    expect(() => normalkanSetelan("checklist.tanda", [], kini)).toThrow(GalatSetelan);
  });

  it("checklist.tanda: lebih dari batas butir ditolak", () => {
    const banyak: Record<string, unknown> = {};
    for (let i = 0; i <= BATAS_TANDA_CHECKLIST; i++) banyak["b" + i] = { keadaan: "selesai" };
    expect(() => normalkanSetelan("checklist.tanda", banyak, kini)).toThrow(/paling banyak/);
  });

  it("pintasan.portal: urutan dan sembunyi dirapikan, ruas asing dibuang dan disebut", () => {
    const hasil = normalkanSetelan("pintasan.portal", { urutan: ["a", "b", "a"], sembunyi: ["c"], warna: "x" }, kini);
    expect(hasil.nilai).toEqual({ urutan: ["a", "b"], sembunyi: ["c"] });
    expect(hasil.dibuang).toEqual(["warna"]);
    expect(() => normalkanSetelan("pintasan.portal", { urutan: "a" }, kini)).toThrow(GalatSetelan);
    expect(() => normalkanSetelan("pintasan.portal", { urutan: ["a\nb"] }, kini)).toThrow(GalatSetelan);
  });

  it("pengaturan.ekstensi: hanya kunci penyimpanan yang boleh sinkron", () => {
    const hasil = normalkanSetelan(
      "pengaturan.ekstensi",
      { temaPanel: "gelap", skalaHuruf: 110, posisiPanel: { x: 1 }, modeKering: true, ujiTampilan: "ui" },
      kini
    );
    expect(hasil.nilai).toEqual({ temaPanel: "gelap", skalaHuruf: 110 });
    expect(hasil.dibuang.sort()).toEqual(["modeKering", "posisiPanel", "ujiTampilan"]);
  });

  it("ukuran dibatasi per kunci", () => {
    expect(() => normalkanSetelan("pengaturan.ekstensi", { warnaSendiri: "x".repeat(20000) }, kini)).toThrow(/terlalu besar/);
  });
});

// ============================================================================
// RUTE - handler sungguhan atas pg-mem berbenih
// ============================================================================

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const d = () => db as AletaDatabase;

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown>; error?: { message: string; details?: unknown } } };

async function panggil(
  modul: "admin" | "tampilan" | "setelan",
  cara: "GET" | "PUT" | "DELETE",
  opsi: { cari?: string; badan?: unknown; query?: string } = {}
): Promise<Hasil> {
  const rute =
    modul === "admin"
      ? await import("@/app/api/aleta-ecourt/tampilan-ekstensi/route")
      : modul === "tampilan"
        ? await import("@/app/api/aleta-ecourt/ekstensi/tampilan/route")
        : await import("@/app/api/aleta-ecourt/ekstensi/setelan/route");
  const alamat =
    "http://localhost/api/x" + (opsi.cari ? "?cari=" + encodeURIComponent(opsi.cari) : opsi.query ? "?" + opsi.query : "");
  const req = new NextRequest(alamat, {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (rute as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

describe("rute tampilan ekstensi (pg-mem berbenih)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db?.close();
    db = null;
  });

  describe("GET /api/aleta-ecourt/ekstensi/tampilan (untuk ekstensi)", () => {
    it("tanpa sesi: 401", async () => {
      aktor = null;
      expect((await panggil("tampilan", "GET")).status).toBe(401);
      expect((await panggil("setelan", "GET")).status).toBe(401);
      expect((await panggil("setelan", "PUT", { badan: { kunci: "pintasan.portal", nilai: {} } })).status).toBe(401);
    });

    it("tanpa penerapan: bawaan Lama, diterapkan false, versi 16 heksa, setelan kosong", async () => {
      aktor = "usr-hakim";
      const r = await panggil("tampilan", "GET");
      expect(r.status).toBe(200);
      expect(Object.keys(r.isi.data).sort()).toEqual(["dibuatPada", "keteranganSetelan", "setelan", "tampilan", "versi"]);
      expect(r.isi.data.tampilan).toMatchObject({ mode: "lama", sumber: "bawaan", diterapkan: false, fitur: {}, labelMode: "Lama" });
      expect(r.isi.data.versi).toMatch(/^[0-9a-f]{16}$/);
      expect(r.isi.data.setelan).toEqual({});
    });

    it("mengikuti penerapan Super Admin dan versinya berubah", async () => {
      aktor = "usr-hakim";
      const sebelum = (await panggil("tampilan", "GET")).isi.data.versi;

      aktor = "usr-super";
      const t = await panggil("admin", "PUT", { badan: { lingkup: "peran", sasaran: "hakim", mode: "ui", fitur: { [K1]: true, "x-1": true } } });
      expect(t.status).toBe(200);
      expect(t.isi.data.fiturDibuang).toEqual(["x-1"]);

      aktor = "usr-hakim";
      const r = await panggil("tampilan", "GET");
      expect(r.isi.data.tampilan).toMatchObject({
        mode: "ui",
        labelMode: "UI Baru",
        sumber: "peran",
        sasaranSumber: "hakim",
        diterapkan: true,
        fitur: { [K1]: true },
      });
      expect(r.isi.data.versi).not.toBe(sebelum);

      // Peran lain tidak terkena.
      aktor = "usr-panitera";
      expect((await panggil("tampilan", "GET")).isi.data.tampilan).toMatchObject({ mode: "lama", sumber: "bawaan" });
    });

    it("peran tambahan tercatat di akun ikut dihitung", async () => {
      await d().run("UPDATE users SET additional_role_ids_json = ? WHERE id = ?", [JSON.stringify(["operator"]), "usr-ppg"]);
      await panggil("admin", "PUT", { badan: { lingkup: "peran", sasaran: "operator", mode: "baru" } });
      aktor = "usr-ppg";
      expect((await panggil("tampilan", "GET")).isi.data.tampilan).toMatchObject({ mode: "baru", sumber: "peran", sasaranSumber: "operator" });
    });
  });

  describe("/api/aleta-ecourt/tampilan-ekstensi (halaman admin)", () => {
    it("pegawai biasa: 403 untuk membaca maupun menerapkan", async () => {
      aktor = "usr-hakim";
      expect((await panggil("admin", "GET")).status).toBe(403);
      expect((await panggil("admin", "PUT", { badan: { lingkup: "semua", mode: "ui" } })).status).toBe(403);
      expect((await panggil("admin", "DELETE", { query: "lingkup=semua" })).status).toBe(403);
    });

    it("Admin membaca (bolehMenyunting false) tetapi tidak dapat menerapkan", async () => {
      aktor = "usr-admin";
      const r = await panggil("admin", "GET");
      expect(r.status).toBe(200);
      expect(r.isi.data.bolehMenyunting).toBe(false);
      expect((await panggil("admin", "PUT", { badan: { lingkup: "semua", mode: "ui" } })).status).toBe(403);
    });

    it("GET memuat daftar fitur dari server dan ringkasan siapa mendapat apa", async () => {
      const r = await panggil("admin", "GET");
      expect(r.status).toBe(200);
      const data = r.isi.data as {
        bolehMenyunting: boolean;
        daftarFitur: unknown[];
        peran: { roleId: string }[];
        ringkasan: { jumlah: Record<string, number>; pegawai: { userId: string; mode: string; sumber: string }[] };
      };
      expect(data.bolehMenyunting).toBe(true);
      expect(data.daftarFitur).toHaveLength(DAFTAR_FITUR_EKSTENSI.length);
      expect(data.peran.map((x) => x.roleId)).toContain("hakim");
      const total = data.ringkasan.pegawai.length;
      expect(total).toBeGreaterThan(3);
      expect(data.ringkasan.jumlah).toEqual({ lama: total, baru: 0, ui: 0 });
    });

    it("semua + peran + orang: ringkasan dihitung dengan aturan yang sama dengan ekstensi", async () => {
      await panggil("admin", "PUT", { badan: { lingkup: "semua", mode: "baru" } });
      await panggil("admin", "PUT", { badan: { lingkup: "peran", sasaran: "hakim", mode: "ui" } });
      const r = await panggil("admin", "PUT", { badan: { lingkup: "pengguna", sasaran: "usr-panitera", mode: "lama", catatan: "uji" } });
      expect(r.status).toBe(200);
      const pegawai = (r.isi.data as { ringkasan: { pegawai: { userId: string; mode: string; sumber: string }[] } }).ringkasan.pegawai;
      const cari = (id: string) => pegawai.find((x) => x.userId === id);
      expect(cari("usr-hakim")).toMatchObject({ mode: "ui", sumber: "peran" });
      expect(cari("usr-panitera")).toMatchObject({ mode: "lama", sumber: "pengguna" });
      expect(cari("usr-ketua")).toMatchObject({ mode: "baru", sumber: "semua" });
      const penerapan = (r.isi.data as { penerapan: { lingkup: string; labelSasaran: string; sasaranAda: boolean }[] }).penerapan;
      expect(penerapan).toHaveLength(3);
      expect(penerapan.every((x) => x.sasaranAda)).toBe(true);
    });

    it("menimpa penerapan sasaran yang sama, bukan menggandakannya", async () => {
      await panggil("admin", "PUT", { badan: { lingkup: "peran", sasaran: "hakim", mode: "ui" } });
      const r = await panggil("admin", "PUT", { badan: { lingkup: "peran", sasaran: "hakim", mode: "baru" } });
      const penerapan = (r.isi.data as { penerapan: { mode: string }[] }).penerapan;
      expect(penerapan).toEqual([expect.objectContaining({ mode: "baru" })]);
    });

    it("menolak lingkup, mode, dan sasaran yang tidak sah dengan 400", async () => {
      for (const badan of [
        { lingkup: "jabatan", mode: "ui" },
        { lingkup: "semua", mode: "modern" },
        { lingkup: "peran", sasaran: "tidak-ada", mode: "ui" },
        { lingkup: "peran", mode: "ui" },
        { lingkup: "pengguna", sasaran: "usr-tidak-ada", mode: "ui" },
      ]) {
        const r = await panggil("admin", "PUT", { badan });
        expect(r.status, JSON.stringify(badan)).toBe(400);
      }
      expect(await d().queryAll("SELECT * FROM aleta_ekstensi_tampilan")).toEqual([]);
    });

    it("menghapus: sasaran kembali ke lingkup lebih luas; hapus yang tidak ada = 404", async () => {
      await panggil("admin", "PUT", { badan: { lingkup: "semua", mode: "baru" } });
      await panggil("admin", "PUT", { badan: { lingkup: "peran", sasaran: "hakim", mode: "ui" } });
      const r = await panggil("admin", "DELETE", { query: "lingkup=peran&sasaran=hakim" });
      expect(r.status).toBe(200);
      aktor = "usr-hakim";
      expect((await panggil("tampilan", "GET")).isi.data.tampilan).toMatchObject({ mode: "baru", sumber: "semua" });
      aktor = "usr-super";
      expect((await panggil("admin", "DELETE", { query: "lingkup=peran&sasaran=hakim" })).status).toBe(404);
      // Badan JSON juga diterima.
      expect((await panggil("admin", "DELETE", { badan: { lingkup: "semua" } })).status).toBe(200);
    });

    it("setiap penerapan dan penghapusan tercatat di audit_logs", async () => {
      await panggil("admin", "PUT", { badan: { lingkup: "peran", sasaran: "hakim", mode: "ui", fitur: { [K1]: true } } });
      await panggil("admin", "DELETE", { query: "lingkup=peran&sasaran=hakim" });
      const audit = await d().queryAll<{ action: string; entity_id: string; actor_user_id: string; payload_json: string }>(
        "SELECT action, entity_id, actor_user_id, payload_json FROM audit_logs WHERE entity_type = 'aleta_ekstensi_tampilan' ORDER BY created_at ASC"
      );
      expect(audit.map((a) => a.action)).toEqual(["UPDATE_ECOURT_EXTENSION_DISPLAY", "DELETE_ECOURT_EXTENSION_DISPLAY"]);
      expect(audit.every((a) => a.entity_id === "peran:hakim" && a.actor_user_id === "usr-super")).toBe(true);
      expect(JSON.parse(audit[0].payload_json)).toMatchObject({ mode: "ui", fitur: [K1] });
    });

    it("GET ?cari= menjawab pegawai beserta tampilan yang kini berlaku", async () => {
      const r = await panggil("admin", "GET", { cari: "hakim" });
      expect(r.status).toBe(200);
      const hasil = r.isi.data.hasil as { userId: string; labelMode: string }[];
      expect(hasil.some((h) => h.userId === "usr-hakim")).toBe(true);
      expect(hasil.every((h) => h.labelMode === "Lama")).toBe(true);
    });
  });

  describe("/api/aleta-ecourt/ekstensi/setelan (milik sendiri)", () => {
    it("menyimpan, membaca, dan menghapus setelan sendiri; tampil juga di /ekstensi/tampilan", async () => {
      aktor = "usr-hakim";
      const s = await panggil("setelan", "PUT", { badan: { kunci: "pintasan.portal", nilai: { urutan: ["a", "b"], x: 1 } } });
      expect(s.status).toBe(200);
      expect(s.isi.data).toMatchObject({ kunci: "pintasan.portal", nilai: { urutan: ["a", "b"], sembunyi: [] }, dihapus: false, dibuang: ["x"] });
      expect(s.isi.data.diubahPada).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      const g = await panggil("setelan", "GET");
      expect(g.isi.data.setelan).toEqual({ "pintasan.portal": { nilai: { urutan: ["a", "b"], sembunyi: [] }, diubahPada: s.isi.data.diubahPada } });
      expect((await panggil("tampilan", "GET")).isi.data.setelan).toEqual(g.isi.data.setelan);

      // Orang lain tidak melihatnya.
      aktor = "usr-panitera";
      expect((await panggil("setelan", "GET")).isi.data.setelan).toEqual({});

      aktor = "usr-hakim";
      const h = await panggil("setelan", "PUT", { badan: { kunci: "pintasan.portal", nilai: null } });
      expect(h.isi.data).toMatchObject({ dihapus: true, nilai: null });
      expect((await panggil("setelan", "GET")).isi.data.setelan).toEqual({});
    });

    it("kunci di luar daftar putih, bentuk salah, dan badan tanpa nilai: 400", async () => {
      aktor = "usr-hakim";
      for (const badan of [
        { kunci: "token", nilai: "abc" },
        { kunci: "checklist.tanda", nilai: [] },
        { kunci: "pintasan.portal" },
      ]) {
        expect((await panggil("setelan", "PUT", { badan })).status, JSON.stringify(badan)).toBe(400);
      }
      expect(await d().queryAll("SELECT * FROM aleta_ekstensi_setelan")).toEqual([]);
    });

    it("jikaDiubahPada: 409 bila sudah diubah dari PC lain, tanpa menimpa", async () => {
      aktor = "usr-hakim";
      const pertama = await panggil("setelan", "PUT", { badan: { kunci: "pengaturan.ekstensi", nilai: { temaPanel: "gelap" } } });
      const cap = pertama.isi.data.diubahPada as string;

      const kedua = await panggil("setelan", "PUT", {
        badan: { kunci: "pengaturan.ekstensi", nilai: { temaPanel: "terang" }, jikaDiubahPada: cap },
      });
      expect(kedua.status).toBe(200);
      expect(kedua.isi.data.diubahPada).not.toBe(cap);

      // PC yang masih memegang cap lama ditolak.
      const basi = await panggil("setelan", "PUT", {
        badan: { kunci: "pengaturan.ekstensi", nilai: { temaPanel: "sistem" }, jikaDiubahPada: cap },
      });
      expect(basi.status).toBe(409);
      expect(basi.isi.error?.details).toMatchObject({ kunci: "pengaturan.ekstensi", diubahPadaSekarang: kedua.isi.data.diubahPada });
      expect(((await panggil("setelan", "GET")).isi.data.setelan as Record<string, { nilai: unknown }>)["pengaturan.ekstensi"].nilai).toEqual({
        temaPanel: "terang",
      });

      // "" = "saya kira belum pernah tersimpan" - ditolak karena sudah ada.
      expect(
        (await panggil("setelan", "PUT", { badan: { kunci: "pengaturan.ekstensi", nilai: {}, jikaDiubahPada: "" } })).status
      ).toBe(409);
    });
  });
});
