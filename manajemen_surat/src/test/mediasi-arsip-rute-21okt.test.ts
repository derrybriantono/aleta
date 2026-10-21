// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { UserPersona } from "@/lib/types";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * Rute arsip hasil mediasi (21 Okt 2026): multipart unggah, daftar, berkas biner (Content-Disposition, tanpa
 * tembolok), hapus dengan konfirmasi, dan jejak kiriman SIPP - dijalankan SUNGGUHAN (hanya sesi dan basis data
 * ditiru), supaya bentuk jawaban yang dibaca ekstensi (mediasi-arsip.js) terjaga.
 */

const orang = (id: string, nama: string, roleId: string): UserPersona => ({ id, name: nama, username: id, roleId, positionId: "", additionalRoleIds: [], isActive: true }) as unknown as UserPersona;
const PENGGUNA: Record<string, UserPersona> = { med: orang("r-med", "Hakim Mediator", "hakim"), ptsp: orang("r-ptsp", "PTSP", "operator"), adm: orang("r-adm", "Admin", "admin") };
const keadaan = { db: null as AletaDatabase | null, aktor: "med", akar: "" };

vi.mock("@/server/db/client", async (asli) => ({ ...(await asli<typeof import("@/server/db/client")>()), getDatabase: async () => keadaan.db }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => PENGGUNA[keadaan.aktor].id }));
vi.mock("@/server/modules/organization/service", () => ({ requireActorUser: async () => PENGGUNA[keadaan.aktor] }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (error: { status?: number; message?: string; details?: unknown }) =>
    Response.json({ ok: false, error: { message: error?.message, details: error?.details } }, { status: error?.status ?? 500 }),
}));
vi.mock("@/server/modules/aleta-ecourt/konversi-naskah", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-ecourt/konversi-naskah")>()),
  konversiNaskah: async () => ({ berkasBase64: Buffer.from("%PDF-1.4\n% hasil konversi\n%%EOF").toString("base64") }),
}));

const NOMOR = "684/Pdt.G/2026/PA.Dgl";
const PDF = (isi: string) => new File([`%PDF-1.4\n% ${isi}\n%%EOF`], "Laporan Mediasi.pdf", { type: "application/pdf" });
const RTF = new File(["{\\rtf1\\ansi Kesepakatan\\par}"], "Kesepakatan.rtf", { type: "application/rtf" });

describe("rute /api/aleta-ecourt/mediasi-arsip", () => {
  beforeAll(async () => {
    keadaan.db = await createAletaDatabase({ useInMemory: true });
    keadaan.akar = mkdtempSync(path.join(tmpdir(), "mdsr-"));
    process.env.ALETA_UPLOAD_DIR = keadaan.akar;
  }, 180000);
  afterAll(async () => {
    await keadaan.db?.close();
    delete process.env.ALETA_UPLOAD_DIR;
    rmSync(keadaan.akar, { recursive: true, force: true });
  });

  const url = (jalur: string, kueri = "") => `http://x/api/aleta-ecourt/mediasi-arsip${jalur}${kueri}`;
  const unggah = async (berkas: File, tambahan: Record<string, string> = {}) => {
    const { POST } = await import("@/app/api/aleta-ecourt/mediasi-arsip/route");
    const f = new FormData();
    f.append("berkas", berkas, berkas.name);
    f.append("nomorPerkara", NOMOR);
    f.append("urutanMediasi", "1");
    for (const [k, v] of Object.entries(tambahan)) f.append(k, v);
    return POST(new NextRequest(url(""), { method: "POST", body: f }));
  };

  it("PTSP: 403 pada daftar dan unggah", async () => {
    keadaan.aktor = "ptsp";
    const { GET } = await import("@/app/api/aleta-ecourt/mediasi-arsip/route");
    expect((await GET(new NextRequest(url("", `?nomorPerkara=${encodeURIComponent(NOMOR)}`)))).status).toBe(403);
    expect((await unggah(PDF("p"))).status).toBe(403);
  });

  it("unggah PDF dan RTF -> daftar -> berkas biner (PDF dan asli) -> ganda 409 -> ganti -> hapus -> jejak kiriman", async () => {
    keadaan.aktor = "med";
    const { GET, DELETE } = await import("@/app/api/aleta-ecourt/mediasi-arsip/route");
    const { GET: ISI } = await import("@/app/api/aleta-ecourt/mediasi-arsip/berkas/route");
    const { POST: JEJAK } = await import("@/app/api/aleta-ecourt/mediasi-arsip/jejak/route");

    const a = await (await unggah(PDF("pertama"))).json();
    expect(a.data.ok).toBe(true);
    const r = await (await unggah(RTF)).json();
    expect(r.data.berkas).toMatchObject({ bentukAsal: "rtf", adaPdf: true });

    const daftar = await (await GET(new NextRequest(url("", `?nomorPerkara=${encodeURIComponent(NOMOR)}`)))).json();
    expect(daftar.data.berkas).toHaveLength(2);
    expect(daftar.data.hak).toEqual({ lihat: true, unggah: true });

    const pdf = await ISI(new NextRequest(url("/berkas", `?id=${r.data.berkas.id}&bentuk=pdf&aksi=lihat`)));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toContain("Kesepakatan.pdf");
    expect(pdf.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const asli = await ISI(new NextRequest(url("/berkas", `?id=${r.data.berkas.id}&bentuk=asli&aksi=unduh`)));
    expect(asli.headers.get("content-type")).toBe("application/rtf");
    expect(asli.headers.get("content-disposition")).toContain("Kesepakatan.rtf");

    const ganda = await unggah(PDF("pertama"));
    expect(ganda.status).toBe(409);

    const tanpaKonfirmasi = await unggah(PDF("kedua"), { gantiId: a.data.berkas.id });
    expect(tanpaKonfirmasi.status).toBe(409);
    const ganti = await (await unggah(PDF("kedua"), { gantiId: a.data.berkas.id, konfirmasiGanti: "1" })).json();
    expect(ganti.data.berkas.versi).toBe(2);

    const j = await (await JEJAK(new NextRequest(url("/jejak"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: ganti.data.berkas.id, hasil: "berhasil", akunSipp: "mediator1" }) }))).json();
    expect(j.data.ok).toBe(true);

    expect((await DELETE(new NextRequest(url("", `?id=${r.data.berkas.id}`), { method: "DELETE" }))).status).toBe(409); // tanpa konfirmasi
    const hapus = await DELETE(new NextRequest(url("", `?id=${r.data.berkas.id}&konfirmasi=1&alasan=uji`), { method: "DELETE" }));
    expect(hapus.status).toBe(200);
    const akhir = await (await GET(new NextRequest(url("", `?nomorPerkara=${encodeURIComponent(NOMOR)}`)))).json();
    expect(akhir.data.berkas.map((b: { versi: number }) => b.versi)).toEqual([2]);
    expect((await ISI(new NextRequest(url("/berkas", `?id=${r.data.berkas.id}`)))).status).toBe(404);
  });

  it("tanpa berkas dipilih: jawaban jelas, bukan galat", async () => {
    keadaan.aktor = "med";
    const { POST } = await import("@/app/api/aleta-ecourt/mediasi-arsip/route");
    const f = new FormData();
    f.append("nomorPerkara", NOMOR);
    const h = await (await POST(new NextRequest(url(""), { method: "POST", body: f }))).json();
    expect(h.data).toMatchObject({ ok: false, sebab: "Berkasnya belum dipilih." });
  });
});
