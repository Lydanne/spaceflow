import type { CardJSON } from "./card";

export type ButtonType = "default" | "primary" | "danger";

export interface ButtonNavigateOpts {
  newMessage?: boolean;
  mode?: "push" | "replace";
}

export interface ButtonOpts {
  type?: ButtonType;
  navigate?: [string, Record<string, unknown>?, ButtonNavigateOpts?];
  action?: string;
  params?: Record<string, unknown>;
  url?: string;
  back?: boolean;
  refresh?: boolean;
}

export interface EnhancedButtonConfig extends ButtonOpts {
  text: string;
}

export interface InputConfig {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface InputV2Config {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  default_value?: string;
  input_type?: "text" | "multiline_text" | "password";
  label_position?: "top" | "left";
  width?: string;
  max_length?: number;
  rows?: number;
  auto_resize?: boolean;
  max_rows?: number;
  show_icon?: boolean;
  disabled?: boolean | string;
  margin?: string;
}

export interface SelectConfig {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean | string;
  options: Array<{ label: string; value: string }>;
  initial_option?: string;
}

export interface ColumnDef {
  width?: "weighted" | "auto";
  weight?: number;
  verticalAlign?: "top" | "center" | "bottom";
  elements: (col: ColumnBuilderInterface) => void;
}

export interface ColumnSetOpts {
  flexMode?: "none" | "stretch" | "flow" | "bisect" | "trisect";
  horizontalSpacing?: "default" | "small";
  backgroundStyle?: "default" | "grey";
}

export interface EnhancedCardBuilderInterface {
  text(content: string, isMarkdown?: boolean): this;
  divider(): this;
  fields(items: Array<{ label: string; value: string }>): this;
  input(config: InputConfig): this;
  inputV2(config: InputV2Config): this;
  select(config: SelectConfig): this;
  form(name: string): this;
  endForm(): this;
  columns(cols: ColumnDef[]): this;
  columnSet(opts: ColumnSetOpts, cb: (cs: ColumnSetBuilderInterface) => void): this;
  formButtons(config: {
    submit?: { text: string; type?: string };
    reset?: { text: string; type?: string };
  }): this;
  button(text: string, opts?: ButtonOpts): this;
  buttons(items: EnhancedButtonConfig[]): this;
  backButton(text?: string, opts?: { type?: ButtonType }): this;
  systemButtons(extra?: EnhancedButtonConfig[]): this;
  build(): CardJSON;
}

export interface ColumnBuilderInterface {
  text(content: string, isMarkdown?: boolean): this;
  divider(): this;
  fields(items: Array<{ label: string; value: string }>): this;
  button(text: string, opts?: ButtonOpts): this;
  buttons(items: EnhancedButtonConfig[]): this;
  columns(cols: ColumnDef[]): this;
}

export interface ColumnSetBuilderInterface {
  column(
    opts: {
      width?: "weighted" | "auto";
      weight?: number;
      verticalAlign?: string;
    },
    cb: (col: ColumnBuilderInterface) => void,
  ): this;
}
