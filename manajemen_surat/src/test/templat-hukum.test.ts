// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BENIH_TEMPLAT, KUNCI_PERTIMBANGAN, TANDA_DRAF, kunciTemplatSah } from "@/lib/templat-hukum";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { pastikanBenihTemplat } from "@/server/modules/aleta-ecourt/templat-hukum";

/**
 * ============================================================================
 * TEMPLAT PERTIMBANGAN & DASAR HUKUM (KONTRAK TAHAP 6-7 BAGIAN 2)
 * ============================================================================
 *
 * Yang dijaga:
 *   - benih: empat pertimbangan (gugur, dicabut, verstek, tidak-diterima) dan
 *     pasal a..h, SEMUANYA DRAF, tanpa nomor perkara karangan, tertanam
 *     sekali, dan yang dihapus tidak tumbuh lagi;
 *   - bentuk jawaban persis kontrak;
 *   - semua pegawai membaca, hanya Super Admin mengubah (Admin pun tidak);
 *   - mengesahkan hanya kalimat tersimpan; menyunting mengembalikan ke DRAF;
 *   - satu butir hidup per (jenis, kunci).
 */

describe("benih", () => {
  it("empat status putusan dan huruf a..h, tanpa i..k yang tidak ada di KHI 116", () => {
    const pertimbangan = BENIH_TEMPLAT.filter((b) => b.jenis === "pertimbangan").map((b) => b.kunci);
    expect(pertimbangan).toEqual([...KUNCI_PERTIMBANGAN]);
    const pasal = BENIH_TEMPLAT.filter((b) => b.jenis === "pasal").map((b) => b.kunci);
    expect(pasal).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("huruf a-f menyebut PP 9/1975 Pasal 19 dan KHI 116; g-h hanya KHI", () => {
    for (const b of BENIH_TEMPLAT.filter((x) => x.jenis === "pasal")) {
      expect(b.isi).toContain(`Pasal 116 huruf ${b.kunci} Kompilasi Hukum Islam`);
      if ("abcdef".includes(b.kunci)) expect(b.isi).toContain(`Pasal 19 huruf ${b.kunci} Peraturan Pemerintah Nomor 9 Tahun 1975`);
      else expect(b.isi).not.toContain("Peraturan Pemerintah");
    }
    expect(BENIH_TEMPLAT.find((b) => b.kunci === "f")?.isi).toMatch(/perselisihan dan pertengkaran/);
  });

  it("tidak ada nomor perkara, tanggal, atau nama karangan - hanya penanda", () => {
    for (const b of BENIH_TEMPLAT) {
      expect(b.isi, b.id).not.toMatch(/\d+\/Pdt\.[GP]\/\d{4}/);
      expect(b.isi, b.id).not.toMatch(/\b\d{1,2}\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}/);
      expect(b.judul, b.id).toMatch(/DRAF/);
    }
    for (const b of BENIH_TEMPLAT.filter((x) => x.jenis === "pertimbangan")) expect(b.isi, b.id).toMatch(/\{[a-z_]+\}/);
  });

  it("kunci pasal hanya a..k; pertimbangan berbentuk slug", () => {
    expect(kunciTemplatSah("pasal", "k")).toBe(true);
    expect(kunciTemplatSah("pasal", "l")).toBe(false);
    expect(kunciTemplatSah("pertimbangan", "ditolak")).toBe(true);
    expect(kunciTemplatSah("pertimbangan", "Ditolak!")).toBe(false);
  });
});

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const d = () => db as AletaDatabase;

type Butir = {
  id: string;
  jenis: string;
  kunci: string;
  judul: string;
  isi: string;
  disahkan: boolean;
  disahkanOleh: { id: string; nama: string } | null;
  disahkanPada: string | null;
  diubahPada: string;
};
type Hasil = { status: number; isi: { ok: boolean; data: Record<string, unknown>; error?: { message: string } } };

async function panggil(cara: "GET" | "POST" | "PUT" | "DELETE", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const rute = await import("@/app/api/aleta-ecourt/templat-hukum/route");
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const fungsi = (rute as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara];
  const jawaban = await fungsi(req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

const butirDari = (h: Hasil) => h.isi.data.butir as Butir[];

describe("rute templat-hukum (pg-mem berbenih)", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db?.close();
    db = null;
  });

  it("tanpa sesi: 401", async () => {
    aktor = null;
    expect((await panggil("GET")).status).toBe(401);
    expect((await panggil("POST", { badan: {} })).status).toBe(401);
  });

  it("pegawai biasa membaca benih DRAF dengan bentuk kontrak; tanda DRAF ikut", async () => {
    aktor = "usr-jurusita";
    const r = await panggil("GET", { query: "jenis=pertimbangan" });
    expect(r.status).toBe(200);
    expect(r.isi.data.tandaDraf).toBe(TANDA_DRAF);
    expect(r.isi.data.bolehMenyunting).toBe(false);
    const butir = butirDari(r);
    expect(butir.map((b) => b.kunci).sort()).toEqual([...KUNCI_PERTIMBANGAN].sort());
    for (const b of butir) {
      expect(b).toMatchObject({ jenis: "pertimbangan", disahkan: false, disahkanOleh: null, disahkanPada: null });
      for (const k of ["id", "jenis", "kunci", "judul", "isi", "disahkan", "disahkanOleh", "disahkanPada", "diubahPada"]) {
        expect(b, k).toHaveProperty(k);
      }
    }
    const pasal = butirDari(await panggil("GET", { query: "jenis=pasal" }));
    expect(pasal.map((b) => b.kunci)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect((await panggil("GET", { query: "jenis=amar" })).status).toBe(400);
  });

  it("benih tertanam sekali; yang dihapus tidak tumbuh lagi", async () => {
    await panggil("GET");
    expect(await pastikanBenihTemplat(d())).toBe(0);
    const f = butirDari(await panggil("GET", { query: "jenis=pasal" })).find((b) => b.kunci === "f")!;
    expect((await panggil("DELETE", { query: "id=" + f.id })).status).toBe(200);
    expect(await pastikanBenihTemplat(d())).toBe(0);
    expect(butirDari(await panggil("GET", { query: "jenis=pasal" })).map((b) => b.kunci)).not.toContain("f");
  });

  it("Admin dan hakim tidak dapat mengubah; hanya Super Admin", async () => {
    const id = butirDari(await panggil("GET"))[0].id;
    for (const orang of ["usr-admin", "usr-hakim"]) {
      aktor = orang;
      expect((await panggil("PUT", { badan: { id, sahkan: true } })).status, orang).toBe(403);
      expect((await panggil("POST", { badan: { jenis: "pasal", kunci: "i", judul: "x", isi: "y" } })).status, orang).toBe(403);
      expect((await panggil("DELETE", { query: "id=" + id })).status, orang).toBe(403);
    }
  });

  it("mengesahkan, lalu menyunting mengembalikan ke DRAF; sunting+sahkan sekaligus ditolak", async () => {
    const verstek = butirDari(await panggil("GET", { query: "jenis=pertimbangan" })).find((b) => b.kunci === "verstek")!;
    const s = await panggil("PUT", { badan: { id: verstek.id, sahkan: true } });
    expect(s.status).toBe(200);
    expect(s.isi.data.diubah).toMatchObject({
      disahkan: true,
      disahkanOleh: { id: "usr-super" },
    });
    expect(typeof (s.isi.data.diubah as Butir).disahkanPada).toBe("string");

    expect((await panggil("PUT", { badan: { id: verstek.id, isi: "baru", sahkan: true } })).status).toBe(400);

    const u = await panggil("PUT", { badan: { id: verstek.id, isi: verstek.isi + "\nMenimbang, bahwa {tambahan};" } });
    expect(u.status).toBe(200);
    expect(u.isi.data.diubah).toMatchObject({ disahkan: false, disahkanOleh: null, disahkanPada: null });

    // Mencabut pengesahan eksplisit.
    await panggil("PUT", { badan: { id: verstek.id, sahkan: true } });
    const c = await panggil("PUT", { badan: { id: verstek.id, sahkan: false } });
    expect(c.isi.data.diubah).toMatchObject({ disahkan: false });

    const audit = await d().queryAll<{ action: string }>(
      "SELECT action FROM audit_logs WHERE entity_type = 'aleta_templat_hukum'"
    );
    // Diurutkan di sini: dua catatan dalam milidetik yang sama tidak punya urutan.
    expect(audit.map((a) => a.action).sort()).toEqual(
      ["APPROVE_LEGAL_TEMPLATE", "UPDATE_LEGAL_TEMPLATE", "APPROVE_LEGAL_TEMPLATE", "REVOKE_LEGAL_TEMPLATE"].sort()
    );
  });

  it("tambah: selalu DRAF, satu butir hidup per (jenis, kunci), kunci sesuai jenis", async () => {
    const t = await panggil("POST", { badan: { jenis: "pertimbangan", kunci: "ditolak", judul: "Ditolak", isi: "Menimbang, {x};" } });
    expect(t.status).toBe(200);
    expect(t.isi.data.diubah).toMatchObject({ jenis: "pertimbangan", kunci: "ditolak", disahkan: false });
    expect((await panggil("POST", { badan: { jenis: "pertimbangan", kunci: "ditolak", judul: "Dua", isi: "y" } })).status).toBe(409);
    expect((await panggil("POST", { badan: { jenis: "pasal", kunci: "a", judul: "Dua", isi: "y" } })).status).toBe(409);
    expect((await panggil("POST", { badan: { jenis: "pasal", kunci: "z", judul: "x", isi: "y" } })).status).toBe(400);
    expect((await panggil("POST", { badan: { jenis: "pasal", kunci: "i", judul: "", isi: "y" } })).status).toBe(400);
    expect((await panggil("POST", { badan: { jenis: "pasal", kunci: "i", judul: "Huruf i", isi: "y" } })).status).toBe(200);
  });
});
