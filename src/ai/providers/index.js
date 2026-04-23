import * as replicate from "./replicate.js";

export const PROVIDERS = {
  [replicate.id]: replicate,
};

export const DEFAULT_PROVIDER_ID = replicate.id;

export function getProvider(id) {
  return PROVIDERS[id] || PROVIDERS[DEFAULT_PROVIDER_ID];
}

export function listProviders() {
  return Object.values(PROVIDERS).map(p => ({ id: p.id, label: p.label }));
}
