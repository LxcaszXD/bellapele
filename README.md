# BellaPelle — interface responsiva e API MySQL (v3)

Esta versão adapta o projeto Next.js ao banco do diagrama enviado. Inclui interfaces para mobile, tablet, notebook e desktop, toda a API, o SQL com cinco registros por tabela e uma migração aditiva com três tabelas de infraestrutura.

## Design responsivo

A versão 3 mantém a identidade visual dos protótipos e adapta a navegação, os cards e o agendamento às telas maiores. Consulte `docs/DESIGN-RESPONSIVO.md` e as capturas em `docs/responsive/`.

| Largura | Organização |
|---|---|
| Até 767 px | Interface mobile e navegação inferior |
| 768–1023 px | Navegação superior, catálogo e tratamento em duas colunas |
| 1024–1439 px | Início em grade, catálogo em três colunas, confirmação em duas áreas |
| A partir de 1440 px | Conteúdo centralizado, espaçamento ampliado e largura de leitura limitada |

A API e o modelo MySQL da versão 2 foram preservados. A validação visual utiliza o modo demo; não comprova conexão com um servidor MySQL.

## Já importou BellaPelle-MySQL.sql?

1. Extraia esta versão em uma pasta nova (não misture `node_modules` ou `.next` com a versão anterior).
2. Copie `.env.example` para `.env.local` e configure a conexão com **bellapelle_modelo**.
3. Execute:

```sh
npm ci
npm run db:migrate
npm run dev
```

Abra **http://localhost:3000**. `db:migrate` executa somente `database/002-api.sql`; não reinsere os 90 registros nem apaga dados. Pode ser repetido; configurações de agenda já existentes são preservadas.

## Ainda não criou o banco?

Com Node.js 22+ e MySQL 8.4, crie um banco vazio chamado `bellapelle_modelo`, configure `.env.local` e execute:

```sh
npm ci
npm run db:setup
npm run dev
```

O usuário MySQL deve ter permissão para criar tabelas nesse banco. O script recusa iniciar o esquema base em um banco que já tenha tabelas. Cria o modelo, seus exemplos e as extensões da API. `database/schema.sql` não contém CREATE DATABASE/USE: usa o banco da conexão. `database/BellaPelle-MySQL.sql` é o arquivo independente previamente entregue para importação manual, com CREATE DATABASE/USE.

Alternativa para instalação nova com Docker Desktop:

```sh
docker compose up --build
```

O Compose usa um volume novo, `mysql_modelo_data`, e publica a aplicação somente em `127.0.0.1:3000`. O banco, o catálogo e as extensões são inicializados automaticamente. Não use `docker compose down -v` se deseja preservar os dados. Scripts de inicialização Docker só executam no primeiro uso do volume.

Se usava o banco antigo com `customers`, `treatments`, `bookings`: esta entrega não converte essas linhas. Aponte a conexão para o novo banco ou planeje uma migração de dados separada. O banco anterior não é apagado.

## Configuração local

```dotenv
DATA_MODE=mysql
DATABASE_URL=mysql://bellapelle:bellapelle_local@127.0.0.1:3306/bellapelle_modelo
ENABLE_LOCAL_DEMO_AUTH=true
LOCAL_DEMO_CLIENT_ID=1
COOKIE_SECURE=false
```

O modelo exige dados cadastrais reais de Cliente. Por isso, a API NÃO cria clientes fictícios com CPF inventado a cada navegador. Para desenvolvimento local, o acesso demonstrativo usa o Cliente 1 (Amanda) que já existe na amostra. Todos os navegadores desse modo representam esse mesmo cliente. Para testar outro cliente, altere `LOCAL_DEMO_CLIENT_ID`, reinicie e apague o cookie `bellapelle_session_v2` do navegador.

A sessão é um token aleatório em cookie HttpOnly/SameSite=strict; somente seu hash é persistido em `SessaoCliente`, com expiração de sete dias. O cliente da reserva vem da sessão, nunca do JSON da requisição.

**Não é um sistema de login de produção.** Desative `ENABLE_LOCAL_DEMO_AUTH` ao publicar e integre um fluxo de autenticação que crie as sessões após verificar a identidade. Sem sessão válida e sem acesso local habilitado, a API retorna 401. Não há endpoint público que gere sessão a partir de um ID enviado pelo usuário. Em HTTPS use `COOKIE_SECURE=true`; em proxy reverso configure `APP_ORIGIN` com a origem exata do aplicativo.

## O que mudou

| Recurso | Tabelas usadas |
|---|---|
| Catálogo e avaliações | Procedimento, Avaliacao, Agendamento |
| Especialista e recursos de agenda | AgendaConfiguracao, Profissional, ProfissionalProcedimento, Sala, Equipamento |
| Perfil | Cliente |
| Favoritos | Favorito |
| Reserva, reagendamento, cancelamento | Agendamento |
| Forma de pagamento | Pagamento, Parcela |
| Sessão e serialização das reservas | SessaoCliente, ControleAgenda |

A interface agora lê os cinco procedimentos do banco, nomes dos profissionais, preços, durações e avaliações reais da amostra. O procedimento 2, por exemplo, pertence à Camila Santos no SQL fornecido. A quantidade de resultados e as médias não são fixas. Os exemplos históricos concluídos aparecem no histórico conforme o status do banco; o simples passar do horário não conclui uma sessão em modo MySQL.

`AgendaConfiguracao` escolhe um profissional, uma sala e, opcionalmente, um equipamento por procedimento. A migração configura os cinco exemplos do SQL anterior. Se utilizar um cadastro diferente, configure essa tabela explicitamente. O banco permite mais profissionais por procedimento, mas esta interface usa apenas a configuração principal. Não há seleção de profissional pelo usuário nesta etapa.

## Rotas e exemplos

Os nomes JSON foram mantidos para compatibilidade com a interface. As tabelas SQL são as do diagrama.

| Método | Rota | Finalidade |
|---|---|---|
| GET | `/api/bootstrap` | Cliente da sessão, catálogo, favoritos e reservas |
| GET | `/api/slots?date=2026-11-20&treatmentId=1` | Horários disponíveis para o procedimento |
| GET | `/api/slots?date=2026-11-20&treatmentId=1&exclude=10` | Disponibilidade para reagendar uma reserva própria |
| PUT | `/api/favorites` | Adicionar/remover favorito |
| POST | `/api/bookings` | Reservar sessão avulsa |
| PATCH | `/api/bookings/10` | Alterar data, hora e forma de pagamento |
| DELETE | `/api/bookings/10` | Cancelar sessão futura sem pagamento financeiro registrado |

Favorito:

```json
{"treatmentId":1,"active":true}
```

Reserva/reagendamento (use uma data futura):

```json
{"treatmentId":1,"date":"2026-11-20","time":"11:00","payment":"Pix"}
```

- `treatmentId` é validado no banco, sem limite fixo de três tratamentos.
- `slots` agora exige `treatmentId`; a interface enviada já contém esse ajuste.
- Valores e duração são obtidos no servidor. Reagendamentos preservam preço, duração e recursos originalmente reservados.
- GET de disponibilidade não garante uma vaga; POST/PATCH verifica novamente em transação.
- Reservas da API são serializadas com um bloqueio em `ControleAgenda`. A consulta verifica sobreposição de intervalos de cliente, profissional, sala e equipamento.
- Criação grava Agendamento confirmado + Pagamento pendente + uma Parcela pendente na mesma transação. Nenhuma cobrança real ocorre.
- Cancelamento cancela também cobrança e parcela pendentes, sem apagar histórico.
- Reagendamento e cancelamento de reservas com pagamento já registrado, ou de sessões de pacote, exigem atendimento pela recepção; a API não simula estorno nem altera saldo de pacote.
- Escritas diretas no banco ou outros sistemas devem adotar a mesma disciplina de bloqueio para preservar a proteção de agenda.
- Erros: 400 dados inválidos; 401 sessão; 403 origem; 404 recurso; 405 método; 409 conflito/regra operacional; 422 falta de configuração; 503 banco indisponível.

## Escopo

A API cobre os fluxos existentes nas seis telas. Não inclui CRUD administrativo de anamnese, produtos, estoque, pacotes, conclusão clínica, cadastro/login ou envio de avaliações. Essas tabelas continuam disponíveis no modelo para próximas etapas. Também não integra gateway financeiro, e-mail ou reembolso. As credenciais do Compose são apenas de desenvolvimento.

## Testes

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

O E2E inicia seu próprio servidor em modo demo; feche outro servidor na porta 3000. O modo demo (`DATA_MODE=demo`) continua funcionando no navegador e não testa consultas SQL.

Para validar a nova API COM MYSQL, mantenha `npm run dev` ativo e, em outro terminal de desenvolvimento, rode:

```sh
npm run test:api
```

Esse teste cria duas requisições concorrentes para a mesma vaga e espera uma reserva e um conflito; verifica preço, persistência, pagamento pendente, reagendamento e cancelamento. Ele deixa as reservas de teste canceladas no histórico, sem excluir dados. Use somente banco de teste. `TEST_API_URL` permite indicar outro endereço.

Veja `docs/VALIDACAO.md` para o que foi efetivamente executado nesta entrega.
