"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BarisBedaTampil, type KataBeda } from "@/components/portal/penyunting-blangko";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DaftarEkspor, RingkasBeda } from "@/lib/aleta-abt-sinkron";
import type { HasilBeda } from "@/lib/aleta-abt-penyunting-tipe";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Beda dengan ABT (5 Nov 2026, Tahap 9) - Super Admin saja (rute /api/aleta-abt/sinkron menjaga peran di server).
 * Daftar blangko yang isinya berbeda dengan ABT sedangkan ALETA ABT sudah mengubahnya; isi ABT terbaru disimpan di samping sebagai
 * pembanding. Super Admin memilih: ambil dari ABT (isi ALETA ABT tersimpan sebagai versi lama) atau tetap memakai ALETA ABT.
 * ABT hanya dibaca. Ubahan juga dapat diunduh sebagai paket ABT untuk ditinjau; paket tidak dipasang dari sini.
 */

async function panggil<T>(cari: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(`/api/aleta-abt/sinkron${cari}`), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}

type BedaBuka = {
  id: string;
  nama: string;
  folder: string;
  md5Aleta: string;
  md5Abt: string;
  ukuranAleta: number;
  ukuranAbt: number;
  sejak: string;
  beda: HasilBeda | null;
  sebabTanpaBeda: string;
  dapatDiambil: boolean;
  adaDraf: boolean;
};

const KATA: KataBeda = { sebelum: "Di ALETA ABT", sesudah: "Di ABT", tambah: "Hanya di ABT", hapus: "Hanya di ALETA ABT" };
const ISIAN_KOSONG = {};

const jam = (iso: string) => {
  const d = new Date(iso);
  return !iso || Number.isNaN(d.getTime()) ? "" : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};
const lamaTeks = (hari: number) => (hari <= 0 ? "hari ini" : `${hari} hari`);
const kb = (b: number) => `${(b / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} KB`;

function Galat({ pesan }: { pesan: string }) {
  if (!pesan) return null;
  return (
    <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
      {pesan}
    </div>
  );
}

function Info({ pesan }: { pesan: string }) {
  if (!pesan) return null;
  return (
    <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
      {pesan}
    </div>
  );
}

export function BedaDenganAbt() {
  const [data, setData] = useState<RingkasBeda | null>(null);
  const [ekspor, setEkspor] = useState<DaftarEkspor | null>(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [buka, setBuka] = useState<BedaBuka | null>(null);
  const [membuka, setMembuka] = useState("");
  const [konfirmasi, setKonfirmasi] = useState<"ambil" | "tetap" | null>(null);

  const muat = useCallback(async () => {
    try {
      const [d, e] = await Promise.all([panggil<RingkasBeda>(""), panggil<DaftarEkspor>("?bagian=ekspor-daftar")]);
      setData(d);
      setEkspor(e);
      setGalat("");
    } catch (e) {
      setGalat((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const lihat = async (id: string) => {
    setMembuka(id);
    setGalat("");
    setInfo("");
    setKonfirmasi(null);
    try {
      setBuka(await panggil<BedaBuka>(`?bagian=beda&id=${encodeURIComponent(id)}`));
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setMembuka("");
    }
  };

  const putuskan = async (pilihan: "ambil" | "tetap") => {
    if (!buka) return;
    setSibuk(true);
    setGalat("");
    try {
      await panggil("", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tindakan: "putuskan", id: buka.id, pilihan, md5Abt: buka.md5Abt, md5Aleta: buka.md5Aleta }),
      });
      setInfo(
        pilihan === "ambil"
          ? `Isi ${buka.nama} diambil dari ABT. Isi ALETA ABT yang lama tetap tersimpan sebagai versi sebelumnya dan dapat dikembalikan di penyunting.`
          : `${buka.nama} tetap memakai isi ALETA ABT. Beda ini tidak muncul lagi sampai ABT berubah lagi.`
      );
      setBuka(null);
      setKonfirmasi(null);
      await muat();
    } catch (e) {
      setGalat((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  const r = data?.setelan;
  const lama = data && data.tertuaHari >= 7;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Beda dengan ABT</CardTitle>
          <CardDescription>
            Blangko yang isinya berbeda dengan ABT padahal sudah pernah diubah di ALETA ABT. Ubahan di ALETA ABT tidak pernah ditimpa; di sini Anda memilih isi
            mana yang dipakai. ABT hanya dibaca, tidak pernah ditulis dari layar ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Galat pesan={galat} />
          <Info pesan={info} />
          {data ? (
            <div className={`rounded-xl border px-3 py-3 ${data.menunggu ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" : "border-border bg-muted/40"}`}>
              <p className="text-2xl font-semibold text-foreground">{data.menunggu.toLocaleString("id-ID")}</p>
              <p className="text-sm text-muted-foreground">
                {data.menunggu ? "blangko menunggu Anda tinjau." : "Tidak ada blangko yang menunggu ditinjau."}
                {data.menunggu && data.tertuaHari > 0 ? ` Yang paling lama sudah ${lamaTeks(data.tertuaHari)}.` : ""}
              </p>
              {lama ? <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-200">Sudah lebih dari seminggu ada yang belum dipilih. Tinjau agar tidak menumpuk.</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          )}
          {r ? (
            <p className="text-sm text-muted-foreground">
              Sinkron otomatis dari ABT: <b>{r.jadwal ? `menyala, tiap hari sesudah ${r.jam} WITA` : "mati"}</b>.{" "}
              {data?.putaranTerakhir ? `Sinkron terakhir ${jam(data.putaranTerakhir.pada)} (${data.putaranTerakhir.status === "berhasil" ? "selesai" : data.putaranTerakhir.status === "gagal" ? "tidak selesai" : "berjalan"}). ` : "Belum pernah menyinkron. "}
              Menyalakannya di{" "}
              <Link href="/admin/pengaturan-sipp-abt?bagian=pustaka" className="underline">
                Pengaturan SIPP &amp; ABT, Pustaka blangko
              </Link>
              .
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void muat()} disabled={sibuk}>
              Muat ulang
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/aleta-abt">Kembali ke ALETA ABT</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && data.daftar.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Menunggu ditinjau ({data.menunggu.toLocaleString("id-ID")})</CardTitle>
            <CardDescription>Yang paling lama menunggu ada di atas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.daftar.map((b) => (
              <div key={b.id} className={`rounded-xl border px-3 py-2 ${buka?.id === b.id ? "border-primary" : "border-border"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-foreground">{b.nama}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      {b.folderLabel} - tercatat {jam(b.sejak) || "-"}
                      {b.hari >= 7 ? ` (${lamaTeks(b.hari)})` : ""}
                      {b.ukuranAbt ? ` - ${kb(b.ukuranAleta)} di ALETA ABT, ${kb(b.ukuranAbt)} di ABT` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant={buka?.id === b.id ? "default" : "outline"} onClick={() => void lihat(b.id)} disabled={Boolean(membuka)}>
                    {membuka === b.id ? "Membuka..." : "Lihat beda"}
                  </Button>
                </div>
                {buka?.id === b.id ? (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    {buka.adaDraf ? (
                      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                        Blangko ini punya suntingan yang belum diterbitkan. Suntingan itu tetap ada di riwayat versi apa pun pilihan Anda.
                      </p>
                    ) : null}
                    {buka.beda ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {buka.beda.samaTeks
                            ? "Teksnya sama; yang berbeda hanya pengaturan format atau bagian terkunci."
                            : `${buka.beda.ringkas.ubah} paragraf berubah, ${buka.beda.ringkas.tambah} hanya ada di ABT, ${buka.beda.ringkas.hapus} hanya ada di ALETA ABT.`}
                          {buka.beda.kepalaKakiBeda ? " Kepala atau kaki halaman juga berbeda." : ""}
                        </p>
                        <BarisBedaTampil beda={buka.beda} isian={ISIAN_KOSONG} kata={KATA} />
                      </>
                    ) : (
                      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                        {buka.sebabTanpaBeda} Di ALETA ABT {kb(buka.ukuranAleta)}, di ABT {buka.ukuranAbt ? kb(buka.ukuranAbt) : "belum tersimpan"}.
                      </p>
                    )}
                    {konfirmasi ? (
                      <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                        <p>
                          {konfirmasi === "ambil"
                            ? "Isi di ALETA ABT diganti dengan isi dari ABT. Isi yang lama tersimpan sebagai versi sebelumnya dan dapat dikembalikan di penyunting. Lanjutkan?"
                            : "Blangko ini tetap memakai isi ALETA ABT. Beda ini hilang dari daftar sampai ABT berubah lagi. Lanjutkan?"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => void putuskan(konfirmasi)} disabled={sibuk}>
                            {sibuk ? "Memproses..." : konfirmasi === "ambil" ? "Ya, ambil dari ABT" : "Ya, tetap pakai ALETA ABT"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setKonfirmasi(null)} disabled={sibuk}>
                            Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setKonfirmasi("ambil")} disabled={!buka.dapatDiambil}>
                          Ambil dari ABT
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setKonfirmasi("tetap")}>
                          Tetap pakai ALETA ABT
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setBuka(null)}>
                          Tutup
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Kirim ubahan ke ABT sebagai paket</CardTitle>
          <CardDescription>
            Ubahan di ALETA ABT dapat dibuat menjadi paket ABT untuk Anda tinjau. Paket hanya berupa berkas: tidak dipasang dan tidak menulis ke ABT dari sini. Blangko
            yang beda dengan ABT harus dipilih dulu di atas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ekspor ? (
            <>
              {ekspor.siap.length ? (
                <ul className="space-y-1">
                  {ekspor.siap.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 break-words">{s.nama}</span>
                      <Badge variant="outline">{s.potongan} bagian berubah</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada ubahan yang siap dikirim.</p>
              )}
              {ekspor.tidakSiap.length ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Belum siap ({ekspor.tidakSiap.length})</p>
                  <ul className="space-y-1">
                    {ekspor.tidakSiap.map((s) => (
                      <li key={s.id} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        <span className="break-words font-medium">{s.nama}</span>: {s.sebab}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {ekspor.siap.length ? (
                  <Button size="sm" asChild>
                    <a href={apiPath("/api/aleta-abt/sinkron?bagian=ekspor")} download>
                      Unduh paket ({ekspor.siap.length} blangko)
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" disabled>
                    Unduh paket
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          )}
        </CardContent>
      </Card>

      {data && data.daftarHilang.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Tidak ada lagi di ABT ({data.daftarHilang.length.toLocaleString("id-ID")})</CardTitle>
            <CardDescription>Hanya ditandai. Salinannya tetap ada di ALETA ABT dan tidak dihapus.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {data.daftarHilang.map((h) => (
                <li key={h.id} className="rounded-lg border border-border px-3 py-1.5 text-sm">
                  <span className="break-words">{h.nama}</span>
                  <span className="block break-words text-xs text-muted-foreground">
                    {h.folderLabel}
                    {h.sejak ? ` - ditandai ${jam(h.sejak)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
