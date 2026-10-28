"""Ubah RTF menjadi teks polos kasar (cukup untuk dibaca dan dicari #variabel#).
Pakai: python rtf2txt.py masuk.rtf [keluar.txt]"""
import re, sys

def rtf_ke_teks(data: str) -> str:
    out = []
    i = 0
    n = len(data)
    stack = []
    skip = False
    lewati_tujuan = {'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer',
                     'headerl', 'headerr', 'footerl', 'footerr', 'listtable', 'listoverridetable',
                     'rsidtbl', 'xmlnstbl', 'mmathPr', 'themedata', 'colorschememapping',
                     'datastore', 'latentstyles', 'generator', 'pgdsctbl', 'fldinst', 'object', 'shp',
                     'shppict', 'nonshppict', 'bkmkstart', 'bkmkend', 'wgrffmtfilter', 'filetbl'}
    ucskip = 1
    while i < n:
        c = data[i]
        if c == '{':
            stack.append((skip, ucskip)); i += 1; continue
        if c == '}':
            if stack:
                skip, ucskip = stack.pop()
            i += 1; continue
        if c == '\\':
            i += 1
            if i >= n: break
            c2 = data[i]
            if c2 in '\\{}':
                if not skip: out.append(c2)
                i += 1; continue
            if c2 == "'":
                hx = data[i+1:i+3]
                if not skip:
                    try: out.append(bytes([int(hx, 16)]).decode('cp1252'))
                    except Exception: pass
                i += 3; continue
            if c2 == '*':
                skip = True; i += 1; continue
            if c2 == '~':
                if not skip: out.append(' ')
                i += 1; continue
            if c2 in '-_':
                i += 1; continue
            m = re.match(r'([a-zA-Z]+)(-?\d+)? ?', data[i:])
            if m:
                w = m.group(1); arg = m.group(2)
                i += m.end()
                if w in lewati_tujuan:
                    skip = True
                elif not skip:
                    if w in ('par', 'line', 'sect', 'page', 'row'):
                        out.append('\n')
                    elif w == 'tab' or w == 'cell':
                        out.append('\t')
                    elif w == 'u' and arg:
                        v = int(arg)
                        if v < 0: v += 65536
                        out.append(chr(v))
                        i += ucskip  # lewati karakter pengganti
                    elif w == 'uc' and arg:
                        ucskip = int(arg)
                continue
            i += 1; continue
        if c in '\r\n':
            i += 1; continue
        if not skip:
            out.append(c)
        i += 1
    return ''.join(out)

if __name__ == '__main__':
    raw = open(sys.argv[1], 'rb').read().decode('latin1')
    t = rtf_ke_teks(raw)
    t = re.sub(r'\n{3,}', '\n\n', t)
    if len(sys.argv) > 2:
        open(sys.argv[2], 'w', encoding='utf-8').write(t)
    else:
        sys.stdout.reconfigure(encoding='utf-8')
        print(t)
