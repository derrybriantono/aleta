# -*- coding: utf-8 -*-
"""
Katalog TAMBAHAN harta-bersama-tergugat versi 2 (W2a-K1): butir saksi yang diajukan Tergugat untuk bantahan baru.
Pakai: python hb_tg.py <tergugat-v1.json> <keluar.json>   (butir arah Tergugat menggantikan butir utama yang arahnya dalil Penggugat)
"""
import copy, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kb import Berkas, bangun_q, B, selesai, Q  # noqa: E402

PETA = {"_g": "x", "PM": "#0046#", "TG": "#0047#"}
BK = Berkas(PETA)
t = BK.tambah
MENGGANTIKAN = {}


def tg(q, ganti, **ke):
    MENGGANTIKAN[q.id] = ganti
    t(q, **ke)


tg(Q("q-tg-hibah-warisan", "pp-bantahan", 80, "tambahan", "pokok",
     "Apakah <TG> pernah menerima hibah atau warisan, dari siapa, kapan, apa wujudnya, dan apakah harta itu masih ada terpisah dari harta lain ?",
     hal="hibah atau warisan yang diterima Tergugat", ringkas="hibah atau warisan yang diterima <TG> dan keberadaannya yang terpisah dari harta bersama",
     pihak=("T",),
     melihat=["<TG> menerima warisan dari orang tuanya berupa ... pada ... dan harta itu tidak pernah dicampur dengan harta hasil kerja bersama <PM>",
              "pemberian berupa ... dari keluarga <TG> pada ... adalah hibah untuk <TG> pribadi dan tersimpan terpisah",
              "harta yang berasal dari warisan itu diterima <TG> sebelum atau selama menikah dan dipisahkan dari uang rumah tangga <PM> dan <TG>",
              "warisan berupa ... itu jatuh kepada <TG> secara pribadi dan sampai sekarang masih dikuasai <TG> terpisah dari harta bersama"],
     sebagian=["<TG> pernah menerima warisan dari keluarganya", "<TG> pernah menerima hibah dari keluarganya"],
     berbeda=B("peristiwa", "versi A: Tergugat menerima warisan atau hibah pribadi yang terpisah; versi B: tidak ada warisan atau hibah pribadi - berselisih pada PERISTIWA",
               ["<TG> menerima warisan dari orang tuanya berupa ... pada ... yang terpisah dari harta bersama", "pemberian berupa ... dari keluarga <TG> adalah hibah untuk <TG> pribadi"],
               ["<TG> tidak pernah menerima warisan atau hibah pribadi dari siapa pun", "tidak ada harta yang diterima <TG> secara pribadi dari warisan atau hibah"]),
     bantahan=["bawaan-hibah-warisan"]),
   ["q-hibah-warisan-diterima", "q-masih-ada-bawaan"])

tg(Q("q-tg-milik-sebelum-nikah", "pp-bantahan", 81, "tambahan", "pokok",
     "Apa bukti bahwa <TG> sudah memiliki objek itu sebelum menikah dengan <PM>, dan apakah sesudah menikah objek itu tetap tidak diubah dengan uang bersama ?",
     hal="kepemilikan Tergugat atas objek sebelum menikah", ringkas="kepemilikan <TG> atas objek sebelum menikah dengan <PM> dan keadaannya sesudah menikah",
     pihak=("T",),
     melihat=["objek itu sudah dimiliki <TG> sebelum menikah dengan <PM> dan buktinya berupa surat atas nama <TG> yang terbit lebih dahulu",
              "sebelum <TG> menikah dengan <PM> objek itu sudah menjadi milik <TG> dan sesudah menikah tidak ada tambahan dari uang bersama",
              "objek itu dibeli <TG> pada ... sebelum perkawinan dengan <PM> sehingga bukan hasil usaha bersama",
              "kepemilikan objek itu oleh <TG> sudah ada pada ... jauh sebelum pernikahan dengan <PM>"],
     sebagian=["objek itu sudah dimiliki <TG> sebelum menikah dengan <PM>", "objek itu sudah ada sebelum <TG> menikah dengan <PM>"],
     berbeda=B("waktu", "versi A: objek dimiliki Tergugat sebelum menikah; versi B: objek diperoleh sesudah menikah - berselisih pada WAKTU",
               ["objek itu sudah dimiliki <TG> sebelum menikah dengan <PM>", "kepemilikan objek itu oleh <TG> sudah ada sebelum pernikahan dengan <PM>"],
               ["objek itu baru diperoleh sesudah <TG> menikah dengan <PM>", "kepemilikan objek itu baru ada setelah pernikahan <TG> dengan <PM>"]),
     bantahan=["sebelum-menikah"]),
   ["q-milik-sebelum-nikah"])

tg(Q("q-tg-sudah-dihibahkan", "pp-bantahan", 82, "tambahan", "pokok",
     "Apakah objek itu sudah dihibahkan kepada anak atau orang lain, kapan, dan apakah <PM> mengetahui atau menyetujuinya ?",
     hal="penghibahan objek dengan sepengetahuan Penggugat", ringkas="penghibahan objek kepada anak atau orang lain dan sepengetahuan atau persetujuan <PM>",
     pihak=("T",),
     melihat=["objek itu sudah dihibahkan kepada ... pada ... dan <PM> mengetahui serta menyetujui pemberian itu",
              "pemberian objek itu kepada ... dilakukan <PM> dan <TG> bersama pada ... sebagai hibah",
              "hibah objek itu kepada ... terjadi pada ... dan <PM> hadir ketika pemberian itu dilakukan",
              "objek itu telah diserahkan kepada ... sebagai hibah pada ... atas kesepakatan <PM> dan <TG>"],
     sebagian=["objek itu sudah dihibahkan kepada anak mereka", "objek itu sudah diberikan kepada orang lain sebagai hibah"],
     berbeda=B("peristiwa", "versi A: objek sudah dihibahkan dengan persetujuan Penggugat; versi B: objek belum pernah dihibahkan - berselisih pada PERISTIWA",
               ["objek itu sudah dihibahkan kepada ... dengan persetujuan <PM>", "pemberian objek itu kepada ... dilakukan <PM> dan <TG> bersama"],
               ["objek itu belum pernah dihibahkan kepada siapa pun", "objek itu masih tercatat sebagai milik <PM> dan <TG> dan belum diserahkan sebagai hibah"]),
     bantahan=["sudah-dihibahkan"]),
   ["q-dihibahkan-pihak-ketiga", "q-dijual-tanpa-persetujuan"])

tg(Q("q-tg-pisah-harta-dicatat", "pp-bantahan", 83, "tambahan", "pokok",
     "Di hadapan siapa perjanjian pisah harta antara <PM> dan <TG> dibuat, kapan dibuat, dan apakah dicatat sehingga berlaku bagi mereka ?",
     hal="pembuatan dan pencatatan perjanjian pisah harta", ringkas="pembuatan dan pencatatan perjanjian pisah harta antara <PM> dan <TG>",
     pihak=("T",),
     melihat=["perjanjian pisah harta antara <PM> dan <TG> dibuat pada ... di hadapan ... dan dicatat sehingga berlaku bagi keduanya",
              "<PM> dan <TG> menandatangani perjanjian pisah harta pada ... di hadapan ... dan perjanjian itu didaftarkan",
              "ada perjanjian tertulis antara <PM> dan <TG> yang memisahkan harta masing-masing dan dicatat oleh ...",
              "pemisahan harta <PM> dan <TG> dituangkan dalam perjanjian pada ... yang disaksikan oleh ..."],
     sebagian=["<PM> dan <TG> pernah membuat perjanjian pisah harta", "ada perjanjian pisah harta antara <PM> dan <TG>"],
     berbeda=B("peristiwa", "versi A: perjanjian pisah harta dibuat dan dicatat; versi B: tidak ada perjanjian pisah harta - berselisih pada PERISTIWA",
               ["perjanjian pisah harta antara <PM> dan <TG> dibuat dan dicatat sehingga berlaku bagi keduanya", "<PM> dan <TG> menandatangani perjanjian pisah harta yang didaftarkan"],
               ["<PM> dan <TG> tidak pernah membuat perjanjian pisah harta", "tidak ada perjanjian pisah harta antara <PM> dan <TG>"]),
     bantahan=["pisah-harta"]),
   ["q-perjanjian-kawin-dicatat", "q-perjanjian-kawin-isi"])

tg(Q("q-tg-utang-pelunasan", "pp-bantahan", 84, "tambahan", "pokok",
     "Siapa yang melunasi utang bersama itu sampai sekarang, berapa yang sudah dibayar <TG>, dan berapa sisa yang masih harus ditanggung bersama ?",
     hal="pelunasan utang bersama oleh Tergugat", ringkas="pelunasan utang bersama oleh <TG> dan sisa yang harus ditanggung bersama dengan <PM>",
     pihak=("T",),
     melihat=["utang bersama itu dilunasi <TG> dari penghasilannya sendiri sebesar sekitar ... dan sisanya masih harus ditanggung <PM> dan <TG>",
              "sampai sekarang <TG> yang membayar utang bersama itu sekitar ... sedangkan <PM> belum ikut membayar",
              "pembayaran utang bersama itu dipikul <TG> sebesar sekitar ... dan masih tersisa untuk dibagi dengan <PM>",
              "<TG> menanggung angsuran utang bersama itu sejak berpisah dengan nilai sekitar ... yang patut diperhitungkan"],
     sebagian=["utang bersama itu sebagian sudah dibayar <TG>", "<TG> yang membayar utang bersama itu"],
     berbeda=B("pelaku", "versi A: utang dilunasi Tergugat; versi B: utang dilunasi Penggugat - berselisih pada PELAKU",
               ["utang bersama itu dilunasi <TG> dari penghasilannya sendiri", "<TG> yang membayar utang bersama itu sampai sekarang"],
               ["utang bersama itu dilunasi <PM> dari penghasilannya sendiri", "<PM> yang membayar utang bersama itu sampai sekarang"]),
     bantahan=["utang-bersama"]),
   ["q-utang-pelunasan", "q-sanggah-utang"])

tg(Q("q-tg-kontribusi-tergugat", "pp-bantahan", 85, "tambahan", "pokok",
     "Apa saja sumbangan <TG> dalam mencari nafkah dan membiayai rumah tangga, dan bagaimana sumbangan <PM> dibanding <TG> menurut saksi ?",
     hal="sumbangan Tergugat dibanding Penggugat dalam rumah tangga", ringkas="sumbangan <TG> dalam nafkah dan biaya rumah tangga dibanding sumbangan <PM>",
     pihak=("T",),
     melihat=["<TG> yang menanggung sebagian besar nafkah dan biaya rumah tangga sedangkan sumbangan <PM> lebih kecil",
              "selama menikah penghasilan <TG> lebih banyak dipakai untuk kebutuhan keluarga dibanding penghasilan <PM>",
              "beban biaya rumah tangga lebih berat dipikul <TG> daripada <PM> sepanjang perkawinan mereka",
              "<TG> bekerja lebih keras dan menyumbang lebih besar bagi keluarga dibanding <PM>"],
     sebagian=["<TG> yang banyak menanggung nafkah keluarga", "sumbangan <TG> bagi rumah tangga lebih besar daripada <PM>"],
     berbeda=B("pelaku", "versi A: Tergugat lebih banyak menyumbang; versi B: Penggugat lebih banyak menyumbang - berselisih pada PELAKU",
               ["<TG> yang menanggung sebagian besar nafkah dan biaya rumah tangga", "sumbangan <TG> bagi rumah tangga lebih besar daripada <PM>"],
               ["<PM> yang menanggung sebagian besar nafkah dan biaya rumah tangga", "sumbangan <PM> bagi rumah tangga lebih besar daripada <TG>"]),
     bantahan=["bagian-tidak-sama"]),
   ["q-kontribusi-tak-seimbang", "q-urus-rumah-tangga", "q-pembagian-seperdua"])

tg(Q("q-tg-nilai-lebih-rendah", "pp-bantahan", 86, "tambahan", "pokok",
     "Berapa nilai objek itu menurut saksi dan mengapa nilainya tidak sebesar yang digugat, misalnya karena keadaan, umur, atau lokasinya ?",
     hal="nilai objek yang lebih rendah dari gugatan dan sebabnya", ringkas="nilai objek yang lebih rendah dari gugatan dan sebabnya",
     pihak=("T",),
     melihat=["nilai objek itu sekitar ... jauh di bawah yang digugat karena keadaannya sudah tua dan banyak kerusakan",
              "harga objek itu di pasaran hanya sekitar ... sebab lokasinya jauh dan harga setempat tidak setinggi yang digugat",
              "objek itu tidak bernilai setinggi gugatan karena umurnya sudah lama dan nilainya sekitar ...",
              "menurut harga yang saya ketahui objek itu hanya bernilai sekitar ... bukan sebesar yang tercantum dalam gugatan"],
     sebagian=["nilai objek itu lebih rendah dari yang digugat", "harga objek itu tidak setinggi gugatan"],
     berbeda=B("jumlah", "versi A: nilai objek di bawah gugatan; versi B: nilai objek sesuai gugatan - berselisih pada JUMLAH",
               ["nilai objek itu jauh di bawah yang disebut dalam gugatan", "harga objek itu lebih rendah daripada angka dalam gugatan"],
               ["nilai objek itu sesuai dengan yang disebut dalam gugatan", "harga objek itu sama dengan angka dalam gugatan"]),
     bantahan=["nilai-berbeda"]),
   ["q-nilai-total-harta", "q-taksiran-asal", "q-nilai-kondisi-objek"])

tg(Q("q-tg-penguasa-penggugat", "pp-bantahan", 87, "tambahan", "pokok",
     "Siapa sebenarnya yang menguasai objek itu sekarang, apakah <PM> yang menguasainya, dan apa yang saksi lihat ?",
     hal="penguasaan objek oleh Penggugat menurut Tergugat", ringkas="penguasaan objek oleh <PM> menurut <TG>",
     pihak=("T",),
     melihat=["objek itu sekarang dikuasai <PM> dan <TG> tidak lagi memegangnya sejak berpisah",
              "yang menempati dan memakai objek itu sehari-hari adalah <PM> bukan <TG>",
              "sejak berpisah objek itu berada di tangan <PM> yang menikmati hasilnya",
              "penguasaan objek itu ada pada <PM> sedangkan <TG> hanya sesekali datang"],
     sebagian=["objek itu dikuasai <PM> sejak berpisah", "objek itu dipakai <PM> sehari-hari"],
     berbeda=B("pelaku", "versi A: objek dikuasai Penggugat; versi B: objek dikuasai Tergugat - berselisih pada PELAKU",
               ["objek itu sekarang dikuasai <PM> dan <TG> tidak lagi memegangnya", "yang menempati dan memakai objek itu sehari-hari adalah <PM>"],
               ["objek itu sekarang dikuasai <TG> dan <PM> tidak lagi memegangnya", "yang menempati dan memakai objek itu sehari-hari adalah <TG>"]),
     bantahan=["penguasaan-dibantah"]),
   ["q-penguasa-lawan-menolak", "q-penguasaan"])

tg(Q("q-tg-pernah-ditawari-bagian", "pp-bantahan", 88, "tambahan", "pokok",
     "Apakah <TG> pernah menawarkan bagian kepada <PM>, kapan, bagaimana tawarannya, dan bagaimana tanggapan <PM> ?",
     hal="tawaran bagian dari Tergugat kepada Penggugat", ringkas="tawaran bagian dari <TG> kepada <PM> dan tanggapan <PM>",
     pihak=("T",),
     melihat=["<TG> pernah menawarkan bagian kepada <PM> pada ... berupa ... tetapi <PM> menolak tawaran itu",
              "pada ... <TG> mengajak <PM> membagi harta dengan cara ... namun <PM> tidak menerimanya",
              "tawaran pembagian dari <TG> kepada <PM> disampaikan di depan keluarga pada ... dan tidak disetujui <PM>",
              "<TG> sudah beberapa kali mengajukan usul pembagian kepada <PM> dan semuanya ditolak"],
     sebagian=["<TG> pernah menawarkan pembagian kepada <PM>", "<TG> pernah mengajak <PM> membagi harta"],
     berbeda=B("peristiwa", "versi A: Tergugat sudah menawarkan bagian dan ditolak Penggugat; versi B: Tergugat tidak pernah menawarkan bagian - berselisih pada PERISTIWA",
               ["<TG> pernah menawarkan bagian kepada <PM> tetapi <PM> menolaknya", "<TG> sudah mengajukan usul pembagian kepada <PM> dan ditolak"],
               ["<TG> tidak pernah menawarkan bagian apa pun kepada <PM>", "<TG> tidak pernah mengajukan usul pembagian kepada <PM>"]),
     bantahan=["pernah-ditawari-bagian"]),
   ["q-penguasaan-sejak-pisah", "q-kesepakatan-pembagian"])
selesai()

BANTAHAN_BARU = ["bawaan-hibah-warisan", "sebelum-menikah", "sudah-dijual-dijaminkan", "milik-pihak-ketiga", "sudah-dibagi", "sudah-dihibahkan", "utang-bersama", "pisah-harta",
                 "nilai-berbeda", "bagian-tidak-sama", "penguasaan-dibantah", "pernah-ditawari-bagian"]
LABEL_BARU = {
    "sudah-dibagi": "harta sudah dibagi", "sudah-dihibahkan": "objek sudah dihibahkan", "utang-bersama": "ada utang bersama yang harus diperhitungkan", "pisah-harta": "ada perjanjian perkawinan pisah harta",
    "nilai-berbeda": "nilai objek tidak sebesar gugatan", "bagian-tidak-sama": "bagian Penggugat tidak seperdua", "penguasaan-dibantah": "objek dikuasai Penggugat, bukan Tergugat",
    "pernah-ditawari-bagian": "Tergugat pernah menawarkan bagian",
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
        "Versi 2 (21 Okt 2026): bantahan tentang hibah atau warisan Tergugat, objek yang sudah dimiliki sebelum menikah, penghibahan, perjanjian pisah harta, pelunasan utang, perbedaan sumbangan, nilai objek, penguasaan dan tawaran bagian ditambahkan.",
    ]
    return kat


if __name__ == "__main__":
    v1 = json.load(open(sys.argv[1], encoding="utf8"))
    kat = bangun(v1)
    json.dump(kat, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("tergugat pertanyaan %d -> %d" % (len(v1["pertanyaan"]), len(kat["pertanyaan"])))
