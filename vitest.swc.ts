import swc from 'unplugin-swc';

export const swcDecorators = swc.vite({
  jsc: {
    parser: { syntax: 'typescript', decorators: true },
    transform: { decoratorVersion: '2022-03' },
    target: 'es2022',
  },
});
