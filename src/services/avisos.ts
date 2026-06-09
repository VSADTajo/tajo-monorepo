import { api } from './api'

export async function getAvisosByTipoService(tipo: string): Promise<unknown> {
  return api
    .get('meteo/avisos', {
      searchParams: {
        tipo,
      },
      headers: {
        Accept: 'application/json',
      },
    })
    .json<unknown>()
}
