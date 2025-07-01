#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { ExtractionServiceStack } from '../lib/extraction-service-stack'

const app = new cdk.App()

const appName = 'word-collect'
const environment = app.node.tryGetContext('environment') || 'dev'

new ExtractionServiceStack(app, 'ExtractionServiceStack', {
  appName,
  environment
})
