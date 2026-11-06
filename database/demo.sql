-- Dados inteiramente fictícios. Uso exclusivo em desenvolvimento.

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

