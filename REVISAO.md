# Revisão da interface única

A interface do cliente agora está em `/`. Foram removidos beauty-app.tsx, customer-portal.tsx e a página/CSS antigos de /portal. O endereço antigo redireciona para a página nova. /admin continua reservado à equipe.

## Fluxos conectados
- Sessão, login, cadastro e recuperação no modal.
- Agendamento com procedimentos, disponibilidade, pagamento registrado e pacote opcional.
- Listagem, cancelamento e remarcação dos próprios agendamentos.
- Perfil, pacotes e parcelas dentro da página nova.
- Sessão encerrada pelo botão Sair.

## Requisitos pendentes identificados
- O catálogo institucional ainda contém conteúdo fixo; deve ser unificado com os procedimentos publicados no banco. O formulário de agendamento já usa os dados reais.
- Favoritos e solicitações de privacidade têm APIs existentes, mas ainda não foram integrados ao painel novo.
- Agendamento depende de habilitações, disponibilidade e AgendaConfiguracao cadastradas pela equipe.
- Não há cobrança externa automática. Os recebimentos são registrados pela equipe.
- SMTP e worker de e-mail são necessários para recuperação real de senha.
- Primeiro acesso atualmente usa dados pessoais para conferência; a verificação de posse do e-mail deve ser incorporada antes de uso real.
- Fotografias e depoimentos apresentados são ilustrativos, não evidências de atendimentos.

## Limites da revisão
Revisão de código, compilação e testes unitários existentes. Sem execução de integração com MySQL nem inspeção em navegador nesta entrega. É necessário validar os fluxos completos com o banco configurado antes de produção.

A compilação também apresentou um aviso de vulnerabilidade na versão instalada do Next.js. A atualização da dependência permanece pendente.
