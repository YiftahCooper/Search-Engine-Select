// Mount dynamic engine controls in Sine's existing Configure dialog.
function mountSineSettings() {
  let controls, container, dialog, configureButton, disposed = false;
  const style = document.createElementNS('http://www.w3.org/1999/xhtml', 'link');
  style.rel = 'stylesheet'; style.href = 'chrome://sine/content/search-engine-select/style.css';
  document.documentElement.append(style);
  const reset = () => controls?.reset();
  function unmount() {
    dialog?.removeEventListener('close', reset);
    configureButton?.removeEventListener('click', reset);
    controls?.destroy(); controls = container = dialog = configureButton = null;
  }
  function mount() {
    if (disposed) return;
    const next = document.querySelector('[mod-id="search-engine-select"] .sineItemPreferenceDialogContent');
    if (next === container && controls?.element.isConnected) return;
    unmount(); if (!next) return;
    container = next; controls = createEngineSettings(container);
    dialog = container.closest('dialog'); dialog?.addEventListener('close', reset);
    configureButton = container.closest('[mod-id]')?.querySelector('.sineItemConfigureButton');
    configureButton?.addEventListener('click', reset);
    if (new URL(window.location.href).searchParams.get('searchEngineSelectSettings') === '1' && !document.documentElement.hasAttribute('data-ses-settings-shown')) {
      document.documentElement.setAttribute('data-ses-settings-shown', '');
      configureButton?.click();
    }
  }
  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, {childList: true, subtree: true});
  const engineObserver = {observe() { controls?.refresh(); }};
  Services.obs.addObserver(engineObserver, 'browser-search-engine-modified');
  mount();
  return {destroy() {
    if (disposed) return; disposed = true; observer.disconnect();
    Services.obs.removeObserver(engineObserver, 'browser-search-engine-modified');
    unmount(); style.remove();
  }};
}
