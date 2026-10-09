-- BELLAPELLE - MODELO RELACIONAL BASEADO NO DIAGRAMA ENVIADO
-- Alvo: MySQL 8.0.16+ (preferencialmente MySQL 8.4), InnoDB, UTF-8.
-- Execute este arquivo inteiro no MySQL Workbench em uma instancia de desenvolvimento.
-- Sao 18 tabelas: 16 do diagrama + Favorito + Avaliacao.
-- Interpretacao de "5 inserts": CINCO REGISTROS EM CADA TABELA (90 no total).
-- Os registros sao ficticios. CPFs sao identificadores de teste, sem validacao de digitos.
-- Nao contem DROP, nao apaga bancos existentes e nao desativa chaves estrangeiras.
-- Execute uma unica vez em banco novo. Se uma tabela ja existir, PARE a execucao:
-- nao continue os INSERTs sobre um banco parcialmente existente.
-- DDL no MySQL faz commit implicito; a transacao abaixo protege somente os INSERTs.
--
-- ANALISE DO DIAGRAMA
-- 1. Coerente com a clinica: Cliente -> Agendamento -> Atendimento, profissional
--    habilitado por procedimento, recursos, pacotes, anamnese e estoque.
-- 2. Para as telas faltavam favoritos, avaliacoes e dados descritivos/imagens.
--    Acrescentados Favorito, Avaliacao, descricao/imagem_url em Procedimento,
--    foto_url e anos_experiencia em Profissional. Categoria permanece texto.
-- 3. Pagamento precisava identificar uma sessao avulsa: acrescentado id_agendamento.
--    Cada cobranca e de UM pacote comprado OU de UM agendamento avulso.
--    FKs compostas garantem que o objeto cobrado pertence ao mesmo cliente.
-- 4. ProdutoAplicado ganhou id_produto e quantidade, conservando os dados de lote
--    do diagrama como retrato historico. Produto representa UM lote de estoque.
-- 5. Equipamento e opcional, pois nem todo tratamento utiliza aparelho.
-- 6. Atendimento tem UNIQUE(id_agendamento): uma ficha por sessao.
-- 7. PacoteCliente guarda sessoes_contratadas; sessoes_restantes e calculado.
--    Preco e quantidade contratados sao snapshots para preservar historico.
-- 8. Agendamento guarda valor_sessao. A habilitacao profissional/procedimento
--    e garantida pela FK composta para ProfissionalProcedimento.
-- 9. A parte inferior da imagem esta cortada/encoberta. Cardinalidades nao legiveis
--    foram inferidas das FKs e dos fluxos; confirmar com o PDF original.
--
-- REGRAS A IMPLEMENTAR NA API/TRANSACOES (nao garantidas apenas por este DDL):
-- - Impedir intervalos sobrepostos para profissional, cliente, sala e equipamento.
--   Consultar inicio_existente < novo_fim AND fim_existente > novo_inicio,
--   ignorar cancelados e bloquear recursos em ordem fixa durante a transacao.
-- - Conferir validade, procedimento e saldo do pacote ao reservar/concluir.
-- - Atualizar sessoes_utilizadas exatamente uma vez ao concluir atendimento.
-- - Manter saldo do lote e MovimentacaoEstoque na MESMA transacao, sem saldo negativo;
--   registrar uma saida para cada consumo; ProdutoAplicado e o registro clinico.
-- - Validar soma das parcelas, quantidade de parcelas e status do pagamento.
-- - So aceitar avaliacao de agendamento concluido e validar CPF na aplicacao.
-- - Autenticacao, envio de e-mail, cobranca real e notificacoes nao estao neste DDL.
-- - Este SQL NAO e uma migracao do ZIP anterior (customers/bookings/treatments).
--   A API Next.js anterior precisa ser adaptada; dados anteriores nao sao migrados.
-- VALIDACAO: revisao estrutural e dos dados; nao executado em servidor MySQL aqui.
-- Documentacao: https://dev.mysql.com/doc/refman/8.4/en/create-table.html
-- https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html
-- https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html

SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS bellapelle_modelo
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE bellapelle_modelo;
-- Datas/horarios de agenda representam horario local de Sao Paulo.

-- Cliente
CREATE TABLE Cliente (
 id_cliente INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nome_completo VARCHAR(150) NOT NULL,
 cpf CHAR(11) NOT NULL UNIQUE,
 data_nascimento DATE NOT NULL,
 genero VARCHAR(40), telefone VARCHAR(20), email VARCHAR(254) NOT NULL UNIQUE,
 endereco VARCHAR(255), como_conheceu VARCHAR(100), preferencias TEXT,
 data_cadastro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT ck_cliente_cpf CHECK (CHAR_LENGTH(cpf) = 11)
) ENGINE=InnoDB;

-- Profissional
CREATE TABLE Profissional (
 id_profissional INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nome VARCHAR(150) NOT NULL, especialidade VARCHAR(120) NOT NULL,
 registro_profissional VARCHAR(60) UNIQUE,
 telefone VARCHAR(20), email VARCHAR(254) NOT NULL UNIQUE,
 data_admissao DATE NOT NULL,
 foto_url VARCHAR(500), anos_experiencia SMALLINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- Procedimento
CREATE TABLE Procedimento (
 id_procedimento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nome VARCHAR(150) NOT NULL UNIQUE, categoria VARCHAR(60) NOT NULL,
 duracao_minutos SMALLINT UNSIGNED NOT NULL,
 valor_avulso DECIMAL(10,2) NOT NULL,
 exige_registro_foto BOOLEAN NOT NULL DEFAULT FALSE,
 descricao TEXT, imagem_url VARCHAR(500),
 CONSTRAINT ck_proc_duracao CHECK (duracao_minutos > 0),
 CONSTRAINT ck_proc_valor CHECK (valor_avulso >= 0),
 CONSTRAINT ck_proc_foto CHECK (exige_registro_foto IN (0,1))
) ENGINE=InnoDB;

-- Sala
CREATE TABLE Sala (
 id_sala INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(80) NOT NULL UNIQUE, descricao VARCHAR(255)
) ENGINE=InnoDB;

-- Equipamento
CREATE TABLE Equipamento (
 id_equipamento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(120) NOT NULL, tipo VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

-- ProfissionalProcedimento
CREATE TABLE ProfissionalProcedimento (
 id_prof_procedimento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_profissional INT UNSIGNED NOT NULL, id_procedimento INT UNSIGNED NOT NULL,
 percentual_comissao DECIMAL(5,2) NOT NULL DEFAULT 0,
 UNIQUE KEY uq_habilitacao (id_profissional, id_procedimento),
 FOREIGN KEY (id_profissional) REFERENCES Profissional(id_profissional),
 FOREIGN KEY (id_procedimento) REFERENCES Procedimento(id_procedimento),
 CONSTRAINT ck_comissao CHECK (percentual_comissao BETWEEN 0 AND 100)
) ENGINE=InnoDB;

-- Anamnese
CREATE TABLE Anamnese (
 id_anamnese INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_cliente INT UNSIGNED NOT NULL, id_profissional INT UNSIGNED NOT NULL,
 gestante_lactante BOOLEAN NOT NULL DEFAULT FALSE,
 marcapasso BOOLEAN NOT NULL DEFAULT FALSE,
 proteses_metalicas BOOLEAN NOT NULL DEFAULT FALSE,
 alergia_acidos_anestesicos TEXT,
 uso_isotretinoina BOOLEAN NOT NULL DEFAULT FALSE,
 tendencia_queloide BOOLEAN NOT NULL DEFAULT FALSE,
 lesoes_ativas_pele TEXT,
 fototipo_fitzpatrick TINYINT UNSIGNED,
 medida_cintura DECIMAL(5,2), medida_quadril DECIMAL(5,2), medida_coxa DECIMAL(5,2),
 data_avaliacao DATETIME NOT NULL,
 FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
 FOREIGN KEY (id_profissional) REFERENCES Profissional(id_profissional),
 CONSTRAINT ck_fototipo CHECK (fototipo_fitzpatrick BETWEEN 1 AND 6),
 CONSTRAINT ck_medidas CHECK ((medida_cintura IS NULL OR medida_cintura > 0)
  AND (medida_quadril IS NULL OR medida_quadril > 0)
  AND (medida_coxa IS NULL OR medida_coxa > 0)),
 CONSTRAINT ck_anamnese_flags CHECK (gestante_lactante IN (0,1) AND marcapasso IN (0,1)
  AND proteses_metalicas IN (0,1) AND uso_isotretinoina IN (0,1) AND tendencia_queloide IN (0,1))
) ENGINE=InnoDB;

-- Pacote
CREATE TABLE Pacote (
 id_pacote INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, id_procedimento INT UNSIGNED NOT NULL,
 nome VARCHAR(150) NOT NULL, quantidade_sessoes SMALLINT UNSIGNED NOT NULL,
 validade_meses SMALLINT UNSIGNED NOT NULL, valor_total DECIMAL(10,2) NOT NULL,
 FOREIGN KEY (id_procedimento) REFERENCES Procedimento(id_procedimento),
 CONSTRAINT ck_pacote CHECK (quantidade_sessoes > 0 AND validade_meses > 0 AND valor_total >= 0)
) ENGINE=InnoDB;

-- PacoteCliente
CREATE TABLE PacoteCliente (
 id_pacote_cliente INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_cliente INT UNSIGNED NOT NULL, id_pacote INT UNSIGNED NOT NULL,
 data_compra DATE NOT NULL, data_validade DATE NOT NULL,
 sessoes_contratadas SMALLINT UNSIGNED NOT NULL,
 sessoes_utilizadas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 sessoes_restantes SMALLINT GENERATED ALWAYS AS (sessoes_contratadas - sessoes_utilizadas) STORED,
 valor_contratado DECIMAL(10,2) NOT NULL,
 status_pagamento ENUM('pendente','parcial','pago','estornado') NOT NULL DEFAULT 'pendente',
 UNIQUE KEY uq_pacote_cliente_dono (id_pacote_cliente, id_cliente),
 FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
 FOREIGN KEY (id_pacote) REFERENCES Pacote(id_pacote),
 CONSTRAINT ck_pc_sessoes CHECK (sessoes_contratadas > 0 AND sessoes_utilizadas <= sessoes_contratadas),
 CONSTRAINT ck_pc_datas CHECK (data_validade >= data_compra),
 CONSTRAINT ck_pc_valor CHECK (valor_contratado >= 0)
) ENGINE=InnoDB;

-- Agendamento
CREATE TABLE Agendamento (
 id_agendamento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_cliente INT UNSIGNED NOT NULL, id_profissional INT UNSIGNED NOT NULL,
 id_sala INT UNSIGNED NOT NULL, id_equipamento INT UNSIGNED NULL,
 id_procedimento INT UNSIGNED NOT NULL, id_pacote_cliente INT UNSIGNED NULL,
 data_hora_inicio DATETIME NOT NULL, data_hora_fim DATETIME NOT NULL,
 status ENUM('pendente','confirmado','concluido','cancelado','nao_compareceu') NOT NULL DEFAULT 'confirmado',
 origem_solicitacao ENUM('aplicativo','recepcao','telefone','whatsapp') NOT NULL DEFAULT 'aplicativo',
 valor_sessao DECIMAL(10,2) NOT NULL,
 UNIQUE KEY uq_agendamento_dono (id_agendamento, id_cliente),
 INDEX ix_agenda_profissional (id_profissional, data_hora_inicio, data_hora_fim),
 INDEX ix_agenda_sala (id_sala, data_hora_inicio, data_hora_fim),
 INDEX ix_agenda_equipamento (id_equipamento, data_hora_inicio, data_hora_fim),
 INDEX ix_agenda_cliente (id_cliente, data_hora_inicio),
 FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
 FOREIGN KEY (id_profissional, id_procedimento)
  REFERENCES ProfissionalProcedimento(id_profissional, id_procedimento),
 FOREIGN KEY (id_sala) REFERENCES Sala(id_sala),
 FOREIGN KEY (id_equipamento) REFERENCES Equipamento(id_equipamento),
 FOREIGN KEY (id_pacote_cliente, id_cliente) REFERENCES PacoteCliente(id_pacote_cliente, id_cliente),
 CONSTRAINT ck_agenda_intervalo CHECK (data_hora_fim > data_hora_inicio),
 CONSTRAINT ck_agenda_valor CHECK (valor_sessao >= 0)
) ENGINE=InnoDB;

-- Atendimento
CREATE TABLE Atendimento (
 id_atendimento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, id_agendamento INT UNSIGNED NOT NULL UNIQUE,
 regiao_corpo_tratada VARCHAR(150) NOT NULL, parametros_utilizados TEXT,
 descricao_evolucao TEXT, data_atendimento DATETIME NOT NULL,
 FOREIGN KEY (id_agendamento) REFERENCES Agendamento(id_agendamento)
) ENGINE=InnoDB;

-- Produto
CREATE TABLE Produto (
 id_produto INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(150) NOT NULL,
 categoria VARCHAR(80) NOT NULL, marca VARCHAR(100) NOT NULL,
 quantidade_estoque DECIMAL(12,3) NOT NULL DEFAULT 0,
 saldo_inicial DECIMAL(12,3) NOT NULL DEFAULT 0,
 unidade_medida ENUM('un','ml','g') NOT NULL DEFAULT 'un',
 numero_lote VARCHAR(80) NOT NULL, data_validade DATE NOT NULL,
 valor_unitario DECIMAL(10,2) NOT NULL,
 UNIQUE KEY uq_produto_lote (nome, marca, numero_lote),
 CONSTRAINT ck_produto_saldo CHECK (quantidade_estoque >= 0 AND saldo_inicial >= 0 AND valor_unitario >= 0)
) ENGINE=InnoDB;

-- ProdutoAplicado
CREATE TABLE ProdutoAplicado (
 id_produto_aplicado INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_atendimento INT UNSIGNED NOT NULL, id_produto INT UNSIGNED NOT NULL,
 nome_produto VARCHAR(150) NOT NULL, marca VARCHAR(100) NOT NULL,
 numero_lote VARCHAR(80) NOT NULL, data_validade DATE NOT NULL,
 quantidade DECIMAL(12,3) NOT NULL,
 FOREIGN KEY (id_atendimento) REFERENCES Atendimento(id_atendimento),
 FOREIGN KEY (id_produto) REFERENCES Produto(id_produto),
 CONSTRAINT ck_aplicado_qtd CHECK (quantidade > 0)
) ENGINE=InnoDB;

-- MovimentacaoEstoque
CREATE TABLE MovimentacaoEstoque (
 id_movimentacao INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_produto INT UNSIGNED NOT NULL, id_atendimento INT UNSIGNED NULL,
 tipo ENUM('entrada','saida') NOT NULL, quantidade DECIMAL(12,3) NOT NULL,
 data DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (id_produto) REFERENCES Produto(id_produto),
 FOREIGN KEY (id_atendimento) REFERENCES Atendimento(id_atendimento),
 CONSTRAINT ck_mov_qtd CHECK (quantidade > 0)
) ENGINE=InnoDB;

-- Pagamento
CREATE TABLE Pagamento (
 id_pagamento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, id_cliente INT UNSIGNED NOT NULL,
 id_pacote_cliente INT UNSIGNED NULL, id_agendamento INT UNSIGNED NULL,
 forma_pagamento ENUM('pix','cartao_credito','cartao_debito','dinheiro') NOT NULL,
 valor_total DECIMAL(10,2) NOT NULL, numero_parcelas SMALLINT UNSIGNED NOT NULL DEFAULT 1,
 data_pagamento DATETIME NULL,
 status ENUM('pendente','parcial','pago','cancelado','estornado') NOT NULL DEFAULT 'pendente',
 FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
 FOREIGN KEY (id_pacote_cliente, id_cliente) REFERENCES PacoteCliente(id_pacote_cliente, id_cliente),
 FOREIGN KEY (id_agendamento, id_cliente) REFERENCES Agendamento(id_agendamento, id_cliente),
 CONSTRAINT ck_pagamento_destino CHECK ((id_pacote_cliente IS NOT NULL AND id_agendamento IS NULL)
  OR (id_pacote_cliente IS NULL AND id_agendamento IS NOT NULL)),
 CONSTRAINT ck_pagamento_valores CHECK (valor_total >= 0 AND numero_parcelas > 0),
 CONSTRAINT ck_pagamento_data CHECK (status <> 'pago' OR data_pagamento IS NOT NULL)
) ENGINE=InnoDB;

-- Parcela
CREATE TABLE Parcela (
 id_parcela INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, id_pagamento INT UNSIGNED NOT NULL,
 numero_parcela SMALLINT UNSIGNED NOT NULL, valor_parcela DECIMAL(10,2) NOT NULL,
 data_vencimento DATE NOT NULL, data_pagamento DATETIME NULL,
 status ENUM('pendente','paga','cancelada') NOT NULL DEFAULT 'pendente',
 UNIQUE KEY uq_parcela (id_pagamento, numero_parcela),
 FOREIGN KEY (id_pagamento) REFERENCES Pagamento(id_pagamento),
 CONSTRAINT ck_parcela_valores CHECK (numero_parcela > 0 AND valor_parcela >= 0),
 CONSTRAINT ck_parcela_data CHECK (status <> 'paga' OR data_pagamento IS NOT NULL)
) ENGINE=InnoDB;

-- Favorito
CREATE TABLE Favorito (
 id_cliente INT UNSIGNED NOT NULL, id_procedimento INT UNSIGNED NOT NULL,
 data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (id_cliente, id_procedimento),
 FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
 FOREIGN KEY (id_procedimento) REFERENCES Procedimento(id_procedimento)
) ENGINE=InnoDB;

-- Avaliacao
CREATE TABLE Avaliacao (
 id_avaliacao INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, id_agendamento INT UNSIGNED NOT NULL UNIQUE,
 nota TINYINT UNSIGNED NOT NULL, comentario TEXT,
 data_avaliacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (id_agendamento) REFERENCES Agendamento(id_agendamento),
 CONSTRAINT ck_avaliacao_nota CHECK (nota BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- DADOS DE EXEMPLO: 5 linhas por tabela.
START TRANSACTION;

-- Estoque: lote inicia com 10 ml no corte de implantacao; as 5 saidas
-- abaixo deixam saldo zero. Saldo anterior ao corte nao tem movimentacao nesta amostra.
-- Cinco registros: Cliente
INSERT INTO Cliente (id_cliente,nome_completo,cpf,data_nascimento,genero,telefone,email,endereco,como_conheceu,preferencias) VALUES
 (1, 'Amanda Silva', '00000000001', '1991-05-10', 'Feminino', '11900000001', 'cliente1@example.com', 'Rua Exemplo, 100 - São Paulo/SP', 'Aplicativo', 'Atendimento no período da manhã'),
 (2, 'Beatriz Costa', '00000000002', '1992-05-10', 'Feminino', '11900000002', 'cliente2@example.com', 'Rua Exemplo, 200 - São Paulo/SP', 'Aplicativo', 'Atendimento no período da manhã'),
 (3, 'Carolina Lima', '00000000003', '1993-05-10', 'Feminino', '11900000003', 'cliente3@example.com', 'Rua Exemplo, 300 - São Paulo/SP', 'Aplicativo', 'Atendimento no período da manhã'),
 (4, 'Daniela Rocha', '00000000004', '1994-05-10', 'Feminino', '11900000004', 'cliente4@example.com', 'Rua Exemplo, 400 - São Paulo/SP', 'Aplicativo', 'Atendimento no período da manhã'),
 (5, 'Elisa Martins', '00000000005', '1995-05-10', 'Feminino', '11900000005', 'cliente5@example.com', 'Rua Exemplo, 500 - São Paulo/SP', 'Aplicativo', 'Atendimento no período da manhã');

-- Cinco registros: Profissional
INSERT INTO Profissional (id_profissional,nome,especialidade,registro_profissional,telefone,email,data_admissao,anos_experiencia) VALUES
 (1, 'Dra. Marina Alves', 'Estética facial e corporal', 'REG-TESTE-1', '11910000001', 'profissional1@example.com', '2020-01-10', 8),
 (2, 'Camila Santos', 'Estética facial e corporal', 'REG-TESTE-2', '11910000002', 'profissional2@example.com', '2020-01-10', 7),
 (3, 'Renata Oliveira', 'Estética facial e corporal', 'REG-TESTE-3', '11910000003', 'profissional3@example.com', '2020-01-10', 6),
 (4, 'Paula Mendes', 'Estética facial e corporal', 'REG-TESTE-4', '11910000004', 'profissional4@example.com', '2020-01-10', 5),
 (5, 'Fernanda Souza', 'Estética facial e corporal', 'REG-TESTE-5', '11910000005', 'profissional5@example.com', '2020-01-10', 4);

-- Cinco registros: Procedimento
INSERT INTO Procedimento (id_procedimento,nome,categoria,duracao_minutos,valor_avulso,exige_registro_foto,descricao,imagem_url) VALUES
 (1, 'Hidratação facial premium', 'Facial', 35, 120, 0, 'Limpeza, hidratação e revitalização', '/images/facial-card.jpg'),
 (2, 'Massagem modeladora', 'Corporal', 45, 150, 0, 'Técnica para contorno corporal', '/images/massagem.jpg'),
 (3, 'Depilação a laser', 'Depilação', 30, 180, 1, 'Tecnologia segura e confortável', '/images/depilacao.jpg'),
 (4, 'Limpeza de pele', 'Facial', 60, 100, 0, 'Higienização e cuidado facial', '/images/facial-card.jpg'),
 (5, 'Radiofrequência corporal', 'Tecnologia', 40, 200, 1, 'Tratamento corporal com avaliação individual', '/images/tecnologia.jpg');

-- Cinco registros: Sala
INSERT INTO Sala (id_sala,nome,descricao) VALUES
 (1, 'Sala 1', 'Sala de atendimento 1'),
 (2, 'Sala 2', 'Sala de atendimento 2'),
 (3, 'Sala 3', 'Sala de atendimento 3'),
 (4, 'Sala 4', 'Sala de atendimento 4'),
 (5, 'Sala 5', 'Sala de atendimento 5');

-- Cinco registros: Equipamento
INSERT INTO Equipamento (id_equipamento,nome,tipo) VALUES
 (1, 'Vapor de ozônio 01', 'Vapor'),
 (2, 'Ultrassom 01', 'Ultrassom'),
 (3, 'Laser 01', 'Laser'),
 (4, 'Vapor de ozônio 02', 'Vapor'),
 (5, 'Radiofrequência 01', 'Radiofrequência');

-- Cinco registros: ProfissionalProcedimento
INSERT INTO ProfissionalProcedimento (id_prof_procedimento,id_profissional,id_procedimento,percentual_comissao) VALUES
 (1, 1, 1, 30),
 (2, 2, 2, 30),
 (3, 3, 3, 30),
 (4, 4, 4, 30),
 (5, 5, 5, 30);

-- Cinco registros: Anamnese
INSERT INTO Anamnese (id_anamnese,id_cliente,id_profissional,gestante_lactante,marcapasso,proteses_metalicas,alergia_acidos_anestesicos,uso_isotretinoina,tendencia_queloide,lesoes_ativas_pele,fototipo_fitzpatrick,medida_cintura,medida_quadril,medida_coxa,data_avaliacao) VALUES
 (1, 1, 1, 0, 0, 0, 'Não relatada', 0, 0, 'Não relatadas', 1, 71, 96, 51, '2026-10-01 08:00:00'),
 (2, 2, 2, 0, 0, 0, 'Não relatada', 0, 0, 'Não relatadas', 2, 72, 97, 52, '2026-10-01 08:00:00'),
 (3, 3, 3, 0, 0, 0, 'Não relatada', 0, 0, 'Não relatadas', 3, 73, 98, 53, '2026-10-01 08:00:00'),
 (4, 4, 4, 0, 0, 0, 'Não relatada', 0, 0, 'Não relatadas', 4, 74, 99, 54, '2026-10-01 08:00:00'),
 (5, 5, 5, 0, 0, 0, 'Não relatada', 0, 0, 'Não relatadas', 5, 75, 100, 55, '2026-10-01 08:00:00');

-- Cinco registros: Pacote
INSERT INTO Pacote (id_pacote,id_procedimento,nome,quantidade_sessoes,validade_meses,valor_total) VALUES
 (1, 1, 'Pacote Hidratação facial premium', 5, 6, 480),
 (2, 2, 'Pacote Massagem modeladora', 5, 6, 600),
 (3, 3, 'Pacote Depilação a laser', 5, 6, 720),
 (4, 4, 'Pacote Limpeza de pele', 5, 6, 400),
 (5, 5, 'Pacote Radiofrequência corporal', 5, 6, 800);

-- Cinco registros: PacoteCliente
INSERT INTO PacoteCliente (id_pacote_cliente,id_cliente,id_pacote,data_compra,data_validade,sessoes_contratadas,sessoes_utilizadas,valor_contratado,status_pagamento) VALUES
 (1, 1, 1, '2026-10-04', '2027-04-04', 5, 0, 480, 'pendente'),
 (2, 2, 2, '2026-10-04', '2027-04-04', 5, 0, 600, 'pendente'),
 (3, 3, 3, '2026-10-04', '2027-04-04', 5, 0, 720, 'pendente'),
 (4, 4, 4, '2026-10-04', '2027-04-04', 5, 0, 400, 'pendente'),
 (5, 5, 5, '2026-10-04', '2027-04-04', 5, 0, 800, 'pendente');

-- Cinco registros: Agendamento
INSERT INTO Agendamento (id_agendamento,id_cliente,id_profissional,id_sala,id_equipamento,id_procedimento,id_pacote_cliente,data_hora_inicio,data_hora_fim,status,origem_solicitacao,valor_sessao) VALUES
 (1, 1, 1, 1, 1, 1, NULL, '2026-10-03 11:00:00', '2026-10-03 11:35:00', 'concluido', 'aplicativo', 120),
 (2, 2, 2, 2, NULL, 2, NULL, '2026-10-03 11:00:00', '2026-10-03 11:45:00', 'concluido', 'aplicativo', 150),
 (3, 3, 3, 3, 3, 3, NULL, '2026-10-03 11:00:00', '2026-10-03 11:30:00', 'concluido', 'aplicativo', 180),
 (4, 4, 4, 4, 4, 4, NULL, '2026-10-03 11:00:00', '2026-10-03 12:00:00', 'concluido', 'aplicativo', 100),
 (5, 5, 5, 5, 5, 5, NULL, '2026-10-03 11:00:00', '2026-10-03 11:40:00', 'concluido', 'aplicativo', 200);

-- Cinco registros: Atendimento
INSERT INTO Atendimento (id_atendimento,id_agendamento,regiao_corpo_tratada,parametros_utilizados,descricao_evolucao,data_atendimento) VALUES
 (1, 1, 'Face', 'Registro fictício para demonstração do sistema', 'Sessão concluída; dados de exemplo.', '2026-10-03 11:00:00'),
 (2, 2, 'Abdômen', 'Registro fictício para demonstração do sistema', 'Sessão concluída; dados de exemplo.', '2026-10-03 11:00:00'),
 (3, 3, 'Pernas', 'Registro fictício para demonstração do sistema', 'Sessão concluída; dados de exemplo.', '2026-10-03 11:00:00'),
 (4, 4, 'Face', 'Registro fictício para demonstração do sistema', 'Sessão concluída; dados de exemplo.', '2026-10-03 11:00:00'),
 (5, 5, 'Abdômen', 'Registro fictício para demonstração do sistema', 'Sessão concluída; dados de exemplo.', '2026-10-03 11:00:00');

-- Cinco registros: Produto
INSERT INTO Produto (id_produto,nome,categoria,marca,quantidade_estoque,saldo_inicial,unidade_medida,numero_lote,data_validade,valor_unitario) VALUES
 (1, 'Máscara hidratante', 'Cosmético', 'Marca Exemplo', 0, 10, 'ml', 'LOTE-001', '2027-12-31', 1),
 (2, 'Creme de massagem', 'Cosmético', 'Marca Exemplo', 0, 10, 'ml', 'LOTE-002', '2027-12-31', 1),
 (3, 'Gel para laser', 'Cosmético', 'Marca Exemplo', 0, 10, 'ml', 'LOTE-003', '2027-12-31', 1),
 (4, 'Sabonete facial', 'Cosmético', 'Marca Exemplo', 0, 10, 'ml', 'LOTE-004', '2027-12-31', 1),
 (5, 'Gel condutor', 'Cosmético', 'Marca Exemplo', 0, 10, 'ml', 'LOTE-005', '2027-12-31', 1);

-- Cinco registros: ProdutoAplicado
INSERT INTO ProdutoAplicado (id_produto_aplicado,id_atendimento,id_produto,nome_produto,marca,numero_lote,data_validade,quantidade) VALUES
 (1, 1, 1, 'Máscara hidratante', 'Marca Exemplo', 'LOTE-001', '2027-12-31', 10),
 (2, 2, 2, 'Creme de massagem', 'Marca Exemplo', 'LOTE-002', '2027-12-31', 10),
 (3, 3, 3, 'Gel para laser', 'Marca Exemplo', 'LOTE-003', '2027-12-31', 10),
 (4, 4, 4, 'Sabonete facial', 'Marca Exemplo', 'LOTE-004', '2027-12-31', 10),
 (5, 5, 5, 'Gel condutor', 'Marca Exemplo', 'LOTE-005', '2027-12-31', 10);

-- Cinco registros: MovimentacaoEstoque
INSERT INTO MovimentacaoEstoque (id_movimentacao,id_produto,id_atendimento,tipo,quantidade,data) VALUES
 (1, 1, 1, 'saida', 10, '2026-10-03 11:00:00'),
 (2, 2, 2, 'saida', 10, '2026-10-03 11:00:00'),
 (3, 3, 3, 'saida', 10, '2026-10-03 11:00:00'),
 (4, 4, 4, 'saida', 10, '2026-10-03 11:00:00'),
 (5, 5, 5, 'saida', 10, '2026-10-03 11:00:00');

-- Cinco registros: Pagamento
INSERT INTO Pagamento (id_pagamento,id_cliente,id_pacote_cliente,id_agendamento,forma_pagamento,valor_total,numero_parcelas,data_pagamento,status) VALUES
 (1, 1, NULL, 1, 'pix', 120, 1, '2026-10-03 12:30:00', 'pago'),
 (2, 2, NULL, 2, 'cartao_credito', 150, 1, '2026-10-03 12:30:00', 'pago'),
 (3, 3, NULL, 3, 'pix', 180, 1, '2026-10-03 12:30:00', 'pago'),
 (4, 4, NULL, 4, 'cartao_credito', 100, 1, '2026-10-03 12:30:00', 'pago'),
 (5, 5, NULL, 5, 'pix', 200, 1, '2026-10-03 12:30:00', 'pago');

-- Cinco registros: Parcela
INSERT INTO Parcela (id_parcela,id_pagamento,numero_parcela,valor_parcela,data_vencimento,data_pagamento,status) VALUES
 (1, 1, 1, 120, '2026-10-03', '2026-10-03 12:30:00', 'paga'),
 (2, 2, 1, 150, '2026-10-03', '2026-10-03 12:30:00', 'paga'),
 (3, 3, 1, 180, '2026-10-03', '2026-10-03 12:30:00', 'paga'),
 (4, 4, 1, 100, '2026-10-03', '2026-10-03 12:30:00', 'paga'),
 (5, 5, 1, 200, '2026-10-03', '2026-10-03 12:30:00', 'paga');

-- Cinco registros: Favorito
INSERT INTO Favorito (id_cliente,id_procedimento) VALUES
 (1, 1),
 (2, 2),
 (3, 3),
 (4, 4),
 (5, 5);

-- Cinco registros: Avaliacao
INSERT INTO Avaliacao (id_avaliacao,id_agendamento,nota,comentario,data_avaliacao) VALUES
 (1, 1, 5, 'Avaliação fictícia para teste.', '2026-10-03 18:00:00'),
 (2, 2, 5, 'Avaliação fictícia para teste.', '2026-10-03 18:00:00'),
 (3, 3, 4, 'Avaliação fictícia para teste.', '2026-10-03 18:00:00'),
 (4, 4, 5, 'Avaliação fictícia para teste.', '2026-10-03 18:00:00'),
 (5, 5, 5, 'Avaliação fictícia para teste.', '2026-10-03 18:00:00');

COMMIT;

-- CONFERENCIA: cada tabela deve ter 5 registros no banco recem-criado.
SELECT 'Cliente' AS tabela, COUNT(*) AS registros FROM Cliente
UNION ALL
SELECT 'Profissional' AS tabela, COUNT(*) AS registros FROM Profissional
UNION ALL
SELECT 'Procedimento' AS tabela, COUNT(*) AS registros FROM Procedimento
UNION ALL
SELECT 'Sala' AS tabela, COUNT(*) AS registros FROM Sala
UNION ALL
SELECT 'Equipamento' AS tabela, COUNT(*) AS registros FROM Equipamento
UNION ALL
SELECT 'ProfissionalProcedimento' AS tabela, COUNT(*) AS registros FROM ProfissionalProcedimento
UNION ALL
SELECT 'Anamnese' AS tabela, COUNT(*) AS registros FROM Anamnese
UNION ALL
SELECT 'Pacote' AS tabela, COUNT(*) AS registros FROM Pacote
UNION ALL
SELECT 'PacoteCliente' AS tabela, COUNT(*) AS registros FROM PacoteCliente
UNION ALL
SELECT 'Agendamento' AS tabela, COUNT(*) AS registros FROM Agendamento
UNION ALL
SELECT 'Atendimento' AS tabela, COUNT(*) AS registros FROM Atendimento
UNION ALL
SELECT 'Produto' AS tabela, COUNT(*) AS registros FROM Produto
UNION ALL
SELECT 'ProdutoAplicado' AS tabela, COUNT(*) AS registros FROM ProdutoAplicado
UNION ALL
SELECT 'MovimentacaoEstoque' AS tabela, COUNT(*) AS registros FROM MovimentacaoEstoque
UNION ALL
SELECT 'Pagamento' AS tabela, COUNT(*) AS registros FROM Pagamento
UNION ALL
SELECT 'Parcela' AS tabela, COUNT(*) AS registros FROM Parcela
UNION ALL
SELECT 'Favorito' AS tabela, COUNT(*) AS registros FROM Favorito
UNION ALL
SELECT 'Avaliacao' AS tabela, COUNT(*) AS registros FROM Avaliacao;

-- Agenda com nomes e valores para o aplicativo.
SELECT a.id_agendamento, c.nome_completo AS cliente, p.nome AS profissional,
 pr.nome AS procedimento, a.data_hora_inicio, a.data_hora_fim, a.status,
 a.valor_sessao, s.nome AS sala
FROM Agendamento a
JOIN Cliente c ON c.id_cliente = a.id_cliente
JOIN Profissional p ON p.id_profissional = a.id_profissional
JOIN Procedimento pr ON pr.id_procedimento = a.id_procedimento
JOIN Sala s ON s.id_sala = a.id_sala
ORDER BY a.data_hora_inicio;

-- Avaliacoes reais do catalogo: nao fixar 4,9 ou 142 no aplicativo.
SELECT p.id_procedimento, p.nome, ROUND(AVG(av.nota),1) AS nota_media,
 COUNT(av.id_avaliacao) AS total_avaliacoes
FROM Procedimento p
LEFT JOIN Agendamento a ON a.id_procedimento = p.id_procedimento
LEFT JOIN Avaliacao av ON av.id_agendamento = a.id_agendamento
GROUP BY p.id_procedimento, p.nome;

-- Deve retornar zero linhas: divergencia entre total e parcelas.
SELECT p.id_pagamento, p.valor_total, COALESCE(SUM(pa.valor_parcela),0) AS soma_parcelas
FROM Pagamento p LEFT JOIN Parcela pa ON pa.id_pagamento = p.id_pagamento
GROUP BY p.id_pagamento, p.valor_total, p.numero_parcelas
HAVING p.valor_total <> COALESCE(SUM(pa.valor_parcela),0)
 OR p.numero_parcelas <> COUNT(pa.id_parcela);

-- Deve retornar zero linhas: saldo inicial + entradas - saidas diferente do estoque.
SELECT p.id_produto, p.quantidade_estoque,
 p.saldo_inicial + COALESCE(SUM(CASE WHEN m.tipo='entrada' THEN m.quantidade ELSE -m.quantidade END),0) AS saldo_calculado
FROM Produto p LEFT JOIN MovimentacaoEstoque m ON m.id_produto=p.id_produto
GROUP BY p.id_produto,p.quantidade_estoque,p.saldo_inicial
HAVING p.quantidade_estoque <> saldo_calculado;
