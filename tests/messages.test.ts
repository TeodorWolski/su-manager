import assert from "node:assert/strict";
import { test } from "node:test";
import { pitchMessage, supportMessage } from "../src/lib/messages";

test("wiadomość do supportu: data, miasto w miejscowniku, headliner w nawiasie", () => {
  assert.equal(
    supportMessage({ startsAt: "2026-11-20T20:00", cityName: "Warszawa", headlinerName: "Kasia Testowa" }),
    "Siemanko, robisz support 20.11 w Warszawie (Kasia Testowa)? Jest szansa, żebym wskoczył na open-mica przed występem? Zapytasz? 😄",
  );
  assert.match(supportMessage({ startsAt: "2026-11-20", cityName: null, headlinerName: null }), /^Siemanko, robisz support 20\.11\? /);
});

test("zwykła wiadomość bez zmian", () => {
  assert.equal(
    pitchMessage({ startsAt: "2026-11-20T20:00", cityName: "Kraków", openMic: false }),
    "Siemanko, masz może miejsce na open-mic’a 20.11 w Krakowie? 😄",
  );
});
