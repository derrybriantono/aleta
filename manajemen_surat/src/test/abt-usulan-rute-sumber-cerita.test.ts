// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * JALUR /abt/usulan LEWAT RUTE: PENCERITA, SAKSI N, ITSBAT, PERKARA LAIN
 * ============================================================================
 *
 * Yang dijalankan SUNGGUHAN, berurutan seperti di peladen:
 *   1. rute portal POST /api/aleta-bot/abt/usulan (penyaring portal, dan
 *      tipeKeluaran dari untukBot atas basis data pg-mem);
 *   2. penangan rute bot router.post("/abt/usulan") beserta penyaringnya,
 *      DIPOTONG dari internalGatewayRoutes.js lalu dijalankan di node:vm -
 *      bukan diketik ulang;
 *   3. layanan bot sungguhan (abtUsulanService, abtUsulanLainService).
 * Yang ditiru hanya pengangkutnya (gatewayFetch diganti panggilan langsung
 * dengan muatan yang di-JSON-kan, persis seperti lewat HTTP) dan kewenangan.
 *
 * Cacat yang dijaga: sebutan pencerita (sumberNama) dibuang DUA penyaring -
 * portal dan bot - sehingga bot jatuh ke tafsiran kode dan pilihan "cerita
 * dari Penggugat" tercetak "Tergugat bercerita" di berita acara.
 */

const keadaan = vi.hoisted(() => ({
  db: null as unknown,
  panggilanBot: 0,
  // Diisi beforeAll: penangan rute bot hasil potongan.
  penangan: null as null | ((body: unknown) => Promise<{ status: number; json: Record<string, unknown> }>),
}));

vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => keadaan.db,
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({
  pastikanKapabilitas: async () => ({ id: "usr_uji", name: "Penguji", roleId: "role_admin" }),
  kapabilitasPengguna: async () => [],
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", async () => {
  const { handleRouteError } = await import("@/server/shared/http");
  return { handleAdminRouteError: (galat: unknown) => handleRouteError(galat) };
});
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>()),
  // Pengangkut saja: muatan di-JSON-kan seperti gatewayFetch, lalu diserahkan
  // ke penangan rute bot yang sungguhan.
  getGatewayAbtUsulan: async (muatan: unknown) => {
    keadaan.panggilanBot += 1;
    if (!keadaan.penangan) throw new Error("penangan bot belum dimuat");
    const { status, json } = await keadaan.penangan(JSON.parse(JSON.stringify(muatan)));
    if (status !== 200 || json.ok === false) return { ok: false, error: String(json.error || `HTTP ${status}`) };
    return { ok: true, data: json };
  },
}));

// ============================================================================
// MEMOTONG RUTE BOT
// ============================================================================

const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");
const require_ = createRequire(BERKAS_RUTE);

type Panggilan = { fungsi: string; argumen: unknown[] };
const panggilan: Panggilan[] = [];

/** Layanan sungguhan, dibungkus supaya argumen yang SAMPAI kepadanya tercatat. */
function penyadap<T extends Record<string, unknown>>(modul: T): T {
  return new Proxy(modul, {
    get(sasaran, nama) {
      const nilai = Reflect.get(sasaran, nama);
      if (typeof nilai !== "function") return nilai;
      return (...argumen: unknown[]) => {
        panggilan.push({ fungsi: String(nama), argumen: JSON.parse(JSON.stringify(argumen)) });
        return (nilai as (...a: unknown[]) => unknown).apply(sasaran, argumen);
      };
    },
  });
}

function muatPenanganBot() {
  const isi = readFileSync(BERKAS_RUTE, "utf8");
  const tanda = isi.indexOf("// PENYARING MASUKAN /abt/usulan (kontrak K6)");
  const awal = isi.lastIndexOf("\n// ====", tanda);
  const akhir = isi.indexOf('router.post("/abt/pdf"');
  if (!(tanda > 0 && awal > 0 && akhir > tanda)) throw new Error("Potongan rute /abt/usulan tidak ditemukan.");
  const layanan = penyadap(require_("../services/abtUsulanService"));
  const layananLain = penyadap(require_("../services/abtUsulanLainService"));
  const rute: Record<string, (req: unknown, res: unknown) => Promise<void>> = {};
  const konteks = vm.createContext({
    require: (p: string) => (p.endsWith("/abtUsulanLainService") ? layananLain : require_(p)),
    abtUsulanService: layanan,
    requireInternalToken: () => undefined,
    router: {
      post: (jalur: string, _penjaga: unknown, penangan: (req: unknown, res: unknown) => Promise<void>) => {
        rute[jalur] = penangan;
      },
    },
    console,
  });
  vm.runInContext(isi.slice(awal, akhir), konteks, { filename: "internalGatewayRoutes.js#abt-usulan" });
  const penangan = rute["/abt/usulan"];
  if (!penangan) throw new Error("router.post('/abt/usulan') tidak terdaftar.");
  return async (body: unknown) => {
    let status = 200;
    let json: Record<string, unknown> = {};
    const res = {
      status(s: number) {
        status = s;
        return res;
      },
      json(x: unknown) {
        json = JSON.parse(JSON.stringify(x));
        return res;
      },
    };
    await penangan({ body }, res);
    return { status, json };
  };
}

let db: AletaDatabase | null = null;

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  keadaan.db = db;
  keadaan.penangan = muatPenanganBot();
});

afterAll(async () => {
  await db?.close();
  db = null;
});

async function mintaPortal(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/aleta-bot/abt/usulan/route");
  const jawab = await POST(
    new NextRequest("http://localhost/aleta/api/aleta-bot/abt/usulan", { method: "POST", body: JSON.stringify(body) })
  );
  return { status: jawab.status, isi: (await jawab.json()) as { ok: boolean; data: Record<string, unknown> } };
}

// ============================================================================
// DATA
// ============================================================================

// Templat 04 ABT (keterangan saksi cerai), sebutan diganti seperti ABT
// memasangnya: 0046/0047 adalah SEBUTAN, bukan nama.
const GANTI: Record<string, string> = { "0046": "Penggugat", "0047": "Tergugat" };
const ganti = (s: string) => s.replace(/#(\d{4})#/g, (m, n: string) => GANTI[n] ?? m);
const TEMPLAT_04 = [
  ["1", "Apakah saksi kenal dengan #0046# dan #0047#?", "Ya, saya kenal dengan #0046# dan #0047# karena saya adalah #1241# / #1242#;"],
  ["5", "Bagaimana kehidupan rumah tangga #0046# dan #0047#?", "Pada awalnya kehidupan rumah tangga #0046# dan #0047# rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang terus menerus;"],
  ["7", "Apakah saksi tahu penyebab perselisihan dan pertengkaran #0046# dan #0047#?", "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu #5227#;"],
  ["8", "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?", "Saya mengetahui karena saya pernah/sering melihat dan mendengar pertengkaran dan perselisihan #0046# dan #0047#;"],
  ["16", "Apakah masih ada keterangan yang saksi akan sampaikan?", "Sudah cukup;"],
].map(([no, tanya, jawab]) => ({ no, tanya: ganti(tanya), jawab: ganti(jawab) }));

/** Tiga pilihan pencerita di panel SDG, dengan sebutan yang dikirim ekstensi (abt.js sebutanSumber). */
const PENCERITA = [
  { kode: "penggugat", sumberNama: "Penggugat", harapan: "Penggugat", bukan: "Tergugat" },
  { kode: "tergugat", sumberNama: "Tergugat", harapan: "Tergugat", bukan: "Penggugat" },
  { kode: "keluarga", sumberNama: "keluarga mereka", harapan: "keluarga mereka", bukan: "Tergugat" },
];

type BarisSaksi = { no: string; tanya: string; jawab: string };

function mintaSdg(modus: Record<string, unknown>, tambahan: Record<string, unknown> = {}) {
  return mintaPortal({
    nomorPerkara: "123/Pdt.G/2025/PA.Dgl",
    sumber: "saksi-sdg",
    kodeKumpulan: "04",
    templat: TEMPLAT_04,
    alasan: ["perselisihan"],
    // pelaku = 0047 = Tergugat; lawan = 0046 = Penggugat.
    pelaku: "Tergugat",
    lawan: "Penggugat",
    modus,
    ...tambahan,
  });
}

const caraTahu = (baris: BarisSaksi[]) => (baris.find((b) => b.no === "8") ?? { jawab: "" }).jawab;

// ============================================================================
// UJI
// ============================================================================

describe("rute /abt/usulan - sebutan pencerita sampai ke berita acara", () => {
  it("pilihan pencerita penggugat/tergugat/keluarga menjadi Penggugat/Tergugat/keluarga mereka (3/3)", async () => {
    let benar = 0;
    for (const p of PENCERITA) {
      const satu = { modus: "dari-cerita", sumber: p.kode, sumberNama: p.sumberNama, alasan: [] };
      const { status, isi } = await mintaSdg({ saksi1: satu, saksi2: satu });
      expect(status).toBe(200);
      const sdg = isi.data.saksiSdg as { saksi1: BarisSaksi[]; saksi2: BarisSaksi[] };
      for (const baris of [sdg.saksi1, sdg.saksi2]) {
        const jawab = caraTahu(baris);
        expect(jawab.toLowerCase()).toContain(p.harapan.toLowerCase());
        expect(jawab).not.toContain(p.bukan);
      }
      benar += 1;
    }
    expect(benar).toBe(3);
  });

  it("sumberNama SAMPAI ke penyusun lewat kedua penyaring (bukan hanya kebetulan benar)", async () => {
    panggilan.length = 0;
    // Sebutan yang TIDAK dapat diturunkan dari kodenya: hanya lolos bila kedua
    // penyaring sungguh meneruskan sumberNama.
    const satu = { modus: "dari-cerita", sumber: "penggugat", sumberNama: "Penggugat Konvensi", alasan: [] };
    const { isi } = await mintaSdg({ saksi1: satu, saksi2: satu });
    const susun = panggilan.find((p) => p.fungsi === "susunKeteranganSaksiSdg");
    const opsi = susun?.argumen[0] as { modus: { saksi1: { sumberNama: string } }; nomorPerkara: string; kodeKumpulan: string };
    expect(opsi.modus.saksi1.sumberNama).toBe("Penggugat Konvensi");
    expect(caraTahu((isi.data.saksiSdg as { saksi1: BarisSaksi[] }).saksi1)).toContain("Penggugat Konvensi");
    // Nomor perkara dan kode kumpulan diteruskan - penentu varian (K7b).
    expect(opsi.nomorPerkara).toBe("123/Pdt.G/2025/PA.Dgl");
    expect(opsi.kodeKumpulan).toBe("04");
  });

  it("ekstensi tanpa sumberNama: kode penggugat/tergugat diterjemahkan dengan sebutan halaman, bukan dibalik", async () => {
    for (const p of PENCERITA.slice(0, 2)) {
      const satu = { modus: "dari-cerita", sumber: p.kode, alasan: [] };
      const { isi } = await mintaSdg({ saksi1: satu, saksi2: satu });
      const jawab = caraTahu((isi.data.saksiSdg as { saksi1: BarisSaksi[] }).saksi1);
      expect(jawab).toContain(p.harapan);
      expect(jawab).not.toContain(p.bukan);
    }
  });

  it("saksi N: sampai lima P dan empat T, pihak P/T; yang tidak sah disebut, bukan ditelan", async () => {
    panggilan.length = 0;
    const saksi = [
      { ke: 1, pihak: "P", modus: "sama", sumber: "", sumberNama: "", alasan: [] },
      { ke: 2, pihak: "P", modus: "dari-cerita", sumber: "penggugat", sumberNama: "Penggugat", alasan: [] },
      { ke: 1, pihak: "T", modus: "dari-cerita", sumber: "tergugat", alasan: [] },
      { ke: 2, pihak: "X", modus: "sama", sumber: "", alasan: [] },
      { ke: 9, pihak: "T", modus: "sama", sumber: "", alasan: [] },
    ];
    const { isi } = await mintaSdg({ saksi1: { modus: "sama" }, saksi2: { modus: "sebagian" } }, { saksi });
    const opsi = panggilan.find((p) => p.fungsi === "susunKeteranganSaksiSdg")?.argumen[0] as {
      saksi: { ke: number; pihak: string; sumberNama: string }[];
    };
    expect(opsi.saksi.map((s) => `${s.pihak}${s.ke}`)).toEqual(["P1", "P2", "T1"]);
    // Saksi T tanpa sebutan: diterjemahkan dari kodenya dengan sebutan halaman.
    expect(opsi.saksi[2].sumberNama).toBe("Tergugat");
    expect(isi.data.saksiDitolak).toEqual([
      { indeks: 3, alasan: "pihak_bukan_P_atau_T" },
      { indeks: 4, alasan: "ke_di_luar_1_sampai_4" },
    ]);
  });

  it("portal memotong saksi[] menjadi sembilan (5 P + 4 T) sebelum ke bot", async () => {
    panggilan.length = 0;
    const saksi = Array.from({ length: 12 }, (_, i) => ({ ke: (i % 4) + 1, pihak: i < 4 ? "P" : "T", modus: "sama" }));
    await mintaSdg({ saksi1: { modus: "sama" }, saksi2: { modus: "sama" } }, { saksi });
    const opsi = panggilan.find((p) => p.fungsi === "susunKeteranganSaksiSdg")?.argumen[0] as { saksi: unknown[] };
    expect(opsi.saksi.length).toBeLessThanOrEqual(9);
  });
});

describe("rute /abt/usulan - itsbat memakai sebutan pemohon (0046)", () => {
  const POSITA_ITSBAT =
    "Bahwa pada tanggal 07 Mei 2017 telah terjadi pernikahan antara Pemohon dengan Xxxa bin Yyya di Desa Aaaa Kecamatan Bbbb;";

  it("pemohon=0046 -> 'Status Pemohon sebelum nikah'", async () => {
    const { isi } = await mintaPortal({
      nomorPerkara: "45/Pdt.P/2025/PA.Dgl",
      sumber: "itsbat",
      posita: POSITA_ITSBAT,
      pemohon: "Pemohon",
      // 0047 pada itsbat voluntair: yang dahulu keliru dipakai sebagai sebutan pemohon.
      pelaku: "Termohon",
    });
    const itsbat = isi.data.itsbat as { usulan: { kode: string; nama: string }[]; bawaanAbt: { kode: string; nama: string }[] };
    expect(itsbat.usulan.find((u) => u.kode === "7211")?.nama).toBe("Umur Pemohon saat menikah");
    // 1002 kembali usulan ALETA (ukur ulang 13 Okt), labelnya tetap bersebutan pemohon.
    expect(itsbat.usulan.find((u) => u.kode === "1002")?.nama).toBe("Status Pemohon sebelum nikah");
  });

  it("ekstensi lama tanpa pemohon: cadangan pelaku tetap berlaku (perilaku lama, bukan kosong)", async () => {
    const { isi } = await mintaPortal({
      nomorPerkara: "45/Pdt.P/2025/PA.Dgl",
      sumber: "itsbat",
      posita: POSITA_ITSBAT,
      pelaku: "Pemohon I",
    });
    const itsbat = isi.data.itsbat as { usulan: { kode: string; nama: string }[]; bawaanAbt: { kode: string; nama: string }[] };
    expect(itsbat.usulan.find((u) => u.kode === "7211")?.nama).toBe("Umur Pemohon I saat menikah");
    expect(itsbat.usulan.find((u) => u.kode === "1002")?.nama).toBe("Status Pemohon I sebelum nikah");
  });

  /**
   * Rute menyaring usulan pengurai menurut sumber terukur (GERBANG_ITSBAT):
   * variabel yang bawaan ABT-nya terukur lebih tepat tidak dikirim sebagai
   * usulan ALETA, melainkan sebagai tawaran ABT beserta kuerinya. Pengurainya
   * sendiri tetap mengurai ke-14 variabel.
   */
  // 13 Okt 2026 (butir 14, 228/Pdt.P/2026): "bawaan ABT" tidak pernah tersimpan (baris tetap DATA_TIDAK_ADA);
  // sesudah pengurai diperbaiki dan diukur ulang, ke-14 variabel diusulkan ALETA dan tidak ada yang diserahkan.
  it("usulan ALETA ke-14 variabel itsbat; tidak ada yang diserahkan ke bawaan ABT", async () => {
    panggilan.length = 0;
    const { isi } = await mintaPortal({ nomorPerkara: "45/Pdt.P/2025/PA.Dgl", sumber: "itsbat", posita: POSITA_ITSBAT, pemohon: "Pemohon" });
    const itsbat = isi.data.itsbat as {
      usulan: { kode: string }[];
      bawaanAbt: { kode: string; acuan: string; alasan: string }[];
      belumSiap: unknown[];
    };
    const empatBelas = ["0007", "0650", "0651", "1001", "1002", "1003", "1046", "1217", "5105", "5178", "5197", "7211", "7212", "8087"];
    expect(itsbat.usulan.map((u) => u.kode).filter((k) => empatBelas.includes(k)).sort()).toEqual(empatBelas);
    expect(itsbat.bawaanAbt).toEqual([]);
    expect(itsbat.belumSiap).toEqual([]);
    const urai = panggilan.find((p) => p.fungsi === "dariPositaItsbat");
    expect(urai, "pengurai tetap dipanggil").toBeTruthy();
    expect(panggilan.some((p) => p.fungsi === "saringUsulanItsbat")).toBe(true);
  });
});

describe("rute /abt/usulan - sumber 'posita-lain' (dispensasi kawin, perwalian)", () => {
  // Posita berbentuk templat PA Donggala, disamarkan (sama dengan
  // usulan-perkara-lain.test.ts): nama 'Xxxa', KUA/kecamatan 'Aaaa'.
  const DK = [
    "Bahwa para Pemohon telah menikah pada tanggal 26 September 2004 di Kantor Urusan Agama Kecamatan Aaaa, Kabupaten Bbbb, dan pernikahan tersebut telah dikaruniai 2 (dua) orang anak yang masing-masing bernama :",
    "Xxxa Yyya binti Zzza, umur 16 tahun",
    "Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Xxxa Yyya binti Zzza (calon mempelai wanita) dengan seorang laki-laki yang bernama Muh. Xxxb bin Zzzb (calon mempelai laki-laki), umur 21 tahun;",
    "Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Cccc, Kabupaten Dddd, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur;",
  ].join("\n");
  const PERWALIAN =
    "Bahwa Pemohon adalah istri dari Alm. Xxxa bin Yyya (Suami Pemohon) yang telah meninggal dunia pada tanggal 3 Maret 2020; " +
    "Bahwa Pemohon hendak menjadi wali atas anak yang bernama Xxxc binti Xxxa untuk mengurus balik nama sertifikat tanah;";

  type HasilLain = {
    ok: boolean;
    jenis: string;
    usulan: { kode: string; nama: string; nilai: string; keyakinan: string; sumber: unknown[]; siap: boolean }[];
    belumSiap: { kode: string; alasan: string; presisi: number | null; n: number }[];
  };

  function bentukK6(h: HasilLain) {
    expect(Object.keys(h)).toEqual(expect.arrayContaining(["ok", "jenis", "usulan", "belumSiap"]));
    for (const u of h.usulan) {
      expect(Object.keys(u).sort()).toEqual(["keyakinan", "kode", "nama", "nilai", "siap", "sumber"]);
      expect(u.siap).toBe(true);
    }
    for (const b of h.belumSiap) expect(Object.keys(b).sort()).toEqual(["alasan", "kode", "n", "presisi"]);
  }

  it("dispensasi kawin (jenis 362): berbentuk K6 dan hanya variabel siap yang diusulkan", async () => {
    panggilan.length = 0;
    const { isi } = await mintaPortal({
      nomorPerkara: "7/Pdt.P/2025/PA.Dgl",
      sumber: "posita-lain",
      jenisPerkara: "362",
      posita: DK,
      pemohon: "Pemohon I",
    });
    const h = isi.data.positaLain as HasilLain;
    expect(h.ok).toBe(true);
    expect(h.jenis).toBe("dispensasi-kawin");
    bentukK6(h);
    expect(h.usulan.find((u) => u.kode === "0606")?.nilai).toBe("Xxxa Yyya binti Zzza");
    // Pengaturan tipe keluaran dan jenis perkara SAMPAI ke layanannya.
    const opsi = panggilan.find((p) => p.fungsi === "dariPositaLain")?.argumen[1] as {
      jenisPerkara: string;
      tipeKeluaran?: { versi: string };
      sebutan: { pemohon: string };
    };
    expect(opsi.jenisPerkara).toBe("362");
    expect(opsi.sebutan.pemohon).toBe("Pemohon I");
    expect(typeof opsi.tipeKeluaran?.versi).toBe("string");
  });

  it("perwalian: berbentuk K6; variabel yang belum lulus gerbang ada di belumSiap, tidak diusulkan", async () => {
    const { isi } = await mintaPortal({
      nomorPerkara: "8/Pdt.P/2025/PA.Dgl",
      sumber: "posita-lain",
      jenisPerkara: "Perwalian",
      posita: PERWALIAN,
    });
    const h = isi.data.positaLain as HasilLain;
    expect(h.ok).toBe(true);
    expect(h.jenis).toBe("perwalian");
    bentukK6(h);
    expect(h.belumSiap.length).toBeGreaterThan(0);
  });
});

describe("rute /abt/usulan - templat mentah dan syarat bentuk sampai ke penyusun", () => {
  // Satu baris templat "kenal" yang BUKAN hubungan dua saksi: "isteri / suami"
  // adalah pilihan kata. Hanya templat mentahnya yang membuktikannya - tanpa
  // itu penyusun menebak dari teks terganti dan memecahnya menjadi dua saksi.
  const BARIS_KENAL = {
    no: "1",
    tanya: "Apakah saksi kenal dengan Tergugat?",
    jawab: "Saya kenal dengan Tergugat sebagai isteri / suami Penggugat;",
  };
  const MENTAH_KENAL = "Saya kenal dengan #0047# sebagai isteri / suami #0046#;";
  const sama = { saksi1: { modus: "sama" }, saksi2: { modus: "sama" } };
  const opsiSusun = () =>
    panggilan.find((p) => p.fungsi === "susunKeteranganSaksiSdg")?.argumen[0] as {
      templat: { jawabMentah?: string }[];
      jenisPerkara?: string;
      alur?: string;
    };

  it("jawabMentah lolos penyaring portal dan bot; 'isteri / suami' tidak dipecah menjadi dua saksi", async () => {
    panggilan.length = 0;
    const { isi } = await mintaSdg(sama, { templat: [{ ...BARIS_KENAL, jawabMentah: MENTAH_KENAL }] });
    expect(opsiSusun().templat[0].jawabMentah).toBe(MENTAH_KENAL);
    const s = isi.data.saksiSdg as { saksi1: BarisSaksi[]; saksi2: BarisSaksi[] };
    expect(s.saksi1[0].jawab).toContain("isteri / suami Penggugat");
    expect(s.saksi2[0].jawab).toContain("isteri / suami Penggugat");

    // Pembanding: tanpa templat mentah penyusun hanya dapat menebak - dan
    // salah menebak. Inilah yang terjadi selama portal membuang ruasnya.
    const tanpa = await mintaSdg(sama, { templat: [BARIS_KENAL] });
    const t = tanpa.isi.data.saksiSdg as { saksi1: BarisSaksi[] };
    expect(t.saksi1[0].jawab).not.toContain("isteri / suami");
  });

  it("jawabMentah dibatasi 2.000 huruf di portal; bukan teks tidak dibuat-buat", async () => {
    panggilan.length = 0;
    await mintaSdg(sama, {
      templat: [
        { ...BARIS_KENAL, jawabMentah: `${MENTAH_KENAL}${"x".repeat(3000)}` },
        { ...BARIS_KENAL, no: "2" },
      ],
    });
    const t = opsiSusun().templat;
    expect(t[0].jawabMentah?.length).toBe(2000);
    // Baris tanpa jawabMentah tidak diberi ruas kosong: "" akan dibaca
    // penyusun sebagai "tidak ada templat mentah", tetapi undefined-lah
    // yang jujur.
    expect("jawabMentah" in t[1]).toBe(false);
  });

  it("jenisPerkara dan alur sampai ke penyusun SDG dan ke dariPositaLain", async () => {
    panggilan.length = 0;
    await mintaSdg(sama, { jenisPerkara: "346", alur: "16" });
    expect(opsiSusun().jenisPerkara).toBe("346");
    expect(opsiSusun().alur).toBe("16");

    panggilan.length = 0;
    await mintaPortal({ nomorPerkara: "7/Pdt.P/2025/PA.Dgl", sumber: "posita-lain", jenisPerkara: "362", alur: "16", posita: "x" });
    const lain = panggilan.find((p) => p.fungsi === "dariPositaLain")?.argumen[1] as { jenisPerkara: string; alur: string };
    expect(lain.jenisPerkara).toBe("362");
    expect(lain.alur).toBe("16");
  });

  it("bentuk bersyarat jenis perkara/alur dipakai lewat rute bot hanya bila perkaranya cocok", async () => {
    const kunci = "bagaimana kehidupan rumah tangga pihak dan pihak";
    const syarat = { jenisPerkaraId: "346", alur: "16" };
    const tipeKeluaran = {
      versi: "uji-syarat",
      daftar: {
        "bas.saksi.bentuk": [
          { kunci, nilai: "pada awalnya kehidupan rumah tangga #0046# dan #0047# rukun dan harmonis, namun {slot}", data: { syarat }, urutan: 1 },
          { kunci, nilai: "awalnya rumah tangga #0046# dan #0047# rukun dan harmonis, tetapi {slot}", data: { syarat }, urutan: 2 },
        ],
      },
    };
    const kirim = async (perkara: Record<string, unknown>) => {
      const { status, json } = await (keadaan.penangan as NonNullable<typeof keadaan.penangan>)({
        nomorPerkara: "1/Pdt.G/2025/PA.Dgl",
        sumber: "saksi-sdg",
        kodeKumpulan: "04",
        templat: [TEMPLAT_04[1]],
        alasan: ["perselisihan"],
        pelaku: "Tergugat",
        lawan: "Penggugat",
        modus: sama,
        tipeKeluaran,
        ...perkara,
      });
      expect(status).toBe(200);
      expect(json.tipeKeluaranDitolak ?? []).toEqual([]);
      const s = json.saksiSdg as { saksi1: BarisSaksi[]; saksi2: BarisSaksi[] };
      return [s.saksi1[0].jawab, s.saksi2[0].jawab];
    };
    // Perkara cocok: bentuk bersyarat dipakai.
    expect((await kirim({ jenisPerkara: "346", alur: "16" })).some((j) => j.startsWith("Awalnya rumah tangga"))).toBe(true);
    // Tanpa jenis/alur, atau jenis lain: bentuk bersyarat tidak berlaku.
    for (const perkara of [{}, { jenisPerkara: "347", alur: "16" }, { jenisPerkara: "346" }]) {
      expect((await kirim(perkara)).every((j) => j.startsWith("Pada awalnya kehidupan"))).toBe(true);
    }
  });
});
