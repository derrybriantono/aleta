// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * PEMBARUAN YANG SUDAH DIUNDUH CHROME TIDAK BOLEH TERLUPA SAAT PEKERJA MATI
 * ============================================================================
 *
 * Uji rilis U2 (9 Okt 2026). chrome.runtime.onUpdateAvailable berbunyi SEKALI,
 * ketika Chrome selesai mengunduh CRX yang lebih baru. Sampai 1.188.0 versinya
 * hanya diingat di variabel modul `versiMenunggu`. Pekerja MV3 mati tiap ±30
 * detik menganggur (lihat memori pekerja-latar-mv3-tidak-mengingat), jadi
 * tombol "Perbarui sekarang" yang ditekan semenit kemudian bertanya ulang ke
 * Chrome - dan bila Chrome menjawab "throttled" (baru saja diperiksa),
 * petugas diberi tahu "coba lagi beberapa menit lagi" padahal versi barunya
 * SUDAH di disk dan tinggal dipasang. "keadaan-pembaruan" juga melaporkan
 * tidak ada yang menunggu.
 *
 * Di sini latar.js dinyalakan DUA KALI di atas chrome.storage.session yang
 * sama - persis Chrome yang membangunkan pekerja baru tanpa ingatan.
 */

const AKAR = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const sumberLatar = readFileSync(path.join(AKAR, "latar.js"), "utf8");

type Jawaban = Record<string, unknown> | undefined;

function buatDunia() {
  return { sesi: {} as Record<string, unknown>, lokal: {} as Record<string, unknown>, reload: 0 };
}

function nyalakan(dunia: ReturnType<typeof buatDunia>, opsi: { periksa: { status: string; version?: string }; versi?: string }) {
  let pendengarPesan: ((p: unknown, k: unknown, j: (x: unknown) => void) => unknown) | null = null;
  let pendengarPembaruan: ((r: { version: string }) => void) | null = null;
  const gudang = (isi: Record<string, unknown>) => ({
    get: async (k?: string | string[] | null) => {
      if (k === null || k === undefined) return structuredClone(isi);
      const kunci = Array.isArray(k) ? k : [k];
      return Object.fromEntries(kunci.filter((x) => x in isi).map((x) => [x, structuredClone(isi[x])]));
    },
    set: async (o: Record<string, unknown>) => {
      Object.assign(isi, structuredClone(o));
    },
    remove: async (k: string | string[]) => {
      for (const x of Array.isArray(k) ? k : [k]) delete isi[x];
    },
  });
  const chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: opsi.versi ?? "1.188.0" }),
      reload: () => {
        dunia.reload += 1;
      },
      requestUpdateCheck: async () => structuredClone(opsi.periksa),
      onUpdateAvailable: { addListener: (f: (r: { version: string }) => void) => (pendengarPembaruan = f) },
      onMessage: { addListener: (f: (p: unknown, k: unknown, j: (x: unknown) => void) => unknown) => (pendengarPesan = f) },
    },
    storage: {
      session: gudang(dunia.sesi),
      local: gudang(dunia.lokal),
      onChanged: { addListener: () => {} },
    },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    downloads: {
      onDeterminingFilename: { addListener: () => {} },
      onChanged: { addListener: () => {}, removeListener: () => {} },
      search: (_q: unknown, f: (x: unknown[]) => void) => f([]),
    },
  };
  const konteks: Record<string, unknown> = {
    chrome,
    // Dibaca saat dipanggil, supaya vi.useFakeTimers sesudah pekerja menyala tetap berlaku.
    setTimeout: (f: () => void, ms?: number) => globalThis.setTimeout(f, ms),
    clearTimeout: (t: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(t),
    console,
    URL,
    TextEncoder,
    TextDecoder,
    fetch: async () => {
      throw new Error("tidak ada jaringan di uji ini");
    },
  };
  konteks.self = konteks;
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(sumberLatar, konteks, { filename: "latar.js" });

  const kirim = (pesan: unknown) =>
    new Promise<Jawaban>((selesai) => {
      let sudah = false;
      const hasil = pendengarPesan?.(pesan, { id: "aleta-uji", frameId: 0, url: "http://192.168.10.10/SIPP/" }, (x) => {
        sudah = true;
        selesai(x as Jawaban);
      });
      if (hasil === undefined && !sudah) selesai(undefined);
    });
  return { kirim, umumkan: (v: string) => pendengarPembaruan?.({ version: v }) };
}

async function tunggu() {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setImmediate(r));
}

describe("versi yang sudah diunduh Chrome selamat dari matinya pekerja latar", () => {
  it("pekerja baru tetap memasangnya walau Chrome menjawab throttled", async () => {
    const dunia = buatDunia();
    const pertama = nyalakan(dunia, { periksa: { status: "throttled" } });
    pertama.umumkan("1.189.0");
    await tunggu();

    // Pekerja pertama mati (±30 detik menganggur); Chrome membangunkan yang baru.
    const kedua = nyalakan(dunia, { periksa: { status: "throttled" } });
    vi.useFakeTimers();
    try {
      const jawab = await kedua.kirim({ sumber: "aleta-panel", jenis: "perbarui" });
      expect(jawab?.keadaan).toBe("dipasang");
      expect(jawab?.versiBaru).toBe("1.189.0");
      vi.advanceTimersByTime(500);
      expect(dunia.reload).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keadaan-pembaruan pekerja baru tetap menyebut versi yang menunggu", async () => {
    const dunia = buatDunia();
    nyalakan(dunia, { periksa: { status: "no_update" } }).umumkan("1.189.0");
    await tunggu();
    const kedua = nyalakan(dunia, { periksa: { status: "no_update" } });
    const jawab = await kedua.kirim({ sumber: "aleta-panel", jenis: "keadaan-pembaruan" });
    expect(jawab?.versiMenunggu).toBe("1.189.0");
  });

  it("ingatan yang sama dengan versi terpasang (pembaruan sudah berlaku) diabaikan", async () => {
    const dunia = buatDunia();
    nyalakan(dunia, { periksa: { status: "no_update" }, versi: "1.188.0" }).umumkan("1.189.0");
    await tunggu();
    // Sesudah pembaruan terpasang, versi manifest = versi yang tadinya menunggu.
    const sesudah = nyalakan(dunia, { periksa: { status: "no_update" }, versi: "1.189.0" });
    vi.useFakeTimers();
    try {
      const jawab = await sesudah.kirim({ sumber: "aleta-panel", jenis: "perbarui" });
      expect(jawab?.keadaan).toBe("tidak_ada_pembaruan");
      vi.advanceTimersByTime(500);
      expect(dunia.reload).toBe(0);
      const k = await sesudah.kirim({ sumber: "aleta-panel", jenis: "keadaan-pembaruan" });
      expect(k?.versiMenunggu).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("pekerja yang sama tetap menjawab dari ingatannya (jalan lama utuh)", async () => {
    // Chrome tanpa storage sama sekali dijaga ekstensi-perbarui-sekali-klik.
    const dunia = buatDunia();
    const p = nyalakan(dunia, { periksa: { status: "no_update" } });
    p.umumkan("1.190.0");
    const jawab = await p.kirim({ sumber: "aleta-panel", jenis: "keadaan-pembaruan" });
    expect(jawab?.versiMenunggu).toBe("1.190.0");
  });
});
