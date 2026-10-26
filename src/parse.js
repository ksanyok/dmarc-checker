const POLICIES = new Set(['none', 'quarantine', 'reject']);
const KNOWN = new Set(['v', 'p', 'sp', 'np', 'pct', 'adkim', 'aspf', 'fo', 'rf', 'ri', 'rua', 'ruf', 'psd', 't']);

/** True when a TXT string is a DMARC record. */
export const isDmarc = (txt) => /^v\s*=\s*DMARC1\s*(;|$)/i.test(String(txt).trim());

/** Parse "mailto:a@b.com!10m" style URIs. */
export function parseUris(value) {
  return value.split(',').map((s) => s.trim()).filter(Boolean).map((raw) => {
    const m = /^mailto:([^!\s]+@([^!\s]+?))(?:!(\d+[kmgt]?))?$/i.exec(raw);
    return m ? { raw, address: m[1], domain: m[2].toLowerCase(), limit: m[3] || null, valid: true } : { raw, valid: false };
  });
}

/**
 * Parse a DMARC record into tags. Returns { tags, errors }.
 * @param {string} record
 */
export function parseDmarc(record) {
  const errors = [];
  const tags = {};
  const parts = String(record).split(';').map((s) => s.trim()).filter(Boolean);
  parts.forEach((part, i) => {
    const eq = part.indexOf('=');
    if (eq < 1) { errors.push(`Malformed tag "${part}" (expected name=value)`); return; }
    const name = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (i === 0 && name !== 'v') errors.push('The record must start with "v=DMARC1"');
    if (name in tags) errors.push(`Duplicate tag "${name}"`);
    if (!KNOWN.has(name)) errors.push(`Unknown tag "${name}"`);
    tags[name] = value;
  });
  if (tags.v !== undefined && tags.v !== 'DMARC1') errors.push(`v must be exactly "DMARC1", got "${tags.v}"`);
  if (tags.p === undefined) errors.push('Missing required tag "p" (policy)');
  for (const t of ['p', 'sp', 'np']) {
    if (tags[t] !== undefined && !POLICIES.has(tags[t].toLowerCase())) errors.push(`${t}=${tags[t]} is not one of none, quarantine, reject`);
  }
  if (tags.pct !== undefined && !(/^\d{1,3}$/.test(tags.pct) && +tags.pct <= 100)) errors.push(`pct=${tags.pct} must be an integer 0–100`);
  for (const t of ['adkim', 'aspf']) {
    if (tags[t] !== undefined && !/^[rs]$/i.test(tags[t])) errors.push(`${t}=${tags[t]} must be "r" (relaxed) or "s" (strict)`);
  }
  if (tags.fo !== undefined && !/^[01ds](:[01ds])*$/i.test(tags.fo)) errors.push(`fo=${tags.fo} must be a colon-separated list of 0, 1, d, s`);
  if (tags.ri !== undefined && !/^\d+$/.test(tags.ri)) errors.push(`ri=${tags.ri} must be a number of seconds`);
  for (const t of ['rua', 'ruf']) {
    if (tags[t] === undefined) continue;
    for (const u of parseUris(tags[t])) if (!u.valid) errors.push(`${t}: "${u.raw}" is not a valid mailto: URI`);
  }
  return { tags, errors };
}

/**
 * Policy-level warnings for a parsed record (syntax errors are reported by parseDmarc).
 * @returns {{level: 'error'|'warning'|'info', code: string, message: string}[]}
 */
export function lintDmarc(record, parsed = parseDmarc(record)) {
  const out = [];
  const add = (level, code, message) => out.push({ level, code, message });
  const t = parsed.tags;
  const p = (t.p || '').toLowerCase();
  if (p === 'none') add('warning', 'policy-none', 'p=none only monitors: spoofed mail is still delivered. Move to quarantine or reject once reports look clean.');
  if (t.pct !== undefined && +t.pct < 100 && p !== 'none') add('warning', 'partial-pct', `pct=${t.pct}: the policy applies to only ${t.pct}% of failing mail.`);
  if (t.sp && t.sp.toLowerCase() === 'none' && p !== 'none') add('warning', 'weak-subdomain-policy', 'sp=none leaves subdomains unprotected while the main domain is enforced.');
  if (!t.rua) add('warning', 'no-rua', 'No rua= address: you will not receive aggregate reports, so you cannot see who sends mail as you.');
  if (t.ruf) add('info', 'ruf', 'ruf= (forensic reports) is set; most large providers do not send them.');
  if (t.adkim?.toLowerCase() === 's' || t.aspf?.toLowerCase() === 's') add('info', 'strict-alignment', 'Strict alignment is on: mail from subdomains will not align with the main domain.');
  if (String(record).length > 255) add('info', 'long-record', 'Record is longer than 255 characters and must be split into several TXT strings.');
  return out;
}
