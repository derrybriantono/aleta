/**
 * Zona waktu kolom ALETA (17 Okt 2026) - satu aturan: disimpan UTC, dibaca UTC.
 *
 * Bukti sungguhannya (MySQL + driver, TZ=Asia/Makassar dan TZ=UTC) ada di
 * aleta_bot/scripts/verify-zona-waktu-utc.js. Berkas ini menjaga sisi yang
 * dapat diperiksa tanpa basis data: kolam bot bertimezone "Z", penyusun SQL
 * setempat, daftar migrasi, langkah migrasi yang tidak dapat menggeser dua
 * kali, dan tidak ada lagi NOW() yang menulis/membandingkan kolom ALETA.
 */
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const akar = path.resolve(process.cwd(), "..");
const req = createRequire(path.join(akar, "aleta_bot/package.json"));
const baca = (rel: string) => fs.readFileSync(path.join(akar, "aleta_bot", rel), "utf8");

describe("kolam koneksi bot", () => {
  it("timezone 'Z': DATETIME dibaca dan Date ditulis sebagai UTC, apa pun TZ proses", () => {
    expect(baca("bot_db_config.js")).toMatch(/timezone:\s*"Z"/);
  });
});

describe("utils/waktuUtc - jam setempat hanya di batas keluaran/masukan", () => {
  const w = req(path.join(akar, "aleta_bot/utils/waktuUtc.js"));
  it("selisih dihitung di pernyataan itu sendiri (tanpa tabel zona)", () => {
    expect(w.SQL_SELISIH_SETEMPAT).toBe("TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW())");
    expect(w.sqlSetempat("ditandai_pada")).toBe(
      "DATE_ADD(ditandai_pada, INTERVAL TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) SECOND)"
    );
    expect(w.sqlDariSetempat("?")).toBe("DATE_SUB(?, INTERVAL TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) SECOND)");
    expect(w.SQL_AWAL_HARI_SETEMPAT).toBe("DATE_SUB(CURDATE(), INTERVAL TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) SECOND)");
  });
});

describe("penulis kolom ALETA tidak lagi memakai NOW() / jam proses", () => {
  const kasus: Array<[string, string[]]> = [
    ["services/kasirOtomatisService.js", ["diubah = NOW()", "?, NOW())"]],
    ["services/kasirRekapService.js", ["dicatat = NOW()", "?,NOW())"]],
    ["services/kendaliBerkasService.js", ["detak_pada = NOW()", "selesai_pada = NOW()", "DATE_SUB(NOW()"]],
    ["services/mediasiStatusService.js", ["dibatalkan_pada = NOW()", "'ALETA', NOW()"]],
    ["services/panggilPetugasService.js", ["(NOW() - INTERVAL", "?, ?, NOW())", "diperbarui_pada = NOW()"]],
    ["services/putusanEcourtService.js", ["?, NOW())", "diperiksa_pada = NOW()"]],
    ["services/sidangSelesaiService.js", ["'ALETA', NOW()", "dilanjutkan_pada = NOW()", "diskors_pada, NOW())", "?, ?, NOW())", "dibatalkan_pada = NOW()"]],
    ["services/messageQueueService.js", ["scheduled_at <= NOW()", "updated_at = NOW()"]],
    ["services/publicQaIntentService.js", ["expires_at > NOW()", "DATE(created_at) = CURDATE()"]],
    ["services/logService.js", ["DATE(created_at) = CURDATE()"]],
    ["services/recipientHealthService.js", ["DATE_SUB(NOW()"]],
    ["services/serviceAnalyticsService.js", ["DATE_SUB(NOW()", "HOUR(created_at)"]],
    ["services/ecourtStoreService.js", ["DATE_SUB(NOW(), INTERVAL ? DAY)"]],
    ["services/jejakAletaService.js", ["waktuMysqlSekarang", "getHours()"]],
    ["services/tandaTanganService.js", ["waktuMysqlSekarang", "getHours()"]],
  ];
  for (const [berkas, terlarang] of kasus) {
    it(berkas, () => {
      const isi = baca(berkas);
      for (const t of terlarang) expect(isi, `${berkas} masih memuat ${t}`).not.toContain(t);
    });
  }

  it("kolom cermin jam sistem lain tetap teks apa adanya (pengecualian yang disengaja)", () => {
    // jam_sidang antrian ditimpa NOW() milik aplikasi antrian - bukan kolom ALETA.
    expect(baca("services/sidangSelesaiService.js")).toContain("jam_sidang = NOW()");
    expect(baca("services/antrianWaktuService.js")).toContain("DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS sekarang");
    expect(baca("services/jejakAletaService.js")).toContain("jamSaja(j.jamSipp),");
  });
});

describe("migrasi isi lama ke UTC", () => {
  const botDb = req(path.join(akar, "aleta_bot/services/botDbService.js"));

  it("mencakup tiap kolom yang dulu ditulis jam setempat", () => {
    const peta = new Map<string, string[]>();
    for (const e of botDb.DAFTAR_MIGRASI_UTC) peta.set(e.tabel, [...(peta.get(e.tabel) || []), ...e.kolom]);
    expect(Object.fromEntries(peta)).toEqual({
      aleta_bot_kasir_otomatis: ["diubah"],
      aleta_bot_kasir_setor_pnbp: ["dicatat"],
      aleta_bot_kendali_runs: ["dimulai_pada", "detak_pada", "selesai_pada"],
      aleta_bot_kendali_berkas: ["disinkron_pada", "updated_at"],
      aleta_bot_mediasi_status: ["ditandai_pada", "dibatalkan_pada"],
      aleta_bot_panggil_riwayat: ["dibuat_pada", "diperbarui_pada"],
      aleta_bot_ecourt_putusan: ["diperiksa_pada"],
      aleta_bot_sidang_selesai: ["ditandai_pada"],
      aleta_bot_sidang_berjalan: ["ditandai_pada", "dibatalkan_pada"],
      aleta_bot_sidang_skors: ["diskors_pada", "dilanjutkan_pada", "perkiraan_lanjut"],
      aleta_bot_ecourt_ringkasan: ["diperbarui"],
      aleta_bot_jejak_penetapan: ["waktu"],
      aleta_bot_tanda_tangan: ["diinput_tanggal", "disahkan_pada"],
      aleta_bot_message_queue: ["updated_at"],
    });
    // jam_sipp dan antrian_waktu adalah cermin - tidak boleh tergeser.
    const semua = botDb.DAFTAR_MIGRASI_UTC.map((e: { tabel: string; kolom: string[] }) => `${e.tabel}.${e.kolom.join(",")}`).join(" ");
    expect(semua).not.toContain("jam_sipp");
    expect(semua).not.toContain("antrian_waktu");
  });

  it("menggeser dan menandai selesai dalam SATU pernyataan, bercadangan, nilai nol tidak disentuh", () => {
    const isi = baca("services/botDbService.js");
    expect(isi).toContain("` t, aleta_bot_migrasi_utc m");
    expect(isi).toContain("m.selesai = 1");
    expect(isi).toContain("WHERE m.kunci = ? AND m.selesai = 0");
    expect(isi).toContain("CREATE TABLE IF NOT EXISTS \\`${cadangan}\\` LIKE \\`${entri.tabel}\\`");
    expect(isi).toContain("> '1000-01-02'");
  });
});
