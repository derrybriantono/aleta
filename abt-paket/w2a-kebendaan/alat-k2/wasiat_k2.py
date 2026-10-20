# -*- coding: utf-8 -*-
"""
Katalog saksi WASIAT versi 2 (agen W2a-K2, 20-21 Okt 2026). Menambah pokok, pertanyaan, keadaan, dasar hukum dan profil pengetahuan saksi
tanpa menghapus apa pun dari versi 1 (abt-paket/w2a-kebendaan/katalog-v1-k2/wasiat.json).
Pakai: python wasiat_k2.py  (menulis ekstensi-sipp/saksi-katalog/wasiat.json lalu memeriksanya)
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import k2lib as L
from k2lib import Q, B, Daftar

# <PWS> pewasiat (Almarhum/Almarhumah + nama) | <PM> pengaju | <LW> lawan | <OBJ> objek | <BTK> bentuk dan tanggal | <TRM> penerima
PETA = {"_g": "x", "PWS": "#2026# #1025#", "PM": "#0046#", "LW": "#0047#", "OBJ": "#9479#", "BTK": "#9478#", "TRM": "#9481#"}
D = DAFTAR = Daftar()
T = D.tambah

SUMBER_KHI = "KHI lampiran Inpres 1/1991: bunyi dicocokkan antara digitalisasi pasal.id dan naskah Depag (referensi/KHI-pasal-terverifikasi.md, VERIFIKASI-HUKUM 18 Okt 2026)"
SUMBER_OCR = "KHI lampiran Inpres 1/1991, naskah Depag hasil pindai (referensi/_unduhan/khi/khi.txt) dibaca 20 Okt 2026; BELUM dicocokkan dengan digitalisasi pasal.id sehingga belum tercetak"

DASAR_BARU = [
    dict(id="dh-khi-175", rujukan="Pasal 175 Kompilasi Hukum Islam", uraian="kewajiban ahli waris terhadap pewaris: mengurus jenazah sampai selesai pemakaman, menyelesaikan hutang dan menagih piutang, menyelesaikan wasiat, dan membagi harta warisan; tanggung jawab terhadap hutang terbatas pada nilai harta peninggalan", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-171h", rujukan="Pasal 171 huruf e, f dan h Kompilasi Hukum Islam", uraian="harta warisan adalah harta bawaan ditambah bagian dari harta bersama setelah dikurangi keperluan pewaris selama sakit, biaya pengurusan jenazah, hutang dan pemberian untuk kerabat; wasiat adalah pemberian benda dari pewaris kepada orang lain atau lembaga yang berlaku setelah pewaris meninggal; anak angkat adalah anak yang pemeliharaan dan biaya pendidikannya beralih kepada orang tua angkat berdasarkan putusan Pengadilan", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-198", rujukan="Pasal 198 Kompilasi Hukum Islam", uraian="wasiat yang berupa hasil dari suatu benda ataupun pemanfaatan suatu benda harus diberikan jangka waktu tertentu", status="perlu-verifikasi", sumber=SUMBER_OCR),
    dict(id="dh-khi-199", rujukan="Pasal 199 Kompilasi Hukum Islam", uraian="pewasiat dapat mencabut wasiatnya selama calon penerima wasiat belum menyatakan persetujuannya atau sudah menyatakan persetujuan tetapi kemudian menarik kembali; pencabutan wasiat lisan dapat dilakukan lisan dengan dua orang saksi, tertulis dengan dua orang saksi atau dengan akta Notaris; wasiat tertulis hanya dapat dicabut secara tertulis dengan dua orang saksi atau akta Notaris; wasiat dengan akta Notaris hanya dapat dicabut dengan akta Notaris", status="perlu-verifikasi", sumber=SUMBER_OCR),
    dict(id="dh-khi-207-208", rujukan="Pasal 207 dan Pasal 208 Kompilasi Hukum Islam", uraian="wasiat tidak diperbolehkan kepada orang yang melakukan pelayanan perawatan bagi pewasiat dan kepada orang yang memberi tuntunan kerohanian sewaktu pewasiat menderita sakit hingga meninggalnya, kecuali ditentukan dengan tegas dan jelas untuk membalas jasanya; wasiat tidak berlaku bagi Notaris dan saksi-saksi pembuat akta tersebut", status="perlu-verifikasi", sumber=SUMBER_OCR),
]

POKOK_BARU = [
    dict(id="pp-ws-keabsahan", judul="Dalil cacat keabsahan wasiat", uraian="dalil yang mempersoalkan keabsahan wasiat: pewasiat sudah meninggal sebelum wasiat dibuat, tanda tangan atau cap jempol bukan milik pewasiat, adanya tekanan, atau benda yang diwasiatkan sudah musnah", dasarHukum=["dh-syarat-pewasiat", "dh-batal", "dh-beban-bukti"], wajib=False),
    dict(id="pp-ws-syarat-penerima", judul="Syarat dan keadaan penerima wasiat", uraian="penerima wasiat masih hidup ketika pewasiat meninggal, mengetahui dan menerima wasiat, bukan orang yang merawat pewasiat tanpa penegasan, dan tidak melakukan perbuatan yang membatalkan wasiat", dasarHukum=["dh-sebutkan-penerima", "dh-batal", "dh-khi-207-208"], wajib=False),
    dict(id="pp-ws-pencabutan", judul="Pencabutan wasiat", uraian="wasiat dicabut atau tidak dicabut oleh pewasiat sampai meninggal, dan cara pencabutannya", dasarHukum=["dh-khi-199"], wajib=False),
    dict(id="pp-ws-pelaksanaan", judul="Pemberitahuan dan pelaksanaan wasiat setelah pewasiat meninggal", uraian="ahli waris diberi tahu tentang wasiat, benda wasiat diserahkan atau dikuasai siapa, dan hasilnya dinikmati siapa", dasarHukum=["dh-wasiat-definisi", "dh-khi-175"], wajib=False),
    dict(id="pp-ws-hutang-ahliwaris", judul="Hutang pewasiat dan ahli waris yang lain", uraian="hutang dan kewajiban pewasiat yang lebih dahulu diselesaikan serta ahli waris lain yang berkepentingan atas wasiat", dasarHukum=["dh-khi-175", "dh-khi-171h"], wajib=False),
    dict(id="pp-ws-benda-detail", judul="Bukti hak, keberadaan dan jangka waktu benda wasiat", uraian="bukti kepemilikan benda yang diwasiatkan, masih adanya benda itu dan jangka waktu bila wasiat berupa hasil atau manfaat", dasarHukum=["dh-hak-pewasiat", "dh-batal", "dh-khi-198"], wajib=False),
]

KEADAAN_BARU = {
    "kondisiPewasiat": dict(sumber="borang", nilai=["sehat", "sakit-menjelang-wafat", "akal-dipersoalkan"], bawaan="sehat", label="Keadaan pewasiat ketika membuat wasiat",
                            labelNilai={"sehat": "Sehat jasmani dan akalnya", "sakit-menjelang-wafat": "Sakit dan tidak lama kemudian meninggal dunia", "akal-dipersoalkan": "Kesehatan akal atau ingatannya dipersoalkan"}),
    "persetujuan": dict(sumber="borang", nilai=["tidak-dipersoalkan", "disetujui-semua", "ada-yang-menolak", "belum-dimintai"], bawaan="tidak-dipersoalkan", label="Persetujuan ahli waris atas wasiat",
                        labelNilai={"tidak-dipersoalkan": "Persetujuan tidak dipersoalkan", "disetujui-semua": "Semua ahli waris menyetujui", "ada-yang-menolak": "Ada ahli waris yang menolak", "belum-dimintai": "Persetujuan ahli waris belum pernah diminta"}),
    "pencabutan": dict(sumber="borang", nilai=["tidak-dicabut", "dicabut"], bawaan="tidak-dicabut", label="Pencabutan wasiat oleh pewasiat",
                       labelNilai={"tidak-dicabut": "Tidak pernah dicabut", "dicabut": "Pernah dicabut atau diubah"}),
    "jenisObjek": dict(sumber="borang", nilai=["tanah-bangunan", "uang-tabungan", "benda-bergerak", "manfaat-hasil"], jamak=True, bawaan=[], label="Jenis benda yang diwasiatkan",
                       labelNilai={"tanah-bangunan": "Tanah atau bangunan", "uang-tabungan": "Uang atau tabungan", "benda-bergerak": "Benda bergerak (kendaraan, perhiasan, ternak)", "manfaat-hasil": "Hasil atau manfaat suatu benda"}),
    "tuntutanTambahan": dict(sumber="borang", nilai=["ganti-rugi", "sita-jaminan", "uang-paksa"], jamak=True, bawaan=[], label="Tuntutan tambahan dalam gugatan",
                             labelNilai={"ganti-rugi": "Ganti kerugian atas penguasaan benda", "sita-jaminan": "Sita jaminan atas benda wasiat", "uang-paksa": "Uang paksa"}),
    "dalilCacat": dict(sumber="borang", nilai=["pewasiat-sudah-wafat", "tanda-tangan-dipalsukan", "ada-tekanan", "penerima-berbuat-jahat", "penerima-perawat", "objek-musnah"], jamak=True, bawaan=[], label="Dalil yang mempersoalkan keabsahan wasiat",
                   labelNilai={"pewasiat-sudah-wafat": "Pewasiat sudah meninggal sebelum wasiat dibuat", "tanda-tangan-dipalsukan": "Tanda tangan atau cap jempol bukan milik pewasiat", "ada-tekanan": "Pewasiat ditekan atau dipaksa", "penerima-berbuat-jahat": "Penerima wasiat melakukan perbuatan yang membatalkan wasiat", "penerima-perawat": "Penerima wasiat adalah perawat atau pemberi tuntunan kerohanian pewasiat", "objek-musnah": "Benda yang diwasiatkan sudah musnah"}),
}

# ------------------------------------------------------------------ pewasiat
T(Q("q-ws-umur", "pp-syarat-pewasiat", 41, "pilihan", "pokok",
    "Berapa umur <PWS> ketika membuat wasiat itu, apakah sudah dewasa ?",
    hal="umur pewasiat ketika membuat wasiat", ringkas="umur <PWS> ketika membuat wasiat itu",
    teks_varian=["Apakah <PWS> sudah dewasa ketika menyatakan wasiatnya, kira-kira berapa umurnya waktu itu ?"],
    melihat=["<PWS> sudah dewasa dan umurnya lebih dari dua puluh satu tahun ketika membuat wasiat itu",
             "ketika wasiat itu dibuat <PWS> sudah berumur lebih dari dua puluh satu tahun",
             "umur <PWS> pada waktu membuat wasiat itu sudah melewati dua puluh satu tahun",
             "<PWS> telah dewasa dengan umur lebih dari dua puluh satu tahun saat wasiat itu dibuat"],
    sebagian=["<PWS> sudah dewasa ketika membuat wasiat itu", "umur <PWS> ketika membuat wasiat itu sudah dewasa"],
    berbeda=B("jumlah", "versi A: pewasiat sudah berumur lebih dari dua puluh satu tahun; versi B: pewasiat belum berumur dua puluh satu tahun - berselisih pada JUMLAH (umur)",
              ["<PWS> sudah berumur lebih dari dua puluh satu tahun ketika membuat wasiat itu", "umur <PWS> pada waktu membuat wasiat itu sudah melewati dua puluh satu tahun"],
              ["<PWS> belum berumur dua puluh satu tahun ketika membuat wasiat itu", "umur <PWS> pada waktu membuat wasiat itu belum sampai dua puluh satu tahun"])),
  gaya="tahu")

T(Q("q-ws-sehat-akal", "pp-syarat-pewasiat", 42, "pilihan", "pokok",
    "Apakah <PWS> sehat akal dan ingatannya ketika membuat wasiat itu, dan bagaimana saksi mengetahuinya ?",
    hal="kesehatan akal pewasiat ketika membuat wasiat", ringkas="kesehatan akal dan ingatan <PWS> ketika membuat wasiat",
    teks_varian=["Bagaimana keadaan pikiran dan ingatan <PWS> ketika menyatakan wasiatnya, apakah ia berbicara dengan jelas ?"],
    melihat=["<PWS> sehat akalnya dan ingatannya baik ketika membuat wasiat itu sehingga ia berbicara dengan jelas dan mengerti isi wasiatnya",
             "ketika wasiat itu dibuat <PWS> sadar sepenuhnya serta mengerti apa yang dikatakannya",
             "pada waktu berwasiat <PWS> berpikir jernih dan dapat menjelaskan sendiri isi wasiatnya",
             "<PWS> dalam keadaan sadar dan berakal sehat ketika menyampaikan wasiatnya kepada orang di sekitarnya"],
    sebagian=["<PWS> tampak sadar ketika membuat wasiat itu", "<PWS> berbicara dengan jelas ketika membuat wasiat itu"],
    berbeda=B("peristiwa", "versi A: pewasiat sehat akalnya; versi B: pewasiat tidak sadar atau pikun - berselisih pada PERISTIWA (keadaan akal)",
              ["<PWS> sehat akalnya ketika membuat wasiat itu dan mengerti isi wasiatnya", "ketika wasiat itu dibuat <PWS> sadar sepenuhnya dan mengerti apa yang dikatakannya"],
              ["<PWS> tidak sehat akalnya ketika membuat wasiat itu dan tidak mengerti isi wasiatnya", "ketika wasiat itu dibuat <PWS> tidak sadar sepenuhnya dan tidak mengerti apa yang dikatakannya"])),
  gaya="tahu")

T(Q("q-ws-sakit-wafat", "pp-syarat-pewasiat", 43, "inti", "pokok",
    "Apakah <PWS> sedang sakit ketika membuat wasiat itu, sakit apa, dan berapa lama sesudah itu ia meninggal dunia ?",
    hal="sakit pewasiat ketika membuat wasiat dan waktu meninggalnya", ringkas="sakit <PWS> ketika membuat wasiat dan jarak waktu sampai ia meninggal dunia",
    teks_varian=["Bagaimana kesehatan <PWS> pada saat wasiat itu dibuat dan kapan ia meninggal dunia setelah itu ?"],
    melihat=["<PWS> sedang sakit ketika membuat wasiat itu dan meninggal dunia pada tanggal #1246# karena #1247#",
             "ketika berwasiat <PWS> dalam keadaan sakit dan meninggal dunia pada tanggal #1246# karena #1247#",
             "sakit <PWS> sudah berlangsung saat wasiat itu dibuat dan ia meninggal dunia pada tanggal #1246# karena #1247#",
             "pada waktu wasiat itu dibuat <PWS> sedang menderita sakit hingga meninggal dunia pada tanggal #1246# karena #1247#"],
    sebagian=["<PWS> sedang sakit ketika membuat wasiat itu dan meninggal dunia pada tanggal #1246#", "ketika berwasiat <PWS> dalam keadaan sakit dan meninggal dunia pada tanggal #1246#"],
    berbeda=B("lama", "versi A: pewasiat meninggal tidak lama setelah wasiat dibuat; versi B: pewasiat meninggal lama sesudah wasiat dibuat - berselisih pada LAMA",
              ["<PWS> meninggal dunia tidak lama setelah membuat wasiat itu", "tidak lama setelah wasiat itu dibuat <PWS> meninggal dunia"],
              ["<PWS> baru meninggal dunia lama sesudah membuat wasiat itu", "lama sesudah wasiat itu dibuat barulah <PWS> meninggal dunia"])),
  gaya="tahu", kondisiPewasiat="sakit-menjelang-wafat")

T(Q("q-ws-akal-dipersoalkan", "pp-syarat-pewasiat", 44, "inti", "pokok",
    "Apakah menjelang membuat wasiat itu <PWS> pernah lupa ingatan, pikun atau berperilaku tidak wajar ?",
    hal="keadaan ingatan pewasiat menjelang membuat wasiat", ringkas="keadaan ingatan dan perilaku <PWS> menjelang membuat wasiat",
    teks_varian=["Apakah <PWS> pernah menunjukkan tanda pikun atau tidak mengenali orang di sekitarnya sebelum atau ketika membuat wasiat itu ?"],
    melihat=["<PWS> sering linglung dan tidak mengenali orang di sekitarnya menjelang membuat wasiat itu",
             "menjelang wasiat itu dibuat <PWS> sudah pikun dan berperilaku tidak wajar",
             "sebelum wasiat itu dibuat pikiran <PWS> sudah kacau dan ia tidak lagi mengenali keluarganya",
             "<PWS> tampak pikun dan sering tidak mengerti keadaan sekitarnya sewaktu wasiat itu dibuat"],
    sebagian=["<PWS> sering linglung menjelang membuat wasiat itu", "menjelang wasiat itu dibuat <PWS> sudah tampak pikun"],
    berbeda=B("peristiwa", "versi A: pewasiat tidak pernah pikun; versi B: pewasiat sudah pikun - berselisih pada PERISTIWA (keadaan ingatan)",
              ["<PWS> tidak pernah linglung atau pikun menjelang membuat wasiat itu", "menjelang wasiat itu dibuat <PWS> tidak pernah berperilaku aneh"],
              ["<PWS> sering linglung dan pikun menjelang membuat wasiat itu", "menjelang wasiat itu dibuat <PWS> sudah berperilaku aneh"])),
  gaya="tahu", kondisiPewasiat="akal-dipersoalkan")

T(Q("q-ws-tanpa-paksaan", "pp-syarat-pewasiat", 45, "pilihan", "pokok",
    "Apakah <PWS> membuat wasiat itu atas kehendaknya sendiri tanpa paksaan dari siapa pun ?",
    hal="kehendak bebas pewasiat tanpa paksaan", ringkas="kehendak <PWS> membuat wasiat tanpa paksaan",
    teks_varian=["Apakah ada yang memaksa atau menekan <PWS> ketika ia membuat wasiat itu ?"],
    melihat=["<PWS> membuat wasiat itu atas kehendaknya sendiri tanpa paksaan dari siapa pun",
             "wasiat itu lahir dari kemauan <PWS> sendiri tanpa ada orang yang memaksanya",
             "tidak ada paksaan dari siapa pun karena <PWS> sendiri yang menginginkan wasiat itu",
             "<PWS> menyatakan wasiat itu dengan sukarela tanpa tekanan dari pihak mana pun"],
    sebagian=["<PWS> menyatakan wasiat itu dengan kemauannya sendiri", "wasiat itu lahir dari kehendak <PWS> sendiri"],
    berbeda=B("peristiwa", "versi A: wasiat dibuat tanpa paksaan; versi B: pewasiat dipaksa atau ditekan - berselisih pada PERISTIWA",
              ["<PWS> membuat wasiat itu atas kehendaknya sendiri tanpa paksaan dari siapa pun", "wasiat itu lahir dari kemauan <PWS> sendiri tanpa ada orang yang memaksanya"],
              ["<PWS> membuat wasiat itu karena dipaksa oleh orang lain tanpa kehendak yang bebas", "wasiat itu dibuat <PWS> setelah ditekan oleh orang di sekitarnya tanpa kemauan sendiri"])),
  gaya="tahu")

T(Q("q-ws-ada-tekanan", "pp-ws-keabsahan", 46, "tambahan", "pokok",
    "Siapa yang mendesak atau menekan <PWS> agar membuat wasiat itu, bagaimana caranya, dan apa yang saksi lihat atau dengar sendiri ?",
    hal="tekanan terhadap pewasiat agar membuat wasiat", ringkas="tekanan pihak lain terhadap <PWS> agar membuat wasiat",
    teks_varian=["Apakah ada orang yang memaksa, mengancam atau mendesak <PWS> sehingga wasiat itu dibuat ?"],
    melihat=["<TRM> mendesak <PWS> agar membuat wasiat atas <OBJ> dan ia menurutinya karena takut",
             "<PWS> ditekan oleh <TRM> sampai bersedia membuat wasiat atas <OBJ>",
             "wasiat atas <OBJ> dibuat <PWS> setelah didesak terus-menerus oleh <TRM>",
             "<TRM> memaksa <PWS> menyatakan wasiat atas <OBJ> dan ia terpaksa menurutinya"],
    berbeda=B("pelaku", "versi A: penerima wasiat menekan pewasiat; versi B: wasiat dibuat tanpa tekanan penerima wasiat - berselisih pada PELAKU",
              ["<TRM> menekan <PWS> agar membuat wasiat atas <OBJ>", "<PWS> didesak oleh <TRM> sampai membuat wasiat atas <OBJ>"],
              ["<TRM> tidak pernah menekan <PWS> dalam membuat wasiat atas <OBJ>", "<PWS> membuat wasiat atas <OBJ> tanpa desakan dari <TRM>"])),
  gaya="lihat", dalilCacat="ada-tekanan")

T(Q("q-ws-wafat-sebelum", "pp-ws-keabsahan", 47, "inti", "pokok",
    "Apakah <PWS> masih hidup pada tanggal wasiat itu dibuat, dan kapan ia meninggal dunia ?",
    hal="masih hidupnya pewasiat pada saat wasiat dibuat", ringkas="masih hidupnya <PWS> pada saat wasiat itu dibuat",
    teks_varian=["Pada saat wasiat itu dibuat apakah <PWS> masih hidup, dan pada tanggal berapa ia meninggal dunia ?"],
    melihat=["<PWS> masih hidup pada saat wasiat itu dibuat dan meninggal dunia pada tanggal #1246# sesudahnya",
             "ketika wasiat itu dibuat <PWS> masih hidup dan baru meninggal dunia pada tanggal #1246#",
             "wasiat itu dibuat saat <PWS> masih hidup dan wafat sesudahnya pada tanggal #1246#",
             "pada hari wasiat itu dibuat <PWS> masih ada dan meninggal dunia kemudian pada tanggal #1246#"],
    sebagian=["<PWS> masih hidup pada saat wasiat itu dibuat", "ketika wasiat itu dibuat <PWS> masih hidup"],
    berbeda=B("waktu", "versi A: pewasiat masih hidup ketika wasiat dibuat; versi B: pewasiat sudah meninggal dunia sebelum wasiat dibuat - berselisih pada WAKTU",
              ["<PWS> masih hidup ketika wasiat itu dibuat dan meninggal dunia sesudahnya", "wasiat itu dibuat pada saat <PWS> masih hidup dan wafat sesudahnya"],
              ["<PWS> sudah meninggal dunia sebelum wasiat itu dibuat", "wasiat itu dibuat ketika <PWS> sudah wafat lebih dahulu"])),
  gaya="tahu", dalilCacat="pewasiat-sudah-wafat")

T(Q("q-ws-ttd-asli", "pp-ws-keabsahan", 48, "inti", "pokok",
    "Apakah tanda tangan atau cap jempol pada surat wasiat itu benar milik <PWS>, dan bagaimana saksi mengetahuinya ?",
    hal="keaslian tanda tangan atau cap jempol pewasiat", ringkas="keaslian tanda tangan atau cap jempol <PWS> pada surat wasiat",
    teks_varian=["Apakah saksi mengenal tanda tangan <PWS> dan apakah tanda tangan pada surat wasiat itu sama dengannya ?"],
    melihat=["tanda tangan pada surat wasiat itu sama dengan tanda tangan <PWS> yang dikenal keluarga dan dibubuhkan olehnya sendiri",
             "<PWS> sendiri yang membubuhkan tanda tangan pada surat wasiat itu dan tanda tangannya sama dengan yang biasa dipakainya",
             "tanda tangan di surat wasiat itu benar milik <PWS> karena sama dengan tanda tangan yang sering dipakainya",
             "cap jempol atau tanda tangan pada surat wasiat itu dibubuhkan <PWS> sendiri dan dilihat banyak orang"],
    sebagian=["tanda tangan pada surat wasiat itu mirip dengan tanda tangan <PWS>", "tanda tangan di surat wasiat itu sama dengan tanda tangan <PWS> yang biasa dipakainya"],
    berbeda=B("pelaku", "versi A: tanda tangan dibubuhkan pewasiat sendiri; versi B: tanda tangan dibubuhkan orang lain - berselisih pada PELAKU",
              ["<PWS> sendiri yang membubuhkan tanda tangan pada surat wasiat itu", "tanda tangan pada surat wasiat itu dibubuhkan oleh <PWS> sendiri"],
              ["tanda tangan pada surat wasiat itu dibubuhkan oleh orang lain bukan <PWS>", "yang membubuhkan tanda tangan pada surat wasiat itu orang lain dan bukan <PWS>"])),
  gaya="campur", dalilCacat="tanda-tangan-dipalsukan")

# ------------------------------------------------------------------ bentuk wasiat
T(Q("q-ws-lisan-ucapan", "pp-bentuk-wasiat", 51, "inti", "pokok",
    "Apa yang diucapkan <PWS> ketika menyatakan wasiatnya secara lisan, dan siapa yang mendengarnya ?",
    hal="ucapan wasiat lisan dari pewasiat", ringkas="ucapan wasiat lisan <PWS> yang didengar oleh orang di sekitarnya",
    teks_varian=["Bagaimana bunyi ucapan wasiat <PWS> secara lisan dan siapa saja yang hadir mendengarnya ?"],
    melihat=["<PWS> mengucapkan sendiri wasiatnya bahwa <OBJ> diberikan kepada <TRM> dan ucapan itu didengar oleh dua orang saksi",
             "dengan lisan <PWS> menyatakan <OBJ> diwasiatkan kepada <TRM> di depan dua orang saksi",
             "ucapan wasiat <PWS> tentang <OBJ> untuk <TRM> terdengar jelas oleh dua orang saksi yang hadir",
             "<PWS> berpesan secara lisan bahwa <OBJ> menjadi milik <TRM> setelah ia meninggal dunia dan pesan itu didengar dua orang saksi"],
    mendengar=["<PWS> menyatakan bahwa <OBJ> diwasiatkan kepada <TRM>", "<PWS> mengatakan <OBJ> menjadi milik <TRM> setelah ia meninggal dunia",
               "<PWS> berpesan agar <OBJ> diberikan kepada <TRM> setelah ia meninggal dunia", "<PWS> menegaskan <OBJ> diwasiatkan untuk <TRM>"],
    sebagian=["<PWS> mengucapkan wasiat atas <OBJ> secara lisan", "<PWS> berwasiat secara lisan tentang <OBJ>"],
    berbeda=B("peristiwa", "versi A: wasiat diucapkan lisan di depan dua orang saksi; versi B: tidak ada ucapan wasiat yang didengar saksi - berselisih pada PERISTIWA",
              ["<PWS> mengucapkan wasiatnya secara lisan di depan dua orang saksi", "wasiat lisan <PWS> didengar oleh dua orang saksi yang hadir"],
              ["<PWS> tidak pernah mengucapkan wasiat secara lisan di depan saksi", "wasiat lisan <PWS> tidak pernah didengar oleh saksi mana pun"])),
  gaya="lihat", bentukWasiat="lisan")

T(Q("q-ws-saksi-bersama", "pp-bentuk-wasiat", 62, "pilihan", "pokok",
    "Apakah kedua saksi wasiat hadir bersamaan ketika <PWS> menyampaikan atau menandatangani wasiatnya ?",
    hal="kehadiran dua orang saksi wasiat secara bersamaan", ringkas="kehadiran kedua saksi wasiat secara bersamaan ketika wasiat dibuat",
    teks_varian=["Apakah dua orang saksi itu berada di tempat yang sama pada saat <PWS> membuat wasiatnya ?"],
    melihat=["kedua saksi wasiat hadir bersamaan di tempat yang sama ketika <PWS> membuat wasiatnya",
             "dua orang saksi wasiat itu sama-sama berada di depan <PWS> ketika wasiat dibuat",
             "ketika <PWS> membuat wasiat kedua saksi hadir sekaligus dan menyaksikannya",
             "pada saat wasiat dibuat <PWS> dikelilingi dua orang saksi yang hadir bersamaan"],
    sebagian=["salah seorang saksi wasiat hadir ketika <PWS> membuat wasiatnya", "seorang dari saksi wasiat itu hadir ketika <PWS> membuat wasiatnya"],
    berbeda=B("jumlah", "versi A: dua orang saksi hadir bersamaan; versi B: hanya satu orang saksi hadir - berselisih pada JUMLAH (saksi yang hadir)",
              ["dua orang saksi hadir bersamaan ketika <PWS> membuat wasiatnya", "kedua saksi wasiat sama-sama hadir ketika <PWS> membuat wasiatnya"],
              ["hanya satu orang saksi yang hadir ketika <PWS> membuat wasiatnya", "saksi wasiat yang hadir ketika <PWS> membuat wasiatnya hanya seorang"])),
  gaya="lihat")

T(Q("q-ws-saksi-hubungan", "pp-bentuk-wasiat", 63, "pilihan", "pokok",
    "Apa hubungan kedua saksi wasiat dengan <PWS> dan dengan penerima wasiat, apakah salah satunya penerima wasiat atau ahli waris ?",
    hal="hubungan saksi wasiat dengan pewasiat dan penerima wasiat", ringkas="hubungan kedua saksi wasiat dengan <PWS> dan <TRM>",
    teks_varian=["Apakah kedua saksi wasiat itu penerima wasiat atau ahli waris <PWS> ?"],
    melihat=["kedua saksi wasiat itu tidak termasuk penerima wasiat dan bukan ahli waris <PWS>",
             "dua orang saksi wasiat itu tidak mempunyai hubungan waris dengan <PWS> dan tidak menerima wasiat",
             "saksi wasiat yang hadir itu tidak menerima apa pun dari wasiat <PWS> dan tidak termasuk ahli warisnya",
             "kedua saksi wasiat tidak ikut menerima wasiat <PWS> dan tidak berhak atas warisannya"],
    sebagian=["salah satu saksi wasiat itu tidak termasuk ahli waris <PWS>", "seorang saksi wasiat itu tidak menerima apa pun dari wasiat <PWS>"],
    berbeda=B("peristiwa", "versi A: saksi wasiat bukan penerima wasiat dan bukan ahli waris; versi B: salah satu saksi wasiat adalah penerima wasiat - berselisih pada PERISTIWA",
              ["kedua saksi wasiat itu tidak termasuk penerima wasiat dan bukan ahli waris <PWS>", "dua orang saksi wasiat itu bukan penerima wasiat dan tidak mempunyai hubungan waris dengan <PWS>"],
              ["salah satu saksi wasiat itu adalah <TRM> yang menerima wasiat <PWS>", "seorang dari saksi wasiat itu justru <TRM> yang menerima wasiat <PWS>"])),
  gaya="tahu")

T(Q("q-ws-tertulis-penulis", "pp-bentuk-wasiat", 53, "inti", "pokok",
    "Siapa yang menulis surat wasiat itu, apakah <PWS> sendiri atau orang lain atas permintaannya, dan di mana ditulis ?",
    hal="penulis surat wasiat dan tempat penulisannya", ringkas="orang yang menulis surat wasiat <PWS> dan tempat penulisannya",
    teks_varian=["Surat wasiat <PWS> itu ditulis tangan atau diketik, dan siapa yang membuatkannya ?"],
    melihat=["surat wasiat itu ditulis oleh <PWS> sendiri dengan tangannya pada tanggal sebagaimana tertera dalam <BTK>",
             "<PWS> menulis sendiri surat wasiatnya di hadapan orang-orang sekitarnya sebagaimana tertera dalam <BTK>",
             "penulis surat wasiat itu adalah <PWS> sendiri sebagaimana waktunya tertera dalam <BTK>",
             "surat wasiat itu dibuat <PWS> dengan tulisannya sendiri sebagaimana tertera dalam <BTK>"],
    sebagian=["surat wasiat <PWS> ditulis sesuai <BTK>", "surat wasiat <PWS> dibuat sebagaimana tertera dalam <BTK>"],
    berbeda=B("pelaku", "versi A: surat wasiat ditulis pewasiat sendiri; versi B: surat wasiat ditulis orang lain - berselisih pada PELAKU",
              ["surat wasiat itu ditulis oleh <PWS> sendiri sesuai <BTK>", "<PWS> sendiri yang menulis surat wasiat itu sesuai <BTK>"],
              ["surat wasiat itu ditulis oleh orang lain bukan <PWS> sesuai <BTK>", "yang menulis surat wasiat itu orang lain dan bukan <PWS> sesuai <BTK>"])),
  gaya="lihat", bentukWasiat="tertulis")

T(Q("q-ws-tertulis-ttd", "pp-bentuk-wasiat", 54, "inti", "pokok",
    "Apakah <PWS> menandatangani atau membubuhkan cap jempol pada surat wasiat itu di hadapan dua orang saksi ?",
    hal="penandatanganan surat wasiat di hadapan dua orang saksi", ringkas="penandatanganan surat wasiat oleh <PWS> di hadapan dua orang saksi",
    teks_varian=["Apakah dua orang saksi melihat <PWS> membubuhkan tanda tangan atau cap jempol pada surat wasiat itu ?"],
    melihat=["<PWS> menandatangani surat wasiat itu di hadapan dua orang saksi yang ikut membubuhkan tanda tangan",
             "di depan dua orang saksi <PWS> membubuhkan tanda tangan pada surat wasiatnya",
             "surat wasiat itu ditandatangani <PWS> ketika dua orang saksi hadir menyaksikannya",
             "<PWS> menandatangani wasiatnya dengan disaksikan dua orang saksi yang juga menandatanganinya"],
    sebagian=["<PWS> menandatangani surat wasiat itu", "surat wasiat itu ditandatangani <PWS>"],
    berbeda=B("peristiwa", "versi A: pewasiat menandatangani wasiat di depan dua saksi; versi B: wasiat ditandatangani tanpa saksi - berselisih pada PERISTIWA",
              ["<PWS> menandatangani surat wasiat itu di hadapan dua orang saksi", "surat wasiat itu ditandatangani <PWS> ketika dua orang saksi hadir"],
              ["<PWS> menandatangani surat wasiat itu tanpa dihadiri saksi", "surat wasiat itu ditandatangani <PWS> tanpa ada saksi yang hadir"])),
  gaya="lihat", bentukWasiat="tertulis")

T(Q("q-ws-surat-asli", "pp-bentuk-wasiat", 55, "pilihan", "pokok",
    "Di mana surat wasiat asli <PWS> disimpan, siapa yang memegangnya, dan apakah saksi pernah melihat atau membacanya ?",
    hal="penyimpanan surat wasiat asli", ringkas="penyimpanan surat wasiat <PWS> yang asli",
    teks_varian=["Siapa yang menyimpan surat wasiat <PWS> yang asli dan apakah saksi pernah melihatnya ?"],
    melihat=["surat wasiat asli <PWS> disimpan oleh <TRM> dan isinya pernah dibaca oleh keluarga",
             "yang memegang surat wasiat asli <PWS> adalah <TRM> dan isinya pernah dibaca keluarga",
             "surat wasiat asli <PWS> berada di tangan <TRM> dan pernah diperlihatkan kepada keluarga",
             "<TRM> menyimpan surat wasiat asli <PWS> yang isinya pernah dilihat keluarga"],
    sebagian=["surat wasiat asli <PWS> pernah terlihat oleh keluarga yang menyimpannya <TRM>", "keluarga pernah melihat surat wasiat asli <PWS> yang disimpan <TRM>"],
    berbeda=B("tempat", "versi A: surat wasiat asli disimpan penerima wasiat; versi B: surat wasiat asli disimpan orang lain - berselisih pada TEMPAT penyimpanan",
              ["surat wasiat asli <PWS> disimpan oleh <TRM>", "yang memegang surat wasiat asli <PWS> adalah <TRM>"],
              ["surat wasiat asli <PWS> disimpan oleh orang lain bukan <TRM>", "yang memegang surat wasiat asli <PWS> adalah orang lain dan bukan <TRM>"])),
  gaya="campur", bentukWasiat="tertulis")

T(Q("q-ws-notaris-akta", "pp-bentuk-wasiat", 56, "inti", "pokok",
    "Apakah <PWS> menghadap Notaris untuk membuat wasiat itu, di mana dan kapan, dan apakah akta wasiat itu dibacakan kepadanya ?",
    hal="pembuatan wasiat di hadapan Notaris", ringkas="pembuatan wasiat <PWS> di hadapan Notaris",
    teks_varian=["Bagaimana <PWS> membuat wasiat dengan akta Notaris, apakah ia datang sendiri dan apakah akta itu dibacakan ?"],
    melihat=["<PWS> datang sendiri menghadap Notaris untuk membuat wasiat sebagaimana tertera dalam <BTK> dan aktanya dibacakan kepadanya",
             "di kantor Notaris <PWS> menyatakan wasiatnya sebagaimana tertera dalam <BTK> dan akta itu dibacakan sebelum ditandatangani",
             "wasiat <PWS> dibuat di hadapan Notaris sebagaimana tertera dalam <BTK> dan ia hadir sendiri",
             "<PWS> menghadap Notaris sendiri sebagaimana tertera dalam <BTK> dan menandatangani akta wasiat setelah dibacakan"],
    sebagian=["<PWS> menghadap Notaris untuk membuat wasiat sesuai <BTK>", "wasiat <PWS> dibuat di kantor Notaris sesuai <BTK>"],
    berbeda=B("peristiwa", "versi A: pewasiat sendiri menghadap Notaris; versi B: pewasiat tidak pernah menghadap Notaris - berselisih pada PERISTIWA",
              ["<PWS> datang sendiri menghadap Notaris untuk membuat wasiat sesuai <BTK>", "<PWS> sendiri yang menghadap Notaris untuk membuat wasiat sesuai <BTK>"],
              ["<PWS> tidak pernah menghadap Notaris untuk membuat wasiat sesuai <BTK>", "<PWS> tidak pernah datang ke kantor Notaris untuk membuat wasiat sesuai <BTK>"])),
  gaya="lihat", bentukWasiat="akta-notaris")

T(Q("q-ws-notaris-nomor", "pp-bentuk-wasiat", 57, "pilihan", "pokok",
    "Apa nomor dan tanggal akta wasiat <PWS> itu, siapa Notaris yang membuatnya, dan di mana aktanya disimpan ?",
    hal="nomor tanggal akta wasiat dan Notaris pembuatnya", ringkas="nomor dan tanggal akta wasiat serta Notaris yang membuatnya",
    teks_varian=["Akta wasiat <PWS> dibuat Notaris siapa, bernomor berapa, dan di mana aktanya tersimpan ?"],
    melihat=["akta wasiat <PWS> dibuat oleh Notaris sebagaimana tertera dalam <BTK> dan salinannya disimpan oleh ahli waris",
             "nomor dan tanggal akta wasiat <PWS> tertera dalam <BTK> dan salinannya sudah diterima ahli waris",
             "notaris yang membuat akta wasiat <PWS> tertera dalam <BTK> dan salinan aktanya ada pada ahli waris",
             "akta wasiat <PWS> dibuat Notaris sesuai <BTK> dan salinannya dipegang ahli waris"],
    sebagian=["akta wasiat <PWS> dibuat oleh Notaris sesuai <BTK>", "wasiat <PWS> dituangkan dalam akta Notaris sesuai <BTK>"],
    berbeda=B("peristiwa", "versi A: akta wasiat dibuat Notaris sesuai isian perkara; versi B: tidak ada akta wasiat dari Notaris - berselisih pada PERISTIWA",
              ["akta wasiat <PWS> dibuat oleh Notaris sesuai <BTK>", "wasiat <PWS> dituangkan dalam akta Notaris sesuai <BTK>"],
              ["tidak ada akta wasiat <PWS> yang dibuat oleh Notaris sesuai <BTK>", "wasiat <PWS> tidak pernah dituangkan dalam akta Notaris sesuai <BTK>"])),
  gaya="tahu", bentukWasiat="akta-notaris")

# ------------------------------------------------------------------ benda yang diwasiatkan
T(Q("q-ws-objek-bukti", "pp-ws-benda-detail", 81, "pilihan", "pokok",
    "Apa bukti kepemilikan benda yang diwasiatkan itu, misalnya sertipikat, akta jual beli atau surat lain, dan atas nama siapa ?",
    hal="bukti kepemilikan benda yang diwasiatkan", ringkas="bukti kepemilikan <OBJ> atas nama <PWS>",
    teks_varian=["Atas nama siapa bukti hak atas benda yang diwasiatkan itu dan surat apa yang menjadi buktinya ?"],
    melihat=["bukti hak atas <OBJ> tercatat atas nama <PWS> dan surat buktinya pernah diperlihatkan",
             "<OBJ> dibuktikan dengan surat yang tercatat atas nama <PWS> dan surat itu pernah diperlihatkan kepada keluarga",
             "surat hak atas <OBJ> memang atas nama <PWS> sebagaimana yang terlihat pada suratnya",
             "kepemilikan <PWS> atas <OBJ> dibuktikan surat yang dilihat keluarga sendiri"],
    sebagian=["<OBJ> sejak lama dikenal sebagai milik <PWS>", "<OBJ> sejak lama dikuasai <PWS> sebagai pemiliknya"],
    berbeda=B("peristiwa", "versi A: bukti hak atas benda tercatat atas nama pewasiat; versi B: bukti hak atas benda tercatat atas nama orang lain - berselisih pada PERISTIWA",
              ["bukti hak atas <OBJ> tercatat atas nama <PWS>", "surat hak atas <OBJ> memang atas nama <PWS>"],
              ["bukti hak atas <OBJ> tercatat atas nama orang lain bukan <PWS>", "surat hak atas <OBJ> bukan atas nama <PWS> melainkan orang lain"])),
  gaya="campur")

T(Q("q-ws-objek-musnah", "pp-ws-benda-detail", 82, "tambahan", "pokok",
    "Apakah <OBJ> yang diwasiatkan itu masih ada, atau sudah musnah, rusak, dijual atau berpindah tangan sebelum <PWS> meninggal dunia ?",
    hal="masih adanya benda yang diwasiatkan sampai pewasiat meninggal", ringkas="keberadaan <OBJ> sampai <PWS> meninggal dunia",
    teks_varian=["Sampai <PWS> meninggal dunia apakah <OBJ> masih ada atau sudah musnah atau berpindah tangan ?"],
    melihat=["<OBJ> sudah musnah sebelum <PWS> meninggal dunia dan tidak ada lagi bendanya",
             "sebelum <PWS> meninggal dunia <OBJ> telah hilang dan tidak dapat diserahkan lagi",
             "<OBJ> rusak berat sebelum <PWS> meninggal dunia sehingga tidak ada lagi yang dapat diserahkan",
             "benda wasiat berupa <OBJ> sudah tidak ada ketika <PWS> meninggal dunia"],
    sebagian=["<OBJ> sudah rusak sebelum <PWS> meninggal dunia", "sebelum <PWS> meninggal dunia <OBJ> sudah berkurang"],
    berbeda=B("peristiwa", "versi A: benda wasiat masih ada sampai pewasiat meninggal; versi B: benda wasiat sudah musnah sebelum pewasiat meninggal - berselisih pada PERISTIWA",
              ["<OBJ> masih ada sampai <PWS> meninggal dunia", "sampai <PWS> wafat <OBJ> masih utuh"],
              ["<OBJ> sudah musnah sebelum <PWS> meninggal dunia", "sebelum <PWS> wafat <OBJ> sudah hilang"])),
  gaya="lihat", dalilCacat="objek-musnah")

T(Q("q-ws-manfaat-jangka", "pp-ws-benda-detail", 83, "inti", "pokok",
    "Wasiat itu berupa hasil atau manfaat benda, untuk jangka waktu berapa lama, dan apa yang saksi ketahui tentangnya ?",
    hal="jangka waktu wasiat berupa hasil atau manfaat benda", ringkas="jangka waktu wasiat berupa hasil atau manfaat <OBJ>",
    teks_varian=["Berapa lama penerima wasiat berhak menikmati hasil atau manfaat benda yang diwasiatkan itu ?"],
    melihat=["wasiat <PWS> berupa hasil atau manfaat <OBJ> bagi <TRM> dan jangka waktunya ditentukan sebagaimana tertera dalam <BTK>",
             "<PWS> mewasiatkan manfaat <OBJ> kepada <TRM> untuk jangka waktu tertentu sebagaimana tertera dalam <BTK>",
             "hasil <OBJ> diwasiatkan <PWS> kepada <TRM> selama waktu yang ditentukannya sebagaimana tertera dalam <BTK>",
             "<PWS> membatasi hak <TRM> atas manfaat <OBJ> pada jangka waktu tertentu sebagaimana tertera dalam <BTK>"],
    sebagian=["<PWS> mewasiatkan hasil <OBJ> kepada <TRM>", "<PWS> mewasiatkan manfaat <OBJ> kepada <TRM>"],
    berbeda=B("lama", "versi A: manfaat benda diwasiatkan untuk jangka waktu tertentu; versi B: tidak ada jangka waktu yang ditentukan - berselisih pada LAMA",
              ["<PWS> mewasiatkan manfaat <OBJ> untuk jangka waktu tertentu", "hasil <OBJ> diwasiatkan <PWS> selama waktu yang ditentukan"],
              ["<PWS> mewasiatkan manfaat <OBJ> tanpa menentukan jangka waktu", "hasil <OBJ> diwasiatkan <PWS> tanpa batas waktu yang ditentukan"])),
  gaya="tahu", jenisObjek="manfaat-hasil")

# ------------------------------------------------------------------ penerima wasiat
T(Q("q-ws-penerima-hidup", "pp-ws-syarat-penerima", 91, "inti", "pokok",
    "Apakah penerima wasiat masih hidup ketika <PWS> meninggal dunia ?",
    hal="masih hidupnya penerima wasiat ketika pewasiat meninggal", ringkas="masih hidupnya <TRM> ketika <PWS> meninggal dunia",
    teks_varian=["Apakah pada saat <PWS> wafat, penerima wasiat masih hidup ?"],
    melihat=["<TRM> masih hidup ketika <PWS> meninggal dunia dan ikut hadir dalam pemakamannya",
             "pada saat <PWS> wafat <TRM> sebagai penerima wasiat masih hidup dan berada di sekitar keluarga",
             "ketika <PWS> meninggal dunia <TRM> masih ada dan dapat dijumpai oleh keluarga",
             "sampai <PWS> meninggal dunia <TRM> sebagai penerima wasiat masih hidup"],
    sebagian=["<TRM> masih hidup ketika <PWS> meninggal dunia", "pada saat <PWS> wafat <TRM> masih hidup"],
    berbeda=B("peristiwa", "versi A: penerima wasiat masih hidup ketika pewasiat meninggal; versi B: penerima wasiat sudah meninggal lebih dahulu - berselisih pada PERISTIWA",
              ["<TRM> masih hidup ketika <PWS> meninggal dunia", "pada saat <PWS> wafat <TRM> masih hidup"],
              ["<TRM> sudah meninggal dunia lebih dahulu sebelum <PWS> meninggal dunia", "sebelum <PWS> wafat <TRM> sudah wafat lebih dahulu"])),
  gaya="tahu")

T(Q("q-ws-penerima-tahu", "pp-ws-syarat-penerima", 92, "pilihan", "pokok",
    "Apakah penerima wasiat mengetahui adanya wasiat itu, sejak kapan, dan apakah ia menerimanya ?",
    hal="pengetahuan dan sikap penerima wasiat atas wasiat itu", ringkas="pengetahuan dan penerimaan <TRM> atas wasiat <PWS>",
    teks_varian=["Sejak kapan penerima wasiat mengetahui wasiat itu dan bagaimana sikapnya, menerima atau menolak ?"],
    melihat=["<TRM> mengetahui adanya wasiat <PWS> dan menyatakan menerimanya di depan keluarga",
             "<TRM> sudah tahu isi wasiat <PWS> dan menerima wasiat itu dengan senang hati",
             "sejak wasiat <PWS> diketahui <TRM> menyatakan bersedia menerimanya",
             "<TRM> memberitahukan bahwa ia menerima wasiat <PWS> setelah mengetahuinya"],
    sebagian=["<TRM> mengetahui adanya wasiat <PWS>", "<TRM> sudah mendengar tentang wasiat <PWS>"],
    berbeda=B("peristiwa", "versi A: penerima wasiat menerima wasiat; versi B: penerima wasiat menolak wasiat - berselisih pada PERISTIWA",
              ["<TRM> menerima wasiat <PWS> setelah mengetahuinya", "<TRM> menyatakan menerima wasiat <PWS> di depan keluarga"],
              ["<TRM> menolak wasiat <PWS> setelah mengetahuinya", "<TRM> menyatakan menolak wasiat <PWS> di depan keluarga"])),
  gaya="campur")

T(Q("q-ws-penerima-ahliwaris", "pp-ws-syarat-penerima", 93, "inti", "pokok",
    "Apakah penerima wasiat itu termasuk ahli waris <PWS>, dan apa hubungan keluarganya dengannya ?",
    hal="kedudukan penerima wasiat sebagai ahli waris pewasiat", ringkas="kedudukan <TRM> sebagai ahli waris <PWS>",
    teks_varian=["Apakah penerima wasiat adalah anak, istri, suami, orang tua atau saudara <PWS> yang berhak mewarisi ?"],
    melihat=["<TRM> termasuk ahli waris <PWS> karena masih terikat hubungan darah atau perkawinan dengannya",
             "<TRM> adalah ahli waris yang berhak mewarisi harta <PWS> karena hubungan keluarganya",
             "sebagai keluarga dekat <TRM> termasuk ahli waris yang berhak atas warisan <PWS>",
             "hubungan darah atau perkawinan <TRM> dengan <PWS> menjadikannya ahli waris pewasiat"],
    sebagian=["<TRM> masih keluarga dekat <PWS>", "<TRM> mempunyai hubungan keluarga dengan <PWS>"],
    berbeda=B("peristiwa", "versi A: penerima wasiat adalah ahli waris pewasiat; versi B: penerima wasiat bukan ahli waris pewasiat - berselisih pada PERISTIWA",
              ["<TRM> adalah ahli waris <PWS>", "<TRM> termasuk ahli waris yang berhak atas warisan <PWS>"],
              ["<TRM> bukan ahli waris <PWS>", "<TRM> tidak termasuk ahli waris yang berhak atas warisan <PWS>"])),
  gaya="tahu", penerima="ahli-waris")

T(Q("q-ws-penerima-lembaga", "pp-ws-syarat-penerima", 94, "inti", "pokok",
    "Lembaga apa yang ditunjuk menerima wasiat itu, untuk kegiatan apa, dan siapa pengurusnya ?",
    hal="lembaga penerima wasiat dan kegiatannya", ringkas="lembaga penerima wasiat dari <PWS> dan kegiatannya",
    teks_varian=["Wasiat itu diberikan kepada lembaga mana dan untuk keperluan apa ?"],
    melihat=["<PWS> menunjuk lembaga <TRM> sebagai penerima wasiat untuk kegiatan keagamaan dan sosial",
             "wasiat <PWS> diberikan kepada lembaga <TRM> yang pengurusnya dikenal keluarga",
             "penerima wasiat <PWS> adalah lembaga <TRM> yang menggunakannya untuk kegiatan kebaikan",
             "lembaga <TRM> ditunjuk <PWS> dengan jelas sebagai penerima wasiat untuk kegiatan umat"],
    sebagian=["lembaga <TRM> ditunjuk <PWS> sebagai penerima wasiat", "<PWS> menunjuk lembaga <TRM> sebagai penerima wasiatnya"],
    berbeda=B("peristiwa", "versi A: lembaga ditunjuk dengan jelas sebagai penerima; versi B: tidak ada lembaga yang ditunjuk secara jelas - berselisih pada PERISTIWA",
              ["<PWS> menunjuk lembaga <TRM> sebagai penerima wasiat dengan jelas", "lembaga <TRM> ditunjuk <PWS> dengan jelas sebagai penerima wasiat"],
              ["<PWS> tidak menunjuk lembaga <TRM> sebagai penerima wasiat dengan jelas", "lembaga <TRM> tidak ditunjuk <PWS> dengan jelas sebagai penerima wasiat"])),
  gaya="campur", penerima="lembaga")

T(Q("q-ws-penerima-perawat", "pp-ws-syarat-penerima", 95, "tambahan", "pokok",
    "Apakah penerima wasiat adalah orang yang merawat <PWS> ketika sakit atau yang memberinya tuntunan kerohanian, dan sejak kapan ?",
    hal="penerima wasiat sebagai perawat atau pemberi tuntunan kerohanian pewasiat", ringkas="peran <TRM> sebagai perawat atau pemberi tuntunan kerohanian <PWS>",
    teks_varian=["Apakah penerima wasiat yang mengurus dan merawat <PWS> selama sakit sampai meninggal dunia ?"],
    melihat=["<TRM> yang merawat <PWS> selama sakit sampai meninggal dunia dan juga membimbingnya dalam ibadah",
             "selama <PWS> sakit <TRM> yang mengurus kebutuhannya setiap hari hingga ia wafat",
             "<TRM> mendampingi dan merawat <PWS> pada masa sakitnya sampai meninggal dunia",
             "pada waktu <PWS> sakit <TRM> yang memberinya perawatan dan tuntunan kerohanian"],
    sebagian=["<TRM> sering menjenguk dan membantu merawat <PWS> ketika sakit", "<TRM> ikut merawat <PWS> ketika sakit"],
    berbeda=B("pelaku", "versi A: penerima wasiat yang merawat pewasiat; versi B: orang lain yang merawat pewasiat - berselisih pada PELAKU",
              ["<TRM> yang merawat <PWS> selama sakit sampai meninggal dunia", "selama <PWS> sakit <TRM> yang mengurus kebutuhannya setiap hari"],
              ["selama <PWS> sakit yang merawatnya orang lain bukan <TRM>", "yang mengurus kebutuhan <PWS> selama sakit orang lain dan bukan <TRM>"])),
  gaya="lihat", dalilCacat="penerima-perawat")

T(Q("q-ws-penerima-jahat", "pp-ws-syarat-penerima", 96, "tambahan", "pokok",
    "Apakah penerima wasiat pernah menganiaya, memfitnah atau menghalangi <PWS> membuat atau mengubah wasiat, dan apakah ia pernah dihukum karenanya ?",
    hal="perbuatan penerima wasiat terhadap pewasiat yang dapat membatalkan wasiat", ringkas="perbuatan <TRM> terhadap <PWS> yang dipersoalkan sebagai pembatal wasiat",
    teks_varian=["Apakah ada putusan pengadilan yang menghukum penerima wasiat karena berbuat jahat kepada <PWS> ?"],
    melihat=["<TRM> pernah menghalangi <PWS> mengubah wasiatnya dengan kekerasan atau ancaman",
             "<TRM> melarang <PWS> mencabut wasiat itu dengan kekerasan atau ancaman",
             "<TRM> pernah mengancam <PWS> agar wasiat itu dipertahankan",
             "<TRM> menghalangi <PWS> mengubah wasiat itu di tempat tinggalnya"],
    sebagian=["<TRM> pernah berselisih dengan <PWS> tentang wasiat itu", "<TRM> pernah bertengkar dengan <PWS> karena wasiat itu"],
    berbeda=B("peristiwa", "versi A: penerima wasiat pernah menghalangi pewasiat mengubah wasiat; versi B: penerima wasiat tidak pernah menghalanginya - berselisih pada PERISTIWA",
              ["<TRM> pernah menghalangi <PWS> mengubah wasiatnya", "<TRM> pernah melarang <PWS> mencabut wasiat itu"],
              ["<TRM> tidak pernah menghalangi <PWS> mengubah wasiatnya", "<TRM> tidak pernah melarang <PWS> mencabut wasiat itu"])),
  gaya="lihat", dalilCacat="penerima-berbuat-jahat")

# ------------------------------------------------------------------ persetujuan dan batas sepertiga
T(Q("q-ws-setuju-bentuk", "pp-persetujuan-ahli-waris", 101, "inti", "pokok",
    "Bagaimana para ahli waris menyatakan persetujuannya atas wasiat itu, secara lisan, tertulis atau di hadapan Notaris, dan siapa saja yang menyetujui ?",
    hal="cara dan pihak yang menyatakan persetujuan ahli waris atas wasiat", ringkas="cara ahli waris <PWS> menyatakan persetujuan atas wasiat itu",
    teks_varian=["Siapa saja ahli waris yang menyetujui wasiat itu dan apakah persetujuan itu diucapkan di depan dua orang saksi atau ditulis ?"],
    melihat=["seluruh ahli waris <PWS> menyatakan setuju atas wasiat itu di depan dua orang saksi yang hadir",
             "semua ahli waris menyetujui wasiat <PWS> dengan pernyataan yang diucapkan di hadapan dua orang saksi",
             "persetujuan semua ahli waris atas wasiat <PWS> dituangkan dalam pernyataan di depan dua orang saksi",
             "ahli waris <PWS> menyatakan persetujuannya atas wasiat itu secara bersama-sama di depan dua orang saksi"],
    mendengar=["semua ahli waris <PWS> menyatakan setuju atas wasiat itu", "seluruh ahli waris <PWS> berkata menyetujui wasiat itu",
               "ahli waris <PWS> mengucapkan persetujuannya atas wasiat itu", "para ahli waris <PWS> menyatakan berkenan atas wasiat itu"],
    sebagian=["sebagian ahli waris <PWS> menyatakan setuju atas wasiat itu", "beberapa ahli waris <PWS> menyetujui wasiat itu di depan keluarga"],
    berbeda=B("jumlah", "versi A: semua ahli waris menyetujui; versi B: ada ahli waris yang tidak menyetujui - berselisih pada JUMLAH (ahli waris yang menyetujui)",
              ["semua ahli waris <PWS> menyetujui wasiat itu", "seluruh ahli waris <PWS> menyatakan setuju atas wasiat itu"],
              ["ada ahli waris <PWS> yang tidak menyetujui wasiat itu", "tidak semua ahli waris <PWS> menyatakan setuju atas wasiat itu"])),
  gaya="lihat", persetujuan="disetujui-semua")

T(Q("q-ws-setuju-tolak", "pp-persetujuan-ahli-waris", 102, "inti", "pokok",
    "Siapa ahli waris yang tidak menyetujui wasiat itu, apa alasannya, dan kapan ia menyatakannya ?",
    hal="ahli waris yang menolak wasiat dan alasannya", ringkas="ahli waris <PWS> yang tidak menyetujui wasiat itu dan alasannya",
    teks_varian=["Adakah ahli waris yang berkeberatan atas wasiat itu dan apa yang disampaikannya ?"],
    melihat=["ada ahli waris <PWS> yang tidak menyetujui wasiat itu dan menyatakan keberatannya di depan keluarga",
             "tidak semua ahli waris <PWS> setuju dan keberatan itu disampaikan dengan jelas di depan keluarga",
             "salah seorang ahli waris <PWS> tidak menerima wasiat itu dan alasannya disampaikan terang-terangan",
             "sebagian ahli waris <PWS> tidak setuju atas wasiat itu dan menyampaikan keberatannya kepada keluarga lain"],
    sebagian=["ada ahli waris <PWS> yang tidak menyetujui wasiat itu", "seorang ahli waris <PWS> tidak menyetujui wasiat itu"],
    berbeda=B("peristiwa", "versi A: ada ahli waris yang menolak wasiat; versi B: semua ahli waris menyetujui wasiat - berselisih pada PERISTIWA",
              ["ada ahli waris <PWS> yang tidak menyetujui wasiat itu", "salah seorang ahli waris <PWS> tidak menerima wasiat itu"],
              ["semua ahli waris <PWS> menyetujui wasiat itu", "seluruh ahli waris <PWS> setuju atas wasiat itu"])),
  gaya="lihat", persetujuan="ada-yang-menolak")

T(Q("q-ws-setuju-belum", "pp-persetujuan-ahli-waris", 103, "inti", "pokok",
    "Apakah ahli waris <PWS> pernah dimintai persetujuan atas wasiat itu, oleh siapa, dan apa tanggapan mereka ?",
    hal="permintaan persetujuan kepada ahli waris atas wasiat", ringkas="permintaan persetujuan kepada ahli waris <PWS> atas wasiat itu",
    teks_varian=["Apakah ahli waris <PWS> diberi tahu dan diminta setuju sebelum wasiat itu dilaksanakan ?"],
    melihat=["ahli waris <PWS> tidak pernah dimintai persetujuan atas wasiat itu oleh siapa pun",
             "tidak pernah ada permintaan persetujuan kepada ahli waris <PWS> sebelum wasiat itu dilaksanakan",
             "ahli waris <PWS> tidak diberi tahu soal persetujuan atas wasiat itu sebelum dilaksanakan",
             "tidak ada yang meminta ahli waris <PWS> menyetujui wasiat itu sebelum dilaksanakan"],
    sebagian=["sebagian ahli waris <PWS> tidak pernah dimintai persetujuan atas wasiat itu", "beberapa ahli waris <PWS> tidak diminta menyetujui wasiat itu"],
    berbeda=B("peristiwa", "versi A: ahli waris tidak pernah dimintai persetujuan; versi B: ahli waris sudah dimintai persetujuan - berselisih pada PERISTIWA",
              ["ahli waris <PWS> tidak pernah dimintai persetujuan atas wasiat itu", "tidak ada yang meminta ahli waris <PWS> menyetujui wasiat itu"],
              ["ahli waris <PWS> sudah dimintai persetujuan atas wasiat itu", "ada yang meminta ahli waris <PWS> menyetujui wasiat itu"])),
  gaya="tahu", persetujuan="belum-dimintai")

T(Q("q-ws-harta-total", "pp-batas-sepertiga", 112, "pilihan", "pokok",
    "Berapa kira-kira seluruh harta <PWS> ketika meninggal dunia, dan berapa nilai benda yang diwasiatkan dibandingkan seluruh harta itu ?",
    hal="perbandingan nilai benda wasiat dengan seluruh harta pewasiat", ringkas="perbandingan nilai <OBJ> dengan seluruh harta <PWS>",
    teks_varian=["Berapa nilai seluruh harta <PWS> dan berapa bagian yang diwasiatkan kepada penerima ?"],
    melihat=["nilai <OBJ> yang diwasiatkan sebanding dengan sebagian besar seluruh harta <PWS> yang diketahui keluarga",
             "perbandingan <OBJ> dengan seluruh harta <PWS> cukup besar sebagaimana diketahui keluarga",
             "harta <PWS> seluruhnya diketahui keluarga dan <OBJ> menempati bagian yang besar di dalamnya",
             "dibandingkan seluruh harta <PWS> nilai <OBJ> sangat besar menurut pengetahuan keluarga"],
    sebagian=["<OBJ> merupakan sebagian dari harta <PWS>", "<OBJ> termasuk harta penting milik <PWS>"],
    berbeda=B("jumlah", "versi A: nilai benda wasiat sebanding dengan sebagian besar harta pewasiat; versi B: nilai benda wasiat hanya sebagian kecil - berselisih pada JUMLAH (nilai)",
              ["<OBJ> merupakan sebagian besar dari seluruh harta <PWS>", "nilai <OBJ> mencapai bagian yang besar dari harta <PWS>"],
              ["<OBJ> hanya merupakan sebagian kecil dari seluruh harta <PWS>", "nilai <OBJ> hanya bagian yang kecil dari harta <PWS>"])),
  gaya="tahu")

# ------------------------------------------------------------------ ahli waris dan hutang
T(Q("q-ws-ahli-waris-lain", "pp-ws-hutang-ahliwaris", 121, "pilihan", "pokok",
    "Siapa saja ahli waris <PWS> yang masih hidup selain pihak dalam perkara ini, dan apakah mereka mengetahui adanya wasiat itu ?",
    hal="ahli waris pewasiat yang lain dan pengetahuan mereka tentang wasiat", ringkas="ahli waris <PWS> yang lain dan pengetahuan mereka tentang wasiat itu",
    teks_varian=["Apakah ada ahli waris <PWS> yang lain yang berkepentingan atas wasiat itu dan sudah mengetahuinya ?"],
    melihat=["ahli waris <PWS> yang lain masih hidup dan semuanya mengetahui adanya wasiat itu",
             "selain <PM> dan <LW> masih ada ahli waris <PWS> lain yang mengetahui wasiat itu",
             "keluarga <PWS> yang berhak mewarisi masih ada dan sudah mendengar tentang wasiat itu",
             "ahli waris <PWS> lainnya mengetahui wasiat itu sejak ia meninggal dunia"],
    sebagian=["ahli waris <PWS> yang lain masih hidup", "selain <PM> dan <LW> masih ada ahli waris <PWS> lain"],
    berbeda=B("jumlah", "versi A: masih ada ahli waris lain yang mengetahui wasiat; versi B: tidak ada ahli waris lain yang mengetahui wasiat - berselisih pada JUMLAH (ahli waris lain)",
              ["masih ada ahli waris <PWS> lain yang mengetahui wasiat itu", "ahli waris <PWS> yang lain mengetahui adanya wasiat itu"],
              ["tidak ada ahli waris <PWS> lain yang mengetahui wasiat itu", "ahli waris <PWS> yang lain tidak mengetahui adanya wasiat itu"])),
  gaya="tahu")

T(Q("q-ws-hutang", "pp-ws-hutang-ahliwaris", 122, "jarang", "pokok",
    "Apakah <PWS> meninggalkan hutang atau biaya pengurusan jenazah, dan sudah diselesaikan atau belum ?",
    hal="hutang dan biaya pengurusan jenazah pewasiat", ringkas="hutang dan biaya pengurusan jenazah <PWS>",
    teks_varian=["Apakah ada hutang <PWS> yang harus dilunasi sebelum wasiat itu dilaksanakan ?"],
    melihat=["<PWS> meninggalkan hutang dan biaya pengurusan jenazah yang diselesaikan keluarga lebih dahulu",
             "hutang <PWS> dan biaya pemakamannya dibayar keluarga sebelum wasiat itu dibicarakan",
             "keluarga lebih dahulu menyelesaikan hutang dan biaya pemakaman <PWS> sebelum wasiat itu dilaksanakan",
             "sesudah <PWS> meninggal dunia keluarga membayar hutang dan biaya pengurusan jenazahnya"],
    sebagian=["biaya pengurusan jenazah <PWS> ditanggung keluarga", "keluarga mengurus pemakaman <PWS> dan membayar biayanya"],
    berbeda=B("peristiwa", "versi A: hutang pewasiat sudah diselesaikan; versi B: hutang pewasiat belum diselesaikan - berselisih pada PERISTIWA",
              ["hutang <PWS> sudah diselesaikan keluarga", "keluarga sudah melunasi hutang <PWS>"],
              ["hutang <PWS> belum diselesaikan keluarga", "keluarga belum melunasi hutang <PWS>"])),
  gaya="lihat")

# ------------------------------------------------------------------ pelaksanaan, penguasaan, hasil
T(Q("q-ws-diberitahukan", "pp-ws-pelaksanaan", 131, "pilihan", "pokok",
    "Setelah <PWS> meninggal dunia, siapa yang memberi tahu ahli waris tentang wasiat itu dan kapan ?",
    hal="pemberitahuan wasiat kepada ahli waris setelah pewasiat meninggal", ringkas="pemberitahuan wasiat <PWS> kepada ahli waris setelah ia meninggal dunia",
    teks_varian=["Kapan dan oleh siapa ahli waris pertama kali diberi tahu tentang adanya wasiat <PWS> ?"],
    melihat=["<TRM> segera memberi tahu ahli waris tentang wasiat <PWS> setelah ia meninggal dunia",
             "setelah <PWS> wafat <TRM> menyampaikan kepada keluarga bahwa ia meninggalkan wasiat",
             "ahli waris baru mengetahui wasiat <PWS> setelah <TRM> menyampaikannya sesudah pewasiat itu meninggal dunia",
             "keluarga <PWS> diberi tahu oleh <TRM> tentang wasiat itu sesudah ia wafat"],
    sebagian=["setelah <PWS> wafat keluarga mendengar ada wasiat atas <OBJ>", "keluarga <PWS> mengetahui wasiat atas <OBJ> sesudah ia meninggal dunia"],
    berbeda=B("waktu", "versi A: ahli waris diberi tahu segera setelah pewasiat meninggal; versi B: ahli waris baru diberi tahu bertahun-tahun kemudian - berselisih pada WAKTU",
              ["ahli waris diberi tahu tentang wasiat segera setelah <PWS> meninggal dunia", "segera setelah <PWS> wafat ahli waris diberi tahu tentang wasiat itu"],
              ["ahli waris baru diberi tahu tentang wasiat bertahun-tahun setelah <PWS> meninggal dunia", "bertahun-tahun sesudah <PWS> wafat barulah ahli waris diberi tahu tentang wasiat itu"])),
  gaya="lihat")

T(Q("q-ws-hasil-dikuasai", "pp-ws-pelaksanaan", 132, "inti", "pokok",
    "Siapa yang menikmati hasil benda yang diwasiatkan sejak <PWS> meninggal dunia, sejak kapan, dan kira-kira berapa hasilnya ?",
    hal="penguasaan dan hasil benda wasiat sejak pewasiat meninggal", ringkas="penguasaan dan hasil <OBJ> sejak <PWS> meninggal dunia",
    teks_varian=["Sejak <PWS> meninggal dunia siapa yang menguasai dan mengambil hasil dari benda yang diwasiatkan itu ?"],
    melihat=["sejak <PWS> meninggal dunia <LW> menguasai <OBJ> dan menikmati hasilnya sampai sekarang",
             "<OBJ> dikuasai <LW> sejak <PWS> wafat dan hasilnya diambil <LW> setiap tahun",
             "hasil <OBJ> dinikmati <LW> sejak <PWS> meninggal dunia hingga saat ini",
             "<LW> yang mengelola <OBJ> dan memanfaatkan hasilnya sejak <PWS> wafat"],
    sebagian=["<LW> menguasai <OBJ> sejak <PWS> meninggal dunia", "<OBJ> berada dalam penguasaan <LW> sejak <PWS> wafat"],
    berbeda=B("pelaku", "versi A: yang menikmati hasil benda adalah pihak lawan; versi B: yang menikmati hasil benda adalah pengaju - berselisih pada PELAKU",
              ["<LW> yang menikmati hasil <OBJ> sejak <PWS> meninggal dunia", "hasil <OBJ> dinikmati <LW> sejak <PWS> wafat"],
              ["<PM> yang menikmati hasil <OBJ> sejak <PWS> meninggal dunia", "hasil <OBJ> dinikmati <PM> sejak <PWS> wafat"])),
  gaya="lihat", tuntutanTambahan="ganti-rugi")

T(Q("q-ws-dialihkan", "pp-ws-pelaksanaan", 133, "inti", "pokok",
    "Apakah ada tanda benda yang diwasiatkan itu akan dijual, digadaikan atau dialihkan oleh pihak yang menguasainya, dan apa yang saksi lihat atau dengar ?",
    hal="kekhawatiran benda wasiat dijual atau dialihkan", ringkas="kemungkinan <OBJ> dijual, digadaikan atau dialihkan oleh pihak yang menguasainya",
    teks_varian=["Apakah pernah ada pembicaraan atau tindakan menjual atau menjaminkan benda yang diwasiatkan itu ?"],
    melihat=["<LW> pernah membicarakan rencana menjual <OBJ> kepada orang lain di depan keluarga",
             "ada pembicaraan <LW> untuk menggadaikan <OBJ> sehingga benda itu terancam berpindah tangan",
             "<LW> pernah menawarkan <OBJ> kepada pembeli di depan keluarga",
             "<LW> diketahui berencana mengalihkan <OBJ> kepada pihak lain"],
    sebagian=["pernah terdengar <OBJ> akan dijual oleh yang menguasainya", "ada kabar <OBJ> hendak dialihkan oleh yang menguasainya"],
    berbeda=B("peristiwa", "versi A: pihak yang menguasai berencana menjual atau mengalihkan benda; versi B: tidak ada rencana mengalihkan benda - berselisih pada PERISTIWA",
              ["<LW> berencana menjual atau mengalihkan <OBJ>", "<LW> pernah menawarkan <OBJ> kepada pembeli"],
              ["<LW> tidak berencana menjual atau mengalihkan <OBJ>", "<LW> tidak pernah menawarkan <OBJ> kepada pembeli"])),
  gaya="lihat", tuntutanTambahan="sita-jaminan")

# ------------------------------------------------------------------ pencabutan
T(Q("q-ws-cabut-ada", "pp-ws-pencabutan", 141, "inti", "pokok",
    "Apakah <PWS> pernah mencabut atau mengubah wasiatnya, kapan, bagaimana caranya, dan siapa yang menyaksikan ?",
    hal="pencabutan atau perubahan wasiat oleh pewasiat", ringkas="pencabutan wasiat oleh <PWS> dan cara pencabutannya",
    teks_varian=["Bagaimana <PWS> mencabut wasiatnya dan apakah ada dua orang saksi atau akta Notaris ?"],
    melihat=["<PWS> mencabut wasiatnya atas <OBJ> di depan dua orang saksi",
             "<PWS> menyatakan wasiat atas <OBJ> dicabut di hadapan dua orang saksi",
             "pencabutan wasiat atas <OBJ> dilakukan <PWS> dengan disaksikan dua orang saksi",
             "<PWS> membatalkan sendiri wasiatnya atas <OBJ> dengan dua orang saksi yang hadir"],
    sebagian=["<PWS> pernah mengatakan akan mencabut wasiatnya atas <OBJ>", "<PWS> menyampaikan niat mencabut wasiatnya atas <OBJ>"],
    berbeda=B("peristiwa", "versi A: pewasiat mencabut wasiatnya; versi B: pewasiat tidak pernah mencabut wasiatnya - berselisih pada PERISTIWA",
              ["<PWS> mencabut wasiatnya atas <OBJ>", "<PWS> membatalkan sendiri wasiatnya atas <OBJ>"],
              ["<PWS> tidak pernah mencabut wasiatnya atas <OBJ>", "<PWS> tidak pernah membatalkan wasiatnya atas <OBJ>"])),
  gaya="lihat", pencabutan="dicabut")

T(Q("q-ws-cabut-tidak", "pp-ws-pencabutan", 142, "pilihan", "pokok",
    "Apakah sampai meninggal dunia <PWS> tidak pernah mencabut atau mengubah wasiatnya, dan bagaimana saksi mengetahuinya ?",
    hal="tidak dicabutnya wasiat sampai pewasiat meninggal", ringkas="tidak dicabutnya wasiat <PWS> sampai ia meninggal dunia",
    teks_varian=["Apakah wasiat <PWS> tetap berlaku sampai ia meninggal tanpa pernah dicabut ?"],
    melihat=["sampai meninggal dunia <PWS> tidak pernah mencabut wasiatnya dan masih menegaskannya kepada keluarga",
             "<PWS> tidak pernah mengubah wasiatnya hingga ia wafat",
             "wasiat <PWS> tetap berlaku karena ia tidak pernah mencabutnya sampai meninggal dunia",
             "<PWS> berpegang pada wasiatnya dan tidak pernah membatalkannya sampai akhir hayatnya"],
    sebagian=["<PWS> tidak pernah terdengar mencabut wasiatnya", "<PWS> tidak pernah terlihat mengubah wasiatnya"],
    berbeda=B("peristiwa", "versi A: wasiat tidak pernah dicabut; versi B: wasiat pernah dicabut - berselisih pada PERISTIWA",
              ["<PWS> tidak pernah mencabut wasiatnya sampai meninggal dunia", "<PWS> tidak pernah mengubah wasiatnya hingga wafat"],
              ["<PWS> pernah mencabut wasiatnya sebelum meninggal dunia", "<PWS> pernah mengubah wasiatnya sebelum wafat"])),
  gaya="tahu", pencabutan="tidak-dicabut")

T(Q("q-ws-wasiat-lain", "pp-ws-pencabutan", 143, "jarang", "pokok",
    "Apakah <PWS> pernah membuat wasiat lain sebelum atau sesudah wasiat itu, dan untuk siapa ?",
    hal="wasiat lain yang dibuat oleh pewasiat", ringkas="wasiat lain yang pernah dibuat oleh <PWS>",
    teks_varian=["Apakah <PWS> pernah berwasiat kepada orang lain selain penerima wasiat dalam perkara ini ?"],
    melihat=["<PWS> pernah membuat wasiat lain kepada orang yang berbeda dari <TRM>",
             "selain wasiat kepada <TRM> ada wasiat lain yang pernah dibuat <PWS>",
             "<PWS> pernah berwasiat kepada orang lain selain <TRM> menurut keluarga",
             "ada wasiat <PWS> yang lain untuk orang selain <TRM> yang dikenal keluarga"],
    sebagian=["<PWS> pernah terdengar berwasiat kepada orang lain selain <TRM>", "<PWS> pernah menyebut wasiat lain selain untuk <TRM>"],
    berbeda=B("peristiwa", "versi A: pewasiat pernah membuat wasiat lain; versi B: pewasiat tidak pernah membuat wasiat lain - berselisih pada PERISTIWA",
              ["<PWS> pernah membuat wasiat lain selain untuk <TRM>", "ada wasiat lain dari <PWS> selain untuk <TRM>"],
              ["<PWS> tidak pernah membuat wasiat lain selain untuk <TRM>", "tidak ada wasiat lain dari <PWS> selain untuk <TRM>"])),
  gaya="campur")

# ------------------------------------------------------------------ wasiat wajibah
T(Q("q-ws-wajibah-pelihara", "pp-wasiat-wajibah", 151, "tambahan", "pokok",
    "Sejak kapan <PM> dipelihara dan dibiayai <PWS> sebagai anak angkat atau orang tua angkat, dan apakah ada penetapan pengadilan tentang pengangkatan itu ?",
    hal="pemeliharaan anak angkat atau orang tua angkat dan penetapan pengangkatannya", ringkas="pemeliharaan <PM> oleh <PWS> sebagai anak angkat atau orang tua angkat",
    teks_varian=["Sudah berapa lama <PM> hidup dan dibiayai <PWS> sebagai anak angkat atau orang tua angkatnya, dan ada putusan pengadilannya ?"],
    melihat=["<PM> dipelihara dan dibiayai <PWS> sebagai anak angkat sejak kecil sampai ia meninggal dunia",
             "sejak kecil <PM> tinggal bersama <PWS> yang menanggung kebutuhan hidup dan pendidikannya",
             "<PWS> memelihara <PM> sebagai anak angkatnya dan membiayainya sampai dewasa",
             "kebutuhan sehari-hari <PM> ditanggung <PWS> yang mengasuhnya sebagai anak angkat"],
    sebagian=["<PM> tinggal bersama <PWS> sejak kecil", "<PM> diasuh <PWS> sejak masih kecil"],
    berbeda=B("lama", "versi A: pemeliharaan berlangsung sejak kecil sampai pewasiat meninggal; versi B: pemeliharaan hanya sebentar - berselisih pada LAMA",
              ["<PM> dipelihara <PWS> sejak kecil sampai ia meninggal dunia", "sejak kecil <PM> tinggal bersama <PWS> sampai ia wafat"],
              ["<PM> hanya sebentar dipelihara <PWS> pada waktu kecil", "<PM> tinggal bersama <PWS> hanya dalam waktu singkat"])),
  gaya="tahu", pokokTuntutan="G")

T(Q("q-ws-wajibah-bagian", "pp-wasiat-wajibah", 152, "tambahan", "pokok",
    "Apakah <PM> pernah menerima wasiat atau pemberian lain dari <PWS>, dan berapa kira-kira bagiannya dibandingkan seluruh harta <PWS> ?",
    hal="penerimaan wasiat atau pemberian lain oleh anak angkat atau orang tua angkat", ringkas="penerimaan wasiat atau pemberian <PWS> kepada <PM>",
    teks_varian=["Apakah <PM> sudah mendapat sesuatu dari <PWS> sebagai wasiat atau hadiah sebelum <PWS> meninggal dunia ?"],
    melihat=["<PM> belum pernah menerima wasiat atau pemberian apa pun dari <PWS> sampai ia meninggal dunia",
             "<PM> belum menerima wasiat maupun hadiah dari <PWS> hingga akhir hayatnya",
             "tidak ada wasiat atau pemberian dari <PWS> yang sampai kepada <PM> hingga ia meninggal dunia",
             "<PM> tidak menerima wasiat dari <PWS> hingga ia meninggal dunia"],
    sebagian=["<PM> belum pernah menerima wasiat dari <PWS>", "<PM> belum menerima pemberian besar dari <PWS>"],
    berbeda=B("peristiwa", "versi A: pengaju belum menerima wasiat atau pemberian; versi B: pengaju sudah menerima wasiat atau pemberian - berselisih pada PERISTIWA",
              ["<PM> belum pernah menerima wasiat atau pemberian dari <PWS>", "<PM> belum menerima wasiat maupun hadiah dari <PWS> hingga akhir hayatnya"],
              ["<PM> sudah menerima wasiat atau pemberian dari <PWS>", "<PM> sudah menerima wasiat dan hadiah dari <PWS> sebelum ia wafat"])),
  gaya="tahu", pokokTuntutan="G")

CATATAN = [
    "Versi 2 (21 Okt 2026): keadaan pewasiat (sehat, sakit menjelang meninggal, akal dipersoalkan), umur dan kehendak bebas, wasiat lisan, tertulis dan dengan akta Notaris, saksi wasiat, keaslian tanda tangan, benda dan bukti haknya, syarat penerima wasiat, persetujuan ahli waris, pencabutan, penguasaan dan hasil benda, serta wasiat wajibah ditambahkan; semua butir versi 1 dipertahankan.",
    "Pilihan keadaan pada layar menentukan butir yang tampil; jawaban 'berbeda' dan jawaban yang memuat titik-titik hanya kerangka: sesuaikan dengan keterangan saksi yang sesungguhnya.",
    "Penilaian sah atau tidaknya wasiat, batas sepertiga dan persetujuan ahli waris adalah penilaian hakim; keterangan saksi hanya menjadi dasar pembuktian.",
]

# ------------------------------------------------------------------ profil pengetahuan saksi
PROFIL = {
    "hadir-sendiri": dict(label="Hadir ketika wasiat dibuat dan mengetahui sendiri", peta={"*": "melihat", "pp-ws-pelaksanaan": "de-auditu", "pp-ws-hutang-ahliwaris": "de-auditu"}, sumber=True),
    "mendengar-ucapan": dict(label="Mendengar sendiri ucapan pewasiat, tidak melihat suratnya", peta={"*": "melihat", "pp-bentuk-wasiat": "mendengar", "pp-penerima-wasiat": "mendengar", "pp-ws-syarat-penerima": "mendengar", "pp-persetujuan-ahli-waris": "mendengar", "pp-ws-pencabutan": "mendengar"}),
    "tahu-setelah-wafat": dict(label="Tahu wasiat dari cerita setelah pewasiat meninggal", peta={"*": "de-auditu", "pp-hubungan-saksi": "melihat", "pp-kematian-pewasiat": "melihat", "pp-ws-pelaksanaan": "melihat"}, sumber=True),
    "tahu-sebagian-wasiat": dict(label="Hanya tahu sebagian isi wasiat (centang hal yang diketahui)", peta={"*": "sebagian", "pp-hubungan-saksi": "melihat", "pp-kematian-pewasiat": "melihat"}),
    "kenal-tidak-tahu-wasiat": dict(label="Mengenal pewasiat tetapi tidak tahu soal wasiat", peta={"*": "tidak-tahu", "pp-hubungan-saksi": "melihat", "pp-kematian-pewasiat": "melihat"}),
    "ragu": dict(label="Ragu dan kurang ingat", peta={"*": "ragu", "pp-hubungan-saksi": "melihat", "pp-kematian-pewasiat": "melihat"}),
}


def BLANGKO_PERBAIKAN(kat):
    """blangkoBas: semua berkas BAS saksi sudah tercantum (diperiksa terhadap server 21 Okt 2026); hanya catatan penjelas."""
    for b in kat["blangkoBas"]:
        if b["berkas"].startswith("BAS ALUR 42 Wasiat - Sidang 2 - T Tetap Tidak Hadir") and not b.get("catatan"):
            b["catatan"] = "verstek: saksi dari pihak pengaju"


if __name__ == "__main__":
    v1 = json.load(open(os.path.join(L.V1, "wasiat.json"), encoding="utf8"))
    kat = L.bangun(v1, sys.modules[__name__], PETA)
    p = L.tulis(kat, "wasiat")
    print("wasiat: pertanyaan %d -> %d, pokok %d -> %d, keadaan %d -> %d, dasar %d -> %d" % (
        len(v1["pertanyaan"]), len(kat["pertanyaan"]), len(v1["pokokPembuktian"]), len(kat["pokokPembuktian"]), len(v1["keadaan"]), len(kat["keadaan"]), len(v1["dasarHukum"]), len(kat["dasarHukum"])))
    print(L.periksa(p))
