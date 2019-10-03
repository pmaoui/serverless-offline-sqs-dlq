# serverless-offline-sqs-dlq

This Serverless-offline plugin brings [Dead-Letter Queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html) to AWS λ and SQS queue on your local machine. It extends [serverless-offline-sqs](https://github.com/CoorpAcademy/serverless-plugins/tree/master/packages/serverless-offline-sqs) and thus depends on it.

Warning: Serverless [doesn't support yet SQS for DLQ](https://serverless.com/framework/docs/providers/aws/guide/functions#dlq-with-sqs). After the deployment on AWS, the DLQ needs to be set on AWS (either manually or by a script).

## Installation

First, ensure to have [serverless-offline-sqs](https://github.com/CoorpAcademy/serverless-plugins/tree/master/packages/serverless-offline-sqs) included in your project:

```sh
npm install serverless-offline-sqs serverless-offline-sqs-dlq

```

Then inside your project's `serverless.yml` file, add following entries to the plugins section before `serverless-offline` (and after `serverless-webpack` if presents).

```yml
plugins:
  - serverless-webpack
  - serverless-offline-sqs
  - serverless-offline-sqs-dlq
  - serverless-offline
```


## Configure

Usage:
```yml
functions:
  basicLambda:
    handler: index.basicLambda
    events:
      - sqs: arn:aws:sqs:eu-west-1:XXXXXXX:basicLambdaTriggerQueue
  handleErrorLambda:
    handler: index.handleErrorLambda
    events:
      - sqs: arn:aws:sqs:eu-west-1:XXXXXXX:handleErrorLambdaQueue
```

Specify in the `custom` section which function handles errors:
```yml
custom:
  (...)
  serverless-offline-sqs-dlq:
    basicLambda:
      onError: handleErrorLambda
      maxReceiveCount: 3
```
