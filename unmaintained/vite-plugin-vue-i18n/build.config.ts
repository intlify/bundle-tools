import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: true,
  outDir: "lib",
  entries: [
    {
      name: "index",
      input: "src/index",
    },
  ],
  rollup: {
    emitCJS: true,
  },
  externals: ["vite"],
});
