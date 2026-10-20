// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 (AGEN U4) - ISIAN OTOMATIS DISPENSASI KAWIN DAN PERWALIAN OLEH KERABAT
 * ============================================================================
 *
 * Perilaku yang dijaga (modul dijalankan SUNGGUHAN atas kalimat posita berbentuk formulir PA Donggala 2025-2026,
 * nama dan nomor surat diganti nama rekaan):
 *   - DK: KUA yang menolak (5178 pasti, 3333), nomor dan tanggal surat penolakan, lama saling mengenal, tempat/tanggal lahir
 *     calon dari data SIPP; tidak ada yang terbaca bila kalimat bakunya tidak ada;
 *   - perwalian oleh KERABAT: hubungan dengan anak (bibi/paman menurut jenis kelamin Pemohon), nama dan tanggal wafat kedua orang tua;
 *     perwalian oleh orang tua yang masih hidup TIDAK menghasilkan 4400-4404;
 *   - semuanya tersambung ke jalur S5 (usulanDariData) dan berlaku menurut syarat metadata.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const req = createRequire(path.resolve(process.cwd(), "../aleta_bot/routes/internalGatewayRoutes.js"));
const dk = req("../services/isiOtomatisU4/dk.js");
const pw = req("../services/isiOtomatisU4/perwalian.js");
const s5 = req("../services/isiOtomatisJenisS5.js");
const meta = req("../services/isiOtomatisS5/metadata.js");

const POSITA_DK = `1. Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama Rina Contoh binti Budi (calon mempelai wanita) dengan seorang laki-laki yang bernama Doni Contoh bin Aman (calon mempelai laki-laki);
2. Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Rio Pakava, Kabupaten Donggala, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur sesuai dengan surat Penolakan Nomor : B.042/KUA.22.02.08/PW.01/3/2025 tanggal 11 Februari 2025;
3. Bahwa anak para Pemohon tersebut telah saling mengenal selama 2 tahun, dan hubungan mereka telah sedemikian eratnya sehingga anak para Pemohon sekarang sedang hamil 26 Minggu;`;

const nilai = (daftar: any[], kode: string) => daftar.find((x) => x.kode === kode);

describe("DK: bacaan posita tambahan (agen U4)", () => {
  const d = { perkara: { posita: POSITA_DK, tanggalDaftar: "2025-02-20" }, mempelai: [] as any[] };
  const u = dk.usulanU4Dk(d);

  it("KUA yang menolak terbaca utuh dan 'pasti'; bentuk pendek 3333 'cukup'", () => {
    expect(nilai(u, "5178").nilai).toBe("Kantor Urusan Agama Kecamatan Rio Pakava, Kabupaten Donggala");
    expect(nilai(u, "5178").keyakinan).toBe("pasti");
    expect(nilai(u, "3333").nilai).toBe("Rio Pakava, Kabupaten Donggala");
    expect(nilai(u, "3333").keyakinan).toBe("cukup");
  });

  it("nomor dan tanggal surat penolakan; tanggal dalam bentuk tampil", () => {
    expect(nilai(u, "0652").nilai).toBe("B.042/KUA.22.02.08/PW.01/3/2025");
    expect(nilai(u, "0653").nilai).toMatch(/11.*0?2.*2025|11 Februari 2025/);
  });

  it("lama saling mengenal 'ragu' (di sidang lamanya biasa berbeda) dan kalimat eratnya bentuk baku", () => {
    expect(nilai(u, "1666").nilai).toBe("2 tahun");
    expect(nilai(u, "1666").keyakinan).toBe("ragu");
    expect(nilai(u, "1014").nilai).toBe("telah saling mengenal selama 2 tahun, dan hubungan mereka telah sedemikian eratnya");
  });

  it("tanpa kalimat baku tidak ada usulan KUA/surat/lama (tidak ada yang dikarang)", () => {
    const kosong = dk.usulanU4Dk({ perkara: { posita: "Bahwa Pemohon mengajukan dispensasi kawin untuk anaknya." }, mempelai: [] });
    expect(kosong.filter((x: any) => ["5178", "3333", "0652", "0653", "1666", "1014"].includes(x.kode))).toEqual([]);
  });

  it("tempat dan tanggal lahir calon dari SIPP: pria 0340 'ragu' (diukur 76%), wanita 0344 'cukup', tanggal lahir pria 0348", () => {
    const mem = [
      { nama: "Doni Contoh bin Aman", lahir: "2003-08-08", tempat: "Palu", jenis: "1", dimohonkan: null, pendidikan: "4", pekerjaan: "9", nominal: "0" },
      { nama: "Rina Contoh binti Budi", lahir: "2007-09-28", tempat: "Donggala", jenis: "2", dimohonkan: "1", pendidikan: "3", pekerjaan: "3", nominal: "0" },
    ];
    const hasil = dk.usulanU4Dk({ perkara: { posita: "", tanggalDaftar: "2025-02-20" }, mempelai: mem });
    expect(nilai(hasil, "0340")).toMatchObject({ nilai: "Palu", keyakinan: "ragu" });
    expect(nilai(hasil, "0344")).toMatchObject({ nilai: "Donggala", keyakinan: "cukup" });
    expect(nilai(hasil, "0348").nilai).toMatch(/08.*2003|2003/);
  });
});

const POSITA_KERABAT = `1. Bahwa Rakhma Contoh binti Sahar dan Alm. Hidayat Contoh bin Hamid adalah pasangan suami istri yang sah;
2. Bahwa Alm. Hidayat Contoh bin Hamid (Ayah) telah meninggal dunia pada tanggal 07 Januari 2022 (dibuktikan dengan kutipan akta kematian : 7203-KM-13012022-0004);
3. Bahwa Almh. Irma Contoh (Ibu) telah meninggal dunia pada tanggal 03 Desember 2024 (dibuktikan dengan kutipan akta kematian : 7203-KM-17122024-0003);
4. Bahwa Pemohon adalah Saudara kandung (adik) dari Ibu Kandung Anak Contoh yang bernama Almh. Irma Contoh;`;

describe("perwalian oleh kerabat: bacaan posita (agen U4)", () => {
  it("bibi bila Pemohon perempuan, paman bila laki-laki (jenis kelamin dari SIPP); nama dan tanggal wafat kedua orang tua", () => {
    const perempuan = pw.usulanU4Perwalian({ perkara: { posita: POSITA_KERABAT }, pihak1: [{ jk: "P" }] });
    expect(nilai(perempuan, "4400").nilai).toBe("bibi (saudara kandung dari ibu kandung anak)");
    expect(nilai(perempuan, "4401").nilai).toBe("Hidayat Contoh bin Hamid");
    expect(nilai(perempuan, "4402").nilai).toBe("Irma Contoh");
    expect(nilai(perempuan, "4403").nilai).toMatch(/07.*2022/);
    expect(nilai(perempuan, "4404").nilai).toMatch(/03.*2024|12.*2024/);
    const laki = pw.usulanU4Perwalian({ perkara: { posita: POSITA_KERABAT }, pihak1: [{ jk: "L" }] });
    expect(nilai(laki, "4400").nilai).toBe("paman (saudara kandung dari ibu kandung anak)");
  });

  it("jenis kelamin tidak terbaca: 'saudara kandung' dengan keyakinan ragu", () => {
    const u = pw.usulanU4Perwalian({ perkara: { posita: POSITA_KERABAT }, pihak1: [] });
    expect(nilai(u, "4400")).toMatchObject({ nilai: "saudara kandung (saudara kandung dari ibu kandung anak)", keyakinan: "ragu" });
  });

  it("hubungan langsung: nenek, paman kandung, kakak kandung", () => {
    const h = (kalimat: string) => nilai(pw.usulanU4Perwalian({ perkara: { posita: kalimat }, pihak1: [{ jk: "P" }] }), "4400")?.nilai;
    expect(h("Bahwa Pemohon adalah nenek dari anak Contoh bin Ali atau ibu kandung dari Alm. Ali;")).toBe("nenek");
    expect(h("Bahwa Pemohon adalah Paman Kandung dari Alm. Contoh bin Ali;")).toBe("paman kandung");
    expect(h("Bahwa Pemohon adalah Kaka Kandung dari Almh. Contoh binti Toto;")).toBe("kakak kandung");
  });

  it("perwalian oleh orang tua yang masih hidup tidak menghasilkan 4400-4404", () => {
    const posita = "Bahwa Pemohon adalah ibu kandung dari anak Contoh; Bahwa Alm. Sujari Contoh bin Saimin (Suami Pemohon) telah meninggal dunia pada tanggal 01 Oktober 2024;";
    expect(pw.usulanU4Perwalian({ perkara: { posita }, pihak1: [{ jk: "P" }] })).toEqual([]);
  });
});

describe("tersambung ke jalur S5 dan metadata", () => {
  it("usulanDariData jenis 362 dan 354 memuat usulan U4", () => {
    const sDk = s5.usulanDariData({ perkaraId: 1, perkara: { jenisId: 362, posita: POSITA_DK, petitum: "", tanggalDaftar: "2025-02-20" }, pihak1: [], pihak2: [], mempelai: [], anak: [], alasanNikah: [] });
    expect(sDk.map((x: any) => x.kode)).toEqual(expect.arrayContaining(["5178", "3333", "0652", "1666"]));
    const sPw = s5.usulanDariData({ perkaraId: 2, perkara: { jenisId: 354, posita: POSITA_KERABAT, petitum: "", tanggalDaftar: "2026-03-01" }, pihak1: [{ jk: "P", pekerjaan: "Petani" }], pihak2: [], mempelai: [], anak: [], alasanNikah: [] });
    expect(sPw.map((x: any) => x.kode)).toEqual(expect.arrayContaining(["4400", "4401", "4402", "4403", "4404"]));
  });

  it("4400-4404 hanya berlaku pada perwalian oleh kerabat", () => {
    const kerabat = { perkara: { posita: POSITA_KERABAT } };
    const orangTua = { perkara: { posita: "Bahwa Pemohon adalah ibu kandung dari anak Contoh; Bahwa suami Pemohon telah meninggal dunia" } };
    for (const kode of ["4400", "4401", "4402", "4403", "4404"]) {
      expect(meta.SYARAT[kode](kerabat), kode).toBe(true);
      expect(meta.SYARAT[kode](orangTua), kode).toBe(false);
    }
  });
});
