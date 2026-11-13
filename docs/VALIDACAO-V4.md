# Validação efetivamente executada — 14/10/2026

| Verificação | Resultado |
|---|---|
| TypeScript strict | Aprovado |
| Build Next.js de produção | Aprovado; saída standalone gerada |
| Testes unitários (regras e segurança) | 16 aprovados, zero falhas |
| Inicialização MySQL | MySQL Community 8.4.11 real, base temporária isolada |
| Migrations 001, 002, 003, 004 | Aplicadas em banco vazio |
| Testes de integração de domínio | 10 cenários aprovados |
| API HTTP com aplicação e MySQL | 7 verificações aprovadas |
| E2E Playwright | Não validado: Chromium SIGSEGV na inicialização |
| Docker Compose | Não executado: Docker ausente |
| npm ci em ambiente limpo | Não executado |

Integração verifica: cadastros e habilitação, CPF único, bloqueio de acesso clínico/financeiro, parcelamento sem perda de centavos, duas reservas simultâneas (apenas uma aceita), rollback da sessão por estoque insuficiente, duas conclusões simultâneas (um atendimento/sessão/baixa/comissão), comissão condicionada a recebimento integral, dashboard reconciliado com recebimentos e consultas dos onze relatórios.

HTTP verifica: acesso anônimo 401, origem incorreta 403, login real, cookie HttpOnly, leitura autenticada dos dados persistidos, mutação sem CSRF bloqueada e invalidação da sessão no logout. O teste contabiliza sete grupos de verificações.

Arquivos: tests/clinic-rules.test.ts, tests/security.test.ts, tests/domain.test.ts (legado), tests/clinic-integration.ts, tests/clinic-http.mjs, tests/admin/workflow.spec.ts. Nenhum teste E2E foi marcado como aprovado. Os screenshots antigos em docs/responsive pertencem à versão v3.
