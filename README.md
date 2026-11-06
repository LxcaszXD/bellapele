# BellaPelle — gestão da clínica (v5)

Continuação da versão responsiva v3. Aplicação administrativa em Next.js App Router, React, TypeScript strict, Tailwind v4, Node.js e MySQL 8.4. A API REST é implementada nos Route Handlers do Next e organizada em serviços de domínio. Mantém mysql2 e Zod do projeto original, sem adicionar outro servidor HTTP ou ORM desnecessariamente.

**Estado da entrega:** continuação integrada com portal individual de clientes. Consulte `docs/VALIDACAO-V5.md` para resultados efetivamente executados e `docs/PENDENCIAS.md` para limites do aceite. Não há processamento externo de cobranças PIX/cartão.

## Início rápido no Windows com Docker Desktop

Requisitos: Node.js 22 ou superior, Docker Desktop iniciado com Linux containers e WSL2 atualizado. Execute os comandos na pasta que contém este README e `compose.yaml`.

```powershell
npm run env:init
docker compose up --build -d
docker compose --profile tools run --rm setup
```

Abra **http://localhost:3000/admin**. O e-mail e a senha iniciais estão nos campos `ADMIN_EMAIL` e `ADMIN_PASSWORD` do arquivo `.env`, gerado localmente. O script cria senhas aleatórias; não há senha padrão compartilhada. Troque `ADMIN_EMAIL` pelo e-mail desejado antes de executar `setup`. Execute `setup` uma única vez: uma segunda execução informa duplicidade sem redefinir a senha existente.

`env:init` usa somente Node, portanto não requer instalar dependências antes do Docker. Ele não sobrescreve `.env` ou `.env.local` já existentes. Não publique esses arquivos nem os coloque no Git.

O Compose sobe o MySQL, aguarda o healthcheck, executa migrations e inicia o app. Os dados e fotos ficam em volumes persistentes. Esta versão usa `mysql_v4_data` separado do volume da v3 para não alterar silenciosamente seus dados anteriores. Para migrar a base real existente, siga `docs/OPERACAO.md` e faça backup primeiro.

Para exemplos fictícios (somente banco vazio):

```powershell
docker compose --profile tools run --rm -e ALLOW_DEMO_SEED=true setup node scripts/seed.mjs
```

Para acompanhar erros:

```powershell
docker compose ps
docker compose logs --tail=100 app migrate mysql
```

Para parar preservando dados: `docker compose down`. **Não use `down -v` se precisar preservar o banco e as fotos.** Erros 504 de `auth.docker.io` acontecem durante o download, antes de executar o projeto; depois de restabelecer a conexão, repita `docker pull mysql:8.4` e `docker compose up --build -d`.

## Desenvolvimento sem container do app

```powershell
npm ci
npm run env:init
docker compose up -d mysql
npm run db:migrate
npm run user:create-admin
npm run dev
```

Se já gerou os arquivos de ambiente, não repita `env:init`. `.env.local` aponta o app local para o MySQL em `127.0.0.1:3306`. Com MySQL instalado manualmente, crie uma base UTF8MB4 e configure `DATABASE_URL` para ela. Build: `npm run build`; execução: `npm start`. A imagem Docker utiliza o servidor standalone do Next.

## Fluxo de operação

1. Administrador cadastra clientes, profissionais, procedimentos, salas, equipamentos e habilitações.
2. Habilitações vinculam profissional, procedimento e percentual de comissão. Disponibilidade define os intervalos semanais; bloqueios registram manutenção/ausência.
3. Anamneses são novas avaliações imutáveis. O profissional acessa clientes associados à sua agenda ou a Vínculos clínicos configurados pelo administrador.
4. Financeiro vende um pacote em **Pacotes vendidos → Vender pacote**. Parcelas são criadas como pendentes. Não há cobrança externa automática.
5. Recepção cria o agendamento selecionando cliente, profissional, procedimento, sala, equipamento e pacote opcional.
6. O atendimento deve estar confirmado e com horário de início alcançado. Use **Iniciar atendimento**, registre fotos autorizadas se exigidas e conclua com os produtos/lotes utilizados.
7. A conclusão baixa sessão e estoque e gera comissão em uma única transação. Repetir a conclusão retorna o mesmo atendimento.
8. Registre recebimentos em **Parcelas**. Para avulso, crie a cobrança em **Pagamentos → Cobrança avulsa**. Comissões só podem ser pagas após recebimento integral.

Nenhum atendimento é concluído sem anamnese. Procedimento que exige foto demanda fotografia com consentimento registrado. Fotos são privadas e precisam de autenticação clínica para leitura.

## Organização

- `app/admin`, `components/admin`: painel, formulários, calendário, relatórios e fotos.
- `app/api/clinic/[...path]`: autenticação, CSRF, dispatch e erros HTTP.
- `lib/clinic`: permissões, segurança, catálogo, CRUD, operações transacionais e relatórios.
- `database/001-base.sql` a `005-portal.sql`: migrations versionadas.
- `database/demo.sql`: dados fictícios opcionais; `scripts/seed.mjs` complementa a migração.
- `tests`: regras, segurança, integração MySQL, HTTP e Playwright.
- `docs`: contratos, auditoria, modelo, instruções e resultados.

## Onde entrar

- **Site/cliente:** http://localhost:3000/portal — a raiz redireciona para essa tela.
- **Equipe:** http://localhost:3000/admin — use ADMIN_EMAIL e ADMIN_PASSWORD gerados no `.env`.
- Cliente novo usa **Criar minha conta**; cliente já cadastrado pela recepção usa **Recuperar / ativar acesso**. Ativação exige e-mail corretamente cadastrado e SMTP configurado.
- Administrador publica recursos em **Agenda do portal**, após cadastrar as habilitações. Sem configuração de recursos não é possível reservar aquele procedimento.
- **Minha conta** exibe pacotes, parcelas, contato e solicitações de privacidade.

## Envio de e-mail

Configure SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_FROM, SMTP_USER e SMTP_PASSWORD no `.env` (Docker) ou `.env.local` (Node). Use dados do seu provedor. Para iniciar o worker:

```powershell
docker compose --profile mail up -d --build mail
# Ou sem container:
npm run mail:worker
```

O worker processa EmailOutbox com cinco tentativas, expira mensagens de recuperação atrasadas e remove o conteúdo enviado. O prazo do token é de 30 minutos. Sem SMTP configurado não há envio externo; a interface informa somente a solicitação. A API legada permanece desabilitada e não deve ser habilitada em produção.


## Testes

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Integração usa banco **vazio e exclusivo**, com nome terminado em `_test`. O teste se recusa a apagar tabelas existentes. Exemplo: crie `bellapelle_test` manualmente; no PowerShell:

```powershell
$env:TEST_DATABASE_URL="mysql://USUARIO:SENHA@127.0.0.1:3306/bellapelle_test"
$env:TEST_ADMIN_PASSWORD="SENHA_TEMPORARIA_DE_TESTE_COM_12_OU_MAIS_CARACTERES"
npm run test:integration
```

Para testar HTTP/E2E, inicie outra instância do app apontada para esse banco, com `APP_ORIGIN=http://127.0.0.1:3100`, porta 3100, e mantenha `TEST_ADMIN_PASSWORD` igual à utilizada na integração. Os testes usam o usuário fictício `qa@example.test` criado pela integração.

```powershell
node tests/clinic-http.mjs
node tests/customer-http.mjs
npx playwright install chromium
npm run test:e2e:admin
```

O E2E cria um cliente: rode sobre banco de teste recém-preparado. A pipeline inclui instalação, lint, build, tipos, unitários, integração MySQL, HTTP e E2E. A execução da pipeline no GitHub ainda depende de publicar o repositório.

## API e produção

Contrato em `docs/CONTRATO-V4.md`, inventário OpenAPI em `docs/openapi.json`. Mutações exigem cookie de sessão, Origin correspondente a `APP_ORIGIN` e header `X-CSRF-Token` retornado no login/session. Sessões expiram após 8 horas e são invalidadas no logout/alteração de usuário.

Use HTTPS e `APP_ORIGIN` com URL HTTPS em produção; os cookies passam a incluir Secure. Configure proxy reverso, backups criptografados do MySQL e fotos, restauração testada e acesso restrito à infraestrutura. Não exponha a porta MySQL publicamente. Recuperação de senha grava mensagens em `EmailOutbox`; o envio de e-mail externo ainda precisa de integração e credenciais. Não há cobrança PIX/cartão externa, SMS ou WhatsApp integrado.

O sistema implementa controles técnicos, mas não constitui certificação de conformidade jurídica ou LGPD. Retenção, consentimentos e procedimentos de atendimento a titulares precisam ser aprovados pela clínica.
