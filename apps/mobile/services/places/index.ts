import { z } from 'zod';

/**
 * Typed, validated access to the Google Places web APIs.
 *
 * The raw `response.json()` is `any`; every field the app reads is validated
 * with zod at this boundary (docs/12-calidad.md) so callers work with typed
 * data instead of unchecked property access.
 */

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

const placeDetailsResponse = z.object({
  status: z.string(),
  error_message: z.string().optional(),
  result: z
    .object({
      name: z.string().optional(),
      formatted_address: z.string().optional(),
      rating: z.number().optional(),
      price_level: z.number().optional(),
      geometry: z
        .object({
          location: z.object({ lat: z.number(), lng: z.number() }),
        })
        .optional(),
    })
    .optional(),
});

export type PlaceDetailsResponse = z.infer<typeof placeDetailsResponse>;

const autocompleteResponse = z.object({
  status: z.string(),
  error_message: z.string().optional(),
  predictions: z
    .array(
      z.object({
        place_id: z.string(),
        description: z.string(),
      }),
    )
    .default([]),
});

export type AutocompleteResponse = z.infer<typeof autocompleteResponse>;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  return response.json() as Promise<unknown>;
}

export async function getPlaceDetails(
  apiKey: string,
  placeId: string,
  fields: string,
): Promise<PlaceDetailsResponse> {
  const params = new URLSearchParams({ place_id: placeId, fields, key: apiKey, language: 'es' });
  const data = await fetchJson(`${PLACES_BASE}/details/json?${params.toString()}`);
  return placeDetailsResponse.parse(data);
}

export async function getAutocomplete(
  apiKey: string,
  input: string,
  location: { latitude: number; longitude: number },
  radiusMeters: number,
): Promise<AutocompleteResponse> {
  const params = new URLSearchParams({
    input,
    key: apiKey,
    language: 'es',
    location: `${location.latitude},${location.longitude}`,
    radius: String(radiusMeters),
  });
  const data = await fetchJson(`${PLACES_BASE}/autocomplete/json?${params.toString()}`);
  return autocompleteResponse.parse(data);
}
