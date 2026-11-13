# Contrato interno de implementação v4

Manter Next App Router + mysql2 + Zod. Administração em /admin; portal original preservado em /.
API administrativa /api/clinic/[...path]. JSON sem envelope, erros {error:string,code?:string}, status apropriado.

Actor exportado por lib/clinic/permissions.ts: {id:number,nome:string,email:string,perfil:string,id_profissional:number|null,permissions:string[]}.
Permissões resource:read/resource:write e especiais clinical:read,clinical:write,finance:read,finance:write,stock:read,stock:write,reports:read,users:write; servidor verifica cada operação.

Autenticação GET /auth/session -> {user:Actor,csrfToken:string}; POST /auth/login {email,password} mesma resposta; POST /auth/logout; POST /auth/forgot {email}; POST /auth/reset {token,password}. Cookie HttpOnly e CSRF no header X-CSRF-Token em mutações autenticadas. Origin precisa bater APP_ORIGIN.

Serviço domínio exporta dispatchClinic(request,segments,user):Promise<unknown>. Serviço autenticação/rota chama este dispatcher após autenticar/validar CSRF. Operações em transações Mysql reais. Valores monetários são strings decimais na API.

GET /meta -> {resources:[{key,label,pk,fields:[{name,label,type,required?,options?:{value:string,label:string}[],reference?:string}],writable:boolean}],actions?:unknown}. Front pode usar metadata para formulários genéricos e dropdowns pesquisáveis de referências.
GET /:resource -> {items:Record<string,unknown>[],total,page,pageSize}; query search,page,pageSize,sort,direction,cliente,profissional,procedimento,status,from,to. GET /:resource/:id -> registro; POST cria; PATCH atualiza; DELETE desativa quando cabível (históricos imutáveis).
Recursos: clientes,profissionais,procedimentos,salas,equipamentos,habilitacoes,disponibilidades,bloqueios,anamneses,pacotes,pacotes-clientes,pagamentos,parcelas,agendamentos,atendimentos,produtos,movimentacoes,comissoes,faltas.
GET /reports?kind=faturamento|pagamentos|comissoes|atendimentos|procedimentos|pacotes|vencimentos|sessoes|faltas|estoque|produtos&from=&to= -> {items,columns:string[]}; GET /dashboard?from=&to= indicadores reais.

POST /operations/vender-pacote {id_cliente,id_pacote,numero_parcelas,forma_pagamento,data_compra,data_vencimento} -> {id_pacote_cliente,id_pagamento}.
POST /operations/agendar {id_cliente,id_profissional,id_procedimento,id_sala,id_equipamento?,id_pacote_cliente?,data_hora_inicio,origem_solicitacao} -> {id_agendamento} (inicio ISO com offset, armazena UTC).
POST /operations/reagendar {id_agendamento,data_hora_inicio,motivo}.
POST /operations/status-agenda {id_agendamento,status:confirmado|cancelado|nao_compareceu,motivo}.
POST /operations/iniciar-atendimento {id_agendamento} -> {id_atendimento}.
POST /operations/concluir-atendimento {id_agendamento,regiao_corpo_tratada,parametros_utilizados,descricao_evolucao,produtos:[{id_produto,quantidade:string}]} -> {id_atendimento}; idempotente por agendamento, transacional saldo/estoque/comissão.
POST /operations/receber-parcela {id_parcela,valor:string} e /estornar-pagamento {id_pagamento,motivo}; /cancelar-pagamento {id_pagamento,motivo}.
POST /operations/movimentar-estoque {id_produto,tipo:entrada|saida,quantidade:string,motivo}.
POST /operations/pagar-comissao {id_comissao}.

Frontend inclui formulários específicos para operações, calendário dia/semana/mês, filtros, detalhes do cliente e CRUD conforme permissões. Anamnese append-only; sem exposição para recepção. Profissional só acessa clientes de sua agenda e seus prontuários.
Scripts migration/seed separados; nunca seed automático em produção. Preserve esquema legado via migrações aditivas. Sem credenciais fixas; administrador inicial via env. Pendências de política: falta NÃO consome sessão por padrão; comissões apuradas no atendimento concluído sobre valor da sessão congelado; pagamento de comissão exige recebimento correspondente. Fotos precisam consentimento e armazenamento privado.
