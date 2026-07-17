// @ts-nocheck — pending rewrite (schema migration lot 2)
/**
 * Bloctel is the French opt-out registry for cold calling.
 * Checking requires a registered B2B account with bloctel.gouv.fr.
 * This module provides the integration structure; actual API calls
 * require valid credentials configured by the user.
 *
 * Doc: https://www.bloctel.gouv.fr/pages/professionnel.html
 */

export type BloctelResult = {
  phone: string;
  blocked: boolean;
};

export async function checkBloctel(phones: string[]): Promise<BloctelResult[]> {
  // In production: POST batch to Bloctel API with your subscriber credentials.
  // Until credentials are provided, we mark all as unchecked (not blocked)
  // so the campaign can still run — the UI warns the user.
  if (!process.env.BLOCTEL_LOGIN || !process.env.BLOCTEL_PASSWORD) {
    return phones.map((phone) => ({ phone, blocked: false }));
  }

  // TODO: implement real Bloctel SOAP/REST call when credentials are available
  return phones.map((phone) => ({ phone, blocked: false }));
}
