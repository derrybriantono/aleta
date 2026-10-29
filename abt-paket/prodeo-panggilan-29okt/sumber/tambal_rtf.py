# -*- coding: utf-8 -*-
"""Penambal RTF blangko Derry (paket prodeo-panggilan-29okt). Python 3, LAPTOP saja (server menerima berkas jadi lewat berkas_rtf.py).

Bekerja pada TEKS TAMPAK: setiap huruf tampak dipetakan ke satu bait mentah RTF (hanya teks harfiah; huruf dari \\'xx / \\u /
simbol kendali = tidak boleh disentuh). Aturan dicari pada teks tampak; penanda jangkar (#NNNN#) diganti penanda baru di tempat
bait mentahnya, huruf tampak lain di rentang aturan dihapus bait mentahnya. Kata kendali, kurung kurawal, dan isi tujuan (fonttbl,
info, {\\*...}) tidak pernah diubah. Sesudah ditambal diperiksa ulang: (1) teks tampak baru = teks tampak lama dengan penggantian
yang sama, (2) urutan kata kendali + kurawal sama persis, (3) tidak ada penanda yang hilang selain yang memang diganti.

Aturan (lihat ATURAN di bawah):
  A  amar biaya   "#8505# (#0155# #7095#)"                      -> "#11122#"   (semua berkas: putusan, penetapan, BAS)
  R  rincian      blok "Rincian Biaya Perkara" .. paren Jumlah: penanda pos -> cermin prodeo-0; "(#0155# #7095#)" /
                  "(#0155# rupiah)" -> "(#11123#)"; rincian ikrar (#1090# #1164# #1101#, "(#2050# rupiah)" -> "(#11124#)")
  P  panggilan    (bukan BAS/relaas) "#1076# dan tanggal #0118#" -> "#11120#", "#1077# dan tanggal #0120#" -> "#11121#",
                  "dipanggil dengan sah dan patut, pada tanggal #1077#," dan "Nomor #0001# tanggal #1077# yang dibacakan" -> #11121#
pakai: python tambal_rtf.py <akar derry_briantono asal> <akar keluaran> [daftar.tsv]
"""
import hashlib
import io
import os
import re
import sys

LEWAT = {"fonttbl", "colortbl", "stylesheet", "info", "pict", "listtable", "listoverridetable", "rsidtbl", "generator",
         "xmlnstbl", "themedata", "colorschememapping", "datastore", "latentstyles", "mmathPr", "pgdsctbl", "header",
         "footer", "headerl", "headerr", "footerl", "footerr", "headerf", "footerf", "object", "fldinst", "filetbl",
         "revtbl", "protusertbl", "userprops", "docvar", "bkmkstart", "bkmkend", "field"}
# "field" TIDAK dilewati isinya (fldrslt tampak), hanya fldinst. Hapus "field" dari LEWAT:
LEWAT.discard("field")
TOK = re.compile(rb"\\([a-zA-Z]+)(-?\d+)? ?|\\'([0-9a-fA-F]{2})|\\(.)|([{}])|([^\\{}\r\n]+)|([\r\n]+)", re.S)

PETA_RINCIAN = {"0279": "11130", "6060": "11131", "6074": "11132", "6063": "11133", "8891": "11134", "0312": "11135",
                "0281": "11136", "5223": "11137", "0242": "11138", "0244": "11139", "0143": "11140",
                "1090": "11141", "1164": "11142", "1101": "11143"}
AMAR, JUMLAH, JUMLAH_IKRAR = "11122", "11123", "11124"
TGL_P, TGL_T = "11120", "11121"


def urai(raw):
    """-> (tampak: str, posisi: list[int|None] bait mentah per huruf tampak, kendali: list[bytes] kata kendali+kurawal)."""
    tampak, pos, kendali = [], [], []
    tumpuk, lewat, awal = [], False, False
    for m in TOK.finditer(raw):
        kata, arg, hx, sim, kur, isi, gb = m.groups()
        if kur is not None:
            kendali.append(kur)
            if kur == b"{":
                tumpuk.append(lewat); awal = True
            else:
                lewat = tumpuk.pop() if tumpuk else False; awal = False
            continue
        if gb is not None:
            continue
        if sim is not None:
            kendali.append(b"\\" + sim)
            if sim == b"*" and awal:
                lewat = True
            elif not lewat:
                if sim in b"\\{}":
                    tampak.append(sim.decode("latin1")); pos.append(None)
                elif sim == b"~":
                    tampak.append(" "); pos.append(None)
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
                tampak.append("\n"); pos.append(None)
            elif k == "tab":
                tampak.append("\t"); pos.append(None)
            elif k == "u" and arg:
                tampak.append(chr(int(arg) % 65536)); pos.append(None)
            continue
        awal = False
        if hx is not None:
            kendali.append(b"\\'" + hx)
            if not lewat:
                tampak.append(bytes([int(hx, 16)]).decode("cp1252", "replace")); pos.append(None)
            continue
        if isi is not None and not lewat:
            s = m.start(6)
            for i, b in enumerate(isi):
                tampak.append(chr(b)); pos.append(s + i)
    return "".join(tampak), pos, kendali


def adalah_bas(rel):
    r = rel.replace("\\", "/")
    return " - BAS" in r or "/BAS " in r or "BAS " in os.path.basename(r) or "Relaas" in r or "/ALUR " in r or "PTSP" in r


ATURAN = []


def aturan(nama, pola, jangkar, baru, hanya_putusan=False):
    ATURAN.append((nama, re.compile(pola), jangkar, baru, hanya_putusan))


aturan("A", r"#8505# \(#0155# #7095#\)", "#8505#", "#" + AMAR + "#")
# amar biaya tertulis langsung yang memakai #7095# (maksudnya sudah sadar prodeo, tetapi nominal & terbilang tetap tercetak)
aturan("A2", r"Membebankan kepada #7036# untuk membayar biaya perkara ini sejumlah Rp#8504#,00 \(#0155# #7095#\)", "#7036#", "#" + AMAR + "#")
aturan("P1", r"#1076# dan tanggal #0118#", "#1076#", "#" + TGL_P + "#", True)
aturan("P2", r"#1077# dan tanggal #0120#", "#1077#", "#" + TGL_T + "#", True)
aturan("P3", r"(?<=dipanggil dengan sah dan patut, pada tanggal )#1077#(?=,)", "#1077#", "#" + TGL_T + "#", True)
aturan("P4", r"(?<=Nomor #0001# tanggal )#1077#(?= yang dibacakan)", "#1077#", "#" + TGL_T + "#", True)

# Amar biaya "Membebankan ... sejumlah Rp#0143#/#8504#,00 (#0155# #7095#|rupiah)" yang ditulis langsung (bukan #8505#).
# "Menghukum ..." (perkara kontensius: pihak kalah) dan isian kesepakatan #9354# (perdamaian) TIDAK disentuh.
POLA_VARIAN = re.compile(r"Membebankan (?:(?!Membebankan)[^.;\n()]){0,220}?sejumlah Rp\.? ?#(?:0143|8504|1101)#,00 \((?:#0155# (?:#7095#|rupiah)|#2050# rupiah)\)")
VARIAN_TOLAK = ("#9354#",)
VARIAN = {}        # kalimat -> nomor variabel (diisi bangun_paket.py)
DIKUMPUL = set()   # kalimat yang ditemukan tetapi belum bernomor

RINCIAN_AWAL = re.compile(r"Rincian Biaya Perkara")
RINCIAN_JUMLAH = re.compile(r"J ?u ?m ?l ?a ?h\s*:\s*Rp\.?\s*#(0143|1101|3993)#,00")
PAREN = re.compile(r"\((#0155# #7095#|#0155# rupiah|#2050# rupiah|#3994# rupiah)\)")


def cari_edit(t, rel):
    """-> daftar (mulai, akhir, jangkar_mulai, jangkar_akhir, pengganti, nama) pada teks tampak + catatan."""
    edit, catatan = [], []
    bas = adalah_bas(rel)
    for nama, pola, jangkar, baru, hp in ATURAN:
        if hp and bas:
            continue
        for m in pola.finditer(t):
            j = m.group(0).find(jangkar)
            edit.append((m.start(), m.end(), m.start() + j, m.start() + j + len(jangkar), baru, nama))
    # rincian
    for m in RINCIAN_AWAL.finditer(t):
        jm = RINCIAN_JUMLAH.search(t, m.end())
        if not jm or jm.start() - m.end() > 4000:
            catatan.append("rincian tanpa baris Jumlah")
            continue
        if jm.group(1) == "3993":
            catatan.append("rincian verzet (#3993#) dibiarkan")
            continue
        pm = PAREN.search(t, jm.end(), jm.end() + 400)
        antara = re.sub(r"Untuk Salinan|#8008#|Panitera,|#8004#|Terbilang\s*:|\s", "", t[jm.end():pm.start()]) if pm else "x"
        if antara:
            catatan.append("rincian tanpa kurung terbilang")
            continue
        blok_akhir = jm.end()
        for tm in re.finditer(r"#(\d{4})#", t[m.end():blok_akhir]):
            v = tm.group(1)
            a = m.end() + tm.start()
            if v in PETA_RINCIAN:
                edit.append((a, a + 6, a, a + 6, "#" + PETA_RINCIAN[v] + "#", "R"))
            elif v not in ("8008", "8004"):
                catatan.append("rincian memuat #%s# (dibiarkan)" % v)
        isi = pm.group(1)
        baru = "#" + (JUMLAH_IKRAR if isi.startswith("#2050#") else JUMLAH) + "#"
        if isi.startswith("#3994#"):
            continue
        a = pm.start() + 1
        edit.append((a, pm.end() - 1, a, a + 6, baru, "RJ"))
    # amar biaya tertulis langsung di blangko (putusan dan BAS): satu variabel per bentuk kalimat (VARIAN, disusun bangun_paket.py)
    for m in POLA_VARIAN.finditer(t):
        if any(m.start() < e[1] and e[0] < m.end() for e in edit):
            continue
        lit = m.group(0)
        if any(x in lit for x in VARIAN_TOLAK):
            continue
        tm = re.search(r"#\d{4}#", lit)
        if lit not in VARIAN:
            DIKUMPUL.add(lit)
            continue
        ja = m.start() + tm.start()
        edit.append((m.start(), m.end(), ja, ja + 6, "#%d#" % VARIAN[lit], "AV"))
    edit.sort()
    for x, y in zip(edit, edit[1:]):
        if y[0] < x[1]:
            raise ValueError("aturan bertumpuk %s %s" % (x[5], y[5]))
    return edit, catatan


def tambal(raw, rel):
    t, pos, kendali = urai(raw)
    edit, catatan = cari_edit(t, rel)
    if not edit:
        return raw, {}, catatan
    ganti = {}   # posisi mentah -> (panjang, pengganti)
    hapus = set()
    harap = []
    akhir = 0
    for (a, b, ja, jb, baru, nama) in edit:
        harap.append(t[akhir:a]); harap.append(baru); akhir = b
        ps = pos[a:b]
        if any(p is None for p in ps):
            raise ValueError("aturan %s menyentuh huruf bukan teks harfiah" % nama)
        jp = pos[ja:jb]
        if jp != list(range(jp[0], jp[0] + len(jp))):
            raise ValueError("jangkar %s terpecah di RTF" % nama)
        ganti[jp[0]] = (len(jp), baru.encode("latin1"))
        for i in range(a, b):
            if not (ja <= i < jb):
                hapus.add(pos[i])
    harap.append(t[akhir:])
    out = bytearray()
    i = 0
    n = len(raw)
    while i < n:
        if i in ganti:
            ln, b = ganti[i]
            out += b; i += ln; continue
        if i in hapus:
            i += 1; continue
        out.append(raw[i]); i += 1
    baru = bytes(out)
    t2, _, k2 = urai(baru)
    if t2 != "".join(harap):
        raise ValueError("periksa teks gagal")
    if k2 != kendali:
        raise ValueError("periksa kata kendali gagal")
    hit = {}
    for e in edit:
        hit[e[5]] = hit.get(e[5], 0) + 1
    return baru, hit, catatan


def main():
    asal, keluar = sys.argv[1], sys.argv[2]
    daftar = sys.argv[3] if len(sys.argv) > 3 else os.path.join(keluar, "_daftar.tsv")
    baris = []
    total = {}
    for akar, _, fs in os.walk(asal):
        for f in sorted(fs):
            if not f.lower().endswith(".rtf"):
                continue
            p = os.path.join(akar, f)
            rel = os.path.relpath(p, asal).replace("\\", "/")
            raw = open(p, "rb").read()
            try:
                baru, hit, cat = tambal(raw, rel)
            except ValueError as e:
                baris.append((rel, hashlib.md5(raw).hexdigest(), "", "GAGAL " + str(e), ""))
                continue
            if baru == raw:
                if cat:
                    baris.append((rel, hashlib.md5(raw).hexdigest(), "", "TETAP", "; ".join(sorted(set(cat)))))
                continue
            q = os.path.join(keluar, rel)
            os.makedirs(os.path.dirname(q), exist_ok=True)
            open(q, "wb").write(baru)
            for k, v in hit.items():
                total[k] = total.get(k, 0) + v
            baris.append((rel, hashlib.md5(raw).hexdigest(), hashlib.md5(baru).hexdigest(),
                          " ".join("%s=%d" % kv for kv in sorted(hit.items())), "; ".join(sorted(set(cat)))))
    with io.open(daftar, "w", encoding="utf-8") as o:
        o.write("# berkas\tmd5_lama\tmd5_baru\taturan\tcatatan\n")
        for b in baris:
            o.write("\t".join(b) + "\n")
    print("berkas diubah %d, gagal %d, tetap-bercatatan %d" % (sum(1 for b in baris if b[2]), sum(1 for b in baris if b[3].startswith("GAGAL")),
                                                              sum(1 for b in baris if b[3] == "TETAP")))
    print(" ".join("%s=%d" % kv for kv in sorted(total.items())))


if __name__ == "__main__":
    main()
