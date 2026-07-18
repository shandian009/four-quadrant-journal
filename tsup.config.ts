import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    main: 'src/main/main.ts',
    preload: 'src/main/preload.ts',
    'recovery-preload': 'src/main/recovery-preload.ts'
  },
  format: ['cjs'],
  outDir: 'dist-electron',
  clean: true,
  sourcemap: true,
  dts: false,
  external: ['electron', 'better-sqlite3'],
  outExtension: () => ({ js: '.cjs' })
});
