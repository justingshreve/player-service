# Player Service

This is a demo project that was used in the June 2022 Serverless Microservice Meetup. It is a sample microservice that uses API Gateway, Lambda, and Dynamodb to accepted POSTed players, save them to Dynamodb, and then also provides a GET API Gateway endpoint to retrieve players by team.

<img width="624" alt="Screen Shot 2022-06-10 at 11 51 38 AM" src="https://user-images.githubusercontent.com/885096/173104024-6604c2d1-54c4-4b28-a14d-242e91f69d76.png">

Prerequisites:
  - AWS SDK installed locally.
  - You must be logged into the AWS account with valid credentials stored in `~/.aws/credentials`
  - An S3 deployment bucket entitled `meetup-demo-${aws:accountId}-${self:provider.region}` in the target region. This needs to be created manually.
  - Testing requires docker
  
**INSTALL**

`npm install`

**TESTING**

`npm test`

**DEPLOYING**

`npx sls deploy -s STAGE -r REGION --verbose --aws-profile PROFILE`

STAGE=stage name
REGION=AWS region
PROFILE=AWS profile

More info: https://www.serverless.com/framework/docs/providers/aws/cli-reference/deploy

`sls deploy` will ...

- create lambdas
- create a dynamodb table with indexes
- create cloudwatch log groups
- create an API Gateway and wire it up to lambdas
- create alarms for lambdas (in prod only)
- create all relevant roles and permissions

