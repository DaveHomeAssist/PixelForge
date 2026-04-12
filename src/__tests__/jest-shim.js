import { vi } from "vitest";

globalThis.jest = {
  fn: (impl) => vi.fn(impl),
  spyOn: vi.spyOn,
  restoreAllMocks: vi.restoreAllMocks,
};
