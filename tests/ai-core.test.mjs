import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileDataset, buildPrompt, demoAnswer, askAI, PROVIDERS } from '../lib/ai/core.mjs';

const dataset = {
  id: 'd1',
  name: 'satis',
  columns: [
    { key: 'bolge', type: 'string', label: 'Bölge' },
    { key: 'tutar', type: 'number', label: 'Tutar' },
  ],
  data: [
    { bolge: 'Ege', tutar: 100 },
    { bolge: 'Ege', tutar: 300 },
    { bolge: 'Marmara', tutar: 200 },
  ],
};

test('profileDataset sayısal istatistikleri doğru çıkarır', () => {
  const p = profileDataset(dataset);
  assert.equal(p.rowCount, 3);
  const tutar = p.columns.find((c) => c.key === 'tutar');
  assert.deepEqual(tutar.stats, { min: 100, max: 300, mean: 200, sum: 600 });
});

test('profileDataset kategorik top değerleri sayar', () => {
  const p = profileDataset(dataset);
  const bolge = p.columns.find((c) => c.key === 'bolge');
  assert.equal(bolge.distinct, 2);
  assert.deepEqual(bolge.top[0], { value: 'Ege', count: 2 });
});

test('demoAnswer toplam sorusuna profilden cevap verir', () => {
  const p = profileDataset(dataset);
  const a = demoAnswer('Toplam tutar nedir?', p);
  assert.match(a, /600/);
});

test('demoAnswer kalıp dışı soruda genel özet döner', () => {
  const p = profileDataset(dataset);
  const a = demoAnswer('xyzzy?', p);
  assert.match(a, /3 satır/);
});

test('buildPrompt profili ve soruyu içerir, ham satır göndermez', () => {
  const p = profileDataset(dataset);
  const { user } = buildPrompt('En yüksek?', p);
  assert.match(user, /En yüksek\?/);
  assert.match(user, /"sum":600/);
  assert.ok(!user.includes('"bolge":"Ege"'), 'ham satırlar prompta sızmamalı');
});

test('askAI demo modda anahtarsız çalışır ve offline işaretler', async () => {
  const r = await askAI({ provider: 'demo', question: 'ortalama?', dataset });
  assert.equal(r.offline, true);
  assert.match(r.answer, /200/);
});

test('askAI canlı sağlayıcıda anahtar yoksa anlaşılır hata verir', async () => {
  await assert.rejects(
    () => askAI({ provider: 'openai', question: 'x?', dataset }),
    /API anahtarı/,
  );
});

test('askAI sahte fetch ile OpenAI yanıtını işler', async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'Cevap: 600' } }] }),
  });
  const r = await askAI({ provider: 'openai', apiKey: 'k', question: 'toplam?', dataset, fetchImpl: fakeFetch });
  assert.equal(r.answer, 'Cevap: 600');
  assert.equal(r.offline, false);
});

test('PROVIDERS demo hariç anahtar ister', () => {
  assert.equal(PROVIDERS.demo.needsKey, false);
  for (const k of ['openai', 'anthropic', 'gemini']) assert.equal(PROVIDERS[k].needsKey, true);
});
