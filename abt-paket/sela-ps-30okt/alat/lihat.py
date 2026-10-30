# Tampilkan teks polos blangko RTF (pakai: python lihat.py <berkas.rtf> ...)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rtf2txt import rtf_ke_teks
sys.stdout.reconfigure(encoding='utf-8')
for p in sys.argv[1:]:
    print('=====', os.path.basename(p))
    print(rtf_ke_teks(open(p, 'rb').read().decode('latin1')))
