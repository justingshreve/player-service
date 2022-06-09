import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

let config: DynamoDBClientConfig = {
  region: process.env.AWS_REGION
}
if (process.env.NODE_ENV === 'test') {
  config = { ...config, ...{ endpoint: process.env.DYNAMODB_ENDPOINT } }
}
const client: DynamoDBClient = new DynamoDBClient(config)

const ddbDocClient = DynamoDBDocumentClient.from(client)

export default ddbDocClient
