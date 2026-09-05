# CortexAI

Production AI-native productivity platform with LangGraph multi-agent orchestration, adaptive PDF RAG pipeline, and credit-based billing.

## Architecture

```mermaid
graph TB
    Internet["Internet"]
    Amplify["AWS Amplify<br/>Frontend Hosting"]
    ALB["Application Load Balancer"]
    Gateway["Gateway Service<br/>:8000"]
    Auth["Auth Service<br/>:8001"]
    Chat["Chat Service<br/>:8002"]
    Agent["Agent Service<br/>:8003"]
    Billing["Billing Service<br/>:8004"]
    Redis["Redis<br/>:6379"]
    MongoDB["MongoDB Atlas"]
    Qdrant["Qdrant Cloud"]
    S3["AWS S3"]
    Tavily["Tavily Search"]
    Groq["Groq API"]
    Gemini["Google Gemini"]
    HuggingFace["HuggingFace"]
    Razorpay["Razorpay"]

    Internet --> Amplify
    Amplify --> ALB
    ALB --> Gateway
    Gateway --> Auth
    Gateway --> Chat
    Gateway --> Agent
    Gateway --> Billing

    Auth --> MongoDB
    Auth --> Redis
    Chat --> MongoDB
    Chat --> Redis
    Agent --> MongoDB
    Agent --> Redis
    Agent --> Qdrant
    Agent --> S3
    Agent --> Tavily
    Agent --> Groq
    Agent --> Gemini
    Agent --> HuggingFace
    Billing --> MongoDB
    Billing --> Auth
    Billing --> Razorpay
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19.2.8 · Vite 8.2.2 · Redux Toolkit 2.12.0 · Tailwind CSS 4.3.3 |
| **Orchestration** | LangGraph (`StateGraph`) |
| **Agents** | Groq (`openai/gpt-oss-120b`) · Gemini (`gemini-2.5-flash`) · HuggingFace |
| **Vector DB** | Qdrant Cloud |
| **Embeddings** | HuggingFace (`BAAI/bge-small-en-v1.5`) |
| **Databases** | MongoDB Atlas · Redis 7.4 (ioredis) |
| **Auth** | Firebase Admin · Session cookies |
| **Payments** | Razorpay |
| **File Storage** | AWS S3 (presigned URLs) |
| **Search** | Tavily |
| **CI/CD** | GitHub Actions · AWS ECS Fargate · ECR · AWS Amplify |
| **CDN** | AWS Amplify |

## Backend Services

| Service | Port | Responsibility | Dependencies |
|---------|------|----------------|--------------|
| **Gateway** | 8000 | Public API entry point, authentication, request proxying | Redis |
| **Auth** | 8001 | Identity, sessions, credit ledger, Firebase validation | MongoDB, Redis |
| **Chat** | 8002 | Conversation/messages persistence, cursor pagination | MongoDB, Redis |
| **Agent** | 8003 | LangGraph orchestration, AI agents, PDF RAG | MongoDB, Redis, Qdrant, S3 |
| **Billing** | 8004 | Razorpay payment integration | MongoDB, Auth service |

### Gateway Routes

| Route | Auth | Target | Purpose |
|-------|------|--------|---------|
| `POST /api/auth/login` | None | Auth | Firebase ID token verification, session cookie issuance |
| `POST /api/auth/logout` | None | Auth | Clear session cookie and Redis keys |
| `POST /api/chat/*` | Session | Chat | Proxied with `x-user-id` header |
| `POST /api/agent/*` | Session | Agent | Proxied with `x-user-id` header |
| `POST /api/billing/*` | Session | Billing | Proxied with `x-user-id` header |
| `GET /api/me` | Session | - | Returns current user from session |

### Internal Service Communication

```mermaid
graph LR
    A["Agent Service"] -->|"POST /internal/reserve-credits<br/>x-internal-secret"| B["Auth Service"]
    A -->|"POST /save-message<br/>x-internal-secret"| C["Chat Service"]
    B -->|"x-internal-secret"| A
    C -->|"x-internal-secret"| A
    D["Billing Service"] -->|"POST /internal/update-plan<br/>x-internal-secret"| B
```

Services communicate via HTTP with `x-internal-secret` header validation (`requireInternal` middleware).

## LangGraph Agent Architecture

### State Schema

| Field | Type | Purpose |
|-------|------|---------|
| `prompt` | string | User input |
| `aiResponse` | string | Final response |
| `agent` | string | Selected agent type |
| `conversationId` | string | Session identifier |
| `searchResults` | array | Tavily results |
| `images` | array | Search result images |
| `artifacts` | array | Generated files |
| `userId` | string | User identifier |
| `file` | object | Uploaded file (PDF/image) |
| `creditsPreReserved` | boolean | Flag for search->chat flow |
| `preReservedAgent` | string | Pre-reserved agent type |
| `preReservationId` | string | Reservation for refund tracking |
| `searchFailed` | boolean | Search failure flag |

### Graph Structure

```mermaid
graph TB
    START(["__start__"]) --> ROUTER["router"]
    ROUTER -->|"state.agent"| SELECTED{Selected Agent}
    ROUTER -->|"file: pdf"| PDFRAG["pdfRag"]
    ROUTER -->|"file: image"| IMAGEANALYZER["imageAnalyzer"]
    ROUTER -->|"auto routing"| CLASSIFIED["LLM Classification"]

    SELECTED -->|"chat"| CHAT["chat"]
    SELECTED -->|"search"| SEARCH["search"]
    SELECTED -->|"coding"| CODING["coding"]
    SELECTED -->|"pdf"| PDF["pdf"]
    SELECTED -->|"ppt"| PPT["ppt"]
    SELECTED -->|"vision"| VISION["vision"]

    CLASSIFIED --> CHAT
    CLASSIFIED --> CODING
    CLASSIFIED --> PDF
    CLASSIFIED --> PPT
    CLASSIFIED --> VISION

    SEARCH --> CHAT
    CHAT --> END(["__end__"])
    CODING --> END
    PDF --> END
    PPT --> END
    VISION --> END
    PDFRAG --> END
    IMAGEANALYZER --> END
```

### Agent Routing Logic

1. If `state.agent` is explicitly set (not "auto"), use that agent
2. If file attached:
   - `application/pdf` -> `pdfRag`
   - `image/*` -> `imageAnalyzer`
3. Otherwise, LLM-based intent classification via Groq router

### Agent Model Assignment

| Agent | Provider | Model |
|-------|----------|-------|
| chat | Groq | `openai/gpt-oss-120b` |
| search | Groq | `openai/gpt-oss-120b` |
| coding | Gemini | `gemini-2.5-flash` |
| pdf | Groq (default) | - |
| ppt | Groq (default) | - |
| vision | HuggingFace | `FLUX.1-schnell` |
| pdfRag | Gemini | `gemini-2.5-flash` |
| imageAnalyzer | Gemini | `gemini-2.5-flash` |
| vision-ocr | Gemini | `gemini-2.5-flash` |

**Note:** OpenRouter is installed (`@langchain/openrouter`) but not actively used. No automatic provider fallback exists.

### Credit Reservation Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Agent
    participant Auth
    participant MongoDB

    Client->>Gateway: POST /api/agent/chat
    Gateway->>Agent: proxy with x-user-id
    Agent->>Auth: reserveCredits(userId, agentType)
    Auth->>MongoDB: atomic decrement (credits >= cost)
    MongoDB-->>Auth: updated balance
    Auth-->>Agent: { success, reservationId }

    alt Success
        Agent->>Auth: refundCredits(userId, reservationId)
        Auth->>MongoDB: atomic increment
    else Failure
        Agent->>Auth: refundCredits(userId, reservationId)
        Auth->>MongoDB: atomic increment
    end

    Agent-->>Gateway: { answer, images, artifacts }
    Gateway-->>Client: response
```

## Adaptive PDF RAG Pipeline

```mermaid
graph TD
    UPLOAD["Upload PDF<br/>max 20MB, UUID filename"]
    EXTRACT["PDFParse text extraction"]
    CHECK_TEXT{Text length<br/>< 150 chars?}
    VISION_OCR["Gemini Vision OCR<br/>up to 10 pages @ 2x scale"]
    CHECK_SIZE{Text length<br/>< 2500 chars?}
    SINGLE_CHUNK["Single chunk<br/>preserve tables"]
    CHUNKS["RecursiveCharacterTextSplitter<br/>800 char chunks, 100 overlap"]
    EMBEDDINGS["Generate Embeddings<br/>BAAI/bge-small-en-v1.5"]
    QDRANT["Store in Qdrant<br/>collection: pdf-{timestamp}"]
    CHECK_SUMMARY{Summary<br/>request?}
    SLICE["First 40k chars"]
    RETRIEVE["similaritySearch<br/>top 10 chunks"]
    ANSWER["Gemini 2.5 Flash<br/>answer generation"]
    CLEANUP["Delete Qdrant collection<br/>Delete temp file"]
    RESPONSE["Return answer"]

    UPLOAD --> EXTRACT
    EXTRACT --> CHECK_TEXT
    CHECK_TEXT -->|"Yes / Scanned"| VISION_OCR
    CHECK_TEXT -->|"No / Digital"| CHECK_SIZE
    VISION_OCR --> CHECK_SIZE
    CHECK_SIZE -->|"Yes"| SINGLE_CHUNK
    CHECK_SIZE -->|"No"| CHUNKS
    SINGLE_CHUNK --> EMBEDDINGS
    CHUNKS --> EMBEDDINGS
    EMBEDDINGS --> QDRANT
    QDRANT --> CHECK_SUMMARY
    CHECK_SUMMARY -->|"Yes"| SLICE
    CHECK_SUMMARY -->|"No"| RETRIEVE
    SLICE --> ANSWER
    RETRIEVE --> ANSWER
    ANSWER --> CLEANUP
    CLEANUP --> RESPONSE
```

**Libraries:**
- `pdf-parse` for text extraction
- `pdfjs-dist` bundled for page screenshots (vision OCR)
- `@langchain/textsplitters` for chunking

## AI Provider Routing

```mermaid
graph LR
    subgraph Agent_Service["Agent Service :8003"]
        GET_MODEL["getModel(agent)"]
        GROQ["ChatGroq<br/>openai/gpt-oss-120b"]
        GEMINI["ChatGoogleGenerativeAI<br/>gemini-2.5-flash"]
        HF["HuggingFace<br/>FLUX.1-schnell"]
    end

    GET_MODEL -->|"chat, search"| GROQ
    GET_MODEL -->|"coding, imageAnalyzer<br/>vision-ocr, pdf-rag"| GEMINI
    GET_MODEL -->|"vision"| HF
```

Provider selection is hardcoded per agent via `getModel()` factory. No runtime fallback exists.

## CI/CD Pipeline

### GitHub Actions Workflow

```mermaid
graph TB
    PUSH["Push to main<br/>branch"]
    CHECKOUT["Checkout code"]
    AWS_CREDS["Configure AWS<br/>credentials"]
    ECR_LOGIN["Login to ECR"]
    BUILD_GW["Build Gateway<br/>docker build"]
    BUILD_AUTH["Build Auth<br/>docker build"]
    BUILD_CHAT["Build Chat<br/>docker build"]
    BUILD_AGENT["Build Agent<br/>docker build"]
    BUILD_BILL["Build Billing<br/>docker build"]
    PUSH_GW["Push gateway<br/>latest"]
    PUSH_AUTH["Push auth-service<br/>latest"]
    PUSH_CHAT["Push chat-service<br/>latest"]
    PUSH_AGENT["Push agent-service<br/>latest"]
    PUSH_BILL["Push billing-service<br/>latest"]
    DEPLOY_GW["Deploy Gateway<br/>ECS force-new-deployment"]
    DEPLOY_AUTH["Deploy Auth<br/>ECS force-new-deployment"]
    DEPLOY_CHAT["Deploy Chat<br/>ECS force-new-deployment"]
    DEPLOY_AGENT["Deploy Agent<br/>ECS force-new-deployment"]
    DEPLOY_BILL["Deploy Billing<br/>ECS force-new-deployment"]

    PUSH --> CHECKOUT
    CHECKOUT --> AWS_CREDS
    AWS_CREDS --> ECR_LOGIN
    ECR_LOGIN --> BUILD_GW
    BUILD_GW --> PUSH_GW
    PUSH_GW --> BUILD_AUTH
    BUILD_AUTH --> PUSH_AUTH
    PUSH_AUTH --> BUILD_CHAT
    BUILD_CHAT --> PUSH_CHAT
    PUSH_CHAT --> BUILD_AGENT
    BUILD_AGENT --> PUSH_AGENT
    PUSH_AGENT --> BUILD_BILL
    BUILD_BILL --> PUSH_BILL
    PUSH_BILL --> DEPLOY_GW
    DEPLOY_GW --> DEPLOY_AUTH
    DEPLOY_AUTH --> DEPLOY_CHAT
    DEPLOY_CHAT --> DEPLOY_AGENT
    DEPLOY_AGENT --> DEPLOY_BILL
```

### ECS Deployment Topology

```mermaid
graph TB
    subgraph AWS_VPC["AWS VPC"]
        subgraph ECS_Cluster["ECS Cluster (Fargate)"]
            GW_TASK["Gateway Task"]
            AUTH_TASK["Auth Task"]
            CHAT_TASK["Chat Task"]
            AGENT_TASK["Agent Task"]
            BILL_TASK["Billing Task"]
        end

        ALB["Application Load Balancer"]
        SG_ALB["ALB Security Group"]
        SG_ECS["ECS Security Group"]
        ECR["ECR Registry"]
        REDIS["ElastiCache Redis"]
        S3["S3 Bucket<br/>PDF/Image Storage"]
    end

    subgraph Amplify["AWS Amplify"]
        AMPLIFY["Frontend<br/>React SPA"]
    end

    Internet["Internet"] --> AMPLIFY
    AMPLIFY --> ALB
    ALB --> GW_TASK
    ALB --> SG_ALB
    SG_ALB --> SG_ECS
    SG_ECS --> AUTH_TASK
    SG_ECS --> CHAT_TASK
    SG_ECS --> AGENT_TASK
    SG_ECS --> BILL_TASK

    GW_TASK --> AUTH_TASK
    GW_TASK --> CHAT_TASK
    GW_TASK --> AGENT_TASK
    GW_TASK --> BILL_TASK

    AUTH_TASK --> REDIS
    CHAT_TASK --> REDIS
    AGENT_TASK --> REDIS
    AGENT_TASK --> S3

    ECR --> GW_TASK
    ECR --> AUTH_TASK
    ECR --> CHAT_TASK
    ECR --> AGENT_TASK
    ECR --> BILL_TASK
```

**Workflow details:**
- Trigger: Push to `main` branch
- Tag strategy: `latest` only (no commit SHA)
- Deployment: `aws ecs update-service --force-new-deployment` (no stability wait)
- Amplify frontend: Managed separately via Amplify console

**Required GitHub Secrets:**
```
AWS_REGION, AWS_ACCOUNT_ID, AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY
ECS_CLUSTER, GATEWAY_SERVICE, AUTH_SERVICE, CHAT_SERVICE, AGENT_SERVICE, BILLING_SERVICE
```

## Local Development

### Start Redis
```bash
cd backend && docker compose up -d redis
```

### Start Backend Services
```bash
cd backend/gateway && node index.js          # :8000
cd backend/services/auth && node index.js    # :8001
cd backend/services/chat && node index.js     # :8002
cd backend/services/agent && node index.js    # :8003
cd backend/services/billing && node index.js  # :8004
```

### Start Frontend
```bash
cd frontend && npm install && npm run dev    # :5173
```

## Environment Variables

### Gateway (`backend/gateway/.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | Service port (8000) |
| `AUTH_SERVICE` | Auth service URL |
| `CHAT_SERVICE` | Chat service URL |
| `AGENT_SERVICE` | Agent service URL |
| `BILLING_SERVICE` | Billing service URL |
| `FRONTEND_URL` | Frontend URL for CORS |
| `REDIS_URL` | Redis connection URL |
| `INTERNAL_API_SECRET` | Shared secret for service-to-service auth |

### Auth Service (`backend/services/auth/.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | Service port (8001) |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection URL |
| `INTERNAL_API_SECRET` | Shared secret |
| `COOKIE_SECURE` | Secure cookie flag (false for local dev) |
| `COOKIE_SAMESITE` | SameSite attribute (lax) |

### Chat Service (`backend/services/chat/.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | Service port (8002) |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection URL |
| `INTERNAL_API_SECRET` | Shared secret |

### Agent Service (`backend/services/agent/.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | Service port (8003) |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection URL |
| `INTERNAL_API_SECRET` | Shared secret |
| `CHAT_SERVICE` | Chat service URL |
| `AUTH_SERVICE` | Auth service URL |
| `GROQ_API_KEY` | Groq API key |
| `GOOGLE_API_KEY` | Gemini API key |
| `OPENROUTER_API_KEY` | OpenRouter API key (unused) |
| `TAVILY_API_KEY` | Tavily search API key |
| `HF_TOKEN` | HuggingFace token |
| `HUGGINGFACEHUB_API_KEY` | HuggingFace API key (embeddings) |
| `QDRANT_URL` | Qdrant server URL |
| `QDRANT_API_KEY` | Qdrant API key |
| `AWS_REGION` | AWS region |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_KEY` | AWS secret key |
| `AWS_BUCKET_NAME` | S3 bucket name |

### Billing Service (`backend/services/billing/.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | Service port (8004) |
| `MONGODB_URI` | MongoDB connection string |
| `AUTH_SERVICE` | Auth service URL |
| `INTERNAL_API_SECRET` | Shared secret |
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret |

### Frontend (`frontend/.env`)
| Variable | Description |
|----------|-------------|
| `VITE_SERVER_URL` | Backend gateway URL |
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_RAZORPAY_KEY_ID` | Razorpay key ID |

## Repository Structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml              # ECS deployment workflow
├── backend/
│   ├── gateway/                    # Express API gateway (port 8000)
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── index.js
│   │   └── Dockerfile
│   ├── services/
│   │   ├── auth/                   # Auth + credit ledger (port 8001)
│   │   │   ├── controllers/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── index.js
│   │   │   └── Dockerfile
│   │   ├── chat/                   # Conversations + messages (port 8002)
│   │   │   ├── controllers/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── index.js
│   │   │   └── Dockerfile
│   │   ├── agent/                  # LangGraph + AI agents (port 8003)
│   │   │   ├── agents/            # chat, search, coding, pdf, ppt, vision, pdfRag, imageAnalyzer
│   │   │   ├── config/           # llmModels, memory, agentLimit, tavily, s3, embeddings, vectorDb
│   │   │   ├── graph/            # graph.js, router.js, state.js
│   │   │   ├── controllers/
│   │   │   ├── utils/
│   │   │   ├── index.js
│   │   │   └── Dockerfile
│   │   └── billing/               # Razorpay integration (port 8004)
│   │       ├── controller/
│   │       ├── models/
│   │       ├── routes/
│   │       ├── index.js
│   │       └── Dockerfile
│   ├── shared/
│   │   ├── auth/                  # internalAuth.js (requireInternal, requireUser)
│   │   ├── config/                # agentCosts.js, plans.js
│   │   ├── http/                  # cookies.js
│   │   └── redis/                 # redis.js
│   ├── docker-compose.yml          # Redis container
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── pages/                 # Home, AuthPage
│   │   ├── features/              # Redux API calls (sendMessage, getMessages, etc.)
│   │   ├── redux/                 # userSlice, conversationSlice, messageSlice
│   │   ├── contexts/
│   │   ├── hooks/
│   │   └── utils/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Security Model

| Threat | Mitigation |
|--------|------------|
| Identity forgery | `x-user-id` written by gateway only; client-supplied headers stripped |
| Session fixation | New login invalidates previous Redis session; UUID v4 format validation |
| Credit theft | Credits debited before provider call; atomic `credits >= cost` conditional update |
| Credit inflation | `refundCredits` requires valid UUID v4 `reservationId` |
| Payment replay | `status: "created"` compare-and-swap; HMAC signature + capture verification |
| Internal route exposure | Internal routes not proxied by gateway; require `x-internal-secret` header |
| Path traversal | Filenames are UUIDs; extension from allowlist mimetype only |
| Script injection | DOMPurify sanitize on HTML; sandboxed iframe without `allow-same-origin` |

## Credit Costs

| Agent | Cost |
|-------|------|
| chat | 1 |
| search | 5 |
| coding | 10 |
| pdf | 10 |
| ppt | 10 |
| vision | 10 |
| pdfRag | 10 |
| imageAnalyzer | 10 |

## Rate Limits (per user)

| Agent | Limit |
|-------|-------|
| chat | 20/min |
| coding | 5/min |
| pdf | 5/min |
| search | varies |

## Operational Notes

- **Health endpoints:** Each service exposes `GET /` returning `{message: "Hello from <service>"}`
- **Redis:** Used for sessions (24h TTL), conversation memory (24h sliding window, last 20 messages), rate limiting
- **S3:** Presigned URLs for upload/download (10 min expiry for downloads)
- **ECS deployment:** Uses `latest` tag; `--force-new-deployment` with no stability wait
- **Qdrant collections:** Created per PDF RAG request, deleted after response
- **Frontend:** AWS Amplify auto-deploys from repository main branch
