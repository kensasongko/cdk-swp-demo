import {readFileSync} from 'fs';

import { Construct } from 'constructs';
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ecspatterns from 'aws-cdk-lib/aws-ecs-patterns'
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';

interface ApiEcsDeployRoleStackProps extends StackProps {
  provider: iam.OpenIdConnectProvider;
  imageAsset: DockerImageAsset
  service: ecspatterns.ApplicationLoadBalancedFargateService;
}

export class ApiEcsDeployRoleStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiEcsDeployRoleStackProps) {
    super(scope, id, props);

    const { provider, imageAsset, service } = props;
    const subCondition = this.node.tryGetContext('apiEcrSubCondition');

    const principal = new iam.OpenIdConnectPrincipal(provider);
    const principalWithConditions = new iam.PrincipalWithConditions(principal, {
      "StringEquals": {
        "token.actions.githubusercontent.com:sub": subCondition
      },
    });

    const apiEcrPolicyDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: [
            "ecr:GetAuthorizationToken",
          ],
          resources: [
            "*"
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
            "ecr:BatchCheckLayerAvailability",
            "ecr:PutImage",
            "ecr:InitiateLayerUpload",
            "ecr:UploadLayerPart",
            "ecr:CompleteLayerUpload",
          ],
          resources: [
            imageAsset.repository.repositoryArn
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "ecs:DescribeTaskDefinition"
          ],
          resources: [
            "*"
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "ecs:RegisterTaskDefinition"
          ],
          resources: [
            "*"
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "ecs:UpdateService",
            "ecs:DescribeServices"
          ],
          resources: [
            service.service.serviceArn,
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "iam:PassRole"
          ],
          resources: [
            service.taskDefinition.executionRole!.roleArn,
            service.taskDefinition.taskRole!.roleArn,
          ],
        }),
      ],
    });

    const role = new iam.Role(
      this,
      "api_ecr_deploy_role", {
        assumedBy: principalWithConditions,
        inlinePolicies: {
          "APiEcrAccessForGithubRunner": apiEcrPolicyDocument,
        }
      }
    )
    new CfnOutput(this, 'RoleArn', { value: role.roleArn });
  }
}
