"use client";

/**
 * Pengaturan e-Court yang dapat disunting panitera.
 *
 * Pengklasifikasi menebak jenis dokumen dari JUDULNYA, dan yang tahu bentuk
 * judul yang lazim di pengadilan ini adalah panitera - bukan yang menulis
 * kodenya. Tanpa penyuntingan di sini, satu judul tidak dikenali berarti
 * menunggu pembaruan aplikasi, sementara dokumennya tidak diberitahukan ke
 * pihak lawan sama sekali.
 */

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

type Aturan = {
  key: string;
  label: string;
  patterns: string[];
  notify: boolean;
  audience: string;
  tenggatBerlaku: boolean;
  ringkasan: string;
  tindakan: string;
  bawaan: boolean;
};

type Agenda = {
  key: string;
  label: string;
  patterns: string[];
  persiapan: string[];
  h3: boolean;
  h1: boolean;
  bawaan: boolean;
};

type Pengaturan = {
  aktif: boolean;
  ambangMendesakHari: number;
  tanyaUlangHari: number;
  aturan: Aturan[];
};

const ALASAN_TERBACA: Record<string, string> = {
  pola_kosong: "Pola judul tidak boleh kosong.",
  persiapan_kosong: "Daftar persiapan tidak boleh kosong. Agenda tanpa persiapan lebih buruk daripada agenda yang belum dikenali.",
  kunci_kosong: "Jenis dokumen tidak boleh kosong.",
  audience_tidak_dikenali: "Pilih siapa yang diberitahu: lawan, sendiri, atau pegawai.",
  aturan_tidak_ditemukan: "Aturan itu tidak ada di daftar timpaan.",
  ambang_mendesak_di_luar_1_sampai_30: "Ambang mendesak harus antara 1 dan 30 hari.",
  tanya_ulang_di_luar_1_sampai_60: "Tenggang tanya ulang harus antara 1 dan 60 hari.",
  bot_tidak_terjangkau: "ALETA Bot belum dapat dihubungi.",
};

function bacaAlasan(alasan?: string): string {
  if (!alasan) return "Perubahan gagal disimpan.";
  return ALASAN_TERBACA[alasan] ?? `Perubahan gagal disimpan (${alasan}).`;
}

export function AletaBotEcourtPengaturan() {
  const [data, setData] = useState<Pengaturan | null>(null);
  const [agenda, setAgenda] = useState<Agenda[]>([]);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [catatan, setCatatan] = useState("");

  // Aturan yang sedang dibuka, beserta teks polanya dalam bentuk yang disunting.
  const [sunting, setSunting] = useState<{ key: string; polaTeks: string } | null>(null);
  const [suntingAgenda, setSuntingAgenda] = useState<{ key: string; polaTeks: string; persiapanTeks: string } | null>(null);
  const [ambang, setAmbang] = useState("3");
  const [tanyaUlang, setTanyaUlang] = useState("3");

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const respons = await fetch(apiPath("/api/aleta-bot/ecourt/pengaturan"), { cache: "no-store" });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      if (!isi?.available) {
        setPesan(isi?.message || "ALETA Bot belum dapat dihubungi.");
        setData(null);
      } else {
        setPesan("");
        setData(isi.pengaturan);
        setAgenda(Array.isArray(isi.agenda) ? isi.agenda : []);
        setAmbang(String(isi.pengaturan?.ambangMendesakHari ?? 3));
        setTanyaUlang(String(isi.pengaturan?.tanyaUlangHari ?? 3));
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal memuat pengaturan.");
      setData(null);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const kirim = useCallback(
    async (payload: Record<string, unknown>, pesanBerhasil: string) => {
      setMenyimpan(true);
      setCatatan("");
      try {
        const respons = await fetch(apiPath("/api/aleta-bot/ecourt/pengaturan"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const hasil = await respons.json();
        const isi = hasil?.data ?? hasil;
        if (isi?.ok) {
          setCatatan(isi.kembaliKeBawaan ? "Dikembalikan ke bentuk bawaan." : pesanBerhasil);
          setSunting(null);
          setSuntingAgenda(null);
          await muat();
        } else {
          setCatatan(bacaAlasan(isi?.alasan));
        }
      } catch (error) {
        setCatatan(error instanceof Error ? error.message : "Perubahan gagal disimpan.");
      } finally {
        setMenyimpan(false);
      }
    },
    [muat]
  );

  if (memuat) {
    return <p className="p-6 text-sm text-muted-foreground">Memuat pengaturan…</p>;
  }

  if (pesan || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan belum dapat dibaca</CardTitle>
          <CardDescription>{pesan}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => void muat()}>
            Coba lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {catatan ? (
        <p className="rounded border border-border bg-muted/40 p-3 text-sm">{catatan}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ambang Hari</CardTitle>
          <CardDescription>
            Berlaku seketika tanpa perlu menyalakan ulang bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="ambang-mendesak">
                Tenggat dianggap mendesak
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="ambang-mendesak"
                  type="number"
                  min={1}
                  max={30}
                  value={ambang}
                  onChange={(event) => setAmbang(event.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">hari sebelum batas waktu</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Dipakai halaman Ringkasan Panitera dan pengingat sisa hari di pesan.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="tanya-ulang">
                Tanya ulang konfirmasi nomor
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="tanya-ulang"
                  type="number"
                  min={1}
                  max={60}
                  value={tanyaUlang}
                  onChange={(event) => setTanyaUlang(event.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">hari bila belum dijawab</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Terlalu cepat membuat pihak yang belum sempat membaca ditanya berkali-kali — perilaku yang membuat nomor
                diblokir WhatsApp.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            disabled={menyimpan}
            onClick={() =>
              void kirim(
                {
                  aksi: "simpan-ambang",
                  ambangMendesakHari: Number(ambang),
                  tanyaUlangHari: Number(tanyaUlang),
                },
                "Ambang hari tersimpan."
              )
            }
          >
            {menyimpan ? "Menyimpan…" : "Simpan Ambang"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aturan Pemberitahuan</CardTitle>
          <CardDescription>
            Judul dokumen dari e-Court dicocokkan dengan pola di bawah. Bila ada dokumen yang tidak dikenali, tambahkan
            polanya di sini — tanpa itu dokumen tersebut tidak diberitahukan sama sekali.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.aturan.map((item) => {
            const sedangDisunting = sunting?.key === item.key;
            return (
              <div key={item.key} className="rounded border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {item.label}
                      {item.bawaan ? <Badge variant="muted">bawaan</Badge> : <Badge variant="outline">tambahan</Badge>}
                      {item.notify ? null : <Badge variant="muted">tidak diberitahukan</Badge>}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pola: {item.patterns.join(", ") || "—"}
                    </p>
                    {item.notify ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Diberitahukan kepada {item.audience || "—"} · {item.tenggatBerlaku ? "memakai tenggat" : "tanpa tenggat"}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={menyimpan}
                    onClick={() =>
                      setSunting(sedangDisunting ? null : { key: item.key, polaTeks: item.patterns.join(", ") })
                    }
                  >
                    {sedangDisunting ? "Tutup" : "Ubah Pola"}
                  </Button>
                </div>

                {sedangDisunting ? (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor={`pola-${item.key}`}>
                        Pola judul, dipisahkan koma
                      </label>
                      <Input
                        id={`pola-${item.key}`}
                        value={sunting.polaTeks}
                        onChange={(event) => setSunting({ key: item.key, polaTeks: event.target.value })}
                        placeholder="jawaban, jawaban tergugat, eksepsi"
                      />
                      <p className="text-xs text-muted-foreground">
                        Pencocokan tidak membedakan huruf besar-kecil. Judul yang memuat salah satu pola akan dikenali
                        sebagai jenis ini.
                      </p>
                    </div>

                    {item.bawaan ? (
                      <p className="rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
                        Siapa yang diberitahu tidak dapat diubah untuk jenis bawaan. Mengubahnya lewat satu klik terlalu
                        mudah untuk kesalahan yang akibatnya tidak terlihat — tidak ada pesan galat, hanya pemberitahuan
                        yang berhenti atau salah tujuan.
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={menyimpan}
                        onClick={() =>
                          void kirim(
                            {
                              aksi: "simpan-aturan",
                              key: item.key,
                              patterns: sunting.polaTeks.split(",").map((x) => x.trim()).filter(Boolean),
                              ringkasan: item.ringkasan,
                              tindakan: item.tindakan,
                              audience: item.audience,
                              notify: item.notify,
                            },
                            "Aturan tersimpan."
                          )
                        }
                      >
                        {menyimpan ? "Menyimpan…" : "Simpan"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={menyimpan}
                        onClick={() =>
                          void kirim(
                            { aksi: "hapus-aturan", key: item.key },
                            item.bawaan ? "Dikembalikan ke bawaan." : "Aturan dihapus."
                          )
                        }
                      >
                        {item.bawaan ? "Kembalikan ke Bawaan" : "Hapus Aturan"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Persiapan Sidang per Agenda</CardTitle>
          <CardDescription>
            Agenda sidang dari SIPP diterjemahkan menjadi daftar persiapan yang dipahami pihak. Kalimatnya adalah
            pernyataan pengadilan tentang hukum acara — yang berhak menyusunnya panitera, bukan pembuat aplikasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {agenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">Daftar agenda belum dapat dibaca dari ALETA Bot.</p>
          ) : (
            agenda.map((item) => {
              const sedangDisunting = suntingAgenda?.key === item.key;
              return (
                <div key={item.key} className="rounded border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {item.label}
                        {item.bawaan ? <Badge variant="muted">bawaan</Badge> : <Badge variant="outline">tambahan</Badge>}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">Pola agenda: {item.patterns.join(", ") || "—"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Diingatkan {item.h3 ? "H-3" : ""}
                        {item.h3 && item.h1 ? " dan " : ""}
                        {item.h1 ? "H-1" : ""}
                        {!item.h3 && !item.h1 ? "tidak diingatkan" : ""} · {item.persiapan.length} butir persiapan
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={menyimpan}
                      onClick={() =>
                        setSuntingAgenda(
                          sedangDisunting
                            ? null
                            : {
                                key: item.key,
                                polaTeks: item.patterns.join(", "),
                                persiapanTeks: item.persiapan.join("\n"),
                              }
                        )
                      }
                    >
                      {sedangDisunting ? "Tutup" : "Ubah"}
                    </Button>
                  </div>

                  {sedangDisunting ? (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor={`agenda-pola-${item.key}`}>
                          Pola agenda, dipisahkan koma
                        </label>
                        <Input
                          id={`agenda-pola-${item.key}`}
                          value={suntingAgenda.polaTeks}
                          onChange={(event) =>
                            setSuntingAgenda({ ...suntingAgenda, polaTeks: event.target.value })
                          }
                          placeholder="saksi, pemeriksaan saksi"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor={`agenda-siap-${item.key}`}>
                          Daftar persiapan, satu baris satu butir
                        </label>
                        <textarea
                          id={`agenda-siap-${item.key}`}
                          rows={5}
                          value={suntingAgenda.persiapanTeks}
                          onChange={(event) =>
                            setSuntingAgenda({ ...suntingAgenda, persiapanTeks: event.target.value })
                          }
                          className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                          placeholder={"Bawa dua orang saksi dewasa.\nBawa KTP asli saksi."}
                        />
                        <p className="text-xs text-muted-foreground">
                          Ditulis untuk dibaca pihak yang tidak paham istilah hukum. Paling banyak 12 butir.
                        </p>
                      </div>

                      {item.bawaan ? (
                        <p className="rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
                          Kapan diingatkan tidak dapat diubah untuk agenda bawaan. Mematikan pengingat H-3 pada agenda
                          yang menuntut persiapan berhari-hari membuat pihak datang tanpa saksi, dan tidak ada pesan
                          galat yang menandakannya.
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={menyimpan}
                          onClick={() =>
                            void kirim(
                              {
                                aksi: "simpan-agenda",
                                key: item.key,
                                patterns: suntingAgenda.polaTeks.split(",").map((x) => x.trim()).filter(Boolean),
                                persiapan: suntingAgenda.persiapanTeks.split("\n").map((x) => x.trim()).filter(Boolean),
                              },
                              "Persiapan sidang tersimpan."
                            )
                          }
                        >
                          {menyimpan ? "Menyimpan…" : "Simpan"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={menyimpan}
                          onClick={() =>
                            void kirim(
                              { aksi: "hapus-agenda", key: item.key },
                              item.bawaan ? "Dikembalikan ke bawaan." : "Padanan dihapus."
                            )
                          }
                        >
                          {item.bawaan ? "Kembalikan ke Bawaan" : "Hapus"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
