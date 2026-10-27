// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/shared/errors";

/**
 * Rute /api/aleta-ecourt/sidang-terjadwal (27 Okt 2026): bentuk permintaan JSON (tunda) dan multipart (BAS)
 * diteruskan ke layanan persis menurut kontrak, ukuran berkas diperiksa sebelum dibaca, galat hak keluar
 * sebagai 401/403. Layanan dan basis data ditiru; yang diuji bentuk rutenya.
 */

const keadaan = vi.hoisted(() => ({
  buat: vi.fn(),
  daftar: vi.fn(),
  kelola: vi.fn(),
  aktor: "usr-uji" as string | null,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({
  resolveActorUserId: async () => {
    if (!keadaan.aktor) throw new (await import("@/server/shared/errors")).ApiError(401, "Belum masuk.");
    return keadaan.aktor;
  },
}));
vi.mock("@/server/modules/sidang-terjadwal/layanan", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/sidang-terjadwal/layanan")>();
  return { ...mod, buatTerjadwal: keadaan.buat, daftarTerjadwal: keadaan.daftar, kelolaTerjadwal: keadaan.kelola };
});

const URL_DASAR = "http://uji.local/aleta/api/aleta-ecourt/sidang-terjadwal";
const req = (url: string, init?: RequestInit) => new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
const isi = async (r: Response) => (await r.json()) as { ok: boolean; data?: Record<string, any>; error?: { message: string } };
const JSON_HEADER = { "content-type": "application/json" };

describe("rute sidang-terjadwal", () => {
  beforeEach(() => {
    keadaan.buat.mockReset();
    keadaan.daftar.mockReset();
    keadaan.kelola.mockReset();
    keadaan.aktor = "usr-uji";
  });

  it("GET: parameter diteruskan, jawaban memuat butir dan pelaksanaNyala", async () => {
    keadaan.daftar.mockResolvedValue({ butir: [{ id: "sdt-1" }] });
    const { GET } = await import("@/app/api/aleta-ecourt/sidang-terjadwal/route");
    const r = await GET(req(`${URL_DASAR}?jenis=bas&aktif=1&semua=1&jadwalId=7001`));
    const j = await isi(r);
    expect(j).toMatchObject({ ok: true, data: { ok: true, butir: [{ id: "sdt-1" }], pelaksanaNyala: true } });
    expect(keadaan.daftar).toHaveBeenCalledWith(expect.anything(), "usr-uji", { jenis: "bas", aktif: true, semua: true, jadwalId: "7001", batas: undefined });
  });

  it("GET tanpa sesi: 401", async () => {
    keadaan.aktor = null;
    const { GET } = await import("@/app/api/aleta-ecourt/sidang-terjadwal/route");
    expect((await GET(req(URL_DASAR))).status).toBe(401);
  });

  it("POST JSON (tunda): badan diteruskan ke layanan; ip dari peramban; penolakan ok:false dengan tolak[] diteruskan apa adanya", async () => {
    keadaan.buat.mockResolvedValue({ ok: false, sebab: "x", tolak: [{ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", sebab: "x" }] });
    const { POST } = await import("@/app/api/aleta-ecourt/sidang-terjadwal/route");
    const butir = [{ jadwalId: "9001", perkaraId: "101", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-27" }];
    const r = await POST(
      req(URL_DASAR, {
        method: "POST",
        headers: { ...JSON_HEADER, "x-forwarded-for": "192.168.9.97" },
        body: JSON.stringify({ jenis: "tunda", mulai: "2026-10-27 09:00", jedaMin: 90, butir }),
      })
    );
    expect(await isi(r)).toMatchObject({ ok: true, data: { ok: false, sebab: "x", tolak: [{ nomorPerkara: "1/Pdt.G/2026/PA.Dgl" }] } });
    const [, userId, ip, masukan] = keadaan.buat.mock.calls[0];
    expect(userId).toBe("usr-uji");
    expect(ip).toBe("192.168.9.97");
    expect(masukan).toMatchObject({ jenis: "tunda", mulai: "2026-10-27 09:00", jedaMin: 90, butir });
  });

  it("POST multipart (BAS): berkas dibaca per nama field yang disebut butir; field lain dan jeda diteruskan", async () => {
    keadaan.buat.mockResolvedValue({
      ok: true,
      butir: [{ id: "sdt-1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", waktuWita: "2026-10-27 09:00" }],
      perkiraanSelesai: "2026-10-27 09:00",
      peringatan: [],
    });
    const { POST } = await import("@/app/api/aleta-ecourt/sidang-terjadwal/route");
    const form = new FormData();
    form.set("jenis", "bas");
    form.set("mulai", "2026-10-27 09:00");
    form.set("jedaMin", "60");
    form.set(
      "butir",
      JSON.stringify([{ perkaraId: "101", sidangId: "7001", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-26", berkas: "b1", ganti: true }])
    );
    form.set("b1", new File([new Uint8Array([123, 92, 114, 116, 102])], "bas.rtf"));
    form.set("lain", new File([new Uint8Array([1])], "tak-disebut.rtf"));
    const r = await POST(req(URL_DASAR, { method: "POST", body: form }));
    expect(await isi(r)).toMatchObject({ ok: true, data: { ok: true, perkiraanSelesai: "2026-10-27 09:00" } });
    const masukan = keadaan.buat.mock.calls[0][3];
    expect(masukan).toMatchObject({ jenis: "bas", mulai: "2026-10-27 09:00", jedaMin: "60" });
    expect(Object.keys(masukan.berkas)).toEqual(["b1"]);
    expect(masukan.berkas.b1.nama).toBe("bas.rtf");
    expect(Array.from(masukan.berkas.b1.bita)).toEqual([123, 92, 114, 116, 102]);
    expect(masukan.butir[0]).toMatchObject({ sidangId: "7001", ganti: true });
  });

  it("POST multipart: berkas > 10 MB ditolak SEBELUM dibaca; daftar butir rusak ditolak", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/sidang-terjadwal/route");
    const form = new FormData();
    form.set("jenis", "bas");
    form.set("mulai", "2026-10-27 09:00");
    form.set("butir", JSON.stringify([{ perkaraId: "101", sidangId: "7001", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-26", berkas: "b1" }]));
    form.set("b1", new File([new Uint8Array(10 * 1024 * 1024 + 1)], "besar.rtf"));
    const j = await isi(await POST(req(URL_DASAR, { method: "POST", body: form })));
    expect(j.data).toMatchObject({ ok: false, tolak: [{ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", sebab: "Berkas BAS melampaui 10 MB." }] });
    expect(keadaan.buat).not.toHaveBeenCalled();
    const rusak = new FormData();
    rusak.set("butir", "{bukan json");
    expect((await isi(await POST(req(URL_DASAR, { method: "POST", body: rusak })))).data).toMatchObject({ ok: false, sebab: "Daftar sidang tidak terbaca." });
  });

  it("hak: galat 403 dari layanan keluar sebagai 403 (POST dan PATCH)", async () => {
    keadaan.buat.mockRejectedValue(new ApiError(403, "Peran Anda tidak diberi hak ini."));
    keadaan.kelola.mockRejectedValue(new ApiError(403, "Jadwal ini bukan milik Anda."));
    const { POST, PATCH } = await import("@/app/api/aleta-ecourt/sidang-terjadwal/route");
    const p = await POST(req(URL_DASAR, { method: "POST", headers: JSON_HEADER, body: JSON.stringify({ jenis: "tunda", butir: [] }) }));
    expect(p.status).toBe(403);
    const k = await PATCH(req(URL_DASAR, { method: "PATCH", headers: JSON_HEADER, body: JSON.stringify({ aksi: "batal", id: "sdt-1" }) }));
    expect(k.status).toBe(403);
  });

  it("PATCH: aksi, id, dan wita diteruskan; jawabannya butir terbaru", async () => {
    keadaan.kelola.mockResolvedValue({ ok: true, butir: { id: "sdt-1", status: "menunggu" }, ringkas: "ok" });
    const { PATCH } = await import("@/app/api/aleta-ecourt/sidang-terjadwal/route");
    const r = await PATCH(
      req(URL_DASAR, { method: "PATCH", headers: JSON_HEADER, body: JSON.stringify({ aksi: "jadwal-ulang", id: "sdt-1", wita: "2026-10-27 18:30" }) })
    );
    expect(await isi(r)).toMatchObject({ ok: true, data: { ok: true, butir: { id: "sdt-1" } } });
    expect(keadaan.kelola).toHaveBeenCalledWith(expect.anything(), "usr-uji", { aksi: "jadwal-ulang", id: "sdt-1", wita: "2026-10-27 18:30" });
  });
});
