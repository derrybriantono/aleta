import { type InstitutionIdentity } from "@/lib/types";

export type CourtDirectoryEntry = {
  id: string;
  courtName: string;
  satkerLabel: string;
  identity: InstitutionIdentity;
};

function slugifyCourtName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deriveCourtShortName(courtName: string) {
  if (courtName === "Mahkamah Agung Republik Indonesia") return "Mahkamah Agung RI";
  if (courtName === "Badan Peradilan Agama") return "Ditjen Badilag";
  if (courtName === "Badan Urusan Administrasi MA RI") return "BUA MA RI";
  if (courtName.startsWith("Pengadilan Tinggi Agama ")) {
    return `PTA ${courtName.replace("Pengadilan Tinggi Agama ", "").trim()}`;
  }
  if (courtName.startsWith("Pengadilan Agama ")) {
    return `PA ${courtName.replace("Pengadilan Agama ", "").replace(" Kelas IA", "").trim()}`;
  }
  if (courtName.startsWith("Pengadilan Negeri ")) {
    return `PN ${courtName.replace("Pengadilan Negeri ", "").trim()}`;
  }
  return courtName;
}

function deriveSatkerLabel(courtName: string) {
  if (courtName === "Mahkamah Agung Republik Indonesia") return "Pusat / Mahkamah Agung";
  if (courtName === "Badan Peradilan Agama") return "Eselon I / Ditjen Badilag";
  if (courtName === "Badan Urusan Administrasi MA RI") return "Eselon I / Badan Urusan Administrasi";
  if (courtName.startsWith("Pengadilan Tinggi Agama ")) return "Peradilan Agama Tingkat Banding";
  if (courtName.startsWith("Pengadilan Agama ")) return "Peradilan Agama Tingkat Pertama";
  if (courtName.startsWith("Pengadilan Negeri ")) return "Peradilan Umum Tingkat Pertama";
  return "Satuan Kerja Peradilan";
}

function buildIdentity(
  courtName: string,
  overrides: Partial<InstitutionIdentity> = {}
): InstitutionIdentity {
  const shortName = overrides.courtShortName ?? deriveCourtShortName(courtName);
  return {
    courtName,
    courtShortName: shortName,
    address: overrides.address ?? "",
    phoneNumber: overrides.phoneNumber ?? "",
    mobilePhone: overrides.mobilePhone ?? "",
    email: overrides.email ?? "",
    instagram: overrides.instagram ?? undefined,
    facebook: overrides.facebook ?? undefined,
    youtube: overrides.youtube ?? undefined,
    website: overrides.website ?? undefined,
    mapUrl:
      overrides.mapUrl ??
      (courtName ? `https://maps.google.com/?q=${encodeURIComponent(courtName)}` : undefined),
  };
}

function buildCourtEntry(
  id: string,
  courtName: string,
  overrides: Partial<InstitutionIdentity> = {}
): CourtDirectoryEntry {
  return {
    id,
    courtName,
    satkerLabel: deriveSatkerLabel(courtName),
    identity: buildIdentity(courtName, overrides),
  };
}

export const courtDirectoryCatalog: CourtDirectoryEntry[] = [
  buildCourtEntry("ma-ri", "Mahkamah Agung Republik Indonesia", {
    courtShortName: "Mahkamah Agung RI",
    address: "Jl. Medan Merdeka Utara No. 9-13, Jakarta Pusat, DKI Jakarta 10110",
    phoneNumber: "(021) 3843348",
    mobilePhone: "(021) 3810350",
    email: "persuratan@mahkamahagung.go.id",
    website: "https://www.mahkamahagung.go.id",
    mapUrl: "https://maps.google.com/?q=Mahkamah+Agung+Republik+Indonesia",
  }),
  buildCourtEntry("badilag", "Badan Peradilan Agama", {
    courtShortName: "Ditjen Badilag",
    address: "Gedung Sekretariat Mahkamah Agung RI, Jakarta Pusat",
    phoneNumber: "",
    mobilePhone: "",
    email: "",
    website: "https://badilag.mahkamahagung.go.id",
    mapUrl: "https://maps.google.com/?q=Badan+Peradilan+Agama",
  }),
  buildCourtEntry("bua-ma", "Badan Urusan Administrasi MA RI", {
    courtShortName: "BUA MA RI",
    address: "Gedung Sekretariat Mahkamah Agung RI, Jakarta Pusat",
    phoneNumber: "",
    mobilePhone: "",
    email: "",
    website: "https://bua.mahkamahagung.go.id",
    mapUrl: "https://maps.google.com/?q=Badan+Urusan+Administrasi+Mahkamah+Agung",
  }),
  buildCourtEntry("pta-makassar", "Pengadilan Tinggi Agama Makassar", {
    courtShortName: "PTA Makassar",
    address: "Jl. Perintis Kemerdekaan Km. 14, Makassar, Sulawesi Selatan",
    phoneNumber: "",
    mobilePhone: "",
    email: "",
    website: "https://pta-makassar.go.id",
    mapUrl: "https://maps.google.com/?q=Pengadilan+Tinggi+Agama+Makassar",
  }),
  buildCourtEntry("pa-makassar", "Pengadilan Agama Makassar Kelas IA", {
    courtShortName: "PA Makassar",
    address: "Jl. Perintis Kemerdekaan Km. 14, Makassar, Sulawesi Selatan",
    phoneNumber: "(0411) 554122",
    mobilePhone: "0811-4411-2200",
    email: "pa.makassar@pta-makassar.go.id",
    instagram: "@pa_makassar",
    facebook: "Pengadilan Agama Makassar",
    youtube: "PA Makassar Official",
    website: "https://pa-makassar.go.id",
    mapUrl: "https://maps.google.com/?q=Pengadilan+Agama+Makassar",
  }),
  buildCourtEntry("pa-sungguminasa", "Pengadilan Agama Sungguminasa", {
    website: "https://pa-sungguminasa.go.id",
  }),
  buildCourtEntry("pa-maros", "Pengadilan Agama Maros", {
    website: "https://pa-maros.go.id",
  }),
  buildCourtEntry("pa-pangkajene", "Pengadilan Agama Pangkajene", {
    website: "https://pa-pangkajene.go.id",
  }),
  buildCourtEntry("pa-barru", "Pengadilan Agama Barru", {
    website: "https://pa-barru.go.id",
  }),
  buildCourtEntry("pa-parepare", "Pengadilan Agama Parepare", {
    website: "https://pa-parepare.go.id",
  }),
  buildCourtEntry("pa-sidrap", "Pengadilan Agama Sidrap", {
    website: "https://pa-sidrap.go.id",
  }),
  buildCourtEntry("pa-pinrang", "Pengadilan Agama Pinrang", {
    website: "https://pa-pinrang.go.id",
  }),
  buildCourtEntry("pa-sengkang", "Pengadilan Agama Sengkang", {
    website: "https://pa-sengkang.go.id",
  }),
  buildCourtEntry("pa-soppeng", "Pengadilan Agama Soppeng", {
    website: "https://pa-soppeng.go.id",
  }),
  buildCourtEntry("pa-watampone", "Pengadilan Agama Watampone", {
    website: "https://pa-watampone.go.id",
  }),
  buildCourtEntry("pa-sinjai", "Pengadilan Agama Sinjai", {
    website: "https://pa-sinjai.go.id",
  }),
  buildCourtEntry("pa-bulukumba", "Pengadilan Agama Bulukumba", {
    website: "https://pa-bulukumba.go.id",
  }),
  buildCourtEntry("pa-bantaeng", "Pengadilan Agama Bantaeng", {
    website: "https://pa-bantaeng.go.id",
  }),
  buildCourtEntry("pa-jeneponto", "Pengadilan Agama Jeneponto", {
    website: "https://pa-jeneponto.go.id",
  }),
  buildCourtEntry("pa-takalar", "Pengadilan Agama Takalar", {
    website: "https://pa-takalar.go.id",
  }),
  buildCourtEntry("pa-selayar", "Pengadilan Agama Selayar", {
    website: "https://pa-selayar.go.id",
  }),
  buildCourtEntry("pa-malino", "Pengadilan Agama Malino", {
    website: "https://pa-malino.go.id",
  }),
  buildCourtEntry("pn-makassar", "Pengadilan Negeri Makassar", {
    courtShortName: "PN Makassar",
    website: "https://pn-makassar.go.id",
    mapUrl: "https://maps.google.com/?q=Pengadilan+Negeri+Makassar",
  }),
];

export function searchCourtDirectory(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return courtDirectoryCatalog
    .filter((entry) => {
      const haystack = [
        entry.courtName,
        entry.identity.courtShortName,
        entry.satkerLabel,
        entry.identity.website ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      const leftStarts = left.courtName.toLowerCase().startsWith(normalizedQuery);
      const rightStarts = right.courtName.toLowerCase().startsWith(normalizedQuery);

      if (leftStarts && !rightStarts) return -1;
      if (!leftStarts && rightStarts) return 1;
      return left.courtName.localeCompare(right.courtName);
    });
}

export function getCourtDirectoryEntryByName(courtName: string) {
  const normalizedName = courtName.trim().toLowerCase();
  if (!normalizedName) return null;

  return courtDirectoryCatalog.find((entry) => entry.courtName.toLowerCase() === normalizedName) ?? null;
}

export function buildDerivedCourtIdentity(courtName: string): InstitutionIdentity {
  return buildIdentity(courtName, {
    courtShortName: deriveCourtShortName(courtName),
    website: courtName ? `https://${slugifyCourtName(courtName)}.go.id` : "",
    mapUrl: courtName ? `https://maps.google.com/?q=${encodeURIComponent(courtName)}` : undefined,
  });
}
