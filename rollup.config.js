import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));

const config = () => {
  return {
    input: resolve(root, 'src/main.js'),
    external: ['obsidian'],
    output: {
      file: resolve(root, 'main.js'),
      format: 'cjs',
      exports: 'default',
      sourcemap: false
    },
    watch: { clearScreen: false },
  };
};

export default config;
