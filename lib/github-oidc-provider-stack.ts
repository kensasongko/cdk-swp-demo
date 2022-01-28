import {readFileSync} from 'fs';

import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam'

export class GithubOidcProviderStack extends Stack {
  public readonly provider: iam.OpenIdConnectProvider;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.provider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: [ 'sts.amazonaws.com' ],
    });
  }
}
