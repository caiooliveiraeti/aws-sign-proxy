# AWS Sign Proxy

AWS Sign Proxy to access your [AWS SERVICES](https://aws.amazon.com). 

## Usage

Install the npm module 

    npm install -g aws-sign-proxy
    
[![NPM Stats](https://nodei.co/npm/aws-sign-proxy.png?downloads=true)](https://npmjs.org/package/aws-sign-proxy)

Set AWS credentials
                          
    export AWS_ACCESS_KEY_ID=XXXXXXXXXXXXXXXXXXX
    export AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXX

Run the proxy

    aws-sign-proxy <service-endpoint>

Alternativly, you can set the _AWS_PROFILE_ environment variable

    AWS_PROFILE=myprofile aws-sign-proxy <service-endpoint>