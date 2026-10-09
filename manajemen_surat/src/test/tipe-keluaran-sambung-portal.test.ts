// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usulkanAlasanPerkara } from "@/lib/alasan-perkara-sipp";
import { pecahNaskahPutusan } from "@/lib/susunan-putusan";
import { saringMedanPilihan, usulkanMedanPutusan, type UsulanMedan } from "@/lib/usulan-medan-putusan";
import type { AletaDatabase } from "@/server/db/client";
import { BUNYI_KEHADIRAN } from "@/server/modules/aleta-ecourt/bas-kehadiran";
import { sahkan, usul } from "@/server/modules/aleta-ecourt/tipe-keluaran";

/**
 * ============================================================================
 * KONSUMEN PORTAL MEMBACA TIPE KELUARAN - RUTE DIJALANKAN SUNGGUHAN
 * ============================================================================
 *
 * Tiga rute portal kini membaca daftar efektif tipe keluaran (untukPortal):
 *   POST putusan/isian-sipp   putusan.sumber-hukum.sebutan + putusan.bawaan-medan
 *   POST alasan-perkara       daftar yang sama (mesin usulan yang sama)
 *   GET  bas/kehadiran        bas.kehadiran.bunyi
 *
 * Janji yang dijaga, dan bila patah patahnya DIAM:
 *   1. Tabel kosong = jawaban sama persis dengan sebelum disambung - setiap
 *      fixture, deep-equal, tanpa kabar tambahan.
 *   2. Tambahan yang disahkan mengubah usulan HANYA pada fixture yang
 *      relevan - dihitung per fixture, bukan dijumlah.
 *   3. Basis data tak terbaca = konstanta kode dan kabar "memakai bawaan",
 *      tidak satu pun jawaban 500.
 *
 * Yang ditiru hanya kewenangan, sesi, gerbang bot, dan penulis galat rute
 * (supaya jawaban 500 dapat DIHITUNG). Basis datanya pg-mem sungguhan dan
 * modul tipe keluarannya modul sungguhan.
 *
 * FIXTURE: 30 putusan dan 10 Data Umum dari putusan sipp_donggala 2025-2026
 * (hasil SELECT), diringkas ke kalimat yang memuat dasar hukum dan fakta
 * medan, lalu DISAMARKAN: nama menjadi xxx, tanggal dan nomor dibuang, nomor
 * perkara diganti urutan. Dipetik oleh
 * D:/aleta-dev/kerja/enam-butir/t2-sambung-portal-tipe/petik-fixture.js.
 */

const uji = vi.hoisted(() => ({ db: null as unknown, n500: 0, galat: [] as string[], lemparTipe: false }));

// untukPortal ASLI, kecuali uji menyalakan lemparTipe: galat yang tidak
// ditangkap untukPortal sendiri harus ditangkap rute.
vi.mock("@/server/modules/aleta-ecourt/tipe-keluaran", async (asli) => {
  const modul = (await asli()) as typeof import("@/server/modules/aleta-ecourt/tipe-keluaran");
  return {
    ...modul,
    untukPortal: (...a: Parameters<typeof modul.untukPortal>) => {
      if (uji.lemparTipe) throw new Error("untukPortal melempar (tiruan)");
      return modul.untukPortal(...a);
    },
  };
});

vi.mock("@/server/db/client", async (asli) => {
  const modul = (await asli()) as Record<string, unknown>;
  return { ...modul, getDatabase: async () => uji.db };
});
vi.mock("@/server/modules/aleta-ecourt/akses", async (asli) => {
  const modul = (await asli()) as Record<string, unknown>;
  return { ...modul, pastikanKapabilitas: async () => ({ name: "Penguji" }) };
});
// Hak unggah putusan (9 Okt 2026) diuji di hak-unggah-putusan-9okt.test.ts;
// di sini yang diuji tipe keluaran, termasuk basis data yang tak terbaca.
vi.mock("@/server/modules/aleta-ecourt/hak-putusan", () => ({
  pastikanBolehUnggahPutusan: async () => ({ actor: { name: "Penguji" }, peran: "admin" }),
  bolehUnggahPutusan: () => true,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr-admin" }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewaySippKonteks: async () => ({ ok: false, error: "tidak dipakai" }),
  getGatewaySippObyekSengketa: async () => ({ ok: false, error: "tidak dipakai" }),
}));
vi.mock("@/server/shared/admin-access-audit", () => ({
  // Setiap galat yang lolos dari rute DIHITUNG sebagai jawaban 500.
  handleAdminRouteError: (galat: unknown) => {
    uji.n500 += 1;
    uji.galat.push(galat instanceof Error ? galat.message : String(galat));
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  },
}));

// prettier-ignore
const FIXTURE: {
  putusan: Array<{ nomor: string; jenis: string; cerai: boolean; dispen: boolean; pertimbangan: string; amar: string }>;
  umum: Array<{ nomor: string; jenisAlasan: number; posita: string; petitum: string }>;
  rujukan: Record<string, Array<{ id: number; nama: string }>>;
} = {
 "putusan": [
  {
   "nomor": "1/Pdt.G/2025/PA.Dgl",
   "jenis": "P3HP/Penetapan Ahli Waris",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "Dalam Kitab I’anatut Thalibin, xxx III, halaman 223: Menimbang, bahwa Para Pemohon telah dipanggil secara resmi dan patut ke hadapan sidang secara elektronik (e-court) melalui alamat domisili elektronik Para Pemohon sesuai dengan ketentuan Pasal 15 ayat 1 xxx Nomor 1 tahun 2019 Tentang xxx Perkara dan Persidangan di Pengadilan xxx Surat xxx Ketua Mahkamah Agung Republik Indonesia, Nomor 129/xxx/xxx/xxx/2019 Tentang xxx Perkara dan Persidangan di Pengadilan xxx, yang telah diubah dengan xxx Nomor 7 tahun 2022 Tentang xxx Perkara dan Persidangan di Pengadilan xxx dan Surat xxx Ketua Mahkamah Agung Republik Indonesia Nomor 363/xxx/xxx/xxx/2022 Tentang xxx dan Persidangan Perkara xxx Agama, dan xxx Negara di Pengadilan xxx;",
   "amar": "xxx 1. Mengabulkan permohonan para Pemohon; 2. Menetapkan ahli waris xxx yang telah meninggal dunia pada tanggal xx xxxx, sebagai berikut: 2.1 xxx (saudara kandung); 2.2 xxx (saudara kandung); 2.3 xxx., M. xxx (saudara kandung); 2.4 xxx (saudara kandung); 2.5 xxx (ahli waris pengganti dari xxx); 2.6 xxx (ahli waris pengganti dari xxx); 3. Menetapkan Para Pemohon berhak mengurus xxx (xxx) di xxx atas nama xxx; 4. Membebankan kepada para Pemohon untuk membayar biaya perkara ini sebesar Rp135.000,0"
  },
  {
   "nomor": "2/Pdt.G/2025/PA.Dgl",
   "jenis": "P3HP/Penetapan Ahli Waris",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "Dalam Kitab I’anatut Thalibin , xxx III, halaman 223: Menimbang, bahwa Para Pemohon dan xxx telah dipanggil secara resmi dan patut ke hadapan sidang secara elektronik (e-court) melalui alamat domisili elektronik xxx Para Pemohon sesuai dengan ketentuan Pasal 15 ayat 1 xxx Nomor 1 tahun 2019 Tentang xxx Perkara dan Persidangan di Pengadilan xxx Surat xxx Ketua Mahkamah Agung Republik Indonesia, Nomor 129/xxx/xxx/xxx/2019 Tentang xxx Perkara dan Persidangan di Pengadilan xxx, yang telah diubah dengan xxx Nomor 7 tahun 2022 Tentang xxx Perkara dan Persidangan di Pengadilan xxx dan Surat xxx Ketua Mahkamah Agung Republik Indonesia Nomor 363/xxx/xxx/xxx/2022 Tentang xxx dan Persidangan Perkara xxx Agama, dan xxx Negara di Pengadilan xxx; (Pasal 127 xxx:",
   "amar": "xxx Mengabulkan Permohonan Para Pemohon untuk seluruhnya; Menyatakan xxx telah meninggal dunia karena sakit pada xxx xx xxxx sedangkan xxx telah meninggal dunia karena sakit pada xxx xx xxxx; Menetapkan xxx dari almarhum xxx dan almarhum xxx adalah: xxx (Anak xxx); xxx (Anak xxx); xxx (Anak xxx); 4. Menyatakan xxx telah meninggal dunia karena sakit pada xxx xx xxxx; 5. Menyatakan xxx telah meninggal dunia karena sakit pada xxx xx xxxx; 6. Menetapkan xxx dari xxx adalah: xxx (xxx/Pemohon I); xxx "
  },
  {
   "nomor": "3/Pdt.P/2025/PA.Dgl",
   "jenis": "Pengesahan Perkawinan/Istbat Nikah",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa dalam kitab I’anatut Thalibin xxx IV halaman 253-254, yang telah diambil alih oleh Hakim Hakim sebagai bahan pertimbangan, disebutkan tentang pembebanan pembuktian bagi pengakuan sah nikah sebagai berikut: Menimbang, bahwa di samping itu, hal tersebut juga sejalan dengan ibarat dalam kitab I’anatut Thalibin xxx IV halaman 254 yang kemudian diambil alih sebagai pendapat Hakim yang menyatakan: Berdasarkan ketentuan Pasal 49 huruf a xxx Nomor 3 Tahun 2006 tentang Perubahan Atas xxx Nomor 7 Tahun 1989 tentang xxx Agama dan penjelasannya jo. Pasal 7 ayat (2) Kompilasi Hukum Islam, maka Pengadilan Agama berwenang memeriksa, mengadili, dan memutus perkara a quo ; Oleh karena itu, berdasarkan Pasal 7 ayat (4) Kompilasi Hukum Islam, para Pemohon memiliki legal standing (kepentingan hukum) untuk mengajukan permohonan pengesahan nikah a quo ( legitima persona standi in judicio );",
   "amar": "Menolak permohonan Pemohon I dan Pemohon II; Membebankan kepada para Pemohon untuk membayar biaya perkara ini sejumlah Rp170.000,00. (seratus tujuh puluh ribu rupiah)."
  },
  {
   "nomor": "4/Pdt.P/2025/PA.Dgl",
   "jenis": "Pengesahan Perkawinan/Istbat Nikah",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "xxx mana sejalan dengan dalil fikih yang termaktub dalam kitab I’anatut Thalibin xxx IV halaman 253-254, yang telah diambil alih oleh Majelis Hakim sebagai bahan pertimbangan, bunyinya sebagai berikut: Menimbang, bahwa selanjutnya akan dipertimbangkan apakah perkawinan yang dilakukan para Pemohon telah memenuhi kategori perkawinan yang dimaksud dalam ketentuan Pasal 2 ayat (1) xxx Nomor 1 Tahun 1974 tentang Perkawinan sebagaimana telah diubah dengan xxx Nomor 16 Tahun 2019 jo. Pasal 4 Kompilasi Hukum Islam, yaitu Perkawinan sah apabila dilakukan menurut hukum masing-masing agama dan kepercayaannya, in casu hukum Islam; Dan dalam Kitab Bughyatul Mustarsyidin halaman 298: Menimbang, bahwa untuk melangsungkan perkawinan antara seorang pria dengan seorang wanita terdapat larangan-larangan kawin sebagaimana ditegaskan Pasal 8 sampai dengan Pasal 10 xxx Nomor 1 Tahun 1974 tentang Perkawinan sebagaimana telah diubah dengan xxx Nomor 16 Tahun 2019 jo. Pasal 39 sampai dengan Pasal 44 Kompilasi Hukum Islam.",
   "amar": "Mengabulkan permohonan Pemohon I dan Pemohon II; Menyatakan sah pernikahan antara Pemohon I ( xxx ) dengan Pemohon II ( xxx ) yang dilaksanakan pada tanggal xx xxxx di Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah; Memerintahkan kepada Pemohon I dan Pemohon II untuk mencatatkan pernikahannya pada Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala; Membebankan kepada para Pemohon untuk membayar biaya perkara ini sejumlah Rp170.000,00. (seratus tujuh puluh ribu rupiah)."
  },
  {
   "nomor": "5/Pdt.P/2025/PA.Dgl",
   "jenis": "Pengesahan Perkawinan/Istbat Nikah",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa dalam kitab I’anatut Thalibin xxx IV halaman 253-254, yang telah diambil alih oleh Hakim sebagai bahan pertimbangan, disebutkan tentang pembebanan pembuktian bagi pengakuan sah nikah sebagai berikut: xxx mana sejalan dengan dalil fikih yang termaktub dalam kitab I’anatut Thalibin xxx IV halaman 253-254, yang telah diambil alih oleh Hakim sebagai bahan pertimbangan, bunyinya sebagai berikut: Menimbang, bahwa dengan berpedoman pada Surat xxx Mahkamah Agung Nomor 3 Tahun 2014 tentang xxx dan xxx Perkara xxx Itsbat Nikah dalam xxx, huruf (d), maka perkara ini disidangkan dengan hakim tunggal; Berdasarkan ketentuan Pasal 49 huruf a xxx Nomor 3 Tahun 2006 tentang Perubahan Atas xxx Nomor 7 Tahun 1989 tentang xxx Agama dan penjelasannya jo. Pasal 7 ayat (2) Kompilasi Hukum Islam, maka Pengadilan Agama berwenang memeriksa, mengadili, dan memutus perkara a quo ;",
   "amar": "xxx Mengabulkan permohonan Pemohon I dan Pemohon II; Menyatakan sah pernikahan antara Pemohon I ( xxx ) dengan Pemohon II ( xxx ) yang dilaksanakan pada tanggal xx xxxx di Desa xxx, Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah; Memerintahkan kepada Pemohon I dan Pemohon II untuk mencatatkan pernikahannya pada Kantor Urusan Agama Kecamatan xxx; Membebankan kepada para Pemohon untuk membayar biaya perkara ini sejumlah Rp170.000,00. (seratus tujuh puluh ribu rupiah)."
  },
  {
   "nomor": "6/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Bahwa Pemohon dengan Termohon pernah hidup rukun, namun sejak tahun 2016 antara Pemohon dan Termohon sering terjadi perselisihan dan pertengkaran yang berulang, hingga terjadi pisah tempat tinggal; Bahwa dengan memperhatikan fakta hukum tersebut, Majelis Hakim berpendapat, antara Pemohon dan Termohon telah terjadi keretakan ikatan batin sebagai suami istri, akibat perselisihan yang berulang kali atau ketidakharmonisan yang berkelanjutan hingga terjadi pisah tempat tinggal, dan sulit diharapkan untuk kembali rukun karena keduanya sudah tidak saling mempedulikan, bahkan Pemohon sudah berketetapan hati untuk bercerai dengan Termohon;",
   "amar": "xxx: Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx ) di depan sidang Pengadilan Agama Donggala; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp174.000,00 (seratus tujuh puluh empat ribu rupiah)."
  },
  {
   "nomor": "7/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "xxx/Pdt.G/2025/PA.Dgl yang diterima Termohon tanggal xx xxxx yang dibacakan di persidangan, Termohon telah dipanggil secara resmi dan patut melalui surat tercatat, sedangkan tidak ternyata bahwa tidak datangnya Termohon tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu pemohonan tersebut diperiksa tanpa hadirnya Termohon dan diputus secara verstek; Menimbang, bahwa berdasarkan ketentuan Pasal 149 ayat (1) xxx, yaitu putusan yang dijatuhkan tanpa hadirnya Termohon dapat dikabulkan sepanjang berdasarkan hukum dan beralasan; Pada tahun 1998 terjadi pertengkaran yang terus-menerus karena Termohon berselingkuh dengan pria lain, puncaknya pada tahun 2000 Pemohon dan Termohon pisah tempat tinggal sehingga telah terjadi pisah tempat tinggal selama kurang lebih 25 tahun sampai sekarang, dan selama pisah antara Pemohon dan Termohon sudah tidak ada komunikasi apalagi menjalankan kewajiban sebagaimana layaknya suami-istri, dan sudah tidak saling memperdulikan, bahkan Termohon telah menikah dengan laki-laki lain;",
   "amar": "xxx G xxx I xxx I Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap di persidangan, tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Menetapkan sah pernikahan Pemohon dan Termohon yang dilangsungkan pada tahun 1996 di Kecamatan xxx, Kabupaten xxx; Memberikan izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx ) di depan sidang Pengadilan Agama Donggala setelah putusan ini berkekuatan hukum tetap; Membebankan kepada Pemoh"
  },
  {
   "nomor": "8/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa ternyata Termohon tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Termohon telah dipanggil secara resmi dan patut, sedangkan tidak ternyata bahwa tidak datangnya Termohon tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu permohonan tersebut diperiksa tanpa hadirnya Termohon dan diputus secara verstek; Menimbang, bahwa berdasarkan ketentuan Pasal 149 ayat (1) xxx, putusan yang dijatuhkan tanpa hadirnya Termohon dapat dikabulkan sepanjang berdasarkan hukum dan beralasan;",
   "amar": "xxx: Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx ) di depan sidang Pengadilan Agama Donggala; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp174.000,00 (seratus tujuh puluh empat ribu rupiah)."
  },
  {
   "nomor": "9/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa Pemohon telah dipanggil secara resmi dan patut ke hadapan sidang secara elektronik (e-court) melalui alamat domisili elektronik Pemohon berdasarkan ketentuan Pasal 16 dan 18 Peraturan Mahkamah Agung Nomor 1 Tahun 2019 tentang xxx Perkara dan Persidangan xxx sebagaimana perubahan Peraturan Mahkamah Agung Nomor 7 Tahun 2022 jo . Pasal 26 ayat (4) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan; Menimbang, bahwa ternyata Termohon tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Termohon telah dipanggil secara resmi dan patut melalui xxx surat tercatat, sedangkan tidak ternyata bahwa tidak datangnya Termohon tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu permohonan tersebut diperiksa tanpa hadirnya Termohon dan diputus secara verstek;",
   "amar": "xxx: Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx (xxx) ) di depan sidang Pengadilan Agama Donggala; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah)."
  },
  {
   "nomor": "10/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa ternyata Termohon tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Termohon telah dipanggil secara resmi dan patut, sedangkan tidak ternyata bahwa tidak datangnya Termohon tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu permohonan tersebut diperiksa tanpa hadirnya Termohon dan diputus secara verstek; Menimbang, bahwa berdasarkan ketentuan Pasal 149 ayat (1) xxx, putusan yang dijatuhkan tanpa hadirnya Termohon dapat dikabulkan sepanjang berdasarkan hukum dan beralasan;",
   "amar": "xxx: Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx ) di depan sidang Pengadilan Agama Donggala; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp174.000,00 (seratus tujuh puluh empat ribu rupiah);"
  },
  {
   "nomor": "11/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa Pemohon telah dipanggil secara resmi dan patut ke hadapan sidang secara elektronik (e-court) melalui alamat domisili elektronik Pemohon berdasarkan ketentuan Pasal 16 dan 18 Peraturan Mahkamah Agung Nomor 1 Tahun 2019 tentang xxx Perkara dan Persidangan xxx sebagaimana perubahan Peraturan Mahkamah Agung Nomor 7 Tahun 2022 jo . Pasal 26 ayat (4) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan; Menimbang, bahwa ternyata Termohon tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Termohon telah dipanggil secara resmi dan patut melalui xxx surat tercatat, sedangkan tidak ternyata bahwa tidak datangnya Termohon tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu permohonan tersebut diperiksa tanpa hadirnya Termohon dan diputus secara verstek;",
   "amar": "xxx: Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx ) di depan sidang Pengadilan Agama Donggala; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah)."
  },
  {
   "nomor": "12/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa Pemohon telah dipanggil secara resmi dan patut ke hadapan sidang secara elektronik (e-court) melalui alamat domisili elektronik Pemohon berdasarkan ketentuan Pasal 16 dan 18 Peraturan Mahkamah Agung Nomor 1 Tahun 2019 tentang xxx Perkara dan Persidangan xxx sebagaimana perubahan Peraturan Mahkamah Agung Nomor 7 Tahun 2022 jo . Pasal 26 ayat (4) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan; Menimbang, bahwa ternyata Termohon tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Termohon telah dipanggil secara resmi dan patut melalui xxx surat tercatat, sedangkan tidak ternyata bahwa tidak datangnya Termohon tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu permohonan tersebut diperiksa tanpa hadirnya Termohon dan diputus secara verstek;",
   "amar": "Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx ) di depan sidang Pengadilan Agama Donggala; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah)."
  },
  {
   "nomor": "13/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa Pemohon telah dipanggil secara resmi dan patut ke hadapan sidang secara elektronik (e-court) melalui alamat domisili elektronik Pemohon berdasarkan ketentuan Pasal 16 dan 18 Peraturan Mahkamah Agung Nomor 1 Tahun 2019 tentang xxx Perkara dan Persidangan xxx sebagaimana perubahan Peraturan Mahkamah Agung Nomor 7 Tahun 2022 jo . Pasal 26 ayat (4) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan; Menimbang, bahwa ternyata Termohon tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Termohon telah dipanggil secara resmi dan patut melalui xxx surat tercatat, sedangkan tidak ternyata bahwa tidak datangnya Termohon tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu permohonan tersebut diperiksa tanpa hadirnya Termohon dan diputus secara verstek;",
   "amar": "xxx: Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx ) di depan sidang Pengadilan Agama Donggala; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah)."
  },
  {
   "nomor": "14/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa ternyata Termohon tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Termohon telah dipanggil secara resmi dan patut, sedangkan tidak ternyata bahwa tidak datangnya Termohon tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu permohonan tersebut diperiksa tanpa hadirnya Termohon dan diputus secara verstek; Menimbang, bahwa berdasarkan ketentuan Pasal 149 ayat (1) xxx, putusan yang dijatuhkan tanpa hadirnya Termohon dapat dikabulkan sepanjang berdasarkan hukum dan beralasan;",
   "amar": "xxx: Menyatakan Termohon yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan permohonan Pemohon secara verstek; Memberi izin kepada Pemohon ( xxx ) untuk menjatuhkan talak satu raj'i terhadap Termohon ( xxx (xxx) ) di depan sidang Pengadilan Agama Donggala; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah)."
  },
  {
   "nomor": "15/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Bahwa dengan memperhatikan fakta hukum tersebut, Majelis Hakim berpendapat, antara Penggugat dan Tergugat telah terjadi keretakan ikatan batin sebagai suami istri, akibat perselisihan yang berulang kali atau ketidakharmonisan yang berkelanjutan hingga terjadi pisah tempat tinggal, dan sulit diharapkan untuk kembali rukun karena keduanya sudah tidak saling mempedulikan, bahkan Penggugat sudah berketetapan hati untuk bercerai dengan Tergugat; Bahwa rumah tangga seperti itu sudah tidak bisa diharapkan untuk merealisir tujuan perkawinan yaitu membentuk rumah tangga yang bahagia dan kekal, sesuai maksud Pasal 1 xxx Nomor 1 Tahun 1974 tentang Perkawinan, dan terwujudnya keluarga yang sakinah, mawaddah dan rahmah, sesuai maksud Pasal 3 Kompilasi Hukum Islam, bahkan dalam rumah tangga seperti itu, suami dan istri tentu sudah tidak dapat menjalankan hak dan kewajibannya masing-masing, yang mana untuk itulah rumah tangga diadakan;",
   "amar": "xxx: Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp174.000,00 (seratus tujuh puluh empat ribu rupiah)."
  },
  {
   "nomor": "16/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa ternyata Tergugat tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Tergugat telah dipanggil secara resmi dan patut, sedangkan tidak ternyata bahwa tidak datangnya Tergugat tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu gugatan tersebut diperiksa tanpa hadirnya Tergugat dan diputus secara verstek; Menimbang, bahwa berdasarkan ketentuan Pasal 149 ayat (1) xxx, putusan yang dijatuhkan tanpa hadirnya Tergugat dapat dikabulkan sepanjang berdasarkan hukum dan beralasan;",
   "amar": "xxx Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp159.500,00 (seratus lima puluh sembilan ribu lima ratus rupiah)."
  },
  {
   "nomor": "17/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa Penggugat telah dipanggil secara resmi dan patut ke hadapan sidang secara elektronik (e-court) melalui alamat domisili elektronik Penggugat berdasarkan ketentuan Pasal 16 dan 18 Peraturan Mahkamah Agung Nomor 1 Tahun 2019 tentang xxx Perkara dan Persidangan xxx sebagaimana perubahan Peraturan Mahkamah Agung Nomor 7 Tahun 2022 jo. Pasal 26 ayat (4) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan; Menimbang, bahwa ternyata Tergugat tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Tergugat telah dipanggil secara resmi dan patut, sedangkan tidak ternyata bahwa tidak datangnya Tergugat tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu gugatan tersebut diperiksa tanpa hadirnya Tergugat dan diputus secara verstek;",
   "amar": "xxx: Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp174.000,00 (seratus tujuh puluh empat ribu rupiah);"
  },
  {
   "nomor": "18/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Bahwa Penggugat dengan Tergugat pernah hidup rukun, namun sejak tahun 2018 antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran yang berulang-ulang, hingga terjadi pisah tempat tinggal; Bahwa dengan memperhatikan fakta hukum tersebut, Majelis Hakim berpendapat, antara Penggugat dan Tergugat telah terjadi keretakan ikatan batin sebagai suami istri, akibat perselisihan yang berulang kali atau ketidakharmonisan yang berkelanjutan hingga terjadi pisah tempat tinggal, dan sulit diharapkan untuk kembali rukun karena keduanya sudah tidak saling mempedulikan, bahkan Penggugat sudah berketetapan hati untuk bercerai dengan Tergugat;",
   "amar": "xxx: Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Menetapkan Penggugat sebagai pemegang hak asuh atas anak Penggugat dan Tergugat yang bernama xxx usia 6 tahun dan xxx usia 5 tahun dengan tetap memberikan hak akses kepada Tergugat untuk mengunjungi anak tersebut; Memerintahkan kepada Tergugat untuk menyerahkan anak t"
  },
  {
   "nomor": "19/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa ternyata Tergugat tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Tergugat telah dipanggil secara resmi dan patut, sedangkan tidak ternyata bahwa tidak datangnya Tergugat tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu gugatan tersebut diperiksa tanpa hadirnya Tergugat dan diputus secara verstek; Menimbang, bahwa berdasarkan ketentuan Pasal 149 ayat (1) xxx, putusan yang dijatuhkan tanpa hadirnya Tergugat dapat dikabulkan sepanjang berdasarkan hukum dan beralasan;",
   "amar": "xxx: Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp180.500,00 (seratus delapan puluh ribu lima ratus rupiah)."
  },
  {
   "nomor": "20/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa ternyata Tergugat tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Tergugat telah dipanggil secara resmi dan patut, sedangkan tidak ternyata bahwa tidak datangnya Tergugat tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu gugatan tersebut diperiksa tanpa hadirnya Tergugat dan diputus secara verstek; Menimbang, bahwa berdasarkan ketentuan Pasal 149 ayat (1) xxx, putusan yang dijatuhkan tanpa hadirnya Tergugat dapat dikabulkan sepanjang berdasarkan hukum dan beralasan;",
   "amar": "xxx: Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp204.000,00 (dua ratus empat ribu rupiah)."
  },
  {
   "nomor": "21/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa Penggugat telah dipanggil secara resmi dan patut ke hadapan sidang secara elektronik (e-court) melalui alamat domisili elektronik Penggugat berdasarkan ketentuan Pasal 16 dan 18 Peraturan Mahkamah Agung Nomor 1 Tahun 2019 tentang xxx Perkara dan Persidangan xxx sebagaimana perubahan Peraturan Mahkamah Agung Nomor 7 Tahun 2022 jo. Pasal 26 ayat (4) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan; Menimbang, bahwa ternyata Tergugat tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Tergugat telah dipanggil secara resmi dan patut, sedangkan tidak ternyata bahwa tidak datangnya Tergugat tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu gugatan tersebut diperiksa tanpa hadirnya Tergugat dan diputus secara verstek;",
   "amar": "Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) kepada Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara yang hingga kini sejumlah Rp 204.000,00 ( dua ratus empat ribu rupiah );"
  },
  {
   "nomor": "22/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": true,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa ternyata Tergugat tidak datang menghadap di persidangan dan tidak pula menyuruh orang lain untuk menghadap sebagai wakil/kuasanya yang sah, meskipun berdasarkan surat panggilan (relaas) Nomor xxx/Pdt.G/2025/PA.Dgl tanggal xx xxxx dan tanggal xx xxxx yang dibacakan di persidangan, Tergugat telah dipanggil secara resmi dan patut, sedangkan tidak ternyata bahwa tidak datangnya Tergugat tersebut disebabkan oleh suatu alasan yang sah, oleh karena itu gugatan tersebut diperiksa tanpa hadirnya Tergugat dan diputus secara verstek; Menimbang, bahwa berdasarkan ketentuan Pasal 149 ayat (1) xxx, putusan yang dijatuhkan tanpa hadirnya Tergugat dapat dikabulkan sepanjang berdasarkan hukum dan beralasan;",
   "amar": "xxx: Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap sidang tidak hadir; Mengabulkan gugatan Penggugat secara verstek; Menjatuhkan talak satu ba'in sughra Tergugat ( xxx ) terhadap Penggugat ( xxx ); Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp173.500,00 (seratus tujuh puluh tiga ribu lima ratus rupiah)."
  },
  {
   "nomor": "23/Pdt.P/2025/PA.Dgl",
   "jenis": "Dispensasi Kawin",
   "cerai": false,
   "dispen": true,
   "pertimbangan": "Menimbang, bahwa perkara ini disidangkan oleh Hakim xxx sesuai Penetapan Hakim xxx tanggal xx xxxx berdasarkan ketentuan Pasal 1 ayat (11) Peraturan Mahkamah Agung Republik Indonesia Tahun 2019 Tentang xxx Mengadili Permohonan xxx; Menimbang, bahwa permohonan dispensasi kawin para Pemohon didasarkan atas dalil-dalil yang pada pokoknya bahwa para Pemohon hendak menikahkan masing-masing anak kandung mereka yang sebagai calon suami bernama xxx, umur 17 tahun dengan yang sebagai calon isteri bernama xxx, umur 18 tahun, karena anak Pemohon II telah hamil 5 bulan dan sangat mendesak untuk segera dinikahkan karena dikhawatirkan terjadi atau terjadi lebih jauh perbuatan yang dilarang oleh ketentuan Hukum Islam, dan keluarga kedua belah pihak telah merestui rencana pernikahan tersebut serta tidak ada pihak lain yang keberatan atas rencana pernikahan tersebut, namun pada saat para Pemohon mendaftarkan pernikahan tersebut, Pegawai Pencatat Nikah KUA Kecamatan xxx menolak dengan alasan anak-anak para Pemohon tersebut masih belum cukup umur;",
   "amar": "xxx P xxx Mengabulkan permohonan Para Pemohon; Memberikan dispensasi kepada anak-anak Para Pemohon, yang calon suami bernama xxx dan yang calon isteri bernama xxx S. xxx , untuk menikah satu sama lain; Membebankan kepada Para Pemohon untuk membayar biaya perkara ini sejumlah 145.000,00 (seratus empat puluh lima ribu rupiah);"
  },
  {
   "nomor": "24/Pdt.P/2025/PA.Dgl",
   "jenis": "Dispensasi Kawin",
   "cerai": false,
   "dispen": true,
   "pertimbangan": "Menimbang, bahwa perkara ini disidangkan oleh Hakim xxx sesuai Penetapan Hakim xxx tanggal xx xxxx berdasarkan ketentuan Pasal 1 ayat (11) Peraturan Mahkamah Agung Republik Indonesia Tahun 2019 Tentang xxx Mengadili Permohonan xxx;",
   "amar": "xxx P xxx Mengabulkan permohonan Para Pemohon; Memberikan dispensasi kepada anak-anak Para Pemohon, yang calon suami bernama xxx dan yang calon isteri bernama xxx , untuk menikah satu sama lain; Membebankan kepada Para Pemohon untuk membayar biaya perkara ini sejumlah 165.000,00 (seratus enam puluh lima ribu rupiah)."
  },
  {
   "nomor": "25/Pdt.P/2025/PA.Dgl",
   "jenis": "Dispensasi Kawin",
   "cerai": false,
   "dispen": true,
   "pertimbangan": "Menimbang, bahwa perkara ini disidangkan oleh Hakim xxx sesuai Penetapan Hakim xxx tanggal xx xxxx berdasarkan ketentuan Pasal 1 ayat (11) Peraturan Mahkamah Agung Republik Indonesia Tahun 2019 Tentang xxx Mengadili Permohonan xxx; berhentinya pendidikan bagi anak setelah menikah, tidak berlanjutnya anak dalam menempuh wajib belajar 12 tahun, belum siapnya organ reproduksi anak, kemungkinan adanya dampak ekonomi, sosial dan psikologis bagi anak, serta potensi terjadinya perselisihan dan kekerasan dalam rumah tangga;",
   "amar": "xxx P xxx Mengabulkan permohonan Para Pemohon; Memberikan dispensasi kepada anak Para Pemohon bernama xxx untuk menikah dengan seorang laki-laki bernama xxx ; Membebankan kepada Para Pemohon untuk membayar biaya perkara ini sejumlah 145.000,00 (seratus empat puluh lima ribu rupiah);"
  },
  {
   "nomor": "26/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Talak",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa Pemohon telah dipanggil secara resmi dan patut ke hadapan sidang secara elektronik (e-court) melalui alamat domisili elektronik Pemohon berdasarkan ketentuan Pasal 16 dan 18 Peraturan Mahkamah Agung Nomor 1 Tahun 2019 tentang xxx Perkara dan Persidangan xxx sebagaimana perubahan Peraturan Mahkamah Agung Nomor 7 Tahun 2022 jo . Pasal 26 ayat (4) Peraturan Pemerintah Nomor 9 Tahun 1975 tentang xxx Nomor 1 Tahun 1974 tentang Perkawinan; Menimbang, bahwa atas pencabutan perkara tersebut Majelis Hakim mengabulkan; Menimbang, bahwa perkara ini adalah termasuk bidang perkawinan, maka berdasarkan Pasal 89 ayat (1) xxx Nomor 7 Tahun 1989 tentang xxx Agama yang telah diubah dengan xxx Nomor 3 Tahun 2006 dan perubahan kedua dengan xxx Nomor 50 Tahun 2009, maka biaya perkara ini dibebankan kepada Pemohon;",
   "amar": "xxx: Mengabulkan permohonan pencabutan perkara Nomor xxx/Pdt.G/2025/PA.Dgl dari Pemohon; Memerintahkan Panitera Pengadilan Agama Donggala untuk mencatat pencabutan perkara tersebut dalam register perkara; Membebankan kepada Pemohon untuk membayar biaya perkara ini sejumlah Rp174.500,00 (seratus tujuh puluh empat ribu lima ratus rupiah);"
  },
  {
   "nomor": "27/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa pencabutan perkara merupakan hak dari Penggugat apalagi Tergugat belum memberikan jawaban, sehingga berdasarkan Pasal 271 dan Pasal 272 xxx pencabutan tersebut tidak diperlukan adanya persetujuan dari Tergugat; Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, maka pencabutan gugatan Penggugat dalam perkara a quo dapat dikabulkan; Menimbang, bahwa perkara ini adalah termasuk bidang perkawinan, maka berdasarkan Pasal 89 ayat (1) xxx Nomor 7 Tahun 1989 tentang xxx Agama yang telah diubah dengan xxx Nomor 3 Tahun 2006 dan perubahan kedua dengan xxx Nomor 50 Tahun 2009, maka biaya perkara ini dibebankan kepada Penggugat; Mengingat, peraturan perundang-undangan yang berlaku dan hukum xxx yang berkaitan dengan perkara ini;",
   "amar": "Mengabulkan permohonan Penggugat untuk mencabut perkaranya; Menyatakan perkara Nomor xxx/Pdt.G/2025/PA.Dgl dicabut; Membebankan kepada Penggugat untuk membayar biaya perkara yang hingga kini sejumlah Rp 221500,00 ( dua ratus dua puluh satu ribu lima ratus )."
  },
  {
   "nomor": "28/Pdt.G/2025/PA.Dgl",
   "jenis": "Kewarisan",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "Dengan demikian Majelis Hakim berpendapat, bahwa upaya damai sebagaimana dimaksud pasal 154 ayat (1) xxx dan pasal 4 ayat (1) Peraturan Mahkamah Agung Republik Indonesia Nomor 1 Tahun 2016 tentang xxx Mediasi di Pengadilan patut dinyatakan tidak berhasil; Menimbang, bahwa gugatan ini diajukan secara elektronik melalui aplikasi e-xxx Pengadilan Agama Donggala dan persidangan untuk perkara ini dilaksanakan secara e-litigasi menurut xxx Nomor 1 tahun 2019 Tentang xxx Perkara dan Persidangan di Pengadilan xxx Surat xxx Ketua Mahkamah Agung Republik Indonesia, Nomor 129/xxx/xxx/xxx/2019 Tentang xxx Perkara dan Persidangan di Pengadilan xxx, yang telah diubah dengan xxx Nomor 7 tahun 2022 Tentang xxx Perkara dan Persidangan di Pengadilan xxx dan Surat xxx Ketua Mahkamah Agung Republik Indonesia Nomor 363/xxx/xxx/xxx/2022 Tentang xxx dan Persidangan Perkara xxx Agama, dan xxx Negara di Pengadilan xxx.",
   "amar": "xxx: Menolak eksepsi Tergugat tentang kewenangan absolut; xxx eksepsi Tergugat tentang gugatan Penggugat kabur atau obscuur libel ; Menyatakan gugatan Penggugat kabur atau obscuur libel ; xxx: Dalam Konvensi: Menyatakan gugatan Penggugat tidak dapat diterima atau xxx ; Dalam Rekonvensi Menyatakan gugatan Penggugat Rekonvensi tidak dapat diterima atau xxx ; Dalam Konvensi dan Rekonvensi Membebankan kepada Penggugat Konvensi/Tergugat Rekonvensi untuk membayar biaya perkara sebesar Rp169.000,- (ser"
  },
  {
   "nomor": "29/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa pencabutan perkara gugatan adalah merupakan hak Penggugat; Menimbang, bahwa oleh karena perkara gugatan ini dicabut oleh Penggugat melalui kuasanya maka proses perkara ini berakhir; Menimbang, bahwa karena proses perkara ini telah berakhir sebelum penetapan akhir maka pencabutan gugatan ini harus dicatat dalam register yang berlaku untuk itu; Menimbang, bahwa perkara ini adalah termasuk bidang perkawinan, maka berdasarkan Pasal 89 ayat (1) xxx Nomor 7 Tahun 1989 tentang xxx Agama yang telah diubah dengan xxx Nomor 3 Tahun 2006 dan perubahan kedua dengan xxx Nomor 50 Tahun 2009, maka biaya perkara ini dibebankan kepada Pemohon/; Mengingat pasal 271 xxx, pasal 272 xxx serta peraturan perundangundangan yang bersangkutan dengan perkara ini;",
   "amar": "xxx: Mengabulkan permohonan pencabutan perkara Nomor xxx/Pdt.G/2025/PA.Dgl dari Penggugat; Memerintahkan Panitera Pengadilan Agama Donggala untuk mencatat pencabutan perkara tersebut dalam register perkara; Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp184.500,00 (seratus delapan puluh empat ribu lima ratus rupiah)."
  },
  {
   "nomor": "30/Pdt.G/2025/PA.Dgl",
   "jenis": "Cerai Gugat",
   "cerai": false,
   "dispen": false,
   "pertimbangan": "Menimbang, bahwa pencabutan perkara gugatan adalah merupakan hak Penggugat; Menimbang, bahwa oleh karena perkara gugatan ini dicabut oleh Penggugat maka proses perkara ini berakhir; Menimbang, bahwa karena proses perkara ini telah berakhir sebelum penetapan akhir maka pencabutan gugatan ini harus dicatat dalam register yang berlaku untuk itu; Menimbang, bahwa perkara ini adalah termasuk bidang perkawinan, maka berdasarkan Pasal 89 ayat (1) xxx Nomor 7 Tahun 1989 tentang xxx Agama yang telah diubah dengan xxx Nomor 3 Tahun 2006 dan perubahan kedua dengan xxx Nomor 50 Tahun 2009, maka biaya perkara ini dibebankan kepada Pemohon/; Mengingat pasal 271 xxx, pasal 272 xxx serta peraturan perundangundangan yang bersangkutan dengan perkara ini;",
   "amar": "xxx: Mengabulkan permohonan pencabutan perkara Nomor xxx/Pdt.G/2025/PA.Dgl dari Penggugat; Memerintahkan Panitera Pengadilan Agama Donggala untuk mencatat pencabutan perkara tersebut dalam register perkara; Membebankan kepada Penggugat untuk membayar biaya perkara ini sejumlah Rp184.500,00 (seratus delapan puluh empat ribu lima ratus rupiah)."
  }
 ],
 "umum": [
  {
   "nomor": "31/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 3,
   "posita": "Bahwa Pemohon telah melangsungkan pernikahan menurut agama Islam pada hari sabtu tanggal xx xxxx dengan seorang laki-laki yang bernama xxx di Desa xxx wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah; Bahwa pada saat pernikahan tersebut xxx berstatus xxx dalam usia 23 tahun, dan Pemohon berstatus Perawan dalam usia 25 tahun, pernikahan dilangsungkan dengan wali nikah yang bernama xxx ( ayah kandung Pemohon II ), dan yang menikahkan adalah xxx (Imam Desa xxx) dan dihadiri 2 (dua) orang saksi nikah yang bernama xxx dan xxx dengan mas kawin berupa uang sebesar Rp.11.000 (xxx Rupiah), dibayar tunai; Bahwa antara xxx dan Pemohon tidak ada pertalian nasab, pertalian kerabat dan pertalian sesusuan serta memenuhi syarat dan tidak ada larangan untuk melangsungkan pernikahan, baik menurut ketentuan Hukum Islam maupun peraturan perundang-undangan yang berlaku ; Bahwa setelah menikah xxx dan Pemohon tinggal di rumah rumah bersama di Desa xxx; Bahwa selama pernikahan tersebut xxx dan Pemohon telah hidup rukun sebagaimana layaknya suami istri dan telah ",
   "petitum": "xxx Mengabulkan permohonan Pemohon untuk seluruhnya ; Menetapkan sah pernikahan xxx Pemohon ( xxx ) dengan Pemohon ( xxx ) yang dilangsungkan pada hari sabtu xx xxxx di Desa xxx wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah dan untuk pengurusan xxx atas nama xxx ; Membebankan biaya perkara menurut hukum yang berlaku; xxx Pengadilan Agama Donggala cq. Majelis Hakim berpendapat lain mohon putusan yang seadil-adilnya;"
  },
  {
   "nomor": "32/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 3,
   "posita": "Bahwa Pemohon telah melangsungkan pernikahan menurut agama Islam pada xxx Jumat, tanggal xx xxxx dengan seorang laki-laki yang xxx di Desa xxx wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah; Bahwa pada saat pernikahan tersebut yang xxx berstatus xxx dalam usia 22 tahun, dan Pemohon berstatus Perawan dalam usia 20 tahun, pernikahan dilangsungkan dengan wali nikah yang bernama xxx (yang mana pada saat itu diwakilkan oleh xxx Pemohon dikarenakan xxx Pemohon telah meninggal dunia), dan yang menikahkan adalah xxx (Imam Desa xxx), dan dihadiri 2 (dua) orang saksi nikah yang bernama xxx dan xxx dengan mas kawin berupa Seperangkat alat sholat dibayar tunai; Bahwa antara yang xxx dan Pemohon tidak ada pertalian nasab, pertalian kerabat dan pertalian sesusuan serta memenuhi syarat dan tidak ada larangan untuk melangsungkan pernikahan, baik menurut ketentuan Hukum Islam maupun peraturan perundang-undangan yang berlaku ; Bahwa setelah menikah yang xxx dan Pemohon tinggal di rumah rumah bersama di Desa xxx; Bahwa selama pernikahan tersebut yang xxx dan Pe",
   "petitum": "xxx Mengabulkan permohonan Pemohon untuk seluruhnya ; Menetapkan sah pernikahan xxx Pemohon ( xxx ) dengan Pemohon ( xxx ) yang dilangsungkan di Desa xxx pada hari Sabtu tanggal xx xxxx di wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah dan untuk pengurusan xxx atas nama xxx ; Membebankan biaya perkara menurut hukum yang berlaku; xxx Pengadilan Agama Donggala cq. Majelis Hakim berpendapat lain mohon putusan yang seadil-adilnya;"
  },
  {
   "nomor": "33/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 3,
   "posita": "Bahwa pada hari Rabu, xxx xx xxxx, Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam di Desa xxx wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah; Bahwa pada saat pernikahan tersebut Pemohon II berstatus xxx dalam usia 18 tahun, dan Pemohon I berstatus Perawan dalam usia 17 tahun, Pernikahan dilangsungkan dengan wali nikah xxx (xxx kandung Pemohon I) dan yang menikahkan adalah xxx (Imam Desa xxx), dan dihadiri saksi nikah bernama xxx dan xxx, dengan mas kawin berupa uang tunai senilai Rp.110.000 (xxx Sepuluh ribu rupiah) dibayar tunai ; Bahwa antara Pemohon I dan Pemohon II tidak ada pertalian nasab, pertalian kerabat dan pertalian sesusuan serta memenuhi syarat dan tidak ada larangan untuk melangsungkan pernikahan, baik menurut ketentuan Hukum Islam maupun peraturan perundang-undangan yang berlaku; Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun sebagaimana layaknya suami istri, dan telah dikaruniai 2 (Dua) orang anak yang masing-masing bernama : xxx, umur 17 tahun ; xxx, umur 10 tahun ; Bahwa selama pernikaha",
   "petitum": "xxx : Mengabulkan permohonan Pemohon I dan Pemohon II; Menetapkan sah pernikahan Pemohon I dengan Pemohon II yang dilangsungkan pada hari Rabu, xxx xx xxxx di Desa xxx wilayah Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah; Membebankan biaya perkara menurut hukum; xxx Pengadilan Agama Donggala cq. Majelis Hakim berpendapat lain, mohon penetapan yang seadil-adilnya."
  },
  {
   "nomor": "34/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 3,
   "posita": "Bahwa pada tanggal xx xxxx, Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam, bertempat di Desa xxx di wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah; Bahwa pada saat pernikahan tersebut Pemohon I berstatus xxx dalam usia 29 tahun, dan Pemohon II berstatus Perawan dalam usia 11 tahun, Pernikahan dilangsungkan dengan wali nikah yaitu xxx (xxx kandung Pemohon II) dan yang menikahkan adalah xxx (Imam Desa xxx), dan dihadiri saksi nikah bernama xxx dan xxx, dengan mas kawin berupa uang tunai senilai Rp.110.000 (xxx Sepuluh ribu rupiah) dibayar tunai ; Bahwa antara Pemohon I dan Pemohon II tidak ada pertalian nasab, pertalian kerabat dan pertalian sesusuan serta memenuhi syarat dan tidak ada larangan untuk melangsungkan pernikahan, baik menurut ketentuan Hukum Islam maupun peraturan perundang-undangan yang berlaku; Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun sebagaimana layaknya suami istri, dan telah dikaruniai 4 (empat) orang anak yang masing-masing bernama : xxx, umur 20 tahun ; xxx, umur 17 tahun ; xxx, u",
   "petitum": "xxx : Mengabulkan permohonan Pemohon I dan Pemohon II; Menetapkan sah pernikahan Pemohon I dengan Pemohon II yang dilangsungkan di Desa xxx pada tanggal xx xxxx di wilayah Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah; Membebankan biaya perkara menurut hukum; xxx Pengadilan Agama Donggala cq. Majelis Hakim berpendapat lain, mohon penetapan yang seadil-adilnya."
  },
  {
   "nomor": "35/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 3,
   "posita": "Bahwa pada xxx Minggu tanggal xx xxxx, Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam, bertempat di Desa xxx di wilayah hukum Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah; Bahwa pada saat pernikahan tersebut Pemohon I berstatus xxx dalam usia 25 tahun, dan Pemohon II berstatus Perawan dalam usia 21 tahun, Pernikahan dilangsungkan dengan wali nikah yaitu xxx ( xxx kandung Pemohon II ) dan yang menikahkan adalah xxx (Imam Desa xxx), dan dihadiri saksi nikah bernama xxx dan xxx, dengan mas kawin berupa uang tunai senilai Rp.110.000 (xxx Sepuluh ribu rupiah) dibayar tunai ; Bahwa antara Pemohon I dan Pemohon II tidak ada pertalian nasab, pertalian kerabat dan pertalian sesusuan serta memenuhi syarat dan tidak ada larangan untuk melangsungkan pernikahan, baik menurut ketentuan Hukum Islam maupun peraturan perundang-undangan yang berlaku; Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun sebagaimana layaknya suami istri, dan telah dikaruniai 3 (tiga) orang anak yang masing-masing bernama : xxx. R. xxx. A. xxx, umur 10 ta",
   "petitum": "xxx : Mengabulkan permohonan Pemohon I dan Pemohon II; Menetapkan sah pernikahan Pemohon I dengan Pemohon II yang dilangsungkan di Desa xxx pada xxx Minggu tanggal xx xxxx di wilayah Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, Provinsi Sulawesi Tengah; Membebankan biaya perkara menurut hukum; xxx Pengadilan Agama Donggala cq. Majelis Hakim berpendapat lain, mohon penetapan yang seadil-adilnya."
  },
  {
   "nomor": "36/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 4,
   "posita": "Bahwa Pemohon I dan xxx telah menikah pada tanggal xx xxxx, Namun telah bercerai pada tahun 2022 sesuai dengan xxx Akta Cerai yang dikeluarkan oleh Pengadilan Agama Donggala yaitu : xxx, dan pernikahan tersebut telah dikaruniai 2 (dua) orang anak yang masing-masing bernama : xxx, umur 18 tahun; xxx, umur 15 tahun; xxx, umur 13 tahun; xxx, umur 12 tahun; xxx, umur 9 tahun; Bahwa Pemohon II dan xxx telah menikah pada tahun 2004 telah menikah dibawah tangan di Kecamatan xxx Kabupaten xxx namun saat ini Pemohon I dan xxx telah berpisah, dan pernikahan tersebut telah dikaruniai 4 (empat) orang anak yang masing-masing bernama : xxx S. xxx, 18 Tahun; xxx S. xxx, 17 Tahun; xxx S. xxx, 14 Tahun; xxx S. xxx, 13 Tahun; Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama xxx dengan xxx S. xxx ; Bahwa syarat Perkawinan anak para Pemohon bernama xxx dan xxx S. xxx belum terpenuhi persyaratan umurnya untuk persyaratan melangsungkan perkawinan, sampai saat ini masih berumur 18 dan 17 tahun ; Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan A",
   "petitum": "xxx Mengabulkan permohonan para Pemohon ; 2. Menetapkan memberi xxx kepada anak para Pemohon yang bernama xxx dengan xxx S. xxx untuk melangsungkan perkawinan ; 3. Membebankan biaya perkara menurut hukum yang berlaku xxx Pengadilan Agama Donggala berpendapat lain, mohon penetapan yang seadil-adilnya."
  },
  {
   "nomor": "37/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 4,
   "posita": "Bahwa Pemohon I dan Pemohon II telah menikah pada tanggal xx xxxx, di kecamatan xxx tertanggal xx xxxx, dan pernikahan tersebut telah dikaruniai 2 (dua) orang anak yang masing-masing bernama : xxx, umur 17 tahun; xxx, umur 6 tahun; Bahwa Pemohon III dan Pemohon IV telah menikah pada tanggal xx xxxx, di kecamatan xxx tertanggal xx xxxx, dan pernikahan tersebut telah dikaruniai 11 (xxx) orang anak yang masing-masing bernama : xxx, umur 7 bulan; xxx, umur 1 Tahun; xxx, umur 22 Tahun; xxx, umur 20 Tahun; xxx, umur 19 Tahun; xxx, umur 17 Tahun; xxx, umur 16 tahun; xxx, umur 14 tahun; xxx, umur 12 tahun; xxx, umur 9 tahun; Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama xxx dengan xxx ; Bahwa syarat Perkawinan anak para Pemohon bernama xxx dan xxx belum terpenuhi persyaratan umurnya untuk persyaratan melangsungkan perkawinan, sampai saat ini masih berumur 17 tahun ; Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak deng",
   "petitum": "xxx Mengabulkan permohonan para Pemohon ; 2. Menetapkan memberi xxx kepada anak para Pemohon yang bernama xxx dengan xxx untuk melangsungkan perkawinan ; 3. Membebankan biaya perkara menurut hukum yang berlaku xxx Pengadilan Agama Donggala berpendapat lain, mohon penetapan yang seadil-adilnya."
  },
  {
   "nomor": "38/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 4,
   "posita": "Bahwa para Pemohon I dan Pemohon II telah menikah pada tanggal xx xxxx yang tercatat dalam Kutipan Akta Nikah Nomor : 500/66/xxx/91, di Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi xxx, dan pernikahan tersebut telah dikaruniai 3 (tiga) orang anak yang masing-masing bernama : xxx 29 tahun; xxx 27 tahun; xxx, umur 17 tahun ; Bahwa para Pemohon berencana akan menikahkan anak para Pemohon yang bernama xxx (calon mempelai wanita) dengan seorang laki-laki yang bernama xxx (calon mempelai laki-laki); Bahwa syarat Perkawinan anak para Pemohon belum terpenuhi persyaratan umurnya ; Bahwa anak para Pemohon yang bernama xxx masih di bawah umur untuk persyaratan melangsungkan perkawinan yang sampai saat ini masih berusia 17 tahun; Bahwa para Pemohon telah datang dan melapor ke Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan xxx, Kabupaten Donggala, guna mencatatkan pernikahan anak para Pemohon tersebut, namun ditolak dengan alasan belum cukup umur sesuai dengan surat xxx Nomor : B.042/KUA.22.02.08/xxx.01/3/2025 ; Bahwa anak para Pemohon yang bernama xxx dengan seorang laki-laki",
   "petitum": "xxx Mengabulkan permohonan para Pemohon ; 2. Memberikan xxx kepada anak para Pemohon, yang calon istri bernama xxx untuk melangsungkan perkawinan dengan calon suami anak para Pemohon yang bernama xxx 3. Membebankan biaya perkara menurut hukum yang berlaku. xxx Pengadilan Agama Donggala berpendapat lain, mohon penetapan yang seadil-adilnya."
  },
  {
   "nomor": "39/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 1,
   "posita": "Bahwa pada tanggal xx xxxx, Pemohon dengan Termohon telah melangsungkan pernikahan, yang dicatat oleh Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah. xxx sesuai dengan xxx Kutipan Akta Nikah Nomor : xxx.1/10/xxx.01/100/2001 yang dikeluarkan tertanggal xx xxxx Bahwa perkawinan antara Pemohon dan Termohon dilangsungkan berdasarkan kehendak kedua belah pihak dengan tujuan membentuk rumah tangga yang sakinah, mawaddah, warahmah yang diridhoi oleh Allah xxx. Bahwa selama pernikahan tersebut Pemohon dengan Termohon telah hidup sebagaimana layaknya suami istri dan telah dikaruniai 4 (empat) orang anak yang masing-masing bernama: xxx, umur 31 tahun ; xxx, umur 25 tahun ; xxx umur 18 tahun ; xxx, umur 13 tahun Bahwa Pemohon hendak menikah lagi dengan seorang perempuan bernama :, xxx , umur 40 tahun, agama Islam, pendidikan terakhir xxx, pekerjaan xxx Rumah Tangga, Status Janda dibuktikan dengan Nomor Akta Cerai : xxx, tempat tinggal di xxx002, xxx001, xxx, Kecamatan xxx, Kabupaten xxx, Provinsi Sulawesi Tengah. Selanjutnya disebut sebagai xxx",
   "petitum": "xxx Mengabulkan permohonan Pemohon untuk seluruhnya. Menetapkan, memberi izin kepada Pemohon ( xxx ) untuk menikah lagi (poligami) dengan calon isteri kedua Pemohon bernama (xxx). Menetapkan harta sebagaimana terurai dalam posita nomor 9 di atas adalah harta bersama Pemohon dan Termohon ; Membebankan biaya perkara menurut hukum yang berlaku. xxx Pengadilan Agama Donggala berpendapat lain, mohon putusan yang seadil-adilnya;"
  },
  {
   "nomor": "40/Pdt.P/2025/PA.Dgl",
   "jenisAlasan": 5,
   "posita": "1. Bahwa pada tanggal xx xxxx Pemohon I dan Pemohon II melangsungkan pernikahan menurut agama Islam di wilayah hukum Kantor Urusan Agama Kecamatan xxx Kabupaten xxx Provinsi Sulawesi Tengah; 2. Bahwa pada saat pernikahan tersebut Pemohon I berstatus xxx dalam usia 24 tahun, dan Pemohon II berstatus Perawan dalam usia 15 tahun, Pernikahan dilangsungkan dengan wali nikah xxx kandung Pemohon II yang bernama xxx dan yang menikahkan imam mesjid xxx ikhlas Desa xxx yang bernama xxx dan dihadiri 2 (dua) orang saksi nikah bernama xxx dan xxx, dengan mas kawin berupa seperangkat alat sholat dan 5 gram emas dibayar tunai; 3. Bahwa antara Pemohon I dan Pemohon II tidak ada pertalian nasab, pertalian kerabat dan pertalian sesusuan serta memenuhi syarat dan tidak ada larangan untuk melangsungkan pernikahan, baik menurut ketentuan Hukum Islam maupun peraturan perundang-undangan yang berlaku. 4. Bahwa setelah pernikahan Pemohon I dan Pemohon II hidup rukun sebagaimana layaknya suami istri dan telah dikaruniai seorang anak yang xxx yang lahir di Kota xxx, pada hari Senin, tanggal xx xxxx, xxx 15.20 ",
   "petitum": "xxx : 1. Mengabulkan permohonan Pemohon I dan Pemohon II; 2. Menetapkan anak yang benama xxx umur 2 tahun xxx anak dari Pemohon I dan Pemohon II; 3. Menetapkan biaya perkara menurut hukum yang berlaku; xxx Pengadilan Agama Donggala cq. Majelis Hakim berpendapat lain, mohon penetapan yang seadil-adilnya."
  }
 ],
 "rujukan": {
  "status": [
   {
    "id": 62,
    "nama": "Dikabulkan"
   },
   {
    "id": 92,
    "nama": "Dismissal"
   },
   {
    "id": 63,
    "nama": "Ditolak"
   },
   {
    "id": 93,
    "nama": "Gugur"
   },
   {
    "id": 64,
    "nama": "Tidak Dapat Diterima"
   },
   {
    "id": 65,
    "nama": "Digugurkan"
   },
   {
    "id": 66,
    "nama": "Dicoret dari Register"
   },
   {
    "id": 67,
    "nama": "Dicabut"
   },
   {
    "id": 85,
    "nama": "Perdamaian"
   }
  ],
  "sumber": [
   {
    "id": 10,
    "nama": "Fiqh Islam"
   },
   {
    "id": 9,
    "nama": "Kompilasi Hukum Ekonomi Syariah"
   },
   {
    "id": 8,
    "nama": "Kompilasi Hukum Islam"
   },
   {
    "id": 13,
    "nama": "Qanun Aceh"
   },
   {
    "id": 11,
    "nama": "UU/PP"
   },
   {
    "id": 16,
    "nama": "Yurisprudensi"
   }
  ],
  "faktor": [
   {
    "id": 8,
    "nama": "Cacat Badan"
   },
   {
    "id": 6,
    "nama": "Dihukum Penjara"
   },
   {
    "id": 12,
    "nama": "Ekonomi"
   },
   {
    "id": 4,
    "nama": "Judi"
   },
   {
    "id": 10,
    "nama": "Kawin Paksa"
   },
   {
    "id": 7,
    "nama": "Kekerasan Dalam Rumah Tangga"
   },
   {
    "id": 2,
    "nama": "Mabuk"
   },
   {
    "id": 3,
    "nama": "Madat"
   },
   {
    "id": 5,
    "nama": "Meninggalkan Salah Satu Pihak"
   },
   {
    "id": 11,
    "nama": "Murtad"
   },
   {
    "id": 9,
    "nama": "Peselisihan dan Pertengkaran Terus Menerus"
   },
   {
    "id": 13,
    "nama": "Poligami"
   },
   {
    "id": 1,
    "nama": "Zina"
   }
  ],
  "dispen": [
   {
    "id": 1,
    "nama": "Hamil"
   },
   {
    "id": 2,
    "nama": "Pergaulan Bebas/Hubungan Intim"
   },
   {
    "id": 3,
    "nama": "Ekonomi"
   },
   {
    "id": 4,
    "nama": "Budaya/Adat/Perjodohan"
   },
   {
    "id": 5,
    "nama": "Menghindari Zina/Hubungan Cinta"
   }
  ],
  "isbat": [
   {
    "id": 1,
    "nama": "Perceraian"
   },
   {
    "id": 2,
    "nama": "Nikah dibawah tangan"
   },
   {
    "id": 3,
    "nama": "Akta nikah hilang"
   },
   {
    "id": 4,
    "nama": "Kelengkapan administrasi"
   }
  ],
  "poligami": [
   {
    "id": 1,
    "nama": "Istri tidak dapat menjalankan kewajiban"
   },
   {
    "id": 2,
    "nama": "Cacat badan atau penyakit yang tidak dapat disembuhkan"
   },
   {
    "id": 3,
    "nama": "Istri tidak dapat melahirkan keturunan"
   }
  ],
  "asalusul": [
   {
    "id": 1,
    "nama": "Kepastian hukum / kelengkapan administrasi"
   },
   {
    "id": 2,
    "nama": "Pengingkaran anak"
   }
  ],
  "kuasa": [
   {
    "id": 1,
    "nama": "Murtad"
   },
   {
    "id": 2,
    "nama": "Lalai melaksanakan kewajiban pemegang hak hadhanah"
   },
   {
    "id": 3,
    "nama": "tidak memenuhi syarat sebagai hak hadhanah"
   }
  ]
 }
};

/** Hasil ukur gerbang sebutan atas 1.633 putusan (hasil-ukur-sambung.json). */
const HASIL_UKUR_SEBUTAN = {"jenis":"sebutan","sampel":1631,"samaSebelum":696,"samaSesudah":699,"salahTambahan":0};

/**
 * Fixture yang usulannya berubah sesudah kedua tambahan disahkan, dan medan
 * mana yang berubah - dihitung per fixture pada jalan pertama lalu DIPATOK.
 */
const HARAPAN_BERUBAH: Record<string, string[]> = {
  "1/Pdt.G/2025/PA.Dgl": [
    "Sumber Hukum"
  ],
  "2/Pdt.G/2025/PA.Dgl": [
    "Sumber Hukum"
  ],
  "3/Pdt.P/2025/PA.Dgl": [
    "Sumber Hukum"
  ],
  "5/Pdt.P/2025/PA.Dgl": [
    "Sumber Hukum"
  ],
  "15/Pdt.G/2025/PA.Dgl": [
    "Keadaan Istri"
  ],
  "16/Pdt.G/2025/PA.Dgl": [
    "Keadaan Istri"
  ],
  "17/Pdt.G/2025/PA.Dgl": [
    "Keadaan Istri"
  ],
  "18/Pdt.G/2025/PA.Dgl": [
    "Keadaan Istri"
  ],
  "19/Pdt.G/2025/PA.Dgl": [
    "Keadaan Istri"
  ],
  "20/Pdt.G/2025/PA.Dgl": [
    "Keadaan Istri"
  ],
  "21/Pdt.G/2025/PA.Dgl": [
    "Keadaan Istri"
  ],
  "22/Pdt.G/2025/PA.Dgl": [
    "Keadaan Istri"
  ]
};

/** Fixture yang Sumber Hukumnya BARU memuat Fiqh Islam berkat sebutan tambahan (dipatok). */
const HARAPAN_FIQH_BARU: string[] = ["1/Pdt.G/2025/PA.Dgl","2/Pdt.G/2025/PA.Dgl","3/Pdt.P/2025/PA.Dgl"];

type Pil = { nilai: string; label: string };
type Medan = { kunci: string; label: string; pilihan: Pil[]; banyak?: boolean; terpilih?: string | string[] };
type Rujukan = { id: number; nama: string };

const R = FIXTURE.rujukan as Record<string, Rujukan[]>;
const opsi = (daftar: Rujukan[], awal: Pil): Pil[] => [awal, ...daftar.map((x) => ({ nilai: String(x.id), label: x.nama }))];
const ucname = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (h) => h.toUpperCase());
const FAKTOR = R.faktor.map((x) => ({ id: x.id, nama: ucname(x.nama) }));

/** Medan borang Putusan Akhir sebagaimana dikirim ekstensi (pilihan = rujukan SIPP). */
const MEDAN: Record<string, Medan> = {
  status: { kunci: 'select[name="status_putusan"]', label: "Status Putusan", pilihan: opsi(R.status, { nilai: "-1", label: "Pilih Status Putusan" }) },
  verstek: { kunci: 'select[name="verstek"]', label: "Putusan Verstek", pilihan: [{ nilai: "T", label: "Tidak" }, { nilai: "Y", label: "Ya" }] },
  sumber: { kunci: 'input[name="sumber_hukum[]"]', label: "Sumber Hukum", banyak: true, pilihan: R.sumber.map((x) => ({ nilai: String(x.id), label: x.nama })) },
  faktor: { kunci: 'select[name="faktor_cerai"]', label: "Faktor Penyebab Perceraian", pilihan: opsi(FAKTOR, { nilai: "-1", label: "Pilih Faktor" }) },
  faktor2: { kunci: 'select[name="faktor_cerai_sekunder"]', label: "Faktor Penyebab Perceraian (Sekunder)", pilihan: opsi(FAKTOR, { nilai: "-1", label: "Pilih Faktor" }) },
  nusyuz: { kunci: 'input[name="status_nusyuz"]', label: "Status Nusyuz", pilihan: [{ nilai: "1", label: "Nusyuz" }, { nilai: "0", label: "Tidak Nusyuz" }] },
  qobla: { kunci: 'select[name="qobla"]', label: "Qobla/Ba'da Dukhul", pilihan: [{ nilai: "-1", label: "Pilih Salah Satu" }, { nilai: "0", label: "Qobla Dukhul" }, { nilai: "1", label: "Ba'da Dukhul" }] },
  keadaan: { kunci: 'select[name="keadaan_istri"]', label: "Keadaan Istri", pilihan: [{ nilai: "", label: "Pilih Keadaan Istri" }, { nilai: "1", label: "Suci" }, { nilai: "2", label: "Haid" }, { nilai: "3", label: "Hamil" }, { nilai: "4", label: "Tidak diketahui" }] },
  dispen: { kunci: 'select[name="alasan_dispen"]', label: "Alasan Pengajuan Dispensasi Kawin", pilihan: opsi(R.dispen, { nilai: "0", label: "- Pilih -" }) },
};
const MEDAN_ALASAN: Record<number, { kunci: string; label: string; ref: Rujukan[] }> = {
  1: { kunci: 'select[name="alasan_poligami"]', label: "Alasan Pengajuan Poligami", ref: R.poligami },
  3: { kunci: 'select[name="alasan_isbat"]', label: "Alasan Pengajuan Isbat Nikah", ref: R.isbat },
  4: { kunci: 'select[name="alasan_dispen"]', label: "Alasan Pengajuan Dispensasi Kawin", ref: R.dispen },
  5: { kunci: 'select[name="alasan_asalusul"]', label: "Alasan Pengajuan Asal Usul Anak", ref: R.asalusul },
};

type KasusPutusan = { nomor: string; jenis: string; medan: Medan[]; naskah: string; dasar: string; amar: string };
const PUTUSAN: KasusPutusan[] = FIXTURE.putusan.map((p) => {
  const medan: Medan[] = [MEDAN.status, MEDAN.sumber, MEDAN.verstek];
  if (p.cerai) medan.push(MEDAN.faktor, MEDAN.faktor2, MEDAN.nusyuz, MEDAN.qobla, MEDAN.keadaan);
  if (p.dispen) medan.push(MEDAN.dispen);
  const naskah = ["DUDUK PERKARA", "", "PERTIMBANGAN HUKUM", p.pertimbangan, "AMAR PUTUSAN", p.amar, "PENUTUP", "Demikian."].join("\n");
  // Dasar dan amar dipecah persis seperti rute memecahnya.
  const bagian = pecahNaskahPutusan(naskah);
  const dasar = [bagian.pertimbangan ?? "", bagian.dudukPerkara ?? ""].filter(Boolean).join("\n\n");
  return { nomor: p.nomor, jenis: p.jenis, medan, naskah, dasar, amar: bagian.amar ?? "" };
});
type KasusUmum = { nomor: string; teks: { posita: string; petitum: string }; medan: Medan[] };
const UMUM: KasusUmum[] = FIXTURE.umum.map((u) => {
  const m = MEDAN_ALASAN[u.jenisAlasan];
  return {
    nomor: u.nomor,
    teks: { posita: u.posita, petitum: u.petitum },
    medan: [{ kunci: m.kunci, label: m.label, pilihan: [{ nilai: "0", label: "- Pilih -" }, ...m.ref.map((x) => ({ nilai: String(x.id), label: x.nama }))] }],
  };
});

/**
 * Keluaran SEBELUM penyambungan: persis panggilan rute tahap 1 - medan lewat
 * saringMedanPilihan, amar sebagai ruas terpisah, tanpa opsi.tipe.
 */
const SEBELUM_PUTUSAN = PUTUSAN.map((k) =>
  usulkanMedanPutusan(k.dasar, saringMedanPilihan(k.medan), { jenisPerkara: k.jenis, amar: k.amar })
);
const SEBELUM_UMUM = UMUM.map((k) => usulkanAlasanPerkara(k.teks, saringMedanPilihan(k.medan, { medan: 20 })));

type Jawaban = { status: number; data: Record<string, unknown> };

async function mintaPutusan(k: KasusPutusan): Promise<Jawaban> {
  const { POST } = await import("@/app/api/aleta-ecourt/putusan/isian-sipp/route");
  const jawab = await POST(
    new NextRequest("http://localhost/api/aleta-ecourt/putusan/isian-sipp", {
      method: "POST",
      body: JSON.stringify({ nomorPerkara: k.nomor, jenisPerkara: k.jenis, medan: k.medan }),
    })
  );
  const isi = (await jawab.json()) as { data?: Record<string, unknown> };
  return { status: jawab.status, data: isi.data ?? {} };
}
async function mintaUmum(k: KasusUmum): Promise<Jawaban> {
  const { POST } = await import("@/app/api/aleta-ecourt/alasan-perkara/route");
  const jawab = await POST(
    new NextRequest("http://localhost/api/aleta-ecourt/alasan-perkara", {
      method: "POST",
      body: JSON.stringify({ nomorPerkara: k.nomor, teks: k.teks, medan: k.medan }),
    })
  );
  const isi = (await jawab.json()) as { data?: Record<string, unknown> };
  return { status: jawab.status, data: isi.data ?? {} };
}
async function mintaKehadiran(): Promise<Jawaban> {
  const { GET } = await import("@/app/api/aleta-ecourt/bas/kehadiran/route");
  const jawab = await GET(new NextRequest("http://localhost/api/aleta-ecourt/bas/kehadiran?perkaraId=1&sidangKe=1"));
  const isi = (await jawab.json()) as { data?: Record<string, unknown> };
  return { status: jawab.status, data: isi.data ?? {} };
}

/**
 * Basis data yang dipatahkan untuk keadaan "tak terbaca". Data pokok rute
 * (draf putusan, catatan kehadiran) tetap dijawab - tanpanya tidak ada yang
 * dapat dibandingkan, dan gagal membacanya memang galat rute itu sendiri.
 * Yang dipatahkan hanya tabel tipe keluaran ("tabel") atau SELURUH kueri lain
 * ("total" - pastikanBenih, audit, dan pengguna pun gagal).
 */
function patahkan(db: AletaDatabase, cara: "tabel" | "total"): AletaDatabase {
  const kena = (sql: unknown) =>
    !/FROM aleta_(?:putusan_draf|bas_kehadiran)\b/.test(String(sql)) &&
    (cara === "total" || /aleta_tipe_keluaran/.test(String(sql)));
  return new Proxy(db, {
    get(target, nama, penerima) {
      const asli = Reflect.get(target, nama, penerima);
      if (typeof asli !== "function") return asli;
      if (nama === "queryOne" || nama === "queryAll" || nama === "run" || nama === "exec") {
        return async (sql: string, ...sisa: unknown[]) => {
          if (kena(sql)) throw new Error(`relation "aleta_tipe_keluaran" tidak terbaca (tiruan ${cara})`);
          return asli.call(target, sql, ...sisa);
        };
      }
      return asli.bind(target);
    },
  });
}

let db: AletaDatabase | null = null;
const d = () => db as AletaDatabase;

beforeEach(async () => {
  const { createAletaDatabase } = await vi.importActual<typeof import("@/server/db/client")>("@/server/db/client");
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  for (const k of PUTUSAN) {
    await db.run(
      `INSERT INTO aleta_putusan_draf (id, perkara_id, nomor_perkara, versi, keadaan, naskah, dibuat_at, diubah_at)
       VALUES (?, ?, ?, 1, 'draf', ?, ?, ?)`,
      [`drf-${k.nomor}`, `pkr-${k.nomor}`, k.nomor, k.naskah, "2026-09-26T00:00:00.000Z", "2026-09-26T00:00:00.000Z"]
    );
  }
  uji.db = db;
  uji.n500 = 0;
  uji.galat = [];
});

afterEach(async () => {
  await db?.close();
  db = null;
  uji.db = null;
});

/** Label medan yang usulannya berbeda antara dua keluaran. */
function medanBerubah(lama: UsulanMedan[], baru: UsulanMedan[]): string[] {
  const hasil: string[] = [];
  for (let i = 0; i < Math.max(lama.length, baru.length); i++) {
    if (JSON.stringify(lama[i]) !== JSON.stringify(baru[i])) hasil.push(lama[i]?.label ?? baru[i]?.label ?? `#${i}`);
  }
  return hasil;
}

const normal = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s/]/g, " ").replace(/\s+/g, " ");

/**
 * Sebutan baru: kitab I'anatut Thalibin (Fiqh Islam). Diukur atas 1.633
 * putusan 2025-2026 (ukur-sambung.test.ts): HASIL_UKUR_SEBUTAN di bawah
 * adalah angka hasil ukur itu, bukan karangan - gerbang sahkan menuntutnya.
 */
const SEBUTAN_BARU = "i'anatut thalibin";

async function sahkanTambahan() {
  const u1 = await usul(d(), "usr-admin", {
    daftar: "putusan.sumber-hukum.sebutan",
    kunci: "fiqh islam",
    nilai: SEBUTAN_BARU,
    alasan: "Kitab yang lazim dikutip majelis satker",
  });
  if (!u1.ok) throw new Error(u1.alasan.join("; "));
  await d().run("UPDATE aleta_tipe_keluaran SET hasil_ukur = ? WHERE id = ?", [JSON.stringify(HASIL_UKUR_SEBUTAN), u1.butir.id]);
  expect(await sahkan(d(), "usr-super", { id: u1.butir.id, atasPerintah: "Ketua PA" })).toMatchObject({ ok: true });

  // Bawaan satker: Keadaan Istri "Tidak diketahui" pada cerai GUGAT. Untuk
  // cerai talak nilai itu sudah bawaan kode, dan tambahan kembarnya ditolak
  // modul (lihat uji di bawah).
  const u2 = await usul(d(), "usr-admin", {
    daftar: "putusan.bawaan-medan",
    kunci: "Keadaan Istri",
    nilai: "Tidak diketahui",
    data: { jenisPerkara: "gugat" },
    alasan: "Bawaan satker",
  });
  if (!u2.ok) throw new Error(u2.alasan.join("; "));
  expect(await sahkan(d(), "usr-super", { id: u2.butir.id, atasPerintah: "Ketua PA" })).toMatchObject({ ok: true });
}

describe("tabel kosong: jawaban sama persis dengan sebelum disambung", () => {
  it(`isian-sipp: ${PUTUSAN.length} fixture, jawaban deep-equal tanpa kabar`, async () => {
    const beda: string[] = [];
    for (let i = 0; i < PUTUSAN.length; i++) {
      const j = await mintaPutusan(PUTUSAN[i]);
      expect(j.status, PUTUSAN[i].nomor).toBe(200);
      const harap = { ada: true, versi: 1, keadaan: "draf", usulan: SEBELUM_PUTUSAN[i] };
      if (JSON.stringify(j.data) !== JSON.stringify(harap)) beda.push(PUTUSAN[i].nomor);
    }
    expect(beda).toEqual([]);
    expect(uji.n500).toBe(0);
  });

  it(`alasan-perkara: ${UMUM.length} fixture, usulan deep-equal tanpa kabar`, async () => {
    for (let i = 0; i < UMUM.length; i++) {
      const j = await mintaUmum(UMUM[i]);
      expect(j.status).toBe(200);
      expect(j.data.usulan, UMUM[i].nomor).toEqual(SEBELUM_UMUM[i]);
      expect(j.data).not.toHaveProperty("kabarTipeKeluaran");
    }
    expect(uji.n500).toBe(0);
  });

  it("bas/kehadiran: bunyi = 5 konstanta BUNYI_KEHADIRAN, urutan sama, tanpa kabar", async () => {
    const j = await mintaKehadiran();
    expect(j.status).toBe(200);
    expect(j.data.bunyi).toEqual([...BUNYI_KEHADIRAN]);
    expect(j.data.bunyi).toHaveLength(5);
    expect(j.data).not.toHaveProperty("kabarBunyi");
  });
});

describe("tambahan yang disahkan mengubah usulan hanya pada fixture yang relevan", () => {
  it("bawaan Keadaan Istri 'Tidak diketahui' untuk cerai talak sudah bawaan kode: tambahan kembarnya ditolak", async () => {
    await mintaKehadiran(); // benih tertanam lewat pembacaan pertama
    const hasil = await usul(d(), "usr-admin", {
      daftar: "putusan.bawaan-medan",
      kunci: "Keadaan Istri",
      nilai: "Tidak diketahui",
      data: { jenisPerkara: "talak" },
      alasan: "Bawaan satker",
    }).catch((galat: unknown) => ({ ok: false as const, alasan: [String((galat as Error).message)] }));
    expect(hasil.ok).toBe(false);
  });

  it("sebutan sumber hukum baru + bawaan Keadaan Istri cerai gugat: dihitung per fixture", async () => {
    await sahkanTambahan();
    const berubah: Record<string, string[]> = {};
    const takRelevan: string[] = [];
    const fiqhBaru: string[] = [];
    for (let i = 0; i < PUTUSAN.length; i++) {
      const k = PUTUSAN[i];
      const j = await mintaPutusan(k);
      expect(j.status).toBe(200);
      const lama = SEBELUM_PUTUSAN[i];
      const baru = j.data.usulan as UsulanMedan[];
      const ubah = medanBerubah(lama, baru);
      if (ubah.length) berubah[k.nomor] = ubah;
      // Sumber Hukum yang BARU memuat Fiqh Islam berkat sebutan tambahan.
      const fiqh = (u: UsulanMedan[]) =>
        (u.find((x) => x.label === "Sumber Hukum")?.nilaiBanyak ?? []).some((x) => x.label === "Fiqh Islam");
      if (fiqh(baru) && !fiqh(lama)) fiqhBaru.push(k.nomor);
      // Relevan: naskah menyebut sebutan baru (Sumber Hukum), atau cerai
      // gugat yang Keadaan Istrinya dijawab dari BAWAAN (naskah diam).
      const keadaan = lama.find((x) => x.label === "Keadaan Istri");
      const relevanSumber = normal(k.dasar).includes(normal(SEBUTAN_BARU));
      const relevanKeadaan = /cerai\s*gugat/i.test(k.jenis) && Boolean(keadaan?.nilai) && !keadaan?.kutipan;
      for (const label of ubah) {
        const relevan = (label === "Sumber Hukum" && relevanSumber) || (label === "Keadaan Istri" && relevanKeadaan);
        if (!relevan) takRelevan.push(`${k.nomor} ${label}`);
      }
      if (relevanKeadaan) {
        // Bawaan kode "Suci" digantikan tambahan satker "Tidak diketahui",
        // dan asalnya disebut: bawaan-satker.
        const kini = baru.find((x) => x.label === "Keadaan Istri");
        expect(keadaan?.nilaiLabel).toBe("Suci");
        expect(kini?.nilaiLabel, k.nomor).toBe("Tidak diketahui");
        expect(kini?.sumberUsulan, k.nomor).toBe("bawaan-satker");
        expect(ubah).toContain("Keadaan Istri");
      }
    }
    expect(takRelevan).toEqual([]);
    expect(berubah).toEqual(HARAPAN_BERUBAH);
    expect(fiqhBaru).toEqual(HARAPAN_FIQH_BARU);
    expect(uji.n500).toBe(0);
  });

  it("alasan-perkara: tambahan putusan tidak mengubah satu pun usulan Data Umum", async () => {
    await sahkanTambahan();
    for (let i = 0; i < UMUM.length; i++) {
      const j = await mintaUmum(UMUM[i]);
      expect(j.data.usulan, UMUM[i].nomor).toEqual(SEBELUM_UMUM[i]);
    }
  });

  it("alasan-perkara MENERUSKAN tipe: medan yang dikenal mesin ikut bawaan satker", async () => {
    // Medan alasan Data Umum hari ini tidak dipengaruhi kedua daftar, jadi
    // penerusannya hanya terlihat lewat medan yang memang dibaca mesin
    // bersama. Tanpa penerusan, bawaan satker berlaku-semua ini tidak muncul.
    const u = await usul(d(), "usr-admin", {
      daftar: "putusan.bawaan-medan",
      kunci: "Keadaan Istri",
      nilai: "Tidak diketahui",
      data: { jenisPerkara: "*" },
      alasan: "Bawaan satker untuk semua jenis",
    });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    expect(await sahkan(d(), "usr-super", { id: u.butir.id, atasPerintah: "Ketua PA" })).toMatchObject({ ok: true });
    const k = { ...UMUM[0], medan: [MEDAN.keadaan] };
    const tanpa = usulkanAlasanPerkara(k.teks, saringMedanPilihan(k.medan, { medan: 20 }));
    const j = await mintaUmum(k);
    const kini = (j.data.usulan as UsulanMedan[])[0];
    expect(tanpa[0]?.sumberUsulan).not.toBe("bawaan-satker");
    expect(kini.nilaiLabel).toBe("Tidak diketahui");
    expect(kini.sumberUsulan).toBe("bawaan-satker");
  });

  it("bas/kehadiran: bunyi tambahan yang disahkan ikut, bawaan yang dimatikan hilang", async () => {
    const { matikan } = await import("@/server/modules/aleta-ecourt/tipe-keluaran");
    const u = await usul(d(), "usr-admin", { daftar: "bas.kehadiran.bunyi", nilai: "hadir melalui telekonferensi" });
    if (!u.ok) throw new Error(u.alasan.join("; "));
    expect(await sahkan(d(), "usr-super", { id: u.butir.id, atasPerintah: "usr-hakim" })).toMatchObject({ ok: true });
    let j = await mintaKehadiran();
    expect(j.data.bunyi).toEqual([...BUNYI_KEHADIRAN, "hadir melalui telekonferensi"]);

    const bawaan = await d().queryOne<{ id: string }>(
      "SELECT id FROM aleta_tipe_keluaran WHERE daftar = 'bas.kehadiran.bunyi' AND nilai = ?",
      [BUNYI_KEHADIRAN[2]]
    );
    expect(await matikan(d(), "usr-super", { id: String(bawaan?.id), alasan: "Tidak dipakai satker" })).toMatchObject({ ok: true });
    j = await mintaKehadiran();
    expect(j.data.bunyi).toEqual([
      ...BUNYI_KEHADIRAN.filter((_, i) => i !== 2),
      "hadir melalui telekonferensi",
    ]);
  });
});

describe("basis data tak terbaca: konstanta kode, kabar 'memakai bawaan', tanpa 500", () => {
  // Galatnya harus DICATAT, bukan ditelan: tiap keadaan rusak menuntut
  // console.error terpanggil. Mata-mata ini juga menahan catatan itu dari
  // keluaran uji.
  let mataGalat: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    mataGalat = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    expect(mataGalat).toHaveBeenCalled();
    mataGalat.mockRestore();
  });

  for (const cara of ["tabel", "total"] as const) {
    it(`${cara}: isian-sipp dan alasan-perkara = keluaran sebelum disambung`, async () => {
      uji.db = patahkan(d(), cara);
      for (let i = 0; i < PUTUSAN.length; i++) {
        const j = await mintaPutusan(PUTUSAN[i]);
        expect(j.status, PUTUSAN[i].nomor).toBe(200);
        expect(j.data.usulan, PUTUSAN[i].nomor).toEqual(SEBELUM_PUTUSAN[i]);
        expect((j.data.kabarTipeKeluaran as string[]).join(" ")).toMatch(/memakai bawaan/);
      }
      for (let i = 0; i < UMUM.length; i++) {
        const j = await mintaUmum(UMUM[i]);
        expect(j.status).toBe(200);
        expect(j.data.usulan, UMUM[i].nomor).toEqual(SEBELUM_UMUM[i]);
        expect((j.data.kabarTipeKeluaran as string[]).join(" ")).toMatch(/memakai bawaan/);
      }
      expect(uji.n500).toBe(0);
    });

    it(`${cara}: bas/kehadiran = BUNYI_KEHADIRAN dengan kabar`, async () => {
      uji.db = patahkan(d(), cara);
      const j = await mintaKehadiran();
      expect(j.status).toBe(200);
      expect(j.data.bunyi).toEqual([...BUNYI_KEHADIRAN]);
      expect((j.data.kabarBunyi as string[]).join(" ")).toMatch(/memakai bawaan/);
      expect(uji.n500).toBe(0);
    });
  }

  it("untukPortal sendiri melempar: ketiga rute tetap 200, konstanta, dan kabar", async () => {
    uji.lemparTipe = true;
    try {
      const p = await mintaPutusan(PUTUSAN[0]);
      expect(p.status).toBe(200);
      expect(p.data.usulan).toEqual(SEBELUM_PUTUSAN[0]);
      expect((p.data.kabarTipeKeluaran as string[]).join(" ")).toMatch(/memakai bawaan/);
      const u = await mintaUmum(UMUM[0]);
      expect(u.status).toBe(200);
      expect(u.data.usulan).toEqual(SEBELUM_UMUM[0]);
      expect((u.data.kabarTipeKeluaran as string[]).join(" ")).toMatch(/memakai bawaan/);
      const h = await mintaKehadiran();
      expect(h.status).toBe(200);
      expect(h.data.bunyi).toEqual([...BUNYI_KEHADIRAN]);
      expect((h.data.kabarBunyi as string[]).join(" ")).toMatch(/memakai bawaan/);
      expect(uji.n500).toBe(0);
    } finally {
      uji.lemparTipe = false;
    }
  });

  it("getDatabase menyerahkan objek tanpa kemampuan baca: tetap 200 dan konstanta", async () => {
    // Bentuk tiruan lama (borang-putusan-amar.test.ts): hanya queryOne untuk
    // draf. untukPortal melempar di tempat yang tidak ia tangkap sendiri.
    const k = PUTUSAN[0];
    uji.db = { queryOne: async () => ({ naskah: k.naskah, keadaan: "draf", versi: 1 }) };
    const j = await mintaPutusan(k);
    expect(j.status).toBe(200);
    expect(j.data.usulan).toEqual(SEBELUM_PUTUSAN[0]);
    expect((j.data.kabarTipeKeluaran as string[]).join(" ")).toMatch(/memakai bawaan/);
    expect(uji.n500).toBe(0);
  });
});
