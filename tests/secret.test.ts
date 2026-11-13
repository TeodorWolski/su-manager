import assert from "node:assert/strict";
import { test } from "node:test";
import { bearerToken, secretMatches } from "../src/lib/secret";

test("sekret: pasuje tylko dokładnie ten sam tekst", () => {
  assert.equal(secretMatches("tajne-123", "tajne-123"), true);
  assert.equal(secretMatches("tajne-124", "tajne-123"), false);
  assert.equal(secretMatches("tajne-12", "tajne-123"), false, "krótszy");
  assert.equal(secretMatches("tajne-1234", "tajne-123"), false, "dłuższy");
});

test("sekret: nieustawiony albo pusty nie pasuje do niczego (brak zmiennej zamyka trasę)", () => {
  assert.equal(secretMatches("", undefined), false);
  assert.equal(secretMatches("", ""), false);
  assert.equal(secretMatches("cokolwiek", undefined), false);
});

test("sekret: tyle samo znaków, inna liczba bajtów → odmowa, nie wyjątek", () => {
  assert.equal(secretMatches("zażółć", "zazolc"), false);
});

test("token Bearer z nagłówka; bez nagłówka pusty", () => {
  const req = (authorization?: string) => new Request("https://x.test", { headers: authorization ? { authorization } : {} });
  assert.equal(bearerToken(req("Bearer abc")), "abc");
  assert.equal(bearerToken(req("bearer   abc")), "abc");
  assert.equal(bearerToken(req()), "");
});
