import { Construct } from 'constructs';
import { Aws, CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecspatterns from 'aws-cdk-lib/aws-ecs-patterns'
//import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
//import * as ecrdeploy from 'cdk-ecr-deployment';

interface ApiEcsStackProps extends StackProps {
  imageAsset: DockerImageAsset;
  vpc: ec2.Vpc;
}

export class ApiEcsStack extends Stack {
  public readonly service: ecspatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: ApiEcsStackProps) {
    super(scope, id, props);

    const { imageAsset, vpc, env } = props;

    const containerName = this.node.tryGetContext('apiContainerName');

    const hostedZone = this.node.tryGetContext('hostedZone');
    const apiSubdomain = this.node.tryGetContext('apiSubdomain');
    const apiDomain = apiSubdomain + '.' + hostedZone;

    /*
    new ecrdeploy.ECRDeployment(this, 'DeployDockerImage', {
      src: new ecrdeploy.DockerImageName(imageAsset.imageUri),
      //dest: new ecrdeploy.DockerImageName(`${env?.account}.dkr.ecr.us-west-2.amazonaws.com/test:nginx`),
      dest: new ecrdeploy.DockerImageName(repository.repositoryArn),
    });
    */

    const cluster = new ecs.Cluster(this, 'ApiCluster', {
      clusterName: 'api-cluster',
      //containerInsights: true,
      vpc: vpc,
    });

    const zone = route53.HostedZone.fromLookup(this, 'Zone', { domainName: hostedZone });

    const certificate = new acm.DnsValidatedCertificate(this, 'ApiCert', {
      domainName: apiDomain,
      hostedZone: zone,
      region: env?.region,
    });

    //const image = ecs.ContainerImage.fromEcrRepository(imageAsset.repository);
    const image = ecs.ContainerImage.fromDockerImageAsset(imageAsset);

    this.service = new ecspatterns.ApplicationLoadBalancedFargateService(this, 'ApiEcsService', {
      cluster,
      circuitBreaker: {
        rollback: true,
      },
      domainName: apiDomain,
      domainZone: zone,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      listenerPort: 443,
      redirectHTTP: true,
      taskImageOptions: {
        image: image,
        containerName: containerName,
        containerPort: 8000,
        environment: {
          ROCKET_ENV: "prod",
        },
      },
    });

    const scalableTarget = this.service.service.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 3,
    });

    scalableTarget.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 90,
    });

    scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 90,
    });


    new CfnOutput(this, 'TaskDefinitionArn', { value: this.service.taskDefinition.taskDefinitionArn });
    new CfnOutput(this, 'ExecutionRole', { value: this.service.taskDefinition.executionRole!.roleArn});
    new CfnOutput(this, 'TaskRole', { value: this.service.taskDefinition.taskRole!.roleArn});
    new CfnOutput(this, 'ServiceName', { value: this.service.service.serviceName});
    new CfnOutput(this, 'ServiceArn', { value: this.service.service.serviceArn});
    new CfnOutput(this, 'ClusterName', { value: this.service.cluster.clusterName});
    new CfnOutput(this, 'ClusterArn', { value: this.service.cluster.clusterArn});
    new CfnOutput(this, 'ContainerName', { value: containerName });
  }
}
