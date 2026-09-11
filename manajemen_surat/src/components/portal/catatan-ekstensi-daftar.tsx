import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CATATAN_EKSTENSI, tulisWaktuRilis } from "@/lib/catatan-ekstensi";

/**
 * Daftar catatan pembaruan ekstensi SIPP.
 *
 * Satu komponen untuk tiga layar - Patch Notes, Integrasi e-Court, dan Update
 * Manager - supaya ketiganya tidak pernah berselisih tentang versi mana yang
 * terbaru dan kapan ia dirilis. Tidak memakai hook, sehingga dapat digambar
 * dari komponen peladen maupun peramban.
 */
export function CatatanEkstensiDaftar({
  batas,
  idJangkar,
  tautanLengkap = true,
}: {
  /** Berapa entri teratas yang digambar; kosong berarti seluruhnya. */
  batas?: number;
  /** id pada pembungkus, untuk tautan #ekstensi dari kaki halaman. */
  idJangkar?: string;
  /** Menampilkan tautan ke daftar lengkapnya bila yang digambar dipotong. */
  tautanLengkap?: boolean;
}) {
  const daftar = batas ? CATATAN_EKSTENSI.slice(0, batas) : CATATAN_EKSTENSI;
  const terpotong = daftar.length < CATATAN_EKSTENSI.length;

  return (
    <div id={idJangkar} className="space-y-3 scroll-mt-24">
      <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {daftar.map((catatan, i) => (
          <li key={catatan.versi} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={i === 0 ? "success" : "outline"}>
                {i === 0 ? `Terbaru ${catatan.versi}` : catatan.versi}
              </Badge>
              {/* Tanggal DAN jam, dalam zona satuan kerja: yang membandingkan
                  ekstensi di peramban dengan yang tersedia perlu tahu kapan
                  persisnya sesuatu berubah - "kemarin" tidak cukup bila ada
                  tiga rilis dalam sehari. */}
              <time dateTime={catatan.dirilis} className="text-xs text-muted-foreground">
                {tulisWaktuRilis(catatan.dirilis)}
              </time>
            </div>
            <p className="font-semibold text-foreground">{catatan.judul}</p>
            <ul className="space-y-1.5 text-sm leading-6 text-muted-foreground">
              {catatan.butir.map((butir) => (
                <li key={butir} className="flex gap-2">
                  <span className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                  <span>{butir}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {terpotong && tautanLengkap ? (
        <p className="text-xs text-muted-foreground">
          Menampilkan {daftar.length} dari {CATATAN_EKSTENSI.length} versi.{" "}
          <Link
            href="/patch-notes#ekstensi"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Lihat seluruh catatan pembaruan ekstensi
          </Link>
        </p>
      ) : null}
    </div>
  );
}
