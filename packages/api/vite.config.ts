import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: true,
    exports: {
      devExports: "types",
    },
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
