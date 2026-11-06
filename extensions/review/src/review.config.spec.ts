import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Ajv from "ajv";
import {
  getRegisteredSchemas,
  registerPluginSchema,
  SchemaGeneratorService,
} from "@spaceflow/core/schema-generator.service";
import { reviewSchema } from "./review.config";

describe("review.config", () => {
  describe("reviewSchema", () => {
    it("生成完整的 Review 输入配置并按 draft-07 校验可选元组", () => {
      const dir = mkdtempSync(join(tmpdir(), "spaceflow-review-schema-"));
      const previous = getRegisteredSchemas().get("review");
      try {
        registerPluginSchema({ configKey: "review", schemaFactory: reviewSchema });
        const path = join(dir, "config-schema.json");
        new SchemaGeneratorService().generateJsonSchema(path);
        const schema = JSON.parse(readFileSync(path, "utf8"));
        expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
        expect(Object.keys(schema.properties.review.properties).sort()).toEqual(
          Object.keys(reviewSchema().shape).sort(),
        );
        const tuple = schema.properties.review.properties.systemRules.properties.maxLinesPerFile;
        expect(tuple.items).toEqual([
          { type: "number" },
          { type: "string", enum: ["off", "warn", "error"] },
        ]);
        const validate = new Ajv().compile(schema);
        expect(validate({ review: { systemRules: {} } })).toBe(true);
        for (const severity of ["off", "warn", "error"]) {
          expect(validate({ review: { systemRules: { maxLinesPerFile: [25, severity] } } })).toBe(
            true,
          );
        }
        for (const invalid of [[25], [25, "warn", "extra"], ["25", "warn"], [25, "invalid"]]) {
          expect(validate({ review: { systemRules: { maxLinesPerFile: invalid } } })).toBe(false);
        }
      } finally {
        if (previous) registerPluginSchema(previous);
        else getRegisteredSchemas().delete("review");
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
