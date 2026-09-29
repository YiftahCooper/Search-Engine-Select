// Selector-only configuration. Never writes to the browser search service.
const ENGINE_SETTINGS_PREF = 'extension.search-engine-select.engines';
const emptyEngineSettings = () => ({ version: 1, hidden: [], custom: [] });
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
  return { id: value.id, name, url: template };
}
function readEngineSettings() {
  const raw = Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '');
  if (!raw) return { raw, settings: emptyEngineSettings(), error: '' };
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.hidden) || !Array.isArray(value.custom) || value.hidden.length > 200 || value.custom.length > 100 || value.hidden.some(id => typeof id !== 'string')) throw new Error();
    const ids = new Set(), names = new Set();
    const custom = value.custom.map(item => {
      const engine = validateCustomEngine(item);
      if (typeof engine.id !== 'string' || !/^custom-[a-zA-Z0-9-]+$/.test(engine.id) || ids.has(engine.id) || names.has(engine.name.toLowerCase())) throw new Error();
      ids.add(engine.id); names.add(engine.name.toLowerCase()); return engine;
    });
    return { raw, settings: { version: 1, hidden: [...new Set(value.hidden)], custom }, error: '' };
  } catch {
    return { raw, settings: emptyEngineSettings(), error: 'Saved engine settings are invalid. They have been preserved. Reset them below to edit the list.' };
  }
}
function saveEngineSettings(settings, expectedRaw) {
  if (Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '') !== expectedRaw) throw new Error('Engine settings changed in another window. Close and reopen Configure.');
  Services.prefs.setStringPref(ENGINE_SETTINGS_PREF, JSON.stringify(settings));
}
async function allSearchEngines() {
  const installed = await getVisibleEngines();
  const custom = readEngineSettings().settings.custom.map(item => ({
    name: item.name, sesId: item.id,
    iconURI: { spec: 'chrome://browser/skin/search-glass.svg' },
    getSubmission(term) { return { uri: { spec: item.url.replace('{searchTerms}', encodeURIComponent(term)) }, postData: null }; }
  }));
  return [...installed, ...custom];
}
