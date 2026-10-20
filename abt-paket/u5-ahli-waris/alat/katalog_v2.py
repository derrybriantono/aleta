# -*- coding: utf-8 -*-
"""
Katalog saksi "penetapan-ahli-waris" versi 2 (agen U5, 20 Okt 2026): menambah pokok, pertanyaan, keadaan dan dasar hukum
tanpa menghapus apa pun dari versi 1. Dibangun dari berkas versi 1 di repo (cadangan: katalog-v1/penetapan-ahli-waris.json).

Pakai: python katalog_v2.py <katalog-v1.json> <keluar.json>
Aturan skema: ekstensi-sipp/saksi-katalog.js periksaKatalog (min 4 varian saksi 1 dan saksi 2, penanda sama di tiap varian, ...).
"""
import copy, json, re, sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kerangka as K
from kerangka import Q, bangun_q

PETA = {"_g": "x", "PM": "#7036#", "PW": "#1025#", "PS": "#2026#"}
SEMUA = []


def tambah(q, gaya="tahu", **keadaan):
    q.gaya = gaya
    q.keadaan = keadaan or None
    SEMUA.append(q)
    return q


def B(pada, maksud, A, Bv):
    return dict(pada=pada, maksud=maksud, A=A, B=Bv)


def tanda(core):
    return sorted(re.findall(r"#\d{4}#|<[A-Z]+>", core))


def periksa_inti(q):
    """Setiap daftar inti harus memuat himpunan penanda yang sama (mesin menolak bila tidak)."""
    for nama in ("melihat", "sebagian"):
        daftar = getattr(q, nama)
        if daftar:
            base = tanda(daftar[0])
            for c in daftar:
                assert tanda(c) == base, (q.id, nama, c, tanda(c), base)
    if q.berbeda:
        for kunci in ("A", "B"):
            daftar = q.berbeda[kunci]
            base = tanda(daftar[0])
            for c in daftar:
                assert tanda(c) == base, (q.id, "berbeda", kunci, c)


# ------------------------------------------------------------------ pokok pembuktian baru
POKOK_BARU = [
    dict(id="pp-paw-domisili", judul="Tempat tinggal pewaris dan para pemohon", uraian="tempat tinggal terakhir pewaris dan tempat tinggal para pemohon", dasarHukum=[], wajib=False),
    dict(id="pp-paw-perkawinan", judul="Keadaan perkawinan pewaris dan pasangannya saat pewaris meninggal", uraian="pasangan pewaris masih hidup, sudah meninggal lebih dahulu, sudah bercerai, atau berpisah tanpa bercerai, dan ada tidaknya lebih dari seorang istri", dasarHukum=["dh-khi-171", "dh-khi-174"], wajib=False),
    dict(id="pp-paw-nasab-anak", judul="Kedudukan anak pewaris", uraian="anak pewaris lahir dari perkawinan yang sah atau di luar perkawinan, dan ada tidaknya ahli waris yang belum dewasa atau diampu", dasarHukum=["dh-khi-171", "dh-khi-100"], wajib=False),
    dict(id="pp-paw-harta", judul="Harta peninggalan pewaris", uraian="harta atau dana yang ditinggalkan pewaris, atas nama siapa tercatat dan asal perolehannya", dasarHukum=["dh-khi-171", "dh-khi-96"], wajib=True),
    dict(id="pp-paw-wasiat-hutang", judul="Wasiat dan hutang pewaris", uraian="ada tidaknya wasiat dan hutang yang ditinggalkan pewaris", dasarHukum=["dh-khi-175", "dh-khi-195"], wajib=False),
    dict(id="pp-paw-tanpa-sengketa", judul="Tidak ada sengketa antar ahli waris", uraian="tidak ada perselisihan atau keberatan di antara ahli waris dan, bila diminta, kesepakatan tentang bagian", dasarHukum=["dh-bukuii-2026-36"], wajib=True),
]

# ------------------------------------------------------------------ dasar hukum baru (bunyi dari referensi/KHI-pasal-terverifikasi.md, dicocokkan 18 Okt 2026)
SUMBER_KHI = "KHI lampiran Inpres 1/1991: bunyi dicocokkan antara digitalisasi pasal.id dan naskah Depag (referensi/KHI-pasal-terverifikasi.md, VERIFIKASI-HUKUM 18 Okt 2026); dipakai agen U5 20 Okt 2026"
DASAR_BARU = [
    dict(id="dh-khi-96", rujukan="Pasal 96 ayat (1) Kompilasi Hukum Islam", uraian="bila terjadi cerai mati, separoh harta bersama menjadi hak pasangan yang hidup lebih lama", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-100", rujukan="Pasal 100 Kompilasi Hukum Islam", uraian="anak yang lahir di luar perkawinan hanya mempunyai hubungan nasab dengan ibunya dan keluarga ibunya", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-171h", rujukan="Pasal 171 huruf e, f dan h Kompilasi Hukum Islam", uraian="harta warisan adalah harta bawaan ditambah bagian dari harta bersama setelah dikurangi keperluan pewaris selama sakit, biaya pengurusan jenazah, hutang dan pemberian untuk kerabat; wasiat adalah pemberian benda yang berlaku setelah pewaris meninggal; anak angkat adalah anak yang pemeliharaan dan biaya pendidikannya beralih kepada orang tua angkat berdasarkan putusan Pengadilan", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-175", rujukan="Pasal 175 Kompilasi Hukum Islam", uraian="kewajiban ahli waris terhadap pewaris: mengurus jenazah sampai selesai pemakaman, menyelesaikan hutang dan menagih piutang, menyelesaikan wasiat, dan membagi harta warisan; tanggung jawab terhadap hutang terbatas pada nilai harta peninggalan", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-195", rujukan="Pasal 195 ayat (2) dan (3) Kompilasi Hukum Islam", uraian="wasiat hanya diperbolehkan sebanyak-banyaknya sepertiga dari harta warisan kecuali semua ahli waris menyetujui; wasiat kepada ahli waris hanya berlaku bila disetujui semua ahli waris", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-173b", rujukan="Pasal 173 huruf a dan b Kompilasi Hukum Islam", uraian="terhalang menjadi ahli waris bila dengan putusan Hakim yang berkekuatan hukum tetap dihukum karena membunuh, mencoba membunuh atau menganiaya berat pewaris, atau memfitnah pewaris melakukan kejahatan yang diancam pidana lima tahun atau lebih berat", status="terverifikasi", sumber=SUMBER_KHI),
]

# ------------------------------------------------------------------ keadaan baru (borang)
KEADAAN_BARU = {
    "statusPasangan": dict(sumber="borang", nilai=["masih-hidup", "meninggal-lebih-dahulu", "bercerai", "berpisah"], bawaan="masih-hidup", label="Keadaan pasangan pewaris saat pewaris meninggal",
                           labelNilai={"masih-hidup": "Pasangan masih hidup", "meninggal-lebih-dahulu": "Pasangan meninggal lebih dahulu", "bercerai": "Sudah bercerai sebelum pewaris meninggal", "berpisah": "Berpisah tempat tinggal tetapi belum bercerai"}),
    "jumlahPasangan": dict(sumber="borang", nilai=["satu", "lebih-dari-satu"], bawaan="satu", label="Jumlah istri pewaris",
                           labelNilai={"satu": "Seorang pasangan", "lebih-dari-satu": "Lebih dari seorang istri"}),
    "anakLuarNikah": dict(sumber="borang", nilai=["tidak-ada", "ada"], bawaan="tidak-ada", label="Pewaris mempunyai anak yang lahir di luar perkawinan yang sah"),
    "ahliWarisBelumDewasa": dict(sumber="borang", nilai=["tidak-ada", "ada"], bawaan="tidak-ada", label="Ada ahli waris yang belum dewasa atau di bawah pengampuan"),
    "bedaAgama": dict(sumber="borang", nilai=["tidak-ada", "ada"], bawaan="tidak-ada", label="Ada kerabat pewaris yang tidak beragama Islam"),
    "asalHarta": dict(sumber="borang", nilai=["dana-hak-pewaris", "selama-perkawinan", "bawaan"], bawaan="dana-hak-pewaris", label="Asal harta peninggalan",
                      labelNilai={"dana-hak-pewaris": "Dana atau hak atas nama pewaris (BPJS, Taspen, tabungan)", "selama-perkawinan": "Diperoleh selama perkawinan (harta bersama)", "bawaan": "Harta bawaan atau milik pewaris sendiri"}),
    "hutang": dict(sumber="borang", nilai=["tidak-ada", "ada"], bawaan="tidak-ada", label="Pewaris meninggalkan hutang"),
    "ahliWarisLainTidakIkut": dict(sumber="borang", nilai=["tidak-ada", "ada"], bawaan="tidak-ada", label="Ada ahli waris yang tidak ikut menjadi pemohon"),
    "tujuanPermohonan": dict(sumber="borang", nilai=["pencairan-dana", "tanah-aset", "lain"], bawaan="pencairan-dana", label="Tujuan permohonan penetapan ahli waris",
                             labelNilai={"pencairan-dana": "Pencairan dana (BPJS, Taspen, bank, asuransi)", "tanah-aset": "Mengurus tanah atau harta lain (balik nama dan sebagainya)", "lain": "Tujuan lain"}),
    "bagianDiminta": dict(sumber="borang", nilai=["tidak", "ya"], bawaan="tidak", label="Permohonan juga menetapkan bagian masing-masing ahli waris (P3HP)"),
}

# ------------------------------------------------------------------ pertanyaan baru
tambah(Q("q-paw-domisili", "pp-paw-domisili", 15, "jarang", "pokok",
         "Di mana <PW> bertempat tinggal terakhir dan di mana <PM> bertempat tinggal sekarang?",
         hal="tempat tinggal pewaris dan para pemohon", ringkas="tempat tinggal terakhir <PW> dan tempat tinggal <PM>",
         teks_varian=["Di mana tempat tinggal terakhir <PW> dan tempat tinggal <PM> saat ini?"],
         melihat=["<PW> terakhir bertempat tinggal di ... sedangkan <PM> bertempat tinggal di wilayah #8011#",
                  "tempat tinggal terakhir <PW> adalah di ... dan <PM> bertempat tinggal di wilayah #8011#",
                  "sebelum meninggal dunia <PW> tinggal di ... sementara <PM> tinggal di wilayah #8011#",
                  "<PW> menetap terakhir di ... dan <PM> sekarang tinggal di wilayah #8011#"],
         sebagian=["<PM> bertempat tinggal di wilayah #8011#", "<PM> sekarang tinggal di wilayah #8011#"],
         berbeda=B("tempat", "versi A: pewaris dan pemohon di wilayah yang dimaksud; versi B: pewaris tinggal di luar wilayah - berselisih pada TEMPAT",
                   ["<PW> terakhir bertempat tinggal di ... sedangkan <PM> bertempat tinggal di wilayah #8011#", "tempat tinggal terakhir <PW> adalah di ... dan <PM> bertempat tinggal di wilayah #8011#"],
                   ["<PW> terakhir bertempat tinggal di luar wilayah #8011# sedangkan <PM> tinggal di dalamnya", "tempat tinggal terakhir <PW> berada di luar wilayah #8011# dan <PM> tinggal di wilayah itu"])))

tambah(Q("q-paw-kematian-lihat", "pp-paw-kematian", 32, "jarang", "pokok",
         "Apakah Saudara ikut melayat atau mengetahui pemakaman <PW>?",
         hal="pelayatan dan pemakaman pewaris", ringkas="pelayatan dan pemakaman <PW> setelah meninggal dunia",
         teks_varian=["Apakah Saudara hadir di rumah duka ketika <PW> meninggal dunia?"],
         melihat=["jenazah <PW> dimakamkan setelah meninggal dunia pada tanggal #1246# dan keluarga mengadakan pelayatan di rumah duka",
                  "setelah <PW> meninggal dunia pada tanggal #1246# jenazahnya dimakamkan dan para pelayat datang ke rumah duka",
                  "pada saat <PW> wafat tanggal #1246# keluarga dan kerabat berkumpul di rumah duka sampai jenazahnya dimakamkan",
                  "sesudah <PW> meninggal dunia pada tanggal #1246# keluarga mengurus jenazahnya hingga selesai dimakamkan"],
         sebagian=["jenazah <PW> sudah dimakamkan setelah meninggal dunia pada tanggal #1246#", "<PW> sudah dimakamkan setelah wafat pada tanggal #1246#"],
         berbeda=B("waktu", "versi A: dimakamkan segera setelah meninggal; versi B: beberapa hari kemudian - berselisih pada WAKTU",
                   ["jenazah <PW> dimakamkan setelah meninggal dunia pada tanggal #1246# dan keluarga mengadakan pelayatan di rumah duka", "setelah <PW> meninggal dunia pada tanggal #1246# jenazahnya dimakamkan dan para pelayat datang ke rumah duka"],
                   ["jenazah <PW> baru dimakamkan beberapa hari sesudah tanggal #1246# dan keluarga mengadakan pelayatan di rumah duka", "pemakaman <PW> dilakukan beberapa hari setelah tanggal #1246# dan para pelayat datang ke rumah duka"])),
       gaya="lihat")

# --- keadaan pasangan pewaris saat meninggal
tambah(Q("q-paw-pasangan-hidup", "pp-paw-perkawinan", 74, "jarang", "pokok",
         "Ketika <PW> meninggal dunia, apakah suami atau istrinya masih hidup? Siapa namanya?",
         hal="keadaan suami atau istri pewaris ketika pewaris meninggal", ringkas="keadaan suami atau istri <PW> ketika ia meninggal dunia",
         teks_varian=["Apakah pasangan <PW> masih hidup pada saat ia wafat?"],
         melihat=["ketika <PW> meninggal dunia pasangannya yaitu #8610# masih hidup dan perkawinan mereka belum pernah putus",
                  "saat <PW> wafat pasangannya yaitu #8610# masih hidup dan perkawinan keduanya tidak pernah putus",
                  "pada waktu <PW> meninggal dunia #8610# sebagai pasangannya masih hidup dan perkawinan mereka belum putus karena perceraian",
                  "sampai <PW> meninggal dunia #8610# masih hidup sebagai pasangannya yang sah dan perkawinan mereka tidak pernah berakhir"],
         sebagian=["#8610# sebagai pasangan <PW> masih hidup ketika ia meninggal dunia", "pasangan <PW> yaitu #8610# masih hidup pada saat ia wafat"],
         berbeda=B("peristiwa", "versi A: pasangan masih hidup; versi B: pasangan sudah meninggal lebih dahulu - berselisih pada PERISTIWA",
                   ["ketika <PW> meninggal dunia pasangannya yaitu #8610# masih hidup dan perkawinan mereka belum pernah putus", "saat <PW> wafat pasangannya yaitu #8610# masih hidup dan perkawinan keduanya tidak pernah putus"],
                   ["ketika <PW> meninggal dunia pasangannya yaitu #8610# sudah meninggal dunia lebih dahulu dan perkawinan mereka tidak lagi berlangsung", "saat <PW> wafat pasangannya yaitu #8610# sudah wafat lebih dahulu dan perkawinan keduanya tidak lagi ada"])),
       pasanganPewaris="ada", statusPasangan="masih-hidup")

tambah(Q("q-paw-pasangan-meninggal", "pp-paw-perkawinan", 75, "inti", "pokok",
         "Apakah suami atau istri <PW> masih hidup ketika <PW> meninggal dunia? Kapan pasangannya meninggal?",
         hal="meninggalnya suami atau istri pewaris lebih dahulu", ringkas="meninggalnya suami atau istri <PW> lebih dahulu daripada <PW>",
         teks_varian=["Kapan dan di mana suami atau istri <PW> meninggal dunia, apakah lebih dahulu daripada <PW>?"],
         melihat=["pasangan <PW> yaitu #8610# telah meninggal dunia #8613# dan meninggalnya lebih dahulu",
                  "#8610# sebagai pasangan <PW> sudah wafat #8613# dan wafatnya lebih dahulu",
                  "sebelum <PW> meninggal dunia pasangannya yaitu #8610# telah lebih dahulu meninggal #8613#",
                  "pasangan <PW> yaitu #8610# meninggal dunia terlebih dahulu #8613# sebelum ia wafat"],
         sebagian=["pasangan <PW> yaitu #8610# sudah meninggal dunia lebih dahulu", "#8610# sebagai pasangan <PW> telah lebih dahulu wafat"],
         berbeda=B("waktu", "versi A: pasangan meninggal lebih dahulu; versi B: pasangan meninggal sesudah pewaris - berselisih pada WAKTU",
                   ["pasangan <PW> yaitu #8610# telah meninggal dunia #8613# dan meninggalnya lebih dahulu", "sebelum <PW> meninggal dunia pasangannya yaitu #8610# telah lebih dahulu meninggal #8613#"],
                   ["pasangan <PW> yaitu #8610# meninggal dunia #8613# tetapi sesudah <PW> wafat dan bukan lebih dahulu", "#8610# sebagai pasangan <PW> baru wafat #8613# setelah <PW> meninggal dunia dan bukan lebih dahulu"])),
       pasanganPewaris="ada", statusPasangan="meninggal-lebih-dahulu")

tambah(Q("q-paw-pasangan-bercerai", "pp-paw-perkawinan", 76, "inti", "pokok",
         "Apakah <PW> pernah bercerai dari pasangannya sebelum meninggal dunia? Apa buktinya?",
         hal="perceraian pewaris dengan pasangannya", ringkas="perceraian <PW> dengan pasangannya sebelum meninggal dunia",
         teks_varian=["Sebelum meninggal dunia, apakah perkawinan <PW> sudah putus karena perceraian?"],
         melihat=["perkawinan <PW> dengan #8610# telah putus karena perceraian sebelum ia meninggal dunia",
                  "<PW> sudah bercerai dari #8610# sebelum meninggal dunia",
                  "pernikahan <PW> dengan #8610# sudah berakhir karena perceraian sebelum ia wafat",
                  "perceraian antara <PW> dan #8610# terjadi sebelum ia meninggal dunia dan perkawinan keduanya berakhir"],
         sebagian=["<PW> pernah bercerai dari #8610# sebelum meninggal dunia", "<PW> dan #8610# pernah bercerai"],
         berbeda=B("peristiwa", "versi A: sudah bercerai; versi B: belum bercerai - berselisih pada PERISTIWA",
                   ["perkawinan <PW> dengan #8610# telah putus karena perceraian sebelum ia meninggal dunia", "<PW> sudah bercerai dari #8610# sebelum meninggal dunia"],
                   ["perkawinan <PW> dengan #8610# belum putus karena perceraian ketika ia meninggal dunia", "<PW> belum pernah bercerai dari #8610# sampai meninggal dunia"])),
       pasanganPewaris="ada", statusPasangan="bercerai")

tambah(Q("q-paw-pasangan-berpisah", "pp-paw-perkawinan", 77, "inti", "pokok",
         "Apakah <PW> dan pasangannya masih tinggal bersama ketika <PW> meninggal dunia? Apakah keduanya sudah bercerai?",
         hal="keadaan tempat tinggal dan status perkawinan pewaris dengan pasangannya", ringkas="berpisahnya tempat tinggal <PW> dengan pasangannya tanpa perceraian",
         teks_varian=["Apakah perkawinan <PW> dan pasangannya masih ada meskipun tinggal berpisah ketika <PW> wafat?"],
         melihat=["<PW> telah berpisah tempat tinggal dengan #8610# tetapi belum pernah bercerai sampai meninggal dunia",
                  "sebelum wafat <PW> tinggal berpisah dari #8610# namun belum bercerai secara resmi",
                  "<PW> dan #8610# tinggal di tempat berbeda sedangkan perkawinan keduanya belum putus karena perceraian",
                  "sampai <PW> meninggal dunia #8610# masih berstatus pasangannya meskipun keduanya berpisah tempat tinggal dan belum bercerai"],
         sebagian=["<PW> dan #8610# berpisah tempat tinggal", "<PW> tinggal terpisah dari #8610#"],
         berbeda=B("peristiwa", "versi A: berpisah tempat tinggal tanpa cerai; versi B: masih serumah - berselisih pada PERISTIWA",
                   ["<PW> telah berpisah tempat tinggal dengan #8610# tetapi belum pernah bercerai sampai meninggal dunia", "sebelum wafat <PW> tinggal berpisah dari #8610# namun belum bercerai secara resmi"],
                   ["<PW> masih tinggal serumah dengan #8610# hingga ia meninggal dunia dan tidak pernah berpisah", "<PW> masih tinggal bersama #8610# sampai wafat dan tidak pernah berpisah"])),
       pasanganPewaris="ada", statusPasangan="berpisah")

tambah(Q("q-paw-poligami", "pp-paw-perkawinan", 78, "pilihan", "pokok",
         "Apakah <PW> mempunyai lebih dari seorang istri? Siapa saja istri-istrinya?",
         hal="jumlah dan nama istri pewaris", ringkas="istri-istri <PW>",
         teks_varian=["Semasa hidupnya, apakah <PW> beristri lebih dari seorang?"],
         melihat=["<PW> mempunyai lebih dari seorang istri yaitu ... dan semuanya masih terikat perkawinan dengannya",
                  "istri <PW> lebih dari seorang yaitu ... dan seluruhnya masih terikat perkawinan sampai ia meninggal dunia",
                  "semasa hidupnya <PW> beristri lebih dari seorang yaitu ... yang seluruhnya masih menjadi istrinya ketika ia wafat",
                  "pada saat <PW> meninggal dunia istrinya lebih dari seorang yaitu ... dan semuanya masih terikat perkawinan dengannya"],
         sebagian=["di antara istri <PW> terdapat ... yang masih menjadi istrinya", "salah satu istri <PW> bernama ... yang masih terikat perkawinan dengannya"],
         berbeda=B("jumlah", "versi A: lebih dari seorang istri; versi B: hanya seorang istri - berselisih pada JUMLAH (istri)",
                   ["<PW> mempunyai lebih dari seorang istri yaitu ... dan semuanya masih terikat perkawinan dengannya", "istri <PW> lebih dari seorang yaitu ... dan seluruhnya masih terikat perkawinan sampai ia meninggal dunia"],
                   ["<PW> hanya mempunyai seorang istri yaitu ... dan tidak ada istri lain", "istri <PW> hanya seorang yaitu ... dan tidak ada istri yang lain"])),
       pasanganPewaris="ada", jumlahPasangan="lebih-dari-satu")

# --- kedudukan anak
tambah(Q("q-paw-anak-sah", "pp-paw-nasab-anak", 81, "jarang", "pokok",
         "Apakah semua anak <PW> dilahirkan dari perkawinan yang sah dengan pasangannya?",
         hal="kedudukan sah anak pewaris", ringkas="kelahiran anak <PW> dalam perkawinan yang sah",
         teks_varian=["Apakah anak-anak <PW> lahir dalam perkawinan yang sah?"],
         melihat=["seluruh anak <PW> dilahirkan dari perkawinan yang sah dengan pasangannya",
                  "semua anak <PW> lahir dalam perkawinan yang sah dengan pasangannya",
                  "anak-anak <PW> seluruhnya adalah anak yang sah yang dilahirkan dalam perkawinan dengan pasangannya",
                  "tiap anak <PW> lahir dari perkawinan yang sah dengan pasangannya"],
         sebagian=["sebagian anak <PW> lahir dari perkawinan yang sah dengan pasangannya", "anak <PW> yang saya ketahui lahir dalam perkawinan yang sah dengan pasangannya"],
         berbeda=B("peristiwa", "versi A: semua anak lahir dalam perkawinan sah; versi B: ada anak lahir di luar perkawinan - berselisih pada PERISTIWA",
                   ["seluruh anak <PW> dilahirkan dari perkawinan yang sah dengan pasangannya", "semua anak <PW> lahir dalam perkawinan yang sah dengan pasangannya"],
                   ["ada anak <PW> yang lahir di luar perkawinan yang sah dengan pasangannya", "di antara anak <PW> terdapat anak yang lahir di luar perkawinan yang sah dengan pasangannya"])),
       susunanAhliWaris="ada-anak")

tambah(Q("q-paw-anak-luar-tidak", "pp-paw-nasab-anak", 83, "jarang", "pokok",
         "Apakah <PW> mempunyai anak yang lahir di luar perkawinan yang sah?",
         hal="anak pewaris yang lahir di luar perkawinan", ringkas="ada tidaknya anak <PW> yang lahir di luar perkawinan yang sah",
         teks_varian=["Apakah <PW> mempunyai anak dari hubungan di luar perkawinan yang sah?"],
         melihat=["<PW> tidak mempunyai anak yang lahir di luar perkawinan yang sah",
                  "sampai wafat <PW> tidak mempunyai anak dari hubungan di luar perkawinan yang sah",
                  "tidak ada anak <PW> yang lahir di luar perkawinan yang sah",
                  "semasa hidupnya <PW> tidak pernah mempunyai anak di luar perkawinan yang sah"],
         berbeda=B("peristiwa", "versi A: tidak ada anak di luar perkawinan; versi B: ada - berselisih pada PERISTIWA",
                   ["<PW> tidak mempunyai anak yang lahir di luar perkawinan yang sah", "tidak ada anak <PW> yang lahir di luar perkawinan yang sah"],
                   ["<PW> mempunyai anak yang lahir di luar perkawinan yang sah", "ada anak <PW> yang lahir di luar perkawinan yang sah"])),
       anakLuarNikah="tidak-ada")

tambah(Q("q-paw-anak-luar-ada", "pp-paw-nasab-anak", 84, "inti", "pokok",
         "Siapa anak <PW> yang lahir di luar perkawinan yang sah dan siapa ibunya?",
         hal="anak pewaris yang lahir di luar perkawinan dan ibunya", ringkas="anak <PW> yang lahir di luar perkawinan yang sah dan ibunya",
         teks_varian=["Adakah anak <PW> dari hubungan di luar perkawinan yang sah? Siapa ibunya?"],
         melihat=["<PW> mempunyai anak bernama ... yang lahir di luar perkawinan yang sah dan ibunya bernama ... yaitu perempuan yang melahirkannya",
                  "anak <PW> yang lahir di luar perkawinan yang sah bernama ... dengan ibu bernama ... yaitu perempuan yang melahirkannya",
                  "di luar perkawinan yang sah <PW> mempunyai anak bernama ... yang ibunya bernama ... yaitu perempuan yang melahirkannya",
                  "selain anak dari perkawinan yang sah <PW> mempunyai anak bernama ... dari ibu bernama ... yaitu perempuan yang melahirkannya"],
         sebagian=["<PW> mempunyai anak bernama ... yang lahir di luar perkawinan yang sah", "anak <PW> di luar perkawinan yang sah bernama ... menurut yang saya ketahui"],
         berbeda=B("peristiwa", "versi A: anak lahir di luar perkawinan; versi B: anak lahir dalam perkawinan sah - berselisih pada PERISTIWA",
                   ["<PW> mempunyai anak bernama ... yang lahir di luar perkawinan yang sah dan ibunya bernama ... yaitu perempuan yang melahirkannya", "anak <PW> yang lahir di luar perkawinan yang sah bernama ... dengan ibu bernama ... yaitu perempuan yang melahirkannya"],
                   ["<PW> mempunyai anak bernama ... yang lahir dari perkawinan yang sah dengan ibu bernama ... yaitu perempuan yang melahirkannya", "anak <PW> bernama ... lahir dalam perkawinan yang sah dari ibu bernama ... yaitu perempuan yang melahirkannya"])),
       anakLuarNikah="ada")

tambah(Q("q-paw-belum-dewasa-tidak", "pp-paw-nasab-anak", 106, "jarang", "pokok",
         "Apakah ada ahli waris <PW> yang belum dewasa atau berada di bawah pengampuan?",
         hal="ahli waris yang belum dewasa atau diampu", ringkas="ada tidaknya ahli waris <PW> yang belum dewasa atau diampu",
         teks_varian=["Adakah ahli waris <PW> yang masih anak-anak atau tidak cakap bertindak?"],
         melihat=["tidak ada ahli waris <PW> yang masih anak-anak atau berada di bawah pengampuan",
                  "semua ahli waris <PW> sudah dewasa dan tidak ada yang berada di bawah pengampuan",
                  "tidak seorang pun ahli waris <PW> yang masih anak-anak atau diampu orang lain",
                  "seluruh ahli waris <PW> telah dewasa dan tidak memerlukan wali atau pengampu"],
         berbeda=B("peristiwa", "versi A: semua ahli waris dewasa; versi B: ada yang belum dewasa atau diampu - berselisih pada PERISTIWA",
                   ["tidak ada ahli waris <PW> yang masih anak-anak atau berada di bawah pengampuan", "semua ahli waris <PW> sudah dewasa dan tidak ada yang berada di bawah pengampuan"],
                   ["ada ahli waris <PW> yang belum dewasa atau berada di bawah pengampuan", "di antara ahli waris <PW> terdapat yang belum dewasa dan memerlukan wali"])),
       ahliWarisBelumDewasa="tidak-ada")

tambah(Q("q-paw-belum-dewasa-ada", "pp-paw-nasab-anak", 107, "inti", "pokok",
         "Siapa ahli waris <PW> yang belum dewasa atau berada di bawah pengampuan dan siapa walinya?",
         hal="ahli waris yang belum dewasa atau diampu dan walinya", ringkas="ahli waris <PW> yang belum dewasa atau diampu dan walinya",
         teks_varian=["Siapa wali dari ahli waris <PW> yang belum dewasa atau diampu?"],
         melihat=["ahli waris <PW> yang belum dewasa atau diampu bernama ... dan diwakili oleh walinya yaitu ... dalam perkara ini",
                  "di antara ahli waris <PW> ada yang belum dewasa atau di bawah pengampuan yaitu ... yang diwakili oleh ... dalam perkara ini",
                  "ahli waris <PW> bernama ... belum dewasa atau diampu dan walinya adalah ... dalam perkara ini",
                  "yang belum dewasa atau diampu dari ahli waris <PW> adalah ... dengan wali yang bernama ... dalam perkara ini"],
         sebagian=["ada ahli waris <PW> yang belum dewasa yaitu ... dalam perkara ini", "salah satu ahli waris <PW> yang belum dewasa dan diampu bernama ... dalam perkara ini"],
         berbeda=B("peristiwa", "versi A: ada ahli waris belum dewasa atau diampu; versi B: sebenarnya sudah dewasa - berselisih pada PERISTIWA",
                   ["ahli waris <PW> yang belum dewasa atau diampu bernama ... dan diwakili oleh walinya yaitu ... dalam perkara ini", "di antara ahli waris <PW> ada yang belum dewasa atau di bawah pengampuan yaitu ... yang diwakili oleh ... dalam perkara ini"],
                   ["ahli waris <PW> bernama ... sebenarnya sudah dewasa dan tidak diampu siapa pun", "ahli waris <PW> yang bernama ... telah dewasa serta tidak memiliki wali"])),
       ahliWarisBelumDewasa="ada")

tambah(Q("q-paw-saudara-sekandung", "pp-paw-susunan", 88, "pilihan", "pokok",
         "Apakah saudara <PW> itu saudara kandung (seayah dan seibu), seayah saja, atau seibu saja?",
         hal="jenis hubungan saudara dengan pewaris", ringkas="hubungan saudara <PW> sebagai saudara kandung, seayah atau seibu",
         teks_varian=["Apakah saudara <PW> berasal dari ayah dan ibu yang sama?"],
         melihat=["saudara <PW> yang bernama ... adalah saudara kandung yang seayah dan seibu dengannya",
                  "saudara <PW> bernama ... satu ayah dan satu ibu dengannya",
                  "saudara <PW> yang disebut ... lahir dari ayah dan ibu yang sama dengannya",
                  "hubungan saudara <PW> yang bernama ... adalah saudara sekandung seayah dan seibu"],
         sebagian=["saudara <PW> yang bernama ... seayah dengannya", "saudara <PW> bernama ... seibu dengannya"],
         berbeda=B("peristiwa", "versi A: saudara kandung seayah seibu; versi B: hanya seayah atau hanya seibu - berselisih pada PERISTIWA",
                   ["saudara <PW> yang bernama ... adalah saudara kandung yang seayah dan seibu dengannya", "saudara <PW> bernama ... satu ayah dan satu ibu dengannya"],
                   ["saudara <PW> yang bernama ... hanya seayah saja dengannya", "saudara <PW> bernama ... hanya seibu saja dengannya"])),
       susunanAhliWaris="tanpa-anak")

tambah(Q("q-paw-saudara-meninggal", "pp-paw-pengganti", 92, "pilihan", "pokok",
         "Apakah ada saudara <PW> yang meninggal lebih dahulu dan meninggalkan anak?",
         hal="saudara pewaris yang meninggal lebih dahulu", ringkas="saudara <PW> yang meninggal lebih dahulu dan anaknya",
         teks_varian=["Adakah saudara <PW> yang sudah meninggal lebih dahulu dan mempunyai anak?"],
         melihat=["saudara <PW> bernama ... telah meninggal dunia lebih dahulu dan meninggalkan anak bernama ... sebagai keturunannya",
                  "sebelum <PW> wafat saudaranya bernama ... sudah meninggal lebih dahulu dan meninggalkan anak bernama ... sebagai keturunannya",
                  "salah seorang saudara <PW> yaitu ... wafat terlebih dahulu dengan meninggalkan anak bernama ... sebagai keturunannya",
                  "saudara <PW> yang bernama ... lebih awal meninggal dunia dan meninggalkan anak bernama ... sebagai keturunannya"],
         sebagian=["saudara <PW> bernama ... telah meninggal dunia lebih dahulu", "salah seorang saudara <PW> yaitu ... wafat terlebih dahulu"],
         berbeda=B("peristiwa", "versi A: saudara meninggal lebih dahulu dengan meninggalkan anak; versi B: tanpa anak - berselisih pada PERISTIWA",
                   ["saudara <PW> bernama ... telah meninggal dunia lebih dahulu dan meninggalkan anak bernama ... sebagai keturunannya", "sebelum <PW> wafat saudaranya bernama ... sudah meninggal lebih dahulu dan meninggalkan anak bernama ... sebagai keturunannya"],
                   ["saudara <PW> bernama ... meninggal dunia lebih dahulu tetapi tidak meninggalkan anak", "sebelum <PW> wafat saudaranya bernama ... sudah meninggal lebih dahulu dan tidak punya anak"])),
       susunanAhliWaris="tanpa-anak", ahliWarisPengganti="ada")

# --- agama dan penghalang
tambah(Q("q-paw-beda-agama-tidak", "pp-paw-agama", 136, "pilihan", "pokok",
         "Apakah ada anggota keluarga <PW> yang menjadi ahli waris tetapi tidak beragama Islam?",
         hal="agama ahli waris dan kerabat pewaris", ringkas="agama ahli waris dan kerabat <PW>",
         teks_varian=["Apakah semua ahli waris <PW> beragama Islam?"],
         melihat=["dalam keluarga <PW> #4511#",
                  "di lingkungan keluarga <PW> #4511#",
                  "pada keluarga <PW> #4511#",
                  "untuk keluarga <PW> yang saya kenal #4511#"],
         berbeda=B("peristiwa", "versi A: semua ahli waris beragama Islam; versi B: ada yang beragama lain - berselisih pada PERISTIWA",
                   ["dalam keluarga <PW> #4511#", "di lingkungan keluarga <PW> #4511#"],
                   ["di keluarga <PW> ada ahli waris yang tidak beragama Islam", "salah seorang ahli waris <PW> tidak beragama Islam"])),
       bedaAgama="tidak-ada")

tambah(Q("q-paw-beda-agama-ada", "pp-paw-agama", 137, "inti", "pokok",
         "Siapa anggota keluarga <PW> yang tidak beragama Islam dan apa hubungannya dengan <PW>?",
         hal="kerabat pewaris yang tidak beragama Islam", ringkas="kerabat <PW> yang tidak beragama Islam",
         teks_varian=["Adakah kerabat <PW> yang beragama selain Islam? Siapa dan apa hubungannya dengan <PW>?"],
         melihat=["kerabat <PW> yang tidak beragama Islam adalah #4510#",
                  "di antara keluarga <PW> yang tidak beragama Islam yaitu #4510#",
                  "#4510# sebagai keluarga <PW> tidak beragama Islam",
                  "anggota keluarga <PW> yang tidak beragama Islam adalah #4510#"],
         sebagian=["salah satu kerabat <PW> yang tidak beragama Islam adalah #4510#", "kerabat <PW> yang tidak beragama Islam di antaranya #4510#"],
         berbeda=B("peristiwa", "versi A: ada kerabat yang tidak beragama Islam; versi B: semua beragama Islam - berselisih pada PERISTIWA",
                   ["kerabat <PW> yang tidak beragama Islam adalah #4510#", "di antara keluarga <PW> yang tidak beragama Islam yaitu #4510#"],
                   ["semua kerabat <PW> yang saya ketahui beragama Islam", "seluruh kerabat <PW> yang saya kenal beragama Islam"])),
       bedaAgama="ada")

tambah(Q("q-paw-fitnah", "pp-paw-halangan", 42, "jarang", "pokok",
         "Apakah ada ahli waris yang pernah dihukum karena memfitnah <PW> melakukan kejahatan berat?",
         hal="ada tidaknya ahli waris yang dihukum karena memfitnah pewaris", ringkas="ada tidaknya ahli waris yang dihukum karena memfitnah <PW>",
         teks_varian=["Pernahkah ada ahli waris yang dihukum karena fitnah terhadap <PW>?"],
         melihat=["tidak ada ahli waris yang pernah dihukum karena memfitnah <PW> melakukan kejahatan yang diancam pidana lima tahun atau lebih",
                  "tidak pernah ada putusan hakim yang menghukum salah seorang ahli waris karena memfitnah <PW> dengan kejahatan berat",
                  "tidak seorang pun ahli waris pernah dihukum karena memfitnah <PW> melakukan kejahatan berat",
                  "sepanjang yang saya ketahui tidak ada ahli waris yang dihukum atas fitnah terhadap <PW>"],
         berbeda=B("peristiwa", "versi A: tidak ada ahli waris yang dihukum karena fitnah; versi B: ada - berselisih pada PERISTIWA",
                   ["tidak ada ahli waris yang pernah dihukum karena memfitnah <PW> melakukan kejahatan yang diancam pidana lima tahun atau lebih", "tidak seorang pun ahli waris pernah dihukum karena memfitnah <PW> melakukan kejahatan berat"],
                   ["ada ahli waris yang pernah dihukum karena memfitnah <PW> melakukan kejahatan berat", "salah seorang ahli waris pernah dihukum karena memfitnah <PW>"])))

# --- harta peninggalan
tambah(Q("q-paw-harta", "pp-paw-harta", 143, "inti", "pokok",
         "Apa saja harta yang ditinggalkan <PW>?",
         hal="harta peninggalan pewaris", ringkas="harta peninggalan <PW>",
         teks_varian=["Harta atau dana apa yang ditinggalkan <PW> ketika meninggal dunia?"],
         melihat=["<PW> meninggalkan harta peninggalan berupa #8614#",
                  "harta yang ditinggalkan <PW> berupa #8614#",
                  "sesudah <PW> meninggal dunia tinggal harta peninggalan berupa #8614#",
                  "peninggalan <PW> yang saya ketahui adalah #8614#"],
         sebagian=["<PW> meninggalkan harta peninggalan di antaranya #8614#", "di antara peninggalan <PW> terdapat #8614#"],
         berbeda=B("peristiwa", "versi A: harta sesuai isian perkara; versi B: harta lain - berselisih pada PERISTIWA",
                   ["<PW> meninggalkan harta peninggalan berupa #8614#", "harta yang ditinggalkan <PW> berupa #8614#"],
                   ["<PW> meninggalkan harta peninggalan yang berbeda dari #8614#", "harta yang ditinggalkan <PW> berlainan dengan #8614#"])))

tambah(Q("q-paw-harta-atas-nama", "pp-paw-harta", 146, "jarang", "pokok",
         "Atas nama siapa harta atau dana itu tercatat?",
         hal="nama pemilik tercatat atas harta atau dana peninggalan", ringkas="nama pemilik tercatat atas harta atau dana peninggalan <PW>",
         teks_varian=["Harta atau dana itu terdaftar atas nama siapa?"],
         melihat=["harta atau dana berupa #8614# tercatat atas nama <PW> sendiri",
                  "#8614# adalah hak <PW> yang tercatat atas namanya",
                  "yang tercatat atas nama <PW> adalah #8614#",
                  "atas nama <PW> terdaftar #8614#"],
         berbeda=B("peristiwa", "versi A: tercatat atas nama pewaris; versi B: atas nama orang lain - berselisih pada PERISTIWA",
                   ["harta atau dana berupa #8614# tercatat atas nama <PW> sendiri", "yang tercatat atas nama <PW> adalah #8614#"],
                   ["harta atau dana berupa #8614# tercatat atas nama orang lain bukan <PW>", "atas nama orang lain bukan <PW> terdaftar #8614#"])),
       asalHarta="dana-hak-pewaris")

tambah(Q("q-paw-harta-perkawinan", "pp-paw-harta", 147, "pilihan", "pokok",
         "Kapan harta itu diperoleh, apakah selama perkawinan <PW>?",
         hal="saat perolehan harta peninggalan", ringkas="saat perolehan harta peninggalan <PW>",
         teks_varian=["Apakah harta itu diperoleh <PW> selama ia terikat perkawinan?"],
         melihat=["harta berupa #8614# diperoleh <PW> selama perkawinannya",
                  "#8614# didapat <PW> sepanjang masa perkawinannya",
                  "selama <PW> menikah diperoleh harta berupa #8614#",
                  "harta peninggalan berupa #8614# dikumpulkan <PW> ketika masih terikat perkawinan"],
         berbeda=B("peristiwa", "versi A: diperoleh selama perkawinan; versi B: sebelum menikah - berselisih pada PERISTIWA",
                   ["harta berupa #8614# diperoleh <PW> selama perkawinannya", "#8614# didapat <PW> sepanjang masa perkawinannya"],
                   ["harta berupa #8614# diperoleh <PW> sebelum menikah", "#8614# sudah dimiliki <PW> sebelum perkawinannya"])),
       asalHarta="selama-perkawinan")

tambah(Q("q-paw-harta-bawaan", "pp-paw-harta", 148, "pilihan", "pokok",
         "Apakah harta itu bawaan atau milik <PW> sendiri?",
         hal="harta bawaan pewaris", ringkas="harta bawaan atau milik <PW> sendiri",
         teks_varian=["Apakah harta itu milik <PW> sendiri sebelum menikah?"],
         melihat=["harta berupa #8614# adalah harta bawaan <PW> sendiri",
                  "#8614# merupakan harta <PW> sendiri sebelum perkawinannya",
                  "harta bawaan <PW> adalah #8614#",
                  "<PW> memperoleh #8614# sebelum menikah sebagai miliknya sendiri"],
         berbeda=B("peristiwa", "versi A: harta bawaan; versi B: diperoleh bersama pasangan - berselisih pada PERISTIWA",
                   ["harta berupa #8614# adalah harta bawaan <PW> sendiri", "#8614# merupakan harta <PW> sendiri sebelum perkawinannya"],
                   ["harta berupa #8614# diperoleh <PW> bersama pasangannya selama perkawinan", "#8614# adalah harta yang dikumpulkan <PW> bersama pasangannya"])),
       asalHarta="bawaan")

# --- wasiat dan hutang
tambah(Q("q-paw-wasiat", "pp-paw-wasiat-hutang", 150, "inti", "pokok",
         "Apakah <PW> meninggalkan wasiat?",
         hal="ada tidaknya wasiat pewaris", ringkas="ada tidaknya wasiat <PW>",
         teks_varian=["Apakah <PW> pernah berwasiat sebelum meninggal dunia?"],
         melihat=["<PW> #4508#",
                  "ketika wafat <PW> #4508#",
                  "hingga meninggal dunia <PW> #4508#",
                  "pada saat wafat <PW> #4508#"],
         berbeda=B("peristiwa", "versi A: sesuai isian wasiat perkara; versi B: ada wasiat kepada orang lain - berselisih pada PERISTIWA",
                   ["<PW> #4508#", "ketika wafat <PW> #4508#"],
                   ["<PW> meninggalkan wasiat berupa pemberian benda kepada orang lain", "ketika wafat <PW> meninggalkan wasiat untuk seseorang"])))

tambah(Q("q-paw-hutang-tidak", "pp-paw-wasiat-hutang", 152, "jarang", "pokok",
         "Apakah <PW> meninggalkan hutang atau kewajiban yang belum dilunasi?",
         hal="ada tidaknya hutang pewaris", ringkas="ada tidaknya hutang <PW> yang belum dilunasi",
         teks_varian=["Adakah hutang <PW> yang masih harus dibayar ketika ia meninggal dunia?"],
         melihat=["<PW> tidak meninggalkan hutang atau kewajiban yang masih harus dilunasi",
                  "sampai wafat <PW> tidak mempunyai hutang yang masih harus dibayar",
                  "tidak ada hutang <PW> yang tersisa ketika ia meninggal dunia",
                  "semua kewajiban <PW> telah selesai dan tidak ada tanggungan yang tersisa"],
         berbeda=B("peristiwa", "versi A: tidak ada hutang; versi B: ada hutang - berselisih pada PERISTIWA",
                   ["<PW> tidak meninggalkan hutang atau kewajiban yang masih harus dilunasi", "sampai wafat <PW> tidak mempunyai hutang yang masih harus dibayar"],
                   ["<PW> meninggalkan hutang yang masih harus dilunasi", "ketika wafat <PW> masih mempunyai hutang yang harus dibayar"])),
       hutang="tidak-ada")

tambah(Q("q-paw-hutang-ada", "pp-paw-wasiat-hutang", 153, "inti", "pokok",
         "Hutang atau kewajiban apa yang ditinggalkan <PW> dan kepada siapa?",
         hal="hutang pewaris yang belum dilunasi", ringkas="hutang <PW> yang belum dilunasi",
         teks_varian=["Berapa dan kepada siapa hutang <PW> yang belum dilunasi?"],
         melihat=["<PW> meninggalkan hutang berupa ... kepada ... yang belum dilunasi",
                  "hutang <PW> yang belum dilunasi adalah ... kepada ... hingga ia wafat",
                  "ketika wafat <PW> masih berhutang ... kepada ... yang belum dibayar",
                  "kewajiban <PW> yang tersisa berupa hutang ... kepada ... dan belum dilunasi"],
         sebagian=["<PW> meninggalkan hutang berupa ... yang belum dilunasi", "hutang <PW> yang saya ketahui adalah ... yang belum dibayar"],
         berbeda=B("peristiwa", "versi A: hutang belum dilunasi; versi B: hutang sudah dilunasi - berselisih pada PERISTIWA",
                   ["<PW> meninggalkan hutang berupa ... kepada ... yang belum dilunasi", "hutang <PW> yang belum dilunasi adalah ... kepada ... hingga ia wafat"],
                   ["<PW> telah melunasi hutang berupa ... kepada ... sebelum wafat", "sebelum meninggal dunia <PW> sudah membayar lunas hutang ... kepada ..."])),
       hutang="ada")

# --- tidak ada sengketa, kuasa, tujuan, kesepakatan bagian
tambah(Q("q-paw-tanpa-sengketa", "pp-paw-tanpa-sengketa", 160, "inti", "pokok",
         "Apakah ada perselisihan atau keberatan di antara para ahli waris mengenai permohonan ini?",
         hal="ada tidaknya sengketa antar ahli waris", ringkas="ada tidaknya sengketa antar ahli waris atas permohonan <PM>",
         teks_varian=["Adakah ahli waris yang berkeberatan terhadap permohonan ini?"],
         melihat=["tidak ada perselisihan atau keberatan dari ahli waris mana pun terhadap permohonan <PM>",
                  "semua ahli waris setuju dengan permohonan <PM> dan tidak ada yang berkeberatan",
                  "permohonan <PM> tidak dipersoalkan oleh ahli waris yang lain",
                  "tidak ada sengketa di antara para ahli waris mengenai permohonan <PM>"],
         sebagian=["permohonan <PM> tidak dipersoalkan oleh ahli waris yang saya kenal", "tidak ada ahli waris yang saya tahu berkeberatan atas permohonan <PM>"],
         berbeda=B("peristiwa", "versi A: tidak ada sengketa; versi B: ada ahli waris yang berkeberatan - berselisih pada PERISTIWA",
                   ["tidak ada perselisihan atau keberatan dari ahli waris mana pun terhadap permohonan <PM>", "semua ahli waris setuju dengan permohonan <PM> dan tidak ada yang berkeberatan"],
                   ["ada ahli waris yang berkeberatan terhadap permohonan <PM>", "sebagian ahli waris mempersoalkan permohonan <PM>"])))

tambah(Q("q-paw-ahli-lain-setuju", "pp-paw-ahli-lain", 104, "jarang", "pokok",
         "Apakah ahli waris yang tidak ikut menjadi pemohon mengetahui dan menyetujui permohonan ini?",
         hal="persetujuan ahli waris yang tidak ikut menjadi pemohon", ringkas="persetujuan ahli waris yang tidak ikut menjadi <PM>",
         teks_varian=["Apakah ahli waris lain yang tidak ikut mengajukan permohonan sudah menyetujuinya?"],
         melihat=["ahli waris yang tidak ikut menjadi <PM> sudah mengetahui dan menyetujui permohonan ini",
                  "ahli waris lain yang tidak ikut sebagai <PM> telah menyetujui dan memberi kuasa",
                  "ahli waris yang tidak hadir bersama <PM> sudah diberi tahu dan menyetujui permohonan ini",
                  "ahli waris lain yang tidak ikut mengajukan permohonan bersama <PM> sudah setuju"],
         berbeda=B("peristiwa", "versi A: ahli waris lain sudah setuju; versi B: belum mengetahui atau menyetujui - berselisih pada PERISTIWA",
                   ["ahli waris yang tidak ikut menjadi <PM> sudah mengetahui dan menyetujui permohonan ini", "ahli waris lain yang tidak ikut sebagai <PM> telah menyetujui dan memberi kuasa"],
                   ["ahli waris yang tidak ikut menjadi <PM> belum mengetahui permohonan ini", "ahli waris lain yang tidak ikut sebagai <PM> belum memberi persetujuan"])),
       ahliWarisLainTidakIkut="ada")

tambah(Q("q-paw-tujuan-dana", "pp-paw-keperluan", 141, "inti", "pokok",
         "Dana apa yang hendak dicairkan <PM> dan di mana?",
         hal="dana yang hendak dicairkan", ringkas="dana yang hendak dicairkan <PM>",
         teks_varian=["Dana apa yang diurus <PM> dengan penetapan ahli waris ini?"],
         melihat=["<PM> memerlukan penetapan ahli waris untuk mengurus pencairan #9700# milik pewaris",
                  "dana yang hendak dicairkan <PM> adalah #9700#",
                  "<PM> akan mencairkan #9700# setelah ada penetapan ahli waris",
                  "penetapan ahli waris dibutuhkan <PM> agar dapat mencairkan #9700#"],
         berbeda=B("peristiwa", "versi A: dana sesuai isian perkara; versi B: dana lain - berselisih pada PERISTIWA",
                   ["<PM> memerlukan penetapan ahli waris untuk mengurus pencairan #9700# milik pewaris", "dana yang hendak dicairkan <PM> adalah #9700#"],
                   ["<PM> hendak mencairkan dana yang berbeda dari #9700#", "dana yang akan dicairkan <PM> berlainan dengan #9700#"])),
       tujuanPermohonan="pencairan-dana")

tambah(Q("q-paw-tujuan-tanah", "pp-paw-keperluan", 142, "inti", "pokok",
         "Untuk apa <PM> memerlukan penetapan ahli waris atas tanah atau harta peninggalan itu?",
         hal="keperluan penetapan ahli waris atas tanah atau harta peninggalan", ringkas="keperluan <PM> atas tanah atau harta peninggalan",
         teks_varian=["Apa keperluan <PM> meminta penetapan ahli waris atas tanah atau harta itu?"],
         melihat=["<PM> memerlukan penetapan ahli waris untuk #4501#",
                  "penetapan ahli waris dibutuhkan <PM> untuk #4501#",
                  "tujuan <PM> meminta penetapan ahli waris adalah untuk #4501#",
                  "<PM> memohon penetapan ahli waris untuk keperluan yaitu #4501#"],
         berbeda=B("peristiwa", "versi A: keperluan sesuai isian perkara; versi B: keperluan lain - berselisih pada PERISTIWA",
                   ["<PM> memerlukan penetapan ahli waris untuk #4501#", "penetapan ahli waris dibutuhkan <PM> untuk #4501#"],
                   ["<PM> memerlukan penetapan ahli waris untuk keperluan lain selain #4501#", "penetapan ahli waris dibutuhkan <PM> untuk keperluan yang berlainan dengan #4501#"])),
       tujuanPermohonan="tanah-aset")

tambah(Q("q-paw-sepakat-bagian", "pp-paw-tanpa-sengketa", 162, "pilihan", "pokok",
         "Apakah para ahli waris sudah sepakat tentang bagian masing-masing atas harta peninggalan <PW>?",
         hal="kesepakatan ahli waris tentang bagian masing-masing", ringkas="kesepakatan ahli waris tentang bagian atas harta peninggalan <PW>",
         teks_varian=["Apakah para ahli waris sudah bermusyawarah tentang pembagian harta peninggalan <PW>?"],
         melihat=["para ahli waris telah bermusyawarah dan sepakat tentang bagian masing-masing atas harta peninggalan <PW>",
                  "seluruh ahli waris sudah menyetujui pembagian harta peninggalan <PW> menurut bagian masing-masing",
                  "mengenai bagian harta peninggalan <PW> para ahli waris sudah mencapai kesepakatan",
                  "bagian masing-masing ahli waris atas harta peninggalan <PW> telah disepakati bersama"],
         berbeda=B("peristiwa", "versi A: sudah sepakat; versi B: belum sepakat - berselisih pada PERISTIWA",
                   ["para ahli waris telah bermusyawarah dan sepakat tentang bagian masing-masing atas harta peninggalan <PW>", "seluruh ahli waris sudah menyetujui pembagian harta peninggalan <PW> menurut bagian masing-masing"],
                   ["para ahli waris belum sepakat tentang bagian masing-masing atas harta peninggalan <PW>", "belum ada kesepakatan di antara ahli waris mengenai bagian harta peninggalan <PW>"])),
       bagianDiminta="ya")

for q in SEMUA:
    periksa_inti(q)


def bangun(v1):
    kat = copy.deepcopy(v1)
    kat["versi"] = 2
    ids_lama = {p["id"] for p in kat["pertanyaan"]}
    # pembaruan butir lama (alasan di CATATAN_PERUBAHAN)
    for p in kat["pertanyaan"]:
        if p["id"] == "q-paw-keperluan":
            s = json.dumps(p, ensure_ascii=False).replace("#8171#", "#4501#")
            p.clear()
            p.update(json.loads(s))
            p["variabelAbt"] = sorted((set(p["variabelAbt"]) - {"8171"}) | {"4501"})
        if p["id"] in ("q-paw-menikah",):
            p["keadaan"] = dict(p.get("keadaan") or {}, **{"bukan:statusPasangan": ["bercerai", "meninggal-lebih-dahulu"]})
        if p["id"] in ("q-paw-bercerai",):
            p["keadaan"] = dict(p.get("keadaan") or {}, **{"bukan:statusPasangan": ["bercerai"]})
    for d in DASAR_BARU:
        assert d["id"] not in {x["id"] for x in kat["dasarHukum"]}
        kat["dasarHukum"].append(d)
    kat["pokokPembuktian"].extend(POKOK_BARU)
    for k, v in KEADAAN_BARU.items():
        assert k not in kat["keadaan"], k
        kat["keadaan"][k] = v
    for q in SEMUA:
        assert q.id not in ids_lama, q.id
        kat["pertanyaan"].append(bangun_q(q, PETA))
    urut = [p["urutan"] for p in kat["pertanyaan"]]
    assert len(urut) == len(set(urut)), "urutan kembar: %s" % sorted(x for x in urut if urut.count(x) > 1)
    kat["pertanyaan"].sort(key=lambda p: p["urutan"])
    kat["catatanPetugas"] = list(kat["catatanPetugas"]) + [
        "Versi 2 (20 Okt 2026): keadaan pasangan pewaris (hidup, meninggal lebih dahulu, bercerai, berpisah), lebih dari seorang istri, anak di luar perkawinan, ahli waris belum dewasa atau diampu, kerabat tidak beragama Islam, harta peninggalan dan asalnya, wasiat, hutang, tidak ada sengketa, tujuan permohonan dan kesepakatan bagian (P3HP) ditambahkan; semua butir versi 1 dipertahankan.",
        "Pilihan keadaan pada layar menentukan butir yang tampil; jawaban 'berbeda' dan jawaban yang memuat titik-titik hanya kerangka: sesuaikan dengan keterangan saksi yang sesungguhnya.",
        "Bagian masing-masing ahli waris (faraid) bukan keterangan saksi: usulan hitungan ada di isian hakim (variabel 4515) dan selalu 'ragu - periksa'.",
    ]
    # variabel yang dipakai butir baru dan tidak ada di kamus lama dideklarasikan sebagai variabelBaru
    kat["variabelBaru"] = ["4501", "4508", "4510", "4511", "9700"]
    return kat


if __name__ == "__main__":
    v1 = json.load(open(sys.argv[1], encoding="utf8"))
    kat = bangun(v1)
    json.dump(kat, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("pertanyaan %d -> %d, pokok %d -> %d" % (len(v1["pertanyaan"]), len(kat["pertanyaan"]), len(v1["pokokPembuktian"]), len(kat["pokokPembuktian"])))
