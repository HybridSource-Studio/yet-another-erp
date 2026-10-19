import { expect, test } from "vitest";
import { Clock, decodeStamp } from "./hlc";
import { uuidv7, uuidv7Time } from "./ids";
import { mergeRecord, stripLocal } from "./merge";
import type { Location } from "./schema";

test("stamps from one device never go backwards, even if the wall clock does", () => {
  let wall = 1000;
  const clock = new Clock("dev", undefined, () => wall);
  const a = clock.tick();
  wall = 500;
  const b = clock.tick();
  expect(b > a).toBe(true);
  expect(decodeStamp(b)).toEqual({ ms: 1000, counter: 1, deviceId: "dev" });
});

test("ids sort by creation time", () => {
  const early = uuidv7(1_000);
  const late = uuidv7(2_000);
  expect(early < late).toBe(true);
  expect(uuidv7Time(late)).toBe(2_000);
});

test("merging keeps the later write of each field, whatever the order", () => {
  const base: Location = {
    id: "loc",
    workspaceId: "w",
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    name: "Main",
    archived: false,
    fieldClocks: { name: "a", archived: "a", deletedAt: "a" },
  };
  const renamed = {
    ...base,
    name: "Shop",
    updatedAt: 2,
    fieldClocks: { ...base.fieldClocks, name: "b" },
  };
  const archived = {
    ...base,
    archived: true,
    updatedAt: 3,
    fieldClocks: { ...base.fieldClocks, archived: "c" },
  };
  const one = mergeRecord("locations", mergeRecord("locations", base, renamed).merged, archived);
  const two = mergeRecord("locations", mergeRecord("locations", base, archived).merged, renamed);
  expect(one.merged).toEqual(two.merged);
  expect(one.merged).toMatchObject({ name: "Shop", archived: true, updatedAt: 3 });
  expect(mergeRecord("locations", one.merged, renamed).changed).toBe(false);
});

test("stripLocal drops underscore fields", () => {
  expect(stripLocal({ a: 1, _words: ["x"] })).toEqual({ a: 1 });
});
