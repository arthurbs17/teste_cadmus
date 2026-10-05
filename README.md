# Account Aggregation Sync

Serviço de agregação de contas (Open Finance): sincronização assíncrona e idempotente de lançamentos de
instituições parceiras e API de extrato consolidado. Código do teste técnico Backend Node.js / Nest.js Pleno.

## Stack

Node.js 24 · Nest.js 12 · Prisma 7 + PostgreSQL 17 · RabbitMQ 4 (quorum queues) · Pino · Prometheus

## Arquitetura (hexagonal)

```
src/
  domain/          regras puras: normalização, identidade do lançamento, checkpoint, erros
  application/
    ports/         contratos (PartnerGateway, SyncRunRepository, ConsentLease, SyncMetrics...)
    use-cases/     SyncConsentUseCase, ListTransactionsUseCase
  adapters/
    inbound/       RabbitMQ consumer (retry/DLQ) e HTTP controllers
    outbound/      Prisma, HTTP da parceira, Pino, Prometheus
  modules/         composição Nest (DI dos ports)
  main.api.ts      processo da API
  main.worker.ts   processo do consumidor
```

`domain` não depende de nada; `application` depende só de `domain`; Nest, Prisma, RabbitMQ e HTTP ficam nos adapters.

## Garantias principais

| Problema do incidente               | Como o código trata                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Mensagem entregue mais de uma vez   | `UNIQUE (account_id, external_transaction_id)` + `INSERT ... ON CONFLICT DO UPDATE ... WHERE content_hash <> EXCLUDED.content_hash` |
| Dois workers no mesmo consentimento | Lease com expiração em `consents` (token por execução), renovado a cada página                                                      |
| 429 da parceira                     | Interrompe, salva checkpoint, reagenda respeitando `Retry-After` (fila de espera com TTL)                                           |
| Falha no meio da sincronização      | Página + checkpoint na mesma transação; retomada do cursor; `last_synced_at` só avança no sucesso                                   |
| Mensagens que falham para sempre    | Backoff exponencial com jitter, limite de tentativas e DLQ                                                                          |
| Listagem lenta                      | Paginação keyset `(booked_at, id)` + índice composto criado com `CREATE INDEX CONCURRENTLY`                                         |
| Sem rastreabilidade                 | Logs JSON com `correlationId`, `syncRunId`, `consentId`, `institutionId`, `attempt`; tabela `sync_runs`                             |
| Sem métrica de negócio              | `sync_runs_total{outcome}`, `consent_sync_staleness_seconds`, `partner_rate_limited_total`, `sync_messages_total`                   |

## Como rodar

```bash
cp .env.example .env
docker compose up -d --build
```

- API: `GET http://localhost:${API_PORT}/customers/:customerId/transactions?limit=50&cursor=...`
- Health / métricas: `/health` e `/metrics` na API (`API_PORT`) e no worker (`WORKER_PORT`)
- RabbitMQ management: `http://localhost:${RABBITMQ_MANAGEMENT_PORT}`

Mensagem de sincronização (fila `sync.consent`):

```json
{ "consentId": "<uuid>", "correlationId": "<opcional>" }
```

Nenhuma credencial fica no código ou no compose: tudo vem do `.env` (fora do git) e é validado na
inicialização (`src/config/env.ts`).
