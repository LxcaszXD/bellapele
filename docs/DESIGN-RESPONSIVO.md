# BellaPelle — design responsivo v3

## Identidade

Preservação da paleta vinho, rosa suave e fundo creme, tipografia local, ícones de traço, cantos arredondados e hierarquia dos protótipos mobile. As telas maiores são adaptações criadas a partir desses protótipos, pois não foram fornecidas referências próprias para desktop.

## Composição

- **Mobile (até 767 px):** fluxo vertical, navegação inferior e ação fixa no detalhe do tratamento; campos e cards se adaptam à largura disponível.
- **Tablet (768–1023 px):** cabeçalho com marca e navegação; catálogo em duas colunas; foto e informações do tratamento lado a lado; confirmação com resumo lateral.
- **Notebook (1024–1439 px):** início organizado em grade de 12 colunas, banner ao lado das categorias, cards ao lado da especialista; catálogo com três colunas.
- **Desktop (1440 px ou mais):** conteúdo centralizado com largura máxima de 1200 px, espaços ampliados e textos com largura controlada. Evita esticar os cards até as bordas do monitor.

O botão de agendamento fica abaixo dos horários nas telas maiores. Modais, estados vazios, favoritos, histórico e confirmação também receberam tratamento responsivo. Botões têm foco visível e o CSS respeita a preferência por movimento reduzido.

## Arquivos principais

- `components/beauty-app.tsx`: estrutura das telas e navegação.
- `app/globals.css`: estilos base e regras por largura.
- `tests/e2e/responsive.spec.ts`: fluxo nas oito larguras, verificação de overflow e posicionamento da ação.
- `docs/responsive/`: capturas reais do navegador em 390, 768, 1366 e 1440 px.

## Reproduzir a validação

```sh
npm ci
npx playwright install chromium
npm run test:e2e
npm run build
```

O teste inicia o servidor em modo demo e usa webpack para compilar o ambiente de desenvolvimento. O modo demo persiste dados no navegador. Não valida execução SQL.

## Assets

As fotos existentes foram preservadas. A resolução disponível nos protótipos limita a nitidez quando ampliadas. Para publicação, substitua os arquivos em `public/images/` por originais de alta resolução, mantendo os nomes ou atualizando o catálogo. Nenhuma nova fotografia foi inventada para substituir a referência.

## Escopo técnico

Esta entrega altera a apresentação e mantém a API/MySQL da versão 2. Autenticação de produção, cobrança e envio de e-mail não foram adicionados. A conexão com MySQL depende da configuração descrita no README e deve ser validada no ambiente com o banco ativo.
