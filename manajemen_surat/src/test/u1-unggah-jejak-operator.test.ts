// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * JEJAK JUJUR UNGGAH EDOC PUTUSAN MENCATAT AKUN ALETA PENEKAN (uji rilis U1)
 * ============================================================================
 *
 * Data nyata server satker, 9 Okt 2026 (aleta_bot_jejak_penetapan, baca-saja):
 * baris aksi "unggah", jenis "edoc_putusan" untuk 561/Pdt.G/2026 (6 Okt) dan
 * 533/Pdt.G/2026 (7 Okt) berkolom operator KOSONG, sedangkan baris tunda/putus
 * mencatat "usr-super". Aturan tetap: jejak jujur penekan sebenarnya WAJIB di
 * aleta_*. putusanUnggahService.unggahPutusan sudah menerima `operator`, tetapi
 * rute internal bot tidak meneruskannya (dan rute portal tidak mengirimnya -
 * dijaga unggah-slot-nomor.test.ts).
 *
 * Penangan rute bot DIPOTONG dari internalGatewayRoutes.js dan dijalankan di
 * node:vm dengan layanan tiruan yang mencatat argumennya.
 */

const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");

function muatPenangan() {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const awal = isi.indexOf('router.post("/sipp/putusan-unggah"');
  const akhir = isi.indexOf('router.get("/sipp/status-perkara"', awal);
  if (!(awal > 0 && akhir > awal)) throw new Error("Potongan rute /sipp/putusan-unggah tidak ditemukan.");
  const argumen: Array<Record<string, unknown>> = [];
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const konteks = vm.createContext({
    Buffer,
    requireInternalToken: () => undefined,
    // Hak unggah putusan (9 Okt 2026) - layanan SUNGGUHAN, bukan tiruan.
    hakUnggahPutusanService: createRequire(import.meta.url)(
      path.resolve(process.cwd(), "../aleta_bot/services/hakUnggahPutusanService.js")
    ),
    putusanUnggahService: {
      unggahPutusan: async (x: Record<string, unknown>) => {
        argumen.push(x);
        return { ok: true, berkas: [] };
      },
    },
    router: {
      post: (jalur: string, _penjaga: unknown, penangan: (req: unknown, res: unknown) => Promise<void>) => {
        rute[jalur] = penangan;
      },
      // Rute GET unggah massal (F4.1, 17 Okt) kini terdaftar di antara
      // putusan-unggah dan status-perkara; cukup dicatat, tidak dijalankan.
      get: (jalur: string, _penjaga: unknown, penangan: (req: unknown, res: unknown) => Promise<void>) => {
        rute[`GET ${jalur}`] = penangan;
      },
    },
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#putusan-unggah" });
  const penangan = rute["/sipp/putusan-unggah"];
  if (!penangan) throw new Error("router.post('/sipp/putusan-unggah') tidak terdaftar.");
  const jalankan = async (body: unknown) => {
    let status = 200;
    const res = {
      status(s: number) {
        status = s;
        return res;
      },
      json() {
        return res;
      },
    };
    await penangan({ body }, res);
    return status;
  };
  return { jalankan, argumen };
}

describe("rute bot /sipp/putusan-unggah meneruskan operator ke layanan unggah", () => {
  it("operator dari gerbang portal sampai ke unggahPutusan (jejak ALETA)", async () => {
    const { jalankan, argumen } = muatPenangan();
    const status = await jalankan({
      perkaraId: "10079",
      nomorPerkara: "533/Pdt.G/2026/PA.Dgl",
      putusanBase64: Buffer.from("{\\rtf1 x}").toString("base64"),
      olehUsername: "derry briantono",
      operator: "SUPER ADMIN DERRY",
      ip: "192.168.11.61",
      peranPenekan: "super-admin",
    });
    expect(status).toBe(200);
    expect(argumen).toHaveLength(1);
    expect(argumen[0]).toMatchObject({ operator: "SUPER ADMIN DERRY", olehUsername: "derry briantono", ip: "192.168.11.61" });
  });

  it("tanpa operator (pemanggil lama): kosong, bukan karangan", async () => {
    const { jalankan, argumen } = muatPenangan();
    await jalankan({ perkaraId: "1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", putusanBase64: "eA==", olehUsername: "x", peranPenekan: "hakim" });
    expect(argumen[0].operator).toBe("");
  });

  it("keputusan 9 Okt 2026: tanpa peranPenekan atau peran PP ditolak 403, layanan tidak dipanggil", async () => {
    const { jalankan, argumen } = muatPenangan();
    const badan = { perkaraId: "1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", putusanBase64: "eA==", olehUsername: "x" };
    expect(await jalankan(badan)).toBe(403);
    expect(await jalankan({ ...badan, peranPenekan: "panitera-pengganti" })).toBe(403);
    expect(argumen).toHaveLength(0);
  });
});
