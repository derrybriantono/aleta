/**
 * Portal memanggil ALETA Bot lewat jalur yang ditulis tangan sebagai teks.
 * Salah ketik tidak menghasilkan galat kompilasi, tidak menggagalkan uji, dan
 * tidak terlihat sampai seseorang membuka halamannya di server - lalu Express
 * menjawab halaman 404 HTML, bukan JSON.
 *
 * Persis itu yang terjadi: seluruh 25 jalur e-Court, agenda, dan SIPP ditulis
 * "/internal/ecourt/..." padahal routernya dipasang di "/internal/aleta-bot".
 * Tidak satu pun pernah berhasil.
 *
 * Uji ini membaca kedua sisi dari berkas aslinya dan mencocokkannya.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = process.cwd();
const KLIEN = path.join(AKAR, "src/server/modules/aleta-bot/whatsapp-gateway-client.ts");
const ROUTER = path.join(AKAR, "../aleta_bot/routes/internalGatewayRoutes.js");
const APP_BOT = path.join(AKAR, "../aleta_bot/app.js");

function baca(berkas: string) {
  return readFileSync(berkas, "utf8");
}

describe("jalur gateway portal ke ALETA Bot", () => {
  const klien = baca(KLIEN);

  it("router internal dipasang di /internal/aleta-bot", () => {
    const app = baca(APP_BOT);
    expect(app).toContain('app.use("/internal/aleta-bot", internalGatewayRoutes)');
  });

  it("setiap jalur yang dipanggil portal memakai prefiks yang benar", () => {
    const jalur = [...klien.matchAll(/["`](\/internal\/[a-z0-9/_-]+)/g)].map((m) => m[1]);
    expect(jalur.length).toBeGreaterThan(20);

    const salah = [...new Set(jalur.filter((j) => !j.startsWith("/internal/aleta-bot/")))];
    expect(
      salah,
      `Jalur ini tidak berprefiks /internal/aleta-bot dan akan dijawab 404: ${salah.join(", ")}`
    ).toEqual([]);
  });

  it("setiap jalur yang dipanggil portal benar-benar ada sebagai rute di bot", () => {
    const router = baca(ROUTER);
    const app = baca(APP_BOT);

    // Rute bot datang dari DUA tempat: router yang dipasang di
    // /internal/aleta-bot, dan sebagian lagi didaftarkan langsung di app.js
    // dengan jalur penuh. Membaca satu saja menghasilkan tuduhan palsu.
    const terdaftar = new Set<string>([
      ...[...router.matchAll(/router\.(?:get|post|put|delete)\(\s*"([^"]+)"/g)].map((m) => m[1]),
      ...[...app.matchAll(/app\.(?:get|post|put|delete)\(\s*"\/internal\/aleta-bot([^"]+)"/g)].map(
        (m) => m[1]
      ),
    ]);
    expect(terdaftar.size).toBeGreaterThan(20);

    const dipanggil = [
      ...new Set([...klien.matchAll(/["`]\/internal\/aleta-bot(\/[a-z0-9/_-]+)/g)].map((m) => m[1])),
    ];
    expect(dipanggil.length).toBeGreaterThan(20);

    const cocok = (jalur: string) =>
      [...terdaftar].some((rute) => {
        if (rute === jalur) return true;
        // Jalur yang disusun dengan penyisipan nilai terpotong di batas
        // parameter, misalnya "/messages/progress/" untuk "/messages/progress/:id".
        const statis = rute.split("/:")[0];
        return rute.startsWith(jalur) || statis === jalur.replace(/\/$/, "");
      });

    const hilang = dipanggil.filter((jalur) => !cocok(jalur));
    expect(
      hilang,
      `Portal memanggil jalur yang tidak punya rute di aleta_bot: ${hilang.join(", ")}`
    ).toEqual([]);
  });
});
