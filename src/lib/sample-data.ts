import type { DocumentInput } from "./rag";

export const defaultDocuments: DocumentInput[] = [
  {
    id: "resume-nouman",
    title: "Muhammad Nouman Rana CV",
    kind: "resume",
    text: `Muhammad Nouman Rana is a Senior Full-Stack Engineer based in Milan with 5+ years of experience shipping production web platforms across fintech, real estate, blockchain, and SaaS.

Current focus: full-stack delivery for a multi-tenant SaaS serving 50+ global brands. Backend stack includes NestJS, Node.js, PostgreSQL, Prisma, Redis, BullMQ, GraphQL, REST APIs, and microservices. Frontend stack includes React, Next.js, TypeScript, Redux, Tailwind CSS, and responsive application design.

Recent work: built Authentica Digital Product Passport from greenfield with tenant_id row-level isolation, Prisma middleware for tenant context injection, product passport creation, NFC tag integration, analytics dashboards, subscription management, email verification, and real-time push notifications. Reduced database query latency by 30% through EXPLAIN ANALYZE, targeted indexes, and query restructuring.

AI experience: delivered freelance Retrieval-Augmented Generation pipelines using OpenAI GPT and Anthropic Claude against client knowledge bases to provide grounded, citable answers. Worked with Python-based AI backends for image and video generation workflows.

Cloud and operations: deployed to AWS, Vercel, Docker, Kubernetes, GitHub Actions, Jenkins, Linux, and client servers. Experience includes CI/CD, performance tuning, schema design, query optimization, backups, authentication, authorization, JWT, OAuth 2.0, Auth0, Okta, and RBAC.

Other domains: i2c fintech/payment products, Propforce real-estate platform used by 500+ daily active agents, and World of V NFT marketplace using NestJS microservices, GraphQL APIs, Kubernetes, and VeChain blockchain integration.

Education: M.Sc. Data Science at Universita degli Studi di Milano-Bicocca, expected 2026; B.Sc. Software Engineering from University of Punjab.`,
  },
  {
    id: "jd-ai-native-builder",
    title: "Newpage AI-Native Builder JD",
    kind: "job",
    text: `Newpage Solutions is hiring AI-Native Builders and Forward Deployed Engineers for a remote contract role in digital health innovation. The role sits close to clients and product leaders, reframes vague problems into concrete buildable software, and ships working prototypes and production systems end-to-end.

Responsibilities include opportunity discovery, partnering with product/design/client stakeholders, leading POCs and innovation sprints, building modular Python or TypeScript backends aligned with clean architecture, OOP, SOLID, and domain-driven design, and creating full-stack applications, APIs, agents, workflows, and systems with Next.js, React, FastAPI, Fastify, FastMCP, and Hono.

AI engineering expectations include architecting production-grade agentic applications using LangGraph, AutoGen, Claude Agent SDK, OpenAI Assistants, or a custom orchestration layer; integrating Claude, GPT, Gemini, and open-weight models with tools, data, MCP, and custom connectors; applying RAG where useful with Pinecone, Chroma, Weaviate, pgvector, Elasticsearch, Solr, BM25, and similarity search; designing prompt and context engineering frameworks for accuracy, repeatability, cost, and latency.

The role expects active structured use of AI coding tools such as Claude Code, Cursor, GitHub Copilot, and Codex with disciplined workflows, native instructions, templates, sub-agents, review, and maintainability.

Production expectations include eval harnesses, AWS, Azure, Cloudflare, Vercel, Docker, Kubernetes, serverless, TDD, secrets management, SAST/DAST, structured logging, metrics, tracing, automated CI/CD with GitHub Actions or Jenkins, and operational ownership.

Required background includes 3+ years building production applications using AI or agentic development approaches, hands-on agents rather than prompted models only, strong Python or TypeScript, OOP, SOLID, 12-factor apps, microservices, Next.js, FastAPI, vector databases, retrieval pipelines, eval harnesses, cloud-native deployment, clean code, security, observability, scalability, performance, cost awareness, clear writing, recent built projects, and a founder mindset.

Bonus areas include public writing or talks about AI building, MLOps and model serving with BentoML, MLflow, Vertex AI, or SageMaker, streaming and batch ingestion with Spark, Airflow, Beam, or Glue, healthcare or life sciences domain exposure, and AWS Professional certification.`,
  },
  {
    id: "assignment-v3",
    title: "Assignment v3",
    kind: "assignment",
    text: `Assignment: build a full-stack web application. Choose one conversational AI assistant option: Chat With Your Docs, Code Documentation Assistant, Meeting Intelligence System, or Career Intelligence Assistant.

Career Intelligence Assistant option: analyze resumes against job descriptions. Upload a resume and multiple job postings, then answer questions about fit, skill gaps, experience alignment, and interview preparation. Example queries include what skills are missing for this role and how experience aligns with a job.

Submission requirements: GitHub repo with code, README or docs with quick setup, architecture overview, productionization plan for AWS/GCP/Azure/Cloudflare, RAG and LLM decisions, choices considered, final choice for LLM, embedding model, vector database, orchestration framework, prompt and context management, guardrails, quality, observability, key technical decisions, engineering standards followed and skipped, how AI tools were used, what would be done differently with more time, screenshots, and optional video.

Evaluation criteria: core functionality that can answer questions based on uploaded or provided documents using RAG or similar retrieval with a simple interface; creativity in UI/UX and product innovation; thought process around chunking, embedding model and LLM selection, retrieval, prompt engineering, context management, guardrails, quality controls, and observability; engineering excellence through clean readable well-structured code, ideally containerized, tested, and observable; AI-assisted development process including how coding tools were prompted, accepted, changed, and governed.

Interview: 10 minutes to present the approach, demo the working application, discuss findings in the data and how they were handled, and be ready for a small modification after the demo.`,
  },
];
