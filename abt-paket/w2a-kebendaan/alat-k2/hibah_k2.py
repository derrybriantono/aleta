# -*- coding: utf-8 -*-
"""
Katalog saksi HIBAH versi 2 (agen W2a-K2, 20-21 Okt 2026). Menambah pokok, pertanyaan, keadaan, dasar hukum dan profil pengetahuan saksi
tanpa menghapus apa pun dari versi 1 (abt-paket/w2a-kebendaan/katalog-v1-k2/hibah.json).
Pakai: python hibah_k2.py  (menulis ekstensi-sipp/saksi-katalog/hibah.json lalu memeriksanya)
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import k2lib as L
from k2lib import Q, B, Daftar

# <PH> penghibah | <PM> pengaju | <LW> lawan | <OBJ> objek hibah | <BTK> bentuk dan tanggal hibah | <TRM> penerima hibah (otomatis)
PETA = {"_g": "x", "PH": "#9793#", "PM": "#0046#", "LW": "#0047#", "OBJ": "#9795#", "BTK": "#9794#", "TRM": "#9797#"}
D = DAFTAR = Daftar()
T = D.tambah

SUMBER_KHI = "KHI lampiran Inpres 1/1991: bunyi dicocokkan antara digitalisasi pasal.id dan naskah Depag (referensi/KHI-pasal-terverifikasi.md, VERIFIKASI-HUKUM 18 Okt 2026)"

DASAR_BARU = [
    dict(id="dh-khi-171g", rujukan="Pasal 171 huruf g Kompilasi Hukum Islam", uraian="hibah adalah pemberian suatu benda secara sukarela dan tanpa imbalan dari seseorang kepada orang lain yang masih hidup untuk dimiliki", status="terverifikasi", sumber=SUMBER_KHI),
]

POKOK_BARU = [
    dict(id="pp-hb-ijab-kabul", judul="Pernyataan hibah dan penerimaan oleh penerima hibah", uraian="penghibah menyatakan menghibahkan secara sukarela tanpa imbalan dan penerima hibah menyatakan menerimanya", dasarHukum=["dh-khi-171g", "dh-hibah-definisi"], wajib=False),
    dict(id="pp-hb-saksi-akta", judul="Dua orang saksi dan surat atau akta hibah", uraian="hibah dilakukan di hadapan dua orang saksi; surat hibah ditulis dan ditandatangani atau dibuat dengan akta pejabat pembuat akta", dasarHukum=["dh-khi-210"], wajib=False),
    dict(id="pp-hb-objek-bukti", judul="Bukti hak, letak dan nilai benda yang dihibahkan", uraian="bukti kepemilikan benda yang dihibahkan, letak atau ciri benda, dan perkiraan nilainya dibandingkan seluruh harta penghibah", dasarHukum=["dh-khi-210"], wajib=False),
    dict(id="pp-hb-pasca", judul="Penguasaan, pemanfaatan dan pendaftaran benda sesudah hibah", uraian="siapa yang menguasai dan memanfaatkan benda sesudah hibah, balik nama atau pendaftaran haknya, dan penguasaan oleh penghibah sampai meninggal", dasarHukum=["dh-hibah-definisi"], wajib=False),
    dict(id="pp-hb-persetujuan", judul="Persetujuan ahli waris atas hibah", uraian="persetujuan ahli waris atas hibah yang diberikan ketika penghibah sakit yang dekat dengan kematian atau yang diperhitungkan sebagai warisan", dasarHukum=["dh-khi-213", "dh-khi-211"], wajib=False),
    dict(id="pp-hb-penarikan", judul="Sebab penarikan kembali hibah", uraian="perbuatan penerima hibah yang menjadi sebab penghibah meminta kembali bendanya, khusus hibah orang tua kepada anaknya", dasarHukum=["dh-khi-212"], wajib=False),
    dict(id="pp-hb-keabsahan", judul="Dalil cacat keabsahan hibah", uraian="dalil yang mempersoalkan hibah: paksaan, tanda tangan bukan milik penghibah, benda bukan hak penghibah, tanpa saksi, belum diserahkan sampai penghibah meninggal, atau hibah yang sesungguhnya perbuatan lain", dasarHukum=["dh-khi-210", "dh-beban-bukti"], wajib=False),
    dict(id="pp-hb-akibat", judul="Penguasaan benda, hasil dan kerugian", uraian="penguasaan benda hibah oleh pihak lawan, hasilnya dan upaya mengamankan benda selama perkara berjalan", dasarHukum=["dh-beban-bukti"], wajib=False),
    dict(id="pp-hb-permohonan", judul="Kedudukan pemohon dan tujuan permohonan penetapan hibah", uraian="kedudukan pemohon sebagai penghibah, penerima hibah atau ahli waris, tujuan penetapan, dan keadaan surat hibah", dasarHukum=["dh-kewenangan-hibah", "dh-hibah-definisi"], wajib=False),
]

KEADAAN_BARU = {
    "statusPenghibah": dict(sumber="borang", nilai=["masih-hidup", "sudah-meninggal"], bawaan="masih-hidup", label="Keadaan penghibah saat ini",
                            labelNilai={"masih-hidup": "Penghibah masih hidup", "sudah-meninggal": "Penghibah sudah meninggal dunia"}),
    "kondisiPenghibah": dict(sumber="borang", nilai=["sehat", "sakit-menjelang-wafat", "akal-dipersoalkan"], bawaan="sehat", label="Keadaan penghibah ketika menghibahkan",
                             labelNilai={"sehat": "Sehat jasmani dan akalnya", "sakit-menjelang-wafat": "Sakit dan tidak lama kemudian meninggal dunia", "akal-dipersoalkan": "Kesehatan akal atau ingatannya dipersoalkan"}),
    "jenisObjek": dict(sumber="borang", nilai=["tanah-bangunan", "kendaraan", "uang-tabungan", "benda-lain"], jamak=True, bawaan=[], label="Jenis benda yang dihibahkan",
                       labelNilai={"tanah-bangunan": "Tanah atau bangunan", "kendaraan": "Kendaraan bermotor", "uang-tabungan": "Uang atau tabungan", "benda-lain": "Benda lain (perhiasan, ternak, perabot)"}),
    "persetujuan": dict(sumber="borang", nilai=["tidak-dipersoalkan", "disetujui-semua", "ada-yang-menolak"], bawaan="tidak-dipersoalkan", label="Persetujuan ahli waris atas hibah",
                        labelNilai={"tidak-dipersoalkan": "Persetujuan tidak dipersoalkan", "disetujui-semua": "Semua ahli waris menyetujui", "ada-yang-menolak": "Ada ahli waris yang menolak"}),
    "sebabTarik": dict(sumber="borang", nilai=["menelantarkan-penghibah", "menjual-atau-menjaminkan-objek", "tidak-sesuai-tujuan"], jamak=True, bawaan=[], label="Sebab penghibah meminta hibah dikembalikan",
                       labelNilai={"menelantarkan-penghibah": "Penerima menelantarkan penghibah", "menjual-atau-menjaminkan-objek": "Penerima menjual atau menjaminkan benda hibah", "tidak-sesuai-tujuan": "Benda hibah dipakai tidak sesuai tujuan hibah"}),
    "tuntutanTambahan": dict(sumber="borang", nilai=["ganti-rugi", "sita-jaminan", "pengosongan", "uang-paksa"], jamak=True, bawaan=[], label="Tuntutan tambahan dalam gugatan",
                             labelNilai={"ganti-rugi": "Ganti kerugian atas penguasaan benda", "sita-jaminan": "Sita jaminan atas benda hibah", "pengosongan": "Pengosongan dan penyerahan benda", "uang-paksa": "Uang paksa"}),
    "dalilCacat": dict(sumber="borang", nilai=["ada-paksaan", "tanda-tangan-dipalsukan", "objek-bukan-hak", "tanpa-saksi", "belum-diserahkan", "hibah-pura-pura"], jamak=True, bawaan=[], label="Dalil yang mempersoalkan keabsahan hibah",
                   labelNilai={"ada-paksaan": "Penghibah dipaksa atau ditekan", "tanda-tangan-dipalsukan": "Tanda tangan atau cap jempol bukan milik penghibah", "objek-bukan-hak": "Benda bukan hak penghibah", "tanpa-saksi": "Hibah tanpa dua orang saksi", "belum-diserahkan": "Benda tetap dikuasai penghibah sampai meninggal", "hibah-pura-pura": "Hibah sebenarnya jual beli, pinjaman atau titipan"}),
}

# ------------------------------------------------------------------ syarat penghibah
T(Q("q-hb-umur", "pp-syarat-penghibah", 31, "pilihan", "pokok",
    "Berapa umur <PH> ketika memberikan hibah itu, apakah sudah dewasa ?",
    hal="umur penghibah ketika menghibahkan", ringkas="umur <PH> ketika memberikan hibah itu",
    teks_varian=["Apakah <PH> sudah dewasa ketika menyatakan hibahnya, kira-kira berapa umurnya waktu itu ?"],
    melihat=["<PH> sudah dewasa dan umurnya lebih dari dua puluh satu tahun ketika memberikan hibah itu",
             "ketika hibah itu diberikan <PH> sudah berumur lebih dari dua puluh satu tahun",
             "umur <PH> pada waktu memberikan hibah itu sudah melewati dua puluh satu tahun",
             "<PH> telah dewasa dengan umur lebih dari dua puluh satu tahun saat hibah itu diberikan"],
    sebagian=["<PH> sudah dewasa ketika memberikan hibah itu", "umur <PH> ketika memberikan hibah itu sudah dewasa"],
    berbeda=B("jumlah", "versi A: penghibah sudah berumur lebih dari dua puluh satu tahun; versi B: penghibah belum berumur dua puluh satu tahun - berselisih pada JUMLAH (umur)",
              ["<PH> sudah berumur lebih dari dua puluh satu tahun ketika memberikan hibah itu", "umur <PH> pada waktu memberikan hibah itu sudah melewati dua puluh satu tahun"],
              ["<PH> belum berumur dua puluh satu tahun ketika memberikan hibah itu", "umur <PH> pada waktu memberikan hibah itu belum sampai dua puluh satu tahun"])),
  gaya="tahu")

T(Q("q-hb-sehat-akal", "pp-syarat-penghibah", 32, "pilihan", "pokok",
    "Apakah <PH> sehat akal dan ingatannya ketika memberikan hibah itu, dan bagaimana saksi mengetahuinya ?",
    hal="kesehatan akal penghibah ketika menghibahkan", ringkas="kesehatan akal dan ingatan <PH> ketika memberikan hibah",
    teks_varian=["Bagaimana keadaan pikiran dan ingatan <PH> ketika menyatakan hibahnya, apakah ia berbicara dengan jelas ?"],
    melihat=["<PH> sehat akalnya dan ingatannya baik ketika memberikan hibah itu sehingga ia berbicara dengan jelas dan mengerti maksud hibahnya",
             "ketika hibah itu diberikan <PH> sadar sepenuhnya serta mengerti apa yang dikatakannya",
             "pada waktu menghibahkan hartanya <PH> berpikir jernih dan dapat menjelaskan sendiri maksud hibahnya",
             "<PH> dalam keadaan sadar dan berakal sehat ketika menyampaikan hibahnya kepada orang di sekitarnya"],
    sebagian=["<PH> tampak sadar ketika memberikan hibah itu", "<PH> berbicara dengan jelas ketika memberikan hibah itu"],
    berbeda=B("peristiwa", "versi A: penghibah sehat akalnya; versi B: penghibah tidak sadar atau pikun - berselisih pada PERISTIWA (keadaan akal)",
              ["<PH> sehat akalnya ketika memberikan hibah itu dan mengerti maksud hibahnya", "ketika hibah itu diberikan <PH> sadar sepenuhnya dan mengerti apa yang dikatakannya"],
              ["<PH> tidak sehat akalnya ketika memberikan hibah itu dan tidak mengerti maksud hibahnya", "ketika hibah itu diberikan <PH> tidak sadar sepenuhnya dan tidak mengerti apa yang dikatakannya"])),
  gaya="tahu")

T(Q("q-hb-sakit", "pp-syarat-penghibah", 33, "inti", "pokok",
    "Apakah <PH> sedang sakit ketika memberikan hibah itu, sakit apa, dan berapa lama sesudah itu ia meninggal dunia ?",
    hal="sakit penghibah ketika menghibahkan dan waktu meninggalnya", ringkas="sakit <PH> ketika memberikan hibah dan jarak waktu sampai ia meninggal dunia",
    teks_varian=["Bagaimana kesehatan <PH> pada saat hibah itu diberikan dan kapan ia meninggal dunia setelah itu ?"],
    melihat=["<PH> sedang sakit keras ketika memberikan hibah itu dan meninggal dunia sesudahnya",
             "ketika menghibahkan hartanya <PH> dalam keadaan sakit dan meninggal dunia beberapa waktu kemudian",
             "sakit <PH> sudah berat saat hibah itu diberikan dan ia wafat sesudahnya",
             "pada waktu hibah itu diberikan <PH> sedang menderita sakit yang membawanya sampai meninggal dunia"],
    sebagian=["<PH> sedang sakit ketika memberikan hibah itu", "ketika menghibahkan hartanya <PH> dalam keadaan sakit"],
    berbeda=B("lama", "versi A: penghibah meninggal tidak lama setelah hibah; versi B: penghibah meninggal lama sesudah hibah - berselisih pada LAMA",
              ["<PH> meninggal dunia tidak lama setelah memberikan hibah itu", "tidak lama setelah hibah itu diberikan <PH> meninggal dunia"],
              ["<PH> baru meninggal dunia lama sesudah memberikan hibah itu", "lama sesudah hibah itu diberikan barulah <PH> meninggal dunia"])),
  gaya="tahu", kondisiPenghibah="sakit-menjelang-wafat")

T(Q("q-hb-akal-dipersoalkan", "pp-syarat-penghibah", 34, "inti", "pokok",
    "Apakah menjelang memberikan hibah itu <PH> pernah linglung, pikun atau berperilaku tidak wajar ?",
    hal="keadaan ingatan penghibah menjelang menghibahkan", ringkas="keadaan ingatan dan perilaku <PH> menjelang memberikan hibah",
    teks_varian=["Apakah <PH> pernah menunjukkan tanda pikun atau tidak mengenali orang di sekitarnya sebelum atau ketika memberikan hibah itu ?"],
    melihat=["<PH> sering linglung dan tidak mengenali orang di sekitarnya menjelang memberikan hibah itu",
             "menjelang hibah itu diberikan <PH> sudah pikun dan berperilaku tidak wajar",
             "sebelum hibah itu diberikan pikiran <PH> sudah kacau dan ia tidak lagi mengenali keluarganya",
             "<PH> tampak pikun dan tidak mengerti keadaan sekitarnya sewaktu hibah itu diberikan"],
    sebagian=["<PH> sering linglung menjelang memberikan hibah itu", "menjelang hibah itu diberikan <PH> sudah tampak pikun"],
    berbeda=B("peristiwa", "versi A: penghibah tidak pernah pikun; versi B: penghibah sudah pikun - berselisih pada PERISTIWA (keadaan ingatan)",
              ["<PH> tidak pernah linglung atau pikun menjelang memberikan hibah itu", "menjelang hibah itu diberikan <PH> tidak pernah berperilaku aneh"],
              ["<PH> sering linglung dan pikun menjelang memberikan hibah itu", "menjelang hibah itu diberikan <PH> sudah berperilaku aneh"])),
  gaya="tahu", kondisiPenghibah="akal-dipersoalkan")

T(Q("q-hb-tanpa-paksaan", "pp-syarat-penghibah", 35, "pilihan", "pokok",
    "Apakah <PH> memberikan hibah itu atas kehendaknya sendiri tanpa paksaan dari siapa pun ?",
    hal="kehendak bebas penghibah tanpa paksaan", ringkas="kehendak <PH> memberikan hibah tanpa paksaan",
    teks_varian=["Apakah ada yang memaksa atau menekan <PH> ketika ia memberikan hibah itu ?"],
    melihat=["<PH> memberikan hibah itu atas kehendaknya sendiri tanpa paksaan dari siapa pun",
             "hibah itu lahir dari kemauan <PH> sendiri tanpa ada orang yang memaksanya",
             "tidak ada paksaan dari siapa pun karena <PH> sendiri yang menginginkan hibah itu",
             "<PH> menyatakan hibah itu dengan sukarela tanpa tekanan dari pihak mana pun"],
    sebagian=["<PH> menyatakan hibah itu dengan kemauannya sendiri", "hibah itu lahir dari kehendak <PH> sendiri"],
    berbeda=B("peristiwa", "versi A: hibah diberikan tanpa paksaan; versi B: penghibah dipaksa atau ditekan - berselisih pada PERISTIWA",
              ["<PH> memberikan hibah itu atas kehendaknya sendiri tanpa paksaan dari siapa pun", "hibah itu lahir dari kemauan <PH> sendiri tanpa ada orang yang memaksanya"],
              ["<PH> memberikan hibah itu karena dipaksa oleh orang lain tanpa kehendak yang bebas", "hibah itu diberikan <PH> setelah ditekan oleh orang di sekitarnya tanpa kemauan sendiri"])),
  gaya="tahu")

T(Q("q-hb-ada-paksaan", "pp-hb-keabsahan", 36, "tambahan", "pokok",
    "Siapa yang mendesak atau menekan <PH> agar memberikan hibah itu, bagaimana caranya, dan apa yang saksi lihat atau dengar sendiri ?",
    hal="tekanan terhadap penghibah agar memberikan hibah", ringkas="tekanan pihak lain terhadap <PH> agar memberikan hibah",
    teks_varian=["Apakah ada orang yang memaksa, mengancam atau mendesak <PH> sehingga hibah itu diberikan ?"],
    melihat=["<TRM> mendesak <PH> agar menghibahkan <OBJ> dan ia menurutinya karena takut",
             "<PH> ditekan oleh <TRM> sampai bersedia menghibahkan <OBJ>",
             "hibah atas <OBJ> diberikan <PH> setelah didesak terus-menerus oleh <TRM>",
             "<TRM> memaksa <PH> menyatakan hibah atas <OBJ> dan ia terpaksa menurutinya"],
    berbeda=B("pelaku", "versi A: penerima hibah menekan penghibah; versi B: hibah diberikan tanpa tekanan penerima hibah - berselisih pada PELAKU",
              ["<TRM> menekan <PH> agar menghibahkan <OBJ>", "<PH> didesak oleh <TRM> sampai menghibahkan <OBJ>"],
              ["<TRM> tidak pernah menekan <PH> dalam menghibahkan <OBJ>", "<PH> menghibahkan <OBJ> tanpa desakan dari <TRM>"])),
  gaya="lihat", dalilCacat="ada-paksaan")

T(Q("q-hb-sukarela", "pp-hb-ijab-kabul", 37, "inti", "pokok",
    "Apakah hibah itu diberikan secara sukarela tanpa imbalan, dan apakah <PH> pernah meminta bayaran atau balasan dari penerima hibah ?",
    hal="hibah diberikan sukarela tanpa imbalan", ringkas="pemberian hibah oleh <PH> secara sukarela tanpa imbalan",
    teks_varian=["Apakah penerima hibah membayar atau memberi balasan atas benda yang dihibahkan <PH> ?"],
    melihat=["<PH> menghibahkan <OBJ> secara sukarela tanpa imbalan apa pun dari penerima hibah",
             "hibah atas <OBJ> diberikan <PH> cuma-cuma tanpa bayaran dari penerima hibah",
             "<PH> memberikan <OBJ> kepada penerima hibah tanpa meminta balasan",
             "penerima hibah menerima <OBJ> dari <PH> tanpa membayar imbalan apa pun"],
    sebagian=["<PH> menghibahkan <OBJ> dengan sukarela", "hibah atas <OBJ> diberikan <PH> dengan senang hati"],
    berbeda=B("peristiwa", "versi A: hibah diberikan tanpa imbalan; versi B: ada imbalan atau bayaran dari penerima - berselisih pada PERISTIWA",
              ["<PH> menghibahkan <OBJ> tanpa imbalan apa pun dari penerima hibah", "hibah atas <OBJ> diberikan <PH> tanpa bayaran dari penerima hibah"],
              ["penerima hibah membayar imbalan atas <OBJ> yang diterimanya dari <PH>", "hibah atas <OBJ> diberikan <PH> dengan balasan dari penerima hibah"])),
  gaya="campur")

# ------------------------------------------------------------------ ijab kabul, bentuk, saksi dan akta
T(Q("q-hb-ijab", "pp-hb-ijab-kabul", 41, "inti", "pokok",
    "Apa yang diucapkan <PH> ketika menyatakan hibahnya, dan siapa yang mendengarnya ?",
    hal="ucapan penghibah ketika menghibahkan", ringkas="ucapan hibah <PH> yang didengar oleh orang di sekitarnya",
    teks_varian=["Bagaimana bunyi ucapan <PH> ketika menghibahkan hartanya dan siapa saja yang hadir mendengarnya ?"],
    melihat=["<PH> mengucapkan sendiri bahwa <OBJ> dihibahkan kepada <TRM> dan ucapan itu didengar oleh dua orang saksi",
             "dengan lisan <PH> menyatakan <OBJ> diberikan kepada <TRM> di depan dua orang saksi",
             "ucapan hibah <PH> tentang <OBJ> untuk <TRM> terdengar jelas oleh dua orang saksi yang hadir",
             "<PH> berkata bahwa <OBJ> menjadi milik <TRM> sejak hari itu dan ucapan itu didengar dua orang saksi"],
    mendengar=["<PH> menyatakan bahwa <OBJ> dihibahkan kepada <TRM>", "<PH> mengatakan <OBJ> menjadi milik <TRM> sejak hari itu",
               "<PH> berkata <OBJ> diberikan kepada <TRM> sebagai hibah", "<PH> menegaskan <OBJ> dihibahkan untuk <TRM>"],
    sebagian=["<PH> mengucapkan hibah atas <OBJ> kepada <TRM>", "<PH> menghibahkan <OBJ> kepada <TRM> dengan ucapan"],
    berbeda=B("peristiwa", "versi A: penghibah mengucapkan hibah di depan saksi; versi B: tidak ada ucapan hibah yang didengar saksi - berselisih pada PERISTIWA",
              ["<PH> mengucapkan hibah atas <OBJ> di depan saksi", "ucapan hibah <PH> atas <OBJ> didengar oleh saksi"],
              ["<PH> tidak pernah mengucapkan hibah atas <OBJ> di depan saksi", "ucapan hibah <PH> atas <OBJ> tidak pernah didengar oleh saksi"])),
  gaya="lihat", bentukHibah="lisan")

T(Q("q-hb-kabul", "pp-hb-ijab-kabul", 42, "inti", "pokok",
    "Apakah penerima hibah menyatakan menerima hibah itu, kapan, dan bagaimana caranya ?",
    hal="penerimaan hibah oleh penerima hibah", ringkas="pernyataan penerimaan hibah oleh <TRM>",
    teks_varian=["Bagaimana sikap penerima hibah ketika hibah itu diberikan kepadanya, apakah ia menerimanya ?"],
    melihat=["<TRM> menyatakan menerima hibah atas <OBJ> dari <PH> pada hari yang sama",
             "ketika <PH> menghibahkan <OBJ> <TRM> menerimanya dengan ucapan terima kasih",
             "<TRM> menerima hibah atas <OBJ> dari <PH> dan menyatakan kesediaannya",
             "pada saat hibah diberikan <TRM> menyatakan menerima <OBJ> dari <PH>"],
    sebagian=["<TRM> menerima hibah atas <OBJ> dari <PH>", "<TRM> bersedia menerima <OBJ> dari <PH>"],
    berbeda=B("peristiwa", "versi A: penerima hibah menerima hibah; versi B: penerima hibah menolak hibah - berselisih pada PERISTIWA",
              ["<TRM> menerima hibah atas <OBJ> dari <PH>", "<TRM> menyatakan bersedia menerima <OBJ> dari <PH>"],
              ["<TRM> menolak hibah atas <OBJ> dari <PH>", "<TRM> menyatakan menolak menerima <OBJ> dari <PH>"])),
  gaya="lihat")

T(Q("q-hb-tertulis-ttd", "pp-hb-saksi-akta", 43, "inti", "pokok",
    "Siapa yang menulis surat hibah itu, dan apakah <PH> menandatangani atau membubuhkan cap jempol di hadapan dua orang saksi ?",
    hal="penulisan dan penandatanganan surat hibah di hadapan dua orang saksi", ringkas="penulisan dan penandatanganan surat hibah <PH> di hadapan dua orang saksi",
    teks_varian=["Apakah surat hibah ditulis sendiri oleh <PH> dan ditandatangani di depan dua orang saksi ?"],
    melihat=["<PH> menandatangani surat hibah itu di hadapan dua orang saksi sebagaimana tertera dalam <BTK>",
             "di depan dua orang saksi <PH> membubuhkan tanda tangan pada surat hibahnya sesuai <BTK>",
             "surat hibah itu ditandatangani <PH> ketika dua orang saksi hadir menyaksikannya sesuai <BTK>",
             "<PH> menandatangani hibahnya dengan disaksikan dua orang saksi yang juga menandatanganinya sesuai <BTK>"],
    sebagian=["<PH> menandatangani surat hibah itu sesuai <BTK>", "surat hibah itu ditandatangani <PH> sesuai <BTK>"],
    berbeda=B("peristiwa", "versi A: penghibah menandatangani surat hibah di depan dua saksi; versi B: surat hibah ditandatangani tanpa saksi - berselisih pada PERISTIWA",
              ["<PH> menandatangani surat hibah itu di hadapan dua orang saksi sesuai <BTK>", "surat hibah itu ditandatangani <PH> ketika dua orang saksi hadir sesuai <BTK>"],
              ["<PH> menandatangani surat hibah itu tanpa dihadiri saksi sesuai <BTK>", "surat hibah itu ditandatangani <PH> tanpa ada saksi yang hadir sesuai <BTK>"])),
  gaya="lihat", bentukHibah="tertulis")

T(Q("q-hb-surat-simpan", "pp-hb-saksi-akta", 44, "pilihan", "pokok",
    "Di mana surat hibah asli <PH> disimpan, siapa yang memegangnya, dan apakah saksi pernah melihat atau membacanya ?",
    hal="penyimpanan surat hibah asli", ringkas="penyimpanan surat hibah <PH> yang asli",
    teks_varian=["Siapa yang menyimpan surat hibah <PH> yang asli dan apakah saksi pernah melihatnya ?"],
    melihat=["surat hibah asli <PH> disimpan oleh <TRM> dan isinya pernah dibaca oleh keluarga",
             "yang memegang surat hibah asli <PH> adalah <TRM> dan isinya pernah dibaca keluarga",
             "surat hibah asli <PH> berada di tangan <TRM> dan pernah diperlihatkan kepada keluarga",
             "<TRM> menyimpan surat hibah asli <PH> yang isinya pernah dilihat keluarga"],
    sebagian=["surat hibah asli <PH> pernah terlihat oleh keluarga yang menyimpannya <TRM>", "keluarga pernah melihat surat hibah asli <PH> yang disimpan <TRM>"],
    berbeda=B("tempat", "versi A: surat hibah asli disimpan penerima hibah; versi B: surat hibah asli disimpan orang lain - berselisih pada TEMPAT penyimpanan",
              ["surat hibah asli <PH> disimpan oleh <TRM>", "yang memegang surat hibah asli <PH> adalah <TRM>"],
              ["surat hibah asli <PH> disimpan oleh orang lain bukan <TRM>", "yang memegang surat hibah asli <PH> adalah orang lain dan bukan <TRM>"])),
  gaya="campur", bentukHibah="tertulis")

T(Q("q-hb-akta-ppat", "pp-hb-saksi-akta", 45, "inti", "pokok",
    "Apakah <PH> menghadap pejabat pembuat akta untuk membuat akta hibah itu, di mana dan kapan, dan apakah akta itu dibacakan kepadanya ?",
    hal="pembuatan akta hibah di hadapan pejabat pembuat akta", ringkas="pembuatan akta hibah <PH> di hadapan pejabat pembuat akta",
    teks_varian=["Bagaimana <PH> membuat akta hibah, apakah ia datang sendiri dan apakah akta itu dibacakan sebelum ditandatangani ?"],
    melihat=["<PH> datang sendiri menghadap pejabat pembuat akta untuk membuat akta hibah sebagaimana tertera dalam <BTK> dan aktanya dibacakan kepadanya",
             "di kantor pejabat pembuat akta <PH> menyatakan hibahnya sebagaimana tertera dalam <BTK> dan akta itu dibacakan sebelum ditandatangani",
             "hibah <PH> dibuat di hadapan pejabat pembuat akta sebagaimana tertera dalam <BTK> dan ia hadir sendiri",
             "<PH> menghadap pejabat pembuat akta sendiri sebagaimana tertera dalam <BTK> dan menandatangani akta hibah setelah dibacakan"],
    sebagian=["<PH> menghadap pejabat pembuat akta untuk membuat akta hibah sesuai <BTK>", "hibah <PH> dibuat di kantor pejabat pembuat akta sesuai <BTK>"],
    berbeda=B("peristiwa", "versi A: penghibah sendiri menghadap pejabat pembuat akta; versi B: penghibah tidak pernah menghadap pejabat pembuat akta - berselisih pada PERISTIWA",
              ["<PH> datang sendiri menghadap pejabat pembuat akta untuk membuat akta hibah sesuai <BTK>", "<PH> sendiri yang menghadap pejabat pembuat akta untuk membuat akta hibah sesuai <BTK>"],
              ["<PH> tidak pernah menghadap pejabat pembuat akta untuk membuat akta hibah sesuai <BTK>", "<PH> tidak pernah datang ke kantor pejabat pembuat akta untuk membuat akta hibah sesuai <BTK>"])),
  gaya="lihat", bentukHibah="akta-ppat")

T(Q("q-hb-saksi-hadir", "pp-hb-saksi-akta", 51, "pilihan", "pokok",
    "Apakah kedua saksi hibah hadir bersamaan ketika <PH> menyampaikan atau menandatangani hibahnya ?",
    hal="kehadiran dua orang saksi hibah secara bersamaan", ringkas="kehadiran kedua saksi hibah secara bersamaan ketika hibah diberikan",
    teks_varian=["Apakah dua orang saksi itu berada di tempat yang sama pada saat <PH> memberikan hibahnya ?"],
    melihat=["kedua saksi hibah hadir bersamaan di tempat yang sama ketika <PH> memberikan hibahnya",
             "dua orang saksi hibah itu sama-sama berada di depan <PH> ketika hibah diberikan",
             "ketika <PH> memberikan hibah kedua saksi hadir sekaligus dan menyaksikannya",
             "pada saat hibah diberikan <PH> dikelilingi dua orang saksi yang hadir bersamaan"],
    sebagian=["salah seorang saksi hibah hadir ketika <PH> memberikan hibahnya", "seorang dari saksi hibah itu hadir ketika <PH> memberikan hibahnya"],
    berbeda=B("jumlah", "versi A: dua orang saksi hadir bersamaan; versi B: hanya satu orang saksi hadir - berselisih pada JUMLAH (saksi yang hadir)",
              ["dua orang saksi hadir bersamaan ketika <PH> memberikan hibahnya", "kedua saksi hibah sama-sama hadir ketika <PH> memberikan hibahnya"],
              ["hanya satu orang saksi yang hadir ketika <PH> memberikan hibahnya", "saksi hibah yang hadir ketika <PH> memberikan hibahnya hanya seorang"])),
  gaya="lihat")

T(Q("q-hb-saksi-hubungan", "pp-hb-saksi-akta", 52, "pilihan", "pokok",
    "Apa hubungan kedua saksi hibah dengan <PH> dan dengan penerima hibah, apakah salah satunya penerima hibah atau ahli waris ?",
    hal="hubungan saksi hibah dengan penghibah dan penerima hibah", ringkas="hubungan kedua saksi hibah dengan <PH> dan <TRM>",
    teks_varian=["Apakah kedua saksi hibah itu penerima hibah atau ahli waris <PH> ?"],
    melihat=["kedua saksi hibah itu tidak termasuk penerima hibah dan bukan ahli waris <PH>",
             "dua orang saksi hibah itu tidak mempunyai hubungan waris dengan <PH> dan tidak menerima hibah",
             "saksi hibah yang hadir itu tidak menerima apa pun dari hibah <PH> dan tidak termasuk ahli warisnya",
             "kedua saksi hibah tidak ikut menerima hibah <PH> dan tidak berhak atas warisannya"],
    sebagian=["salah satu saksi hibah itu tidak termasuk ahli waris <PH>", "seorang saksi hibah itu tidak menerima apa pun dari hibah <PH>"],
    berbeda=B("peristiwa", "versi A: saksi hibah bukan penerima hibah dan bukan ahli waris; versi B: salah satu saksi hibah adalah penerima hibah - berselisih pada PERISTIWA",
              ["kedua saksi hibah itu tidak termasuk penerima hibah dan bukan ahli waris <PH>", "dua orang saksi hibah itu bukan penerima hibah dan tidak mempunyai hubungan waris dengan <PH>"],
              ["salah satu saksi hibah itu adalah <TRM> yang menerima hibah <PH>", "seorang dari saksi hibah itu justru <TRM> yang menerima hibah <PH>"])),
  gaya="tahu")

# ------------------------------------------------------------------ benda yang dihibahkan
T(Q("q-hb-objek-bukti", "pp-hb-objek-bukti", 61, "inti", "pokok",
    "Apa bukti kepemilikan benda yang dihibahkan itu, misalnya sertipikat, akta jual beli, BPKB atau surat lain, dan atas nama siapa ?",
    hal="bukti kepemilikan benda yang dihibahkan", ringkas="bukti kepemilikan <OBJ> atas nama <PH>",
    teks_varian=["Atas nama siapa bukti hak atas benda yang dihibahkan itu dan surat apa yang menjadi buktinya ?"],
    melihat=["bukti hak atas <OBJ> tercatat atas nama <PH> dan surat buktinya pernah diperlihatkan",
             "<OBJ> dibuktikan dengan surat yang tercatat atas nama <PH> dan surat itu pernah diperlihatkan kepada keluarga",
             "surat hak atas <OBJ> memang atas nama <PH> sebagaimana yang terlihat pada suratnya",
             "kepemilikan <PH> atas <OBJ> dibuktikan surat yang dilihat keluarga sendiri"],
    sebagian=["<OBJ> sejak lama dikenal sebagai milik <PH>", "<OBJ> sejak lama dikuasai <PH> sebagai pemiliknya"],
    berbeda=B("peristiwa", "versi A: bukti hak atas benda tercatat atas nama penghibah; versi B: bukti hak atas benda tercatat atas nama orang lain - berselisih pada PERISTIWA",
              ["bukti hak atas <OBJ> tercatat atas nama <PH>", "surat hak atas <OBJ> memang atas nama <PH>"],
              ["bukti hak atas <OBJ> tercatat atas nama orang lain bukan <PH>", "surat hak atas <OBJ> bukan atas nama <PH> melainkan orang lain"])),
  gaya="campur")

T(Q("q-hb-objek-tanah", "pp-hb-objek-bukti", 62, "pilihan", "pokok",
    "Di mana letak tanah atau bangunan yang dihibahkan <PH> itu, berapa luasnya, dan apa batas-batasnya ?",
    hal="letak luas dan batas tanah atau bangunan yang dihibahkan", ringkas="letak, luas dan batas <OBJ>",
    teks_varian=["Di mana tanah atau bangunan yang dihibahkan <PH> itu berada, berapa luasnya dan berbatasan dengan apa ?"],
    melihat=["<OBJ> yang dihibahkan <PH> terletak di tempat yang dikenal keluarga dengan luas dan batas yang jelas",
             "letak <OBJ> yang dihibahkan <PH> diketahui keluarga lengkap dengan luas dan batas-batasnya",
             "batas-batas <OBJ> yang dihibahkan <PH> diketahui warga sekitar dan keluarga dengan jelas",
             "tanah atau bangunan <OBJ> yang dihibahkan <PH> telah lama dikenal letak dan batasnya oleh keluarga"],
    sebagian=["<OBJ> yang dihibahkan <PH> terletak di tempat yang dikenal keluarga", "letak <OBJ> yang dihibahkan <PH> diketahui keluarga"],
    berbeda=B("tempat", "versi A: letak benda sesuai uraian perkara; versi B: benda berada di letak yang berbeda - berselisih pada TEMPAT",
              ["<OBJ> yang dihibahkan <PH> terletak sebagaimana diuraikan dalam perkara ini", "letak <OBJ> yang dihibahkan <PH> sesuai uraian dalam perkara ini"],
              ["<OBJ> yang dihibahkan <PH> terletak di tempat lain yang berbeda dari uraian perkara ini", "letak <OBJ> yang dihibahkan <PH> berbeda dengan uraian dalam perkara ini"])),
  gaya="tahu", jenisObjek="tanah-bangunan")

T(Q("q-hb-objek-kendaraan", "pp-hb-objek-bukti", 63, "pilihan", "pokok",
    "Apa merek, jenis dan nomor polisi kendaraan yang dihibahkan <PH> itu, dan atas nama siapa BPKB serta surat kendaraannya ?",
    hal="ciri dan surat kendaraan yang dihibahkan", ringkas="ciri dan surat kendaraan <OBJ> yang dihibahkan <PH>",
    teks_varian=["Kendaraan apa yang dihibahkan <PH>, bernomor polisi berapa, dan atas nama siapa surat-suratnya ?"],
    melihat=["kendaraan <OBJ> yang dihibahkan <PH> memiliki surat-surat yang tercatat atas nama <PH>",
             "<OBJ> berupa kendaraan yang dihibahkan <PH> disertai BPKB atas nama <PH> sendiri",
             "surat kendaraan <OBJ> yang dihibahkan <PH> tercatat atas nama <PH> sebagai pemilik awalnya",
             "kendaraan yang dihibahkan <PH> yaitu <OBJ> dikenal keluarga sebagai milik <PH>"],
    sebagian=["kendaraan <OBJ> yang dihibahkan <PH> dikenal keluarga sebagai miliknya", "<OBJ> berupa kendaraan itu sejak lama dipakai <PH>"],
    berbeda=B("peristiwa", "versi A: surat kendaraan atas nama penghibah; versi B: surat kendaraan atas nama orang lain - berselisih pada PERISTIWA",
              ["surat kendaraan <OBJ> tercatat atas nama <PH>", "bukti BPKB kendaraan <OBJ> atas nama <PH>"],
              ["surat kendaraan <OBJ> tercatat atas nama orang lain bukan <PH>", "bukti BPKB kendaraan <OBJ> atas nama orang lain dan bukan <PH>"])),
  gaya="tahu", jenisObjek="kendaraan")

T(Q("q-hb-objek-uang", "pp-hb-objek-bukti", 64, "pilihan", "pokok",
    "Berapa jumlah uang atau tabungan yang dihibahkan <PH> itu, dan bagaimana uang itu diserahkan, tunai atau lewat rekening ?",
    hal="jumlah dan cara penyerahan uang atau tabungan yang dihibahkan", ringkas="jumlah dan cara penyerahan <OBJ> berupa uang atau tabungan",
    teks_varian=["Berapa uang yang dihibahkan <PH> dan apakah uang itu diserahkan tunai atau dipindahkan ke rekening penerima ?"],
    melihat=["<OBJ> berupa uang atau tabungan diserahkan <PH> kepada <TRM> dengan jumlah yang disebutkan saat hibah",
             "uang atau tabungan <OBJ> dipindahkan <PH> kepada <TRM> sesuai jumlah yang dihibahkannya",
             "<PH> menyerahkan <OBJ> berupa uang kepada <TRM> sebesar jumlah yang dinyatakannya",
             "penyerahan <OBJ> berupa uang atau tabungan oleh <PH> kepada <TRM> dilakukan sesuai jumlah hibahnya"],
    sebagian=["<PH> menyerahkan <OBJ> berupa uang kepada <TRM>", "uang <OBJ> dari <PH> diterima <TRM>"],
    berbeda=B("jumlah", "versi A: uang yang diserahkan sesuai jumlah hibah; versi B: uang yang diserahkan lebih kecil dari jumlah hibah - berselisih pada JUMLAH",
              ["uang <OBJ> yang diserahkan <PH> kepada <TRM> sesuai jumlah hibahnya", "<PH> menyerahkan uang <OBJ> kepada <TRM> sebesar jumlah hibahnya"],
              ["uang <OBJ> yang diserahkan <PH> kepada <TRM> lebih kecil dari jumlah hibahnya", "<PH> menyerahkan uang <OBJ> kepada <TRM> yang nilainya kurang dari jumlah hibahnya"])),
  gaya="lihat", jenisObjek="uang-tabungan")

T(Q("q-hb-objek-nilai", "pp-hb-objek-bukti", 65, "pilihan", "pokok",
    "Berapa kira-kira nilai benda yang dihibahkan itu, dan berapa nilai seluruh harta <PH> ketika ia menghibahkannya ?",
    hal="perbandingan nilai benda hibah dengan seluruh harta penghibah", ringkas="perbandingan nilai <OBJ> dengan seluruh harta <PH>",
    teks_varian=["Apakah nilai benda yang dihibahkan itu besar dibandingkan seluruh harta <PH> ?"],
    melihat=["nilai <OBJ> yang dihibahkan sebanding dengan sebagian besar seluruh harta <PH> yang diketahui keluarga",
             "perbandingan <OBJ> dengan seluruh harta <PH> cukup besar sebagaimana diketahui keluarga",
             "harta <PH> seluruhnya diketahui keluarga dan <OBJ> menempati bagian yang besar di dalamnya",
             "dibandingkan seluruh harta <PH> nilai <OBJ> sangat besar menurut pengetahuan keluarga"],
    sebagian=["<OBJ> merupakan sebagian dari harta <PH>", "<OBJ> termasuk harta penting milik <PH>"],
    berbeda=B("jumlah", "versi A: nilai benda hibah sebagian besar harta penghibah; versi B: nilai benda hibah hanya sebagian kecil - berselisih pada JUMLAH (nilai)",
              ["<OBJ> merupakan sebagian besar dari seluruh harta <PH>", "nilai <OBJ> mencapai bagian yang besar dari harta <PH>"],
              ["<OBJ> hanya merupakan sebagian kecil dari seluruh harta <PH>", "nilai <OBJ> hanya bagian yang kecil dari harta <PH>"])),
  gaya="tahu")

T(Q("q-hb-objek-bukan-hak", "pp-hb-keabsahan", 66, "tambahan", "pokok",
    "Apakah benda yang dihibahkan <PH> itu sebenarnya harta bersama atau milik orang lain, dan siapa pemiliknya menurut yang saksi ketahui ?",
    hal="kepemilikan benda hibah yang dipersoalkan bukan hak penghibah", ringkas="kepemilikan <OBJ> yang dipersoalkan bukan hak <PH>",
    teks_varian=["Apakah <PH> sendiri pemilik benda yang dihibahkannya, atau benda itu milik orang lain atau harta bersama ?"],
    melihat=["<OBJ> yang dihibahkan <PH> adalah harta bersama dengan pasangannya dan bukan miliknya sendiri",
             "<OBJ> sebenarnya milik orang lain yang tercatat atas nama pihak ketiga dan bukan milik <PH>",
             "benda <OBJ> yang dihibahkan <PH> diperoleh dari harta bersama sehingga bukan hanya miliknya",
             "<PH> hanya memegang <OBJ> sedangkan pemiliknya bukan dirinya melainkan orang lain yang dikenal keluarga"],
    berbeda=B("peristiwa", "versi A: benda hibah milik penghibah sendiri; versi B: benda hibah milik orang lain atau harta bersama - berselisih pada PERISTIWA",
              ["<OBJ> yang dihibahkan <PH> adalah miliknya sendiri", "<OBJ> sepenuhnya hak <PH> yang dihibahkannya"],
              ["<OBJ> yang dihibahkan <PH> bukan miliknya melainkan milik orang lain atau harta bersama", "<OBJ> bukan hak <PH> sendiri melainkan milik orang lain atau harta bersama"])),
  gaya="tahu", dalilCacat="objek-bukan-hak")

# ------------------------------------------------------------------ penyerahan dan sesudah hibah
T(Q("q-hb-balik-nama", "pp-hb-pasca", 72, "pilihan", "pokok",
    "Apakah setelah hibah itu benda yang dihibahkan sudah dibalik nama atau didaftarkan atas nama penerima hibah, dan kapan ?",
    hal="balik nama atau pendaftaran benda hibah atas nama penerima", ringkas="balik nama atau pendaftaran <OBJ> atas nama <TRM>",
    teks_varian=["Apakah surat benda yang dihibahkan sudah diurus atas nama penerima hibah ?"],
    melihat=["setelah hibah itu <OBJ> sudah diurus pendaftarannya atas nama <TRM> dengan persetujuan <PH>",
             "surat-surat <OBJ> sudah dibalik nama menjadi atas nama <TRM> dari <PH>",
             "<TRM> telah mendaftarkan <OBJ> atas namanya setelah menerima hibah dari <PH>",
             "pengurusan <OBJ> menjadi atas nama <TRM> sudah dilakukan setelah hibah dari <PH>"],
    sebagian=["<OBJ> sedang diurus atas nama <TRM> setelah hibah dari <PH>", "pengurusan surat <OBJ> atas nama <TRM> sudah dimulai setelah hibah dari <PH>"],
    berbeda=B("peristiwa", "versi A: benda hibah sudah dibalik nama atas nama penerima; versi B: benda hibah belum dibalik nama - berselisih pada PERISTIWA",
              ["<OBJ> sudah dibalik nama atas nama <TRM> setelah hibah dari <PH>", "surat <OBJ> sudah atas nama <TRM> setelah hibah dari <PH>"],
              ["<OBJ> belum dibalik nama atas nama <TRM> setelah hibah dari <PH>", "surat <OBJ> belum atas nama <TRM> setelah hibah dari <PH>"])),
  gaya="lihat")

T(Q("q-hb-dikuasai-penghibah", "pp-hb-pasca", 73, "tambahan", "pokok",
    "Apakah setelah hibah itu benda yang dihibahkan tetap dikuasai dan dipakai <PH> sampai ia meninggal dunia, atau sudah dikuasai penerima hibah ?",
    hal="penguasaan benda hibah oleh penghibah sampai meninggal dunia", ringkas="penguasaan <OBJ> oleh <PH> sampai ia meninggal dunia",
    teks_varian=["Sampai <PH> meninggal dunia siapa yang menguasai dan memakai benda yang dihibahkan itu ?"],
    melihat=["<OBJ> tetap dikuasai dan dipakai <PH> sampai ia meninggal dunia dan tidak pernah diserahkan kepada penerima hibah",
             "sampai <PH> wafat <OBJ> masih berada dalam kekuasaannya dan tidak berpindah ke tangan penerima",
             "setelah hibah <OBJ> tidak berpindah dan tetap dipakai <PH> hingga akhir hayatnya",
             "<PH> terus memakai <OBJ> sendiri sampai meninggal dunia dan tidak menyerahkannya"],
    berbeda=B("peristiwa", "versi A: benda tetap dikuasai penghibah sampai meninggal; versi B: benda sudah dikuasai penerima sejak hibah - berselisih pada PERISTIWA",
              ["<OBJ> tetap dikuasai <PH> sampai ia meninggal dunia", "sampai <PH> wafat <OBJ> masih berada dalam kekuasaannya"],
              ["<OBJ> sudah dikuasai penerima hibah sejak hibah dari <PH>", "sejak <PH> menghibahkannya <OBJ> berada dalam kekuasaan penerima hibah"])),
  gaya="lihat", dalilCacat="belum-diserahkan")

T(Q("q-hb-manfaat", "pp-hb-pasca", 74, "pilihan", "pokok",
    "Sejak kapan penerima hibah memakai atau mengambil manfaat dari benda yang dihibahkan itu, dan untuk apa ?",
    hal="pemanfaatan benda hibah oleh penerima hibah", ringkas="pemanfaatan <OBJ> oleh <TRM> sejak hibah dari <PH>",
    teks_varian=["Apa yang dilakukan penerima hibah terhadap benda hibah sejak menerimanya ?"],
    melihat=["sejak hibah dari <PH> <TRM> memakai <OBJ> untuk kebutuhannya dan mengambil manfaatnya",
             "<TRM> mengelola <OBJ> dan menikmati hasilnya sejak menerima hibah dari <PH>",
             "setelah menerima hibah dari <PH> <TRM> menggunakan <OBJ> sebagai miliknya sendiri",
             "<OBJ> dimanfaatkan <TRM> setiap hari sejak <PH> menghibahkannya"],
    sebagian=["<TRM> memakai <OBJ> sejak hibah dari <PH>", "<TRM> menggunakan <OBJ> setelah hibah dari <PH>"],
    berbeda=B("waktu", "versi A: penerima memakai benda sejak hibah diberikan; versi B: penerima baru memakai benda bertahun-tahun kemudian - berselisih pada WAKTU",
              ["<TRM> memakai <OBJ> sejak hibah dari <PH> diberikan", "<TRM> mengambil manfaat <OBJ> sejak hari hibah dari <PH>"],
              ["<TRM> baru memakai <OBJ> bertahun-tahun setelah hibah dari <PH>", "<TRM> baru mengambil manfaat <OBJ> lama setelah hibah dari <PH>"])),
  gaya="lihat")

# ------------------------------------------------------------------ penerima hibah dan hibah orang tua kepada anak
T(Q("q-hb-penerima-merawat", "pp-penerima-hibah", 82, "pilihan", "pokok",
    "Setelah menerima hibah itu, bagaimana sikap anak penerima hibah kepada <PH>, apakah ia tetap merawat dan menghormatinya ?",
    hal="sikap anak penerima hibah kepada penghibah", ringkas="sikap <TRM> kepada <PH> setelah menerima hibah",
    teks_varian=["Apakah penerima hibah masih memelihara dan menghormati <PH> setelah menerima hibah ?"],
    melihat=["setelah menerima hibah <TRM> tetap merawat dan menghormati <PH> dengan baik",
             "<TRM> masih mengurus kebutuhan <PH> sehari-hari sesudah hibah itu diterimanya",
             "sikap <TRM> kepada <PH> tetap baik dan penuh hormat setelah hibah",
             "<TRM> terus memelihara <PH> sebagai orang tuanya sesudah menerima hibah"],
    sebagian=["<TRM> masih sering menjenguk <PH> setelah menerima hibah", "<TRM> masih menemui <PH> setelah menerima hibah"],
    berbeda=B("peristiwa", "versi A: penerima hibah tetap merawat penghibah; versi B: penerima hibah mengabaikan penghibah - berselisih pada PERISTIWA",
              ["<TRM> tetap merawat <PH> setelah menerima hibah", "<TRM> masih mengurus kebutuhan <PH> setelah hibah"],
              ["<TRM> menelantarkan kebutuhan <PH> setelah menerima hibah", "<TRM> membiarkan kebutuhan <PH> terabaikan setelah hibah"])),
  gaya="lihat", penerima="anak-penghibah")

T(Q("q-hb-tarik-menelantarkan", "pp-hb-penarikan", 121, "tambahan", "pokok",
    "Bagaimana penerima hibah memperlakukan <PH> setelah menerima hibah itu, apakah ia menelantarkan atau berlaku kasar, dan sejak kapan ?",
    hal="penelantaran penghibah oleh penerima hibah", ringkas="penelantaran <PH> oleh <TRM> setelah menerima hibah",
    teks_varian=["Apakah penerima hibah pernah menelantarkan atau memarahi <PH> sesudah menerima hibah ?"],
    melihat=["setelah menerima hibah <TRM> menelantarkan <PH> dan membiarkan kebutuhannya terabaikan",
             "<TRM> berlaku kasar kepada <PH> sesudah hibah itu diterimanya",
             "kebutuhan <PH> terabaikan oleh <TRM> setelah hibah itu diterima",
             "<TRM> membiarkan <PH> hidup sendiri dalam keadaan terlantar sejak menerima hibah"],
    berbeda=B("peristiwa", "versi A: penerima hibah menelantarkan penghibah; versi B: penerima hibah merawat penghibah dengan baik - berselisih pada PERISTIWA",
              ["<TRM> menelantarkan <PH> setelah menerima hibah", "<TRM> membiarkan kebutuhan <PH> terabaikan setelah hibah"],
              ["<TRM> merawat <PH> dengan baik setelah menerima hibah", "<TRM> mengurus kebutuhan <PH> setelah hibah"])),
  gaya="lihat", sebabTarik="menelantarkan-penghibah")

T(Q("q-hb-tarik-jual", "pp-hb-penarikan", 122, "tambahan", "pokok",
    "Apakah penerima hibah pernah menjual, menggadaikan atau menjaminkan benda yang dihibahkan itu, kepada siapa dan kapan ?",
    hal="penjualan atau penjaminan benda hibah oleh penerima hibah", ringkas="penjualan atau penjaminan <OBJ> oleh <TRM>",
    teks_varian=["Apakah benda hibah itu sudah dijual atau dijadikan jaminan hutang oleh penerima hibah ?"],
    melihat=["<TRM> menjual <OBJ> yang dihibahkan <PH> kepada orang lain tanpa sepengetahuan penghibah",
             "<OBJ> dari <PH> dijaminkan <TRM> untuk hutang miliknya tanpa persetujuan penghibah",
             "<TRM> menggadaikan <OBJ> pemberian <PH> kepada pihak lain tanpa izin",
             "setelah menerima hibah dari <PH> <TRM> mengalihkan <OBJ> kepada orang lain tanpa izin"],
    berbeda=B("peristiwa", "versi A: penerima hibah menjual atau menjaminkan benda; versi B: benda tidak pernah dijual atau dijaminkan - berselisih pada PERISTIWA",
              ["<TRM> menjual atau menjaminkan <OBJ> dari <PH>", "<OBJ> dari <PH> dialihkan <TRM> kepada pihak lain"],
              ["<TRM> tidak pernah menjual atau menjaminkan <OBJ> dari <PH>", "<OBJ> dari <PH> tidak pernah dialihkan <TRM> kepada pihak lain"])),
  gaya="lihat", sebabTarik="menjual-atau-menjaminkan-objek")

T(Q("q-hb-tarik-tujuan", "pp-hb-penarikan", 123, "tambahan", "pokok",
    "Apakah hibah <PH> itu diberikan dengan maksud atau tujuan tertentu, dan apakah benda hibah dipakai sesuai maksud itu ?",
    hal="tujuan hibah dan kesesuaian pemakaian benda hibah", ringkas="tujuan hibah <PH> dan pemakaian <OBJ> oleh <TRM>",
    teks_varian=["Untuk apa <PH> menghibahkan bendanya, dan apakah penerima hibah memakainya sesuai tujuan itu ?"],
    melihat=["<PH> menghibahkan <OBJ> kepada <TRM> dengan maksud tertentu dan penerima memakainya sesuai maksud itu",
             "maksud hibah <PH> atas <OBJ> adalah untuk keperluan <TRM> dan benda itu dipakai sesuai keperluan tersebut",
             "<TRM> memakai <OBJ> dari <PH> untuk keperluan yang diinginkan penghibah ketika menghibahkannya",
             "tujuan <PH> menghibahkan <OBJ> terpenuhi karena <TRM> memakainya sesuai maksud hibah"],
    berbeda=B("peristiwa", "versi A: benda hibah dipakai sesuai tujuan hibah; versi B: benda hibah dipakai tidak sesuai tujuan hibah - berselisih pada PERISTIWA",
              ["<TRM> memakai <OBJ> dari <PH> sesuai tujuan hibah", "<OBJ> dari <PH> dipakai <TRM> sesuai maksud hibah"],
              ["<TRM> memakai <OBJ> dari <PH> tidak sesuai tujuan hibah", "<OBJ> dari <PH> dipakai <TRM> tidak sesuai maksud hibah"])),
  gaya="lihat", sebabTarik="tidak-sesuai-tujuan")

T(Q("q-hb-warisan-bagian", "pp-hibah-warisan", 132, "tambahan", "pokok",
    "Apakah anak-anak lain <PH> juga pernah menerima pemberian darinya, dan apakah mereka keberatan atas hibah itu ?",
    hal="pemberian kepada anak lain dan keberatan atas hibah", ringkas="pemberian <PH> kepada anak-anaknya yang lain dan keberatan mereka atas hibah",
    teks_varian=["Apakah ahli waris <PH> yang lain keberatan karena penerima hibah mendapat lebih banyak ?"],
    melihat=["anak-anak <PH> yang lain menerima pemberian lebih kecil daripada hibah atas <OBJ> dan menyatakan keberatan",
             "hibah atas <OBJ> lebih besar daripada pemberian <PH> kepada anak-anaknya yang lain",
             "ahli waris <PH> yang lain keberatan karena hibah atas <OBJ> hanya diterima satu anak",
             "pemberian <PH> kepada anak lain lebih sedikit daripada hibah atas <OBJ> sehingga mereka keberatan"],
    berbeda=B("peristiwa", "versi A: anak-anak lain keberatan atas hibah; versi B: anak-anak lain tidak keberatan atas hibah - berselisih pada PERISTIWA",
              ["anak-anak <PH> yang lain keberatan atas hibah itu", "ahli waris <PH> yang lain menyatakan keberatan atas hibah itu"],
              ["anak-anak <PH> yang lain tidak keberatan atas hibah itu", "ahli waris <PH> yang lain menyatakan tidak berkeberatan atas hibah itu"])),
  gaya="tahu", penerima="anak-penghibah", pokokTuntutan="G")

# ------------------------------------------------------------------ persetujuan ahli waris
T(Q("q-hb-setuju-ya", "pp-hb-persetujuan", 141, "inti", "pokok",
    "Apakah ahli waris <PH> menyetujui hibah itu, bagaimana mereka menyatakannya, dan siapa saja yang menyetujui ?",
    hal="persetujuan ahli waris atas hibah", ringkas="persetujuan ahli waris <PH> atas hibah itu",
    teks_varian=["Siapa saja ahli waris <PH> yang menyetujui hibah itu dan apakah persetujuan itu diucapkan atau ditulis ?"],
    melihat=["seluruh ahli waris <PH> menyatakan setuju atas hibah itu di depan dua orang saksi yang hadir",
             "semua ahli waris menyetujui hibah <PH> dengan pernyataan yang diucapkan di hadapan dua orang saksi",
             "persetujuan semua ahli waris atas hibah <PH> dituangkan dalam pernyataan di depan dua orang saksi",
             "ahli waris <PH> menyatakan persetujuannya atas hibah itu secara bersama-sama di depan dua orang saksi"],
    mendengar=["semua ahli waris <PH> menyatakan setuju atas hibah itu", "seluruh ahli waris <PH> berkata menyetujui hibah itu",
               "ahli waris <PH> mengucapkan persetujuannya atas hibah itu", "para ahli waris <PH> menyatakan berkenan atas hibah itu"],
    sebagian=["sebagian ahli waris <PH> menyatakan setuju atas hibah itu", "beberapa ahli waris <PH> menyetujui hibah itu di depan keluarga"],
    berbeda=B("jumlah", "versi A: semua ahli waris menyetujui; versi B: ada ahli waris yang tidak menyetujui - berselisih pada JUMLAH (ahli waris yang menyetujui)",
              ["semua ahli waris <PH> menyetujui hibah itu", "seluruh ahli waris <PH> menyatakan setuju atas hibah itu"],
              ["ada ahli waris <PH> yang tidak menyetujui hibah itu", "tidak semua ahli waris <PH> menyatakan setuju atas hibah itu"])),
  gaya="lihat", persetujuan="disetujui-semua")

T(Q("q-hb-setuju-tolak", "pp-hb-persetujuan", 142, "inti", "pokok",
    "Siapa ahli waris yang tidak menyetujui hibah itu, apa alasannya, dan kapan ia menyatakannya ?",
    hal="ahli waris yang menolak hibah dan alasannya", ringkas="ahli waris <PH> yang tidak menyetujui hibah itu dan alasannya",
    teks_varian=["Adakah ahli waris yang berkeberatan atas hibah itu dan apa yang disampaikannya ?"],
    melihat=["ada ahli waris <PH> yang tidak menyetujui hibah itu dan menyatakan keberatannya di depan keluarga",
             "tidak semua ahli waris <PH> setuju dan keberatan itu disampaikan dengan jelas di depan keluarga",
             "salah seorang ahli waris <PH> tidak menerima hibah itu dan alasannya disampaikan terang-terangan",
             "sebagian ahli waris <PH> tidak setuju atas hibah itu dan menyampaikan keberatannya kepada keluarga lain"],
    sebagian=["ada ahli waris <PH> yang tidak menyetujui hibah itu", "seorang ahli waris <PH> tidak menyetujui hibah itu"],
    berbeda=B("peristiwa", "versi A: ada ahli waris yang menolak hibah; versi B: semua ahli waris menyetujui hibah - berselisih pada PERISTIWA",
              ["ada ahli waris <PH> yang tidak menyetujui hibah itu", "salah seorang ahli waris <PH> tidak menerima hibah itu"],
              ["semua ahli waris <PH> menyetujui hibah itu", "seluruh ahli waris <PH> setuju atas hibah itu"])),
  gaya="lihat", persetujuan="ada-yang-menolak")

# ------------------------------------------------------------------ penghibah sudah meninggal
T(Q("q-hb-penghibah-wafat", "pp-harta-ahli-waris", 143, "inti", "pokok",
    "Kapan <PH> meninggal dunia, berapa lama sesudah hibah itu diberikan, dan siapa ahli warisnya ?",
    hal="meninggalnya penghibah dan jarak waktunya dari hibah", ringkas="meninggalnya <PH> dan jarak waktunya dari pemberian hibah",
    teks_varian=["Berapa lama setelah hibah diberikan <PH> meninggal dunia dan siapa saja ahli warisnya ?"],
    melihat=["<PH> meninggal dunia sesudah hibah itu diberikan dan meninggalkan ahli waris yang dikenal keluarga",
             "setelah hibah diberikan <PH> wafat dan ahli warisnya masih hidup sampai sekarang",
             "hibah itu diberikan <PH> semasa hidupnya dan ia wafat sesudahnya dengan meninggalkan ahli waris",
             "<PH> wafat setelah menghibahkan hartanya dan para ahli warisnya diketahui keluarga"],
    sebagian=["<PH> meninggal dunia sesudah hibah itu diberikan", "<PH> wafat setelah memberikan hibah itu"],
    berbeda=B("lama", "versi A: penghibah meninggal lama sesudah hibah; versi B: penghibah meninggal segera sesudah hibah - berselisih pada LAMA",
              ["<PH> meninggal dunia lama sesudah memberikan hibah itu", "lama setelah hibah itu <PH> wafat"],
              ["<PH> meninggal dunia segera sesudah memberikan hibah itu", "segera setelah hibah itu <PH> wafat"])),
  gaya="lihat", statusPenghibah="sudah-meninggal")

# ------------------------------------------------------------------ akibat: hasil, pengalihan, pengosongan
T(Q("q-hb-hasil-dikuasai", "pp-hb-akibat", 151, "inti", "pokok",
    "Siapa yang menguasai dan menikmati hasil benda yang dihibahkan <PH> itu sekarang, sejak kapan, dan kira-kira berapa hasilnya ?",
    hal="penguasaan dan hasil benda hibah sekarang", ringkas="penguasaan dan hasil <OBJ> sampai sekarang",
    teks_varian=["Sejak kapan dan oleh siapa benda yang dihibahkan <PH> itu dikuasai serta hasilnya dinikmati ?"],
    melihat=["sejak hibah dari <PH> <LW> menguasai <OBJ> dan menikmati hasilnya sampai sekarang",
             "<OBJ> dikuasai <LW> sejak <PH> menghibahkannya dan hasilnya diambil <LW> setiap tahun",
             "hasil <OBJ> dinikmati <LW> sejak hibah dari <PH> hingga saat ini",
             "<LW> yang mengelola <OBJ> dan memanfaatkan hasilnya sejak hibah dari <PH>"],
    sebagian=["<LW> menguasai <OBJ> sejak hibah dari <PH>", "<OBJ> berada dalam penguasaan <LW> sejak hibah dari <PH>"],
    berbeda=B("pelaku", "versi A: yang menikmati hasil benda adalah pihak lawan; versi B: yang menikmati hasil benda adalah pengaju - berselisih pada PELAKU",
              ["<LW> yang menikmati hasil <OBJ> sejak hibah dari <PH>", "hasil <OBJ> dinikmati <LW> sejak hibah dari <PH>"],
              ["<PM> yang menikmati hasil <OBJ> sejak hibah dari <PH>", "hasil <OBJ> dinikmati <PM> sejak hibah dari <PH>"])),
  gaya="lihat", tuntutanTambahan="ganti-rugi")

T(Q("q-hb-dialihkan", "pp-hb-akibat", 152, "inti", "pokok",
    "Apakah ada tanda benda yang dihibahkan itu akan dijual, digadaikan atau dialihkan oleh pihak yang menguasainya, dan apa yang saksi lihat atau dengar ?",
    hal="kekhawatiran benda hibah dijual atau dialihkan", ringkas="kemungkinan <OBJ> dijual, digadaikan atau dialihkan oleh pihak yang menguasainya",
    teks_varian=["Apakah pernah ada pembicaraan atau tindakan menjual atau menjaminkan benda yang dihibahkan itu ?"],
    melihat=["<LW> pernah membicarakan rencana menjual <OBJ> kepada orang lain di depan keluarga",
             "ada pembicaraan <LW> untuk menggadaikan <OBJ> sehingga benda itu terancam berpindah tangan",
             "<LW> pernah menawarkan <OBJ> kepada pembeli di depan keluarga",
             "<LW> diketahui berencana mengalihkan <OBJ> kepada pihak lain"],
    sebagian=["pernah terdengar <OBJ> akan dijual oleh yang menguasainya", "ada kabar <OBJ> hendak dialihkan oleh yang menguasainya"],
    berbeda=B("peristiwa", "versi A: pihak yang menguasai berencana menjual atau mengalihkan benda; versi B: tidak ada rencana mengalihkan benda - berselisih pada PERISTIWA",
              ["<LW> berencana menjual atau mengalihkan <OBJ>", "<LW> pernah menawarkan <OBJ> kepada pembeli"],
              ["<LW> tidak berencana menjual atau mengalihkan <OBJ>", "<LW> tidak pernah menawarkan <OBJ> kepada pembeli"])),
  gaya="lihat", tuntutanTambahan="sita-jaminan")

T(Q("q-hb-pengosongan", "pp-hb-akibat", 153, "inti", "pokok",
    "Apakah <LW> yang menempati atau menguasai benda yang dihibahkan itu sekarang, sejak kapan, dan apakah sudah diminta menyerahkannya ?",
    hal="penempatan benda hibah dan permintaan penyerahannya", ringkas="penempatan <OBJ> oleh <LW> dan permintaan penyerahannya",
    teks_varian=["Apakah <LW> masih menempati benda hibah dan pernah diminta pergi atau menyerahkannya ?"],
    melihat=["<LW> menempati <OBJ> sampai sekarang dan pernah diminta menyerahkannya tetapi tetap bertahan",
             "sampai sekarang <OBJ> masih ditempati <LW> walaupun sudah diminta untuk menyerahkannya",
             "<LW> terus menguasai <OBJ> dan menolak ketika diminta menyerahkannya",
             "permintaan agar <LW> menyerahkan <OBJ> sudah disampaikan tetapi <LW> tetap menempatinya"],
    sebagian=["<LW> menempati <OBJ> sampai sekarang", "<OBJ> masih ditempati <LW> sampai sekarang"],
    berbeda=B("peristiwa", "versi A: pihak lawan sudah diminta menyerahkan benda; versi B: pihak lawan belum pernah diminta menyerahkan benda - berselisih pada PERISTIWA",
              ["<LW> sudah diminta menyerahkan <OBJ>", "permintaan agar <LW> menyerahkan <OBJ> sudah disampaikan"],
              ["<LW> belum pernah diminta menyerahkan <OBJ>", "permintaan agar <LW> menyerahkan <OBJ> belum pernah disampaikan"])),
  gaya="lihat", tuntutanTambahan="pengosongan")

# ------------------------------------------------------------------ dalil cacat lain
T(Q("q-hb-ttd-asli", "pp-hb-keabsahan", 161, "inti", "pokok",
    "Apakah tanda tangan atau cap jempol pada surat hibah itu benar milik <PH>, dan bagaimana saksi mengetahuinya ?",
    hal="keaslian tanda tangan atau cap jempol penghibah", ringkas="keaslian tanda tangan atau cap jempol <PH> pada surat hibah",
    teks_varian=["Apakah saksi mengenal tanda tangan <PH> dan apakah tanda tangan pada surat hibah itu sama dengannya ?"],
    melihat=["tanda tangan pada surat hibah itu sama dengan tanda tangan <PH> yang dikenal keluarga dan dibubuhkan olehnya sendiri",
             "<PH> sendiri yang membubuhkan tanda tangan pada surat hibah itu dan tanda tangannya sama dengan yang biasa dipakainya",
             "tanda tangan di surat hibah itu benar milik <PH> karena sama dengan tanda tangan yang sering dipakainya",
             "cap jempol atau tanda tangan pada surat hibah itu dibubuhkan <PH> sendiri dan dilihat banyak orang"],
    sebagian=["tanda tangan pada surat hibah itu mirip dengan tanda tangan <PH>", "tanda tangan di surat hibah itu sama dengan tanda tangan <PH> yang biasa dipakainya"],
    berbeda=B("pelaku", "versi A: tanda tangan dibubuhkan penghibah sendiri; versi B: tanda tangan dibubuhkan orang lain - berselisih pada PELAKU",
              ["<PH> sendiri yang membubuhkan tanda tangan pada surat hibah itu", "tanda tangan pada surat hibah itu dibubuhkan oleh <PH> sendiri"],
              ["tanda tangan pada surat hibah itu dibubuhkan oleh orang lain bukan <PH>", "yang membubuhkan tanda tangan pada surat hibah itu orang lain dan bukan <PH>"])),
  gaya="campur", dalilCacat="tanda-tangan-dipalsukan")

T(Q("q-hb-tanpa-saksi", "pp-hb-keabsahan", 162, "inti", "pokok",
    "Apakah ada orang yang menyaksikan <PH> memberikan hibah itu, siapa saja, dan apakah saksi sendiri hadir ?",
    hal="saksi yang menyaksikan pemberian hibah", ringkas="orang-orang yang menyaksikan <PH> memberikan hibah",
    teks_varian=["Siapa yang hadir dan menyaksikan ketika <PH> memberikan hibah itu ?"],
    melihat=["hibah itu diberikan <PH> tanpa ada seorang pun yang menyaksikan",
             "ketika menghibahkan hartanya <PH> hanya berdua dengan penerima tanpa saksi lain",
             "tidak ada saksi yang hadir ketika <PH> memberikan hibah itu",
             "pemberian hibah <PH> berlangsung tanpa dihadiri saksi"],
    berbeda=B("jumlah", "versi A: hibah diberikan di depan saksi; versi B: hibah diberikan tanpa saksi - berselisih pada JUMLAH (saksi)",
              ["hibah itu diberikan <PH> di depan dua orang saksi", "ketika menghibahkan hartanya <PH> disaksikan dua orang saksi"],
              ["hibah itu diberikan <PH> di depan seorang saksi saja", "ketika menghibahkan hartanya <PH> hanya disaksikan seorang saksi"])),
  gaya="lihat", dalilCacat="tanpa-saksi")

T(Q("q-hb-pura-pura", "pp-hb-keabsahan", 163, "inti", "pokok",
    "Apakah pemberian <PH> itu sungguh hibah, atau sebenarnya jual beli, pinjaman atau titipan, dan apa yang saksi ketahui tentangnya ?",
    hal="sifat pemberian yang dipersoalkan sebagai hibah", ringkas="sifat pemberian <OBJ> oleh <PH> yang dipersoalkan sebagai hibah",
    teks_varian=["Apakah <PH> benar-benar menghibahkan bendanya, atau hanya menitipkan atau menjualnya kepada penerima ?"],
    melihat=["<OBJ> diserahkan <PH> kepada <TRM> sebagai titipan dan bukan sebagai hibah",
             "pemberian <OBJ> dari <PH> kepada <TRM> sebenarnya jual beli dan bukan hibah",
             "<OBJ> dari <PH> diserahkan kepada <TRM> sebagai pinjaman yang harus dikembalikan dan bukan hibah",
             "<PH> hanya menitipkan <OBJ> kepada <TRM> dan tidak memaksudkannya sebagai hibah"],
    berbeda=B("peristiwa", "versi A: pemberian itu hibah; versi B: pemberian itu titipan atau pinjaman - berselisih pada PERISTIWA",
              ["<OBJ> dari <PH> diberikan kepada <TRM> sebagai hibah", "pemberian <OBJ> dari <PH> kepada <TRM> adalah hibah"],
              ["<OBJ> dari <PH> diserahkan kepada <TRM> sebagai titipan atau pinjaman", "pemberian <OBJ> dari <PH> kepada <TRM> adalah titipan atau pinjaman"])),
  gaya="campur", dalilCacat="hibah-pura-pura")

# ------------------------------------------------------------------ permohonan penetapan hibah
T(Q("q-hb-pm-kedudukan", "pp-hb-permohonan", 172, "inti", "pokok",
    "Apa kedudukan <PM> dalam hibah itu, apakah sebagai penghibah, penerima hibah atau ahli waris penghibah ?",
    hal="kedudukan pemohon dalam hibah", ringkas="kedudukan <PM> dalam hibah itu",
    teks_varian=["Bagaimana hubungan <PM> dengan hibah itu, sebagai penghibah, penerima hibah atau ahli waris ?"],
    melihat=["<PM> adalah penerima hibah atas <OBJ> dari <PH> dan menguasainya sampai sekarang",
             "kedudukan <PM> dalam hibah itu sebagai pihak yang menerima <OBJ> dari <PH>",
             "<PM> menerima <OBJ> dari <PH> sebagai hibah dan mengenal betul riwayatnya",
             "<PM> berada dalam kedudukan penerima hibah atas <OBJ> pemberian <PH>"],
    sebagian=["<PM> menerima <OBJ> dari <PH>", "<PM> menguasai <OBJ> pemberian <PH>"],
    berbeda=B("peristiwa", "versi A: pemohon adalah penerima hibah; versi B: pemohon bukan penerima hibah - berselisih pada PERISTIWA",
              ["<PM> adalah penerima hibah atas <OBJ> dari <PH>", "<PM> menerima <OBJ> dari <PH> sebagai hibah"],
              ["<PM> bukan penerima hibah atas <OBJ> dari <PH>", "<PM> tidak menerima <OBJ> dari <PH> sebagai hibah"])),
  gaya="tahu", perkara="permohonan")

T(Q("q-hb-pm-tujuan", "pp-hb-permohonan", 173, "inti", "pokok",
    "Untuk keperluan apa <PM> meminta penetapan hibah itu, misalnya balik nama di kantor pertanahan, bank atau lembaga lain ?",
    hal="keperluan penetapan hibah", ringkas="keperluan <PM> meminta penetapan hibah atas <OBJ>",
    teks_varian=["Apa yang hendak diurus <PM> dengan penetapan hibah itu ?"],
    melihat=["<PM> memerlukan penetapan hibah untuk mengurus balik nama <OBJ> atas namanya",
             "penetapan hibah atas <OBJ> dibutuhkan <PM> untuk mengurus surat-surat benda itu",
             "<PM> hendak memakai penetapan hibah untuk mengurus <OBJ> di lembaga yang berwenang",
             "keperluan <PM> adalah mengurus pendaftaran <OBJ> berdasarkan penetapan hibah"],
    sebagian=["<PM> hendak mengurus surat-surat <OBJ>", "<PM> memerlukan penetapan hibah atas <OBJ>"],
    berbeda=B("peristiwa", "versi A: penetapan dipakai untuk balik nama; versi B: penetapan dipakai untuk keperluan lain - berselisih pada PERISTIWA",
              ["<PM> memerlukan penetapan hibah untuk balik nama <OBJ>", "penetapan hibah atas <OBJ> dipakai <PM> untuk mengurus surat benda itu"],
              ["<PM> memerlukan penetapan hibah untuk keperluan lain selain balik nama <OBJ>", "penetapan hibah atas <OBJ> dipakai <PM> untuk keperluan yang berbeda dari surat benda itu"])),
  gaya="tahu", perkara="permohonan")

T(Q("q-hb-pm-ahliwaris-tahu", "pp-hb-permohonan", 174, "pilihan", "pokok",
    "Apakah ahli waris <PH> yang lain mengetahui hibah itu dan apakah ada yang berkeberatan atas permohonan ini ?",
    hal="pengetahuan ahli waris penghibah atas hibah dan permohonan", ringkas="pengetahuan ahli waris <PH> atas hibah dan atas permohonan <PM>",
    teks_varian=["Apakah keluarga <PH> sudah mengetahui hibah itu dan menyetujui permohonan ini ?"],
    melihat=["ahli waris <PH> yang lain sudah mengetahui hibah itu dan menyetujui permohonan <PM>",
             "keluarga <PH> mengetahui hibah itu dan menyatakan setuju atas permohonan <PM>",
             "ahli waris <PH> lainnya sudah diberi tahu tentang hibah itu dan menyetujui permohonan <PM>",
             "semua keluarga <PH> mengetahui hibah itu dan menyetujui permohonan <PM>"],
    sebagian=["ahli waris <PH> yang lain sudah mengetahui hibah itu", "keluarga <PH> mengetahui hibah itu"],
    berbeda=B("peristiwa", "versi A: ahli waris lain mengetahui dan menyetujui hibah; versi B: ahli waris lain tidak mengetahui hibah - berselisih pada PERISTIWA",
              ["ahli waris <PH> yang lain mengetahui hibah itu dan menyetujui permohonan <PM>", "keluarga <PH> mengetahui hibah itu dan menyetujui permohonan <PM>"],
              ["ahli waris <PH> yang lain tidak mengetahui hibah itu dan permohonan <PM>", "keluarga <PH> tidak mengetahui hibah itu dan permohonan <PM>"])),
  gaya="tahu", perkara="permohonan")

T(Q("q-hb-pm-dokumen", "pp-hb-permohonan", 175, "pilihan", "pokok",
    "Surat apa yang dibuat ketika hibah itu diberikan, apakah ditulis di bawah tangan atau hilang, dan siapa yang membuatnya ?",
    hal="keadaan surat hibah dalam permohonan penetapan", ringkas="keadaan surat hibah atas <OBJ> dari <PH>",
    teks_varian=["Apakah ada surat hibah tertulis, di mana suratnya sekarang, dan siapa yang membuatnya ?"],
    melihat=["hibah atas <OBJ> dari <PH> dituangkan dalam surat di bawah tangan yang masih disimpan <PM>",
             "ketika hibah atas <OBJ> diberikan <PH> membuat surat sederhana yang kini dipegang <PM>",
             "surat hibah atas <OBJ> dari <PH> dibuat sendiri sebagai surat di bawah tangan dan disimpan <PM>",
             "<PM> menyimpan surat hibah atas <OBJ> yang dibuat <PH> secara sederhana"],
    sebagian=["ada surat hibah atas <OBJ> dari <PH> yang disimpan <PM>", "<PM> menyimpan surat hibah atas <OBJ> dari <PH>"],
    berbeda=B("peristiwa", "versi A: surat hibah masih ada; versi B: surat hibah sudah hilang - berselisih pada PERISTIWA",
              ["surat hibah atas <OBJ> dari <PH> masih ada pada <PM>", "<PM> masih menyimpan surat hibah atas <OBJ> dari <PH>"],
              ["surat hibah atas <OBJ> dari <PH> sudah hilang dari <PM>", "<PM> sudah kehilangan surat hibah atas <OBJ> dari <PH>"])),
  gaya="campur", perkara="permohonan")

CATATAN = [
    "Versi 2 (21 Okt 2026): umur, akal dan kehendak bebas penghibah, penghibah sakit menjelang meninggal, pernyataan hibah dan penerimaannya, surat atau akta hibah, saksi hibah, bukti hak dan nilai benda, balik nama dan penguasaan sesudah hibah, sebab penarikan hibah, persetujuan ahli waris, dalil cacat hibah, penguasaan hasil dan pengosongan, serta permohonan penetapan hibah ditambahkan; semua butir versi 1 dipertahankan.",
    "Pilihan keadaan pada layar menentukan butir yang tampil; jawaban 'berbeda' dan jawaban yang memuat titik-titik hanya kerangka: sesuaikan dengan keterangan saksi yang sesungguhnya.",
    "Sah atau tidaknya hibah, batas sepertiga, penarikan kembali dan perhitungan sebagai warisan adalah penilaian hakim; keterangan saksi hanya menjadi dasar pembuktian.",
]

PROFIL = {
    "hadir-sendiri": dict(label="Hadir ketika hibah diberikan dan mengetahui sendiri", peta={"*": "melihat", "pp-hb-akibat": "de-auditu"}, sumber=True),
    "mendengar-ucapan": dict(label="Mendengar sendiri ucapan penghibah, tidak melihat bendanya", peta={"*": "melihat", "pp-hb-ijab-kabul": "mendengar", "pp-bentuk-hibah": "mendengar", "pp-penerima-hibah": "mendengar", "pp-hb-persetujuan": "mendengar"}),
    "tahu-setelah-hibah": dict(label="Tahu hibah dari cerita setelah hibah diberikan", peta={"*": "de-auditu", "pp-hubungan-saksi": "melihat", "pp-hb-akibat": "melihat", "pp-hb-pasca": "melihat"}, sumber=True),
    "tahu-sebagian-hibah": dict(label="Hanya tahu sebagian isi hibah (centang hal yang diketahui)", peta={"*": "sebagian", "pp-hubungan-saksi": "melihat"}),
    "kenal-tidak-tahu-hibah": dict(label="Mengenal penghibah tetapi tidak tahu soal hibah", peta={"*": "tidak-tahu", "pp-hubungan-saksi": "melihat"}),
    "ragu": dict(label="Ragu dan kurang ingat", peta={"*": "ragu", "pp-hubungan-saksi": "melihat"}),
}


def BLANGKO_PERBAIKAN(kat):
    """blangkoBas: semua berkas BAS saksi sudah tercantum (diperiksa terhadap server 21 Okt 2026)."""
    return None


if __name__ == "__main__":
    v1 = json.load(open(os.path.join(L.V1, "hibah.json"), encoding="utf8"))
    kat = L.bangun(v1, sys.modules[__name__], PETA)
    p = L.tulis(kat, "hibah")
    print("hibah: pertanyaan %d -> %d, pokok %d -> %d, keadaan %d -> %d, dasar %d -> %d" % (
        len(v1["pertanyaan"]), len(kat["pertanyaan"]), len(v1["pokokPembuktian"]), len(kat["pokokPembuktian"]), len(v1["keadaan"]), len(kat["keadaan"]), len(v1["dasarHukum"]), len(kat["dasarHukum"])))
    print(L.periksa(p))
