# Marketing WordPress (biancawellness.com)

Source for the public marketing site: custom theme, deploy scripts, and local Docker dev environment.

**Infrastructure (Lightsail, DNS):** `packages/backend/devops/terraform-marketing-wordpress/`

## What's in git

| Tracked | Not tracked (see `.gitignore`) |
|---------|--------------------------------|
| `bianca-wellness` theme | WordPress core (Docker image) |
| Custom mu-plugins | Third-party plugins (Contact Form 7, Yoast, etc.) |
| `myphonefriend-stripe-method` plugin | `uploads/`, cache, DB dumps |
| Deploy / maintenance scripts | `wordpress/wp-config.php` (secrets) |
| Brand assets | `aws-ses-smtp.php` with credentials |

## Local development

```bash
# From bianca-app repo root
yarn marketing:up

# First time only
cp packages/marketing/wp-config.php.example packages/marketing/wordpress/wp-config.php

# Site: http://localhost:8085
# phpMyAdmin: http://localhost:8086
```

Optional — pull live content from legacy EC2 WordPress:

```bash
cd packages/marketing/scripts
./pull-from-production.sh
```

## Deploy to Lightsail

```bash
export BIANCA_LIGHTSAIL_HOST="$(cd packages/backend/devops/terraform-marketing-wordpress && terraform output -raw lightsail_static_ip)"

cd packages/marketing/scripts
./deploy-to-lightsail.sh
```

Full migration (EC2 read-only copy → local → Lightsail): `./migrate-ec2-wordpress-to-lightsail.sh`

See `docs/LIGHTSAIL.md` for HTTPS, DNS, and smoke tests.

## Theme: Try the App

Nav should point to **`/try-the-app/`** (on-site gate). During production hours (7am–1pm Pacific) it redirects to `https://app.biancawellness.com`; off-hours it shows availability copy.

After deploy: `php setup-try-the-app-page.php` on the server (via WP-CLI eval-file or SSH).

## Migrated from wp-dev

Previously lived in `~/code/wp-dev/sites/biancawellness`. That tree can be archived once you confirm this package works for local dev and deploy.
