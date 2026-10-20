# -*- coding: utf-8 -*-
"""
Katalog saksi "kewarisan" versi 2 (agen W2a-K1, 21 Okt 2026): menambah pokok, pertanyaan, keadaan, dasar hukum dan profil pengetahuan
saksi tanpa menghapus apa pun dari versi 1. Dibangun dari salinan versi 1 (../katalog-v1/kewarisan.json).
Pakai: python waris_v2.py <katalog-v1.json> <keluar.json>
"""
import copy, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kb import Berkas, bangun_q, selesai  # noqa: E402
import waris_1, waris_2, waris_3  # noqa: E402

PETA = {"_g": "x", "PM": "#0046#", "TG": "#0047#", "W": "#2026# #1025#"}
B = Berkas(PETA)
waris_1.isi(B)
waris_2.isi(B)
waris_3.isi(B)
selesai()

SUMBER_KHI = "KHI lampiran Inpres 1/1991: bunyi dicocokkan antara digitalisasi pasal.id dan naskah Depag (referensi/KHI-pasal-terverifikasi.md, VERIFIKASI-HUKUM 18 Okt 2026)"
SUMBER_BELUM = "belum ada naskah resmi berupa teks pada referensi; tidak dicetak pada keluaran (rujukan-k1.md)"

DASAR_BARU = [
    dict(id="dh-khi-171efh", rujukan="Pasal 171 huruf e, f dan h Kompilasi Hukum Islam", uraian="harta warisan adalah harta bawaan ditambah bagian dari harta bersama setelah dikurangi keperluan pewaris selama sakit, biaya pengurusan jenazah, hutang dan pemberian untuk kerabat; wasiat adalah pemberian benda yang berlaku setelah pewaris meninggal; anak angkat adalah anak yang pemeliharaan dan biaya pendidikannya beralih kepada orang tua angkat berdasarkan putusan Pengadilan", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-100", rujukan="Pasal 100 Kompilasi Hukum Islam", uraian="anak yang lahir di luar perkawinan hanya mempunyai hubungan nasab dengan ibunya dan keluarga ibunya", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-185", rujukan="Pasal 185 ayat (1) Kompilasi Hukum Islam", uraian="ahli waris yang meninggal lebih dahulu daripada pewaris kedudukannya dapat digantikan oleh anaknya, kecuali mereka yang tersebut dalam Pasal 173", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-188", rujukan="Pasal 188 Kompilasi Hukum Islam", uraian="para ahli waris, bersama-sama atau perseorangan, dapat meminta ahli waris lainnya untuk membagi harta warisan", status="perlu-verifikasi", sumber=SUMBER_BELUM),
    dict(id="dh-khi-211", rujukan="Pasal 211 Kompilasi Hukum Islam", uraian="hibah dari orang tua kepada anaknya dapat diperhitungkan sebagai warisan", status="perlu-verifikasi", sumber=SUMBER_BELUM),
    dict(id="dh-khi-94-waris", rujukan="Pasal 94 Kompilasi Hukum Islam", uraian="harta bersama dari perkawinan seorang suami yang beristri lebih dari seorang masing-masing terpisah dan berdiri sendiri", status="perlu-verifikasi", sumber=SUMBER_BELUM),
]

POKOK_BARU = [
    dict(id="pp-w-perkawinan-pewaris", judul="Perkawinan pewaris dan keadaan pasangannya saat pewaris meninggal", uraian="pasangan pewaris masih hidup, meninggal lebih dahulu, bercerai, atau berpisah tanpa bercerai, dan ada tidaknya lebih dari seorang istri", dasarHukum=["dh-khi-171c", "dh-khi-174", "dh-khi-94-waris"], wajib=False),
    dict(id="pp-w-penghalang", judul="Penghalang dan syarat sebagai ahli waris", uraian="nasab anak, anak angkat, ahli waris belum dewasa, kerabat beda agama, dan ahli waris yang terhalang karena putusan pengadilan", dasarHukum=["dh-khi-171c", "dh-khi-173", "dh-khi-100", "dh-khi-171efh"], wajib=False),
    dict(id="pp-w-nilai", judul="Nilai harta peninggalan", uraian="nilai seluruh harta peninggalan dan masing-masing objek serta kemungkinan dibagi nyata", dasarHukum=["dh-rbg-283"], wajib=False),
    dict(id="pp-w-bagian", judul="Pembagian warisan dan bagian ahli waris", uraian="kesepakatan membagi menurut hukum waris Islam, cara pembagian, dan surat keterangan ahli waris; besar bagian ditetapkan hakim menurut hukum", dasarHukum=["dh-khi-176-182", "dh-khi-188"], wajib=False),
]

TAMBAH_DASAR_POKOK = {
    "pp-tirkah": ["dh-khi-171efh"],
    "pp-utang-wasiat": ["dh-khi-171efh", "dh-khi-211"],
    "pp-ahli-waris-khusus": ["dh-khi-185"],
}

LABEL_ASAL = {"pribadi": "Harta pribadi atau bawaan pewaris", "bersama-pasangan": "Harta bersama pewaris dengan pasangannya", "warisan-leluhur": "Warisan leluhur pewaris yang belum dibagi"}


def dua(label, ya, tidak="tidak-ada", lab_ya="Ada", lab_tidak="Tidak ada"):
    return dict(sumber="borang", nilai=[tidak, ya], bawaan=tidak, label=label, labelNilai={tidak: lab_tidak, ya: lab_ya})


KEADAAN_BARU = {
    "statusPasangan": dict(sumber="borang", nilai=["masih-hidup", "meninggal-lebih-dahulu", "bercerai", "berpisah"], bawaan="masih-hidup", label="Keadaan pasangan pewaris saat pewaris meninggal",
                           labelNilai={"masih-hidup": "Pasangan masih hidup", "meninggal-lebih-dahulu": "Pasangan meninggal lebih dahulu", "bercerai": "Sudah bercerai sebelum pewaris meninggal", "berpisah": "Berpisah tempat tinggal tetapi belum bercerai"}),
    "jumlahPasangan": dict(sumber="borang", nilai=["satu", "lebih-dari-satu"], bawaan="satu", label="Jumlah istri pewaris", labelNilai={"satu": "Seorang pasangan", "lebih-dari-satu": "Lebih dari seorang istri"}),
    "anakLuarNikah": dua("Ada anak yang lahir di luar perkawinan yang sah", "ada"),
    "anakAngkat": dua("Pewaris mempunyai anak angkat", "ada"),
    "ahliWarisBelumDewasa": dua("Ada ahli waris yang belum dewasa atau diampu", "ada"),
    "ahliWarisBukanPihak": dua("Ada ahli waris yang tidak ikut menjadi pihak", "ada"),
    "bedaAgama": dua("Ada kerabat pewaris yang tidak beragama Islam", "ada"),
    "terhalang": dua("Ada ahli waris yang dihukum karena membunuh, menganiaya atau memfitnah pewaris", "ada"),
    "hutang": dua("Pewaris meninggalkan hutang", "ada"),
    "wasiat": dua("Pewaris meninggalkan wasiat", "ada"),
    "hibahSemasaHidup": dua("Pewaris menghibahkan harta kepada ahli waris semasa hidup", "ada"),
    "kesepakatan": dua("Pernah ada kesepakatan pembagian warisan", "ada", lab_ya="Pernah ada kesepakatan yang belum dilaksanakan", lab_tidak="Tidak pernah ada kesepakatan"),
    "suratWaris": dua("Sudah ada surat keterangan ahli waris", "ada"),
}

SEMUA = ["pp-w-perkawinan-pewaris", "pp-w-penghalang", "pp-w-nilai", "pp-w-bagian"]
PROFIL = {
    "sama": dict(label="Tahu seluruhnya, melihat dan mengalami sendiri", peta={"*": "melihat"}),
    "mendengar-sendiri": dict(label="Mendengar sendiri dari pewaris atau ahli waris, tidak melihat sendiri", peta={
        "*": "melihat", "pp-tirkah": "mendengar", "pp-ahli-waris": "mendengar", "pp-w-perkawinan-pewaris": "mendengar", "pp-utang-wasiat": "mendengar", "pp-w-penghalang": "mendengar", "pp-bantahan": "mendengar"}),
    "dari-cerita": dict(label="Tahu dari cerita keluarga atau orang lain", sumber=True, peta={
        "*": "melihat", "pp-ahli-waris": "de-auditu", "pp-w-perkawinan-pewaris": "de-auditu", "pp-w-penghalang": "de-auditu", "pp-ahli-waris-khusus": "de-auditu", "pp-tirkah": "de-auditu", "pp-penguasaan": "de-auditu",
        "pp-utang-wasiat": "de-auditu", "pp-bantahan": "de-auditu", "pp-sita": "de-auditu", "pp-w-nilai": "de-auditu"}),
    "kenal-keluarga-tidak-tahu-harta": dict(label="Kenal pewaris dan keluarganya, tidak tahu rincian harta", peta={
        "*": "tidak-tahu", "pp-saksi-formil": "melihat", "pp-pewaris": "melihat", "pp-ahli-waris": "melihat", "pp-ahli-waris-khusus": "melihat", "pp-w-perkawinan-pewaris": "melihat", "pp-w-penghalang": "melihat",
        "pp-sengketa": "sebagian", "pp-penguasaan": "sebagian"}),
    "tahu-harta-tidak-tahu-ahli-waris": dict(label="Tahu harta dan penguasaannya, tidak tahu rincian ahli waris", peta={
        "*": "melihat", "pp-ahli-waris": "tidak-tahu", "pp-ahli-waris-khusus": "tidak-tahu", "pp-w-perkawinan-pewaris": "tidak-tahu", "pp-w-penghalang": "tidak-tahu", "pp-w-bagian": "tidak-tahu"}),
    "tahu-ahli-waris-saja": dict(label="Hanya tahu siapa ahli warisnya, tidak tahu harta dan penguasaannya", peta={
        "*": "tidak-tahu", "pp-saksi-formil": "melihat", "pp-pewaris": "melihat", "pp-ahli-waris": "melihat", "pp-ahli-waris-khusus": "melihat", "pp-w-perkawinan-pewaris": "melihat", "pp-w-penghalang": "melihat"}),
    "tahu-sebagian": dict(label="Hanya tahu sebagian ahli waris dan harta", peta={
        "*": "melihat", "pp-ahli-waris": "sebagian", "pp-tirkah": "sebagian", "pp-penguasaan": "sebagian", "pp-w-nilai": "sebagian", "pp-w-penghalang": "sebagian"}),
    "hanya-tahu-meninggal": dict(label="Hanya tahu bahwa pewaris telah meninggal dunia", peta={
        "*": "tidak-tahu", "pp-saksi-formil": "melihat", "pp-pewaris": "melihat"}),
    "ragu": dict(label="Ragu dan kurang ingat", peta={"*": "ragu", "pp-saksi-formil": "melihat", "pp-pewaris": "melihat"}),
}

BANTAHAN_TAMBAH = ["ahli-waris-lain", "utang-pewaris"]

CATATAN_BARU = [
    "Versi 2 (21 Okt 2026): bukti kematian dan agama pewaris, keadaan pasangan pewaris (hidup, meninggal lebih dahulu, bercerai, berpisah), lebih dari seorang istri, nasab anak, anak di luar perkawinan, anak angkat, ahli waris belum dewasa, cucu pengganti, orang tua dan saudara, kerabat beda agama, ahli waris yang terhalang, ahli waris yang tidak ikut menjadi pihak, asal dan rincian tiap jenis harta peninggalan, hak-hak pewaris, penguasaan sepihak, pengalihan, nilai, biaya jenazah, hutang, wasiat, hibah semasa hidup, sita, pembagian dan kesepakatan ditambahkan; semua butir versi 1 dipertahankan.",
    "Pilihan keadaan pada layar menentukan butir yang tampil. Titik-titik pada jawaban ('...') adalah tempat isian yang tidak ada di gugatan: lengkapi dari keterangan saksi yang sebenarnya.",
    "Besar bagian tiap ahli waris bukan keterangan saksi: ditetapkan hakim menurut hukum waris Islam; katalog hanya membuktikan pewaris, ahli waris, harta peninggalan, dan penguasaannya.",
    "Profil pengetahuan saksi memudahkan satu pilihan per saksi; jawaban 'berbeda' dan 'ragu' tetap perlu ditinjau butir demi butir.",
]


def bangun(v1):
    kat = copy.deepcopy(v1)
    kat["versi"] = 2
    ids_lama = {p["id"] for p in kat["pertanyaan"]}
    ada_dasar = {d["id"] for d in kat["dasarHukum"]}
    for d in DASAR_BARU:
        assert d["id"] not in ada_dasar, d["id"]
        kat["dasarHukum"].append(d)
    for p in kat["pokokPembuktian"]:
        for dh in TAMBAH_DASAR_POKOK.get(p["id"], []):
            if dh not in p["dasarHukum"]:
                p["dasarHukum"].append(dh)
    ada_pokok = {p["id"] for p in kat["pokokPembuktian"]}
    for p in POKOK_BARU:
        assert p["id"] not in ada_pokok, p["id"]
        kat["pokokPembuktian"].append(p)
    k = kat["keadaan"]
    for n in BANTAHAN_TAMBAH:
        if n not in k["bantahan"]["nilai"]:
            k["bantahan"]["nilai"].append(n)
    k["asalHarta"]["labelNilai"] = dict(LABEL_ASAL)
    for kunci, v in KEADAAN_BARU.items():
        assert kunci not in k, kunci
        k[kunci] = v
    for q in B.semua:
        assert q.id not in ids_lama, q.id
        kat["pertanyaan"].append(bangun_q(q, PETA))
    urut = [p["urutan"] for p in kat["pertanyaan"]]
    assert len(urut) == len(set(urut)), "urutan kembar: %s" % sorted(x for x in set(urut) if urut.count(x) > 1)
    kat["pertanyaan"].sort(key=lambda p: p["urutan"])
    kat["profilSaksi"] = PROFIL
    kat["catatanPetugas"] = list(kat["catatanPetugas"]) + CATATAN_BARU
    return kat


if __name__ == "__main__":
    v1 = json.load(open(sys.argv[1], encoding="utf8"))
    kat = bangun(v1)
    json.dump(kat, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("pertanyaan %d -> %d, pokok %d -> %d, dasar %d -> %d, keadaan %d -> %d, profil %d" % (
        len(v1["pertanyaan"]), len(kat["pertanyaan"]), len(v1["pokokPembuktian"]), len(kat["pokokPembuktian"]),
        len(v1["dasarHukum"]), len(kat["dasarHukum"]), len(v1["keadaan"]), len(kat["keadaan"]), len(kat["profilSaksi"])))
