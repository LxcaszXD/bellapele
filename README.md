# BellaPelle — site público e gestão da clínica

Site público responsivo com dashboard administrativo, desenvolvido em Next.js App Router, React, TypeScript strict, Tailwind v4, Node.js e MySQL 8.4. A API REST é implementada nos Route Handlers do Next e organizada em serviços de domínio. Mantém mysql2 e Zod do projeto original, sem adicionar outro servidor HTTP ou ORM desnecessariamente.

**Estado da entrega:** o site público único está em `/`, com conteúdo do catálogo, equipe, avaliações autorizadas e blog carregado do MySQL. O dashboard administrativo fica em `/admin`; a antiga rota `/portal` redireciona para `/`. Não há processamento externo de cobranças PIX/cartão.

## Início rápido no Windows com Docker Desktop

Requisitos: Node.js 22 ou superior, Docker Desktop iniciado com Linux containers e WSL2 atualizado. Execute os comandos na pasta que contém este README e `compose.yaml`.

```powershell
npm run env:init
docker compose up --build -d
docker compose --profile tools run --rm setup
```

Abra **http://localhost:3000/** para navegar sem login ou **http://localhost:3000/admin** para a gestão da equipe. O e-mail e a senha iniciais estão nos campos `ADMIN_EMAIL` e `ADMIN_PASSWORD` do arquivo `.env`, gerado localmente. O script cria senhas aleatórias; não há senha padrão compartilhada. Troque `ADMIN_EMAIL` pelo e-mail desejado antes de executar `setup`. Execute `setup` uma única vez: uma segunda execução informa duplicidade sem redefinir a senha existente.

`env:init` usa somente Node, portanto não requer instalar dependências antes do Docker. Ele não sobrescreve `.env` ou `.env.local` já existentes. Não publique esses arquivos nem os coloque no Git.

O Compose sobe o MySQL, aguarda o healthcheck, executa migrations e inicia o app. Os dados e fotos ficam em volumes persistentes. Esta versão usa `mysql_v4_data` separado do volume da v3 para não alterar silenciosamente seus dados anteriores. Para migrar a base real existente, siga `docs/OPERACAO.md` e faça backup primeiro.

Para exemplos fictícios (somente banco vazio):

```powershell
docker compose --profile tools run --rm -e ALLOW_DEMO_SEED=true setup node scripts/seed.mjs
```

O seed cria registros de demonstração para clientes, equipe, procedimentos, agenda, financeiro, estoque, avaliações e conteúdo público. São três profissionais com fotos distintas; endereços e históricos são sintéticos e os e-mails usam o domínio reservado `.test`. Contato, WhatsApp, endereço institucional, CNPJ e política oficial permanecem vazios. O script recusa tabelas de negócio já preenchidas e também recusa execução com `NODE_ENV=production`. As senhas das contas de demonstração são aleatórias e ficam em `DEMO_PASSWORD` no `.env`; use `cliente01@example.test` ou `usuario.demo01@example.test`. O administrador é criado separadamente com `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Sessões, tokens, limites de acesso, fila de e-mail e fotos clínicas privadas continuam vazios.

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

1. Qualquer visitante navega pelo site público. O login só é solicitado ao agendar ou acessar dados pessoais; a mesma modal identifica cliente ou administrador automaticamente.
2. Administrador cadastra clientes, profissionais, procedimentos, salas, equipamentos e habilitações.
3. Habilitações vinculam profissional, procedimento e percentual de comissão. Disponibilidade define os intervalos semanais; bloqueios registram manutenção/ausência.
4. Anamneses são novas avaliações imutáveis. O profissional acessa clientes associados à sua agenda ou a Vínculos clínicos configurados pelo administrador.
5. Financeiro vende um pacote em **Pacotes vendidos → Vender pacote**. Parcelas são criadas como pendentes. Não há cobrança externa automática.
6. Recepção cria o agendamento selecionando cliente, profissional, procedimento, sala, equipamento e pacote opcional.
7. O atendimento deve estar confirmado e com horário de início alcançado. Use **Iniciar atendimento**, registre fotos autorizadas se exigidas e conclua com os produtos/lotes utilizados.
8. A conclusão baixa sessão e estoque e gera comissão em uma única transação. Repetir a conclusão retorna o mesmo atendimento.
9. Registre recebimentos em **Parcelas**. Para avulso, crie a cobrança em **Pagamentos → Cobrança avulsa**. Comissões só podem ser pagas após recebimento integral.

Nenhum atendimento é concluído sem anamnese. Procedimento que exige foto demanda fotografia com consentimento registrado. Fotos são privadas e precisam de autenticação clínica para leitura.

## Organização

- `app/admin`, `components/admin`: painel, formulários, calendário, relatórios e fotos.
- `app/api/clinic/[...path]`: autenticação, CSRF, dispatch e erros HTTP.
- `lib/clinic`: permissões, segurança, catálogo, CRUD, operações transacionais e relatórios.
- `database/001-base.sql` a `008-receipt-method.sql`: uma cadeia sequencial que cria e atualiza o único banco principal configurado em `MYSQL_DATABASE`/`DATABASE_URL` (por padrão, `bellapelle_modelo`). O banco `_test` é isolado e usado somente quando os testes de integração são executados.
- `database/demo.sql`: dados sintéticos opcionais; `scripts/seed.mjs` exige confirmação, verifica as tabelas de negócio e gera CPFs válidos para teste e credenciais locais aleatórias.
- `tests`: regras, segurança, integração MySQL, HTTP e Playwright.
- `docs`: instruções de operação, modelo de dados, contratos da API e pendências conhecidas.

## Redesign e cobertura dos dados

Consulte [`docs/RELATORIO-REDESIGN-E-INTEGRACAO.md`](docs/RELATORIO-REDESIGN-E-INTEGRACAO.md) para a matriz de todas as 45 tabelas das migrations, onde cada grupo aparece, regras de publicação e limites da validação executada.

## Onde entrar

- **Site público:** http://localhost:3000/ — único layout público; `/portal` é apenas um redirecionamento compatível para `/`.
- **Dashboard da equipe:** http://localhost:3000/admin — use `ADMIN_EMAIL` e `ADMIN_PASSWORD` gerados no `.env`.
- Clientes podem navegar sem conta. Agendamento e área pessoal abrem a modal de acesso; cliente criado pela recepção pode ativar a conta pelo próprio fluxo de cadastro.
- Em **Agenda do portal**, a equipe define os procedimentos e horários disponíveis.
- Em **Contato e privacidade do site**, a administração cadastra telefone, WhatsApp, e-mail, endereço, horário, CNPJ e texto oficial da política. O site não inventa esses dados quando estão vazios.
- No dashboard, cadastre artigos em **Conteúdo do blog**. A seção pública mostra apenas os publicados. Avaliações só ficam públicas com consentimento de publicação registrado e publicação ativada.
- A área do cliente oferece agendamentos, dados pessoais, favoritos e solicitações de privacidade.

## Envio de e-mail

Configure SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_FROM, SMTP_USER e SMTP_PASSWORD no `.env` (Docker) ou `.env.local` (Node). Use dados do seu provedor. Para iniciar o worker:

```powershell
docker compose --profile mail up -d --build mail
# Ou sem container:
npm run mail:worker
```

O worker processa EmailOutbox com cinco tentativas, expira mensagens de recuperação atrasadas e remove o conteúdo enviado. O prazo do token é de 30 minutos. Sem SMTP configurado não há envio externo; a interface informa somente a solicitação. A API pública de leitura (`GET /api/public`) entrega apenas procedimentos e profissionais ativos, avaliações autorizadas/publicadas e artigos publicados. Dados de clientes, equipe e operações continuam protegidos por sessão e CSRF. A API legada permanece desabilitada e não deve ser habilitada em produção.

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

Contrato em `docs/CONTRATO-API.md`, inventário OpenAPI em `docs/openapi.json`. Mutações exigem cookie de sessão, Origin correspondente a `APP_ORIGIN` e header `X-CSRF-Token` retornado no login/session. Sessões expiram após 8 horas e são invalidadas no logout/alteração de usuário.

Use HTTPS e `APP_ORIGIN` com URL HTTPS em produção; os cookies passam a incluir Secure. Configure proxy reverso, backups criptografados do MySQL e fotos, restauração testada e acesso restrito à infraestrutura. Não exponha a porta MySQL publicamente. Recuperação de senha grava mensagens em `EmailOutbox`; o envio de e-mail externo ainda precisa de integração e credenciais. Não há cobrança PIX/cartão externa, SMS ou WhatsApp integrado.

O sistema implementa controles técnicos, mas não constitui certificação de conformidade jurídica ou LGPD. Retenção, consentimentos e procedimentos de atendimento a titulares precisam ser aprovados pela clínica.
