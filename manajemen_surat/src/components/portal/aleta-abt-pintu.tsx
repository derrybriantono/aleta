"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DARI_UBIN_APS, alamatPanelAbt, bolehBlangkoDerry } from "@/lib/aleta-abt-hp";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Halaman ALETA ABT (5 Nov 2026). Layar ALETA ABT untuk HP BELUM ADA; halaman ini hanya pintu:
 *   - ekstensi ALETA aktif: tombol membuka panel Blangko ABT by Derry Briantono di halaman ABT;
 *   - tanpa ekstensi, hak menyala: pemberitahuan bahwa layar HP sedang dibangun dan belum dapat dipakai;
 *   - tanpa ekstensi, hak mati (mis. alamat dibuka langsung): ALETA ABT dibuka dari PC dengan ekstensi aktif.
 * Hak diputuskan server (/api/aleta-abt/hak); layar hanya menampilkannya.
 */

type Hak = { terbuka: boolean };

/** Ekstensi mengumumkan diri lewat dataset pada <html> (jembatan relaas). Kosong = tidak aktif. */
export function versiEkstensiAktif(): string {
  if (typeof document === "undefined") return "";
  return String(document.documentElement.dataset.aletaEkstensi || "");
}

export function AletaAbtPintu() {
  const [hak, setHak] = useState<Hak | null>(null);
  const [galat, setGalat] = useState("");
  const [versi, setVersi] = useState("");
  const [alamat, setAlamat] = useState("");
  const [membuka, setMembuka] = useState(false);

  useEffect(() => {
    let batal = false;
    fetch(apiPath("/api/aleta-abt/hak"), { cache: "no-store" })
      .then(async (r) => {
        const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: Hak } | null;
        if (!r.ok || !isi || isi.ok === false || !isi.data) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
        if (!batal) setHak({ terbuka: Boolean(isi.data.terbuka) });
      })
      .catch((e: Error) => {
        if (!batal) setGalat(e.message);
      });
    return () => {
      batal = true;
    };
  }, []);

  // Ekstensi dipasang sesudah halaman tergambar: periksa beberapa kali dan dengarkan pesan "siap".
  useEffect(() => {
    const periksa = () => {
      const v = versiEkstensiAktif();
      if (v) setVersi(v);
      return Boolean(v);
    };
    let n = 0;
    const timer = window.setInterval(() => {
      n += 1;
      if (periksa() || n >= 10) window.clearInterval(timer);
    }, 500);
    const dengar = (e: MessageEvent) => {
      if (e.source === window && e.origin === window.location.origin && (e.data as { sumber?: string } | null)?.sumber === "aleta-ekstensi") periksa();
    };
    window.addEventListener("message", dengar);
    const awal = window.setTimeout(() => {
      setAlamat(alamatPanelAbt(window.location));
      periksa();
    }, 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(awal);
      window.removeEventListener("message", dengar);
    };
  }, []);

  // Datang dari ubin ALETA ABT di menu APS (?dari=aps), sudah masuk: buka panel Blangko ABT bila
  // ekstensi aktif dan akun berhak membukanya (aturan yang sama dengan ubin). Selain itu tombol di bawah tetap ada.
  useEffect(() => {
    if (!versi || !alamat) return;
    if (new URLSearchParams(window.location.search).get("dari") !== DARI_UBIN_APS) return;
    let batal = false;
    fetch(apiPath("/api/aleta-ecourt/ekstensi/siapa"), { cache: "no-store" })
      .then(async (r) => {
        const isi = (await r.json().catch(() => null)) as { data?: unknown } | null;
        if (!r.ok || batal) return;
        if (bolehBlangkoDerry(isi && isi.data !== undefined ? isi.data : isi)) {
          setMembuka(true);
          window.location.replace(alamat);
        }
      })
      .catch(() => undefined);
    return () => {
      batal = true;
    };
  }, [versi, alamat]);

  if (versi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ekstensi ALETA aktif</CardTitle>
          <CardDescription>
            Panel Blangko ABT by Derry Briantono dibuka di halaman ABT, lewat ekstensi ALETA di Chrome PC ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full sm:w-auto">
            <a href={alamat || undefined} target="_blank" rel="noopener noreferrer">
              Buka panel Blangko ABT
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            {membuka ? "Membuka panel Blangko ABT..." : `Versi ekstensi ${versi}. Panel terbuka di tab baru.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (galat) {
    return (
      <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
        {galat}
      </div>
    );
  }

  if (!hak) return <p className="text-sm text-muted-foreground">Memeriksa akses Anda...</p>;

  if (hak.terbuka) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Layar ALETA ABT untuk HP sedang dibangun</CardTitle>
          <CardDescription>
            Akun Anda sudah diizinkan membuka ALETA ABT dari HP kelak, tetapi layarnya belum dapat dipakai. Sementara itu, buka ALETA ABT dari PC dengan
            ekstensi ALETA aktif di Chrome.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ALETA ABT dibuka dari PC dengan ekstensi aktif</CardTitle>
        <CardDescription>Ekstensi ALETA belum aktif di peramban ini, dan akun Anda belum diizinkan membuka ALETA ABT dari HP.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Buka portal ini dari Chrome di PC kantor.</li>
          <li>Pasang atau aktifkan ekstensi ALETA di Chrome, lalu muat ulang halaman ini.</li>
          <li>Setelah ekstensi aktif, tombol untuk membuka panel Blangko ABT muncul di halaman ini.</li>
        </ol>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/aleta-ecourt">Lihat cara memasang ekstensi</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
