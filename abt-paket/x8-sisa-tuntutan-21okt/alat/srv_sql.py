# jalankan SQL (SELECT/SHOW/DESCRIBE saja) di server lewat lihat-jejak.sh; keluaran utuh ke stdout. Menolak kata tulis.
import subprocess, base64, re, sys
def srv(sql, timeout=600):
    s = re.sub(r'(?m)^--.*$', '', sql)
    if re.search(r'\b(insert|update|delete|drop|alter|truncate|grant|create|rename|load|call|set\s+global)\b|\breplace\s+into\b|\binto\s+outfile\b', re.sub(r"'[^']*'", "''", s), re.I):
        raise SystemExit('DITOLAK: kata tulis di luar literal')
    b = base64.b64encode(s.encode('latin1')).decode()
    r = subprocess.run(['ssh', 'aleta', 'bash /root/lihat-jejak.sh "$(base64 -d)"'], input=b.encode(), capture_output=True, timeout=timeout)
    return r.stdout.decode('latin1'), r.stderr.decode('utf-8', 'replace')
if __name__ == '__main__':
    o, e = srv(open(sys.argv[1], encoding='latin1').read())
    out = sys.argv[2] if len(sys.argv) > 2 else None
    if out:
        open(out, 'w', encoding='latin1', newline='').write(o)
        print('baris', o.count('\n'), e.strip()[-800:])
    else:
        sys.stdout.buffer.write(o.encode('latin1', 'replace')); print(e.strip()[-800:])
