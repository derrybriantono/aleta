/**
 * 20 Okt 2026 - panel juru sita ekstensi (jurusita.js) dan portal (lib/relaas-pihak.ts) menjawab SAMA
 * atas contoh-contoh yang sama: struktur pihak permohonan voluntair (alur 16), bukan hanya itsbat 360.
 * Ekstensi tidak dapat mengimpor TS, jadi aturannya disalin (jurusitaStrukturPihak) dan dijaga di sini.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { strukturPihakRelaas } from "@/lib/relaas-pihak";

const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const baca = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");

function muat() {
  const w = new JSDOM("", { runScripts: "outside-only" }).window as any;
  w.eval(
    `${baca("panel-alat.js")}\n;\n${baca("jurusita.js")}\n;window.__j = { struktur: jurusitaStrukturPihak, sebutan: jurusitaSebutan, sebutanItsbat: jurusitaSebutanItsbat, tanpaKedua: jurusitaTanpaPihakKedua, bawaan: jurusitaCentangBawaan };`
  );
  return w.__j;
}
const polos = <T>(x: T): T => JSON.parse(JSON.stringify(x));

type Kasus = { nama: string; alur: number | null; jenis: number | null; nomor: string; jenisNama: string; pertama?: number; kedua?: number };
const KASUS: Kasus[] = [
  { nama: "itsbat dua Pemohon", alur: 16, jenis: 360, nomor: "247/Pdt.P/2026/PA.Dgl", jenisNama: "Pengesahan Perkawinan/Istbat Nikah", pertama: 2, kedua: 0 },
  { nama: "itsbat satu Pemohon", alur: 16, jenis: 360, nomor: "250/Pdt.P/2026/PA.Dgl", jenisNama: "Pengesahan Perkawinan/Istbat Nikah", pertama: 1, kedua: 0 },
  { nama: "itsbat, kedua tak dikirim (bot lama)", alur: 16, jenis: 360, nomor: "251/Pdt.P/2026/PA.Dgl", jenisNama: "Pengesahan Perkawinan/Istbat Nikah", pertama: 1 },
  { nama: "dispensasi dua Pemohon", alur: 16, jenis: 345, nomor: "30/Pdt.P/2026/PA.Dgl", jenisNama: "Dispensasi Kawin", pertama: 2, kedua: 0 },
  { nama: "dispensasi satu Pemohon", alur: 16, jenis: 345, nomor: "31/Pdt.P/2026/PA.Dgl", jenisNama: "Dispensasi Kawin", pertama: 1, kedua: 0 },
  { nama: "wali adhol dengan Termohon", alur: 16, jenis: 343, nomor: "5/Pdt.P/2026/PA.Dgl", jenisNama: "Wali Adhol", pertama: 1, kedua: 1 },
  { nama: "permohonan, kedua tak dikirim (bukan itsbat)", alur: 16, jenis: 343, nomor: "6/Pdt.P/2026/PA.Dgl", jenisNama: "Wali Adhol", pertama: 1 },
  { nama: "permohonan, jumlah tak terbaca", alur: 16, jenis: 345, nomor: "7/Pdt.P/2026/PA.Dgl", jenisNama: "Dispensasi Kawin" },
  { nama: "cerai gugat", alur: 15, jenis: 347, nomor: "679/Pdt.G/2026/PA.Dgl", jenisNama: "Cerai Gugat", pertama: 1, kedua: 1 },
  { nama: "cerai talak (Pemohon/Termohon, alur 15)", alur: 15, jenis: 346, nomor: "517/Pdt.G/2026/PA.Dgl", jenisNama: "Cerai Talak", pertama: 1, kedua: 1 },
];

function masukanTs(k: Kasus) {
  return {
    alurPerkaraId: k.alur,
    jenisPerkaraId: k.jenis,
    nomorPerkara: k.nomor,
    jenisPerkara: k.jenisNama,
    jumlahPihak: k.pertama === undefined ? null : { pertama: k.pertama, kedua: k.kedua, lain: 0 },
  };
}

describe("jurusita.js == relaas-pihak.ts (struktur pihak)", () => {
  for (const k of KASUS) {
    it(k.nama, () => {
      const j = muat();
      const ts = strukturPihakRelaas(masukanTs(k));
      // Bentuk rute (jumlahPihak) DAN bentuk rincian (jumlahPihakPertama/Kedua) harus menjawab sama.
      const dasar = j.sebutan(k.nomor, k.jenisNama, k.alur, k.jenis);
      const dariRute = polos(j.struktur(masukanTs(k), { pertama: dasar.pertama, kedua: dasar.kedua }));
      const dariRincian = polos(
        j.struktur(
          { alurPerkaraId: k.alur, jenisPerkaraId: k.jenis, jumlahPihakPertama: k.pertama ?? null, jumlahPihakKedua: k.kedua ?? null },
          { pertama: dasar.pertama, kedua: dasar.kedua }
        )
      );
      expect(dariRute).toEqual(polos(ts));
      expect(dariRincian).toEqual(dariRute);
      expect(j.tanpaKedua(masukanTs(k))).toBe(!ts.adaPihakKedua);
    });
  }

  it("sebutan panel = sebutan portal; sisi kedua satu Pemohon tetap bersebutan dasar (hanya dimatikan)", () => {
    const j = muat();
    const k = KASUS[0];
    const d = j.sebutan(k.nomor, k.jenisNama, k.alur, k.jenis);
    expect(polos(j.sebutanItsbat(d, masukanTs(k)))).toMatchObject({ pertama: "Pemohon I", kedua: "Pemohon II", k1: "pemohon", k2: "termohon" });
    const satu = KASUS[4];
    expect(polos(j.sebutanItsbat(d, masukanTs(satu)))).toMatchObject({ pertama: "Pemohon", kedua: "Termohon" });
  });

  it("centang bawaan: permohonan voluntair satu Pemohon hanya sisi 1 (semua jenis, bukan hanya itsbat); dua Pemohon dan Termohon [1,2]", () => {
    const j = muat();
    const jadwal = [{ urutanSidang: 1, tanggalSidang: "2026-10-28", dihadiriOleh: null }];
    const rincian = (k: Kasus) => ({ alurPerkaraId: k.alur, jenisPerkaraId: k.jenis, jumlahPihakPertama: k.pertama, jumlahPihakKedua: k.kedua });
    expect(polos(j.bawaan(jadwal, 1, rincian(KASUS[4]))).panggilan).toEqual([1]); // dispensasi satu Pemohon
    expect(polos(j.bawaan(jadwal, 1, rincian(KASUS[3]))).panggilan).toEqual([1, 2]); // dispensasi dua Pemohon
    expect(polos(j.bawaan(jadwal, 1, rincian(KASUS[5]))).panggilan).toEqual([1, 2]); // wali adhol + Termohon
    expect(polos(j.bawaan(jadwal, 1, rincian(KASUS[8]))).panggilan).toEqual([1, 2]); // cerai gugat
    // Pengumuman tetap hanya itsbat.
    expect(polos(j.bawaan(jadwal, 1, rincian(KASUS[1]))).pengumuman).toBe(true);
    expect(polos(j.bawaan(jadwal, 1, rincian(KASUS[4]))).pengumuman).toBe(false);
  });
});
