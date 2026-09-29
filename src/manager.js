function openEngineManager(controller) {
  const element = (tag, text) => {
    const node = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const dialog = element('dialog'); dialog.id = 'ses-engine-manager';
  dialog.setAttribute('aria-labelledby', 'ses-manager-heading');
  const heading = element('h2', 'Search engines'); heading.id = 'ses-manager-heading';
  const intro = element('p', 'Choose engines for this selector. These choices do not change Zen’s search settings.');
  const error = element('p'); error.dataset.sesError = ''; error.setAttribute('role', 'alert');
  const list = element('div'); list.className = 'ses-manager-list';
  const form = element('form'); form.noValidate = true;
  const nameLabel = element('label', 'Engine name');
  const name = element('input'); name.name = 'ses-name'; name.maxLength = 80; nameLabel.append(name);
  const urlLabel = element('label', 'Search URL — use {searchTerms} for the query');
  const url = element('input'); url.name = 'ses-url'; url.type = 'url'; url.maxLength = 2048; url.placeholder = 'https://example.com/search?q={searchTerms}'; urlLabel.append(url);
  const add = element('button', 'Add engine'); add.type = 'submit'; add.dataset.sesAction = 'add';
  form.append(nameLabel, urlLabel, add);
  const reset = element('button', 'Back up and reset invalid settings'); reset.type = 'button'; reset.hidden = true;
  const close = element('button', 'Done'); close.type = 'button'; close.dataset.sesAction = 'close';
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    dialog.remove(); if (controller._manager === dialog) controller._manager = null;
    controller._engineSelect?.focus();
  });
  let revision = 0, rendered;
  async function render() {
    const currentRevision = ++revision;
    const state = readEngineSettings();
    let engines;
    try { engines = await getVisibleEngines(); }
    catch { if (dialog.isConnected) error.textContent = 'Could not load Zen’s search engines. Close and try again.'; return; }
    if (!dialog.isConnected || currentRevision !== revision) return;
    rendered = state;
    error.textContent = state.error; reset.hidden = !state.error;
    add.disabled = !!state.error;
    list.replaceChildren();
    const { settings } = state;
    const mutate = change => {
      try {
        const next = JSON.parse(JSON.stringify(settings)); change(next);
        saveEngineSettings(next, state.raw); render();
      } catch (problem) { error.textContent = problem.message; }
    };
    for (const engine of engines) {
      const row = element('label'); row.className = 'ses-manager-row';
      const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.disabled = !!state.error;
      const key = engineKey(engine); checkbox.checked = !settings.hidden.includes(key);
      checkbox.addEventListener('change', () => mutate(next => {
        next.hidden = next.hidden.filter(id => id !== key);
        if (!checkbox.checked) next.hidden.push(key);
      }));
      row.append(checkbox, element('span', engine.name)); list.append(row);
    }
    for (const engine of settings.custom) {
      const row = element('div'); row.className = 'ses-manager-row';
      const remove = element('button', 'Remove'); remove.type = 'button'; remove.dataset.sesAction = 'remove-custom';
      remove.setAttribute('aria-label', `Remove ${engine.name}`);
      remove.addEventListener('click', () => mutate(next => { next.custom = next.custom.filter(item => item.id !== engine.id); next.hidden = next.hidden.filter(id => id !== engine.id); }));
      row.append(element('span', engine.name), remove); list.append(row);
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (!rendered || rendered.error) throw new Error('Reset the invalid settings before adding engines.');
      if (rendered.settings.custom.length >= 100) throw new Error('The selector supports up to 100 custom engines.');
      const engine = validateCustomEngine({ id: `custom-${crypto.randomUUID()}`, name: name.value, url: url.value });
      if (rendered.settings.custom.some(item => item.name.toLowerCase() === engine.name.toLowerCase())) throw new Error('A custom engine with that name already exists.');
      const next = { ...rendered.settings, custom: [...rendered.settings.custom, engine] };
      saveEngineSettings(next, rendered.raw); name.value = ''; url.value = ''; render();
    } catch (problem) { error.textContent = problem.message; }
  });
  reset.addEventListener('click', () => {
    if (!rendered?.error) return;
    try {
      if (Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '') !== rendered.raw) throw new Error('Settings changed in another window. Close and reopen the manager.');
      Services.prefs.setStringPref(`${ENGINE_SETTINGS_PREF}-backup`, rendered.raw);
      saveEngineSettings(emptyEngineSettings(), rendered.raw); render();
    } catch (problem) { error.textContent = problem.message; }
  });
  dialog.append(heading, intro, list, error, form, reset, close);
  document.documentElement.append(dialog); dialog.showModal(); render();
  return dialog;
}
