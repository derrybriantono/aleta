# -*- coding: utf-8 -*-
"""
Perkakas tambal RTF blangko Derry (bita cp1252 dibaca sebagai latin1, ditulis kembali apa adanya).
Aturan: setiap jangkar harus ditemukan TEPAT sebanyak yang diharapkan; bila tidak, GagalTambal dilempar dan berkas tidak ditulis.
Paragraf RTF blangko: \\pard <sifat> {run1}{run2}...{runN \\par }.
"""
import re


class GagalTambal(Exception):
    pass


def hitung(d, jangkar, jumlah, berkas):
    n = d.count(jangkar)
    if n != jumlah:
        raise GagalTambal("%s: jangkar ditemukan %d kali (harap %d): %s" % (berkas, n, jumlah, jangkar[:90]))


def ganti_teks(d, lama, baru, jumlah, berkas):
    """Ganti teks mentah yang berada di dalam satu run (jangkar tidak boleh terpecah antar-grup)."""
    hitung(d, lama, jumlah, berkas)
    return d.replace(lama, baru)


def batas_paragraf(d, jangkar, berkas, urut=None):
    """(awal, akhir) paragraf yang memuat jangkar; jangkar harus unik kecuali urut dipakai (urut ke-n dari kiri)."""
    if urut is None:
        hitung(d, jangkar, 1, berkas)
        i = d.find(jangkar)
    else:
        i = -1
        for _ in range(urut + 1):
            i = d.find(jangkar, i + 1)
            if i < 0:
                raise GagalTambal("%s: jangkar ke-%d tidak ada: %s" % (berkas, urut, jangkar[:80]))
    s = d.rfind("\\pard", 0, i)
    e = d.find("\\pard", i)
    if s < 0 or e < 0:
        raise GagalTambal("%s: batas paragraf tidak ditemukan: %s" % (berkas, jangkar[:80]))
    return s, e


def _grup_tingkat_atas(par):
    """Memecah isi paragraf (sesudah header) menjadi grup { ... } tingkat atas; kembalikan (header, [grup...])."""
    i = par.find("{")
    if i < 0:
        raise GagalTambal("paragraf tanpa grup")
    header = par[:i]
    grup = []
    depth = 0
    mulai = None
    j = i
    while j < len(par):
        c = par[j]
        if c == "\\":
            j += 2
            continue
        if c == "{":
            if depth == 0:
                mulai = j
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                grup.append(par[mulai : j + 1])
        j += 1
    return header, grup


def awalan_run(grup):
    """Bagian format pada awal run '{...teks}' (tanpa kurung kurawal): kata kendali berurutan sampai teks pertama (\\tab dan \\par dianggap teks)."""
    isi = grup[1:-1]
    k = 0
    while True:
        m = re.match(r"\\[a-zA-Z]+-?\d* ?", isi[k:])
        if not m:
            break
        kata = m.group(0)
        if kata.startswith("\\tab") or kata.startswith("\\par") or kata.startswith("\\line"):
            break
        k += m.end()
    return isi[:k]


def paragraf_baru(par, teks):
    """Paragraf yang sama (header + format run pertama) tetapi isinya `teks`."""
    header, grup = _grup_tingkat_atas(par)
    awalan = awalan_run(grup[0])
    return header + "{" + awalan + teks + "}" + "{" + awalan + "\\par }"


def ganti_paragraf(d, jangkar, teks, berkas, urut=None):
    s, e = batas_paragraf(d, jangkar, berkas, urut)
    return d[:s] + paragraf_baru(d[s:e], teks) + d[e:]


def hapus_paragraf(d, jangkar, berkas, urut=None):
    s, e = batas_paragraf(d, jangkar, berkas, urut)
    return d[:s] + d[e:]


def sisip_setelah(d, jangkar, teks, berkas, urut=None, tiru=None):
    """Sisipkan paragraf baru berisi `teks` tepat sesudah paragraf berjangkar; formatnya meniru paragraf `tiru` (jangkar lain) atau paragraf jangkar itu sendiri."""
    s, e = batas_paragraf(d, jangkar, berkas, urut)
    if tiru:
        ts, te = batas_paragraf(d, tiru, berkas)
        baru = paragraf_baru(d[ts:te], teks)
    else:
        baru = paragraf_baru(d[s:e], teks)
    return d[:e] + baru + d[e:]


def sisip_sebelum(d, jangkar, teks, berkas, urut=None, tiru=None):
    s, e = batas_paragraf(d, jangkar, berkas, urut)
    if tiru:
        ts, te = batas_paragraf(d, tiru, berkas)
        baru = paragraf_baru(d[ts:te], teks)
    else:
        baru = paragraf_baru(d[s:e], teks)
    return d[:s] + baru + d[s:]


def tambah_isianasal(d, kode, berkas):
    """Tambahkan penanda #nnnn# ke grup tersembunyi {\\*\\isianasal ...}; bila grup belum ada dibuat sebelum kurung kurawal penutup dokumen."""
    daftar = ["#%d#" % k for k in kode]
    m = re.search(r"(\{\\\*\\isianasal[^}]*)\}", d)
    if m:
        sudah = m.group(1)
        tambahan = [x for x in daftar if x not in sudah]
        if not tambahan:
            return d
        return d[: m.end(1)] + " " + " ".join(tambahan) + d[m.end(1) :]
    akhir = d.rstrip()
    if not akhir.endswith("}"):
        raise GagalTambal("%s: akhir dokumen bukan }" % berkas)
    i = d.rfind("}")
    return d[:i] + "{\\*\\isianasal " + " ".join(daftar) + "}" + d[i:]


def seimbang(d, berkas):
    if d.count("{") - d.count("\\{") != d.count("}") - d.count("\\}"):
        raise GagalTambal("%s: kurung kurawal tak seimbang" % berkas)
