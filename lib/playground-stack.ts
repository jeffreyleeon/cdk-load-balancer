import * as cdk from 'aws-cdk-lib';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam'

import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { aws_elasticloadbalancingv2_targets as elasticloadbalancingv2_targets } from 'aws-cdk-lib';

import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

require('dotenv').config()

const config = {
  env: {
    account: process.env.AWS_ACCOUNT_NUMBER,
    region: process.env.AWS_REGION
  }
}

console.log(JSON.stringify(config))

export class PlaygroundStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, { ...props, env: config.env });

    // Get the default VPC. This is the network where your instance will be provisioned
    // All activated regions in AWS have a default vpc.
    // You can create your own of course as well. https://aws.amazon.com/vpc/
    const defaultVpc = ec2.Vpc.fromLookup(this, 'VPC', { isDefault: true })
    const publicSubnet0 = defaultVpc.publicSubnets[0];
    console.log('===========' + publicSubnet0.subnetId)

    // Lets create a role for the instance
    // You can attach permissions to a role and determine what your
    // instance can or can not do
    const role = new iam.Role(
      this,
      'simple-instance-1-role', // this is a unique id that will represent this resource in a Cloudformation template
      { assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com') }
    )

    // Lets create a security group for our instance
    // A security group acts as a virtual firewall for your instance to control inbound and outbound traffic.
    const securityGroup = new ec2.SecurityGroup(
      this,
      'simple-instance-1-sg',
      {
        vpc: defaultVpc,
        allowAllOutbound: true,
        securityGroupName: 'simple-instance-1-sg',
      }
    )

    // Lets use the security group to allow inbound traffic on specific ports
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access from Internet'
    )

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allows HTTP access from Internet'
    )

    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allows HTTPS access from Internet'
    )

    // Finally lets provision our ec2 instance
    const instance = new ec2.Instance(this, 'simple-instance-1', {
      vpc: defaultVpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      role: role,
      securityGroup: securityGroup,
      instanceName: 'simple-instance-1',
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
      }),
      keyName: 'key-pair-created-from-cli'
    })

    const lb = new elbv2.NetworkLoadBalancer(this, 'simple-instance-1-elb', {
      vpc: defaultVpc,
      loadBalancerName: 'simple-instance-1-elb-name',
      internetFacing: true
    });
    const listener = lb.addListener('simple-instance-1-listener', {
      port: 80,
      protocol: elbv2.Protocol.TCP
    });
    const instanceTarget = new elasticloadbalancingv2_targets.InstanceTarget(instance, /* all optional props */ 80);
    listener.addTargets('simple-instance-1-target', {
      port: 80,
      targetGroupName: 'simple-instance-1-target-name',
      targets: [
        instanceTarget
      ]
    });

    // cdk lets us output properties of the resources we create after they are created
    // we want the IP address of this new instance so we can ssh into it later
    new cdk.CfnOutput(this, 'simple-instance-1-output', {
      value: instance.instancePublicIp
    })
    new cdk.CfnOutput(this, 'simple-instance-1-output-lb', {
      value: lb.loadBalancerDnsName
    })
  }
}
