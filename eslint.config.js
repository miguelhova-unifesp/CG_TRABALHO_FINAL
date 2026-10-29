import js from '@eslint/js';
import globals from 'globals';

// Regra 6 (determinismo): a simulacao nao pode depender de aleatoriedade nem do relogio.
const SIM_FORBIDDEN = [
  { object: 'Math', property: 'random', message: 'Use o RNG com seed de core/rng.js (regra 6).' },
  { object: 'performance', property: 'now', message: 'A simulacao usa so DT fixo (regra 1).' },
  { object: 'Date', property: 'now', message: 'A simulacao usa so DT fixo (regra 1).' },
];

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/physics/**/*.js', 'src/ai/**/*.js', 'src/race/**/*.js', 'src/track/**/*.js'],
    rules: { 'no-restricted-properties': ['error', ...SIM_FORBIDDEN] },
  },
  {
    // Regra 3: physics/ so usa a matematica do three.
    files: ['src/physics/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'three',
          allowImportNames: ['Vector3', 'Quaternion', 'MathUtils'],
          message: 'physics/ so pode importar Vector3/Quaternion/MathUtils de three (regra 3).',
        }],
      }],
    },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
