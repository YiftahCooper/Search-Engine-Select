// Selector-only configuration. Never writes to the browser search service.
const ENGINE_SETTINGS_PREF = 'extension.search-engine-select.engines';
const emptyEngineSettings = () => ({ version: 4, removed: [], hidden: [], custom: [], order: [], overrides: [] });
function engineKey(engine) {
  return engine ? (engine.sesId || `native:${engine.id || engine.name}`) : null;
}
function validateCustomEngine(value) {
  const name = typeof value?.name === 'string' ? value.name.trim() : '';
  const template = typeof value?.url === 'string' ? value.url.trim() : '';
  if (!name || name.length > 80) throw new Error('Enter an engine name of 1–80 characters.');
  if (template.length > 2048 || template.split('{searchTerms}').length !== 2) throw new Error('The search URL must contain {searchTerms} exactly once.');
  let url;
  try { url = new URL(template.replace('{searchTerms}', 'SES_QUERY_MARKER')); }
  catch { throw new Error('Enter a valid HTTPS search URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname || !/^https:\/\//i.test(template)) throw new Error('Use an HTTPS URL without a username or password.');
  if (url.host.includes('ses_query_marker') || url.hash.includes('SES_QUERY_MARKER') || !(url.pathname + url.search).includes('SES_QUERY_MARKER')) throw new Error('Place {searchTerms} in the URL path or query, not the host or fragment.');
  const icon = validateIcon(value.icon);
  return { id: value.id, name, url: template, ...(icon ? {icon} : {}) };
}
function readEngineSettings() {
  const raw = Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '');
  if (!raw) return { raw, settings: emptyEngineSettings(), error: '' };
  try {
    const value = JSON.parse(raw);
    if (![1, 2, 3, 4].includes(value?.version) || !Array.isArray(value.hidden) || !Array.isArray(value.custom) || value.hidden.length > 200 || value.custom.length > 100 || value.hidden.some(id => typeof id !== 'string')) throw new Error();
    const ids = new Set(), names = new Set();
    const custom = value.custom.map(item => {
      const engine = validateCustomEngine(item);
      if (typeof engine.id !== 'string' || !/^custom-[a-zA-Z0-9-]+$/.test(engine.id) || ids.has(engine.id) || names.has(engine.name.toLowerCase())) throw new Error();
      ids.add(engine.id); names.add(engine.name.toLowerCase()); return engine;
    });
    const order = value.version === 1 ? [] : value.order;
    const overrides = value.version === 1 ? [] : value.overrides;
    if (!Array.isArray(order) || order.length > 300 || order.some(id => typeof id !== 'string') || new Set(order).size !== order.length || !Array.isArray(overrides) || overrides.length > 200) throw new Error();
    const nativeIds = new Set();
    const checkedOverrides = overrides.map(item => {
      const engine = validateCustomEngine(item);
      if (typeof engine.id !== 'string' || !engine.id.startsWith('native:') || nativeIds.has(engine.id)) throw new Error();
      nativeIds.add(engine.id); return engine;
    });
    const removed = value.version < 4 ? value.hidden : value.removed;
    if (!Array.isArray(removed) || removed.length > 300 || removed.some(id => typeof id !== 'string')) throw new Error();
    return { raw, settings: { version: 4, removed: [...new Set(removed)], hidden: [...new Set(value.hidden)], custom, order, overrides: checkedOverrides }, error: '' };
  } catch {
    return { raw, settings: emptyEngineSettings(), error: 'Saved engine settings are invalid. They have been preserved. Reset them below to edit the list.' };
  }
}
function saveEngineSettings(settings, expectedRaw) {
  if (Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '') !== expectedRaw) throw new Error('Engine settings changed in another window. Close and reopen Configure.');
  const encoded = JSON.stringify(settings);
  if (new TextEncoder().encode(encoded).length > 524288) throw new Error('The engine list is too large. Remove some custom icons or engines first.');
  Services.prefs.setStringPref(ENGINE_SETTINGS_PREF, encoded);
}
function configuredEngine(item) {
  const preset = presetForEngine(item.id);
  const icon = item.icon;
  const defaultIcon = preset && item.url === preset.url ? defaultEngineIcon(preset.id) : undefined;
  return {
    name: item.name, sesId: item.id,
    sesIcon: icon, sesDefaultIcon: defaultIcon,
    // Configured URLs use their own origin, never a third-party favicon lookup.
    sesIconOrigin: new URL(item.url.replace('{searchTerms}', '')).origin,
    getSubmission(term) { return { uri: { spec: item.url.replace('{searchTerms}', encodeURIComponent(term)) }, postData: null }; }
  };
}
function orderedEngines(installed, settings) {
  const overrides = new Map(settings.overrides.map(item => [item.id, item]));
  const engines = [...installed.map(engine => overrides.has(engineKey(engine)) ? configuredEngine(overrides.get(engineKey(engine))) : engine), ...settings.custom.map(configuredEngine)];
  for (const item of SES_PRESETS) {
    const id = `custom-preset-${item.id}`;
    // Keep existing edited entries and avoid duplicating a browser/custom engine.
    if (!engines.some(engine => engineKey(engine) === id || engine.name.toLowerCase() === item.name.toLowerCase() || engineTemplate(engine) === item.url))
      engines.push(configuredEngine({...item,id}));
  }
  const rank = new Map(settings.order.map((id, index) => [id, index]));
  return engines.sort((a, b) => (rank.get(engineKey(a)) ?? Infinity) - (rank.get(engineKey(b)) ?? Infinity));
}
async function allSearchEngines(forDetection = false) {
  const installed = await getVisibleEngines();
  const settings = readEngineSettings().settings;
  const configured = orderedEngines(installed, settings);
  if (!forDetection) return configured;
  // Google redirects the shipped Images endpoint from udm=2 to tbm=isch.
  // This is a detection alias only; user-edited URLs retain their own contract.
  const detection = configured.flatMap(engine => {
    if (engineKey(engine) !== 'custom-preset-google-images' || engineTemplate(engine) !== presetForEngine(engineKey(engine)).url) return [engine];
    return [engine, { ...engine, getSubmission(term) {
      return { uri: { spec: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(term)}` }, postData: null };
    } }];
  });
  // Native URLs still identify a search after an override or removal from this selector.
  return [...detection, ...installed.filter(engine => settings.overrides.some(item => item.id === engineKey(engine)))];
}
function engineTemplate(engine) {
  const marker = 'SES_EDIT_QUERY_MARKER';
  try {
    const submission = engine.getSubmission(marker);
    if (submission?.postData) return '';
    const url = submission?.uri?.spec || '';
    return url.includes(marker) ? url.replace(marker, '{searchTerms}') : '';
  } catch { return ''; }
}
