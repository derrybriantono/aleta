# -*- coding: utf-8 -*-
"""
Katalog saksi "harta-bersama" versi 2 (agen W2a-K1, 20-21 Okt 2026): menambah pokok, pertanyaan, keadaan, dasar hukum dan profil
pengetahuan saksi tanpa menghapus apa pun dari versi 1. Dibangun dari salinan versi 1 (../katalog-v1/harta-bersama.json).

Pakai: python hb_v2.py <katalog-v1.json> <keluar.json>
"""
import copy, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kb import Berkas, bangun_q, selesai  # noqa: E402
import hb_1, hb_2, hb_3  # noqa: E402

PETA = {"_g": "x", "PM": "#0046#", "TG": "#0047#"}
B = Berkas(PETA)
hb_1.isi(B)
hb_2.isi(B)
hb_3.isi(B)
selesai()

SUMBER_KHI = "KHI lampiran Inpres 1/1991: bunyi dicocokkan antara digitalisasi pasal.id dan naskah Depag (referensi/KHI-pasal-terverifikasi.md, VERIFIKASI-HUKUM 18 Okt 2026)"
SUMBER_DERRY = "kutipan pertimbangan pada blangko putusan Derry 4a Harta Bersama [01] (server, 21 Okt 2026); naskah pasal sendiri belum ada pada referensi/KHI-pasal-terverifikasi.md - dicatat di PERIKSA-PASAL-W2a"
SUMBER_BELUM = "belum ada naskah resmi berupa teks pada referensi; tidak dicetak pada keluaran (rujukan-k1.md)"

DASAR_BARU = [
    dict(id="dh-khi-1f", rujukan="Pasal 1 huruf f Kompilasi Hukum Islam", uraian="harta kekayaan dalam perkawinan atau syirkah adalah harta yang diperoleh baik sendiri-sendiri maupun bersama suami istri selama dalam ikatan perkawinan, tanpa mempersoalkan terdaftar atas nama siapa", status="terverifikasi", sumber=SUMBER_DERRY),
    dict(id="dh-khi-88", rujukan="Pasal 88 Kompilasi Hukum Islam", uraian="bila terjadi perselisihan antara suami istri tentang harta bersama, penyelesaiannya diajukan kepada Pengadilan Agama", status="terverifikasi", sumber=SUMBER_DERRY),
    dict(id="dh-khi-95-rbg-261", rujukan="Pasal 95 Kompilasi Hukum Islam jo. Pasal 261 ayat (1) RBg", uraian="sita jaminan atas harta bersama dapat diletakkan bila ada persangkaan yang beralasan bahwa objek akan dipindahtangankan, digelapkan atau dihilangkan sebelum putusan dijatuhkan", status="terverifikasi", sumber=SUMBER_DERRY),
    dict(id="dh-khi-96-hb", rujukan="Pasal 96 ayat (1) Kompilasi Hukum Islam", uraian="bila terjadi cerai mati, separoh harta bersama menjadi hak pasangan yang hidup lebih lama", status="terverifikasi", sumber=SUMBER_KHI),
    dict(id="dh-khi-94", rujukan="Pasal 94 Kompilasi Hukum Islam", uraian="harta bersama dari perkawinan seorang suami yang beristri lebih dari seorang masing-masing terpisah dan berdiri sendiri", status="perlu-verifikasi", sumber=SUMBER_BELUM),
    dict(id="dh-khi-85-86", rujukan="Pasal 85 dan Pasal 86 Kompilasi Hukum Islam", uraian="adanya harta bersama tidak menutup kemungkinan adanya harta milik masing-masing suami atau istri, dan pada dasarnya tidak ada percampuran harta karena perkawinan", status="perlu-verifikasi", sumber=SUMBER_BELUM),
    dict(id="dh-uup-29", rujukan="Pasal 29 Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan", uraian="perjanjian perkawinan, waktu pembuatan, pengesahan dan pencatatannya", status="perlu-verifikasi", sumber=SUMBER_BELUM),
]

POKOK_BARU = [
    dict(id="pp-hb-poligami", judul="Harta bersama dalam perkawinan lebih dari seorang istri", uraian="harta bersama tiap perkawinan berdiri sendiri; saat perkawinan berikutnya dilangsungkan menentukan harta yang menjadi objek", dasarHukum=["dh-khi-94"], wajib=False, keadaan={"poligami": "ya"}),
    dict(id="pp-hb-nilai", judul="Nilai dan taksiran objek", uraian="nilai objek saat ini, asal angka taksiran, dan perubahan nilai sejak diperoleh", dasarHukum=["dh-rbg-283"], wajib=False),
    dict(id="pp-hb-pembagian", judul="Pembagian harta bersama dan bagian masing-masing", uraian="seperdua untuk masing-masing pihak kecuali ditentukan lain, alasan pembagian tidak sama, dan cara pembagian objek", dasarHukum=["dh-khi-97", "dh-khi-1f"], wajib=False),
]

# tambahan dasar hukum pada pokok lama (hanya menambah; alasan: melengkapi rujukan yang dikutip blangko Derry dan KHI terverifikasi)
TAMBAH_DASAR_POKOK = {
    "pp-perolehan": ["dh-khi-1f"],
    "pp-bukan-bawaan": ["dh-khi-85-86", "dh-uup-29"],
    "pp-penguasaan": ["dh-khi-88"],
    "pp-sita": ["dh-khi-95-rbg-261"],
    "pp-ahli-waris-pihak": ["dh-khi-96-hb"],
}

LABEL_JENIS = {
    "piutang": "Piutang (uang yang dipinjam orang lain)",
    "asuransi-pensiun": "Asuransi, tabungan haji, atau dana pensiun",
    "kebun-ternak": "Kebun, sawah, atau ternak",
    "investasi": "Penitipan modal atau investasi pada pihak lain",
    "tanah-bangunan": "Tanah dan bangunan",
    "kendaraan": "Kendaraan",
    "usaha": "Usaha",
    "rekening-uang": "Rekening, tabungan, atau uang tunai",
    "perhiasan-perabot": "Perhiasan, perabot, atau barang bergerak",
    "utang": "Utang bersama",
}

KEADAAN_BARU = {
    "sumberDana": dict(sumber="borang", nilai=["gaji-bersama", "usaha-bersama", "kredit-bank", "bantuan-keluarga", "jual-harta-lain"], jamak=True, bawaan=[], label="Sumber dana perolehan objek",
                       labelNilai={"gaji-bersama": "Gaji atau penghasilan para pihak", "usaha-bersama": "Keuntungan usaha bersama", "kredit-bank": "Kredit atau angsuran", "bantuan-keluarga": "Bantuan atau pinjaman keluarga", "jual-harta-lain": "Hasil penjualan harta lain"}),
    "statusTanah": dict(sumber="borang", nilai=["bersertifikat", "belum-bersertifikat"], bawaan="bersertifikat", label="Surat tanah objek",
                        labelNilai={"bersertifikat": "Tanah bersertifikat", "belum-bersertifikat": "Tanah belum bersertifikat (girik, surat keterangan)"}),
    "poligami": dict(sumber="borang", nilai=["tidak", "ya"], bawaan="tidak", label="Salah satu pihak beristri atau bersuami lebih dari seorang",
                     labelNilai={"tidak": "Tidak", "ya": "Ya, ada perkawinan lain"}),
    "pembagianDiminta": dict(sumber="borang", nilai=["seperdua", "tidak-sama"], bawaan="seperdua", label="Bagian yang dimohonkan",
                             labelNilai={"seperdua": "Seperdua untuk masing-masing pihak", "tidak-sama": "Bagian tidak sama (karena peran atau perilaku)"}),
    "perjanjianKawin": dict(sumber="borang", nilai=["tidak-ada", "ada"], bawaan="tidak-ada", label="Ada perjanjian perkawinan",
                            labelNilai={"tidak-ada": "Tidak ada perjanjian perkawinan", "ada": "Ada perjanjian perkawinan"}),
    "agunan": dict(sumber="borang", nilai=["tidak", "ada"], bawaan="tidak", label="Objek dijadikan jaminan utang",
                   labelNilai={"tidak": "Tidak dijaminkan", "ada": "Dijadikan jaminan utang"}),
    "hasilObjek": dict(sumber="borang", nilai=["tidak", "ada"], bawaan="tidak", label="Objek menghasilkan sewa, panen, atau keuntungan",
                       labelNilai={"tidak": "Tidak ada hasil", "ada": "Ada hasil yang dinikmati satu pihak"}),
    "kesepakatan": dict(sumber="borang", nilai=["tidak-ada", "ada"], bawaan="tidak-ada", label="Pernah ada kesepakatan pembagian",
                        labelNilai={"tidak-ada": "Tidak pernah ada kesepakatan", "ada": "Pernah ada kesepakatan yang belum dilaksanakan"}),
    "taksiran": dict(sumber="borang", nilai=["tidak-ada", "ada"], bawaan="tidak-ada", label="Ada taksiran atau penilaian objek",
                     labelNilai={"tidak-ada": "Tidak ada penilaian", "ada": "Ada NJOP, penilai, atau harga pasar"}),
}

# profil pengetahuan saksi (satu pilihan per saksi di layar): peta kunci -> jenis keterangan; kunci dicari menurut id butir, pokok, kelompok, lalu "*"
SEMUA_POKOK = ["pp-perkawinan", "pp-perolehan", "pp-bukan-bawaan", "pp-penguasaan", "pp-objek-khusus", "pp-pengalihan-utang", "pp-kontribusi", "pp-bantahan", "pp-rekonvensi", "pp-ahli-waris-pihak", "pp-sita", "pp-upaya", "pp-hb-poligami", "pp-hb-nilai", "pp-hb-pembagian"]


def peta(dasar, **lain):
    d = {"*": dasar}
    d.update(lain)
    return d


PROFIL = {
    "sama": dict(label="Tahu seluruhnya, melihat dan mengalami sendiri", peta={"*": "melihat"}),
    "mendengar-sendiri": dict(label="Mendengar sendiri dari para pihak, tidak melihat sendiri", peta=peta(
        "melihat", **{"pp-perolehan": "mendengar", "pp-bukan-bawaan": "mendengar", "pp-objek-khusus": "mendengar", "pp-pengalihan-utang": "mendengar", "q-atas-nama": "mendengar", "pp-hb-nilai": "mendengar", "pp-bantahan": "mendengar"})),
    "dari-cerita": dict(label="Tahu dari cerita salah satu pihak atau orang lain", sumber=True, peta=peta(
        "melihat", **{"pp-perolehan": "de-auditu", "pp-bukan-bawaan": "de-auditu", "pp-penguasaan": "de-auditu", "pp-objek-khusus": "de-auditu", "pp-pengalihan-utang": "de-auditu", "pp-kontribusi": "de-auditu",
                      "pp-bantahan": "de-auditu", "pp-rekonvensi": "de-auditu", "pp-sita": "de-auditu", "pp-hb-nilai": "de-auditu", "pp-hb-poligami": "de-auditu"})),
    "tahu-objek-tidak-tahu-asal": dict(label="Tahu objek dan penguasaannya, tidak tahu asal dan sumber dananya", peta=peta(
        "melihat", **{"pp-bukan-bawaan": "tidak-tahu", "q-waktu-perolehan": "tidak-tahu", "q-cara-perolehan": "tidak-tahu", "q-sumber-dana": "tidak-tahu", "q-dana-gaji": "tidak-tahu", "q-dana-usaha": "tidak-tahu", "q-dana-kredit": "tidak-tahu",
                      "q-dana-sisa-kredit": "tidak-tahu", "q-dana-jual-harta-lain": "tidak-tahu", "q-harga-tahun-beli": "tidak-tahu", "pp-hb-nilai": "sebagian"})),
    "tahu-perolehan-tidak-tahu-penguasaan": dict(label="Tahu perolehan selama menikah, tidak tahu penguasaan sekarang", peta=peta(
        "melihat", **{"pp-penguasaan": "tidak-tahu", "pp-pengalihan-utang": "tidak-tahu", "pp-sita": "tidak-tahu", "pp-hb-nilai": "sebagian", "pp-rekonvensi": "tidak-tahu"})),
    "tahu-sebagian-objek": dict(label="Hanya tahu sebagian objek", peta=peta(
        "melihat", **{"pp-perolehan": "sebagian", "pp-objek-khusus": "sebagian", "pp-penguasaan": "sebagian", "pp-hb-nilai": "sebagian", "pp-pengalihan-utang": "sebagian"})),
    "tahu-peran-tidak-tahu-harta": dict(label="Tahu peran para pihak dalam rumah tangga, tidak tahu rincian harta", peta=peta(
        "tidak-tahu", **{"pp-saksi-formil": "melihat", "pp-perkawinan": "melihat", "pp-kontribusi": "melihat", "pp-upaya": "sebagian", "q-sumber-dana": "sebagian"})),
    "hanya-tahu-menikah-cerai": dict(label="Hanya tahu menikah dan bercerai, tidak tahu hartanya", peta=peta(
        "tidak-tahu", **{"pp-saksi-formil": "melihat", "pp-perkawinan": "melihat"})),
    "ragu": dict(label="Ragu dan kurang ingat", peta=peta("ragu", **{"pp-saksi-formil": "melihat", "pp-perkawinan": "melihat"})),
}

# bantahan: nilai tambahan di katalog utama (katalog tambahan Tergugat menyatakan ulang sebagian; peleburan tidak menimpa tulisan utama)
BANTAHAN_TAMBAH = ["sudah-dibagi", "sudah-dihibahkan", "utang-bersama", "pisah-harta", "nilai-berbeda", "bagian-tidak-sama"]
BANTAHAN_LABEL = {
    # tulisan nilai yang sudah dimiliki katalog tambahan Tergugat (sudah-dibagi, sudah-dihibahkan, utang-bersama, pisah-harta) tidak diulang di sini
    "nilai-berbeda": "Nilai objek tidak sebesar gugatan", "bagian-tidak-sama": "Bagian Penggugat tidak seperdua",
}
OBJEK_TAMBAH = ["piutang", "asuransi-pensiun", "kebun-ternak", "investasi"]

CATATAN_BARU = [
    "Versi 2 (21 Okt 2026): perkawinan dan putusnya (buku nikah, lama menikah, akta cerai, meninggalnya salah satu pihak, poligami), perjanjian perkawinan, sumber dana tiap objek (gaji, usaha, kredit, bantuan keluarga, hasil jual), harta bawaan, hibah dan warisan, rincian tiap jenis objek (tanah, rumah, kendaraan, usaha, rekening, perhiasan, piutang, investasi, asuransi, kebun), penguasaan sepihak dan hasil objek, utang, pengalihan dan penjaminan, peran para pihak, bantahan, gugatan balik, pihak meninggal, sita, nilai, pembagian dan kesepakatan ditambahkan; semua butir versi 1 dipertahankan.",
    "Pilihan keadaan pada layar menentukan butir yang tampil. Titik-titik pada jawaban ('...') adalah tempat isian yang tidak ada di gugatan: lengkapi dari keterangan saksi yang sebenarnya.",
    "Profil pengetahuan saksi memudahkan satu pilihan per saksi (melihat sendiri, mendengar sendiri, dari cerita, tahu sebagian, tidak tahu, ragu); jawaban 'berbeda' dan 'ragu' tetap perlu ditinjau butir demi butir.",
    "Nilai taksiran, bagian dan keputusan dikabulkan atau ditolak adalah kewenangan hakim; katalog hanya menyediakan keterangan saksi.",
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
    # keadaan: nilai tambahan pada kunci lama; kunci baru
    k = kat["keadaan"]
    for n in OBJEK_TAMBAH:
        if n not in k["jenisObjek"]["nilai"]:
            k["jenisObjek"]["nilai"].append(n)
    k["jenisObjek"]["labelNilai"] = {n: LABEL_JENIS[n] for n in k["jenisObjek"]["nilai"] if n in LABEL_JENIS}
    for n in BANTAHAN_TAMBAH:
        if n not in k["bantahan"]["nilai"]:
            k["bantahan"]["nilai"].append(n)
    k["bantahan"]["labelNilai"] = dict(BANTAHAN_LABEL)
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
