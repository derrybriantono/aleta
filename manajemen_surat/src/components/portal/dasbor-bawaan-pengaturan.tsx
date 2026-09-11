"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";

import {
  ItemGeser,
  PenataDasbor,
  SusunanGeser,
  TombolKembalikanSusunan,
} from "@/components/portal/susunan-geser";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { ZONA_DASBOR } from "@/lib/dasbor-kartu";

/**
 * Susunan bawaan dasbor - disusun Super Admin untuk seluruh pegawai.
 *
 * ============================================================================
 * DISUSUN DENGAN CARA YANG SAMA SEPERTI MEMAKAINYA
 * ============================================================================
 *
 * Kepingnya ditahan lalu digeser, persis seperti kartu di dasbor yang
 * sesungguhnya - mesin gesernya memang mesin yang sama. Borang berisi angka
 * urutan akan menuntut Super Admin membayangkan hasilnya; menggesernya
 * memperlihatkan hasil itu.
 *
 * ============================================================================
 * KEPING BERNAMA, BUKAN KARTU SUNGGUHAN
 * ============================================================================
 *
 * Kartu dasbor menghitung isinya dari ratusan baris surat dan disposisi, dan
 * halaman pengaturan tidak punya urusan menghitungnya - lagi pula angka milik
 * Super Admin bukan angka yang akan dilihat pegawai lain. Yang digambar di
 * sini kepingnya saja, dengan nama dan keterangan yang sama.
 *
 * Namanya datang dari satu katalog bersama (lib/dasbor-kartu.ts) supaya tidak
 * pernah menyusun kunci yang tidak ada di dasbornya.
 */
export function DasborBawaanPengaturan() {
  const [boleh, setBoleh] = useState<boolean | null>(null);

  // Digambar hanya bagi yang benar-benar dapat menyimpannya. Layar yang
  // menawarkan penyusunan lalu ditolak server pada lepasan pertama mengajari
  // orang bahwa aplikasinya rusak.
  useEffect(() => {
    let dibatalkan = false;
    void (async () => {
      try {
        const jawaban = await fetch(apiPath("/api/portal/session"), { cache: "no-store" });
        if (!jawaban.ok || dibatalkan) {
          if (!dibatalkan) setBoleh(false);
          return;
        }
        const akses = await fetch(apiPath("/api/aleta-ecourt/akses"), { cache: "no-store" });
        const isi = (await akses.json())?.data ?? {};
        if (!dibatalkan) setBoleh(isi?.bolehMenyunting === true);
      } catch {
        if (!dibatalkan) setBoleh(false);
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, []);

  if (boleh !== true) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          Susunan bawaan dasbor
        </CardTitle>
        <CardDescription>
          Titik berangkat bagi seluruh pegawai: yang belum pernah menyusun dasbornya, dan siapa pun
          yang menekan &quot;Kembalikan susunan bawaan&quot;, mendarat pada susunan ini. Pegawai
          tetap boleh menyusun dasbornya sendiri, dan susunannya tidak tersentuh ketika bawaan di
          sini diubah.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <PenataDasbor halaman="manajemen-surat" sasaran="bawaan">
          {ZONA_DASBOR.map((zona) => (
            <div key={zona.zona} className="space-y-2">
              <div>
                <p className="text-sm font-semibold">{zona.nama}</p>
                <p className="text-xs text-muted-foreground">{zona.keterangan}</p>
              </div>

              <SusunanGeser
                zona={zona.zona}
                sebutan={zona.nama.toLowerCase()}
                data-testid={`bawaan-zona-${zona.zona}`}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
              >
                {zona.kartu.map((kartu) => (
                  <ItemGeser key={kartu.kunci} kunci={kartu.kunci} judul={kartu.judul}>
                    <div className="h-full select-none rounded-md border bg-muted/40 px-3 py-2">
                      <p className="text-sm font-medium">{kartu.judul}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {kartu.keterangan}
                      </p>
                      {kartu.terbatas ? (
                        <Badge variant="muted" className="mt-2">
                          {kartu.terbatas}
                        </Badge>
                      ) : null}
                    </div>
                  </ItemGeser>
                ))}
              </SusunanGeser>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Tersimpan seketika. Pegawai yang sedang membuka dasbornya perlu memuat ulang halaman
              agar susunan baru terbaca.
            </p>
            <TombolKembalikanSusunan />
          </div>
        </PenataDasbor>
      </CardContent>
    </Card>
  );
}
