"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiPath } from "@/lib/base-path";
import {
  type BarisAntrian,
  jamSekarang,
  selangPanggilan,
  warnaRuang,
} from "@/lib/antrian-tampilan";

/**
 * ============================================================================
 * ANTRIAN PER RUANG - HALAMAN CEPAT PETUGAS SIDANG, TANPA LOGIN
 * ============================================================================
 *
 * Dibuka dari ponsel, sambil berdiri, sepuluh detik sebelum sidang dibuka.
 * Menuntut login untuk melihat satu angka akan membuat petugas berhenti
 * memakainya dan kembali bertanya lewat pengeras suara.
 *
 * Bentuknya sengaja SATU LAYAR PENUH tanpa gulir: nomor yang sedang dipanggil,
 * yang berikutnya, berapa lagi yang menunggu, dan laju hari ini. Apa pun yang
 * menuntut menggulir tidak akan terbaca pada keadaan ia dipakai.
 *
 * ============================================================================
 * YANG BOLEH TAMPIL HANYA ANGKA
 * ============================================================================
 *
 * Nomor, ruang, keadaan, jam panggil. TIDAK ADA nomor perkara, nama pihak,
 * maupun keterangan kehadiran - halaman ini terbuka bagi siapa pun di jaringan
 * pengadilan.
 *
 * Pembatasan itu ditegakkan di RUTE-nya (/api/antrian-ruang), bukan di sini.
 * Layar yang menyaring sendiri akan bocor begitu ada yang membuka alamat
 * rutenya langsung.
 */

type Baris = BarisAntrian & { nomor: number | null; noRuang: number | null };

const SELANG_MS = 8000;

export default function AntrianRuangPage() {
  const [ruang, setRuang] = useState(0);
  const [baris, setBaris] = useState<Baris[]>([]);
  const [pesan, setPesan] = useState("");
  const [jam, setJam] = useState("");

  const ambil = useCallback(async (nomorRuang: number) => {
    try {
      const alamat = apiPath(
        nomorRuang > 0 ? `/api/antrian-ruang?ruang=${nomorRuang}` : "/api/antrian-ruang"
      );
      const r = await fetch(alamat, { cache: "no-store" });
      const isi = (await r.json()) as { data?: { baris?: Baris[]; message?: string } };
      const hasil = isi.data ?? (isi as { baris?: Baris[]; message?: string });
      setBaris(Array.isArray(hasil.baris) ? hasil.baris : []);
      setPesan(hasil.message || "");
    } catch {
      setPesan("Antrian belum dapat dibaca.");
    }
  }, []);

  useEffect(() => {
    void ambil(ruang);
    const detak = setInterval(() => void ambil(ruang), SELANG_MS);
    return () => clearInterval(detak);
  }, [ambil, ruang]);

  useEffect(() => {
    const detak = setInterval(() => setJam(jamSekarang()), 1000);
    return () => clearInterval(detak);
  }, []);

  const kelompok = useMemo(() => {
    const dipanggil = baris
      .filter((x) => x.keadaan === "dipanggil" && x.nomor !== null)
      .sort((a, b) => Number(a.nomor) - Number(b.nomor));
    const menunggu = baris
      .filter((x) => x.keadaan === "menunggu" && x.nomor !== null)
      .sort((a, b) => Number(a.nomor) - Number(b.nomor));
    return { dipanggil, menunggu };
  }, [baris]);

  const terakhir = kelompok.dipanggil[kelompok.dipanggil.length - 1] || null;
  const berikutnya = kelompok.menunggu[0] || null;
  const warna = warnaRuang(terakhir?.noRuang ?? (ruang || null));
  const laju = useMemo(() => selangPanggilan(baris), [baris]);

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0c10] text-slate-100">
      <header className="flex items-baseline justify-between px-5 pt-5">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Antrian Sidang</p>
        <p className="font-mono text-lg tabular-nums text-slate-400">{jam}</p>
      </header>

      {/* Pemilih ruang paling atas: dipilih sekali, lalu dibiarkan. */}
      <div className="flex gap-1.5 overflow-x-auto px-5 pt-4">
        {[0, 1, 2, 3, 4].map((nomor) => {
          const w = warnaRuang(nomor);
          const aktif = ruang === nomor;
          return (
            <button
              key={`r-${nomor}`}
              type="button"
              onClick={() => setRuang(nomor)}
              className={[
                "whitespace-nowrap rounded-full border px-4 py-2 text-sm transition",
                aktif ? "border-slate-500 text-slate-100" : "border-slate-800 text-slate-500",
              ].join(" ")}
              style={aktif && nomor > 0 ? { borderColor: w.aksen, color: w.aksen } : undefined}
            >
              {nomor === 0 ? "Semua" : `Ruang ${nomor}`}
            </button>
          );
        })}
      </div>

      {/* Sedang dipanggil - satu angka menguasai layar. */}
      <section className="flex flex-1 flex-col items-center justify-center px-5">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Sedang dipanggil</p>
        <p
          className="mt-1 font-mono text-[30vw] font-semibold leading-[0.85] tabular-nums sm:text-[12rem]"
          style={{ color: terakhir ? warna.aksen : "#334155" }}
        >
          {terakhir ? terakhir.nomor : "—"}
        </p>
        {terakhir?.noRuang ? (
          <p className="mt-2 text-lg text-slate-400">Ruang Sidang {terakhir.noRuang}</p>
        ) : null}
        {terakhir?.jamPanggil ? (
          <p className="text-sm text-slate-600">dipanggil {terakhir.jamPanggil}</p>
        ) : null}
      </section>

      {/* Berikutnya dan sisanya - cukup untuk memutuskan perlu bergegas atau tidak. */}
      <section className="border-t border-slate-800/80 px-5 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Berikutnya</p>
            <p className="mt-1 font-mono text-5xl font-medium tabular-nums text-slate-200">
              {berikutnya ? berikutnya.nomor : "—"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Menunggu</p>
            <p className="mt-1 font-mono text-5xl font-light tabular-nums text-slate-400">
              {kelompok.menunggu.length}
            </p>
          </div>
        </div>

        {kelompok.menunggu.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {kelompok.menunggu.slice(1, 13).map((satu) => (
              <span
                key={`tunggu-${satu.nomor}`}
                className="rounded-lg border border-slate-800 px-2.5 py-1 font-mono text-base tabular-nums text-slate-500"
              >
                {satu.nomor}
                {ruang === 0 && satu.noRuang ? (
                  <span className="ml-1 text-[0.65rem] text-slate-600">R{satu.noRuang}</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          {laju !== null ? (
            <span className="text-slate-600">
              Rata-rata <span className="text-slate-400">{laju} menit</span> per perkara hari ini
            </span>
          ) : (
            <span />
          )}
          {pesan ? <span className="text-amber-400/80">{pesan}</span> : null}
        </div>
      </section>
    </main>
  );
}
