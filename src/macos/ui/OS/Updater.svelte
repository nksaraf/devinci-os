<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

  // replaced dynamically
  const buildDate = '__DATE__';

  // Will store the update event, so we can use this value on AppStore to show the badge.
  // If the user click on Later instead Restart, the dialog is closed but the update is still there.
  // We don't need to store it on localStorage since the new sw is on skip waiting state, and so
  // a refresh or reopening the browser will prompt again the dialog to restart.
  // Once updateServiceWorker is called, there is a full reload, so the app will be loaded again.
  let needsUpdate: boolean = false;

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      needsUpdate = true;
    },
    onRegistered(swr) {
      console.log(`SW registered: ${swr}`);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  function close() {
    needRefresh.set(false);
  }

  async function handleUpdateApp() {
    if ($needRefresh) {
      needsUpdate = false;
      updateServiceWorker();
    }
  }

  let mouseX: number | null = null;
</script>

{#if $needRefresh}
  <div class="updates-available-dialog" role="alert">
    <div class="updates-available-hero">
      <img
        width="64"
        height="64"
        src="/assets/app-icons/system-preferences/128.webp"
        alt="AppStore app"
        draggable="false"
      />
    </div>
    <div class="updates-available-content">
      <div>Updates Available</div>
      <div>Do you want to restart to install these updates now or tonight?</div>
    </div>
    <div class="updates-available-buttons">
      <button on:click={handleUpdateApp}> Restart </button>
      <button on:click={close}> Later </button>
    </div>
  </div>
{/if}

<div class="pwa-date">{buildDate}</div>

<style lang="scss">
  .divider {
    height: 100%;
    width: 0.2px;

    background-color: hsla(var(--system-color-dark-hsl), 0.3);

    margin: 0 2px;
  }
  .pwa-date {
    visibility: hidden;
  }
  .updates-available-dialog {
    position: fixed;
    right: 0;
    top: 40px;
    margin: 16px;
    border: 1px solid #8885;
    border-radius: 0.5rem;
    z-index: 1;
    text-align: left;
    box-shadow: 3px 4px 5px 0 #8885;
    display: grid;
    grid-template-columns: min-content auto min-content;
    background-color: rgb(197, 219, 236);
    .updates-available-hero {
      align-self: center;
    }
    .updates-available-content {
      max-width: 19rem;
      border-right: 1px solid #e3e3e3;
      :first-child {
        font-size: 1.2rem;
        font-weight: bold;
        padding: 0.75rem 0.5rem 0.5rem 0.5rem;
      }
      :last-child {
        padding: 0 0.5rem 0.75rem;
      }
    }
    .updates-available-buttons {
      display: grid;
      grid-template-columns: 1fr;
      button {
        align-self: center;
        min-width: 5rem;
        height: 100%;
        border: none;
        background-color: transparent;
        outline: none;
        + button {
          border-top: 1px solid #e3e3e3;
        }
      }
    }
  }
</style>
