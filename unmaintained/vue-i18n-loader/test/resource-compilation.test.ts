import { bundleAndRun, bundleLocale } from "./utils";
import { createMessageContext } from "@intlify/core-base";

test("json resource", async () => {
  const { module } = await bundleAndRun("ja.json", bundleLocale);
  const fn = module.message;
  expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`);
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`);
});

test("json5 resource", async () => {
  const { module } = await bundleAndRun("en.json5", bundleLocale);
  const fn = module.message;
  expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`);
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`);
});

test("yaml resource", async () => {
  const { module } = await bundleAndRun("ko.yaml", bundleLocale);
  const fn = module.message;
  expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`);
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`);
});

test("yml resource", async () => {
  const { module } = await bundleAndRun("fr.yml", bundleLocale);
  const fn = module.message;
  expect(fn.source).toEqual(`@.caml:{'no apples'} | {0} apple | {n} apples`);
  expect(fn(createMessageContext({ named: { n: 3 } }))).toEqual(`3 apples`);
});
