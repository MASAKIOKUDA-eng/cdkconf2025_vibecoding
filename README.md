# Network Diagnostics Tool

This project provides a network configuration analysis tool that uses Amazon Bedrock to analyze network configurations and suggest improvements.

## Architecture

```
+----------------+     +-------------+     +----------------+
|                |     |             |     |                |
|   CloudFront   +---->+  S3 Bucket  |     |  API Gateway   |
|  Distribution  |     |  (WebApp)   |     |                |
|                |     |             |     +-------+--------+
+----------------+     +-------------+             |
                                                   v
                                          +--------+---------+
                                          |                  |
                                          | Lambda Function  |
                                          | (Bedrock Client) |
                                          |                  |
                                          +--------+---------+
                                                   |
                       +-------------+             |
                       |             |<------------+
                       | DynamoDB    |             |
                       |             |             |
                       +-------------+             v
                                              +----+----+
                                              |         |
                                              | S3      |
                                              | Results |
                                              |         |
                                              +---------+
```

## Features

- Input network configuration in JSON format
- Analyze network configurations using Amazon Bedrock
- Identify security issues
- Suggest cost optimizations
- Recommend performance improvements
- Provide best practices

## Getting Started

See the Japanese README for detailed instructions: [README.ja.md](./network-diagnostics/README.ja.md)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
