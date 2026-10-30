# -*- coding: utf-8 -*-
"""TABEL PADANAN RBg <-> HIR (G6 6.1, 30 Okt 2026) - SATU sumber untuk pembangun paket, laporan, dan uji.

Dicocokkan ISI PASAL demi pasal (bukan hanya nomor) atas dua naskah yang dapat dibuka:
  RBg  = terjemahan "Reglemen Acara Hukum untuk Daerah Luar Jawa dan Madura" (S. 1927-227) bab acara perdata tingkat pertama
         Pasal 142-314, dengan catatan rujukan "IR." (= HIR) di akhir tiap pasal - salinan berandahukum.com/a/RBg-Lengkap dan
         awambicara.id/p/rbg.html (teks sama; naskah ini TIDAK memuat Pasal 315 dst., termasuk Pasal 718);
  HIR  = "Herzien Inlandsch Reglement (H.I.R) / Reglemen Indonesia yang Diperbaharui (R.I.B.)" (S. 1941-44) beserta penjelasan,
         JDIH Pengadilan Negeri Bengkalis (jdihpn.pn-bengkalis.go.id, data kolonial). Pasal 188-194 HIR (banding) TIDAK ADA di
         naskah itu: untuk Jawa dan Madura banding diatur Undang-Undang Nomor 20 Tahun 1947.
Ayat: HIR terjemahan ini sering TIDAK menomori ayat. Padanan ayat dinyatakan PASTI hanya bila (a) ayat HIR bernomor di naskah dan
isinya sama, atau (b) paragraf HIR berurutan satu lawan satu dengan ayat RBg (jumlah dan isi sama). Selain itu ayat 'belum pasti'.

PASAL[rbg] = dict(hir=<nomor HIR>|None, status='pasti'|'belum pasti'|'tidak berpadanan', ayat={ayat_rbg: ayat_hir ('' = HIR tanpa ayat)},
                  pokok=<isi singkat>, catatan=<dasar/keraguan>)
Ayat yang TIDAK ada di `ayat` = belum pasti untuk bentuk rujukan berayat itu (rujukan tetap RBg).
"""

PASAL = {
    '142': dict(hir='118', status='pasti', ayat={'1': '1', '2': '2', '3': '3', '4': '4', '5': '3'}, pokok='kewenangan relatif / tempat mengajukan gugatan',
                catatan='HIR 118 bernomor (1)-(4); benda tetap = RBg (5) = bagian akhir HIR (3) (naskah HIR: "barang gelap", salah ketik "barang tetap")'),
    '143': dict(hir='119', status='pasti', ayat={}, pokok='nasihat ketua kepada penggugat', catatan='catatan IR. 119'),
    '144': dict(hir='120', status='pasti', ayat={'1': ''}, pokok='gugatan lisan (buta huruf)',
                catatan='HIR 120 satu paragraf = RBg 144 (1); RBg 144 (2) (kuasa tidak boleh lisan) tidak ada di HIR'),
    '145': dict(hir='121', status='pasti', ayat={'1': '1', '2': '2', '3': '3', '4': '4'}, pokok='penetapan hari sidang, panggilan, panjar',
                catatan='empat paragraf HIR 121 = RBg 145 (1)-(4) satu lawan satu; catatan IR. 121'),
    '146': dict(hir='122', status='pasti', ayat={}, pokok='tenggang panggilan dan hari sidang', catatan='catatan IR. 122'),
    '147': dict(hir='123', status='pasti', ayat={'1': '1', '2': '2', '4': '3'}, pokok='kuasa / wakil para pihak',
                catatan='HIR 123 bernomor (1)-(3); RBg 147 (3) (bentuk surat kuasa) tidak ada di HIR; RBg (4) = HIR (3)'),
    '148': dict(hir='124', status='pasti', ayat={}, pokok='penggugat tidak hadir - gugur', catatan='catatan IR. 124'),
    '149': dict(hir='125', status='pasti', ayat={'1': '1', '2': '2', '3': '3', '4': '4'}, pokok='verstek',
                catatan='empat paragraf HIR 125 = RBg 149 (1)-(4); catatan IR. 125'),
    '150': dict(hir='126', status='pasti', ayat={}, pokok='panggilan sekali lagi', catatan='catatan IR. 126'),
    '153': dict(hir='129', status='pasti', ayat={'1': '1', '2': '2'}, pokok='perlawanan (verzet)',
                catatan='RBg 153 (3) (perpanjangan tenggang, S. 1939-715) tidak ada di HIR 129; maka RBg (4)-(6) bergeser - ayat HIR 129 tidak bernomor di naskah: (4)-(6) belum pasti'),
    '154': dict(hir='130', status='pasti', ayat={'1': '1', '2': '2', '3': '3', '4': '4'}, pokok='upaya damai oleh hakim',
                catatan='empat paragraf HIR 130 = RBg 154 (1)-(4); catatan Rv. 31; IR. 130'),
    '157': dict(hir='132a', status='pasti', ayat={}, pokok='gugatan rekonvensi (hak tergugat)', catatan='catatan IR. 132a'),
    '158': dict(hir='132b', status='pasti', ayat={'1': '1', '2': '2', '3': '3', '4': '4', '5': '5'}, pokok='rekonvensi diajukan bersama jawaban',
                catatan='HIR 132b bernomor (1)-(5), isi sama; catatan IR. 132b'),
    '159': dict(hir='133', status='pasti', ayat={}, pokok='eksepsi kewenangan relatif', catatan='catatan IR. 133'),
    '160': dict(hir='134', status='pasti', ayat={}, pokok='eksepsi kewenangan absolut', catatan='catatan IR. 134'),
    '162': dict(hir='136', status='pasti', ayat={}, pokok='eksepsi lain diputus bersama pokok perkara', catatan='catatan IR. 136'),
    '171': dict(hir='144', status='pasti', ayat={}, pokok='pemeriksaan saksi satu per satu, identitas saksi', catatan='catatan IR. 144'),
    '172': dict(hir='145', status='pasti', ayat={'1': '1', '2': '2', '3': '3'}, pokok='saksi yang tidak boleh didengar',
                catatan='paragraf HIR 145 berurutan sama dengan RBg 172 (1)-(3); catatan IR. 145'),
    '175': dict(hir='147', status='pasti', ayat={}, pokok='sumpah saksi', catatan='catatan IR. 147'),
    '180': dict(hir='153', status='pasti', ayat={'1': '1', '2': '2'}, pokok='pemeriksaan setempat', catatan='HIR 153 bernomor (1)-(2); RBg (3) tidak ada di HIR'),
    '182': dict(hir='155', status='pasti', ayat={'1': '1', '2': '2'}, pokok='sumpah pelengkap / penaksir', catatan='catatan IR. 155'),
    '183': dict(hir='156', status='pasti', ayat={}, pokok='sumpah pemutus (decisoir)', catatan='catatan IR. 156'),
    '189': dict(hir='178', status='pasti', ayat={'1': '1', '2': '2', '3': '3'}, pokok='hakim melengkapi alasan hukum; ultra petita',
                catatan='tiga kalimat HIR 178 = RBg 189 (1)-(3); catatan IR. 178'),
    '191': dict(hir='180', status='pasti', ayat={'1': '1'}, pokok='putusan serta merta / provisi', catatan='catatan IR. 180'),
    '192': dict(hir='181', status='pasti', ayat={'1': '1', '2': '1', '3': '2', '4': '3', '5': '4'}, pokok='biaya perkara',
                catatan='HIR 181 bernomor: (1) = RBg (1)+(2); (2) = RBg (3) putusan sela; (3) = RBg (4) verstek; (4) = RBg (5)'),
    '196': dict(hir='185', status='pasti', ayat={'1': '1', '2': '2'}, pokok='putusan yang bukan putusan akhir', catatan='dua kalimat HIR 185 = RBg 196 (1)-(2); catatan IR. 185'),
    '199': dict(hir=None, status='belum pasti', ayat={}, pokok='permohonan banding',
                catatan='catatan IR. 188 - HIR 188-194 tidak berlaku untuk Jawa dan Madura (diganti UU Nomor 20 Tahun 1947, usulan: Pasal 7 ayat (1)); naskah UU 20/1947 belum dicocokkan'),
    '206': dict(hir='195', status='pasti', ayat={'1': '1'}, pokok='eksekusi di bawah pimpinan ketua', catatan='HIR 195 (1) bernomor; catatan IR. 195'),
    '207': dict(hir='196', status='pasti', ayat={}, pokok='aanmaning (teguran)',
                catatan='HIR 196 satu paragraf memuat RBg 207 (1) dan (2): rujukan berayat belum pasti (HIR tanpa ayat)'),
    '208': dict(hir='197', status='belum pasti', ayat={}, pokok='perintah sita eksekusi', catatan='catatan IR. 197 (1); ayat HIR 197 tidak bernomor di naskah'),
    '209': dict(hir='197', status='belum pasti', ayat={}, pokok='sita eksekusi oleh panitera', catatan='bagian HIR 197 - ayat tidak bernomor di naskah'),
    '210': dict(hir='197', status='belum pasti', ayat={}, pokok='dua saksi penyitaan', catatan='catatan IR. 197 (6),(7); ayat tidak bernomor di naskah'),
    '213': dict(hir='198', status='pasti', ayat={'1': '1'}, pokok='pengumuman sita barang tetap', catatan='HIR 198 (1) bernomor; catatan IR. 198'),
    '214': dict(hir='199', status='pasti', ayat={'1': '1'}, pokok='larangan memindahtangankan barang sitaan', catatan='HIR 199 (1) bernomor; catatan IR. 199'),
    '215': dict(hir='200', status='pasti', ayat={'1': '1'}, pokok='lelang lewat kantor lelang', catatan='HIR 200 (1) bernomor; catatan IR. 200 (1)-(3)'),
    '216': dict(hir='200', status='belum pasti', ayat={}, pokok='urutan barang dilelang', catatan='catatan IR. 200 (4),(5); ayat itu tidak bernomor di naskah'),
    '217': dict(hir='200', status='belum pasti', ayat={}, pokok='pengumuman lelang', catatan='catatan IR. 200 (6)-(9); ayat tidak bernomor di naskah'),
    '218': dict(hir='200', status='belum pasti', ayat={}, pokok='pengosongan sesudah lelang', catatan='RBg 218 (2) = HIR 200 (11) (bernomor), tetapi rujukan pasal utuh/ayat lain belum pasti'),
    '260': dict(hir='226', status='pasti', ayat={'1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7'}, pokok='sita revindikasi',
                catatan='tujuh paragraf HIR 226 = RBg 260 (1)-(7); catatan IR. 226'),
    '261': dict(hir='227', status='pasti', ayat={'1': '1'}, pokok='sita jaminan (conservatoir)', catatan='HIR 227 (1) bernomor; catatan IR. 227'),
    '283': dict(hir='163', status='pasti', ayat={}, pokok='beban pembuktian', catatan='catatan IR. 163'),
    '284': dict(hir='164', status='pasti', ayat={}, pokok='alat bukti', catatan='catatan IR. 164'),
    '285': dict(hir='165', status='pasti', ayat={}, pokok='akta otentik', catatan='catatan IR. 165'),
    '288': dict(hir=None, status='tidak berpadanan', ayat={}, pokok='akta di bawah tangan',
                catatan='HIR tidak mengatur akta di bawah tangan (Jawa-Madura: Ordonansi S. 1867-29) - rujukan tetap RBg'),
    '306': dict(hir='169', status='pasti', ayat={}, pokok='unus testis nullus testis', catatan='catatan IR. 169'),
    '307': dict(hir='170', status='pasti', ayat={}, pokok='kesaksian berantai', catatan='catatan IR. 170'),
    '308': dict(hir='171', status='pasti', ayat={'1': '1', '2': '2'}, pokok='alasan pengetahuan saksi', catatan='HIR 171 bernomor (1)-(2); catatan IR. 171'),
    '309': dict(hir='172', status='pasti', ayat={}, pokok='menilai kesaksian', catatan='catatan IR. 172'),
    '311': dict(hir='174', status='pasti', ayat={}, pokok='pengakuan di depan hakim', catatan='catatan IR. 174'),
    '312': dict(hir='175', status='pasti', ayat={}, pokok='pengakuan di luar sidang', catatan='catatan IR. 175'),
    '313': dict(hir='176', status='pasti', ayat={}, pokok='pengakuan tidak boleh dipisah', catatan='catatan IR. 176'),
    '718': dict(hir='390', status='belum pasti', ayat={}, pokok='penyampaian panggilan/surat juru sita',
                catatan='usulan Pasal 390 HIR (artikel marinews Mahkamah Agung: 390 (3) HIR = 718 (3) RBg); teks Pasal 718 RBg tidak ada di naskah yang dapat dibuka'),
}


def padanan(rbg, ayat=None):
    """(hir_pasal, hir_ayat) bila PASTI, selain itu None. ayat=None = rujukan pasal utuh."""
    e = PASAL.get(str(rbg))
    if not e or e['status'] != 'pasti' or not e['hir']:
        return None
    if ayat is None:
        return (e['hir'], None)
    a = e['ayat'].get(str(ayat))
    if a is None:
        return None
    return (e['hir'], a)
