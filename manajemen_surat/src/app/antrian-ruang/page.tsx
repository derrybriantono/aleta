"use client";

import { useCallback, useEffect, useState } from "react";

import { apiPath } from "@/lib/base-path";

/**
 * ============================================================================
 * ANTRIAN PER RUANG - HALAMAN CEPAT PETUGAS SIDANG, TANPA LOGIN
 * ============================================================================
 *
 * Petugas sidang perlu melihat nomor yang sedang dipanggil di ruangannya tanpa
 * berhenti untuk login - kerap sambil berdiri, kerap dari ponsel, sepuluh
 * detik sebelum sidang dibuka. Menuntut login untuk melihat satu angka akan
 * membuat mereka berhenti memakainya dan kembali bertanya lewat pengeras
 * suara.
 *
 * Karena terbuka bagi siapa pun di jaringan pengadilan, yang ditampilkan hanya
 * sebanyak yang sudah tampil di televisi ruang tunggu: nomor, ruang, keadaan,
 * jam panggil. TIDAK ADA nomor perkara, nama pihak, maupun keterangan siapa
 * yang hadir - itu keterangan orang yang sedang berperkara, dan tempatnya di
 * balik login.
 *
 * Halaman ini memang sengaja tidak cukup untuk bekerja. Ia cukup untuk MELIHAT
 * giliran; selebihnya ada di portal, dan tautannya disebutkan di bawah.
 */

type Baris = {
  nomor: number | null;
  noRuang: number | null;
  keadaan: "menunggu" | "dipanggil" | "belum-ambil";
  jamPanggil: string;
};

const SELANG_MS = 10000;

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
      const respons = await fetch(alamat, { cache: "no-store" });
      const isi = (await respons.json()) as { data?: { baris?: Baris[]; message?: string } };
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
    const detak = setInterval(() => {
      setJam(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    }, 1000);
    return () => clearInterval(detak);
  }, []);

  const dipanggil = baris.filter((x) => x.keadaan === "dipanggil");
  const menunggu = baris.filter((x) => x.keadaan === "menunggu");
  const terakhir = dipanggil[dipanggil.length - 1] || null;

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-wide">ANTRIAN SIDANG</h1>
          <span className="font-mono text-lg tabular-nums text-slate-400">{jam}</span>
        </div>

        {/* Pemilih ruang - petugas membuka sekali lalu membiarkannya. */}
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((nomor) => (
            <button
              key={`ruang-${nomor}`}
              type="button"
              onClick={() => setRuang(nomor)}
              className={
                ruang === nomor
                  ? "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium"
                  : "rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300"
              }
            >
              {nomor === 0 ? "Semua ruang" : `Ruang ${nomor}`}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-6 text-center">
          <p className="text-sm uppercase tracking-widest text-emerald-300/70">Sedang dipanggil</p>
          <p className="mt-1 text-7xl font-bold leading-none tabular-nums text-emerald-300">
            {terakhir ? terakhir.nomor : "—"}
          </p>
          {terakhir?.noRuang ? (
            <p className="mt-1 text-lg text-emerald-100">Ruang Sidang {terakhir.noRuang}</p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-sm uppercase tracking-widest text-slate-400">
            Menunggu ({menunggu.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {menunggu.length === 0 ? (
              <span className="text-slate-500">—</span>
            ) : (
              menunggu.slice(0, 20).map((satu) => (
                <span
                  key={`tunggu-${satu.nomor}`}
                  className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xl font-semibold tabular-nums"
                >
                  {satu.nomor}
                  {ruang === 0 && satu.noRuang ? (
                    <span className="ml-1 align-middle text-xs font-normal text-slate-400">
                      R{satu.noRuang}
                    </span>
                  ) : null}
                </span>
              ))
            )}
          </div>
        </div>

        {pesan ? <p className="text-sm text-amber-300">{pesan}</p> : null}

        <p className="border-t border-slate-800 pt-3 text-sm text-slate-500">
          Halaman cepat tanpa login - hanya nomor, ruang, dan keadaannya. Nomor perkara, nama
          para pihak, dan keterangan kehadiran ada di portal ALETA;{" "}
          <a className="underline" href="/aleta-ecourt">
            masuk ke portal
          </a>{" "}
          untuk tampilan lengkap.
        </p>
      </div>
    </main>
  );
}
