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
        self.sisip_sebelum = {}
        self.hapus = set()
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

    def ganti_penuh(self, awalan, teks, nama=None):
        i = self.cari(awalan)
        if i is None:
            return False
        self.baru[i] = teks
        self.catat.append(nama or 'ganti-penuh')
        return True

    def buang(self, awalan, nama=None):
        i = self.cari(awalan)
        if i is None:
            return False
        self.hapus.add(i)
        self.catat.append(nama or 'buang')
        return True

    def sisip(self, awalan_acuan, teks, gaya_awalan=None, sebelum=False):
        """Paragraf BARU `teks` disisipkan sesudah (atau sebelum) paragraf acuan; gayanya meniru paragraf berawalan gaya_awalan (default: acuan)."""
        i = self.cari(awalan_acuan)
        g = self.cari(gaya_awalan) if gaya_awalan else i
        if i is None or g is None:
            return False
        (self.sisip_sebelum if sebelum else self.sisip_sesudah).setdefault(i, []).append(self.d.ganti_teks(g, teks))
        self.catat.append('paragraf-baru')
        return True

    def _rakit(self):
        out = []
        for i in range(len(self.d.par)):
            out.extend(self.sisip_sebelum.get(i, []))
            if i not in self.hapus:
                out.append(self.d.ganti_teks(i, self.baru[i]) if i in self.baru else self.d.par[i])
            out.extend(self.sisip_sesudah.get(i, []))
        isi = self.d.rakit(out)
        pecah = periksa_token(isi)
        if pecah:
            raise SystemExit('token terpecah di %s: %r' % (self.berkas, pecah))
        return isi

    def simpan_timpa(self, ket):
        isi = self._rakit()
        simpan(os.path.join(TIMPA, PREFIKS + self.folder, self.berkas), isi)
        lama = md5b(open(os.path.join(ASLI, self.folder, self.berkas), 'rb').read())
        DAFTAR.append((PREFIKS + self.folder, self.berkas, lama, md5b(isi.encode('latin1')), ket))
        print('timpa', self.folder[:2], self.berkas[:70], '|', ket)

    def simpan_baru(self, folder, berkas, ket):
        """Simpan sebagai blangko BARU (folder/berkas baru di bawah rtf/derry_briantono)."""
        isi = self._rakit()
        simpan(os.path.join(BARU, PREFIKS + folder, berkas), isi)
        BARU_LOG.append((PREFIKS + folder, berkas, md5b(isi.encode('latin1')), ket))
        print('BARU ', folder[:2], berkas[:70], '|', ket)


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
            e.akhir(a, '#4880#' + peringatan + '#4883#' + ('' if nafkah_gabung else '#4904#') + '#4885##4887#', nama='umur-anak+kelayakan+ahli')
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
    # putusan kabul sebagian: ibu ikut memikul sisa biaya bila ayah hanya mampu sebagian (isian 4901 dan 4902)
    e.akhir('Menimbang, bahwa terhadap petitum #0053# #0046# selebihnya', '#4903#', wajib=False, nama='ibu-ikut-memikul')
    return e


# ---------------------------------------------------------------------------------------------------------------------
# BLANGKO BARU
# ---------------------------------------------------------------------------------------------------------------------
B6A_01 = '[01] [Kabul] Hak Asuh - Kontradiktoir - Anak Belum Mumayyiz.rtf'
B6A_01B = '[01b] [Kabul Verstek] Hak Asuh - Anak Belum Mumayyiz.rtf'
PET_SELEBIHNYA = 'Menimbang, bahwa terhadap petitum #0053# #0046# selebihnya, #4897#, sehingga petitum selebihnya tersebut tidak beralasan hukum dan harus ditolak;'


def baru_kabul_sebagian():
    # [01e] kontradiktoir
    e = tambal_hak_asuh(F6A, B6A_01, penyerahan=True, relatif=True, kabul=True)
    e.sisip(A_SEMA, PET_SELEBIHNYA)
    e.ganti(A_KAB, 'patut dikabulkan dengan menetapkan', 'patut dikabulkan untuk sebagian dengan menetapkan', nama='kabul-sebagian')
    e.ganti(A_KAB, '#4893#;', '#4893#, sedangkan petitum selebihnya harus ditolak;', nama='selebihnya-ditolak')
    e.ganti('1.\tMengabulkan', '#0046#;', '#0046# untuk sebagian;', nama='amar-sebagian')
    nb, ib = amar_biaya(e)
    e.baru[ib] = e.teks(ib).replace('#4894#', '#4895#')
    e.sisip('%d.\t#8505#' % nb, '#4894#.\tMenolak #0053# #0046# selain dan selebihnya;', sebelum=True)
    e.simpan_baru(F6A, '[01e] [Kabul Sebagian] Hak Asuh - Kontradiktoir - Petitum Selebihnya Ditolak.rtf', 'hak asuh dikabulkan sebagian, petitum selebihnya ditolak (alasan isian 4896)')
    # [01f] verstek
    e = tambal_hak_asuh(F6A, B6A_01B, penyerahan=False, relatif=True, kabul=True)
    e.sisip(A_SEMA, PET_SELEBIHNYA)
    e.ganti(A_KAB, 'patut dikabulkan dengan menetapkan', 'patut dikabulkan untuk sebagian dengan menetapkan', nama='kabul-sebagian')
    e.ganti(A_KAB, '#4889#;', '#4889#, sedangkan petitum selebihnya harus ditolak;', nama='selebihnya-ditolak')
    e.ganti('2.\tMengabulkan', 'dengan verstek;', 'untuk sebagian dengan verstek;', nama='amar-sebagian')
    e.ganti('4.\t#8505#', '4.\t#8505#', '5.\t#8505#', nama='nomor-biaya')
    e.sisip('4.\t#8505#', '4.\tMenolak #0053# #0046# selain dan selebihnya;', sebelum=True)
    e.simpan_baru(F6A, '[01f] [Kabul Sebagian Verstek] Hak Asuh - T Tidak Hadir - Petitum Selebihnya Ditolak.rtf', 'hak asuh dikabulkan sebagian dengan verstek (alasan isian 4896)')


def baru_campuran():
    e = tambal_hak_asuh(F6A, B6A_01, penyerahan=False, relatif=True, kabul=True)
    e.ganti('1.\tApakah #9302# #0046# dan #0047# yang bernama #9304# masih belum mumayyiz', 'Apakah #9302# #0046# dan #0047# yang bernama #9304# masih belum mumayyiz (belum berumur 12 tahun)?',
            'Apakah di antara #9302# #0046# dan #0047# yang bernama #9304# ada yang telah mumayyiz (telah berumur 12 tahun) dan ada yang belum mumayyiz?', nama='isu-1')
    e.ganti('2.\tSiapakah di antara #0046# dan #0047# yang lebih dapat menjamin', 'bagi #9302# tersebut?',
            'bagi masing-masing anak tersebut, dan siapakah yang dipilih oleh anak yang telah mumayyiz?', nama='isu-2')
    e.ganti('2.\tBahwa dari perkawinan tersebut lahir', 'yang hingga kini belum berumur 12 (dua belas) tahun atau belum mumayyiz;',
            'yang sebagian telah berumur 12 (dua belas) tahun atau lebih (mumayyiz) dan sebagian lainnya belum berumur 12 (dua belas) tahun (belum mumayyiz);', nama='fakta-2')
    e.ganti_penuh(A105A, 'Menimbang, bahwa Pasal 105 Kompilasi Hukum Islam menentukan bahwa pemeliharaan anak yang belum mumayyiz atau belum berumur 12 tahun adalah hak ibunya (huruf a), '
                  'sedangkan pemeliharaan anak yang sudah mumayyiz diserahkan kepada anak untuk memilih di antara ayah atau ibunya sebagai pemegang hak pemeliharaannya (huruf b), dan Pasal 156 huruf a '
                  'dan huruf b Kompilasi Hukum Islam menentukan bahwa anak yang belum mumayyiz berhak mendapatkan hadhanah dari ibunya, sedangkan anak yang sudah mumayyiz berhak memilih untuk mendapatkan '
                  'hadhanah dari ayah atau ibunya;#4880##4883##4904##4885##4887#', nama='dasar-105-campuran')
    e.ganti_penuh(A_APP, 'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, #9302# #0046# dan #0047# berada dalam keadaan yang berbeda, ada yang belum mumayyiz dan ada yang telah mumayyiz, '
                  'sehingga terhadap anak yang belum mumayyiz berlaku Pasal 105 huruf a dan Pasal 156 huruf a Kompilasi Hukum Islam, sedangkan anak yang telah mumayyiz diberi kesempatan memilih '
                  'sesuai Pasal 105 huruf b dan Pasal 156 huruf b Kompilasi Hukum Islam, dengan tetap mengutamakan kepentingan terbaik bagi masing-masing anak;#4907#', nama='penerapan-campuran')
    e.buang('Menimbang, bahwa pertimbangan tersebut sejalan dengan abstraksi hukum Yurisprudensi', nama='buang-yurisprudensi-ibu')
    e.ganti_penuh(A_KAB, 'Menimbang, bahwa berdasarkan pertimbangan-pertimbangan tersebut di atas, #0053# #0046# beralasan hukum dan patut dikabulkan dengan menetapkan hak pemeliharaan (hadhanah) atas masing-masing anak '
                  'sebagaimana tersebut dalam amar putusan ini, dengan kewajiban masing-masing pemegang hak pemeliharaan memberikan akses kepada orang tua yang tidak memegang hak pemeliharaan atas anak yang bersangkutan '
                  'untuk bertemu, mencurahkan kasih sayang, dan ikut serta dalam pengasuhan anak-anak tersebut#4889#;', nama='kabul-campuran')
    e.ganti_penuh('2.\tMenetapkan', '2.\tMenetapkan hak pemeliharaan (hadhanah) atas anak-anak #0046# dan #0047# sebagai berikut:#4906#', nama='amar-per-anak')
    e.sisip('3.\t#8505#', '3.\tMenetapkan kewajiban kepada masing-masing pemegang hak pemeliharaan (hadhanah) untuk memberikan akses kepada orang tua yang tidak memegang hak pemeliharaan atas anak yang bersangkutan '
            'untuk bertemu, mencurahkan kasih sayang, dan ikut serta dalam pengasuhan anak-anak tersebut#4889#;', gaya_awalan='2.\tMenetapkan', sebelum=True)
    e.ganti('3.\t#8505#', '3.\t#8505#', '4.\t#8505#', nama='nomor-biaya')
    e.simpan_baru(F6A, '[01g] [Kabul] Hak Asuh - Kontradiktoir - Anak Sebagian Mumayyiz (Penetapan per Anak).rtf', 'hak asuh anak yang sebagian mumayyiz sebagian belum: penetapan per anak (isian 4905)')


def baru_tolak_mumayyiz_memilih_t():
    """[03c] hak asuh ditolak karena anak yang sudah mumayyiz memilih Tergugat; hak asuh ditetapkan kepada T (kerangka [03a] untuk anak belum mumayyiz)."""
    berkas = '[03a] [Tolak] Hak Asuh - Kontradiktoir - Hadhanah Ditetapkan kepada T (Ibu, Anak Belum Mumayyiz).rtf'
    e = tambal_hak_asuh(F6A, berkas, penyerahan=False, relatif=True, kabul=False)
    e.ganti_penuh('1.\tApakah #9302# #0046# dan #0047# yang bernama #9304# masih belum mumayyiz',
                  '1.\tApakah #9302# #0046# dan #0047# yang bernama #9304# telah mumayyiz (telah berumur 12 tahun) sehingga berhak memilih?', nama='isu-1')
    e.ganti_penuh('2.\tSiapakah di antara #0046# dan #0047# yang lebih dapat menjamin',
                  '2.\tSiapakah yang dipilih oleh #9302# tersebut dan apakah pilihan itu sejalan dengan kepentingan terbaiknya?', nama='isu-2')
    e.ganti('2.\tBahwa dari perkawinan tersebut lahir', 'yang hingga kini belum berumur 12 (dua belas) tahun atau belum mumayyiz;',
            'yang telah berumur 12 (dua belas) tahun atau lebih (telah mumayyiz);', nama='fakta-2')
    e.sisip('4.\tBahwa #9433#', '5.\tBahwa #9302# tersebut telah didengar keterangannya di persidangan, dan #9307#;')
    e.ganti_penuh(A105A, 'Menimbang, bahwa Pasal 105 huruf b Kompilasi Hukum Islam menentukan pemeliharaan anak yang sudah mumayyiz diserahkan kepada anak untuk memilih di antara ayah atau ibunya sebagai pemegang '
                  'hak pemeliharaannya, dan Pasal 156 huruf b Kompilasi Hukum Islam menentukan anak yang sudah mumayyiz berhak memilih untuk mendapatkan hadhanah dari ayah atau ibunya;#4880##4882##4883##4904##4885##4887#', nama='dasar-105b')
    e.ganti_penuh(A_APP, 'Menimbang, bahwa berdasarkan fakta hukum tersebut di atas, #9302# #0046# dan #0047# telah mumayyiz dan telah menyatakan pilihannya secara bebas di persidangan, yaitu #9307#, '
                  'sedangkan #0047# adalah #9301#nya dan #9433#, dan #9310#, sehingga pilihan tersebut sejalan dengan kepentingan terbaik bagi #9302# tersebut dan #0046# tidak berhasil membuktikan bahwa '
                  '#0047# tidak dapat menjamin keselamatan jasmani dan rohani #9302# tersebut;', nama='penerapan-memilih-T')
    e.buang('Menimbang, bahwa pertimbangan tersebut sejalan dengan abstraksi hukum Yurisprudensi', nama='buang-yurisprudensi-ibu')
    e.simpan_baru(F6A, '[03c] [Tolak] Hak Asuh - Kontradiktoir - Anak Mumayyiz Memilih Tergugat.rtf', 'hak asuh ditolak karena anak mumayyiz memilih T; hak asuh ditetapkan kepada T')


def baru_6b_dari_6a():
    """6b Penguasaan Anak belum punya blangko cabut sesudah jawaban, coret, NO kurang pihak, NO gugatan kabur; susunannya sama dengan 6a, hanya sebutan perkara."""
    for berkas in ('[98b] [Cabut] Gugatan - Sesudah Jawaban dengan Persetujuan T.rtf', '[98c] [Coret] Gugatan - Dibatalkan dari Pendaftaran - Panjar Habis.rtf',
                   '[99a] [NO] Gugatan - Kurang Pihak (Plurium Litis Consortium).rtf', '[99b] [NO] Gugatan - Gugatan Kabur (Obscuur Libel).rtf'):
        e = Edit(F6A, berkas)
        for i, x in enumerate(e.isi):
            if 'penguasaan anak (hadhanah)' in x:
                e.baru[i] = x.replace('penguasaan anak (hadhanah)', 'penguasaan anak')
        e.catat.append('sebutan-penguasaan-anak')
        e.simpan_baru(F6B, berkas, 'disalin dari 6a (susunan sama), sebutan perkara penguasaan anak')


def tambal_bas_verstek():
    """BAS sidang putusan verstek memuat amar yang sama dengan putusan: samakan rincian akses (4889) dan, di 6a, butir penyerahan anak (4908) serta nomor biaya (4895)."""
    for folder, penyerahan in ((F6A + ' - BAS', True), (F6B + ' - BAS', False)):
        for berkas in sorted(os.listdir(os.path.join(ASLI, folder))):
            if not berkas.endswith('.rtf') or 'Pembuktian dan Putusan Verstek' not in berkas:
                continue
            e = Edit(folder, berkas)
            i_m, ip = nomor_awal(e, 'Menetapkan')
            if i_m is None:
                GALAT.append('%s/%s: tidak ada amar Menetapkan' % (folder, berkas))
                continue
            if penyerahan:
                e.ganti('%d.\tMenetapkan' % i_m, AKSES + ';', AKSES + '#4889#;#4908#', nama='amar-akses+penyerahan')
                nb, ib = amar_biaya(e)
                if nb == 4:
                    e.ganti('4.\t#8505#', '4.\t#8505#', '#4895#.\t#8505#', nama='nomor-biaya-verstek')
                else:
                    GALAT.append('%s/%s: nomor amar biaya %r tidak dikenal' % (folder, berkas, nb))
            else:
                e.ganti('%d.\tMenetapkan' % i_m, AKSES, AKSES + '#4889#', nama='amar-akses')
            e.simpan_timpa('BAS putusan verstek: ' + ', '.join(sorted(set(e.catat))))


def main():
    # ---- 6a hak asuh ----
    for berkas in sorted(os.listdir(os.path.join(ASLI, F6A))):
        if not berkas.endswith('.rtf') or re.match(r'\[(97|98|99)', berkas):
            continue
        m = re.match(r'\[(\d+[a-z]?)\]', berkas)
        kode = m.group(1)
        if kode in ('02', '02a', '02b'):
            e = tambal_hak_asuh(F6A, berkas, penyerahan=False, relatif=True, kabul=True, nafkah_gabung=True)
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
    tambal_bas_verstek()
    baru_kabul_sebagian()
    baru_campuran()
    baru_tolak_mumayyiz_memilih_t()
    baru_6b_dari_6a()
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
