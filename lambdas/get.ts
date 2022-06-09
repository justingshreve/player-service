import { get } from '../src/players'

export const handler = async (event: any) => {
  if (!event.queryStringParameters) throw new Error('Missing queryStringParameters')
  if (!event.queryStringParameters.teamId) throw new Error('Missing teamId')
  return get(event.queryStringParameters.teamId)
}
