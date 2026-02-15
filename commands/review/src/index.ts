import "./locales";
import { SpaceflowExtension, SpaceflowExtensionMetadata, t } from "@spaceflow/core";
import { ReviewModule } from "./review.module";
import { reviewSchema } from "./review.config";
/** review Extension 元数据 */
export const reviewMetadata: SpaceflowExtensionMetadata = {
  name: "review",
  commands: ["review"],
  configKey: "review",
  configSchema: reviewSchema,
  version: "1.0.0",
  description: t("review:extensionDescription"),
};

export class ReviewExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return reviewMetadata;
  }

  getModule() {
    return ReviewModule;
  }
}

export default ReviewExtension;

export * from "./review.module";
export * from "./review.command";
export * from "./review.service";
export * from "./review.mcp";
export * from "./issue-verify.service";
export * from "./deletion-impact.service";
