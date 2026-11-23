import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAirlineSuggestions } from '../lib/airline-suggestions.mjs';

const now = Date.parse('2026-10-30T12:00:00Z');
const fresh = {
  observedAt: '2026-10-30T11:59:00Z',
  segments: [
    { marketing_carrier_code: 'AC', marketing_carrier_name: 'Air Canada' },
    { marketing_carrier_code: 'WS', marketing_carrier_name: 'WestJet' },
  ],
  inbound: { segments: [{ marketing_carrier_code: 'AC', marketing_carrier_name: 'Air Canada' }] },
};

test('suggests fresh observed carrier codes and counts each carrier once per offer', () => {
  const suggestions = buildAirlineSuggestions([
    fresh,
    { ...fresh, segments: [{ marketing_carrier_code: 'AC', marketing_carrier_name: 'Air Canada' }] },
    { ...fresh, observedAt: '2026-10-30T11:00:00Z', segments: [{ marketing_carrier_code: 'BA', marketing_carrier_name: 'British Airways' }] },
    { ...fresh, segments: [{ marketing_carrier_code: 'LONG', marketing_carrier_name: 'Invented code' }], inbound: undefined },
    { ...fresh, segments: [], inbound: undefined, airlines: ['Imaginary Air'] },
  ], { now });

  assert.deepEqual(suggestions, [
    { code: 'AC', name: 'Air Canada', offerCount: 2 },
    { code: 'WS', name: 'WestJet', offerCount: 1 },
  ]);
});
