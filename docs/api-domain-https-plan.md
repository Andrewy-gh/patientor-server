# API Domain And HTTPS Plan

This plan is for the Patientor API first. The intended public entry point is:

```text
https://api.<owned-domain>
```

That API subdomain should point to the AWS Application Load Balancer for the
ECS/Fargate service. The web app can get its own domain plan later; this slice
only needs the backend API to have a stable, secure URL before real production
traffic uses it.

## Product Behavior

- Users and frontend clients should call the API through
  `https://api.<owned-domain>`, not through the raw ALB DNS name.
- The AWS ALB remains the public edge for the server.
- HTTP traffic on port `80` should redirect to HTTPS on port `443` once HTTPS is
  active.
- Until the domain and validation record are ready, the existing HTTP ALB
  scaffold can continue supporting deployment rehearsal and smoke tests.

## Squarespace DNS And ACM Validation

The owned domain is currently managed through Squarespace DNS. AWS Certificate
Manager can issue a certificate for `api.<owned-domain>`, but it must prove
control of the domain first.

Expected manual path:

1. Choose the exact API subdomain, for example `api.example.com`.
2. Request an ACM certificate in the same AWS region as the ALB.
3. ACM provides a DNS validation CNAME record.
4. Add that CNAME record manually in Squarespace DNS.
5. Wait for ACM to mark the certificate as issued.
6. Point `api.<owned-domain>` at the ALB with the appropriate DNS record.

If the domain moves to Route 53 later, Terraform can own more of this flow. With
Squarespace staying in place, DNS validation is an intentional manual handoff:
Terraform can request and use the certificate, but Squarespace still owns the
validation record unless Route 53 becomes authoritative for the domain or
subdomain.

## Terraform Shape When Ready

Do not add active ACM or HTTPS listener Terraform until the API subdomain is
chosen and Andy can create the required Squarespace DNS validation record.

When ready, the AWS Terraform slice should add:

- An ACM certificate for `api.<owned-domain>`.
- DNS validation support that outputs the CNAME name and value for manual entry
  in Squarespace, unless Route 53 is adopted.
- An ALB HTTPS listener on port `443` using the issued ACM certificate.
- An ALB HTTP listener on port `80` that redirects requests to HTTPS.
- Any outputs needed for the manual DNS steps and smoke testing.

Keep the implementation narrow. Avoid changing the ECS task, migration flow, RDS
setup, or image publishing flow just to add HTTPS.

## Current Blocker

Active HTTPS is blocked until the exact API subdomain is chosen and the DNS
validation record can be added in Squarespace. That is okay for now: deployment
work can continue against the current ALB HTTP endpoint, and the HTTPS Terraform
can wait until DNS validation is possible.
