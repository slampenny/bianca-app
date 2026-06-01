/** True when local demo/simulate tooling is enabled (Vite dev server only). */
export function isDevDemoEnabled(): boolean {
  return import.meta.env.DEV
}
