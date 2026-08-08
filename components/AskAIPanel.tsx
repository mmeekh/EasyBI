import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Key, Loader2, AlertCircle } from 'lucide-react';
// @ts-ignore — framework-free ESM core, shared with node --test
import { askAI, PROVIDERS } from '../lib/ai/core.mjs';
import type { Dataset } from '../types';

const KEY_STORE = 'easybi.ai.key';
const PROVIDER_STORE = 'easybi.ai.provider';

interface AskAIPanelProps {
  dataset: Dataset;
}

/**
 * "Ask your data" panel.
 *
 * BYOK by design: EasyBI ships without a backend, so the API key stays in
 * this browser's localStorage and requests go straight to the provider.
 * With no key the panel still answers — offline, from a local statistical
 * profile — and says so, instead of pretending an LLM replied.
 */
const AskAIPanel: React.FC<AskAIPanelProps> = ({ dataset }) => {
  const [provider, setProvider] = useState<string>('demo');
  const [apiKey, setApiKey] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [offline, setOffline] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    try {
      setProvider(localStorage.getItem(PROVIDER_STORE) || 'demo');
      setApiKey(localStorage.getItem(KEY_STORE) || '');
    } catch {
      /* private mode: storage unavailable, defaults are fine */
    }
  }, []);

  const needsKey = useMemo(() => Boolean(PROVIDERS[provider]?.needsKey), [provider]);
  const rowCount = dataset?.data?.length ?? 0;

  const persist = (nextProvider: string, nextKey: string) => {
    try {
      localStorage.setItem(PROVIDER_STORE, nextProvider);
      if (nextKey) localStorage.setItem(KEY_STORE, nextKey);
      else localStorage.removeItem(KEY_STORE);
    } catch {
      /* ignore */
    }
  };

  const ask = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await askAI({ provider, apiKey, question, dataset });
      setAnswer(res.answer);
      setOffline(res.offline);
      persist(provider, apiKey);
    } catch (e: any) {
      setError(e?.message || 'Beklenmeyen hata');
      setAnswer('');
    } finally {
      setBusy(false);
    }
  };

  const samples = ['Toplamlar nedir?', 'En yüksek değer hangisi?', 'En sık görülen kategori?'];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-indigo-500" aria-hidden="true" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Verine soru sor</h2>
      </header>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600 dark:text-slate-300">Sağlayıcı</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          >
            {Object.entries(PROVIDERS).map(([id, meta]: any) => (
              <option key={id} value={id}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>

        {needsKey && (
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <Key className="h-3.5 w-3.5" aria-hidden="true" /> API anahtarı
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        )}
      </div>

      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Anahtar yalnızca bu tarayıcıda saklanır; istek doğrudan sağlayıcıya gider. Modele ham satırlar değil,
        <strong> yalnızca istatistiksel özet</strong> gönderilir.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && ask()}
          placeholder={rowCount ? 'Örn. Bölgelere göre toplam nedir?' : 'Önce veri yükleyin'}
          disabled={!rowCount}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={ask}
          disabled={busy || !rowCount || !question.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          Sor
        </button>
      </div>

      {rowCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {samples.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuestion(s)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {answer && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
          {offline && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Çevrimdışı demo — yanıt yerel istatistiklerden hesaplandı
            </p>
          )}
          <p className="whitespace-pre-line text-sm text-slate-800 dark:text-slate-100">{answer}</p>
        </div>
      )}
    </section>
  );
};

export default AskAIPanel;
