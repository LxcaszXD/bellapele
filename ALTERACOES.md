# BellaPelle — modernização da experiência do cliente

## Entregas desta versão

- Área do cliente reorganizada em visão geral, agendamentos, dados pessoais, configurações, favoritos e privacidade. Os resumos e detalhes vêm da conta e dos agendamentos reais.
- Favoritos integrados à tabela `Favorito` existente, com chave primária composta para impedir duplicidade. Os corações aparecem nos cards e na tela de detalhes; usuários sem sessão seguem para login e retomam a ação após autenticar.
- Agendamento com calendário mensal, datas destacadas conforme a disponibilidade consultada no backend e horários exibidos no mesmo componente. A consulta considera duração, agenda profissional, conflitos, bloqueios e o agendamento sendo remarcado.
- Navbar fixa flutuante com efeito de vidro, estado visual ao rolar, menu móvel e espaçamento para âncoras.
- CTA “Um momento de cuidado começa com você” posicionado entre depoimentos e blog, mantendo o botão integrado ao fluxo de agendamento.
- Imagens de serviços e profissionais com proporções e apresentação coerentes, mantendo as fotos individuais do catálogo/equipe e assets de fallback já disponíveis.
- Sistema de movimento compartilhado com GSAP e ScrollTrigger: entradas em sequência na primeira dobra, revelação única ao rolar, suporte a conteúdo dinâmico, atualização após mudanças de layout e cleanup no ciclo de vida do React. A inicialização agora ocorre após a hidratação; elementos fora da tela permanecem visíveis até o gatilho de rolagem iniciar a animação.
- Microinterações sutis em botões, cards, favoritos, dias e horários do calendário, navegação, formulários e painel administrativo. O menu móvel revela seus links em sequência.
- A animação respeita `prefers-reduced-motion`, não oculta conteúdo por CSS e usa `transform`/`opacity` para manter a experiência funcional quando o JavaScript não inicializa.
- Marca atualizada em todos os pontos de exibição para o novo lockup BellaPelle: símbolo da mulher e nome, sem slogan ou ornamentos adicionais. O PNG agora tem fundo transparente e bordas preservadas. Dimensões responsivas ajustadas para navbar, rodapé, autenticação, painel e página 404.
- Navbar reequilibrada em três áreas, com largura máxima e margens laterais, altura reduzida, alinhamento central real para os links e ações alinhadas à direita. Tipografia dos links ampliada. O indicador ativo acompanha a seção que cruza a linha de leitura abaixo do cabeçalho; “Início” aponta para o Hero, não para o `<main>` inteiro. Menu móvel mantém login/agendamento acessíveis, fecha com Escape e anima abertura/fechamento por GSAP.

## Banco de dados

Não foi necessária migration: a tabela `Favorito` já existe e possui chave primária `(id_cliente, id_procedimento)`. O calendário usa as tabelas de configuração de agenda, disponibilidade, agendamento e bloqueio existentes.

## Validação

Executados após as alterações: `npm run typecheck`, `npm run lint`, ESLint no provedor de animações e `npm run build`. O build passou e exibiu um aviso do Next.js sobre vulnerabilidade conhecida, recomendando executar a atualização de segurança. A validação conectada ao MySQL depende de um banco configurado; ela não foi executada nesta sessão. A revisão visual em navegador não foi executada neste pacote.

## Inicialização

Consulte `README.md`. Dependências não incluídas no ZIP; execute `npm ci` e configure as variáveis e o banco antes de iniciar a aplicação.
