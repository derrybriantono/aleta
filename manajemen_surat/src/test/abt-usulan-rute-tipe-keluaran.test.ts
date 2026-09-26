// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DAFTAR_BOT, DAFTAR_TIPE } from "@/lib/tipe-keluaran/kontrak";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { untukBot } from "@/server/modules/aleta-ecourt/tipe-keluaran";

/**
 * ============================================================================
 * JALUR /abt/usulan LEWAT RUTE: tipeKeluaran (K6), PENYARINGNYA, DAN 413
 * ============================================================================
 *
 * Dijalankan sungguhan: rute portal (untukBot atas pg-mem), penangan rute bot
 * yang DIPOTONG dari internalGatewayRoutes.js dan dijalankan di node:vm, dan
 * layanan bot sungguhan. Yang ditiru hanya pengangkut HTTP dan kewenangan.
 *
 * Janji yang dijaga:
 *   - tipeKeluaran = cermin bawaan menghasilkan keluaran yang SAMA PERSIS
 *     dengan tanpa tipeKeluaran (tabel kosong/tak terbaca = perilaku hari
 *     ini), dan tidak satu entri cermin pun ditolak penyaring bot;
 *   - entri rusak dibuang SEBELUM sampai ke penyusun, dan disebut;
 *   - muatan > 64 KB dijawab 413 tanpa memanggil bot;
 *   - asal pengaturan disebut jujur: 'portal' hanya bila bot menerimanya.
 */

const keadaan = vi.hoisted(() => ({
  db: null as unknown,
  panggilanBot: 0,
  penangan: null as null | ((body: unknown) => Promise<{ status: number; json: Record<string, unknown> }>),
  // Mengubah jawaban bot sebelum sampai ke portal - meniru bot versi lama.
  ubahJawaban: null as null | ((json: Record<string, unknown>) => Record<string, unknown>),
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
  getGatewayAbtUsulan: async (muatan: unknown) => {
    keadaan.panggilanBot += 1;
    if (!keadaan.penangan) throw new Error("penangan bot belum dimuat");
    const { status, json } = await keadaan.penangan(JSON.parse(JSON.stringify(muatan)));
    if (status !== 200 || json.ok === false) return { ok: false, error: String(json.error || `HTTP ${status}`) };
    return { ok: true, data: keadaan.ubahJawaban ? keadaan.ubahJawaban(json) : json };
  },
}));

// ============================================================================
// MEMOTONG RUTE BOT
// ============================================================================

const BERKAS_RUTE = path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js");
const require_ = createRequire(BERKAS_RUTE);

type Panggilan = { fungsi: string; argumen: unknown[] };
const panggilan: Panggilan[] = [];

function penyadap<T extends Record<string, unknown>>(modul: T): T {
  return new Proxy(modul, {
    get(sasaran, nama) {
      const nilai = Reflect.get(sasaran, nama);
      if (typeof nilai !== "function") return nilai;
      return (...argumen: unknown[]) => {
        panggilan.push({ fungsi: String(nama), argumen: JSON.parse(JSON.stringify(argumen ?? null)) });
        return (nilai as (...a: unknown[]) => unknown).apply(sasaran, argumen);
      };
    },
  });
}

let penandaBot: Record<string, string[]> = {};

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
  vm.runInContext(`${isi.slice(awal, akhir)}\n;globalThis.__uji = { PENANDA_TIPE_BOT };`, konteks, {
    filename: "internalGatewayRoutes.js#abt-usulan",
  });
  penandaBot = JSON.parse(JSON.stringify((konteks as { __uji: { PENANDA_TIPE_BOT: unknown } }).__uji.PENANDA_TIPE_BOT));
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

let dbSehat: AletaDatabase | null = null;

/** Basis data yang tidak dapat dibaca sama sekali - tabel tipe keluaran ikut tak terbaca. */
const galatBaca = async () => {
  throw new Error("koneksi basis data terputus (uji)");
};
const DB_RUSAK = {
  queryAll: galatBaca,
  queryOne: galatBaca,
  execute: galatBaca,
  transaction: galatBaca,
  isTransactionClient: () => false,
};

beforeAll(async () => {
  dbSehat = await createAletaDatabase({ useInMemory: true, seed: true });
  keadaan.penangan = muatPenanganBot();
});

afterAll(async () => {
  await dbSehat?.close();
  dbSehat = null;
});

beforeEach(() => {
  keadaan.db = dbSehat;
  keadaan.ubahJawaban = null;
  panggilan.length = 0;
});

async function mintaPortal(body: unknown) {
  const { POST } = await import("@/app/api/aleta-bot/abt/usulan/route");
  const teks = typeof body === "string" ? body : JSON.stringify(body);
  const jawab = await POST(new NextRequest("http://localhost/aleta/api/aleta-bot/abt/usulan", { method: "POST", body: teks }));
  return { status: jawab.status, isi: (await jawab.json()) as { ok: boolean; data: Record<string, unknown>; error?: { message: string } } };
}

// ============================================================================
// DATA - templat 04 ABT utuh (keterangan saksi cerai), sebutan dipasang.
// ============================================================================

const GANTI: Record<string, string> = { "0046": "Penggugat", "0047": "Tergugat" };
const ganti = (s: string) => s.replace(/#(\d{4})#/g, (m, n: string) => GANTI[n] ?? m);
const TEMPLAT_04 = [
  ["1", "Apakah saksi kenal dengan #0046# dan #0047#?", "Ya, saya kenal dengan #0046# dan #0047# karena saya adalah #1241# / #1242#;"],
  ["2", "Apakah saksi tahu hubungan #0046# dan #0047#?", "Antara #0046# dan #0047# adalah suami istri yang sah;"],
  ["3", "Dimana #0046# dan #0047# bertempat tinggal setelah menikah?", "Setelah menikah #0046# dan #0047# membina rumah tangga di #8491#;"],
  ["5", "Bagaimana kehidupan rumah tangga #0046# dan #0047#?", "Pada awalnya kehidupan rumah tangga #0046# dan #0047# rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang terus menerus;"],
  ["6", "Kapan mulai terjadi perselisihan dan pertengkaran antara #0046# dan #0047#?", "Perselisihan dan pertengkaran #0046# dan #0047# terjadi sejak #0222#;"],
  ["7", "Apakah saksi tahu penyebab perselisihan dan pertengkaran #0046# dan #0047#?", "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu #5227#;"],
  ["8", "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?", "Saya mengetahui karena saya pernah/sering melihat dan mendengar pertengkaran dan perselisihan #0046# dan #0047#;"],
  ["9", "Berapa kali saksi melihat dan mendengar #0046# dan #0047# bertengkar?", "Saya melihat dan mendengar #0046# dan #0047# bertengkar kurang lebih _ kali;"],
  ["10", "Apakah saat ini #0046# dan #0047# masih tinggal serumah?", "#0046# dan #0047# sudah pisah tempat tinggal sejak #0246#;"],
  ["11", "Siapa yang meninggalkan tempat tinggal bersama?", "Yang meninggalkan kediaman bersama adalah #7035#;"],
  ["14", "Apakah sejak ada masalah, #0046# dan #0047# pernah diupayakan untuk rukun kembali?", "Ya, #1268#;"],
  ["15", "Apakah saksi masih sanggup untuk mendamaikan #0046# dan #0047#?", "Saya tidak sanggup lagi;"],
  ["16", "Apakah masih ada keterangan yang saksi akan sampaikan?", "Sudah cukup;"],
].map(([no, tanya, jawab]) => ({ no, tanya: ganti(tanya), jawab: ganti(jawab) }));

const MODUS = ["sama", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah"];

const POSITA =
  "Bahwa sejak tahun 2019 antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran disebabkan Tergugat tidak memberi nafkah dan Tergugat berselingkuh; " +
  "Bahwa puncaknya pada bulan Maret 2022 Tergugat pergi meninggalkan kediaman bersama hingga sekarang;";

const SAKSI_1 =
  "Bahwa saksi kenal Penggugat dan Tergugat karena saksi ibu kandung Penggugat; bahwa sejak tahun 2019 Penggugat dan Tergugat sering bertengkar karena Tergugat tidak memberi nafkah; " +
  "bahwa Tergugat pergi meninggalkan Penggugat sejak Maret 2022 dan sudah 3 tahun pisah; bahwa saksi sudah menasihati Penggugat namun tidak berhasil.";
const SAKSI_2 =
  "Bahwa saksi kenal Penggugat dan Tergugat karena saksi tetangga Penggugat; bahwa Penggugat dan Tergugat sering berselisih karena Tergugat tidak memberi nafkah dan berselingkuh; " +
  "bahwa sejak Maret 2022 mereka berpisah tempat tinggal; bahwa pihak keluarga sudah berupaya merukunkan namun tidak berhasil.";

function mintaSdg(modus: string) {
  const satu = { modus, sumber: "keluarga", sumberNama: "keluarga mereka", alasan: ["perselisihan"] };
  return mintaPortal({
    nomorPerkara: "123/Pdt.G/2025/PA.Dgl",
    sumber: "saksi-sdg",
    kodeKumpulan: "04",
    templat: TEMPLAT_04,
    posita: POSITA,
    pelaku: "Tergugat",
    lawan: "Penggugat",
    modus: { saksi1: satu, saksi2: { ...satu, modus: modus === "sama" ? "sebagian" : modus } },
  });
}

function mintaSaksi() {
  return mintaPortal({
    nomorPerkara: "123/Pdt.G/2025/PA.Dgl",
    sumber: "saksi",
    saksi1: SAKSI_1,
    saksi2: SAKSI_2,
    tanggalSidang: "12 Mei 2025",
    pelaku: "Tergugat",
    lawan: "Penggugat",
    posita: POSITA,
  });
}

// ============================================================================
// UJI
// ============================================================================

describe("tipeKeluaran = cermin bawaan tidak mengubah keluaran", () => {
  it("SDG: templat 04 x 6 modus - keluaran dengan tipeKeluaran (portal) = tanpa (tertanam), deep-equal", async () => {
    let sama = 0;
    for (const modus of MODUS) {
      keadaan.db = dbSehat;
      const dengan = await mintaSdg(modus);
      keadaan.db = DB_RUSAK;
      const tanpa = await mintaSdg(modus);

      expect(dengan.isi.data.tipeKeluaranAsal).toBe("portal");
      expect(tanpa.isi.data.tipeKeluaranAsal).toBe("tertanam");
      // Tabel tak terbaca DISEBUT, bukan diam.
      expect((tanpa.isi.data.kabar as string[]).join(" ")).toMatch(/tidak terbaca/);
      // Tidak satu entri cermin pun ditolak penyaring bot.
      expect(dengan.isi.data.tipeKeluaranDitolak).toEqual([]);

      // Seluruh isi harus sama; yang boleh berbeda hanya ruas ASAL bank
      // (versiBank/asalBank) - penanda dari mana kalimatnya dibaca, sama
      // seperti tipeKeluaranAsal di atas.
      const isiSaja = (x: unknown) => {
        const { versiBank: _v, asalBank: _a, ...sisa } = (x ?? {}) as Record<string, unknown>;
        return sisa;
      };
      expect(Object.keys(isiSaja(dengan.isi.data.saksiSdg)).length).toBeGreaterThan(3);
      expect(isiSaja(dengan.isi.data.saksiSdg)).toEqual(isiSaja(tanpa.isi.data.saksiSdg));
      sama += 1;
    }
    expect(sama).toBe(MODUS.length);
  });

  it("tipeKeluaran SUNGGUH sampai ke penyusun SDG saat portal membacanya", async () => {
    await mintaSdg("sama");
    const opsi = panggilan.find((p) => p.fungsi === "susunKeteranganSaksiSdg")?.argumen[0] as {
      tipeKeluaran?: { versi: string; daftar: Record<string, unknown[]> };
    };
    const efektif = await untukBot(dbSehat as AletaDatabase);
    expect(opsi.tipeKeluaran?.versi).toBe(efektif.versi);
    expect(opsi.tipeKeluaran?.daftar).toEqual(JSON.parse(JSON.stringify(efektif.daftar)));
  });

  it("keterangan saksi (dariKeteranganSaksi): dengan = tanpa, dan opsi.tipeKeluaran diteruskan", async () => {
    keadaan.db = dbSehat;
    const dengan = await mintaSaksi();
    const opsi = panggilan.find((p) => p.fungsi === "dariKeteranganSaksi")?.argumen[5] as { tipeKeluaran?: unknown };
    expect(opsi?.tipeKeluaran).toBeTruthy();
    keadaan.db = DB_RUSAK;
    const tanpa = await mintaSaksi();
    expect(dengan.isi.data.saksi).toEqual(tanpa.isi.data.saksi);
    expect(dengan.isi.data.tipeKeluaranDitolak).toEqual([]);
  });
});

describe("penyaring tipeKeluaran di bot (K6)", () => {
  const PANJANG = "x".repeat(401);

  async function kirimLangsungKeBot(daftar: Record<string, unknown>) {
    const efektif = await untukBot(dbSehat as AletaDatabase);
    const tipe = { versi: efektif.versi, daftar: { ...JSON.parse(JSON.stringify(efektif.daftar)), ...daftar } };
    const templat = [...TEMPLAT_04, { no: "20", tanya: "Di mana tinggal?", jawab: "di #8491#;" }];
    // Langsung ke rute bot: portal tidak pernah mengirim entri tak tersahkan,
    // tetapi rute internal dapat dipanggil selain lewat portal.
    const hasil: Record<string, { status: number; json: Record<string, unknown> }> = {};
    for (const sumber of ["saksi-sdg", "saksi", "posita-lain"]) {
      hasil[sumber] = await (keadaan.penangan as NonNullable<typeof keadaan.penangan>)({
        nomorPerkara: "123/Pdt.G/2025/PA.Dgl",
        sumber,
        templat,
        saksi1: SAKSI_1,
        saksi2: SAKSI_2,
        posita: POSITA,
        jenisPerkara: "362",
        pelaku: "Tergugat",
        lawan: "Penggugat",
        tipeKeluaran: tipe,
      });
    }
    return hasil;
  }

  it("entri rusak dibuang dan disebut; 0 yang sampai ke penyusun", async () => {
    const frasa = "bersama.alasan.frasa";
    const banyakCiri = Array.from({ length: 250 }, (_, i) => ({
      kunci: `ciri-uji-${i}`,
      nilai: `kataujia${i}`,
      data: { kata: [`kataujia${i}`] },
      urutan: i,
    }));
    const hasil = await kirimLangsungKeBot({
      [frasa]: [
        { kunci: "rusak-template", nilai: "SENTINEL_A ${process.exit()} {pelaku}", data: { urutan: 1 }, urutan: 1 },
        { kunci: "rusak-html", nilai: "SENTINEL_B <script>{pelaku}", data: { urutan: 2 }, urutan: 2 },
        { kunci: "rusak-penanda", nilai: "SENTINEL_C {pelakuu} pergi", data: { urutan: 3 }, urutan: 3 },
        { kunci: "rusak-panjang", nilai: `SENTINEL_D ${PANJANG}`, data: { urutan: 4 }, urutan: 4 },
        { kunci: "rusak-baris", nilai: "SENTINEL_E\n{pelaku}", data: { urutan: 5 }, urutan: 5 },
        { kunci: "rusak-data", nilai: "{pelaku} baik", data: { urutan: 6, setara: ["SENTINEL_F <b>"] }, urutan: 6 },
        { kunci: "sehat", nilai: "{pelaku} SEHAT_1 pergi", data: { urutan: 7 }, urutan: 7 },
      ],
      "bas.saksi.asing": [{ kunci: "", nilai: "SENTINEL_G" }],
      "putusan.alasan.ciri": banyakCiri,
      "bas.saksi.bentuk": [
        { kunci: "di mana tinggal", nilai: "SENTINEL_H tinggal di #1234#", data: {}, urutan: 0 },
        { kunci: "di mana tinggal", nilai: "#0046# SEHAT_2 tinggal di #8491#", data: {}, urutan: 1 },
      ],
    });

    // Tidak satu pun SENTINEL sampai ke penyusun mana pun; entri sehat sampai.
    const semuaArgumen = JSON.stringify(panggilan.map((p) => p.argumen));
    for (const s of "ABCDEFGH") expect(semuaArgumen).not.toContain(`SENTINEL_${s}`);
    expect(semuaArgumen).toContain("SEHAT_1");
    expect(semuaArgumen).toContain("SEHAT_2");
    // Lebih dari 200 entri: yang ke-201 dst tidak sampai.
    const opsiSaksi = panggilan.find((p) => p.fungsi === "dariKeteranganSaksi")?.argumen[5] as {
      tipeKeluaran: { daftar: Record<string, unknown[]> };
    };
    expect(opsiSaksi.tipeKeluaran.daftar["putusan.alasan.ciri"]).toHaveLength(200);
    expect(semuaArgumen).not.toContain("ciri-uji-200");
    expect(Object.keys(opsiSaksi.tipeKeluaran.daftar)).not.toContain("bas.saksi.asing");

    const ditolak = hasil["saksi-sdg"].json.tipeKeluaranDitolak as { daftar: string; kunci: string; alasan: string; jumlah?: number }[];
    // Yang ditolak penyaring RUTE (penyusunnya boleh menolak lebih banyak
    // lagi dengan aturannya sendiri - itu ikut disebut, tidak diuji di sini).
    for (const [daftar, kunci, alasan] of [
      [frasa, "rusak-template", "nilai_memuat_${"],
      [frasa, "rusak-html", "nilai_memuat_<"],
      [frasa, "rusak-penanda", "nilai_penanda_asing:{pelakuu}"],
      [frasa, "rusak-panjang", "nilai_lebih_dari_400_huruf"],
      [frasa, "rusak-baris", "nilai_memuat_ganti_baris"],
      [frasa, "rusak-data", "data_memuat_<"],
      ["bas.saksi.bentuk", "di mana tinggal", "nilai_penanda_asing:#1234#"],
    ]) {
      expect(ditolak).toContainEqual({ daftar, kunci, alasan });
    }
    // #8491# ada di templat permintaan (bentuk dasar), #0046# selalu sah:
    // entri itu LOLOS penyaring rute.
    expect(ditolak).not.toContainEqual(expect.objectContaining({ alasan: "nilai_penanda_asing:#8491#" }));
    expect(ditolak).toContainEqual({ daftar: "bas.saksi.asing", kunci: "", alasan: "daftar_tidak_dikenal" });
    expect(ditolak).toContainEqual({ daftar: "putusan.alasan.ciri", kunci: "", alasan: "lebih_dari_200_entri", jumlah: 50 });
    expect(hasil["saksi-sdg"].json.tipeKeluaranDiterima).toBe(true);
  });

  it("penanda sah per daftar di bot = penanda registri portal (DAFTAR_TIPE)", () => {
    expect(Object.keys(penandaBot).sort()).toEqual([...DAFTAR_BOT].sort());
    for (const daftar of DAFTAR_BOT) {
      // #0046#/#0047# di bot = '#dddd#' di registri (sisanya dari bentuk dasar).
      const bot = new Set(penandaBot[daftar].map((p) => (/^#\d{4}#$/.test(p) ? "#dddd#" : p)));
      expect([...bot].sort()).toEqual([...DAFTAR_TIPE[daftar].penanda].sort());
    }
  });
});

describe("batas muatan dan asal pengaturan", () => {
  it("muatan > 64 KB -> 413, dan bot tidak dipanggil", async () => {
    const sebelum = keadaan.panggilanBot;
    const { status, isi } = await mintaPortal({
      nomorPerkara: "123/Pdt.G/2025/PA.Dgl",
      sumber: "saksi",
      saksi1: "a".repeat(40000),
      saksi2: "b".repeat(30000),
    });
    expect(status).toBe(413);
    expect(isi.ok).toBe(false);
    expect(isi.error?.message).toMatch(/64 KB/);
    expect(keadaan.panggilanBot).toBe(sebelum);
  });

  it("badan yang bukan JSON -> 400 dengan sebabnya, bot tidak dipanggil", async () => {
    const sebelum = keadaan.panggilanBot;
    const { status, isi } = await mintaPortal("{nomorPerkara: bukan json");
    expect(status).toBe(400);
    expect(isi.error?.message).toMatch(/bukan JSON/);
    expect(keadaan.panggilanBot).toBe(sebelum);
  });

  it("muatan tepat di bawah batas tetap diteruskan", async () => {
    const sebelum = keadaan.panggilanBot;
    const { status } = await mintaPortal({ nomorPerkara: "1/Pdt.G/2025/PA.Dgl", sumber: "saksi", saksi1: "a".repeat(60000) });
    expect(status).toBe(200);
    expect(keadaan.panggilanBot).toBe(sebelum + 1);
  });

  it("bot lama yang tidak mengakui tipeKeluaran: asal 'tertanam' dan disebut", async () => {
    keadaan.ubahJawaban = (json) => {
      const salinan = { ...json };
      delete salinan.tipeKeluaranDiterima;
      return salinan;
    };
    const { isi } = await mintaSdg("sama");
    expect(isi.data.tipeKeluaranAsal).toBe("tertanam");
    expect(isi.data.tipeKeluaranVersi).toBeNull();
    expect((isi.data.kabar as string[]).join(" ")).toMatch(/belum mengenal pengaturan tipe keluaran/);
  });

  it("entri yang ditolak bot disebut dalam kabar portal", async () => {
    keadaan.ubahJawaban = (json) => ({
      ...json,
      tipeKeluaranDitolak: [{ daftar: "bersama.alasan.frasa", kunci: "x", alasan: "nilai_memuat_<" }],
    });
    const { isi } = await mintaSdg("sama");
    expect(isi.data.tipeKeluaranDitolak).toHaveLength(1);
    expect((isi.data.kabar as string[]).join(" ")).toMatch(/1 entri pengaturan tipe keluaran ditolak/);
  });
});
