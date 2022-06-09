import { create } from '../src/players'

export const handler = async (event: any) => {
  if (!event.body) throw new Error('Missing body')
  const body = JSON.parse(event.body)
  if (!body.id) throw new Error('missing body.id')
  if (!body.teamId) throw new Error('missing body.teamId')
  if (!body.fullname) throw new Error('missing body.fullname')
  return create(body.id, body.teamId, body.fullname)
}
