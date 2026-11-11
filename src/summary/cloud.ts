export const CHAT_COMPLETIONS_URL = 'https://9router.hubs.io.vn/v1/chat/completions'

/** Calls an OpenAI-compatible chat completion and returns the assistant text. */
export async function summarizeViaApi(
    prompt: string,
    options: { apiKey: string; model: string; signal?: AbortSignal; fetch?: typeof fetch },
): Promise<string> {
    const response = await (options.fetch ?? fetch)(CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: options.model, messages: [{ role: 'user', content: prompt }] }),
        signal: options.signal,
    })
    if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 200)
        throw new Error(`Chat API ${response.status}: ${detail}`)
    }
    const body = await response.json()
    // Reasoning models may prepend <think>…</think>; only the answer is stored.
    const text = String(body?.choices?.[0]?.message?.content ?? '')
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim()
    if (!text) throw new Error('Chat API returned an empty answer')
    return text
}
