"use client";

/**
 * ============================================================================
 * PEMBEBANAN SAAT IKRAR TALAK - LENCANA DI KOLOM PUTUSAN DAN BAGIAN RINCIAN
 * ============================================================================
 *
 * Diminta pengguna 6 Oktober 2026. Berkas tersendiri, bukan di dalam
 * aleta-ecourt-sidang.tsx: berkas itu disunting beberapa pekerjaan sekaligus,
 * dan yang ditanam di sana hanya dua pemanggilan.
 *
 * Aturan tampil dan bentuk angkanya di lib/pembebanan-ikrar.ts.
 */

import { Bagian } from "@/components/portal/bagian-ciut";
import { cn } from "@/lib/utils";
import {
  judulLencanaPembebanan,
  rupiahPenuh,
  rupiahRingkas,
  tampilkanPembebanan,
  teksLencanaPembebanan,
  type PembebananIkrar,
} from "@/lib/pembebanan-ikrar";

/**
 * Lencana kecil di bawah penanda putusan, HANYA pada baris sidang ikrar talak
 * yang punya pembebanan. Diam pada baris lain - termasuk bila bot gagal
 * membacanya (pembebananTerbaca false): ketiadaan yang tidak terbukti tidak
 * boleh berbunyi "tanpa pembebanan", dan lencana yang tidak muncul tidak
 * berbunyi apa pun.
 */
export function LencanaPembebananIkrar({
  baris,
  className,
}: {
  baris: { agenda?: string; sidangIkrarTalak?: boolean; pembebanan?: PembebananIkrar | null };
  className?: string;
}) {
  if (!tampilkanPembebanan(baris) || !baris.pembebanan) return null;
  const p = baris.pembebanan;
  return (
    <div className={cn("mt-1 flex flex-wrap gap-1", className)}>
      {/* Ungu: tidak dipakai lencana lain di kolom ini. Bukan merah - ini
          bukan kesalahan siapa pun, melainkan syarat yang harus dipenuhi
          di ruang sidang sebelum ikrar diucapkan. */}
      <span
        className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-950 dark:text-violet-200"
        title={judulLencanaPembebanan(p)}
        data-penanda="pembebanan-ikrar"
      >
        {teksLencanaPembebanan(p)}
      </span>
    </div>
  );
}

/**
 * Bagian "Pembebanan saat ikrar talak" di panel Rincian: tiap pos (jenis,
 * jumlah, penerima/keterangan, kalimat amar sumbernya) dan totalnya.
 */
export function PembebananIkrarRincian({ pembebanan }: { pembebanan?: PembebananIkrar | null }) {
  if (!pembebanan || (pembebanan.pos.length === 0 && !pembebanan.tidakTerbaca)) return null;
  const p = pembebanan;
  const keterangan =
    p.pos.length === 0
      ? "tidak terbaca"
      : [
          p.totalSekaligus > 0 ? rupiahRingkas(p.totalSekaligus) : "",
          p.berkalaPerBulan > 0 ? `${rupiahRingkas(p.berkalaPerBulan)}/bln` : "",
        ]
          .filter(Boolean)
          .join(" + ");

  return (
    <Bagian judul="Pembebanan saat ikrar talak" kunci="sidang-pembebanan-ikrar" keterangan={keterangan}>
      {p.pos.length === 0 ? (
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Amar putusan menyebut pembebanan, tetapi rinciannya tidak dapat diurai otomatis. Periksa
          naskah putusan sebelum ikrar diucapkan.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-bagian="pembebanan-ikrar">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Jenis</th>
                  <th className="py-1 pr-2 text-right font-medium">Jumlah</th>
                  <th className="py-1 pr-2 font-medium">Penerima / keterangan</th>
                  <th className="py-1 font-medium">Sumber (amar putusan)</th>
                </tr>
              </thead>
              <tbody>
                {p.pos.map((x, i) => (
                  <tr key={`${x.jenis}-${i}`} className="border-b border-border/60 align-top">
                    <td className="py-1.5 pr-2 font-medium">{x.sebutan}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums">
                      {x.jumlah === null ? (
                        <span className="text-muted-foreground">tanpa angka</span>
                      ) : (
                        <>
                          {rupiahPenuh(x.jumlah)}
                          {x.berkala ? <span className="text-muted-foreground"> /bulan</span> : null}
                        </>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <div>{x.penerima}</div>
                      {x.keterangan ? <div className="text-xs text-muted-foreground">{x.keterangan}</div> : null}
                      {x.ragu || x.catatan ? (
                        <div
                          className={cn(
                            "text-xs",
                            x.ragu ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
                          )}
                        >
                          {x.ragu ? "Periksa amar: " : ""}
                          {x.catatan}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground">
                      <span className="break-words">{x.kalimat}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-1.5 pr-2">Total dibayar sekaligus</td>
                  <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums" data-total="sekaligus">
                    {rupiahPenuh(p.totalSekaligus)}
                  </td>
                  <td className="py-1.5 text-xs font-normal text-muted-foreground" colSpan={2}>
                    {p.adaTanpaAngka ? "belum termasuk pos tanpa angka (barang)" : ""}
                  </td>
                </tr>
                {p.berkalaPerBulan > 0 ? (
                  <tr>
                    <td className="py-1 pr-2">Nafkah bulanan</td>
                    <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums" data-total="bulanan">
                      {rupiahPenuh(p.berkalaPerBulan)} /bulan
                    </td>
                    <td className="py-1 text-xs text-muted-foreground" colSpan={2}>
                      dibayar tiap bulan, tidak termasuk total di atas
                    </td>
                  </tr>
                ) : null}
              </tfoot>
            </table>
          </div>

          {p.waktuBayar ? (
            <p className="rounded-md border border-violet-500/30 bg-violet-500/5 px-2 py-1.5 text-xs">
              <span className="font-medium">
                {p.sebelumIkrar ? "Dibayar sebelum/saat ikrar: " : "Waktu pembayaran menurut amar: "}
              </span>
              {p.waktuBayar}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Diurai otomatis dari amar putusan di SIPP. Angka yang ditandai &quot;periksa amar&quot; berbeda
            dengan terbilangnya atau periodenya tidak tertulis - naskah putusan yang menentukan.
          </p>
        </div>
      )}
    </Bagian>
  );
}
