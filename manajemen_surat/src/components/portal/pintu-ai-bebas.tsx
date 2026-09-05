"use client";

import { useState } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * PINTU KE ALETA AI PA CLAUDE (I7) - berpikir bebas di luar berkas.
 *
 * ============================================================================
 * PINTU INI YANG MEMBUAT ATURAN KETAT DI TEMPAT LAIN DAPAT DITANGGUNG
 * ============================================================================
 *
 * Lapisan AI di dalam ALETA sengaja sempit: pustaka dulu, kutipan wajib
 * terbukti, naskah utuh tidak boleh keluar. Aturan sesempit itu hanya dapat
 * bertahan bila ada tempat lain untuk berpikir bebas - kalau tidak, yang
 * terjadi bukan hakim berhenti memakai AI, melainkan hakim memakainya lewat
 * jalan yang tidak terlihat sama sekali, menyalin isi berkas ke tab lain
 * tanpa satu pun penjagaan.
 *
 * Pintu ini mengakui kenyataan itu dan menempatkannya di tempat yang terlihat.
 *
 * ============================================================================
 * TIDAK ADA APA PUN DARI BERKAS YANG IKUT
 * ============================================================================
 *
 * Ini tautan biasa. Tidak ada nomor perkara di alamatnya, tidak ada nama
 * pihak, tidak ada apa pun yang dibawa diam-diam. Membawanya akan menjadikan
 * pintu ini jalur kiriman keluar yang melewati J5 - persis yang hendak
 * dicegah seluruh lapisan ini.
 *
 * Yang dibawa hakim ke sana, dibawanya sendiri dengan sadar. Karena itu
 * peringatannya ditulis terus terang dan tidak dapat dilewati tanpa dibaca:
 * yang ditempel di sana MENINGGALKAN gedung ini, dan tidak ada yang dapat
 * menariknya kembali.
 */

export function PintuAiBebas({ alamat }: { alamat: string }) {
  const [sadar, setSadar] = useState(false);
  const tujuan = String(alamat ?? "").trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Berpikir bebas di luar berkas</CardTitle>
        <CardDescription>
          Untuk pertanyaan yang tidak menyangkut isi perkara — membaca teori, menyusun kerangka, mencari
          padanan istilah. Terbuka di tab baru, terpisah dari ALETA.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Tidak ada apa pun dari berkas yang ikut ke sana.</p>
            <p>
              ALETA tidak mengirim nomor perkara, nama pihak, maupun isi berkas lewat pintu ini. Yang Anda
              tempel di sana, Anda tempel sendiri — dan begitu tertempel, ia sudah meninggalkan gedung ini.
              Tidak ada yang dapat menariknya kembali.
            </p>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={sadar}
            onChange={(event) => setSadar(event.target.checked)}
            className="mt-1"
          />
          <span>
            Saya paham: apa pun yang saya tempel di sana keluar dari jaringan pengadilan, dan penjagaan
            ALETA tidak berlaku di sana.
          </span>
        </label>

        {tujuan ? (
          <Button asChild disabled={!sadar}>
            {/* Dibuka di tab baru dengan noreferrer: tanpa itu, alamat halaman
                ALETA yang sedang terbuka - beserta nomor perkara di dalamnya -
                ikut terkirim ke tujuan sebagai perujuk. */}
            <a
              href={sadar ? tujuan : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!sadar}
              onClick={(event) => {
                if (!sadar) event.preventDefault();
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Buka di tab baru
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Alamatnya belum disetel. Admin mengisinya di Pengaturan Panel.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
