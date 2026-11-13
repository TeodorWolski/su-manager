import assert from "node:assert/strict";
import { test } from "node:test";
import { forecastMonth, INTERESTED_FACTOR, PRIOR_SUCCESS, successRate } from "../src/lib/forecast";

test("skuteczność: bez historii = założenie; mała próbka nie daje 100%; duża zbliża się do prawdziwej", () => {
  assert.equal(successRate({ agreed: 0, resolved: 0 }), PRIOR_SUCCESS);
  assert.equal(successRate({ agreed: 2, resolved: 2 }), 0.5, "(2 + 2) / (2 + 6)");
  assert.ok(Math.abs(successRate({ agreed: 60, resolved: 100 }) - 0.6) < 0.02);
});

test("prognoza: pewne + szansa z tych w toku; „zainteresowany” liczy się słabiej niż „napisałem”", () => {
  const f = forecastMonth({ played: 4, planned: 2, pending: { interested: 2, asked: 4 }, target: 10, history: { agreed: 6, resolved: 12 } });
  const rate = 8 / 18;
  assert.equal(f.sure, 6);
  assert.ok(Math.abs(f.expected - (6 + 4 * rate + 2 * rate * INTERESTED_FACTOR)) < 1e-9);
  assert.equal(f.learned, true);
  // Brakuje 10 − 8,22 = 1,78 grania; przy skuteczności 44% to 5 wiadomości (zaokrąglone w górę).
  assert.equal(f.toWrite, 5);
});

test("prognoza domyka cel → nic nie trzeba pisać; mało rozmów → skuteczność oznaczona jako szacunek", () => {
  const f = forecastMonth({ played: 8, planned: 2, pending: { interested: 0, asked: 1 }, target: 10, history: { agreed: 1, resolved: 2 } });
  assert.equal(f.toWrite, 0);
  assert.equal(f.learned, false);
});

test("pusty miesiąc bez historii: do celu 10 trzeba napisać do 30 osób (co trzecia rozmowa)", () => {
  const f = forecastMonth({ played: 0, planned: 0, pending: { interested: 0, asked: 0 }, target: 10, history: { agreed: 0, resolved: 0 } });
  assert.equal(f.expected, 0);
  assert.equal(f.toWrite, 30);
});
