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

variable "server_desired_count" {
  type        = number
  default     = 1
  description = "Number of local Patientor server ECS service tasks to run."

  validation {
    condition     = var.server_desired_count >= 0
    error_message = "server_desired_count must be zero or greater."
  }
}

locals {
  server_image = "patientor-server:local"
  database_url = "postgresql://patientor:patientor@postgres:5432/patientor"
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
      image     = local.server_image
      essential = true
      memory    = 512
      cpu       = 256
      environment = [
        {
          name  = "DATABASE_URL"
          value = local.database_url
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

resource "aws_ecs_task_definition" "patientor_server_migrations" {
  family       = "patientor-server-migrations"
  network_mode = "bridge"

  container_definitions = jsonencode([
    {
      name      = "migrations"
      image     = local.server_image
      essential = true
      memory    = 512
      cpu       = 256
      command   = ["node", "build/src/db/migrate.js"]
      environment = [
        {
          name  = "DATABASE_URL"
          value = local.database_url
        }
      ]
    }
  ])

  lifecycle {
    ignore_changes = [
      container_definitions,
      requires_compatibilities,
      tags,
      tags_all,
    ]
  }
}

resource "aws_ecs_service" "patientor_server" {
  name            = "patientor-server"
  cluster         = aws_ecs_cluster.patientor_dev.id
  task_definition = aws_ecs_task_definition.patientor_server.arn
  desired_count   = var.server_desired_count

  lifecycle {
    ignore_changes = [
      deployment_controller,
      health_check_grace_period_seconds,
      launch_type,
      platform_version,
      scheduling_strategy,
      tags,
      tags_all,
      triggers,
    ]
  }
}
