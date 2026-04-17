
# SaaS Careon

This is a code bundle for SaaS Careon. The original project is available at [Figma](https://www.figma.com/design/xzDw9hPkK9kBtxMocatGPe/SaaS-Careon).

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Render Deployment

The repository includes a Render blueprint in `render.yaml`.

It provisions:

- one Django web service
- one managed PostgreSQL database

The build step installs Python and Node dependencies, builds the React client, copies the generated SPA into `theme/static/spa`, then runs `collectstatic` and `migrate`.

Before first production traffic, set these host-specific values in Render:

- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `DEFAULT_FROM_EMAIL`

The blueprint already wires `DATABASE_URL`, `DJANGO_SECRET_KEY`, and `DJANGO_SETTINGS_MODULE=config.settings_production`.
  