# API do cliente

Base `/api/customer`. Respostas JSON; dados individuais nunca são selecionados por id_cliente recebido do cliente: são derivados da sessão. Todas as mutações exigem Origin igual a APP_ORIGIN. Após autenticação, exigem X-CSRF-Token da sessão e cookie bellapelle_customer.

| Método / rota | Entrada / resultado |
|---|---|
| POST auth/register | nome_completo, cpf, data_nascimento (AAAA-MM-DD), email, password (12–128), telefone opcional; HTTP 201 |
| POST auth/login | email, password; cookie e csrfToken |
| GET auth/session | id, name, email, csrfToken da sessão |
| POST auth/logout | encerra sessão e remove cookie |
| POST auth/forgot | email; resposta genérica, fila de ativação/recuperação |
| POST auth/reset | token, password; revoga sessões e invalida tokens |
| GET bootstrap | catálogo ativo, favoritos e agendamentos próprios |
| GET slots | query treatmentId, date, exclude opcional (agendamento próprio) |
| PUT favorites | treatmentId, active boolean |
| POST bookings | treatmentId, date, time HH:00/HH:30, payment Pix/Cartão de crédito, packageId opcional |
| PATCH bookings/{id} | mesmos campos; permite somente remarcação do mesmo procedimento |
| DELETE bookings/{id} | cancela reserva própria futura e aberta |
| GET account | perfil, pacotes, parcelas e solicitações próprias |
| PATCH account | telefone, endereco, preferencias; não altera CPF/e-mail |
| POST privacy | tipo acesso/correcao/exclusao, descricao (5–2000) |

Erros 401 sessão, 403 origem/CSRF, 404 objeto ausente ou não pertencente ao cliente, 409 conflito, 422 validação, 429 limite, 500 falha genérica. Nenhum stack trace é enviado. Sessão de oito horas, recuperação de 30 minutos.
