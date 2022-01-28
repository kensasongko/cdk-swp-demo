import {readFileSync} from 'fs';

import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from 'aws-cdk-lib/aws-iam'

import { AmiMap } from "../lib/ami-map"


interface S3GithubRunnerStackProps extends StackProps {
  vpc: ec2.Vpc;
}

export class S3GithubRunnerStack extends Stack {
  constructor(scope: Construct, id: string, props: S3GithubRunnerStackProps) {
    super(scope, id, props);

    const { vpc } = props;
    const keypairName = this.node.tryGetContext('keypairName');

    const securityGroup = new ec2.SecurityGroup(this, 'S3GithubRunnerInstanceSG', {
      vpc: vpc,
      description: 'Allow SSH, HTTP, and HTTPS',
      allowAllOutbound: true
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access')
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP')
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS')

    const role = new iam.Role(this, 'S3GithubRunnerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    })
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))

    const setupGithubRunnerUDS = readFileSync('./lib/userdata/setup_github_runner.sh', 'utf8');
    const installAwsCliUDS = readFileSync('./lib/userdata/install_aws_cli.sh', 'utf8');

    const userData = ec2.UserData.forLinux();
    userData.addCommands(setupGithubRunnerUDS);
    userData.addCommands(installAwsCliUDS);
    
    const instance = new ec2.Instance(this, 'S3GithubRunnerInstance', {
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3_AMD, ec2.InstanceSize.MICRO),
      machineImage: AmiMap.UBUNTU_2004,
      securityGroup: securityGroup,
      keyName: keypairName,
      role: role,
      userData: userData,
    });
  }
}
