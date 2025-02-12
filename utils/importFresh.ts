export function importFresh<T>(modulePath: string): Promise<T> {
  // Dynamically import the module, which should now bypass the cache
  return import(`${modulePath}?update=${Date.now()}`);
}
