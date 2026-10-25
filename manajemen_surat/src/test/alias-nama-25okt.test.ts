// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Penyamar } from "@/lib/aleta-ai/samaran";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALIAS_NAMA } from "@/server/db/schema";
import { muatPenyamar } from "@/server/modules/aleta-ai/samaran";
import { bacaKamus } from "@/server/modules/aleta-ecourt/alias-nama";

/**
 * ============================================================================
 * U18 - KAMUS ALIAS NAMA PIHAK, SISI SERVER (rantai B, 25 Okt 2026)
 * ============================================================================
 *   1. migrasi 0100 = DDL schema.ts, jurnal idx 82 tanpa lubang, tabel ikut cadangan;
 *   2. kamus hanya Admin dan Super Admin (hakim 403); tambah/hapus dengan audit tanpa nama orang; pasangan ganda tidak dobel;
 *   3. pemeriksa: saklar kinerja.ejaanNamaPihak mati = { tersedia: false }; menyala = usulan atas nama yang dikirim, kamus tidak bocor;
 *   4. penyamaran ALETA Ai: varian ejaan memakai KODE SAMARAN nama baku HANYA bila saklar menyala; mati = perilaku lama.
 */

const AKAR = path.resolve(__dirname, "../..");
const SQL = path.join(AKAR, "drizzle", "0100_aleta_alias_nama.sql");
const JURNAL = path.join(AKAR, "drizzle", "meta", "_journal.json");
const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-admin";
vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => db }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

async function kamus(cara: "GET" | "POST", badan?: unknown) {
  const modul = await import("@/app/api/aleta-ecourt/alias-nama/route");
  const req = new NextRequest("http://localhost/api/x", {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const j = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: j.status, isi: (await j.json()) as any };
}
async function periksa(badan: unknown) {
  const modul = await import("@/app/api/aleta-ecourt/alias-nama/periksa/route");
  const j = await modul.POST(new NextRequest("http://localhost/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) }));
  return { status: j.status, isi: (await j.json()) as any };
}
async function saklar(nilai: boolean) {
  const lama = aktor;
  aktor = "usr-super";
  const modul = await import("@/app/api/aleta-ecourt/ekstensi/kinerja/route");
  const j = await modul.PUT(new NextRequest("http://localhost/x", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ejaanNamaPihak: nilai }) }));
  expect(j.status).toBe(200);
  aktor = lama;
}

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-admin";
});
afterEach(async () => {
  await db?.close();
  db = null;
});

describe("migrasi 0100", () => {
  it("jurnal idx 82 bertag 0100 sekali tanpa lubang; DDL berkas = DDL schema.ts; tabel ikut cadangan dan terbentuk", async () => {
    const jurnal = JSON.parse(readFileSync(JURNAL, "utf8")) as { entries: { idx: number; tag: string }[] };
    jurnal.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(jurnal.entries.filter((e) => e.tag.startsWith("0100_"))).toEqual([expect.objectContaining({ idx: 82, tag: "0100_aleta_alias_nama" })]);
    expect(existsSync(SQL)).toBe(true);
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual([...DDL_ALIAS_NAMA.tabel, ...DDL_ALIAS_NAMA.indeks].map((s) => pernyataan(s)[0]));
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_alias_nama");
    const kol = await db!.queryAll<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'aleta_alias_nama'");
    expect(kol.map((k) => k.column_name).sort()).toEqual(["baku", "baku_kunci", "diubah_pada", "dibuat_oleh", "dibuat_pada", "id", "sumber", "varian", "varian_kunci"].sort());
  });
});

describe("kamus: hak dan isi", () => {
  it("tanpa sesi 401; hakim 403 untuk melihat, menambah, menghapus; Admin dan Super Admin boleh", async () => {
    aktor = null;
    expect((await kamus("GET")).status).toBe(401);
    aktor = "usr-hakim";
    expect((await kamus("GET")).status).toBe(403);
    expect((await kamus("POST", { aksi: "tambah", baku: "Muhammad Alwi", varian: ["Moh. Alwi"] })).status).toBe(403);
    expect((await kamus("POST", { aksi: "hapus", baku: "Muhammad Alwi" })).status).toBe(403);
    for (const siapa of ["usr-admin", "usr-super"]) {
      aktor = siapa;
      expect((await kamus("GET")).status).toBe(200);
    }
    expect((await kamus("GET")).isi.data).toMatchObject({ aktif: false, jumlah: 0, kamus: [] });
  });

  it("tambah: varian dikelompokkan per nama baku; pasangan yang sama tidak dobel; masukan salah 400; audit tanpa nama orang", async () => {
    const a = await kamus("POST", { aksi: "tambah", baku: "Muhammad Alwi", varian: "Muhamad Alwi\nMoh. Alwi" });
    expect(a.status).toBe(200);
    expect(a.isi.data.ditambah).toEqual(["Muhamad Alwi", "Moh. Alwi"]);
    const b = await kamus("POST", { aksi: "tambah", baku: "muhammad  alwi", varian: ["Moh. Alwi", "Mohd Alwi"] });
    expect(b.isi.data).toEqual({ ditambah: ["Mohd Alwi"], sudahAda: ["Moh. Alwi"] });
    const daftar = (await kamus("GET")).isi.data;
    expect(daftar.jumlah).toBe(3);
    expect(daftar.kamus).toHaveLength(1);
    expect(daftar.kamus[0].baku).toBe("Muhammad Alwi");
    expect(daftar.kamus[0].varian.map((v: { varian: string }) => v.varian).sort()).toEqual(["Moh. Alwi", "Mohd Alwi", "Muhamad Alwi"]);
    for (const buruk of [{ aksi: "tambah", baku: "", varian: ["x y"] }, { aksi: "tambah", baku: "Ahmad Yani", varian: [] }, { aksi: "tambah", baku: "Ahmad Yani", varian: ["Ahmad Yani"] }, { aksi: "ngawur" }]) {
      expect((await kamus("POST", buruk)).status, JSON.stringify(buruk)).toBe(400);
    }
    const audit = await db!.queryAll<{ action: string; entity_id: string; payload_json: string }>("SELECT action, entity_id, payload_json FROM audit_logs WHERE action IN (?, ?)", ["TAMBAH_ALIAS_NAMA", "HAPUS_ALIAS_NAMA"]);
    expect(audit).toHaveLength(2);
    expect(audit.map((x) => `${x.entity_id}${x.payload_json}`).join("")).not.toMatch(/alwi|muhamad/i);
  });

  it("hapus: satu varian menurut id, atau semua varian satu nama baku; idempoten; tercatat", async () => {
    await kamus("POST", { aksi: "tambah", baku: "Muhammad Alwi", varian: ["Muhamad Alwi", "Moh. Alwi"] });
    await kamus("POST", { aksi: "tambah", baku: "Siti Aminah", varian: ["Siti Amina"] });
    const id = (await kamus("GET")).isi.data.kamus.find((k: { baku: string }) => k.baku === "Muhammad Alwi").varian[0].id as string;
    expect((await kamus("POST", { aksi: "hapus", id })).isi.data).toEqual({ dihapus: 1 });
    expect((await kamus("POST", { aksi: "hapus", id })).isi.data).toEqual({ dihapus: 0 });
    expect((await kamus("POST", { aksi: "hapus", baku: "Muhammad Alwi" })).isi.data).toEqual({ dihapus: 1 });
    expect((await kamus("GET")).isi.data.jumlah).toBe(1);
    expect((await kamus("POST", { aksi: "hapus" })).status).toBe(400);
    expect(await db!.queryAll("SELECT id FROM audit_logs WHERE action = ?", ["HAPUS_ALIAS_NAMA"])).toHaveLength(2);
  });
});

describe("pemeriksa", () => {
  it("saklar mati (bawaan): { tersedia: false } untuk siapa pun yang masuk; tanpa sesi 401", async () => {
    aktor = "usr-hakim";
    expect((await periksa({ nama: [{ asal: "SIPP", nama: "Muhammad Alwi" }] })).isi.data).toEqual({ tersedia: false, alasan: "saklar-mati" });
    aktor = null;
    expect((await periksa({ nama: [] })).status).toBe(401);
  });

  it("menyala: usulan atas nama yang dikirim (beda-ejaan + alias dari kamus); kamus lain tidak ikut keluar", async () => {
    await kamus("POST", { aksi: "tambah", baku: "Muhammad Alwi", varian: ["Mohd Alwi"] });
    await kamus("POST", { aksi: "tambah", baku: "Rahasia Orang Lain", varian: ["Rhs Orang Lain"] });
    await saklar(true);
    aktor = "usr-hakim";
    const r = await periksa({ nama: [{ asal: "SIPP", nama: "Mohd Alwi" }, { asal: "BAS", nama: "Muhammad Alwi" }] });
    expect(r.status).toBe(200);
    expect(r.isi.data.tersedia).toBe(true);
    expect(r.isi.data.kamusKosong).toBe(false);
    expect(r.isi.data.usulan.map((u: { jenis: string }) => u.jenis)).toEqual(["beda-ejaan", "alias"]);
    expect(r.isi.data.usulan.every((u: { usulanBaku: string }) => u.usulanBaku === "Muhammad Alwi")).toBe(true);
    expect(JSON.stringify(r.isi)).not.toMatch(/Rahasia|Rhs/);
    expect((await periksa({ nama: "bukan larik" })).status).toBe(400);
    expect((await periksa({})).status).toBe(400);
  });

  it("tanpa kamus tetap memakai aturan ejaan; kamusKosong:true", async () => {
    await saklar(true);
    const r = await periksa({ nama: [{ asal: "SIPP", nama: "Siti Nur Haliza" }, { asal: "BAS", nama: "Siti Nurhaliza" }] });
    expect(r.isi.data.usulan.map((u: { jenis: string }) => u.jenis)).toEqual(["beda-ejaan"]);
    expect(r.isi.data.kamusKosong).toBe(true);
  });
});

describe("penyamaran ALETA Ai memakai kamus alias", () => {
  const KAMUS = [{ baku: "Muhammad Alwi", varian: ["Muhamad Alwi", "Moh. Alwi"] }];

  it("Penyamar.pakaiAlias: semua ejaan satu orang = satu kode; pulihkan mengembalikan nama baku; tanpa kamus kode berbeda", () => {
    const p = new Penyamar();
    p.pakaiAlias(KAMUS);
    const t = p.samarkan("Saksi Muhammad Alwi hadir. Menurut Muhamad Alwi dan Moh. Alwi, rumahnya di sana.");
    expect(t).not.toMatch(/Alwi/);
    expect([...new Set(t.match(/\[NAMA-\d+\]/g))]).toHaveLength(1);
    expect(p.pulihkan(t)).toContain("Muhammad Alwi");
    expect(p.entri().filter((e) => e.jenis === "NAMA")).toHaveLength(1);

    const tanpa = new Penyamar();
    const u = tanpa.samarkan("Saksi Muhammad Alwi hadir. Saksi Muhamad Alwi juga.");
    expect([...new Set(u.match(/\[NAMA-\d+\]/g))].length).toBeGreaterThan(1);
  });

  it("data alat: nama di ruas identitas yang berupa varian memakai kode nama baku", () => {
    const p = new Penyamar();
    p.pakaiAlias(KAMUS);
    const hasil = p.samarkanData({ pihak: [{ nama: "Muhammad Alwi" }, { nama: "Moh. Alwi" }], keterangan: "Alwi tidak disebut tanpa nama depan" });
    expect(hasil.pihak[0].nama).toBe(hasil.pihak[1].nama);
  });

  it("muatPenyamar: saklar mati = kamus tidak dipakai; menyala = dipakai", async () => {
    await kamusTambah();
    const mati = await muatPenyamar(db!, "pc-x");
    const m = mati.samarkan("Muhammad Alwi dan Moh. Alwi");
    expect([...new Set(m.match(/\[NAMA-\d+\]/g) ?? [])].length).toBeLessThanOrEqual(1);
    expect(m).toContain("Moh. Alwi"); // varian tidak dikenal tanpa kamus
    await saklar(true);
    const nyala = await muatPenyamar(db!, "pc-y");
    const n = nyala.samarkan("Muhammad Alwi dan Moh. Alwi");
    expect(n).not.toContain("Alwi");
    expect([...new Set(n.match(/\[NAMA-\d+\]/g))]).toHaveLength(1);
    expect(await bacaKamus(db!)).toHaveLength(1);
  });

  async function kamusTambah() {
    await kamus("POST", { aksi: "tambah", baku: "Muhammad Alwi", varian: ["Moh. Alwi"] });
  }
});
