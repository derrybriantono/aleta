import subprocess,re,sys
sys.path.insert(0,'D:/aleta-dev/wt/integrasi21/abt-paket/x1-perbaikan-audit-21okt/sumber')
import variabel_def as V
M=r'D:\Satker Asal\Website PA Bungku\xampp\mysql\bin\mysql.exe'
def run(no,ids):
    sql=[d for d in V.BARU if d['no']==no][0]['sql']
    res={}
    for i in range(0,len(ids),25):
        parts=["SELECT %s AS pid, (%s) AS nama"%(pid,sql.replace('#perkara_id#',pid)) for pid in ids[i:i+25]]
        out=subprocess.run([M,'-uroot','sipp_donggala','-N','--default-character-set=utf8'],input=' UNION ALL '.join(parts).encode('utf-8'),capture_output=True)
        assert out.returncode==0,out.stderr.decode()[:300]
        for l in out.stdout.decode('utf-8','replace').splitlines():
            a=l.split('\t'); res[a[0]]=a[1] if len(a)>1 else ''
    return res
def q(s): return subprocess.run([M,'-uroot','sipp_donggala','-N','-e',s],capture_output=True).stdout.decode().split()
ids=q("select perkara_id from perkara where jenis_perkara_id in (360,347) and posita like '%menikahkan%'")
r=run(10113,ids); isi={k:v for k,v in r.items() if v and v!='NULL'}
print('10113 terbaca',len(isi),'dari',len(r),'; ada U+FFFD',sum('\ufffd' in v for v in isi.values()),'; spasi ganda',sum('  ' in v for v in isi.values()))
dk=q("select perkara_id from perkara where jenis_perkara_id=362")
r=run(5510,dk)
n_none=sum(1 for v in r.values() if not v or v=='NULL'); n_dua=sum(1 for v in r.values() if ' dan ' in v)
print('5510 DK',len(r),'kosong',n_none,'satu nama',len(r)-n_none-n_dua,'dua nama',n_dua)
