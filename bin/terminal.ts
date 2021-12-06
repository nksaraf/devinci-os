#! /bin/deno run
export async function main() {
  Deno.env.set('DENO_DEPLOYMENT_ID', '123');
  let p = Deno.run({
    cmd: ['deno', 'run', '/bin/desh.ts'],
    cwd: Deno.cwd(),
  });

  await p.status();
}

if (import.meta.main) {
  await main();
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
