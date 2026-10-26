import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { LencanaProdeo } from "@/components/portal/penanda-perkara-pihak";
import { lencanaPerkara, lencanaProdeo } from "@/lib/penanda-perkara-pihak";

/**
 * DETEKSI PRODEO SATU SUMBER (26 Okt 2026).
 *
 * Laporan: perkara prodeo (664/Pdt.G/2026/PA.Dgl) tidak terdeteksi di Jadwal Sidang dan
 * Status Perkara. Yang dijaga, dan DIJALANKAN (bukan dibaca):
 *   - prodeoPerkaraService: perkara.prodeo = 1 ATAU persetujuan prodeo e-Court; sumber utama gagal =
 *     galat (bukan "bukan prodeo"); sumber kedua gagal = diabaikan; penandaProdeoPerkara null bila tak terbaca;
 *   - Jadwal Sidang (penandaPerkaraPihakService.bahanPenanda/ruasBaris) dan Status Perkara
 *     (sippTahapanService.penandaPerkara) memakai sumber yang SAMA;
 *   - sippSkemaService tidak mengingat bacaan skema yang GAGAL atau KOSONG (dulu satu kegagalan sesaat
 *     membuat seluruh tabel dijawab "tidak ada" sampai bot dinyalakan ulang - prodeo padam diam-diam);
 *   - lencana Prodeo tampil di Status Perkara dengan keterangan sumber.
 * Data rekaan (nama/NIK rekaan); perkara_id 10234 meniru 664/Pdt.G/2026 yang terukur prodeo=1 di SIPP.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");
const svc: any = muat(path.join(AKAR, "aleta_bot/services/prodeoPerkaraService.js"));
const penandaPihak: any = muat(path.join(AKAR, "aleta_bot/services/penandaPerkaraPihakService.js"));

afterEach(() => cleanup());

type Kolom = Record<string, string[]>;
const skema = (kolom: Kolom, tabel: string[] = []) => ({
  kolomAda: async (t: string, k: string) => (kolom[t] ?? []).includes(k),
  tabelAda: async (t: string) => tabel.includes(t) || (kolom[t] ?? []).length > 0,
  pilihKolom: async (t: string, calon: string[]) => calon.find((c) => (kolom[t] ?? []).includes(c)) ?? "",
});

/** SIPP rekaan: perkara 10234 prodeo di kolom; 10300 hanya disetujui e-Court; 10400 biasa. */
function sippRekaan(opsi: { kolomGagal?: boolean; ecourtGagal?: boolean } = {}) {
  const sql: string[] = [];
  const kueri = async (q: string, id: number[]) => {
    sql.push(q);
    if (q.includes("FROM ecourt_prodeo")) {
      if (opsi.ecourtGagal) throw new Error("tabel ecourt_prodeo rusak");
      return [10234, 10300].filter((x) => id.includes(x)).map((perkaraId) => ({ perkaraId }));
    }
    if (opsi.kolomGagal) throw new Error("kolom rusak");
    return [10234].filter((x) => id.includes(x)).map((perkaraId) => ({ perkaraId }));
  };
  return { kueri, sql };
}

const SKEMA_LENGKAP = skema({ perkara: ["prodeo"] }, ["ecourt_prodeo", "perkara_efiling_id"]);

describe("prodeoPerkaraService (bot, hanya SELECT)", () => {
  it("664/Pdt.G/2026 (perkara_id 10234, perkara.prodeo = 1) terdeteksi dengan sumber kolom SIPP dan e-Court", async () => {
    const { kueri, sql } = sippRekaan();
    const sumber = await svc.sumberProdeoBanyakPerkara([10234, 10300, 10400], { kueri, skema: SKEMA_LENGKAP });
    expect(sumber["10234"]).toEqual(["flag-sipp", "ecourt"]);
    // Disetujui e-Court tetapi kolom perkara.prodeo belum menyala: tetap prodeo.
    expect(sumber["10300"]).toEqual(["ecourt"]);
    expect(sumber["10400"]).toBeUndefined();
    for (const q of sql) {
      expect(q).toMatch(/^SELECT /);
      expect(q).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
    }
    expect(sql[0]).toContain("prodeo = 1");
    expect(sql[1]).toContain("e.status = 1");
  });

  it("prodeoBanyakPerkara bentuk lama: kunci perkara_id -> true, tanpa kolom bukan galat", async () => {
    const { kueri } = sippRekaan();
    expect(await svc.prodeoBanyakPerkara([10234, 10300, 10400, 0, "x"], { kueri, skema: SKEMA_LENGKAP })).toEqual({
      "10234": true,
      "10300": true,
    });
    // Tanpa kolom prodeo DAN tanpa tabel e-Court: tidak ada yang dituduh.
    expect(await svc.prodeoBanyakPerkara([10234], { kueri, skema: skema({ perkara: [] }) })).toEqual({});
  });

  it("sumber utama gagal dibaca = galat (tidak menuduh 'bukan prodeo'); sumber kedua gagal = diabaikan", async () => {
    await expect(
      svc.prodeoBanyakPerkara([10234], { kueri: sippRekaan({ kolomGagal: true }).kueri, skema: SKEMA_LENGKAP })
    ).rejects.toThrow("kolom rusak");
    const tanpaEcourt = await svc.sumberProdeoBanyakPerkara([10234, 10300], {
      kueri: sippRekaan({ ecourtGagal: true }).kueri,
      skema: SKEMA_LENGKAP,
    });
    expect(tanpaEcourt).toEqual({ "10234": ["flag-sipp"] });
  });

  it("penandaProdeoPerkara: true/false/null (null = tidak terbaca)", async () => {
    expect(await svc.penandaProdeoPerkara(10234, { kueri: sippRekaan().kueri, skema: SKEMA_LENGKAP })).toEqual({
      prodeo: true,
      sumberProdeo: ["flag-sipp", "ecourt"],
    });
    expect(await svc.penandaProdeoPerkara(10400, { kueri: sippRekaan().kueri, skema: SKEMA_LENGKAP })).toEqual({
      prodeo: false,
      sumberProdeo: [],
    });
    expect(
      await svc.penandaProdeoPerkara(10234, { kueri: sippRekaan({ kolomGagal: true }).kueri, skema: SKEMA_LENGKAP })
    ).toEqual({ prodeo: null, sumberProdeo: [] });
    expect(await svc.penandaProdeoPerkara(0)).toEqual({ prodeo: null, sumberProdeo: [] });
  });
});

describe("Jadwal Sidang dan Status Perkara memakai sumber yang sama", () => {
  it("bahanPenanda -> ruasBaris: perkara 10234 prodeo beserta sumbernya; perkara biasa tidak", async () => {
    const { kueri } = sippRekaan();
    const bahan = await penandaPihak.bahanPenanda([10234, 10400], {
      skema: skema({ perkara: ["prodeo"], pihak: ["pekerjaan"] }, ["ecourt_prodeo", "perkara_efiling_id"]),
      kueri: async (q: string, id: number[]) => (q.includes("perkara_pihak") ? [] : kueri(q, id)),
      tahapan: () => ({ penandaGhaibBanyakPerkara: async () => ({}) }),
    });
    expect(bahan.terbaca.prodeo).toBe(true);
    const ada = penandaPihak.ruasBaris(bahan, 10234);
    expect(ada.penandaPerkara).toEqual({ ghaib: false, ghaibSumber: [], prodeo: true });
    expect(ada.penandaProdeoSumber).toEqual(["flag-sipp", "ecourt"]);
    const biasa = penandaPihak.ruasBaris(bahan, 10400);
    expect(biasa.penandaPerkara.prodeo).toBe(false);
    expect(biasa.penandaProdeoSumber).toEqual([]);
  });

  it("Status Perkara (sippTahapanService.penandaPerkara) membawa prodeo dari prodeoPerkaraService, bukan kueri sendiri", () => {
    const berkas = baca("aleta_bot/services/sippTahapanService.js");
    const blok = berkas.slice(berkas.indexOf("async function penandaPerkara("), berkas.indexOf("async function pihakPerkara("));
    expect(blok).toContain("prodeoPerkaraService");
    expect(blok).toContain("penandaProdeoPerkara(");
    expect(blok).toMatch(/prodeo: tandaProdeo\.prodeo/);
    expect(blok).toMatch(/sumberProdeo: tandaProdeo\.sumberProdeo/);
    // Jalur pintas (id tak sah) membawa ruas yang sama, supaya layar tidak membaca undefined.
    expect(blok).toContain("prodeo: null, sumberProdeo: []");
    // Penanda checklist/ekstensi memakai sumber yang sama pula.
    expect(baca("aleta_bot/services/penandaSippService.js")).toContain("prodeoPerkaraService.penandaProdeoPerkara(");
  });

  it("tabel ecourt_prodeo terdaftar di daftar tabel skema (kalau tidak, dijawab 'tidak ada' tanpa galat)", () => {
    expect(baca("aleta_bot/services/sippSkemaService.js")).toMatch(/"ecourt_prodeo",/);
  });
});

describe("sippSkemaService tidak mengingat bacaan skema yang gagal atau kosong", () => {
  function muatSkema(jawaban: Array<"gagal" | "kosong" | "isi">) {
    const Module = muat("module") as unknown as new (id: string) => { filename: string; loaded: boolean; exports: unknown };
    const jalurDb = muat.resolve(path.join(AKAR, "aleta_bot/db_config"));
    const jalurSkema = muat.resolve(path.join(AKAR, "aleta_bot/services/sippSkemaService"));
    let panggilan = 0;
    const m = new Module(jalurDb);
    m.filename = jalurDb;
    m.loaded = true;
    m.exports = {
      query: (_sql: string, _p: unknown[], balik: (g: unknown, h?: unknown) => void) => {
        const j = jawaban[Math.min(panggilan, jawaban.length - 1)];
        panggilan += 1;
        if (j === "gagal") balik(new Error("SIPP belum tersambung"));
        else if (j === "kosong") balik(null, []);
        else balik(null, [{ tabel: "perkara", kolom: "prodeo" }]);
      },
    };
    (muat.cache as Record<string, unknown>)[jalurDb] = m;
    delete (muat.cache as Record<string, unknown>)[jalurSkema];
    return { skemaSvc: muat(jalurSkema) as { kolomAda: (t: string, k: string) => Promise<boolean> }, hitung: () => panggilan };
  }

  it("bacaan pertama GAGAL: panggilan berikutnya membaca ulang dan berhasil (dulu ditolak terus)", async () => {
    const { skemaSvc, hitung } = muatSkema(["gagal", "isi"]);
    await expect(skemaSvc.kolomAda("perkara", "prodeo")).rejects.toThrow("SIPP belum tersambung");
    expect(await skemaSvc.kolomAda("perkara", "prodeo")).toBe(true);
    expect(hitung()).toBe(2);
  });

  it("bacaan pertama KOSONG: tidak diingat, panggilan berikutnya membaca ulang", async () => {
    const { skemaSvc } = muatSkema(["kosong", "isi"]);
    expect(await skemaSvc.kolomAda("perkara", "prodeo")).toBe(false);
    expect(await skemaSvc.kolomAda("perkara", "prodeo")).toBe(true);
  });

  it("bacaan yang berisi tetap diingat (tidak membaca information_schema tiap kueri)", async () => {
    const { skemaSvc, hitung } = muatSkema(["isi"]);
    await skemaSvc.kolomAda("perkara", "prodeo");
    await skemaSvc.kolomAda("perkara", "prodeo");
    expect(hitung()).toBe(1);
  });
});

describe("lencana Prodeo di layar", () => {
  it("rumusan bersama: keterangan menyebut sumber bila ada", () => {
    expect(lencanaProdeo().judul).toBe("Perkara prodeo: biaya perkara dibebaskan (ditanggung negara).");
    expect(lencanaProdeo(["ecourt"]).judul).toContain("persetujuan prodeo dari e-Court");
    expect(lencanaProdeo(["flag-sipp", "ecourt"]).judul).toContain("ditandai prodeo di SIPP; persetujuan prodeo dari e-Court");
  });

  it("Jadwal Sidang: baris dengan penandaPerkara.prodeo memberi lencana Prodeo", () => {
    const daftar = lencanaPerkara({
      lewatEcourt: true,
      ecourtTerbaca: true,
      penandaPerkara: { ghaib: false, prodeo: true },
      penandaProdeoSumber: ["flag-sipp"],
    });
    expect(daftar.map((l) => l.kunci)).toEqual(["prodeo"]);
    expect(daftar[0].judul).toContain("ditandai prodeo di SIPP");
  });

  it("Status Perkara: komponen LencanaProdeo tergambar berhuruf terbaca dan berketerangan", () => {
    const { container } = render(createElement(LencanaProdeo, { sumber: ["flag-sipp"] }));
    const el = container.querySelector('[data-lencana="prodeo"]') as HTMLElement;
    expect(el.textContent).toBe("Prodeo");
    expect(el.getAttribute("title")).toContain("Perkara prodeo");
    // text-xs = 12px (>= 11,5px); tanpa label teknis.
    expect(el.className).toContain("text-xs");
    expect(el.textContent).not.toMatch(/flag|ecourt|perkara\./i);
  });

  it("layar Status Perkara menggambar lencana hanya bila penanda.prodeo === true", () => {
    const berkas = baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx");
    expect(berkas).toContain('import { LencanaProdeo } from "@/components/portal/penanda-perkara-pihak";');
    expect(berkas).toContain("status.penanda?.prodeo === true ? <LencanaProdeo sumber={status.penanda.sumberProdeo} />");
  });
});
