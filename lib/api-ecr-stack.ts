import * as path from 'path';

import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';

export class ApiEcrStack extends Stack {
  public readonly imageAsset: DockerImageAsset;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const { env } = props;

    const imagePath = path.join(__dirname, '../../demo_ecs');
    this.imageAsset = new DockerImageAsset(this, 'InitialDockerImage', {
      directory: imagePath,
    });
  }
}
