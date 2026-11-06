SET NAMES utf8mb4;
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

