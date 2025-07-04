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
import * as iam from 'aws-cdk-lib/aws-iam'
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
    /* 3.  Lambdas
    /* -------------------------------------------------------- */

    const fetchObjectFn = new lambda.NodejsFunction(this, 'FetchObjectFn', {
      entry: 'src/fetch-object.ts',
      memorySize: 1024,
      timeout: Duration.minutes(1)
    })

    bucket.grantRead(fetchObjectFn)

    const region = cdk.Stack.of(this).region
    const modelId =
      bedrock.FoundationModelIdentifier.ANTHROPIC_CLAUDE_3_SONNET_20240229_V1_0
        .modelId
    const modelArn = `arn:aws:bedrock:${region}::foundation-model/${modelId}`

    const analyzeFileFn = new lambda.NodejsFunction(this, 'AnalyzeFileFn', {
      entry: 'src/analyze-text.ts',
      memorySize: 2048,
      timeout: Duration.minutes(15),
      environment: { MODEL_ID: modelId },
      bundling: { nodeModules: ['@aws-sdk/client-bedrock-runtime'] } // v3 SDK
    })

    // least-privilege permission
    analyzeFileFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [modelArn]
      })
    )

    const postProcessFn = new lambda.NodejsFunction(this, 'PostProcessFn', {
      entry: 'src/post-process.ts',
      memorySize: 256,
      timeout: Duration.seconds(30)
    })

    // events
    const uploadReceivedEvt = new tasks.EventBridgePutEvents(
      this,
      'UploadReceived',
      {
        entries: [
          {
            eventBus,
            source: 'extraction-service',
            detailType: 'UploadReceived',
            detail: sfn.TaskInput.fromObject({
              s3Key: sfn.JsonPath.stringAt('$.s3Key'),
              userSub: sfn.JsonPath.stringAt('$.userSub')
            })
          }
        ]
      }
    )

    const analysisStartedEvt = new tasks.EventBridgePutEvents(
      this,
      'AnalysisStarted',
      {
        entries: [
          {
            eventBus,
            source: 'extraction-service',
            detailType: 'AnalysisStarted',
            detail: sfn.TaskInput.fromObject({
              s3Key: sfn.JsonPath.stringAt('$.s3Key'),
              userSub: sfn.JsonPath.stringAt('$.userSub')
            })
          }
        ]
      }
    )

    const analysisCompletedEvt = new tasks.EventBridgePutEvents(
      this,
      'AnalysisCompleted',
      {
        entries: [
          {
            eventBus,
            source: 'extraction-service',
            detailType: 'AnalysisCompleted',
            detail: sfn.TaskInput.fromObject({
              s3Key: sfn.JsonPath.stringAt('$.s3Key'),
              userSub: sfn.JsonPath.stringAt('$.userSub')
            })
          }
        ]
      }
    )

    const notifyTask = new tasks.EventBridgePutEvents(this, 'EmitReadyEvent', {
      entries: [
        {
          eventBus,
          detailType: 'AnalysisReady',
          source: 'extraction-service',
          // pass S3 key and Bedrock JSON as the event body
          detail: sfn.TaskInput.fromObject({
            s3Key: sfn.JsonPath.stringAt('$.s3Key'),
            userSub: sfn.JsonPath.stringAt('$.userSub'),
            result: sfn.JsonPath.stringAt('$.analysis')
          })
        }
      ]
    })

    /* -------------------------------------------------------- */
    /* 4.  Step Functions state machine         */
    /* -------------------------------------------------------- */

    const fetchTask = new tasks.LambdaInvoke(this, 'FetchFile', {
      lambdaFunction: fetchObjectFn,
      payloadResponseOnly: true
    })

    const analyzeTask = new tasks.LambdaInvoke(this, 'AnalyzeFile', {
      lambdaFunction: analyzeFileFn,
      payloadResponseOnly: true,
      resultPath: '$.analysis'
    })

    const dropBytes = new sfn.Pass(this, 'DropBytes', {
      result: sfn.Result.fromString(''),
      resultPath: '$.bytes'
    })

    const postProcessTask = new tasks.LambdaInvoke(this, 'PostProcess', {
      lambdaFunction: postProcessFn,
      payloadResponseOnly: true, // returns the cleaned string
      resultPath: '$.analysis' // overwrite the analysis field
    })

    const saveTask = new tasks.DynamoPutItem(this, 'SaveResult', {
      table,
      item: {
        pk: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt('$.s3Key')
        ),
        result: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt('$.analysis')
        )
      },
      resultPath: '$.dynamoPutResult'
    })

    const definition = fetchTask
      .next(uploadReceivedEvt)
      .next(analysisStartedEvt)
      .next(analyzeTask)
      .next(analysisCompletedEvt)
      .next(dropBytes)
      .next(postProcessTask)
      .next(saveTask)
      .next(notifyTask)

    const stateMachine = new sfn.StateMachine(this, 'FileAnalysisSM', {
      definition,
      timeout: Duration.minutes(30)
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
  }
}
