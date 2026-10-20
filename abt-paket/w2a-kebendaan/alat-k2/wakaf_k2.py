# -*- coding: utf-8 -*-
"""
Katalog saksi WAKAF versi 2 (agen W2a-K2, 21 Okt 2026). Menambah pokok, pertanyaan, keadaan, dasar hukum dan profil pengetahuan saksi
tanpa menghapus apa pun dari versi 1 (abt-paket/w2a-kebendaan/katalog-v1-k2/wakaf.json).
Pakai: python wakaf_k2.py  (menulis ekstensi-sipp/saksi-katalog/wakaf.json lalu memeriksanya)
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import k2lib as L
from k2lib import Q, B, Daftar

# <WK> wakif | <NZ> nazhir | <HB> harta benda wakaf | <PR> peruntukan | <IK> bentuk dan tanggal ikrar | <PM> pengaju | <LW> lawan | <KS> pihak yang menguasai (permohonan)
PETA = {"_g": "x", "WK": "#9823#", "NZ": "#9824#", "HB": "#9826#", "PR": "#9827#", "IK": "#9825#", "PM": "#0046#", "LW": "#0047#", "KS": "#9841#"}
D = DAFTAR = Daftar()
T = D.tambah

SUMBER_OCR = "KHI lampiran Inpres 1/1991 Buku III Hukum Perwakafan, naskah Depag hasil pindai (referensi/_unduhan/khi/khi.txt) dibaca 21 Okt 2026; BELUM dicocokkan dengan digitalisasi pasal.id sehingga belum tercetak"

DASAR_BARU = [
    dict(id="dh-khi-218-223", rujukan="Pasal 218 ayat (1) dan Pasal 223 ayat (1), (3) dan (4) Kompilasi Hukum Islam", uraian="pihak yang mewakafkan mengikrarkan kehendaknya secara jelas dan tegas kepada nadzir di hadapan Pejabat Pembuat Akta Ikrar Wakaf dengan disaksikan sekurang-kurangnya dua orang saksi; ikrar dan akta ikrar wakaf sah bila dihadiri dan disaksikan sekurang-kurangnya dua orang saksi; wakif menyerahkan tanda bukti pemilikan harta benda dan, untuk benda tidak bergerak, surat keterangan kepala desa yang diperkuat camat serta dokumen tertulis kelengkapannya", status="perlu-verifikasi", sumber=SUMBER_OCR),
    dict(id="dh-khi-219-221", rujukan="Pasal 219 sampai Pasal 221 Kompilasi Hukum Islam", uraian="nadzir perorangan harus warga negara Indonesia, beragama Islam, dewasa, sehat jasmani dan rohani, tidak berada di bawah pengampuan; nadzir didaftar pada Kantor Urusan Agama Kecamatan dan mengucapkan sumpah sebelum melaksanakan tugas; nadzir berkewajiban mengurus harta wakaf serta hasilnya dan membuat laporan berkala; nadzir diberhentikan antara lain karena meninggal dunia atau tidak dapat melakukan kewajibannya", status="perlu-verifikasi", sumber=SUMBER_OCR),
    dict(id="dh-khi-224-225", rujukan="Pasal 224 dan Pasal 225 Kompilasi Hukum Islam", uraian="setelah akta ikrar wakaf dilaksanakan, pendaftaran perwakafan benda diajukan kepada Camat; benda yang telah diwakafkan pada dasarnya tidak dapat diubah atau dipakai selain untuk yang dimaksud dalam ikrar wakaf, kecuali dengan persetujuan tertulis Kepala Kantor Urusan Agama Kecamatan karena tidak sesuai lagi dengan tujuan wakaf atau karena kepentingan umum", status="perlu-verifikasi", sumber=SUMBER_OCR),
]

POKOK_BARU = [
    dict(id="pp-wk-kehendak", judul="Kehendak wakif dan maksud wakaf", uraian="wakif dengan sukarela memberikan harta bendanya untuk kepentingan ibadah atau kesejahteraan umum, tanpa paksaan dan tanpa maksud menariknya kembali", dasarHukum=["dh-uuw-1", "dh-uuw-2-3"], wajib=False),
    dict(id="pp-wk-ikrar-detail", judul="Pernyataan ikrar, penerimaan nazhir dan akta ikrar wakaf", uraian="isi pernyataan ikrar, kehadiran nazhir dan pejabat pembuat akta ikrar wakaf, nomor dan tanggal akta, serta surat bukti yang diserahkan wakif", dasarHukum=["dh-uuw-17", "dh-khi-218-223"], wajib=False),
    dict(id="pp-wk-harta-bukti", judul="Bukti hak dan bebasnya harta benda wakaf dari sengketa", uraian="bukti kepemilikan harta benda wakaf atas nama wakif, letak atau ciri benda, dan keadaan bebas dari sitaan, perkara, sengketa dan jaminan ketika diwakafkan", dasarHukum=["dh-uuw-15", "dh-pp-17"], wajib=False),
    dict(id="pp-wk-nazhir-detail", judul="Pendaftaran, pelaksanaan tugas dan keadaan nazhir", uraian="nazhir terdaftar, mengurus harta benda wakaf sesuai peruntukan, melaporkan pengelolaannya, atau sudah meninggal dan diganti", dasarHukum=["dh-uuw-10", "dh-khi-219-221"], wajib=False),
    dict(id="pp-wk-pendaftaran", judul="Pendaftaran dan sertipikat wakaf", uraian="harta benda wakaf sudah atau belum didaftarkan dan disertipikatkan sebagai wakaf, dan atas nama siapa", dasarHukum=["dh-pp-58", "dh-khi-224-225"], wajib=False),
    dict(id="pp-wk-peruntukan-detail", judul="Pemakaian harta benda sesuai peruntukan wakaf", uraian="untuk apa harta benda dipakai sejak diwakafkan sampai sekarang, perubahan pemakaian dan pemberitahuan kepada ahli waris wakif", dasarHukum=["dh-uuw-22-23", "dh-uuw-44", "dh-khi-224-225"], wajib=False),
    dict(id="pp-wk-ahliwaris", judul="Ahli waris wakif dan sikapnya atas wakaf", uraian="ahli waris wakif, permintaan mereka atas harta benda wakaf, penguasaan harta benda oleh ahli waris dan persetujuan mereka atas wakaf", dasarHukum=["dh-uuw-2-3", "dh-uuw-40-41"], wajib=False),
    dict(id="pp-wk-dalil-batal", judul="Dalil ketidaksahan ikrar wakaf", uraian="dalil yang mempersoalkan sahnya wakaf: ikrar tanpa akta, tanpa dua orang saksi, tanda tangan bukan milik wakif, harta bukan milik wakif atau pelanggaran syarat nazhir", dasarHukum=["dh-uuw-2-3", "dh-uuw-17", "dh-beban-bukti"], wajib=False),
    dict(id="pp-wk-pengalihan-detail", judul="Penjualan, pengalihan atau ganti rugi atas harta benda wakaf", uraian="harta benda wakaf dijual, dihibahkan, diwariskan, dijaminkan, ditukar atau diganti rugi, siapa yang melakukannya dan siapa yang menerima gantinya", dasarHukum=["dh-uuw-40-41"], wajib=False),
    dict(id="pp-wk-akibat", judul="Penguasaan harta benda wakaf dan akibatnya", uraian="penguasaan harta benda wakaf oleh pihak lawan, hasilnya, permintaan penyerahan dan upaya mengamankan benda selama perkara berjalan", dasarHukum=["dh-beban-bukti"], wajib=False),
    dict(id="pp-wk-permohonan", judul="Kedudukan pemohon, penguasaan harta benda dan kesaksian pihak yang mengetahui wakaf", uraian="kedudukan pemohon, penguasa harta benda wakaf, pemanfaatan sejak lama dan kesaksian pihak yang mengetahui wakaf untuk pengukuhan wakaf", dasarHukum=["dh-pp-58", "dh-kewenangan-wakaf"], wajib=False),
]

KEADAAN_BARU = {
    "statusWakif": dict(sumber="borang", nilai=["masih-hidup", "sudah-meninggal"], bawaan="sudah-meninggal", label="Keadaan wakif saat ini",
                        labelNilai={"masih-hidup": "Wakif masih hidup", "sudah-meninggal": "Wakif sudah meninggal dunia"}),
    "kondisiWakif": dict(sumber="borang", nilai=["sehat", "akal-dipersoalkan"], bawaan="sehat", label="Keadaan wakif ketika berikrar",
                         labelNilai={"sehat": "Sehat jasmani dan akalnya", "akal-dipersoalkan": "Kesehatan akal atau ingatannya dipersoalkan"}),
    "jenisHarta": dict(sumber="borang", nilai=["tanah-bangunan", "benda-bergerak", "uang"], jamak=True, bawaan=[], label="Jenis harta benda wakaf",
                       labelNilai={"tanah-bangunan": "Tanah atau bangunan", "benda-bergerak": "Benda bergerak", "uang": "Uang"}),
    "keadaanNazhir": dict(sumber="borang", nilai=["belum-terdaftar", "tidak-amanah", "sudah-meninggal"], jamak=True, bawaan=[], label="Keadaan nazhir yang dipersoalkan",
                          labelNilai={"belum-terdaftar": "Nazhir tidak terdaftar pada Kantor Urusan Agama", "tidak-amanah": "Nazhir lalai atau menyalahgunakan hasil wakaf", "sudah-meninggal": "Nazhir sudah meninggal dunia"}),
    "pendaftaranWakaf": dict(sumber="borang", nilai=["terdaftar", "belum-terdaftar"], bawaan="terdaftar", label="Pendaftaran harta benda wakaf",
                             labelNilai={"terdaftar": "Sudah terdaftar atau bersertipikat wakaf", "belum-terdaftar": "Belum terdaftar atau belum bersertipikat wakaf"}),
    "dalilBatal": dict(sumber="borang", nilai=["ikrar-tanpa-akta", "tanpa-saksi", "bukan-milik-wakif", "tanda-tangan-dipalsukan"], jamak=True, bawaan=[], label="Dalil yang mempersoalkan sahnya ikrar wakaf",
                       labelNilai={"ikrar-tanpa-akta": "Ikrar hanya surat di bawah tangan tanpa akta ikrar wakaf", "tanpa-saksi": "Ikrar tanpa dua orang saksi", "bukan-milik-wakif": "Harta bukan milik wakif", "tanda-tangan-dipalsukan": "Tanda tangan atau cap jempol bukan milik wakif"}),
    "bentukPengalihan": dict(sumber="borang", nilai=["dijual-dihibahkan", "dijaminkan", "ganti-rugi-pemerintah"], jamak=True, bawaan=[], label="Bentuk pengalihan harta benda wakaf yang didalilkan",
                             labelNilai={"dijual-dihibahkan": "Dijual, dihibahkan atau diwariskan", "dijaminkan": "Dijaminkan atau digadaikan", "ganti-rugi-pemerintah": "Diganti rugi atau dibebaskan untuk kepentingan umum"}),
    "tuntutanTambahan": dict(sumber="borang", nilai=["ganti-rugi", "sita-jaminan", "pengosongan", "uang-paksa"], jamak=True, bawaan=[], label="Tuntutan tambahan dalam gugatan",
                             labelNilai={"ganti-rugi": "Ganti kerugian atas penguasaan harta benda", "sita-jaminan": "Sita jaminan atas harta benda wakaf", "pengosongan": "Pengosongan dan penyerahan harta benda", "uang-paksa": "Uang paksa"}),
}

# ------------------------------------------------------------------ wakif
T(Q("q-wk-umur", "pp-syarat-wakif", 31, "pilihan", "pokok",
    "Berapa umur <WK> ketika berikrar mewakafkan hartanya, apakah sudah dewasa ?",
    hal="umur wakif ketika berikrar", ringkas="umur <WK> ketika berikrar mewakafkan hartanya",
    teks_varian=["Apakah <WK> sudah dewasa ketika mewakafkan hartanya, kira-kira berapa umurnya waktu itu ?"],
    melihat=["<WK> sudah dewasa dan umurnya jauh di atas dua puluh satu tahun ketika berikrar mewakafkan hartanya",
             "ketika ikrar wakaf diucapkan <WK> sudah berumur lebih dari dua puluh satu tahun",
             "umur <WK> pada waktu berikrar sudah melewati dua puluh satu tahun",
             "<WK> telah dewasa dengan umur lebih dari dua puluh satu tahun saat ikrar wakaf dilaksanakan"],
    sebagian=["<WK> sudah dewasa ketika berikrar mewakafkan hartanya", "umur <WK> ketika berikrar mewakafkan hartanya sudah dewasa"],
    berbeda=B("jumlah", "versi A: wakif sudah dewasa ketika berikrar; versi B: wakif belum dewasa ketika berikrar - berselisih pada JUMLAH (umur)",
              ["<WK> sudah dewasa ketika berikrar mewakafkan hartanya", "umur <WK> pada waktu berikrar sudah melewati dua puluh satu tahun"],
              ["<WK> belum dewasa ketika berikrar mewakafkan hartanya", "umur <WK> pada waktu berikrar belum sampai dua puluh satu tahun"])),
  gaya="tahu")

T(Q("q-wk-sehat-akal", "pp-syarat-wakif", 32, "pilihan", "pokok",
    "Apakah <WK> sehat akal dan ingatannya ketika berikrar mewakafkan hartanya, dan bagaimana saksi mengetahuinya ?",
    hal="kesehatan akal wakif ketika berikrar", ringkas="kesehatan akal dan ingatan <WK> ketika berikrar mewakafkan hartanya",
    teks_varian=["Bagaimana keadaan pikiran dan ingatan <WK> ketika menyatakan wakafnya, apakah ia berbicara dengan jelas ?"],
    melihat=["<WK> sehat akalnya dan ingatannya baik ketika berikrar sehingga ia berbicara dengan jelas dan mengerti maksud wakafnya",
             "ketika ikrar wakaf diucapkan <WK> sadar sepenuhnya serta mengerti apa yang dikatakannya",
             "pada waktu mewakafkan hartanya <WK> berpikir jernih dan dapat menjelaskan sendiri maksud wakafnya",
             "<WK> dalam keadaan sadar dan berakal sehat ketika menyampaikan wakafnya kepada orang di sekitarnya"],
    sebagian=["<WK> tampak sadar ketika berikrar mewakafkan hartanya", "<WK> berbicara dengan jelas ketika berikrar mewakafkan hartanya"],
    berbeda=B("peristiwa", "versi A: wakif sehat akalnya; versi B: wakif tidak sadar atau pikun - berselisih pada PERISTIWA (keadaan akal)",
              ["<WK> sehat akalnya ketika berikrar dan mengerti maksud wakafnya", "ketika ikrar wakaf diucapkan <WK> sadar sepenuhnya dan mengerti apa yang dikatakannya"],
              ["<WK> tidak sehat akalnya ketika berikrar dan tidak mengerti maksud wakafnya", "ketika ikrar wakaf diucapkan <WK> tidak sadar sepenuhnya dan tidak mengerti apa yang dikatakannya"])),
  gaya="tahu")

T(Q("q-wk-akal-dipersoalkan", "pp-syarat-wakif", 33, "inti", "pokok",
    "Apakah menjelang berikrar <WK> pernah linglung, pikun atau berperilaku tidak wajar ?",
    hal="keadaan ingatan wakif menjelang berikrar", ringkas="keadaan ingatan dan perilaku <WK> menjelang berikrar wakaf",
    teks_varian=["Apakah <WK> pernah menunjukkan tanda pikun atau tidak mengenali orang di sekitarnya sebelum atau ketika berikrar ?"],
    melihat=["<WK> sering linglung dan tidak mengenali orang di sekitarnya menjelang berikrar wakaf",
             "menjelang ikrar wakaf diucapkan <WK> sudah pikun dan berperilaku tidak wajar",
             "sebelum berikrar pikiran <WK> sudah kacau dan ia tidak lagi mengenali keluarganya",
             "<WK> tampak pikun dan tidak mengerti keadaan sekitarnya sewaktu ikrar wakaf diucapkan"],
    sebagian=["<WK> sering linglung menjelang berikrar wakaf", "menjelang ikrar wakaf <WK> sudah tampak pikun"],
    berbeda=B("peristiwa", "versi A: wakif tidak pernah pikun; versi B: wakif sudah pikun - berselisih pada PERISTIWA (keadaan ingatan)",
              ["<WK> tidak pernah linglung atau pikun menjelang berikrar wakaf", "menjelang ikrar wakaf <WK> tidak pernah berperilaku aneh"],
              ["<WK> sering linglung dan pikun menjelang berikrar wakaf", "menjelang ikrar wakaf <WK> sudah berperilaku aneh"])),
  gaya="tahu", kondisiWakif="akal-dipersoalkan")

T(Q("q-wk-tanpa-paksaan", "pp-wk-kehendak", 34, "pilihan", "pokok",
    "Apakah <WK> mewakafkan hartanya atas kehendaknya sendiri tanpa paksaan dari siapa pun ?",
    hal="kehendak bebas wakif tanpa paksaan", ringkas="kehendak <WK> mewakafkan hartanya tanpa paksaan",
    teks_varian=["Apakah ada yang memaksa atau menekan <WK> ketika ia berikrar mewakafkan hartanya ?"],
    melihat=["<WK> mewakafkan hartanya atas kehendaknya sendiri tanpa paksaan dari siapa pun",
             "wakaf itu lahir dari kemauan <WK> sendiri tanpa ada orang yang memaksanya",
             "tidak ada paksaan dari siapa pun karena <WK> sendiri yang menginginkan wakaf itu",
             "<WK> menyatakan wakaf itu dengan sukarela tanpa tekanan dari pihak mana pun"],
    sebagian=["<WK> menyatakan wakaf itu dengan kemauannya sendiri", "wakaf itu lahir dari kehendak <WK> sendiri"],
    berbeda=B("peristiwa", "versi A: wakaf diikrarkan tanpa paksaan; versi B: wakif dipaksa atau ditekan - berselisih pada PERISTIWA",
              ["<WK> mewakafkan hartanya atas kehendaknya sendiri tanpa paksaan dari siapa pun", "wakaf itu lahir dari kemauan <WK> sendiri tanpa ada orang yang memaksanya"],
              ["<WK> mewakafkan hartanya karena dipaksa oleh orang lain tanpa kehendak yang bebas", "wakaf itu diikrarkan <WK> setelah ditekan oleh orang di sekitarnya tanpa kemauan sendiri"])),
  gaya="tahu")

T(Q("q-wk-niat", "pp-wk-kehendak", 35, "inti", "pokok",
    "Apa maksud <WK> mewakafkan hartanya, apakah untuk kepentingan ibadah atau kesejahteraan umum, dan apakah ia pernah menyatakan akan menariknya kembali ?",
    hal="maksud wakif mewakafkan hartanya dan sikapnya terhadap penarikan kembali", ringkas="maksud <WK> mewakafkan hartanya untuk <PR>",
    teks_varian=["Apa tujuan <WK> mewakafkan hartanya dan apakah ia pernah mengatakan akan mengambilnya kembali ?"],
    melihat=["<WK> mewakafkan hartanya untuk <PR> sebagai amal jariyah dan menyatakan tidak akan menariknya kembali",
             "maksud <WK> mewakafkan hartanya adalah <PR> dan ia berpesan agar harta itu tidak diambil lagi",
             "<WK> berniat memberikan hartanya untuk <PR> selamanya dan tidak akan memintanya kembali",
             "wakaf <WK> ditujukan untuk <PR> sebagai amal ibadah yang tidak akan ditarik kembali"],
    sebagian=["<WK> mewakafkan hartanya untuk <PR>", "<WK> berniat mewakafkan hartanya untuk <PR> sebagai amal ibadah"],
    berbeda=B("peristiwa", "versi A: wakif tidak pernah menyatakan akan menarik kembali; versi B: wakif pernah menyatakan akan menarik kembali - berselisih pada PERISTIWA",
              ["<WK> tidak pernah menyatakan akan menarik kembali wakafnya untuk <PR>", "<WK> tidak pernah meminta kembali hartanya yang diwakafkan untuk <PR>"],
              ["<WK> pernah menyatakan akan menarik kembali wakafnya untuk <PR>", "<WK> pernah meminta kembali hartanya yang diwakafkan untuk <PR>"])),
  gaya="campur")

T(Q("q-wk-wakif-wafat", "pp-wk-ahliwaris", 36, "inti", "pokok",
    "Kapan <WK> meninggal dunia, berapa lama sesudah ikrar wakaf itu, dan siapa ahli warisnya ?",
    hal="meninggalnya wakif dan ahli warisnya", ringkas="meninggalnya <WK> dan ahli warisnya setelah ikrar wakaf",
    teks_varian=["Berapa lama setelah ikrar wakaf <WK> meninggal dunia dan siapa saja ahli warisnya ?"],
    melihat=["<WK> meninggal dunia setelah ikrar wakaf dilaksanakan dan meninggalkan ahli waris yang dikenal warga",
             "setelah berikrar <WK> wafat dan ahli warisnya masih hidup sampai sekarang",
             "ikrar wakaf itu dilakukan <WK> semasa hidupnya dan ia wafat sesudahnya dengan meninggalkan ahli waris",
             "<WK> wafat setelah mewakafkan hartanya dan para ahli warisnya diketahui warga"],
    sebagian=["<WK> meninggal dunia setelah ikrar wakaf dilaksanakan", "<WK> wafat setelah mewakafkan hartanya"],
    berbeda=B("lama", "versi A: wakif meninggal lama sesudah ikrar; versi B: wakif meninggal segera sesudah ikrar - berselisih pada LAMA",
              ["<WK> meninggal dunia lama sesudah berikrar mewakafkan hartanya", "lama setelah ikrar wakaf <WK> wafat"],
              ["<WK> meninggal dunia segera sesudah berikrar mewakafkan hartanya", "segera setelah ikrar wakaf <WK> wafat"])),
  gaya="lihat", statusWakif="sudah-meninggal")

# ------------------------------------------------------------------ milik, bukti dan bebas sengketa
T(Q("q-wk-milik-bukti", "pp-wk-harta-bukti", 41, "inti", "pokok",
    "Apa bukti kepemilikan <WK> atas harta yang diwakafkan itu, misalnya sertipikat, girik atau surat keterangan desa, dan atas nama siapa ?",
    hal="bukti kepemilikan harta yang diwakafkan", ringkas="bukti kepemilikan <HB> atas nama <WK>",
    teks_varian=["Atas nama siapa bukti hak harta yang diwakafkan <WK> itu dan surat apa yang menjadi buktinya ?"],
    melihat=["bukti hak atas <HB> tercatat atas nama <WK> dan surat buktinya pernah diperlihatkan",
             "<HB> dibuktikan dengan surat yang tercatat atas nama <WK> dan surat itu pernah diperlihatkan kepada warga",
             "surat hak atas <HB> memang atas nama <WK> sebagaimana yang terlihat pada suratnya",
             "kepemilikan <WK> atas <HB> dibuktikan surat yang dilihat warga sendiri"],
    sebagian=["<HB> sejak lama dikenal sebagai milik <WK>", "<HB> sejak lama dikuasai <WK> sebagai pemiliknya"],
    berbeda=B("peristiwa", "versi A: bukti hak atas harta tercatat atas nama wakif; versi B: bukti hak atas harta tercatat atas nama orang lain - berselisih pada PERISTIWA",
              ["bukti hak atas <HB> tercatat atas nama <WK>", "surat hak atas <HB> memang atas nama <WK>"],
              ["bukti hak atas <HB> tercatat atas nama orang lain bukan <WK>", "surat hak atas <HB> bukan atas nama <WK> melainkan orang lain"])),
  gaya="campur")

T(Q("q-wk-bebas-sengketa", "pp-wk-harta-bukti", 42, "pilihan", "pokok",
    "Ketika diwakafkan <WK>, apakah harta itu bebas dari sitaan, perkara, sengketa dan tidak dijaminkan kepada pihak lain ?",
    hal="bebasnya harta wakaf dari sitaan, sengketa dan jaminan ketika diwakafkan", ringkas="keadaan <HB> yang bebas dari sitaan, sengketa dan jaminan ketika diwakafkan <WK>",
    teks_varian=["Apakah ketika diwakafkan <WK> ada pihak lain yang menyengketakan atau memegang jaminan atas harta itu ?"],
    melihat=["ketika diwakafkan <WK> keadaan <HB> bebas dari sitaan dan sengketa serta tidak sedang dijaminkan",
             "pada waktu ikrar wakaf <WK> atas <HB> tidak ada sitaan dan sengketa maupun jaminan",
             "<HB> yang diwakafkan <WK> berada dalam keadaan bebas dari perkara dan tidak dijaminkan",
             "sampai ikrar wakaf <WK> atas <HB> tidak ada pihak yang menyengketakan atau memegang jaminan"],
    sebagian=["<HB> yang diwakafkan <WK> bebas dari sengketa", "<HB> yang diwakafkan <WK> terbebas dari sengketa"],
    berbeda=B("peristiwa", "versi A: harta bebas dari sengketa ketika diwakafkan; versi B: harta sedang disengketakan ketika diwakafkan - berselisih pada PERISTIWA",
              ["<HB> bebas dari sengketa ketika diwakafkan <WK>", "ketika diwakafkan <WK> terbebas dari sengketa atas <HB>"],
              ["<HB> sedang dipersengketakan ketika diwakafkan <WK>", "ketika diwakafkan <WK> ada pihak yang menyengketakan <HB>"])),
  gaya="tahu")

T(Q("q-wk-objek-tanah", "pp-wk-harta-bukti", 82, "pilihan", "pokok",
    "Di mana letak tanah atau bangunan yang diwakafkan <WK> itu, berapa luasnya, dan apa batas-batasnya ?",
    hal="letak luas dan batas tanah atau bangunan wakaf", ringkas="letak, luas dan batas <HB>",
    teks_varian=["Di mana tanah atau bangunan yang diwakafkan <WK> itu berada, berapa luasnya dan berbatasan dengan apa ?"],
    melihat=["<HB> yang diwakafkan <WK> terletak di tempat yang dikenal warga dengan luas dan batas yang jelas",
             "letak <HB> yang diwakafkan <WK> diketahui warga lengkap dengan luas dan batas-batasnya",
             "batas-batas <HB> yang diwakafkan <WK> diketahui warga sekitar dengan jelas",
             "tanah atau bangunan <HB> yang diwakafkan <WK> telah lama dikenal letak dan batasnya oleh warga"],
    sebagian=["<HB> yang diwakafkan <WK> terletak di tempat yang dikenal warga", "letak <HB> yang diwakafkan <WK> diketahui warga"],
    berbeda=B("tempat", "versi A: letak harta sesuai uraian perkara; versi B: harta berada di letak yang berbeda - berselisih pada TEMPAT",
              ["<HB> yang diwakafkan <WK> terletak sebagaimana diuraikan dalam perkara ini", "letak <HB> yang diwakafkan <WK> sesuai uraian dalam perkara ini"],
              ["<HB> yang diwakafkan <WK> terletak di tempat lain yang berbeda dari uraian perkara ini", "letak <HB> yang diwakafkan <WK> berbeda dengan uraian dalam perkara ini"])),
  gaya="tahu", jenisHarta="tanah-bangunan")

T(Q("q-wk-objek-bergerak", "pp-wk-harta-bukti", 83, "pilihan", "pokok",
    "Benda bergerak apa yang diwakafkan <WK> itu, berapa jumlahnya, dan di mana benda itu disimpan sekarang ?",
    hal="jenis jumlah dan tempat benda bergerak yang diwakafkan", ringkas="jenis, jumlah dan tempat penyimpanan <HB> berupa benda bergerak",
    teks_varian=["Benda bergerak apa yang diwakafkan <WK>, berapa banyak, dan siapa yang menyimpannya ?"],
    melihat=["<HB> berupa benda bergerak yang diwakafkan <WK> diserahkan kepada <NZ> dan disimpan di tempat ibadah",
             "benda bergerak <HB> milik <WK> itu sudah diserahkan kepada <NZ> dan dipakai bersama",
             "<WK> menyerahkan <HB> berupa benda bergerak kepada <NZ> untuk dipakai bagi kepentingan umum",
             "penyerahan <HB> berupa benda bergerak dari <WK> kepada <NZ> dilakukan sesuai jumlah wakafnya"],
    sebagian=["<WK> menyerahkan <HB> berupa benda bergerak kepada <NZ>", "benda bergerak <HB> dari <WK> diterima <NZ>"],
    berbeda=B("jumlah", "versi A: jumlah benda yang diserahkan sesuai wakaf; versi B: jumlah benda yang diserahkan lebih sedikit dari wakaf - berselisih pada JUMLAH",
              ["jumlah <HB> yang diserahkan <WK> kepada <NZ> sesuai wakafnya", "<WK> menyerahkan <HB> kepada <NZ> sebanyak yang diwakafkannya"],
              ["jumlah <HB> yang diserahkan <WK> kepada <NZ> lebih sedikit dari wakafnya", "<WK> menyerahkan <HB> kepada <NZ> kurang dari yang diwakafkannya"])),
  gaya="lihat", jenisHarta="benda-bergerak")

T(Q("q-wk-objek-uang", "pp-wk-harta-bukti", 84, "pilihan", "pokok",
    "Berapa uang yang diwakafkan <WK> itu, dan bagaimana uang itu diserahkan serta dikelola oleh nazhir ?",
    hal="jumlah dan pengelolaan uang yang diwakafkan", ringkas="jumlah dan pengelolaan <HB> berupa uang oleh <NZ>",
    teks_varian=["Berapa uang yang diwakafkan <WK> dan bagaimana uang itu diserahkan kepada nazhir ?"],
    melihat=["<HB> berupa uang diserahkan <WK> kepada <NZ> dan dikelola untuk <PR>",
             "uang wakaf <HB> dari <WK> dipegang <NZ> dan dipakai sesuai <PR>",
             "<NZ> menerima <HB> berupa uang dari <WK> dan mengelolanya untuk <PR>",
             "penyerahan <HB> berupa uang dari <WK> kepada <NZ> dilakukan untuk dikelola bagi <PR>"],
    sebagian=["<NZ> menerima <HB> berupa uang dari <WK>", "uang wakaf <HB> dari <WK> diterima <NZ>"],
    berbeda=B("peristiwa", "versi A: uang wakaf dikelola sesuai peruntukan; versi B: uang wakaf dipakai untuk keperluan lain - berselisih pada PERISTIWA",
              ["uang wakaf <HB> dari <WK> dikelola <NZ> sesuai <PR>", "<NZ> memakai uang wakaf <HB> dari <WK> untuk <PR>"],
              ["uang wakaf <HB> dari <WK> dipakai <NZ> untuk keperluan lain selain <PR>", "<NZ> memakai uang wakaf <HB> dari <WK> di luar <PR>"])),
  gaya="lihat", jenisHarta="uang")

# ------------------------------------------------------------------ ikrar dan akta ikrar wakaf
T(Q("q-wk-ikrar-ucapan", "pp-wk-ikrar-detail", 51, "inti", "pokok",
    "Apa yang diucapkan <WK> ketika berikrar mewakafkan hartanya secara lisan, dan siapa yang mendengarnya ?",
    hal="ucapan ikrar wakaf dari wakif", ringkas="ucapan ikrar wakaf <WK> yang didengar oleh orang di sekitarnya",
    teks_varian=["Bagaimana bunyi ucapan ikrar <WK> secara lisan dan siapa saja yang hadir mendengarnya ?"],
    melihat=["<WK> mengucapkan sendiri bahwa <HB> diwakafkan kepada <NZ> untuk <PR> dan ucapan itu didengar oleh dua orang saksi",
             "dengan lisan <WK> menyatakan <HB> diwakafkan kepada <NZ> untuk <PR> di depan dua orang saksi",
             "ucapan ikrar <WK> tentang <HB> untuk <PR> kepada <NZ> terdengar jelas oleh dua orang saksi yang hadir",
             "<WK> berkata bahwa <HB> diserahkan kepada <NZ> sebagai wakaf untuk <PR> dan ucapan itu didengar dua orang saksi"],
    mendengar=["<WK> menyatakan bahwa <HB> diwakafkan kepada <NZ> untuk <PR>", "<WK> mengatakan <HB> menjadi wakaf bagi <PR> yang diurus <NZ>",
               "<WK> berkata <HB> diserahkan kepada <NZ> sebagai wakaf untuk <PR>", "<WK> menegaskan <HB> diwakafkan untuk <PR> dan diurus <NZ>"],
    sebagian=["<WK> mengucapkan ikrar wakaf atas <HB> kepada <NZ>", "<WK> mewakafkan <HB> kepada <NZ> dengan ucapan"],
    berbeda=B("peristiwa", "versi A: wakif mengucapkan ikrar di depan saksi; versi B: tidak ada ucapan ikrar yang didengar saksi - berselisih pada PERISTIWA",
              ["<WK> mengucapkan ikrar wakaf atas <HB> kepada <NZ> di depan saksi", "ucapan ikrar <WK> atas <HB> kepada <NZ> didengar oleh saksi"],
              ["<WK> tidak pernah mengucapkan ikrar wakaf atas <HB> kepada <NZ> di depan saksi", "ucapan ikrar <WK> atas <HB> kepada <NZ> tidak pernah didengar oleh saksi"])),
  gaya="lihat", bentukIkrar="lisan")

T(Q("q-wk-ikrar-tertulis", "pp-wk-ikrar-detail", 52, "inti", "pokok",
    "Siapa yang menulis surat ikrar wakaf itu, dan apakah <WK> menandatangani atau membubuhkan cap jempol di hadapan dua orang saksi ?",
    hal="penulisan dan penandatanganan surat ikrar wakaf", ringkas="penulisan dan penandatanganan surat ikrar wakaf <WK> di hadapan dua orang saksi",
    teks_varian=["Apakah surat ikrar wakaf ditulis sendiri oleh <WK> dan ditandatangani di depan dua orang saksi ?"],
    melihat=["<WK> menandatangani surat ikrar wakaf itu di hadapan dua orang saksi sebagaimana tertera dalam <IK>",
             "di depan dua orang saksi <WK> membubuhkan tanda tangan pada surat ikrar wakafnya sesuai <IK>",
             "surat ikrar wakaf itu ditandatangani <WK> ketika dua orang saksi hadir menyaksikannya sesuai <IK>",
             "<WK> menandatangani ikrar wakafnya dengan disaksikan dua orang saksi yang juga menandatanganinya sesuai <IK>"],
    sebagian=["<WK> menandatangani surat ikrar wakaf itu sesuai <IK>", "surat ikrar wakaf itu ditandatangani <WK> sesuai <IK>"],
    berbeda=B("peristiwa", "versi A: wakif menandatangani surat ikrar di depan dua saksi; versi B: surat ikrar ditandatangani tanpa saksi - berselisih pada PERISTIWA",
              ["<WK> menandatangani surat ikrar wakaf itu di hadapan dua orang saksi sesuai <IK>", "surat ikrar wakaf itu ditandatangani <WK> ketika dua orang saksi hadir sesuai <IK>"],
              ["<WK> menandatangani surat ikrar wakaf itu tanpa dihadiri saksi sesuai <IK>", "surat ikrar wakaf itu ditandatangani <WK> tanpa ada saksi yang hadir sesuai <IK>"])),
  gaya="lihat", bentukIkrar="tertulis")

T(Q("q-wk-ikrar-ppaiw", "pp-wk-ikrar-detail", 53, "inti", "pokok",
    "Apakah <WK> berikrar di hadapan pejabat pembuat akta ikrar wakaf, siapa pejabatnya, di mana dan kapan, dan apakah akta ikrar itu dibacakan ?",
    hal="ikrar wakaf di hadapan pejabat pembuat akta ikrar wakaf", ringkas="ikrar wakaf <WK> di hadapan pejabat pembuat akta ikrar wakaf",
    teks_varian=["Bagaimana <WK> berikrar di depan pejabat pembuat akta ikrar wakaf, apakah ia hadir sendiri dan akta itu dibacakan ?"],
    melihat=["<WK> datang sendiri menghadap pejabat pembuat akta ikrar wakaf dan berikrar sebagaimana tertera dalam <IK>",
             "di kantor pejabat pembuat akta ikrar wakaf <WK> menyatakan ikrarnya sebagaimana tertera dalam <IK> dan aktanya dibacakan",
             "ikrar <WK> dilaksanakan di hadapan pejabat pembuat akta ikrar wakaf sebagaimana tertera dalam <IK> dan ia hadir sendiri",
             "<WK> menghadap pejabat pembuat akta ikrar wakaf sendiri sebagaimana tertera dalam <IK> dan menandatangani akta setelah dibacakan"],
    sebagian=["<WK> berikrar di hadapan pejabat pembuat akta ikrar wakaf sesuai <IK>", "ikrar <WK> dilaksanakan di kantor pejabat pembuat akta ikrar wakaf sesuai <IK>"],
    berbeda=B("peristiwa", "versi A: wakif sendiri berikrar di depan pejabat pembuat akta ikrar wakaf; versi B: wakif tidak pernah menghadap pejabat itu - berselisih pada PERISTIWA",
              ["<WK> datang sendiri berikrar di hadapan pejabat pembuat akta ikrar wakaf sesuai <IK>", "<WK> sendiri yang berikrar di hadapan pejabat pembuat akta ikrar wakaf sesuai <IK>"],
              ["<WK> tidak pernah berikrar di hadapan pejabat pembuat akta ikrar wakaf sesuai <IK>", "<WK> tidak pernah datang ke pejabat pembuat akta ikrar wakaf untuk berikrar sesuai <IK>"])),
  gaya="lihat", bentukIkrar="akta-ikrar-wakaf")

T(Q("q-wk-ikrar-nomor", "pp-wk-ikrar-detail", 54, "pilihan", "pokok",
    "Apa nomor dan tanggal akta ikrar wakaf <WK> itu, dan di mana salinan aktanya disimpan ?",
    hal="nomor tanggal dan penyimpanan akta ikrar wakaf", ringkas="nomor, tanggal dan penyimpanan akta ikrar wakaf <WK>",
    teks_varian=["Akta ikrar wakaf <WK> bernomor berapa, tanggal berapa, dan di mana salinannya tersimpan ?"],
    melihat=["akta ikrar wakaf <WK> bernomor dan bertanggal sebagaimana tertera dalam <IK> dan salinannya disimpan oleh <NZ>",
             "nomor dan tanggal akta ikrar wakaf <WK> tertera dalam <IK> dan salinannya ada pada <NZ>",
             "akta ikrar wakaf <WK> dibuat sesuai <IK> dan salinan aktanya dipegang <NZ>",
             "salinan akta ikrar wakaf <WK> sesuai <IK> disimpan <NZ> sebagai pengurus wakaf"],
    sebagian=["akta ikrar wakaf <WK> dibuat sesuai <IK>", "ikrar wakaf <WK> dituangkan dalam akta sesuai <IK>"],
    berbeda=B("peristiwa", "versi A: akta ikrar wakaf ada sesuai isian perkara; versi B: tidak ada akta ikrar wakaf - berselisih pada PERISTIWA",
              ["akta ikrar wakaf <WK> ada sesuai <IK>", "ikrar wakaf <WK> dituangkan dalam akta sesuai <IK>"],
              ["tidak ada akta ikrar wakaf <WK> sesuai <IK>", "ikrar wakaf <WK> tidak pernah dituangkan dalam akta sesuai <IK>"])),
  gaya="tahu", bentukIkrar="akta-ikrar-wakaf")

T(Q("q-wk-kabul-nazhir", "pp-wk-ikrar-detail", 55, "inti", "pokok",
    "Apakah nazhir hadir ketika <WK> berikrar, dan apakah ia menyatakan menerima harta wakaf itu ?",
    hal="kehadiran nazhir dan penerimaan harta wakaf", ringkas="kehadiran <NZ> ketika <WK> berikrar dan penerimaannya atas harta wakaf",
    teks_varian=["Apakah nazhir menerima harta yang diwakafkan <WK> pada saat ikrar diucapkan ?"],
    melihat=["<NZ> hadir ketika <WK> berikrar dan menyatakan menerima harta wakaf itu",
             "pada saat ikrar diucapkan <NZ> hadir dan menerima harta wakaf dari <WK>",
             "<NZ> menerima langsung harta wakaf dari <WK> dalam pertemuan ikrar itu",
             "dalam ikrar <WK> harta wakaf diterima <NZ> yang hadir di tempat itu"],
    sebagian=["<NZ> hadir ketika <WK> berikrar", "<NZ> berada di tempat ikrar <WK>"],
    berbeda=B("peristiwa", "versi A: nazhir hadir dan menerima harta wakaf; versi B: nazhir tidak hadir ketika ikrar - berselisih pada PERISTIWA",
              ["<NZ> hadir ketika <WK> berikrar dan menerima harta wakaf", "<NZ> menerima langsung harta wakaf dari <WK>"],
              ["<NZ> tidak hadir ketika <WK> berikrar", "<NZ> tidak ada di tempat ketika <WK> berikrar"])),
  gaya="lihat")

T(Q("q-wk-saksi-hadir", "pp-saksi-ikrar", 61, "pilihan", "pokok",
    "Apakah kedua saksi ikrar hadir bersamaan ketika <WK> berikrar atau menandatangani akta ?",
    hal="kehadiran dua orang saksi ikrar secara bersamaan", ringkas="kehadiran kedua saksi ikrar secara bersamaan ketika <WK> berikrar",
    teks_varian=["Apakah dua orang saksi ikrar berada di tempat yang sama pada saat <WK> berikrar ?"],
    melihat=["kedua saksi ikrar hadir bersamaan di tempat yang sama ketika <WK> berikrar",
             "dua orang saksi ikrar itu sama-sama berada di depan <WK> ketika ikrar diucapkan",
             "ketika <WK> berikrar kedua saksi hadir sekaligus dan menyaksikannya",
             "pada saat ikrar diucapkan <WK> dikelilingi dua orang saksi yang hadir bersamaan"],
    sebagian=["salah seorang saksi ikrar hadir ketika <WK> berikrar", "seorang dari saksi ikrar itu hadir ketika <WK> berikrar"],
    berbeda=B("jumlah", "versi A: dua orang saksi hadir bersamaan; versi B: hanya satu orang saksi hadir - berselisih pada JUMLAH (saksi yang hadir)",
              ["dua orang saksi hadir bersamaan ketika <WK> berikrar", "kedua saksi ikrar sama-sama hadir ketika <WK> berikrar"],
              ["hanya satu orang saksi yang hadir ketika <WK> berikrar", "saksi ikrar yang hadir ketika <WK> berikrar hanya seorang"])),
  gaya="lihat")

T(Q("q-wk-saksi-hubungan", "pp-saksi-ikrar", 62, "pilihan", "pokok",
    "Apa hubungan kedua saksi ikrar dengan <WK> dan dengan nazhir, apakah salah satunya nazhir atau ahli waris wakif ?",
    hal="hubungan saksi ikrar dengan wakif dan nazhir", ringkas="hubungan kedua saksi ikrar dengan <WK> dan <NZ>",
    teks_varian=["Apakah kedua saksi ikrar itu nazhir atau ahli waris <WK> ?"],
    melihat=["kedua saksi ikrar itu tidak termasuk nazhir dan bukan ahli waris <WK>",
             "dua orang saksi ikrar itu tidak mempunyai hubungan waris dengan <WK> dan tidak menjadi pengurus wakaf",
             "saksi ikrar yang hadir itu tidak menerima apa pun dari wakaf <WK> dan tidak termasuk ahli warisnya",
             "kedua saksi ikrar tidak ikut mengurus wakaf <WK> dan tidak berhak atas warisannya"],
    sebagian=["salah satu saksi ikrar itu tidak termasuk ahli waris <WK>", "seorang saksi ikrar itu tidak menerima apa pun dari wakaf <WK>"],
    berbeda=B("peristiwa", "versi A: saksi ikrar bukan nazhir dan bukan ahli waris; versi B: salah satu saksi ikrar adalah nazhir - berselisih pada PERISTIWA",
              ["kedua saksi ikrar itu tidak termasuk nazhir dan bukan ahli waris <WK>", "dua orang saksi ikrar itu bukan nazhir dan tidak mempunyai hubungan waris dengan <WK>"],
              ["salah satu saksi ikrar itu adalah <NZ> yang menerima wakaf <WK>", "seorang dari saksi ikrar itu justru <NZ> yang menerima wakaf <WK>"])),
  gaya="tahu")

# ------------------------------------------------------------------ nazhir
T(Q("q-wk-nazhir-terdaftar", "pp-wk-nazhir-detail", 72, "inti", "pokok",
    "Apakah nazhir terdaftar pada Kantor Urusan Agama setempat dan pernah mengucapkan sumpah sebelum melaksanakan tugasnya ?",
    hal="pendaftaran nazhir pada Kantor Urusan Agama", ringkas="pendaftaran <NZ> pada Kantor Urusan Agama dan sumpahnya sebagai nazhir",
    teks_varian=["Apakah ada bukti bahwa nazhir sudah terdaftar di Kantor Urusan Agama dan disumpah sebagai nazhir ?"],
    melihat=["<NZ> tidak pernah didaftarkan sebagai nazhir pada Kantor Urusan Agama setempat",
             "pendaftaran <NZ> sebagai nazhir pada Kantor Urusan Agama tidak pernah dilakukan",
             "tidak ada catatan pendaftaran <NZ> sebagai nazhir di Kantor Urusan Agama setempat",
             "<NZ> menjalankan tugas sebagai nazhir tanpa terdaftar pada Kantor Urusan Agama"],
    sebagian=["pendaftaran <NZ> sebagai nazhir tidak pernah terdengar di warga", "warga tidak pernah mendengar pendaftaran <NZ> sebagai nazhir"],
    berbeda=B("peristiwa", "versi A: nazhir tidak terdaftar pada Kantor Urusan Agama; versi B: nazhir terdaftar pada Kantor Urusan Agama - berselisih pada PERISTIWA",
              ["<NZ> tidak terdaftar sebagai nazhir pada Kantor Urusan Agama", "pendaftaran <NZ> sebagai nazhir tidak pernah dilakukan"],
              ["<NZ> terdaftar sebagai nazhir pada Kantor Urusan Agama", "pendaftaran <NZ> sebagai nazhir sudah dilakukan"])),
  gaya="tahu", keadaanNazhir="belum-terdaftar")

T(Q("q-wk-nazhir-tugas", "pp-wk-nazhir-detail", 73, "pilihan", "pokok",
    "Bagaimana nazhir menjalankan tugasnya, apakah ia mengurus harta wakaf dan melaporkan pengelolaannya ?",
    hal="pelaksanaan tugas nazhir mengurus dan melaporkan harta wakaf", ringkas="pelaksanaan tugas <NZ> mengurus harta wakaf <WK> dan melaporkannya",
    teks_varian=["Apakah nazhir mengurus harta wakaf dengan baik dan memberi laporan kepada pihak yang berwenang ?"],
    melihat=["<NZ> mengurus harta wakaf <WK> dengan baik dan melaporkan pengelolaannya kepada warga",
             "setiap tahun <NZ> menyampaikan laporan pengelolaan harta wakaf <WK> kepada pihak yang berwenang",
             "tugas <NZ> mengurus harta wakaf <WK> dijalankan sesuai peruntukannya dan dilaporkan",
             "<NZ> memelihara harta wakaf <WK> serta melaporkan hasilnya secara terbuka"],
    sebagian=["<NZ> mengurus harta wakaf <WK> setiap hari", "<NZ> memelihara harta wakaf <WK> dengan baik"],
    berbeda=B("peristiwa", "versi A: nazhir mengurus dan melaporkan harta wakaf; versi B: nazhir tidak pernah melaporkan harta wakaf - berselisih pada PERISTIWA",
              ["<NZ> mengurus dan melaporkan harta wakaf <WK>", "<NZ> menyampaikan laporan pengelolaan harta wakaf <WK>"],
              ["<NZ> tidak pernah melaporkan harta wakaf <WK>", "<NZ> tidak pernah menyampaikan laporan pengelolaan harta wakaf <WK>"])),
  gaya="lihat")

T(Q("q-wk-nazhir-lalai", "pp-wk-nazhir-detail", 74, "inti", "pokok",
    "Apakah nazhir lalai mengurus harta wakaf atau memakai hasilnya untuk kepentingan lain, apa buktinya dan sejak kapan ?",
    hal="kelalaian atau penyalahgunaan hasil wakaf oleh nazhir", ringkas="kelalaian atau penyalahgunaan hasil wakaf <WK> oleh <NZ>",
    teks_varian=["Apakah hasil harta wakaf dipakai nazhir bukan untuk peruntukannya, atau harta itu dibiarkan terlantar ?"],
    melihat=["<NZ> lalai mengurus harta wakaf <WK> hingga terbengkalai dan hasilnya dipakai untuk keperluan pribadi",
             "hasil harta wakaf <WK> dipakai <NZ> untuk kepentingannya sendiri dan harta itu terlantar",
             "<NZ> membiarkan harta wakaf <WK> rusak dan mengambil hasilnya untuk dirinya",
             "pengurusan harta wakaf <WK> oleh <NZ> terbengkalai sejak lama dan hasilnya dinikmati sendiri"],
    sebagian=["harta wakaf <WK> terbengkalai di bawah pengurusan <NZ>", "pengurusan harta wakaf <WK> oleh <NZ> kurang terawat"],
    berbeda=B("peristiwa", "versi A: nazhir lalai dan memakai hasil wakaf untuk dirinya; versi B: nazhir mengurus wakaf dengan baik - berselisih pada PERISTIWA",
              ["<NZ> lalai mengurus harta wakaf <WK> dan memakai hasilnya untuk dirinya", "harta wakaf <WK> terbengkalai karena kelalaian <NZ>"],
              ["<NZ> mengurus harta wakaf <WK> dengan baik dan hasilnya dipakai untuk wakaf", "harta wakaf <WK> terawat berkat pengurusan <NZ>"])),
  gaya="lihat", keadaanNazhir="tidak-amanah")

T(Q("q-wk-nazhir-meninggal", "pp-wk-nazhir-detail", 75, "inti", "pokok",
    "Kapan nazhir meninggal dunia, siapa yang menggantikannya, dan apakah penggantinya diangkat secara resmi ?",
    hal="meninggalnya nazhir dan penggantinya", ringkas="meninggalnya <NZ> dan pengganti nazhir atas harta wakaf <WK>",
    teks_varian=["Setelah nazhir meninggal dunia siapa yang mengurus harta wakaf dan apakah ia diangkat secara resmi ?"],
    melihat=["<NZ> meninggal dunia dan harta wakaf <WK> kemudian diurus oleh orang yang ditunjuk warga",
             "setelah <NZ> wafat pengurusan harta wakaf <WK> dilanjutkan oleh penggantinya yang ditunjuk bersama",
             "pengganti <NZ> sebagai pengurus harta wakaf <WK> ditunjuk setelah ia meninggal dunia",
             "sepeninggal <NZ> harta wakaf <WK> diurus oleh penggantinya yang disepakati warga"],
    sebagian=["<NZ> meninggal dunia dan harta wakaf <WK> kemudian diurus orang lain", "setelah <NZ> wafat harta wakaf <WK> diurus orang lain"],
    berbeda=B("peristiwa", "versi A: pengganti nazhir ditunjuk secara resmi; versi B: pengganti nazhir ditunjuk tanpa pengangkatan resmi - berselisih pada PERISTIWA",
              ["pengganti <NZ> diangkat secara resmi untuk mengurus harta wakaf <WK>", "penggantian <NZ> atas harta wakaf <WK> dilakukan secara resmi"],
              ["pengganti <NZ> ditunjuk tanpa pengangkatan resmi untuk mengurus harta wakaf <WK>", "penggantian <NZ> atas harta wakaf <WK> dilakukan tanpa pengangkatan resmi"])),
  gaya="lihat", keadaanNazhir="sudah-meninggal")

# ------------------------------------------------------------------ pendaftaran dan sertipikat
T(Q("q-wk-daftar-sudah", "pp-wk-pendaftaran", 112, "inti", "pokok",
    "Apakah harta wakaf itu sudah disertipikatkan atau didaftarkan sebagai tanah wakaf, atas nama siapa, dan kapan ?",
    hal="pendaftaran dan sertipikat wakaf atas harta benda", ringkas="pendaftaran dan sertipikat wakaf atas <HB> atas nama <NZ>",
    teks_varian=["Atas nama siapa sertipikat atau surat pendaftaran wakaf atas harta itu dan kapan dibuat ?"],
    melihat=["<HB> sudah didaftarkan sebagai harta wakaf atas nama <NZ> dan surat pendaftarannya pernah diperlihatkan",
             "sertipikat wakaf atas <HB> sudah terbit atas nama <NZ> dan salinannya dilihat warga",
             "pendaftaran <HB> sebagai harta wakaf atas nama <NZ> sudah selesai dan suratnya ada",
             "surat wakaf atas <HB> telah dibuat atas nama <NZ> sebagai pengurus wakaf"],
    sebagian=["<HB> sudah didaftarkan sebagai harta wakaf", "sertipikat wakaf atas <HB> sudah terbit"],
    berbeda=B("peristiwa", "versi A: harta wakaf sudah didaftarkan; versi B: harta wakaf belum didaftarkan - berselisih pada PERISTIWA",
              ["<HB> sudah didaftarkan sebagai harta wakaf atas nama <NZ>", "sertipikat wakaf atas <HB> sudah terbit atas nama <NZ>"],
              ["<HB> belum didaftarkan sebagai harta wakaf atas nama <NZ>", "sertipikat wakaf atas <HB> belum terbit atas nama <NZ>"])),
  gaya="campur", pendaftaranWakaf="terdaftar")

T(Q("q-wk-daftar-belum", "pp-wk-pendaftaran", 113, "inti", "pokok",
    "Mengapa harta wakaf itu belum disertipikatkan atau didaftarkan, dan atas nama siapa surat tanahnya sekarang ?",
    hal="belum didaftarkannya harta wakaf dan atas nama siapa suratnya", ringkas="belum didaftarkannya <HB> sebagai harta wakaf",
    teks_varian=["Apa sebab harta yang diwakafkan itu belum didaftarkan sebagai wakaf dan atas nama siapa surat haknya sekarang ?"],
    melihat=["<HB> belum didaftarkan sebagai harta wakaf dan surat haknya masih atas nama <WK>",
             "sertipikat wakaf atas <HB> belum pernah diurus dan suratnya masih tercatat atas nama <WK>",
             "pendaftaran <HB> sebagai harta wakaf belum dilakukan sehingga surat haknya masih atas nama <WK>",
             "<HB> masih bersurat atas nama <WK> karena belum pernah didaftarkan sebagai harta wakaf"],
    sebagian=["<HB> belum didaftarkan sebagai harta wakaf", "sertipikat wakaf atas <HB> belum pernah diurus"],
    berbeda=B("peristiwa", "versi A: harta wakaf belum didaftarkan; versi B: harta wakaf sudah didaftarkan - berselisih pada PERISTIWA",
              ["<HB> belum didaftarkan sebagai harta wakaf", "sertipikat wakaf atas <HB> belum pernah diurus"],
              ["<HB> sudah didaftarkan sebagai harta wakaf", "sertipikat wakaf atas <HB> sudah diurus"])),
  gaya="tahu", pendaftaranWakaf="belum-terdaftar")

# ------------------------------------------------------------------ peruntukan
T(Q("q-wk-peruntukan-dipakai", "pp-wk-peruntukan-detail", 92, "pilihan", "pokok",
    "Untuk apa harta wakaf itu dipakai sejak diwakafkan sampai sekarang, dan siapa yang memakainya ?",
    hal="pemakaian harta wakaf sejak diwakafkan sampai sekarang", ringkas="pemakaian <HB> sejak diwakafkan <WK> sampai sekarang",
    teks_varian=["Apa saja kegiatan yang dilakukan di atas harta wakaf itu sejak diwakafkan sampai sekarang ?"],
    melihat=["sejak diwakafkan <WK> <HB> dipakai untuk <PR> dan dimanfaatkan warga sampai sekarang",
             "<HB> yang diwakafkan <WK> digunakan warga untuk <PR> dari dahulu hingga saat ini",
             "pemakaian <HB> dari <WK> tetap untuk <PR> sejak awal sampai sekarang",
             "warga memakai <HB> dari <WK> untuk <PR> sejak wakaf itu diikrarkan"],
    sebagian=["<HB> dari <WK> dipakai untuk <PR> pada awalnya", "pada mulanya <HB> dari <WK> dipakai untuk <PR>"],
    berbeda=B("peristiwa", "versi A: harta wakaf dipakai sesuai peruntukan sampai sekarang; versi B: harta wakaf dipakai untuk keperluan lain - berselisih pada PERISTIWA",
              ["<HB> dari <WK> dipakai untuk <PR> sampai sekarang", "pemakaian <HB> dari <WK> tetap untuk <PR> sampai sekarang"],
              ["<HB> dari <WK> dipakai untuk keperluan lain selain <PR> sampai sekarang", "pemakaian <HB> dari <WK> sudah berubah dari <PR> sampai sekarang"])),
  gaya="lihat")

T(Q("q-wk-peruntukan-berubah", "pp-wk-peruntukan-detail", 131, "tambahan", "pokok",
    "Sejak kapan peruntukan harta wakaf itu berubah, siapa yang mengubahnya, dan apa yang dipakai sekarang menggantikannya ?",
    hal="perubahan peruntukan harta wakaf dan pelakunya", ringkas="perubahan peruntukan <HB> dari <PR> dan pelakunya",
    teks_varian=["Apakah peruntukan harta wakaf itu pernah diganti, kapan, dan oleh siapa ?"],
    melihat=["peruntukan <HB> dari <PR> diubah oleh <NZ> menjadi kegiatan lain yang tidak sama dengan ikrar wakif",
             "<NZ> mengalihkan pemakaian <HB> dari <PR> kepada kegiatan lain tidak sesuai ikrar",
             "setelah beberapa tahun <HB> yang diwakafkan untuk <PR> dipakai <NZ> bagi kegiatan lain yang tidak sama dengan ikrar",
             "<HB> tidak lagi dipakai untuk <PR> karena <NZ> mengubah peruntukannya"],
    berbeda=B("pelaku", "versi A: nazhir mengubah peruntukan; versi B: pihak lain yang mengubah peruntukan - berselisih pada PELAKU",
              ["<NZ> yang mengubah peruntukan <HB> dari <PR>", "perubahan peruntukan <HB> dari <PR> dilakukan oleh <NZ>"],
              ["pihak lain yang mengubah peruntukan <HB> dari <PR> dan bukan <NZ>", "perubahan peruntukan <HB> dari <PR> dilakukan bukan oleh <NZ> melainkan pihak lain"])),
  gaya="lihat", pokokTuntutan="D")

T(Q("q-wk-peruntukan-ahliwaris", "pp-wk-peruntukan-detail", 132, "tambahan", "pokok",
    "Apakah ahli waris wakif atau warga diberi tahu dan menyetujui perubahan peruntukan itu, dan apakah ada izin tertulis dari pejabat yang berwenang ?",
    hal="pemberitahuan dan persetujuan atas perubahan peruntukan harta wakaf", ringkas="pemberitahuan dan persetujuan atas perubahan peruntukan <HB> dari <PR>",
    teks_varian=["Apakah perubahan pemakaian harta wakaf itu pernah dibicarakan dengan ahli waris wakif dan disetujui secara tertulis ?"],
    melihat=["perubahan peruntukan <HB> dari <PR> tidak pernah dibicarakan dengan ahli waris wakif",
             "tidak ada izin tertulis yang pernah diperlihatkan atas perubahan peruntukan <HB> dari <PR>",
             "ahli waris wakif tidak pernah diminta menyetujui perubahan peruntukan <HB> dari <PR>",
             "perubahan pemakaian <HB> dari <PR> dilakukan tanpa pemberitahuan kepada ahli waris wakif"],
    berbeda=B("peristiwa", "versi A: perubahan tidak dibicarakan dan tanpa izin tertulis; versi B: perubahan sudah dibicarakan dan disetujui tertulis - berselisih pada PERISTIWA",
              ["perubahan peruntukan <HB> dari <PR> tidak pernah dibicarakan dengan ahli waris", "tidak ada izin tertulis atas perubahan peruntukan <HB> dari <PR>"],
              ["perubahan peruntukan <HB> dari <PR> sudah dibicarakan dengan ahli waris", "ada izin tertulis atas perubahan peruntukan <HB> dari <PR>"])),
  gaya="lihat", pokokTuntutan="D")

# ------------------------------------------------------------------ ahli waris wakif
T(Q("q-wk-ahliwaris-meminta", "pp-wk-ahliwaris", 111, "inti", "pokok",
    "Apakah ahli waris <WK> pernah meminta harta wakaf itu dikembalikan atau diurus ulang, kepada siapa, dan apa tanggapannya ?",
    hal="permintaan ahli waris wakif atas harta wakaf", ringkas="permintaan ahli waris <WK> atas harta wakaf dan tanggapan nazhir",
    teks_varian=["Apakah ahli waris <WK> pernah mendatangi nazhir untuk meminta penjelasan atau pengembalian harta wakaf ?"],
    melihat=["ahli waris <WK> pernah mendatangi <NZ> dan meminta penjelasan mengenai pengurusan <HB>",
             "ahli waris <WK> meminta kepada <NZ> agar pengurusan <HB> disesuaikan dengan ikrar wakif",
             "permintaan ahli waris <WK> kepada <NZ> atas <HB> disampaikan beberapa kali dengan baik-baik",
             "ahli waris <WK> berulang kali menemui <NZ> untuk membicarakan <HB>"],
    sebagian=["ahli waris <WK> pernah menemui <NZ> mengenai <HB>", "ahli waris <WK> pernah membicarakan <HB> dengan <NZ>"],
    berbeda=B("peristiwa", "versi A: ahli waris pernah meminta kepada nazhir; versi B: ahli waris tidak pernah meminta apa pun - berselisih pada PERISTIWA",
              ["ahli waris <WK> pernah meminta kepada <NZ> mengenai <HB>", "ahli waris <WK> pernah menemui <NZ> untuk membicarakan <HB>"],
              ["ahli waris <WK> tidak pernah meminta apa pun kepada <NZ> mengenai <HB>", "ahli waris <WK> tidak pernah menemui <NZ> untuk membicarakan <HB>"])),
  gaya="lihat")

T(Q("q-wk-ahliwaris-menguasai", "pp-wk-ahliwaris", 114, "inti", "pokok",
    "Siapa yang menguasai harta wakaf itu setelah <WK> meninggal dunia, apakah ahli warisnya, dan sejak kapan ?",
    hal="penguasaan harta wakaf oleh ahli waris wakif setelah wakif meninggal", ringkas="penguasaan <HB> oleh ahli waris <WK> setelah <WK> meninggal dunia",
    teks_varian=["Apakah setelah <WK> wafat harta wakaf itu dikuasai ahli warisnya, dan sejak kapan ?"],
    melihat=["setelah <WK> meninggal dunia ahli warisnya menguasai <HB> dan memakainya sendiri",
             "<HB> dikuasai ahli waris <WK> sejak ia wafat dan dipakai sendiri oleh ahli waris",
             "sepeninggal <WK> ahli warisnya mengambil alih <HB> dan mengelolanya sendiri",
             "ahli waris <WK> menguasai <HB> sejak wakif meninggal dunia hingga sekarang"],
    sebagian=["ahli waris <WK> menguasai <HB> setelah wakif meninggal dunia", "<HB> berada dalam penguasaan ahli waris <WK>"],
    berbeda=B("pelaku", "versi A: ahli waris wakif yang menguasai harta wakaf; versi B: nazhir yang menguasai harta wakaf - berselisih pada PELAKU",
              ["ahli waris <WK> yang menguasai <HB> setelah wakif meninggal dunia", "<HB> dikuasai ahli waris <WK> setelah wakif wafat"],
              ["<NZ> yang menguasai <HB> setelah wakif meninggal dunia", "<HB> dikuasai <NZ> setelah wakif wafat"])),
  gaya="lihat", statusWakif="sudah-meninggal")

# ------------------------------------------------------------------ dalil batal
T(Q("q-wk-tanpa-akta", "pp-wk-dalil-batal", 115, "inti", "pokok",
    "Apakah ikrar wakaf <WK> itu hanya dibuat dalam surat di bawah tangan tanpa akta ikrar wakaf, tanpa nomor, dan siapa yang membuatnya ?",
    hal="ikrar wakaf yang hanya dibuat di bawah tangan tanpa akta ikrar wakaf", ringkas="ikrar wakaf <WK> yang hanya dibuat di bawah tangan tanpa akta ikrar wakaf",
    teks_varian=["Apakah ada akta ikrar wakaf bernomor atau hanya surat sederhana yang dibuat ketika <WK> berikrar ?"],
    melihat=["ikrar wakaf <WK> hanya dibuat dalam surat di bawah tangan tanpa nomor akta ikrar wakaf",
             "surat ikrar wakaf <WK> tidak bernomor sebagaimana akta pejabat",
             "ikrar wakaf <WK> hanya dituangkan dalam surat sederhana tanpa akta ikrar wakaf",
             "tidak ada akta ikrar wakaf bernomor atas ikrar <WK> selain surat di bawah tangan"],
    berbeda=B("peristiwa", "versi A: ikrar hanya surat di bawah tangan tanpa akta; versi B: ikrar dituangkan dalam akta bernomor - berselisih pada PERISTIWA",
              ["ikrar wakaf <WK> hanya dibuat dalam surat di bawah tangan tanpa akta", "ikrar wakaf <WK> tidak dituangkan dalam akta ikrar wakaf"],
              ["ikrar wakaf <WK> dituangkan dalam akta ikrar wakaf bernomor", "ikrar wakaf <WK> dibuat dalam akta ikrar wakaf yang bernomor"])),
  gaya="tahu", dalilBatal="ikrar-tanpa-akta")

T(Q("q-wk-tanpa-saksi", "pp-wk-dalil-batal", 116, "inti", "pokok",
    "Apakah ada orang yang menyaksikan <WK> berikrar, siapa saja, dan apakah saksi sendiri hadir ?",
    hal="saksi yang menyaksikan ikrar wakaf", ringkas="orang-orang yang menyaksikan <WK> berikrar",
    teks_varian=["Siapa yang hadir dan menyaksikan ketika <WK> berikrar mewakafkan hartanya ?"],
    melihat=["ikrar wakaf itu diucapkan <WK> tanpa ada seorang pun yang menyaksikan",
             "ketika berikrar <WK> hanya berdua dengan nazhir tanpa saksi lain",
             "tidak ada saksi yang hadir ketika <WK> berikrar mewakafkan hartanya",
             "ikrar wakaf <WK> berlangsung tanpa dihadiri saksi"],
    berbeda=B("jumlah", "versi A: ikrar diucapkan di depan dua saksi; versi B: ikrar diucapkan di depan seorang saksi saja - berselisih pada JUMLAH (saksi)",
              ["ikrar wakaf itu diucapkan <WK> di depan dua orang saksi", "ketika berikrar <WK> disaksikan dua orang saksi"],
              ["ikrar wakaf itu diucapkan <WK> di depan seorang saksi saja", "ketika berikrar <WK> hanya disaksikan seorang saksi"])),
  gaya="lihat", dalilBatal="tanpa-saksi")

T(Q("q-wk-bukan-milik", "pp-wk-dalil-batal", 117, "inti", "pokok",
    "Apakah harta yang diwakafkan itu sepenuhnya milik <WK>, atau sebagian milik orang lain atau harta bersama, dan siapa pemiliknya ?",
    hal="kepemilikan harta wakaf yang dipersoalkan bukan hak wakif", ringkas="kepemilikan <HB> yang dipersoalkan bukan hak <WK>",
    teks_varian=["Apakah <WK> sendiri pemilik harta yang diwakafkannya, atau harta itu milik orang lain atau harta bersama ?"],
    melihat=["<HB> yang diwakafkan <WK> adalah harta bersama dengan pasangannya dan bukan miliknya sendiri",
             "<HB> sebenarnya milik orang lain yang tercatat atas nama pihak ketiga dan bukan milik <WK>",
             "benda <HB> yang diwakafkan <WK> diperoleh dari harta bersama sehingga bukan hanya miliknya",
             "<WK> hanya memegang <HB> sedangkan pemiliknya bukan dirinya melainkan orang lain yang dikenal warga"],
    berbeda=B("peristiwa", "versi A: harta wakaf milik wakif sendiri; versi B: harta wakaf milik orang lain atau harta bersama - berselisih pada PERISTIWA",
              ["<HB> yang diwakafkan <WK> adalah miliknya sendiri", "<HB> sepenuhnya hak <WK> yang diwakafkannya"],
              ["<HB> yang diwakafkan <WK> bukan miliknya melainkan milik orang lain atau harta bersama", "<HB> bukan hak <WK> sendiri melainkan milik orang lain atau harta bersama"])),
  gaya="tahu", dalilBatal="bukan-milik-wakif")

T(Q("q-wk-ttd-asli", "pp-wk-dalil-batal", 118, "inti", "pokok",
    "Apakah tanda tangan atau cap jempol pada surat ikrar wakaf itu benar milik <WK>, dan bagaimana saksi mengetahuinya ?",
    hal="keaslian tanda tangan atau cap jempol wakif", ringkas="keaslian tanda tangan atau cap jempol <WK> pada surat ikrar wakaf",
    teks_varian=["Apakah saksi mengenal tanda tangan <WK> dan apakah tanda tangan pada surat ikrar wakaf itu sama dengannya ?"],
    melihat=["tanda tangan pada surat ikrar wakaf itu sama dengan tanda tangan <WK> yang dikenal warga dan dibubuhkan olehnya sendiri",
             "<WK> sendiri yang membubuhkan tanda tangan pada surat ikrar wakaf itu dan tanda tangannya sama dengan yang biasa dipakainya",
             "tanda tangan di surat ikrar wakaf itu benar milik <WK> karena sama dengan tanda tangan yang sering dipakainya",
             "cap jempol atau tanda tangan pada surat ikrar wakaf itu dibubuhkan <WK> sendiri dan dilihat banyak orang"],
    sebagian=["tanda tangan pada surat ikrar wakaf itu mirip dengan tanda tangan <WK>", "tanda tangan di surat ikrar wakaf itu sama dengan tanda tangan <WK> yang biasa dipakainya"],
    berbeda=B("pelaku", "versi A: tanda tangan dibubuhkan wakif sendiri; versi B: tanda tangan dibubuhkan orang lain - berselisih pada PELAKU",
              ["<WK> sendiri yang membubuhkan tanda tangan pada surat ikrar wakaf itu", "tanda tangan pada surat ikrar wakaf itu dibubuhkan oleh <WK> sendiri"],
              ["tanda tangan pada surat ikrar wakaf itu dibubuhkan oleh orang lain bukan <WK>", "yang membubuhkan tanda tangan pada surat ikrar wakaf itu orang lain dan bukan <WK>"])),
  gaya="campur", dalilBatal="tanda-tangan-dipalsukan")

# ------------------------------------------------------------------ pengalihan
T(Q("q-wk-dijual", "pp-wk-pengalihan-detail", 121, "tambahan", "pokok",
    "Siapa yang menjual, menghibahkan atau mewariskan harta wakaf itu, kepada siapa, kapan, dan berapa harganya ?",
    hal="penjualan atau pengalihan harta wakaf dan pihak yang menerimanya", ringkas="penjualan atau pengalihan <HB> dan pihak penerimanya",
    teks_varian=["Apakah harta wakaf itu pernah berpindah tangan lewat jual beli, hibah atau waris, dan kepada siapa ?"],
    melihat=["<HB> yang diwakafkan <WK> dijual kepada orang lain tanpa izin dan hal itu diketahui warga",
             "pihak yang menguasai <HB> menjual harta wakaf <WK> kepada pembeli tanpa izin",
             "<HB> milik wakaf <WK> dihibahkan kepada orang lain tanpa izin dan perbuatan itu diketahui warga",
             "harta wakaf <WK> berupa <HB> dialihkan kepada pihak lain tanpa izin"],
    berbeda=B("peristiwa", "versi A: harta wakaf dijual atau dialihkan; versi B: harta wakaf tidak pernah dijual atau dialihkan - berselisih pada PERISTIWA",
              ["<HB> yang diwakafkan <WK> dijual atau dialihkan kepada orang lain", "harta wakaf <WK> berupa <HB> berpindah tangan kepada pihak lain"],
              ["<HB> yang diwakafkan <WK> tidak pernah dijual atau dialihkan kepada orang lain", "harta wakaf <WK> berupa <HB> tidak pernah berpindah tangan kepada pihak lain"])),
  gaya="lihat", bentukPengalihan="dijual-dihibahkan")

T(Q("q-wk-dijaminkan", "pp-wk-pengalihan-detail", 122, "tambahan", "pokok",
    "Apakah harta wakaf itu pernah dijaminkan atau digadaikan kepada bank atau orang lain, oleh siapa dan untuk hutang apa ?",
    hal="penjaminan atau penggadaian harta wakaf", ringkas="penjaminan atau penggadaian <HB> oleh pihak yang menguasainya",
    teks_varian=["Apakah ada pihak yang menjadikan harta wakaf itu agunan hutang, dan siapa yang berhutang ?"],
    melihat=["pihak yang menguasai <HB> menjadikan harta wakaf <WK> sebagai jaminan hutang tanpa izin",
             "<HB> yang diwakafkan <WK> digadaikan kepada orang lain untuk hutang tanpa izin",
             "harta wakaf <WK> berupa <HB> dijadikan agunan oleh pengurusnya tanpa izin",
             "hutang pihak yang menguasai dijamin dengan <HB> wakaf <WK> tanpa izin"],
    berbeda=B("peristiwa", "versi A: harta wakaf pernah dijaminkan; versi B: harta wakaf tidak pernah dijaminkan - berselisih pada PERISTIWA",
              ["<HB> wakaf <WK> pernah dijadikan jaminan hutang", "harta wakaf <WK> berupa <HB> pernah digadaikan"],
              ["<HB> wakaf <WK> tidak pernah dijadikan jaminan hutang", "harta wakaf <WK> berupa <HB> tidak pernah digadaikan"])),
  gaya="lihat", bentukPengalihan="dijaminkan")

T(Q("q-wk-ganti-rugi", "pp-wk-pengalihan-detail", 123, "tambahan", "pokok",
    "Apakah harta wakaf itu pernah dibebaskan atau diganti rugi oleh pemerintah atau pihak lain, siapa yang menerima gantinya, dan apakah ada pengganti benda wakaf ?",
    hal="ganti rugi atau pembebasan harta wakaf untuk kepentingan umum", ringkas="ganti rugi atau pembebasan <HB> dan penerima gantinya",
    teks_varian=["Siapa yang menerima uang ganti rugi atas harta wakaf itu dan apakah diganti dengan benda wakaf yang lain ?"],
    melihat=["<HB> yang diwakafkan <WK> sudah diganti rugi oleh pihak pemerintah dan gantinya diterima pengurus wakaf",
             "ganti rugi atas <HB> wakaf <WK> telah dibayarkan kepada pihak yang mengurusnya",
             "pembebasan <HB> wakaf <WK> untuk kepentingan umum sudah dibayar ganti ruginya",
             "uang ganti rugi <HB> wakaf <WK> diterima pengurus wakaf"],
    berbeda=B("peristiwa", "versi A: harta wakaf sudah diganti rugi; versi B: harta wakaf belum pernah diganti rugi - berselisih pada PERISTIWA",
              ["<HB> wakaf <WK> sudah diganti rugi", "ganti rugi atas <HB> wakaf <WK> sudah dibayarkan"],
              ["<HB> wakaf <WK> belum pernah diganti rugi", "ganti rugi atas <HB> wakaf <WK> belum pernah dibayarkan"])),
  gaya="lihat", bentukPengalihan="ganti-rugi-pemerintah")

# ------------------------------------------------------------------ penguasaan dan akibat
T(Q("q-wk-hasil-dikuasai", "pp-wk-akibat", 151, "inti", "pokok",
    "Siapa yang menguasai dan menikmati hasil harta wakaf <WK> itu sekarang, sejak kapan, dan kira-kira berapa hasilnya ?",
    hal="penguasaan dan hasil harta wakaf sekarang", ringkas="penguasaan dan hasil <HB> sampai sekarang",
    teks_varian=["Sejak kapan dan oleh siapa harta wakaf <WK> itu dikuasai serta hasilnya dinikmati ?"],
    melihat=["sejak ikrar <WK> pihak <LW> menguasai <HB> dan menikmati hasilnya sampai sekarang",
             "<HB> dikuasai <LW> sejak <WK> mewakafkannya dan hasilnya diambil <LW> setiap tahun",
             "hasil <HB> dinikmati <LW> sejak ikrar <WK> hingga saat ini",
             "<LW> yang mengelola <HB> dan memanfaatkan hasilnya sejak ikrar <WK>"],
    sebagian=["<LW> menguasai <HB> sejak ikrar <WK>", "<HB> berada dalam penguasaan <LW> sejak ikrar <WK>"],
    berbeda=B("pelaku", "versi A: yang menikmati hasil harta wakaf adalah pihak lawan; versi B: yang menikmati hasil adalah pengaju - berselisih pada PELAKU",
              ["<LW> yang menikmati hasil <HB> sejak ikrar <WK>", "hasil <HB> dinikmati <LW> sejak ikrar <WK>"],
              ["<PM> yang menikmati hasil <HB> sejak ikrar <WK>", "hasil <HB> dinikmati <PM> sejak ikrar <WK>"])),
  gaya="lihat", tuntutanTambahan="ganti-rugi")

T(Q("q-wk-dialihkan", "pp-wk-akibat", 152, "inti", "pokok",
    "Apakah ada tanda harta wakaf itu akan dijual, digadaikan atau dialihkan oleh pihak yang menguasainya, dan apa yang saksi lihat atau dengar ?",
    hal="kekhawatiran harta wakaf dijual atau dialihkan", ringkas="kemungkinan <HB> dijual, digadaikan atau dialihkan oleh pihak yang menguasainya",
    teks_varian=["Apakah pernah ada pembicaraan atau tindakan menjual atau menjaminkan harta wakaf itu ?"],
    melihat=["<LW> pernah membicarakan rencana menjual <HB> kepada orang lain di depan warga",
             "ada pembicaraan <LW> untuk menggadaikan <HB> sehingga harta itu terancam berpindah tangan",
             "<LW> pernah menawarkan <HB> kepada pembeli di depan warga",
             "<LW> diketahui berencana mengalihkan <HB> kepada pihak lain"],
    sebagian=["pernah terdengar <HB> akan dijual oleh yang menguasainya", "ada kabar <HB> hendak dialihkan oleh yang menguasainya"],
    berbeda=B("peristiwa", "versi A: pihak yang menguasai berencana menjual atau mengalihkan harta wakaf; versi B: tidak ada rencana mengalihkan harta wakaf - berselisih pada PERISTIWA",
              ["<LW> berencana menjual atau mengalihkan <HB>", "<LW> pernah menawarkan <HB> kepada pembeli"],
              ["<LW> tidak berencana menjual atau mengalihkan <HB>", "<LW> tidak pernah menawarkan <HB> kepada pembeli"])),
  gaya="lihat", tuntutanTambahan="sita-jaminan")

T(Q("q-wk-pengosongan", "pp-wk-akibat", 153, "inti", "pokok",
    "Apakah <LW> yang menempati atau menguasai harta wakaf itu sekarang, sejak kapan, dan apakah sudah diminta menyerahkannya kepada nazhir ?",
    hal="penempatan harta wakaf dan permintaan penyerahannya", ringkas="penempatan <HB> oleh <LW> dan permintaan penyerahannya kepada <NZ>",
    teks_varian=["Apakah <LW> masih menempati harta wakaf dan pernah diminta pergi atau menyerahkannya kepada nazhir ?"],
    melihat=["<LW> menempati <HB> sampai sekarang dan pernah diminta menyerahkannya kepada <NZ> tetapi tetap bertahan",
             "sampai sekarang <HB> masih ditempati <LW> walaupun sudah diminta untuk menyerahkannya kepada <NZ>",
             "<LW> terus menguasai <HB> dan menolak ketika diminta menyerahkannya kepada <NZ>",
             "permintaan agar <LW> menyerahkan <HB> kepada <NZ> sudah disampaikan tetapi <LW> tetap menempatinya"],
    sebagian=["<LW> menempati <HB> sampai sekarang", "<HB> masih ditempati <LW> sampai sekarang"],
    berbeda=B("peristiwa", "versi A: pihak lawan sudah diminta menyerahkan harta wakaf; versi B: pihak lawan belum pernah diminta menyerahkan harta wakaf - berselisih pada PERISTIWA",
              ["<LW> sudah diminta menyerahkan <HB> kepada <NZ>", "permintaan agar <LW> menyerahkan <HB> kepada <NZ> sudah disampaikan"],
              ["<LW> belum pernah diminta menyerahkan <HB> kepada <NZ>", "permintaan agar <LW> menyerahkan <HB> kepada <NZ> belum pernah disampaikan"])),
  gaya="lihat", tuntutanTambahan="pengosongan")

# ------------------------------------------------------------------ permohonan pengukuhan wakaf
T(Q("q-wk-pm-kedudukan", "pp-wk-permohonan", 172, "inti", "pokok",
    "Apa kedudukan <PM> dalam wakaf <WK> itu, apakah sebagai nazhir, ahli waris wakif atau penerima wasiat wakaf ?",
    hal="kedudukan pemohon dalam wakaf", ringkas="kedudukan <PM> dalam wakaf <WK> itu",
    teks_varian=["Bagaimana hubungan <PM> dengan wakaf <WK> itu, sebagai nazhir, ahli waris wakif atau penerima wasiat ?"],
    melihat=["<PM> adalah pengurus wakaf <WK> dan sudah lama mengurus <HB> untuk <PR>",
             "kedudukan <PM> dalam wakaf <WK> sebagai pihak yang mengurus <HB> untuk <PR>",
             "<PM> mengurus <HB> milik wakaf <WK> bagi <PR> sejak lama",
             "<PM> berada dalam kedudukan pengelola <HB> wakaf <WK> untuk <PR>"],
    sebagian=["<PM> mengurus <HB> wakaf <WK>", "<PM> ikut mengelola <HB> wakaf <WK>"],
    berbeda=B("peristiwa", "versi A: pemohon adalah pengurus wakaf; versi B: pemohon bukan pengurus wakaf - berselisih pada PERISTIWA",
              ["<PM> adalah pengurus wakaf <WK> atas <HB>", "<PM> mengurus <HB> wakaf <WK>"],
              ["<PM> bukan pengurus wakaf <WK> atas <HB>", "<PM> tidak mengurus <HB> wakaf <WK>"])),
  gaya="tahu", perkara="permohonan")

T(Q("q-wk-pm-penguasa", "pp-wk-permohonan", 173, "inti", "pokok",
    "Siapa yang menguasai harta wakaf itu sekarang, dan sejak kapan harta itu berada dalam penguasaannya ?",
    hal="pihak yang menguasai harta benda wakaf", ringkas="penguasaan <HB> oleh <KS> sejak lama",
    teks_varian=["Siapa yang memegang dan mengurus harta wakaf itu sekarang, dan sudah berapa lama ?"],
    melihat=["<KS> yang menguasai <HB> wakaf <WK> sejak ikrar dan mengurusnya sampai sekarang",
             "penguasaan <HB> wakaf <WK> ada pada <KS> sejak lama hingga saat ini",
             "<KS> memegang dan mengurus <HB> wakaf <WK> dari dahulu sampai sekarang",
             "sejak ikrar <WK> <HB> berada dalam kekuasaan <KS> sampai sekarang"],
    sebagian=["<KS> menguasai <HB> wakaf <WK> sejak lama", "<HB> wakaf <WK> berada pada <KS> sejak lama"],
    berbeda=B("pelaku", "versi A: harta wakaf dikuasai pihak yang disebut dalam permohonan; versi B: harta wakaf dikuasai pihak lain - berselisih pada PELAKU",
              ["<KS> yang menguasai <HB> wakaf <WK> sampai sekarang", "penguasaan <HB> wakaf <WK> ada pada <KS> sampai sekarang"],
              ["pihak lain yang menguasai <HB> wakaf <WK> bukan <KS>", "penguasaan <HB> wakaf <WK> bukan pada <KS> melainkan pada pihak lain"])),
  gaya="lihat", perkara="permohonan")

T(Q("q-wk-pm-dikenal-warga", "pp-wk-permohonan", 174, "inti", "pokok",
    "Apakah warga sekitar mengenal tanah itu sebagai tanah wakaf, sejak kapan saksi mengetahuinya, dan dari mana saksi tahu ?",
    hal="pengetahuan warga dan saksi bahwa harta itu wakaf", ringkas="pengetahuan warga dan saksi bahwa <HB> adalah harta wakaf <WK>",
    teks_varian=["Sejak kapan warga mengenal tanah itu sebagai tanah wakaf dan bagaimana saksi mengetahuinya ?"],
    melihat=["<HB> sudah lama dikenal warga sebagai tanah wakaf <WK> untuk <PR> dan dipakai bersama",
             "warga sekitar mengetahui <HB> adalah wakaf <WK> bagi <PR> sejak lama",
             "sejak dahulu <HB> dikenal sebagai wakaf <WK> yang dipakai untuk <PR>",
             "tanah <HB> wakaf <WK> itu dikenal warga dan dimanfaatkan untuk <PR> secara terbuka"],
    sebagian=["<HB> dikenal warga sebagai tanah wakaf <WK>", "warga mengenal <HB> sebagai wakaf <WK>"],
    berbeda=B("waktu", "versi A: warga sudah lama mengenal harta itu sebagai wakaf; versi B: warga baru mengenalnya belakangan - berselisih pada WAKTU",
              ["warga sudah lama mengenal <HB> sebagai wakaf <WK>", "sejak dahulu <HB> dikenal warga sebagai wakaf <WK>"],
              ["warga baru mengenal <HB> sebagai wakaf <WK> belakangan ini", "baru-baru ini <HB> dikenal warga sebagai wakaf <WK>"])),
  gaya="tahu", perkara="permohonan")

T(Q("q-wk-pm-pemanfaatan", "pp-wk-permohonan", 175, "pilihan", "pokok",
    "Sejak kapan harta wakaf itu dimanfaatkan sesuai peruntukannya, apakah pernah dipersoalkan orang lain, dan apakah ada ahli waris yang berkeberatan ?",
    hal="pemanfaatan harta wakaf sesuai peruntukan dan ada tidaknya keberatan", ringkas="pemanfaatan <HB> untuk <PR> dan ada tidaknya keberatan dari pihak lain",
    teks_varian=["Apakah sejak diwakafkan harta itu dipakai untuk peruntukannya dan tidak pernah dipersoalkan oleh siapa pun ?"],
    melihat=["<HB> wakaf <WK> dimanfaatkan untuk <PR> sejak lama dan tidak pernah dipersoalkan oleh siapa pun",
             "sejak diikrarkan <WK> <HB> dipakai untuk <PR> dan tidak ada ahli waris yang berkeberatan",
             "pemanfaatan <HB> wakaf <WK> bagi <PR> berjalan lama tanpa keberatan dari pihak mana pun",
             "<HB> dari <WK> dipakai warga untuk <PR> dan tidak pernah ada yang mempersoalkannya"],
    sebagian=["<HB> wakaf <WK> dimanfaatkan untuk <PR> sejak lama", "<HB> dari <WK> dipakai untuk <PR> sejak lama"],
    berbeda=B("peristiwa", "versi A: tidak ada yang mempersoalkan wakaf; versi B: ada pihak yang mempersoalkan wakaf - berselisih pada PERISTIWA",
              ["tidak ada yang mempersoalkan wakaf <WK> atas <HB>", "wakaf <WK> atas <HB> tidak pernah dipersoalkan siapa pun"],
              ["ada pihak yang mempersoalkan wakaf <WK> atas <HB>", "wakaf <WK> atas <HB> pernah dipersoalkan oleh pihak lain"])),
  gaya="campur", perkara="permohonan")

CATATAN = [
    "Versi 2 (21 Okt 2026): umur, akal dan kehendak bebas wakif, maksud wakaf, bukti hak dan keadaan bebas sengketa, ikrar lisan, tertulis dan dengan akta ikrar wakaf, saksi dan penerimaan nazhir, pendaftaran nazhir dan sertipikat wakaf, pemakaian sesuai peruntukan, ahli waris wakif, dalil ketidaksahan ikrar, penjualan atau ganti rugi harta wakaf, penguasaan dan pengosongan, serta pengukuhan wakaf ditambahkan; semua butir versi 1 dipertahankan.",
    "Pilihan keadaan pada layar menentukan butir yang tampil; jawaban 'berbeda' dan jawaban yang memuat titik-titik hanya kerangka: sesuaikan dengan keterangan saksi yang sesungguhnya.",
    "Sah atau tidaknya wakaf, kedudukan nazhir dan pengukuhan wakaf adalah penilaian hakim; keterangan saksi hanya menjadi dasar pembuktian.",
]

PROFIL = {
    "hadir-sendiri": dict(label="Hadir ketika ikrar wakaf dan mengetahui sendiri", peta={"*": "melihat", "pp-wk-akibat": "de-auditu"}, sumber=True),
    "mendengar-ucapan": dict(label="Mendengar sendiri ucapan ikrar wakif, tidak melihat suratnya", peta={"*": "melihat", "pp-ikrar": "mendengar", "pp-wk-ikrar-detail": "mendengar", "pp-saksi-ikrar": "mendengar", "pp-peruntukan": "mendengar"}),
    "tahu-dari-warga": dict(label="Tahu wakaf dari cerita warga atau orang tua", peta={"*": "de-auditu", "pp-hubungan-saksi": "melihat", "pp-wk-akibat": "melihat", "pp-pemanfaatan": "melihat", "pp-wk-peruntukan-detail": "melihat"}, sumber=True),
    "tahu-sebagian-wakaf": dict(label="Hanya tahu sebagian isi wakaf (centang hal yang diketahui)", peta={"*": "sebagian", "pp-hubungan-saksi": "melihat"}),
    "kenal-tidak-tahu-wakaf": dict(label="Mengenal wakif tetapi tidak tahu soal wakaf", peta={"*": "tidak-tahu", "pp-hubungan-saksi": "melihat"}),
    "ragu": dict(label="Ragu dan kurang ingat", peta={"*": "ragu", "pp-hubungan-saksi": "melihat"}),
}


def BLANGKO_PERBAIKAN(kat):
    """blangkoBas: semua berkas BAS saksi sudah tercantum (diperiksa terhadap server 21 Okt 2026)."""
    return None


if __name__ == "__main__":
    v1 = json.load(open(os.path.join(L.V1, "wakaf.json"), encoding="utf8"))
    kat = L.bangun(v1, sys.modules[__name__], PETA)
    p = L.tulis(kat, "wakaf")
    print("wakaf: pertanyaan %d -> %d, pokok %d -> %d, keadaan %d -> %d, dasar %d -> %d" % (
        len(v1["pertanyaan"]), len(kat["pertanyaan"]), len(v1["pokokPembuktian"]), len(kat["pokokPembuktian"]), len(v1["keadaan"]), len(kat["keadaan"]), len(v1["dasarHukum"]), len(kat["dasarHukum"])))
    print(L.periksa(p))
