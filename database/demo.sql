-- Conteúdo totalmente fictício, somente para um banco local de demonstração.
-- O script scripts/seed.mjs exige ALLOW_DEMO_SEED=true e banco sem clientes.
-- Mantém 10 registros nas tabelas de negócio com múltiplos registros.
START TRANSACTION;

CREATE TEMPORARY TABLE DemoSeq (n TINYINT UNSIGNED PRIMARY KEY);
INSERT INTO DemoSeq VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10);

INSERT INTO Cliente(id_cliente,nome_completo,cpf,data_nascimento,genero,telefone,email,endereco,como_conheceu,preferencias)
SELECT n, ELT(n,'Amanda Silva','Beatriz Costa','Carolina Lima','Daniela Rocha','Elisa Martins','Flávia Nunes','Gabriela Ribeiro','Helena Barros','Isabela Freitas','Juliana Cardoso'),
       CONCAT('900000000',LPAD(n,2,'0')), DATE_SUB('1998-01-10',INTERVAL n YEAR),'Feminino',CONCAT('119000000',LPAD(n,2,'0')),
       CONCAT('cliente',n,'@example.com'),CONCAT('Rua de Demonstração, ',n*10,', São Paulo/SP'),'Site','Dados fictícios para ambiente local'
FROM DemoSeq;

INSERT INTO Profissional(id_profissional,nome,especialidade,registro_profissional,telefone,email,data_admissao,foto_url,anos_experiencia)
SELECT n,ELT(n,'Dra. Marina Alves','Camila Santos','Renata Oliveira','Paula Mendes','Fernanda Souza','Bianca Teixeira','Larissa Moraes','Natália Campos','Patrícia Azevedo','Sofia Martins'),
       ELT(n,'Estética facial','Estética corporal','Laser e tecnologia','Estética facial','Massoterapia','Estética corporal','Estética facial','Laser e tecnologia','Dermocosmética','Estética integrativa'),
       CONCAT('DEMO-REG-',LPAD(n,2,'0')),CONCAT('119100000',LPAD(n,2,'0')),CONCAT('profissional',n,'@example.com'),DATE_SUB(CURRENT_DATE,INTERVAL (n+2) YEAR),
       CASE MOD(n,3) WHEN 0 THEN '/images/bellapelle-team3-new.webp' WHEN 1 THEN '/images/bellapelle-team-new.webp' ELSE '/images/bellapelle-team2-new.webp' END,11-n FROM DemoSeq;

INSERT INTO Procedimento(id_procedimento,nome,categoria,duracao_minutos,valor_avulso,exige_registro_foto,descricao,imagem_url)
SELECT n,
       ELT(n,'Limpeza e hidratação facial','Massagem relaxante','Depilação a laser','Microagulhamento facial','Radiofrequência corporal','Peeling superficial','Drenagem linfática','Revitalização facial','Tratamento de manchas','Cuidado facial premium'),
       ELT(n,'Facial','Corporal','Depilação','Facial','Tecnologia','Facial','Corporal','Facial','Tecnologia','Facial'),
       ELT(n,50,60,35,60,45,40,55,45,50,70),ELT(n,160,190,180,260,220,170,180,200,240,290),
       IF(n IN (3,4,5,9),1,0),
       ELT(n,'Higienização e hidratação com avaliação individual.','Massagem corporal realizada por profissional habilitada.','Tecnologia aplicada conforme avaliação e protocolo.','Cuidado facial conduzido após avaliação profissional.','Tratamento tecnológico com plano individualizado.','Renovação da pele com orientação profissional.','Manobras suaves para promover bem-estar e conforto.','Ritual facial de cuidado e hidratação.','Plano de cuidado sujeito à avaliação individual.','Atendimento personalizado com acompanhamento profissional.'),
       CASE WHEN n IN (2,3,5,7) THEN '/images/bellapelle-body-new.webp' WHEN n IN (6,10) THEN '/images/bellapelle-editorial-new.webp' ELSE '/images/bellapelle-facial-new.webp' END
FROM DemoSeq;

INSERT INTO Sala(id_sala,nome,descricao) SELECT n,CONCAT('Sala ',LPAD(n,2,'0')),CONCAT('Sala de atendimento fictícia ',n) FROM DemoSeq;
INSERT INTO Equipamento(id_equipamento,nome,tipo) SELECT n,ELT(n,'Vapor de ozônio','Ultrassom','Laser diodo','Radiofrequência','LED facial','Peeling ultrassônico','Endermoterapia','Microcorrentes','Luz pulsada','Eletroestimulação'),ELT(n,'Vapor','Ultrassom','Laser','Radiofrequência','LED','Ultrassom','Corporal','Facial','Luz','Eletroterapia') FROM DemoSeq;

INSERT INTO ProfissionalProcedimento(id_prof_procedimento,id_profissional,id_procedimento,percentual_comissao) SELECT n,n,n,30 FROM DemoSeq;
INSERT INTO AgendaConfiguracao(id_procedimento,id_profissional,id_sala,id_equipamento) SELECT n,n,n,IF(n=2,NULL,n) FROM DemoSeq;

INSERT INTO Usuario(nome,email,senha_hash,perfil,id_profissional,permissoes)
SELECT ELT(n,'Admin Demo BellaPelle','Recepção Demo 01','Profissional Demo 02','Financeiro Demo','Estoque Demo','Recepção Demo 02','Profissional Demo 07','Financeiro Demo 02','Estoque Demo 02','Profissional Demo 10'),
       CONCAT('usuario.demo',LPAD(n,2,'0'),'@example.com'),'demo-password-pending',
       ELT(n,'administrador','recepcao','profissional','financeiro','estoque','recepcao','profissional','financeiro','estoque','profissional'),
       IF(n IN (3,7,10),n,NULL),NULL FROM DemoSeq;

INSERT INTO Anamnese(id_anamnese,id_cliente,id_profissional,gestante_lactante,marcapasso,proteses_metalicas,alergia_acidos_anestesicos,uso_isotretinoina,tendencia_queloide,lesoes_ativas_pele,fototipo_fitzpatrick,medida_cintura,medida_quadril,medida_coxa,data_avaliacao,contraindicacoes,id_autor)
SELECT n,n,n,0,0,0,'Nenhuma relatada — dado de demonstração.',0,0,'Nenhuma relatada — dado de demonstração.',MOD(n-1,6)+1,70+n,90+n,48+n,DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY),'Sem contraindicação fictícia; confirmar em avaliação real.',1 FROM DemoSeq;

INSERT INTO Pacote(id_pacote,id_procedimento,nome,quantidade_sessoes,validade_meses,valor_total)
SELECT n,n,CONCAT('Plano de cuidado ',ELT(n,'Hidratação','Relaxamento','Laser','Revitalização','Tecnologia','Renovação','Bem-estar','Luminosidade','Equilíbrio','BellaPelle'),' — 5 sessões'),5,6,ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2) FROM DemoSeq;
INSERT INTO PacoteCliente(id_pacote_cliente,id_cliente,id_pacote,data_compra,data_validade,sessoes_contratadas,sessoes_utilizadas,valor_contratado,status_pagamento)
SELECT n,n,n,DATE_SUB(CURRENT_DATE,INTERVAL (n+10) DAY),DATE_ADD(CURRENT_DATE,INTERVAL 170 DAY),5,1,ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2),'pago' FROM DemoSeq;

INSERT INTO Agendamento(id_agendamento,id_cliente,id_profissional,id_sala,id_equipamento,id_procedimento,id_pacote_cliente,data_hora_inicio,data_hora_fim,status,origem_solicitacao,valor_sessao)
SELECT n,n,n,n,IF(n=2,NULL,n),n,n,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),DATE_ADD(DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),INTERVAL ELT(n,50,60,35,60,45,40,55,45,50,70) MINUTE),'concluido',ELT(n,'aplicativo','recepcao','whatsapp','aplicativo','telefone','recepcao','aplicativo','whatsapp','telefone','recepcao'),ELT(n,160,190,180,260,220,170,180,200,240,290) FROM DemoSeq;

INSERT INTO Atendimento(id_atendimento,id_agendamento,regiao_corpo_tratada,parametros_utilizados,descricao_evolucao,data_atendimento,status,id_autor)
SELECT n,n,ELT(n,'Face','Ombros e costas','Pernas','Face','Abdômen','Face','Pernas','Face','Face','Face'),'Parâmetros ilustrativos — validar antes de qualquer atendimento real.','Registro fictício de demonstração; não representa prontuário de paciente.',DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),'concluido',1 FROM DemoSeq;

INSERT INTO Produto(id_produto,nome,categoria,marca,quantidade_estoque,saldo_inicial,unidade_medida,numero_lote,data_validade,valor_unitario,ativo,estoque_minimo)
SELECT n,ELT(n,'Máscara hidratante','Creme de massagem','Gel condutor','Sabonete facial','Sérum calmante','Gel pós-laser','Óleo vegetal','Máscara de argila','Protetor solar','Solução de limpeza'),'Cosmético','BellaPelle Demo',0,10,'ml',CONCAT('DEMO-LOTE-',LPAD(n,3,'0')),DATE_ADD(CURRENT_DATE,INTERVAL 365 DAY),5,1,2 FROM DemoSeq;
INSERT INTO ProdutoAplicado(id_produto_aplicado,id_atendimento,id_produto,nome_produto,marca,numero_lote,data_validade,quantidade)
SELECT n,n,n,ELT(n,'Máscara hidratante','Creme de massagem','Gel condutor','Sabonete facial','Sérum calmante','Gel pós-laser','Óleo vegetal','Máscara de argila','Protetor solar','Solução de limpeza'),'BellaPelle Demo',CONCAT('DEMO-LOTE-',LPAD(n,3,'0')),DATE_ADD(CURRENT_DATE,INTERVAL 365 DAY),10 FROM DemoSeq;
INSERT INTO MovimentacaoEstoque(id_movimentacao,id_produto,id_atendimento,tipo,quantidade,data,motivo,id_autor)
SELECT n,n,n,'saida',10,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),'Consumo fictício do registro de demonstração.',1 FROM DemoSeq;

INSERT INTO Pagamento(id_pagamento,id_cliente,id_pacote_cliente,id_agendamento,forma_pagamento,valor_total,numero_parcelas,data_pagamento,status)
SELECT n,n,n,NULL,ELT(n,'pix','cartao_credito','cartao_debito','dinheiro','pix','cartao_credito','pix','dinheiro','cartao_debito','pix'),ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2),1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+10) DAY),'pago' FROM DemoSeq;
INSERT INTO Parcela(id_parcela,id_pagamento,numero_parcela,valor_parcela,data_vencimento,data_pagamento,status,valor_recebido)
SELECT n,n,1,ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2),DATE_SUB(CURRENT_DATE,INTERVAL (n+10) DAY),DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+10) DAY),'paga',ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2) FROM DemoSeq;
INSERT INTO Favorito(id_cliente,id_procedimento) SELECT n,n FROM DemoSeq;
INSERT INTO Avaliacao(id_avaliacao,id_agendamento,nota,comentario,consentimento_publicacao,publicada,data_avaliacao)
SELECT n,n,ELT(n,5,5,4,5,5,4,5,5,4,5),ELT(n,'Experiência fictícia para testar a exibição das avaliações.','Exemplo de avaliação local, sem relação com cliente real.','Conteúdo demonstrativo para ambiente de desenvolvimento.','Texto fictício para conferir o layout dos depoimentos.','Registro de teste; não corresponde a uma avaliação real.','Avaliação ilustrativa para demonstração.','Texto de exemplo para validar a seção pública.','Conteúdo fictício usado somente no seed local.','Avaliação de demonstração, sem cliente real associado.','Registro ilustrativo para o ambiente de desenvolvimento.'),1,1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;

INSERT INTO Bloqueio(id_profissional,id_sala,id_equipamento,inicio,fim,motivo,ativo)
SELECT n,n,NULL,DATE_SUB(DATE_ADD(CURRENT_DATE,INTERVAL (n+30) DAY),INTERVAL 1 HOUR),DATE_ADD(CURRENT_DATE,INTERVAL (n+30) DAY),CONCAT('Bloqueio fictício de manutenção ',n),1 FROM DemoSeq;
INSERT INTO EventoAgenda(id_evento,id_agendamento,tipo,motivo,id_autor,data,sessao_consumida,politica_aplicada)
SELECT n,n,'conclusao','Agendamento concluído — registro fictício.',1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),1,'Demonstração: sessões ilustrativas consumidas.' FROM DemoSeq;
INSERT INTO ConsumoSessao(id_consumo,id_agendamento,id_pacote_cliente,data)
SELECT n,n,n,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY) FROM DemoSeq;
INSERT INTO Comissao(id_comissao,id_atendimento,id_profissional,base_calculo,percentual,valor,status,data,data_pagamento)
SELECT n,n,n,ELT(n,160,190,180,260,220,170,180,200,240,290),30,ROUND(ELT(n,160,190,180,260,220,170,180,200,240,290)*0.3,2),'paga',DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;
INSERT INTO Recebimento(id_recebimento,id_parcela,valor,tipo,id_autor,data,motivo)
SELECT n,n,ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2),'recebimento',1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+10) DAY),'Recebimento fictício quitado.' FROM DemoSeq;
INSERT INTO HistoricoPreco(id_historico,id_procedimento,valor,data,id_autor)
SELECT n,n,ELT(n,160,190,180,260,220,170,180,200,240,290),DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+30) DAY),1 FROM DemoSeq;

INSERT INTO Auditoria(id_auditoria,id_usuario,acao,recurso,id_registro,data)
SELECT n,1,'criar','registro_demo',n,DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;
INSERT INTO AuditoriaSeguranca(id,id_usuario,acao,recurso,criado_em)
SELECT n,1,'seed_demo','dados_ficticios',DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;
INSERT INTO ContaCliente(id_cliente,senha_hash) SELECT n,'demo-password-pending' FROM DemoSeq;
INSERT INTO AuditoriaCliente(id,id_cliente,acao,recurso,criado_em)
SELECT n,n,'cadastro_demo','conta',DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;
INSERT INTO VinculoClinico(id_vinculo,id_cliente,id_profissional,ativo) SELECT n,n,n,1 FROM DemoSeq;
INSERT INTO PedidoPrivacidade(id_pedido,id_cliente,tipo,descricao,status,resposta,data)
SELECT n,n,ELT(n,'acesso','correcao','exclusao','acesso','correcao','exclusao','acesso','correcao','exclusao','acesso'),
       'Solicitação fictícia para testar a fila de privacidade no ambiente local.',ELT(n,'aberto','em_analise','atendido','aberto','em_analise','atendido','aberto','em_analise','atendido','aberto'),
       IF(n IN (3,6,9),'Registro fictício atendido para demonstração.',NULL),DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;

INSERT INTO BlogPost(id_post,titulo,resumo,conteudo,imagem_url,publicado,data_publicacao)
SELECT n,
       ELT(n,'Como construir uma rotina de cuidados com a pele','O que esperar de uma limpeza de pele','Cuidados antes e depois de uma sessão a laser','Hidratação e bem-estar no dia a dia','Conheça a radiofrequência estética','Peeling: avaliação e cuidados','Massagem e autocuidado','Proteção solar em todas as estações','Como funciona uma avaliação estética','Tecnologia e cuidado individualizado'),
       CONCAT('Conteúdo demonstrativo ',n,' sobre cuidados, bem-estar e procedimentos estéticos.'),
       CONCAT('Este artigo fictício existe para demonstrar a publicação de conteúdo no site BellaPelle. ',
              'As orientações de saúde devem ser individualizadas por um profissional habilitado. ',
              'Nenhuma recomendação deste conteúdo substitui uma avaliação profissional.'),
       CASE WHEN n IN (2,3,6,8) THEN '/images/bellapelle-facial-new.webp' WHEN n IN (4,7,10) THEN '/images/bellapelle-body-new.webp' ELSE '/images/bellapelle-editorial-new.webp' END,
       1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;

UPDATE ConfiguracaoPublica SET telefone='(11) 4000-0000',whatsapp='551140000000',email='contato@example.com',
       endereco='Endereço fictício — preencher antes de publicar',horario_atendimento='Segunda a sexta, das 9h às 19h — horários de demonstração',
       cnpj=NULL,politica_privacidade='Política fictícia para desenvolvimento. Substituir por conteúdo validado antes da publicação.' WHERE id=1;
UPDATE PoliticaFalta SET consumir_sessao=0,justificativa='Política fictícia: faltas não consomem sessões na demonstração.',atualizado_em=UTC_TIMESTAMP(),id_autor=1 WHERE id=1;

DROP TEMPORARY TABLE DemoSeq;
COMMIT;
