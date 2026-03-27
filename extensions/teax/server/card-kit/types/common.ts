export type CardParams = Record<string, unknown>;
export type CardFormValue = Record<string, string>;

export interface CardRouteLocation {
  page: string;
  params: CardParams;
}

export interface CardDIContext {
  provide: (key: unknown, value: unknown) => void;
  inject: <T = unknown>(key: unknown, fallback?: T) => T | undefined;
}
