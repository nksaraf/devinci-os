import { createAppConfig } from '__/stores/apps.store';

export default () =>
  createAppConfig({
    title: 'Calendar',
    id: 'calendar',
    dock: {},
    window: {
      loadComponent: async () =>
        (await import('@ui/components/apps/Calendar/Calendar.svelte')).default,
    },
  });
