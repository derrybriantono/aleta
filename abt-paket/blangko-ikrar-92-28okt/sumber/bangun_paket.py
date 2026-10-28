# -*- coding: utf-8 -*-
"""
Pembangun paket ABT "abt-blangko-ikrar-92-28okt" (keputusan pengguna P4a, 28 Okt 2026).

Blangko Derry BARU penetapan RUKUN KEMBALI pada sidang ikrar talak (status 3 borang SIPP
"Penetapan Ikrar Talak"), dua varian kehadiran seperti [90]/[90a]:
  [92]  [Ikrar Rukun] Penetapan Rukun Kembali - P Hadir & T Tidak Hadir.rtf   (dari [90])
  [92a] [Ikrar Rukun] Penetapan Rukun Kembali - P & T Hadir.rtf               (dari [90a])
di folder yang SUDAH ADA derry_briantono/1a Perceraian CT (menu "Putusan Cerai Talak").
Tidak ada variabel, menu, atau berkas lama yang diubah: ABT membaca isi folder saat dibuka.

Bentuk dan gaya RTF disalin dari [90]/[90a] (pohon server, md5 sama dengan
abt-paket/u2b-cerai-susulan/data/pohon-asli-md5.tsv): hanya TEKS paragraf yang diganti,
paragraf amar dibentuk dari paragraf amar butir 2 aslinya. Amar = amar SIPP status 3 yang
disusun ALETA (ikrarTalakService.susunAmarIkrar) dan amar petugas satker (perkara 9596, 2026).

Pakai (laptop):  python sumber/bangun_paket.py [akar pohon derry_briantono]
  bawaan akar = D:/aleta-dev/kerja/w3a/asli/derry_briantono (salinan pohon server 16-19 Okt 2026)
Menulis paket-satker/rtf/..., daftar-rtf.tsv, PRASYARAT.sql (nomor variabel yang dirujuk), MD5SUMS.txt.
"""
import hashlib
import io
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
PAKET = os.path.normpath(os.path.join(SINI, "..", "paket-satker"))
AKAR = sys.argv[1] if len(sys.argv) > 1 else "D:/aleta-dev/kerja/w3a/asli/derry_briantono"
FOLDER = "1a Perceraian CT"
N = "abt-blangko-ikrar-92-28okt"

DASAR = {
    "90": ("[90] [Ikrar] Penetapan Ikrar Talak - P Hadir & T Tidak Hadir.rtf", "baf3ddd6fedab46de1c97d747c40ae50"),
    "90a": ("[90a] [Ikrar] Penetapan Ikrar Talak - P & T Hadir.rtf", "c58654ad3575d4eab6058d11c60a0788"),
}
BARU = {
    "90": "[92] [Ikrar Rukun] Penetapan Rukun Kembali - P Hadir & T Tidak Hadir.rtf",
    "90a": "[92a] [Ikrar Rukun] Penetapan Rukun Kembali - P & T Hadir.rtf",
}

# ---- Teks paragraf: lama (persis, satu kelompok RTF) -> baru ---------------------------------
UMUM = [
    ("Telah mendengar ikrar talak yang diucapkan #0046# di persidangan;",
     "Telah mendengar keterangan #0046# di persidangan;"),
    ("Menimbang, bahwa sebelum ikrar talak diucapkan, Majelis Hakim telah menasihati #0046# agar mempertimbangkan "
     "kembali kehendaknya dan rukun kembali dengan #0047#, namun tidak berhasil, dan #0046# tetap pada kehendaknya "
     "untuk mengucapkan ikrar talak;",
     "Menimbang, bahwa sebelum ikrar talak diucapkan, Majelis Hakim telah menasihati #0046# agar mempertimbangkan "
     "kembali kehendaknya dan rukun kembali dengan #0047#, dan atas nasihat tersebut #0046# menyatakan telah rukun "
     "kembali dengan #0047# serta tidak akan mengucapkan ikrar talak;"),
    ("Menimbang, bahwa #0046# telah mengucapkan ikrar talak terhadap #0047# di depan sidang dengan lafal sebagai berikut:",
     "Menimbang, bahwa ikrar talak merupakan hak #0046# yang hanya dapat diucapkan atas kehendaknya sendiri, sehingga "
     "dengan pernyataan tersebut ikrar talak tidak dijatuhkan dan perkawinan antara #0046# dengan #0047# tetap utuh;"),
    ('"Bismillahirrahmanirrahim. Pada hari ini #0032# tanggal #0033# Masehi, bertepatan dengan tanggal #8184# Hijriah, '
     'saya #0098# menjatuhkan #9215# terhadap isteri saya #0102#."',
     "Menimbang, bahwa dengan rukun kembalinya #0046# dan #0047#, tujuan perkawinan untuk mewujudkan kehidupan rumah "
     "tangga yang sakinah, mawaddah, dan rahmah sebagaimana dimaksud Pasal 3 Kompilasi Hukum Islam diharapkan dapat "
     "terwujud;"),
    ("Menimbang, bahwa berdasarkan Pasal 71 ayat (2) Undang-Undang Nomor 7 Tahun 1989 tentang Peradilan Agama "
     "sebagaimana telah diubah dengan Undang-Undang Nomor 3 Tahun 2006 dan perubahan kedua dengan Undang-Undang Nomor "
     "50 Tahun 2009 jo. Pasal 131 ayat (5) Kompilasi Hukum Islam, Pengadilan menetapkan bahwa perkawinan putus sejak "
     "ikrar talak diucapkan, dan penetapan tersebut tidak dapat dimintakan banding atau kasasi;",
     "Menimbang, bahwa berdasarkan pertimbangan tersebut, permohonan #0046# untuk tidak menjatuhkan ikrar talak "
     "terhadap #0047# patut dikabulkan, dan Panitera diperintahkan untuk mencoret perkara ini dari register perkara;"),
]
KEADAAN = {
    "90": ("Menimbang, bahwa oleh karena #0047# tidak hadir pada saat ikrar talak diucapkan, keadaan #0047# (suci, haid "
           "atau hamil) tidak dapat diketahui;"),
    "90a": ("Menimbang, bahwa pada saat ikrar talak diucapkan, #0047# hadir di persidangan dan atas pertanyaan Ketua "
            "Majelis menerangkan bahwa dirinya dalam keadaan #9219#;"),
}
KEADAAN_BARU = ("Menimbang, bahwa oleh karena ikrar talak tidak dijatuhkan, perkara ini tidak dapat dilanjutkan "
                "dan harus dicoret dari register perkara;")
# [90]: alasan Pasal 70 ayat (5) (ikrar tanpa hadirnya istri) tidak berlaku bila ikrar tidak diucapkan.
PASAL_70_5 = re.compile(r", sehingga sesuai Pasal 70 ayat \(5\)[^{}]*?tanpa hadirnya #0047#;")

AMAR_BIAYA = "2.\\tab Membebankan kepada #0046# untuk membayar biaya penetapan ini sejumlah Rp#1101#,00 (#2050# rupiah)."
AMAR_BARU = [
    "1.\\tab Mengabulkan permohonan #0046# untuk tidak menjatuhkan ikrar talak terhadap #0047#;",
    "2.\\tab Menyatakan perkara Nomor #0001# tidak dapat dilanjutkan;",
    "3.\\tab Memerintahkan Panitera #8008# untuk mencoret perkara Nomor #0001# dari register perkara;",
    "4.\\tab Membebankan kepada #0046# untuk membayar biaya penetapan ini sejumlah Rp#1101#,00 (#2050# rupiah).",
]


def md5b(b):
    return hashlib.md5(b).hexdigest()


def ganti_satu(s, lama, baru, nama):
    n = s.count(lama)
    if n != 1:
        raise SystemExit("GAGAL %s: teks dasar ditemukan %d kali (harus 1): %s" % (nama, n, lama[:70]))
    return s.replace(lama, baru)


def blok_paragraf(s, posisi):
    """Awal \\pard sebelum posisi, sampai awal \\pard berikutnya (paragraf utuh)."""
    a = s.rfind("\\pard", 0, posisi)
    b = s.find("\\pard", posisi)
    if a < 0 or b < 0:
        raise SystemExit("GAGAL: batas paragraf tidak ditemukan")
    return a, b


def bangun(kunci):
    nama, harap = DASAR[kunci]
    jalur = os.path.join(AKAR, FOLDER, nama)
    with open(jalur, "rb") as f:
        bita = f.read()
    if md5b(bita) != harap:
        raise SystemExit("GAGAL: md5 dasar %s = %s, harap %s (pohon berubah - periksa ulang teks)" % (nama, md5b(bita), harap))
    s = bita.decode("latin1")
    for lama, baru in UMUM:
        s = ganti_satu(s, lama, baru, nama)
    s = ganti_satu(s, KEADAAN[kunci], KEADAAN_BARU, nama)
    if kunci == "90a":
        # Isian tersembunyi keadaan istri (#9220#, bahan #9219#) tidak dipakai bila ikrar tidak diucapkan:
        # dibiarkan, ABT/ALETA akan menanyakan isian yang tidak tercetak.
        s = ganti_satu(s, "\\v #9220#", "\\v ", nama)
    if kunci == "90":
        m = list(PASAL_70_5.finditer(s))
        if len(m) != 1:
            raise SystemExit("GAGAL: kalimat Pasal 70 ayat (5) [90] ditemukan %d kali" % len(m))
        s = s[: m[0].start()] + ";" + s[m[0].end():]
    # Amar: paragraf butir 1 (bernama tebal) dibuang; paragraf butir 2 dipakai sebagai cetakan empat butir.
    i1 = s.index("1.\\tab Menyatakan perkawinan antara #0046#")
    a1, b1 = blok_paragraf(s, i1)
    i2 = s.index(AMAR_BIAYA)
    a2, b2 = blok_paragraf(s, i2)
    if b1 != a2:
        raise SystemExit("GAGAL: paragraf amar butir 1 dan 2 tidak bersebelahan")
    cetakan = s[a2:b2]
    if cetakan.count(AMAR_BIAYA) != 1:
        raise SystemExit("GAGAL: cetakan amar tidak tunggal")
    amar = "".join(cetakan.replace(AMAR_BIAYA, t) for t in AMAR_BARU)
    s = s[:a1] + amar + s[b2:]
    # Judul metadata RTF (bila ada) ikut dibetulkan; tidak ada kata aplikasi di mana pun.
    s = s.replace("Penetapan Ikrar Talak", "Penetapan Rukun Kembali")
    # Sisa teks "ikrar diucapkan" tidak boleh tertinggal (jenis talak, keadaan istri, lafal, putus).
    for kata in ("#9215#", "#9219#", "Bismillah", "putus karena perceraian", "telah mengucapkan ikrar"):
        if kata.lower() in s.lower():
            raise SystemExit("GAGAL: sisa teks ikrar diucapkan pada %s: %s" % (BARU[kunci], kata))
    if re.search(r"aleta", s, re.I):
        raise SystemExit("GAGAL: kata aplikasi ada di %s" % BARU[kunci])
    return s.encode("latin1")


def main():
    folder_tulis = os.path.join(PAKET, "rtf", "derry_briantono", FOLDER)
    if not os.path.isdir(folder_tulis):
        os.makedirs(folder_tulis)
    daftar = []
    nomor = set()
    for kunci in ("90", "90a"):
        isi = bangun(kunci)
        with open(os.path.join(folder_tulis, BARU[kunci]), "wb") as f:
            f.write(isi)
        daftar.append("derry_briantono/%s\t%s\t%s\t%s" % (FOLDER, BARU[kunci], md5b(isi), DASAR[kunci][0]))
        nomor |= set(re.findall(r"#(\d{4})#", isi.decode("latin1")))
        print("BUAT %s (%d bita, md5 %s)" % (BARU[kunci], len(isi), md5b(isi)))
    with io.open(os.path.join(PAKET, "daftar-rtf.tsv"), "w", encoding="utf-8", newline="\n") as f:
        f.write("# folder<TAB>berkas<TAB>md5<TAB>asal (berkas BARU, tidak pernah menimpa)\n")
        f.write("\n".join(daftar) + "\n")
    with io.open(os.path.join(PAKET, "folder-ada.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("# folder blangko yang HARUS sudah ada\nderry_briantono/%s\n" % FOLDER)
    urut = sorted(nomor)
    with io.open(os.path.join(PAKET, "%s-PRASYARAT.sql" % N), "w", encoding="utf-8", newline="\n") as f:
        f.write("-- PRASYARAT %s (baca saja): jumlah variabel yang DIRUJUK dua blangko baru yang ada di abt_variabel.\n" % N)
        f.write("-- Harus %d (semua ada). Kurang = blangko akan mencetak penanda mentah - TIDAK dipasang.\n" % len(urut))
        f.write("SELECT COUNT(DISTINCT no_var) FROM abt_variabel WHERE no_var IN (%s);\n" % ",".join(str(int(x)) for x in urut))
    with io.open(os.path.join(PAKET, "nomor-dirujuk.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(urut) + "\n")
    # MD5SUMS semua isi paket (kecuali dirinya dan cadangan uji).
    baris = []
    for akar, _d, berkas in os.walk(PAKET):
        if os.path.relpath(akar, PAKET).split(os.sep)[0] == "cadangan":
            continue
        for b in berkas:
            if b == "MD5SUMS.txt":
                continue
            p = os.path.join(akar, b)
            rel = os.path.relpath(p, PAKET).replace(os.sep, "/")
            with open(p, "rb") as f:
                baris.append("%s  %s" % (md5b(f.read()), rel))
    with io.open(os.path.join(PAKET, "MD5SUMS.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(sorted(baris, key=lambda x: x[34:])) + "\n")
    print("VARIABEL DIRUJUK %d: %s" % (len(urut), " ".join(urut)))
    print("PAKET SIAP %s" % PAKET)


if __name__ == "__main__":
    main()
