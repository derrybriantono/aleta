// OCR-ECOURT 19 Okt 2026: teks REKAAN berbentuk hasil OCR lampiran e-Court (nama, nomor, NIK semuanya karangan).
// Tidak ada data pribadi sungguhan di sini.

const NIK_SUAMI = "7203011505900001";
const NIK_ISTRI = "7203014708920002";
const NIK_ORANG_LAIN = "7271016601850009";

module.exports = {
  NIK_SUAMI,
  NIK_ISTRI,
  NIK_ORANG_LAIN,
  PIHAK: [
    { cabang: 1, urutan: 1, nama: "SITI RAHMAWATI binti LA ODE HASAN", nik: NIK_ISTRI, tanggalLahirIso: "1992-08-07" },
    { cabang: 2, urutan: 1, nama: "ANDI SAPUTRA bin MUH. YUSUF", nik: NIK_SUAMI, tanggalLahirIso: "1990-05-15" },
  ],
  KK: `KARTU KELUARGA
No. 72O3O1l2O32OOO45
Nama Kepala Keluarga : ANDI SAPUTRA Desa/Kelurahan : KABONGA BESAR
Alamat : JL. POROS RT/RW 001/002 Kecamatan : BANAWA
Kabupaten/Kota : DONGGALA REPUBLIK INDONESIA Kode Pos 94351 Provinsi : SULAWESI TENGAH
No Nama Lengkap NIK Jenis Kelamin Tempat Lahir Tanggal Lahir Agama
1 ANDI SAPUTRA ${NIK_SUAMI} LAKI-LAKI DONGGALA 15-05-1990 ISLAM
2 SITI RAHMAWATI ${NIK_ISTRI} PEREMPUAN PALU 07-08-1992 ISLAM
Status Hubungan Dalam Keluarga Dokumen Imigrasi
Dikeluarkan Tanggal : 12-03-2020 KEPALA KELUARGA KEPALA DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL`,
  KK_ORANG_LAIN: `KARTU KELUARGA
No. 7271011203150007
Nama Kepala Keluarga : BAHRUDIN LATIF Desa/Kelurahan : BESUSU
1 BAHRUDIN LATIF ${NIK_ORANG_LAIN} LAKI-LAKI PALU 26-01-1985 ISLAM
Status Hubungan Dalam Keluarga
Dikeluarkan Tanggal : 01-02-2015`,
  AKTA_LAHIR: `REPUBLIK INDONESIA PENCATATAN SIPIL
KUTIPAN AKTA KELAHIRAN
EXCERPT OF BIRTH CERTIFICATE
Berdasarkan Akta Kelahiran Nomor 7203-LT-1O042018-0021
bahwa di DONGGALA pada tanggal SEPULUH APRIL tahun DUA RIBU DELAPAN BELAS
telah lahir NURUL AINI
anak ke SATU dari ayah ANDI SAPUTRA dan ibu SITI RAHMAWATI
Kutipan ini dikeluarkan di KABUPATEN DONGGALA pada tanggal DUA PULUH APRIL Tahun DUA RIBU DELAPAN BELAS
Pejabat Pencatatan Sipil`,
  AKTA_KEMATIAN: `KUTIPAN AKTA KEMATIAN EXCERPT OF DEATH CERTIFICATE
Berdasarkan Akta Kematian Nomor .7203-KM-19112025-0004
bahwa di RSUD KABELOTA in accordance with that in
pada tanggal SEMBILAN BELAS NOVEMBER tahun DUA RIBU DUA PULUH LIMA
telah meninggal dunia seorang bernama Tn/Ny/Nn LA ODE HASAN a person has deceased
Kutipan ini dikeluarkan Di KABUPATEN DONGGALA pada tanggal DUA PULUH TUJUH NOVEMBER Tahun DUA RIBU DUA PULUH LIMA`,
  SK_DESA: `PEMERINTAH KABUPATEN DONGGALA
KECAMATAN BANAWA
KELURAHAN KABONGA BESAR
SURAT KETERANGAN DOMISILI
Nomor : 470/ 12 / KB-B / Tl / 2026
Yang bertanda tangan di bawah ini, Lurah Kabonga Besar Kecamatan Banawa, Menerangkan Bahwa :
Nama : SITI RAHMAWATI
Tempat Tanggal Lahir : Palu, 07 Agustus 1992
NIK : ${NIK_ISTRI}
Bahwa nama tersebut di atas adalah benar penduduk Kelurahan Kabonga Besar.
Demikian Surat Keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.
Donggala, 05 Pebruari 2026
LURAH KABONGA BESAR`,
  SK_KUA_TOLAK: `KEMENTERIAN AGAMA REPUBLIK INDONESIA
KANTOR URUSAN AGAMA KECAMATAN BANAWA KABUPATEN DONGGALA
SURAT PENOLAKAN PERNIKAHAN
Nomor : B-112/Kua.21.03.1/PW.01/03/2026
Menerangkan bahwa pernikahan calon mempelai tidak dapat dilangsungkan karena wali menolak.
Donggala, 10 Maret 2026
Kepala KUA`,
  KUASA_T: `SURAT KUASA KHUSUS
Yang bertanda tangan di bawah ini : ANDI SAPUTRA bin MUH. YUSUF, umur 36 tahun, agama Islam,
dalam hal ini selaku Tergugat, dengan ini memberikan kuasa kepada:
RUSDI HAMZAH, S.H. Advokat pada Kantor Hukum Rusdi Hamzah & Rekan, beralamat di Jl. Sam Ratulangi No. 5 Palu,
------------ KHUSUS ------------
Untuk dan atas nama pemberi kuasa mewakili dalam perkara cerai gugat di Pengadilan Agama Donggala.
Palu, 03 Juni 2026
Penerima Kuasa Pemberi Kuasa`,
  KUASA_INSIDENTIL: `Hal : Permohonan Menjadi Kuasa Insidentil
Kepada Yth. Ketua Pengadilan Agama Donggala
Yang bertanda tangan di bawah ini saya :
Nama : HAMDAN bin LA ODE HASAN
Umur : 40 Tahun
Sebagai penerima kuasa
Dengan ini mohon izin untuk menjadi kuasa Insidentil, mewakili :
1. Nama : SITI RAHMAWATI binti LA ODE HASAN
Sebagai pemberi kuasa
1. Bahwa Pemohon adalah saudara kandung dengan pemberi kuasa;
Donggala, 14 Januari 2026`,
  SLIP_GAJI: `SLIP GAJI PEGAWAI
Nama : ANDI SAPUTRA
Bulan : Mei 2026
Gaji Pokok Rp 3.200.000
Potongan Rp 250.000
Gaji Bersih : Rp 4.150.000`,
  KTP: `PROVINSI SULAWESI TENGAH KABUPATEN DONGGALA
NIK : ${NIK_ISTRI}
Nama : SITI RAHMAWATI
Tempat/Tgl Lahir : PALU, 07-08-1992
Gol. Darah : - Status Perkawinan: KAWIN Kewarganegaraan: WNI
Berlaku Hingga: SEUMUR HIDUP
KARTU TANDA PENDUDUK`,
  SAMPAH: `sos x| -| IE, | elelsfene| | 9 | 9 lehtepk ya | aloe | FIsiE Ep 9 P9 | 9 slzlel | 9g aa | z size 99 9P Ie`,
};
