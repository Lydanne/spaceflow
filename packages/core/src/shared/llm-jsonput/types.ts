export type LlmJsonSchemaType = "string" | "number" | "boolean" | "object" | "array" | "null";

export interface LlmJsonSchema {
  type: LlmJsonSchemaType;
  description?: string;
  properties?: Record<string, LlmJsonSchema>;
  items?: LlmJsonSchema;
  required?: string[];
  additionalProperties?: boolean;
  enum?: string[];
}

export interface LlmJsonPutSchema extends LlmJsonSchema {
  type: "object";
  properties: Record<string, LlmJsonSchema>;
  required: string[];
}
