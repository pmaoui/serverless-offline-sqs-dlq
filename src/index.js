const SQS = require('aws-sdk/clients/sqs')
const { get } = require('lodash/fp')
const extractQueueNameFromARN = (arn, service) => {
  const getAtt = get(['Fn::GetAtt'], arn)
  if (getAtt) {
    const [resourceName] = getAtt
    const properties = get(
      ['resources', 'Resources', resourceName, 'Properties'],
      service,
    )
    const { QueueName } = properties
    return QueueName
  } else {
    const [, , , , , QueueName] = arn.split(':')
    return QueueName
  }
}

const GET_QUEUES_MAX_RETRIES = 5

const sleep = (ms) => new Promise((resolve) => setTimeout(() => resolve(), ms))

class ServerlessOfflineSQSDLQ {
  constructor(serverless, options) {
    this.serverless = serverless
    this.service = serverless.service
    this.options = options

    this.hooks = {
      'before:offline:start:init': this.offlineStartInit.bind(this),
      'before:offline:start:end': this.offlineStartEnd.bind(this),
    }
  }

  offlineStartInit() {
    this.serverless.cli.log(`Starting Offline SQS DLQ.`)

    const { functions, custom } = this.service
    const configDLQ = custom['serverless-offline-sqs-dlq']

    if (configDLQ) {
      const client = new SQS({
        ...custom['serverless-offline-sqs'],
      })

      Object.keys(configDLQ).forEach(async (functionName) => {
        const func = functions[functionName]
        if (!func) {
          this.serverless.cli.log(`λ not found: ${functionName}.`)
          return
        }
        let QueueArn = func.events.map((e) => e.sqs).filter((f) => f)[0]
        if (typeof QueueArn !== 'string' && QueueArn.arn !== undefined) {
          QueueArn = QueueArn.arn
        }

        if (!QueueArn) {
          this.serverless.cli.log(
            `λ without SQS event source: ${functionName}.`,
          )
          return
        }
        const funcDLQ = functions[configDLQ[functionName].onError]
        if (!funcDLQ) {
          this.serverless.cli.log(
            `λ DLQ not found: ${configDLQ[functionName]}.`,
          )
          return
        }
        let DeadLetterQueueArn = funcDLQ.events
          .map((e) => e.sqs)
          .filter((f) => f)[0]

        if (
          typeof DeadLetterQueueArn !== 'string' &&
          DeadLetterQueueArn.arn !== undefined
        ) {
          DeadLetterQueueArn = extractQueueNameFromARN(QueueArn, this.service)
        }

        if (!DeadLetterQueueArn) {
          this.serverless.cli.log(
            `λ without SQS event source: ${configDLQ[functionName].onError}.`,
          )
          return
        }

        this.serverless.cli.log(
          `Creating DLQ of SQS event source, λ: ${functionName}.`,
        )

        let attempts = 0
        let QueueUrl
        while (!QueueUrl && attempts < GET_QUEUES_MAX_RETRIES) {
          attempts += 1
          try {
            // eslint-disable-next-line no-await-in-loop
            ;({ QueueUrl } = await client
              .getQueueUrl({
                QueueName: DeadLetterQueueArn,
              })
              .promise())
          } catch (e) {
            if (attempts === GET_QUEUES_MAX_RETRIES) {
              throw e
            }
          }
          // eslint-disable-next-line no-await-in-loop
          await sleep(1000)
        }
        try {
          await client
            .setQueueAttributes({
              QueueUrl,
              Attributes: {
                RedrivePolicy: JSON.stringify({
                  deadLetterTargetArn: DeadLetterQueueArn,
                  maxReceiveCount: configDLQ[functionName].maxReceiveCount || 3,
                }),
              },
            })
            .promise()
        } catch (e) {
          this.serverless.cli.log(e.message)
        }
      })
    }
  }

  offlineStartEnd() {
    this.serverless.cli.log('offline-start-end')
  }
}

module.exports = ServerlessOfflineSQSDLQ
