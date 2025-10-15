import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'config/index': 'src/config/index.ts',
    'crucible/index': 'src/crucible/index.ts',
    'logging/index': 'src/logging/index.ts',
    'schema/index': 'src/schema/index.ts',
    'errors/index': 'src/errors/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
});
