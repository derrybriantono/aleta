/**
 * JADWAL SIDANG 14 Okt 2026 (agen J) - empat permintaan pengguna:
 *
 *   1. agenda KESIMPULAN tidak melewati verifikasi majelis: penandanya "Sudah
 *      diupload" / "Belum upload", tidak pernah "Belum diverifikasi";
 *   2. tulisan lencana berhuruf awal kapital lewat SATU fungsi (formatLencana),
 *      dipakai <Badge> dan lencana buatan sendiri di Jadwal Sidang;
 *   3. lencana "Izin cerai belum ada" (dan "belum dicatat SIPP"/"belum terbaca")
 *      di samping nomor perkara cerai yang pihaknya PNS/ASN (PPPK)/TNI/POLRI;
 *   4. kolom Agenda dilebarkan dengan batas bawah di kepala DAN sel.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { LencanaPerkaraBaris } from "@/components/portal/penanda-perkara-pihak";
import { Badge } from "@/components/ui/badge";
import { formatAnakLencana, formatLencana } from "@/lib/format-lencana";
import { lencanaPerkara } from "@/lib/penanda-perkara-pihak";
import { agendaHanyaKesimpulan, penandaVerifikasi, type DataVerifikasi } from "@/lib/penanda-verifikasi-ecourt";

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const harian: any = muat(path.join(AKAR, "aleta_bot/services/ecourtVerifikasiHarianService.js"));
const izin: any = muat(path.join(AKAR, "aleta_bot/services/izinCeraiService.js"));
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");
const LAYAR = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");

afterEach(() => cleanup());

// ===========================================================================
// 1. KESIMPULAN TANPA VERIFIKASI
// ===========================================================================

describe("butir 1 - agenda kesimpulan: sudah/belum diupload, bukan belum diverifikasi", () => {
  const menunggu = (d: { statusVerifikasi?: string }) => d.statusVerifikasi === "belum";
  const kesimpulan = { jenisDokumen: "Kesimpulan", diunggahPada: "2026-10-13 09:00:00", statusVerifikasi: "belum" };

  it("bot: kesimpulan berstatus 'belum' di e-Court -> sudah-upload (bukan belum)", () => {
    const k = harian.keadaanPerkara({
      dokumen: [kesimpulan],
      diperiksaHariIni: true,
      menunggu,
      perluUnggah: true,
      sidangLalu: "2026-10-07",
      agenda: "Kesimpulan Penggugat dan Tergugat",
    });
    expect(k).toMatchObject({ keadaan: "sudah-upload", belum: 0, unggahBaru: 1 });
  });

  it("bot: belum ada kesimpulan -> belum-upload; data belum ditarik -> tetap tidak-konek/belum-diperiksa", () => {
    const lama = { jenisDokumen: "Duplik", diunggahPada: "2026-10-01 09:00:00", statusVerifikasi: "belum" };
    const opsi = { menunggu, perluUnggah: true, sidangLalu: "2026-10-07", agenda: "Kesimpulan" };
    expect(harian.keadaanPerkara({ ...opsi, dokumen: [lama], diperiksaHariIni: true }).keadaan).toBe("belum-upload");
    expect(harian.keadaanPerkara({ ...opsi, dokumen: [], diperiksaHariIni: false, penarikTersambung: false }).keadaan).toBe("tidak-konek");
    expect(harian.keadaanPerkara({ ...opsi, dokumen: [], diperiksaHariIni: false, penarikTersambung: true }).keadaan).toBe("belum-diperiksa");
  });

  it("bot: agenda lain dan agenda GABUNGAN tetap aturan lama (dokumen menunggu = belum)", () => {
    const replik = { jenisDokumen: "Replik", diunggahPada: "2026-10-13 09:00:00", statusVerifikasi: "belum" };
    expect(
      harian.keadaanPerkara({ dokumen: [replik], diperiksaHariIni: true, menunggu, perluUnggah: true, sidangLalu: "2026-10-07", agenda: "Replik" }).keadaan
    ).toBe("belum");
    expect(
      harian.keadaanPerkara({ dokumen: [kesimpulan], diperiksaHariIni: true, menunggu, perluUnggah: true, sidangLalu: "2026-10-07", agenda: "Duplik dan Kesimpulan" })
        .keadaan
    ).toBe("belum");
    expect(harian.agendaHanyaKesimpulan("Kesimpulan")).toBe(true);
    expect(harian.agendaHanyaKesimpulan("Duplik dan Kesimpulan")).toBe(false);
  });

  it("bot: sudah-upload dianggap tuntas - penarik tidak menariknya berulang", () => {
    expect(harian.keadaanTuntas("sudah")).toBe(true);
    expect(harian.keadaanTuntas("sudah-upload")).toBe(true);
    expect(harian.keadaanTuntas("belum-upload")).toBe(false);
    const sumber = baca("aleta_bot/services/ecourtVerifikasiHarianService.js");
    expect(sumber).not.toMatch(/\.keadaan !== "sudah"/);
  });

  const baris = { nomorPerkara: "520/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-14", lewatEcourt: true, agenda: "Kesimpulan", urutanSidang: 7 };
  const data = (keadaan: string, unggah: number): DataVerifikasi => ({
    terbaca: true,
    tanggal: "2026-10-14",
    perkara: {
      [baris.nomorPerkara]: {
        nomorPerkara: baris.nomorPerkara,
        keadaan: keadaan as never,
        menunggu: keadaan === "belum" ? 1 : 0,
        dokumen: 5,
        terakhirDiperiksa: "2026-10-14 08:10:00",
        diverifikasiOleh: ["Himawan"],
        sidangLalu: "2026-10-07",
        unggahSejakSidangLalu: unggah,
        jenisDituntut: ["kesimpulan"],
      },
    },
  });

  it("portal: bot baru (sudah-upload) dan bot lama (belum + unggahan) sama-sama 'Sudah diupload'", () => {
    for (const d of [data("sudah-upload", 2), data("belum", 2), data("sudah", 1)]) {
      const p = penandaVerifikasi(baris, d, "2026-10-14")!;
      expect(p).toMatchObject({ keadaan: "sudah-upload", label: "Sudah diupload" });
      expect(p.kelas).toContain("emerald");
      expect(p.keterangan).toContain("Kesimpulan sudah diunggah");
      expect(p.keterangan).toContain("tidak melewati verifikasi majelis");
      expect(p.keterangan).not.toContain("Diverifikasi oleh");
    }
  });

  it("portal: kesimpulan belum diunggah -> 'Belum upload' (bukan Belum diverifikasi)", () => {
    const p = penandaVerifikasi(baris, data("belum", 0), "2026-10-14")!;
    expect(p).toMatchObject({ keadaan: "belum-upload", label: "Belum upload" });
    expect(p.keterangan).toContain("belum mengunggah Kesimpulan");
    expect(p.keterangan).toContain("sejak sidang 2026-10-07");
  });

  it("portal: agenda lain tetap seperti sekarang", () => {
    const p = penandaVerifikasi({ ...baris, agenda: "Replik" }, data("belum", 1), "2026-10-14")!;
    expect(p).toMatchObject({ keadaan: "belum", label: "Belum diverifikasi" });
    expect(agendaHanyaKesimpulan("Kesimpulan Penggugat dan Tergugat")).toBe(true);
    expect(agendaHanyaKesimpulan("Duplik / Kesimpulan")).toBe(false);
    expect(agendaHanyaKesimpulan("Rereplik")).toBe(false);
  });
});

// ===========================================================================
// 2. HURUF AWAL KAPITAL
// ===========================================================================

describe("butir 2 - formatLencana: satu aturan huruf awal kapital", () => {
  it("huruf kecil di awal dikapitalkan, sisanya apa adanya", () => {
    expect(formatLencana("potensi verstek")).toBe("Potensi verstek");
    expect(formatLencana("contradictoir")).toBe("Contradictoir");
    expect(formatLencana("belum ada BAS")).toBe("Belum ada BAS");
    expect(formatLencana("contradictoir · P & T hadir")).toBe("Contradictoir · P & T hadir");
    expect(formatLencana("(belum dibaca)")).toBe("(Belum dibaca)");
    expect(formatLencana("belum-upload")).toBe("Belum-upload");
  });

  it("singkatan, e-Court, angka, kode, surel, nomor perkara dibiarkan", () => {
    for (const t of ["PNS", "TNI", "e-Court", "e-Litigasi", "e-court", "eKTP", "v1.199.0", "12 hari", "597/Pdt.G/2026/PA.Dgl", "admin@pa.go.id", "sipp_main", "Ghaib", "", "· putus"]) {
      expect(formatLencana(t), t).toBe(t);
    }
  });

  it("<Badge> memformat anak teks; teksAsli membiarkannya; anak bukan teks tidak disentuh", () => {
    const { container } = render(
      createElement("div", null, [
        createElement(Badge, { key: "a" }, "potensi verstek"),
        createElement(Badge, { key: "b", teksAsli: true }, "hakim"),
        createElement(Badge, { key: "c" }, ["belum ", "dipanggil"]),
        createElement(Badge, { key: "d" }, [3, " retur"]),
      ])
    );
    expect([...(container.firstElementChild?.children ?? [])].map((x) => x.textContent)).toEqual([
      "Potensi verstek",
      "hakim",
      "Belum dipanggil",
      "3 retur",
    ]);
    expect(formatAnakLencana(createElement("span"))).toBeTruthy();
  });

  it("penjaga: tidak ada lencana bulat di Jadwal Sidang yang tulisan tetapnya berhuruf awal kecil", () => {
    const re = /<(span|Badge)\b([^>]*?)>\s*([^<{}]*?[a-z][^<{}]*?)\s*</g;
    const salah: string[] = [];
    for (const m of LAYAR.matchAll(re)) {
      const [, tag, attr, isi] = m;
      if (tag === "span" && !/rounded/.test(attr)) continue;
      const teks = isi.trim().replace(/\s+/g, " ");
      if (tag === "span" && formatLencana(teks) !== teks) salah.push(teks);
    }
    expect(salah).toEqual([]);
  });

  it("label penanda verifikasi lewat formatLencana", () => {
    const sumber = baca("manajemen_surat/src/lib/penanda-verifikasi-ecourt.ts");
    expect(sumber).toContain('sudah: formatLencana("sudah diverifikasi")');
    expect(baca("manajemen_surat/src/components/ui/badge.tsx")).toContain("formatAnakLencana(children)");
  });
});

// ===========================================================================
// 3. IZIN CERAI PNS/ASN/TNI/POLRI
// ===========================================================================

describe("butir 3 - izin cerai: bacaan posita", () => {
  it("posita yang menyebut izin bernomor = ada (550/Pdt.G/2026 terukur)", () => {
    const r = izin.bacaIzinPosita(
      "7. Bahwa Penggugat telah menjalani proses pemeriksaan di instansi tempat Penggugat bekerja. Dari pemeriksaan tersebut telah mendapatkan izin untuk mengajukan perceraian, sebagaimana Keputusan Bupati Sigi Nomor : 800.1.8.5/22.01/BKPSDM tanggal 26 Agustus 2026;"
    );
    expect(r.keadaan).toBe("ada");
    expect(r.cuplikan).toContain("Keputusan Bupati Sigi");
  });

  it("petitum cerai talak 'memberikan izin kepada Pemohon untuk menjatuhkan talak' BUKAN izin atasan (660/Pdt.G/2026)", () => {
    expect(
      izin.bacaIzinPosita(
        "Bahwa oleh karena itu, Pemohon memohon kepada Majelis Hakim untuk menyatakan alasan perceraian telah terbukti dan memberikan izin kepada Pemohon untuk menjatuhkan talak satu raj'i terhadap Termohon;"
      ).keadaan
    ).toBe("tidak");
  });

  it("'belum/sedang mengurus izin atasan' = belum; tanpa kata izin = tidak", () => {
    expect(izin.bacaIzinPosita("Bahwa Penggugat sedang mengurus izin perceraian dari atasan;").keadaan).toBe("belum");
    expect(izin.bacaIzinPosita("Bahwa Penggugat dan Tergugat menikah pada tahun 2022;").keadaan).toBe("tidak");
    expect(izin.bacaIzinPosita("<p>Bahwa&nbsp;Penggugat\\ntelah memperoleh izin cerai dari Kepala BKPSDM;</p>").keadaan).toBe("ada");
  });

  it("judul dokumen e-Court berjudul izin", () => {
    expect(izin.judulIzinEcourt("SK IZIN CERAI PNS Dra.RUGAIYAH")).toBe(true);
    expect(izin.judulIzinEcourt("Dokumen Bukti")).toBe(false);
  });
});

describe("butir 3 - izin cerai: keadaan", () => {
  const P = { sisi: 1, nama: "Nurhayati", kunci: "PNS" };
  const T = { sisi: 2, nama: "Rizal", kunci: "PPPK" };

  it("bukan cerai / tanpa pihak wajib izin / BUMN = tanpa lencana", () => {
    expect(izin.keadaanIzinCerai({ cerai: false, pihak: [P] })).toBeNull();
    expect(izin.keadaanIzinCerai({ cerai: true, pihak: [] })).toBeNull();
    expect(izin.keadaanIzinCerai({ cerai: true, pihak: [{ sisi: 1, nama: "A", kunci: "BUMN" }] })).toBeNull();
    expect(izin.keadaanIzinCerai({ cerai: true, pihak: [{ sisi: 4, nama: "A", kunci: "PNS" }] })).toBeNull();
    expect(izin.jenisCerai(346)).toBe(true);
    expect(izin.jenisCerai(347)).toBe(true);
    expect(izin.jenisCerai(341)).toBe(false);
  });

  it("SIPP perkara_izin_cerai STATUS=1 = ada (tanpa lencana), status lain bukan izin", () => {
    const ada = izin.keadaanIzinCerai({ cerai: true, pihak: [P], izinSipp: [{ status: 1, nomor: "800.09/BKPSDM/207/IV/2026", tanggal: "2026-04-16" }] });
    expect(ada).toMatchObject({ keadaan: "ada", sumber: "sipp" });
    expect(ada.judul).toContain("800.09/BKPSDM/207/IV/2026");
    expect(izin.keadaanIzinCerai({ cerai: true, pihak: [P], izinSipp: [{ status: 0 }] }).keadaan).toBe("belum-ada");
  });

  it("penggugat wajib izin, SIPP & posita kosong = 'Izin cerai belum ada' dengan dasar hukum", () => {
    const r = izin.keadaanIzinCerai({ cerai: true, pihak: [P], izinSipp: [], posita: "Bahwa Penggugat dan Tergugat menikah;" });
    expect(r).toMatchObject({ keadaan: "belum-ada", label: "Izin cerai belum ada" });
    expect(r.judul).toContain("PP 10/1983 jo. PP 45/1990");
    expect(r.judul).toContain("Nurhayati (PNS, penggugat/pemohon)");
  });

  it("SIPP kosong tetapi posita/e-Court menyebut izin = 'Izin cerai belum dicatat SIPP'", () => {
    expect(
      izin.keadaanIzinCerai({ cerai: true, pihak: [P], posita: "Penggugat telah memperoleh izin cerai dari Bupati Donggala Nomor 800/1;" })
    ).toMatchObject({ keadaan: "belum-dicatat", label: "Izin cerai belum dicatat SIPP", sumber: "posita" });
    expect(izin.keadaanIzinCerai({ cerai: true, pihak: [P], judulEcourt: ["SK IZIN CERAI PNS"] })).toMatchObject({
      keadaan: "belum-dicatat",
      sumber: "ecourt",
    });
  });

  it("hanya tergugat yang wajib izin = 'Izin cerai belum terbaca' (SIPP tidak mencatat keterangan tergugat: 0 dari 36 terukur)", () => {
    const r = izin.keadaanIzinCerai({ cerai: true, pihak: [T] });
    expect(r).toMatchObject({ keadaan: "belum-terbaca", label: "Izin cerai belum terbaca" });
    expect(r.judul).toContain("ASN PPPK");
  });

  it("kumpulan perkara: SELECT saja, tabel perkara_izin_cerai, hanya perkara berpihak wajib izin", async () => {
    const sql: string[] = [];
    const hasil = await izin.izinCeraiBanyakPerkara(
      [10, 11, 12],
      { "10": [P], "11": [{ sisi: 1, nama: "B", kunci: "BUMN" }], "12": [T] },
      {
        skema: { kolomAda: async () => true, tabelAda: async (t: string) => t === "perkara_izin_cerai" },
        kueri: async (q: string, p: unknown[]) => {
          sql.push(q);
          expect(q).toMatch(/^\s*SELECT /);
          if (q.includes("FROM perkara WHERE")) {
            expect(p).toEqual([10, 12]);
            return [
              { perkaraId: 10, jenisId: 347, nomor: "1/Pdt.G/2026/PA.Dgl", posita: "Bahwa Penggugat menikah;" },
              { perkaraId: 12, jenisId: 346, nomor: "2/Pdt.G/2026/PA.Dgl", posita: "" },
            ];
          }
          return [];
        },
        judulEcourt: async () => ({}),
      }
    );
    expect(sql.some((q) => q.includes("FROM perkara_izin_cerai"))).toBe(true);
    expect(hasil["10"].keadaan).toBe("belum-ada");
    expect(hasil["12"].keadaan).toBe("belum-terbaca");
    expect(hasil["11"]).toBeUndefined();
  });

  it("perkara_izin_cerai terdaftar di sippSkemaService (tabelAda tidak diam-diam menjawab 'tidak ada')", () => {
    expect(baca("aleta_bot/services/sippSkemaService.js")).toContain('"perkara_izin_cerai"');
  });
});

describe("butir 3 - izin cerai: lencana di samping nomor perkara", () => {
  it("lencanaPerkara menambah lencana izin cerai sesudah ghaib/prodeo/non e-Court; 'ada' tanpa lencana", () => {
    expect(lencanaPerkara({ izinCerai: { keadaan: "ada" } })).toEqual([]);
    expect(lencanaPerkara({ izinCerai: null })).toEqual([]);
    const l = lencanaPerkara({ penandaPerkara: { ghaib: true, prodeo: false }, izinCerai: { keadaan: "belum-ada", judul: "x" } });
    expect(l.map((x) => x.kunci)).toEqual(["ghaib", "izin-cerai-belum-ada"]);
    expect(l[1].label).toBe("Izin cerai belum ada");
  });

  it("dirender di Jadwal Sidang lewat saklar penanda-perkara, warnanya menurut keadaan", () => {
    const html = renderToStaticMarkup(
      createElement(LencanaPerkaraBaris, {
        baris: { lewatEcourt: true, ecourtTerbaca: true, izinCerai: { keadaan: "belum-ada", label: "Izin cerai belum ada", judul: "dasar" } },
        aktif: true,
      })
    );
    expect(html).toContain('data-lencana="izin-cerai-belum-ada"');
    expect(html).toContain("bg-rose-600");
    expect(html).toContain(">Izin cerai belum ada<");
    const abu = renderToStaticMarkup(
      createElement(LencanaPerkaraBaris, { baris: { izinCerai: { keadaan: "belum-terbaca" } }, aktif: true })
    );
    expect(abu).toContain("border-dashed");
    expect(abu).toContain("Izin cerai belum terbaca");
    expect(renderToStaticMarkup(createElement(LencanaPerkaraBaris, { baris: { izinCerai: { keadaan: "belum-ada" } }, aktif: false }))).toBe("");
  });

  it("bot menempelkan izinCerai ke baris jadwal lewat ruasBaris", () => {
    const sumber = baca("aleta_bot/services/penandaPerkaraPihakService.js");
    expect(sumber).toContain("izinCeraiService.izinCeraiBanyakPerkara(id, pekerjaan");
    expect(sumber).toContain("izinCerai: (bahan.izinCerai && bahan.izinCerai[kunci]) || null");
  });
});

// ===========================================================================
// 4. KOLOM AGENDA LEBIH LEBAR
// ===========================================================================

describe("butir 4 - kolom Agenda dilebarkan", () => {
  it("kepala dan sel Agenda sama-sama memakai LEBAR_KOLOM_AGENDA (min-w, bukan w- tetap)", () => {
    expect(LAYAR).toContain('export const LEBAR_KOLOM_AGENDA = "min-w-[12rem] 2xl:min-w-[18rem]";');
    expect(LAYAR).toContain('<KepalaUrut className={cn("px-2", LEBAR_KOLOM_AGENDA)} kunci="agenda"');
    expect(LAYAR).toContain('<td className={cn("px-2 py-2 align-top text-sm", LEBAR_KOLOM_AGENDA)}>');
    const nilai = /LEBAR_KOLOM_AGENDA = "([^"]+)"/.exec(LAYAR)?.[1] ?? "";
    expect(nilai).not.toMatch(/(^|\s)w-/);
  });

  it("kolom Perkara & Para Pihak tetap tanpa batas yang menyaingi", () => {
    const kepala = LAYAR.indexOf("Perkara &amp; Para Pihak");
    const tag = LAYAR.slice(LAYAR.lastIndexOf("<KepalaUrut", kepala), kepala);
    expect(tag).not.toContain("max-w-");
    expect(tag).not.toContain("min-w-");
  });
});
