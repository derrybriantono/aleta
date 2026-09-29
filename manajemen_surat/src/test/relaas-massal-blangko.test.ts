import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BLANGKO_RELAAS } from "@/lib/pohon-blangko";

/**
 * ============================================================================
 * KATALOG BLANGKO RELAAS SEBAGAI RUTE, DAN KETIGA GOLONGAN DI LAYAR
 * ============================================================================
 *
 * Diminta pengguna 25 September 2026: "di sipp dan abt deteksi apa saja
 * panggilan untuk sidang pertama, sidang yang ditunda dan pemberitahuan
 * putusan, blangkonya ambil dari abt serta jalankan saranmu".
 *
 * ============================================================================
 * BERKAS INI MENJALANKAN, TIDAK MENYISIR TEKS SUMBER
 * ============================================================================
 *
 * Penjaga yang menyisir teks sumber sudah tiga kali hijau di repositori ini
 * atas kode yang melempar galat atau memakan puluhan detik. Karena itu:
 *
 *   - rutenya benar-benar DIPANGGIL, dengan jembatan bot dipalsukan, dan
 *     jawabannya diurai kembali dari JSON;
 *   - barisnya benar-benar DIGAMBAR lewat renderToStaticMarkup, dan yang
 *     diperiksa keluaran HTML-nya - bukan keberadaan sebuah string di berkas.
 *
 * ============================================================================
 * TIGA HAL YANG DIJAGA, DAN SEBABNYA
 * ============================================================================
 *
 *  1 SPASI YANG TIDAK TERLIHAT. '[JS] 1. Relaas Panggilan Sidang T (Sidang
 *    Lanjutan) .rtf' punya satu spasi sebelum ".rtf". Nama yang kehilangan
 *    spasi itu tidak akan pernah ketemu TANPA satu pun galat, sebab "blangko
 *    tidak ada" adalah jawaban yang sah. Karena itu rutenya diuji dengan
 *    katalog palsu yang menyebut nama tanpa spasinya - dan yang benar adalah
 *    rute yang berkata "tidak ditemukan", bukan yang memaafkannya.
 *
 *  2 TIGA KEADAAN, BUKAN DUA. adaDiAbt null berarti folder ABT belum terbaca;
 *    false berarti terbaca dan namanya memang tidak ada. Menjatuhkan null ke
 *    false membuat layar berkata "blangkonya hilang" ketika yang terjadi bot
 *    tidak dapat dihubungi. Keadaan itu BUKAN teoretis: pada mesin setempat
 *    25 September 2026 blangko.katalog menjawab "Folder blangko tidak
 *    ditemukan." untuk folder relaas.
 *
 *  3 RUAS YANG BELUM ADA BUKAN NOL. golongan, urutanSidang, dihadiriOleh,
 *    pihakDipanggil, dan sudahAdaRelaas ditambahkan ke bot pada saat yang sama
 *    dengan layar ini. Selama ruasnya belum datang, layar harus berkata "belum
 *    dikirim bot" - bukan menggambar "Sidang ke-0", bukan "relaas sudah ada",
 *    dan bukan 0 pada kotak "relaas BELUM ada".
 */

// ============================================================================
// JEMBATAN BOT PALSU - katalog folder ABT dijawab per uji
// ============================================================================
type JawabanKatalog = { ok: boolean; data?: unknown; error?: string };

const keadaan = vi.hoisted(() => ({
  katalog: null as JawabanKatalog | null,
  katalogPerFolder: null as Record<string, JawabanKatalog> | null,
  panggilan: [] as Array<{ operation: string; params: Record<string, unknown> }>,
}));

vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ name: "Penguji" }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  // Galat yang ditelan menjadi 500 membuat uji gagal tanpa menyebut sebabnya.
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
// Layarnya memakai usePortal hanya untuk nama pengadilan di lembar cetak.
// Menyediakan PortalProvider sungguhan berarti menyeret seluruh keadaan portal
// ke dalam uji ini demi satu ruas teks.
vi.mock("@/lib/app-state", () => ({
  usePortal: () => ({ institutionIdentity: { courtName: "PENGADILAN AGAMA DONGGALA" } }),
}));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: async (operation: string, params: Record<string, unknown> = {}) => {
    keadaan.panggilan.push({ operation, params });
    // Jawaban per folder bila uji menyediakannya - sejak 26 Sep 2026 blangko
    // ikrar berada di folder menu ABT 25, bukan di Relaas.
    const perFolder = keadaan.katalogPerFolder?.[String(params.folder ?? "")];
    return perFolder ?? keadaan.katalog ?? { ok: false, error: "jembatan belum disiapkan uji ini" };
  },
}));

async function jalankanRute(kueri = "") {
  const mod = await import("@/app/api/aleta-ecourt/relaas-massal/blangko/route");
  const permintaan = {
    nextUrl: new URL(`http://uji.local/api/aleta-ecourt/relaas-massal/blangko${kueri}`),
  };
  return mod.GET(permintaan as unknown as Parameters<typeof mod.GET>[0]);
}

type IsiBlangko = {
  keadaan: string;
  berkas: string;
  label: string;
  pihak: string;
  jalur: string;
  adaDiAbt: boolean | null;
};

type IsiRute = {
  ok: boolean;
  data: {
    set: { id: string; nama: string; folder: string } | null;
    folder: string;
    jumlah: number;
    keadaanDikenal: string[];
    pihakDikenal: string[];
    blangko: IsiBlangko[];
    abt: {
      diperiksa: boolean;
      terbaca: boolean;
      sebab: string;
      jumlahDiFolder: number | null;
      tidakDitemukan: string[] | null;
    };
    pilihan: {
      keadaan: string;
      pihak: string;
      ada: boolean;
      berkas: string;
      jalur: string;
      label: string;
      adaDiAbt: boolean | null;
      sebab: string;
    } | null;
    sandi: { dihadiriOleh: string; pihak: string; sebab: string } | null;
  };
};

async function isiRute(kueri = "") {
  const jawaban = await jalankanRute(kueri);
  expect(jawaban.status, await jawaban.clone().text()).toBe(200);
  return (await jawaban.json()) as IsiRute;
}

/** Nama berkas yang dipakai di seluruh berkas ini - dibaca, tidak ditulis ulang. */
const BERKAS = {
  sidangPertama: BLANGKO_RELAAS.find((x) => x.keadaan === "sidang-pertama")!.berkas,
  sidangDitunda: BLANGKO_RELAAS.find((x) => x.keadaan === "sidang-ditunda")!.berkas,
  pemberitahuan: BLANGKO_RELAAS.find((x) => x.keadaan === "pemberitahuan-putusan")!.berkas,
  ikrarTalak: BLANGKO_RELAAS.find((x) => x.keadaan === "ikrar-talak")!.berkas,
};

/** Jawaban blangko.katalog seperti bentuk aslinya di sippReadOnlyBridgeService. */
function katalogPalsu(namaBerkas: string[]): JawabanKatalog {
  return {
    ok: true,
    data: {
      ada: true,
      folder: "derry_briantono/Relaas",
      jumlahSet: 0,
      jumlahBlangko: namaBerkas.length,
      set: [],
      blangko: namaBerkas.map((berkas) => ({ berkas, kode: "JS", judul: berkas })),
      isi: namaBerkas,
    },
  };
}

beforeEach(() => {
  keadaan.katalog = null;
  keadaan.katalogPerFolder = null;
  keadaan.panggilan = [];
  vi.resetModules();
});

describe("rute katalog blangko relaas - daftarnya dari satu sumber", () => {
  it("memulangkan keenam blangko beserta folder dan aturan pihaknya", async () => {
    keadaan.katalog = { ok: false, error: "bot tidak dijalankan pada uji ini" };
    const { data } = await isiRute();

    expect(data.jumlah).toBe(BLANGKO_RELAAS.length);
    expect(data.jumlah).toBe(6);
    expect(data.folder).toBe("derry_briantono/Relaas");
    expect(data.set?.id).toBe("relaas-jurusita");

    // Nama berkas PERSIS sama dengan pohon-blangko.ts, tidak dinormalkan dan
    // tidak dipangkas. Perbandingan ini yang menahan seseorang "merapikan"
    // spasi di tengah jalan.
    expect(data.blangko.map((x) => x.berkas)).toEqual(BLANGKO_RELAAS.map((x) => x.berkas));
    expect(data.blangko.map((x) => x.pihak)).toEqual(BLANGKO_RELAAS.map((x) => x.pihak));
    expect(data.blangko.every((x) => x.label.length > 0)).toBe(true);
  });

  it("nama blangko sidang lanjutan tetap membawa spasi sebelum .rtf", async () => {
    keadaan.katalog = { ok: false, error: "bot tidak dijalankan pada uji ini" };
    const { data } = await isiRute();
    const lanjutan = data.blangko.find((x) => x.keadaan === "sidang-ditunda");

    expect(lanjutan).toBeDefined();
    // Inilah satu-satunya alasan rute ini ada. Bila spasinya hilang, ekstensi
    // mencari berkas yang tidak pernah ada - tanpa galat apa pun.
    expect(lanjutan!.berkas.endsWith(") .rtf")).toBe(true);
    expect(lanjutan!.berkas).not.toBe(lanjutan!.berkas.replace(") .rtf", ").rtf"));
    expect(lanjutan!.jalur).toBe(`derry_briantono/Relaas/${lanjutan!.berkas}`);
  });

  it("jalurnya menyebut folder blangko masing-masing: ikrar di menu 25, lima lainnya di Relaas", async () => {
    keadaan.katalog = { ok: false, error: "bot mati" };
    const { data } = await isiRute();
    for (const satu of data.blangko) {
      const folder = satu.keadaan === "ikrar-talak" ? "_ikrar_talak/2 Relaas Ikrar Talak" : "derry_briantono/Relaas";
      expect(satu.jalur).toBe(`${folder}/${satu.berkas}`);
    }
  });
});

describe("rute katalog blangko relaas - folder ABT punya TIGA jawaban", () => {
  it("bot tidak terhubung: adaDiAbt null, sebabnya disebut, katalognya tetap utuh", async () => {
    keadaan.katalog = { ok: false, error: "ALETA Bot bridge tidak merespons." };
    const { data } = await isiRute();

    expect(data.abt.diperiksa).toBe(true);
    expect(data.abt.terbaca).toBe(false);
    expect(data.abt.sebab).toBe("ALETA Bot bridge tidak merespons.");
    expect(data.abt.jumlahDiFolder).toBeNull();
    expect(data.abt.tidakDitemukan).toBeNull();
    // null, BUKAN false: yang belum diukur tidak boleh terbaca sebagai hilang.
    for (const satu of data.blangko) expect(satu.adaDiAbt).toBeNull();
    // Katalognya sendiri tidak ikut gagal - ia datang dari TypeScript.
    expect(data.jumlah).toBe(6);
  });

  it("folder ABT tidak ada di mesin ini: sebab dari bot diteruskan apa adanya", async () => {
    // Persis jawaban yang terukur pada mesin setempat 25 September 2026.
    keadaan.katalog = { ok: true, data: { ada: false, sebab: "Folder blangko tidak ditemukan.", isi: [] } };
    const { data } = await isiRute();

    expect(data.abt.terbaca).toBe(false);
    expect(data.abt.sebab).toBe("Folder blangko tidak ditemukan.");
    for (const satu of data.blangko) expect(satu.adaDiAbt).toBeNull();
  });

  it("folder terbaca: yang ada true, yang tidak ada false, dan yang tidak ada didaftar", async () => {
    keadaan.katalogPerFolder = {
      "derry_briantono/Relaas": katalogPalsu([BERKAS.sidangPertama, BERKAS.sidangDitunda, BERKAS.pemberitahuan]),
      // Folder ikrar terbaca tetapi berkas ikrarnya tidak ada di sana.
      "_ikrar_talak/2 Relaas Ikrar Talak": katalogPalsu(["blangko lain.rtf"]),
    };
    const { data } = await isiRute();

    expect(data.abt.terbaca).toBe(true);
    expect(data.abt.jumlahDiFolder).toBe(4);
    expect(data.blangko.find((x) => x.keadaan === "sidang-pertama")!.adaDiAbt).toBe(true);
    expect(data.blangko.find((x) => x.keadaan === "sidang-ditunda")!.adaDiAbt).toBe(true);
    expect(data.blangko.find((x) => x.keadaan === "ikrar-talak")!.adaDiAbt).toBe(false);
    expect(data.abt.tidakDitemukan).toContain(BERKAS.ikrarTalak);
    expect(data.abt.tidakDitemukan).not.toContain(BERKAS.sidangPertama);
  });

  it("katalog yang kehilangan SPASI sebelum .rtf dinyatakan tidak ditemukan", async () => {
    // Folder yang berisi nama tanpa spasinya - inilah bentuk selisih yang
    // tidak pernah menimbulkan galat, dan yang wajib ditangkap di sini.
    const tanpaSpasi = BERKAS.sidangDitunda.replace(") .rtf", ").rtf");
    expect(tanpaSpasi).not.toBe(BERKAS.sidangDitunda);
    keadaan.katalog = katalogPalsu([BERKAS.sidangPertama, tanpaSpasi]);

    const { data } = await isiRute();
    expect(data.blangko.find((x) => x.keadaan === "sidang-ditunda")!.adaDiAbt).toBe(false);
    expect(data.abt.tidakDitemukan).toContain(BERKAS.sidangDitunda);
  });

  it("?periksaAbt=0 tidak menyentuh jembatan, dan mengaku belum memeriksa", async () => {
    keadaan.katalog = katalogPalsu([BERKAS.sidangPertama]);
    const { data } = await isiRute("?periksaAbt=0");

    expect(keadaan.panggilan).toHaveLength(0);
    expect(data.abt.diperiksa).toBe(false);
    expect(data.abt.sebab).toContain("Tidak diperiksa");
    for (const satu of data.blangko) expect(satu.adaDiAbt).toBeNull();
  });

  it("folder yang diminta ke bot: Relaas dan folder ikrar menu 25, masing-masing sekali", async () => {
    keadaan.katalog = katalogPalsu([BERKAS.sidangPertama]);
    await isiRute();
    expect(keadaan.panggilan).toHaveLength(2);
    expect(keadaan.panggilan.every((p) => p.operation === "blangko.katalog")).toBe(true);
    expect(keadaan.panggilan.map((p) => p.params.folder)).toEqual([
      "derry_briantono/Relaas",
      "_ikrar_talak/2 Relaas Ikrar Talak",
    ]);
  });

  it("berkas ikrar hanya dicari di FOLDERNYA SENDIRI - ada di Relaas pun tetap tidak ditemukan", async () => {
    keadaan.katalogPerFolder = {
      "derry_briantono/Relaas": katalogPalsu([BERKAS.sidangPertama, BERKAS.ikrarTalak]),
      "_ikrar_talak/2 Relaas Ikrar Talak": katalogPalsu(["blangko lain.rtf"]),
    };
    const { data } = await isiRute();
    expect(data.blangko.find((x) => x.keadaan === "ikrar-talak")!.adaDiAbt).toBe(false);
    expect(data.blangko.find((x) => x.keadaan === "sidang-pertama")!.adaDiAbt).toBe(true);
  });
});

describe("rute katalog blangko relaas - memilih satu blangko", () => {
  it("sidang ditunda dengan Pihak Kedua dipanggil memakai blangko sidang lanjutan", async () => {
    keadaan.katalog = katalogPalsu([BERKAS.sidangDitunda]);
    const { data } = await isiRute("?keadaan=sidang-ditunda&pihak=kedua");

    expect(data.pilihan?.ada).toBe(true);
    expect(data.pilihan?.berkas).toBe(BERKAS.sidangDitunda);
    expect(data.pilihan?.adaDiAbt).toBe(true);
  });

  it("sidang ditunda dengan Pihak Pertama beralih ke blangko dua pihak, dan sebabnya disebut", async () => {
    keadaan.katalog = { ok: false, error: "bot mati" };
    const { data } = await isiRute("?keadaan=sidang-ditunda&pihak=pertama");

    // Bukan blangko sidang lanjutan: hanya blangko sidang pertama yang memuat
    // dua pihak sekaligus. Keputusan itu ada di pohon-blangko.ts, dan rute ini
    // WAJIB menyebutkannya - pergantian blangko yang tidak dijelaskan terbaca
    // sebagai kekeliruan.
    expect(data.pilihan?.berkas).toBe(BERKAS.sidangPertama);
    expect(data.pilihan?.sebab).toContain("dua pihak");
  });

  it("dihadiriOleh dipakai ketika pihak tidak disebut - satu penerjemah sandi, bukan dua", async () => {
    keadaan.katalog = { ok: false, error: "bot mati" };

    // 2 = Pihak Pertama saja yang hadir -> panggil PIHAK KEDUA.
    const dua = await isiRute("?keadaan=sidang-ditunda&dihadiriOleh=2");
    expect(dua.data.sandi?.pihak).toBe("kedua");
    expect(dua.data.pilihan?.pihak).toBe("kedua");
    expect(dua.data.pilihan?.berkas).toBe(BERKAS.sidangDitunda);

    // 3 = Pihak Kedua saja yang hadir -> panggil PIHAK PERTAMA -> blangko dua pihak.
    const tiga = await isiRute("?keadaan=sidang-ditunda&dihadiriOleh=3");
    expect(tiga.data.sandi?.pihak).toBe("pertama");
    expect(tiga.data.pilihan?.berkas).toBe(BERKAS.sidangPertama);

    // 4 = tidak ada yang hadir -> panggil KEDUANYA.
    const empat = await isiRute("?keadaan=sidang-ditunda&dihadiriOleh=4");
    expect(empat.data.sandi?.pihak).toBe("keduanya");
  });

  it("sandi 1 = Semua Pihak hadir (blangko SIPP) - tidak dipanggil, dan TIDAK disebut tanpa arti", async () => {
    keadaan.katalog = { ok: false, error: "bot mati" };

    // Arti sandinya dibaca dari BORANG SIPP jadwal_sidang_p_edit.php, bukan
    // dari komentar kolom yang memang kosong. Sampai 25 September 2026 sandi 1
    // di sini dijawab "tidak ada artinya di SIPP" - kalimat itu SALAH, dan
    // 7.486 baris jadwal ikut disodorkan sebagai pertanyaan.
    const { data } = await isiRute("?keadaan=sidang-ditunda&dihadiriOleh=1");
    expect(data.sandi?.pihak).toBe("tidak-perlu");
    expect(data.sandi?.sebab).toContain("Semua Pihak");
    expect(data.sandi?.sebab).not.toContain("tidak ada artinya");
    // Tidak ada yang dipanggil -> tidak ada blangko, dan sebabnya disebut.
    expect(data.pilihan?.ada).toBe(false);
    expect(data.pilihan?.sebab).toContain("Semua pihak hadir");
    // Keluaran penerjemahnya sendiri tidak ditolak sebagai "pihak tidak dikenal".
    expect(data.pihakDikenal).toContain("tidak-perlu");
    const langsung = await isiRute("?keadaan=sidang-ditunda&pihak=tidak-perlu");
    expect(langsung.data.pilihan?.ada).toBe(false);
  });

  it("sandi kombinasi (10, 9) dan kosong dijawab tidak-diketahui beserta sebabnya", async () => {
    keadaan.katalog = { ok: false, error: "bot mati" };

    // 5, 7, 8, 9, 13, 14, 15 kombinasi intervensi/turut tergugat; 10/11
    // sebagian pihak. Artinya ADA, tetapi tidak dapat dipetakan ke satu blangko.
    for (const sandi of ["10", "9"]) {
      const { data } = await isiRute(`?dihadiriOleh=${sandi}`);
      expect(data.sandi?.pihak).toBe("tidak-diketahui");
      expect(data.sandi?.sebab).toContain(sandi);
      expect(data.sandi?.sebab).toContain("jangan ditebak");
      expect(data.sandi?.sebab).not.toContain("tidak ada artinya");
    }
  });

  it("keadaan dan pihak yang salah tulis DITOLAK, bukan diganti bawaan", async () => {
    keadaan.katalog = { ok: false, error: "bot mati" };

    const salahKeadaan = await jalankanRute("?keadaan=sidang-pertamaa");
    expect(salahKeadaan.status).toBe(400);
    const isiKeadaan = (await salahKeadaan.json()) as { ok: boolean; alasan: string; keadaanDikenal: string[] };
    expect(isiKeadaan.ok).toBe(false);
    expect(isiKeadaan.alasan).toContain("sidang-pertamaa");
    expect(isiKeadaan.keadaanDikenal).toContain("sidang-pertama");

    const salahPihak = await jalankanRute("?keadaan=sidang-pertama&pihak=semua");
    expect(salahPihak.status).toBe(400);
    const isiPihak = (await salahPihak.json()) as { alasan: string; pihakDikenal: string[] };
    expect(isiPihak.alasan).toContain("semua");
    expect(isiPihak.pihakDikenal).toContain("tidak-diketahui");

    // Jembatan tidak pernah disentuh untuk permintaan yang salah bentuk.
    expect(keadaan.panggilan).toHaveLength(0);
  });

  it("tanpa ?keadaan, pilihan dan sandinya null - bukan blangko pertama sebagai tebakan", async () => {
    keadaan.katalog = { ok: false, error: "bot mati" };
    const { data } = await isiRute();
    expect(data.pilihan).toBeNull();
    expect(data.sandi).toBeNull();
  });
});

// ============================================================================
// LAYAR - nilaiBaris() dijalankan, dan barisnya benar-benar digambar
// ============================================================================
async function muatLayar() {
  return import("@/components/portal/aleta-ecourt-relaas-massal");
}

type Layar = Awaited<ReturnType<typeof muatLayar>>;
type Baris = Parameters<Layar["nilaiBaris"]>[0];
type Hasil = Parameters<Layar["saringHasil"]>[0];

/** Baris sekadarnya - tanpa satu pun ruas baru, seperti jawaban bot hari ini. */
function barisLama(ubah: Partial<Baris> = {}): Baris {
  return {
    jenis: "panggilan",
    perkaraId: 9557,
    nomorPerkara: "151/Pdt.G/2026/PA.Dgl",
    jenisPerkara: "Cerai Gugat",
    pihak: "Irsan bin Abd. Rahim",
    sebutanPihak: "Tergugat",
    tanggalSidang: "2026-05-05",
    tanggalPutusan: "",
    agenda: "Pembuktian Penggugat",
    caraSandi: "S",
    caraLabel: "Surat tercatat (POS)",
    resi: "P2604230014311",
    statusPos: "terkirim",
    adaBerkas: true,
    sumberJurusita: "panggilan",
    berselisih: false,
    namaPanggilan: "",
    ...ubah,
  };
}

function gambarBaris(baris: Baris, BarisPekerjaan: Layar["BarisPekerjaan"]) {
  return renderToStaticMarkup(createElement(BarisPekerjaan, { baris }));
}

describe("layar - ruas yang BELUM dikirim bot tidak digambar sebagai nol", () => {
  it("golongan, nomor sidang, pihak, dan keadaan relaas semuanya mengaku belum ada", async () => {
    const { nilaiBaris, BarisPekerjaan } = await muatLayar();
    const baris = barisLama();
    const nilai = nilaiBaris(baris);

    expect(nilai.golongan.disebut).toBe(false);
    expect(nilai.golongan.label).toBe("Golongan belum dikirim bot");
    expect(nilai.nomorSidang.disebut).toBe(false);
    expect(nilai.pihak.disebut).toBe(false);
    expect(nilai.pihak.sebab).toContain("BELUM terukur");
    expect(nilai.relaas).toBe("tidak-disebut");
    expect(nilai.blangko.ada).toBe(false);
    expect(nilai.blangko.sebab).toContain("BELUM terukur");

    const html = gambarBaris(baris, BarisPekerjaan);
    expect(html).toContain("Golongan belum dikirim bot");
    expect(html).toContain("Sudah/belum relaas tidak disebut bot");
    // Tidak ada "Sidang ke-0": sidang bernomor mulai dari 1, jadi 0 hanya dapat
    // berarti "tidak terhitung" - dan di kertas ia terbaca sebagai fakta.
    expect(html).not.toContain("Sidang ke-0");
    expect(html).not.toContain("Sidang ke-");
    // Tidak ada klaim "relaas sudah ada" atas ruas yang tidak pernah dikirim.
    expect(html).not.toContain("Relaas sudah ada");
    expect(html).not.toContain("BELUM ada relaas");
  });

  it("urutanSidang 0 tidak digambar, urutanSidang 3 digambar", async () => {
    const { nilaiBaris } = await muatLayar();
    expect(nilaiBaris(barisLama({ urutanSidang: 0 })).nomorSidang.disebut).toBe(false);
    expect(nilaiBaris(barisLama({ urutanSidang: null })).nomorSidang.disebut).toBe(false);
    expect(nilaiBaris(barisLama({ urutanSidang: 3 })).nomorSidang.label).toBe("Sidang ke-3");
  });
});

describe("layar - ketiga golongan yang diminta pengguna dan blangkonya", () => {
  it("sidang pertama memakai blangko P dan T, dan berkasnya tergambar", async () => {
    const { nilaiBaris, BarisPekerjaan } = await muatLayar();
    const baris = barisLama({ golongan: "sidang-pertama", urutanSidang: 1, dihadiriOleh: null });
    const nilai = nilaiBaris(baris);

    expect(nilai.golongan.label).toBe("Sidang pertama");
    expect(nilai.blangko.ada).toBe(true);
    expect(nilai.blangko.berkas).toBe(BERKAS.sidangPertama);

    const html = gambarBaris(baris, BarisPekerjaan);
    expect(html).toContain("Sidang pertama");
    expect(html).toContain("Sidang ke-1");
    // Nama berkasnya digambar apa adanya, jadi spasinya pun ikut tergambar.
    expect(html).toContain("Relaas Panggilan Sidang P dan T.rtf");
  });

  it("sidang pertama: pihaknya keduanya menurut aturan blangko, TANPA peringatan kehadiran", async () => {
    const { nilaiBaris, BarisPekerjaan } = await muatLayar();
    // dihadiri_oleh pada baris sidang PERTAMA mencatat kehadiran sidang yang
    // panggilannya sedang dicetak - sidang yang belum terjadi. Memakainya untuk
    // menentukan siapa yang dipanggil salah, dan memperingatkan "kehadiran tidak
    // tercatat" pada hampir seluruh sidang pertama membuat peringatan itu
    // berhenti dibaca - termasuk pada 1.354 baris yang sungguh berbahaya.
    const baris = barisLama({ golongan: "sidang-pertama", dihadiriOleh: "" });
    const nilai = nilaiBaris(baris);

    expect(nilai.pihak.sandi).toBe("keduanya");
    expect(nilai.pihak.pasti).toBe(true);
    expect(nilai.pihak.sebab).toBe("");
    expect(nilai.blangko.berkas).toBe(BERKAS.sidangPertama);

    const html = gambarBaris(baris, BarisPekerjaan);
    expect(html).toContain("Kedua pihak dipanggil");
    expect(html).not.toContain("1.354");
    expect(html).not.toContain("text-amber-700");
  });

  it("ikrar talak juga memanggil keduanya menurut blangkonya, bukan menurut kehadiran", async () => {
    const { nilaiBaris } = await muatLayar();
    const nilai = nilaiBaris(barisLama({ golongan: "ikrar-talak", dihadiriOleh: 2 }));
    expect(nilai.blangko.berkas).toBe(BERKAS.ikrarTalak);
    // Sandi 2 TIDAK dipakai di sini: blangko ikrar talak memuat kedua pihak.
    expect(nilai.pihak.sandi).toBe("keduanya");
    expect(nilai.pihak.pasti).toBe(true);
  });

  it("pemberitahuan putusan: pihaknya baris itu sendiri, dan itu dikatakan", async () => {
    const { nilaiBaris, BarisPekerjaan } = await muatLayar();
    const baris = barisLama({
      jenis: "pemberitahuan",
      golongan: "pemberitahuan-putusan",
      dihadiriOleh: null,
      tanggalPutusan: "2026-04-20",
    });
    const nilai = nilaiBaris(baris);

    // Pasti, walau sandinya tidak-diketahui: BLANGKO_RELAAS mencatat pihaknya
    // ditentukan kolom pihak dan pihak_id barisnya sendiri.
    expect(nilai.pihak.pasti).toBe(true);
    expect(nilai.pihak.label).toContain("namanya tertulis di atas");
    expect(nilai.pihak.sebab).toBe("");
    expect(gambarBaris(baris, BarisPekerjaan)).not.toContain("1.354");
  });

  it("sidang ditunda: pihak yang dipanggil menentukan blangkonya", async () => {
    const { nilaiBaris } = await muatLayar();

    // 2 = Pihak Pertama saja yang hadir -> panggil PIHAK KEDUA.
    const kedua = nilaiBaris(barisLama({ golongan: "sidang-ditunda", dihadiriOleh: 2 }));
    expect(kedua.pihak.sandi).toBe("kedua");
    expect(kedua.pihak.label).toBe("Pihak Kedua dipanggil");
    expect(kedua.blangko.berkas).toBe(BERKAS.sidangDitunda);

    // 4 = tidak ada yang hadir -> KEDUANYA -> blangko yang memuat dua pihak.
    const keduanya = nilaiBaris(barisLama({ golongan: "sidang-ditunda", dihadiriOleh: 4 }));
    expect(keduanya.pihak.sandi).toBe("keduanya");
    expect(keduanya.blangko.berkas).toBe(BERKAS.sidangPertama);
    expect(keduanya.blangko.sebab).toContain("dua pihak");
  });

  it("pemberitahuan putusan dan ikrar talak punya blangkonya sendiri", async () => {
    const { nilaiBaris } = await muatLayar();
    expect(
      nilaiBaris(barisLama({ jenis: "pemberitahuan", golongan: "pemberitahuan-putusan" })).blangko.berkas
    ).toBe(BERKAS.pemberitahuan);
    expect(nilaiBaris(barisLama({ golongan: "ikrar-talak" })).blangko.berkas).toBe(BERKAS.ikrarTalak);
  });

  it("sidang-lanjutan MENDAPAT blangko sidang-ditunda lewat keadaanUntukGolongan", async () => {
    const { nilaiBaris, BarisPekerjaan } = await muatLayar();
    // "sidang-lanjutan" sah dari bot tetapi BUKAN salah satu KeadaanRelaas.
    // Pemetaannya keputusan, dan keputusan itu kini tertulis di
    // pohon-blangko.ts (keadaanUntukGolongan) - sebelum itu 16 dari 156 baris
    // hidup tidak mendapat blangko sama sekali.
    const baris = barisLama({ golongan: "sidang-lanjutan", dihadiriOleh: 2 });
    const nilai = nilaiBaris(baris);

    expect(nilai.golongan.label).toBe("Sidang lanjutan");
    expect(nilai.blangko.ada).toBe(true);
    expect(nilai.blangko.berkas).toBe(BERKAS.sidangDitunda);

    // Pihak Pertama ikut dipanggil -> blangko dua pihak, seperti sidang-ditunda.
    const empat = nilaiBaris(barisLama({ golongan: "sidang-lanjutan", dihadiriOleh: 4 }));
    expect(empat.blangko.berkas).toBe(BERKAS.sidangPertama);
    expect(empat.blangko.sebab).toContain("dua pihak");

    const html = gambarBaris(baris, BarisPekerjaan);
    expect(html).not.toContain("belum dapat ditentukan");
    expect(html).toContain("Relaas Panggilan Sidang T (Sidang Lanjutan) .rtf");
  });

  it("golongan yang sama sekali tidak dikenal tetap bernama, bukan dibuang", async () => {
    const { nilaiBaris } = await muatLayar();
    const nilai = nilaiBaris(barisLama({ golongan: "panggilan-saksi" }));
    expect(nilai.golongan.dikenal).toBe(false);
    expect(nilai.golongan.label).toContain("panggilan-saksi");
    expect(nilai.blangko.ada).toBe(false);
  });
});

describe("layar - pihak yang dipanggil beserta SEBABNYA", () => {
  it("kehadiran yang tidak tercatat disebut tidak-diketahui, dan angkanya ditulis", async () => {
    const { nilaiBaris, BarisPekerjaan } = await muatLayar();
    // Terukur 1.354 dari 20.109 baris jadwal sidang. Menjatuhkannya ke "semua
    // hadir" berarti tidak memanggil siapa pun; menjatuhkannya ke "keduanya"
    // berarti mencetak panggilan yang tidak diperlukan.
    const baris = barisLama({ golongan: "sidang-ditunda", dihadiriOleh: "" });
    const nilai = nilaiBaris(baris);

    expect(nilai.pihak.disebut).toBe(true);
    expect(nilai.pihak.sandi).toBe("tidak-diketahui");
    expect(nilai.pihak.sebab).toContain("1.354");
    expect(nilai.pihak.sebab).toContain("dihadiri_oleh");

    const html = gambarBaris(baris, BarisPekerjaan);
    expect(html).toContain("Pihak yang dipanggil belum diketahui");
    expect(html).toContain("1.354");
  });

  it("sandi 1 = semua pihak hadir: tidak dipanggil, tanpa blangko, dan kalimatnya benar", async () => {
    const { nilaiBaris, BarisPekerjaan } = await muatLayar();
    const baris = barisLama({ golongan: "sidang-ditunda", dihadiriOleh: 1 });
    const satu = nilaiBaris(baris);
    expect(satu.pihak.sandi).toBe("tidak-perlu");
    expect(satu.pihak.pasti).toBe(true);
    expect(satu.pihak.sebab).toBe("");
    expect(satu.pihak.label).toContain("Semua pihak hadir");
    expect(satu.blangko.ada).toBe(false);
    expect(satu.blangko.sebab).toContain("Semua pihak hadir");

    const html = gambarBaris(baris, BarisPekerjaan);
    expect(html).toContain("diperintahkan hadir di muka sidang");
    // Kalimat lama yang SALAH tidak boleh kembali.
    expect(html).not.toContain("tidak ada artinya");
  });

  it("sandi 10 (sebagian pihak): tidak-diketahui, sandinya disebut, dan artinya tidak disangkal", async () => {
    const { nilaiBaris } = await muatLayar();
    const sepuluh = nilaiBaris(barisLama({ golongan: "sidang-ditunda", dihadiriOleh: 10 }));
    expect(sepuluh.pihak.sandi).toBe("tidak-diketahui");
    expect(sepuluh.pihak.sebab).toContain('"10"');
    expect(sepuluh.pihak.sebab).toContain("sebagian pihak");
    expect(sepuluh.pihak.sebab).not.toContain("tidak ada artinya");
  });

  it("bot yang menjawab tidak-diketahui TETAP membawa sebabnya - tidak kosong", async () => {
    const { nilaiBaris, BarisPekerjaan } = await muatLayar();
    // Terukur pada jawaban bot sungguhan 25 September 2026: 14 dari 156 baris
    // empat tanggal datang dengan pihakDipanggil = "tidak-diketahui" LANGSUNG
    // dari bot. Cabang itu pernah tidak menyisakan sebab apa pun, dan layar
    // menampilkan "belum diketahui" tanpa satu kalimat penjelas.
    const kosong = nilaiBaris(
      barisLama({ golongan: "sidang-ditunda", dihadiriOleh: "", pihakDipanggil: "tidak-diketahui" })
    );
    expect(kosong.pihak.pasti).toBe(false);
    expect(kosong.pihak.sebab).toContain("1.354");

    const sandiAneh = nilaiBaris(
      barisLama({ golongan: "sidang-ditunda", dihadiriOleh: 10, pihakDipanggil: "tidak-diketahui" })
    );
    expect(sandiAneh.pihak.sebab).toContain('"10"');

    // Bot yang belum diperbarui menjawab sandi 1 dengan "tidak-diketahui".
    // Jawaban itu TIDAK menimpa arti sandi yang sudah dijawab SIPP -
    // penerjemah tunggalnya pohon-blangko.ts.
    const botLama = nilaiBaris(
      barisLama({ golongan: "sidang-ditunda", dihadiriOleh: 1, pihakDipanggil: "tidak-diketahui" })
    );
    expect(botLama.pihak.sandi).toBe("tidak-perlu");
    expect(botLama.pihak.pasti).toBe(true);

    // Tanpa ruas kehadiran sama sekali: sebabnya tetap ada, dan ia MENGAKU tidak
    // dapat menyebut sebabnya - bukan diam.
    const baris = barisLama({ golongan: "sidang-ditunda", pihakDipanggil: "tidak-diketahui" });
    const tanpaHadir = nilaiBaris(baris);
    expect(tanpaHadir.pihak.sebab).not.toBe("");
    expect(tanpaHadir.pihak.sebab).toContain("dihadiriOleh");
    expect(gambarBaris(baris, BarisPekerjaan)).toContain("Tanyakan kepada juru sitanya");
  });

  it("ruas pihakDipanggil dari bot dipakai lebih dahulu daripada sandinya", async () => {
    const { nilaiBaris } = await muatLayar();
    const nilai = nilaiBaris(
      barisLama({ golongan: "sidang-ditunda", dihadiriOleh: 2, pihakDipanggil: "pertama" })
    );
    expect(nilai.pihak.sandi).toBe("pertama");
    expect(nilai.blangko.berkas).toBe(BERKAS.sidangPertama);
  });
});

describe("layar - yang SUDAH ada relaasnya dibedakan dari yang BELUM", () => {
  it("yang belum menonjol dengan pita kiri; yang sudah tidak", async () => {
    const { BarisPekerjaan } = await muatLayar();

    const belum = gambarBaris(
      barisLama({ golongan: "sidang-pertama", sudahAdaRelaas: false }),
      BarisPekerjaan
    );
    expect(belum).toContain("BELUM ada relaas");
    expect(belum).toContain("border-l-amber-500");

    const sudah = gambarBaris(
      barisLama({ golongan: "sidang-pertama", sudahAdaRelaas: true }),
      BarisPekerjaan
    );
    expect(sudah).toContain("Relaas sudah ada");
    expect(sudah).not.toContain("border-l-amber-500");
    expect(sudah).not.toContain("BELUM ada relaas");
  });
});

// ============================================================================
// PENYARING - dijalankan atas hasil sungguhan, bukan diperiksa sebagai teks
// ============================================================================
function hasilPalsu(baris: Baris[][]): Hasil {
  const jurusita = baris.map((isi, i) => ({
    nama: `Juru Sita ${i + 1}`,
    nip: "1977070320050220" + String(i + 10),
    relaas: isi.filter((x) => x.jenis === "panggilan").length,
    pemberitahuan: isi.filter((x) => x.jenis === "pemberitahuan").length,
    baris: isi,
  }));
  return {
    tanggal: "2026-04-29",
    diperiksaPada: "2026-09-25T01:00:00.000Z",
    ringkas: {
      relaas: jurusita.reduce((n, js) => n + js.relaas, 0),
      pemberitahuan: jurusita.reduce((n, js) => n + js.pemberitahuan, 0),
      perkara: new Set(baris.flat().map((x) => x.perkaraId)).size,
      jurusita: jurusita.length,
      tanpaJurusita: 0,
      berselisih: 0,
    },
    jurusita,
    catatan: [],
  };
}

describe("layar - penyaring golongan dan penyaring pekerjaan", () => {
  it("menghitung golongan dari baris yang benar-benar ada", async () => {
    const { hitungGolongan } = await muatLayar();
    const hasil = hasilPalsu([
      [
        barisLama({ golongan: "sidang-pertama", perkaraId: 1 }),
        barisLama({ golongan: "sidang-ditunda", perkaraId: 2, dihadiriOleh: 2 }),
      ],
      [
        barisLama({ golongan: "sidang-ditunda", perkaraId: 3, dihadiriOleh: 4 }),
        barisLama({ jenis: "pemberitahuan", golongan: "pemberitahuan-putusan", perkaraId: 4 }),
        barisLama({ perkaraId: 5 }),
      ],
    ]);

    const { hitung, tanpaGolongan } = hitungGolongan(hasil.jurusita);
    expect(hitung.get("sidang-pertama")).toBe(1);
    expect(hitung.get("sidang-ditunda")).toBe(2);
    expect(hitung.get("pemberitahuan-putusan")).toBe(1);
    // Baris tanpa ruas golongan dihitung TERSENDIRI, tidak dijatuhkan ke salah
    // satu golongan - dan tidak dibuang.
    expect(tanpaGolongan).toBe(1);
  });

  it("mematikan satu golongan membuang barisnya dan MENGHITUNG ULANG angkanya", async () => {
    const { saringHasil } = await muatLayar();
    const hasil = hasilPalsu([
      [
        barisLama({ golongan: "sidang-pertama", perkaraId: 1 }),
        barisLama({ golongan: "sidang-ditunda", perkaraId: 2, dihadiriOleh: 2 }),
      ],
      [barisLama({ golongan: "sidang-pertama", perkaraId: 3 })],
    ]);
    expect(hasil.ringkas.relaas).toBe(3);

    const saring = saringHasil(hasil, { matikan: new Set(["sidang-pertama"]), hanyaBelum: false });
    // Kepala juru sita TIDAK boleh menyebut 2 di atas 1 baris - angkanya
    // dihitung ulang dari baris yang tersisa.
    expect(saring.ringkas.relaas).toBe(1);
    expect(saring.ringkas.perkara).toBe(1);
    // Juru sita yang barisnya habis tersaring dibuang, bukan digambar sebagai
    // kepala kosong - kepala kosong terbaca "tidak punya pekerjaan".
    expect(saring.jurusita).toHaveLength(1);
    expect(saring.ringkas.jurusita).toBe(1);
    expect(saring.jurusita[0].relaas).toBe(1);
  });

  it("penyaring bawaan (tanpa yang dimatikan) tidak membuang apa pun", async () => {
    const { saringHasil } = await muatLayar();
    const hasil = hasilPalsu([
      [barisLama({ golongan: "sidang-pertama", perkaraId: 1 })],
      [barisLama({ golongan: "ikrar-talak", perkaraId: 2 })],
    ]);
    const saring = saringHasil(hasil, { matikan: new Set(), hanyaBelum: false });
    expect(saring.ringkas.relaas).toBe(2);
    expect(saring.jurusita).toHaveLength(2);
  });

  it("\"hanya yang belum\" menyisakan yang sudahAdaRelaas false saja", async () => {
    const { saringHasil } = await muatLayar();
    const hasil = hasilPalsu([
      [
        barisLama({ golongan: "sidang-pertama", perkaraId: 1, sudahAdaRelaas: true }),
        barisLama({ golongan: "sidang-pertama", perkaraId: 2, sudahAdaRelaas: false }),
        // Tanpa ruasnya: TIDAK boleh ikut terhitung sebagai "belum", sebab
        // belum diukur bukan berarti belum dikerjakan.
        barisLama({ golongan: "sidang-pertama", perkaraId: 3 }),
      ],
    ]);

    const saring = saringHasil(hasil, { matikan: new Set(), hanyaBelum: true });
    expect(saring.ringkas.relaas).toBe(1);
    expect(saring.jurusita[0].baris[0].perkaraId).toBe(2);
    expect(saring.ringkas.belumAdaRelaas).toBe(1);
  });

  it("belumAdaRelaas null - bukan 0 - ketika ruasnya belum dikirim bot", async () => {
    const { saringHasil } = await muatLayar();
    const hasil = hasilPalsu([[barisLama({ golongan: "sidang-pertama", perkaraId: 1 })]]);
    const saring = saringHasil(hasil, { matikan: new Set(), hanyaBelum: false });
    // 0 di sini akan terbaca "tidak ada pekerjaan hari ini".
    expect(saring.ringkas.belumAdaRelaas).toBeNull();
  });

  it("belumAdaRelaas 0 yang TERUKUR tetap 0, bukan null", async () => {
    const { saringHasil } = await muatLayar();
    const hasil = hasilPalsu([
      [barisLama({ golongan: "sidang-pertama", perkaraId: 1, sudahAdaRelaas: true })],
    ]);
    const saring = saringHasil(hasil, { matikan: new Set(), hanyaBelum: false });
    expect(saring.ringkas.belumAdaRelaas).toBe(0);
  });
});

// ============================================================================
// LAYAR PENUH - digambar sungguhan, jawaban rutenya dipalsukan
// ============================================================================
//
// Penyaring golongan adalah bagian yang paling mudah hijau tanpa pernah bekerja:
// ia dapat ada di dalam kode, tergambar rapi, dan tetap tidak mengubah satu pun
// baris. Karena itu di sini layarnya benar-benar digambar, chip-nya benar-benar
// diketuk, dan yang diperiksa baris yang tersisa di layar.
const ambilan = vi.fn();

function jawabanRute(isi: unknown) {
  return Promise.resolve({
    ok: true,
    // Bungkus { ok, data } ikut dipalsukan - itulah yang sungguh dikeluarkan
    // rutenya. Pemalsu bertelanjang membuat uji hijau atas layar yang di dunia
    // nyata tidak menampilkan apa pun.
    json: async () => ({ ok: true, data: isi }),
  } as unknown as Response);
}

describe("layar penuh - penyaring golongan benar-benar menyaring", () => {
  beforeEach(() => {
    ambilan.mockReset();
    vi.stubGlobal("fetch", ambilan);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function gambarLayar(hasil: Hasil) {
    ambilan.mockImplementation(() => jawabanRute(hasil));
    const { AletaEcourtRelaasMassal } = await muatLayar();
    render(createElement(AletaEcourtRelaasMassal));
    await waitFor(() => expect(ambilan).toHaveBeenCalled());
    return screen;
  }

  it("lima chip golongan beserta hitungannya, dan mematikan satu membuang barisnya", async () => {
    const hasil = hasilPalsu([
      [
        barisLama({ golongan: "sidang-pertama", perkaraId: 1, nomorPerkara: "1/Pdt.G/2026/PA.Dgl" }),
        barisLama({
          golongan: "pemberitahuan-putusan",
          jenis: "pemberitahuan",
          perkaraId: 2,
          nomorPerkara: "2/Pdt.G/2026/PA.Dgl",
          tanggalPutusan: "2026-04-20",
        }),
      ],
    ]);
    const layar = await gambarLayar(hasil);

    await waitFor(() => expect(layar.getByText(/1\/Pdt\.G\/2026\/PA\.Dgl/)).toBeTruthy());
    expect(layar.getByText(/2\/Pdt\.G\/2026\/PA\.Dgl/)).toBeTruthy();

    // Chip hitungannya dari BARIS, jadi angkanya tidak dapat berselisih dengan
    // tabel yang disaringnya.
    const chip = layar.getByRole("button", { name: /Sidang pertama \(1\)/ });
    expect(chip.getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    // Barisnya benar-benar hilang - bukan hanya chipnya yang berubah warna.
    await waitFor(() => expect(layar.queryByText(/1\/Pdt\.G\/2026\/PA\.Dgl/)).toBeNull());
    expect(layar.getByText(/2\/Pdt\.G\/2026\/PA\.Dgl/)).toBeTruthy();

    // Dimatikan semuanya: layar berkata penyaringnya yang menutupi, BUKAN
    // "tidak ada relaas hari ini". Keduanya menuntut tindakan yang berbeda.
    await userEvent.click(layar.getByRole("button", { name: /Pemberitahuan putusan \(1\)/ }));
    await waitFor(() => expect(layar.getByText(/tidak satu pun lolos penyaring/)).toBeTruthy());

    await userEvent.click(layar.getByRole("button", { name: "Semua golongan" }));
    await waitFor(() => expect(layar.getByText(/1\/Pdt\.G\/2026\/PA\.Dgl/)).toBeTruthy());
  });

  it("tanpa ruas golongan: penyaring TIDAK digambar sebagai lima kotak nol", async () => {
    const hasil = hasilPalsu([
      [barisLama({ perkaraId: 1, nomorPerkara: "7/Pdt.G/2026/PA.Dgl" })],
    ]);
    const layar = await gambarLayar(hasil);

    await waitFor(() => expect(layar.getByText(/7\/Pdt\.G\/2026\/PA\.Dgl/)).toBeTruthy());
    // Tidak ada chip yang berbunyi 0 - yang ada kalimat yang menyebut sebabnya.
    expect(layar.queryByRole("button", { name: /Sidang pertama \(0\)/ })).toBeNull();
    expect(layar.getByText(/penyaring golongan belum dapat dipakai/)).toBeTruthy();
    expect(layar.getByText(/belum terukur/)).toBeTruthy();
    // Barisnya tetap digambar - yang belum tergolong tidak dibuang.
    expect(layar.getByText(/7\/Pdt\.G\/2026\/PA\.Dgl/)).toBeTruthy();
  });

  it("kotak \"relaas BELUM ada\" bertanda — bukan 0 — ketika ruasnya belum dikirim", async () => {
    const hasil = hasilPalsu([[barisLama({ golongan: "sidang-pertama", perkaraId: 1 })]]);
    const layar = await gambarLayar(hasil);

    await waitFor(() => expect(layar.getByText("relaas BELUM ada")).toBeTruthy());
    const kotak = layar.getByText("relaas BELUM ada").parentElement!;
    expect(kotak.textContent).toContain("—");
    expect(kotak.textContent).toContain("belum dikirim bot");
    expect(kotak.textContent).not.toContain("0");
  });

  it("\"hanya yang belum\" menyisakan pekerjaannya saja di layar", async () => {
    const hasil = hasilPalsu([
      [
        barisLama({
          golongan: "sidang-pertama",
          perkaraId: 1,
          nomorPerkara: "11/Pdt.G/2026/PA.Dgl",
          sudahAdaRelaas: true,
        }),
        barisLama({
          golongan: "sidang-pertama",
          perkaraId: 2,
          nomorPerkara: "22/Pdt.G/2026/PA.Dgl",
          sudahAdaRelaas: false,
        }),
      ],
    ]);
    const layar = await gambarLayar(hasil);

    await waitFor(() => expect(layar.getByText(/11\/Pdt\.G\/2026\/PA\.Dgl/)).toBeTruthy());
    expect(layar.getByText("Relaas sudah ada")).toBeTruthy();
    expect(layar.getByText("BELUM ada relaas")).toBeTruthy();

    await userEvent.click(layar.getByRole("checkbox"));
    await waitFor(() => expect(layar.queryByText(/11\/Pdt\.G\/2026\/PA\.Dgl/)).toBeNull());
    expect(layar.getByText(/22\/Pdt\.G\/2026\/PA\.Dgl/)).toBeTruthy();
  });
});

describe("layar - selisih antara ringkasan bot dan baris yang dikirimnya DISEBUT", () => {
  it("angka yang berselisih disebut beserta kedua angkanya", async () => {
    const { selisihRingkas } = await muatLayar();
    const hasil = hasilPalsu([
      [
        barisLama({ golongan: "sidang-pertama", perkaraId: 1, sudahAdaRelaas: true }),
        barisLama({ golongan: "sidang-pertama", perkaraId: 2, sudahAdaRelaas: false }),
      ],
    ]);
    // Terukur pada bot sungguhan 18 Agustus 2026: ringkasan menyebut 20 relaas
    // panggilan sedangkan baris panggilan yang dikirimnya 25. Sebabnya masuk akal
    // - ringkasan menghitung yang SUDAH ada - tetapi layar tidak boleh
    // mengganti angkanya tanpa berkata apa pun.
    hasil.ringkas.relaas = 1;
    hasil.ringkas.belumAdaRelaas = 5;

    const pesan = selisihRingkas(hasil);
    expect(pesan.some((t) => t.includes("1 relaas panggilan") && t.includes("2"))).toBe(true);
    expect(pesan.some((t) => t.includes("5 relaas yang belum ada") && t.includes("1"))).toBe(true);
  });

  it("ringkasan yang cocok tidak menimbulkan kalimat apa pun", async () => {
    const { selisihRingkas } = await muatLayar();
    const hasil = hasilPalsu([[barisLama({ golongan: "sidang-pertama", perkaraId: 1 })]]);
    expect(selisihRingkas(hasil)).toEqual([]);
  });

  it("belumAdaRelaas yang belum dikirim bot tidak dibandingkan sama sekali", async () => {
    const { selisihRingkas } = await muatLayar();
    // Tanpa ruas sudahAdaRelaas pada barisnya DAN tanpa angka di ringkasan:
    // tidak ada yang dapat dibandingkan, jadi tidak ada yang boleh dikatakan.
    const hasil = hasilPalsu([[barisLama({ golongan: "sidang-pertama", perkaraId: 1 })]]);
    delete hasil.ringkas.belumAdaRelaas;
    expect(selisihRingkas(hasil)).toEqual([]);
  });
});
