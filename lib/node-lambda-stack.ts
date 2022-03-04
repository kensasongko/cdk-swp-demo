import * as path from 'path';

import { Construct } from "constructs";
import { Stack, StackProps, DockerImage } from 'aws-cdk-lib';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class NodeLambdaStack extends Stack {
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.handler = new lambda.Function(this, "NodeHandler", {
      runtime: lambda.Runtime.NODEJS_14_X, 
      code: lambda.Code.fromAsset("sources/node"),
      handler: "app.main",
      functionName: 'NodeHandler',
    });
  }
}

