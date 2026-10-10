"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Kamus variabel ABT (D1, 10 Okt 2026) - kartu admin.
 *
 * Per variabel: tipe, SUMBER (kolom SIPP / e-Court / isian manual / turunan),
 * arti singkat, blangko pemakai, dan status (otomatis / manual / rawan petik /
 * tanpa sumber). Isi awalnya diurai otomatis dari definisi ABT; Super Admin
 * dapat menyunting arti, sumber, rincian sumber, dan cermin SIPP - suntingan
 * itu tidak ditimpa urai ulang maupun salin ulang dari ABT.
 *
 * Cermin SIPP dipakai ekstensi untuk pengingat sebelum CETAK (B1): variabel
 * mana yang harus sama dengan data inti SIPP.
 */

type Status = "otomatis" | "manual" | "rawan-petik" | "tanpa-sumber";
type Sumber = "sipp" | "ecourt" | "isian" | "turunan" | "sistem" | "tanpa";

type Butir = {
  noVar: string;
  nama: string;
  tipe: string;
  sumber: Sumber;
  sumberRinci: string;
  arti: string;
  status: Status;
  cermin: string;
  cerminLabel: string;
  blangko: string[];
  jumlahBlangko: number;
  sqlQuery: string;
  disunting: boolean;
};

type Rekap = { jumlah: number; perStatus: Record<Status, number>; perSumber: Record<Sumber, number>; bercermin: number };

type Jawaban = {
  rekap: Rekap;
  rekapDipakai: Rekap;
  jumlahCocok: number;
  butir: Butir[];
  asal: string;
  bolehMenyunting: boolean;
  label: { status: Record<Status, string>; sumber: Record<Sumber, string>; cermin: Record<string, string> };
};

const ALAMAT = "/api/aleta-ecourt/kamus-sumber";
const BATAS = 50;

const WARNA_STATUS: Record<Status, "success" | "info" | "warning" | "muted"> = {
  otomatis: "success",
  manual: "info",
  "rawan-petik": "warning",
  "tanpa-sumber": "muted",
};

type Sunting = { noVar: string; arti: string; sumber: Sumber; sumberRinci: string; cermin: string };

export function AletaEcourtKamusSumber() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [pesanGagal, setPesanGagal] = useState("");
  const [kabar, setKabar] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [saring, setSaring] = useState({ cari: "", status: "", sumber: "", dipakai: true, cermin: false, mulai: 0 });
  const [sunting, setSunting] = useState<Sunting | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setPesanGagal("");
    try {
      const q = new URLSearchParams({
        cari: saring.cari,
        status: saring.status,
        sumber: saring.sumber,
        dipakai: saring.dipakai ? "1" : "",
        cermin: saring.cermin ? "1" : "",
        mulai: String(saring.mulai),
        batas: String(BATAS),
      });
      const jawaban = await fetch(apiPath(`${ALAMAT}?${q.toString()}`), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca kamus variabel ABT."));
      setData(isi?.data ?? null);
    } catch (e) {
      setPesanGagal(e instanceof Error ? e.message : "Gagal membaca kamus variabel ABT.");
    } finally {
      setMemuat(false);
    }
  }, [saring]);

  useEffect(() => {
    const timer = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const kirim = useCallback(
    async (cara: "PATCH" | "POST", badan: Record<string, unknown>, kabarBerhasil: string) => {
      setSibuk(true);
      setPesanGagal("");
      setKabar("");
      try {
        const jawaban = await fetch(apiPath(ALAMAT), {
          method: cara,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(badan),
        });
        const isi = await jawaban.json().catch(() => null);
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));
        setKabar(kabarBerhasil);
        await muat();
        return true;
      } catch (e) {
        setPesanGagal(e instanceof Error ? e.message : "Gagal menyimpan.");
        return false;
      } finally {
        setSibuk(false);
      }
    },
    [muat]
  );

  const r = data?.rekap;
  const rd = data?.rekapDipakai;
  const label = data?.label;
  const boleh = Boolean(data?.bolehMenyunting);

  return (
    <Card id="kamus-variabel-abt">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Kamus variabel ABT
          <Badge variant="muted">sumber, arti, blangko pemakai</Badge>
        </CardTitle>
        <CardDescription>
          Dari mana tiap variabel blangko ABT mendapat nilainya: kolom SIPP, e-Court, isian manual, atau turunan variabel
          lain. Diurai otomatis dari definisi ABT{data?.asal ? ` (${data.asal})` : ""}. Cermin SIPP dipakai ekstensi untuk
          mengingatkan beda data inti sebelum CETAK.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {r && rd ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border/70 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Seluruh kamus ({r.jumlah})</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(Object.keys(r.perStatus) as Status[]).map((s) => (
                  <Badge key={s} variant={WARNA_STATUS[s]}>
                    {label?.status[s] ?? s}: {r.perStatus[s]}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Dipakai blangko ({rd.jumlah})</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(Object.keys(rd.perStatus) as Status[]).map((s) => (
                  <Badge key={s} variant={WARNA_STATUS[s]}>
                    {label?.status[s] ?? s}: {rd.perStatus[s]}
                  </Badge>
                ))}
                <Badge variant="outline">bercermin SIPP: {rd.bercermin}</Badge>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_11rem_auto]">
          <Input
            value={saring.cari}
            onChange={(e) => setSaring({ ...saring, cari: e.target.value, mulai: 0 })}
            placeholder="Cari kode, nama, arti, kolom SIPP"
            aria-label="Cari variabel"
          />
          <NativeSelect
            value={saring.status}
            onChange={(e) => setSaring({ ...saring, status: e.target.value, mulai: 0 })}
            aria-label="Saring status"
          >
            <option value="">Semua status</option>
            {(["otomatis", "manual", "rawan-petik", "tanpa-sumber"] as Status[]).map((s) => (
              <option key={s} value={s}>
                {label?.status[s] ?? s}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={saring.sumber}
            onChange={(e) => setSaring({ ...saring, sumber: e.target.value, mulai: 0 })}
            aria-label="Saring sumber"
          >
            <option value="">Semua sumber</option>
            {(["sipp", "ecourt", "isian", "turunan", "sistem", "tanpa"] as Sumber[]).map((s) => (
              <option key={s} value={s}>
                {label?.sumber[s] ?? s}
              </option>
            ))}
          </NativeSelect>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={saring.dipakai}
                onChange={(e) => setSaring({ ...saring, dipakai: e.target.checked, mulai: 0 })}
              />
              dipakai blangko
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={saring.cermin}
                onChange={(e) => setSaring({ ...saring, cermin: e.target.checked, mulai: 0 })}
              />
              bercermin SIPP
            </label>
          </div>
        </div>

        {boleh ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim("POST", { tindakan: "urai-ulang" }, "Kamus diurai ulang.")}>
              Urai ulang dari definisi ABT
            </Button>
            <span className="text-xs text-muted-foreground">Arti/sumber yang Anda sunting tidak ditimpa.</span>
          </div>
        ) : null}

        {memuat ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {pesanGagal ? <p className="text-sm text-rose-600 dark:text-rose-400">{pesanGagal}</p> : null}
        {kabar ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{kabar}</p> : null}

        {data ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 text-left font-medium">Kode</th>
                  <th className="py-1 pr-2 text-left font-medium">Arti</th>
                  <th className="py-1 pr-2 text-left font-medium">Sumber</th>
                  <th className="py-1 pr-2 text-left font-medium">Status</th>
                  <th className="py-1 pr-2 text-right font-medium">Blangko</th>
                  {boleh ? <th className="py-1 text-right font-medium" /> : null}
                </tr>
              </thead>
              <tbody>
                {data.butir.map((b) =>
                  sunting?.noVar === b.noVar ? (
                    <tr key={b.noVar} className="border-t align-top">
                      <td className="py-2 pr-2 font-mono text-xs">#{b.noVar}#</td>
                      <td className="py-2 pr-2" colSpan={boleh ? 5 : 4}>
                        <div className="space-y-2">
                          <Textarea
                            value={sunting.arti}
                            onChange={(e) => setSunting({ ...sunting, arti: e.target.value })}
                            aria-label={`Arti #${b.noVar}#`}
                            rows={2}
                          />
                          <div className="grid gap-2 sm:grid-cols-3">
                            <NativeSelect
                              value={sunting.sumber}
                              onChange={(e) => setSunting({ ...sunting, sumber: e.target.value as Sumber })}
                              aria-label="Sumber"
                            >
                              {(["sipp", "ecourt", "isian", "turunan", "sistem", "tanpa"] as Sumber[]).map((s) => (
                                <option key={s} value={s}>
                                  {label?.sumber[s] ?? s}
                                </option>
                              ))}
                            </NativeSelect>
                            <Input
                              value={sunting.sumberRinci}
                              onChange={(e) => setSunting({ ...sunting, sumberRinci: e.target.value })}
                              placeholder="Rincian sumber, mis. perkara_pihak1.nama"
                              aria-label="Rincian sumber"
                            />
                            <NativeSelect
                              value={sunting.cermin}
                              onChange={(e) => setSunting({ ...sunting, cermin: e.target.value })}
                              aria-label="Cermin SIPP"
                            >
                              <option value="">Tanpa cermin SIPP</option>
                              {Object.entries(label?.cermin ?? {}).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </NativeSelect>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={sibuk}
                              onClick={async () => {
                                if (await kirim("PATCH", { ...sunting }, `#${b.noVar}# tersimpan.`)) setSunting(null);
                              }}
                            >
                              Simpan
                            </Button>
                            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setSunting(null)}>
                              Batal
                            </Button>
                            {b.disunting ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={sibuk}
                                onClick={async () => {
                                  if (await kirim("PATCH", { noVar: b.noVar, kembalikan: true }, `#${b.noVar}# kembali ke uraian otomatis.`)) setSunting(null);
                                }}
                              >
                                Kembalikan ke uraian otomatis
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={b.noVar} className="border-t align-top">
                      <td className="py-1.5 pr-2 font-mono text-xs">
                        #{b.noVar}#<div className="font-sans text-[11px] text-muted-foreground">{b.tipe}</div>
                      </td>
                      <td className="py-1.5 pr-2">
                        {b.arti || b.nama}
                        {b.cerminLabel ? <div className="text-xs text-sky-700 dark:text-sky-300">Cermin SIPP: {b.cerminLabel}</div> : null}
                      </td>
                      <td className="py-1.5 pr-2 text-xs">
                        <div className="font-medium">{label?.sumber[b.sumber] ?? b.sumber}</div>
                        <div className="break-all text-muted-foreground" title={b.sqlQuery || undefined}>
                          {b.sumberRinci}
                        </div>
                      </td>
                      <td className="py-1.5 pr-2">
                        <Badge variant={WARNA_STATUS[b.status]}>{label?.status[b.status] ?? b.status}</Badge>
                        {b.disunting ? <div className="text-[11px] text-muted-foreground">disunting admin</div> : null}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums" title={b.blangko.join("\n") || undefined}>
                        {b.jumlahBlangko}
                      </td>
                      {boleh ? (
                        <td className="py-1.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sibuk}
                            onClick={() =>
                              setSunting({ noVar: b.noVar, arti: b.arti, sumber: b.sumber, sumberRinci: b.sumberRinci, cermin: b.cermin })
                            }
                          >
                            Sunting
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  )
                )}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {data.jumlahCocok === 0
                  ? "Tidak ada variabel yang cocok."
                  : `${saring.mulai + 1}-${Math.min(saring.mulai + BATAS, data.jumlahCocok)} dari ${data.jumlahCocok}`}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={saring.mulai === 0 || memuat}
                onClick={() => setSaring({ ...saring, mulai: Math.max(0, saring.mulai - BATAS) })}
              >
                Sebelumnya
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saring.mulai + BATAS >= data.jumlahCocok || memuat}
                onClick={() => setSaring({ ...saring, mulai: saring.mulai + BATAS })}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
