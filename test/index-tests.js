'use strict';

const chai = require('chai');
const chaiSubset = require('chai-subset');
const sinon = require('sinon');

const CustomRoles = require('../index');

chai.use(chaiSubset);
const expect = chai.expect;

function createTestInstance(options) {
  options = options || {}; // eslint-disable-line no-param-reassign

  const functions = options.functions || {};
  return new CustomRoles({
    version: options.version || '1.12.0',
    service: {
      provider: options.provider || {},
      functions,
      resources: options.resources ? { Resources: options.resources } : undefined,
      getAllFunctions: () => Object.keys(functions),
      getFunction: functionName => functions[functionName]
    },
    cli: {
      log: sinon.stub()
    },
    getProvider: () => {
      return {
        naming: {
          getLambdaLogicalId(functionName) {
            return `${functionName.charAt(0).toUpperCase()}${functionName.slice(1)}LambdaFunction`;
          },
          getStackName() {
            return options.stackName || 'foo-dev';
          }
        }
      };
    }
  }, {
    stage: options.stage || 'dev'
  });
}

describe('serverless-plugin-custom-roles', function() {
  describe('#constructor', function() {
    it('should throw on older version', function() {
      expect(() => createTestInstance({ version: '1.11.0' }))
        .to.throw('serverless-plugin-custom-roles requires serverless 1.12 or higher!');
    });

    it('should create hooks', function() {
      const instance = createTestInstance();
      expect(instance)
        .to.have.property('hooks')
        .that.has.all.keys('before:package:setupProviderConfiguration');

      const stub = sinon.stub(instance, 'createRoles');
      instance.hooks['before:package:setupProviderConfiguration']();

      sinon.assert.calledOnce(stub);
    });
  });

  describe('#getStreamsPolicy', function() {
    beforeEach(function() {
      this.functionName = 'testFunction';
      this.instance = createTestInstance();
    });

    it('should do nothing if function does not have events defined', function() {
      const functionObj = {};

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result).to.be.null;
      sinon.assert.notCalled(this.instance.serverless.cli.log);
    });

    it('should do nothing if function does not have stream events defined', function() {
      const functionObj = {
        events: [{
          schedule: {}
        }]
      };

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result).to.be.null;
      sinon.assert.notCalled(this.instance.serverless.cli.log);
    });

    it('should support string (ARN) as a stream configuration', function() {
      const streamArn = 'arn:aws:dynamodb:us-east-1:123456789012:stream/*';
      const functionObj = {
        events: [{
          stream: streamArn
        }]
      };

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result)
        .to.containSubset({
          PolicyName: 'streams',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: [
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:DescribeStream',
                'dynamodb:ListStreams'
              ],
              Resource: [streamArn]
            }]
          }
        });
      sinon.assert.notCalled(this.instance.serverless.cli.log);
    });

    it('should support object as a stream configuration', function() {
      const streamArn = 'arn:aws:dynamodb:us-east-1:123456789012:stream/*';
      const functionObj = {
        events: [{
          stream: {
            type: 'dynamodb',
            arn: streamArn
          }
        }]
      };

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result)
        .to.containSubset({
          PolicyName: 'streams',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: [
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:DescribeStream',
                'dynamodb:ListStreams'
              ],
              Resource: [streamArn]
            }]
          }
        });
      sinon.assert.notCalled(this.instance.serverless.cli.log);
    });

    it('should log warning and exit if stream configuration cannot be parsed', function() {
      const functionObj = {
        events: [{
          stream: {}
        }]
      };

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result).to.be.null;
      sinon.assert.calledWithExactly(
        this.instance.serverless.cli.log,
        `[serverless-plugin-custom-roles]: WARNING: Stream event source for function '${this.functionName}' is not configured properly. IAM permissions will not be set properly.`
      );
    });

    it('should be able to get stream type from stream configuration object', function() {
      const streamArn = 'arn:aws:dynamodb:us-east-1:123456789012:stream/*';
      const functionObj = {
        events: [{
          stream: {
            type: 'dynamodb',
            arn: streamArn
          }
        }]
      };

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result)
        .to.containSubset({
          PolicyName: 'streams',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: [
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:DescribeStream',
                'dynamodb:ListStreams'
              ],
              Resource: [streamArn]
            }]
          }
        });
      sinon.assert.notCalled(this.instance.serverless.cli.log);
    });

    it('should be able to get stream type from ARN', function() {
      const streamArn = 'arn:aws:dynamodb:us-east-1:123456789012:stream/*';
      const functionObj = {
        events: [{
          stream: {
            arn: streamArn
          }
        }]
      };

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result)
        .to.containSubset({
          PolicyName: 'streams',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: [
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:DescribeStream',
                'dynamodb:ListStreams'
              ],
              Resource: [streamArn]
            }]
          }
        });
      sinon.assert.notCalled(this.instance.serverless.cli.log);
    });

    it('should support dynamodb streams', function() {
      const streamArn = 'test-stream-arn';
      const functionObj = {
        events: [{
          stream: {
            type: 'dynamodb',
            arn: streamArn
          }
        }]
      };

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result)
        .to.containSubset({
          PolicyName: 'streams',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: [
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:DescribeStream',
                'dynamodb:ListStreams'
              ],
              Resource: [streamArn]
            }]
          }
        });
      sinon.assert.notCalled(this.instance.serverless.cli.log);
    });

    it('should support kinesis streams', function() {
      const streamArn = 'test-stream-arn';
      const functionObj = {
        events: [{
          stream: {
            type: 'kinesis',
            arn: streamArn
          }
        }]
      };

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result)
        .to.containSubset({
          PolicyName: 'streams',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Action: [
                'kinesis:GetRecords',
                'kinesis:GetShardIterator',
                'kinesis:DescribeStream',
                'kinesis:ListStreams'
              ],
              Resource: [streamArn]
            }]
          }
        });
      sinon.assert.notCalled(this.instance.serverless.cli.log);
    });

    it('should log warning and exit if stream type is unknown', function() {
      const streamArn = 'test-stream-arn';
      const functionObj = {
        events: [{
          stream: {
            type: 'best-stream',
            arn: streamArn
          }
        }]
      };

      const result = this.instance.getStreamsPolicy(this.functionName, functionObj);

      expect(result).to.be.null;
      sinon.assert.calledWithExactly(
        this.instance.serverless.cli.log,
        `[serverless-plugin-custom-roles]: WARNING: Stream event type for function '${this.functionName}' is not configured properly. IAM permissions will not be set properly.`
      );
    });
  });

  describe('#createRoles', function() {
    it('should not do anything when there is no functions defined', function() {
      const instance = createTestInstance({ functions: {} });

      instance.createRoles();

      expect(instance)
        .to.have.nested.property('serverless.service.resources')
        .that.is.undefined;

      sinon.assert.calledWithExactly(
        instance.serverless.cli.log,
        '[serverless-plugin-custom-roles]: No functions to add roles to'
      );
    });

    it('should add AssumeRolePolicyDocument, logging policy and add role property to all functions', function() {
      const instance = createTestInstance({
        functions: {
          function1: {}
        }
      });

      instance.createRoles();

      expect(instance)
        .to.have.nested.property('serverless.service.functions.function1.role')
        .that.is.equal('Function1LambdaFunctionRole');

      expect(instance)
        .to.have.nested.property('serverless.service.resources')
        .that.is.deep.equal({
          Resources: {
            Function1LambdaFunctionRole: {
              Type: 'AWS::IAM::Role',
              Properties: {
                AssumeRolePolicyDocument: {
                  Version: '2012-10-17',
                  Statement: [{
                    Effect: 'Allow',
                    Principal: {
                      Service: ['lambda.amazonaws.com']
                    },
                    Action: 'sts:AssumeRole'
                  }]
                },
                Policies: [{
                  PolicyName: 'logging',
                  PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [
                      {
                        Effect: 'Allow',
                        Action: ['logs:CreateLogStream'],
                        Resource: [{
                          'Fn::Join': [
                            ':',
                            [
                              'arn:aws:logs',
                              { Ref: 'AWS::Region' },
                              { Ref: 'AWS::AccountId' },
                              'log-group:/aws/lambda/foo-dev-function1:*'
                            ]
                          ]
                        }]
                      },
                      {
                        Effect: 'Allow',
                        Action: ['logs:PutLogEvents'],
                        Resource: [{
                          'Fn::Join': [
                            ':',
                            [
                              'arn:aws:logs',
                              { Ref: 'AWS::Region' },
                              { Ref: 'AWS::AccountId' },
                              'log-group:/aws/lambda/foo-dev-function1:*:*'
                            ]
                          ]
                        }]
                      }
                    ]
                  }
                }]
              }
            }
          }
        });

      sinon.assert.notCalled(instance.serverless.cli.log);
    });

    it('should add custom policy when function has statements defined', function() {
      const iamRoleStatements = [{
        Effect: 'Allow',
        Action: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords'
        ],
        Resource: '*'
      }];
      const instance = createTestInstance({
        functions: {
          function1: {
            iamRoleStatements
          }
        }
      });

      instance.createRoles();

      expect(instance)
        .to.have.nested.property('serverless.service.resources')
        .that.containSubset({
          Resources: {
            Function1LambdaFunctionRole: {
              Type: 'AWS::IAM::Role',
              Properties: {
                Policies: [{
                  PolicyName: 'custom',
                  PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: iamRoleStatements
                  }
                }]
              }
            }
          }
        });

      sinon.assert.notCalled(instance.serverless.cli.log);
    });

    it('should add shared policy when provider has statements defined', function() {
      const iamRoleStatements = [{
        Effect: 'Allow',
        Action: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords'
        ],
        Resource: '*'
      }];
      const instance = createTestInstance({
        provider: {
          iamRoleStatements
        },
        functions: {
          function1: {}
        }
      });

      instance.createRoles();

      expect(instance)
        .to.have.nested.property('serverless.service.resources')
        .that.containSubset({
          Resources: {
            Function1LambdaFunctionRole: {
              Type: 'AWS::IAM::Role',
              Properties: {
                Policies: [{
                  PolicyName: 'shared',
                  PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: iamRoleStatements
                  }
                }]
              }
            }
          }
        });

      sinon.assert.notCalled(instance.serverless.cli.log);
    });

    it('should add streams policy when function has stream event sources defined', function() {
      const streamArn = 'test-stream-arn';
      const instance = createTestInstance({
        functions: {
          function1: {
            events: [{
              stream: {
                type: 'dynamodb',
                arn: streamArn
              }
            }]
          }
        }
      });

      instance.createRoles();

      expect(instance)
        .to.have.nested.property('serverless.service.resources')
        .that.containSubset({
          Resources: {
            Function1LambdaFunctionRole: {
              Type: 'AWS::IAM::Role',
              Properties: {
                Policies: [{
                  PolicyName: 'streams',
                  PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                      Effect: 'Allow',
                      Action: [
                        'dynamodb:GetRecords',
                        'dynamodb:GetShardIterator',
                        'dynamodb:DescribeStream',
                        'dynamodb:ListStreams'
                      ],
                      Resource: [streamArn]
                    }]
                  }
                }]
              }
            }
          }
        });

      sinon.assert.notCalled(instance.serverless.cli.log);
    });
  });
});
