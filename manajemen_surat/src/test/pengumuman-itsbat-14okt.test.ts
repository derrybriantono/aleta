// @vitest-environment node
/**
 * ============================================================================
 * PENGUMUMAN ITSBAT NIKAH VOLUNTAIR - SIDANG PERTAMA (14 OKT 2026)
 * ============================================================================
 *
 * Permintaan pengguna: sidang pertama perkara itsbat nikah (jenis 360) VOLUNTAIR
 * (alur 16, Pdt.P) = panggilan Pemohon I + panggilan Pemohon II + PENGUMUMAN
 * itsbat nikah, di SEMUA fitur juru sita: panel per perkara (jurusita.js),
 * cetak massal (jurusita.js + rute relaas-massal/cetak), dan Cetak relaas
 * Jadwal Sidang portal (rute yang sama). Satu Pemohon (pasangan telah
 * meninggal) = panggilan Pemohon + pengumuman 1 Pemohon. Kontensius (alur 15)
 * dan sidang lanjutan TANPA pengumuman.
 *
 * Yang dijalankan sungguhan: rute GET relaas-massal/cetak (gateway bot
 * dipalsukan), nilaiCetakDokumen, pemetaan blangko, panel-alat.js +
 * jurusita.js di jsdom, dan latar.js (dunia-latar) sampai RTF-nya terunduh.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { nilaiCetakDokumen } from "@/app/api/aleta-ecourt/relaas-massal/cetak/nilai-cetak";
import { blangkoMenurutPemetaan } from "@/app/api/aleta-ecourt/relaas-massal/cetak/pemetaan-cetak";
import { labelGolonganCetak, namaBerkasDokumen } from "@/components/portal/aleta-ecourt-cetak-relaas";
import { bawaanPemetaan, kapanDipakai, KUNCI_BAKU, pilihKunciRelaas, uraiKunciRelaas } from "@/lib/pemetaan-blangko";
import {
  dokumenPengumumanItsbat,
  itsbatVoluntair,
  namaUnduhanBlangko,
  tambahPengumumanItsbat,
} from "@/lib/pengumuman-itsbat";
import { BLANGKO_RELAAS, blangkoRelaas, keadaanUntukGolongan } from "@/lib/pohon-blangko";

import { Dunia, abtPalsu, jalankan, minta, namaRelatif, nyalakan, pesanMulai as pesanMulaiLatar } from "./dunia-latar";

// ---------------------------------------------------------------------------
// Tepi luar rute yang dipalsukan (pola cetak-relaas-antrian.test.tsx)
// ---------------------------------------------------------------------------
const keadaan = vi.hoisted(() => ({ gateway: null as null | (() => unknown) }));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Penguji", roleId: "jurusita" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return {
    ...mod,
    getGatewayRelaasCetak: async () => (keadaan.gateway ? keadaan.gateway() : { ok: false, error: "belum disiapkan" }),
  };
});

const B2P = "[JS] 9.1. Pengumuman Permohonan Itsbat Nikah (2 Pemohon).rtf";
const B1P = "[JS] 9.2. Pengumuman Permohonan Itsbat Nikah (1 Pemohon).rtf";
const PERTAMA_P = BLANGKO_RELAAS.find((x) => x.keadaan === "sidang-pertama" && x.pihak === "pertama")!.berkas;
const PERTAMA_T = BLANGKO_RELAAS.find((x) => x.keadaan === "sidang-pertama" && x.pihak === "kedua")!.berkas;

type Bot = Record<string, any>;
/** Dokumen bentuk bot (relaasMassalService) - itsbat voluntair 2 Pemohon bawaannya. */
function bot(x: Bot): any {
  const golongan = String(x.golongan || "sidang-pertama");
  return {
    kunci: `${golongan}:${x.perkaraId}:${x.d ?? 0}:${x.pihakKe ?? 0}`,
    nomorPerkara: `${x.perkaraId}/Pdt.P/2026/PA.Dgl`,
    jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah",
    alurPerkaraId: 16,
    jenisPerkaraId: 360,
    golongan,
    sebabMasuk: "didaftarkan",
    d: 1,
    sidangId: null,
    tanggalSidangTujuan: "2026-10-28",
    sidangAsalId: null,
    dihadiriOleh: null,
    pihakDipanggil: "keduanya",
    pihakKe: null,
    jurusita: { nama: "Rahmat Hidayat, S.H.", nip: "", dariPenunjukan: true },
    sudahAdaRelaas: false,
    prosesTerakhirId: 81,
    jumlahPihak: { pertama: 2, kedua: 0, lain: 0 },
    sebutanPihak: { pertama: "Pemohon", kedua: "Termohon" },
    ...x,
  };
}

const PETA_BAWAAN = {
  relaas: Object.fromEntries(bawaanPemetaan("relaas").map((b) => [b.kunci, b.namaBerkas])),
  pbt: Object.fromEntries(bawaanPemetaan("pbt").map((b) => [b.kunci, b.namaBerkas])),
};

// ===========================================================================
// 1. Aturan portal (lib + penilaian rute)
// ===========================================================================

describe("aturan: hanya sidang pertama itsbat VOLUNTAIR", () => {
  it("itsbat voluntair = jenis 360 DAN alur 16 (angka SIPP)", () => {
    expect(itsbatVoluntair({ jenisPerkaraId: 360, alurPerkaraId: 16 })).toBe(true);
    expect(itsbatVoluntair({ jenisPerkaraId: "360", alurPerkaraId: "16" })).toBe(true);
    expect(itsbatVoluntair({ jenisPerkaraId: 360, alurPerkaraId: 15 })).toBe(false); // kontensius Pdt.G
    expect(itsbatVoluntair({ jenisPerkaraId: 358, alurPerkaraId: 16 })).toBe(false); // voluntair lain
  });

  it("2 Pemohon: sidang pertama diikuti SATU pengumuman 2P yang dapat dicetak dan ikut Pilih semua", () => {
    const daftar = tambahPengumumanItsbat([bot({ perkaraId: 900 })]);
    expect(daftar.map((d) => d.golongan)).toEqual(["sidang-pertama", "pengumuman-itsbat"]);
    const p = daftar[1];
    expect(p).toMatchObject({ kunci: "pengumuman-itsbat:900:1:0", d: 1, pihakDipanggil: "keduanya", pihakKe: null, sudahAdaRelaas: null });
    expect(daftar[0].pihakDipanggil).toBe("keduanya"); // panggilan Pemohon I dan II tetap
    const n = nilaiCetakDokumen(p as any, null, PETA_BAWAAN);
    expect(n).toMatchObject({ bisaDicetak: true, ikutPilihSemua: true, sebabTidakBisa: "" });
    expect(n.blangko?.berkas).toBe(B2P);
    expect(n.peringatan).toEqual([]);
  });

  it("1 Pemohon: pengumuman 1P, dan panggilan sidang pertama hanya untuk Pemohon", () => {
    const daftar = tambahPengumumanItsbat([bot({ perkaraId: 901, jumlahPihak: { pertama: 1, kedua: 0, lain: 0 } })]);
    expect(daftar).toHaveLength(2);
    expect(daftar[0].pihakDipanggil).toBe("pertama");
    expect(daftar[0].keterangan.join(" ")).toMatch(/satu Pemohon/);
    expect(nilaiCetakDokumen(daftar[0] as any, null, PETA_BAWAAN).blangko?.berkas).toBe(PERTAMA_P);
    expect(daftar[1].pihakDipanggil).toBe("pertama");
    expect(nilaiCetakDokumen(daftar[1] as any, null, PETA_BAWAAN).blangko?.berkas).toBe(B1P);
  });

  it("kontensius (alur 15), sidang lanjutan, PBT, dan jenis lain: TANPA pengumuman", () => {
    const daftar = [
      bot({ perkaraId: 902, alurPerkaraId: 15, nomorPerkara: "902/Pdt.G/2026/PA.Dgl" }),
      bot({ perkaraId: 903, golongan: "sidang-ditunda", d: 2, pihakDipanggil: "kedua" }),
      bot({ perkaraId: 904, golongan: "pemberitahuan-putusan", d: null, pihakKe: 1, pihakDipanggil: "pertama" }),
      bot({ perkaraId: 905, jenisPerkaraId: 358 }),
    ];
    // 20 Okt: sebutanPihak diselaraskan (Pemohon I/II) - yang dijaga: tidak ada dokumen pengumuman, golongan dan pihak tetap.
    const ringkas = (d: any[]) => d.map((x) => `${x.perkaraId}|${x.golongan}|${x.pihakDipanggil}`);
    expect(ringkas(tambahPengumumanItsbat(daftar))).toEqual(ringkas(daftar));
  });

  it("jumlah Pemohon tak terbaca (bot lama): 2P, keterangannya menyebut; satu pengumuman per perkara", () => {
    const daftar = tambahPengumumanItsbat([bot({ perkaraId: 906, jumlahPihak: null }), bot({ perkaraId: 906, kunci: "sidang-pertama:906:1:9" })]);
    expect(daftar.filter((d) => d.golongan === "pengumuman-itsbat")).toHaveLength(1);
    const p = dokumenPengumumanItsbat(bot({ perkaraId: 906, jumlahPihak: null }))!;
    expect(p.pihakDipanggil).toBe("keduanya");
    expect(p.keterangan.join(" ")).toMatch(/tidak terbaca/);
    expect(nilaiCetakDokumen(p as any, null, PETA_BAWAAN).blangko?.berkas).toBe(B2P);
  });

  it("pohon-blangko: golongan dikenal, blangko menurut jumlah Pemohon, folder & menu Relaas", () => {
    expect(keadaanUntukGolongan("pengumuman-itsbat")).toBe("pengumuman-itsbat");
    expect(blangkoRelaas("pengumuman-itsbat", "keduanya")?.berkas).toBe(B2P);
    expect(blangkoRelaas("pengumuman-itsbat", "pertama")?.berkas).toBe(B1P);
    const dua = BLANGKO_RELAAS.filter((x) => x.keadaan === "pengumuman-itsbat");
    expect(dua.map((x) => x.folder)).toEqual(["derry_briantono/98 Relaas", "derry_briantono/98 Relaas"]);
  });
});

describe("pemetaan blangko: kunci pengumuman-itsbat / pengumuman-itsbat-1p", () => {
  it("kunci baku + bawaan = berkas paket ABT; kalimat 'dipakai saat'", () => {
    const kunci = KUNCI_BAKU.relaas.map((k) => k.kunci);
    expect(kunci).toContain("pengumuman-itsbat");
    expect(kunci).toContain("pengumuman-itsbat-1p");
    expect(PETA_BAWAAN.relaas["pengumuman-itsbat"]).toBe(B2P);
    expect(PETA_BAWAAN.relaas["pengumuman-itsbat-1p"]).toBe(B1P);
    expect(kapanDipakai("relaas", "pengumuman-itsbat").dipakai).toMatch(/itsbat nikah voluntair.*2 Pemohon/);
    expect(kapanDipakai("relaas", "pengumuman-itsbat-1p").dipakai).toMatch(/1 Pemohon/);
  });

  it("1P dan 2P TIDAK saling menggantikan; kata asing tidak dikenali; kunci lama tidak berubah arti", () => {
    expect(uraiKunciRelaas("pengumuman-itsbat")).toMatchObject({ awalan: "pengumuman", keadaan: "2p", dikenal: true });
    expect(uraiKunciRelaas("Pengumuman Isbat Nikah 1P")).toMatchObject({ awalan: "pengumuman", keadaan: "1p", dikenal: true });
    expect(uraiKunciRelaas("pengumuman-itsbat-kuasa").dikenal).toBe(false);
    // Kata itsbat/nikah di luar kunci pengumuman tetap asing (tidak menjadi panggilan cadangan).
    expect(uraiKunciRelaas("panggilan-itsbat-nikah").dikenal).toBe(false);
    const minta1 = { awalan: "pengumuman" as const, keadaan: "1p" as const, khusus: "" as const, umum: "" as const };
    expect(pilihKunciRelaas(["pengumuman-itsbat"], minta1)).toBeNull();
    // Admin memetakan 1P ke berkas lain: dipakai untuk perkara satu Pemohon saja.
    const dok1 = { golongan: "pengumuman-itsbat", pihakDipanggil: "pertama", alurPerkaraId: 16 };
    const dok2 = { ...dok1, pihakDipanggil: "keduanya" };
    const relaas = { "pengumuman-itsbat-1p": "Pengumuman 1P Satker.rtf" };
    expect(blangkoMenurutPemetaan(dok1, relaas, {})?.berkas).toBe("Pengumuman 1P Satker.rtf");
    expect(blangkoMenurutPemetaan(dok2, relaas, {})).toBeNull();
    expect(nilaiCetakDokumen({ ...dok2, perkaraId: 1, d: 1 }, null, { relaas, pbt: {} }).blangko?.berkas).toBe(B2P);
  });

  it("cermin ekstensi: jurusitaUraiKunci/jurusitaPilihKunci menjawab SAMA dengan pemetaan-blangko.ts", () => {
    const w = new JSDOM("", { runScripts: "outside-only" }).window as any;
    w.eval(`${baca("panel-alat.js")}\n;\n${baca("jurusita.js")}\n;window.__k = { urai: jurusitaUraiKunci, pilih: jurusitaPilihKunci };`);
    const kunci = [
      "pengumuman-itsbat",
      "pengumuman-itsbat-1p",
      "Pengumuman Isbat Nikah 1P",
      "pengumuman-permohonan-itsbat-nikah-2p",
      "pengumuman-itsbat-kuasa",
      "panggilan-itsbat-nikah",
      "relaas-panggilan-sidang-pertama-pemohon",
      "panggilan-termohon",
    ];
    for (const k of kunci) {
      const ts = uraiKunciRelaas(k);
      expect(polos(w.__k.urai(k)), k).toEqual({ awalan: ts.awalan, keadaan: ts.keadaan, pihak: ts.pihak, dikenal: ts.dikenal, asing: ts.asing, ecourt: ts.ecourt, verstek: ts.verstek });
    }
    for (const keadaanMinta of ["1p", "2p"] as const) {
      const m = { awalan: "pengumuman" as const, keadaan: keadaanMinta, khusus: "" as const, umum: "" as const };
      expect(w.__k.pilih(kunci, m), keadaanMinta).toBe(pilihKunciRelaas(kunci, m));
    }
  });
});

describe("rute GET relaas-massal/cetak (bahan dialog Jadwal Sidang & massal ekstensi)", () => {
  it("pengumuman itsbat ikut di daftar hari ini dan hari kerja sebelumnya, dinilai dengan aturan yang sama", async () => {
    keadaan.gateway = () => ({
      ok: true,
      data: {
        tanggal: "2026-10-14",
        dokumen: [bot({ perkaraId: 910 }), bot({ perkaraId: 911, alurPerkaraId: 15 }), bot({ perkaraId: 912, jumlahPihak: { pertama: 1, kedua: 0, lain: 0 } })],
        tidakPerlu: [],
        tertunda: [],
        hariKerjaSebelumnya: { tanggal: "2026-10-13", dokumen: [bot({ perkaraId: 913 })] },
        ringkas: { dokumen: 3, perGolongan: {}, perJurusita: {}, tidakPerlu: 0, tertunda: 0, sudahAdaRelaas: 0 },
        catatan: [],
      },
    });
    const mod = await import("@/app/api/aleta-ecourt/relaas-massal/cetak/route");
    const r = await mod.GET({ nextUrl: new URL("http://uji.local/api/aleta-ecourt/relaas-massal/cetak?tanggal=2026-10-14") } as any);
    const isi = (await r.json()) as any;
    const data = isi.data ?? isi;
    const ringkas = (d: any) => `${d.perkaraId}|${d.golongan}|${d.pihakDipanggil}|${d.blangko?.berkas ?? ""}|${d.bisaDicetak}`;
    expect(data.dokumen.map(ringkas)).toEqual([
      `910|sidang-pertama|keduanya|${BLANGKO_RELAAS.find((x) => x.pihak === "keduanya" && x.keadaan === "sidang-pertama")!.berkas}|true`,
      `910|pengumuman-itsbat|keduanya|${B2P}|true`,
      `911|sidang-pertama|keduanya|${BLANGKO_RELAAS.find((x) => x.pihak === "keduanya" && x.keadaan === "sidang-pertama")!.berkas}|true`,
      `912|sidang-pertama|pertama|${PERTAMA_P}|true`,
      `912|pengumuman-itsbat|pertama|${B1P}|true`,
    ]);
    expect(data.hariKerjaSebelumnya.dokumen.map((d: any) => d.golongan)).toEqual(["sidang-pertama", "pengumuman-itsbat"]);
  });
});

describe("dialog Cetak relaas portal: label dan nama unduhan baku", () => {
  it("golongan berlabel; nama '<nomor _> - <blangko>' sama dengan alatNamaUnduhanBlangko ekstensi", () => {
    expect(labelGolonganCetak("pengumuman-itsbat")).toBe("Pengumuman itsbat nikah");
    const dok = { nomorPerkara: "242/Pdt.P/2026/PA.Dgl", perkaraId: 1, golongan: "pengumuman-itsbat", d: 1, pihakKe: null };
    const nama = namaBerkasDokumen(dok as any, B2P);
    expect(nama).toBe("242_Pdt.P_2026_PA.Dgl - [JS] 9.1. Pengumuman Permohonan Itsbat Nikah (2 Pemohon)");
    expect(namaUnduhanBlangko(dok.nomorPerkara, B1P)).toBe("242_Pdt.P_2026_PA.Dgl - [JS] 9.2. Pengumuman Permohonan Itsbat Nikah (1 Pemohon)");
    // Cermin ekstensi: fungsi panel-alat.js yang sungguhan.
    const alat = new JSDOM("", { runScripts: "outside-only" }).window as any;
    alat.eval(`${baca("panel-alat.js")}\n;window.__nama = alatNamaUnduhanBlangko;`);
    expect(alat.__nama(dok.nomorPerkara, B2P, "rtf")).toBe(`${nama}.rtf`);
    // Golongan lain tetap nama lama.
    expect(namaBerkasDokumen({ ...dok, golongan: "sidang-pertama" } as any, PERTAMA_P)).toBe("242-Pdt.P-2026-PA.Dgl - panggilan sidang ke-1");
  });
});

// ===========================================================================
// 2. Ekstensi: panel per perkara dan massal (jurusita.js sungguhan di jsdom)
// ===========================================================================

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
function baca(berkas: string) {
  return readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
}
const SUMBER = `${baca("panel-alat.js")}\n;\n${baca("jurusita.js")}\n;\nwindow.__uji = { mode: () => alatUjiMode() };`;
const ASAL = "http://192.168.10.10";
const NOMOR = "242/Pdt.P/2026/PA.Dgl";
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
function hariIniIso() {
  const t = new Date();
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${dua(t.getMonth() + 1)}-${dua(t.getDate())}`;
}

function rincian(x: Record<string, unknown> = {}) {
  return {
    perkaraId: "10221",
    nomorPerkara: NOMOR,
    jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah",
    alurPerkaraId: 16,
    jenisPerkaraId: 360,
    jumlahPihakPertama: 2,
    jurusita: [{ kode: "1", nama: "Rahmat Hidayat, S.H." }],
    putusan: { sudahPutus: false, tanggalPutusan: "" },
    jadwalPerkara: [{ sidangId: "1", urutanSidang: 1, tanggalSidang: "2099-10-28", agenda: "Sidang pertama" }],
    ...x,
  };
}

const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function buka(p: { rincian?: unknown; cetak?: unknown; url?: string }) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="panel"><div id="wadah"></div></div></body></html>`, {
    url: p.url ?? `${ASAL}/SIPP/perkara_detil_agama/xyz`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
  const pesan: any[] = [];
  w.chrome = {
    runtime: {
      id: "aleta-uji",
      getManifest: () => ({ version: "1.199.0" }),
      getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
      lastError: undefined,
      sendMessage: (m: any, balik?: (x: unknown) => void) => {
        pesan.push(polos(m));
        let jawab: unknown = { ok: true };
        if (m.jenis === "relaas-mulai") {
          const butir = (m.pekerjaan?.dokumen ?? []).map((d: any) => ({ ...d, keadaan: "menunggu" }));
          jawab = { ok: true, pekerjaan: { id: "r", butir, selesai: false, dilewati: [] }, ringkas: { menunggu: butir.length }, perkiraan: { rata: 1 } };
        } else if (m.jenis === "relaas-keadaan") jawab = { ok: true, pekerjaan: null, ringkas: {} };
        setTimeout(() => balik && balik(polos(jawab)), 0);
      },
    },
    storage: {
      local: {
        get: async (k?: string | string[] | null) => {
          const daftar = k == null ? Object.keys(simpanan) : [k].flat();
          return Object.fromEntries(daftar.filter((x) => x in simpanan).map((x) => [x, polos(simpanan[x])]));
        },
        set: async (isi: Record<string, unknown>) => Object.assign(simpanan, polos(isi)),
        remove: async () => undefined,
      },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async (alamat: string) => {
    const url = String(alamat);
    let status = 200;
    let isi: unknown = { ok: false };
    if (url.includes("/ekstensi/siapa")) isi = { ok: true, data: { nama: "Rahmat Hidayat", peran: "Jurusita", roleId: "jurusita", peranTambahan: [] } };
    else if (url.includes("/pemetaan-blangko")) status = 404;
    else if (url.includes("/sidang?nomor=")) isi = { ok: true, data: { available: true, nomorPerkara: NOMOR, sipp: p.rincian } };
    else if (url.includes("/relaas-massal/cetak")) isi = { ok: true, data: p.cetak };
    else status = 404;
    return new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.confirm = () => true;
  w.eval(SUMBER);
  return { w, pesan, wadah: w.document.getElementById("wadah") as HTMLElement };
}
type H = ReturnType<typeof buka>;
const kotak = (h: H, nilai: string) => h.wadah.querySelector(`input[type=checkbox][value="${nilai}"]`) as HTMLInputElement | null;
const label = (h: H, nilai: string) => (kotak(h, nilai)?.parentElement?.textContent || "").trim();
const mulai = (h: H) => h.pesan.filter((m) => m.jenis === "relaas-mulai");

async function panelPerkara(r: unknown) {
  const h = buka({ rincian: r });
  await sampai(() => h.w.__uji.mode() === "baru", "mode baru");
  expect(await h.w.aletaJurusitaPasang(h.wadah, { situs: "sipp", nomorPerkara: NOMOR, perkaraId: "10221" })).toBe(true);
  await sampai(() => h.wadah.querySelector("select.aleta-jurusita-sidang"), "pilihan sidang");
  await tunggu(30);
  return h;
}
async function cetakPerkara(h: H) {
  const t = h.wadah.querySelector(".aleta-jurusita-aksi .aleta-jurusita-tombol-utama") as HTMLButtonElement;
  expect(t.disabled).toBe(false);
  t.click();
  await sampai(() => mulai(h).length === 1, "relaas-mulai");
  return mulai(h)[0].pekerjaan.dokumen as any[];
}

describe("panel juru sita per perkara", () => {
  it("itsbat voluntair 2 Pemohon, sidang pertama: Pemohon I + Pemohon II + pengumuman tercentang bawaan -> 3 dokumen", async () => {
    const h = await panelPerkara(rincian());
    expect(label(h, "p1")).toBe("Panggilan Pemohon I");
    expect(label(h, "p2")).toBe("Panggilan Pemohon II");
    expect(label(h, "pi")).toBe("Pengumuman itsbat");
    expect([kotak(h, "p1")!.checked, kotak(h, "p2")!.checked, kotak(h, "pi")!.checked]).toEqual([true, true, true]);
    const dok = await cetakPerkara(h);
    expect(dok.map((d) => `${d.golongan}|${d.d}|${d.berkas}`)).toEqual([
      `sidang-pertama|1|${PERTAMA_P}`,
      `sidang-pertama|1|${PERTAMA_T}`,
      `pengumuman-itsbat|1|${B2P}`,
    ]);
    const p = dok[2];
    expect(Object.keys(p).sort()).toEqual(["berkas", "d", "golongan", "jurusita", "kunci", "label", "nama", "nomorPerkara", "perkaraId"]);
    expect(p.nama).toBe("242_Pdt.P_2026_PA.Dgl - [JS] 9.1. Pengumuman Permohonan Itsbat Nikah (2 Pemohon)");
    expect(dok[1].label).toBe("Panggilan Pemohon II");
  });

  it("satu Pemohon: Panggilan Pemohon II mati; pengumuman 1 Pemohon -> 2 dokumen", async () => {
    const h = await panelPerkara(rincian({ jumlahPihakPertama: 1 }));
    expect(label(h, "p1")).toBe("Panggilan Pemohon");
    expect(kotak(h, "p2")!.disabled).toBe(true);
    expect(kotak(h, "p2")!.checked).toBe(false);
    expect(label(h, "pi")).toBe("Pengumuman itsbat (1 Pemohon)");
    const dok = await cetakPerkara(h);
    expect(dok.map((d) => `${d.golongan}|${d.berkas}`)).toEqual([`sidang-pertama|${PERTAMA_P}`, `pengumuman-itsbat|${B1P}`]);
  });

  it("sidang lanjutan: centang pengumuman mati dan tidak tercetak; kembali ke sidang pertama tercentang lagi", async () => {
    const h = await panelPerkara(
      rincian({
        jadwalPerkara: [
          { sidangId: "1", urutanSidang: 1, tanggalSidang: "2026-09-01", agenda: "Sidang pertama", dihadiriOleh: 2 },
          { sidangId: "2", urutanSidang: 2, tanggalSidang: "2099-10-28", agenda: "Pembuktian" },
        ],
      })
    );
    const pilih = h.wadah.querySelector("select.aleta-jurusita-sidang") as HTMLSelectElement;
    expect(pilih.value).toBe("2");
    expect(kotak(h, "pi")!.disabled).toBe(true);
    expect(kotak(h, "pi")!.checked).toBe(false);
    kotak(h, "p1")!.checked = true;
    kotak(h, "p1")!.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    const dok = await cetakPerkara(h);
    expect(dok.map((d) => d.golongan)).not.toContain("pengumuman-itsbat");
    pilih.value = "1";
    pilih.dispatchEvent(new h.w.Event("change", { bubbles: true }));
    expect(kotak(h, "pi")!.disabled).toBe(false);
    expect(kotak(h, "pi")!.checked).toBe(true);
  });

  it("itsbat kontensius (alur 15) dan cerai gugat: tidak ada centang pengumuman", async () => {
    for (const r of [rincian({ alurPerkaraId: 15, nomorPerkara: "542/Pdt.G/2026/PA.Dgl" }), rincian({ alurPerkaraId: 15, jenisPerkaraId: 347 })]) {
      const h = await panelPerkara(r);
      expect(kotak(h, "pi")).toBeNull();
      const dok = await cetakPerkara(h);
      expect(dok.map((d) => d.golongan)).toEqual(["sidang-pertama", "sidang-pertama"]);
    }
  });
});

describe("cetak massal juru sita (panel daftar SIPP) - dari rute yang sama", () => {
  function cetakRute() {
    const nilai = (d: Bot) => {
      const n = nilaiCetakDokumen(d as any, null, PETA_BAWAAN);
      return { ...d, blangko: n.blangko, bisaDicetak: n.bisaDicetak, sebabTidakBisa: n.sebabTidakBisa, peringatan: n.peringatan, ikutPilihSemua: n.ikutPilihSemua };
    };
    const dokumen = tambahPengumumanItsbat([
      bot({ perkaraId: 920 }),
      bot({ perkaraId: 921, jumlahPihak: { pertama: 1, kedua: 0, lain: 0 } }),
      bot({ perkaraId: 922, alurPerkaraId: 15, nomorPerkara: "922/Pdt.G/2026/PA.Dgl", sebutanPihak: { pertama: "Penggugat", kedua: "Tergugat" } }),
      bot({ perkaraId: 923, golongan: "sidang-ditunda", d: 2, pihakDipanggil: "kedua", dihadiriOleh: 2 }),
    ]).map(nilai);
    return { ok: true, tanggal: hariIniIso(), dokumen, tidakPerlu: [], tertunda: [], ringkas: { dokumen: dokumen.length }, catatan: [] };
  }

  it("Pilih semua: pengumuman 2P/1P ikut, kontensius & tundaan tanpa pengumuman; nama baku", async () => {
    const h = buka({ cetak: cetakRute(), url: `${ASAL}/SIPP/perkara` });
    await sampai(() => h.w.__uji.mode() === "baru", "mode baru");
    expect(await h.w.aletaJurusitaPasangMassal(h.wadah, { situs: "sipp" })).toBe(true);
    await sampai(() => h.wadah.querySelector(".aleta-jurusita-massal-panel .aleta-jurusita-ringkas"), "ringkasan");
    const baris = (id: number) => h.wadah.querySelector(`.aleta-jurusita-perkara[data-perkara-id="${id}"][data-kelompok="hari-ini"]`) as HTMLElement;
    expect(baris(920).querySelector('input[value="pi"]')).toBeTruthy();
    expect(baris(921).querySelector('input[value="pi"]')!.parentElement!.textContent).toMatch(/1 Pemohon/);
    expect((baris(921).querySelector('input[value="p2"]') as HTMLInputElement).disabled).toBe(true);
    expect(baris(922).querySelector('input[value="pi"]')).toBeNull();
    expect(baris(923).querySelector('input[value="pi"]')).toBeNull();
    (h.wadah.querySelector(".aleta-jurusita-massal-panel .aleta-jurusita-pilih-semua") as HTMLButtonElement).click();
    const cetak = await sampai(() => {
      const t = h.wadah.querySelector(".aleta-jurusita-massal-panel .aleta-jurusita-cetak-massal") as HTMLButtonElement;
      return t && !t.disabled ? t : null;
    }, "cetak menyala");
    expect((baris(920).querySelector('input[value="pi"]') as HTMLInputElement).checked).toBe(true);
    cetak.click();
    await sampai(() => mulai(h).length === 1, "relaas-mulai");
    const dok = mulai(h)[0].pekerjaan.dokumen as any[];
    const ringkas = dok.map((d) => `${d.perkaraId}|${d.golongan}|${d.berkas}`).sort();
    expect(ringkas).toEqual(
      [
        `920|sidang-pertama|${PERTAMA_P}`,
        `920|sidang-pertama|${PERTAMA_T}`,
        `920|pengumuman-itsbat|${B2P}`,
        `921|sidang-pertama|${PERTAMA_P}`,
        `921|pengumuman-itsbat|${B1P}`,
        `922|sidang-pertama|${PERTAMA_P}`,
        `922|sidang-pertama|${PERTAMA_T}`,
        `923|sidang-ditunda|${BLANGKO_RELAAS.find((x) => x.keadaan === "sidang-ditunda" && x.pihak === "kedua")!.berkas}`,
      ].sort()
    );
    const p = dok.find((d) => d.perkaraId === "921" && d.golongan === "pengumuman-itsbat");
    expect(p).toMatchObject({ d: 1, kunci: "pengumuman-itsbat:921:1:0", nama: "921_Pdt.P_2026_PA.Dgl - [JS] 9.2. Pengumuman Permohonan Itsbat Nikah (1 Pemohon)" });
    expect(new Set(dok.map((d) => d.kunci)).size).toBe(dok.length);
  });
});

// ===========================================================================
// 3. latar.js: golongan pengumuman diterima dan RTF-nya terunduh dengan nama baku
// ===========================================================================

describe("latar.js: putaran relaas mencetak pengumuman itsbat", () => {
  it("dokumen pengumuman-itsbat tidak dilewati; ABT dicetak dengan d sidang pertama; nama berkas baku", async () => {
    const dok = {
      kunci: "pengumuman-itsbat:101:1:0",
      perkaraId: "101",
      nomorPerkara: "101/Pdt.P/2026/PA.Dgl",
      golongan: "pengumuman-itsbat",
      label: "Pengumuman itsbat nikah (2 Pemohon)",
      d: 1,
      berkas: B2P,
      nama: namaUnduhanBlangko("101/Pdt.P/2026/PA.Dgl", B2P),
      jurusita: "Andi Juru Sita, S.H.",
    };
    const d = new Dunia(abtPalsu());
    const pekerja = nyalakan(d);
    await minta(d, pekerja, pesanMulaiLatar([dok]));
    await jalankan(d, () => Boolean(d.putaran()?.selesai));
    expect(d.putaran().dilewati).toEqual([]);
    expect(d.putaran().butir[0]).toMatchObject({ golongan: "pengumuman-itsbat", d: 1, keadaan: "selesai" });
    expect(d.unduhan.map(namaRelatif)).toEqual([
      "ALETA relaas 2026-09-25/Andi Juru Sita, S.H/101_Pdt.P_2026_PA.Dgl - [JS] 9.1. Pengumuman Permohonan Itsbat Nikah (2 Pemohon).rtf",
    ]);
  });
});
