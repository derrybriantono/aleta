# -*- coding: utf-8 -*-
"""Daftar jenis yang dibangun paket w3b-blangko-baru-kuasa-wali: nomor menu ABT, nomor ALUR BAS, folder, hak menu.

Nomor menu 240-253 dan ALUR BAS 60-66 dipilih di luar yang dipakai paket lain di repo (menu s.d. 185 + 800, ALUR s.d. 49) dan dijaga oleh PRASYARAT
paket (id menu / folder yang bertabrakan = galat, tidak ada yang dipasang). Sesi utama: bila agen gelombang 2/3 lain memakai angka yang sama, ubah di sini
(satu tempat) lalu jalankan ulang bangun_semua.py.
"""

# hak menu (sama dengan semua menu Derry): kolom abt_menu.user_grup_id / user_top_id / user_validator
HAK_PUTUSAN = dict(user_cek=3, user_grup_id='1|10|20', user_top_id='1', user_validator=None)
HAK_BAS = dict(user_cek=3, user_grup_id='1|30|500|430|1000|1010|1020', user_top_id='1|30', user_validator='10|20')

TANGGAL_MENU = '2026-10-21 00:00:00'

JENIS = {
    '353': dict(modul='spek_353', variabel='variabel_353', alur=60, nama_pendek='Pencabutan Kuasa Asuh',
                menu_putusan=240, menu_bas=241, jenis=(353, 353), ref='jenis_perkara_id', proses=(80, 297),
                nama_menu='Pencabutan Kekuasaan Orang Tua', alias='Pencabutan Kuasa Orang Tua'),
    '355': dict(modul='spek_355', variabel='variabel_355', alur=61, nama_pendek='Pencabutan Perwalian',
                menu_putusan=242, menu_bas=243, jenis=(355, 355), ref='jenis_perkara_id', proses=(80, 297),
                nama_menu='Pencabutan Kekuasaan Wali', alias='Pencabutan Kuasa Wali'),
    '356': dict(modul='spek_356', variabel='variabel_356', alur=62, nama_pendek='Penunjukan Wali',
                menu_putusan=244, menu_bas=245, jenis=(356, 356), ref='jenis_perkara_id', proses=(80, 297),
                nama_menu='Penunjukan Wali oleh Pengadilan', alias='Penunjukan Wali'),
    '357': dict(modul='spek_357', variabel='variabel_357', alur=63, nama_pendek='Ganti Rugi Wali',
                menu_putusan=246, menu_bas=247, jenis=(357, 357), ref='jenis_perkara_id', proses=(80, 297),
                nama_menu='Ganti Rugi terhadap Wali', alias='Ganti Rugi Wali'),
    '350': dict(modul='spek_350', variabel='variabel_350', alur=64, nama_pendek='Nafkah Anak Ibu',
                menu_putusan=248, menu_bas=249, jenis=(350, 350), ref='jenis_perkara_id', proses=(80, 297),
                nama_menu='Nafkah Anak oleh Ibu karena Ayah Tidak Mampu', alias='Nafkah Anak Ibu'),
    'eksekusi': dict(modul='spek_eksekusi', variabel='variabel_eksekusi', alur=65, nama_pendek='Eksekusi',
                     menu_putusan=250, menu_bas=251, jenis=(15, 16), ref='alur_perkara_id', proses=(600, 645),
                     nama_menu='Eksekusi', alias='Eksekusi'),
    'verzet': dict(modul='spek_verzet', variabel='variabel_verzet', alur=66, nama_pendek='Verzet',
                   menu_putusan=252, menu_bas=253, jenis=(15, 15), ref='alur_perkara_id', proses=(240, 280),
                   nama_menu='Verzet (Perlawanan atas Putusan Verstek)', alias='Verzet'),
}
# folder: '<nomor> <nama>' disimpan di spek (SPEK['folder']); folder BAS = folder + ' - BAS'


def menu_baris(kunci, spek_folder):
    """Dua baris abt_menu (putusan, BAS) untuk jenis `kunci`."""
    J = JENIS[kunci]
    putusan = dict(id=J['menu_putusan'], nama='Putusan ' + J['nama_menu'], nama_alias=J['alias'] + ' - Putusan', direktori=spek_folder,
                   parent_direktori='derry_briantono', proses_id_min=J['proses'][0], proses_id_max=J['proses'][1],
                   perkara_id_min=J['jenis'][0], perkara_id_max=J['jenis'][1], perkara_id_referensi=J['ref'], modified=TANGGAL_MENU)
    putusan.update(HAK_PUTUSAN)
    bas = dict(id=J['menu_bas'], nama=J['nama_menu'] + ' - BAS', nama_alias=J['alias'] + ' - BAS', direktori=spek_folder + ' - BAS',
               parent_direktori='derry_briantono', proses_id_min=J['proses'][0], proses_id_max=J['proses'][1],
               perkara_id_min=J['jenis'][0], perkara_id_max=J['jenis'][1], perkara_id_referensi=J['ref'], modified=TANGGAL_MENU)
    bas.update(HAK_BAS)
    return putusan, bas
