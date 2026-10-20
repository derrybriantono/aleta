// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

/**
 * aletaPenetapanKerja (ekstensi-sipp/penetapan-kerja.js, 20 Okt 2026, agen P1)
 * dijalankan di vm dengan fungsi konten.js tiruan: kunci diambil sebelum
 * menulis dan SELALU dilepas, e-Doc hanya untuk langkah dicentang yang tercatat
 * atau sudah ada, dan jalur lain tidak pernah membongkar.
 */
const AKAR = path.resolve(__dirname, "../../..");
const SUMBER = readFileSync(path.join(AKAR, "ekstensi-sipp/penetapan-kerja.js"), "utf8");

type Panggilan = { url: string; badan: Record<string, unknown> };

function muat(opsi: { kerjakan?: (b: Record<string, unknown>) => unknown; kunciGagal?: boolean; edoc?: (p: Record<string, unknown>) => unknown } = {}) {
  const panggilan: Panggilan[] = [];
  const edocDiminta: Array<Record<string, unknown>> = [];
  const balas = (isi: unknown, status = 200) => ({ status, ok: status < 400, json: async () => isi });
  const konteks: Record<string, unknown> = {
    globalThis: undefined,
    console,
    alatAmbil: async (url: string, init: { body?: string }) => {
      const badan = init && init.body ? JSON.parse(init.body) : {};
      panggilan.push({ url, badan });
      if (url.endsWith("/penunjukan/kunci")) {
        if (badan.aksi === "lepas") return balas({ ok: true, data: { ok: true } });
        return balas(opsi.kunciGagal ? { ok: true, data: { ok: false, alasan: "sedang_dikerjakan", oleh: "tab lain" } } : { ok: true, data: { ok: true, token: "T1" } });
      }
      if (url.includes("/penunjukan/keadaan")) return balas({ ok: true, data: { ok: true, perkaraId: 10260 } });
      if (url.endsWith("/penunjukan/kerjakan")) {
        const isi = opsi.kerjakan
          ? opsi.kerjakan(badan)
          : {
              ok: true,
              kunci: { diambil: true },
              laporan: [
                { jenis: "pmh", status: "tercatat", sebab: "", bunyi: "" },
                { jenis: "ppp", status: "tercatat", sebab: "", bunyi: "" },
                { jenis: "pjs", status: "dilewati", sebab: "sudah_ada", bunyi: "" },
                { jenis: "phs", status: "gagal", sebab: "tanggal_sidang_hari_libur", bunyi: "libur" },
              ],
              pesan: "",
            };
        return balas(isi);
      }
      return balas({});
    },
    namaPenggunaSipp: () => "admin",
    kalimatAlasan: (k: string) => `kalimat:${k}`,
    lupakanStatusPerkara: () => undefined,
    e6UnggahEdocPenetapan: async (p: Record<string, unknown>) => {
      edocDiminta.push(p);
      return opsi.edoc ? opsi.edoc(p) : { ok: true, hasil: { d: { berkas: (p.jenis as string[]).map((j) => ({ jenis: j, ok: true })) } } };
    },
  };
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(SUMBER, konteks);
  const api = (konteks.aletaPenetapanKerja as Record<string, any>);
  return { api, panggilan, edocDiminta };
}

const dasar = { nomorPerkara: "684/Pdt.G/2026/PA.Dgl", perkaraId: 10260, mode: "otomatis" };

describe("aletaPenetapanKerja.kerjakan", () => {
  it("mengambil kunci, menulis, e-Doc hanya yang dicentang & (tercatat|sudah ada), lalu MELEPAS kunci", async () => {
    const { api, panggilan, edocDiminta } = muat();
    const h = await api.kerjakan({
      ...dasar,
      langkah: { pmh: true, ppp: true, pjs: true, phs: true },
      unggahEdoc: { pmh: true, ppp: false, pjs: true, phs: true },
    });
    const urutan = panggilan.map((p) => p.url.split("/").pop() + (p.badan.aksi ? `:${p.badan.aksi}` : ""));
    expect(urutan).toEqual(["kunci:ambil", "kerjakan", "kunci:lepas"]);
    expect(panggilan[1].badan).toMatchObject({ kunciToken: "T1", kering: false, olehUsername: "admin" });
    // pmh (tercatat) & pjs (sudah ada) diunggah; ppp tidak dicentang; phs gagal ditulis -> tidak diunggah.
    expect(edocDiminta).toHaveLength(1);
    expect(edocDiminta[0].jenis).toEqual(["pmh", "pjs"]);
    expect(edocDiminta[0].otomatis).toBe(false);
    const edoc = Object.fromEntries(h.laporan.map((x: any) => [x.jenis, x.edoc && x.edoc.status]));
    expect(edoc).toEqual({ pmh: "terunggah", ppp: "tidak_dicentang", pjs: "terunggah", phs: "dilewati" });
    expect(h.ok).toBe(true); // ok bawaan rute; kegagalan PHS sudah tercermin di rute
  });

  it("kunci dipegang pekerjaan lain: tidak menulis, semua dilewati/sedang_dikerjakan, tidak ada e-Doc", async () => {
    const { api, panggilan, edocDiminta } = muat({ kunciGagal: true });
    const h = await api.kerjakan({ ...dasar, unggahEdoc: { pmh: true } });
    expect(panggilan.map((p) => p.url.split("/").pop())).toEqual(["kunci"]);
    expect(edocDiminta).toHaveLength(0);
    expect(h.ok).toBe(false);
    expect(h.kunci).toMatchObject({ diambil: false, oleh: "tab lain" });
    expect(h.laporan.every((x: any) => x.status === "dilewati" && x.sebab === "sedang_dikerjakan")).toBe(true);
  });

  it("kering tidak mengambil kunci dan tidak mengunggah e-Doc", async () => {
    const { api, panggilan, edocDiminta } = muat();
    await api.kerjakan({ ...dasar, kering: true, unggahEdoc: { pmh: true } });
    expect(panggilan.map((p) => p.url.split("/").pop())).toEqual(["kerjakan"]);
    expect(panggilan[0].badan.kering).toBe(true);
    expect(edocDiminta).toHaveLength(0);
  });

  it("kunci tetap dilepas walau rute kerjakan melempar", async () => {
    const { api, panggilan } = muat({
      kerjakan: () => {
        throw new Error("jaringan putus");
      },
    });
    const h = await api.kerjakan({ ...dasar });
    expect(h.ok).toBe(false);
    expect(h.pesan).toMatch(/Belum pasti tertulis/);
    expect(panggilan.map((p) => p.url.split("/").pop() + (p.badan.aksi ? `:${p.badan.aksi}` : ""))).toEqual(["kunci:ambil", "kerjakan", "kunci:lepas"]);
  });

  it("e-Doc gagal menjadikan hasil tidak ok tanpa menghapus penetapan yang tercatat", async () => {
    const { api } = muat({ edoc: () => ({ ok: false, hasil: { d: { berkas: [{ jenis: "pmh", ok: false, sebab: "ttd belum disahkan" }] } } }) });
    const h = await api.kerjakan({ ...dasar, unggahEdoc: { pmh: true } });
    expect(h.laporan[0]).toMatchObject({ status: "tercatat", edoc: { status: "gagal" } });
    expect(h.ok).toBe(false);
  });

  it("mode otomatis tidak mengirim pilihan; manual mengirimnya; tidak ada rute bongkar dipanggil", async () => {
    const a = muat();
    await a.api.kerjakan({ ...dasar, pilihan: { ppp: 21 } });
    expect(a.panggilan[1].badan.pilihan).toEqual({});
    const m = muat();
    await m.api.kerjakan({ ...dasar, mode: "manual", pilihan: { ppp: 21 } });
    expect(m.panggilan[1].badan.pilihan).toEqual({ ppp: 21 });
    expect(SUMBER).not.toMatch(/penunjukan\/hapus|perintahPengguna/);
  });

  it("tanpa nomor perkara atau tanpa akun SIPP: ditolak sebelum menyentuh server", async () => {
    const { api, panggilan } = muat();
    const h = await api.kerjakan({ mode: "otomatis" });
    expect(h.ok).toBe(false);
    expect(panggilan).toHaveLength(0);
  });
});
