# Validação da API v2

- TypeScript estrito: aprovado.
- Build Next.js de produção: aprovado.
- Cinco testes de regras de domínio: aprovados.
- Integração com servidor MySQL: NÃO executada neste ambiente (sem servidor MySQL/Docker).
- O teste `npm run test:api` está incluído para execução com o banco ativo; valida persistência e duas reservas concorrentes, entre outros casos. Sua presença não significa que passou neste ambiente.
- A API não inclui autenticação de produção, cobrança financeira, envio de e-mail ou conclusão clínica. O acesso demonstrativo identifica explicitamente o Cliente 1 e só é habilitado em host local por configuração.
- Os screenshots em docs são gerados em modo demo, e não comprovam execução SQL.
- E2E Chromium: aprovado para o fluxo demo (busca, favorito persistente, reserva, reagendamento e cancelamento).
- Contrato frontend/API v2: aprovado com respostas HTTP simuladas para catálogo de cinco procedimentos, histórico concluído, profissional dinâmico e chamada de disponibilidade com treatmentId=4. Este teste verifica a interface, não a execução de SQL.

## Versão 3 — responsividade

- Build de produção e TypeScript: aprovados.
- Testes de domínio: aprovados.
- Fluxo responsivo demo: aprovado em 320, 390, 600, 768, 1024, 1366, 1440 e 1920 px.
- Verificados: início, busca, detalhe, modal, confirmação, sucesso, agendamentos e favoritos; ausência de overflow horizontal; ação de agendamento abaixo dos horários em telas maiores.
- Regressão mobile: reserva, persistência de favorito, reagendamento e cancelamento aprovados.
- Capturas em docs/responsive; revisão visual de tablet e notebook/desktop.
- Ambiente: Chromium. Não executados Safari, Firefox ou aparelhos físicos.
- O Chromium especial deste ambiente encerrou ao alternar contextos; os testes mobile e responsivo passaram em execuções separadas. Uma falha de bootstrap do compilador de desenvolvimento foi contornada usando webpack na configuração E2E.
- Sem nova execução de integração MySQL; backend preservado da v2.
