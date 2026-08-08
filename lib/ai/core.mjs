/**
 * EasyBI — "Ask your data" AI core.
 *
 * Framework-free ESM so it runs in the browser (via Vite) *and* under
 * `node --test` with zero dependencies. Three design rules:
 *
 *   1. Multi-provider behind one interface (OpenAI / Anthropic / Gemini),
 *      selected at call time — no SDKs, plain `fetch`.
 *   2. BYOK: keys live only in the caller's browser (localStorage),
 *      never on a server — EasyBI has no backend.
 *   3. Honest demo mode: without a key, answers are computed locally
 *      from the dataset profile and clearly labeled as offline.
 *
 * The LLM never receives raw rows — only a compact statistical profile,
 * which keeps prompts small and avoids exfiltrating full datasets.
 */

/** @typedef {{key: string, type: 'string'|'number'|'date', label: string}} ColumnInfo */
/** @typedef {{id: string, name: string, data: Record<string, unknown>[], columns: ColumnInfo[]}} Dataset */

const MAX_CATEGORIES = 8;

/** Compact, prompt-friendly statistical profile of a dataset. */
export function profileDataset(dataset) {
  const rows = dataset?.data ?? [];
  const columns = dataset?.columns ?? [];
  const profile = {
    name: dataset?.name || 'dataset',
    rowCount: rows.length,
    columns: [],
  };

  for (const col of columns) {
    const values = rows.map((r) => r[col.key]).filter((v) => v !== null && v !== undefined && v !== '');
    const info = { key: col.key, label: col.label || col.key, type: col.type, nonEmpty: values.length };

    if (col.type === 'number') {
      const nums = values.map(Number).filter((n) => Number.isFinite(n));
      if (nums.length) {
        const sum = nums.reduce((a, b) => a + b, 0);
        info.stats = {
          min: Math.min(...nums),
          max: Math.max(...nums),
          mean: round(sum / nums.length),
          sum: round(sum),
        };
      }
    } else {
      const counts = new Map();
      for (const v of values) counts.set(String(v), (counts.get(String(v)) || 0) + 1);
      info.distinct = counts.size;
      info.top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_CATEGORIES)
        .map(([value, count]) => ({ value, count }));
    }
    profile.columns.push(info);
  }
  return profile;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

/** System+user prompt pair sent to live providers. */
export function buildPrompt(question, profile) {
  const system =
    'You are a concise BI analyst. Answer ONLY from the dataset profile given. ' +
    'If the profile cannot answer the question, say so plainly. ' +
    'Reply in the language of the question. Use short sentences and concrete numbers.';
  const user = `Dataset profile (JSON):\n${JSON.stringify(profile)}\n\nQuestion: ${question}`;
  return { system, user };
}

/**
 * Offline demo provider — deterministic, key-free, computed from the profile.
 * Deliberately labeled so nobody mistakes it for an LLM.
 */
export function demoAnswer(question, profile) {
  const q = (question || '').toLowerCase();
  const numCols = profile.columns.filter((c) => c.stats);
  const catCols = profile.columns.filter((c) => c.top && c.top.length);
  const lines = [];

  const wants = (words) => words.some((w) => q.includes(w));

  if (wants(['kaç satır', 'satır', 'rows', 'row count', 'kayıt'])) {
    lines.push(`Veri kümesinde ${profile.rowCount} satır var.`);
  }
  if (wants(['toplam', 'sum', 'total'])) {
    for (const c of numCols) lines.push(`${c.label} toplamı: ${c.stats.sum}.`);
  }
  if (wants(['ortalama', 'average', 'mean', 'avg'])) {
    for (const c of numCols) lines.push(`${c.label} ortalaması: ${c.stats.mean}.`);
  }
  if (wants(['en yüksek', 'max', 'en büyük', 'highest'])) {
    for (const c of numCols) lines.push(`${c.label} en yükseği: ${c.stats.max}.`);
  }
  if (wants(['en düşük', 'min', 'en küçük', 'lowest'])) {
    for (const c of numCols) lines.push(`${c.label} en düşüğü: ${c.stats.min}.`);
  }
  if (wants(['en çok', 'top', 'en sık', 'most common', 'hangi'])) {
    for (const c of catCols) {
      const t = c.top[0];
      lines.push(`${c.label} içinde en sık değer: "${t.value}" (${t.count} kez).`);
    }
  }

  if (!lines.length) {
    // Genel özet — soru kalıba uymadıysa yine de faydalı ol.
    lines.push(`"${profile.name}": ${profile.rowCount} satır, ${profile.columns.length} kolon.`);
    for (const c of numCols.slice(0, 3)) {
      lines.push(`${c.label}: min ${c.stats.min}, ort ${c.stats.mean}, maks ${c.stats.max}, toplam ${c.stats.sum}.`);
    }
    for (const c of catCols.slice(0, 2)) {
      lines.push(`${c.label}: ${c.distinct} farklı değer; en sık "${c.top[0].value}".`);
    }
  }

  return lines.join('\n');
}

/* ── Live providers (BYOK, plain fetch — no SDK) ─────────────────────── */

async function askOpenAI({ apiKey, model, system, user, fetchImpl }) {
  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content?.trim() || '(boş yanıt)';
}

async function askAnthropic({ apiKey, model, system, user, fetchImpl }) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  return j.content?.[0]?.text?.trim() || '(boş yanıt)';
}

async function askGemini({ apiKey, model, system, user, fetchImpl }) {
  const m = model || 'gemini-2.5-flash-lite';
  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 400 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')?.trim() || '(boş yanıt)';
}

export const PROVIDERS = {
  demo: { label: 'Demo (anahtarsız, çevrimdışı)', needsKey: false },
  openai: { label: 'OpenAI (GPT)', needsKey: true },
  anthropic: { label: 'Anthropic (Claude)', needsKey: true },
  gemini: { label: 'Google (Gemini)', needsKey: true },
};

/**
 * Single entry point used by the UI.
 * @returns {Promise<{answer: string, provider: string, offline: boolean}>}
 */
export async function askAI({ provider = 'demo', apiKey = '', model = '', question, dataset, fetchImpl = globalThis.fetch }) {
  if (!question || !question.trim()) throw new Error('Soru boş olamaz.');
  const profile = profileDataset(dataset);
  if (!profile.rowCount) throw new Error('Önce veri yükleyin — sorular yüklü veri üzerinde çalışır.');

  if (provider === 'demo') {
    return { answer: demoAnswer(question, profile), provider: 'demo', offline: true };
  }
  if (!apiKey) throw new Error('Bu sağlayıcı için API anahtarı gerekli (anahtar yalnızca tarayıcınızda saklanır).');

  const { system, user } = buildPrompt(question, profile);
  const args = { apiKey, model, system, user, fetchImpl };
  const impl = { openai: askOpenAI, anthropic: askAnthropic, gemini: askGemini }[provider];
  if (!impl) throw new Error(`Bilinmeyen sağlayıcı: ${provider}`);
  const answer = await impl(args);
  return { answer, provider, offline: false };
}
