// @vitest-environment node
/**
 * ============================================================================
 * U16 - PERKARA TERAKHIR DAN VERSI EKSTENSI MENGIKUTI PENGGUNA, SISI SERVER (rantai B, 25 Okt 2026)
 * ============================================================================
 *   - lib: pembersih konteks.perkara / perangkat.versi, penggabungan, pembanding versi;
 *   - rute /ekstensi/setelan: saklar kinerja.konteksDiServer mati (bawaan) = menulis dua kunci baru ditolak 409
 *     (menghapus tetap boleh); menyala = tersimpan ternormalkan, milik pemanggil saja, penjaga dua-PC 409;
 *   - GET /ekstensi/tampilan: nilainya ikut di `setelan` tanpa permintaan tambahan.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GalatSetelan, KUNCI_SETELAN, normalkanSetelan } from "@/lib/tampilan-ekstensi";
import {
  BATAS_KONTEKS_PERKARA,
  BATAS_PERANGKAT,
  gabungKonteksPerkara,
  normalkanKonteksPerkara,
  normalkanVersiPerangkat,
  versiBedaDiPcLain,
} from "@/lib/konteks-server";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";
vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => db }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const E = (n: number, menit: number, ubah: Record<string, unknown> = {}) => ({
  nomor: `${n}/Pdt.G/2026/PA.Dgl`,
  url: `http://192.168.10.10/SIPP/perkara_detil_agama/AbC${n}==`,
  jenis: "Cerai Gugat",
  waktu: new Date(Date.UTC(2026, 9, 25, 3, 0, 0) - menit * 60000).toISOString(),
  ...ubah,
});

async function setelan(cara: "GET" | "PUT", badan?: unknown) {
  const modul = await import("@/app/api/aleta-ecourt/ekstensi/setelan/route");
  const req = new NextRequest("http://localhost/api/x", {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const j = await (modul as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: j.status, isi: (await j.json()) as any };
}
async function tampilan() {
  const modul = await import("@/app/api/aleta-ecourt/ekstensi/tampilan/route");
  const j = await modul.GET(new NextRequest("http://localhost/api/x"));
  return { status: j.status, isi: (await j.json()) as any };
}
async function nyalakan() {
  const lama = aktor;
  aktor = "usr-super";
  const modul = await import("@/app/api/aleta-ecourt/ekstensi/kinerja/route");
  const j = await modul.PUT(new NextRequest("http://localhost/x", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ konteksDiServer: true }) }));
  expect(j.status).toBe(200);
  aktor = lama;
}

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  aktor = "usr-hakim";
});
afterEach(async () => {
  await db?.close();
  db = null;
});

describe("lib konteks-server", () => {
  it("konteks.perkara: satu entri per nomor (yang terbaru), terbaru dulu, paling banyak 12; entri tak sah dibuang dan dilaporkan", () => {
    const banyak = Array.from({ length: 20 }, (_, i) => E(100 + i, i));
    const r = normalkanKonteksPerkara([...banyak, E(100, 999), E(1, 5, { nomor: "bukan nomor" }), E(2, 5, { url: "javascript:alert(1)" }), E(3, 5, { waktu: "kemarin" }), null, 7]);
    expect(r.nilai).toHaveLength(BATAS_KONTEKS_PERKARA);
    expect(r.nilai[0].nomor).toBe("100/Pdt.G/2026/PA.Dgl");
    expect(r.nilai[0].waktu).toBe(E(100, 0).waktu); // yang terbaru menang atas duplikat tua
    expect(r.nilai.map((x) => x.waktu)).toEqual([...r.nilai.map((x) => x.waktu)].sort().reverse());
    expect(r.dibuang.length).toBe(5);
    expect(() => normalkanKonteksPerkara({})).toThrow(/larik/);
    expect(normalkanKonteksPerkara([E(5, 1, { jenis: "x".repeat(200) })]).nilai[0].jenis.length).toBe(60);
  });

  it("perangkat.versi: id, versi, waktu diperiksa; paling banyak 8 PC (yang paling lama melapor tersingkir)", () => {
    const peta: Record<string, unknown> = {};
    for (let i = 0; i < 12; i += 1) peta[`pc-abcd${i}`] = { versi: "1.205.39", waktu: new Date(Date.UTC(2026, 9, 1 + i)).toISOString() };
    peta["pc"] = { versi: "1.205.39", waktu: new Date().toISOString() };
    peta["pc-salah"] = { versi: "abc", waktu: new Date().toISOString() };
    peta["pc-tanpa-waktu"] = { versi: "1.2.3" };
    const r = normalkanVersiPerangkat(peta);
    expect(Object.keys(r.nilai)).toHaveLength(BATAS_PERANGKAT);
    expect(r.dibuang).toEqual(expect.arrayContaining(["pc", "pc-salah", "pc-tanpa-waktu"]));
    expect(Object.keys(r.nilai)).toContain("pc-abcd11");
    expect(Object.keys(r.nilai)).not.toContain("pc-abcd0");
    expect(() => normalkanVersiPerangkat([])).toThrow(/obyek/);
  });

  it("gabungKonteksPerkara: gabungan dua daftar, satu entri per nomor, batas dihormati", () => {
    const g = gabungKonteksPerkara([E(1, 10), E(2, 5)], [E(1, 1), E(3, 20)], 3);
    expect(g.map((x) => x.nomor.split("/")[0])).toEqual(["1", "2", "3"]);
    expect(g[0].waktu).toBe(E(1, 1).waktu);
    expect(gabungKonteksPerkara(null, undefined)).toEqual([]);
    expect(gabungKonteksPerkara([E(1, 1), E(2, 2), E(3, 3)], [], 2)).toHaveLength(2);
  });

  it("versiBedaDiPcLain: PC ini dan versi sama diabaikan; PC lama (> 30 hari) diabaikan; versi yang sama dikelompokkan", () => {
    const sekarang = new Date("2026-10-25T03:00:00Z");
    const peta = {
      "pc-ini": { versi: "1.205.38", waktu: "2026-10-25T01:00:00Z" },
      "pc-a": { versi: "1.205.38", waktu: "2026-10-24T01:00:00Z" },
      "pc-b": { versi: "1.205.39", waktu: "2026-10-20T01:00:00Z" },
      "pc-c": { versi: "1.205.39", waktu: "2026-10-23T01:00:00Z" },
      "pc-lama": { versi: "1.100.0", waktu: "2026-08-01T01:00:00Z" },
    };
    expect(versiBedaDiPcLain(peta, "pc-ini", "1.205.38", sekarang)).toEqual([{ versi: "1.205.39", waktu: new Date("2026-10-23T01:00:00Z").toISOString(), jumlahPc: 2 }]);
    expect(versiBedaDiPcLain(peta, "pc-x", "1.205.39", sekarang).map((x) => x.versi)).toEqual(["1.205.38"]);
    expect(versiBedaDiPcLain(null, "x", "1", sekarang)).toEqual([]);
  });

  it("normalkanSetelan mengenali dua kunci baru dan batas ukurannya; kunci lama tetap", () => {
    expect(KUNCI_SETELAN).toEqual(expect.arrayContaining(["konteks.perkara", "perangkat.versi", "panel.bawaan"]));
    expect(normalkanSetelan("konteks.perkara", [E(1, 1)]).nilai).toHaveLength(1);
    expect(() => normalkanSetelan("konteks.perkara", "teks")).toThrow(GalatSetelan);
    expect(() => normalkanSetelan("perangkat.versi", [])).toThrow(GalatSetelan);
    expect(() => normalkanSetelan("kunci.asing", {})).toThrow(GalatSetelan);
  });
});

describe("rute /ekstensi/setelan - saklar mati (bawaan)", () => {
  it("menulis dua kunci baru ditolak 409 dan tidak tersimpan; kunci lama tidak terpengaruh; menghapus tetap boleh", async () => {
    expect((await setelan("PUT", { kunci: "konteks.perkara", nilai: [E(1, 1)] })).status).toBe(409);
    expect((await setelan("PUT", { kunci: "perangkat.versi", nilai: { pcaaaa: { versi: "1.205.39", waktu: new Date().toISOString() } } })).status).toBe(409);
    expect((await setelan("GET")).isi.data.setelan).toEqual({});
    expect((await setelan("PUT", { kunci: "panel.bawaan", nilai: { sipp: true } })).status).toBe(200);
    expect((await setelan("PUT", { kunci: "konteks.perkara", nilai: null })).status).toBe(200);
  });
});

describe("rute /ekstensi/setelan - saklar menyala", () => {
  beforeEach(nyalakan);

  it("konteks.perkara tersimpan ternormalkan dan ikut GET /ekstensi/tampilan; milik pemanggil saja", async () => {
    const r = await setelan("PUT", { kunci: "konteks.perkara", nilai: [E(1, 5), E(2, 1), E(3, 1, { nomor: "salah" })] });
    expect(r.status).toBe(200);
    expect(r.isi.data.dibuang).toEqual(["salah"]);
    expect(r.isi.data.nilai.map((x: { nomor: string }) => x.nomor.split("/")[0])).toEqual(["2", "1"]);
    const t = await tampilan();
    expect(t.isi.data.setelan["konteks.perkara"].nilai).toHaveLength(2);
    aktor = "usr-admin";
    expect((await tampilan()).isi.data.setelan["konteks.perkara"]).toBeUndefined();
    expect((await setelan("GET")).isi.data.setelan).toEqual({});
  });

  it("penjaga dua-PC: jikaDiubahPada yang basi ditolak 409 dan tidak menimpa; yang cocok berhasil", async () => {
    const a = await setelan("PUT", { kunci: "konteks.perkara", nilai: [E(1, 5)], jikaDiubahPada: "" });
    expect(a.status).toBe(200);
    const diubah = a.isi.data.diubahPada as string;
    const basi = await setelan("PUT", { kunci: "konteks.perkara", nilai: [E(9, 1)], jikaDiubahPada: "" });
    expect(basi.status).toBe(409);
    const b = await setelan("PUT", { kunci: "konteks.perkara", nilai: [E(2, 1), E(1, 5)], jikaDiubahPada: diubah });
    expect(b.status).toBe(200);
    expect((await setelan("GET")).isi.data.setelan["konteks.perkara"].nilai).toHaveLength(2);
  });

  it("perangkat.versi tersimpan dan ikut tampilan; ukuran berlebih ditolak 400", async () => {
    const waktu = new Date().toISOString();
    expect((await setelan("PUT", { kunci: "perangkat.versi", nilai: { pcaaaa: { versi: "1.205.39", waktu } } })).status).toBe(200);
    expect((await tampilan()).isi.data.setelan["perangkat.versi"].nilai.pcaaaa.versi).toBe("1.205.39");
    const besar = Array.from({ length: 400 }, (_, i) => E(1000 + i, i % 59, { jenis: "j".repeat(60), url: `http://192.168.10.10/SIPP/${"u".repeat(280)}${i}` }));
    // normalisasi memotong ke 12 entri, jadi tetap muat; bentuk salah ditolak
    expect((await setelan("PUT", { kunci: "konteks.perkara", nilai: besar })).isi.data.nilai).toHaveLength(BATAS_KONTEKS_PERKARA);
    expect((await setelan("PUT", { kunci: "perangkat.versi", nilai: "teks" })).status).toBe(400);
  });
});
