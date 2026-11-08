"""Optional Windows smoke check against installed Zen assets; does not launch Zen."""
import re
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
script = (root / 'search-engine-select-runtime.uc.js').read_text(encoding='utf-8')
uri = re.search(r"const genericSearchIcon = '([^']+)'", script).group(1)
archives = {
    'chrome://browser/skin/': ('browser/omni.ja', 'chrome/browser/skin/classic/browser/'),
    'chrome://global/skin/': ('omni.ja', 'chrome/toolkit/skin/classic/global/'),
}
for prefix, (archive, directory) in archives.items():
    if uri.startswith(prefix):
        with zipfile.ZipFile(Path('C:/Program Files/Zen Browser') / archive) as bundle:
            svg = bundle.read(directory + uri.removeprefix(prefix))
            assert b'<svg' in svg, 'Fallback is not an SVG asset'
        print('Native fallback asset exists:', uri)
        break
else:
    raise AssertionError('Unknown native resource mapping: ' + uri)
