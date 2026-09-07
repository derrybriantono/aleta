"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/portal/shared";

/**
 * ============================================================================
 * ALETA e-AUDIT - TAHAP 0
 * ============================================================================
 *
 * Tahap 0 sengaja tidak menampilkan satu butir penilaian pun.
 *
 * Yang dikerjakan pada tahap ini hanya pagarnya: aplikasi berdiri, tempatnya
 * pasti, aksesnya terkunci, dan janjinya tertulis. Menaruh butir penilaian di
 * sini akan mendahului tahap yang belum dikerjakan, dan pada tahap berikutnya
 * butir itu harus dibongkar lagi - persis kebiasaan yang hendak dihindari
 * seluruh rencana ini.
 *
 * Halaman ini juga tidak berpura-pura. Ia menyatakan apa adanya bahwa isinya
 * belum ada, dan menyebutkan apa yang akan mengisinya. Layar kosong tanpa
 * keterangan terbaca seperti aplikasi rusak; layar kosong yang menerangkan
 * dirinya terbaca seperti pekerjaan yang sedang berjalan.
 */

/** Kedua belas bab beserta jumlah butirnya, dibaca dari katalog prototipe. */
const BAB = [
  { no: 1, nama: "Mesin Penilaian", butir: 6, kode: 2, hitung: 4, bebas: 0 },
  { no: 2, nama: "Pengawasan Mutu dan Integritas Data", butir: 14, kode: 9, hitung: 5, bebas: 0 },
  { no: 3, nama: "Ketaatan Tahapan dan Tenggang Waktu", butir: 20, kode: 20, hitung: 0, bebas: 0 },
  { no: 4, nama: "Laporan Perkara (LIPA 1-22)", butir: 26, kode: 23, hitung: 0, bebas: 3 },
  { no: 5, nama: "Register dan Buku Kepaniteraan", butir: 14, kode: 14, hitung: 0, bebas: 0 },
  { no: 6, nama: "Beban Kerja dan Pemerataan", butir: 10, kode: 3, hitung: 5, bebas: 2 },
  { no: 7, nama: "Rapor Kinerja Aparatur", butir: 14, kode: 11, hitung: 3, bebas: 0 },
  { no: 8, nama: "Keuangan Perkara", butir: 16, kode: 1, hitung: 10, bebas: 5 },
  { no: 9, nama: "Statistik Perkara dan Para Pihak", butir: 22, kode: 7, hitung: 12, bebas: 3 },
  { no: 10, nama: "Mutu Putusan dan Persidangan", butir: 16, kode: 6, hitung: 8, bebas: 2 },
  { no: 11, nama: "Pelayanan kepada Pencari Keadilan", butir: 12, kode: 3, hitung: 8, bebas: 1 },
  { no: 12, nama: "Metode Analisis dan Pengujian", butir: 15, kode: 1, hitung: 12, bebas: 2 },
] as const;

const JUMLAH_BUTIR = BAB.reduce((a, b) => a + b.butir, 0);

/** Janji yang tidak boleh berubah, ditulis di layar supaya dapat ditagih. */
const JANJI = [
  {
    judul: "Tidak pernah menulis ke SIPP",
    isi: "Seluruh pembacaan SIPP melewati ALETA Bot dan wajib berupa SELECT. Penjaga menolak berkas layanan yang memuat perintah tulis, dan penolakan itu berjalan pada tiap putaran uji.",
  },
  {
    judul: "Angka diturunkan dari buktinya",
    isi: "Pembilang dan penyebut dihitung DARI daftar bukti yang sama, bukan dari kueri terpisah. Dengan begitu angka dan bukti tidak mungkin berbeda - dan bila kueri agregat pembanding tidak sepakat, selisihnya dilaporkan sebagai temuan.",
  },
  {
    judul: "Nilai ditahan bila belum pantas",
    isi: "Penyebut di bawah dua puluh, periode lebih pendek daripada lantai penilaian, ambang yang belum berlaku, daftar hari libur yang belum disahkan, dan penyandingan yang belum dikerjakan - masing-masing menahan nilainya dan menyebutkan sebabnya.",
  },
  {
    judul: "Belum boleh dipakai membina",
    isi: "Selama sebuah butir belum disandingkan dengan angka dari luar ALETA, keterangan itu menempel pada hasilnya sampai ke layar. Boleh dibaca dan diperiksa; belum boleh dipakai menilai orang.",
  },
];

export function AletaEAudit() {
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="ALETA e-Audit"
        title="Pengawasan Berjenjang"
        description="Ketaatan tahapan, mutu data, laporan perkara, keuangan, dan kinerja aparatur - dengan bukti yang selalu dapat dibuka sampai ke nomor perkaranya."
      />

      <Card className="border-amber-300/70 bg-amber-50/70 dark:border-amber-700/40 dark:bg-amber-950/25">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Tahap 0 - kerangka dan pagar</CardTitle>
              <CardDescription className="text-amber-900 dark:text-amber-200">
                Aplikasi ini berdiri, tetapi belum memuat satu butir penilaian pun. Itu disengaja.
              </CardDescription>
            </div>
            <Badge variant="warning">belum berisi</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          <p>
            Yang selesai pada tahap ini hanya tempatnya: aplikasi terdaftar di dashboard, memakai
            kerangka yang sama dengan aplikasi lain, dan aksesnya terkunci pada super admin.
          </p>
          <p>
            Butir penilaiannya masuk mulai Tahap 1, dan urutannya ditentukan oleh dari mana
            angkanya berasal - bukan oleh nomor babnya. Bab 3 dan Bab 5 dikerjakan lebih dahulu
            karena keduanya seluruhnya membaca ruas berkode, sehingga satu pola melayani tiga
            puluh empat butir sekaligus.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Yang akan mengisinya</CardTitle>
              <CardDescription>
                Dua belas bab, {JUMLAH_BUTIR} butir penilaian. Tiap butir membawa penanda dari mana
                angkanya berasal, dan penanda itulah yang menentukan urutan pengerjaannya.
              </CardDescription>
            </div>
            <Badge variant="muted">{JUMLAH_BUTIR} butir</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border/80">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/70 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right font-semibold">Bab</th>
                  <th className="px-3 py-2 font-semibold">Nama</th>
                  <th className="px-3 py-2 text-right font-semibold">Butir</th>
                  <th className="px-3 py-2 text-right font-semibold">Berkode</th>
                  <th className="px-3 py-2 text-right font-semibold">Dihitung</th>
                  <th className="px-3 py-2 text-right font-semibold">Teks bebas</th>
                </tr>
              </thead>
              <tbody>
                {BAB.map((b) => (
                  <tr key={b.no} className="border-t border-border/70">
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{b.no}</td>
                    <td className="px-3 py-2 font-medium">{b.nama}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.butir}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.kode || "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.hitung || "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {b.bebas ? (
                        <span className="text-amber-700 dark:text-amber-300">{b.bebas}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Delapan belas butir bertumpu pada ruas yang diketik bebas di SIPP. Pengukuran terhadap
            basis data sungguhan menunjukkan sebagiannya terlalu kosong atau terlalu beragam untuk
            dinilai - butir seperti itu akan berdiri dengan keterangan cakupannya, bukan dengan
            angka.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Janji yang tidak berubah</CardTitle>
          <CardDescription>
            Ditulis di layar supaya dapat ditagih siapa pun, bukan disimpan di dalam kode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 md:grid-cols-2">
            {JANJI.map((j) => (
              <div key={j.judul} className="rounded-lg border border-border/80 bg-muted/30 p-3">
                <dt className="text-sm font-semibold">{j.judul}</dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">{j.isi}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Siapa yang dapat membukanya</CardTitle>
          <CardDescription>Untuk sekarang: super admin saja.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6">
          <p>
            Pengenal aplikasi ini sengaja tidak dimasukkan ke daftar aplikasi bawaan portal. Selama
            ia tidak ada di sana, peran selain super admin tidak melihat kartunya, dan membuka
            alamatnya langsung akan dijawab halaman penolakan.
          </p>
          <p>
            Membukanya untuk peran lain kelak adalah satu keputusan sadar - bukan efek samping dari
            perubahan lain. Uji keterjangkauan mengunci daftar itu, sehingga menambahkannya menuntut
            perubahan yang disengaja dan tercatat.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
