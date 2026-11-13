-- Extensoes aditivas. Execute DEPOIS de BellaPelle-MySQL.sql, no mesmo banco.
-- Nenhuma tabela clinica e apagada ou renomeada.
CREATE TABLE IF NOT EXISTS SessaoCliente (
 token_hash CHAR(64) PRIMARY KEY,
 id_cliente INT UNSIGNED NOT NULL,
 expira_em DATETIME NOT NULL,
 FOREIGN KEY (id_cliente) REFERENCES Cliente(id_cliente),
 INDEX ix_sessao_expira (expira_em)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ControleAgenda (
 id TINYINT UNSIGNED PRIMARY KEY
) ENGINE=InnoDB;
INSERT IGNORE INTO ControleAgenda (id) VALUES (1);
CREATE TABLE IF NOT EXISTS AgendaConfiguracao (
 id_procedimento INT UNSIGNED PRIMARY KEY,
 id_profissional INT UNSIGNED NOT NULL,
 id_sala INT UNSIGNED NOT NULL,
 id_equipamento INT UNSIGNED NULL,
 FOREIGN KEY (id_profissional,id_procedimento)
  REFERENCES ProfissionalProcedimento(id_profissional,id_procedimento),
 FOREIGN KEY (id_sala) REFERENCES Sala(id_sala),
 FOREIGN KEY (id_equipamento) REFERENCES Equipamento(id_equipamento)
) ENGINE=InnoDB;
-- Configuracao dos CINCO procedimentos de exemplo do SQL entregue.
-- Ajuste explicitamente esta tabela se profissionais/recursos reais forem outros.
INSERT IGNORE INTO AgendaConfiguracao
 (id_procedimento,id_profissional,id_sala,id_equipamento)
SELECT p.id_procedimento, pp.id_profissional, s.id_sala,
 CASE WHEN p.id_procedimento=2 THEN NULL ELSE e.id_equipamento END
FROM Procedimento p
JOIN ProfissionalProcedimento pp ON pp.id_procedimento=p.id_procedimento
 AND pp.id_profissional=p.id_procedimento
JOIN Sala s ON s.id_sala=p.id_procedimento
LEFT JOIN Equipamento e ON e.id_equipamento=p.id_procedimento
WHERE p.id_procedimento BETWEEN 1 AND 5;
