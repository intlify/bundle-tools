import { bundleAndRun, bundleEx } from "./utils";

const options = {
  a: 1,
  b: "hello",
  c: {
    a: 1,
    nest: {
      foo: "hello",
    },
  },
  d: () => "hello",
};

test.skip("basic", async () => {
  const { module } = await bundleAndRun("./plugin/basic.vue", bundleEx, {
    intlify: options,
  });
  expect(module.a).toEqual(1);
  expect(module.b).toEqual("hello");
  expect(module.c.a).toEqual(1);
  expect(module.c.nest.foo).toEqual("hello");
  expect(module.d).toEqual("hello");
});

test.skip("script only", async () => {
  const { module } = await bundleAndRun("./plugin/script.vue", bundleEx, {
    intlify: options,
  });
  expect(module.a).toEqual(1);
  expect(module.b).toEqual("hello");
  expect(module.c.a).toEqual(1);
  expect(module.c.nest.foo).toEqual("hello");
  expect(module.d).toEqual("hello");
});
