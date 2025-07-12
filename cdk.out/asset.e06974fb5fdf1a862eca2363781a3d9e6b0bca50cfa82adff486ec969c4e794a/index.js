const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

// Initialize clients
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

// Bedrock model ID for Claude
const MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0';

exports.handler = async (event) => {
  try {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    // Parse the request body
    const body = JSON.parse(event.body);
    const { networkConfig } = body;
    
    if (!networkConfig) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Network configuration is required' })
      };
    }
    
    // Generate a unique ID for this analysis
    const analysisId = uuidv4();
    
    // Prepare the prompt for Bedrock
    const prompt = `
    You are a network architecture expert. Please analyze the following network configuration and provide:
    1. A detailed assessment of the network design
    2. Potential security issues or vulnerabilities
    3. Cost optimization recommendations
    4. Performance improvement suggestions
    5. A summary of best practices that should be applied
    
    Network Configuration:
    ${JSON.stringify(networkConfig, null, 2)}
    
    Format your response as JSON with the following structure:
    {
      "analysis": {
        "overview": "General assessment of the network",
        "securityIssues": ["List of security concerns"],
        "costOptimizations": ["List of cost optimization suggestions"],
        "performanceImprovements": ["List of performance improvement ideas"],
        "bestPractices": ["List of best practices to apply"]
      },
      "diagramSuggestions": {
        "components": ["List of components to include in diagram"],
        "connections": ["List of connections between components"],
        "highlights": ["Areas to highlight in the diagram"]
      }
    }
    `;
    
    // Call Bedrock to analyze the network
    const bedrockParams = {
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    };
    
    console.log('Calling Bedrock with params:', JSON.stringify(bedrockParams, null, 2));
    
    const bedrockCommand = new InvokeModelCommand(bedrockParams);
    const bedrockResponse = await bedrockClient.send(bedrockCommand);
    
    // Parse the Bedrock response
    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const analysisResult = JSON.parse(responseBody.content[0].text);
    
    // Store the analysis result in DynamoDB
    const dynamoParams = {
      TableName: process.env.NETWORK_TABLE,
      Item: {
        id: analysisId,
        networkConfig,
        analysisResult,
        createdAt: new Date().toISOString()
      }
    };
    
    await docClient.send(new PutCommand(dynamoParams));
    
    // Store the analysis result in S3 for future reference
    const s3Params = {
      Bucket: process.env.RESULTS_BUCKET,
      Key: `analysis/${analysisId}.json`,
      Body: JSON.stringify({
        networkConfig,
        analysisResult
      }, null, 2),
      ContentType: 'application/json'
    };
    
    await s3Client.send(new PutObjectCommand(s3Params));
    
    // Return the analysis result
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        analysisId,
        analysisResult
      })
    };
  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'An error occurred during analysis' })
    };
  }
};
