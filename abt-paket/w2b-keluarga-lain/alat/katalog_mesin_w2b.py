# -*- coding: utf-8 -*-
"""Mesin penyusun butir katalog saksi (skema saksi-katalog/1) paket W2b (21 Okt 2026), turunan alat/katalog_mesin.py paket u3-itsbat-aua.

Satu spesifikasi (Spec) menghasilkan butir untuk tiga bentuk perkara itsbat:
  pb = permohonan oleh dua pemohon, lw = gugatan (ada Tergugat), pm = satu pemohon / pasangan meninggal.
Jawaban dibangun dari pembungkus kalimat baku (sama dengan katalog lama) di sekitar klausa fakta; tiap jenis keterangan
mendapat 4 varian saksi 1 dan 4 varian saksi 2 yang maksudnya sama tetapi kalimatnya berbeda.
Penanda isian: #nnnn#; slot: {sumber} (de-auditu). Bentuk pihak dalam teks: {PAS} {PRIA} {WAN} {PEM} {LAWAN}.
"""
import re

ERR = []  # temuan saat membangun (dicetak tambah_katalog)
FORM = {}  # diisi tiap keluarga: FORM[nama] = dict(sfx, keadaan, PAS, PRIA, WAN, PEM, LAWAN, URUT, OFF)

# ---- pembungkus kalimat (salinan pola katalog lama) ------------------------------------------------------------------
W_MELIHAT = {
    'hadir': (['saya melihat sendiri bahwa {F}', 'saya menyaksikan langsung bahwa {F}',
               '{F}, dan hal itu saya lihat dengan mata kepala saya sendiri',
               'pada waktu itu saya berada di tempat kejadian dan melihat bahwa {F}'],
              ['karena saya turut hadir maka saya terangkan bahwa {F}', '{F}, demikian yang tampak oleh saya waktu itu',
               'saya ada di lokasi pada saat itu dan mendapati bahwa {F}', '{F}, sebagaimana yang saya alami']),
    'tahu': (['saya mengetahui sendiri bahwa {F}', 'saya tahu betul bahwa {F}', '{F}, dan hal itu saya ketahui sendiri',
              'sebagai orang yang dekat dengan mereka saya mengetahui bahwa {F}'],
             ['yang saya ketahui secara langsung adalah bahwa {F}', '{F}, sebagaimana yang saya alami dalam pergaulan dengan mereka',
              'karena sering bersama mereka saya paham bahwa {F}', 'saya paham dengan baik bahwa {F}']),
}
W_DEAUDITU = (['{sumber} bercerita kepada saya bahwa {F}', 'saya diberi tahu oleh {sumber} bahwa {F}',
               '{F}, begitulah cerita {sumber} kepada saya', 'setahu saya berdasarkan cerita {sumber} bahwa {F}'],
              ['dari penuturan {sumber} yang sampai kepada saya diketahui bahwa {F}',
               'kabar dari {sumber} yang saya terima menyebutkan bahwa {F}', '{F}, demikian yang diceritakan {sumber} kepada saya',
               'yang saya ketahui berasal dari cerita {sumber} yaitu bahwa {F}'])
W_SEBAGIAN = (['yang saya ketahui hanya sebagian saja yaitu bahwa {F}, sedangkan selebihnya kurang saya ketahui',
               'saya hanya tahu sebagian yaitu bahwa {F}, dan selebihnya kurang saya ketahui',
               'sebagian saja yang saya ketahui yakni bahwa {F}', 'hanya sebatas itu yang saya ketahui yaitu bahwa {F}'],
              ['pengetahuan saya terbatas pada satu hal bahwa {F}, adapun selebihnya kurang jelas bagi saya',
               'sejauh yang saya tahu bahwa {F}, sedangkan sisanya kurang saya pahami',
               'bagian yang saya kuasai hanyalah bahwa {F}, dan lainnya kurang saya pahami',
               'yang bisa saya terangkan sebatas bahwa {F}, selebihnya kurang saya pahami'])
W_MENDENGAR = (['saya mendengar sendiri bahwa {F}', 'saya mendengar langsung bahwa {F}',
                '{F}, dan itu saya dengar sendiri pada waktu itu', 'saat itu saya berada di dekat mereka dan mendengar bahwa {F}'],
               ['ucapan yang terdengar oleh saya waktu itu menyatakan bahwa {F}',
                '{F}, begitulah perkataan yang terdengar di hadapan saya', 'di hadapan saya mereka mengatakan bahwa {F}',
                'para pihak berkata di depan saya bahwa {F}'])
W_BEDA = (['menurut yang saya ketahui sendiri bahwa {F}', 'keterangan saya adalah bahwa {F}', '{F}, itulah yang saya ketahui',
           'yang saya terangkan di sini adalah bahwa {F}'],
          ['sepengetahuan saya bahwa {F}', '{F}, begitulah yang saya alami', 'yang saya ingat dan saya sampaikan adalah bahwa {F}',
           '{F}, dan itulah keterangan saya'])


def _isi(tpl, f):
    return tpl.replace('{PAS}', f['PAS']).replace('{PRIA}', f['PRIA']).replace('{WAN}', f['WAN']).replace('{PEM}', f['PEM']).replace('{LAWAN}', f['LAWAN'])


# Klausa yang berakhir "-ya" tidak boleh diikuti koma+spasi ("ya, " dimakan replace_ket_saksi ABT): pembungkus bertanda koma
# diganti bentuk lain yang maknanya sama.
ALT = {
    '{F}, dan hal itu saya lihat dengan mata kepala saya sendiri': 'dengan mata kepala saya sendiri saya melihat bahwa {F}',
    '{F}, demikian yang tampak oleh saya waktu itu': 'yang tampak oleh saya waktu itu adalah bahwa {F}',
    '{F}, sebagaimana yang saya alami': 'sebagaimana yang saya alami adalah bahwa {F}',
    '{F}, dan hal itu saya ketahui sendiri': 'hal yang saya ketahui sendiri adalah bahwa {F}',
    '{F}, sebagaimana yang saya alami dalam pergaulan dengan mereka': 'dalam pergaulan dengan mereka saya alami bahwa {F}',
    '{F}, begitulah cerita {sumber} kepada saya': 'cerita {sumber} kepada saya adalah bahwa {F}',
    '{F}, demikian yang diceritakan {sumber} kepada saya': 'yang diceritakan {sumber} kepada saya adalah bahwa {F}',
    '{F}, dan itu saya dengar sendiri pada waktu itu': 'yang saya dengar sendiri pada waktu itu adalah bahwa {F}',
    '{F}, begitulah perkataan yang terdengar di hadapan saya': 'perkataan yang terdengar di hadapan saya adalah bahwa {F}',
    '{F}, itulah yang saya ketahui': 'yang saya ketahui adalah bahwa {F}',
    '{F}, begitulah yang saya alami': 'yang saya alami adalah bahwa {F}',
    '{F}, dan itulah keterangan saya': 'keterangan saya adalah bahwa {F}',
}
_YA = re.compile(r'ya$')


def _empat(wr, pair):
    """4 kalimat dari 4 pembungkus; klausa a/b bergantian."""
    out = []
    for i in range(4):
        w, c = wr[i], pair[i % 2]
        if _YA.search(c):
            if w in ALT:
                w = ALT[w]
            else:
                w = w.replace('{F},', '{F}')
        out.append(w.replace('{F}', c))
    return out


def _kode(teks):
    return re.findall(r'#(\d{4})#', teks)


def bangun(spec, nama_form):
    """Satu spesifikasi -> satu butir katalog.
    Wajib: id, pokok, urut, teks, hal, m, K=([a1,b1],[a2,b2]).  Opsional: P (sebagian; bawaan = K), A/B (berbeda; tanpa A/B maka
    'berbeda' masuk tidakBerlaku), M (mendengar), peran {kedudukanSaksi: (saksi1x2, saksi2x2)}, ragam [dict(keadaan, m, K, fam)]
    = jawaban 'melihat' tambahan untuk keadaan tertentu, keadaan (syarat butir), tingkat, kelompok, varian, tidakBerlaku, catatan."""
    f = FORM[nama_form]
    sp = spec
    s = lambda t: _isi(t, f)  # noqa: E731
    sfx = f['sfx']
    q = {
        'id': '%s%s%s' % (sp.get('prefix', 'q-w2b-'), sp['id'], ('-' + sfx) if sfx else ''),
        'pokok': sp['pokok'],
        'urutan': (sp['urut_abs'] + f['URUT']) if sp.get('urut_abs') else (f.get('OFF', 0) + sp['urut'] * 10 + f['URUT']),
        'tingkat': sp.get('tingkat', 'pilihan'),
        'kelompok': sp.get('kelompok', 'pokok'),
        'pihakSaksi': sp.get('pihakSaksi', ['*']),
        'keadaan': dict(f['keadaan'], **sp.get('keadaan', {})),
        'teks': s(sp['teks']),
    }
    if sp.get('varian'):
        q['teksVarian'] = [s(v) for v in sp['varian']]
        dasar = sorted(re.findall(r'#\d{4}#|\{[^{}]*\}', q['teks']))
        for v in q['teksVarian']:
            if sorted(re.findall(r'#\d{4}#|\{[^{}]*\}', v)) != dasar:
                ERR.append('penanda teksVarian beda dari teks pada %s: %s || %s' % (q['id'], q['teks'], v))
    q['hal'] = s(sp['hal'])
    tb = list(sp.get('tidakBerlaku', []))
    if not sp.get('A') and 'berbeda' not in tb:
        tb.append('berbeda')
    q['tidakBerlaku'] = tb
    m = s(sp['m'])
    ham = {}
    fam = sp.get('fam', 'tahu')

    def pair(p):
        return [s(x) for x in p]

    def lihat(fam_, K, maksud):
        w1, w2 = W_MELIHAT[fam_]
        K1, K2 = pair(K[0]), pair(K[1])
        return {'maksud': maksud, 'saksi1': _empat(w1, K1), 'saksi2': _empat(w2, K2)}

    K = sp['K']
    melihat = [lihat(fam, K, 'saksi menerangkan %s sebagai hal yang dilihat atau dialaminya sendiri' % m)]
    for rg in sp.get('ragam', []):
        e = lihat(rg.get('fam', fam), rg['K'], 'saksi menerangkan %s' % s(rg['m']))
        e = dict({'keadaan': rg['keadaan']}, **e)
        melihat.append(e)
    for peran, (r1, r2) in sp.get('peran', {}).items():
        r1, r2 = pair(r1), pair(r2)
        melihat.append({'keadaan': {'kedudukanSaksi': peran},
                        'maksud': 'saksi menerangkan %s dari kedudukannya sebagai %s' % (m, peran.replace('-', ' ')),
                        'saksi1': r1, 'saksi2': r2})
    ham['melihat'] = melihat if len(melihat) > 1 else melihat[0]
    K1, K2 = pair(K[0]), pair(K[1])
    ham['de-auditu'] = {'maksud': 'saksi menerangkan %s hanya dari cerita orang lain, bukan yang disaksikannya sendiri' % m,
                        'saksi1': _empat(W_DEAUDITU[0], K1), 'saksi2': _empat(W_DEAUDITU[1], K2)}
    if sp.get('M'):
        Mm = K if sp['M'] == 'K' else sp['M']
        M1, M2 = pair(Mm[0]), pair(Mm[1])
        ham['mendengar'] = {'maksud': 'saksi menerangkan %s sebagai hal yang didengarnya sendiri dari pihak atau peristiwa itu' % m,
                            'saksi1': _empat(W_MENDENGAR[0], M1), 'saksi2': _empat(W_MENDENGAR[1], M2)}
    Pp = sp.get('P') or K
    P1, P2 = pair(Pp[0]), [re.sub(r'^setahu saya ', '', x) for x in pair(Pp[1])]
    ham['sebagian'] = {'maksud': 'saksi hanya mengetahui sebagian dari %s' % m,
                       'saksi1': _empat(W_SEBAGIAN[0], P1), 'saksi2': _empat(W_SEBAGIAN[1], P2)}
    if sp.get('A'):
        A, B = pair(sp['A']), pair(sp['B'])
        ham['berbeda'] = {'maksud': s(sp['beda_maksud']), 'bedaPada': sp['beda_pada'],
                          'saksi1': _empat(W_BEDA[0], A), 'saksi2': _empat(W_BEDA[1], B)}
    for j in q['tidakBerlaku']:
        ham.pop(j, None)
    q['jawaban'] = ham
    teks_semua = [q['teks']] + q.get('teksVarian', [])
    for j in ham.values():
        for x in (j if isinstance(j, list) else [j]):
            teks_semua += x['saksi1'] + x['saksi2']
    kode = sorted(set(sum((_kode(t) for t in teks_semua), [])))
    q['variabelAbt'] = kode
    if sp.get('catatan'):
        q['catatan'] = sp['catatan']
    return q


def bangun_semua(spec, bentuk=None):
    return [bangun(spec, n) for n in (bentuk or spec.get('bentuk') or list(FORM))]


# ---- diagnosa cepat (cermin sebagian aturan periksaKatalog) -------------------------------------------------------
_NEG = re.compile(r'\b(tidak|bukan|belum|tanpa|tak|tiada|nihil|jangan)\b')
_SLOT = re.compile(r'\{[^{}]*\}')
_TANDA = re.compile(r'#\d{4}#')
_SEBUTAN = {'#0046#', '{pengaju}', '{lawan}', '#0047#'}


def diagnosa(q):
    out = []
    for jenis, v in q['jawaban'].items():
        for n, x in enumerate(v if isinstance(v, list) else [v]):
            semua = x['saksi1'] + x['saksi2']
            kel = [x['saksi1'], x['saksi2']] if jenis == 'berbeda' else [semua]
            for k in kel:
                base = None
                for t in k:
                    if re.search(r'ya, ', t, re.I):
                        out.append('%s %s[%d] ya, : %s' % (q['id'], jenis, n, t))
                    if re.match(r'[A-Z]', t):
                        out.append('%s %s[%d] huruf besar: %s' % (q['id'], jenis, n, t))
                    pen = sorted(set(_TANDA.findall(t) + _SLOT.findall(t)) - _SEBUTAN)
                    if base is None:
                        base = pen
                    elif pen != base:
                        out.append('%s %s[%d] penanda %s != %s: %s' % (q['id'], jenis, n, pen, base, t))
                negs = {len(_NEG.findall(t.lower())) for t in k}
                if len(negs) > 1 and jenis not in ('melihat', 'berbeda'):
                    out.append('%s %s[%d] negasi beda %s: %s' % (q['id'], jenis, n, sorted(negs), k[0]))
    return out
