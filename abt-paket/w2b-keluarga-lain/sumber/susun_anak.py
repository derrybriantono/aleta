# -*- coding: utf-8 -*-
"""Menyusun blangko Derry keluarga ANAK (6a Hak Asuh, 6b Penguasaan Anak, 6c Nafkah Anak) untuk paket w2b-keluarga-lain.

Masukan : env W2B_ASLI = folder salinan derry_briantono TERBARU dari server (default D:/aleta-dev/kerja/w2b-asli-server)
Keluaran: timpa/derry_briantono/<folder>/<berkas>.rtf  (blangko LAMA versi baru)  + daftar-timpa-anak.tsv
          rtf/derry_briantono/<folder>/<berkas>.rtf    (blangko BARU)
Bisa diulang bila md5 server berubah: md5 LAMA di daftar dihitung dari berkas masukan; paket menolak menimpa bila md5 server tidak sama.
Prinsip: yang sudah ada tidak dihapus; penanda baru ditempelkan di ujung paragraf yang ada (bila kosong tidak mengubah tampilan) atau
disisipkan di tengah kalimat; semua penanda diperiksa tidak terpecah (periksa_token).
"""
import hashlib
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(AKAR, 'alat'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bangun import Dok, simpan, periksa_token  # noqa: E402

ASLI = os.environ.get('W2B_ASLI', 'D:/aleta-dev/kerja/w2b-asli-server')
PREFIKS = 'derry_briantono/'
TIMPA = os.path.join(AKAR, 'timpa')
BARU = os.path.join(AKAR, 'rtf')
F6A, F6B, F6C = '6a Hak Asuh Anak (Hadhanah)', '6b Penguasaan Anak', '6c Nafkah Anak'

DAFTAR = []  # (folder, berkas, md5_lama, md5_baru, ket)
BARU_LOG = []
GALAT = []


def md5b(b):
    return hashlib.md5(b).hexdigest()


class Edit:
    """Kumpulan suntingan paragraf satu berkas (indeks -> teks baru) dengan jangkar awalan yang harus tepat satu."""

    def __init__(self, folder, berkas):
        self.folder, self.berkas = folder, berkas
        self.d = Dok(os.path.join(ASLI, folder, berkas))
        self.isi = [self.d.isi(i) for i in range(len(self.d.par))]
        self.baru = {}
        self.sisip_sesudah = {}
        self.catat = []

    def cari(self, awalan, wajib=True):
        hit = [i for i, x in enumerate(self.isi) if x.startswith(awalan)]
        if len(hit) != 1:
            if wajib:
                GALAT.append('%s/%s: jangkar %r muncul %d kali' % (self.folder, self.berkas, awalan[:60], len(hit)))
            return None
        return hit[0]

    def teks(self, i):
        return self.baru.get(i, self.isi[i])

    def akhir(self, awalan, token, wajib=True, nama=None):
        i = self.cari(awalan, wajib)
        if i is None:
            return False
        t = self.teks(i)
        if token in t:
            return True
        self.baru[i] = t + token
        self.catat.append(nama or token)
        return True

    def ganti(self, awalan, lama, baru, wajib=True, nama=None):
        i = self.cari(awalan, wajib)
        if i is None:
            return False
        t = self.teks(i)
        if t.count(lama) != 1:
            if wajib:
                GALAT.append('%s/%s: %r muncul %d kali dalam paragraf %r' % (self.folder, self.berkas, lama[:50], t.count(lama), awalan[:40]))
            return False
        self.baru[i] = t.replace(lama, baru)
        self.catat.append(nama or baru)
        return True

    def simpan_timpa(self, ket):
        out = []
        for i in range(len(self.d.par)):
            out.append(self.d.ganti_teks(i, self.baru[i]) if i in self.baru else self.d.par[i])
            for t in self.sisip_sesudah.get(i, []):
                out.append(t)
        isi = self.d.rakit(out)
        pecah = periksa_token(isi)
        if pecah:
            raise SystemExit('token terpecah di %s: %r' % (self.berkas, pecah))
        simpan(os.path.join(TIMPA, PREFIKS + self.folder, self.berkas), isi)
        lama = md5b(open(os.path.join(ASLI, self.folder, self.berkas), 'rb').read())
        DAFTAR.append((PREFIKS + self.folder, self.berkas, lama, md5b(isi.encode('latin1')), ket))
        print('timpa', self.folder[:2], self.berkas[:70], '|', ket)


# ---------------------------------------------------------------------------------------------------------------------
# Jangkar umum
# ---------------------------------------------------------------------------------------------------------------------
A105A = 'Menimbang, bahwa Pasal 105 huruf a'
A105B = 'Menimbang, bahwa Pasal 105 huruf b'
A105M = 'Menimbang, bahwa meskipun Pasal 105 huruf a'
A_APP = 'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, '
A_SEMA = 'Menimbang, bahwa berdasarkan Surat Edaran Mahkamah Agung Nomor 1 Tahun 2017'
A_KAB = 'Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum'
A_REL = 'Menimbang, bahwa berdasarkan identitas para pihak dalam surat'
AKSES = 'ikut serta dalam pengasuhan #9302# tersebut'
A_NAFKAH = 'Menimbang, bahwa berdasarkan Pasal 41 huruf b'


def nomor_awal(e, kata):
    """Nomor butir amar yang paragrafnya diawali nomor + tab + kata; None bila tidak ada."""
    for i, x in enumerate(e.isi):
        m = re.match(r'^(\d+)\.\t' + re.escape(kata), x)
        if m:
            return int(m.group(1)), i
    return None, None


def amar_biaya(e):
    """Paragraf amar biaya perkara ('n.<tab>#8505#') -> (n, indeks)."""
    for i, x in enumerate(e.isi):
        m = re.match(r'^(\d+)\.\t#8505#', x)
        if m:
            return int(m.group(1)), i
    return None, None


def tambal_hak_asuh(folder, berkas, penyerahan, relatif, kabul, nafkah_gabung=False):
    """Tambalan umum putusan hak asuh / penguasaan anak.
    penyerahan: boleh menyisipkan butir penyerahan anak (hanya 6a keluarga [01]); relatif: tambah paragraf kewenangan relatif tempat tinggal anak;
    kabul: putusan mengabulkan (amar menetapkan hak asuh)."""
    e = Edit(folder, berkas)
    mumayyiz = e.cari(A105B, wajib=False) is not None
    # 1. umur anak + peringatan kesesuaian + peringatan dewasa
    peringatan = '#4882#' if mumayyiz else '#4881#'
    for a in ([A105B] if mumayyiz else [A105A, A105M]):
        if e.cari(a, wajib=False) is not None:
            e.akhir(a, '#4880#' + peringatan + '#4883##4885##4887#', nama='umur-anak+kelayakan+ahli')
            break
    else:
        GALAT.append('%s/%s: tidak ada jangkar Pasal 105' % (folder, berkas))
    # 2. kelayakan pemegang hadhanah dan pendapat ahli ikut di paragraf yang sama (sebelum paragraf kesimpulan fakta hukum)
    # 3. kewenangan relatif tempat tinggal anak (6a saja)
    if relatif:
        e.akhir(A_REL, '#4898#', nama='relatif-tempat-anak')
    if kabul:
        # akses bertemu rinci di pertimbangan dan amar
        tambah_pert = '#4889#' + ('#4893#' if penyerahan else '')
        e.ganti(A_KAB, AKSES, AKSES + tambah_pert, nama='akses-rinci')
        i_m, ip = nomor_awal(e, 'Menetapkan')
        if i_m is None:
            GALAT.append('%s/%s: tidak ada amar Menetapkan' % (folder, berkas))
        else:
            lama = AKSES + ';'
            if penyerahan:
                # butir penyerahan anak (butir 3 pada putusan kontradiktoir, butir 4 pada putusan verstek)
                tok = '#4891#' if i_m == 2 else ('#4908#' if i_m == 3 else None)
                if tok is None:
                    GALAT.append('%s/%s: nomor amar Menetapkan %d tidak dikenal' % (folder, berkas, i_m))
                else:
                    e.ganti('%d.\tMenetapkan' % i_m, lama, AKSES + '#4889#;' + tok, nama='amar-akses+penyerahan')
                nb, ib = amar_biaya(e)
                if nb == 3:
                    e.ganti('3.\t#8505#', '3.\t#8505#', '#4894#.\t#8505#', nama='nomor-biaya')
                elif nb == 4:
                    e.ganti('4.\t#8505#', '4.\t#8505#', '#4895#.\t#8505#', nama='nomor-biaya-verstek')
                else:
                    GALAT.append('%s/%s: nomor amar biaya %r tidak dikenal' % (folder, berkas, nb))
                e.akhir(A_SEMA, '#4892#', nama='pertimbangan-penyerahan')
            else:
                e.ganti('%d.\tMenetapkan' % i_m, lama, AKSES + '#4889#;', wajib=False, nama='amar-akses')
                if not [c for c in e.catat if c == 'amar-akses']:
                    e.ganti('%d.\tMenetapkan' % i_m, AKSES, AKSES + '#4889#', nama='amar-akses')
    else:
        # putusan menolak: bila amar menetapkan hak asuh kepada pihak lawan (ada akses), sisipkan rincian akses
        i_m, ip = nomor_awal(e, 'Menetapkan')
        if i_m is not None:
            e.ganti('%d.\tMenetapkan' % i_m, AKSES, AKSES + '#4889#', nama='amar-akses')
    return e


def tambal_nafkah(folder, berkas):
    e = Edit(folder, berkas)
    # umur anak untuk batas dewasa + peringatan sebelum pertimbangan nafkah lampau/ke depan; perbandingan jumlah di ujung
    ok = e.akhir(A_NAFKAH, '#4900#', nama='perbandingan-jumlah')
    if ok:
        i = e.cari(A_NAFKAH)
        t = e.teks(i)
        if '#9757#' in t:
            e.baru[i] = t.replace('#9757#', '#4909##4883##9757#', 1)
        elif '#9751#' in t:
            e.baru[i] = t.replace('#9751#', '#4909##4883##9751#', 1)
        else:
            e.baru[i] = t.replace('#4900#', '#4909##4883##4900#', 1)
        e.catat.append('umur-anak-nafkah')
    return e


def main():
    # ---- 6a hak asuh ----
    for berkas in sorted(os.listdir(os.path.join(ASLI, F6A))):
        if not berkas.endswith('.rtf') or re.match(r'\[(97|98|99)', berkas):
            continue
        m = re.match(r'\[(\d+[a-z]?)\]', berkas)
        kode = m.group(1)
        if kode in ('02', '02a', '02b'):
            e = tambal_hak_asuh(F6A, berkas, penyerahan=False, relatif=True, kabul=True)
            # bagian nafkah pada putusan gabungan
            if e.cari(A_NAFKAH, wajib=False) is not None:
                e.akhir(A_NAFKAH, '#4900#', nama='perbandingan-jumlah')
        elif kode in ('03', '03a', '03b'):
            e = tambal_hak_asuh(F6A, berkas, penyerahan=False, relatif=True, kabul=False)
        else:
            e = tambal_hak_asuh(F6A, berkas, penyerahan=True, relatif=True, kabul=True)
        e.simpan_timpa('hak asuh: ' + ', '.join(sorted(set(e.catat))))
    # ---- 6b penguasaan anak ----
    for berkas in sorted(os.listdir(os.path.join(ASLI, F6B))):
        if not berkas.endswith('.rtf') or re.match(r'\[(97|98|99)', berkas):
            continue
        kode = re.match(r'\[(\d+[a-z]?)\]', berkas).group(1)
        kabul = not kode.startswith('03')
        e = tambal_hak_asuh(F6B, berkas, penyerahan=False, relatif=False, kabul=kabul)
        e.simpan_timpa('penguasaan anak: ' + ', '.join(sorted(set(e.catat))))
    # ---- 6c nafkah anak ----
    for berkas in sorted(os.listdir(os.path.join(ASLI, F6C))):
        if not berkas.endswith('.rtf') or re.match(r'\[(97|98|99)', berkas):
            continue
        kode = re.match(r'\[(\d+[a-z]?)\]', berkas).group(1)
        if kode.startswith('03'):
            continue
        e = tambal_nafkah(F6C, berkas)
        e.simpan_timpa('nafkah anak: ' + ', '.join(sorted(set(e.catat))))
    if GALAT:
        print('\nGALAT JANGKAR:')
        for g in GALAT:
            print(' ', g)
    # daftar-timpa
    with open(os.path.join(AKAR, 'daftar-timpa-anak.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# folder<TAB>berkas<TAB>md5 lama (server 20 Okt 2026)<TAB>md5 baru<TAB>keterangan - berkas LAMA ditimpa HANYA bila md5-nya persis md5 lama; cadangan utuh dibuat paket\n')
        for r in DAFTAR:
            f.write('\t'.join(r) + '\n')
    print(len(DAFTAR), 'berkas ditimpa')


if __name__ == '__main__':
    main()
