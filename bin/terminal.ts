// import { createAppConfig } from 'os/macos/stores/apps.store';

console.log('TERMINALLL', import.meta.main);
export async function main() {
  console.log('TERMINALLL');
  console.log('here', Deno);

  let p = Deno.run({
    cmd: ['deno', 'run', '/bin/desh.ts'],
    cwd: Deno.cwd(),
  });

  await p.status();
}

if (import.meta.main) {
  main();
}

// export default () =>
//   createAppConfig({
//     id: 'terminal',
//     title: 'Terminal',
//     // window: {
//     //   trafficLights: false,
//     //   loadComponent: async () => (await import('os/macos/apps/terminal/Terminal.svelte')).default,
//     // },
//     dock: {
//       icon: '/assets/app-icons/terminal/256.png',
//       onClick: () => {
//         let webview = new WebView({
//           url: '/macos/apps/terminal/Terminal.svelte',
//         });
//         webview.run();
//       },
//     },
//   });
