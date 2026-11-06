import os,re,subprocess
MY=r'D:\satker asal\website pa bungku\xampp\mysql\bin\mysql.exe'
out=subprocess.run([MY,'-h127.0.0.1','-uroot','-N','aps_badilag_w223','-e','select cast(no_var as char) from abt_variabel'],capture_output=True).stdout.decode().split()
ada=set(out); ada|={str(int(x)) for x in out}
AK='D:/Aplikasi/aleta/tmp/w223/gabung/derry_briantono'
tak={}
for f in os.listdir(AK):
    for b in os.listdir(os.path.join(AK,f)):
        if not b.endswith('.rtf'): continue
        d=open(os.path.join(AK,f,b),'rb').read()
        for m in re.finditer(rb'#(\d{3,5})#',d):
            k=m.group(1).decode()
            if k not in ada and k.lstrip('0') not in ada:
                tak.setdefault(k,set()).add(f+'/'+b)
print({k:len(v) for k,v in tak.items()})
