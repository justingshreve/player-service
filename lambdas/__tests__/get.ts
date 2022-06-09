import { handler } from '../get'
import { get } from '../../src/players'

jest.mock('../../src/players')

const mockGet = get as jest.MockedFunction<typeof get>

describe('Test Player Get Interface', () => {
  it('should throw missing queryStringParameters', async () => {
    await expect(handler({ queryStringParameters: '' })).rejects.toThrow('Missing queryStringParameters')
  })
  it('should throw missing teamId', async () => {
    await expect(handler({ queryStringParameters: { id: '' } })).rejects.toThrow('Missing teamId')
  })
  it('should succeed', async () => {
    mockGet.mockResolvedValue([{ id: 'abc', teamId: 'def', fullname: 'Larry Jounce' }])
    const res = await handler({ queryStringParameters: { teamId: 'abc' }})
    expect(mockGet).toHaveBeenCalled()
    expect(res[0]).toHaveProperty('id', 'abc')
  })
})
