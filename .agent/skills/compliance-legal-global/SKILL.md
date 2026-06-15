---
name: compliance-legal-global
description: Global data privacy and legal compliance (GDPR, LGPD, CCPA, HIPAA)
version: 1.0
priority: HIGH
---

# Compliance & Legal Global Skill

> Ensure the application meets international legal standards for data protection and privacy.

## Core Rules

| Framework | Region | Key Requirements |
|-----------|--------|------------------|
| **GDPR** | Europe | Consent management, Right to be forgotten, Data portability |
| **LGPD** | Brazil | Explicit consent, Data protection officer, Impact reports |
| **CCPA** | USA (CA) | "Do Not Sell My Info", Transparency, Opt-out rights |
| **HIPAA** | USA | (If Health) PHI protection, Audit logs, Encryption at rest |

## Best Practices

1. **Consent First:** Never track or store data without explicit user action.
2. **Data Minimization:** Only collect what is strictly necessary for the service.
3. **Encryption:** All PII (Personally Identifiable Information) MUST be encrypted at rest and in transit.
4. **Audit Logs:** Maintain logs of data access and modifications for compliance audits.
5. **Cookie Policies:** Implement clear, granular cookie consent banners.

## Implementation Patterns

- **Privacy Policy:** Must be easily accessible from every page.
- **Data Export:** Provide an automated way for users to download their data.
- **Account Deletion:** A clear, "one-click" request system for account and data removal.
