import { type AIProviderConfig } from "@/lib/types";

export const popularAIProviderCatalog: AIProviderConfig[] = [
  { id: "chatgpt", name: "ChatGPT", apiKey: "", models: ["GPT-5.4 Thinking", "GPT-5.4", "GPT-4.1"], builtin: true, connectionStatus: "idle" },
  { id: "gemini", name: "Gemini", apiKey: "", models: ["Gemini 2.5 Pro", "Gemini 2.5 Flash", "Gemini 2.0 Flash"], builtin: true, connectionStatus: "idle" },
  { id: "claude", name: "Claude", apiKey: "", models: ["Claude Sonnet 4", "Claude Opus 4", "Claude Haiku 3.5"], builtin: true, connectionStatus: "idle" },
  { id: "perplexity", name: "Perplexity", apiKey: "", models: ["Perplexity Sonar Pro", "Perplexity Sonar", "Perplexity R1"], builtin: true, connectionStatus: "idle" },
  { id: "grok", name: "Grok", apiKey: "", models: ["Grok 3", "Grok 3 Mini"], builtin: true, connectionStatus: "idle" },
  { id: "copilot", name: "Microsoft Copilot", apiKey: "", models: ["Copilot Enterprise", "Copilot Pro"], builtin: true, connectionStatus: "idle" },
  { id: "deepseek", name: "DeepSeek", apiKey: "", models: ["DeepSeek R1", "DeepSeek V3"], builtin: true, connectionStatus: "idle" },
  { id: "mistral", name: "Mistral", apiKey: "", models: ["Mistral Large", "Mistral Medium", "Codestral"], builtin: true, connectionStatus: "idle" },
  { id: "llama", name: "Llama", apiKey: "", models: ["Llama 4 Scout", "Llama 4 Maverick", "Llama 3.3 70B"], builtin: true, connectionStatus: "idle" },
  { id: "qwen", name: "Qwen", apiKey: "", models: ["Qwen 2.5 Max", "Qwen 2.5 Turbo"], builtin: true, connectionStatus: "idle" },
  { id: "cohere", name: "Cohere", apiKey: "", models: ["Command R+", "Command R", "Command Light"], builtin: true, connectionStatus: "idle" },
  { id: "amazon-q", name: "Amazon Q", apiKey: "", models: ["Amazon Q Business", "Amazon Q Developer"], builtin: true, connectionStatus: "idle" },
  { id: "watsonx", name: "IBM watsonx", apiKey: "", models: ["Granite 3.0", "Mixtral 8x7B"], builtin: true, connectionStatus: "idle" },
  { id: "poe", name: "Poe", apiKey: "", models: ["Poe Assistant", "Poe Instant"], builtin: true, connectionStatus: "idle" },
  { id: "meta-ai", name: "Meta AI", apiKey: "", models: ["Meta AI Assistant", "Llama Assistant"], builtin: true, connectionStatus: "idle" },
  { id: "notebooklm", name: "NotebookLM", apiKey: "", models: ["NotebookLM Pro", "NotebookLM Research"], builtin: true, connectionStatus: "idle" },
  { id: "blackbox", name: "Blackbox AI", apiKey: "", models: ["Blackbox Code Chat", "Blackbox Agent"], builtin: true, connectionStatus: "idle" },
  { id: "replit-ai", name: "Replit AI", apiKey: "", models: ["Replit Agent", "Replit Assistant"], builtin: true, connectionStatus: "idle" },
  { id: "you", name: "You.com", apiKey: "", models: ["YouChat Pro", "YouResearch"], builtin: true, connectionStatus: "idle" },
  { id: "character-ai", name: "Character.AI", apiKey: "", models: ["Character Assistant", "Character Voice"], builtin: true, connectionStatus: "idle" },
];

export function getAIProviderById(providerId: string) {
  return popularAIProviderCatalog.find((provider) => provider.id === providerId) ?? null;
}
