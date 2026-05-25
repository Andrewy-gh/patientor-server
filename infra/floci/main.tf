terraform {
  required_version = ">= 1.14.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    ecs = "http://localhost:4566"
  }
}

resource "aws_ecs_cluster" "patientor_dev" {
  name = "patientor-dev"
}

resource "aws_ecs_task_definition" "patientor_server" {
  family       = "patientor-server"
  network_mode = "bridge"

  container_definitions = jsonencode([
    {
      name      = "server"
      image     = "patientor-server:local"
      essential = true
      memory    = 512
      cpu       = 256
      environment = [
        {
          name  = "DATABASE_URL"
          value = "postgresql://patientor:patientor@postgres:5432/patientor"
        },
        {
          name  = "PORT"
          value = "3001"
        }
      ]
      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
          protocol      = "tcp"
        }
      ]
    }
  ])
}

resource "aws_ecs_service" "patientor_server" {
  name            = "patientor-server"
  cluster         = aws_ecs_cluster.patientor_dev.id
  task_definition = aws_ecs_task_definition.patientor_server.arn
  desired_count   = 1
}
