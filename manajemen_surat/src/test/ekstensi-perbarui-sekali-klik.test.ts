// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 * MEMASANG PEMBARUAN SEKALI KLIK
 * ============================================================================
 *
 * latar.js dijalankan SUNGGUHAN di sini, di atas chrome tiruan. Yang diuji
 * bukan kalimat di dalam kodenya melainkan perilakunya pada tiap jawaban yang
 * mungkin diberikan Chrome - dan tiap jawaban itu berarti hal yang berbeda:
 *
 *   update_available  CRX lebih baru ada; Chrome mengunduh, lalu reload
 *                     memberlakukannya. Inilah pemasangan sekali klik.
 *   no_update         Tidak ada yang lebih baru - ATAU ekstensinya dimuat
 *                     sebagai folder, dan Chrome mengabaikan update_url di
 *                     sana. Keduanya harus dibedakan bagi yang membacanya.
 *   throttled         Chrome menahan karena baru saja diperiksa.
 *   melempar          Pemasangan yang tidak melayani pemeriksaan sama sekali.
 *
 * Yang paling penting dijaga: reload() TIDAK pernah dipanggil ketika Chrome
 * tidak memasang apa pun. Memuat ulang ekstensi tanpa sebab membuang panel
 * yang sedang dipakai petugas mengisi borang penetapan.
 */

const AKAR = path.resolve(process.cwd(), "..", "ekstensi-sipp");
const sumberLatar = readFileSync(path.join(AKAR, "latar.js"), "utf8");

type Jawaban = { status?: string; version?: string };

/** Menjalankan latar.js dengan chrome tiruan, lalu memulangkan kendalinya. */
function pasangLatar(opsi: {
  versi?: string;
  jawabanPeriksa?: Jawaban | null;
  lemparPeriksa?: string;
}) {
  const dicatat = { reload: 0 };
  let pendengarPesan: ((p: unknown, k: unknown, j: (x: unknown) => void) => unknown) | null = null;
  let pendengarPembaruan: ((r: { version: string }) => void) | null = null;

  const chrome = {
    runtime: {
      getManifest: () => ({ version: opsi.versi ?? "1.102.0" }),
      reload: () => {
        dicatat.reload += 1;
      },
      requestUpdateCheck: async () => {
        if (opsi.lemparPeriksa) throw new Error(opsi.lemparPeriksa);
        return opsi.jawabanPeriksa ?? { status: "no_update" };
      },
      onUpdateAvailable: {
        addListener: (f: (r: { version: string }) => void) => {
          pendengarPembaruan = f;
        },
      },
      onMessage: {
        addListener: (f: (p: unknown, k: unknown, j: (x: unknown) => void) => unknown) => {
          pendengarPesan = f;
        },
      },
    },
  };

  const konteks: Record<string, unknown> = { chrome, setTimeout, console };
  konteks.self = konteks;
  vm.createContext(konteks);
  vm.runInContext(sumberLatar, konteks, { filename: "latar.js" });

  /** Mengirim satu pesan dan menunggu jawabannya. */
  const kirim = (pesan: unknown) =>
    new Promise<Record<string, unknown> | undefined>((selesai) => {
      let sudah = false;
      const hasil = pendengarPesan?.(pesan, {}, (x) => {
        sudah = true;
        selesai(x as Record<string, unknown>);
      });
      // Penanganan yang memulangkan undefined berarti pesannya diabaikan.
      if (hasil === undefined && !sudah) selesai(undefined);
    });

  return { kirim, dicatat, umumkanPembaruan: (versi: string) => pendengarPembaruan?.({ version: versi }) };
}

describe("Chrome menemukan versi yang lebih baru", () => {
  it("dipasang, dan ekstensi dimuat ulang untuk memberlakukannya", async () => {
    vi.useFakeTimers();
    try {
      const { kirim, dicatat } = pasangLatar({
        jawabanPeriksa: { status: "update_available", version: "1.103.0" },
      });

      const jawab = await kirim({ sumber: "aleta-panel", jenis: "perbarui" });
      expect(jawab?.ok).toBe(true);
      expect(jawab?.keadaan).toBe("dipasang");
      expect(jawab?.versiBaru).toBe("1.103.0");

      // Jawabannya harus sampai LEBIH DAHULU. Memuat ulang seketika membunuh
      // konteksnya sebelum panel sempat membaca apa pun.
      expect(dicatat.reload).toBe(0);
      vi.advanceTimersByTime(500);
      expect(dicatat.reload).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pembaruan yang sudah diunduh Chrome dipasang tanpa bertanya lagi", async () => {
    vi.useFakeTimers();
    try {
      // Chrome mengumumkannya sendiri lewat onUpdateAvailable. Bertanya ulang
      // ke portal hanya menambah perjalanan yang jawabannya sudah diketahui.
      const { kirim, dicatat, umumkanPembaruan } = pasangLatar({ jawabanPeriksa: { status: "no_update" } });
      umumkanPembaruan("1.104.0");

      const jawab = await kirim({ sumber: "aleta-panel", jenis: "perbarui" });
      expect(jawab?.keadaan).toBe("dipasang");
      expect(jawab?.versiBaru).toBe("1.104.0");
      vi.advanceTimersByTime(500);
      expect(dicatat.reload).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Chrome tidak memasang apa pun", () => {
  it("no_update TIDAK memuat ulang ekstensi", async () => {
    vi.useFakeTimers();
    try {
      const { kirim, dicatat } = pasangLatar({ jawabanPeriksa: { status: "no_update" } });
      const jawab = await kirim({ sumber: "aleta-panel", jenis: "perbarui" });

      expect(jawab?.ok).toBe(false);
      expect(jawab?.keadaan).toBe("tidak_ada_pembaruan");
      // Inilah yang paling menentukan: panel yang sedang dipakai mengisi
      // borang penetapan tidak boleh lenyap tanpa ada yang dipasang.
      vi.advanceTimersByTime(5000);
      expect(dicatat.reload).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("no_update menyebutkan kemungkinan pemasangan folder, bukan diam", async () => {
    const { kirim } = pasangLatar({ jawabanPeriksa: { status: "no_update" } });
    const jawab = await kirim({ sumber: "aleta-panel", jenis: "perbarui" });
    // Tanpa kalimat ini, petugas yang melihat portal menawarkan versi lebih
    // baru sementara Chrome berkata "tidak ada pembaruan" akan menyimpulkan
    // ekstensinya rusak.
    expect(String(jawab?.pesan)).toContain("folder");
  });

  it("throttled dikatakan apa adanya", async () => {
    vi.useFakeTimers();
    try {
      const { kirim, dicatat } = pasangLatar({ jawabanPeriksa: { status: "throttled" } });
      const jawab = await kirim({ sumber: "aleta-panel", jenis: "perbarui" });
      expect(jawab?.keadaan).toBe("ditahan");
      expect(String(jawab?.pesan)).toContain("menahan");
      vi.advanceTimersByTime(5000);
      expect(dicatat.reload).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("permintaan yang ditolak Chrome tidak menjadi galat yang tidak tertangkap", async () => {
    vi.useFakeTimers();
    try {
      const { kirim, dicatat } = pasangLatar({ lemparPeriksa: "not allowed for unpacked" });
      const jawab = await kirim({ sumber: "aleta-panel", jenis: "perbarui" });
      expect(jawab?.ok).toBe(false);
      expect(jawab?.keadaan).toBe("tidak_didukung");
      expect(String(jawab?.pesan)).toContain("Load unpacked");
      vi.advanceTimersByTime(5000);
      expect(dicatat.reload).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("muat ulang yang diminta sendiri", () => {
  it("memuat ulang ekstensi, dan jawabannya sampai lebih dahulu", async () => {
    vi.useFakeTimers();
    try {
      const { kirim, dicatat } = pasangLatar({});
      const jawab = await kirim({ sumber: "aleta-panel", jenis: "muat-ulang" });
      expect(jawab?.ok).toBe(true);
      expect(dicatat.reload).toBe(0);
      vi.advanceTimersByTime(500);
      expect(dicatat.reload).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("pesan dari luar panel ALETA diabaikan", () => {
  it("pesan tanpa sumber yang benar tidak dijawab dan tidak memuat ulang", async () => {
    vi.useFakeTimers();
    try {
      const { kirim, dicatat } = pasangLatar({});
      // Halaman mana pun dapat mengirim pesan ke ekstensi bila id-nya
      // diketahui. Memuat ulang ekstensi atas suruhan halaman web berarti
      // menyerahkan saklar mati-hidup kepada siapa pun yang membuka tab.
      expect(await kirim({ jenis: "muat-ulang" })).toBeUndefined();
      expect(await kirim({ sumber: "halaman-lain", jenis: "muat-ulang" })).toBeUndefined();
      vi.advanceTimersByTime(5000);
      expect(dicatat.reload).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("tersambung dari panel dan dari popup", () => {
  const baca = (nama: string) => readFileSync(path.join(AKAR, nama), "utf8");

  it("manifest mendaftarkan pekerja latarnya", () => {
    const manifest = JSON.parse(baca("manifest.json"));
    expect(manifest.background?.service_worker).toBe("latar.js");
    // Tanpa update_url, requestUpdateCheck tidak punya apa pun untuk
    // ditanyakan dan pemasangan sekali klik mustahil.
    expect(String(manifest.update_url)).toContain("updates.xml");
  });

  it("penyusun paket ikut menanam latar.js - yang tidak terdaftar tidak ikut terkirim", () => {
    const susun = readFileSync(path.resolve(process.cwd(), "scripts/susun-ekstensi.mjs"), "utf8");
    expect(susun).toContain('"latar.js"');
  });

  it("panel portal mengirim pesan, bukan memanggil reload sendiri", () => {
    const aleta = baca("aleta.js");
    // Skrip konten tidak punya requestUpdateCheck maupun reload. Memanggilnya
    // di sana melempar, dan tombolnya mati tanpa keterangan.
    expect(aleta).toContain('chrome.runtime.sendMessage({ sumber: "aleta-panel", jenis })');
    // Yang dilarang PANGGILANNYA, bukan penyebutannya - komentar yang
    // menerangkan kenapa keduanya tidak dipanggil di sini justru harus boleh
    // ada, dan penjaga yang melarangnya menghukum penjelasan.
    expect(aleta).not.toMatch(/chrome\.runtime\.reload\s*\(/);
    expect(aleta).not.toMatch(/chrome\.runtime\.requestUpdateCheck\s*\(/);
    expect(aleta).toContain("Perbarui sekarang");
  });

  it("halaman ikut dimuat ulang sesudah pemasangan", () => {
    // Skrip konten TIDAK disuntikkan ulang ke halaman yang sudah terbuka.
    // Tanpa memuat ulang halamannya, panel tetap versi lama dan petugas
    // menyimpulkan pembaruannya gagal.
    const aleta = baca("aleta.js");
    expect(aleta).toContain("location.reload()");
  });

  it("popup menawarkan tombol yang sama", () => {
    const laman = baca("popup.html");
    const popup = baca("popup.js");
    for (const id of ["perbaruiSekarang", "muatUlangEkstensi", "perbaruiKabar"]) {
      expect(laman).toContain(`id="${id}"`);
    }
    expect(popup).toContain('mintaKeLatar("perbarui")');
    // reload() membunuh popupnya sendiri seketika; dikerjakan dari sana,
    // jawabannya tidak pernah sempat terbaca.
    expect(popup).not.toMatch(/chrome\.runtime\.reload\s*\(/);
  });
});
