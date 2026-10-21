import os, re, json, sys

akar = r'D:\Aplikasi\aleta\tmp\tuntutan24\rtf-server\derry_briantono'
# variabel yang MENCETAK keterangan saksi tersimpan
FUNGSI = {str(n) for n in range(9259, 9266)}
PHP_KET = {'2021', '2022', '2023', '2024', '2031', '2032', '8920', '8932', '8942'}
PHP_TABEL = {'5058', '5059', '5060', '6120', '6121', '6122', '6124', '8921', '8931', '8941', '5048', '5049', '6118', '6119', '6126', '6127', '6128', '6129', '6200', '6201', '6202', '6203', '6204', '6205'}
KUTIP = {str(n) for n in range(4610, 4619)} | {'4848', '4849', '4608', '4609'}
SEMUA = FUNGSI | PHP_KET | PHP_TABEL | KUTIP
hasil = {}
jumlah = 0
for dp, dn, fn in os.walk(akar):
    for f in fn:
        if not f.lower().endswith('.rtf'):
            continue
        jumlah += 1
        t = open(os.path.join(dp, f), 'rb').read().decode('latin1')
        # buang tujuan tersembunyi isianasal (salinan penanda, tidak tercetak)
        t2 = re.sub(r'\{\\\*\\isianasal[^}]*\}', '', t)
        ids = set(re.findall(r'#(\d{4})#', t2))
        # penanda yang terpecah format ("#92" + "59#") tidak terbaca di sini - dicatat terpisah
        ada = sorted(ids & SEMUA)
        if ada:
            hasil[os.path.relpath(os.path.join(dp, f), akar)] = ada
print('berkas', jumlah, 'memuat variabel saksi tercetak', len(hasil))
json.dump(hasil, open(r'D:\Aplikasi\aleta\tmp\w30\pindai_blangko.json', 'w', encoding='utf8'), ensure_ascii=False, indent=0)
# ringkas: kelompok per jenis variabel
kel = {'fungsi': 0, 'php_ket': 0, 'php_tabel': 0, 'kutip': 0}
berbahaya = []
for b, ada in hasil.items():
    s = set(ada)
    if s & FUNGSI: kel['fungsi'] += 1
    if s & PHP_KET: kel['php_ket'] += 1
    if s & PHP_TABEL: kel['php_tabel'] += 1
    if s & KUTIP: kel['kutip'] += 1
    if (s & PHP_KET) and not (s & FUNGSI):
        berbahaya.append(b)
print(kel)
print('berkas dengan variabel keterangan PHP TANPA fungsi SQL:', len(berbahaya))
for b in berbahaya[:60]:
    print('  ', b, hasil[b])
