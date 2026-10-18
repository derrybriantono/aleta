// @vitest-environment node
/**
 * ============================================================================
 * PETA ALUR SIDANG -> BAS (paket ABT abt-bas-alur-sidang, 12 Okt 2026)
 * ============================================================================
 *
 * Yang dijaga:
 *   - petanya utuh (13 alur, menu ABT 960-972, folder berawalan "ALUR NN", langkah berawalan "[kode]" di nama berkasnya);
 *   - penebak alur memilih alur dan langkah yang benar untuk keadaan sidang yang NYATA di SIPP PA Donggala (frekuensi
 *     alur diukur dari 10.078 perkara berstatus: verstek 2 sidang paling umum, itsbat 1 sidang, kontradiktoir 3-9 sidang,
 *     T hadir lalu tidak hadir, gugur, cabut, NO, ikrar talak);
 *   - baris BAS massal membawa `alurBas` tanpa mengubah usulan blangko yang sudah ada.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { susunBarisBasMassal, type BarisSidangBas } from "@/app/api/aleta-ecourt/bas-massal/susun";
import { ALUR_BAS, alurBasMenurutId, grupJenisAlur, tentukanAlurBas } from "@/lib/alur-bas";

const CG = "Cerai Gugat";
const CT = "Cerai Talak";

function tebak(m: Partial<Parameters<typeof tentukanAlurBas>[0]> & { jenisPerkara: string }) {
  const h = tentukanAlurBas({ urutanSidang: 1, dihadiriOleh: null, ...m });
  return { id: h.alur?.id ?? null, kode: h.langkah?.kode ?? null, h };
}

describe("A. isi peta", () => {
  it("13 alur, id/menu/folder berurutan dan unik", () => {
    expect(ALUR_BAS).toHaveLength(13);
    ALUR_BAS.forEach((a, i) => {
      expect(a.nomor).toBe(i + 1);
      expect(a.id).toBe(`alur-${String(i + 1).padStart(2, "0")}`);
      expect(a.menuId).toBe(960 + i);
      expect(a.folder).toBe(`derry_briantono/ALUR ${String(i + 1).padStart(2, "0")} ${a.nama}`);
      expect(a.jenisMin).toBeLessThanOrEqual(a.jenisMaks);
    });
    expect(new Set(ALUR_BAS.map((a) => a.folder)).size).toBe(13);
    expect(new Set(ALUR_BAS.map((a) => a.menuId)).size).toBe(13);
  });

  it("tiap langkah: kode unik per alur, nama berkas berawalan [kode] dan berakhiran .rtf, tanpa karakter terlarang", () => {
    let total = 0;
    for (const a of ALUR_BAS) {
      const kode = new Set<string>();
      expect(a.langkah.length).toBeGreaterThan(0);
      for (const l of a.langkah) {
        total += 1;
        expect(kode.has(l.kode), `${a.id} kode ganda ${l.kode}`).toBe(false);
        kode.add(l.kode);
        expect(l.berkas.startsWith(`[${l.kode}] `), l.berkas).toBe(true);
        expect(l.berkas.endsWith(".rtf")).toBe(true);
        expect(l.berkas).not.toMatch(/[\\/:*?"<>|]/);
        expect(l.ke).toBeGreaterThanOrEqual(0);
      }
      // Tiap alur punya paling sedikit satu langkah yang menutup sidang (terakhir) atau pertama untuk alur 1 sidang.
      expect(a.langkah.some((l) => l.peran === "terakhir" || l.peran === "pertama"), a.id).toBe(true);
    }
    expect(total).toBe(63); // I2 16 Okt: + ALUR 10 [4] ikrar P & T tidak hadir (paket abt-ikrar-derry)
  });

  it("jenis perkara: Cerai Gugat/Talak, Itsbat (dua tulisan SIPP), Dispensasi, Asal Usul Anak, permohonan lain", () => {
    expect(grupJenisAlur("Cerai Gugat")).toBe("cerai-gugat");
    expect(grupJenisAlur("Cerai Talak")).toBe("cerai-talak");
    expect(grupJenisAlur("Pengesahan Perkawinan/Istbat Nikah")).toBe("itsbat");
    expect(grupJenisAlur("Istbat Nikah")).toBe("itsbat");
    expect(grupJenisAlur("Dispensasi Kawin")).toBe("dispensasi");
    expect(grupJenisAlur("Asal Usul Anak")).toBe("asal-usul");
    expect(grupJenisAlur("P3HP/Penetapan Ahli Waris")).toBe("permohonan-lain");
    expect(grupJenisAlur("Perwalian")).toBe("permohonan-lain");
    expect(grupJenisAlur("Wali Adhol")).toBe("permohonan-lain");
    expect(grupJenisAlur("Harta Bersama")).toBe("");
    expect(grupJenisAlur(null)).toBe("");
  });
});

describe("B. penebak alur - keadaan sidang nyata", () => {
  it("VERSTEK: sidang 1 T tidak hadir -> alur 02 [1]; sidang 2 -> alur 02 [2]; varian saksi menjadi alternatif", () => {
    const s1 = tebak({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 2 });
    expect([s1.id, s1.kode, s1.h.perkiraan]).toEqual(["alur-02", "1", true]);
    expect(s1.h.alternatif.map((l) => l.kode)).toEqual(["1a"]);
    const s2 = tebak({ jenisPerkara: CT, urutanSidang: 2, dihadiriOleh: 2 });
    expect([s2.id, s2.kode]).toEqual(["alur-02", "2"]);
    expect(s2.h.alternatif.map((l) => l.kode)).toEqual(["2a", "2b", "2c"]); // Q3 16 Okt: + 5 saksi
    expect(s2.h.langkah?.berkas).toContain("2 Saksi");
  });

  it("VERSTEK 3+ sidang: agenda bukti/putus -> terakhir [3]; agenda panggil -> lanjutan [2]", () => {
    expect(tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 2, agenda: "Pembuktian" })).toMatchObject({ id: "alur-03", kode: "3" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 2, agenda: "Panggil Tergugat" })).toMatchObject({ id: "alur-03", kode: "2" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 4, dihadiriOleh: 2, agenda: "Pembacaan Putusan" })).toMatchObject({ id: "alur-03", kode: "3" });
  });

  it("KONTRADIKTOIR: T hadir -> alur 04 BAS ke-N (maks 9); lisan -> alur 05", () => {
    expect(tebak({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 1 })).toMatchObject({ id: "alur-04", kode: "1" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 6, dihadiriOleh: 1, agenda: "Pembuktian Penggugat" })).toMatchObject({ id: "alur-04", kode: "6" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 12, dihadiriOleh: 1 })).toMatchObject({ id: "alur-04", kode: "9" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 5, dihadiriOleh: 1 }).h.alternatif.map((l) => l.kode)).toEqual(["5a"]);
    expect(tebak({ jenisPerkara: CT, urutanSidang: 2, dihadiriOleh: 1, agenda: "Jawab menjawab lisan" })).toMatchObject({ id: "alur-05", kode: "2" });
    expect(tebak({ jenisPerkara: CT, urutanSidang: 7, dihadiriOleh: 3, agenda: "Pembuktian lisan" })).toMatchObject({ id: "alur-05", kode: "4" });
  });

  it("T PERNAH HADIR (mediasi) lalu tidak hadir -> alur 06", () => {
    const a = tebak({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, tergugatPernahHadir: true });
    expect([a.id, a.kode]).toEqual(["alur-06", "2"]);
    expect(a.h.langkah?.keterangan).toContain("laporan mediasi");
    const b = tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 2, tergugatPernahHadir: true });
    expect([b.id, b.kode]).toEqual(["alur-06", "3"]);
    // sisi T yang kosong tidak membuat T "pernah hadir"
    expect(tebak({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, tergugatPernahHadir: null }).id).toBe("alur-02");
  });

  it("P DAN T TIDAK HADIR -> alur 07: sidang 1 tunda panggil, sidang 2 putus gugur", () => {
    expect(tebak({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 4 })).toMatchObject({ id: "alur-07", kode: "1" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 4 })).toMatchObject({ id: "alur-07", kode: "3" });
  });

  it("hasil akhir yang sudah diketahui menang atas tebakan: gugur, cabut, NO", () => {
    expect(tebak({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, akhir: "gugur" })).toMatchObject({ id: "alur-07", kode: "3" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 2, akhir: "cabut" })).toMatchObject({ id: "alur-08", kode: "A" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 3, dihadiriOleh: 2, akhir: "cabut" })).toMatchObject({ id: "alur-08", kode: "B" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, akhir: "no" })).toMatchObject({ id: "alur-09", kode: "2" });
    expect(tebak({ jenisPerkara: CG, urutanSidang: 2, dihadiriOleh: 2, akhir: "no" }).h.perkiraan).toBe(false);
  });

  it("IKRAR TALAK (hanya Cerai Talak): P saja -> [1]; P dan T -> [2]; T saja -> [3]", () => {
    expect(tebak({ jenisPerkara: CT, urutanSidang: 3, dihadiriOleh: 2, sidangIkrarTalak: true })).toMatchObject({ id: "alur-10", kode: "1" });
    expect(tebak({ jenisPerkara: CT, urutanSidang: 3, dihadiriOleh: 1, sidangIkrarTalak: true })).toMatchObject({ id: "alur-10", kode: "2" });
    expect(tebak({ jenisPerkara: CT, urutanSidang: 3, dihadiriOleh: 3, sidangIkrarTalak: true })).toMatchObject({ id: "alur-10", kode: "3" });
    // Cerai Gugat tidak punya ikrar: flag diabaikan
    expect(tebak({ jenisPerkara: CG, urutanSidang: 1, dihadiriOleh: 2, sidangIkrarTalak: true }).id).toBe("alur-02");
  });

  it("PERMOHONAN: itsbat, dispensasi, asal usul anak; permohonan lain belum punya BAS", () => {
    expect(tebak({ jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah", urutanSidang: 1, dihadiriOleh: 1 })).toMatchObject({ id: "alur-11", kode: "1" });
    const ke2 = tebak({ jenisPerkara: "Istbat Nikah", urutanSidang: 2, dihadiriOleh: 1 });
    expect([ke2.id, ke2.kode, ke2.h.perkiraan]).toEqual(["alur-11", "1", true]);
    expect(ke2.h.sebab).toContain("belum ada contoh");
    expect(tebak({ jenisPerkara: "Dispensasi Kawin" })).toMatchObject({ id: "alur-12", kode: "1" });
    expect(tebak({ jenisPerkara: "Asal Usul Anak" })).toMatchObject({ id: "alur-13", kode: "1" });
    // Perwalian, wali adhal, ahli waris, pengangkatan anak: belum ada contoh BAS Derry - tidak menebak apa pun.
    for (const j of ["Perwalian", "Wali Adhol", "P3HP/Penetapan Ahli Waris", "Lain-Lain"]) {
      const h = tentukanAlurBas({ jenisPerkara: j, urutanSidang: 2, dihadiriOleh: 1 });
      expect(h.alur, j).toBeNull();
      expect(h.sebab).toContain("belum ada contoh BAS");
    }
  });

  it("jenis tanpa folder alur -> tidak menebak apa pun", () => {
    const h = tentukanAlurBas({ jenisPerkara: "Harta Bersama", urutanSidang: 1, dihadiriOleh: 1 });
    expect(h.alur).toBeNull();
    expect(h.langkah).toBeNull();
  });

  it("urutan sidang tidak terkirim (0): dianggap sidang pertama, tetap perkiraan", () => {
    const h = tebak({ jenisPerkara: CG, urutanSidang: 0, dihadiriOleh: 2 });
    expect([h.id, h.kode, h.h.perkiraan]).toEqual(["alur-02", "1", true]);
  });

  it("langkah yang diusulkan SELALU ada di peta (tidak ada kombinasi yang jatuh ke 'peta rusak')", () => {
    const jenis = [CG, CT, "Istbat Nikah", "Dispensasi Kawin", "Asal Usul Anak", "Perwalian", "Wali Adhol", "P3HP/Penetapan Ahli Waris", "Lain-Lain"];
    for (const j of jenis) {
      for (const u of [0, 1, 2, 3, 4, 5, 9, 15]) {
        for (const h of [null, 1, 2, 3, 4]) {
          for (const pernah of [undefined, true, false]) {
            for (const ik of [false, true]) {
              for (const akhir of [null, "gugur", "cabut", "no"] as const) {
                const r = tentukanAlurBas({ jenisPerkara: j, urutanSidang: u, dihadiriOleh: h, tergugatPernahHadir: pernah, sidangIkrarTalak: ik, akhir, agenda: u % 2 ? "Pembuktian" : "Jawaban lisan" });
                if (grupJenisAlur(j) === "permohonan-lain") {
                  expect(r.alur).toBeNull();
                  continue;
                }
                expect(r.alur, `${j} u${u} h${h}`).not.toBeNull();
                expect(r.langkah, `${j} u${u} h${h}`).not.toBeNull();
                expect(r.sebab).not.toMatch(/Peta alur BAS rusak/);
                expect(alurBasMenurutId(r.alur!.id)?.langkah.includes(r.langkah!)).toBe(true);
                for (const alt of r.alternatif) expect(r.alur!.langkah.includes(alt)).toBe(true);
              }
            }
          }
        }
      }
    }
  });
});

describe("C. baris BAS massal membawa alurBas dan tidak mengubah usulan blangko", () => {
  const dasar: BarisSidangBas = {
    sidangId: "s1",
    perkaraId: "100",
    nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
    jenisPerkara: CG,
    tanggalSidang: "2026-10-12",
    jamSidang: "09:00",
    agenda: "Sidang Pertama",
    urutanSidang: 1,
    dihadiriOleh: 2,
    paniteraNama: "PP Satu",
  };

  function susun(baris: BarisSidangBas[]) {
    return susunBarisBasMassal(baris, { namaAkun: "PP Satu", saringan: "semua", katalog: {}, lembar: {}, saat: null }).baris;
  }

  it("verstek sidang 1 dan 2 -> alur 02 langkah [1] dan [2], dengan folder & berkas lengkap", () => {
    const [a, b] = susun([dasar, { ...dasar, nomorPerkara: "2/Pdt.G/2026/PA.Dgl", perkaraId: "101", urutanSidang: 2, agenda: "Pembuktian" }]);
    expect(a.alurBas).toMatchObject({ id: "alur-02", kode: "1", perkiraan: true });
    expect(a.alurBas?.folder).toBe("derry_briantono/ALUR 02 Cerai Verstek 2 Sidang");
    expect(a.alurBas?.berkas).toBe("[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf");
    expect(b.alurBas).toMatchObject({ id: "alur-02", kode: "2" });
    expect(b.alurBas?.alternatif).toHaveLength(3); // Q3 16 Okt: 2a, 2b, 2c
  });

  it("kontradiktoir dan ikrar talak dibaca dari baris bot (dihadiriOleh, panggilan, sidangIkrarTalak)", () => {
    const [k, i, hib] = susun([
      { ...dasar, nomorPerkara: "3/Pdt.G/2026/PA.Dgl", perkaraId: "102", urutanSidang: 4, dihadiriOleh: 1 },
      { ...dasar, nomorPerkara: "4/Pdt.G/2026/PA.Dgl", perkaraId: "103", jenisPerkara: CT, urutanSidang: 3, dihadiriOleh: 2, sidangIkrarTalak: true },
      { ...dasar, nomorPerkara: "5/Pdt.G/2026/PA.Dgl", perkaraId: "104", urutanSidang: 3, dihadiriOleh: 2, panggilan: { tergugatPernahHadir: true } },
    ]);
    expect(k.alurBas).toMatchObject({ id: "alur-04", kode: "4" });
    expect(i.alurBas).toMatchObject({ id: "alur-10", kode: "1" });
    expect(hib.alurBas).toMatchObject({ id: "alur-06", kode: "3" });
  });

  it("jenis tanpa folder alur -> alurBas null dan tanpa pilihan; tanpa katalog arsip, pilihan hanya dari penebak alur (Q3 16 Okt)", () => {
    const [x] = susun([{ ...dasar, jenisPerkara: "Zakat" }]); // I28 18 Okt: Hibah kini punya ALUR 47; G3 15 Okt: Harta Bersama kini punya BAS (alur-bas-baru); F22 17 Okt: ES Pdt.G (acara biasa) dan Wasiat pun
    expect(x.alurBas).toBeNull();
    expect(x.blangko.pilihan).toEqual([]);
    expect(x.blangko.usulan).toBeNull();
    // Q3 16 Okt: dulu tanpa katalog = tanpa pilihan; kini langkah alur menjadi pilihan lewat salinannya di "1 Perceraian CG - BAS".
    const [y] = susun([dasar]);
    expect(y.blangko.usulan?.berkas).toBe("[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf");
    expect(y.blangko.usulan?.perkiraan).toBe(true);
    expect(y.blangko.usulan?.salinan?.[0]).toMatchObject({ menu: "Cerai Gugat - BAS" });
    expect(y.blangko.pilihan.length).toBeGreaterThan(1);
  });
});

describe("D. ekstensi BAS massal menampilkan alur (jsdom, basmassal.js sungguhan, jawaban dari susun.ts sungguhan)", () => {
  const EKSTENSI = path.resolve(process.cwd(), "..", "ekstensi-sipp");
  const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
  const polos = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const terbuka: JSDOM[] = [];
  afterEach(async () => {
    await tunggu(20);
    while (terbuka.length) terbuka.pop()!.window.close();
  });

  it("chip 'alur NN [kode]' tampil per baris (perkiraan bertanda), baris tanpa folder alur tanpa chip, tanpa permintaan non-GET", async () => {
    const dasar: BarisSidangBas = {
      sidangId: "s1",
      perkaraId: "1",
      nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      jenisPerkara: CG,
      tanggalSidang: "2026-10-12",
      jamSidang: "09:00",
      agenda: "Sidang Pertama",
      urutanSidang: 1,
      dihadiriOleh: 2,
      paniteraNama: "Siti Aminah",
    };
    const baris = susunBarisBasMassal(
      [
        dasar,
        { ...dasar, nomorPerkara: "2/Pdt.G/2026/PA.Dgl", perkaraId: "2", urutanSidang: 2, agenda: "Pembuktian" },
        { ...dasar, nomorPerkara: "3/Pdt.G/2026/PA.Dgl", perkaraId: "3", jenisPerkara: "Zakat" },
      ],
      { namaAkun: "Siti Aminah", saringan: "saya", katalog: {}, lembar: {}, saat: null }
    ).baris;
    const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="wadah"></div></body></html>`, {
      url: "http://192.168.10.10/SIPP/list_perkara",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    } as ConstructorParameters<typeof JSDOM>[1]);
    terbuka.push(dom);
    const w = dom.window as any;
    const simpanan: Record<string, unknown> = { ujiTampilan: "baru" };
    w.chrome = {
      runtime: {
        id: "aleta-uji",
        getManifest: () => ({ version: "1.188.0" }),
        getURL: (x: string) => `chrome-extension://aleta-uji/${x}`,
        lastError: undefined,
        sendMessage: (_m: unknown, balik?: (x: unknown) => void) => setTimeout(() => balik && balik({ ok: true }), 0),
      },
      storage: {
        local: {
          get: async (kunci?: string | string[] | null) => {
            const daftar = kunci == null ? Object.keys(simpanan) : [kunci].flat();
            const hasil: Record<string, unknown> = {};
            for (const k of daftar) if (k in simpanan) hasil[k] = polos(simpanan[k]);
            return hasil;
          },
          set: async (isi: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(isi)) simpanan[k] = polos(v);
          },
          remove: async () => undefined,
        },
        session: { get: async () => ({}), set: async () => undefined },
        onChanged: { addListener: () => undefined },
      },
    };
    const cara: string[] = [];
    w.fetch = async (alamat: string, opsi?: { method?: string }) => {
      cara.push(String((opsi && opsi.method) || "GET").toUpperCase());
      const jalur = String(alamat).replace(/\?.*$/, "");
      if (jalur.endsWith("/ekstensi/siapa")) {
        return Response.json({ ok: true, data: { nama: "Siti Aminah", peran: "Panitera Pengganti", roleId: "panitera-pengganti", peranTambahan: [] } });
      }
      if (jalur.endsWith("/aleta-ecourt/bas-massal")) {
        const data = { tanggal: "2026-10-12", saringan: "saya", lihatSemua: false, jumlahSemua: baris.length, jumlahSaya: baris.length, sidang: polos(baris) };
        return Response.json({ ok: true, data });
      }
      return new Response("{}", { status: 404 });
    };
    w.Response = Response;
    w.console.warn = () => {};
    w.Element.prototype.scrollIntoView = function () {};
    w.eval(`${baca("panel-alat.js")}
;
${baca("basmassal.js")}
;
window.__uji = { mode: () => alatUjiMode() };`);
    const wadah = w.document.getElementById("wadah") as HTMLElement;
    for (let i = 0; i < 300 && w.__uji.mode() !== "baru"; i += 1) await tunggu(10);
    expect(await w.aletaBasMassalPasang(wadah, { situs: "sipp" })).toBe(true);
    const barisDom = (n: number) => wadah.querySelector(`.aleta-basmassal-baris[data-nomor="${n}/Pdt.G/2026/PA.Dgl"]`) as HTMLElement | null;
    for (let i = 0; i < 300 && !barisDom(3); i += 1) await tunggu(10);

    const a = barisDom(1)!;
    expect(a.textContent).toContain("alur 02 [1]");
    const chipA = Array.from(a.querySelectorAll("*")).find((e) => (e.textContent || "").trim() === "alur 02 [1]") as HTMLElement;
    expect(chipA.title).toContain("ALUR 02 Cerai Verstek 2 Sidang");
    expect(chipA.title).toContain("[1] BAS 1 P Hadir & T Tidak Hadir - Tunda Panggil T.rtf");
    expect(chipA.title).toContain("perkiraan");
    expect(barisDom(2)!.textContent).toContain("alur 02 [2]");
    expect(barisDom(3)!.textContent).not.toMatch(/alur \d\d \[/);
    expect(cara.filter((m) => m !== "GET" && m !== "HEAD")).toEqual([]);
  });
});
