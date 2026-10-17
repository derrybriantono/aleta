// @vitest-environment node
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Audit 17 Okt 2026 (bot): pagar kueri variabel ABT di bot disamakan dengan
 * portal (9e46158). Kasus ini GAGAL atas kode lama (kutipan dibuang sebelum
 * komentar; /*! ... *\/ dibuang sebagai komentar biasa) dan hijau sesudahnya.
 * Bot yang benar-benar menjalankan kueri ke MySQL SIPP/ABT, jadi pagar bot
 * adalah lapis terakhir.
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(import.meta.url);

type Layanan = Record<string, unknown>;
const servis = require_(path.join(akar, "aleta_bot/services/abtPengaturanService.js")) as {
  periksaKueriVariabel: (sql: string, pagar: (s: string) => string) => string;
  kalimatAwam?: (g: unknown) => string;
  layanan: () => Layanan;
};
const mesin = require_(path.join(akar, "aleta_bot/services/abtMesinVariabel.js")) as { pagarBaca: (s: string) => string };

const SELUNDUP = [
  "SELECT 1 /*!, SLEEP(5)*/ AS data",
  "SELECT 1 /*!50000 INTO OUTFILE '/tmp/x' */",
  "SELECT 1 /*M!, SLEEP(5)*/ AS data",
  "SELECT 1 /* ' */, LOAD_FILE('/etc/passwd') /* ' */ AS data",
  "SELECT 1 /* ' */ INTO OUTFILE '/var/www/x.php' /* ' */",
  "SELECT 1 # '\n, BENCHMARK(1e9,MD5(1)) -- '\nAS data",
  "SELECT 1 /* ' */; UPDATE sys_user SET password='x'; /* ' */",
  "SELECT 1 AS data#'\n, SLEEP(3) -- '",
];

const SAH = [
  "SELECT nama AS data FROM perkara WHERE perkara_id = 10133 /* catatan */",
  "SELECT 'update; sleep(1) -- x' AS data FROM t -- akhir\n",
  "SELECT CONCAT(a, '#', b) AS data FROM t WHERE id = 1214",
  "SELECT 1--1 AS data",
  "SELECT `kolom 'aneh'` AS data FROM t",
  "SELECT 'into outfile' AS data",
  "SELECT REPLACE(CONVERT(x USING utf8),'\\\\','/') AS data FROM perkara",
  "(select 1 as data)",
];

describe("pagar kueri bot - pola penyelundup yang dulu lolos ditolak", () => {
  it.each(SELUNDUP)("pagarBaca menolak: %s", (q) => {
    expect(mesin.pagarBaca(q), q).not.toBe("");
  });

  it.each(SELUNDUP)("periksaKueriVariabel (layar Pengaturan) menolak: %s", (q) => {
    expect(servis.periksaKueriVariabel(q, mesin.pagarBaca), q).not.toBe("");
  });

  it("kueri sah tetap lolos: komentar biasa, kutipan berisi kata terlarang, 1--1, backtick", () => {
    for (const q of SAH) expect(mesin.pagarBaca(q), q).toBe("");
    for (const q of SAH) expect(servis.periksaKueriVariabel(q, mesin.pagarBaca), q).toBe("");
  });

  it("penanda #NNNN# dan #perkara_id# di luar kutipan tidak dianggap komentar oleh layar Pengaturan", () => {
    const q = "SELECT nama AS data FROM perkara WHERE perkara_id = #perkara_id# AND x = #1214#";
    expect(servis.periksaKueriVariabel(q, mesin.pagarBaca)).toBe("");
    // penanda yang diganti 0 tidak boleh menyembunyikan perintah di belakangnya
    expect(servis.periksaKueriVariabel("SELECT 1 AS data #1214#\n, SLEEP(3)", mesin.pagarBaca)).not.toBe("");
  });
});

describe("rute pengaturan bot - galat ER_*/SQL mentah tidak sampai ke layar", () => {
  const MENTAH = "ER_BAD_FIELD_ERROR: Unknown column 'x' in 'field list' (SQLSTATE 42S22) SELECT secret FROM sys_user";
  let tutup: () => void = () => {};
  let alamat = "";
  const sebelumnya = process.env.ALETA_BOT_INTERNAL_API_TOKEN;

  beforeAll(async () => {
    process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-uji-17okt";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const dasar = servis as unknown as { layanan: () => Layanan };
    const asli = dasar.layanan;
    dasar.layanan = () => ({
      bacaMenu: async () => {
        throw new Error(MENTAH);
      },
    });
    // Rute mengambil `layanan` saat dimuat: hapus cache rute agar memakai yang palsu.
    const jalurRute = require_.resolve(path.join(akar, "aleta_bot/routes/abtPengaturanRoutes.js"));
    delete require_.cache[jalurRute];
    const router = require_(jalurRute);
    dasar.layanan = asli;
    const express = require_(path.join(akar, "aleta_bot/node_modules/express"));
    const app = express();
    app.use("/abt", router);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    alamat = `http://127.0.0.1:${(server.address() as AddressInfo).port}/abt`;
    tutup = () => server.close();
  });

  afterAll(() => {
    tutup();
    if (sebelumnya === undefined) delete process.env.ALETA_BOT_INTERNAL_API_TOKEN;
    else process.env.ALETA_BOT_INTERNAL_API_TOKEN = sebelumnya;
    vi.restoreAllMocks();
  });

  it("500 memuat kalimat awam, bukan ER_/SQLSTATE/SQL", async () => {
    const res = await fetch(`${alamat}/menu`, { headers: { "x-aleta-internal-token": "token-uji-17okt" } });
    expect(res.status).toBe(500);
    const badan = await res.json();
    const teks = JSON.stringify(badan);
    expect(teks).not.toMatch(/ER_|SQLSTATE|Unknown column|sys_user|SELECT/);
    expect(badan.message).toMatch(/server/i);
    // rincian tetap di log
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("ER_BAD_FIELD_ERROR"));
  });

  it("kalimatAwam: sambungan putus dan waktu habis dijelaskan, kalimat tulisan sendiri apa adanya", () => {
    const awam = servis.kalimatAwam;
    expect(awam, "kalimatAwam diekspor").toBeTypeOf("function");
    expect(awam!(new Error("connect ECONNREFUSED 10.0.0.5:3306"))).toMatch(/terhubung/);
    expect(awam!(new Error("ER_QUERY_TIMEOUT: Query execution was interrupted"))).toMatch(/terlalu lama/);
    expect(awam!(new Error("Nomor variabel tidak sah."))).toBe("Nomor variabel tidak sah.");
  });
});
