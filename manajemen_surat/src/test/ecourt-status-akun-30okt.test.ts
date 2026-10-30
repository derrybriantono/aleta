/**
 * 30 Okt 2026 - STATUS AKUN e-COURT SATU SUMBER + AKUN & SANDI TERSIMPAN.
 *
 * Keluhan pengguna: "kadang sudah tidak konek tapi disitu sebut konek, terus
 * sudah konek tapi masih merah". Yang dijaga di sini:
 *
 *   1. model status (bot): lima keadaan & peralihannya dari bukti nyata;
 *      bukti basi tidak pernah dibaca "tersambung"; bukti terbaru menang
 *      (milidetik, bukan teks); masuk melepas istirahat; keluar = belum diatur;
 *   2. pemeriksaan RINGAN sungguhan terhadap e-Court TIRUAN lokal (tanpa
 *      Chrome): sah -> aktif, sesi diputus -> ragu -> Chrome (ditiru) -> perlu
 *      masuk, 503 / mati -> tidak tersambung; Chrome dibatasi jeda;
 *   3. sandi: tersandi (kunci lingkungan), tidak pernah keluar di jawaban rute
 *      bot, jejak keamanan, atau berkas polos; tanpa kunci sah = DITOLAK;
 *   4. hak: status ringkas untuk semua, daftar akun & periksa hanya Admin;
 *      simpan sandi hanya Admin; rute masuk meneruskan simpan tanpa sandi balik;
 *   5. penanda SINKRON: tiap keadaan tampil dengan judul & warna yang SAMA di
 *      lampu sambungan ekstensi, baris Tarik data popup (JSDOM sungguhan),
 *      lampu panel perkara, kesehatan server, dan peringatan penarikan.
 *
 * Simulasi Chrome sungguhan (puppeteer + e-Court tiruan, captcha diketik
 * "manusia"): D:/Aplikasi/aleta/tmp/ecourt-status/simulasi/simulasi.cjs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DAFTAR_KEADAAN_ECOURT,
  JUDUL_KEADAAN,
  keadaanSambunganLama,
  sesiDariStatus,
  tampilanStatus,
  type KeadaanEcourt,
  type StatusAkunEcourt,
} from "@/lib/ecourt-status-akun";
import { peringatanPenarikan, type StatusPenarikan } from "@/lib/status-penarikan-ecourt";
import { ringkasTarikEcourt } from "@/lib/tarik-ecourt-status";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { periksaEcourt } from "@/server/modules/kesehatan/pemeriksa";

// ---------------------------------------------------------------------------
// Dunia terpisah SEBELUM modul bot dimuat (jalur dibaca saat dimuat).
// ---------------------------------------------------------------------------
const AKAR = path.resolve(process.cwd(), "..");
const SEMENTARA = fs.mkdtempSync(path.join(process.env.TMP && /^[dD]:/.test(process.env.TMP) ? process.env.TMP : "D:/Aplikasi/aleta/tmp", "uji-ecourt-status-"));
const SESI = path.join(SEMENTARA, "sesi");
fs.mkdirSync(SESI, { recursive: true });
fs.writeFileSync(path.join(SEMENTARA, "aleta-runtime.json"), "{}");
const KUNCI_UJI = "kunci-uji-status-akun-0123456789abcdef";
process.env.ALETA_BOT_RUNTIME_CONFIG_PATH = path.join(SEMENTARA, "aleta-runtime.json");
process.env.ALETA_ECOURT_SESSION_DIR = SESI;
process.env.ALETA_ECOURT_KREDENSIAL_DIR = SESI;
process.env.ALETA_BOT_DATA_DIR = path.join(SEMENTARA, "data");
process.env.ALETA_ECOURT_KUNCI = KUNCI_UJI;
process.env.ALETA_ECOURT_STATUS_LATAR = "0";
delete process.env.ALETA_MODE;

const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const { buat: buatTiruan } = require_(path.join(AKAR, "manajemen_surat/src/test/fixtures/ecourt-tiruan.cjs")) as {
  buat: (o?: Record<string, unknown>) => any;
};
const tiruan = await buatTiruan({ sandi: "SandiTiruan#9" }).mulai();
process.env.ALETA_ECOURT_ALAMAT_UJI = tiruan.alamat;

// Jejak keamanan bot ditangkap, tidak ke basis data.
const jejakBot: Array<Record<string, unknown>> = [];
function tiru(rel: string, exports: Record<string, unknown>) {
  const jalur = require_.resolve(path.join(AKAR, rel));
  require_.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
}
tiru("aleta_bot/services/logService.js", {
  logSecurityEvent: async (d: Record<string, unknown>) => void jejakBot.push(d),
  logSystemEvent: async (d: Record<string, unknown>) => void jejakBot.push(d),
  logError: async () => undefined,
});

const muatBot = <T,>(rel: string) => require_(path.join(AKAR, "aleta_bot", rel)) as T;
type StatusBot = StatusAkunEcourt & { sudahKeluar?: boolean };
const statusSvc = muatBot<{
  KEADAAN: Record<string, string>;
  SEGAR_MS: number;
  JEDA_PERAMBAN_MS: number;
  aturAlat: (a: Record<string, unknown>) => void;
  catat: (slot: string, b: Record<string, unknown>) => unknown;
  catatPemeriksaan: (slot: string, h: Record<string, unknown>) => unknown;
  catatPenarikan: (slot: string, h: Record<string, unknown>) => unknown;
  catatSandiDitolak: (slot: string) => void;
  lepasSandiDitolak: (slot: string) => void;
  lupakan: (slot: string) => void;
  segarkan: (slot: string, o?: Record<string, unknown>) => Promise<StatusBot>;
  setelUlang: () => void;
  statusSlot: (slot: string) => StatusBot;
  statusSemua: (o?: Record<string, unknown>) => { akun: StatusBot[]; ringkas: StatusBot; utama: string };
  susunStatus: (m: Record<string, unknown>) => StatusBot;
}>("services/ecourtStatusAkunService.js");
const akunSvc = muatBot<{
  simpanAkun: (o: Record<string, unknown>) => { ok: boolean };
  hapusAkun: (slot: string) => { ok: boolean };
  tandaiGagal: (slot: string, a: string) => void;
  daftarAkun: () => Array<{ slot: string; istirahat: boolean }>;
}>("services/ecourtAkunService.js");
const kredSvc = muatBot<{
  simpan: (o: Record<string, unknown>) => { ok: boolean; alasan: string };
  ambil: (slot: string) => { email: string; sandi: string } | null;
  daftar: () => Array<Record<string, unknown>>;
  sandikan: (t: string) => string;
  bukaSandi: (t: string) => string;
  keadaan: () => Record<string, unknown>;
}>("services/ecourtKredensialService.js");
const ringanSvc = muatBot<{ simpanKuki: (slot: string, k: unknown[]) => boolean }>("services/ecourtSesiRinganService.js");
const tarikSvc = muatBot<{ ringkasLog: (o: Record<string, unknown>) => Record<string, unknown> }>(
  "services/ecourtPenarikanStatusService.js"
);

const MENIT = 60_000;
let jam = Date.parse("2026-10-30T02:00:00.000Z");
// Log penarikan di folder repo (bila ada) tidak boleh ikut menjadi bukti uji.
statusSvc.aturAlat({ sekarang: () => jam, riwayatLog: () => [] });

/** Profil Chrome "pernah dipakai" = folder Default ada. */
function buatProfil(slot = "utama") {
  fs.mkdirSync(path.join(SESI, slot, "Default"), { recursive: true });
}
function hapusProfil(slot = "utama") {
  fs.rmSync(path.join(SESI, slot), { recursive: true, force: true });
}
function bersihkanStatus() {
  fs.rmSync(path.join(SESI, "status-akun.json"), { force: true });
  statusSvc.setelUlang();
}

afterAll(async () => {
  await tiruan.tutup().catch(() => undefined);
});

// ===========================================================================
describe("1. model status: lima keadaan dan peralihannya", () => {
  const dasar = { slot: "utama", terdaftar: true, adaSesi: true, sekarangMs: jam };
  const bukti = (jenis: string, umurMenit: number, alasan = "") => ({ jenis, padaMs: jam - umurMenit * MENIT, sumber: "pemeriksaan", alasan });

  it("tabel keadaan: belum diatur, memeriksa, aktif, perlu masuk, tidak tersambung", () => {
    const s = (m: Record<string, unknown>) => statusSvc.susunStatus({ ...dasar, ...m });
    expect(s({ adaSesi: false })).toMatchObject({ keadaan: "belum_diatur", nada: "kelabu", tindakan: "masuk", kodeSebab: "belum_pernah_masuk" });
    expect(s({ terdaftar: false })).toMatchObject({ keadaan: "belum_diatur", kodeSebab: "tidak_terdaftar" });
    expect(s({ kembaran: true })).toMatchObject({ keadaan: "belum_diatur", kodeSebab: "kembaran" });
    expect(s({ bukti: null })).toMatchObject({ keadaan: "memeriksa", nada: "kelabu", kodeSebab: "belum_diperiksa" });
    expect(s({ bukti: null, sedangMemeriksa: true })).toMatchObject({ keadaan: "memeriksa", kodeSebab: "sedang_diperiksa" });
    expect(s({ bukti: bukti("aktif", 5) })).toMatchObject({ keadaan: "aktif", nada: "hijau", kodeSebab: "terbukti", tindakan: "" });
    expect(s({ bukti: bukti("perlu_masuk", 5) })).toMatchObject({ keadaan: "perlu_masuk", nada: "kuning", tindakan: "masuk_lagi" });
    expect(s({ bukti: bukti("perlu_masuk", 5, "gerbang") })).toMatchObject({ keadaan: "perlu_masuk", kodeSebab: "gerbang" });
    expect(s({ bukti: bukti("tidak_tersambung", 5, "jaringan") })).toMatchObject({ keadaan: "tidak_tersambung", nada: "merah" });
  });

  it("'tertulis konek padahal tidak': bukti tersambung yang basi TIDAK dibaca tersambung", () => {
    const s = (umur: number) => statusSvc.susunStatus({ ...dasar, bukti: bukti("aktif", umur) });
    expect(s(29).keadaan).toBe("aktif");
    expect(s(31)).toMatchObject({ keadaan: "memeriksa", kodeSebab: "bukti_basi_aktif", tindakan: "periksa" });
    // Tidak tersambung yang lama juga dipastikan ulang, bukan merah selamanya.
    expect(statusSvc.susunStatus({ ...dasar, bukti: bukti("tidak_tersambung", 45) })).toMatchObject({ keadaan: "memeriksa", kodeSebab: "bukti_basi_putus" });
    // Perlu masuk TIDAK menjadi basi: sesi mati tidak hidup sendiri.
    expect(statusSvc.susunStatus({ ...dasar, bukti: bukti("perlu_masuk", 600) }).keadaan).toBe("perlu_masuk");
  });

  it("peristiwa -> bukti: masuk, pemeriksaan, penarikan; bukti TERBARU menang (milidetik)", () => {
    bersihkanStatus();
    buatProfil();
    statusSvc.catat("utama", { jenis: "perlu_masuk", sumber: "penarikan", alasan: "sesi_habis", padaMs: jam - 10 * MENIT });
    expect(statusSvc.statusSlot("utama").keadaan).toBe("perlu_masuk");
    // 'sudah konek tapi masih merah': masuk berhasil -> aktif SEKETIKA.
    statusSvc.catat("utama", { jenis: "aktif", sumber: "masuk" });
    expect(statusSvc.statusSlot("utama")).toMatchObject({ keadaan: "aktif", sumber: "masuk" });
    // Bukti yang lebih LAMA tidak menimpa yang lebih baru.
    statusSvc.catat("utama", { jenis: "perlu_masuk", sumber: "pemantau", padaMs: jam - 2 * MENIT });
    expect(statusSvc.statusSlot("utama").keadaan).toBe("aktif");

    statusSvc.catatPemeriksaan("utama", { tersimpan: true, berlaku: false, alasan: "sesi_kedaluwarsa" });
    expect(statusSvc.statusSlot("utama").keadaan).toBe("perlu_masuk");
    statusSvc.catatPemeriksaan("utama", { tersimpan: true, berlaku: null, alasan: "gagal_memeriksa: net::ERR_NAME_NOT_RESOLVED at https://x" });
    expect(statusSvc.statusSlot("utama").keadaan).toBe("tidak_tersambung");
    statusSvc.catatPemeriksaan("utama", { tersimpan: true, berlaku: null, alasan: "ecourt_gangguan: status 502" });
    expect(statusSvc.statusSlot("utama").keadaan).toBe("tidak_tersambung");
    // Ragu (Chrome gagal dijalankan) bukan bukti - keadaan tidak berubah.
    statusSvc.catatPemeriksaan("utama", { tersimpan: true, berlaku: null, alasan: "gagal_memeriksa: Failed to launch the browser process" });
    expect(statusSvc.statusSlot("utama").keadaan).toBe("tidak_tersambung");
    statusSvc.catatPemeriksaan("utama", { tersimpan: true, berlaku: null, alasan: "gerbang_menunggu_penegasan" });
    expect(statusSvc.statusSlot("utama")).toMatchObject({ keadaan: "perlu_masuk", kodeSebab: "gerbang" });

    statusSvc.catatPenarikan("utama", { kode: 0 });
    expect(statusSvc.statusSlot("utama")).toMatchObject({ keadaan: "aktif", sumber: "penarikan" });
    statusSvc.catatPenarikan("utama", { kode: 1, catatan: "Berhenti dengan kode 1." });
    expect(statusSvc.statusSlot("utama")).toMatchObject({ keadaan: "aktif", galatTerakhir: expect.objectContaining({ teks: "Berhenti dengan kode 1." }) });
    statusSvc.catatPenarikan("utama", { kode: 2 });
    expect(statusSvc.statusSlot("utama")).toMatchObject({ keadaan: "perlu_masuk", kodeSebab: "sesi_habis" });
  });

  it("masuk melepas istirahat akun; keluar = belum diatur walau folder belum sempat terhapus", () => {
    bersihkanStatus();
    buatProfil();
    akunSvc.tandaiGagal("utama", "sesi_habis");
    expect(akunSvc.daftarAkun().find((a) => a.slot === "utama")?.istirahat).toBe(true);
    statusSvc.catat("utama", { jenis: "aktif", sumber: "masuk" });
    expect(akunSvc.daftarAkun().find((a) => a.slot === "utama")?.istirahat).toBe(false);

    statusSvc.lupakan("utama"); // keluar
    expect(fs.existsSync(path.join(SESI, "utama", "Default"))).toBe(true);
    expect(statusSvc.statusSlot("utama")).toMatchObject({ keadaan: "belum_diatur", kodeSebab: "sesi_dihapus" });
    jam += 1000;
    statusSvc.catat("utama", { jenis: "aktif", sumber: "masuk" });
    expect(statusSvc.statusSlot("utama").keadaan).toBe("aktif");
  });

  it("bukti bertahan melewati penyalaan ulang bot (berkas di folder sesi)", () => {
    bersihkanStatus();
    buatProfil();
    statusSvc.catat("utama", { jenis: "aktif", sumber: "masuk" });
    statusSvc.setelUlang(); // tembolok memori hilang
    expect(statusSvc.statusSlot("utama").keadaan).toBe("aktif");
    const berkas = fs.readFileSync(path.join(SESI, "status-akun.json"), "utf8");
    // Hanya bukti: tidak ada nilai sandi, cookie, atau surel.
    expect(berkas).not.toMatch(/"sandi"\s*:|cookie|ci_session|@/i);
  });

  it("log penarikan: sesi habis di tengah jalan mengalahkan 'masih berlaku' di kepala", () => {
    const r = tarikSvc.ringkasLog({
      nama: "ecourt-unduh-20261030-010000.log",
      kepala: "=== Penarikan e-Court dimulai 2026-10-30T01:00:00.000Z (sumber: jadwal, akun: utama) ===\n[..] Sesi tersimpan masih berlaku\n",
      ekor: "=== Sesi e-Court habis. Perlu login dari portal. (2026-10-30T01:20:00.000Z) ===\n",
    });
    expect(r).toMatchObject({ hasil: "sesi-habis", sesiBerlaku: false });
  });

  it("akun lain: bukti satu akun tidak menentukan akun lain; akun tak terdaftar = belum diatur", () => {
    bersihkanStatus();
    buatProfil("utama");
    buatProfil("akun-2");
    statusSvc.catat("akun-2", { jenis: "aktif", sumber: "masuk" });
    expect(statusSvc.statusSlot("akun-2")).toMatchObject({ keadaan: "belum_diatur", kodeSebab: "tidak_terdaftar" });
    expect(akunSvc.simpanAkun({ slot: "akun-2", label: "Akun cadangan", aktif: true }).ok).toBe(true);
    expect(statusSvc.statusSlot("akun-2")).toMatchObject({ keadaan: "aktif", label: "Akun cadangan" });
    expect(statusSvc.statusSlot("utama").keadaan).toBe("memeriksa");
    // Ringkasan = akun utama, bukan akun lain yang kebetulan tersambung.
    expect(statusSvc.statusSemua().ringkas).toMatchObject({ slot: "utama", keadaan: "memeriksa" });
    expect(akunSvc.hapusAkun("akun-2").ok).toBe(true);
    // Akun dihapus: buktinya ikut dibuang.
    expect(statusSvc.statusSlot("akun-2").keadaan).toBe("belum_diatur");
    hapusProfil("akun-2");
  });
});

// ===========================================================================
describe("2. pemeriksaan ringan SUNGGUHAN terhadap e-Court tiruan (tanpa Chrome)", () => {
  let panggilanChrome = 0;
  beforeEach(() => {
    bersihkanStatus();
    buatProfil();
    tiruan.atur({ mode: "normal" });
    panggilanChrome = 0;
    statusSvc.aturAlat({
      sibuk: () => false,
      // Chrome ditiru: membaca tiruan dengan cara yang sama (alamat akhir).
      periksaPenuh: async (slot: string) => {
        panggilanChrome += 1;
        const sah = [...tiruan.keadaan.sesi.values()].some((s: { sah: boolean }) => s.sah);
        const hasil = { tersimpan: true, berlaku: sah, alasan: sah ? "" : "sesi_kedaluwarsa" };
        statusSvc.catatPemeriksaan(slot, hasil);
        return hasil;
      },
    });
  });

  function sesiSah() {
    tiruan.keadaan.sesi.clear();
    tiruan.keadaan.sesi.set("sesi-uji-1", { sah: true, gerbang: false });
    ringanSvc.simpanKuki("utama", [{ name: "ci_session", value: "sesi-uji-1", domain: "127.0.0.1", path: "/" }]);
  }

  it("sah -> aktif lewat SATU permintaan, tanpa Chrome", async () => {
    sesiSah();
    const sebelum = tiruan.keadaan.hitung.periksa;
    const s = await statusSvc.segarkan("utama", { paksa: true, bolehPeramban: true });
    expect(s).toMatchObject({ keadaan: "aktif", sumber: "pemeriksaan" });
    expect(tiruan.keadaan.hitung.periksa - sebelum).toBe(1);
    expect(panggilanChrome).toBe(0);
  });

  it("sesi diputus e-Court: ringan ragu -> Chrome memastikan -> perlu masuk; Chrome dibatasi jeda", async () => {
    sesiSah();
    await statusSvc.segarkan("utama", { paksa: true });
    tiruan.habiskanSemuaSesi();
    // Tanpa izin Chrome: keadaan tidak diubah oleh jawaban yang ragu.
    jam += 6 * MENIT;
    await statusSvc.segarkan("utama", { bolehPeramban: false });
    expect(statusSvc.statusSlot("utama").keadaan).toBe("aktif");
    expect(panggilanChrome).toBe(0);
    jam += 6 * MENIT;
    await statusSvc.segarkan("utama", { bolehPeramban: true });
    expect(panggilanChrome).toBe(1);
    expect(statusSvc.statusSlot("utama")).toMatchObject({ keadaan: "perlu_masuk", tindakan: "masuk_lagi" });
    // Detak berikutnya dalam jeda Chrome: tidak membuka Chrome lagi.
    jam += 6 * MENIT;
    await statusSvc.segarkan("utama", { bolehPeramban: true });
    expect(panggilanChrome).toBe(1);
    // Jeda coba: permintaan beruntun tidak menembak e-Court berulang.
    const n = tiruan.keadaan.hitung.periksa;
    await statusSvc.segarkan("utama", {});
    expect(tiruan.keadaan.hitung.periksa).toBe(n);
  });

  it("e-Court 503 -> tidak tersambung (bukan 'perlu masuk'); pulih -> aktif lagi", async () => {
    sesiSah();
    tiruan.atur({ mode: "gangguan503" });
    expect((await statusSvc.segarkan("utama", { paksa: true })).keadaan).toBe("tidak_tersambung");
    tiruan.atur({ mode: "normal" });
    expect((await statusSvc.segarkan("utama", { paksa: true })).keadaan).toBe("aktif");
  });

  it("e-Court tidak terjangkau sama sekali -> tidak tersambung", async () => {
    const mati = await buatTiruan().mulai();
    const alamatMati = mati.alamat;
    await mati.tutup();
    const ringan = muatBot<{ periksaRingan: (s: string, o: Record<string, unknown>) => Promise<Record<string, unknown>> }>(
      "services/ecourtSesiRinganService.js"
    );
    sesiSah();
    statusSvc.aturAlat({
      periksaRingan: (slot: string) =>
        ringan.periksaRingan(slot, {
          minta: (alamat: string, kepala: Record<string, string>, batas: number) =>
            new Promise((ok, gagal) => {
              const req = require_("http").request(alamat.replace(tiruan.alamat, alamatMati), { headers: kepala, timeout: batas }, (res: any) => {
                res.resume();
                ok({ status: res.statusCode, location: String(res.headers.location || ""), setCookie: [] });
              });
              req.on("error", gagal);
              req.end();
            }),
        }),
    });
    try {
      const s = await statusSvc.segarkan("utama", { paksa: true, bolehPeramban: true });
      expect(s).toMatchObject({ keadaan: "tidak_tersambung", kodeSebab: "jaringan" });
      expect(panggilanChrome).toBe(0);
    } finally {
      statusSvc.aturAlat({ periksaRingan: (slot: string) => muatBot<{ periksaRingan: (s: string) => unknown }>("services/ecourtSesiRinganService.js").periksaRingan(slot) });
    }
  });

  it("gerbang (akun dipakai di perangkat lain) -> perlu masuk, sebab gerbang", async () => {
    sesiSah();
    tiruan.gerbangkanSemuaSesi();
    expect(await statusSvc.segarkan("utama", { paksa: true })).toMatchObject({ keadaan: "perlu_masuk", kodeSebab: "gerbang" });
  });
});

// ===========================================================================
describe("3. akun & sandi e-Court tersimpan: tersandi, tidak pernah keluar", () => {
  const SANDI = "Sandi-Rahasia-Uji#77";

  it("tersandi dengan kunci lingkungan; berkas tanpa sandi polos; daftar tanpa sandi; dibuka hanya di dalam bot", () => {
    const h = kredSvc.simpan({ slot: "utama", email: "pp@uji.test", sandi: SANDI, olehSiapa: "uji" });
    expect(h).toEqual({ ok: true, alasan: "" });
    const berkas = fs.readFileSync(path.join(SESI, "kredensial.json"), "utf8");
    expect(berkas).not.toContain(SANDI);
    expect(berkas).toMatch(/"sandi": "env1\./);
    expect(JSON.stringify(kredSvc.daftar())).not.toContain(SANDI);
    expect(kredSvc.daftar()).toEqual([expect.objectContaining({ slot: "utama", adaSandi: true, email: "pp@uji.test" })]);
    expect(kredSvc.ambil("utama")?.sandi).toBe(SANDI);
    expect(kredSvc.keadaan()).toMatchObject({ sumberKunci: "lingkungan" });
    expect(JSON.stringify(jejakBot)).not.toContain(SANDI);
    expect(jejakBot.some((j) => j.eventType === "ecourt_kredensial_disimpan")).toBe(true);
  });

  it("kunci tidak sah -> MENOLAK menyimpan (tidak pernah polos), simpanan lama tetap", () => {
    const sebelum = fs.readFileSync(path.join(SESI, "kredensial.json"), "utf8");
    process.env.ALETA_ECOURT_KUNCI = "pendek";
    try {
      const h = kredSvc.simpan({ slot: "utama", email: "pp@uji.test", sandi: "SandiLain#1" });
      expect(h.ok).toBe(false);
      expect(h.alasan).toMatch(/^kunci_tidak_tersedia/);
      const sesudah = fs.readFileSync(path.join(SESI, "kredensial.json"), "utf8");
      expect(sesudah).toBe(sebelum);
      expect(sesudah).not.toContain("SandiLain#1");
    } finally {
      process.env.ALETA_ECOURT_KUNCI = KUNCI_UJI;
    }
  });

  it("nilai lama (kunci berkas) tetap terbuka sesudah kunci lingkungan diisi", () => {
    delete process.env.ALETA_ECOURT_KUNCI;
    const lama = kredSvc.sandikan("sandi-lama");
    expect(lama.split(".")).toHaveLength(3);
    process.env.ALETA_ECOURT_KUNCI = KUNCI_UJI;
    expect(kredSvc.bukaSandi(lama)).toBe("sandi-lama");
    expect(kredSvc.sandikan("baru").startsWith("env1.")).toBe(true);
  });

  it("sandi tersimpan ditolak e-Court -> tanda 'sandi ditolak' sampai sandi baru disimpan", () => {
    bersihkanStatus();
    buatProfil();
    statusSvc.catat("utama", { jenis: "perlu_masuk", sumber: "masuk", alasan: "halaman_masuk" });
    statusSvc.catatSandiDitolak("utama");
    const t = tampilanStatus(statusSvc.statusSlot("utama"));
    expect(t).toMatchObject({ keadaan: "perlu_masuk", sandiDitolak: true, tindakan: "masuk_lagi" });
    expect(t.teks).toMatch(/masukkan sandi baru/);
    kredSvc.simpan({ slot: "utama", email: "pp@uji.test", sandi: "SandiBaru#2" });
    expect(statusSvc.statusSlot("utama").sandiDitolak).toBe(false);
  });

  it("penolakan login digolongkan: captcha vs sandi (bentuk alamat e-Court terukur 27 Okt)", () => {
    const login = muatBot<{ golongkanTolak: (j: string, p: string) => string }>("services/ecourtLoginService.js");
    expect(login.golongkanTolak("/Login/index/CAPTCHA", "")).toBe("captcha");
    expect(login.golongkanTolak("/Login/index/GAGAL", "Email atau password salah")).toBe("sandi");
    expect(login.golongkanTolak("/Login/index/GAGAL", "Kata sandi tidak sesuai")).toBe("sandi");
    expect(login.golongkanTolak("/Login", "")).toBe("");
  });

  it("rute bot: status, kredensial, masuk - tidak ada sandi di jawaban mana pun", async () => {
    process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-uji-status";
    const express = require_("express") as any;
    const app = express();
    app.use(express.json());
    app.use("/internal/aleta-bot", muatBot("routes/internalGatewayRoutes.js"));
    const server = await new Promise<any>((ok) => {
      const s = app.listen(0, "127.0.0.1", () => ok(s));
    });
    const kepala = { "content-type": "application/json", "x-aleta-internal-token": "token-uji-status" };
    try {
      const alamat = `http://127.0.0.1:${server.address().port}/internal/aleta-bot`;
      expect((await fetch(`${alamat}/ecourt/status-akun`)).status).toBe(401);
      const simpan = await (await fetch(`${alamat}/ecourt/kredensial`, { method: "POST", headers: kepala, body: JSON.stringify({ slot: "utama", email: "pp@uji.test", sandi: SANDI }) })).text();
      const teks = [
        simpan,
        await (await fetch(`${alamat}/ecourt/kredensial`, { headers: kepala })).text(),
        await (await fetch(`${alamat}/ecourt/status-akun?segarkan=0`, { headers: kepala })).text(),
        await (await fetch(`${alamat}/ecourt/login/status?slot=utama`, { headers: kepala })).text(),
        await (await fetch(`${alamat}/ecourt/akun`, { headers: kepala })).text(),
      ].join("\n");
      expect(JSON.parse(simpan)).toMatchObject({ ok: true });
      expect(teks).not.toContain(SANDI);
      expect(teks).not.toMatch(/env1\./);
      const status = JSON.parse(teks.split("\n")[2]);
      expect(status).toMatchObject({ ok: true, utama: "utama", ringkas: expect.objectContaining({ slot: "utama", adaSandi: true }) });
      expect(DAFTAR_KEADAAN_ECOURT).toContain(status.ringkas.keadaan);
      expect(JSON.parse(teks.split("\n")[3]).statusAkun).toMatchObject({ slot: "utama" });
    } finally {
      server.close();
      delete process.env.ALETA_BOT_INTERNAL_API_TOKEN;
    }
    expect(JSON.stringify(jejakBot)).not.toContain(SANDI);
    // Tidak ada rute yang membuka sandi.
    const router = fs.readFileSync(path.join(AKAR, "aleta_bot/routes/internalGatewayRoutes.js"), "utf8");
    expect(router).not.toMatch(/ecourtKredensialService\.ambil\s*\(/);
  });
});

// ===========================================================================
// Rute portal atas pg-mem berbenih; bot ditiru lewat fetch.
// ===========================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

type Kiriman = { url: string; badan: any };
let kiriman: Kiriman[] = [];
function tiruBot(jawab: (url: string, badan: any) => { status?: number; json?: unknown }) {
  kiriman = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const badan = init?.body ? JSON.parse(String(init.body)) : null;
    kiriman.push({ url: String(url), badan });
    const j = jawab(String(url), badan);
    return new Response(JSON.stringify(j.json ?? {}), { status: j.status ?? 200, headers: { "content-type": "application/json" } });
  });
}
async function rute(modul: string, cara: "GET" | "POST" | "PUT", opsi: { query?: string; badan?: unknown } = {}) {
  const r = (await import(`@/app/api/${modul}/route`)) as Record<string, (q: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? `?${opsi.query}` : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : {},
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const j = await r[cara](req);
  return { status: j.status, isi: (await j.json()) as any };
}

const statusContoh = (keadaan: KeadaanEcourt, ekstra: Partial<StatusAkunEcourt> = {}): StatusAkunEcourt => ({
  slot: "utama",
  label: "Akun utama",
  utama: true,
  aktifAkun: true,
  keadaan,
  nada: ({ aktif: "hijau", perlu_masuk: "kuning", tidak_tersambung: "merah", memeriksa: "kelabu", belum_diatur: "kelabu" } as const)[keadaan],
  kodeSebab: ({ aktif: "terbukti", perlu_masuk: "sesi_habis", tidak_tersambung: "jaringan", memeriksa: "bukti_basi_aktif", belum_diatur: "belum_pernah_masuk" } as const)[keadaan],
  tindakan: ({ aktif: "", perlu_masuk: "masuk_lagi", tidak_tersambung: "periksa", memeriksa: "periksa", belum_diatur: "masuk" } as const)[keadaan],
  diperiksaPada: "2026-10-30T01:45:00.000Z",
  umurDetik: 60,
  sumber: "pemeriksaan",
  adaSandi: true,
  ...ekstra,
});

describe("4. rute portal: hak akses & sandi tidak kembali", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });

  const jawabStatus = (keadaan: KeadaanEcourt) => () => ({
    json: { ok: true, dibaca: "", utama: "utama", akun: [statusContoh(keadaan), statusContoh("perlu_masuk", { slot: "akun-2", label: "Akun cadangan", utama: false })], ringkas: statusContoh(keadaan) },
  });

  it("status-akun GET: Admin melihat semua akun; pegawai biasa hanya ringkasan", async () => {
    tiruBot(jawabStatus("aktif"));
    const a = await rute("aleta-ecourt/status-akun", "GET");
    expect(a.isi.data).toMatchObject({ tersedia: true, ringkas: { keadaan: "aktif", judul: "Tersambung", lencana: "success" } });
    expect(a.isi.data.akun).toHaveLength(2);
    expect(kiriman[0].url).toContain("/ecourt/status-akun?segarkan=1");
    aktor = "usr-hakim";
    const b = await rute("aleta-ecourt/status-akun", "GET");
    expect(b.isi.data.ringkas.judul).toBe("Tersambung");
    expect(b.isi.data.akun).toEqual([]);
  });

  it("status-akun: bot mati -> MERAH 'Tidak tersambung', bukan hijau", async () => {
    tiruBot(() => ({ status: 502, json: { ok: false } }));
    const a = await rute("aleta-ecourt/status-akun", "GET");
    expect(a.isi.data).toMatchObject({ tersedia: false, ringkas: { keadaan: "tidak_tersambung", nada: "merah" } });
    expect(a.isi.data.ringkas.teks).toMatch(/ALETA Bot tidak menjawab/);
  });

  it("status-akun POST periksa: hanya Admin", async () => {
    tiruBot(jawabStatus("aktif"));
    aktor = "usr-hakim";
    expect((await rute("aleta-ecourt/status-akun", "POST", { badan: { tindakan: "periksa", slot: "utama" } })).status).toBe(403);
    aktor = "usr-super";
    const ok = await rute("aleta-ecourt/status-akun", "POST", { badan: { tindakan: "periksa", slot: "utama" } });
    expect(ok.status).toBe(200);
    expect(kiriman[0]).toMatchObject({ badan: { slot: "utama" } });
    expect(kiriman[0].url).toContain("/ecourt/status-akun/periksa");
  });

  it("simpan sandi akun pengadilan: hanya Admin; jawaban tanpa sandi", async () => {
    const SANDI = "SandiPortal#55";
    tiruBot(() => ({ json: { ok: true, alasan: "" } }));
    aktor = "usr-hakim";
    expect((await rute("aleta-ecourt/akun", "PUT", { badan: { slot: "utama", email: "pp@uji.test", sandi: SANDI } })).status).toBe(403);
    expect(kiriman).toHaveLength(0);
    aktor = "usr-super";
    const h = await rute("aleta-ecourt/akun", "PUT", { badan: { slot: "utama", email: "pp@uji.test", sandi: SANDI } });
    expect(JSON.stringify(h.isi)).not.toContain(SANDI);
    expect(kiriman[0].badan).toMatchObject({ slot: "utama", sandi: SANDI });
  });

  it("masuk e-Court: slot & 'simpan' diteruskan, pegawai biasa ditolak, sandi tidak kembali", async () => {
    const SANDI = "SandiMasuk#31";
    tiruBot((url) =>
      url.includes("/login/kirim")
        ? { json: { ok: true, alasan: "", kredensialTersimpan: true, statusAkun: statusContoh("aktif") } }
        : { json: { ok: true, alasan: "", captcha: "data:image/png;base64,AAAA", terisiOtomatis: true, emailTerisi: "pp@uji.test" } }
    );
    aktor = "usr-hakim";
    expect((await rute("aleta-bot/ecourt/login", "POST", { badan: { aksi: "mulai", slot: "utama" } })).status).toBe(403);
    aktor = "usr-super";
    const m = await rute("aleta-bot/ecourt/login", "POST", { badan: { aksi: "mulai", slot: "akun-2", isiOtomatis: false } });
    expect(kiriman[0].badan).toEqual({ slot: "akun-2", isiOtomatis: false });
    expect(m.isi.data).toMatchObject({ ok: true, terisiOtomatis: true });
    const k = await rute("aleta-bot/ecourt/login", "POST", {
      badan: { aksi: "kirim", slot: "akun-2", email: "pp@uji.test", sandi: SANDI, captcha: "12345", simpan: true },
    });
    expect(kiriman[1].badan).toMatchObject({ simpan: true, sandi: SANDI, captcha: "12345" });
    expect(String(kiriman[1].badan.olehSiapa)).toMatch(/^portal:/);
    expect(JSON.stringify(k.isi)).not.toContain(SANDI);
    expect((await rute("aleta-bot/ecourt/login", "POST", { badan: { aksi: "mulai", slot: "../etc" } })).isi.data).toMatchObject({ ok: false, alasan: "slot_tidak_sah" });
  });
});

// ===========================================================================
describe("5. penanda SINKRON: tiap keadaan tampil sama di semua penanda", () => {
  const EKS = path.join(AKAR, "ekstensi-sipp");
  const bacaEks = (b: string) => fs.readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n");
  /** Mengambil satu fungsi tingkat atas dari berkas ekstensi lalu menjalankannya di vm. */
  function fungsiEkstensi(berkas: string, nama: string) {
    const isi = bacaEks(berkas);
    const awal = isi.indexOf(`function ${nama}(`);
    expect(awal).toBeGreaterThan(-1);
    const akhir = isi.indexOf("\n}\n", awal);
    const ctx = vm.createContext({});
    vm.runInContext(`${isi.slice(awal, akhir + 2)}; globalThis.f = ${nama};`, ctx);
    return (ctx as { f: (...a: unknown[]) => unknown }).f;
  }
  const t4LampuEcourt = fungsiEkstensi("aleta.js", "t4LampuEcourt") as (e: unknown) => [string, string];
  const t7LampuEcourt = fungsiEkstensi("konten-panel-perkara.js", "t7LampuEcourt") as (k: unknown, u: unknown) => [string, string, string];

  // "memeriksa" sesaat tidak menimpa penilaian penarikan; keadaannya tetap tertulis di rincian.
  const WARNA_KESEHATAN: Record<KeadaanEcourt, string> = { aktif: "hijau", perlu_masuk: "kuning", tidak_tersambung: "merah", memeriksa: "hijau", belum_diatur: "kelabu" };

  for (const keadaan of DAFTAR_KEADAAN_ECOURT) {
    it(`keadaan "${keadaan}": judul & warna sama di portal, lampu ekstensi, panel perkara, popup, kesehatan`, () => {
      const st = statusContoh(keadaan);
      const t = tampilanStatus(st);
      expect(t.judul).toBe(JUDUL_KEADAAN[keadaan]);
      expect(t.lencana).toBe({ hijau: "success", kuning: "warning", merah: "danger", kelabu: "muted" }[t.nada]);
      expect(t.lampu).toBe({ hijau: "baik", kuning: "awas", merah: "buruk", kelabu: "netral" }[t.nada]);
      expect(t.teks).not.toMatch(/\b\d{4}\b/); // tanpa angka empat digit telanjang (tahun)

      // Lampu "e-Court" bagian Sambungan (ekstensi, aleta.js) - dari jawaban rute sambungan.
      const [lampu, ket] = t4LampuEcourt({ keadaan: keadaanSambunganLama(keadaan), sebab: "", status: t });
      expect(lampu).toBe(t.lampu);
      expect(ket).toContain(t.judul);
      // Ekstensi LAMA (tanpa `status`) tidak lagi melihat "hidup" untuk yang belum pasti.
      expect(keadaanSambunganLama(keadaan) === "hidup").toBe(keadaan === "aktif");

      // Lampu "e-Court" panel perkara (konten-panel-perkara.js).
      const [nama, kelas, ketPanel] = t7LampuEcourt({ konteks: { statusEcourt: t } }, { teks: "5 menit lalu", basi: false });
      expect(nama).toBe("e-Court");
      if (keadaan === "aktif") {
        expect(kelas).toBe("baik");
        expect(ketPanel).toMatch(/tersambung/);
      } else {
        expect(kelas).toBe(t.lampu);
        expect(ketPanel).toContain(t.judul);
      }

      // Baris Tarik data e-Court (popup) - diputuskan server.
      const r = ringkasTarikEcourt({
        pengaturan: { aktif: true, jarakJam: 2, jamMulai: 7, jamSelesai: 17, maksPerkara: 50 },
        sedangJalan: false,
        dalamJamKerja: true,
        terakhirKode: 2, // kode basi di memori bot - TIDAK boleh mengalahkan status
        statusUtama: st,
      });
      expect(r.sesi?.judul).toBe(t.judul);
      expect(r.keadaan).toBe(
        ({ perlu_masuk: "perhatian", tidak_tersambung: "terputus", belum_diatur: "belum-diatur", aktif: "aktif", memeriksa: "aktif" } as const)[keadaan]
      );
      if (keadaan !== "aktif") expect(r.keterangan).toContain(t.teks);

      // Kesehatan server.
      const k = periksaEcourt({ ok: true, data: { jadwal: { pengaturan: { aktif: true, jarakJam: 2 }, terakhirSelesai: new Date().toISOString(), statusUtama: st } } }, new Date());
      expect(k.warna).toBe(WARNA_KESEHATAN[keadaan]);
      expect(JSON.stringify(k.rincian)).toContain(t.judul);

      // Peringatan kartu Status penarikan.
      const p = peringatanPenarikan({
        dibaca: "",
        akunUtama: { slot: "utama", label: "Akun utama", dipilih: true, sah: true, bawaan: true, alasan: "", pesan: "" },
        penjadwal: { aktif: true, aktifTersimpan: true, selaluAktif: true, jarakJam: 2, jamMulai: 7, jamSelesai: 17, dalamJamKerja: true, sedangJalan: false, sumberBerjalan: "", perkaraBerjalan: "", akunBerjalan: "", berikutnya: null, zonaWaktu: "Asia/Makassar" },
        verifikasiHarian: null,
        terakhirBerkala: null,
        terakhirPerkara: null,
        riwayat: [],
        // `sesi` lama sengaja bertentangan: model yang menang.
        sesi: { berlaku: keadaan === "aktif" ? false : true, pada: "", sumber: "" },
        statusUtama: st,
      } as StatusPenarikan).join(" ");
      expect(/habis/.test(p)).toBe(keadaan === "perlu_masuk");
      expect(/tidak tersambung/.test(p)).toBe(keadaan === "tidak_tersambung");
      expect(sesiDariStatus(st).berlaku).toBe(keadaan === "aktif" ? true : keadaan === "perlu_masuk" ? false : null);
    });
  }

  it("popup ekstensi (JSDOM sungguhan): baris Tarik data berganti SERENTAK dengan status - perlu masuk -> masuk -> tersambung -> putus", async () => {
    const popupHtml = bacaEks("popup.html");
    const html = popupHtml.replace(/<script[\s\S]*?<\/script>/g, "");
    const dom = new JSDOM(html, { url: "chrome-extension://aleta/popup.html", runScripts: "outside-only" });
    const w = dom.window as any;
    let st = statusContoh("perlu_masuk");
    const ringkas = () =>
      ringkasTarikEcourt({ pengaturan: { aktif: true, jarakJam: 2, jamMulai: 7, jamSelesai: 17, maksPerkara: 50 }, sedangJalan: false, dalamJamKerja: true, terakhirKode: 2, statusUtama: st });
    const simpanan: Record<string, unknown> = { asalPortal: "http://192.168.10.10/aleta" };
    w.chrome = {
      runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.55", host_permissions: ["http://192.168.10.10/*"] }), sendMessage: async () => ({}) },
      storage: {
        local: {
          get: async (k?: string | string[] | null) => {
            const daftar = k == null ? Object.keys(simpanan) : [k].flat();
            return Object.fromEntries(daftar.filter((x) => x in simpanan).map((x) => [x, simpanan[x]]));
          },
          set: async (isi: Record<string, unknown>) => void Object.assign(simpanan, isi),
          remove: async () => undefined,
        },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener() {} },
      },
    };
    w.fetch = async (alamat: string) => {
      const a = String(alamat);
      if (a.includes("info=siapa")) return { ok: true, status: 200, json: async () => ({ ok: true, data: { pengguna: { nama: "Uji", peran: "Super Admin" }, versi: "1.205.55" } }) };
      if (a.includes("/ekstensi/tarik-ecourt")) return { ok: true, status: 200, json: async () => ({ ok: true, data: { tersedia: true, ringkas: ringkas() } }) };
      return { ok: true, status: 200, url: a, json: async () => ({}) };
    };
    const ctx = (dom as unknown as { getInternalVMContext: () => vm.Context }).getInternalVMContext();
    vm.runInContext(bacaEks("daftar-fitur.js"), ctx, { filename: "daftar-fitur.js" });
    vm.runInContext(bacaEks("popup.js"), ctx, { filename: "popup.js" });
    const d = w.document as Document;
    const bagian = () => d.getElementById("bagianTarikEcourt") as HTMLElement;
    const sampai = async (syarat: () => boolean, apa: string) => {
      const mulai = Date.now();
      while (!syarat()) {
        if (Date.now() - mulai > 3000) throw new Error(`tidak kunjung: ${apa}`);
        await new Promise((r) => setTimeout(r, 10));
      }
    };
    try {
      await sampai(() => bagian().getAttribute("data-keadaan") === "perhatian", "perlu masuk tergambar kuning");
      expect(d.getElementById("tarikEcourtStatus")!.textContent).toBe("Aktif, perlu masuk ulang");
      expect(d.getElementById("tarikEcourtKet")!.textContent).toContain(tampilanStatus(st).teks);
      // Gaya warna popup sesuai keadaan (kuning/merah/hijau).
      expect(popupHtml).toMatch(/\.tarik-ecourt\[data-keadaan="perhatian"\] \{ --tarik-warna: #d99a1e; \}/);
      expect(popupHtml).toMatch(/\.tarik-ecourt\[data-keadaan="terputus"\] \{ --tarik-warna: #d4483b; \}/);
      expect(popupHtml).toMatch(/\.tarik-ecourt\[data-keadaan="aktif"\] \{ --tarik-warna: #2e9d62; \}/);
    } finally {
      dom.window.close();
    }
    // Sesudah masuk: popup baru (dibuka lagi) langsung hijau walau kode 2 masih di memori bot.
    st = statusContoh("aktif");
    expect(ringkas()).toMatchObject({ keadaan: "aktif", label: "Aktif" });
    st = statusContoh("tidak_tersambung");
    expect(ringkas()).toMatchObject({ keadaan: "terputus", label: "Aktif, e-Court tidak tersambung" });
  });

  it("rute sambungan ekstensi: status ringkas dari model, BUKAN 'hidup' untuk yang belum pasti", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-hakim";
    try {
      for (const keadaan of DAFTAR_KEADAAN_ECOURT) {
        tiruBot((url) =>
          url.includes("/ecourt/status-akun") ? { json: { ok: true, utama: "utama", akun: [], ringkas: statusContoh(keadaan) } } : { json: { ok: true, status: "connected" } }
        );
        const r = await rute("aleta-ecourt/ekstensi-panel/sambungan", "GET");
        expect(r.isi.data.ecourt.status).toMatchObject({ keadaan, judul: JUDUL_KEADAAN[keadaan] });
        expect(r.isi.data.ecourt.keadaan).toBe(keadaanSambunganLama(keadaan));
        expect(kiriman.some((k) => k.url.includes("/ecourt/login/status"))).toBe(false);
      }
    } finally {
      vi.unstubAllGlobals();
      await db?.close();
      db = null;
    }
  });
});

// ===========================================================================
describe("6. kartu portal (React sungguhan): semua lencana di Integrasi e-Court beralih SERENTAK", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Masuk e-Court, Penarikan Berkala, Akun e-Court: keadaan & judul sama, berubah bersama sesudah masuk", async () => {
    const { render, waitFor, cleanup } = await import("@testing-library/react");
    const { createElement, Fragment } = await import("react");
    const { AletaBotEcourtLogin } = await import("@/components/portal/aleta-bot-ecourt-login");
    const { AletaEcourtJadwal } = await import("@/components/portal/aleta-ecourt-jadwal");
    const { AletaEcourtAkun } = await import("@/components/portal/aleta-ecourt-akun");
    const { kabarkanStatusEcourtBerubah } = await import("@/components/portal/ecourt-status-lencana");

    let keadaan: KeadaanEcourt = "perlu_masuk";
    const tampil = () => tampilanStatus(statusContoh(keadaan));
    vi.stubGlobal("fetch", async (alamat: string) => {
      const a = String(alamat);
      const jawab = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
      if (a.includes("/api/aleta-ecourt/status-akun")) return jawab({ tersedia: true, dibaca: "", utama: "utama", ringkas: tampil(), akun: [tampil()] });
      if (a.includes("/api/aleta-bot/ecourt/login")) return jawab({ available: true, sesi: { tersimpan: true, berlaku: null, alasan: "" }, keadaan: { namaPengguna: "Derry Uji" } });
      if (a.includes("/api/aleta-ecourt/jadwal"))
        // terakhirKode 2 = "sesi habis" BASI di memori bot - tidak boleh menang atas status.
        return jawab({
          available: true,
          jadwal: { pengaturan: { aktif: true, jarakJam: 2, jamMulai: 7, jamSelesai: 17, maksPerkara: 50 }, berjalan: true, sedangJalan: false, dalamJamKerja: true, terakhirMulai: null, terakhirSelesai: null, terakhirKode: 2, terakhirCatatan: "Sesi e-Court habis.", jumlahPutaran: 1 },
        });
      if (a.includes("/api/aleta-ecourt/akun?keadaan=1")) return jawab({ available: true, akun: [{ slot: "utama", keadaan: "kedaluwarsa", emailTersimpan: "pp@uji.test", isiOtomatis: true }] });
      if (a.includes("/api/aleta-ecourt/akun"))
        return jawab({
          available: true,
          akun: [{ slot: "utama", label: "Akun utama", aktif: true, adaSesi: true, istirahat: true, gagalTerakhir: null, alasanGagal: "sesi_habis", terakhirDipakai: true, utama: true }],
          akunUtama: { slot: "utama", label: "Akun utama", dipilih: true, sah: true, bawaan: true, alasan: "", pesan: "" },
        });
      return jawab({});
    });

    const r = render(createElement(Fragment, null, createElement(AletaBotEcourtLogin), createElement(AletaEcourtJadwal), createElement(AletaEcourtAkun)));
    const lencana = () => Array.from(r.container.querySelectorAll<HTMLElement>("[data-ecourt-keadaan]"));
    const periksaSemua = async (k: KeadaanEcourt) => {
      await waitFor(
        () => {
          const semua = lencana();
          // Kartu Masuk (lencana + kotak), Penarikan Berkala (lencana), tabel Akun (lencana).
          expect(semua.length).toBeGreaterThanOrEqual(4);
          for (const el of semua) expect(el.getAttribute("data-ecourt-keadaan")).toBe(k);
          // Istirahat akun (kode lama di memori) hanya tampil selama BELUM tersambung.
          expect(/dilewati sementara/i.test(r.container.textContent || "")).toBe(k !== "aktif");
        },
        { timeout: 4000 }
      );
      const teks = r.container.textContent || "";
      expect(teks).toContain(JUDUL_KEADAAN[k]);
      // Penanda lama yang menyimpang tidak muncul lagi.
      // (kalimat petunjuk kartu "masuk lagi saat sesi habis" bukan lencana)
      expect(teks).not.toMatch(/(?<!saat )Sesi habis|sesi kedaluwarsa|belum diperiksa|sesi berlaku/i);
    };
    try {
      await periksaSemua("perlu_masuk");
      expect(r.container.textContent).toContain("Masuk lagi");
      expect(r.container.textContent).toMatch(/cukup ketik captcha/);
      for (const k of ["aktif", "tidak_tersambung", "memeriksa", "belum_diatur", "aktif"] as KeadaanEcourt[]) {
        keadaan = k;
        kabarkanStatusEcourtBerubah();
        await periksaSemua(k);
      }
    } finally {
      cleanup();
    }
  });
});
