import * as ec2 from "aws-cdk-lib/aws-ec2";

const AmiMap = {
  "UBUNTU_2004": ec2.MachineImage.genericLinux({
    "ap-southeast-1": "ami-055d15d9cfddf7bd3",
  })
}

export { AmiMap }
