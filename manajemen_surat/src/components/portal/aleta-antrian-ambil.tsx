"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * MENGAMBIL ANTRIAN - DUA TAMPILAN, SATU PEKERJAAN
 * ============================================================================
 *
 * TAMPILAN PIHAK dihadapkan kepada orang yang baru datang: huruf besar,
 * pilihan sedikit, satu pertanyaan pada satu waktu. "Anda datang sebagai apa?"
 * lalu "yang keberapa?" lalu selesai. Tidak ada tabel, tidak ada istilah
 * dalam, tidak ada tombol yang tidak akan ditekan siapa pun.
 *
 * TAMPILAN PETUGAS dihadapkan kepada yang mengerjakannya sepanjang hari:
 * seluruh sidang hari ini dalam satu daftar rapat, siapa yang sudah hadir
 * terbaca sekilas, dan pencatatan cukup beberapa tekanan tanpa berpindah
 * halaman.
 *
 * Keduanya menulis ke tempat yang sama. Yang berbeda hanya BENTUK
 * PERTANYAANNYA - dan itu bukan hiasan: orang yang ditanya "peran" sambil
 * menatap tabel berisi dua puluh perkara akan menjawab dengan menebak.
 *
 * ============================================================================
 * SIAPA YANG MENEKAN
 * ============================================================================
 *
 * Kedua tampilan dibuka PETUGAS - layar ini berada di balik login. Tampilan
 * pihak adalah layar yang DIPUTAR menghadap orang yang datang, bukan halaman
 * yang dibuka sendiri oleh pihak berperkara. Pihak yang ingin mengambil dari
 * rumah memakai WhatsApp, jalur yang identitasnya terbukti dari nomor
 * pengirimnya.
 */

type SidangBaris = {
  perkaraId: string;
  nomorPerkara: string;
  jamSidang: string;
  agenda: string;
  ruangan: string;
  pihak: { penggugat: string[]; tergugat: string[] };
};

type KehadiranBaris = {
  sebutan: string;
  nama: string;
  jam: string;
  sumber: string;
};

type PeranPilihan = { kunci: string; label: string; sisi: string };

/** Urutan pihak yang lazim. Lebih dari lima ditulis petugas sendiri. */
const URUTAN = ["", "I", "II", "III", "IV", "V"];

export function AletaAntrianAmbil() {
  const [tampilan, setTampilan] = useState<"pihak" | "petugas">("petugas");
  const [sidang, setSidang] = useState<SidangBaris[]>([]);
  const [kehadiran, setKehadiran] = useState<Record<string, { hadir: KehadiranBaris[] }>>({});
  const [antrian, setAntrian] = useState<Record<string, { nomor: number | null; keadaan: string }>>({});
  const [peran, setPeran] = useState<PeranPilihan[]>([]);
  const [cari, setCari] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState("");

  const hariIni = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);

  /**
   * Penyegaran SESUDAH pencatatan tidak boleh menampilkan "Memuat…".
   *
   * Kalau ia menampilkannya, tampilan pihak yang sedang memperlihatkan nomor
   * antrian ikut dilepas dari layar - dan begitu ia dipasang kembali, seluruh
   * keadaannya sudah kosong. Orang yang baru saja menekan "Ambil nomor
   * antrian" karena itu tidak pernah melihat nomornya sama sekali; layarnya
   * hanya berkedip lalu kembali ke daftar perkara.
   *
   * Karena itu pesan memuat hanya untuk muatan PERTAMA.
   */
  const [pertamaMuat, setPertamaMuat] = useState(true);

  const muat = useCallback(async () => {
    try {
      const [jadwal, antre, daftarPeran] = await Promise.all([
        fetch(apiPath(`/api/aleta-ecourt/sidang?dari=${hariIni}&sampai=${hariIni}&batas=200`), {
          cache: "no-store",
        }).then((r) => r.json()),
        fetch(apiPath("/api/aleta-ecourt/antrian"), { cache: "no-store" }).then((r) => r.json()),
        fetch(apiPath("/api/aleta-ecourt/antrian/hadir"), { cache: "no-store" }).then((r) => r.json()),
      ]);

      const isiJadwal = (jadwal.data ?? jadwal) as { sidang?: SidangBaris[] };
      const isiAntre = (antre.data ?? antre) as {
        peta?: Record<string, { nomor: number | null; keadaan: string }>;
        kehadiran?: Record<string, { hadir: KehadiranBaris[] }>;
      };
      const isiPeran = (daftarPeran.data ?? daftarPeran) as { peran?: PeranPilihan[] };

      setSidang(Array.isArray(isiJadwal.sidang) ? isiJadwal.sidang : []);
      setAntrian(isiAntre.peta ?? {});
      setKehadiran(isiAntre.kehadiran ?? {});
      setPeran(Array.isArray(isiPeran.peran) ? isiPeran.peran : []);
      return isiAntre.peta ?? {};
    } catch (error) {
      setPesan(error instanceof Error ? error.message : String(error));
      return {};
    } finally {
      setMemuat(false);
      setPertamaMuat(false);
    }
  }, [hariIni]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const tersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    if (!kata) return sidang;
    return sidang.filter(
      (baris) =>
        baris.nomorPerkara.toLowerCase().includes(kata) ||
        [...baris.pihak.penggugat, ...baris.pihak.tergugat].some((n) =>
          n.toLowerCase().includes(kata)
        )
    );
  }, [cari, sidang]);

  const catat = useCallback(
    async (muatan: {
      perkaraId: string;
      nomorPerkara: string;
      peran: string;
      urutanPihak: string;
      sebagaiKuasa: boolean;
      nama: string;
    }) => {
      setPesan("");
      try {
        const respons = await fetch(apiPath("/api/aleta-ecourt/antrian/hadir"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(muatan),
        });
        const isi = (await respons.json()) as { data?: Record<string, unknown> };
        const hasil = (isi.data ?? isi) as { ok?: boolean; alasan?: string; sebutan?: string; antrianDiisi?: boolean };

        if (hasil.ok === false) {
          setPesan(hasil.alasan || "Kehadiran tidak tersimpan.");
          return null;
        }

        setPesan(
          `${hasil.sebutan} dicatat hadir.` +
            (hasil.antrianDiisi
              ? " Nomor antriannya terbit."
              : " Nomor antrian perkara ini sudah ada sebelumnya dan tidak diubah.")
        );

        // Nomornya dibaca dari muatan yang BARU, bukan dari keadaan yang
        // tersimpan sebelum pencatatan. Membacanya dari keadaan lama selalu
        // menghasilkan kosong pada pengambilan pertama - persis pada keadaan
        // yang paling penting menampilkan nomornya.
        const petaBaru = await muat();
        return {
          ...hasil,
          nomorAntrian: petaBaru[muatan.perkaraId]?.nomor ?? null,
        };
      } catch (error) {
        setPesan(error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [muat]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ambil antrian sidang</h2>
          <p className="text-sm text-muted-foreground">
            Nomor antrian terbit dari kehadiran yang PERTAMA pada satu perkara. Yang datang
            berikutnya tetap dicatat, tetapi tidak mengubah nomornya.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border text-sm">
          <button
            type="button"
            onClick={() => setTampilan("pihak")}
            className={cn("px-3 py-1.5", tampilan === "pihak" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            Tampilan pihak
          </button>
          <button
            type="button"
            onClick={() => setTampilan("petugas")}
            className={cn(
              "border-l px-3 py-1.5",
              tampilan === "petugas" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            Tampilan petugas
          </button>
        </div>
      </div>

      <Input
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="Cari nomor perkara atau nama pihak…"
        className={tampilan === "pihak" ? "h-14 text-lg" : ""}
      />

      {pesan ? (
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">{pesan}</div>
      ) : null}

      {pertamaMuat && memuat ? (
        <p className="text-sm text-muted-foreground">Memuat jadwal hari ini…</p>
      ) : tersaring.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {sidang.length === 0
            ? "Tidak ada sidang terjadwal hari ini."
            : "Tidak ada perkara yang cocok dengan pencarian."}
        </p>
      ) : tampilan === "pihak" ? (
        <TampilanPihak sidang={tersaring} peran={peran} onCatat={catat} />
      ) : (
        <TampilanPetugas
          sidang={tersaring}
          antrian={antrian}
          kehadiran={kehadiran}
          peran={peran}
          onCatat={catat}
        />
      )}
    </div>
  );
}

/**
 * Tampilan pihak: satu perkara sekali lihat, satu pertanyaan sekali tekan.
 *
 * Perkaranya dipilih lebih dulu, baru perannya. Menaruh keduanya sekaligus
 * membuat orang menekan peran pada perkara yang salah - dan kekeliruan itu
 * baru ketahuan saat namanya dipanggil di ruangan yang bukan ruangannya.
 */
function TampilanPihak({
  sidang,
  peran,
  onCatat,
}: {
  sidang: SidangBaris[];
  peran: PeranPilihan[];
  onCatat: (m: {
    perkaraId: string;
    nomorPerkara: string;
    peran: string;
    urutanPihak: string;
    sebagaiKuasa: boolean;
    nama: string;
  }) => Promise<unknown>;
}) {
  const [dipilih, setDipilih] = useState<SidangBaris | null>(null);
  const [peranDipilih, setPeranDipilih] = useState("");
  const [urutan, setUrutan] = useState("");
  const [kuasa, setKuasa] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  /**
   * Layar akhir. `null` berarti belum ada pengambilan; `sudah` berarti sudah,
   * dan `nomor` boleh kosong - perkara yang belum terdaftar di mesin antrian
   * tidak mendapat nomor, dan itu keadaan yang harus TERBACA, bukan
   * disembunyikan dengan tidak menampilkan apa-apa.
   */
  const [selesai, setSelesai] = useState<{ nomor: number | null } | null>(null);

  if (selesai) {
    return (
      <div className="rounded-2xl border border-emerald-600/40 bg-emerald-50 p-8 text-center dark:bg-emerald-950/30">
        <p className="text-sm uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
          {selesai.nomor === null ? "Kehadiran Anda tercatat" : "Nomor antrian Anda"}
        </p>
        {selesai.nomor === null ? (
          <p className="mt-3 text-lg">
            Kehadiran Anda sudah dicatat, tetapi perkara ini belum terdaftar di mesin antrian
            sehingga nomornya belum terbit. Silakan menghubungi petugas.
          </p>
        ) : (
          <>
            <p className="mt-1 text-8xl font-bold leading-none tabular-nums text-emerald-700 dark:text-emerald-300">
              {selesai.nomor}
            </p>
            <p className="mt-3 text-base">
              Silakan menunggu. Nomor Anda akan dipanggil di layar dan lewat pengeras suara.
            </p>
          </>
        )}
        <Button
          className="mt-5 h-12 px-8 text-base"
          onClick={() => {
            setSelesai(null);
            setDipilih(null);
            setPeranDipilih("");
            setUrutan("");
            setKuasa(false);
          }}
        >
          Selesai
        </Button>
      </div>
    );
  }

  if (!dipilih) {
    return (
      <div className="space-y-2">
        <p className="text-base">Pilih perkara Anda:</p>
        {sidang.slice(0, 30).map((baris) => (
          <button
            key={baris.perkaraId}
            type="button"
            onClick={() => setDipilih(baris)}
            className="w-full rounded-xl border p-4 text-left transition hover:bg-muted"
          >
            <div className="text-xl font-semibold">{baris.nomorPerkara}</div>
            <div className="mt-0.5 text-sm text-muted-foreground">
              {baris.jamSidang || "—"} · {baris.ruangan || "ruang belum ditetapkan"}
            </div>
            {baris.pihak.penggugat.length > 0 ? (
              <div className="mt-1 text-sm">
                {baris.pihak.penggugat[0]}
                {baris.pihak.tergugat.length > 0 ? ` lawan ${baris.pihak.tergugat[0]}` : ""}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/30 p-4">
        <div className="text-lg font-semibold">{dipilih.nomorPerkara}</div>
        <button
          type="button"
          className="mt-1 text-sm underline text-muted-foreground"
          onClick={() => setDipilih(null)}
        >
          ganti perkara
        </button>
      </div>

      <p className="text-base">Anda datang sebagai:</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {peran.map((satu) => (
          <button
            key={satu.kunci}
            type="button"
            onClick={() => setPeranDipilih(satu.kunci)}
            className={cn(
              "rounded-xl border p-4 text-lg font-medium transition",
              peranDipilih === satu.kunci ? "border-primary bg-primary/10" : "hover:bg-muted"
            )}
          >
            {satu.label}
          </button>
        ))}
      </div>

      {peranDipilih && peranDipilih !== "saksi" ? (
        <>
          <p className="text-base">Yang keberapa? (kosongkan bila hanya satu)</p>
          <div className="flex flex-wrap gap-2">
            {URUTAN.map((satu) => (
              <button
                key={`urut-${satu || "tunggal"}`}
                type="button"
                onClick={() => setUrutan(satu)}
                className={cn(
                  "min-w-[4rem] rounded-xl border px-4 py-3 text-lg font-medium transition",
                  urutan === satu ? "border-primary bg-primary/10" : "hover:bg-muted"
                )}
              >
                {satu || "Tunggal"}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-base">
            <input
              type="checkbox"
              checked={kuasa}
              onChange={(e) => setKuasa(e.target.checked)}
              className="h-5 w-5"
            />
            Saya kuasa hukumnya, bukan pihaknya sendiri
          </label>
        </>
      ) : null}

      <Button
        className="h-14 w-full text-lg"
        disabled={!peranDipilih || menyimpan}
        onClick={async () => {
          // Dikunci selama menyimpan. Tanpa ini, tekanan kedua pada tombol
          // sebesar ini - dan orang yang ragu memang menekannya dua kali -
          // mencatat kehadiran yang sama dua kali.
          setMenyimpan(true);
          try {
            const hasil = (await onCatat({
              perkaraId: dipilih.perkaraId,
              nomorPerkara: dipilih.nomorPerkara,
              peran: peranDipilih,
              urutanPihak: urutan,
              sebagaiKuasa: kuasa,
              nama: "",
            })) as { nomorAntrian?: number | null } | null;

            // Nomornya datang dari pencatatan itu sendiri, bukan dari keadaan
            // yang sudah tersimpan sebelumnya.
            // Gagal menyimpan tidak berpindah layar - pesannya sudah tampil
            // di atas, dan berpindah akan menyembunyikannya.
            if (hasil) setSelesai({ nomor: hasil.nomorAntrian ?? null });
          } finally {
            setMenyimpan(false);
          }
        }}
      >
        {menyimpan ? "Menyimpan…" : "Ambil nomor antrian"}
      </Button>
    </div>
  );
}

/**
 * Tampilan petugas: seluruh sidang hari ini, siapa yang sudah hadir, dan
 * pencatatan tanpa berpindah halaman.
 */
function TampilanPetugas({
  sidang,
  antrian,
  kehadiran,
  peran,
  onCatat,
}: {
  sidang: SidangBaris[];
  antrian: Record<string, { nomor: number | null; keadaan: string }>;
  kehadiran: Record<string, { hadir: KehadiranBaris[] }>;
  peran: PeranPilihan[];
  onCatat: (m: {
    perkaraId: string;
    nomorPerkara: string;
    peran: string;
    urutanPihak: string;
    sebagaiKuasa: boolean;
    nama: string;
  }) => Promise<unknown>;
}) {
  const [terbuka, setTerbuka] = useState("");

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted text-left text-sm uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 font-medium">Antrian</th>
            <th className="px-3 py-2 font-medium">Jam</th>
            <th className="px-3 py-2 font-medium">Perkara</th>
            <th className="px-3 py-2 font-medium">Sudah hadir</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {sidang.map((baris) => {
            const antre = antrian[baris.perkaraId];
            const hadir = kehadiran[baris.perkaraId]?.hadir ?? [];
            return (
              <tr key={baris.perkaraId} className="border-t align-top">
                <td className="px-3 py-2">
                  {antre?.nomor ? (
                    <span className="text-xl font-bold tabular-nums">{antre.nomor}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">belum</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{baris.jamSidang || "—"}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{baris.nomorPerkara}</div>
                  <div className="text-sm text-muted-foreground">{baris.ruangan || "—"}</div>
                </td>
                <td className="px-3 py-2">
                  {hadir.length === 0 ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {hadir.map((satu, urutan) => (
                        <li key={`${baris.perkaraId}-${urutan}`} className="text-sm">
                          <span className={urutan === 0 ? "font-semibold" : ""}>{satu.sebutan}</span>
                          {satu.nama ? ` — ${satu.nama}` : ""}
                          <span className="text-muted-foreground"> · {satu.jam}</span>
                          {urutan === 0 ? (
                            <span className="ml-1 rounded bg-emerald-100 px-1 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              hadir pertama
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTerbuka(terbuka === baris.perkaraId ? "" : baris.perkaraId)}
                  >
                    {terbuka === baris.perkaraId ? "Tutup" : "Catat hadir"}
                  </Button>
                  {terbuka === baris.perkaraId ? (
                    <FormulirHadir
                      baris={baris}
                      peran={peran}
                      onCatat={async (muatan) => {
                        await onCatat(muatan);
                        setTerbuka("");
                      }}
                    />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FormulirHadir({
  baris,
  peran,
  onCatat,
}: {
  baris: SidangBaris;
  peran: PeranPilihan[];
  onCatat: (m: {
    perkaraId: string;
    nomorPerkara: string;
    peran: string;
    urutanPihak: string;
    sebagaiKuasa: boolean;
    nama: string;
  }) => Promise<void>;
}) {
  const [peranDipilih, setPeranDipilih] = useState(peran[0]?.kunci ?? "");
  const [urutan, setUrutan] = useState("");
  const [kuasa, setKuasa] = useState(false);
  const [nama, setNama] = useState("");

  return (
    <div className="mt-2 space-y-2 rounded-lg border bg-muted/20 p-2 text-left">
      <div className="flex flex-wrap gap-1">
        {peran.map((satu) => (
          <button
            key={satu.kunci}
            type="button"
            onClick={() => setPeranDipilih(satu.kunci)}
            className={cn(
              "rounded border px-2 py-1 text-sm",
              peranDipilih === satu.kunci ? "border-primary bg-primary/10" : "hover:bg-muted"
            )}
          >
            {satu.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {URUTAN.map((satu) => (
          <button
            key={`u-${satu || "t"}`}
            type="button"
            onClick={() => setUrutan(satu)}
            className={cn(
              "rounded border px-2 py-1 text-sm",
              urutan === satu ? "border-primary bg-primary/10" : "hover:bg-muted"
            )}
          >
            {satu || "Tunggal"}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1 text-sm">
          <input type="checkbox" checked={kuasa} onChange={(e) => setKuasa(e.target.checked)} />
          kuasa
        </label>
      </div>
      <Input
        value={nama}
        onChange={(e) => setNama(e.target.value)}
        placeholder="Nama yang hadir (boleh dikosongkan)"
        className="h-8 text-sm"
      />
      <Button
        size="sm"
        className="w-full"
        disabled={!peranDipilih}
        onClick={() =>
          void onCatat({
            perkaraId: baris.perkaraId,
            nomorPerkara: baris.nomorPerkara,
            peran: peranDipilih,
            urutanPihak: urutan,
            sebagaiKuasa: kuasa,
            nama,
          })
        }
      >
        Simpan kehadiran
      </Button>
    </div>
  );
}
