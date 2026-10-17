// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bentukNamaPihak, namaDiriPihak, nilaiPenyamaran } from "@/lib/anonim-nama-pihak";

/**
 * ============================================================================
 * ANONIMISASI PUTUSAN: BENTUK NAMA BER-"ALIAS" DAN "TETAP UNGGAH" (12 Okt 2026, butir 19)
 * ============================================================================
 *
 * Perkara 564/Pdt.G/2026/PA.Dgl ditolak: "Berkas anonimisasi masih memuat
 * nama pihak: Almaningsi Astuti". Penggugat di SIPP bernama "<nama> alias
 * <ejaan lain> binti <ayah>", dan bukti P.1 (ABT 1214) menulis "KTP-el atas
 * nama <NAMA HURUF BESAR>". ABT menyamarkan nama SIPP UTUH saja; penyamar
 * ALETA dahulu hanya memotong di bin/binti, sedangkan penjaga server memotong
 * di "alias" - nama itu lolos dari penyamar dan tertangkap penjaga.
 *
 * Diukur atas 108 putusan Donggala sungguhan (salinan baca-saja, simulasi
 * str_replace ABT): sebelum = 25 nama tersisa di 13 putusan, 10 di antaranya
 * ditolak server padahal pemeriksa ekstensi diam; sesudah = 0 dan 0.
 *
 * Nama di uji ini karangan; NIK karangan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const konten = () => readFileSync(path.join(AKAR, "konten.js"), "utf8").replace(/\r\n/g, "\n");

function potongFungsi(isi: string, nama: string): string {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^(?:async )?function ${nama}\\(`).test(b));
  if (mulai < 0) throw new Error(`fungsi ${nama} tidak ketemu`);
  let j = mulai;
  while (j < baris.length && baris[j] !== "}") j += 1;
  return baris.slice(mulai, j + 1).join("\n");
}
function tetapan(isi: string, nama: string): string {
  const baris = isi.split("\n").find((b) => b.startsWith(`const ${nama} = `));
  if (!baris) throw new Error(`tetapan ${nama} tidak ketemu`);
  return baris;
}

/** Penyamar & pemeriksa ekstensi yang SUNGGUHAN, dipotong dari konten.js. */
function muatPenyamar() {
  const isi = konten();
  const k: Record<string, unknown> = {};
  vm.createContext(k);
  vm.runInContext(
    [
      tetapan(isi, "A30_BUKAN_SAMARAN"),
      ...[
        "a30PetaRtf",
        "a30TeksRtf",
        "a30PolaKata",
        "a30AmanKata",
        "a30PolaSasaran",
        "a30DepanMilikPihak",
        "a30PotonganDepan",
        "a30BentukNamaPihak",
        "a30SamarkanSisaRtf",
        "a30PeriksaAnonim",
      ].map((n) => potongFungsi(isi, n)),
      "this.__uji = { a30TeksRtf, a30SamarkanSisaRtf, a30PeriksaAnonim, a30BentukNamaPihak, a30PotonganDepan };",
    ].join("\n"),
    k
  );
  return k.__uji as {
    a30TeksRtf: (rtf: string) => string;
    a30SamarkanSisaRtf: (rtf: string, data: unknown) => { rtf: string; diganti: Array<{ jenis: string; kata: string }> };
    a30PeriksaAnonim: (teks: string, data: unknown) => { temuan: Array<{ jenis: string; kata: string }> };
    a30BentukNamaPihak: (nama: string) => { utuh: string; ruas: string[]; diri: string[] };
    a30PotonganDepan: (diri: string) => Array<{ teks: string; lanjut: string }>;
  };
}

/** Sasaran seperti tambahNama di a30DataPribadiHalaman (tanpa DOM). */
function sasaranNama(f: ReturnType<typeof muatPenyamar>, nama: string[]) {
  const peta = new Map<string, Record<string, unknown>>();
  for (const n of nama) {
    peta.set(n.toLowerCase(), { teks: n, dari: "SIPP" });
    const b = f.a30BentukNamaPihak(n);
    for (const x of b.ruas.concat(b.diri)) if (!peta.has(x.toLowerCase())) peta.set(x.toLowerCase(), { teks: x, dari: "SIPP" });
    for (const d of b.diri)
      for (const p of f.a30PotonganDepan(d))
        if (!peta.has(p.teks.toLowerCase())) peta.set(`depan:${p.teks.toLowerCase()}`, { teks: p.teks, dari: "SIPP", depan: true, lanjut: p.lanjut });
  }
  return { nama: Array.from(peta.values()), alamat: [] };
}

const NOMOR = "564/Pdt.G/2026/PA.Dgl";
const P1 = "Wulansari Pratiwi alias Wulan Sari Pratiwi binti Asman Y";
const P2 = "Musliadi Lahama bin Rasyid";

function rtfPutusan(p1 = P1, p2 = P2): string {
  return (
    `{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\pard PUTUSAN\\par Nomor ${NOMOR}\\par ` +
    `${p1}, sebagai Penggugat;\\par melawan\\par ${p2}, sebagai Tergugat;\\par ` +
    "Bukti surat: 1. {\\b Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama WULANSARI PRATIWI, NIK 7203000000000002 " +
    "tanggal 01 Agustus 2025}, bukti P.1;\\par " +
    "Bahwa saksi kenal dengan Tergugat sebagai suami Penggugat bernama Musliadi; sesuai Peraturan Mahkamah Agung;\\par " +
    "Bahwa saksi kedua bernama Musliadi Saleh, tetangga Penggugat;\\par " +
    `MENGADILI: 2. Menjatuhkan talak satu ba'in shughra Tergugat (${p2}) terhadap Penggugat (${p1});\\par ` +
    `Putusan Nomor ${NOMOR}\\par }`
  );
}
/** ABT: str_replace PERSIS atas nama SIPP utuh (models/abt/Anonimisasi.php). */
const lewatAbt = (rtf: string) => rtf.split(P1).join("PENGGUGAT").split(P2).join("TERGUGAT");
const bita = (s: string) => Uint8Array.from(Buffer.from(s, "latin1"));

// ============================================================================
describe("bentuk nama pihak - satu aturan untuk penyamar dan penjaga", () => {
  it("ruas sesudah 'alias' adalah nama orang itu bila ruas sebelumnya belum ber-bin/binti", () => {
    expect(bentukNamaPihak(P1)).toEqual({
      utuh: P1,
      ruas: ["Wulansari Pratiwi", "Wulan Sari Pratiwi binti Asman Y"],
      diri: ["Wulansari Pratiwi", "Wulan Sari Pratiwi"],
    });
  });

  it("'alias' sesudah bin/binti milik nama AYAH - tidak menjadi nama pihak", () => {
    expect(bentukNamaPihak("Mariani binti Safri alias Safri M. Arif").diri).toEqual(["Mariani"]);
    expect(bentukNamaPihak("Andi Rangga bin Topoi alias Petapoi").diri).toEqual(["Andi Rangga"]);
    expect(bentukNamaPihak("Wulandari binti Kartasasmita alias Wulan").diri).toEqual(["Wulandari"]);
  });

  it("nama lengkap kedua sesudah 'alias' (ber-binti) tetap nama orang itu", () => {
    expect(bentukNamaPihak("Nirmala binti Yasir alias Nirmala binti Jasir").diri).toEqual(["Nirmala"]);
    expect(bentukNamaPihak("Hermanto alias Herman bin Kasim").diri).toEqual(["Hermanto", "Herman"]);
  });

  it("nama diri di bawah empat huruf dibuang; tanpa alias = sebelum bin/binti", () => {
    expect(bentukNamaPihak("Ali alias Aliyudin bin Umar").diri).toEqual(["Aliyudin"]);
    expect(namaDiriPihak([P2, "Iwan bin Rasyid", "Iwan  bin  Rasyid"])).toEqual(["Musliadi Lahama", "Iwan"]);
  });

  it("salinan di ekstensi (a30BentukNamaPihak) SAMA dengan aturan server", () => {
    const f = muatPenyamar();
    const contoh = [
      P1,
      P2,
      "Mariani binti Safri alias Safri M. Arif",
      "Andi Rangga  bin Topoi alias Petapoi",
      "Nirmala binti Yasir alias Nirmala binti Jasir",
      "Hermanto alias Herman bin Kasim",
      "Ali alias Aliyudin bin Umar",
      "Selvi alias Selfi Ningsih binti Amir",
      "Masni alias masni binti lahadi",
      "Moh. Rizal",
      "",
    ];
    for (const n of contoh) expect(JSON.parse(JSON.stringify(f.a30BentukNamaPihak(n)))).toEqual(bentukNamaPihak(n));
  });
});

// ============================================================================
describe("penyamar ekstensi atas putusan berbentuk 564 (sesudah ABT)", () => {
  it("nama huruf besar tanpa alias dan NIK disamarkan; pemeriksa ekstensi & penjaga server bersih", async () => {
    const f = muatPenyamar();
    const data = sasaranNama(f, [P1, P2]);
    const samar = f.a30SamarkanSisaRtf(lewatAbt(rtfPutusan()), data);
    const teks = f.a30TeksRtf(samar.rtf);
    expect(teks).toContain("atas nama xxx, NIK xxxxxxxxxxxxxxxx tanggal");
    expect(teks).not.toMatch(/WULANSARI|7203000000000002/);
    expect(f.a30PeriksaAnonim(teks, data).temuan).toEqual([]);
    // Kode format RTF ({\b ...}) di sekitar nama tidak rusak.
    expect(samar.rtf).toContain("{\\b Fotokopi Kartu Tanda Penduduk");

    const { periksaBerkasUnggahSipp } = await import("@/server/modules/aleta-ecourt/unggah-naskah-putusan");
    const hasil = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas: [
        { slot: "putusan", bita: bita(rtfPutusan()) },
        { slot: "anonimisasi", bita: bita(samar.rtf) },
      ],
      namaPihak: [P1, P2],
    });
    expect(hasil.tolak).toBeNull();
  });

  it("potongan nama depan hanya sesudah 'bernama'; nama orang lain dan kata biasa utuh", () => {
    const f = muatPenyamar();
    const teks = f.a30TeksRtf(f.a30SamarkanSisaRtf(lewatAbt(rtfPutusan()), sasaranNama(f, [P1, P2])).rtf);
    expect(teks).toContain("suami Penggugat bernama xxx;");
    // "Musliadi Saleh" orang lain (kata berikutnya bukan "Lahama") - dibiarkan.
    expect(teks).toContain("bernama Musliadi Saleh, tetangga");
    expect(teks).toContain("Peraturan Mahkamah Agung");
  });

  it("audit 17 Okt: nama berapostrof (\\'92, \\rquote, ' polos, tanpa apostrof) disamarkan dan terbaca pemeriksa ekstensi", () => {
    const f = muatPenyamar();
    const nama = "Nur'aini binti Ma'ruf";
    const rtf =
      "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\pard PUTUSAN\\par " +
      "Nur\\'92aini, sebagai Penggugat;\\par Bahwa saksi kenal NUR{\\rquote}AINI;\\par " +
      "atas nama Nur'aini;\\par ditulis juga Nuraini;\\par }";
    const teksAsli = f.a30TeksRtf(rtf);
    expect(teksAsli).toContain("Nur’aini, sebagai");
    expect(teksAsli).toContain("NUR’AINI");
    const data = sasaranNama(f, [nama]);
    const teks = f.a30TeksRtf(f.a30SamarkanSisaRtf(rtf, data).rtf);
    expect(teks).not.toMatch(/nur.?aini/i);
    expect(f.a30PeriksaAnonim(teksAsli, data).temuan.some((x) => x.jenis === "nama pihak")).toBe(true);
  });

  it("audit 17 Okt: NIK/KK berpemisah disamarkan & dilaporkan di ekstensi; 15/17 angka dan telepon utuh", () => {
    const f = muatPenyamar();
    const rtf =
      "{\\rtf1\\ansi\\pard NIK 72.03.01.410190.0001;\\par KK 7203 0141 0190 0002;\\par NIK 7203-0141-0190-0003;\\par " +
      "angka 720301410190000 dan 72030141019000041;\\par telepon 0822-7111-5021\\par }";
    const data = { nama: [], alamat: [] };
    const teksAsli = f.a30TeksRtf(rtf);
    expect(f.a30PeriksaAnonim(teksAsli, data).temuan.filter((x) => x.jenis === "NIK")).toHaveLength(3);
    const teks = f.a30TeksRtf(f.a30SamarkanSisaRtf(rtf, data).rtf);
    expect(teks).toContain("NIK xxxxxxxxxxxxxxxx;");
    expect(teks).toContain("KK xxxxxxxxxxxxxxxx;");
    expect(teks).not.toMatch(/0190.?000[123]/);
    expect(teks).toContain("720301410190000 dan 72030141019000041");
    expect(teks).toContain("0822-7111-5021");
  });

  it("SEBELUM perbaikan (sasaran hanya dipotong di bin/binti) nama itu lolos - sebab penolakan 564", async () => {
    const f = muatPenyamar();
    const lama = { nama: [{ teks: P1, dari: "SIPP" }, { teks: "Wulansari Pratiwi alias Wulan Sari Pratiwi", dari: "SIPP" }], alamat: [] };
    const samar = f.a30SamarkanSisaRtf(lewatAbt(rtfPutusan()), lama);
    const teks = f.a30TeksRtf(samar.rtf);
    expect(teks).toContain("atas nama WULANSARI PRATIWI");
    expect(f.a30PeriksaAnonim(teks, lama).temuan.filter((x) => x.jenis === "nama pihak")).toEqual([]);
    const { periksaBerkasUnggahSipp } = await import("@/server/modules/aleta-ecourt/unggah-naskah-putusan");
    const hasil = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas: [
        { slot: "putusan", bita: bita(rtfPutusan()) },
        { slot: "anonimisasi", bita: bita(samar.rtf) },
      ],
      namaPihak: [P1, P2],
    });
    expect(hasil.tolak).toMatchObject({ alasan: "slot_anonim_memuat_nama", nama: ["Wulansari Pratiwi"], bolehTetapUnggah: true });
  });
});

// ============================================================================
describe("nilaiPenyamaran dan 'Tetap unggah' di penjaga server", () => {
  const sebagian = () => lewatAbt(rtfPutusan()); // ABT saja: nama utuh tersamar, "WULANSARI PRATIWI" tersisa

  it("dengan putusan pembanding: sebagian tersamar = ada; isi sama = tidak ada", () => {
    const teksAsli = "Wulansari Pratiwi binti Asman Y melawan Musliadi Lahama; Wulansari Pratiwi";
    expect(nilaiPenyamaran({ teksAnonim: "xxx melawan xxx; Wulansari Pratiwi", teksPutusan: teksAsli, namaPihak: [P1, P2] })).toMatchObject({
      ada: true,
      dasar: "pembanding",
      namaDiPutusan: 3,
      namaDiAnonim: 1,
    });
    expect(nilaiPenyamaran({ teksAnonim: teksAsli, teksPutusan: teksAsli, namaPihak: [P1, P2] }).ada).toBe(false);
  });

  it("tanpa pembanding: harus ada tanda samaran 'xxx'", () => {
    expect(nilaiPenyamaran({ teksAnonim: "Wulansari Pratiwi, alamat xxxx", namaPihak: [P1] })).toMatchObject({ ada: true, dasar: "tanda" });
    expect(nilaiPenyamaran({ teksAnonim: "Wulansari Pratiwi", namaPihak: [P1] }).ada).toBe(false);
  });

  it("sisa sebagian + nama yang sudah dilihat petugas -> lolos dengan catatan tetapUnggah", async () => {
    const { periksaBerkasUnggahSipp } = await import("@/server/modules/aleta-ecourt/unggah-naskah-putusan");
    const berkas = [
      { slot: "putusan" as const, bita: bita(rtfPutusan()) },
      { slot: "anonimisasi" as const, bita: bita(sebagian()) },
    ];
    const tanpa = periksaBerkasUnggahSipp({ nomorPerkara: NOMOR, berkas, namaPihak: [P1, P2] });
    expect(tanpa.tolak).toMatchObject({ alasan: "slot_anonim_memuat_nama", bolehTetapUnggah: true });
    expect(tanpa.tolak?.sebab).toContain('"Tetap unggah"');

    const tetap = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas,
      namaPihak: [P1, P2],
      tetapUnggah: { nama: ["WULANSARI PRATIWI", "Musliadi"] },
    });
    expect(tetap.tolak).toBeNull();
    expect(tetap.tetapUnggah?.nama).toEqual(["Wulansari Pratiwi"]);
    expect(tetap.peringatan.join(" ")).toContain("Tetap diunggah atas keputusan petugas");
  });

  it("nama yang BELUM dilihat petugas tidak ikut lolos", async () => {
    const { periksaBerkasUnggahSipp } = await import("@/server/modules/aleta-ecourt/unggah-naskah-putusan");
    const hasil = periksaBerkasUnggahSipp({
      nomorPerkara: NOMOR,
      berkas: [
        { slot: "putusan", bita: bita(rtfPutusan()) },
        { slot: "anonimisasi", bita: bita(sebagian()) },
      ],
      namaPihak: [P1, P2],
      tetapUnggah: { nama: ["Musliadi"] },
    });
    expect(hasil.tolak).toMatchObject({ alasan: "slot_anonim_memuat_nama", bolehTetapUnggah: true });
  });

  it("putusan ASLI di slot anonimisasi tetap ditolak walau 'Tetap unggah' dikirim", async () => {
    const { periksaBerkasUnggahSipp } = await import("@/server/modules/aleta-ecourt/unggah-naskah-putusan");
    for (const berkas of [
      [
        { slot: "putusan" as const, bita: bita(rtfPutusan()) },
        { slot: "anonimisasi" as const, bita: bita(rtfPutusan()) },
      ],
      [{ slot: "anonimisasi" as const, bita: bita(rtfPutusan()) }],
    ]) {
      const hasil = periksaBerkasUnggahSipp({
        nomorPerkara: NOMOR,
        berkas,
        namaPihak: [P1, P2],
        tetapUnggah: { nama: ["Wulansari Pratiwi", "Wulan Sari Pratiwi", "Musliadi Lahama"] },
      });
      expect(hasil.tolak).toMatchObject({ alasan: "slot_anonim_memuat_nama", bolehTetapUnggah: false });
      expect(hasil.tolak?.sebab).toContain("tidak satu pun nama pihak tersamar");
      expect(hasil.tetapUnggah).toBeUndefined();
    }
  });
});

// ============================================================================
// RUTE unggah-sipp: tetapUnggah=1 dicatat di jejak ALETA SEBELUM menulis ke SIPP
// ============================================================================
const keadaan = vi.hoisted(() => ({
  unggah: [] as Array<Record<string, unknown>>,
  jejak: [] as Array<Record<string, unknown>>,
  jejakGagal: false,
}));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/hak-putusan", () => ({
  pastikanBolehUnggahPutusan: async () => ({ actor: { id: "usr_uji", name: "Hakim Uji" }, peran: "hakim" }),
  bolehUnggahPutusan: () => true,
}));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/shared/ids", () => ({ nextPrefixedId: async () => "adt_uji" }));
vi.mock("@/server/shared/audit", () => ({
  appendAuditLog: async (_db: unknown, baris: Record<string, unknown>) => {
    if (keadaan.jejakGagal) throw new Error("basis data mati");
    keadaan.jejak.push(baris);
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  // 17 Okt (audit A4): hakim hanya perkara majelisnya.
  getGatewayUnggahMassalCek: async () => ({ ok: true, data: { ok: true, majelis: ["Hakim Uji"] } }),
  getGatewayStatusPerkara: async () => ({ ok: true, data: { identitas: { perkaraId: "10116" } } }),
  getGatewaySippKonteks: async () => ({
    ok: true,
    data: {
      nomorPihak: [
        { nama: P1, pihakKe: 1, jenis: "pihak" },
        { nama: P2, pihakKe: 2, jenis: "pihak" },
      ],
    },
  }),
  gatewayUnggahPutusanSipp: async (muatan: Record<string, unknown>) => {
    keadaan.unggah.push(muatan);
    return { ok: true, data: { ok: true, berkas: [{ jenis: "putusan", ok: true }, { jenis: "anonimisasi", ok: true }] } };
  },
}));
vi.mock("@/server/modules/aleta-ecourt/perakit-putusan", () => ({ simpanDraf: async () => ({ ok: true }) }));

function permintaan(anonim: string, lain: Record<string, string> = {}) {
  const borang = new FormData();
  borang.append("nomorPerkara", NOMOR);
  borang.append("olehUsername", "pp.uji");
  borang.append("putusan", new File([bita(rtfPutusan())], "putusan.rtf"));
  borang.append("anonimisasi", new File([bita(anonim)], "anonim.rtf"));
  for (const [k, v] of Object.entries(lain)) borang.append(k, v);
  return new Request("http://uji.local/aleta/api/aleta-ecourt/putusan/unggah-sipp", { method: "POST", body: borang });
}
async function jalankan(p: Request) {
  const mod = await import("@/app/api/aleta-ecourt/putusan/unggah-sipp/route");
  const jawab = await mod.POST(p as unknown as Parameters<typeof mod.POST>[0]);
  return { status: jawab.status, badan: (await jawab.json()) as Record<string, any> };
}

describe("rute unggah-sipp - 'Tetap unggah'", () => {
  beforeEach(() => {
    keadaan.unggah = [];
    keadaan.jejak = [];
    keadaan.jejakGagal = false;
  });

  it("tanpa tetapUnggah: 409 berisi bolehTetapUnggah & nama; tidak ada yang dikirim ke SIPP", async () => {
    const { status, badan } = await jalankan(permintaan(lewatAbt(rtfPutusan())));
    expect(status).toBe(409);
    expect(badan.data).toMatchObject({ alasan: "slot_anonim_memuat_nama", bolehTetapUnggah: true, nama: ["Wulansari Pratiwi"] });
    expect(keadaan.unggah).toHaveLength(0);
    expect(keadaan.jejak).toHaveLength(0);
  });

  it("tetapUnggah=1: jejak ALETA dicatat (siapa, nama tersisa), LALU kedua berkas dikirim", async () => {
    const { status, badan } = await jalankan(
      permintaan(lewatAbt(rtfPutusan()), { tetapUnggah: "1", tetapUnggahNama: JSON.stringify(["Wulansari Pratiwi"]) })
    );
    expect(status).toBe(200);
    expect(badan.data.tetapUnggah).toEqual({ nama: ["Wulansari Pratiwi"] });
    expect(keadaan.jejak).toHaveLength(1);
    expect(keadaan.jejak[0]).toMatchObject({
      action: "PUTUSAN_ANONIM_TETAP_UNGGAH",
      actorUserId: "usr_uji",
      entityId: NOMOR,
      payload: { namaTersisa: ["Wulansari Pratiwi"], oleh: "Hakim Uji", peran: "hakim", akunSipp: "pp.uji" },
    });
    expect(keadaan.unggah).toHaveLength(1);
    expect(keadaan.unggah[0]).toHaveProperty("anonimisasiBase64");
    expect(keadaan.unggah[0]).toHaveProperty("putusanBase64");
  });

  it("jejak gagal dicatat: unggahan TIDAK dijalankan", async () => {
    keadaan.jejakGagal = true;
    const { status, badan } = await jalankan(
      permintaan(lewatAbt(rtfPutusan()), { tetapUnggah: "1", tetapUnggahNama: JSON.stringify(["Wulansari Pratiwi"]) })
    );
    expect(status).toBe(200);
    expect(badan.data).toMatchObject({ ok: false, alasan: "jejak_gagal" });
    expect(keadaan.unggah).toHaveLength(0);
  });

  it("putusan asli di slot anonimisasi + tetapUnggah=1: tetap 409, tanpa jejak, tanpa kiriman", async () => {
    const { status, badan } = await jalankan(
      permintaan(rtfPutusan(), { tetapUnggah: "1", tetapUnggahNama: JSON.stringify(["Wulansari Pratiwi", "Musliadi Lahama"]) })
    );
    expect(status).toBe(409);
    expect(badan.data.bolehTetapUnggah).toBe(false);
    expect(keadaan.unggah).toHaveLength(0);
    expect(keadaan.jejak).toHaveLength(0);
  });
});

// ============================================================================
// EKSTENSI: tombol "Tetap unggah" sesudah penolakan server
// ============================================================================
const halaman: JSDOM[] = [];
afterEach(() => {
  while (halaman.length) halaman.pop()!.window.close();
});

function muatKirim(jawaban: Array<{ status: number; badan: unknown }>) {
  const isi = konten();
  const dom = new JSDOM("<!doctype html><html><body><div id='wadah'></div><div id='kabar'></div></body></html>");
  halaman.push(dom);
  const kiriman: Array<Record<string, string>> = [];
  const k: Record<string, unknown> = {
    document: dom.window.document,
    FormData,
    alatPesanGagal: (_g: unknown, status: number, apa: string) => `${apa} gagal: ${status}.`,
    alatCatat: () => undefined,
    alatAmbil: async (_a: string, opsi: { body: FormData }) => {
      const salin: Record<string, string> = {};
      for (const [kunci, nilai] of opsi.body.entries()) salin[kunci] = typeof nilai === "string" ? nilai : "(berkas)";
      kiriman.push(salin);
      const j = jawaban.shift()!;
      return { ok: j.status < 400, status: j.status, json: async () => j.badan };
    },
  };
  vm.createContext(k);
  vm.runInContext(
    [
      tetapan(isi, "ALETA_API_UNGGAH_SIPP"),
      tetapan(isi, "BATAS_UNGGAH_SIPP_MS"),
      ...["buatElemen", "a30Tanya", "kirimBadanUnggahSipp", "kirimUnggahSippTetap"].map((n) => potongFungsi(isi, n)),
      "this.__uji = { kirimUnggahSippTetap };",
    ].join("\n"),
    k
  );
  const d = dom.window.document;
  return {
    d,
    kiriman,
    kirim: (k.__uji as { kirimUnggahSippTetap: (b: FormData, ms: number, o: unknown) => Promise<any> }).kirimUnggahSippTetap,
    wadah: d.getElementById("wadah")!,
    kabar: d.getElementById("kabar")!,
  };
}
const tolak409 = (boleh: boolean) => ({
  status: 409,
  badan: {
    ok: false,
    error: { message: "Berkas anonimisasi masih memuat nama pihak: Wulansari Pratiwi." },
    data: { ok: false, alasan: "slot_anonim_memuat_nama", slot: "anonimisasi", nama: ["Wulansari Pratiwi"], bolehTetapUnggah: boleh, sebab: "Berkas anonimisasi masih memuat nama pihak: Wulansari Pratiwi." },
  },
});
const tunggu = () => new Promise((r) => setTimeout(r, 0));

describe("ekstensi: kirimUnggahSippTetap", () => {
  it("409 yang membolehkan: daftar sisa + 'Tetap unggah' (centang wajib) -> dikirim ulang dengan tetapUnggah=1", async () => {
    const h = muatKirim([tolak409(true), { status: 200, badan: { data: { ok: true, berkas: [] } } }]);
    const badan = new FormData();
    badan.append("nomorPerkara", NOMOR);
    const janji = h.kirim(badan, 1000, { wadah: h.wadah, kabar: h.kabar });
    await tunggu();
    await tunggu();
    const kartu = h.wadah.querySelector(".aleta-a30-tanya")!;
    expect(kartu).not.toBeNull();
    expect(kartu.textContent).toContain('nama pihak "Wulansari Pratiwi" masih tertulis');
    expect(kartu.textContent).toContain("TERBIT di Direktori Putusan");
    const ya = kartu.querySelector(".aleta-a30-tanya-ya") as HTMLButtonElement;
    expect(ya.textContent).toBe("Tetap unggah");
    expect(ya.disabled).toBe(true);
    const cek = kartu.querySelector("input[type=checkbox]") as HTMLInputElement;
    cek.checked = true;
    cek.dispatchEvent(new h.d.defaultView!.Event("change"));
    ya.click();
    const jawab = await janji;
    expect(jawab.ok).toBe(true);
    expect(h.kiriman).toHaveLength(2);
    expect(h.kiriman[0]).not.toHaveProperty("tetapUnggah");
    expect(h.kiriman[1]).toMatchObject({ tetapUnggah: "1", tetapUnggahNama: JSON.stringify(["Wulansari Pratiwi"]) });
  });

  it("dibatalkan: galat aslinya dilempar, tidak ada kiriman kedua", async () => {
    const h = muatKirim([tolak409(true)]);
    const janji = h.kirim(new FormData(), 1000, { wadah: h.wadah, kabar: h.kabar });
    await tunggu();
    await tunggu();
    (h.wadah.querySelector(".aleta-a30-tanya-tidak") as HTMLButtonElement).click();
    await expect(janji).rejects.toThrow("masih memuat nama pihak");
    expect(h.kiriman).toHaveLength(1);
  });

  it("tanpa penyamaran (bolehTetapUnggah salah): TIDAK ada tombol, langsung gagal", async () => {
    const h = muatKirim([tolak409(false)]);
    await expect(h.kirim(new FormData(), 1000, { wadah: h.wadah, kabar: h.kabar })).rejects.toThrow("masih memuat nama pihak");
    expect(h.wadah.querySelector(".aleta-a30-tanya")).toBeNull();
    expect(h.kiriman).toHaveLength(1);
  });

  it("nama yang sudah direlakan di dialog pemeriksa diteruskan sejak kiriman pertama", async () => {
    const h = muatKirim([{ status: 200, badan: { data: { ok: true, berkas: [] } } }]);
    await h.kirim(new FormData(), 1000, { tetapUnggah: { nama: ["WULANSARI PRATIWI"] }, wadah: h.wadah });
    expect(h.kiriman[0]).toMatchObject({ tetapUnggah: "1", tetapUnggahNama: JSON.stringify(["WULANSARI PRATIWI"]) });
  });
});
