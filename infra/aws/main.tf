terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

locals {
  name         = var.name
  database_url = "postgresql://${var.database_username}:${urlencode(random_password.database.result)}@${aws_db_instance.app.address}:${aws_db_instance.app.port}/${var.database_name}"

  container_environment = concat(
    [
      {
        name  = "NODE_ENV"
        value = "production"
      },
      {
        name  = "PORT"
        value = tostring(var.container_port)
      }
    ],
    var.tracing_enabled == null ? [] : [
      {
        name  = "TRACING_ENABLED"
        value = tostring(var.tracing_enabled)
      }
    ],
    var.otel_exporter_otlp_endpoint == null ? [] : [
      {
        name  = "OTEL_EXPORTER_OTLP_ENDPOINT"
        value = var.otel_exporter_otlp_endpoint
      }
    ]
  )
}

resource "aws_ecr_repository" "app" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
}

resource "random_password" "database" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "database_url" {
  name        = var.database_url_secret_name
  description = "DATABASE_URL for the ${local.name} ECS tasks."
}

resource "aws_db_subnet_group" "app" {
  name        = "${local.name}-db"
  description = "Private subnets for the ${local.name} PostgreSQL database."
  subnet_ids  = var.private_subnet_ids
}

resource "aws_security_group" "database" {
  name        = "${local.name}-database"
  description = "Allow ${local.name} ECS tasks to reach PostgreSQL."
  vpc_id      = var.vpc_id
}

resource "aws_ecs_cluster" "app" {
  name = local.name
}

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.database_url.arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "${local.name}-execution-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Allow HTTP traffic to the ${local.name} load balancer."
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = var.alb_ingress_cidr_ipv4
  from_port         = 80
  ip_protocol       = "tcp"
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "service" {
  name        = "${local.name}-service"
  description = "Allow load balancer traffic to ${local.name} tasks."
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "service_from_alb" {
  security_group_id            = aws_security_group.service.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.container_port
  ip_protocol                  = "tcp"
  to_port                      = var.container_port
}

resource "aws_vpc_security_group_egress_rule" "service_all" {
  security_group_id = aws_security_group.service.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "database_from_service" {
  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = aws_security_group.service.id
  from_port                    = 5432
  ip_protocol                  = "tcp"
  to_port                      = 5432
}

resource "aws_db_instance" "app" {
  identifier = var.database_identifier

  allocated_storage     = var.database_allocated_storage
  max_allocated_storage = var.database_max_allocated_storage
  storage_encrypted     = true
  storage_type          = "gp3"

  engine         = "postgres"
  engine_version = var.database_engine_version
  instance_class = var.database_instance_class

  db_name  = var.database_name
  username = var.database_username
  password = random_password.database.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.app.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false

  backup_retention_period   = var.database_backup_retention_days
  deletion_protection       = var.database_deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.database_identifier}-final-snapshot"
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}

resource "aws_lb" "app" {
  name               = local.name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "app" {
  name        = local.name
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/v1/ping"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "server"
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = local.container_environment

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "server"
        }
      }
    }
  ])

  depends_on = [aws_secretsmanager_secret_version.database_url]
}

resource "aws_ecs_task_definition" "migrations" {
  family                   = "${local.name}-migrations"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "migrations"
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true
      command   = ["node", "build/src/db/migrate.js"]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "migrations"
        }
      }
    }
  ])

  depends_on = [aws_secretsmanager_secret_version.database_url]
}

resource "aws_ecs_service" "app" {
  name            = local.name
  cluster         = aws_ecs_cluster.app.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    assign_public_ip = var.assign_public_ip
    security_groups  = [aws_security_group.service.id]
    subnets          = var.private_subnet_ids
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "server"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.http]
}
