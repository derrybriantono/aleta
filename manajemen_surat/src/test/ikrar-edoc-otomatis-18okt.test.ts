/**
 * Lanjutan ikrar talak 18 Okt 2026: e-Doc penetapan ikrar dari blangko Derry (butir 1),
 * form ikrar terisi otomatis saat halaman perkara SIPP dibuka (31), biaya amar dari
 * variabel ABT biaya ikrar (32). Perilaku bot diuji oleh aleta_bot/scripts/verify-ikrar-edoc.js
 * dan verify-ikrar-talak.js (tanpa basis data); di sini kabel antar-lapisan dijaga lewat sumber.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

describe("e-Doc penetapan ikrar talak (butir 1)", () => {
  const edoc = baca("aleta_bot/services/ikrarEdocService.js");

  it("menulis kolom e-Doc ikrar SIPP seperti fileupload_c (penikrar -> ikrar_talak_dok)", () => {
    expect(edoc).toContain("UPDATE perkara_ikrar_talak SET ikrar_talak_dok = ?");
    expect(edoc).toContain("_penetapan_ikrar_");
    expect(edoc).toContain("1a Perceraian CT");
    expect(edoc).toContain("[90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir.rtf");
    expect(edoc).toContain("[90] [Ikrar] Penetapan Ikrar Talak - P Hadir & T Tidak Hadir.rtf");
  });

  it("tanpa kata ALETA di SIPP: berkas dibersihkan, isi diperiksa, nama bersih, jenis jejak jujur", () => {
    expect(edoc).toContain("penjagaTandaSipp.siapkanBerkasSipp(");
    expect(edoc).toContain("penjagaTandaSipp.namaBerkasBersih(");
    expect(edoc).toContain('jenis: "edoc_ikrar"');
  });

  it("tanggal substantif tidak diubah: UPDATE hanya kolom e-Doc", () => {
    const update = edoc.match(/UPDATE perkara_ikrar_talak SET ([^"]+?) WHERE/g) || [];
    expect(update.length).toBeGreaterThan(0);
    for (const u of update) expect(u).not.toMatch(/tgl_ikrar_talak|status_penetapan|amar_ikrar_talak/);
  });

  it("alur tombol: e-Doc diunggah sesudah form ikrar (putus ikrar & isi form), tidak membatalkan form", () => {
    const alur = baca("aleta_bot/services/sidangHasilAlur.js");
    expect(alur).toContain("unggahEdocIkrar(deps");
    expect(alur).toContain("form_ikrar_sudah_terisi");
    expect(alur).toContain("edocIkrar");
  });

  it("jalur tulis baru terdaftar di penjaga tanda SIPP", () => {
    expect(baca("aleta_bot/services/penjagaTandaSipp.js")).toContain('berkas: "services/ikrarEdocService.js"');
  });
});

describe("biaya amar penetapan ikrar dari variabel ABT (32)", () => {
  const ik = baca("aleta_bot/services/ikrarTalakService.js");
  it("memakai #1101# (biaya penetapan ikrar) dan #2050# (terbilang), tidak mengarang angka", () => {
    expect(ik).toContain('penanda: ["1101", "2050"]');
    expect(ik).toContain("function bacaBiayaIkrar");
    expect(ik).not.toMatch(/Rp\s?\d{1,3}\.\d{3}/);
  });
});

describe("form ikrar terisi otomatis saat halaman perkara SIPP dibuka (31)", () => {
  const konten = baca("ekstensi-sipp/konten.js");
  const bagian = konten.slice(konten.indexOf("/* === IKRAR-OTOMATIS 18 Okt === */"), konten.indexOf("/* === AKHIR IKRAR-OTOMATIS === */"));

  it("dipanggil dari segarkan() sesudah panel perkara digambar", () => {
    expect(bagian.length).toBeGreaterThan(500);
    expect(konten).toContain("void ikrarOtomatis(isi.konteks)");
  });

  it("membuka form lewat tautan SIPP sendiri dan mengisi medan form_ikrar_putusan SIPP", () => {
    expect(bagian).toContain('a[href="#tabs24"]');
    expect(bagian).toContain('a[onclick*="edit_ikrar_talak_penetapan/"]');
    for (const m of ["tgl_ikrar", "status_penetapan", "keadaan_istri", "amar"]) expect(bagian).toContain(m);
    expect(bagian).toContain("#frm_verzet_putusan");
  });

  it("aturan Simpan: hanya bila saklar simpanOtomatis nyala; selebihnya petugas yang menekan", () => {
    expect(bagian).toContain('d.simpanOtomatis !== "nyala"');
    expect(bagian).toContain('jenis: "tekan"');
  });

  it("sekali per perkara per pemuatan halaman, tidak menimpa form yang sudah berisi", () => {
    expect(bagian).toContain("ikrarOtoDicoba");
    expect(bagian).toContain("tidak ditimpa");
  });

  it("portal: GET ikrar-borang membaca saja lewat bot dan membawa saklar Simpan", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-ecourt/ikrar-borang/route.ts");
    expect(rute).toContain("export async function GET");
    expect(rute).not.toContain("export async function POST");
    expect(rute).toContain("postGatewayIsianBorangIkrar");
    expect(rute).toContain("simpanOtomatis");
    const klien = baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts");
    expect(klien).toContain("/internal/aleta-bot/sidang/ikrar-borang");
    expect(baca("aleta_bot/routes/internalGatewayRoutes.js")).toContain('router.post("/sidang/ikrar-borang"');
  });
});
