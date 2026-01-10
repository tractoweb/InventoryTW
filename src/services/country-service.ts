import { amplifyClient } from '@/lib/amplify-config';

export async function listCountries() {
  const { data, errors } = await amplifyClient.models.Country.list();
  if (errors) throw new Error('Error al listar países');
  return data ?? [];
}

export async function getCountryByCode(code: string) {
  const { data, errors } = await amplifyClient.models.Country.list({
    filter: { code: { eq: code } },
    limit: 1,
  });
  if (errors) throw new Error('Error al buscar país');
  return data && data.length > 0 ? data[0] : null;
}


export async function createCountry({ idCountry, name, code }: { idCountry: number; name: string; code: string }) {
  const { data, errors } = await amplifyClient.models.Country.create({ idCountry, name, code });
  if (errors) throw new Error('Error al crear país');
  return data;
}
