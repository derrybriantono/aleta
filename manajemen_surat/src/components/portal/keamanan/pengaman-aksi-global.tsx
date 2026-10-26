"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HEADER_PENGAMAN_KLIEN, bacaPermintaanPengaman, type PermintaanPengamanKlien } from "@/lib/keamanan-klien";

/**
 * ============================================================================
 * KOTAK KONFIRMASI PENGAMAN AKSI ADMIN (Bagian 6c) - satu tempat untuk semua layar
 * ============================================================================
 *
 * Bila pengaman aksi menyala, rute yang menjaga aksi berdampak besar menjawab
 * 403 dengan details.alasan = "pengaman_aksi". Komponen ini (dipasang sekali di
 * tata letak portal) membungkus window.fetch: jawaban semacam itu ditahan, kotak
 * konfirmasi muncul (sandi + kata yang diketik + kode langkah kedua bila diminta),
 * lalu permintaan yang SAMA diulang dengan tiga header konfirmasi. Layar yang
 * memanggil fetch tidak perlu diubah satu pun.
 *
 * Dibatalkan -> jawaban 403 aslinya dikembalikan, sehingga layar menampilkan
 * kalimat dari server seperti biasa. Selama saklar mati tidak pernah ada jawaban
 * seperti itu, jadi pembungkus ini hanya meneruskan setiap permintaan apa adanya
 * (hanya jawaban 403 untuk /api/ yang sama asal diintip).
 */

type Hasil = { sandi: string; ketik: string; kode: string } | null;
type Antrean = { permintaan: PermintaanPengamanKlien; selesai: (h: Hasil) => void };

let bukaKotak: ((a: Antrean) => void) | null = null;
let rantai: Promise<unknown> = Promise.resolve();

function mintaKonfirmasi(permintaan: PermintaanPengamanKlien): Promise<Hasil> {
  // Satu kotak pada satu waktu; permintaan berikutnya mengantre.
  const giliran = rantai.then(
    () =>
      new Promise<Hasil>((selesai) => {
        if (!bukaKotak) selesai(null);
        else bukaKotak({ permintaan, selesai });
      })
  );
  rantai = giliran.catch(() => undefined);
  return giliran;
}

function alamatDari(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function samaAsalApi(input: RequestInfo | URL): boolean {
  try {
    const u = new URL(alamatDari(input), window.location.href);
    return u.origin === window.location.origin && /\/api\//.test(u.pathname);
  } catch {
    return false;
  }
}

export function PengamanAksiGlobal() {
  const [aktif, setAktif] = useState<Antrean | null>(null);
  const [sandi, setSandi] = useState("");
  const [ketik, setKetik] = useState("");
  const [kode, setKode] = useState("");
  const sandiRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bukaKotak = (a) => {
      setSandi("");
      setKetik("");
      setKode("");
      setAktif(a);
    };
    const asli = window.fetch;
    const pembungkus: typeof window.fetch = async (input, init) => {
      const salinan = input instanceof Request ? input.clone() : null;
      let respons = await asli.call(window, input, init);
      if (respons.status !== 403 || !samaAsalApi(input)) return respons;
      for (let percobaan = 0; percobaan < 6; percobaan += 1) {
        const isi = await respons
          .clone()
          .json()
          .catch(() => null);
        const permintaan = bacaPermintaanPengaman(isi);
        if (!permintaan) return respons;
        const hasil = await mintaKonfirmasi(permintaan);
        if (!hasil) return respons;
        const headers = new Headers(init?.headers ?? (salinan ? salinan.headers : undefined));
        headers.set(HEADER_PENGAMAN_KLIEN.sandi, hasil.sandi);
        headers.set(HEADER_PENGAMAN_KLIEN.ketik, hasil.ketik);
        if (hasil.kode) headers.set(HEADER_PENGAMAN_KLIEN.kode, hasil.kode);
        respons = salinan
          ? await asli.call(window, new Request(salinan.clone(), { headers }))
          : await asli.call(window, input, { ...init, headers });
        if (respons.status !== 403) return respons;
      }
      return respons;
    };
    window.fetch = pembungkus;
    return () => {
      if (window.fetch === pembungkus) window.fetch = asli;
      bukaKotak = null;
    };
  }, []);

  useEffect(() => {
    if (aktif) sandiRef.current?.focus();
  }, [aktif]);

  if (!aktif) return null;
  const p = aktif.permintaan;
  const tutup = (hasil: Hasil) => {
    const a = aktif;
    setAktif(null);
    a.selesai(hasil);
  };
  const lengkap = sandi.length > 0 && ketik.trim().length > 0 && (!p.perluKodeKedua || kode.trim().length > 0);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center tirai-latar p-4" data-pengaman-aksi>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="pengaman-judul"
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (lengkap) tutup({ sandi, ketik: ketik.trim(), kode: kode.trim() });
        }}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 id="pengaman-judul" className="text-base font-semibold text-foreground">
              Konfirmasi aksi berdampak besar
            </h2>
            <p className="text-sm text-muted-foreground">{p.label}. Masukkan sandi Anda dan ketik kata konfirmasi untuk melanjutkan.</p>
          </div>
        </div>
        {p.salah && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{p.salah}</p>}
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Sandi Anda</span>
          <Input ref={sandiRef} type="password" autoComplete="current-password" value={sandi} onChange={(e) => setSandi(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">
            Ketik <strong>{p.kataKonfirmasi}</strong>
          </span>
          <Input type="text" autoComplete="off" value={ketik} onChange={(e) => setKetik(e.target.value)} placeholder={p.kataKonfirmasi} />
        </label>
        {p.perluKodeKedua && (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Kode langkah kedua</span>
            <Input type="text" inputMode="numeric" autoComplete="one-time-code" value={kode} onChange={(e) => setKode(e.target.value)} />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => tutup(null)}>
            Batal
          </Button>
          <Button type="submit" disabled={!lengkap}>
            Lanjutkan
          </Button>
        </div>
      </form>
    </div>
  );
}
