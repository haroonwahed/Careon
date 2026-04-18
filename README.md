
# SaaS Careon

This is a code bundle for SaaS Careon. The original project is available at [Figma](https://www.figma.com/design/xzDw9hPkK9kBtxMocatGPe/SaaS-Careon).

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Render Deployment

The repository includes a Render blueprint in `render.yaml`.

It provisions:

- one Django web service

The blueprint is configured for Render's free web plan. If Render still asks for payment, your account or selected region likely does not have free instances available, and Render will require a paid plan at creation time.

The build step installs Python and Node dependencies, builds the React client, copies the generated SPA into `theme/static/spa`, then runs `collectstatic` and `migrate`.

This setup expects an external PostgreSQL database. Add its connection string manually as `DATABASE_URL` in Render.

Do not paste placeholder values like `:port` into `DATABASE_URL`. Use a real connection string, for example:

- `postgresql://careon_user:super-secret-password@db.example.com:5432/careon?sslmode=require`

Before first production traffic, set these host-specific values in Render:

- `DATABASE_URL`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `DEFAULT_FROM_EMAIL`

The blueprint already wires `DJANGO_SECRET_KEY` and `DJANGO_SETTINGS_MODULE=config.settings_production`.
  