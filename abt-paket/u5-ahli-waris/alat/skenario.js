// Skenario isian uji variabel 4500-4599 (dipakai uji_lokal.js, uji_server.js dan uji vitest)
const SKENARIO = {
  kosong: { id: 990001, isi: {} },
  penuh: {
    id: 990002,
    isi: {
      4500: "mengurus balik nama sebidang tanah di Desa Oloboju",
      4502: "Fulan bin Fulanah",
      4505: "1",
      4507: "satu bidang tanah kepada tetangga",
      4510: "Yohanes bin Yusuf (anak kandung Pewaris)",
      4513: "1",
      4515: "Janda 1/8; anak laki-laki dan anak perempuan menerima sisa dengan perbandingan 2 : 1",
      4520: "sebidang tanah dan rumah",
      4534: "1",
      8610: "Siti binti Sahar",
      9701: "Siti binti Sahar",
      9700: "dana BPJS Ketenagakerjaan nomor 123",
      1509: "Desa Sibowi",
      1247: "sakit",
    },
  },
  cerai: { id: 990003, isi: { 4513: "2", 8610: "Ani binti Anto" } },
  dana: { id: 990004, isi: { 9700: "dana Taspen nomor 55;" } },
  bukti: {
    id: 990005,
    isi: {
      8132:
        "1.\tFotokopi Kartu Tanda Penduduk a.n. Pemohon I, NIK 720801. Bukti surat tersebut telah diperiksa, diberi kode bukti (P.1). Diberi tanggal;\n" +
        "2.\tFotokopi Kartu Tanda Penduduk a.n. Pemohon II. Bukti surat tersebut telah diperiksa, diberi kode bukti (P.2). Diberi tanggal;\r\n" +
        "3.\tFotokopi Kutipan Akta Nikah a.n. Pemohon Nomor: 29/07/V/1994, (P.3);\n" +
        "4.\tFotocopy Kartu Keluarga, atas nama Sinumaire Nomor: 7203102701053446 (P.4);\n" +
        "5.\tFotokopi Kutipan Akta Kematian Sinumaire (P.5);\n" +
        "6.\tFotokopi Surat Keterangan Kematian Riski (P.6);\n" +
        "7.\tFotokopi Kutipan Akta Kelahiran Rifal (P.7);\n" +
        "8.\tAsli Surat Pernyataan Silsilah Keluarga (P.8);\n" +
        "9.\tFotokopi Kartu Peserta BPJS Ketenagakerjaan atas nama Sinumaire (P.9);\n" +
        "10.\tFotokopi Surat Kuasa (P.10)",
    },
  },
  matiIslam: { id: 10172, sippId: 10172, isi: { 1509: "Desa Sibowi", 1247: "sakit" } },
  matiTanpaIslam: { id: 10178, sippId: 10178, isi: {} },
  tanpaMati: { id: 10058, sippId: 10058, isi: { 1509: "Kabupaten Sigi" } },
  buktiTanpaKode: { id: 990006, isi: { 8132: "1.\tFotokopi Kartu Keluarga a.n. Pewaris;\n2.\tFotokopi Akta Kematian Pewaris;\n3.\tFotokopi KTP Pemohon" } },
};

module.exports = SKENARIO;
if (require.main === module) process.stdout.write(JSON.stringify(SKENARIO));
