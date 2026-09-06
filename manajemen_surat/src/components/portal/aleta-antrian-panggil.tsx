"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiPath } from "@/lib/base-path";
import { selangPanggilan, warnaRuang } from "@/lib/antrian-tampilan";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * PAPAN PANGGIL - UNTUK PETUGAS DI RUANG SIDANG
 * ============================================================================
 *
 * Petugas yang memanggil sedang berdiri di depan pintu ruang sidang dengan
 * berkas di tangan. Ia tidak sedang membaca tabel, dan tidak akan menekan
 * tombol sebesar korek api.
 *
 * Maka SATU kartu besar menguasai layar - nomor berikutnya beserta tombolnya -
 * dan selebihnya mengalah. Yang sudah dipanggil turun menjadi baris tipis.
 *
 * ============================================================================
 * TIGA HAL YANG TIDAK DIMILIKI PAPAN PANGGIL BIASA
 * ============================================================================
 *
 * 1. HITUNGAN PANGGILAN. Tabel antrian hanya menyimpan satu jam panggil,
 *    sehingga ia tidak dapat menjawab "sudah dipanggil berapa kali". Padahal
 *    aturannya sudah dijanjikan kepada para pihak lewat WhatsApp: dipanggil
 *    tiga kali dan tidak hadir, perkaranya ditunda. Selama ini hitungan itu
 *    dijaga ingatan petugas yang kebetulan berjaga sejak pagi.
 *
 * 2. LAJU HARI INI - berapa menit rata-rata satu perkara, dihitung dari jarak
 *    NYATA antar panggilan hari ini. Petugas dapat menilai sendiri apakah hari
 *    ini tertinggal atau tidak.
 *
 * 3. SIAPA YANG SUDAH HADIR pada perkara berikutnya, terbaca SEBELUM memanggil
 *    - sehingga petugas tahu lebih dulu apakah pihak yang ditunggu memang
 *    sudah berada di ruang tunggu.
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

type Kehadiran = {
  hadir: Array<{ sebutan: string; nama: string; jam: string }>;
  pertama: { sebutan: string } | null;
};

type Panggilan = {
  jumlah: number;
  batas: number;
  sudahBatas: boolean;
  panggilan: Array<{ urutan: number; jam: string; oleh: string }>;
};

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
      semua: seruang,
      menunggu: seruang
        .filter((x) => x.keadaan === "menunggu" && x.nomor !== null)
        .sort((a, b) => Number(a.nomor) - Number(b.nomor)),
      dipanggil: seruang
        .filter((x) => x.keadaan === "dipanggil" && x.nomor !== null)
        .sort((a, b) => Number(a.nomor) - Number(b.nomor)),
    };
  }, [data, ruang]);

  const laju = useMemo(() => selangPanggilan(baris.semua), [baris.semua]);

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
        setPesan(
          hasil.ok === false ? hasil.alasan || "Panggilan gagal." : hasil.keterangan || "Dipanggil."
        );
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
  const warna = warnaRuang(berikutnya?.noRuang ?? (ruang || null));

  return (
    <div className="space-y-4">
      {/* ── kepala: ruang, jumlah menunggu, laju hari ini ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3, 4].map((nomor) => (
            <button
              key={`r-${nomor}`}
              type="button"
              onClick={() => setRuang(nomor)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition",
                ruang === nomor
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {nomor === 0 ? "Semua ruang" : `Ruang ${nomor}`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-mono text-lg tabular-nums text-foreground">
              {baris.menunggu.length}
            </span>{" "}
            menunggu
          </span>
          {laju !== null ? (
            <span title="Dihitung dari jarak nyata antar panggilan hari ini.">
              <span className="font-mono text-lg tabular-nums text-foreground">{laju}</span> menit
              rata-rata
            </span>
          ) : null}
        </div>
      </div>

      {/* ── peringatan yang memang perlu dibaca ───────────────────────────── */}
      {data && data.tanggal && data.tanggal.length > 1 ? (
        <Peringatan>
          Antrian memuat {data.tanggal.length} tanggal ({data.tanggal.join(", ")}). Nomor dihitung
          dari seluruh baris yang sudah diambil tanpa menyaring tanggal, sehingga nomor hari ini
          dapat melanjut dari sisa hari sebelumnya. Periksa aplikasi antrian.
        </Peringatan>
      ) : null}

      {data && data.terbaca === false ? (
        <Peringatan>{data.alasan || data.message || "Antrian belum dapat dibaca."}</Peringatan>
      ) : null}

      {pesan ? <div className="rounded-xl border bg-muted/30 px-4 py-2.5 text-sm">{pesan}</div> : null}

      {/* ── kartu utama: berikutnya, dengan tombol sebesar mungkin ────────── */}
      {berikutnya ? (
        <div className="rounded-3xl border-2 p-6" style={{ borderColor: warna.aksen }}>
          <div className="flex flex-wrap items-center gap-6">
            <div className="min-w-[7rem]">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Berikutnya</p>
              <p
                className="font-mono text-7xl font-semibold leading-none tabular-nums"
                style={{ color: warna.aksen }}
              >
                {berikutnya.nomor}
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-lg">
                {berikutnya.noRuang ? `Ruang Sidang ${berikutnya.noRuang}` : "Ruang belum ditetapkan"}
                {berikutnya.majelisKode ? (
                  <span className="text-muted-foreground"> · Majelis {berikutnya.majelisKode}</span>
                ) : null}
              </p>

              {/* Siapa yang sudah hadir - terbaca SEBELUM memanggil. */}
              <p className="text-sm text-muted-foreground">
                {berikutnya.hadir.length > 0
                  ? `Hadir: ${berikutnya.hadir.map((x) => x.sebutan).join(", ")}`
                  : "Belum ada keterangan kehadiran"}
              </p>

              {berikutnya.waktuAmbil ? (
                <p className="text-sm text-muted-foreground">
                  Mengambil nomor {berikutnya.waktuAmbil}
                  {berikutnya.online ? " lewat WhatsApp" : " di mesin antrian"}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              disabled={sibuk === berikutnya.perkaraId}
              onClick={() => void panggil(berikutnya)}
              className="rounded-2xl px-10 py-6 text-2xl font-semibold text-white transition disabled:opacity-60"
              style={{ backgroundColor: warna.aksen }}
            >
              {sibuk === berikutnya.perkaraId ? "Memanggil…" : "Panggil"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
          Tidak ada yang menunggu di pilihan ruang ini.
        </div>
      )}

      {/* ── antrean sesudahnya, sekilas ───────────────────────────────────── */}
      {baris.menunggu.length > 1 ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">Sesudahnya</p>
          <div className="flex flex-wrap gap-2">
            {baris.menunggu.slice(1, 16).map((satu) => (
              <span
                key={satu.perkaraId}
                className="rounded-xl border px-3.5 py-2 font-mono text-lg tabular-nums"
                title={satu.hadir.map((x) => x.sebutan).join(", ")}
              >
                {satu.nomor}
                {ruang === 0 && satu.noRuang ? (
                  <span className="ml-1 align-middle font-sans text-[0.65rem] text-muted-foreground">
                    R{satu.noRuang}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── yang sudah dipanggil, beserta hitungannya ─────────────────────── */}
      {baris.dipanggil.length > 0 ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Sudah dipanggil ({baris.dipanggil.length})
          </p>
          <div className="space-y-1">
            {baris.dipanggil
              .slice()
              .reverse()
              .map((satu) => {
                const w = warnaRuang(satu.noRuang);
                const batas = satu.panggilan?.sudahBatas;
                return (
                  <div
                    key={satu.perkaraId}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-2 text-sm",
                      batas
                        ? "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30"
                        : ""
                    )}
                  >
                    <span
                      className="w-14 font-mono text-2xl font-medium tabular-nums"
                      style={{ color: w.aksen }}
                    >
                      {satu.nomor}
                    </span>

                    <span className="min-w-0 flex-1 text-muted-foreground">
                      {satu.noRuang ? `Ruang ${satu.noRuang}` : "Ruang —"}
                      {satu.jamPanggil ? ` · ${satu.jamPanggil}` : ""}
                      {satu.hadir.length > 0
                        ? ` · ${satu.hadir.map((x) => x.sebutan).join(", ")}`
                        : ""}
                    </span>

                    {/* Hitungan panggilan - inilah yang menentukan apakah
                        perkara patut ditunda. */}
                    {satu.panggilan && satu.panggilan.jumlah > 0 ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          batas ? "bg-rose-600 text-white" : "bg-muted text-muted-foreground"
                        )}
                        title={satu.panggilan.panggilan
                          .map((p) => `ke-${p.urutan} ${p.jam}${p.oleh ? ` oleh ${p.oleh}` : ""}`)
                          .join(" · ")}
                      >
                        {satu.panggilan.jumlah}/{satu.panggilan.batas} panggilan
                        {batas ? " · batas" : ""}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      disabled={sibuk === satu.perkaraId}
                      onClick={() => void panggil(satu)}
                      className="rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-60"
                    >
                      {sibuk === satu.perkaraId ? "…" : "Panggil ulang"}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Peringatan({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      {children}
    </div>
  );
}
