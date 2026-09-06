"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiPath } from "@/lib/base-path";
import { jamSekarang, tanggalPanjang, warnaRuang } from "@/lib/antrian-tampilan";

/**
 * ============================================================================
 * PAPAN PINTU RUANG SIDANG
 * ============================================================================
 *
 * Dipasang di depan pintu ruang sidang, menghadap koridor. Yang membacanya
 * orang yang sudah dipanggil dan sedang mencari pintunya, atau yang menunggu
 * giliran berikutnya sambil berdiri di lorong.
 *
 * Maka isinya hanya DUA perkara - yang sedang bersidang dan yang berikutnya -
 * dan keduanya dibedakan tegas oleh ukuran. Papan yang memuat seluruh jadwal
 * ruangan akan dibaca sebagai daftar, dan daftar tidak dapat dibaca sambil
 * berjalan.
 *
 * ============================================================================
 * BEDANYA DENGAN LAYAR RUANG TUNGGU
 * ============================================================================
 *
 * Televisi ruang tunggu (/antrian-layar) menjawab "nomor berapa sekarang" dan
 * karena itu hanya menampilkan angka - ia menghadap ruangan berisi puluhan
 * orang yang perkaranya berbeda-beda.
 *
 * Papan ini menghadap SATU pintu. Orang yang berdiri di depannya sudah tahu
 * nomornya; yang ia perlukan kepastian bahwa ini benar ruangannya - dan itu
 * dijawab nomor perkara beserta nama para pihak, sepadan dengan yang sudah
 * terpampang di papan pengumuman pengadilan.
 *
 * ============================================================================
 * RUANGNYA DISEBUT DI ALAMAT
 * ============================================================================
 *
 *     /sidang-ruang?ruang=1
 *
 * Tanpa nomor ruang, papan ini tidak menampilkan apa pun - bukan menampilkan
 * seluruh ruangan. Lihat catatan pada src/app/api/sidang-ruang/route.ts.
 */

type Perkara = {
  nomorPerkara: string;
  jenisPerkara: string;
  jamSidang: string;
  nomorAntrian: number | null;
  jamPanggil: string;
  penggugat: string;
  tergugat: string;
  penghubung: string;
};

type Jawaban = {
  available: boolean;
  ruang: number | null;
  pesan: string;
  jumlahSidang?: number;
  sisaMenunggu?: number;
  sekarang: Perkara | null;
  berikutnya: Perkara | null;
};

const SELANG_MS = 8000;

export default function SidangRuangPage() {
  const [ruang, setRuang] = useState(0);
  const [data, setData] = useState<Jawaban | null>(null);
  const [jam, setJam] = useState("");
  const [berkedip, setBerkedip] = useState(false);
  const perkaraTerakhir = useRef<string>("");

  // Nomor ruang dibaca dari alamat, bukan dari pilihan di layar: papan ini
  // dipasang sekali menghadap satu pintu, dan tombol yang dapat ditekan orang
  // lewat akan memindahkannya ke ruangan yang salah.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dari = new URLSearchParams(window.location.search).get("ruang");
    setRuang(Number(dari) || 0);
  }, []);

  const ambil = useCallback(async (nomorRuang: number) => {
    if (nomorRuang <= 0) return;
    try {
      const r = await fetch(apiPath(`/api/sidang-ruang?ruang=${nomorRuang}`), { cache: "no-store" });
      const isi = (await r.json()) as { data?: Jawaban };
      setData((isi.data ?? isi) as Jawaban);
    } catch {
      setData({
        available: false,
        ruang: nomorRuang,
        pesan: "Papan ruang sidang belum dapat dibaca.",
        sekarang: null,
        berikutnya: null,
      });
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

  // Kedipan sekali saat perkaranya berganti - yang berdiri di lorong menangkap
  // perubahannya lewat sudut mata tanpa harus menatap papan terus-menerus.
  useEffect(() => {
    const kunci = data?.sekarang?.nomorPerkara || "";
    if (kunci === perkaraTerakhir.current) return;
    perkaraTerakhir.current = kunci;
    if (!kunci) return;
    setBerkedip(true);
    const jeda = setTimeout(() => setBerkedip(false), 1200);
    return () => clearTimeout(jeda);
  }, [data]);

  const warna = warnaRuang(ruang);

  if (ruang <= 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0c10] p-8 text-center text-slate-300">
        <div className="max-w-lg space-y-3">
          <h1 className="text-2xl font-medium">Papan Pintu Ruang Sidang</h1>
          <p className="text-slate-500">
            Sebutkan nomor ruangnya di alamat, misalnya{" "}
            <span className="font-mono text-slate-300">?ruang=1</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {[1, 2, 3, 4, 5].map((nomor) => {
              const w = warnaRuang(nomor);
              return (
                <a
                  key={nomor}
                  href={apiPath(`/sidang-ruang?ruang=${nomor}`)}
                  className="rounded-xl border px-5 py-3 text-lg transition hover:bg-slate-900"
                  style={{ borderColor: w.aksen, color: w.aksen }}
                >
                  Ruang {nomor}
                </a>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0c10] text-slate-100">
      {/* ── kepala: ruangnya, sebesar mungkin - itu yang dicari dari lorong ── */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 px-10 py-5">
        <div className="flex items-baseline gap-4">
          <span
            className="rounded-2xl px-5 py-2 text-4xl font-semibold"
            style={{ backgroundColor: warna.aksen, color: "#0a0c10" }}
          >
            RUANG {ruang}
          </span>
          <span className="text-lg text-slate-500">Pengadilan Agama Donggala</span>
        </div>

        <div className="text-right">
          <p className="font-mono text-4xl font-light tabular-nums text-slate-300">{jam}</p>
          <p className="text-sm text-slate-600">{tanggalPanjang()}</p>
        </div>
      </header>

      {/* ── yang sedang bersidang ─────────────────────────────────────────── */}
      <section
        className={[
          "flex flex-1 flex-col justify-center px-10 transition-opacity duration-500",
          berkedip ? "opacity-40" : "opacity-100",
        ].join(" ")}
      >
        <p className="text-base uppercase tracking-[0.4em] text-slate-500">Sedang bersidang</p>

        {data?.sekarang ? (
          <>
            <div className="mt-3 flex flex-wrap items-baseline gap-6">
              <h1
                className="text-6xl font-semibold leading-tight"
                style={{ color: warna.aksen }}
              >
                {data.sekarang.nomorPerkara}
              </h1>
              {data.sekarang.nomorAntrian ? (
                <span className="rounded-xl border border-slate-700 px-4 py-1.5 font-mono text-2xl tabular-nums text-slate-300">
                  No. antrian {data.sekarang.nomorAntrian}
                </span>
              ) : null}
            </div>

            <p className="mt-5 text-4xl font-light leading-snug text-slate-200">
              {data.sekarang.penggugat || "—"}
              {data.sekarang.tergugat ? (
                <>
                  <span className="mx-3 text-2xl italic text-slate-500">
                    {data.sekarang.penghubung}
                  </span>
                  {data.sekarang.tergugat}
                </>
              ) : null}
            </p>

            <p className="mt-4 text-xl text-slate-500">
              {[data.sekarang.jenisPerkara, data.sekarang.jamSidang].filter(Boolean).join(" · ")}
              {data.sekarang.jamPanggil ? ` · dipanggil ${data.sekarang.jamPanggil}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-4 text-5xl font-light text-slate-700">
            {data?.jumlahSidang === 0
              ? "Tidak ada sidang di ruang ini hari ini"
              : "Belum ada yang dipanggil"}
          </p>
        )}
      </section>

      {/* ── berikutnya, jauh lebih kecil ──────────────────────────────────── */}
      <section className="border-t border-slate-800/80 px-10 py-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-600">Berikutnya</p>

            {data?.berikutnya ? (
              <>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-4">
                  <p className="text-3xl font-medium text-slate-300">
                    {data.berikutnya.nomorPerkara}
                  </p>
                  {data.berikutnya.nomorAntrian ? (
                    <span className="font-mono text-xl tabular-nums text-slate-500">
                      No. antrian {data.berikutnya.nomorAntrian}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xl font-light text-slate-500">
                  {data.berikutnya.penggugat || "—"}
                  {data.berikutnya.tergugat ? (
                    <>
                      <span className="mx-2 text-base italic text-slate-600">
                        {data.berikutnya.penghubung}
                      </span>
                      {data.berikutnya.tergugat}
                    </>
                  ) : null}
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-2xl font-light text-slate-700">
                Tidak ada antrian berikutnya
              </p>
            )}
          </div>

          {typeof data?.sisaMenunggu === "number" && data.sisaMenunggu > 0 ? (
            <div className="text-right">
              <p className="font-mono text-4xl font-light tabular-nums text-slate-400">
                {data.sisaMenunggu}
              </p>
              <p className="text-sm text-slate-600">masih menunggu</p>
            </div>
          ) : null}
        </div>

        {data?.pesan ? <p className="mt-3 text-base text-amber-400/80">{data.pesan}</p> : null}
      </section>
    </main>
  );
}
