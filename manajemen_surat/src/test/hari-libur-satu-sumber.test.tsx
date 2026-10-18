import { fireEvent, render, screen } from "@testing-library/react";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PemilihTanggalSidang } from "@/components/ui/pemilih-tanggal-sidang";
import { tanggalSidangBerikut } from "@/lib/bawaan-tunda";
import { CC_LIBUR, CC_LIBUR_TAHUN_LENGKAP, ccPeriksaBaris } from "@/lib/court-calendar-susun";
import {
  SKB_LIBUR,
  bersihkanTambahan,
  daftarSkb,
  geserUsulanKeHariKerja,
  hariLibur,
  pasangTambahanLibur,
  petaSingkat,
  sebabLibur,
  tolakTanggalLibur,
} from "@/lib/hari-libur";
import { periksaLiburPenetapan } from "@/server/modules/hari-libur/penjaga";

/**
 * ============================================================================
 * HARI LIBUR - SATU SUMBER, DAN TANGGAL LIBUR TIDAK DAPAT DIPILIH (18 Okt 2026)
 * ============================================================================
 *
 * Daftar SKB di @/lib/hari-libur adalah dasarnya. Bot (konteks build lain) dan
 * ekstensi (tanpa impor) memuat salinan; uji ini menuntut isinya SAMA PERSIS,
 * lalu menguji perilakunya: Sabtu/Minggu, libur nasional, cuti bersama, dan
 * libur tambahan Pengaturan ditolak; usulan otomatis bergeser dengan
 * pemberitahuan.
 */

const AKAR = path.resolve(process.cwd(), "..");
const KONTEN = readFileSync(path.join(AKAR, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");
const muatBot = () => {
  const req = createRequire(import.meta.url);
  const berkas = path.join(AKAR, "aleta_bot/services/hariLiburService.js");
  delete req.cache[req.resolve(berkas)];
  return req(berkas) as {
    TAHUN: Record<string, { libur: Array<[string, string]> }>;
    hariLibur: (t: string) => { nama: string } | null;
    pasangTambahan: (d: unknown[]) => number;
  };
};

afterEach(() => {
  pasangTambahanLibur([]);
  vi.unstubAllGlobals();
});

describe("satu sumber: portal = bot = ekstensi", () => {
  it("bot hariLiburService memuat tanggal dan nama SKB yang sama, tahun demi tahun", () => {
    const bot = muatBot();
    expect(Object.keys(bot.TAHUN).sort()).toEqual(Object.keys(SKB_LIBUR).sort());
    for (const th of Object.keys(SKB_LIBUR)) {
      const portal = SKB_LIBUR[th].libur.map(([t, n]) => [t, n]);
      const salinan = [...bot.TAHUN[th].libur].map(([t, n]) => [t, n]);
      expect(salinan, `tahun ${th}`).toEqual(portal);
    }
  });

  it("konten.js CC_LIBUR sama persis dengan @/lib/hari-libur (dan court-calendar-susun)", () => {
    const awal = KONTEN.indexOf("const CC_LIBUR = {");
    const akhir = KONTEN.indexOf("\n", KONTEN.indexOf("const CC_LIBUR_TAHUN_LENGKAP"));
    const ctx = vm.createContext({});
    vm.runInContext(`${KONTEN.slice(awal, akhir)}\nglobalThis.__l = { CC_LIBUR, CC_LIBUR_TAHUN_LENGKAP };`, ctx);
    const ek = (ctx as { __l: { CC_LIBUR: Record<string, string>; CC_LIBUR_TAHUN_LENGKAP: string[] } }).__l;
    expect(JSON.parse(JSON.stringify(ek.CC_LIBUR))).toEqual(petaSingkat(2024));
    expect(CC_LIBUR).toEqual(petaSingkat(2024));
    expect([...ek.CC_LIBUR_TAHUN_LENGKAP]).toEqual([...CC_LIBUR_TAHUN_LENGKAP]);
    expect([...CC_LIBUR_TAHUN_LENGKAP]).toEqual(["2026", "2027"]);
  });

  it("2026 = SKB 1497/2/5 Tahun 2025 (25 tanggal); 2027 = SKB 1205/3/2 Tahun 2026 (26 tanggal)", () => {
    expect(SKB_LIBUR["2026"].libur).toHaveLength(25);
    expect(SKB_LIBUR["2027"].libur).toHaveLength(26);
    expect(SKB_LIBUR["2027"].libur.filter((x) => x[3] === "cuti-bersama")).toHaveLength(8);
    expect(daftarSkb().every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.tanggal))).toBe(true);
  });
});

describe("tanggal libur ditolak", () => {
  it("Sabtu dan Minggu ditolak", () => {
    expect(sebabLibur("2026-10-24")?.jenis).toBe("sabtu");
    expect(sebabLibur("2026-10-25")?.jenis).toBe("minggu");
    expect(tolakTanggalLibur("2026-10-24")).toMatch(/Sabtu, 24 Oktober 2026 jatuh pada hari libur/);
    expect(hariLibur("2026-10-26")).toBe(false);
  });

  it("libur nasional ditolak (17 Agustus 2026)", () => {
    expect(sebabLibur("2026-08-17")).toMatchObject({ jenis: "nasional", nama: "Proklamasi Kemerdekaan" });
    expect(tolakTanggalLibur("2026-08-17")).toMatch(/hari libur \(Proklamasi Kemerdekaan\)/);
  });

  it("cuti bersama ditolak (Senin 23 Maret 2026, Senin 15 Maret 2027)", () => {
    expect(sebabLibur("2026-03-23")?.jenis).toBe("cuti-bersama");
    expect(sebabLibur("2027-03-15")?.nama).toBe("Cuti Bersama Idulfitri 1448 Hijriah");
  });

  it("libur tambahan dari Pengaturan berlaku - dan tanggal SKB yang dibatalkan tidak lagi libur", () => {
    expect(hariLibur("2026-10-20")).toBe(false);
    pasangTambahanLibur(
      bersihkanTambahan([
        { tanggal: "2026-10-20", nama: "HUT Kabupaten Donggala", jenis: "daerah", aksi: "tambah" },
        { tanggal: "2026-12-24", nama: "Cuti Bersama Natal", aksi: "hapus" },
      ])
    );
    expect(sebabLibur("2026-10-20")).toMatchObject({ jenis: "daerah", nama: "HUT Kabupaten Donggala" });
    expect(hariLibur("2026-12-24")).toBe(false);
    expect(() => bersihkanTambahan([{ tanggal: "2026-02-30", nama: "x" }])).toThrow(/tidak sah/);
    expect(() => bersihkanTambahan([{ tanggal: "2026-10-20", nama: "" }])).toThrow(/belum diisi/);
  });

  it("bot: tambahan Pengaturan berlaku dan tersimpan di folder datanya", () => {
    const tmp = mkdtempSync(path.join(process.env.TMP || os.tmpdir(), "libur-"));
    const semula = process.env.ALETA_BOT_DATA_DIR;
    process.env.ALETA_BOT_DATA_DIR = tmp;
    try {
      const bot = muatBot();
      expect(bot.hariLibur("2026-10-20")).toBeNull();
      expect(bot.pasangTambahan([{ tanggal: "2026-10-20", nama: "HUT Kabupaten Donggala", aksi: "tambah" }, { tanggal: "2026-08-17", aksi: "hapus" }])).toBe(2);
      expect(bot.hariLibur("2026-10-20")?.nama).toBe("HUT Kabupaten Donggala");
      expect(bot.hariLibur("2026-08-17")).toBeNull();
      // Dimulai ulang: dibaca kembali dari berkasnya.
      const lagi = muatBot();
      expect(lagi.hariLibur("2026-10-20")?.nama).toBe("HUT Kabupaten Donggala");
    } finally {
      process.env.ALETA_BOT_DATA_DIR = semula;
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("Court Calendar: baris bertanggal libur nasional tidak dikirim", () => {
    expect(ccPeriksaBaris({ agenda: "Pembuktian", tanggal: "2026-12-24", jam: "09:00" }, "2026-09-01")).toMatch(/tanggal libur tidak dikirim/);
    expect(ccPeriksaBaris({ agenda: "Pembuktian", tanggal: "2026-12-23", jam: "09:00" }, "2026-09-01")).toBe("");
  });

  it("rute penetapan: PHS dan tanggal penetapan pada libur nasional ditolak dengan kode yang dikenal panel", async () => {
    const db = { queryOne: async () => null } as never;
    expect(await periksaLiburPenetapan(db, "2026-10-19", [{ jenis: "phs", tanggalSidang: "2026-12-25" }])).toMatchObject({
      alasan: "tanggal_sidang_hari_libur",
      diminta: "2026-12-25",
    });
    expect(await periksaLiburPenetapan(db, "2026-08-17", [{ jenis: "pmh" }])).toMatchObject({ alasan: "tanggal_penetapan_hari_libur" });
    expect(await periksaLiburPenetapan(db, "2026-10-19", [{ jenis: "phs", tanggalSidang: "2026-10-28" }])).toBeNull();
  });
});

describe("usulan otomatis bergeser ke hari kerja, dengan pemberitahuan", () => {
  it("cuti bersama Nyepi Rabu 18 Maret 2026 -> Rabu 25 Maret (melewati Nyepi, Idul Fitri, dan cuti bersamanya)", () => {
    const g = geserUsulanKeHariKerja("2026-03-18");
    expect(g).toMatchObject({ tanggal: "2026-03-25", bergeser: true });
    expect(g.pemberitahuan).toMatch(/Rabu, 18 Maret 2026 hari libur \(Cuti Bersama Hari Suci Nyepi\) - usulan digeser ke Rabu, 25 Maret 2026/);
  });

  it("tunda dua pekan yang jatuh pada Natal bergeser ke Senin dan penjelasannya menyebutnya", () => {
    const t = tanggalSidangBerikut({ tanggalSidang: "2026-12-11" });
    expect(t.tanggal).toBe("2026-12-28");
    expect(t.bergeserDari).toBe("2026-12-25");
    expect(t.penjelasan).toMatch(/digeser ke Senin, 28 Desember 2026/);
  });

  it("tunda ikrar talak (+14 hari) juga bergeser", () => {
    const t = tanggalSidangBerikut({ tanggalSidang: "2026-12-11", ikrar: true });
    expect(t.tanggal).toBe("2026-12-28");
  });

  it("usulan pada hari kerja tidak disentuh", () => {
    const t = tanggalSidangBerikut({ tanggalSidang: "2026-10-14" });
    expect(t.tanggal).toBe("2026-10-28");
    expect(t.bergeserDari).toBeUndefined();
  });

  it("libur tambahan Pengaturan ikut menggeser usulan", () => {
    pasangTambahanLibur([{ tanggal: "2026-10-28", nama: "HUT Kabupaten Donggala", jenis: "daerah", aksi: "tambah" }]);
    expect(tanggalSidangBerikut({ tanggalSidang: "2026-10-14" }).tanggal).toBe("2026-10-29");
  });
});

describe("ekstensi: hari sidang PHS pada hari libur ditahan", () => {
  function mesin() {
    const potong = (nama: string) => {
      const awal = KONTEN.indexOf(`\nfunction ${nama}(`);
      if (awal < 0) throw new Error(nama);
      return KONTEN.slice(awal, KONTEN.indexOf("\n}\n", awal) + 3);
    };
    const awalLibur = KONTEN.indexOf("const CC_LIBUR = {");
    const akhirLibur = KONTEN.indexOf("\n", KONTEN.indexOf("const CC_LIBUR_TAHUN_LENGKAP"));
    const sumber = [
      KONTEN.slice(awalLibur, akhirLibur),
      "const NAMA_HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];",
      ...["ccIsoSah", "ccTambahHari", "ccHariKe", "ccBukanHariKerja", "ccTerapkanLiburTambahan", "hariAkhirPekan", "sebutTanggal", "peringatanLiburPhs", "masalahTanggalSidang"].map(potong),
      "globalThis.__e = { masalahTanggalSidang, ccTerapkanLiburTambahan, peringatanLiburPhs };",
    ].join("\n");
    const ctx = vm.createContext({});
    vm.runInContext(sumber, ctx);
    return (ctx as { __e: Record<string, (...a: unknown[]) => string> }).__e;
  }
  const usulan = (phs: string) => ({ tanggalPenetapan: "2026-12-01", perkara: { jenisPerkaraId: 347 }, phs: { usulan: phs } });

  it("pilihan tangan pada Natal ditolak; Sabtu tetap ditolak seperti dulu", () => {
    const e = mesin();
    expect(e.masalahTanggalSidang(usulan("2026-12-09"), { phs: "2026-12-25" })).toMatch(/libur Natal/);
    expect(e.masalahTanggalSidang(usulan("2026-12-09"), { phs: "2026-12-26" })).toMatch(/Sabtu/);
    expect(e.masalahTanggalSidang(usulan("2026-12-09"), { phs: "2026-12-23" })).toBe("");
  });

  it("usulan mesin yang jatuh pada libur tambahan Pengaturan ditahan dengan sebabnya", () => {
    const e = mesin();
    expect(e.masalahTanggalSidang(usulan("2026-12-09"), {})).toBe("");
    e.ccTerapkanLiburTambahan([{ tanggal: "2026-12-09", nama: "HUT Kabupaten Donggala", aksi: "tambah" }]);
    expect(e.masalahTanggalSidang(usulan("2026-12-09"), {})).toMatch(/Usulan hari sidang .*libur HUT Kabupaten Donggala/);
  });
});

describe("pemilih tanggal sidang di portal", () => {
  function Contoh({ awal, catat }: { awal: string; catat: (v: string) => void }) {
    const [nilai, setNilai] = useState(awal);
    return createElement(PemilihTanggalSidang, {
      value: nilai,
      "aria-label": "Tanggal sidang berikutnya",
      onChange: (v: string) => {
        catat(v);
        setNilai(v);
      },
    });
  }

  it("mengetik tanggal libur ditolak: nilai lama tetap, sebabnya tampil; hari kerja diterima", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null })));
    const catat = vi.fn();
    render(createElement(Contoh, { awal: "2026-12-23", catat }));
    const kotak = screen.getByLabelText("Tanggal sidang berikutnya") as HTMLInputElement;
    fireEvent.change(kotak, { target: { value: "2026-12-25" } });
    expect(catat).not.toHaveBeenCalled();
    expect(kotak.value).toBe("2026-12-23");
    expect(screen.getByRole("alert").textContent).toMatch(/Jumat, 25 Desember 2026 jatuh pada hari libur \(Kelahiran Yesus Kristus\)/);
    fireEvent.change(kotak, { target: { value: "2026-12-28" } });
    expect(catat).toHaveBeenCalledWith("2026-12-28");
  });

  it("kalender: hari libur bergaris, bernama, dan tidak dapat ditekan", () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => null })));
    const catat = vi.fn();
    render(createElement(Contoh, { awal: "2026-12-23", catat }));
    fireEvent.click(screen.getByRole("button", { name: /Buka kalender/ }));
    const natal = screen.getByRole("button", { name: /Jumat, 25 Desember 2026, hari libur Kelahiran Yesus Kristus, tidak dapat dipilih/ }) as HTMLButtonElement;
    expect(natal.disabled).toBe(true);
    expect(natal.getAttribute("data-libur")).toBe("ya");
    const sabtu = screen.getByRole("button", { name: /Sabtu, 26 Desember 2026, hari libur/ }) as HTMLButtonElement;
    expect(sabtu.disabled).toBe(true);
    expect(screen.getByRole("dialog").textContent).toContain("Cuti Bersama Kelahiran Yesus Kristus");
    fireEvent.click(screen.getByRole("button", { name: "Senin, 28 Desember 2026" }));
    expect(catat).toHaveBeenCalledWith("2026-12-28");
  });
});
