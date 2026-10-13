/**
 * 13 Okt 2026, butir 11-13:
 *  11. akun utama penarikan e-Court SELALU aktif (terukur: runtime config server
 *      tanpa ecourtJadwal -> penjadwal & penarik verifikasi harian mati; 12 Okt
 *      tidak ada satu pun tarikan otomatis) + jam kerja menurut WITA (proses bot
 *      di container berjalan dalam UTC);
 *  12. status penarikan data e-Court dari log reports/ecourt-unduh-*.log;
 *  13. pemeriksaan sesi ringan (satu HTTPS bercookie) yang hanya mempercayai
 *      jawaban pasti-berlaku, selebihnya kembali ke Chrome.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import {
  kalimatPenarikan,
  keadaanSesi,
  peringatanPenarikan,
  waktuPendek,
  type StatusPenarikan,
} from "@/lib/status-penarikan-ecourt";

// Dunia terpisah SEBELUM modul bot dimuat: jalur runtime config dan folder
// sesi dibaca saat modul dimuat.
const AKAR_UJI = fs.mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "aleta-akun-utama-"));
const BERKAS_CONFIG = path.join(AKAR_UJI, "aleta-runtime.json");
const FOLDER_SESI = path.join(AKAR_UJI, "sesi");
process.env.ALETA_BOT_RUNTIME_CONFIG_PATH = BERKAS_CONFIG;
process.env.ALETA_ECOURT_SESSION_DIR = FOLDER_SESI;
process.env.ALETA_ECOURT_KREDENSIAL_DIR = FOLDER_SESI;
process.env.ALETA_BOT_DATA_DIR = path.join(AKAR_UJI, "data");
process.env.ALETA_ZONA_WAKTU = "Asia/Makassar";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

// Catatan keamanan bot tidak boleh menyentuh basis data mana pun dari uji.
const jalurLog = require_.resolve(path.join(AKAR, "aleta_bot/services/logService.js"));
const catatan: Array<Record<string, unknown>> = [];
require_.cache[jalurLog] = {
  id: jalurLog,
  filename: jalurLog,
  loaded: true,
  exports: {
    logSecurityEvent: async (d: Record<string, unknown>) => void catatan.push(d),
    logSystemEvent: async (d: Record<string, unknown>) => void catatan.push(d),
  },
} as unknown as NodeJS.Module;

type AkunUtama = { slot: string; sah: boolean; alasan: string; bawaan: boolean; pesan: string };
const akunSvc = require_(path.join(AKAR, "aleta_bot/services/ecourtAkunService.js")) as {
  keadaanAkunUtama: () => AkunUtama;
  daftarAkun: () => Array<{ slot: string; aktif: boolean; utama: boolean }>;
  simpanAkun: (o: Record<string, unknown>) => { ok: boolean; alasan: string };
  hapusAkun: (slot: string) => { ok: boolean; alasan: string };
  pilihAkunUtama: (slot: string, o?: Record<string, unknown>) => { ok: boolean; alasan: string };
  lepasAkunUtama: (o: Record<string, unknown>) => { ok: boolean; alasan: string };
  pilihAkunSiap: () => { ok: boolean; slot: string };
};
const penjadwal = require_(path.join(AKAR, "aleta_bot/services/ecourtSchedulerService.js")) as {
  getSettings: () => { aktif: boolean; aktifTersimpan: boolean; selaluAktif: boolean };
  dalamJamKerja: (t: Date, p: Record<string, unknown>) => boolean;
  hitungJadwalBerikutnya: (o: Record<string, unknown>) => string | null;
  berhenti: () => void;
};
const statusSvc = require_(path.join(AKAR, "aleta_bot/services/ecourtPenarikanStatusService.js")) as {
  ringkasLog: (o: Record<string, unknown>) => Record<string, unknown>;
  bacaRiwayat: (o: Record<string, unknown>) => Array<Record<string, unknown>>;
  statusPenarikan: (deps: Record<string, unknown>) => StatusPenarikan & { ok: boolean };
};
const ringanSvc = require_(path.join(AKAR, "aleta_bot/services/ecourtSesiRinganService.js")) as {
  simpanKuki: (slot: string, c: unknown[], o?: Record<string, unknown>) => boolean;
  bacaKuki: (slot: string, o?: Record<string, unknown>) => Array<{ name: string; value: string }>;
  jalurKuki: (slot: string) => string;
  periksaRingan: (slot: string, o: Record<string, unknown>) => Promise<{ pasti: boolean; berlaku: boolean | null; alasan: string }>;
};
const sesiStatus = require_(path.join(AKAR, "aleta_bot/services/ecourtSesiStatusService.js")) as {
  aturAlat: (a: Record<string, unknown>) => void;
  keadaanSlot: (slot: string, o?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  lupakan: (slot?: string) => void;
};

function tulisConfig(isi: Record<string, unknown>) {
  fs.writeFileSync(BERKAS_CONFIG, JSON.stringify(isi));
}
function buatSesi(slot: string) {
  fs.mkdirSync(path.join(FOLDER_SESI, slot, "Default"), { recursive: true });
}
function hapusSesi(slot: string) {
  fs.rmSync(path.join(FOLDER_SESI, slot), { recursive: true, force: true });
}

describe("butir 11: akun utama penarikan selalu aktif", () => {
  it("keadaan server 13 Okt (tanpa ecourtJadwal, akun bawaan 'utama' bersesi): dulu mati, sekarang SELALU menyala", () => {
    tulisConfig({ ecourtPantauSesi: { aktif: true, jedaMenit: 10 } });
    buatSesi("utama");
    const u = akunSvc.keadaanAkunUtama();
    expect(u).toMatchObject({ slot: "utama", sah: true, bawaan: true });
    expect(penjadwal.getSettings()).toMatchObject({ aktif: true, aktifTersimpan: false, selaluAktif: true });
    penjadwal.berhenti();
  });

  it("akun utama belum login -> tidak sah, peringatan jelas, penjadwal kembali ke saklar (mati)", () => {
    tulisConfig({});
    hapusSesi("utama");
    const u = akunSvc.keadaanAkunUtama();
    expect(u).toMatchObject({ slot: "utama", sah: false, alasan: "belum_login" });
    expect(u.pesan).toMatch(/belum pernah login/);
    expect(penjadwal.getSettings()).toMatchObject({ aktif: false, selaluAktif: false });
  });

  it("akun utama tidak dapat dimatikan atau dihapus; akun lain boleh", () => {
    tulisConfig({ ecourtAkun: [{ slot: "utama", label: "Akun utama", aktif: true }, { slot: "akun-2", label: "Akun 2", aktif: true }] });
    buatSesi("utama");
    expect(akunSvc.simpanAkun({ slot: "utama", label: "Akun utama", aktif: false })).toMatchObject({ ok: false, alasan: "akun_utama_selalu_aktif" });
    expect(akunSvc.hapusAkun("utama")).toMatchObject({ ok: false, alasan: "akun_utama_tidak_dapat_dihapus" });
    expect(akunSvc.simpanAkun({ slot: "akun-2", label: "Akun 2", aktif: false }).ok).toBe(true);
    // Saklar tersimpan yang mematikan utama (suntingan tangan) tetap dibaca aktif.
    tulisConfig({ ecourtAkun: [{ slot: "utama", label: "Akun utama", aktif: false }, { slot: "akun-2", label: "Akun 2", aktif: true }] });
    expect(akunSvc.daftarAkun().find((a) => a.slot === "utama")).toMatchObject({ aktif: true, utama: true });
  });

  it("melepas wajib kata penegas LEPAS; memilih akun lain memindahkan tanda dan mendahulukannya", () => {
    tulisConfig({ ecourtAkun: [{ slot: "utama", label: "Akun utama", aktif: true }, { slot: "akun-2", label: "Akun 2", aktif: true }] });
    buatSesi("utama");
    buatSesi("akun-2");
    expect(akunSvc.lepasAkunUtama({ konfirmasi: "" })).toMatchObject({ ok: false, alasan: "perlu_kata_penegas" });
    expect(akunSvc.lepasAkunUtama({ konfirmasi: "ya" })).toMatchObject({ ok: false, alasan: "perlu_kata_penegas" });
    expect(penjadwal.getSettings().aktif).toBe(true);

    expect(akunSvc.pilihAkunUtama("akun-2").ok).toBe(true);
    expect(akunSvc.keadaanAkunUtama()).toMatchObject({ slot: "akun-2", sah: true, bawaan: false });
    expect(akunSvc.pilihAkunSiap()).toMatchObject({ ok: true, slot: "akun-2" });

    expect(akunSvc.lepasAkunUtama({ konfirmasi: "lepas" }).ok).toBe(true);
    expect(akunSvc.keadaanAkunUtama()).toMatchObject({ slot: "", sah: false, alasan: "dilepas" });
    expect(penjadwal.getSettings()).toMatchObject({ aktif: false, selaluAktif: false });
    expect(catatan.some((c) => c.eventType === "ecourt_akun_utama_dilepas")).toBe(true);
    penjadwal.berhenti();
  });

  it("jam kerja dibaca dalam WITA, bukan zona proses (container UTC)", () => {
    const p = { jamMulai: 7, jamSelesai: 17 };
    // 00.30 UTC Selasa = 08.30 WITA: jam kerja. Dulu (getHours di UTC) di luar.
    expect(penjadwal.dalamJamKerja(new Date("2026-10-13T00:30:00Z"), p)).toBe(true);
    // 10.00 UTC = 18.00 WITA: di luar jam kerja.
    expect(penjadwal.dalamJamKerja(new Date("2026-10-13T10:00:00Z"), p)).toBe(false);
    // Sabtu 09.00 WITA.
    expect(penjadwal.dalamJamKerja(new Date("2026-10-17T01:00:00Z"), p)).toBe(false);
  });

  it("jadwal putaran berikutnya: detak pertama sesudah jarak dan di jam kerja", () => {
    const p = { jamMulai: 7, jamSelesai: 17 };
    const mulai = Date.parse("2026-10-12T22:50:00Z"); // Selasa 06.50 WITA
    expect(
      penjadwal.hitungJadwalBerikutnya({ aktif: true, timerMulaiMs: mulai, jarakJam: 2, sekarangMs: Date.parse("2026-10-12T22:55:00Z"), pengaturan: p })
    ).toBe("2026-10-12T23:05:00.000Z");
    expect(
      penjadwal.hitungJadwalBerikutnya({
        aktif: true,
        timerMulaiMs: mulai,
        terakhirPutaranMs: Date.parse("2026-10-12T23:05:00Z"),
        jarakJam: 2,
        sekarangMs: Date.parse("2026-10-12T23:10:00Z"),
        pengaturan: p,
      })
    ).toBe("2026-10-13T01:05:00.000Z");
    // Jumat 16.50 WITA -> Senin 07.05 WITA.
    const jumat = Date.parse("2026-10-16T08:50:00Z");
    expect(
      penjadwal.hitungJadwalBerikutnya({ aktif: true, timerMulaiMs: jumat, jarakJam: 2, sekarangMs: jumat + 60000, pengaturan: p })
    ).toBe("2026-10-18T23:05:00.000Z");
    expect(penjadwal.hitungJadwalBerikutnya({ aktif: false, timerMulaiMs: mulai, jarakJam: 2, pengaturan: p })).toBeNull();
  });
});

// Potongan log nyata server (reports/, 7-12 Okt 2026).
const LOG_497_KEPALA = `=== Penarikan e-Court dimulai 2026-10-12T08:35:14.294Z (sumber: jadwal-belum-upload, perkara: 497/Pdt.G/2026/PA.Dgl) ===
[08.35.14] Sisa ruang disk: 597.3 GB.
[08.35.14] Membuka peramban e-Court...
[08.35.14] Memakai sesi tersimpan. Bila masih berlaku, tidak perlu login lagi.
[08.35.18] Sesi tersimpan masih berlaku.
`;
const LOG_497_EKOR = `[08.36.54] Penarikan tertarget: 497/Pdt.G/2026/PA.Dgl (PA.DGL-10082026HXM).
[08.36.54] 1 perkara berkasnya sudah lengkap, tidak dibuka.
[08.36.54] Ditemukan 0 perkara untuk diperiksa.

=== Ringkasan sinkronisasi ===
  Perkara diperiksa : 0
  Dokumen terlihat  : 0
  Dokumen baru      : 0
  Berkas terunduh   : 0
  Berkas tidak berubah : 0
  Galat             : 0
=== Selesai. (2026-10-12T08:36:54.385Z) ===
`;
const LOG_BELUM_ADA = {
  kepala: `=== Penarikan e-Court dimulai 2026-10-09T01:01:11.898Z (sumber: portal-belum-ada) ===
[01.01.15] Sesi tersimpan masih berlaku.
`,
  ekor: `=== Ringkasan sinkronisasi ===
  Perkara diperiksa : 120
  Dokumen terlihat  : 524
  Dokumen baru      : 510
  Berkas terunduh   : 408
  Galat             : 14
  Galat terakhir    : Kartu Tanda Anggota: penanda_tidak_dikenali
=== Selesai. (2026-10-09T01:41:35.295Z) ===
`,
};
const LOG_GAGAL = {
  kepala: `=== Penarikan e-Court dimulai 2026-10-07T01:24:12.883Z (sumber: portal-menyeluruh) ===
`,
  ekor: `[01.24.18] Sinkronisasi berhenti: Protocol error (Page.navigate): Target closed

=== Ringkasan sinkronisasi ===
  Perkara diperiksa : 0
  Galat             : 0
  Galat terakhir    : Protocol error (Page.navigate): Target closed
=== Berhenti dengan kode 1. (2026-10-07T01:24:18.378Z) ===
`,
};

describe("butir 12: status penarikan dari log", () => {
  it("log nyata 497 (12 Okt): per perkara, berhasil tetapi perkara tidak dibuka - sebabnya disebut", () => {
    const r = statusSvc.ringkasLog({ nama: "ecourt-unduh-20261012-083514.log", kepala: LOG_497_KEPALA, ekor: LOG_497_EKOR, diubahMs: 0 });
    expect(r).toMatchObject({
      jenis: "perkara",
      perkara: "497/Pdt.G/2026/PA.Dgl",
      sumber: "jadwal-belum-upload",
      otomatis: false,
      hasil: "berhasil",
      perkaraDiperiksa: 0,
      dokumenBaru: 0,
      sesiBerlaku: true,
      selesai: "2026-10-12T08:36:54.385Z",
    });
    expect(r.sebab).toMatch(/tidak dibuka/);
  });

  it("berkala berhasil dengan galat, gagal dengan sebab, dihentikan paksa, sesi habis, terputus, dan akun dari kepala baru", () => {
    expect(statusSvc.ringkasLog({ nama: "a.log", ...LOG_BELUM_ADA })).toMatchObject({
      jenis: "berkala",
      hasil: "berhasil",
      perkaraDiperiksa: 120,
      dokumenBaru: 510,
      berkasTerunduh: 408,
      galat: 14,
    });
    expect(statusSvc.ringkasLog({ nama: "b.log", ...LOG_GAGAL })).toMatchObject({
      hasil: "gagal",
      sebab: "Protocol error (Page.navigate): Target closed",
    });
    expect(
      statusSvc.ringkasLog({
        nama: "c.log",
        kepala: "=== Penarikan e-Court dimulai 2026-10-05T03:05:03.046Z (sumber: portal-menyeluruh) ===\n",
        ekor: "=== Dihentikan paksa setelah melewati batas 120 menit. (2026-10-05T05:05:03.164Z) ===\n",
      })
    ).toMatchObject({ hasil: "gagal", sebab: "Dihentikan paksa setelah melewati batas 120 menit." });
    expect(
      statusSvc.ringkasLog({
        nama: "d.log",
        kepala: "=== Penarikan e-Court dimulai 2026-10-14T00:05:00.000Z (sumber: jadwal, akun: utama) ===\n",
        ekor: "=== Sesi e-Court habis. Perlu login dari portal. (2026-10-14T00:05:09.000Z) ===\n",
      })
    ).toMatchObject({ hasil: "sesi-habis", akun: "utama", otomatis: true, sesiBerlaku: false });
    const kepalaJalan = "=== Penarikan e-Court dimulai 2026-10-14T00:05:00.000Z (sumber: verifikasi, perkara: 1/Pdt.G/2026/PA.Dgl, akun: utama) ===\n";
    expect(statusSvc.ringkasLog({ nama: "e.log", kepala: kepalaJalan, ekor: "[..] Membuka", diubahMs: 1000, sekarangMs: 2000 })).toMatchObject({ hasil: "berjalan", akun: "utama" });
    expect(statusSvc.ringkasLog({ nama: "e.log", kepala: kepalaJalan, ekor: "[..] Membuka", diubahMs: 0, sekarangMs: 10 * 60 * 1000 })).toMatchObject({ hasil: "terputus" });
  });

  it("riwayat dibaca dari folder log (terbaru dulu) dan dirangkum: terakhir berkala & per perkara, akun utama, jadwal, sesi", () => {
    const folder = path.join(AKAR_UJI, "reports");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "ecourt-unduh-20261009-010111.log"), LOG_BELUM_ADA.kepala + "...\n" + LOG_BELUM_ADA.ekor);
    fs.writeFileSync(path.join(folder, "ecourt-unduh-20261012-083514.log"), LOG_497_KEPALA + "...\n" + LOG_497_EKOR);
    fs.writeFileSync(path.join(folder, "bukan-log.txt"), "x");
    const riwayat = statusSvc.bacaRiwayat({ folder });
    expect(riwayat.map((r) => r.nama)).toEqual(["ecourt-unduh-20261012-083514.log", "ecourt-unduh-20261009-010111.log"]);

    const s = statusSvc.statusPenarikan({
      folderLog: folder,
      penjadwal: {
        getStatus: () => ({
          pengaturan: { aktif: true, aktifTersimpan: false, selaluAktif: true, jarakJam: 2, jamMulai: 7, jamSelesai: 17, akunUtama: { slot: "utama", label: "Akun utama", sah: true, dipilih: true, bawaan: true, alasan: "", pesan: "" } },
          dalamJamKerja: true,
          sedangJalan: false,
          berikutnya: "2026-10-13T01:05:00.000Z",
          zonaWaktu: "Asia/Makassar",
          daftarAkun: [{ slot: "utama", label: "Akun utama" }],
        }),
      },
      akun: {},
      verifikasi: { status: () => ({ menyala: true, detakBerikutnya: "2026-10-13T00:45:00.000Z", terakhirPutaran: "", tersambung: true, jumlahTarik: 0 }) },
      sesiStatus: { terakhirDiketahui: () => null },
      pantau: { getStatus: () => ({ berlaku: null, terakhirDetak: null }) },
    });
    expect(s.terakhirPerkara).toMatchObject({ perkara: "497/Pdt.G/2026/PA.Dgl" });
    expect(s.terakhirBerkala).toMatchObject({ sumber: "portal-belum-ada", dokumenBaru: 510 });
    expect(s.penjadwal).toMatchObject({ aktif: true, selaluAktif: true, berikutnya: "2026-10-13T01:05:00.000Z" });
    // Bukti sesi terbaru: penarikan 12 Okt yang menulis "Sesi tersimpan masih berlaku".
    expect(s.sesi).toMatchObject({ berlaku: true, sumber: "penarikan" });
  });

  it("portal: kalimat, waktu WITA, dan peringatan", () => {
    const r = statusSvc.ringkasLog({ nama: "ecourt-unduh-20261012-083514.log", kepala: LOG_497_KEPALA, ekor: LOG_497_EKOR }) as unknown as StatusPenarikan["riwayat"][number];
    expect(waktuPendek("2026-10-12T08:35:14.294Z")).toBe("12 Okt 16.35 WITA");
    expect(kalimatPenarikan({ ...r, labelAkun: "" })).toContain("tombol belum upload (Jadwal Sidang), 497/Pdt.G/2026/PA.Dgl");
    expect(kalimatPenarikan(null)).toBe("Belum ada catatan penarikan.");
    const dasar: StatusPenarikan = {
      dibaca: "",
      akunUtama: { slot: "", label: "", dipilih: false, sah: false, bawaan: false, alasan: "belum_dipilih", pesan: "Akun utama belum dipilih - penarikan otomatis tidak dijamin jalan." },
      penjadwal: { aktif: false, aktifTersimpan: false, selaluAktif: false, jarakJam: 2, jamMulai: 7, jamSelesai: 17, dalamJamKerja: true, sedangJalan: false, sumberBerjalan: "", perkaraBerjalan: "", akunBerjalan: "", berikutnya: null, zonaWaktu: "Asia/Makassar" },
      verifikasiHarian: null,
      terakhirBerkala: null,
      terakhirPerkara: { ...r, hasil: "gagal", sebab: "Target closed", labelAkun: "" },
      riwayat: [],
      sesi: { berlaku: false, pada: "2026-10-12T08:36:54.385Z", sumber: "penarikan" },
    };
    const p = peringatanPenarikan(dasar);
    expect(p[0]).toMatch(/Akun utama belum dipilih/);
    expect(p.join(" ")).toMatch(/tidak berjalan/);
    expect(p.join(" ")).toMatch(/Sesi e-Court akun utama habis/);
    expect(p.join(" ")).toMatch(/Penarikan terakhir gagal: Target closed/);
    expect(keadaanSesi(dasar.sesi).nada).toBe("danger");
  });
});

describe("butir 13: pemeriksaan sesi ringan", () => {
  const sandi = { sandikan: (t: string) => Buffer.from(t).reverse().toString("base64"), bukaSandi: (t: string) => Buffer.from(t, "base64").reverse().toString() };

  it("cookie disimpan tersandi (nilai tidak tampak polos) dan hanya domain e-Court", () => {
    const ok = ringanSvc.simpanKuki(
      "utama",
      [
        { name: "ci_session", value: "RAHASIA123", domain: "ecourt.mahkamahagung.go.id", path: "/" },
        { name: "lain", value: "x", domain: "contoh.go.id" },
      ],
      { sandi }
    );
    expect(ok).toBe(true);
    expect(fs.readFileSync(ringanSvc.jalurKuki("utama"), "utf8")).not.toContain("RAHASIA123");
    expect(ringanSvc.bacaKuki("utama", { sandi }).map((c) => c.name)).toEqual(["ci_session"]);
  });

  it("hanya pengalihan /Login ke halaman sesudah masuk yang PASTI; login/gerbang/galat/tanpa cookie = ragu", async () => {
    const diminta: Array<Record<string, string>> = [];
    const jawab = (j: Record<string, unknown>) => async (_a: string, kepala: Record<string, string>) => {
      diminta.push(kepala);
      return { setCookie: [], location: "", status: 200, ...j };
    };
    const pasti = await ringanSvc.periksaRingan("utama", { sandi, minta: jawab({ status: 302, location: "/dashboard" }) });
    expect(pasti).toMatchObject({ pasti: true, berlaku: true });
    expect(diminta[0].Cookie).toBe("ci_session=RAHASIA123");
    expect(diminta[0]["X-Requested-With"]).toBe("XMLHttpRequest");

    expect(await ringanSvc.periksaRingan("utama", { sandi, minta: jawab({ status: 200 }) })).toMatchObject({ pasti: false, alasan: "halaman_login" });
    expect(await ringanSvc.periksaRingan("utama", { sandi, minta: jawab({ status: 302, location: "https://ecourt.mahkamahagung.go.id/GateLogin" }) })).toMatchObject({ pasti: false, alasan: "gerbang" });
    expect(await ringanSvc.periksaRingan("utama", { sandi, minta: jawab({ status: 302, location: "/Login" }) })).toMatchObject({ pasti: false });
    expect(
      await ringanSvc.periksaRingan("utama", { sandi, minta: async () => Promise.reject(new Error("ETIMEDOUT")) })
    ).toMatchObject({ pasti: false, alasan: expect.stringMatching(/galat_jaringan/) });
    expect(await ringanSvc.periksaRingan("akun-kosong", { sandi, minta: jawab({ status: 302, location: "/dashboard" }) })).toMatchObject({ pasti: false, alasan: "kuki_belum_ada" });
  });

  it("keadaan sesi: ringan pasti -> tanpa Chrome; ragu -> Chrome seperti dulu", async () => {
    buatSesi("utama");
    let chrome = 0;
    sesiStatus.aturAlat({
      ringan: async () => ({ pasti: true, berlaku: true, alasan: "", ms: 420 }),
      periksaSesi: async (o: { cepat: boolean }) => {
        if (!o.cepat) chrome += 1;
        return o.cepat
          ? { tersimpan: true, berlaku: null, alasan: "belum_diperiksa", namaPengguna: "" }
          : { tersimpan: true, berlaku: false, alasan: "sesi_kedaluwarsa", namaPengguna: "", diperiksaPada: "2026-10-13T00:00:00.000Z" };
      },
    });
    sesiStatus.lupakan();
    // Layar dibuka (tanpa "periksa penuh"): kini jawabannya pasti, bukan "belum diperiksa".
    expect(await sesiStatus.keadaanSlot("utama")).toMatchObject({ keadaan: "berlaku", cara: "ringan", lamaMs: 420 });
    expect(chrome).toBe(0);

    sesiStatus.lupakan();
    sesiStatus.aturAlat({ ringan: async () => ({ pasti: false, berlaku: null, alasan: "halaman_login", ms: 300 }) });
    expect(await sesiStatus.keadaanSlot("utama", { paksa: true })).toMatchObject({ keadaan: "kedaluwarsa", cara: "peramban" });
    expect(chrome).toBe(1);
    // Tanpa periksa penuh dan ringan ragu: tetap "belum diperiksa", tidak menyalakan Chrome.
    sesiStatus.lupakan();
    expect(await sesiStatus.keadaanSlot("utama")).toMatchObject({ keadaan: "belum_pasti" });
    expect(chrome).toBe(1);
  });
});
