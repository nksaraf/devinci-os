import { createAppConfig } from 'os/stores/apps.store';

export default () =>
  createAppConfig({
    id: 'terminal',
    title: 'Terminal',
    window: {
      trafficLights: false,
      loadComponent: async () => (await import('os/apps/terminal/Terminal.svelte')).default,
    },
    dock: {
      icon: '/assets/app-icons/terminal/256.png',
    },
  });
