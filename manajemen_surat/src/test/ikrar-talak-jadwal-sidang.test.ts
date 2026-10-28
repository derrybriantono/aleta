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
  mundurKeHariKerja,
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

  it("(b) tidak hadir: batas 6 bulan sejak penetapan hari sidang ikrar, 09.00, alasan baku", () => {
    const b = bawaanTundaIkrar("tidak-hadir", { tanggalSidang: "2026-10-07", tanggalPenetapanSidangIkrar: "2026-09-15" });
    expect(b.tanggal).toBe("2027-03-15"); // Senin
    expect(b.digeser).toBe(false);
    expect(b.perluDiisi).toBe(false);
    expect(b.jam).toBe("09:00");
    expect(b.alasan).toBe(ALASAN_IKRAR_TIDAK_HADIR);
    expect(b.alasan).toBe("Pemohon tidak hadir Ikrar Talak");
  });

  it("(b) tanpa penetapan hari sidang ikrar: tenggat belum berjalan, BHT TIDAK dipakai sebagai cadangan", () => {
    const b = bawaanTundaIkrar("tidak-hadir", { tanggalSidang: "2026-10-07", tanggalBht: "2026-09-15" });
    expect(b.tanggal).toBe("");
    expect(b.perluDiisi).toBe(true);
    expect(b.penjelasan).toBe(
      "Hari sidang ikrar belum ditetapkan - tenggat 6 bulan belum berjalan; isi tanggal sidang ikrar berikutnya."
    );
  });

  it("(b) batas jatuh Sabtu/Minggu: MUNDUR ke Jumat (maju akan melewati tenggat), diberi tanda", () => {
    const sabtu = bawaanTundaIkrar("tidak-hadir", { tanggalSidang: "2026-10-07", tanggalPenetapanSidangIkrar: "2026-09-13" });
    expect(sabtu.tanggal).toBe("2027-03-12"); // batas Sabtu 13 Mar
    expect(sabtu.digeser).toBe(true);
    const minggu = bawaanTundaIkrar("tidak-hadir", { tanggalSidang: "2026-10-07", tanggalPenetapanSidangIkrar: "2026-09-14" });
    expect(minggu.tanggal).toBe("2027-03-12"); // batas Minggu 14 Mar
    // 31 Agustus + 6 bulan = Minggu 28 Februari -> Jumat 26 Februari
    const februari = bawaanTundaIkrar("tidak-hadir", { tanggalSidang: "2026-10-07", tanggalPenetapanSidangIkrar: "2026-08-31" });
    expect(februari.tanggal).toBe("2027-02-26");
    // Hasilnya tidak pernah melampaui batas.
    for (const b of [sabtu, minggu, februari]) expect(b.tanggal <= "2027-03-14").toBe(true);
  });

  it("(a) belum siap: 14 hari bila masih dalam batas, dijepit ke batas bila melewatinya", () => {
    // Dalam batas: tidak berubah.
    const dalam = bawaanTundaIkrar("belum-siap", { tanggalSidang: "2026-10-07", tanggalPenetapanSidangIkrar: "2026-09-22" });
    expect(dalam.tanggal).toBe("2026-10-21");
    expect(dalam.digeser).toBe(false);
    // 14 hari dari sidang 15 Mar 2027 = 29 Mar > batas Senin 22 Mar: dijepit ke 22 Mar.
    const jepitSenin = bawaanTundaIkrar("belum-siap", { tanggalSidang: "2027-03-15", tanggalPenetapanSidangIkrar: "2026-09-22" });
    expect(jepitSenin.tanggal).toBe("2027-03-22");
    expect(jepitSenin.digeser).toBe(true);
    expect(jepitSenin.penjelasan).toContain("dijepit");
    // Batas Sabtu 13 Mar: dijepit mundur ke Jumat 12 Mar.
    const jepitSabtu = bawaanTundaIkrar("belum-siap", { tanggalSidang: "2027-03-03", tanggalPenetapanSidangIkrar: "2026-09-13" });
    expect(jepitSabtu.tanggal).toBe("2027-03-12");
    // Tanpa penetapan hari sidang ikrar: tidak ada batas untuk menjepit.
    expect(bawaanTundaIkrar("belum-siap", { tanggalSidang: "2027-03-15" }).tanggal).toBe("2027-03-29");
  });

  it("tenggat sudah lewat dari tanggal sidang ini: tidak ada bawaan, petugas diberi tahu (penetapan gugur, blangko [91])", () => {
    for (const jenis of ["belum-siap", "tidak-hadir"] as const) {
      const lewat = bawaanTundaIkrar(jenis, { tanggalSidang: "2027-04-01", tanggalPenetapanSidangIkrar: "2026-09-22" });
      expect(lewat.tanggal, jenis).toBe("");
      expect(lewat.perluDiisi, jenis).toBe(true);
      expect(lewat.penjelasan, jenis).toContain("gugur");
      expect(lewat.penjelasan, jenis).toContain("[91]");
      // Sidang tepat pada hari batas: tidak ada hari berikutnya yang sah.
      const tepat = bawaanTundaIkrar(jenis, { tanggalSidang: "2027-03-22", tanggalPenetapanSidangIkrar: "2026-09-22" });
      expect(tepat.tanggal, jenis).toBe("");
      expect(tepat.perluDiisi, jenis).toBe(true);
    }
  });

  it("akhir pekan bergeser ke Senin (maju) atau Jumat (mundur)", () => {
    expect(keHariKerja("2027-03-13")).toBe("2027-03-15"); // Sabtu
    expect(keHariKerja("2027-03-14")).toBe("2027-03-15"); // Minggu
    expect(mundurKeHariKerja("2027-03-13")).toBe("2027-03-12");
    expect(mundurKeHariKerja("2027-03-14")).toBe("2027-03-12");
    expect(mundurKeHariKerja("2027-03-15")).toBe("2027-03-15");
  });

  it("penambah bulan memangkas ke hari terakhir bulan", () => {
    expect(tambahBulanIso("2026-08-31", 6)).toBe("2027-02-28");
    expect(tambahHariIso("2026-12-25", 14)).toBe("2027-01-08");
  });
});

describe("batas 6 bulan ikrar (Pasal 70 ayat (6) UU 7/1989)", () => {
  it("dihitung dari penetapan hari sidang ikrar; BHT tidak pernah menjadi cadangan", () => {
    expect(batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2026-09-22", tanggalBht: "2026-09-01" })).toBe("2027-03-22");
    expect(batasEnamBulanIkrar({ tanggalBht: "2026-09-15" })).toBe("");
    expect(batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "", tanggalBht: "2026-09-15" })).toBe("");
    expect(batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: null, tanggalBht: "2026-09-15" })).toBe("");
    expect(batasEnamBulanIkrar({})).toBe("");
  });

  it("hari yang tidak ada di bulan tujuan jatuh ke hari terakhir bulan itu (Februari biasa dan kabisat)", () => {
    expect(batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2026-08-31" })).toBe("2027-02-28");
    expect(batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2027-08-31" })).toBe("2028-02-29");
    expect(batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2026-08-30" })).toBe("2027-02-28");
    expect(batasEnamBulanIkrar({ tanggalPenetapanSidangIkrar: "2026-12-31" })).toBe("2027-06-30");
  });

  it("peringatan hanya bila tanggal berikutnya MELEWATI batas (tepat pada batas masih sah)", () => {
    const bahan = { tanggalPenetapanSidangIkrar: "2026-09-22" };
    expect(peringatanBatasIkrar("2027-03-21", bahan)).toBe("");
    expect(peringatanBatasIkrar("2027-03-22", bahan)).toBe("");
    expect(peringatanBatasIkrar("2027-03-23", bahan)).toContain("Pasal 70 ayat (6)");
    expect(peringatanBatasIkrar("2027-03-23", bahan)).toContain("2027-03-22");
    // Tanpa penetapan hari sidang ikrar tenggat belum berjalan: tidak ada peringatan, walau BHT ada.
    expect(peringatanBatasIkrar("2027-03-23", {})).toBe("");
    expect(peringatanBatasIkrar("2030-01-01", { tanggalBht: "2026-09-15" })).toBe("");
    // Tanggal tak sah tidak memicu peringatan.
    expect(peringatanBatasIkrar("", bahan)).toBe("");
  });

  it("bawaan sendiri tidak pernah memicu peringatan", () => {
    for (const phs of ["2026-09-13", "2026-09-14", "2026-09-22", "2026-08-31"]) {
      for (const jenis of ["belum-siap", "tidak-hadir"] as const) {
        const b = bawaanTundaIkrar(jenis, { tanggalSidang: "2026-10-07", tanggalPenetapanSidangIkrar: phs });
        expect(peringatanBatasIkrar(b.tanggal, { tanggalPenetapanSidangIkrar: phs }), `${jenis} ${phs}`).toBe("");
      }
    }
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
    // 28 Okt 2026: status 1 tetap mengirim ikrarDilaksanakan; status 2/3 lewat statusIkrar + konfirmasiStatus.
    expect(ringkas).toContain("ikrarDilaksanakan: statusDipakai === 1");
    expect(ringkas).toContain("statusIkrar: statusDipakai");
    expect(ringkas).toContain("peringatanBatasIkrar(");
    // Penetapan hari sidang ikrar ikut ke bawaan dan peringatan batas mencegah simpan.
    expect(ringkas).toContain("tanggalPenetapanSidangIkrar: keadaan.tanggalPenetapanSidangIkrar");
    expect(ringkas).toContain("&& !peringatanIkrar");
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
    // Tiga status (28 Okt 2026): teks hasil sidang & keterangan dari daftar tetap per status.
    expect(hasil).toContain("ikrar.STATUS_IKRAR[status]");
    expect(layananIkrar).toContain("keterangan: KETERANGAN_IKRAR");
    const alur = baca("aleta_bot/services/sidangHasilAlur.js");
    expect(alur).toContain("jalankanIsiIkrar");
    expect(alur).toContain('"putus-ikrar"');
    expect(baca("aleta_bot/services/penjagaTandaSipp.js")).toContain('berkas: "services/ikrarTalakService.js"');
    expect(baca("aleta_bot/routes/internalGatewayRoutes.js")).toContain('"/sidang/isi-ikrar"');
  });
});
