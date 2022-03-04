import * as path from 'path';

import { Construct } from "constructs";
import { Stack, StackProps, DockerImage, Duration } from 'aws-cdk-lib';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambdago from "@aws-cdk/aws-lambda-go-alpha";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from 'aws-cdk-lib/aws-rds';

interface UsersLambdaStackProps extends StackProps {
  vpc: ec2.Vpc;
  rdsAccessSg: ec2.SecurityGroup;
  rdsUserSecret: rds.DatabaseSecret;
}

export class UsersLambdaStack extends Stack {
  public readonly handler: lambdago.GoFunction;

  constructor(scope: Construct, id: string, props: UsersLambdaStackProps) {
    super(scope, id, props);

    const { env, vpc, rdsAccessSg, rdsUserSecret } = props;

    const lambdaRole = new iam.Role(this, 'lambdaWithRdsAccess', {
        roleName: 'lambdaWithRdsAccess',
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
            iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
        ]
    })

    const lambdaPath = path.join(__dirname, '../sources/users/src');
    this.handler = new lambdago.GoFunction(this, 'UsersHandler', {
      //runtime: lambdago.Runtime.GO_1_X,
      entry: lambdaPath,
      functionName: 'UsersHandler',
      role: lambdaRole,
      // Enable X-Ray tracing.
      tracing: lambda.Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      // If Lambda must be attached to VPC to access RDS
      // The other alternative is to use RDS Data API
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
      },
      securityGroups: [
        // Security group to access RDS, defined in RdsStack.
        rdsAccessSg
      ],
      environment: {
        "RDS_SECRET_ARN": rdsUserSecret.secretArn
      }
    });

    rdsUserSecret.grantRead(this.handler);
  }
}

