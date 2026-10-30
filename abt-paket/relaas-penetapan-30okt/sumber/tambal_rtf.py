# -*- coding: utf-8 -*-
"""Penambal RTF blangko Derry paket relaas-penetapan-30okt (Python 3, LAPTOP; server menerima berkas jadi lewat berkas_rtf.py).

Cara (sama dengan paket prodeo-panggilan-29okt): RTF diurai menjadi TEKS TAMPAK, tiap huruf tampak dipetakan ke satu bait mentah
(hanya teks harfiah). Aturan dicari pada teks tampak; seluruh huruf di rentang yang cocok WAJIB huruf harfiah (bukan \\'xx, \\u,
\\par) - kalau tidak, berhenti. Teks pengganti ditaruh di bait huruf pertama, bait huruf lain di rentang dihapus. Kata kendali,
kurung kurawal dan isi tujuan (fonttbl, info, {\\*...}) tidak pernah disentuh. Sesudah ditambal diperiksa: (1) teks tampak baru =
teks tampak lama dengan penggantian yang sama, (2) urutan kata kendali + kurawal sama persis, (3) jumlah kecocokan tiap aturan =
jumlah yang diharapkan.
pakai (modul): tambal(rel, bait) -> (bait_baru, {aturan: jumlah}); ATURAN di bawah.
"""
import re

TOK = re.compile(rb"\\([a-zA-Z]+)(-?\d+)? ?|\\'([0-9a-fA-F]{2})|\\(.)|([{}])|([^\\{}\r\n]+)|([\r\n]+)", re.S)
LEWAT = {"fonttbl", "colortbl", "stylesheet", "info", "pict", "listtable", "listoverridetable", "rsidtbl", "generator",
         "xmlnstbl", "themedata", "colorschememapping", "datastore", "latentstyles", "mmathPr", "pgdsctbl", "object",
         "fldinst", "filetbl", "revtbl", "protusertbl", "userprops", "docvar", "bkmkstart", "bkmkend"}


def urai(raw):
    """-> (tampak: str, posisi: list[int|None] bait mentah per huruf tampak, kendali: list[bytes])."""
    tampak, pos, kendali = [], [], []
    tumpuk, lewat, awal = [], False, False
    for m in TOK.finditer(raw):
        kata, arg, hx, sim, kur, isi, gb = m.groups()
        if kur is not None:
            kendali.append(kur)
            if kur == b"{":
                tumpuk.append(lewat)
                awal = True
            else:
                lewat = tumpuk.pop() if tumpuk else False
                awal = False
            continue
        if gb is not None:
            continue
        if sim is not None:
            kendali.append(b"\\" + sim)
            if sim == b"*" and awal:
                lewat = True
            elif not lewat:
                if sim in b"\\{}":
                    tampak.append(sim.decode("latin1"))
                    pos.append(None)
                elif sim == b"~":
                    tampak.append(" ")
                    pos.append(None)
            continue
        if kata is not None:
            kendali.append(b"\\" + kata + (arg or b""))
            if awal and kata.decode() in LEWAT:
                lewat = True
            awal = False
            if lewat:
                continue
            k = kata.decode()
            if k in ("par", "line", "sect", "page", "row", "cell"):
                tampak.append("\n")
                pos.append(None)
            elif k == "tab":
                tampak.append("\t")
                pos.append(None)
            elif k == "u" and arg:
                tampak.append(chr(int(arg) % 65536))
                pos.append(None)
            continue
        awal = False
        if hx is not None:
            kendali.append(b"\\'" + hx)
            if not lewat:
                tampak.append(bytes([int(hx, 16)]).decode("cp1252", "replace"))
                pos.append(None)
            continue
        if isi is not None and not lewat:
            s = m.start(6)
            for i, b in enumerate(isi):
                tampak.append(chr(b))
                pos.append(s + i)
    return "".join(tampak), pos, kendali


# --- aturan: (kode, pola berkas (regex atas "folder/berkas"), pola teks tampak, pengganti, jumlah yang diharapkan) -------------
ATURAN = []


def aturan(kode, berkas, pola, ganti, jumlah):
    ATURAN.append((kode, re.compile(berkas), re.compile(pola), ganti, jumlah))


R = r"^98 Relaas/"
# K1 koma tunggal di bawah tanda tangan: #7078#/#7110# sudah berakhiran koma (non e-Court) atau kosong (e-Court)
for f, n78, n10 in ((r"\[JS\] 0\. Relaas Panggilan Sidang Pertama P", 1, 0), (r"\[JS\] 0\. Relaas Panggilan Sidang Pertama T", 0, 1),
                    (r"\[JS\] 2\. Relaas Pemberitahuan Putusan P", 1, 0), (r"\[JS\] 2\. Relaas Pemberitahuan Putusan T", 0, 1),
                    (r"\[JS\] 3\.b\. ", 1, 1), (r"\[JS\] 4\. Relaas Panggilan Ikrar Talak P dan T", 1, 1)):
    if n78:
        aturan("K1a", R + f, r"(?<=#7078#),", "", n78)
    if n10:
        aturan("K1b", R + f, r"(?<=#7110#),", "", n10)
# K2 alih ke variabel pengganti (isi_variabel.py)
aturan("K2-7100", R + r"(?!\[JS\] (4\. |2\. Relaas Pemberitahuan Putusan T))", r"#1064##7100#", "#11204#", None)
# K9 pemberitahuan putusan: "atas perintah ... Tanggal" = tanggal PUTUSAN (keputusan pengguna 30 Okt)
aturan("K9a", R + r"\[JS\] 2\. Relaas Pemberitahuan Putusan P", r"(?<=Tanggal )#1064#(?=;)", "#1069#", 1)
aturan("K9b", R + r"\[JS\] 2\. Relaas Pemberitahuan Putusan T", r"#1064##7100#", "#11216#", 1)
# K8 panggilan ikrar: bukan "untuk pemeriksaan perkara" (#7099#) tetapi menghadiri sidang penyaksian ikrar (keputusan pengguna 30 Okt)
aturan("K8", R + r"\[JS\] 4\. Relaas Panggilan Ikrar Talak P dan T", r"#7099#", "untuk menghadiri sidang penyaksian ikrar talak dalam perkara #0053# #0048# antara :", 2)
for lama, baru in (("7108", "11205"), ("7109", "11206"), ("7008", "11207"), ("7006", "11208"),
                   ("9564", "11209"), ("9565", "11210")):
    aturan("K2-" + lama, R, "#%s#" % lama, "#%s#" % baru, None)
# K3 tanda tangan penerima pemberitahuan putusan #0046# ikut aturan e-Court (#7153# = #0098# bila bukan e-Court, kosong bila e-Court)
aturan("K3", R + r"\[JS\] 2\. Relaas Pemberitahuan Putusan P", r"#0098#(?=\s+#6032#,)", "#7153#", 1)
# K4 panggilan ikrar: perintah = penetapan hari sidang IKRAR (#1099#), bukan PHS pemeriksaan pokok (#1064#)
aturan("K4a", R + r"\[JS\] 4\. Relaas Panggilan Ikrar Talak P dan T", r"(?<=Tanggal )#1064#(?!#7100#)", "#1099#", 1)
aturan("K4b", R + r"\[JS\] 4\. Relaas Panggilan Ikrar Talak P dan T", r"#1064##7100#", "#11214#", 1)
# K5 relaas e-Court: tanggal di bawah = tanggal relaas sidang itu, bukan tanggal penunjukan jurusita (#0180#)
aturan("K5a", R + r"\[JS\] 5\.1\. ", r"(?<=#8011#, )#0180#", "#11200#", 1)
aturan("K5b", R + r"\[JS\] (5\.2\.|7\.) ", r"(?<=#8011#, )#0180#", "#11201#", 1)
# K6 pemberitahuan putusan verstek e-Court
F62 = R + r"\[JS\] 6\.2\. "
aturan("K6a", F62, r"umur #0103#,", "umur #0103# tahun,", 1)
aturan("K6b", F62, r" dengan domisili elektronik pada alamat email #8180# sebagai #0047#;", "#8811#, sebagai #0047#;", 1)
aturan("K6c", F62, r"tanggal #1278#  dalam", "tanggal #1069# dalam", 1)
aturan("K6d", F62, r"(?m)^Melawan$", "Lawan", 1)
aturan("K6e", F62, r"kediaman Termohon;", "kediaman #0047#;", 1)
# K6f upaya hukum ditentukan kehadiran (keputusan pengguna 30 Okt), kalimat dan pasal dari satu tempat (#11211#)
aturan("K6f", F62, r"#0047# dapat mengajukan perlawanan \(verzet\) dalam tenggang waktu 14 \(empat belas\) hari terhitung sejak hari "
       r"berikutnya setelah pemberitahuan ini", "#11211#", 1)
# K7 surat permohonan bantuan panggilan delegasi: PA tujuan dari SIPP delegasi_keluar (bukan potongan alamat #0105#)
F3A = R + r"\[JS\] 3\.a\. "
aturan("K7a", F3A, r"(?<=Ketua )#1066#", "#11202#", 1)
aturan("K7b", F3A, r"#1167#", "#11203#", 1)
aturan("K7c", F3A, r"wilayah hukum #1066# kami", "wilayah hukum #11202#, kami", 1)
P = r"^99 PTSP/@ "
# P1 penetapan hari sidang: yang dibaca Ketua Majelis = Penetapan Ketua Pengadilan (PMH, #7051#), bukan "Penetapan Ketua Majelis"
aturan("P1", P + r"(0 - PMH - PHS|2 - PHS|2a - PHS|2b - PHS)", r"membaca Penetapan #0668# Nomor", "membaca Penetapan #7051# #8008# Nomor", 1)
# P2 ejaan penunjukan PP/JS: "tentang" huruf kecil, "Tahun" huruf besar, koma sebelum PERMA
FP = P + r"(0 - PMH - PHS|0a - PPP|0b - PJS|3 - PMH - PHS Ikrar Talak)"
aturan("P2a", FP, r"(?<=Tahun \d{4}) Tentang ", " tentang ", None)
aturan("P2b", FP, r"(?<=Nomor 7 )tahun 2022", "Tahun 2022", None)
aturan("P2c", FP, r"(?<=Nomor 50 Tahun 2009)\. (?=Peraturan Mahkamah Agung)", ", ", None)
aturan("P2d", FP, r"(?<=#1060#) Tentang Penetapan", " tentang Penetapan", None)


def tambal(rel, raw):
    """rel = 'folder/berkas.rtf' relatif derry_briantono. -> (raw_baru, hitung) ; raw_baru = raw bila tidak ada aturan yang kena."""
    tampak, pos, kendali = urai(raw)
    potong = []          # (a, b, pengganti, kode)
    hitung = {}
    for kode, fb, pola, ganti, jumlah in ATURAN:
        if not fb.search(rel):
            continue
        cocok = list(pola.finditer(tampak))
        if jumlah is not None and len(cocok) != jumlah:
            raise ValueError("%s: aturan %s cocok %d kali (harus %d)" % (rel, kode, len(cocok), jumlah))
        for m in cocok:
            potong.append((m.start(), m.end(), ganti, kode))
        if cocok:
            hitung[kode] = hitung.get(kode, 0) + len(cocok)
    if not potong:
        return raw, hitung
    potong.sort()
    for i in range(1, len(potong)):
        if potong[i][0] < potong[i - 1][1]:
            raise ValueError("%s: aturan bertumpuk %s/%s" % (rel, potong[i - 1][3], potong[i][3]))
    harap = []
    k = 0
    ubah = {}            # posisi bait -> pengganti (bytes) atau b"" (hapus)
    for a, b, ganti, kode in potong:
        harap.append(tampak[k:a])
        harap.append(ganti)
        k = b
        bait = [pos[i] for i in range(a, b)]
        if any(x is None for x in bait):
            raise ValueError("%s: aturan %s mengenai huruf bukan harfiah: %r" % (rel, kode, tampak[a:b]))
        if not bait:
            raise ValueError("%s: aturan %s cocok kosong" % (rel, kode))
        assert all(c not in ganti for c in "\\{}\n\r\t"), kode
        ubah[bait[0]] = ganti.encode("latin1")
        for x in bait[1:]:
            ubah[x] = b""
    harap.append(tampak[k:])
    keluar = bytearray()
    for i, c in enumerate(raw):
        if i in ubah:
            keluar += ubah[i]
        else:
            keluar.append(c)
    baru = bytes(keluar)
    t2, _, k2 = urai(baru)
    if t2 != "".join(harap):
        raise ValueError("%s: teks tampak sesudah tambal tidak sesuai harapan" % rel)
    if k2 != kendali:
        raise ValueError("%s: urutan kata kendali berubah" % rel)
    return baru, hitung
