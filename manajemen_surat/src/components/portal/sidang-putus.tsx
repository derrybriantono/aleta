"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileSearch, Gavel, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

type StatusPutusan = { id: number; nama: string; dipakai: number };

type LangkahRencana = { tabel: string; aksi: string; keterangan: string };

type HasilPutus = {
  ok: boolean;
  alasan?: string;
  kering?: boolean;
  tanggalPutusan?: string;
  perkara?: { perkaraId: number; nomorPerkara: string };
  atasNama?: { username: string; namaLengkap: string };
  putusan?: {
    tanggalPutusan: string;
    status: string;
    verstek: boolean;
    aksaraAmar: number;
    aksaraPertimbangan: number;
  };
  andaian?: string[];
  rencana?: LangkahRencana[];
};

/** Membuka bungkus { ok, data } - membacanya langsung selalu keliru dan tidak berbunyi. */
async function bukaBungkus<T>(balasan: Response): Promise<T> {
  return ((await balasan.json()) as { data?: T })?.data ?? ({} as T);
}

const angka = (n: number) => n.toLocaleString("id-ID");

export function SidangPutus({
  perkaraId,
  nomorPerkara,
}: {
  perkaraId: number;
  nomorPerkara: string;
}) {
  const [status, setStatus] = useState<StatusPutusan[]>([]);
  const [statusId, setStatusId] = useState("");
  const [tanggalPutusan, setTanggalPutusan] = useState("");
  const [amar, setAmar] = useState("");
  const [pertimbangan, setPertimbangan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [sumberHukum, setSumberHukum] = useState("");
  const [verstek, setVerstek] = useState(false);
  const [olehUsername, setOlehUsername] = useState("");

  const [hasil, setHasil] = useState<HasilPutus | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [sudahTertulis, setSudahTertulis] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const balasan = await fetch(apiPath("/api/aleta-ecourt/sidang-putus"), { cache: "no-store" });
        const isi = await bukaBungkus<{ ok: boolean; daftar?: StatusPutusan[] }>(balasan);
        if (isi.ok && Array.isArray(isi.daftar)) setStatus(isi.daftar);
      } catch {
        // Daftar status yang gagal dimuat cukup membuat pilihannya kosong -
        // bukan menjatuhkan seluruh halaman penundaannya.
      }
    })();
  }, []);

  const kirim = useCallback(
    async (kering: boolean) => {
      setSibuk(true);
      try {
        const balasan = await fetch(apiPath("/api/aleta-ecourt/sidang-putus"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            perkaraId,
            tanggalPutusan,
            statusPutusanId: Number(statusId),
            amarPutusan: amar,
            catatanPutusan: catatan,
            sumberHukumId: sumberHukum,
            verstek: verstek ? "Y" : "T",
            pertimbanganHukum: pertimbangan,
            olehUsername,
            kering,
          }),
        });
        const isi = await bukaBungkus<HasilPutus>(balasan);
        setHasil(isi);
        if (isi.ok && kering === false) setSudahTertulis(true);
      } catch (e) {
        setHasil({ ok: false, alasan: e instanceof Error ? e.message : "Permintaan gagal." });
      } finally {
        setSibuk(false);
      }
    },
    [perkaraId, tanggalPutusan, statusId, amar, catatan, sumberHukum, verstek, pertimbangan, olehUsername]
  );

  const lengkap =
    Boolean(tanggalPutusan) &&
    Boolean(statusId) &&
    Boolean(amar.trim()) &&
    Boolean(pertimbangan.trim()) &&
    Boolean(olehUsername.trim());
  const rencanaKering = hasil?.ok === true && hasil.kering === true;
  const sudahDiputus = hasil?.ok === false && hasil.alasan === "perkara_sudah_diputus";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Gavel className="h-4 w-4" aria-hidden />
            Putus perkara
          </CardTitle>
          <CardDescription>
            Menulis putusan akhir dan pertimbangan hukumnya ke SIPP — dua baris pada detik yang sama, atas nama
            akun SIPP yang disebut. Ini tulisan yang dibaca pengadilan tingkat banding dan dipakai menyusun akta
            cerai, jadi rencananya selalu dibaca lebih dahulu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Tanggal putusan
              <input
                type="date"
                value={tanggalPutusan}
                onChange={(e) => setTanggalPutusan(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="flex min-w-[11rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Status putusan
              <NativeSelect value={statusId} onChange={(e) => setStatusId(e.target.value)}>
                <option value="">— pilih —</option>
                {status.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.nama}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={verstek}
                onChange={(e) => setVerstek(e.target.checked)}
                className="h-4 w-4"
              />
              Putusan verstek
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Amar putusan
            <textarea
              value={amar}
              onChange={(e) => setAmar(e.target.value)}
              rows={5}
              placeholder="1. Mengabulkan gugatan Penggugat;&#10;2. Menjatuhkan talak satu bain sughra …"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Pertimbangan hukum
            <textarea
              value={pertimbangan}
              onChange={(e) => setPertimbangan(e.target.value)}
              rows={7}
              placeholder="Menimbang, bahwa …"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            <span className="text-[0.7rem]">
              {pertimbangan.length > 0 ? `${angka(pertimbangan.length)} aksara` : "Belum ada naskah."}
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Catatan putusan (boleh kosong)
              <input
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              Sumber hukum (angka berkoma, mis. 10,8,11)
              <input
                value={sumberHukum}
                onChange={(e) => setSumberHukum(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Akun SIPP yang menuliskannya
            <input
              value={olehUsername}
              onChange={(e) => setOlehUsername(e.target.value)}
              placeholder="username SIPP"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!lengkap || sibuk} onClick={() => void kirim(true)}>
              <FileSearch className="mr-1.5 h-4 w-4" aria-hidden />
              Lihat rencananya
            </Button>
            <Button disabled={!rencanaKering || sibuk || sudahTertulis} onClick={() => void kirim(false)}>
              <Gavel className="mr-1.5 h-4 w-4" aria-hidden />
              Tulis putusan ke SIPP
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasil ? (
        <Card className={cn(hasil.ok ? "" : "border-destructive/40")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {hasil.ok
                ? hasil.kering
                  ? "Rencana — belum ada yang tertulis"
                  : "Putusan sudah tertulis ke SIPP"
                : "Ditolak"}
            </CardTitle>
            {hasil.ok && hasil.putusan ? (
              <CardDescription>
                {nomorPerkara} · {hasil.putusan.status}
                {hasil.putusan.verstek ? " (verstek)" : ""} · {hasil.putusan.tanggalPutusan} · amar{" "}
                {angka(hasil.putusan.aksaraAmar)} aksara · pertimbangan {angka(hasil.putusan.aksaraPertimbangan)}{" "}
                aksara
                {hasil.atasNama ? ` · atas nama ${hasil.atasNama.namaLengkap || hasil.atasNama.username}` : ""}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!hasil.ok ? (
              <p className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {sudahDiputus
                    ? `Perkara ini sudah punya putusan tertanggal ${hasil.tanggalPutusan || "—"}. ` +
                      "Menyunting putusan yang sudah ada adalah pekerjaan lain, dan ALETA tidak mengerjakannya."
                    : hasil.alasan}
                </span>
              </p>
            ) : null}

            {(hasil.andaian ?? []).map((a) => (
              <p
                key={a}
                className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
              >
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{a}</span>
              </p>
            ))}

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
