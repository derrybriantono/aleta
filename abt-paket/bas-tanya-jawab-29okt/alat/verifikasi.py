"""Periksa hasil terapkan_pohon: teks sebelum/sesudah tiap berkas hanya berbeda pada blok saksi.

Pakai: python verifikasi.py <akar dasar derry_briantono> <folder hasil (berisi rtf/ dan laporan.json)> <keluar.json>
Untuk tiap berkas: baris teks yang HILANG harus semuanya ada di blok yang dibuang (teks_dibuang), baris yang BARU hanya
penanda variabel tanya-jawab / kalimat sumpah patokan; kurung seimbang; tanpa kata nama aplikasi; RTF dibaca ulang.
"""
import difflib, json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sumber'))
from rtf2txt import rtf_ke_teks
from rtfsatuan import seimbang
from saksi_blok import kenali, TJ_SEMUA


def panjang(p):
    p = os.path.abspath(p)
    a = chr(92) * 2 + '?' + chr(92)
    return p if (os.name != 'nt' or p.startswith(a)) else a + p.replace('/', chr(92))


def baris(t):
    return [re.sub(r'\s+', ' ', x).strip() for x in t.split('\n') if x.strip()]


BARU_SAH = re.compile(r'^((#\d{4}#\s*)+$|#\d{4}#|Selanjutnya saksi tersebut bersumpah menurut tata cara agama #\d{4}# dengan mengucapkan sumpah dengan lafal sebagai berikut :|“#\d{4}#”;)$')


def main():
    dasar, hasil, kel = sys.argv[1], sys.argv[2], sys.argv[3]
    lap = json.load(open(os.path.join(hasil, 'laporan.json'), encoding='utf-8'))
    out = []
    bad = 0
    for x in lap:
        r = x['jalur']
        lama = open(panjang(os.path.join(dasar, r)), 'rb').read().decode('latin1')
        baru = open(panjang(os.path.join(hasil, 'rtf', r)), 'rb').read().decode('latin1')
        tl, tb = baris(rtf_ke_teks(lama)), baris(rtf_ke_teks(baru))
        hilang, tambah = [], []
        for op, a1, a2, b1, b2 in difflib.SequenceMatcher(None, tl, tb, autojunk=False).get_opcodes():
            if op in ('replace', 'delete'):
                hilang += tl[a1:a2]
            if op in ('replace', 'insert'):
                tambah += tb[b1:b2]
        dibuang = set()
        for bl in x['blok']:
            for t in bl.get('teks_dibuang', []):
                for y in baris(t):
                    dibuang.add(y)
        salah_hilang = [h for h in hilang if h not in dibuang and not re.fullmatch(r'(\s*#\d{4}#\s*)+', h)]
        salah_tambah = [t for t in tambah if not BARU_SAH.match(t)]
        # sesudah: semua blok saksi berstatus SUDAH
        _, _, bl2 = kenali(baru, x['jenis'] == 'BAS')
        belum = [b['saksi'] + ':' + b['keadaan'] for b in bl2 if b['keadaan'] != 'SUDAH']
        # pemeriksaan teks mandiri (tidak memakai pengenal blok): sesudah tiap baris identitas saksi, baris isi pertama
        # (BAS: sesudah baris "... pertanyaan kepada saksi ... sebagai berikut") harus penanda variabel tanya-jawab
        pi = re.compile(r'#(1197|1203|6132|6144|8924|6100|6106|6138|8934)#\s*,?\s*(\(.{0,40}\)\s*,?\s*)?umur')
        pq = re.compile(r'(pertanyaan|bertanya)\b.*\bsaksi\b.*sebagai berikut\s*[:;]?\s*$', re.I)
        for i, t in enumerate(tb):
            if not pi.search(t):
                continue
            j = i + 1
            if x['jenis'] == 'BAS':
                while j < len(tb) and j < i + 7 and not pq.search(tb[j]):
                    j += 1
                j += 1
            nx = tb[j] if j < len(tb) else ''
            if not (set(re.findall(r'#(\d{4})#', nx)) & TJ_SEMUA) and not (set(re.findall(r'#(\d{4})#', t[pi.search(t).end():])) & TJ_SEMUA):
                belum.append('teks:%s:%s' % (pi.search(t).group(1), nx[:60]))
        cek = dict(jalur=r, hilang=len(hilang), tambah=len(tambah), salah_hilang=salah_hilang[:5], salah_tambah=salah_tambah[:5],
                   belum=belum, seimbang=seimbang(baru) == seimbang(lama), aplikasi=bool(re.search(r'aleta', baru, re.I)),
                   crlf_sama=lama.count('\r\n') - baru.count('\r\n'), tambah_isi=tambah)
        ok = not salah_hilang and not salah_tambah and not belum and cek['seimbang'] and not cek['aplikasi']
        cek['ok'] = ok
        bad += 0 if ok else 1
        out.append(cek)
    json.dump(out, open(kel, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('berkas', len(out), 'tidak-ok', bad)
    for c in out:
        if not c['ok']:
            print('TIDAK OK', c['jalur'], c['salah_hilang'][:2], c['salah_tambah'][:2], c['belum'], c['seimbang'], c['aplikasi'])


if __name__ == '__main__':
    main()
