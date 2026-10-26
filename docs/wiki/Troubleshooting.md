# Troubleshooting

## No DMARC record, but I just added one

DNS changes take time to propagate (up to the record TTL). Make sure the host name is `_dmarc` (your DNS panel may append the domain automatically — `_dmarc.example.com.example.com` is a common mistake) and the type is TXT.

## "Error: queryTxt ETIMEOUT" or ESERVFAIL

Your resolver could not answer. Retry, or pass a custom `resolveTxt` (for example DNS-over-HTTPS) when using the library.

## Two DMARC records reported

Some providers add their own record during onboarding. Delete one and merge the tags you need into the remaining record.

## Report destination not authorized

Ask your reporting provider for the authorization record, or check its docs — most publish a wildcard `*._report._dmarc.provider.com`. Until then many receivers will not send aggregate reports to that address.

## Still stuck?

Open an [issue](https://github.com/ksanyok/dmarc-checker/issues/new/choose) with the command, the output (`--json` if possible) and your Node.js version — or compare with the [online version](https://promopilot.link/en/tools/dmarc-checker.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=dmarc-checker).
