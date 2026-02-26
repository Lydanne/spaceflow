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
    /^(?!src\/)[^./]/, // node_modules 包（排除 src/ 别名）
  ],
  resolve: {
    extensions: [".ts", ".js"],
    extensionAlias: {
      ".js": [".ts", ".js"],
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
            },
            target: "es2022",
          },
        },
      },
    ],
  },
};
