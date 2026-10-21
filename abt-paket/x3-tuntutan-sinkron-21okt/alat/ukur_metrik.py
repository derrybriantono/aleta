import re, json, collections
rows={r['id']:r for r in json.load(open('ukur-cgct.json',encoding='utf-8'))}
srvf={}
L=open('ukur-server-regex.tsv',encoding='utf-8').read().split('\n')
kep=L[0].split('\t')
for l in L[1:]:
    if not l.strip(): continue
    f=l.split('\t'); srvf[f[0]]=dict(zip(kep[1:],map(int,f[1:])))
def polos(t):
    t=re.sub(r'<[^>]+>',' ',t); t=t.replace('&nbsp;',' ').replace('&#39;',"'")
    return re.sub(r'\s+',' ',t).lower()
AMAR={
 'th': r'hadh?anah|hadlanah|hak asuh|kuasa asuh|pemeliharaan(?: dan pengasuhan)? anak|pengasuhan anak|di bawah (?:asuhan|pemeliharaan)|dalam asuhan',
 'tn': r'nafkah[^;]{0,60}anak|biaya (?:hidup|pemeliharaan|pendidikan|kebutuhan)[^;]{0,60}anak|biaya hadh?anah',
 'ti': r"(?:^|[^a-z])'?(?:iddah|idah)(?:[^a-z]|$)", 'tm': r"(?:^|[^a-z])muth?\W{0,6}ah(?:[^a-z]|$)", 'td': r'madl?iy?ah|madhiy?ah|nafkah (?:lampau|yang lalu|terhutang|terutang)',
 'tb': r'harta bersama|gono.?gini'}
NAMA={'th':'hak asuh','tn':'nafkah anak','ti':'nafkah iddah','tm':"mut'ah",'td':'madliyah','tb':'harta bersama'}
# hasil tinjau manual kasus "terbaca tetapi tidak ada di amar" (D-): sungguh diminta? (dibaca satu per satu dari petitum)
def sebabA(am):
    if 'rekonvensi' in am: return 'rekonvensi lisan (tidak tercatat di SIPP)'
    if re.search(r'kesepakatan|perdamaian|mentaati|menaati|perjanjian',am): return 'kesepakatan mediasi'
    return 'ditetapkan majelis tanpa tuntutan tercatat (ex officio/perubahan gugatan)'
hasil={}
contoh=collections.defaultdict(list)
for versi,suf in (('lama','0'),('baru','1')):
  m=collections.defaultdict(collections.Counter)
  for pid,f in srvf.items():
    r=rows.get(pid)
    if not r: continue
    am=polos(r['amar'])
    for k in ['th','tn','ti','tm','td','tb']:
        d=f.get(k+suf, f.get(k))
        a=bool(re.search(AMAR[k],am))
        if d and a: m[k]['DA']+=1
        elif d and not a: m[k]['D-']+=1; contoh[(versi,k,'D-')].append(pid)
        elif a: m[k]['-A '+sebabA(am)]+=1; contoh[(versi,k,'-A')].append(pid)
        else: m[k]['--']+=1
  hasil[versi]={NAMA[k]:dict(v) for k,v in m.items()}
json.dump(hasil,open('metrik.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
for v in hasil: 
  print('==',v)
  for k,c in hasil[v].items(): print('  ',k,c)
for key in [('baru','ti','D-'),('baru','tm','D-'),('baru','td','D-'),('lama','ti','D-'),('lama','tm','D-'),('lama','td','D-')]:
  print(key, contoh[key])
