import { get, create } from '../players'

console.log = jest.fn()
console.warn = jest.fn()

describe('Test Player Service', () => {
  it('should create', async () => {
    await create('abc', 'def', 'fullname')
  })
  it('should get', async () => {
    const players = await get('def')
    expect(players).toHaveLength(1)
  })
  it('should return empty array if team not found', async () => {
    const players = await get('xyz')
    expect(players).toHaveLength(0)
  })
})
