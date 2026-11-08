# Legacy hot-update fixture

`upstream-1.1.32.js` is the unchanged Search Engine Select script from
`Vertex-Mods/Search-Engine-Select`, commit
`b58353d29d9cca5c431e3b3989a74f07eb4953ce` (MIT, Bibek Bhusal; see the
repository LICENSE and UPSTREAM.json). It intentionally lacks lifecycle
cleanup, so the hot-update regression exercises real legacy controls rather
than artificial DOM placeholders. It is a test fixture, not a Sine entry.
