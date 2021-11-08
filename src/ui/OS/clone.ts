import git, { withGitConfig } from 'os/lib/git';
import { loadNodeFS } from 'os/lib/node/main';

loadNodeFS().then(() => {
  git.clone(
    withGitConfig({
      dir: '/home',
      url: 'https://github.com/streamich/spyfs',
      onProgress: (e) => {
        // progress = e;
      },
    }),
  );
});
