-- Conteúdo totalmente fictício, somente para um banco local de demonstração.
-- O script scripts/seed.mjs exige ALLOW_DEMO_SEED=true e tabelas de negócio vazias.
-- Este conteúdo é apenas para demonstração local; não o carregue em produção.
START TRANSACTION;

CREATE TEMPORARY TABLE DemoSeq (n TINYINT UNSIGNED PRIMARY KEY);
INSERT INTO DemoSeq VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10);

INSERT INTO Cliente(id_cliente,nome_completo,cpf,data_nascimento,genero,telefone,email,endereco,como_conheceu,preferencias)
SELECT n, ELT(n,'Amanda Oliveira','Beatriz Ferreira','Carolina Martins','Daniela Costa','Elisa Rodrigues','Fernanda Almeida','Gabriela Santos','Helena Barbosa','Isabela Ribeiro','Juliana Nascimento'),
       CONCAT('900000000',LPAD(n,2,'0')), DATE_SUB(CURRENT_DATE,INTERVAL ELT(n,27,32,41,35,29,38,44,31,36,47) YEAR),
       ELT(n,'Feminino','Feminino','Feminino','Feminino','Feminino','Feminino','Feminino','Feminino','Masculino','Prefere não informar'),
       ELT(n,'11981234061','11983452970','11985671032','11987896245','11989127304','11990341857','11992564180','11994785362','11996812049','11998937516'),
       CONCAT('cliente',LPAD(n,2,'0'),'@example.test'),
       ELT(n,'Rua Harmonia, 436, Vila Madalena, São Paulo - SP','Rua Tito, 818, Vila Romana, São Paulo - SP','Rua dos Pinheiros, 1040, Pinheiros, São Paulo - SP','Rua Padre Carvalho, 593, Pinheiros, São Paulo - SP','Alameda Lorena, 2270, Jardins, São Paulo - SP','Rua Cardoso de Almeida, 742, Perdizes, São Paulo - SP','Rua Cerro Corá, 1280, Alto da Lapa, São Paulo - SP','Rua Clélia, 955, Lapa, São Paulo - SP','Rua Cayowaá, 1560, Perdizes, São Paulo - SP','Rua Joaquim Antunes, 320, Pinheiros, São Paulo - SP'),
       ELT(n,'Indicação','Instagram','Busca na internet','Indicação','Redes sociais','Cliente recorrente','Busca na internet','Instagram','Indicação','Redes sociais'),
       ELT(n,'Prefere horários pela manhã.','Tem interesse em cuidados faciais.','Prefere atendimento no início da tarde.','Busca uma rotina de cuidados simples.','Prefere receber lembretes por e-mail.','Tem interesse em procedimentos corporais.','Prefere horários no fim da tarde.','Busca cuidados regulares para a pele.','Prefere atendimento aos sábados.','Tem interesse em avaliação personalizada.')
FROM DemoSeq;

INSERT INTO Profissional(id_profissional,nome,especialidade,registro_profissional,telefone,email,data_admissao,foto_url,anos_experiencia)
SELECT n,ELT(n,'Dra. Marina Alves','Camila Santos','Renata Oliveira'),
       ELT(n,'Estética facial','Estética corporal','Laser e tecnologia'),
       CONCAT('EST-',ELT(n,'2018-0417','2020-0826','2016-0319')),
       ELT(n,'11997654321','11994567832','11993456781'),
       CONCAT('profissional',LPAD(n,2,'0'),'@example.test'),
       DATE_SUB(CURRENT_DATE,INTERVAL ELT(n,8,6,10) YEAR),
       ELT(n,'/images/bellapelle-team-new.webp','/images/bellapelle-team2-new.webp','/images/bellapelle-team3-new.webp'),
       ELT(n,8,6,10) FROM DemoSeq WHERE n<=3;

INSERT INTO Procedimento(id_procedimento,nome,categoria,duracao_minutos,valor_avulso,exige_registro_foto,descricao,imagem_url)
SELECT n,
       ELT(n,'Limpeza e hidratação facial','Massagem relaxante','Depilação a laser','Microagulhamento facial','Radiofrequência corporal','Peeling superficial','Drenagem linfática','Revitalização facial','Tratamento de manchas','Cuidado facial premium'),
       ELT(n,'Facial','Corporal','Depilação','Facial','Tecnologia','Facial','Corporal','Facial','Tecnologia','Facial'),
       ELT(n,50,60,35,60,45,40,55,45,50,70),ELT(n,160,190,180,260,220,170,180,200,240,290),
       IF(n IN (3,4,5,9),1,0),
       ELT(n,'Higienização e hidratação com avaliação individual.','Massagem corporal realizada por profissional habilitada.','Tecnologia aplicada conforme avaliação e protocolo.','Cuidado facial conduzido após avaliação profissional.','Tratamento tecnológico com plano individualizado.','Renovação da pele com orientação profissional.','Manobras suaves para promover bem-estar e conforto.','Ritual facial de cuidado e hidratação.','Plano de cuidado sujeito à avaliação individual.','Atendimento personalizado com acompanhamento profissional.'),
       CASE WHEN n IN (2,3,5,7) THEN '/images/bellapelle-body-new.webp' WHEN n IN (6,10) THEN '/images/bellapelle-editorial-new.webp' ELSE '/images/bellapelle-facial-new.webp' END
FROM DemoSeq;

INSERT INTO Sala(id_sala,nome,descricao) SELECT n,CONCAT('Sala ',LPAD(n,2,'0')),ELT(n,'Atendimento facial e avaliações','Procedimentos corporais','Laser e tecnologia','Atendimento facial','Massoterapia','Procedimentos corporais','Atendimento facial','Laser e tecnologia','Dermocosmética','Atendimento integrativo') FROM DemoSeq;
INSERT INTO Equipamento(id_equipamento,nome,tipo) SELECT n,ELT(n,'Vapor de ozônio','Ultrassom','Laser diodo','Radiofrequência','LED facial','Peeling ultrassônico','Endermoterapia','Microcorrentes','Luz pulsada','Eletroestimulação'),ELT(n,'Vapor','Ultrassom','Laser','Radiofrequência','LED','Ultrassom','Corporal','Facial','Luz','Eletroterapia') FROM DemoSeq;

INSERT INTO ProfissionalProcedimento(id_prof_procedimento,id_profissional,id_procedimento,percentual_comissao) SELECT n,MOD(n-1,3)+1,n,ELT(n,30,28,32,30,28,32,30,28,32,30) FROM DemoSeq;
INSERT INTO AgendaConfiguracao(id_procedimento,id_profissional,id_sala,id_equipamento) SELECT n,MOD(n-1,3)+1,n,IF(n=2,NULL,n) FROM DemoSeq;

INSERT INTO Usuario(nome,email,senha_hash,perfil,id_profissional,permissoes)
SELECT ELT(n,'Ana Paula Ribeiro','Beatriz Costa','Marina Alves','Camila Santos','Renata Oliveira','Mariana Ferreira'),
       CONCAT('usuario.demo',LPAD(n,2,'0'),'@example.test'),'demo-password-pending',
       ELT(n,'administrador','recepcao','profissional','profissional','profissional','financeiro'),
       CASE n WHEN 3 THEN 1 WHEN 4 THEN 2 WHEN 5 THEN 3 ELSE NULL END,NULL FROM DemoSeq WHERE n<=6;

INSERT INTO Anamnese(id_anamnese,id_cliente,id_profissional,gestante_lactante,marcapasso,proteses_metalicas,alergia_acidos_anestesicos,uso_isotretinoina,tendencia_queloide,lesoes_ativas_pele,fototipo_fitzpatrick,medida_cintura,medida_quadril,medida_coxa,data_avaliacao,contraindicacoes,id_autor)
SELECT n,n,MOD(n-1,3)+1,0,0,0,'Sem informação clínica específica neste perfil de demonstração.',0,0,'Sem observações registradas.',MOD(n-1,6)+1,70+n,90+n,48+n,DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY),'Registro demonstrativo; confirmar todos os dados em avaliação presencial.',1 FROM DemoSeq;

INSERT INTO Pacote(id_pacote,id_procedimento,nome,quantidade_sessoes,validade_meses,valor_total)
SELECT n,n,CONCAT('Plano de cuidado ',ELT(n,'Hidratação','Relaxamento','Laser','Revitalização','Tecnologia','Renovação','Bem-estar','Luminosidade','Equilíbrio','BellaPelle'),' — 5 sessões'),5,6,ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2) FROM DemoSeq;
INSERT INTO PacoteCliente(id_pacote_cliente,id_cliente,id_pacote,data_compra,data_validade,sessoes_contratadas,sessoes_utilizadas,valor_contratado,status_pagamento)
SELECT n,n,n,DATE_SUB(CURRENT_DATE,INTERVAL (n+10) DAY),DATE_ADD(CURRENT_DATE,INTERVAL 170 DAY),5,1,ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2),'pago' FROM DemoSeq;

INSERT INTO Agendamento(id_agendamento,id_cliente,id_profissional,id_sala,id_equipamento,id_procedimento,id_pacote_cliente,data_hora_inicio,data_hora_fim,status,origem_solicitacao,valor_sessao)
SELECT n,n,MOD(n-1,3)+1,n,IF(n=2,NULL,n),n,n,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),DATE_ADD(DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),INTERVAL ELT(n,50,60,35,60,45,40,55,45,50,70) MINUTE),'concluido',ELT(n,'aplicativo','recepcao','whatsapp','aplicativo','telefone','recepcao','aplicativo','whatsapp','telefone','recepcao'),ELT(n,160,190,180,260,220,170,180,200,240,290) FROM DemoSeq;

-- Próximos horários para a área do cliente e o calendário administrativo.
INSERT INTO Agendamento(id_agendamento,id_cliente,id_profissional,id_sala,id_equipamento,id_procedimento,id_pacote_cliente,data_hora_inicio,data_hora_fim,status,origem_solicitacao,valor_sessao)
SELECT n+10,n,MOD(n-1,3)+1,n,IF(n=2,NULL,n),n,n,
       TIMESTAMP(DATE_ADD(CURRENT_DATE,INTERVAL (n+1) DAY),'10:00:00'),
       DATE_ADD(TIMESTAMP(DATE_ADD(CURRENT_DATE,INTERVAL (n+1) DAY),'10:00:00'),INTERVAL ELT(n,50,60,35) MINUTE),
       'confirmado','aplicativo',ELT(n,160,190,180) FROM DemoSeq WHERE n<=3;

INSERT INTO Atendimento(id_atendimento,id_agendamento,regiao_corpo_tratada,parametros_utilizados,descricao_evolucao,data_atendimento,status,id_autor)
SELECT n,n,ELT(n,'Face','Ombros e costas','Pernas','Face','Abdômen','Face','Pernas','Face','Face','Face'),'Parâmetros ilustrativos — validar antes de qualquer atendimento real.','Registro fictício de demonstração; não representa prontuário de paciente.',DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),'concluido',1 FROM DemoSeq;

INSERT INTO Produto(id_produto,nome,categoria,marca,quantidade_estoque,saldo_inicial,unidade_medida,numero_lote,data_validade,valor_unitario,ativo,estoque_minimo)
SELECT n,ELT(n,'Máscara hidratante','Creme de massagem','Gel condutor','Sabonete facial','Sérum calmante','Gel pós-laser','Óleo vegetal','Máscara de argila','Protetor solar','Solução de limpeza'),'Cosmético','Linha Profissional BellaPelle',10,20,'ml',CONCAT('BP-2026-',LPAD(n,4,'0')),DATE_ADD(CURRENT_DATE,INTERVAL 365 DAY),ELT(n,48,62,36,29,74,41,55,32,67,28),1,3 FROM DemoSeq;
INSERT INTO ProdutoAplicado(id_produto_aplicado,id_atendimento,id_produto,nome_produto,marca,numero_lote,data_validade,quantidade)
SELECT n,n,n,ELT(n,'Máscara hidratante','Creme de massagem','Gel condutor','Sabonete facial','Sérum calmante','Gel pós-laser','Óleo vegetal','Máscara de argila','Protetor solar','Solução de limpeza'),'Linha Profissional BellaPelle',CONCAT('BP-2026-',LPAD(n,4,'0')),DATE_ADD(CURRENT_DATE,INTERVAL 365 DAY),10 FROM DemoSeq;
INSERT INTO MovimentacaoEstoque(id_movimentacao,id_produto,id_atendimento,tipo,quantidade,data,motivo,id_autor)
SELECT n,n,n,'saida',10,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),'Consumo de produto registrado no atendimento.',1 FROM DemoSeq;

INSERT INTO Pagamento(id_pagamento,id_cliente,id_pacote_cliente,id_agendamento,forma_pagamento,valor_total,numero_parcelas,data_pagamento,status)
SELECT n,n,n,NULL,ELT(n,'pix','cartao_credito','cartao_debito','dinheiro','pix','cartao_credito','pix','dinheiro','cartao_debito','pix'),ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2),1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+10) DAY),'pago' FROM DemoSeq;
INSERT INTO Parcela(id_parcela,id_pagamento,numero_parcela,valor_parcela,data_vencimento,data_pagamento,status,valor_recebido)
SELECT n,n,1,ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2),DATE_SUB(CURRENT_DATE,INTERVAL (n+10) DAY),DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+10) DAY),'paga',ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2) FROM DemoSeq;
INSERT INTO Favorito(id_cliente,id_procedimento) SELECT n,n FROM DemoSeq;
INSERT INTO Avaliacao(id_avaliacao,id_agendamento,nota,comentario,consentimento_publicacao,publicada,data_avaliacao)
SELECT n,n,ELT(n,5,5,4,5,5,4,5,5,4,5),
       ELT(n,'A equipe explicou cada etapa com cuidado e o atendimento foi muito atencioso.','Gostei do ambiente tranquilo e da pontualidade. Saí com orientações claras para continuar os cuidados em casa.','A avaliação foi detalhada e me ajudou a entender qual procedimento fazia sentido para mim.','Profissional cuidadosa e muito gentil durante todo o atendimento.','Agendamento simples e atendimento organizado do começo ao fim.','A sessão foi confortável e recebi explicações sobre os cuidados depois do procedimento.','O espaço é acolhedor e a equipe demonstrou bastante atenção.','Fui atendida no horário e gostei da forma clara como explicaram o procedimento.','Experiência positiva, com atendimento delicado e ambiente bem cuidado.','Gostei do acompanhamento e das recomendações personalizadas que recebi.'),
       1,1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;

INSERT INTO Bloqueio(id_profissional,id_sala,id_equipamento,inicio,fim,motivo,ativo)
SELECT MOD(n-1,3)+1,n,NULL,DATE_SUB(DATE_ADD(CURRENT_DATE,INTERVAL (n+30) DAY),INTERVAL 1 HOUR),DATE_ADD(CURRENT_DATE,INTERVAL (n+30) DAY),ELT(n,'Manutenção preventiva','Ajuste de equipamento','Revisão de sala','Treinamento da equipe','Manutenção programada','Limpeza técnica','Revisão de equipamento','Ajuste de agenda','Intervenção técnica','Manutenção preventiva'),1 FROM DemoSeq;
INSERT INTO EventoAgenda(id_evento,id_agendamento,tipo,motivo,id_autor,data,sessao_consumida,politica_aplicada)
SELECT n,n,'conclusao','Agendamento concluído — registro fictício.',1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),1,'Demonstração: sessões ilustrativas consumidas.' FROM DemoSeq;
INSERT INTO ConsumoSessao(id_consumo,id_agendamento,id_pacote_cliente,data)
SELECT n,n,n,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY) FROM DemoSeq;
INSERT INTO Comissao(id_comissao,id_atendimento,id_profissional,base_calculo,percentual,valor,status,data,data_pagamento)
SELECT n,n,MOD(n-1,3)+1,ELT(n,160,190,180,260,220,170,180,200,240,290),ELT(n,30,28,32,30,28,32,30,28,32,30),ROUND(ELT(n,160,190,180,260,220,170,180,200,240,290)*ELT(n,30,28,32,30,28,32,30,28,32,30)/100,2),'paga',DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+1) DAY),DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;
INSERT INTO Recebimento(id_recebimento,id_parcela,valor,tipo,id_autor,data,motivo)
SELECT n,n,ROUND((ELT(n,160,190,180,260,220,170,180,200,240,290)*5)*0.88,2),'recebimento',1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+10) DAY),'Pagamento registrado pela recepção.' FROM DemoSeq;
INSERT INTO HistoricoPreco(id_historico,id_procedimento,valor,data,id_autor)
SELECT n,n,ELT(n,160,190,180,260,220,170,180,200,240,290),DATE_SUB(UTC_TIMESTAMP(),INTERVAL (n+30) DAY),1 FROM DemoSeq;

INSERT INTO Auditoria(id_auditoria,id_usuario,acao,recurso,id_registro,data)
SELECT n,1,'criar','cliente',n,DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;
INSERT INTO AuditoriaSeguranca(id,id_usuario,acao,recurso,criado_em)
SELECT n,1,'login','sessao',DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;
INSERT INTO ContaCliente(id_cliente,senha_hash) SELECT n,'demo-password-pending' FROM DemoSeq;
INSERT INTO AuditoriaCliente(id,id_cliente,acao,recurso,criado_em)
SELECT n,n,'atualizar_dados','perfil',DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;
INSERT INTO VinculoClinico(id_vinculo,id_cliente,id_profissional,ativo) SELECT n,n,MOD(n-1,3)+1,1 FROM DemoSeq;
INSERT INTO PedidoPrivacidade(id_pedido,id_cliente,tipo,descricao,status,resposta,data)
SELECT n,n,ELT(n,'acesso','correcao','exclusao','acesso','correcao','exclusao','acesso','correcao','exclusao','acesso'),
       ELT(n,'Solicito uma cópia dos dados associados à minha conta.','Peço a correção do telefone cadastrado.','Solicito a exclusão da conta e dos dados não sujeitos à retenção.','Gostaria de consultar os dados do meu perfil.','Peço a atualização do endereço cadastrado.','Solicito informações sobre a retenção dos meus dados.','Gostaria de receber uma cópia dos meus dados pessoais.','Peço a correção do nome no cadastro.','Solicito o encerramento da minha conta.','Gostaria de consultar as informações mantidas no sistema.'),
       ELT(n,'aberto','em_analise','atendido','aberto','em_analise','atendido','aberto','em_analise','atendido','aberto'),
       IF(n IN (3,6,9),'Solicitação analisada pela equipe responsável.',NULL),DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;

INSERT INTO BlogPost(id_post,titulo,resumo,conteudo,imagem_url,publicado,data_publicacao)
SELECT n,
       ELT(n,'Como construir uma rotina de cuidados com a pele','O que esperar de uma limpeza de pele','Cuidados antes e depois de uma sessão a laser','Hidratação e bem-estar no dia a dia','Conheça a radiofrequência estética','Peeling: avaliação e cuidados','Massagem e autocuidado','Proteção solar em todas as estações','Como funciona uma avaliação estética','Tecnologia e cuidado individualizado'),
       ELT(n,'Pequenos hábitos diários ajudam a manter uma rotina de cuidado consistente. Veja como organizar as etapas sem complicar o dia a dia.','Entenda como funciona uma sessão, quais etapas podem fazer parte da avaliação e por que cada pele recebe uma orientação própria.','Saiba quais cuidados gerais conversar com a profissional antes e depois da sessão, incluindo exposição solar e uso de cosméticos.','Hidratação, sono e proteção solar fazem parte de uma rotina equilibrada. Conheça recomendações gerais para conversar com sua especialista.','Conheça a tecnologia e veja por que a indicação depende da avaliação, do histórico e dos objetivos de cada pessoa.','Conheça as etapas comuns de uma avaliação e os cuidados que a equipe pode recomendar conforme cada caso.','Uma pausa de autocuidado pode fazer parte da rotina. Saiba como escolher um atendimento adequado às suas preferências.','A proteção solar diária é um cuidado importante. Converse com um profissional para escolher produtos adequados à sua pele.','A avaliação ajuda a entender objetivos, rotina e possíveis restrições antes de definir um plano de cuidado.','Cada plano considera as necessidades, os procedimentos disponíveis e o acompanhamento recomendado pela equipe.'),
       ELT(n,'Uma rotina simples e constante pode ser mais fácil de manter.','Conheça as etapas e o que conversar durante a avaliação.','Orientações gerais para conversar com a profissional responsável.','Cuidados cotidianos e bem-estar com acompanhamento profissional.','A indicação depende de avaliação individualizada.','Avaliação e orientações variam conforme as características da pele.','Escolhas de autocuidado respeitando o ritmo de cada pessoa.','Converse com um profissional sobre o produto adequado para você.','Um momento para esclarecer dúvidas e alinhar expectativas.','O plano é definido em conjunto com a equipe da clínica.'),
       CASE WHEN n IN (2,3,6,8) THEN '/images/bellapelle-facial-new.webp' WHEN n IN (4,7,10) THEN '/images/bellapelle-body-new.webp' ELSE '/images/bellapelle-editorial-new.webp' END,
       1,DATE_SUB(UTC_TIMESTAMP(),INTERVAL n DAY) FROM DemoSeq;

DROP TEMPORARY TABLE DemoSeq;
COMMIT;
