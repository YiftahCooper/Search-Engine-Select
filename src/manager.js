function createEngineSettings(container) {
  const element = (tag, text) => {
    const node = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const dialog = element('section'); dialog.id = 'ses-engine-manager';
  dialog.setAttribute('aria-labelledby', 'ses-manager-heading');
  const heading = element('h2', 'Search engines'); heading.id = 'ses-manager-heading';
  const intro = element('p', 'Choose engines for this selector. Drag a handle to reorder, or use Move up / Move down. These choices do not change Zen’s search settings.');
  const error = element('p'); error.dataset.sesError = ''; error.setAttribute('role', 'alert');
  const list = element('div'); list.className = 'ses-manager-list';
  const removed = element('details'); removed.className = 'ses-removed-engines';
  const removedSummary = element('summary', 'Removed engines');
  const removedList = element('div'); removed.append(removedSummary, removedList);
  const form = element('form'); form.noValidate = true;
  const nameLabel = element('label', 'Engine name');
  const name = element('input'); name.name = 'ses-name'; name.maxLength = 80; nameLabel.append(name);
  const urlLabel = element('label', 'Search URL — use {searchTerms} for the query');
  const url = element('input'); url.name = 'ses-url'; url.type = 'url'; url.maxLength = 2048; url.placeholder = 'https://example.com/search?q={searchTerms}'; urlLabel.append(url);
  const add = element('button', 'Add engine'); add.type = 'submit'; add.dataset.sesAction = 'add';
  const cancel = element('button', 'Cancel edit'); cancel.type = 'button'; cancel.hidden = true;
  const iconLabel = element('label','Icon');
  const iconChoice = element('select'); iconChoice.name='ses-icon';iconLabel.append(iconChoice);
  for (const [value,text] of [['default','Default — automatic'],...Object.entries(SES_ICON_NAMES).map(([id,label])=>[`builtin:${id}`,label]),['url','Custom image URL']]) {
    const option=element('option',text);option.value=value;iconChoice.append(option);
  }
  const imageLabel = element('label','Direct image URL'); imageLabel.hidden=true;
  const imageUrl = element('input'); imageUrl.name='ses-icon-url'; imageUrl.type='url';imageUrl.maxLength=2048;
  imageUrl.placeholder='https://example.com/icon.png';imageLabel.append(imageUrl);
  const iconTools = element('div'); iconTools.className='ses-icon-tools';
  const preview = element('img'); preview.className='ses-icon-preview';preview.alt='Icon preview';preview.hidden=true;
  const load = element('button','Load preview'); load.type='button';load.dataset.sesAction='preview-icon';load.hidden=true;
  const resetIcon = element('button','Reset to default'); resetIcon.type='button';resetIcon.dataset.sesAction='reset-icon';
  const iconStatus = element('span');iconStatus.setAttribute('role','status');
  iconTools.append(preview,load,resetIcon,iconStatus);
  const iconHint = element('p','Custom images are saved locally. Paste a direct HTTPS image link (up to 256 KB).'); iconHint.hidden=true;
  const formActions = element('div');formActions.className='ses-manager-actions';formActions.append(add,cancel);
  form.append(nameLabel, urlLabel, iconLabel, imageLabel, iconTools, iconHint, formActions);
  const reset = element('button', 'Back up and reset invalid settings'); reset.type = 'button'; reset.hidden = true;
  let revision = 0, rendered, editing = null, editRaw, dragging = null, disposed = false;
  let iconDraft, previewController, draftRevision = 0, saving = false;
  function cancelPreview() { previewController?.abort();previewController=null;add.disabled=saving || !!rendered?.error; }
  function changeDraft() { ++draftRevision;cancelPreview(); }
  function updateIconPreview() {
    const custom = iconChoice.value === 'url';
    imageLabel.hidden=load.hidden=iconHint.hidden=!custom;
    load.textContent=iconDraft?.kind==='url' && iconDraft.url===imageUrl.value.trim()?'Refresh icon':'Load preview';
    preview.hidden=false; iconStatus.textContent='';
    if (iconChoice.value.startsWith('builtin:')) preview.src=builtinIcon(iconChoice.value.slice(8));
    else if(custom && iconDraft?.url===imageUrl.value.trim()) preview.src=iconDraft.data;
    else if(custom) { preview.hidden=true;preview.removeAttribute('src'); }
    else {
      const item = rendered && [...rendered.settings.custom,...rendered.settings.overrides].find(item=>item.id===editing);
      if(item) setSearchEngineIcon(preview,configuredEngine({...item,icon:undefined}));
      else {
        const original = presetForEngine(editing);
        setSearchEngineIcon(preview,original ? configuredEngine({...original,id:editing}) : editingNative);
      }
    }
  }
  let editingNative;
  function resetIconDraft() { changeDraft();iconDraft=undefined;imageUrl.value='';iconChoice.value='default';updateIconPreview(); }
  iconChoice.addEventListener('change',()=>{changeDraft();updateIconPreview();});
  imageUrl.addEventListener('input',()=>{changeDraft();updateIconPreview();});
  name.addEventListener('input',changeDraft);url.addEventListener('input',changeDraft);
  resetIcon.addEventListener('click',resetIconDraft);
  async function downloadPreview() {
    cancelPreview();
    const token=draftRevision, controller=new AbortController();previewController=controller;
    add.disabled=true;
    iconStatus.textContent='Loading icon…';
    try {
      const icon=await fetchCustomIcon(imageUrl.value,controller.signal);
      if(disposed || !dialog.isConnected || token!==draftRevision || controller.signal.aborted) return null;
      iconDraft=icon;imageUrl.value=icon.url;updateIconPreview();iconStatus.textContent='Preview ready. Save engine to keep it.';
      return icon;
    } catch(problem) {
      if(!disposed && token===draftRevision && !controller.signal.aborted) iconStatus.textContent=problem.message;
      throw problem;
    } finally { if(previewController===controller) {previewController=null;add.disabled=saving || !!rendered?.error;} }
  }
  load.addEventListener('click',()=>{void downloadPreview().catch(()=>{});});
  const dragType = 'application/x-ses-engine-reorder';
  function clearDropIndicator() {
    for (const row of list.querySelectorAll('[data-ses-drop]')) delete row.dataset.sesDrop;
  }
  function cancelDrag() {
    dragging = null; clearDropIndicator();
    for (const row of list.querySelectorAll('.ses-reordering')) row.classList.remove('ses-reordering');
  }
  const onDragKey = event => { if (event.key === 'Escape') cancelDrag(); };
  document.addEventListener('keydown', onDragKey, true);
  document.addEventListener('dragend', cancelDrag);
  document.addEventListener('drop', cancelDrag);
  list.addEventListener('dragleave', event => { if (!list.contains(event.relatedTarget)) clearDropIndicator(); });
  function clearEdit() { editing = null; editingNative=undefined;editRaw = undefined; name.value = ''; url.value = ''; add.textContent = 'Add engine'; cancel.hidden = true; resetIconDraft(); }
  cancel.addEventListener('click', clearEdit);
  async function render() {
    cancelDrag();
    const currentRevision = ++revision;
    const state = readEngineSettings();
    let engines;
    try { engines = await getVisibleEngines(); }
    catch { if (dialog.isConnected) error.textContent = 'Could not load Zen’s search engines. Close and try again.'; return; }
    if (!dialog.isConnected || currentRevision !== revision) return;
    rendered = state;
    error.textContent = state.error; reset.hidden = !state.error;
    add.disabled = !!state.error || saving || !!previewController;
    list.replaceChildren();
    removedList.replaceChildren();
    const { settings } = state;
    const mutate = change => {
      try {
        const next = JSON.parse(JSON.stringify(settings)); change(next);
        saveEngineSettings(next, state.raw);
        // An edit based on this revision can include this window's own list
        // change. Never advance a draft that was already stale after refresh.
        if (editing && editRaw === state.raw) editRaw = JSON.stringify(next);
        // Keep the saved list available if Save precedes the asynchronous
        // engine-service refresh, so the draft cannot undo this list change.
        rendered = { ...state, raw: JSON.stringify(next), settings: next };
        render();
      } catch (problem) { error.textContent = problem.message; }
    };
    const ordered = orderedEngines(engines, settings);
    const active = ordered.filter(engine => !settings.removed.includes(engineKey(engine)));
    const hiddenEngines = ordered.filter(engine => settings.removed.includes(engineKey(engine)));
    removed.hidden = !hiddenEngines.length;
    removedSummary.textContent = `Removed engines (${hiddenEngines.length})`;
    for (const engine of hiddenEngines) {
      const key = engineKey(engine);
      const row = element('div'); row.className = 'ses-manager-row'; row.dataset.sesEngine = key;
      const restore = element('button', 'Restore'); restore.type = 'button'; restore.disabled = !!state.error;
      restore.dataset.sesAction = 'restore-native'; restore.setAttribute('aria-label', `Restore ${engine.name}`);
      restore.addEventListener('click', () => mutate(next => { next.hidden = next.hidden.filter(id => id !== key); next.removed = next.removed.filter(id => id !== key); }));
      row.append(element('span', engine.name), restore); removedList.append(row);
    }
    for (const [index, engine] of active.entries()) {
      const row = element('div'); row.className = 'ses-manager-row';
      const key = engineKey(engine), native = key.startsWith('native:'); row.dataset.sesEngine = key;
      const handle = element('span', '⠿'); handle.className = 'ses-reorder-handle';
      handle.draggable = !state.error; handle.title = `Drag to reorder ${engine.name}`;
      handle.setAttribute('aria-hidden', 'true'); row.append(handle);
      handle.addEventListener('dragstart', event => {
        cancelDrag();
        if (state.error || !event.dataTransfer || !row.isConnected || currentRevision !== revision) { event.preventDefault(); return; }
        const token = crypto.randomUUID();
        event.dataTransfer.setData(dragType, token); event.dataTransfer.effectAllowed = 'move';
        dragging = { key, token, revision: currentRevision }; row.classList.add('ses-reordering');
      });
      const internalDrag = event => dragging?.revision === currentRevision && currentRevision === revision && row.isConnected &&
        event.dataTransfer && !event.dataTransfer.files?.length && Array.from(event.dataTransfer.types || []).includes(dragType);
      const dropSide = event => {
        const bounds = row.getBoundingClientRect();
        return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
      };
      row.addEventListener('dragover', event => {
        clearDropIndicator();
        if (!internalDrag(event) || dragging.key === key) return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'move'; row.dataset.sesDrop = dropSide(event);
      });
      row.addEventListener('drop', event => {
        const source = dragging?.key;
        const valid = internalDrag(event) && event.dataTransfer.getData(dragType) === dragging.token;
        const side = dropSide(event); cancelDrag();
        if (!valid || source === key) return;
        event.preventDefault();
        const activeIds = active.map(engineKey), reordered = activeIds.filter(id => id !== source);
        reordered.splice(reordered.indexOf(key) + (side === 'after' ? 1 : 0), 0, source);
        if (reordered.every((id, position) => id === activeIds[position])) return;
        mutate(next => {
          // Retain removed engines' slots so restoring one preserves its position.
          let position = 0;
          const ids = ordered.map(engineKey).map(id => settings.removed.includes(id) ? id : reordered[position++]);
          next.order = [...ids, ...next.order.filter(id => !ids.includes(id))];
        });
      });
      const label = element('label'); label.className = 'ses-manager-label';
      {
        const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.disabled = !!state.error;
        checkbox.checked = !settings.hidden.includes(key); checkbox.setAttribute('aria-label', `Show ${engine.name} in selector`);
        checkbox.addEventListener('change', () => mutate(next => {
          next.hidden = next.hidden.filter(id => id !== key);
          if (!checkbox.checked) next.hidden.push(key);
        }));
        label.append(checkbox);
      }
      label.append(element('span', engine.name)); row.append(label);
      const actions = element('div'); actions.className = 'ses-manager-actions'; row.append(actions);
      const button = (text, action, callback) => {
        const control = element('button', text); control.type = 'button'; control.dataset.sesAction = action;
        control.disabled = !!state.error; control.setAttribute('aria-label', `${text} ${engine.name}`);
        control.addEventListener('click', callback); actions.append(control); return control;
      };
      for (const [action, text, delta] of [['up', 'Move up', -1], ['down', 'Move down', 1]]) {
        const control = button(text, action, () => mutate(next => {
          const ids = ordered.map(engineKey), current = ids.indexOf(key), target = ids.indexOf(engineKey(active[index + delta]));
          [ids[current], ids[target]] = [ids[target], ids[current]];
          next.order = [...ids, ...next.order.filter(id => !ids.includes(id))];
        }));
        control.disabled ||= index + delta < 0 || index + delta >= active.length;
      }
      button('Edit', 'edit', () => {
        changeDraft();editingNative=engine;
        editing = key; editRaw = state.raw; name.value = engine.name; url.value = engineTemplate(engine);
        iconDraft=[...settings.custom,...settings.overrides].find(item=>item.id===key)?.icon;
        iconChoice.value=iconDraft?.kind==='builtin'?`builtin:${iconDraft.name}`:iconDraft?.kind==='url'?'url':'default';
        imageUrl.value=iconDraft?.kind==='url'?iconDraft.url:'';updateIconPreview();
        add.textContent = 'Save engine'; cancel.hidden = false; name.focus();
      });
      button('Remove', native ? 'remove-native' : 'remove-custom', () => mutate(next => {
        if (native || presetForEngine(key)) {
          next.removed = [...next.removed.filter(id => id !== key), key];
          next.hidden = next.hidden.filter(id => id !== key);
          next.hidden.push(key);
        } else {
          // A manually added equivalent may have suppressed a shipped default.
          // Removing it must not immediately make that default reappear.
          for (const item of SES_PRESETS) if (item.name.toLowerCase() === engine.name.toLowerCase() || item.url === engineTemplate(engine)) {
            const defaultId = `custom-preset-${item.id}`;
            if (!next.removed.includes(defaultId)) next.removed.push(defaultId);
            if (!next.hidden.includes(defaultId)) next.hidden.push(defaultId);
          }
          next.custom = next.custom.filter(item => item.id !== key);
          next.hidden = next.hidden.filter(id => id !== key);
          next.order = next.order.filter(id => id !== key);
        }
        if (editing === key) clearEdit();
      }));
      list.append(row);
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if(saving || previewController) return;
    const token=draftRevision;
    saving=true;add.disabled=true;
    try {
      if (!rendered || rendered.error) throw new Error('Reset the invalid settings before adding engines.');
      if (!editing && rendered.settings.custom.length >= 100) throw new Error('The selector supports up to 100 custom engines.');
      // Capture the revision before a network wait; a late download must never
      // overwrite another window's changes or a newly opened editor.
      const expectedRaw=editing?editRaw:rendered.raw;
      const next = JSON.parse(JSON.stringify(rendered.settings));
      const engine = validateCustomEngine({ id: editing || `custom-${crypto.randomUUID()}`, name: name.value, url: url.value });
      if(iconChoice.value.startsWith('builtin:')) engine.icon={kind:'builtin',name:iconChoice.value.slice(8)};
      else if(iconChoice.value==='url') {
        engine.icon=iconDraft?.url===iconUrl(imageUrl.value)?iconDraft:await downloadPreview();
        if(disposed || token!==draftRevision || !engine.icon) return;
      }
      const native = engine.id.startsWith('native:');
      if (!native && rendered.settings.custom.some(item => item.id !== editing && item.name.toLowerCase() === engine.name.toLowerCase())) throw new Error('A custom engine with that name already exists.');
      const collection = native ? 'overrides' : 'custom';
      const existing = next[collection].findIndex(item => item.id === engine.id);
      if (collection === 'custom' && existing < 0 && next.custom.length >= 100) throw new Error('The selector supports up to 100 custom engines.');
      if (existing < 0) next[collection].push(engine);
      else next[collection][existing] = engine;
      saveEngineSettings(next, expectedRaw); clearEdit(); render();
    } catch (problem) { if(!disposed && token===draftRevision) error.textContent = problem.message; }
    finally {saving=false;add.disabled=!!rendered?.error;}
  });
  reset.addEventListener('click', () => {
    if (!rendered?.error) return;
    try {
      if (Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '') !== rendered.raw) throw new Error('Settings changed in another window. Close and reopen Configure.');
      Services.prefs.setStringPref(`${ENGINE_SETTINGS_PREF}-backup`, rendered.raw);
      saveEngineSettings(emptyEngineSettings(), rendered.raw); render();
    } catch (problem) { error.textContent = problem.message; }
  });
  dialog.append(heading, intro, list, removed, error, form, reset);
  container.append(dialog); render();
  return {element:dialog,refresh:render,reset(){clearEdit();removed.open=false;render();},destroy(){
    disposed=true;changeDraft();++revision;cancelDrag();document.removeEventListener('keydown',onDragKey,true);
    document.removeEventListener('dragend',cancelDrag);document.removeEventListener('drop',cancelDrag);dialog.remove();
  }};
}
