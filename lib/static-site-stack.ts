import {readFileSync} from 'fs';

import { Construct } from 'constructs';
import { Aws, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class StaticSiteStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const { env } = props;

    const hostedZone = this.node.tryGetContext('hostedZone');
    const siteSubdomain = this.node.tryGetContext('siteSubdomain');
    const siteDomain = siteSubdomain + '.' + hostedZone;

    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: hostedZone });

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'cloudfrontOAI', {
      comment: `OAI for ${siteDomain}`
    });

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: siteDomain,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
      autoDeleteObjects: true, // NOT recommended for production code
    });

    siteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [siteBucket.arnForObjects('*')],
      principals: [new iam.CanonicalUserPrincipal(cloudfrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
    }));

    const certificate = new acm.DnsValidatedCertificate(this, 'StaticSiteCertificate', {
      domainName: siteDomain,
      hostedZone: zone,
      region: 'us-east-1',
    });

    const viewerCertificate = cloudfront.ViewerCertificate.fromAcmCertificate(
      certificate,
      {
        sslMethod: cloudfront.SSLMethod.SNI,
        securityPolicy: cloudfront.SecurityPolicyProtocol.TLS_V1,
        aliases: [siteDomain]
      }
    );

    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'StaticSiteDistribution', {
      viewerCertificate,
      originConfigs: [{
        s3OriginSource: {
          s3BucketSource: siteBucket,
          originAccessIdentity: cloudfrontOAI
        },
        behaviors: [{
          isDefaultBehavior: true,
          compress: true,
          allowedMethods: cloudfront.CloudFrontAllowedMethods.ALL,
          cachedMethods: cloudfront.CloudFrontAllowedCachedMethods.GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        }],
      }]
    });

    new route53.ARecord(this, 'StaticSiteAliasRecord', {
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone
    });

  }
}
