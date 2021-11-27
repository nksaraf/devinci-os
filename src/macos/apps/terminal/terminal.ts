import { createAppConfig } from 'os/macos/stores/apps.store';

export default () =>
  createAppConfig({
    id: 'terminal',
    title: 'Terminal',
    window: {
      trafficLights: false,
      loadComponent: async () => (await import('os/macos/apps/terminal/Terminal.svelte')).default,
    },
    dock: {
      icon: '/assets/app-icons/terminal/256.png',
    },
  });
