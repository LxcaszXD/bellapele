# Revisão do redesign e integração BellaPelle

## Resultado

- A aplicação tem duas páginas: `/` (site público único) e `/admin` (dashboard). A rota antiga `/portal` redireciona para `/`; login e área do cliente são modais sobre o site público.
- O site público usa a identidade BellaPelle existente (rosa/wine e fontes da marca) com uma estrutura visual refeita: hero, confiança, catálogo filtrável, clínica, equipe, avaliações, chamada de agendamento, blog, FAQ e contato/rodapé. As seções reorganizam o conteúdo em uma hierarquia responsiva, sem criar uma segunda home depois do login.
- A navegação pública não exige conta. Agendamento e área pessoal abrem o modal; o backend identifica automaticamente cliente ou equipe. A autenticação de administrador abre o dashboard.
- O dashboard conserva a gestão clínica e agora administra publicações do blog e avaliações/autorização de publicação.
- O catálogo, profissionais, avaliações e blog são lidos do MySQL por `GET /api/public`. Não há conteúdo fictício inserido como conteúdo público. Avaliações só aparecem após consentimento e publicação explícitos; artigos só aparecem publicados e na data programada.
- Agendamentos usam disponibilidade semanal configurada no banco, duração do procedimento e bloqueios/ocupação. Sem disponibilidade ativa, não são oferecidos horários nem aceito agendamento.
- Favoritos e solicitações de privacidade estão disponíveis na área do cliente autenticada.
- Os estados vazios do catálogo e dos depoimentos ocupam a seção inteira; os carregamentos usam skeletons. O contato oficial é configurável no dashboard, a política abre em diálogo para manter as páginas `/` e `/admin`, e rotas inválidas recebem uma 404 com identidade BellaPelle.
- O calendário e os filtros de relatórios usam nomes de profissionais, salas e procedimentos. O modal do cliente tem carregamento, fechamento pelo fundo, confirmação estilizada de cancelamento e orientação explícita ao remarcar.
- No modal do cliente, os horários aparecem em grade; a escolha mostra um resumo com data, procedimento, duração e valor. Reservas e dados da conta são apresentados em cartões com estados de pagamento e agendamento traduzidos e destacados.

## Inventário das tabelas e uso nas interfaces

| Tabela                     | Uso no sistema                                                                 | Exposição                                                         |
| -------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `Cliente`                  | Cadastro, perfil, vínculo a agendamentos e pagamentos                          | Modal/área do cliente e equipe; dados pessoais nunca são públicos |
| `Profissional`             | Equipe, especialidade, foto e experiência                                      | Campos selecionados no site; gestão no dashboard                  |
| `Procedimento`             | Catálogo, duração, preço, descrição e imagem                                   | Ativos no site e dados completos no dashboard                     |
| `Sala`                     | Recurso exigido para configurar/agendar                                        | Dashboard e operação de agenda                                    |
| `Equipamento`              | Recurso opcional de agenda e estoque de equipamentos                           | Dashboard e operação; não publicado como catálogo                 |
| `ProfissionalProcedimento` | Habilitação profissional e comissão                                            | Dashboard e validação de agendamento                              |
| `Anamnese`                 | Histórico clínico e contraindicações                                           | Acesso clínico autorizado; nunca público                          |
| `Pacote`                   | Pacotes disponíveis para venda pela equipe                                     | Dashboard e financeiro                                            |
| `PacoteCliente`            | Compra, validade e saldo de sessões do cliente                                 | Área pessoal e financeiro/equipe                                  |
| `Agendamento`              | Solicitações, agenda e histórico                                               | Área pessoal do cliente e dashboard                               |
| `Atendimento`              | Registro/evolução do procedimento executado                                    | Área clínica autorizada; nunca público                            |
| `Produto`                  | Lotes, validade, custo e saldo de estoque                                      | Dashboard de estoque                                              |
| `ProdutoAplicado`          | Itens/lotes usados em atendimento                                              | Registro clínico e estoque                                        |
| `MovimentacaoEstoque`      | Entradas e saídas por atendimento                                              | Dashboard de estoque                                              |
| `Pagamento`                | Cobranças da clínica (sem integração externa de cartão/PIX)                    | Financeiro e dados do próprio cliente                             |
| `Parcela`                  | Vencimentos e pagamentos recebidos                                             | Financeiro e dados do próprio cliente                             |
| `Favorito`                 | Procedimentos salvos pelo cliente                                              | Área pessoal autenticada                                          |
| `Avaliacao`                | Nota/comentário pós-agendamento e autorização                                  | Site apenas com consentimento e publicação; gestão no dashboard   |
| `BlogPost`                 | Artigos, resumo, imagem e agendamento de publicação                            | Site apenas quando publicado; CRUD no dashboard                   |
| `ConfiguracaoPublica`      | Telefone, WhatsApp, e-mail, endereço, horário, CNPJ e texto de privacidade     | Contato/rodapé e diálogo de privacidade; edição no dashboard      |
| `SessaoCliente`            | Sessão da API legada                                                           | Compatibilidade técnica; fluxo novo usa `SessaoPortal`            |
| `ControleAgenda`           | Linha de coordenação para serializar operações concorrentes de agenda          | Backend, sem interface pública                                    |
| `AgendaConfiguracao`       | Profissional/sala/equipamento vinculados ao procedimento                       | Configuração no dashboard e seleção pública de profissional       |
| `Auditoria`                | Registro operacional da equipe                                                 | Auditoria interna, sem exposição pública                          |
| `Disponibilidade`          | Janelas semanais por profissional                                              | Configurada no dashboard; base real dos horários públicos         |
| `Bloqueio`                 | Ausência, manutenção ou indisponibilidade de recurso                           | Dashboard e cálculo de horários                                   |
| `EventoAgenda`             | Histórico de alterações/cancelamentos e política aplicada                      | Dashboard e consistência de operação                              |
| `ConsumoSessao`            | Baixa idempotente de sessão de pacote                                          | Backend/financeiro                                                |
| `Comissao`                 | Comissão calculada ao concluir atendimento                                     | Financeiro                                                        |
| `Recebimento`              | Recebimento/estorno de parcela, com forma efetivamente recebida e data/autoria | Financeiro e relatório de recebimentos                            |
| `HistoricoPreco`           | Registro de alteração de preço de procedimento                                 | Dashboard/auditoria                                               |
| `Usuario`                  | Contas e perfis de acesso da equipe                                            | Login automático e administração                                  |
| `SessaoUsuario`            | Sessão segura da equipe com token e CSRF                                       | Backend, sem exposição pública                                    |
| `RecuperacaoSenha`         | Tokens temporários de recuperação de acesso administrativo                     | Fluxo de recuperação de conta                                     |
| `LimiteAcesso`             | Controle de tentativas de autenticação                                         | Proteção de backend                                               |
| `AuditoriaSeguranca`       | Eventos de segurança da equipe                                                 | Administração interna                                             |
| `EmailOutbox`              | Fila de mensagens de recuperação e notificações                                | Worker/backend; requer SMTP para envio real                       |
| `FotoClinica`              | Fotos clínicas privadas, consentimento e vínculo ao atendimento                | Somente equipe clínica autorizada                                 |
| `ContaCliente`             | Credencial segura do cliente                                                   | Login automático de cliente                                       |
| `SessaoPortal`             | Sessão autenticada do cliente com CSRF                                         | Backend/área pessoal                                              |
| `TokenPortal`              | Tokens temporários de primeiro acesso/recuperação                              | Cadastro e recuperação de senha                                   |
| `AuditoriaCliente`         | Eventos de acesso e ações da conta do cliente                                  | Auditoria interna                                                 |
| `PoliticaFalta`            | Regra administrativa para falta e consumo de sessão                            | Configuração do dashboard e operação da agenda                    |
| `VinculoClinico`           | Autoriza profissional a acompanhar cliente                                     | Configuração e escopo de acesso clínico                           |
| `PedidoPrivacidade`        | Solicitação de acesso, correção ou exclusão e resposta                         | Cliente autenticado e dashboard administrativo                    |

### Limites de publicação e configuração

- A base não possui uma tabela de categorias separada; o catálogo agrupa pelo campo `Procedimento.categoria`.
- Blog e depoimentos são dados reais do banco. Uma instalação sem artigos publicados ou avaliações consentidas exibe estado vazio adequado; não fabrica publicações para preencher a página.
- `FotoClinica` contém imagens sensíveis de evolução médica. Elas continuam restritas ao dashboard clínico e não viram uma galeria pública de “antes e depois” sem fluxo próprio de autorização e curadoria.
- A configuração institucional existe em `ConfiguracaoPublica`; telefone, WhatsApp, endereço, horário e CNPJ seguem vazios até a equipe informar dados reais. O diálogo de privacidade apresenta uma síntese informativa até que a clínica cadastre seu texto oficial.
- Horários públicos dependem de profissionais habilitados, configuração de agenda, disponibilidade semanal ativa e recursos válidos. A equipe precisa cadastrar essa configuração antes que haja slots.
- Recuperação de senha grava e processa a fila `EmailOutbox`; a entrega externa depende de SMTP configurado.

## Validação executada

| Verificação                          | Resultado                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                  | Aprovado na revisão atual                                                                                              |
| `npm run lint`                       | Aprovado na revisão atual                                                                                              |
| `npm test`                           | Não executado nesta rodada de correções                                                                                |
| `npm run build`                      | Aprovado na revisão atual; rotas de página geradas: `/` e `/admin`, com fallback `/_not-found` (além das rotas de API) |
| Integração MySQL / HTTP / Playwright | Não executada nesta máquina: não há Docker nem banco de teste configurado                                              |

Os testes que dependem de banco não foram direcionados a dados reais. Esta rodada confirma compilação, tipos e lint; a bateria unitária da revisão anterior está registrada acima, mas não foi repetida agora. Validação interativa de layout em navegador e fluxo ponta a ponta ainda depende de ambiente com MySQL e Chromium. A carga fictícia não é executada automaticamente para não misturar exemplos com dados reais; use `npm run db:seed` somente em base nova de desenvolvimento.
