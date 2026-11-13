# Validação da v5 reconstruída — 15/10/2026

Resultados referentes aos arquivos reconstruídos após recuperação da v4; não reutilizam aprovações da pasta temporária removida.

| Verificação executada | Resultado |
|---|---|
| Instalação npm ci da base e atualização das dependências da v5 | Passou |
| TypeScript strict: npm run typecheck | Passou |
| ESLint: npm run lint | Passou |
| Build de produção Next: npm run build | Passou |
| Unitários: npm test | 16 passaram |
| Migrations 001–005 em MySQL 8.4.11 vazio | Passaram |
| Seed fictício em segundo banco isolado | Passou |
| Integração de domínio: test:integration | 14 cenários passaram |
| HTTP administrativo | 7 verificações passaram |
| HTTP cliente | Fluxo completo abaixo passou |
| Playwright administrativo | 1 cenário passou |
| Playwright cliente | 1 cenário passou |

Integração inclui cadastros, CPF único, RBAC, parcelamento, reserva concorrente, rollback por estoque insuficiente, finalização concorrente idempotente, consumo único de sessão, comissão, recebimento, dashboard e onze relatórios. Casos adicionais: vínculo clínico inicial, falta com e sem consumo, repetição de falta, pacote vencido/sem saldo e pagamento parcial.

HTTP cliente: cadastro, cookie HttpOnly, sessão, isolamento por propriedade, perfil, solicitação de privacidade, disponibilidade, reserva avulsa pendente de pagamento, remarcação, cancelamento, recuperação/ativação por token, invalidação de sessão antiga, rejeição de reutilização do token, login e logout.

Playwright administrativo: login, cadastro persistente de cliente, agenda mensal e logout. Playwright cliente: cadastro, catálogo, seleção de data/horário, reserva persistida, lista de agendamentos, perfil e logout. Ambos verificam ausência de overflow horizontal nas larguras 390, 768, 1366 e 1920. Capturas de teste foram inspecionadas internamente. Isso não equivale a auditoria completa WCAG nem a comparação pixel a pixel de todas as telas.

Chromium 153.0.8010.0 funcionou após extração completa. O modo single-process do binário do executor encerra ao reutilizar contextos; cada arquivo E2E foi executado em processo separado, com todas as asserções preservadas. O script test:e2e:admin reflete esse isolamento.

MySQL foi executado diretamente, pois o executor não possui Docker. Portanto, Dockerfile/Compose foram entregues, mas a subida dos containers não está aprovada por um teste Docker neste ambiente. Também não houve envio real por provedor SMTP, teste de carga, pentest ou homologação da migração de uma base de produção.

Logs da última execução estão em `docs/evidencias/qa-mysql-http-e2e.log`. As senhas de teste foram geradas em memória e não estão no pacote.
