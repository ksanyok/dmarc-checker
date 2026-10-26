# Getting started

## Requirements

Node.js 18 or newer. No other dependencies.

## Install

```bash
# one-off run
npx github:ksanyok/dmarc-checker example.com

# global CLI
npm install -g github:ksanyok/dmarc-checker

# as a library in your project
npm install github:ksanyok/dmarc-checker
```

## First run

```bash
dmarc-checker example.com
```

The first lines show the record and the **effective policy** for the name you asked about (for a subdomain it may come from the parent domain). Then every recognized tag is listed with a plain-English name, followed by problems: `✖` errors make the record unusable, `!` warnings weaken protection or reporting, `i` notes are informational.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No errors (warnings allowed unless `--strict`) |
| 1 | Errors found (or warnings with `--strict`) |
| 2 | Bad arguments or the check could not run |

## More examples

**Lint a record before publishing it (no DNS needed)**

```bash
dmarc-checker --record "v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@example.com"
```

**Check a subdomain (falls back to the parent policy)**

```bash
dmarc-checker mail.example.com
```

**JSON for monitoring scripts**

```bash
dmarc-checker example.com --json | jq '.policy, .issues'
```

## Without installing anything

Use the [online DMARC Checker](https://promopilot.link/en/tools/dmarc-checker.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=dmarc-checker).
