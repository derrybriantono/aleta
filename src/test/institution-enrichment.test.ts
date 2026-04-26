import { describe, expect, it } from "vitest";

import {
  extractOfficialIdentityForTesting,
  normalizeInstitutionIdentityForTesting,
} from "@/server/modules/settings/institution-enrichment";

describe("institution identity enrichment parser", () => {
  it("normalizes unsafe identity values without leaking objects into form fields", () => {
    const result = normalizeInstitutionIdentityForTesting({
      courtName: { label: "Pengadilan Negeri Palu" },
      courtShortName: ["PN Palu"],
      address: "  Jl. Dr. Samratulangi No. 46  ",
      phoneNumber: 451421250,
      mobilePhone: false,
      email: null,
      website: { url: "https://www.pn-palu.go.id" },
      instagram: "@pengadilan_negeri_palu",
    });

    expect(result.courtName).toBe("");
    expect(result.courtShortName).toBe("");
    expect(result.address).toBe("Jl. Dr. Samratulangi No. 46");
    expect(result.phoneNumber).toBe("451421250");
    expect(result.mobilePhone).toBe("");
    expect(result.email).toBe("");
    expect(result.website).toBe("");
    expect(result.instagram).toBe("@pengadilan_negeri_palu");
  });

  it("extracts structured contact details from official court html", () => {
    const html = `
      <html>
        <body>
          <section>
            <h2>Hubungi Kami</h2>
            <p>Alamat : Jln. Prof. Moh. Yamin No. 36, Palu, Sulawesi Tengah</p>
            <p>Telpon : (0451) 487285</p>
            <p>Whatsapp : 082352178980</p>
            <p>Email : info@pta-palu.go.id</p>
          </section>
          <footer>
            <a href="https://www.instagram.com/pta_palu/">Instagram</a>
            <a href="https://www.facebook.com/ptapalu">Facebook</a>
            <a href="https://www.youtube.com/@mediacenterptapalu6082">YouTube</a>
          </footer>
        </body>
      </html>
    `;

    const result = extractOfficialIdentityForTesting(html, "https://pta-palu.go.id");

    expect(result.identity.address).toContain("Prof. Moh. Yamin");
    expect(result.identity.phoneNumber).toBe("0451487285");
    expect(result.identity.mobilePhone).toBe("082352178980");
    expect(result.identity.email).toBe("info@pta-palu.go.id");
    expect(result.identity.website).toBe("https://pta-palu.go.id");
    expect(result.identity.instagram).toBe("https://www.instagram.com/pta_palu/");
    expect(result.identity.facebook).toBe("https://www.facebook.com/ptapalu");
    expect(result.identity.youtube).toBe("https://www.youtube.com/@mediacenterptapalu6082");
    expect(result.fieldSources.address).toBe("official_website");
    expect(result.fieldConfidence.address).toBeGreaterThan(0.9);
  });
});
