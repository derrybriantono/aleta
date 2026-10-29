"""Pemecah RTF blangko ABT menjadi SATUAN (paragraf / baris tabel) di tingkat teratas dokumen.

RTF ABT (simpan LibreOffice/Word) menaruh tiap paragraf di tingkat 1: `\\pard ... {run}{run \\par }`, dan
tiap baris tabel: `\\trowd ... {..\\cell }...{\\trowd .. \\row }`. Batas satuan = sesudah grup tingkat 2 yang
memuat `\\par`/`\\row` langsung, atau sesudah kata `\\par`/`\\row` di tingkat 1. Data diperlakukan sebagai
str latin1 (1 karakter = 1 bait) sehingga potongan dapat disambung ulang persis tanpa mengubah bait lain.
"""
import re

KATA = re.compile(r'\\([a-zA-Z]+)(-?\d+)? ?')


def satuan(d):
    """Kembalikan daftar (awal, akhir, kedalaman_awal, kedalaman_akhir) satuan.

    Batas = sesudah kata `\par`/`\row` (di kedalaman berapa pun) beserta kurung tutup sesudahnya yang menutup grup
    yang dibuka DI DALAM satuan itu sendiri (di atas kedalaman terendah satuan). Potongan satuan a..b boleh dibuang/diganti hanya bila
    kedalaman_awal(a) == kedalaman_akhir(b) (diperiksa pemanggil, juga dengan seimbang())."""
    hasil = []
    depth = 0
    start, sd, low = 0, 0, 0
    pend = False
    i, n = 0, len(d)
    while i < n:
        c = d[i]
        if pend:
            if c in ' '+chr(13)+chr(10):
                i += 1
                continue
            if c == '}' and depth > low:
                depth -= 1
                i += 1
                continue
            hasil.append((start, i, sd, depth))
            start, sd, pend = i, depth, False
            low = depth
            continue
        if c == '{':
            depth += 1
            i += 1
            continue
        if c == '}':
            depth -= 1
            low = min(low, depth)
            i += 1
            continue
        if c == '\\':
            if i + 1 < n and d[i + 1] in '\\{}~-_*:|':
                i += 2
                continue
            if i + 1 < n and d[i + 1] == "'":
                i += 4
                continue
            m = KATA.match(d, i)
            if m:
                w = m.group(1)
                if w == 'bin' and m.group(2):
                    i = m.end() + int(m.group(2))
                    continue
                if w in ('par', 'row'):
                    pend = True
                i = m.end()
                continue
            i += 1
            continue
        i += 1
    hasil.append((start, n, sd, depth))
    return hasil


def seimbang(s):
    """Neraca kurung kurawal potongan RTF (abaikan yang di-escape); kembalikan (neraca akhir, minimum)."""
    dep = mn = 0
    i = 0
    while i < len(s):
        c = s[i]
        if c == '\\':
            i += 2
            continue
        if c == '{':
            dep += 1
        elif c == '}':
            dep -= 1
            mn = min(mn, dep)
        i += 1
    return dep, mn
