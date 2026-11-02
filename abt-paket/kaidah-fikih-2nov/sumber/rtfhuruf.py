import re


def grup_akhir(raw, i):
    d = 0
    j = i
    while j < len(raw):
        c = raw[j]
        if c == '\\':
            j += 2
            continue
        if c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d == 0:
                return j
        j += 1
    return -1


def tabel_huruf(raw):
    i = raw.find('{\\fonttbl')
    j = grup_akhir(raw, i)
    ft = raw[i + 1:j]
    out = {}
    k = 0
    while True:
        a = ft.find('{', k)
        if a < 0:
            break
        b = grup_akhir(ft, a)
        g = ft[a + 1:b]
        m = re.match(r'\\f(\d+)', g)
        if m:
            s = g
            while True:
                x = s.find('{')
                if x < 0:
                    break
                y = grup_akhir(s, x)
                s = s[:x] + s[y + 1:]
            s = re.sub(r'\\[a-z]+-?\d* ?', '', s)
            out[int(m.group(1))] = s.split(';')[0].strip()
        k = b + 1
    return out
