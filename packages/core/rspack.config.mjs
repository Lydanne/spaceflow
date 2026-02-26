import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  optimization: {
    minimize: false,
  },
  entry: {
    index: "./src/index.ts",
  },
  plugins: [],
  target: "node",
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
  output: {
    filename: "[name].js",
    path: resolve(__dirname, "dist"),
    library: { type: "module" },
    chunkFormat: "module",
    clean: true,
  },
  experiments: {
    outputModule: true,
  },
  externalsType: "module-import",
  externals: [
    { micromatch: "node-commonjs micromatch" },
    /^(?!src\/|@spaceflow\/core)[^./]/, // node_modules 包（排除 src/ 别名和 @spaceflow/core 自引用）
  ],
  resolve: {
    extensions: [".ts", ".js"],
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
    alias: {
      "@spaceflow/core": resolve(__dirname, "src/index.ts"),
    },
    tsConfig: {
      configFile: resolve(__dirname, "tsconfig.json"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: "builtin:swc-loader",
        options: {
          jsc: {
            parser: {
              syntax: "typescript",
              decorators: true,
            },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
            },
            target: "es2022",
          },
        },
      },
    ],
  },
};
