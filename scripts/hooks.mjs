// Maps the Vite '@shared' alias for plain-Node execution (smoke tests).
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@shared/')) {
    const url = new URL('../shared/' + specifier.slice('@shared/'.length), import.meta.url);
    return next(url.href, context);
  }
  if (specifier.startsWith('@lib/')) {
    const url = new URL('../src/lib/' + specifier.slice('@lib/'.length), import.meta.url);
    return next(url.href, context);
  }
  return next(specifier, context);
}
