/**
 * Jadwal Sidang cepat (22 Okt 2026): tunda / putus / kehadiran di SIPP terlihat
 * dalam hitungan detik lewat bacaan RINGAN, dan baris berubah seketika sesudah
 * tombol Tunda/Putus ALETA. Lihat @/lib/jadwal-ringan.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BATAS_BASI_PENUH_MS,
  SELANG_RINGAN_HARI_INI_MS,
  SELANG_RINGAN_LAIN_MS,
  bacaJawabanRingan,
  gabungRingan,
  kalimatDiperbarui,
  terapkanHasilTulis,
} from "@/lib/jadwal-ringan";
import { buatPenyimpanDiperbarui, useJadwalRingan } from "@/components/portal/use-jadwal-ringan";

const require_ = createRequire(import.meta.url);
const bot = (berkas: string) => path.resolve(process.cwd(), "..", "aleta_bot", berkas);
const baca = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");

type Baris = {
  sidangId: string;
  perkaraId: string;
  ditunda: boolean;
  alasanDitunda: string;
  sudahPutus: boolean;
  tanggalPutusan: string;
  tanggalSidangBerikut: string;
  dihadiriOleh: number | null;
};
const HARI = "2026-10-22";
const baris = (id: string, s: Partial<Baris> = {}): Baris => ({
  sidangId: id,
  perkaraId: `p${id}`,
  ditunda: false,
  alasanDitunda: "",
  sudahPutus: false,
  tanggalPutusan: "",
  tanggalSidangBerikut: "",
  dihadiriOleh: null,
  ...s,
});
const jawab = (b: Array<Record<string, unknown>>, lain: Record<string, unknown> = {}) =>
  bacaJawabanRingan({ available: true, dari: HARI, sampai: HARI, baris: b, ...lain })!;

describe("gabungRingan: kolom yang berubah masuk ke baris", () => {
  it("tunda dan putus yang dibuat di SIPP tergabung; baris lain dan obyek lama tidak tersentuh", () => {
    const lama = [baris("1"), baris("2"), baris("3")];
    const g = gabungRingan(
      lama,
      jawab([
        { sidangId: "1", perkaraId: "p1", ditunda: true, alasanDitunda: "Para pihak tidak hadir", tanggalSidangBerikut: "2026-11-05" },
        { sidangId: "2", perkaraId: "p2", sudahPutus: true, tanggalPutusan: HARI, alasanDitunda: "putus kabul verstek" },
        { sidangId: "3", perkaraId: "p3" },
      ])
    );
    expect(g.berubah).toBe(true);
    expect(g.jumlahBerubah).toBe(2);
    expect(g.sidang[0]).toMatchObject({ ditunda: true, alasanDitunda: "Para pihak tidak hadir", tanggalSidangBerikut: "2026-11-05" });
    expect(g.sidang[1]).toMatchObject({ sudahPutus: true, tanggalPutusan: HARI, alasanDitunda: "putus kabul verstek" });
    expect(g.sidang[2]).toBe(lama[2]);
    expect(lama[0].ditunda).toBe(false); // tidak mengubah masukan
    expect(g.perluMuatPenuh).toBe("");
  });

  it("tidak ada yang berubah: daftar yang SAMA dipulangkan (layar tidak dilukis ulang)", () => {
    const lama = [baris("1", { dihadiriOleh: 1 })];
    const g = gabungRingan(lama, jawab([{ sidangId: "1", perkaraId: "p1", dihadiriOleh: 1, ditunda: false, alasanDitunda: "" }]));
    expect(g.berubah).toBe(false);
    expect(g.sidang).toBe(lama);
  });

  it("kelompok yang gagal dibaca bot tidak dikirim, jadi nilai lama dibiarkan (bukan dikosongkan)", () => {
    const lama = [baris("1", { sudahPutus: true, tanggalPutusan: HARI })];
    // bot tidak menyertakan kolom putusan karena kuerinya gagal
    const g = gabungRingan(lama, jawab([{ sidangId: "1", perkaraId: "p1", ditunda: false }], { terbaca: { putusan: false } }));
    expect(g.sidang).toBe(lama);
    expect(g.sidang[0].sudahPutus).toBe(true);
  });

  it("susunan berbeda (sidang baru / hilang) minta muat penuh dengan tanda tangan; kata cari dan batas terpotong tidak", () => {
    const lama = [baris("1"), baris("2")];
    const baru = jawab([{ sidangId: "1", perkaraId: "p1" }, { sidangId: "9", perkaraId: "p9" }]);
    expect(gabungRingan(lama, baru).perluMuatPenuh).toBe("-2|+9");
    // dengan kata cari: tambahan wajar, tetapi yang hilang tetap dihitung
    expect(gabungRingan(lama, baru, { adaPencarian: true }).perluMuatPenuh).toBe("-2|+");
    expect(gabungRingan(lama, jawab(baru.baris, { terpotong: true })).perluMuatPenuh).toBe("");
    const dua = jawab([{ sidangId: "1", perkaraId: "p1" }, { sidangId: "2", perkaraId: "p2" }, { sidangId: "3", perkaraId: "p3" }]);
    expect(gabungRingan(lama, dua, { adaPencarian: true }).perluMuatPenuh).toBe("");
  });

  it("bot tak terjangkau / bot lama / bentuk asing dibaca sebagai tidak ada bacaan", () => {
    expect(bacaJawabanRingan({ available: false, baris: [] })).toBeNull();
    expect(bacaJawabanRingan({ ok: false })).toBeNull();
    expect(bacaJawabanRingan({})).toBeNull();
  });
});

describe("terapkanHasilTulis: baris berubah dari jawaban penulisan", () => {
  it("tunda berhasil: ditunda, alasan, sidang berikutnya, kehadiran", () => {
    const lama = [baris("1"), baris("2")];
    const baru = terapkanHasilTulis(lama, "1", {
      jalan: "tunda",
      tertulis: true,
      dihadiriOleh: 2,
      alasanTunda: "Tergugat tidak hadir",
      sidangBerikutnya: { tanggal: "2026-11-12", jam: "09:00", agenda: "Panggil Tergugat" },
    });
    expect(baru[0]).toMatchObject({ ditunda: true, alasanDitunda: "Tergugat tidak hadir", tanggalSidangBerikut: "2026-11-12", dihadiriOleh: 2 });
    expect(baru[1]).toBe(lama[1]);
  });

  it("putus berhasil: sudahPutus, tanggal, status, verstek", () => {
    const baru = terapkanHasilTulis([baris("1")], "1", {
      jalan: "putus",
      tertulis: true,
      putusan: { tanggalPutus: "2026-10-22", status: "Dikabulkan", verstek: true },
    });
    expect(baru[0]).toMatchObject({ sudahPutus: true, tanggalPutusan: HARI, statusPutusan: "Dikabulkan", verstekPutusan: true });
  });

  it("diantrekan / kering (belum tertulis) atau baris tak ada: tidak mengubah apa pun", () => {
    const lama = [baris("1")];
    expect(terapkanHasilTulis(lama, "1", { jalan: "tunda", tertulis: false })).toBe(lama);
    expect(terapkanHasilTulis(lama, "99", { jalan: "putus", tertulis: true, putusan: { tanggalPutus: HARI } })).toBe(lama);
  });
});

describe("tanda diperbarui", () => {
  it("jujur: jam bacaan terakhir; lewat semenit disebut tertunda", () => {
    const t = new Date(2026, 9, 22, 14, 5, 33).getTime();
    expect(kalimatDiperbarui(null, t)).toEqual({ teks: "", tertunda: false });
    expect(kalimatDiperbarui(t, t + 10_000)).toEqual({ teks: "diperbarui 14:05:33", tertunda: false });
    expect(kalimatDiperbarui(t, t + 61_000)).toEqual({ teks: "diperbarui 14:05:33 (tertunda)", tertunda: true });
  });
});

describe("useJadwalRingan: selang, tab tersembunyi, penulisan di tengah bacaan", () => {
  let serverBaris: Array<Record<string, unknown>>;
  let panggilan: string[];
  let tampak: DocumentVisibilityState;
  let daftar: Baris[];
  let penyimpan: ReturnType<typeof buatPenyimpanDiperbarui>;
  let muatPenuh: ReturnType<typeof vi.fn>;
  let sibuk: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 22, 10, 0, 0));
    serverBaris = [{ sidangId: "1", perkaraId: "p1" }];
    panggilan = [];
    tampak = "visible";
    daftar = [baris("1")];
    penyimpan = buatPenyimpanDiperbarui();
    muatPenuh = vi.fn();
    sibuk = false;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => tampak });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (alamat: string) => {
        panggilan.push(String(alamat));
        const kirim = JSON.parse(JSON.stringify(serverBaris));
        await new Promise((r) => setTimeout(r, 30));
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { available: true, dari: HARI, sampai: HARI, baris: kirim, terbaca: {}, terpotong: false } }),
        } as unknown as Response;
      })
    );
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const pasang = (s: { hariIni?: boolean; aktif?: boolean } = {}) =>
    renderHook(() =>
      useJadwalRingan<Baris>({
        aktif: s.aktif ?? true,
        dari: HARI,
        sampai: HARI,
        hariIni: s.hariIni ?? true,
        adaPencarian: false,
        sidang: daftar,
        setSidang: (b) => {
          daftar = b;
        },
        sibuk: () => sibuk,
        muatPenuh,
        penyimpan,
      })
    );
  const maju = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it("tunda di SIPP tampil paling lama satu selang (8 dtk) + jawaban, dibanding 0-49 dtk jalur lama", async () => {
    expect(SELANG_RINGAN_HARI_INI_MS).toBe(8_000);
    const { unmount } = pasang();
    await maju(200); // bacaan pertama
    expect(daftar[0].ditunda).toBe(false);
    serverBaris = [{ sidangId: "1", perkaraId: "p1", ditunda: true, alasanDitunda: "Tergugat tidak hadir" }];
    let lewat = 0;
    while (!daftar[0].ditunda && lewat < 60_000) {
      await maju(50);
      lewat += 50;
    }
    expect(daftar[0]).toMatchObject({ ditunda: true, alasanDitunda: "Tergugat tidak hadir" });
    expect(lewat).toBeLessThanOrEqual(SELANG_RINGAN_HARI_INI_MS + 100);
    expect(penyimpan.ambil()).not.toBeNull();
    unmount();
  });

  it("selang 8 dtk hari ini, 30 dtk tanggal lain; tidak aktif = tidak bertanya", async () => {
    const a = pasang();
    await maju(24_000);
    expect(panggilan.length).toBe(4); // saat pasang + tiap 8 dtk
    expect(panggilan.every((x) => x.includes("/api/aleta-ecourt/sidang/ringan?dari=2026-10-22&sampai=2026-10-22"))).toBe(true);
    a.unmount();
    panggilan = [];
    const b = pasang({ hariIni: false });
    await maju(60_000);
    expect(panggilan.length).toBe(1 + Math.floor(60_000 / SELANG_RINGAN_LAIN_MS));
    b.unmount();
    panggilan = [];
    const c = pasang({ aktif: false });
    await maju(60_000);
    expect(panggilan).toEqual([]);
    c.unmount();
  });

  it("berhenti saat tab tersembunyi, langsung segar saat terlihat; jadwal lengkap basi dimuat sekali", async () => {
    penyimpan.catatPenuh(Date.now());
    const { unmount } = pasang();
    await maju(100);
    tampak = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    const sebelum = panggilan.length;
    await maju(120_000);
    expect(panggilan.length).toBe(sebelum);
    expect(muatPenuh).not.toHaveBeenCalled();

    tampak = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await maju(100);
    expect(panggilan.length).toBe(sebelum + 1);
    expect(120_000).toBeGreaterThan(BATAS_BASI_PENUH_MS);
    expect(muatPenuh).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("jadwal lengkap sedang dimuat: bacaan ringan tidak menimpa", async () => {
    sibuk = true;
    serverBaris = [{ sidangId: "1", perkaraId: "p1", ditunda: true }];
    const { unmount } = pasang();
    await maju(500);
    expect(daftar[0].ditunda).toBe(false);
    unmount();
  });

  it("susunan baris berubah: muat penuh SEKALI per perubahan, bukan tiap tanya", async () => {
    serverBaris = [{ sidangId: "1", perkaraId: "p1" }, { sidangId: "7", perkaraId: "p7" }];
    const { unmount } = pasang();
    await maju(40_000);
    expect(muatPenuh).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("segarkan() sesudah penulisan: bacaan yang terbang sebelum penulisan dibuang dan diulang", async () => {
    const { result, unmount } = pasang();
    await maju(10); // bacaan pertama terbang (dimulai sebelum penulisan; server belum berubah)
    serverBaris = [{ sidangId: "1", perkaraId: "p1", ditunda: true, alasanDitunda: "Sudah ditunda" }];
    let selesai = false;
    await act(async () => {
      void result.current.segarkan().then(() => {
        selesai = true;
      });
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(selesai).toBe(true);
    expect(daftar[0]).toMatchObject({ ditunda: true, alasanDitunda: "Sudah ditunda" });
    unmount();
  });
});

describe("bot: bacaan ringan memakai aturan bersama dan hanya SELECT berindeks", () => {
  it("kueri jadwal memakai sqlAlasanHasil, tanpa view v_pihak_perkara, tanpa relaas", () => {
    const { SQL_JADWAL } = require_(bot("services/jadwalRinganService.js")) as { SQL_JADWAL: string };
    const { sqlAlasanHasil } = require_(bot("services/hasilSidangKolom.js")) as { sqlAlasanHasil: (a: string) => string };
    expect(SQL_JADWAL.replace(/\s+/g, " ")).toContain(sqlAlasanHasil("j").replace(/\s+/g, " "));
    expect(SQL_JADWAL).toContain("j.tanggal_sidang BETWEEN ? AND ?");
    expect(SQL_JADWAL).not.toMatch(/v_pihak_perkara/i);
    expect(SQL_JADWAL).not.toMatch(/relaas/i);
    expect(SQL_JADWAL).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
    const sumber = readFileSync(bot("services/jadwalRinganService.js"), "utf8");
    expect(sumber).toContain('require("./hasilSidangKolom")');
    expect(sumber.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/v_pihak_perkara/);
  });

  it("jadwalRingan: satu kueri jadwal + tiga kueri IN untuk seluruh daftar; kelompok gagal tidak dikirim", async () => {
    const { jadwalRingan } = require_(bot("services/jadwalRinganService.js")) as {
      jadwalRingan: (p: object, d: object) => Promise<{ baris: Array<Record<string, unknown>>; terbaca: Record<string, boolean>; terpotong: boolean }>;
    };
    const kueri = vi.fn(async () => [
      { sidangId: 11, perkaraId: 1, tanggalSidang: HARI, jamSidang: "09:00:00", agenda: "Jawaban", ruangan: "R1", ditunda: "Y", ikrarTalak: "T", sidangKeliling: "T", urutanSidang: 1, dihadiriOleh: 2, adaBas: 0, alasanDitunda: "Tergugat tidak hadir" },
      { sidangId: 12, perkaraId: 2, tanggalSidang: HARI, jamSidang: "09:30:00", agenda: "Putusan", ruangan: "R1", ditunda: "T", ikrarTalak: "T", sidangKeliling: "T", urutanSidang: 2, dihadiriOleh: null, adaBas: 1, alasanDitunda: "putus kabul verstek" },
    ]);
    const putusanBanyakPerkara = vi.fn(async (ids: unknown[]) => {
      expect(ids).toEqual([1, 2]);
      return { "2": { tanggalPutusan: HARI, statusPutusan: "Dikabulkan", verstek: true } };
    });
    const sidangBerikutnya = vi.fn(async () => ({ "11": "2026-11-05" }));
    const ikrarBanyakPerkara = vi.fn(async () => {
      throw new Error("tabel tidak ada");
    });
    const h = await jadwalRingan({ dari: HARI, sampai: HARI }, { kueri, putusanBanyakPerkara, sidangBerikutnya, ikrarBanyakPerkara });
    expect(kueri).toHaveBeenCalledTimes(1);
    expect(putusanBanyakPerkara).toHaveBeenCalledTimes(1);
    expect(sidangBerikutnya).toHaveBeenCalledTimes(1);
    expect(h.terbaca).toEqual({ putusan: true, berikutnya: true, ikrar: false });
    expect(h.baris[0]).toMatchObject({ sidangId: "11", ditunda: true, alasanDitunda: "Tergugat tidak hadir", tanggalSidangBerikut: "2026-11-05", sudahPutus: false, jamSidang: "09:00" });
    expect(h.baris[1]).toMatchObject({ sidangId: "12", ditunda: false, alasanDitunda: "putus kabul verstek", sudahPutus: true, tanggalPutusan: HARI, verstekPutusan: true, adaBas: true });
    expect("ikrarTercatat" in h.baris[0]).toBe(false); // kelompok gagal tidak dikirim
    expect(h.terpotong).toBe(false);
  });

  it("rute bot dan portal terpasang; mode tautan mengizinkan bacaannya", () => {
    expect(readFileSync(bot("routes/jadwalSidangRoutes.js"), "utf8")).toContain('router.get("/ringan", wajibToken');
    const rute = baca("src/app/api/aleta-ecourt/sidang/ringan/route.ts");
    expect(rute).toContain('pastikanKapabilitas(db, actorUserId, "panel")');
    expect(rute).toContain("/ringan?");
    expect(baca("src/server/modules/tautan-jadwal/service.ts")).toContain('"aleta-ecourt/sidang/ringan": ["GET"]');
  });
});

describe("layar memakai jalur ringan tanpa mengubah jalur lengkap", () => {
  const layar = baca("src/components/portal/aleta-ecourt-sidang.tsx");
  it("jadwal lengkap tetap 45 dtk; hook ringan terpasang; tanda diperbarui di bawah tanggal", () => {
    expect(layar).toContain("const JEDA_MUAT_ULANG_MS = 45_000;");
    expect(layar).toContain("useJadwalRingan({");
    expect(layar).toContain("penyimpanDiperbarui.catatPenuh(Date.now());");
    expect(layar).toContain("<TandaDiperbarui penyimpan={penyimpanDiperbarui}");
  });
  it("tombol Tunda/Putus: baris diperbarui setempat, bacaan ringan, baru jadwal lengkap", () => {
    expect(layar).toContain("terapkanHasilTulis(lama, baris.sidangId, hasilTulis)");
    expect(layar).toContain("segarkanRingan().finally(() => void muatTanggal(dari, sampai, nilaiKesiapan))");
    const hasil = baca("src/components/portal/hasil-sidang.tsx");
    expect(hasil).toContain("onSelesai: (hasilTulis?: HasilTulisRingkas) => void;");
    expect(hasil).toContain("if (!isi.diantrekan) {\n          onSelesai({");
  });
});
