"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiPath } from "@/lib/base-path";
import {
  type BarisAntrian,
  jamSekarang,
  perkiraanTunggu,
  selangPanggilan,
  tanggalPanjang,
  warnaRuang,
} from "@/lib/antrian-tampilan";

/**
 * ============================================================================
 * LAYAR ANTRIAN SIDANG - TELEVISI RUANG TUNGGU
 * ============================================================================
 *
 * Dibaca dari lima sampai sepuluh meter, oleh orang yang berdiri, kerap sambil
 * cemas, dan hampir selalu hanya melirik. Maka satu angka menguasai layar dan
 * segala yang lain mengalah kepadanya.
 *
 * ============================================================================
 * MENGAPA GELAP DAN NYARIS KOSONG
 * ============================================================================
 *
 * Layar antrian lazimnya dipenuhi latar berfoto, bilah berwarna, dan tulisan
 * berjalan - dan hasilnya nomor yang justru paling penting harus bersaing
 * dengan seluruh isi layar. Di sini kebalikannya: latar hampir hitam, satu
 * warna aksen per ruang, dan ruang kosong dibiarkan kosong.
 *
 * Yang menuntun mata bukan garis dan kotak, melainkan URUTAN UKURAN. Nomor
 * yang dipanggil paling besar; berikutnya jauh lebih kecil; yang sudah lewat
 * nyaris memudar.
 *
 * ============================================================================
 * TIGA HAL YANG TIDAK DIMILIKI LAYAR ANTRIAN BIASA
 * ============================================================================
 *
 * 1. PERKIRAAN WAKTU TUNGGU, dihitung dari laju panggilan HARI INI - bukan
 *    angka tetap yang meleset pada hari padat. Bila lajunya belum dapat
 *    diukur, angkanya tidak ditampilkan sama sekali.
 *
 * 2. YANG BARU SAJA LEWAT tetap terlihat, memudar. Orang yang baru kembali
 *    dari kamar kecil dapat memastikan nomornya sudah lewat atau belum tanpa
 *    bertanya kepada petugas.
 *
 * 3. WARNA PER RUANG yang sama di seluruh layar ALETA, sehingga mencari
 *    ruangan selesai dalam sekali lihat. Warnanya tidak pernah menjadi
 *    satu-satunya pembeda - nomor ruangnya selalu ikut tertulis.
 *
 * ============================================================================
 * SUARANYA DARI PERAMBAN
 * ============================================================================
 *
 * Web Speech API bawaan peramban: tanpa berkas suara, tanpa layanan luar,
 * tanpa internet - televisi ruang tunggu berada di jaringan lokal. Berbunyi
 * hanya karena PERPINDAHAN keadaan, dan hanya sesudah dinyalakan sekali;
 * peramban memang menuntut sentuhan orang lebih dulu, dan itu kebetulan aturan
 * yang bagus.
 */

type Baris = BarisAntrian & { nomor: number | null; noRuang: number | null };

const SELANG_MS = 8000;

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
  window.speechSynthesis.speak(suara);
}

export default function AntrianLayarPage() {
  const [baris, setBaris] = useState<Baris[]>([]);
  const [ruang, setRuang] = useState(0);
  const [suaraNyala, setSuaraNyala] = useState(false);
  const [jam, setJam] = useState("");
  const [pesan, setPesan] = useState("");
  const [berkedip, setBerkedip] = useState(false);

  const sudahDiucapkan = useRef<Set<number>>(new Set());
  const pertamaKali = useRef(true);
  const nomorTerakhir = useRef<number | null>(null);

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
    const detak = setInterval(() => setJam(jamSekarang(true)), 1000);
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

  const terbaru = kelompok.dipanggil[kelompok.dipanggil.length - 1] || null;
  const warna = warnaRuang(terbaru?.noRuang);
  const laju = useMemo(() => selangPanggilan(baris), [baris]);

  // Kedipan sekali saat nomornya berganti. Orang yang kebetulan sedang
  // menunduk tetap menangkap perubahannya lewat sudut mata.
  useEffect(() => {
    const nomor = terbaru?.nomor ?? null;
    if (nomor === nomorTerakhir.current) return;
    nomorTerakhir.current = nomor;
    if (nomor === null) return;
    setBerkedip(true);
    const jeda = setTimeout(() => setBerkedip(false), 1200);
    return () => clearTimeout(jeda);
  }, [terbaru]);

  useEffect(() => {
    if (!suaraNyala) return;

    // Muatan pertama sesudah suara dinyalakan tidak diucapkan seluruhnya -
    // yang sudah dipanggil sejak pagi tidak perlu dibacakan ulang sekaligus.
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

  return (
    <main className="flex min-h-screen flex-col bg-[#0a0c10] text-slate-100">
      {/* ── kepala: identitas mengalah, jam yang menonjol ─────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-8 pt-6">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Antrian Sidang</p>
          <h1 className="mt-0.5 text-xl font-medium text-slate-300">
            Pengadilan Agama Donggala
          </h1>
        </div>

        <div className="text-right">
          <p className="font-mono text-5xl font-light leading-none tabular-nums text-slate-200">
            {jam}
          </p>
          <p className="mt-1 text-sm text-slate-500">{tanggalPanjang()}</p>
        </div>
      </header>

      {/* ── nomor yang sedang dipanggil ───────────────────────────────────── */}
      <section className="flex flex-1 flex-col items-center justify-center px-8">
        <p className="text-base uppercase tracking-[0.4em] text-slate-500">Sedang dipanggil</p>

        <div
          className={[
            "mt-2 flex items-baseline justify-center transition-opacity duration-500",
            berkedip ? "opacity-40" : "opacity-100",
          ].join(" ")}
        >
          <span
            className="font-mono text-[22vw] font-semibold leading-[0.85] tabular-nums sm:text-[16rem]"
            style={{ color: terbaru ? warna.aksen : "#334155" }}
          >
            {terbaru ? terbaru.nomor : "—"}
          </span>
        </div>

        {terbaru?.noRuang ? (
          <p className="mt-4 text-3xl font-light text-slate-300">
            Ruang Sidang{" "}
            <span className="font-medium" style={{ color: warna.aksen }}>
              {terbaru.noRuang}
            </span>
          </p>
        ) : (
          <p className="mt-4 text-2xl font-light text-slate-600">
            {baris.length === 0 ? "Belum ada antrian hari ini" : "Menunggu panggilan berikutnya"}
          </p>
        )}
      </section>

      {/* ── berikutnya, dengan perkiraan tunggunya ────────────────────────── */}
      <section className="px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-800/80 pt-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
              Berikutnya · {kelompok.menunggu.length} menunggu
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {kelompok.menunggu.length === 0 ? (
                <span className="text-2xl text-slate-700">—</span>
              ) : (
                kelompok.menunggu.slice(0, 8).map((satu, urutan) => {
                  const w = warnaRuang(satu.noRuang);
                  const perkiraan =
                    urutan === 0 ? perkiraanTunggu(baris, satu.nomor, { ruang: ruang || null }) : null;

                  return (
                    <div
                      key={`tunggu-${satu.nomor}`}
                      className={[
                        "rounded-2xl border px-5 py-3",
                        urutan === 0 ? "border-slate-600 bg-slate-900/70" : "border-slate-800/70",
                      ].join(" ")}
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className="font-mono text-4xl font-medium tabular-nums"
                          style={{ color: urutan === 0 ? w.aksen : "#64748b" }}
                        >
                          {satu.nomor}
                        </span>
                        {satu.noRuang ? (
                          <span className="text-sm text-slate-500">R{satu.noRuang}</span>
                        ) : null}
                      </div>
                      {/* Perkiraan hanya untuk yang paling depan. Menampilkannya
                          pada seluruh nomor mengubah papan pengumuman menjadi
                          tabel, dan tidak ada yang membaca tabel dari jauh. */}
                      {perkiraan ? (
                        <p className="mt-0.5 text-xs text-slate-500">{perkiraan.kalimat}</p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Laju hari ini - keterangan yang membuat perkiraan di atas dapat
              dipercaya, sebab dasarnya disebutkan. */}
          {laju !== null ? (
            <p className="text-sm text-slate-600">
              Rata-rata <span className="text-slate-400">{laju} menit</span> per perkara hari ini
            </p>
          ) : null}
        </div>
      </section>

      {/* ── yang baru saja lewat ──────────────────────────────────────────── */}
      {kelompok.dipanggil.length > 1 ? (
        <section className="px-8 pt-5">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-600">Baru saja dipanggil</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {kelompok.dipanggil
              .slice(0, -1)
              .reverse()
              .slice(0, 10)
              .map((satu) => (
                <span
                  key={`lewat-${satu.nomor}`}
                  className="rounded-lg px-3 py-1 font-mono text-xl tabular-nums text-slate-600"
                >
                  {satu.nomor}
                </span>
              ))}
          </div>
        </section>
      ) : null}

      {/* ── kaki: penyaring ruang dan saklar suara, sengaja paling redup ──── */}
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 px-8 py-4">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((nomor) => {
            const w = warnaRuang(nomor);
            const aktif = ruang === nomor;
            return (
              <button
                key={`ruang-${nomor}`}
                type="button"
                onClick={() => setRuang(nomor)}
                className={[
                  "rounded-full border px-4 py-1.5 text-sm transition",
                  aktif ? "border-slate-500 text-slate-100" : "border-slate-800 text-slate-500",
                ].join(" ")}
                style={aktif && nomor > 0 ? { borderColor: w.aksen, color: w.aksen } : undefined}
              >
                {nomor === 0 ? "Semua ruang" : `Ruang ${nomor}`}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {pesan ? <span className="text-sm text-amber-400/80">{pesan}</span> : null}
          <button
            type="button"
            onClick={() => {
              setSuaraNyala((nyala) => !nyala);
              // Sekali bunyi saat dinyalakan: peramban menuntut sentuhan orang
              // sebelum boleh bersuara, dan petugas perlu bukti bahwa pengeras
              // suaranya memang hidup.
              if (!suaraNyala) ucapkan(0, null);
            }}
            className={[
              "rounded-full border px-4 py-1.5 text-sm transition",
              suaraNyala
                ? "border-emerald-600 text-emerald-300"
                : "border-slate-800 text-slate-500 hover:text-slate-300",
            ].join(" ")}
            title="Peramban menuntut satu sentuhan sebelum boleh mengeluarkan suara."
          >
            {suaraNyala ? "Suara nyala" : "Nyalakan suara"}
          </button>
        </div>
      </footer>
    </main>
  );
}
