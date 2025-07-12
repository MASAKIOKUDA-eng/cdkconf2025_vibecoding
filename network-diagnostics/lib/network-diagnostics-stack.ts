import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export class NetworkDiagnosticsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for storing network diagrams and analysis results
    const resultsBucket = new s3.Bucket(this, 'ResultsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // S3 bucket for hosting the web application
    const webAppBucket = new s3.Bucket(this, 'WebAppBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      })
    });

    // CloudFront distribution for the web app
    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(webAppBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    // DynamoDB table for storing network configurations and analysis results
    const networkTable = new dynamodb.Table(this, 'NetworkTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function for analyzing network configurations using Bedrock
    const analyzeNetworkFunction = new lambda.Function(this, 'AnalyzeNetworkFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/analyze-network'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        NETWORK_TABLE: networkTable.tableName,
        RESULTS_BUCKET: resultsBucket.bucketName,
      },
    });

    // Grant the Lambda function permissions to use Bedrock
    analyzeNetworkFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: ['*'], // In production, restrict to specific model ARNs
      })
    );

    // Grant the Lambda function permissions to access DynamoDB and S3
    networkTable.grantReadWriteData(analyzeNetworkFunction);
    resultsBucket.grantReadWrite(analyzeNetworkFunction);

    // API Gateway for the backend
    const api = new apigateway.RestApi(this, 'NetworkDiagnosticApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // API endpoint for network analysis
    const analyzeResource = api.root.addResource('analyze');
    analyzeResource.addMethod('POST', new apigateway.LambdaIntegration(analyzeNetworkFunction));

    // Output the API URL and CloudFront URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL of the API Gateway endpoint',
    });

    new cdk.CfnOutput(this, 'WebAppUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'URL of the web application',
    });
    
    // Deploy frontend to S3
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./frontend')],
      destinationBucket: webAppBucket,
      distribution,
      distributionPaths: ['/*'],
    });
  }
}
