// Default engines appear in the same editable list as browser/custom engines.
// Stable legacy IDs retain existing 1.3.0 edits, icons and order.
const SES_PRESETS = [
  {id:'google-images',name:'Google Images',url:'https://www.google.com/search?udm=2&q={searchTerms}'},
  {id:'youtube',name:'YouTube',url:'https://www.youtube.com/results?search_query={searchTerms}'},
  {id:'google-maps',name:'Google Maps',url:'https://www.google.com/maps/search/?api=1&query={searchTerms}'},
  {id:'google-scholar',name:'Google Scholar',url:'https://scholar.google.com/scholar?q={searchTerms}'},
  {id:'reddit',name:'Reddit',url:'https://www.reddit.com/search/?q={searchTerms}'},
  {id:'reddit-google',name:'Reddit via Google',url:'https://www.google.com/search?q=site%3Areddit.com%20{searchTerms}'},
  {id:'pdf-google',name:'PDFs via Google',url:'https://www.google.com/search?q={searchTerms}%20filetype%3Apdf'}
];
function presetForEngine(id) { return SES_PRESETS.find(preset => `custom-preset-${preset.id}` === id); }
