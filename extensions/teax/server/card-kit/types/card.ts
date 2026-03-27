export type CardJSON = Record<string, unknown>;

export interface CardConfig {
  title: string;
  theme?: "blue" | "green" | "red" | "orange" | "grey";
  icon?: string;
}

export interface CardElement {
  tag: string;
  [key: string]: unknown;
}
