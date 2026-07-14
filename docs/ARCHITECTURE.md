# Bianca App — Architecture Diagram

High-level architecture for **Bianca Wellness** (MyPhoneFriend): a secure healthcare communication platform for caregivers and wellness monitoring (HIPAA-oriented).

---

## System context

```mermaid
flowchart TB
  subgraph users["Users"]
    Caregiver["Caregiver (Web / iOS / Android)"]
  end

  subgraph bianca["Bianca App"]
    Mobile["Mobile app (React Native / Expo)"]
    Backend["Backend API (Node.js / Express)"]
    subgraph our_infra["Our infrastructure (AWS)"]
      Asterisk["Asterisk (VoIP / ARI)\nself-managed"]
    end
  end

  subgraph external["External Services"]
    Twilio["Twilio (SMS / Voice)"]
    Stripe["Stripe (Billing)"]
    OpenAI["OpenAI (Realtime Voice, Sentiment)"]
    AWS["AWS (S3, SES, SNS, Secrets)"]
    SSO["SSO / OAuth"]
  end

  Caregiver --> Mobile
  Mobile -->|REST / JWT| Backend
  Backend --> Asterisk
  Backend --> Twilio
  Backend --> Stripe
  Backend --> OpenAI
  Backend --> AWS
  Backend --> SSO
```

---

## Monorepo & deployment

```mermaid
flowchart LR
  subgraph repo["bianca-app (Yarn workspaces)"]
    PkgBackend["packages/backend"]
    PkgMobile["packages/mobile"]
  end

  subgraph deploy["Deployment"]
    Terraform["Terraform (AWS)"]
    CodePipeline["CodePipeline"]
    CodeDeploy["CodeDeploy (blue/green)"]
    ECS["ECS / EC2"]
  end

  repo --> CodePipeline
  CodePipeline --> CodeDeploy
  CodeDeploy --> ECS
  Terraform --> ECS
```

---

## Mobile app architecture

```mermaid
flowchart TB
  subgraph client["Client (Web / iOS / Android)"]
    Screens["Screens\n(Home, Conversations, Schedules,\nAlerts, Call, Profile, Client,\nCaregivers, Login, MFA, etc.)"]
    Store["Redux Store\n(auth, alert, caregiver, org,\nconversation, schedule, client,\npayment, callWorkflow, call, home)"]
    API["API layer\n(RTK Query + baseQueryWithAuth)\nApisauce → Config.API_URL"]
  end

  Screens --> Store
  Screens --> API
  Store --> API
  API -->|"HTTPS /v1/*\nJWT"| Backend["Backend API"]
```

---

## Backend architecture

```mermaid
flowchart TB
  subgraph ingress["Ingress"]
    HTTP["HTTP :3000"]
    Health["/health"]
  end

  subgraph express["Express app"]
    Middle["Middleware\n(helmet, CORS, passport JWT,\nrate limit, session timeout,\naudit log)"]
    Routes["/v1 routes"]
  end

  subgraph routes["API routes (v1)"]
    R1["/auth, /mfa, /sso"]
    R2["/clients, /caregivers, /orgs"]
    R3["/conversations, /alerts"]
    R4["/schedules, /calls"]
    R5["/openai, /sentiment\n/medical-analysis\n/fraud-abuse-analysis"]
    R6["/payments, /payment-methods\n/stripe"]
    R7["/twilio, /phone-verification"]
    R8["/privacy, /reports\n/emergency-phrases"]
  end

  subgraph services["Backend services"]
    Auth["auth, token, mfa\nbreachDetection"]
    Core["client, caregiver\norg, schedule"]
    Comms["conversation, alert\nemail, twilioSms"]
    Voice["call, ari.client\nrtp.listener, rtp.sender\nopenai.realtime"]
    AI["sentiment, analysis\nmedicalAnalysisScheduler"]
    Billing["stripeBilling, stripeWebhook\npayment, paymentMethod"]
    Data["s3, cache (Redis)"]
  end

  subgraph data["Data & infra"]
    Mongo["MongoDB\n(Mongoose)"]
    Redis["Redis\n(cache, sessions)"]
    Agenda["Agenda\n(jobs)"]
  end

  HTTP --> Health
  HTTP --> Middle
  Middle --> Routes
  Routes --> R1 & R2 & R3 & R4 & R5 & R6 & R7 & R8
  R1 & R2 & R3 & R4 & R5 & R6 & R7 & R8 --> services
  services --> Mongo
  services --> Redis
  services --> Agenda
```

---

## Voice & AI pipeline

```mermaid
flowchart LR
  subgraph client["App"]
    CallScreen["Call screen"]
  end

  subgraph backend["Backend"]
    CallWorkflow["callWorkflow\ncontroller"]
    ARI["ari.client\n(Asterisk ARI)"]
    RTP["rtp.listener\nrtp.sender"]
    OpenAIRealtime["openai.realtime\n(WebSocket)"]
  end

  subgraph our_infra["Our infrastructure (AWS)"]
    Asterisk["Asterisk\n(PJSIP, RTP)\nself-managed"]
  end

  subgraph external["External"]
    OpenAI["OpenAI\nRealtime API"]
  end

  CallScreen -->|"REST /v1/calls"| CallWorkflow
  CallWorkflow --> ARI
  ARI <-->|"ARI WebSocket"| Asterisk
  Asterisk <- ->|RTP| RTP
  RTP <--> OpenAIRealtime
  OpenAIRealtime <-->|"WebSocket"| OpenAI
```

**Scaling note:** Asterisk currently runs in Docker on the same EC2 as the app (pilot). Self-hosted voice compute becomes the dominant AWS platform cost at large resident counts; see `packages/backend/docs/deployment/ASTERISK_SCALING.md`.

---

## Docker (local dev)

```mermaid
flowchart TB
  subgraph docker["Docker Compose"]
    App["bianca-app\n(Express)"]
    Mongo["mongodb:27017"]
    Asterisk["asterisk\n(5060, 8088, RTP)"]
    Redis["redis:6379"]
  end

  App --> Mongo
  App --> Asterisk
  App --> Redis
```

---

## Key technologies

| Layer        | Technologies |
|-------------|--------------|
| Mobile app  | React Native, Expo 50, Redux Toolkit, RTK Query, TypeScript |
| Web (desktop) | Vite, React 18, shared design tokens (`@bianca-app/shared`) |
| Backend     | Node.js, Express, Passport JWT, Mongoose, Agenda |
| Data        | MongoDB, Redis |
| Voice       | Asterisk (ARI, self-managed on AWS), Twilio, OpenAI Realtime API, RTP |
| AI          | OpenAI (sentiment, medical/fraud-abuse analysis), LangChain |
| Billing     | Stripe (subscriptions, webhooks, usage) |
| AWS         | S3, SES, SNS, Secrets Manager |
| DevOps      | Terraform, CodePipeline, CodeDeploy, Docker |

---

## Security & compliance (HIPAA-oriented)

- **Auth:** JWT, MFA (TOTP), SSO/OAuth, session timeout
- **Audit:** Audit logging for PHI access
- **Policies:** Rate limiting (auth), minimum-necessary middleware, breach detection
- **Data:** Mongo sanitization, XSS clean, CORS allowlist

