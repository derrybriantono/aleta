import { readJsonResponseSafe, summarizePlainTextError } from "@/lib/http-response";

type ProviderId = "chatgpt" | "gemini" | "claude" | "llama";

type ProviderRequestInput = {
  providerId: string;
  endpointUrl?: string | null;
  apiKey: string;
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
};

type StructuredRequestInput<T> = ProviderRequestInput & {
  fallback: T;
};

type ProviderTextResponse = {
  text: string;
  providerModelId: string;
};

function resolveSupportedProviderId(providerId: string): ProviderId | null {
  if (providerId === "chatgpt" || providerId === "gemini" || providerId === "claude" || providerId === "llama") {
    return providerId;
  }

  return null;
}

function normalizeOpenAIModel(modelId: string) {
  const normalized = modelId.trim().toLowerCase();
  if (normalized.includes("gpt-4.1")) return "gpt-4.1";
  if (normalized.includes("gpt-5.4")) return "gpt-5.4";
  return normalized.replace(/\s+/g, "-");
}

function normalizeGeminiModel(modelId: string) {
  const normalized = modelId.trim().toLowerCase();
  if (normalized.includes("2.5") && normalized.includes("flash")) return "gemini-2.5-flash";
  if (normalized.includes("2.5")) return "gemini-2.5-pro";
  if (normalized.includes("2.0") && normalized.includes("flash")) return "gemini-2.0-flash";
  return normalized.replace(/\s+/g, "-");
}

function normalizeClaudeModel(modelId: string) {
  const normalized = modelId.trim().toLowerCase();
  if (normalized.includes("opus") && normalized.includes("4")) return "claude-opus-4-0";
  if (normalized.includes("sonnet") && normalized.includes("4")) return "claude-sonnet-4-0";
  if (normalized.includes("haiku") && normalized.includes("3.5")) return "claude-3-5-haiku-latest";
  return normalized.replace(/\s+/g, "-");
}

function normalizeLlamaModel(modelId: string) {
  return modelId
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "-");
}

function resolveProviderModel(providerId: ProviderId, modelId: string) {
  if (providerId === "chatgpt") return normalizeOpenAIModel(modelId);
  if (providerId === "gemini") return normalizeGeminiModel(modelId);
  if (providerId === "claude") return normalizeClaudeModel(modelId);
  return normalizeLlamaModel(modelId);
}

function defaultEndpoint(providerId: ProviderId) {
  if (providerId === "chatgpt") return "https://api.openai.com/v1/chat/completions";
  if (providerId === "gemini") return "https://generativelanguage.googleapis.com/v1beta/models";
  if (providerId === "claude") return "https://api.anthropic.com/v1/messages";
  return "http://127.0.0.1:11434/api/chat";
}

function extractTextFromContentArray(items: unknown[]) {
  return items
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as { text?: string };
      return candidate.text ? [candidate.text] : [];
    })
    .join("\n")
    .trim();
}

async function readProviderPayload<T>(
  response: Response,
  providerName: string,
  nonJsonFallback: string
) {
  const { payload, rawText } = await readJsonResponseSafe<T>(response);

  if (!payload) {
    throw new Error(
      summarizePlainTextError(rawText, `${providerName} mengembalikan respons yang tidak dapat dibaca.`) ||
        nonJsonFallback
    );
  }

  return { payload, rawText };
}

async function requestProviderText({
  providerId,
  endpointUrl,
  apiKey,
  modelId,
  systemPrompt,
  userPrompt,
}: ProviderRequestInput): Promise<ProviderTextResponse> {
  const supportedProviderId = resolveSupportedProviderId(providerId);

  if (!supportedProviderId) {
    throw new Error(`Provider AI '${providerId}' belum didukung untuk koneksi live.`);
  }

  const resolvedModel = resolveProviderModel(supportedProviderId, modelId);

  if (supportedProviderId === "chatgpt") {
    const response = await fetch(endpointUrl?.trim() || defaultEndpoint(supportedProviderId), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });
    const { payload, rawText } = await readProviderPayload<{
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    }>(response, "Provider ChatGPT", "Provider ChatGPT mengirim respons non-JSON.");

    if (!response.ok) {
      throw new Error(
        payload.error?.message ?? summarizePlainTextError(rawText, "Provider ChatGPT menolak permintaan.")
      );
    }

    return {
      text: payload.choices?.[0]?.message?.content?.trim() ?? "",
      providerModelId: resolvedModel,
    };
  }

  if (supportedProviderId === "gemini") {
    const baseUrl = endpointUrl?.trim() || defaultEndpoint(supportedProviderId);
    const response = await fetch(
      `${baseUrl}/${resolvedModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      }
    );
    const { payload, rawText } = await readProviderPayload<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    }>(response, "Provider Gemini", "Provider Gemini mengirim respons non-JSON.");

    if (!response.ok) {
      throw new Error(
        payload.error?.message ?? summarizePlainTextError(rawText, "Provider Gemini menolak permintaan.")
      );
    }

    return {
      text: extractTextFromContentArray(payload.candidates?.[0]?.content?.parts ?? []),
      providerModelId: resolvedModel,
    };
  }

  if (supportedProviderId === "claude") {
    const response = await fetch(endpointUrl?.trim() || defaultEndpoint(supportedProviderId), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: 1200,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const { payload, rawText } = await readProviderPayload<{
      content?: Array<{ text?: string }>;
      error?: { message?: string };
    }>(response, "Provider Claude", "Provider Claude mengirim respons non-JSON.");

    if (!response.ok) {
      throw new Error(
        payload.error?.message ?? summarizePlainTextError(rawText, "Provider Claude menolak permintaan.")
      );
    }

    return {
      text: extractTextFromContentArray(payload.content ?? []),
      providerModelId: resolvedModel,
    };
  }

  const response = await fetch(endpointUrl?.trim() || defaultEndpoint(supportedProviderId), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey.trim() ? { authorization: `Bearer ${apiKey.trim()}` } : {}),
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    }),
  });
  const { payload, rawText } = await readProviderPayload<{
    message?: { content?: string };
    error?: string;
  }>(response, "Provider Llama/Ollama", "Provider Llama/Ollama mengirim respons non-JSON.");

  if (!response.ok) {
    throw new Error(
      payload.error ?? summarizePlainTextError(rawText, "Provider Llama/Ollama menolak permintaan.")
    );
  }

  return {
    text: payload.message?.content?.trim() ?? "",
    providerModelId: resolvedModel,
  };
}

function extractJsonBlock(value: string) {
  const trimmed = value.trim();
  const directJson = trimmed.startsWith("{") && trimmed.endsWith("}") ? trimmed : null;
  if (directJson) return directJson;

  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? "";
}

export async function requestStructuredDataFromProvider<T>({
  fallback,
  ...input
}: StructuredRequestInput<T>): Promise<{
  ok: boolean;
  data: T;
  providerModelId: string;
  rawText: string;
  message?: string;
}> {
  try {
    const response = await requestProviderText(input);
    const jsonBlock = extractJsonBlock(response.text);

    if (!jsonBlock) {
      throw new Error("Respons AI tidak berisi JSON yang bisa dipakai.");
    }

    return {
      ok: true,
      data: JSON.parse(jsonBlock) as T,
      providerModelId: response.providerModelId,
      rawText: response.text,
    };
  } catch (error) {
    return {
      ok: false,
      data: fallback,
      providerModelId: input.modelId,
      rawText: "",
      message: error instanceof Error ? error.message : "Permintaan AI live gagal diproses.",
    };
  }
}

export async function testProviderConnection(input: {
  providerId: string;
  endpointUrl?: string | null;
  apiKey: string;
  modelId: string;
}) {
  if (!input.apiKey.trim()) {
    return {
      ok: false,
      providerModelId: input.modelId,
      message: "API key wajib diisi terlebih dahulu.",
    };
  }

  try {
    const result = await requestProviderText({
      ...input,
      systemPrompt: "Jawab singkat tanpa markdown.",
      userPrompt: "Balas dengan kata OK saja.",
    });

    return {
      ok: Boolean(result.text),
      providerModelId: result.providerModelId,
      message: result.text || "Provider merespons tetapi tanpa isi jawaban.",
    };
  } catch (error) {
    return {
      ok: false,
      providerModelId: input.modelId,
      message: error instanceof Error ? error.message : "Uji koneksi provider gagal diproses.",
    };
  }
}
