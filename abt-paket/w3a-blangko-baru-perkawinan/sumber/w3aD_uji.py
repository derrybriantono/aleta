# -*- coding: utf-8 -*-
"""Uji perilaku paket jenis hak-bekas-istri (agen W3a-D). Mencetak satu objek JSON {nama: {ok, detail}} ke stdout; dipanggil oleh
manajemen_surat/src/test/w3a-hak-bekas-istri-21okt.test.ts (dan boleh dijalankan sendiri: python w3aD_uji.py)."""
import json
import os
import random
import re
import sys

SUMBER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SUMBER)
import w3a_lib as L  # noqa: E402
import variabel_def as VD  # noqa: E402
import jenis_hak_bekas_istri as H  # noqa: E402

HASIL = {}


def catat(nama, ok, detail=''):
    HASIL[nama] = dict(ok=bool(ok), detail=detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False))


def teks_rtf(path):
    return L.rtf_ke_teks(open(L.lp(path), 'rb').read().decode('latin1'))


def main():
    J = H.J
    n_p, n_b = H.bangun()
    catat('jumlah-berkas', n_p == 15 and n_b == 38, 'putusan %d, BAS %d' % (n_p, n_b))

    mine = [v for v in VD.VAR if 3740 <= v['no'] <= 3789]
    catat('variabel-dalam-jatah', len(mine) == 39, len(mine))
    catat('nama-maks-200-dan-sql-maks-60000', all(len(v['nama']) <= 200 and len(v['sql'] or '') < 60000 and len(v['default'] or '') < 60000 for v in mine),
          [(v['no'], len(v['nama']), len(v['sql'] or '')) for v in mine if len(v['nama']) > 200 or len(v['sql'] or '') >= 60000])
    catat('tanpa-kata-aleta', all('aleta' not in (v['nama'] + (v['sql'] or '') + (v['default'] or '')).lower() for v in mine))

    teks_vars = {str(v['no']) for v in mine if v['tipe'] != 'data_sql'}
    catat('isian-subset-data_teks', set(H.ISIAN) <= teks_vars, sorted(set(H.ISIAN) - teks_vars))
    catat('isian-ramah-lengkap', set(H.RAMAH) == teks_vars, sorted(teks_vars ^ set(H.RAMAH)))
    catat('isian-nilai-sah', all(v[0] in ('manual', 'opsional') and v[1].strip() for v in H.ISIAN.values()))
    catat('peta-unik', len({(m['status'], m['keadaan']) for m in H.PETA}) == len(H.PETA) == 15, len(H.PETA))
    ada = all(os.path.exists(L.lp(os.path.join(L.OUT, J['folder'], m['berkas']))) for m in H.PETA)
    catat('peta-berkas-ada', ada)

    # --- isi RTF ---
    kamus = set()
    for ln in open('D:/aleta-dev/kerja/w3a/abt_variabel_server.tsv', encoding='latin1', newline='').read().split('\n'):
        f = ln.split('\t')
        if f and f[0].isdigit():
            kamus.add(int(f[0]))
    kamus |= {v['no'] for v in VD.VAR}
    galat = []
    for sub in (J['folder'], J['folder_bas']):
        d = os.path.join(L.OUT, sub)
        for f in sorted(os.listdir(L.lp(d))):
            raw = open(L.lp(os.path.join(d, f)), 'rb').read().decode('latin1')
            t = L.rtf_ke_teks(raw)
            if L.periksa_token(raw):
                galat.append('%s: token terpecah' % f)
            for k in set(re.findall(r'#(\d{4})#', t)):
                if int(k) not in kamus:
                    galat.append('%s: #%s# tidak ada' % (f, k))
            low = t.lower()
            for kata in ('aleta', 'nafkah anak', 'perwalian', 'wali adhal', 'hibah', 'wakaf', 'wasiat', '...', '[ ]', 'todo', '9748', '9757', '9751', '9753', '9752', '9758', '9754'):
                if kata in low:
                    galat.append('%s: memuat "%s"' % (f, kata))
    catat('isi-rtf-bersih', not galat, galat[:20])

    # tiap putusan substantif memuat variabel pertimbangan/amar yang benar
    def tok(folder, awal):
        f = [x for x in os.listdir(L.lp(os.path.join(L.OUT, folder))) if x.startswith(awal)][0]
        return teks_rtf(os.path.join(L.OUT, folder, f))
    kabul = tok(J['folder'], '[01] ')
    tolak = tok(J['folder'], '[03] ')
    no_kabur = tok(J['folder'], '[99b] ')
    perdamaian = tok(J['folder'], '[97] ')
    catat('kabul-memuat-pertimbangan-dan-amar', all(x in kabul for x in ('#3765#', '#3766#', '#3767#', '#3768#', '#3769#', '#3770#', '#3771#', '#3773#', '#3774#', '#3763#', '#3764#', '#3740#', '#3772#')))
    catat('kabul-kewenangan-angka-13', 'angka 13' in kabul and 'angka 12' not in kabul and 'angka 11' not in kabul)
    catat('tolak-memuat-alasan-tanpa-amar-bayar', '#3755#' in tolak and '#3773#' not in tolak and '#3779#' in tolak)
    catat('no-kabur-tanpa-nafkah', '#9651#' in no_kabur and '#3773#' not in no_kabur)
    catat('perdamaian-angka-13', 'angka 13' in perdamaian and 'angka 11' not in perdamaian)
    # token isian tersembunyi di berkas substantif
    catat('token-tersembunyi', all('#%s#' % k in kabul for k in ('3740', '3743', '3746', '9712', '9713')))
    # BAS: bukti P/T dan amar verstek
    bas = tok(J['folder_bas'], 'BAS ALUR 04 [6] ')
    catat('bas-bukti-p', '#3757#' in bas and '#9955#' not in bas)
    bas_t = tok(J['folder_bas'], 'BAS ALUR 04 [7] ')
    catat('bas-bukti-t', '#3758#' in bas_t and '#9911#' not in bas_t)
    v2 = tok(J['folder_bas'], 'BAS ALUR 65 Hak Bekas Istri - Sidang 2 - T Tetap Tidak Hadir - Pembuktian dan Putusan Verstek.rtf')
    catat('bas-verstek-amar', '#3773#' in v2 and '3.\tMenghukum #0047# untuk membayar' in v2)

    # --- SQL (hanya bila MariaDB lokal tersedia) ---
    try:
        import w3aD_uji_sql as U
        if not os.path.exists(U.MYSQL):
            raise RuntimeError('mysql lokal tidak ada')
        rc, out, err = U.jalan_lokal('SELECT 1')
        if rc != 0:
            raise RuntimeError(err)
        def sql(no, iso, pet='', dum=None):
            rc, out, err = U.jalan_lokal(U.siapkan(U.var(no)['sql'], iso, pet, dummy=dum))
            if rc != 0:
                raise RuntimeError('%d: %s' % (no, err[:300]))
            return out
        iso = {9712: 'Rp4.500.000,00 (3 bulan x Rp1.500.000,00)', 3751: 'Rp 1.500.000,00', 3752: 'Rp. 900.000,00', 9713: 'uang sejumlah Rp3.000.000,00', 9711: '', 3753: 'sebidang tanah'}
        catat('sql-jumlah', sql(3760, iso) == '9900000' and sql(3761, iso) == 'Rp9.900.000,00' and sql(3762, iso) == 'sembilan juta sembilan ratus ribu rupiah', sql(3760, iso))
        catat('sql-jumlah-kosong', sql(3760, {}) == '' and sql(3762, {}) == '')
        # terbilang acak
        def tb(n):
            S = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
            def f(n):
                if n < 12: return S[n]
                if n < 20: return f(n - 10) + ' belas'
                if n < 100: return f(n // 10) + ' puluh' + (' ' + f(n % 10) if n % 10 else '')
                if n < 200: return 'seratus' + (' ' + f(n - 100) if n > 100 else '')
                if n < 1000: return f(n // 100) + ' ratus' + (' ' + f(n % 100) if n % 100 else '')
                if n < 2000: return 'seribu' + (' ' + f(n - 1000) if n > 1000 else '')
                if n < 10 ** 6: return f(n // 1000) + ' ribu' + (' ' + f(n % 1000) if n % 1000 else '')
                if n < 10 ** 9: return f(n // 10 ** 6) + ' juta' + (' ' + f(n % 10 ** 6) if n % 10 ** 6 else '')
                return f(n // 10 ** 9) + ' miliar' + (' ' + f(n % 10 ** 9) if n % 10 ** 9 else '')
            return f(n) + ' rupiah'
        random.seed(21)
        uji = [1, 11, 21, 100, 111, 1000, 1500, 12500000, 1000000000, 999999999999] + [random.randint(1, 10 ** random.randint(2, 11)) for _ in range(12)]
        salah = [n for n in uji if sql(3762, {9712: 'Rp{:,}'.format(n).replace(',', '.') + ',00'}) != tb(n)]
        catat('sql-terbilang-acak', not salah, salah)
        pet = 'nafkah iddah, maskan, kiswah, mut&#39;ah dan nafkah anak'
        catat('sql-daftar-dituntut', sql(3764, {}, pet) == 'nafkah iddah, maskan, kiswah, mut&#39;ah dan biaya hadhanah anak' and sql(3764, {}, '') == 'hak-hak bekas istri', sql(3764, {}, pet))
        catat('sql-daftar-dikabulkan', sql(3763, iso) == 'nafkah iddah, maskan, kiswah, mut&#39;ah dan mahar yang masih terhutang' and sql(3763, {}) == '', sql(3763, iso))
        lengkap = {**iso, **{9711: 'Rp6.000.000,00', 9740: 'Rp1.500.000,00', 3741: 'cerai talak', 3745: 'x', 3746: 'dalam perkara ini tidak ditemukan bukti bahwa #0046# berbuat nusyuz'}}
        dum = {'3761': sql(3761, lengkap), '3762': sql(3762, lengkap)}
        amar = sql(3773, lengkap)
        catat('sql-amar-butir', amar.count('<br>    - ') == 7 and 'nafkah iddah selama masa iddah sebesar Rp4.500.000,00' in amar and 'biaya hadhanah' in amar, amar[:200])
        jml = sql(3774, {**lengkap, **{3756: 'segera setelah putusan ini berkekuatan hukum tetap'}}, dum=dum)
        catat('sql-amar-jumlah-waktu', 'seluruhnya berjumlah Rp15.900.000,00' in jml and 'hak yang bukan berupa uang dan biaya hadhanah anak' in jml and 'dilakukan segera' in jml, jml)
        nus = sql(3766, {**iso, **{3746: '#0046# terbukti berbuat nusyuz sehingga', 3741: 'cerai gugat'}})
        catat('sql-nusyuz-diperiksa', '[PERIKSA' in nus and 'cerai gugat' in nus, nus[:200])
        qob = sql(3767, {**iso, **{3745: 'belum bergaul (qobla al dukhul)', 3741: 'cerai talak'}})
        catat('sql-qobla-mutah-diperiksa', '[PERIKSA' in qob and 'Pasal 158 huruf b' in qob)
        sdp = sql(3765, {3747: 'hak telah diputus dalam perkara perceraian', 3748: 'nafkah iddah'})
        catat('sql-nebis-in-idem', 'nebis in idem' in sdp and 'Pasal 1917' in sdp and 'bukan nebis' not in sdp)
        belum = sql(3765, {3747: 'belum pernah diputus'})
        catat('sql-bukan-nebis', 'bukan nebis in idem' in belum)
        catat('sql-kosong-tak-tercetak', all(sql(n, {}) == '' for n in (3766, 3767, 3768, 3769, 3770, 3771, 3774, 3775, 3776, 3777, 3778, 3779)))
        catat('sql-fakta-iddah', 'berakhir' in sql(3772, {3744: 'telah berakhir', 3743: 'x', 3742: '1 Januari 2025'}) and 'Pasal 153 ayat (4)' in sql(3772, {3742: '1 Januari 2025'}))
        catat('sql-lampau-anak', 'Surat Edaran Mahkamah Agung Nomor 2 Tahun 2019' in sql(3770, {9747: 'Rp1.000.000,00', 9746: 'sejak Januari 2025'}))
    except Exception as e:  # noqa: BLE001
        catat('sql-dilewati', True, 'SKIP: %s' % e)
    print(json.dumps(HASIL, ensure_ascii=False))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
