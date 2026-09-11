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
import { HALAMAN_DASBOR } from "@/lib/dasbor-kartu";

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
          Susunan bawaan portal dan dasbor
        </CardTitle>
        <CardDescription>
          Titik berangkat bagi seluruh pegawai: yang belum pernah menyusun dasbornya, dan siapa pun
          yang menekan &quot;Kembalikan susunan bawaan&quot;, mendarat pada susunan ini. Pegawai
          tetap boleh menyusun dasbornya sendiri, dan susunannya tidak tersentuh ketika bawaan di
          sini diubah.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Satu penata per HALAMAN. Susunan disimpan berkunci halaman, jadi
            menggabungkan portal dan dasbor surat ke dalam satu penata akan
            menuliskan zona keduanya ke baris yang sama - dan halaman yang satu
            akan membaca zona milik halaman yang lain lalu mengabaikannya diam-
            diam karena kuncinya tidak dikenal. */}
        {HALAMAN_DASBOR.map((halaman) => (
          <PenataDasbor key={halaman.halaman} halaman={halaman.halaman} sasaran="bawaan">
            <div className="space-y-4" data-testid={`bawaan-halaman-${halaman.halaman}`}>
              <div className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm font-semibold text-foreground">{halaman.nama}</p>
                <p className="text-xs text-muted-foreground">{halaman.keterangan}</p>
              </div>

              {halaman.zona.map((zona) => (
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
                  Tersimpan seketika. Pegawai yang sedang membuka halaman ini perlu memuat ulang
                  agar susunan baru terbaca.
                </p>
                <TombolKembalikanSusunan />
              </div>
            </div>
          </PenataDasbor>
        ))}

        {/* Ubin aplikasi di portal sengaja tidak ada di sini: daftar aplikasinya
            berbeda menurut peran dan hak akses tiap orang, sehingga keping
            bernama di layar ini tidak akan mewakili apa yang sesungguhnya
            dilihat pegawai. Ubinnya tetap dapat disusun tiap orang di
            portalnya sendiri. */}
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Urutan ubin aplikasi di portal tidak disetel dari sini. Daftar aplikasi berbeda menurut hak
          akses tiap pegawai, jadi urutannya disusun masing-masing langsung di halaman portalnya.
        </p>
      </CardContent>
    </Card>
  );
}
