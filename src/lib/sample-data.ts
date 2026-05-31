import type { DocumentInput } from "./rag";

export const defaultDocuments: DocumentInput[] = [
  {
    id: "resume-nouman",
    title: "Muhammad Nouman Rana CV",
    kind: "resume",
    text: `Muhammad Nouman Rana — Senior Full-Stack Engineer (React/Next.js, Node/NestJS, TypeScript, PostgreSQL). Milan, Italy. muhammadnoumanrana103@gmail.com · linkedin.com/in/nouman-rana-dev · github.com/muhammadnoumandev4.

Professional summary: Senior Full-Stack Engineer with 5+ years shipping production web platforms across fintech, real estate, and blockchain domains. Currently leading full-stack delivery for a multi-tenant SaaS serving 50+ global brands — owning backend (NestJS, Node.js, PostgreSQL, Prisma, Redis) and frontend (React, Next.js, TypeScript) at scale, with 25-30% measured performance gains on latency-critical systems. Strong cross-functional collaborator with hands-on experience in REST APIs, GraphQL, microservices, CI/CD, and exploring AI/LLM integration into modern backends.

Senior Full-Stack Engineer, Authentica Group (Authentica DPP, WoV Labs, World of V NFT Marketplace), Aug 2025 - Present, Remote. Built and shipped a multi-tenant SaaS platform from greenfield — the Authentica Digital Product Passport — implementing row-level security with tenant_id and Prisma middleware for tenant context injection that scaled cleanly from 1 to 50+ brand tenants without architectural rewrites. Owned backend (NestJS, Node.js, PostgreSQL, Prisma, Redis) and frontend (Next.js, React, TypeScript) end-to-end. Drove a 30% reduction in database query latency by profiling production queries with EXPLAIN ANALYZE, applying targeted indexes and query restructuring. Built 6 core modules from scratch: product passport creation, NFC tag integration, analytics dashboard, subscription management, email-verification pipelines, and BullMQ-powered real-time push notifications. Rebuilt the WoV Labs NFC Panel frontend in Next.js/React/TypeScript and integrated VeChain blockchain for end-to-end NFC chip lifecycle management. Delivered features for the World of V zero-fee NFT marketplace — a NestJS microservices architecture with GraphQL APIs and Kubernetes deployment.

Freelance Full-Stack Engineer, Independent Consultant (Upwork, Fiverr, PeoplePerHour, Freelancer, Guru), Feb 2025 - Jul 2025, Remote. Delivered full-stack development, data engineering, database administration, and AI/ML integration to international clients. Built and integrated Retrieval-Augmented Generation (RAG) pipelines using Large Language Models (LLMs) including OpenAI GPT and Anthropic Claude with client knowledge bases — delivering grounded, citable retrieval. Worked with Python-based AI backends for image and video generation workflows using LLM APIs. Engineered relational data layers and ETL pipelines (PostgreSQL, MySQL): schema design, query optimisation, indexing, backups, and performance tuning. Integrated third-party APIs (payment gateways, auth providers) and managed deployments to client servers and cloud (AWS, Vercel, Docker).

Software Engineer, i2c Inc. (Fintech / Payments), Jun 2023 - Jan 2025, Onsite. Contributed to 4 enterprise payment products (C-Holder, C-Cart, C-Agent, C-Manager) ensuring security, stability, and performance. Implemented RESTful APIs, improved code quality, and shipped fixes that raised reliability. Designed a parameterised configuration structure that improved system flexibility and simplified client-specific deployments. Partnered with Business Analysts for Client-Specific Development following SDLC best practices.

Associate Software Engineer, dubizzle Labs (Zameen.com / Bayut.com — Propforce), Jul 2022 - May 2023, Hybrid. Built features for Propforce, a property management platform serving 500+ daily active agents, on a React frontend and Node.js/Express backend with Sequelize ORM and MySQL. Developed RESTful APIs for real-time property transactions, built reusable React components, optimised MySQL queries, and authored migrations in an Agile/Scrum environment.

Junior Software Engineer, TechBatch, Apr 2021 - Jun 2022, Onsite. Built and maintained web application features using React, Node.js/Express, and MySQL, including reusable component libraries and REST API integrations; participated in full Agile sprint cycles and Git-based version control.

Technical skills. Frontend: JavaScript, TypeScript, React, Next.js, Redux, Tailwind CSS, HTML5, CSS3, Capacitor, responsive design. Backend & APIs: Node.js, NestJS, Express, REST APIs, GraphQL, WebSockets, Webhooks, Cron Jobs, BullMQ, microservices. Databases & ORMs: PostgreSQL, MySQL, Redis, Prisma, Sequelize, TypeORM, SQL, query optimisation, schema design. Auth & Security: JWT, OAuth 2.0, Auth0, Okta, authentication, authorization, RBAC. Cloud & DevOps: AWS, Vercel, Docker, Kubernetes, CI/CD, Jenkins, GitHub Actions, Linux. Testing & Tools: Jest, Cypress, Postman, Swagger, unit testing, integration testing, Git, GitHub, Bitbucket, Jira, Agile, Scrum. Languages: TypeScript, JavaScript, Python, SQL, Java. AI & Blockchain: Large Language Models (LLMs), OpenAI GPT, Anthropic Claude, Retrieval-Augmented Generation (RAG), VeChain, Web3, NFT.

Education: M.Sc. Data Science, Università degli Studi di Milano-Bicocca (thesis stage, expected 2026); B.Sc. Software Engineering, University of Punjab.`,
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
    id: "jd-fintech-platform",
    title: "Northbridge Fintech Senior Full-Stack JD",
    kind: "job",
    text: `Northbridge Financial is hiring a Senior Full-Stack Engineer for a remote role on its digital payments platform. The team ships customer-facing dashboards and internal tooling for card issuing, transaction processing, and merchant onboarding.

You will build and own features end-to-end across a Next.js and React frontend in TypeScript and a Node.js backend organised as microservices. The API layer is REST and GraphQL, and services communicate over well-defined contracts. You will design relational data models in PostgreSQL, tune slow queries, add appropriate indexes, and use Redis for caching and rate limiting. Prisma is the ORM of record.

The platform runs containerised on AWS with Docker, and deployments go through a CI/CD pipeline using GitHub Actions. We expect strong production ownership: structured logging, metrics, distributed tracing, and proactive monitoring of latency-critical payment flows so regressions are caught before customers feel them.

Required background includes 5+ years building production web applications, deep TypeScript across frontend and backend, Node.js microservices, PostgreSQL performance tuning, REST and GraphQL API design, and cloud-native deployment with Docker and CI/CD. Experience in fintech, payments, or other regulated, high-reliability domains is strongly preferred.`,
  },
];
