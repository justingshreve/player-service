import { handler } from '../post'
import { create } from '../../src/players'

jest.mock('../../src/players')

const mockCreate = create as jest.MockedFunction<typeof create>

describe('Test Player Get Interface', () => {
  it('should throw missing body', async () => {
    await expect(handler({ })).rejects.toThrow('Missing body')
  })
  it('should throw missing body id', async () => {
    await expect(handler({ body: JSON.stringify({ id: '', teamId: '', fullname: '' })})).rejects.toThrow('missing body.id')
  })
  it('should throw missing body teamId', async () => {
    await expect(handler({ body: JSON.stringify({ id: 'abc', teamId: '', fullname: '' })})).rejects.toThrow('missing body.teamId')
  })
  it('should throw missing body fullname', async () => {
    await expect(handler({ body: JSON.stringify({ id: 'abc', teamId: 'hi', fullname: '' })})).rejects.toThrow('missing body.fullname')
  })
  it('should succeed', async () => {
    mockCreate.mockResolvedValue(true)
    await handler({ body: JSON.stringify({id: 'abc', teamId: 'def', fullname: 'Larry  Jounce'}) })
    expect(mockCreate).toHaveBeenCalled()
  })
})
