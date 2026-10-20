# -*- coding: utf-8 -*-
"""Penyusun katalog saksi (skema saksi-katalog/1) untuk jenis W3a-B (izin kawin, pengesahan anak), 21 Okt 2026.

Prinsip (mengikuti paket u4): tiap butir disusun dari KERANGKA kalimat tetap per tingkat pengetahuan saksi (melihat, mendengar, de-auditu,
sebagian) sehingga himpunan penanda, angka dan jumlah negasi tiap varian sama (syarat periksaKatalog) dan kalimat saksi 1 berbeda dari saksi 2.
Jawaban memakai penanda variabel ABT (#nnnn#) yang terisi dari SIPP/posita. Jawaban umum (tidak-tahu, ragu, mendengar, de-auditu, sebagian) dipakai
ulang dari katalog wali-adhal.json (sudah lolos skema).  Tidak ada AI saat jalan: semua kalimat tetap.
"""
import json
import os
import re

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.abspath(os.path.join(AKAR, '..', '..'))
KATALOG = os.path.join(REPO, 'ekstensi-sipp', 'saksi-katalog')

MELIHAT_1 = ['saya melihat sendiri bahwa {P}', 'saya mengetahui sendiri bahwa {P}', 'saya menyaksikan langsung bahwa {P}', 'saya tahu betul bahwa {P}']
MELIHAT_2 = ['karena saya turut hadir maka saya terangkan bahwa {P}', 'yang saya ketahui secara langsung adalah bahwa {P}',
             '{P}, demikian yang tampak oleh saya waktu itu', '{P}, sebagaimana yang saya alami dalam pergaulan dengan mereka']
MENDENGAR_1 = ['saya mendengar sendiri ucapan mereka bahwa {P}', 'saya mendengar langsung perkataan mereka bahwa {P}',
               'dari ucapan mereka yang saya dengar sendiri diketahui bahwa {P}', 'saya sendiri mendengar mereka mengatakan bahwa {P}']
MENDENGAR_2 = ['saya turut mendengar langsung pembicaraan mereka bahwa {P}', 'perkataan mereka yang terdengar langsung oleh saya menerangkan bahwa {P}',
               '{P}, itulah ucapan mereka yang saya dengar sendiri', 'saya mendengar dengan telinga saya sendiri bahwa {P}']
DEAUDITU_1 = ['{{sumber}} bercerita kepada saya bahwa {P}', 'saya diberi tahu oleh {{sumber}} bahwa {P}', '{P}, begitulah cerita {{sumber}} kepada saya',
              'setahu saya berdasarkan cerita {{sumber}} bahwa {P}']
DEAUDITU_2 = ['dari penuturan {{sumber}} yang sampai kepada saya diketahui bahwa {P}', 'kabar dari {{sumber}} yang saya terima menyebutkan bahwa {P}',
              '{P}, demikian yang diceritakan {{sumber}} kepada saya', 'yang saya ketahui berasal dari cerita {{sumber}} yaitu bahwa {P}']
SEBAGIAN_1 = ['yang saya ketahui hanya sebagian saja yaitu bahwa {P}, sedangkan selebihnya kurang saya ketahui', 'saya hanya tahu sebagian yaitu bahwa {P}, dan selebihnya kurang saya ketahui',
              'sebagian saja yang saya ketahui yakni bahwa {P}', 'hanya sebatas itu yang saya ketahui yaitu bahwa {P}']
SEBAGIAN_2 = ['pengetahuan saya terbatas pada satu hal bahwa {P}, adapun selebihnya kurang jelas bagi saya', 'sejauh yang saya tahu bahwa {P}, sedangkan sisanya kurang saya pahami',
              'bagian yang saya kuasai hanyalah bahwa {P}, dan lainnya kurang saya pahami', 'yang bisa saya terangkan sebatas bahwa {P}, selebihnya kurang saya pahami']


def isi(kerangka, p):
    return [k.replace('{P}', p).replace('{{sumber}}', '{sumber}') for k in kerangka]


def kode_di(teks):
    return sorted(set(re.findall(r'#(\d{4})#', teks)))


class B:
    """Butir: pa/pb = proposisi saksi 1/2; sa/sb = proposisi 'sebagian'; mendengar = (ma, mb) opsional; beda = (pada, maksud, s1, s2) opsional."""

    def __init__(self, id, pokok, urutan, tingkat, kelompok, teks, hal, pa, pb, sa, sb, keadaan=None, teks_varian=None, mendengar=None, beda=None, pihak=('*',), maksud=None):
        self.d = dict(id=id, pokok=pokok, urutan=urutan, tingkat=tingkat, kelompok=kelompok, teks=teks, hal=hal, pa=pa, pb=pb, sa=sa, sb=sb, keadaan=keadaan or {},
                      teks_varian=teks_varian or [], mendengar=mendengar, beda=beda, pihak=list(pihak), maksud=maksud or hal)

    def json(self):
        d = self.d
        jaw = {}
        m = d['maksud']
        jaw['melihat'] = dict(maksud='saksi menerangkan %s sebagai hal yang dilihat atau dialaminya sendiri' % m, saksi1=isi(MELIHAT_1, d['pa']), saksi2=isi(MELIHAT_2, d['pb']))
        if d['mendengar']:
            ma, mb = d['mendengar']
            jaw['mendengar'] = dict(maksud='saksi menerangkan %s dari ucapan yang didengarnya langsung, bukan dari penglihatan' % m, saksi1=isi(MENDENGAR_1, ma), saksi2=isi(MENDENGAR_2, mb))
        jaw['de-auditu'] = dict(maksud='saksi menerangkan %s hanya dari cerita orang lain, bukan yang disaksikannya sendiri' % m, saksi1=isi(DEAUDITU_1, d['pa']), saksi2=isi(DEAUDITU_2, d['pb']))
        jaw['sebagian'] = dict(maksud='saksi hanya mengetahui sebagian dari %s' % m, saksi1=isi(SEBAGIAN_1, d['sa']), saksi2=isi(SEBAGIAN_2, d['sb']))
        tb = []
        if d['beda']:
            pada, mk, s1, s2 = d['beda']
            jaw['berbeda'] = dict(maksud=mk, bedaPada=pada, saksi1=list(s1), saksi2=list(s2))
        else:
            tb.append('berbeda')
        semua = [d['teks']] + list(d['teks_varian'])
        for jj in jaw.values():
            semua += jj['saksi1'] + jj['saksi2']
        return dict(id=d['id'], pokok=d['pokok'], urutan=d['urutan'], tingkat=d['tingkat'], kelompok=d['kelompok'], pihakSaksi=d['pihak'], keadaan=d['keadaan'], teks=d['teks'],
                    teksVarian=list(d['teks_varian']), hal=d['hal'], tidakBerlaku=tb, jawaban=jaw, variabelAbt=sorted(set(k for t in semua for k in kode_di(t))))


def butir_sederhana(id, pokok, urutan, tingkat, kelompok, teks, maksud, s1, s2, teks_varian=None, keadaan=None):
    """Butir identitas/penutup: hanya jawaban 'melihat' (kelompok tetap: identitas, hubungan, penutup)."""
    semua = [teks] + list(teks_varian or []) + s1 + s2
    return dict(id=id, pokok=pokok, urutan=urutan, tingkat=tingkat, kelompok=kelompok, pihakSaksi=['*'], keadaan=keadaan or {}, teks=teks, teksVarian=list(teks_varian or []),
                tidakBerlaku=[], jawaban=dict(melihat=dict(maksud=maksud, saksi1=s1, saksi2=s2)), variabelAbt=sorted(set(k for t in semua for k in kode_di(t))))


def dari_wali_adhal(id_butir, **ganti):
    k = json.load(open(os.path.join(KATALOG, 'wali-adhal.json'), encoding='utf-8'))
    q = next(x for x in k['pertanyaan'] if x['id'] == id_butir)
    q = json.loads(json.dumps(q))
    q.update(ganti)
    return q


def jawaban_umum():
    k = json.load(open(os.path.join(KATALOG, 'wali-adhal.json'), encoding='utf-8'))
    return json.loads(json.dumps(k['jawabanUmum']))


def dh(id, rujukan, uraian, sumber, status='terverifikasi'):
    return dict(id=id, rujukan=rujukan, uraian=uraian, status=status, sumber=sumber)


def rakit(kunci, judul, jenis_id, folder_bas, awalan_bas, bas_saksi, dasar, keadaan, pokok, butir, catatan, variabel_baru, penulis='W3A-B'):
    """Katalog utuh. bas_saksi: daftar (langkah, catatan) BAS yang memuat tanya-jawab saksi, mis. ('[1] Sidang 1 - ...', 'dua saksi Pemohon')."""
    kat = dict(skema='saksi-katalog/1', kunci=kunci, judul=judul, versi=1, penulis=penulis, tahap=1, contoh=False,
               syarat=dict(jenisPerkaraId=[str(jenis_id)]), pihak=dict(pengaju='#0046#', lawan='#0047#'),
               blangkoBas=[dict(folder=folder_bas, berkas='%s - %s' % (awalan_bas, langkah), variabelSaksi=['5058', '5059'], catatan=cat) for langkah, cat in bas_saksi],
               dasarHukum=dasar, keadaan=keadaan, pokokPembuktian=pokok, pertanyaan=sorted(butir, key=lambda q: q['urutan']), jawabanUmum=jawaban_umum(),
               catatanPetugas=catatan, variabelBaru=sorted(set(variabel_baru)))
    return kat


def tulis(kat):
    p = os.path.join(KATALOG, kat['kunci'] + '.json')
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(kat, f, ensure_ascii=False, indent=1)
        f.write('\n')
    return p
