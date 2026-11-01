# -*- coding: utf-8 -*-
"""Beda teks polos antara dua keluaran render RTF (sebelum/sesudah). pakai: python beda_teks.py <folder> <kasus,kasus,...> [awalan lama] [awalan baru]"""
import difflib
import re
import sys


def polos(p):
    raw = open(p, 'rb').read().decode('latin1')
    raw = re.sub(r'\\u(\d+) ?\??', lambda m: chr(int(m.group(1))) if int(m.group(1)) < 65536 else '', raw)
    raw = re.sub(r"\\'([0-9a-f]{2})", lambda m: bytes([int(m.group(1), 16)]).decode('cp1252'), raw)
    t = re.sub(r'\\pard ', '\n', raw)
    t = re.sub(r'\\(par|row|cell)(?![a-z])', '\n', t)
    t = re.sub(r'\\[a-zA-Z]+-?\d* ?', '', t)
    t = re.sub(r'[{}]', '', t)
    return [re.sub(r'\s+', ' ', l).strip() for l in t.split('\n') if l.strip()]


if __name__ == '__main__':
    folder, kasus = sys.argv[1], sys.argv[2].split(',')
    lama = sys.argv[3] if len(sys.argv) > 3 else 'sebelum'
    baru = sys.argv[4] if len(sys.argv) > 4 else 'sesudah'
    for k in kasus:
        a = polos('%s/%s-%s.rtf' % (folder, lama, k))
        b = polos('%s/%s-%s.rtf' % (folder, baru, k))
        print('=====', k, len(a), len(b))
        for l in difflib.unified_diff(a, b, lineterm='', n=0):
            if l.startswith(('+', '-')) and not l.startswith(('+++', '---')):
                print(l[:460])
