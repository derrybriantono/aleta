import re, sys

berkas = sys.argv[1]
t = open(berkas, 'rb').read().decode('latin1')
kunci = sys.argv[2] if len(sys.argv) > 2 else 'kenal dengan Penggugat'
lebar = int(sys.argv[3]) if len(sys.argv) > 3 else 700


def bersih(s):
    return re.sub(r"\\(?:rtlch|ltrch|dbch|af\d+|hich|loch|f\d+|fcs\d|afs\d+|fs\d+|lang\d+|langnp\d+|langfe\d+|langfenp\d+|alang\d+)\b ?", '', s)


pos = [m.start() for m in re.finditer(re.escape(kunci), t)]
print('ditemukan di', pos)
for i in pos:
    print('-----', i)
    print(bersih(t[max(0, i - lebar):i + lebar]))
