# -*- coding: utf-8 -*-
"""
Katalog saksi EKONOMI SYARIAH versi 2 (agen W2a-K2, 21 Okt 2026). Menambah pokok, pertanyaan, keadaan, dasar hukum dan profil pengetahuan saksi
tanpa menghapus apa pun dari versi 1 (abt-paket/w2a-kebendaan/katalog-v1-k2/ekonomi-syariah.json).
Melayani dua blangko Derry: "10 Ekonomi Syariah" (gugatan sederhana, alur 17) dan "10a Ekonomi Syariah Biasa" (acara biasa, alur 15).
Pakai: python es_k2.py  (menulis ekstensi-sipp/saksi-katalog/ekonomi-syariah.json lalu memeriksanya)
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import k2lib as L
from k2lib import Q, B, Daftar

# <PM> pengaju | <LW> lawan | <AK> akad (jenis, nomor, tanggal) | <JB> jumlah kewajiban bertitik | <RP> rincian pembiayaan | <AS> angsuran dan jatuh tempo | <SP> surat peringatan | <AG> agunan
PETA = {"_g": "x", "PM": "#0046#", "LW": "#0047#", "AK": "#9340#", "JB": "#9344#", "RP": "#4765#", "AS": "#4766#", "SP": "#4767#", "AG": "#4768#"}
D = DAFTAR = Daftar()
T = D.tambah

SUMBER_KHES = "KHES (PERMA 2/2008), naskah resmi dari pengguna: referensi/_unduhan/perma/PERMA-2-2008-KHES.pdf, dibaca teks halaman 4-5 pada 21 Okt 2026"
SUMBER_DERRY = "teks blangko Derry 10 Ekonomi Syariah [01] dan 10a Ekonomi Syariah Biasa (server aps_badilag, 21 Okt 2026); naskah PERMA belum ada pada berkas pengguna sehingga belum tercetak"

DASAR_BARU = [
    dict(id="dh-khes-20-akad", rujukan="Pasal 20 angka 1, 3, 4, 6, 9, 14, 37 dan 38 Kompilasi Hukum Ekonomi Syariah (PERMA 2/2008)", uraian="pengertian akad (kesepakatan dalam perjanjian antara dua pihak atau lebih untuk melakukan atau tidak melakukan perbuatan hukum tertentu), syirkah, mudharabah, murabahah (pembiayaan melalui jual beli dengan penjelasan harga pengadaan barang dan harga jual, pengembalian tunai atau angsur), ijarah (sewa barang dalam jangka waktu tertentu dengan pembayaran), rahn atau gadai (penguasaan barang milik peminjam oleh pemberi pinjaman sebagai jaminan), qard (penyediaan dana atau tagihan yang mewajibkan peminjam membayar tunai atau cicilan dalam jangka waktu tertentu) dan ta'widh (penggantian kerugian riil oleh pihak yang melakukan wanprestasi)", status="terverifikasi", sumber=SUMBER_KHES),
    dict(id="dh-perma-gs", rujukan="PERMA 2/2015 jo PERMA 4/2019 tentang Gugatan Sederhana", uraian="syarat gugatan sederhana: cidera janji atau perbuatan melawan hukum dengan nilai gugatan materiil paling banyak lima ratus juta rupiah, bukan perkara pengadilan khusus dan bukan sengketa hak atas tanah, penggugat dan tergugat bertempat tinggal di wilayah pengadilan yang sama, diperiksa hakim tunggal", status="perlu-verifikasi", sumber=SUMBER_DERRY),
    dict(id="dh-perma-14-es", rujukan="PERMA 14/2016 tentang Tata Cara Penyelesaian Perkara Ekonomi Syariah", uraian="tata cara penyelesaian perkara ekonomi syariah termasuk gugatan dengan acara biasa dan penyelesaian sengketa yang memuat klausula penyelesaian sengketa", status="perlu-verifikasi", sumber=SUMBER_DERRY),
]

POKOK_BARU = [
    dict(id="pp-es-kewenangan", judul="Prinsip syariah pada lembaga dan akad", uraian="pengaju menjalankan usaha berdasarkan prinsip syariah dan akad yang disengketakan dibuat menurut prinsip syariah", dasarHukum=["dh-pasal-49-i", "dh-khes-20-akad"], wajib=False),
    dict(id="pp-es-pihak", judul="Penanganan pembiayaan dan kedudukan para pihak", uraian="siapa yang menangani pembiayaan di pihak pengaju, siapa yang mengajukan pembiayaan di pihak lawan dan dokumen yang diserahkan", dasarHukum=["dh-khes-22"], wajib=False),
    dict(id="pp-es-akad-dasar", judul="Permohonan, pembuatan dan salinan akad", uraian="permohonan pembiayaan, tanggal dan tempat akad, bentuk akad, penjelasan isi akad dan salinan yang diserahkan kepada lawan", dasarHukum=["dh-khes-21", "dh-khes-22", "dh-kuhperdata-1338"], wajib=False),
    dict(id="pp-es-murabahah", judul="Akad murabahah", uraian="barang yang dibiayai, harga pengadaan barang, margin, harga jual, jangka waktu dan angsuran", dasarHukum=["dh-khes-20-akad"], wajib=False),
    dict(id="pp-es-bagi-hasil", judul="Akad mudharabah dan musyarakah", uraian="modal yang disetor, usaha yang dijalankan, nisbah bagi hasil, laporan usaha dan pembagian untung rugi", dasarHukum=["dh-khes-20-akad"], wajib=False),
    dict(id="pp-es-ijarah", judul="Akad ijarah", uraian="benda yang disewa, masa sewa, ujrah dan pemakaian benda sewa", dasarHukum=["dh-khes-20-akad"], wajib=False),
    dict(id="pp-es-rahn-qardh", judul="Akad rahn, qardh dan akad lain", uraian="barang gadai dan nilainya, pinjaman pokok tanpa tambahan, jatuh tempo, dan isi pokok akad lain", dasarHukum=["dh-khes-20-akad"], wajib=False),
    dict(id="pp-es-pencairan", judul="Penyerahan barang atau pencairan dana", uraian="pengaju menyerahkan barang atau mencairkan dana dan lawan menerimanya dengan bukti", dasarHukum=["dh-khes-21", "dh-kesesuaian-saksi"], wajib=False),
    dict(id="pp-es-angsuran-rinci", judul="Angsuran, tunggakan dan sisa kewajiban", uraian="jumlah angsuran, jatuh tempo, angsuran yang sudah dibayar, tunggakan dan rincian sisa kewajiban", dasarHukum=["dh-khes-36-38"], wajib=False),
    dict(id="pp-es-wanprestasi-rinci", judul="Awal dan sebab ingkar janji", uraian="sejak kapan lawan menunggak, apakah ia mampu, menghindar atau membayar sebagian", dasarHukum=["dh-khes-36-38"], wajib=False),
    dict(id="pp-es-somasi", judul="Surat peringatan, penagihan dan restrukturisasi", uraian="surat peringatan atau somasi, penerimaannya, kunjungan penagihan dan tawaran penjadwalan ulang pembayaran", dasarHukum=["dh-khes-36-38"], wajib=False),
    dict(id="pp-es-agunan", judul="Agunan dan penjamin", uraian="bentuk agunan, bukti haknya, persetujuan pemilik agunan, penjamin, nilai dan penguasaan agunan", dasarHukum=["dh-khes-20-akad", "dh-buku2-2026-41-42"], wajib=False),
    dict(id="pp-es-kerugian-rinci", judul="Denda, ganti rugi dan biaya penagihan", uraian="denda atau ta'widh atas keterlambatan, dasar perhitungannya dan biaya lain yang timbul", dasarHukum=["dh-khes-36-38", "dh-khes-39", "dh-khes-20-akad"], wajib=False),
    dict(id="pp-es-arbitrase", judul="Klausula penyelesaian sengketa dalam akad", uraian="ada atau tidaknya klausula arbitrase dalam akad dan upaya penyelesaian sengketa yang sudah ditempuh", dasarHukum=["dh-perma-14-es"], wajib=False),
    dict(id="pp-es-akibat", judul="Penguasaan agunan, sita dan eksekusi", uraian="kekhawatiran agunan dialihkan, kesediaan lawan menyerahkan agunan, penghunian agunan dan kemampuan lawan membayar", dasarHukum=["dh-kesesuaian-saksi", "dh-buku2-2026-41-42"], wajib=False),
    dict(id="pp-es-gs", judul="Syarat gugatan sederhana", uraian="tempat tinggal para pihak dan besarnya kewajiban sebagai syarat pemeriksaan gugatan sederhana", dasarHukum=["dh-perma-gs"], wajib=False),
]

KEADAAN_BARU = {
    "acara": dict(sumber="borang", nilai=["acara-biasa", "gugatan-sederhana"], bawaan="acara-biasa", label="Acara pemeriksaan",
                  labelNilai={"acara-biasa": "Acara biasa (blangko 10a)", "gugatan-sederhana": "Gugatan sederhana (blangko 10)"}),
    "jenisAkad": dict(sumber="borang", nilai=["murabahah", "mudharabah", "musyarakah", "ijarah", "rahn", "qardh", "akad-lain"], bawaan="murabahah", label="Jenis akad yang disengketakan",
                      labelNilai={"murabahah": "Murabahah (jual beli dengan margin)", "mudharabah": "Mudharabah (bagi hasil, pengelola dana)", "musyarakah": "Musyarakah (penyertaan modal bersama)", "ijarah": "Ijarah (sewa)", "rahn": "Rahn (gadai)", "qardh": "Qardh (pinjaman tanpa tambahan)", "akad-lain": "Akad lain (istishna, salam, wadiah, wakalah, kafalah)"}),
    "pengaju": dict(sumber="borang", nilai=["lembaga-keuangan", "perorangan"], bawaan="lembaga-keuangan", label="Kedudukan pihak yang menggugat",
                    labelNilai={"lembaga-keuangan": "Lembaga keuangan atau badan usaha syariah", "perorangan": "Perorangan"}),
    "jenisJaminan": dict(sumber="borang", nilai=["tanah-bangunan", "kendaraan-fidusia", "penjamin-pribadi", "barang-gadai"], jamak=True, bawaan=[], label="Bentuk agunan atau jaminan",
                         labelNilai={"tanah-bangunan": "Tanah dan bangunan (hak tanggungan)", "kendaraan-fidusia": "Kendaraan atau barang (fidusia)", "penjamin-pribadi": "Penjamin pribadi", "barang-gadai": "Barang gadai (emas, BPKB)"}),
    "teguran": dict(sumber="borang", nilai=["surat-peringatan", "kunjungan-penagihan", "restrukturisasi"], jamak=True, bawaan=["surat-peringatan"], label="Upaya penagihan yang didalilkan",
                    labelNilai={"surat-peringatan": "Surat peringatan atau somasi", "kunjungan-penagihan": "Kunjungan penagihan", "restrukturisasi": "Tawaran penjadwalan ulang atau restrukturisasi"}),
    "klausulaArbitrase": dict(sumber="borang", nilai=["tidak", "ada"], bawaan="tidak", label="Akad memuat klausula arbitrase",
                              labelNilai={"tidak": "Tidak ada klausula arbitrase", "ada": "Ada klausula arbitrase"}),
    "tuntutanTambahan": dict(sumber="borang", nilai=["denda-ganti-rugi", "sita-jaminan", "lelang-agunan", "pengosongan", "uang-paksa", "serta-merta"], jamak=True, bawaan=[], label="Tuntutan tambahan dalam gugatan",
                             labelNilai={"denda-ganti-rugi": "Denda atau ganti rugi keterlambatan", "sita-jaminan": "Sita jaminan atas agunan", "lelang-agunan": "Lelang agunan", "pengosongan": "Pengosongan agunan", "uang-paksa": "Uang paksa", "serta-merta": "Putusan serta merta"}),
}

# ------------------------------------------------------------------ prinsip syariah dan pihak
T(Q("q-es-lembaga-syariah", "pp-es-kewenangan", 15, "pilihan", "pokok",
    "Apakah <PM> menjalankan usahanya berdasarkan prinsip syariah, dan apakah akad dengan <LW> disusun menurut prinsip syariah ?",
    hal="prinsip syariah pada usaha pengaju dan pada akad", ringkas="usaha <PM> dan akad dengan <LW> yang berprinsip syariah",
    teks_varian=["Apakah usaha <PM> dijalankan menurut prinsip syariah dan apakah akad dengan <LW> dibuat menurut prinsip syariah ?"],
    melihat=["<PM> menjalankan usahanya berdasarkan prinsip syariah dan <AK> disusun menurut prinsip syariah",
             "kegiatan usaha <PM> berlandaskan prinsip syariah sehingga <AK> dibuat menurut prinsip syariah",
             "<PM> adalah pelaku usaha syariah dan <AK> memakai prinsip syariah",
             "usaha <PM> dikelola menurut prinsip syariah dan <AK> berisi ketentuan syariah"],
    sebagian=["<PM> menjalankan usaha berdasarkan prinsip syariah dalam <AK>", "<AK> dibuat <PM> menurut prinsip syariah"],
    berbeda=B("peristiwa", "versi A: akad disusun menurut prinsip syariah; versi B: akad disusun menurut prinsip konvensional - berselisih pada PERISTIWA",
              ["<AK> disusun menurut prinsip syariah", "<AK> dibuat berdasarkan prinsip syariah"],
              ["<AK> disusun menurut prinsip konvensional", "<AK> dibuat berdasarkan prinsip konvensional"])),
  gaya="tahu")

T(Q("q-es-penanganan", "pp-es-pihak", 17, "pilihan", "pokok",
    "Siapa yang menangani pembiayaan <LW> pada <PM>, dan di mana berkas serta catatan angsurannya disimpan ?",
    hal="penanganan pembiayaan dan penyimpanan berkas serta catatan angsuran", ringkas="penanganan pembiayaan <LW> pada <PM> dan penyimpanan berkasnya",
    teks_varian=["Bagian mana pada <PM> yang mengurus pembiayaan <LW>, dan di mana catatan angsurannya tersimpan ?"],
    melihat=["pembiayaan <LW> pada <PM> ditangani oleh bagian pembiayaan dan catatan angsuran tersimpan di kantor <PM>",
             "berkas pembiayaan <LW> dipegang bagian pembiayaan <PM> beserta catatan angsurannya",
             "<PM> menyimpan berkas dan catatan angsuran pembiayaan <LW> di kantornya",
             "catatan angsuran pembiayaan <LW> dikelola petugas pembiayaan <PM> dan disimpan dengan tertib"],
    sebagian=["berkas pembiayaan <LW> disimpan di kantor <PM>", "catatan pembiayaan <LW> dipegang petugas <PM>"],
    berbeda=B("pelaku", "versi A: pembiayaan ditangani bagian pembiayaan pengaju; versi B: pembiayaan ditangani pihak lain di luar pengaju - berselisih pada PELAKU",
              ["pembiayaan <LW> ditangani bagian pembiayaan <PM>", "bagian pembiayaan <PM> yang menangani pembiayaan <LW>"],
              ["pembiayaan <LW> ditangani pihak lain di luar <PM>", "yang menangani pembiayaan <LW> adalah pihak lain di luar bagian <PM>"])),
  gaya="tahu")

T(Q("q-es-lawan-pengajuan", "pp-es-pihak", 23, "inti", "pokok",
    "Apakah <LW> sendiri yang mengajukan permohonan pembiayaan kepada <PM> untuk <AK>, untuk keperluan apa, dan dokumen apa yang diserahkan ?",
    hal="pengajuan permohonan pembiayaan oleh lawan", ringkas="pengajuan permohonan pembiayaan oleh <LW> kepada <PM> untuk <AK>",
    teks_varian=["Siapa yang mengajukan permohonan pembiayaan kepada <PM> untuk <AK>, untuk apa, dan dokumen apa yang diserahkan <LW> ?"],
    melihat=["<LW> sendiri yang mengajukan permohonan pembiayaan kepada <PM> untuk <AK> dengan menyerahkan dokumen persyaratan",
             "permohonan pembiayaan untuk <AK> diajukan langsung oleh <LW> kepada <PM> beserta dokumen yang diminta",
             "<LW> datang ke <PM> mengajukan pembiayaan untuk <AK> dan melengkapi dokumen persyaratannya",
             "pengajuan pembiayaan untuk <AK> berasal dari <LW> sendiri yang menyerahkan dokumen kepada <PM>"],
    sebagian=["<LW> mengajukan permohonan pembiayaan kepada <PM> untuk <AK>", "pembiayaan untuk <AK> diajukan <LW> kepada <PM>"],
    berbeda=B("pelaku", "versi A: lawan sendiri yang mengajukan pembiayaan; versi B: orang lain yang mengajukan pembiayaan atas nama lawan - berselisih pada PELAKU",
              ["<LW> sendiri yang mengajukan pembiayaan kepada <PM> untuk <AK>", "pembiayaan untuk <AK> diajukan langsung oleh <LW> kepada <PM>"],
              ["orang lain yang mengajukan pembiayaan kepada <PM> untuk <AK> atas nama <LW>", "pembiayaan untuk <AK> diajukan oleh pihak lain kepada <PM> atas nama <LW>"])),
  gaya="lihat")

# ------------------------------------------------------------------ pembuatan akad
T(Q("q-es-akad-tanggal", "pp-es-akad-dasar", 33, "inti", "pokok",
    "Kapan dan di mana akad itu ditandatangani, dan siapa yang menandatanganinya atas nama <PM> ?",
    hal="tanggal tempat dan penandatangan akad", ringkas="tanggal, tempat dan penandatangan <AK>",
    teks_varian=["Pada hari dan tempat mana akad itu ditandatangani, dan siapa yang mewakili <PM> ?"],
    melihat=["<AK> ditandatangani <LW> dan wakil <PM> di kantor <PM> pada tanggal yang tertera dalam akad itu",
             "penandatanganan <AK> dilakukan <LW> bersama wakil <PM> di kantor <PM> sesuai tanggal akad",
             "pada tanggal yang tertera <LW> dan wakil <PM> menandatangani <AK> di kantor <PM>",
             "<AK> dibubuhi tanda tangan <LW> dan wakil <PM> di kantor <PM> sesuai tanggal akad"],
    sebagian=["<AK> ditandatangani <LW> di kantor <PM>", "<LW> menandatangani <AK> di kantor <PM>"],
    berbeda=B("tempat", "versi A: akad ditandatangani di kantor pengaju; versi B: akad ditandatangani di tempat lain - berselisih pada TEMPAT",
              ["<AK> ditandatangani <LW> di kantor <PM>", "penandatanganan <AK> oleh <LW> dilakukan di kantor <PM>"],
              ["<AK> ditandatangani <LW> di tempat lain di luar kantor <PM>", "penandatanganan <AK> oleh <LW> dilakukan di tempat lain di luar kantor <PM>"])),
  gaya="lihat")

T(Q("q-es-akad-dibacakan", "pp-es-akad-dasar", 35, "pilihan", "pokok",
    "Apakah isi akad dibacakan atau dijelaskan kepada <LW> sebelum ditandatangani, dan apakah ia mengerti isinya ?",
    hal="penjelasan isi akad kepada lawan sebelum penandatanganan", ringkas="penjelasan isi <AK> kepada <LW> sebelum penandatanganan",
    teks_varian=["Sebelum menandatangani akad apakah <LW> diberi penjelasan tentang isinya oleh petugas ?"],
    melihat=["isi <AK> dibacakan dan dijelaskan petugas <PM> kepada <LW> sebelum ditandatangani dan <LW> menyatakan mengerti",
             "sebelum penandatanganan <AK> petugas <PM> menjelaskan seluruh isinya kepada <LW> yang mengangguk mengerti",
             "<LW> mendapat penjelasan isi <AK> dari petugas <PM> sebelum membubuhkan tanda tangan",
             "petugas <PM> membacakan <AK> di depan <LW> sampai selesai sebelum ditandatangani"],
    sebagian=["petugas <PM> menjelaskan sebagian isi <AK> kepada <LW>", "isi <AK> dijelaskan petugas <PM> kepada <LW> secara garis besar"],
    berbeda=B("peristiwa", "versi A: isi akad dijelaskan kepada lawan; versi B: isi akad tidak dijelaskan kepada lawan - berselisih pada PERISTIWA",
              ["isi <AK> dijelaskan petugas <PM> kepada <LW> sebelum ditandatangani", "petugas <PM> membacakan <AK> kepada <LW> sebelum ditandatangani"],
              ["isi <AK> tidak dijelaskan petugas <PM> kepada <LW> sebelum ditandatangani", "petugas <PM> tidak membacakan <AK> kepada <LW> sebelum ditandatangani"])),
  gaya="lihat")

T(Q("q-es-akad-salinan", "pp-es-akad-dasar", 37, "pilihan", "pokok",
    "Apakah salinan akad dan jadwal angsuran diserahkan kepada <LW>, dan apakah ada tanda terimanya ?",
    hal="penyerahan salinan akad dan jadwal angsuran kepada lawan", ringkas="penyerahan salinan <AK> dan jadwal angsuran kepada <LW>",
    teks_varian=["Apakah <LW> memegang salinan akad dan jadwal angsuran yang diberikan pengaju ?"],
    melihat=["salinan <AK> dan jadwal angsuran diserahkan <PM> kepada <LW> yang menandatangani tanda terimanya",
             "<LW> menerima salinan <AK> beserta jadwal angsuran dari <PM> pada hari penandatanganan",
             "setelah <AK> ditandatangani <PM> memberikan salinan akad dan jadwal angsuran kepada <LW>",
             "jadwal angsuran dan salinan <AK> dipegang <LW> setelah diserahkan <PM>"],
    sebagian=["<LW> menerima salinan <AK> dari <PM>", "<PM> menyerahkan salinan <AK> kepada <LW>"],
    berbeda=B("peristiwa", "versi A: salinan akad diserahkan kepada lawan; versi B: salinan akad tidak pernah diserahkan - berselisih pada PERISTIWA",
              ["salinan <AK> diserahkan <PM> kepada <LW>", "<LW> menerima salinan <AK> dari <PM>"],
              ["salinan <AK> tidak pernah diserahkan <PM> kepada <LW>", "<LW> tidak pernah menerima salinan <AK> dari <PM>"])),
  gaya="lihat")

T(Q("q-es-akad-bentuk", "pp-es-akad-dasar", 39, "pilihan", "pokok",
    "Dalam bentuk apa akad itu dibuat, apakah tertulis di bawah tangan atau dengan akta Notaris, dan siapa saja yang menandatanganinya ?",
    hal="bentuk akad dan para penandatangannya", ringkas="bentuk <AK> dan para penandatangannya",
    teks_varian=["Apakah akad itu dibuat tertulis di bawah tangan atau di hadapan Notaris ?"],
    melihat=["<AK> dibuat secara tertulis dan ditandatangani <PM> serta <LW> di atas meterai",
             "bentuk <AK> adalah akad tertulis yang ditandatangani kedua pihak <PM> dan <LW>",
             "<PM> dan <LW> menandatangani <AK> yang dibuat tertulis dan dibubuhi meterai",
             "<AK> dituangkan dalam surat tertulis yang ditandatangani <PM> dan <LW>"],
    sebagian=["<AK> dibuat secara tertulis oleh <PM> dan <LW>", "<AK> ditandatangani <PM> dan <LW>"],
    berbeda=B("peristiwa", "versi A: akad dibuat tertulis dan ditandatangani kedua pihak; versi B: akad tidak ditandatangani lawan - berselisih pada PERISTIWA",
              ["<AK> dibuat tertulis dan ditandatangani <PM> serta <LW>", "<PM> dan <LW> menandatangani <AK> yang dibuat tertulis"],
              ["<AK> tidak ditandatangani <LW> meskipun dibuat tertulis", "<LW> tidak menandatangani <AK> yang dibuat tertulis"])),
  gaya="lihat")

T(Q("q-es-pemilik-jaminan-setuju", "pp-es-agunan", 31, "pilihan", "pokok",
    "Apakah pasangan atau pemilik agunan mengetahui dan menyetujui akad itu, dan apakah ia ikut menandatangani ?",
    hal="persetujuan pasangan atau pemilik agunan atas akad", ringkas="persetujuan pasangan atau pemilik agunan atas <AK>",
    teks_varian=["Apakah pemilik agunan atau pasangan hadir dan menyetujui akad pada waktu penandatanganan ?"],
    melihat=["pasangan atau pemilik agunan mengetahui <AK> dan menyetujui agunan itu dengan ikut menandatangani untuk <LW>",
             "pemilik agunan hadir saat <AK> ditandatangani <LW> dan menyatakan setuju agunannya dipakai",
             "persetujuan pemilik agunan atas <AK> dibuat <LW> secara tertulis dan ditandatangani",
             "pasangan <LW> menyetujui <AK> dan agunan di dalamnya serta menandatangani persetujuannya"],
    sebagian=["pemilik agunan mengetahui <AK> yang dibuat <LW>", "pasangan <LW> mengetahui <AK> yang ditandatangani <LW>"],
    berbeda=B("peristiwa", "versi A: pemilik agunan menyetujui akad; versi B: pemilik agunan tidak mengetahui akad - berselisih pada PERISTIWA",
              ["pemilik agunan menyetujui <AK> yang dibuat <LW>", "pemilik agunan ikut menandatangani <AK> yang dibuat <LW>"],
              ["pemilik agunan tidak mengetahui <AK> yang dibuat <LW>", "pemilik agunan tidak pernah menandatangani <AK> yang dibuat <LW>"])),
  gaya="lihat", jaminan="ada")

# ------------------------------------------------------------------ murabahah
T(Q("q-es-murabahah-barang", "pp-es-murabahah", 41, "inti", "pokok",
    "Barang atau kebutuhan apa yang dibiayai dengan akad murabahah itu, dan apakah <PM> yang membelikan atau memberi kuasa kepada <LW> untuk membelinya ?",
    hal="barang yang dibiayai dengan akad murabahah", ringkas="barang yang dibiayai <PM> kepada <LW> dengan akad murabahah",
    teks_varian=["Apa yang dibeli lewat pembiayaan murabahah <PM> kepada <LW>, dan siapa yang membelinya ?"],
    melihat=["<PM> membiayai pengadaan barang untuk <LW> berdasarkan <AK> dan barang itu diserahkan kepada <LW>",
             "pembiayaan murabahah dari <PM> untuk <LW> berdasarkan <AK> dipakai membeli barang kebutuhan usaha <LW>",
             "barang kebutuhan <LW> dibeli dengan dana <PM> berdasarkan <AK> lalu dijual kepada <LW>",
             "berdasarkan <AK> <PM> menyediakan barang yang dibutuhkan <LW> untuk usahanya"],
    sebagian=["<PM> membiayai pembelian barang untuk <LW> berdasarkan <AK>", "barang untuk <LW> dibiayai <PM> berdasarkan <AK>"],
    berbeda=B("peristiwa", "versi A: barang pembiayaan diserahkan kepada lawan; versi B: barang pembiayaan tidak pernah diserahkan - berselisih pada PERISTIWA",
              ["barang pembiayaan <AK> diserahkan <PM> kepada <LW>", "barang yang dibiayai <PM> dalam <AK> diterima <LW>"],
              ["barang pembiayaan <AK> tidak pernah diserahkan <PM> kepada <LW>", "barang yang dibiayai <PM> dalam <AK> tidak pernah diterima <LW>"])),
  gaya="lihat", jenisAkad="murabahah")

T(Q("q-es-murabahah-harga", "pp-es-murabahah", 42, "inti", "pokok",
    "Berapa harga beli, margin keuntungan, harga jual dan jangka waktu pembiayaan murabahah itu menurut akad ?",
    hal="harga beli margin harga jual dan jangka waktu pembiayaan murabahah", ringkas="rincian harga beli, margin, harga jual dan jangka waktu <AK>",
    teks_varian=["Menurut akad itu berapa harga barang, margin dan harga jual, serta berapa lama pembiayaannya ?"],
    melihat=["rincian pembiayaan <AK> adalah <RP> sebagaimana tertulis dalam akad",
             "menurut <AK> rincian harga dan jangka waktu pembiayaan adalah <RP>",
             "dalam <AK> tertulis rincian pembiayaan yaitu <RP> yang disepakati kedua pihak",
             "isi rincian pembiayaan <AK> yaitu <RP> sesuai yang tertera dalam akad"],
    sebagian=["rincian pembiayaan <AK> sebagian adalah <RP>", "menurut <AK> sebagian rincian pembiayaan adalah <RP>"],
    berbeda=B("jumlah", "versi A: rincian pembiayaan sesuai uraian gugatan; versi B: rincian pembiayaan berbeda dari uraian gugatan - berselisih pada JUMLAH",
              ["rincian pembiayaan <AK> adalah <RP> sesuai uraian gugatan", "menurut <AK> rincian pembiayaan adalah <RP> seperti dalam gugatan"],
              ["rincian pembiayaan <AK> berbeda dari <RP> yang diuraikan dalam gugatan", "menurut <AK> rincian pembiayaan lain dari <RP> yang diuraikan dalam gugatan"])),
  gaya="tahu", jenisAkad="murabahah")

T(Q("q-es-murabahah-angsuran", "pp-es-murabahah", 43, "inti", "pokok",
    "Berapa angsuran yang harus dibayar <LW> tiap bulan, tanggal berapa jatuh temponya, dan lewat mana angsuran itu dibayar ?",
    hal="jumlah angsuran tiap bulan dan tanggal jatuh tempo", ringkas="jumlah angsuran dan tanggal jatuh tempo <AK>",
    teks_varian=["Menurut jadwal akad berapa angsuran bulanan <LW> dan tanggal berapa tiap bulan harus dibayar ?"],
    melihat=["angsuran <LW> menurut <AK> adalah <AS> dan dibayar lewat rekening atau loket <PM>",
             "jadwal angsuran <AK> adalah <AS> yang harus dibayar <LW> lewat <PM>",
             "kewajiban angsuran <LW> pada <AK> yaitu <AS> dan dibayarkan kepada <PM>",
             "ketentuan angsuran dalam <AK> adalah <AS> yang wajib dibayar <LW> kepada <PM>"],
    sebagian=["angsuran <LW> menurut <AK> sebagian adalah <AS>", "menurut <AK> angsuran <LW> sebagian adalah <AS>"],
    berbeda=B("jumlah", "versi A: angsuran sesuai uraian gugatan; versi B: angsuran berbeda dari uraian gugatan - berselisih pada JUMLAH",
              ["angsuran <LW> menurut <AK> adalah <AS> sesuai uraian gugatan", "jadwal angsuran <AK> adalah <AS> seperti dalam gugatan"],
              ["angsuran <LW> menurut <AK> berbeda dari <AS> dalam uraian gugatan", "jadwal angsuran <AK> lain dari <AS> dalam uraian gugatan"])),
  gaya="tahu", jenisAkad="murabahah")

# ------------------------------------------------------------------ mudharabah dan musyarakah
T(Q("q-es-bagi-hasil-modal", "pp-es-bagi-hasil", 44, "inti", "pokok",
    "Berapa modal yang disetor <PM>, usaha apa yang dijalankan <LW> dengan modal itu, dan berapa nisbah pembagian hasilnya ?",
    hal="modal usaha dan nisbah bagi hasil", ringkas="modal yang disetor <PM> dan nisbah bagi hasil dengan <LW>",
    teks_varian=["Apa usaha yang dijalankan <LW> dengan modal dari <PM>, dan bagaimana pembagian hasil usahanya ?"],
    melihat=["<PM> menyetor modal usaha kepada <LW> berdasarkan <AK> dan hasil usaha dibagi menurut nisbah dalam akad",
             "berdasarkan <AK> <PM> menyerahkan modal dan <LW> menjalankan usaha dengan pembagian hasil sesuai nisbah",
             "modal usaha dari <PM> dikelola <LW> menurut <AK> dengan bagi hasil yang ditentukan dalam akad",
             "<LW> mengelola modal dari <PM> sesuai <AK> dan hasilnya dibagi dengan nisbah yang disepakati"],
    sebagian=["<PM> menyetor modal usaha kepada <LW> berdasarkan <AK>", "<LW> mengelola modal dari <PM> sesuai <AK>"],
    berbeda=B("jumlah", "versi A: modal disetor sesuai uraian gugatan; versi B: modal yang disetor lebih kecil dari uraian gugatan - berselisih pada JUMLAH",
              ["modal yang disetor <PM> kepada <LW> sesuai <AK>", "<PM> menyetor modal kepada <LW> sebesar yang tertulis dalam <AK>"],
              ["modal yang disetor <PM> kepada <LW> lebih kecil dari yang tertulis dalam <AK>", "<PM> menyetor modal kepada <LW> kurang dari yang tertulis dalam <AK>"])),
  gaya="lihat", jenisAkad=["mudharabah", "musyarakah"])

T(Q("q-es-bagi-hasil-laporan", "pp-es-bagi-hasil", 45, "inti", "pokok",
    "Apakah <LW> pernah melaporkan usahanya kepada <PM> dan membayar bagian hasil, dan bagaimana keuntungan atau kerugian usahanya ?",
    hal="laporan usaha dan pembayaran bagi hasil", ringkas="laporan usaha dan pembayaran bagi hasil dari <LW> kepada <PM>",
    teks_varian=["Apakah <LW> menyampaikan laporan hasil usaha dan menyetor bagi hasil kepada <PM> ?"],
    melihat=["<LW> pernah melaporkan hasil usaha kepada <PM> dan menyetor bagi hasil untuk beberapa waktu menurut <AK>",
             "pada awal akad <LW> menyampaikan laporan usaha kepada <PM> dan membayar bagian hasil sesuai <AK>",
             "bagi hasil dari usaha <LW> disetorkan kepada <PM> sesuai <AK> pada masa awal akad",
             "<LW> memberikan laporan usaha dan bagian hasil kepada <PM> menurut <AK> sampai ia berhenti"],
    sebagian=["<LW> pernah menyetor bagi hasil kepada <PM> menurut <AK>", "<LW> pernah membayar bagian hasil kepada <PM> menurut <AK>"],
    berbeda=B("peristiwa", "versi A: lawan berhenti melapor dan menyetor bagi hasil; versi B: lawan terus melapor dan menyetor bagi hasil - berselisih pada PERISTIWA",
              ["<LW> berhenti melapor dan menyetor bagi hasil kepada <PM> menurut <AK>", "<LW> sudah lama berhenti membayar bagian hasil kepada <PM> menurut <AK>"],
              ["<LW> terus melapor dan menyetor bagi hasil kepada <PM> menurut <AK>", "<LW> selalu membayar bagian hasil kepada <PM> menurut <AK>"])),
  gaya="lihat", jenisAkad=["mudharabah", "musyarakah"])

T(Q("q-es-bagi-hasil-rugi", "pp-es-bagi-hasil", 46, "tambahan", "pokok",
    "Apakah usaha yang dibiayai itu mengalami kerugian, sebabnya apa, dan siapa yang menanggung kerugian itu menurut akad ?",
    hal="kerugian usaha yang dibiayai dan pihak yang menanggungnya", ringkas="kerugian usaha <LW> yang dibiayai <PM> dan penanggungnya menurut <AK>",
    teks_varian=["Apa penyebab kerugian usaha itu dan menurut akad siapa yang harus menanggungnya ?"],
    melihat=["usaha <LW> yang dibiayai <PM> mengalami kerugian karena kelalaian <LW> dalam mengelola sebagaimana <AK>",
             "kerugian usaha <LW> terjadi karena <LW> lalai mengelola modal dari <PM> menurut <AK>",
             "menurut <AK> kerugian usaha yang disebabkan kelalaian <LW> menjadi tanggungan <LW> sendiri kepada <PM>",
             "<PM> menilai kerugian usaha <LW> berasal dari kelalaian pengelolaan sesuai <AK>"],
    berbeda=B("penyebab", "versi A: kerugian karena kelalaian lawan; versi B: kerugian karena keadaan di luar kendali lawan - berselisih pada PENYEBAB",
              ["kerugian usaha <LW> disebabkan kelalaian <LW> sendiri dalam <AK>", "kerugian usaha yang dibiayai <PM> terjadi karena kelalaian <LW> dalam <AK>"],
              ["kerugian usaha <LW> disebabkan keadaan di luar kendali <LW> dalam <AK>", "kerugian usaha yang dibiayai <PM> terjadi karena keadaan di luar kendali <LW> dalam <AK>"])),
  gaya="lihat", jenisAkad=["mudharabah", "musyarakah"])

# ------------------------------------------------------------------ ijarah
T(Q("q-es-ijarah-objek", "pp-es-ijarah", 47, "inti", "pokok",
    "Benda apa yang disewa, untuk berapa lama, berapa ujrah atau sewanya, dan bagaimana pembayarannya menurut akad ?",
    hal="benda yang disewa masa sewa dan ujrah", ringkas="benda sewa, masa sewa dan ujrah menurut <AK>",
    teks_varian=["Menurut akad ijarah itu benda apa yang disewakan, berapa lama dan berapa sewanya ?"],
    melihat=["<PM> menyewakan benda kepada <LW> berdasarkan <AK> dengan rincian <RP>",
             "dalam <AK> <LW> menyewa benda dari <PM> dengan ketentuan <RP>",
             "benda sewa dalam <AK> diserahkan <PM> kepada <LW> sesuai <RP>",
             "menurut <AK> rincian sewa yang disepakati <PM> dan <LW> yaitu <RP>"],
    sebagian=["<PM> menyewakan benda kepada <LW> berdasarkan <AK>", "<LW> menyewa benda dari <PM> berdasarkan <AK>"],
    berbeda=B("jumlah", "versi A: sewa sesuai uraian gugatan; versi B: sewa berbeda dari uraian gugatan - berselisih pada JUMLAH",
              ["rincian sewa <AK> sesuai <RP> dalam gugatan", "ketentuan sewa dalam <AK> sama dengan <RP> dalam gugatan"],
              ["rincian sewa <AK> berbeda dari <RP> dalam gugatan", "ketentuan sewa dalam <AK> lain dari <RP> dalam gugatan"])),
  gaya="tahu", jenisAkad="ijarah")

T(Q("q-es-ijarah-pemakaian", "pp-es-ijarah", 48, "inti", "pokok",
    "Apakah benda sewa sudah diserahkan dan dipakai <LW>, sampai kapan dipakai, dan apakah ujrah dibayar atau ada kerusakan ?",
    hal="penyerahan dan pemakaian benda sewa serta pembayaran ujrah", ringkas="penyerahan dan pemakaian benda sewa oleh <LW> serta pembayaran ujrah",
    teks_varian=["Apakah <LW> memakai benda yang disewa dan membayar sewanya sesuai akad ?"],
    melihat=["benda sewa dalam <AK> sudah diserahkan <PM> dan dipakai <LW> sampai masa sewa berakhir",
             "<LW> memakai benda sewa menurut <AK> dan ujrahnya berhenti dibayar sebelum masa sewa berakhir",
             "sejak penyerahan benda sewa dalam <AK> <LW> memakainya terus tetapi ujrah menunggak",
             "<LW> menguasai benda sewa dari <PM> menurut <AK> dan ujrahnya terus tertunggak"],
    sebagian=["benda sewa dalam <AK> dipakai <LW>", "<LW> memakai benda sewa menurut <AK>"],
    berbeda=B("peristiwa", "versi A: ujrah dibayar lunas oleh penyewa; versi B: ujrah tertunggak oleh penyewa - berselisih pada PERISTIWA",
              ["ujrah dalam <AK> dibayar lunas oleh <LW>", "<LW> melunasi ujrah menurut <AK> kepada <PM>"],
              ["ujrah dalam <AK> tertunggak oleh <LW>", "<LW> menunggak ujrah menurut <AK> kepada <PM>"])),
  gaya="lihat", jenisAkad="ijarah")

# ------------------------------------------------------------------ rahn, qardh, akad lain
T(Q("q-es-rahn-barang", "pp-es-rahn-qardh", 49, "inti", "pokok",
    "Barang apa yang digadaikan <LW> kepada <PM>, berapa nilai taksirannya, dan di mana barang itu disimpan ?",
    hal="barang gadai nilai taksiran dan tempat penyimpanan", ringkas="barang gadai <LW> kepada <PM> menurut <AK>",
    teks_varian=["Apa yang dijadikan barang gadai oleh <LW> kepada <PM>, dan siapa yang menyimpannya ?"],
    melihat=["<LW> menyerahkan barang gadai kepada <PM> berdasarkan <AK> dan barang itu disimpan di tempat <PM>",
             "berdasarkan <AK> barang gadai milik <LW> dipegang <PM> beserta bukti taksirannya",
             "barang yang digadaikan <LW> dalam <AK> berada dalam penyimpanan <PM>",
             "<PM> menerima dan menyimpan barang gadai dari <LW> menurut <AK>"],
    sebagian=["<LW> menyerahkan barang gadai kepada <PM> berdasarkan <AK>", "barang gadai <LW> dipegang <PM> menurut <AK>"],
    berbeda=B("tempat", "versi A: barang gadai disimpan pada pengaju; versi B: barang gadai masih dipegang lawan - berselisih pada TEMPAT",
              ["barang gadai <AK> disimpan oleh <PM>", "barang gadai milik <LW> dalam <AK> berada pada <PM>"],
              ["barang gadai <AK> masih dipegang oleh <LW>", "barang gadai milik <LW> dalam <AK> masih berada pada <LW>"])),
  gaya="lihat", jenisAkad="rahn")

T(Q("q-es-rahn-jatuh-tempo", "pp-es-rahn-qardh", 53, "inti", "pokok",
    "Kapan jatuh tempo pinjaman yang dijamin dengan gadai itu, apakah <LW> menebus atau memperpanjang, dan apa tanggapannya ketika diingatkan ?",
    hal="jatuh tempo gadai penebusan atau perpanjangan", ringkas="jatuh tempo gadai dalam <AK> dan penebusan atau perpanjangan oleh <LW>",
    teks_varian=["Apakah setelah jatuh tempo <LW> menebus barang gadai atau memperpanjang akad ?"],
    melihat=["pinjaman dalam <AK> sudah jatuh tempo dan <LW> belum menebus barang gadai walaupun diingatkan <PM>",
             "setelah jatuh tempo <AK> <LW> tidak menebus barang gadainya dan <PM> sudah mengingatkannya",
             "<LW> membiarkan pinjaman dalam <AK> melewati jatuh tempo dan tidak menebusnya meskipun <PM> mengingatkan",
             "sampai lewat jatuh tempo <AK> barang gadai belum ditebus <LW> padahal <PM> sudah menegurnya"],
    sebagian=["pinjaman dalam <AK> sudah jatuh tempo", "jatuh tempo pinjaman dalam <AK> sudah lewat"],
    berbeda=B("peristiwa", "versi A: lawan tidak menebus barang gadai sesudah jatuh tempo; versi B: lawan sudah menebus barang gadai - berselisih pada PERISTIWA",
              ["<LW> tidak menebus barang gadai dalam <AK> sesudah jatuh tempo", "sesudah jatuh tempo <AK> <LW> tidak menebus barang gadainya"],
              ["<LW> sudah menebus barang gadai dalam <AK> sesudah jatuh tempo", "sesudah jatuh tempo <AK> <LW> menebus barang gadainya"])),
  gaya="lihat", jenisAkad="rahn")

T(Q("q-es-qardh-pokok", "pp-es-rahn-qardh", 51, "inti", "pokok",
    "Berapa pinjaman pokok yang diberikan <PM> kepada <LW>, apakah ada tambahan yang disyaratkan, dan kapan jatuh temponya ?",
    hal="pinjaman pokok qardh dan jatuh temponya", ringkas="pinjaman pokok dalam <AK> dan jatuh temponya",
    teks_varian=["Berapa uang yang dipinjamkan <PM> kepada <LW> dalam akad qardh dan kapan harus dikembalikan ?"],
    melihat=["<PM> meminjamkan dana kepada <LW> berdasarkan <AK> sebesar pokok yang disebut dalam akad dan harus dikembalikan pada waktu yang ditentukan",
             "pinjaman pokok dalam <AK> diberikan <PM> kepada <LW> untuk dikembalikan pada waktu yang disepakati",
             "dana pinjaman dari <PM> kepada <LW> menurut <AK> wajib dikembalikan pada jatuh tempo yang ditulis dalam akad",
             "menurut <AK> <LW> menerima pinjaman pokok dari <PM> dan wajib mengembalikannya pada waktu yang ditentukan"],
    sebagian=["<PM> meminjamkan dana kepada <LW> berdasarkan <AK>", "<LW> menerima pinjaman dana dari <PM> berdasarkan <AK>"],
    berbeda=B("jumlah", "versi A: pinjaman pokok sesuai uraian gugatan; versi B: pinjaman pokok lebih kecil dari uraian gugatan - berselisih pada JUMLAH",
              ["pinjaman pokok dalam <AK> sesuai uraian gugatan", "dana yang dipinjamkan <PM> kepada <LW> dalam <AK> sama dengan uraian gugatan"],
              ["pinjaman pokok dalam <AK> lebih kecil dari uraian gugatan", "dana yang dipinjamkan <PM> kepada <LW> dalam <AK> kurang dari uraian gugatan"])),
  gaya="tahu", jenisAkad="qardh")

T(Q("q-es-akad-lain", "pp-es-rahn-qardh", 52, "inti", "pokok",
    "Akad apa yang dibuat <PM> dan <LW>, apa isi pokoknya, dan apa kewajiban masing-masing pihak menurut akad itu ?",
    hal="isi pokok akad lain dan kewajiban para pihak", ringkas="isi pokok dan kewajiban para pihak dalam <AK>",
    teks_varian=["Apa isi pokok akad antara <PM> dan <LW>, dan apa yang harus dilakukan masing-masing pihak ?"],
    melihat=["<AK> memuat kewajiban <PM> menyerahkan prestasinya dan kewajiban <LW> membayar atau melaksanakan bagiannya",
             "isi pokok <AK> adalah kewajiban timbal balik <PM> dan <LW> yang tertulis dalam akad",
             "menurut <AK> <PM> dan <LW> masing-masing mempunyai kewajiban yang tertulis jelas dalam akad",
             "dalam <AK> <PM> berkewajiban menyerahkan sesuatu dan <LW> berkewajiban membayar atau melaksanakan bagiannya"],
    sebagian=["<AK> memuat kewajiban timbal balik <PM> dan <LW>", "<AK> mengatur kewajiban <PM> dan <LW>"],
    berbeda=B("peristiwa", "versi A: isi akad sesuai uraian gugatan; versi B: isi akad berbeda dari uraian gugatan - berselisih pada PERISTIWA",
              ["isi <AK> sesuai dengan uraian gugatan <PM>", "isi pokok <AK> sama dengan uraian gugatan <PM>"],
              ["isi <AK> berbeda dari uraian gugatan <PM>", "isi pokok <AK> lain dari uraian gugatan <PM>"])),
  gaya="tahu", jenisAkad="akad-lain")

# ------------------------------------------------------------------ pencairan
T(Q("q-es-pencairan", "pp-es-pencairan", 65, "inti", "pokok",
    "Kapan dan bagaimana <PM> menyerahkan barang atau mencairkan dana kepada <LW>, lewat rekening atau tunai, dan apa buktinya ?",
    hal="penyerahan barang atau pencairan dana kepada lawan", ringkas="penyerahan barang atau pencairan dana oleh <PM> kepada <LW> berdasarkan <AK>",
    teks_varian=["Bagaimana dana atau barang dari <PM> sampai ke <LW>, dan apakah ada bukti penerimaannya ?"],
    melihat=["<PM> mencairkan dana kepada <LW> berdasarkan <AK> lewat rekening dan bukti pencairannya diterima <LW>",
             "dana pembiayaan <AK> dipindahkan <PM> ke rekening <LW> pada hari akad ditandatangani",
             "barang atau dana menurut <AK> diserahkan <PM> kepada <LW> dengan bukti penerimaan yang ditandatangani",
             "<LW> menerima pencairan dana dari <PM> berdasarkan <AK> dan menandatangani buktinya"],
    sebagian=["<PM> mencairkan dana kepada <LW> berdasarkan <AK>", "<LW> menerima dana dari <PM> berdasarkan <AK>"],
    berbeda=B("peristiwa", "versi A: dana atau barang sudah diserahkan kepada lawan; versi B: dana atau barang belum diserahkan sepenuhnya - berselisih pada PERISTIWA",
              ["dana atau barang menurut <AK> sudah diserahkan <PM> kepada <LW>", "<PM> sudah menyerahkan seluruh dana atau barang menurut <AK> kepada <LW>"],
              ["dana atau barang menurut <AK> belum diserahkan sepenuhnya oleh <PM> kepada <LW>", "<PM> belum menyerahkan seluruh dana atau barang menurut <AK> kepada <LW>"])),
  gaya="lihat")

T(Q("q-es-tanda-terima", "pp-es-pencairan", 75, "pilihan", "pokok",
    "Apakah <LW> menandatangani tanda terima atau bukti penerimaan barang atau dana, dan siapa yang melihatnya menandatangani ?",
    hal="tanda terima barang atau dana yang ditandatangani lawan", ringkas="tanda terima barang atau dana yang ditandatangani <LW> berdasarkan <AK>",
    teks_varian=["Apakah <LW> pernah membubuhkan tanda tangan sebagai tanda menerima barang atau dana ?"],
    melihat=["<LW> menandatangani tanda terima atas barang atau dana menurut <AK> di depan petugas <PM>",
             "bukti penerimaan barang atau dana menurut <AK> ditandatangani <LW> disaksikan petugas <PM>",
             "tanda terima menurut <AK> dibubuhi tanda tangan <LW> sendiri di depan petugas <PM>",
             "<LW> sendiri yang menandatangani bukti penerimaan menurut <AK> kepada <PM>"],
    sebagian=["<LW> menandatangani tanda terima menurut <AK>", "bukti penerimaan menurut <AK> ditandatangani <LW>"],
    berbeda=B("peristiwa", "versi A: lawan menandatangani tanda terima; versi B: lawan tidak pernah menandatangani tanda terima - berselisih pada PERISTIWA",
              ["<LW> menandatangani tanda terima menurut <AK>", "bukti penerimaan menurut <AK> ditandatangani <LW>"],
              ["<LW> tidak pernah menandatangani tanda terima menurut <AK>", "bukti penerimaan menurut <AK> tidak pernah ditandatangani <LW>"])),
  gaya="lihat")

# ------------------------------------------------------------------ angsuran dan tunggakan
T(Q("q-es-angsuran-terakhir", "pp-es-angsuran-rinci", 85, "inti", "pokok",
    "Sudah berapa kali <LW> membayar angsuran, kapan angsuran terakhir dibayar, dan sejak kapan angsuran tidak dibayar lagi ?",
    hal="jumlah angsuran yang dibayar dan angsuran terakhir", ringkas="angsuran yang sudah dibayar <LW> dan angsuran terakhirnya menurut <AK>",
    teks_varian=["Kapan terakhir kali <LW> membayar angsuran dan berapa kali sudah membayar ?"],
    melihat=["<LW> membayar angsuran menurut <AK> sebanyak yang tercatat pada <AS> lalu berhenti membayar",
             "angsuran <AK> dibayar <LW> sebanyak yang tercatat pada <AS> sebelum angsuran terhenti",
             "catatan <PM> menunjukkan <LW> membayar angsuran <AK> sebanyak <AS> kemudian berhenti",
             "setelah membayar angsuran <AK> sebanyak yang tercatat pada <AS> <LW> berhenti membayar"],
    sebagian=["<LW> pernah membayar angsuran <AK> sebagaimana tercatat pada <AS>", "angsuran <AK> pernah dibayar <LW> sebagaimana tercatat pada <AS>"],
    berbeda=B("jumlah", "versi A: angsuran yang dibayar sesuai catatan pengaju; versi B: angsuran yang dibayar lebih banyak dari catatan pengaju - berselisih pada JUMLAH",
              ["angsuran <AK> yang dibayar <LW> sesuai catatan <PM> pada <AS>", "jumlah angsuran <AK> yang dibayar <LW> sama dengan catatan <PM> pada <AS>"],
              ["angsuran <AK> yang dibayar <LW> lebih banyak dari catatan <PM> pada <AS>", "jumlah angsuran <AK> yang dibayar <LW> melebihi catatan <PM> pada <AS>"])),
  gaya="lihat")

T(Q("q-es-sisa-rinci", "pp-es-angsuran-rinci", 145, "inti", "pokok",
    "Berapa sisa kewajiban <LW> yang terdiri dari pokok, margin dan denda, dan di mana rinciannya tercatat ?",
    hal="rincian sisa kewajiban pokok margin dan denda", ringkas="rincian sisa kewajiban <LW> sebesar Rp<JB> menurut <AK>",
    teks_varian=["Rincian sisa kewajiban <LW> terdiri dari apa saja dan tercatat di mana ?"],
    melihat=["sisa kewajiban <LW> menurut <AK> sebesar Rp<JB> terdiri dari pokok, margin dan denda dan tercatat dalam rekening pembiayaan",
             "rincian sisa kewajiban <LW> dalam <AK> berjumlah Rp<JB> dan tercatat dalam buku pembiayaan",
             "catatan <PM> menunjukkan sisa kewajiban <LW> menurut <AK> sebesar Rp<JB> beserta rinciannya",
             "dalam <AK> sisa kewajiban <LW> yang tercatat adalah Rp<JB> sesuai rincian pembukuan"],
    sebagian=["sisa kewajiban <LW> menurut <AK> tercatat sebesar Rp<JB>", "<PM> mencatat sisa kewajiban <LW> menurut <AK> sebesar Rp<JB>"],
    berbeda=B("jumlah", "versi A: sisa kewajiban sesuai catatan pengaju; versi B: sisa kewajiban lebih kecil dari catatan pengaju - berselisih pada JUMLAH",
              ["sisa kewajiban <LW> menurut <AK> sebesar Rp<JB> sesuai catatan <PM>", "catatan <PM> atas <AK> menunjukkan sisa kewajiban <LW> sebesar Rp<JB>"],
              ["sisa kewajiban <LW> menurut <AK> lebih kecil dari Rp<JB> yang dicatat <PM>", "sisa kewajiban <LW> atas <AK> kurang dari Rp<JB> menurut catatan <PM>"])),
  gaya="tahu")

# ------------------------------------------------------------------ ingkar janji
T(Q("q-es-wp-sejak", "pp-es-wanprestasi-rinci", 105, "inti", "pokok",
    "Sejak tanggal berapa <LW> mulai menunggak, sudah berapa bulan tunggakannya, dan bagaimana saksi mengetahuinya ?",
    hal="awal tunggakan dan lamanya", ringkas="awal dan lama tunggakan <LW> atas <AK>",
    teks_varian=["Mulai kapan <LW> tidak membayar sesuai jadwal dan berapa lama tunggakan itu berlangsung ?"],
    melihat=["<LW> mulai menunggak angsuran <AK> sejak waktu yang tercantum dalam catatan <PM> dan tunggakan itu berlangsung hingga sekarang",
             "tunggakan <LW> atas <AK> bermula pada waktu yang tercantum dalam catatan <PM> dan berlanjut sampai sekarang",
             "sejak waktu yang tercatat dalam pembukuan <PM> <LW> menunggak angsuran <AK>",
             "catatan <PM> mencatat awal tunggakan <LW> atas <AK> dan terus berlanjut hingga kini"],
    sebagian=["<LW> sudah lama menunggak angsuran <AK>", "<LW> menunggak angsuran <AK> selama beberapa bulan"],
    berbeda=B("waktu", "versi A: tunggakan bermula pada waktu yang didalilkan; versi B: tunggakan bermula lebih akhir dari yang didalilkan - berselisih pada WAKTU",
              ["tunggakan <LW> atas <AK> bermula pada waktu yang didalilkan <PM>", "<LW> mulai menunggak angsuran <AK> pada waktu yang didalilkan <PM>"],
              ["tunggakan <LW> atas <AK> bermula lebih akhir dari yang didalilkan <PM>", "<LW> mulai menunggak angsuran <AK> lebih akhir dari yang didalilkan <PM>"])),
  gaya="lihat")

T(Q("q-es-wp-mampu", "pp-es-wanprestasi-rinci", 106, "pilihan", "pokok",
    "Apakah <LW> sebenarnya mampu membayar tetapi tidak membayar, atau menghindar dan sulit dihubungi, dan apa yang saksi lihat atau dengar ?",
    hal="kemampuan lawan membayar dan sikapnya menghindar", ringkas="kemampuan <LW> membayar dan sikapnya terhadap <PM>",
    teks_varian=["Apakah usaha atau penghasilan <LW> masih berjalan tetapi ia tetap tidak membayar ?"],
    melihat=["<LW> masih menjalankan usahanya dan memiliki penghasilan tetapi tetap tidak membayar kewajiban dalam <AK> kepada <PM>",
             "usaha <LW> berjalan seperti biasa walaupun kewajiban dalam <AK> kepada <PM> tidak dibayar",
             "<LW> menghindar dan tidak dapat dihubungi ketika <PM> menagih kewajiban dalam <AK>",
             "<LW> masih sanggup membayar tetapi tidak membayar kewajiban dalam <AK> kepada <PM>"],
    sebagian=["usaha <LW> masih berjalan sampai sekarang", "<LW> masih terlihat menjalankan usahanya"],
    berbeda=B("peristiwa", "versi A: lawan masih mampu membayar; versi B: lawan tidak mampu membayar - berselisih pada PERISTIWA",
              ["<LW> masih mampu membayar kewajiban dalam <AK>", "<LW> sanggup membayar kewajiban dalam <AK>"],
              ["<LW> tidak mampu membayar kewajiban dalam <AK>", "<LW> tidak sanggup membayar kewajiban dalam <AK>"])),
  gaya="lihat", )

T(Q("q-es-wp-sebagian", "pp-es-wanprestasi-rinci", 107, "pilihan", "pokok",
    "Apakah setelah menunggak <LW> pernah membayar sebagian, berapa kali, dan apakah pembayaran itu sudah dicatat <PM> ?",
    hal="pembayaran sebagian setelah menunggak", ringkas="pembayaran sebagian oleh <LW> setelah menunggak dan pencatatannya oleh <PM>",
    teks_varian=["Apakah <LW> masih menyicil sebagian setelah terlambat dan apakah cicilan itu tercatat di <PM> ?"],
    melihat=["setelah menunggak <LW> pernah membayar sebagian kewajiban dalam <AK> dan pembayaran itu dicatat <PM>",
             "<LW> menyicil sebagian kewajiban dalam <AK> sesudah terlambat dan <PM> mencatatnya",
             "pembayaran sebagian dari <LW> atas <AK> diterima <PM> dan tercatat dalam pembukuan",
             "<PM> mencatat cicilan sebagian dari <LW> atas <AK> setelah ia menunggak"],
    sebagian=["<LW> pernah membayar sebagian kewajiban dalam <AK>", "<LW> pernah menyicil sebagian kewajiban dalam <AK>"],
    berbeda=B("peristiwa", "versi A: lawan pernah membayar sebagian sesudah menunggak; versi B: lawan tidak pernah membayar sesudah menunggak - berselisih pada PERISTIWA",
              ["<LW> pernah membayar sebagian kewajiban dalam <AK> sesudah menunggak", "<LW> menyicil sebagian kewajiban dalam <AK> sesudah menunggak"],
              ["<LW> tidak pernah membayar kewajiban dalam <AK> sesudah menunggak", "<LW> tidak menyicil kewajiban dalam <AK> sesudah menunggak"])),
  gaya="lihat")

# ------------------------------------------------------------------ somasi dan penagihan
T(Q("q-es-somasi-ada", "pp-es-somasi", 151, "inti", "pokok",
    "Berapa kali <PM> mengirim surat peringatan atau somasi kepada <LW>, apa nomor dan tanggalnya, dan apa isinya ?",
    hal="surat peringatan atau somasi kepada lawan", ringkas="surat peringatan atau somasi <PM> kepada <LW>",
    teks_varian=["Surat peringatan apa saja yang dikirim <PM> kepada <LW> dan kapan dikirim ?"],
    melihat=["<PM> mengirim surat peringatan kepada <LW> dengan rincian <SP> dan isinya meminta kewajiban segera dipenuhi",
             "kepada <LW> telah dikirim surat peringatan oleh <PM> sebagaimana <SP> agar kewajiban dilunasi",
             "<PM> beberapa kali menegur <LW> secara tertulis dengan surat peringatan sebagaimana <SP>",
             "surat peringatan <PM> kepada <LW> tercatat pada <SP> dan memuat permintaan pelunasan"],
    mendengar=["petugas <PM> menyebut surat peringatan sebagaimana <SP> telah dikirim kepada <LW>", "petugas <PM> berkata surat peringatan sebagaimana <SP> sudah dikirim kepada <LW>",
               "petugas <PM> menerangkan <SP> sebagai surat peringatan yang sudah dikirim kepada <LW>", "petugas <PM> menegaskan <SP> sudah diterima <LW> sebagai peringatan"],
    sebagian=["<PM> pernah mengirim surat peringatan kepada <LW> sebagaimana <SP>", "kepada <LW> pernah dikirim surat peringatan oleh <PM> sebagaimana <SP>"],
    berbeda=B("jumlah", "versi A: pengaju mengirim beberapa surat peringatan; versi B: pengaju belum mengirim surat peringatan - berselisih pada JUMLAH",
              ["<PM> mengirim beberapa surat peringatan kepada <LW> sebagaimana <SP>", "kepada <LW> telah dikirim beberapa surat peringatan oleh <PM> sebagaimana <SP>"],
              ["<PM> belum mengirim surat peringatan kepada <LW> sebagaimana <SP>", "kepada <LW> belum dikirim surat peringatan oleh <PM> sebagaimana <SP>"])),
  gaya="lihat", teguran="surat-peringatan")

T(Q("q-es-somasi-diterima", "pp-es-somasi", 152, "inti", "pokok",
    "Bagaimana surat peringatan itu disampaikan kepada <LW>, siapa yang menerimanya, dan apakah ada tanda terimanya ?",
    hal="penyampaian dan penerimaan surat peringatan oleh lawan", ringkas="penyampaian dan penerimaan surat peringatan <SP> oleh <LW>",
    teks_varian=["Apakah surat peringatan sampai ke <LW> dan apakah ada bukti penerimaannya ?"],
    melihat=["surat peringatan <SP> disampaikan petugas <PM> kepada <LW> dan diterima langsung dengan tanda terima",
             "surat peringatan <SP> dikirim lewat pos tercatat kepada <LW> dan buktinya disimpan <PM>",
             "<LW> menerima surat peringatan <SP> dan membubuhkan tanda tangan sebagai tanda terima",
             "pengiriman surat peringatan <SP> kepada <LW> dibuktikan tanda terima yang disimpan <PM>"],
    sebagian=["surat peringatan <SP> sudah dikirim ke alamat <LW>", "surat peringatan <SP> disampaikan ke tempat tinggal <LW>"],
    berbeda=B("peristiwa", "versi A: surat peringatan diterima lawan; versi B: surat peringatan tidak pernah diterima lawan - berselisih pada PERISTIWA",
              ["surat peringatan <SP> diterima <LW>", "<LW> menerima surat peringatan <SP>"],
              ["surat peringatan <SP> tidak pernah diterima <LW>", "<LW> tidak pernah menerima surat peringatan <SP>"])),
  gaya="lihat", teguran="surat-peringatan")

T(Q("q-es-kunjungan", "pp-es-somasi", 153, "pilihan", "pokok",
    "Apakah petugas <PM> pernah mendatangi <LW> untuk menagih, kapan, siapa yang ditemui, dan apa tanggapannya ?",
    hal="kunjungan penagihan petugas kepada lawan", ringkas="kunjungan penagihan petugas <PM> kepada <LW>",
    teks_varian=["Apakah ada petugas <PM> yang menemui <LW> di tempat tinggal atau usahanya untuk menagih kewajiban ?"],
    melihat=["petugas <PM> mendatangi <LW> di tempat tinggal atau usahanya untuk menagih kewajiban dalam <AK> tetapi <LW> hanya berjanji akan membayar",
             "kunjungan penagihan atas <AK> oleh petugas <PM> kepada <LW> dilakukan beberapa kali dan <LW> selalu menunda",
             "petugas <PM> menemui <LW> secara langsung untuk menagih kewajiban dalam <AK> berkali-kali",
             "<LW> ditemui petugas <PM> untuk membicarakan tunggakan dalam <AK> dan menjanjikan pembayaran"],
    sebagian=["petugas <PM> pernah mendatangi <LW> untuk menagih", "petugas <PM> pernah menemui <LW> mengenai tunggakan"],
    berbeda=B("peristiwa", "versi A: petugas pengaju pernah mendatangi lawan; versi B: petugas pengaju tidak pernah mendatangi lawan - berselisih pada PERISTIWA",
              ["petugas <PM> pernah mendatangi <LW> untuk menagih", "petugas <PM> menemui <LW> untuk menagih tunggakan"],
              ["petugas <PM> tidak pernah mendatangi <LW> untuk menagih", "petugas <PM> tidak pernah menemui <LW> untuk menagih tunggakan"])),
  gaya="lihat", teguran="kunjungan-penagihan")

T(Q("q-es-restrukturisasi", "pp-es-somasi", 161, "pilihan", "pokok",
    "Apakah <PM> pernah menawarkan keringanan, penjadwalan ulang atau restrukturisasi kepada <LW>, dan bagaimana sikap <LW> ?",
    hal="tawaran restrukturisasi atau penjadwalan ulang kepada lawan", ringkas="tawaran restrukturisasi dari <PM> kepada <LW> dan sikap <LW>",
    teks_varian=["Apakah <LW> pernah diberi kesempatan menjadwal ulang pembayaran oleh <PM> dan bagaimana <LW> menanggapinya ?"],
    melihat=["<PM> menawarkan penjadwalan ulang pembayaran atas <AK> kepada <LW> tetapi kesepakatan itu tidak dipenuhi <LW>",
             "kepada <LW> pernah ditawarkan <PM> keringanan pembayaran untuk <AK> namun tidak dijalankan",
             "<PM> memberi kesempatan restrukturisasi kepada <LW> atas <AK> tetapi <LW> tidak melanjutkan pembayaran",
             "tawaran penjadwalan ulang dari <PM> atas <AK> diterima <LW> lalu tidak dijalankan"],
    sebagian=["<PM> pernah menawarkan keringanan kepada <LW> atas <AK>", "<PM> pernah menawarkan penjadwalan ulang kepada <LW> atas <AK>"],
    berbeda=B("peristiwa", "versi A: lawan menerima tawaran lalu tidak menjalankan; versi B: lawan menolak tawaran restrukturisasi - berselisih pada PERISTIWA",
              ["<LW> menerima tawaran restrukturisasi <PM> atas <AK>", "<LW> menyetujui penjadwalan ulang dari <PM> atas <AK>"],
              ["<LW> menolak tawaran restrukturisasi <PM> atas <AK>", "<LW> menolak penjadwalan ulang dari <PM> atas <AK>"])),
  gaya="lihat", teguran="restrukturisasi")

# ------------------------------------------------------------------ agunan
T(Q("q-es-jaminan-tanah", "pp-es-agunan", 181, "inti", "pokok",
    "Apa bukti hak tanah atau bangunan yang dijadikan agunan itu, atas nama siapa, di mana letaknya, dan bagaimana agunan itu diikat ?",
    hal="agunan tanah atau bangunan dan pengikatannya", ringkas="agunan tanah atau bangunan dalam <AK> dan pengikatannya",
    teks_varian=["Atas nama siapa sertipikat agunan dalam akad itu, di mana letak tanahnya, dan apakah pengikatannya dibuat resmi ?"],
    melihat=["agunan tanah dan bangunan dalam <AK> adalah <AG> dan diikat melalui pengikatan agunan yang dibuat resmi",
             "bukti hak agunan dalam <AK> adalah <AG> yang diserahkan kepada <PM> sebagai jaminan",
             "<LW> menjaminkan <AG> kepada <PM> untuk <AK> dengan surat hak asli dipegang <PM>",
             "jaminan atas <AK> berupa <AG> yang pengikatannya dilakukan secara resmi"],
    sebagian=["agunan dalam <AK> berupa <AG>", "<AG> dijadikan agunan dalam <AK>"],
    berbeda=B("peristiwa", "versi A: surat hak agunan dipegang pengaju; versi B: surat hak agunan tidak dipegang pengaju - berselisih pada PERISTIWA",
              ["surat hak <AG> dipegang <PM> sebagai agunan <AK>", "<PM> memegang surat hak <AG> sebagai agunan <AK>"],
              ["surat hak <AG> tidak dipegang <PM> sebagai agunan <AK>", "<PM> tidak memegang surat hak <AG> sebagai agunan <AK>"])),
  gaya="tahu", jaminan="ada", jenisJaminan="tanah-bangunan")

T(Q("q-es-jaminan-fidusia", "pp-es-agunan", 182, "inti", "pokok",
    "Apa merek, jenis dan nomor polisi kendaraan atau barang yang dijaminkan secara fidusia, dan siapa yang menguasainya sekarang ?",
    hal="agunan kendaraan atau barang secara fidusia", ringkas="agunan kendaraan atau barang dalam <AK> secara fidusia",
    teks_varian=["Kendaraan atau barang apa yang diserahkan sebagai jaminan fidusia dan di mana barang itu sekarang ?"],
    melihat=["kendaraan atau barang jaminan dalam <AK> adalah <AG> dan dipakai <LW> sedangkan surat kepemilikannya dipegang <PM>",
             "agunan fidusia dalam <AK> berupa <AG> yang dikuasai <LW> dengan surat dipegang <PM>",
             "<LW> menjaminkan <AG> secara fidusia kepada <PM> untuk <AK> dan barang itu masih dipakai <LW>",
             "jaminan fidusia atas <AK> berupa <AG> yang surat kepemilikannya dipegang <PM>"],
    sebagian=["agunan fidusia dalam <AK> berupa <AG>", "<AG> dijaminkan secara fidusia dalam <AK>"],
    berbeda=B("tempat", "versi A: barang jaminan dikuasai lawan; versi B: barang jaminan sudah berpindah kepada orang lain - berselisih pada TEMPAT",
              ["barang jaminan <AG> dalam <AK> dikuasai <LW>", "<AG> sebagai jaminan <AK> masih dipakai <LW>"],
              ["barang jaminan <AG> dalam <AK> sudah berpindah kepada orang lain", "<AG> sebagai jaminan <AK> sudah dipindahtangankan kepada orang lain"])),
  gaya="tahu", jaminan="ada", jenisJaminan="kendaraan-fidusia")

T(Q("q-es-jaminan-pribadi", "pp-es-agunan", 183, "inti", "pokok",
    "Apakah ada penjamin pribadi yang ikut menandatangani akad itu, siapa dia, dan apakah ia sudah ditagih ?",
    hal="penjamin pribadi dalam akad", ringkas="penjamin pribadi dalam <AK> dan penagihan kepadanya",
    teks_varian=["Siapa yang menjadi penjamin dalam akad itu dan apakah penjamin itu sudah diminta membayar ?"],
    melihat=["penjamin pribadi menandatangani <AK> bersama <LW> dan menyatakan bersedia menanggung kewajiban <LW>",
             "dalam <AK> ada penjamin yang ikut menandatangani untuk menanggung kewajiban <LW> kepada <PM>",
             "<PM> sudah menagih penjamin <LW> dalam <AK> dan penjamin itu masih menunda pembayaran",
             "penjamin <LW> dalam <AK> ikut membubuhkan tanda tangan sebagai penanggung kewajiban kepada <PM>"],
    sebagian=["ada penjamin dalam <AK> yang mengetahui kewajiban <LW>", "penjamin <LW> dalam <AK> mengetahui kewajiban <LW> kepada <PM>"],
    berbeda=B("peristiwa", "versi A: ada penjamin pribadi dalam akad; versi B: tidak ada penjamin pribadi dalam akad - berselisih pada PERISTIWA",
              ["dalam <AK> ada penjamin pribadi untuk <LW>", "<AK> memuat penjamin pribadi bagi <LW>"],
              ["dalam <AK> tidak ada penjamin pribadi untuk <LW>", "<AK> tidak memuat penjamin pribadi bagi <LW>"])),
  gaya="lihat", jaminan="ada", jenisJaminan="penjamin-pribadi")

T(Q("q-es-jaminan-nilai", "pp-es-agunan", 184, "pilihan", "pokok",
    "Berapa kira-kira nilai agunan itu dibandingkan sisa kewajiban, dan dalam keadaan apa agunan itu sekarang ?",
    hal="nilai dan keadaan agunan dibandingkan sisa kewajiban", ringkas="nilai dan keadaan <AG> dibandingkan sisa kewajiban <LW>",
    teks_varian=["Apakah nilai agunan masih mencukupi untuk melunasi kewajiban dan bagaimana kondisinya sekarang ?"],
    melihat=["nilai <AG> menurut penaksiran <PM> mencukupi untuk menutup sisa kewajiban <LW> dan kondisinya masih terjaga",
             "<AG> sebagai agunan masih bernilai cukup dibandingkan sisa kewajiban <LW> dan terawat",
             "penaksir <PM> menilai <AG> cukup untuk melunasi sisa kewajiban <LW> dan keadaannya baik",
             "dibandingkan sisa kewajiban <LW> nilai <AG> sebagai agunan masih memadai dan terpelihara"],
    sebagian=["<AG> sebagai agunan <AK> masih bernilai", "<AG> sebagai agunan <AK> masih terawat"],
    berbeda=B("jumlah", "versi A: nilai agunan mencukupi untuk sisa kewajiban; versi B: nilai agunan lebih kecil dari sisa kewajiban - berselisih pada JUMLAH (nilai)",
              ["nilai <AG> mencukupi untuk sisa kewajiban <LW>", "<AG> bernilai cukup untuk menutup sisa kewajiban <LW>"],
              ["nilai <AG> lebih kecil dari sisa kewajiban <LW>", "<AG> bernilai kurang untuk menutup sisa kewajiban <LW>"])),
  gaya="tahu", jaminan="ada")

# ------------------------------------------------------------------ denda dan kerugian
T(Q("q-es-denda", "pp-es-kerugian-rinci", 171, "inti", "pokok",
    "Apakah akad menentukan denda atau ganti rugi atas keterlambatan, berapa besarnya, dan bagaimana denda itu dihitung dan dicatat ?",
    hal="denda atau ganti rugi keterlambatan menurut akad", ringkas="denda atau ganti rugi keterlambatan menurut <AK>",
    teks_varian=["Menurut akad berapa denda keterlambatan yang dibebankan dan bagaimana perhitungannya ?"],
    melihat=["<AK> menentukan denda atas keterlambatan pembayaran dan <PM> menghitungnya sesuai ketentuan akad",
             "ketentuan denda keterlambatan dalam <AK> diterapkan <PM> kepada <LW> sesuai catatannya",
             "denda atas keterlambatan <LW> dicatat <PM> berdasarkan ketentuan dalam <AK>",
             "<PM> membebankan denda keterlambatan kepada <LW> sebagaimana ketentuan dalam <AK>"],
    sebagian=["<AK> mengatur denda keterlambatan pembayaran", "<PM> mencatat denda keterlambatan <LW> menurut <AK>"],
    berbeda=B("peristiwa", "versi A: akad menentukan denda keterlambatan; versi B: akad tidak menentukan denda keterlambatan - berselisih pada PERISTIWA",
              ["<AK> menentukan denda keterlambatan pembayaran", "dalam <AK> ada ketentuan denda keterlambatan pembayaran"],
              ["<AK> tidak menentukan denda keterlambatan pembayaran", "dalam <AK> tidak ada ketentuan denda keterlambatan pembayaran"])),
  gaya="tahu", tuntutanTambahan="denda-ganti-rugi")

T(Q("q-es-biaya-lain", "pp-es-kerugian-rinci", 172, "jarang", "pokok",
    "Apakah <PM> mengeluarkan biaya lain untuk menagih atau mengamankan agunan, berapa kira-kira, dan untuk apa ?",
    hal="biaya penagihan atau pengamanan agunan yang dikeluarkan pengaju", ringkas="biaya penagihan atau pengamanan agunan yang dikeluarkan <PM> atas <AK>",
    teks_varian=["Adakah biaya tambahan yang harus dikeluarkan <PM> karena kewajiban tidak dibayar ?"],
    melihat=["<PM> mengeluarkan biaya tambahan untuk menagih <LW> dan mengurus agunan atas <AK>",
             "biaya penagihan kewajiban <LW> atas <AK> ditanggung lebih dahulu oleh <PM>",
             "untuk mengamankan agunan atas <AK> <PM> mengeluarkan biaya yang dicatat dalam pembukuan",
             "penagihan <LW> atas <AK> menimbulkan biaya tambahan bagi <PM>"],
    sebagian=["<PM> mengeluarkan sebagian biaya penagihan atas <AK>", "<PM> menanggung sebagian biaya pengurusan agunan atas <AK>"],
    berbeda=B("jumlah", "versi A: pengaju mengeluarkan biaya tambahan; versi B: pengaju tidak mengeluarkan biaya tambahan - berselisih pada JUMLAH",
              ["<PM> mengeluarkan biaya tambahan untuk menagih <LW> atas <AK>", "penagihan <LW> atas <AK> menimbulkan biaya tambahan bagi <PM>"],
              ["<PM> tidak mengeluarkan biaya tambahan untuk menagih <LW> atas <AK>", "penagihan <LW> atas <AK> tidak menimbulkan biaya tambahan bagi <PM>"])),
  gaya="lihat")

# ------------------------------------------------------------------ klausula arbitrase
T(Q("q-es-arbitrase-ada", "pp-es-arbitrase", 191, "inti", "pokok",
    "Apakah akad memuat klausula bahwa sengketa diselesaikan lewat arbitrase, pasal berapa, dan apakah arbitrase itu pernah ditempuh ?",
    hal="klausula arbitrase dalam akad dan upaya yang sudah ditempuh", ringkas="klausula arbitrase dalam <AK> dan upaya penyelesaian yang sudah ditempuh",
    teks_varian=["Apakah dalam akad itu para pihak memilih arbitrase untuk menyelesaikan sengketa, dan sudah ditempuhkah ?"],
    melihat=["<AK> memuat klausula penyelesaian sengketa lewat arbitrase dan belum ada proses arbitrase yang ditempuh",
             "dalam <AK> para pihak memilih arbitrase untuk sengketa dan arbitrase itu belum pernah dijalankan",
             "klausula arbitrase tercantum dalam <AK> sedangkan penyelesaian lewat arbitrase belum dilakukan",
             "<AK> mencantumkan pilihan arbitrase untuk sengketa dan belum ada perkara yang diajukan ke arbitrase"],
    sebagian=["<AK> mencantumkan klausula penyelesaian sengketa", "dalam <AK> ada ketentuan penyelesaian sengketa"],
    berbeda=B("peristiwa", "versi A: akad memuat klausula arbitrase; versi B: akad tidak memuat klausula arbitrase - berselisih pada PERISTIWA",
              ["<AK> memuat klausula arbitrase", "dalam <AK> ada klausula arbitrase"],
              ["<AK> tidak memuat klausula arbitrase", "dalam <AK> tidak ada klausula arbitrase"])),
  gaya="tahu", klausulaArbitrase="ada")

T(Q("q-es-arbitrase-tidak", "pp-es-arbitrase", 192, "pilihan", "pokok",
    "Menurut akad, bagaimana sengketa diselesaikan, apakah lewat musyawarah atau Pengadilan Agama, dan apakah ada klausula arbitrase ?",
    hal="cara penyelesaian sengketa menurut akad", ringkas="cara penyelesaian sengketa menurut <AK>",
    teks_varian=["Apa yang tertulis dalam akad tentang penyelesaian sengketa jika ada perselisihan antara para pihak ?"],
    melihat=["<AK> menentukan sengketa diselesaikan lewat musyawarah lebih dahulu lalu lewat Pengadilan Agama",
             "dalam <AK> penyelesaian sengketa dilakukan dengan musyawarah kemudian Pengadilan Agama",
             "menurut <AK> perselisihan para pihak diselesaikan dengan musyawarah dan jika gagal dibawa ke Pengadilan Agama",
             "ketentuan sengketa dalam <AK> menunjuk musyawarah dan Pengadilan Agama sebagai jalan penyelesaian"],
    sebagian=["<AK> menentukan sengketa diselesaikan lewat musyawarah", "dalam <AK> ada ketentuan musyawarah untuk sengketa"],
    berbeda=B("peristiwa", "versi A: akad menunjuk Pengadilan Agama; versi B: akad menunjuk pengadilan lain - berselisih pada PERISTIWA",
              ["<AK> menunjuk Pengadilan Agama untuk menyelesaikan sengketa", "dalam <AK> sengketa diselesaikan di Pengadilan Agama"],
              ["<AK> menunjuk pengadilan lain untuk menyelesaikan sengketa", "dalam <AK> sengketa diselesaikan di pengadilan lain"])),
  gaya="tahu", klausulaArbitrase="tidak")

# ------------------------------------------------------------------ tuntutan tambahan
T(Q("q-es-sita", "pp-es-akibat", 201, "inti", "pokok",
    "Apakah ada tanda agunan atau harta <LW> akan dijual, dialihkan atau dipindahkan, dan apa yang saksi lihat atau dengar ?",
    hal="kekhawatiran agunan dijual atau dialihkan lawan", ringkas="kemungkinan agunan atau harta <LW> dijual atau dialihkan",
    teks_varian=["Apakah pernah ada pembicaraan atau tindakan <LW> menjual atau memindahkan agunan atau hartanya ?"],
    melihat=["<LW> pernah membicarakan rencana menjual agunan <AG> kepada orang lain di depan banyak orang",
             "ada pembicaraan <LW> untuk memindahtangankan <AG> sehingga agunan itu terancam berpindah tangan",
             "<LW> pernah menawarkan <AG> kepada calon pembeli di depan banyak orang",
             "<LW> diketahui berencana mengalihkan <AG> kepada pihak lain"],
    sebagian=["pernah terdengar <AG> akan dijual oleh <LW>", "ada kabar <AG> hendak dialihkan oleh <LW>"],
    berbeda=B("peristiwa", "versi A: lawan berencana menjual atau mengalihkan agunan; versi B: tidak ada rencana mengalihkan agunan - berselisih pada PERISTIWA",
              ["<LW> berencana menjual atau mengalihkan <AG>", "<LW> pernah menawarkan <AG> kepada pembeli"],
              ["<LW> tidak berencana menjual atau mengalihkan <AG>", "<LW> tidak pernah menawarkan <AG> kepada pembeli"])),
  gaya="lihat", tuntutanTambahan="sita-jaminan")

T(Q("q-es-lelang", "pp-es-akibat", 202, "inti", "pokok",
    "Apakah <LW> pernah menyatakan bersedia atau menolak agunan dijual atau dilelang untuk melunasi kewajibannya, dan kapan menyatakannya ?",
    hal="sikap lawan atas penjualan atau pelelangan agunan", ringkas="sikap <LW> atas penjualan atau pelelangan <AG>",
    teks_varian=["Bagaimana tanggapan <LW> ketika agunan hendak dijual atau dilelang untuk melunasi kewajibannya ?"],
    melihat=["<LW> pernah menyatakan bersedia agunan <AG> dijual untuk melunasi kewajibannya kepada <PM>",
             "ketika diajak berunding <LW> menyatakan agunan <AG> boleh dijual asal hasilnya melunasi <PM>",
             "<LW> menyampaikan kesediaan agunan <AG> dipakai melunasi kewajiban kepada <PM>",
             "dalam pembicaraan dengan <PM> <LW> menyetujui agunan <AG> dijual untuk pelunasan"],
    sebagian=["<LW> pernah membicarakan penjualan agunan <AG> dengan <PM>", "<LW> pernah menyinggung agunan <AG> untuk pelunasan kepada <PM>"],
    berbeda=B("peristiwa", "versi A: lawan bersedia agunan dijual; versi B: lawan menolak agunan dijual - berselisih pada PERISTIWA",
              ["<LW> bersedia agunan <AG> dijual untuk melunasi <PM>", "<LW> menyetujui agunan <AG> dijual untuk melunasi <PM>"],
              ["<LW> menolak agunan <AG> dijual untuk melunasi <PM>", "<LW> menyatakan menolak agunan <AG> dijual untuk melunasi <PM>"])),
  gaya="lihat", tuntutanTambahan="lelang-agunan")

T(Q("q-es-pengosongan", "pp-es-akibat", 203, "inti", "pokok",
    "Siapa yang menempati atau menguasai agunan itu sekarang, sejak kapan, dan apakah sudah diminta mengosongkan atau menyerahkannya ?",
    hal="penghunian agunan dan permintaan pengosongannya", ringkas="penghunian <AG> dan permintaan pengosongannya kepada <LW>",
    teks_varian=["Apakah agunan itu masih ditempati orang lain dan pernah diminta dikosongkan ?"],
    melihat=["<LW> atau keluarganya menempati <AG> sampai sekarang walaupun sudah diminta mengosongkannya",
             "sampai sekarang <AG> masih dihuni <LW> padahal <PM> sudah meminta agunan itu diserahkan",
             "<LW> terus menguasai <AG> dan menolak ketika diminta menyerahkannya kepada <PM>",
             "permintaan agar <LW> mengosongkan <AG> sudah disampaikan <PM> tetapi diabaikan"],
    sebagian=["<LW> menempati <AG> sampai sekarang", "<AG> masih dihuni <LW> sampai sekarang"],
    berbeda=B("peristiwa", "versi A: lawan sudah diminta mengosongkan agunan; versi B: lawan belum pernah diminta mengosongkan agunan - berselisih pada PERISTIWA",
              ["<LW> sudah diminta mengosongkan <AG>", "permintaan agar <LW> mengosongkan <AG> sudah disampaikan"],
              ["<LW> belum pernah diminta mengosongkan <AG>", "permintaan agar <LW> mengosongkan <AG> belum pernah disampaikan"])),
  gaya="lihat", tuntutanTambahan="pengosongan")

T(Q("q-es-kemampuan-uang-paksa", "pp-es-akibat", 204, "jarang", "pokok",
    "Bagaimana kemampuan <LW> membayar, apa pekerjaan atau usahanya sekarang, dan apakah ia memiliki harta lain yang dapat dipakai membayar ?",
    hal="kemampuan lawan membayar dan harta lainnya", ringkas="kemampuan <LW> membayar dan harta lain yang dimilikinya",
    teks_varian=["Apakah <LW> masih memiliki penghasilan atau harta yang dapat dipakai melunasi kewajibannya ?"],
    melihat=["<LW> masih bekerja dan memiliki usaha yang menghasilkan sehingga dapat membayar kewajibannya kepada <PM>",
             "penghasilan <LW> dari usahanya cukup untuk membayar kewajiban kepada <PM> dan ia memiliki harta lain",
             "<LW> masih memiliki penghasilan tetap dan harta lain yang dapat dipakai melunasi kewajiban kepada <PM>",
             "usaha <LW> masih berjalan dan menghasilkan sehingga mampu membayar kewajibannya kepada <PM>"],
    sebagian=["<LW> masih bekerja untuk menghidupi keluarganya", "usaha <LW> masih berjalan sampai sekarang"],
    berbeda=B("peristiwa", "versi A: lawan masih memiliki penghasilan dan harta; versi B: lawan sudah tidak memiliki penghasilan dan harta - berselisih pada PERISTIWA",
              ["<LW> masih memiliki penghasilan dan harta untuk membayar", "<LW> masih berpenghasilan dan berharta untuk membayar"],
              ["<LW> sudah tidak memiliki penghasilan dan harta untuk membayar", "<LW> sudah kehilangan penghasilan dan harta sehingga tidak mampu membayar"])),
  gaya="lihat", tuntutanTambahan="uang-paksa")

T(Q("q-es-serta-merta", "pp-es-akibat", 205, "jarang", "pokok",
    "Apakah akad dan surat-surat pendukungnya dibuat secara resmi dan masih asli, dan apakah <LW> pernah mengakui kewajibannya secara tertulis atau lisan ?",
    hal="keotentikan akad dan pengakuan lawan atas kewajibannya", ringkas="keaslian <AK> dan pengakuan <LW> atas kewajibannya",
    teks_varian=["Apakah <LW> pernah mengakui bahwa ia berutang menurut akad, dan apakah suratnya masih asli ?"],
    melihat=["<AK> dan surat pendukungnya dibuat secara resmi, masih asli, dan <LW> pernah mengakui kewajibannya kepada <PM>",
             "surat-surat <AK> masih asli di tangan <PM> dan <LW> mengakui kewajibannya dalam pembicaraan dengan <PM>",
             "pengakuan <LW> atas kewajiban dalam <AK> pernah disampaikan kepada <PM> dan dokumen aslinya terjaga",
             "<LW> pernah mengakui kewajiban dalam <AK> dan dokumen asli akad disimpan <PM>"],
    sebagian=["<LW> pernah mengakui kewajiban dalam <AK>", "dokumen asli <AK> disimpan <PM>"],
    berbeda=B("peristiwa", "versi A: lawan pernah mengakui kewajibannya; versi B: lawan tidak pernah mengakui kewajibannya - berselisih pada PERISTIWA",
              ["<LW> pernah mengakui kewajibannya dalam <AK>", "<LW> mengakui kewajiban dalam <AK> kepada <PM>"],
              ["<LW> tidak pernah mengakui kewajibannya dalam <AK>", "<LW> tidak mengakui kewajiban dalam <AK> kepada <PM>"])),
  gaya="lihat", tuntutanTambahan="serta-merta")

# ------------------------------------------------------------------ gugatan sederhana
T(Q("q-es-gs-domisili", "pp-es-gs", 211, "inti", "pokok",
    "Di mana <PM> dan <LW> bertempat tinggal atau berkedudukan, apakah di wilayah hukum Pengadilan Agama ini ?",
    hal="tempat tinggal atau kedudukan para pihak", ringkas="tempat tinggal atau kedudukan <PM> dan <LW>",
    teks_varian=["Apakah <PM> dan <LW> sama-sama berada di wilayah hukum Pengadilan Agama ini ?"],
    melihat=["<PM> dan <LW> bertempat tinggal atau berkedudukan di wilayah hukum Pengadilan Agama ini",
             "baik <PM> maupun <LW> berada di dalam wilayah hukum Pengadilan Agama ini",
             "tempat tinggal atau kedudukan <PM> dan <LW> sama-sama di wilayah hukum Pengadilan Agama ini",
             "<PM> dan <LW> sama-sama berdomisili di wilayah hukum Pengadilan Agama ini"],
    sebagian=["<LW> bertempat tinggal di wilayah hukum Pengadilan Agama ini", "<LW> berdomisili di wilayah hukum Pengadilan Agama ini"],
    berbeda=B("tempat", "versi A: kedua pihak berada di wilayah pengadilan ini; versi B: lawan berada di luar wilayah pengadilan ini - berselisih pada TEMPAT",
              ["<PM> dan <LW> sama-sama berada di wilayah Pengadilan Agama ini", "<LW> berada di wilayah Pengadilan Agama ini bersama <PM>"],
              ["<LW> berada di luar wilayah Pengadilan Agama ini", "<LW> bertempat tinggal di luar wilayah Pengadilan Agama ini"])),
  gaya="tahu", acara="gugatan-sederhana")

T(Q("q-es-gs-nilai", "pp-es-gs", 212, "inti", "pokok",
    "Berapa kira-kira seluruh kewajiban <LW> yang digugat, dan apakah menyangkut tanah atau hak atas tanah yang disengketakan ?",
    hal="besarnya kewajiban yang digugat dan ada tidaknya sengketa hak atas tanah", ringkas="besarnya kewajiban <LW> sebesar Rp<JB> dan ada tidaknya sengketa hak atas tanah",
    teks_varian=["Apakah gugatan hanya soal utang <LW> dan bukan sengketa kepemilikan tanah ?"],
    melihat=["kewajiban <LW> yang digugat berjumlah Rp<JB> dan perkaranya soal utang bukan sengketa kepemilikan tanah",
             "yang digugat <PM> adalah utang <LW> sebesar Rp<JB> dan bukan sengketa hak atas tanah",
             "gugatan <PM> mengenai kewajiban <LW> sebesar Rp<JB> dan bukan mengenai kepemilikan tanah",
             "nilai kewajiban <LW> dalam gugatan sebesar Rp<JB> dan tidak berkaitan dengan sengketa tanah"],
    sebagian=["kewajiban <LW> yang digugat berjumlah Rp<JB>", "yang digugat <PM> adalah utang <LW> sebesar Rp<JB>"],
    berbeda=B("jumlah", "versi A: kewajiban yang digugat berjumlah seperti dalam gugatan; versi B: kewajiban yang dibayar sudah lebih banyak dari dalam gugatan - berselisih pada JUMLAH",
              ["kewajiban <LW> yang digugat berjumlah Rp<JB> seperti dalam gugatan", "yang digugat <PM> adalah utang <LW> sebesar Rp<JB> seperti dalam gugatan"],
              ["kewajiban <LW> yang masih harus dibayar lebih kecil dari Rp<JB> dalam gugatan", "utang <LW> yang tersisa lebih sedikit dari Rp<JB> dalam gugatan"])),
  gaya="tahu", acara="gugatan-sederhana")

CATATAN = [
    "Versi 2 (21 Okt 2026): prinsip syariah pada lembaga dan akad, pengajuan dan pembuatan akad, rincian akad murabahah, mudharabah, musyarakah, ijarah, rahn, qardh dan akad lain, pencairan, angsuran dan sisa kewajiban, awal ingkar janji, surat peringatan dan restrukturisasi, agunan (tanah, fidusia, penjamin), denda, klausula arbitrase, tuntutan tambahan dan syarat gugatan sederhana ditambahkan; semua butir versi 1 dipertahankan.",
    "Pilih jenis akad, bentuk agunan dan upaya penagihan yang didalilkan pada layar agar butir yang sesuai ikut diajukan; jawaban 'berbeda' dan jawaban yang memuat titik-titik hanya kerangka: sesuaikan dengan keterangan saksi yang sesungguhnya.",
    "Saksi dari pegawai lembaga keuangan yang menerangkan catatan pembukuan menerangkan apa yang ia lihat sendiri dalam pekerjaannya; keterangan yang hanya berasal dari catatan atau cerita rekan kerja ditandai sebagai keterangan dari cerita.",
    "Rujukan gugatan sederhana (PERMA) dan PERMA 14/2016 berstatus perlu-verifikasi dan tidak tercetak; penilaian syarat gugatan sederhana ada pada hakim.",
]

PROFIL = {
    "hadir-sendiri": dict(label="Terlibat langsung dalam akad dan pembiayaan, mengetahui sendiri", peta={"*": "melihat"}),
    "pegawai-catatan": dict(label="Pegawai yang tahu dari catatan pembukuan, bukan menyaksikan kejadian", peta={"*": "melihat", "pp-es-angsuran-rinci": "melihat", "pp-es-somasi": "mendengar", "pp-es-pencairan": "melihat", "pp-es-akibat": "de-auditu"}),
    "tahu-dari-cerita": dict(label="Tahu dari cerita petugas atau nasabah", peta={"*": "de-auditu", "pp-hubungan-saksi": "melihat"}, sumber=True),
    "tahu-sebagian-es": dict(label="Hanya tahu sebagian isi akad dan tunggakan (centang hal yang diketahui)", peta={"*": "sebagian", "pp-hubungan-saksi": "melihat"}),
    "kenal-tidak-tahu-es": dict(label="Mengenal para pihak tetapi tidak tahu soal akad", peta={"*": "tidak-tahu", "pp-hubungan-saksi": "melihat"}),
    "ragu": dict(label="Ragu dan kurang ingat", peta={"*": "ragu", "pp-hubungan-saksi": "melihat"}),
}


def BLANGKO_PERBAIKAN(kat):
    """blangkoBas: variabel saksi diperbaiki menurut berkas BAS Derry yang sungguh ada di server (21 Okt 2026) dan berkas yang belum tercantum ditambahkan."""
    nyata = {
        ("10 Ekonomi Syariah - BAS", "BAS ALUR 40 ES GS - [2] Sidang 2 - P & T Hadir - Pembuktian, Tunda Putusan"): ["5058", "5059"],
        ("10 Ekonomi Syariah - BAS", "BAS ALUR 40 ES GS - [2a] Sidang 2 - T Tetap Tidak Hadir - Bukti dan Putusan Verstek"): ["5058", "5059"],
        ("10a Ekonomi Syariah Biasa - BAS", "BAS ALUR 04 [6] BAS 6 P & T Hadir - Pembuktian P"): ["5058", "5059"],
        ("10a Ekonomi Syariah Biasa - BAS", "BAS ALUR 04 [7] BAS 7 P & T Hadir - Pembuktian T"): ["6120", "6121"],
        ("10a Ekonomi Syariah Biasa - BAS", "BAS ALUR 43 ES Acara Biasa - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek"): ["5058", "5059"],
    }
    for b in kat["blangkoBas"]:
        k = (b["folder"], b["berkas"])
        if k in nyata:
            b["variabelSaksi"] = nyata[k]
            b["catatan"] = (b.get("catatan", "") + "; variabel saksi disesuaikan dengan berkas BAS Derry di server (TanyaJwb Saksi 1 dan 2)").lstrip("; ")
    ada = {(b["folder"], b["berkas"]) for b in kat["blangkoBas"]}
    tambah = [
        ("10a Ekonomi Syariah Biasa - BAS", "BAS ALUR 04 [6a] BAS 6 P & T Hadir - Pembuktian P (3 Saksi)", ["5058", "5059", "5060"], "acara biasa: 3 saksi pengaju"),
        ("10a Ekonomi Syariah Biasa - BAS", "BAS ALUR 04 [6b] BAS 6 P & T Hadir - Pembuktian P (4 Saksi)", ["5058", "5059", "5060", "6124"], "acara biasa: 4 saksi pengaju"),
        ("10a Ekonomi Syariah Biasa - BAS", "BAS ALUR 04 [6c] BAS 6 P & T Hadir - Pembuktian P (5 Saksi)", ["5058", "5059", "5060", "6124", "8931"], "acara biasa: 5 saksi pengaju"),
        ("10a Ekonomi Syariah Biasa - BAS", "BAS ALUR 04 [7a] BAS 7 P & T Hadir - Pembuktian T (3 Saksi)", ["6120", "6121", "8921"], "acara biasa: 3 saksi lawan"),
        ("10a Ekonomi Syariah Biasa - BAS", "BAS ALUR 04 [7b] BAS 7 P & T Hadir - Pembuktian T (4 Saksi)", ["6120", "6121", "8921", "8941"], "acara biasa: 4 saksi lawan"),
    ]
    for f, nama, var, cat in tambah:
        if (f, nama) not in ada:
            kat["blangkoBas"].append({"folder": f, "berkas": nama, "variabelSaksi": var, "catatan": cat})


if __name__ == "__main__":
    v1 = json.load(open(os.path.join(L.V1, "ekonomi-syariah.json"), encoding="utf8"))
    kat = L.bangun(v1, sys.modules[__name__], PETA)
    p = L.tulis(kat, "ekonomi-syariah")
    print("ekonomi-syariah: pertanyaan %d -> %d, pokok %d -> %d, keadaan %d -> %d, dasar %d -> %d" % (
        len(v1["pertanyaan"]), len(kat["pertanyaan"]), len(v1["pokokPembuktian"]), len(kat["pokokPembuktian"]), len(v1["keadaan"]), len(kat["keadaan"]), len(v1["dasarHukum"]), len(kat["dasarHukum"])))
    print(L.periksa(p))
