<h1 align="center">initx ⚙️</h1>

<p align="center"><code>initx</code> A more convenient scripting engine</p>

<pre align="center">npx <b>initx &lt;something&gt;</b></pre>

## @initx-plugin/cp

Copy plugin for `initx`. Ships with built-in presets (SSH / GPG / CWD) and an optional GitHub-backed data store so you can copy private snippets from anywhere.

```bash
npx initx plugin add cp
```

## Usage

### Built-in presets

```bash
npx initx cp cwd    # current working directory
npx initx cp ssh    # SSH public key (picks from .ssh/ or interactively)
npx initx cp gpg    # GPG public key
```

Running `npx initx cp` with no key opens an interactive picker over presets and any configured data keys (most-recently-used first), so you can fuzzy-search and copy without typing the key name.

### GitHub-backed data store

Point `cp` at a private GitHub repo and a personal access token, then store named snippets as files. Any `cp <key>` that is not a built-in preset will look up the file from the repo and copy it to your clipboard. Files are cached locally under `~/.initx/cp/cache/`.

#### 1. Configure the store

Either walk through an interactive setup or set values one by one:

```bash
npx initx cp-config setup
# or
npx initx cp-config set repo  owner/private-repo
npx initx cp-config set token ghp_xxxxxxxxxxxxxxxxxxxx
# optional
npx initx cp-config set branch main          # default: main
npx initx cp-config set path  data           # path inside the repo
```

`cp-config setup` prompts for each value in turn. Press Enter to keep the current value, type to overwrite. The token prompt is always masked.

Token is saved in plaintext at `~/.initx/cp/config.json`. Prefer a fine-grained PAT scoped to only the target repository.

#### 2. Add / fetch / remove data keys

```bash
npx initx cp-config set my-token "abc 123"
npx initx cp my-token       # copies "abc 123" to clipboard
npx initx cp-config get my-token
npx initx cp-config list
npx initx cp-config rm my-token
```

Each key becomes a file at `<path>/<key>` inside the repo, with the value as the file content. Keys cannot contain `/` and may not be `.` or `..`. On `ix cp <key>`, the cached value is used when available; otherwise the file is fetched from GitHub and cached.

#### 3. Inspect config

```bash
npx initx cp-config status     # shows config (token redacted)
```

## Documentation

[initx](https://github.com/initx-collective/initx)