# Limites do aceite e pendências de homologação

O projeto atual usa um único site público em `/` e o dashboard em `/admin`. O conteúdo de procedimentos, profissionais, avaliações consentidas e blog usa MySQL; favoritos e solicitações de privacidade estão disponíveis na área do cliente. A validação desta atualização executou typecheck, lint e build, mas não certifica todos os critérios de produção.

- **Docker:** subir e homologar Compose no Docker Desktop/servidor, incluindo permissões do volume de fotos. O executor não dispõe de Docker; MySQL, API e aplicação foram testados diretamente.
- **SMTP:** configurar credenciais e validar entrega, TLS e política do provedor. O worker está implementado; transporte externo não foi testado. Não há confirmação fictícia de envio.
- **Regras da clínica:** homologar base/arredondamento de comissões, política de faltas, validade dos pacotes, disponibilidade padrão e processo de estorno. A política segura inicial de faltas não desconta sessões.
- **Dados reais:** homologar migração em cópia protegida, backup/restauração e acesso aos arquivos privados antes de implantação. Não aplicar sobre produção sem revisão do estado das migrations.
- **Segurança/LGPD:** definir responsáveis, base legal, retenção e atendimento das solicitações. Há controles técnicos, mas não se afirma conformidade jurídica plena. Não há anonimização automática de prontuário com histórico relacionado.
- **Cobertura:** os testes priorizam os fluxos de maior risco. Falta cobertura E2E exaustiva de todos os formulários, fotos, concessão/revogação de permissões e erros de rede, auditoria WCAG completa, carga e pentest.
- **Documentação da API:** OpenAPI descreve recursos e operações; contratos complementares estão em CONTRATO-V4 e PORTAL-API. Schemas detalhados de todas as respostas e payloads especiais ainda podem ser ampliados.

PIX/cartão são métodos de registro financeiro interno. Integração de cobrança externa não faz parte da entrega sem provedor/credenciais e não é apresentada como concluída.
