# -*- coding: utf-8 -*-
"""
Pembangun paket ABT "abt-in-lupa-prosesi-3nov" (permintaan pengguna 3 Nov 2026, 13.15).

Blangko Derry BARU itsbat nikah voluntair: saksi MENGHADIRI pesta perkawinan para Pemohon tetapi tidak
mengikuti akad, sehingga tidak tahu wali, lafadz akad, mahar, dan saksi nikah.
  [01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah).rtf     (dari [01] [Kabul] IN.rtf)
di folder yang SUDAH ADA derry_briantono/2 Itsbat Nikah. Tidak ada variabel, menu, atau berkas lama yang diubah.

Yang berubah terhadap [01] (gaya RTF disalin dari paragraf [01] sendiri; hanya TEKS yang diganti):
  - fakta hukum butir 3-7 (wali, yang menikahkan, saksi nikah, mahar, ijab kabul tanpa jeda - yang tidak diketahui saksi)
    menjadi 3 butir: dalil permohonan tentang wali/yang menikahkan/saksi nikah/mahar; saksi hanya menghadiri pesta;
    hidup rukun, tetap suami istri, tidak bercerai, tidak pindah agama. Butir 9 dan 10 lama disesuaikan.
  - paragraf "Menimbang, bahwa fakta para #0046# melangsungkan perkawinan ... bunyinya sebagai berikut:" diganti
    empat paragraf pertimbangan pengguna (tangkapan layar 3 Nov) + paragraf pengantar dalil I'anatut Thalibin;
    gambar teks Arab I'anatut Thalibin dan Bughyatul Mustarsyidin TIDAK diubah (gambar yang sudah tampil di [01]).
  - terjemahan I'anatut Thalibin pada dalil kedua mengikuti rumusan pengguna.

Pakai (laptop):  python sumber/bangun_paket.py [akar pohon derry_briantono]
  bawaan akar = D:/Aplikasi/aleta/tmp/w194/pohon/derry_briantono (cadangan server 2 Nov 2026 18.50; md5 [01] = server 3 Nov)
Menulis paket-satker/rtf/..., daftar-rtf.tsv, folder-ada.txt, PRASYARAT.sql, nomor-dirujuk.txt, MD5SUMS.txt. Deterministik.
"""
import hashlib
import io
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
PAKET = os.path.normpath(os.path.join(SINI, "..", "paket-satker"))
AKAR = sys.argv[1] if len(sys.argv) > 1 else "D:/Aplikasi/aleta/tmp/w194/pohon/derry_briantono"
FOLDER = "2 Itsbat Nikah"
N = "abt-in-lupa-prosesi-3nov"
DASAR = ("[01] [Kabul] IN.rtf", "a1a7b90f11665e64621d71bee733e1a9")
BARU = "[01f] [Kabul] IN Kabul (Hadir Tapi Lupa Prosesi Nikah).rtf"

RUN = r"{\fs24 \rtlch \ltrch \dbch \af6 \hich \af4 \loch \f4 "
RUN_I = r"{\i1 \fs24 \rtlch \ltrch \dbch \af6 \hich \af4 \loch \f4 "
PAR = r"{\fs24 \rtlch \ltrch \dbch \af6 \hich \af4 \loch \f4 \par }"
KUTIP_B, KUTIP_T, APOS = r"\uc1 \u8220 ?", r"\uc1 \u8221 ?", r"\uc1 \u8217 ?"

# ---- Fakta hukum (daftar bernomor \ls5): teks lama persis -> teks baru ------------------------------------------
FAKTA_GANTI = [
    ("Bahwa yang menjadi Wali Nikah #0046# II saat pernikahan adalah #1046#;",
     "Bahwa menurut dalil permohonan para #0046#, yang menjadi Wali Nikah #0046# II saat pernikahan adalah #1046#, "
     "yang menikahkan adalah #8087#, yang menjadi saksi nikah adalah #0650# dan #0651#, dan mahar pernikahannya adalah #1001#;"),
    ("Bahwa yang menikahkan para #0046# adalah #8087#; ",
     "Bahwa saksi-saksi para #0046# menghadiri pesta perkawinan #0046# I dan #0046# II, namun tidak mengikuti prosesi akad "
     "nikah, sehingga tidak mengetahui siapa yang bertindak sebagai wali nikah, bagaimana lafadz akad nikahnya, apa maharnya, "
     "dan siapa saksi nikahnya;"),
    ("Bahwa yang menjadi saksi nikah pada saat terjadinya ijab kabul adalah #0650# dan #0651#. Selain itu ijab kabul juga disaksikan oleh banyak orang;",
     "Bahwa setelah menikah #0046# I dan #0046# II hidup rukun sebagaimana layaknya suami istri dan #0007#, hingga kini masih tetap "
     "berstatus sebagai suami istri, tidak pernah bercerai, dan tidak pernah pindah agama;"),
    ("Bahwa tidak ada pihak lain yang keberatan atas pernikahan #0046# I dengan #0046# II;",
     "Bahwa tidak ada pihak lain, termasuk masyarakat setempat, yang keberatan atas pernikahan #0046# I dengan #0046# II;"),
    ("Bahwa #0046# I tidak pernah berpoligami, #0046# I dengan #0046# II belum pernah bercerai, dan keduanya hidup rukun bersama sampai sekarang;",
     "Bahwa #0046# I tidak memiliki istri selain #0046# II, begitu pula #0046# II tidak memiliki suami selain #0046# I;"),
]
FAKTA_BUANG = [  # butir 6 (mahar) dan 7 (ijab kabul tanpa jeda): tidak diketahui saksi, sudah masuk butir 3 (dalil)
    "Bahwa mahar pernikahan yang diberikan #0046# I kepada #0046# II adalah #1001#;",
    "Bahwa Wali Nikah #0046# II mengucapkan ijab dan #0046# I mengucapkan kabul sesaat setelah Wali Nikah #0046# II mengucapkan ijab tanpa ada jeda waktu terlalu lama;",
]
NOMOR_GESER = [("8", "6"), ("9", "7"), ("10", "8"), ("11", "9")]

# ---- Pertimbangan (tangkapan layar pengguna, salah ketik dibetulkan; "Hakim" = #8554# seperti [01]) -----------------
PERTIMBANGAN = [
    "Menimbang, bahwa meskipun saksi-saksi menghadiri perkawinan #0046# I dan #0046# II namun tidak mengetahui siapa yang "
    "bertindak sebagai wali nikah, bagaimana lafadz akad nikahnya, apa maharnya dan siapa saksi nikah pada perkawinan #0046# I "
    "dan #0046# II, #8554# berpendapat bahwa hal tersebut adalah lumrah, mengingat pada saat #0046# I dan #0046# II menikah "
    "kedua saksi tersebut tidak mengikuti akad nikah dan kehadirannya adalah menghadiri pesta perkawinan untuk turut serta "
    "merayakan kebahagiaan perkawinan saja;",
    "Menimbang, bahwa setelah pernikahan tersebut #0046# I dan #0046# II telah hidup rukun sebagaimana layaknya suami istri dan #0007#, "
    "hingga kini masih tetap berstatus sebagai suami istri dan tidak pernah bercerai dan tidak pernah pindah agama, maka hal "
    "tersebut menunjukkan indikasi adanya hubungan kekeluargaan yang sangat kuat antara #0046# I dan #0046# II;",
    "Menimbang, bahwa #0046# I tidak lagi memiliki istri selain #0046# II, begitu pula dengan #0046# II ia tidak memiliki "
    "suami selain #0046# I, selain itu selama ini tidak ada pihak manapun yang keberatan atau merasa dirugikan dengan "
    "perkawinan #0046# I dan #0046# II tersebut, hal tersebut mengindikasikan bahwa perkawinan #0046# I dan #0046# II tidak "
    "bermasalah syarat dan rukun perkawinan karena masyarakat pemeluk agama Islam di wilayah #5105# memandang perkawinan "
    "adalah sebagai ibadah yang sakral, oleh karena itu pihak-pihak yang berkepentingan dalam perkawinan ini telah "
    "benar-benar memperhatikan syarat dan rukun perkawinan untuk sahnya perkawinan;",
    "Menimbang, bahwa oleh karena tidak ada seorang pun masyarakat setempat yang berkeberatan dengan perkawinan tersebut "
    "maka #8554# berkesimpulan perkawinan tersebut dilaksanakan tanpa adanya halangan syarat dan rukun perkawinan. Jika "
    "seandainya terdapat salah satu syarat maupun rukun perkawinan #0046# I dan #0046# II yang tidak terpenuhi tentulah "
    "perkawinan tersebut tidak dapat dilaksanakan;",
]
# Pengantar dalil: tiga run (biasa, miring, biasa) seperti [01].
PENGANTAR = [
    (RUN, "Menimbang, bahwa #8554# perlu mengetengahkan dalil dalam Kitab "),
    (RUN_I, "I" + APOS + "anatut Thalibin"),
    (RUN, " Juz IV halaman 253-254 yang selanjutnya diambil alih menjadi pendapat #8554#, berbunyi:"),
]
ARTI_IANAT_LAMA = ("terlebih dahulu seperti adanya wali dan dua orang saksi yang adil" + KUTIP_T + "}" + RUN + ".}")
ARTI_IANAT_LAMA_AWAL = KUTIP_B + "Pada pengakuan perkawinan dengan seorang perempuan harus dapat menyebutkan sahnya perkawinan "
ARTI_IANAT_BARU = (KUTIP_B + "Pengakuan seorang laki-laki yang menikahi seorang perempuan harus bisa menyebutkan sahnya nikah "
                   "dan syarat-syaratnya seperti wali dan dua orang saksi laki-laki yang adil" + KUTIP_T + "}" + RUN + ";}")

JANGKAR_PERTIMBANGAN = "Menimbang, bahwa fakta para #0046# melangsungkan perkawinan pada tanggal #5197#"
SESUDAH_DALIL = "Menimbang, bahwa untuk melangsungkan perkawinan antara seorang pria"


def md5b(b):
    return hashlib.md5(b).hexdigest()


def satu(s, teks, nama):
    n = s.count(teks)
    if n != 1:
        raise SystemExit("GAGAL: teks dasar ditemukan %d kali (harus 1) di %s: %s" % (n, nama, teks[:80]))
    return s.index(teks)


def paragraf(s, posisi):
    """Sesudah penutup paragraf sebelumnya ("\\par }") sampai sesudah penutup paragraf ini (satu paragraf utuh,
    termasuk {\\listtext \\pard ...} di dalamnya)."""
    a = s.rfind("\\par }", 0, posisi)
    b = s.find("\\par }", posisi)
    if a < 0 or b < 0 or not s.startswith("\\pard ", a + 6):
        raise SystemExit("GAGAL: batas paragraf tidak ditemukan")
    return a + 6, b + 6


def bangun():
    jalur = os.path.join(AKAR, FOLDER, DASAR[0])
    with open(jalur, "rb") as f:
        bita = f.read()
    if md5b(bita) != DASAR[1]:
        raise SystemExit("GAGAL: md5 dasar %s = %s, harap %s (blangko server berubah - periksa ulang teks)" % (DASAR[0], md5b(bita), DASAR[1]))
    s = bita.decode("latin1")
    nama = DASAR[0]

    # 1. Fakta hukum: ganti teks, buang dua butir, geser nomor (\listtext) butir sesudahnya.
    awal_fakta = satu(s, "telah ditemukan fakta sebagai berikut:", nama)
    for lama, baru in FAKTA_GANTI:
        satu(s, lama, nama)
        s = s.replace(lama, baru)
    for lama in FAKTA_BUANG:
        a, b = paragraf(s, satu(s, lama, nama))
        if "\\ls5 " not in s[a:b]:
            raise SystemExit("GAGAL: butir fakta yang dibuang bukan anggota daftar fakta")
        s = s[:a] + s[b:]
    akhir_fakta = satu(s, "Bahwa tujuan para #0046# mengajukan itsbat nikah", nama)
    blok = s[awal_fakta:akhir_fakta + 200]
    for lama, baru in NOMOR_GESER:
        t_lama = "\\f2 %s.\\tab }" % lama
        if blok.count(t_lama) != 1:
            raise SystemExit("GAGAL: nomor butir fakta %s ditemukan %d kali" % (lama, blok.count(t_lama)))
        blok = blok.replace(t_lama, "\\f2 %s.\\tab }" % baru)
    s = s[:awal_fakta] + blok + s[akhir_fakta + 200:]

    # 2. Pertimbangan: paragraf "fakta para #0046# melangsungkan ..." diganti 4 paragraf + pengantar dalil.
    a, b = paragraf(s, satu(s, JANGKAR_PERTIMBANGAN, nama))
    lama = s[a:b]
    kepala = lama[: lama.index("{")]  # \pard \plain \s57 \qj \fi720 ... (format paragraf "Menimbang" [01])
    if "\\fi720" not in kepala or "\\qj" not in kepala:
        raise SystemExit("GAGAL: format paragraf jangkar tidak seperti paragraf Menimbang")
    baru = ""
    for t in PERTIMBANGAN:
        baru += kepala + RUN + t + "}" + PAR
    baru += kepala + "".join(r + t + "}" for r, t in PENGANTAR) + PAR
    s = s[:a] + baru + s[b:]

    # 3. Terjemahan I'anatut Thalibin pada dalil kedua (sesudah pengantar baru, sebelum Bughyatul Mustarsyidin).
    i = satu(s, ARTI_IANAT_LAMA, nama)
    j = s.rfind(ARTI_IANAT_LAMA_AWAL, 0, i)
    if j < 0 or j < s.index("perlu mengetengahkan dalil") or i > s.index("Bughyatul Mustarsyidin halaman 298"):
        raise SystemExit("GAGAL: terjemahan I'anat kedua tidak di tempat yang diharapkan")
    s = s[:j] + ARTI_IANAT_BARU + s[i + len(ARTI_IANAT_LAMA):]

    # 4. Penjaga isi.
    for wajib in ("Bughyatul Mustarsyidin halaman 298", "\\pngblip", SESUDAH_DALIL, "MENETAPKAN",
                  "tidak ada seorang pun masyarakat setempat yang berkeberatan", "pesta perkawinan"):
        if wajib not in s:
            raise SystemExit("GAGAL: bagian wajib hilang: %s" % wajib)
    if s.count("\\pngblip") != bita.decode("latin1").count("\\pngblip"):
        raise SystemExit("GAGAL: jumlah gambar (teks Arab) berubah")
    teks = re.sub(r"\\[a-z]+-?\d* ?|[{}]", "", s)
    for larang in ("Kab. Sigi", "Majelis Hakim memandang", "dan dan", "orang orang", "agama islam", "seorangpun",
                   "tidak berkeberatan", "dikaruniai dua", "Hakim berpendapat", JANGKAR_PERTIMBANGAN,
                   "tanpa ada jeda waktu", "Selain itu ijab kabul juga disaksikan"):
        if larang in teks:
            raise SystemExit("GAGAL: teks terlarang tertinggal: %s" % larang)
    if re.search(r"aleta", s, re.I):
        raise SystemExit("GAGAL: kata aplikasi ada di blangko baru")
    hasil = s.encode("latin1")
    if hasil[: len(hasil)].count(b"\\rtf1") != 1:
        raise SystemExit("GAGAL: kepala RTF tidak tunggal")
    return hasil


def main():
    folder_tulis = os.path.join(PAKET, "rtf", "derry_briantono", FOLDER)
    if not os.path.isdir(folder_tulis):
        os.makedirs(folder_tulis)
    isi = bangun()
    with open(os.path.join(folder_tulis, BARU), "wb") as f:
        f.write(isi)
    print("BUAT %s (%d bita, md5 %s)" % (BARU, len(isi), md5b(isi)))
    nomor = sorted(set(re.findall(r"#(\d{4,5})#", isi.decode("latin1"))), key=int)
    with io.open(os.path.join(PAKET, "daftar-rtf.tsv"), "w", encoding="utf-8", newline="\n") as f:
        f.write("# folder<TAB>berkas<TAB>md5<TAB>asal (berkas BARU, tidak pernah menimpa)\n")
        f.write("derry_briantono/%s\t%s\t%s\t%s\n" % (FOLDER, BARU, md5b(isi), DASAR[0]))
    with io.open(os.path.join(PAKET, "folder-ada.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("# folder blangko yang HARUS sudah ada\nderry_briantono/%s\n" % FOLDER)
    with io.open(os.path.join(PAKET, "%s-PRASYARAT.sql" % N), "w", encoding="utf-8", newline="\n") as f:
        f.write("-- PRASYARAT %s (baca saja): jumlah variabel yang DIRUJUK blangko baru [01f] yang ada di abt_variabel.\n" % N)
        f.write("-- Harus %d (semua ada). Kurang = blangko akan mencetak penanda mentah - TIDAK dipasang.\n" % len(nomor))
        f.write("SELECT COUNT(DISTINCT no_var) FROM abt_variabel WHERE no_var IN (%s);\n" % ",".join(str(int(x)) for x in nomor))
    with io.open(os.path.join(PAKET, "nomor-dirujuk.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(nomor) + "\n")
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
    print("VARIABEL DIRUJUK %d: %s" % (len(nomor), " ".join(nomor)))
    print("PAKET SIAP %s" % PAKET)


if __name__ == "__main__":
    main()
