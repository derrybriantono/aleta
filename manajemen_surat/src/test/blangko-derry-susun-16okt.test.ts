/**
 * ============================================================================
 * 16 OKT 2026 - BAHAN "PERLU DIISI" BLANGKO ABT BY DERRY BRIANTONO (TAHAP F)
 * ============================================================================
 *
 * A. susun.ts (murni): penanda RTF x katalog -> isian tangan sungguhan
 *    (data_teks/data_tanggal/tanya_jawab) termasuk yang hanya dibaca variabel
 *    lain, isian berpemicu (#11111# kuasa P, #11112# prodeo, #11116# C,
 *    #11117# H), isian pilihan "kosong = dari SIPP", label mudah, pilihan &
 *    saran, bukti P/T, pasangan tanya jawab per saksi, jenis folder, sebutan
 *    pihak, pencocokan folder.
 * B. GET /aleta-ecourt/blangko-derry: indeks folder (pohon, cadangan katalog),
 *    susunan dari blangko.baca + katalog hidup (abt.semuaVariabel, cadangan
 *    kamus), nilai per perkara dari abt.nilaiPenanda, 400 untuk masukan salah,
 *    kewenangan "panel"; tidak ada operasi tulis.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  folderPalingCocok,
  jenisFolderDerry,
  kunciTanyaJawab,
  rapikanNama,
  rujukan,
  sebutanPihak,
  susunIsian,
  type Definisi,
} from "@/app/api/aleta-ecourt/blangko-derry/susun";

const D = (kode: string, nama: string, jenis: string, sql = "", bawaan = ""): [string, Definisi] => [kode, { kode, nama, jenis, sql, bawaan }];
const KATALOG = new Map<string, Definisi>([
  D("0001", "No Perkara", "data_sipp"),
  D("0046", "Pemohon/ Penggugat", "data_sql", "select ..."),
  D("4001", "AMAR PUTUSAN CERAI UNIVERSAL", "data_sql", "select data from aps_badilag.abt_data_teks where no_var = '8503' and perkara_id=#perkara_id#"),
  D("8503", "ALASAN PERCERAIAN <br>SATU HURUF: A, B, C, D, E, F, G, H <br>GABUNGAN BEBAS", "data_teks"),
  D("8536", "Putusan pidana (khusus alasan C, tanpa kata salinan), contoh: ... #11116#", "data_teks"),
  D("0227", "Tanggal Fasakh / Murtad / Meninggalkan Agama #11117#", "data_tanggal"),
  D("0156", "Kantor Kuasa #0046# (nama kantor di surat kuasa/gugatan, mis. DERRY & PARTNERS) #11111#", "data_teks"),
  D("0184", "Tgl. Surat Kuasa #0046# #11111#", "data_tanggal"),
  D("8537", "Nama Advokat Kuasa #0046# (kosong = dari SIPP) #11111#", "data_teks"),
  D("0661", "No. SK Prodeo #11112#", "data_teks", "", "#0671#"),
  D("11111", "PENANDA ADA KUASA #0046#", "data_sql", "select ..."),
  D("11112", "PENANDA ADA PRODEO", "data_sql", "select ..."),
  D("11116", "PENANDA ALASAN C (8503)", "data_sql", "select ..."),
  D("11117", "PENANDA ALASAN H (8503)", "data_sql", "select ..."),
  D("11115", "Penanda KTP Elektronik #0047# / #0046# II", "data_teks"),
  D("1268", "Pernah/tidak di damaikan keluarga P dan T (Pilih diatas telah didamaikan kalo bawah sesuai gugatan)", "data_teks", "", "pihak keluarga telah berusaha untuk mendamaikan #0046# dan #0047#, namun tidak berhasil"),
  D("0007", "Telah Dikarunai Anak", "data_teks", "", "#8492#"),
  D("1214", "Alat-alat bukti CG/CT", "data_teks", "", "Fotokopi Kartu Tanda Penduduk Elektronik (KTP-el) atas nama #4048#"),
  D("9911", "C3 Pembuktian Tergugat", "data_teks"),
  D("2021", "Keterangan Saksi 1 P", "tanya_jawab"),
  D("5058", "TanyaJwb Saksi 1 P", "tanya_jawab"),
  D("2022", "Keterangan Saksi 2 P", "tanya_jawab"),
  D("5059", "TanyaJwb Saksi 2 P", "tanya_jawab"),
  D("6112", "Jawaban Lisan Tergugat", "tanya_jawab"),
  D("8505", "AMAR BIAYA PERKARA (PRODEO/TIDAK)", "data_sql", "select case when x then '#0661#' end"),
  D("0155", "Terbilang Biaya Perkara", "terbilang", "", "#0143#"),
  D("0143", "Total Biaya Perkara", "data_sql", "select ..."),
]);

describe("A. susunIsian", () => {
  it("isian tangan langsung di RTF dan yang hanya dibaca variabel lain; jenis & label mudah; tipe otomatis dipisah", () => {
    const h = susunIsian(["0001", "4001", "0046", "0007", "2021", "0155"], KATALOG);
    const kode = h.isian.map((b) => b.kode);
    // 8503 tidak ada di RTF tetapi dibaca #4001# lewat no_var = '8503'; 0007 langsung; 2021 tanya jawab.
    expect(kode).toEqual(expect.arrayContaining(["8503", "0007", "2021"]));
    const k8503 = h.isian.find((b) => b.kode === "8503")!;
    expect(k8503).toMatchObject({ jenis: "teks", nama: "Alasan perceraian", langsung: false, wajib: true, dipakaiOleh: ["4001"] });
    expect(k8503.pilihan.length).toBe(6);
    expect(k8503.saran).toMatch(/^F /);
    // Bawaan #8492# bukan saran literal; label ramah dari peta.
    expect(h.isian.find((b) => b.kode === "0007")).toMatchObject({ nama: "Anak dari pernikahan ini", saran: "belum dikaruniai anak", langsung: true, bawaan: "#8492#" });
    expect(h.otomatis.map((o) => o.kode)).toEqual(expect.arrayContaining(["0001", "4001", "0046", "0155", "0143"]));
    expect(h.otomatis.find((o) => o.kode === "0001")!.langsung).toBe(true);
    expect(h.otomatis.find((o) => o.kode === "0143")!.langsung).toBe(false);
    expect(h.takDikenal).toEqual([]);
  });

  it("isian berpemicu memuat kode pemicu dan keterangannya; penanda teknis & 'kosong = dari SIPP' bukan wajib", () => {
    const h = susunIsian(["0156", "0184", "8537", "0661", "8536", "0227", "11115", "8505"], KATALOG);
    const by = (k: string) => h.isian.find((b) => b.kode === k)!;
    expect(by("0156")).toMatchObject({ pemicu: "11111", nama: "Nama kantor advokat Penggugat/Pemohon", wajib: true });
    expect(by("0184")).toMatchObject({ pemicu: "11111", jenis: "tanggal" });
    expect(by("8537")).toMatchObject({ pemicu: "11111", wajib: false });
    expect(by("0661")).toMatchObject({ pemicu: "11112", wajib: true, dipakaiOleh: ["8505"] });
    expect(by("8536").pemicu).toBe("11116");
    expect(by("0227")).toMatchObject({ pemicu: "11117", jenis: "tanggal" });
    expect(by("11115").wajib).toBe(false);
    expect(h.pemicu.map((p) => p.kode)).toEqual(["11111", "11112", "11116", "11117"]);
    expect(h.pemicu.find((p) => p.kode === "11111")!.keterangan).toMatch(/kuasa hukum/);
    expect(h.pemicu.find((p) => p.kode === "11116")!.keterangan).toMatch(/huruf C/);
  });

  it("bukti P/T dikenali; tanya jawab satu tombol per saksi dengan kode penyunting TanyaJwb", () => {
    const h = susunIsian(["1214", "9911", "2021", "2022", "5058", "6112"], KATALOG);
    expect(h.isian.find((b) => b.kode === "1214")).toMatchObject({ khusus: "bukti", pihak: "P", nama: "Alat bukti surat Penggugat/Pemohon" });
    expect(h.isian.find((b) => b.kode === "9911")).toMatchObject({ khusus: "bukti", pihak: "T" });
    const tj = h.isian.filter((b) => b.jenis === "tj");
    // 2021 (Keterangan) dan 5058 (TanyaJwb) saksi 1 P = satu tombol; penyuntingnya 5058.
    expect(tj.map((b) => b.tj!.kunci)).toEqual(["saksi 1 p", "saksi 2 p", "jawaban lisan tergugat"]);
    expect(tj[0].tj).toMatchObject({ kodeSunting: "5058", sebutan: "Saksi 1 Penggugat" });
    expect(tj[1].tj!.kodeSunting).toBe("5059");
    expect(tj[2].tj).toMatchObject({ kodeSunting: "6112", peran: "tanyajawab" });
    // Urutan: isian biasa, lalu bukti (P sebelum T), lalu tanya jawab.
    expect(h.isian.map((b) => b.kode)).toEqual(["1214", "9911", "2021", "2022", "6112"]);
  });

  it("penanda tak dikenal dicatat (kecuali pemicu 111xx); sebutan pihak dari pemanggil mengganti #0046#/#0047#", () => {
    const h = susunIsian(["9999", "11111", "1268"], KATALOG, { P: "Pemohon", T: "Termohon" });
    expect(h.takDikenal).toEqual(["9999"]);
    expect(h.isian.find((b) => b.kode === "1268")!.pilihan[0]).toMatch(/Penggugat dan Tergugat/); // pilihan baku dari peta
    expect(rapikanNama("Kantor Kuasa #0046# (nama kantor di surat kuasa/gugatan, mis. DERRY & PARTNERS) #11111#", { P: "Pemohon", T: "Termohon" })).toBe("Kantor Kuasa Pemohon");
    expect(rapikanNama("ALASAN PERCERAIAN <br>SATU HURUF: A, B, C")).toBe("Alasan perceraian satu huruf");
    expect(rapikanNama("Awal Konflik : bulan _ / tahun _ / awal tahun / akhir tahun / tanggal _")).toBe("Awal Konflik");
  });

  it("rujukan membaca #NNNN# dan no_var = 'NNNN' tanpa menyebut dirinya sendiri", () => {
    expect(rujukan({ kode: "4001", nama: "", jenis: "data_sql", sql: "select ... no_var = '8503' and x = #0046# and #4001#", bawaan: "#0047#" })).toEqual(["0046", "0047", "8503"]);
    expect(kunciTanyaJawab("TanyaJwb Saksi 3 T")).toEqual({ kunci: "saksi 3 t", peran: "tanyajawab", sebutan: "Saksi 3 Tergugat" });
    expect(kunciTanyaJawab("Keterangan Replik Lisan Penggugat").kunci).toBe("replik lisan penggugat");
  });

  it("jenis folder Derry, sebutan pihak, folder paling cocok", () => {
    expect(["1 Perceraian CG", "ALUR 02 Cerai Verstek 2 Sidang", "BAS Itsbat Nikah Gugur dan Cabut", "Relaas", "PTSP", "- BAS VERSTEK PERCERAIAN -"].map(jenisFolderDerry)).toEqual(["put", "bas", "bas", "rel", "ptsp", "bas"]);
    expect(sebutanPihak("Cerai Gugat", "581/Pdt.G/2026/PA.Dgl")).toEqual({ P: "Penggugat", T: "Tergugat", gugatan: "gugatan" });
    expect(sebutanPihak("Cerai Talak", "12/Pdt.G/2026/PA.Dgl").P).toBe("Pemohon");
    expect(sebutanPihak("Itsbat Nikah", "226/Pdt.P/2026/PA.Dgl").T).toBe("Termohon");
    const folder = [
      { nama: "1 Perceraian CG", berkas: ["[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", "[02] [Kabul] CG - F.rtf"] },
      { nama: "1a Perceraian CT", berkas: ["[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", "[02] [Kabul] CT - F.rtf"] },
    ];
    expect(folderPalingCocok(["[01] [Kabul Verstek] Cerai (Format Lengkap)", "[02] [Kabul] CT - F"], folder)).toEqual({ nama: "1a Perceraian CT", cocok: 2 });
    expect(folderPalingCocok(["tidak ada"], folder)).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// B. Rute
// ----------------------------------------------------------------------------
const bridge = vi.fn();
const queryAll = vi.fn();
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryAll, queryOne: async () => null }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "u1" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: vi.fn(async () => ({ id: "u1", name: "Hakim Satu" })) }));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({ callAletaBotSippBridge: (...a: unknown[]) => bridge(...a) }));
vi.mock("@/server/shared/admin-access-audit", () => ({ handleAdminRouteError: (e: unknown) => new Response(JSON.stringify({ ok: false, alasan: String((e as Error)?.message || e) }), { status: 500 }) }));

const minta = (q: string) => new Request(`http://localhost/aleta/api/aleta-ecourt/blangko-derry${q}`);
async function rute() {
  const m = await import("@/app/api/aleta-ecourt/blangko-derry/route");
  m.lupakanSinggahan();
  return m;
}
const nextReq = (q: string) => Object.assign(minta(q), { nextUrl: new URL(`http://localhost/aleta/api/aleta-ecourt/blangko-derry${q}`) }) as never;

describe("B. GET /aleta-ecourt/blangko-derry", () => {
  beforeEach(() => {
    bridge.mockReset();
    queryAll.mockReset();
  });

  it("indeks=1: folder Derry dari blangko.pohon, berkas per folder, jenis per nama", async () => {
    bridge.mockImplementation(async (op: string) => {
      if (op === "blangko.pohon") return { ok: true, data: { ada: true, berkas: [{ jalur: "derry_briantono/1 Perceraian CG/[01] A.rtf" }, { jalur: "derry_briantono/1 Perceraian CG/[02] B.rtf" }, { jalur: "derry_briantono/Relaas/[JS] 0. R.rtf" }, { jalur: "_blangko_lain/x.rtf" }] } };
      return { ok: false, error: "tidak dikenal" };
    });
    const { GET } = await rute();
    const r = await GET(nextReq("?indeks=1"));
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.data.folder).toEqual([
      { nama: "1 Perceraian CG", jenis: "put", berkas: ["[01] A.rtf", "[02] B.rtf"] },
      { nama: "Relaas", jenis: "rel", berkas: ["[JS] 0. R.rtf"] },
    ]);
    expect(j.data.sumber).toBe("pohon");
    expect(bridge.mock.calls.map((c) => c[0])).toEqual(["blangko.pohon"]);
  });

  it("indeks: pohon gagal -> katalog akar Derry lalu per folder", async () => {
    bridge.mockImplementation(async (op: string, p: Record<string, string>) => {
      if (op === "blangko.pohon") return { ok: false, error: "mati" };
      if (op === "blangko.katalog" && p.folder === "derry_briantono") return { ok: true, data: { ada: true, set: [{ nama: "2 Itsbat Nikah" }], blangko: [] } };
      if (op === "blangko.katalog") return { ok: true, data: { ada: true, set: [], blangko: [{ berkas: "[01] Itsbat.rtf" }] } };
      return { ok: false, error: "x" };
    });
    const { GET } = await rute();
    const j = await (await GET(nextReq("?indeks=1"))).json();
    expect(j.data.sumber).toBe("katalog");
    expect(j.data.folder).toEqual([{ nama: "2 Itsbat Nikah", jenis: "put", berkas: ["[01] Itsbat.rtf"] }]);
  });

  it("folder+berkas: penanda dari blangko.baca x katalog hidup; nilai isian & pemicu untuk perkara dari abt.nilaiPenanda (tanpa semua=1 hanya isian tangan + pemicu)", async () => {
    const semuaVariabel = [...KATALOG.values()].map((d) => ({ noVar: d.kode, nama: d.nama, jenis: d.jenis, sqlQuery: d.sql, defaultData: d.bawaan }));
    bridge.mockImplementation(async (op: string, p: Record<string, unknown>) => {
      if (op === "blangko.baca") {
        expect(p).toEqual({ folder: "derry_briantono/1 Perceraian CG", berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf" });
        return { ok: true, data: { ada: true, berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf", penanda: ["0001", "4001", "0156", "2021"] } };
      }
      if (op === "abt.semuaVariabel") return { ok: true, data: { ada: true, variabel: semuaVariabel } };
      if (op === "abt.nilaiPenanda") {
        expect(p.perkaraId).toBe("10154");
        expect(p.sidangKe).toBe(2);
        expect((p.penanda as string[]).sort()).toEqual(["0156", "11111", "2021", "5058", "8503"]); // 17 Okt (E4): tanya-jawab ikut dibaca (penanda + penyunting)
        return { ok: true, data: { ok: true, nilai: { "8503": { status: "terisi", teks: "F", nama: "ALASAN" }, "0156": { status: "kosong", teks: "" }, "11111": { status: "terisi", teks: "<mark>(WAJIB ISI INI KARENA KUASA)</mark>" } } } };
      }
      return { ok: false, error: "tidak dikenal" };
    });
    const { GET } = await rute();
    const j = await (await GET(nextReq("?folder=1%20Perceraian%20CG&berkas=%5B01%5D%20%5BKabul%20Verstek%5D%20Cerai%20(Format%20Lengkap)&perkaraId=10154&sidangKe=2&sebutanP=Penggugat&sebutanT=Tergugat"))).json();
    expect(j.ok).toBe(true);
    expect(j.data).toMatchObject({ ada: true, folder: "derry_briantono/1 Perceraian CG", sumberKatalog: "abt", nilaiAda: true, jumlahPenanda: 4 });
    expect(j.data.isian.map((b: { kode: string }) => b.kode)).toEqual(["8503", "0156", "2021"]);
    expect(j.data.nilai["8503"]).toEqual({ status: "terisi", teks: "F", nama: "ALASAN", sebab: "" });
    expect(j.data.pemicu.map((p: { kode: string }) => p.kode)).toEqual(["11111"]);
    // Katalog disinggahkan: panggilan kedua tidak meminta abt.semuaVariabel lagi.
    await GET(nextReq("?folder=1%20Perceraian%20CG&berkas=x"));
    expect(bridge.mock.calls.filter((c) => c[0] === "abt.semuaVariabel").length).toBe(1);
  });

  it("katalog dari salinan kamus bila jembatan diam; semua=1 menilai seluruh penanda; blangko tidak terbaca = ada:false", async () => {
    queryAll.mockResolvedValue([...KATALOG.values()].map((d) => ({ no_var: d.kode, nama: d.nama, jenis: d.jenis, sql_query: d.sql, default_data: d.bawaan })));
    bridge.mockImplementation(async (op: string, p: Record<string, unknown>) => {
      if (op === "blangko.baca") return p.berkas === "hilang.rtf" ? { ok: true, data: { ada: false, sebab: "Blangko tidak ditemukan." } } : { ok: true, data: { ada: true, penanda: ["0001", "0007"] } };
      if (op === "abt.semuaVariabel") throw new Error("jembatan mati");
      if (op === "abt.nilaiPenanda") {
        expect((p.penanda as string[]).sort()).toEqual(["0001", "0007"]);
        return { ok: true, data: { ok: true, nilai: { "0001": { status: "terisi", teks: "601/Pdt.G/2026/PA.Dgl" } } } };
      }
      return { ok: false, error: "x" };
    });
    const { GET } = await rute();
    const j = await (await GET(nextReq("?folder=derry_briantono%2F1%20Perceraian%20CG&berkas=a.rtf&perkaraId=10154&semua=1"))).json();
    expect(j.data.sumberKatalog).toBe("kamus");
    expect(j.data.nilai["0001"].teks).toBe("601/Pdt.G/2026/PA.Dgl");
    expect(j.data.folder).toBe("derry_briantono/1 Perceraian CG");
    const h = await (await GET(nextReq("?folder=1%20Perceraian%20CG&berkas=hilang.rtf"))).json();
    expect(h.data).toMatchObject({ ada: false, sebab: "Blangko tidak ditemukan." });
  });

  it("masukan salah dijawab 400 tanpa memanggil jembatan; tidak ada operasi tulis", async () => {
    const { GET } = await rute();
    expect((await GET(nextReq("?folder=1%20Perceraian%20CG"))).status).toBe(400);
    expect((await GET(nextReq("?folder=..%2Fx&berkas=a"))).status).toBe(400);
    expect((await GET(nextReq("?folder=a&berkas=..%2F..%2Fb"))).status).toBe(400);
    expect(bridge).not.toHaveBeenCalled();
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const sumber = readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-ecourt/blangko-derry/route.ts"), "utf8");
    expect(sumber).not.toMatch(/export async function (POST|PUT|DELETE|PATCH)/);
    // Tidak ada fetch langsung ke ABT dan tidak ada operasi jembatan yang menulis.
    expect(sumber).not.toMatch(/\bfetch\(|hapus=|aksi=simpan|"abt\.(simpan|tulis|hapus)/);
    const operasi = [...sumber.matchAll(/callAletaBotSippBridge[^(]*\(\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(operasi)).toEqual(new Set(["abt.semuaVariabel", "blangko.pohon", "blangko.katalog", "abt.nilaiPenanda", "blangko.baca"]));
  });
});
