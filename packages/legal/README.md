# @bianca/legal

Single source of truth for Bianca Wellness legal documents.

## Documents

| File | Website slug |
|------|----------------|
| `TERMS.md` | `/terms/` |
| `PRIVACY.md` | `/privacy/` |
| `PRIVACY_PIPEDA.md` | `/privacy-pipeda/` |
| `NOTICE_OF_PRIVACY_PRACTICES.md` | `/privacy-practices/` |
| `CROSS_BORDER_DATA_TRANSFERS.md` | `/cross-border-data-transfers/` |
| `DATA_SAFETY.md` | `/data-safety/` |

## Usage

```js
const legal = require('@bianca/legal');
legal.TERMS; // markdown string
legal.urls.privacy; // https://biancawellness.com/privacy/
```

## Sync to marketing WordPress theme

From repo root:

```bash
yarn legal:sync
```

Copies markdown into `packages/marketing/wordpress/wp-content/themes/bianca-wellness/data/legal/`. The theme seeds/updates WordPress pages from those files on deploy.
