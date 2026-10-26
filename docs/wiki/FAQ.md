# FAQ

## Is p=none bad?

It is the right first step — you get reports without risking legitimate mail. It is bad as a permanent state: `p=none` does not stop a single spoofed message. Read a few weeks of aggregate reports, fix the senders that fail, then move to `p=quarantine` and later `p=reject`.

## What does pct do?

`pct` applies the policy to only that percentage of failing messages; the rest are treated one step softer. It is useful for a gradual rollout (`pct=10` → `50` → `100`) but should end at 100.

## Why are my reports not arriving?

Check that `rua=` uses `mailto:` and, if the address is on another domain (a DMARC reporting service, for example), that the destination publishes `yourdomain.com._report._dmarc.destination.com` with `v=DMARC1`. This tool checks that for you.

## Do subdomains need their own record?

No. Without one, receivers use the organizational domain record and its `sp=` tag (or `p=` if `sp` is absent). Add a separate record only if a subdomain needs a different policy or reports.

## What is the difference between relaxed and strict alignment?

With relaxed alignment (`r`, the default) `mail.example.com` aligns with `example.com`. With strict (`s`) the domains must match exactly. Strict is rarely needed and breaks mail sent from subdomains.
