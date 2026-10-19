/**
 * JADWAL-3 tambahan (19 Okt 2026): PP/JS di baris sendiri, dan tautan ke
 * Blangko ABT by Derry (kontrak #bd=). Nomor perkara karangan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { fireEvent, render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { TombolBlangkoDerry } from "@/components/portal/tombol-blangko-derry";
import {
  ALAMAT_APS_BADILAG_SATKER,
  alamatApsBadilag,
  jenisBlangkoBoleh,
  jenisBlangkoMenurutKeadaan,
  muatanBlangkoDerry,
  saringJenisBlangko,
  tautanBlangkoDerry,
} from "@/lib/tautan-blangko-derry";
import { SAKLAR_TAMPILAN, tampilanBawaan } from "@/lib/tampilan-antrian-sidang";

const SRC = path.join(process.cwd(), "src");
const baca = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const LAYAR = baca("components/portal/aleta-ecourt-sidang.tsx");

const DATA = {
  nomor: "633/Pdt.G/2026/PA.Dgl",
  perkaraId: "9633",
  sidangKe: 3,
  tanggalSidang: "2026-10-19 00:00:00",
  agenda: "Pembuktian",
  tunda: "pemeriksaan saksi",
  keterangan: "saksi kedua belum hadir",
  amar: "",
  verstek: null,
  jumlahSaksiP: 2,
  jumlahSaksiT: 0,
};

function bacaHash(url: string) {
  const [dasar, hash] = url.split("#bd=");
  return { dasar, isi: JSON.parse(decodeURIComponent(hash)) };
}

describe("kontrak tautan #bd=", () => {
  it("alamat dan badan JSON persis kontrak, urutan ruas terjaga", () => {
    const url = tautanBlangkoDerry(DATA, "bas");
    const { dasar, isi } = bacaHash(url);
    expect(dasar).toBe("http://192.168.10.10/aps_badilag/abt/");
    expect(url.startsWith("http://192.168.10.10/aps_badilag/abt/#bd=")).toBe(true);
    expect(isi).toEqual({
      v: 1,
      nomor: "633/Pdt.G/2026/PA.Dgl",
      perkaraId: 9633,
      sidangKe: 3,
      tanggalSidang: "2026-10-19",
      jenis: "bas",
      agenda: "Pembuktian",
      tunda: "pemeriksaan saksi",
      keterangan: "saksi kedua belum hadir",
      amar: "",
      verstek: null,
      jumlahSaksiP: 2,
      jumlahSaksiT: 0,
    });
    expect(Object.keys(muatanBlangkoDerry(DATA, "putusan"))).toEqual([
      "v", "nomor", "perkaraId", "sidangKe", "tanggalSidang", "jenis", "agenda", "tunda", "keterangan", "amar", "verstek", "jumlahSaksiP", "jumlahSaksiT",
    ]);
    expect(url).toContain(encodeURIComponent(JSON.stringify(isi)));
  });

  it("alamat dari setelan APS Badilag; setelan bawaan localhost jatuh ke alamat satker", () => {
    expect(alamatApsBadilag("http://localhost/aps_badilag")).toBe(ALAMAT_APS_BADILAG_SATKER);
    expect(alamatApsBadilag("")).toBe(ALAMAT_APS_BADILAG_SATKER);
    expect(alamatApsBadilag("http://10.1.2.3/aps_badilag/index.php/")).toBe("http://10.1.2.3/aps_badilag");
    expect(tautanBlangkoDerry(DATA, "bas", "http://10.1.2.3/aps_badilag")).toMatch(/^http:\/\/10\.1\.2\.3\/aps_badilag\/abt\/#bd=/);
  });

  it("perkaraId kosong = null; verstek hanya benar/salah/null", () => {
    const m = muatanBlangkoDerry({ nomor: "1/Pdt.G/2026/PA.Dgl", verstek: true }, "putusan");
    expect(m.perkaraId).toBeNull();
    expect(m.sidangKe).toBeNull();
    expect(m.verstek).toBe(true);
    expect(m.jumlahSaksiP).toBe(0);
  });
});

describe("keadaan sidang -> jenis blangko, dan hak peran", () => {
  it("ikrar -> penetapan + BAS; putus/akan putus -> putusan + BAS; lainnya -> BAS", () => {
    expect(jenisBlangkoMenurutKeadaan({ ikrarTalak: true, sudahPutus: true })).toEqual(["penetapan", "bas"]);
    expect(jenisBlangkoMenurutKeadaan({ sudahPutus: true })).toEqual(["putusan", "bas"]);
    expect(jenisBlangkoMenurutKeadaan({ akanPutus: true })).toEqual(["putusan", "bas"]);
    expect(jenisBlangkoMenurutKeadaan({})).toEqual(["bas"]);
  });

  it("hakim putusan/ikrar/BAS, PP hanya BAS, super admin semua, lainnya tidak ada", () => {
    expect(jenisBlangkoBoleh({ roleId: "hakim" })).toEqual(["putusan", "penetapan", "bas"]);
    expect(jenisBlangkoBoleh({ roleId: "super-admin" })).toEqual(["putusan", "penetapan", "bas"]);
    expect(jenisBlangkoBoleh({ roleId: "panitera-pengganti" })).toEqual(["bas"]);
    expect(jenisBlangkoBoleh({ roleId: "jurusita" })).toEqual([]);
    expect(jenisBlangkoBoleh(null)).toEqual([]);
    expect(saringJenisBlangko(["putusan", "bas"], ["bas"])).toEqual(["bas"]);
  });

  it("satu jenis = satu tautan; dua jenis = menu dua pilihan; tanpa hak = tidak tampil", () => {
    const satu = render(createElement(TombolBlangkoDerry, { data: DATA, jenis: ["bas"] }));
    const a = satu.container.querySelector("a[data-tombol-blangko-derry='bas']")!;
    expect(a.getAttribute("target")).toBe("_blank");
    expect(bacaHash(a.getAttribute("href")!).isi.jenis).toBe("bas");
    satu.unmount();

    const dua = render(createElement(TombolBlangkoDerry, { data: DATA, jenis: ["putusan", "bas"] }));
    fireEvent.click(dua.container.querySelector("button[data-tombol-blangko-derry='menu']")!);
    const pilihan = Array.from(dua.container.querySelectorAll("[data-pilihan-blangko-derry]"));
    expect(pilihan.map((x) => x.textContent)).toEqual(["Blangko putusan", "Blangko BAS"]);
    expect(bacaHash(pilihan[0].getAttribute("href")!).isi.jenis).toBe("putusan");
    dua.unmount();

    const nol = render(createElement(TombolBlangkoDerry, { data: DATA, jenis: [] }));
    expect(nol.container.innerHTML).toBe("");
  });
});

describe("layar Jadwal Sidang", () => {
  it("tombol Blangko di kolom kanan, keadaan dari baris, disaring peran, punya saklar", () => {
    expect(LAYAR).toContain('{tampil(tampilan, "tombol-blangko") ? (');
    expect(LAYAR).toContain("<TombolBlangkoDerry");
    expect(LAYAR).toContain("ikrarTalak: Boolean(baris.sidangIkrarTalak),");
    expect(LAYAR).toContain("akanPutus: hariPutusan(baris),");
    expect(LAYAR).toContain("jenisBlangkoPeran");
    expect(LAYAR).toContain('panelSettings?.externalApps?.["aps-badilag"]?.baseUrl');
    // di bawah Status, di atas tombol ruang sidang
    const iStatus = LAYAR.indexOf('{tampil(tampilan, "tombol-status-perkara") && onBukaStatus ? (');
    const iBlangko = LAYAR.indexOf("<TombolBlangkoDerry");
    expect(iBlangko).toBeGreaterThan(iStatus);
    expect(LAYAR.indexOf("<TombolRuangSidang", iBlangko)).toBeGreaterThan(iBlangko);
    const s = SAKLAR_TAMPILAN.find((x) => x.kunci === "tombol-blangko");
    expect(s?.kelompok).toBe("alat");
    expect(tampilanBawaan()["tombol-blangko"]).toBe(true);
  });

  it("kolom Majelis & Petugas: kode, nama, PP, JS, mediator, ruang - PP dan JS baris sendiri", () => {
    expect(LAYAR).not.toContain('<span className="text-muted-foreground"> · JS </span>');
    const kode = LAYAR.indexOf("{baris.majelisKode || \"—\"}");
    const pp = LAYAR.indexOf('data-petugas-pp=""');
    const js = LAYAR.indexOf('data-petugas-js=""');
    const med = LAYAR.indexOf('<span className="text-muted-foreground">Mediator </span>');
    const ruang = LAYAR.indexOf('<div className="mt-0.5 text-xs text-muted-foreground">\n                              {baris.ruangan}');
    expect(kode).toBeGreaterThan(0);
    expect(pp).toBeGreaterThan(kode);
    expect(js).toBeGreaterThan(pp);
    expect(med).toBeGreaterThan(js);
    expect(ruang).toBeGreaterThan(med);
    // tiap baris dapat melipat sendiri, tidak disambung " · "
    const blokPp = LAYAR.slice(pp, js);
    expect(blokPp).not.toContain("JS ");
    expect(blokPp).toContain("</div>");
  });
});
