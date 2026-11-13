CREATE TABLE ConfiguracaoPublica (
  id TINYINT UNSIGNED PRIMARY KEY,
  telefone VARCHAR(30) NULL,
  whatsapp VARCHAR(30) NULL,
  email VARCHAR(254) NULL,
  endereco VARCHAR(255) NULL,
  horario_atendimento VARCHAR(500) NULL,
  cnpj VARCHAR(18) NULL,
  politica_privacidade MEDIUMTEXT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT ck_configuracao_publica_id CHECK (id = 1)
) ENGINE=InnoDB;

INSERT INTO ConfiguracaoPublica (id) VALUES (1);
