const git = await import('/src/lib/git.ts');
const fs = await import('https://deno.land/std@0.116.0/node/fs.ts');
await Deno.mkdir('/tutorial');
await git.git.clone(
  git.withGitConfig({
    fs,
    dir: '/tutorial',
    corsProxy: 'https://cors.isomorphic-git.org',
    url: 'https://github.com/isomorphic-git/isomorphic-git',
    singleBranch: true,
    depth: 1,
  }),
);
