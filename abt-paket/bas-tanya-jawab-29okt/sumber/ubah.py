"""Ganti blok keterangan saksi tertulis mati dengan variabel tanya-jawab saksi ABT (format patokan).

BAS     : tabel tanya-jawab tertulis mati -> satu paragraf #5058# / #5059# / ... (TanyaJwb Saksi N, tabel tanya-jawab ABT),
          lafal sumpah Islam tertulis mati -> "tata cara agama #1199# ..." + "\u201c#7029#\u201d;" (sama dengan patokan BAS).
putusan : butir "- Bahwa ..." tertulis mati -> satu paragraf #9259# / #9260# / ... (keterangan saksi dari tanya-jawab ABT
          yang sama; fungsi isian_rtf_ket_saksi), sama dengan patokan putusan Format Lengkap.
Bait di luar blok yang diganti tidak berubah. Setiap potongan diperiksa neraca kurungnya.
"""
import re
from rtfsatuan import seimbang
from saksi_blok import kenali, SAKSI, TJ_SEMUA, var
from rtf2txt import rtf_ke_teks

# nama saksi -> (variabel agama saksi, variabel lafal sumpah) - sama dengan patokan BAS ALUR 02/04
SUMPAH = {
    '1197': ('1199', '7029'), '1203': ('1205', '7030'), '6132': ('6134', '7038'), '6144': ('6146', '7039'),
    '8924': ('8926', '8933'), '6100': ('6102', '7031'), '6106': ('6108', '7032'), '6138': ('6140', '7040'),
    '8934': ('8936', '8943'),
}
POLA_SUMPAH_ISLAM = re.compile(r'^Selanjutnya saksi tersebut bersumpah menurut tata cara agama Islam\b.*sebagai berikut\s*:\s*$')
POLA_LAFAL = re.compile(r'^\W*Demi Allah,? saya bersumpah\b')
RUN = re.compile(r'\{((?:\\[a-zA-Z]+-?\d* ?)+)')


class GagalUbah(Exception):
    pass


def bangun_paragraf(raw, isi, buang_fi=False):
    """Paragraf baru bergaya `raw` (satu satuan): kendali \\pard satuan itu + kendali run teks pertamanya."""
    # tanda butir daftar Word {\listtext ...} bukan bagian gaya paragraf (dan memuat \pard sendiri)
    raw = re.sub(r'\{\\listtext[^{}]*\}', '', raw)
    k = raw.find('\\pard')
    if k < 0:
        # butir tanpa \pard sendiri (mewarisi gaya paragraf sebelumnya): paragraf baru juga mewarisi, tanpa \pard
        k = 0
        b = raw.find('{')
        pre = ''
    else:
        b = raw.find('{', k)
        pre = raw[k:b] if b >= 0 else raw[k:]
    pre = re.sub(r'\\(intbl|ls\d+|ilvl\d+)\s?', '', pre)
    pre = re.sub(r'\\itap\d+', r'\\itap0', pre)
    if buang_fi:
        pre = re.sub(r'\\(cu)?fi-?\d+\s?', '', pre)
    if not pre.endswith(' '):
        pre += ' '
    ctl = None
    for m in RUN.finditer(raw, k):
        g = m.group(1)
        if g.startswith('\\listtext') or g.startswith('\\*') or g.startswith('\\trowd') or '\\cell' in g:
            continue
        # \uN adalah KARAKTER (mis. tanda kutip, tanda butir), bukan gaya: buang \uN dan sesudahnya, juga \ucN
        g = re.split(r'\\u-?\d', g)[0]
        g = re.sub(r'\\uc\d+\s?', '', g)
        g = re.sub(r'\\(cell|row|par|line|tab)\b\s?', '', g)
        if not g.strip():
            continue
        ctl = g
        break
    if ctl is None:
        ctl = ''
    ctl = re.sub(r'\\(cell|row|par|line|tab)\b\s?', '', ctl)
    if ctl and not ctl.endswith(' '):
        ctl += ' '
    p = pre + '{' + ctl + isi + '}{' + ctl + '\\par }'
    if seimbang(p) != (0, 0):
        raise GagalUbah('paragraf baru tidak seimbang')
    return p


def ubah(d, bas):
    out, cat, edit, buang = ubah_rinci(d, bas)
    return out, cat, len(edit)


def ubah_rinci(d, bas):
    """Kembalikan (data baru, daftar catatan per blok). Melempar GagalUbah bila ada potongan yang meragukan."""
    u, T, blok = kenali(d, bas)
    edit = []
    cat = []
    for b in blok:
        sk = b['saksi']
        if b['keadaan'] == 'BUTIR-LINE':
            s0, e0 = b['garis']
            v = SAKSI[sk][1]
            edit.append((s0, e0, '\\line #%s#' % v))
            dib = rtf_ke_teks(d[s0:e0]).strip()
            cat.append(dict(saksi=sk, keadaan='BUTIR-LINE', satuan=1, variabel=v,
                            var_dibuang=sorted(var(dib) - {'0046', '0047'}), teks_dibuang=[x for x in dib.split('\n') if x.strip()]))
            continue
        if b['keadaan'] == 'SUDAH' and bas and sk == '6132' and b.get('isi') == ['6122']:
            # 6122 bernama "TanyaJwb Saksi 3 T" tetapi referensinya 6132 (saksi 3 P): datanya SAMA dengan 5060
            # "TanyaJwb Saksi 3 P" (patokan). Disamakan agar penyunting tanya-jawab ABT tidak menamai saksi P sebagai saksi T.
            s1, e1 = u[b['mulai']][0], u[b['mulai']][1]
            raw = d[s1:e1]
            if raw.count('#6122#') == 1:
                k1 = s1 + raw.index('#6122#')
                edit.append((k1, k1 + 6, '#5060#'))
                cat.append(dict(saksi=sk, keadaan='GANTI-6122', satuan=0, variabel='5060', var_dibuang=['6122'],
                                teks_dibuang=['#6122#']))
                continue
        if b['keadaan'] not in ('TABEL-KERAS', 'BUTIR-KERAS'):
            cat.append(dict(saksi=sk, keadaan=b['keadaan'], isi=b.get('isi', [])))
            continue
        a, z = b['mulai'], b['akhir']
        lama = d[u[a][0]:u[z - 1][1]]
        # profil kurung potongan lama (neraca, minimum) dipertahankan persis: bila potongan menutup grup yang dibuka
        # sebelumnya atau membuka grup yang ditutup sesudahnya (paragraf berbungkus), pengganti menutup/membuka sama banyak.
        net, mn = seimbang(lama)
        if mn > 0 or net - mn < 0 or -mn > 2 or net - mn > 2:
            raise GagalUbah('potongan saksi %s berprofil kurung janggal %r' % (sk, (net, mn)))
        v = SAKSI[sk][0 if bas else 1]
        contoh = d[u[b['pengantar']][0]:u[b['pengantar']][1]] if bas else d[u[a][0]:u[a][1]]
        baru = '}' * (-mn) + bangun_paragraf(contoh, '#%s#' % v, buang_fi=bas) + '{' * (net - mn)
        if seimbang(baru) != (net, mn):
            raise GagalUbah('profil kurung pengganti saksi %s beda' % sk)
        dibuang = sorted(var(' '.join(T[a:z])) - {'0046', '0047'})
        edit.append((u[a][0], u[z - 1][1], baru))
        cat.append(dict(saksi=sk, keadaan=b['keadaan'], satuan=z - a, variabel=v, var_dibuang=dibuang,
                        teks_dibuang=[T[i] for i in range(a, z) if T[i]]))
        if bas:
            # lafal sumpah tertulis mati di antara identitas dan pengantar
            for j in range(b['ident'] + 1, b['pengantar'] - 1):
                if POLA_SUMPAH_ISLAM.search(T[j]) and POLA_LAFAL.search(T[j + 1]):
                    if u[j][2] != u[j][3] or u[j + 1][2] != u[j + 1][3]:
                        raise GagalUbah('kedalaman satuan sumpah saksi %s' % sk)
                    ag, sp = SUMPAH[sk]
                    t1 = 'Selanjutnya saksi tersebut bersumpah menurut tata cara agama #%s# dengan mengucapkan sumpah dengan lafal sebagai berikut :' % ag
                    t2 = '\\uc1 \\u8220 ?#%s#\\uc1 \\u8221 ?;' % sp
                    for jj, tt in ((j, t1), (j + 1, t2)):
                        lama_s = d[u[jj][0]:u[jj][1]]
                        if seimbang(lama_s) != (0, 0):
                            raise GagalUbah('satuan sumpah tidak seimbang')
                        edit.append((u[jj][0], u[jj][1], bangun_paragraf(lama_s, tt)))
                    cat.append(dict(saksi=sk, keadaan='SUMPAH-KERAS', variabel='%s/%s' % (ag, sp),
                                    teks_dibuang=[T[j], T[j + 1]]))
                    break
    edit.sort()
    for x, y in zip(edit, edit[1:]):
        if x[1] > y[0]:
            raise GagalUbah('potongan bertumpuk')
    out = d
    for s, e, r in reversed(edit):
        out = out[:s] + r + out[e:]
    if seimbang(out) != seimbang(d):
        raise GagalUbah('neraca dokumen berubah')
    buang = []
    if edit:
        out, buang = buang_daftar_isian(out)
        if buang:
            cat.append(dict(saksi='-', keadaan='DAFTAR-ISIAN', variabel='', var_dibuang=buang,
                            teks_dibuang=['#%s#' % v for v in buang]))
    return out, cat, edit, buang


# variabel kalimat saksi jadi yang tidak dipakai lagi sesudah blok saksi diganti (isian "berapa kali melihat" dst.)
NARATIF_SAKSI = ('2555', '2556', '2557', '2558', '8486', '8487', '8511', '8512')


def buang_daftar_isian(d):
    """Bila variabel kalimat saksi jadi masih tersisa HANYA di baris daftar isian (baris yang isinya cuma penanda
    #NNNN#, dipakai agar penyunting ABT menampilkan isian), buang penandanya dari baris itu supaya petugas tidak lagi
    diminta mengisi isian yang tidak tercetak. Selain itu dibiarkan."""
    teks = rtf_ke_teks(d)
    buang = []
    for v in NARATIF_SAKSI:
        tok = '#%s#' % v
        if tok not in teks:
            continue
        baris = [b for b in teks.split('\n') if tok in b]
        if not all(re.fullmatch(r'(\s*#\d{4}#\s*)+', b) for b in baris):
            continue
        if d.count(tok) != teks.count(tok):
            continue
        d = d.replace(tok + ' ', '').replace(tok, '')
        buang.append(v)
    return d, buang
