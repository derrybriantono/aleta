"use client";

/**
 * ============================================================================
 * PENGATURAN LAYAR ANTRIAN TANPA LOGIN
 * ============================================================================
 *
 * Diminta pengguna 23 September 2026: satu alamat yang dapat dibuka tanpa
 * login untuk melihat antrian sidang, dengan pengaturan di admin ALETA
 * tentang ruas mana yang boleh tampil. Bawaannya seluruhnya tampil.
 *
 * ============================================================================
 * YANG PEKA DITANDAI TIAP KALI, BUKAN SEKALI
 * ============================================================================
 *
 * Empat ruas menyangkut identitas: nomor perkara, nama para pihak, agenda, dan
 * majelis. Penandanya tidak mematikan apa pun - ia hanya memastikan yang
 * menyalakannya tahu apa yang dinyalakannya, dan tahu itu SETIAP KALI layar
 * ini dibuka, bukan sekali saat dipasang.
 *
 * Sebabnya: alamat tanpa login terbuka bagi siapa pun yang dapat membukanya,
 * tanpa jejak siapa yang membacanya. Televisi ruang tunggu memperlihatkan hal
 * yang sama kepada semua orang yang duduk di sana - tetapi jangkauannya
 * berhenti di pintu ruang tunggu, dan sebuah alamat tidak.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import {
  bawaanTampilAntrianPublik,
  RUAS_ANTRIAN_PUBLIK,
  ruasPekaMenyala,
  type PengaturanAntrianPublik,
} from "@/lib/antrian-publik";
import { cn } from "@/lib/utils";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

const ALAMAT_LAYAR = "/antrian-tampil";

export function AletaAntrianPublikPengaturan({ bolehUbah }: { bolehUbah: boolean }) {
  const [isi, setIsi] = useState<PengaturanAntrianPublik>({
    aktif: true,
    tampil: bawaanTampilAntrianPublik(),
    judul: "",
    catatan: "",
    diperbaruiPada: "",
  });
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [kabar, setKabar] = useState("");
  /**
   * ==========================================================================
   * SIMPAN DIKUNCI SAMPAI PENGATURANNYA SUNGGUH TERBACA
   * ==========================================================================
   *
   * Keadaan awal komponen ini adalah BAWAAN - seluruh ruas menyala. Bila
   * pembacaan gagal, layarnya memperlihatkan seluruh kotak tercentang, dan
   * admin yang mengira itu keadaan sebenarnya lalu menekan Simpan akan
   * MENYALAKAN kembali ruas peka yang sudah ia matikan sebelumnya - lewat satu
   * tekanan yang ia kira tidak mengubah apa-apa.
   */
  const [terbaca, setTerbaca] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/antrian-publik"), { cache: "no-store" });
      const j = (await r.json()) as { data?: PengaturanAntrianPublik };
      if (!r.ok) {
        setKabar(pesanGalatPortal(j, `HTTP ${r.status}`));
        return;
      }
      if (j.data) {
        setIsi(j.data);
        setTerbaca(true);
      }
    } catch (galat) {
      setKabar(galat instanceof Error ? galat.message : "Pengaturan tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const jam = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(jam);
  }, [muat]);

  const simpan = async () => {
    setMenyimpan(true);
    setKabar("");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/antrian-publik"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isi),
      });
      const j = (await r.json()) as { data?: PengaturanAntrianPublik };
      if (!r.ok) {
        setKabar(pesanGalatPortal(j, `HTTP ${r.status}`));
        return;
      }
      if (j.data) setIsi(j.data);
      setKabar("Tersimpan.");
    } catch (galat) {
      setKabar(galat instanceof Error ? galat.message : "Gagal menyimpan.");
    } finally {
      setMenyimpan(false);
    }
  };

  const peka = ruasPekaMenyala(isi.tampil);
  const alamatPenuh =
    typeof window !== "undefined" ? `${window.location.origin}${apiPath(ALAMAT_LAYAR)}` : ALAMAT_LAYAR;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layar antrian tanpa login</CardTitle>
        <CardDescription>
          Satu alamat yang dapat dibuka siapa pun tanpa masuk ke portal - untuk televisi ruang
          tunggu, atau untuk dibagikan kepada petugas yang sedang berdiri di depan ruang sidang.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alamatnya lebih dulu: inilah yang dicari orang ketika membuka
            layar ini, dan menyembunyikannya di bawah sebelas kotak centang
            membuat mereka mencarinya di tempat lain. */}
        <div className="rounded border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Alamatnya</p>
          <code className="mt-1 block break-all text-sm font-semibold">{alamatPenuh}</code>
          <p className="mt-1 text-xs text-muted-foreground">
            Tambahkan <code>?ruang=1</code> untuk membatasinya pada satu ruang sidang.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isi.aktif}
            disabled={!bolehUbah || memuat}
            onChange={(e) => setIsi((s) => ({ ...s, aktif: e.target.checked }))}
          />
          <span className="font-medium">Alamat ini menyala</span>
          <span className="text-xs text-muted-foreground">
            Dimatikan berarti alamatnya menjawab kosong seluruhnya, bukan sebagian.
          </span>
        </label>

        <div>
          <p className="mb-1 text-sm font-medium">Judul di layar</p>
          <Input
            value={isi.judul}
            disabled={!bolehUbah || memuat}
            placeholder="Kosongkan untuk memakai nama satker"
            onChange={(e) => setIsi((s) => ({ ...s, judul: e.target.value }))}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Yang boleh tampil</p>
          <div className="space-y-2">
            {RUAS_ANTRIAN_PUBLIK.map((ruas) => (
              <label
                key={ruas.kunci}
                className={cn(
                  "flex items-start gap-2 rounded border p-2 text-sm",
                  ruas.peka && isi.tampil[ruas.kunci]
                    ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/10"
                    : "border-border"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={Boolean(isi.tampil[ruas.kunci])}
                  disabled={!bolehUbah || memuat}
                  onChange={(e) =>
                    setIsi((s) => ({
                      ...s,
                      tampil: { ...s.tampil, [ruas.kunci]: e.target.checked },
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{ruas.label}</span>
                    {ruas.peka ? <Badge variant="warning">peka</Badge> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{ruas.keterangan}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {peka.length > 0 ? (
          <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm dark:border-amber-500/60 dark:bg-amber-500/10">
            <p className="font-semibold">
              {peka.length} keterangan yang menyangkut identitas sedang tampil tanpa login
            </p>
            <p className="mt-1 text-xs">
              {peka.map((x) => x.label).join(", ")} dapat dibaca siapa pun yang membuka alamat di
              atas - tanpa masuk portal, dan tanpa tercatat siapa yang membacanya. Matikan yang
              tidak diperlukan televisi ruang tunggu.
            </p>
          </div>
        ) : null}

        <div>
          <p className="mb-1 text-sm font-medium">Catatan</p>
          <Input
            value={isi.catatan}
            disabled={!bolehUbah || memuat}
            placeholder="mis. layar lobi lantai 1"
            onChange={(e) => setIsi((s) => ({ ...s, catatan: e.target.value }))}
          />
        </div>

        {!memuat && !terbaca ? (
          <div className="rounded border border-red-400 bg-red-50 p-3 text-sm dark:border-red-500/60 dark:bg-red-500/10">
            <p className="font-semibold">Pengaturannya belum terbaca</p>
            <p className="mt-1 text-xs">
              Kotak di atas memperlihatkan nilai BAWAAN, bukan yang sedang berlaku. Menyimpan
              sekarang akan menimpanya - jadi Simpan dimatikan sampai pembacaannya berhasil.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void simpan()} disabled={!bolehUbah || memuat || menyimpan || !terbaca}>
            {menyimpan ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button
            variant="outline"
            disabled={!bolehUbah || memuat || menyimpan || !terbaca}
            onClick={() => setIsi((s) => ({ ...s, tampil: bawaanTampilAntrianPublik() }))}
          >
            Kembalikan ke bawaan (semua tampil)
          </Button>
          {kabar ? <span className="text-sm text-muted-foreground">{kabar}</span> : null}
        </div>

        {!bolehUbah ? (
          <p className="text-xs text-muted-foreground">
            Hanya Admin atau Super Admin yang dapat mengubahnya.
          </p>
        ) : null}
        {isi.diperbaruiPada ? (
          <p className="text-xs text-muted-foreground">Terakhir diubah {isi.diperbaruiPada}.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
