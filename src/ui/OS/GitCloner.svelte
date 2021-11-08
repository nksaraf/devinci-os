<script>
  import * as fs from 'os/lib/fs/fs';

  import { git, withGitConfig } from 'os/lib/git';

  import { onMount } from 'svelte';

  let progress = {
    phase: 'Not started',
    loaded: 0,
    total: 0,
  };

  onMount(() => {
    fs.promise.then(() => {
      git.clone(
        withGitConfig({
          dir: '/home',
          url: 'https://github.com/streamich/spyfs',
          onProgress: (e) => {
            progress = e;
          },
        }),
      );
    });
  });

  let oldPhase = progress.phase;

  $: {
    if (progress.phase != oldPhase) {
      // toast.loading(progress.phase, {
      //   duration: null,
      // });
      oldPhase = progress.phase;
    }
  }
</script>

<!-- <div
  p-4
  bg-white
  shadow-lg
  class="flex rounded"
  style="border-radius: 0.5rem; z-index: 1000; top: 1.75rem; right: 2rem; width: 280px; background-color: rgba(233,232,235,255);"
>
  <div font-bold text-sm>Git Clone</div>
  <div text-xs flex-row align-center class="flex">
    <div class="overflow-ellipsis"><span>https://github.com/streamich/spyfs</span></div>
    <div class="i-akar-icons-arrow-right flex-1" />
    <div class="overflow-ellipsis">/home</div>
  </div>
  <div width-full my-2 rounded-full h-3 bg-gray-300>
    <div
      rounded-full
      style="width:{(progress.loaded / (progress.total ? progress.total : progress.loaded)) * 100}%"
      h-full
      bg-blue-500
    />
  </div>
  {progress.phase}
  {progress.loaded}/{progress.total ? progress.total : progress.loaded}
</div> -->
