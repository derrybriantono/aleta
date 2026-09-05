"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiPath } from "@/lib/base-path";

/**
 * ============================================================================
 * LAYAR ANTRIAN SIDANG - TELEVISI RUANG TUNGGU, TAB, DAN PERAMBAN MANA PUN
 * ============================================================================
 *
 * Tanpa login, sebab yang membacanya orang yang sedang menunggu - bukan
 * pegawai. Layar ini dipasang di televisi ruang tunggu, dibuka di tab yang
 * diletakkan di meja informasi, dan dapat dibuka sendiri oleh pihak dari
 * ponselnya selama berada di jaringan pengadilan.
 *
 * ============================================================================
 * YANG BOLEH TAMPIL DI SINI HANYA ANGKA
 * ============================================================================
 *
 * Nomor, ruang, keadaan, jam panggil. TIDAK ADA nomor perkara, nama pihak,
 * maupun keterangan kehadiran - layar ini menghadap ruang tunggu umum, dan
 * nama orang yang sedang berperkara bukan keterangan yang perlu terbaca
 * seisi ruangan.
 *
 * Pembatasan itu ditegakkan di RUTE-nya (/api/antrian-ruang), bukan di sini.
 * Layar yang menyaring sendiri akan bocor begitu ada yang membuka alamat
 * rutenya langsung.
 *
 * ============================================================================
 * SUARANYA DARI PERAMBAN, BUKAN DARI SERVER
 * ============================================================================
 *
 * Memakai pengucap bawaan peramban (Web Speech API): tidak ada berkas suara
 * yang diunduh, tidak ada layanan luar yang dihubungi, dan tidak ada internet
 * yang diperlukan - penting, sebab televisi ruang tunggu berada di jaringan
 * lokal tanpa jalan keluar.
 *
 * Suara HANYA berbunyi karena PERPINDAHAN keadaan - nomor yang baru berubah
 * menjadi "dipanggil" - dan hanya sesudah seseorang menyalakannya sekali.
 * Peramban memang menuntut sentuhan orang sebelum boleh bersuara, dan itu
 * kebetulan aturan yang bagus: layar yang tiba-tiba berbicara sendiri sesudah
 * dimuat ulang akan mengagetkan seisi ruangan.
 *
 * Muatan pertama sesudah suara dinyalakan TIDAK diucapkan seluruhnya. Tanpa
 * itu, menyalakan suara pada pukul sebelas akan membacakan ulang seluruh
 * nomor yang sudah dipanggil sejak pagi, berturut-turut.
 */

type Baris = {
  nomor: number | null;
  noRuang: number | null;
  keadaan: "menunggu" | "dipanggil" | "belum-ambil";
  jamPanggil: string;
};

/** Ruang tunggu perlu cepat, tetapi tidak perlu tiap detik. */
const SELANG_MS = 10000;

function ucapkan(nomor: number, ruang: number | null) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const kalimat =
    ruang && ruang > 0
      ? `Nomor antrian ${nomor}, silakan menuju ruang sidang ${ruang}.`
      : `Nomor antrian ${nomor}, silakan memasuki ruang sidang.`;

  const suara = new SpeechSynthesisUtterance(kalimat);
  suara.lang = "id-ID";
  // Pelan dan rata: pengeras suara ruang tunggu memantul, dan kalimat yang
  // diucapkan cepat berubah menjadi bunyi yang tidak dapat dibedakan.
  suara.rate = 0.85;
  suara.pitch = 1;
  // Diantre, bukan ditimpa. Dua nomor yang berpindah bersamaan harus terdengar
  // dua kali - yang tertimpa berarti ada orang yang tidak pernah dipanggil.
  window.speechSynthesis.speak(suara);
}

export default function AntrianLayarPage() {
  const [baris, setBaris] = useState<Baris[]>([]);
  const [ruang, setRuang] = useState(0);
  const [suaraNyala, setSuaraNyala] = useState(false);
  const [jam, setJam] = useState("");
  const [pesan, setPesan] = useState("");

  const sudahDiucapkan = useRef<Set<number>>(new Set());
  const pertamaKali = useRef(true);

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
    const detak = setInterval(() => {
      setJam(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, 1000);
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

  useEffect(() => {
    if (!suaraNyala) return;

    if (pertamaKali.current) {
      for (const satu of kelompok.dipanggil) {
        if (satu.nomor !== null) sudahDiucapkan.current.add(satu.nomor);
      }
      pertamaKali.current = false;
      return;
    }

    for (const satu of kelompok.dipanggil) {
      if (satu.nomor === null || sudahDiucapkan.current.has(satu.nomor)) continue;
      sudahDiucapkan.current.add(satu.nomor);
      ucapkan(satu.nomor, satu.noRuang);
    }
  }, [kelompok.dipanggil, suaraNyala]);

  const terbaru = kelompok.dipanggil[kelompok.dipanggil.length - 1] || null;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-800 pb-3">
          <h1 className="text-3xl font-bold tracking-wide">ANTRIAN SIDANG</h1>
          <span className="font-mono text-3xl tabular-nums text-slate-400">{jam}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[0, 1, 2, 3, 4].map((nomor) => (
            <button
              key={`ruang-${nomor}`}
              type="button"
              onClick={() => setRuang(nomor)}
              className={
                ruang === nomor
                  ? "rounded-lg bg-emerald-600 px-4 py-2 text-lg font-medium"
                  : "rounded-lg border border-slate-700 px-4 py-2 text-lg text-slate-300 hover:bg-slate-900"
              }
            >
              {nomor === 0 ? "Semua ruang" : `Ruang ${nomor}`}
            </button>
          ))}

          {/* Peramban menolak bersuara sebelum disentuh orang. Tombolnya
              disebut apa adanya supaya petugas tahu ia harus ditekan sekali
              setiap televisi dinyalakan. */}
          <button
            type="button"
            onClick={() => {
              setSuaraNyala((nyala) => !nyala);
              if (!suaraNyala) ucapkan(0, null);
            }}
            className={
              suaraNyala
                ? "ml-auto rounded-lg bg-emerald-700 px-4 py-2 text-lg"
                : "ml-auto rounded-lg border border-slate-700 px-4 py-2 text-lg text-slate-300 hover:bg-slate-900"
            }
            title="Peramban menuntut satu sentuhan sebelum boleh mengeluarkan suara."
          >
            {suaraNyala ? "Suara: nyala" : "Nyalakan suara"}
          </button>
        </div>

        <div className="rounded-3xl border border-emerald-800/50 bg-emerald-950/30 p-10 text-center">
          <p className="text-xl uppercase tracking-[0.3em] text-emerald-300/70">Sedang dipanggil</p>
          <p className="mt-2 text-[10rem] font-bold leading-none tabular-nums text-emerald-300">
            {terbaru ? terbaru.nomor : "—"}
          </p>
          {terbaru?.noRuang ? (
            <p className="mt-2 text-3xl text-emerald-100">Ruang Sidang {terbaru.noRuang}</p>
          ) : null}
        </div>

        <div>
          <p className="mb-3 text-lg uppercase tracking-widest text-slate-400">
            Menunggu ({kelompok.menunggu.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {kelompok.menunggu.length === 0 ? (
              <span className="text-2xl text-slate-500">—</span>
            ) : (
              kelompok.menunggu.slice(0, 24).map((satu) => (
                <span
                  key={`tunggu-${satu.nomor}`}
                  className="rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-4xl font-semibold tabular-nums"
                >
                  {satu.nomor}
                  {ruang === 0 && satu.noRuang ? (
                    <span className="ml-1 align-middle text-base font-normal text-slate-400">
                      R{satu.noRuang}
                    </span>
                  ) : null}
                </span>
              ))
            )}
          </div>
        </div>

        {kelompok.dipanggil.length > 1 ? (
          <div>
            <p className="mb-2 text-lg uppercase tracking-widest text-slate-400">Sudah dipanggil</p>
            <div className="flex flex-wrap gap-2">
              {kelompok.dipanggil
                .slice(0, -1)
                .reverse()
                .slice(0, 12)
                .map((satu) => (
                  <span
                    key={`panggil-${satu.nomor}`}
                    className="rounded-lg border border-slate-800 px-3 py-1.5 text-2xl tabular-nums text-slate-500"
                  >
                    {satu.nomor}
                  </span>
                ))}
            </div>
          </div>
        ) : null}

        {pesan ? <p className="text-lg text-amber-300">{pesan}</p> : null}

        <p className="border-t border-slate-800 pt-4 text-base text-slate-500">
          Belum mengambil nomor? Buka{" "}
          <a className="underline" href={apiPath("/antrian")}>
            halaman ambil antrian
          </a>{" "}
          atau kirim pesan ke WhatsApp ALETA.
        </p>
      </div>
    </main>
  );
}
