import { createAppConfig } from '__/stores/apps.store';

export default () =>
  createAppConfig({
    title: 'Calculator',
    id: 'calculator',
    dock: {},
    window: {
      height: 300 * 1.414,
      width: 300,
      transparent: true,
      loadComponent: async () =>
        (await import('@ui/components/apps/Calculator/Calculator.svelte')).default,
    },
  });
