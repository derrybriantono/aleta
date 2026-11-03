"""Cari kalimat jawaban saksi yang MENGGANTUNG: frasa tidak tahu/lupa/dsb. tanpa objek.
Menggantung bila di KLAUSA yang sama (dipisah ; , . : ? ! dan kata sambung) tidak ada kata isi selain
subjek/penegas, dan tidak ada objek sesudahnya. Bentuk "-nya" (mengetahuinya) dianggap bermakna bila
SEBELUMNYA dalam jawaban yang sama sudah ada kata isi.
pakai: python gantung.py <akar ekstensi-sipp>
"""
import json, os, re, sys, collections

NEG = re.compile(
    r"\b(?:(?:tidak|kurang|belum|tak)\s+(?:begitu\s+|terlalu\s+|pernah\s+|lagi\s+|sama\s+sekali\s+|tahu-|terlalu\s+)*"
    r"(?:tahu(?:\s+menahu)?|mengetahui|ketahui|ingat|mengingat|melihat|lihat|mendengar|dengar|kenal|mengenal|jelas|paham|memahami|yakin|pasti|menyaksikan)(nya)?"
    r"|lupa(?:-lupa\s+ingat)?|ragu(?:-ragu)?)\b", re.I)
PENGISI = set('''saya saksi aku ya iya ia tidak tak sama sekali juga memang betul benar sungguh pak bu ibu bapak yang mulia
terus terang kalau itu dan jadi maka sudah agak kurang masih pernah lagi apa pun apapun menahu sedikit begitu terlalu
ragu lupa ingat tahu jelas yakin pasti mohon maaf hakim majelis saudara persis betul-betul sungguh-sungguh hanya
dengan pasti karena itu ini sendiri secara'''.split())
PEMISAH = re.compile(r"[;,.:!?()]|\b(?:karena|tetapi|namun|sehingga|adapun|sedangkan|melainkan|hanya\s+saja)\b|(?<!mengetahui )(?<!tahu )\bsebab\b", re.I)


def klausa(teks, a, b):
    s = 0
    for m in PEMISAH.finditer(teks):
        if m.end() <= a:
            s = m.end()
        elif m.start() >= b:
            return s, m.start()
    return s, len(teks)


def kata_isi(t):
    t = re.sub(r"\{[a-z]+\}|#\d{4,5}#", " OBJ ", t)
    return [w for w in re.findall(r"[A-Za-z][A-Za-z-]*", t) if w.lower() not in PENGISI]


def periksa(teks):
    hasil = []
    for m in NEG.finditer(teks):
        s, e = klausa(teks, m.start(), m.end())
        sebelum = kata_isi(teks[s:m.start()])
        sesudah = kata_isi(teks[m.end():e])
        if sebelum or sesudah:
            continue
        if kata_isi(teks[:s]):
            # topik di depan ("Masalah nafkah, saya tidak tahu") atau rujukan ke kalimat sebelumnya
            continue
        statif = re.search(r"(ragu|yakin|pasti|jelas|lupa|ingat)$", m.group(0), re.I)
        if m.group(1) or statif:
            # -nya / kata keadaan (ragu, kurang pasti, lupa): bermakna bila sebelumnya sudah ada kata isi di jawaban
            if kata_isi(teks[:s]):
                continue
        hasil.append(m)
    return hasil


def daun(x, jalan):
    if isinstance(x, str):
        yield jalan, x
    elif isinstance(x, list):
        for i, v in enumerate(x):
            yield from daun(v, jalan + [i])
    elif isinstance(x, dict):
        for k, v in x.items():
            yield from daun(v, jalan + [k])


if __name__ == '__main__':
    akar = sys.argv[1]
    rek = collections.Counter()
    for d in ('saksi-katalog', 'saksi-katalog-jenis'):
        for f in sorted(os.listdir(os.path.join(akar, d))):
            j = json.load(open(os.path.join(akar, d, f), encoding='utf-8'))
            for q in j.get('pertanyaan', []):
                for jal, t in daun(q.get('jawaban') or {}, []):
                    if 'maksud' in jal:
                        continue
                    for m in periksa(t):
                        rek[(d, f)] += 1
                        print('%s/%s\t%s\t%s\t%s\t%s\t%s' % (d, f, q['id'], '.'.join(map(str, jal)), t, q.get('hal', ''), q.get('teks', '')))
                if not q.get('hal'):
                    rek[(d, f, 'TANPA-HAL')] += 1
                    print('%s/%s\t%s\tTANPA-HAL\t\t\t%s' % (d, f, q['id'], q.get('teks', '')))
            for kunci in ('jawabanUmum', 'pilihanDaftar', 'profilSaksi'):
                for jal, t in daun(j.get(kunci) or {}, [kunci]):
                    if 'maksud' in jal:
                        continue
                    for m in periksa(t):
                        rek[(d, f, kunci)] += 1
                        print('%s/%s\t%s\t%s\t%s' % (d, f, kunci, '.'.join(map(str, jal)), t))
    for k, n in sorted(rek.items()):
        print('#REKAP', n, k)
