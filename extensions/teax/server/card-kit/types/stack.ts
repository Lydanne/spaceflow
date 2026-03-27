export type StackEntry = string;

export interface BackResult {
  __type: "back";
}

export interface EncodedValue {
  __stack: StackEntry[];
  __action?: string;
  __data?: Record<string, unknown>;
  __formName?: string;
  __newMessage?: boolean;
}
