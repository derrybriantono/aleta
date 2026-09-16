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
 * Aturan penamaannya dijaga sejak 1.146.0 dan penjaganya hijau terus. Meski
 * begitu, dua kekeliruan berturut-turut lolos darinya:
 *
 *   16 Sep pagi  berkas bernama "download.rtf" - konteks perkara disimpan
 *                pada variabel modul pekerja MV3, yang hilang tiap ±30 detik
 *                menganggur;
 *   16 Sep siang "Insecure download blocked" - perbaikannya menjawab
 *                MENYUSUL (return true lalu sarankan asinkron), dan Chrome
 *                menahan unduhan ABT yang sebelumnya lewat begitu saja.
 *
 * Keduanya tidak terlihat dari teks kodenya: tiap kata yang dicari penjaga
 * memang ada. Karena itu berkas ini MENJALANKAN latar.js di dalam node:vm
 * dengan chrome tiruan, memanggil pendengarnya seperti Chrome memanggilnya,
 * dan memeriksa dua hal sekaligus - namanya benar, DAN jawabannya seketika.
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
  let selisihWaktu = 0;

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

  // Jam yang dapat dimajukan - dipakai menguji konteks yang sudah basi tanpa
  // menunggu lima menit sungguhan.
  const DateAsli = Date;
  class DateGeser extends DateAsli {
    static now() {
      return DateAsli.now() + selisihWaktu;
    }
  }

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
    Date: DateGeser,
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
    /** Memanggil pendengarnya apa adanya - untuk memastikan jawabannya seketika. */
    namaiMentah(unduhan: Unduhan, saran: (u?: Saran) => void) {
      return dengar!(unduhan, saran);
    },
    /** Seperti halaman ABT mengabarkan konteksnya. */
    kabarkan(nomor: string, keterangan: string) {
      for (const f of pesanMasuk) {
        f({ sumber: "aleta-panel", jenis: "konteks-unduh", nomor, keterangan }, {}, () => {});
      }
    },
    /** Memajukan jam pekerjanya - untuk membuat konteksnya basi. */
    majuWaktu(ms: number) {
      selisihWaktu += ms;
    },
  };
}

const ABT = "http://192.168.10.10/aps_badilag/abt/preview?c=10119&b=x&a=y";

describe("unduhan ABT dinamai menurut perkaranya - dijalankan sungguhan", () => {
  it("halaman yang baru mengabarkan konteksnya: unduhannya dinamai", async () => {
    // Inilah jalan yang sesungguhnya ditempuh. Halaman ABT menyegarkan
    // konteksnya pada tiap pointerdown - beberapa milidetik sebelum tombol
    // CETAK menerbitkan unduhannya - sehingga pekerjanya sudah terbangun dan
    // ingatannya terisi ketika unduhan itu tiba.
    const pekerja = nyalakanPekerja({});
    pekerja.kabarkan("567/Pdt.G/2026/PA.Dgl", "[01] [Kabul Verstek] Cerai");
    const usul = await pekerja.namai({ filename: "download.rtf", url: ABT });

    expect(usul?.filename).toBe("567_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai - putusan.rtf");
    expect(usul?.conflictAction).toBe("uniquify");
  });

  it("DIJAWAB SEKETIKA - pendengarnya tidak pernah menunggu apa pun", () => {
    // 16 September siang: pendengarnya menjawab menyusul, dan Chrome menahan
    // unduhannya - "Insecure download blocked". Unduhan yang tertahan
    // menghentikan pekerjaan; berkas bernama "download" hanya merepotkan.
    const pekerja = nyalakanPekerja({});
    pekerja.kabarkan("567/Pdt.G/2026/PA.Dgl", "");
    let dijawab = false;
    const jawaban = pekerja.namaiMentah({ filename: "download.rtf", url: ABT }, () => {
      dijawab = true;
    });
    // Sudah terjawab sebelum satu putaran mikrotugas pun berlalu.
    expect(dijawab).toBe(true);
    expect(jawaban).toBe(true);
  });

  it("yang ditolak pun ditolak seketika, tanpa janji yang menggantung", () => {
    const pekerja = nyalakanPekerja({});
    let dijawab = false;
    const jawaban = pekerja.namaiMentah(
      { filename: "download.rtf", url: "https://contoh.example/lampiran" },
      () => {
        dijawab = true;
      }
    );
    // false berarti "tidak diubah" - Chrome meneruskan unduhannya sendiri.
    expect(jawaban).toBe(false);
    expect(dijawab).toBe(false);
  });

  it("garis miring nomor perkara tidak menjadi folder", async () => {
    // "567/Pdt.G/2026" sebagai nama berkas akan membuat Chrome menaruhnya di
    // dalam folder bertingkat - atau menolaknya sama sekali.
    const pekerja = nyalakanPekerja({});
    pekerja.kabarkan("567/Pdt.G/2026/PA.Dgl", "");
    const usul = await pekerja.namai({ filename: "download (2).pdf", url: ABT });
    expect(usul?.filename).toBe("567_Pdt.G_2026_PA.Dgl - putusan.pdf");
    expect(usul?.filename).not.toContain("/");
  });

  it("pekerja yang bangun tanpa ingatan MEMBIARKAN namanya - unduhannya tidak ditahan", async () => {
    // Penyimpanan sesi memulihkan konteksnya, tetapi pemulihan itu menyusul.
    // Yang dijaga: pada saat itu pendengarnya menolak seketika, bukan
    // menunggu pemulihannya.
    const gudang: Record<string, unknown> = {};
    nyalakanPekerja(gudang).kabarkan("567/Pdt.G/2026/PA.Dgl", "");
    const usul = await nyalakanPekerja(gudang).namai({ filename: "download.rtf", url: ABT });
    expect(usul).toBeNull();
  });

  it("konteks yang lewat lima menit tidak dipakai", async () => {
    // Nomor perkara dari setengah jam lalu yang ditempelkan ke unduhan
    // perkara lain tidak akan pernah disadari: berkasnya terbuka benar,
    // namanya berbohong.
    const pekerja = nyalakanPekerja({});
    pekerja.kabarkan("999/Pdt.G/2026/PA.Dgl", "");
    pekerja.majuWaktu(6 * 60 * 1000);
    const usul = await pekerja.namai({ filename: "download.rtf", url: ABT });
    expect(usul).toBeNull();
  });

  it("empat menit sesudahnya MASIH dipakai - batasnya lima menit, bukan sekejap", async () => {
    const pekerja = nyalakanPekerja({});
    pekerja.kabarkan("567/Pdt.G/2026/PA.Dgl", "");
    pekerja.majuWaktu(4 * 60 * 1000);
    const usul = await pekerja.namai({ filename: "download.rtf", url: ABT });
    expect(usul?.filename).toBe("567_Pdt.G_2026_PA.Dgl - putusan.rtf");
  });

  it("unduhan di luar ABT tidak disentuh sama sekali", async () => {
    const pekerja = nyalakanPekerja({});
    pekerja.kabarkan("567/Pdt.G/2026/PA.Dgl", "");
    const usul = await pekerja.namai({
      filename: "download.rtf",
      url: "https://contoh.example/lampiran",
    });
    expect(usul).toBeNull();
  });

  it("nama yang dipilih orang atau ABT sendiri tidak pernah ditimpa", async () => {
    // Menimpa nama yang dipilih orang lain jauh lebih merugikan daripada
    // membiarkan satu berkas bernama "download".
    const pekerja = nyalakanPekerja({});
    pekerja.kabarkan("567/Pdt.G/2026/PA.Dgl", "");
    for (const nama of ["Putusan Nomor 5.rtf", "salinan.pdf", "download.zip"]) {
      const usul = await pekerja.namai({ filename: nama, url: ABT });
      expect(usul, nama).toBeNull();
    }
  });

  it("konteks yang datang belakangan menggantikan yang lama", async () => {
    // Petugas berpindah perkara di tab yang sama. Yang terakhir dikabarkan
    // itulah yang sedang ditatapnya.
    const pekerja = nyalakanPekerja({});
    pekerja.kabarkan("111/Pdt.G/2026/PA.Dgl", "");
    pekerja.kabarkan("222/Pdt.G/2026/PA.Dgl", "");
    const usul = await pekerja.namai({ filename: "download.rtf", url: ABT });
    expect(usul?.filename).toBe("222_Pdt.G_2026_PA.Dgl - putusan.rtf");
  });

  it("konteksnya tetap disimpan untuk pekerja yang kelak bangun", async () => {
    // Ingatan yang menjawab unduhan, penyimpanan yang menolong sesudah
    // pekerjanya mati - keduanya dipakai, bukan salah satu.
    const gudang: Record<string, unknown> = {};
    nyalakanPekerja(gudang).kabarkan("567/Pdt.G/2026/PA.Dgl", "keterangan");
    const tersimpan = gudang["aleta-konteks-unduh"] as Record<string, unknown>;
    expect(tersimpan?.nomor).toBe("567/Pdt.G/2026/PA.Dgl");
    expect(tersimpan?.keterangan).toBe("keterangan");
    expect(typeof tersimpan?.saat).toBe("number");
  });
});
