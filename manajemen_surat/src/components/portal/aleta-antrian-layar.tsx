"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * LAYAR ANTRIAN SIDANG
 * ============================================================================
 *
 * Dipasang di televisi ruang tunggu. Yang membacanya orang yang berdiri
 * beberapa meter jauhnya, kerap sambil berdiri, kerap sudah cemas - jadi
 * hurufnya besar, isinya sedikit, dan yang paling menentukan diletakkan paling
 * atas: NOMOR YANG SEDANG DIPANGGIL.
 *
 * ============================================================================
 * ONLINE DAN OFFLINE SATU DERET
 * ============================================================================
 *
 * Antrian dapat diambil dua cara - lewat WhatsApp ALETA sebelum berangkat,
 * atau di mesin antrian ruang tunggu setelah tiba. Keduanya masuk deret yang
 * SAMA, diurut menurut waktu pengambilan. Yang mengambil lebih dulu bernomor
 * lebih kecil, dari mana pun ia mengambilnya.
 *
 * Asalnya tetap ditandai di layar - lencana "WhatsApp" atau "Mesin" - sebab
 * petugas perlu tahu apakah orangnya sudah ada di ruangan atau baru mengambil
 * dari rumah. Tetapi itu KETERANGAN, bukan urutan.
 *
 * ============================================================================
 * SUARANYA DARI PERAMBAN, BUKAN DARI SERVER
 * ============================================================================
 *
 * Panggilan suara memakai pengucap bawaan peramban (Web Speech API). Tidak ada
 * berkas suara yang diunduh, tidak ada layanan luar yang dihubungi, dan tidak
 * ada internet yang diperlukan - penting, sebab televisi ruang tunggu di
 * pengadilan ini berada di jaringan lokal.
 *
 * Suara HANYA berbunyi karena perubahan keadaan yang benar-benar terjadi -
 * nomor yang baru berpindah menjadi "dipanggil" - dan hanya sesudah petugas
 * menyalakannya sekali. Peramban memang menuntut sentuhan orang sebelum boleh
 * bersuara, dan itu kebetulan aturan yang bagus: layar yang tiba-tiba
 * berbicara sendiri sesudah dimuat ulang akan mengagetkan seisi ruangan.
 */

type AntrianBaris = {
  nomor: number | null;
  tanggalSidang: string;
  waktuAmbil: string;
  online: boolean;
  pihak1: string;
  pihak2: string;
  saksi: string;
  keadaan: "menunggu" | "dipanggil" | "belum-ambil";
  jamPanggil: string;
  noRuang: number | null;
  ruanganId: number | null;
  namaPetugas: string;
  majelisKode: string;
};

type KehadiranBaris = { sebutan: string; nama: string; jam: string };

type Jawaban = {
  available: boolean;
  message?: string;
  terbaca: boolean;
  alasan: string;
  tanggal: string[];
  jumlahDiambil: number;
  peta: Record<string, AntrianBaris>;
  /**
   * Siapa yang hadir pada tiap perkara. Yang PERTAMA hadir menentukan nomor
   * antriannya, dan itu yang paling sering ditanya petugas.
   *
   * Boleh tidak ada - bot versi lama belum mengirimkannya.
   */
  kehadiran?: Record<string, { hadir: KehadiranBaris[]; pertama: KehadiranBaris | null }>;
};

/** Selang penyegaran. Ruang tunggu perlu cepat, tetapi tidak perlu tiap detik. */
const SELANG_MS = 15000;

function ucapkanNomor(nomor: number, ruang: number | null) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const kalimat =
    ruang && ruang > 0
      ? `Nomor antrian ${nomor}, silakan menuju ruang sidang ${ruang}.`
      : `Nomor antrian ${nomor}, silakan memasuki ruang sidang.`;

  const suara = new SpeechSynthesisUtterance(kalimat);
  suara.lang = "id-ID";
  // Pelan dan agak rendah: pengeras suara ruang tunggu memantul, dan kalimat
  // yang diucapkan cepat berubah menjadi bunyi yang tidak dapat dibedakan.
  suara.rate = 0.9;
  suara.pitch = 1;

  // Antre, bukan menimpa. Dua nomor yang berpindah bersamaan harus terdengar
  // dua kali - yang tertimpa berarti ada orang yang tidak pernah dipanggil.
  window.speechSynthesis.speak(suara);
}

export function AletaAntrianLayar() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [galat, setGalat] = useState("");
  const [suaraNyala, setSuaraNyala] = useState(false);
  const [jam, setJam] = useState("");

  // Nomor yang SUDAH pernah diucapkan. Tanpa ini, tiap penyegaran akan
  // mengucapkan ulang seluruh nomor yang sedang dipanggil - lima belas detik
  // sekali, tanpa henti.
  const sudahDiucapkan = useRef<Set<number>>(new Set());
  const pertamaKali = useRef(true);

  const ambil = useCallback(async () => {
    try {
      const respons = await fetch(apiPath("/api/aleta-ecourt/antrian"), { cache: "no-store" });
      const isi = (await respons.json()) as { data?: Jawaban } | Jawaban;
      const hasil = ("data" in isi && isi.data ? isi.data : isi) as Jawaban;
      setData(hasil);
      setGalat("");
    } catch (error) {
      setGalat(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void ambil();
    const detak = setInterval(() => void ambil(), SELANG_MS);
    return () => clearInterval(detak);
  }, [ambil]);

  useEffect(() => {
    const detak = setInterval(() => {
      setJam(
        new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    }, 1000);
    return () => clearInterval(detak);
  }, []);

  const baris = useMemo(() => {
    const semua = Object.entries(data?.peta || {}).map(([perkaraId, satu]) => ({
      ...satu,
      // Sebutan yang PERTAMA hadir - "Penggugat I", "Kuasa Tergugat II".
      // Namanya sengaja TIDAK dibawa ke layar ini: televisi ini menghadap
      // ruang tunggu umum, dan nama orang yang sedang berperkara bukan
      // keterangan yang perlu terbaca seisi ruangan.
      hadirPertama: data?.kehadiran?.[perkaraId]?.pertama?.sebutan || "",
    }));
    return {
      dipanggil: semua
        .filter((x) => x.keadaan === "dipanggil" && x.nomor !== null)
        .sort((a, b) => (a.nomor || 0) - (b.nomor || 0)),
      menunggu: semua
        .filter((x) => x.keadaan === "menunggu" && x.nomor !== null)
        .sort((a, b) => (a.nomor || 0) - (b.nomor || 0)),
      belumAmbil: semua.filter((x) => x.keadaan === "belum-ambil").length,
    };
  }, [data]);

  // Suara berbunyi karena PERPINDAHAN keadaan, bukan karena adanya baris.
  useEffect(() => {
    if (!suaraNyala) return;

    // Muatan pertama sesudah suara dinyalakan tidak diucapkan seluruhnya -
    // yang sudah dipanggil sejak pagi tidak perlu dipanggil ulang sekaligus.
    if (pertamaKali.current) {
      for (const satu of baris.dipanggil) {
        if (satu.nomor !== null) sudahDiucapkan.current.add(satu.nomor);
      }
      pertamaKali.current = false;
      return;
    }

    for (const satu of baris.dipanggil) {
      if (satu.nomor === null || sudahDiucapkan.current.has(satu.nomor)) continue;
      sudahDiucapkan.current.add(satu.nomor);
      ucapkanNomor(satu.nomor, satu.noRuang);
    }
  }, [baris.dipanggil, suaraNyala]);

  const terbaru = baris.dipanggil[baris.dipanggil.length - 1] || null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* --- kepala --- */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-800 pb-3">
          <h1 className="text-2xl font-semibold tracking-wide">ANTRIAN SIDANG</h1>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-mono tabular-nums text-slate-300">{jam}</span>
            <Button
              variant={suaraNyala ? "default" : "outline"}
              size="sm"
              onClick={() => setSuaraNyala((x) => !x)}
            >
              {suaraNyala ? "Suara menyala" : "Nyalakan suara"}
            </Button>
          </div>
        </div>

        {/* --- yang sedang dipanggil --- */}
        <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/40 p-6 text-center">
          <p className="text-sm uppercase tracking-widest text-emerald-300/80">Sedang dipanggil</p>
          {terbaru ? (
            <>
              <p className="mt-1 text-[8rem] font-bold leading-none tabular-nums text-emerald-300">
                {terbaru.nomor}
              </p>
              <p className="mt-2 text-2xl text-emerald-100">
                {terbaru.noRuang ? `Ruang Sidang ${terbaru.noRuang}` : "Ruang sidang belum ditetapkan"}
                {terbaru.majelisKode ? ` · Majelis ${terbaru.majelisKode}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-3 text-3xl text-emerald-100/70">Belum ada yang dipanggil</p>
          )}
        </div>

        {/* --- keadaan sambungan --- */}
        {galat || data?.available === false || data?.terbaca === false ? (
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            {galat || data?.message || data?.alasan || "Antrian belum dapat dibaca."} Layar tetap
            menampilkan pembacaan terakhir yang berhasil.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* --- sudah dipanggil --- */}
          <div>
            <h2 className="mb-2 text-sm uppercase tracking-widest text-slate-400">
              Sudah dipanggil ({baris.dipanggil.length})
            </h2>
            <div className="space-y-1">
              {baris.dipanggil.length === 0 ? (
                <p className="text-slate-500">—</p>
              ) : (
                baris.dipanggil
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((satu) => <BarisAntrian key={`panggil-${satu.nomor}`} satu={satu} terang />)
              )}
            </div>
          </div>

          {/* --- menunggu --- */}
          <div>
            <h2 className="mb-2 text-sm uppercase tracking-widest text-slate-400">
              Menunggu ({baris.menunggu.length})
            </h2>
            <div className="space-y-1">
              {baris.menunggu.length === 0 ? (
                <p className="text-slate-500">—</p>
              ) : (
                baris.menunggu.slice(0, 12).map((satu) => (
                  <BarisAntrian key={`tunggu-${satu.nomor}`} satu={satu} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* --- kaki: keterangan yang sering ditanya --- */}
        <p className="border-t border-slate-800 pt-3 text-sm text-slate-500">
          Nomor antrian sama untuk yang mengambil lewat WhatsApp maupun di mesin ruang tunggu -
          satu deret, diurut menurut waktu pengambilan. Lencana hanya menandai asalnya.
          {baris.belumAmbil > 0
            ? ` ${baris.belumAmbil} perkara terjadwal hari ini belum diambil antriannya.`
            : ""}
        </p>
      </div>
    </div>
  );
}

function BarisAntrian({
  satu,
  terang = false,
}: {
  satu: AntrianBaris & { hadirPertama?: string };
  terang?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2",
        terang ? "border-emerald-800/50 bg-emerald-950/20" : "border-slate-800 bg-slate-900/40"
      )}
    >
      <span
        className={cn(
          "w-16 shrink-0 text-3xl font-bold tabular-nums",
          terang ? "text-emerald-300" : "text-slate-200"
        )}
      >
        {satu.nomor}
      </span>
      <span className="min-w-0 flex-1 text-sm text-slate-300">
        {satu.noRuang ? `Ruang ${satu.noRuang}` : "Ruang —"}
        {satu.majelisKode ? ` · Majelis ${satu.majelisKode}` : ""}
        {satu.jamPanggil ? ` · dipanggil ${satu.jamPanggil}` : ""}
        {/* Yang lebih dulu hadir menentukan nomor antrian perkara ini, dan
            itulah yang paling sering ditanya petugas: "yang datang duluan
            siapa, penggugat atau tergugat". */}
        {satu.hadirPertama ? (
          <span className="ml-1 text-slate-400">· {satu.hadirPertama} lebih dulu</span>
        ) : null}
      </span>
      {/* Asal pengambilan - keterangan bagi petugas, bukan urutan. */}
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
          satu.online ? "bg-sky-900/60 text-sky-200" : "bg-slate-800 text-slate-300"
        )}
        title={satu.online ? "Diambil lewat WhatsApp" : "Diambil di mesin ruang tunggu"}
      >
        {satu.online ? "WhatsApp" : "Mesin"}
      </span>
      <span className="w-14 shrink-0 text-right text-sm tabular-nums text-slate-500">
        {satu.waktuAmbil}
      </span>
    </div>
  );
}
