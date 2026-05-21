# @extoci/fonts

A short Google Fonts CLI for installing fonts on your machine.

```bash
npm install -g @extoci/fonts

font add inter
font add
font find "source sans"
font download inter --dest ./fonts --woff2
font list
font update
font remove inter
```

The CLI uses [google-webfonts-helper](https://gwfh.mranftl.com/fonts) as its Google Fonts source, so it does not need a Google API key.
