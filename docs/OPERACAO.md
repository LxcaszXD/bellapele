# Operação, migrações e implantação

## Migração de uma instalação existente

1. Faça backup consistente do banco, arquivos privados e configuração. Teste a restauração em uma cópia.
2. Importe a cópia para uma base de homologação MySQL 8.4. Configure DATABASE_URL nessa cópia.
3. Execute `npm run db:migrate`. A migration 001 detecta Cliente e adota a base v3 existente sem apagar dados. Essa adoção pressupõe schema v3 entregue no ZIP: alterações locais devem ser comparadas antes.
4. Revise constraints e dados legados. A migration 003 completa `Parcela.valor_recebido` das parcelas pagas. Não inventa novos recebimentos/comissões históricos: demonstrativos baseados em Recebimento começam com os lançamentos da v4.
5. A migration 008 adiciona a forma efetivamente recebida ao ledger. Registros antigos permanecem com esse campo vazio; não se atribui retroativamente uma forma de pagamento sem evidência.
6. Execute testes e reconcilie saldos, sessões, estoques e pagamentos antes de direcionar a aplicação de produção para a nova base.

Migrations usam checksum e lock GET_LOCK. MySQL faz commits implícitos para DDL; não existe promessa de rollback integral de uma migration. O estado `running` impede reaplicação automática após erro. Em caso de interrupção, restaure o backup ou examine cada DDL executado, finalize o reparo em homologação e somente então registre o estado correto com revisão humana. Não apague SchemaMigration para forçar uma nova execução.

## Segredos e serviços

`npm run env:init` gera arquivos locais com senhas aleatórias. Use secret manager na produção. Configure HTTPS, domínio exato em APP_ORIGIN e reverse proxy que preserve Origin e imponha limites de corpo/tempo. Cabeçalhos de proteção são configurados no Next; CSP ainda permite scripts inline requeridos pela renderização, devendo evoluir para nonce em uma revisão específica.

Recuperação de senha grava token hash e mensagem pendente na tabela EmailOutbox. A aplicação não afirma ter entregue e-mail. Um transporte autenticado, política de tentativas e limpeza de conteúdo/token expirado precisam ser integrados. Não exponha a outbox em interface pública. O prazo do token é 30 minutos. Alteração da senha invalida sessões.

Fotos são gravadas em PRIVATE_UPLOAD_DIR fora da pasta pública, com nomes aleatórios e autorização de leitura. Preserve o volume de fotos no backup e restrinja acesso no sistema operacional. Em produção, criptografe disco/backup e mantenha as chaves separadas. Não foi implementada criptografia em nível de campo do prontuário.

## Retenção e LGPD

Não há exclusão física por CRUD dos clientes e registros históricos. Desativação impede novos usos dos cadastros. Avaliações são acrescentadas, não sobrescritas. Logs registram ator, operação, recurso e instante, sem cópia indiscriminada dos dados clínicos.

A clínica precisa definir prazos de retenção, base legal, responsáveis, atendimento de pedidos de titulares, descarte de backups, resposta a incidentes e acesso excepcional. Não há declaração de conformidade jurídica integral. Procedimentos de anonimização/exclusão sujeitos a essas políticas continuam pendentes.

## Monitoramento e recuperação

`/api/health` verifica conexão MySQL sem revelar configuração. Monitore erros, disco, backups, saúde dos containers e requisições 5xx. Não exponha logs de banco contendo dados de pacientes. Escopo atual: uma clínica; lock global de operações críticas privilegia consistência e simplicidade, com limite de escalabilidade documentado. Adote locks por recurso somente após medir carga e testar deadlocks.

Docker Compose foi configurado, mas não executado neste ambiente (Docker não disponível). MySQL 8.4 e o app foram executados diretamente para os testes de integração/HTTP. A instalação de produção exige homologação do Compose no host de destino.
