// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { lengkapiPetaDariRekam, type RekamUntukPeta } from "@/lib/rekam-antrian";

/**
 * ============================================================================
 * BUTIR 32 (30 Sep 2026) - NOMOR ANTRIAN HARI LAMPAU TETAP TAMPIL
 * ============================================================================
 *
 * Aplikasi antrian sidang hanya menyimpan HARI INI; sesudah berganti hari
 * kolom ANTRIAN / JAM di Jadwal Sidang kosong. Nomornya SUDAH direkam ALETA
 * (aleta_rekam_antrian 0048/0051; buku waktu bot aleta_bot_antrian_waktu
 * sebagai cadangan rekaman) - layar hanya belum membacanya. Tidak perlu tabel
 * atau kolom baru.
 *
 * Diukur atas data lokal 30 Sep 2026: aleta_rekam_antrian (Postgres 54329)
 * 0 baris dan aleta_bot_antrian_waktu (MySQL lokal) 0 baris - laptop tidak
 * pernah membuka jadwal saat aplikasi antrian hidup. Karena itu perilakunya
 * dibuktikan di sini atas baris berbentuk rekaman sungguhan.
 */

const rekam = (ubah: Partial<RekamUntukPeta>): RekamUntukPeta => ({
  tanggalSidang: "2026-09-29",
  sidangId: "20400",
  perkaraId: "9971",
  nomorAntrian: 7,
  waktuAmbil: "08:41",
  jamPanggil: "10:12",
  online: false,
  keadaan: "dipanggil",
  namaPetugas: "Sitti",
  ...ubah,
});

describe("lengkapiPetaDariRekam", () => {
  it("hari lampau tanpa baris antrian langsung: nomor & jam dari rekaman, bertanda dariRekam", () => {
    const h = lengkapiPetaDariRekam({}, [{ perkaraId: "9971", tanggalSidang: "2026-09-29", sidangId: "20400" }], [rekam({})]);
    expect(h.ditambah).toBe(1);
    expect(h.tanggal).toEqual(["2026-09-29"]);
    expect(h.peta["9971"]).toMatchObject({
      nomor: 7,
      tanggalSidang: "2026-09-29",
      waktuAmbil: "08:41",
      jamPanggil: "10:12",
      keadaan: "dipanggil",
      dariRekam: true,
    });
  });

  it("baris antrian LANGSUNG tidak pernah ditimpa rekaman", () => {
    const langsung = { nomor: 3, tanggalSidang: "2026-09-29", jamPanggil: "09:00" };
    const h = lengkapiPetaDariRekam({ "9971": langsung }, [{ perkaraId: "9971", tanggalSidang: "2026-09-29", sidangId: "20400" }], [
      rekam({ nomorAntrian: 7 }),
    ]);
    expect(h.ditambah).toBe(0);
    expect(h.peta["9971"]).toBe(langsung);
  });

  it("rekaman tanpa nomor (belum ambil) tidak dipakai", () => {
    const h = lengkapiPetaDariRekam({}, [{ perkaraId: "9971", tanggalSidang: "2026-09-29", sidangId: "20400" }], [
      rekam({ nomorAntrian: null, keadaan: "belum-ambil" }),
    ]);
    expect(h.ditambah).toBe(0);
    expect(h.peta).toEqual({});
  });

  it("cocok lewat sidang_id, cadangannya perkara + tanggal - tidak pernah lintas tanggal", () => {
    const sidang = [{ perkaraId: "9971", tanggalSidang: "2026-09-29", sidangId: "99999" }];
    expect(lengkapiPetaDariRekam({}, sidang, [rekam({})]).ditambah).toBe(1);
    // Rekaman hari LAIN untuk perkara yang sama tidak boleh tampil.
    expect(lengkapiPetaDariRekam({}, sidang, [rekam({ tanggalSidang: "2026-09-15", sidangId: "20100" })]).ditambah).toBe(0);
  });
});

describe("rute jadwal sidang membaca rekaman untuk kolom antrian", () => {
  const rute = readFileSync(path.resolve(__dirname, "../app/api/aleta-ecourt/sidang/route.ts"), "utf8");

  it("rekaman dibaca SESUDAH ditulis, pada rentang yang sama, dan dipakai mengisi peta", () => {
    const iTulis = rute.indexOf("rekam = await rekamAntrian(");
    const iBaca = rute.indexOf("await bacaRekamAntrian(db, dariMinta, sampaiMinta)");
    expect(iTulis).toBeGreaterThan(-1);
    expect(iBaca).toBeGreaterThan(iTulis);
    expect(rute).toContain("lengkapiPetaDariRekam(");
    expect(rute).toContain("antrian: { ...antrianKeluar, dariRekam },");
  });

  it("gagal membaca rekaman tidak menjatuhkan jadwalnya", () => {
    const i = rute.indexOf("await bacaRekamAntrian(db, dariMinta, sampaiMinta)");
    expect(rute.lastIndexOf("try {", i)).toBeGreaterThan(rute.indexOf("NOMOR ANTRIAN HARI LAMPAU"));
    expect(rute).toContain("// Rekaman tidak terbaca: kolom antrian tetap seperti jawaban bot.");
  });
});
