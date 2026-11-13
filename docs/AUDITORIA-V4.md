# Auditoria e decisões da continuação

Fontes: ZIP BellaPelle-Responsivo-v3, DER anexado e PDF Anteprojeto e Proposta Comercial (cinco páginas), lido na etapa inicial. Os 14 módulos e sua ordem de dependências foram mantidos.

## Estado encontrado

A v3 continha o portal de clientes responsivo (busca, favoritos, agendamentos), APIs de reserva e schema MySQL com exemplos. Não equivalia ao sistema administrativo integral. A autenticação era demonstrativa e vinculada a um cliente local. Não existiam os fluxos administrativos completos de anamnese, financeiro, estoque, comissão e controle de equipe.

Na retomada, a v4 estava parcialmente escrita: faltavam o dispatcher de domínio, os relatórios e o componente principal do painel. A rota da API e a página administrativa importavam esses arquivos ausentes. A conclusão de atendimento consultava FotoAtendimento, enquanto a migration criava FotoClinica. Foram corrigidas essas falhas, os tipos de dados de remarcação e valores divergentes de enums entre formulário e backend.

## Arquitetura preservada

Next.js serve React e REST. mysql2 usa consultas parametrizadas, transações e pool de dez conexões. O catálogo de recursos fornece formulários e whitelist de tabelas/colunas. Regras críticas ficam em operations.ts; componentes não fazem SQL. Não foi introduzido Express/Prisma pois não eram parte da aplicação funcional e duplicariam o stack. TypeScript strict foi mantido.

O cliente administrativo usa fetch com estado React, cancelamento lógico de respostas antigas, debounce e atualização após mutations. React Hook Form/TanStack Query eram preferências condicionais de stack; não foram adicionados à base existente nesta continuação. O calendário usa componentes próprios.

## Alterações implementadas

- Painel administrativo com autenticação, navegação por recursos, formulários, pesquisa, paginação, ordenação, filtros de período/situação, calendário e exportação CSV.
- Perfis de acesso, sessões com cookies HttpOnly, CSRF/origem, hash scrypt, recuperação por token de uso único, auditoria e gerenciamento de usuários.
- Cadastro e desativação de entidades principais; anamneses acrescentadas sem edição destrutiva; histórico por cliente.
- Venda de pacote e parcelamento, cobranças avulsas, recebimentos parciais, cancelamento e estorno internos.
- Agenda validada no backend e serializada por lock transacional, com conflitos de cliente/profissional/sala/equipamento.
- Atendimento, sessão, produtos e comissão integrados na mesma transação. Repetição da conclusão não repete efeitos.
- Fotos privadas, consentimento, limites de bytes/pixels, decodificação e recodificação sem metadados pelo Sharp.
- Relatórios reais, dashboard, migrations, configuração Docker sem credenciais fixas, testes e pipeline.

## Decisões explícitas de negócio

Faltas/cancelamentos não consomem sessões. Somente conclusão consome. Não há multa automática; uma política diferente exige aprovação da clínica e implementação versionada. Sessões disponíveis ficam reservadas por agendamentos pendentes/confirmados; não se permite reservar acima do saldo. Pacotes estornados, vencidos ou esgotados são bloqueados.

Comissão usa o valor da sessão congelado no agendamento e o percentual vigente na conclusão, gravando base, percentual e valor histórico. Em pacote, a base unitária é o valor contratado dividido pelas sessões com truncamento ao centavo; frações residuais não aumentam a base de comissão. Isso deve ser homologado pela clínica. O pagamento de comissão requer recebimento integral. Estorno com comissão já paga é bloqueado para conciliação; comissões pendentes são canceladas no estorno.

Sem disponibilidade semanal cadastrada, o profissional não tem restrição adicional de jornada; conflitos e bloqueios continuam obrigatórios. Uma anamnese inicial pode ser registrada por administrador antes do primeiro agendamento; profissional acessa somente clientes vinculados à sua agenda. Não se produzem diagnósticos automáticos.

Datas civis são DATE; instantes são DATETIME UTC. Conexões configuram UTC. A interface apresenta America/Sao_Paulo. Inputs de data/hora usam -03:00, correspondente ao fuso de São Paulo nas datas atuais; eventual mudança futura de horário legal exigirá ajuste de conversão.

## Preservação e limitações

Esta observação descreve a versão histórica v4: no projeto atual não há mais layout separado em `/portal`; essa rota redireciona para o site público em `/`. Os documentos e imagens de validação anteriores em docs são históricos, não evidência de QA da versão atual. Consulte o README para as instruções vigentes.
