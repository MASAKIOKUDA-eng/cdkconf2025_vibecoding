#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { NetworkDiagnosticsStack } from '../lib/network-diagnostics-stack';

const app = new cdk.App();
new NetworkDiagnosticsStack(app, 'NetworkDiagnosticsStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1' 
  },
  description: 'ネットワーク診断君 - ネットワーク構成を分析し、改善点を提案するアプリケーション'
});