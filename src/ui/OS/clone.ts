import git, { withGitConfig } from 'os/lib/git';
import { main } from 'os/lib/node/main';

main().then(() => {
  // git.clone(
  //   withGitConfig({
  //     dir: '/home',
  //     url: 'https://github.com/streamich/spyfs',
  //     onProgress: (e) => {
  //       // progress = e;
  //     },
  //   }),
  // );
});
