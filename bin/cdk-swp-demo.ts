#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { DomainStack } from '../lib/domain-stack';
import { S3GithubRunnerStack } from '../lib/s3-github-runner-stack';
import { DockerGithubRunnerStack } from '../lib/docker-github-runner-stack';
import { GithubOidcProviderStack } from '../lib/github-oidc-provider-stack';
import { StaticSiteStack } from '../lib/static-site-stack';
import { ApiEcrStack } from '../lib/api-ecr-stack';
import { ApiEcsStack } from '../lib/api-ecs-stack';
import { StaticSiteDeployRoleStack } from "../lib/static-site-deploy-role-stack"
import { ApiEcsDeployRoleStack } from "../lib/api-ecs-deploy-role-stack"

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const app = new cdk.App();
const domainStack = new DomainStack(app, 'DomainStack', {env: env});
const vpcStack = new VpcStack(app, 'VpcStack', {env: env});

// For demo purposes only.
// Deploy self-hosted Github runner.
const s3GithubRunnerStack = new S3GithubRunnerStack(app, 'S3GithubRunnerStack', {
  vpc: vpcStack.vpc,
  env: env
});
s3GithubRunnerStack.addDependency(vpcStack);
const dockerGithubRunnerStack = new DockerGithubRunnerStack(app, 'DockerGithubRunnerStack', {
  vpc: vpcStack.vpc,
  env: env
});
dockerGithubRunnerStack.addDependency(vpcStack);
// END Deploy self-hosted Github runner.

const staticSiteStack = new StaticSiteStack(app, 'StaticSiteStack', {env: env});


const apiEcrStack = new ApiEcrStack(app, 'ApiEcrStack', {env: env});
const apiEcsStack = new ApiEcsStack(app, 'ApiEcsStack', {
  imageAsset: apiEcrStack.imageAsset,
  vpc: vpcStack.vpc,
  env: env
});
apiEcsStack.addDependency(vpcStack);
apiEcsStack.addDependency(apiEcrStack);

// Github Action

// Github OIDC Provider
const githubOidcProviderStack = new GithubOidcProviderStack(app, 'GithubOidcProviderStack', {env: env});

// Role for StaticSite deployment from Github Runner
const staticSiteDeployRoleStack = new StaticSiteDeployRoleStack(app, 'StaticSiteDeployRoleStack', {
  provider: githubOidcProviderStack.provider,
  env: env
});
staticSiteDeployRoleStack.addDependency(githubOidcProviderStack);

const apiEcsDeployRoleStack  = new ApiEcsDeployRoleStack(app, 'ApiEcsDeployRoleStack', {
  provider: githubOidcProviderStack.provider,
  imageAsset: apiEcrStack.imageAsset,
  service: apiEcsStack.service,
  env: env
});
