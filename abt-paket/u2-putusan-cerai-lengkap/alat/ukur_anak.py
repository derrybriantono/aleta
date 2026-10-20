# -*- coding: utf-8 -*-
"""Ukur pengisi tab Anak (isian 2004 diasuh_oleh, 4106 keadaan anak) atas amar putusan cerai NYATA.
Masukan: berkas TSV hasil kueri server (baca saja): perkara_id, jenis, tanggal_putusan, anak (diasuh@lahir,...), amar.
Kebenaran dasar = amar yang diucapkan hakim:
  2004  pihak pemegang asuhan yang disebut setelah kata asuhan/hadhanah/pemeliharaan/pengasuhan (Penggugat|Pemohon = 1, Tergugat|Termohon = 2)
  4106  umur anak yang disebut di amar ('umur N tahun') >= 12 = mumayyiz; atau kata 'belum mumayyiz' / 'mumayyiz' di amar
Pakai: python ukur_anak.py <masukan.tsv> <keluar.json>"""
import datetime, json, re, sys

ROLE = r'(Penggugat|Pemohon|Tergugat|Termohon)'
POLA_PEMEGANG = [
    re.compile(r'(?:diberikan|diserahkan|ditetapkan|jatuh)\s+kepada\s+' + ROLE + r'', re.I),
    re.compile(r'(?:asuhan|hadhanah|hadlanah|pemeliharaan|pengasuhan|hak asuh)\s*(?:\([^)]*\))?\s*(?:anak\s+)?' + ROLE + r'(?!\s+(?:dan|atau|serta)\s+(?:Penggugat|Pemohon|Tergugat|Termohon))', re.I),
    re.compile(ROLE + r'\s+(?:sebagai|selaku)\s+pemegang\s+(?:hak\s+)?(?:asuh|hadhanah|pemeliharaan)', re.I),
]


def umur(lahir, pada):
    a = datetime.date.fromisoformat(lahir)
    b = datetime.date.fromisoformat(pada)
    return b.year - a.year - ((b.month, b.day) < (a.month, a.day))


def pemegang(amar):
    t = re.sub(r'<[^>]+>', ' ', amar)
    t = re.sub(r'\s+', ' ', t)
    hasil = []
    for pola in POLA_PEMEGANG:
        hasil += [m.group(1).lower() for m in pola.finditer(t)]
    if not hasil:
        return None
    kode = {('1' if h in ('penggugat', 'pemohon') else '2') for h in hasil}
    return kode.pop() if len(kode) == 1 else 'campur'


def main():
    baris = [l.rstrip('\n').split('\t') for l in open(sys.argv[1], encoding='utf-8')][1:]
    a = {'n': 0, 'cocok': 0, 'salah': [], 'lewat_tab_campur': 0, 'lewat_amar_campur': 0, 'lewat_tanpa_pemegang': 0}
    b = {'n': 0, 'cocok': 0, 'salah': [], 'lewat_campuran_umur': 0, 'lewat_tanpa_petunjuk': 0}
    for pid, jn, tgl, anak, amar in baris:
        daftar = [x.split('@') for x in anak.split(',') if x]
        kode = {x[0] for x in daftar}
        # 2004
        if len(kode) != 1 or list(kode)[0] not in ('1', '2'):
            a['lewat_tab_campur'] += 1
        else:
            p = pemegang(amar)
            if p is None:
                a['lewat_tanpa_pemegang'] += 1
            elif p == 'campur':
                a['lewat_amar_campur'] += 1
            else:
                a['n'] += 1
                if p == list(kode)[0]:
                    a['cocok'] += 1
                else:
                    a['salah'].append(pid)
        # 4106
        if all(x[1] not in ('-', '0000-00-00') for x in daftar):
            um = [umur(x[1], tgl) for x in daftar]
            mm = [u >= 12 for u in um]
            if any(mm) and not all(mm):
                b['lewat_campuran_umur'] += 1
                continue
            teks = re.sub(r'<[^>]+>', ' ', amar)
            angka = [int(x) for x in re.findall(r'[Uu]mur\s+(\d{1,2})\s+\(?[a-z ]*\)?\s*tahun', teks)] or [int(x) for x in re.findall(r'(?:usia|umur)\s+(\d{1,2})\s*tahun', teks, re.I)]
            angka = [x for x in angka if x <= 18]  # 'umur 21 tahun' = batas nafkah anak, bukan umur anak
            if angka:
                benar = all(x >= 12 for x in angka)
                if any(x >= 12 for x in angka) and not benar:
                    b['lewat_campuran_umur'] += 1
                    continue
            elif re.search(r'belum\s+mumayyiz', teks, re.I):
                benar = False
            elif re.search(r'mumayyiz', teks, re.I):
                benar = True
            else:
                b['lewat_tanpa_petunjuk'] += 1
                continue
            b['n'] += 1
            if benar == all(mm):
                b['cocok'] += 1
            else:
                b['salah'].append(pid)
    for d in (a, b):
        d['persen'] = round(100 * d['cocok'] / d['n'], 1) if d['n'] else None
    json.dump({'2004_diasuh_oleh': a, '4106_mumayyiz': b, 'berkas': sys.argv[1], 'perkaraKandidat': len(baris)}, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps({'2004': a, '4106': b}, ensure_ascii=False))


if __name__ == '__main__':
    main()
