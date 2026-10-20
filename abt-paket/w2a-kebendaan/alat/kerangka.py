# -*- coding: utf-8 -*-
"""Kerangka pembangun katalog Susun saksi (SAKSI-B). Hanya menghasilkan JSON di katalog/."""
import re, json, os, sys

POLA_PENANDA = re.compile(r'#(\d{4})#')
POLA_SLOT = re.compile(r'\{([^{}]*)\}')

# ---------------------------------------------------------------- kerangka kalimat
# @F@ = inti keterangan (klausa yang berdiri sendiri). Kerangka tidak memuat negasi, angka, penanda, atau "saya," (koma sesudah saya).
# Setiap jenis punya dua bank: s1 (saksi urutan ganjil) dan s2 (urutan genap) dengan kosakata yang sengaja berbeda
# supaya kalimat dengan inti yang sama tetap tidak nyaris kembar.
MELIHAT_LIHAT = {
    's1': [
        "saya melihat sendiri bahwa @F@",
        "saya menyaksikan langsung bahwa @F@",
        "@F@ dan hal itu saya lihat dengan mata kepala saya sendiri",
        "pada waktu itu saya berada di tempat kejadian dan melihat bahwa @F@",
        "yang saya lihat sendiri adalah bahwa @F@",
    ],
    's2': [
        "karena saya turut hadir maka saya terangkan bahwa @F@",
        "@F@ demikian yang tampak oleh saya waktu itu",
        "saya ada di lokasi pada saat itu dan mendapati bahwa @F@",
        "@F@ sebagaimana yang saya alami",
        "saya berada di sana ketika kejadian dan mengetahui bahwa @F@",
    ],
}
MELIHAT_TAHU = {
    's1': [
        "saya mengetahui sendiri bahwa @F@",
        "saya tahu betul bahwa @F@",
        "@F@ dan hal itu saya ketahui sendiri",
        "sebagai orang yang dekat dengan mereka saya mengetahui bahwa @F@",
    ],
    's2': [
        "yang saya ketahui secara langsung adalah bahwa @F@",
        "@F@ sebagaimana yang saya alami dalam pergaulan dengan mereka",
        "karena sering bersama mereka saya paham bahwa @F@",
        "saya paham dengan baik bahwa @F@",
    ],
}
MENDENGAR = {
    's1': [
        "saya mendengar sendiri bahwa @F@",
        "saya mendengar langsung bahwa @F@",
        "@F@ dan itu saya dengar sendiri pada waktu itu",
        "saat itu saya berada di dekat mereka dan mendengar bahwa @F@",
    ],
    's2': [
        "ucapan yang terdengar oleh saya waktu itu menyatakan bahwa @F@",
        "@F@ begitulah perkataan yang terdengar di hadapan saya",
        "di hadapan saya mereka mengatakan bahwa @F@",
        "para pihak berkata di depan saya bahwa @F@",
    ],
}
DE_AUDITU = {
    's1': [
        "{sumber} bercerita kepada saya bahwa @F@",
        "saya diberi tahu oleh {sumber} bahwa @F@",
        "@F@ begitulah cerita {sumber} kepada saya",
        "setahu saya berdasarkan cerita {sumber} bahwa @F@",
    ],
    's2': [
        "dari penuturan {sumber} yang sampai kepada saya diketahui bahwa @F@",
        "kabar dari {sumber} yang saya terima menyebutkan bahwa @F@",
        "@F@ demikian yang diceritakan {sumber} kepada saya",
        "yang saya ketahui berasal dari cerita {sumber} yaitu bahwa @F@",
    ],
}
SEBAGIAN = {
    's1': [
        "yang saya ketahui hanya sebagian saja yaitu bahwa @F@ sedangkan selebihnya kurang saya ketahui",
        "saya hanya tahu sebagian yaitu bahwa @F@ dan selebihnya kurang saya ketahui",
        "sebagian saja yang saya ketahui yakni bahwa @F@",
        "hanya sebatas itu yang saya ketahui yaitu bahwa @F@",
    ],
    's2': [
        "pengetahuan saya terbatas pada satu hal bahwa @F@ adapun selebihnya kurang jelas bagi saya",
        "sejauh yang saya tahu bahwa @F@ sedangkan sisanya kurang saya pahami",
        "bagian yang saya kuasai hanyalah bahwa @F@ dan lainnya kurang saya pahami",
        "yang bisa saya terangkan sebatas bahwa @F@ selebihnya kurang saya pahami",
    ],
}
BERBEDA = {
    's1': [
        "menurut yang saya ketahui sendiri bahwa @F@",
        "keterangan saya adalah bahwa @F@",
        "@F@ itulah yang saya ketahui",
        "yang saya terangkan di sini adalah bahwa @F@",
    ],
    's2': [
        "sepengetahuan saya bahwa @F@",
        "@F@ begitulah yang saya alami",
        "yang saya ingat dan saya sampaikan adalah bahwa @F@",
        "@F@ dan itulah keterangan saya",
    ],
}


def ex(teks, peta):
    """Mengganti <TOKEN> dengan nilainya."""
    def r(m):
        k = m.group(1)
        if k not in peta:
            raise KeyError("token tak dikenal <%s> dalam: %s" % (k, teks))
        return peta[k]
    return re.sub(r'<([A-Za-z0-9]+)>', r, teks)


def rapikan(t):
    t = t.lower()
    t = re.sub(r'[.,;:!?"\'()\-\u2013]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def buat_kalimat(frame, F):
    """Menyisipkan inti ke kerangka. Bila inti diikuti kata lain, beri koma; koma sesudah kata berakhiran -ya dibuang."""
    if '@F@ ' in frame:
        frame = frame.replace('@F@ ', '@F@, ')
    k = frame.replace('@F@', F).strip()
    if 'ya, ' in k.lower():
        k = re.sub(r'(ya),\s', r'\1 ', k, flags=re.I)
    return k


# ekor netral untuk kalimat yang berakhir titik-titik isian (kalimat jawaban tidak boleh berakhir tanda baca)
EKOR = ['menurut pengetahuan saya', 'seperti yang saya ketahui', 'sejauh yang saya tahu', 'sebagaimana yang saya terangkan']


NEG = re.compile(r"(?<![A-Za-z])(tidak|bukan|belum|tanpa|tak|tiada|nihil|jangan)(?![A-Za-z])", re.I)
DIBUANG = []


def seragamkan(cores, idq=""):
    """Mempertahankan inti yang jumlah kata negasinya sama (kelompok terbanyak; seri: yang paling sedikit negasinya).
    Inti yang dibuang dicatat di DIBUANG supaya dapat ditinjau."""
    if not cores or len(cores) < 2:
        return cores
    kel = {}
    for c in cores:
        kel.setdefault(len(NEG.findall(c)), []).append(c)
    if len(kel) == 1:
        return cores
    terbaik = sorted(kel.items(), key=lambda kv: (-len(kv[1]), kv[0]))[0][1]
    for c in cores:
        if c not in terbaik:
            DIBUANG.append((idq, c))
    return terbaik


def samakan_nama(cores):
    """Nama pewaris <W> (dua penanda: #2026# dan #1025#) harus muncul sama banyak di setiap inti satu daftar (aturan invarian mesin).
    Langkah: tiap inti hanya memuat satu <W> (yang lain menjadi kata 'pewaris'); bila daftar masih campur ada/tidak, semua <W> menjadi 'pewaris'."""
    if not cores or not any("<W>" in c for c in cores):
        return cores
    satu = []
    for c in cores:
        i = c.find("<W>")
        if i >= 0:
            c = c[: i + 3] + c[i + 3 :].replace("<W>", "pewaris")
        satu.append(c)
    ada = {("<W>" in c) for c in satu}
    if len(ada) > 1:
        satu = [c.replace("<W>", "pewaris") for c in satu]
    return satu


def sambung(frames, cores, banyak=4, offset=0):
    """Menyusun `banyak` kalimat: tiap kalimat memakai satu kerangka berbeda; inti diputar mulai dari `offset`."""
    hasil, dipakai = [], set()
    n = len(frames)
    ci = offset
    for fi in range(n):
        if len(hasil) >= banyak:
            break
        fr = frames[fi]
        for t in range(len(cores)):
            F = cores[(ci + t) % len(cores)]
            k = buat_kalimat(fr, F)
            if k.endswith('...'):
                k = k + ' ' + EKOR[(fi + ci + t) % len(EKOR)]
            if 'ya, ' in k.lower() or 'sayang' in k.lower() or k.endswith(('.', ',', ';')):
                continue
            if rapikan(k) in dipakai:
                continue
            hasil.append(k)
            dipakai.add(rapikan(k))
            ci = (ci + t + 1) % len(cores)
            break
    if len(hasil) < banyak:
        raise ValueError("kerangka tak cukup untuk %s" % cores)
    return hasil


def himpunan_kata(t):
    t = re.sub(r'#\d{4}#', ' penanda ', t)
    t = re.sub(r'\{[^{}]*\}', ' slot ', t)
    return set(rapikan(t).split(' ')) - {''}


def jaccard(a, b):
    A, B = himpunan_kata(a), himpunan_kata(b)
    if not A and not B:
        return 1.0
    return len(A & B) / len(A | B)


def maks_mirip(s1, s2):
    return max(jaccard(x, y) for x in s1 for y in s2)


def pasangan(bank, cores, banyak=4, gaya=None):
    """bank: dict s1/s2 atau (bank_lihat, bank_tahu) untuk gaya campur. Mengembalikan (saksi1, saksi2).
    Mencari putaran inti dan kerangka saksi2 yang paling tidak mirip dengan saksi1."""
    if isinstance(bank, tuple):
        lihat, tahu = bank
        if gaya == 'lihat':
            b1, b2 = lihat['s1'], lihat['s2']
        elif gaya == 'tahu':
            b1, b2 = tahu['s1'], tahu['s2']
        else:  # campur: bergantian
            b1 = [lihat['s1'][0], tahu['s1'][0], lihat['s1'][1], tahu['s1'][1], lihat['s1'][2], tahu['s1'][2]]
            b2 = [lihat['s2'][0], tahu['s2'][0], lihat['s2'][1], tahu['s2'][1], lihat['s2'][2], tahu['s2'][2]]
    else:
        b1, b2 = bank['s1'], bank['s2']
    s1 = sambung(b1, cores, banyak, 0)
    terbaik, skor = None, 9.0
    for rot in range(len(b2)):
        b2r = b2[rot:] + b2[:rot]
        for off in range(max(1, len(cores))):
            try:
                s2 = sambung(b2r, cores, banyak, off)
            except ValueError:
                continue
            m = maks_mirip(s1, s2)
            if m < skor:
                terbaik, skor = s2, m
            if m <= 0.7:
                return s1, s2
    return s1, terbaik


class Q:
    def __init__(self, id, pokok, urut, tingkat, kelompok, teks, hal, ringkas,
                 melihat=None, ex_melihat=None, de_auditu=None, mendengar=None, sebagian=None,
                 berbeda=None, tidak_tahu=None, ragu=None, teks_varian=None, pihak=("*",),
                 keadaan=None, tidak_berlaku=None, catatan="", gaya='campur', **ke_kw):
        self.id = id
        self.pokok = pokok
        self.urut = urut
        self.tingkat = tingkat
        self.kelompok = kelompok
        self.teks = teks
        self.hal = hal
        self.ringkas = ringkas
        self.melihat = melihat
        self.ex_melihat = ex_melihat
        self.de_auditu = de_auditu
        self.mendengar = mendengar
        self.sebagian = sebagian
        self.berbeda = berbeda
        self.tidak_tahu = tidak_tahu
        self.ragu = ragu
        self.teks_varian = teks_varian
        self.pihak = pihak
        self.keadaan = keadaan
        self.tidak_berlaku = tidak_berlaku
        self.catatan = catatan
        self.gaya = gaya
        self.ke_kw = ke_kw


def maksud(jenis, ringkas):
    return {
        'melihat': "saksi menerangkan %s sebagai hal yang dilihat atau dialaminya sendiri" % ringkas,
        'mendengar': "saksi menerangkan %s sebagai hal yang didengarnya sendiri dari pihak atau peristiwa itu" % ringkas,
        'de-auditu': "saksi menerangkan %s hanya dari cerita orang lain, bukan yang disaksikannya sendiri" % ringkas,
        'sebagian': "saksi hanya mengetahui sebagian dari %s" % ringkas,
        'tidak-tahu': "saksi tidak mengetahui %s" % ringkas,
        'ragu': "saksi ragu atau kurang yakin tentang %s" % ringkas,
    }[jenis]


def jawab_obj(jenis, ringkas, s1, s2, keadaan=None, beda_pada=None, maks=None):
    o = {}
    if keadaan:
        o['keadaan'] = keadaan
    o['maksud'] = maks or maksud(jenis, ringkas)
    if beda_pada:
        o['bedaPada'] = beda_pada
    o['saksi1'] = s1
    o['saksi2'] = s2
    return o


def pilih(sumber, peta):
    """Sumber boleh daftar biasa atau dict {kelompok: daftar}."""
    if isinstance(sumber, dict):
        return sumber[peta['_g']]
    return sumber


def bangun_q(q, peta, extra_keadaan=None):
    """Menghasilkan dict pertanyaan skema dari objek Q + peta token."""
    tk = lambda t: ex(t, peta)
    for nama in ('melihat', 'sebagian', 'mendengar', 'de_auditu'):
        v = getattr(q, nama)
        if isinstance(v, list):
            setattr(q, nama, seragamkan(samakan_nama(v), q.id))
    if q.berbeda and 'A' in q.berbeda:
        q.berbeda = dict(q.berbeda, A=seragamkan(samakan_nama(q.berbeda['A']), q.id), B=seragamkan(samakan_nama(q.berbeda['B']), q.id))
    d = {
        'id': q.id, 'pokok': q.pokok, 'urutan': q.urut, 'tingkat': q.tingkat, 'kelompok': q.kelompok,
        'pihakSaksi': list(q.pihak),
    }
    ke = dict(extra_keadaan or {})
    if q.keadaan:
        ke.update(q.keadaan)
    if ke:
        d['keadaan'] = ke
    d['teks'] = tk(q.teks)
    if q.teks_varian:
        d['teksVarian'] = [tk(x) for x in q.teks_varian]
    d['hal'] = tk(q.hal)
    tb = list(q.tidak_berlaku or [])
    d['tidakBerlaku'] = tb
    jaw = {}
    r = tk(q.ringkas)
    inti = lambda lst: [tk(c) for c in lst]
    if q.ex_melihat:
        s1, s2 = pilih(q.ex_melihat, peta)
        jaw['melihat'] = jawab_obj('melihat', r, [tk(x) for x in s1], [tk(x) for x in s2])
    else:
        s1, s2 = pasangan((MELIHAT_LIHAT, MELIHAT_TAHU), inti(pilih(q.melihat, peta)), 4, q.gaya)
        jaw['melihat'] = jawab_obj('melihat', r, s1, s2)
    de_aud = q.de_auditu
    if de_aud is None and not q.ex_melihat:
        de_aud = q.melihat  # bawaan: fakta yang sama, hanya sumber pengetahuannya yang berbeda
    if de_aud is False:
        de_aud = None
    for jenis, kerangka, sumber in (('de-auditu', DE_AUDITU, de_aud), ('mendengar', MENDENGAR, q.mendengar), ('sebagian', SEBAGIAN, q.sebagian)):
        if sumber is None or jenis in tb:
            continue
        sumber = pilih(sumber, peta)
        if isinstance(sumber, tuple):
            jaw[jenis] = jawab_obj(jenis, r, [tk(x) for x in sumber[0]], [tk(x) for x in sumber[1]])
            continue
        s1, s2 = pasangan(kerangka, inti(sumber))
        jaw[jenis] = jawab_obj(jenis, r, s1, s2)
    for jenis, sumber in (('tidak-tahu', q.tidak_tahu), ('ragu', q.ragu)):
        if sumber is None or jenis in tb:
            continue
        sumber = pilih(sumber, peta)
        jaw[jenis] = jawab_obj(jenis, r, [tk(x) for x in sumber[0]], [tk(x) for x in sumber[1]])
    if q.berbeda and 'berbeda' not in tb:
        bd = q.berbeda
        if 'A' not in bd:
            bd = bd[peta['_g']]
        A = inti(bd['A'])
        B = inti(bd['B'])
        s1 = sambung(BERBEDA['s1'], A, 4, 0)
        s2 = sambung(BERBEDA['s2'], B, 4, 0)
        jaw['berbeda'] = jawab_obj('berbeda', r, s1, s2, beda_pada=bd['pada'], maks=tk(bd['maksud']))
    elif 'berbeda' not in tb and q.kelompok not in ('identitas', 'hubungan', 'penutup'):
        raise ValueError("%s: berbeda belum ditulis" % q.id)
    d['jawaban'] = jaw
    kode = set()
    semua = [d['teks']] + d.get('teksVarian', [])
    for jn, ob in jaw.items():
        semua += ob['saksi1'] + ob['saksi2']
    for t in semua:
        for m in POLA_PENANDA.finditer(t):
            kode.add(m.group(1))
    d['variabelAbt'] = sorted(kode)
    if q.catatan:
        d['catatan'] = q.catatan
    return d


# ---------------------------------------------------------------- jawaban umum (dipakai semua berkas)
JAWABAN_UMUM = {
    'mendengar': {
        'maksud': 'saksi mendengar sendiri hal itu dari pihak atau peristiwa yang dialaminya',
        'saksi1': [
            'mengenai {hal} saya mendengar sendiri pembicaraan para pihak',
            'saya mendengar langsung ucapan para pihak tentang {hal}',
            'tentang {hal} saya mendengarnya sendiri dari mulut para pihak',
            'soal {hal} saya ikut mendengar ketika para pihak membicarakannya',
        ],
        'saksi2': [
            'yang saya dengar sendiri dari para pihak adalah hal-hal mengenai {hal}',
            'saya sendiri yang mendengar para pihak berbicara tentang {hal}',
            '{hal} itu saya dengar secara langsung ketika para pihak mengucapkannya',
            'pada waktu itu telinga saya sendiri yang mendengar pembicaraan mengenai {hal}',
        ],
    },
    'de-auditu': {
        'maksud': 'saksi mengetahui hal itu hanya dari cerita orang lain dan tidak menyaksikannya sendiri',
        'saksi1': [
            'mengenai {hal} saya diceritakan oleh {sumber}',
            'saya mengetahui {hal} dari cerita {sumber}',
            'kabar tentang {hal} saya peroleh dari {sumber}',
            '{sumber} yang bercerita kepada saya tentang {hal}',
        ],
        'saksi2': [
            'tentang {hal} yang saya ketahui adalah penuturan dari {sumber}',
            'saya diberi tahu oleh {sumber} soal {hal}',
            'soal {hal} saya dengar dari cerita {sumber}',
            'menurut {sumber} yang bercerita kepada saya mengenai {hal} begitulah keadaannya',
        ],
    },
    'sebagian': {
        'maksud': 'saksi hanya mengetahui sebagian dari hal yang ditanyakan',
        'saksi1': [
            'mengenai {hal} saya hanya mengetahui sebagian saja',
            'tentang {hal} yang saya ketahui baru sebagian dan selebihnya kurang saya ketahui',
            'sebagian dari {hal} saya ketahui sedangkan selebihnya kurang jelas bagi saya',
            'soal {hal} saya hanya tahu sebagiannya',
        ],
        'saksi2': [
            'saya hanya sebatas mengetahui sebagian dari {hal}',
            '{hal} hanya sebagian yang sampai kepada saya dan selebihnya kurang saya ketahui',
            'selebihnya kurang saya ketahui karena baru sebagian dari {hal} yang saya ketahui',
            'pengetahuan saya tentang {hal} baru sebagian saja',
        ],
    },
    'tidak-tahu': {
        'maksud': 'saksi tidak mengetahui hal yang ditanyakan',
        'saksi1': [
            'saya tidak mengetahui {hal}',
            'mengenai {hal} saya tidak tahu apa-apa',
            'saya tidak tahu tentang {hal}',
            '{hal} itu tidak saya ketahui',
        ],
        'saksi2': [
            'terus terang saya tidak mengetahui {hal}',
            'tentang {hal} saya tidak tahu sama sekali',
            'keterangan mengenai {hal} tidak ada yang saya ketahui',
            '{hal} bukan sesuatu yang saya ketahui',
        ],
    },
    'ragu': {
        'maksud': 'saksi ragu, lupa, atau kurang yakin tentang hal yang ditanyakan',
        'saksi1': [
            'saya ragu mengenai {hal}',
            'tentang {hal} saya kurang yakin',
            'saya lupa bagaimana tepatnya {hal}',
            'soal {hal} ingatan saya kurang jelas',
        ],
        'saksi2': [
            'mengenai {hal} saya kurang ingat',
            'saya mungkin keliru soal {hal} karena ingatan saya sudah kurang pasti',
            'rasanya begitu tentang {hal} tetapi saya kurang yakin',
            'entah bagaimana tepatnya {hal} saya sendiri ragu',
        ],
    },
}


def umum_lama():
    """Memakai jawaban umum baku dari SAKSI-A bila ada; cadangan: milik sendiri."""
    return json.loads(json.dumps(JAWABAN_UMUM, ensure_ascii=False))


def periksa(berkas):
    import subprocess
    r = subprocess.run(['node', 'D:/aleta-dev/kerja/saksi/periksa.mjs', berkas], capture_output=True)
    return r.stdout.decode('utf-8', 'replace') + r.stderr.decode('utf-8', 'replace')


def tulis(kat, nama, folder='D:/aleta-dev/kerja/saksi/katalog'):
    p = os.path.join(folder, nama + '.json')
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(kat, f, ensure_ascii=False, indent=1)
    return p
