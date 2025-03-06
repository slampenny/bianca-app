  #!/bin/bash

  # Variables
  AWS_PROFILE="jordan"
  AWS_DEFAULT_REGION="us-east-2"
  AWS_ACCOUNT_ID="730335291008"
  REPOSITORY_NAME="bianca-app-backend"
  BUCKET_NAME="bianca-codepipeline-artifact-bucket"
  CODEPIPELINE_ROLE="CodePipelineServiceRole"
  CODEBUILD_ROLE="CodeBuildServiceRole"
  CODEDEPLOY_ROLE="CodeDeployServiceRole"
  EXECUTION_ROLE_NAME="ecsTaskExecutionRole"
  GITHUB_OWNER="slampenny"
  GITHUB_REPO="bianca-app-backend"
  GITHUB_BRANCH="main"
  SECRETS_MANAGER_SECRET="MySecretsManagerSecret"
  APPLICATION_NAME="BiancaApp"
  DEPLOYMENT_GROUP_NAME="BiancaDeploymentGroup"
  CLUSTER_NAME="bianca-cluster"
  SERVICE_NAME="bianca-service"
  LOAD_BALANCER_NAME="bianca-load-balancer"
  TARGET_GROUP_NAME="bianca-target-group"
  CONTAINER_NAME="bianca-app-backend"
  CONTAINER_PORT=80
  VPC_ID="vpc-05c16725411127dc3"
  SUBNET_IDS="subnet-016b6aba534de1845,subnet-0c7b38f9439f97b3e,subnet-006892e47fe84433f"
  SECURITY_GROUP_ID="sg-0e3774173bebafaab"

  # Step 1: Create S3 Bucket
  if ! aws s3api head-bucket --bucket $BUCKET_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate 2>/dev/null; then
    echo "Creating S3 bucket..."
    aws s3api create-bucket --bucket $BUCKET_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE
    aws s3api put-bucket-versioning --bucket $BUCKET_NAME --versioning-configuration Status=Enabled --profile $AWS_PROFILE
  else
    echo "S3 bucket already exists."
  fi

  # Step 2: Create ECR Repository
  if ! aws ecr describe-repositories --repository-names $REPOSITORY_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate 2>/dev/null; then
    echo "Creating ECR repository..."
    aws ecr create-repository --repository-name $REPOSITORY_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE
  else
    echo "ECR repository already exists."
  fi

  # Step 3: Set Up IAM Roles
  cat > trust-policy.json <<EOL
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": [
            "codepipeline.amazonaws.com",
            "codebuild.amazonaws.com",
            "codedeploy.amazonaws.com",
            "ecs-tasks.amazonaws.com"
          ]
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  EOL

  create_or_update_role() {
    ROLE_NAME=$1
    POLICY_ARN=$2
    if ! aws iam get-role --role-name $ROLE_NAME --profile $AWS_PROFILE --no-paginate 2>/dev/null; then
      echo "Creating IAM role $ROLE_NAME..."
      aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document file://trust-policy.json --profile $AWS_PROFILE
      aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn $POLICY_ARN --profile $AWS_PROFILE
    else
      echo "IAM role $ROLE_NAME already exists."
    fi
  }

  create_or_update_role $CODEPIPELINE_ROLE "arn:aws:iam::aws:policy/AWSCodePipeline_FullAccess"
  create_or_update_role $CODEBUILD_ROLE "arn:aws:iam::aws:policy/AWSCodeBuild_AdminAccess"
  create_or_update_role $CODEDEPLOY_ROLE "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
  create_or_update_role $EXECUTION_ROLE_NAME "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"

  EXECUTION_ROLE_ARN=$(aws iam get-role --role-name $EXECUTION_ROLE_NAME --query 'Role.Arn' --output text --profile $AWS_PROFILE --no-paginate)

  # Step 4: Create ECS Cluster
  if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate | grep -q "ACTIVE"; then
    echo "Creating ECS cluster..."
    aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE
  else
    echo "ECS cluster already exists."
  fi

  # Step 5: Create Load Balancer and Target Group
  if ! aws elbv2 describe-load-balancers --names $LOAD_BALANCER_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate 2>/dev/null; then
    echo "Creating load balancer..."
    LOAD_BALANCER_ARN=$(aws elbv2 create-load-balancer --name $LOAD_BALANCER_NAME --subnets $SUBNET_IDS --security-groups $SECURITY_GROUP_ID --scheme internet-facing --type application --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --query 'LoadBalancers[0].LoadBalancerArn' --output text)
  else
    echo "Load balancer already exists."
    LOAD_BALANCER_ARN=$(aws elbv2 describe-load-balancers --names $LOAD_BALANCER_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --query 'LoadBalancers[0].LoadBalancerArn' --output text --no-paginate)
  fi

  if ! aws elbv2 describe-target-groups --names $TARGET_GROUP_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate 2>/dev/null; then
    echo "Creating target group..."
    TARGET_GROUP_ARN=$(aws elbv2 create-target-group --name $TARGET_GROUP_NAME --protocol HTTP --port $CONTAINER_PORT --vpc-id $VPC_ID --target-type ip --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --query 'TargetGroups[0].TargetGroupArn' --output text)
  else
    echo "Target group already exists."
    TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups --names $TARGET_GROUP_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --query 'TargetGroups[0].TargetGroupArn' --output text --no-paginate)
  fi

  # Step 6: Create Listener for Load Balancer
  if ! aws elbv2 describe-listeners --load-balancer-arn $LOAD_BALANCER_ARN --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate | grep -q "arn:aws:elasticloadbalancing:"; then
    echo "Creating listener for load balancer..."
    aws elbv2 create-listener --load-balancer-arn $LOAD_BALANCER_ARN --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE
  else
    echo "Listener for load balancer already exists."
  fi

  # Step 7: Ensure Listener Forwarding
  LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $LOAD_BALANCER_ARN --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --query 'Listeners[0].ListenerArn' --output text --no-paginate)

  #aws elbv2 modify-listener --listener-arn $LISTENER_ARN --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE
  aws elbv2 modify-listener --listener-arn $LISTENER_ARN \
      --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN \
      --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE

  # Step 8: Create ECS Task Definition
  cat > task-definition.json <<EOL
  {
    "family": "$SERVICE_NAME",
    "networkMode": "awsvpc",
    "containerDefinitions": [
      {
        "name": "$CONTAINER_NAME",
        "image": "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$REPOSITORY_NAME:latest",
        "essential": true,
        "portMappings": [
          {
            "containerPort": $CONTAINER_PORT,
            "hostPort": $CONTAINER_PORT
          }
        ],
        "environment": [
          {
            "name": "MONGODB_URL",
            "value": "mongodb://mongodb:27017/bianca-app"
          }
        ]
      },
      {
        "name": "mongodb",
        "image": "mongo:4.2.1-bionic",
        "essential": true,
        "portMappings": [
          {
            "containerPort": 27017,
            "hostPort": 27017
          }
        ]
      }
    ],
    "requiresCompatibilities": [
      "FARGATE"
    ],
    "executionRoleArn": "$EXECUTION_ROLE_ARN",
    "cpu": "256",
    "memory": "512"
  }
  EOL

  echo "Registering ECS task definition..."
  TASK_DEFINITION_ARN=$(aws ecs register-task-definition --cli-input-json file://task-definition.json --query 'taskDefinition.taskDefinitionArn' --output text --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate)

  # Step 9: Create ECS Service
  if ! aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate | grep -q "ACTIVE"; then
    echo "Creating ECS service..."
    aws ecs create-service --cluster $CLUSTER_NAME --service-name $SERVICE_NAME \
      --task-definition $TASK_DEFINITION_ARN --desired-count 1 \
      --launch-type FARGATE \
      --deployment-controller type=CODE_DEPLOY \
      --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SECURITY_GROUP_ID],assignPublicIp=ENABLED}" \
      --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=$CONTAINER_NAME,containerPort=$CONTAINER_PORT" \
      --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE

    # Wait for ECS service to become ACTIVE
    MAX_RETRIES=30  # Retry up to 30 times (300 seconds or 5 minutes)
    RETRIES=0

    SERVICE_STATUS=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --query 'services[0].status' --output text --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate)

    while [ "$SERVICE_STATUS" != "ACTIVE" ] && [ $RETRIES -lt $MAX_RETRIES ]; do
      echo "Waiting for ECS service to become ACTIVE... Attempt $((RETRIES+1))/$MAX_RETRIES"
      sleep 10
      SERVICE_STATUS=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --query 'services[0].status' --output text --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate)
      RETRIES=$((RETRIES + 1))
    done

    if [ "$SERVICE_STATUS" != "ACTIVE" ]; then
      echo "ECS service failed to become ACTIVE within the timeout period."
      exit 1
    fi

  else
    echo "ECS service already exists."
  fi

  # Step 10: Create CodeBuild Project
  if ! aws codebuild batch-get-projects --names bianca --region $AWS_DEFAULT_REGION --profile $AWS_PROFILE --no-paginate | grep -q "bianca"; then
    echo "Creating CodeBuild project..."
    cat > codebuild-project.json <<EOL
  {
    "name": "bianca",
    "source": {
      "type": "GITHUB",
      "location": "https://github.com/$GITHUB_OWNER/$GITHUB_REPO"
    },
    "artifacts": {
      "type": "CODEPIPELINE"
    },
    "environment": {
      "type": "LINUX_CONTAINER",
      "image": "aws/codebuild/standard:4.0",
      "computeType": "BUILD_GENERAL1_SMALL",
      "privilegedMode": true
    },
    "serviceRole": "arn:aws:iam::$AWS_ACCOUNT_ID:role/$CODEBUILD_ROLE"
  }
  EOL
    aws codebuild create-project --cli-input-json file://codebuild-project.json --profile $AWS_PROFILE
  else
    echo "CodeBuild project already exists."
  fi

  # Step 11: Create CodeDeploy Application and Deployment Group
  if ! aws deploy get-application --application-name $APPLICATION_NAME --profile $AWS_PROFILE --no-paginate 2>/dev/null; then
    echo "Creating CodeDeploy application..."
    aws deploy create-application --application-name $APPLICATION_NAME --compute-platform ECS --profile $AWS_PROFILE
  else
    echo "CodeDeploy application already exists."
  fi

  if ! aws deploy get-deployment-group --application-name $APPLICATION_NAME --deployment-group-name $DEPLOYMENT_GROUP_NAME --profile $AWS_PROFILE --no-paginate 2>/dev/null; then
    echo "Creating CodeDeploy deployment group..."
    aws deploy create-deployment-group --application-name $APPLICATION_NAME --deployment-group-name $DEPLOYMENT_GROUP_NAME \
      --service-role-arn arn:aws:iam::$AWS_ACCOUNT_ID:role/$CODEDEPLOY_ROLE \
      --deployment-style deploymentType=BLUE_GREEN,deploymentOption=WITH_TRAFFIC_CONTROL \
      --blue-green-deployment-configuration "{\"terminateBlueInstancesOnDeploymentSuccess\":{\"action\":\"TERMINATE\",\"terminationWaitTimeInMinutes\":5},\"deploymentReadyOption\":{\"actionOnTimeout\":\"CONTINUE_DEPLOYMENT\"},\"greenFleetProvisioningOption\":{\"action\":\"DISCOVER_EXISTING\"}}" \
      --load-balancer-info "{\"targetGroupInfoList\":[{\"name\":\"$TARGET_GROUP_NAME\"}]}" \
      --ecs-services "{\"serviceName\":\"$SERVICE_NAME\",\"clusterName\":\"$CLUSTER_NAME\"}" \
      --profile $AWS_PROFILE
  else
    echo "CodeDeploy deployment group already exists."
  fi

  # Step 12: Create CodePipeline
  if ! aws codepipeline get-pipeline --name BiancaPipeline --profile $AWS_PROFILE --no-paginate 2>/dev/null; then
    echo "Creating CodePipeline..."
    cat > codepipeline.json <<EOL
  {
    "pipeline": {
      "name": "BiancaPipeline",
      "roleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/$CODEPIPELINE_ROLE",
      "artifactStore": {
        "type": "S3",
        "location": "$BUCKET_NAME"
      },
      "stages": [
        {
          "name": "Source",
          "actions": [
            {
              "name": "SourceAction",
              "actionTypeId": {
                "category": "Source",
                "owner": "ThirdParty",
                "provider": "GitHub",
                "version": "1"
              },
              "outputArtifacts": [
                {
                  "name": "SourceOutput"
                }
              ],
              "configuration": {
                "Owner": "$GITHUB_OWNER",
                "Repo": "$GITHUB_REPO",
                "Branch": "$GITHUB_BRANCH",
                "OAuthToken": "{{resolve:secretsmanager:$SECRETS_MANAGER_SECRET:SecretString:GitHubToken}}"
              },
              "runOrder": 1
            }
          ]
        },
        {
          "name": "Build",
          "actions": [
            {
              "name": "BuildAction",
              "actionTypeId": {
                "category": "Build",
                "owner": "AWS",
                "provider": "CodeBuild",
                "version": "1"
              },
              "inputArtifacts": [
                {
                  "name": "SourceOutput"
                }
              ],
              "outputArtifacts": [
                {
                  "name": "BuildOutput"
                }
              ],
              "configuration": {
                "ProjectName": "bianca"
              },
              "runOrder": 1
            }
          ]
        },
        {
          "name": "Deploy",
          "actions": [
            {
              "name": "DeployAction",
              "actionTypeId": {
                "category": "Deploy",
                "owner": "AWS",
                "provider": "CodeDeploy",
                "version": "1"
              },
              "inputArtifacts": [
                {
                  "name": "BuildOutput"
                }
              ],
              "configuration": {
                "ApplicationName": "$APPLICATION_NAME",
                "DeploymentGroupName": "$DEPLOYMENT_GROUP_NAME"
              },
              "runOrder": 1
            }
          ]
        }
      ]
    }
  }
  EOL

    aws codepipeline create-pipeline --cli-input-json file://codepipeline.json --profile $AWS_PROFILE
  else
    echo "CodePipeline already exists."
  fi

  echo "Setup complete. Check the AWS Console to verify your pipeline and resources."
