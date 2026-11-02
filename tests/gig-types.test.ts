import assert from "node:assert/strict";
import { test } from "node:test";
import { headlinerFromTitle, typeIssue } from "../src/lib/gig-types";

test("„open mic przed X” oznaczony jako open mic → do poprawki na „przed kimś”", () => {
  assert.deepEqual(typeIssue({ context: "open_mic", title: "Open mic przed Tomkiem Kołeckim", headlinerId: null }), {
    reason: "w tytule „przed …”",
    suggested: "opener",
  });
  assert.equal(typeIssue({ context: "open_mic", title: "Open mic Klub Oczki", headlinerId: null }), null);
  assert.equal(typeIssue({ context: "open_mic", title: "Open mic", headlinerId: 7 })?.suggested, "opener");
});

test("bez typu → do uzupełnienia (podpowiedź tylko, gdy widać „przed …”); dobre typy w spokoju", () => {
  assert.deepEqual(typeIssue({ context: null, title: "Stand-up wieczór", headlinerId: null }), { reason: "bez typu", suggested: null });
  assert.equal(typeIssue({ context: null, title: "Open mic przed Rafałem Sumowskim", headlinerId: null })?.suggested, "opener");
  assert.equal(typeIssue({ context: "support", title: "Support przed Kasią", headlinerId: 3 }), null);
  assert.equal(typeIssue({ context: "opener", title: "przed Kasią", headlinerId: null }), null);
});

test("nazwisko z tytułu", () => {
  assert.equal(headlinerFromTitle("Open mic przed Tomkiem Kołeckim"), "Tomkiem Kołeckim");
  assert.equal(headlinerFromTitle("Open mic Świetlica"), null);
});

test("nazwisko z odmienionym imieniem: „Tomkiem Kołeckim” → Tomek Kołecki (tylko gdy jednoznaczne)", async () => {
  const { matchBySurname, matchContacts } = await import("../src/lib/match");
  const people = [
    { id: 1, name: "Tomek Kołecki", aliases: null },
    { id: 2, name: "Rafał Sumowski", aliases: null },
  ];
  assert.equal(matchContacts("Tomkiem Kołeckim", people).length, 0);
  assert.equal(matchBySurname("Tomkiem Kołeckim", people)?.id, 1);
  assert.equal(matchBySurname("Tomkiem Kołeckim", [...people, { id: 3, name: "Anna Kołecka", aliases: null }])?.id, 1);
  assert.equal(matchBySurname("Kowalskim", [{ id: 4, name: "Jan Kowalski", aliases: null }, { id: 5, name: "Ewa Kowalska", aliases: null }]), null);
});
