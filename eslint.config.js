import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // `motion` se usa como <motion.div>; los alias de componentes (Tag) empiezan en mayúscula.
      'no-unused-vars': [
        'error',
        { varsIgnorePattern: '^([A-Z_]|motion$)', argsIgnorePattern: '^[A-Z_]' },
      ],
      // Regla del React Compiler: sincronizar estado con el DOM/matchMedia en un efecto es válido aquí.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Archivos que exportan hooks/constantes junto a componentes (sin impacto en producción, solo en HMR).
    files: ['src/context/*.jsx', 'src/components/ui/button.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Chatbot ya existía: muta un Audio nativo (no estado de React); no se modifica su comportamiento.
    files: ['src/components/Chatbot.jsx'],
    rules: { 'react-hooks/immutability': 'off' },
  },
  {
    // Archivos de Node (backend, scripts y tests): globals de Node, sin reglas de React.
    files: [
      'server/**/*.js',
      'api/**/*.js',
      'scripts/**/*.{js,mjs}',
      'tests/**/*.js',
      'middleware.js',
      '*.config.js',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
