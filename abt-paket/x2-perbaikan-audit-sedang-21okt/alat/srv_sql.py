# jalankan SQL (SELECT saja) di server lewat lihat-jejak.sh; kembalikan teks keluaran. Menolak kata tulis.
import subprocess, base64, re, sys
def srv(sql, timeout=300):
    s = re.sub(r'(?m)^--.*$', '', sql)
    if re.search(r'\b(insert|update|delete|drop|alter|truncate|grant|create)\b|\breplace\s+into\b', re.sub(r"'[^']*'", "''", s), re.I):
        raise SystemExit('DITOLAK: kata tulis di luar literal')
    b = base64.b64encode(s.encode('latin1')).decode()
    r = subprocess.run(['ssh', 'aleta', 'bash /root/lihat-jejak.sh "$(base64 -d)"'], input=b.encode(), capture_output=True, timeout=timeout)
    return r.stdout.decode('utf-8', 'replace'), r.stderr.decode('utf-8', 'replace')
if __name__ == '__main__':
    o, e = srv(open(sys.argv[1], encoding='latin1').read())
    print(o.strip()[-2000:], e.strip()[-500:])
