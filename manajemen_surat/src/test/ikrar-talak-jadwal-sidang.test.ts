/**
 * Sidang ikrar talak di Jadwal Sidang (permintaan 18 Okt 2026): tombol tunda
 * ikrar (hadir belum siap / tidak hadir), tombol putus ikrar, dan pengisian form
 * ikrar SIPP. Aturan murni diuji langsung; kabel layar/rute/bot dijaga lewat
 * sumber.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ALASAN_IKRAR_BELUM_SIAP,
  ALASAN_IKRAR_TIDAK_HADIR,
  AGENDA_IKRAR,
  batasEnamBulanIkrar,
  bawaanTundaIkrar,
  ikrarTerlaksanaMenurutTeks,
  keHariKerja,
  peringatanBatasIkrar,
  tambahBulanIso,
  tambahHariIso,
} from "@/lib/ikrar-talak";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

describe("bawaan tunda sidang ikrar talak", () => {
  it("(a) hadir tetapi belum siap: 14 hari dari sidang, 09.00, alasan baku", () => {
    const b = bawaanTundaIkrar("belum-siap", { tanggalSidang: "2026-10-07" });
    expect(b.tanggal).toBe("2026-10-21");
    expect(b.jam).toBe("09:00");
    expect(b.alasan).toBe(ALASAN_IKRAR_BELUM_SIAP);
    expect(b.alasan).toBe("Pemohon belum siap melaksanakan Ikrar Talak");
    expect(b.agenda).toBe(AGENDA_IKRAR);
  });

  it("(b) tidak hadir: 6 bulan dari tanggal BHT, 09.00, alasan baku", () => {
    const b = bawaanTundaIkrar("tidak-hadir", { tanggalSidang: "2026-10-07", tanggalBht: "2026-09-15" });
    expect(b.tanggal).toBe("2027-03-15");
    expect(b.jam).toBe("09:00");
    expect(b.alasan).toBe(ALASAN_IKRAR_TIDAK_HADIR);
    expect(b.alasan).toBe("Pemohon tidak hadir Ikrar Talak");
  });

  it("akhir pekan bergeser ke Senin dan diberi tanda; BHT tak terbaca = petugas mengisi", () => {
    expect(keHariKerja("2027-03-13")).toBe("2027-03-15"); // Sabtu
    expect(keHariKerja("2027-03-14")).toBe("2027-03-15"); // Minggu
    const b = bawaanTundaIkrar("tidak-hadir", { tanggalSidang: "2026-10-07", tanggalBht: "2026-09-13" });
    expect(b.tanggal).toBe("2027-03-15");
    expect(b.digeser).toBe(true);
    const tanpa = bawaanTundaIkrar("tidak-hadir", { tanggalSidang: "2026-10-07" });
    expect(tanpa.tanggal).toBe("");
    expect(tanpa.perluDiisi).toBe(true);
  });

  it("penambah bulan memangkas ke hari terakhir bulan", () => {
    expect(tambahBulanIso("2026-08-31", 6)).toBe("2027-02-28");
    expect(tambahHariIso("2026-12-25", 14)).toBe("2027-01-08");
  });
});

describe("batas 6 bulan ikrar (Pasal 70 ayat (6) UU 7/1989)", () => {
  it("dihitung dari penetapan hari sidang ikrar, cadangan dari BHT", () => {
    expect(batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2026-09-22", tanggalBht: "2026-09-01" })).toBe("2027-03-22");
    expect(batasEnamBulanIkrar({ tanggalBht: "2026-09-15" })).toBe("2027-03-15");
    expect(batasEnamBulanIkrar({})).toBe("");
  });

  it("peringatan hanya bila tanggal berikutnya melewati batas", () => {
    const bahan = { tanggalPenetapanSidangIkrar: "2026-09-22" };
    expect(peringatanBatasIkrar("2027-03-22", bahan)).toBe("");
    expect(peringatanBatasIkrar("2027-03-23", bahan)).toContain("Pasal 70 ayat (6)");
    expect(peringatanBatasIkrar("2027-03-23", {})).toBe("");
  });
});

describe("keterangan yang menyatakan ikrar terlaksana", () => {
  it("mengenali ejaan SIPP dan kalimat ALETA, menolak yang tertunda", () => {
    expect(ikrarTerlaksanaMenurutTeks("Ikrar Telah Dilaksanakan")).toBe(true);
    expect(ikrarTerlaksanaMenurutTeks("telah ikrar talak")).toBe(true);
    expect(ikrarTerlaksanaMenurutTeks("Belum Ikrar")).toBe(false);
    expect(ikrarTerlaksanaMenurutTeks("Pemohon tidak hadir Ikrar Talak")).toBe(false);
    expect(ikrarTerlaksanaMenurutTeks("tunda 6 bulan")).toBe(false);
    expect(ikrarTerlaksanaMenurutTeks("0")).toBe(false);
    expect(ikrarTerlaksanaMenurutTeks(null)).toBe(false);
  });

  it("portal dan bot memakai aturan yang sama", () => {
    const bot = baca("aleta_bot/services/ikrarTalakService.js");
    expect(bot).toContain("belum|tidak|tunda|ditunda|menunggu|panggil|gugur|batal");
    expect(baca("manajemen_surat/src/lib/ikrar-talak.ts")).toContain("belum|tidak|tunda|ditunda|menunggu|panggil|gugur|batal");
  });
});

describe("kabel layar, rute, dan bot", () => {
  const layar = baca("manajemen_surat/src/components/portal/hasil-sidang.tsx");
  const ringkas = layar.slice(layar.indexOf("export function CatatHasilRingkas("));

  it("blangko ringkas menawarkan dua tombol tunda ikrar dan konfirmasi putus ikrar", () => {
    expect(ringkas).toContain("Pemohon hadir, belum siap membayar akibat perceraian");
    expect(ringkas).toContain('"tidak-hadir"');
    expect(ringkas).toContain("data-putus-ikrar");
    expect(ringkas).toContain("ikrarDilaksanakan: true");
    expect(ringkas).toContain("peringatanBatasIkrar(");
  });

  it("blangko biasa (bukan ikrar) tidak berubah: status putusan tetap dikirim", () => {
    expect(ringkas).toContain("statusPutusanId: Number(statusId)");
    expect(ringkas).toContain("modeIkrarTunda");
  });

  it("rute putus meneruskan konfirmasi; rute isi-ikrar dijaga hak tunda/putus dan kering bawaan", () => {
    expect(baca("manajemen_surat/src/app/api/aleta-ecourt/sidang-putus/route.ts")).toContain(
      "ikrarDilaksanakan: badan.ikrarDilaksanakan === true"
    );
    const isi = baca("manajemen_surat/src/app/api/aleta-ecourt/sidang-ikrar-isi/route.ts");
    expect(isi).toContain('pastikanAksi(db, actorUserId, "sidang.tunda-putus")');
    expect(isi).toContain("kering: badan.kering !== false");
    expect(isi).toContain("alamatIpPeramban(request)");
    expect(baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts")).toContain(
      "/internal/aleta-bot/sidang/isi-ikrar"
    );
  });

  it("baris Jadwal Sidang menawarkan Isi form ikrar bila ikrar terlaksana tetapi belum tercatat", () => {
    const sidang = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
    expect(sidang).toContain("ikrarSelesai(baris) && !baris.ikrarTercatat");
    expect(sidang).toContain("<IsiIkrarTalak");
  });

  it("bot: hasil sidang ejaan SIPP + keterangan, form ikrar atas ketua majelis, jalur tulis terdaftar", () => {
    const layananIkrar = baca("aleta_bot/services/ikrarTalakService.js");
    expect(layananIkrar).toContain('"telah ikrar talak"');
    expect(layananIkrar).toContain('"Ikrar Telah Dilaksanakan"');
    expect(layananIkrar).toContain("ketuaMajelisIkrar(");
    expect(layananIkrar).toContain("menyebutAleta(amar)");
    const hasil = baca("aleta_bot/services/sidangHasilService.js");
    expect(hasil).toContain("susunRencanaPutusIkrar");
    expect(hasil).toContain("ikrar.KETERANGAN_IKRAR");
    const alur = baca("aleta_bot/services/sidangHasilAlur.js");
    expect(alur).toContain("jalankanIsiIkrar");
    expect(alur).toContain('"putus-ikrar"');
    expect(baca("aleta_bot/services/penjagaTandaSipp.js")).toContain('berkas: "services/ikrarTalakService.js"');
    expect(baca("aleta_bot/routes/internalGatewayRoutes.js")).toContain('"/sidang/isi-ikrar"');
  });
});
