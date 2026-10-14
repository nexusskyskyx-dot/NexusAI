// Maps the Vite '@shared'/'@lib' aliases + transpiles .jsx for plain-Node
// execution (smoke tests + SSR render sweep).
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@shared/')) {
    const url = new URL('../shared/' + specifier.slice('@shared/'.length), import.meta.url);
    return next(url.href, context);
  }
  if (specifier.startsWith('@lib/')) {
    const url = new URL('../src/lib/' + specifier.slice('@lib/'.length), import.meta.url);
    return next(url.href, context);
  }
  if (specifier.startsWith('@components/')) {
    const url = new URL('../src/components/' + specifier.slice('@components/'.length), import.meta.url);
    return next(url.href, context);
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith('.jsx')) {
    const { readFile } = await import('node:fs/promises');
    const { transformSync } = await import('esbuild');
    const src = await readFile(new URL(url), 'utf8');
    const out = transformSync(src, { loader: 'jsx', jsx: 'automatic', format: 'esm' });
    return { format: 'module', shortCircuit: true, source: out.code };
  }
  return next(url, context);
}
