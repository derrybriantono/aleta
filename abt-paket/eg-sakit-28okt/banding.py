# Susun satu berkas SQL per (variabel, lama/baru) berisi kueri untuk semua perkara, diberi penanda; jalankan di server, bandingkan.
import io, os, subprocess, sys
D = os.path.dirname(os.path.abspath(__file__))
jenis = dict(l.split("\t") for l in io.open(os.path.join(D, "jenis.txt"), encoding="utf-8").read().split("\n") if l.strip())
ganti0 = {"#8554#": "Majelis Hakim", "#8008#": "Pengadilan Agama Donggala", "#6000#": "", "#6001#": "", "#0227#": "", "#8536#": ""}

def susun(q, pid, j):
    P, T, G = ("Pemohon", "Termohon", "permohonan") if j == "ct" else ("Penggugat", "Tergugat", "gugatan")
    s = q.replace("#perkara_id#", pid).replace("#0046#", P).replace("#0047#", T).replace("#0053#", G)
    for a, b in ganti0.items():
        s = s.replace(a, b)
    return s.rstrip().rstrip(";") + ";"

def jalan(v, versi):
    if versi == "lama":
        q = bytes.fromhex(io.open(os.path.join(D, f"h{v}.txt")).read().split()[0]).decode("latin1")
    else:
        q = io.open(os.path.join(D, f"baru{v}.sql"), "rb").read().decode("latin1")
    sql = "".join(f"SELECT '@@{pid}';\n{susun(q, pid, j.strip())}\n" for pid, j in jenis.items())
    p = subprocess.run(["ssh", "aleta", 'MYSQL_PWD="$(docker exec aleta-bot printenv ALETA_BOT_DB_SIPP_PASSWORD)" mysql -h 127.0.0.1 -u root SIPP -N --raw --force'],
                       input=sql.encode("latin1"), capture_output=True)
    out = p.stdout.decode("utf-8", "replace")
    hasil, cur = {}, None
    for l in out.split("\n"):
        if l.startswith("@@"):
            cur = l[2:]; hasil[cur] = []
        elif cur:
            hasil[cur].append(l)
    return hasil, p.stderr.decode("utf-8", "replace")

for v in sys.argv[1:]:
    a, ea = jalan(v, "lama")
    b, eb = jalan(v, "baru")
    beda = [p for p in jenis if a.get(p) != b.get(p)]
    print(f"== {v}: perkara {len(jenis)}, beda {len(beda)}, galat lama {ea.count('ERROR')}, galat baru {eb.count('ERROR')}")
    if eb.strip(): print("   ", eb.strip()[:300])
    for p in beda[:6]:
        la, lb = a.get(p, []), b.get(p, [])
        for x, y in zip(la + [""] * 9, lb + [""] * 9):
            if x != y:
                print(f"   {p} LAMA: {x[:300]}\n   {p} BARU: {y[:300]}")
                break
