import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { LencanaPekerjaanBaris, LencanaPerkaraBaris } from "@/components/portal/penanda-perkara-pihak";
import {
  judulLencanaPekerjaan,
  lencanaPekerjaanUntukNama,
  lencanaPerkara,
  tulisanLencanaPekerjaan,
  type LencanaPekerjaanPihak,
} from "@/lib/penanda-perkara-pihak";
import { SAKLAR_TAMPILAN, tampilanBawaan, tampil } from "@/lib/tampilan-antrian-sidang";

/**
 * PENANDA PERKARA & PIHAK (12 Okt 2026, butir 5): ghaib, prodeo, non e-Court di samping
 * nomor perkara; PNS/PPPK/POLRI/TNI/BUMN/BUMD di samping nama pihak; juga di rincian.
 *
 * Yang dijaga, dan DIJALANKAN:
 *   - lencana perkara: e-Court TIDAK diberi tanda; non e-Court HANYA bila bot menyatakan peta
 *     e-Courtnya terbaca (peta gagal = kosong, tidak boleh menuduh seluruh daftar);
 *   - pekerjaan memakai penggolongan ABT yang SUDAH ada (pekerjaanPihakService), bukan aturan kedua:
 *     pensiunan, CPNS, PPPK paruh waktu, aparat desa tidak berlencana; PPPK berlencana sendiri;
 *   - bot mengumpulkan bahan dengan kueri SELECT saja, gagal sendiri-sendiri;
 *   - layar: saklar penanda-perkara/penanda-pekerjaan sungguh dipakai menggambar dan lencananya hilang
 *     bila saklarnya mati.
 */

const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const svc: any = muat(path.join(AKAR, "aleta_bot/services/penandaPerkaraPihakService.js"));
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

afterEach(() => cleanup());

describe("lencana perkara (lib)", () => {
  it("perkara e-Court biasa tanpa ghaib/prodeo TIDAK diberi tanda apa pun", () => {
    expect(
      lencanaPerkara({ lewatEcourt: true, ecourtTerbaca: true, penandaPerkara: { ghaib: false, prodeo: false } })
    ).toEqual([]);
  });

  it("non e-Court ditandai hanya bila peta e-Court terbaca", () => {
    expect(lencanaPerkara({ lewatEcourt: false, ecourtTerbaca: true }).map((l) => l.kunci)).toEqual(["non-ecourt"]);
    // Peta gagal dibaca (kosong): TIDAK menuduh.
    expect(lencanaPerkara({ lewatEcourt: false, ecourtTerbaca: false })).toEqual([]);
    // Bot lama tidak mengirim ruasnya: gagal-tertutup.
    expect(lencanaPerkara({ lewatEcourt: false })).toEqual([]);
  });

  it("urutan tetap: ghaib, prodeo, lalu non e-Court; ghaib menyebut sumbernya", () => {
    const daftar = lencanaPerkara({
      lewatEcourt: false,
      ecourtTerbaca: true,
      penandaPerkara: { ghaib: true, ghaibSumber: ["penanda ghaib pada pihak tergugat/termohon"], prodeo: true },
    });
    expect(daftar.map((l) => l.kunci)).toEqual(["ghaib", "prodeo", "non-ecourt"]);
    expect(daftar[0].judul).toContain("penanda ghaib pada pihak tergugat/termohon");
  });
});

describe("lencana pekerjaan (lib)", () => {
  const lencana: LencanaPekerjaanPihak[] = [
    { sisi: 1, nama: "Andi Pratama", kunci: "PNS", label: "PNS", kalimat: "PNS (dari teks 'ASN Dinas Pendidikan')" },
    { sisi: 2, nama: "Budi Santoso", kunci: "POLRI", label: "POLRI", ragu: true, kalimat: "POLRI (dari teks 'Bhabin')" },
    { sisi: 2, nama: "Citra Lestari", kunci: "PPPK", label: "PPPK" },
  ];

  it("dicocokkan lewat NAMA yang sedang ditampilkan, tanpa beda huruf besar/spasi", () => {
    expect(lencanaPekerjaanUntukNama({ penandaPihak: lencana }, ["andi  PRATAMA"]).map((l) => l.kunci)).toEqual(["PNS"]);
    expect(lencanaPekerjaanUntukNama({ penandaPihak: lencana }, ["Budi Santoso", "Citra Lestari"]).map((l) => l.kunci)).toEqual([
      "POLRI",
      "PPPK",
    ]);
    expect(lencanaPekerjaanUntukNama({ penandaPihak: lencana }, ["Orang Lain"])).toEqual([]);
    expect(lencanaPekerjaanUntukNama({}, ["Andi Pratama"])).toEqual([]);
  });

  it("satu nama: hanya lencana; lebih dari satu nama: nama depan ikut; ragu diberi tanda tanya", () => {
    expect(tulisanLencanaPekerjaan(lencana[0], 1)).toBe("PNS");
    expect(tulisanLencanaPekerjaan(lencana[0], 2)).toBe("PNS (Andi)");
    expect(tulisanLencanaPekerjaan(lencana[1], 1)).toBe("POLRI?");
    expect(judulLencanaPekerjaan(lencana[1])).toContain("periksa kolom pekerjaan");
    expect(judulLencanaPekerjaan(lencana[0])).toContain("ASN Dinas Pendidikan");
  });
});

describe("bot: penggolongan pekerjaan = penggolongan ABT yang sudah ada", () => {
  const kunci = (t: string) => svc.lencanaPekerjaan(t)?.kunci ?? null;

  it("PNS, PPPK, POLRI, TNI, BUMN, BUMD berlencana; PPPK berlencana SENDIRI (bukan PNS)", () => {
    expect(kunci("Pegawai Negeri Sipil")).toBe("PNS");
    expect(kunci("ASN Dinas Pendidikan")).toBe("PNS");
    expect(kunci("PPPK (Guru SDN Berdikari)")).toBe("PPPK");
    expect(kunci("Anggota POLRI")).toBe("POLRI");
    expect(kunci("Tentara Nasional Indonesia")).toBe("TNI");
    expect(kunci("Karyawan PDAM Donggala")).toBe("BUMD");
  });

  it("keputusan 11 Okt: pensiunan, CPNS, PPPK paruh waktu, aparat desa, swasta TIDAK berlencana", () => {
    for (const t of [
      "Pensiunan PNS",
      "CPNS Guru SD Panggalasiang",
      "Pegawai Pemerintahan dengan Perjanjian Kerja  Paruh Waktu ( Operatur Layanan  Operasional di Dinas Perindustrian)",
      "Kepala Desa",
      "Petani",
      "Wiraswasta",
      "",
    ]) {
      expect(kunci(t), t).toBeNull();
    }
  });

  it("sebutan BUMN/BUMD: pilihan SIPP yang menyebut keduanya jadi BUMN/BUMD, hanya BUMD tetap BUMD", () => {
    expect(svc.lencanaPekerjaan("Pegawai BUMN/BUMD").label).toBe("BUMN/BUMD");
    expect(svc.lencanaPekerjaan("Pegawai BUMD").label).toBe("BUMD");
    expect(svc.lencanaPekerjaan("Pegawai BUMN").label).toBe("BUMN");
  });

  it("teks bebas yang tak baku bertanda ragu; teks baku SIPP tidak", () => {
    expect(svc.lencanaPekerjaan("Pegawai Negeri Sipil").ragu).toBe(false);
    expect(svc.lencanaPekerjaan("Anggota POLRI").ragu).toBe(true);
  });
});

describe("bot: bahan penanda dari SIPP (hanya SELECT, gagal sendiri-sendiri)", () => {
  const skema = (kolom: Record<string, string[]>) => ({
    kolomAda: async (tabel: string, k: string) => (kolom[tabel] ?? []).includes(k),
    pilihKolom: async (tabel: string, calon: string[]) => calon.find((c) => (kolom[tabel] ?? []).includes(c)) ?? "",
  });

  it("prodeo dibaca dari perkara.prodeo = 1; tanpa kolomnya bukan galat dan tak ada yang ditandai", async () => {
    const sql: string[] = [];
    const hasil = await svc.prodeoBanyakPerkara([1, 2, "3", 0, "x"], {
      skema: skema({ perkara: ["prodeo"] }),
      kueri: async (q: string) => {
        sql.push(q);
        return [{ perkaraId: 2 }];
      },
    });
    expect(hasil).toEqual({ "2": true });
    expect(sql[0]).toMatch(/^SELECT /);
    expect(sql[0]).toContain("prodeo = 1");
    expect(await svc.prodeoBanyakPerkara([1], { skema: skema({ perkara: [] }), kueri: async () => [{ perkaraId: 1 }] })).toEqual({});
  });

  it("pekerjaan pihak: hanya yang berlencana, dengan sisi dan nama", async () => {
    const hasil = await svc.pekerjaanPihakBanyakPerkara([10], {
      skema: skema({ pihak: ["pekerjaan"] }),
      kueri: async (q: string) => {
        expect(q).toMatch(/^SELECT /);
        expect(q).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
        return [
          { perkaraId: 10, sisi: 1, urutan: 1, nama: "Andi Pratama", pekerjaan: "Pegawai Negeri Sipil" },
          { perkaraId: 10, sisi: 2, urutan: 1, nama: "Budi", pekerjaan: "Petani" },
          { perkaraId: 10, sisi: 2, urutan: 2, nama: "Citra", pekerjaan: "PPPK (Guru)" },
          { perkaraId: 10, sisi: 4, urutan: 1, nama: "Dewi", pekerjaan: "Pensiunan PNS" },
        ];
      },
    });
    expect(hasil["10"].map((x: { nama: string; kunci: string; sisi: number }) => `${x.sisi}:${x.nama}:${x.kunci}`)).toEqual([
      "1:Andi Pratama:PNS",
      "2:Citra:PPPK",
    ]);
  });

  it("bagian yang gagal ditandai tidak terbaca, bagian lain tetap jalan; ghaib dipinjam dari sippTahapanService", async () => {
    const bahan = await svc.bahanPenanda([5, 6], {
      skema: skema({ perkara: ["prodeo"], pihak: ["pekerjaan"] }),
      kueri: async (q: string) => {
        if (q.includes("prodeo")) throw new Error("tabel rusak");
        return [{ perkaraId: 5, sisi: 1, urutan: 1, nama: "Andi", pekerjaan: "TNI" }];
      },
      tahapan: () => ({ penandaGhaibBanyakPerkara: async () => ({ "6": { ghaib: true, sumber: ["jarak PHS ke sidang pertama 130 hari"], jarakPhsHari: 130 } }) }),
    });
    expect(bahan.terbaca).toEqual({ prodeo: false, pekerjaan: true, izinCerai: true });
    const lima = svc.ruasBaris(bahan, 5);
    const enam = svc.ruasBaris(bahan, 6);
    expect(lima.penandaPerkara).toEqual({ ghaib: false, ghaibSumber: [], prodeo: false });
    expect(lima.penandaPihak[0]).toMatchObject({ nama: "Andi", kunci: "TNI" });
    expect(enam.penandaPerkara).toMatchObject({ ghaib: true, ghaibSumber: ["jarak PHS ke sidang pertama 130 hari"] });
    expect(enam.penandaPihak).toEqual([]);
    expect(enam.penandaProdeoTerbaca).toBe(false);
    expect(enam.penandaPekerjaanTerbaca).toBe(true);
  });

  it("jadwal sidang: peta e-Court yang gagal dicatat, dan ruas penanda ditempel dari satu blok berlabel", () => {
    const sumber = baca("aleta_bot/services/sippJadwalSidangService.js");
    expect(sumber).toContain('aman(() => ecourtBanyakPerkara(idPerkara), "ecourt")');
    expect(sumber).toContain("ecourtTerbaca: !gagal.has(\"ecourt\")");
    expect(sumber).toContain("penandaPerkaraPihakService.ruasBaris(bahanPenandaB, row.perkaraId)");
    expect(sumber.match(/12OKT-B/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("ghaib memakai penciri yang SUDAH ada, bukan penciri baru", () => {
    const sumber = baca("aleta_bot/services/penandaPerkaraPihakService.js");
    expect(sumber).toContain("penandaGhaibBanyakPerkara");
    expect(sumber).not.toMatch(/REGEXP\s+'ghaib/);
  });
});

describe("layar: lencana digambar lewat saklar", () => {
  it("kedua saklar ada di kelompok penanda, menyala sejak awal, dan dapat dimatikan", () => {
    for (const kunci of ["penanda-perkara", "penanda-pekerjaan"]) {
      const s = SAKLAR_TAMPILAN.find((x) => x.kunci === kunci);
      expect(s, kunci).toBeTruthy();
      expect(s?.kelompok).toBe("penanda");
      expect(s?.wajib).toBeFalsy();
      expect(tampil(tampilanBawaan(), kunci)).toBe(true);
    }
  });

  it("layar membaca tampil(tampilan, ...) untuk keduanya dan meneruskannya ke komponen lencana", () => {
    const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
    expect(layar).toContain('tampil(tampilan, "penanda-perkara")');
    expect(layar).toContain('tampil(tampilan, "penanda-pekerjaan")');
    // baris + rincian
    expect(layar.match(/<LencanaPerkaraBaris /g)?.length).toBe(2);
    expect(layar.match(/<LencanaPekerjaanBaris /g)?.length).toBe(4 + 1);
    expect(layar).toContain("aktif={aktifPenandaPerkara}");
    expect(layar).toContain("aktif={aktifPenandaPekerjaan}");
  });

  it("saklar mati: tidak ada lencana sama sekali", () => {
    const baris = {
      lewatEcourt: false,
      ecourtTerbaca: true,
      penandaPerkara: { ghaib: true, prodeo: true },
      penandaPihak: [{ sisi: 1, nama: "Andi", kunci: "PNS", label: "PNS" }],
    };
    const mati = render(
      createElement("div", null, [
        createElement(LencanaPerkaraBaris, { key: "a", baris, aktif: false }),
        createElement(LencanaPekerjaanBaris, { key: "b", baris, nama: ["Andi"], aktif: false }),
      ])
    );
    expect(mati.container.querySelector("[data-lencana]")).toBeNull();
    cleanup();
    const hidup = render(
      createElement("div", null, [
        createElement(LencanaPerkaraBaris, { key: "a", baris, aktif: true }),
        createElement(LencanaPekerjaanBaris, { key: "b", baris, nama: ["Andi"], aktif: true }),
      ])
    );
    const tanda = [...hidup.container.querySelectorAll("[data-lencana]")].map((x) => x.textContent);
    expect(tanda).toEqual(["Ghaib", "Prodeo", "Non e-Court", "PNS"]);
  });

  it("perkara e-Court tanpa ghaib/prodeo tidak menggambar kotak apa pun", () => {
    const { container } = render(
      createElement(LencanaPerkaraBaris, {
        baris: { lewatEcourt: true, ecourtTerbaca: true, penandaPerkara: { ghaib: false, prodeo: false } },
        aktif: true,
      })
    );
    expect(container.innerHTML).toBe("");
  });
});
