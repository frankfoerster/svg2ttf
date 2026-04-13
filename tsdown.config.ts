import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    svg2ttf: 'src/svg2ttf.ts'
  },
  format: ['esm'],
  clean: true,
  dts: true
});
