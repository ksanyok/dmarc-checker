# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-26

### Added
- `dmarc-checker` CLI with `--json`, `--strict` and offline `--record` linting
- RFC 7489 tag parser with validation of p, sp, np, pct, adkim, aspf, fo, rf, ri, rua and ruf
- Organizational-domain fallback lookup for subdomains
- Policy lints: monitoring-only policy, partial pct, weak subdomain policy, missing reports
- External report destination authorization check (`<domain>._report._dmarc.<dest>`)
- Library API (`checkDmarc`, `parseDmarc`, `lintDmarc`) with injectable resolver, and GitHub Action

[1.0.0]: https://github.com/ksanyok/dmarc-checker/releases/tag/v1.0.0
