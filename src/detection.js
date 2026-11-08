// A query parameter alone is not evidence of a search engine. Match an actual
// configured GET submission's origin, path, query field and fixed mode values.
function searchUrlMatcher(engine) {
  const marker = 'SEARCH_TERM_PLACEHOLDER_E6A8D';
  const submission = engine.getSubmission(marker);
  if (!submission?.uri?.spec || submission.postData) return null;
  const template = new URL(submission.uri.spec);
  if (!['https:', 'http:'].includes(template.protocol) || template.username || template.password) return null;
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = (value, capture) => new RegExp(`^${value.split(marker).map(escape).join(capture)}$`, 's');
  const pathQuery = template.pathname.includes(marker);
  const queryFields = [...template.searchParams].filter(([,value]) => value.includes(marker));
  if (Number(pathQuery) + queryFields.length !== 1) return null;
  const queryField = queryFields[0];
  const pathPattern = pattern(template.pathname, '([^/]+)');
  const termPattern = queryField && pattern(queryField[1], '(.+)');
  // Native attribution/encoding values vary by entry point and may disappear
  // on redirect. User-configured fixed parameters remain exact constraints.
  const attribution = new Set(['t', 'client', 'source', 'sourceid', 'form', 'ie', 'oe', 'rlz']);
  const fixed = [...template.searchParams].filter(([key,value]) => !value.includes(marker) && (engine.sesId || !attribution.has(key.toLowerCase())));
  const fixedGroups = [...new Set(fixed.map(([key]) => key))].map(key => [key, fixed.filter(([name]) => name === key).map(([,value]) => value).sort()]);
  // A literal prefix/suffix around the term (site:reddit.com, filetype:pdf)
  // identifies a more specific mode than the same endpoint's general search.
  const wrappedTerm = queryField ? queryField[1].replace(marker,'').length : 0;
  return {engine, specificity: fixed.length + Number(wrappedTerm > 0), match(url) {
    if (url.origin !== template.origin || url.username || url.password) return null;
    const path = url.pathname.match(pathPattern);
    if (!path || fixedGroups.some(([key,expected]) => {
      const actual = url.searchParams.getAll(key).sort();
      return actual.length !== expected.length || actual.some((value,index) => value !== expected[index]);
    })) return null;
    let term;
    if (pathQuery) {
      try { term = decodeURIComponent(path[1]); } catch { return null; }
    } else {
      const values = url.searchParams.getAll(queryField[0]);
      if (values.length !== 1) return null;
      term = values[0].match(termPattern)?.[1];
    }
    return term?.trim() ? {engine, term: term.trim()} : null;
  }};
}
