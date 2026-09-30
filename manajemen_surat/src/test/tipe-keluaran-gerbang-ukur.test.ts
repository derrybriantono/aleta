// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AMBANG_UKUR } from "@/lib/tipe-keluaran/kontrak";
import { nilaiHasilUkur } from "@/lib/tipe-keluaran/validasi";
import { usulkanMedanPutusan } from "@/lib/usulan-medan-putusan";
import { CERMIN_PUTUSAN_MEDAN } from "@/lib/tipe-keluaran/bawaan/bawaan-putusan-medan";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * GERBANG UKUR DAFTAR DETEKSI (K13) - DIJALANKAN, BUKAN DIBACA
 * ============================================================================
 *
 * Yang dijaga:
 *   1. daftar deteksi tanpa hasil ukur lulus -> sahkan DITOLAK; sesudah ukur
 *      yang lulus -> diterima (pg-mem, modul sungguhan);
 *   2. ukur ciri 'shabu' atas fixture posita memakai ciriDariKalimat BOT
 *      SUNGGUHAN: tangkapanBaru tepat, 20 contoh berbenih identik pada
 *      panggilan ulang - dan berbeda bila benihnya berbeda;
 *   3. ukur sebutan sumber hukum atas 300 sampel: sama persis sebelum dan
 *      sesudah dilaporkan tepat; yang menurunkan sama persis, atau menambah
 *      salah > 2%, ditolak - ambang 2% diuji di kedua sisinya;
 *   4. padanan jenis yang namanya tidak ada di SIPP ditolak;
 *   5. simpan hasil ukur = TEPAT satu riwayat dan satu audit.
 *
 * Gerbang ke bot DITIRU, tetapi tiruannya meneruskan ke layanan bot
 * sungguhan (ukurTipeService) atas fixture - bukan jawaban karangan.
 */

const require_ = createRequire(import.meta.url);
const BOT = path.resolve(process.cwd(), "../aleta_bot");

type EntriMuatan = { kunci: string; nilai: string; data?: Record<string, unknown> };
type Ukur = {
  ukurCiriAtas: (
    posita: Array<{ perkaraId: string; posita: string }>,
    opsi: { calon: EntriMuatan[]; dasar?: EntriMuatan[] | null; benih?: string }
  ) => {
    ok: boolean;
    n: number;
    tangkapanTanpa: number;
    tangkapanCalon: number;
    tangkapanBaru: number;
    kalimatCocok: number;
    kalimatBaru: number;
    contohBaru: number;
    benih: string;
    contoh: Array<{ id: string; perkaraId: string; kalimat: string; baru: boolean }>;
  };
  periksaPadanan: (m: { nama: string }) => Promise<{ ok: boolean; adaDiSipp: boolean; jumlahPerkara: number; namaSipp: string[] }>;
};
const ukurBot = require_(path.join(BOT, "services/ukurTipeService.js")) as Ukur;
const usulanBot = require_(path.join(BOT, "services/abtUsulanService.js")) as {
  CIRI_ALASAN: Array<{ kunci: string; kata: string[] }>;
};
const dbBot = require_(path.join(BOT, "db_config.js")) as { query: (...a: unknown[]) => unknown };
const skemaBot = require_(path.join(BOT, "services/sippSkemaService.js")) as { lupakan: () => void };

const tiruan = vi.hoisted(() => ({
  ukur: null as null | ((m: Record<string, unknown>) => Promise<unknown>),
  muatan: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  gatewayUkurTipe: async (m: Record<string, unknown>) => {
    tiruan.muatan.push(m);
    return tiruan.ukur ? tiruan.ukur(m) : { ok: false, error: "tiruan belum disetel" };
  },
  getGatewayAbtUsulan: async () => ({ ok: false, error: "tidak dipakai di berkas ini" }),
}));

// Diimpor SESUDAH vi.mock (vitest mengangkat mock ke atas).
const modul = await import("@/server/modules/aleta-ecourt/tipe-keluaran");
const ukurPortal = await import("@/server/modules/aleta-ecourt/tipe-keluaran-ukur");

// ============================================================================
// FIXTURE POSITA - disusun tangan, tanpa nama dan alamat (26 posita)
// ============================================================================
//
//   A  12 posita: "shabu" tanpa kata narkoba lain - tertangkap BARU oleh calon;
//      dua di antaranya punya kalimat shabu kedua;
//   B   8 posita: "narkoba jenis shabu" - sudah tertangkap 'narkoba';
//   C   6 posita: tanpa shabu sama sekali.
const POSITA_A = Array.from({ length: 12 }, (_x, i) => ({
  perkaraId: `a${i + 1}`,
  posita: [
    "Bahwa Penggugat dan Tergugat adalah suami isteri yang sah;",
    `Bahwa sejak tahun 20${10 + i} Tergugat sering mengkonsumsi shabu bersama teman-temannya;`,
    ...(i < 2 ? ["Bahwa Tergugat pernah menjual barang rumah tangga untuk membeli shabu;"] : []),
  ].join("\n"),
}));
const POSITA_B = Array.from({ length: 8 }, (_x, i) => ({
  perkaraId: `b${i + 1}`,
  posita: `Bahwa Penggugat dan Tergugat menikah pada tahun 20${10 + i};\nBahwa Tergugat memakai narkoba jenis shabu sejak awal pernikahan;`,
}));
const POSITA_C = Array.from({ length: 6 }, (_x, i) => ({
  perkaraId: `c${i + 1}`,
  posita: `Bahwa Penggugat dan Tergugat menikah pada tahun 20${10 + i};\nBahwa Tergugat suka berjudi kartu hingga larut malam;`,
}));
const POSITA = [...POSITA_A, ...POSITA_B, ...POSITA_C];

const sebagaiEntri = (b: { kunci: string; kata: string[] }): EntriMuatan => ({ kunci: b.kunci, nilai: b.kata.join(" + "), data: { kata: b.kata } });
const DASAR_TANPA_SHABU = usulanBot.CIRI_ALASAN.filter((b) => !(b.kata.length === 1 && b.kata[0] === "shabu")).map(sebagaiEntri);
const CALON_SHABU: EntriMuatan = { kunci: "obat terlarang", nilai: "shabu", data: { kata: ["shabu"] } };

describe("ukur ciri 'shabu' - ciriDariKalimat bot sungguhan atas fixture", () => {
  it("tangkapanBaru tepat 12 (kelompok A), tertangkap calon 20, kalimat cocok 22, n 26", () => {
    const h = ukurBot.ukurCiriAtas(POSITA, { calon: [CALON_SHABU], dasar: DASAR_TANPA_SHABU, benih: "uji-shabu" });
    expect(h.ok).toBe(true);
    expect({ n: h.n, tangkapanBaru: h.tangkapanBaru, tangkapanCalon: h.tangkapanCalon, kalimatCocok: h.kalimatCocok }).toEqual({
      n: 26,
      tangkapanBaru: 12,
      tangkapanCalon: 20,
      kalimatCocok: 22,
    });
    // Contoh bertanda 'baru' hanya dari kelompok A.
    expect(h.contoh.filter((c) => c.baru).every((c) => c.perkaraId.startsWith("a"))).toBe(true);
    expect(h.contoh.filter((c) => !c.baru).every((c) => c.perkaraId.startsWith("b"))).toBe(true);
  });

  it("dengan dasar yang SUDAH memuat shabu (CIRI_ALASAN tertanam), tangkapan baru nol - pencocoknya sungguh membandingkan", () => {
    const h = ukurBot.ukurCiriAtas(POSITA, { calon: [CALON_SHABU], dasar: null, benih: "uji-shabu" });
    expect(h.tangkapanBaru).toBe(0);
    expect(h.tangkapanCalon).toBe(20);
  });

  it("contoh mendahulukan tangkapan BARU: 3 kalimat baru di antara 33 kalimat cocok, ketiganya selalu dinilai", () => {
    // Yang diputuskan pengesah adalah perubahan yang dibawa calon. Bila contoh
    // diambil acak dari SELURUH kalimat cocok, 3 kalimat baru di antara 33
    // hanya sesekali ikut - calon yang seluruh tangkapan barunya salah lulus.
    // Atas sipp_donggala ('shabu', lima benih) dulu hanya 0-2 dari 20.
    const lamaBanyak = Array.from({ length: 30 }, (_x, i) => ({
      perkaraId: `l${i + 1}`,
      posita: `Bahwa Penggugat dan Tergugat menikah pada tahun 20${10 + (i % 15)};\nBahwa Tergugat memakai narkoba jenis shabu sejak awal pernikahan;`,
    }));
    const fixture = [...POSITA_A.slice(2, 5), ...lamaBanyak];
    for (const benih of ["a", "b", "c", "d", "e", "uji-shabu"]) {
      const h = ukurBot.ukurCiriAtas(fixture, { calon: [CALON_SHABU], dasar: DASAR_TANPA_SHABU, benih });
      expect([h.kalimatCocok, h.kalimatBaru, h.contohBaru, h.contoh.length], benih).toEqual([33, 3, 3, 20]);
      expect(h.contoh.filter((c) => c.baru).map((c) => c.perkaraId).sort(), benih).toEqual(["a3", "a4", "a5"]);
    }
    // Kalimat baru lebih dari 20: seluruh contoh baru.
    const banyakBaru = ukurBot.ukurCiriAtas([...POSITA_A, ...POSITA_A.map((p) => ({ ...p, perkaraId: `x${p.perkaraId}` })), ...lamaBanyak], {
      calon: [CALON_SHABU],
      dasar: DASAR_TANPA_SHABU,
      benih: "uji-shabu",
    });
    expect([banyakBaru.kalimatBaru, banyakBaru.contohBaru]).toEqual([28, 20]);
    expect(banyakBaru.contoh.every((c) => c.baru)).toBe(true);
  });

  it("20 contoh berbenih identik pada panggilan ulang; benih lain = urutan lain; tanpa Math.random", () => {
    const acak = vi.spyOn(Math, "random");
    const a = ukurBot.ukurCiriAtas(POSITA, { calon: [CALON_SHABU], dasar: DASAR_TANPA_SHABU, benih: "uji-shabu" });
    const b = ukurBot.ukurCiriAtas(POSITA, { calon: [CALON_SHABU], dasar: DASAR_TANPA_SHABU, benih: "uji-shabu" });
    const c = ukurBot.ukurCiriAtas(POSITA, { calon: [CALON_SHABU], dasar: DASAR_TANPA_SHABU, benih: "benih-lain" });
    expect(a.contoh).toHaveLength(20);
    expect(b.contoh).toEqual(a.contoh);
    expect(c.contoh.map((x) => x.id)).not.toEqual(a.contoh.map((x) => x.id));
    expect(new Set(a.contoh.map((x) => x.id)).size).toBe(20);
    expect(acak).not.toHaveBeenCalled();
    acak.mockRestore();
  });
});

// ============================================================================
// FIXTURE SUMBER HUKUM - 300 sampel DIBANGKITKAN (bukan putusan sungguhan)
// ============================================================================
const PILIHAN = [
  { nilai: "10", label: "Fiqh Islam" },
  { nilai: "9", label: "Kompilasi Hukum Ekonomi Syariah" },
  { nilai: "8", label: "Kompilasi Hukum Islam" },
  { nilai: "13", label: "Qanun Aceh" },
  { nilai: "11", label: "UU/PP" },
  { nilai: "16", label: "Yurisprudensi" },
];
const KELOMPOK = [
  {
    nama: "G1",
    jumlah: 135,
    benar: "10,8,11",
    teks: "<p>Menimbang bahwa perkawinan tidak dapat dipertahankan.</p><p>Mengingat Undang-Undang Nomor 1 Tahun 1974, Kompilasi Hukum Islam, serta hukum syar'i yang berkaitan dengan perkara ini.</p>",
  },
  {
    nama: "G2",
    jumlah: 90,
    benar: "8,11",
    teks: "<p>Menimbang bahwa gugatan beralasan.</p><p>Mengingat Undang-Undang Nomor 1 Tahun 1974 dan Kompilasi Hukum Islam.</p>",
  },
  {
    nama: "G3",
    jumlah: 50,
    benar: "11,16",
    teks: "<p>Menimbang pula putusan Mahkamah Agung Nomor 379 K/AG/1995 sebagai yurisprudensi.</p><p>Mengingat Undang-Undang Nomor 1 Tahun 1974.</p>",
  },
  {
    nama: "G4",
    jumlah: 13,
    benar: "8",
    teks: "<p>Menimbang ketentuan Inpres Nomor 1 Tahun 1991 tentang penyebarluasan hukum perkawinan.</p>",
  },
  { nama: "G5y", jumlah: 5, benar: "8", teks: "<p>Menimbang keadaan tambahany dan tambahanx pada perkara ini.</p>" },
  { nama: "G5x", jumlah: 2, benar: "8", teks: "<p>Menimbang keadaan tambahanx pada perkara ini.</p>" },
  // Petugas hanya mencentang UU/PP padahal KHI disebut: usulan SEBELUM calon
  // pun sudah memuat id yang "salah". Salah itu bukan salah TAMBAHAN - tanpa
  // kelompok ini, penghitung yang lupa membandingkan dengan usulan sebelum
  // tetap hijau (terbukti pada gigitan pertama).
  {
    nama: "G6",
    jumlah: 5,
    benar: "11",
    teks: "<p>Mengingat Undang-Undang Nomor 1 Tahun 1974 dan Kompilasi Hukum Islam.</p>",
  },
];
const SAMPEL = KELOMPOK.flatMap((k) =>
  Array.from({ length: k.jumlah }, (_x, i) => ({ perkaraId: `${k.nama}-${i}`, pertimbangan: k.teks, sumberHukumId: k.benar }))
);
const DASAR_SEBUTAN = (CERMIN_PUTUSAN_MEDAN["putusan.sumber-hukum.sebutan"] ?? []).map((e) => ({
  kunci: e.kunci,
  nilai: e.nilai,
  data: (e as { data?: Record<string, unknown> }).data ?? {},
  urutan: e.urutan,
  asal: "bawaan",
}));
const denganCalon = (kunci: string, nilai: string) => [...DASAR_SEBUTAN, { kunci, nilai, data: {}, urutan: 999, asal: "tambahan" }];

/** Hitungan mandiri: SATU wakil per kelompok dijalankan lewat usulkanMedanPutusan, dikali besar kelompok. */
function harapanSama(sebutan: typeof DASAR_SEBUTAN) {
  let sama = 0;
  for (const k of KELOMPOK) {
    const teks = k.teks.replace(/<[^>]+>/g, "\n");
    const [u] = usulkanMedanPutusan(teks, [{ kunci: "sh", label: "Sumber Hukum", banyak: true, pilihan: PILIHAN }], {
      tipe: { "putusan.sumber-hukum.sebutan": sebutan },
    });
    const usul = [...new Set((u.nilaiBanyak ?? []).map((x) => x.nilai))].sort().join();
    if (usul === k.benar.split(",").sort().join()) sama += k.jumlah;
  }
  return sama;
}

describe("ukur sebutan sumber hukum atas 300 sampel", () => {
  it("fixture memang 300 sampel", () => {
    expect(SAMPEL).toHaveLength(AMBANG_UKUR.sebutan.minimumSampel);
  });

  it("sama persis sebelum/sesudah dilaporkan TEPAT (dibanding hitungan mandiri per kelompok)", () => {
    const h = ukurPortal.ukurSebutanAtas(SAMPEL, PILIHAN, DASAR_SEBUTAN, denganCalon("kompilasi hukum islam", "inpres nomor 1 tahun 1991"));
    expect(h.sampel).toBe(300);
    expect(h.samaSebelum).toBe(harapanSama(DASAR_SEBUTAN));
    expect(h.samaSesudah).toBe(harapanSama(denganCalon("kompilasi hukum islam", "inpres nomor 1 tahun 1991")));
    // Calon yang berguna: G4 kini sama persis, tanpa salah baru.
    expect(h.samaSesudah - h.samaSebelum).toBe(13);
    expect(h.salahTambahan).toBe(0);
    expect(nilaiHasilUkur("putusan.sumber-hukum.sebutan", h).lulus).toBe(true);
  });

  it("sebutan yang MENURUNKAN sama persis ditolak", () => {
    const h = ukurPortal.ukurSebutanAtas(SAMPEL, PILIHAN, DASAR_SEBUTAN, denganCalon("yurisprudensi", "undang undang nomor"));
    expect(h.samaSesudah).toBeLessThan(h.samaSebelum);
    expect(h.salahTambahan).toBeGreaterThan(6);
    const n = nilaiHasilUkur("putusan.sumber-hukum.sebutan", h);
    expect(n.lulus).toBe(false);
    expect(n.sebab).toMatch(/Sama persis turun/);
  });

  it("ambang salah tambahan 2%: 5 dari 300 lulus, 7 dari 300 ditolak - sama persis tidak turun pada keduanya", () => {
    const lima = ukurPortal.ukurSebutanAtas(SAMPEL, PILIHAN, DASAR_SEBUTAN, denganCalon("qanun aceh", "tambahany"));
    const tujuh = ukurPortal.ukurSebutanAtas(SAMPEL, PILIHAN, DASAR_SEBUTAN, denganCalon("qanun aceh", "tambahanx"));
    expect([lima.salahTambahan, tujuh.salahTambahan]).toEqual([5, 7]);
    expect([lima.samaSesudah, tujuh.samaSesudah]).toEqual([lima.samaSebelum, tujuh.samaSebelum]);
    expect(nilaiHasilUkur("putusan.sumber-hukum.sebutan", lima).lulus).toBe(true);
    const t = nilaiHasilUkur("putusan.sumber-hukum.sebutan", tujuh);
    expect(t.lulus).toBe(false);
    expect(t.sebab).toMatch(/lebih dari 2%/);
  });
});

// ============================================================================
// MODUL DI pg-mem: usul -> sahkan DITOLAK -> ukur -> sahkan
// ============================================================================
let db: AletaDatabase | null = null;
const d = () => db as AletaDatabase;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  await modul.pastikanBenih(d());
  tiruan.muatan = [];
  tiruan.ukur = null;
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function hitung(sql: string) {
  const b = await d().queryOne<{ n: string | number }>(sql);
  return Number(b?.n ?? 0);
}

async function usulan(masukan: Parameters<typeof modul.usul>[2]) {
  const u = await modul.usul(d(), "usr-admin", masukan);
  if (!u.ok) throw new Error(u.alasan.join("; "));
  return u.butir.id;
}

describe("putusan.alasan.ciri lewat modul", () => {
  const CALON = { daftar: "putusan.alasan.ciri", kunci: "obat terlarang", nilai: "shabu + sejak", data: { kata: ["shabu", "sejak"] } };

  beforeEach(() => {
    tiruan.ukur = async (m) => ({
      ok: true,
      data: { jenis: "ciri", ...ukurBot.ukurCiriAtas(POSITA, m as never) },
    });
  });

  it("tanpa hasil ukur: sahkan 400; tahap periksa TIDAK menyimpan; tanda 1/20 salah -> lulus -> sahkan diterima", async () => {
    const id = await usulan(CALON);
    await expect(modul.sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" })).rejects.toMatchObject({ status: 400 });

    const riwayatAwal = await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat");
    const periksa = await ukurPortal.jalankanUkur(d(), "usr-admin", { id });
    expect(periksa).toMatchObject({ ok: true, tahap: "periksa" });
    const contoh = (periksa as { ukur: { contoh: Array<{ id: string }> } }).ukur.contoh;
    expect(contoh).toHaveLength(20);
    expect(await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat")).toBe(riwayatAwal);
    await expect(modul.sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" })).rejects.toMatchObject({ status: 400 });

    // Muatan ke bot membawa calon DAN daftar efektif sekarang sebagai dasar.
    const m = tiruan.muatan[0] as { jenis: string; calon: EntriMuatan[]; dasar: EntriMuatan[]; benih: string };
    expect(m.jenis).toBe("ciri");
    expect(m.calon).toEqual([{ kunci: "obat terlarang", nilai: "shabu + sejak", data: { kata: ["shabu", "sejak"] } }]);
    expect(m.dasar.length).toBeGreaterThan(50);
    expect(m.benih).toContain(id);

    const r = await ukurPortal.jalankanUkur(d(), "usr-admin", { id, tandaSalah: [contoh[3].id] });
    expect(r).toMatchObject({ ok: true, tahap: "tersimpan", penilaian: { lulus: true } });
    const s = await modul.sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" });
    expect(s).toMatchObject({ ok: true, butir: { keadaan: "disahkan" } });
  });

  it("3 dari 20 ditandai salah (15%) -> tersimpan tidak lulus -> sahkan 400; id contoh asing 409", async () => {
    const id = await usulan(CALON);
    const periksa = (await ukurPortal.jalankanUkur(d(), "usr-admin", { id })) as { ukur: { contoh: Array<{ id: string }> } };
    const ids = periksa.ukur.contoh.map((c) => c.id);
    await expect(ukurPortal.jalankanUkur(d(), "usr-admin", { id, tandaSalah: ["zz:9"] })).rejects.toMatchObject({ status: 409 });
    const r = await ukurPortal.jalankanUkur(d(), "usr-admin", { id, tandaSalah: ids.slice(0, 3) });
    expect(r).toMatchObject({ tahap: "tersimpan", penilaian: { lulus: false } });
    await expect(modul.sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/lebih dari 10%/),
    });
  });

  it("simpan hasil ukur = TEPAT 1 riwayat 'ukur' dan 1 audit TIPE_KELUARAN_UKUR; panitera 403", async () => {
    const id = await usulan(CALON);
    const periksa = (await ukurPortal.jalankanUkur(d(), "usr-admin", { id })) as { ukur: { contoh: Array<{ id: string }> } };
    await expect(ukurPortal.jalankanUkur(d(), "usr-panitera", { id, tandaSalah: [] })).rejects.toMatchObject({ status: 403 });
    const r0 = await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat");
    const a0 = await hitung("SELECT COUNT(*) AS n FROM audit_logs");
    await ukurPortal.jalankanUkur(d(), "usr-admin", { id, tandaSalah: [periksa.ukur.contoh[0].id] });
    expect(await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat") - r0).toBe(1);
    expect(await hitung("SELECT COUNT(*) AS n FROM audit_logs") - a0).toBe(1);
    expect(await hitung("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'TIPE_KELUARAN_UKUR'")).toBe(1);
    expect(await hitung("SELECT COUNT(*) AS n FROM aleta_tipe_keluaran_riwayat WHERE tindakan = 'ukur'")).toBe(1);
  });

  it("error bot tidak ditelan: 502 dengan sebabnya, tidak ada yang tersimpan", async () => {
    const id = await usulan(CALON);
    tiruan.ukur = async () => ({ ok: false, error: "Tabel SIPP perkara tidak terbaca" });
    await expect(ukurPortal.jalankanUkur(d(), "usr-admin", { id })).rejects.toMatchObject({
      status: 502,
      message: expect.stringMatching(/perkara tidak terbaca/),
    });
  });
});

describe("putusan.sumber-hukum.sebutan lewat modul", () => {
  beforeEach(() => {
    tiruan.ukur = async () => ({ ok: true, data: { ok: true, jenis: "sebutan", n: SAMPEL.length, pilihan: PILIHAN, sampel: SAMPEL } });
  });

  it("sebutan berguna: tanpa ukur 400, sesudah ukur lulus diterima", async () => {
    const id = await usulan({ daftar: "putusan.sumber-hukum.sebutan", kunci: "kompilasi hukum islam", nilai: "inpres nomor 1 tahun 1991" });
    await expect(modul.sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" })).rejects.toMatchObject({ status: 400 });
    const r = await ukurPortal.jalankanUkur(d(), "usr-admin", { id });
    expect(r).toMatchObject({ tahap: "tersimpan", penilaian: { lulus: true } });
    expect((r as { ukur: { samaSesudah: number; samaSebelum: number } }).ukur.samaSesudah).toBe(
      (r as { ukur: { samaSebelum: number } }).ukur.samaSebelum + 13
    );
    expect(await modul.sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" })).toMatchObject({ ok: true });
  });

  it("sebutan yang menurunkan sama persis: tersimpan tidak lulus, sahkan 400", async () => {
    const id = await usulan({ daftar: "putusan.sumber-hukum.sebutan", kunci: "yurisprudensi", nilai: "undang undang nomor" });
    const r = await ukurPortal.jalankanUkur(d(), "usr-admin", { id });
    expect(r).toMatchObject({ tahap: "tersimpan", penilaian: { lulus: false } });
    await expect(modul.sahkan(d(), "usr-super", { id, atasPerintah: "Ketua PA" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("putusan.padanan-jenis - periksaPadanan bot sungguhan atas SIPP tiruan", () => {
  const JENIS_SIPP = [
    { nama: "Cerai Gugat", jumlah: 40 },
    { nama: "Cerai  Talak", jumlah: 12 },
    { nama: "Dispensasi Kawin", jumlah: 9 },
  ];
  let queryAsli: ((...a: unknown[]) => unknown) | null = null;

  beforeAll(() => {
    queryAsli = dbBot.query;
    dbBot.query = (sql: unknown, params: unknown, cb?: unknown) => {
      const selesai = (typeof params === "function" ? params : cb) as (e: unknown, r: unknown) => void;
      const teks = String(sql);
      if (/information_schema/i.test(teks)) selesai(null, [{ tabel: "perkara", kolom: "jenis_perkara_nama" }]);
      else if (/GROUP BY jenis_perkara_nama/i.test(teks)) selesai(null, JENIS_SIPP);
      else selesai(new Error(`kueri tak terduga: ${teks.slice(0, 60)}`), null);
    };
    skemaBot.lupakan();
  });

  afterAll(() => {
    if (queryAsli) dbBot.query = queryAsli;
    skemaBot.lupakan();
  });

  beforeEach(() => {
    tiruan.ukur = async (m) => ({ ok: true, data: { jenis: "padanan", ...(await ukurBot.periksaPadanan({ nama: String(m.nama) })) } });
  });

  it("nama yang ada (spasi ganda & huruf besar diabaikan) -> adaDiSipp; nama karangan -> tidak", async () => {
    expect(await ukurBot.periksaPadanan({ nama: "cerai talak" })).toMatchObject({ adaDiSipp: true, jumlahPerkara: 12 });
    expect(await ukurBot.periksaPadanan({ nama: "gugatan perceraian" })).toMatchObject({ adaDiSipp: false, jumlahPerkara: 0 });
  });

  it("padanan yang namanya tidak ada di SIPP: ukur tersimpan tidak lulus, sahkan DITOLAK; yang ada: diterima", async () => {
    const salah = await usulan({ daftar: "putusan.padanan-jenis", kunci: "cerai gugat", nilai: "gugatan perceraian" });
    const r = await ukurPortal.jalankanUkur(d(), "usr-admin", { id: salah });
    expect(r).toMatchObject({ tahap: "tersimpan", penilaian: { lulus: false } });
    expect(tiruan.muatan.at(-1)).toEqual({ jenis: "padanan", nama: "gugatan perceraian" });
    await expect(modul.sahkan(d(), "usr-super", { id: salah, atasPerintah: "Ketua PA" })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/tidak terbaca di jenis perkara SIPP/),
    });

    const benar = await usulan({ daftar: "putusan.padanan-jenis", kunci: "dispensasi nikah", nilai: "dispensasi kawin" });
    expect(await ukurPortal.jalankanUkur(d(), "usr-admin", { id: benar })).toMatchObject({ penilaian: { lulus: true } });
    expect(await modul.sahkan(d(), "usr-super", { id: benar, atasPerintah: "Ketua PA" })).toMatchObject({ ok: true });
  });

  it("daftar 'tulis' tidak diukur (400); butir yang sudah sah tidak diukur (409)", async () => {
    const tulis = await usulan({ daftar: "bas.kehadiran.bunyi", nilai: "hadir melalui telekonferensi" });
    await expect(ukurPortal.jalankanUkur(d(), "usr-admin", { id: tulis })).rejects.toMatchObject({ status: 400 });
    const benar = await usulan({ daftar: "putusan.padanan-jenis", kunci: "dispensasi nikah", nilai: "dispensasi kawin" });
    await ukurPortal.jalankanUkur(d(), "usr-admin", { id: benar });
    await modul.sahkan(d(), "usr-super", { id: benar, atasPerintah: "Ketua PA" });
    await expect(ukurPortal.jalankanUkur(d(), "usr-admin", { id: benar })).rejects.toMatchObject({ status: 409 });
  });
});
