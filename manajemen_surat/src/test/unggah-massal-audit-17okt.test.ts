// @vitest-environment node
/**
 * ============================================================================
 * PERBAIKAN TEMUAN AUDIT ABT (17 Okt 2026) - UNGGAH MASSAL e-DOC (abt.js 17OKT-F41)
 * ============================================================================
 *
 *   D1  penandaSisa berupa LARIK dihitung dari panjangnya
 *   D2  anonim ABT cadangan: sekali per baris, ada sinyal Hentikan (juga saat Periksa)
 *   D3  putusan massal: kumulasi & keadaan putusan sampai ke pemilih blangko (bot -> portal -> ekstensi)
 *   D4  saklar validasi ABT menyala: BAS yang menunggu acc hakim ditahan
 *   A5  blangko BAS tebakan (usulan.perkiraan) ditahan sampai petugas menandai sudah diperiksa
 *
 * Semua jaringan dan basis data TIRUAN; tidak ada yang ditulis ke SIPP/ABT.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { hakUnggahMassal, susunDaftarUnggahMassal } from "@/server/modules/aleta-ecourt/unggah-massal";
import type { UnggahMassalDaftarBot } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(import.meta.url);
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

const HAKIM = { id: "usr_h", name: "Hakim Satu", roleId: "hakim", additionalRoleIds: [] };

function bagianF41(): string {
  const isi = baca("ekstensi-sipp/abt.js");
  const awal = isi.indexOf("/* === 17OKT-F41:");
  const akhir = isi.indexOf("/* === AKHIR 17OKT-F41 === */", awal);
  if (awal < 0 || akhir < 0) throw new Error("bagian 17OKT-F41 tidak ada di abt.js");
  return isi.slice(awal, akhir);
}

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaEkstensi() {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, { url: "http://192.168.10.10/aps_badilag/abt/main/beranda", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  w.eval(`${bagianF41()}\nwindow.__f41 = { f41Mesin, aletaUnggahMassalBuka, f41Bawaan };`);
  return { w, f: w.__f41 };
}

const RTF_PUT = new TextEncoder().encode("{\\rtf1 PUTUSAN}").buffer;
const RTF_ANON = new TextEncoder().encode("{\\rtf1 PENGGUGAT}").buffer;
const jsonRes = (status: number, isi: unknown) => ({ ok: status < 400, status, json: async () => isi });
const tunggu = async <T>(fn: () => T, ket: string): Promise<NonNullable<T>> => {
  const mulai = Date.now();
  for (;;) {
    const h = fn();
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > 4000) throw new Error(`tidak tercapai: ${ket}`);
    await new Promise((r) => setTimeout(r, 5));
  }
};

const BARIS_PUT = (id: string) => ({
  kunci: `put:${id}`,
  jenis: "putusan",
  perkaraId: id,
  nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
  jenisPerkara: "Cerai Gugat",
  tanggal: "2026-10-15",
  perlu: { putusan: true, anonim: true },
  petugas: [],
  milikSaya: true,
  statusPutusan: "Dikabulkan",
});
const BARIS_BAS = (id: string, urutan = 2) => ({
  kunci: `bas:${id}`,
  jenis: "bas",
  perkaraId: `1${id}`,
  sidangId: id,
  urutan,
  nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`,
  jenisPerkara: "Cerai Gugat",
  tanggal: "2026-10-15",
  petugas: ["Andini"],
  milikSaya: true,
  bukti: [],
});
const SUSUN_PP = {
  hariIni: "2026-10-17",
  sejak: "2026-06-19",
  hak: { putusan: false, bas: true, semua: { putusan: false, bas: false }, peranPutusan: null, peranBas: "pp" },
  saringan: { putusan: "saya", bas: "saya" },
  putusan: [],
  bas: [BARIS_BAS("501"), BARIS_BAS("502", 1)],
  tertahan: [],
  jumlah: { putusanSaya: 0, putusanSemua: 0, basSaya: 2, basSemua: 2, basTertunggak: 2 },
  galat: [],
};

type Panggilan = { url: string; opsi: any };
function depsTiruan() {
  const minta: Panggilan[] = [];
  const deps: Record<string, any> = {
    ambil: async (url: string, opsi: any) => {
      minta.push({ url, opsi });
      if (url.startsWith("/aleta/api/aleta-ecourt/unggah-massal/cek")) return jsonRes(200, { ok: true, data: { ok: true, adaBaris: true, adaPutusan: false, adaAnonim: false, adaBas: false } });
      if (url.startsWith("/aleta/api/aleta-ecourt/unggah-massal")) return jsonRes(200, { ok: true, data: { ok: true, ...SUSUN_PP } });
      throw new Error(`tak terduga ${url}`);
    },
    klien: () => ({
      periksaHakBuka: async () => ({ ok: true, diizinkan: true }),
      cetak: async () => ({ ok: true, rtf: RTF_PUT, ukuran: 20480, periksa: { penandaSisa: [] } }),
      anonim: async () => ({ ok: false, pesan: "ABT tidak dipakai" }),
    }),
    blangkoPutusan: async () => ({ a: "A", b: "B", berkas: "[01] [Kabul] Cerai" }),
    blangkoBas: async () => ({ a: "A", b: "B", berkas: "BAS 2 Saksi" }),
    anonim: async () => ({ ok: true, rtf: RTF_ANON, ringkas: {}, sisa: [], potongan: [] }),
    pratinjauAnonim: async () => "unggah",
    namaBaku: (nomor: string, berkas: string) => `${nomor.replace(/\//g, "_")} - ${berkas}.rtf`,
    olehUsername: () => "andini",
    jeda: async () => undefined,
    jedaMs: 0,
    catat: () => undefined,
    antrean: () => ({ maju: () => undefined, selesai: () => undefined }),
    sekarang: () => "2026-10-17T10:00:00.000Z",
  };
  return { deps, minta };
}

const klienDengan = (o: Record<string, unknown> = {}) => {
  const panggil: string[] = [];
  const k: Record<string, any> = {
    periksaHakBuka: async () => ({ ok: true, diizinkan: true }),
    cetak: async () => ({ ok: true, rtf: RTF_PUT, ukuran: 20480, periksa: { penandaSisa: [] as unknown } }),
    anonim: async (m: any) => {
      panggil.push(`anonim:${m.perkaraId}`);
      return { ok: false, pesan: "ABT gagal" };
    },
    ...o,
  };
  return { k, panggil };
};

describe("D1. penandaSisa larik", () => {
  it("dihitung dari panjang larik (bukan Number(larik) yang NaN/kode isian)", async () => {
    const { f } = bukaEkstensi();
    for (const [sisa, kata] of [[["1234", "5678"], "2 isian"], [["1234"], "1 isian"], [[], ""]] as const) {
      const t = depsTiruan();
      const { k } = klienDengan({ cetak: async () => ({ ok: true, rtf: RTF_PUT, ukuran: 1, periksa: { penandaSisa: sisa } }) });
      t.deps.klien = () => k;
      const s = await f.f41Mesin(t.deps).siapkan(BARIS_BAS("501"));
      const catatan = s.catatan.join(" ");
      if (kata) expect(catatan).toContain(`${kata} blangko masih kosong`);
      else expect(catatan).not.toMatch(/masih kosong/);
    }
  });
});

describe("D2. anonim ABT cadangan dan Hentikan", () => {
  it("anonim ABT hanya cadangan, SEKALI per baris, membawa sinyal Hentikan; sinyal sudah batal = ABT tidak dipanggil", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan();
    t.deps.anonim = async () => ({ ok: false, sebab: "penyamar ALETA gagal" });
    const { k, panggil } = klienDengan();
    const sinyalDipakai: unknown[] = [];
    k.anonim = async (m: any) => {
      panggil.push(`anonim:${m.perkaraId}`);
      sinyalDipakai.push(m.sinyal);
      return { ok: true, rtf: RTF_ANON, ukuran: 10 };
    };
    t.deps.klien = () => k;
    const m = f.f41Mesin(t.deps);
    const pembatal = new AbortController();
    const s1 = await m.siapkan(BARIS_PUT("348"), undefined, { sinyal: pembatal.signal });
    expect(s1.anonim.sumber).toBe("ABT");
    expect(typeof (sinyalDipakai[0] as AbortSignal).aborted).toBe("boolean"); // sinyal ABT sendiri (Hentikan + batas waktu)
    // periksa ulang baris yang sama: anonim ABT TIDAK diminta lagi
    const s2 = await m.siapkan(BARIS_PUT("348"));
    expect(panggil).toEqual(["anonim:348"]);
    expect(s2.anonim).toBeNull();
    expect(s2.catatan.join(" ")).toMatch(/sudah dicoba/);
    // sinyal batal sebelum anonim ABT: baris berhenti, ABT tidak dipanggil
    const batal = new AbortController();
    batal.abort();
    const s3 = await m.siapkan(BARIS_PUT("349"), undefined, { sinyal: batal.signal });
    expect(panggil).toEqual(["anonim:348"]);
    expect(s3.keadaan).toBe("halangan");
    expect(s3.halangan).toMatch(/dihentikan/i);
  });

  it("Hentikan ditekan saat ABT sedang beranonim: sinyal ke ABT ikut batal, baris tidak menggantung", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan();
    t.deps.anonim = async () => ({ ok: false, sebab: "penyamar ALETA gagal" });
    const { k } = klienDengan();
    k.anonim = (m: any) =>
      new Promise((_selesai, tolak) => {
        m.sinyal.addEventListener("abort", () => tolak(new Error("aborted")));
      });
    t.deps.klien = () => k;
    const pembatal = new AbortController();
    const janji = f.f41Mesin(t.deps).siapkan(BARIS_PUT("348"), undefined, { sinyal: pembatal.signal });
    await new Promise((r) => setTimeout(r, 20));
    pembatal.abort();
    const s = await janji;
    expect(s.keadaan).toBe("siap");
    expect(s.anonim).toBeNull();
    expect(s.catatan.join(" ")).toMatch(/dihentikan petugas/);
  });

  it("Hentikan saat Periksa: tombol Hentikan terlihat dan baris sisa tidak diperiksa", async () => {
    const { w, f } = bukaEkstensi();
    const t = depsTiruan();
    let lepas: () => void = () => undefined;
    const tahan = new Promise<void>((r) => (lepas = r));
    const asli = t.deps.ambil;
    t.deps.ambil = async (url: string, opsi: any) => {
      if (url.includes("/unggah-massal/cek") && url.includes("sidangId=501")) await tahan;
      return asli(url, opsi);
    };
    const tirai = f.aletaUnggahMassalBuka("", t.deps);
    const d = w.document as Document;
    await tunggu(() => d.querySelector('[data-kunci="bas:501"]'), "daftar");
    (d.querySelector('[data-f41="semua"]') as HTMLElement).click();
    (d.querySelector('[data-f41="periksa"]') as HTMLElement).click();
    const henti = d.querySelector('[data-f41="henti"]') as HTMLButtonElement;
    await tunggu(() => !henti.hidden, "tombol Hentikan tampil saat Periksa");
    henti.click();
    lepas();
    await tunggu(() => (d.querySelector('[data-f41="periksa"]') as HTMLButtonElement).disabled === false, "periksa selesai");
    expect(tirai.__f41.S.siap.has("bas:502")).toBe(false);
    expect(tirai.textContent).toMatch(/dihentikan/i);
    expect(t.minta.filter((x) => x.url.includes("/unggah-massal/cek") && x.url.includes("sidangId=502"))).toHaveLength(0);
  });
});

describe("D3. kumulasi dan keadaan putusan pada unggah massal putusan", () => {
  it("bot: daftar putusan membawa kumulasi, kehadiran sidang putusan, mediasi terakhir; hanya SELECT; gagal baca = tanpa tebakan", async () => {
    const layanan = req(path.join(AKAR, "aleta_bot/services/unggahMassalService.js"));
    const sql: string[] = [];
    const baris = { perkara_id: 9851, nomor_perkara: "348/Pdt.G/2026/PA.Dgl", jenis_perkara_nama: "Cerai Gugat", alur_perkara_id: 15, tanggal_putusan: "2026-07-09", status_putusan: "Dikabulkan", putusan_verstek: "N", ada_putusan: 0, ada_anonim: 0, majelis: "Hakim Satu", panitera: "PP" };
    const dasar = {
      hariIni: async () => "2026-10-17",
      tabelAda: async () => true,
      kolomAda: async () => true,
      kueriAbt: async () => [],
      kueriSipp: async (s: string) => {
        sql.push(s);
        if (/FROM perkara_putusan pp/.test(s)) return [baris];
        if (/dihadiri_oleh AS dihadiriOleh/.test(s)) {
          return [
            { sidangId: 1, perkaraId: 9851, tanggalSidang: "2026-05-01", dihadiriOleh: 1 },
            { sidangId: 2, perkaraId: 9851, tanggalSidang: "2026-06-10", dihadiriOleh: 2 },
            { sidangId: 3, perkaraId: 9851, tanggalSidang: "2026-07-09", dihadiriOleh: 1 },
            { sidangId: 4, perkaraId: 9851, tanggalSidang: "2026-08-20", dihadiriOleh: 4 },
          ];
        }
        return [];
      },
    };
    const lengkap = {
      ...dasar,
      kumulasi: async () => ({ "9851": { daftar: [{ kode: "itsbat-nikah" }] } }),
      mediasi: async () => ({ "9851": { hasil: "S" } }),
    };
    const h = await layanan.buatLayanan(lengkap).daftar({});
    expect(h.putusan[0]).toMatchObject({
      kumulasi: { daftar: [{ kode: "itsbat-nikah" }] },
      kumulasiTerbaca: true,
      dihadiriOleh: 1,
      panggilan: { hadirSebelumnya: 2, tergugatPernahHadir: true, penggugatPernahHadir: true },
      mediasi: { hasil: "S" },
      mediasiTerbaca: true,
    });
    expect(sql.every((s) => /^\s*SELECT/i.test(s))).toBe(true);
    const gagal = await layanan
      .buatLayanan({
        ...lengkap,
        mediasi: async () => {
          throw new Error("ER");
        },
        kumulasi: async () => {
          throw new Error("ER");
        },
      })
      .daftar({});
    expect(gagal.putusan[0]).toMatchObject({ kumulasi: null, kumulasiTerbaca: false, mediasi: null, mediasiTerbaca: false });
    expect(gagal.galat.map((x: { langkah: string }) => x.langkah)).toEqual(expect.arrayContaining(["kumulasi putusan", "mediasi putusan"]));
  });

  it("portal meneruskan kumulasi & keadaanPutusan per baris; ekstensi memberikannya ke pemilih blangko", async () => {
    const data = {
      ok: true,
      hariIni: "2026-10-17",
      sejak: "2026-06-19",
      abtTerbaca: true,
      galat: [],
      tertahan: [],
      bas: [],
      putusan: [
        {
          perkaraId: "9851",
          nomorPerkara: "348/Pdt.G/2026/PA.Dgl",
          jenisPerkara: "Cerai Gugat",
          alurPerkaraId: 15,
          tanggalPutusan: "2026-07-09",
          statusPutusan: "Dikabulkan",
          verstek: false,
          adaPutusan: false,
          adaAnonim: false,
          majelis: ["Hakim Satu"],
          panitera: [],
          kumulasi: { daftar: [{ kode: "itsbat-nikah" }] },
          dihadiriOleh: 1,
          panggilan: { hadirSebelumnya: 1, tergugatPernahHadir: true, penggugatPernahHadir: true },
          mediasi: { hasil: "S" },
          mediasiTerbaca: true,
        },
      ],
    } as unknown as UnggahMassalDaftarBot;
    const h = susunDaftarUnggahMassal({ data, hak: hakUnggahMassal(HAKIM as never), namaAkun: "Hakim Satu" });
    expect(h.putusan[0].kumulasi).toEqual({ daftar: [{ kode: "itsbat-nikah" }] });
    expect(h.putusan[0].keadaanPutusan).toEqual(["mediasi-sebagian", "kontradiktoir", "sesudah-mediasi"]);

    const { w, f } = bukaEkstensi();
    const diterima: unknown[][] = [];
    w.alatMuatPetaBlangkoLengkap = async () => ({});
    w.alatPetaUntukPerkara = (...a: unknown[]) => {
      diterima.push(a);
      return { baris: { a: "A", b: "B", berkas: "[01] Kumulasi", blangko: "x" } };
    };
    w.alatBlangkoLengkap = () => true;
    w.alatBlangkoTerpetakan = () => true;
    const r = await f.f41Bawaan().blangkoPutusan({ ...BARIS_PUT("348"), ...h.putusan[0] }, () => undefined);
    expect(r.berkas).toBe("[01] Kumulasi");
    expect(diterima[0][4]).toEqual({ daftar: [{ kode: "itsbat-nikah" }] });
    expect(diterima[0][5]).toEqual(["mediasi-sebagian", "kontradiktoir", "sesudah-mediasi"]);
  });
});

describe("D4. validasi hakim (acc BAS) di ABT", () => {
  const antri = [{ tanggal: "2026-10-15", perkaraNomor: "502/Pdt.G/2026/PA.Dgl", sidangTeks: "Kamis, 15 Okt. 2026 Sidang Ke-2", blangko: "BAS 2 Saksi", dibuatOleh: "andini", tautanBuka: { a: "A", b: "B", c: "1502", d: "2" } }];

  it("saklar menyala -> BAS yang menunggu acc ditahan SEBELUM dicetak; sidang lain, perkara lain, saklar mati lolos", async () => {
    const { f } = bukaEkstensi();
    const jalan = async (fiturAktif: boolean, id: string, urutan: number) => {
      const t = depsTiruan();
      const cetak: string[] = [];
      const { k } = klienDengan({
        daftarValidasiBas: async () => ({ ok: true, fiturAktif, saklarAdaDiHalaman: true, baris: antri }),
        cetak: async () => {
          cetak.push(id);
          return { ok: true, rtf: RTF_PUT, ukuran: 1, periksa: { penandaSisa: [] } };
        },
      });
      t.deps.klien = () => k;
      const s = await f.f41Mesin(t.deps).siapkan(BARIS_BAS(id, urutan));
      return { s, cetak };
    };
    const ditahan = await jalan(true, "502", 2);
    expect(ditahan.s.keadaan).toBe("halangan");
    expect(ditahan.s.halangan).toMatch(/menunggu validasi hakim/);
    expect(ditahan.cetak).toEqual([]);
    expect((await jalan(true, "502", 3)).s.keadaan).toBe("siap");
    expect((await jalan(true, "999", 2)).s.keadaan).toBe("siap");
    expect((await jalan(false, "502", 2)).s.keadaan).toBe("siap");
  });

  it("antrian validasi tidak terbaca = tidak dapat memastikan -> ditahan, bukan dilepas", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan();
    const { k } = klienDengan({ daftarValidasiBas: async () => ({ ok: false, pesan: "ABT menjawab 500." }) });
    t.deps.klien = () => k;
    const s = await f.f41Mesin(t.deps).siapkan(BARIS_BAS("502", 2));
    expect(s.keadaan).toBe("halangan");
    expect(s.halangan).toMatch(/validasi/i);
  });
});

describe("A5. blangko BAS tebakan", () => {
  it("usulan.perkiraan = halangan sampai petugas menandai sudah diperiksa; bukan tebakan lolos", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan();
    t.deps.blangkoBas = async () => ({ a: "A", b: "B", berkas: "BAS 1 Biasa", perkiraan: true });
    const m = f.f41Mesin(t.deps);
    const s = await m.siapkan(BARIS_BAS("501"));
    expect(s.keadaan).toBe("halangan");
    expect(s.tebakan).toBe(true);
    expect(s.halangan).toMatch(/perkiraan/);
    expect(m.kiriman(s)).toBeNull();
    const ok = await m.siapkan(BARIS_BAS("501"), undefined, { tebakanDiperiksa: true });
    expect(ok.keadaan).toBe("siap");
    expect(ok.catatan.join(" ")).toMatch(/sudah diperiksa/);
    expect(m.kiriman(ok)).toEqual({ bas: true });
  });

  it("blangkoBas bawaan meneruskan penanda perkiraan dari usulan BAS massal", async () => {
    const { w, f } = bukaEkstensi();
    w.alatAmbil = async () => jsonRes(200, { ok: true, data: { sidang: [{ sidangId: "501", perkaraId: "1501", blangko: { usulan: { folder: "F", berkas: "BAS 1", perkiraan: true } } }] } });
    w.cariTokenBlangko = async () => ({ a: "A", b: "B" });
    const r = await f.f41Bawaan().blangkoBas({ ...BARIS_BAS("501") }, () => undefined);
    expect(r).toMatchObject({ berkas: "BAS 1", perkiraan: true });
  });

  it("layar: baris tebakan menampilkan tombol 'Sudah diperiksa'; ditekan -> baris siap diunggah", async () => {
    const { w, f } = bukaEkstensi();
    const t = depsTiruan();
    t.deps.blangkoBas = async () => ({ a: "A", b: "B", berkas: "BAS 1 Biasa", perkiraan: true });
    f.aletaUnggahMassalBuka("", t.deps);
    const d = w.document as Document;
    await tunggu(() => d.querySelector('[data-kunci="bas:501"]'), "daftar");
    (d.querySelector('[data-f41-centang="bas:501"]') as HTMLInputElement).click();
    (d.querySelector('[data-f41="periksa"]') as HTMLElement).click();
    const tombol = await tunggu(() => d.querySelector('[data-f41-tebakan="bas:501"]') as HTMLElement | null, "tombol sudah diperiksa");
    expect((d.querySelector('[data-f41="unggah"]') as HTMLButtonElement).disabled).toBe(true);
    tombol.click();
    await tunggu(() => /Unggah 1 berkas/.test(d.querySelector('[data-f41="unggah"]')!.textContent || ""), "siap diunggah");
  });
});
