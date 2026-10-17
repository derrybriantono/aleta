"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { tanggalPanjang } from "@/lib/tanggal-indonesia";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * SK Ketua: susunan majelis hakim dan panitera sidangnya.
 *
 * ============================================================================
 * KENAPA PENGIKATAN INI TIDAK DAPAT DIKERJAKAN MESIN
 * ============================================================================
 *
 * Kode hakim pada SK - A, B, C1, C2, C3 - cocok persis dengan hakim_pn di
 * SIPP, jadi susunan hakimnya cukup disimpan sebagai kode.
 *
 * Kode panitera TIDAK. Diperiksa pada panitera_pn PA Donggala:
 *
 *   Sri Susilowati "D"   Munifa "D"   Qadariyah "D"   Andini "D"
 *   Sitti Nurhidayah "D8"   Unun Fidiyasari ""   Fikrianto ""
 *
 * sementara SK menyebut D, D1, D2, D3, D4, D5, D6. Empat orang berbagi satu
 * kode, dan lima kode SK tidak ada sama sekali. Namanya pun berbeda ejaan -
 * SK menulis "Munifah", SIPP menulis "Munifa".
 *
 * Karena itu tiap kode SK diikat ke ORANG di layar ini, sekali, oleh manusia.
 * Kodenya tetap tersimpan dan tetap terbaca di sebelah namanya pada panel
 * penetapan - ia label, bukan penunjuk orang.
 */

type Majelis = {
  majelisKode: string;
  hari: number;
  namaHari: string;
  paniteraKode: string[];
  panitera: { kode: string; id: number }[];
  hakimKode: string[];
  /** Kode SK beserta akun portalnya - hakim maupun panitera, satu daftar. */
  akun: { kode: string; akunId: string }[];
  skNomor: string;
  skTanggal: string;
  keterangan: string;
  bawaan: boolean;
};

type Pegawai = { id: number; kode: string; nama: string };

/** Akun portal yang dapat ditautkan ke anggota majelis. */
type AkunPortal = {
  id: string;
  nama: string;
  peran: string;
  peranLabel: string;
  jabatan: string;
  subPeran: string;
};

export function AletaEcourtSkMajelis() {
  const [majelis, setMajelis] = useState<Majelis[]>([]);
  const [hakim, setHakim] = useState<Pegawai[]>([]);
  const [panitera, setPanitera] = useState<Pegawai[]>([]);
  const [akun, setAkun] = useState<AkunPortal[]>([]);
  const [akunAlasan, setAkunAlasan] = useState("");
  const [namaHari, setNamaHari] = useState<string[]>([]);
  const [skBerlaku, setSkBerlaku] = useState<{ nomor: string; tanggal: string } | null>(null);
  const [pegawaiAlasan, setPegawaiAlasan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState("");
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/sk-majelis"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca SK susunan majelis."));
      const data = isi?.data ?? isi;
      setMajelis((data.majelis ?? []) as Majelis[]);
      setHakim((data.hakim ?? []) as Pegawai[]);
      setPanitera((data.panitera ?? []) as Pegawai[]);
      setAkun((data.akun ?? []) as AkunPortal[]);
      setAkunAlasan(String(data.akunAlasan ?? ""));
      setNamaHari((data.namaHari ?? []) as string[]);
      setSkBerlaku((data.skBerlaku ?? null) as { nomor: string; tanggal: string } | null);
      setPegawaiAlasan(String(data.pegawaiAlasan ?? ""));
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca SK.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const namaHakim = useMemo(
    () => new Map(hakim.map((x) => [x.kode.toUpperCase(), x.nama])),
    [hakim]
  );
  const namaPanitera = useMemo(() => new Map(panitera.map((x) => [x.id, x.nama])), [panitera]);

  /** Empat panitera berbagi kode "D" - itu yang membuat layar ini perlu. */
  const kodeTabrakan = useMemo(() => {
    const hitung = new Map<string, number>();
    for (const p of panitera) {
      if (!p.kode) continue;
      hitung.set(p.kode, (hitung.get(p.kode) ?? 0) + 1);
    }
    return [...hitung.entries()].filter(([, n]) => n > 1);
  }, [panitera]);

  const simpan = useCallback(
    async (satu: Majelis, ubahan: Partial<Majelis>) => {
      setSibuk(satu.majelisKode);
      setGalat("");
      setPesan("");
      const gabung = { ...satu, ...ubahan };
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/sk-majelis"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            majelisKode: gabung.majelisKode,
            hari: gabung.hari,
            paniteraKode: gabung.paniteraKode.join(","),
            hakimKode: gabung.hakimKode.join(","),
            // Pasangan kode=id - bentuk yang sama yang tersimpan.
            paniteraId: gabung.panitera.map((p) => `${p.kode}=${p.id}`).join(","),
            // Tautan akun portal - bentuk yang sama, dan dikirim BERSAMA
            // majelisnya. Tidak ada alamat lain yang menerimanya, dan itulah
            // yang membuat "hanya dapat ditautkan apabila masuk majelis"
            // berlaku sungguhan, bukan sekadar dianjurkan di layar.
            akunId: (gabung.akun ?? []).map((a) => `${a.kode}=${a.akunId}`).join(","),
            keterangan: gabung.keterangan,
          }),
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));
        const data = isi?.data ?? isi;
        setMajelis((data.majelis ?? []) as Majelis[]);
        setPesan(`Majelis ${gabung.majelisKode} tersimpan.`);
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.");
      } finally {
        setSibuk("");
      }
    },
    []
  );

  if (memuat) {
    return <p className="text-sm text-muted-foreground">Membaca SK susunan majelis…</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>SK susunan majelis hakim dan panitera sidang</CardTitle>
          <CardDescription>
            {skBerlaku?.nomor
              ? `SK yang berlaku: Nomor ${skBerlaku.nomor} tanggal ${tanggalPanjang(
                  skBerlaku.tanggal,
                  skBerlaku.tanggal
                )} (diubah di kartu Nomor SK penunjukan di bawah). `
              : ""}
            Yang tersimpan di sini menang atas susunan yang disimpulkan dari pemakaian di SIPP:
            majelis yang ada di SK muncul lebih dahulu pada panel penetapan, beserta kodenya.
            Susunan di luar SK tetap dapat dipilih, di bawahnya, tanpa kode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {pegawaiAlasan ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              Daftar pegawai SIPP tidak terbaca: {pegawaiAlasan}. Hari sidang dan kode masih dapat
              disunting, tetapi panitera sidang belum dapat diikat ke orangnya.
            </p>
          ) : null}

          {kodeTabrakan.length > 0 ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
              Kode panitera di SIPP tidak dapat dipakai menunjuk orang —{" "}
              {kodeTabrakan.map(([kode, n]) => `${n} orang berkode "${kode}"`).join(", ")}. Karena
              itu tiap kode SK diikat ke orangnya di bawah ini; kodenya tetap tampil di sebelah
              namanya pada panel penetapan.
            </p>
          ) : null}

          {galat ? <p className="text-destructive">{galat}</p> : null}
          {pesan ? <p className="text-emerald-600">{pesan}</p> : null}
        </CardContent>
      </Card>

      {majelis.map((satu) => (
        <Card key={satu.majelisKode}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span>Majelis {satu.majelisKode}</span>
              {satu.bawaan ? <Badge variant="outline">belum disunting</Badge> : null}
              <Badge variant="muted">{namaHari[satu.hari] ?? satu.namaHari}</Badge>
            </CardTitle>
            <CardDescription>
              {satu.hakimKode.length > 0
                ? satu.hakimKode
                    .map((kode) => `${kode} — ${namaHakim.get(kode) ?? "tidak ada di SIPP"}`)
                    .join("  ·  ")
                : "Susunan hakimnya belum diisi — panel masih menyimpulkannya dari pemakaian di SIPP."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-sm">
            <label className="flex flex-wrap items-center gap-2">
              <span className="w-32 text-muted-foreground">Hari sidang</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-2"
                value={satu.hari}
                onChange={(e) => void simpan(satu, { hari: Number(e.target.value) })}
                disabled={sibuk === satu.majelisKode}
              >
                {namaHari.map((nama, i) => (
                  <option key={nama} value={i}>
                    {nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-wrap items-center gap-2">
              <span className="w-32 text-muted-foreground">Kode hakim</span>
              <Input
                className="max-w-xs"
                defaultValue={satu.hakimKode.join(",")}
                placeholder="A,C1,C3"
                onBlur={(e) => {
                  const baru = e.target.value.trim().toUpperCase();
                  if (baru === satu.hakimKode.join(",")) return;
                  void simpan(satu, {
                    hakimKode: baru.split(",").map((x) => x.trim()).filter(Boolean),
                  });
                }}
              />
              <span className="text-xs text-muted-foreground">
                Ketua di depan. Kode hakim_pn SIPP: {hakim.map((x) => x.kode).filter(Boolean).join(", ") || "—"}
              </span>
            </label>

            <div className="space-y-2">
              <p className="text-muted-foreground">Panitera sidang menurut SK</p>
              {satu.paniteraKode.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada kode panitera pada SK majelis ini.
                </p>
              ) : null}
              {satu.paniteraKode.map((kode) => {
                const terikat = satu.panitera.find((p) => p.kode === kode);
                return (
                  <label key={kode} className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="w-14 justify-center">
                      {kode}
                    </Badge>
                    <select
                      className="h-9 min-w-64 rounded-md border border-input bg-background px-2"
                      value={terikat?.id ?? 0}
                      disabled={sibuk === satu.majelisKode || panitera.length === 0}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        const lain = satu.panitera.filter((p) => p.kode !== kode);
                        void simpan(satu, { panitera: [...lain, { kode, id }] });
                      }}
                    >
                      <option value={0}>— belum diikat —</option>
                      {panitera.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama}
                          {p.kode ? ` (kode SIPP ${p.kode})` : " (tanpa kode SIPP)"}
                        </option>
                      ))}
                    </select>
                    {terikat?.id ? (
                      <span className="text-xs text-muted-foreground">
                        {namaPanitera.get(terikat.id) ?? "orangnya sudah tidak aktif"}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">
                        belum diikat — panel memakai giliran beban
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* ==============================================================
                TAUTAN AKUN PORTAL - HAKIM DAN PANITERA SEKALIGUS

                Dua hal yang berbeda, dan keduanya perlu: pengikatan di atas
                menunjuk orang di SIPP, yang ini menunjuk AKUN di ALETA. SIPP
                tahu siapa yang menyidangkan; portal tahu siapa yang boleh
                membuka layarnya, siapa yang diberi tahu, dan tanda tangan
                siapa yang dibubuhkan.

                Berdiri DI DALAM baris majelis, dan itu disengaja: satker
                meminta "hanya bisa ditautkan apabila masuk majelis, tidak bisa
                satu per satu". Di sini tautan itu tidak punya tempat untuk
                hidup sendirian - menghapus majelisnya menghapus tautannya.
                ============================================================== */}
            <div className="space-y-2">
              <p className="text-muted-foreground">Akun portal tiap anggota majelis</p>
              {akunAlasan ? (
                <p className="text-xs text-amber-600">
                  Daftar akun tidak terbaca: {akunAlasan}. Susunan majelisnya tetap dapat disunting.
                </p>
              ) : null}
              {[...satu.hakimKode, ...satu.paniteraKode].length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada kode hakim maupun panitera pada majelis ini — isi kodenya lebih dahulu,
                  lalu akunnya dapat ditautkan.
                </p>
              ) : null}
              {[...satu.hakimKode, ...satu.paniteraKode].map((kode) => {
                const tertaut = (satu.akun ?? []).find((a) => a.kode === kode);
                const orang = tertaut ? akun.find((u) => u.id === tertaut.akunId) : null;
                const hakimKah = satu.hakimKode.includes(kode);
                return (
                  <label key={`akun-${kode}`} className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="w-14 justify-center"
                      title={hakimKah ? "Kode hakim" : "Kode panitera sidang"}
                    >
                      {kode}
                    </Badge>
                    <span className="w-20 text-xs text-muted-foreground">
                      {hakimKah ? (satu.hakimKode[0] === kode ? "ketua" : "hakim") : "panitera"}
                    </span>
                    <select
                      className="h-9 min-w-64 rounded-md border border-input bg-background px-2"
                      value={tertaut?.akunId ?? ""}
                      disabled={sibuk === satu.majelisKode || akun.length === 0}
                      onChange={(e) => {
                        const akunId = e.target.value;
                        const lain = (satu.akun ?? []).filter((a) => a.kode !== kode);
                        void simpan(satu, {
                          akun: akunId ? [...lain, { kode, akunId }] : lain,
                        });
                      }}
                    >
                      <option value="">— belum ditautkan —</option>
                      {akun.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nama} — {u.peranLabel}
                          {u.jabatan ? ` · ${u.jabatan}` : ""}
                        </option>
                      ))}
                    </select>
                    {orang ? (
                      <span className="text-xs text-muted-foreground">
                        {orang.peranLabel}
                        {orang.jabatan ? ` · ${orang.jabatan}` : ""}
                        {orang.subPeran ? ` · +${orang.subPeran}` : ""}
                      </span>
                    ) : tertaut ? (
                      <span className="text-xs text-amber-600">
                        akunnya sudah tidak aktif atau tidak terlihat
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">belum ditautkan</span>
                    )}
                  </label>
                );
              })}
            </div>

            <label className="flex flex-wrap items-center gap-2">
              <span className="w-32 text-muted-foreground">Kode panitera SK</span>
              <Input
                className="max-w-xs"
                defaultValue={satu.paniteraKode.join(",")}
                placeholder="D,D4"
                onBlur={(e) => {
                  const baru = e.target.value.trim().toUpperCase();
                  if (baru === satu.paniteraKode.join(",")) return;
                  void simpan(satu, {
                    paniteraKode: baru.split(",").map((x) => x.trim()).filter(Boolean),
                  });
                }}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <span className="w-32 text-muted-foreground">SK</span>
              <span>
                Nomor {satu.skNomor || "-"}
                {satu.skTanggal ? ` tanggal ${tanggalPanjang(satu.skTanggal, satu.skTanggal)}` : ""}
              </span>
              <a className="text-xs text-primary underline" href="#nomor-sk">
                Ubah di kartu Nomor SK penunjukan
              </a>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={() => void muat()} disabled={memuat}>
        Muat ulang
      </Button>
    </div>
  );
}
