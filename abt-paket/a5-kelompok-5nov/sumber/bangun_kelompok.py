# -*- coding: utf-8 -*-
"""Bangun paket abt-a5-kelompok-5nov (keputusan Derry, 5 Nov 2026): 45 kelompok teks merah sisa daftar A5, di atas paket a5-merah-5nov.
pakai: python -B sumber/bangun_kelompok.py <akar dasar sebelum a5-merah (berisi derry_briantono/)> <daftar-teks-merah.csv> <paket-satker> <hasil>
Berkas a5-merah dihitung dari dasar + tambal.tsv a5-merah (md5 diperiksa). Tiap rangkaian merah (lihat alat/kelompok_540.py a5-merah) dikerjakan menurut kelompoknya:
  tetap     : warna merah dihapus, kata sama
  isian     : teks diganti penanda isian, warna merah dihapus
  blok      : paragraf/potongan dibungkus {#K#...}. #K# (data_sql) kosong bila dipakai; bila tidak dipakai bernilai kata kendali \\nonshppict sehingga pembaca RTF
              melewati seluruh grup, tanpa alinea kosong (diukur: hasil/ukur-alinea.txt)
  buang     : petunjuk kerja 38, 39 dibuang
  biarkan   : petunjuk kerja 21-24, 36, 37 dan kelompok 42 tetap merah
BERHENTI bila ada pemeriksaan gagal."""
import base64
import collections
import csv
import hashlib
import importlib.util
import os
import re
import sys

SINI = os.path.dirname(os.path.abspath(__file__))
A5 = os.path.join(SINI, '..', '..', 'a5-merah-5nov')
sys.path.insert(0, os.path.join(A5, 'sumber'))
import merahpos as mp  # noqa: E402
import rtfmini  # noqa: E402

spec = importlib.util.spec_from_file_location('kelompok_540', os.path.join(A5, 'alat', 'kelompok_540.py'))
kl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kl)

N = 'abt-a5-kelompok-5nov'
TANGGAL = '2026-11-05 00:00:00'
BS = bytes([92])
LEWATI = BS + b'nonshppict'
PILIH = 'tidak dipakai\npakai'

# nomor variabel
SKS_P, K_SKS_P, SKS_T, K_SKS_T, BEL, K_BEL, SKS_D, K_SKS_D, KRJ, K_KRJ, KLG, K_KLG, SIT, K_SIT, TRK, K_TRK = range(12150, 12166)
K_KUASA = 12166
ANGKA45, ANGKA12, BUKTI, LAMA1, LAMA2, KELAS = 12167, 12168, 12169, 12170, 12171, 12172
ANAK1, ANAK2, SBT1, SBT2, K_ANAK2 = 12173, 12174, 12175, 12176, 12177
BLM, TGL = 12178, 12179


def sql_pakai(p):
    return ("SELECT IF((SELECT COUNT(*) FROM aps_badilag.abt_data_teks WHERE no_var = %d AND perkara_id = '#perkara_id#' AND TRIM(data) = 'pakai') > 0, '', "
            "CONCAT(CONVERT(CHAR(92) USING utf8), 'nonshppict')) AS data" % p)


def pilih_var(no, judul):
    return [dict(no=no, nama='%s - PILIH: pakai / tidak dipakai (otomatis tidak dipakai bila kosong)' % judul, jenis='data_teks', bawaan=PILIH),
            dict(no=no + 1, nama='%s (OTOMATIS: kosong bila isian #%04d# = pakai; selain itu bagian ini tidak tercetak)' % (judul, no), jenis='data_sql', sql=sql_pakai(no))]


VARIABEL = (
    pilih_var(SKS_P, 'CERAI: PERTIMBANGAN SAKSI #0046# HANYA MENGETAHUI AKIBAT') +
    pilih_var(SKS_T, 'CERAI: PERTIMBANGAN SAKSI #0047# HANYA MENGETAHUI AKIBAT') +
    pilih_var(BEL, 'CERAI: PERTIMBANGAN BUKTI ELEKTRONIK T.3 TANPA DIGITAL FORENSIC') +
    pilih_var(SKS_D, 'CERAI: KESIMPULAN SAKSI KEDUA PIHAK HANYA MENGETAHUI AKIBAT') +
    pilih_var(KRJ, 'CERAI: PERTIMBANGAN SUAMI TIDAK BEKERJA') +
    pilih_var(KLG, 'CERAI: FAKTA KELUARGA SUDAH MERUKUNKAN') +
    pilih_var(SIT, 'HARTA BERSAMA: PELETAKAN SITA JAMINAN SUDAH DILAKUKAN') +
    pilih_var(TRK, 'ITSBAT NO TERIKAT NIKAH: KALIMAT SEBAB BELUM BERCERAI') +
    [dict(no=K_KUASA, nama='KUASA #0047# ADA DI SIPP (OTOMATIS: kosong bila ada kuasa aktif; selain itu bagian ini tidak tercetak)', jenis='data_sql',
          sql="SELECT IF(EXISTS (SELECT 1 FROM perkara_pengacara WHERE perkara_id = '#perkara_id#' AND pihak_ke = 2 AND aktif = 'Y'), '', CONCAT(CONVERT(CHAR(92) USING utf8), 'nonshppict')) AS data"),
     dict(no=ANGKA45, nama='PERWALIAN: NOMOR POSITA TENTANG PEMELIHARAAN ANAK - ISIAN (contoh: 4, 5 dan 6)', jenis='data_teks', bawaan='4, 5 dan 6'),
     dict(no=ANGKA12, nama='PERWALIAN: NOMOR POSITA TENTANG PERKAWINAN DAN ANAK - ISIAN (contoh: 1 dan 2)', jenis='data_teks', bawaan='1 dan 2'),
     dict(no=BUKTI, nama='PERWALIAN: KODE BUKTI SURAT - ISIAN (contoh: P.1 sampai dengan P.6)', jenis='data_teks', bawaan='P.1 sampai dengan P.6'),
     dict(no=LAMA1, nama='ITSBAT TOLAK WALI: LAMA TINGGAL BERSAMA - ISIAN (contoh: 5 (lima))', jenis='data_teks', bawaan='_ (_)'),
     dict(no=LAMA2, nama='ITSBAT TOLAK WALI: LAMA TIDAK DIPERMASALAHKAN - ISIAN (contoh: 5 (lima))', jenis='data_teks', bawaan='_ (_)'),
     dict(no=KELAS, nama='DISPENSASI TOLAK: KELAS ANAK - ISIAN', jenis='data_teks', bawaan=None),
     dict(no=ANAK1, nama='PERWALIAN: NAMA ANAK PERTAMA - ISIAN', jenis='data_teks', bawaan=None),
     dict(no=ANAK2, nama='PERWALIAN: NAMA ANAK KEDUA - ISIAN (kosong = kalimat anak kedua tidak tercetak)', jenis='data_teks', bawaan=None),
     dict(no=SBT1, nama='PERWALIAN: ANAK PERTAMA - PILIH: putra / putri', jenis='data_teks', bawaan='putra\nputri'),
     dict(no=SBT2, nama='PERWALIAN: ANAK KEDUA - PILIH: putra / putri', jenis='data_teks', bawaan='putra\nputri'),
     dict(no=K_ANAK2, nama='PERWALIAN: KALIMAT ANAK KEDUA (OTOMATIS: kosong bila isian #%04d# terisi; selain itu bagian ini tidak tercetak)' % ANAK2, jenis='data_sql',
          sql="SELECT IF((SELECT COUNT(*) FROM aps_badilag.abt_data_teks WHERE no_var = %d AND perkara_id = '#perkara_id#' AND TRIM(IFNULL(data, '')) <> '') > 0, '', CONCAT(CONVERT(CHAR(92) USING utf8), 'nonshppict')) AS data" % ANAK2),
     dict(no=BLM, nama='ITSBAT NO TERIKAT NIKAH: KEADAAN PERCERAIAN - PILIH: belum bercerai / bercerai', jenis='data_teks', bawaan='belum bercerai\nbercerai'),
     dict(no=TGL, nama='ITSBAT NO TERIKAT NIKAH: TANGGAL PERCERAIAN RESMI - ISIAN', jenis='data_teks', bawaan=None)]
)
DIPAKAI_ADA = (9285, 9287, 9288, 9289, 46, 47)

# kelompok -> perlakuan. Nomor kelompok = urutan kelompok-540.
TETAP = {1, 8, 9, 10, 11, 26, 34, 35}
BLOK = {2: K_SKS_P, 3: K_BEL, 4: K_BEL, 5: K_BEL, 6: K_KLG, 7: K_SKS_T, 12: K_SKS_D, 15: K_KRJ, 14: K_KRJ, 25: K_KUASA}
INLINE_KUASA = {13, 18, 29}
BIARKAN = {21, 22, 23, 24, 36, 37, 42}
BUANG = {38, 39}
GANTI = {20: ('4, 5 dan 6', '#%d#' % ANGKA45), 27: ('P.1 sampai dengan P.6', '#%d#' % BUKTI), 28: ('1 dan 2', '#%d#' % ANGKA12), 41: ('_', '#%d#' % KELAS),
         16: ('…', '#9289#'), 31: ('I / II', '#9285#'), 43: ('pria/wanita', '#9287#')}
AWAL_BLOK = re.compile(r'^(?:-|[a-d]\))?\s*$')


def md5b(b):
    return hashlib.md5(b).hexdigest()


def hexs(s):
    return '0x' + s.encode('latin1').hex()


def hapus_cf(b, cf):
    o, z = cf
    if b[o - 1:o] in (b' ', b'{', b'}', b'\r', b'\n'):
        return (o, b[o:z], b'')
    return (o, b[o:z - 1 if b[z - 1:z] == b' ' else z], b'')


class Berkas:
    def __init__(self, rel, b0, b1, rr):
        self.rel, self.b0, self.b = rel, b0, b1
        self.p0, self.p = mp.peta(b0), mp.peta(b1)
        self.rr = rr
        self.ops = []  # (offset, lama, baru, urut)
        self.cf_sudah = set()
        self.ed_pakai = collections.defaultdict(list)  # no paragraf a5 -> (awal, akhir, baru)
        self.ed_tidak = collections.defaultdict(list)
        self.para_lewat = set()
        self.para_buang = set()
        self.dikerja_warna = set()
        self.k_pakai = set()
        self.batas = self._batas()
        self.peta_tok = self._peta_tok()

    def _batas(self):
        """no paragraf -> offset batas sesudah penutup paragrafnya, kedalaman di situ"""
        b = self.b
        hasil = {}
        no = 0
        d = 0
        lewat = []
        st = False
        awal = False
        ms = list(rtfmini.TOK.finditer(b))
        i = 0
        while i < len(ms):
            m = ms[i]
            kata, _a, _h, sim, kur, _t = m.groups()
            if kur == b'{':
                d += 1
                lewat.append(st)
                awal = True
            elif kur == b'}':
                d -= 1
                st = lewat.pop() if lewat else False
                awal = False
            elif sim is not None:
                if sim == b'*' and awal:
                    st = True
                awal = False
            elif kata is not None:
                if awal and kata in rtfmini.LEWAT:
                    st = True
                awal = False
                if not st and kata in (b'par', b'sect', b'row'):
                    z = m.end()
                    j = i + 1
                    dd = d
                    while j < len(ms):
                        g = ms[j].groups()
                        if g[4] == b'}':
                            dd -= 1
                            z = ms[j].end()
                            j += 1
                        elif ms[j].group(0).strip() == b'':
                            j += 1
                        else:
                            break
                    hasil[no] = (z, dd)
                    no += 1
            else:
                awal = False
            i += 1
        return hasil

    def _peta_tok(self):
        ts1 = self.p['toks']
        h = {}
        j = 0
        for t in self.p0['toks']:
            if t['merah'] and re.fullmatch(r'\((?:PERTIMBANGAN APABILA SAKSI HANYA MENGETAHUI PISAH TAPI TIDAK MELIHAT LANGSUNG APA MASALAHNYA|APABILA SUAMI TIDAK BEKERJA/MALAS|ANAK 1 PERSATU P NYA)\)[;]? ?', t['teks']):
                continue
            if j >= len(ts1):
                raise SystemExit('token habis: %s' % self.rel)
            h[id(t)] = ts1[j]
            j += 1
        if j != len(ts1):
            raise SystemExit('jumlah token a5 beda: %s %d %d' % (self.rel, j, len(ts1)))
        return h

    def tambah(self, off, lama, baru):
        self.ops.append((off, lama, baru, len(self.ops)))

    def warna_blok(self, a, z):
        red = [i for i, c in enumerate(self.p['warna']) if rtfmini.merah(c)]
        for m in re.finditer(BS * 2 + rb'cf(\d+) ?', self.b[a:z]):
            if int(m.group(1)) in red:
                cf = (a + m.start(), a + m.end())
                if cf not in self.cf_sudah:
                    self.cf_sudah.add(cf)
                    op = hapus_cf(self.b, cf)
                    self.tambah(*op)

    def warna_token(self, ts):
        """hapus merah token-token (a5). Kendali warna dihapus bila hanya dipakai token ini; selain itu dibungkus."""
        sas = set(t['o0'] for t in ts)
        for t in ts:
            if not t['merah'] or t['o0'] in self.dikerja_warna:
                continue
            self.dikerja_warna.add(t['o0'])
            cf = t['cf_pos']
            lain = [x for x in self.p['toks'] if x['cf_pos'] == cf and x['teks'].strip() and x['o0'] not in sas]
            if not lain and not self.p['pakai_cf'].get(cf):
                if cf not in self.cf_sudah:
                    self.cf_sudah.add(cf)
                    self.tambah(*hapus_cf(self.b, cf))
            else:
                self.tambah(t['o0'], b'', b'{' + BS + b'cf0 ')
                self.tambah(t['o1'], b'', b'}')

    def ganti_run(self, ts, baru):
        """seluruh teks rangkaian diganti: token pertama berisi teks baru, token lain dihapus"""
        k = ts[0]['para']
        a = ts[0]['p0']
        z = ts[-1]['p0'] + len(ts[-1]['teks'])
        for i, t in enumerate(ts):
            self.tambah(t['o0'], self.b[t['o0']:t['o1']], baru.encode('ascii') if i == 0 else b'')
        self.ed_pakai[k].append((a, z, baru))

    def blok(self, kp, kk, k_var):
        """paragraf kp..kk (no a5) menjadi grup bersyarat k_var"""
        ad = self.batas[kp - 1] if kp > 0 else None
        zd = self.batas[kk]
        if ad is None or ad[1] != zd[1]:
            raise SystemExit('batas paragraf tidak sekedalaman: %s P%d-%d %r %r' % (self.rel, kp, kk, ad, zd))
        a, z = ad[0], zd[0]
        if self.b[z:z + 40].lstrip()[:5] != BS + b'pard':
            raise SystemExit('paragraf sesudah blok tanpa pard: %s %r' % (self.rel, self.b[z:z + 50]))
        if not (a + 40 > a and self.b[a:a + 60].lstrip()[:5] == BS + b'pard'):
            raise SystemExit('blok tidak mulai dengan pard: %s %r' % (self.rel, self.b[a:a + 50]))
        self.warna_blok(a, z)
        self.tambah(a, b'', b'{#%d#' % k_var)
        self.tambah(z, b'', b'}')
        for k in range(kp, kk + 1):
            self.para_lewat.add(k)

    def inline(self, t_awal, t_akhir, k_var, sela=b'', potong_kiri=None):
        """potongan dalam paragraf menjadi grup bersyarat. sela = teks sesudah penanda (spasi/kata yang dipindah dari token kiri)."""
        a = self.p['grup_awal'][t_awal['grup']]
        z = self.p['grup_akhir'][t_akhir['grup']] + 1
        seg = self.b[a:z]
        d = 0
        for c in re.sub(BS * 2 + b'.', b'', seg, flags=re.S):
            d += (c == 123) - (c == 125)
            if d < 0:
                raise SystemExit('potongan bersyarat tidak seimbang: %s' % self.rel)
        if d != 0:
            raise SystemExit('potongan bersyarat tidak seimbang: %s' % self.rel)
        if BS + b'par' in seg:
            raise SystemExit('potongan bersyarat memuat par: %s' % self.rel)
        self.tambah(a, b'', b'{#%d#' % k_var + sela)
        self.tambah(z, b'', b'}')
        k = t_awal['para']
        ak = t_awal['p0']
        if potong_kiri:
            tk, n = potong_kiri
            self.tambah(tk['o1'] - n, self.b[tk['o1'] - n:tk['o1']], b'')
            ak -= n
        zk = t_akhir['p0'] + len(t_akhir['teks'])
        pt = self.p['para'][k]
        ki, ka = pt[ak - 1:ak], pt[zk:zk + 1]
        if (ki == ' ' and ka == ' ') or (re.match(r'[#\w]', ki) and re.match(r'[#\w]', ka)):
            raise SystemExit('potongan bersyarat merusak spasi: %s %r %r' % (self.rel, pt[ak - 20:ak], pt[zk:zk + 20]))
        self.ed_tidak[k].append((ak, zk, ''))

    def teks_hasil(self, kosong):
        """paragraf hasil bila semua penanda bersyarat kosong (True) atau melewati (False)"""
        h = self.hasil()
        for no in self.k_pakai:
            h = h.replace(b'#%d#' % no, b'' if kosong else LEWATI)
        return h

    def hasil(self):
        urut = sorted(self.ops, key=lambda x: (x[0], x[3]))
        out = []
        pos = 0
        for off, l0, l1, _ in urut:
            if off < pos:
                raise SystemExit('potongan tumpang tindih %s %d %r' % (self.rel, off, l0[:30]))
            out.append(self.b[pos:off])
            out.append(l1)
            pos = off + len(l0)
        out.append(self.b[pos:])
        return b''.join(out)

    def potongan(self):
        """gabung ubahan yang bersentuhan menjadi (offset, lama, baru); sisipan murni diikat ke satu bita sesudahnya"""
        urut = sorted(self.ops, key=lambda x: (x[0], x[3]))
        gab = []
        for off, l0, l1, _ in urut:
            if gab and gab[-1][0] + len(gab[-1][1]) == off:
                gab[-1] = (gab[-1][0], gab[-1][1] + l0, gab[-1][2] + l1)
            else:
                gab.append((off, l0, l1))
        hasil = []
        for off, l0, l1 in gab:
            if not l0:
                x = self.b[off:off + 1]
                hasil.append((off, x, l1 + x))
            else:
                hasil.append((off, l0, l1))
        return hasil


def daftar_runs(B):
    """rangkaian merah 540 baris atas token dasar -> [(teks, [token dasar])]"""
    p = B.p0
    bc = mp.baris_csv(p['toks'])
    assert len(bc) == len(B.rr), B.rel
    tanda = {id(t): x for x, t in zip(B.rr, bc)}
    by = collections.defaultdict(list)
    for t in p['toks']:
        by[t['para']].append(t)
    keluar = []
    for k, ts in by.items():
        i = 0
        while i < len(ts):
            if not ts[i]['merah']:
                i += 1
                continue
            j = akhir = i
            while j + 1 < len(ts) and (ts[j + 1]['merah'] or not ts[j + 1]['teks'].strip()):
                j += 1
                if ts[j]['merah']:
                    akhir = j
            run = ts[i:akhir + 1]
            baris = [tanda[id(t)] for t in run if id(t) in tanda and tanda[id(t)]['usulan'] == 'hitamkan atau isian']
            if baris:
                tx = p['para'][k][run[0]['p0']:run[-1]['p0'] + len(run[-1]['teks'])]
                tx = kl.CATATAN.sub('', re.sub(r'\s+', ' ', tx)).strip()
                keluar.append((tx, run, baris))
            i = akhir + 1
    return keluar


def kerjakan(B, tx, run0, baris, no, catat, hit):
    run = [B.peta_tok[id(t)] for t in run0 if id(t) in B.peta_tok]
    k = run[0]['para']
    merah = [t for t in run if t['merah']]
    p = B.p
    catat_baris = lambda gol, cara='': [catat.append((x['no'], B.rel, no, x['potongan teks merah'], gol, cara)) for x in baris]  # noqa: E731
    para_ts = [t for t in p['toks'] if t['para'] == k]

    def tetap():
        B.warna_token(merah)

    if no in BIARKAN:
        catat_baris('tetap merah', 'petunjuk kerja' if no != 42 else 'bagian wajib Alasan E')
        hit['tetap merah'] += len(baris)
        return
    if no in TETAP:
        tetap()
        if no in (34, 35):
            # kutipan Arab di atas terjemah ikut hitam (bukan token rtfmini, tidak masuk daftar A5); kata tidak berubah
            sebelum = B.p['para'][k - 1]
            if re.search(r'[A-Za-z]', sebelum) or not re.search('[؀-ۿ]', sebelum):
                raise SystemExit('kutipan Arab kelompok %d tidak dikenal: %s' % (no, B.rel))
            B.warna_blok(B.batas[k - 2][0], B.batas[k - 1][0])
        catat_baris('tetap', 'hitam')
        hit['tetap'] += len(baris)
        return
    if no == 17:
        tetap()
        catat_baris('isian', 'kata pembuka dihitamkan; isian 9289 dari a5-merah')
        hit['isian'] += len(baris)
        return
    if no in BUANG:
        ad, zd = B.batas[k - 1] if k > 0 else (None, None), B.batas[k]
        a = ad[0] if k > 0 else None
        if a is None or ad[1] != zd[1]:
            raise SystemExit('buang: batas %s' % B.rel)
        B.tambah(a, B.b[a:zd[0]], b'')
        B.para_buang.add(k)
        catat_baris('buang', 'paragraf dibuang')
        hit['buang'] += len(baris)
        return
    if no in BLOK:
        kv = BLOK[no]
        B.k_pakai.add(kv)
        pt = B.p['para'][k]
        sisa = pt[:run[0]['p0']] + pt[run[-1]['p0'] + len(run[-1]['teks']):]
        if not AWAL_BLOK.match(sisa.strip()) and no != 15 and no != 14:
            raise SystemExit('kelompok %d bukan satu paragraf utuh: %s %r' % (no, B.rel, sisa[:80]))
        if no == 15:
            # blok suami tidak bekerja: kalimat, kutipan Arab, terjemahnya
            kk = k
            for x in range(k + 1, k + 4):
                if 'Artinya' in B.p['para'].get(x, '')[:12]:
                    kk = x
                    break
            if kk == k or kk - k != 2:
                raise SystemExit('blok 15 tidak berbentuk kalimat-Arab-Artinya: %s' % B.rel)
            B.blok(k, kk, kv)
            B.dikerja_warna.update(t['o0'] for t in B.p['toks'] if k <= t['para'] <= kk)
            pos = pt.index('#0046##')
            tk = [t for t in para_ts if t['teks'].startswith('# sendiri')]
            if len(tk) != 1:
                raise SystemExit('salah ketik 15: %s' % B.rel)
            B.tambah(tk[0]['o0'], b'#', b'')
            B.ed_pakai[k].append((pos + 6, pos + 7, ''))
            catat_baris('kalimat pilihan', '#%d' % kv)
        elif no == 14:
            catat_baris('kalimat pilihan', '#%d (satu blok dengan kelompok 15)' % kv)
        else:
            B.blok(k, k, kv)
            B.dikerja_warna.update(t['o0'] for t in B.p['toks'] if t['para'] == k)
            if no == 25:
                lm = 'Menimbang, bahwa dalam #0047# dalam persidangan'
                if pt.count(lm) != 1:
                    raise SystemExit('salah ketik 25: %s' % B.rel)
                tk = [t for t in para_ts if lm in t['teks']]
                i = tk[0]['teks'].index(lm) + len('Menimbang, bahwa ')
                B.tambah(tk[0]['o0'] + i, b'dalam ', b'')
                pos = pt.index(lm) + len('Menimbang, bahwa ')
                B.ed_pakai[k].append((pos, pos + 6, ''))
            catat_baris('isian otomatis' if no == 25 else 'kalimat pilihan', '#%d' % kv)
        hit['isian otomatis' if no == 25 else 'kalimat pilihan'] += len(baris)
        return
    if no in INLINE_KUASA:
        B.k_pakai.add(K_KUASA)
        i = para_ts.index(run[0])
        kiri = para_ts[i - 1]
        if not kiri['teks'].endswith(' ') or kiri['hex']:
            raise SystemExit('kiri kuasa: %s %r' % (B.rel, kiri['teks'][-10:]))
        B.warna_token(merah)
        if run[-1]['teks'].endswith(' '):
            B.inline(run[0], run[-1], K_KUASA)  # spasi kanan ikut terlewati, spasi kiri tetap
        else:
            B.inline(run[0], run[-1], K_KUASA, sela=b' ', potong_kiri=(kiri, 1))
        catat_baris('isian otomatis', '#%d' % K_KUASA)
        hit['isian otomatis'] += len(baris)
        return
    if no == 19:
        B.k_pakai.add(K_SIT)
        if merah[-1]['teks'] != ';':
            raise SystemExit('19 tanpa titik koma: %s' % B.rel)
        B.warna_token(merah)
        B.inline(run[0], run[-2], K_SIT)
        catat_baris('kalimat pilihan', '#%d' % K_SIT)
        hit['kalimat pilihan'] += len(baris)
        return
    if no == 40:
        B.k_pakai.add(K_TRK)
        i = para_ts.index(run[0])
        kiri = para_ts[i - 1]
        sisip = ' karena '
        if not kiri['teks'].endswith(sisip):
            raise SystemExit('kiri 40: %r' % kiri['teks'][-20:])
        B.warna_token(merah)
        peta = {'belum bercerai': '#%d#' % BLM, '/ bercerai': '', 'I': '#9285#', ' / II ': ' ', ' suaminya/': ' #9288#nya', 'istrinya': '', '_': '#%d#' % TGL}
        for t in run:
            if t['teks'] in peta:
                B.tambah(t['o0'], B.b[t['o0']:t['o1']], peta[t['teks']].encode('ascii'))
                B.ed_pakai[k].append((t['p0'], t['p0'] + len(t['teks']), peta[t['teks']]))
        B.inline(run[0], run[-1], K_TRK, sela=sisip.encode('ascii'), potong_kiri=(kiri, len(sisip)))
        catat_baris('kalimat pilihan', '#%d' % K_TRK)
        hit['kalimat pilihan'] += len(baris)
        return
    if no == 30:
        pt = B.p['para'][k]
        # dua tempat berurutan
        nomor = LAMA1 if not B.ed_pakai.get(k) else LAMA2
        raw = ''.join(t['teks'] for t in run)
        if not re.fullmatch(r'_ \(_\) ?tahun', re.sub(r'\s+', ' ', pt[run[0]['p0']:run[-1]['p0'] + len(run[-1]['teks'])])):
            raise SystemExit('30 tak dikenal: %r' % raw)
        B.warna_token(merah)
        teks = pt[run[0]['p0']:run[-1]['p0'] + len(run[-1]['teks'])]
        B.ganti_run(run, teks.replace('_ (_)', '#%d#' % nomor))
        catat_baris('isian', '#%d' % nomor)
        hit['isian'] += len(baris)
        return
    if no in (32, 33, 44, 45):
        nomor = {32: ANAK1, 33: ANAK2, 45: SBT1, 44: SBT2}[no]
        B.warna_token(merah)
        pt = B.p['para'][k]
        teks = pt[run[0]['p0']:run[-1]['p0'] + len(run[-1]['teks'])]
        lama = {32: 'ANAK 1', 33: 'ANAK 2', 45: 'putri', 44: 'putra'}[no]
        B.ganti_run(run, teks.replace(lama, '#%d#' % nomor))
        catat_baris('isian', '#%d (data anak SIPP kosong di salinan)' % nomor)
        hit['isian'] += len(baris)
        return
    if no in GANTI:
        lama, baru = GANTI[no]
        B.warna_token(merah)
        pt = B.p['para'][k]
        teks = pt[run[0]['p0']:run[-1]['p0'] + len(run[-1]['teks'])]
        if teks.count(lama) != 1:
            raise SystemExit('kelompok %d tak dikenal: %s %r' % (no, B.rel, teks))
        if no == 16:
            # tanda elipsis berbentuk kendali unicode, bukan token teks
            seg = B.b[run[0]['o1']:run[-1]['o0']]
            pol = BS + b'u8230 ?'
            if seg.count(pol) != 1:
                raise SystemExit('elipsis 16: %s' % B.rel)
            B.tambah(run[0]['o1'] + seg.index(pol), pol, b'')
        B.ganti_run(run, teks.replace(lama, baru))
        catat_baris('isian', baru)
        hit['isian'] += len(baris)
        return
    raise SystemExit('kelompok tanpa perlakuan: %d' % no)


def kalimat_anak2(B, hit):
    """' dan ANAK 2 merupakan ... tanggal #9296#' bersyarat nama anak kedua terisi"""
    p = B.p
    tk = [t for t in p['toks'] if '#9296#' in t['teks']]
    if not tk:
        return
    akhir = tk[0]
    k = akhir['para']
    ts = [t for t in p['toks'] if t['para'] == k]
    i = ts.index(akhir)
    a = i
    while a > 0 and ts[a]['teks'].strip() != 'dan':
        a -= 1
    if ts[a]['teks'] != ' dan ':
        raise SystemExit('anak kedua: token dan')
    B.k_pakai.add(K_ANAK2)
    B.inline(ts[a], akhir, K_ANAK2)
    hit['kalimat anak kedua bersyarat'] += 1


def sampai_para(hasil, kosong_par, buang):
    return [hasil[k] for k in sorted(hasil) if k not in kosong_par and k not in buang]


def main():
    akar, daftar_csv, keluar, hasil = sys.argv[1:5]
    rows = list(csv.DictReader(open(daftar_csv, encoding='utf-8-sig')))
    per = collections.OrderedDict()
    for r in rows:
        per.setdefault(r['berkas'], []).append(r)
    L = kl.kumpul(akar, daftar_csv)
    nomor = {g['teks']: i for i, g in enumerate(L, 1)}
    a5p = os.path.join(A5, 'paket-satker')
    dt = {}
    for l in open(os.path.join(a5p, 'daftar-tambal.tsv'), encoding='utf-8'):
        if not l.startswith('#') and l.strip():
            x = l.rstrip('\n').split('\t')
            dt[x[1]] = x
    pot = collections.defaultdict(list)
    for l in open(os.path.join(a5p, 'tambal.tsv'), encoding='ascii'):
        if not l.startswith('#') and l.strip():
            k, off, l0, l1 = l.rstrip('\n').split('\t')
            pot[k].append((int(off), base64.b64decode(l0), base64.b64decode(l1)))
    catat, daftar, tambal = [], [], []
    hit = collections.Counter()
    kode_n = 0
    merah_laporan = []
    for rel, rr in per.items():
        if not any(x['usulan'] == 'hitamkan atau isian' for x in rr):
            continue
        p_rel = 'derry_briantono/' + rel
        b0 = open(os.path.join(akar, p_rel.replace('/', os.sep)), 'rb').read()
        b1 = b0
        if p_rel in dt:
            for off, l0, l1 in sorted(pot[dt[p_rel][0]], key=lambda x: -x[0]):
                assert b1[off:off + len(l0)] == l0
                b1 = b1[:off] + l1 + b1[off + len(l0):]
            if md5b(b1) != dt[p_rel][3]:
                raise SystemExit('md5 a5 beda ' + rel)
        B = Berkas(rel, b0, b1, rr)
        runs = daftar_runs(B)
        for tx, run0, baris in runs:
            kerjakan(B, tx, run0, baris, nomor[tx], catat, hit)
        if rel.startswith('6 Perwalian/Perwalian Anak oleh ortu kandung Tolak'):
            kalimat_anak2(B, hit)
        if not B.ops:
            hit['berkas tanpa ubahan'] += 1
            continue
        h = B.hasil()
        # periksa: paragraf bila dipakai dan bila tidak dipakai
        harap_p = dict(B.p['para'])
        for k, ed in B.ed_pakai.items():
            s = harap_p[k]
            for a, z, baru in sorted(ed, reverse=True):
                s = s[:a] + baru + s[z:]
            harap_p[k] = s
        p_pakai = [harap_p[k] for k in sorted(harap_p) if k not in B.para_buang]
        h_pakai = B.teks_hasil(True)
        pp = mp.peta(h_pakai)
        par = [pp['para'][k] for k in sorted(pp['para'])]
        if par != p_pakai:
            for i, (x, y) in enumerate(zip(p_pakai, par)):
                if x != y:
                    raise SystemExit('paragraf (dipakai) beda %s #%d\n%r\n%r' % (rel, i, x[-300:], y[-300:]))
            raise SystemExit('jumlah paragraf (dipakai) beda %s %d %d' % (rel, len(p_pakai), len(par)))
        harap_t = dict(B.p['para'])
        for k in set(B.ed_pakai) | set(B.ed_tidak):
            s = harap_t[k]
            eds = list(B.ed_tidak.get(k, []))
            bungkus = eds
            for a, z, baru in sorted(B.ed_pakai.get(k, []), reverse=True):
                if not any(x <= a and z <= y for x, y, _ in bungkus):
                    eds = eds + [(a, z, baru)]
            for a, z, baru in sorted(eds, reverse=True):
                s = s[:a] + baru + s[z:]
            harap_t[k] = s
        p_tidak = [harap_t[k] for k in sorted(harap_t) if k not in B.para_buang and k not in B.para_lewat]
        h_tidak = B.teks_hasil(False)
        pt = mp.peta(h_tidak)
        par = [pt['para'][k] for k in sorted(pt['para'])]
        if par != p_tidak:
            for i, (x, y) in enumerate(zip(p_tidak, par)):
                if x != y:
                    raise SystemExit('paragraf (tidak dipakai) beda %s #%d\n%r\n%r' % (rel, i, x[-300:], y[-300:]))
            raise SystemExit('jumlah paragraf (tidak dipakai) beda %s %d %d' % (rel, len(p_tidak), len(par)))
        # kurung seimbang; tanpa kata nama aplikasi baru
        d = 0
        for c in re.sub(BS * 2 + b'.', b'', h, flags=re.S):
            d += (c == 123) - (c == 125)
        if d != 0:
            raise SystemExit('kurung tidak seimbang ' + rel)
        if h.lower().count(b'aleta') != b1.lower().count(b'aleta'):
            raise SystemExit('kata terlarang ' + rel)
        kode_n += 1
        kode = 'K%04d' % kode_n
        gab = B.potongan()
        h2 = b1
        for off, l0, l1 in sorted(gab, key=lambda x: -x[0]):
            assert h2[off:off + len(l0)] == l0
            h2 = h2[:off] + l1 + h2[off + len(l0):]
        if h2 != h:
            raise SystemExit('potongan tidak menghasilkan berkas yang sama: ' + rel)
        daftar.append((kode, p_rel, md5b(b1), md5b(h), len(gab)))
        tambal += [(kode, off, base64.b64encode(l0).decode(), base64.b64encode(l1).decode()) for off, l0, l1 in gab]
        merah_laporan.append((rel, len(mp.baris_csv(B.p['toks'])), len(mp.baris_csv(pp['toks']))))
    os.makedirs(keluar, exist_ok=True)
    os.makedirs(hasil, exist_ok=True)
    with open(os.path.join(keluar, 'daftar-tambal.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('# kode\tberkas\tmd5_lama (sesudah a5-merah-5nov)\tmd5_baru\tpotongan\n')
        for d in daftar:
            f.write('%s\t%s\t%s\t%s\t%d\n' % d)
    with open(os.path.join(keluar, 'tambal.tsv'), 'w', encoding='ascii', newline='\n') as f:
        f.write('# kode\toffset\tb64(teks lama)\tb64(teks baru)\n')
        for x in tambal:
            f.write('%s\t%d\t%s\t%s\n' % x)
    tulis_sql(keluar)
    with open(os.path.join(hasil, 'daftar-tambalan.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['no daftar', 'berkas', 'kelompok', 'potongan', 'golongan', 'cara'])
        for c in sorted(catat, key=lambda x: int(x[0])):
            w.writerow(c)
    with open(os.path.join(hasil, 'merah-per-berkas.tsv'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('berkas\tmerah sesudah a5-merah (>=2 huruf)\tmerah sesudah paket ini\n')
        for x in merah_laporan:
            f.write('%s\t%d\t%d\n' % x)
    with open(os.path.join(hasil, 'ringkas.txt'), 'w', encoding='utf-8', newline='\n') as f:
        for k in sorted(hit):
            f.write('%s\t%d\n' % (k, hit[k]))
        f.write('berkas paket\t%d\npotongan\t%d\nvariabel baru\t%d\n' % (len(daftar), len(tambal), len(VARIABEL)))
    print(open(os.path.join(hasil, 'ringkas.txt'), encoding='utf-8').read())


SIDIK_SQL = ("MD5(CONCAT_WS('|', v.nama, v.data_type, REPLACE(IFNULL(v.sql_query, ''), CONCAT(DATABASE(), '.'), 'aps_badilag.'), IFNULL(v.referensi, ''), IFNULL(v.multi_sidang, ''), "
             "IFNULL(v.default_data, ''), v.locked, IFNULL(v.modifier, '')))")


def sidik_py(x):
    return md5b('|'.join([x['nama'], x['jenis'], x.get('sql', ''), '', '', x.get('bawaan') or '', '0', 'admin']).encode('latin1'))


def tulis_sql(keluar):
    kepala = '-- Paket ABT "%s" (5 Nov 2026): 45 kelompok teks merah sisa daftar A5 (keputusan Derry). Hanya blangko derry_briantono dan isian blangkonya.\n' % N
    nb = [x['no'] for x in VARIABEL]
    dno = ','.join(str(n) for n in nb)
    with open(os.path.join(keluar, 'nomor-variabel.txt'), 'w', newline='\n') as f:
        f.write('# variabel BARU (kosong di salinan server 3 Nov; diperiksa PRASYARAT)\n' + ''.join('%d\n' % n for n in nb))
    nl = ' UNION ALL '.join("SELECT %d AS n, '%s' AS h" % (x['no'], sidik_py(x)) for x in VARIABEL)
    pras = kepala + ('-- PRASYARAT "A|B|C": A = nomor paket berisi lain dari paket (0) | B = variabel paket persis (0 pasang pertama / %d pasang ulang) | C = variabel lama yang dirujuk ada, termasuk isian a5-merah: %s (%d)\n'
                     % (len(nb), ', '.join(str(n) for n in DIPAKAI_ADA), len(DIPAKAI_ADA)))
    pras += ("SELECT CONCAT_WS('|',\n (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var IN (%s) AND NOT EXISTS (SELECT 1 FROM (%s) p WHERE p.n = v.no_var AND p.h = %s)),\n"
             " (SELECT COUNT(*) FROM abt_variabel v JOIN (%s) p ON p.n = v.no_var AND p.h = %s),\n"
             " (SELECT COUNT(*) FROM abt_variabel WHERE no_var IN (%s))) AS p;\n" % (dno, nl, SIDIK_SQL, nl, SIDIK_SQL, ','.join(str(n) for n in DIPAKAI_ADA)))
    open(os.path.join(keluar, '%s-PRASYARAT.sql' % N), 'w', encoding='latin1', newline='\n').write(pras)
    open(os.path.join(keluar, 'harap.txt'), 'w', newline='\n').write('0|0|%d\n0|%d|%d\n' % (len(DIPAKAI_ADA), len(nb), len(DIPAKAI_ADA)))
    ps = [kepala, 'START TRANSACTION;\n']
    for x in VARIABEL:
        baw = 'CONVERT(%s USING latin1)' % hexs(x['bawaan']) if x.get('bawaan') else 'NULL'
        sq = "REPLACE(CONVERT(%s USING latin1), 'aps_badilag.', CONCAT(DATABASE(), '.'))" % hexs(x['sql']) if x.get('sql') else 'NULL'
        ps.append("INSERT INTO abt_variabel (no_var, nama, data_type, data_tabel, data_kolom, urutan_data, referensi, sql_query, default_data, multi_sidang, locked, modifier, modified) "
                  "SELECT %d, CONVERT(%s USING latin1), '%s', NULL, NULL, NULL, NULL, %s, %s, NULL, 0, 'admin', '%s' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM abt_variabel WHERE no_var = %d);\n"
                  % (x['no'], hexs(x['nama']), x['jenis'], sq, baw, TANGGAL, x['no']))
    ps.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PASANG.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(ps))
    bag = ["SELECT 'var %d' AS label, (SELECT COUNT(*) FROM abt_variabel v WHERE v.no_var = %d AND %s = '%s') AS ok" % (x['no'], x['no'], SIDIK_SQL, sidik_py(x)) for x in VARIABEL]
    q = kepala + 'SELECT IF((SELECT COUNT(*) FROM (\n' + '\nUNION ALL '.join(bag) + "\n) y WHERE y.ok <> 1) = 0, 'SEMUA COCOK', 'ADA BEDA') AS periksa;\n"
    open(os.path.join(keluar, '%s-PERIKSA.sql' % N), 'w', encoding='latin1', newline='\n').write(q)
    r = [kepala, 'START TRANSACTION;\n']
    r += ["DELETE v FROM abt_variabel v WHERE v.no_var = %d AND %s = '%s';\n" % (x['no'], SIDIK_SQL, sidik_py(x)) for x in VARIABEL]
    r.append('COMMIT;\n')
    open(os.path.join(keluar, '%s-PULIH.sql' % N), 'w', encoding='latin1', newline='\n').write(''.join(r))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
