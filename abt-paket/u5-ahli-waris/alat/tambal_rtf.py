# -*- coding: utf-8 -*-
"""
Menambal blangko Derry folder "9 Penetapan Ahli Waris": [01], [01b], [01c].

Setiap tambalan: jangkar teks (bita cp1252 apa adanya) harus ditemukan TEPAT sebanyak yang diharapkan; bila tidak,
berkas tidak ditulis dan keluar kode 2. Tidak ada format paragraf yang diubah kecuali:
  - paragraf bukti (P.1, KK, bukti lainnya) diganti satu paragraf berisi #4530#;
  - satu paragraf baru (kewajiban ahli waris, Pasal 175 KHI) disalin dari paragraf tetangga.

Pakai: python tambal_rtf.py <folder-asli> <folder-keluar>
"""
import os, re, sys, hashlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtf2txt import rtf_ke_teks

ISIAN_BARU = "#4500# #4502# #4505# #4507# #4510# #4513# #4515# #4520# #4534#"
ISIAN_PENGGANTI = "#4540# #4541#"
ISIAN_LAMA_01B = "#9700# #9701# #9702# #9703# #9704# #9718#"

PASAL_175 = (
    "Menimbang, bahwa Pasal 175 ayat (1) Kompilasi Hukum Islam menentukan kewajiban ahli waris terhadap pewaris, yaitu mengurus dan menyelesaikan sampai "
    "pemakaman jenazah selesai, menyelesaikan hutang-hutang berupa pengobatan, perawatan termasuk kewajiban pewaris maupun menagih piutang, menyelesaikan "
    "wasiat pewaris, dan membagi harta warisan di antara ahli waris yang berhak, sedangkan menurut Pasal 175 ayat (2) tanggung jawab ahli waris terhadap "
    "hutang atau kewajiban pewaris hanya terbatas pada jumlah atau nilai harta peninggalannya;"
)
PARA_SUBJEK = (
    "Menimbang, bahwa ahli waris merupakan subjek hukum yang mempunyai hak dan kewajiban hukum terhadap Pewaris."
)

# (jangkar, pengganti, jumlah)  - berlaku bagi [01b] dan [01c]
EDIT_BC = [
    ("dan #2026# #1025# tidak mempunyai anak angkat;", "dan #2026# #1025# #4503#;", 2),
    ("Bahwa sepengetahuan saksi, seluruh ahli waris tersebut beragama Islam hingga saat ini;", "Bahwa sepengetahuan saksi, #4511#;", 2),
    ("Bahwa sepengetahuan saksi #2026# #1025# tidak meninggalkan wasiat apa pun;", "Bahwa sepengetahuan saksi #2026# #1025# #4508#;", 2),
    ("Bahwa tujuan #7036# mengajukan penetapan ahli waris adalah untuk mengurus harta peninggalan #2026# #1025#;", "Bahwa tujuan #7036# mengajukan penetapan ahli waris adalah untuk #4501#;", 2),
    ("dan seluruh ahli waris itu beragama Islam hingga saat ini;", "dan #4511#;", 1),
    ("(Pewaris) beragama Islam dan tidak meninggalkan wasiat apa pun;", "(Pewaris) beragama Islam dan #4508#;", 1),
    ("memiliki #8614# dan #7036# mengajukan penetapan ahli waris untuk mengurus harta peninggalan tersebut;", "memiliki #8614# dan #7036# mengajukan penetapan ahli waris untuk #4501#;", 1),
    ("selain yang disebutkan di atas dan Pewaris tidak meninggalkan wasiat apa pun;", "selain yang disebutkan di atas, Pewaris #4503# dan #4508#;", 1),
    ("Bahwa #7036# mengajukan permohonan penetapan ahli waris untuk mengurus harta peninggalan #2026# #1025#;", "Bahwa #7036# mengajukan permohonan penetapan ahli waris untuk #4501#;", 1),
    ("yang bertujuan untuk pengurusan harta peninggalan #2026# #1025# (Pewaris);", "yang bertujuan untuk #4501#;", 1),
    ("#8614#, #7036# mengajukan penetapan ahli waris untuk mengurus harta peninggalan tersebut;", "#8614#, #7036# mengajukan penetapan ahli waris untuk #4501#;", 1),
    ("untuk mengurus harta peninggalan itu, karenanya", "untuk #4501#, karenanya", 1),
    # kematian pewaris (butir petitum "Menyatakan ... meninggal dunia")
    ("sebagai unsur pertama dalam kewarisan telah terpenuhi dalam perkara a quo;", "sebagai unsur pertama dalam kewarisan telah terpenuhi dalam perkara a quo;#4532#", 1),
    # pertimbangan syarat ahli waris: keadaan perkawinan, beda agama, anak angkat, wasiat, harta bersama
    ("seluruh ahli waris tersebut telah memenuhi syarat sebagai ahli waris;", "seluruh ahli waris tersebut telah memenuhi syarat sebagai ahli waris;#4514##4512##4504##4509##4521#", 1),
    # amar
    ("Mengabulkan #0053# #7036#;", "Mengabulkan #0053# #7036#;#4531#", 1),
]
EDIT_B = [("#9706#", "#9706##4517#", 1), ("adalah #9705#;#9707#", "adalah #9705#;#9707##4506##4516##4535#", 1)]
EDIT_C = [
    ("#9769#", "#9769##4542##4517#", 1),
    ("adalah #9770#;#9707#", "adalah #9770##4543#;#9707##4506##4516##4535#", 1),
    ("#9768#", "#9768##4543#", 5),
    ("menghalangi #9770#", "menghalangi #9770##4543#", 1),
    ("hukum pada saat Pewaris meninggal dunia adalah #9770#;", "hukum pada saat Pewaris meninggal dunia adalah #9770##4543#;", 1),
]

EDIT_01 = [
    ("dan juga tidak mempunyai anak angkat;", "dan juga #4503#;", 2),
    ("Bahwa sepengetahuan saksi #2026# #1025# tidak meninggalkan wasiat apa pun;", "Bahwa sepengetahuan saksi #2026# #1025# #4508#;", 2),
    ("Bahwa tujuan #7036# mengajukan penetapan ahli waris adalah untuk mengurus harta peninggalan #2026# #1025#;", "Bahwa tujuan #7036# mengajukan penetapan ahli waris adalah untuk #4501#;", 2),
    ("dan tidak memiliki anak angkat;", "dan #4503#;", 1),
    ("beragama Islam dan tidak meninggalkan wasiat apa pun, serta", "beragama Islam dan #4508#, serta", 1),
    ("Bahwa #7036# mengajukan permohonan penetapan ahli waris untuk mengurus harta peninggalan #2026# #1025#;", "Bahwa #7036# mengajukan permohonan penetapan ahli waris untuk #4501#;", 1),
    ("#8614#, #7036# mengajukan penetapan ahli waris untuk mengurus harta peninggalan tersebut;", "#8614#, #7036# mengajukan penetapan ahli waris untuk #4501#;", 1),
    ("yang bertujuan untuk pengurusan harta peninggalan #2026# #1025# (Pewaris);", "yang bertujuan untuk #4501#;", 1),
    ("Mengabulkan #0053# #7036#;", "Mengabulkan #0053# #7036#;#4531#", 1),
]


def gagal(pesan):
    print("GAGAL:", pesan)
    sys.exit(2)


def pasti(d, jangkar, ganti, jumlah, berkas):
    n = d.count(jangkar)
    if n != jumlah:
        gagal("%s: jangkar ditemukan %d kali (harap %d): %s" % (berkas, n, jumlah, jangkar[:80]))
    return d.replace(jangkar, ganti)


def batas_paragraf(d, jangkar, berkas):
    i = d.find(jangkar)
    if i < 0 or d.count(jangkar) != 1:
        gagal("%s: paragraf tidak unik/ditemukan: %s" % (berkas, jangkar[:70]))
    s = d.rfind("\\pard", 0, i)
    e = d.find("\\pard", i)
    if s < 0 or e < 0:
        gagal("%s: batas paragraf tidak ditemukan" % berkas)
    return s, e


def ganti_bukti(d, berkas):
    """Paragraf KTP -> satu paragraf #4530#; paragraf KK dan bukti lainnya dibuang (isinya masuk bawaan 4530)."""
    awal = "Menimbang, bahwa bukti P.1 (Fotokopi Kartu Tanda Penduduk"
    akhir = "memeriksa dan mengadili perkara a quo;"
    i = d.find(awal)
    if i < 0 or d.count(awal) != 1:
        gagal(berkas + ": paragraf KTP tidak unik")
    j = d.index(akhir, i) + len(akhir)
    lama = d[i:j]
    if "{" in lama or "}" in lama:
        gagal(berkas + ": paragraf KTP terpecah beberapa grup RTF")
    d = d[:i] + "#4530#" + d[j:]
    for jangkar in ("Menimbang, bahwa bukti P.2 (Fotokopi Kartu Keluarga", "Menimbang, bahwa bukti-bukti surat lainnya"):
        s, e = batas_paragraf(d, jangkar, berkas)
        d = d[:s] + d[e:]
    return d


def sisip_paragraf(d, jangkar_tetangga, teks_baru, berkas):
    """Salin blok paragraf `jangkar_tetangga`, ganti kalimatnya dengan teks_baru, sisipkan sesudahnya."""
    s, e = batas_paragraf(d, jangkar_tetangga, berkas)
    blok = d[s:e]
    k0 = blok.find(jangkar_tetangga)
    k1 = blok.find("}", k0)
    kalimat = blok[k0:k1]
    if "{" in kalimat:
        gagal(berkas + ": kalimat tetangga terpecah")
    baru = blok[:k0] + teks_baru + blok[k1:]
    return d[:e] + baru + d[e:]


def tambah_isianasal(d, daftar, berkas):
    m = re.search(r"(\{\\\*\\isianasal[^}]*)\}", d)
    if not m:
        gagal(berkas + ": \\isianasal tidak ada")
    sudah = m.group(1)
    tambahan = [x for x in daftar.split() if x not in sudah]
    if not tambahan:
        return d
    return d[: m.end(1)] + " " + " ".join(tambahan) + d[m.end(1) :]


def tambal(nama, d):
    if nama.startswith("[01b]") or nama.startswith("[01c]"):
        for j, g, n in EDIT_BC:
            d = pasti(d, j, g, n, nama)
        for j, g, n in (EDIT_B if nama.startswith("[01b]") else EDIT_C):
            d = pasti(d, j, g, n, nama)
        d = ganti_bukti(d, nama)
        d = sisip_paragraf(d, PARA_SUBJEK, PASAL_175, nama)
        if nama.startswith("[01b]"):
            d = tambah_isianasal(d, ISIAN_LAMA_01B, nama)
        d = tambah_isianasal(d, ISIAN_BARU, nama)
        if nama.startswith("[01c]"):
            d = tambah_isianasal(d, ISIAN_PENGGANTI, nama)
    elif nama.startswith("[01] "):
        for j, g, n in EDIT_01:
            d = pasti(d, j, g, n, nama)
        d = tambah_isianasal(d, "#4500# #4502# #4507# #4534#", nama)
    else:
        gagal("berkas tidak dikenal: " + nama)
    return d


def periksa(nama, lama, baru):
    t0 = rtf_ke_teks(lama)
    t1 = rtf_ke_teks(baru)
    for kode in ("#4501#", "#4503#", "#4508#", "#4531#"):
        assert kode in t1, (nama, kode)
    # penanda lama yang HARUS hilang
    for hilang in ("dan juga tidak mempunyai anak angkat", "tidak meninggalkan wasiat apa pun;", "untuk mengurus harta peninggalan #2026# #1025#"):
        assert hilang not in t1, (nama, hilang)
    # tidak ada kurung kurawal tak seimbang
    assert baru.count("{") - baru.count("\\{") == baru.count("}") - baru.count("\\}"), nama
    return len(t0), len(t1)


if __name__ == "__main__":
    masuk, keluar = sys.argv[1], sys.argv[2]
    os.makedirs(keluar, exist_ok=True)
    for f in sorted(os.listdir(masuk)):
        if not (f.startswith("[01] ") or f.startswith("[01b] ") or f.startswith("[01c] ")):
            continue
        lama = open(os.path.join(masuk, f), "rb").read().decode("latin1")
        baru = tambal(f, lama)
        n0, n1 = periksa(f, lama, baru)
        open(os.path.join(keluar, f), "wb").write(baru.encode("latin1"))
        print("OK", f[:30], "| teks %d -> %d | md5 %s -> %s" % (n0, n1, hashlib.md5(lama.encode("latin1")).hexdigest()[:8], hashlib.md5(baru.encode("latin1")).hexdigest()[:8]))
