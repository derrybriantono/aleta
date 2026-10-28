// @vitest-environment node
/**
 * ============================================================================
 * JAM SIPP (WIB) UNTUK SELURUH PENULIS ALETA KE TABEL SIPP (13 Okt 2026)
 * ============================================================================
 *
 * SIPP menulis diinput_tanggal dan sys_audittrail.datetime lewat PHP date()
 * sesudah date_default_timezone_set("Asia/Jakarta") - WIB - sedangkan NOW()
 * basis data WITA. Terukur di server: audit ALETA 507558 bertanggal 10:46:08,
 * baris SIPP 507574 yang ditulis SESUDAHNYA 09:46:38. Keputusan pengguna:
 * "Betulkan" - seluruh penulis ALETA ke SIPP memakai jam SIPP. Tabel aleta_*
 * tetap jam sebenarnya; aturan akun tiap alur tidak berubah.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const baca = (p: string) => readFileSync(path.join(AKAR, p), "utf8").replace(/\r\n/g, "\n");

function muat(jawab: (sql: string, p: unknown[]) => unknown = () => []) {
  const pasang = (berkas: string, exports: unknown) => {
    const jalur = require_.resolve(path.join(AKAR, "aleta_bot", berkas));
    require_.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
  };
  pasang("db_config.js", {
    query: (sql: string, p: unknown, cb: (g: unknown, h: unknown) => void) =>
      cb(null, jawab(String(sql), Array.isArray(p) ? p : [])),
  });
  const jalurSkema = require_.resolve(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"));
  delete require_.cache[jalurSkema];
  const skema = require_(jalurSkema) as Record<string, unknown>;
  pasang("services/sippSkemaService.js", { ...skema, tabelAda: async () => true });
  const jalur = require_.resolve(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js"));
  delete require_.cache[jalur];
  return require_(jalur) as Record<string, any>;
}

afterEach(() => {
  delete process.env.ALETA_ZONA_WAKTU_SIPP;
});

describe("pembantu jam SIPP", () => {
  it("waktuSipp = UTC basis data dalam Asia/Jakarta (WITA 10:56:26 -> SIPP 09:56:26)", async () => {
    const l = muat((sql) => (/UTC_TIMESTAMP/.test(sql) ? [{ utc: "2026-10-13 02:56:26" }] : []));
    expect(await l.waktuSipp()).toBe("2026-10-13 09:56:26");
  });

  it("sqlJamSipp menggeser UTC_TIMESTAMP() sebesar zona SIPP, format dipertahankan (jam dua belas)", () => {
    const l = muat();
    expect(l.sqlJamSipp("%Y-%m-%d %h:%i:%s")).toBe(
      "DATE_FORMAT(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 420 MINUTE), '%Y-%m-%d %h:%i:%s')"
    );
    expect(l.sqlJamSipp()).toContain("'%Y-%m-%d %H:%i:%s'");
  });

  it("zona dapat diganti lewat ALETA_ZONA_WAKTU_SIPP; zona tak sah jatuh ke Asia/Jakarta", () => {
    process.env.ALETA_ZONA_WAKTU_SIPP = "Asia/Makassar";
    expect(muat().sqlJamSipp()).toContain("INTERVAL 480 MINUTE");
    process.env.ALETA_ZONA_WAKTU_SIPP = "Bukan/Zona";
    expect(muat().sqlJamSipp()).toContain("INTERVAL 420 MINUTE");
  });
});

describe("Data Umum ditulis dengan jam SIPP", () => {
  it("diperbaharui_tanggal dan sys_audittrail = jam SIPP (WIB), akun tetap akun yang masuk", async () => {
    const tulisan: Array<{ sql: string; params: unknown[] }> = [];
    const l = muat((sql, p) => {
      if (/UTC_TIMESTAMP/.test(sql)) return [{ utc: "2026-10-13 02:56:26" }];
      if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-13 10:56:26" }];
      if (/FROM perkara p\b/.test(sql) && /LEFT JOIN perkara_penetapan/.test(sql)) {
        return [{ perkaraId: 10229, nomorPerkara: "660/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, tanggalDaftar: "2026-10-13" }];
      }
      if (/FROM perkara p WHERE/.test(sql)) return [{ tanggalSurat: null, nomorSurat: null }];
      if (/FROM sys_users WHERE username = \?/.test(sql)) {
        return String(p[0]) === "meja1g" ? [{ userid: 25, username: "meja1g", fullname: "Tiffany RS", block: 0 }] : [];
      }
      if (/^\s*(INSERT|UPDATE)/i.test(sql)) {
        tulisan.push({ sql, params: p });
        return { affectedRows: 1 };
      }
      return [];
    });
    const r = await l.susunRencanaTulis({
      jenis: "dataUmum",
      perkaraId: 10229,
      tanggalPenetapan: "2026-10-13",
      olehUsername: "meja1g",
      operator: "UJI",
      ip: "192.168.9.82",
      dataUmum: { nomorSurat: "01/X/2026" },
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    await l.jalankanRencana(r, { kering: false });
    const ubah = tulisan.find((t) => /^UPDATE perkara SET/.test(t.sql))!;
    expect(ubah.params).toContain("2026-10-13 09:56:26");
    expect(ubah.params).toContain("meja1g");
    const audit = tulisan.find((t) => /^INSERT INTO sys_audittrail/.test(t.sql))!;
    expect(audit.params[0]).toBe("2026-10-13 09:56:26");
    expect(audit.params[2]).toBe("meja1g");
  });
});

describe("penjaga sumber: tiap penulis ke SIPP memakai jam SIPP, bukan NOW()/jam container", () => {
  const svc = (b: string) => baca(`aleta_bot/services/${b}`);

  it("Tunda & Putusan Jadwal Sidang: cap = waktuSipp; sampai_jam tetap jam sidang setempat", () => {
    const s = svc("sidangHasilService.js");
    // 3 jalur tulis: tunda, putusan biasa, dan putus ikrar talak (susunRencanaPutusIkrar,
    // 18 Okt 2026). Jalur ikrar menulis cap yang sama dengan dua yang lain, jadi
    // jumlahnya memang naik dari 2 menjadi 3 - bukan jalur yang lolos dari penjaga.
    expect(s.split("const saat = await penetapan.waktuSipp();").length - 1).toBe(3);
    expect(s).not.toContain("const saat = await penetapan.waktuBasisData();");
    // Putus ikrar (28 Okt 2026, P10): sampai_jam = jam SETEMPAT langkah keterangan sidang
    // (jam SIPP rangkaian + selisih zona setempat), bukan jam tombol - tetap setempat.
    expect(s.split("jamDariCap(saatSetempat)").length - 1).toBe(2);
    expect(s).toContain("jamDariCap(setempatJadwal)");
    expect(s).toContain("const saatSetempat = await penetapan.waktuBasisData();");
    // Jalur putus ikrar tidak boleh memakai NOW()/CURRENT_TIMESTAMP/jam container sebagai nilai tulis.
    const awalIkrar = s.indexOf("async function susunRencanaPutusIkrar");
    expect(awalIkrar).toBeGreaterThan(-1);
    const sisa = s.slice(awalIkrar);
    const akhirIkrar = sisa.search(/\n(?:async )?function (?!susunRencanaPutusIkrar)/);
    const jalurIkrar = (akhirIkrar > 0 ? sisa.slice(0, akhirIkrar) : sisa)
      .split("\n")
      .filter((baris) => !/^\s*(\/\/|\*|\/\*)/.test(baris))
      .join("\n");
    expect(jalurIkrar).toContain("await penetapan.waktuSipp()");
    expect(jalurIkrar).not.toMatch(/\bNOW\(\)|CURRENT_TIMESTAMP|CURDATE\(\)|CURTIME\(\)|new Date\(\)/);
  });

  it("Putusan akhir dan Penetapan kembali: cap = waktuSipp; pagar tanggal tetap tanggal setempat", () => {
    const putusan = svc("putusanTulisService.js");
    expect(putusan).toContain("const saat = await penetapan.waktuSipp();");
    expect(putusan).toContain("const hariIni = (await penetapan.waktuBasisData()).slice(0, 10);");
    const kembali = svc("penetapanKembaliService.js");
    expect(kembali).toContain("const saat = await tulis.waktuSipp();");
    expect(kembali).toContain("const hariIni = (await tulis.waktuBasisData()).slice(0, 10);");
  });

  it("Mediator, Court Calendar, Kasir jurnal", () => {
    expect(svc("mediatorTulisService.js")).toContain('require("./penetapanTulisService").waktuSipp()');
    const cc = svc("courtCalendarTulisService.js");
    expect(cc).toContain('require("./penetapanTulisService").sqlJamSipp("%Y-%m-%d %h:%i:%s")');
    expect(cc).not.toContain("DATE_FORMAT(NOW(), '%Y-%m-%d %h:%i:%s')\";");
    const kasir = svc("kasirJurnalService.js");
    expect(kasir).toContain("saat = await saatSipp();");
    expect(kasir).toContain('require("./penetapanTulisService").sqlJamSipp()');
  });

  it("e-Doc penetapan dan unggah putusan: jam SIPP dari basis data, bukan jam container", () => {
    expect(svc("dokumenPenetapanService.js")).toContain('saatSipp || (await require("./penetapanTulisService").waktuSipp())');
    const unggah = svc("putusanUnggahService.js");
    expect(unggah).toContain("const waktu = await waktuTulisSipp(jam);");
    expect(unggah).toContain("const tglMasuk = await waktuTulisSipp(jam);");
    expect(unggah).not.toContain("jam = () => new Date(),");
  });

  it("tabel aleta_* tetap jam sebenarnya", () => {
    expect(svc("jejakAletaService.js")).toContain("waktuUtcSekarang(),");
  });
});
