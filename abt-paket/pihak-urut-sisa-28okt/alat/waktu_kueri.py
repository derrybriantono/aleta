# -*- coding: utf-8 -*-
"""Waktu kueri tiap variabel yang diubah paket pihak-urut-sisa-28okt, basis lama (aps_badilag_ps0) lawan baru (aps_badilag_ps1), atas satu perkara.
pakai: python waktu_kueri.py <perkara_id> [no,no,...]   (baca saja; tiap kueri dibatasi 40 dtk)"""
import os,subprocess,re,sys,time
MYSQL=r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
nomor=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','paket-satker','nomor-ubah.txt')).read().strip().split(',')
pid=sys.argv[1]
def q(db,sql,timeout=60):
    t=time.time()
    r=subprocess.run([MYSQL,'-uroot','--default-character-set=latin1','-N','--force',db,'-e',sql],capture_output=True,timeout=timeout)
    return r.stdout.decode('latin1'),r.stderr.decode('latin1'),time.time()-t
def ambil(db,no):
    o,e,_=q(db,"SELECT HEX(sql_query) FROM abt_variabel WHERE no_var=%s"%no)
    return bytes.fromhex(o.strip()).decode('latin1')
def siap(s,db):
    s=re.sub(r"'#perkara_id#'|#perkara_id#",'@pid',s)
    s=re.sub(r'#\d{1,5}#','0',s)
    s=s.replace('aps_badilag.',db+'.')
    s=s.encode('ascii','replace').decode('ascii').strip().rstrip(';')
    return s
hasil={}
pilih=sys.argv[2].split(',') if len(sys.argv)>2 else nomor
for no in pilih:
    row=[no]
    for db in ('aps_badilag_ps0','aps_badilag_ps1'):
        s=siap(ambil(db,no),db)
        sql="SET @pid=%s; SET STATEMENT max_statement_time=40 FOR SELECT COUNT(*), MD5(GROUP_CONCAT(data)) FROM (%s) AS u"%(pid,s)
        o,e,t=q('sipp_donggala',sql)
        row.append('%.2fs %s %s'%(t,o.strip().replace('\t','/'),('ERR '+e.strip()[:80]) if e.strip() else ''))
    print(' | '.join(row),flush=True)
