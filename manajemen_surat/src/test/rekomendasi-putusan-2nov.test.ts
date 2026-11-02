/**
 * R (2 Nov 2026, keputusan 124-125): rekomendasi putusan menurut alat bukti tertulis dan keterangan saksi - cerai, itsbat nikah,
 * dispensasi kawin. Uji perilaku atas lib/rekomendasi-putusan.ts, modul ekstensi blangko-derry-rekomendasi.js, server (tempel hubungan)
 * dan bot bahanPembuktian (isian bukti permohonan). Data rekaan; bentuk tanya-jawab meniru blangko Derry.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { BuktiMasuk, HasilPenilaian, SaksiMasuk } from "@/lib/penilai-bukti";
import { lamaBulan, masaSema, pTidakHadirLagi, rekomendasiPutusanDariBukti, type MasukanRekomendasiPutusan } from "@/lib/rekomendasi-putusan";
import { tempelHubungan } from "@/server/modules/aleta-ecourt/rekomendasi-putusan";

type Apa = any;
const req = createRequire(import.meta.url);
const RP: Apa = req(path.join(process.cwd(), "..", "ekstensi-sipp", "blangko-derry-rekomendasi.js"));
const BP: Apa = req(path.join(process.cwd(), "..", "aleta_bot", "services", "bahanPembuktianService.js"));

const s = (id: string, pihak: "P" | "T", ke: number, hubungan: string, baris: Array<[string, string]>): SaksiMasuk => ({ id, pihak, ke, hubungan, baris: baris.map(([tanya, jawab]) => ({ tanya, jawab })) });
const b = (kode: string, teks: string, jenis: "surat" | "elektronik" = "surat"): BuktiMasuk => ({ kode, pihak: "P", jenis, teks });

const AKTA = b("P.2", "Fotokopi Kutipan Akta Nikah Nomor 123/45/VI/2015 yang dikeluarkan oleh KUA Kecamatan Banawa, diberi tanda P.2");
const KTP = b("P.1", "Fotokopi Kartu Tanda Penduduk atas nama Penggugat, diberi tanda P.1");

function saksiCerai(ke: number, hubungan: string, pisah = "sejak bulan Januari 2026, sudah sekitar 9 bulan", langsung = true): SaksiMasuk {
  return s(`s${ke}`, "P", ke, hubungan, [
    ["Apakah saudara kenal dengan Penggugat?", `Saya kenal dengan Penggugat karena saya adalah ${hubungan || "orang kampung"} Penggugat;`],
    ["Kenapa Penggugat mengajukan cerai terhadap Tergugat?", "Penggugat mengajukan cerai karena sudah tidak rukun;"],
    ["Apakah antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran?", "Antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak tahun 2024;"],
    [
      "Apakah saudara pernah melihat atau mendengar langsung Penggugat dan Tergugat bertengkar?",
      langsung ? "Saya pernah melihat dan mendengar langsung Penggugat dan Tergugat bertengkar;" : "Saya tidak pernah melihat dan mendengar langsung Penggugat dan Tergugat bertengkar, tetapi saya tahu dari cerita Penggugat;",
    ],
    ["Apakah Penggugat dan Tergugat masih tinggal satu rumah sampai saat ini?", `Penggugat dan Tergugat sudah pisah tempat tinggal ${pisah};`],
    ["Apakah selama pisah masih ada komunikasi?", "Selama pisah antara Penggugat dan Tergugat sudah tidak ada komunikasi;"],
    ["Pernahkah ada upaya untuk merukunkan?", "Sudah pernah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil;"],
  ]);
}
const cerai = (o: Partial<MasukanRekomendasiPutusan>): MasukanRekomendasiPutusan => ({
  jenisPerkara: "Cerai Gugat",
  nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
  saksi: [saksiCerai(1, "Ibu Kandung"), saksiCerai(2, "Paman")],
  bukti: [KTP, AKTA],
  kehadiran: { tPernahHadir: false },
  acuan: "2026-10-20",
  ...o,
});

describe("cerai: hubungan hukum, keluarga/orang dekat, alasan, pisah 6 bulan, verstek", () => {
  it("akta nikah + dua saksi keluarga melihat sendiri + pisah 9 bulan -> dikabulkan verstek, keyakinan cukup, blangko Kabul Verstek di depan", () => {
    const r = rekomendasiPutusanDariBukti(cerai({}))!;
    expect(r.jenis).toBe("cerai-gugat");
    expect(r.hasil).toBe("dikabulkan");
    expect(r.label).toBe("Dikabulkan (verstek)");
    expect(r.keyakinan).toBe("cukup");
    const u = Object.fromEntries(r.unsur.map((x) => [x.id, x]));
    expect(u.nikah.status).toBe("terbukti");
    expect(u.nikah.bukti[0]).toMatchObject({ kode: "P.2", kelas: "akta nikah" });
    expect(u.nikah.dasar).toContain("Pasal 7 ayat (1) Kompilasi Hukum Islam");
    expect(u.identitas.bukti[0].kode).toBe("P.1");
    expect(u.keluarga.status).toBe("terbukti");
    expect(u.keluarga.dasar).toEqual(expect.arrayContaining(["Pasal 22 ayat (2) Peraturan Pemerintah Nomor 9 Tahun 1975", "Pasal 76 ayat (1) Undang-Undang Nomor 7 Tahun 1989"]));
    expect(u["alasan-selisih"].status).toBe("terbukti");
    expect(u["alasan-selisih"].dasar).toEqual(expect.arrayContaining(["Pasal 19 huruf f Peraturan Pemerintah Nomor 9 Tahun 1975", "Pasal 116 huruf f Kompilasi Hukum Islam"]));
    expect(u["alasan-selisih"].saksi.every((x) => x.langsung)).toBe(true);
    expect(u.pisah).toMatchObject({ status: "terbukti" });
    expect(u.verstek.dasar).toEqual(["Pasal 149 ayat (1) RBg", "SEMA Nomor 3 Tahun 2015 Kamar Agama angka 3"]);
    expect(r.blangko[0].berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap).rtf");
    expect(r.blangko[0].utama).toBe(true);
  });

  it("pisah baru 3 bulan sesudah SEMA 3/2023 tanpa KDRT -> ditolak (Kurang 6 Bulan); sebelum SEMA 3/2023 -> pisah hanya catatan", () => {
    const tiga = [saksiCerai(1, "Ibu Kandung", "sejak bulan Juli 2026"), saksiCerai(2, "Paman", "sejak bulan Juli 2026")];
    const r = rekomendasiPutusanDariBukti(cerai({ saksi: tiga }))!;
    expect(r.hasil).toBe("ditolak");
    expect(r.unsur.find((x) => x.id === "pisah")!.status).toBe("tidak-terbukti");
    expect(r.blangko[0].berkas).toBe("[01ab] [Tolak Verstek] Cerai - Kurang 6 Bulan SEMA 1 Tahun 2022.rtf");
    const lama = rekomendasiPutusanDariBukti(cerai({ saksi: [saksiCerai(1, "Ibu Kandung", "sejak bulan Maret 2023"), saksiCerai(2, "Paman", "sejak bulan Maret 2023")], acuan: "2023-06-15" }))!;
    expect(lama.hasil).toBe("dikabulkan");
    expect(lama.unsur.find((x) => x.id === "pisah")!.status).toBe("catatan");
  });

  it("pisah < 6 bulan tetapi KDRT terbukti -> pengecualian SEMA 3/2023, dikabulkan", () => {
    const kdrt = (ke: number) => {
      const x = saksiCerai(ke, "Kakak Kandung", "sejak bulan Juli 2026");
      x.baris.push({ tanya: "Apakah Tergugat pernah memukul Penggugat?", jawab: "Ya, saya pernah melihat sendiri Tergugat memukul dan menendang Penggugat;" });
      return x;
    };
    const r = rekomendasiPutusanDariBukti(cerai({ saksi: [kdrt(1), kdrt(2)] }))!;
    expect(r.hasil).toBe("dikabulkan");
    expect(r.unsur.find((x) => x.id === "pisah")!.status).toBe("catatan");
  });

  it("satu saksi saja -> ditolak (unus testis), varian blangko Unus Testis", () => {
    const r = rekomendasiPutusanDariBukti(cerai({ saksi: [saksiCerai(1, "Ibu Kandung")] }))!;
    expect(r.hasil).toBe("ditolak");
    expect(r.unsur.find((x) => x.id === "saksi")!.dasar).toContain("Pasal 306 RBg");
    expect(r.blangko[0].berkas).toBe("[01ab] [Tolak Verstek] Cerai - Unus Testis Nullus Testis.rtf");
  });

  it("pertengkaran hanya dari cerita, tetapi dua saksi tahu sendiri pisah >= 6 bulan tanpa komunikasi & damai gagal -> dikabulkan, ragu (persangkaan)", () => {
    const r = rekomendasiPutusanDariBukti(cerai({ saksi: [saksiCerai(1, "Ibu Kandung", undefined, false), saksiCerai(2, "Tetangga", undefined, false)] }))!;
    expect(r.hasil).toBe("dikabulkan");
    expect(r.keyakinan).toBe("ragu");
    expect(r.sebabRagu.join(" ")).toMatch(/dari cerita/);
    expect(r.unsur.find((x) => x.id === "alasan-selisih")!.catatan.join(" ")).toMatch(/de auditu/);
  });

  it("saksi tidak mengetahui perselisihan tidak dihitung mendukung; maksud mengajukan cerai bukan fakta", () => {
    const tahu = saksiCerai(1, "Ibu Kandung");
    const tidak = s("s2", "P", 2, "Paman", [
      ["Kenapa Penggugat mengajukan cerai terhadap Tergugat?", "Penggugat mengajukan cerai karena sudah tidak rukun dalam rumah tangganya;"],
      ["Apakah antara Penggugat dan Tergugat sering terjadi perselisihan?", "Saya tidak mengetahui perselisihan Penggugat dan Tergugat;"],
    ]);
    const r = rekomendasiPutusanDariBukti(cerai({ saksi: [tahu, tidak] }))!;
    expect(r.unsur.find((x) => x.id === "alasan-selisih")!.status).toBe("belum");
    expect(r.hasil).toBe("ditolak");
  });

  it("bukti ada tetapi tanpa akta nikah (bukan kumulasi itsbat) -> tidak dapat diterima, ragu", () => {
    const r = rekomendasiPutusanDariBukti(cerai({ bukti: [KTP] }))!;
    expect(r.hasil).toBe("tidak-dapat-diterima");
    expect(r.keyakinan).toBe("ragu");
    expect(r.belum).toContain("Hubungan hukum perkawinan");
  });

  it("selingkuh (57/60/70): bukti elektronik saja belum; satu saksi + bukti terbukti; putusan pidana zina cukup", () => {
    const sel = (ke: number) => s(`z${ke}`, "P", ke, "Kakak Kandung", [["Apa penyebab perselisihan?", "Tergugat berselingkuh dengan perempuan lain, saya melihat sendiri;"]]);
    const foto = b("P.3", "Tangkapan layar percakapan Tergugat dengan wanita idaman lain, bukti elektronik tersebut diberi tanda P.3", "elektronik");
    const tanpaSaksi = rekomendasiPutusanDariBukti(cerai({ saksi: [], bukti: [AKTA, foto], huruf: "A" }))!;
    expect(tanpaSaksi.unsur.find((x) => x.id === "alasan-selingkuh")!.status).toBe("belum");
    const satuPlus = rekomendasiPutusanDariBukti(cerai({ saksi: [sel(1)], bukti: [AKTA, foto], huruf: "A" }))!;
    expect(satuPlus.unsur.find((x) => x.id === "alasan-selingkuh")!.status).toBe("terbukti");
    const pidana = rekomendasiPutusanDariBukti(cerai({ saksi: [], bukti: [AKTA, b("P.4", "Fotokopi Putusan Pengadilan Negeri Donggala tentang perzinahan atas nama Tergugat")], huruf: "A" }))!;
    expect(pidana.unsur.find((x) => x.id === "alasan-selingkuh")!.status).toBe("terbukti");
  });

  it("penilaian A2 menang: dalil perselisihan yang diakui tanpa saksi keluarga tetap belum (keputusan 105)", () => {
    const pn = { baris: [{ topik: ["perselisihan dan pertengkaran"], status: "belum-terbukti", nomor: "4", alasan: "Diakui Tergugat - tetap perlu didengar keluarga/orang dekat (Pasal 22 ayat (2) PP 9/1975); belum ada saksi yang bersesuaian." }], kesimpulan: { alasanTerbukti: [], alasanBelum: ["perselisihan dan pertengkaran"], bulanPisah: null, catatan: [] } } as unknown as HasilPenilaian;
    const r = rekomendasiPutusanDariBukti(cerai({ saksi: [], penilaian: pn, kehadiran: { tPernahHadir: true } }))!;
    const u = r.unsur.find((x) => x.id === "alasan-selisih")!;
    expect(u.status).toBe("belum");
    expect(u.ringkas).toMatch(/Diakui Tergugat/);
    expect(r.hasil).toBe("ditolak");
    expect(r.verstek).toBe(false);
  });

  it("Pemohon pernah hadir lalu dua kali tidak hadir -> tidak dapat diterima (SEMA 1/2022 angka 5 huruf a)", () => {
    expect(pTidakHadirLagi([2, 4, 4])).toBe(true);
    expect(pTidakHadirLagi([2, 2, 4])).toBe(false);
    expect(pTidakHadirLagi([4, 4])).toBe(false);
    const r = rekomendasiPutusanDariBukti(cerai({ kehadiran: { tPernahHadir: false, pTidakHadirLagi: true } }))!;
    expect(r.hasil).toBe("tidak-dapat-diterima");
    expect(r.unsur[0].dasar).toEqual(["SEMA Nomor 1 Tahun 2022 Kamar Agama angka 5 huruf a"]);
    expect(r.blangko[0].berkas).toBe("[98] [NO] 4a. Cerai P Hadir Sidang Pertama Lalu 2x Tidak Hadir (SEMA 1 2022).rtf");
  });

  it("tanpa saksi dan bukti -> belum dapat direkomendasikan, tanpa blangko", () => {
    const r = rekomendasiPutusanDariBukti(cerai({ saksi: [], bukti: [] }))!;
    expect(r.hasil).toBe("");
    expect(r.label).toBe("Belum dapat direkomendasikan");
    expect(r.blangko).toEqual([]);
  });

  it("lama waktu & masa SEMA", () => {
    expect(lamaBulan("pisah sejak bulan Mei 2023", "2023-12-01")).toBe(7);
    expect(lamaBulan("sudah sekitar 11 (sebelas) bulan", "")).toBe(11);
    expect(lamaBulan("sejak awal tahun 2024", "2025-01-15")).toBe(12);
    expect(masaSema("2022-12-14")).toBe("sebelum");
    expect(masaSema("2023-06-01")).toBe("sema-2022");
    expect(masaSema("2023-12-29")).toBe("sema-2023");
  });

  it("jenis lain tidak direkomendasikan", () => {
    expect(rekomendasiPutusanDariBukti({ jenisPerkara: "Harta Bersama", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", saksi: [], bukti: [] })).toBeNull();
  });
});

function saksiItsbat(ke: number, o: { wali?: string; status?: string; umur?: string; hadir?: boolean } = {}): SaksiMasuk {
  return s(`i${ke}`, "P", ke, "Tetangga", [
    ["Apakah saksi hadir sewaktu Pemohon I dengan Pemohon II menikah?", o.hadir === false ? "Tidak, saya tidak hadir, namun saya mendapat informasi dari orang-orang yang hadir;" : "Ya, saya hadir sewaktu Pemohon I dengan Pemohon II menikah;"],
    ["Dimana Pemohon I dengan Pemohon II menikah?", "Pemohon I dengan Pemohon II menikah di Desa Rarampadende pada tanggal 21 Desember 2021;"],
    ["Berapa umur Pemohon I dan Pemohon II ketika menikah?", o.umur || "Pemohon I berumur 23 tahun, dan Pemohon II berumur 20 tahun;"],
    ["Apa status Pemohon I dan Pemohon II saat menikah?", o.status || "Sebelum menikah Pemohon I berstatus Jejaka dan Pemohon II berstatus Perawan;"],
    ["Siapa yang menjadi wali nikah Pemohon II?", o.wali || "Yang menjadi wali nikah adalah Ayah Kandung Pemohon II bernama Abdul Salam;"],
    ["Siapa yang menikahkan Pemohon I dengan Pemohon II?", "Yang menikahkan adalah Imam Desa bernama Hasbi;"],
    ["Siapakah yang bertindak sebagai saksi nikah?", "Yang bertindak sebagai saksi nikah pada saat terjadinya ijab kabul adalah Ruslan dan Ilham;"],
    ["Apa mahar yang diberikan Pemohon I kepada Pemohon II?", "Mahar berupa cincin emas 1 gram dibayar tunai;"],
    ["Bagaimana proses pengucapan ijab dan kabul?", "Wali Nikah Pemohon II mengucapkan ijab dan Pemohon I mengucapkan kabul tanpa jeda;"],
    ["Apakah antara Pemohon I dan Pemohon II ada hubungan darah, semenda atau sesusuan?", "Pemohon I dan Pemohon II tidak ada hubungan darah, semenda atau sesusuan;"],
    ["Pernahkah saksi mendengar ada pihak lain yang keberatan?", "Saya tidak pernah mendengar ada pihak lain yang keberatan;"],
    ["Apakah Pemohon I dengan Pemohon II pernah bercerai?", "Pemohon I dengan Pemohon II belum bercerai, keduanya hidup rukun;"],
    ["Apakah sudah dikaruniai anak?", "Telah dikaruniai seorang anak bernama Rafif, umur 2 tahun;"],
  ]);
}
const itsbat = (o: Partial<MasukanRekomendasiPutusan> = {}): MasukanRekomendasiPutusan => ({
  jenisPerkara: "Pengesahan Perkawinan/Istbat Nikah",
  nomorPerkara: "88/Pdt.P/2026/PA.Dgl",
  saksi: [saksiItsbat(1), saksiItsbat(2)],
  bukti: [b("P.1", "Fotokopi Kartu Tanda Penduduk atas nama Pemohon I"), b("P.2", "Fotokopi Kartu Keluarga atas nama Pemohon I")],
  tanggalNikah: "2021-12-21",
  ...o,
});

describe("itsbat nikah: Pasal 7 dan 14 KHI, halangan, umur, poligami", () => {
  it("rukun lengkap, tanpa halangan, umur cukup -> dikabulkan; umur anak dan 'belum bercerai (satu sama lain)' tidak salah dibaca", () => {
    const r = rekomendasiPutusanDariBukti(itsbat())!;
    expect(r.jenis).toBe("itsbat");
    expect(r.hasil).toBe("dikabulkan");
    expect(r.keyakinan).toBe("cukup");
    const st = Object.fromEntries(r.unsur.map((u) => [u.id, u.status]));
    expect(st).toMatchObject({ wali: "terbukti", "saksi-nikah": "terbukti", ijab: "terbukti", halangan: "terbukti", umur: "terbukti", keberatan: "terbukti", hadir: "terbukti" });
    expect(r.unsur.find((u) => u.id === "wali")!.dasar).toEqual(["Pasal 14 Kompilasi Hukum Islam"]);
    expect(r.blangko[0].berkas).toBe("[01] [Kabul] IN.rtf");
  });

  it("wali paman dari pihak ibu -> ditolak (wali tidak sah)", () => {
    const w = "Yang menjadi wali adalah Paman Pemohon II (saudara kandung dari Ibu kandung Pemohon II) bernama Risman;";
    const r = rekomendasiPutusanDariBukti(itsbat({ saksi: [saksiItsbat(1, { wali: w }), saksiItsbat(2, { wali: w })] }))!;
    expect(r.hasil).toBe("ditolak");
    expect(r.blangko[0].berkas).toBe("[03] [Tolak] IN - Rukun Tidak Terpenuhi (Wali Tidak Sah).rtf");
  });

  it("masih terikat perkawinan lain -> tidak dapat diterima", () => {
    const st = "Sebelum menikah Pemohon I masih beristri dengan perempuan lain dan belum bercerai dengan istri pertamanya;";
    const r = rekomendasiPutusanDariBukti(itsbat({ saksi: [saksiItsbat(1, { status: st }), saksiItsbat(2, { status: st })] }))!;
    expect(r.hasil).toBe("tidak-dapat-diterima");
    expect(r.blangko[0].berkas).toBe("[99] [NO] IN - Masih Terikat Nikah Sebelumnya (Belum Cerai).rtf");
  });

  it("umur 17 tahun pada nikah sesudah UU 16/2019 -> tidak dapat diterima (Dibawah Umur), ragu; sebelum 2019 hanya catatan", () => {
    const um = "Pemohon I berumur 17 tahun dan Pemohon II berumur 16 tahun;";
    const r = rekomendasiPutusanDariBukti(itsbat({ saksi: [saksiItsbat(1, { umur: um }), saksiItsbat(2, { umur: um })] }))!;
    expect(r.hasil).toBe("tidak-dapat-diterima");
    expect(r.keyakinan).toBe("ragu");
    expect(r.blangko[0].berkas).toBe("[99] [NO] IN - Dibawah Umur.rtf");
    const lama = rekomendasiPutusanDariBukti(itsbat({ saksi: [saksiItsbat(1, { umur: um }), saksiItsbat(2, { umur: um })], tanggalNikah: "2005-03-01" }))!;
    expect(lama.hasil).toBe("dikabulkan");
    expect(lama.unsur.find((u) => u.id === "umur")!.status).toBe("catatan");
  });

  it("saksi tidak hadir saat akad (cerita orang banyak) -> istifadhah, ragu, varian Syahadah Al Istifadhah", () => {
    const r = rekomendasiPutusanDariBukti(itsbat({ saksi: [saksiItsbat(1, { hadir: false }), saksiItsbat(2, { hadir: false })] }))!;
    expect(r.unsur.find((u) => u.id === "hadir")!.dasar).toEqual(["SEMA Nomor 10 Tahun 2020 Kamar Agama huruf C angka 1 huruf a"]);
    expect(r.keyakinan).toBe("ragu");
    expect(r.blangko[0].berkas).toBe("[01a] [Kabul] IN - Syahadah Al Istifadhah.rtf");
  });
});

function saksiDk(ke: number, alasan: string, calon = "calon suami"): SaksiMasuk {
  return s(`d${ke}`, "P", ke, "Tetangga", [
    ["Kenapa Pemohon mau memohon dispensasi kawin?", "Pemohon mau menikahkan anaknya namun ditolak oleh Kantor Urusan Agama karena belum cukup umur;"],
    ["Berapa umur anak Pemohon tersebut sekarang?", "Anak Pemohon sekarang sudah berumur 17 tahun;"],
    [`Berapa umur ${calon} anak Pemohon sekarang?`, `${calon} anak Pemohon sekarang berumur 27 tahun;`],
    ["Sudah berapa lama anak Pemohon dengan calonnya saling mengenal?", alasan],
    ["Apakah ada hubungan darah, semenda atau susuan?", "Antara anak Pemohon dan calonnya tidak ada hubungan darah, semenda atau susuan;"],
    ["Apakah keluarga kedua belah pihak telah merestui?", "Ya, keluarga kedua belah pihak telah sepakat mau menikahkan keduanya;"],
    [`Apakah ${calon} sudah memiliki pekerjaan?`, `Ya, ${calon} sudah bekerja sebagai petani dengan penghasilan cukup;`],
  ]);
}
const dk = (alasan: string, o: Partial<MasukanRekomendasiPutusan> = {}, calon?: string): MasukanRekomendasiPutusan => ({
  jenisPerkara: "Dispensasi Kawin",
  nomorPerkara: "9/Pdt.P/2026/PA.Dgl",
  saksi: [saksiDk(1, alasan, calon), saksiDk(2, alasan, calon)],
  bukti: [b("P.1", "Fotokopi Kartu Tanda Penduduk Pemohon"), b("P.2", "Fotokopi Kutipan Akta Kelahiran anak Pemohon"), b("P.3", "Asli Surat Penolakan Pernikahan dari Kantor Urusan Agama (model N9)")],
  ...o,
});

describe("dispensasi kawin: PERMA 5/2019, Pasal 7 ayat (2) UU 16/2019", () => {
  it("anak hamil menurut dua saksi + akta kelahiran + penolakan KUA -> dikabulkan, varian (Anak P Cewek) Hamil", () => {
    const r = rekomendasiPutusanDariBukti(dk("Sudah saling mengenal 1 tahun dan anak Pemohon saat ini telah hamil;"))!;
    expect(r.jenis).toBe("dk");
    expect(r.hasil).toBe("dikabulkan");
    const u = Object.fromEntries(r.unsur.map((x) => [x.id, x]));
    expect(u.umur.status).toBe("terbukti");
    expect(u.umur.bukti.map((x) => x.kode)).toEqual(expect.arrayContaining(["P.2", "P.3"]));
    expect(u.mendesak.status).toBe("terbukti");
    expect(u.mendesak.dasar[0]).toMatch(/^Pasal 7 ayat \(2\) Undang-Undang Nomor 1 Tahun 1974/);
    expect(u.didengar.dasar).toEqual(expect.arrayContaining(["Pasal 13 Peraturan Mahkamah Agung Nomor 5 Tahun 2019"]));
    expect(u.pendukung.dasar).toContain("Pasal 15 huruf d dan Pasal 16 huruf h Peraturan Mahkamah Agung Nomor 5 Tahun 2019");
    expect(r.blangko[0].berkas).toBe("[01] [Kabul] DK - (Anak P Cewek) Hamil.rtf");
  });

  it("anak laki-laki, calon istri hamil -> varian (Anak P Cowok) Calon Istri Hamil", () => {
    const r = rekomendasiPutusanDariBukti(dk("Calon istri anak Pemohon saat ini telah hamil 3 bulan;", {}, "calon istri"))!;
    expect(r.blangko[0].berkas).toBe("[01] [Kabul] DK - (Anak P Cowok) Calon Istri Hamil.rtf");
  });

  it("hanya hubungan erat/pacaran -> ditolak, ragu; blangko kabul tetap ditawarkan sebagai alternatif", () => {
    const r = rekomendasiPutusanDariBukti(dk("Sudah saling mengenal 3 tahun dan hubungan mereka sangat erat, dikhawatirkan berbuat zina;"))!;
    expect(r.hasil).toBe("ditolak");
    expect(r.keyakinan).toBe("ragu");
    expect(r.blangko[0].berkas).toBe("[03] [Tolak] DK - (Anak P Cewek) Belum Hamil.rtf");
    expect(r.blangko.some((x) => /\[Kabul\]/.test(x.berkas) && !x.utama)).toBe(true);
  });

  it("umur calon 27 tahun tidak dibaca sebagai umur anak; anak sudah 19 tahun -> tidak dapat diterima", () => {
    const tua = dk("anak telah hamil;");
    tua.saksi = tua.saksi.map((x) => ({ ...x, baris: x.baris.map((r) => (/umur anak Pemohon tersebut/.test(r.tanya || "") ? { ...r, jawab: "Anak Pemohon sekarang sudah berumur 19 tahun;" } : r)) }));
    expect(rekomendasiPutusanDariBukti(tua)!.hasil).toBe("tidak-dapat-diterima");
    expect(rekomendasiPutusanDariBukti(dk("anak telah hamil;"))!.hasil).toBe("dikabulkan");
  });
});

describe("kinerja", () => {
  // Kasus ekstrem (perkara biasa +-3 ms). Di uji penuh 3 utas laptop terbebani sehingga 60 ms tidak stabil (62-66 ms saat
  // digabung ke rilis-62); 120 ms tetap jauh di bawah batas terasa lambat dan menangkap perlambatan berlipat.
  it("20 saksi x 40 baris < 120 ms", () => {
    const banyak = Array.from({ length: 20 }, (_, i) => {
      const x = saksiCerai(i + 1, "Tetangga");
      for (let j = 0; j < 33; j++) x.baris.push({ tanya: `Pertanyaan ${j}?`, jawab: `Penggugat dan Tergugat sering bertengkar karena masalah ${j} sejak tahun 2024;` });
      return x;
    });
    rekomendasiPutusanDariBukti(cerai({ saksi: banyak }));
    const t0 = performance.now();
    rekomendasiPutusanDariBukti(cerai({ saksi: banyak }));
    expect(performance.now() - t0).toBeLessThan(120);
  });
});

describe("ekstensi: blangko-derry-rekomendasi.js (murni)", () => {
  const data = (r: object) => ({ ada: true, rekomendasi: r, denganPenilaian: false });
  const rek = rekomendasiPutusanDariBukti(cerai({}))!;

  it("jenis berlaku & kehadiran dari riwayat sidang (sidang sesudah putusan/hari ini tidak dihitung)", () => {
    expect(RP.jenisBerlaku("Cerai Gugat", "1/Pdt.G/2026/PA.Dgl")).toBe("cerai-gugat");
    expect(RP.jenisBerlaku("Pengesahan Perkawinan/Istbat Nikah", "1/Pdt.G/2026/PA.Dgl")).toBe("itsbat-kontensius");
    expect(RP.jenisBerlaku("Harta Bersama", "1/Pdt.G/2026/PA.Dgl")).toBe("");
    const sd = [
      { tanggal: "2026-08-01", hadir: 2 },
      { tanggal: "2026-08-08", hadir: 4 },
      { tanggal: "2026-08-15", hadir: 4 },
      { tanggal: "2026-09-30", hadir: 1 },
    ];
    expect(RP.kehadiranDari(sd, { tanggalPutusan: "2026-08-15" }, "2026-10-01")).toEqual({ tPernahHadir: false, pTidakHadirLagi: true, verstekSipp: false });
    expect(RP.kehadiranDari(sd, null, "2026-10-01")).toMatchObject({ tPernahHadir: true, pTidakHadirLagi: false, verstekSipp: null });
  });

  it("kotak: hasil, keyakinan, unsur & dasar; teks di-escape; berbeda dengan putusan majelis diberi tanda", () => {
    const h = RP.htmlIsi(data(rek), {});
    expect(h).toContain("Dikabulkan (verstek)");
    expect(h).toContain("keyakinan cukup");
    expect(h).toContain("Pasal 22 ayat (2) Peraturan Pemerintah Nomor 9 Tahun 1975");
    expect(h).toContain("<b>P.2</b>");
    expect(h).toContain("melihat/mengetahui sendiri, Ibu Kandung");
    expect(h).not.toMatch(/aleta/i);
    expect(RP.htmlIsi(data({ ...rek, ringkas: "<img src=x>" }), {})).toContain("&lt;img");
    expect(RP.htmlIsi(data(rek), { putusSipp: "Ditolak" })).toContain("rekomendasi ini berbeda");
    expect(RP.htmlIsi(null, {})).toMatch(/Menyusun rekomendasi/);
  });

  it("saran blangko: rekomendasi paling atas bila belum diputus, di belakang bila majelis sudah memutus; varian yang tidak ada dibuang", () => {
    const menu = [{ nama: "Putusan Cerai Gugat", berkas: [{ berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)" }, { berkas: "[02] [Kabul] CG - F" }] }];
    const s1 = RP.saranBlangko(data(rek), menu);
    expect(s1).toEqual([expect.objectContaining({ berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)", kelompok: "Putusan Cerai Gugat", jenis: "put", utama: true, rekomendasiBukti: true, saksi: 2 })]);
    const lama = [{ berkas: "BAS ALUR 01 [1a]", jenis: "bas", kelompok: "x" }, { berkas: "[98] [Gugur] 3. Cerai P & T Tidak Hadir", jenis: "put", kelompok: "Putusan Cerai Gugat", utama: true }];
    const atas = RP.gabungSaran(lama, s1, false);
    expect(atas[0].berkas).toBe("[01] [Kabul Verstek] Cerai (Format Lengkap)");
    expect(atas.filter((x: Apa) => x.utama && x.jenis === "put")).toHaveLength(1);
    const bawah = RP.gabungSaran(lama, s1, true);
    expect(bawah[1].berkas).toBe("[98] [Gugur] 3. Cerai P & T Tidak Hadir");
    expect(bawah[2]).toMatchObject({ berkas: "[01] [Kabul Verstek] Cerai (Format Lengkap)", utama: false });
    const varianHilang = RP.saranBlangko(data({ ...rek, blangko: [{ ...rek.blangko[0], berkas: "[01x] Tidak Ada.rtf" }, rek.blangko[0]] }), menu);
    expect(varianHilang.map((x: Apa) => x.berkas)).toEqual(["[01] [Kabul Verstek] Cerai (Format Lengkap)"]);
  });

  it("segarkan: satu permintaan per sidik bahan; bahan sama tidak meminta lagi", async () => {
    const minta: string[] = [];
    const o = { nomor: "77/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", sebutan: { P: "Penggugat", T: "Tergugat" }, kehadiran: { tPernahHadir: false }, bahan: () => null, ambil: async (u: string) => (minta.push(u), data(rek)) };
    RP.segarkan(o);
    await new Promise((r) => setTimeout(r, 20));
    RP.segarkan(o);
    await new Promise((r) => setTimeout(r, 20));
    expect(minta).toHaveLength(1);
    expect(RP.tersinggah("77/Pdt.G/2026/PA.Dgl").rekomendasi.label).toBe("Dikabulkan (verstek)");
  });
});

describe("server & bot", () => {
  it("hubungan saksi dari ABT ditempel ke saksi panel (pihak + urutan)", () => {
    const panel = [s("saksi-1-p", "P", 1, "", [["a", "b"]]), s("saksi-2-p", "P", 2, "", [["a", "b"]])];
    const abt = [s("5", "P", 1, "Ibu Kandung", []), s("6", "P", 2, "Tetangga", [])];
    expect(tempelHubungan(panel, abt).map((x) => x.hubungan)).toEqual(["Ibu Kandung", "Tetangga"]);
  });

  it("bot: bukti permohonan (0378/9958/8133) ikut sebagai bukti Pemohon, bukti sama tidak diulang, hanya SELECT", async () => {
    const sql: string[] = [];
    const runQuery = async (q: string) => (sql.push(q), /FROM perkara WHERE/.test(q) ? [{ id: 9 }] : []);
    const runAbt = async (q: string, p: unknown[]) => {
      sql.push(q);
      if (/abt_keterangan_saksi/.test(q)) return [];
      expect(p).toEqual([9, "1214", "0378", "9958", "8133", "9911", "1262"]);
      return [
        { no_var: "0378", data: "1. Fotokopi Kartu Tanda Penduduk atas nama Ahmad (Pemohon I), lalu diberi tanda P.1;\n2. Fotokopi Kartu Keluarga, lalu diberi tanda P.2;" },
        { no_var: "9958", data: "Fotokopi Kartu Tanda Penduduk atas nama Ahmad (Pemohon I), lalu diberi tanda P.1;" },
        { no_var: "8133", data: "Asli Surat Keterangan dari Puskesmas tentang kehamilan anak Pemohon, diberi kode (P.3);" },
      ];
    };
    const h = await BP.bahanPembuktian("1/Pdt.P/2026/PA.Xyz", { runQuery, runAbt });
    expect(h.bukti.map((x: Apa) => [x.kode, x.pihak])).toEqual([["P.1", "P"], ["P.2", "P"], ["P.3", "P"]]);
    expect(sql.every((q) => /^\s*SELECT/i.test(q))).toBe(true);
  });
});
