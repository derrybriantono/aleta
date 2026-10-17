#!/usr/bin/env node
"use strict";

/**
 * Uji zona waktu kolom ALETA dengan MySQL dan driver SUNGGUHAN (17 Okt 2026).
 *
 * Aturan yang diuji: kolom waktu milik ALETA (aleta_bot_*) DISIMPAN UTC dan
 * DIBACA sebagai UTC, apa pun TZ proses Node-nya; jam dinding setempat (WITA,
 * = NOW() server MySQL) hanya muncul di keluaran teks untuk layar.
 *
 * Skrip ini menjalankan dirinya sendiri dua kali - TZ=Asia/Makassar (peti
 * server) dan TZ=UTC - masing-masing atas basis data uji yang dibuat ulang:
 *   - aleta_bot_uji_utc         layanan sungguhan menulis lalu membaca;
 *   - aleta_bot_uji_utc_migrasi data lama (jam setempat) dipindah ke UTC.
 *
 * Basis data uji dihapus dan dibuat ulang tiap jalan; basis data aleta_bot
 * sendiri tidak disentuh. SIPP/antrian TIDAK dibaca - bagian itu ditiru.
 *
 * Pakai (MySQL lokal XAMPP di 127.0.0.1:3306, root tanpa sandi):
 *   node scripts/verify-zona-waktu-utc.js
 *   UJI_DB_HOST=... UJI_DB_USER=... UJI_DB_PASSWORD=... node scripts/verify-zona-waktu-utc.js
 */

const path = require("path");
const { spawnSync } = require("child_process");

const DB_LAYANAN = "aleta_bot_uji_utc";
const DB_MIGRASI = "aleta_bot_uji_utc_migrasi";
const ZONA = ["Asia/Makassar", "UTC"];

const sambungan = {
  host: process.env.UJI_DB_HOST || "127.0.0.1",
  port: Number(process.env.UJI_DB_PORT || 3306),
  user: process.env.UJI_DB_USER || "root",
  password: process.env.UJI_DB_PASSWORD || "",
};

// ─── Induk: jalankan anak per zona × bagian ─────────────────────────────────
if (!process.env.UJI_UTC_ANAK) {
  let gagal = 0;
  for (const tz of ZONA) {
    for (const bagian of ["layanan", "migrasi"]) {
      const env = {
        ...process.env,
        TZ: tz,
        UJI_UTC_ANAK: bagian,
        ALETA_BOT_DB_HOST: sambungan.host,
        ALETA_BOT_DB_PORT: String(sambungan.port),
        ALETA_BOT_DB_USER: sambungan.user,
        ALETA_BOT_DB_PASSWORD: sambungan.password,
        ALETA_BOT_DB_NAME: bagian === "layanan" ? DB_LAYANAN : DB_MIGRASI,
        ALETA_BOT_INTERNAL_DB_NAME: bagian === "layanan" ? DB_LAYANAN : DB_MIGRASI,
        ALETA_BOT_DB_SIPP_NAME: "sipp_tidak_dipakai_uji",
      };
      const hasil = spawnSync(process.execPath, [__filename], { env, encoding: "utf8", timeout: 1500000 });
      process.stdout.write(`\n===== TZ=${tz} · ${bagian} =====\n${hasil.stdout || ""}`);
      if (hasil.stderr && hasil.status !== 0) process.stdout.write(hasil.stderr.split("\n").slice(-15).join("\n"));
      if (hasil.status !== 0) gagal += 1;
    }
  }
  console.log(gagal ? `\nGAGAL: ${gagal} dari ${ZONA.length * 2} jalan` : "\nSEMUA LULUS");
  process.exit(gagal ? 1 : 0);
}

// ─── Anak ───────────────────────────────────────────────────────────────────
const mysql = require("mysql");
const akarBot = path.resolve(__dirname, "..");
const hasil = [];

function periksa(nama, benar, rincian = "") {
  hasil.push({ nama, benar: Boolean(benar), rincian: String(rincian) });
}

async function uji(nama, fn) {
  const mulai = Date.now();
  try {
    await fn();
    if (process.env.UJI_UTC_RINCI) console.log(`» ${nama} ${Date.now() - mulai} md`);
  } catch (galat) {
    periksa(nama, false, `galat: ${String((galat && galat.stack) || galat).split("\n").slice(0, 3).join(" | ")}`);
  }
}

function kueriRoot(sql, params = []) {
  return new Promise((selesai, gagal) => {
    const k = mysql.createConnection({ ...sambungan, multipleStatements: false });
    k.query(sql, params, (galat, baris) => {
      k.end();
      return galat ? gagal(galat) : selesai(baris);
    });
  });
}

function dua(n) {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD HH:MM:SS" sebagai jam dinding naif -> milidetik (tanpa zona). */
function ms(teks) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(teks || ""));
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

async function main() {
  const bagian = process.env.UJI_UTC_ANAK;
  const db = process.env.ALETA_BOT_DB_NAME;
  // Basis data uji DIPAKAI ULANG dan hanya dikosongkan: membuat tabel baru di
  // MySQL laptop yang sedang sibuk memakan puluhan detik per tabel.
  await kueriRoot(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4`);
  const ada = await kueriRoot("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?", [db]);
  for (const { t } of ada) await kueriRoot(`DELETE FROM \`${db}\`.\`${t}\``);

  const botDb = require(path.join(akarBot, "services/botDbService"));
  const kueri = (sql, params = []) => botDb.query(sql, params);

  const jamDb = async () => {
    const b = await kueri(
      "SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS setempat, DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:%s') AS utc"
    );
    return b[0];
  };
  const awal = await jamDb();
  const selisihDb = (ms(awal.setempat) - ms(awal.utc)) / 1000;
  console.log(
    `TZ proses=${process.env.TZ} (offset ${-new Date().getTimezoneOffset()} mnt) · NOW() server=${awal.setempat} · UTC=${awal.utc} · selisih ${selisihDb} dtk`
  );
  if (selisihDb === 0) console.log("PERINGATAN: server MySQL ber-UTC - uji jam setempat tidak membedakan apa pun.");

  const hariSetempat = awal.setempat.slice(0, 10);
  /** Teks DATETIME mentah satu kolom. */
  const mentah = async (tabel, kolom, syarat = "1 = 1", params = []) => {
    const b = await kueri(`SELECT DATE_FORMAT(${kolom}, '%Y-%m-%d %H:%i:%s') AS t FROM ${tabel} WHERE ${syarat} ORDER BY 1 DESC LIMIT 1`, params);
    return b[0] ? b[0].t : null;
  };
  const dekatUtc = async (teks, toleransi = 120) => {
    const j = await jamDb();
    return Number.isFinite(ms(teks)) && Math.abs(ms(teks) - ms(j.utc)) <= toleransi * 1000;
  };
  const dekatSetempat = async (teks, toleransi = 120) => {
    const j = await jamDb();
    return Number.isFinite(ms(teks)) && Math.abs(ms(teks) - ms(j.setempat)) <= toleransi * 1000;
  };
  const dekatKini = (iso, toleransi = 120) => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && Math.abs(t - Date.now()) <= toleransi * 1000;
  };
  const kolomUtc = async (nama, tabel, kolom, syarat, params) => {
    const t = await mentah(tabel, kolom, syarat, params);
    periksa(`${nama}: tersimpan UTC`, await dekatUtc(t), `mentah=${t}`);
  };

  if (bagian === "migrasi") return ujiMigrasi({ kueri, botDb, mentah, jamDb, selisihDb });

  // ── 1. Driver: kolom UTC terbaca sebagai saat yang benar ─────────────────
  await uji("driver", async () => {
    await kueri("CREATE TABLE IF NOT EXISTS uji_waktu (id INT PRIMARY KEY, w DATETIME NULL, t DATE NULL) ENGINE=InnoDB");
    const kini = new Date();
    await kueri("INSERT INTO uji_waktu (id, w, t) VALUES (1, ?, ?)", [botDb.toMysqlDate(kini), "2026-10-17"]);
    const b = (await kueri("SELECT w, t FROM uji_waktu WHERE id = 1"))[0];
    periksa("driver: DATETIME mentah (tulisan toMysqlDate) = saat sebenarnya", Math.abs(b.w.getTime() - kini.getTime()) < 2000, b.w.toISOString());
    const f = botDb.fromMysqlDate(b.w);
    periksa("driver: fromMysqlDate(Date driver) = saat sebenarnya", f && Math.abs(f.getTime() - kini.getTime()) < 2000, f && f.toISOString());
    periksa("driver: DATE mentah -> toISOString tetap tanggalnya", b.t.toISOString().slice(0, 10) === "2026-10-17", b.t.toISOString());
    await kueri("INSERT INTO uji_waktu (id, w) VALUES (2, ?)", [kini]);
    const t = await mentah("uji_waktu", "w", "id = 2");
    periksa("driver: Date sebagai parameter ditulis UTC", await dekatUtc(t, 90), `mentah=${t}`);
  });

  // ── 2. Kasir otomatis: diubah ─────────────────────────────────────────────
  await uji("kasir_otomatis.diubah", async () => {
    const k = require(path.join(akarBot, "services/kasirOtomatisService"));
    const l = k.buatLayanan({ kueri: async () => [], kueriAleta: kueri, jurnal: {}, migrasiUtc: botDb.pastikanUtc });
    const r = await l.simpanSetelan({ operator: "uji", nyala: true });
    await kolomUtc("aleta_bot_kasir_otomatis.diubah", "aleta_bot_kasir_otomatis", "diubah");
    periksa("aleta_bot_kasir_otomatis.diubah: tampil jam setempat", r.ok && (await dekatSetempat(r.setelan.diubah)), r.setelan && r.setelan.diubah);
  });

  // ── 3. Kasir rekap: dicatat ───────────────────────────────────────────────
  await uji("kasir_setor_pnbp.dicatat", async () => {
    const k = require(path.join(akarBot, "services/kasirRekapService"));
    const kueriSipp = async (sql) => (/NOW\(\)/.test(sql) ? [{ hari: hariSetempat }] : []);
    const l = k.buatLayanan({ kueri: kueriSipp, kueriAleta: kueri, migrasiUtc: botDb.pastikanUtc });
    const r = await l.catatSetor({ operator: "uji", tanggal: hariSetempat, ntpn: "N1" });
    periksa("kasir catatSetor ok", r.ok, JSON.stringify(r));
    await kolomUtc("aleta_bot_kasir_setor_pnbp.dicatat", "aleta_bot_kasir_setor_pnbp", "dicatat");
    const d = await l.daftarSetor(hariSetempat, hariSetempat);
    periksa("aleta_bot_kasir_setor_pnbp.dicatat: tampil jam setempat", d.ok && d.baris[0] && (await dekatSetempat(d.baris[0].dicatat)), JSON.stringify(d.baris[0] || d));
  });

  // ── 4. Kendali berkas & jalannya ──────────────────────────────────────────
  await uji("kendali", async () => {
    const k = require(path.join(akarBot, "services/kendaliBerkasService"));
    await k.ensureSchema();
    await k.simpanKendali({
      nomorPerkara: "1/Pdt.G/2026/PA.Uji",
      perkaraId: 1,
      jenisPerkara: "Cerai Gugat",
      tanggalDaftar: "2026-10-01",
      sipp: {},
      aleta: {},
      jumlahKurang: 0,
      keadaan: "lengkap",
      rincianKurang: [],
      sippTerbaca: true,
    });
    await kolomUtc("aleta_bot_kendali_berkas.disinkron_pada", "aleta_bot_kendali_berkas", "disinkron_pada");
    await kolomUtc("aleta_bot_kendali_berkas.updated_at", "aleta_bot_kendali_berkas", "updated_at");
    // Jalan yang detaknya 3 menit lalu (UTC) masih hidup; yang 30 menit lalu ditutup.
    const tiga = botDb.toMysqlDate(new Date(Date.now() - 3 * 60000));
    const tiga0 = botDb.toMysqlDate(new Date(Date.now() - 30 * 60000));
    await kueri(
      "INSERT INTO aleta_bot_kendali_runs (id, dimulai_pada, detak_pada, dijalankan_oleh, sumber, target, keadaan) VALUES ('hidup', ?, ?, 'uji', 'uji', 0, 'berjalan'), ('mati', ?, ?, 'uji', 'uji', 0, 'berjalan')",
      [tiga, tiga, tiga0, tiga0]
    );
    await k.tutupJalanMangkrak();
    const hidup = await k.jalanYangMasihHidup();
    periksa("aleta_bot_kendali_runs.detak_pada: detak 3 menit lalu masih hidup", hidup && hidup.id === "hidup", JSON.stringify(hidup));
    const keadaan = await kueri("SELECT id, keadaan FROM aleta_bot_kendali_runs ORDER BY id");
    periksa(
      "aleta_bot_kendali_runs.detak_pada: detak 30 menit lalu ditutup, 3 menit lalu tidak",
      keadaan.map((b) => `${b.id}:${b.keadaan}`).join(",") === "hidup:berjalan,mati:terputus",
      keadaan.map((b) => `${b.id}:${b.keadaan}`).join(",")
    );
    await kolomUtc("aleta_bot_kendali_runs.selesai_pada (ditutup)", "aleta_bot_kendali_runs", "selesai_pada", "id = 'mati'");
    const r = await k.ringkasan();
    const satu = (r.riwayat || []).find((x) => x.id === "hidup");
    periksa("aleta_bot_kendali_runs.dimulai_pada: ISO = saat sebenarnya", satu && Math.abs(new Date(satu.dimulaiPada).getTime() - (Date.now() - 180000)) < 60000, satu && satu.dimulaiPada);
  });

  // ── 5. Status mediasi ─────────────────────────────────────────────────────
  await uji("mediasi_status", async () => {
    const m = require(path.join(akarBot, "services/mediasiStatusService"));
    const l = m.buatLayanan({ kueriBot: kueri, migrasiUtc: botDb.pastikanUtc });
    const r = await l.setelStatus({ mediasiId: "77", perkaraId: "7", tanggal: hariSetempat, keadaan: "berjalan", kering: false });
    periksa("mediasi setelStatus ok", r.ok && r.berubah, JSON.stringify(r));
    await kolomUtc("aleta_bot_mediasi_status.ditandai_pada", "aleta_bot_mediasi_status", "ditandai_pada");
    const p = await l.petaStatus({ dari: hariSetempat });
    const satu = p.peta[m.kunciMediasi("77", hariSetempat)];
    periksa("aleta_bot_mediasi_status.ditandai_pada: 'sejak' jam setempat", satu && (await dekatSetempat(satu.sejak)), satu && satu.sejak);
    await l.setelStatus({ mediasiId: "77", tanggal: hariSetempat, keadaan: "berjalan", batal: true, kering: false });
    await kolomUtc("aleta_bot_mediasi_status.dibatalkan_pada", "aleta_bot_mediasi_status", "dibatalkan_pada", "dibatalkan_pada IS NOT NULL");
  });

  // ── 6. Riwayat panggil petugas ────────────────────────────────────────────
  await uji("panggil_riwayat", async () => {
    const p = require(path.join(akarBot, "services/panggilPetugasService"));
    const l = p.buatLayanan({ kueriBot: kueri, kueriSipp: async () => [], migrasiUtc: botDb.pastikanUtc });
    const a = await l.catat({ perkaraId: "9", saluran: "audio", sasaranKunci: "hakim", teks: "uji", hasil: "diumumkan", oleh: "uji" });
    periksa("panggil catat ok", a.ok, JSON.stringify(a));
    await kolomUtc("aleta_bot_panggil_riwayat.dibuat_pada", "aleta_bot_panggil_riwayat", "dibuat_pada");
    const b = await l.catat({ perkaraId: "9", saluran: "audio", sasaranKunci: "hakim", teks: "uji", oleh: "uji" });
    const jam = /pukul (\d{2}:\d{2})/.exec((b && b.pesan) || "");
    periksa("aleta_bot_panggil_riwayat.dibuat_pada: jeda menahan panggilan kedua", b.ok === false && b.alasan === "baru_saja_dipanggil", JSON.stringify(b));
    periksa(
      "aleta_bot_panggil_riwayat.dibuat_pada: pesan jeda menyebut jam setempat",
      jam && (await dekatSetempat(`${hariSetempat} ${jam[1]}:00`, 180)),
      jam && jam[1]
    );
    const u = await l.pengumuman({ sejakId: 0 });
    periksa("aleta_bot_panggil_riwayat.dibuat_pada: pengumuman baru terbaca", u.ok && u.daftar.length === 1 && (await dekatSetempat(u.daftar[0].dibuat)), JSON.stringify(u));
    const w = await l.riwayat({ perkaraId: "9", tanggal: hariSetempat });
    periksa(
      "aleta_bot_panggil_riwayat.dibuat_pada: riwayat hari setempat memuatnya, jam setempat",
      w.ok && w.daftar.length === 1 && (await dekatSetempat(w.daftar[0].waktu)),
      JSON.stringify(w.daftar)
    );
    await l.perbarui({ id: a.id, hasil: "diumumkan", keterangan: "uji" });
    await kolomUtc("aleta_bot_panggil_riwayat.diperbarui_pada", "aleta_bot_panggil_riwayat", "diperbarui_pada", "diperbarui_pada IS NOT NULL");
  });

  // ── 7. Putusan e-Court: diperiksa_pada ────────────────────────────────────
  await uji("ecourt_putusan", async () => {
    const p = require(path.join(akarBot, "services/putusanEcourtService"));
    await p.simpan("2/Pdt.G/2026/PA.Uji", { adaTab: true, adaBaris: false, alasan: "uji" });
    await kolomUtc("aleta_bot_ecourt_putusan.diperiksa_pada", "aleta_bot_ecourt_putusan", "diperiksa_pada");
    const d = await p.daftarPerluTindakan({ batas: 5 });
    periksa("aleta_bot_ecourt_putusan.diperiksa_pada: ISO = saat sebenarnya", d[0] && dekatKini(d[0].diperiksaPada), d[0] && d[0].diperiksaPada);
  });

  // ── 8. Sidang selesai / berjalan / skors ──────────────────────────────────
  await uji("sidang", async () => {
    const s = require(path.join(akarBot, "services/sidangSelesaiService"));
    const l = s.buatLayanan({
      kueriBot: kueri,
      kueriSipp: async () => [],
      kueriRuangTunggu: async () => ({ affectedRows: 0 }),
      setelAntrian: async () => ({ ok: true }),
      disidangSelesai: null,
      disidangProses: null,
      migrasiUtc: botDb.pastikanUtc,
    });
    const b = await l.setelBerjalan({ perkaraId: "11", tanggalSidang: hariSetempat, kering: false });
    periksa("setelBerjalan ok", b.ok, JSON.stringify(b));
    await kolomUtc("aleta_bot_sidang_berjalan.ditandai_pada", "aleta_bot_sidang_berjalan", "ditandai_pada");
    const peta1 = await l.petaSelesai({ dari: hariSetempat });
    const p1 = peta1.berjalan && peta1.berjalan.manual[s.kunciSelesai("11", hariSetempat)];
    const tandaBerjalan = p1 ? p1.ditandaiPada : "";
    periksa("aleta_bot_sidang_berjalan.ditandai_pada: tampil jam setempat", await dekatSetempat(tandaBerjalan), JSON.stringify(p1));
    await l.setelBerjalan({ perkaraId: "11", tanggalSidang: hariSetempat, berjalan: false, kering: false });
    await kolomUtc("aleta_bot_sidang_berjalan.dibatalkan_pada", "aleta_bot_sidang_berjalan", "dibatalkan_pada", "dibatalkan_pada IS NOT NULL");

    // Skors dengan perkiraan lanjut jam setempat +45 menit.
    const j = await jamDb();
    const lanjut = new Date(ms(j.setempat) + 45 * 60000);
    const perkiraan = `${dua(lanjut.getUTCHours())}:${dua(lanjut.getUTCMinutes())}`;
    const perkiraanPenuh = `${hariSetempat} ${perkiraan}:00`;
    const k1 = await l.setelSkors({ perkaraId: "12", tanggalSidang: hariSetempat, alasan: "uji", perkiraanLanjut: perkiraan, kering: false });
    periksa("setelSkors ok", k1.ok, JSON.stringify(k1));
    await kolomUtc("aleta_bot_sidang_skors.diskors_pada", "aleta_bot_sidang_skors", "diskors_pada");
    const pk = await mentah("aleta_bot_sidang_skors", "perkiraan_lanjut");
    periksa(
      "aleta_bot_sidang_skors.perkiraan_lanjut: tersimpan UTC (masukan setempat - selisih)",
      ms(pk) === ms(perkiraanPenuh) - selisihDb * 1000,
      `mentah=${pk} masukan=${perkiraanPenuh}`
    );
    const d1 = await l.daftarSkors({ dari: hariSetempat, perkaraId: "12" });
    const s1 = d1.skors && d1.skors[0];
    periksa("aleta_bot_sidang_skors.diskors_pada: tampil jam setempat", s1 && (await dekatSetempat(s1.diskorsPada)), JSON.stringify(s1));
    periksa("aleta_bot_sidang_skors.perkiraan_lanjut: tampil persis masukan setempat", s1 && s1.perkiraanLanjut === perkiraanPenuh, s1 && s1.perkiraanLanjut);
    const k2 = await l.setelSkors({ perkaraId: "12", tanggalSidang: hariSetempat, skors: false, kering: false });
    periksa("lanjutkan skors ok", k2.ok, JSON.stringify(k2));
    await kolomUtc("aleta_bot_sidang_skors.dilanjutkan_pada", "aleta_bot_sidang_skors", "dilanjutkan_pada", "dilanjutkan_pada IS NOT NULL");
    const d2 = await l.daftarSkors({ dari: hariSetempat, perkaraId: "12" });
    const s2 = d2.skors && d2.skors[0];
    periksa(
      "aleta_bot_sidang_skors.dilanjutkan_pada: tampil jam setempat, lama skors wajar",
      s2 && (await dekatSetempat(s2.dilanjutkanPada)) && Number(s2.lamaDetik) >= 0 && Number(s2.lamaDetik) < 600,
      JSON.stringify(s2)
    );
    // F3.1: skors lama ditutup saat sidang dipanggil lagi lewat antrian (jam setempat).
    await l.setelSkors({ perkaraId: "13", tanggalSidang: hariSetempat, alasan: "uji", kering: false });
    await kueri("UPDATE aleta_bot_sidang_skors SET diskors_pada = DATE_SUB(diskors_pada, INTERVAL 10 MINUTE) WHERE perkara_id = '13'");
    const panggil = (await jamDb()).setempat;
    await l.setelSkors({ perkaraId: "13", tanggalSidang: hariSetempat, alasan: "uji 2", panggilSaatSkors: panggil, kering: false });
    const lama = await kueri(
      "SELECT DATE_FORMAT(dilanjutkan_pada, '%Y-%m-%d %H:%i:%s') AS l, lama_detik AS d FROM aleta_bot_sidang_skors WHERE perkara_id = '13' AND dilanjutkan_pada IS NOT NULL"
    );
    periksa(
      "aleta_bot_sidang_skors.dilanjutkan_pada (dipanggil lagi): UTC dari jam antrian setempat, lama ±600 dtk",
      lama[0] && ms(lama[0].l) === ms(panggil) - selisihDb * 1000 && Math.abs(Number(lama[0].d) - 600) <= 5,
      JSON.stringify(lama)
    );

    const t = await l.setelSelesai({ perkaraId: "14", tanggalSidang: hariSetempat, kering: false });
    periksa("setelSelesai ok", t.ok, JSON.stringify(t));
    await kolomUtc("aleta_bot_sidang_selesai.ditandai_pada", "aleta_bot_sidang_selesai", "ditandai_pada");
    const peta2 = await l.petaSelesai({ dari: hariSetempat });
    const p2 = peta2.peta && peta2.peta[s.kunciSelesai("14", hariSetempat)];
    periksa("aleta_bot_sidang_selesai.ditandai_pada: tampil jam setempat", p2 && (await dekatSetempat(p2.ditandaiPada)), JSON.stringify(p2));
  });

  // ── 9. Ringkasan e-Court ──────────────────────────────────────────────────
  await uji("ecourt_ringkasan", async () => {
    const k = require(path.join(akarBot, "services/kontakEcourtService"));
    await k.simpanRingkasan("15", "15/Pdt.G/2026/PA.Uji", [{ kunci: "kontak.uji", nilai: "x", keyakinan: "pasti", asal: "teks" }], {});
    await kolomUtc("aleta_bot_ecourt_ringkasan.diperbarui", "aleta_bot_ecourt_ringkasan", "diperbarui");
  });

  // ── 10. Jejak penetapan ───────────────────────────────────────────────────
  await uji("jejak_penetapan", async () => {
    const j = require(path.join(akarBot, "services/jejakAletaService"));
    const ok = await j.catat({ aksi: "tulis", jenis: "PMH", perkaraId: 16, nomorPerkara: "16/X", tanggalPenetapan: "2026-10-17", berhasil: true, jamSipp: "2026-10-17 09:00:00" });
    periksa("jejak catat ok", ok === true);
    await kolomUtc("aleta_bot_jejak_penetapan.waktu", "aleta_bot_jejak_penetapan", "waktu");
    const jamSipp = await mentah("aleta_bot_jejak_penetapan", "jam_sipp");
    periksa("aleta_bot_jejak_penetapan.jam_sipp: cermin jam SIPP disimpan apa adanya", jamSipp === "2026-10-17 09:00:00", jamSipp);
    const r = await j.riwayat({ perkaraId: 16 });
    const b = r.baris && r.baris[0];
    periksa("aleta_bot_jejak_penetapan.waktu: ISO = saat sebenarnya", b && dekatKini(b.waktu), b && b.waktu);
    periksa("aleta_bot_jejak_penetapan.tanggal_penetapan: tanggal tidak mundur", b && b.tanggalPenetapan === "2026-10-17", b && b.tanggalPenetapan);
  });

  // ── 11. Tanda tangan ──────────────────────────────────────────────────────
  await uji("tanda_tangan", async () => {
    const t = require(path.join(akarBot, "services/tandaTanganService"));
    const png = Buffer.alloc(5000, 1);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const r = await t.tambah({ isiBase64: png.toString("base64"), namaPejabat: "Uji Pejabat", oleh: "uji" });
    periksa("tanda tangan tambah ok", r.ok, JSON.stringify(r));
    await kolomUtc("aleta_bot_tanda_tangan.diinput_tanggal", "aleta_bot_tanda_tangan", "diinput_tanggal");
    const id = r.id || (await kueri("SELECT MAX(id) AS id FROM aleta_bot_tanda_tangan"))[0].id;
    await t.sahkan(id, { oleh: "uji" });
    await kolomUtc("aleta_bot_tanda_tangan.disahkan_pada", "aleta_bot_tanda_tangan", "disahkan_pada", "disahkan_pada IS NOT NULL");
    const d = await t.daftar();
    const b = d.baris.find((x) => x.id === Number(id));
    periksa("aleta_bot_tanda_tangan.disahkan_pada: ISO = saat sebenarnya", b && dekatKini(b.disahkanPada), b && b.disahkanPada);
  });

  // ── 12. Antrean pesan: jadwal dan klaim ───────────────────────────────────
  await uji("message_queue", async () => {
    await botDb.ensureSchema();
    const q = require(path.join(akarBot, "services/messageQueueService"));
    const sisip = (id, jadwal) =>
      kueri(
        `INSERT INTO aleta_bot_message_queue (id, idempotency_key, recipient_number, message_body, category, priority, status,
           retry_count, max_retries, scheduled_at, metadata_json, created_at, updated_at)
         VALUES (?, ?, '6280000000000', 'uji', 'system', 1, 'pending', 0, 0, ?, '{"dryRun":true}', ?, ?)`,
        [id, id, botDb.toMysqlDate(jadwal), botDb.toMysqlDate(new Date()), botDb.toMysqlDate(new Date())]
      );
    await sisip("nanti", new Date(Date.now() + 2 * 3600000));
    const pertama = await q.processNextMessage(async () => ({ ok: true }));
    periksa("aleta_bot_message_queue.scheduled_at: pesan terjadwal 2 jam lagi BELUM diambil", pertama === null, pertama && pertama.id);
    await sisip("sekarang", new Date(Date.now() - 60000));
    let diklaim = null;
    const kedua = await q.processNextMessage(async () => {
      diklaim = await mentah("aleta_bot_message_queue", "updated_at", "id = 'sekarang'");
      return { ok: true };
    });
    periksa("aleta_bot_message_queue.scheduled_at: pesan yang sudah jatuh tempo diambil", kedua && kedua.id === "sekarang", kedua && kedua.id);
    periksa("aleta_bot_message_queue.updated_at (klaim): tersimpan UTC", diklaim && (await dekatUtc(diklaim)), `mentah=${diklaim}`);
  });

  // ── 13. Sesi tanya-jawab publik: kedaluwarsa ──────────────────────────────
  await uji("public_qa_sessions", async () => {
    await botDb.ensureSchema();
    const kini = new Date();
    await kueri(
      `INSERT INTO aleta_bot_public_qa_sessions (id, sender_number, current_intent_key, state, collected_params_json, expires_at, created_at, updated_at)
       VALUES ('s1', '6281111', 'uji', 'collecting', '{}', ?, ?, ?)`,
      [botDb.toMysqlDate(new Date(kini.getTime() + 30 * 60000)), botDb.toMysqlDate(kini), botDb.toMysqlDate(kini)]
    );
    const qa = require(path.join(akarBot, "services/publicQaIntentService"));
    const fn = qa.getActiveSession || (qa.__uji && qa.__uji.getActiveSession);
    if (!fn) {
      const b = await kueri(
        `SELECT id FROM aleta_bot_public_qa_sessions WHERE sender_number = '6281111' AND expires_at > ${botDb.SQL_UTC_KINI || "NOW()"}`
      );
      periksa("aleta_bot_public_qa_sessions.expires_at: sesi 30 menit lagi masih berlaku", b.length === 1, `baris=${b.length}`);
      return;
    }
    const s = await fn("6281111");
    periksa("aleta_bot_public_qa_sessions.expires_at: sesi 30 menit lagi masih berlaku", s && s.id === "s1", JSON.stringify(s));
  });

  // ── 14. Hitungan "hari ini" log pesan ─────────────────────────────────────
  await uji("message_logs hari ini", async () => {
    await botDb.ensureSchema();
    // 00.30 setempat hari ini = UTC (00.30 - selisih) - pada WITA itu tanggal KEMARIN dalam UTC.
    const awalSetempat = ms(`${hariSetempat} 00:30:00`);
    const masuk = botDb.toMysqlDate(new Date(awalSetempat - selisihDb * 1000));
    const kemarin = botDb.toMysqlDate(new Date(awalSetempat - selisihDb * 1000 - 3600000));
    for (const [id, w] of [["hari-ini", masuk], ["kemarin", kemarin]]) {
      await kueri(
        `INSERT INTO aleta_bot_message_logs (id, queue_id, idempotency_key, notification_key, category, recipient_number, recipient_name,
           message_preview, status, retry_count, metadata_json, created_at)
         VALUES (?, '', ?, '', 'uji', '628', '', '', 'sent', 0, '{}', ?)`,
        [id, id, w]
      );
    }
    const log = require(path.join(akarBot, "services/logService"));
    const st = await log.getMessageStatsToday();
    periksa("aleta_bot_message_logs.created_at: 'hari ini' = hari setempat (00.30 masuk, 23.30 kemarin tidak)", st.sent === 1, JSON.stringify(st));
  });

  // ── 15. Penjaga: helper aturan tersedia ───────────────────────────────────
  periksa("botDbService.sqlSetempat tersedia", typeof botDb.sqlSetempat === "function");
  periksa("botDbService.pastikanUtc tersedia", typeof botDb.pastikanUtc === "function");
}

// ─── Migrasi data lama ──────────────────────────────────────────────────────
async function ujiMigrasi({ kueri, botDb, mentah, jamDb, selisihDb }) {
  await uji("migrasi", async () => {
    if (typeof botDb.pastikanUtc !== "function") throw new Error("botDbService.pastikanUtc belum ada");
    // Bentuk lama, isi lama: jam setempat dari NOW() (dan dari jam proses).
    await kueri(`CREATE TABLE IF NOT EXISTS aleta_bot_mediasi_status (id INT PRIMARY KEY, ditandai_pada DATETIME NOT NULL, dibatalkan_pada DATETIME NULL) ENGINE=InnoDB`);
    await kueri(`INSERT INTO aleta_bot_mediasi_status VALUES (1, NOW(), NULL), (2, NOW() - INTERVAL 1 DAY, NOW()), (3, '0000-00-00 00:00:00', NULL)`);
    await kueri(`CREATE TABLE IF NOT EXISTS aleta_bot_message_queue (id VARCHAR(16) PRIMARY KEY, status VARCHAR(16), updated_at DATETIME NOT NULL) ENGINE=InnoDB`);
    await kueri(
      `INSERT INTO aleta_bot_message_queue VALUES ('proses-lama', 'processing', NOW()), ('proses-baru', 'processing', UTC_TIMESTAMP()), ('terkirim', 'sent', UTC_TIMESTAMP())`
    );
    const prosesSetempat = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())} ${dua(d.getHours())}:${dua(d.getMinutes())}:${dua(d.getSeconds())}`;
    })();
    await kueri(`CREATE TABLE IF NOT EXISTS aleta_bot_jejak_penetapan (id INT PRIMARY KEY, waktu DATETIME NOT NULL, jam_sipp DATETIME NULL) ENGINE=InnoDB`);
    await kueri(`INSERT INTO aleta_bot_jejak_penetapan VALUES (1, ?, '2026-10-17 09:00:00')`, [prosesSetempat]);

    const sebelum = await kueri(`SELECT id, DATE_FORMAT(ditandai_pada, '%Y-%m-%d %H:%i:%s') AS t, DATE_FORMAT(dibatalkan_pada, '%Y-%m-%d %H:%i:%s') AS b FROM aleta_bot_mediasi_status ORDER BY id`);
    const q0 = await kueri(`SELECT id, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS t FROM aleta_bot_message_queue ORDER BY id`);
    const ringkas = await botDb.pastikanUtc();
    const sesudah = await kueri(`SELECT id, DATE_FORMAT(ditandai_pada, '%Y-%m-%d %H:%i:%s') AS t, DATE_FORMAT(dibatalkan_pada, '%Y-%m-%d %H:%i:%s') AS b FROM aleta_bot_mediasi_status ORDER BY id`);
    const geser = (a, b) => (ms(a) - ms(b)) / 1000;
    periksa(
      "migrasi mediasi_status: baris NOW() lama digeser -selisih server",
      geser(sebelum[0].t, sesudah[0].t) === selisihDb && geser(sebelum[1].b, sesudah[1].b) === selisihDb,
      JSON.stringify({ sebelum, sesudah, selisihDb })
    );
    periksa("migrasi mediasi_status: NULL tetap NULL, tanggal nol tidak disentuh", sesudah[0].b === null && sebelum[2].t === sesudah[2].t, JSON.stringify(sesudah));
    const utc = (await jamDb()).utc;
    periksa("migrasi mediasi_status: hasilnya = jam UTC", Math.abs(ms(sesudah[0].t) - ms(utc)) < 120000, `${sesudah[0].t} vs ${utc}`);
    const cadangan = await kueri(`SELECT id, DATE_FORMAT(ditandai_pada, '%Y-%m-%d %H:%i:%s') AS t FROM aleta_bot_mediasi_status_pra_utc ORDER BY id`);
    periksa("migrasi mediasi_status: cadangan memuat nilai asli", cadangan.length === 3 && cadangan[0].t === sebelum[0].t, JSON.stringify(cadangan));

    const q1 = await kueri(`SELECT id, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS t FROM aleta_bot_message_queue ORDER BY id`);
    const peta0 = Object.fromEntries(q0.map((b) => [b.id, b.t]));
    const peta1 = Object.fromEntries(q1.map((b) => [b.id, b.t]));
    periksa(
      "migrasi message_queue: hanya 'processing' ber-jam setempat yang digeser",
      geser(peta0["proses-lama"], peta1["proses-lama"]) === selisihDb && peta0["proses-baru"] === peta1["proses-baru"] && peta0.terkirim === peta1.terkirim,
      JSON.stringify({ q0, q1 })
    );

    const j = await kueri(`SELECT DATE_FORMAT(waktu, '%Y-%m-%d %H:%i:%s') AS w, DATE_FORMAT(jam_sipp, '%Y-%m-%d %H:%i:%s') AS s FROM aleta_bot_jejak_penetapan`);
    const selisihProses = -new Date().getTimezoneOffset() * 60;
    periksa(
      "migrasi jejak_penetapan.waktu: jam proses lama digeser -selisih proses; jam_sipp tidak",
      geser(prosesSetempat, j[0].w) === selisihProses && j[0].s === "2026-10-17 09:00:00",
      JSON.stringify({ prosesSetempat, j, selisihProses })
    );

    const tanda = await kueri(`SELECT kunci, selesai, selisih_detik AS s FROM aleta_bot_migrasi_utc ORDER BY kunci`);
    periksa("migrasi: tiap entri bertanda selesai", tanda.length > 0 && tanda.every((b) => Number(b.selesai) === 1), JSON.stringify(tanda));

    // Dijalankan ulang (bot dinyalakan ulang): tidak boleh menggeser dua kali.
    const ulang = await botDb.pastikanUtc({ paksaUlang: true });
    const lagi = await kueri(`SELECT id, DATE_FORMAT(ditandai_pada, '%Y-%m-%d %H:%i:%s') AS t FROM aleta_bot_mediasi_status ORDER BY id`);
    periksa("migrasi: jalan kedua tidak menggeser lagi", lagi[0].t === sesudah[0].t, JSON.stringify({ lagi, ulang }));
    console.log(`ringkasan migrasi: ${JSON.stringify(ringkas).slice(0, 400)}`);
  });
}

main()
  .catch((galat) => periksa("jalan", false, String((galat && galat.stack) || galat)))
  .finally(() => {
    let gagal = 0;
    for (const h of hasil) {
      if (!h.benar) gagal += 1;
      console.log(`${h.benar ? "LULUS" : "GAGAL"}  ${h.nama}${h.benar ? "" : `  [${h.rincian.slice(0, 300)}]`}`);
    }
    console.log(`${hasil.length - gagal}/${hasil.length} lulus`);
    try {
      require(path.join(akarBot, "bot_db_config")).end(() => process.exit(gagal ? 1 : 0));
      setTimeout(() => process.exit(gagal ? 1 : 0), 3000).unref();
    } catch {
      process.exit(gagal ? 1 : 0);
    }
  });
