# fonts

a tiny google fonts cli for installing fonts on your machine.

this exists because google fonts should be installable from the terminal without api keys, browser clicking, or downloading a zip like it is 2012.

## usage

install globally:

```sh
npm install -g @extoci/fonts
```

then:

```sh
font add inter
```

to launch the interactive installer:

```sh
font add
```

it uses [google-webfonts-helper](https://gwfh.mranftl.com/fonts), so you do not need a google api key.

## requirements

- node 20+ for the published cli
- [bun](https://bun.com) if you are developing locally
- internet access, obviously
- on linux, `fc-cache` is nice to have but not required

## what it does

`font add` installs font files into your user font directory:

- macos: `~/Library/Fonts`
- linux: `~/.local/share/fonts` (or `$XDG_DATA_HOME/fonts`)
- windows: `%LOCALAPPDATA%\Microsoft\Windows\Fonts`

installed fonts are tracked in a small manifest so `font list`, `font remove`, and `font update` know what this cli put there.

## commands

interactive mode:

```sh
font add
```

scriptable commands:

```sh
font add inter
font add inter -v regular,700
font download "Source Sans 3" --dest ./fonts --woff2
font find inter
font find --all
font list
font update
font remove inter
```

## useful flags

- `-v, --variants regular,700` – install or download specific variants
- `-d, --dest ./fonts` – save font files somewhere instead of installing them
- `--woff2` – download woff2 files instead of ttf
- `--refresh` – refresh the cached google fonts catalog
- `--all` – print the whole catalog with `font find`
- `--limit 10` – limit `font find` output
- `--select` – pick one narrowed `font find` result interactively
- `-y, --yes` – skip prompts where possible

## quick examples

install inter regular and bold:

```sh
font add inter -v regular,700
```

search google fonts:

```sh
font find mono
```

print every font in the catalog:

```sh
font find --all
```

download web fonts into your project:

```sh
font download inter --dest ./public/fonts --woff2
```

remove fonts installed by this cli:

```sh
font remove inter
```

## development

run with bun:

```sh
bun run dev
```

build:

```sh
bun run build
```

test:

```sh
bun run test
```

## troubleshooting

- `font add` worked but the font is not showing up
  restart the app you are trying to use the font in. some apps cache the font list.

- linux font list did not refresh
  install `fontconfig` so `fc-cache` is available, then run `fc-cache -f`.

- search feels stale
  run with `--refresh` to redownload the google fonts catalog.

- windows install is weird
  windows font installation is windows font installation. this cli installs into the current user's font directory and registers the font for that user.

## notes

this is bun-first for development, but the published binary is a bundled node cli so `npm install -g @extoci/fonts` works normally.

## acknowledgements

uses [google-webfonts-helper](https://gwfh.mranftl.com/fonts) for the font catalog and file urls. built by [exotic](https://x.com/ex0t1clol) with codex.
