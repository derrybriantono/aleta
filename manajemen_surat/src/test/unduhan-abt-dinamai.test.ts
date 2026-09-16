// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENAMAAN UNDUHAN ABT - DIJALANKAN, BUKAN DIBACA TEKSNYA
 * ============================================================================
 *
 * Aturan penamaannya sudah dijaga sejak 1.146.0, dan penjaganya hijau terus.
 * Meski begitu, 16 September 2026 folder unduhan berisi enam berkas bernama
 * "download.rtf" dan "download (2).pdf" - pada hari yang sama ketika unduhan
 * lewat panel ALETA bernama benar.
 *
 * Sebabnya tidak dapat dilihat dari teks kodenya: konteks perkara disimpan
 * pada satu variabel modul di pekerja latar Manifest V3, dan Chrome mematikan
 * pekerja itu sesudah kira-kira tiga puluh detik menganggur. Seluruh penjaga
 * teks tetap hijau karena setiap kata yang mereka cari memang masih ada.
 *
 * Karena itu berkas ini MENJALANKAN latar.js di dalam node:vm dengan chrome
 * tiruan, lalu memanggil pendengarnya seperti Chrome memanggilnya - termasuk
 * keadaan "pekerja baru saja dibangunkan, ingatannya kosong, tetapi
 * penyimpanannya masih ada".
 */

const AKAR = path.resolve(__dirname, "../../../ekstensi-sipp");
const sumberLatar = readFileSync(path.join(AKAR, "latar.js"), "utf8");

type Saran = { filename?: string; conflictAction?: string } | undefined;
type Unduhan = { filename: string; url: string; referrer?: string };

/**
 * Menyalakan latar.js sekali - mewakili satu kali pekerja latar dibangunkan.
 * Penyimpanannya diserahkan dari luar, jadi pemanggil dapat menirukan
 * "pekerjanya mati lalu hidup lagi" dengan menyalakannya ulang memakai
 * penyimpanan yang sama.
 */
function nyalakanPekerja(gudang: Record<string, unknown>) {
  let dengar: ((b: Unduhan, s: (u?: Saran) => void) => boolean) | null = null;
  const pesanMasuk: Array<(p: unknown, k: unknown, j: (x: unknown) => void) => unknown> = [];

  const nyata: Record<string, unknown> = {
    storage: {
      session: {
        set: async (o: Record<string, unknown>) => void Object.assign(gudang, o),
        get: async (k: string) => ({ [k]: gudang[k] }),
      },
    },
    downloads: {
      onDeterminingFilename: {
        addListener: (f: (b: Unduhan, s: (u?: Saran) => void) => boolean) => {
          dengar = f;
        },
      },
    },
    runtime: {
      onMessage: {
        addListener: (f: (p: unknown, k: unknown, j: (x: unknown) => void) => unknown) => {
          pesanMasuk.push(f);
        },
      },
    },
  };

  // Chrome tiruan yang menumbuhkan dirinya sendiri: apa pun yang disentuh
  // latar.js menjadi fungsi kosong, kecuali yang sengaja diisi di atas. Tanpa
  // ini, tiap pemakaian chrome.* yang tidak ada hubungannya dengan unduhan -
  // alarm, lencana, pembaruan - menggagalkan pemuatan berkasnya.
  const tumbuh = (asli: any): any =>
    new Proxy(asli || {}, {
      get(sasaran: any, kunci: any) {
        if (kunci in sasaran) {
          const nilai = sasaran[kunci];
          // Boneka buatan sendiri dibungkus lagi supaya cabang berikutnya ikut
          // tumbuh; fungsi sungguhan dibiarkan mentah - membungkusnya membuat
          // panggilannya memulangkan undefined.
          if (nilai && (typeof nilai === "object" || nilai.__boneka)) return tumbuh(nilai);
          return nilai;
        }
        if (typeof kunci === "symbol") return undefined;
        const boneka: any = function () {};
        boneka.__boneka = true;
        boneka.addListener = () => {};
        boneka.removeListener = () => {};
        sasaran[kunci] = boneka;
        return tumbuh(boneka);
      },
      apply: () => undefined,
    });

  const konteks: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => ({ ok: false, status: 0, json: async () => ({}) }),
    URL,
    TextDecoder,
    TextEncoder,
  };
  konteks.self = konteks;
  konteks.globalThis = konteks;
  konteks.chrome = tumbuh(nyata);
  vm.createContext(konteks);
  vm.runInContext(sumberLatar, konteks, { filename: "latar.js" });

  if (!dengar) throw new Error("latar.js tidak memasang pendengar onDeterminingFilename");

  return {
    /** Seperti Chrome memanggilnya. Pulang null bila namanya dibiarkan. */
    async namai(unduhan: Unduhan): Promise<Saran | null> {
      return new Promise((selesai) => {
        const jawaban = dengar!(unduhan, (usul) => selesai(usul ?? null));
        // Listener yang memulangkan selain true berarti "tidak diubah", dan
        // Chrome tidak menunggu apa pun.
        if (jawaban !== true) selesai(null);
      });
    },
    /** Seperti halaman ABT mengabarkan konteksnya. */
    kabarkan(nomor: string, keterangan: string) {
      for (const f of pesanMasuk) {
        f({ sumber: "aleta-panel", jenis: "konteks-unduh", nomor, keterangan }, {}, () => {});
      }
    },
  };
}

const ABT = "http://192.168.10.10/aps_badilag/abt/preview?c=10119&b=x&a=y";

describe("unduhan ABT dinamai menurut perkaranya - dijalankan sungguhan", () => {
  it("pekerja yang BARU DIBANGUNKAN tetap menamainya - inilah cacat 16 Sep 2026", async () => {
    // Halaman mengabarkan konteksnya, lalu pekerjanya mati (Chrome mematikan
    // pekerja MV3 sesudah ±30 detik menganggur), lalu unduhannya datang dan
    // membangunkannya kembali. Sebelum perbaikan ini, pekerja yang baru
    // bangun itu tidak ingat apa-apa dan berkasnya bernama "download".
    const gudang: Record<string, unknown> = {};
    nyalakanPekerja(gudang).kabarkan("567/Pdt.G/2026/PA.Dgl", "[01] [Kabul Verstek] Cerai");

    const sesudahBangun = nyalakanPekerja(gudang); // pekerja yang lain sama sekali
    const usul = await sesudahBangun.namai({ filename: "download.rtf", url: ABT });

    expect(usul?.filename).toBe("567_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai - putusan.rtf");
    expect(usul?.conflictAction).toBe("uniquify");
  });

  it("garis miring nomor perkara tidak menjadi folder", async () => {
    // "567/Pdt.G/2026" sebagai nama berkas akan membuat Chrome menaruhnya di
    // dalam folder bertingkat - atau menolaknya sama sekali.
    const gudang: Record<string, unknown> = {};
    nyalakanPekerja(gudang).kabarkan("567/Pdt.G/2026/PA.Dgl", "");
    const usul = await nyalakanPekerja(gudang).namai({ filename: "download (2).pdf", url: ABT });
    expect(usul?.filename).toBe("567_Pdt.G_2026_PA.Dgl - putusan.pdf");
    expect(usul?.filename).not.toContain("/");
  });

  it("tanpa konteks sama sekali, namanya dibiarkan - bukan dikarang", async () => {
    const usul = await nyalakanPekerja({}).namai({ filename: "download.rtf", url: ABT });
    expect(usul).toBeNull();
  });

  it("konteks yang lewat lima menit tidak dipakai", async () => {
    // Nomor perkara dari setengah jam lalu yang ditempelkan ke unduhan
    // perkara lain tidak akan pernah disadari: berkasnya terbuka benar,
    // namanya berbohong.
    const gudang: Record<string, unknown> = {
      "aleta-konteks-unduh": {
        nomor: "999/Pdt.G/2026/PA.Dgl",
        keterangan: "",
        saat: Date.now() - 6 * 60 * 1000,
      },
    };
    const usul = await nyalakanPekerja(gudang).namai({ filename: "download.rtf", url: ABT });
    expect(usul).toBeNull();
  });

  it("unduhan di luar ABT tidak disentuh sama sekali", async () => {
    const gudang: Record<string, unknown> = {};
    nyalakanPekerja(gudang).kabarkan("567/Pdt.G/2026/PA.Dgl", "");
    const usul = await nyalakanPekerja(gudang).namai({
      filename: "download.rtf",
      url: "https://contoh.example/lampiran",
    });
    expect(usul).toBeNull();
  });

  it("nama yang dipilih orang atau ABT sendiri tidak pernah ditimpa", async () => {
    // Menimpa nama yang dipilih orang lain jauh lebih merugikan daripada
    // membiarkan satu berkas bernama "download".
    const gudang: Record<string, unknown> = {};
    nyalakanPekerja(gudang).kabarkan("567/Pdt.G/2026/PA.Dgl", "");
    for (const nama of ["Putusan Nomor 5.rtf", "salinan.pdf", "download.zip"]) {
      const usul = await nyalakanPekerja(gudang).namai({ filename: nama, url: ABT });
      expect(usul, nama).toBeNull();
    }
  });

  it("konteks yang datang belakangan menggantikan yang lama", async () => {
    // Petugas berpindah perkara di tab yang sama. Yang terakhir dikabarkan
    // itulah yang sedang ditatapnya.
    const gudang: Record<string, unknown> = {};
    const pekerja = nyalakanPekerja(gudang);
    pekerja.kabarkan("111/Pdt.G/2026/PA.Dgl", "");
    pekerja.kabarkan("222/Pdt.G/2026/PA.Dgl", "");
    const usul = await nyalakanPekerja(gudang).namai({ filename: "download.rtf", url: ABT });
    expect(usul?.filename).toBe("222_Pdt.G_2026_PA.Dgl - putusan.rtf");
  });
});
