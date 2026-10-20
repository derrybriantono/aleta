# -*- coding: utf-8 -*-
"""
Katalog TAMBAHAN arah Tergugat untuk wasiat, hibah, wakaf dan ekonomi syariah (agen W2a-K2, 21 Okt 2026), mengikuti pola
harta-bersama-tergugat.json dan kewarisan-tergugat.json (keputusan 56): butir `pihakSaksi: ["T"]` yang `menggantikan` butir utama
yang arahnya dalil pengaju dan hanya aktif bila petugas menandai bantahan Tergugat.
Pakai: python tergugat_k2.py  (menulis wasiat-tergugat.json, hibah-tergugat.json, wakaf-tergugat.json, ekonomi-syariah-tergugat.json)
"""
import copy, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import k2lib as L
from k2lib import Q, B, Daftar, bangun_q

DASAR_283 = {
    "id": "dh-rbg-283",
    "rujukan": "Pasal 283 RBg jo Pasal 1865 KUH Perdata",
    "uraian": "pihak yang mendalilkan suatu hak atau peristiwa wajib membuktikannya",
    "status": "terverifikasi",
    "sumber": "Pasal 283 RBg (S. 1927-227) Titel IV-V, berkas JDIH UNNES (jdih.unnes.ac.id/web/download/9da05dfa-3414-4a3d-974b-2c25c2261056) (memuat padanan KUHperd. 1865 dan IR. 163); Pasal 1865 KUHPerdata, berkas JDIH PN Bengkalis (jdihpn.pn-bengkalis.go.id, KOLONIAL_KUH_PERDATA.pdf). Bunyi pasal dicocokkan dengan naskah 18 Okt 2026 (VERIFIKASI-HIR-RBG.md). Asal kutipan: blangko Derry 4b Kewarisan [01] [Kabul] Kewarisan - Kontradiktur (pertimbangan hukum)",
}
CATATAN = [
    "Saksi yang diajukan Tergugat menerangkan versi Tergugat: tandai bantahan Tergugat pada keadaan perkara, lalu pilih Tergugat pada saksi yang bersangkutan.",
    "Butir arah Tergugat hanya muncul untuk saksi Tergugat dan menggantikan butir yang arahnya dalil Penggugat atas hal yang sama.",
]


class Paket:
    def __init__(self, kunci_utama, kunci, judul, jenis_id, peta, bantahan):
        self.kunci_utama, self.kunci, self.judul, self.jenis_id, self.peta = kunci_utama, kunci, judul, jenis_id, peta
        self.bantahan = bantahan  # {nilai: label}
        self.d = Daftar()
        self.menggantikan = {}

    def t(self, q, ganti, bantahan, gaya="campur"):
        assert bantahan in self.bantahan, bantahan
        q.gaya = gaya
        q.keadaan = {"bantahan": [bantahan]}
        q.pihak = ("T",)
        q.tingkat = "tambahan"
        self.d.tambah(q, gaya=gaya, bantahan=[bantahan])
        self.menggantikan[q.id] = list(ganti)
        return q

    def bangun(self):
        utama = json.load(open(os.path.join(L.KATALOG, self.kunci_utama + ".json"), encoding="utf8"))
        L.PETA_AKTIF.clear()
        L.PETA_AKTIF.update(self.peta)
        butir, galat = [], []
        for q in self.d.semua:
            try:
                L.periksa_inti(q)
                L.periksa_negasi(q)
                x = bangun_q(q, self.peta)
                x["menggantikan"] = self.menggantikan[q.id]
                butir.append(x)
            except (AssertionError, ValueError, KeyError) as e:
                galat.append("%s: %s" % (q.id, e))
        if galat:
            raise SystemExit("GALAT PEMBANGUNAN:" + chr(10) + chr(10).join(galat))
        ada = {p["id"] for p in utama["pertanyaan"]}
        for x in butir:
            for g in x["menggantikan"]:
                assert g in ada, (x["id"], g)
        urut = [x["urutan"] for x in butir]
        assert len(urut) == len(set(urut))
        kat = {
            "skema": "saksi-katalog/1", "kunci": self.kunci, "judul": self.judul, "versi": 1, "penulis": "W2A-K2", "tahap": 2, "contoh": False,
            "syarat": {"jenisPerkaraId": [self.jenis_id]},
            "tambahanUntuk": [self.kunci_utama], "urutanAwal": 1000,
            "pihak": {"pengaju": "#0046#", "lawan": "#0047#"},
            "blangkoBas": [],
            "dasarHukum": [copy.deepcopy(DASAR_283)],
            "keadaan": {"bantahan": {"sumber": "borang", "nilai": list(self.bantahan.keys()), "jamak": True, "bawaan": [], "label": "Bantahan Tergugat", "labelNilai": dict(self.bantahan)}},
            "pokokPembuktian": [{"id": "pp-bantahan", "judul": "Bantahan lawan", "uraian": "bantahan Tergugat atas dalil pengaju", "dasarHukum": ["dh-rbg-283"], "wajib": False,
                                 "keadaan": {"kehadiran": ["kontradiktoir", "t-tidak-hadir-setelah-mediasi"]}}],
            "pertanyaan": butir,
            "jawabanUmum": copy.deepcopy(utama["jawabanUmum"]),
            "catatanPetugas": list(CATATAN),
        }
        lama = L.kamus_lama()
        kat["variabelBaru"] = sorted(L.kode_dipakai(kat) - lama)
        return kat


def semua():
    paket = []

    # ======================================================================= WASIAT
    p = Paket("wasiat", "wasiat-tergugat", "Wasiat - keterangan saksi yang diajukan Tergugat", "365",
              {"_g": "x", "PWS": "#2026# #1025#", "PM": "#0046#", "LW": "#0047#", "OBJ": "#9479#", "BTK": "#9478#", "TRM": "#9481#"},
              {"tanpa-tekanan": "pewasiat membuat wasiat tanpa tekanan", "pewasiat-sehat": "pewasiat sehat badan dan akalnya", "ahli-waris-setuju": "ahli waris menyetujui wasiat",
               "tidak-dicabut": "wasiat tidak pernah dicabut", "penerima-sah": "penerima wasiat tidak berbuat jahat atau merawat pewasiat", "benda-masih-ada": "benda wasiat masih ada",
               "penguasaan-sah": "penguasaan benda wasiat berdasarkan wasiat"})
    p.t(Q("q-tg-ws-tanpa-tekanan", "pp-bantahan", 10, "tambahan", "pokok",
          "Apakah <PWS> membuat wasiat itu atas kemauannya sendiri, dan adakah orang yang menekan atau memaksanya ?",
          hal="ada tidaknya tekanan terhadap pewasiat", ringkas="kemauan <PWS> membuat wasiat atas <OBJ> untuk <TRM> tanpa tekanan",
          teks_varian=["Apakah ada orang yang menekan atau memaksa <PWS> ketika ia membuat wasiat itu ?"],
          melihat=["<PWS> membuat wasiat atas <OBJ> untuk <TRM> dengan kemauannya sendiri dan tidak ada orang yang menekannya",
                   "wasiat atas <OBJ> untuk <TRM> lahir dari kehendak <PWS> sendiri tanpa tekanan siapa pun",
                   "tidak ada paksaan kepada <PWS> ketika ia menyatakan wasiat atas <OBJ> untuk <TRM>",
                   "<PWS> berwasiat atas <OBJ> kepada <TRM> dengan sukarela dan tanpa desakan dari pihak mana pun"],
          berbeda=B("peristiwa", "versi A: wasiat dibuat tanpa tekanan; versi B: pewasiat didesak orang lain - berselisih pada PERISTIWA",
                    ["<PWS> membuat wasiat atas <OBJ> untuk <TRM> tanpa tekanan siapa pun", "wasiat atas <OBJ> untuk <TRM> lahir dari kehendak <PWS> sendiri tanpa paksaan"],
                    ["<PWS> membuat wasiat atas <OBJ> untuk <TRM> karena didesak orang lain", "wasiat atas <OBJ> untuk <TRM> lahir dari desakan orang lain kepada <PWS>"])),
        ["q-ws-ada-tekanan"], "tanpa-tekanan", "tahu")
    p.t(Q("q-tg-ws-sehat", "pp-bantahan", 20, "tambahan", "pokok",
          "Bagaimana kesehatan badan dan akal <PWS> ketika membuat wasiat itu, apakah ia sehat dan mengerti isi wasiatnya ?",
          hal="kesehatan badan dan akal pewasiat ketika berwasiat", ringkas="kesehatan badan dan akal <PWS> ketika membuat wasiat atas <OBJ>",
          teks_varian=["Apakah <PWS> sehat badan dan pikirannya ketika membuat wasiat itu dan mengerti apa yang diwasiatkannya ?"],
          melihat=["<PWS> sehat badan dan akalnya ketika membuat wasiat atas <OBJ> dan mengerti isinya",
                   "ketika berwasiat atas <OBJ> <PWS> segar dan berpikir jernih serta dapat menjelaskan maksudnya",
                   "<PWS> masih beraktivitas seperti biasa dan sadar penuh ketika membuat wasiat atas <OBJ>",
                   "pada saat wasiat atas <OBJ> dibuat <PWS> bugar dan bicaranya runtut"],
          berbeda=B("peristiwa", "versi A: pewasiat sehat akalnya; versi B: pewasiat sakit keras dan tidak sadar - berselisih pada PERISTIWA",
                    ["<PWS> sehat akalnya ketika membuat wasiat atas <OBJ>", "ketika berwasiat atas <OBJ> <PWS> berpikir jernih"],
                    ["<PWS> sakit keras dan tidak sadar ketika membuat wasiat atas <OBJ>", "ketika berwasiat atas <OBJ> <PWS> tidak sadar karena sakit parah"])),
        ["q-ws-akal-dipersoalkan", "q-ws-sakit-wafat"], "pewasiat-sehat", "tahu")
    p.t(Q("q-tg-ws-persetujuan", "pp-bantahan", 30, "tambahan", "pokok",
          "Apakah ahli waris <PWS> mengetahui wasiat atas benda itu dan menyatakan menyetujuinya, kapan, dan di depan siapa ?",
          hal="persetujuan ahli waris atas wasiat", ringkas="persetujuan ahli waris <PWS> atas wasiat <OBJ>",
          teks_varian=["Siapa saja ahli waris <PWS> yang menyetujui wasiat itu, kapan, dan di depan siapa mereka menyatakannya ?"],
          melihat=["seluruh ahli waris <PWS> mengetahui wasiat atas <OBJ> dan menyatakan setuju di depan dua orang saksi",
                   "ahli waris <PWS> menyetujui wasiat atas <OBJ> dengan pernyataan yang diucapkan di hadapan dua orang saksi",
                   "persetujuan ahli waris <PWS> atas wasiat <OBJ> diberikan secara lisan di depan dua orang saksi",
                   "semua ahli waris <PWS> sudah mengetahui wasiat atas <OBJ> dan menyatakan setuju"],
          berbeda=B("jumlah", "versi A: semua ahli waris menyetujui wasiat; versi B: ada ahli waris yang tidak menyetujui - berselisih pada JUMLAH",
                    ["semua ahli waris <PWS> setuju atas wasiat <OBJ>", "seluruh ahli waris <PWS> menyetujui wasiat <OBJ>"],
                    ["ada ahli waris <PWS> yang tidak setuju atas wasiat <OBJ>", "tidak semua ahli waris <PWS> menyetujui wasiat <OBJ>"])),
        ["q-ws-setuju-tolak", "q-ws-setuju-belum"], "ahli-waris-setuju", "lihat")
    p.t(Q("q-tg-ws-tidak-dicabut", "pp-bantahan", 40, "tambahan", "pokok",
          "Apakah sampai meninggal dunia <PWS> tidak pernah mencabut atau mengubah wasiatnya, dan bagaimana saksi mengetahuinya ?",
          hal="tidak dicabutnya wasiat sampai pewasiat meninggal", ringkas="tidak dicabutnya wasiat atas <OBJ> oleh <PWS> sampai ia meninggal dunia",
          teks_varian=["Apakah <PWS> tetap berpegang pada wasiatnya sampai wafat tanpa pernah mencabutnya ?"],
          melihat=["<PWS> tidak pernah mencabut wasiat atas <OBJ> sampai ia meninggal dunia",
                   "wasiat atas <OBJ> tetap berlaku karena <PWS> tidak pernah membatalkannya",
                   "sampai wafat <PWS> tidak mengubah wasiat atas <OBJ> yang dibuatnya",
                   "<PWS> terus berpegang pada wasiat atas <OBJ> dan tidak pernah menariknya kembali"],
          berbeda=B("peristiwa", "versi A: wasiat tidak pernah dicabut; versi B: wasiat pernah dicabut - berselisih pada PERISTIWA",
                    ["<PWS> tidak pernah mencabut wasiat atas <OBJ>", "<PWS> tidak pernah membatalkan wasiat atas <OBJ>"],
                    ["<PWS> pernah mencabut wasiat atas <OBJ>", "<PWS> pernah membatalkan wasiat atas <OBJ>"])),
        ["q-ws-cabut-ada"], "tidak-dicabut", "tahu")
    p.t(Q("q-tg-ws-penerima-sah", "pp-bantahan", 50, "tambahan", "pokok",
          "Apakah <TRM> pernah merawat <PWS> ketika sakit atau berbuat jahat kepadanya, dan bagaimana hubungan keduanya ?",
          hal="hubungan penerima wasiat dengan pewasiat", ringkas="hubungan <TRM> dengan <PWS> dan ada tidaknya perbuatan jahat",
          teks_varian=["Bagaimana hubungan <TRM> dengan <PWS>, apakah ia merawatnya ketika sakit atau pernah berbuat jahat kepadanya ?"],
          melihat=["<TRM> tidak pernah menganiaya atau menghalangi <PWS> dan hubungan keduanya baik sampai akhir hayat",
                   "hubungan <TRM> dengan <PWS> baik dan tidak pernah ada fitnah atau ancaman di antara mereka",
                   "<TRM> tidak termasuk orang yang merawat <PWS> ketika sakit karena perawatannya diurus keluarga",
                   "<TRM> tidak pernah berbuat jahat kepada <PWS> dan hanya menjenguknya ketika sakit"],
          berbeda=B("peristiwa", "versi A: penerima tidak pernah berbuat jahat kepada pewasiat; versi B: penerima pernah berbuat jahat - berselisih pada PERISTIWA",
                    ["<TRM> tidak pernah berbuat jahat kepada <PWS>", "hubungan <TRM> dengan <PWS> tidak pernah diwarnai perbuatan jahat"],
                    ["<TRM> pernah berbuat jahat kepada <PWS>", "hubungan <TRM> dengan <PWS> pernah diwarnai perbuatan jahat"])),
        ["q-ws-penerima-perawat", "q-ws-penerima-jahat"], "penerima-sah", "lihat")
    p.t(Q("q-tg-ws-objek-ada", "pp-bantahan", 60, "tambahan", "pokok",
          "Apakah <OBJ> yang diwasiatkan <PWS> itu masih ada dan masih utuh, dan siapa yang menguasainya sekarang ?",
          hal="masih adanya benda wasiat sampai pewasiat meninggal", ringkas="keberadaan <OBJ> milik <PWS> sampai ia meninggal dunia",
          teks_varian=["Sampai <PWS> meninggal dunia apakah <OBJ> masih ada dan masih utuh ?"],
          melihat=["<OBJ> masih ada dan utuh sampai <PWS> meninggal dunia",
                   "sampai <PWS> wafat <OBJ> masih berada di tempatnya semula",
                   "ketika <PWS> meninggal dunia <OBJ> masih lengkap dan dapat diserahkan",
                   "<OBJ> milik <PWS> tetap utuh dan terpelihara sampai ia meninggal dunia"],
          berbeda=B("peristiwa", "versi A: benda wasiat masih ada; versi B: benda wasiat sudah musnah - berselisih pada PERISTIWA",
                    ["<OBJ> masih ada sampai <PWS> meninggal dunia", "sampai <PWS> wafat <OBJ> masih utuh"],
                    ["<OBJ> sudah musnah sebelum <PWS> meninggal dunia", "sebelum <PWS> wafat <OBJ> sudah hilang"])),
        ["q-ws-objek-musnah"], "benda-masih-ada", "tahu")
    p.t(Q("q-tg-ws-penguasaan-sah", "pp-bantahan", 70, "tambahan", "pokok",
          "Atas dasar apa <LW> menguasai benda wasiat dari <PWS> itu, dan apakah ia pernah menjual atau mengalihkannya ?",
          hal="dasar penguasaan benda wasiat dan ada tidaknya pengalihan", ringkas="dasar penguasaan <OBJ> oleh <LW> berdasarkan wasiat <PWS>",
          teks_varian=["Apakah <LW> menguasai benda wasiat dari <PWS> itu karena wasiat, dan apakah benda itu pernah dijual olehnya ?"],
          melihat=["<LW> menguasai <OBJ> berdasarkan wasiat <PWS> dan tidak pernah menjual atau mengalihkannya",
                   "<OBJ> dari wasiat <PWS> dirawat <LW> dan tidak pernah dipindahtangankan",
                   "sejak <PWS> meninggal dunia <LW> memelihara <OBJ> sebagaimana wasiat dan tidak menjualnya",
                   "<LW> mengelola <OBJ> menurut wasiat <PWS> dan tidak mengalihkannya kepada siapa pun"],
          berbeda=B("peristiwa", "versi A: benda wasiat tidak pernah dijual; versi B: benda wasiat pernah dijual - berselisih pada PERISTIWA",
                    ["<LW> tidak pernah menjual <OBJ> dari wasiat <PWS>", "<OBJ> dari wasiat <PWS> tidak pernah dijual <LW>"],
                    ["<LW> pernah menjual <OBJ> dari wasiat <PWS>", "<OBJ> dari wasiat <PWS> pernah dijual <LW>"])),
        ["q-ws-hasil-dikuasai", "q-ws-dialihkan"], "penguasaan-sah", "lihat")
    paket.append(p)

    # ======================================================================= HIBAH
    p = Paket("hibah", "hibah-tergugat", "Hibah - keterangan saksi yang diajukan Tergugat", "366",
              {"_g": "x", "PH": "#9793#", "PM": "#0046#", "LW": "#0047#", "OBJ": "#9795#", "BTK": "#9794#", "TRM": "#9797#"},
              {"penghibah-sukarela": "penghibah memberikan hibah tanpa paksaan", "penghibah-sehat": "penghibah sehat badan dan akalnya", "sudah-diserahkan": "benda hibah sudah diserahkan kepada penerima",
               "ahli-waris-setuju": "ahli waris menyetujui hibah", "tidak-ada-alasan-tarik": "penerima hibah merawat penghibah dan tidak menjual benda hibah", "objek-milik-penghibah": "benda hibah milik penghibah sendiri",
               "benar-hibah": "pemberian itu benar hibah", "ada-saksi": "hibah disaksikan dua orang saksi"})
    p.t(Q("q-tg-hb-tanpa-paksaan", "pp-bantahan", 10, "tambahan", "pokok",
          "Apakah <PH> memberikan hibah itu atas kemauannya sendiri, dan adakah orang yang menekan atau memaksanya ?",
          hal="ada tidaknya tekanan terhadap penghibah", ringkas="kemauan <PH> memberikan hibah atas <OBJ> kepada <TRM> tanpa tekanan",
          teks_varian=["Apakah ada orang yang menekan atau memaksa <PH> ketika ia memberikan hibah itu ?"],
          melihat=["<PH> menghibahkan <OBJ> kepada <TRM> dengan kemauannya sendiri dan tidak ada orang yang menekannya",
                   "hibah atas <OBJ> untuk <TRM> lahir dari kehendak <PH> sendiri tanpa tekanan siapa pun",
                   "tidak ada paksaan kepada <PH> ketika ia menyatakan hibah atas <OBJ> untuk <TRM>",
                   "<PH> menghibahkan <OBJ> kepada <TRM> dengan sukarela dan tanpa desakan dari pihak mana pun"],
          berbeda=B("peristiwa", "versi A: hibah diberikan tanpa tekanan; versi B: penghibah didesak orang lain - berselisih pada PERISTIWA",
                    ["<PH> menghibahkan <OBJ> kepada <TRM> tanpa tekanan siapa pun", "hibah atas <OBJ> untuk <TRM> lahir dari kehendak <PH> sendiri tanpa paksaan"],
                    ["<PH> menghibahkan <OBJ> kepada <TRM> karena didesak orang lain", "hibah atas <OBJ> untuk <TRM> lahir dari desakan orang lain kepada <PH>"])),
        ["q-hb-ada-paksaan"], "penghibah-sukarela", "tahu")
    p.t(Q("q-tg-hb-sehat", "pp-bantahan", 20, "tambahan", "pokok",
          "Bagaimana kesehatan badan dan akal <PH> ketika memberikan hibah itu, apakah ia sehat dan mengerti maksud hibahnya ?",
          hal="kesehatan badan dan akal penghibah ketika menghibahkan", ringkas="kesehatan badan dan akal <PH> ketika menghibahkan <OBJ>",
          teks_varian=["Apakah <PH> sehat badan dan pikirannya ketika memberikan hibah itu dan mengerti apa yang dihibahkannya ?"],
          melihat=["<PH> sehat badan dan akalnya ketika menghibahkan <OBJ> dan mengerti maksudnya",
                   "ketika menghibahkan <OBJ> <PH> segar dan berpikir jernih serta dapat menjelaskan maksudnya",
                   "<PH> masih beraktivitas seperti biasa dan sadar penuh ketika menghibahkan <OBJ>",
                   "pada saat <OBJ> dihibahkan <PH> bugar dan bicaranya runtut"],
          berbeda=B("peristiwa", "versi A: penghibah sehat akalnya; versi B: penghibah sakit keras dan tidak sadar - berselisih pada PERISTIWA",
                    ["<PH> sehat akalnya ketika menghibahkan <OBJ>", "ketika menghibahkan <OBJ> <PH> berpikir jernih"],
                    ["<PH> sakit keras dan tidak sadar ketika menghibahkan <OBJ>", "ketika menghibahkan <OBJ> <PH> tidak sadar karena sakit parah"])),
        ["q-hb-akal-dipersoalkan", "q-hb-sakit"], "penghibah-sehat", "tahu")
    p.t(Q("q-tg-hb-sudah-diserahkan", "pp-bantahan", 30, "tambahan", "pokok",
          "Apakah benda yang dihibahkan <PH> itu sudah diserahkan kepada penerima hibah, kapan, dan siapa yang memakainya sejak itu ?",
          hal="penyerahan benda hibah kepada penerima", ringkas="penyerahan <OBJ> dari <PH> kepada <TRM> dan pemakaiannya sejak itu",
          teks_varian=["Sejak kapan penerima hibah menguasai dan memakai benda yang dihibahkan <PH> itu ?"],
          melihat=["<OBJ> sudah diserahkan <PH> kepada <TRM> pada hari hibah dan sejak itu dipakai sendiri oleh penerima",
                   "sejak hibah <PH> menyerahkan <OBJ> kepada <TRM> yang langsung menguasai dan memakainya",
                   "setelah hibah <OBJ> berada dalam kekuasaan <TRM> dan <PH> sudah melepaskan penguasaannya",
                   "<TRM> menerima <OBJ> dari <PH> pada hari hibah dan mengelolanya sampai sekarang"],
          berbeda=B("peristiwa", "versi A: benda hibah sudah diserahkan; versi B: benda hibah belum diserahkan - berselisih pada PERISTIWA",
                    ["<OBJ> sudah diserahkan <PH> kepada <TRM> sejak hibah", "<TRM> menguasai <OBJ> dari <PH> sejak hibah"],
                    ["<OBJ> belum diserahkan <PH> kepada <TRM> sejak hibah", "<TRM> belum menguasai <OBJ> dari <PH> sejak hibah"])),
        ["q-hb-dikuasai-penghibah"], "sudah-diserahkan", "lihat")
    p.t(Q("q-tg-hb-setuju", "pp-bantahan", 40, "tambahan", "pokok",
          "Apakah ahli waris <PH> mengetahui hibah atas benda itu dan menyatakan menyetujuinya, kapan, dan di depan siapa ?",
          hal="persetujuan ahli waris atas hibah", ringkas="persetujuan ahli waris <PH> atas hibah <OBJ>",
          teks_varian=["Siapa saja ahli waris <PH> yang menyetujui hibah itu, kapan, dan di depan siapa mereka menyatakannya ?"],
          melihat=["seluruh ahli waris <PH> mengetahui hibah atas <OBJ> dan menyatakan setuju di depan dua orang saksi",
                   "ahli waris <PH> menyetujui hibah atas <OBJ> dengan pernyataan yang diucapkan di hadapan dua orang saksi",
                   "persetujuan ahli waris <PH> atas hibah <OBJ> diberikan secara lisan di depan dua orang saksi",
                   "semua ahli waris <PH> sudah mengetahui hibah atas <OBJ> dan menyatakan setuju"],
          berbeda=B("jumlah", "versi A: semua ahli waris menyetujui hibah; versi B: ada ahli waris yang tidak menyetujui - berselisih pada JUMLAH",
                    ["semua ahli waris <PH> setuju atas hibah <OBJ>", "seluruh ahli waris <PH> menyetujui hibah <OBJ>"],
                    ["ada ahli waris <PH> yang tidak setuju atas hibah <OBJ>", "tidak semua ahli waris <PH> menyetujui hibah <OBJ>"])),
        ["q-hb-setuju-tolak"], "ahli-waris-setuju", "lihat")
    p.t(Q("q-tg-hb-tidak-ada-alasan-tarik", "pp-bantahan", 50, "tambahan", "pokok",
          "Bagaimana sikap <TRM> kepada <PH> setelah menerima hibah, apakah ia merawatnya, dan apakah benda hibah pernah dijual atau dipakai tidak sesuai maksud hibah ?",
          hal="sikap penerima hibah kepada penghibah dan pemakaian benda hibah", ringkas="sikap <TRM> kepada <PH> dan pemakaian <OBJ> setelah hibah",
          teks_varian=["Setelah menerima hibah apakah <TRM> tetap merawat <PH> dan tidak menjual benda hibah ?"],
          melihat=["<TRM> tetap merawat <PH> setelah menerima <OBJ> dan tidak pernah menjual benda itu",
                   "<TRM> memelihara <PH> dengan baik dan memakai <OBJ> sesuai maksud hibah tanpa menjualnya",
                   "sesudah menerima <OBJ> <TRM> terus mengurus <PH> dan tidak mengalihkan benda itu",
                   "<TRM> menjaga <OBJ> dan merawat <PH> dengan baik tanpa pernah mengalihkan benda itu"],
          berbeda=B("peristiwa", "versi A: penerima hibah merawat penghibah dan tidak menjual benda; versi B: penerima hibah menelantarkan penghibah dan menjual benda - berselisih pada PERISTIWA",
                    ["<TRM> merawat <PH> dan tidak menjual <OBJ>", "<TRM> memelihara <PH> dan tidak mengalihkan <OBJ>"],
                    ["<TRM> menelantarkan <PH> dan menjual <OBJ>", "<TRM> mengabaikan <PH> dan mengalihkan <OBJ>"])),
        ["q-tarik-hibah", "q-hb-tarik-menelantarkan", "q-hb-tarik-jual", "q-hb-tarik-tujuan"], "tidak-ada-alasan-tarik", "lihat")
    p.t(Q("q-tg-hb-objek-milik", "pp-bantahan", 60, "tambahan", "pokok",
          "Apakah <OBJ> yang dihibahkan <PH> itu memang milik <PH> sendiri, dari mana ia memperolehnya, dan apa buktinya ?",
          hal="kepemilikan penghibah atas benda hibah", ringkas="kepemilikan <PH> atas <OBJ> yang dihibahkannya",
          teks_varian=["Dari mana <PH> memperoleh <OBJ> yang dihibahkannya, dan apakah <PH> pemilik sahnya ?"],
          melihat=["<OBJ> adalah milik <PH> sendiri yang diperolehnya dengan usahanya sebelum menghibahkan",
                   "<PH> memperoleh <OBJ> dari hasil usahanya sendiri dan menguasainya sebagai pemilik",
                   "sebelum dihibahkan <OBJ> tercatat atas nama <PH> sebagai pemilik sahnya",
                   "<OBJ> sepenuhnya hak <PH> karena diperoleh dari warisan dan pembeliannya sendiri"],
          berbeda=B("peristiwa", "versi A: benda hibah milik penghibah sendiri; versi B: benda hibah bukan milik penghibah sendiri - berselisih pada PERISTIWA",
                    ["<OBJ> adalah milik <PH> sendiri", "<OBJ> sepenuhnya hak <PH>"],
                    ["<OBJ> bukan milik <PH> sendiri", "<OBJ> bukan hak penuh <PH>"])),
        ["q-hb-objek-bukan-hak"], "objek-milik-penghibah", "tahu")
    p.t(Q("q-tg-hb-benar-hibah", "pp-bantahan", 70, "tambahan", "pokok",
          "Apakah pemberian <OBJ> dari <PH> kepada <TRM> itu benar-benar hibah, tanpa bayaran atau kewajiban mengembalikan ?",
          hal="sifat pemberian sebagai hibah", ringkas="sifat pemberian <OBJ> dari <PH> kepada <TRM> sebagai hibah",
          teks_varian=["Apakah <PH> memberikan <OBJ> kepada <TRM> sebagai hibah yang tidak dibayar dan tidak harus dikembalikan ?"],
          melihat=["<PH> memberikan <OBJ> kepada <TRM> sebagai hibah yang tidak perlu dikembalikan",
                   "pemberian <OBJ> dari <PH> kepada <TRM> adalah hibah tanpa bayaran",
                   "<TRM> menerima <OBJ> dari <PH> sebagai hibah dan tidak pernah diminta membayar",
                   "<PH> menyatakan <OBJ> untuk <TRM> sebagai hibah dan tidak sebagai pinjaman"],
          berbeda=B("peristiwa", "versi A: pemberian itu hibah; versi B: pemberian itu titipan - berselisih pada PERISTIWA",
                    ["<OBJ> dari <PH> diberikan kepada <TRM> sebagai hibah", "pemberian <OBJ> dari <PH> kepada <TRM> adalah hibah"],
                    ["<OBJ> dari <PH> dititipkan kepada <TRM> sebagai titipan", "pemberian <OBJ> dari <PH> kepada <TRM> adalah titipan"])),
        ["q-hb-pura-pura"], "benar-hibah", "campur")
    p.t(Q("q-tg-hb-ada-saksi", "pp-bantahan", 80, "tambahan", "pokok",
          "Siapa saja yang hadir dan menyaksikan <PH> memberikan hibah itu, dan apakah mereka dua orang ?",
          hal="saksi yang menyaksikan pemberian hibah", ringkas="dua orang saksi yang menyaksikan <PH> memberikan hibah",
          teks_varian=["Apakah hibah dari <PH> disaksikan dua orang dan siapa saja mereka ?"],
          melihat=["hibah <PH> disaksikan dua orang saksi yang hadir bersamaan",
                   "ketika <PH> menghibahkan hartanya dua orang saksi hadir dan menyaksikannya",
                   "dua orang saksi menyaksikan <PH> memberikan hibahnya",
                   "<PH> memberikan hibah di depan dua orang saksi yang dikenal keluarga"],
          berbeda=B("jumlah", "versi A: hibah disaksikan dua orang saksi; versi B: hibah tidak disaksikan siapa pun - berselisih pada JUMLAH (saksi)",
                    ["hibah <PH> disaksikan dua orang saksi", "dua orang saksi menyaksikan hibah <PH>"],
                    ["hibah <PH> tidak disaksikan siapa pun", "tidak ada saksi yang menyaksikan hibah <PH>"])),
        ["q-hb-tanpa-saksi"], "ada-saksi", "lihat")
    paket.append(p)

    # ======================================================================= WAKAF
    p = Paket("wakaf", "wakaf-tergugat", "Wakaf - keterangan saksi yang diajukan Tergugat", "367",
              {"_g": "x", "WK": "#9823#", "NZ": "#9824#", "HB": "#9826#", "PR": "#9827#", "IK": "#9825#", "PM": "#0046#", "LW": "#0047#", "KS": "#9841#"},
              {"ikrar-sah": "ikrar dituangkan dalam akta ikrar wakaf", "ada-saksi-ikrar": "ikrar disaksikan dua orang saksi", "harta-milik-wakif": "harta wakaf milik wakif sendiri",
               "nazhir-amanah": "nazhir terdaftar dan mengurus wakaf dengan baik", "peruntukan-sesuai": "harta wakaf dipakai sesuai peruntukan", "tidak-dialihkan": "harta wakaf tidak pernah dialihkan",
               "ahli-waris-setuju-wakaf": "ahli waris wakif tidak keberatan atas wakaf"})
    p.t(Q("q-tg-wk-ikrar-akta", "pp-bantahan", 10, "tambahan", "pokok",
          "Apakah ikrar wakaf <WK> dituangkan dalam akta ikrar wakaf bernomor di hadapan pejabat yang berwenang ?",
          hal="akta ikrar wakaf dan pejabat pembuatnya", ringkas="akta ikrar wakaf atas ikrar <WK> dan pejabat pembuatnya",
          teks_varian=["Apakah ada akta ikrar wakaf bernomor atas ikrar <WK>, dan siapa pejabat yang membuatnya ?"],
          melihat=["ikrar wakaf <WK> dituangkan dalam akta ikrar wakaf bernomor sebagaimana tertera dalam <IK>",
                   "akta ikrar wakaf atas ikrar <WK> dibuat pejabat berwenang sesuai <IK>",
                   "<WK> berikrar di hadapan pejabat pembuat akta ikrar wakaf dan hasilnya dituangkan dalam akta sesuai <IK>",
                   "ikrar <WK> tercatat dalam akta ikrar wakaf bernomor sesuai <IK>"],
          berbeda=B("peristiwa", "versi A: ikrar dituangkan dalam akta ikrar wakaf; versi B: ikrar tidak dituangkan dalam akta - berselisih pada PERISTIWA",
                    ["ikrar wakaf <WK> dituangkan dalam akta ikrar wakaf sesuai <IK>", "ikrar <WK> tercatat dalam akta ikrar wakaf sesuai <IK>"],
                    ["ikrar wakaf <WK> tidak dituangkan dalam akta ikrar wakaf sesuai <IK>", "ikrar <WK> tidak tercatat dalam akta ikrar wakaf sesuai <IK>"])),
        ["q-wk-tanpa-akta"], "ikrar-sah", "tahu")
    p.t(Q("q-tg-wk-saksi-ada", "pp-bantahan", 20, "tambahan", "pokok",
          "Siapa saja yang hadir dan menyaksikan <WK> berikrar, dan apakah mereka dua orang ?",
          hal="saksi yang menyaksikan ikrar wakaf", ringkas="dua orang saksi yang menyaksikan <WK> berikrar",
          teks_varian=["Apakah ikrar <WK> disaksikan dua orang dan siapa saja mereka ?"],
          melihat=["ikrar wakaf <WK> disaksikan dua orang saksi yang hadir bersamaan",
                   "ketika <WK> berikrar dua orang saksi hadir dan menyaksikannya",
                   "dua orang saksi menyaksikan <WK> mengucapkan ikrar wakafnya",
                   "<WK> berikrar di depan dua orang saksi yang dikenal warga"],
          berbeda=B("jumlah", "versi A: ikrar disaksikan dua orang saksi; versi B: ikrar tidak disaksikan siapa pun - berselisih pada JUMLAH (saksi)",
                    ["ikrar wakaf <WK> disaksikan dua orang saksi", "dua orang saksi menyaksikan ikrar wakaf <WK>"],
                    ["ikrar wakaf <WK> tidak disaksikan siapa pun", "tidak ada saksi yang menyaksikan ikrar wakaf <WK>"])),
        ["q-wk-tanpa-saksi"], "ada-saksi-ikrar", "lihat")
    p.t(Q("q-tg-wk-milik-wakif", "pp-bantahan", 30, "tambahan", "pokok",
          "Apakah <HB> yang diwakafkan <WK> itu memang milik <WK> sendiri, dari mana ia memperolehnya, dan apa buktinya ?",
          hal="kepemilikan wakif atas harta wakaf", ringkas="kepemilikan <WK> atas <HB> yang diwakafkannya",
          teks_varian=["Dari mana <WK> memperoleh <HB> yang diwakafkannya, dan apakah <WK> pemilik sahnya ?"],
          melihat=["<HB> adalah milik <WK> sendiri yang diperolehnya dengan usahanya sebelum mewakafkan",
                   "<WK> memperoleh <HB> dari hasil usahanya sendiri dan menguasainya sebagai pemilik",
                   "sebelum diwakafkan <HB> tercatat atas nama <WK> sebagai pemilik sahnya",
                   "<HB> sepenuhnya hak <WK> karena diperoleh dari warisan dan pembeliannya sendiri"],
          berbeda=B("peristiwa", "versi A: harta wakaf milik wakif sendiri; versi B: harta wakaf bukan milik wakif sendiri - berselisih pada PERISTIWA",
                    ["<HB> adalah milik <WK> sendiri", "<HB> sepenuhnya hak <WK>"],
                    ["<HB> bukan milik <WK> sendiri", "<HB> bukan hak penuh <WK>"])),
        ["q-wk-bukan-milik"], "harta-milik-wakif", "tahu")
    p.t(Q("q-tg-wk-nazhir-baik", "pp-bantahan", 40, "tambahan", "pokok",
          "Bagaimana <NZ> mengurus harta wakaf, apakah ia terdaftar sebagai nazhir dan menyalurkan hasilnya sesuai peruntukan ?",
          hal="pengurusan harta wakaf oleh nazhir", ringkas="pengurusan <HB> oleh <NZ> untuk <PR>",
          teks_varian=["Apakah <NZ> terdaftar sebagai nazhir dan mengurus harta wakaf dengan amanah ?"],
          melihat=["<NZ> terdaftar sebagai nazhir dan mengurus <HB> dengan baik sesuai peruntukan <PR>",
                   "hasil <HB> disalurkan <NZ> untuk <PR> dan dilaporkan secara terbuka",
                   "<NZ> menjalankan tugas sebagai nazhir atas <HB> untuk <PR> dengan amanah",
                   "pengurusan <HB> oleh <NZ> berjalan tertib dan sesuai <PR>"],
          berbeda=B("peristiwa", "versi A: nazhir mengurus harta wakaf dengan baik; versi B: nazhir tidak mengurus harta wakaf dengan baik - berselisih pada PERISTIWA",
                    ["<NZ> mengurus <HB> dengan baik untuk <PR>", "pengurusan <HB> oleh <NZ> baik untuk <PR>"],
                    ["<NZ> tidak mengurus <HB> dengan baik untuk <PR>", "pengurusan <HB> oleh <NZ> tidak baik untuk <PR>"])),
        ["q-wk-nazhir-lalai", "q-wk-nazhir-terdaftar"], "nazhir-amanah", "lihat")
    p.t(Q("q-tg-wk-peruntukan-sesuai", "pp-bantahan", 50, "tambahan", "pokok",
          "Apakah sejak diwakafkan harta wakaf itu dipakai tetap sesuai peruntukannya, dan pernahkah peruntukannya diubah ?",
          hal="kesesuaian pemakaian harta wakaf dengan peruntukannya", ringkas="kesesuaian pemakaian <HB> dengan peruntukan <PR>",
          teks_varian=["Apakah peruntukan harta wakaf itu pernah diubah sejak diikrarkan sampai sekarang ?"],
          melihat=["<HB> dipakai tetap untuk <PR> dan tidak pernah diubah peruntukannya",
                   "peruntukan <HB> untuk <PR> tidak berubah sejak ikrar sampai sekarang",
                   "sejak ikrar <HB> hanya dipakai untuk <PR> tanpa perubahan",
                   "<HB> terus dipakai untuk <PR> dan tidak dialihkan ke kegiatan lain"],
          berbeda=B("peristiwa", "versi A: peruntukan harta wakaf tidak berubah; versi B: peruntukan harta wakaf sudah berubah - berselisih pada PERISTIWA",
                    ["peruntukan <HB> untuk <PR> tidak berubah", "<HB> tidak dipakai untuk kegiatan selain <PR>"],
                    ["peruntukan <HB> untuk <PR> sudah berubah", "<HB> sudah dipakai untuk kegiatan selain <PR>"])),
        ["q-wk-peruntukan-berubah", "q-wk-peruntukan-ahliwaris"], "peruntukan-sesuai", "lihat")
    p.t(Q("q-tg-wk-tidak-dialihkan", "pp-bantahan", 60, "tambahan", "pokok",
          "Apakah <HB> itu pernah dijual, dihibahkan, dijaminkan atau diganti rugi sejak diwakafkan, dan bagaimana saksi mengetahuinya ?",
          hal="tidak dialihkannya harta wakaf", ringkas="tidak dijual atau dialihkannya <HB> sejak diwakafkan",
          teks_varian=["Apakah sejak diwakafkan <HB> masih utuh sebagai harta wakaf dan tidak berpindah tangan ?"],
          melihat=["<HB> tidak pernah dijual, dihibahkan atau dijaminkan oleh siapa pun sejak diwakafkan",
                   "sampai sekarang <HB> tidak berpindah tangan dan masih menjadi harta wakaf",
                   "tidak ada penjualan atau penjaminan atas <HB> sejak diwakafkan",
                   "<HB> masih utuh sebagai harta wakaf dan tidak pernah dialihkan"],
          berbeda=B("peristiwa", "versi A: harta wakaf tidak pernah dialihkan; versi B: harta wakaf sudah dialihkan - berselisih pada PERISTIWA",
                    ["<HB> tidak pernah dialihkan sejak diwakafkan", "<HB> tidak pernah dijual sejak diwakafkan"],
                    ["<HB> sudah dialihkan sejak diwakafkan", "<HB> sudah dijual sejak diwakafkan"])),
        ["q-wk-dijual", "q-wk-dijaminkan", "q-wk-dialihkan"], "tidak-dialihkan", "tahu")
    p.t(Q("q-tg-wk-ahliwaris-setuju", "pp-bantahan", 70, "tambahan", "pokok",
          "Apakah ahli waris <WK> mengetahui wakaf atas harta itu, apakah pernah meminta harta itu kembali, dan bagaimana sikap mereka ?",
          hal="sikap ahli waris wakif terhadap wakaf", ringkas="sikap ahli waris <WK> terhadap wakaf atas <HB>",
          teks_varian=["Bagaimana sikap ahli waris <WK> terhadap wakaf itu sejak wakif wafat ?"],
          melihat=["ahli waris <WK> mengetahui wakaf atas <HB> dan tidak pernah meminta harta itu kembali",
                   "sejak <WK> wafat ahli warisnya membiarkan <HB> tetap diurus nazhir tanpa keberatan",
                   "ahli waris <WK> ikut menyaksikan <HB> dipakai sebagai wakaf dan tidak berkeberatan",
                   "keluarga <WK> menerima wakaf atas <HB> dan tidak menarik hartanya kembali"],
          berbeda=B("peristiwa", "versi A: ahli waris tidak berkeberatan atas wakaf; versi B: ahli waris berkeberatan atas wakaf - berselisih pada PERISTIWA",
                    ["ahli waris <WK> tidak berkeberatan atas wakaf <HB>", "keluarga <WK> tidak mempersoalkan wakaf <HB>"],
                    ["ahli waris <WK> berkeberatan atas wakaf <HB>", "keluarga <WK> mempersoalkan wakaf <HB>"])),
        ["q-wk-ahliwaris-meminta", "q-wk-ahliwaris-menguasai"], "ahli-waris-setuju-wakaf", "lihat")
    paket.append(p)

    # ======================================================================= EKONOMI SYARIAH
    p = Paket("ekonomi-syariah", "ekonomi-syariah-tergugat", "Ekonomi syariah - keterangan saksi yang diajukan Tergugat", "370",
              {"_g": "x", "PM": "#0046#", "LW": "#0047#", "AK": "#9340#", "JB": "#9344#", "RP": "#4765#", "AS": "#4766#", "SP": "#4767#", "AG": "#4768#"},
              {"sudah-bayar": "Tergugat sudah membayar angsuran", "akad-tidak-dijelaskan": "isi akad tidak dijelaskan kepada Tergugat", "keadaan-memaksa": "Tergugat tidak mampu membayar karena musibah",
               "tidak-ada-somasi": "Tergugat tidak pernah menerima peringatan", "denda-tidak-sesuai": "denda tidak sesuai akad", "dana-kurang": "dana yang diterima Tergugat kurang dari akad",
               "agunan-bermasalah": "pemilik agunan tidak mengetahui akad", "minta-keringanan": "Tergugat sudah meminta keringanan"})
    p.t(Q("q-tg-es-sudah-bayar", "pp-bantahan", 10, "tambahan", "pokok",
          "Berapa angsuran yang sudah dibayar <LW> kepada <PM>, kapan dibayar, dan apa buktinya ?",
          hal="angsuran yang sudah dibayar lawan dan buktinya", ringkas="angsuran yang sudah dibayar <LW> kepada <PM> menurut <AK> dan buktinya",
          teks_varian=["Apakah <LW> sudah membayar angsuran kepada <PM> dan bagaimana bukti pembayarannya ?"],
          melihat=["<LW> membayar angsuran <AK> secara teratur kepada <PM> sampai waktu tertentu dan buktinya disimpan",
                   "angsuran <AK> dibayar <LW> lewat rekening <PM> dan bukti transfernya ada pada <LW>",
                   "bukti pembayaran angsuran <AK> oleh <LW> kepada <PM> masih disimpan",
                   "<LW> sudah melunasi sebagian besar angsuran <AK> kepada <PM> dengan bukti setoran"],
          berbeda=B("peristiwa", "versi A: lawan sudah membayar angsuran; versi B: lawan belum membayar angsuran - berselisih pada PERISTIWA",
                    ["<LW> sudah membayar angsuran <AK> kepada <PM>", "angsuran <AK> sudah dibayar <LW> kepada <PM>"],
                    ["<LW> belum membayar angsuran <AK> kepada <PM>", "angsuran <AK> belum dibayar <LW> kepada <PM>"])),
        ["q-es-angsuran-terakhir", "q-es-wp-sejak", "q-es-sisa-rinci"], "sudah-bayar", "lihat")
    p.t(Q("q-tg-es-akad-tidak-dijelaskan", "pp-bantahan", 20, "tambahan", "pokok",
          "Apakah isi akad dijelaskan dan salinannya diberikan kepada <LW> sebelum menandatangani, dan bagaimana keadaan penandatanganan ?",
          hal="penjelasan isi akad dan salinan kepada lawan", ringkas="penjelasan isi <AK> dan penyerahan salinannya kepada <LW>",
          teks_varian=["Apakah <LW> sempat membaca dan menerima salinan akad sebelum menandatangani ?"],
          melihat=["isi <AK> tidak dijelaskan kepada <LW> sebelum ia menandatanganinya",
                   "<LW> menandatangani <AK> tanpa sempat membaca isinya",
                   "salinan <AK> tidak diberikan kepada <LW> setelah penandatanganan",
                   "<LW> diminta menandatangani <AK> dengan cepat tanpa penjelasan"],
          berbeda=B("peristiwa", "versi A: isi akad tidak dijelaskan kepada lawan; versi B: isi akad dijelaskan kepada lawan - berselisih pada PERISTIWA",
                    ["isi <AK> tidak dijelaskan kepada <LW>", "<LW> menandatangani <AK> tanpa penjelasan"],
                    ["isi <AK> dijelaskan kepada <LW>", "<LW> menandatangani <AK> setelah mendapat penjelasan"])),
        ["q-es-akad-dibacakan", "q-es-akad-salinan"], "akad-tidak-dijelaskan", "lihat")
    p.t(Q("q-tg-es-keadaan-memaksa", "pp-bantahan", 30, "tambahan", "pokok",
          "Apa yang menyebabkan <LW> tidak dapat membayar, apakah usahanya merugi atau terkena musibah, dan bagaimana saksi mengetahuinya ?",
          hal="sebab lawan tidak dapat membayar", ringkas="sebab <LW> tidak dapat membayar angsuran <AK>",
          teks_varian=["Apakah usaha atau penghasilan <LW> terganggu oleh musibah sehingga ia tidak sanggup membayar ?"],
          melihat=["usaha <LW> merugi karena musibah di luar kendalinya sehingga ia tidak sanggup membayar angsuran <AK>",
                   "penghasilan <LW> menurun drastis karena keadaan di luar kendalinya dan ia tidak mampu memenuhi <AK>",
                   "<LW> ditimpa musibah yang menghentikan usahanya sehingga tidak dapat membayar angsuran <AK>",
                   "akibat keadaan di luar kendalinya <LW> tidak mampu membayar angsuran <AK>"],
          berbeda=B("peristiwa", "versi A: lawan tidak mampu membayar karena musibah; versi B: lawan mampu membayar - berselisih pada PERISTIWA",
                    ["<LW> tidak mampu membayar angsuran <AK> karena musibah", "<LW> tidak sanggup membayar angsuran <AK> karena usahanya merugi"],
                    ["<LW> mampu membayar angsuran <AK>", "<LW> sanggup membayar angsuran <AK>"])),
        ["q-es-wp-mampu", "q-es-kemampuan-uang-paksa"], "keadaan-memaksa", "lihat")
    p.t(Q("q-tg-es-tidak-ada-somasi", "pp-bantahan", 40, "tambahan", "pokok",
          "Apakah <LW> pernah menerima surat peringatan atau didatangi petugas <PM> untuk ditagih, dan kapan ?",
          hal="penerimaan surat peringatan atau penagihan oleh lawan", ringkas="penerimaan surat peringatan atau kunjungan penagihan <PM> oleh <LW> atas <AK>",
          teks_varian=["Apakah sebelum digugat <LW> pernah diberi peringatan oleh <PM> secara tertulis atau lisan ?"],
          melihat=["<LW> tidak pernah menerima surat peringatan dari <PM> mengenai <AK> sebelum digugat",
                   "tidak ada petugas <PM> yang mendatangi <LW> untuk menagih tunggakan <AK>",
                   "sebelum digugat <LW> tidak pernah ditegur <PM> mengenai tunggakan <AK>",
                   "<PM> tidak menyampaikan peringatan kepada <LW> tentang <AK> sebelum gugatan diajukan"],
          berbeda=B("peristiwa", "versi A: lawan tidak pernah menerima peringatan; versi B: lawan pernah menerima peringatan - berselisih pada PERISTIWA",
                    ["<LW> tidak pernah menerima peringatan dari <PM> mengenai <AK>", "<PM> tidak pernah menegur <LW> mengenai <AK>"],
                    ["<LW> pernah menerima peringatan dari <PM> mengenai <AK>", "<PM> pernah menegur <LW> mengenai <AK>"])),
        ["q-es-somasi-ada", "q-es-somasi-diterima", "q-es-kunjungan"], "tidak-ada-somasi", "lihat")
    p.t(Q("q-tg-es-denda-tidak-sesuai", "pp-bantahan", 50, "tambahan", "pokok",
          "Apakah denda atau tambahan biaya yang dibebankan <PM> kepada <LW> pernah dijelaskan, dan apakah besarnya sesuai akad ?",
          hal="penjelasan dan kesesuaian denda dengan akad", ringkas="kesesuaian denda atas <AK> yang dibebankan <PM> kepada <LW>",
          teks_varian=["Apakah denda yang ditagih <PM> kepada <LW> sesuai ketentuan akad menurut yang saksi ketahui ?"],
          melihat=["denda yang dibebankan kepada <LW> lebih besar daripada ketentuan dalam <AK> dan tidak pernah dijelaskan",
                   "<LW> tidak pernah diberi tahu cara menghitung denda atas <AK>",
                   "besar denda atas <AK> tidak sesuai dengan ketentuan yang disepakati",
                   "perhitungan denda atas <AK> tidak diterangkan kepada <LW> dan nilainya membengkak"],
          berbeda=B("jumlah", "versi A: denda tidak sesuai ketentuan akad; versi B: denda sesuai ketentuan akad - berselisih pada JUMLAH",
                    ["denda atas <AK> tidak sesuai ketentuan akad", "besar denda atas <AK> tidak sesuai dengan akad"],
                    ["denda atas <AK> sesuai ketentuan akad", "besar denda atas <AK> sesuai dengan akad"])),
        ["q-es-denda"], "denda-tidak-sesuai", "tahu")
    p.t(Q("q-tg-es-dana-kurang", "pp-bantahan", 60, "tambahan", "pokok",
          "Berapa dana atau nilai barang yang sebenarnya diterima <LW>, dan apakah ada potongan biaya sebelum diterimanya ?",
          hal="dana atau barang yang sebenarnya diterima lawan", ringkas="dana atau barang yang sebenarnya diterima <LW> menurut <AK>",
          teks_varian=["Apakah dana yang masuk ke <LW> sama dengan angka yang tertulis dalam akad atau ada potongan ?"],
          melihat=["dana yang diterima <LW> berdasarkan <AK> lebih kecil daripada jumlah yang tertulis karena ada potongan",
                   "setelah dipotong biaya <LW> hanya menerima sebagian dana menurut <AK>",
                   "pencairan menurut <AK> yang sampai kepada <LW> kurang dari plafon yang disebut dalam akad",
                   "jumlah yang diterima <LW> menurut <AK> berbeda dari angka yang tertulis dalam akad"],
          berbeda=B("jumlah", "versi A: dana yang diterima lebih kecil dari yang tertulis; versi B: dana yang diterima sama dengan yang tertulis - berselisih pada JUMLAH",
                    ["<LW> menerima dana menurut <AK> lebih kecil dari yang tertulis", "dana menurut <AK> yang sampai kepada <LW> kurang dari yang tertulis"],
                    ["<LW> menerima dana menurut <AK> sesuai yang tertulis", "dana menurut <AK> yang sampai kepada <LW> sama dengan yang tertulis"])),
        ["q-es-pencairan", "q-es-tanda-terima"], "dana-kurang", "lihat")
    p.t(Q("q-tg-es-agunan-masalah", "pp-bantahan", 70, "tambahan", "pokok",
          "Apakah pemilik agunan mengetahui dan menyetujui agunannya dipakai untuk akad itu, dan bagaimana nilai agunan dibandingkan sisa kewajiban ?",
          hal="persetujuan pemilik agunan dan nilai agunan", ringkas="persetujuan pemilik <AG> dan nilai agunan untuk <AK>",
          teks_varian=["Apakah pemilik agunan pernah diminta persetujuan dan apakah nilai agunan jauh melebihi sisa kewajiban ?"],
          melihat=["pemilik <AG> tidak mengetahui bahwa agunan itu dipakai untuk <AK>",
                   "pemilik <AG> tidak ikut menandatangani persetujuan agunan untuk <AK>",
                   "nilai <AG> jauh melebihi sisa kewajiban dalam <AK> dan tidak dipertimbangkan oleh pihak pembiayaan",
                   "<AG> sebagai agunan <AK> tidak dikuasai <LW> melainkan dikuasai pemiliknya"],
          berbeda=B("peristiwa", "versi A: pemilik agunan tidak menyetujui agunan; versi B: pemilik agunan menyetujui agunan - berselisih pada PERISTIWA",
                    ["pemilik <AG> tidak menyetujui agunan untuk <AK>", "pemilik <AG> tidak mengetahui agunan untuk <AK>"],
                    ["pemilik <AG> menyetujui agunan untuk <AK>", "pemilik <AG> mengetahui agunan untuk <AK>"])),
        ["q-es-pemilik-jaminan-setuju", "q-es-jaminan-nilai"], "agunan-bermasalah", "tahu")
    p.t(Q("q-tg-es-minta-keringanan", "pp-bantahan", 80, "tambahan", "pokok",
          "Apakah <LW> pernah meminta keringanan atau penjadwalan ulang kepada <PM>, kapan, dan bagaimana tanggapan <PM> ?",
          hal="permintaan keringanan oleh lawan dan tanggapan pengaju", ringkas="permintaan keringanan oleh <LW> atas <AK> dan tanggapan <PM>",
          teks_varian=["Apakah <LW> sudah memohon keringanan pembayaran kepada <PM> dan apa jawaban <PM> ?"],
          melihat=["<LW> sudah meminta keringanan pembayaran atas <AK> kepada <PM> tetapi permintaan itu tidak ditanggapi",
                   "permohonan penjadwalan ulang <LW> atas <AK> diajukan kepada <PM> dan tidak dijawab",
                   "<LW> berkali-kali memohon keringanan kepada <PM> atas <AK> namun tidak digubris",
                   "<PM> tidak memberi keringanan atas <AK> meskipun <LW> sudah memohon"],
          berbeda=B("peristiwa", "versi A: permohonan keringanan lawan tidak dijawab; versi B: permohonan keringanan lawan dijawab pengaju - berselisih pada PERISTIWA",
                    ["<LW> sudah memohon keringanan kepada <PM> atas <AK> tetapi tidak dijawab", "<LW> mengajukan penjadwalan ulang atas <AK> tetapi tidak ditanggapi <PM>"],
                    ["<PM> menjawab permohonan keringanan <LW> atas <AK>", "<PM> menanggapi permohonan penjadwalan ulang <LW> atas <AK>"])),
        ["q-es-restrukturisasi"], "minta-keringanan", "lihat")
    paket.append(p)
    return paket


if __name__ == "__main__":
    for p in semua():
        kat = p.bangun()
        berkas = L.tulis(kat, p.kunci)
        print(p.kunci, "butir", len(kat["pertanyaan"]), "variabelBaru", kat["variabelBaru"])
        print(L.periksa(berkas))
