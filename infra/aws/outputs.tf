output "ecr_repository_url" {
  description = "ECR repository URL where production images should be pushed."
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.app.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.app.name
}

output "migration_task_definition_arn" {
  description = "Task definition ARN to run the one-off production migration task."
  value       = aws_ecs_task_definition.migrations.arn
}

output "task_execution_role_arn" {
  description = "IAM role used by ECS to pull images, write logs, and read runtime secrets."
  value       = aws_iam_role.execution.arn
}

output "task_role_arn" {
  description = "IAM role assumed by the running application container."
  value       = aws_iam_role.task.arn
}

output "load_balancer_dns_name" {
  description = "Public DNS name of the application load balancer."
  value       = aws_lb.app.dns_name
}

output "target_group_arn" {
  description = "ALB target group ARN for the ECS service."
  value       = aws_lb_target_group.app.arn
}

output "service_security_group_id" {
  description = "Security group used by ECS tasks and one-off migration tasks."
  value       = aws_security_group.service.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs used by ECS tasks, migration tasks, and the RDS subnet group."
  value       = var.private_subnet_ids
}

output "log_group_name" {
  description = "CloudWatch log group for ECS task logs."
  value       = aws_cloudwatch_log_group.app.name
}

output "database_endpoint" {
  description = "RDS PostgreSQL endpoint hostname."
  value       = aws_db_instance.app.address
}

output "database_url_secret_arn" {
  description = "Secrets Manager secret ARN consumed as DATABASE_URL by ECS tasks."
  value       = aws_secretsmanager_secret.database_url.arn
}
