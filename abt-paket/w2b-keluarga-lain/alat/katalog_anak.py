# -*- coding: utf-8 -*-
"""Mesin penyusun butir katalog saksi (skema saksi-katalog/1) untuk keluarga ANAK (hak asuh, penguasaan anak, nafkah anak).
Agen W2b-B, 21 Okt 2026. Memakai pembungkus kalimat baku yang sama dengan paket u3-itsbat-aua (import dari sana, tidak disalin).

Satu spesifikasi (S) menghasilkan satu butir lengkap:
  teks/varian/hal  : pertanyaan, dua rumusan lain, frasa {hal} untuk jawaban umum (tidak tahu, ragu)
  v                : varian keadaan untuk jawaban (mis. pengasuh = pengaju atau lawan); token @X@ @Y@ diganti per varian
  K=(k1,k2)        : klausa fakta saksi 1 dan saksi 2 (masing-masing 2 klausa) -> melihat dan de-auditu
  M=(m1,m2)        : opsional, klausa ucapan -> mendengar (tanpa M dipakai jawaban umum katalog)
  P=(p1,p2)        : opsional, klausa sebagian (tanpa P dipakai K)
  A, B             : dua klausa tiap versi untuk 'berbeda' (saksi 1 dan saksi 2 bertentangan)
Penanda isian: #nnnn#; slot: {sumber} (de-auditu). Klausa TANPA koma, tanpa huruf besar di awal, tanpa kata "sayang"/"ya, ".
"""
import os
import re
import sys

_U3 = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'u3-itsbat-aua', 'alat')
sys.path.insert(0, os.path.abspath(_U3))
import katalog_mesin as U3  # noqa: E402

W_MELIHAT, W_DEAUDITU, W_SEBAGIAN, W_MENDENGAR, W_BEDA = U3.W_MELIHAT, U3.W_DEAUDITU, U3.W_SEBAGIAN, U3.W_MENDENGAR, U3.W_BEDA
_empat = U3._empat
_kode = U3._kode

# varian keadaan siap pakai: pengasuh saat ini adalah pengaju atau lawan; X = pengasuh, Y = pihak lain
PENGASUH = [({'pengasuhAnak': 'pengaju'}, {'X': '#0046#', 'Y': '#0047#'}),
            ({'pengasuhAnak': 'lawan'}, {'X': '#0047#', 'Y': '#0046#'})]
# pilihan anak mumayyiz: yang dipilih anak = X, yang lain = Y
PILIHAN = [({'pilihanAnak': 'pengaju'}, {'X': '#0046#', 'Y': '#0047#'}),
           ({'pilihanAnak': 'lawan'}, {'X': '#0047#', 'Y': '#0046#'})]


def _sub(t, sub):
    for k, v in sub.items():
        t = t.replace('@%s@' % k, v)
    return t


def _pair(p, sub):
    return [_sub(x, sub) for x in p]


def bangun(sp):
    q = {
        'id': '%s%s' % (sp.get('prefix', 'q-'), sp['id']),
        'pokok': sp['pokok'],
        'urutan': sp['urut'],
        'tingkat': sp.get('tingkat', 'pilihan'),
        'kelompok': sp.get('kelompok', 'pokok'),
        'pihakSaksi': ['*'],
        'keadaan': dict(sp.get('keadaan', {})),
        'teks': _sub(sp['teks'], {'X': 'orang tua yang mengasuh anak', 'Y': 'orang tua lainnya'}),
    }
    sub0 = {'X': 'orang tua yang mengasuh anak', 'Y': 'orang tua lainnya'}
    if sp.get('varian'):
        q['teksVarian'] = [_sub(v, sub0) for v in sp['varian']]
    q['hal'] = sp['hal']
    q['tidakBerlaku'] = list(sp.get('tidakBerlaku', []))
    variants = sp.get('v') or [({}, {})]
    fam = sp.get('fam', 'tahu')
    w1, w2 = W_MELIHAT[fam]
    m = sp['m']
    mel, dea, men, seb = [], [], [], []
    for ket, sub in variants:
        K = (_pair(sp['K'][0], sub), _pair(sp['K'][1], sub))
        base = {'keadaan': dict(ket)} if ket else {}
        o = dict(base)
        o['maksud'] = _sub('saksi menerangkan %s sebagai hal yang dilihat atau dialaminya sendiri' % m, sub)
        o['saksi1'], o['saksi2'] = _empat(w1, K[0]), _empat(w2, K[1])
        mel.append(o)
        o = dict(base)
        o['maksud'] = _sub('saksi menerangkan %s hanya dari cerita orang lain, bukan yang disaksikannya sendiri' % m, sub)
        o['saksi1'], o['saksi2'] = _empat(W_DEAUDITU[0], K[0]), _empat(W_DEAUDITU[1], K[1])
        dea.append(o)
        if sp.get('M'):
            M = (_pair(sp['M'][0], sub), _pair(sp['M'][1], sub))
            o = dict(base)
            o['maksud'] = _sub('saksi menerangkan %s sebagai hal yang didengarnya sendiri dari pihak atau peristiwa itu' % m, sub)
            o['saksi1'], o['saksi2'] = _empat(W_MENDENGAR[0], M[0]), _empat(W_MENDENGAR[1], M[1])
            men.append(o)
        P = sp.get('P') or sp['K']
        P = (_pair(P[0], sub), _pair(P[1], sub))
        o = dict(base)
        o['maksud'] = _sub('saksi hanya mengetahui sebagian dari %s' % m, sub)
        o['saksi1'], o['saksi2'] = _empat(W_SEBAGIAN[0], P[0]), _empat(W_SEBAGIAN[1], P[1])
        seb.append(o)
    ham = {}
    ham['melihat'] = mel if len(mel) > 1 else mel[0]
    ham['de-auditu'] = dea if len(dea) > 1 else dea[0]
    if men:
        ham['mendengar'] = men if len(men) > 1 else men[0]
    ham['sebagian'] = seb if len(seb) > 1 else seb[0]
    A, B = _pair(sp['A'], sub0), _pair(sp['B'], sub0)
    ham['berbeda'] = {'maksud': sp['beda_maksud'], 'bedaPada': sp['beda_pada'], 'saksi1': _empat(W_BEDA[0], A), 'saksi2': _empat(W_BEDA[1], B)}
    for j in q['tidakBerlaku']:
        ham.pop(j, None)
    q['jawaban'] = ham
    teks_semua = [q['teks']] + q.get('teksVarian', [])
    for j in ham.values():
        for x in (j if isinstance(j, list) else [j]):
            teks_semua += x['saksi1'] + x['saksi2']
    q['variabelAbt'] = sorted(set(sum((_kode(t) for t in teks_semua), [])))
    if sp.get('catatan'):
        q['catatan'] = sp['catatan']
    return q


def periksa(q):
    """diagnosa cepat (cermin sebagian aturan periksaKatalog) + invarian negasi untuk jenis yang ketat."""
    out = list(U3.diagnosa(q))
    return out


def pokok(id_, judul, uraian, dasar, wajib=False, keadaan=None):
    d = dict(id=id_, judul=judul, uraian=uraian, dasarHukum=dasar, wajib=wajib)
    if keadaan:
        d['keadaan'] = keadaan
    return d


def dasar(id_, rujukan, uraian, status, sumber):
    return dict(id=id_, rujukan=rujukan, uraian=uraian, status=status, sumber=sumber)


def keadaan(label, nilai, bawaan, sumber='borang'):
    return dict(sumber=sumber, nilai=list(nilai), label=label, bawaan=bawaan)
