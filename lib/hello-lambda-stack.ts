import * as path from 'path';

import { Construct } from "constructs";
import { Stack, StackProps, DockerImage } from 'aws-cdk-lib';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "@aws-cdk/aws-lambda-go-alpha";
//import * as lambda from "aws-cdk-lib/aws-lambda";

export class HelloLambdaStack extends Stack {
  public readonly handler: lambda.GoFunction;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const lambdaPath = path.join(__dirname, '../sources/hello/src');
    this.handler = new lambda.GoFunction(this, 'HelloHandler', {
      //runtime: lambda.Runtime.GO_1_X,
      entry: lambdaPath,
      functionName: 'HelloHandler',
    });
  }
}

