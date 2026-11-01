import sys, time, subprocess
sys.path.insert(0,'D:/aleta-dev/wt/w164/abt-paket/tanya-jawab-format-1nov/alat'); sys.path.insert(0,'D:/aleta-dev/wt/w164/abt-paket/tanya-jawab-format-1nov/sumber')
import render164 as R
import kueri_5404
MYSQL = R.MYSQL
def set5404(sqltext=None, asli=False):
    if asli:
        d = open('D:/Aplikasi/aleta/tmp/w164/abt_variabel-5404-asli.sql', encoding='latin1').read()
        sql = d + "\nDELETE FROM abt_variabel WHERE no_var = 12120;"
    else:
        sql = "UPDATE abt_variabel SET sql_query = CONVERT(0x%s USING latin1) WHERE no_var = 5404; DELETE FROM abt_variabel WHERE no_var = 12120;" % sqltext.encode('latin1').hex()
    r = subprocess.run([MYSQL, '-h127.0.0.1', '-uroot', '--default-character-set=latin1', 'aps_badilag_w164d'], input=sql.encode('latin1'), capture_output=True)
    return r.stderr.decode()[:200]
tugas = {}
sampel = [(9382, 2), (9384, 3), (10101, 3), (9384, 2), (9339, 2), (10076, 3)]
for i in range(30):
    pid, sd = sampel[i % len(sampel)]
    tugas['w%d' % i] = (pid, 't5404.rtf', sd)
def jalankan(label):
    t = time.time()
    import io, contextlib
    b = io.StringIO()
    with contextlib.redirect_stdout(b):
        R.render('D:/r164t/_blangko_abt', label, list(tugas), 'D:/Aplikasi/aleta/tmp/w164/renderuji', tambahan=tugas)
    dt = time.time() - t
    ok = b.getvalue().count('OK ')
    return dt, ok
mode = sys.argv[1]
if mode == 'lama':
    print(set5404(asli=True)); print('lama', jalankan('lama'))
else:
    print(set5404(kueri_5404.kueri())); print('baru', jalankan('baru'))
