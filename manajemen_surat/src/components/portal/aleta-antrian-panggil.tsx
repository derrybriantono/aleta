"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PAPAN PANGGIL - UNTUK PETUGAS DI RUANG SIDANG
 * ============================================================================
 *
 * Satu ruang, satu layar, satu tombol besar. Petugas yang memanggil sedang
 * berdiri di depan pintu ruang sidang dengan berkas di tangan - ia tidak
 * sedang membaca tabel, dan tidak akan menekan tombol sebesar korek api.
 *
 * ============================================================================
 * YANG TIDAK DIMILIKI APLIKASI ANTRIAN: HITUNGAN PANGGILAN
 * ============================================================================
 *
 * Tabel antrian hanya menyimpan satu jam panggil, jadi ia tidak dapat menjawab
 * "sudah dipanggil berapa kali". Padahal aturannya sudah dijanjikan ALETA
 * kepada para pihak lewat WhatsApp: dipanggil tiga kali dan tidak hadir,
 * perkaranya ditunda.
 *
 * Selama ini hitungan itu dijaga ingatan petugas yang kebetulan berjaga sejak
 * pagi. Di sini ia terbaca oleh siapa pun yang membuka layar - termasuk
 * petugas pengganti yang baru masuk setelah istirahat.
 */

type AntrianBaris = {
  nomor: number | null;
  keadaan: "menunggu" | "dipanggil" | "belum-ambil";
  jamPanggil: string;
  noRuang: number | null;
  majelisKode: string;
  waktuAmbil: string;
  online: boolean;
};

type Kehadiran = { hadir: Array<{ sebutan: string; nama: string; jam: string }>; pertama: { sebutan: string } | null };
type Panggilan = { jumlah: number; batas: number; sudahBatas: boolean; panggilan: Array<{ urutan: number; jam: string; oleh: string }> };

type Jawaban = {
  available: boolean;
  message?: string;
  terbaca: boolean;
  alasan: string;
  tanggal: string[];
  peta: Record<string, AntrianBaris>;
  kehadiran?: Record<string, Kehadiran>;
  panggilan?: Record<string, Panggilan>;
};

const SELANG_MS = 10000;

export function AletaAntrianPanggil() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [ruang, setRuang] = useState(0);
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState("");

  const ambil = useCallback(async () => {
    try {
      const respons = await fetch(apiPath("/api/aleta-ecourt/antrian"), { cache: "no-store" });
      const isi = (await respons.json()) as { data?: Jawaban } | Jawaban;
      setData(("data" in isi && isi.data ? isi.data : isi) as Jawaban);
    } catch (error) {
      setPesan(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void ambil();
    const detak = setInterval(() => void ambil(), SELANG_MS);
    return () => clearInterval(detak);
  }, [ambil]);

  const baris = useMemo(() => {
    const semua = Object.entries(data?.peta || {}).map(([perkaraId, satu]) => ({
      perkaraId,
      ...satu,
      hadir: data?.kehadiran?.[perkaraId]?.hadir ?? [],
      panggilan: data?.panggilan?.[perkaraId] ?? null,
    }));

    const seruang = semua.filter((x) => (ruang > 0 ? Number(x.noRuang) === ruang : true));
    return {
      menunggu: seruang
        .filter((x) => x.keadaan === "menunggu" && x.nomor !== null)
        .sort((a, b) => Number(a.nomor) - Number(b.nomor)),
      dipanggil: seruang
        .filter((x) => x.keadaan === "dipanggil" && x.nomor !== null)
        .sort((a, b) => Number(a.nomor) - Number(b.nomor)),
    };
  }, [data, ruang]);

  const panggil = useCallback(
    async (satu: { perkaraId: string; nomor: number | null; noRuang: number | null }) => {
      setSibuk(satu.perkaraId);
      setPesan("");
      try {
        const respons = await fetch(apiPath("/api/aleta-ecourt/antrian/panggil"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perkaraId: satu.perkaraId,
            nomorAntrian: satu.nomor,
            noRuang: satu.noRuang,
          }),
        });
        const isi = (await respons.json()) as { data?: Record<string, unknown> };
        const hasil = (isi.data ?? isi) as { ok?: boolean; alasan?: string; keterangan?: string };
        setPesan(hasil.ok === false ? hasil.alasan || "Panggilan gagal." : hasil.keterangan || "Dipanggil.");
        await ambil();
      } catch (error) {
        setPesan(error instanceof Error ? error.message : String(error));
      } finally {
        setSibuk("");
      }
    },
    [ambil]
  );

  const berikutnya = baris.menunggu[0] || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Papan panggil</h2>
        <div className="flex flex-wrap gap-1">
          {[0, 1, 2, 3, 4].map((nomor) => (
            <button
              key={`r-${nomor}`}
              type="button"
              onClick={() => setRuang(nomor)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-sm",
                ruang === nomor ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {nomor === 0 ? "Semua ruang" : `Ruang ${nomor}`}
            </button>
          ))}
        </div>
      </div>

      {/* Antrian yang memuat lebih dari satu tanggal berarti tabelnya menyimpan
          sisa hari sebelumnya - dan nomornya patut diragukan, sebab rumus
          penomoran tidak menyaring tanggal. Keadaan itu selama ini dilaporkan
          bot tetapi tidak pernah ditampilkan di mana pun. */}
      {data && data.tanggal && data.tanggal.length > 1 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Antrian memuat {data.tanggal.length} tanggal ({data.tanggal.join(", ")}). Nomor antrian
          dihitung dari seluruh baris yang sudah diambil tanpa menyaring tanggal, sehingga nomor
          hari ini dapat melanjut dari sisa hari sebelumnya. Periksa aplikasi antrian.
        </div>
      ) : null}

      {data && data.terbaca === false ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {data.alasan || data.message || "Antrian belum dapat dibaca."}
        </div>
      ) : null}

      {pesan ? <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">{pesan}</div> : null}

      {/* --- yang berikutnya, dengan tombol sebesar mungkin --- */}
      {berikutnya ? (
        <div className="rounded-2xl border p-5">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">Berikutnya</p>
          <div className="mt-1 flex flex-wrap items-center gap-4">
            <span className="text-6xl font-bold tabular-nums">{berikutnya.nomor}</span>
            <div className="min-w-0 flex-1 text-sm">
              <div>
                {berikutnya.noRuang ? `Ruang Sidang ${berikutnya.noRuang}` : "Ruang belum ditetapkan"}
                {berikutnya.majelisKode ? ` · Majelis ${berikutnya.majelisKode}` : ""}
              </div>
              <div className="text-muted-foreground">
                {berikutnya.hadir.length > 0
                  ? `Hadir: ${berikutnya.hadir.map((x) => x.sebutan).join(", ")}`
                  : "Belum ada keterangan kehadiran"}
              </div>
            </div>
            <Button
              className="h-14 px-8 text-lg"
              disabled={sibuk === berikutnya.perkaraId}
              onClick={() => void panggil(berikutnya)}
            >
              {sibuk === berikutnya.perkaraId ? "Memanggil…" : "Panggil"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Tidak ada yang menunggu di pilihan ruang ini.</p>
      )}

      {/* --- sudah dipanggil, beserta hitungannya --- */}
      {baris.dipanggil.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">
            Sudah dipanggil ({baris.dipanggil.length})
          </h3>
          <div className="space-y-1">
            {baris.dipanggil
              .slice()
              .reverse()
              .map((satu) => (
                <div
                  key={satu.perkaraId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="w-12 text-2xl font-bold tabular-nums">{satu.nomor}</span>
                  <span className="min-w-0 flex-1">
                    {satu.noRuang ? `Ruang ${satu.noRuang}` : "Ruang —"}
                    {satu.jamPanggil ? ` · ${satu.jamPanggil}` : ""}
                    {satu.hadir.length > 0 ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {satu.hadir.map((x) => x.sebutan).join(", ")}
                      </span>
                    ) : null}
                  </span>

                  {/* Hitungan panggilan - inilah yang tidak dimiliki aplikasi
                      antrian, dan yang menentukan apakah perkara patut
                      ditunda. */}
                  {satu.panggilan && satu.panggilan.jumlah > 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-sm font-medium",
                        satu.panggilan.sudahBatas
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                          : "bg-muted text-muted-foreground"
                      )}
                      title={satu.panggilan.panggilan
                        .map((p) => `ke-${p.urutan} ${p.jam}${p.oleh ? ` oleh ${p.oleh}` : ""}`)
                        .join(" · ")}
                    >
                      {satu.panggilan.jumlah}/{satu.panggilan.batas} panggilan
                    </span>
                  ) : null}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sibuk === satu.perkaraId}
                    onClick={() => void panggil(satu)}
                  >
                    {sibuk === satu.perkaraId ? "…" : "Panggil ulang"}
                  </Button>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {/* --- sisa yang menunggu --- */}
      {baris.menunggu.length > 1 ? (
        <div>
          <h3 className="mb-2 text-sm uppercase tracking-widest text-muted-foreground">
            Menunggu berikutnya
          </h3>
          <div className="flex flex-wrap gap-2">
            {baris.menunggu.slice(1, 16).map((satu) => (
              <span
                key={satu.perkaraId}
                className="rounded-lg border px-3 py-1.5 text-lg font-semibold tabular-nums"
                title={satu.hadir.map((x) => x.sebutan).join(", ")}
              >
                {satu.nomor}
                {ruang === 0 && satu.noRuang ? (
                  <span className="ml-1 align-middle text-xs font-normal text-muted-foreground">
                    R{satu.noRuang}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
