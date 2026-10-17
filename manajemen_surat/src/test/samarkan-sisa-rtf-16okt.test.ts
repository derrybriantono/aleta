// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { bacaRtfDariBita } from "@/lib/baca-rtf";
import { samarkanSisaBilaTersamar, samarkanSisaRtf, sasaranNamaPihak } from "@/lib/samarkan-sisa-rtf";

/**
 * ============================================================================
 * F1.2 (16 Okt 2026) - SISA NAMA PADA ANONIMISASI ABT DISAMARKAN DI RUTE unggah-sipp
 * ============================================================================
 *
 * Diukur atas 251 pasangan putusan+anonimisasi yang SUDAH diunggah petugas (2025-2026,
 * PA Donggala, salinan baca-saja): penjaga rute menolak 135 (54%) - 112 karena sisa
 * sebagian (nasab anak "bin <nama pihak>", keterangan saksi, bukti), 22 karena tidak ada
 * yang tersamar sama sekali (putusan asli di slot anonimisasi), 1 nomor perkara berbeda.
 * Sesudah penyamaran sisa (hanya pada yang sudah tersamar sebagian): 229 lolos + 22 tetap
 * ditolak ("tampaknya putusan asli") + 1 nomor berbeda. Alur Putusan otomatis di halaman SIPP
 * sudah menyamarkan sisa itu di peramban (a30SamarkanSisaRtf); alur putusan massal di ABT
 * tidak - kini rute yang melakukannya, dengan aturan yang SATU (uji ini mengadu keduanya).
 *
 * Nama di uji ini karangan; NIK karangan.
 */

const AKAR = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(AKAR, berkas), "utf8").replace(/\r\n/g, "\n");

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

/** Penyamar ekstensi yang SUNGGUHAN (konten.js), untuk diadu dengan versi server. */
function muatPenyamarEkstensi() {
  const isi = baca("konten.js");
  const k: Record<string, unknown> = {};
  vm.createContext(k);
  vm.runInContext(
    [
      tetapan(isi, "A30_BUKAN_SAMARAN"),
      ...[
        "a30PetaRtf",
        "a30PolaKata",
        "a30AmanKata",
        "a30PolaSasaran",
        "a30DepanMilikPihak",
        "a30PotonganDepan",
        "a30BentukNamaPihak",
        "a30SamarkanSisaRtf",
      ].map((n) => potongFungsi(isi, n)),
      "this.__uji = { a30SamarkanSisaRtf, a30BentukNamaPihak, a30PotonganDepan };",
    ].join("\n"),
    k
  );
  return k.__uji as {
    a30SamarkanSisaRtf: (rtf: string, data: unknown) => { rtf: string; diganti: Array<{ jenis: string; kata: string; menjadi: string }> };
    a30BentukNamaPihak: (nama: string) => { utuh: string; ruas: string[]; diri: string[] };
    a30PotonganDepan: (diri: string) => Array<{ teks: string; lanjut: string }>;
  };
}

/** Data seperti a30DataPribadiHalaman.tambahNama (tanpa DOM). */
function dataEkstensi(f: ReturnType<typeof muatPenyamarEkstensi>, nama: string[]) {
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

const NOMOR = "611/Pdt.G/2026/PA.Dgl";
const P1 = "Melki Saputra bin Ardan";
const P2 = "Wulandari Pratiwi binti Hasan";

/** RTF uji: nasab anak, saksi, bukti P.1, kurung, NIK, huruf terpotong format. */
function rtf(p1 = P1, p2 = P2): string {
  return (
    "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\pard PUTUSAN\\par Nomor " +
    NOMOR +
    "\\par " +
    `${p1}, sebagai Tergugat;\\par melawan\\par ${p2}, sebagai Penggugat;\\par ` +
    "Bahwa Penggugat dan Tergugat dikaruniai anak bernama Rasya Saputra bin Melki Saputra, umur 17 tahun;\\par " +
    "Bahwa saksi kenal dengan Tergugat sebagai ipar saksi bernama Melki;\\par " +
    "Bukti P.1 KTP-el atas nama WULANDARI PRATIWI, NIK 7203000000000002, bukti P.1;\\par " +
    "Bahwa Tergugat {\\b Mel}{\\b0 ki Saputra} pergi sejak 2024;\\par " +
    `MENGADILI: 2. Menjatuhkan talak satu ba'in shughra Tergugat (${p1}) terhadap Penggugat (${p2});\\par ` +
    "Putusan Nomor " +
    NOMOR +
    " dibacakan oleh Majelis Hakim Pengadilan Agama Donggala;\\par }"
  );
}
/** ABT: str_replace PERSIS atas nama SIPP utuh (models/abt/Anonimisasi.php). */
const lewatAbt = (s: string) => s.split(P1).join("TERGUGAT").split(P2).join("PENGGUGAT");
const bita = (s: string) => Uint8Array.from(Buffer.from(s, "latin1"));
const teks = (b: Uint8Array) => bacaRtfDariBita(b);

describe("penyamar sisi server = penyamar ekstensi (aturan satu)", () => {
  const f = muatPenyamarEkstensi();
  const masukan = [rtf(), lewatAbt(rtf()), rtf("Almaningsi Astuti alias Alma Ningsi Astuti binti Asmin Y", "Musliadi Lahama bin Rasyid")];
  const nama = [[P1, P2], [P1, P2], ["Almaningsi Astuti alias Alma Ningsi Astuti binti Asmin Y", "Musliadi Lahama bin Rasyid"]];

  it.each([0, 1, 2])("masukan %i: RTF hasil dan daftar yang diganti sama persis", (i) => {
    const lokal = f.a30SamarkanSisaRtf(masukan[i], dataEkstensi(f, nama[i]));
    const server = samarkanSisaRtf(masukan[i], nama[i], { nik: true });
    expect(server.rtf).toBe(lokal.rtf);
    expect(server.diganti.map((x) => `${x.jenis}|${x.kata}|${x.menjadi}`)).toEqual(lokal.diganti.map((x) => `${x.jenis}|${x.kata}|${x.menjadi}`));
  });

  it("sasaran nama sama dengan tambahNama ekstensi (ruas, nama diri, potongan depan)", () => {
    const server = sasaranNamaPihak([P1, P2]).map((x) => `${x.depan ? "depan:" : ""}${x.teks}`);
    const lokal = dataEkstensi(f, [P1, P2]).nama.map((x) => `${x.depan ? "depan:" : ""}${x.teks}`);
    expect(new Set(server)).toEqual(new Set(lokal));
  });
});

describe("samarkanSisaRtf - kasus yang diukur", () => {
  it("nasab anak, keterangan saksi, nama terpotong format, bukti P.1, dan NIK disamarkan; nomor dan majelis utuh", () => {
    const hasil = samarkanSisaRtf(lewatAbt(rtf()), [P1, P2]);
    const t = bacaRtfDariBita(bita(hasil.rtf));
    expect(t).not.toMatch(/melki|wulandari/i);
    // Nasab: yang disamarkan nama pihak ("Melki Saputra"); nama anak ("Rasya Saputra") bukan sasaran penyamar ini.
    expect(t).toContain("anak bernama Rasya Saputra bin xxx");
    expect(t).toContain("ipar saksi bernama xxx;");
    expect(t).toContain("Bahwa Tergugat xxx pergi");
    expect(t).toContain("NIK xxxxxxxxxxxxxxxx");
    expect(t).toContain(NOMOR);
    expect(t).toContain("Majelis Hakim Pengadilan Agama Donggala");
  });

  it("nama dalam kurung tunggal menjadi '( xxx )'; di luar kurung 'xxx'", () => {
    const hasil = samarkanSisaRtf("{\\rtf1 Menjatuhkan talak (Melki Saputra bin Ardan) terhadap Penggugat. Lalu Melki Saputra bin Ardan hadir.\\par }", [P1]);
    expect(bacaRtfDariBita(bita(hasil.rtf))).toContain("talak ( xxx ) terhadap");
    expect(bacaRtfDariBita(bita(hasil.rtf))).toContain("Lalu xxx hadir");
  });

  it("potongan depan HANYA sesudah 'bernama'; 'Melki' lepas tidak disamarkan", () => {
    const hasil = samarkanSisaRtf("{\\rtf1 Tergugat bernama Melki Saputra bin Ardan. Ipar saksi bernama Melki. Pak Melki datang.\\par }", ["Melki Saputra bin Ardan"]);
    const t = bacaRtfDariBita(bita(hasil.rtf));
    expect(t).toContain("Ipar saksi bernama xxx.");
    expect(t).toContain("Pak Melki datang."); // tidak sesudah 'bernama'
  });

  it("jabatan dan kata umum yang kebetulan nama tidak disamarkan", () => {
    const hasil = samarkanSisaRtf("{\\rtf1 Majelis Hakim memutus. Penggugat hadir.\\par }", ["Hakim Penggugat"]);
    expect(hasil.diganti).toEqual([]);
  });

  it("RTF hasil tetap sah: awalan {\\rtf, kurung kurawal seimbang", () => {
    const hasil = samarkanSisaRtf(lewatAbt(rtf()), [P1, P2]).rtf;
    expect(hasil.startsWith("{\\rtf1")).toBe(true);
    let a = 0;
    for (let i = 0; i < hasil.length; i += 1) {
      if (hasil[i] === "\\") {
        i += 1;
        continue;
      }
      if (hasil[i] === "{") a += 1;
      else if (hasil[i] === "}") a -= 1;
    }
    expect(a).toBe(0);
  });

  it("tanpa yang disamarkan: RTF dikembalikan APA ADANYA", () => {
    const asal = "{\\rtf1 Tidak ada nama di sini.\\par }";
    const hasil = samarkanSisaRtf(asal, [P1, P2], { nik: false });
    expect(hasil).toEqual({ rtf: asal, diganti: [] });
  });
});

describe("samarkanSisaBilaTersamar - hanya bila ABT sudah menyamarkan sebagian", () => {
  it("anonimisasi ABT (sebagian tersamar): sisa disamarkan", () => {
    const hasil = samarkanSisaBilaTersamar({ anonim: bita(lewatAbt(rtf())), putusan: bita(rtf()), namaPihak: [P1, P2] });
    expect(hasil.dilewati).toBe("");
    expect(hasil.diganti.length).toBeGreaterThan(0);
    expect(teks(hasil.bita)).not.toMatch(/melki|wulandari/i);
  });

  it("putusan asli di slot anonimisasi (tidak tersamar sama sekali): DIBIARKAN, supaya penjaga menolaknya", () => {
    const hasil = samarkanSisaBilaTersamar({ anonim: bita(rtf()), putusan: bita(rtf()), namaPihak: [P1, P2] });
    expect(hasil.dilewati).toBe("belum_tersamar");
    expect(hasil.diganti).toEqual([]);
    expect(teks(hasil.bita)).toContain("Melki Saputra");
  });

  it("bukan RTF: dilewati", () => {
    const pdf = Uint8Array.from(Buffer.from("%PDF-1.4 ...", "latin1"));
    expect(samarkanSisaBilaTersamar({ anonim: pdf, putusan: null, namaPihak: [P1] }).dilewati).toBe("bukan_rtf");
  });

  it("tanpa putusan pembanding: bukti 'xxx' dari penyamar ABT cukup", () => {
    const hasil = samarkanSisaBilaTersamar({ anonim: bita(lewatAbt(rtf()).replace("TERGUGAT, sebagai", "xxx, sebagai")), putusan: null, namaPihak: [P1, P2] });
    expect(hasil.dilewati).toBe("");
  });
});

// ============================================================================
// RUTE unggah-sipp: samarkanSisa=1
// ============================================================================
const keadaan = vi.hoisted(() => ({ unggah: [] as Array<Record<string, any>>, jejak: [] as Array<Record<string, unknown>> }));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/hak-putusan", () => ({
  pastikanBolehUnggahPutusan: async () => ({ actor: { id: "usr_uji", name: "Hakim Uji" }, peran: "hakim" }),
  // Audit 17 Okt: majelis hakim diuji di hak-unggah-putusan-9okt.
  pastikanMajelisPutusan: async () => undefined,
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
    keadaan.jejak.push(baris);
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  // 17 Okt (audit A4): hakim hanya perkara majelisnya.
  getGatewayUnggahMassalCek: async () => ({ ok: true, data: { ok: true, majelis: ["Hakim Uji"] } }),
  getGatewayStatusPerkara: async () => ({ ok: true, data: { identitas: { perkaraId: "10164" } } }),
  getGatewaySippKonteks: async () => ({
    ok: true,
    data: {
      nomorPihak: [
        { nama: "Melki Saputra bin Ardan", pihakKe: 2, jenis: "pihak" },
        { nama: "Wulandari Pratiwi binti Hasan", pihakKe: 1, jenis: "pihak" },
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
  borang.append("putusan", new File([bita(rtf())], "putusan.rtf"));
  borang.append("anonimisasi", new File([bita(anonim)], "anonim.rtf"));
  for (const [k, v] of Object.entries(lain)) borang.append(k, v);
  return new Request("http://uji.local/aleta/api/aleta-ecourt/putusan/unggah-sipp", { method: "POST", body: borang });
}
async function jalankan(p: Request) {
  const mod = await import("@/app/api/aleta-ecourt/putusan/unggah-sipp/route");
  const jawab = await mod.POST(p as unknown as Parameters<typeof mod.POST>[0]);
  return { status: jawab.status, badan: (await jawab.json()) as Record<string, any> };
}

describe("rute unggah-sipp - samarkanSisa", () => {
  beforeEach(() => {
    keadaan.unggah = [];
    keadaan.jejak = [];
  });

  it("tanpa samarkanSisa: sisa nama menolak 409 seperti semula (kemunduran dijaga)", async () => {
    const { status, badan } = await jalankan(permintaan(lewatAbt(rtf())));
    expect(status).toBe(409);
    expect(badan.data).toMatchObject({ alasan: "slot_anonim_memuat_nama", bolehTetapUnggah: true });
    expect(keadaan.unggah).toHaveLength(0);
  });

  it("samarkanSisa=1: sisa disamarkan, kedua berkas dikirim ke SIPP, anonimisasi yang dikirim BERSIH, putusan asli utuh", async () => {
    const { status, badan } = await jalankan(permintaan(lewatAbt(rtf()), { samarkanSisa: "1" }));
    expect(status).toBe(200);
    expect(badan.data.ok).toBe(true);
    expect(badan.data.disamarkan.jumlah).toBeGreaterThan(0);
    expect(badan.data.disamarkan.nik).toBe(1);
    expect(JSON.stringify(badan.data)).not.toMatch(/melki|wulandari/i); // tidak ada nama dalam jawaban
    expect(badan.data.peringatan.join(" ")).toContain("menyamarkan");
    expect(keadaan.unggah).toHaveLength(1);
    const anonim = Uint8Array.from(Buffer.from(keadaan.unggah[0].anonimisasiBase64, "base64"));
    const putusan = Uint8Array.from(Buffer.from(keadaan.unggah[0].putusanBase64, "base64"));
    expect(teks(anonim)).not.toMatch(/melki|wulandari|7203000000000002/i);
    expect(teks(anonim)).toContain("xxx");
    expect(teks(putusan)).toContain("Melki Saputra"); // putusan asli tidak diubah
    expect(teks(putusan)).toContain("7203000000000002");
  });

  it("samarkanSisa=1 tetapi putusan asli salah ditaruh di slot anonimisasi: tetap 409, tidak ada kiriman", async () => {
    const { status, badan } = await jalankan(permintaan(rtf(), { samarkanSisa: "1" }));
    expect(status).toBe(409);
    expect(badan.data.bolehTetapUnggah).toBe(false);
    expect(keadaan.unggah).toHaveLength(0);
  });

  it("samarkanSisa=1 pada anonimisasi yang sudah bersih: tidak ada yang diubah, jawaban tanpa 'disamarkan'", async () => {
    const bersih = lewatAbt(rtf()).replace(/Rasya Saputra bin Melki Saputra/, "A bin xxx").replace(/bernama Melki;/, "bernama xxx;").replace(/\{\\b Mel\}\{\\b0 ki Saputra\}/, "xxx").replace(/WULANDARI PRATIWI/, "xxx").replace("7203000000000002", "xxxxxxxxxxxxxxxx");
    const { status, badan } = await jalankan(permintaan(bersih, { samarkanSisa: "1" }));
    expect(status).toBe(200);
    expect(badan.data.disamarkan).toBeUndefined();
  });
});

// ============================================================================
// EKSTENSI abt.js: meminta penyamaran sisa pada anonimisasi
// ============================================================================
describe("abt.js - putusan massal meminta penyamaran sisa", () => {
  const abt = baca("abt.js");

  it("kiriman unggah-sipp ABT membawa samarkanSisa=1 hanya bila ada anonimisasi", () => {
    const awal = abt.indexOf("async function kirimUnggahSippAbt(");
    const akhir = abt.indexOf("\n}\n", awal);
    const fungsi = abt.slice(awal, akhir);
    expect(fungsi).toMatch(/if \(denganAnonim\) \{[\s\S]*badan\.append\("samarkanSisa", "1"\)/);
    expect(fungsi.indexOf('badan.append("samarkanSisa"')).toBeGreaterThan(fungsi.indexOf("if (denganAnonim)"));
  });

  it("ringkasan perkara menyebut jumlah yang disamarkan (tanpa nama)", () => {
    const k: Record<string, unknown> = {};
    vm.createContext(k);
    vm.runInContext(`${potongFungsi(abt, "kalimatSisaDisamarkan")}\nthis.__f = kalimatSisaDisamarkan;`, k);
    const f = k.__f as (j: unknown) => string;
    expect(f({ disamarkan: { jumlah: 5, nama: 4, nik: 1 } })).toBe(
      "ALETA menyamarkan 4 sisa nama pihak dan 1 NIK yang ditinggalkan ABT pada salinan anonimisasi (putusan asli tidak diubah)"
    );
    expect(f({ disamarkan: { jumlah: 0 } })).toBe("");
    expect(f({})).toBe("");
    expect(f(null)).toBe("");
  });
});
