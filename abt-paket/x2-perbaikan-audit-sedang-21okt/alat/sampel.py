# -*- coding: utf-8 -*-
"""Susun daftar perkara uji: contoh audit + acak + kasus khusus S1/S2/S3/S4/S6 (dari sipp_donggala lokal)."""
import json, random, subprocess, sys


def amb(l, n):
    l = list(l)
    return random.sample(l, min(n, len(l)))


MY = r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'


def q(sql):
    r = subprocess.run([MY, '-uroot', '--default-character-set=latin1', '-N', 'sipp_donggala', '-e', sql], capture_output=True)
    if r.returncode:
        raise SystemExit(r.stderr.decode('latin1'))
    return [x.split('\t') for x in r.stdout.decode('latin1').split('\n') if x.strip()]


contoh = [int(x) for x in open(r'D:\Aplikasi\aleta\tmp\audit-abt\sampel.txt').read().strip().split(',')]
semua = [int(r[0]) for r in q("select perkara_id from perkara order by perkara_id")]
random.seed(20261021)
acak = random.sample(semua, 260)

khusus = {}
khusus['pp_ganda'] = [int(r[0]) for r in q("select distinct perkara_id from perkara_panitera_pn where aktif='Y' and perkara_id in (select perkara_id from perkara_panitera_pn where aktif='Y' group by perkara_id having count(*)>1)")]
khusus['pp_tanpa_aktif'] = amb([int(r[0]) for r in q("select perkara_id from perkara p where not exists (select 1 from perkara_panitera_pn x where x.perkara_id=p.perkara_id and x.aktif='Y')")], 10)
khusus['jurusita_campur'] = [int(r[0]) for r in q("select distinct a.perkara_id from perkara_jurusita a join jurusita b on a.jurusita_id=b.id group by a.perkara_id having count(distinct b.jabatan)>1")]
khusus['jurusita_ganda_aktif'] = [int(r[0]) for r in q("select perkara_id from perkara_jurusita where aktif='Y' and urutan=1 group by perkara_id having count(*)>1")][:12]
khusus['jurusita_tanpa_aktif'] = amb([int(r[0]) for r in q("select perkara_id from perkara_jurusita group by perkara_id having sum(aktif='Y' and urutan=1)=0")], 6)
khusus['tanpa_jadwal'] = [int(r[0]) for r in q("select perkara_id from perkara p where not exists (select 1 from perkara_jadwal_sidang j where j.perkara_id=p.perkara_id)")]
tidak_runtut = [int(r[0]) for r in q("select distinct perkara_id from perkara_pihak5 where (perkara_id,saksi_pihak_ke) in (select perkara_id,saksi_pihak_ke from perkara_pihak5 group by 1,2 having min(urutan)<>1 or max(urutan)<>count(*) or count(distinct urutan)<>count(*))")]
khusus['saksi_tidak_runtut'] = random.sample(tidak_runtut, min(70, len(tidak_runtut)))
khusus['saksi_runtut'] = amb([int(r[0]) for r in q("select perkara_id from perkara_pihak5 group by perkara_id having count(*)>=2 and min(urutan)=1 and max(urutan)=count(*)")], 20)
khusus['kalender_ganda'] = [int(r[0]) for r in q("select perkara_id from perkara_court_calendar where rencana_agenda like '%musyawarah%' or rencana_agenda like '%putusan%' or rencana_agenda like '%penetapan%' group by perkara_id having count(distinct rencana_tanggal)>1")]
khusus['kalender_beda_putusan'] = [int(r[0]) for r in q("select c.perkara_id from (select perkara_id, max(rencana_tanggal) mx from perkara_court_calendar where rencana_agenda like '%musyawarah%' or rencana_agenda like '%putusan%' or rencana_agenda like '%penetapan%' group by perkara_id) c join perkara_putusan p on p.perkara_id=c.perkara_id where c.mx<>p.tanggal_putusan")]
khusus['belum_putus_kalender'] = amb([int(r[0]) for r in q("select distinct c.perkara_id from perkara_court_calendar c where (c.rencana_agenda like '%musyawarah%' or c.rencana_agenda like '%putusan%') and not exists (select 1 from perkara_putusan p where p.perkara_id=c.perkara_id)")], 8)
khusus['tanpa_kalender'] = amb([int(r[0]) for r in q("select perkara_id from perkara p where not exists (select 1 from perkara_court_calendar c where c.perkara_id=p.perkara_id)")], 8)

urut = []
for lst in [contoh, acak] + list(khusus.values()):
    for x in lst:
        if x and x not in urut:
            urut.append(x)
json.dump(dict(contoh=contoh, acak=acak, khusus=khusus, semua=urut), open(r'D:\Aplikasi\aleta\tmp\x2\sampel.json', 'w'))
print({k: len(v) for k, v in khusus.items()}, 'contoh', len(contoh), 'acak', len(acak), 'gabungan', len(urut))
