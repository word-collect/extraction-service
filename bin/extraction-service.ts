#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { ExtractionServiceStack } from '../lib/extraction-service-stack'

const app = new cdk.App()

const appName = 'word-collect'
const environment = app.node.tryGetContext('environment') || 'dev'

const extractionStack = new ExtractionServiceStack(
  app,
  `${appName}-${environment}-extraction-stack`,
  {
    appName,
    environment,
    description: 'Extraction stack for extraction service',
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION
    }
  }
)

// Add tags to all stacks
const tags = {
  Environment: environment,
  Service: 'extraction-service',
  Application: appName
}

Object.entries(tags).forEach(([key, value]) => {
  cdk.Tags.of(extractionStack).add(key, value)
})
