import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

function getPlaidEnv(): string {
  const env = process.env.PLAID_ENV ?? 'sandbox';
  switch (env) {
    case 'production':
      return PlaidEnvironments.production ?? 'https://production.plaid.com';
    case 'development':
      return PlaidEnvironments.development ?? 'https://development.plaid.com';
    default:
      return PlaidEnvironments.sandbox ?? 'https://sandbox.plaid.com';
  }
}

let _client: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi | null {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) return null;

  if (!_client) {
    const config = new Configuration({
      basePath: getPlaidEnv(),
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    });
    _client = new PlaidApi(config);
  }

  return _client;
}
