import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 27 Okt: halaman login e-Court mengganti captcha lewat AJAX (/capcay/regenerate) saat window.load. Bot memotret
// sesudah networkidle2 - sebelum penggantian kembali - sehingga yang tampil captcha lama dan login selalu ditolak
// (/Login/index/CAPTCHA). Pemotretan harus menunggu jaringan sepi dan gambar terpasang lebih dulu.
const require = createRequire(import.meta.url);
const { potretCaptchaSegar } = require(path.resolve(process.cwd(), "../aleta_bot/services/ecourtLoginService.js"));

describe("captcha e-Court dipotret sesudah diganti halaman (27 Okt)", () => {
  it("menunggu jaringan sepi dan gambar terpasang SEBELUM memotret", async () => {
    const urutan: string[] = [];
    const page = {
      waitForNetworkIdle: async () => { urutan.push("sepi"); },
      waitForFunction: async () => { urutan.push("gambar"); },
      $: async () => ({ screenshot: async () => { urutan.push("potret"); return "QUJD".repeat(40); } }),
    };
    const hasil = await potretCaptchaSegar(page);
    expect(urutan).toEqual(["sepi", "gambar", "potret"]);
    expect(hasil.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("jaringan tak kunjung sepi tidak membatalkan pemotretan", async () => {
    const page = {
      waitForNetworkIdle: async () => { throw new Error("timeout"); },
      waitForFunction: async () => { throw new Error("timeout"); },
      $: async () => ({ screenshot: async () => "QUJD".repeat(40) }),
    };
    expect(await potretCaptchaSegar(page)).toMatch(/^data:image\/png;base64,/);
  });

  it("tanpa gambar captcha: kosong", async () => {
    const page = { waitForNetworkIdle: async () => {}, waitForFunction: async () => {}, $: async () => null };
    expect(await potretCaptchaSegar(page)).toBe("");
  });
});
