import {readFileSync} from 'fs';

import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'

interface StaticSiteDeployRoleStackProps extends StackProps {
  provider: iam.OpenIdConnectProvider;
}

export class StaticSiteDeployRoleStack extends Stack {
  constructor(scope: Construct, id: string, props: StaticSiteDeployRoleStackProps) {
    super(scope, id, props);

    const { provider } = props;
    const subCondition = this.node.tryGetContext('staticSiteSubCondition');

    const hostedZone = this.node.tryGetContext('hostedZone');
    const siteSubdomain = this.node.tryGetContext('siteSubdomain');
    const siteDomain = siteSubdomain + '.' + hostedZone

    const principal = new iam.OpenIdConnectPrincipal(provider);
    const principalWithConditions = new iam.PrincipalWithConditions(principal, {
      "StringEquals": {
        "token.actions.githubusercontent.com:sub": subCondition
      },
    });

    const s3PolicyDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: [
            "s3:PutBucketWebsite",
            "s3:PutObject",
            "s3:PutObjectAcl",
            "s3:GetObject",
            "s3:ListBucket",
            "s3:DeleteObject",
          ],
          resources: [
            "arn:aws:s3:::" + siteDomain,
            "arn:aws:s3:::" + siteDomain + "/*"
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "s3:GetBucketLocation",
          ],
          resources: [
            "arn:aws:s3:::" + siteDomain
          ],
        }),
      ],
    });

    const cloudfrontPolicyDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: [
            "cloudfront:CreateInvalidation"
          ],
          resources: [
            "*"
          ],
        }),
      ],
    });

    const role = new iam.Role(
      this,
      "s3_deploy_role", {
        assumedBy: principalWithConditions,
        inlinePolicies: {
          "S3AccessForGithubRunner": s3PolicyDocument,
          "CloudFrontAccessForGithubRunner": cloudfrontPolicyDocument,
        }
      }
    )
  }
}
