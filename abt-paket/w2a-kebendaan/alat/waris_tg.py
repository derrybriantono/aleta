# -*- coding: utf-8 -*-
"""
Katalog TAMBAHAN kewarisan-tergugat versi 2 (W2a-K1): butir saksi yang diajukan Tergugat untuk bantahan baru.
Pakai: python waris_tg.py <tergugat-v1.json> <keluar.json>
"""
import copy, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kb import Berkas, bangun_q, B, selesai, Q  # noqa: E402

PETA = {"_g": "x", "PM": "#0046#", "TG": "#0047#", "W": "#2026# #1025#"}
BK = Berkas(PETA)
t = BK.tambah
MENGGANTIKAN = {}


def tg(q, ganti, **ke):
    MENGGANTIKAN[q.id] = ganti
    t(q, **ke)


tg(Q("q-tg-wasiat", "pp-bantahan", 60, "tambahan", "pokok",
     "Apakah <W> berwasiat kepada <TG>, apa isinya, kapan disampaikan, siapa yang menyaksikan, dan apakah ahli waris lain menyetujuinya ?",
     hal="wasiat pewaris kepada Tergugat dan persetujuan ahli waris", ringkas="wasiat <W> kepada <TG>, isi, saksi dan persetujuan ahli waris lain",
     pihak=("T",),
     melihat=["<W> berwasiat kepada <TG> bahwa ... diberikan kepadanya dan wasiat itu disampaikan di depan saksi pada ...",
              "sebelum wafat <W> menyampaikan wasiat untuk <TG> berupa ... yang disaksikan dua orang keluarga",
              "wasiat <W> kepada <TG> dibuat pada ... dan isinya tidak melebihi sepertiga harta serta diketahui ahli waris lain",
              "<W> menuliskan wasiat untuk <TG> tentang ... dan ahli waris yang hadir mengetahui isinya"],
     sebagian=["<W> pernah berwasiat kepada <TG>", "ada wasiat <W> untuk <TG> sebelum wafat"],
     berbeda=B("peristiwa", "versi A: pewaris berwasiat kepada Tergugat; versi B: pewaris tidak pernah berwasiat - berselisih pada PERISTIWA",
               ["<W> berwasiat kepada <TG> sebelum wafat", "ada wasiat <W> untuk <TG> yang disampaikan di depan saksi"],
               ["<W> tidak pernah berwasiat kepada <TG>", "tidak ada wasiat <W> untuk <TG> sebelum wafat"]),
     bantahan=["ada-wasiat"]),
   ["q-w-wasiat-isi", "q-w-wasiat-sepertiga"])

tg(Q("q-tg-hibah-semasa-hidup", "pp-bantahan", 61, "tambahan", "pokok",
     "Apa yang diterima <TG> dari <W> semasa hidupnya sebagai hibah, kapan, dengan cara apa, dan siapa yang mengetahuinya ?",
     hal="hibah pewaris kepada Tergugat semasa hidup", ringkas="hibah yang diterima <TG> dari <W> semasa hidup, waktu, cara dan saksinya",
     pihak=("T",),
     melihat=["semasa hidupnya <W> menghibahkan ... kepada <TG> pada ... dan penyerahannya disaksikan keluarga",
              "<TG> menerima ... dari <W> sebagai hibah pada ... dan hibah itu sudah dikuasai <TG> sejak saat itu",
              "pemberian ... dari <W> kepada <TG> pada ... dilakukan di depan keluarga dan dicatat dalam surat hibah",
              "hibah dari <W> kepada <TG> berupa ... sudah diserahkan sebelum <W> wafat"],
     sebagian=["<W> pernah menghibahkan hartanya kepada <TG>", "<TG> pernah menerima pemberian dari <W> semasa hidup"],
     berbeda=B("peristiwa", "versi A: pewaris menghibahkan harta kepada Tergugat; versi B: pewaris tidak pernah menghibahkan - berselisih pada PERISTIWA",
               ["<W> menghibahkan hartanya kepada <TG> semasa hidup", "<TG> menerima hibah dari <W> sebelum <W> wafat"],
               ["<W> tidak pernah menghibahkan hartanya kepada <TG>", "<TG> tidak pernah menerima hibah dari <W> semasa hidup"]),
     bantahan=["hibah-semasa-hidup"]),
   ["q-w-hibah-semasa-hidup", "q-w-hibah-diperhitungkan"])

tg(Q("q-tg-nasab-anak", "pp-bantahan", 62, "tambahan", "pokok",
     "Apa yang saksi ketahui tentang hubungan <PM> dengan <W>, apakah ia anak kandung dari perkawinan yang sah, atau ada keadaan lain yang menyangkut nasabnya ?",
     hal="nasab Penggugat terhadap pewaris menurut Tergugat", ringkas="hubungan <PM> dengan <W> dan keadaan nasabnya menurut <TG>",
     pihak=("T",),
     melihat=["<PM> bukan anak kandung <W> dari perkawinan yang sah dan hal itu diketahui keluarga sejak lama",
              "nasab <PM> kepada <W> tidak jelas karena lahir bukan dari perkawinan <W> yang sah",
              "<PM> dikenal sebagai anak orang lain yang diasuh dan tidak lahir dari perkawinan <W>",
              "keluarga <W> mengetahui bahwa hubungan <PM> dengan <W> bukan sebagai anak kandung"],
     sebagian=["<PM> bukan anak kandung <W>", "nasab <PM> kepada <W> dipersoalkan keluarga"],
     berbeda=B("peristiwa", "versi A: Penggugat bukan anak kandung pewaris; versi B: Penggugat adalah anak kandung pewaris - berselisih pada PERISTIWA",
               ["<PM> bukan anak kandung <W>", "nasab <PM> kepada <W> tidak jelas"],
               ["<PM> adalah anak kandung <W> dari perkawinan yang sah", "nasab <PM> kepada <W> jelas dan tidak diragukan"]),
     bantahan=["bukan-ahli-waris"]),
   ["q-w-anak-nasab-sah"])

tg(Q("q-tg-harta-bersama-pasangan", "pp-bantahan", 63, "tambahan", "pokok",
     "Bagian mana dari harta itu yang menurut saksi diperoleh <W> bersama pasangannya, dan apa buktinya bahwa harta itu dicari selama perkawinan ?",
     hal="harta bersama pewaris dengan pasangannya menurut Tergugat", ringkas="harta yang diperoleh <W> bersama pasangannya selama perkawinan menurut <TG>",
     pihak=("T",),
     melihat=["sebagian harta itu dicari <W> bersama pasangannya selama perkawinan dan dibeli dari penghasilan mereka berdua",
              "harta itu diperoleh pada masa perkawinan <W> sehingga separuhnya menjadi hak pasangan yang masih hidup",
              "bukti pembelian harta itu bertanggal pada masa perkawinan <W> dengan pasangannya",
              "pasangan <W> ikut bekerja mengumpulkan harta itu sehingga harta tersebut bukan milik pribadi <W> saja"],
     sebagian=["sebagian harta itu diperoleh <W> bersama pasangannya", "harta itu dicari selama perkawinan <W>"],
     berbeda=B("peristiwa", "versi A: harta itu harta bersama dengan pasangan; versi B: harta itu milik pribadi pewaris - berselisih pada PERISTIWA",
               ["harta itu diperoleh <W> bersama pasangannya selama perkawinan", "harta itu hasil kerja <W> dan pasangannya selama menikah"],
               ["harta itu milik pribadi <W> sebelum menikah", "harta itu dibeli <W> sendiri sebelum perkawinan"]),
     bantahan=["harta-bersama-pasangan"]),
   ["q-w-harta-bersama-dipisah", "q-w-harta-pribadi-pewaris"])

tg(Q("q-tg-dijual-semasa-hidup", "pp-bantahan", 64, "tambahan", "pokok",
     "Apakah harta itu sudah dijual atau dialihkan oleh <W> sendiri semasa hidup, kapan, kepada siapa, dan siapa yang menyaksikannya ?",
     hal="penjualan harta oleh pewaris semasa hidup", ringkas="penjualan atau pengalihan harta oleh <W> semasa hidup beserta saksinya",
     pihak=("T",),
     melihat=["harta itu sudah dijual <W> sendiri semasa hidup kepada ... pada ... dan penjualan itu disaksikan keluarga",
              "sebelum wafat <W> mengalihkan harta itu kepada ... sehingga bukan lagi harta peninggalan",
              "penjualan harta itu dilakukan <W> pada ... dan uangnya sudah dipakai untuk keperluan <W>",
              "harta yang digugat sudah berpindah tangan pada masa <W> hidup dan ada surat jual belinya"],
     sebagian=["harta itu sudah dijual <W> semasa hidup", "sebelum wafat <W> sudah mengalihkan harta itu"],
     berbeda=B("peristiwa", "versi A: harta sudah dijual semasa pewaris hidup; versi B: harta masih milik pewaris sampai wafat - berselisih pada PERISTIWA",
               ["harta itu sudah dijual <W> semasa hidup", "sebelum wafat <W> sudah mengalihkan harta itu kepada orang lain"],
               ["harta itu masih milik <W> sampai wafat", "sampai wafat <W> belum pernah menjual harta itu"]),
     bantahan=["dijual-semasa-pewaris"]),
   ["q-w-jual-sepihak", "q-w-balik-nama-sepihak"])

tg(Q("q-tg-biaya-pengurusan", "pp-bantahan", 65, "tambahan", "pokok",
     "Apa saja biaya yang sudah dikeluarkan <TG> untuk perawatan, pemakaman, dan keperluan lain <W>, berapa jumlahnya, dan apakah ahli waris lain pernah mengganti ?",
     hal="biaya yang dikeluarkan Tergugat untuk pewaris", ringkas="biaya perawatan, pemakaman dan keperluan lain <W> yang dikeluarkan <TG> dan penggantiannya",
     pihak=("T",),
     melihat=["<TG> yang mengeluarkan biaya perawatan dan pemakaman <W> sekitar ... dan belum diganti oleh ahli waris lain",
              "biaya pengobatan dan pemakaman <W> dibayar <TG> dari uangnya sendiri dengan nilai sekitar ...",
              "ahli waris lain tidak ikut menanggung biaya perawatan <W> yang seluruhnya ditanggung <TG>",
              "<TG> menalangi biaya pengurusan jenazah <W> sekitar ... dan menyimpan kuitansinya"],
     sebagian=["<TG> yang menanggung biaya pemakaman <W>", "biaya perawatan <W> sebagian ditanggung <TG>"],
     berbeda=B("pelaku", "versi A: biaya ditanggung Tergugat; versi B: biaya ditanggung ahli waris lain - berselisih pada PELAKU",
               ["biaya perawatan dan pemakaman <W> ditanggung <TG>", "<TG> yang membayar biaya pengurusan jenazah <W>"],
               ["biaya perawatan dan pemakaman <W> ditanggung ahli waris lain", "ahli waris lain yang membayar biaya pengurusan jenazah <W>"]),
     bantahan=["biaya-pengurusan"]),
   ["q-w-biaya-jenazah"])

tg(Q("q-tg-penguasaan-sah", "pp-bantahan", 66, "tambahan", "pokok",
     "Atas dasar apa <TG> menguasai harta peninggalan itu, apakah atas amanat <W>, kesepakatan ahli waris, atau untuk merawatnya, dan sejak kapan ?",
     hal="dasar penguasaan harta peninggalan oleh Tergugat", ringkas="dasar penguasaan harta peninggalan <W> oleh <TG>",
     pihak=("T",),
     melihat=["<TG> menguasai harta peninggalan itu atas amanat <W> sebelum wafat untuk merawatnya bagi seluruh ahli waris",
              "ahli waris lain pernah menyetujui <TG> memegang harta peninggalan itu untuk dipelihara sampai dibagi",
              "<TG> merawat dan memelihara harta peninggalan itu sejak <W> wafat dengan biayanya sendiri",
              "penguasaan harta peninggalan oleh <TG> berlangsung sejak ... dengan sepengetahuan keluarga"],
     sebagian=["<TG> memegang harta peninggalan itu untuk dirawat", "<TG> menguasai harta peninggalan itu atas amanat <W>"],
     berbeda=B("peristiwa", "versi A: Tergugat menguasai atas amanat atau persetujuan; versi B: Tergugat menguasai tanpa dasar - berselisih pada PERISTIWA",
               ["<TG> menguasai harta peninggalan itu atas amanat <W> dan persetujuan keluarga", "<TG> memegang harta peninggalan itu untuk merawatnya bagi seluruh ahli waris"],
               ["<TG> menguasai harta peninggalan itu tanpa amanat <W> dan tanpa persetujuan keluarga", "<TG> memegang harta peninggalan itu untuk dirinya sendiri"]),
     bantahan=["penguasaan-sah"]),
   ["q-w-penguasa-lawan", "q-w-penghalangan-ahli-waris"])

tg(Q("q-tg-ahli-waris-terhalang", "pp-bantahan", 67, "tambahan", "pokok",
     "Apa yang saksi ketahui tentang alasan <PM> disebut terhalang menjadi ahli waris, apakah karena beda agama atau putusan pengadilan, dan bagaimana kejadiannya ?",
     hal="alasan Penggugat terhalang menjadi ahli waris menurut Tergugat", ringkas="alasan <PM> terhalang menjadi ahli waris <W> menurut <TG>",
     pihak=("T",),
     melihat=["<PM> sudah berpindah agama dari Islam sejak ... sehingga tidak termasuk ahli waris <W>",
              "<PM> pernah dihukum oleh pengadilan karena perbuatannya terhadap <W> dan putusannya sudah berkekuatan tetap",
              "keluarga <W> mengetahui bahwa <PM> tidak lagi beragama Islam sejak ...",
              "<PM> terhalang menjadi ahli waris karena perbuatan terhadap <W> yang sudah diputus pengadilan"],
     sebagian=["<PM> sudah berbeda agama dengan <W>", "<PM> pernah berurusan dengan pengadilan karena perbuatan terhadap <W>"],
     berbeda=B("peristiwa", "versi A: Penggugat terhalang sebagai ahli waris; versi B: Penggugat tidak terhalang - berselisih pada PERISTIWA",
               ["<PM> terhalang menjadi ahli waris <W>", "<PM> tidak termasuk ahli waris <W> karena beda agama atau putusan pengadilan"],
               ["<PM> tidak terhalang menjadi ahli waris <W>", "<PM> tetap beragama Islam dan tidak pernah dihukum karena perbuatan terhadap <W>"]),
     bantahan=["ahli-waris-terhalang"]),
   ["q-w-agama-ahli-waris", "q-w-terhalang-pembunuhan"])

tg(Q("q-tg-pernah-ditawari-bagian", "pp-bantahan", 68, "tambahan", "pokok",
     "Apakah <TG> pernah menawarkan pembagian warisan kepada <PM>, kapan, bagaimana tawarannya, dan bagaimana tanggapan <PM> ?",
     hal="tawaran pembagian warisan dari Tergugat kepada Penggugat", ringkas="tawaran pembagian warisan <W> dari <TG> kepada <PM> dan tanggapan <PM>",
     pihak=("T",),
     melihat=["<TG> pernah menawarkan pembagian warisan <W> kepada <PM> pada ... tetapi <PM> menolak tawaran itu",
              "pada ... <TG> mengajak <PM> membagi warisan <W> dengan cara ... namun <PM> tidak menerimanya",
              "tawaran pembagian dari <TG> kepada <PM> disampaikan di depan keluarga dan tidak disetujui <PM>",
              "<TG> sudah beberapa kali mengajukan usul pembagian warisan <W> kepada <PM> dan semuanya ditolak"],
     sebagian=["<TG> pernah menawarkan pembagian warisan kepada <PM>", "<TG> pernah mengajak <PM> membagi warisan"],
     berbeda=B("peristiwa", "versi A: Tergugat sudah menawarkan pembagian dan ditolak Penggugat; versi B: Tergugat tidak pernah menawarkan - berselisih pada PERISTIWA",
               ["<TG> pernah menawarkan pembagian warisan kepada <PM> tetapi <PM> menolaknya", "<TG> sudah mengajukan usul pembagian warisan kepada <PM> dan ditolak"],
               ["<TG> tidak pernah menawarkan pembagian warisan apa pun kepada <PM>", "<TG> tidak pernah mengajukan usul pembagian warisan kepada <PM>"]),
     bantahan=["pernah-ditawari-bagian"]),
   ["q-w-kesepakatan-bagian", "q-upaya-damai"])
selesai()

BANTAHAN_BARU = ["bukan-harta-pewaris", "sudah-dibagi-atau-dihibahkan", "bukan-ahli-waris", "ahli-waris-lain", "utang-pewaris",
                 "ada-wasiat", "hibah-semasa-hidup", "harta-bersama-pasangan", "dijual-semasa-pewaris", "biaya-pengurusan", "penguasaan-sah", "ahli-waris-terhalang", "pernah-ditawari-bagian"]
LABEL_BARU = {
    "ahli-waris-lain": "ada ahli waris lain", "utang-pewaris": "pewaris meninggalkan utang",
    "ada-wasiat": "pewaris berwasiat kepada Tergugat", "hibah-semasa-hidup": "pewaris menghibahkan harta kepada Tergugat semasa hidup",
    "harta-bersama-pasangan": "sebagian harta adalah harta bersama dengan pasangan", "dijual-semasa-pewaris": "harta sudah dijual pewaris semasa hidup",
    "biaya-pengurusan": "Tergugat menanggung biaya pengurusan pewaris", "penguasaan-sah": "Tergugat menguasai atas amanat atau persetujuan",
    "ahli-waris-terhalang": "Penggugat terhalang menjadi ahli waris", "pernah-ditawari-bagian": "Tergugat pernah menawarkan pembagian",
}


def bangun(v1):
    kat = copy.deepcopy(v1)
    kat["versi"] = 2
    ada = {q["id"] for q in kat["pertanyaan"]}
    for q in BK.semua:
        assert q.id not in ada, q.id
        d = bangun_q(q, PETA)
        d["menggantikan"] = MENGGANTIKAN[q.id]
        kat["pertanyaan"].append(d)
    ur = [q["urutan"] for q in kat["pertanyaan"]]
    assert len(ur) == len(set(ur)), "urutan kembar"
    kat["pertanyaan"].sort(key=lambda p: p["urutan"])
    b = kat["keadaan"]["bantahan"]
    for n in BANTAHAN_BARU:
        if n not in b["nilai"]:
            b["nilai"].append(n)
    b["labelNilai"] = dict(b.get("labelNilai") or {}, **LABEL_BARU)
    kat["catatanPetugas"] = list(kat["catatanPetugas"]) + [
        "Versi 2 (21 Okt 2026): bantahan tentang wasiat kepada Tergugat, hibah semasa hidup, nasab Penggugat, harta bersama dengan pasangan, penjualan semasa pewaris hidup, biaya pengurusan, dasar penguasaan, penghalang ahli waris dan tawaran pembagian ditambahkan.",
    ]
    return kat


if __name__ == "__main__":
    v1 = json.load(open(sys.argv[1], encoding="utf8"))
    kat = bangun(v1)
    json.dump(kat, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("tergugat pertanyaan %d -> %d" % (len(v1["pertanyaan"]), len(kat["pertanyaan"])))
