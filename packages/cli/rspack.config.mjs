import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";
import rspack from "@rspack/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));

export default {
  optimization: {
    minimize: false,
  },
  entry: {
    cli: "./src/cli.ts",
  },
  plugins: [
    new rspack.BannerPlugin({
      banner: "#!/usr/bin/env node",
      raw: true,
      entryOnly: true,
      include: /cli\.js$/,
    }),
    new rspack.DefinePlugin({
      __CLI_VERSION__: JSON.stringify(pkg.version),
    }),
  ],
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
