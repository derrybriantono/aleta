"use client";

import Link from "next/link";

import { AletaAbtPintu } from "@/components/portal/aleta-abt-pintu";
import { PageIntro } from "@/components/portal/shared";
import { KartuBedaAbt } from "@/components/portal/sinkron-abt-kartu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";

/**
 * ALETA ABT. Hak diputuskan server lewat /api/aleta-abt/hak; halaman tidak menyembunyikan apa pun yang membahayakan, hanya menerangkan keadaan akun.
 * Semua layar di bawah hanya untuk Super Admin: kartunya hanya tampil bagi Super Admin dan rutenya menjaga ulang di server. Tanpa ekstensi (HP),
 * kartu mengikuti saklar ALETA ABT di HP lewat AletaAbtPintu.
 */
export default function HalamanAletaAbt() {
  const pengguna = usePenggunaAktifOpsional();
  const superAdmin = String(getEffectiveRoleId(pengguna ?? undefined) ?? "") === "super-admin";
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro eyebrow="Blangko" title="ALETA ABT" description="Pintu menuju Blangko ABT by Derry Briantono." />
      <AletaAbtPintu superAdmin={superAdmin}>
        <Card>
          <CardHeader>
            <CardTitle>Penyunting blangko</CardTitle>
            <CardDescription>
              Ubah teks, isian, dan bagian bersyarat blangko langsung di layar. Tiap simpan menjadi versi baru, bedanya terlihat, versi lama dapat dikembalikan, dan hanya
              yang diterbitkan yang dipakai.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/aleta-abt/penyunting">Buka penyunting blangko</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cetak dan pembanding</CardTitle>
            <CardDescription>
              Pilih perkara dan blangko, lihat naskah yang disusun ALETA ABT tanpa ABT, lalu unduh RTF, PDF, atau PDF SALINAN. Hasilnya dapat dibandingkan dengan cetakan ABT alinea demi alinea, dan ringkasan berdampingan dengan ABT ada di laporan pembanding.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/aleta-abt/cetak">Buka layar cetak</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/aleta-abt/pembanding">Buka laporan pembanding</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Siap diperiksa dan hak folder</CardTitle>
            <CardDescription>
              Pekerjaan tiap peran dari jadwal sidang beserta blangko yang disarankan, tombol Selesaikan berkas, dan daftar siapa yang membuka folder blangko untuk disetujui pemilik.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/aleta-abt/siap">Buka Siap diperiksa</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/aleta-abt/hak">Buka hak folder</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kesiapan pindah ke ALETA ABT</CardTitle>
            <CardDescription>
              Jenis perkara mana yang sudah terbukti sama dengan ABT dan boleh dicetak tanpa ABT. Semua jenis masih memakai ABT sampai Anda menyalakannya satu per satu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/aleta-abt/kesiapan">Buka kesiapan pindah</Link>
            </Button>
          </CardContent>
        </Card>
        <KartuBedaAbt />
      </AletaAbtPintu>
    </div>
  );
}
