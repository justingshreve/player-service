import { TypedError } from 'typed-error'
import { PutCommand, PutCommandInput, QueryCommandInput, QueryCommand, QueryCommandOutput } from '@aws-sdk/lib-dynamodb'
import ddbDocClient from './dynamodb'

const DynamoDBTableName = process.env.DYNAMODB_TABLE

/* istanbul ignore next */
export class TeamError extends TypedError {
  public status?: number
  constructor (status: number, err: Error | string) {
    super(err)
    if (!isNaN(status)) {
      this.status = status
    }
  }
}

export interface Player {
  id: String,
  teamId: String,
  fullname: String
}

export const create = async (id: string, teamId: string, fullname: string): Promise<Boolean> => {
  const Item: Player = {
    id,
    teamId,
    fullname
  }
  const input: PutCommandInput = {
    TableName: DynamoDBTableName,
    Item
  }
  const command = new PutCommand(input)
  await ddbDocClient.send(command)
  return true
}

export const get = async (teamId: string): Promise<Player[]> => {
  const query: QueryCommandInput = {
    TableName: DynamoDBTableName,
    IndexName: 'teamIdIndex',
    KeyConditionExpression: 'teamId = :teamId',
    ExpressionAttributeValues: {
      ':teamId': teamId
    },
    ProjectionExpression: 'id, teamId, fullname',
    ScanIndexForward: false,
    Limit: 20
  }
  const command = new QueryCommand(query)
  const data: QueryCommandOutput = await ddbDocClient.send(command)
  if (!data || !data.Items || !data.Items.length) return []
  const players: Player[] = data.Items.map((item) => item as Player)
  return players
}
