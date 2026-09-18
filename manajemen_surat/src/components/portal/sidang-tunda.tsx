"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, Info, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidangPutus } from "@/components/portal/sidang-putus";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

type KeadaanSidang = {
  jadwalId: number;
  perkaraId: number;
  nomorPerkara: string;
  tanggalSidang: string;
  jamSidang: string;
  agenda: string;
  ditunda: string;
  alurPerkaraId?: number;
  tahapanId?: number;
};

type LangkahRencana = {
  tabel: string;
  aksi: string;
  keterangan: string;
  sql: string;
  nilai: unknown[];
};

type HasilTunda = {
  ok: boolean;
  alasan?: string;
  kering?: boolean;
  perkara?: { perkaraId: number; nomorPerkara: string };
  atasNama?: { username: string; namaLengkap: string };
  sidangSekarang?: { jadwalId: number; tanggal: string };
  sidangBerikutnya?: { tanggal: string; jam: string; agenda: string };
  andaian?: string[];
  antrian?: { ok: boolean; kering: boolean; baris?: number; alasan?: string } | null;
  rencana?: LangkahRencana[];
};

/**
 * Alasan penundaan yang paling sering dipakai, supaya tidak diketik ulang tiap
 * sidang - tetapi TETAP dapat diketik sendiri. Daftar tertutup akan memaksa
 * panitera sidang memilih alasan yang bukan alasannya.
 */
const ALASAN_LAZIM = [
  "Panggilan belum sampai kepada Tergugat",
  "Para pihak tidak hadir",
  "Memberi kesempatan mediasi",
  "Pemeriksaan saksi belum selesai",
  "Memberi kesempatan kepada Penggugat melengkapi bukti",
];

const AGENDA_LAZIM = [
  "Pembacaan Gugatan",
  "Jawaban",
  "Replik",
  "Duplik",
  "Pembuktian Penggugat",
  "Pembuktian Tergugat",
  "Kesimpulan",
  "Pembacaan Putusan",
];

/** Membuka bungkus { ok, data } - membacanya langsung selalu keliru dan tidak berbunyi. */
async function bukaBungkus<T>(balasan: Response): Promise<T> {
  return ((await balasan.json()) as { data?: T })?.data ?? ({} as T);
}

export function SidangTunda({ jadwalId }: { jadwalId: string }) {
  const [keadaan, setKeadaan] = useState<KeadaanSidang | null>(null);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);

  const [alasanTunda, setAlasanTunda] = useState("");
  const [tanggalBerikut, setTanggalBerikut] = useState("");
  const [jamBerikut, setJamBerikut] = useState("");
  const [agendaBerikut, setAgendaBerikut] = useState("");
  const [olehUsername, setOlehUsername] = useState("");

  const [hasil, setHasil] = useState<HasilTunda | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [sudahTertulis, setSudahTertulis] = useState(false);

  const muat = useCallback(async () => {
    setGalatMuat(null);
    try {
      const balasan = await fetch(apiPath(`/api/aleta-ecourt/sidang-tunda?jadwalId=${jadwalId}`), {
        cache: "no-store",
      });
      const isi = await bukaBungkus<{ ok: boolean; alasan?: string; keadaan?: KeadaanSidang }>(balasan);
      if (!isi.ok || !isi.keadaan) {
        setGalatMuat(isi.alasan || "Jadwal sidang tidak ditemukan.");
        return;
      }
      setKeadaan(isi.keadaan);
      setJamBerikut(isi.keadaan.jamSidang || "");
    } catch (e) {
      setGalatMuat(e instanceof Error ? e.message : "Jadwal sidang tidak dapat dibaca.");
    }
  }, [jadwalId]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const kirim = useCallback(
    async (kering: boolean) => {
      if (!keadaan) return;
      setSibuk(true);
      try {
        const balasan = await fetch(apiPath("/api/aleta-ecourt/sidang-tunda"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jadwalId: keadaan.jadwalId,
            perkaraId: keadaan.perkaraId,
            alasanTunda,
            tanggalBerikut,
            jamBerikut,
            jamSekarang: keadaan.jamSidang,
            agendaBerikut,
            olehUsername,
            kering,
          }),
        });
        const isi = await bukaBungkus<HasilTunda>(balasan);
        setHasil(isi);
        if (isi.ok && kering === false) {
          setSudahTertulis(true);
          void muat();
        }
      } catch (e) {
        setHasil({ ok: false, alasan: e instanceof Error ? e.message : "Permintaan gagal." });
      } finally {
        setSibuk(false);
      }
    },
    [keadaan, alasanTunda, tanggalBerikut, jamBerikut, agendaBerikut, olehUsername, muat]
  );

  const lengkap =
    Boolean(alasanTunda.trim()) &&
    Boolean(tanggalBerikut) &&
    Boolean(jamBerikut) &&
    Boolean(agendaBerikut.trim()) &&
    Boolean(olehUsername.trim());

  const rencanaKering = hasil?.ok === true && hasil.kering === true;

  if (galatMuat) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-5 text-sm text-destructive">{galatMuat}</CardContent>
      </Card>
    );
  }

  if (!keadaan) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Membaca jadwal sidang…</CardContent>
      </Card>
    );
  }

  const sudahDitunda = String(keadaan.ditunda || "").toUpperCase() === "Y";

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Keadaan sidangnya lebih dahulu - yang pertama dibutuhkan panitera   */}
      {/* sidang bukan borang, melainkan jawaban.                            */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{keadaan.nomorPerkara}</CardTitle>
            {sudahDitunda ? (
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Sudah ditunda</Badge>
            ) : (
              <Badge variant="outline">Belum ditunda</Badge>
            )}
          </div>
          <CardDescription>
            Sidang {keadaan.tanggalSidang} pukul {keadaan.jamSidang || "—"} · agenda {keadaan.agenda || "—"}
          </CardDescription>
        </CardHeader>
      </Card>

      {sudahDitunda ? (
        <Card className="border-emerald-600/40 bg-emerald-500/5">
          <CardContent className="flex items-start gap-2 py-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>
              Sidang ini sudah ditunda dan sidang berikutnya sudah tercatat di SIPP. Menundanya sekali lagi akan
              melahirkan baris jadwal berganda — jadi borangnya ditutup, bukan dibiarkan terbuka.
            </span>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tunda sidang</CardTitle>
            <CardDescription>
              Yang ditulis ini SIPP sungguhan beserta audit trail-nya. Rencananya diperlihatkan lebih dahulu, dan
              menulis menuntut penekanan tombol kedua.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Alasan penundaan
              <input
                list="alasan-lazim"
                value={alasanTunda}
                onChange={(e) => setAlasanTunda(e.target.value)}
                placeholder="ketik sendiri, atau pilih yang lazim"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
              <datalist id="alasan-lazim">
                {ALASAN_LAZIM.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </label>

            <div className="flex flex-wrap gap-3">
              <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                Tanggal sidang berikutnya
                <input
                  type="date"
                  value={tanggalBerikut}
                  onChange={(e) => setTanggalBerikut(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                />
              </label>
              <label className="flex min-w-[7rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
                Jam
                <input
                  type="time"
                  value={jamBerikut}
                  onChange={(e) => setJamBerikut(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Agenda sidang berikutnya
              <input
                list="agenda-lazim"
                value={agendaBerikut}
                onChange={(e) => setAgendaBerikut(e.target.value)}
                placeholder="ketik sendiri, atau pilih yang lazim"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
              <datalist id="agenda-lazim">
                {AGENDA_LAZIM.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </label>

            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Akun SIPP yang menuliskannya
              <input
                value={olehUsername}
                onChange={(e) => setOlehUsername(e.target.value)}
                placeholder="username SIPP panitera sidang"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
              <span className="text-[0.7rem]">
                Nama inilah yang muncul pada audit trail SIPP. ALETA tidak pernah menulis atas nama dirinya sendiri.
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!lengkap || sibuk} onClick={() => void kirim(true)}>
                <FileSearch className="mr-1.5 h-4 w-4" aria-hidden />
                Lihat rencananya
              </Button>
              <Button
                disabled={!rencanaKering || sibuk || sudahTertulis}
                onClick={() => void kirim(false)}
                title={rencanaKering ? undefined : "Lihat rencananya lebih dahulu"}
              >
                <PenLine className="mr-1.5 h-4 w-4" aria-hidden />
                Tulis ke SIPP
              </Button>
            </div>
            {!rencanaKering ? (
              <p className="text-xs text-muted-foreground">
                Tombol tulis baru terbuka sesudah rencananya dibaca — bukan supaya lebih lambat, melainkan supaya
                tidak ada yang tertulis tanpa pernah dilihat.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Memutus - pekerjaan yang lain sama sekali, jadi borangnya juga lain */}
      {/* ------------------------------------------------------------------ */}
      <SidangPutus perkaraId={keadaan.perkaraId} nomorPerkara={keadaan.nomorPerkara} />

      {/* ------------------------------------------------------------------ */}
      {/* Hasil penundaan - rencana kering maupun tulisan sungguhan.          */}
      {/* ------------------------------------------------------------------ */}
      {hasil ? (
        <Card className={cn(hasil.ok ? "" : "border-destructive/40")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {hasil.ok
                ? hasil.kering
                  ? "Rencana — belum ada yang tertulis"
                  : "Sudah tertulis ke SIPP"
                : "Ditolak"}
            </CardTitle>
            {hasil.ok && hasil.sidangBerikutnya ? (
              <CardDescription>
                Sidang berikutnya {hasil.sidangBerikutnya.tanggal} pukul {hasil.sidangBerikutnya.jam} ·{" "}
                {hasil.sidangBerikutnya.agenda}
                {hasil.atasNama ? ` · atas nama ${hasil.atasNama.namaLengkap || hasil.atasNama.username}` : ""}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!hasil.ok ? (
              <p className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{hasil.alasan}</span>
              </p>
            ) : null}

            {(hasil.andaian ?? []).map((a) => (
              <p key={a} className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{a}</span>
              </p>
            ))}

            {hasil.antrian ? (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  {hasil.antrian.ok
                    ? hasil.antrian.kering
                      ? "Antrian sidang akan ditandai selesai."
                      : `Antrian sidang ditandai selesai (${hasil.antrian.baris ?? 0} baris). Nol baris bukan galat — tidak semua perkara mengambil nomor antrian.`
                    : `Antrian tidak tergerakkan: ${hasil.antrian.alasan}. Penundaannya tetap sah dan tetap tercatat.`}
                </span>
              </p>
            ) : null}

            {(hasil.rencana ?? []).length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  {hasil.rencana!.length} baris akan ditulis — termasuk barisnya di sys_audittrail.
                </p>
                {hasil.rencana!.map((l, i) => (
                  <div key={i} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                    <p className="font-medium">
                      {l.aksi} · {l.tabel}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{l.keterangan}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
