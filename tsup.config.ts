import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'config/index': 'src/config/index.ts',
    'crucible/index': 'src/crucible/index.ts',
    'errors/index': 'src/errors/index.ts',
    'foundry/index': 'src/foundry/index.ts',
    'foundry/similarity/index': 'src/foundry/similarity/index.ts',
    'fulhash/index': 'src/fulhash/index.ts',
    'logging/index': 'src/logging/index.ts',
    'schema/index': 'src/schema/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
});
