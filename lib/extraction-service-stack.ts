import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as events from 'aws-cdk-lib/aws-events'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs'
import { Duration } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as bedrock from 'aws-cdk-lib/aws-bedrock'
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import * as sfn from 'aws-cdk-lib/aws-stepfunctions'
import * as targets from 'aws-cdk-lib/aws-events-targets'
// import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
// import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import { SYSTEM_PROMPT, USER_PROMPT } from '../src/prompts'
// import * as logs from 'aws-cdk-lib/aws-logs'

export interface ExtractionServiceStackProps extends cdk.StackProps {
  appName: string
  environment: string
}

export class ExtractionServiceStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: ExtractionServiceStackProps
  ) {
    super(scope, id, props)
    const { appName, environment } = props

    /* -------------------------------------------------------- */
    /* 1.  Import shared resources (bus ARN, bucket name)       */
    /* -------------------------------------------------------- */

    const eventBus = events.EventBus.fromEventBusName(
      this,
      'SharedEventBus',
      cdk.Fn.importValue(`${appName}-${environment}-event-bus-name`)
    )

    const bucketARN = ssm.StringParameter.valueForStringParameter(
      this,
      `/${appName}/${environment}/upload-service/bucket-arn`
    )

    const bucket = s3.Bucket.fromBucketArn(this, 'UploadBucket', bucketARN)

    /* -------------------------------------------------------- */
    /* 2.  DynamoDB to store results                            */
    /* -------------------------------------------------------- */

    const table = new dynamodb.Table(this, 'Analysis', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    })

    /* -------------------------------------------------------- */
    /* 3.  Lambda: fetch the uploaded file                      */
    /* -------------------------------------------------------- */

    const fetchObjectFn = new lambda.NodejsFunction(this, 'FetchObjectFn', {
      entry: 'src/fetch-object.ts',
      memorySize: 1024,
      timeout: Duration.minutes(1)
    })

    bucket.grantRead(fetchObjectFn)

    /* -------------------------------------------------------- */
    /* 4.  Bedrock model & Step Functions state machine         */
    /* -------------------------------------------------------- */

    const model = bedrock.FoundationModel.fromFoundationModelId(
      this,
      'ClaudeSonnet',
      bedrock.FoundationModelIdentifier.ANTHROPIC_CLAUDE_3_SONNET_20240229_V1_0
    )

    const fetchTask = new tasks.LambdaInvoke(this, 'FetchFile', {
      lambdaFunction: fetchObjectFn,
      payloadResponseOnly: true
    })

    const modelArn =
      `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/` +
      bedrock.FoundationModelIdentifier.ANTHROPIC_CLAUDE_3_SONNET_20240229_V1_0

    const converseTask = new tasks.CallAwsService(this, 'AnalyzeFile', {
      service: 'BedrockRuntime',
      action: 'converse',
      parameters: {
        modelId:
          bedrock.FoundationModelIdentifier.ANTHROPIC_CLAUDE_3_SONNET_20240229_V1_0.toString(),

        // payload that Bedrock expects
        body: {
          anthropic_version: 'bedrock-2023-05-31',
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: USER_PROMPT },
                {
                  type: 'document',
                  document: {
                    format: sfn.JsonPath.stringAt('$.format'), // html|txt|md|pdf…
                    name: sfn.JsonPath.stringAt('$.name'),
                    source: { bytes: sfn.JsonPath.stringAt('$.bytes') }
                  }
                }
              ]
            }
          ],
          max_tokens: 4096,
          temperature: 0,
          top_p: 1,
          top_k: 1
        }
      },
      iamResources: [modelArn],
      resultPath: '$.analysis'
    })

    const dropText = new sfn.Pass(this, 'DropText', {
      result: sfn.Result.fromString(''),
      resultPath: '$.text'
    })

    const result = '$.analysis.Body.content[0].text'

    const saveTask = new tasks.DynamoPutItem(this, 'SaveResult', {
      table,
      item: {
        pk: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt('$.s3Key')
        ),
        result: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt(result)
        )
      },
      resultPath: '$.dynamoPutResult'
    })

    const notifyTask = new tasks.EventBridgePutEvents(this, 'EmitReadyEvent', {
      entries: [
        {
          eventBus,
          detailType: 'AnalysisReady',
          source: 'extraction-service',
          // pass S3 key and Bedrock JSON as the event body
          detail: sfn.TaskInput.fromObject({
            s3Key: sfn.JsonPath.stringAt('$.s3Key'),
            result: sfn.JsonPath.stringAt(result)
          })
        }
      ]
    })

    const definition = fetchTask
      .next(converseTask)
      .next(dropText)
      .next(saveTask)
      .next(notifyTask)

    const stateMachine = new sfn.StateMachine(this, 'FileAnalysisSM', {
      definition,
      timeout: Duration.minutes(10)
    })

    /* -------------------------------------------------------- */
    /* 5.  EventBridge rule – start state machine               */
    /* -------------------------------------------------------- */
    new events.Rule(this, 'StartAnalysisRule', {
      eventBus,
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [bucket.bucketName] },
          object: { key: [{ prefix: 'raw/' }] }
        }
      },
      targets: [new targets.SfnStateMachine(stateMachine)]
    })

    // /* -------------------------------------------------------- */
    // /* 6.  Lambda + HTTP API for polling results                */
    // /* -------------------------------------------------------- */
    // const getResultFn = new lambda.NodejsFunction(this, 'GetResultFn', {
    //   entry: 'src/get-result.ts',
    //   environment: { TABLE_NAME: table.tableName }
    // })

    // table.grantReadData(getResultFn)

    // const httpApi = new apigwv2.HttpApi(this, 'AiApi', {
    //   apiName: 'ai-service',
    //   description: 'Serves analysis results JSON'
    // })

    // httpApi.addRoutes({
    //   path: '/analysis/{key+}',
    //   methods: [events.HttpMethod.GET],
    //   integration: new integrations.HttpLambdaIntegration(
    //     'GetResultIntegration',
    //     getResultFn
    //   )
    // })

    // new ssm.StringParameter(this, 'AiApiEndpoint', {
    //   parameterName: `/${appName}/${environment}/extraction-service/apiEndpoint`,
    //   stringValue: httpApi.apiEndpoint
    // })
  }
}
