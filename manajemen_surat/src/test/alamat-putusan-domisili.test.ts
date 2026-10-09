/**
 * BUTIR 9 (1.189.x) - "Isi dari SIPP & input ke ABT": alamat para pihak di
 * PUTUSAN dirapikan dengan perapi alamat PTSP (rapikanAlamat) dan diberi
 * ", Domisili Elektronik: <surel>". Alamat di SIPP TIDAK diubah (PBT juru sita);
 * hasilnya diusulkan ke variabel ABT 8548/8549 (paket abt-alamat-putusan,
 * kosong = alamat SIPP), berkeyakinan "pasti" -> terisi tanpa klik.
 *
 * Bentuk masukan meniru alamat sungguhan dump sipp_donggala 9 Okt (nama
 * tempat dipertahankan, surel diganti). Diukur atas 2.867 alamat pihak
 * 1 Jul 2025 - 9 Okt 2026: 0 domisili ganda, 0 surel hilang, 253 surel tanpa
 * label diberi label, 752 surel e-Court/SIPP ditambahkan.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { alamatPutusan, tambahUsulanAlamat, usulanAlamatPutusan } from "@/lib/alamat-pihak";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const bot = require_(path.join(AKAR, "aleta_bot/services/abtUsulanService.js")) as {
  padankanSurelEcourt: (sipp: unknown[], ecourt: unknown[]) => Array<{ emailEcourt: string }>;
};

describe("alamatPutusan: rapi + Domisili Elektronik", () => {
  it("surel tertulis TANPA label + ekor wilayah dobel e-Court -> label dibakukan, ekor dibuang", () => {
    const a = alamatPutusan(
      "Desa Wangka, Kecamatan Kulawi Selatan, Kabupaten Sigi, Provinsi Sulawesi Tengah, pihak.satu@contoh.com, Wangka, Kulawi Selatan, Kabupaten Sigi, Sulawesi Tengah"
    );
    expect(a.alamat).toBe("Desa Wangka, Kecamatan Kulawi Selatan, Kabupaten Sigi, Provinsi Sulawesi Tengah, Domisili Elektronik: pihak.satu@contoh.com");
    expect(a.berubah).toBe(true);
  });

  it("label lama '. Domisili elektronik : x' / ': :' / ':x' -> ', Domisili Elektronik: x'", () => {
    expect(alamatPutusan("Jalan Lantigau, Desa Labuan, Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah. Domisili elektronik : a.b@contoh.com").alamat).toBe(
      "Jalan Lantigau, Desa Labuan, Kecamatan Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah, Domisili Elektronik: a.b@contoh.com"
    );
    expect(alamatPutusan("Desa Tuwa, RT003, RW003, Kecamatan Gumbasa, Kabupaten Sigi, Provinsi Sulawesi Tengah, Domisili Elektronik::c@contoh.com, Tuwa, Gumbasa, Kabupaten Sigi, Sulawesi Tengah").alamat).toBe(
      "Desa Tuwa, RT003, RW003, Kecamatan Gumbasa, Kabupaten Sigi, Provinsi Sulawesi Tengah, Domisili Elektronik: c@contoh.com"
    );
    expect(alamatPutusan("Jalan Lando, Desa Kalukubula, Kecamatan Sigi Biromaru, Kabupaten Sigi, Provinsi Sulawesi Tengah, Domisili Elektronik:d@contoh.com").alamat).toBe(
      "Jalan Lando, Desa Kalukubula, Kecamatan Sigi Biromaru, Kabupaten Sigi, Provinsi Sulawesi Tengah, Domisili Elektronik: d@contoh.com"
    );
  });

  it("surel e-Court/SIPP yang belum tertulis ditambahkan di ujung; yang sudah tertulis tidak digandakan", () => {
    const a = alamatPutusan("Dusun V , RT002/RW005, Desa Olu, Kecamatan Lindu, Kabupaten Sigi, Provinsi Sulawesi Tengah", "E@Contoh.com");
    expect(a.alamat).toBe("Dusun V, RT002/RW005, Desa Olu, Kecamatan Lindu, Kabupaten Sigi, Provinsi Sulawesi Tengah, Domisili Elektronik: e@contoh.com");
    const b = alamatPutusan("Desa Olu, Kecamatan Lindu, Kabupaten Sigi, Provinsi Sulawesi Tengah, Domisili elektronik : lama@contoh.com", "lain@contoh.com");
    expect(b.alamat.match(/Domisili Elektronik/g)).toHaveLength(1);
    expect(b.alamat).toContain("lama@contoh.com");
    expect(b.alamat).not.toContain("lain@contoh.com");
  });

  it("surel pengadilan/kuasa (.go.id) bukan domisili pihak - tidak ditambahkan", () => {
    expect(alamatPutusan("Desa Olu, Kecamatan Lindu, Kabupaten Sigi, Provinsi Sulawesi Tengah", "info@pa-donggala.go.id").alamat).not.toContain("Domisili");
  });

  it("kebal petik: ' dan \" menjadi ’ (ABT menempel isian ke literal SQL)", () => {
    const a = alamatPutusan("Desa Pani'i, Dusun III, Kecamatan   Dampelas, Kabupaten Donggala, Provinsi Sulawesi Tengah", "f@contoh.com");
    expect(a.alamat).toBe("Desa Pani’i, Dusun III, Kecamatan Dampelas, Kabupaten Donggala, Provinsi Sulawesi Tengah, Domisili Elektronik: f@contoh.com");
    expect(a.alamat).not.toMatch(/["'\\]/);
  });

  it("alamat yang sudah rapi tanpa surel: tidak berubah", () => {
    const a = alamatPutusan("Desa Olu, Kecamatan Lindu, Kabupaten Sigi, Provinsi Sulawesi Tengah");
    expect(a.berubah).toBe(false);
  });
});

describe("usulanAlamatPutusan / tambahUsulanAlamat (rute abt/usulan)", () => {
  const pihak = [
    { pihakKe: 1, urutan: 1, nama: "A", alamat: "Desa Wangka, Kecamatan Kulawi Selatan, Kabupaten Sigi, Provinsi Sulawesi Tengah", emailSipp: "sipp@contoh.com", emailEcourt: "ecourt@contoh.com" },
    { pihakKe: 2, urutan: 1, nama: "B", alamat: "Desa Olu, Kecamatan Lindu, Kabupaten Sigi, Provinsi Sulawesi Tengah", emailSipp: "", emailEcourt: "" },
    { pihakKe: 1, urutan: 2, nama: "C", alamat: "Desa X", emailSipp: "c@contoh.com" },
  ];

  it("8548 (pihak pertama) pasti, surel e-Court didahulukan; 8549 tidak diusulkan karena alamat SIPP sudah rapi", () => {
    const u = usulanAlamatPutusan(pihak);
    expect(u.map((x) => x.kode)).toEqual(["8548"]);
    expect(u[0]).toMatchObject({ keyakinan: "pasti", nilai: "Desa Wangka, Kecamatan Kulawi Selatan, Kabupaten Sigi, Provinsi Sulawesi Tengah, Domisili Elektronik: ecourt@contoh.com" });
    expect(u[0].sumber.map((s) => s.keterangan).join(" ")).toContain("domisili elektronik dari e-Court");
    expect(u[0].catatan).toContain("relaas/PBT tetap memakai alamat SIPP");
  });

  it("ditambahkan ke usulan SIPP bot tanpa menggandakan kode yang sudah diusulkan bot", () => {
    const sipp = { ok: true, usulan: [{ kode: "0661", nilai: "" }], alamatPihak: pihak };
    const hasil = tambahUsulanAlamat(sipp) as { usulan: Array<{ kode: string }> };
    expect(hasil.usulan.map((x) => x.kode)).toEqual(["0661", "8548"]);
    const dariBot = tambahUsulanAlamat({ ...sipp, usulan: [{ kode: "8548", nilai: "bot" }] }) as { usulan: Array<{ kode: string; nilai: string }> };
    expect(dariBot.usulan).toEqual([{ kode: "8548", nilai: "bot" }]);
    expect(tambahUsulanAlamat(null)).toBeNull();
    expect(tambahUsulanAlamat({ ok: false })).toEqual({ ok: false });
  });
});

describe("bot: padankanSurelEcourt", () => {
  it("nama sama (tanpa bin/binti); bila tidak ada, satu-satunya pihak sisi itu; kuasa tidak pernah dipakai", () => {
    const hasil = bot.padankanSurelEcourt(
      [
        { pihakKe: 1, urutan: 1, nama: "SITI AMINAH Binti LAMATO", alamat: "x" },
        { pihakKe: 2, urutan: 1, nama: "RUDI Bin AMIR", alamat: "y" },
      ],
      [
        { nama: "Siti Aminah", peran: "Penggugat", email: "siti@contoh.com" },
        { nama: "Andi, S.H.", peran: "Kuasa Hukum Penggugat", email: "kuasa@contoh.com" },
        { nama: "Rudy", peran: "Tergugat", email: "rudy@contoh.com" },
      ]
    );
    expect(hasil.map((x) => x.emailEcourt)).toEqual(["siti@contoh.com", "rudy@contoh.com"]);
    const tanpa = bot.padankanSurelEcourt([{ pihakKe: 1, urutan: 1, nama: "X" }], [{ nama: "Advokat", peran: "Kuasa", email: "k@contoh.com" }]);
    expect(tanpa[0].emailEcourt).toBe("");
  });
});
