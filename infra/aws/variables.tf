variable "aws_region" {
  description = "AWS region for production resources."
  type        = string
}

variable "name" {
  description = "Name prefix for the ECS service, cluster, load balancer, and related resources."
  type        = string
  default     = "patientor-server"
}

variable "tags" {
  description = "Default tags applied to all supported AWS resources."
  type        = map(string)
  default = {
    Application = "patientor-server"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

variable "vpc_id" {
  description = "Existing VPC ID where the load balancer and ECS service will run."
  type        = string
}

variable "public_subnet_ids" {
  description = "Existing public subnet IDs for the internet-facing ALB."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Existing private subnet IDs for Fargate tasks."
  type        = list(string)
}

variable "alb_ingress_cidr_ipv4" {
  description = "IPv4 CIDR allowed to reach the ALB on port 80."
  type        = string
  default     = "0.0.0.0/0"
}

variable "ecr_repository_name" {
  description = "ECR repository name for the server image."
  type        = string
  default     = "patientor-server"
}

variable "image_tag" {
  description = "Existing ECR image tag to deploy in the ECS task definition."
  type        = string
}

variable "database_url_secret_arn" {
  description = "Secrets Manager secret ARN containing the DATABASE_URL value."
  type        = string
  sensitive   = true
}

variable "container_port" {
  description = "Port exposed by the server container."
  type        = number
  default     = 3001
}

variable "desired_count" {
  description = "Number of Fargate tasks to run."
  type        = number
  default     = 2
}

variable "task_cpu" {
  description = "Fargate task CPU units."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "assign_public_ip" {
  description = "Whether to assign public IPs to tasks. Keep false when private subnets have NAT egress."
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 30
}

variable "tracing_enabled" {
  description = "Optional TRACING_ENABLED value for the server container."
  type        = bool
  default     = null
}

variable "otel_exporter_otlp_endpoint" {
  description = "Optional OTEL_EXPORTER_OTLP_ENDPOINT value for the server container."
  type        = string
  default     = null
}
